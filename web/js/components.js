// Reusable view builders. Return HTML strings (composed by views.js).
window.C = (function () {
  var F = window.F;

  function priceHtml(p, opts) {
    opts = opts || {};
    if (p.free) return '<div class="price"><span class="price__free">무료</span></div>';
    var off = F.discount(p);
    if (p.onSale && p.sale != null) {
      return '<div class="price">' +
        (off ? '<span class="price__off">' + off + '%</span>' : '') +
        '<span class="price__now">' + F.won(p.sale) + '</span>' +
        '<span class="price__base">' + F.won(p.base) + '</span></div>';
    }
    return '<div class="price"><span class="price__now">' + F.won(p.base) + '</span></div>';
  }

  function badges(item) {
    var b = [];
    if (item.bestseller) b.push('<span class="badge badge--best">BEST</span>');
    if (item.isNew) b.push('<span class="badge badge--new">NEW</span>');
    if (item.badge === 'HOT') b.push('<span class="badge badge--hot">HOT</span>');
    if (item.badge === 'BEST') b.push('<span class="badge badge--best">BEST</span>');
    var off = F.discount(item.price);
    if (off >= 30) b.push('<span class="badge badge--sale">' + off + '% OFF</span>');
    return b.join('');
  }

  function courseCard(c) {
    var thumb = c.thumbnail
      ? '<div class="ccard__thumb"><img loading="lazy" alt="' + F.esc(c.title) + ' 강의 표지" src="' + F.esc(c.thumbnail) + '"><div class="ccard__badges">' + badges(c) + '</div></div>'
      : '<div class="ccard__thumb pcover g' + (c.cover != null ? c.cover : 0) + '"><div class="ccard__badges">' + badges(c) + '</div><div class="pcover__ico" aria-hidden="true">' + (c.icon || '🎓') + '</div></div>';
    return '<a class="ccard" href="#/course/' + c.id + '">' + thumb +
      '<div class="ccard__body">' +
        '<div class="ccard__cat">' + F.esc(c.category) + (c.level ? ' · ' + F.esc(c.level) : '') + '</div>' +
        '<h3 class="ccard__title">' + F.esc(c.title) + '</h3>' +
        (c.tagline || (c.outcomes && c.outcomes[0]) ? '<div class="ccard__benefit">' + F.esc(c.tagline || c.outcomes[0]) + '</div>' : '') +
        '<div class="ccard__inst">' + F.esc(c.instructor) + (c.lessons ? ' · ' + c.lessons + '개 레슨' : '') + '</div>' +
        '<div class="ccard__rate"><span class="v">★ ' + c.rating + '</span>' +
          '<span class="c">(' + F.count(c.reviews) + ')</span>' +
          '<span class="c"> · 수강생 ' + F.count(c.students) + '</span></div>' +
        '<div class="ccard__foot">' + priceHtml(c.price) + '</div>' +
      '</div></a>';
  }

  // clean line-SVG product covers by category (replaces emoji on gradient)
  var _sv = 'width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var COVER_SVG = {
    '전자책': '<svg ' + _sv + '><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    '템플릿': '<svg ' + _sv + '><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
    '리포트': '<svg ' + _sv + '><path d="M3 3v18h18"/><path d="M7 16v-4"/><path d="M12 16V8"/><path d="M17 16v-6"/></svg>',
    '굿즈': '<svg ' + _sv + '><path d="M20 12v9H4v-9"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 21V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
  };
  function coverIcon(p) { return COVER_SVG[p.category] || COVER_SVG['전자책']; }
  function productCover(p, big) {
    if (p.thumbnail) {
      return '<div class="ccard__thumb"><img loading="lazy" alt="' + F.esc(p.title) + ' 상품 이미지" src="' + F.esc(p.thumbnail) + '"></div>';
    }
    return '<div class="ccard__thumb pcover g' + (p.cover != null ? p.cover : 0) + '">' +
      '<div class="ccard__badges">' + badges(p) + '</div>' +
      '<div class="pcover__ico" aria-hidden="true">' + coverIcon(p) + '</div>' +
      (big ? '' : '<div class="pcover__tag">' + F.esc(p.category) + '</div>') +
      '</div>';
  }

  function productCard(p) {
    return '<a class="ccard" href="#/product/' + p.id + '">' +
      productCover(p) +
      '<div class="ccard__body">' +
        '<div class="ccard__cat">' + F.esc(p.category) +
          (p.requiresShipping ? ' · 배송상품' : ' · 디지털') + '</div>' +
        '<h3 class="ccard__title">' + F.esc(p.title) + '</h3>' +
        '<div class="ccard__rate"><span class="v">★ ' + p.rating + '</span>' +
          '<span class="c">(' + F.count(p.reviews) + ')</span>' +
          '<span class="c"> · ' + F.count(p.sold) + '개 판매</span></div>' +
        '<div class="ccard__foot">' + priceHtml(p.price) + '</div>' +
      '</div></a>';
  }

  return { priceHtml: priceHtml, badges: badges, courseCard: courseCard, productCard: productCard, productCover: productCover };
})();
