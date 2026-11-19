  // ---------- music: original synthwave, produced live, one song per level ----------
  // Each song picks a kit, bass, arpeggio, lead and pad sound so the mood fits its level:
  // cruising outrun, light airy clouds, chiptune arcade, warm sunset, industrial, tribal,
  // hard rave, frantic breakbeat. Runs follow one fast arc: 2 bars of intro, 4 bars of build,
  // then the drop, a second peak, a short breakdown, and back up again.
  const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], hminor: [0, 2, 3, 5, 7, 8, 11] };
  const CH = {
    i: [0, 3, 7], i7: [0, 3, 7, 10], i9: [0, 3, 7, 10, 14], bII: [1, 5, 8], bVI: [-4, 0, 3], bVI7: [-4, 0, 3, 7], bIII7: [3, 7, 10, 14],
    iv: [5, 8, 12], v: [7, 10, 14], V: [7, 11, 14], bVII: [-2, 2, 5], bVII9: [-2, 2, 5, 9], dim: [2, 5, 8], bV: [6, 10, 13],
    I: [0, 4, 7], I9: [0, 4, 7, 14], IV: [5, 9, 12], IV7: [5, 9, 12, 15], vi7: [-3, 0, 4, 7], Vlow: [-5, -1, 2, 7], IVlow: [-7, -3, 0, 4]
  };
  const BASSP = {   // 1 root, 2 octave up
    roll:   [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
    off8:   [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    gallop: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 2, 1],
    drive:  [1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2],
    pulse:  [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    octave: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 2, 1, 2],
    half:   [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    heavy:  [0, 1, 1, 2, 0, 1, 2, 1, 0, 1, 1, 2, 0, 2, 1, 1]
  };
  const CHOP = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];   // trance-gate rhythm for the heavy tracks
  const ARP = { up: [0, 1, 2, 3, 4, 5, 6, 7], updown: [0, 1, 2, 3, 4, 3, 2, 1], pedal: [5, 0, 5, 1, 5, 2, 5, 1], wide: [0, 2, 4, 6, 1, 3, 5, 7] };
  const STABS = [[2, 6, 10, 14], [0, 3, 6, 10, 12], [3, 6, 11, 14], [0, 3, 6, 8, 11, 14]];
  const SONGS = {
    menu:  { bpm: 96,  root: 45, scale: 'minor',    prog: [CH.i9, CH.bVI7, CH.bIII7, CH.bVII9], kit: 'half',       bass: 'pulse',  bassTone: 'sub',   arp: 'updown', arpTone: 'pluck',  arpRate: 8,  acid: false, stabs: -1, lead: 'saw',    leadIn: 'peak2', pad: 'saw',   bright: 0.7,  dark: true,  swing: 0.06, seed: 3 },
    // heavy: Endless and Chaos
    drive: { bpm: 134, root: 40, scale: 'phrygian', prog: [CH.i, CH.bII, CH.i, CH.bVII],      kit: 'heavy',      bass: 'heavy',  bassTone: 'heavy', arp: null,                                acid: true,  stabs: 3,  lead: 'saw',    leadIn: 'peak2', pad: 'saw',   bright: 0.6,  dark: true,  swing: 0,    seed: 7,  heavy: true, chop: true },
    chaos: { bpm: 142, root: 41, scale: 'phrygian', prog: [CH.i, CH.bII, CH.bVI, CH.v],       kit: 'heavy',      bass: 'heavy',  bassTone: 'heavy', arp: 'pedal',  arpTone: 'square', arpRate: 16, acid: true,  stabs: 2,  lead: 'scream', leadIn: 'all',   pad: 'saw',   bright: 0.6,  dark: true,  swing: 0,    seed: 11, heavy: true, chop: true },
    // 1 night city: cruising outrun, nostalgic
    l1: { bpm: 102, root: 45, scale: 'minor',    prog: [CH.i9, CH.bVI7, CH.bIII7, CH.bVII9], kit: 'four',       bass: 'drive',  bassTone: 'saw',   arp: 'updown', arpTone: 'square', arpRate: 16, acid: false, stabs: -1, lead: 'saw',    leadIn: 'all',   pad: 'saw',   bright: 0.9,  dark: false, swing: 0.05, seed: 21 },
    // 2 clouds: light, bright, floaty
    l2: { bpm: 94,  root: 50, scale: 'major',    prog: [CH.I9, CH.Vlow, CH.vi7, CH.IVlow],   kit: 'half',       bass: 'half',   bassTone: 'sub',   arp: 'wide',   arpTone: 'bell',   arpRate: 8,  acid: false, stabs: -1, lead: 'bell',   leadIn: 'all',   pad: 'glass', bright: 1.2,  dark: false, swing: 0.1,  seed: 22 },
    // 3 arcade: bouncy chiptune
    l3: { bpm: 128, root: 48, scale: 'mixo',     prog: [CH.I, CH.bVII, CH.IV, CH.I],         kit: 'chip',       bass: 'octave', bassTone: 'chip',  arp: 'up',     arpTone: 'chip',   arpRate: 16, acid: false, stabs: -1, lead: 'chip',   leadIn: 'all',   pad: 'saw',   bright: 0.8,  dark: false, swing: 0,    seed: 23 },
    // 4 sunset: warm, bittersweet
    l4: { bpm: 88,  root: 43, scale: 'dorian',   prog: [CH.i7, CH.IV7, CH.i7, CH.bVII9],     kit: 'half',       bass: 'pulse',  bassTone: 'saw',   arp: 'updown', arpTone: 'pluck',  arpRate: 8,  acid: false, stabs: -1, lead: 'sing',   leadIn: 'all',   pad: 'saw',   bright: 1.0,  dark: false, swing: 0.12, seed: 24 },
    // 5 foundry: hard, mechanical
    l5: { bpm: 134, root: 37, scale: 'phrygian', prog: [CH.i, CH.bII, CH.i, CH.dim],         kit: 'heavy',      bass: 'heavy',  bassTone: 'heavy', arp: null,                                acid: true,  stabs: 1,  lead: 'saw',    leadIn: 'peak2', pad: 'saw',   bright: 0.5,  dark: true,  swing: 0,    seed: 25, heavy: true, chop: true, metal: true },
    // 6 canyon: tense, tribal, cinematic
    l6: { bpm: 132, root: 39, scale: 'hminor',   prog: [CH.i, CH.bVI, CH.bII, CH.V],         kit: 'toms',       bass: 'heavy',  bassTone: 'heavy', arp: 'pedal',  arpTone: 'pluck',  arpRate: 16, acid: false, stabs: 3,  lead: 'saw',    leadIn: 'all',   pad: 'saw',   bright: 0.7,  dark: true,  swing: 0,    seed: 26, heavy: true },
    // 7 laser arcade: hard rave
    l7: { bpm: 136, root: 41, scale: 'phrygian', prog: [CH.i, CH.i, CH.bII, CH.bVII],        kit: 'heavy',      bass: 'heavy',  bassTone: 'heavy', arp: 'up',     arpTone: 'square', arpRate: 16, acid: true,  stabs: 3,  lead: 'saw',    leadIn: 'peak2', pad: 'saw',   bright: 0.6,  dark: true,  swing: 0,    seed: 27, heavy: true, chop: true },
    // 8 meltdown: frantic, everything at once
    l8: { bpm: 144, root: 38, scale: 'phrygian', prog: [CH.i, CH.bII, CH.bV, CH.v],          kit: 'break',      bass: 'heavy',  bassTone: 'heavy', arp: 'wide',   arpTone: 'square', arpRate: 16, acid: true,  stabs: 1,  lead: 'scream', leadIn: 'all',   pad: 'saw',   bright: 0.7,  dark: true,  swing: 0,    seed: 28, heavy: true, chop: true }
  };
  // sections and their length in bars, by intensity
  const ARCS = {
    0: [['intro', 8], ['break', 8]],
    1: [['intro', 8]],
    2: [['intro', 2], ['build', 4], ['peak', 8], ['peak2', 8], ['break', 4], ['build', 4], ['peak', 8], ['peak2', 8]]
  };

  const Sound = (() => {
    let ctx = null, master, music, lp, duck, chorusIn, verbSend, gateSend, gateGain, delaySend, delayNode, sfxBus, hissGain, noise, drive, kickBus, pulseWave, heavyKickBus, heavyDrive;
    let song = null, songKey = '', intensity = 0, step = 0, bar0 = 0, nextT = 0, t0 = 0, acid = [], melody = [], lastBlip = 0, acidPrev = 0, leadPrev = 0;
    const VOL = { off: 0, low: 0.3, mid: 0.6, high: 1 };
    let vol = 0.6;
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

    const biquad = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const shaper = k => {
      const w = ctx.createWaveShaper(), c = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 1023 * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
      w.curve = c; w.oversample = '2x'; return w;
    };
    function lfo(freq, depth, param) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(param); o.start(); return o;
    }
    function impulse(sec, decay, bright) {
      const len = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c); let lpv = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lpv += (w - lpv) * bright; d[i] = lpv * Math.pow(1 - i / len, decay); }
      }
      return b;
    }

    function ensure() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch (e) { return false; }
      master = ctx.createGain(); master.gain.value = vol;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.18;
      master.connect(comp); comp.connect(ctx.destination);
      music = ctx.createGain(); music.gain.value = 0.48;
      const wow = ctx.createDelay(0.05); wow.delayTime.value = 0.01;
      lfo(0.33, 0.0007, wow.delayTime); lfo(5.7, 0.00004, wow.delayTime);
      const sat = shaper(1.8), tapeLp = biquad('lowpass', 7600, 0.5), hp = biquad('highpass', 28);
      lp = biquad('lowpass', 18000);
      music.connect(wow); wow.connect(sat); sat.connect(tapeLp); tapeLp.connect(hp); hp.connect(lp); lp.connect(master);
      duck = ctx.createGain(); duck.connect(music);
      chorusIn = ctx.createGain(); chorusIn.connect(duck);
      [[0.011, 0.21, -0.75], [0.017, 0.29, 0.75]].forEach(([base, rate, pan]) => {
        const d = ctx.createDelay(0.05); d.delayTime.value = base;
        lfo(rate, 0.003, d.delayTime);
        chorusIn.connect(d);
        if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; d.connect(p); p.connect(duck); } else d.connect(duck);
      });
      drive = ctx.createGain(); const dsh = shaper(3.5), dlp = biquad('lowpass', 4200);
      drive.connect(dsh); dsh.connect(dlp); dlp.connect(duck);
      kickBus = ctx.createGain(); const ksh = shaper(3); kickBus.connect(ksh); ksh.connect(music);
      // heavy tracks: a harder-driven kick and a filthier bass
      heavyKickBus = ctx.createGain(); const hks = shaper(6), hkl = biquad('lowpass', 7000); heavyKickBus.connect(hks); hks.connect(hkl); hkl.connect(music);
      heavyDrive = ctx.createGain(); const hds = shaper(6), hdl = biquad('lowpass', 3800, 1.2); heavyDrive.connect(hds); hds.connect(hdl); hdl.connect(duck);
      const hall = ctx.createConvolver(); hall.buffer = impulse(3.6, 2.2, 0.3);
      verbSend = ctx.createGain(); verbSend.gain.value = 0.4; verbSend.connect(hall); hall.connect(music);
      const room = ctx.createConvolver(); room.buffer = impulse(1.3, 1.1, 0.7);
      gateSend = ctx.createGain(); gateGain = ctx.createGain(); gateGain.gain.value = 0;
      gateSend.connect(room); room.connect(gateGain); gateGain.connect(music);
      delayNode = ctx.createDelay(2);
      const fb = ctx.createGain(); fb.gain.value = 0.42;
      const elp = biquad('lowpass', 2600), ehp = biquad('highpass', 350);
      delaySend = ctx.createGain(); delaySend.gain.value = 0.28;
      delaySend.connect(delayNode); delayNode.connect(elp); elp.connect(ehp); ehp.connect(fb); fb.connect(delayNode); ehp.connect(music);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const hs = ctx.createBufferSource(); hs.buffer = noise; hs.loop = true;
      const hf = biquad('bandpass', 6000, 0.4); hissGain = ctx.createGain(); hissGain.gain.value = 0;
      hs.connect(hf); hf.connect(hissGain); hissGain.connect(lp); hs.start();
      // 25% pulse wave for chiptune parts
      const N = 32, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
      pulseWave = ctx.createPeriodicWave(re, im);
      setInterval(tick, 25);
      return true;
    }

    function voice(type, freq, t, dur, gain, dests, o = {}) {
      const { detune = 0, attack = 0.005, release = 0.06, cutoff = 0, cutEnd = 0, cutAttack = 0, q = 1, glideFrom = 0, glide = 0.06, vib = 0, vibRate = 5 } = o;
      const osc = ctx.createOscillator();
      if (type === 'pulse') osc.setPeriodicWave(pulseWave); else osc.type = type;
      osc.detune.value = detune;
      if (glideFrom) { osc.frequency.setValueAtTime(glideFrom, t); osc.frequency.exponentialRampToValueAtTime(freq, t + glide); }
      else osc.frequency.setValueAtTime(freq, t);
      if (vib) {
        const v = ctx.createOscillator(), vg = ctx.createGain();
        v.frequency.value = vibRate; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(vib, t + Math.min(dur, 0.45));
        v.connect(vg); vg.connect(osc.detune); v.start(t); v.stop(t + dur + 0.1);
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain, t + attack);
      g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (cutoff) {
        const f = biquad('lowpass', cutoff, q);
        if (cutAttack) { f.frequency.setValueAtTime(cutoff, t); f.frequency.linearRampToValueAtTime(cutEnd, t + cutAttack); }
        else if (cutEnd) { f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(cutEnd, t + Math.max(0.05, dur)); }
        osc.connect(f); node = f;
      }
      node.connect(g);
      [].concat(dests).forEach(d => g.connect(d));
      osc.start(t); osc.stop(t + dur + 0.05);
      return osc;
    }
    function hit(t, dur, gain, type, freq, dests, q = 0.7) {
      const src = ctx.createBufferSource(); src.buffer = noise;
      const f = biquad(type, freq, q), g = ctx.createGain();
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); [].concat(dests).forEach(d => g.connect(d));
      src.start(t, Math.random() * 1.2); src.stop(t + dur + 0.02);
    }
    function gate(t, hold) {
      gateGain.gain.cancelScheduledValues(t);
      gateGain.gain.setValueAtTime(0.9, t); gateGain.gain.setValueAtTime(0.9, t + hold); gateGain.gain.linearRampToValueAtTime(0, t + hold + 0.08);
    }

    // ----- instruments -----
    function pad(t, notes, dur, bright, tone) {
      notes.forEach(n => {
        const f = mtof(n);
        if (tone === 'glass') {          // airy, shimmering
          [-6, 6].forEach(dt => voice('triangle', f, t, dur, 0.03, [chorusIn, verbSend], { detune: dt, attack: 1, release: 1.2 }));
          voice('sine', f * 2, t, dur, 0.012, [chorusIn, verbSend, delaySend], { attack: 1.4, release: 1.2, vib: 8, vibRate: 0.6 });
        } else {
          [-13, 13].forEach(dt => voice('sawtooth', f, t, dur, 0.015, [chorusIn, verbSend], { detune: dt, attack: 1, release: 1.2, cutoff: 240, cutEnd: 300 + 1500 * bright, cutAttack: dur * 0.5, q: 2 }));
          voice('square', f / 2, t, dur, 0.007, chorusIn, { attack: 1, release: 1, cutoff: 420 });
        }
      });
    }
    function bass(t, f, dur, cut, acc) {
      const tone = song.bassTone;
      if (tone === 'sub') { voice('sine', f, t, dur, 0.2, music, { attack: 0.02, release: 0.1 }); voice('triangle', f * 2, t, dur, 0.04, music, { attack: 0.02 }); return; }
      if (tone === 'chip') { voice('pulse', f * 2, t, dur * 0.8, 0.07, music, { cutoff: 2400 }); voice('triangle', f, t, dur, 0.14, music); return; }
      if (tone === 'heavy') {
        [-10, 10].forEach(dt => voice('sawtooth', f, t, dur, 0.09 * acc, heavyDrive, { detune: dt, cutoff: cut * 1.3 * acc, cutEnd: 120, q: 5 }));
        voice('square', f / 2, t, dur, 0.05, heavyDrive, { cutoff: 400 });
        voice('sine', f, t, dur, 0.18, music); return;
      }
      if (tone === 'reese') {
        [-16, 16].forEach(dt => voice('sawtooth', f, t, dur, 0.08 * acc, drive, { detune: dt, cutoff: cut * 0.8, cutEnd: 160, q: 3 }));
        voice('sine', f, t, dur, 0.17, music); return;
      }
      const dest = tone === 'dist' ? drive : music;
      voice('sawtooth', f, t, dur, (tone === 'dist' ? 0.12 : 0.09) * acc, dest, { cutoff: cut * acc, cutEnd: 90, q: tone === 'dist' ? 7 : 4 });
      voice('sine', f, t, dur, 0.16, music);
    }
    function arpNote(t, f, dur, cut) {
      const tone = song.arpTone;
      if (tone === 'bell') bell(t, f * 2, dur * 3, 0.04, [duck, delaySend, verbSend]);
      else if (tone === 'chip') voice('pulse', f * 2, t, dur * 0.7, 0.035, [duck, delaySend], { cutoff: 5000 });
      else if (tone === 'pluck') voice('sawtooth', f, t, dur * 1.6, 0.05, [duck, delaySend, verbSend], { cutoff: Math.min(5000, cut * 1.2), cutEnd: 220, q: 3, release: dur * 1.4 });
      else {
        voice('square', f, t, dur, 0.03, [duck, delaySend], { cutoff: cut, cutEnd: Math.max(220, cut * 0.35), q: 7 });
        voice('sawtooth', f, t, dur, 0.02, [duck, delaySend], { detune: 7, cutoff: cut, cutEnd: Math.max(220, cut * 0.35), q: 7 });
      }
    }
    function bell(t, f, dur, gain, dests) {
      voice('sine', f, t, dur, gain, dests, { attack: 0.003, release: dur * 0.95 });
      voice('sine', f * 2.76, t, dur * 0.5, gain * 0.35, dests, { attack: 0.002, release: dur * 0.48 });
      voice('sine', f * 5.4, t, dur * 0.2, gain * 0.15, dests, { attack: 0.001, release: dur * 0.19 });
    }
    function acidNote(t, f, dur, cut, acc, slide, level) {
      const from = slide && acidPrev ? acidPrev : 0;
      voice(song.seed % 2 ? 'square' : 'sawtooth', f, t, dur, (acc ? 0.07 : 0.045) * level, [drive, delaySend], { cutoff: cut * (acc ? 2 : 1.1), cutEnd: Math.max(150, cut * 0.22), q: 17, glideFrom: from, glide: 0.07 });
      acidPrev = f;
    }
    function stab(t, notes, dur) {
      notes.forEach(n => [-24, -10, 0, 10, 24].forEach(dt => voice('sawtooth', mtof(n), t, dur, 0.009, [chorusIn, verbSend, delaySend], { detune: dt, attack: 0.003, release: dur * 0.75, cutoff: 3800, cutEnd: 700, q: 1.2 })));
    }
    function lead(t, f, dur) {
      const tone = song.lead, from = leadPrev && leadPrev !== f ? leadPrev : 0;
      if (tone === 'bell') bell(t, f, Math.max(dur, 0.8), 0.06, [chorusIn, delaySend, verbSend]);
      else if (tone === 'chip') voice('pulse', f, t, dur, 0.045, [music, delaySend], { glideFrom: from, glide: 0.04, vib: 25, vibRate: 7 });
      else if (tone === 'sing') {
        voice('triangle', f, t, dur, 0.07, [chorusIn, delaySend, verbSend], { attack: 0.12, release: 0.5, glideFrom: from, glide: 0.12, vib: 22 });
        voice('sine', f * 2, t, dur, 0.018, [chorusIn, verbSend], { attack: 0.2, release: 0.5, vib: 22 });
      } else if (tone === 'scream') {
        [-18, 0, 18].forEach(dt => voice('sawtooth', f, t, dur, 0.03, [drive, delaySend, verbSend], { detune: dt, attack: 0.02, release: 0.2, cutoff: 3000, q: 2, glideFrom: from, glide: 0.05, vib: 30, vibRate: 6 }));
      } else {
        [-9, 9].forEach(dt => voice('sawtooth', f, t, dur, 0.026, [chorusIn, delaySend, verbSend], { detune: dt, attack: 0.06, release: 0.35, cutoff: 1900, q: 2, glideFrom: from, glide: 0.09, vib: 20 }));
        voice('square', f / 2, t, dur, 0.012, [chorusIn, verbSend], { attack: 0.06, release: 0.35, cutoff: 900 });
      }
      leadPrev = f;
    }
    function plainKick(t, gain, hard) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(hard ? 150 : 160, t); o.frequency.exponentialRampToValueAtTime(hard ? 40 : 52, t + (hard ? 0.12 : 0.08));
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (hard ? 0.55 : 0.32));
      o.connect(g); g.connect(hard ? kickBus : music); o.start(t); o.stop(t + 0.6);
      hit(t, 0.012, 0.3 * gain, 'highpass', 2200, hard ? kickBus : music);
      duck.gain.cancelScheduledValues(t);
      duck.gain.setValueAtTime(hard ? 0.2 : 0.5, t); duck.gain.linearRampToValueAtTime(1, t + 0.3);
    }
    // layered heavy kick: distorted punch, clean sub boom, click; pumps everything hard
    function heavyKick(t, gain) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.085);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g); g.connect(heavyKickBus); o.start(t); o.stop(t + 0.4);
      const sub = ctx.createOscillator(), sg = ctx.createGain();
      sub.frequency.setValueAtTime(62, t); sub.frequency.exponentialRampToValueAtTime(40, t + 0.3);
      sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.55 * gain, t + 0.01); sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      sub.connect(sg); sg.connect(music); sub.start(t); sub.stop(t + 0.52);
      hit(t, 0.012, 0.45 * gain, 'highpass', 3000, music);
      duck.gain.cancelScheduledValues(t);
      duck.gain.setValueAtTime(0.1, t); duck.gain.linearRampToValueAtTime(1, t + 0.34);
    }
    function chop(t, notes, dur) {     // trance-gated chord slice
      notes.forEach(n => [-14, 0, 14].forEach(dt => voice('sawtooth', mtof(n), t, dur, 0.007, [chorusIn, delaySend], { detune: dt, attack: 0.002, release: dur * 0.5, cutoff: 3000, cutEnd: 1200 })));
    }
    function clap(t, gain) {
      [0, 0.011, 0.023].forEach(o => hit(t + o, 0.03, gain, 'bandpass', 1250, [music, gateSend], 1.4));
      hit(t + 0.03, 0.3, gain * 0.55, 'bandpass', 1150, [music, verbSend, gateSend]);
      gate(t, 0.24);
    }
    function snare(t, gain, big) {
      hit(t, big ? 0.3 : 0.2, gain, 'bandpass', 1800, big ? [music, gateSend, verbSend] : [music, gateSend]);
      const o = voice('triangle', 190, t, 0.1, gain * 0.5, music); o.frequency.exponentialRampToValueAtTime(150, t + 0.09);
      gate(t, big ? 0.26 : 0.16);
    }
    function chipSnare(t, gain) { hit(t, 0.09, gain, 'highpass', 1500, music); }
    function hat(t, open, gain) { hit(t, open ? 0.2 : 0.035, gain, 'highpass', open ? 7000 : 9500, music); }
    function shaker(t, gain) { hit(t, 0.05, gain, 'bandpass', 7500, music, 1.5); }
    function ride(t) { hit(t, 0.4, 0.022, 'highpass', 5500, [music, verbSend]); }
    function crash(t, gain = 0.16) { hit(t, 1.9, gain, 'highpass', 3200, [music, verbSend]); }
    function metal(t, f) {     // a clank: ringing square pair through a band-pass
      [1, 1.47].forEach(m => voice('square', f * m, t, 0.12, 0.025, [music, verbSend], { cutoff: 4000, cutEnd: 900, q: 8 }));
      hit(t, 0.06, 0.12, 'bandpass', 3200, music, 4);
    }
    function tom(t, f, gain = 0.4) { const o = voice('sine', f, t, 0.32, gain, [music, gateSend]); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.3); }
    function riser(t, dur) {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const f = biquad('bandpass', 300, 2.5), g = ctx.createGain();
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13, t + dur * 0.97); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(music); g.connect(verbSend);
      src.start(t); src.stop(t + dur + 0.05);
    }

    // drums by kit: `full` = peak sections; the build brings the kit in gradually
    function drums(kit, s16, t, sec, sb, len, p) {
      const full = sec === 'peak' || sec === 'peak2', p2 = sec === 'peak2', build = sec === 'build', last = sb === len - 1;
      const kick = (tt, g, hard) => song.heavy ? heavyKick(tt, g) : plainKick(tt, g, hard);
      if (kit === 'heavy') {
        // four-on-the-floor, doubling to 8ths then rolling into 16ths before the drop
        const roll = build && (sb >= len - 2 ? s16 % 2 === 0 : false) || (build && last && s16 >= 8);
        if (s16 % 4 === 0 || roll) kick(t, full ? 1.2 : 0.55 + 0.5 * p);
        if ((full || p > 0.4) && (s16 === 4 || s16 === 12)) { clap(t, 0.8); snare(t, 0.35, false); }
        if (full && (s16 === 7 || s16 === 10 || s16 === 15)) snare(t, 0.12, false);
        if (full) {
          hat(t, s16 % 4 === 2, s16 % 4 === 2 ? 0.1 : s16 % 2 ? 0.045 : 0.07);
          if ((p2 || sb >= 4) && s16 % 2 === 0) ride(t);
          if (sb % 2 === 1 && s16 >= 13) tom(t, [190, 155, 120][s16 - 13], 0.5);
          if (song.metal && [3, 7, 10, 15].includes(s16)) metal(t, 330 + (s16 % 3) * 55);
        } else hat(t, false, 0.015 + 0.05 * p);
        if (build && last) snare(t, 0.1 + 0.5 * (s16 / 16));
        return;
      }
      if (kit === 'rave') {
        if (s16 % 4 === 0) kick(t, full ? 1.1 : 0.55 + 0.4 * p, true);
        if ((full || p > 0.5) && (s16 === 4 || s16 === 12)) { clap(t, 0.6); if (full) snare(t, 0.2); }
        if (full) { if (s16 % 4 === 2) hat(t, true, 0.085); else hat(t, false, s16 % 2 ? 0.032 : 0.05); if (p2 && s16 % 2 === 0) ride(t); }
        else hat(t, false, 0.01 + 0.045 * p);
        if (build && last) snare(t, 0.08 + 0.4 * (s16 / 16));
      } else if (kit === 'four') {
        if (s16 % 4 === 0) kick(t, full ? 0.95 : 0.6, false);
        if ((full || p > 0.5) && (s16 === 4 || s16 === 12)) snare(t, 0.5, true);
        if (full) { hat(t, s16 % 4 === 2, s16 % 4 === 2 ? 0.06 : 0.03); if (p2 && s16 % 4 === 0) ride(t); }
        else if (s16 % 2 === 0) hat(t, false, 0.03);
        if (last && s16 >= 12) tom(t, [220, 180, 150, 120][s16 - 12], 0.35);
      } else if (kit === 'half') {
        if (s16 === 0 || (full && s16 === 10)) kick(t, full ? 0.75 : 0.5, false);
        if ((full || p > 0.5) && s16 === 8) snare(t, 0.45, true);
        if (s16 % 2 === 0) hat(t, false, full ? 0.035 : 0.02);
        if (full) shaker(t, s16 % 2 ? 0.015 : 0.025);
        if (last && s16 >= 14) snare(t, 0.2, false);
      } else if (kit === 'chip') {
        if (s16 === 0 || s16 === 8 || (full && (s16 === 11 || s16 === 6))) kick(t, full ? 0.85 : 0.6, false);
        if ((full || p > 0.5) && (s16 === 4 || s16 === 12)) chipSnare(t, 0.3);
        if (full || s16 % 2 === 0) hit(t, 0.02, 0.04, 'highpass', 8000, music);
        if (last) chipSnare(t, 0.06 + 0.2 * (s16 / 16));
      } else if (kit === 'industrial') {
        if (s16 % 4 === 0 || (full && s16 === 14)) kick(t, full ? 1.15 : 0.7, true);
        if ((full || p > 0.5) && (s16 === 4 || s16 === 12)) { snare(t, 0.4, false); hit(t, 0.15, 0.25, 'bandpass', 900, kickBus, 2); }
        if ([3, 7, 10, 15].includes(s16) && (full || s16 === 7)) metal(t, 330 + (s16 % 3) * 55);
        if (full) hat(t, false, 0.045);
        if (build && last) snare(t, 0.1 + 0.35 * (s16 / 16));
      } else if (kit === 'toms') {
        if (s16 === 0 || s16 === 6 || (full && s16 === 10)) kick(t, full ? 1 : 0.65, true);
        const tomHits = full ? [3, 7, 11, 13, 14, 15] : [3, 11];
        if (tomHits.includes(s16)) tom(t, [196, 165, 147, 131, 117, 98][tomHits.indexOf(s16) % 6], full ? 0.45 : 0.3);
        if ((full || p > 0.5) && s16 === 12) snare(t, 0.45, true);
        if (s16 % 2 === 0) hat(t, false, full ? 0.035 : 0.015);
        if (build && last) tom(t, 120 + s16 * 6, 0.25);
      } else {  // break
        if (s16 === 0 || s16 === 6 || s16 === 10 || (!full && s16 % 4 === 0)) kick(t, full ? 1.05 : 0.6, true);
        if ((full || p > 0.5) && (s16 === 4 || s16 === 12)) snare(t, 0.5, false);
        if (full && (s16 === 7 || s16 === 15)) snare(t, 0.12, false);
        hat(t, full && s16 % 8 === 2, full ? (s16 % 2 ? 0.03 : 0.05) : 0.02);
        if (p2 && s16 % 2 === 0) ride(t);
        if (build && last) snare(t, 0.1 + 0.4 * (s16 / 16));
      }
    }

    const seeded = seed => { let x = (seed * 4813 + 17) % 233280; return () => (x = (x * 9301 + 49297) % 233280) / 233280; };
    function makeAcid(sg) {
      const r = seeded(sg.seed), sc = SCALES[sg.scale];
      const deg = [0, 0, 0, 12, sc[1], sc[2], sc[4], sc[6], 0, 12, sc[3], sc[5]];
      return Array.from({ length: 16 }, (_, i) => r() < (i % 4 === 0 ? 0.08 : 0.3) ? null : { n: deg[Math.floor(r() * deg.length)], acc: r() < 0.3, slide: r() < 0.22 });
    }
    function makeLead(sg) {
      const r = seeded(sg.seed + 101), sc = SCALES[sg.scale];
      const bright = sg.scale === 'major' || sg.scale === 'mixo';
      const RHY = bright || sg.lead === 'chip'
        ? [[[0, 4], [4, 2], [6, 2], [8, 6], [14, 2]], [[0, 3], [3, 3], [6, 2], [8, 8]], [[0, 2], [2, 2], [4, 4], [8, 4], [12, 4]], [[0, 6], [6, 2], [8, 8]]]
        : [[[0, 8], [8, 8]], [[0, 12], [12, 4]], [[0, 6], [6, 10]], [[0, 16]], [[0, 4], [4, 4], [8, 8]]];
      const scale = sc.concat(sc.map(n => n + 12)).concat([24]);
      const near = (list, p) => list.reduce((a, c) => Math.abs(c - p) < Math.abs(a - p) ? c : a, list[0]);
      const out = new Array(64).fill(null);
      let prev = 7;
      for (let b = 0; b < 4; b++) {
        const ch = sg.prog[b % sg.prog.length];
        const rh = b === 3 ? [[0, 16]] : RHY[Math.floor(r() * RHY.length)];
        rh.forEach(([s0, len], k) => {
          let n;
          if (b === 3) n = bright ? (r() < 0.5 ? 0 : 7) : (r() < 0.5 ? 0 : sc[1]);
          else if (k === 0) n = near(ch.map(c => ((c % 12) + 12) % 12).flatMap(c => [c, c + 12]), prev);
          else { const i = scale.indexOf(near(scale, prev)); n = scale[Math.max(0, Math.min(scale.length - 1, i + (r() < 0.5 ? -1 : 1) * (r() < 0.25 ? 2 : 1)))]; }
          out[b * 16 + s0] = { n, len }; prev = n;
        });
      }
      return out;
    }

    function sectionAt(rb) {
      const arc = (intensity === 2 && song && song.arc) || ARCS[intensity], total = arc.reduce((a, s) => a + s[1], 0);
      let x = ((rb % total) + total) % total;
      for (const [name, len] of arc) { if (x < len) return [name, x, len]; x -= len; }
      return arc[0].concat(0);
    }

    function playStep(t, spb) {
      const s16 = step % 16, bar = Math.floor(step / 16);
      const [sec, sb, len] = sectionAt(bar - bar0);
      const sg = song, r0 = sg.root;
      const ch = sg.prog[(sg.bpm > 110 ? Math.floor(bar / 2) : bar) % sg.prog.length];
      const p = (sb * 16 + s16) / (len * 16);              // progress through this section
      const peak = sec === 'peak' || sec === 'peak2';
      const tt = t + (s16 % 2 ? spb * sg.swing : 0);
      const chordLen = sg.bpm > 110 ? 2 : 1;

      // pad
      if (s16 === 0 && bar % chordLen === 0) pad(t, ch.map(n => r0 + 12 + n), spb * 16 * chordLen, sg.bright * (sec === 'intro' ? 0.35 + 0.3 * p : sec === 'build' ? 0.6 : peak ? 0.8 : 1), sg.pad);
      if (sg.dark && (sec === 'intro' || sec === 'break') && s16 === 0 && bar % chordLen === 0) voice('sine', mtof(r0 + ch[0]), t, spb * 16 * chordLen, 0.1, music, { attack: 1, release: 1 });
      // bass
      const pat = BASSP[sg.bass];
      if ((peak || (sec === 'build' && p > 0.2) || (sec === 'break' && !sg.dark && s16 === 0)) && pat[s16])
        bass(tt, mtof(r0 + ch[0] + (pat[s16] === 2 ? 12 : 0)), spb * (sec === 'break' ? 8 : 0.85), sec === 'build' ? 250 + 700 * p : 1000, s16 % 4 === 2 ? 1.3 : 1);
      // arpeggio
      if (sg.arp && (sg.arpRate === 16 || s16 % 2 === 0)) {
        const base = ch.slice(0, Math.min(4, ch.length));
        const tones = Array.from({ length: 8 }, (_, k) => base[k % base.length] + 12 * Math.floor(k / base.length));
        const idx = ARP[sg.arp][(sg.arpRate === 16 ? s16 : s16 / 2) % 8];
        const open = sec === 'intro' ? 0.2 + 0.25 * p : sec === 'build' ? 0.45 + 0.5 * p : peak ? 1 : 0.5;
        if (sec !== 'intro' || s16 % 4 === 0 || sg.arpRate === 8) arpNote(tt, mtof(r0 + 12 + tones[idx]), spb * (sg.arpRate === 16 ? 0.8 : 1.6), 400 + 4000 * open);
      }
      // acid
      if (sg.acid) {
        const a = acid[(s16 + (bar % 4 === 3 ? 2 : 0)) % 16];
        if (a) {
          const cut = sec === 'intro' ? 250 + 400 * p : sec === 'build' ? 500 + 2400 * p : peak ? 1900 + 1300 * Math.pow(Math.sin(bar * Math.PI / 8), 2) : 700;
          acidNote(tt, mtof(r0 + 12 + ch[0] + a.n), spb * (a.slide ? 1.6 : 0.6), cut, a.acc, a.slide, sec === 'intro' ? 0.5 : sec === 'break' ? 0.55 : 1);
        }
      }
      // drums, risers, crashes, stabs
      if (sec === 'build' || peak) drums(sg.kit, s16, tt, sec, sb, len, p);
      else if (s16 % 4 === 2 && (sec === 'break' || sb >= len / 2)) hat(tt, false, 0.018);
      if ((sec === 'build' || sec === 'break') && s16 === 0 && sb === Math.max(0, len - 2)) riser(t, spb * 16 * Math.min(2, len));
      if (peak && sb === 0 && s16 === 0 && sec === 'peak') crash(t, sg.dark ? 0.18 : 0.1);
      if (peak && sg.stabs >= 0 && STABS[sg.stabs].includes(s16)) stab(tt, ch.map(n => r0 + 24 + n), spb * 1.3);
      if (peak && sg.chop && CHOP[s16]) chop(tt, ch.map(n => r0 + 12 + n), spb * 0.55);
      // lead
      const leadOn = sec === 'peak2' || sec === 'break' || (sg.leadIn === 'all' && sec === 'peak');
      if (leadOn) { const ev = melody[(bar % 4) * 16 + s16]; if (ev) lead(tt, mtof(r0 + 24 + ev.n), spb * ev.len * 0.95); }
    }

    function tick() {
      if (!ctx || !song || ctx.state !== 'running') return;
      const spb = 60 / song.bpm / 4;
      if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
      while (nextT < ctx.currentTime + 0.14) { playStep(nextT, spb); nextT += spb; step++; }
    }

    function play(key, lvl) {
      if (!ctx) return;
      if (key !== songKey) {
        songKey = key; song = SONGS[key]; step = 0; bar0 = 0; intensity = lvl;
        nextT = ctx.currentTime + 0.08; t0 = nextT;
        acid = makeAcid(song); melody = makeLead(song); acidPrev = 0; leadPrev = 0;
        delayNode.delayTime.setValueAtTime((60 / song.bpm) * 0.75, ctx.currentTime);
      } else if (lvl !== intensity) {
        intensity = lvl;
        step = Math.ceil(step / 16) * 16;
        bar0 = Math.floor(step / 16);
      }
      hissGain.gain.setTargetAtTime(0.006, ctx.currentTime, 0.3);
    }
    function muffle(on) { if (ctx) lp.frequency.setTargetAtTime(on ? 420 : 18000, ctx.currentTime, 0.12); }
    function setVolume(k) { vol = VOL[k] ?? 0.6; if (ctx) master.gain.setTargetAtTime(vol, ctx.currentTime, 0.05); }
    function hush(on) { if (ctx) on ? ctx.suspend() : ctx.resume(); }
    function beats() { return ctx && song && ctx.state === 'running' ? Math.max(0, ctx.currentTime - t0) * song.bpm / 60 : null; }
    const bpm = () => song ? song.bpm : 120;

    function sfx(name) {
      if (!ctx || ctx.state !== 'running' || vol === 0) return;
      const t = ctx.currentTime, r = song ? song.root + 24 : 62;
      if (name === 'jump') { const o = voice('square', 260, t, 0.14, 0.09, sfxBus, { cutoff: 2600 }); o.frequency.exponentialRampToValueAtTime(620, t + 0.12); }
      else if (name === 'boost') { const o = voice('sawtooth', 140, t, 0.4, 0.1, [sfxBus, verbSend], { cutoff: 2400, q: 6 }); o.frequency.exponentialRampToValueAtTime(760, t + 0.36); hit(t, 0.3, 0.1, 'bandpass', 2600, sfxBus); }
      else if (name === 'blip') { if (t - lastBlip < 0.07) return; lastBlip = t; voice('square', mtof(r + 12), t, 0.07, 0.045, sfxBus); voice('square', mtof(r + 19), t + 0.05, 0.06, 0.035, sfxBus); }
      else if (name === 'crash') { hit(t, 0.8, 0.6, 'lowpass', 800, [sfxBus, verbSend]); const o = voice('sine', 110, t, 0.55, 0.5, sfxBus); o.frequency.exponentialRampToValueAtTime(30, t + 0.5); }
      else if (name === 'boom') { hit(t, 0.5, 0.3, 'lowpass', 550, [sfxBus, verbSend]); }
      else if (name === 'stab') { [0, 7, 12].forEach(n => voice('sawtooth', mtof(r + n), t, 0.35, 0.03, [sfxBus, verbSend, delaySend], { detune: n === 7 ? 12 : -8, cutoff: 2200, q: 3 })); }
      else if (name === 'clear') { [0, 4, 7, 12, 16].forEach((n, k) => voice('square', mtof(r + n), t + k * 0.1, 0.4, 0.045, [sfxBus, delaySend], { cutoff: 2800 })); }
      else if (name === 'tick') { voice('square', mtof(r + 12), t, 0.035, 0.035, sfxBus, { cutoff: 3000 }); }
    }
    return { ensure, play, muffle, setVolume, hush, sfx, beats, bpm };
  })();
