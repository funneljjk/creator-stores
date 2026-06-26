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
    // strip a trailing tab (/videos, /shorts, /featured, /about ...)
    return s.replace(/\/(videos|shorts|streams|featured|about|community|playlists)\/?$/i, '');
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

function mapVideoEntry(e) {
  if (!e) return null;
  const id = e.id;
  // hqdefault (480×360, ~30KB, always exists) instead of maxres (1280px, ~200KB):
  // cards render ≤560px, so maxres was 5-10× over-fetch and the main feed-load lag.
  const thumb =
    (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null) ||
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

async function fetchTab(baseUrl, tab, { limit, flat }) {
  const args = ['-J', '--no-warnings', '--playlist-end', String(limit)];
  if (flat) args.push('--flat-playlist');
  args.push(`${baseUrl}/${tab}`);
  try {
    const d = await ytdlpJSON(args, { timeoutMs: 180000 });
    const entries = (d.entries || []).filter(Boolean);
    return entries.map(mapVideoEntry).filter((v) => v && v.id);
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

// full metadata for ONE video (description + view/like/comment counts)
async function fetchOneVideo(id) {
  try {
    const d = await ytdlpJSON(['-J', '--no-warnings', `https://www.youtube.com/watch?v=${id}`], { timeoutMs: 60000 });
    return mapVideoEntry(d);
  } catch (e) {
    log.warn(`video ${id} extract failed: ${e.message.split('\n')[0]}`);
    return null;
  }
}

// Top-N videos WITH full metadata, fetched in PARALLEL. yt-dlp's own playlist
// full-extract is sequential (~2.4s/video → 24s for 10). Flat-listing the ids
// first (1s) then extracting each concurrently cuts this to ~5s — no data loss.
async function fetchVideosFull(baseUrl, limit) {
  const flat = await fetchTab(baseUrl, 'videos', { limit, flat: true });
  const ids = flat.map((v) => v.id).filter(Boolean).slice(0, limit);
  if (!ids.length) return [];
  const out = await mapLimit(ids, 8, fetchOneVideo);
  return out.filter((v) => v && v.id);
}

/**
 * Analyze a channel.
 * @param {string} input channel url / handle
 * @param {{limitVideos?:number, limitShorts?:number}} opts
 * @returns {Promise<{channel:object, videos:object[], shorts:object[], analyzedAt:string}>}
 */
export async function analyzeChannel(input, opts = {}) {
  const { limitVideos = 10, limitShorts = 12 } = opts;
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

  // Videos need full extraction (descriptions) for analysis; shorts + the long
  // feed use flat extraction (fast → many items for a continuous feed).
  // Feed = flat thumbnails (fast, many). But archetype classification needs a
  // few real descriptions, so we still full-extract the top N IN PARALLEL (for
  // the brain only — the feed itself never shows likes/comments/description).
  const { feedVideos: feedLimit = 60 } = opts;
  log.step(`Fetching ${limitVideos} videos (analysis) + ${limitShorts} shorts + ${feedLimit} feed thumbnails…`);
  const [videos, shorts, feedVideos] = await Promise.all([
    fetchVideosFull(baseUrl, limitVideos),
    fetchTab(baseUrl, 'shorts', { limit: limitShorts, flat: true }),
    fetchTab(baseUrl, 'videos', { limit: feedLimit, flat: true }),
  ]);
  log.ok(`${videos.length} analysis videos, ${shorts.length} shorts, ${feedVideos.length} feed thumbnails`);

  return {
    channel,
    videos,
    shorts,
    feedVideos,
    analyzedAt: new Date().toISOString(),
    source: baseUrl,
  };
}
