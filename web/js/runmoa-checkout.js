// runmoa Storefront checkout (browser): Schoolmoa OAuth login + order + NicePay.
// Flow: login() → redirect to Schoolmoa → callback ?code → token; checkout() →
// POST /orders → POST /payments/initialize → submit form_post → NicePay → return
// to our store with ?pay_success&order_id. All with the browser-safe pub key.
window.RM = (function () {
  var T = 'rm_token', U = 'rm_user';
  function cfg() { return window.RUNMOA || {}; }
  function base() { return 'https://' + cfg().siteHost + '/api/storefront/v1'; }
  function token() { try { return localStorage.getItem(T); } catch (e) { return null; } }
  function user() { try { return JSON.parse(localStorage.getItem(U) || 'null'); } catch (e) { return null; } }
  function setAuth(tok, usr) { try { localStorage.setItem(T, tok); if (usr) localStorage.setItem(U, JSON.stringify(usr)); } catch (e) {} }
  function clearAuth() { try { localStorage.removeItem(T); localStorage.removeItem(U); } catch (e) {} }
  function isLoggedIn() { return !!token(); }

  function headers(auth) {
    var h = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Runmoa-Site-Key': cfg().storefrontKey };
    if (auth !== false && token()) h['Authorization'] = 'Bearer ' + token();
    return h;
  }
  function req(path, opts) {
    opts = opts || {};
    return fetch(base() + path, { method: opts.method || 'GET', headers: headers(opts.auth), credentials: 'include', body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        return r.text().then(function (t) {
          var j; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
          if (!r.ok) {
            var msg = (j && j.message) || ('HTTP ' + r.status);
            if (j && j.errors) msg += ' · ' + JSON.stringify(j.errors).slice(0, 180);
            var err = new Error(msg); err.status = r.status; err.body = j; throw err;
          }
          return j;
        });
      });
  }
  function storeUrl() { return location.origin + location.pathname; } // callback / return target
  function cleanQuery() { try { history.replaceState({}, '', location.pathname + location.hash); } catch (e) {} }

  // ── Schoolmoa OAuth login ──
  async function login() {
    var sc = await req('/auth/schoolmoa-client', { auth: false });
    var scid = sc && sc.scid;
    if (!scid) throw new Error('Schoolmoa client id 없음');
    try { sessionStorage.setItem('rm_resume', location.hash || '#/'); } catch (e) {}
    location.href = 'https://www.runmoa.com/login/?redirect_uri=' + encodeURIComponent(storeUrl()) +
      '&client_id=' + encodeURIComponent(scid) + '&lg=kr';
  }
  // on app load: if returning from Schoolmoa with ?code, exchange for token
  async function handleLoginCallback() {
    var code = new URLSearchParams(location.search).get('code');
    if (!code || isLoggedIn()) return false;
    try {
      var res = await req('/auth/schoolmoa/callback', { method: 'POST', auth: false, body: { code: code } });
      if (res && res.token) { setAuth(res.token, res.user); cleanQuery(); return res.user || true; }
    } catch (e) { console.warn('[runmoa] login callback failed', e); }
    cleanQuery();
    return false;
  }
  async function me() { return req('/me'); }
  // normalized buyer profile from runmoa DB (autofill 주문자 정보 + order receiver)
  async function profile() {
    var r = await me();
    var u = (r && r.user) || r || {};
    return { name: u.name || u.nickname || '', email: u.email || u.user_email || '', phone: u.phone || u.user_phone || '' };
  }

  // ── checkout ──
  function orderPayload(items, receiver, total) {
    var new_data = [], old_data = [], quantities = {};
    items.forEach(function (it) {
      var qty = it.qty || 1;
      if (it.kind === 'product' && it.variantId) {
        new_data.push({ id: it.variantId, product_id: it.runmoaId, variant: { id: it.variantId },
          price: [{ base_price: it.base, sale_price: it.price, is_on_sale: it.price < it.base ? 1 : 0, currency: 'KRW' }] });
        quantities[it.variantId] = qty;
      } else if (it.optionId) {
        old_data.push({ ID: it.optionId });
      }
    });
    return { new_data: new_data, old_data: old_data, quantities: quantities, total_price: total, order_memo: '', receiver: receiver };
  }
  function submitPaymentForm(payment) {
    var f = document.createElement('form');
    f.method = payment.method || 'POST';
    f.action = payment.action;
    Object.keys(payment.fields || {}).forEach(function (k) {
      var i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = payment.fields[k]; f.appendChild(i);
    });
    document.body.appendChild(f);
    f.submit(); // navigates to NicePay; returns to redirect_url after payment
  }
  // the list response only exposes curriculum ids; the buyable option_id lives in
  // the content detail (class.curriculums[].option_id / class.default.all_options[].ID)
  async function contentOptionId(contentId) {
    var d = await req('/contents/' + contentId, { auth: false });
    var cls = (d && d.class) || {};
    var def = cls.default || {};
    var curr = cls.curriculums || def.curriculums || [];
    return (def.all_options && def.all_options[0] && def.all_options[0].ID) ||
      (curr[0] && (curr[0].option_id || curr[0].ID)) || null;
  }
  async function productVariantId(productId) {
    var d = await req('/products/' + productId, { auth: false });
    var p = (d && (d.product || d.data || d)) || {};
    p = p.product || p;
    var v = (p.variants && p.variants[0]) || (p.details && p.details.variants && p.details.variants[0]) ||
      (p.not_deleted_variants_quantity && p.not_deleted_variants_quantity[0]);
    return v && (v.variant_id || v.id);
  }
  // items + buyer → order → payment init → submit form (leaves the page)
  async function checkout(items, buyer, total, goodsName) {
    if (!isLoggedIn()) { await login(); return { redirected: true }; }
    if (!buyer.receiver_name || !buyer.phone) {
      try { var p = await profile(); buyer.receiver_name = buyer.receiver_name || p.name; buyer.phone = buyer.phone || p.phone; buyer.mail = buyer.mail || p.email; } catch (e) {}
    }
    var data = (window.Data && Data.get()) || {};
    var lines = [];
    for (var i = 0; i < items.length; i++) {
      var it = Object.assign({}, items[i]);
      // backfill ids from the current catalog (handles a stale cart)
      if (!it.runmoaId) {
        var pool = it.kind === 'product' ? (data.products || []) : (data.courses || []);
        var src = pool.find(function (x) { return x.id === it.id || x.title === it.title; });
        if (src) { it.runmoaId = src.runmoaId; it.variantId = it.variantId || src.variantId; it.optionId = it.optionId || src.optionId; if (it.base == null && src.price) it.base = src.price.base; if (it.price == null && src.price) it.price = src.price.sale || src.price.base; }
      }
      if (it.kind === 'product') {
        if (!it.variantId && it.runmoaId) { try { it.variantId = await productVariantId(it.runmoaId); } catch (e) {} }
        if (it.variantId) lines.push(it);
      } else { // course / content
        if (it.runmoaId) { try { var oid = await contentOptionId(it.runmoaId); if (oid) it.optionId = oid; } catch (e) {} }
        if (it.optionId) lines.push(it);
      }
    }
    console.log('[runmoa] checkout cart', items, '→ orderable lines', lines);
    if (!lines.length) throw new Error('주문 가능한 항목이 없어요 — 장바구니를 비우고 강의/상품을 다시 담아주세요 (멤버십/코칭은 런모아 대시보드 설정 필요)');
    var order = await req('/orders', { method: 'POST', body: orderPayload(lines, buyer, total) });
    var oid = order && order.order && (order.order.ID || order.order.id);
    if (!oid) throw new Error('주문 생성 실패');
    var pay = await req('/payments/initialize', { method: 'POST', body: {
      order_id: oid, redirect_url: storeUrl(), pay_method: 'CARD', goods_name: goodsName || '주문',
      buyer_name: buyer.receiver_name, buyer_tel: buyer.phone, buyer_mail: buyer.mail,
    } });
    if (pay && pay.payment && pay.payment.action) { submitPaymentForm(pay.payment); return { redirected: true }; }
    throw new Error('결제 초기화 실패');
  }
  // on app load: detect return from NicePay
  function paymentReturn() {
    var q = new URLSearchParams(location.search);
    if (!q.has('pay_success') && !q.has('order_id') && !q.has('error')) return null;
    var r = { success: !q.get('error') && q.get('pay_success') !== '0' && q.get('pay_success') !== 'false', orderId: q.get('order_id'), error: q.get('error') };
    cleanQuery();
    return r;
  }

  // ── My Page reads (user token) ──
  function orders(page) {
    return req('/me/orders?page=' + (page || 1) + '&limit=20').then(function (r) { return (r && (r.orders || r.data)) || []; });
  }
  function orderDetail(id) {
    return Promise.all([
      req('/me/orders/' + id).catch(function () { return null; }),
      req('/me/orders/' + id + '/details').catch(function () { return null; }),
    ]).then(function (a) { return { order: (a[0] && (a[0].order || a[0])) || {}, items: (a[1] && (a[1].items || a[1].data)) || [] }; });
  }
  function myContents(type, status) {
    return req('/me/contents/' + (type || 'all') + '/' + (status || 'all') + '?page=1&limit=50')
      .then(function (r) { return (r && (r.contents || r.data || (r.classes && r.classes.data))) || []; });
  }
  function contentCounts(type) { return req('/me/content-counts/' + (type || 'all')).catch(function () { return null; }); }
  function contentItem(id) { return req('/me/content-items/' + id); }
  function digitalDownloadUrl(body) { return req('/me/curriculums/digital-download-url', { method: 'POST', body: body }); }
  function digitalDownloadInfo(body) { return req('/me/curriculums/digital-download-info', { method: 'POST', body: body }); }
  function logoutRemote() { return req('/auth/logout', { method: 'POST' }).catch(function () {}); }

  // ── community boards (live runmoa DB: read public + member write) ──
  function boards() {
    return req('/boards?limit=50', { auth: false }).then(function (r) { return (r && r.boards && r.boards.data) || (r && r.data) || []; });
  }
  function board(id) {
    return req('/boards/' + id, { auth: false }).then(function (r) { return (r && r.board) || r; });
  }
  function boardPosts(boardId, page) {
    return req('/posts?board_id=' + boardId + '&page=' + (page || 1) + '&limit=20').then(function (r) {
      return (r && r.board_contents) || { data: [], last_page: 1 };
    });
  }
  function boardPost(postId) {
    return req('/posts/' + postId).then(function (r) { return (r && (r.post || r.board_content || r.data)) || r; });
  }
  function boardComments(postId) {
    return req('/posts/' + postId + '/comments').then(function (r) {
      return (r && ((r.comments && (r.comments.data || r.comments)) || r.data)) || [];
    });
  }
  // create needs the user token (auth on). post: board_id+title+content. comment
  // payload uses content_id (= post id), NOT post_id (per runmoa docs).
  function createPost(boardId, data) {
    return req('/posts', { method: 'POST', body: Object.assign({ board_id: boardId }, data) });
  }
  function createComment(postId, content) {
    return req('/comments', { method: 'POST', body: { content_id: postId, content: content } });
  }

  return {
    login: login, logout: function () { clearAuth(); }, logoutRemote: logoutRemote,
    isLoggedIn: isLoggedIn, user: user, me: me, profile: profile,
    handleLoginCallback: handleLoginCallback, checkout: checkout, paymentReturn: paymentReturn,
    orders: orders, orderDetail: orderDetail, myContents: myContents, contentCounts: contentCounts,
    contentItem: contentItem, digitalDownloadUrl: digitalDownloadUrl, digitalDownloadInfo: digitalDownloadInfo,
    boards: boards, board: board, boardPosts: boardPosts, boardPost: boardPost, boardComments: boardComments,
    createPost: createPost, createComment: createComment,
  };
})();
