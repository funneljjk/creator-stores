// Parses Instagram / X(Twitter) post URLs into embeddable feed items.
// (IG/X have no open content API, so the creator supplies post URLs and we
//  embed them via the official iframe endpoints — no API key needed.)

/** @param {string} url  a post/reel/tweet URL */
export function parseEmbed(url) {
  if (!url) return null;
  const u = String(url).trim();
  let m;
  // Instagram post or reel
  if ((m = u.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i))) {
    return {
      kind: 'embed', source: 'instagram', id: m[1], url: u,
      embedUrl: `https://www.instagram.com/p/${m[1]}/embed/`,
    };
  }
  // X / Twitter status
  if ((m = u.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i))) {
    return {
      kind: 'embed', source: 'x', id: m[1], url: u,
      embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=light&dnt=true`,
    };
  }
  // TikTok video
  if ((m = u.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i))) {
    return {
      kind: 'embed', source: 'tiktok', id: m[1], url: u,
      embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`,
    };
  }
  return null;
}

/** Parse an array (or newline/comma string) of URLs into embed items. */
export function parseEmbeds(input) {
  if (!input) return [];
  const list = Array.isArray(input) ? input : String(input).split(/[\n,]+/);
  return list.map((u) => parseEmbed(u)).filter(Boolean);
}
