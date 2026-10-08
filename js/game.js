'use strict';

// Game state, loop, input, difficulty, HUD and screen-space rendering.
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    hud: $('hud'), score: $('hud-score'), cash: $('hud-cash'), time: $('hud-time'),
    stars: Array.from(document.querySelectorAll('#hud-wanted .star')),
    combo: $('hud-combo'), bust: $('hud-bust'), bustFill: $('hud-bust-fill'),
    banner: $('banner'), menu: $('menu'), over: $('gameover'), pause: $('pause'),
    menuBest: $('menu-best'), finalScore: $('final-score'), finalBest: $('final-best'),
    newBest: $('new-best'), stats: $('final-stats'), mute: $('mute'), touchHint: $('touch-hint'),
  };

  // ------------------------------------------------------------ constants

  const BEST_KEY = 'neonGetaway.bestScore';
  const CASH_COUNT = 16;
  const COMBO_WINDOW = 4.5;
  const MAX_MULT = 8;
  const CATCH_DIST = 40;
  const HEAT_LEVELS = [0, 22, 50, 85, 125];          // heat needed for wanted 1..5
  const POLICE_BY_LEVEL = [0, 2, 3, 4, 6, 8];
  const SPEED_BY_LEVEL = [0, 0.72, 0.8, 0.87, 0.94, 0.99];
  const LEAD_BY_LEVEL = [0, 0, 0.25, 0.45, 0.65, 0.8];
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  function loadBest() {
    try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* storage blocked */ }
  }

  // ------------------------------------------------------------ world setup

  City.generate((Math.random() * 1e9) | 0);
  let minimap = null;

  let W = 0, H = 0, DPR = 1, baseZoom = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    baseZoom = U.clamp(Math.min(W, H) / 820, 0.5, 1.35);
    minimap = City.renderMinimap(Math.round(minimapSize() * DPR));
  }
  const minimapSize = () => (Math.min(W, H) < 600 ? 104 : 156);

  const G = {
    state: 'menu',
    clock: 0, stateTime: 0,
    time: 0, score: 0, cash: 0, pickups: 0,
    combo: 0, comboTimer: 0, maxCombo: 0,
    wanted: 1, maxWanted: 1, heat: 0, bust: 0, crashes: 0,
    policeMax: 400, lead: 0, policeTarget: 2,
    player: null, police: [], loot: [], flowTimer: 0, spawnTimer: 0,
    best: loadBest(), newBest: false,
  };
  const cam = { x: City.SIZE / 2, y: City.SIZE / 2, zoom: 1, shake: 0, sx: 0, sy: 0 };
  // Invisible "suspect" the police chase on the title screen.
  const demo = { x: 0, y: 0, vx: 0, vy: 0 };

  // ------------------------------------------------------------ input

  const keys = new Set();
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    Sound.init();
    if (!e.repeat) onPress(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); if (G.state === 'playing') setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'playing') setPaused(true); });

  function onPress(code) {
    if (code === 'Space' || code === 'Enter') primaryAction();
    else if (code === 'KeyM') toggleMute();
    else if (code === 'KeyP' || code === 'Escape') {
      if (G.state === 'playing') setPaused(true);
      else if (G.state === 'paused') setPaused(false);
    }
  }

  function primaryAction() {
    if (G.state === 'menu') startGame();
    else if (G.state === 'gameover' && G.stateTime > 0.9) startGame();
    else if (G.state === 'paused') setPaused(false);
  }

  for (const el of [ui.menu, ui.over, ui.pause]) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); Sound.init(); primaryAction(); });
  }
  ui.mute.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); Sound.init(); toggleMute(); });

  canvas.addEventListener('pointerdown', (e) => {
    Sound.init();
    if (G.state !== 'playing' || joy.id !== null) return;
    joy.id = e.pointerId;
    joy.ox = joy.x = e.clientX;
    joy.oy = joy.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    joy.x = e.clientX;
    joy.y = e.clientY;
  });
  const endJoy = (e) => { if (e.pointerId === joy.id) joy.id = null; };
  canvas.addEventListener('pointerup', endJoy);
  canvas.addEventListener('pointercancel', endJoy);

  function readControls() {
    const k = (...c) => c.some((x) => keys.has(x));
    const c = {
      throttle: (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0),
      steer: (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0),
      handbrake: k('Space', 'ShiftLeft', 'ShiftRight'),
    };
    // Touch / mouse drag: point the stick where you want to go.
    if (joy.id !== null) {
      const dx = joy.x - joy.ox, dy = joy.y - joy.oy;
      const m = Math.hypot(dx, dy);
      if (m > 12) {
        const diff = U.angleDiff(Math.atan2(dy, dx), G.player.a);
        c.steer = U.clamp(diff * 2.2, -1, 1);
        c.throttle = U.clamp(m / 70, 0.35, 1);
        c.handbrake = Math.abs(diff) > 1.6 && G.player.speed > 220;
      }
    }
    return c;
  }

  function toggleMute() {
    const m = Sound.toggleMute();
    ui.mute.classList.toggle('off', m);
  }

  function setPaused(p) {
    if (p && G.state === 'playing') {
      G.state = 'paused';
      ui.pause.classList.remove('hidden');
      Sound.silenceLoops();
    } else if (!p && G.state === 'paused') {
      G.state = 'playing';
      ui.pause.classList.add('hidden');
      joy.id = null;
    }
  }

  // ------------------------------------------------------------ game flow

  function startGame() {
    Sound.init();
    Sound.start();
    FX.clear();
    const s = City.centerSpawn();
    G.player = new Car(s.x, s.y, -Math.PI / 2, PLAYER_CFG);
    Object.assign(G, {
      state: 'playing', stateTime: 0, time: 0, score: 0, cash: 0, pickups: 0,
      combo: 0, comboTimer: 0, maxCombo: 0, wanted: 1, maxWanted: 1, heat: 0, bust: 0,
      crashes: 0, police: [], loot: [], flowTimer: 0, spawnTimer: 5, newBest: false,
    });
    cam.x = s.x; cam.y = s.y; cam.zoom = baseZoom;
    joy.id = null;
    updateDifficulty(true);
    City.computeFlow(s.x, s.y);
    spawnPolice(G.player, 1100, 1400);
    for (let i = 0; i < CASH_COUNT; i++) spawnCash(true);
    ui.menu.classList.add('hidden');
    ui.over.classList.add('hidden');
    ui.pause.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    lastHud = {};
    banner('ESCAPE THE COPS', 'Grab the cash • Don\'t get pinned');
  }

  function gameOver() {
    G.state = 'gameover';
    G.stateTime = 0;
    G.score = Math.floor(G.score);
    if (G.score > G.best) { G.best = G.score; G.newBest = true; saveBest(G.best); }
    Sound.silenceLoops();
    Sound.gameOver();
    cam.shake = 14;
    const P = G.player;
    FX.sparks(P.x, P.y, 0, -1, 30);
    FX.smoke(P.x, P.y, 14, 1.4);
    ui.finalScore.textContent = U.formatNum(G.score);
    ui.finalBest.textContent = U.formatNum(G.best);
    ui.newBest.classList.toggle('hidden', !G.newBest);
    ui.stats.innerHTML =
      `<div><b>${U.formatTime(G.time)}</b><span>survived</span></div>` +
      `<div><b>$${U.formatNum(G.cash)}</b><span>cash</span></div>` +
      `<div><b>x${G.maxCombo}</b><span>best combo</span></div>` +
      `<div><b>${'★'.repeat(G.maxWanted)}</b><span>wanted</span></div>`;
    setTimeout(() => {
      if (G.state !== 'gameover') return;
      ui.hud.classList.add('hidden');
      ui.over.classList.remove('hidden');
    }, 900);
  }

  function updateDifficulty(initial = false) {
    G.heat = G.time + G.pickups * 2.5;
    let lvl = 1;
    for (let i = 1; i < HEAT_LEVELS.length; i++) if (G.heat >= HEAT_LEVELS[i]) lvl = i + 1;
    // Past five stars the chase keeps getting harder, slowly.
    const over = Math.max(0, G.heat - HEAT_LEVELS[4]);
    G.policeTarget = Math.min(12, POLICE_BY_LEVEL[lvl] + Math.floor(over / 45));
    G.policeMax = PLAYER_CFG.maxSpeed * (SPEED_BY_LEVEL[lvl] + Math.min(0.08, over * 0.0007));
    G.lead = LEAD_BY_LEVEL[lvl];
    if (lvl > G.wanted && !initial) {
      Sound.wantedUp();
      banner(`WANTED LEVEL ${lvl}`, lvl >= 5 ? 'Every unit in the city is after you' : 'More units incoming');
      cam.shake = Math.max(cam.shake, 4);
    }
    G.wanted = lvl;
    G.maxWanted = Math.max(G.maxWanted, lvl);
  }

  // ------------------------------------------------------------ spawning

  function viewRect(margin = 0) {
    const hw = W / 2 / cam.zoom + margin, hh = H / 2 / cam.zoom + margin;
    return { x0: cam.x - hw, y0: cam.y - hh, x1: cam.x + hw, y1: cam.y + hh };
  }
  const inRect = (r, x, y) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1;

  function findSpot(cx, cy, minD, maxD, avoidView, reachable) {
    const view = viewRect(60);
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2, d = U.rand(minD, maxD);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (!City.isFree(x, y)) continue;
      if (avoidView && i < 60 && inRect(view, x, y)) continue;
      if (reachable && City.pathDistance(x, y) === Infinity) continue;
      const sx = (Math.floor(x / City.NAV) + 0.5) * City.NAV, sy = (Math.floor(y / City.NAV) + 0.5) * City.NAV;
      return { x: sx, y: sy };
    }
    return null;
  }

  function spawnPolice(target, minD = 800, maxD = 1200) {
    const s = findSpot(target.x, target.y, minD, maxD, true, true);
    if (!s) return null;
    const p = new Car(s.x, s.y, Math.atan2(target.y - s.y, target.x - s.x), POLICE_CFG, true);
    G.police.push(p);
    return p;
  }

  function spawnCash(initial) {
    const P = G.player;
    const s = findSpot(P.x, P.y, initial ? 200 : 450, 1500, !initial, true);
    if (!s) return;
    const gold = Math.random() < 0.08;
    G.loot.push({ x: s.x, y: s.y, gold, value: gold ? 500 : 100, phase: Math.random() * 6 });
  }

  // ------------------------------------------------------------ simulation

  function crashResponse(car, nx, ny, isPlayer) {
    const vn = car.vx * nx + car.vy * ny;
    if (vn >= 0) return;
    const impact = -vn;
    car.vx -= (1 + 0.3) * vn * nx;
    car.vy -= (1 + 0.3) * vn * ny;
    // Scrape: lose speed along the wall too.
    const keep = impact > 140 ? 0.62 : 0.88;
    car.vx *= keep;
    car.vy *= keep;
    if (impact > 90 && isPlayer) {
      const cx = car.x - nx * car.r, cy = car.y - ny * car.r;
      FX.sparks(cx, cy, nx, ny, Math.min(24, (impact / 18) | 0));
      if (impact > 200) FX.smoke(cx, cy, 4);
      Sound.crash(impact / 500);
      cam.shake = Math.max(cam.shake, Math.min(14, impact / 30));
      G.crashes++;
    } else if (impact > 160 && car.police) {
      FX.sparks(car.x - nx * car.r, car.y - ny * car.r, nx, ny, 6, 0.7);
    }
  }

  function collideCars(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d2 = dx * dx + dy * dy, min = a.r + b.r;
    if (d2 >= min * min || d2 < 1e-6) return false;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    const ma = a.cfg.mass, mb = b.cfg.mass, tot = ma + mb;
    const pen = min - d;
    a.x -= nx * pen * (mb / tot); a.y -= ny * pen * (mb / tot);
    b.x += nx * pen * (ma / tot); b.y += ny * pen * (ma / tot);
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv < 0) {
      const j = (-(1 + 0.35) * rv) / (1 / ma + 1 / mb);
      a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny;
      b.vx += (j / mb) * nx; b.vy += (j / mb) * ny;
      if (-rv > 140) {
        FX.sparks(a.x + nx * a.r, a.y + ny * a.r, -nx, -ny, 8, 0.8);
        return -rv;
      }
    }
    return true;
  }

  function emitSkids(car, handbrake) {
    const w = car.rearWheels();
    const skidding = car.slip > 95 || (handbrake && car.speed > 140);
    if (skidding && car.prevWheels) {
      const p = car.prevWheels;
      FX.skid(p[0], p[1], w[0], w[1]);
      FX.skid(p[2], p[3], w[2], w[3]);
      if (Math.random() < 0.25) FX.smoke((w[0] + w[2]) / 2, (w[1] + w[3]) / 2, 1, 0.6);
    }
    car.prevWheels = w;
    return skidding;
  }

  function stepPolice(dt, target, mode) {
    G.flowTimer -= dt;
    if (G.flowTimer <= 0) {
      City.computeFlow(target.x, target.y);
      G.flowTimer = 0.2;
    }
    const view = viewRect(80);
    for (const p of G.police) {
      const dist = Math.hypot(target.x - p.x, target.y - p.y);
      // Rubber band: units far away and off-screen drive faster to keep pressure on.
      const boost = dist > 900 && !inRect(view, p.x, p.y) ? 1.3 : 1;
      p.maxSpeed = G.policeMax * p.speedVar * boost;
      const c = PoliceAI.control(p, target, dt, G.lead, mode);
      p.update(dt, c);
      City.collideCircle(p, p.r, (nx, ny) => crashResponse(p, nx, ny, false));
      emitSkids(p, c.handbrake);
      // Units stranded far away get recycled closer to the action.
      if (dist > 1900) p.farT += dt; else p.farT = 0;
      if (p.farT > 3 && mode === 'chase') {
        const s = findSpot(target.x, target.y, 800, 1150, true, true);
        if (s) { p.x = s.x; p.y = s.y; p.vx = p.vy = 0; p.farT = 0; p.prevWheels = null; }
      }
    }
    for (let i = 0; i < G.police.length; i++) {
      for (let j = i + 1; j < G.police.length; j++) collideCars(G.police[i], G.police[j]);
    }
  }

  function updatePlaying(dt) {
    const P = G.player;
    G.time += dt;
    updateDifficulty();

    const ctrl = readControls();
    P.maxSpeed = PLAYER_CFG.maxSpeed;
    P.update(dt, ctrl);
    City.collideCircle(P, P.r, (nx, ny) => crashResponse(P, nx, ny, true));
    const skidding = emitSkids(P, ctrl.handbrake);

    stepPolice(dt, P, 'chase');

    // Police contact fills the bust meter; slow or boxed-in fills it faster.
    let contacts = 0;
    for (const p of G.police) {
      const hit = collideCars(P, p);
      if (typeof hit === 'number') {
        Sound.bump();
        cam.shake = Math.max(cam.shake, Math.min(10, hit / 40));
      }
      if (Math.hypot(P.x - p.x, P.y - p.y) < CATCH_DIST) contacts++;
    }
    if (contacts > 0) {
      // Being rammed at speed is survivable; getting boxed in at a standstill is not.
      const rate = U.lerp(1.1, 0.22, U.clamp(P.speed / 380, 0, 1));
      G.bust += dt * rate * (1 + 0.35 * (contacts - 1));
      if (G.combo > 1) {
        FX.popup(P.x, P.y - 40, 'COMBO LOST', '#ff4d6d', 20);
        Sound.comboLost();
      }
      G.combo = 0;
      G.comboTimer = 0;
    } else {
      G.bust = Math.max(0, G.bust - dt * 0.7);
    }
    if (G.bust >= 1) {
      G.bust = 1;
      gameOver();
      return;
    }

    // Cash pickups and the combo multiplier.
    if (G.comboTimer > 0) {
      G.comboTimer -= dt;
      if (G.comboTimer <= 0) G.combo = 0;
    }
    for (let i = G.loot.length - 1; i >= 0; i--) {
      const c = G.loot[i];
      const d = Math.hypot(c.x - P.x, c.y - P.y);
      if (d < (c.gold ? 38 : 32)) {
        G.combo = G.comboTimer > 0 ? G.combo + 1 : 1;
        G.comboTimer = COMBO_WINDOW;
        G.maxCombo = Math.max(G.maxCombo, G.combo);
        const mult = Math.min(MAX_MULT, G.combo);
        G.score += c.value * mult;
        G.cash += c.value;
        G.pickups++;
        FX.burst(c.x, c.y, c.gold ? '#ffd34d' : '#39ff88', c.gold ? 30 : 16);
        FX.popup(c.x, c.y - 20, `+$${c.value}${mult > 1 ? ' x' + mult : ''}`, c.gold ? '#ffd34d' : '#39ff88', c.gold ? 28 : 22);
        if (c.gold) Sound.bigPickup(); else Sound.pickup(mult);
        G.loot.splice(i, 1);
      } else if (d > 2300) {
        G.loot.splice(i, 1);
      }
    }
    while (G.loot.length < CASH_COUNT) {
      const before = G.loot.length;
      spawnCash(false);
      if (G.loot.length === before) break;
    }

    // Reinforcements.
    G.spawnTimer -= dt;
    if (G.police.length < G.policeTarget && G.spawnTimer <= 0) {
      spawnPolice(P);
      G.spawnTimer = U.rand(1.5, 2.6);
    }

    // Survival points scale with wanted level.
    G.score += dt * 10 * G.wanted;

    // Audio
    const sf = U.clamp(P.speed / PLAYER_CFG.maxSpeed, 0, 1);
    Sound.setEngine(sf, ctrl.throttle);
    Sound.setSkid(skidding ? U.clamp((P.slip - 60) / 250, 0.2, 1) : 0);
    let near = Infinity;
    for (const p of G.police) near = Math.min(near, Math.hypot(p.x - P.x, p.y - P.y));
    Sound.setSiren(1 - U.clamp((near - 150) / 1100, 0, 1));
  }

  function updateGameOver(dt) {
    const P = G.player;
    P.update(dt, { throttle: 0, steer: 0, handbrake: true });
    City.collideCircle(P, P.r, (nx, ny) => crashResponse(P, nx, ny, false));
    stepPolice(dt, P, 'hold');
    for (const p of G.police) collideCars(P, p);
  }

  function updateMenu(dt) {
    // Slow aerial pan with a few patrol cars chasing a phantom suspect.
    const t = G.clock * 0.05;
    const S = City.SIZE;
    const tx = S / 2 + Math.cos(t) * S * 0.28, ty = S / 2 + Math.sin(t * 1.3) * S * 0.28;
    demo.vx = (tx - demo.x) / Math.max(dt, 1e-3);
    demo.vy = (ty - demo.y) / Math.max(dt, 1e-3);
    if (!demo.x) { demo.vx = demo.vy = 0; }
    demo.x = tx; demo.y = ty;
    cam.x = tx; cam.y = ty;
    cam.zoom = baseZoom * 0.8;
    if (G.police.length < 4) {
      G.policeMax = 360;
      G.lead = 0;
      spawnPolice(demo, 300, 700);
    }
    stepPolice(dt, demo, 'hold');
  }

  function updateCamera(dt) {
    if (G.state === 'menu') return;
    const P = G.player;
    const sf = U.clamp(P.speed / PLAYER_CFG.maxSpeed, 0, 1);
    const tx = P.x + P.vx * 0.32, ty = P.y + P.vy * 0.32;
    const k = 1 - Math.exp(-4.5 * dt);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    const tz = baseZoom * (G.state === 'gameover' ? 1.15 : 1 - 0.2 * sf);
    cam.zoom += (tz - cam.zoom) * (1 - Math.exp(-2 * dt));
  }

  function update(dt) {
    G.clock += dt;
    G.stateTime += dt;
    if (G.state === 'paused') return;
    if (G.state === 'playing') updatePlaying(dt);
    else if (G.state === 'gameover') updateGameOver(dt);
    else if (G.state === 'menu') updateMenu(dt);
    updateCamera(dt);
    cam.shake = Math.max(0, cam.shake - dt * 30);
    cam.sx = (Math.random() - 0.5) * cam.shake;
    cam.sy = (Math.random() - 0.5) * cam.shake;
    FX.update(dt, G.clock);
  }

  // ------------------------------------------------------------ rendering

  function drawCash(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const c of G.loot) {
      const pulse = 0.75 + Math.sin(G.clock * 4 + c.phase) * 0.25;
      Glow.draw(ctx, c.gold ? '#ffc400' : '#39ff88', c.x, c.y, (c.gold ? 70 : 52) * pulse, (c.gold ? 70 : 52) * pulse, 0.55);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of G.loot) {
      const bob = Math.sin(G.clock * 3 + c.phase) * 3;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.rotate(Math.sin(G.clock * 1.5 + c.phase) * 0.3);
      if (c.gold) {
        ctx.fillStyle = '#ffd34d';
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff4b8'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#7a4b00';
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.fillText('$', 0, 1);
      } else {
        ctx.fillStyle = '#1fd46a';
        roundRect(ctx, -15, -9, 30, 18, 3); ctx.fill();
        ctx.strokeStyle = '#b8ffd4'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#063d1c';
        ctx.font = '900 14px system-ui, sans-serif';
        ctx.fillText('$', 0, 1);
      }
      ctx.restore();
    }
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#020106';
    ctx.fillRect(0, 0, W, H);

    const z = cam.zoom;
    const cx = cam.x + cam.sx, cy = cam.y + cam.sy;
    const v = viewRect(40);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-cx, -cy);

    City.drawGround(ctx, v, G.clock);
    FX.drawSkids(ctx);
    if (G.state !== 'menu') drawCash(ctx);

    const cars = G.state === 'menu' ? G.police : [...G.police, G.player];
    ctx.globalCompositeOperation = 'lighter';
    for (const c of cars) if (inRect(v, c.x, c.y)) CarArt.drawLights(ctx, c, G.clock);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const c of cars) if (inRect(v, c.x, c.y)) CarArt.draw(ctx, c, G.clock);

    FX.drawParticles(ctx);
    City.drawBuildings(ctx, v, cx, cy, G.clock);
    FX.drawPopups(ctx, z);
    ctx.restore();

    drawScreenFX();
  }

  function drawScreenFX() {
    // Vignette
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (G.state === 'menu') return;

    // Police danger: red/blue flashing edges while the bust meter fills.
    if (G.bust > 0) {
      const on = Math.sin(G.clock * 14) > 0;
      const a = Math.min(0.55, G.bust * 0.6);
      const e = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      e.addColorStop(0, 'rgba(0,0,0,0)');
      e.addColorStop(1, on ? `rgba(255,30,60,${a})` : `rgba(40,80,255,${a})`);
      ctx.fillStyle = e;
      ctx.fillRect(0, 0, W, H);
    }

    if (G.state === 'playing' || G.state === 'paused') {
      drawOffscreenPolice();
      drawMinimap();
      if (joy.id !== null) {
        ctx.strokeStyle = 'rgba(0,240,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 50, 0, Math.PI * 2); ctx.stroke();
        const dx = joy.x - joy.ox, dy = joy.y - joy.oy, m = Math.hypot(dx, dy), k = m > 50 ? 50 / m : 1;
        ctx.fillStyle = 'rgba(255,43,214,0.6)';
        ctx.beginPath(); ctx.arc(joy.ox + dx * k, joy.oy + dy * k, 18, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawOffscreenPolice() {
    const P = G.player, z = cam.zoom;
    const m = 26;
    for (const p of G.police) {
      const sx = (p.x - cam.x) * z + W / 2, sy = (p.y - cam.y) * z + H / 2;
      if (sx > 0 && sx < W && sy > 0 && sy < H) continue;
      const d = Math.hypot(p.x - P.x, p.y - P.y);
      if (d > 1600) continue;
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      // Clamp to the screen edge along the ray from center.
      const kx = (W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), ky = (H / 2 - m) / Math.abs(Math.sin(a) || 1e-6);
      const k = Math.min(kx, ky);
      const ex = W / 2 + Math.cos(a) * k, ey = H / 2 + Math.sin(a) * k;
      const on = Math.sin(G.clock * 14 + p.phase) > 0;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.globalAlpha = U.clamp(1.3 - d / 1600, 0.25, 1);
      ctx.fillStyle = on ? '#ff2b47' : '#3d6bff';
      ctx.beginPath();
      ctx.moveTo(12, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawMinimap() {
    const s = minimapSize(), pad = 14;
    const x = W - s - pad, y = H - s - pad;
    const k = s / City.SIZE;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(5,3,15,0.8)';
    ctx.fillRect(x - 4, y - 4, s + 8, s + 8);
    ctx.drawImage(minimap, x, y, s, s);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,240,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 4, y - 4, s + 8, s + 8);
    for (const c of G.loot) {
      ctx.fillStyle = c.gold ? '#ffd34d' : '#39ff88';
      ctx.fillRect(x + c.x * k - 1.5, y + c.y * k - 1.5, 3, 3);
    }
    const on = Math.sin(G.clock * 14) > 0;
    for (const p of G.police) {
      ctx.fillStyle = on ? '#ff2b47' : '#5b86ff';
      ctx.beginPath(); ctx.arc(x + p.x * k, y + p.y * k, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    const P = G.player;
    ctx.translate(x + P.x * k, y + P.y * k);
    ctx.rotate(P.a);
    ctx.fillStyle = '#ff2bd6';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ HUD

  let lastHud = {};
  function setText(key, el, val) {
    if (lastHud[key] === val) return;
    lastHud[key] = val;
    el.textContent = val;
  }

  function updateHud() {
    if (G.state !== 'playing' && G.state !== 'paused') return;
    setText('score', ui.score, U.formatNum(G.score));
    setText('cash', ui.cash, '$' + U.formatNum(G.cash));
    setText('time', ui.time, U.formatTime(G.time));
    if (lastHud.wanted !== G.wanted) {
      lastHud.wanted = G.wanted;
      ui.stars.forEach((s, i) => s.classList.toggle('on', i < G.wanted));
    }
    const mult = Math.min(MAX_MULT, G.combo);
    if (mult > 1 && G.comboTimer > 0) {
      setText('combo', ui.combo, `COMBO x${mult}`);
      ui.combo.style.setProperty('--t', (G.comboTimer / COMBO_WINDOW).toFixed(3));
      ui.combo.classList.add('show');
    } else {
      ui.combo.classList.remove('show');
    }
    ui.bust.classList.toggle('show', G.bust > 0.01);
    ui.bustFill.style.width = (G.bust * 100).toFixed(1) + '%';
  }

  let bannerTimer = null;
  function banner(title, sub) {
    ui.banner.innerHTML = `<div class="b-title">${title}</div><div class="b-sub">${sub}</div>`;
    ui.banner.classList.remove('show');
    void ui.banner.offsetWidth; // restart the CSS animation
    ui.banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => ui.banner.classList.remove('show'), 2400);
  }

  // ------------------------------------------------------------ main loop

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const steps = dt > 1 / 55 ? 2 : 1;
    for (let i = 0; i < steps; i++) update(dt / steps);
    if (G.state !== 'playing') Sound.setSkid(0);
    render();
    updateHud();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  ui.menuBest.textContent = U.formatNum(G.best);
  ui.mute.classList.toggle('off', Sound.muted);
  if (isTouch) document.body.classList.add('touch');
  requestAnimationFrame(frame);

  // Exposed for automated testing and tinkering from the console.
  window.NeonGetaway = { G, cam, keys, startGame, update, render, City };
})();
