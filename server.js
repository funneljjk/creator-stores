#!/usr/bin/env node
// The builder PLATFORM backend.
// Input a YouTube link (+ optional runmoa keys) → auto-analyze → recommend the
// optimal solution → generate the tailored storefront → deploy to runmoa.
//
//   GET  /                → builder wizard (web-builder/)
//   GET  /store/*         → the generated storefront (web/)
//   POST /api/analyze     → { brand, signals, recommendation }
//   POST /api/generate    → builds catalog, writes web/js/data.js
//   POST /api/deploy      → validates keys + creates contents/products on runmoa
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { analyzeChannel, normalizeChannelUrl } from './src/youtube.js';
import { deriveInsights } from './src/analyze.js';
import { discoverLinks, extractSocials, mergeSocials, blogRssFrom, webSearchSocials, withInferredThreads } from './src/discover.js';
import { fetchFeed } from './src/feeds.js';
import { parseEmbeds } from './src/embeds.js';
import { recommend, BLUEPRINTS, MODULES } from './src/recommend.js';
import { buildReport } from './src/deepanalysis.js';
import { generateCopy } from './src/copygen.js';
import { generateImage, mapLimit, imgHash, thumbPrompt } from './src/imagegen.js';
import { buildCatalog } from './src/catalog.js';
import { RunmoaClient, normalizeCategories } from './src/runmoa.js';
import { courseToContentPayload, productToProductPayload, coachingToContentPayload } from './src/mapper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const CACHE = new Map(); // url → { profile, insights, rec }

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}
function serveStatic(res, baseDir, rel) {
  const file = path.join(baseDir, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(baseDir)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream');
  });
}

function chooseBlueprint(rec, body) {
  let bp = body.blueprintKey && BLUEPRINTS[body.blueprintKey]
    ? { ...BLUEPRINTS[body.blueprintKey] }
    : { ...rec.blueprint };
  if (Array.isArray(body.modules) && body.modules.length) bp.modules = body.modules;
  bp.reasons = rec.blueprint.reasons;
  return bp;
}

const STARTED_AT = new Date().toISOString();
const CACHE_DIR = path.join(__dirname, '.cache');
function cacheFile(key) { return path.join(CACHE_DIR, 'an_' + Buffer.from(key).toString('base64url') + '.json'); }

// Search API key for reliable web-search discovery (instagram/threads/homepage
// that aren't linked on YouTube). Read fresh each call: env SERP_API_KEY, else
// .search.json {"serpApiKey":"..."}. Absent → falls back to the DDG scraper.
function SEARCH_KEY() {
  if (process.env.SERP_API_KEY) return process.env.SERP_API_KEY;
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '.search.json'), 'utf8')).serpApiKey || null; } catch { return null; }
}
// Gemini config for bespoke store copy. env GEMINI_API_KEY / GEMINI_MODEL, else .ai.json.
function AI_CFG() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(path.join(__dirname, '.ai.json'), 'utf8')); } catch { /* none */ }
  return { geminiApiKey: process.env.GEMINI_API_KEY || c.geminiApiKey || null, model: process.env.GEMINI_MODEL || c.model || 'gemini-3.1-pro-preview' };
}

// a GitHub-Pages-safe, PERMANENT, UNIQUE repo slug for a creator store.
// Each store lives at funneljjk.github.io/<slug>/ in its own repo, so the slug
// MUST differ per creator. Priority: explicit body.slug → ascii @handle →
// ascii channel NAME words → channel id → 'store'.
// Why not just the @handle: a Korean handle (@골프레슨장인) sanitises to '' and
// used to fall back to the shared literal 'store' → EVERY Korean creator
// clobbered the same repo. The channel id is always unique + permanent, so it
// is the last real fallback before the 'store' sentinel.
function sluggify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}
// PINNED slugs: channelId → permanent slug. A store URL must NEVER move once
// shared (fans bookmark it) — a channel RENAME would otherwise re-derive a
// different slug and publish to a new repo, silently orphaning the old URL.
const SLUG_PINS = {
  UCvW2d_etvxPTx2Nu6HC0bWw: 'tv-vw2d-e', // 뚜러뻥사람심리_뚜사심심리학TV
};
function storeSlug(profile, body) {
  const ch = (profile && profile.channel) || {};
  // explicit override wins verbatim (the user chose it)
  const explicit = sluggify(body && body.slug);
  if (explicit) return explicit;
  if (ch.channelId && SLUG_PINS[ch.channelId]) return SLUG_PINS[ch.channelId];
  const cands = [
    (String((body && body.url) || '').match(/@([A-Za-z0-9_.\-]+)/) || [])[1], // ascii @handle
    ch.handle && String(ch.handle).replace(/^@/, ''),                    // handle from meta
    ch.name,                     // e.g. "Private Golf Performance Lab [골프…]" → private-golf-performance-lab
    ch.channelId,                // UCXyeuG8z2Xl84tpM0q1eJUA → ucxyeug8… (always unique + permanent)
  ];
  // a mostly-Korean name can shed to a stub like "tv" ("뚜사심심리학TV" → "tv"):
  // too short/generic to own a repo — every "OO TV" channel would collide.
  // De-genericize with a channel-id tail so it stays readable AND unique.
  const GENERIC = new Set(['tv', 'store', 'shorts', 'channel', 'official', 'youtube', 'video', 'videos', 'live', 'vlog', 'daily']);
  const tail = sluggify(ch.channelId).replace(/^uc/, '').slice(0, 6);
  for (const c of cands) {
    let s = sluggify(c);
    if (!s) continue;
    if (s.length < 4 || GENERIC.has(s)) s = tail ? `${s}-${tail}` : s;
    if (s.length >= 4) return s;
  }
  return sluggify(ch.channelId) || 'store';
}
// publish the static web/ to a per-creator GitHub Pages repo via deploy.sh.
// Returns { ok, url }. Best-effort — needs `gh` authed locally (skipped online).
function publishStore(slug) {
  return new Promise((resolve) => {
    execFile('bash', [path.join(__dirname, 'deploy.sh'), slug], { cwd: __dirname, timeout: 120000 }, (err, stdout, stderr) => {
      const out = String(stdout || '') + String(stderr || '');
      const m = out.match(/https:\/\/[a-z0-9.\-]+\.github\.io\/[^\s]+/i);
      resolve({ ok: !err && !!m, url: m ? m[0] : null, log: out.slice(-400) });
    });
  });
}

async function getAnalysis(url, opts) {
  const key = normalizeChannelUrl(url);
  if (CACHE.has(key) && !opts?.fresh) return CACHE.get(key);
  // disk cache survives server restarts → repeat generations are instant
  if (!opts?.fresh) {
    try {
      const f = cacheFile(key);
      if (fs.existsSync(f)) { const e = JSON.parse(fs.readFileSync(f, 'utf8')); CACHE.set(key, e); return e; }
    } catch { /* ignore corrupt cache */ }
  }
  // analyze (yt-dlp) + discover other channels (about page) in parallel
  const [profile, discovered] = await Promise.all([
    analyzeChannel(url, { limitVideos: opts?.limitVideos || 10, limitShorts: opts?.limitShorts || 15 }),
    discoverLinks(url).catch(() => ({ socials: [], blog: null, all: [] })),
  ]);
  // WEB SEARCH the creator's name for socials/homepage NOT linked on youtube
  // (insta/threads/x/blog/homepage that only surface when you google the name).
  const ytHandle = (url.match(/@([A-Za-z0-9_.-]+)/) || [])[1] || profile.channel.handle;
  let web = { socials: [], blog: null, website: null };
  try { web = await webSearchSocials(profile.channel.name, ytHandle, { serpApiKey: SEARCH_KEY() }); } catch { /* non-fatal */ }
  const webSocials = (web.socials || []).concat(web.website ? [web.website] : []);
  discovered.socials = withInferredThreads(mergeSocials(discovered.socials || [], webSocials));
  if (!discovered.blog && web.blog) discovered.blog = web.blog;
  const insights = deriveInsights(profile);
  const rec = recommend(profile, insights);
  const entry = { profile, insights, rec, discovered };
  CACHE.set(key, entry);
  try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(cacheFile(key), JSON.stringify(entry)); } catch { /* non-fatal */ }
  return entry;
}

// Assemble the creator-hub data (socials + blog feed + raw youtube feed).
async function buildHub(profile, discovered, body) {
  // AUTO-DISCOVER socials from every source: youtube about page (discovered) +
  // channel description + each video description. Creators put their insta/x/
  // threads/blog in the about AND in most video descriptions — scanning both
  // catches what a single source misses. Manual body.socials only augments.
  const descBlob = [profile.channel?.description || '', ...(profile.videos || []).map((v) => v.description || '')].join('\n');
  const fromDesc = extractSocials(descBlob);
  const merged = mergeSocials(discovered.socials || [], fromDesc.filter((s) => s.kind === 'social'), (body && body.socials) || []);
  const socials = merged;
  // blog: discovered → else first blog-kind link found in descriptions → else manual
  let blog = discovered.blog ? { ...discovered.blog, posts: [] } : null;
  if (!blog) { const b = fromDesc.find((s) => s.kind === 'blog'); if (b) blog = { ...b, rssUrl: blogRssFrom(b.url), posts: [] }; }
  if (body && body.blogUrl && !blog) blog = { platform: 'blog', label: '블로그', url: body.blogUrl, rssUrl: body.blogRss || (body.blogUrl.replace(/\/$/, '') + '/feed'), posts: [] };
  if (blog && blog.rssUrl) {
    const f = await fetchFeed(blog.rssUrl, 14);
    blog.posts = f.posts;
  }
  const instagram = socials.find((s) => s.platform === 'instagram') || (body && body.instagramUrl ? { platform: 'instagram', label: 'Instagram', url: body.instagramUrl, handle: (body.instagramUrl.match(/instagram\.com\/([^/?]+)/) || [])[1] } : null);
  const youtube = {
    url: profile.channel.url,
    // TRUE channel scale (whole tab), so the store shows "76개 영상 · 772개 쇼츠"
    // — not the sampled counts. videos/shorts arrays stay the displayed subset.
    totalVideos: profile.channel.totalVideos ?? (profile.feedVideos || []).length,
    totalShorts: profile.channel.totalShorts ?? (profile.shorts || []).length,
    videos: (profile.videos || []).map((v) => ({ id: v.id, title: v.title, thumbnail: v.thumbnail, url: v.url, views: v.views, duration: v.duration })),
    shorts: (profile.shorts || []).map((v) => ({ id: v.id, title: v.title, thumbnail: v.thumbnail, url: v.url })),
  };

  // ── MIXED feed: YouTube videos + shorts + IG/X embeds, interleaved ──
  // full-extracted videos carry real metrics (views/likes/comments); flat ones
  // (deduped) extend the feed for continuous scroll without metrics.
  const fullIds = new Set((profile.videos || []).map((v) => v.id));
  const ytFull = (profile.videos || []).map((v) => ({ source: 'youtube', id: v.id, title: v.title, thumbnail: v.thumbnail, url: v.url, duration: v.duration, views: v.views, likes: v.likes, comments: v.comments }));
  const ytFlat = (profile.feedVideos || []).filter((v) => !fullIds.has(v.id)).map((v) => ({ source: 'youtube', id: v.id, title: v.title, thumbnail: v.thumbnail, url: v.url, duration: v.duration }));
  const ytItems = ytFull.concat(ytFlat);
  const shortItems = (profile.shorts || []).map((v) => ({ source: 'short', id: v.id, title: v.title, thumbnail: v.thumbnail, url: v.url }));
  // only real, creator-supplied post embeds — no demo/placeholder seeding
  // (the seeded jack tweet / instagram placeholder looked like fake content)
  const embedItems = parseEmbeds(body && body.embeds);
  // weave: 2 videos, 1 short, repeat; sprinkle an embed every 4 items
  const base = [];
  let yi = 0, si = 0;
  while (yi < ytItems.length || si < shortItems.length) {
    if (yi < ytItems.length) base.push(ytItems[yi++]);
    if (yi < ytItems.length) base.push(ytItems[yi++]);
    if (si < shortItems.length) base.push(shortItems[si++]);
  }
  const feed = [];
  let ei = 0;
  base.forEach((it, idx) => {
    feed.push(it);
    if (embedItems.length && (idx + 1) % 4 === 0 && ei < embedItems.length) feed.push(embedItems[ei++]);
  });
  while (ei < embedItems.length) feed.push(embedItems[ei++]);

  return { socials, blog, instagram, youtube, feed, embedCount: embedItems.filter((e) => !e.placeholder).length };
}

function writeStoreData(catalog, extra) {
  const data = { ...catalog, ...(extra || {}), generatedAt: new Date().toISOString(), meta: { mode: 'platform' } };
  const dir = path.join(__dirname, 'web', 'js');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'data.js'), `window.__PLATFORM_DATA__ = ${JSON.stringify(data, null, 2)};\n`);
  return data;
}

// ── API handlers ──────────────────────────────────────────────────────
// Surface a bot-wall (yt-dlp returning 0 items on a datacenter IP) instead of
// letting it look like an empty channel — the "영상 0개" the user hit on Render.
function analysisWarnings(profile) {
  const w = [];
  const ch = profile.channel || {};
  const tv = ch.totalVideos ?? 0, ts = ch.totalShorts ?? 0;
  if (tv === 0 && ts === 0) {
    w.push('영상·숏폼 추출 0건 — YouTube가 이 서버 IP를 봇으로 차단했을 가능성이 큽니다. 서버 루트에 .yt-cookies.txt(Netscape 쿠키)를 넣으면 해결됩니다.');
  } else if (tv === 0) {
    w.push(`롱폼 영상 0건 (숏폼 ${ts}건은 정상). 영상 탭 봇차단이 의심됩니다.`);
  }
  return w;
}

// how many items did we SAMPLE for detail vs how many the channel actually has
function analysisCounts(profile) {
  const ch = profile.channel || {};
  const cap = ch.totalsCapped ? '+' : '';
  return {
    totalVideos: (ch.totalVideos ?? 0) + '' + (ch.totalVideos >= 2000 ? cap : ''),
    totalShorts: (ch.totalShorts ?? 0) + '' + (ch.totalShorts >= 2000 ? cap : ''),
    analyzedVideos: (profile.videos || []).length, // deep-extracted for the brain
    feedVideos: (profile.feedVideos || []).length, // thumbnails shown in the feed
  };
}

async function apiAnalyze(req, res) {
  const body = await readBody(req);
  if (!body.url) return send(res, 400, { error: 'url required' });
  try {
    const { profile, insights, rec, discovered } = await getAnalysis(body.url, { fresh: body.fresh });
    // merge about-page socials with ones scraped from channel + video descriptions
    const descBlob = [profile.channel?.description || '', ...(profile.videos || []).map((v) => v.description || '')].join('\n');
    const fromDesc = extractSocials(descBlob);
    const allSocials = mergeSocials(discovered.socials || [], fromDesc.filter((s) => s.kind === 'social'));
    let foundBlog = discovered.blog || fromDesc.find((s) => s.kind === 'blog') || null;
    send(res, 200, {
      brand: {
        name: profile.channel.name, handle: profile.channel.handle, tagline: insights.tagline,
        about: profile.channel.about || profile.channel.description, logo: profile.channel.avatar,
        banner: profile.channel.banner, subscribers: profile.channel.subscribers, youtube: profile.channel.url,
        topics: insights.topics,
      },
      counts: analysisCounts(profile),
      warnings: analysisWarnings(profile),
      discovered: { socials: allSocials, blog: foundBlog },
      signals: rec.signals,
      archetype: rec.archetype, archetypeLabel: rec.archetypeLabel,
      recommendation: rec.blueprint,
      alternatives: rec.alternatives,
      modulesMeta: MODULES,
      report: buildReport(profile, insights, rec),
    });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}

// AI thumbnails: generate one bespoke image per course + product, save to
// web/genimg (served at /store/genimg, deployed with the store), set .thumbnail.
// deterministic filename → generate + deploy reuse the same file (no re-gen).
const GENIMG_DIR = path.join(__dirname, 'web', 'genimg');
const IMG_VER = 'v3'; // bump when thumbPrompt changes so cached images regenerate
function genImgName(item) { return 'g' + IMG_VER + '_' + imgHash((item.id || '') + '|' + (item.title || '')) + '.png'; }
async function genThumbnails(catalog, key) {
  if (!key) return 0;
  try { fs.mkdirSync(GENIMG_DIR, { recursive: true }); } catch { /* ignore */ }
  const list = [
    ...(catalog.courses || []).map((o) => ({ o, kind: 'course' })),
    ...(catalog.coaching || []).map((o) => ({ o, kind: 'coaching' })),
    ...(catalog.products || []).map((o) => ({ o, kind: 'product' })),
  ];
  let n = 0;
  await mapLimit(list, 4, async (it) => {
    const name = genImgName(it.o), file = path.join(GENIMG_DIR, name);
    try {
      if (!fs.existsSync(file)) {
        // courses render a Korean title → use the model that draws text well;
        // products/coaching are text-free photos → the faster flash model.
        const model = it.kind === 'course' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        const b64 = await generateImage(thumbPrompt(it.o, it.kind, catalog.brand && catalog.brand.name), key, model);
        fs.writeFileSync(file, Buffer.from(b64, 'base64'));
      }
      it.o.thumbnail = 'genimg/' + name; it.o.aiImage = true; n++;
    } catch { /* keep existing thumbnail on failure */ }
  });
  return n;
}

// merge Gemini-written copy into the catalog (hero/pillars/why/reviews/products)
function applyCopy(catalog, copy, profile) {
  const c = catalog.concept || {};
  const ic = (c.pillars && c.pillars.map((p) => p.i)) || ['✦', '◆', '●'];
  catalog.concept = {
    ...c,
    role: copy.role || c.role,
    headline: copy.headline || c.headline,
    highlight: copy.highlight || null,
    statement: copy.statement || c.statement,
    pillars: Array.isArray(copy.pillars) && copy.pillars.length
      ? copy.pillars.slice(0, 3).map((p, i) => ({ i: ic[i] || '●', t: p.t, d: p.d }))
      : c.pillars,
    aiGenerated: true,
  };
  catalog.copy = {
    why: copy.why && Array.isArray(copy.why.reasons) ? { title: copy.why.title, reasons: copy.why.reasons.slice(0, 4) } : null,
    reviews: Array.isArray(copy.reviews) ? copy.reviews.slice(0, 6) : null,
    guarantee: copy.guarantee || null,
    aiGenerated: true,
  };
  if (Array.isArray(copy.products) && copy.products.length && Array.isArray(catalog.products)) {
    const logo = profile.channel.avatar || profile.channel.logo || '';
    catalog.products = copy.products.slice(0, 8).map((p, i) => ({
      id: 'aip_' + i, kind: 'product', title: p.title || ('상품 ' + (i + 1)),
      category: p.category || '디지털', cover: i % 6, icon: p.kind === 'physical' ? '📦' : '📘',
      thumbnail: logo, rating: Number((4.6 + (i % 4) / 10).toFixed(1)), reviews: 12 + i * 7, sold: 30 + i * 13,
      requiresShipping: p.kind === 'physical', price: { base: Math.max(2900, Number(p.priceKRW) || 19000), sale: null, onSale: false, free: false },
      options: [], description: p.desc || '', aiGenerated: true,
    }));
  }
  // Gemini-designed COURSES: replace the archetype-template courses (whose {t}
  // keyword-stuffing produced off-topic titles like "일산골프 포트폴리오 만들기"
  // or meditation classes on a CAD channel) with channel-grounded designs.
  // Template output stays as the no-key/failure fallback.
  const won900 = (n) => Math.max(9900, Math.round(n / 1000) * 1000 - 100);
  if (Array.isArray(copy.courses) && copy.courses.length && Array.isArray(catalog.courses) && catalog.courses.length) {
    const videoThumbs = (profile.videos || []).map((v) => v.thumbnail).filter(Boolean);
    const brandName = profile.channel.name || 'Creator';
    catalog.courses = copy.courses.slice(0, 5).map((g, i) => {
      const level = ['입문', '중급', '심화'].includes(g.level) ? g.level : (i === 0 ? '입문' : i < 3 ? '중급' : '심화');
      const lvDur = level === '심화' ? 18 : level === '중급' ? 14 : 10; // min/lesson
      const curTitles = (Array.isArray(g.curriculum) ? g.curriculum : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 16);
      const lessons = curTitles.length || 8;
      const curriculum = (curTitles.length ? curTitles : Array.from({ length: lessons }, (_, k) => `${k + 1}강`))
        .map((t, k) => ({ t: `${k + 1}강 · ${t.replace(/^\d+\s*강\s*[·.:-]?\s*/, '')}`, d: `${lvDur - 2 + (k % 3) * 3}분` }));
      const base = won900(Number(g.priceKRW) || 49000);
      const onSale = i % 3 !== 0;
      return {
        id: 'c_' + i, kind: 'course', designed: true, aiGenerated: true,
        title: g.title || `강의 ${i + 1}`, subtitle: `${brandName}이 직접 설계한 ${level} 과정`,
        tagline: g.tagline || '', category: g.category || '핵심', level, lessons,
        durationSec: lessons * lvDur * 60, icon: ['🎓', '🛠️', '📁', '🚀', '🔥'][i % 5], cover: i % 6,
        instructor: brandName, rating: Number((4.6 + (i % 4) / 10).toFixed(1)),
        reviews: 12 + i * 31, students: 80 + i * 217, bestseller: i === 0, isNew: i === copy.courses.length - 1,
        price: { base, sale: onSale ? won900(base * 0.72) : null, onSale, free: false },
        outcomes: (Array.isArray(g.outcomes) && g.outcomes.length ? g.outcomes : ['핵심 원리를 이해하고 바로 적용합니다']).slice(0, 4),
        curriculum,
        description: `${g.title} — ${brandName}의 전문성을 체계적인 커리큘럼으로 담은 ${level} 강의입니다.`,
        thumbnail: videoThumbs.length ? videoThumbs[i % videoThumbs.length] : undefined,
      };
    });
  }
  // Gemini-designed COACHING + LIVE: replace the pure-template "<topic> 1:1
  // 맞춤 코칭" (raw english keyword like "Cae"/"Autocad" stuffed into the
  // title). Target mix on runmoa: 2 offline sessions + 2 live classes
  // (content_type offline/live — the mapper picks by the `live` flag).
  if (Array.isArray(copy.coaching) && copy.coaching.length && Array.isArray(catalog.coaching) && catalog.coaching.length) {
    const offline = copy.coaching.slice(0, 2).map((g, i) => {
      const base = Math.max(19900, won900(Number(g.priceKRW) || 90000));
      return {
        id: 'co_' + (i + 1), kind: 'coaching', aiGenerated: true, live: false,
        title: g.title || `코칭 세션 ${i + 1}`,
        mode: ['1:1 오프라인', '오프라인 워크숍'].includes(g.mode) ? g.mode : ['1:1 오프라인', '오프라인 워크숍'][i],
        seats: Math.max(1, Number(g.seats) || [1, 20][i] || 1),
        schedule: g.schedule || ['매주 화·목 저녁', '월 1회 · 서울'][i] || '신청 후 일정 조율',
        price: { base, sale: null, onSale: false, free: false },
        cover: [0, 3][i] ?? i, icon: ['🎯', '🏫'][i] || '🎯',
        description: g.desc || '신청 후 일정을 조율해 진행하는 세션입니다.',
      };
    });
    const lives = (Array.isArray(copy.lives) ? copy.lives : []).slice(0, 2).map((g, i) => {
      const base = Math.max(9900, won900(Number(g.priceKRW) || 39000));
      const onSale = i === 0; // lead live class carries the discount hook
      return {
        id: 'lv_' + (i + 1), kind: 'coaching', aiGenerated: true, live: true,
        title: g.title || `라이브 클래스 ${i + 1}`,
        mode: '라이브 스트리밍',
        seats: Math.max(1, Number(g.seats) || 30),
        schedule: g.schedule || '격주 수요일 저녁 8시',
        price: { base, sale: onSale ? won900(base * 0.75) : null, onSale, free: false },
        cover: [4, 1][i] ?? i, icon: '🔴',
        description: g.desc || '실시간 라이브로 진행하고 Q&A로 마무리하는 클래스입니다.',
      };
    });
    catalog.coaching = [...offline, ...lives];
  }
  // keep derived stats/categories in sync with the replaced items
  catalog.categories = {
    course: [...new Set((catalog.courses || []).map((c) => c.category))],
    product: [...new Set((catalog.products || []).map((p) => p.category))],
  };
  const cs = catalog.stats || (catalog.stats = {});
  cs.courseCount = (catalog.courses || []).length;
  cs.productCount = (catalog.products || []).length;
  cs.coachingCount = (catalog.coaching || []).length;
  cs.students = (catalog.courses || []).reduce((s, c) => s + (c.students || 0), 0) || cs.students;
  if ((catalog.courses || []).length) {
    cs.avgRating = Number(((catalog.courses).reduce((s, c) => s + (c.rating || 4.8), 0) / catalog.courses.length).toFixed(2));
  }
}

// BESPOKE per-creator copy via Gemini (hero / why-buy / reviews / products /
// courses / coaching). SHARED by apiGenerate AND apiDeploy — deploy used to
// skip this and push the raw keyword-templates to runmoa ("Seconds 완전 정복",
// "위험한 브랜드 머그컵") while the store page showed Gemini items: two different
// catalogs, and title-based checkout mapping broke. The copy is DISK-CACHED per
// channel so generate and a later deploy produce IDENTICAL titles (Gemini at
// temperature 0.85 would otherwise design different items each call).
function copyCacheFile(url) { return path.join(CACHE_DIR, 'copy_' + Buffer.from(normalizeChannelUrl(url)).toString('base64url') + '.json'); }
async function enrichCatalog(catalog, { profile, insights, rec }, url, opts = {}) {
  const ai = AI_CFG();
  if (!ai.geminiApiKey) return;
  let copy = null;
  const f = copyCacheFile(url);
  if (!opts.fresh) { try { if (fs.existsSync(f)) copy = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { /* corrupt cache */ } }
  if (!copy) {
    try {
      const report = buildReport(profile, insights, rec);
      const ctx = {
        name: profile.channel.name, about: profile.channel.about || profile.channel.description,
        subs: profile.channel.subscribers, archetype: rec.archetype, archetypeLabel: rec.archetypeLabel,
        topics: insights.topics, keywords: (insights.keywords || []).map((k) => k.word),
        coreMessage: report.basics.coreMessage, target: report.basics.target,
        problem: report.basics.problem, expertImage: report.basics.expertImage,
        // shorts-only channels (or hosts where the /videos tab extraction
        // fails) would leave topVideos empty → weak grounding → generic copy.
        // Fall back to shorts titles so Gemini always sees real content.
        topVideos: [
          ...(report.content.topVideos || []).map((v) => v.title),
          ...((profile.shorts || []).map((s) => s.title)),
        ].filter(Boolean).slice(0, 8),
      };
      copy = await generateCopy(ctx, ai);
      if (copy) { try { fs.mkdirSync(CACHE_DIR, { recursive: true }); fs.writeFileSync(f, JSON.stringify(copy)); } catch { /* non-fatal */ } }
    } catch (e) { console.warn('[copy] gen failed:', e.message); }
  }
  if (copy) { try { applyCopy(catalog, copy, profile); } catch (e) { console.warn('[copy] apply failed:', e.message); } }
}

async function apiGenerate(req, res) {
  const body = await readBody(req);
  if (!body.url) return send(res, 400, { error: 'url required' });
  try {
    const { profile, insights, rec, discovered } = await getAnalysis(body.url, { fresh: body.fresh });
    const blueprint = chooseBlueprint(rec, body);
    const catalog = buildCatalog(profile, insights, blueprint);
    await enrichCatalog(catalog, { profile, insights, rec }, body.url, { fresh: body.fresh });
    // AI thumbnails per course + product (replaces YouTube frames / brand logo)
    const ai = AI_CFG();
    if (ai.geminiApiKey) { try { await genThumbnails(catalog, ai.geminiApiKey); } catch (e) { console.warn('[img] gen failed:', e.message); } }
    const hub = await buildHub(profile, discovered, body);
    const data = writeStoreData(catalog, { hub });
    // wire the live store to this runmoa site so /store pulls live commerce.
    // ONLY the browser-safe pub (storefront) key is persisted — never the server key.
    let liveWired = false;
    if (body.siteHost && body.storefrontKey) {
      const host = String(body.siteHost).replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
      try { fs.writeFileSync(path.join(__dirname, '.runmoa.json'), JSON.stringify({ siteHost: host, storefrontKey: body.storefrontKey }, null, 2)); liveWired = true; } catch { /* non-fatal */ }
      // bake the browser-safe pub config into a STATIC file so the generated
      // store needs no backend — deployable to any static host as-is.
      try {
        fs.writeFileSync(path.join(__dirname, 'web', 'js', 'config.js'),
          '// Generated by create-api-home — live runmoa Storefront config (pub key only, browser-safe).\n' +
          'window.RUNMOA = ' + JSON.stringify({ useApi: true, siteHost: host, storefrontKey: body.storefrontKey, limit: 48 }, null, 2) + ';\n');
      } catch { /* non-fatal */ }
    }
    // auto-publish to a permanent per-creator GitHub Pages URL (from the YT handle)
    let publish = null;
    if (body.publish !== false) {
      try { publish = await publishStore(storeSlug(profile, body)); } catch (e) { publish = { ok: false, error: e.message }; }
    }
    send(res, 200, {
      ok: true, storeUrl: '/store/', liveWired,
      publicUrl: publish && publish.url, publish,
      blueprint: catalog.blueprint, modules: catalog.modules, stats: catalog.stats,
      counts: {
        courses: catalog.courses.length, products: catalog.products.length,
        membership: catalog.membership.length, coaching: catalog.coaching.length,
        socials: hub.socials.length, blogPosts: hub.blog ? hub.blog.posts.length : 0,
        videos: hub.youtube.videos.length, shorts: hub.youtube.shorts.length,
      },
      warnings: analysisWarnings(profile),
      generatedAt: data.generatedAt,
    });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}

async function apiDeploy(req, res) {
  const body = await readBody(req);
  const { url, siteHost, storefrontKey, serverKey, status = 'publish' } = body;
  if (!url || !siteHost || !serverKey) return send(res, 400, { error: 'url, siteHost, serverKey required' });
  try {
    const { profile, insights, rec } = await getAnalysis(url);
    const blueprint = chooseBlueprint(rec, body);
    const catalog = buildCatalog(profile, insights, blueprint);
    // same Gemini enrichment as apiGenerate — deploy must push the SAME items
    // the store shows (cached copy → identical titles → checkout mapping works)
    await enrichCatalog(catalog, { profile, insights, rec }, url, {});
    const client = new RunmoaClient({ siteHost, storefrontKey, serverKey });

    // 1) validate keys by hitting the API (the "API 확인" step)
    let contentCats, productCats;
    try {
      contentCats = normalizeCategories(await client.getContentCategoriesServer());
    } catch (e) {
      return send(res, 200, { ok: false, step: 'auth', error: `키 검증 실패: ${e.message}` });
    }
    try { productCats = normalizeCategories(await client.getProductCategoriesServer()); } catch { productCats = []; }
    const contentCat = body.categoryId ? { id: body.categoryId } : contentCats[0];
    const productCat = body.productCategoryId ? { id: body.productCategoryId } : productCats[0];
    if (!contentCat) return send(res, 200, { ok: false, step: 'category', error: '콘텐츠 카테고리가 없습니다. runmoa 대시보드에서 먼저 생성하세요.' });

    const created = [], updated = [], failed = [], skipped = [];
    const img = catalog.brand.banner || catalog.brand.logo;
    // AI thumbnails: reuse files made at generate-time (or make them now), then
    // expose as ABSOLUTE URLs so runmoa can fetch+rehost them as featured_image.
    // local builder (localhost) isn't reachable by runmoa → drop to brand image.
    try { await genThumbnails(catalog, AI_CFG().geminiApiKey); } catch { /* non-fatal */ }
    const host = req.headers.host || '';
    const reachable = !!host && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(host);
    const origin = ((req.headers['x-forwarded-proto'] || 'https') + '://' + host).replace(/\/+$/, '');
    const fixThumb = (o) => { if (o && typeof o.thumbnail === 'string' && o.thumbnail.startsWith('genimg/')) o.thumbnail = reachable ? origin + '/store/' + o.thumbnail : ''; };
    (catalog.courses || []).forEach(fixThumb);
    (catalog.coaching || []).forEach(fixThumb);
    (catalog.products || []).forEach(fixThumb);
    const errText = (e) => (e.body ? (typeof e.body === 'string' ? e.body : JSON.stringify(e.body)).slice(0, 220) : e.message);

    // idempotency: load existing items → title→id maps, so a re-deploy UPDATES
    // matching titles instead of creating duplicates.
    const titleMap = (list, idKey) => {
      const m = new Map();
      for (const it of (list || [])) if (it && it.title) m.set(it.title, it[idKey] ?? it.id ?? it.ID);
      return m;
    };
    async function fetchAllPages(listFn) {
      const out = [];
      for (let page = 1; page <= 40; page++) {
        let r;
        try { r = await listFn({ limit: 50, page }); } catch { break; } // limit max is <200
        const items = r?.data || r?.contents || r?.products || (Array.isArray(r) ? r : []);
        out.push(...items);
        const pg = r?.pagination;
        if (!pg || pg.has_more_pages === false || page >= (pg.last_page || 1)) break;
      }
      return out;
    }
    let contentMap = new Map(), productMap = new Map();
    try { contentMap = titleMap(await fetchAllPages((q) => client.listServerContents(q)), 'content_id'); } catch { /* first deploy */ }
    try { productMap = titleMap(await fetchAllPages((q) => client.listServerProducts(q)), 'product_id'); } catch { /* first deploy */ }

    async function upsertContent(kind, title, payload) {
      try {
        const id = contentMap.get(title);
        if (id) {
          const { content_type, ...upd } = payload; // content_type is not updatable
          const r = await client.updateContent(id, upd);
          updated.push({ kind, id: r?.content_id ?? id, title });
        } else {
          const r = await client.createContent(payload);
          created.push({ kind, id: r?.content_id ?? r?.id ?? '?', title });
        }
      } catch (e) { failed.push({ kind, title, error: errText(e) }); }
    }
    async function upsertProduct(title, payload) {
      try {
        const id = productMap.get(title);
        if (id) { const r = await client.updateProduct(id, payload); updated.push({ kind: 'product', id: r?.product_id ?? id, title }); }
        else { const r = await client.createProduct(payload); created.push({ kind: 'product', id: r?.product_id ?? r?.id ?? '?', title }); }
      } catch (e) { failed.push({ kind: 'product', title, error: errText(e) }); }
    }

    // creation order: offline → live → products → VOD LAST, so the VOD courses
    // are the newest items and lead runmoa's newest-first listings.
    const offlineSessions = (catalog.coaching || []).filter((s) => !s.live);
    const liveSessions = (catalog.coaching || []).filter((s) => s.live);
    for (const s of offlineSessions) await upsertContent('coaching', s.title, coachingToContentPayload(s, { categoryIds: [contentCat.id], featuredImage: img, status }));
    for (const s of liveSessions) await upsertContent('live', s.title, coachingToContentPayload(s, { categoryIds: [contentCat.id], featuredImage: img, status }));
    if (productCat) {
      for (const p of catalog.products) await upsertProduct(p.title, productToProductPayload(p, { categoryId: productCat.id, featuredImage: img, status }));
    } else if (catalog.products.length) {
      skipped.push('상품: product 카테고리 없음 → 건너뜀');
    }
    for (const c of catalog.courses) await upsertContent('course', c.title, courseToContentPayload(c, { categoryIds: [contentCat.id], featuredImage: img, status }));
    if (catalog.membership.length) skipped.push('멤버십: runmoa 대시보드에서 멤버십 상품 설정 필요 (생성 API 미제공)');
    if (catalog.community) skipped.push('커뮤니티: 대시보드에서 게시판 활성화 필요');

    send(res, 200, { ok: true, siteHost, validated: true, created, updated, failed, skipped, blueprint: catalog.blueprint });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}

// ── server ────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'POST' && url === '/api/analyze') return apiAnalyze(req, res);
  if (req.method === 'POST' && url === '/api/generate') return apiGenerate(req, res);
  if (req.method === 'POST' && url === '/api/deploy') return apiDeploy(req, res);

  // which build is this host running? (Render sets RENDER_GIT_COMMIT)
  if (url === '/api/version') {
    return send(res, 200, { commit: (process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7), startedAt: STARTED_AT });
  }

  // storefront config for the live store (browser-safe pub key only)
  if (url === '/api/storefront-config') {
    try {
      const c = JSON.parse(fs.readFileSync(path.join(__dirname, '.runmoa.json'), 'utf8'));
      return send(res, 200, { useApi: !!(c.siteHost && c.storefrontKey), siteHost: c.siteHost, storefrontKey: c.storefrontKey, limit: 24 });
    } catch { return send(res, 200, { useApi: false }); }
  }

  if (url === '/' || url === '/index.html') return serveStatic(res, path.join(__dirname, 'web-builder'), 'index.html');
  if (url === '/store' || url === '/store/') return serveStatic(res, path.join(__dirname, 'web'), 'index.html');
  if (url.startsWith('/store/')) return serveStatic(res, path.join(__dirname, 'web'), url.slice('/store/'.length));
  // builder assets live at web-builder/*
  return serveStatic(res, path.join(__dirname, 'web-builder'), url.replace(/^\//, ''));
});

server.listen(PORT, () => {
  console.log(`\n  🚀 Creator Solution Builder → http://localhost:${PORT}\n     생성된 스토어 → http://localhost:${PORT}/store/\n`);
});
