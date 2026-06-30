// Maps a normalized YouTube item into a runmoa content-creation payload.
// runmoa POST /contents required fields: content_type, title, description_html,
// category_ids, featured_image. (See https://api-docs.runmoa.ai/server/contents/)
import { escapeHtml, fmtDate, fmtDuration, fmtCount, truncate } from './util.js';

/** Build the rich HTML body shown on the content detail page. */
function buildDescriptionHtml(item, { channelName } = {}) {
  const parts = [];

  // Responsive YouTube embed.
  if (item.id) {
    parts.push(
      `<div style="position:relative;padding-top:56.25%;margin:0 0 16px">` +
        `<iframe src="https://www.youtube.com/embed/${escapeHtml(item.id)}" ` +
        `style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px" ` +
        `title="${escapeHtml(item.title)}" frameborder="0" ` +
        `allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" ` +
        `allowfullscreen></iframe></div>`
    );
  }

  // Meta line (date · duration · views).
  const meta = [];
  if (item.uploadDate) meta.push(`업로드 ${escapeHtml(item.uploadDate)}`);
  if (item.duration) meta.push(`재생시간 ${escapeHtml(fmtDuration(item.duration))}`);
  if (item.views != null) meta.push(`조회수 ${escapeHtml(fmtCount(item.views))}회`);
  if (meta.length) parts.push(`<p style="color:#888;font-size:14px">${meta.join(' · ')}</p>`);

  // Original description, with line breaks preserved and links made clickable.
  if (item.description) {
    const safe = escapeHtml(item.description)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br>');
    parts.push(`<div style="white-space:normal;line-height:1.7">${safe}</div>`);
  }

  // Source link.
  if (item.url) {
    parts.push(
      `<p style="margin-top:16px"><a href="${escapeHtml(item.url)}" target="_blank" ` +
        `rel="noopener">▶ YouTube에서 보기${channelName ? ' · ' + escapeHtml(channelName) : ''}</a></p>`
    );
  }
  return parts.join('\n');
}

/**
 * Map one video/short to a runmoa content payload.
 * @param {object} item normalized youtube item
 * @param {object} opts { categoryIds:number[], tagIds?:number[], status?, channelName?, kind? }
 */
export function itemToContent(item, opts = {}) {
  const { categoryIds, tagIds, status = 'pending', channelName, kind = 'video' } = opts;
  const payload = {
    content_type: 'vod',
    title: truncate(item.title || 'Untitled', 120),
    description_html: buildDescriptionHtml(item, { channelName }),
    category_ids: categoryIds,
    featured_image: item.thumbnail,
    status,
    thumbnail_link: item.url || undefined,
  };
  if (Array.isArray(tagIds) && tagIds.length) payload.tag_ids = tagIds.slice(0, 1); // 1 tag max
  // carry a private hint for our own frontend fallback (ignored by the API)
  payload._meta = {
    kind,
    youtubeId: item.id,
    url: item.url,
    views: item.views,
    duration: item.duration,
    uploadDate: item.uploadDate,
  };
  return payload;
}

/** Map a whole profile → ordered list of payloads (videos first, then shorts). */
export function profileToContents(profile, opts = {}) {
  const channelName = profile.channel?.name;
  const videos = (profile.videos || []).map((v) =>
    itemToContent(v, { ...opts, channelName, kind: 'video' })
  );
  const shorts = (profile.shorts || []).map((s) =>
    itemToContent(s, { ...opts, channelName, kind: 'short' })
  );
  return [...videos, ...shorts];
}

/**
 * A suggested site/branding config for the runmoa dashboard + the homepage
 * frontend. (Site branding is not creatable via the API, so we surface it.)
 */
export function profileToSiteConfig(profile, insights) {
  const ch = profile.channel || {};
  return {
    name: ch.name,
    tagline: insights?.tagline || ch.description?.split('\n')[0] || '',
    about: ch.description || '',
    avatar: ch.avatar,
    banner: ch.banner,
    youtube: ch.url,
    subscribers: ch.subscribers,
    topics: insights?.topics || [],
    stats: insights?.stats || {},
    updatedAt: fmtDate(new Date().toISOString().slice(0, 10).replace(/-/g, '')) || null,
  };
}

// ── commerce payloads (강의 → content, 일반상품 → product) ─────────────

/** Rich HTML body for a course content page (curriculum + preview + intro). */
function buildCourseHtml(course) {
  const p = [];
  if (course.preview) {
    p.push(
      `<div style="position:relative;padding-top:56.25%;margin:0 0 16px">` +
        `<iframe src="https://www.youtube.com/embed/${escapeHtml(course.preview)}" ` +
        `style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px" ` +
        `title="${escapeHtml(course.title)}" allowfullscreen></iframe></div>`
    );
  }
  const meta = [];
  if (course.level) meta.push(`난이도 ${escapeHtml(course.level)}`);
  if (course.lessons) meta.push(`${course.lessons}개 레슨`);
  if (course.durationSec) meta.push(`총 ${escapeHtml(fmtDuration(course.durationSec))}`);
  if (meta.length) p.push(`<p style="color:#667">${meta.join(' · ')}</p>`);
  if (course.description) {
    p.push(
      `<div style="white-space:normal;line-height:1.7">${escapeHtml(course.description).replace(/\n/g, '<br>')}</div>`
    );
  }
  return p.join('\n');
}

/** extract a youtube video id from an i.ytimg thumbnail URL (for media_url). */
function ytIdFromThumb(url) {
  const m = /\/vi\/([A-Za-z0-9_-]{6,})\//.exec(url || '');
  return m ? m[1] : null;
}

/** 강의 → runmoa POST /contents (vod). The live API requires exactly ONE option
 * (base_price + download_limit_days ≤ 365) and ≥1 chapter, each chapter holding
 * ≥1 item with media_url + duration_text. */
export function courseToContentPayload(course, { categoryIds, featuredImage, status = 'publish' } = {}) {
  const vid = course.youtubeId || ytIdFromThumb(course.thumbnail) || course.preview;
  const mediaUrl = vid ? `https://www.youtube.com/watch?v=${vid}` : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const lessons = (course.curriculum && course.curriculum.length)
    ? course.curriculum
    : Array.from({ length: course.lessons || 4 }, (_, i) => ({ t: `${i + 1}강`, d: '10분' }));
  const items = lessons.map((l) => ({
    title: truncate(l.t || '레슨', 120),
    media_url: mediaUrl,
    duration_text: String(l.d || '10분'),
  }));
  return {
    content_type: 'vod',
    title: truncate(course.title, 120),
    description_html: buildCourseHtml(course),
    category_ids: categoryIds,
    // content create REQUIRES a valid featured_image; course thumbnails can be
    // missing (more designed courses than channel video thumbnails) → 422. Fall
    // back to the brand banner/logo so VOD content always creates.
    featured_image: course.thumbnail || featuredImage,
    status,
    options: [{
      title: '전체 강의 수강',
      base_price: course.price.base,
      sale_price: course.price.sale ?? course.price.base,
      download_limit_days: 365,
    }],
    chapters: [{ title: '강의 커리큘럼', items }],
  };
}

/** 코칭/클래스 → runmoa POST /contents (offline) body, with schedule/location. */
export function coachingToContentPayload(session, { categoryIds, featuredImage, status = 'publish' } = {}) {
  // offline option requires: base_price, sale_price(≤base_price), start_at,
  // end_at, location_text. (earlier used price/duration_* → 422)
  const base = session.price.base;
  const sale = (session.price.sale != null && session.price.sale <= base) ? session.price.sale : base;
  return {
    content_type: 'offline',
    title: truncate(session.title, 120),
    description_html: `<div style="line-height:1.7">${escapeHtml(session.description)}</div>` +
      `<p style="color:#667">진행 방식: ${escapeHtml(session.mode)} · 정원 ${session.seats}명 · ${escapeHtml(session.schedule)}</p>`,
    category_ids: categoryIds,
    featured_image: session.thumbnail || featuredImage || null,
    status,
    options: [{
      title: truncate(session.schedule || '세션 예약', 120),
      base_price: base,
      sale_price: sale,
      start_at: '2026-07-01 14:00:00',
      end_at: '2026-07-01 16:00:00',
      location_text: session.mode || '온라인',
    }],
  };
}

/** 일반상품 → runmoa POST /products body. */
export function productToProductPayload(product, { categoryId, featuredImage, status = 'publish' } = {}) {
  const body = {
    title: truncate(product.title, 120),
    category_id: categoryId,
    // prefer the product's own (AI-generated) thumbnail; fall back to brand image
    featured_image: product.thumbnail || featuredImage || null,
    description_html: `<div style="line-height:1.7">${escapeHtml(product.description)}</div>`,
    status,
    base_price: product.price.base,
    sale_price: product.price.sale ?? undefined,
    is_on_sale: Boolean(product.price.onSale),
    requires_shipping: Boolean(product.requiresShipping),
    no_option_stock: 9999, // simple (no-option) products need stock to be orderable
  };
  if (product.requiresShipping) body.shipping_price = 3000;
  // NOTE: we intentionally do NOT send `options` — the API requires matching
  // `variants` when options_count > 0, and our "수량" option is a cart concern,
  // not a real product variant. Simple products avoid the 422.
  return body;
}
