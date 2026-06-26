// All view renderers. Each returns { html, mount? }. router.js mounts them.
// Module-aware: sections/nav adapt to the generated blueprint (courses, store,
// membership, coaching, community).
window.Views = (function () {
  var F = window.F, C = window.C, Store = window.Store;
  var won = F.won, esc = F.esc, count = F.count;

  function grid(items, fn, cls) { return '<div class="grid ' + (cls || '') + '">' + items.map(fn).join('') + '</div>'; }
  function nav(h) { location.hash = h; }
  function has(d, m) { return (d.modules || []).indexOf(m) >= 0 && sized(d, m); }
  function sized(d, m) {
    if (m === 'courses') return (d.courses || []).length;
    if (m === 'digital' || m === 'merch') return (d.products || []).length;
    if (m === 'membership') return (d.membership || []).length;
    if (m === 'coaching') return (d.coaching || []).length;
    if (m === 'community') return !!d.community;
    return true;
  }

  // ── shared buy wiring (membership / coaching) ───────────
  function wireBuy(root, d) {
    root.querySelectorAll('[data-sub]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = d.membership.find(function (x) { return x.id === btn.dataset.sub; });
        Store.add({ id: m.id, kind: 'membership', title: m.name + ' 멤버십', icon: '💎', cover: 5, price: m.price, base: m.price, optLabel: '월 구독' });
        App.toast('구독을 담았어요', '멤버십');
      });
    });
    root.querySelectorAll('[data-book]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = d.coaching.find(function (x) { return x.id === btn.dataset.book; });
        Store.add({ id: s.id, kind: 'coaching', title: s.title, icon: s.icon, cover: s.cover, price: F.payNow(s.price), base: s.price.base, optLabel: s.schedule });
        App.toast('예약을 담았어요', '클래스');
      });
    });
  }

  function planCard(p) {
    return '<div class="plan' + (p.popular ? ' plan--pop' : '') + '">' +
      (p.popular ? '<div class="plan__badge">가장 인기</div>' : '') +
      '<div class="plan__name">' + esc(p.name) + '</div>' +
      '<div class="plan__price">' + won(p.price) + '<span>/' + esc(p.period) + '</span></div>' +
      '<ul class="plan__perks">' + p.perks.map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ul>' +
      '<button class="btn ' + (p.popular ? 'btn--brand' : 'btn--ghost') + ' btn--block" data-sub="' + p.id + '">구독하기</button>' +
    '</div>';
  }
  function coachCard(s) {
    return '<div class="ccard"><div class="ccard__thumb pcover g' + (s.cover || 0) + '">' +
        '<div class="pcover__ico">' + (s.icon || '🗓️') + '</div></div>' +
      '<div class="ccard__body"><div class="ccard__cat">' + esc(s.mode) + ' · 정원 ' + s.seats + '명</div>' +
        '<div class="ccard__title" role="heading" aria-level="3">' + esc(s.title) + '</div>' +
        '<div class="ccard__inst">🗓️ ' + esc(s.schedule) + '</div>' +
        '<div class="ccard__foot" style="justify-content:space-between;width:100%">' + C.priceHtml(s.price) +
          '<button class="btn btn--brand btn--sm" data-book="' + s.id + '">예약하기</button></div>' +
      '</div></div>';
  }

  // ── creator-hub builders (socials / youtube / insta / blog) ──
  // real brand SVG marks (monochrome, inherit color via currentColor)
  var ICON_PEN = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
  var ICON_LINK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
  var SOCIAL_ICON = {
    youtube: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.3"/><circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-7-6.1 7H1.6l8.2-9.3L1 2h7l4.8 6.4L18.9 2zm-2.4 18h1.9L7.6 4H5.6l10.9 16z"/></svg>',
    threads: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M16.7 11.1c-.1 0-.18-.07-.28-.1-.17-3.2-1.92-5-4.85-5-1.77 0-3.26.78-4.17 2.18l1.63 1.12c.68-1.03 1.74-1.25 2.55-1.25 1.6 0 2.43.92 2.55 2.36-.7-.12-1.46-.16-2.27-.1-2.27.13-3.73 1.45-3.63 3.3.05.93.5 1.73 1.3 2.26.66.44 1.52.65 2.42.6 1.18-.06 2.1-.5 2.75-1.32.5-.62.8-1.4.95-2.4.6.36 1.04.85 1.3 1.43.42 1 .45 2.62-.88 3.95-1.16 1.16-2.55 1.66-4.66 1.68-2.34-.02-4.1-.77-5.25-2.22C5.1 16.2 4.54 14.27 4.5 12c.03-2.27.6-4.2 1.67-5.55C7.32 5 9.08 4.25 11.4 4.23c2.34.02 4.13.78 5.32 2.24.58.72 1.02 1.62 1.3 2.68l1.9-.5c-.34-1.3-.9-2.43-1.66-3.36C16.7 3.37 14.4 2.36 11.4 2.34h-.01C8.42 2.36 6.12 3.38 4.6 5.32 3.24 7.04 2.55 9.34 2.52 12v.01c.03 2.66.72 4.96 2.08 6.68 1.52 1.94 3.82 2.96 6.8 2.98 2.65-.02 4.52-.72 6.06-2.26 2.02-2.02 1.96-4.55 1.3-6.1-.48-1.12-1.4-2.03-2.06-2.21z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M16.5 5.8a4.8 4.8 0 0 1-1-.1v6.9a5.6 5.6 0 1 1-5.6-5.6c.2 0 .4 0 .6.05v2.8a2.8 2.8 0 1 0 2 2.7V2h2.7a4.8 4.8 0 0 0 4.1 4.2v2.6a7.3 7.3 0 0 1-2.8-.6V5.8z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7v-3.5h3.1V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.25 2.7.25v3h-1.5c-1.5 0-2 .92-2 1.9v2.2h3.3l-.53 3.5h-2.8v8.4A12 12 0 0 0 24 12z"/></svg>',
    github: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.26.8-.58l-.01-2c-3.34.72-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.1-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.8 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.3.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.17.77.84 1.23 1.92 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22l-.01 3.29c0 .32.22.69.82.57A12 12 0 0 0 12 .5z"/></svg>',
    linkhub: ICON_LINK,
    naverblog: ICON_PEN, tistory: ICON_PEN, brunch: ICON_PEN, medium: ICON_PEN, velog: ICON_PEN, wordpress: ICON_PEN, substack: ICON_PEN, blog: ICON_PEN,
  };
  function socialBar(d) {
    var list = [];
    if (d.brand.youtube) list.push({ platform: 'youtube', label: 'YouTube', url: d.brand.youtube });
    ((d.hub && d.hub.socials) || []).forEach(function (s) { if (s.platform !== 'youtube') list.push(s); });
    if (d.hub && d.hub.blog && !list.some(function (x) { return x.kind === 'blog'; })) list.push({ platform: d.hub.blog.platform, label: d.hub.blog.label, url: d.hub.blog.url });
    if (!list.length) return '';
    return '<div class="socialbar">' + list.map(function (s) {
      return '<a class="sbtn sbtn--' + esc(s.platform) + '" href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' + esc(s.label) + '"><span class="sbtn__i">' + (SOCIAL_ICON[s.platform] || ICON_LINK) + '</span><span class="sbtn__l">' + esc(s.label) + '</span></a>';
    }).join('') + '</div>';
  }
  function section(title, sub, inner, moreUrl, moreLabel) {
    return '<section class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">' + title + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' +
      (moreUrl ? '<a class="sec__more" href="' + esc(moreUrl) + '" target="_blank" rel="noopener">' + (moreLabel || '더보기 ↗') + '</a>' : '') + '</div>' + inner + '</section>';
  }
  function ytCard(v) {
    return '<div class="ccard" data-yt="' + esc(v.id) + '" style="cursor:pointer"><div class="ccard__thumb"><img loading="lazy" src="' + esc(v.thumbnail) + '" alt=""><div class="ccard__play">▶</div></div>' +
      '<div class="ccard__body"><div class="ccard__title" role="heading" aria-level="3">' + esc(v.title) + '</div><div class="ccard__meta" style="color:var(--ink-3);font-size:13px;margin-top:6px">' + (v.views != null ? F.count(v.views) + '회' : '') + (v.duration ? ' · ' + F.dur(v.duration) : '') + '</div></div></div>';
  }
  function shortCard(s) {
    return '<div class="short" data-yt="' + esc(s.id) + '"><div class="short__thumb"><img loading="lazy" src="' + esc(s.thumbnail) + '" alt=""><span class="short__play">▶</span></div><div class="short__title">' + esc(s.title) + '</div></div>';
  }
  function blogCard(p) {
    var thumb = p.thumbnail ? '<div class="ccard__thumb"><img loading="lazy" src="' + esc(p.thumbnail) + '" alt=""></div>' : '<div class="ccard__thumb pcover g2"><div class="pcover__ico">✍</div></div>';
    return '<a class="ccard" href="' + esc(p.link) + '" target="_blank" rel="noopener">' + thumb + '<div class="ccard__body"><div class="ccard__title" role="heading" aria-level="3">' + esc(p.title) + '</div>' +
      '<div style="color:var(--ink-3);font-size:13px;margin:6px 0 8px">' + esc(p.date || '') + '</div>' +
      '<p style="color:var(--ink-2);font-size:13.5px;line-height:1.5;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">' + esc(p.summary || '') + '</p></div></a>';
  }
  // infinite grid: shows `batch` cards, reveals more on scroll (sentinel)
  function infiniteGrid(items, renderFn, batch) {
    batch = batch || 8;
    var cards = items.map(function (it, i) {
      var h = renderFn(it);
      return i < batch ? h : h.replace('class="ccard"', 'class="ccard is-hidden"');
    }).join('');
    return '<div class="grid" data-infinite data-batch="' + batch + '">' + cards + '</div>' +
      (items.length > batch ? '<div class="feed-sentinel"><span class="feed-spin"></span><span class="feed-loadtxt">콘텐츠 더 불러오는 중…</span></div>' : '');
  }
  function ytFeedSection(d) {
    var yt = d.hub && d.hub.youtube; if (!yt || !((yt.videos || []).length || (yt.shorts || []).length)) return '';
    var inner = (yt.videos.length ? infiniteGrid(yt.videos, ytCard, 8) : '') +
      (yt.shorts.length ? '<div style="margin-top:28px"><div class="sec__title" role="heading" aria-level="2" style="font-size:18px;margin-bottom:14px">⚡ 쇼츠</div><div class="shorts">' + yt.shorts.map(shortCard).join('') + '</div></div>' : '');
    return section('▶ 최근 영상', '스크롤하면 최신순으로 계속 보여드려요', inner, yt.url, 'YouTube ↗');
  }

  // ── MIXED feed: YouTube + Instagram + X in one continuous feed ──
  var SRC_LABEL = { youtube: 'YouTube', short: 'Shorts', instagram: 'Instagram', x: 'X', tiktok: 'TikTok' };
  var STAT_EYE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var STAT_LIKE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M7 22V11M2 13v7a2 2 0 0 0 2 2h13.3a2 2 0 0 0 2-1.7l1.3-8a2 2 0 0 0-2-2.3H14V4a2 2 0 0 0-3.6-1.2L7 11"/></svg>';
  var STAT_CMT = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.1A8.4 8.4 0 1 1 21 11.5z"/></svg>';
  function feedCard(it) {
    if (it.source === 'youtube' || it.source === 'short') {
      var dur = it.duration ? '<span class="fcard__dur">' + F.dur(it.duration) + '</span>' : '';
      return '<div class="fcard fcard--thumb" data-yt="' + esc(it.id) + '" tabindex="0" role="button" aria-label="' + esc(it.title) + ' 영상 재생">' +
        '<div class="fcard__media' + (it.source === 'short' ? ' fcard__media--v' : '') + '">' +
          '<img loading="lazy" src="' + esc(it.thumbnail) + '" alt="">' +
          '<span class="fcard__src fcard__src--yt">' + SRC_LABEL[it.source] + '</span>' +
          dur + '<span class="fcard__play">▶</span>' +
          '<div class="fcard__cap">' + esc(it.title) + '</div>' +
        '</div></div>';
    }
    if (it.placeholder) {
      return '<a class="fcard fcard--add" href="#/" onclick="return false">' +
        '<div class="fcard__addico">' + (it.source === 'instagram' ? SOCIAL_ICON.instagram : ICON_LINK) + '</div>' +
        '<div class="fcard__addt">' + esc(SRC_LABEL[it.source] || '소셜') + ' 게시물</div>' +
        '<div class="fcard__addd">빌더에서 게시물 링크를 추가하면<br>여기에 자동으로 섞여요</div></a>';
    }
    var hgt = it.source === 'x' ? 400 : 560;
    return '<div class="fcard fcard--embed">' +
      '<span class="fcard__src fcard__src--' + esc(it.source) + '">' + (SRC_LABEL[it.source] || '소셜') + (it.demo ? ' · 예시' : '') + '</span>' +
      '<iframe class="fcard__iframe" src="' + esc(it.embedUrl) + '" loading="lazy" style="height:' + hgt + 'px" scrolling="no" frameborder="0" allow="encrypted-media" allowtransparency="true"></iframe></div>';
  }
  function mixedFeedSection(d) {
    var feed = d.hub && d.hub.feed; if (!feed || !feed.length) return '';
    var batch = 9;
    var cards = feed.map(function (it, i) {
      var h = feedCard(it);
      return i < batch ? h : h.replace('class="fcard', 'class="fcard is-hidden');
    }).join('');
    var inner = '<div class="feed" data-infinite data-batch="6">' + cards + '</div>' +
      (feed.length > batch ? '<div class="feed-sentinel"><span class="feed-spin"></span><span class="feed-loadtxt">콘텐츠 더 불러오는 중…</span></div>' : '');
    return section('콘텐츠', '유튜브 · 인스타 · X를 한 피드에서 — 스크롤하면 계속', inner,
      (d.hub.youtube && d.hub.youtube.url) || null, '유튜브 ↗');
  }
  function instaSection(d) {
    var ig = d.hub && d.hub.instagram; if (!ig) return '';
    return '<section class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">📷 Instagram<small>인스타그램에서 더 많은 일상을</small></div></div>' +
      '<a class="igcard" href="' + esc(ig.url) + '" target="_blank" rel="noopener"><div class="igcard__grad">📷</div>' +
      '<div class="igcard__b"><div class="igcard__h">@' + esc(ig.handle || 'instagram') + '</div><p>최신 게시물·릴스·스토리는 인스타그램에서 확인하세요.</p>' +
      '<span class="btn btn--brand btn--sm">인스타그램에서 보기 →</span></div></a></section>';
  }
  function blogSection(d) {
    var blog = d.hub && d.hub.blog; if (!blog || !(blog.posts || []).length) return '';
    return section('✍ 블로그', (blog.label || '블로그') + ' 최신 글', infiniteGrid(blog.posts, blogCard, 6), blog.url, '블로그 ↗');
  }
  // CONCEPT — the protagonist. what the creator/brand is about.
  function conceptSection(d) {
    var c = d.concept; if (!c) return '';
    var pillars = (c.pillars || []).map(function (p, i) {
      return '<div class="pillar"><div class="pillar__i">' + ('0' + (i + 1)) + '</div><h3>' + esc(p.t) + '</h3><p>' + esc(p.d) + '</p></div>';
    }).join('');
    var themes = (c.themes || []).map(function (t) { return '<span class="themechip">#' + esc(t) + '</span>'; }).join('');
    return '<section class="wrap concept">' +
      '<div class="concept__head"><span class="eyebrow2">CONCEPT</span>' +
        '<h2 class="concept__h">' + esc(d.brand.name) + '는 이런 걸 합니다</h2>' +
        (themes ? '<div class="themechips">' + themes + '</div>' : '') +
      '</div>' +
      (pillars ? '<div class="pillars">' + pillars + '</div>' : '') +
    '</section>';
  }
  // CHANNELS — one creator, many channels (equal billing).
  function channelsSection(d) {
    var chans = [];
    var yt = d.hub && d.hub.youtube;
    if (d.brand.youtube) chans.push({ platform: 'youtube', label: 'YouTube', url: d.brand.youtube, desc: yt ? (yt.videos.length + '개 영상 · ' + yt.shorts.length + '개 쇼츠') : '영상 채널' });
    ((d.hub && d.hub.socials) || []).forEach(function (sc) {
      if (sc.platform === 'youtube') return;
      chans.push({ platform: sc.platform, label: sc.label, url: sc.url, desc: sc.handle ? '@' + sc.handle : '' });
    });
    if (d.hub && d.hub.blog) chans.push({ platform: d.hub.blog.platform, label: d.hub.blog.label, url: d.hub.blog.url, desc: (d.hub.blog.posts || []).length ? d.hub.blog.posts.length + '개 글' : '블로그' });
    if (chans.length < 2) return '';
    return section('채널', '한 사람, 여러 채널 — 전부 한 곳에 모았어요',
      '<div class="chans">' + chans.map(function (c) {
        return '<a class="chan chan--' + esc(c.platform) + '" href="' + esc(c.url) + '" target="_blank" rel="noopener">' +
          '<div class="chan__i">' + (SOCIAL_ICON[c.platform] || ICON_LINK) + '</div>' +
          '<div class="chan__b"><div class="chan__l">' + esc(c.label) + '</div><div class="chan__d">' + esc(c.desc) + '</div></div>' +
          '<span class="chan__go">→</span></a>';
      }).join('') + '</div>');
  }

  // ── premium finance/Capital layout (Kajabi · Patreon inspired) ──
  function trustBand(d) {
    var s = d.stats, b = d.brand;
    var items = [
      { n: b.subscribers != null ? F.count(b.subscribers) + '명' : '—', l: '구독자' },
      { n: F.count(s.students), l: '누적 수강생' },
      { n: (s.courseCount + s.membershipCount) + '+', l: '프리미엄 콘텐츠' },
      { n: '★ ' + s.avgRating, l: '평균 만족도' },
    ];
    return '<section class="trustband"><div class="wrap trustband__in">' +
      items.map(function (i) { return '<div class="tb"><div class="tb__n">' + esc(i.n) + '</div><div class="tb__l">' + esc(i.l) + '</div></div>'; }).join('') +
      '</div></section>';
  }
  function testimonials(d) {
    // AI-written, channel-specific reviews when available; else generic fallback
    var cp = d && d.copy && d.copy.reviews;
    var t = (cp && cp.length) ? cp.map(function (r) {
      return { q: r.text || r.q || '', n: r.name || '익명', r: r.role || '구매자', rating: Number(r.rating) || 5 };
    }) : [
      { q: '영상으로만 보던 걸 체계적으로 배우니 완전히 다르네요. 바로 실무에 적용했어요.', n: '김지훈', r: '수강생 · 입문 → 실전', rating: 5 },
      { q: '괜히 베스트가 아니에요. 설명이 쉽고 군더더기가 없어서 끝까지 봤어요.', n: '이서연', r: '직장인', rating: 5 },
      { q: '결제하길 정말 잘했어요. 이 퀄리티에 이 가격은 거의 반칙이죠.', n: '박도현', r: '수강생 3개월', rating: 5 },
    ];
    return '<section class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">생생한 후기<small>먼저 경험한 분들의 이야기</small></div></div><div class="tcards">' +
      t.map(function (x) {
        var stars = '★★★★★'.slice(0, x.rating) + '☆☆☆☆☆'.slice(0, 5 - x.rating);
        return '<div class="tcard"><div class="tcard__stars">' + stars + '</div><p class="tcard__q">"' + esc(x.q) + '"</p>' +
          '<div class="tcard__by"><div class="tcard__av">' + esc((x.n || '·')[0]) + '</div><div><div class="tcard__n">' + esc(x.n) + '</div><div class="tcard__r">' + esc(x.r) + '</div></div></div></div>';
      }).join('') + '</div></section>';
  }
  function faqSection() {
    var faqs = [
      { q: '결제하면 바로 이용할 수 있나요?', a: '네. 결제 즉시 강의와 멤버십 콘텐츠를 모두 이용하실 수 있습니다.' },
      { q: '멤버십은 언제든 해지할 수 있나요?', a: '네. 마이페이지에서 언제든 해지할 수 있으며, 남은 결제 기간까지는 그대로 이용됩니다.' },
      { q: '환불 정책이 어떻게 되나요?', a: '구매 후 7일 이내, 수강 이력이 없는 경우 100% 환불해 드립니다.' },
      { q: '어떤 결제 수단을 지원하나요?', a: '신용·체크카드, 가상계좌, 휴대폰 결제를 지원합니다. (runmoa 안전 결제)' },
    ];
    return '<section class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">자주 묻는 질문</div></div><div class="faq">' +
      faqs.map(function (f) { return '<div class="faq__item" data-faq><button class="faq__q">' + esc(f.q) + '<span class="faq__ic">+</span></button><div class="faq__a"><p>' + esc(f.a) + '</p></div></div>'; }).join('') +
      '</div></section>';
  }
  function ctaBand(d) {
    var primary = has(d, 'membership') ? '#/membership' : has(d, 'courses') ? '#/courses' : '#/store';
    return '<section class="ctaband"><div class="wrap ctaband__in"><h2>' + esc((d.concept && d.concept.headline) || d.brand.name) + '</h2>' +
      '<p>지금 함께 시작하고, 매주 새로운 인사이트를 받아보세요.</p>' +
      '<a class="btn btn--glass btn--lg" href="' + primary + '">지금 시작하기 →</a></div></section>';
  }
  function financeLayout(d) {
    var b = d.brand, c = d.concept || {};
    var sec = [cheroBlock(d), trustBand(d)];
    if ((c.pillars || []).length) {
      sec.push('<section class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">왜 ' + esc(b.name) + '인가</div></div><div class="pillars">' +
        c.pillars.map(function (p, i) { return '<div class="pillar"><div class="pillar__i">' + ('0' + (i + 1)) + '</div><h3>' + esc(p.t) + '</h3><p>' + esc(p.d) + '</p></div>'; }).join('') + '</div></section>');
    }
    if (has(d, 'membership')) {
      sec.push('<section class="sec--surface"><div class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">멤버십<small>매주 새로운 인사이트를 멤버 전용으로</small></div></div><div class="plans plans--lg">' + d.membership.map(planCard).join('') + '</div></div></section>');
    }
    if (has(d, 'courses')) sec.push(section('인기 강의', '가장 많이 듣는 강의', grid(d.courses.slice(0, 3), C.courseCard), '#/courses', '전체보기 →'));
    sec.push(testimonials(d));
    sec.push(faqSection());
    sec.push(channelsSection(d));
    sec.push(ctaBand(d));
    return { html: sec.join(''), mount: function (root) {
      wireBuy(root, d);
      root.querySelectorAll('[data-faq]').forEach(function (it) { it.querySelector('.faq__q').addEventListener('click', function () { it.classList.toggle('open'); }); });
      root.querySelectorAll('[data-yt]').forEach(function (el) { el.addEventListener('click', function () { App.openPreview(el.dataset.yt); }); });
    } };
  }

  // shared immersive concept hero (used by all layouts)
  function cheroBlock(d) {
    var b = d.brand, s = d.stats;
    var primaryCta = has(d, 'courses') ? '#/courses' : has(d, 'membership') ? '#/membership' : has(d, 'coaching') ? '#/coaching' : '#/store';
    var primaryLabel = has(d, 'courses') ? '강의 둘러보기' : has(d, 'membership') ? '멤버십 보기' : has(d, 'coaching') ? '클래스 예약' : '스토어 보기';
    var totalItems = s.courseCount + s.productCount + s.membershipCount + s.coachingCount;
    var cpt = d.concept || { role: '크리에이터', headline: b.name, statement: b.tagline || b.about, themes: [], pillars: [] };
    // emphasize the key phrase in the headline (color pop → a focal point to read)
    var eHead = esc(cpt.headline || b.name), eHl = cpt.highlight ? esc(cpt.highlight) : '';
    var headHtml = (eHl && eHead.indexOf(eHl) >= 0) ? eHead.split(eHl).join('<em class="hl">' + eHl + '</em>') : eHead;
    return '<header class="chero">' +
        (b.banner ? '<div class="chero__bg" style="background-image:url(\'' + esc(b.banner) + '\')"></div>' : '') +
        '<div class="chero__veil"></div>' +
        '<div class="chero__inner">' +
          '<span class="chero__eyebrow">' + esc(cpt.role) + '</span>' +
          '<h1 class="chero__name">' + headHtml + '</h1>' +
          '<p class="chero__tag">' + esc(cpt.statement) + '</p>' +
          '<div class="chero__by">' +
            (b.logo ? '<img src="' + esc(b.logo) + '" alt="">' : '') +
            '<span>by <b>' + esc(b.name) + '</b>' + (b.subscribers != null ? ' · 구독자 ' + count(b.subscribers) + '명' : '') + '</span>' +
          '</div>' +
          socialBar(d) +
          '<div class="chero__cta">' +
            '<a class="btn btn--brand btn--lg" href="' + primaryCta + '">' + primaryLabel + '</a>' +
            (b.youtube ? '<a class="btn btn--glass btn--lg" href="' + esc(b.youtube) + '" target="_blank" rel="noopener">▶ YouTube 채널</a>' : '') +
          '</div>' +
          '<p class="chero__trust">7일 100% 환불보장 · 평생 소장 · 수료증 발급</p>' +
          '<div class="chero__stats">' +
            '<div><b>' + count(s.students) + '+</b><span>누적 수강생</span></div>' +
            '<div><b>★ ' + s.avgRating + '</b><span>평균 만족도</span></div>' +
            '<div><b>' + (b.subscribers != null ? count(b.subscribers) : totalItems) + '</b><span>' + (b.subscribers != null ? '구독자' : '판매 아이템') + '</span></div>' +
          '</div>' +
        '</div>' +
      '</header>';
  }

  // risk-reversal band — removes purchase friction right under the offer
  function guaranteeBand(d) {
    var chk = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
    var items = [
      { t: '7일 100% 환불', d: '수강 전이면 조건 없이 전액 환불' },
      { t: '평생 소장', d: '한 번 결제로 무제한 수강' },
      { t: '수료증 발급', d: '완강 시 공식 수료증 제공' },
      { t: '안전 결제', d: 'runmoa 안전 결제 시스템' },
    ];
    return '<section class="wrap"><div class="guar">' +
      items.map(function (i) {
        return '<div class="guar__i"><span class="guar__chk">' + chk + '</span><div><div class="guar__t">' + esc(i.t) + '</div><div class="guar__d">' + esc(i.d) + '</div></div></div>';
      }).join('') + '</div></section>';
  }

  // WHY learn from THIS creator — the core persuasion (grounded in real data).
  function whyLearn(d) {
    var b = d.brand, c = d.concept || {};
    var role = c.role || '크리에이터';
    var subs = b.subscribers != null ? F.count(b.subscribers) + '명' : null;
    var themes = (c.themes || []).slice(0, 3).join(' · ') || (b.topics || []).slice(0, 3).join(' · ');
    var I = function (p) { return '<span class="why__ic"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg></span>'; };
    var ICONS = [
      I('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
      I('<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>'),
      I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>'),
      I('<path d="M17 2.1 21 6l-4 3.9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 21.9 3 18l4-3.9"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
    ];
    var aiWhy = d.copy && d.copy.why;
    var title = (aiWhy && aiWhy.title) || ('왜 ' + b.name + '일까요?');
    var reasons = (aiWhy && aiWhy.reasons && aiWhy.reasons.length)
      ? aiWhy.reasons.slice(0, 4).map(function (r, i) { return { i: ICONS[i % 4], t: r.t, d: r.d }; })
      : [
        { i: ICONS[0], t: '검증된 전문성', d: (subs ? subs + '이 신뢰하는 ' + role + '. ' : '') + (themes ? themes + ' 분야를 오래 다뤄온 진짜 전문가에게 직접 배웁니다.' : '수많은 팬이 인정한 전문가에게 직접 배웁니다.') },
        { i: ICONS[1], t: '영상으론 못 배우는 깊이', d: '무료 영상은 맛보기일 뿐입니다. 입문부터 실전까지, 흩어진 지식을 하나의 체계적인 커리큘럼으로 끝까지 끌고 갑니다.' },
        { i: ICONS[2], t: '바로 써먹는 실전', d: b.name + '이 직접 설계한 실습 중심 과정. 이론만 쌓지 않고, 따라 하면서 나만의 결과물을 완성합니다.' },
        { i: ICONS[3], t: '한 번 사면 평생 내 것', d: '평생 소장 · 무제한 복습 · 지속 업데이트. 망설여진다면 7일 안에 100% 환불도 가능합니다.' },
      ];
    return '<section class="sec--surface"><div class="wrap">' +
      '<div class="sec__head"><div class="sec__title" role="heading" aria-level="2">' + esc(title) + '<small>무료 영상과는 다른, 진짜 가치</small></div></div>' +
      '<div class="whyrow">' + reasons.map(function (r) {
        return '<div class="why__i">' + r.i + '<div><div class="why__t">' + esc(r.t) + '</div><p class="why__d">' + esc(r.d) + '</p></div></div>';
      }).join('') + '</div></div></section>';
  }

  // ── HOME — dispatches to an archetype-specific layout ───
  function home(d) {
    var key = d.theme && d.theme.key;
    if (key === 'capital') return financeLayout(d);
    return hubLayout(d);
  }

  // default: creator-hub layout
  //   intro (concept · channels) → COMMERCE (강의·상품·멤버십·CTA) → 콘텐츠 피드
  //   conversion funnel: hero(offer+trust) → OFFER (강의·보장·멤버십·스토어)
  //   → social proof → CTA → authority (concept·faq·channels·feed) below.
  function hubLayout(d) {
    var sections = [];
    sections.push(cheroBlock(d));

    // ── OFFER FIRST: the visitor is already a fan — lead with what they buy ──
    if (has(d, 'courses')) {
      var best = d.courses.filter(function (c) { return c.bestseller; }).concat(d.courses.filter(function (c) { return !c.bestseller; })).slice(0, 4);
      sections.push('<section class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">인기 강의<small>지금 가장 많이 듣는 강의</small></div><a class="sec__more" href="#/courses">전체보기 →</a></div>' + grid(best, C.courseCard, 'grid--slide') + '</section>');
    }
    sections.push(whyLearn(d));
    sections.push(guaranteeBand(d));
    if (has(d, 'membership')) {
      sections.push('<section class="sec--surface"><div class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">멤버십<small>월 구독으로 프리미엄 콘텐츠를 무제한</small></div></div>' +
        '<div class="plans">' + d.membership.map(planCard).join('') + '</div></div></section>');
    }
    if (has(d, 'digital') || has(d, 'merch')) {
      sections.push('<section class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">스토어<small>전자책 · 템플릿 · 굿즈</small></div><a class="sec__more" href="#/store">전체보기 →</a></div>' + grid(d.products.slice(0, 4), C.productCard, 'grid--slide') + '</section>');
    }
    if (has(d, 'coaching')) {
      sections.push('<section class="wrap"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">코칭 · 클래스<small>1:1·그룹 세션을 예약하세요</small></div><a class="sec__more" href="#/coaching">전체보기 →</a></div>' + grid(d.coaching, coachCard, 'grid--slide') + '</section>');
    }

    // ── social proof, then the close ──
    sections.push(testimonials(d));
    if (has(d, 'courses') || has(d, 'membership') || has(d, 'digital') || has(d, 'merch') || has(d, 'coaching')) {
      sections.push(ctaBand(d));
    }

    // ── authority & proof of expertise (secondary — below the offer) ──
    sections.push(conceptSection(d));
    sections.push(faqSection());
    sections.push(channelsSection(d));
    sections.push(mixedFeedSection(d));
    sections.push(blogSection(d));

    return { html: sections.join(''), mount: function (root) {
      wireBuy(root, d);
      root.querySelectorAll('[data-faq]').forEach(function (it) { it.querySelector('.faq__q').addEventListener('click', function () { it.classList.toggle('open'); }); });
      root.querySelectorAll('[data-yt]').forEach(function (el) {
        el.addEventListener('click', function () { App.openPreview(el.dataset.yt); });
      });
    } };
  }
  function heroWord(d) {
    if (has(d, 'membership') && d.blueprint && d.blueprint.primary === 'membership') return '멤버십';
    if (has(d, 'courses')) return '강의와 콘텐츠';
    if (has(d, 'coaching')) return '클래스';
    return '스토어';
  }
  function prop(i, t, p) { return '<div class="prop"><div class="prop__ico">' + i + '</div><h3>' + t + '</h3><p>' + p + '</p></div>'; }

  // ── MEMBERSHIP view ─────────────────────────────────────
  function membership(d) {
    if (!has(d, 'membership')) return { html: notFound() };
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <span>멤버십</span></div>' +
      '<section><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">멤버십 구독<small>' + esc(d.brand.name) + '의 프리미엄 콘텐츠를 월 구독으로</small></div></div>' +
      '<div class="plans plans--lg">' + d.membership.map(planCard).join('') + '</div>' +
      '<p style="text-align:center;color:var(--ink-3);font-size:13.5px;margin-top:24px">runmoa 멤버십(subscription) API로 결제·갱신이 처리됩니다. 언제든 해지할 수 있어요.</p>' +
      '</section></div>';
    return { html: html, mount: function (root) { wireBuy(root, d); } };
  }

  // ── COACHING view ───────────────────────────────────────
  function coaching(d) {
    if (!has(d, 'coaching')) return { html: notFound() };
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <span>코칭 · 클래스</span></div>' +
      '<section><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">코칭 · 클래스<small>1:1·그룹·오프라인 세션을 예약하세요</small></div></div>' +
      grid(d.coaching, coachCard) +
      '<p style="color:var(--ink-3);font-size:13.5px;margin-top:24px">예약은 runmoa 오프라인 콘텐츠(content_type: offline)로 일정·정원과 함께 관리됩니다.</p>' +
      '</section></div>';
    return { html: html, mount: function (root) { wireBuy(root, d); } };
  }

  // ── COURSES catalog ─────────────────────────────────────
  function courses(d, params) {
    var cat = params.get('cat'); var q = (params.get('q') || '').trim().toLowerCase();
    var list = d.courses.slice();
    if (cat) list = list.filter(function (c) { return c.category === cat; });
    if (q) list = list.filter(function (c) { return (c.title + c.category).toLowerCase().indexOf(q) >= 0; });
    var cats = ['전체'].concat(d.categories.course);
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <span>강의</span></div>' +
      '<section style="padding-top:24px"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">강의' + (cat ? ' · ' + esc(cat) : '') + (q ? '<small>"' + esc(q) + '" 검색 결과</small>' : '<small>모든 강의를 둘러보세요</small>') + '</div></div>' +
      '<div class="toolbar"><div class="cats">' + cats.map(function (c) {
        var active = (c === '전체' && !cat) || c === cat;
        return '<a class="cat' + (active ? ' active' : '') + '" href="' + (c === '전체' ? '#/courses' : '#/courses?cat=' + encodeURIComponent(c)) + '">' + esc(c) + '</a>';
      }).join('') + '</div><span class="count">' + list.length + '개 강의</span></div>' +
      (list.length ? grid(list, C.courseCard) : emptyBox('🔍', '검색 결과가 없어요')) + '</section></div>';
    return { html: html };
  }

  // ── COURSE detail ───────────────────────────────────────
  function course(d, id) {
    var c = window.Data.course(id);
    if (!c) return { html: notFound() };
    var inCart = Store.has('course', c.id);
    var lessons = (c.curriculum && c.curriculum.length) ? c.curriculum : curriculum(c);
    var outcomes = (c.outcomes && c.outcomes.length) ? c.outcomes : learnPoints(c);
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <a href="#/courses">강의</a> › <span>' + esc(c.category) + '</span></div>' +
      '<div class="detail"><div class="detail__main">' +
        '<div class="ccard__cat" style="font-size:14px">' + esc(c.category) + '</div>' +
        '<h1 class="detail__title">' + esc(c.title) + '</h1>' +
        '<div class="detail__meta"><span><b style="color:var(--star);font-weight:800">★ ' + c.rating + '</b> (' + count(c.reviews) + '개 수강평)</span><span>· 수강생 ' + count(c.students) + '명</span><span>· 난이도 ' + esc(c.level) + '</span><span class="detail__inst">· <img src="' + esc(c.instructorAvatar || '') + '" alt="">' + esc(c.instructor) + '</span></div>' +
        '<div class="detail__media" data-preview="' + esc(c.preview || '') + '"><img src="' + esc(c.thumbnail) + '" alt="">' + (c.preview ? '<div class="playbig"><span>▶</span></div>' : '') + '</div>' +
        '<div class="detail__block"><h2>이 강의에서 배우는 것</h2><ul class="learn">' + outcomes.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
        '<div class="detail__block"><h2>커리큘럼 <small style="font-weight:600;color:var(--ink-3);font-size:14px">· ' + lessons.length + '개 레슨</small></h2><ul class="curri">' + lessons.map(function (l, i) { return '<li><span class="ix">' + (i + 1) + '</span><span>' + esc(l.t) + '</span><span class="du">' + l.d + '</span></li>'; }).join('') + '</ul></div>' +
        '<div class="detail__block"><h2>강의 소개</h2><div class="prose">' + esc(c.description || c.title) + '</div></div>' +
      '</div><aside><div class="buy"><div class="buy__price">' + C.priceHtml(c.price) + '</div>' +
        '<ul class="buy__list"><li>🎬 <b>' + (c.durationSec ? F.dur(c.durationSec) : (c.lessons + '개 레슨')) + '</b> 분량</li><li>📚 <b>' + c.lessons + '개</b> 레슨</li><li>♾️ <b>평생 소장</b> · 무제한 수강</li><li>🧾 수료증 발급</li></ul>' +
        '<div class="buy__actions"><button class="btn btn--brand btn--block btn--lg" data-buy>바로 수강신청</button><button class="btn btn--ghost btn--block" data-cart ' + (inCart ? 'disabled' : '') + '>' + (inCart ? '장바구니에 있음' : '장바구니 담기') + '</button></div>' +
      '</div></aside></div></div>';
    function mount(root) {
      var media = root.querySelector('.detail__media');
      if (media && media.dataset.preview) media.addEventListener('click', function () { App.openPreview(media.dataset.preview, c.title); });
      var item = { id: c.id, kind: 'course', title: c.title, thumb: c.thumbnail, price: F.payNow(c.price), base: c.price.base, runmoaId: c.runmoaId, optionId: c.optionId };
      var cb = root.querySelector('[data-cart]');
      if (cb) cb.addEventListener('click', function () { Store.add(item); App.toast('장바구니에 담았어요', '강의'); this.disabled = true; this.textContent = '장바구니에 있음'; });
      root.querySelector('[data-buy]').addEventListener('click', function () { if (!Store.has('course', c.id)) Store.add(item); nav('/checkout'); });
    }
    return { html: html, mount: mount };
  }

  // ── STORE ───────────────────────────────────────────────
  function store(d, params) {
    var cat = params.get('cat');
    var list = d.products.slice();
    if (cat) list = list.filter(function (p) { return p.category === cat; });
    var cats = ['전체'].concat(d.categories.product);
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <span>스토어</span></div>' +
      '<section style="padding-top:24px"><div class="sec__head"><div class="sec__title" role="heading" aria-level="2">스토어' + (cat ? ' · ' + esc(cat) : '') + '<small>전자책 · 템플릿 · 리포트 · 굿즈</small></div></div>' +
      '<div class="toolbar"><div class="cats">' + cats.map(function (c) {
        var active = (c === '전체' && !cat) || c === cat;
        return '<a class="cat' + (active ? ' active' : '') + '" href="' + (c === '전체' ? '#/store' : '#/store?cat=' + encodeURIComponent(c)) + '">' + esc(c) + '</a>';
      }).join('') + '</div><span class="count">' + list.length + '개 상품</span></div>' +
      (list.length ? grid(list, C.productCard) : emptyBox('📦', '상품이 없어요')) + '</section></div>';
    return { html: html };
  }

  // ── PRODUCT detail ──────────────────────────────────────
  function product(d, id) {
    var p = window.Data.product(id);
    if (!p) return { html: notFound() };
    var opt = p.options && p.options[0];
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <a href="#/store">스토어</a> › <span>' + esc(p.category) + '</span></div>' +
      '<div class="detail"><div class="detail__main"><div style="border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow)">' +
        (p.thumbnail ? '<img src="' + esc(p.thumbnail) + '" alt="" style="width:100%">' : '<div class="pcover g' + (p.cover || 0) + '" style="aspect-ratio:16/10"><div class="pcover__ico" style="font-size:90px">' + (p.icon || '📦') + '</div></div>') + '</div>' +
        '<div class="detail__block"><h2>상품 설명</h2><div class="prose">' + esc(p.description) + '</div></div>' +
        (p.requiresShipping ? '<div class="detail__block"><h2>배송 안내</h2><div class="prose">기본 배송비 ₩3,000 · 영업일 기준 2~4일 이내 출고됩니다.</div></div>' : '<div class="detail__block"><h2>다운로드 안내</h2><div class="prose">결제 즉시 마이페이지에서 파일을 다운로드할 수 있습니다.</div></div>') +
      '</div><aside><div class="buy"><div class="ccard__cat" style="font-size:13px">' + esc(p.category) + (p.requiresShipping ? ' · 배송상품' : ' · 디지털 다운로드') + '</div>' +
        '<h2 style="font-size:20px;margin:8px 0 14px">' + esc(p.title) + '</h2>' +
        '<div class="ccard__rate" style="margin-bottom:16px"><span class="v">★ ' + p.rating + '</span><span class="c">(' + count(p.reviews) + ') · ' + count(p.sold) + '개 판매</span></div>' +
        '<div class="buy__price">' + C.priceHtml(p.price) + '</div>' +
        (opt ? '<div class="opt"><label>' + esc(opt.name) + '</label><select id="popt">' + opt.values.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') + '</select></div>' : '') +
        '<div class="opt"><label>수량</label><div class="qty"><button data-m>−</button><input id="pqty" value="1" inputmode="numeric"><button data-p>+</button></div></div>' +
        '<div class="buy__actions"><button class="btn btn--brand btn--block btn--lg" data-buy>바로 구매</button><button class="btn btn--ghost btn--block" data-cart>장바구니 담기</button></div>' +
      '</div></aside></div></div>';
    function mount(root) {
      var qEl = root.querySelector('#pqty');
      root.querySelector('[data-m]').addEventListener('click', function () { qEl.value = Math.max(1, (+qEl.value || 1) - 1); });
      root.querySelector('[data-p]').addEventListener('click', function () { qEl.value = (+qEl.value || 1) + 1; });
      function item() { var sel = root.querySelector('#popt'); return { id: p.id, kind: 'product', title: p.title, icon: p.icon, cover: p.cover, thumb: p.thumbnail, price: F.payNow(p.price), base: p.price.base, qty: Math.max(1, +qEl.value || 1), optLabel: sel ? sel.value : '', shipping: p.requiresShipping, runmoaId: p.runmoaId, variantId: p.variantId }; }
      root.querySelector('[data-cart]').addEventListener('click', function () { Store.add(item()); App.toast('장바구니에 담았어요', '상품'); });
      root.querySelector('[data-buy]').addEventListener('click', function () { Store.add(item()); nav('/checkout'); });
    }
    return { html: html, mount: mount };
  }

  // ── CART ────────────────────────────────────────────────
  function cart(d) {
    var items = Store.cart();
    if (!items.length) return { html: '<div class="wrap"><section>' + emptyBox('🛒', '장바구니가 비어 있어요', '둘러보기', '#/') + '</section></div>' };
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <span>장바구니</span></div>' +
      '<div class="checkout"><div class="panel"><h2>장바구니 (' + Store.count() + ')</h2><div id="lines">' + lines(items) + '</div></div>' + summaryPanel('주문하기', '#/checkout') + '</div></div>';
    return { html: html, mount: function (root) { wireLines(root); } };
  }
  function lines(items) {
    return items.map(function (it) {
      var k = Store.keyOf(it);
      var thumb = it.thumb ? '<img class="litem__thumb" src="' + esc(it.thumb) + '" alt="">' : '<div class="litem__thumb g' + (it.cover || 0) + '">' + (it.icon || '📦') + '</div>';
      var stepper = it.kind === 'product'
        ? '<button data-m>−</button><input value="' + it.qty + '" readonly><button data-p>+</button>'
        : '<span style="padding:0 10px;font-size:13px;color:var(--ink-3);line-height:38px">1' + (it.kind === 'membership' ? '개월' : '개') + '</span>';
      return '<div class="litem" data-key="' + esc(k) + '">' + thumb + '<div style="flex:1;min-width:0"><div class="litem__k">' + kindLabel(it.kind) + (it.optLabel ? ' · ' + esc(it.optLabel) : '') + '</div><div class="litem__t">' + esc(it.title) + '</div><div class="litem__b"><div class="qty">' + stepper + '</div><strong>' + won(it.price * it.qty) + '</strong></div><button class="litem__rm" data-rm>삭제</button></div></div>';
    }).join('');
  }
  function kindLabel(k) { return { course: '강의', product: '상품', membership: '멤버십', coaching: '클래스' }[k] || k; }
  function wireLines(root) {
    root.querySelectorAll('.litem').forEach(function (row) {
      var key = row.dataset.key, m = row.querySelector('[data-m]'), p = row.querySelector('[data-p]');
      var it = Store.cart().find(function (x) { return Store.keyOf(x) === key; });
      if (m) m.addEventListener('click', function () { Store.setQty(key, it.qty - 1); });
      if (p) p.addEventListener('click', function () { Store.setQty(key, it.qty + 1); });
      row.querySelector('[data-rm]').addEventListener('click', function () { Store.remove(key); });
    });
  }

  // ── CHECKOUT ────────────────────────────────────────────
  function checkout(d) {
    var items = Store.cart();
    if (!items.length) return { html: '<div class="wrap"><section>' + emptyBox('🛒', '장바구니가 비어 있어요', '둘러보기', '#/') + '</section></div>' };
    var ship = Store.hasShipping();
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <a href="#/cart">장바구니</a> › <span>결제</span></div>' +
      '<div class="checkout"><div><div class="panel" style="margin-bottom:24px"><h2>주문자 정보</h2>' +
        '<div class="field"><label>이름</label><input id="f_name" placeholder="홍길동"></div>' +
        '<div class="field"><label>이메일</label><input id="f_mail" placeholder="you@example.com"></div>' +
        '<div class="field"><label>연락처</label><input id="f_tel" placeholder="010-0000-0000"></div>' +
        (ship ? '<div class="field"><label>배송 주소</label><input id="f_addr" placeholder="배송 받을 주소"></div>' : '') + '</div>' +
        '<div class="panel"><h2>결제 수단</h2><div class="field"><label>결제 방법</label><select class="sort" style="width:100%;height:46px" id="f_pay"><option value="CARD">신용/체크카드</option><option value="VBANK">가상계좌</option></select></div>' +
        '<p style="color:var(--ink-3);font-size:13px;margin:6px 0 0">' + payNote() + '</p></div></div>' +
        summaryPanel('결제하기', null, true) + '</div></div>';
    function mount(root) {
      // pull 주문자 정보 from the runmoa profile (DB) and autofill when logged in
      if (window.RUNMOA && window.RUNMOA.useApi && window.RM && RM.isLoggedIn()) {
        RM.profile().then(function (p) {
          var fn = root.querySelector('#f_name'), fm = root.querySelector('#f_mail'), ft = root.querySelector('#f_tel');
          if (fn && p.name && !fn.value) fn.value = p.name;
          if (fm && p.email && !fm.value) fm.value = p.email;
          if (ft && p.phone && !ft.value) ft.value = p.phone;
          if (p.name || p.email || p.phone) App.toast('로그인 정보로 주문자 정보를 채웠어요', '✓');
        }).catch(function () {});
      }
      root.querySelector('[data-pay]').addEventListener('click', function () {
        var btn = this;
        var name = root.querySelector('#f_name').value.trim();
        if (!name) { App.toast('주문자 이름을 입력해 주세요'); root.querySelector('#f_name').focus(); return; }
        var mailEl = root.querySelector('#f_mail'), telEl = root.querySelector('#f_tel'), addrEl = root.querySelector('#f_addr');
        // ── real runmoa payment: Schoolmoa login → order → NicePay ──
        if (window.RUNMOA && window.RUNMOA.useApi && window.RM) {
          if (!RM.isLoggedIn()) {
            App.toast('로그인이 필요해요 · Schoolmoa 로그인으로 이동합니다');
            btn.disabled = true; btn.textContent = '로그인으로 이동…';
            RM.login().catch(function (e) { btn.disabled = false; btn.textContent = '결제하기'; App.toast('로그인 오류: ' + e.message); });
            return;
          }
          var buyer = { receiver_name: name, phone: (telEl && telEl.value.trim()) || '', mail: (mailEl && mailEl.value.trim()) || '', address: (addrEl && addrEl.value.trim()) || '', region: { country: 'KR' } };
          var its = Store.cart();
          var total = Store.subtotal() + (Store.hasShipping() ? 3000 : 0);
          var goods = ((its[0] && its[0].title) || '주문') + (its.length > 1 ? ' 외 ' + (its.length - 1) + '건' : '');
          btn.disabled = true; btn.textContent = '결제창으로 이동 중…';
          RM.checkout(its, buyer, total, goods).catch(function (e) { btn.disabled = false; btn.textContent = '결제하기'; App.toast('결제 오류: ' + (e.message || e)); });
          return;
        }
        // ── demo fallback ──
        btn.disabled = true; btn.textContent = '결제 처리 중…';
        setTimeout(function () {
          var order = Store.recordOrder({ name: name, mail: mailEl.value.trim(), tel: telEl.value.trim(), pay: root.querySelector('#f_pay').value });
          sessionStorage.setItem('last_order', JSON.stringify(order)); nav('/done');
        }, 700);
      });
    }
    return { html: html, mount: mount };
  }
  function payNote() {
    var live = window.RUNMOA && window.RUNMOA.useApi;
    return live ? '실 결제는 로그인 후 runmoa POST /orders → /payments/initialize 로 진행됩니다.'
      : '데모 결제 모드입니다. 실제 청구는 없으며, 주문 내역은 마이페이지에서 확인할 수 있어요.';
  }

  function summaryPanel(ctaText, ctaHref, isCheckout) {
    var sub = Store.subtotal(), disc = Store.discountTotal(), ship = Store.hasShipping() ? 3000 : 0, total = sub + ship;
    var btn = ctaHref ? '<a class="btn btn--brand btn--block btn--lg" href="' + ctaHref + '">' + ctaText + '</a>' : '<button class="btn btn--brand btn--block btn--lg" data-pay>' + won(total) + ' ' + ctaText + '</button>';
    return '<aside><div class="buy"><h2 style="font-size:18px;margin-bottom:16px">주문 요약</h2>' +
      '<div class="sumrow"><span>상품 금액</span><span>' + won(Store.baseTotal()) + '</span></div>' +
      (disc > 0 ? '<div class="sumrow"><span>할인</span><span style="color:var(--price)">−' + won(disc) + '</span></div>' : '') +
      (ship ? '<div class="sumrow"><span>배송비</span><span>' + won(ship) + '</span></div>' : '') +
      '<div class="sumrow sumrow--total"><span>결제 금액</span><span>' + won(total) + '</span></div>' + btn +
      (isCheckout ? '' : '<a class="btn btn--ghost btn--block" style="margin-top:10px" href="#/">계속 쇼핑하기</a>') + '</div></aside>';
  }

  // ── DONE ────────────────────────────────────────────────
  function done(d) {
    var order = null; try { order = JSON.parse(sessionStorage.getItem('last_order')); } catch (e) {}
    if (!order) return { html: '<div class="wrap"><section>' + emptyBox('✅', '주문 내역이 없어요', '홈으로', '#/') + '</section></div>' };
    var html = '<div class="wrap"><div class="done"><div class="done__ico">✓</div><h1>결제가 완료되었어요</h1>' +
      '<p>' + esc(order.receiver.name || '') + '님, 구매해 주셔서 감사합니다.</p><p>' + order.items.length + '개 상품 · 즉시 이용 가능합니다.</p>' +
      '<div class="done__order">주문번호 ' + esc(order.no) + ' · ' + won(order.total) + '</div>' +
      '<div style="display:flex;gap:10px;justify-content:center"><a class="btn btn--brand btn--lg" href="#/">계속 둘러보기</a>' +
      (window.RUNMOA && window.RUNMOA.useApi ? '<a class="btn btn--ghost btn--lg" href="#/mypage">내 주문·콘텐츠 보기</a>' : '') + '</div></div></div>';
    return { html: html };
  }

  // ── DASHBOARD ───────────────────────────────────────────
  function dashboard(d) {
    var seed = (d.courses || []).map(function (c) { var unit = F.payNow(c.price); var sales = Math.max(3, Math.round(c.students * 0.04)); return { title: c.title, thumb: c.thumbnail, unit: unit, sales: sales, revenue: unit * sales }; });
    // membership MRR contributes to revenue too
    var mrr = (d.membership || []).reduce(function (s, m) { return s + m.price * (m.popular ? 60 : 18); }, 0);
    var orders = Store.orders();
    var orderRevenue = orders.reduce(function (s, o) { return s + o.total; }, 0);
    var seedRevenue = seed.reduce(function (s, x) { return s + x.revenue; }, 0);
    var totalRevenue = seedRevenue + mrr + orderRevenue;
    var totalSales = seed.reduce(function (s, x) { return s + x.sales; }, 0) + orders.length + (d.membership || []).length * 26;
    var payout = Math.round(totalRevenue * 0.85);
    var bars = seed.slice().sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 6);
    if (mrr) bars.unshift({ title: '멤버십 MRR', thumb: null, sales: 0, revenue: mrr });
    bars = bars.slice(0, 6);
    var maxRev = Math.max.apply(null, bars.map(function (x) { return x.revenue; }).concat([1]));
    var recent = orders.slice(0, 5).map(function (o) { return '<tr><td>' + esc(o.no) + '</td><td>' + esc((o.items[0] && o.items[0].title) || '') + (o.items.length > 1 ? ' 외 ' + (o.items.length - 1) : '') + '</td><td>' + esc(o.receiver.name || '게스트') + '</td><td class="num">' + won(o.total) + '</td></tr>'; }).join('');
    if (!recent) recent = '<tr><td colspan="4" style="color:var(--ink-3);text-align:center;padding:24px">아직 데모 주문이 없어요. 상품을 구매해 보세요.</td></tr>';
    var html = '<div class="wrap"><div class="dash__hd"><h1>크리에이터 수익 대시보드</h1><p>' + esc(d.brand.name) + ' · ' + (d.blueprint ? esc(d.blueprint.title) + ' · ' : '') + '판매 현황을 한눈에</p></div>' +
      '<div class="kpis"><div class="kpi kpi--accent"><div class="kpi__l">총 매출</div><div class="kpi__v">' + won(totalRevenue) + '</div><div class="kpi__d up">▲ 강의·멤버십·상품 합산</div></div>' +
        '<div class="kpi"><div class="kpi__l">판매 건수</div><div class="kpi__v">' + count(totalSales) + '</div><div class="kpi__d up">▲ 누적 결제</div></div>' +
        '<div class="kpi"><div class="kpi__l">' + (mrr ? '멤버십 MRR' : '누적 수강생') + '</div><div class="kpi__v">' + (mrr ? won(mrr) : count(d.stats.students)) + '</div><div class="kpi__d">' + (mrr ? '월 반복 매출' : '활성 학습자') + '</div></div>' +
        '<div class="kpi"><div class="kpi__l">정산 예정 (85%)</div><div class="kpi__v">' + won(payout) + '</div><div class="kpi__d">다음 정산일 지급</div></div></div>' +
      '<div class="dash__grid"><div class="panel"><h2>매출 TOP</h2><div class="chart">' + bars.map(function (x) { var h = Math.round((x.revenue / maxRev) * 160) + 8; return '<div class="bar" style="height:' + h + 'px"><span>' + Math.round(x.revenue / 10000) + '만</span><small>' + esc(x.title.slice(0, 6)) + '…</small></div>'; }).join('') + '</div></div>' +
        '<div class="panel"><h2>베스트셀러</h2><table class="tbl"><thead><tr><th>아이템</th><th class="num">판매</th><th class="num">매출</th></tr></thead><tbody>' + seed.slice().sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 5).map(function (x) { return '<tr><td><div class="tag-row">' + (x.thumb ? '<img src="' + esc(x.thumb) + '" alt="">' : '') + esc(x.title.slice(0, 16)) + '…</div></td><td class="num">' + x.sales + '</td><td class="num">' + won(x.revenue) + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
      '<div class="panel" style="margin-top:24px"><h2>최근 주문</h2><table class="tbl"><thead><tr><th>주문번호</th><th>상품</th><th>구매자</th><th class="num">금액</th></tr></thead><tbody>' + recent + '</tbody></table></div><div style="height:48px"></div></div>';
    return { html: html };
  }

  // ── helpers ─────────────────────────────────────────────
  function curriculum(c) {
    var n = c.lessons || 8;
    var pool = ['오리엔테이션', '핵심 개념 잡기', '실전 예제 따라하기', '한 단계 더 깊이', '자주 하는 실수', '응용과 확장', '케이스 스터디', '마무리와 다음 단계'];
    var each = c.durationSec ? Math.round(c.durationSec / n) : 600; var out = [];
    for (var i = 0; i < n; i++) { var mm = Math.max(3, Math.round((each * (0.7 + (i % 3) * 0.2)) / 60)); out.push({ t: (i + 1) + '강 · ' + pool[i % pool.length], d: mm + '분' }); }
    return out;
  }
  function learnPoints(c) {
    var t = (c.tags && c.tags.length ? c.tags : (c.category ? [c.category] : ['핵심 개념']));
    return [t[0] + '의 핵심 원리를 이해하고 실무에 적용합니다', '실전 예제로 ' + (t[1] || t[0]) + ' 흐름을 체득합니다', '현업에서 바로 쓰는 노하우와 팁을 배웁니다', '자주 하는 실수와 해결법을 익힙니다', '나만의 결과물을 직접 완성합니다', '최신 트렌드와 다음 학습 방향을 잡습니다'];
  }
  function emptyBox(ico, msg, cta, href) { return '<div class="empty"><div class="empty__ico">' + ico + '</div><p>' + esc(msg) + '</p>' + (cta ? '<a class="btn btn--brand" style="margin-top:14px" href="' + href + '">' + esc(cta) + '</a>' : '') + '</div>'; }
  function notFound() { return '<div class="wrap"><section>' + emptyBox('🔍', '찾을 수 없는 항목이에요', '홈으로', '#/') + '</section></div>'; }

  // ── MY PAGE ─────────────────────────────────────────────
  var CT_LABEL = { vod: 'VOD', offline: '오프라인', live: '라이브', digital_content: '디지털' };
  function mypage(d, params) {
    var live = window.RUNMOA && window.RUNMOA.useApi && window.RM;
    if (!live || !RM.isLoggedIn()) {
      return { html: '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <span>마이페이지</span></div>' +
        '<section><div class="mp-login"><div class="mp-login__ico">🔒</div><h2>로그인이 필요해요</h2>' +
        '<p style="color:var(--ink-2);margin:8px 0 20px">로그인하면 주문 내역과 보유한 강의·콘텐츠를 볼 수 있어요.</p>' +
        '<button class="btn btn--brand btn--lg" id="mpLoginBtn">Schoolmoa 로그인</button></div></section></div>',
        mount: function (root) { var b = root.querySelector('#mpLoginBtn'); if (b) b.addEventListener('click', function () { if (window.RM) RM.login().catch(function (e) { App.toast('로그인 오류: ' + e.message); }); }); } };
    }
    var u = RM.user() || {};
    var tab = (params && params.get('tab')) || 'orders';
    function tb(k, l) { return '<a class="mp-tab' + (tab === k ? ' active' : '') + '" href="#/mypage?tab=' + k + '">' + l + '</a>'; }
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <span>마이페이지</span></div>' +
      '<div class="mp"><div class="mp__head"><div class="mp__av">' + esc((u.name || u.nickname || 'U').slice(0, 1)) + '</div>' +
        '<div class="mp__id"><div class="mp__name">' + esc(u.name || u.nickname || '회원') + '</div>' +
        '<div class="mp__sub">' + esc(u.email || '') + (u.phone ? ' · ' + esc(u.phone) : '') + '</div></div>' +
        '<button class="btn btn--ghost btn--sm" id="mpLogout">로그아웃</button></div>' +
      '<div class="mp-tabs">' + tb('orders', '주문 내역') + tb('contents', '보유 콘텐츠') + tb('profile', '내 정보') + '</div>' +
      '<div class="mp__body" id="mpBody"><div class="loading"><div class="spinner"></div></div></div></div></div>';
    return { html: html, mount: function (root) {
      root.querySelector('#mpLogout').addEventListener('click', function () { RM.logoutRemote(); RM.logout(); App.toast('로그아웃되었습니다'); location.hash = '/'; });
      var body = root.querySelector('#mpBody');
      if (tab === 'contents') mpContents(body);
      else if (tab === 'profile') mpProfile(body, u);
      else mpOrders(body);
    } };
  }
  function mpOrders(body) {
    RM.orders(1).then(function (orders) {
      if (!orders || !orders.length) { body.innerHTML = emptyBox('🧾', '아직 주문 내역이 없어요', '강의 둘러보기', '#/courses'); return; }
      body.innerHTML = '<div class="mp-orders">' + orders.map(function (o) {
        var st = F.orderStatus(o.status);
        return '<div class="mp-order" data-order="' + esc(o.ID || o.id) + '" tabindex="0" role="button">' +
          '<div><div class="mp-order__no">' + esc(o.order_number || ('주문 #' + (o.ID || o.id))) + '</div>' +
          '<div class="mp-order__date">' + F.date(o.paid_date || o.created_at) + '</div></div>' +
          '<span class="mp-badge mp-badge--' + st.c + '">' + esc(st.l) + '</span>' +
          '<strong class="mp-order__amt">' + won(o.price_total || o.price) + '</strong></div>';
      }).join('') + '</div>';
      body.querySelectorAll('[data-order]').forEach(function (el) { el.addEventListener('click', function () { mpOrderDetail(el.dataset.order); }); });
    }).catch(function (e) { body.innerHTML = '<p class="mp-err">주문을 불러오지 못했어요 · ' + esc(e.message) + '</p>'; });
  }
  function mpOrderDetail(id) {
    App.openHtmlModal('<div class="loading" style="min-height:200px"><div class="spinner"></div></div>');
    RM.orderDetail(id).then(function (r) {
      var o = r.order || {}, items = r.items || [], st = F.orderStatus(o.status);
      var h = '<div class="od"><div class="od__head"><div><div class="od__no">' + esc(o.order_number || ('주문 #' + id)) + '</div><div class="od__date">' + F.date(o.paid_date || o.created_at) + '</div></div><span class="mp-badge mp-badge--' + st.c + '">' + esc(st.l) + '</span></div>' +
        '<div class="od__items">' + items.map(function (it) {
          return '<div class="od__item">' + (it.image_url ? '<img src="' + esc(it.image_url) + '" alt="">' : '<div class="od__ph">' + (it.type === 'content' ? '🎓' : '📦') + '</div>') +
            '<div style="flex:1;min-width:0"><div class="od__name">' + esc(it.name) + '</div>' + (it.option_name ? '<div class="od__opt">' + esc(it.option_name) + '</div>' : '') +
            '<div class="od__tag">' + (it.type === 'content' ? '콘텐츠' : '상품' + (it.quantity ? ' · ' + it.quantity + '개' : '')) + '</div></div>' +
            '<strong>' + won(it.price) + '</strong></div>';
        }).join('') + '</div>' +
        (o.receiver_name || o.address ? '<div class="od__ship"><h4>배송 정보</h4><p>' + esc(o.receiver_name || '') + (o.receiver_phone ? ' · ' + esc(o.receiver_phone) : '') + '</p>' + (o.address ? '<p>' + esc(o.address) + ' ' + esc(o.address_detailed || '') + (o.postal_code ? ' (' + esc(o.postal_code) + ')' : '') + '</p>' : '') + '</div>' : '') +
        '<div class="od__total"><span>결제 금액</span><strong>' + won(o.price_total) + '</strong></div></div>';
      App.openHtmlModal(h);
    }).catch(function (e) { App.openHtmlModal('<p style="padding:30px">주문 상세를 불러오지 못했어요 · ' + esc(e.message) + '</p>'); });
  }
  function mpContents(body) {
    function load(type, listEl) { RM.myContents(type, 'all').then(function (items) { mpContentCards(listEl, items); }).catch(function (e) { listEl.innerHTML = '<p class="mp-err">' + esc(e.message) + '</p>'; }); }
    RM.contentCounts('all').then(function (cc) {
      var counts = (cc && (cc.counts || cc)) || {};
      var types = [['all', '전체'], ['vod', 'VOD'], ['offline', '오프라인'], ['live', '라이브'], ['digital_content', '디지털']];
      body.innerHTML = '<div class="mp-ctabs">' + types.map(function (t) { var n = counts[t[0]]; return (t[0] === 'all' || n) ? '<button class="mp-ctab" data-ctype="' + t[0] + '">' + t[1] + (n != null ? ' <b>' + n + '</b>' : '') + '</button>' : ''; }).join('') + '</div><div id="mpCList"><div class="loading"><div class="spinner"></div></div></div>';
      var listEl = body.querySelector('#mpCList');
      body.querySelectorAll('[data-ctype]').forEach(function (b) { b.addEventListener('click', function () { body.querySelectorAll('.mp-ctab').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); load(b.dataset.ctype, listEl); }); });
      var first = body.querySelector('.mp-ctab'); if (first) first.classList.add('active');
      load('all', listEl);
    }).catch(function () { body.innerHTML = '<div id="mpCList"></div>'; load('all', body.querySelector('#mpCList')); });
  }
  function mpContentCards(list, items) {
    if (!items || !items.length) { list.innerHTML = emptyBox('🎓', '보유한 콘텐츠가 없어요', '강의 둘러보기', '#/courses'); return; }
    list.innerHTML = '<div class="grid">' + items.map(function (c) {
      var type = c.type || c.content_type || 'vod', thumb = c.thumbnail || c.img || c.image_url || '';
      var pr = c.progress_rate != null ? Math.round(c.progress_rate) : null;
      return '<div class="ccard mpc" data-cid="' + esc(c.content_id || c.id || c.ID) + '" data-ctype="' + esc(type) + '" tabindex="0" role="button">' +
        '<div class="ccard__thumb">' + (thumb ? '<img loading="lazy" src="' + esc(thumb) + '" alt="">' : '<div class="pcover g2"><div class="pcover__ico" aria-hidden="true">🎓</div></div>') +
        '<span class="mpc__type">' + (CT_LABEL[type] || type) + '</span></div>' +
        '<div class="ccard__body"><h3 class="ccard__title">' + esc(c.title) + '</h3>' +
        (pr != null && type === 'vod' ? '<div class="mpc__prog"><div class="mpc__bar" style="width:' + pr + '%"></div></div><div class="mpc__pct">' + pr + '% 수강</div>' : '<div class="mpc__open">' + (type === 'digital_content' ? '다운로드 →' : type === 'offline' ? '일정 보기 →' : '바로 보기 →') + '</div>') +
        '</div></div>';
    }).join('') + '</div>';
    list.querySelectorAll('[data-cid]').forEach(function (el) { el.addEventListener('click', function () { mpOpenContent(el.dataset.cid, el.dataset.ctype); }); });
  }
  function mpOpenContent(id, type) {
    App.openHtmlModal('<div class="loading" style="min-height:200px"><div class="spinner"></div></div>');
    if (type === 'digital_content') {
      RM.digitalDownloadInfo({ content_id: +id }).then(function (info) {
        var files = (info && (info.files || info.data || info.curriculums)) || [];
        var h = '<div class="od"><h3>디지털 다운로드</h3>' + (files.length ? '<div class="od__items">' + files.map(function (f, i) { return '<div class="od__item"><div class="od__ph">📄</div><div style="flex:1"><div class="od__name">' + esc(f.name || f.title || ('파일 ' + (i + 1))) + '</div>' + (f.size ? '<div class="od__opt">' + Math.round(f.size / 1024) + 'KB</div>' : '') + '</div><button class="btn btn--brand btn--sm" data-dl="' + i + '">다운로드</button></div>'; }).join('') + '</div>' : '<p style="color:var(--ink-2)">다운로드 가능한 파일이 없어요.</p>') + '</div>';
        App.openHtmlModal(h);
        document.querySelectorAll('[data-dl]').forEach(function (b) { b.addEventListener('click', function () { var f = files[+b.dataset.dl]; RM.digitalDownloadUrl({ content_id: +id, curriculum_id: f && (f.curriculum_id || f.ID || f.id), file_id: f && (f.ID || f.id) }).then(function (rr) { var url = rr && (rr.url || rr.download_url || rr.signed_url); if (url) window.open(url, '_blank'); else App.toast('다운로드 URL을 받지 못했어요'); }).catch(function (e) { App.toast('다운로드 오류 · ' + e.message); }); }); });
      }).catch(function (e) { App.openHtmlModal('<p style="padding:30px">' + esc(e.message) + '</p>'); });
      return;
    }
    RM.contentItem(id).then(function (ci) {
      var chapters = (ci && (ci.chapters || (ci.class && ci.class.chapters))) || [];
      var h = '<div class="od"><h3>' + (type === 'offline' ? '오프라인 일정' : '강의 보기') + '</h3>';
      if (chapters.length) h += '<div class="od__chapters">' + chapters.map(function (ch) { return '<div class="od__ch"><div class="od__chtitle">' + esc(ch.title || '챕터') + '</div>' + ((ch.items || []).map(function (it) { return '<button class="od__lesson" data-media="' + esc(it.media_url || '') + '">▶ ' + esc(it.title || '강의') + (it.duration_text ? ' · ' + esc(it.duration_text) : '') + '</button>'; }).join('')) + '</div>'; }).join('') + '</div>';
      else h += '<p style="color:var(--ink-2)">' + (type === 'offline' ? '예약 일정 정보를 준비 중이에요.' : '재생할 강의를 준비 중이에요.') + '</p>';
      h += '</div>';
      App.openHtmlModal(h);
      document.querySelectorAll('[data-media]').forEach(function (b) { b.addEventListener('click', function () { var m = b.dataset.media, yt = (m.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/) || [])[1]; if (yt) App.openPreview(yt); else if (m) window.open(m, '_blank'); }); });
    }).catch(function (e) { App.openHtmlModal('<p style="padding:30px">' + esc(e.message) + '</p>'); });
  }
  function mpProfile(body, u) {
    body.innerHTML = '<div class="mp-profile">' +
      '<div class="field"><label>이름</label><div class="mp-val" data-pf="name">' + esc(u.name || u.nickname || '—') + '</div></div>' +
      '<div class="field"><label>이메일</label><div class="mp-val" data-pf="email">' + esc(u.email || '—') + '</div></div>' +
      '<div class="field"><label>연락처</label><div class="mp-val" data-pf="phone">' + esc(u.phone || u.user_phone || '—') + '</div></div>' +
      '<p style="color:var(--ink-3);font-size:13px;margin-top:14px">정보는 Schoolmoa 계정에서 관리됩니다.</p></div>';
    RM.profile().then(function (p) { var set = function (k, v) { var el = body.querySelector('[data-pf="' + k + '"]'); if (el && v) el.textContent = v; }; set('name', p.name); set('email', p.email); set('phone', p.phone); }).catch(function () {});
  }

  // ── COMMUNITY (live runmoa boards: read + member write to the site DB) ─────
  var _cmBoards = null;
  function cmF(o, keys, dflt) { for (var i = 0; i < keys.length; i++) { if (o && o[keys[i]] != null && o[keys[i]] !== '') return o[keys[i]]; } return dflt; }
  function cmCanWrite(b) { return String(cmF(b, ['write'], '')) === '1' && cmF(b, ['posting_scope'], '') !== 'admin_only'; }
  function cmContent(s) { s = String(s || ''); return /<\w+[\s>]/.test(s) ? s : esc(s).replace(/\n/g, '<br>'); }

  function community(d, params) {
    var live = window.RUNMOA && window.RUNMOA.useApi && window.RM;
    if (!live) return { html: '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <span>커뮤니티</span></div><section>' + emptyBox('💬', '커뮤니티는 런모아 사이트 연동 후 이용할 수 있어요', '홈으로', '#/') + '</section></div>' };
    var desc = (d.community && d.community.desc) || ((d.brand && d.brand.name ? d.brand.name + ' ' : '') + '멤버들이 질문하고 인사이트를 나누는 공간입니다.');
    var html = '<div class="wrap"><div class="crumb"><a href="#/">홈</a> › <span>커뮤니티</span></div>' +
      '<div class="cm"><div class="cm__head"><h1 class="cm__title">커뮤니티</h1><p class="cm__sub">' + esc(desc) + '</p></div>' +
      '<div class="cm-tabs" id="cmTabs"><div class="loading"><div class="spinner"></div></div></div>' +
      '<div class="cm__body" id="cmBody"></div></div></div>';
    return { html: html, mount: function (root) { cmInit(root, params); } };
  }
  function cmInit(root, params) {
    var tabsEl = root.querySelector('#cmTabs'), bodyEl = root.querySelector('#cmBody');
    function go(boards) {
      if (!boards.length) { tabsEl.innerHTML = ''; bodyEl.innerHTML = emptyBox('💬', '아직 게시판이 없어요 — 런모아 대시보드에서 게시판을 만들어 주세요', '홈으로', '#/'); return; }
      var sel = (params && params.get('board')) || String(cmF(boards[0], ['ID', 'id'], ''));
      tabsEl.innerHTML = boards.map(function (b) {
        var id = String(cmF(b, ['ID', 'id'], '')); var pc = cmF(b, ['post_cnt'], null);
        return '<a class="cm-tab' + (id === sel ? ' active' : '') + '" href="#/community?board=' + id + '">' + esc(cmF(b, ['title'], '게시판')) + (pc != null ? ' <span class="cm-tab__n">' + pc + '</span>' : '') + '</a>';
      }).join('');
      var board = boards.find(function (b) { return String(cmF(b, ['ID', 'id'], '')) === sel; }) || boards[0];
      cmLoadPosts(bodyEl, board);
    }
    if (_cmBoards) return go(_cmBoards);
    RM.boards().then(function (bs) { _cmBoards = bs || []; go(_cmBoards); }).catch(function (e) { tabsEl.innerHTML = ''; bodyEl.innerHTML = '<p class="mp-err">게시판을 불러오지 못했어요 · ' + esc(e.message) + '</p>'; });
  }
  function cmLoadPosts(bodyEl, board) {
    var id = cmF(board, ['ID', 'id'], '');
    var writeBtn = cmCanWrite(board) ? '<button class="btn btn--brand btn--sm" id="cmWrite">✎ 글쓰기</button>' : '<span class="cm-note">관리자 전용 게시판이에요</span>';
    bodyEl.innerHTML = '<div class="cm-bar">' + writeBtn + '</div><div id="cmList"><div class="loading"><div class="spinner"></div></div></div>';
    var wb = bodyEl.querySelector('#cmWrite'); if (wb) wb.addEventListener('click', function () { cmWriteForm(board); });
    RM.boardPosts(id, 1).then(function (res) {
      var posts = (res && res.data) || [], listEl = bodyEl.querySelector('#cmList');
      if (!posts.length) { listEl.innerHTML = emptyBox('📝', cmCanWrite(board) ? '첫 글을 남겨보세요' : '아직 게시글이 없어요'); return; }
      listEl.innerHTML = '<ul class="cm-posts">' + posts.map(cmPostRow).join('') + '</ul>';
      listEl.querySelectorAll('[data-post]').forEach(function (el) { el.addEventListener('click', function () { cmPostDetail(el.dataset.post, board); }); });
    }).catch(function (e) { bodyEl.querySelector('#cmList').innerHTML = '<p class="mp-err">' + esc(e.message) + '</p>'; });
  }
  function cmPostRow(p) {
    var id = cmF(p, ['ID', 'id', 'post_id'], '');
    var cc = cmF(p, ['comment_cnt', 'comment_count', 'comments_count'], null);
    var views = cmF(p, ['view', 'view_cnt', 'hit', 'views'], null);
    var date = cmF(p, ['created_at', 'reg_date', 'date', 'created'], '');
    return '<li class="cm-post" data-post="' + esc(id) + '" tabindex="0" role="button">' +
      '<div class="cm-post__main"><div class="cm-post__title">' + esc(cmF(p, ['title', 'subject'], '(제목 없음)')) + (cc ? ' <span class="cm-post__cc">[' + cc + ']</span>' : '') + '</div>' +
      '<div class="cm-post__meta">' + esc(cmF(p, ['user_name', 'author', 'writer', 'writer_name', 'nickname', 'member_name'], '익명')) + (date ? ' · ' + F.date(date) : '') + (views != null ? ' · 조회 ' + count(views) : '') + '</div></div>' +
      '<span class="cm-post__arrow">›</span></li>';
  }
  function cmPostDetail(postId, board) {
    App.openHtmlModal('<div class="loading" style="min-height:200px"><div class="spinner"></div></div>');
    Promise.all([RM.boardPost(postId), RM.boardComments(postId).catch(function () { return []; })]).then(function (a) {
      var p = a[0] || {}, comments = a[1] || [];
      var commentMode = cmF(p, ['comment_mode'], cmF(board, ['comment_mode'], 'flat'));
      var canReadC = p.can_read_comment !== false, canWriteC = p.can_write_comment !== false && commentMode !== 'disabled';
      var h = '<div class="cmd"><div class="cmd__head"><h3 class="cmd__title">' + esc(cmF(p, ['title', 'subject'], '(제목 없음)')) + '</h3>' +
        '<div class="cmd__meta">' + esc(cmF(p, ['user_name', 'author', 'writer', 'nickname'], '익명')) + (cmF(p, ['created_at', 'reg_date', 'date'], '') ? ' · ' + F.date(cmF(p, ['created_at', 'reg_date', 'date'], '')) : '') + '</div></div>' +
        '<div class="cmd__content">' + cmContent(cmF(p, ['content', 'body', 'contents', 'text'], '')) + '</div>';
      if (commentMode !== 'disabled') {
        h += '<div class="cmd__comments"><h4>댓글 ' + (comments.length || 0) + '</h4>';
        if (!canReadC) h += '<p class="cm-note">로그인하면 댓글을 볼 수 있어요.</p>';
        else h += comments.length ? '<ul class="cmc">' + comments.map(cmCommentRow).join('') + '</ul>' : '<p class="cm-note">아직 댓글이 없어요.</p>';
        if (canWriteC) h += RM.isLoggedIn()
          ? '<form class="cmc-form" id="cmcForm"><textarea id="cmcInput" rows="2" placeholder="댓글을 입력하세요" required></textarea><button class="btn btn--brand btn--sm" type="submit">등록</button></form>'
          : '<button class="btn btn--ghost btn--sm" id="cmcLogin">로그인하고 댓글 쓰기</button>';
        h += '</div>';
      }
      h += '</div>';
      App.openHtmlModal(h);
      var lf = document.getElementById('cmcLogin'); if (lf) lf.addEventListener('click', function () { RM.login(); });
      var cf = document.getElementById('cmcForm');
      if (cf) cf.addEventListener('submit', function (e) {
        e.preventDefault(); var inp = document.getElementById('cmcInput'), v = inp.value.trim(); if (!v) return;
        inp.disabled = true; RM.createComment(postId, v).then(function () { App.toast('댓글을 등록했어요'); cmPostDetail(postId, board); })
          .catch(function (err) { inp.disabled = false; App.toast('댓글 오류: ' + err.message); });
      });
    }).catch(function (e) { App.openHtmlModal('<p style="padding:30px">글을 불러오지 못했어요 · ' + esc(e.message) + '</p>'); });
  }
  function cmCommentRow(c) {
    return '<li class="cmc__item"><div class="cmc__head">' + esc(cmF(c, ['user_name', 'author', 'writer', 'nickname', 'member_name'], '익명')) +
      (cmF(c, ['created_at', 'reg_date', 'date'], '') ? ' · ' + F.date(cmF(c, ['created_at', 'reg_date', 'date'], '')) : '') + '</div>' +
      '<div class="cmc__body">' + esc(cmF(c, ['content', 'body', 'text', 'comment'], '')).replace(/\n/g, '<br>') + '</div></li>';
  }
  function cmWriteForm(board) {
    if (!RM.isLoggedIn()) { App.toast('로그인이 필요해요'); RM.login(); return; }
    var id = cmF(board, ['ID', 'id'], '');
    App.openHtmlModal('<form class="cm-write" id="cmWriteForm"><h3>글쓰기 · ' + esc(cmF(board, ['title'], '')) + '</h3>' +
      '<label>제목<input id="cmwTitle" placeholder="제목을 입력하세요" maxlength="120" required></label>' +
      '<label>내용<textarea id="cmwBody" rows="8" placeholder="내용을 입력하세요" required></textarea></label>' +
      '<div class="cm-write__act"><button class="btn btn--brand" type="submit">등록</button></div></form>');
    var f = document.getElementById('cmWriteForm');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = document.getElementById('cmwTitle').value.trim(), b = document.getElementById('cmwBody').value.trim();
      if (!t || !b) return;
      var btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = '등록 중…';
      RM.createPost(id, { title: t, content: b }).then(function () {
        App.toast('글을 등록했어요'); if (App.closeModal) App.closeModal();
        _cmBoards = null; location.hash = '#/community?board=' + id; if (window.Router) Router.render();
      }).catch(function (err) { btn.disabled = false; btn.textContent = '등록'; App.toast('등록 오류: ' + err.message); });
    });
  }

  return {
    home: home, courses: courses, course: course, store: store, product: product,
    membership: membership, coaching: coaching, mypage: mypage, community: community,
    cart: cart, checkout: checkout, done: done, dashboard: dashboard,
    lines: lines, wireLines: wireLines,
  };
})();
