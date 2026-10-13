// Sound glue: all sounds and music come from dog-audio.js (window.DogAudio).
// The kit has no "huff", so that one breathy noise burst is synthesized here.
const Sfx = (() => {
  const A = window.DogAudio;
  // track every AudioContext created (the kit's and ours) so the title's sound test can report their states
  const ALL = [];
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (Orig) {
    const Shim = function (...args) { const c = new Orig(...args); ALL.push(c); return c; };
    Shim.prototype = Orig.prototype;
    window.AudioContext = Shim;
  }
  let hctx = null, unlocked = false;
  try { A.setMuted(localStorage.getItem('missys_mute') === '1'); } catch (e) {}
  function ctx() {                 // our own context exists only after a user gesture (see unlock)
    if (!unlocked) return null;
    if (!hctx) { try { hctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (hctx.state === 'suspended') hctx.resume();
    return hctx;
  }
  function huff() {
    if (A.isMuted()) return;
    const c = ctx(); if (!c) return;
    const t = c.currentTime, len = 0.22;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(260, t + len);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(c.destination);
    src.start(t);
  }

  // ---- little NES-style animal voices (quiet; same chiptune character as the kit) ----
  const waves = {}, lastAt = {};
  function wave(c, duty) {
    if (!waves[duty]) {
      const n = 64, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = Math.sin(Math.PI * k * duty) / (Math.PI * k);
      waves[duty] = c.createPeriodicWave(re, im);
    }
    return waves[duty];
  }
  // o: {w:'pulse12'|'pulse25'|'triangle'|'square', f, f2, f3 (second glide target), at, dur, vol, vib:[hz,depth]}
  function blip(o) {
    if (A.isMuted()) return;
    const c = ctx(); if (!c) return;
    const t = c.currentTime + 0.01 + (o.at || 0), dur = o.dur, vol = o.vol == null ? 0.08 : o.vol;
    const osc = c.createOscillator(), g = c.createGain();
    if (o.w === 'pulse12') osc.setPeriodicWave(wave(c, 0.125)); else if (o.w === 'pulse25') osc.setPeriodicWave(wave(c, 0.25)); else osc.type = o.w || 'triangle';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.f3 ? dur * 0.45 : dur));
    if (o.f3) osc.frequency.exponentialRampToValueAtTime(o.f3, t + dur);
    if (o.vib) {
      const lfo = c.createOscillator(), dep = c.createGain();
      lfo.frequency.value = o.vib[0]; dep.gain.value = o.vib[1]; lfo.connect(dep).connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g); g.connect(c.destination); osc.start(t); osc.stop(t + dur + 0.05);
  }
  function hiss(at, dur, vol) {
    if (A.isMuted()) return;
    const c = ctx(); if (!c) return;
    const t = c.currentTime + 0.01 + at, n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(hp); hp.connect(g); g.connect(c.destination); src.start(t);
  }
  const arp = (notes, w, vol) => notes.forEach((f, i) => blip({ w, f, at: i * 0.075, dur: 0.09, vol }));
  const VOICES = {
    bunny_squeak() { blip({ w: 'triangle', f: 1400, f2: 2000, dur: 0.07, vol: 0.07 }); },
    bunny_boing() { blip({ w: 'triangle', f: 280, f2: 620, dur: 0.1, vol: 0.07 }); },
    cat_mew() { blip({ w: 'pulse25', f: 620, f2: 1150, f3: 700, dur: 0.34, vol: 0.07, vib: [18, 22] }); },
    cat_hiss() { hiss(0, 0.2, 0.07); },
    frog_croak() { blip({ w: 'pulse12', f: 190, f2: 80, dur: 0.07, vol: 0.09 }); blip({ w: 'pulse12', f: 160, f2: 65, at: 0.1, dur: 0.09, vol: 0.09 }); },
    frog_plip() { blip({ w: 'pulse12', f: 500, f2: 900, dur: 0.035, vol: 0.06 }); },
    flap() { [0, 0.045, 0.09].forEach(a => blip({ w: 'pulse12', f: 520, f2: 330, at: a, dur: 0.03, vol: 0.06 })); },
    squawk() { blip({ w: 'pulse25', f: 1500, f2: 800, dur: 0.12, vol: 0.07, vib: [40, 160] }); blip({ w: 'pulse25', f: 1200, f2: 600, at: 0.12, dur: 0.1, vol: 0.06, vib: [40, 130] }); },
    caught_rabbit() { arp([523, 659, 784], 'pulse25', 0.07); },
    caught_cat() { arp([587, 740, 880], 'pulse25', 0.07); },
    caught_frog() { arp([392, 494, 587], 'pulse12', 0.09); },
  };
  function voice(id) {          // rate-limited per sound so nothing stacks up
    const now = performance.now();
    if (lastAt[id] && now - lastAt[id] < 120) return;
    lastAt[id] = now; if (VOICES[id]) VOICES[id]();
  }
  return {
    voice,
    unlock() { A.unlock(); unlocked = true; ctx(); },
    states() { return { kit: ALL.filter(c => c !== hctx).map(c => c.state), mine: hctx ? [hctx.state] : [] }; },
    get muted() { return A.isMuted(); },
    toggle() {
      A.setMuted(!A.isMuted());
      try { localStorage.setItem('missys_mute', A.isMuted() ? '1' : '0'); } catch (e) {}
    },
    huff,
    sfx(id, arg) { A.sfx(id, arg); },
    shout(line, opts) { A.shout(line, opts); },
    pause() { A.pause(); if (hctx) hctx.suspend(); },
    unpause() { A.unpause(); if (hctx) hctx.resume(); },
    suspend() { A.suspend(); if (hctx) hctx.suspend(); },
    resume() { A.resume(); if (hctx) hctx.resume(); },
    music: A.music,
  };
})();
