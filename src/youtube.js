// YouTube channel analyzer. Uses the yt-dlp CLI so it works with no API key.
// Produces a normalized ChannelProfile: { channel, videos[], shorts[] }.
import { ytdlpJSON, pickThumb, fmtDate, hasBinary, log, color } from './util.js';

/**
 * Normalize any channel reference to the canonical youtube.com base URL.
 * Accepts: @handle, full @handle URL, /channel/UC..., /c/..., bare handle.
 */
export function normalizeChannelUrl(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('No channel URL/handle provided');
  if (/^https?:\/\//i.test(s)) {
    // strip trailing slash(es) FIRST, then a trailing tab (/videos, /shorts …),
    // then any leftover slash. A stray trailing slash makes fetchTab build
    // `…//videos`, and yt-dlp treats that double-slash as the channel ROOT →
    // returns the Videos/Live/Shorts TAB list (channel-id pseudo-entries)
    // instead of real videos, which then leak into the feed as broken cards.
    return s
      .replace(/\/+$/, '')
      .replace(/\/(videos|shorts|streams|featured|about|community|playlists)$/i, '')
      .replace(/\/+$/, '');
  }
  if (s.startsWith('@')) return `https://www.youtube.com/${s}`;
  if (/^UC[A-Za-z0-9_-]{22}$/.test(s)) return `https://www.youtube.com/channel/${s}`;
  return `https://www.youtube.com/@${s.replace(/^@/, '')}`;
}

async function fetchChannelMeta(baseUrl) {
  // --playlist-items 0 → channel-level metadata only, no entries (fast).
  const d = await ytdlpJSON([
    '-J',
    '--playlist-items', '0',
    '--no-warnings',
    baseUrl,
  ]);
  return {
    channelId: d.channel_id || d.id || null,
    name: d.channel || d.title || d.uploader || 'Channel',
    handle: d.uploader_id || d.channel_id || null,
    url: d.channel_url || d.uploader_url || baseUrl,
    description: (d.description || '').trim(),
    subscribers: d.channel_follower_count ?? null,
    avatar: pickThumb(d.thumbnails, 'avatar'),
    banner: pickThumb(d.thumbnails, 'banner'),
    tags: d.tags || [],
  };
}

// A YouTube video id is exactly 11 url-safe chars. Channel ids are 24 chars
// starting with `UC`. Filtering entries by this drops the channel-tab pseudo-
// entries (Videos/Live/Shorts, whose id === the channel id) that yt-dlp returns
// when a channel ROOT is extracted — the source of the broken feed/short cards.
export const isVideoId = (id) => /^[A-Za-z0-9_-]{11}$/.test(String(id || ''));

function mapVideoEntry(e) {
  if (!e) return null;
  const id = e.id;
  if (!isVideoId(id)) return null; // reject channel-tab / playlist pseudo-entries
  // sddefault (640×480, always exists) — sharper than hqdefault(480) in the feed
  // cards without the 5-10× over-fetch of maxres(1280). Good sharpness/load balance.
  const thumb =
    (id ? `https://i.ytimg.com/vi/${id}/sddefault.jpg` : null) ||
    pickThumb(e.thumbnails, 'best');
  return {
    id,
    title: (e.title || '').trim(),
    url: e.webpage_url || (id ? `https://www.youtube.com/watch?v=${id}` : null),
    description: (e.description || '').trim(),
    duration: e.duration ?? null,
    views: e.view_count ?? null,
    likes: e.like_count ?? null,
    comments: e.comment_count ?? null,
    uploadDate: fmtDate(e.upload_date),
    timestamp: e.timestamp ?? null,
    thumbnail: thumb,
  };
}

async function fetchTab(baseUrl, tab, { limit, flat } = {}) {
  const base = String(baseUrl).replace(/\/+$/, ''); // no trailing slash → no `//tab`
  const args = ['-J', '--no-warnings'];
  if (limit) args.push('--playlist-end', String(limit)); // omit → list the whole tab
  if (flat) args.push('--flat-playlist');
  args.push(`${base}/${tab}`);
  try {
    const d = await ytdlpJSON(args, { timeoutMs: 180000 });
    const entries = (d.entries || []).filter(Boolean);
    return entries.map(mapVideoEntry).filter((v) => v && isVideoId(v.id));
  } catch (e) {
    log.warn(`'${tab}' tab unavailable: ${e.message.split('\n')[0]}`);
    return [];
  }
}

// run fn over items with bounded concurrency
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// full metadata for ONE video (description + view/like/comment counts).
// `clients` limits the player_client fallback — on a slow host the default 5-way
// fallback multiplies the per-call timeout (5 × 60s) per video, so we pass a
// single client for deep extraction (the flat listing already proved the host
// isn't bot-walled).
async function fetchOneVideo(id, clients, timeoutMs = 60000) {
  try {
    const d = await ytdlpJSON(['-J', '--no-warnings', `https://www.youtube.com/watch?v=${id}`], { timeoutMs, clients });
    return mapVideoEntry(d);
  } catch (e) {
    log.warn(`video ${id} extract failed: ${e.message.split('\n')[0]}`);
    return null;
  }
}

/**
 * Analyze a channel.
 * @param {string} input channel url / handle
 * @param {{limitVideos?:number, limitShorts?:number, feedVideos?:number}} opts
 * @returns {Promise<{channel:object, videos:object[], shorts:object[], feedVideos:object[], analyzedAt:string}>}
 */
export async function analyzeChannel(input, opts = {}) {
  const { limitVideos = 10, limitShorts = 12, feedVideos: feedLimit = 60 } = opts;
  // Constrained hosts (Render free tier = 512MB) OOM (→502) when several
  // yt-dlp processes run at once. Detect and throttle: fewer parallel spawns,
  // sequential tab listing, lower flat ceiling. Local/beefy hosts stay fast.
  const LOW_MEM = !!(process.env.RENDER || process.env.LOW_MEM);
  // low-mem/0.1-vCPU (Render free): cap flat enumeration low (fewer continuation
  // pages = faster; totals past the cap show "N+"), and keep deep-extract cheap
  // (it's usually bot-walled on datacenter IPs anyway → 0, so don't burn time).
  const FLAT_CAP = LOW_MEM ? 300 : 2000;
  const DEEP_CONC = LOW_MEM ? 3 : 6;
  const DEEP_TIMEOUT = LOW_MEM ? 25000 : 60000;
  if (!(await hasBinary('yt-dlp'))) {
    throw new Error(
      "yt-dlp not found. Install it: 'brew install yt-dlp' or 'pip install yt-dlp'."
    );
  }
  const baseUrl = normalizeChannelUrl(input);
  log.step(`Analyzing channel ${color.bold(baseUrl)}`);

  const channel = await fetchChannelMeta(baseUrl);
  log.ok(
    `${color.bold(channel.name)}  ·  ${channel.subscribers ?? '?'} subscribers  ·  ${channel.channelId}`
  );

  // Flat-list the FULL videos + shorts tabs (cheap — ids/titles only, ~1s per
  // ~100 items) so we know the channel's TRUE scale (e.g. 76 longform + 772
  // shorts), NOT just how many we sampled. Reporting "10 videos" for an
  // 848-video channel was the bug. Deep metadata (descriptions/stats) is then
  // extracted only for the recent top-N longform — the archetype brain needs a
  // few real descriptions; the feed only needs thumbnails.
  log.step(`Listing all videos + shorts (flat) · deep-extracting ${limitVideos} recent…${LOW_MEM ? ' [low-mem]' : ''}`);
  // low-mem: list tabs sequentially (1 yt-dlp at a time); otherwise in parallel.
  let videosFlat, shortsFlat;
  if (LOW_MEM) {
    videosFlat = await fetchTab(baseUrl, 'videos', { limit: FLAT_CAP, flat: true });
    shortsFlat = await fetchTab(baseUrl, 'shorts', { limit: FLAT_CAP, flat: true });
  } else {
    [videosFlat, shortsFlat] = await Promise.all([
      fetchTab(baseUrl, 'videos', { limit: FLAT_CAP, flat: true }),
      fetchTab(baseUrl, 'shorts', { limit: FLAT_CAP, flat: true }),
    ]);
  }
  channel.totalVideos = videosFlat.length;
  channel.totalShorts = shortsFlat.length;
  channel.totalsCapped = videosFlat.length >= FLAT_CAP || shortsFlat.length >= FLAT_CAP;

  // deep extraction (full per-video yt-dlp) is the heaviest step on a 0.1-vCPU
  // host — each call ~6× slower than local. Fewer deep videos on low-mem keeps
  // the whole analysis under the request timeout; 5 real descriptions are
  // plenty for archetype/copy grounding.
  const deepN = LOW_MEM ? Math.min(limitVideos, 3) : limitVideos;
  const topIds = videosFlat.map((v) => v.id).filter(Boolean).slice(0, deepN);
  // low-mem/slow host: single player_client + short timeout so a slow (or
  // bot-walled) full-extract fails fast instead of a 5×60s/video pile-up.
  const deepClients = LOW_MEM ? ['default'] : undefined;
  let videos = (await mapLimit(topIds, DEEP_CONC, (id) => fetchOneVideo(id, deepClients, DEEP_TIMEOUT))).filter((v) => v && v.id);
  // deep extraction bot-walled (datacenter IP) → 0. Fall back to flat entries
  // (title-only, no description/stats) so the archetype/insight brain still
  // classifies off real video titles instead of nothing (was mislabeling the
  // channel, e.g. career → 코칭·피트니스).
  if (!videos.length && videosFlat.length) videos = videosFlat.slice(0, limitVideos);
  const shorts = shortsFlat.slice(0, limitShorts);
  const feedVideos = videosFlat.slice(0, feedLimit);
  log.ok(`channel has ${channel.totalVideos} videos + ${channel.totalShorts} shorts · deep-analyzed ${videos.length}, feed ${feedVideos.length}`);

  return {
    channel,
    videos,
    shorts,
    feedVideos,
    analyzedAt: new Date().toISOString(),
    source: baseUrl,
  };
}
