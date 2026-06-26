// Cart + orders state, persisted to localStorage. Pub/sub for UI updates.
// Commerce engine for the storefront (works fully client-side in demo mode).
window.Store = (function () {
  var CART_KEY = 'cas_cart_v1';
  var ORDER_KEY = 'cas_orders_v1';
  var subs = [];

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  var cart = read(CART_KEY, []);
  var orders = read(ORDER_KEY, []);

  function emit() { write(CART_KEY, cart); subs.forEach(function (f) { try { f(); } catch (e) {} }); }
  function lineKey(it) { return it.kind + ':' + it.id + ':' + (it.optLabel || ''); }

  return {
    on: function (fn) { subs.push(fn); },
    cart: function () { return cart.slice(); },
    count: function () { return cart.reduce(function (s, i) { return s + i.qty; }, 0); },
    has: function (kind, id) { return cart.some(function (i) { return i.kind === kind && i.id === id; }); },

    add: function (item) {
      var it = {
        id: item.id, kind: item.kind, title: item.title,
        thumb: item.thumb || null, icon: item.icon || null, cover: item.cover,
        price: Number(item.price) || 0, base: Number(item.base || item.price) || 0,
        qty: item.qty || 1, optLabel: item.optLabel || '', shipping: !!item.shipping,
      };
      var k = lineKey(it);
      var found = cart.find(function (c) { return lineKey(c) === k; });
      if (found) found.qty += it.qty; else cart.push(it);
      emit();
    },
    setQty: function (key, qty) {
      var c = cart.find(function (i) { return lineKey(i) === key; });
      if (c) { c.qty = Math.max(1, qty); emit(); }
    },
    remove: function (key) { cart = cart.filter(function (i) { return lineKey(i) !== key; }); emit(); },
    clear: function () { cart = []; emit(); },
    keyOf: lineKey,

    subtotal: function () { return cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0); },
    baseTotal: function () { return cart.reduce(function (s, i) { return s + i.base * i.qty; }, 0); },
    discountTotal: function () { return this.baseTotal() - this.subtotal(); },
    hasShipping: function () { return cart.some(function (i) { return i.shipping; }); },

    // orders (demo). Returns the created order.
    recordOrder: function (receiver) {
      var no = 'ORD-' + new Date().getFullYear() + '-' + String(orders.length + 1).padStart(4, '0');
      var order = {
        no: no,
        at: new Date().toISOString(),
        items: cart.slice(),
        total: this.subtotal() + (this.hasShipping() ? 3000 : 0),
        receiver: receiver || {},
      };
      orders.unshift(order);
      write(ORDER_KEY, orders);
      this.clear();
      return order;
    },
    orders: function () { return orders.slice(); },
  };
})();
