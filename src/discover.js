// Discovers a creator's OTHER channels (Instagram, blog, site, socials) from
// their YouTube channel "About" page, and derives a blog RSS URL when possible.
// No API key — fetches the public About HTML and classifies external links.
import { normalizeChannelUrl } from './youtube.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// domain → { platform, label, kind } + capture handle. First match wins.
// Reserved sub-paths that are NOT a handle (avoid facebook.com/sharer etc).
const RESERVED = /^(?:share|sharer|sharing|home|watch|story|stories|reel|reels|p|tv|explore|hashtag|status|i|intent|login|signup|help|about|privacy|terms|policies|search|messages|notifications|settings|dialog|plugins|tr|profile\.php)$/i;
const PATTERNS = [
  { re: /instagram\.com\/([A-Za-z0-9_.]+)/i, platform: 'instagram', label: 'Instagram', kind: 'social' },
  { re: /(?:twitter|x)\.com\/([A-Za-z0-9_]+)/i, platform: 'x', label: 'X (Twitter)', kind: 'social' },
  { re: /threads\.(?:net|com)\/@?([A-Za-z0-9_.]+)/i, platform: 'threads', label: 'Threads', kind: 'social' },
  { re: /tiktok\.com\/@([A-Za-z0-9_.]+)/i, platform: 'tiktok', label: 'TikTok', kind: 'social' },
  { re: /facebook\.com\/([A-Za-z0-9_.]+)/i, platform: 'facebook', label: 'Facebook', kind: 'social' },
  { re: /(?:linkedin\.com\/(?:in|company)\/)([A-Za-z0-9_-]+)/i, platform: 'linkedin', label: 'LinkedIn', kind: 'social' },
  { re: /patreon\.com\/([A-Za-z0-9_-]+)/i, platform: 'patreon', label: 'Patreon', kind: 'social' },
  { re: /(?:twitch\.tv)\/([A-Za-z0-9_]+)/i, platform: 'twitch', label: 'Twitch', kind: 'social' },
  { re: /discord\.(?:gg|com\/invite)\/([A-Za-z0-9_-]+)/i, platform: 'discord', label: 'Discord', kind: 'social' },
  { re: /open\.spotify\.com\/(?:artist|show|user)\/([A-Za-z0-9]+)/i, platform: 'spotify', label: 'Spotify', kind: 'social' },
  { re: /github\.com\/([A-Za-z0-9_-]+)/i, platform: 'github', label: 'GitHub', kind: 'social' },
  { re: /(?:linktr\.ee|litlink\.me|lit\.link|linkin\.bio|bio\.link)\/([A-Za-z0-9_.]+)/i, platform: 'linkhub', label: '링크', kind: 'social' },
  // Korean creator essentials (community + newsletter) — usually in descriptions
  { re: /open\.kakao\.com\/o\/([A-Za-z0-9_-]+)/i, platform: 'kakao', label: '오픈채팅', kind: 'social' },
  { re: /(?:pf\.kakao\.com|kakao\.com\/_)([A-Za-z0-9_-]+)/i, platform: 'kakaoch', label: '카카오 채널', kind: 'social' },
  { re: /(?:subscribepage\.io|page\.stibee\.com|stib\.ee|maily\.so|([A-Za-z0-9_-]+)\.kit\.com)\/?([A-Za-z0-9_.-]*)/i, platform: 'newsletter', label: '뉴스레터', kind: 'social' },
  // blogs
  { re: /blog\.naver\.com\/([A-Za-z0-9_-]+)/i, platform: 'naverblog', label: '네이버 블로그', kind: 'blog' },
  { re: /([A-Za-z0-9_-]+)\.tistory\.com/i, platform: 'tistory', label: '티스토리', kind: 'blog' },
  { re: /brunch\.co\.kr\/@([A-Za-z0-9_-]+)/i, platform: 'brunch', label: '브런치', kind: 'blog' },
  { re: /medium\.com\/@?([A-Za-z0-9_.-]+)/i, platform: 'medium', label: 'Medium', kind: 'blog' },
  { re: /velog\.io\/@([A-Za-z0-9_-]+)/i, platform: 'velog', label: 'velog', kind: 'blog' },
  { re: /([A-Za-z0-9_-]+)\.substack\.com/i, platform: 'substack', label: 'Substack', kind: 'blog' },
  { re: /([A-Za-z0-9_-]+)\.wordpress\.com/i, platform: 'wordpress', label: 'WordPress', kind: 'blog' },
];

const INFRA = ['ytimg.com', 'ggpht.com', 'googleusercontent', 'gstatic', 'googlevideo', 'google.com', 'googleadservices', 'doubleclick', 'schema.org', 'w3.org', 'googleapis', 'fonts.', 'jsdelivr', 'cdn.', 'gmpg.org'];

function cleanUrl(u) {
  return u.split('\\')[0].split('"')[0].split('<')[0].replace(/[).,'"]+$/, '').replace(/\/$/, '');
}

// YouTube wraps external links as /redirect?...&q=<encoded>. Decode them so the
// real instagram/x/blog url is classifiable (otherwise INFRA-filtered as youtube).
function unwrapRedirect(u) {
  const m = u.match(/[?&]q=([^&]+)/);
  if (m && /youtube\.com\/redirect/i.test(u)) { try { return decodeURIComponent(m[1]); } catch { return u; } }
  return u;
}

function classify(url) {
  for (const p of PATTERNS) {
    const m = url.match(p.re);
    if (m) {
      const handle = m[1] || null;
      if (handle && RESERVED.test(handle)) return null; // facebook.com/sharer etc.
      return { platform: p.platform, label: p.label, kind: p.kind, handle, url: normalizeProtocol(url) };
    }
  }
  return null;
}
function normalizeProtocol(u) { return u.replace(/^http:\/\//i, 'https://'); }

/**
 * Extract & classify all social/blog links from any blob of text (channel
 * about, video descriptions, page HTML). Decodes YouTube redirect wrappers.
 * @returns {object[]} deduped by platform (first occurrence wins)
 */
export function extractSocials(text) {
  if (!text) return [];
  const raw = (String(text).match(/https?:\/\/[A-Za-z0-9._~:/?#@!$&%*+,;=()-]+/g) || []).map((u) => cleanUrl(unwrapRedirect(u)));
  const byPlatform = new Map();
  for (const u of raw) {
    if (INFRA.some((b) => u.includes(b))) continue;
    const hit = classify(u);
    if (hit && !byPlatform.has(hit.platform)) byPlatform.set(hit.platform, hit);
  }
  return [...byPlatform.values()];
}

/** Merge social arrays, dedupe by platform (first source wins). */
export function mergeSocials(...lists) {
  const seen = new Map();
  for (const list of lists) for (const s of (list || [])) if (s && s.platform && !seen.has(s.platform)) seen.set(s.platform, s);
  return [...seen.values()];
}

/** Derive an RSS feed URL from a blog link (best-effort by platform). */
export function blogRssFrom(link) {
  if (!link) return null;
  let m;
  if ((m = link.match(/blog\.naver\.com\/([A-Za-z0-9_-]+)/i))) return `https://rss.blog.naver.com/${m[1]}.xml`;
  if ((m = link.match(/([A-Za-z0-9_-]+)\.tistory\.com/i))) return `https://${m[1]}.tistory.com/rss`;
  if ((m = link.match(/medium\.com\/@?([A-Za-z0-9_.-]+)/i))) return `https://medium.com/feed/@${m[1].replace(/^@/, '')}`;
  if ((m = link.match(/velog\.io\/@([A-Za-z0-9_-]+)/i))) return `https://v2.velog.io/rss/@${m[1]}`;
  if ((m = link.match(/([A-Za-z0-9_-]+)\.substack\.com/i))) return `https://${m[1]}.substack.com/feed`;
  if ((m = link.match(/([A-Za-z0-9_-]+)\.wordpress\.com/i))) return `https://${m[1]}.wordpress.com/feed`;
  if ((m = link.match(/brunch\.co\.kr\/@([A-Za-z0-9_-]+)/i))) return `https://brunch.co.kr/rss/@@${m[1]}`;
  // generic: try /feed
  if (/^https?:\/\//i.test(link)) return link.replace(/\/$/, '') + '/feed';
  return null;
}

async function fetchAbout(channelUrl) {
  const base = normalizeChannelUrl(channelUrl);
  const res = await fetch(base + '/about', { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8' } });
  if (!res.ok) throw new Error(`about ${res.status}`);
  return res.text();
}

/**
 * @param {string} channelUrl
 * @returns {Promise<{socials:object[], blog:object|null, website:object|null, all:object[]}>}
 */
// ── WEB SEARCH discovery ────────────────────────────────────────────────
// Many creators' socials are NOT linked on their YouTube About page, but show
// up when you google the creator's name (instagram, threads, x, homepage…).
// We replicate that with a headless DuckDuckGo HTML query (no API key) and
// classify the result links. Handle-matched results only → avoids name clashes.
function normHandle(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

// search results often point at a post (instagram.com/p/.. , threads.com/@h/post/..);
// rebuild the clean profile-root URL so buttons link to the profile, not a post.
function canonicalSocialUrl(platform, handle, original) {
  if (!handle) return original;
  switch (platform) {
    case 'instagram': return 'https://www.instagram.com/' + handle;
    case 'x': return 'https://x.com/' + handle;
    case 'threads': return 'https://www.threads.net/@' + handle;
    case 'tiktok': return 'https://www.tiktok.com/@' + handle;
    case 'facebook': return 'https://www.facebook.com/' + handle;
    case 'linkedin': return original;
    default: return original;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// DuckDuckGo HTML endpoint. It rate-limits BURSTS (returns 202 + "anomaly", no
// uddg= links), so we query sequentially with a retry+backoff rather than firing
// many in parallel. One query per channel (cached) almost never trips it.
async function ddgSearch(query, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), {
        headers: { 'User-Agent': UA, 'Accept-Language': 'ko,en-US;q=0.8', 'Referer': 'https://duckduckgo.com/' },
        signal: AbortSignal.timeout(9000),
      });
      const html = await res.text();
      if (/uddg=/.test(html)) {
        const out = []; const re = /uddg=([^&"'\\]+)/g; let m;
        while ((m = re.exec(html))) { try { out.push(decodeURIComponent(m[1])); } catch { /* skip */ } }
        if (out.length) return out;
      }
    } catch { /* timeout/network → retry */ }
    if (i < tries - 1) await sleep(1200 + i * 900); // back off before retry
  }
  return [];
}

// SerpAPI (serpapi.com) — real Google results via official API, no bot-blocking.
// Used when a key is configured; otherwise we fall back to the DDG scraper.
async function serpSearch(query, key) {
  try {
    const res = await fetch('https://serpapi.com/search.json?engine=google&num=20&hl=ko&q=' + encodeURIComponent(query) + '&api_key=' + encodeURIComponent(key), { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return [];
    const j = await res.json();
    const out = [];
    (j.organic_results || []).forEach((r) => { if (r && r.link) out.push(r.link); });
    (j.knowledge_graph && j.knowledge_graph.profiles || []).forEach((p) => { if (p && p.link) out.push(p.link); });
    return out;
  } catch { return []; }
}

/**
 * Find a creator's socials + homepage by searching the web for their name.
 * @param {string} name channel display name
 * @param {string} handle channel @handle (used to verify ownership)
 * @param {{serpApiKey?:string}} [opts] when serpApiKey present → SerpAPI (reliable); else DDG scrape
 * @returns {Promise<{socials:object[], blog:object|null, website:object|null}>}
 */
export async function webSearchSocials(name, handle, opts = {}) {
  const nm = String(name || '').trim();
  const h = normHandle(handle);
  if (!nm && !h) return { socials: [], blog: null, website: null };
  const bare = handle ? String(handle).replace(/^@/, '') : '';
  // simple, high-recall queries (quoted/keyword-stuffed queries return 0 on Google).
  // handle query → socials; plain name → homepage/blog.
  const queries = [
    (bare || nm) + ' instagram threads x.com',
    nm || bare,
  ].filter((q, i, a) => q && q.trim() && a.indexOf(q) === i);
  const key = opts.serpApiKey;
  const search = key ? (q) => serpSearch(q, key) : (q) => ddgSearch(q);
  // sequential (DDG burst-block safe); stop early once we have enough signal
  const urls = [];
  for (const q of queries) {
    const r = await search(q);
    for (const u of r) urls.push(cleanUrl(unwrapRedirect(u)));
    if (urls.length >= 12) break;
  }

  const byPlatform = new Map();
  const siteCandidates = [];
  for (const u of urls) {
    if (INFRA.some((b) => u.includes(b))) continue;
    const hit = classify(u);
    if (hit) {
      // only trust a social/blog hit whose handle matches the channel handle
      const hh = normHandle(hit.handle);
      const ok = h && hh && (hh === h || hh.includes(h) || h.includes(hh));
      if (ok && !byPlatform.has(hit.platform)) byPlatform.set(hit.platform, { ...hit, url: canonicalSocialUrl(hit.platform, hit.handle, hit.url), source: 'search' });
      continue;
    }
    // homepage candidate: a non-platform domain whose name contains the handle
    if (h && h.length >= 4) {
      const dom = ((u.match(/^https?:\/\/([^/?#]+)/) || [])[1] || '').replace(/^www\./, '');
      const reg = (dom.split('.')[0] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (reg.length >= 4 && (reg.includes(h) || h.includes(reg))) siteCandidates.push(u);
    }
  }
  // pick the cleanest homepage (shortest = closest to the root domain)
  let website = null;
  if (siteCandidates.length) {
    const best = siteCandidates.sort((a, b) => a.length - b.length)[0];
    const root = (best.match(/^(https?:\/\/[^/?#]+)/) || [])[1] || best;
    website = { platform: 'website', label: '홈페이지', kind: 'social', handle: null, url: root, source: 'search' };
  }
  const all = [...byPlatform.values()];
  const blog = all.find((l) => l.kind === 'blog') || null;
  if (blog) blog.rssUrl = blogRssFrom(blog.url);
  let socials = all.filter((l) => l.kind === 'social');
  socials = withInferredThreads(socials);
  return { socials, blog, website };
}

// Threads accounts share the exact Instagram handle (same Meta login). So if we
// found an Instagram but no Threads, the Threads URL is certain — add it.
export function withInferredThreads(socials) {
  const ig = socials.find((s) => s.platform === 'instagram');
  if (ig && ig.handle && !socials.some((s) => s.platform === 'threads')) {
    socials = socials.concat([{ platform: 'threads', label: 'Threads', kind: 'social', handle: ig.handle, url: 'https://www.threads.net/@' + ig.handle, source: 'inferred' }]);
  }
  return socials;
}

export async function discoverLinks(channelUrl) {
  let html = '';
  try { html = await fetchAbout(channelUrl); } catch (e) { return { socials: [], blog: null, website: null, all: [], error: e.message }; }
  const all = extractSocials(html);
  const socials = all.filter((l) => l.kind === 'social');
  const blog = all.find((l) => l.kind === 'blog') || null;
  if (blog) blog.rssUrl = blogRssFrom(blog.url);
  return { socials, blog, website: null, all };
}
