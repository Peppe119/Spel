'use strict';

// The city: procedural block layout, collision, navigation grid for the police
// AI and all of the static-world rendering (roads, lamps, 3D buildings, minimap).
const City = (() => {
  const N = 12;          // blocks per side
  const ROAD = 180;      // road width
  const BLOCK = 420;     // block size (sidewalk included)
  const CELL = ROAD + BLOCK;
  const SIDEWALK = 22;
  const ALLEY = 72;
  const SIZE = N * CELL + ROAD;

  const NAV = 30;        // navigation grid cell size
  const NAV_INFLATE = 17;

  const NEON = ['#ff2bd6', '#00f0ff', '#b14cff', '#39ff88', '#ffb000', '#ff4d6d', '#4d7cff'];
  const LAMP_COLORS = ['#ffb36b', '#ffb36b', '#ffb36b', '#00e5ff', '#ff3fd8'];

  const blocks = [];
  const obstacles = [];
  let navCols = 0, navRows = 0;
  let navBlocked, navDist, navQueue;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- generation

  function generate(seed) {
    const rng = mulberry32(seed);
    const pick = (arr) => arr[(rng() * arr.length) | 0];
    blocks.length = 0;
    obstacles.length = 0;

    const addBuilding = (blk, x, y, w, h) => {
      // Random setbacks for variety, while keeping alleys open.
      const j = () => (rng() < 0.5 ? 0 : rng() * 14);
      const l = j(), t = j(), r = j(), bt = j();
      if (w - l - r > 60) { x += l; w -= l + r; }
      if (h - t - bt > 60) { y += t; h -= t + bt; }
      const color = pick(NEON);
      const b = {
        kind: 'bldg', x, y, w, h, color,
        z: 0.12 + rng() * 0.24,
        win: rng() < 0.55 ? '#ffd27a' : color,
        wallFill: [U.shade(color, 0.07), U.shade(color, 0.11), U.shade(color, 0.15)],
        roof: U.shade(color, 0.09),
        details: [],
      };
      b.floors = Math.max(2, Math.round(b.z * 22));
      // Rooftop clutter, in world coordinates.
      const boxes = 1 + ((rng() * 3) | 0);
      for (let i = 0; i < boxes; i++) {
        const bw = 14 + rng() * 30, bh = 14 + rng() * 30;
        if (bw > w - 24 || bh > h - 24) continue;
        b.details.push({ t: 'box', x: x + 12 + rng() * (w - bw - 24), y: y + 12 + rng() * (h - bh - 24), w: bw, h: bh });
      }
      if (w > 150 && h > 150 && rng() < 0.3) b.details.push({ t: 'pad', x: x + w / 2, y: y + h / 2, r: Math.min(w, h) * 0.22 });
      if (rng() < 0.4) b.details.push({ t: 'sign', side: (rng() * 4) | 0 });
      if (rng() < 0.35) b.details.push({ t: 'beacon', x: x + 10 + rng() * (w - 20), y: y + 10 + rng() * (h - 20), p: rng() * 6 });
      blk.obs.push(b);
      obstacles.push(b);
    };

    for (let by = 0; by < N; by++) {
      for (let bx = 0; bx < N; bx++) {
        const x = bx * CELL + ROAD, y = by * CELL + ROAD;
        const blk = { bx, by, x, y, type: 'city', obs: [], lamps: [] };
        const ix = x + SIDEWALK, iy = y + SIDEWALK, iw = BLOCK - SIDEWALK * 2;
        const r = rng();

        if (r < 0.09) {
          blk.type = 'park';
          const trees = 4 + ((rng() * 4) | 0);
          for (let i = 0; i < trees; i++) {
            const s = 22 + rng() * 10;
            // Keep the cross-shaped paths through the park clear.
            let tx = ix + 20 + rng() * (iw - 40 - s), ty = iy + 20 + rng() * (iw - 40 - s);
            const mid = iy + iw / 2, midx = ix + iw / 2;
            if (Math.abs(tx + s / 2 - midx) < 60 || Math.abs(ty + s / 2 - mid) < 60) continue;
            const t = { kind: 'tree', x: tx, y: ty, w: s, h: s, z: 0.06 + rng() * 0.04, color: rng() < 0.5 ? '#39ff88' : '#00f0ff' };
            blk.obs.push(t);
            obstacles.push(t);
          }
        } else if (r < 0.15) {
          blk.type = 'lot';
        } else {
          const r2 = rng();
          if (r2 < 0.42) {
            addBuilding(blk, ix, iy, iw, iw);
          } else if (r2 < 0.8) {
            const s = iw * (0.35 + rng() * 0.3);
            const a = s - ALLEY / 2, b = iw - s - ALLEY / 2;
            if (rng() < 0.5) {
              addBuilding(blk, ix, iy, a, iw);
              addBuilding(blk, ix + s + ALLEY / 2, iy, b, iw);
            } else {
              addBuilding(blk, ix, iy, iw, a);
              addBuilding(blk, ix, iy + s + ALLEY / 2, iw, b);
            }
          } else {
            const sx = iw * (0.38 + rng() * 0.24), sy = iw * (0.38 + rng() * 0.24);
            const ax = sx - ALLEY / 2, bxw = iw - sx - ALLEY / 2;
            const ay = sy - ALLEY / 2, byh = iw - sy - ALLEY / 2;
            addBuilding(blk, ix, iy, ax, ay);
            addBuilding(blk, ix + sx + ALLEY / 2, iy, bxw, ay);
            addBuilding(blk, ix, iy + sy + ALLEY / 2, ax, byh);
            addBuilding(blk, ix + sx + ALLEY / 2, iy + sy + ALLEY / 2, bxw, byh);
          }
        }

        // Street lamps on the sidewalk: corners and mid-sides.
        const o = 9;
        const spots = [
          [x + o, y + o, 1], [x + BLOCK - o, y + o, 1], [x + o, y + BLOCK - o, 1], [x + BLOCK - o, y + BLOCK - o, 1],
          [x + BLOCK / 2, y + o, 0], [x + BLOCK / 2, y + BLOCK - o, 0], [x + o, y + BLOCK / 2, 0], [x + BLOCK - o, y + BLOCK / 2, 0],
        ];
        for (const [lx, ly, corner] of spots) {
          blk.lamps.push({ x: lx, y: ly, r: corner ? 130 : 95, color: pick(LAMP_COLORS), flicker: rng() < 0.04, p: rng() * 10 });
        }
        blocks.push(blk);
      }
    }
    buildNav();
  }

  // ---------------------------------------------------------------- collision

  function blockRange(a0, a1) {
    const i0 = U.clamp(Math.floor((a0 - ROAD) / CELL), 0, N - 1);
    const i1 = U.clamp(Math.floor((a1 - ROAD) / CELL), 0, N - 1);
    return [i0, i1];
  }

  function forObstaclesNear(x0, y0, x1, y1, fn) {
    const [bx0, bx1] = blockRange(x0, x1);
    const [by0, by1] = blockRange(y0, y1);
    for (let by = by0; by <= by1; by++) {
      for (let bx = bx0; bx <= bx1; bx++) {
        const obs = blocks[by * N + bx].obs;
        for (let i = 0; i < obs.length; i++) fn(obs[i]);
      }
    }
  }

  // Push a circle out of buildings and the world edge. Calls onHit(nx, ny) for
  // each contact so the caller can respond with velocity changes.
  function collideCircle(obj, r, onHit) {
    forObstaclesNear(obj.x - r, obj.y - r, obj.x + r, obj.y + r, (b) => {
      const qx = U.clamp(obj.x, b.x, b.x + b.w);
      const qy = U.clamp(obj.y, b.y, b.y + b.h);
      let dx = obj.x - qx, dy = obj.y - qy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) return;
      let nx, ny, depth;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        nx = dx / d; ny = dy / d; depth = r - d;
      } else {
        // Center is inside: leave via the nearest side.
        const l = obj.x - b.x, rt = b.x + b.w - obj.x, t = obj.y - b.y, bt = b.y + b.h - obj.y;
        const m = Math.min(l, rt, t, bt);
        if (m === l) { nx = -1; ny = 0; depth = l + r; }
        else if (m === rt) { nx = 1; ny = 0; depth = rt + r; }
        else if (m === t) { nx = 0; ny = -1; depth = t + r; }
        else { nx = 0; ny = 1; depth = bt + r; }
      }
      obj.x += nx * depth;
      obj.y += ny * depth;
      onHit(nx, ny);
    });
    if (obj.x < r) { obj.x = r; onHit(1, 0); }
    if (obj.y < r) { obj.y = r; onHit(0, 1); }
    if (obj.x > SIZE - r) { obj.x = SIZE - r; onHit(-1, 0); }
    if (obj.y > SIZE - r) { obj.y = SIZE - r; onHit(0, -1); }
  }

  // ---------------------------------------------------------------- navigation

  function buildNav() {
    navCols = Math.ceil(SIZE / NAV);
    navRows = Math.ceil(SIZE / NAV);
    const n = navCols * navRows;
    navBlocked = new Uint8Array(n);
    navDist = new Int32Array(n).fill(-1);
    navQueue = new Int32Array(n);
    for (let cy = 0; cy < navRows; cy++) {
      for (let cx = 0; cx < navCols; cx++) {
        const x = (cx + 0.5) * NAV, y = (cy + 0.5) * NAV;
        if (x < NAV_INFLATE || y < NAV_INFLATE || x > SIZE - NAV_INFLATE || y > SIZE - NAV_INFLATE) {
          navBlocked[cy * navCols + cx] = 1;
        }
      }
    }
    for (const b of obstacles) {
      const x0 = Math.max(0, Math.floor((b.x - NAV_INFLATE) / NAV - 0.5));
      const x1 = Math.min(navCols - 1, Math.ceil((b.x + b.w + NAV_INFLATE) / NAV));
      const y0 = Math.max(0, Math.floor((b.y - NAV_INFLATE) / NAV - 0.5));
      const y1 = Math.min(navRows - 1, Math.ceil((b.y + b.h + NAV_INFLATE) / NAV));
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const x = (cx + 0.5) * NAV, y = (cy + 0.5) * NAV;
          if (x > b.x - NAV_INFLATE && x < b.x + b.w + NAV_INFLATE && y > b.y - NAV_INFLATE && y < b.y + b.h + NAV_INFLATE) {
            navBlocked[cy * navCols + cx] = 1;
          }
        }
      }
    }
  }

  function cellAt(x, y) {
    const cx = U.clamp(Math.floor(x / NAV), 0, navCols - 1);
    const cy = U.clamp(Math.floor(y / NAV), 0, navRows - 1);
    return cy * navCols + cx;
  }

  function isFree(x, y) {
    return x > 0 && y > 0 && x < SIZE && y < SIZE && !navBlocked[cellAt(x, y)];
  }

  // Nearest free cell to c (small ring search), or -1.
  function nearestFree(c, useDist) {
    const cx = c % navCols, cy = (c / navCols) | 0;
    for (let rad = 1; rad <= 3; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= navCols || y >= navRows) continue;
          const i = y * navCols + x;
          if (!navBlocked[i] && (!useDist || navDist[i] >= 0)) return i;
        }
      }
    }
    return -1;
  }

  // BFS distance field from the target; every police car shares it.
  function computeFlow(x, y) {
    let start = cellAt(x, y);
    if (navBlocked[start]) start = nearestFree(start, false);
    navDist.fill(-1);
    if (start < 0) return;
    let head = 0, tail = 0;
    navQueue[tail++] = start;
    navDist[start] = 0;
    while (head < tail) {
      const c = navQueue[head++];
      const d = navDist[c] + 1;
      const cx = c % navCols;
      if (cx > 0 && !navBlocked[c - 1] && navDist[c - 1] < 0) { navDist[c - 1] = d; navQueue[tail++] = c - 1; }
      if (cx < navCols - 1 && !navBlocked[c + 1] && navDist[c + 1] < 0) { navDist[c + 1] = d; navQueue[tail++] = c + 1; }
      if (c >= navCols && !navBlocked[c - navCols] && navDist[c - navCols] < 0) { navDist[c - navCols] = d; navQueue[tail++] = c - navCols; }
      if (c + navCols < navDist.length && !navBlocked[c + navCols] && navDist[c + navCols] < 0) { navDist[c + navCols] = d; navQueue[tail++] = c + navCols; }
    }
  }

  function bestNeighbor(c) {
    const cx = c % navCols, cy = (c / navCols) | 0;
    let best = -1;
    let bestD = navDist[c] >= 0 ? navDist[c] : 1e9;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= navCols || y >= navRows) continue;
        const i = y * navCols + x;
        const d = navDist[i];
        if (d < 0) continue;
        // No corner cutting on diagonals.
        if (dx && dy && (navBlocked[cy * navCols + x] || navBlocked[y * navCols + cx])) continue;
        const score = d + (dx && dy ? 0.4 : 0);
        if (score < bestD) { bestD = score; best = i; }
      }
    }
    return best;
  }

  // Point a few cells along the shortest path towards the flow target.
  function waypoint(x, y, steps, out) {
    let c = cellAt(x, y);
    if (navDist[c] < 0) {
      const f = nearestFree(c, true);
      if (f >= 0) c = f;
    }
    for (let s = 0; s < steps; s++) {
      const n = bestNeighbor(c);
      if (n < 0) break;
      c = n;
    }
    out.x = ((c % navCols) + 0.5) * NAV;
    out.y = (((c / navCols) | 0) + 0.5) * NAV;
    out.d = navDist[c];
    return out;
  }

  function pathDistance(x, y) {
    const d = navDist[cellAt(x, y)];
    return d < 0 ? Infinity : d * NAV;
  }

  function lineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const steps = Math.ceil(Math.hypot(dx, dy) / 18);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (navBlocked[cellAt(x0 + dx * t, y0 + dy * t)]) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- rendering

  function visibleBlocks(v, fn) {
    const [bx0, bx1] = blockRange(v.x0 - 200, v.x1 + 200);
    const [by0, by1] = blockRange(v.y0 - 200, v.y1 + 200);
    for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) fn(blocks[by * N + bx]);
  }

  function drawGround(ctx, v, time) {
    // Void beyond the city edge, then asphalt.
    ctx.fillStyle = '#020106';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    const gx0 = Math.max(0, v.x0), gy0 = Math.max(0, v.y0);
    const gx1 = Math.min(SIZE, v.x1), gy1 = Math.min(SIZE, v.y1);
    ctx.fillStyle = '#0b0a15';
    ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);

    // Road markings, batched into a few paths.
    const r0 = U.clamp(Math.floor(v.x0 / CELL), 0, N), r1 = U.clamp(Math.floor(v.x1 / CELL), 0, N);
    const c0 = U.clamp(Math.floor(v.y0 / CELL), 0, N), c1 = U.clamp(Math.floor(v.y1 / CELL), 0, N);
    const center = new Path2D(), lanes = new Path2D(), cross = new Path2D();
    const segs = (fixed0, fixed1, vertical) => {
      for (let i = fixed0; i <= fixed1; i++) {
        const c = i * CELL + ROAD / 2;
        for (let k = 0; k < N; k++) {
          const a = k * CELL + ROAD, b = (k + 1) * CELL;
          const lo = vertical ? v.y0 : v.x0, hi = vertical ? v.y1 : v.x1;
          if (b < lo || a > hi) continue;
          const line = (off, p) => {
            if (vertical) { p.moveTo(c + off, a + 30); p.lineTo(c + off, b - 30); }
            else { p.moveTo(a + 30, c + off); p.lineTo(b - 30, c + off); }
          };
          line(-3, center); line(3, center);
          line(-45, lanes); line(45, lanes);
          // Crosswalk stripes at both ends.
          for (let s = -ROAD / 2 + 12; s < ROAD / 2 - 12; s += 18) {
            if (vertical) { cross.rect(c + s, a + 4, 9, 18); cross.rect(c + s, b - 22, 9, 18); }
            else { cross.rect(a + 4, c + s, 18, 9); cross.rect(b - 22, c + s, 18, 9); }
          }
        }
      }
    };
    segs(r0, r1, true);
    segs(c0, c1, false);
    ctx.fillStyle = 'rgba(200,210,255,0.07)';
    ctx.fill(cross);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,190,60,0.55)';
    ctx.stroke(center);
    ctx.setLineDash([26, 26]);
    ctx.strokeStyle = 'rgba(190,200,255,0.22)';
    ctx.stroke(lanes);
    ctx.setLineDash([]);

    // Blocks: sidewalks, curbs, lots and parks.
    const curbs = new Path2D();
    visibleBlocks(v, (blk) => {
      const { x, y } = blk;
      ctx.fillStyle = '#15132a';
      ctx.fillRect(x, y, BLOCK, BLOCK);
      curbs.rect(x, y, BLOCK, BLOCK);
      const ix = x + SIDEWALK, iy = y + SIDEWALK, iw = BLOCK - SIDEWALK * 2;
      if (blk.type === 'park') {
        ctx.fillStyle = '#05170f';
        ctx.fillRect(ix, iy, iw, iw);
        ctx.fillStyle = '#121a20';
        ctx.fillRect(ix, iy + iw / 2 - 26, iw, 52);
        ctx.fillRect(ix + iw / 2 - 26, iy, 52, iw);
        ctx.strokeStyle = 'rgba(57,255,136,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ix + 4, iy + 4, iw - 8, iw - 8);
      } else if (blk.type === 'lot') {
        ctx.fillStyle = '#0f0e1c';
        ctx.fillRect(ix, iy, iw, iw);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = 0; k < 9; k++) {
          const px = ix + 20 + k * ((iw - 40) / 8);
          ctx.moveTo(px, iy + 16); ctx.lineTo(px, iy + 76);
          ctx.moveTo(px, iy + iw - 16); ctx.lineTo(px, iy + iw - 76);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,240,255,0.35)';
        ctx.font = 'bold 54px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', ix + iw / 2, iy + iw / 2);
      } else {
        ctx.fillStyle = '#0c0b17';
        ctx.fillRect(ix, iy, iw, iw);
      }
      // Soft contact shadows under buildings.
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      for (const b of blk.obs) if (b.kind === 'bldg') ctx.fillRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
    });

    // Glowing curbs.
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(0,200,255,0.07)';
    ctx.lineWidth = 10;
    ctx.stroke(curbs);
    ctx.strokeStyle = 'rgba(80,220,255,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke(curbs);
    ctx.strokeStyle = 'rgba(255,43,214,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, SIZE, SIZE);

    // Street lights.
    visibleBlocks(v, (blk) => {
      for (const l of blk.lamps) {
        let a = 0.32;
        if (l.flicker) a *= Math.sin(time * 23 + l.p) > -0.2 ? (Math.sin(time * 3 + l.p) > 0.6 ? 0.25 : 1) : 0.1;
        Glow.draw(ctx, l.color, l.x, l.y, l.r, l.r, a);
        Glow.draw(ctx, '#ffffff', l.x, l.y, 9, 9, a * 2.2);
      }
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawWall(ctx, ax, ay, bx, by, AX, AY, BX, BY, b, fillIdx) {
    ctx.fillStyle = b.wallFill[fillIdx];
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(BX, BY); ctx.lineTo(AX, AY);
    ctx.closePath();
    ctx.fill();
    // Lit window rows.
    ctx.beginPath();
    for (let k = 1; k <= b.floors; k++) {
      const t = k / (b.floors + 1);
      ctx.moveTo(ax + (AX - ax) * t, ay + (AY - ay) * t);
      ctx.lineTo(bx + (BX - bx) * t, by + (BY - by) * t);
    }
    ctx.stroke();
  }

  function drawBuilding(ctx, b, cx, cy, time) {
    const s = 1 + b.z;
    const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;

    if (b.kind === 'tree') {
      const mx = x0 + b.w / 2, my = y0 + b.h / 2;
      const X = cx + (mx - cx) * s, Y = cy + (my - cy) * s, R = b.w * 0.75 * s;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.arc(mx + 4, my + 4, b.w * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b2a1d';
      ctx.beginPath(); ctx.arc(X, Y, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = U.rgba(b.color, 0.75);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = U.rgba(b.color, 0.25);
      ctx.beginPath(); ctx.arc(X - R * 0.25, Y - R * 0.25, R * 0.45, 0, Math.PI * 2); ctx.fill();
      return;
    }

    const X0 = cx + (x0 - cx) * s, Y0 = cy + (y0 - cy) * s;
    const X1 = cx + (x1 - cx) * s, Y1 = cy + (y1 - cy) * s;

    ctx.strokeStyle = U.rgba(b.win, 0.5);
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 9]);
    if (cy < y0) drawWall(ctx, x0, y0, x1, y0, X0, Y0, X1, Y0, b, 0);
    if (cy > y1) drawWall(ctx, x0, y1, x1, y1, X0, Y1, X1, Y1, b, 2);
    if (cx < x0) drawWall(ctx, x0, y0, x0, y1, X0, Y0, X0, Y1, b, 1);
    if (cx > x1) drawWall(ctx, x1, y0, x1, y1, X1, Y0, X1, Y1, b, 1);
    ctx.setLineDash([]);

    // Neon vertical corner edges.
    ctx.strokeStyle = U.rgba(b.color, 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(X0, Y0);
    ctx.moveTo(x1, y0); ctx.lineTo(X1, Y0);
    ctx.moveTo(x0, y1); ctx.lineTo(X0, Y1);
    ctx.moveTo(x1, y1); ctx.lineTo(X1, Y1);
    ctx.stroke();

    // Roof (details drawn in base coordinates, then projected by a transform).
    ctx.fillStyle = b.roof;
    ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    ctx.save();
    ctx.translate(cx * (1 - s), cy * (1 - s));
    ctx.scale(s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0 + 8, y0 + 8, b.w - 16, b.h - 16);
    for (const d of b.details) {
      if (d.t === 'box') {
        ctx.fillStyle = 'rgba(40,36,70,0.9)';
        ctx.fillRect(d.x, d.y, d.w, d.h);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.strokeRect(d.x, d.y, d.w, d.h);
      } else if (d.t === 'pad') {
        ctx.strokeStyle = U.rgba(b.color, 0.7);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = U.rgba(b.color, 0.7);
        ctx.font = `bold ${d.r}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', d.x, d.y + 2);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const d of b.details) {
      if (d.t === 'sign') {
        ctx.fillStyle = U.rgba(b.color, 0.85);
        const m = 10, th = 6;
        if (d.side === 0) ctx.fillRect(x0 + m, y0 + m, b.w - m * 2, th);
        else if (d.side === 1) ctx.fillRect(x0 + m, y1 - m - th, b.w - m * 2, th);
        else if (d.side === 2) ctx.fillRect(x0 + m, y0 + m, th, b.h - m * 2);
        else ctx.fillRect(x1 - m - th, y0 + m, th, b.h - m * 2);
      } else if (d.t === 'beacon' && Math.sin(time * 3 + d.p) > 0.4) {
        Glow.draw(ctx, '#ff2040', d.x, d.y, 26, 26, 0.9);
      }
    }
    ctx.globalAlpha = 1;
    // Neon roof outline with a soft glow.
    ctx.strokeStyle = U.rgba(b.color, 0.16);
    ctx.lineWidth = 10;
    ctx.strokeRect(x0, y0, b.w, b.h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2.2;
    ctx.strokeRect(x0, y0, b.w, b.h);
    ctx.restore();
  }

  const _vis = [];
  function drawBuildings(ctx, v, cx, cy, time) {
    _vis.length = 0;
    visibleBlocks(v, (blk) => {
      for (const b of blk.obs) {
        if (b.x > v.x1 || b.x + b.w < v.x0 || b.y > v.y1 || b.y + b.h < v.y0) continue;
        const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy;
        b._d = dx * dx + dy * dy;
        _vis.push(b);
      }
    });
    _vis.sort((a, b) => b._d - a._d);
    for (const b of _vis) drawBuilding(ctx, b, cx, cy, time);
  }

  function renderMinimap(px) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    const k = px / SIZE;
    g.fillStyle = '#120f22';
    g.fillRect(0, 0, px, px);
    for (const blk of blocks) {
      g.fillStyle = blk.type === 'park' ? '#0b3324' : blk.type === 'lot' ? '#1c1a33' : '#221e3d';
      g.fillRect(blk.x * k, blk.y * k, BLOCK * k, BLOCK * k);
      for (const b of blk.obs) {
        if (b.kind !== 'bldg') continue;
        g.fillStyle = U.shade(b.color, 0.35);
        g.fillRect(b.x * k, b.y * k, b.w * k, b.h * k);
      }
    }
    return c;
  }

  // A free spot on a road intersection near the middle of town.
  function centerSpawn() {
    const i = N >> 1;
    return { x: i * CELL + ROAD / 2, y: i * CELL + ROAD / 2 };
  }

  return {
    N, ROAD, BLOCK, CELL, SIZE, NAV,
    generate, collideCircle, computeFlow, waypoint, pathDistance, lineOfSight, isFree,
    drawGround, drawBuildings, renderMinimap, centerSpawn,
    get blocks() { return blocks; },
  };
})();
