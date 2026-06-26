// Boot + chrome (header, cart drawer, toast, preview modal).
window.App = (function () {
  var F = window.F, Store = window.Store;

  function fillBrand(d) {
    document.querySelectorAll('[data-brand-name]').forEach(function (n) { n.textContent = d.brand.name; });
    document.querySelectorAll('[data-brand-tagline]').forEach(function (n) { n.textContent = d.brand.tagline || ''; });
    var src = document.getElementById('srcBadge');
    if (src) src.textContent = (d._source || '') + (d.theme ? ' · 테마 ' + d.theme.name + ' (' + (d.theme.refs || []).join(' · ') + ' 영감)' : '');
    document.title = d.brand.name + ' · Creator Store';
    buildNav(d);
  }

  function buildNav(d) {
    var mods = d.modules || [];
    var size = { courses: (d.courses || []).length, store: (d.products || []).length, membership: (d.membership || []).length, coaching: (d.coaching || []).length };
    var links = [{ h: '/', l: '홈' }];
    if (mods.indexOf('courses') >= 0 && size.courses) links.push({ h: '/courses', l: '강의' });
    if ((mods.indexOf('digital') >= 0 || mods.indexOf('merch') >= 0) && size.store) links.push({ h: '/store', l: '스토어' });
    if (mods.indexOf('membership') >= 0 && size.membership) links.push({ h: '/membership', l: '멤버십' });
    if (mods.indexOf('coaching') >= 0 && size.coaching) links.push({ h: '/coaching', l: '클래스' });
    if (mods.indexOf('community') >= 0 && window.RUNMOA && window.RUNMOA.useApi) links.push({ h: '/community', l: '커뮤니티' });
    if (window.RUNMOA && window.RUNMOA.useApi) links.push({ h: '/mypage', l: '마이페이지' });
    document.getElementById('nav').innerHTML = links.map(function (a) {
      return '<a href="#' + a.h + '" data-route="' + a.h + '">' + a.l + '</a>';
    }).join('');
    var mm = document.getElementById('mmenuLinks');
    if (mm) mm.innerHTML = links.map(function (a) {
      return '<a href="#' + a.h + '" data-route="' + a.h + '" data-mclose>' + a.l + '</a>';
    }).join('');
  }

  var FT_ICON = { youtube: '▶', instagram: '📷', x: '𝕏', threads: '@', tiktok: '♪', facebook: 'f', github: '⌥', naverblog: '✍', tistory: '✍', medium: '✍', velog: '✍' };
  function renderFooter(d) {
    var b = d.brand || {}, hub = d.hub || {}, c = d.concept || {};
    var year = new Date().getFullYear();
    var socials = [];
    if (b.youtube) socials.push({ l: 'YouTube', u: b.youtube, e: '▶' });
    (hub.socials || []).forEach(function (s) { if (s.platform !== 'youtube') socials.push({ l: s.label, u: s.url, e: FT_ICON[s.platform] || '🔗' }); });
    if (hub.blog) socials.push({ l: hub.blog.label, u: hub.blog.url, e: '✍' });
    var nav = [{ h: '#/', l: '홈' }];
    if ((d.courses || []).length) nav.push({ h: '#/courses', l: '강의' });
    if ((d.products || []).length) nav.push({ h: '#/store', l: '스토어' });
    if ((d.membership || []).length) nav.push({ h: '#/membership', l: '멤버십' });
    if ((d.coaching || []).length) nav.push({ h: '#/coaching', l: '클래스' });
    if (d.community && window.RUNMOA && window.RUNMOA.useApi) nav.push({ h: '#/community', l: '커뮤니티' });
    document.getElementById('ft').innerHTML =
      '<div class="ft__top wrap">' +
        '<div class="ft__brandcol">' +
          '<div class="ft__brand">' + F.esc(b.name) + '</div>' +
          '<p class="ft__tag">' + F.esc(c.statement || b.tagline || '') + '</p>' +
          '<div class="ft__social">' + socials.map(function (s) { return '<a href="' + F.esc(s.u) + '" target="_blank" rel="noopener" title="' + F.esc(s.l) + '">' + s.e + '</a>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="ft__col"><h4>둘러보기</h4>' + nav.map(function (n) { return '<a href="' + n.h + '">' + F.esc(n.l) + '</a>'; }).join('') + '</div>' +
        '<div class="ft__col"><h4>고객지원</h4><a href="#/">자주 묻는 질문</a><a href="#/">1:1 문의</a><a href="#/">환불 정책</a><a href="#/">이용약관</a></div>' +
        '<div class="ft__news"><h4>뉴스레터 구독</h4><p>새 콘텐츠와 한정 혜택을 가장 먼저 받아보세요.</p>' +
          '<form class="ft__newsform" id="ftNews"><input type="email" placeholder="이메일 주소" aria-label="이메일"><button type="submit" class="btn btn--brand">구독</button></form>' +
          '<div class="ft__pay">안전 결제 · 카드 · 가상계좌 · 휴대폰</div></div>' +
      '</div>' +
      '<div class="ft__bottom wrap">' +
        '<span>© ' + year + ' ' + F.esc(b.name) + '. All rights reserved.</span>' +
        '<span class="ft__src">' + F.esc(d._source || '') + (d.theme ? ' · 테마 ' + F.esc(d.theme.name) + ' (' + (d.theme.refs || []).join('·') + ' 영감)' : '') + ' · Powered by runmoa</span>' +
      '</div>';
    var nf = document.getElementById('ftNews');
    if (nf) nf.addEventListener('submit', function (e) { e.preventDefault(); toast('뉴스레터 구독 완료', '✉'); this.querySelector('input').value = ''; });
  }

  function updateCart() {
    var n = Store.count();
    var badge = document.getElementById('cartBadge');
    badge.textContent = n;
    badge.hidden = n === 0;
  }

  // cart drawer
  var drawer = document.getElementById('drawer');
  function renderDrawer() {
    var body = document.getElementById('drawerBody');
    var foot = document.getElementById('drawerFoot');
    var items = Store.cart();
    if (!items.length) {
      body.innerHTML = '<div class="empty"><div class="empty__ico">🛒</div><p>장바구니가 비어 있어요</p></div>';
      foot.innerHTML = '<a class="btn btn--ghost btn--block" data-close href="#/courses">강의 둘러보기</a>';
    } else {
      body.innerHTML = Views.lines(items);
      Views.wireLines(body);
      var total = Store.subtotal() + (Store.hasShipping() ? 3000 : 0);
      foot.innerHTML =
        '<div class="sumrow sumrow--total"><span>결제 금액</span><span>' + F.won(total) + '</span></div>' +
        '<a class="btn btn--brand btn--block btn--lg" data-close href="#/checkout">결제하기</a>' +
        '<a class="btn btn--ghost btn--block" data-close href="#/cart" style="margin-top:10px">장바구니 전체보기</a>';
    }
  }
  function openDrawer() { renderDrawer(); drawer.hidden = false; document.body.style.overflow = 'hidden'; }
  function closeDrawer() { drawer.hidden = true; document.body.style.overflow = ''; }

  // preview modal
  var modal = document.getElementById('modal');
  var player = document.getElementById('modalPlayer');
  function openPreview(id, title) {
    if (!id) return;
    player.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    modal.hidden = false; document.body.style.overflow = 'hidden';
  }
  function closeModal() { modal.hidden = true; player.innerHTML = ''; document.body.style.overflow = ''; }
  // generic modal for arbitrary HTML (order detail, content player, downloads)
  function openHtmlModal(html) {
    player.innerHTML = '<div class="modal-html">' + html + '</div>';
    modal.hidden = false; document.body.style.overflow = 'hidden';
  }

  // toast
  function toast(msg, kind) {
    var box = document.getElementById('toasts');
    var t = F.el('div', 'toast', (kind ? '<b>' + F.esc(kind) + '</b> ' : '') + F.esc(msg));
    box.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; t.style.transition = '.3s'; }, 2200);
    setTimeout(function () { t.remove(); }, 2600);
  }

  function runmoaLive() { return !!(window.RUNMOA && window.RUNMOA.useApi && window.RM); }
  function updateLoginBtn() {
    var b = document.getElementById('loginBtn'); if (!b) return;
    if (runmoaLive() && RM.isLoggedIn()) { var u = RM.user() || {}; b.textContent = (u.nickname || u.name || '내 계정'); b.title = '클릭하면 로그아웃'; }
    else { b.textContent = '로그인'; b.title = '로그인'; }
  }
  function wireChrome() {
    document.getElementById('cartBtn').addEventListener('click', openDrawer);
    document.getElementById('loginBtn').addEventListener('click', function () {
      if (runmoaLive()) {
        if (RM.isLoggedIn()) { location.hash = '/mypage'; }   // → My Page (logout lives inside it)
        else { toast('Schoolmoa 로그인으로 이동합니다'); RM.login().catch(function (e) { toast('로그인 오류: ' + e.message); }); }
      } else { toast('데모 모드 · 로그인 없이 둘러볼 수 있어요'); }
    });
    document.getElementById('search').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = this.querySelector('input').value.trim();
      location.hash = '/courses' + (q ? '?q=' + encodeURIComponent(q) : '');
    });
    // mobile hamburger menu
    var mmenu = document.getElementById('mmenu');
    var burger = document.getElementById('burger');
    function openMenu() { mmenu.hidden = false; document.body.style.overflow = 'hidden'; if (burger) burger.setAttribute('aria-expanded', 'true'); requestAnimationFrame(function () { mmenu.classList.add('open'); }); }
    function closeMenu() { if (!mmenu) return; mmenu.classList.remove('open'); if (burger) burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; setTimeout(function () { mmenu.hidden = true; }, 240); }
    if (burger) burger.addEventListener('click', openMenu);
    if (mmenu) mmenu.addEventListener('click', function (e) { if (e.target.hasAttribute('data-mclose') || e.target.closest('[data-mclose]')) closeMenu(); });
    var mLogin = document.getElementById('mLogin');
    if (mLogin) mLogin.addEventListener('click', function () { closeMenu(); document.getElementById('loginBtn').click(); });

    // delegated close for drawer + modal
    [drawer, modal].forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target.hasAttribute('data-close') || e.target.closest('[data-close]')) {
          if (m === drawer) closeDrawer(); else closeModal();
        }
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeDrawer(); closeModal(); closeMenu(); }
    });
    // keyboard activation for focusable video cards (a11y)
    document.getElementById('view').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest && e.target.closest('[data-yt]');
      if (card) { e.preventDefault(); openPreview(card.dataset.yt); }
    });
    // keep drawer fresh + badge in sync on any cart change
    Store.on(function () { updateCart(); if (!drawer.hidden) renderDrawer(); if (location.hash.indexOf('/cart') >= 0 || location.hash.indexOf('/checkout') >= 0) Router.render(); });
  }

  function applyTheme(theme) {
    if (!theme) return;
    if (theme.vars) for (var k in theme.vars) document.body.style.setProperty(k, theme.vars[k]);
    document.body.setAttribute('data-theme', theme.key || 'editorial');
    document.body.classList.toggle('sans-head', !!theme.sans);
  }

  async function boot() {
    var d = await window.Data.load();
    applyTheme(d.theme);
    fillBrand(d);
    renderFooter(d);
    updateCart();
    wireChrome();
    // runmoa: finish Schoolmoa login (?code) + handle NicePay return (?pay_success)
    if (runmoaLive()) {
      try {
        if (await RM.handleLoginCallback()) toast('로그인되었어요', '✓');
        var pr = RM.paymentReturn();
        if (pr) {
          if (pr.success) { try { Store.clear(); } catch (e) {} updateCart(); toast('결제가 완료되었어요 · 주문 #' + (pr.orderId || ''), '✓'); }
          else toast('결제가 취소되었거나 실패했어요' + (pr.error ? ' · ' + pr.error : ''));
        }
      } catch (e) { console.warn('[runmoa] auth/payment handling', e); }
      updateLoginBtn();
    }
    Router.start();
  }

  // scroll-reveal: fade/slide content in. Bulletproof — above-fold reveals
  // immediately, below-fold on scroll, and a failsafe guarantees nothing ever
  // stays hidden (fast-scroll / anchor-jump safe).
  var _io = null, _failsafe = null;
  var REVEAL_SEL = '#view section, .grid > .ccard, .plans > .plan, .shorts > .short, .kpis > .kpi, .props > .prop, .igcard, .panel';
  function reveal() {
    var view = document.getElementById('view');
    var els = [].slice.call(view.querySelectorAll(REVEAL_SEL)).filter(function (el) {
      return !el.classList.contains('reveal') && !el.closest('.hero');
    });
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('reveal', 'in'); }); return; }
    if (!_io) {
      _io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); _io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    }
    var vh = window.innerHeight;
    els.forEach(function (el, i) {
      // above-fold content shows immediately (no flash); only below-fold animates in
      if (el.getBoundingClientRect().top < vh * 0.95) return;
      el.classList.add('reveal');
      el.style.transitionDelay = Math.min(i % 8, 6) * 35 + 'ms';
      _io.observe(el);
    });
    clearTimeout(_failsafe);
    _failsafe = setTimeout(function () { els.forEach(function (el) { el.classList.add('in'); }); }, 2500);
  }

  // infinite scroll: reveal more feed cards as the sentinel nears the viewport
  function initFeeds() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('#view .is-hidden').forEach(function (el) { el.classList.remove('is-hidden'); });
      return;
    }
    document.querySelectorAll('#view [data-infinite]').forEach(function (grid) {
      if (grid.__inf) return; grid.__inf = true;
      var sentinel = grid.nextElementSibling;
      if (!sentinel || !sentinel.classList.contains('feed-sentinel')) return;
      var batch = Number(grid.dataset.batch) || 8;
      var busy = false;
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting || busy) return;
        busy = true;
        var hidden = grid.querySelectorAll('.is-hidden');
        for (var i = 0; i < batch && i < hidden.length; i++) hidden[i].classList.remove('is-hidden');
        if (!grid.querySelector('.is-hidden')) { io.disconnect(); sentinel.remove(); return; }
        // throttle: keep loading smoothly while scrolling, never dump all at once
        setTimeout(function () { busy = false; }, 80);
      }, { rootMargin: '1000px 0px' });
      io.observe(sentinel);
    });
  }

  return { boot: boot, toast: toast, openPreview: openPreview, openHtmlModal: openHtmlModal, closeModal: closeModal, renderDrawer: renderDrawer, reveal: reveal, initFeeds: initFeeds };
})();

App.boot().catch(function (e) {
  console.error(e);
  document.getElementById('view').innerHTML =
    '<div class="wrap"><div class="empty" style="padding:100px 20px"><div class="empty__ico">⚠️</div>' +
    '<p>스토어 데이터를 불러오지 못했어요.<br>먼저 <code>node bin/create-api-home.js &lt;youtube-url&gt;</code> 를 실행하세요.</p></div></div>';
});
