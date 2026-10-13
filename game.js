'use strict';
// =====================================================================
//  Missy's Big Day Out - auto-scrolling street platformer. Plain canvas.
// =====================================================================

// ---------- constants ----------
const W = 640, H = 360;
const FEET_Y = 322;            // ground line (feet) on the sidewalk
const SIDEWALK_TOP = 296, CURB_Y = 340, ROAD_Y = 348;
const WOMAN_SCALE = 3;
const HW = 16;                 // dog hitbox half width
const STAND_H = 28, DUCK_H = 18;
const CAM_START = 95, CAM_MAX = 250, CAM_ACCEL = 1.25;   // camera (auto-scroll) speed px/s
const RUN_R = 275, RUN_L = 150, DUCK_V = 60;             // dog speeds px/s
const GRAVITY = 1700, JUMP_V = 560, JUMP_CUT = 0.5;
const COYOTE = 0.1, BUFFER = 0.12;
const DT = 1 / 60;
const STORE = { best: 'missys_best' };

const cv = document.getElementById('c');
const ctx = cv.getContext('2d');

// ---------- asset loading (no fetch: works from file://) ----------
const IMG = {};
const HIGH = ['meat1', 'bacon', 'sausage_p', 'salmon'];
const FOODS = ['dry_dog_food', 'meat1', 'bacon', 'sausage_p', 'fish', 'salmon', 'rubber_duck', 'milk_chocolate',
  'red_grape', 'green_grape', 'wine_red', 'coffee_bag', 'bone', 'bone2'];
const REGULAR = FOODS.filter(f => !HIGH.includes(f));
const PARROTS = ['green', 'green', 'blue', 'red', 'grey'];
const LINES = [
  "I have to fly to Columbus tomorrow!", "You're allergic to that!", "I already fed you!", "Who even left that there!",
  "I have to fly to New York tomorrow!", "It's about to rain, hurry up!", "No, we're not going across the street!",
  "It's bedtime!", "I'm watching my stories on TV right now!", "I just fed you!", "No, we just went out!",
  "Are you kidding? Survivor just started!", "Do you know what time it is?", "Stop huffing, go lay down",
  "Stop looking at me like that",
];

function loadImage(src) {
  const url = (window.__ASSETS && window.__ASSETS[src]) || src;
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(src); i.src = url; });
}
async function loadAll() {
  const files = { dog: 'spaniel.png', woman: 'woman.png', general: 'general.png', bgs1: 'bgs1.png', bgs2: 'bgs2.png', bones: 'bones.png',
    bird_green: 'bird_green.png', bird_blue: 'bird_blue.png', bird_red: 'bird_red.png', bird_grey: 'bird_grey.png' };
  const jobs = Object.entries(files).map(async ([k, f]) => { IMG[k] = await loadImage('assets/' + f); });
  for (const id of FOODS) if (!id.startsWith('bone')) jobs.push(loadImage('assets/items/' + id + '.png').then(i => { IMG[id] = i; }));
  await Promise.all(jobs);
  for (const [i, id] of ['bone', 'bone2'].entries()) {
    const c = document.createElement('canvas'); c.width = 23; c.height = 15;
    c.getContext('2d').drawImage(IMG.bones, i * 23, 0, 23, 15, 0, 0, 23, 15); IMG[id] = c;
  }
}

// ---------- helpers ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// seeded rng for building generation (so look is stable per build)
function makeRng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }


// ---------- prerendered scenery ----------
const BUILDINGS = [];
const DECOR_DEFS = [];
const PROP_SCALE = 2;

function propSprite(name, sub) { // returns {x,y,w,h} rect in general.png
  const p = PROPS[name];
  return sub ? { x: p[0] + sub[0], y: p[1] + sub[1], w: sub[2], h: sub[3] } : { x: p[0], y: p[1], w: p[2], h: p[3] };
}

function buildScenery() {
  const g = IMG.general;
  const windows = [64, 96, 128, 160, 192].map(x => ({ x, y: 0, w: 32, h: 32, u: 2 }));
  const shops = [{ x: 256, y: 0, w: 48, h: 48, u: 3 }, { x: 304, y: 0, w: 32, h: 48, u: 2 }, { x: 336, y: 0, w: 32, h: 48, u: 2 }, { x: 368, y: 0, w: 32, h: 48, u: 2 }];
  const bricks2 = [0, 48, 96, 144].map(y => ({ x: 456, y, w: 32, h: 48, u: 2 }));
  const bricks3 = [0, 48, 96, 144].map(y => ({ x: 448, y, w: 48, h: 48, u: 3 }));
  const rng = makeRng(1234);
  const rp = a => a[Math.floor(rng() * a.length)];
  // fill a row of `units` (16px) width with modules (pools by unit width)
  function fillRow(units, pool2, pool3) {
    const row = []; let left = units;
    while (left > 0) {
      let m;
      if (left === 2 || left === 4) m = rp(pool2);
      else if (left === 3) m = rp(pool3);
      else m = rng() < 0.5 ? rp(pool2) : rp(pool3);
      row.push(m); left -= m.u;
    }
    return row;
  }
  const S = 2;
  for (let n = 0; n < 12; n++) {
    const units = [4, 6, 6, 8][Math.floor(rng() * 4)];   // even widths => 128..256px at 2x
    const rows = [];                                  // top -> bottom
    const upper = rng() < 0.2 ? 0 : (rng() < 0.6 ? 1 : 2);
    const brickRow = rng() < 0.35;
    for (let f = 0; f < upper; f++) {
      if (brickRow && f === 0) { const by = rp([0, 48, 96, 144]); rows.push(fillRow(units, bricks2.filter(b => b.y === by), bricks3.filter(b => b.y === by))); }
      else rows.push(fillRow(units, windows, windows));
    }
    rows.push(fillRow(units, shops.filter(s => s.u === 2), shops.filter(s => s.u === 3)));
    // windows in a 3-unit gap don't fit; those rows fall back to a brick block (already in pool3)
    const bw = units * 16 * S;
    const heights = rows.map(r => Math.max(...r.map(m => m.h)));
    const bh = heights.reduce((a, b) => a + b, 0) * S;
    const c = mkCanvas(bw, bh), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    let py = 0;
    rows.forEach((row, ri) => {
      let px = 0; const rh = heights[ri];
      for (const m of row) { x.drawImage(g, m.x, m.y, m.w, m.h, px, (py + rh - m.h) * S, m.w * S, m.h * S); px += m.w * S; }
      py += rh;
    });
    // atmospheric haze so the facades sit behind the action
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(185,200,225,0.22)'; x.fillRect(0, 0, bw, bh);
    BUILDINGS.push(c);
  }
  // decorative sidewalk-edge props
  const mk = (name, sub) => ({ r: propSprite(name, sub) });
  DECOR_DEFS.push(mk('tree1'), mk('tree2'), mk('bare'), mk('hedge'), mk('hedgeLong'), mk('pot1'), mk('pot2'));
  DECOR_DEFS.forEach(d => { d.kind = 'prop'; });
  DECOR_DEFS.push({ kind: 'lamp', r: propSprite('lampHead') });
}


// ---------- obstacles (solid, static in the world; sprites from general.png at 2x) ----------
function obstacleDefs() {
  const d = (name, r, weight = 1, tall = false) => ({ name, r, weight, tall, w: r.w * 2, h: r.h * 2 });
  return [
    d('cone', { x: 226, y: 131, w: 15, h: 13 }, 2), d('bags', propSprite('bags', [0, 0, 27, 16]), 2), d('hydrant', propSprite('hydrant'), 2),
    d('can', propSprite('can'), 2), d('bollard', propSprite('bollard'), 2), d('crate', propSprite('crateS', [0, 16, 18, 16]), 3),
    d('bag', propSprite('bag'), 1), d('barrier', propSprite('barrier'), 1),
    d('dumpster', propSprite('dumpster'), 0.5, true), d('crate2', propSprite('crateS'), 0.5, true),
  ];
}
let OBST = [];

// ---------- game state ----------
const G = {
  state: 'loading', t: 0, cam: 0, speed: CAM_START, dist: 0, score: 0, best: 0, newBest: false, reason: '',
  entities: [], parts: [], texts: [], dog: null, wm: null, nextSpawnX: 0, nextParrot: 6, nextWoman: 18, lastLine: '',
  jumpBuf: 0, jumpHeld: false, titleT: 0, shake: 0, hintT: 0, overT: 0, holdT: 0, combo: 0,
};
const kb = { left: false, right: false, down: false }, vk = { left: false, right: false, down: false };
try { G.best = parseInt(localStorage.getItem(STORE.best) || '0', 10) || 0; } catch (e) {}

function newDog() {
  return { x: 220, dh: 0, dv: 0, ground: true, coyote: 0, jumpCut: false, face: 1, ducking: false, stun: 0, inv: 0,
    huffCd: 0, bubble: 0, row: 0, frame: 0, ft: 0, tilt: 0, oy: 0, sniffTick: 0, landT: 0, airT: 0, vx: 0, h: STAND_H, stepped: false };
}
function newWoman() {
  return { mode: 'none', sx: -100, dh: 0, dv: 0, dir: 1, v: 0, beh: 'run', line: '', side: 'left', t: 0, warnT: 0, ft: 0, frame: 0, row: 0,
    lunged: false, lungeT: 0, turned: false, turnX: 0, hopT: 0, x0: 0, x1: 0, flip: false, idleAt: 0 };
}
function resetGame() {
  G.t = 0; G.cam = 0; G.speed = CAM_START; G.dist = 0; G.score = 0; G.newBest = false; G.reason = '';
  G.entities = []; G.parts = []; G.texts = []; G.shake = 0; G.hintT = 0; G.overT = 0; G.holdT = 0; G.combo = 0;
  G.dog = newDog(); G.wm = newWoman(); G.jumpBuf = 0;
  G.nextSpawnX = 480; G.nextParrot = rnd(6, 9); G.nextWoman = rnd(15, 20);
}

// =====================================================================
//  Spawning
// =====================================================================
const S2 = x => x - G.cam;  // world x -> screen x

function addObstacle(x, def) {
  const e = { type: 'obst', def, x, w: def.w, h: def.h }; G.entities.push(e); return e;
}
function addFood(x, base, id, high) {
  id = id || pick(high ? HIGH : REGULAR);
  G.entities.push({ type: 'food', id, high: HIGH.includes(id), x, base, ph: rnd(0, 6.28), gone: false });
}
function pickFood() { return Math.random() < 0.13 ? pick(HIGH) : pick(REGULAR); }
function weighted(list) {
  let tot = list.reduce((a, o) => a + o.weight, 0), r = Math.random() * tot;
  for (const o of list) { r -= o.weight; if (r <= 0) return o; }
  return list[0];
}

function spawnPattern() {
  const x = G.nextSpawnX, r = Math.random();
  if (r < 0.52) {
    const def = weighted(OBST);
    const small = ['cone', 'bags', 'crate'].includes(def.name);
    const count = small ? rndi(1, 3) : 1;
    let cx = x, first = null;
    for (let i = 0; i < count; i++) { const o = addObstacle(cx, def); first = first || o; cx += o.w; }
    const total = cx - x, mid = x + total / 2;
    // food on top of the obstacle, and a small arc over it
    if (Math.random() < 0.7) addFood(mid - (count > 1 ? 14 : 0), first.h + 2, pickFood());
    if (count > 1 && Math.random() < 0.6) addFood(mid + 14, first.h + 2, pickFood());
    if (Math.random() < 0.7) {
      const n = 5, span = Math.max(150, total + 90);
      for (let i = 0; i < n; i++) { const u = i / (n - 1); addFood(mid - span / 2 + u * span, first.h + 10 + Math.sin(u * Math.PI) * 38, pickFood()); }
    }
    G.nextSpawnX = cx + (def.tall ? rnd(260, 360) : rnd(200, 330));
  } else if (r < 0.80) {
    const n = rndi(3, 7);
    for (let i = 0; i < n; i++) addFood(x + i * 34, 2, pickFood());
    G.nextSpawnX = x + n * 34 + rnd(60, 160);
  } else if (r < 0.90) {
    addFood(x + 30, 2, pick(HIGH));
    G.nextSpawnX = x + 160;
  } else {
    // a jump-height line of treats over open ground
    const n = rndi(3, 5);
    for (let i = 0; i < n; i++) addFood(x + i * 36, 40 + Math.sin(i / (n - 1) * Math.PI) * 28, pickFood());
    G.nextSpawnX = x + n * 36 + 100;
  }
}

function spawnParrot(mode, x) {
  mode = mode || pick(['head', 'low', 'sine', 'head', 'sine', 'low']);
  const base = { head: 32, low: 8, sine: 34 }[mode];
  G.entities.push({ type: 'parrot', variant: pick(PARROTS), mode, x: x != null ? x : G.cam + W + 40, c: base, base, vx: -rnd(70, 130),
    fl: rnd(0, 8), t: 0, state: 'fly', vy: 0, hit: false });
}

// =====================================================================
//  Particles & floating texts
// =====================================================================
function puff(x, y, n, col = '#d8d4cc') {
  for (let i = 0; i < n; i++) G.parts.push({ k: 'dust', x: x + rnd(-6, 6), y, vx: rnd(-40, 40), vy: rnd(-50, -10), life: rnd(0.25, 0.5), t: 0, s: rnd(2, 4.5), col });
}
function sparkle(x, y, n = 8, col = '#ffe680') {
  for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), v = rnd(40, 110); G.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: rnd(0.35, 0.6), t: 0, s: rnd(2, 4), col }); }
}
function feathers(x, y, n, variant) {
  const cols = { green: ['#3cab46', '#6ed264', '#e1373a'], blue: ['#2864c8', '#5a96f0', '#f5cd46'], red: ['#cd3232', '#f06450', '#3c78dc'], grey: ['#905212', '#ae6d2a', '#cb9f42'] }[variant] || ['#fff'];
  for (let i = 0; i < n; i++) G.parts.push({ k: 'feather', x, y, vx: rnd(-90, 90), vy: rnd(-130, -30), life: rnd(0.7, 1.2), t: 0, s: rnd(2, 3), col: pick(cols) });
}
function floatText(str, x, y, col = '#fff', size = 12) { G.texts.push({ str, x, y, t: 0, life: 1.2, col, size }); }

// =====================================================================
//  Actions
// =====================================================================
function doJump() {
  const d = G.dog;
  d.dv = JUMP_V; d.ground = false; d.coyote = 0; d.jumpCut = false; G.jumpBuf = 0; d.airT = 0;
  puff(S2(d.x), FEET_Y - d.dh, 4); Sfx.jump();
}
function doHuff() {
  const d = G.dog;
  if (d.huffCd > 0 || d.stun > 0) return;
  d.huffCd = 0.5; d.bubble = 0.8; d.huffT = 0;
  Sfx.bark();
  const sx = S2(d.x), y = FEET_Y - d.dh - d.h;
  for (let i = 0; i < 3; i++) G.parts.push({ k: 'bang', x: sx + d.face * (24 + i * 5), y: y + rnd(-6, 6), vx: d.face * (30 + i * 25), vy: -20 - i * 15, life: 0.55, t: 0, s: 1, col: '#fff' });
  G.parts.push({ k: 'ring', x: sx + d.face * 34, y: FEET_Y - d.dh - 14, vx: 0, vy: 0, life: 0.35, t: 0, s: d.face, col: '#fff' });
  for (const e of G.entities) {
    if (e.type !== 'parrot' || e.state !== 'fly') continue;
    const dx = (e.x - d.x) * d.face;
    if (dx > -70 && dx < 260 && e.x > G.cam - 20 && e.x < G.cam + W + 20) {
      e.state = 'flee'; e.vy = rnd(150, 210); Sfx.flap(); feathers(S2(e.x), FEET_Y - e.c, 3, e.variant);
    }
  }
}
function parrotHit(e) {
  const d = G.dog;
  if (d.inv > 0) return;
  e.hit = true;
  feathers(S2(e.x), FEET_Y - e.c, 8, e.variant); Sfx.squawk();
  G.shake = 4;
  floatText('−3', S2(d.x), FEET_Y - d.dh - d.h - 14, '#ff5a5a', 14);
  if (G.score < 3) {
    G.score = 0; d.stun = 1.0; d.inv = 2.1; d.bubble = 0; Sfx.dizzy();
  } else { G.score -= 3; d.inv = 1.0; }
}
function eatFood(e) {
  e.gone = true; const sx = S2(e.x), y = FEET_Y - e.base - 16;
  if (e.high) { G.score += 5; floatText('+5', sx, y - 10, '#ffd24a', 15); sparkle(sx, y, 14); Sfx.crunch5(); }
  else { G.score += 1; floatText('+1', sx, y - 6, '#fff', 11); sparkle(sx, y, 4, '#fff6c0'); Sfx.crunch(); }
}

function endGame(reason) {
  G.state = 'over'; G.reason = reason; G.overT = 0; Sfx.over();
  const d = G.dog, wm = G.wm;
  d.stun = 0; d.inv = 0; d.dh = 0; d.dv = 0; d.ground = true; d.bubble = 0;
  d.x = clamp(d.x, G.cam + 70, G.cam + W - 120);
  G.entities = G.entities.filter(e => !(e.type === 'obst' && e.x < d.x + 80 && e.x + e.w > d.x - 60));
  G.entities = G.entities.filter(e => e.type !== 'parrot');
  wm.mode = 'none'; wm.over = true; wm.row = 0; wm.flip = false;
  wm.sx = S2(d.x) + (S2(d.x) < W - 160 ? 62 : -62); wm.flip = wm.sx < S2(d.x); wm.dh = 0;
  if (G.score > G.best) { G.best = G.score; G.newBest = true; try { localStorage.setItem(STORE.best, String(G.best)); } catch (e) {} }
}
function crush() {  // Missy is squeezed against the left screen edge: indignant HUFF, brief freeze, then game over
  G.state = 'crush'; G.holdT = 0.85; G.dog.bubble = 0.85; G.dog.stun = 0; G.dog.row = 4; G.dog.frame = 3;
  Sfx.bark(); G.shake = 8;
}
function startGame() { resetGame(); G.state = 'play'; Sfx.start(); }

// =====================================================================
//  The woman (SkiFree-yeti role)
// =====================================================================
const UNLOCK = [['sprint', 45], ['lunge', 75], ['hop', 75], ['turn', 110], ['leap', 150]];
function startWoman(opts = {}) {
  const wm = G.wm;
  const avail = ['run', ...UNLOCK.filter(u => G.t >= u[1]).map(u => u[0])];
  wm.beh = opts.beh || pick(avail);
  wm.side = opts.side || (Math.random() < 0.5 ? 'left' : 'right');
  let line; do { line = pick(LINES); } while (line === G.lastLine);
  G.lastLine = wm.line = line;
  wm.mode = 'warn'; wm.warnT = opts.warnT || 1.6; wm.t = 0; wm.over = false;
  wm.dir = wm.side === 'left' ? 1 : -1;
  wm.sx = wm.side === 'left' ? -50 : W + 50; wm.x0 = wm.sx; wm.x1 = wm.side === 'left' ? W + 60 : -60;
  const base = 180 + Math.min(70, G.t * 0.45);
  wm.v = wm.beh === 'sprint' ? base * 1.75 : base;
  wm.dh = 0; wm.dv = 0; wm.lunged = false; wm.lungeT = 0; wm.turned = false; wm.hopT = 0.4; wm.flip = wm.dir < 0;
  wm.turnX = rnd(0.35, 0.65) * W; wm.pulse = 0;
  Sfx.alert();
}
function scheduleWoman() { G.nextWoman = rnd(10, 18) * Math.max(0.55, 1 - G.t / 520); }

function updateWoman(dt) {
  const wm = G.wm, d = G.dog;
  if (wm.mode === 'none') {
    G.nextWoman -= dt;
    if (G.nextWoman <= 0) startWoman();
    return;
  }
  wm.t += dt; wm.pulse += dt;
  if (wm.mode === 'warn') {
    wm.warnT -= dt; wm.row = 0; wm.frame = 0;
    if (wm.warnT <= 0) { wm.mode = 'charge'; wm.t = 0; }
    return;
  }
  // charge
  let v = wm.v;
  if (wm.beh === 'lunge') {
    if (!wm.lunged && Math.abs(wm.sx - S2(d.x)) < 190 && (S2(d.x) - wm.sx) * wm.dir > 0) { wm.lunged = true; wm.lungeT = 0.5; }
    if (wm.lungeT > 0) { wm.lungeT -= dt; v *= 2.5; }
  }
  if (wm.beh === 'hop') {
    wm.hopT -= dt;
    if (wm.dh <= 0 && wm.dv <= 0 && wm.hopT <= 0) { wm.dv = 520; wm.hopT = 0.35; }
  }
  if (wm.beh === 'hop') {
    if (wm.dv !== 0 || wm.dh > 0) { wm.dv -= 1750 * dt; wm.dh += wm.dv * dt; if (wm.dh <= 0) { wm.dh = 0; wm.dv = 0; } }
  }
  wm.sx += wm.dir * v * dt;
  if (wm.beh === 'leap') {
    const u = clamp((wm.sx - wm.x0) / (wm.x1 - wm.x0), 0, 1);
    wm.dh = 4 * 150 * u * (1 - u);
  }
  if (wm.beh === 'turn' && !wm.turned && (wm.sx - wm.turnX) * wm.dir >= 0) { wm.turned = true; wm.dir = -wm.dir; wm.flip = wm.dir < 0; }
  // animation
  if (wm.lungeT > 0) { wm.row = 2; wm.frame = Math.min(2, Math.floor((0.5 - wm.lungeT) * 8)); }
  else if (wm.beh === 'leap') { wm.row = 2; wm.frame = 1; }
  else { wm.row = 1; wm.ft += dt * (8 + v / 22); wm.frame = Math.floor(wm.ft) % 6; }
  // collision with Missy: tight boxes
  const dx = Math.abs(wm.sx - S2(d.x));
  if (dx < 12 + 12 && wm.dh < d.dh + d.h - 2 && wm.dh + 40 > d.dh + 2) { endGame('caught'); return; }
  // exit
  const out = wm.dir > 0 ? wm.sx > W + 70 : wm.sx < -70;
  if (out && (wm.beh !== 'turn' || wm.turned)) { wm.mode = 'none'; scheduleWoman(); }
}

// =====================================================================
//  Update
// =====================================================================
function overlapX(d, o) { return d.x + HW > o.x + 1 && d.x - HW < o.x + o.w - 1; }

function updateDog(dt) {
  const d = G.dog;
  d.huffCd = Math.max(0, d.huffCd - dt); d.inv = Math.max(0, d.inv - dt); d.stun = Math.max(0, d.stun - dt);
  d.bubble = Math.max(0, d.bubble - dt); d.huffT = (d.huffT || 0) + dt; G.jumpBuf = Math.max(0, G.jumpBuf - dt);
  const can = d.stun <= 0;
  const left = can && (kb.left || vk.left), right = can && (kb.right || vk.right), down = can && (kb.down || vk.down);
  d.ducking = down && d.ground;
  d.h = d.ducking ? DUCK_H : STAND_H;
  let vx = 0;
  if (right && !left) vx = d.ducking ? DUCK_V : RUN_R; else if (left && !right) vx = -(d.ducking ? DUCK_V : RUN_L);
  d.vx = vx; if (vx) d.face = vx > 0 ? 1 : -1;
  d.x += vx * dt;

  if (d.ground) d.coyote = COYOTE; else d.coyote = Math.max(0, d.coyote - dt);
  if (can && G.jumpBuf > 0 && d.coyote > 0 && !d.ducking) doJump();

  // vertical
  const prevDh = d.dh;
  if (!d.ground) {
    if (!G.jumpHeld && d.dv > 0 && !d.jumpCut) { d.dv *= JUMP_CUT; d.jumpCut = true; }
    d.dv -= GRAVITY * dt; d.dh += d.dv * dt; d.airT += dt;
    let landed = false;
    if (d.dv <= 0) for (const o of G.entities) {
      if (o.type !== 'obst' || !overlapX(d, o)) continue;
      if (prevDh >= o.h - 1 && d.dh <= o.h) { d.dh = o.h; landed = true; }
    }
    if (d.dh <= 0) { d.dh = 0; landed = true; }
    if (landed) { d.dv = 0; d.ground = true; d.landT = 0.2; puff(S2(d.x), FEET_Y - d.dh, 6); Sfx.land(); }
  }
  // left edge pushes forward, right edge is a wall, obstacles are solid
  d.x = Math.max(d.x, G.cam + HW);
  d.x = Math.min(d.x, G.cam + W - HW - 2);
  for (const o of G.entities) {
    if (o.type !== 'obst' || !overlapX(d, o) || d.dh >= o.h - 2) continue;
    const pushL = d.x + HW - o.x, pushR = o.x + o.w - (d.x - HW);
    if (pushL < pushR) d.x -= pushL; else d.x += pushR;
  }
  d.x = Math.min(d.x, G.cam + W - HW - 2);
  if (d.x - HW < G.cam - 0.5) { crush(); return; }
  // support check (walking off a platform)
  if (d.ground) {
    let sup = 0;
    for (const o of G.entities) if (o.type === 'obst' && overlapX(d, o) && o.h <= d.dh + 2) sup = Math.max(sup, o.h);
    if (sup < d.dh - 0.5) { d.ground = false; d.dv = 0; d.airT = 0.3; d.dh = Math.max(d.dh, sup); }
    else d.dh = sup;
  }
  d.landT = Math.max(0, d.landT - dt);

  // animation row/frame
  d.tilt = 0; d.oy = 0;
  const hb = d.bubble > 0 && d.huffT < 0.32;
  if (d.stun > 0) { d.row = 4; d.frame = Math.floor(G.t * 8) % 5; }
  else if (!d.ground) {
    d.row = 3; const p = clamp(0.5 - 0.5 * d.dv / JUMP_V, 0, 1);
    d.frame = d.airT < 0.06 ? 2 : p < 0.3 ? 3 : p < 0.62 ? 4 : 5;
  } else if (d.ducking) { d.row = 5; d.frame = 0; }
  else if (d.landT > 0) { d.row = 3; d.frame = Math.min(10, 6 + Math.floor((0.2 - d.landT) * 25)); }
  else if (vx !== 0) {
    d.row = 2; d.ft += dt * (vx > 0 ? 17 : 11); d.frame = Math.floor(d.ft) % 8;
    if (d.frame === 2 && !d.stepped) { d.stepped = true; if (Math.random() < 0.5) puff(S2(d.x) - d.face * 18, FEET_Y - d.dh, 1); }
    if (d.frame !== 2) d.stepped = false;
  } else if (hb) { d.row = 0; d.frame = 0; d.oy = Math.round(Math.sin(d.huffT * 45)) * -2; d.tilt = -0.05 * d.face; }
  else {  // idle: stopped to sniff
    d.row = 2; d.ft += dt * 6; d.frame = Math.floor(d.ft) % 8; d.oy = 2; d.tilt = 0.09 * d.face;
    d.sniffTick -= dt;
    if (d.sniffTick <= 0) {
      d.sniffTick = 0.35;
      G.parts.push({ k: 'q', x: S2(d.x) + d.face * 34, y: FEET_Y - d.dh - 26, vx: d.face * 10, vy: -26, life: 0.7, t: 0, s: 1, col: '#cfeaff' });
    }
  }
}

function updatePlay(dt) {
  const d = G.dog;
  G.t += dt; G.hintT += dt;
  G.speed = Math.min(CAM_MAX, CAM_START + G.t * CAM_ACCEL);
  G.cam += G.speed * dt; G.dist += G.speed * dt / 40;
  G.shake = Math.max(0, G.shake - dt * 22);

  updateDog(dt);
  if (G.state !== 'play') return;

  while (G.nextSpawnX < G.cam + W + 160) spawnPattern();
  G.nextParrot -= dt;
  if (G.nextParrot <= 0) { spawnParrot(); G.nextParrot = rnd(3, 6) * Math.max(0.5, 1 - G.t / 300); }

  for (const e of G.entities) {
    if (e.type === 'food') {
      if (e.gone) continue;
      const hop = e.high ? Math.abs(Math.sin(G.t * 5 + e.ph)) * 20 : Math.sin(G.t * 4 + e.ph) * 3 + 3;
      e.hop = hop;
      const cy = e.base + 14 + hop;
      if (Math.abs(e.x - d.x) < HW + 12 && cy > d.dh - 8 && cy < d.dh + d.h + 10) eatFood(e);
    } else if (e.type === 'parrot') {
      e.t += dt; e.fl += dt * 14; e.x += e.vx * dt;
      if (e.state === 'fly') {
        if (e.mode === 'sine') e.c = e.base + Math.sin(e.t * 3) * 22;
        const cy = e.c;
        if (!e.hit && Math.abs(e.x - d.x) < HW + 8 && cy + 7 > d.dh && cy - 7 < d.dh + d.h) parrotHit(e);
      } else { e.c += e.vy * dt; e.vy += 40 * dt; }
    }
  }
  updateWoman(dt);
  G.entities = G.entities.filter(e => {
    if (e.gone) return false;
    if (e.type === 'parrot') return S2(e.x) > -80 && e.c < 520;
    return S2(e.x) + (e.w || 0) > -120;
  });
  updateParts(dt);
}

function updateParts(dt) {
  for (const p of G.parts) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.k === 'feather') { p.vy += 120 * dt; p.vx *= 0.98; } else if (p.k === 'spark') p.vy += 160 * dt;
  }
  G.parts = G.parts.filter(p => p.t < p.life);
  for (const t of G.texts) { t.t += dt; t.y -= 22 * dt; }
  G.texts = G.texts.filter(t => t.t < t.life);
}

function update(dt) {
  if (G.state === 'play') updatePlay(dt);
  else if (G.state === 'crush') {
    G.holdT -= dt; G.dog.bubble = Math.max(0, G.dog.bubble - dt); G.shake = Math.max(0, G.shake - dt * 22);
    updateParts(dt);
    if (G.holdT <= 0) endGame('trapped');
  } else if (G.state === 'title') {
    G.titleT += dt;
    const d = G.dog, wm = G.wm, cyc = G.titleT % 5;
    d.tilt = 0; d.oy = 0; d.dh = 0; d.inv = 0; d.bubble = 0; d.stun = 0; d.face = 1;
    if (cyc > 2.5) { d.row = 1; d.frame = Math.min(13, Math.floor((cyc - 2.5) * 5.6)); } else { d.row = 0; d.frame = Math.floor(G.titleT * 6) % 5; }
    wm.ft += dt * 5; wm.frame = Math.floor(wm.ft) % 4; wm.row = 0;
  } else if (G.state === 'over') {
    G.overT += dt; G.t += 0;
    const d = G.dog, wm = G.wm;
    d.row = 5; d.ft += dt * 3; d.frame = Math.floor(d.ft) % 6; d.tilt = 0; d.oy = 0;
    wm.row = 0; wm.ft += dt * 5; wm.frame = Math.floor(wm.ft) % 4;
    updateParts(dt);
  }
}


function drawParallaxImage(img, scrollX, y, w = 640) {
  const ox = -((scrollX % w) + w) % w;
  ctx.drawImage(img, Math.round(ox), y); ctx.drawImage(img, Math.round(ox) + w, y);
}


// building layout is deterministic over world x so it can scroll infinitely
let bldSeq = null;
function layoutBuildings() {
  const rng = makeRng(77); bldSeq = []; let x = 0;
  for (let i = 0; i < 400; i++) {
    const b = Math.floor(rng() * BUILDINGS.length);
    bldSeq.push({ x, b, c: BUILDINGS[b] });
    x += BUILDINGS[b].width + (rng() < 0.3 ? Math.floor(rng() * 3) * 32 + 32 : 0);
  }
  bldSeq.total = x;
}
const DECOR_SEQ = [];
function layoutDecor() {
  const rng = makeRng(99); let x = 0;
  for (let i = 0; i < 400; i++) {
    const d = DECOR_DEFS[Math.floor(rng() * DECOR_DEFS.length)];
    DECOR_SEQ.push({ x, d, flip: rng() < 0.5 });
    x += 140 + Math.floor(rng() * 260);
  }
}

function drawBackground() {
  const sc = G.cam;
  ctx.fillStyle = '#9ec4e6'; ctx.fillRect(0, 0, W, H);
  drawParallaxImage(IMG.bgs2, sc * 0.05, -50);
  // mid layer: teal towers (solid part is hidden behind buildings & sidewalk)
  ctx.globalAlpha = 0.9;
  drawParallaxImage(IMG.bgs1, sc * 0.2, 36);
  ctx.globalAlpha = 1;
  // buildings @0.5x
  const bs = sc * 0.5;
  for (const b of bldSeq) {
    const sx = b.x - bs;
    if (sx > W) break;
    if (sx + b.c.width < 0) continue;
    ctx.drawImage(b.c, Math.round(sx), SIDEWALK_TOP + 2 - b.c.height);
  }
  // building base shadow strip
  ctx.fillStyle = '#4a4f5c'; ctx.fillRect(0, SIDEWALK_TOP - 2, W, 4);
  // sidewalk
  ctx.fillStyle = '#c9ccd3'; ctx.fillRect(0, SIDEWALK_TOP + 2, W, CURB_Y - SIDEWALK_TOP);
  ctx.fillStyle = '#b9bdc6'; ctx.fillRect(0, SIDEWALK_TOP + 2, W, 6);
  // decorative props @0.8x (standing at the back of the sidewalk)
  const ds = sc * 0.8;
  for (const e of DECOR_SEQ) {
    const sx = e.x - ds;
    if (sx > W + 80) break;
    if (sx < -200) continue;
    drawDecor(e, sx);
  }
  // paving joints
  ctx.fillStyle = '#aab0ba';
  const jo = -(sc % 48);
  for (let x = jo; x < W; x += 48) ctx.fillRect(Math.round(x), 318, 2, CURB_Y - 318);
  ctx.fillRect(0, 317, W, 1);
  ctx.fillStyle = '#d9dce2'; ctx.fillRect(0, SIDEWALK_TOP + 8, W, 1);
  // curb
  ctx.fillStyle = '#e6e8ec'; ctx.fillRect(0, CURB_Y, W, 3);
  ctx.fillStyle = '#8b909c'; ctx.fillRect(0, CURB_Y + 3, W, 5);
  // road
  ctx.fillStyle = '#3a3e4a'; ctx.fillRect(0, ROAD_Y, W, H - ROAD_Y);
  ctx.fillStyle = '#e8d070';
  const ro = -(sc % 64);
  for (let x = ro; x < W; x += 64) ctx.fillRect(Math.round(x), 355, 34, 2);
}

function drawDecor(e, sx) {
  const d = e.d, r = d.r, S = PROP_SCALE, base = 308;
  if (d.kind === 'lamp') {
    const w = r.w * S, hh = r.h * S;
    const top = base - 170;
    ctx.fillStyle = '#8c95a6'; ctx.fillRect(Math.round(sx + w / 2 - 3), top + hh - 4, 6, 170 - hh + 4);
    ctx.fillStyle = '#6f7889'; ctx.fillRect(Math.round(sx + w / 2 + 1), top + hh - 4, 2, 170 - hh + 4);
    ctx.drawImage(IMG.general, r.x, r.y, r.w, r.h, Math.round(sx), top, w, hh);
    ctx.fillStyle = '#6f7889'; ctx.fillRect(Math.round(sx + w / 2 - 8), base - 6, 16, 6);
  } else {
    ctx.drawImage(IMG.general, r.x, r.y, r.w, r.h, Math.round(sx), base - r.h * S, r.w * S, r.h * S);
  }
}


// =====================================================================
//  Rendering
// =====================================================================
function shadow(x, y, w, a = 0.28) {
  ctx.fillStyle = 'rgba(30,34,50,' + a + ')';
  ctx.beginPath(); ctx.ellipse(Math.round(x), y + 1, w, Math.max(2, w * 0.2), 0, 0, 6.283); ctx.fill();
}

function drawEntities() {
  for (const e of G.entities) {
    const sx = S2(e.x);
    if (sx > W + 80 || sx < -150) continue;
    if (e.type === 'obst') {
      const r = e.def.r;
      shadow(sx + e.w / 2, FEET_Y, e.w * 0.5, 0.22);
      ctx.drawImage(IMG.general, r.x, r.y, r.w, r.h, Math.round(sx), FEET_Y + 1 - e.h, e.w, e.h);
    } else if (e.type === 'food') {
      const img = IMG[e.id], bone = e.id.startsWith('bone');
      const iw = bone ? 23 : 28, ih = bone ? 15 : 28, hop = e.hop || 0;
      let sxs = 1, sys = 1;
      if (e.high) { if (hop < 3) { sxs = 1.18; sys = 0.82; } else { sxs = 0.92; sys = 1.1; } }
      if (e.base < 4) shadow(sx, FEET_Y, 8 - Math.min(4, hop / 6), 0.18);
      if (e.high) { // faint glint so the valuable ones read at a glance
        ctx.fillStyle = 'rgba(255,220,90,' + (0.18 + 0.12 * Math.sin(G.t * 8 + e.ph)) + ')';
        ctx.beginPath(); ctx.arc(sx, FEET_Y - e.base - 14 - hop, 19, 0, 6.283); ctx.fill();
      }
      ctx.save(); ctx.translate(Math.round(sx), Math.round(FEET_Y - e.base - hop)); ctx.scale(sxs, sys);
      ctx.drawImage(img, -iw / 2, -ih - (bone ? 6 : 0), iw, ih); ctx.restore();
    } else if (e.type === 'parrot') {
      const fr = Math.floor(e.fl) % 8, img = IMG['bird_' + e.variant];
      ctx.save(); ctx.translate(Math.round(sx), Math.round(FEET_Y - e.c));
      ctx.scale(-1, 1);  // sprite faces right; parrots fly left
      ctx.drawImage(img, fr * 16, 0, 16, 16, -16, -16, 32, 32); ctx.restore();
    }
  }
}

function drawDog() {
  const d = G.dog, sx = S2(d.x);
  const over = G.state === 'over';
  shadow(sx + (over ? 4 : 0), FEET_Y - d.dh + (d.dh > 0 ? 0 : 0), 22, 0.3 * (d.dh > 0 ? 0.8 : 1));
  if (d.inv > 0 && Math.floor(d.inv * 14) % 2 === 0) ctx.globalAlpha = 0.4;
  ctx.save();
  ctx.translate(Math.round(sx), Math.round(FEET_Y - d.dh));
  ctx.scale(d.face, 1);
  if (d.tilt) ctx.rotate(d.tilt * d.face);
  ctx.drawImage(IMG.dog, d.frame * 32, d.row * 32, 32, 32, -32, -64 + d.oy, 64, 64);
  ctx.restore();
  ctx.globalAlpha = 1;
  if (d.stun > 0) { // circling stars
    for (let i = 0; i < 3; i++) {
      const a = G.t * 6 + i * 2.09, px = sx + Math.cos(a) * 16, py = FEET_Y - d.dh - 34 + Math.sin(a) * 4;
      ctx.fillStyle = '#ffe680'; ctx.fillRect(Math.round(px) - 1, Math.round(py) - 3, 3, 7); ctx.fillRect(Math.round(px) - 3, Math.round(py) - 1, 7, 3);
    }
  }
  if (d.bubble > 0) drawHuffBubble(d);
}

function drawHuffBubble(d) {
  const k = d.bubble / 0.8, sx = S2(d.x);
  const x = clamp(sx + d.face * 24, 40, W - 40), y = FEET_Y - d.dh - 70 - (1 - Math.min(1, k)) * 6;
  ctx.globalAlpha = Math.min(1, k * 3);
  const w = 62, h = 20, bx = x - w / 2, by = y - h / 2;
  ctx.fillStyle = '#1c1a26'; ctx.fillRect(bx - 2, by - 2, w + 4, h + 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, w, h);
  const tx = clamp(sx, bx + 6, bx + w - 12);
  ctx.fillStyle = '#1c1a26'; ctx.fillRect(tx, by + h + 2, 6, 3); ctx.fillStyle = '#fff'; ctx.fillRect(tx, by + h, 6, 2);
  outlineText('HUFF!', bx + w / 2, by + h / 2 + 1, 'bold 14px "Courier New", monospace', '#c4382f', 'center', '#fff', 0);
  ctx.globalAlpha = 1;
}

function wrapText(str, maxW, font) {
  ctx.font = font;
  const words = str.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  lines.push(cur); return lines;
}

// speech bubble: mode 'head' (tail points down to cx) or 'edge' (pinned to a screen edge, tail points off-screen)
function drawSpeech(text, cx, bottomY, mode, side, pulse) {
  const font = 'bold 12px "Courier New", monospace';
  const lines = wrapText(text, 224, font);
  ctx.font = font;
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
  const bw = Math.ceil(tw) + 16, bh = lines.length * 15 + 10;
  let bx, by;
  if (mode === 'edge') {
    const off = Math.round(Math.sin(pulse * 9) * 2.5);
    bx = side === 'left' ? 14 + off : W - 14 - bw - off; by = FEET_Y - 88 - bh / 2;
  } else { bx = clamp(cx - bw / 2, 4, W - 4 - bw); by = bottomY - bh - 8; }
  ctx.fillStyle = '#1c1a26'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#1c1a26';
  if (mode === 'edge') {
    const ty = by + bh / 2, dir = side === 'left' ? -1 : 1, ex = side === 'left' ? bx : bx + bw;
    for (let i = 0; i < 8; i++) { ctx.fillRect(ex + dir * (i + 2) - (dir < 0 ? 1 : 0), ty - (8 - i) - 1, 1, (8 - i) * 2 + 2); }
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) { ctx.fillRect(ex + dir * (i + 1) - (dir < 0 ? 1 : 0), ty - (8 - i), 1, (8 - i) * 2); }
    // arrow chevrons on the edge
    outlineText(side === 'left' ? '<<' : '>>', side === 'left' ? 8 : W - 8, ty - 22, 'bold 14px "Courier New", monospace', '#ff6a5a', 'center', '#1c1a26', 3);
  } else {
    const tx = clamp(cx, bx + 10, bx + bw - 10);
    for (let i = 0; i < 6; i++) { ctx.fillRect(Math.round(tx) - (6 - i) - 1, by + bh + 2 + i - 2, (6 - i) * 2 + 2, 1); }
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) { ctx.fillRect(Math.round(tx) - (6 - i), by + bh + i - 1, (6 - i) * 2, 1); }
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1c1a26'; ctx.font = font;
  lines.forEach((l, i) => ctx.fillText(l, Math.round(bx + 8), Math.round(by + 5 + 7.5 + i * 15 + 1)));
}

function drawWoman() {
  const wm = G.wm;
  if (wm.mode === 'warn') { drawSpeech(wm.line, 0, 0, 'edge', wm.side, wm.pulse); return; }
  if (wm.mode === 'none' && !wm.over && G.state !== 'title') return;
  const sx = Math.round(wm.sx), y = FEET_Y - wm.dh - 30 * WOMAN_SCALE;
  shadow(sx, FEET_Y, 17 * (1 - Math.min(0.5, wm.dh / 250)), 0.28);
  ctx.save(); ctx.translate(sx, 0); ctx.scale(wm.flip ? -1 : 1, 1);
  ctx.drawImage(IMG.woman, wm.frame * 32, wm.row * 32, 32, 32, -16 * WOMAN_SCALE, Math.round(y), 32 * WOMAN_SCALE, 32 * WOMAN_SCALE);
  ctx.restore();
  if (wm.mode === 'charge') drawSpeech(wm.line, sx, FEET_Y - wm.dh - 50, 'head');
}

function drawParts() {
  for (const p of G.parts) {
    const k = 1 - p.t / p.life;
    if (p.k === 'dust') { ctx.globalAlpha = k * 0.7; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.3 - k * 0.5), 0, 6.283); ctx.fill(); }
    else if (p.k === 'spark') { ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.col; const s = Math.round(p.s); ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - s, 2, s * 2); ctx.fillRect(Math.round(p.x) - s, Math.round(p.y) - 1, s * 2, 2); }
    else if (p.k === 'feather') { ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s + 1, p.s - 1); }
    else if (p.k === 'bang') { ctx.globalAlpha = Math.min(1, k * 2); outlineText('!', p.x, p.y, 'bold ' + Math.round(16 + (1 - k) * 6) + 'px "Courier New", monospace', '#fff', 'center'); }
    else if (p.k === 'q') { ctx.globalAlpha = Math.min(1, k * 2); outlineText('?', p.x + Math.sin(p.t * 9) * 3, p.y, 'bold 14px "Courier New", monospace', p.col, 'center'); }
    else if (p.k === 'ring') { ctx.globalAlpha = k * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (let i = 0; i < 2; i++) { ctx.beginPath(); const r = 10 + (1 - k) * (40 + i * 22); if (p.s > 0) ctx.arc(p.x, p.y, r, -0.7, 0.7); else ctx.arc(p.x, p.y, r, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke(); } }
    ctx.globalAlpha = 1;
  }
}

function outlineText(str, x, y, font, col, align = 'left', oc = '#1c1a26', ow = 3) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (ow) { ctx.lineJoin = 'round'; ctx.lineWidth = ow; ctx.strokeStyle = oc; ctx.strokeText(str, Math.round(x), Math.round(y)); }
  ctx.fillStyle = col; ctx.fillText(str, Math.round(x), Math.round(y));
}

function drawHUD() {
  ctx.fillStyle = 'rgba(20,22,34,0.45)'; ctx.fillRect(0, 0, W, 34);
  outlineText('FOOD ' + String(G.score).padStart(4, '0'), W / 2, 13, 'bold 18px "Courier New", monospace', '#fff', 'center');
  outlineText(Math.floor(G.dist) + ' m walked', W / 2, 28, 'bold 10px "Courier New", monospace', '#cfe0ff', 'center', '#1c1a26', 2);
  outlineText('BEST ' + String(G.best).padStart(4, '0'), W - 10, 12, 'bold 12px "Courier New", monospace', '#ffe680', 'right');
  outlineText(Sfx.muted ? 'MUTED (M)' : 'M: mute   P: pause', W - 10, 27, 'bold 10px "Courier New", monospace', '#cfe0ff', 'right', '#1c1a26', 2);
  if (G.state === 'play' && G.hintT < 7 && !touchMode) {
    ctx.globalAlpha = clamp(7 - G.hintT, 0, 1);
    outlineText('ARROWS/AD move  |  UP jump  |  DOWN duck  |  X huff', W / 2, 52, 'bold 12px "Courier New", monospace', '#fff', 'center');
    outlineText('Eat everything! Keep ahead of the left edge.', W / 2, 68, 'bold 11px "Courier New", monospace', '#ffe9a8', 'center', '#1c1a26', 2);
    ctx.globalAlpha = 1;
  }
}

function drawTexts() {
  for (const t of G.texts) {
    ctx.globalAlpha = clamp((1 - t.t / t.life) * 2, 0, 1);
    outlineText(t.str, clamp(t.x, 30, W - 30), t.y, 'bold ' + t.size + 'px "Courier New", monospace', t.col, 'center');
  }
  ctx.globalAlpha = 1;
}

function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(18,20,32,0.72)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6); ctx.globalAlpha = 1;
}

function drawTitle() {
  ctx.fillStyle = 'rgba(20,24,44,0.28)'; ctx.fillRect(0, 0, W, H);
  const bob = Math.sin(G.titleT * 2.2) * 3;
  ctx.save(); ctx.translate(W / 2, 40 + bob); ctx.rotate(Math.sin(G.titleT * 1.3) * 0.015);
  outlineText("Missy's", 0, 0, 'bold 50px "Courier New", monospace', '#fff', 'center', '#2c2a44', 8);
  outlineText('Big Day Out!', 0, 46, 'bold 40px "Courier New", monospace', '#ffe9a8', 'center', '#2c2a44', 8);
  ctx.restore();
  outlineText("Eat everything. Dodge parrots. Don't let her catch you!", W / 2, 118, 'bold 12px "Courier New", monospace', '#fff', 'center');
  panel(130, 134, 380, 106);
  const L = [['LEFT / RIGHT   A / D', 'move'], ['UP / W / SPACE', 'jump (hold = higher)'], ['DOWN / S', 'duck'], ['X / K', 'huff (scares parrots)'], ['P / ESC   M', 'pause   mute']];
  L.forEach((l, i) => { outlineText(l[0], 146, 154 + i * 19, 'bold 12px "Courier New", monospace', '#ffd24a', 'left', '#1c1a26', 2); outlineText(l[1], 494, 154 + i * 19, 'bold 12px "Courier New", monospace', '#fff', 'right', '#1c1a26', 2); });
  if (Math.floor(G.titleT * 1.8) % 2 === 0) outlineText(touchMode ? 'TAP TO START' : 'PRESS SPACE TO START', W / 2, 262, 'bold 18px "Courier New", monospace', '#fff', 'center');
  if (G.best) outlineText('BEST ' + G.best, W / 2, 284, 'bold 12px "Courier New", monospace', '#ffe680', 'center');
}

function drawOver() {
  ctx.fillStyle = 'rgba(20,24,44,0.35)'; ctx.fillRect(0, 0, W, H);
  panel(170, 50, 300, 150);
  outlineText('Oh, Missy!', W / 2, 78, 'bold 34px "Courier New", monospace', '#fff', 'center', '#2c2a44', 6);
  outlineText(G.reason === 'caught' ? 'She caught you!' : 'Squished by the street!', W / 2, 106, 'bold 12px "Courier New", monospace', '#ffb0b0', 'center', '#1c1a26', 2);
  outlineText('Food  ' + G.score, W / 2, 130, 'bold 18px "Courier New", monospace', '#ffe680', 'center');
  outlineText(Math.floor(G.dist) + ' m walked', W / 2, 150, 'bold 12px "Courier New", monospace', '#cfe0ff', 'center', '#1c1a26', 2);
  outlineText(G.newBest ? 'NEW BEST!' : 'Best  ' + G.best, W / 2, 170, 'bold 14px "Courier New", monospace', G.newBest ? '#8affb0' : '#fff', 'center');
  if (G.overT > 0.6 && Math.floor(G.overT * 1.8) % 2 === 0) outlineText(touchMode ? 'TAP TO TRY AGAIN' : 'SPACE / ENTER to try again', W / 2, 190, 'bold 12px "Courier New", monospace', '#fff', 'center', '#1c1a26', 2);
}

function drawPause() {
  ctx.fillStyle = 'rgba(15,18,30,0.6)'; ctx.fillRect(0, 0, W, H);
  outlineText('PAUSED', W / 2, 150, 'bold 40px "Courier New", monospace', '#fff', 'center', '#2c2a44', 7);
  outlineText('press P / Esc to resume', W / 2, 192, 'bold 14px "Courier New", monospace', '#ffe9a8', 'center');
}

function render() {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (G.shake > 0.3) ctx.translate(Math.round(rnd(-G.shake, G.shake) * 0.5), Math.round(rnd(-G.shake, G.shake) * 0.5));
  drawBackground();
  drawEntities();
  drawDog();
  drawWoman();   // in front of everything: she runs through obstacles
  drawParts();
  drawTexts();
  ctx.restore();
  if (G.state === 'title') drawTitle();
  else { drawHUD(); if (G.state === 'over') drawOver(); }
  if (paused) drawPause();
}

// =====================================================================
//  Input
// =====================================================================
let paused = false, touchMode = false;
function press(action) {
  Sfx.unlock();
  if (G.state === 'title') { if (action === 'jump') startGame(); return; }
  if (G.state === 'over') { if (action === 'jump' && G.overT > 0.6) startGame(); return; }
  if (paused || G.state !== 'play') return;
  if (action === 'jump') { G.jumpBuf = BUFFER; G.jumpHeld = true; }
  if (action === 'huff') doHuff();
}
function togglePause() { if (G.state === 'play') paused = !paused; }

addEventListener('keydown', e => {
  const c = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
  if (c === 'ArrowLeft' || c === 'KeyA') kb.left = true;
  else if (c === 'ArrowRight' || c === 'KeyD') kb.right = true;
  else if (c === 'ArrowDown' || c === 'KeyS') { kb.down = true; Sfx.unlock(); }
  if (e.repeat) return;
  if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') press('jump');
  else if (c === 'Enter' && (G.state === 'over' || G.state === 'title')) press('jump');
  else if (c === 'KeyX' || c === 'KeyK') press('huff');
  else if (c === 'KeyP' || c === 'Escape') togglePause();
  else if (c === 'KeyM') Sfx.toggle();
});
addEventListener('keyup', e => {
  const c = e.code;
  if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') G.jumpHeld = false;
  else if (c === 'ArrowLeft' || c === 'KeyA') kb.left = false;
  else if (c === 'ArrowRight' || c === 'KeyD') kb.right = false;
  else if (c === 'ArrowDown' || c === 'KeyS') kb.down = false;
});
addEventListener('blur', () => { if (G.state === 'play') paused = true; kb.left = kb.right = kb.down = false; vk.left = vk.right = vk.down = false; G.jumpHeld = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.pointerType === 'touch') setTouch();
  if (e.button === 2) press('huff'); else press('jump');
});
addEventListener('pointerup', () => { G.jumpHeld = false; });
function bindBtn(id, down, up) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); Sfx.unlock(); down(); });
  const rel = () => { el.classList.remove('on'); if (up) up(); };
  el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('pointerleave', rel);
}
bindBtn('bLeft', () => { vk.left = true; }, () => { vk.left = false; });
bindBtn('bRight', () => { vk.right = true; }, () => { vk.right = false; });
bindBtn('bDuck', () => { vk.down = true; }, () => { vk.down = false; });
bindBtn('bJump', () => press('jump'), () => { G.jumpHeld = false; });
bindBtn('bHuff', () => press('huff'));
function setTouch() { touchMode = true; document.body.classList.add('touch'); }
if ('ontouchstart' in window || (window.matchMedia && matchMedia('(pointer: coarse)').matches)) setTouch();

function resize() {
  const r = Math.min(innerWidth / W, innerHeight / H);
  const s = r >= 1 ? Math.max(1, Math.floor(r * 4) / 4) : r;
  const wrap = document.getElementById('wrap');
  wrap.style.width = Math.floor(W * s) + 'px'; wrap.style.height = Math.floor(H * s) + 'px';
  cv.style.width = '100%'; cv.style.height = '100%';
}
addEventListener('resize', resize); resize();

// =====================================================================
//  Main loop (fixed timestep)
// =====================================================================
let last = 0, acc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!last) last = ts;
  acc += Math.min(0.1, (ts - last) / 1000); last = ts;
  let n = 0;
  while (acc >= DT && n < 5) { if (!paused && !window.__freeze) update(DT); acc -= DT; n++; }
  if (n === 5) acc = 0;
  if (G.state !== 'loading') render();
}

async function init() {
  ctx.fillStyle = '#14161d'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.fillText('Loading...', W / 2, H / 2);
  try { await loadAll(); } catch (e) { ctx.fillText('Failed to load: ' + e, W / 2, H / 2 + 30); throw e; }
  buildScenery(); layoutBuildings(); layoutDecor(); OBST = obstacleDefs();
  resetGame(); G.state = 'title'; G.titleT = 0; G.cam = 300;
  G.dog.x = 300 + 340; G.wm.over = true; G.wm.sx = 240; G.wm.flip = false;
  debugRun();
  requestAnimationFrame(frame);
}
init();

// ---- debug hook for headless screenshots: ?scn=play|hop|parrot|warn|charge|stand|duck|over|trap|stun ----
function step(n) { for (let i = 0; i < n; i++) update(DT); }
function debugRun() {
  const q = new URLSearchParams(location.search), scn = q.get('scn');
  window.__G = G; window.__dbg = { step, startWoman, spawnParrot, addObstacle, addFood, OBST: () => OBST };
  if (!scn) return;
  const ob = n => OBST.find(o => o.name === n);
  if (scn !== 'title') startGame();
  const d = G.dog;
  G.nextParrot = 1e9; G.nextWoman = 1e9;
  G.entities = []; G.nextSpawnX = 1e9;
  if (scn === 'play') { G.nextSpawnX = 480; G.nextParrot = 1e9; step(100); for (const e of G.entities) if (e.type === 'obst' && e.x < G.cam + W) { /* keep */ } }
  if (scn === 'hop') { addFood(d.x + 90, 2, 'meat1'); addFood(d.x + 160, 2, 'salmon'); addFood(d.x + 40, 2, 'fish'); addFood(d.x - 70, 2, 'bacon'); step(24); }
  if (scn === 'parrot') { spawnParrot('head', d.x + 120); spawnParrot('low', d.x + 230); spawnParrot('sine', d.x + 330); step(6); }
  if (scn === 'warn') { startWoman({ side: 'left', beh: 'run' }); step(70); }
  if (scn === 'charge') { startWoman({ side: 'right', beh: 'run', warnT: 0.1 }); step(100); }
  if (scn === 'stand') { const o = addObstacle(d.x - 40, ob('dumpster')); addFood(d.x + 60, o.h + 2, 'bone'); d.dh = o.h; d.dv = 0; d.ground = true; d.x += 10; step(3); }
  if (scn === 'duck') { kb.down = true; spawnParrot('head', d.x + 70); step(8); }
  if (scn === 'over') { startWoman({ side: 'left', beh: 'run', warnT: 0.01 }); G.wm.sx = S2(d.x) - 40; step(30); }
  if (scn === 'trap') { d.x = G.cam + 70; addObstacle(d.x + HW + 6, ob('crate2')); step(60); }
  if (scn === 'trapfreeze') { d.x = G.cam + 70; addObstacle(d.x + HW + 6, ob('crate2')); for (let i = 0; i < 600 && G.state === 'play'; i++) step(1); step(70); }
  if (scn === 'fuzz') { // headless self-test: every woman behaviour terminates; random-input run survives 60s of game time
    const res = []; let caught = 0;
    for (const beh of ['run', 'sprint', 'lunge', 'hop', 'turn', 'leap']) for (const side of ['left', 'right']) {
      G.wm = newWoman(); G.dog.x = G.cam + 300; startWoman({ beh, side, warnT: 0.1 }); let n = 0;
      while (G.wm.mode !== 'none' && G.state === 'play' && n < 3000) { G.dog.stun = 0; G.wm.over = false; step(1); if (G.state === 'over') { G.state = 'play'; caught++; } G.dog.x = G.cam + 560; n++; }
      res.push(beh + side[0] + ':' + n); G.wm.mode = 'none';
      G.nextWoman = 1e9;
    }
    startGame(); G.nextWoman = 1e9; let over = -1, jumps = 0;
    for (let i = 0; i < 3600 && G.state === 'play'; i++) {
      kb.right = (i % 200) < 120; kb.left = !kb.right && (i % 7 === 0); kb.down = (i % 90) > 70;
      if (i % 25 === 0) { G.jumpBuf = BUFFER; G.jumpHeld = true; jumps++; } if (i % 25 === 12) G.jumpHeld = false;
      if (i % 50 === 0) doHuff();
      step(1);
    }
    kb.right = kb.left = kb.down = false;
    document.title = JSON.stringify({ caught, res, state: G.state, reason: G.reason, score: G.score, dist: Math.floor(G.dist), ents: G.entities.length });
  }
  if (scn === 'stun') { G.score = 1; spawnParrot('head', d.x + 20); step(10); }
  if (q.has('freeze')) window.__freeze = true;
}
