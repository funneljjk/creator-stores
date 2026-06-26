// Data source: our generated catalog (window.__PLATFORM_DATA__) for the DESIGN
// (hero/concept/why/feed/theme), with live runmoa Storefront API swapped in for
// the COMMERCE (강의=contents, 상품=products) when configured. Checkout uses the
// carried runmoa ids (runmoaId / optionId / variantId).
window.Data = (function () {
  var cfg = window.RUNMOA || {};
  var cache = null;

  var num = function (v) { return v == null ? null : parseFloat(String(v)); };
  function uniq(a) { var s = {}, o = []; a.forEach(function (x) { if (x && !s[x]) { s[x] = 1; o.push(x); } }); return o; }

  // image: contents → img.data[0].src ; products → details.main_image.image_url.data[0].src
  function imgOf(o) {
    try { if (o.img && o.img.data && o.img.data[0]) return o.img.data[0].src; } catch (e) {}
    try { return o.details.main_image.image_url.data[0].src; } catch (e) {}
    return '';
  }
  function contentPrice(c) {
    var o = (c.all_options && c.all_options[0]) || null;
    if (o) { var b = num(o.price) || num(o.base_price) || 0, s = num(o.sale_price); var on = !!o.is_on_sale && s > 0 && s < b; return { base: b, sale: on ? s : null, onSale: on, free: b === 0 }; }
    var p = num(c.price) || 0; return { base: p, sale: null, onSale: false, free: p === 0 };
  }
  function productPrice(p) {
    var pr = (p.details && p.details.price && p.details.price[0]) || {};
    var b = num(pr.base_price) || 0, s = num(pr.sale_price); var on = !!pr.is_on_sale && s > 0 && s < b;
    return { base: b, sale: on ? s : null, onSale: on, free: b === 0 };
  }
  function optionIdOf(c) {
    try { if (c.all_options && c.all_options[0]) return c.all_options[0].ID; } catch (e) {}
    try { var a = typeof c.curriculums === 'string' ? JSON.parse(c.curriculums) : c.curriculums; if (a && a.length) return a[0]; } catch (e) {}
    return null;
  }
  var notTest = function (t) { return (t || '').indexOf('연동테스트') < 0 && (t || '').indexOf('[테스트]') < 0; };
  function dedupe(arr) { var seen = {}; return arr.filter(function (x) { if (seen[x.title]) return false; seen[x.title] = 1; return true; }); }

  async function fetchCommerce(brandName) {
    var base = 'https://' + cfg.siteHost + '/api/storefront/v1';
    var host = cfg.siteHost;
    var h = { Accept: 'application/json', 'X-Runmoa-Site-Key': cfg.storefrontKey };
    var j = function (p) { return fetch(base + p, { headers: h, credentials: 'include' }).then(function (r) { return r.json(); }); };
    // pull ALL pages (catalog pages need everything; home just slices a few)
    async function allPages(pathBase, listFn) {
      var out = [], page = 1, last = 1;
      do {
        var raw = await j(pathBase + (pathBase.indexOf('?') >= 0 ? '&' : '?') + 'page=' + page + '&limit=' + (cfg.limit || 24));
        var env = (raw && (raw.classes || raw.products)) || {};
        out = out.concat(listFn(raw) || []);
        last = env.last_page || (raw && raw.pagination && raw.pagination.last_page) || page;
        page++;
      } while (page <= last && page <= 25);
      return out;
    }
    // ALL content types (vod / offline / live / digital_content), not just vod
    var cItems = await allPages('/contents', function (r) { return (r.classes && r.classes.data) || r.data || []; });
    var pItems = await allPages('/products', function (r) { return (r.products && r.products.data) || r.data || []; });
    var CTL = { vod: '강의', offline: '오프라인', live: '라이브', digital_content: '디지털' };

    var courses = cItems.filter(function (c) { return notTest(c.title); }).map(function (c) {
      var lessons = 8; try { var cu = typeof c.curriculums === 'string' ? JSON.parse(c.curriculums) : c.curriculums; if (cu && cu.length) lessons = cu.length; } catch (e) {}
      return {
        id: 'c_' + c.ID, runmoaId: c.ID, optionId: optionIdOf(c), kind: 'course', contentType: c.type || 'vod',
        title: c.title || '', thumbnail: imgOf(c), category: CTL[c.type] || '강의', level: '입문', lessons: lessons,
        rating: c.average_rating ? Number(c.average_rating) : 4.8, reviews: c.review_count || 0, students: c.view || 0,
        price: contentPrice(c), instructor: brandName || 'Creator',
        url: 'https://' + host + '/classes/' + c.ID,   // runmoa class page (real checkout)
      };
    });
    var products = pItems.filter(function (p) { return notTest((p.details && p.details.translation && p.details.translation.name) || p.title); }).map(function (p, i) {
      var name = (p.details && p.details.translation && p.details.translation.name) || p.title || '';
      var variantId = null; try { variantId = p.details.variants[0].variant_id; } catch (e) {}
      return {
        id: 'p_' + p.ID, runmoaId: p.ID, variantId: variantId, kind: 'product',
        title: name, thumbnail: imgOf(p), category: '상품', cover: i % 6, icon: '📦',
        rating: p.average_rating ? Number(p.average_rating) : 4.8, reviews: p.review_count || 0, sold: 0,
        requiresShipping: !!p.enable_shipping, price: productPrice(p), options: [],
        url: 'https://' + host + '/products/' + p.ID,   // runmoa product page (real checkout)
      };
    });
    return { courses: dedupe(courses), products: dedupe(products) };
  }

  function fromGlobal() {
    var d = window.__PLATFORM_DATA__;
    if (!d) throw new Error('no __PLATFORM_DATA__ — run create-api-home first');
    d._source = 'catalog · ' + ((d.meta && d.meta.mode) || 'generated');
    return d;
  }

  return {
    load: async function () {
      if (cache) return cache;
      var d = fromGlobal();        // our generated DESIGN (hero/concept/why/feed/theme)
      cache = d;
      // pull live config from our server if not preset (keeps pub key out of source)
      if (!cfg.useApi) {
        try { var sc = await fetch('/api/storefront-config').then(function (r) { return r.json(); }); if (sc && sc.useApi) cfg = window.RUNMOA = Object.assign({}, cfg, sc); } catch (e) {}
      }
      if (cfg.useApi && cfg.siteHost && cfg.storefrontKey) {
        try {
          var live = await fetchCommerce(d.brand && d.brand.name);
          if (live.courses.length) d.courses = live.courses;
          if (live.products.length) d.products = live.products;
          d.categories = { course: uniq(d.courses.map(function (c) { return c.category; })), product: uniq(d.products.map(function (p) { return p.category; })) };
          d.stats = Object.assign({}, d.stats, { courseCount: d.courses.length, productCount: d.products.length });
          d._source = 'runmoa Storefront (commerce) + generated design';
          d._runmoa = { siteHost: cfg.siteHost };
        } catch (e) { console.warn('[runmoa] commerce fetch failed, using generated catalog:', e); }
      }
      cache = d;
      return cache;
    },
    get: function () { return cache; },
    course: function (id) { return (cache.courses || []).find(function (c) { return c.id === id; }); },
    product: function (id) { return (cache.products || []).find(function (p) { return p.id === id; }); },
  };
})();
