// Tiny synthesized sound effects (WebAudio, no files).
const Sfx = (() => {
  let ctx = null, muted = false;
  try { muted = localStorage.getItem('missys_mute') === '1'; } catch (e) {}
  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // one blip: frequency sweep f0 -> f1 over dur seconds
  function tone(f0, f1, dur, type = 'square', vol = 0.12, delay = 0) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(len, freq, q, vol) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t);
  }
  // short, low, breathy "huff": band-passed noise burst with a quick attack/decay
  function huff() {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime, len = 0.22;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(260, t + len);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(c.destination);
    src.start(t);
    tone(150, 90, 0.12, 'triangle', 0.08);   // faint low chest thump under the breath
  }
  return {
    unlock: ensure,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('missys_mute', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
    jump() { tone(280, 620, 0.14, 'square', 0.08); },
    land() { tone(120, 60, 0.07, 'triangle', 0.1); },
    bark() { huff(); },
    crunch() { noise(0.07, 2600, 5, 0.3); tone(520 + Math.random() * 120, 330, 0.06, 'square', 0.05); },
    crunch5() { noise(0.09, 2200, 4, 0.3); [660, 880, 1175].forEach((f, i) => tone(f, f * 1.02, 0.09, 'square', 0.07, i * 0.06)); },
    squawk() { tone(900, 1500, 0.08, 'sawtooth', 0.12); tone(1400, 600, 0.18, 'sawtooth', 0.12, 0.08); tone(1100, 500, 0.12, 'square', 0.06, 0.2); },
    dizzy() { for (let i = 0; i < 6; i++) tone(500 + (i % 2) * 220, 380 + (i % 2) * 150, 0.12, 'triangle', 0.1, i * 0.12); },
    alert() { tone(600, 600, 0.08, 'square', 0.07); tone(800, 800, 0.1, 'square', 0.07, 0.1); },
    start() { [392, 523, 659].forEach((f, i) => tone(f, f, 0.1, 'square', 0.07, i * 0.08)); },
    over() { [392, 330, 262].forEach((f, i) => tone(f, f * 0.98, 0.2, 'triangle', 0.1, i * 0.18)); },
    flap() { tone(500, 900, 0.05, 'triangle', 0.05); },
  };
})();
