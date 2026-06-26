// Hash router. Maps #/path?query → a Views.* renderer.
window.Router = (function () {
  var view = document.getElementById('view');

  function parse() {
    var raw = location.hash.replace(/^#/, '') || '/';
    var qi = raw.indexOf('?');
    var path = qi >= 0 ? raw.slice(0, qi) : raw;
    var params = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '');
    return { path: path, parts: path.split('/').filter(Boolean), params: params };
  }

  function resolve(d, r) {
    var p = r.parts;
    if (p.length === 0) return Views.home(d);
    switch (p[0]) {
      case 'courses': return Views.courses(d, r.params);
      case 'course': return Views.course(d, p[1]);
      case 'store': return Views.store(d, r.params);
      case 'product': return Views.product(d, p[1]);
      case 'membership': return Views.membership(d);
      case 'coaching': return Views.coaching(d);
      case 'cart': return Views.cart(d);
      case 'checkout': return Views.checkout(d);
      case 'done': return Views.done(d);
      case 'mypage': return Views.mypage(d, r.params);
      case 'community': return Views.community(d, r.params);
      default: return { html: '<div class="wrap"><section style="text-align:center;padding:80px">페이지를 찾을 수 없어요</section></div>' };
    }
  }

  function render() {
    var d = window.Data.get();
    if (!d) return;
    var r = parse();
    var out = resolve(d, r);
    view.innerHTML = out.html;
    view.removeAttribute('aria-busy');
    if (out.mount) out.mount(view);
    // active nav
    document.querySelectorAll('#nav a').forEach(function (a) {
      var base = '/' + (r.parts[0] || '');
      a.classList.toggle('active', a.dataset.route === base || (base === '/' && a.dataset.route === '/'));
    });
    window.scrollTo(0, 0);
    if (window.App && App.reveal) App.reveal();
    if (window.App && App.initFeeds) App.initFeeds();
  }

  return { start: function () { window.addEventListener('hashchange', render); render(); }, render: render };
})();
