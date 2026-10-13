'use strict';
// =====================================================================
//  Street flavor: shop signs, graffiti, people in windows, window boxes, cats, pigeons, murals...
//  Everything is painted once into the prerendered building / alley canvases (buildScenery calls
//  addBuildingFlavor / addAlleyFlavor). Lights that come on at night go into a second canvas (c.lit).
//  All art here is drawn from code; only the villager sprites in windows are third-party (MiniFolks).
// =====================================================================

const VILLAGERS = ['nobleman', 'oldman', 'oldwoman', 'peasant', 'princess', 'queen', 'villagerman', 'villagerwoman', 'worker'];
const ROOF_PAD = 16;     // transparent strip above each building for rooftop pigeons and antennas

// 3x5 pixel font
const FONT3 = (() => {
  const g = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', '&': '010101010101011', '!': '010010010000010', '-': '000000111000000', '.': '000000000000010',
    ' ': '000000000000000', "'": '010010000000000', '#': '101111101111101',
  };
  return g;
})();
const textW = (s, k) => (s.length * 4 - 1) * k;
function drawText(x, s, X, Y, k, col) {
  x.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const gl = FONT3[s[i]]; if (!gl) continue;
    for (let j = 0; j < 15; j++) if (gl[j] === '1') x.fillRect(X + (i * 4 + j % 3) * k, Y + Math.floor(j / 3) * k, k, k);
  }
}
function drawSprite(x, rows, pal, X, Y, flip = false) {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const col = pal[r[i]]; if (!col) continue; x.fillStyle = col; x.fillRect(X + (flip ? r.length - 1 - i : i), Y + j, 1, 1); } });
}
const R_ = (x, X, Y, w, h, col) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };

// ---- tiny sprites ----
const SPR = {
  heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  paw: ['..p.p..', 'p.p.p.p', 'p.p.p.p', '.ppppp.', '..ppp..'],
  bone: ['ww...ww', 'wwwwwww', 'wwwwwww', 'ww...ww'],
  smile: ['.yyyyy.', 'yyyyyyy', 'yk.y.ky', 'yyyyyyy', 'yk...ky', '.ykkky.', '..yyy..'],
  star: ['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '..y.y..', '.y...y.'],
  pigeon: ['....dd...', '...dpdey.', '..dbppb..', 'dbbbbbbb.', '.dbbbbd..', '..dbbd...', '...y.y...'],
  cat: ['..........d.d', '....oooooooood', '..oooooooooooo', '.ooooooooooooo', 'oooooooooooooo', 'dooooooooooood'],
  cup: ['..s.s..', 'wwwwww.', 'wwwwwwo', 'wwwwwwo', '.wwww..'],
  key: ['.yyy...', 'y...y..', 'y...yyyy', '.yyy.y.y', '.....y.y'],
  fish: ['..bbb...b', '.bbbbb.bb', 'bkbbbbbbb', '.bbbbb.bb', '..bbb...b'],
  tooth: ['.www.www.', 'wwwwwwwww', 'wwwwwwwww', '.www.www.', '.ww...ww.'],
  scissors: ['r.....r', '.r...r.', '..r.r..', '...r...', '..r.r..', '.rr.rr.'],
  loaf: ['..oo..', '.oooo.', 'oooooo', 'oooooo'],
  pot: ['.g.g.', 'ggggg', '.ggg.', 'bbbbb', '.bbb.'],
};
function sprW(rows) { return rows[0].length; }

const SIGN_PAL = [['#f4e8c8', '#8a2a2a'], ['#1f3b2e', '#f4e8c8'], ['#1c2850', '#ffd860'], ['#2a2a2e', '#ffd860'], ['#7a2438', '#fff0d0'],
  ['#2e6a78', '#ffffff'], ['#f0c850', '#3a2a20'], ['#e8e0d0', '#1c2850'], ['#c8d8a8', '#2a4a2a'], ['#d8584a', '#fff4e0']];
const SHOP_NAMES = {
  downtown: ['DELI', 'BAKERY', 'PIZZA', 'CAFE', 'BOOKS', 'NAILS', 'TACOS', 'HARDWARE', 'LAUNDRY', 'PETS', 'BARK & BREW', 'SQUIRREL WATCH', 'NOODLES', 'DONUTS', 'TOYS', 'FLOWERS', 'TREAT SHOP', 'DOG WASH'],
  suburbs: ['BAKERY', 'FLORIST', 'PETS', 'CAFE', 'GIFTS', 'TOYS', 'BOOKS', 'ICE CREAM', 'DOG SPA', 'FARM STAND', 'BARK & BREW', 'FRESH PIES', 'FUDGE', 'KITES'],
  brick: ['PUB', 'DELI', 'TAILOR', 'BOOKS', 'NOODLES', 'DINER', 'CHEESE', 'RECORDS', 'BUTCHER', 'BAKERY', 'PASTA', 'THE BONE YARD', 'SQUIRREL WATCH', 'HARDWARE'],
  glass: ['BANK', 'TECH', 'SUSHI', 'GYM', 'OPTICS', 'SALON', 'CAFE', 'VET', 'YOGA', 'GALLERY', 'SMOOTHIES', 'DOG GROOMING', 'BARK & BREW'],
  decay: ['PAWN', 'BARBER', 'LAUNDRY', 'TACOS', 'VIDEO', 'CLOSED', 'FOR RENT', 'REPAIR', 'DISCOUNT', 'TV REPAIR', 'BAIT', 'SQUIRREL WATCH', 'PETS'],
};
const FX = {   // chance of each bit of flavor, per style
  downtown: { sign: 1, hang: 0.4, open: 0.5, plaque: 0.7, graf: 0.12, poster: 0.35, folk: 0.34, lit: 0.45, ac: 0.18, dish: 0.12, cat: 0.05, pigeon: 0.1, box: 0, mural: 0.35, roof: 0.45, alleyGraf: 0.4, alleyLine: 0.45 },
  suburbs: { sign: 1, hang: 0.5, open: 0.3, plaque: 0.9, graf: 0, poster: 0.08, folk: 0.34, lit: 0.5, ac: 0, dish: 0.05, cat: 0.1, pigeon: 0.06, box: 0.5, mural: 0, roof: 0.3, alleyGraf: 0, alleyLine: 0.7 },
  brick: { sign: 1, hang: 0.45, open: 0.45, plaque: 0.7, graf: 0.28, poster: 0.35, folk: 0.3, lit: 0.45, ac: 0.1, dish: 0.08, cat: 0.07, pigeon: 0.14, box: 0.06, mural: 0.6, roof: 0.45, alleyGraf: 0.7, alleyLine: 0.5 },
  glass: { sign: 1, hang: 0, open: 0.4, plaque: 0.3, graf: 0, poster: 0.04, folk: 0.2, lit: 0.7, ac: 0.08, dish: 0.1, cat: 0.02, pigeon: 0.04, box: 0, mural: 0, roof: 0.3, alleyGraf: 0, alleyLine: 0 },
  decay: { sign: 0.85, hang: 0.25, open: 0.2, plaque: 0.5, graf: 0.85, poster: 0.5, folk: 0.22, lit: 0.3, ac: 0.3, dish: 0.28, cat: 0.1, pigeon: 0.25, box: 0, mural: 0.35, roof: 0.6, alleyGraf: 1, alleyLine: 0.3 },
};
const SPRAY = ['#ff5a8a', '#ffd24a', '#5ad8ff', '#8aff6a', '#ff8a3a', '#c88aff', '#ffffff'];
const ROOMS = [['#6a5560', '#c0506a'], ['#5a6458', '#d8a840'], ['#4e5a72', '#e0e0e0'], ['#6b5a46', '#4a8a6a'], ['#56465a', '#e8884a']];
const pickR = (rng, a) => a[Math.floor(rng() * a.length)];

// villager head-and-shoulders (a 16x14 crop from the idle row), cached; plus a dark silhouette version
const FOLK_CROP = { sx: 8, sy: 14, w: 16, h: 14 };
function folkSprite(name, frame = 0, sil = false) {
  const img = IMG['vill_' + name]; if (!img) return null;
  const k = name + frame + sil; folkSprite.cache = folkSprite.cache || {};
  if (folkSprite.cache[k]) return folkSprite.cache[k];
  const c = mkCanvas(FOLK_CROP.w, FOLK_CROP.h), x = c.getContext('2d');
  x.drawImage(img, frame * 32 + FOLK_CROP.sx, FOLK_CROP.sy, FOLK_CROP.w, FOLK_CROP.h, 0, 0, FOLK_CROP.w, FOLK_CROP.h);
  if (sil) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#1e1522'; x.fillRect(0, 0, c.width, c.height); }
  return (folkSprite.cache[k] = c);
}

function sprayTag(x, rng, X, Y, maxW) {   // one graffiti doodle at X,Y (top-left); returns width used
  const col = pickR(rng, SPRAY), r = rng();
  const dark = 'rgba(20,16,30,0.55)';
  if (r < 0.2) { const rows = SPR.heart, w = sprW(rows); drawSprite(x, rows, { r: dark }, X + 1, Y + 1); drawSprite(x, rows, { r: col }, X, Y); return w; }
  if (r < 0.38) { drawSprite(x, SPR.paw, { p: dark }, X + 1, Y + 1); drawSprite(x, SPR.paw, { p: col }, X, Y); return 7; }
  if (r < 0.5) { drawSprite(x, SPR.bone, { w: dark }, X + 1, Y + 1); drawSprite(x, SPR.bone, { w: '#f4f0e0' }, X, Y); return 7; }
  if (r < 0.6) { drawSprite(x, SPR.smile, { y: '#ffd24a', k: '#3a2a20' }, X, Y); return 7; }
  if (r < 0.68) { drawSprite(x, SPR.star, { y: col }, X, Y); return 7; }
  if (r < 0.84 && maxW >= 40) { const s = 'MISSY WAS HERE'; drawText(x, s, X + 1, Y + 1, 1, dark); drawText(x, s, X, Y, 1, col); return textW(s, 1); }
  if (r < 0.9 && maxW >= 20) { const s = pickR(rng, ['WOOF', 'ARF', 'BONE', 'ZOOM', 'GOOD DOG']); drawText(x, s, X + 1, Y + 1, 1, dark); drawText(x, s, X, Y, 1, col); return textW(s, 1); }
  // squiggly tag: a wobbly line with a loop
  const n = 16 + Math.floor(rng() * 12), ph = rng() * 6;
  x.fillStyle = dark; for (let i = 0; i < n; i++) x.fillRect(X + i + 1, Y + 4 + Math.round(Math.sin(i * 0.8 + ph) * 3) + 1, 1, 2);
  x.fillStyle = col; for (let i = 0; i < n; i++) { const yy = Y + 4 + Math.round(Math.sin(i * 0.8 + ph) * 3); x.fillRect(X + i, yy, 1, 2); if (i % 7 === 3) x.fillRect(X + i, yy - 3, 1, 3); }
  return n;
}
function poster(x, rng, X, Y, w = 9, h = 12) {
  const cols = ['#f0e4b8', '#e8a0b0', '#a8d0e8', '#f0c860', '#b8e0a0'], bg = pickR(rng, cols);
  R_(x, X + 1, Y + 1, w, h, 'rgba(20,16,30,0.35)'); R_(x, X, Y, w, h, bg);
  const col = pickR(rng, ['#8a2a2a', '#1c2850', '#2a4a2a', '#5a2a6a']);
  R_(x, X + 1, Y + 1, w - 2, 3, col);
  for (let j = 6; j < h - 1; j += 2) R_(x, X + 1, Y + j, 2 + Math.floor(rng() * (w - 3)), 1, '#4a4a58');
  if (rng() < 0.5) { x.clearRect(X + w - 2, Y, 2, 2); }   // torn corner
}
function mural(x, rng, X, Y, w, h) {
  R_(x, X - 1, Y - 1, w + 2, h + 2, '#1c1a26');
  const kind = Math.floor(rng() * 3);
  if (kind === 0) {   // rainbow over a green field
    R_(x, X, Y, w, h, '#8ad0f0'); R_(x, X, Y + h - 8, w, 8, '#5aa860');
    const cx = X + w / 2, cy = Y + h - 6, cols = ['#e8484a', '#f09040', '#f0d850', '#58b858', '#4888e0', '#8860c8'];
    for (let py = Y; py < Y + h - 8; py++) for (let px = X; px < X + w; px++) {
      const d = Math.hypot(px + 0.5 - cx, (py + 0.5 - cy) * 1.1), i = Math.floor((w * 0.46 - d) / 2);
      if (i >= 0 && i < 6) R_(x, px, py, 1, 1, cols[i]);
    }
    R_(x, X + 3, Y + 5, 8, 3, '#fff'); R_(x, X + 5, Y + 3, 5, 2, '#fff'); R_(x, X + w - 12, Y + 7, 8, 3, '#fff'); R_(x, X + w - 10, Y + 5, 4, 2, '#fff');
  } else if (kind === 1) {   // big heart on stripes
    R_(x, X, Y, w, h, '#f4d890');
    for (let j = 0; j < h; j += 6) R_(x, X, Y + j, w, 3, '#f0b860');
    const hw = Math.min(w - 8, h - 4), cx = X + w / 2, cy = Y + h / 2 + 1;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const u = (px + 0.5 - w / 2) / (hw / 2.2), v = -(py + 0.5 - h / 2 - 1) / (hw / 2.2);
      const f = Math.pow(u * u + v * v - 1, 3) - u * u * v * v * v;
      if (f <= 0) R_(x, X + px, Y + py, 1, 1, v > 0.35 && u < -0.1 && u > -0.6 ? '#ff90a8' : '#e83a5a');
    }
    drawSprite(x, SPR.paw, { p: '#fff4f0' }, Math.round(cx - 3), Math.round(cy - 3));
  } else {   // night sky, moon, little town of stars
    R_(x, X, Y, w, h, '#2a3070'); R_(x, X, Y + h - 7, w, 7, '#1a1a40');
    for (let i = 0; i < 9; i++) R_(x, X + 2 + Math.floor(rng() * (w - 4)), Y + 2 + Math.floor(rng() * (h - 14)), 1, 1, '#ffe888');
    for (let py = -6; py <= 6; py++) for (let px = -6; px <= 6; px++) if (px * px + py * py <= 36 && (px + 2) * (px + 2) + (py - 1) * (py - 1) > 30) R_(x, X + w - 14 + px, Y + 9 + py, 1, 1, '#fff2b0');
    for (let bx = 2; bx < w - 6; bx += 8) { const bh = 3 + Math.floor(rng() * 4); R_(x, X + bx, Y + h - 7 - bh, 6, bh, '#14143a'); R_(x, X + bx + 2, Y + h - 6 - bh, 1, 1, '#ffd860'); }
  }
}
function neonOpen(x, X, Y, col, bg) {   // 19x9 "OPEN" sign
  R_(x, X, Y, 19, 9, bg); R_(x, X, Y, 19, 1, col); R_(x, X, Y + 8, 19, 1, col); R_(x, X, Y, 1, 9, col); R_(x, X + 18, Y, 1, 9, col);
  drawText(x, 'OPEN', X + 2, Y + 2, 1, col);
}

// ---- one window module (X,Y = top-left in canvas px; window is 64x64) ----
function windowFlavor(x, L, rng, fx, X, Y, kind, mi, out) {
  if (kind === 4) return;   // boarded up
  const gx = X + 22, gy = Y + 18, gw = 20, gh = 32;
  const r = rng();
  let person = null, anim = false;
  const folkP = fx.folk, boxP = fx.box, acP = fx.ac, catP = fx.cat, pigP = fx.pigeon;
  if (r < folkP) {
    const room = pickR(rng, ROOMS), name = pickR(rng, VILLAGERS);
    R_(x, gx, gy, gw, gh, room[0]);
    R_(x, gx, gy, 3, gh, room[1]); R_(x, gx + gw - 3, gy, 3, gh, room[1]);       // curtains
    R_(x, gx + 3, gy, gw - 6, 2, room[1]);
    R_(x, gx, gy + 14, gw, 18, 'rgba(0,0,0,0.12)');
    if (rng() < 0.4) { R_(x, gx + 8, gy + 5, 5, 4, '#f0d890'); R_(x, gx + 9, gy + 6, 3, 2, '#7ab8d8'); }   // a little picture on the wall
    anim = rng() < 0.22;
    const fx0 = gx + Math.floor((gw - FOLK_CROP.w) / 2), fy0 = gy + gh - FOLK_CROP.h;
    person = { name, x: fx0, y: fy0 };
    if (anim) out.folk.push({ name, x: fx0, y: fy0, o: mi });
    else { const s = folkSprite(name, 0); if (s) x.drawImage(s, fx0, fy0); }
    R_(x, gx, gy, 5, 1, 'rgba(255,255,255,0.35)'); R_(x, gx + 1, gy + 1, 3, 1, 'rgba(255,255,255,0.25)');   // glass glare
    R_(x, gx - 1, Y + 50, gw + 2, 2, '#b8bcc8');
  } else if (r < folkP + boxP) {
    const fc = ['#ff5a8a', '#ffd24a', '#f4f0e0', '#c88aff', '#ff8a3a'];
    R_(x, X + 19, Y + 47, 26, 7, '#6a4428'); R_(x, X + 19, Y + 47, 26, 1, '#8a5c38'); R_(x, X + 19, Y + 53, 26, 1, '#4a2e1a');
    for (let i = 0; i < 9; i++) {
      const fx1 = X + 20 + i * 3 + (i % 2), h = 3 + Math.floor(rng() * 3);
      R_(x, fx1, Y + 47 - h, 2, h, '#3a8a48'); R_(x, fx1 - 1, Y + 47 - h - 1, 3, 3, fc[Math.floor(rng() * fc.length)]); R_(x, fx1, Y + 47 - h, 1, 1, '#ffe888');
    }
  } else if (r < folkP + boxP + acP) {
    R_(x, X + 18, Y + 36, 28, 15, '#1c1a26'); R_(x, X + 19, Y + 37, 26, 13, '#c8ccd4'); R_(x, X + 19, Y + 37, 26, 2, '#e8ecf0');
    for (let i = 0; i < 6; i++) R_(x, X + 21 + i * 4, Y + 42, 2, 6, '#6a7080');
    R_(x, X + 41, Y + 39, 3, 2, '#5a6070'); R_(x, X + 22, Y + 51, 1, 3, '#7ab8e8');
  } else if (r < folkP + boxP + acP + catP) {
    const cc = pickR(rng, [{ o: '#e8903a', d: '#b8641e' }, { o: '#8a8c98', d: '#5a5c68' }, { o: '#2a2830', d: '#14121a' }, { o: '#f0e8d8', d: '#b8a890' }]);
    drawSprite(x, SPR.cat, cc, X + 25, Y + 45);
    R_(x, X + 36, Y + 48, 2, 1, '#14121a'); R_(x, X + 38, Y + 48, 2, 1, '#14121a');    // closed eyes
    drawText(x, 'Z', X + 41, Y + 36, 1, '#e8f0ff'); drawText(x, 'Z', X + 45, Y + 31, 1, 'rgba(232,240,255,0.7)');
  } else if (r < folkP + boxP + acP + catP + pigP) {
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) drawSprite(x, SPR.pigeon, { d: '#4a4f66', b: '#8a93a8', p: '#8a6aa8', e: '#f4d860', y: '#e8a030' }, X + 17 + i * 14 + Math.floor(rng() * 4), Y + 45, i % 2 === 1);
  }
  // sat dish on the wall beside the window
  if (rng() < fx.dish) {
    const dx = rng() < 0.5 ? X + 46 : X + 4;
    R_(x, dx + 3, Y + 24, 1, 5, '#3a3e4a'); R_(x, dx, Y + 20, 8, 5, '#d8dce4'); R_(x, dx + 1, Y + 25, 6, 1, '#d8dce4'); R_(x, dx + 1, Y + 21, 6, 3, '#aab0bc'); R_(x, dx + 5, Y + 17, 1, 4, '#3a3e4a'); R_(x, dx + 5, Y + 16, 2, 2, '#e85a4a');
  } else if (rng() < fx.poster && !person) {
    poster(x, rng, rng() < 0.5 ? X + 49 : X + 4, Y + 20 + Math.floor(rng() * 8), 9, 12);
  }
  // lights at night
  if (rng() < fx.lit && !(anim)) {
    const warm = pickR(rng, ['#ffd060', '#ffc060', '#ffe090', '#ffb860']);
    R_(L, gx, gy, gw, gh, warm);
    R_(L, gx, gy + gh - 8, gw, 8, 'rgba(255,240,180,0.35)');
    R_(L, gx - 2, gy - 2, gw + 4, gh + 4, 'rgba(255,200,100,0.22)'); R_(L, gx, gy, gw, gh, warm);
    if (person) { const s = folkSprite(person.name, 0, true); if (s) L.drawImage(s, person.x, person.y); R_(L, gx, gy, 3, gh, 'rgba(120,40,40,0.45)'); R_(L, gx + gw - 3, gy, 3, gh, 'rgba(120,40,40,0.45)'); }
    else { R_(L, gx, gy, 1, gh, 'rgba(0,0,0,0.12)'); R_(L, gx + 9, gy, 2, gh, 'rgba(0,0,0,0.1)'); R_(L, gx, gy + 15, gw, 2, 'rgba(0,0,0,0.1)'); }
  }
}

// ---- a shopfront (signboard band, hanging sign, plaque, neon, graffiti) ----
function shopFlavor(x, L, rng, fx, style, X, Y, w2, sx, st, taken) {
  const names = SHOP_NAMES[style.name];
  if (rng() < fx.sign) {
    let name, tries = 0;
    do { name = pickR(rng, names); tries++; } while ((taken.has(name) || textW(name, 1) > w2 - 20) && tries < 20);
    taken.add(name);
    const pal = pickR(rng, SIGN_PAL), bx = X + 5, bw = w2 - 10;
    R_(x, bx - 1, Y + 9, bw + 2, 14, '#1c1a26'); R_(x, bx, Y + 10, bw, 12, pal[0]);
    R_(x, bx + 1, Y + 11, bw - 2, 1, 'rgba(255,255,255,0.25)');
    const big = textW(name, 2) <= bw - 6, k = big ? 2 : 1, tw = textW(name, k);
    const tx = X + Math.floor((w2 - tw) / 2), ty = Y + 10 + Math.floor((12 - 5 * k) / 2);
    if (name === 'CLOSED' || name === 'FOR RENT') { drawText(x, name, tx, ty, k, '#a83a3a'); }
    else { drawText(x, name, tx, ty + 1 - (big ? 1 : 0) * 0, k, 'rgba(0,0,0,0.25)'); drawText(x, name, tx, ty, k, pal[1]); }
    if (name === 'BARK & BREW' || name === 'DOG WASH' || name === 'DOG SPA' || name === 'DOG GROOMING' || name === 'PETS' || name === 'TREAT SHOP') { /* dog joke shops get a paw in the corner */
      if (tw + 14 < bw) drawSprite(x, SPR.paw, { p: pal[1] }, bx + bw - 9, ty); }
    // a faint glow on the board at night
    R_(L, bx, Y + 10, bw, 12, 'rgba(255,224,150,0.22)');
    // hanging sign
    if (st !== 2 && st !== 3 && rng() < fx.hang) {
      const left = st === 1, hx = left ? X + 3 : X + w2 - 22, ic = pickR(rng, ['bone', 'cup', 'key', 'fish', 'tooth', 'scissors']);
      R_(x, hx - 1, Y + 25, 15, 2, '#1c1a26'); R_(x, hx + 12, Y + 25, 2, 6, '#1c1a26');
      R_(x, hx, Y + 27, 1, 3, '#1c1a26'); R_(x, hx + 10, Y + 27, 1, 3, '#1c1a26');
      R_(x, hx - 1, Y + 29, 13, 14, '#1c1a26'); R_(x, hx, Y + 30, 11, 12, pal[0]);
      const rows = SPR[ic], pm = { w: '#fffaf0', y: '#d8a020', b: '#4a88c8', k: '#1c1a26', s: '#8a6a4a', o: '#8a6a4a', r: '#c84a4a' };
      pm.w = ic === 'cup' ? '#fffaf0' : ic === 'tooth' ? '#fffaf0' : pm.w;
      const bgc = (ic === 'bone' || ic === 'tooth') ? '#3a4a68' : null; if (bgc) R_(x, hx, Y + 30, 11, 12, bgc);
      drawSprite(x, rows, pm, hx + Math.floor((11 - sprW(rows)) / 2), Y + 32 + Math.floor((8 - rows.length) / 2));
    }
  }
  if (st === 1 && rng() < fx.plaque) {   // street number by the door
    const num = String(2 + Math.floor(rng() * 96));
    R_(x, X + 48, Y + 38, 13, 9, '#1c1a26'); R_(x, X + 49, Y + 39, 11, 7, '#e8e4d4');
    drawText(x, num, X + 54 - Math.floor(textW(num, 1) / 2) + 1, Y + 40, 1, '#1c2850');
  }
  if (st === 2 && rng() < fx.open) {   // neon OPEN in the shop window
    const col = pickR(rng, [['#e8508a', '#ff7ab0'], ['#40c8e8', '#90f0ff'], ['#60e870', '#b0ffb0']]);
    neonOpen(x, X + 22, Y + 50, col[0], '#2a1a2a');
    neonOpen(L, X + 22, Y + 50, col[1], 'rgba(40,10,40,0.35)'); R_(L, X + 19, Y + 47, 25, 15, 'rgba(255,255,255,0.1)');
    L.globalAlpha = 0.25; neonOpen(L, X + 21, Y + 49, col[1], col[1]); L.globalAlpha = 1; neonOpen(L, X + 22, Y + 50, col[1], '#34102e');
  }
  if (st === 2 || st === 1) {   // warm light behind the glass / fanlight at night
    if (st === 2) { R_(L, X + 10, Y + 48, w2 - 20, 36, 'rgba(255,214,130,0.55)'); R_(L, X + 10, Y + 72, w2 - 20, 12, 'rgba(255,190,90,0.3)'); }
    else R_(L, X + 16, Y + 28, w2 - 32, 6, 'rgba(255,224,150,0.85)');
  }
  if (st === 0 && rng() < fx.graf) {   // shutter graffiti
    let gx = X + 10; const gy = Y + 62 + Math.floor(rng() * 6);
    for (let i = 0, n = 1 + Math.floor(rng() * 2); i < n; i++) { const used = sprayTag(x, rng, gx, gy, X + w2 - 10 - gx); gx += used + 6; if (gx > X + w2 - 24) break; }
  } else if (st === 3 && rng() < fx.graf * 0.8) sprayTag(x, rng, X + 8 + Math.floor(rng() * 20), Y + 78, 0);
}

function roofFlavor(x, rng, fx, X, w2, topY) {
  if (rng() > fx.roof) return;
  const n = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < n; i++) {
    const px = X + 8 + Math.floor(rng() * (w2 - 30)), r = rng();
    if (r < fx.pigeon + 0.35) {
      const k = 1 + Math.floor(rng() * 2);
      for (let j = 0; j < k; j++) drawSprite(x, SPR.pigeon, { d: '#4a4f66', b: '#8a93a8', p: '#8a6aa8', e: '#f4d860', y: '#e8a030' }, px + j * 11, topY - 7, rng() < 0.5);
    } else if (r < 0.75) {   // tv antenna
      R_(x, px + 5, topY - 14, 1, 14, '#2a2e3a'); for (let j = 0; j < 3; j++) R_(x, px + 1, topY - 13 + j * 4, 9, 1, '#2a2e3a'); R_(x, px + 1, topY - 15, 1, 5, '#2a2e3a'); R_(x, px + 9, topY - 15, 1, 5, '#2a2e3a');
    } else {   // chimney
      R_(x, px, topY - 10, 8, 10, '#8a4a3a'); R_(x, px - 1, topY - 12, 10, 3, '#5a3028'); R_(x, px + 1, topY - 9, 6, 1, '#a45a48');
    }
  }
}

// ---- called by buildScenery for each building ----
const TAKEN = new Set();   // shop names used lately on this street, so signs don't repeat
function addBuildingFlavor(c, mods, style, lv, n) {
  const x = c.getContext('2d'), L = (c.lit = mkCanvas(c.width, c.height)).getContext('2d');
  x.imageSmoothingEnabled = false; c.folk = [];
  const rng = makeRng(9100 + lv * 131 + n * 17), fx = FX[style.name];
  if (n === 0 || TAKEN.size >= SHOP_NAMES[style.name].length - 4) TAKEN.clear();
  const taken = TAKEN;
  const top = mods.filter(m => m.ri === 0);
  for (const t of top) roofFlavor(x, rng, fx, t.X, t.m.w * 2, ROOF_PAD);
  mods.forEach((o, mi) => {
    const { m, X, Y } = o, w2 = m.w * 2;
    if (o.shop) shopFlavor(x, L, rng, fx, style, X, Y, w2, m.x, m.x === 256 ? 0 : m.x === 304 ? 1 : m.x === 336 ? 2 : 3, taken);
    else if (m.x >= 448) {   // plain brick wall: mural, graffiti, posters
      if (m.w === 48 && rng() < fx.mural) mural(x, rng, X + 10, Y + 14, w2 - 20, 56);
      else if (m.w === 32 && rng() < fx.mural * 0.5) mural(x, rng, X + 8, Y + 20, w2 - 16, 40);
      else if (rng() < fx.graf * 1.3) sprayTag(x, rng, X + 8 + Math.floor(rng() * 12), Y + 24 + Math.floor(rng() * 50), w2 - 16);
      if (rng() < fx.poster * 0.6) poster(x, rng, X + 8 + Math.floor(rng() * (w2 - 28)), Y + 74 + Math.floor(rng() * 4));
    } else windowFlavor(x, L, rng, fx, X, Y, (m.x - 64) / 32, mi, c);
  });
  c.hasFolk = c.folk.length > 0;
}

// ---- alley: laundry line / bunting, graffiti, posters ----
function addAlleyFlavor(x, w, h, lv, n, styleName) {
  const rng = makeRng(7300 + lv * 71 + n * 13), fx = FX[styleName];
  if (rng() < fx.alleyGraf) {
    let gx = 12;
    for (let i = 0; i < 2 && gx < w - 30; i++) { gx += sprayTag(x, rng, gx, 70 + Math.floor(rng() * 40), w - 12 - gx) + 8; }
  }
  if (rng() < 0.5 && fx.alleyGraf > 0) poster(x, rng, 12 + Math.floor(rng() * (w - 34)), 36 + Math.floor(rng() * 10));
  if (rng() < fx.alleyLine) {
    const bunting = lv % 2 === 0 || rng() < 0.4, y0 = 14, cols = ['#e8484a', '#f0d850', '#58b858', '#4888e0', '#f09040', '#c870d0'];
    for (let i = 8; i < w - 8; i++) R_(x, i, y0 + Math.round(Math.sin((i - 8) / (w - 16) * Math.PI) * 4), 1, 1, '#14121a');
    for (let i = 14, k = 0; i < w - 16; i += bunting ? 8 : 18, k++) {
      const sy = y0 + Math.round(Math.sin((i - 8) / (w - 16) * Math.PI) * 4) + 1, col = cols[(k + n) % cols.length];
      if (bunting) { R_(x, i, sy, 7, 2, col); R_(x, i + 1, sy + 2, 5, 2, col); R_(x, i + 2, sy + 4, 3, 2, col); }
      else if (k % 3 === 0) { R_(x, i, sy, 10, 9, col); R_(x, i - 2, sy, 3, 4, col); R_(x, i + 9, sy, 3, 4, col); R_(x, i + 3, sy, 4, 2, 'rgba(0,0,0,0.25)'); }
      else if (k % 3 === 1) { R_(x, i, sy, 12, 4, '#f4f0e0'); R_(x, i, sy + 4, 12, 1, col); }
      else { R_(x, i, sy, 3, 6, col); R_(x, i + 4, sy, 3, 6, '#f4f0e0'); }
    }
  }
}
