/* dog-audio.js v1.0.0: chiptune sound kit for the dog sidescroller.
 * No dependencies. Load it with a classic script tag (no type="module") before the game code;
 * it defines window.DogAudio.
 *
 * Everything is synthesized live with the Web Audio API, so there are no
 * sound files to load. Music uses public domain melodies, arranged here:
 *   Gameplay, by level (level 6 starts over, a bit faster each level):
 *     1 Camptown Races (Stephen Foster, 1850), also the title screen
 *     2 Pop Goes the Weasel (traditional, 1850s)
 *     3 The Entertainer (Scott Joplin, 1902)
 *     4 William Tell Overture finale (Gioachino Rossini, 1829)
 *     5 In the Hall of the Mountain King (Edvard Grieg, 1875), speeds up each loop
 *   The Blue Danube (Johann Strauss II, 1866): the toilet appears
 *   Brahms' Lullaby (1868): the dog falls asleep by the toilet
 *   Home! Sweet Home! (Henry Bishop, 1823): game over
 *   Shave and a Haircut (1899): new high score jingle
 *
 * Quick use:
 *   DogAudio.unlock();                    // call on the first tap or keypress
 *   DogAudio.sfx('eat');                  // any Sound ID from the spec's table
 *   DogAudio.sfx('human_shout_2');        // shout line 2 from the spec
 *   DogAudio.shout("Don't eat that!");    // babble for ANY line, even new ones
 *   DogAudio.shout(line, { mimic: true });// the parrot's fake version
 *   DogAudio.music.playLevel(1);          // title screen and level 1; keeps playing if already on
 *   DogAudio.music.playLevel(n);          // each new level: right song, right tempo
 *   DogAudio.music.play('danube');        // toilet appears
 *   DogAudio.music.play('lullaby');       // dog lies down
 *   DogAudio.music.play('home', { delay: 1.8 }); // game over, after the 'caught' sound
 *   DogAudio.music.setDanger(true);       // human on screen: tempo eases up
 *   DogAudio.music.setDanger(false);      // human gone: tempo relaxes
 *   DogAudio.pause(); DogAudio.unpause(); // pause menu: plays the pause/resume sounds and freezes audio
 *   DogAudio.suspend(); DogAudio.resume();// freeze and unfreeze silently (tab hidden)
 *   DogAudio.setMuted(true);
 *
 * Unknown Sound IDs do nothing, so the game can call any trigger safely.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- engine
  let ctx = null, master, sfxBus, musicBus, noiseBuf;
  const waves = {};
  let muted = false;
  const MASTER_VOL = 0.6;

  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
    if (!m) throw new Error('Bad note name: ' + name);
    const semi = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const midi = (parseInt(m[3], 10) + 1) * 12 + semi;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  const semis = (f, n) => f * Math.pow(2, n / 12);
  const toFreq = (f) => (typeof f === 'string' ? noteFreq(f) : f);

  // NES-style pulse waves: 12.5% and 25% duty cycles.
  function pulseWave(duty) {
    const n = 64, real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = Math.sin(Math.PI * k * duty) / (Math.PI * k);
    return ctx.createPeriodicWave(real, imag);
  }

  function init() {
    if (ctx) return true;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOL;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.45;
    musicBus.connect(master);
    waves.pulse12 = pulseWave(0.125);
    waves.pulse25 = pulseWave(0.25);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // One synthesized note.
  // o: { wave, f, f2 (slide target), t (absolute time) or at (offset in s),
  //      dur, vol, rel, vib: [rateHz, depthHz], filter: { type, f, f2, q }, bus }
  // wave: 'pulse12' | 'pulse25' | 'square' | 'triangle' | 'sawtooth' | 'noise'
  function voice(o) {
    const t = o.t != null ? o.t : ctx.currentTime + 0.01 + (o.at || 0);
    const dur = Math.max(0.01, o.dur);
    const vol = o.vol == null ? 0.3 : o.vol;
    const atk = Math.min(0.006, dur / 4);
    const rel = Math.min(o.rel || 0.04, dur / 2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setValueAtTime(vol, t + dur - rel);
    g.gain.linearRampToValueAtTime(0, t + dur);

    let src;
    if (o.wave === 'noise') {
      src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
    } else {
      src = ctx.createOscillator();
      if (waves[o.wave]) src.setPeriodicWave(waves[o.wave]);
      else src.type = o.wave || 'square';
      src.frequency.setValueAtTime(o.f, t);
      if (o.f2) src.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
      if (o.vib) {
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = o.vib[0];
        depth.gain.value = o.vib[1];
        lfo.connect(depth).connect(src.frequency);
        lfo.start(t);
        lfo.stop(t + dur + 0.05);
      }
    }

    let node = src;
    if (o.filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = o.filter.type;
      bq.frequency.setValueAtTime(o.filter.f, t);
      if (o.filter.f2) bq.frequency.exponentialRampToValueAtTime(o.filter.f2, t + dur);
      bq.Q.value = o.filter.q || 1;
      node.connect(bq);
      node = bq;
    }
    node.connect(g).connect(o.bus || sfxBus);
    src.start(t, o.wave === 'noise' ? Math.random() * 0.5 : 0);
    src.stop(t + dur + 0.05);
  }

  // Back-to-back notes: list of [freq or note name or null (rest), seconds].
  function seq(list, base) {
    let at = base.at || 0;
    for (const [f, dur] of list) {
      if (f) voice(Object.assign({}, base, { f: toFreq(f), at, dur: dur * (base.legato || 0.9) }));
      at += dur;
    }
    return at;
  }

  function squawk(at, f, dur) {
    voice({ wave: 'sawtooth', f, f2: f * 0.8, at, dur, vol: 0.2,
      vib: [38, f * 0.22], filter: { type: 'bandpass', f: 1600, q: 1.8 } });
  }

  // ---------------------------------------------------------------- shouts
  const SHOUT_LINES = [
    'You have to come home!',
    "Don't eat that!",
    'Stop huffing at me!',
    "No, it's bedtime!",
    "Not now, I'm watching my stories!",
    'But you were just outside!',
  ];

  function syllables(word) {
    const w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    const groups = w.match(/[aeiouy]+/g);
    let n = groups ? groups.length : 1;
    if (n > 1 && /e$/.test(w) && !/le$/.test(w)) n--; // silent e: "home", "bedtime"
    return Math.max(1, n);
  }

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) { // mulberry32: same text, same tune
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Gibberish speech, one blip per syllable. The tune comes from the text,
  // so the parrot "mimics" the exact same contour, higher and squawkier.
  function babble(text, mimic, startAt) {
    const rand = rng(hash(text));
    const words = text.split(/\s+/).filter(Boolean);
    const exclaim = /!\s*$/.test(text), ask = /\?\s*$/.test(text);
    const total = words.reduce((n, w) => n + syllables(w), 0);
    const base = mimic ? 520 : 200;
    const sylDur = mimic ? 0.065 : 0.085, gap = mimic ? 0.018 : 0.025;
    const steps = [0, 2, 3, 5, 7];
    let at = startAt || 0, k = 0;
    for (const w of words) {
      const n = syllables(w);
      for (let s = 0; s < n; s++) {
        k++;
        const last = k === total;
        let semi = steps[Math.floor(rand() * steps.length)] - 2;
        let dur = sylDur * (0.8 + rand() * 0.5);
        if (last && (exclaim || ask)) { semi += exclaim ? 5 : 7; dur *= 2; }
        const f = semis(base, semi);
        const f2 = last && ask ? f * 1.25 : f * (mimic ? 0.85 : 0.9);
        if (mimic) {
          voice({ wave: 'sawtooth', f, f2, at, dur, vol: 0.22,
            vib: [34, f * 0.12], filter: { type: 'bandpass', f: 1800, q: 1.4 } });
        } else {
          voice({ wave: 'pulse25', f, f2, at, dur, vol: 0.3 });
        }
        at += dur + gap;
      }
      at += mimic ? 0.03 : 0.05;
      if (/[,;]$/.test(w)) at += 0.1;
    }
    return at;
  }

  const randomLine = () => SHOUT_LINES[Math.floor(Math.random() * SHOUT_LINES.length)];

  function shout(text, opts) {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const line = text || randomLine();
    if (opts && opts.mimic) { squawk(0, 1300, 0.1); babble(line, true, 0.14); }
    else babble(line, false, 0);
  }

  // ---------------------------------------------------------------- sound effects
  const SFX = {
    // Dog
    eat() {
      voice({ wave: 'noise', dur: 0.025, vol: 0.15, filter: { type: 'highpass', f: 2500 } });
      voice({ wave: 'pulse25', f: 520, f2: 1040, dur: 0.06, vol: 0.3 });
      voice({ wave: 'pulse25', f: 1040, at: 0.06, dur: 0.05, vol: 0.2 });
    },
    jump() { voice({ wave: 'pulse25', f: 260, f2: 640, dur: 0.16, vol: 0.28 }); },
    land() { voice({ wave: 'noise', dur: 0.05, vol: 0.25, filter: { type: 'lowpass', f: 600 } }); },
    crouch() { voice({ wave: 'triangle', f: 330, f2: 170, dur: 0.09, vol: 0.4 }); },
    food_scatter() {
      seq([[1047, 0.045], [880, 0.045], [784, 0.045], [659, 0.045], [523, 0.045], [440, 0.07]],
        { wave: 'pulse12', vol: 0.25 });
      voice({ wave: 'noise', dur: 0.3, vol: 0.08, filter: { type: 'highpass', f: 4000 } });
    },
    stun() {
      voice({ wave: 'triangle', f: 240, f2: 110, dur: 0.35, vol: 0.5, vib: [18, 25] });
      seq([[1568, 0.06], [1319, 0.06], [1568, 0.06], [1319, 0.06]], { wave: 'pulse12', vol: 0.12, at: 0.12 });
    },
    stun_end() { seq([['G4', 0.06], ['D5', 0.08]], { wave: 'pulse25', vol: 0.25 }); },
    invincible_end() { voice({ wave: 'pulse12', f: 784, dur: 0.05, vol: 0.15 }); },

    // Parrots
    parrot_enter() { squawk(0, 1150, 0.2); squawk(0.24, 1300, 0.12); },
    percher_bob() {
      voice({ wave: 'pulse12', f: 1200, dur: 0.03, vol: 0.2 });
      voice({ wave: 'pulse12', f: 1000, at: 0.12, dur: 0.03, vol: 0.2 });
    },
    thief_snatch() {
      voice({ wave: 'noise', dur: 0.12, vol: 0.2, filter: { type: 'bandpass', f: 800, f2: 4000, q: 2 } });
      voice({ wave: 'pulse25', f: 700, f2: 1400, at: 0.1, dur: 0.06, vol: 0.2 });
      squawk(0.2, 1400, 0.08);
    },
    mimic_shout(text) { shout(text, { mimic: true }); },

    // Human
    human_shout(text) { shout(text); },
    human_run() {
      for (let i = 0; i < 4; i++) {
        const at = i * 0.14;
        voice({ wave: 'triangle', f: 95, f2: 55, at, dur: 0.06, vol: 0.45 });
        voice({ wave: 'noise', at, dur: 0.04, vol: 0.15, filter: { type: 'lowpass', f: 500 } });
      }
    },
    human_turn() { voice({ wave: 'noise', dur: 0.3, vol: 0.2, filter: { type: 'bandpass', f: 2600, f2: 700, q: 3 } }); },
    human_dodge() {
      voice({ wave: 'noise', dur: 0.15, vol: 0.12, filter: { type: 'bandpass', f: 600, f2: 2400, q: 1.5 } });
      seq([['E5', 0.06], ['B5', 0.08]], { wave: 'pulse25', vol: 0.2, at: 0.1 });
    },
    caught() {
      seq([['G4', 0.28], ['F#4', 0.28], ['F4', 0.28]], { wave: 'pulse25', vol: 0.3 });
      voice({ wave: 'pulse25', f: noteFreq('E4'), at: 0.84, dur: 0.8, vol: 0.3, vib: [6, 9] });
    },

    // Frame, level, and score
    edge_push() {
      voice({ wave: 'pulse25', f: 98, dur: 0.08, vol: 0.3 });
      voice({ wave: 'pulse25', f: 98, at: 0.13, dur: 0.08, vol: 0.3 });
    },
    trapped() {
      voice({ wave: 'noise', dur: 0.15, vol: 0.35, filter: { type: 'lowpass', f: 1200 } });
      voice({ wave: 'pulse25', f: 620, f2: 70, at: 0.1, dur: 0.65, vol: 0.28 });
    },
    toilet_appears() {
      seq([['C5', 0.08], ['E5', 0.08], ['G5', 0.08]], { wave: 'pulse25', vol: 0.25 });
      voice({ wave: 'pulse25', f: noteFreq('C6'), at: 0.24, dur: 0.35, vol: 0.22 });
      voice({ wave: 'triangle', f: noteFreq('C4'), at: 0.24, dur: 0.35, vol: 0.35 });
      // a little flush
      voice({ wave: 'noise', at: 0.6, dur: 0.7, vol: 0.1, filter: { type: 'bandpass', f: 350, f2: 1500, q: 4 } });
    },
    sleep() {
      voice({ wave: 'noise', dur: 0.7, vol: 0.1, filter: { type: 'lowpass', f: 450, f2: 1000 } }); // inhale
      voice({ wave: 'triangle', f: 85, f2: 62, at: 0.8, dur: 0.6, vol: 0.3, vib: [24, 8] });   // snore
      seq([['G6', 0.12], ['A6', 0.12], ['B6', 0.12]], { wave: 'pulse12', vol: 0.07, at: 1.5, legato: 0.4 }); // zzz
    },
    bank_tick() { voice({ wave: 'pulse12', f: 1568, dur: 0.03, vol: 0.14 }); },
    level_start() { seq([['G4', 0.18], ['G4', 0.18], ['C5', 0.3]], { wave: 'pulse25', vol: 0.28, legato: 0.7 }); },
    new_high_score() { // Shave and a Haircut (1899)
      seq([['C5', 0.24], ['G4', 0.12], ['G4', 0.12], ['A4', 0.24], ['G4', 0.24], [null, 0.24], ['B4', 0.24], ['C5', 0.3]],
        { wave: 'pulse25', vol: 0.28, legato: 0.8 });
      voice({ wave: 'triangle', f: noteFreq('C3'), at: 1.68, dur: 0.3, vol: 0.4 });
    },

    // Menus
    menu_tap() { voice({ wave: 'pulse12', f: 880, dur: 0.03, vol: 0.15 }); },
    pause() { seq([['G5', 0.06], ['C5', 0.09]], { wave: 'pulse25', vol: 0.2 }); },
    resume() { seq([['C5', 0.06], ['G5', 0.09]], { wave: 'pulse25', vol: 0.2 }); },
  };

  const MIN_GAP = { eat: 0.03, bank_tick: 0.025 }; // rapid repeats overlap, but not stack up
  const lastPlay = {};

  function sfx(id, arg) {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    let fn = SFX[id];
    const m = /^human_shout_(\d+)$/.exec(id);
    if (!fn && m) {
      const line = SHOUT_LINES[parseInt(m[1], 10) - 1];
      if (line) fn = () => shout(line);
    }
    if (!fn) return; // unknown IDs do nothing
    const now = ctx.currentTime;
    if (MIN_GAP[id] && lastPlay[id] != null && now - lastPlay[id] < MIN_GAP[id]) return;
    lastPlay[id] = now;
    fn(arg);
  }

  // ---------------------------------------------------------------- music data
  // Notes: [note name or null for a rest, length in beats, optional gate 0..1].
  // A beat is a quarter note. All melodies are public domain; arrangements are original.

  // Bass helper: one entry per bar, each a list of [noteOrChord, beats] where a chord is
  // a space-separated string. Single notes go to the bass, chords to two quiet stab voices.
  function splitHands(bars, gateBass, gateStab) {
    const bass = [], hi = [], lo = [];
    for (const bar of bars) {
      for (const [tok, beats] of bar) {
        if (!tok || tok === '-') { bass.push([null, beats]); hi.push([null, beats]); lo.push([null, beats]); continue; }
        const notes = tok.split(' ');
        if (notes.length === 1) { bass.push([notes[0], beats, gateBass]); hi.push([null, beats]); lo.push([null, beats]); }
        else { bass.push([null, beats]); hi.push([notes[0], beats, gateStab]); lo.push([notes[1], beats, gateStab]); }
      }
    }
    return { bass, hi, lo };
  }
  const transpose = (notes, semitones) => notes.map(([n, b, g]) => {
    if (!n) return [n, b, g];
    const f = semis(noteFreq(n), semitones);
    return [f, b, g]; // frequencies are accepted too
  });

  // Level 1: Camptown Races, Stephen Foster (1850). G major, 2/4.
  const CAMPTOWN_MELODY = [
    ['D5', 0.5], ['D5', 0.5], ['B4', 0.5], ['D5', 0.5], ['E5', 0.5], ['D5', 0.5], ['B4', 1],
    ['B4', 0.5], ['A4', 1.5], ['B4', 0.5], ['A4', 1.5],
    ['D5', 0.5], ['D5', 0.5], ['B4', 0.5], ['D5', 0.5], ['E5', 0.5], ['D5', 0.5], ['B4', 1],
    ['A4', 0.5], ['A4', 0.25], ['A4', 0.25], ['B4', 0.5], ['A4', 0.5], ['G4', 2, 0.95],
    ['G4', 0.5], ['G4', 0.25], ['G4', 0.25], ['B4', 0.5], ['D5', 0.5], ['G5', 2, 0.95],
    ['E5', 0.5], ['E5', 0.25], ['E5', 0.25], ['G5', 0.5], ['E5', 0.5], ['D5', 2, 0.95],
    ['D5', 0.5], ['D5', 0.5], ['B4', 0.25], ['B4', 0.25], ['D5', 0.25], ['D5', 0.25], ['E5', 0.5], ['D5', 0.5], ['B4', 1],
    ['A4', 0.5], ['A4', 0.25], ['A4', 0.25], ['B4', 0.5], ['A4', 0.5], ['G4', 2, 0.95],
  ];
  const CAMPTOWN_CHORDS = 'G G D D G G D G G G C G G G D G'.split(' ');
  const CT_BASS = { G: ['G2', 'D3'], D: ['D3', 'A2'], C: ['C3', 'G2'] };
  const CT_THIRD = { G: 'B3', D: 'F#3', C: 'E3' };

  // Level 2: Pop Goes the Weasel (traditional, 1850s). D major, 6/8 (3 beats a bar).
  const WEASEL_MELODY = [
    ['D5', 1], ['D5', 0.5], ['E5', 1], ['E5', 0.5], ['F#5', 0.5], ['A5', 0.5], ['F#5', 0.5], ['D5', 1], ['A4', 0.5],
    ['D5', 1], ['D5', 0.5], ['E5', 1], ['E5', 0.5], ['F#5', 1.5], ['D5', 1], ['A4', 0.5],
    ['D5', 1], ['D5', 0.5], ['E5', 1], ['E5', 0.5], ['F#5', 0.5], ['A5', 0.5], ['F#5', 0.5], ['D5', 1.5],
    ['B5', 1.5, 0.7], ['E5', 1], ['G5', 0.5], ['F#5', 1.5], ['D5', 1.5],                       // Pop! goes the weasel
    ['D6', 1.5], ['B5', 1], ['D6', 0.5], ['C#6', 1], ['A5', 0.5], ['A5', 0.5], ['B5', 0.5], ['C#6', 0.5],
    ['D6', 1.5], ['B5', 1], ['D6', 0.5], ['C#6', 1.5], ['A5', 1.5],
    ['G5', 1], ['F#5', 0.5], ['G5', 1], ['A5', 0.5], ['B5', 1], ['C#6', 0.5], ['D6', 1.5],
    ['B5', 1.5, 0.7], ['E5', 1], ['G5', 0.5], ['F#5', 1.5], ['D5', 1.5],
  ];
  const WEASEL_CHORDS = ['D', 'D', 'D', 'D', 'D', 'D', 'GA', 'D', 'G', 'A', 'G', 'A', 'G', 'G', 'GA', 'D'];
  const WZ = { D: ['D3', 'A2', 'F#4'], G: ['G2', 'D3', 'B3'], A: ['A2', 'E3', 'C#4'] };
  function weaselBar(c) {
    if (c.length === 2) { const a = WZ[c[0]], b = WZ[c[1]]; return [[a[0], 1], [a[2], 0.5], [b[0], 1], [b[2], 0.5]]; }
    const z = WZ[c]; return [[z[0], 1], [z[2], 0.5], [z[1], 1], [z[2], 0.5]];
  }

  // Level 3: The Entertainer, Scott Joplin (1902). C major, 2/4. The A strain, from the 1902 edition.
  const ENT_A1 = [['E4', 0.25], ['C5', 0.5], ['E4', 0.25], ['C5', 0.5], ['E4', 0.25]];
  const ENT_TURN = [['E6', 0.25], ['C6', 0.25], ['D6', 0.25], ['E6', 0.5], ['B5', 0.25], ['D6', 0.5]];
  const ENT_RUN = [['E6', 0.25], ['C6', 0.25], ['D6', 0.25], ['E6', 0.5], ['C6', 0.25], ['D6', 0.25], ['C6', 0.25]];
  const ENT_MELODY = [
    ...ENT_A1, ['C5', 1.5], ['C6', 0.25], ['D6', 0.25], ['D#6', 0.25], ...ENT_TURN, ['C6', 1.5], ['D4', 0.25], ['D#4', 0.25],
    ...ENT_A1, ['C5', 1.75], ['A5', 0.25], ['G5', 0.25],
    ['F#5', 0.25], ['A5', 0.25], ['C6', 0.25], ['E6', 0.5], ['D6', 0.25], ['C6', 0.25], ['A5', 0.25], ['D6', 1.5], ['D4', 0.25], ['D#4', 0.25],
    ...ENT_A1, ['C5', 1.5], ['C6', 0.25], ['D6', 0.25], ['D#6', 0.25], ...ENT_TURN, ['C6', 1.5], ['C6', 0.25], ['D6', 0.25],
    ...ENT_RUN, ...ENT_RUN, ...ENT_TURN, ['C6', 1.5], ['D4', 0.25], ['D#4', 0.25],
  ];
  const E8 = (a, b, c, d) => [[a, 0.5], [b, 0.5], [c, 0.5], [d, 0.5]];
  const ENT_B5 = E8('C3', 'C4 G3', 'G2', 'C4 Bb3');
  const ENT_B6 = E8('F2', 'C4 A3', 'E2', 'C4 G3');
  const ENT_B7 = E8('G2', 'C4 G3', 'G2', 'B3 G3');
  const ENT_LH = [
    ENT_B5, ENT_B6, ENT_B7, E8('C3', 'C4 G3', 'C4 G3', 'B3 G3'),
    ENT_B5, E8('F2', 'C4 A3', 'E2', 'Eb2'), E8('D2', 'C4 A3', 'D3', 'C4 A3'), E8('B3 G3', 'G2', 'A2', 'B2'),
    ENT_B5, ENT_B6, ENT_B7, E8('C3', 'C4 G3', 'E4 C4', '-'),
    E8('C3', 'E4 C4', 'Bb2', 'E4 C4'), E8('A2', 'F4 C4', 'Ab2', 'F4 C4'), E8('G2', 'E4 C4', 'G2', 'B3 G3'), E8('C3', 'G2', 'A2', 'B2'),
  ];

  // Level 4: William Tell Overture, finale, Gioachino Rossini (1829). C major, 4/4.
  const WT_MELODY = [
    ['G4', 1], ['G4', 0.5], ['G4', 0.5], ['G4', 1], ['G4', 1], ['C5', 1], ['D5', 1], ['E5', 1], ['G4', 0.5], ['G4', 0.5],
    ['G4', 1], ['G4', 0.5], ['G4', 0.5], ['C5', 1], ['E5', 1], ['D5', 1], ['B4', 1], ['G4', 1], ['G4', 0.5], ['G4', 0.5],
    ['G4', 1], ['G4', 0.5], ['G4', 0.5], ['G4', 1], ['G4', 1], ['C5', 1], ['D5', 1], ['E5', 1], ['C5', 0.5], ['E5', 0.5],
    ['G5', 2.5, 0.95], ['F5', 0.5], ['E5', 0.5], ['D5', 0.5], ['C5', 1], ['E5', 1], ['C5', 1], ['G4', 0.5], ['G4', 0.5],
  ];
  const WT_CHORDS = 'C C C G C C G C'.split(' ');
  const WT = { C: ['C3', 'G2', 'G3 E3'], G: ['G2', 'D3', 'F3 B2'] };

  // Level 5: In the Hall of the Mountain King, Edvard Grieg (1875). B minor, 4/4, staccato.
  const MK_A = [
    ['B3', 0.5], ['C#4', 0.5], ['D4', 0.5], ['E4', 0.5], ['F#4', 0.5], ['D4', 0.5], ['F#4', 1],
    ['E#4', 0.5], ['C#4', 0.5], ['E#4', 1], ['E4', 0.5], ['C4', 0.5], ['E4', 1],
    ['B3', 0.5], ['C#4', 0.5], ['D4', 0.5], ['E4', 0.5], ['F#4', 0.5], ['D4', 0.5], ['F#4', 0.5], ['B4', 0.5],
    ['A4', 0.5], ['F#4', 0.5], ['D4', 0.5], ['F#4', 0.5], ['A4', 2, 0.9],
  ];
  const MK_B = [
    ['F#4', 0.5], ['G#4', 0.5], ['A#4', 0.5], ['B4', 0.5], ['C#5', 0.5], ['A#4', 0.5], ['C#5', 1],
    ['D5', 0.5], ['A#4', 0.5], ['D5', 1], ['C#5', 0.5], ['A#4', 0.5], ['C#5', 1],
    ['F#4', 0.5], ['G#4', 0.5], ['A#4', 0.5], ['B4', 0.5], ['C#5', 0.5], ['A#4', 0.5], ['C#5', 1],
    ['D5', 0.5], ['A#4', 0.5], ['D5', 1], ['C#5', 2, 0.9],
  ];
  const MK_MELODY = [...MK_A, ...transpose(MK_A, 12), ...MK_B, ...transpose(MK_B, 12)];
  const q4 = (a, b, c, d) => [[a, 1], [b, 1], [c, 1], [d, 1]];
  const MK_ABASS = [q4('B2', 'F#3', 'B2', 'F#3'), q4('B2', 'F#3', 'B2', 'F#3'), q4('B2', 'F#3', 'B2', 'F#3'), q4('D3', 'A3', 'D3', 'A3')];
  const MK_BBASS = [q4('F#3', 'C#4', 'F#3', 'C#4'), q4('D3', 'A#3', 'F#3', 'C#4'), q4('F#3', 'C#4', 'F#3', 'C#4'), q4('D3', 'A#3', 'F#3', 'C#4')];

  // Toilet appears: The Blue Danube, Johann Strauss II (1866). C major, 3/4.
  const DANUBE_MELODY = [
    ['C4', 1],
    ['C4', 1], ['E4', 1], ['G4', 1], ['G4', 2], ['G5', 1], ['G5', 2], ['E5', 1], ['E5', 2], ['C4', 1],
    ['C4', 1], ['E4', 1], ['G4', 1], ['G4', 2], ['G5', 1], ['G5', 2], ['F5', 1], ['F5', 2], ['B3', 1],
    ['B3', 1], ['D4', 1], ['A4', 1], ['A4', 2], ['A5', 1], ['A5', 2], ['F5', 1], ['F5', 2], ['B3', 1],
    ['B3', 1], ['D4', 1], ['A4', 1], ['A4', 2], ['A5', 1], ['A5', 2], ['E5', 1], ['E5', 3, 0.95],
  ];
  const waltz = (root, stab) => [[root, 1], [stab, 1], [stab, 1]];
  const DANUBE_LH = [
    [[null, 1]], [[null, 3]],
    ...Array(4).fill(waltz('C3', 'G3 E3')), ...Array(8).fill(waltz('D3', 'G3 F3')), ...Array(3).fill(waltz('C3', 'G3 E3')),
  ];

  // Dog falls asleep: Brahms' Lullaby (1868). C major, 3/4, the first phrase.
  const LULLABY_MELODY = [['E4', 0.5], ['E4', 0.5], ['G4', 1.5], ['E4', 0.5], ['E4', 1], ['G4', 3, 0.95]];

  // Game over: Home! Sweet Home!, Henry Bishop (1823). F major, 4/4, the chorus.
  const HOME_MELODY = [
    ['C5', 4, 0.95], ['Bb4', 2], ['G4', 2], ['F4', 1], [null, 1], ['G4', 1], [null, 1], ['A4', 2], [null, 1], ['C5', 1],
    ['F5', 1.5], ['E5', 0.5], ['D5', 1.5], ['C5', 0.5], ['C5', 2], ['A4', 1], ['C5', 1],
    ['Bb4', 1.5], ['A4', 0.5], ['Bb4', 1], ['G4', 1], ['F4', 3, 0.95],
  ];
  const e8 = (s) => s.split(' ').map((n) => [n === '-' ? null : n, 0.5]);
  const HOME_BASS = [
    ...e8('- C3 F3 A3 C4 A3 F3 C3'), ...e8('- Bb2 D3 G3 Bb3 G3 D3 Bb2'),
    ['C3', 1], [null, 1], ['C3', 1], [null, 1], ['F2', 2], [null, 2],
    ...e8('F2 C3 F3 C3 Bb2 F3 Bb3 F3'), ...e8('F2 C3 F3 C3 F2 C3 F3 C3'), ...e8('C3 C3 E3 C3 C3 C3 G3 C3'),
    ...e8('F3 C3 A2 C3'), ['F2', 1],
  ];

  function compileTrack(bpm, loop, parts, extra) {
    const compiled = parts.map((p) => {
      let b = 0;
      const ev = [];
      if (p.kind === 'hat') {
        for (const [on, beats] of p.pattern) { if (on) ev.push({ b }); b += beats; }
        return { kind: 'hat', vol: p.vol, ev, length: b };
      }
      for (const [n, beats, gate] of p.notes) {
        if (n) ev.push({ b, f: toFreq(n), len: beats * (gate || p.gate || 0.85) });
        b += beats;
      }
      return { kind: 'tone', wave: p.wave, vol: p.vol, ev, length: b };
    });
    return Object.assign({ bpm, loop, parts: compiled, length: Math.max(...compiled.map((c) => c.length)) }, extra || {});
  }
  const flat = (bars) => bars.flat();

  const TRACKS = (() => {
    const ctBass = CAMPTOWN_CHORDS.flatMap((c) => [[CT_BASS[c][0], 1, 0.45], [CT_BASS[c][1], 1, 0.45]]);
    const ctStab = CAMPTOWN_CHORDS.flatMap((c) => [[null, 0.5], [CT_THIRD[c], 0.5, 0.4], [null, 0.5], [CT_THIRD[c], 0.5, 0.4]]);

    const wzBars = WEASEL_CHORDS.map(weaselBar);
    const wzBass = wzBars.flatMap((bar) => [[bar[0][0], 1, 0.6], [null, 0.5], [bar[2][0], 1, 0.6], [null, 0.5]]);
    const wzStab = wzBars.flatMap((bar) => [[null, 1], [bar[1][0], 0.5, 0.4], [null, 1], [bar[3][0], 0.5, 0.4]]);

    const ent = splitHands(ENT_LH, 0.8, 0.5);

    const wtBars = WT_CHORDS.map((c) => { const z = WT[c]; return [[z[0], 1], [z[2], 1], [z[1], 1], [z[2], 1]]; });
    const wt = splitHands(wtBars, 0.5, 0.35);

    const dn = splitHands(DANUBE_LH, 0.6, 0.4);

    return {
      camptown: compileTrack(132, true, [
        { wave: 'pulse25', vol: 0.22, notes: CAMPTOWN_MELODY },
        { wave: 'triangle', vol: 0.5, notes: ctBass },
        { wave: 'pulse12', vol: 0.07, notes: ctStab },
        { kind: 'hat', vol: 0.06, pattern: CAMPTOWN_CHORDS.flatMap(() => [[0, 0.5], [1, 0.5], [0, 0.5], [1, 0.5]]) },
      ]),
      weasel: compileTrack(168, true, [
        { wave: 'pulse25', vol: 0.2, gate: 0.8, notes: WEASEL_MELODY },
        { wave: 'triangle', vol: 0.5, notes: wzBass },
        { wave: 'pulse12', vol: 0.07, notes: wzStab },
        { kind: 'hat', vol: 0.05, pattern: WEASEL_CHORDS.flatMap(() => [[0, 1], [1, 0.5], [0, 1], [1, 0.5]]) },
      ]),
      entertainer: compileTrack(100, true, [
        { wave: 'pulse25', vol: 0.2, gate: 0.8, notes: ENT_MELODY },
        { wave: 'triangle', vol: 0.5, notes: ent.bass },
        { wave: 'pulse12', vol: 0.05, notes: ent.hi },
        { wave: 'pulse12', vol: 0.05, notes: ent.lo },
      ]),
      williamtell: compileTrack(160, true, [
        { wave: 'pulse25', vol: 0.21, gate: 0.7, notes: WT_MELODY },
        { wave: 'triangle', vol: 0.5, notes: wt.bass },
        { wave: 'pulse12', vol: 0.05, notes: wt.hi },
        { wave: 'pulse12', vol: 0.05, notes: wt.lo },
        { kind: 'hat', vol: 0.06, pattern: Array(32).fill([[0, 0.5], [1, 0.5]]).flat() },
      ]),
      mountainking: compileTrack(138, true, [
        { wave: 'pulse25', vol: 0.21, gate: 0.5, notes: MK_MELODY },
        { wave: 'triangle', vol: 0.55, gate: 0.45, notes: flat([...MK_ABASS, ...MK_ABASS, ...MK_BBASS, ...MK_BBASS]) },
        { kind: 'hat', vol: 0.04, pattern: Array(64).fill([[0, 0.5], [1, 0.5]]).flat() },
      ], { loopAccel: 1.06, loopAccelMax: 1.3 }),
      danube: compileTrack(160, false, [
        { wave: 'pulse25', vol: 0.2, gate: 0.85, notes: DANUBE_MELODY },
        { wave: 'triangle', vol: 0.45, notes: dn.bass },
        { wave: 'pulse12', vol: 0.05, notes: dn.hi },
        { wave: 'pulse12', vol: 0.05, notes: dn.lo },
      ]),
      lullaby: compileTrack(92, false, [
        { wave: 'triangle', vol: 0.55, gate: 0.92, notes: LULLABY_MELODY },
        { wave: 'triangle', vol: 0.3, notes: [[null, 1], ['C3', 3, 0.95], ['C3', 3, 0.95]] },
      ]),
      home: compileTrack(100, false, [
        { wave: 'pulse25', vol: 0.2, gate: 0.92, notes: HOME_MELODY },
        { wave: 'triangle', vol: 0.45, notes: HOME_BASS },
      ]),
    };
  })();

  // Gameplay songs by level; level 6 starts the rotation over (a bit faster each level).
  const GAMEPLAY = ['camptown', 'weasel', 'entertainer', 'williamtell', 'mountainking'];
  const TITLES = {
    camptown: 'Camptown Races', weasel: 'Pop Goes the Weasel', entertainer: 'The Entertainer',
    williamtell: 'William Tell Overture', mountainking: 'In the Hall of the Mountain King',
    danube: 'The Blue Danube', lullaby: "Brahms' Lullaby", home: 'Home! Sweet Home!',
  };

  // ---------------------------------------------------------------- music player
  const music = (() => {
    const LOOKAHEAD = 0.12, TICK_MS = 25;
    let cur = null, timer = null, lastTick = 0;
    let danger = false, dangerMul = 1.5, dangerPitch = 0, levelMul = 1, mul = 1;

    const tempoNow = () => mul * levelMul * (cur ? cur.loopMul : 1);
    const spb = () => 60 / (cur.track.bpm * tempoNow());
    const beatAt = (t) => cur.anchorBeat + (t - cur.anchorTime) / spb();
    const timeAt = (b) => cur.anchorTime + (b - cur.anchorBeat) * spb();
    // Call before any tempo change so the beat position stays continuous.
    function reanchor(now) { cur.anchorBeat = beatAt(now); cur.anchorTime = now; }

    function playEvent(part, e, t) {
      if (part.kind === 'hat') {
        voice({ t, wave: 'noise', dur: 0.03, vol: part.vol, filter: { type: 'highpass', f: 7000 }, bus: cur.gain });
        return;
      }
      const f = danger && dangerPitch ? semis(e.f, dangerPitch) : e.f;
      voice({ t, wave: part.wave, f, dur: Math.max(0.03, e.len * spb()), vol: part.vol, rel: 0.03, bus: cur.gain });
    }

    function tick() {
      if (!cur) return;
      const now = ctx.currentTime;
      const dt = Math.min(0.1, Math.max(0, now - lastTick));
      lastTick = now;

      // Ease the tempo toward its target: fast when a human shows up, slower to relax.
      const target = danger ? dangerMul : 1;
      if (mul !== target) {
        reanchor(now);
        const rate = target > mul ? 5 : 1.5;
        const next = mul + (target - mul) * Math.min(1, dt * rate);
        mul = Math.abs(target - next) < 0.005 ? target : next;
      }

      // Some songs speed up a little every time they loop (Mountain King).
      if (cur.track.loop && cur.track.loopAccel) {
        const loops = Math.floor(Math.max(0, beatAt(now)) / cur.track.length);
        const want = Math.min(cur.track.loopAccelMax || 2, Math.pow(cur.track.loopAccel, loops));
        if (want !== cur.loopMul) { reanchor(now); cur.loopMul = want; }
      }

      const horizon = beatAt(now + LOOKAHEAD);
      for (const p of cur.parts) {
        while (!p.done) {
          if (p.idx >= p.part.ev.length) {
            if (cur.track.loop) { p.idx = 0; p.offset += cur.track.length; }
            else { p.done = true; break; }
          }
          const e = p.part.ev[p.idx];
          const b = e.b + p.offset;
          if (b >= horizon) break;
          const t = timeAt(b);
          if (t >= now - 0.05) playEvent(p.part, e, Math.max(t, now)); // skip notes we fell behind on
          p.idx++;
        }
      }

      if (!cur.track.loop && cur.parts.every((p) => p.done) && now >= timeAt(cur.track.length)) {
        const cb = cur.onEnd;
        stop();
        if (cb) cb();
      }
    }

    function play(name, opts) {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      const track = TRACKS[name];
      if (!track) return;
      stop();
      danger = false; // a new song never starts mid-chase
      mul = 1;
      const gain = ctx.createGain();
      gain.connect(musicBus);
      cur = {
        name, track, gain,
        parts: track.parts.map((part) => ({ part, idx: 0, offset: 0, done: part.ev.length === 0 })),
        anchorTime: ctx.currentTime + 0.05 + ((opts && opts.delay) || 0), anchorBeat: 0, loopMul: 1,
        onEnd: opts && opts.onEnd,
      };
      lastTick = ctx.currentTime;
      tick();
      timer = setInterval(tick, TICK_MS);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      if (cur) {
        const g = cur.gain, t = ctx.currentTime;
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.05);
        setTimeout(() => g.disconnect(), 300);
      }
      cur = null;
    }

    const trackForLevel = (n) => GAMEPLAY[(Math.max(1, n | 0) - 1) % GAMEPLAY.length];
    function setLevel(n) {
      const next = Math.min(1.3, 1 + 0.03 * (Math.max(1, n) - 1));
      if (cur && ctx) reanchor(ctx.currentTime);
      levelMul = next;
    }

    return {
      play,
      stop,
      playLevel(n, opts) {
        setLevel(n);
        const name = trackForLevel(n);
        if (!cur || cur.name !== name) play(name, opts);
      },
      trackForLevel,
      title: (name) => TITLES[name] || name,
      gameplay: () => GAMEPLAY.slice(),
      isPlaying: () => !!cur,
      current: () => (cur ? cur.name : null),
      tracks: () => Object.keys(TRACKS),
      setDanger(on) { danger = !!on; },
      isDanger: () => danger,
      setDangerTempo(x) { dangerMul = Math.max(1, x); },
      setDangerPitch(semitones) { dangerPitch = semitones | 0; },
      setLevel,
      getTempo: () => tempoNow(),
    };
  })();

  // ---------------------------------------------------------------- public API
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    const b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource(); // iOS nudge
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);
  }

  function setMuted(on) {
    muted = !!on;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, 0.01);
  }

  let pauseTimer = null;
  function pause() {
    if (!ctx) return;
    clearTimeout(pauseTimer);
    sfx('pause');
    pauseTimer = setTimeout(() => ctx.suspend(), 200); // let the pause sound play first
  }
  function unpause() {
    if (!ctx) return;
    clearTimeout(pauseTimer);
    ctx.resume().then(() => sfx('resume'));
  }

  global.DogAudio = {
    version: '1.0.0',
    unlock,
    pause,
    unpause,
    sfx,
    shout,
    music,
    setMuted,
    isMuted: () => muted,
    suspend: () => ctx && ctx.suspend(),
    resume: () => ctx && ctx.resume(),
    SHOUT_LINES,
    SFX_IDS: Object.keys(SFX).filter((k) => k !== 'human_shout').concat(SHOUT_LINES.map((_, i) => 'human_shout_' + (i + 1))),
  };
})(typeof window !== 'undefined' ? window : globalThis);
