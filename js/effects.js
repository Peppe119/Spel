'use strict';

// Particles, tire marks and floating score text.
const FX = (() => {
  const parts = [];
  const skids = [];
  const popups = [];
  const MAX_PARTS = 700;
  const MAX_SKIDS = 900;
  const SKID_LIFE = 14;
  let now = 0;

  function add(p) {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push(p);
  }

  // Sparks fly out along the contact normal (nx, ny).
  function sparks(x, y, nx, ny, count, speed = 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.atan2(ny, nx) + U.rand(-1.2, 1.2);
      const v = U.rand(120, 520) * speed;
      add({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: U.rand(0.2, 0.55), t: 0, c: Math.random() < 0.7 ? '#ffd34d' : '#ffffff' });
    }
  }

  function smoke(x, y, count, big = 1) {
    for (let i = 0; i < count; i++) {
      add({ k: 'smoke', x: x + U.rand(-6, 6), y: y + U.rand(-6, 6), vx: U.rand(-30, 30), vy: U.rand(-30, 30), life: U.rand(0.6, 1.3), t: 0, s: U.rand(8, 16) * big });
    }
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = U.rand(60, 260);
      add({ k: 'glow', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: U.rand(0.35, 0.8), t: 0, c: color, s: U.rand(8, 18) });
    }
    add({ k: 'ring', x, y, vx: 0, vy: 0, life: 0.45, t: 0, c: color });
  }

  function skid(x1, y1, x2, y2) {
    if (skids.length >= MAX_SKIDS) skids.shift();
    skids.push({ x1, y1, x2, y2, born: now });
  }

  function popup(x, y, text, color, size = 22) {
    popups.push({ x, y, text, color, size, t: 0, life: 1.1 });
  }

  function update(dt, time) {
    now = time;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      const drag = p.k === 'spark' ? 3 : 1.5;
      p.vx -= p.vx * drag * dt;
      p.vy -= p.vy * drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    while (skids.length && now - skids[0].born > SKID_LIFE) skids.shift();
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      p.t += dt;
      p.y -= 40 * dt;
      if (p.t >= p.life) popups.splice(i, 1);
    }
  }

  function drawSkids(ctx) {
    if (!skids.length) return;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    // Batch into a few age buckets so we only stroke a handful of paths.
    const BUCKETS = 5;
    for (let b = 0; b < BUCKETS; b++) {
      const path = new Path2D();
      let any = false;
      for (const s of skids) {
        const age = (now - s.born) / SKID_LIFE;
        if (Math.min(BUCKETS - 1, (age * BUCKETS) | 0) !== b) continue;
        path.moveTo(s.x1, s.y1);
        path.lineTo(s.x2, s.y2);
        any = true;
      }
      if (!any) continue;
      ctx.strokeStyle = `rgba(0,0,0,${0.55 * (1 - b / BUCKETS)})`;
      ctx.stroke(path);
    }
    ctx.lineCap = 'butt';
  }

  function drawParticles(ctx) {
    for (const p of parts) {
      if (p.k !== 'smoke') continue;
      const f = p.t / p.life;
      ctx.fillStyle = `rgba(120,110,150,${0.28 * (1 - f)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s * (1 + f * 1.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of parts) {
      const f = 1 - p.t / p.life;
      if (p.k === 'spark') {
        ctx.strokeStyle = p.c;
        ctx.globalAlpha = f;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else if (p.k === 'glow') {
        Glow.draw(ctx, p.c, p.x, p.y, p.s * f + 2, p.s * f + 2, f);
      } else if (p.k === 'ring') {
        ctx.globalAlpha = f;
        ctx.strokeStyle = p.c;
        ctx.lineWidth = 4 * f;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20 + (1 - f) * 70, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawPopups(ctx, zoom) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const f = p.t / p.life;
      const pop = f < 0.15 ? 0.6 + (f / 0.15) * 0.5 : 1.1 - Math.min(0.1, (f - 0.15));
      ctx.globalAlpha = f > 0.7 ? (1 - f) / 0.3 : 1;
      ctx.font = `800 ${(p.size * pop) / zoom}px system-ui, sans-serif`;
      ctx.lineWidth = 4 / zoom;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  function clear() {
    parts.length = 0;
    skids.length = 0;
    popups.length = 0;
  }

  return { sparks, smoke, burst, skid, popup, update, drawSkids, drawParticles, drawPopups, clear };
})();
