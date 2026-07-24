// Fetches + parses a blog RSS/Atom feed into normalized posts. No XML lib —
// dependency-free regex parsing (handles RSS <item> and Atom <entry>).
const UA = 'Mozilla/5.0 (compatible; CreatorHubBuilder/1.0; +https://runmoa.ai)';

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
function attr(block, name, a) {
  const m = block.match(new RegExp(`<${name}\\b[^>]*\\b${a}=["']([^"']+)["']`, 'i'));
  return m ? m[1] : '';
}
function unwrap(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .trim();
}
function stripHtml(s) {
  return unwrap(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}
function firstImg(html) {
  const m = unwrap(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}
function isoDate(s) {
  s = unwrap(s);
  if (!s) return null;
  const t = Date.parse(s);
  return isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function parseItems(xml, limit) {
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks = isAtom
    ? (xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [])
    : (xml.match(/<item\b[\s\S]*?<\/item>/gi) || []);
  const posts = [];
  for (const b of blocks.slice(0, limit)) {
    const title = stripHtml(tag(b, 'title'));
    let link = '';
    if (isAtom) {
      link = attr(b, 'link', 'href') || unwrap(tag(b, 'id'));
    } else {
      link = unwrap(tag(b, 'link')) || attr(b, 'link', 'href');
    }
    const rawBody = tag(b, 'content:encoded') || tag(b, 'content') || tag(b, 'description') || tag(b, 'summary');
    const date = isoDate(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    const thumb =
      attr(b, 'media:thumbnail', 'url') || attr(b, 'media:content', 'url') ||
      attr(b, 'enclosure', 'url') || firstImg(rawBody);
    if (!title && !link) continue;
    posts.push({ title: title || '(제목 없음)', link: link.trim(), date, summary: stripHtml(rawBody).slice(0, 160), thumbnail: thumb });
  }
  return posts;
}

/**
 * @param {string} rssUrl
 * @param {number} [limit=6]
 * @returns {Promise<{posts:object[], error?:string}>}
 */
export async function fetchFeed(rssUrl, limit = 6) {
  if (!rssUrl) return { posts: [] };
  try {
    // signal 필수: 응답 없는 블로그 RSS 서버가 대량 작업을 42시간 hang시킨 전례
    const res = await fetch(rssUrl, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { posts: [], error: `feed ${res.status}` };
    const xml = await res.text();
    return { posts: parseItems(xml, limit) };
  } catch (e) {
    return { posts: [], error: e.message };
  }
}
