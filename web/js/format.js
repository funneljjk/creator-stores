// Formatting + small DOM helpers (global, no modules).
window.F = (function () {
  function won(n) {
    if (n == null) return '—';
    return '₩' + Number(n).toLocaleString('ko-KR');
  }
  function count(n) {
    if (n == null) return '—';
    n = Number(n);
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억';
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + '천';
    return String(n);
  }
  function dur(sec) {
    if (sec == null) return '';
    sec = Math.round(Number(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h > 0) return h + '시간 ' + (m ? m + '분' : '');
    return m + '분 ' + (sec % 60) + '초';
  }
  function discount(p) {
    if (!p || !p.onSale || !p.sale || !p.base) return 0;
    return Math.round((1 - p.sale / p.base) * 100);
  }
  function payNow(p) { return p ? (p.sale != null && p.onSale ? p.sale : p.base) : 0; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function stars(r) {
    var full = Math.round(r);
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
  }
  function date(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return String(iso).slice(0, 10);
    return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
  }
  var ORDER_STATUS = {
    paid: { l: '결제완료', c: 'ok' }, completed: { l: '완료', c: 'ok' }, confirmed: { l: '구매확정', c: 'ok' },
    pending: { l: '결제대기', c: 'wait' }, ready: { l: '결제대기', c: 'wait' },
    shipped: { l: '배송중', c: 'ship' }, delivering: { l: '배송중', c: 'ship' }, delivered: { l: '배송완료', c: 'ok' },
    cancelled: { l: '취소', c: 'off' }, canceled: { l: '취소', c: 'off' }, refunded: { l: '환불', c: 'off' },
    returned: { l: '반품', c: 'off' }, failed: { l: '결제실패', c: 'off' }, expired: { l: '기간만료', c: 'off' },
  };
  function orderStatus(s) { return ORDER_STATUS[String(s || '').toLowerCase()] || { l: s || '—', c: 'wait' }; }
  return { won: won, count: count, dur: dur, discount: discount, payNow: payNow, esc: esc, el: el, stars: stars, date: date, orderStatus: orderStatus };
})();
