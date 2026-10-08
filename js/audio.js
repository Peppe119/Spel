'use strict';

// All sound is synthesized with the Web Audio API: no external assets.
const Sound = (() => {
  let ac = null;
  let master, noiseBuf;
  let engine, siren, skid;
  let muted = false;
  try { muted = localStorage.getItem('neonGetaway.muted') === '1'; } catch (e) { /* storage blocked */ }

  function init() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try { ac = new Ctx(); } catch (e) { return; }

    const comp = ac.createDynamicsCompressor();
    comp.connect(ac.destination);
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(comp);

    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Engine: detuned saw + sub square through a lowpass that opens with revs.
    engine = { gain: ac.createGain(), filter: ac.createBiquadFilter(), o1: ac.createOscillator(), o2: ac.createOscillator() };
    engine.o1.type = 'sawtooth';
    engine.o2.type = 'square';
    engine.filter.type = 'lowpass';
    engine.filter.frequency.value = 400;
    engine.filter.Q.value = 4;
    engine.gain.gain.value = 0;
    engine.o1.connect(engine.filter);
    const sub = ac.createGain();
    sub.gain.value = 0.5;
    engine.o2.connect(sub).connect(engine.filter);
    engine.filter.connect(engine.gain).connect(master);
    engine.o1.start();
    engine.o2.start();

    // Siren: a triangle wave whose pitch is swept by a slow LFO.
    siren = { gain: ac.createGain(), osc: ac.createOscillator(), lfo: ac.createOscillator(), depth: ac.createGain() };
    siren.osc.type = 'triangle';
    siren.osc.frequency.value = 760;
    siren.lfo.type = 'sine';
    siren.lfo.frequency.value = 0.9;
    siren.depth.gain.value = 260;
    siren.lfo.connect(siren.depth).connect(siren.osc.frequency);
    siren.gain.gain.value = 0;
    siren.osc.connect(siren.gain).connect(master);
    siren.osc.start();
    siren.lfo.start();

    // Tire screech: looped noise through a resonant bandpass.
    skid = { gain: ac.createGain(), src: ac.createBufferSource(), filter: ac.createBiquadFilter() };
    skid.src.buffer = noiseBuf;
    skid.src.loop = true;
    skid.filter.type = 'bandpass';
    skid.filter.frequency.value = 1900;
    skid.filter.Q.value = 6;
    skid.gain.gain.value = 0;
    skid.src.connect(skid.filter).connect(skid.gain).connect(master);
    skid.src.start();
  }

  const ready = () => ac && ac.state === 'running';

  function setEngine(speedFrac, throttle) {
    if (!ready()) return;
    const t = ac.currentTime;
    const f = 38 + speedFrac * 95 + Math.max(0, throttle) * 12;
    engine.o1.frequency.setTargetAtTime(f, t, 0.06);
    engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    engine.filter.frequency.setTargetAtTime(260 + speedFrac * 900 + Math.max(0, throttle) * 400, t, 0.08);
    engine.gain.gain.setTargetAtTime(0.07 + speedFrac * 0.07, t, 0.1);
  }

  function setSiren(level) {
    if (!ready()) return;
    siren.gain.gain.setTargetAtTime(U.clamp(level, 0, 1) * 0.05, ac.currentTime, 0.15);
  }

  function setSkid(level) {
    if (!ready()) return;
    skid.gain.gain.setTargetAtTime(U.clamp(level, 0, 1) * 0.12, ac.currentTime, 0.05);
  }

  function silenceLoops() {
    if (!ready()) return;
    const t = ac.currentTime;
    engine.gain.gain.setTargetAtTime(0, t, 0.2);
    skid.gain.gain.setTargetAtTime(0, t, 0.05);
    siren.gain.gain.setTargetAtTime(0, t, 0.4);
  }

  function tone(type, f0, f1, dur, vol, delay = 0) {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, freq, q = 1, delay = 0) {
    const t = ac.currentTime + delay;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf;
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.15), t + dur);
    f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  function pickup(mult) {
    if (!ready()) return;
    const base = 660 * Math.pow(1.06, Math.min(mult, 8) - 1);
    tone('square', base, base * 1.01, 0.08, 0.07);
    tone('square', base * 1.5, base * 1.52, 0.12, 0.07, 0.07);
    tone('sine', base * 2, base * 2, 0.18, 0.05, 0.12);
  }

  function bigPickup() {
    if (!ready()) return;
    [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, 0.12, 0.06, i * 0.06));
  }

  function crash(intensity) {
    if (!ready()) return;
    const v = U.clamp(intensity, 0.15, 1);
    noise(0.35 + v * 0.3, 0.5 * v, 2500 + v * 2000);
    tone('sine', 120, 40, 0.3, 0.4 * v);
    if (v > 0.5) tone('square', 1800, 900, 0.08, 0.04 * v);
  }

  function bump() {
    if (!ready()) return;
    noise(0.12, 0.2, 900);
    tone('sine', 90, 50, 0.12, 0.2);
  }

  function wantedUp() {
    if (!ready()) return;
    tone('sawtooth', 440, 440, 0.12, 0.05);
    tone('sawtooth', 880, 880, 0.18, 0.05, 0.14);
  }

  function comboLost() {
    if (!ready()) return;
    tone('triangle', 500, 200, 0.25, 0.08);
  }

  function gameOver() {
    if (!ready()) return;
    noise(0.8, 0.5, 3000);
    tone('sawtooth', 440, 55, 1.3, 0.12, 0.1);
    tone('square', 330, 41, 1.5, 0.06, 0.25);
    [392, 349, 311, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.3, 0.12, 0.6 + i * 0.22));
  }

  function start() {
    if (!ready()) return;
    [262, 392, 523].forEach((f, i) => tone('square', f, f, 0.1, 0.05, i * 0.07));
  }

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('neonGetaway.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.6, ac.currentTime, 0.02);
    return muted;
  }

  return {
    init, setEngine, setSiren, setSkid, silenceLoops,
    pickup, bigPickup, crash, bump, wantedUp, comboLost, gameOver, start, toggleMute,
    get muted() { return muted; },
  };
})();
