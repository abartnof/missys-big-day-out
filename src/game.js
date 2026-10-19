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
const RUN_R = 275, RUN_L = 150, DUCK_V = 60;             // dog speeds px/s
const GRAVITY = 1700, JUMP_V = 560, JUMP_CUT = 0.5;
const COYOTE = 0.1, BUFFER = 0.12;
const DT = 1 / 60;
const STORE = { best: 'missys_best' };

const cv = document.getElementById('c');
let ctx = cv.getContext('2d');   // (let: drawLB briefly renders into an offscreen canvas)
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';   // all debug URL hooks need ?debug=1; debug runs never touch localStorage
let dbgLB = null;

// ---------- asset loading (no fetch: works from file://) ----------
const IMG = {};
const HIGH = ['meat1', 'bacon', 'sausage_p', 'salmon'];
const FOODS = ['dry_dog_food', 'meat1', 'bacon', 'sausage_p', 'fish', 'salmon', 'rubber_duck', 'milk_chocolate',
  'red_grape', 'green_grape', 'wine_red', 'coffee_bag', 'bone', 'bone2'];
const REGULAR = FOODS.filter(f => !HIGH.includes(f));
const PARROTS = ['green', 'green', 'blue', 'red', 'grey'];
const LINES = [
  "I have to fly to Columbus tomorrow!", "You're allergic to that!", "I already fed you!", "Who even left that food there?",
  "I have to fly to New York tomorrow!", "It's about to rain, hurry up!", "No, we're not going across the street!",
  "It's bedtime!", "I'm watching my stories on TV right now!", "I just fed you!", "No, we just went out!",
  "Are you kidding? Survivor just started!", "Do you know what time it is?", "Stop huffing, go lay down",
  "Stop looking at me like that", "Your breath is terrible!", "Go to your bed!",
  "I have to send this SD card to my gaffer over Slack!", "I have a sweet potato in the oven!",
  "It's so warm, why am I wearing a hoodie!", "You're an angel!",
  "I've had enough of your shenanigans!", "I need you to do your business and come in!",
  "You're a princess!", "Why is your mouth so wet?", "You're doing that stare again!", "We never go down this street!",
  "I was just napping after flying back from Atlanta!",
];

function loadImage(src) {
  const url = (window.__ASSETS && window.__ASSETS[src]) || src;
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(src); i.src = url; });
}
async function loadAll() {
  const files = { dog: 'spaniel.png', woman: 'woman.png', general: 'general.png', bgs1: 'bgs1.png', skyline_far: 'skyline_far.png', bones: 'bones.png',
    bird_green: 'bird_green.png', bird_blue: 'bird_blue.png', bird_red: 'bird_red.png', bird_grey: 'bird_grey.png', toilet: 'toilet.png',
    critter_rabbit: 'critter_rabbit.png', critter_cat: 'critter_cat.png', critter_frog: 'critter_frog.png' };
  for (const v of VILLAGERS) files['vill_' + v] = 'villagers/' + v + '.png';
  const jobs = Object.entries(files).map(async ([k, f]) => { IMG[k] = await loadImage('assets/' + f); });
  if (document.fonts) jobs.push(document.fonts.load('16px "DotGothic16"').catch(() => {}));
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


// ---------- prerendered scenery (rebuilt for every level so each street looks different) ----------
const BUILDINGS = [];       // building / alley canvases for the 0.5x row
const DECOR_DEFS = [];
const CLOUDS = [];          // pre-rendered chunky pixel clouds
let TOWERS = null;          // hazy mid skyline (bgs1, tinted)
const PROP_SCALE = 2;
const BRICKS = [[0, 48], [96, 144], [48, 96], [0, 144], [48, 144], [0, 96]];   // brick colour pairs per level

function propSprite(name, sub) { // returns {x,y,w,h} rect in general.png
  const p = PROPS[name];
  return sub ? { x: p[0] + sub[0], y: p[1] + sub[1], w: sub[2], h: sub[3] } : { x: p[0], y: p[1], w: p[2], h: p[3] };
}

function haze(c, a, col = '185,200,225') {
  const x = c.getContext('2d'); x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(' + col + ',' + a + ')'; x.fillRect(0, 0, c.width, c.height);
}

function makeAlley(w, h, rng, lv, n = 0, styleName = 'downtown') {
  const c = mkCanvas(w, h), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a303e'); g.addColorStop(1, '#3d4658');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(0,0,0,0.22)';                       // recessed brick courses
  for (let y = 6; y < h; y += 12) { x.fillRect(0, y, w, 2); const off = (y / 12 % 2) * 12; for (let bx = off; bx < w; bx += 24) x.fillRect(bx, y - 12, 2, 12); }
  x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, 8, h); x.fillRect(w - 8, 0, 8, h);   // dark sides: deep slot
  x.fillStyle = '#1b1f2b'; x.fillRect(0, 0, w, 6);
  addAlleyFlavor(x, w, h, lv, n, styleName);
  if (rng() < 0.7) {                                       // fire escape
    const col = '#161a24', hl = '#4b5468';
    const plat = [h - 140, h - 90, h - 40];
    plat.forEach((py, i) => {
      x.fillStyle = col; x.fillRect(12, py, w - 24, 4); x.fillStyle = hl; x.fillRect(12, py, w - 24, 1);
      x.fillStyle = col; x.fillRect(12, py - 14, 2, 14); x.fillRect(w - 14, py - 14, 2, 14); x.fillRect(12, py - 14, w - 24, 2);
      for (let k = 0; k < 4; k++) x.fillRect(16 + k * ((w - 36) / 3), py - 12, 2, 12);
      if (i < 2) { // stairs down to the next platform
        const nx = i % 2 ? 16 : w - 40, dir = i % 2 ? 1 : -1;
        for (let s = 0; s < 8; s++) x.fillRect(nx + dir * 0 + s * 3 * (i % 2 ? 1 : -1) * -1 + (i % 2 ? 0 : 24), py + 4 + s * 6, 8, 3);
      }
    });
    x.fillStyle = col; x.fillRect(w / 2 - 8, plat[2] + 4, 2, h - plat[2] - 4); x.fillRect(w / 2 + 6, plat[2] + 4, 2, h - plat[2] - 4);
    for (let ry = plat[2] + 10; ry < h - 6; ry += 8) x.fillRect(w / 2 - 8, ry, 16, 2);
  }
  // clutter at the base
  const g2 = IMG.general;
  if (w >= 96 && rng() < 0.7) { const r = propSprite('dumpster'); x.drawImage(g2, r.x, r.y, r.w, r.h, w - r.w * 2 - 4, h - r.h * 2 + 2, r.w * 2, r.h * 2); }
  else { const r = propSprite('crateS'); x.drawImage(g2, r.x, r.y, r.w, r.h, 12, h - r.h * 2 + 2, r.w * 2, r.h * 2); }
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(20,24,40,0.28)'; x.fillRect(0, 0, w, h);
  return c;
}

function makeCloud(w, h, rng, alpha) {
  const c = mkCanvas(w, h), x = c.getContext('2d'), P = 4;     // chunky 4px cells
  const blobs = []; const n = 4 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) blobs.push([w * (0.2 + 0.6 * i / (n - 1)), h * (0.62 - 0.22 * Math.sin(Math.PI * i / (n - 1)) * (0.6 + rng() * 0.5)), h * (0.26 + rng() * 0.2)]);
  for (let cy = 0; cy < h; cy += P) for (let cx = 0; cx < w; cx += P) {
    let inside = false;
    for (const [bx, by, br] of blobs) if (Math.hypot(cx + 2 - bx, (cy + 2 - by) * 1.15) < br) inside = true;
    if (!inside || cy > h * 0.78) continue;
    const under = cy > h * 0.55;
    x.fillStyle = under ? 'rgba(214,228,246,' + alpha + ')' : 'rgba(255,255,255,' + alpha + ')';
    x.fillRect(cx, cy, P, P);
  }
  return c;
}

// each level's street gets its own look: which windows and shopfronts it uses, how tall it is,
// how much brick, and a texture skin (canvas blend modes over the stone facades)
const STREET_STYLES = [
  { name: 'downtown', win: [0, 1, 2, 3, 0], shop: [0, 1, 2, 3], oneFloor: 0.55, brickP: 0.45, skin: [] },
  { name: 'suburbs', win: [1, 3, 3, 0], shop: [1, 2, 2], oneFloor: 0.9, brickP: 0, skin: [['color', '#f0d48c', 0.45], ['screen', '#fff4e0', 0.18]] },
  { name: 'brick', win: [0, 2, 3, 0], shop: [0, 1, 2], oneFloor: 0.35, brickP: 0.7, skin: [['color', '#b4502e', 0.5], ['multiply', '#d8a890', 0.25]] },
  { name: 'glass', win: [0, 2, 2, 0], shop: [0, 2], oneFloor: 0.15, brickP: 0.1, skin: [['color', '#3f78c0', 0.4], ['screen', '#cfe6ff', 0.1]] },
  { name: 'decay', win: [4, 4, 2, 4, 1], shop: [0, 0, 3, 3], oneFloor: 0.5, brickP: 0.4, skin: [['color', '#7d6d52', 0.45], ['multiply', '#8d877a', 0.45]] },
];
function buildScenery(lv = 1) {
  const g = IMG.general;
  BUILDINGS.length = 0; CLOUDS.length = 0;
  const rng = makeRng(1234 + lv * 7919);
  const rp = a => a[Math.floor(rng() * a.length)];
  const wins = [64, 96, 128, 160, 192].map(x => ({ x, y: 0, w: 32, h: 32, u: 2 }));   // 4-pane, blinds, dark, curtained, boarded
  const allShops = [{ x: 256, y: 0, w: 48, h: 48, u: 3 }, { x: 304, y: 0, w: 32, h: 48, u: 2 }, { x: 336, y: 0, w: 32, h: 48, u: 2 }, { x: 368, y: 0, w: 32, h: 48, u: 2 }];   // shutter, door, awning, posters
  const style = STREET_STYLES[(lv - 1) % STREET_STYLES.length];
  const windows = style.win.map(i => wins[i]), shops = style.shop.map(i => allShops[i]);
  const bricks2 = [0, 48, 96, 144].map(y => ({ x: 456, y, w: 32, h: 48, u: 2 }));
  const bricks3 = [0, 48, 96, 144].map(y => ({ x: 448, y, w: 48, h: 48, u: 3 }));
  const pair = BRICKS[(lv - 1) % BRICKS.length];
  function fillRow(units, pool2, pool3) {
    const row = []; let left = units;
    while (left > 0) {
      let m;
      if (left === 2 || left === 4 || !pool3.length) m = rp(pool2);
      else if (left === 3) m = rp(pool3);
      else m = rng() < 0.5 ? rp(pool2) : rp(pool3);
      row.push(m); left -= m.u;
    }
    return row;
  }
  const S = 2, hazeA = 0.18 + 0.05 * ((lv - 1) % 3);
  for (let n = 0; n < 12; n++) {
    const units = [4, 6, 6, 8][Math.floor(rng() * 4)];
    const rows = [];                                   // top -> bottom
    const upper = rng() < style.oneFloor ? 1 : 2;
    const brickRow = upper === 2 && rng() < style.brickP;
    for (let f = 0; f < upper; f++) {
      if (brickRow && f === 0) { const by = rp(pair); rows.push(fillRow(units, bricks2.filter(b => b.y === by), bricks3.filter(b => b.y === by))); }
      else rows.push(fillRow(units, windows, windows));
    }
    rows.push(fillRow(units, shops.filter(s => s.u === 2), shops.filter(s => s.u === 3)));
    const bw = units * 16 * S;
    const heights = rows.map(r => Math.max(...r.map(m => m.h)));
    const bh = heights.reduce((a, b) => a + b, 0) * S + ROOF_PAD;
    const c = mkCanvas(bw, bh), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    let py = 0; const mods = [];
    rows.forEach((row, ri) => {
      let px = 0; const rh = heights[ri];
      for (const m of row) { const my = (py + rh - m.h) * S + ROOF_PAD; x.drawImage(g, m.x, m.y, m.w, m.h, px, my, m.w * S, m.h * S); mods.push({ m, X: px, Y: my, ri, shop: ri === rows.length - 1 }); px += m.w * S; }
      py += rh;
    });
    for (const [mode, col, a] of style.skin) { x.save(); x.globalCompositeOperation = mode; x.globalAlpha = a; x.fillStyle = col; x.fillRect(0, 0, bw, bh); x.restore(); }
    addBuildingFlavor(c, mods, style, lv, n);
    haze(c, hazeA);
    BUILDINGS.push(c);
  }
  // alleys: a recessed dark slot (fire escape, dumpster) instead of an empty gap
  for (let n = 0; n < 3; n++) BUILDINGS.push(makeAlley(n === 0 ? 64 : 96, 190, rng, lv, n, style.name));
  // mid skyline, tinted hazier and bluer for depth
  TOWERS = mkCanvas(640, 360); TOWERS.getContext('2d').drawImage(IMG.bgs1, 0, 0);
  haze(TOWERS, 0.38, '160,200,235');
  // two depths of chunky pixel clouds
  const cr = makeRng(500 + lv);
  // three depths of clouds, each drifting at its own pace (farther = smaller, paler, slower)
  for (let i = 0; i < 6; i++) CLOUDS.push({ img: makeCloud(44, 16, cr, 0.5), x: i * 160 + cr() * 70, y: 22 + cr() * 40, k: 0.015, v: 0.8 + cr() * 1.2, P: 980, layer: 0 });
  for (let i = 0; i < 5; i++) CLOUDS.push({ img: makeCloud(72, 26, cr, 0.7), x: i * 190 + cr() * 80, y: 40 + cr() * 50, k: 0.03, v: 2 + cr() * 2, P: 950, layer: 1 });
  for (let i = 0; i < 4; i++) CLOUDS.push({ img: makeCloud(128, 40, cr, 0.9), x: i * 240 + cr() * 90, y: 52 + cr() * 60, k: 0.07, v: 5 + cr() * 3, P: 960, layer: 2 });
  // decorative sidewalk-edge props (static definitions, laid out per level)
  if (!DECOR_DEFS.length) {
    const mk = (name, sub) => ({ r: propSprite(name, sub) });
    DECOR_DEFS.push(mk('tree1'), mk('tree2'), mk('bare'), mk('hedge'), mk('hedgeLong'), mk('pot1'), mk('pot2'));
    DECOR_DEFS.forEach(d => { d.kind = 'prop'; });
    DECOR_DEFS.push({ kind: 'lamp', r: propSprite('lampHead') });
  }
}

// ---------- levels ----------
const LEVEL_M = 75, M_PX = 40;                   // a level is 75 m; 1 m = 40 px of camera travel
const LEVEL_PX = LEVEL_M * M_PX;                 // camera position at which the scroll has stopped (3000)
const STOP_START = LEVEL_PX - 60;                // toilet fully on screen: start easing the scroll to a stop
const TOILET_X = LEVEL_PX + W - 64 - 60;         // world x of the toilet (64 px wide)
const NOSPAWN_X = LEVEL_PX + W - 12 * M_PX;      // nothing hazardous spawns in the last ~12 m
const INTRO = "Eat everything you can! Avoid the parrots and don't get caught by your owner!";
const LB_KEY = 'missys_scores', BESTLV_KEY = 'missys_bestlevel';

function levelCfg(n) {
  const lv = Math.max(1, n);
  return {
    cam: Math.min(88 + (lv - 1) * 7, 140),
    womanCount: Math.min(5, 2 + Math.floor(lv / 2)),
    womanV: Math.min(185 + (lv - 1) * 8, 245),   // faster is easier to jump over (she spends less time under Missy)
    parrotV: Math.min(175 + (lv - 1) * 7, 225),             // screen-space flight speed (px/s): always slow enough to react to
    parrotCount: Math.min(16, 11 + lv),
    warnT: 1.0 - 0.15 * clamp((lv - 1) / 7, 0, 1),         // off-screen warning before a parrot enters (s): never under 0.85
    dipW: Math.max(65, 100 - (lv - 2) * 7),
    obstP: Math.min(0.58, 0.46 + 0.02 * (lv - 1)),
    obstGap: [Math.max(180, 240 - 15 * (lv - 1)), Math.max(280, 370 - 20 * (lv - 1))],
    highP: Math.max(0.07, 0.17 - 0.015 * (lv - 1)),
    behaviors: ['run', lv >= 3 && 'sprint', lv >= 4 && 'lunge', lv >= 4 && 'hop', lv >= 5 && 'turn', lv >= 6 && 'leap'].filter(Boolean),
    parrotKinds: ['cruiser', lv >= 2 && 'swooper', lv >= 3 && 'percher', lv >= 4 && 'thief', lv >= 5 && 'flock', lv >= 6 && 'mimic'].filter(Boolean),
  };
}

// ---------- obstacles (solid, static in the world; sprites from general.png at 2x) ----------
function obstacleDefs() {
  const d = (name, r, weight, minLevel = 1, tall = false) => ({ name, r, weight, tall, minLevel, w: r.w * 2, h: r.h * 2 });
  return [
    d('cone', propSprite('cones', [0, 0, 15, 13]), 2), d('bags', propSprite('bags', [0, 0, 27, 15]), 2), d('hydrant', propSprite('hydrant'), 2),
    d('can', propSprite('can'), 2), d('bollard', propSprite('bollard'), 2), d('crate', propSprite('crateS', [0, 16, 17, 16]), 3),
    d('barrier', propSprite('barrier'), 1, 2), d('bag', propSprite('bag'), 1, 3),
    d('crate2', propSprite('crateS'), 0.6, 3, true), d('dumpster', propSprite('dumpster'), 0.6, 4, true),
  ];
}
let OBST = [];

// ---------- game state ----------
const G = {
  state: 'loading', t: 0, cam: 0, speed: 75, dist: 0, score: 0, best: 0, bestLevel: 1, newBest: false, reason: '',
  level: 1, cfg: null, stage: 'run', levelStart: 0, cardT: 0,
  entities: [], parts: [], texts: [], dog: null, wm: null, mimic: null, nextSpawnX: 0, parrotPlan: [], parrotIdx: 0, warns: [], seen: {}, solo: false, womanPlan: [], womanIdx: 0, lastLine: '',
  jumpBuf: 0, jumpHeld: false, titleT: 0, shake: 0, hintT: 0, overT: 0, holdT: 0, winT: 0, phase: '', lieT: 0, toilet: null,
  lb: [], rank: 0, showLB: false, clearHold: 0, pushCd: 0, wasPush: false, pendingMimic: -1,
};
const kb = { left: false, right: false, down: false, clear: false }, vk = { left: false, right: false, down: false };
try {
  G.best = parseInt(localStorage.getItem(STORE.best) || '0', 10) || 0;
  G.bestLevel = parseInt(localStorage.getItem(BESTLV_KEY) || '1', 10) || 1;
  if (DEBUG) { G.best = 0; G.bestLevel = 1; }
} catch (e) {}

// ---------- leaderboard (top 10, localStorage) ----------
function loadLB() {
  if (DEBUG) return dbgLB ? dbgLB.slice() : [];
  try {
    const a = JSON.parse(localStorage.getItem(LB_KEY) || '[]');
    if (!Array.isArray(a)) return [];
    const num = v => (typeof v === 'number' || typeof v === 'string') && v !== '' && isFinite(+v) ? +v : NaN;
    const out = [];
    for (const e of a) {
      if (!e || typeof e !== 'object') continue;
      const t = num(e.t), level = Math.floor(num(e.level)), m = Math.floor(num(e.m)), score = Math.floor(num(e.score));
      if (!isFinite(t) || !isFinite(level) || !isFinite(m) || !isFinite(score) || level < 1 || m < 0 || score < 0 || level > 9999 || m > 9999 || score > 9999999) continue;
      out.push({ t, level, m, score });
    }
    return out;
  } catch (e) { return []; }
}
function saveLB(a) { if (DEBUG) { dbgLB = a.slice(); return; } try { localStorage.setItem(LB_KEY, JSON.stringify(a)); } catch (e) {} }
function addScore() {
  const lb = loadLB();
  const entry = { t: Date.now(), score: G.score, level: G.level, m: Math.min(LEVEL_M, Math.floor(G.dist)) };
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score || a.t - b.t);
  const top = lb.slice(0, 10);
  const rank = top.indexOf(entry) + 1;
  saveLB(top); G.lb = top;
  return rank;
}
function clearLB() { saveLB([]); G.lb = []; G.rank = 0; }
function fmtDate(t) {
  const d = new Date(t), mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  return mo + ' ' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function newDog() {
  return { x: 220, dh: 0, dv: 0, ground: true, coyote: 0, jumpCut: false, face: 1, ducking: false, stun: 0, inv: 0,
    huffCd: 0, bubble: 0, row: 0, frame: 0, ft: 0, tilt: 0, oy: 0, sniffTick: 0, landT: 0, airT: 0, vx: 0, h: STAND_H, stepped: false };
}
function newWoman() {
  return { mode: 'none', sx: -100, dh: 0, dv: 0, dir: 1, v: 0, beh: 'run', line: '', side: 'left', t: 0, warnT: 0, ft: 0, frame: 0, row: 0,
    turned: false, entered: false, x0: 0, x1: 0, flip: false, over: false, dodged: false, prevSign: 0, phase: 'run', pt: 0, marks: [], markIdx: 0 };
}

// back to the title screen (after game over). The game-over song is allowed to finish; then the title song loops.
// the title loops Mozart's Rondo alla Turca; starting a run switches to the level song
function playTitleSong() { if (Sfx.music.current() !== 'turkish') Sfx.music.play('turkish'); }
let hiTimer = 0;
function goToTitle() {
  clearTimeout(hiTimer); Sfx.music.setLevel(1);
  G.state = 'title'; G.titleT = 0; G.showLB = false; G.cam = 0; G.dist = 0; G.level = 1; G.cfg = levelCfg(1);
  buildScenery(1); layoutBuildings(1); layoutDecor(1); layoutFG(1);
  G.entities = []; G.parts = []; G.texts = []; G.mimic = null; G.critter = null; G.shake = 0;
  G.dog = newDog(); G.wm = newWoman(); G.wm.over = true; G.wm.sx = 240; G.wm.flip = false;
  if (Sfx.music.current() !== 'home' || G.homeDone) playTitleSong();
}
// a fresh run: level 1, score 0
function startGame() {
  clearTimeout(hiTimer);
  G.score = 0; G.newBest = false; G.reason = ''; G.rank = 0; G.t = 0; G.seen = {};
  startLevel(1); G.bannerT = 3.4;
  G.state = 'play';
}
// begin level n (street, camera, Missy and the owner are reset; score is carried over)
// NES rules: every NPC follows a pre-determined schedule and pattern (by type + level + a seeded random)
// and never reads Missy's position or velocity. Difficulty comes from speed, density and pattern complexity.
const BEH_UNLOCK = { sprint: 3, lunge: 4, hop: 4, turn: 5, leap: 6 };
// ---- timeline helpers for levels 1-4 (one coherent schedule in camera-x; seconds <-> camera px via the level's scroll ramp) ----
const SOLO_X = W * 0.45;          // a solo introduction ends once the new parrot has flown past this FIXED screen x
const CLEAR_X = W * 0.5;         // the owner may start once every parrot out is within OWNER_LEAD s of this screen x
const OWNER_LEAD = 1.8;          // (she needs ~2.4 s of warning plus time to run in, so a parrot still on its way out is fine)
const WARN_T = 2.4;              // owner warning before she appears
const K_RAMP = 0.18 / LEVEL_PX;  // scroll speed = cfg.cam * (1 + K_RAMP * cam)
const camAt = (t, c) => (Math.exp(K_RAMP * c * t) - 1) / K_RAMP;
function womanCrossT(beh, v) { return (W + 110) / v + ({ lunge: 0.5, hop: 1.3, turn: 0.5, leap: 0.6 }[beh] || 0.2); }
function womanFreeAt(wm) { return 0.35 * womanCrossT(wm.beh, wm.v); }     // parrots may be released again once she is this far into her run
function parrotSpeed(kind, first, cfg) {      // screen-space speed of a parrot's approach (px/s)
  const v = cfg.parrotV * (first ? 0.75 : 1);
  return kind === 'percher' ? cfg.cam * 1.1 : kind === 'thief' ? Math.max(v * 1.6, 190) : v;
}
function parrotTimes(it, first, cfg) {        // seconds after release: [until clear of the owner's lead, until a solo intro ends, extra gap after the last member]
  const T = cfg.warnT + (first ? 0.3 : 0), sp = parrotSpeed(it.kind, first, cfg), x0 = W + (it.kind === 'percher' ? 90 : 40);
  const tail = it.pair ? 230 / cfg.parrotV : it.kind === 'flock' ? 3 * 74 / cfg.parrotV : 0;
  return { life: T + (x0 + 120) / sp + tail, clear: Math.max(0, T + (x0 - CLEAR_X) / sp + tail - OWNER_LEAD), solo: first ? T + (x0 - SOLO_X) / sp : 0, tail };
}
// lay the plan out on the timeline: groups of parrots, each group followed by an owner charge (the last charge sits at the tail of the level)
function layoutTimeline(P, C, cfg, extra, seen) {
  const gap = Math.max(1.0, 1.4 - 0.05 * (G.level - 1)), c = cfg.cam;
  const tCut = Math.log(1 + K_RAMP * (NOSPAWN_X - W - 60)) / (K_RAMP * c);
  const out = { parr: [], wom: [], ok: true }, seen2 = Object.assign({}, seen);
  let cur = 260 / c, k = 0, ei = 0, busy = 0, wEnd = 0;      // busy: when every parrot released so far has left the screen (a new type waits for that)
  const nG = C.length;
  for (let g = 0; g < nG; g++) {
    const size = Math.floor(P.length / nG) + (g < P.length % nG ? 1 : 0);
    let aMin = cur;
    for (let j = 0; j < size; j++, k++) {
      const it = P[k], first = !seen2[it.kind]; seen2[it.kind] = true;
      const tm = parrotTimes(it, first, cfg);
      if (first) cur = Math.max(cur, busy, wEnd);   // a new type waits for the street (and the owner) to be clear
      out.parr.push(cur); busy = Math.max(busy, cur + tm.life);
      aMin = Math.max(aMin, cur + tm.clear, cur + tm.solo);
      cur = Math.max(cur + gap + tm.tail * (it.pair ? 1 : 0) + (it.pair ? 1.2 : 0), cur + tm.solo) + extra[ei++];
    }
    const A = Math.max(aMin, cur - gap) + extra[ei++];     // the owner starts after the group has cleared
    out.wom.push(A);
    const wv = { beh: C[g].beh, v: cfg.womanV * (C[g].beh === 'sprint' ? 1.35 : 1) * C[g].vMul };
    cur = A + WARN_T + womanFreeAt(wv) + 0.3; wEnd = A + WARN_T + womanCrossT(wv.beh, wv.v) + 0.3;
    if (g === nG - 1 && A > tCut) out.ok = false;
  }
  out.slack = tCut - out.wom[nG - 1];
  return out;
}
function buildPlans(n) {
  const cfg = G.cfg, rng = makeRng(9001 + n * 131);
  const kinds = cfg.parrotKinds, newest = n > 1 && n <= 6 ? kinds[kinds.length - 1] : null;
  const lo = 640, hi = NOSPAWN_X - W - 320, early = n <= 4;
  const cnt = early ? [9, 10, 11, 12][n - 1] : cfg.parrotCount;
  let P = [];
  for (let i = 0; i < cnt; i++) {
    const at = Math.round(lo + (hi - lo) * 0.92 * i / Math.max(1, cnt - 1) + (i ? (rng() - 0.5) * 100 : 0));
    let kind = kinds[Math.floor(rng() * kinds.length)];
    if (i === 0 && newest) kind = newest;
    const teaser = n === 1 && i === cnt - 1;
    if (teaser) kind = 'swooper';   // a gentle teaser of level 2, introduced alone like any new type
    const pair = kind === 'cruiser' && rng() < (n === 1 ? 0.3 : n <= 3 ? 0.25 : 0.2), lowFirst = rng() < 0.5;   // pair: head + low heights, a comfortable distance apart
    P.push({ teaser, at, kind, pair, low: kind === 'cruiser' && (pair ? lowFirst : rng() < 0.35), variant: PARROTS[Math.floor(rng() * PARROTS.length)] });
  }
  const c = early ? [2, 2, 3, 3][n - 1] : cfg.womanCount, ats = c === 1 ? [1050] : Array.from({ length: c }, (_, i) => 800 + (1500 * i) / (c - 1));
  const fresh = cfg.behaviors.filter(b => BEH_UNLOCK[b] === n);
  let C = ats.map((at, i) => ({ at, side: rng() < 0.5 ? 'left' : 'right', mimic: n >= 7 && rng() < 0.5, vMul: n === 1 && i === 1 ? 1.15 : 1,
    beh: i === 0 && fresh.length ? fresh[Math.floor(rng() * fresh.length)] : cfg.behaviors[Math.floor(rng() * cfg.behaviors.length)] }));
  if (early) {       // slow, long-lived kinds (percher, thief) are limited early on so the level still has room for the rest
    const cap = { percher: 2, thief: 2 }, nSeen = {};
    P.forEach((it, i) => { nSeen[it.kind] = (nSeen[it.kind] || 0) + 1; if (cap[it.kind] && nSeen[it.kind] > cap[it.kind] && !it.teaser) { it.kind = 'cruiser'; it.pair = false; } });
  }
  if (early) {
    // one timeline: owner charges reserve their own windows and parrots fill the gaps, so nothing queues up or gets dropped
    const seen = Object.assign({}, G.seen), zero = () => new Array(P.length + C.length + 2).fill(0), full = P.slice(), fullC = C.slice();
    // the teaser leads the last group (right after a charge, when the street is clear) so its solo introduction costs no extra waiting
    const placeTeaser = (list, nc) => {
      const t = list.findIndex(x => x.teaser); if (t < 0 || nc < 2) return;
      const [it] = list.splice(t, 1), m = list.length + 1;
      let idx = 0; for (let g = 0; g < nc - 1; g++) idx += Math.floor(m / nc) + (g < m % nc ? 1 : 0);
      list.splice(idx, 0, it);
    };
    let lay;
    for (let nc = fullC.length; nc >= 2; nc--) {      // keep as many charges as leave room for at least 7 parrots (never fewer than 2 charges)
      C = fullC.slice(0, nc); P = full.slice(); placeTeaser(P, nc);
      lay = layoutTimeline(P, C, cfg, zero(), seen);
      while (!lay.ok && P.length > nc + 2) {
        let drop = 1 + Math.floor(rng() * (P.length - 1)); if (P[drop].teaser) drop = 0 + (drop > 1 ? drop - 1 : drop + 1);   // never the first (new type) or the teaser
        P.splice(drop, 1); placeTeaser(P, nc); lay = layoutTimeline(P, C, cfg, zero(), seen);
      }
      if (lay.ok && (P.length >= 7 || nc === 2)) break;
    }
    if (lay.ok && lay.slack > 0) {                                  // spread what is left over, seeded
      const m = P.length + C.length, w = Array.from({ length: m }, () => 0.5 + rng()), sw = w.reduce((a, b) => a + b, 0);
      const ex = w.map(x => x / sw * lay.slack * 0.9);
      const ex2 = []; let pi = 0;
      // extras are consumed per parrot, then once per group's charge: rebuild in that order
      const nG = C.length;
      for (let g = 0; g < nG; g++) { const size = Math.floor(P.length / nG) + (g < P.length % nG ? 1 : 0); for (let j = 0; j < size; j++) ex2.push(ex[pi++]); ex2.push(ex[pi++]); }
      const lay2 = layoutTimeline(P, C, cfg, ex2, seen); if (lay2.ok) lay = lay2;
    }
    P.forEach((it, i) => { it.at = Math.round(camAt(lay.parr[i], cfg.cam)); });
    C.forEach((it, i) => { it.at = Math.round(camAt(lay.wom[i], cfg.cam)); });
    G.planInfo = { planned: P.length, charges: C.length, slack: lay.slack, ok: lay.ok };
  }
  G.parrotPlan = P; G.parrotIdx = 0; G.warns = [];
  G.womanPlan = C; G.womanIdx = 0;
  // bonus critters (max 2): a guaranteed one in level 1, then more often as levels go on
  G.critterQueue = [];
  const nCrit = n === 1 ? 1 : n === 2 ? (rng() < 0.5 ? 1 : 0) : (rng() < 0.6 ? 1 : 0) + (rng() < 0.3 ? 1 : 0);
  for (let i = 0; i < nCrit; i++) G.critterQueue.push({ at: (nCrit === 1 ? 0.35 + 0.3 * rng() : 0.28 + 0.4 * i + 0.1 * rng()) * LEVEL_PX,
    kind: (n === 1 ? ['rabbit', 'cat'] : ['rabbit', 'cat', 'frog'])[Math.floor(rng() * (n === 1 ? 2 : 3))], side: rng() < 0.5 ? 'left' : 'right', seed: Math.floor(rng() * 1e6) });
}

function startLevel(n) {
  G.level = n; G.cfg = levelCfg(n); G.stage = 'run'; G.phase = '';
  if (n > G.bestLevel) { G.bestLevel = n; if (!DEBUG) try { localStorage.setItem(BESTLV_KEY, String(n)); } catch (e) {} }
  buildScenery(n); layoutBuildings(n); layoutDecor(n); layoutFG(n);
  G.cam = 0; G.speed = G.cfg.cam; G.dist = 0; G.levelStart = G.score;
  G.entities = []; G.parts = []; G.texts = []; G.shake = 0; G.hintT = 0; G.overT = 0; G.holdT = 0; G.winT = 0; G.mimic = null; G.pendingMimic = -1;
  G.dog = newDog(); G.wm = newWoman(); G.jumpBuf = 0; G.pushCd = 0; G.wasPush = false;
  G.nextSpawnX = 480; G.solo = false; G.parrotGap = 0;
  buildPlans(n);
  G.toilet = { blink: 0, blinkT: rnd(2, 4.5), frame: 0 };
  G.critter = null;
  G.entities.push({ type: 'toilet', x: TOILET_X, w: 64, h: 64 });
  for (let i = 0; i < 5; i++) addFood(TOILET_X - 280 + i * 34, 2, pick(REGULAR));
  G.cardT = 2.2; G.state = 'play';
  Sfx.music.setDanger(false);
  Sfx.sfx('level_start'); Sfx.music.playLevel(n);
}

// =====================================================================
//  Spawning
// =====================================================================
const S2 = x => x - G.cam;  // world x -> screen x

function addObstacle(x, def) {
  const e = { type: 'obst', def, x, w: def.w, h: def.h }; G.entities.push(e); return e;
}
function addFood(x, base, id) {
  id = id || pick(REGULAR);
  G.entities.push({ type: 'food', id, high: HIGH.includes(id), x, base, ph: rnd(0, 6.28), gone: false });
}
function pickFood() { return Math.random() < (G.cfg ? G.cfg.highP : 0.15) ? pick(HIGH) : pick(REGULAR); }
function weighted(list) {
  let tot = list.reduce((a, o) => a + o.weight, 0), r = Math.random() * tot;
  for (const o of list) { r -= o.weight; if (r <= 0) return o; }
  return list[0];
}

function spawnPattern() {
  const x = G.nextSpawnX, r = Math.random(), cfg = G.cfg;
  const lively = G.level <= 3;
  if (lively && r < cfg.obstP && Math.random() < 0.45) {       // early levels: fun food set-pieces
    const low = OBST.filter(o => o.minLevel <= 2 && o.h <= 40 && ['cone', 'crate', 'barrier', 'hydrant', 'bollard'].includes(o.name));
    if (Math.random() < 0.5) {            // a row of treats on top of a barrier / crate
      const def = pick(low.filter(o => o.name === 'barrier' || o.name === 'crate')), o = addObstacle(x + 60, def);
      const n = def.name === 'barrier' ? 4 : 2;
      for (let i = 0; i < n; i++) addFood(o.x + 8 + i * (o.w - 16) / Math.max(1, n - 1), o.h + 2, pickFood());
      for (let i = 0; i < 3; i++) addFood(x + i * 28, 2, pickFood());
      G.nextSpawnX = o.x + o.w + rnd(150, 240);
    } else {                              // a ground trail leading into a jump over an obstacle, with an arc of treats
      const n = 3; for (let i = 0; i < n; i++) addFood(x + i * 30, 2, pickFood());
      const def = pick(low.filter(o => o.name !== 'barrier')), o = addObstacle(x + n * 30 + 90, def);
      for (let i = 0; i < 5; i++) { const u = i / 4; addFood(o.x + o.w / 2 - 75 + u * 150, o.h + 12 + Math.sin(u * Math.PI) * 40, pickFood()); }
      G.nextSpawnX = o.x + o.w + rnd(160, 260);
    }
    return;
  }
  if (r < cfg.obstP) {
    const def = weighted(OBST.filter(o => o.minLevel <= G.level));
    const small = ['cone', 'bags', 'crate'].includes(def.name);
    const count = small ? rndi(1, G.level >= 3 ? 3 : G.level >= 2 ? 2 : 1) : 1;
    let cx = x, first = null;
    for (let i = 0; i < count; i++) { const o = addObstacle(cx, def); first = first || o; cx += o.w; }
    const total = cx - x, mid = x + total / 2;
    if (Math.random() < 0.7) addFood(mid - (count > 1 ? 14 : 0), first.h + 2, pickFood());
    if (count > 1 && Math.random() < 0.6) addFood(mid + 14, first.h + 2, pickFood());
    if (Math.random() < 0.7) {
      const n = 5, span = Math.max(150, total + 90);
      for (let i = 0; i < n; i++) { const u = i / (n - 1); addFood(mid - span / 2 + u * span, first.h + 10 + Math.sin(u * Math.PI) * 38, pickFood()); }
    }
    G.nextSpawnX = cx + rnd(cfg.obstGap[0], cfg.obstGap[1]) + (def.tall ? 80 : 0);
  } else {
    const q = Math.random();
    if (q < 0.58) {
      const n = rndi(3, 7);
      for (let i = 0; i < n; i++) addFood(x + i * 34, 2, pickFood());
      G.nextSpawnX = x + n * 34 + (lively ? rnd(30, 90) : rnd(50, 140));
    } else if (q < 0.74) {
      addFood(x + 30, 2, pick(HIGH));
      G.nextSpawnX = x + 150;
    } else {
      const n = rndi(3, 5);
      for (let i = 0; i < n; i++) addFood(x + i * 36, 40 + Math.sin(i / (n - 1) * Math.PI) * 28, pickFood());
      G.nextSpawnX = x + n * 36 + 90;
    }
  }
}

// ---------- parrots (screen-space paths: constant speeds, fixed curves) ----------
// cruiser: straight at a fixed height. swooper: enters high, dips to head height at a fixed screen x.
// percher: waits on a pole (head-bob tell), then follows a fixed drop curve to head height and flies straight off.
// thief: harmless, races to one food chosen at spawn. flock: staggered cruisers. mimic: fake shout bubble.
const DIP_X = 300;
const flockHeights = lv => lv >= 6 ? [32, 32, 8] : [32, 8];
const swoopC = sx => 105 - 73 * Math.exp(-Math.pow((sx - DIP_X) / (G.cfg ? G.cfg.dipW : 100), 2));
function parrotMarkers(it) {      // heights the path crosses, for the off-screen warning marker
  switch (it.kind) {
    case 'cruiser': return it.pair ? [32, 8] : [it.low ? 8 : 32];
    case 'swooper': return [105];
    case 'percher': return [102];
    case 'thief': return [80];
    case 'flock': return flockHeights(G.level);
  }
  return [];
}
function threatBusy() {
  return G.wm.mode !== 'none' || !!G.mimic || G.warns.length > 0 || G.entities.some(e => e.type === 'parrot' && e.state !== 'flee');
}
function findThiefTarget() {      // chosen at spawn from the food that is entering on the right
  return G.entities.filter(f => f.type === 'food' && !f.gone && !f.stolen && S2(f.x) > W * 0.55 && S2(f.x) < W - 30).sort((a, b) => a.x - b.x)[0] || null;
}
function beginParrotWarn(it, first) {
  if (it.kind === 'mimic') { G.seen.mimic = true; startMimic(); return true; }
  let target = null;
  if (it.kind === 'thief') { target = findThiefTarget(); if (!target) return false; target.stolen = true; }
  const T = G.cfg.warnT + (first ? 0.3 : 0);
  G.warns.push({ kind: it.kind, low: it.low, pair: it.pair, variant: it.variant, T, t: T, first, heights: parrotMarkers(it), arc: it.kind === 'swooper' && !G.seen.swooperArc, target });
  if (it.kind === 'swooper') G.seen.swooperArc = true;     // dotted arc preview for the first swooper of the run
  G.seen[it.kind] = true;
  if (first) G.solo = true;
  Sfx.sfx('parrot_enter');
  return true;
}
function parrotEntity(kind, variant, c, sx, v) {
  const e = { type: 'parrot', kind, variant, sx, x: G.cam + sx, c, base: c, v, fl: rnd(0, 8), t: 0, state: 'fly', vy: 0, hit: false, harmless: false };
  G.entities.push(e); return e;
}
function spawnParrotNow(w) {
  const v = G.cfg.parrotV * (w.first ? 0.75 : 1), sx0 = w.sx0 != null ? w.sx0 : W + 40;
  if (w.kind === 'cruiser') {
    parrotEntity('cruiser', w.variant, w.c != null ? w.c : w.low ? 8 : 32, sx0, v);
    if (w.pair) parrotEntity('cruiser', w.variant, w.low ? 32 : 8, sx0 + 230, v);   // second one at the other height, ~1.9 s behind
  }
  else if (w.kind === 'swooper') parrotEntity('swooper', w.variant, 105, sx0, v);
  else if (w.kind === 'flock') (w.heights || flockHeights(G.level)).forEach((h, i) => parrotEntity('cruiser', w.variant, h, sx0 + i * 74, v));
  else if (w.kind === 'percher') {
    const px = G.cam + (w.sx0 != null ? w.sx0 : W + 90);
    G.entities.push({ type: 'pole', x: px, h: 100, w: 6 });
    const e = parrotEntity('percher', w.variant, 102, 0, v * 1.15); e.state = 'perch'; e.x = px; e.bobT = 0; e.alert = 0;
  } else if (w.kind === 'thief') {
    const e = parrotEntity('thief', 'grey', 80, sx0, Math.max(v * 1.6, 190)); e.harmless = true; e.target = w.target;
  }
}
// debug helper: spawn right now, o = { sx, c }
function spawnParrot(kind, o = {}) {
  kind = kind === 'head' ? 'cruiser' : kind;
  const w = { kind, low: o.c === 8, c: o.c, variant: pick(PARROTS), first: false, sx0: o.sx, heights: parrotMarkers({ kind, low: o.c === 8 }), target: kind === 'thief' ? findThiefTarget() : null };
  if (kind === 'thief' && !w.target) return false;
  if (kind === 'mimic') { startMimic(); return true; }
  spawnParrotNow(w); return true;
}
function updateWarns(dt) {
  for (const w of G.warns) { w.t -= dt; if (w.t <= 0) { w.done = true; spawnParrotNow(w); } }
  G.warns = G.warns.filter(w => !w.done);
}
function pickLine() {
  let line; do { line = pick(LINES); } while (line === G.lastLine);
  G.lastLine = line; return line;
}
function startMimic() {
  G.mimic = { line: pickLine(), t: 0, dur: 1.9, side: G.parrotIdx % 2 ? 'left' : 'right' };
  Sfx.shout(G.mimic.line, { mimic: true });
  const e = parrotEntity('decoy', 'green', 168, G.mimic.side === 'left' ? -40 : W + 40, G.mimic.side === 'left' ? -260 : 260);
  e.harmless = true;
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
  puff(S2(d.x), FEET_Y - d.dh, 4); Sfx.sfx('jump');
}
function doHuff() {
  const d = G.dog;
  if (d.huffCd > 0 || d.stun > 0) return;
  d.huffCd = 0.5; d.bubble = 0.8; d.huffT = 0;
  Sfx.huff();
  const sx = S2(d.x), y = FEET_Y - d.dh - d.h;
  for (let i = 0; i < 3; i++) G.parts.push({ k: 'bang', x: sx + d.face * (24 + i * 5), y: y + rnd(-6, 6), vx: d.face * (30 + i * 25), vy: -20 - i * 15, life: 0.55, t: 0, s: 1, col: '#fff' });
  G.parts.push({ k: 'ring', x: sx + d.face * 34, y: FEET_Y - d.dh - 14, vx: 0, vy: 0, life: 0.35, t: 0, s: d.face, col: '#fff' });
  for (const e of G.entities) {
    if (e.type !== 'parrot' || e.kind === 'decoy' || !['fly', 'perch', 'dive'].includes(e.state)) continue;
    const dx = (e.x - d.x) * d.face;
    if (dx > -70 && dx < 260 && e.x > G.cam - 20 && e.x < G.cam + W + 20) {
      if (e.target) e.target.stolen = false;
      e.state = 'flee'; e.vy = 170; e.hit = true; e.sx = S2(e.x); feathers(S2(e.x), FEET_Y - e.c, 3, e.variant); Sfx.voice('flap');
    }
  }
}
function parrotHit(e) {
  const d = G.dog;
  if (d.inv > 0) return;
  e.hit = true;
  feathers(S2(e.x), FEET_Y - e.c, 8, e.variant);
  G.shake = 4; Sfx.voice('squawk');
  const lost = Math.min(3, G.score);
  floatText('-' + lost, S2(d.x), FEET_Y - d.dh - d.h - 14, '#ff5a5a', 14);
  if (G.score < 3) {
    G.score = 0; d.stun = 1.0; d.inv = 2.1; d.bubble = 0; Sfx.sfx('stun');
  } else { G.score -= 3; d.inv = 1.0; Sfx.sfx('parrot_enter'); }
}
function eatFood(e) {
  e.gone = true; const sx = S2(e.x), y = FEET_Y - e.base - 16;
  Sfx.sfx('eat');
  if (e.high) { G.score += 5; floatText('+5', sx, y - 10, '#ffd24a', 15); sparkle(sx, y, 14); }
  else { G.score += 1; floatText('+1', sx, y - 6, '#fff', 11); sparkle(sx, y, 4, '#fff6c0'); }
}

function endGame(reason) {
  G.state = 'over'; G.reason = reason; G.overT = 0;
  const d = G.dog, wm = G.wm;
  d.stun = 0; d.inv = 0; d.dh = 0; d.dv = 0; d.ground = true; d.bubble = 0;
  d.x = clamp(d.x, G.cam + 70, G.cam + W - 120);
  G.entities = G.entities.filter(e => !(e.type === 'obst' && e.x < d.x + 80 && e.x + e.w > d.x - 60));
  G.entities = G.entities.filter(e => e.type !== 'parrot');
  G.mimic = null; G.critter = null;
  wm.mode = 'none'; wm.over = true; wm.row = 0; wm.flip = false;
  wm.sx = S2(d.x) + (S2(d.x) < W - 160 ? 62 : -62); wm.flip = wm.sx < S2(d.x); wm.dh = 0;
  Sfx.music.setDanger(false);
  if (G.score > G.best) { G.best = G.score; G.newBest = true; if (!DEBUG) try { localStorage.setItem(STORE.best, String(G.best)); } catch (e) {} }
  G.rank = G.score > 0 ? addScore() : 0; if (!G.lb.length) G.lb = loadLB();
  if (reason === 'caught') Sfx.sfx('caught');
  const hi = G.rank === 1;
  G.homeDone = false;
  Sfx.music.setLevel(1);
  Sfx.music.play('home', { delay: hi ? 3.9 : 1.8, onEnd: () => { G.homeDone = true; if (G.state === 'title') playTitleSong(); } });
  if (hi) hiTimer = setTimeout(() => Sfx.sfx('new_high_score'), 1700);
}
function crush() {  // Missy is squeezed against the left screen edge: indignant HUFF, brief freeze, then game over
  G.state = 'crush'; G.holdT = 0.85; G.dog.bubble = 0.85; G.dog.stun = 0; G.dog.row = 4; G.dog.frame = 3;
  Sfx.huff(); Sfx.sfx('trapped'); G.shake = 8; Sfx.music.setDanger(false);
}

// =====================================================================
//  The woman (SkiFree-yeti role)
// =====================================================================
// Her tricks happen at fixed points along her run (fraction u of the way across), each with a wind-up pose first.
const WOMAN_MARKS = { lunge: [0.3], hop: [0.22, 0.45, 0.68], turn: [0.5], leap: [0.22] };
const WINDUP = { lunge: 0.36, hop: 0.32, turn: 0.34, leap: 0.42 };
function startWoman(opts = {}) {
  const wm = G.wm, cfg = G.cfg || levelCfg(1);
  wm.beh = opts.beh || pick(cfg.behaviors);
  wm.side = opts.side || (Math.random() < 0.5 ? 'left' : 'right');
  wm.line = pickLine();
  wm.mode = 'warn'; wm.warnT = opts.warnT || WARN_T; wm.t = 0; wm.over = false; wm.dodged = false; wm.prevSign = 0;
  wm.dir = wm.side === 'left' ? 1 : -1;
  wm.sx = wm.side === 'left' ? -50 : W + 50; wm.x0 = wm.sx; wm.x1 = wm.side === 'left' ? W + 60 : -60;
  wm.v = (wm.beh === 'sprint' ? cfg.womanV * 1.35 : cfg.womanV) * (opts.vMul || 1);
  wm.dh = 0; wm.dv = 0; wm.turned = false; wm.entered = false; wm.flip = wm.dir < 0; wm.pulse = 0;
  wm.phase = 'run'; wm.pt = 0; wm.marks = (WOMAN_MARKS[wm.beh] || []).slice(); wm.markIdx = 0;
  Sfx.shout(wm.line); Sfx.music.setDanger(true);
  if (opts.mimic) G.pendingMimic = 1.2;   // later levels: a Mimic piles on
}

function parrotsBlockOwner() {
  const cfg = G.cfg;
  if (G.warns.some(w => w.t + (W + 40 - CLEAR_X) / parrotSpeed(w.kind, w.first, cfg) > OWNER_LEAD)) return true;
  return G.entities.some(e => e.type === 'parrot' && e.state !== 'flee' && !e.harmless && (S2(e.x) - CLEAR_X) / Math.max(40, e.kind === 'percher' ? G.speed : (e.v || 150)) > OWNER_LEAD);
}
function updateWoman(dt) {
  const wm = G.wm, d = G.dog;
  if (wm.mode === 'none') {
    const it = G.womanPlan[G.womanIdx];
    const parrotsOut = G.level <= 4 && parrotsBlockOwner();   // ...and she waits until they are nearly clear (safety net: the plan already schedules this)
    if (G.stage === 'run' && it && G.cam >= it.at && G.cam < NOSPAWN_X - W && !G.solo && !parrotsOut) { G.womanIdx++; startWoman(it); }
    return;
  }
  wm.t += dt; wm.pulse += dt;
  if (wm.mode === 'warn') {
    wm.warnT -= dt; wm.row = 0; wm.frame = 0;
    if (wm.warnT <= 0) { wm.mode = 'charge'; wm.t = 0; Sfx.sfx('human_run'); }
    return;
  }
  if (wm.sx >= -10 && wm.sx <= W + 10) wm.entered = true;     // the edge shout only shows before she first appears
  let v = wm.v;
  const u = clamp((wm.sx - wm.x0) / (wm.x1 - wm.x0), 0, 1);
  let pose = null;
  if (wm.phase === 'run' && !wm.turned && wm.markIdx < wm.marks.length && u >= wm.marks[wm.markIdx]) { wm.markIdx++; wm.phase = 'windup'; wm.pt = 0; }
  if (wm.phase === 'windup') {           // crouch in place: the tell before the move
    wm.pt += dt; v = 0; pose = [2, 0];
    if (wm.pt >= WINDUP[wm.beh]) {
      wm.pt = 0;
      if (wm.beh === 'turn') { wm.turned = true; wm.dir = -wm.dir; wm.flip = wm.dir < 0; wm.phase = 'run'; Sfx.sfx('human_turn'); }
      else { wm.phase = 'act'; if (wm.beh === 'hop') wm.dv = 520; }
    }
  } else if (wm.phase === 'act') {
    wm.pt += dt;
    if (wm.beh === 'lunge') { v *= 1.8; pose = [2, Math.min(2, Math.floor(wm.pt * 6))]; if (wm.pt >= 0.5) wm.phase = 'run'; }
    else if (wm.beh === 'hop') { wm.dv -= 1750 * dt; wm.dh += wm.dv * dt; if (wm.dh <= 0) { wm.dh = 0; wm.dv = 0; wm.phase = 'run'; } }
    else if (wm.beh === 'leap') { v *= 1.35; const s = clamp(wm.pt / 0.95, 0, 1); wm.dh = 4 * 150 * s * (1 - s); pose = [2, 1]; if (wm.pt >= 0.95) { wm.dh = 0; wm.phase = 'run'; } }
  }
  wm.sx += wm.dir * v * dt;
  if (pose) { wm.row = pose[0]; wm.frame = pose[1]; }
  else { wm.row = 1; wm.ft += dt * (8 + v / 22); wm.frame = Math.floor(wm.ft) % 6; }
  // collision with Missy: tight boxes
  const dsx = S2(d.x), dx = Math.abs(wm.sx - dsx);
  if (dx < 8 + 8 && wm.dh < d.dh + d.h - 2 && wm.dh + 34 > d.dh + 2) { endGame('caught'); return; }   // her visible body, a bit forgiving
  const sign = Math.sign(wm.sx - dsx);   // (sound only) she ran past
  if (wm.prevSign && sign && sign !== wm.prevSign && !wm.dodged) { wm.dodged = true; Sfx.sfx('human_dodge'); }
  if (sign) wm.prevSign = sign;
  const out = wm.dir > 0 ? wm.sx > W + 70 : wm.sx < -70;
  if (out && (wm.beh !== 'turn' || wm.turned)) { wm.mode = 'none'; Sfx.music.setDanger(false); }
}

// =====================================================================
//  Update
// =====================================================================
function overlapX(d, o) { return d.x + HW > o.x + 1 && d.x - HW < o.x + o.w - 1; }

function updateDog(dt, auto) {
  const d = G.dog;
  const hadStun = d.stun > 0, hadInv = d.inv > 0, wasDuck = d.ducking;
  d.huffCd = Math.max(0, d.huffCd - dt); d.inv = Math.max(0, d.inv - dt); d.stun = Math.max(0, d.stun - dt);
  if (hadStun && d.stun <= 0) Sfx.sfx('stun_end');
  if (hadInv && d.inv <= 0 && !hadStun) Sfx.sfx('invincible_end');
  d.bubble = Math.max(0, d.bubble - dt); d.huffT = (d.huffT || 0) + dt; G.jumpBuf = Math.max(0, G.jumpBuf - dt);
  const can = d.stun <= 0;
  const left = can && (kb.left || vk.left), right = can && (kb.right || vk.right), down = can && (kb.down || vk.down);
  d.ducking = down && d.ground;
  if (d.ducking && !wasDuck) Sfx.sfx('crouch');
  d.h = d.ducking ? DUCK_H : STAND_H;
  let vx = 0;
  if (right && !left) vx = d.ducking ? DUCK_V : RUN_R; else if (left && !right) vx = -(d.ducking ? DUCK_V : RUN_L);
  d.vx = vx; if (vx) d.face = vx > 0 ? 1 : -1;
  d.x += vx * dt;

  if (d.ground) d.coyote = COYOTE; else d.coyote = Math.max(0, d.coyote - dt);
  if (can && G.jumpBuf > 0 && d.coyote > 0 && !d.ducking) doJump();

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
    if (landed) { d.dv = 0; d.ground = true; d.landT = 0.2; puff(S2(d.x), FEET_Y - d.dh, 6); Sfx.sfx('land'); }
  }
  // left edge pushes forward, right edge is a wall, obstacles are solid
  const pushing = d.x <= G.cam + HW + 0.01 && G.speed > 1 && vx <= 0;
  d.x = Math.max(d.x, G.cam + HW);
  d.x = Math.min(d.x, G.cam + W - HW - 2);
  G.pushCd = Math.max(0, G.pushCd - dt);
  if (pushing && !G.wasPush && G.pushCd <= 0) { Sfx.sfx('edge_push'); G.pushCd = 1.6; }
  G.wasPush = pushing;
  for (const o of G.entities) {
    if (o.type !== 'obst' || !overlapX(d, o) || d.dh >= o.h - 2) continue;
    const pushL = d.x + HW - o.x, pushR = o.x + o.w - (d.x - HW);
    if (pushL < pushR) d.x -= pushL; else d.x += pushR;
  }
  d.x = Math.min(d.x, G.cam + W - HW - 2);
  if (d.x - HW < G.cam - 0.5) { crush(); return; }
  if (d.ground) {
    let sup = 0;
    for (const o of G.entities) if (o.type === 'obst' && overlapX(d, o) && o.h <= d.dh + 2) sup = Math.max(sup, o.h);
    if (sup < d.dh - 0.5) { d.ground = false; d.dv = 0; d.airT = 0.3; d.dh = Math.max(d.dh, sup); }
    else d.dh = sup;
  }
  d.landT = Math.max(0, d.landT - dt);
  animateDog(dt);
}

function animateDog(dt) {
  const d = G.dog, vx = d.vx;
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
  else {  // idle: stopped to sniff (look-around / head-down idle with tail wag, row 1)
    d.row = 1; d.ft += dt * 8; d.frame = Math.floor(d.ft) % 14;
  }
}

function updateParrots(dt) {
  const d = G.dog;
  for (const e of G.entities) {
    if (e.type !== 'parrot') continue;
    e.t += dt; e.fl += dt * 14;
    if (e.state === 'flee') { e.sx += -60 * dt; e.c += e.vy * dt; e.vy += 40 * dt; e.x = G.cam + e.sx; continue; }
    if (e.kind === 'percher') {
      if (e.state === 'perch') {            // bob for ~1 s once the pole reaches a fixed screen x, then drop on a fixed curve
        e.sx = S2(e.x); e.bobT += dt;
        if (e.sx < W && e.sx > 0) {
          const rate = e.alert > 0 ? 3.2 : 1.6, ph = (e.bobT * rate) % 1;
          if (ph < dt * rate + 0.001) Sfx.sfx('percher_bob');
        }
        if (e.alert <= 0 && e.sx <= 470) e.alert = 0.001;
        if (e.alert > 0) { e.alert += dt; if (e.alert > 1.0) { e.state = 'dive'; e.t = 0; } }
      } else {                               // fixed path: smooth drop to head height, then straight off-screen
        e.sx -= e.v * dt; const s = clamp(e.t / 0.8, 0, 1);
        e.c = 102 - 70 * (s * s * (3 - 2 * s)); e.x = G.cam + e.sx;
      }
    } else if (e.kind === 'thief') {
      const t = e.target;
      if (!t || t.gone) { e.state = 'flee'; e.vy = 120; continue; }
      const tx = S2(t.x), ty = t.base + 16, dx = tx - e.sx, dy = ty - e.c, L = Math.hypot(dx, dy) || 1;
      e.sx += dx / L * e.v * dt; e.c += dy / L * e.v * dt; e.facing = dx > 0 ? 1 : -1; e.x = G.cam + e.sx;
      if (L < 16) { t.gone = true; Sfx.sfx('thief_snatch'); floatText('Stolen!', S2(t.x), FEET_Y - ty - 14, '#ffb0b0', 12); feathers(S2(t.x), FEET_Y - ty, 4, 'grey'); e.state = 'flee'; e.vy = 130; e.target = null; }
    } else {                                 // cruiser / swooper / decoy: constant speed along a fixed curve
      e.sx -= e.v * dt; if (e.kind === 'swooper') e.c = swoopC(e.sx);
      e.x = G.cam + e.sx;
    }
    const hot = !e.harmless && (e.kind !== 'percher' || e.state === 'dive');
    if (hot && !e.hit && Math.abs(e.x - d.x) < HW + 8 && e.c + 7 > d.dh && e.c - 7 < d.dh + d.h) parrotHit(e);
  }
}

function updatePlay(dt) {
  const d = G.dog, cfg = G.cfg;
  G.t += dt; G.hintT += dt; G.cardT = Math.max(0, G.cardT - dt); G.bannerT = Math.max(0, (G.bannerT || 0) - dt);
  // auto-scroll: gentle ramp within the level, easing to a stop at the toilet
  const prog = clamp(G.cam / LEVEL_PX, 0, 1);
  let sp = cfg.cam * (1 + 0.18 * prog);
  if (G.stage === 'run' && G.cam >= STOP_START) {
    G.stage = 'arrive'; Sfx.sfx('toilet_appears'); Sfx.music.setDanger(false);
  }
  if (G.stage === 'arrive') { const u = clamp((G.cam - STOP_START) / (LEVEL_PX - STOP_START), 0, 1); sp *= Math.max(0, (1 - u) * (1 - u)); if (sp < 3) { sp = 0; G.cam = Math.max(G.cam, LEVEL_PX - 0.5); } }
  G.speed = sp;
  G.cam += G.speed * dt; G.dist = G.cam / M_PX;
  G.shake = Math.max(0, G.shake - dt * 22);
  if (G.stage === 'arrive' && G.speed === 0) G.cam = LEVEL_PX;

  updateDog(dt);
  if (G.state !== 'play') return;

  G.parrotGap = Math.max(0, (G.parrotGap || 0) - dt);
  if (G.stage === 'run') {
    while (G.nextSpawnX < Math.min(G.cam + W + 160, NOSPAWN_X)) spawnPattern();
    // parrots come from the level's schedule (by camera position), never from where Missy is
    while (G.parrotIdx < G.parrotPlan.length && G.cam >= G.parrotPlan[G.parrotIdx].at) {
      const it = G.parrotPlan[G.parrotIdx], first = !G.seen[it.kind];
      if (G.cam > NOSPAWN_X - W) { G.parrotIdx = G.parrotPlan.length; break; }
      if (G.solo || (first && threatBusy())) break;          // a new type is introduced alone
      if (G.parrotGap > 0) break;                            // parrots held back (e.g. by a solo intro) come out one at a time, not as a stack
      const herTurn = G.womanPlan[G.womanIdx] && G.cam >= G.womanPlan[G.womanIdx].at;
      if (G.level <= 4 && (herTurn || G.wm.mode === 'warn' || (G.wm.mode === 'charge' && G.wm.t < womanFreeAt(G.wm)))) break;   // levels 1-4: parrots hold off while her charge is due or under way (safety net)
      G.parrotIdx++; beginParrotWarn(it, first);
      G.parrotGap = Math.max(1.0, 1.4 - 0.05 * (G.level - 1));
    }
    if (G.pendingMimic > 0) { G.pendingMimic -= dt; if (G.pendingMimic <= 0) { G.pendingMimic = -1; startMimic(); } }
  }
  if (G.mimic) { G.mimic.t += dt; if (G.mimic.t > G.mimic.dur) G.mimic = null; }

  for (const e of G.entities) {
    if (e.type === 'food' && !e.gone) {
      const hop = e.high ? Math.abs(Math.sin(G.t * 5 + e.ph)) * 20 : Math.sin(G.t * 4 + e.ph) * 3 + 3;
      e.hop = hop;
      const cy = e.base + 14 + hop;
      if (Math.abs(e.x - d.x) < HW + 12 && cy > d.dh - 8 && cy < d.dh + d.h + 10) eatFood(e);
    }
  }
  updateWarns(dt);
  updateParrots(dt);
  // a solo introduction ends once the new parrot has flown past a fixed screen x (never Missy's position)
  if (G.solo && !(G.wm.mode !== 'none' || G.mimic || G.warns.length || G.entities.some(e => e.type === 'parrot' && e.state !== 'flee' && S2(e.x) > SOLO_X))) G.solo = false;
  updateWoman(dt);
  if (G.state !== 'play') return;
  critterTick();
  // reached the toilet?
  if (G.stage === 'arrive' && d.x >= TOILET_X - 72) beginWin();
  G.entities = G.entities.filter(e => {
    if (e.gone) return false;
    if (e.type === 'toilet') return true;
    if (e.type === 'parrot') return S2(e.x) > -120 && S2(e.x) < W + 900 && e.c < 520;
    return S2(e.x) + (e.w || 0) > -120;
  });
  updateToilet(dt);
  updateParts(dt);
}


// ---------- rare bonus critters (bunny / kitty / froggy): at most one per level, ~35% of levels ----------
const CRITTERS = {
  rabbit: { img: 'critter_rabbit', n: 8, scale: 2, pts: 10, name: 'BUNNY!', w: 32, h: 24 },
  cat: { img: 'critter_cat', n: 8, scale: 2, pts: 15, name: 'KITTY!', w: 36, h: 24 },
  frog: { img: 'critter_frog', n: 4, scale: 1, pts: 20, name: 'FROGGY!', w: 18, h: 15, faceLeft: true },
};
const CAT_LEAP = [3, 4, 5, 6, 7, 7, 0, 0, 1];   // gather, push off, long stretched flight, touch down
function spawnCritter(kind, side, seed) {
  kind = kind === 'bunny' ? 'rabbit' : kind;
  side = side || 'right';
  const rng = makeRng(seed || 1);
  G.critter = { rng, kind, sx: side === 'left' ? -50 : W + 50, dir: side === 'left' ? 1 : -1, t: 0, state: 'run', phase: 0, frame: 0, sq: 0,
    idle: 0.1 + 0.2 * rng(), hopT: 0, hopD: 0.3, hopV: 0, hopH: 0, lt: 0, leapDone: false, leapAt: (0.35 + 0.25 * rng()) * W, arc: 0, sup: 0 };
  Sfx.voice({ rabbit: 'bunny_squeak', cat: 'cat_mew', frog: 'frog_croak' }[kind]);
}
function updateCritter(dt) {
  const c = G.critter, d = G.dog; if (!c) return;
  c.t += dt;
  let top = 0;
  for (const o of G.entities) if (o.type === 'obst' && S2(o.x) < c.sx + 12 && S2(o.x) + o.w > c.sx - 12) top = Math.max(top, o.h);
  c.sup += (top - c.sup) * Math.min(1, dt * 14);   // hops up onto and over obstacles
  c.arc = 0;
  if (c.kind === 'rabbit') {
    c.sx += c.dir * 215 * dt; const np = c.phase + dt / 0.62; if (np >= 1 && c.sx > -20 && c.sx < W + 20) Sfx.voice('bunny_boing'); c.phase = np % 1; c.arc = 12 * Math.sin(Math.PI * c.phase); c.frame = Math.floor(c.phase * 8) % 8;
  } else if (c.kind === 'cat') {
    if (c.state === 'run') {
      c.sx += c.dir * 250 * dt; c.phase += dt * 12; c.frame = Math.floor(c.phase) % 8;
      if (!c.leapDone && (c.sx - c.leapAt) * c.dir >= 0) { c.state = 'leap'; c.lt = 0; c.leapDone = true; Sfx.voice('cat_hiss'); }
    } else {
      c.lt += dt; const u = clamp(c.lt / 0.75, 0, 1);
      c.sx += c.dir * 290 * dt; c.arc = 44 * Math.sin(Math.PI * u); c.frame = CAT_LEAP[Math.min(CAT_LEAP.length - 1, Math.floor(u * CAT_LEAP.length))];
      if (c.lt >= 0.75) { c.state = 'run'; c.phase = 0; }
    }
  } else { // frog: quick, erratic little hops with idle frames and a squash between them
    c.sq = Math.max(0, c.sq - dt);
    if (c.state === 'run') {
      c.idle -= dt; c.frame = Math.floor(c.t * 7) % 4;
      if (c.idle <= 0) { c.state = 'hop'; c.hopT = 0; c.hopD = 0.24 + 0.16 * c.rng(); c.hopH = 16 + 24 * c.rng(); c.hopV = c.rng() < 0.15 ? -(50 + 40 * c.rng()) : 120 + 160 * c.rng();
        if (c.sx > -20 && c.sx < W + 20) Sfx.voice(c.rng() < 0.18 ? 'frog_croak' : 'frog_plip'); }
    } else {
      c.hopT += dt; const u = clamp(c.hopT / c.hopD, 0, 1);
      c.sx += c.dir * c.hopV * dt; c.arc = c.hopH * Math.sin(Math.PI * u); c.frame = 1;
      if (c.hopT >= c.hopD) { c.state = 'run'; c.idle = 0.1 + 0.3 * c.rng(); c.sq = 0.14; puff(c.sx, FEET_Y - c.sup, 2); }
    }
  }
  const def = CRITTERS[c.kind], cdh = c.sup + c.arc;
  if (Math.abs(c.sx - S2(d.x)) < HW + def.w / 2 && cdh + def.h > d.dh && cdh < d.dh + d.h && G.state === 'play') {
    G.score += def.pts;
    floatText('+' + def.pts + ' ' + def.name, c.sx, FEET_Y - cdh - 46, '#ffd24a', 17);
    sparkle(c.sx, FEET_Y - cdh - 14, 26); sparkle(c.sx, FEET_Y - cdh - 14, 10, '#fff');
    Sfx.sfx('eat'); Sfx.voice('caught_' + c.kind);
    G.critter = null; return;
  }
  if ((c.dir > 0 && c.sx > W + 80) || (c.dir < 0 && c.sx < -80) || c.t > 40) G.critter = null;
}
function critterTick() {
  if (G.critter) { updateCritter(1 / 60); return; }
  const q = G.critterQueue && G.critterQueue[0];
  if (q && G.stage === 'run' && G.cam >= q.at) {
    if (G.cam > NOSPAWN_X - W) { G.critterQueue.length = 0; return; }
    if (G.wm.mode === 'none' && !G.mimic && !G.solo) { G.critterQueue.shift(); spawnCritter(q.kind, q.side, q.seed); }
  }
}

// Pixel heart over the toilet once Missy lies down: pops in, then bobs on a 4-step NES cycle,
// squashing for one step at the bottom of each bounce.
const HEART = ['.RR...RR.', 'RWRR.RRRR', 'RWRRRRRRR', 'RRRRRRRRR', '.RRRRRRR.', '..RRRRR..', '...RRR...', '....R....'];
const HEART_SQUASH = ['.RRR...RRR.', 'RWRRR.RRRRR', 'RRRRRRRRRRR', '.RRRRRRRRR.', '...RRRRR...', '.....R.....'];
const HEART_COL = { R: '#e8344e', W: '#ffd6dc' };
function drawHeart(cx, bottom, t) {
  if (t < 0.5) return;
  const px = t < 0.6 ? 1 : 2;                       // pop: one frame-ish at half size
  const step = Math.floor((t - 0.5) * 5) % 4;       // 0..3, 5 steps a second
  const map = step === 0 && px === 2 ? HEART_SQUASH : HEART;
  const lift = [0, 2, 4, 2][step];
  const w = map[0].length * px, h = map.length * px, x0 = cx - Math.floor(w / 2), y0 = bottom - h - lift;
  ctx.fillStyle = '#1c1a26';                         // outline: every filled pixel's neighbours, drawn first
  map.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '.') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillRect(x0 + (x + dx) * px, y0 + (y + dy) * px, px, px);
  }));
  map.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '.') { ctx.fillStyle = HEART_COL[c]; ctx.fillRect(x0 + x * px, y0 + y * px, px, px); }
  }));
}

function updateToilet(dt) {
  const t = G.toilet;
  if (G.state === 'win' && G.phase !== 'walk') {
    t.frame = (G.winT * 1.5) % 1 < 0.72 ? 2 : 3;   // smiling + blush, now and then the mouth opens
    return;
  }
  t.blinkT -= dt;
  if (t.blinkT <= 0) { t.blink = 0.14; t.blinkT = rnd(2, 4.5) + 0.14; }
  t.blink = Math.max(0, t.blink - dt);
  t.frame = t.blink > 0 ? 1 : 0;
}

// ---------- level complete ----------
function beginWin() {
  G.state = 'win'; G.phase = 'walk'; G.winT = 0; G.lieT = 0; G.speed = 0;
  const wm = G.wm; wm.mode = 'none'; wm.over = false; Sfx.music.setDanger(false);
  G.mimic = null; G.dog.stun = 0; G.dog.inv = 0; G.dog.bubble = 0;
  G.entities = G.entities.filter(e => e.type !== 'parrot'); G.critter = null;
}
function updateWin(dt) {
  const d = G.dog; G.winT += dt;
  const target = TOILET_X - 34;
  d.dh = 0; d.dv = 0; d.ground = true; d.tilt = 0; d.oy = 0; d.ducking = false;
  if (G.phase === 'walk') {
    const dx = target - d.x;
    d.face = 1;
    if (Math.abs(dx) < 3) { d.x = target; G.phase = 'lie'; G.lieT = 0; Sfx.sfx('sleep'); Sfx.music.play('lullaby'); }
    else { d.x += Math.sign(dx) * Math.min(Math.abs(dx), 120 * dt); d.row = 2; d.ft += dt * 11; d.frame = Math.floor(d.ft) % 8; d.face = dx > 0 ? 1 : -1; }
  } else {
    G.lieT += dt; d.face = 1;
    if (G.lieT < 1.0) { d.row = 6; d.frame = Math.min(6, Math.floor(G.lieT * 7)); }
    else {
      d.row = 5; d.ft += dt * 3; d.frame = Math.floor(d.ft) % 6;
      if (Math.floor(G.lieT * 1.2) !== Math.floor((G.lieT - dt) * 1.2)) G.parts.push({ k: 'z', x: S2(d.x) + 14, y: FEET_Y - 34, vx: 10, vy: -18, life: 1.6, t: 0, s: 1, col: '#fff' });
    }
  }
  updateToilet(dt); updateParts(dt);
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
  G.clock = (G.clock || 0) + dt;
  // hold C (title leaderboard / game over) to clear the leaderboard
  if (kb.clear && ((G.state === 'title' && G.showLB) || (G.state === 'over' && G.overT > 0.3))) {
    G.clearHold += dt; if (G.clearHold >= 1.2) { clearLB(); G.clearHold = 0; kb.clear = false; }
  } else G.clearHold = 0;
  if (G.state === 'play') updatePlay(dt);
  else if (G.state === 'win') updateWin(dt);
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
    updateToilet(dt);
  } else if (G.state === 'over') {
    G.overT += dt;
    const d = G.dog, wm = G.wm;
    d.row = 5; d.ft += dt * 3; d.frame = Math.floor(d.ft) % 6; d.tilt = 0; d.oy = 0;
    wm.row = 0; wm.ft += dt * 5; wm.frame = Math.floor(wm.ft) % 4;
    updateParts(dt);
  }
}


function drawParallaxImage(img, scrollX, y, w = 640) {
  const ox = -(((Math.round(scrollX)) % w) + w) % w;
  ctx.drawImage(img, ox, y); ctx.drawImage(img, ox + w, y);
}

// layout of the 0.5x building row: buildings butt together, with an occasional dark alley; seeded per level
let bldSeq = null;
function layoutBuildings(lv = 1) {
  const rng = makeRng(77 + lv * 31); bldSeq = []; let x = 0, lastAlley = true;
  const nb = BUILDINGS.length - 3;
  for (let i = 0; i < 80; i++) {
    let c, alley = false;
    if (!lastAlley && rng() < 0.2) { c = BUILDINGS[nb + Math.floor(rng() * 3)]; alley = true; }
    else c = BUILDINGS[Math.floor(rng() * nb)];
    bldSeq.push({ x, c }); x += c.width; lastAlley = alley;
  }
  bldSeq.total = x;
}
let DECOR_SEQ = [];
function layoutDecor(lv = 1) {
  const rng = makeRng(99 + lv * 17); let x = 0; DECOR_SEQ = [];
  for (let i = 0; i < 80; i++) {
    const d = DECOR_DEFS[Math.floor(rng() * DECOR_DEFS.length)];
    DECOR_SEQ.push({ x, d, flip: rng() < 0.5 });
    x += 140 + Math.floor(rng() * 260);
  }
}
// foreground (1.3x): sparse, dark, out-of-focus silhouettes along the very bottom edge
let FG = [], FG_P = 4200;
function layoutFG(lv = 1) {
  const rng = makeRng(31337 + lv * 13); FG = []; let x = 200 + rng() * 300;
  while (x < FG_P) {
    const kind = pick3(rng, ['posts', 'bollard', 'hedge', 'hedge', 'posts']);
    FG.push({ kind, x, w: kind === 'posts' ? 70 + Math.floor(rng() * 4) * 18 : kind === 'hedge' ? 90 + rng() * 60 : 14 });
    x += 420 + rng() * 520;
  }
}
const pick3 = (rng, a) => a[Math.floor(rng() * a.length)];
function drawForeground() {
  const k = G.cam * 1.3;
  ctx.fillStyle = 'rgba(16,19,30,0.82)';
  for (const f of FG) {
    let sx = Math.round((((f.x - k) % FG_P) + FG_P) % FG_P) - 160;
    if (sx > W + 20) continue;
    if (f.kind === 'posts') {       // railing: posts + a top rail
      const n = Math.floor(f.w / 18);
      ctx.fillRect(sx, 342, n * 18 + 6, 3);
      for (let i = 0; i <= n; i++) { ctx.fillRect(sx + i * 18, 334, 6, 26); ctx.fillRect(sx + i * 18 - 1, 332, 8, 3); }
    } else if (f.kind === 'bollard') {
      ctx.fillRect(sx, 338, 14, 22); ctx.fillRect(sx - 2, 336, 18, 4);
    } else {                         // hedge top: rounded blob rising from the bottom edge
      for (let i = 0; i < f.w; i += 6) { const hh = 14 + 8 * Math.sin(i * 0.17 + f.x); ctx.fillRect(sx + i, Math.round(360 - hh), 6, Math.round(hh)); }
    }
  }
}

// ---------- time of day: the walk drifts from midday into golden hour, sunset, dusk and night ----------
// phase runs 0..8 over eight levels (then loops): it advances with progress through each level
const SKY_KEYS = [  // [phase, sky top, sky middle, horizon, scene tint rgb, tint alpha, stars, lamp glow]
  [0.0, [143, 184, 240], [212, 230, 255], [255, 255, 255], [0, 0, 0], 0, 0, 0],
  [1.4, [143, 184, 240], [212, 230, 255], [255, 255, 255], [0, 0, 0], 0, 0, 0],
  [2.5, [118, 160, 222], [243, 214, 160], [255, 232, 190], [255, 160, 60], 0.08, 0, 0],
  [3.4, [70, 92, 160], [240, 140, 96], [255, 196, 124], [255, 110, 70], 0.14, 0, 0.3],
  [4.3, [36, 40, 82], [108, 80, 136], [226, 134, 106], [70, 40, 110], 0.28, 0.4, 0.8],
  [5.1, [11, 16, 48], [28, 36, 80], [58, 63, 110], [10, 20, 60], 0.42, 1, 1],
  [6.6, [11, 16, 48], [28, 36, 80], [58, 63, 110], [10, 20, 60], 0.42, 1, 1],
  [7.4, [92, 112, 174], [242, 180, 160], [255, 225, 196], [255, 150, 120], 0.12, 0.2, 0.3],
  [8.0, [143, 184, 240], [212, 230, 255], [255, 255, 255], [0, 0, 0], 0, 0, 0],
];
function dayPhase() {
  const lv = G.state === 'title' ? 1 : G.level;
  return ((lv - 1) + clamp(G.dist / LEVEL_M, 0, 1)) % 8;
}
function skyAt(p) {
  let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= p) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1], t = clamp((p - a[0]) / (b[0] - a[0]), 0, 1);
  const mix = (u, v) => Array.isArray(u) ? u.map((x, k) => Math.round(x + (v[k] - x) * t)) : u + (v - u) * t;
  return { top: mix(a[1], b[1]), mid: mix(a[2], b[2]), hor: mix(a[3], b[3]), tint: mix(a[4], b[4]), tintA: mix(a[5], b[5]), stars: mix(a[6], b[6]), glow: mix(a[7], b[7]) };
}
const rgb = c => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
const STARS = (() => { const r = makeRng(4242); return Array.from({ length: 70 }, () => [Math.floor(r() * 640), Math.floor(r() * 150), r() * 6.28, r() < 0.2 ? 2 : 1]); })();
function pixelDisc(cx, cy, rad, col) {
  ctx.fillStyle = col;
  for (let dy = -rad; dy <= rad; dy++) { const hw = Math.floor(Math.sqrt(rad * rad - dy * dy)); ctx.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1); }
}
// sun sinks through the afternoon; the moon rises at night
function drawSunMoon(p) {
  if (p < 4.6) {
    const u = clamp(p / 4.2, 0, 1), y = 34 + u * u * 150, warm = clamp((p - 1.5) / 2.5, 0, 1);
    const col = [255, Math.round(244 - 90 * warm), Math.round(170 - 120 * warm)];
    pixelDisc(470, y, 14, 'rgba(' + col + ',0.25)'); pixelDisc(470, y, 10, rgb(col));
  } else if (p > 4.8 && p < 7.6) {
    const u = clamp((p - 4.8) / 1.2, 0, 1), y = 150 - u * 105;
    pixelDisc(150, y, 9, '#f2efd8'); pixelDisc(146, y - 2, 2, '#d6d2b8'); pixelDisc(153, y + 3, 1, '#d6d2b8');
  }
}
// a distant airliner crosses the sky now and then (pure function of the clock, no state)
function drawPlane(clk, sk) {
  const PERIOD = 64, SPEED = 13, cyc = Math.floor(clk / PERIOD), ph = clk - cyc * PERIOD;
  const travel = ph * SPEED - 30; if (travel > W + 30) return;
  const dir = cyc % 2 ? -1 : 1, x = Math.round(dir > 0 ? travel : W - travel), y = 26 + ((cyc * 37) % 44);
  const night = sk.stars > 0.5, body = night ? '#20253c' : '#eef2f8', dark = night ? '#141828' : '#6d7890';
  if (!night) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(dir > 0 ? x - 70 : x + 9, y + 1, 70, 1); }   // contrail
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.fillStyle = body; ctx.fillRect(0, 1, 9, 2);                 // fuselage
  ctx.fillStyle = dark; ctx.fillRect(0, 2, 9, 1); ctx.fillRect(1, -1, 1, 2); ctx.fillRect(4, 3, 3, 1);   // belly, tail fin, wing
  ctx.fillStyle = body; ctx.fillRect(8, 1, 2, 1);                  // nose
  ctx.restore();
  if (sk.stars > 0.2 && Math.floor(clk * 2) % 2) { ctx.fillStyle = '#ff4a4a'; ctx.fillRect(x + (dir > 0 ? 1 : -2), y, 1, 1); }   // blinking beacon
}
let skyCache = null;
const STAR_COL = Array.from({ length: 101 }, (_, i) => 'rgba(255,255,240,' + (i / 100).toFixed(2) + ')');
let LAMPS_LIT = [];
const LIT_NOW = [];
// ---- easter egg: now and then a neighbour leans out and calls a classic comedy catchphrase ----
const QUOTE = { b: null, p: null, text: '', t: 0, cd: 6, last: '', clk: 0 };
function updateQuote(bs) {
  const q = QUOTE, now = G.clock || 0, dt = clamp(now - q.clk, 0, 0.5); q.clk = now;   // game-clock time: stops when paused
  if (q.b) { q.t -= dt; if (q.t <= 0 || q.b.x + q.p.x - bs < -20 || q.b.x + q.p.x - bs > W + 20) q.b = null; return; }
  q.cd -= dt;
  if (q.cd > 0 || G.state === 'over' || (G.wm && G.wm.mode !== 'none') || G.mimic) return;
  const seen = [];   // neighbours currently in view, away from the screen edges
  for (const b of bldSeq) {
    if (!b.c.people || !b.c.people.length) continue;
    for (const p of b.c.people) { const x = b.x - bs + p.x; if (x > 70 && x < W - 90) seen.push([b, p]); }
  }
  if (!seen.length) return;
  const [b, p] = seen[Math.floor(Math.random() * seen.length)];
  let text; do { text = QUOTES[Math.floor(Math.random() * QUOTES.length)]; } while (text === q.last && QUOTES.length > 1);
  Object.assign(q, { b, p, text, last: text, t: 3.2 + text.length * 0.03, cd: 5 + Math.random() * 6 });
}
function drawQuote(bs) {   // just the words, outlined, floating above the neighbour's window
  const q = QUOTE; if (!q.b) return;
  const font = pfont(16), lines = wrapText(q.text, 200, font);
  ctx.font = font;
  const tw = Math.ceil(Math.max(...lines.map(l => ctx.measureText(l).width)));
  const by0 = SIDEWALK_TOP + 2 - q.b.c.height, px = Math.round(q.b.x - bs + q.p.x + 8), py = by0 + q.p.y;
  const cx = Math.round(clamp(px, 6 + tw / 2, W - 6 - tw / 2)), top = Math.round(Math.max(52, py - lines.length * 17 - 6));
  lines.forEach((l, i) => outlineText(l, cx, top + 8 + i * 17, font, '#fffbe8', 'center', '#1c1a26', 3));
}
function drawBackground() {
  const sc = G.cam, clk = G.clock || 0, p = dayPhase(), sk = skyAt(p);
  // (a) sky: gradient by time of day, stars at night, the sun or moon, three depths of clouds, a distant plane
  const skKey = rgb(sk.top) + rgb(sk.mid) + rgb(sk.hor);
  if (!skyCache || skyCache.key !== skKey) {      // the gradient only changes when the (integer) sky colours do
    const sg = ctx.createLinearGradient(0, 0, 0, 170);
    sg.addColorStop(0, rgb(sk.top)); sg.addColorStop(0.45, rgb(sk.mid)); sg.addColorStop(1, rgb(sk.hor));
    skyCache = { key: skKey, g: sg };
  }
  ctx.fillStyle = skyCache.g; ctx.fillRect(0, 0, W, SIDEWALK_TOP);
  if (sk.stars > 0) for (const [x, y, ph, sz] of STARS) {
    ctx.fillStyle = STAR_COL[Math.round(clamp(sk.stars * (0.55 + 0.45 * Math.sin(clk * 2.3 + ph)), 0, 1) * 100)];
    ctx.fillRect(x, y, sz, sz);
  }
  drawSunMoon(p);
  const cloudA = 1 - 0.55 * sk.tintA / 0.42;
  ctx.globalAlpha = cloudA;
  for (const layer of [0, 1, 2]) for (const c of CLOUDS) {
    if (c.layer !== layer) continue;
    const x = Math.round((((c.x - sc * c.k - clk * c.v) % c.P) + c.P) % c.P) - 140;
    if (x < W) ctx.drawImage(c.img, x, Math.round(c.y));
  }
  ctx.globalAlpha = 1;
  drawPlane(clk, sk);
  // (b) far skyline 0.1x, (c) mid towers 0.25x (hazier, bluer)
  drawParallaxImage(IMG.skyline_far, sc * 0.1, 64);
  drawParallaxImage(TOWERS, sc * 0.25, 22);
  // (d) storefront / building row 0.5x
  const bs = Math.round(sc * 0.5);
  for (const b of bldSeq) {
    const sx = b.x - bs;
    if (sx > W) break;
    if (sx + b.c.width < 0) continue;
    const by = SIDEWALK_TOP + 2 - b.c.height;
    ctx.drawImage(b.c, sx, by);
    if (b.c.hasFolk) for (const f of b.c.folk) { const s = folkSprite(f.name, Math.floor(clk * 2.2 + f.o) % 4); if (s) ctx.drawImage(s, sx + f.x, by + f.y); }   // the odd resident with a lively idle
    if (b.c.lit && sk.glow > 0.05) LIT_NOW.push(b.c.lit, sx, by);
  }
  updateQuote(bs);
  ctx.fillStyle = '#4a4f5c'; ctx.fillRect(0, SIDEWALK_TOP - 2, W, 4);   // building base shadow
  // sidewalk (1x)
  ctx.fillStyle = '#c9ccd3'; ctx.fillRect(0, SIDEWALK_TOP + 2, W, CURB_Y - SIDEWALK_TOP);
  ctx.fillStyle = '#b9bdc6'; ctx.fillRect(0, SIDEWALK_TOP + 2, W, 6);
  // (e) lamps / trees / hedges 0.8x
  const ds = Math.round(sc * 0.8);
  for (const e of DECOR_SEQ) {
    const sx = e.x - ds;
    if (sx > W + 80) break;
    if (sx < -200) continue;
    drawDecor(e, sx);
  }
  // (f) street at 1x
  ctx.fillStyle = '#aab0ba';
  const jo = -(Math.round(sc) % 48);
  for (let x = jo; x < W; x += 48) ctx.fillRect(x, 318, 2, CURB_Y - 318);
  ctx.fillRect(0, 317, W, 1);
  ctx.fillStyle = '#d9dce2'; ctx.fillRect(0, SIDEWALK_TOP + 8, W, 1);
  ctx.fillStyle = '#e6e8ec'; ctx.fillRect(0, CURB_Y, W, 3);
  ctx.fillStyle = '#8b909c'; ctx.fillRect(0, CURB_Y + 3, W, 5);
  ctx.fillStyle = '#3a3e4a'; ctx.fillRect(0, ROAD_Y, W, H - ROAD_Y);
  ctx.fillStyle = '#e8d070';
  const ro = -(Math.round(sc) % 64);
  for (let x = ro; x < W; x += 64) ctx.fillRect(x, 355, 34, 2);
  // evening falls over the whole street (characters are drawn after this, so they stay readable)
  if (sk.tintA > 0) { ctx.fillStyle = 'rgba(' + sk.tint + ',' + sk.tintA.toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  // lit windows, neon signs and shop lights come on at night (prerendered overlays)
  for (let i = 0; i < LIT_NOW.length; i += 3) { ctx.globalAlpha = Math.min(1, sk.glow * 1.1); ctx.drawImage(LIT_NOW[i], LIT_NOW[i + 1], LIT_NOW[i + 2]); }
  ctx.globalAlpha = 1; LIT_NOW.length = 0;
  // street lamps switch on as it gets dark: a warm glow and a pool of light on the pavement
  if (sk.glow > 0) for (const [lx, ly] of LAMPS_LIT) {
    ctx.fillStyle = 'rgba(255,214,120,' + (0.22 * sk.glow).toFixed(3) + ')';
    for (let k = 0; k < 4; k++) ctx.fillRect(lx - 10 - k * 6, ly + 4 + k * 16, 20 + k * 12, 16);
    ctx.fillStyle = 'rgba(255,230,150,' + (0.8 * sk.glow).toFixed(3) + ')'; ctx.fillRect(lx - 4, ly, 8, 3);
  }
  LAMPS_LIT = [];
  drawQuote(bs);
}

function drawDecor(e, sx) {
  const d = e.d, r = d.r, S = PROP_SCALE, base = 308;
  sx = Math.round(sx);
  if (d.kind === 'lamp') {
    const w = r.w * S, hh = r.h * S;
    const top = base - 170;
    ctx.fillStyle = '#8c95a6'; ctx.fillRect(sx + w / 2 - 3, top + hh - 4, 6, 170 - hh + 4);
    ctx.fillStyle = '#6f7889'; ctx.fillRect(sx + w / 2 + 1, top + hh - 4, 2, 170 - hh + 4);
    ctx.drawImage(IMG.general, r.x, r.y, r.w, r.h, sx, top, w, hh);
    ctx.fillStyle = '#6f7889'; ctx.fillRect(sx + w / 2 - 8, base - 6, 16, 6);
    LAMPS_LIT.push([sx + 10, top + hh - 2], [sx + w - 10, top + hh - 2]);   // under the two shades
  } else {
    ctx.drawImage(IMG.general, r.x, r.y, r.w, r.h, sx, base - r.h * S, r.w * S, r.h * S);
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
    } else if (e.type === 'pole') {
      ctx.fillStyle = '#6f7889'; ctx.fillRect(Math.round(sx) - 3, FEET_Y - e.h, 6, e.h);
      ctx.fillStyle = '#9aa3b4'; ctx.fillRect(Math.round(sx) - 3, FEET_Y - e.h, 2, e.h);
      ctx.fillStyle = '#4a4f5c'; ctx.fillRect(Math.round(sx) - 8, FEET_Y - 4, 16, 4); ctx.fillRect(Math.round(sx) - 6, FEET_Y - e.h - 3, 12, 3);
    } else if (e.type === 'toilet') {
      shadow(sx + 32, FEET_Y, 28, 0.25);
      ctx.drawImage(IMG.toilet, G.toilet.frame * 32, 0, 32, 32, Math.round(sx), FEET_Y - 60, 64, 64);
      if (G.state === 'win' && G.phase === 'lie') drawHeart(Math.round(sx) + 32, FEET_Y - 66, G.lieT);
    } else if (e.type === 'parrot') {
      const img = IMG['bird_' + e.variant];
      let fr = Math.floor(e.fl) % 8, left = true, bob = 0;
      if (e.kind === 'percher' && e.state === 'perch') { fr = 7; bob = Math.sin(e.bobT * (e.alert > 0 ? 20 : 10)) > 0.4 ? 2 : 0; }
      if (e.kind === 'thief' && e.state === 'fly') left = (e.facing || -1) < 0;
      if (e.v < 0 && e.state !== 'flee') left = false;
      ctx.save(); ctx.translate(Math.round(sx), Math.round(FEET_Y - e.c + bob));
      if (left) ctx.scale(-1, 1);  // sprite faces right; parrots mostly fly left
      ctx.drawImage(img, fr * 16, 0, 16, 16, -16, -16, 32, 32); ctx.restore();
      if (e.kind === 'percher' && e.alert > 0 && e.state === 'perch') outlineText('!', sx, FEET_Y - e.c - 24, pfont(16), '#ff6a5a', 'center');
      if (e.kind === 'thief' && e.state === 'fly') outlineText('?', sx, FEET_Y - e.c - 22, pfont(12), '#ffd24a', 'center');
    }
  }
}

// off-screen warning for a parrot: blinking "<!" marker at the right edge at the height(s) its path will cross,
// plus (for the first swooper of a run) a dotted preview of the dip
function drawWarns() {
  for (const w of G.warns) {
    const on = Math.floor(w.t * 10) % 2 === 0;
    if (w.arc) {
      for (let sx = W - 6; sx > 0; sx -= 12) { ctx.fillStyle = on ? '#fff' : '#ffd24a'; ctx.fillRect(Math.round(sx) - 1, Math.round(FEET_Y - swoopC(sx)) - 1, 3, 3); }
      outlineText('dip', DIP_X, FEET_Y - 32 + 18, pfont(10), '#ffd24a', 'center', '#1c1a26', 2);
    }
    if (on) for (const h of w.heights) outlineText('<!', W - 14, FEET_Y - h, pfont(18), '#ff5a4a', 'center', '#1c1a26', 4);
  }
}

function drawCritter() {
  const c = G.critter; if (!c) return;
  const def = CRITTERS[c.kind], img = IMG[def.img], s = def.scale, dh = c.sup + c.arc;
  shadow(c.sx, FEET_Y - c.sup, def.w * 0.5 * (1 - Math.min(0.5, c.arc / 90)), 0.25);
  let flip = c.dir < 0; if (def.faceLeft) flip = !flip;
  ctx.save(); ctx.translate(Math.round(c.sx), Math.round(FEET_Y - dh));
  ctx.scale(flip ? -1 : 1, c.sq > 0 ? 0.78 : 1);
  ctx.drawImage(img, c.frame * 32, 0, 32, 32, -16 * s, -32 * s, 32 * s, 32 * s);
  ctx.restore();
}

function drawDog() {
  const d = G.dog, sx = S2(d.x);
  const over = G.state === 'over' || (G.state === 'win' && G.phase === 'lie');
  shadow(sx + (over ? 4 : 0), FEET_Y - d.dh, 22, 0.3 * (d.dh > 0 ? 0.8 : 1));
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
  const w = 64, h = 22, bx = x - w / 2, by = y - h / 2;
  ctx.fillStyle = '#1c1a26'; ctx.fillRect(bx - 2, by - 2, w + 4, h + 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, w, h);
  const tx = clamp(sx, bx + 6, bx + w - 12);
  ctx.fillStyle = '#1c1a26'; ctx.fillRect(tx, by + h + 2, 6, 3); ctx.fillStyle = '#fff'; ctx.fillRect(tx, by + h, 6, 2);
  outlineText('HUFF!', bx + w / 2, by + h / 2 + 1, pfont(16), '#c4382f', 'center', '#fff', 0);
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

// speech bubble: mode 'edge' (pinned to a screen edge, tail points off-screen) or 'top' (Mimic's bubble, tail points up)
function drawSpeech(text, mode, side, pulse) {
  const font = pfont(16);
  const lines = wrapText(text, 240, font);
  ctx.font = font;
  const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
  const bw = Math.ceil(tw) + 16 + (mode === 'top' ? 20 : 0), bh = lines.length * 17 + 10;
  let bx, by;
  if (mode === 'edge') {
    const off = Math.round(Math.sin(pulse * 9) * 2.5);
    bx = side === 'left' ? 14 + off : W - 14 - bw - off; by = Math.round(FEET_Y - 88 - bh / 2);
  } else { bx = side === 'left' ? 14 : W - 14 - bw; by = 98 + Math.round(Math.sin(pulse * 8) * 1.5); }
  ctx.fillStyle = '#1c1a26'; ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
  ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#1c1a26';
  if (mode === 'edge') {
    const ty = Math.round(by + bh / 2), dir = side === 'left' ? -1 : 1, ex = side === 'left' ? bx : bx + bw;
    for (let i = 0; i < 8; i++) { ctx.fillRect(ex + dir * (i + 2) - (dir < 0 ? 1 : 0), ty - (8 - i) - 1, 1, (8 - i) * 2 + 2); }
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) { ctx.fillRect(ex + dir * (i + 1) - (dir < 0 ? 1 : 0), ty - (8 - i), 1, (8 - i) * 2); }
    // arrow chevrons on the edge
    outlineText(side === 'left' ? '<<' : '>>', side === 'left' ? 20 : W - 20, by + bh + 12, pfont(16), '#ff6a5a', 'center', '#1c1a26', 3);
  } else {
    const tx = side === 'left' ? bx + 24 : bx + bw - 24;   // tail points up: it comes from above
    for (let i = 0; i < 6; i++) ctx.fillRect(tx - (6 - i) - 1, by - 2 - i + 1, (6 - i) * 2 + 2, 1);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) ctx.fillRect(tx - (6 - i), by - i, (6 - i) * 2, 1);
    drawFeather(bx + bw - 15, Math.round(by + bh / 2) - 7);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1c1a26'; ctx.font = font;
  lines.forEach((l, i) => ctx.fillText(l, Math.round(bx + 8), Math.round(by + 5 + 8 + i * 17)));
}

function drawFeather(x, y) {   // tell-tale feather icon on a Mimic's bubble
  const px = [[6, 0, '#3cab46'], [5, 1, '#3cab46'], [6, 1, '#6ed264'], [4, 2, '#3cab46'], [5, 2, '#6ed264'], [3, 3, '#3cab46'], [4, 3, '#6ed264'], [2, 4, '#3cab46'], [3, 4, '#6ed264'],
    [1, 5, '#e1373a'], [2, 5, '#3cab46'], [1, 6, '#e1373a'], [0, 7, '#1c1a26'], [0, 8, '#1c1a26']];
  for (const [dx, dy, c] of px) { ctx.fillStyle = c; ctx.fillRect(x + dx * 2, y + dy * 1.5 | 0, 2, 2); }
}

function drawWoman() {
  const wm = G.wm;
  if (wm.mode === 'warn') { drawSpeech(wm.line, 'edge', wm.side, wm.pulse); return; }
  if (G.state === 'title' || (wm.mode === 'none' && !wm.over)) return;
  const sx = Math.round(wm.sx), y = FEET_Y - wm.dh - 30 * WOMAN_SCALE;
  shadow(sx, FEET_Y, 17 * (1 - Math.min(0.5, wm.dh / 250)), 0.28);
  ctx.save(); ctx.translate(sx, 0); ctx.scale(wm.flip ? -1 : 1, 1);
  ctx.drawImage(IMG.woman, wm.frame * 32, wm.row * 32, 32, 32, -16 * WOMAN_SCALE, Math.round(y), 32 * WOMAN_SCALE, 32 * WOMAN_SCALE);
  ctx.restore();
  // the shout only announces her: it stays pinned at her edge, pointing at her, until she's on screen
  if (wm.mode === 'charge' && !wm.entered) drawSpeech(wm.line, 'edge', wm.side, wm.pulse);
}

function drawParts() {
  for (const p of G.parts) {
    const k = 1 - p.t / p.life;
    if (p.k === 'dust') { ctx.globalAlpha = k * 0.7; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.3 - k * 0.5), 0, 6.283); ctx.fill(); }
    else if (p.k === 'spark') { ctx.globalAlpha = Math.min(1, k * 1.5); ctx.fillStyle = p.col; const s = Math.round(p.s); ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - s, 2, s * 2); ctx.fillRect(Math.round(p.x) - s, Math.round(p.y) - 1, s * 2, 2); }
    else if (p.k === 'feather') { ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s + 1, p.s - 1); }
    else if (p.k === 'bang') { ctx.globalAlpha = Math.min(1, k * 2); outlineText('!', p.x, p.y, pfont(Math.round(16 + (1 - k) * 6)), '#fff', 'center'); }
    else if (p.k === 'z') { ctx.globalAlpha = Math.min(1, k * 2); outlineText('z', p.x + Math.sin(p.t * 3) * 4, p.y, pfont(Math.round(10 + p.t * 5)), '#fff', 'center'); }
    else if (p.k === 'ring') { ctx.globalAlpha = k * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (let i = 0; i < 2; i++) { ctx.beginPath(); const r = 10 + (1 - k) * (40 + i * 22); if (p.s > 0) ctx.arc(p.x, p.y, r, -0.7, 0.7); else ctx.arc(p.x, p.y, r, Math.PI - 0.7, Math.PI + 0.7); ctx.stroke(); } }
    ctx.globalAlpha = 1;
  }
}

// All text is DotGothic16, a pixel font drawn on a 16 px grid: only 16 px and its multiples land its pixels on
// whole screen pixels, so it stays crisp when the canvas is scaled up.
const PF = '"DotGothic16", monospace';
function pfont(n) { return (n < 30 ? 16 : n < 46 ? 32 : 48) + 'px ' + PF; }
// outline drawn NES-style: the text stamped in the outline colour at every neighbouring pixel, then filled
function outlineText(str, x, y, font, col, align = 'left', oc = '#1c1a26', ow = 3) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
  x = Math.round(x); y = Math.round(y);
  if (ow) {
    const r = ow >= 6 ? 2 : 1; ctx.fillStyle = oc;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx || dy) ctx.fillText(str, x + dx, y + dy);
  }
  ctx.fillStyle = col; ctx.fillText(str, x, y);
}

function drawHUD() {
  ctx.fillStyle = 'rgba(20,22,34,0.5)'; ctx.fillRect(0, 0, W, 44);
  const m = Math.min(LEVEL_M, Math.floor(G.dist));
  // row 1 (y 11): level + metres | food | best      row 2 (y 33): progress bar + toilet | sound / pause
  outlineText('LEVEL ' + G.level + '  ' + m + ' / ' + LEVEL_M + ' m', 8, 11, pfont(16), '#fff', 'left', '#1c1a26', 3);
  const bx = 10, by = 29, bw = 150;   // progress bar with the toilet waiting at the end
  ctx.fillStyle = '#1c1a26'; ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
  ctx.fillStyle = '#3b4258'; ctx.fillRect(bx, by, bw, 8);
  ctx.fillStyle = '#8affb0'; ctx.fillRect(bx, by, Math.round(bw * clamp(G.dist / LEVEL_M, 0, 1)), 8);
  ctx.drawImage(IMG.toilet, 0, 0, 32, 32, bx + bw + 4, 22, 20, 20);
  outlineText('FOOD ' + String(G.score).padStart(4, '0'), W / 2, 11, pfont(16), '#fff', 'center');
  outlineText('BEST ' + String(G.best).padStart(4, '0') + '  LV ' + G.bestLevel, W - 8, 11, pfont(16), '#ffe680', 'right', '#1c1a26', 3);
  outlineText(Sfx.muted ? 'MUTED (M)  P: pause' : Sfx.blocked() ? 'SOUND OFF  P: pause' : 'M: mute  P: pause', W - 8, 31, pfont(16), '#cfe0ff', 'right', '#1c1a26', 2);
  // a reminder of the keys, just under the HUD (computers only; touch has its buttons)
  if (!touchMode && G.state !== 'over' && G.state !== 'win') { ctx.globalAlpha = 0.8; outlineText('ARROWS: move / duck   SPACE: jump   X: huff', W - 8, 55, pfont(16), '#fff', 'right', '#1c1a26', 2); ctx.globalAlpha = 1; }
  if (!paused && G.state !== 'title' && G.state !== 'over' && G.state !== 'win') drawSoundBlocked(touchMode ? 52 : 68);
  if (G.bannerT > 0 && G.state === 'play') {   // run intro banner, fades out
    const a = clamp(G.bannerT / 0.9, 0, 1) * clamp((3.4 - G.bannerT) / 0.3, 0, 1);
    ctx.globalAlpha = a;
    const lines = wrapText(INTRO, 400, pfont(16)), bh = lines.length * 20 + 20;
    ctx.fillStyle = '#1c1a26'; ctx.fillRect(W / 2 - 212, 190 - bh / 2 - 2, 424, bh + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fillRect(W / 2 - 210, 190 - bh / 2, 420, bh);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(W / 2 - 210, 190 - bh / 2, 420, 3);
    ctx.font = pfont(16); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1c1a26';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, Math.round(190 - bh / 2) + 20 + i * 20));
    ctx.globalAlpha = 1;
  }
  if (G.cardT > 0 && (G.state === 'play')) {
    ctx.globalAlpha = clamp(G.cardT / 0.6, 0, 1) * clamp((2.2 - G.cardT) / 0.15, 0, 1);
    outlineText('LEVEL ' + G.level, W / 2, 130, pfont(48), '#fff', 'center', '#2c2a44', 8);
    ctx.globalAlpha = 1;
  }
}

function drawTexts() {
  for (const t of G.texts) {
    ctx.globalAlpha = clamp((1 - t.t / t.life) * 2, 0, 1);
    outlineText(t.str, clamp(t.x, 60, W - 60), t.y, pfont(t.size), t.col, 'center');
  }
  ctx.globalAlpha = 1;
}

function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(18,20,32,0.88)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6); ctx.globalAlpha = 1;
}

// leaderboard list: rank | LEVEL | METERS | FOOD | DATE (right-aligned numbers). hl = rank to highlight (1-based), n = rows shown
// the leaderboard is drawn into an offscreen canvas that is only redrawn when its contents or highlight change
let lbCache = null;
function drawLB(x, y, hl, n = 10) {
  const key = hl + '|' + n + '|' + G.lb.slice(0, n).map(e => e.t + ',' + e.level + ',' + e.m + ',' + e.score).join(';');
  const PX = 14, PY = 14, h = 2 * 17 + 4 + n * 17 + 2 * PY;
  if (!lbCache || lbCache.key !== key) {
    const [c, cx2] = newCanvas(PX + 372 + 14, h), main = ctx;
    ctx = cx2;
    try { drawLBRaw(PX, PY, hl, n); } finally { ctx = main; }
    lbCache = { key, c };
  }
  ctx.drawImage(lbCache.c, x - PX, y - PY);
}
function drawLBRaw(x, y, hl, n) {
  const f = pfont(16), RH = 17;
  const cRank = x, cLv = x + 112, cM = x + 184, cFood = x + 232, cDate = x + 248;
  outlineText('TOP ' + n, x + 160, y, pfont(16), '#ffd24a', 'center', '#1c1a26', 2);
  const hy = y + RH + 2;
  outlineText('RANK', cRank, hy, f, '#b8bfd6', 'left', '#1c1a26', 2);
  outlineText('LEVEL', cLv, hy, f, '#cfe0ff', 'right', '#1c1a26', 2);
  outlineText('METERS', cM, hy, f, '#cfe0ff', 'right', '#1c1a26', 2);
  outlineText('FOOD', cFood, hy, f, '#ffe680', 'right', '#1c1a26', 2);
  outlineText('DATE', cDate, hy, f, '#b8bfd6', 'left', '#1c1a26', 2);
  for (let i = 0; i < n; i++) {
    const e = G.lb[i], yy = y + 2 * RH + 4 + i * RH;
    if (hl === i + 1) { ctx.fillStyle = 'rgba(255,210,74,0.30)'; ctx.fillRect(x - 6, yy - 8, 366, RH); }
    const col = hl === i + 1 ? '#fff6a0' : '#fff';
    if (!e) { outlineText('#' + (i + 1), cRank, yy, f, '#7c8296', 'left', '#1c1a26', 2); outlineText('---', cLv, yy, f, '#7c8296', 'right', '#1c1a26', 2); continue; }
    outlineText('#' + (i + 1), cRank, yy, f, col, 'left', '#1c1a26', 2);
    outlineText(String(e.level), cLv, yy, f, '#cfe0ff', 'right', '#1c1a26', 2);
    outlineText(String(e.m), cM, yy, f, '#cfe0ff', 'right', '#1c1a26', 2);
    outlineText(String(e.score), cFood, yy, f, '#ffe680', 'right', '#1c1a26', 2);
    outlineText(fmtDate(e.t), cDate, yy, f, '#b8bfd6', 'left', '#1c1a26', 2);
    if (hl === i + 1) outlineText('NEW', x + 56, yy, f, '#8affb0', 'left', '#1c1a26', 2);
  }
}

function drawClearBar(cx, y) {
  if (G.clearHold > 0) {
    ctx.fillStyle = '#1c1a26'; ctx.fillRect(cx - 52, y - 4, 104, 8);
    ctx.fillStyle = '#ff6a5a'; ctx.fillRect(cx - 50, y - 2, Math.round(100 * clamp(G.clearHold / 1.2, 0, 1)), 4);
  }
}

// Safari may keep audio locked after a keypress; only a click is sure to unlock it. Say so on screen.
function drawSoundBlocked(y) {
  if (!Sfx.blocked() || document.hidden) return;
  const a = 0.75 + 0.25 * Math.sin(performance.now() / 180);
  ctx.globalAlpha = a;
  const msg = touchMode ? 'NO SOUND? TAP THE GAME TO TURN IT ON' : 'NO SOUND? CLICK THE GAME TO TURN IT ON', w = 332;
  ctx.fillStyle = '#1c1a26'; ctx.fillRect(W / 2 - w / 2 - 2, y - 2, w + 4, 24);
  ctx.fillStyle = '#ffd24a'; ctx.fillRect(W / 2 - w / 2, y, w, 20);
  ctx.font = pfont(16); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#1c1a26';
  ctx.fillText(msg, W / 2, y + 11);
  ctx.globalAlpha = 1;
}
// ---- title screen: the level-1 street with Missy ready to go, a chunky tilted title and the owner's medallion.
// Static art is baked once into an offscreen layer (hard-edged: alpha is thresholded).
function hardenAlpha(c) {   // no anti-aliasing: every pixel fully on or off (skipped if the canvas is tainted, e.g. file:// in Chrome)
  try { hardenAlphaRaw(c); } catch (e) {}
}
function hardenAlphaRaw(c) {
  const d = c.getImageData(0, 0, c.canvas.width, c.canvas.height), a = d.data;
  for (let i = 3; i < a.length; i += 4) a[i] = a[i] >= 110 ? 255 : 0;
  c.putImageData(d, 0, 0);
}
function newCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
// a line of big title text: vertical red-orange-yellow gradient, thick black outline, dark drop shadow; drawn rotated into c2
function bigText(c2, str, cx, cy, ang, outline, shadow) {
  const [t, x] = newCanvas(360, 100), pad = 50;
  x.font = pfont(48); x.textAlign = 'center'; x.textBaseline = 'middle';
  const ox = 180, oy = 50;
  x.fillStyle = '#000';
  for (let dy = -outline; dy <= outline; dy++) for (let dx = -outline; dx <= outline; dx++) if (dx * dx + dy * dy <= outline * outline + 1) x.fillText(str, ox + dx, oy + dy);
  const [sh, sx] = newCanvas(360, 100);   // shadow: the outlined silhouette, shifted down-right and darkened
  sx.drawImage(t, shadow, shadow); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#2a1030'; sx.fillRect(0, 0, 360, 100);
  const [g, gx] = newCanvas(360, 100);    // gradient fill clipped to the glyphs
  gx.font = x.font; gx.textAlign = 'center'; gx.textBaseline = 'middle'; gx.fillStyle = '#fff'; gx.fillText(str, ox, oy);
  gx.globalCompositeOperation = 'source-in';
  const gr = gx.createLinearGradient(0, oy - 16, 0, oy + 16); gr.addColorStop(0, '#e8262a'); gr.addColorStop(0.5, '#ff8a1c'); gr.addColorStop(1, '#ffe83a');
  gx.fillStyle = gr; gx.fillRect(0, 0, 360, 100);
  c2.save(); c2.translate(cx, cy); c2.rotate(ang); c2.imageSmoothingEnabled = false;
  c2.drawImage(sh, -ox, -oy); c2.drawImage(t, -ox, -oy); c2.drawImage(g, -ox, -oy); c2.restore();
}
function plainTilt(c2, str, cx, cy, ang, col, oc) {
  const [t, x] = newCanvas(340, 40);
  x.font = pfont(16); x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = oc; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx || dy) x.fillText(str, 170 + dx, 20 + dy);
  x.fillStyle = col; x.fillText(str, 170, 20);
  c2.save(); c2.translate(cx, cy); c2.rotate(ang); c2.drawImage(t, -170, -20); c2.restore();
}
function medallion(c, cx, cy, r, bg, img, sx, sy, scale) {
  c.fillStyle = '#7a1018'; c.beginPath(); c.arc(cx, cy, r + 8, 0, 7); c.fill();
  c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(cx, cy, r + 5, 0, 7); c.fill();
  c.fillStyle = '#e8262a'; c.beginPath(); c.arc(cx, cy, r + 1, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, r - 2, 0, 7); c.clip();
  c.fillStyle = bg; c.fillRect(cx - r, cy - r, r * 2, r * 2);
  c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(cx - r * 0.3, cy - r * 0.4, r * 0.6, 0, 7); c.fill();
  c.imageSmoothingEnabled = false;
  c.drawImage(img, sx * 32, sy * 32, 32, 32, cx - 16 * scale, cy - 24 * scale + 4, 32 * scale, 32 * scale);
  c.restore();
}
let titleLayer = null;
function buildTitleLayer() {
  const [B, b] = newCanvas(W, H);
  bigText(b, "Missy's", 112, 40, -0.07, 3, 4);
  bigText(b, 'Big Day Out!', 170, 90, -0.07, 3, 4);
  hardenAlpha(b);
  const [M, m] = newCanvas(W, H);
  try { medallion(m, 372, 186, 50, '#5aa8e0', IMG.woman, 0, 0, 6); } catch (e) {}
  hardenAlpha(m);
  titleLayer = [B, M];
}
function drawTitle() {
  if (!titleLayer) buildTitleLayer();
  ctx.imageSmoothingEnabled = false;
  const blink = Math.floor(G.titleT * 1.8) % 2 === 0;
  if (G.showLB) {
    ctx.fillStyle = 'rgba(20,24,44,0.35)'; ctx.fillRect(0, 0, W, H);
    panel(110, 30, 420, 230);
    drawLB(156, 46, 0, 10);
    outlineText('L: back    hold C: clear scores', W - 8, 282, pfont(16), '#fff', 'right', '#1c1a26', 2);
    drawClearBar(W - 120, 298);
    return;
  }
  ctx.drawImage(titleLayer[0], 0, 0);
  ctx.drawImage(titleLayer[1], 0, 0);
  if (G.audioTest) {
    drawAudioTest();
    if (blink) outlineText('PRESS SPACE TO START', W / 2, 340, pfont(32), '#fff', 'center', '#7a1018', 6);
    if (Sfx.muted) outlineText('Sound is muted \u2014 press M', W / 2, 300, pfont(16), '#ffd0d0', 'center', '#3a0c14', 3);
    return;
  }
  outlineText('OWNER', 372, 252, pfont(16), '#fff', 'center', '#1c1a26', 2);
  // compact info, top right
  if (!touchMode) outlineText('ARROWS move/duck  SPACE jump  X huff', W - 8, 12, pfont(16), '#fff', 'right', '#1c1a26', 2);
  if (Sfx.muted) outlineText('Sound is muted \u2014 press M', W - 8, 32, pfont(16), '#ffb0b0', 'right', '#3a0c14', 3);
  else outlineText((touchMode ? '' : 'L: high scores   ') + 'M: mute', W - 8, 32, pfont(16), '#cfe0ff', 'right', '#1c1a26', 2);
  if (G.best) outlineText('BEST ' + G.best + '   LEVEL ' + G.bestLevel, W - 8, 52, pfont(16), '#ffe680', 'right', '#1c1a26', 3);
  if (blink) outlineText(touchMode ? 'TAP TO START' : 'PRESS ANY KEY TO START', W / 2, 338, pfont(32), '#fff', 'center', '#7a1018', 6);
}

// ?scn=audiotest: a self-diagnosis panel on the title screen
const TEST_BTN = { x: 190, y: 156, w: 110, h: 26 };
function drawAudioTest() {
  const b = TEST_BTN;
  panel(b.x - 30, b.y - 30, 290, 140);
  outlineText('SOUND TEST', b.x + 6, b.y - 10, pfont(11), '#ffd24a', 'left', '#1c1a26', 2);
  ctx.fillStyle = '#2e7d4f'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  outlineText('Test sound', b.x + b.w / 2, b.y + b.h / 2 + 1, pfont(12), '#fff', 'center', '#14301f', 2);
  const st = Sfx.states();
  const rows = ['kit ctx: ' + (st.kit.join(',') || 'not created'), 'huff ctx: ' + (st.mine.join(',') || 'not created'), 'muted: ' + Sfx.muted,
    'music: ' + (Sfx.music.current() || 'none') + (Sfx.music.isPlaying() ? ' (playing)' : '')];
  rows.forEach((r, i) => outlineText(r, b.x, b.y + 44 + i * 14, pfont(10), '#cfe0ff', 'left', '#1c1a26', 2));
}
function runAudioTest() {
  Sfx.unlock(); Sfx.sfx('eat'); Sfx.music.play('camptown');
  setTimeout(() => { if (G.state === 'title') Sfx.music.stop(); }, 2000);
}

function drawOver() {
  ctx.fillStyle = 'rgba(20,24,44,0.35)'; ctx.fillRect(0, 0, W, H);
  panel(14, 16, 612, 252);
  const cx = 142;
  outlineText('Oh, Missy!', cx, 52, pfont(32), '#fff', 'center', '#2c2a44', 6);
  outlineText(G.reason === 'caught' ? 'She caught you!' : 'Squished by the street!', cx, 90, pfont(16), '#ffb0b0', 'center', '#1c1a26', 2);
  outlineText('FOOD ' + G.score, cx, 126, pfont(32), '#ffe680', 'center', '#1c1a26', 3);
  outlineText('Level ' + G.level + '   ' + Math.min(LEVEL_M, Math.floor(G.dist)) + ' m', cx, 158, pfont(16), '#cfe0ff', 'center', '#1c1a26', 2);
  outlineText(G.rank === 1 ? 'NEW HIGH SCORE!' : G.rank > 0 ? 'NEW #' + G.rank + '!' : 'Best  ' + G.best, cx, 184, pfont(16), G.rank > 0 ? '#8affb0' : '#fff', 'center', '#1c1a26', 2);
  if (G.overT > 0.6 && Math.floor(G.overT * 1.8) % 2 === 0) outlineText(touchMode ? 'TAP TO TRY AGAIN' : 'SPACE / ENTER: try again', cx, 218, pfont(16), '#fff', 'center', '#1c1a26', 2);
  outlineText('hold C: clear scores', cx, 244, pfont(16), '#9aa3be', 'center', '#1c1a26', 2);
  drawClearBar(cx, 258);
  drawLB(262, 36, G.rank, 10);
}

function drawWin() {
  if (G.phase === 'walk' || G.lieT < 1.4) return;
  ctx.globalAlpha = clamp((G.lieT - 1.4) / 0.4, 0, 1);
  panel(150, 40, 340, 172);
  outlineText('Level ' + G.level + ' complete!', W / 2, 72, pfont(32), '#fff', 'center', '#2c2a44', 5);
  outlineText('Food this level  ' + (G.score - G.levelStart), W / 2, 118, pfont(16), '#ffe680', 'center');
  outlineText('Total food       ' + G.score, W / 2, 142, pfont(16), '#ffe680', 'center');
  if (G.lieT > 2.2 && Math.floor(G.lieT * 1.8) % 2 === 0) outlineText((touchMode ? 'TAP' : 'SPACE') + ' for level ' + (G.level + 1), W / 2, 184, pfont(16), '#fff', 'center', '#1c1a26', 3);
  ctx.globalAlpha = 1;
}

function drawPause() {
  ctx.fillStyle = 'rgba(15,18,30,0.6)'; ctx.fillRect(0, 0, W, H);
  outlineText('PAUSED', W / 2, 150, pfont(48), '#fff', 'center', '#2c2a44', 7);
  outlineText(touchMode ? 'tap to resume' : 'press SPACE, P or Esc to resume', W / 2, 202, pfont(16), '#ffe9a8', 'center');
}

function render() {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (G.shake > 0.3) ctx.translate(Math.round(rnd(-G.shake, G.shake) * 0.5), Math.round(rnd(-G.shake, G.shake) * 0.5));
  drawBackground();
  drawEntities();
  drawCritter();
  drawWarns();
  drawDog();
  drawWoman();   // in front of everything: she runs through obstacles
  drawParts();
  drawTexts();
  if (G.mimic) drawSpeech(G.mimic.line, 'top', G.mimic.side, G.mimic.t);
  drawForeground();
  ctx.restore();
  if (G.state === 'title') drawTitle();
  else { drawHUD(); if (G.state === 'over') drawOver(); if (G.state === 'win') drawWin(); }
  if (paused) drawPause();
}

// =====================================================================
//  Input
// =====================================================================
let paused = false, touchMode = false;
function press(action) {
  if (document.body.classList.contains('portrait')) return;   // the rotate overlay is up: nothing starts behind it
  ensureAudio();
  if (paused && action === 'jump' && !document.body.classList.contains('portrait')) { togglePause(); return; }  // Space unpauses
  if (G.state === 'title') { if (action === 'jump' && !G.showLB) startGame(); else if (action === 'jump') { G.showLB = false; startGame(); } return; }
  if (G.state === 'over') { if (action === 'jump' && G.overT > 0.6) goToTitle(); return; }
  if (G.state === 'win') { if (action === 'jump' && G.lieT > 2.2 && !paused) startLevel(G.level + 1); return; }
  if (paused || G.state !== 'play') return;
  if (action === 'jump') { G.jumpBuf = BUFFER; G.jumpHeld = true; }
  if (action === 'huff') doHuff();
}
function togglePause() {
  if (G.state !== 'play' && G.state !== 'win') return;
  paused = !paused;
  if (paused) Sfx.pause(); else Sfx.unpause();
}

function ensureAudio() { if (!paused && Sfx.blocked()) Sfx.unlock(); }
addEventListener('keydown', e => {
  if (!e.repeat) ensureAudio();
  const c = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
  if (c === 'ArrowLeft') kb.left = true;
  else if (c === 'ArrowRight') kb.right = true;
  else if (c === 'ArrowDown') kb.down = true;
  else if (c === 'KeyC') kb.clear = true;
  if (e.repeat) return;
  if (G.state === 'title' && !G.audioTest && !/^(Key[MLP]|Escape|Shift|Control|Alt|Meta|Caps|Tab|F\d|OS|ContextMenu|NumLock)/.test(c) && !(c === 'KeyC' && G.showLB)) { G.showLB = false; startGame(); return; }
  // game over and level complete also continue on any key (M mutes, C clears scores)
  if ((G.state === 'over' || G.state === 'win') && !paused && !/^(Key[MCP]|Escape|Shift|Control|Alt|Meta|Caps|Tab|F\d|OS|ContextMenu|NumLock)/.test(c)) { press('jump'); return; }
  if (c === 'Space' || c === 'ArrowUp') press('jump');
  else if (c === 'Enter' && (G.state === 'over' || G.state === 'title')) press('jump');
  else if (c === 'KeyX') press('huff');
  else if (c === 'KeyP' || c === 'Escape') togglePause();
  else if (c === 'KeyM') Sfx.toggle();
  else if (c === 'KeyL' && G.state === 'title') { G.showLB = !G.showLB; if (G.showLB) G.lb = loadLB(); }
});
addEventListener('keyup', e => {
  const c = e.code;
  if (c === 'Space' || c === 'ArrowUp') G.jumpHeld = false;
  else if (c === 'ArrowLeft') kb.left = false;
  else if (c === 'ArrowRight') kb.right = false;
  else if (c === 'ArrowDown') kb.down = false;
  else if (c === 'KeyC') kb.clear = false;
});
function autoPause() { if ((G.state === 'play' || G.state === 'win') && !paused) { paused = true; Sfx.pause(); } }   // stays paused until the player resumes
addEventListener('blur', () => { autoPause(); kb.left = kb.right = kb.down = kb.clear = false; vk.left = vk.right = vk.down = false; G.jumpHeld = false; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { autoPause(); Sfx.suspend(); }
  else { try { window.focus(); } catch (e) {} if (!paused) Sfx.resume(); }
});
// Safari is strict about user activation: resume synchronously inside every gesture handler
for (const ev of ['pointerdown', 'mousedown', 'click', 'touchend', 'touchstart', 'keyup']) addEventListener(ev, () => ensureAudio(), true);
document.addEventListener('contextmenu', e => e.preventDefault());
// Mouse (desktop): click the game to jump / start / restart, right-click to huff.
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (e.pointerType === 'touch') return;          // touch plays through the gutter buttons only
  if (G.audioTest && G.state === 'title') {
    const mx = e.offsetX * W / cv.clientWidth, my = e.offsetY * H / cv.clientHeight, b = TEST_BTN;
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { runAudioTest(); return; }
  }
  if (e.button === 2) press('huff'); else press('jump');
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) addEventListener(ev, e => { if (e.pointerType !== 'touch') G.jumpHeld = false; }, true);
// Touch: tap anywhere (outside the buttons) to start / restart / continue / resume. Not during play.
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  setTouch();
  if (e.target.closest && e.target.closest('.tbtn')) return;
  if (!paused) Sfx.unlock();
  if (document.body.classList.contains('portrait')) return;
  if (paused) { togglePause(); return; }
  if (G.state === 'title' || G.state === 'over' || G.state === 'win') press('jump');
});
// On-screen buttons: pointer events tracked per pointerId so you can hold left/right and tap jump at once.
function bindBtn(id, down, up) {
  const el = document.getElementById(id), active = new Set();
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    active.add(e.pointerId); el.classList.add('on'); if (!paused) Sfx.unlock();
    if (active.size === 1) down();
  });
  const rel = e => {
    if (!active.delete(e.pointerId)) return;
    if (!active.size) { el.classList.remove('on'); if (up) up(); }
  };
  const reset = () => { if (active.size) { active.clear(); el.classList.remove('on'); if (up) up(); } };   // never leave a button stuck on
  el.addEventListener('pointerup', rel); el.addEventListener('pointercancel', rel); el.addEventListener('lostpointercapture', rel);
  addEventListener('blur', reset); document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
}
bindBtn('bLeft', () => { vk.left = true; }, () => { vk.left = false; });
bindBtn('bRight', () => { vk.right = true; }, () => { vk.right = false; });
bindBtn('bDuck', () => { vk.down = true; }, () => { vk.down = false; });
bindBtn('bJump', () => press('jump'), () => { G.jumpHeld = false; });
bindBtn('bHuff', () => press('huff'));
bindBtn('bPause', () => togglePause());
function setTouch() { if (!touchMode) { touchMode = true; document.body.classList.add('touch'); resize(); } }
if ((window.matchMedia && matchMedia('(pointer: coarse)').matches) || (DEBUG && /[?&]touch=1/.test(location.search))) { touchMode = true; document.body.classList.add('touch'); }

// ---- layout: one fixed 640x360 view everywhere, scaled uniformly (never cropped or stretched) ----
function insets() { const cs = getComputedStyle(document.getElementById('sa')); return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 }; }
function resize() {
  const vw = window.innerWidth, vh = window.innerHeight, ins = insets();
  const portrait = touchMode && vh > vw;
  document.body.classList.toggle('portrait', portrait);
  if (portrait) autoPause();
  const gw = touchMode ? Math.max(88, Math.round(vw * 0.13)) : 0;
  const availW = vw - (touchMode ? 2 * gw + ins.l + ins.r : 0), availH = vh;
  let s = Math.min(availW / W, availH / H);
  const fi = Math.floor(s);
  if (fi >= 1 && fi >= 0.85 * s) s = fi;            // integer scale when it fits well, else the largest uniform fit
  const gwp = Math.max(1, Math.floor(W * s)), ghp = Math.max(1, Math.floor(H * s));
  const wrap = document.getElementById('wrap');
  wrap.style.width = gwp + 'px'; wrap.style.height = ghp + 'px';
  wrap.style.top = Math.floor((vh - ghp) / 2) + 'px';
  wrap.style.left = (touchMode ? Math.round(ins.l + gw + (availW - gwp) / 2) : Math.floor((vw - gwp) / 2)) + 'px';
  const gl = document.getElementById('gl'), gr = document.getElementById('gr');
  gl.style.left = ins.l + 'px'; gl.style.width = gw + 'px'; gr.style.right = ins.r + 'px'; gr.style.width = gw + 'px';
  document.documentElement.style.setProperty('--bs', Math.max(64, Math.min(86, gw - 14, Math.floor((vh - 60) / 3.4))) + 'px');
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 120));
resize();

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
  ctx.fillStyle = '#fff'; ctx.font = '16px monospace'; ctx.textAlign = 'center'; ctx.fillText('Loading...', W / 2, H / 2);
  try { await loadAll(); } catch (e) { ctx.fillText('Failed to load: ' + e, W / 2, H / 2 + 30); throw e; }
  buildScenery(1); layoutBuildings(1); layoutDecor(1); layoutFG(1); OBST = obstacleDefs();
  G.cfg = levelCfg(1); G.toilet = { blink: 0, blinkT: 3, frame: 0 };
  G.dog = newDog(); G.wm = newWoman(); G.lb = loadLB();
  G.state = 'title'; G.titleT = 0; G.cam = 0;
  G.wm.over = true; G.wm.sx = 240; G.wm.flip = false;
  debugRun();
  try { Sfx.unlock(); if (G.state === 'title') playTitleSong(); } catch (e) {}   // title song; browsers may still block it until the first gesture
  requestAnimationFrame(frame);
}
init();

// ---- debug hooks (ONLY with ?debug=1, e.g. ?debug=1&scn=fuzz; they never write localStorage) for headless screenshots: ?level=N  ?critter=rabbit|cat|frog  ?seed=1  ?lb=1  ?scn=...&freeze=1 ----
function step(n) { for (let i = 0; i < n; i++) update(DT); }
function debugRun() {
  if (!DEBUG) return;
  const q = new URLSearchParams(location.search), scn = q.get('scn');
  window.__G = G; window.__dbg = { step, buildPlans, startLevel, startWoman, spawnParrot, spawnCritter, addObstacle, addFood, OBST: () => OBST };
  if (q.has('seed')) { // sample leaderboard
    const now = Date.now(), mk = (s, l, m, ago) => ({ t: now - ago * 3600e3, score: s, level: l, m });
    saveLB([mk(212, 5, 51, 30), mk(160, 4, 75, 5), mk(133, 4, 22, 52), mk(98, 3, 60, 70), mk(75, 3, 18, 100), mk(61, 2, 75, 130), mk(44, 2, 30, 200), mk(30, 1, 75, 260), mk(18, 1, 40, 300), mk(7, 1, 12, 400)]);
    G.lb = loadLB();
  }
  if (q.has('lb')) { G.showLB = true; G.lb = loadLB(); }
  if (scn === 'audiotest') { G.audioTest = true; return; }
  const lvl = parseInt(q.get('level') || '0', 10);
  if (!scn && !lvl && !q.has('critter')) return;
  startGame(); if (lvl > 1) startLevel(lvl);
  const d = G.dog, ob = n => OBST.find(o => o.name === n);
  G.parrotPlan = []; G.womanPlan = []; G.warns = []; G.entities = G.entities.filter(e => e.type === 'toilet'); G.nextSpawnX = 1e9; G.critterQueue = []; G.cardT = 0; G.bannerT = 0;
  if (q.get('critter')) { spawnCritter(q.get('critter'), 'right'); G.critter.sx = W * 0.55; step(20); }
  if (lvl && !scn && !q.get('critter')) { G.nextSpawnX = 480; buildPlans(G.level); step(60); }
  if (scn === 'play') { G.nextSpawnX = 480; step(100); }
  if (scn === 'l1') { G.nextSpawnX = 480; buildPlans(G.level); const T = parseInt(q.get('t') || '780', 10); for (let i = 0; i < T && G.state === 'play'; i++) { d.x = G.cam + 280; d.inv = 9; step(1); } }
  if (scn === 'hop') { addFood(d.x + 90, 2, 'meat1'); addFood(d.x + 160, 2, 'salmon'); addFood(d.x + 40, 2, 'fish'); addFood(d.x - 70, 2, 'bacon'); step(24); }
  if (scn === 'parrot') { const sx = S2(d.x); spawnParrot('cruiser', { sx: sx + 120, c: 32 }); spawnParrot('cruiser', { sx: sx + 230, c: 8 }); spawnParrot('swooper', { sx: sx + 330 }); step(6); }
  if (scn === 'warnparrot') { beginParrotWarn({ kind: 'cruiser', low: false, variant: 'green' }, true); step(25); }
  if (scn === 'warnswoop') { G.level = 2; G.cfg = levelCfg(2); beginParrotWarn({ kind: 'swooper', variant: 'blue' }, true); step(20); }
  if (scn === 'perch') { G.level = 3; G.cfg = levelCfg(3); spawnParrot('percher', { sx: 560 }); step(70); }
  if (scn === 'lvl5') { G.level = 5; G.cfg = levelCfg(5); const sx = S2(d.x); spawnParrot('swooper', { sx: sx + 150 }); spawnParrot('flock', { sx: sx + 300 }); spawnParrot('percher', { sx: 500 }); spawnParrot('swooper', { sx: sx + 440 }); step(40); }
  if (scn === 'mimic') { G.level = 6; G.cfg = levelCfg(6); startMimic(); step(40); }
  if (scn === 'warn') { startWoman({ side: 'left', beh: 'run' }); step(70); }
  if (scn === 'charge') { startWoman({ side: 'right', beh: 'run', warnT: 0.1 }); step(100); }
  if (scn === 'stand') { const o = addObstacle(d.x - 40, ob('dumpster')); addFood(d.x + 60, o.h + 2, 'bone'); d.dh = o.h; d.dv = 0; d.ground = true; d.x += 10; step(3); }
  if (scn === 'duck') { kb.down = true; spawnParrot('cruiser', { sx: S2(d.x) + 70, c: 32 }); step(8); }
  if (scn === 'over') { startWoman({ side: 'left', beh: 'run', warnT: 0.01 }); G.wm.sx = S2(d.x) - 40; G.score = 87; step(30); }
  if (scn === 'trap') { d.x = G.cam + 70; addObstacle(d.x + HW + 6, ob('crate2')); step(60); }
  if (scn === 'trapfreeze') { d.x = G.cam + 70; addObstacle(d.x + HW + 6, ob('crate2')); for (let i = 0; i < 600 && G.state === 'play'; i++) step(1); step(70); }
  if (scn === 'stun') { G.score = 1; spawnParrot('cruiser', { sx: S2(d.x) + 20, c: 32 }); step(10); }
  if (scn === 'windup') { startWoman({ side: 'left', beh: 'lunge', warnT: 0.01 }); step(60); while (G.wm.phase !== 'windup' && G.state === 'play') { G.dog.x = G.cam + 560; step(1); } step(10); }
  if (scn === 'end') { G.cam = 2930; d.x = G.cam + 260; G.nextSpawnX = 1e9; step(50); }
  if (scn === 'win') { G.score = 41; G.levelStart = 12; G.cam = 2990; d.x = TOILET_X - 60; step(260); }
  if (scn === 'lbover') { G.score = 160; G.level = 4; d.x = G.cam + 70; addObstacle(d.x + HW + 6, ob('crate2')); for (let i = 0; i < 600 && G.state === 'play'; i++) step(1); step(90); }
  if (scn === 'fuzz') fuzz();
  if (scn === 'audio') { Sfx.unlock(); setTimeout(() => { document.title = JSON.stringify({ da: typeof window.DogAudio, ver: DogAudio.version, music: DogAudio.music.current(), playing: DogAudio.music.isPlaying(), tempo: Math.round(DogAudio.music.getTempo()), lines: LINES.length }); }, 800); }
  if (scn === 'longline') { startWoman({ side: 'right', beh: 'run' }); G.wm.line = 'I have to send this SD card to my gaffer over Slack!'; step(70); }
  if (q.has('freeze')) window.__freeze = true;
}
function fuzz() { // headless self-test, results in document.title
  const out = { woman: [], levels: [] };
  for (const beh of ['run', 'sprint', 'lunge', 'hop', 'turn', 'leap']) for (const side of ['left', 'right']) {
    startLevel(6); G.nextSpawnX = 1e9; G.parrotPlan = []; G.womanPlan = []; let n = 0, caught = 0;
    G.wm = newWoman(); startWoman({ beh, side, warnT: 0.1 });
    while (G.wm.mode !== 'none' && n < 3000) { G.dog.stun = 0; G.wm.over = false; step(1); if (G.state === 'over') { G.state = 'play'; caught++; } G.dog.x = G.cam + 560; n++; }
    out.woman.push(beh + side[0] + ':' + n + (caught ? 'c' : ''));
  }
  // random-input play-through of several levels: no exceptions, level completes get reached via a walking bot
  for (const lv of [1, 3, 6, 9]) {
    startGame(); startLevel(lv); let i = 0, jumps = 0;
    for (; i < 60 * 240 && (G.state === 'play' || G.state === 'crush'); i++) {
      kb.right = (i % 160) < 110; kb.left = !kb.right && (i % 5 === 0); kb.down = (i % 90) > 72;
      if (i % 22 === 0) { G.jumpBuf = BUFFER; G.jumpHeld = true; jumps++; } if (i % 22 === 11) G.jumpHeld = false;
      if (i % 50 === 0) doHuff();
      step(1);
    }
    kb.right = kb.left = kb.down = false;
    out.levels.push({ lv, state: G.state, reason: G.reason, score: G.score, m: Math.floor(G.dist), sec: Math.round(i / 60), ents: G.entities.length });
  }
  document.title = JSON.stringify(out);
}

// ---- new-version check: GitHub Pages can't be told not to cache, so a page that's been open (or cached) a while
// asks version.json for the deployed build id and reloads itself at a fresh URL when a newer one is live.
// It only reloads on the title screen or while paused, never mid-run, and only once per new build.
let pendingBuild = null;
function reloadIfNewer() {
  if (!pendingBuild || !(G.state === 'title' || paused)) return;
  if (new URLSearchParams(location.search).get('v') === pendingBuild) return;   // already reloaded for it
  location.replace(location.pathname + '?v=' + pendingBuild);
}
function checkVersion() {
  if (!window.BUILD_ID || !/^https?:$/.test(location.protocol)) return;          // dev page or a downloaded copy
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(v => {
    if (v && v.build && v.build !== window.BUILD_ID) { pendingBuild = v.build; reloadIfNewer(); }
  }).catch(() => {});
}
checkVersion();
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
setInterval(reloadIfNewer, 1000);
