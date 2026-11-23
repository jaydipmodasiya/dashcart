'use strict';
/* =====================================================================
   Furniture pictures – every product is drawn as a small SVG.
   furnitureSvg(type, colour)  ->  an <svg> string.
   The backend only sends the type ("sofa", "bed" ...) and a colour,
   so adding a new product needs no image files at all.
   ===================================================================== */
const FURNITURE_ICONS = (() => {
  const LEG = '#4b3a2c';
  // small drawing helpers
  const rect = (x, y, w, h, r, fill, op) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${op ? ` fill-opacity="${op}"` : ''}/>`;
  const dark = (x, y, w, h, r, a = .14) => rect(x, y, w, h, r, '#000', a);   // darker overlay
  const light = (x, y, w, h, r, a = .16) => rect(x, y, w, h, r, '#fff', a);  // lighter overlay
  const line = (x1, y1, x2, y2, stroke, w) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;

  const sofa = (c, seats) => {
    const w = seats === 3 ? 88 : 64, x = (120 - w) / 2;
    const splits = seats === 3 ? [48, 72] : [60];
    return rect(x + 8, 20, w - 16, 36, 12, c) + dark(x + 8, 20, w - 16, 36, 12, .1) +
      rect(x - 10, 38, 22, 34, 9, c) + dark(x - 10, 38, 22, 34, 9, .18) +
      rect(x + w - 12, 38, 22, 34, 9, c) + dark(x + w - 12, 38, 22, 34, 9, .18) +
      rect(x + 10, 46, w - 20, 22, 7, c) + light(x + 10, 46, w - 20, 22, 7) +
      splits.map(sx => line(sx, 48, sx, 67, '#000', 1.4).replace('<line', '<line opacity=".18"')).join('') +
      rect(x - 2, 72, 5, 9, 2, LEG) + rect(x + w - 3, 72, 5, 9, 2, LEG);
  };

  const armchair = c =>
    rect(30, 16, 60, 42, 15, c) + dark(30, 16, 60, 42, 15, .1) +
    rect(20, 38, 20, 34, 9, c) + dark(20, 38, 20, 34, 9, .18) +
    rect(80, 38, 20, 34, 9, c) + dark(80, 38, 20, 34, 9, .18) +
    rect(34, 48, 52, 22, 7, c) + light(34, 48, 52, 22, 7) +
    rect(28, 72, 5, 9, 2, LEG) + rect(87, 72, 5, 9, 2, LEG);

  const bedBase = (c, blanket) =>
    rect(10, 16, 9, 56, 3, c) + dark(10, 16, 9, 56, 3, .12) +                       // headboard
    rect(10, 52, 100, 14, 3, c) +                                                   // frame
    rect(18, 40, 92, 15, 6, '#f3efe8') +                                            // mattress
    rect(22, 31, 24, 11, 5.5, '#ffffff') +                                          // pillow
    rect(50, 40, 60, 15, 6, blanket) + dark(50, 40, 60, 15, 6, .06) +               // blanket
    rect(12, 66, 5, 10, 2, LEG) + rect(103, 66, 5, 10, 2, LEG);

  const icons = {
    sofa: c => sofa(c, 3),
    sofa2: c => sofa(c, 2),

    lsofa: c =>
      rect(8, 22, 104, 32, 11, c) + dark(8, 22, 104, 32, 11, .1) +
      rect(2, 38, 18, 34, 9, c) + dark(2, 38, 18, 34, 9, .18) +
      rect(18, 46, 62, 22, 7, c) + light(18, 46, 62, 22, 7) +
      rect(80, 46, 32, 34, 8, c) + light(80, 46, 32, 34, 8, .1) +
      line(49, 48, 49, 67, '#000', 1.4).replace('<line', '<line opacity=".18"') +
      rect(10, 72, 5, 9, 2, LEG) + rect(103, 76, 5, 6, 2, LEG),

    armchair,

    chair: c =>
      rect(40, 8, 40, 38, 6, c) + dark(40, 8, 40, 38, 6, .1) +
      [48, 58, 68].map(x => rect(x, 12, 4, 30, 2, '#000', .14)).join('') +
      rect(34, 46, 52, 10, 4, c) + light(34, 46, 52, 10, 4) +
      rect(37, 56, 6, 25, 2, c) + dark(37, 56, 6, 25, 2, .25) +
      rect(77, 56, 6, 25, 2, c) + dark(77, 56, 6, 25, 2, .25),

    officechair: c =>
      rect(40, 5, 40, 38, 13, c) + light(46, 11, 28, 26, 9, .12) +
      rect(34, 46, 52, 11, 6, c) + light(34, 46, 52, 11, 6, .1) +
      rect(56, 57, 8, 16, 2, '#7b8794') +
      line(32, 76, 88, 76, '#7b8794', 5) + line(60, 70, 60, 76, '#7b8794', 5) +
      '<circle cx="34" cy="80" r="3.5" fill="#222"/><circle cx="60" cy="80" r="3.5" fill="#222"/><circle cx="86" cy="80" r="3.5" fill="#222"/>',

    rocker: c =>
      rect(40, 6, 40, 36, 6, c) + dark(40, 6, 40, 36, 6, .1) +
      [48, 58, 68].map(x => rect(x, 10, 4, 28, 2, '#000', .14)).join('') +
      rect(34, 44, 52, 10, 4, c) + light(34, 44, 52, 10, 4) +
      line(40, 54, 36, 74, c, 5) + line(80, 54, 84, 74, c, 5) +
      `<path d="M20 76 Q60 92 100 76" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`,

    bed: c => bedBase(c, '#9db8d2'),

    trundle: c =>
      rect(10, 12, 9, 50, 3, c) + dark(10, 12, 9, 50, 3, .12) +
      rect(10, 44, 88, 12, 3, c) +
      rect(18, 33, 80, 13, 6, '#f3efe8') + rect(22, 25, 22, 10, 5, '#fff') +
      rect(48, 33, 50, 13, 6, '#e6b99a') + dark(48, 33, 50, 13, 6, .05) +
      rect(30, 62, 84, 9, 3, c) + dark(30, 62, 84, 9, 3, .2) +                     // pulled-out trundle
      rect(34, 56, 76, 8, 4, '#f3efe8') + rect(70, 56, 40, 8, 4, '#e6b99a') +
      '<circle cx="38" cy="75" r="3.2" fill="#222"/><circle cx="106" cy="75" r="3.2" fill="#222"/>' +
      rect(12, 56, 5, 14, 2, LEG) + rect(90, 56, 5, 14, 2, LEG),

    canopy: c =>
      rect(10, 4, 5, 74, 2, c) + rect(105, 4, 5, 74, 2, c) +
      rect(10, 4, 100, 5, 2, c) +
      rect(15, 9, 16, 40, 5, '#fff', .75) + rect(89, 9, 16, 40, 5, '#fff', .75) +
      rect(15, 9, 100 - 15 - 15, 7, 3, '#fff', .55) +
      rect(15, 52, 90, 12, 3, c) + rect(18, 42, 84, 13, 6, '#f3efe8') +
      rect(22, 34, 22, 10, 5, '#fff') + rect(50, 42, 52, 13, 6, '#c9a0b4'),

    dining: c =>
      rect(6, 30, 108, 9, 3, c) + light(6, 30, 108, 3, 2, .2) +
      rect(14, 39, 92, 5, 2, c) + dark(14, 39, 92, 5, 2, .22) +
      rect(14, 44, 7, 37, 2, c) + dark(14, 44, 7, 37, 2, .22) +
      rect(99, 44, 7, 37, 2, c) + dark(99, 44, 7, 37, 2, .22) +
      rect(32, 44, 5, 33, 2, c) + dark(32, 44, 5, 33, 2, .38) +
      rect(83, 44, 5, 33, 2, c) + dark(83, 44, 5, 33, 2, .38),

    coffee: c =>
      '<ellipse cx="60" cy="49" rx="46" ry="11" fill="#000" opacity=".22"/>' +
      `<ellipse cx="60" cy="46" rx="46" ry="11" fill="${c}"/>` +
      '<ellipse cx="60" cy="44" rx="38" ry="8" fill="#fff" opacity=".16"/>' +
      line(30, 54, 24, 78, c, 6) + line(90, 54, 96, 78, c, 6) + line(60, 58, 60, 80, c, 6),

    desk: c =>
      rect(62, 6, 44, 4, 2, c) + rect(64, 10, 4, 22, 1, c) + rect(100, 10, 4, 22, 1, c) +   // shelf
      rect(8, 32, 104, 8, 3, c) + light(8, 32, 104, 3, 2, .2) +
      rect(12, 40, 30, 40, 3, c) + dark(12, 40, 30, 40, 3, .16) +
      [44, 56, 68].map(y => rect(16, y, 22, 9, 2, '#fff', .2) + `<circle cx="27" cy="${y + 4.5}" r="1.6" fill="#000" opacity=".4"/>`).join('') +
      rect(100, 40, 6, 40, 2, c) + dark(100, 40, 6, 40, 2, .22),

    sidetable: c =>
      rect(30, 30, 60, 8, 3, c) + light(30, 30, 60, 3, 2, .2) +
      rect(34, 38, 52, 22, 3, c) + dark(34, 38, 52, 22, 3, .16) +
      rect(40, 42, 40, 14, 2, '#fff', .2) + '<circle cx="60" cy="49" r="2" fill="#000" opacity=".45"/>' +
      rect(36, 60, 6, 21, 2, c) + dark(36, 60, 6, 21, 2, .25) + rect(78, 60, 6, 21, 2, c) + dark(78, 60, 6, 21, 2, .25),

    footstool: c =>
      rect(30, 38, 60, 28, 13, c) + dark(30, 38, 60, 28, 13, .15) +
      `<ellipse cx="60" cy="40" rx="30" ry="8" fill="${c}"/><ellipse cx="60" cy="39" rx="24" ry="5" fill="#fff" opacity=".2"/>` +
      rect(38, 64, 5, 15, 2, LEG) + rect(77, 64, 5, 15, 2, LEG),

    bench: c =>
      rect(12, 32, 96, 14, 7, c) + light(12, 32, 96, 14, 7, .22) +
      [32, 60, 88].map(x => `<circle cx="${x}" cy="39" r="1.8" fill="#000" opacity=".3"/>`).join('') +
      rect(14, 46, 92, 24, 5, c) + dark(14, 46, 92, 24, 5, .16) +
      line(60, 46, 60, 70, '#000', 1.2).replace('<line', '<line opacity=".2"') +
      rect(18, 70, 6, 10, 2, LEG) + rect(96, 70, 6, 10, 2, LEG),

    pouf: c =>
      rect(30, 30, 60, 46, 20, c) + dark(30, 30, 60, 46, 20, .1) +
      `<ellipse cx="60" cy="32" rx="30" ry="9" fill="${c}"/><ellipse cx="60" cy="31" rx="24" ry="6" fill="#fff" opacity=".2"/>` +
      [42, 52, 62, 72].map(y => `<path d="M32 ${y} Q60 ${y + 8} 88 ${y}" stroke="#fff" stroke-opacity=".28" stroke-width="2" fill="none"/>`).join(''),

    shoerack: c => {
      const shoe = (x, y, col) => rect(x, y - 8, 15, 8, 4, col);
      return rect(20, 12, 5, 68, 2, c) + rect(95, 12, 5, 68, 2, c) +
        [30, 50, 70].map(y => rect(20, y, 80, 4, 2, c) + dark(20, y, 80, 4, 2, .2)).join('') +
        [[30, 26], [30, 46], [30, 66]].map(([x, y], i) =>
          shoe(30, y, ['#d96c6c', '#6c8fd9', '#f0c24b'][i]) + shoe(50, y, ['#555', '#e8e8e8', '#7bbf8e'][i]) +
          shoe(70, y, ['#f0c24b', '#d96c6c', '#6c8fd9'][i])).join('');
    },

    shoecabinet: c =>
      rect(26, 8, 68, 70, 4, c) + dark(26, 8, 68, 70, 4, .1) +
      [12, 33, 54].map(y => rect(30, y, 60, 19, 3, '#fff', .18) + rect(30, y, 60, 19, 3, '#000', .06) +
        line(52, y + 14, 68, y + 14, '#000', 2).replace('<line', '<line opacity=".35"')).join('') +
      rect(32, 78, 5, 5, 1, LEG) + rect(83, 78, 5, 5, 1, LEG)
  };
  return icons;
})();

/** Returns an inline <svg> for a product. Unknown types fall back to a simple box. */
function furnitureSvg(type, colour) {
  const draw = FURNITURE_ICONS[type] || (c => `<rect x="25" y="25" width="70" height="45" rx="6" fill="${c}"/>`);
  const c = /^#[0-9a-fA-F]{6}$/.test(colour) ? colour : '#a47148';
  return `<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">` +
    `<ellipse cx="60" cy="83" rx="48" ry="4" fill="#000" opacity=".09"/>${draw(c)}</svg>`;
}

/* =====================================================================
   UI icons (line icons), showroom pictures, the hero room and the van
   ===================================================================== */
const ICON_PATHS = {
  cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2.5 3.5h3l2.6 12.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20.5 7H6"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.4 3.3 4.2 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.800 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  locate: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8"/><path d="M12 1.500v3M12 19.500v3M1.500 12h3M19.500 12h3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  truck: '<path d="M2 6.5h11v10H2zM13 10h4.5l3.5 3.5v3H13z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  store: '<path d="M3.5 9.5 5 4h14l1.5 5.5M3.5 9.5V20h17V9.5M3.5 9.5a3 3 0 0 0 5.5 0 3 3 0 0 0 6 0 3 3 0 0 0 5.5 0"/><path d="M9.5 20v-5h5v5"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>'
};
function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

/* Which furniture drawing represents each showroom */
const SHOWROOM_ICON = { r1: ['sofa', '#3D5A80'], r2: ['bed', '#B07D4F'], r3: ['dining', '#A47148'],
                        r4: ['chair', '#8C5E3C'], r5: ['footstool', '#C97B63'], r6: ['shoerack', '#8C6A4A'] };

/* Colour and picture for each category swatch */
const CAT_STYLE = {
  'Sofas': { bg: '#D5E6DA', icon: 'sofa', color: '#3D5A80' },
  'Beds': { bg: '#F7E7BF', icon: 'bed', color: '#B07D4F' },
  'Tables': { bg: '#F3DCD3', icon: 'dining', color: '#A47148' },
  'Chairs': { bg: '#DCE3FB', icon: 'officechair', color: '#2F3640' },
  'Stools & Benches': { bg: '#E8DDF2', icon: 'bench', color: '#4A6FA5' },
  'Shoe Racks': { bg: '#DDE9E4', icon: 'shoerack', color: '#8C6A4A' }
};

/* Draw one furniture piece inside a bigger SVG scene */
function place(type, colour, x, y, w) {
  const draw = FURNITURE_ICONS[type];
  return `<svg x="${x}" y="${y}" width="${w}" height="${w * 0.75}" viewBox="0 0 120 90" overflow="visible">` +
    `<ellipse cx="60" cy="83" rx="48" ry="4" fill="#000" opacity=".09"/>${draw(colour)}</svg>`;
}

/* The hero: a cutaway of a home. Each piece is a button that opens its category. */
function roomScene() {
  const INK = '#1C2433', floorY1 = 218, floorY2 = 426;
  const drop = (i, inner) => `<g class="drop" style="--d:${(0.25 + i * 0.12).toFixed(2)}s">${inner}</g>`;
  const frame = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#fff" stroke="${INK}" stroke-width="3"/>` +
    `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" fill="${fill}"/>`;

  const walls =
    `<ellipse cx="300" cy="452" rx="290" ry="8" fill="${INK}" opacity=".1"/>` +
    `<rect x="10" y="6" width="580" height="16" rx="8" fill="${INK}"/>` +
    `<rect x="18" y="20" width="564" height="426" rx="6" fill="${INK}"/>` +
    `<rect x="28" y="30" width="352" height="198" fill="#F7E7BF"/>` +
    `<rect x="388" y="30" width="184" height="198" fill="#DCE3FB"/>` +
    `<rect x="28" y="238" width="364" height="198" fill="#D5E6DA"/>` +
    `<rect x="400" y="238" width="172" height="198" fill="#F3DCD3"/>` +
    // floors
    `<rect x="28" y="216" width="352" height="12" fill="#B98B5E"/><rect x="388" y="216" width="184" height="12" fill="#B98B5E"/>` +
    `<rect x="28" y="424" width="364" height="12" fill="#B98B5E"/><rect x="400" y="424" width="172" height="12" fill="#B98B5E"/>` +
    // rug
    `<rect x="60" y="418" width="310" height="8" rx="4" fill="#C9D1FA"/>` +
    // window
    `<rect x="244" y="48" width="84" height="88" rx="4" fill="#fff" stroke="${INK}" stroke-width="4"/>` +
    `<rect x="250" y="54" width="72" height="76" fill="#CFE0FF"/><circle cx="268" cy="74" r="10" fill="#FFB627"/>` +
    `<path d="M286 54v76M250 92h72" stroke="#fff" stroke-width="4"/>` +
    // frames
    frame(520, 52, 36, 46, '#F4B7A6') + frame(112, 262, 52, 36, '#9DB8D2') + frame(178, 268, 28, 28, '#F7E7BF') +
    // pendant lamp
    `<path d="M236 238v28" stroke="${INK}" stroke-width="3"/><path d="M214 290a22 22 0 0 1 44 0z" fill="#FFB627"/>` +
    // plant
    `<path d="M338 216c-6-24-4-44 6-58 4 18 2 40-6 58zM346 216c4-22 14-38 28-44-2 20-12 38-28 44z" fill="#4F8A5B"/>` +
    `<path d="M330 216h32l-4 -22h-24z" fill="#C97B63"/>` +
    // door
    `<rect x="508" y="300" width="52" height="126" rx="4" fill="#3A4FE0"/><rect x="516" y="310" width="36" height="46" rx="2" fill="#fff" opacity=".18"/>` +
    `<circle cx="551" cy="368" r="3.4" fill="#FFB627"/>` +
    // entry light
    `<path d="M470 252v18" stroke="${INK}" stroke-width="3"/><path d="M458 282a12 12 0 0 1 24 0z" fill="#FFB627"/>`;

  const pieces = [
    place('canopy', '#5A3E2B', 44, floorY1 - 135, 200),
    place('sidetable', '#C9A77C', 252, floorY1 - 43, 64),
    place('desk', '#8C6A4A', 398, floorY1 - 101, 150),
    place('officechair', '#2F3640', 498, floorY1 - 43, 64),
    place('lsofa', '#3D5A80', 34, floorY2 - 155, 230),
    place('coffee', '#C19A6B', 268, floorY2 - 51, 76),
    place('footstool', '#C97B63', 342, floorY2 - 35, 52),
    place('shoerack', '#8C6A4A', 410, floorY2 - 57, 84)
  ].map((p, i) => drop(i, p)).join('');

  const pins = [
    ['Sofas', 'Sofas', 150, 352, 'r'], ['Beds', 'Beds', 140, 118, 'r'], ['Tables', 'Tables', 470, 146, 'u'],
    ['Chairs', 'Chairs', 528, 186, 'u'], ['Stools & Benches', 'Stools', 368, 404, 'u'], ['Shoe Racks', 'Shoe racks', 452, 392, 'u']
  ].map(([cat, label, x, y, side], i) =>
    `<button class="pin ${side}" style="left:${(x / 6).toFixed(2)}%;top:${(y / 4.6).toFixed(2)}%;--d:${(1.5 + i * 0.1).toFixed(1)}s" ` +
    `data-act="hot" data-id="${cat}" aria-label="Shop ${label.toLowerCase()}"><i></i><span>${label}</span></button>`).join('');

  return `<div class="room-wrap"><svg class="room" viewBox="0 0 600 460" role="img" ` +
    `aria-label="Cutaway of a home furnished with a sofa, canopy bed, desk, chair, footstool and shoe rack">${walls}${pieces}</svg>${pins}</div>`;
}

/* Small drawings for the delivery tracker */
function vanSvg() {
  return `<svg viewBox="0 0 100 58" width="96" height="56" aria-hidden="true">
    <rect x="3" y="8" width="60" height="34" rx="5" fill="#3A4FE0"/>
    <path d="M63 18h17l13 13v11H63z" fill="#2B3DB8"/><path d="M70 22h9l8 9H70z" fill="#CFE0FF"/>
    <rect x="12" y="17" width="34" height="14" rx="3" fill="#fff" opacity=".22"/>
    <circle cx="22" cy="46" r="8" fill="#1C2433"/><circle cx="22" cy="46" r="3" fill="#fff"/>
    <circle cx="78" cy="46" r="8" fill="#1C2433"/><circle cx="78" cy="46" r="3" fill="#fff"/></svg>`;
}
function showroomSvg() {
  return `<svg viewBox="0 0 72 64" width="72" height="64" aria-hidden="true">
    <rect x="6" y="24" width="60" height="38" fill="#fff" stroke="#1C2433" stroke-width="3"/>
    <path d="M2 24 8 8h56l6 16z" fill="#3A4FE0" stroke="#1C2433" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 8l-2 16M36 8v16M50 8l2 16" stroke="#fff" stroke-width="3"/>
    <rect x="29" y="40" width="14" height="22" fill="#FFB627" stroke="#1C2433" stroke-width="3"/></svg>`;
}
function houseSvg() {
  return `<svg viewBox="0 0 72 64" width="72" height="64" aria-hidden="true">
    <rect x="10" y="28" width="52" height="34" fill="#F3DCD3" stroke="#1C2433" stroke-width="3"/>
    <path d="M4 30 36 6l32 24z" fill="#1C2433"/>
    <rect x="30" y="42" width="13" height="20" fill="#3A4FE0"/><rect x="16" y="36" width="10" height="10" fill="#CFE0FF" stroke="#1C2433" stroke-width="2"/>
    <rect x="48" y="36" width="10" height="10" fill="#CFE0FF" stroke="#1C2433" stroke-width="2"/></svg>`;
}
