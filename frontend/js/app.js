'use strict';
/* =====================================================================
   dashcart – frontend logic (plain JavaScript, no frameworks)
   Sections:  1 Helpers   2 State & API   3 Cart & saved items   4 Header
              5 Home page   6 Quick view   7 Cart drawer   8 Modals & login
              9 Checkout & payment   10 Orders & tracking   11 Router & events
   ===================================================================== */

/* ---------------------------------------------------------------- 1. Helpers */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n).toLocaleString('en-IN');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tint = c => `background:${esc(c)}26`;                 // soft background in the product's own colour

function store(key, value) {                                // safe localStorage wrapper
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key));
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { /* private mode etc. – ignore */ }
  return null;
}

let toastTimer;
function toast(msg, actLabel, act) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (actLabel ? `<button class="toast-act" data-act="${act}">${esc(actLabel)}</button>` : '');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), actLabel ? 4200 : 2800);
}

/* ---------------------------------------------------------------- 2. State & API */
const state = {
  catalog: null, pById: {}, rById: {},
  cart: store('dc_cart') || {},                // { productId: quantity }
  wish: store('dc_wish') || [],                // saved product ids
  token: store('dc_token'), user: store('dc_user'),
  category: 'All', retailer: null, search: '', sort: 'rec', onlyWish: false,
  quote: null, co: null, bump: false, loc: store('dc_loc'),
  pollTimer: null, trackStage: null, lastFocus: null
};

async function api(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    if (res.status === 401 && state.token) logout(true);
    const err = new Error((data && data.error) || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function loadCatalog() {
  state.catalog = await api('/api/catalog');
  state.pById = Object.fromEntries(state.catalog.products.map(p => [p.id, p]));
  state.rById = Object.fromEntries(state.catalog.retailers.map(r => [r.id, r]));
  for (const id of Object.keys(state.cart)) if (!state.pById[id]) delete state.cart[id];
  state.wish = state.wish.filter(id => state.pById[id]);
}

/* ---------------------------------------------------------------- 3. Cart & saved items */
const cartLines = () => Object.entries(state.cart)
  .filter(([id, q]) => state.pById[id] && q > 0)
  .map(([id, qty]) => ({ productId: id, qty }));
const cartCount = () => cartLines().reduce((n, l) => n + l.qty, 0);
const cartSubtotal = () => cartLines().reduce((s, l) => s + state.pById[l.productId].price * l.qty, 0);
const discount = p => Math.round((1 - p.price / p.mrp) * 100);

function setQty(id, qty) {
  const p = state.pById[id];
  const before = state.cart[id] || 0;
  const max = Math.min(state.catalog.rules.maxQty, p.stock);
  if (qty > max) { toast(p.stock < state.catalog.rules.maxQty ? `Only ${p.stock} left in stock` : `You can order up to ${max} of this item`); qty = max; }
  if (qty <= 0) delete state.cart[id]; else state.cart[id] = qty;
  store('dc_cart', state.cart);
  if (qty > before) {
    state.bump = true;
    if (before === 0) toast(`${p.name} added to cart`, 'View cart', 'openDrawer');
  }
  refreshCartUI();
}

function toggleWish(id) {
  const i = state.wish.indexOf(id);
  if (i >= 0) state.wish.splice(i, 1); else state.wish.push(id);
  store('dc_wish', state.wish);
  renderNav();
  if ($('#productGrid')) renderProducts();
  if ($('#qvActions')) renderQuickActions();
}

function refreshCartUI() {
  renderNav();
  if ($('#productGrid')) renderProducts();
  if ($('#drawer').classList.contains('open')) renderDrawer();
  if ($('#qvActions')) renderQuickActions();
}

/* Cart controls shared by tiles, quick view and the drawer */
function qtyControl(p, big = false) {
  const qty = state.cart[p.id] || 0;
  if (p.stock <= 0) return `<button class="add-btn" disabled>Sold out</button>`;
  if (!qty) return big
    ? `<button class="btn lg" data-act="add" data-id="${p.id}">${icon('cart', 20)} Add to cart</button>`
    : `<button class="add-btn" data-act="add" data-id="${p.id}">Add</button>`;
  return `<div class="stepper"><button data-act="dec" data-id="${p.id}" aria-label="Remove one ${esc(p.name)}">${icon('minus', 18)}</button>
    <span aria-live="polite">${qty}</span><button data-act="inc" data-id="${p.id}" aria-label="Add one ${esc(p.name)}">${icon('plus', 18)}</button></div>`;
}

/* ---------------------------------------------------------------- 4. Header */
/* ---------------------------------------------------------------- 3b. Location */
function locLabel(l) {
  if (!l) return '';
  const place = l.area || l.city;
  return place ? place + (l.pincode ? ' ' + l.pincode : '') : (l.pincode || 'Current location');
}
function renderLoc() {
  const b = $('#locBtn'); if (!b) return;
  const l = state.loc;
  b.innerHTML = `${icon('pin', 20)}<span class="loc-txt"><small>${l ? 'Delivering to' : 'Your location'}</small><b>${l ? esc(locLabel(l)) : 'Set location'}</b></span>`;
  b.setAttribute('aria-label', l ? 'Delivering to ' + locLabel(l) + '. Change location' : 'Set your delivery location');
}
function openLoc(msg = '') {
  const l = state.loc;
  openModal(`<div class="modal-head"><h2 id="locTitle">Where should we deliver?</h2>
      <button class="icon-btn" data-act="closeModal" aria-label="Close">${icon('close', 20)}</button></div>
    <p class="muted">We show showrooms that can reach you in <span class="nb">30–40 minutes</span>.</p>
    <div id="locMsg" class="loc-msg" role="status" aria-live="polite">${msg}</div>
    <button class="btn block" id="locGo" data-act="detectLoc">${icon('locate', 20)} Use my current location</button>
    ${l ? `<p class="loc-now">${icon('pin', 18)} Now: <b>${esc(locLabel(l))}</b>${l.city && l.area ? ', ' + esc(l.city) : ''}
      <button class="link-btn" data-act="clearLoc">Remove</button></p>` : ''}
    <div class="or"><span>or enter it yourself</span></div>
    <form id="locForm" novalidate>
      <div class="two"><div class="field"><label for="l_city">City</label><input id="l_city" autocomplete="address-level2" value="${esc((l && l.city) || '')}"></div>
        <div class="field"><label for="l_pin">Pincode</label><input id="l_pin" inputmode="numeric" maxlength="6" autocomplete="postal-code" value="${esc((l && l.pincode) || '')}"></div></div>
      <button class="btn alt block" type="submit">Save location</button>
    </form>`, 'loc-modal', 'locTitle');
}
function setLoc(l) {
  state.loc = l; store('dc_loc', l); renderLoc();
}
function detectLoc() {
  const msg = $('#locMsg'), go = $('#locGo');
  if (!navigator.geolocation) { msg.innerHTML = '<span class="err">This browser cannot detect location. Enter your city and pincode below.</span>'; return; }
  go.disabled = true; go.innerHTML = '<span class="spin"></span> Finding you…'; msg.textContent = '';
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    let l = { lat, lon };
    try { l = await api(`/api/geocode?lat=${lat}&lon=${lon}`); } catch (e) { /* keep coordinates */ }
    setLoc(l);
    if (state.co && state.co.step === 1) { closeModal(); fillFromLoc(); return; }
    closeModal();
    toast(l.city || l.area ? 'Delivering to ' + locLabel(l) : 'Location found (' + lat.toFixed(3) + ', ' + lon.toFixed(3) + ')');
  }, err => {
    go.disabled = false; go.innerHTML = icon('locate', 20) + ' Try again';
    const why = err.code === 1 ? 'Location permission is blocked. Allow it in your browser’s address bar, or enter your city and pincode below.'
      : err.code === 3 ? 'Finding your location took too long. Try again or enter it below.'
      : 'We could not find your location. Enter your city and pincode below.';
    msg.innerHTML = `<span class="err">${why}</span>`;
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
}
function fillFromLoc() {
  const l = state.loc; if (!l) return;
  const set = (id, v) => { if (v && $('#' + id)) $('#' + id).value = v; };
  set('c_line', l.line); set('c_city', l.city); set('c_pin', l.pincode);
  if (!l.city && !l.pincode) toast('Location found, but the address needs your input');
  else toast('Address filled from your location');
}

function renderNav() {
  renderLoc();
  const n = cartCount(), w = state.wish.length;
  const bump = state.bump; state.bump = false;
  $('#nav').innerHTML = `
    <button class="nav-btn ${state.onlyWish ? 'on' : ''}" data-act="toggleSaved" aria-pressed="${state.onlyWish}">
      ${icon('heart', 20)}<span class="nav-label">Saved${w ? ' (' + w + ')' : ''}</span></button>
    ${state.user
      ? `<a class="nav-btn" href="#/orders">${icon('truck', 20)}<span class="nav-label">Orders</span></a>
         <span class="nav-user">Hi, ${esc(state.user.name.split(' ')[0])}</span>
         <button class="nav-btn" data-act="logout" aria-label="Log out">${icon('user', 20)}<span class="nav-label">Log out</span></button>`
      : `<button class="nav-btn" data-act="login">${icon('user', 20)}<span class="nav-label">Log in</span></button>`}
    <button class="nav-btn cart-btn" data-act="openDrawer" aria-label="Open cart, ${n} item${n === 1 ? '' : 's'}">
      ${icon('cart', 20)}<span class="nav-label">Cart</span><span class="badge ${bump ? 'bump' : ''}">${n}</span></button>`;
}

/* ---------------------------------------------------------------- 5. Home page */
function viewHome() {
  const rules = state.catalog.rules;
  const maxKm = Math.max(...state.catalog.retailers.map(r => r.distanceKm));
  $('#view').innerHTML = `
    <section class="hero"><div class="wrap hero-grid">
      <div class="hero-copy">
        <h1>Furniture delivered in <span class="nb">30–40 minutes</span></h1>
        <p class="lead">Choose sofas, beds, tables and more from showrooms near you. Pay with UPI, card or EMI.</p>
        <div class="hero-cta">
          <a class="btn lg" href="#shop" data-act="scrollShop">Browse furniture</a>
          <button class="btn quiet lg" data-act="scrollRooms">Find a showroom</button>
        </div>
        <ul class="proof">
          <li>${icon('truck', 22)}<div><b>Delivered in 30–40 minutes</b><span>From a showroom within ${maxKm} km of you</span></div></li>
          <li>${icon('store', 22)}<div><b>Straight from the showroom</b><span>Your order goes to the shop that stocks the piece</span></div></li>
          <li>${icon('card', 22)}<div><b>Pay your way</b><span>Google Pay, Paytm, cards, and EMI from ${money(rules.emiMinOrder)}</span></div></li>
        </ul>
      </div>
      <div class="hero-scene">${roomScene()}<p class="scene-hint">Tap a piece in the room to shop it</p></div>
    </div></section>

    <div class="wrap">
      <div class="sec-head" id="cats"><h2>Shop by category</h2></div>
      <div class="swatches" id="swatches"></div>

      <div class="sec-head" id="rooms">
        <h2>Showrooms near you</h2>
        <p>Closer showrooms deliver sooner. Tap one to see only its furniture.</p>
      </div>
      <div class="shops" id="retailers"></div>

      <div class="toolbar" id="shop">
        <div><h2 id="resultsTitle">All furniture</h2><div class="filters" id="filters"></div></div>
        <label class="sort">Sort by
          <select id="sortSel">
            <option value="rec">Recommended</option><option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option><option value="disc">Biggest discount</option>
          </select>
        </label>
      </div>
      <div class="grid" id="productGrid"></div>
    </div>`;
  $('#sortSel').value = state.sort;
  renderCategories(); renderRetailers(); renderProducts();
}

function renderCategories() {
  $('#swatches').innerHTML = state.catalog.categories.map(c => {
    const st = CAT_STYLE[c] || { bg: '#E8EBF0', icon: 'sofa', color: '#566074' };
    const from = Math.min(...state.catalog.products.filter(p => p.category === c).map(p => p.price));
    const on = state.category === c;
    return `<button class="swatch ${on ? 'active' : ''}" data-act="cat" data-id="${esc(c)}" aria-pressed="${on}">
      <span class="sw-top" style="background:${st.bg}">${furnitureSvg(st.icon, st.color)}</span>
      <span class="sw-label"><b>${esc(c)}</b><small>From ${money(from)}</small></span></button>`;
  }).join('');
}

function renderRetailers() {
  const maxKm = 4;
  $('#retailers').innerHTML = state.catalog.retailers.map(r => {
    const [ic, col] = SHOWROOM_ICON[r.id] || ['sofa', '#566074'];
    const on = state.retailer === r.id;
    return `<button class="shop ${on ? 'active' : ''}" data-act="retailer" data-id="${r.id}" aria-pressed="${on}">
      <span class="shop-pic" style="${tint(col)}">${furnitureSvg(ic, col)}</span>
      <span><span class="shop-top"><b>${esc(r.name)}</b><span class="rate">${icon('star', 14)}${r.rating}</span></span>
        <small>${esc(r.tagline)}</small>
        <span class="dist"><span><i style="width:${Math.round(r.distanceKm / maxKm * 100)}%"></i></span>${r.distanceKm} km</span></span>
    </button>`;
  }).join('');
}

function visibleProducts() {
  const q = state.search.trim().toLowerCase();
  const list = state.catalog.products.filter(p =>
    (state.category === 'All' || p.category === state.category) &&
    (!state.retailer || p.retailerId === state.retailer) &&
    (!state.onlyWish || state.wish.includes(p.id)) &&
    (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) ||
      p.spec.toLowerCase().includes(q) || state.rById[p.retailerId].name.toLowerCase().includes(q)));
  if (state.sort === 'low') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'high') list.sort((a, b) => b.price - a.price);
  else if (state.sort === 'disc') list.sort((a, b) => discount(b) - discount(a));
  return list;
}

function filterChips() {
  const chips = [];
  if (state.category !== 'All') chips.push(['cat', state.category]);
  if (state.retailer) chips.push(['shop', state.rById[state.retailer].name]);
  if (state.search.trim()) chips.push(['search', `“${state.search.trim()}”`]);
  if (state.onlyWish) chips.push(['wish', 'Saved items']);
  return chips;
}

function renderProducts() {
  const list = visibleProducts();
  const chips = filterChips();
  $('#resultsTitle').textContent = `${chips.length ? 'Results' : 'All furniture'} (${list.length})`;
  $('#filters').innerHTML = chips.map(([k, label]) =>
    `<button class="fchip" data-act="clear" data-id="${k}" aria-label="Remove filter ${esc(label)}">${esc(label)} ${icon('close', 14)}</button>`).join('') +
    (chips.length > 1 ? `<button class="link-btn small" data-act="clear" data-id="all">Clear all</button>` : '');

  $('#productGrid').innerHTML = list.length ? list.map(p => {
    const r = state.rById[p.retailerId], saved = state.wish.includes(p.id), off = discount(p);
    return `<article class="tile ${p.stock <= 0 ? 'out' : ''}">
      <div class="tile-pic" style="${tint(p.color)}" data-act="quick" data-id="${p.id}">
        ${off > 0 ? `<span class="tag">${off}% off</span>` : ''}
        <button class="heart ${saved ? 'on' : ''}" data-act="wish" data-id="${p.id}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from' : 'Save to'} saved items">${icon('heart', 20)}</button>
        ${furnitureSvg(p.icon, p.color)}
        <div class="tile-add">${qtyControl(p)}</div>
      </div>
      <h3><button data-act="quick" data-id="${p.id}">${esc(p.name)}</button></h3>
      <p class="spec">${esc(p.spec)}</p>
      <p class="price-row"><span class="price">${money(p.price)}</span><s>${money(p.mrp)}</s></p>
      <p class="sold">${esc(r.name)}, ${r.distanceKm} km away${p.stock > 0 && p.stock <= 3 ? ` <span class="low">Only ${p.stock} left</span>` : ''}</p>
    </article>`;
  }).join('') : `<div class="empty" style="grid-column:1/-1">
      <div class="empty-art">${furnitureSvg('sofa', '#7F9487')}</div>
      <h3>${state.onlyWish ? 'Nothing saved yet' : 'No furniture matches your search'}</h3>
      <p>${state.onlyWish ? 'Tap the heart on any product to save it for later.' : 'Try a different word, or clear the filters.'}</p>
      <button class="btn" data-act="clear" data-id="all">${state.onlyWish ? 'Browse furniture' : 'Clear filters'}</button></div>`;
}

function goShop() { $('#shop')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function rerenderFilters() { renderCategories(); renderRetailers(); renderProducts(); renderNav(); }

/* ---------------------------------------------------------------- 6. Quick view */
function openQuick(id) {
  const p = state.pById[id];
  if (!p) return;
  const r = state.rById[p.retailerId];
  const emi = p.price >= state.catalog.rules.emiMinOrder ? emiEstimate(p.price) : 0;
  state.quickId = id;
  openModal(`<div class="qv">
    <div class="qv-pic" style="${tint(p.color)}">${furnitureSvg(p.icon, p.color)}</div>
    <div class="qv-info">
      <button class="icon-btn" data-act="closeModal" aria-label="Close">${icon('close', 20)}</button>
      <h2 id="qvTitle">${esc(p.name)}</h2>
      <p class="spec">${esc(p.spec)}</p>
      <div class="qv-price"><span class="price">${money(p.price)}</span><s>${money(p.mrp)}</s><span class="save">You save ${money(p.mrp - p.price)}</span></div>
      ${emi ? `<p class="qv-emi">Or pay about ${money(emi)} a month with EMI</p>` : ''}
      <ul class="facts">
        <li>${icon('truck', 20)}<span>Arrives in 30–40 minutes from ${esc(r.name)}, ${r.distanceKm} km away</span></li>
        <li>${icon('store', 20)}<span>Sold by ${esc(r.name)}, rated ${r.rating} out of 5</span></li>
        ${p.stock > 0 && p.stock <= 3 ? `<li class="warn">${icon('clock', 20)}<span>Only ${p.stock} left in stock</span></li>` : ''}
      </ul>
      <div class="qv-actions" id="qvActions"></div>
    </div></div>`, 'wide', 'qvTitle');
  renderQuickActions();
}

function renderQuickActions() {
  const p = state.pById[state.quickId];
  if (!p || !$('#qvActions')) return;
  const saved = state.wish.includes(p.id);
  $('#qvActions').innerHTML = qtyControl(p, true) +
    `<button class="heart-btn ${saved ? 'on' : ''}" data-act="wish" data-id="${p.id}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from' : 'Save to'} saved items">${icon('heart', 22)}</button>`;
}

function emiEstimate(price, months = 12) {
  const r = state.catalog.rules.emiRate / 12 / 100, f = Math.pow(1 + r, months);
  return Math.round(price * r * f / (f - 1));
}

/* ---------------------------------------------------------------- 7. Cart drawer */
let quoteSeq = 0;

function openDrawer() {
  state.lastFocus = document.activeElement;
  $('#toast').classList.remove('show');
  const d = $('#drawer');
  d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
  $('#backdrop').classList.add('show');
  renderDrawer();
  d.querySelector('.icon-btn').focus();
}
function closeDrawer() {
  const d = $('#drawer');
  if (!d.classList.contains('open')) return;
  d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
  $('#backdrop').classList.remove('show');
  if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}

function billHtml(q) {
  return `<div class="bill">
      <div class="row"><span>Items total</span><span>${money(q.subtotal)}</span></div>
      <div class="row"><span>Delivery fee</span><span>${q.deliveryFee ? money(q.deliveryFee) : '<span class="free">Free</span>'}</span></div>
      <div class="row"><span>Assembly &amp; handling</span><span>${money(q.handlingFee)}</span></div>
      <div class="row total"><span>To pay</span><span>${money(q.total)}</span></div>
    </div>
    ${q.emiEligible ? `<p class="note">EMI available, from ${money(q.emiPlans[q.emiPlans.length - 1].monthly)} a month</p>` : ''}
    <p class="note eta">${icon('clock', 18)} Estimated delivery in ${q.etaMins} minutes</p>`;
}

async function renderDrawer() {
  const lines = cartLines();
  const body = $('#drawerBody'), foot = $('#drawerFoot');
  const n = cartCount();
  $('#drawerTitle').textContent = n ? `Your cart (${n})` : 'Your cart';
  if (!lines.length) {
    body.innerHTML = `<div class="empty"><div class="empty-art">${furnitureSvg('armchair', '#D98C5F')}</div>
      <h3>Your cart is empty</h3><p>Browse sofas, beds and tables, then add what you like.</p>
      <button class="btn" data-act="browse">Browse furniture</button></div>`;
    foot.innerHTML = '';
    return;
  }
  const rules = state.catalog.rules, sub = cartSubtotal(), need = rules.freeDeliveryAbove - sub;
  const ship = `<div class="ship"><p>${need > 0
    ? `Add <b>${money(need)}</b> more to get free delivery` : `<b>You get free delivery</b> on this order`}</p>
    <div class="track-bar"><i style="width:${Math.min(100, sub / rules.freeDeliveryAbove * 100)}%"></i></div></div>`;

  const rows = lines.map(({ productId, qty }) => {
    const p = state.pById[productId];
    return `<div class="line">
      <div class="pic" style="${tint(p.color)}">${furnitureSvg(p.icon, p.color)}</div>
      <div><b>${esc(p.name)}</b><small>${esc(state.rById[p.retailerId].name)}</small>
        <div class="stepper sm"><button data-act="dec" data-id="${p.id}" aria-label="Remove one ${esc(p.name)}">${icon('minus', 16)}</button><span>${qty}</span>
          <button data-act="inc" data-id="${p.id}" aria-label="Add one ${esc(p.name)}">${icon('plus', 16)}</button></div></div>
      <div class="amt">${money(p.price * qty)}<button class="rm" data-act="remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)} from cart">${icon('trash', 18)}</button></div>
    </div>`;
  }).join('');

  body.innerHTML = ship + rows + `<div id="billBox"><div class="bill muted">Calculating your bill…</div></div>`;
  foot.innerHTML = `<button class="btn block" id="checkoutBtn" data-act="checkout" disabled>Checkout</button>`;

  const seq = ++quoteSeq;                      // ignore out-of-date answers
  try {
    const q = await api('/api/quote', 'POST', { items: lines });
    if (seq !== quoteSeq) return;
    state.quote = q;
    $('#billBox').innerHTML = billHtml(q);
    $('#checkoutBtn').disabled = false;
    $('#checkoutBtn').textContent = `Checkout, ${money(q.total)}`;
  } catch (e) {
    if (seq !== quoteSeq) return;
    state.quote = null;
    $('#billBox').innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

/* ---------------------------------------------------------------- 8. Modals & login */
function openModal(html, cls = '', labelId = '') {
  if (!$('.modal')) state.lastFocus = document.activeElement;
  $('#modalRoot').innerHTML = `<div class="modal-back" data-act="modalBack">
    <div class="modal ${cls}" role="dialog" aria-modal="true" ${labelId ? `aria-labelledby="${labelId}"` : ''} tabindex="-1">${html}</div></div>`;
  $('.modal').focus();
}
function closeModal() {
  if (!$('.modal')) return;
  $('#modalRoot').innerHTML = '';
  state.quickId = null;
  if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}
const modalHead = (title, id = 'mTitle') =>
  `<div class="modal-head"><h2 id="${id}">${title}</h2><button class="icon-btn" data-act="closeModal" aria-label="Close">${icon('close', 20)}</button></div>`;
const field = (id, label, attrs = '', value = '') =>
  `<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${esc(value)}" ${attrs}></div>`;
const val = id => ($('#' + id) ? $('#' + id).value.trim() : '');

let afterLogin = null;

function openAuth(mode = 'login', then = null) {
  afterLogin = then;
  const reg = mode === 'register';
  openModal(`${modalHead(reg ? 'Create your account' : 'Welcome back')}
    <div class="tabs">
      <button class="${reg ? '' : 'on'}" data-act="authTab" data-id="login">Log in</button>
      <button class="${reg ? 'on' : ''}" data-act="authTab" data-id="register">Register</button>
    </div>
    <form id="authForm" data-mode="${mode}" novalidate>
      <div id="authError"></div>
      ${reg ? field('a_name', 'Your name', 'autocomplete="name"') : ''}
      ${field('a_email', 'Email', 'type="email" autocomplete="email"')}
      ${field('a_pass', 'Password' + (reg ? ' (at least 6 characters)' : ''), 'type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '"')}
      <button class="btn block" type="submit">${reg ? 'Create account' : 'Log in'}</button>
    </form>`, '', 'mTitle');
  $(reg ? '#a_name' : '#a_email')?.focus();      // focus right away (a delayed focus can steal typing)
}

async function submitAuth(form) {
  const reg = form.dataset.mode === 'register';
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const body = { email: val('a_email'), password: $('#a_pass').value };
    if (reg) body.name = val('a_name');
    const res = await api(reg ? '/api/register' : '/api/login', 'POST', body);
    state.token = res.token; state.user = res.user;
    store('dc_token', state.token); store('dc_user', state.user);
    closeModal(); renderNav();
    toast(`Welcome, ${state.user.name.split(' ')[0]}`);
    const next = afterLogin; afterLogin = null;
    if (next) next(); else route();
  } catch (e) {
    $('#authError').innerHTML = `<div class="error" role="alert">${esc(e.message)}</div>`;
    btn.disabled = false;
  }
}

function logout(expired = false) {
  state.token = null; state.user = null;
  store('dc_token', null); store('dc_user', null);
  renderNav();
  if (expired) toast('Your session expired. Log in again to continue.');
  if (location.hash.startsWith('#/order')) location.hash = '#/';
}

/* ---------------------------------------------------------------- 9. Checkout & payment */
async function startCheckout() {
  if (!state.user) { openAuth('login', startCheckout); return; }
  try {
    state.quote = await api('/api/quote', 'POST', { items: cartLines() });
  } catch (e) { toast(e.message); return; }
  closeDrawer();
  state.co = { step: 1, method: 'gpay', emiMonths: 6, address: store('dc_addr') || {} };
  renderCheckout();
}

function stepsHtml(step) {
  const s = (n, label) => `<span class="s ${step === n ? 'on' : ''} ${step > n ? 'done' : ''}"><i>${step > n ? icon('check', 14) : n}</i>${label}</span>`;
  return `<div class="steps">${s(1, 'Address')}<span class="bar"></span>${s(2, 'Payment')}</div>`;
}

function summaryHtml() {
  const q = state.quote;
  return `<h3>Your order</h3>
    ${q.items.map(i => { const p = state.pById[i.productId] || i;
      return `<div class="sum-item"><span class="pic" style="${tint(p.color)}">${furnitureSvg(p.icon, p.color)}</span>
        <span>${esc(i.name)}<small>Qty ${i.qty}</small></span><b>${money(i.price * i.qty)}</b></div>`; }).join('')}
    ${billHtml(q)}`;
}

function renderCheckout() {
  const { step, address: a } = state.co;
  const q = state.quote;
  let main;
  if (step === 1) {
    main = `${modalHead('Where should we deliver?')}${stepsHtml(1)}
      <form id="addrForm" novalidate>
        <div id="coError"></div>
        <div class="two">${field('c_name', 'Full name', 'autocomplete="name"', a.name || (state.user ? state.user.name : ''))}
          ${field('c_phone', 'Mobile number', 'inputmode="numeric" maxlength="10" autocomplete="tel"', a.phone || '')}</div>
        ${field('c_line', 'Flat, street and landmark', 'autocomplete="street-address"', a.line || '')}
        <div class="two">${field('c_city', 'City', 'autocomplete="address-level2"', a.city || '')}
          ${field('c_pin', 'Pincode', 'inputmode="numeric" maxlength="6" autocomplete="postal-code"', a.pincode || '')}</div>
        <button class="btn alt block loc-use" type="button" data-act="useLocHere">${icon('locate', 20)} Use my current location</button>
        <button class="btn block" type="submit">Continue to payment</button>
      </form>`;
  } else {
    const methods = [
      ['gpay', 'gpay', 'G', 'Google Pay', 'Pay with your UPI ID', true],
      ['paytm', 'paytm', 'P', 'Paytm', 'UPI ID or Paytm mobile number', true],
      ['debit', 'card', icon('card', 20), 'Debit card', 'Visa, Mastercard, RuPay', true],
      ['credit', 'card', icon('card', 20), 'Credit card', 'Visa, Mastercard, Amex', true],
      ['emi', 'emi', '%', 'EMI', q.emiEligible ? 'Split into monthly payments on a credit card' : `Needs an order of ${money(state.catalog.rules.emiMinOrder)} or more`, q.emiEligible]
    ];
    main = `${modalHead('Choose how to pay')}${stepsHtml(2)}
      <div id="coError"></div>
      <div class="pm-list" role="radiogroup" aria-label="Payment method">${methods.map(([id, cls, ico, name, sub, ok]) => `
        <label class="pm ${state.co.method === id ? 'sel' : ''} ${ok ? '' : 'disabled'}">
          <input type="radio" name="pm" value="${id}" ${state.co.method === id ? 'checked' : ''} ${ok ? '' : 'disabled'}>
          <span class="ico ${cls}">${ico}</span><span><b>${name}</b><small>${sub}</small></span>
        </label>`).join('')}</div>
      <div id="pmFields"></div>
      <div class="demo-note"><b>Demo mode.</b> No real money is charged. Use test card 4111 1111 1111 1111 with any future expiry and any CVV.
        <button class="link-btn" type="button" data-act="fillDemo">Fill test details</button></div>
      <button class="btn block" id="payBtn" data-act="pay"></button>
      <p style="text-align:center;margin-top:12px"><button class="link-btn" data-act="backToAddress">Change address</button></p>`;
  }
  openModal(`<div class="co"><div class="co-main">${main}</div><aside class="co-sum"><div class="co-sum-in">${summaryHtml()}</div></aside></div>`, 'wide', 'mTitle');
  if (step === 2) renderPmFields();
  else $('#c_phone')?.focus();
}

function cardFields() {
  return `${field('p_card', 'Card number', 'inputmode="numeric" maxlength="23" placeholder="1234 5678 9012 3456" autocomplete="cc-number"')}
    ${field('p_cname', 'Name on card', 'autocomplete="cc-name"', state.user ? state.user.name : '')}
    <div class="two">${field('p_exp', 'Expiry (MM/YY)', 'inputmode="numeric" maxlength="5" placeholder="MM/YY" autocomplete="cc-exp"')}
      ${field('p_cvv', 'CVV', 'type="password" inputmode="numeric" maxlength="4" placeholder="•••" autocomplete="cc-csc"')}</div>`;
}

function renderPmFields() {
  const m = state.co.method, q = state.quote;
  let html = '';
  if (m === 'gpay') html = field('p_upi', 'UPI ID', 'placeholder="yourname@okhdfcbank" autocomplete="off"');
  else if (m === 'paytm') html = field('p_upi', 'UPI ID or Paytm mobile number', 'placeholder="yourname@paytm or 9876543210" autocomplete="off"');
  else if (m === 'emi') {
    html = `<div class="plans" role="radiogroup" aria-label="EMI plan">${q.emiPlans.map(p => `
      <label class="plan ${state.co.emiMonths === p.months ? 'sel' : ''}">
        <span><input type="radio" name="plan" value="${p.months}" ${state.co.emiMonths === p.months ? 'checked' : ''}>
          <span><b>${p.months} months</b><small>Interest ${money(p.interest)}, total ${money(p.payable)} at ${state.catalog.rules.emiRate}% a year</small></span></span>
        <b>${money(p.monthly)}/mo</b>
      </label>`).join('')}</div>
      <p class="small muted" style="margin-bottom:12px">EMI works with credit cards only.</p>${cardFields()}`;
  } else html = cardFields();
  $('#pmFields').innerHTML = html;
  const plan = m === 'emi' ? q.emiPlans.find(p => p.months === state.co.emiMonths) : null;
  $('#payBtn').textContent = plan ? `Pay ${money(plan.monthly)} a month for ${plan.months} months` : `Pay ${money(q.total)}`;
}

function readAddress() {
  const a = { name: val('c_name'), phone: val('c_phone'), line: val('c_line'), city: val('c_city'), pincode: val('c_pin') };
  if (a.name.length < 2) return ['Enter the name of the person receiving the order.'];
  if (!/^[6-9]\d{9}$/.test(a.phone)) return ['Enter a 10-digit mobile number that starts with 6, 7, 8 or 9.'];
  if (a.line.length < 5) return ['Enter your full address: flat, street and landmark.'];
  if (a.city.length < 2) return ['Enter your city.'];
  if (!/^\d{6}$/.test(a.pincode)) return ['Enter a 6-digit pincode.'];
  return [null, a];
}

function showCoError(msg) {
  $('#coError').innerHTML = msg ? `<div class="error" role="alert">${esc(msg)}</div>` : '';
  if (msg) $('.modal').scrollTo({ top: 0, behavior: 'smooth' });
}

async function pay() {
  const m = state.co.method;
  const payment = { method: m };
  if (m === 'gpay' || m === 'paytm') payment.upi = val('p_upi');
  else {
    payment.cardNumber = val('p_card'); payment.cardName = val('p_cname');
    payment.expiry = val('p_exp'); payment.cvv = val('p_cvv');
    if (m === 'emi') payment.emiMonths = state.co.emiMonths;
  }
  const btn = $('#payBtn');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Processing payment…'; showCoError('');
  try {
    const [order] = await Promise.all([                    // at least 1.3 s so "processing" is visible in the demo
      api('/api/orders', 'POST', { items: cartLines(), address: state.co.address, payment }),
      sleep(1300)
    ]);
    state.cart = {}; store('dc_cart', {});
    state.co = null;
    await loadCatalog();                                   // refresh stock levels
    refreshCartUI();
    const shops = groupByShop(order.items).length;
    openModal(`<div class="success">
        <div class="tick"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div>
        <h2 id="mTitle">Order confirmed</h2>
        <p>Order <b>${esc(order.id)}</b> has gone to ${shops} showroom${shops > 1 ? 's' : ''}. It arrives in about <b>${order.etaMins} minutes</b>.</p>
        <button class="btn block" data-act="trackNew" data-id="${esc(order.id)}">Track my order</button>
        <button class="btn line block" data-act="closeModal">Keep shopping</button>
      </div>`, '', 'mTitle');
  } catch (e) {
    btn.disabled = false; btn.textContent = label;
    showCoError(e.message);
    if (e.status === 409) {                                // stock changed while checking out
      closeModal(); toast(e.message);
      loadCatalog().then(() => { refreshCartUI(); openDrawer(); });
    }
  }
}

/* ---------------------------------------------------------------- 10. Orders & live tracking */
function stopPolling() { clearInterval(state.pollTimer); state.pollTimer = null; }

function groupByShop(items) {
  const g = {};
  items.forEach(i => (g[i.retailerId] = g[i.retailerId] || { name: i.retailerName, id: i.retailerId, items: [] }).items.push(i));
  return Object.values(g);
}

const loginPrompt = text => `<div class="empty"><div class="empty-art">${furnitureSvg('armchair', '#D98C5F')}</div>
  <h3>Log in to continue</h3><p>${text}</p><button class="btn" data-act="login">Log in</button></div>`;

async function viewOrders() {
  $('#view').innerHTML = `<div class="wrap page"><h1>Your orders</h1><div id="orderList"><div class="sk" style="height:110px"></div></div></div>`;
  if (!state.user) { $('#orderList').innerHTML = loginPrompt('Log in to see your orders and track deliveries.'); return; }
  try {
    const orders = await api('/api/orders');
    $('#orderList').innerHTML = orders.length ? orders.map(o => `
      <a class="order-row" href="#/order/${esc(o.id)}">
        <div>
          <b class="oid">Order ${esc(o.id)}</b><span class="status ${o.stage === 3 ? 'done' : ''}">${esc(o.stageLabel)}</span>
          <div class="small muted">${new Date(o.placedAt).toLocaleString('en-IN')}</div>
          <div class="thumbs">${o.items.slice(0, 5).map(i => `<span class="mini" style="${tint(i.color)}">${furnitureSvg(i.icon, i.color)}</span>`).join('')}</div>
        </div>
        <div class="tot">${money(o.total)}<div class="small muted" style="font-family:var(--body);font-weight:500">${o.stage === 3 ? 'Delivered' : `${o.minsLeft} min left`}</div></div>
      </a>`).join('')
      : `<div class="empty"><div class="empty-art">${furnitureSvg('sofa', '#7F9487')}</div><h3>No orders yet</h3><p>Your orders will show up here once you place one.</p><a class="btn" href="#/" data-act="browse">Browse furniture</a></div>`;
  } catch (e) { $('#orderList').innerHTML = `<div class="error">${esc(e.message)}</div>`; }
}

const roadPct = o => o.stage === 3 ? 96 : Math.min(94, Math.max(4, (1 - o.minsLeft / o.etaMins) * 100));

function trackingHtml(o) {
  const done = o.stage === 3, a = o.address, p = o.payment;
  return `<div class="wrap page">
    <a href="#/orders" class="back">${icon('back', 18)} All orders</a>
    <section class="track" data-id="${esc(o.id)}">
      <p class="t-order">Order ${esc(o.id)}</p>
      ${done ? `<h1>Delivered</h1><p class="t-sub">Your furniture has arrived. Enjoy it!</p>`
             : `<h1><span class="big-min" id="minsLeft">${o.minsLeft}</span> min left</h1><p class="t-sub" id="tSub">${esc(o.stageLabel)}. Promised within ${o.etaMins} minutes.</p>`}
      <div class="road" id="road" style="--p:${roadPct(o)}%">${showroomSvg()}<div class="lane"><div class="van">${vanSvg()}</div></div>${houseSvg()}</div>
    </section>
    <ol class="stages">${o.stages.map((s, i) =>
      `<li class="${i < o.stage || done ? 'done' : i === o.stage ? 'now' : ''}">${esc(s)}</li>`).join('')}</ol>
    <div class="cols">
      <div><h3>Items, sent by the showrooms</h3>
        ${groupByShop(o.items).map(g => { const [ic, col] = SHOWROOM_ICON[g.id] || ['sofa', '#566074']; return `<div class="group">
          <h4><span class="mini sm" style="${tint(col)}">${furnitureSvg(ic, col)}</span>${esc(g.name)}</h4>
          ${g.items.map(i => `<div class="it"><span><span class="mini sm" style="${tint(i.color)}">${furnitureSvg(i.icon, i.color)}</span>${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
        </div>`; }).join('')}
      </div>
      <div class="sheet">
        <section><h3>Bill</h3><div class="bill" style="margin-top:0">
          <div class="row"><span>Items total</span><span>${money(o.subtotal)}</span></div>
          <div class="row"><span>Delivery fee</span><span>${o.deliveryFee ? money(o.deliveryFee) : '<span class="free">Free</span>'}</span></div>
          <div class="row"><span>Assembly &amp; handling</span><span>${money(o.handlingFee)}</span></div>
          <div class="row total"><span>Total paid</span><span>${money(o.total)}</span></div></div></section>
        <section><h3>Payment</h3><p>${esc(p.label)}</p>
          ${p.emiMonths ? `<p class="small">EMI: <b>${money(p.emiAmount)}</b> a month for ${p.emiMonths} months</p>` : ''}
          <p class="small muted">Reference ${esc(p.ref)} (demo payment)</p></section>
        <section><h3>Delivering to</h3><p><b>${esc(a.name)}</b>, ${esc(a.phone)}</p>
          <p class="small muted">${esc(a.line)}, ${esc(a.city)} ${esc(a.pincode)}</p></section>
      </div>
    </div></div>`;
}

function renderTracking(o) {
  const same = $(`.track[data-id="${o.id}"]`) && state.trackStage === o.stage;
  if (same) {                                               // update in place so the van keeps gliding
    $('#road').style.setProperty('--p', roadPct(o) + '%');
    if ($('#minsLeft')) $('#minsLeft').textContent = o.minsLeft;
  } else {
    $('#view').innerHTML = trackingHtml(o);
    state.trackStage = o.stage;
  }
}

async function viewTrack(id) {
  state.trackStage = null;
  if (!state.user) { $('#view').innerHTML = `<div class="wrap page">${loginPrompt('Log in to track your order.')}</div>`; return; }
  $('#view').innerHTML = `<div class="wrap page"><div class="sk" style="height:260px"></div></div>`;
  const load = async () => {
    try {
      const o = await api('/api/orders/' + encodeURIComponent(id));
      if (location.hash !== '#/order/' + id) return;           // user navigated away
      renderTracking(o);
      if (o.stage === 3) stopPolling();
    } catch (e) {
      stopPolling();
      $('#view').innerHTML = `<div class="wrap page"><div class="error">${esc(e.message)}</div><a class="btn" href="#/orders">Back to orders</a></div>`;
    }
  };
  await load();
  if (!state.pollTimer) state.pollTimer = setInterval(load, 2000);   // live refresh
}

/* ---------------------------------------------------------------- 11. Router & events */
function route() {
  stopPolling();
  closeDrawer();
  const h = location.hash || '#/';
  if (h.startsWith('#/orders')) { window.scrollTo(0, 0); viewOrders(); }
  else if (h.startsWith('#/order/')) { window.scrollTo(0, 0); viewTrack(decodeURIComponent(h.slice(8))); }
  else if (h === '#shop' || h === '#rooms') { if (!$('#productGrid')) viewHome(); }
  else { window.scrollTo(0, 0); viewHome(); }
}

/* One click listener handles every button that has a data-act attribute */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act, id = t.dataset.id;
  if (act === 'modalBack' && e.target !== t) return;          // only the dark background closes the modal

  switch (act) {
    case 'add': setQty(id, 1); break;
    case 'inc': setQty(id, (state.cart[id] || 0) + 1); break;
    case 'dec': setQty(id, (state.cart[id] || 0) - 1); break;
    case 'remove': setQty(id, 0); break;
    case 'wish': toggleWish(id); break;
    case 'quick': openQuick(id); break;
    case 'cat': state.category = state.category === id ? 'All' : id; rerenderFilters(); goShop(); break;
    case 'hot': state.category = id; state.retailer = null; state.search = ''; state.onlyWish = false;
      if ($('#searchInput')) $('#searchInput').value = ''; rerenderFilters(); goShop(); break;
    case 'retailer': state.retailer = state.retailer === id ? null : id; rerenderFilters(); if (state.retailer) goShop(); break;
    case 'clear':
      if (id === 'cat' || id === 'all') state.category = 'All';
      if (id === 'shop' || id === 'all') state.retailer = null;
      if (id === 'search' || id === 'all') { state.search = ''; $('#searchInput').value = ''; }
      if (id === 'wish' || id === 'all') state.onlyWish = false;
      rerenderFilters(); break;
    case 'toggleSaved':
      state.onlyWish = !state.onlyWish;
      if (!$('#productGrid')) location.hash = '#/'; else { rerenderFilters(); if (state.onlyWish) goShop(); }
      break;
    case 'scrollShop': e.preventDefault(); goShop(); break;
    case 'scrollRooms': $('#rooms')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'browse': closeDrawer(); if (!$('#productGrid')) location.hash = '#/'; else goShop(); break;
    case 'openDrawer': openDrawer(); break;
    case 'closeDrawer': closeDrawer(); break;
    case 'checkout': startCheckout(); break;
    case 'login': openAuth('login'); break;
    case 'logout': logout(); toast('You are logged out'); route(); break;
    case 'authTab': openAuth(id, afterLogin); break;
    case 'closeModal': case 'modalBack': closeModal(); break;
    case 'backToAddress': state.co.step = 1; renderCheckout(); break;
    case 'pay': pay(); break;
    case 'trackNew': closeModal(); location.hash = '#/order/' + id; break;
    case 'fillDemo': fillDemo(); break;
    case 'openLoc': openLoc(); break;
    case 'detectLoc': detectLoc(); break;
    case 'clearLoc': setLoc(null); closeModal(); toast('Location removed'); break;
    case 'useLocHere': if (state.loc && state.loc.city) fillFromLoc(); else { openLoc(); } break;
  }
});

function fillDemo() {
  const set = (id, v) => { if ($('#' + id)) $('#' + id).value = v; };
  set('p_upi', state.co.method === 'paytm' ? '9876543210' : 'student@okhdfcbank');
  set('p_card', '4111 1111 1111 1111'); set('p_exp', '12/30'); set('p_cvv', '123');
}

document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'authForm') submitAuth(e.target);
  else if (e.target.id === 'locForm') {
    const city = val('l_city').trim(), pin = val('l_pin').trim();
    if (!city && !/^\d{6}$/.test(pin)) { $('#locMsg').innerHTML = '<span class="err">Enter a city or a 6-digit pincode.</span>'; return; }
    if (pin && !/^\d{6}$/.test(pin)) { $('#locMsg').innerHTML = '<span class="err">Pincode must be 6 digits.</span>'; return; }
    setLoc({ city, pincode: pin }); closeModal(); toast('Delivering to ' + locLabel(state.loc));
  } else if (e.target.id === 'addrForm') {
    const [err, a] = readAddress();
    if (err) return showCoError(err);
    state.co.address = a; store('dc_addr', a);
    state.co.step = 2; renderCheckout();
  } else if (e.target.id === 'searchForm') {
    if ($('#productGrid')) goShop(); else location.hash = '#/';
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'sortSel') { state.sort = e.target.value; renderProducts(); }
  else if (e.target.name === 'pm') {                  // payment method changed
    state.co.method = e.target.value;
    document.querySelectorAll('.pm').forEach(l => l.classList.toggle('sel', l.querySelector('input').checked));
    renderPmFields();
  } else if (e.target.name === 'plan') {              // EMI plan changed
    state.co.emiMonths = Number(e.target.value);
    document.querySelectorAll('.plan').forEach(l => l.classList.toggle('sel', l.querySelector('input').checked));
    renderPmFields();
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'searchInput') {
    state.search = e.target.value;
    if (!$('#productGrid')) { location.hash = '#/'; return; }
    renderProducts();
  } else if (e.target.id === 'p_card') {              // 1234 5678 …
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  } else if (e.target.id === 'p_exp') {               // MM/YY
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    e.target.value = v;
  } else if (['c_phone', 'c_pin', 'p_cvv'].includes(e.target.id)) {
    e.target.value = e.target.value.replace(/\D/g, '');
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('.modal')) closeModal(); else closeDrawer(); return; }
  if (e.key !== 'Tab') return;
  const box = $('.modal') || ($('#drawer').classList.contains('open') ? $('#drawer') : null);
  if (!box) return;                                    // keep keyboard focus inside the open dialog
  const f = [...box.querySelectorAll('button, [href], input, select, textarea')].filter(el => !el.disabled && el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
window.addEventListener('hashchange', route);

(async function init() {
  renderNav();
  if (location.protocol === 'file:') {         // page was double-clicked instead of opened via the server
    $('#view').innerHTML = `<div class="wrap page"><div class="error">
      <b>This page was opened as a file, so it can't reach the Java backend.</b><br><br>
      1. Start the server: run <code>run.bat</code> (Windows) or <code>./run.sh</code> (Linux/Mac).<br>
      2. Then open <b>http://localhost:8080</b> in your browser.</div></div>`;
    return;
  }
  $('#view').innerHTML = `<div class="wrap page"><div class="sk" style="height:380px;margin-bottom:28px"></div>
    <div class="grid">${'<div class="sk" style="height:260px"></div>'.repeat(4)}</div></div>`;
  try {
    await loadCatalog();
  } catch (e) {
    $('#view').innerHTML = `<div class="wrap page"><div class="error">
      <b>Could not reach the dashcart server.</b><br>Make sure the Java server window is still open and running, then refresh this page.</div></div>`;
    return;
  }
  renderNav();
  route();
})();
