'use strict';

// Small math / color helpers shared by every module.
const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  pick: (arr) => arr[(Math.random() * arr.length) | 0],

  // Signed shortest difference a - b, in [-PI, PI].
  angleDiff(a, b) {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },

  hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },

  // Scale a hex color's brightness, returned as an rgb() string.
  shade(hex, f, alpha = 1) {
    const [r, g, b] = U.hexToRgb(hex);
    return `rgba(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)},${alpha})`;
  },

  rgba(hex, alpha) {
    const [r, g, b] = U.hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  },

  formatTime(t) {
    const s = Math.floor(t);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },

  formatNum: (n) => Math.floor(n).toLocaleString('en-US'),
};

// Pre-rendered radial glow sprites. Drawing an image with 'lighter' compositing
// is far cheaper than shadowBlur or a fresh gradient each frame.
const Glow = (() => {
  const cache = new Map();
  const SIZE = 128;

  function get(color) {
    let c = cache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const g = c.getContext('2d');
    const [r, gr, b] = U.hexToRgb(color);
    const grad = g.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
    grad.addColorStop(0, `rgba(${r},${gr},${b},1)`);
    grad.addColorStop(0.22, `rgba(${r},${gr},${b},0.45)`);
    grad.addColorStop(0.55, `rgba(${r},${gr},${b},0.12)`);
    grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SIZE, SIZE);
    cache.set(color, c);
    return c;
  }

  // Caller is responsible for setting globalCompositeOperation = 'lighter'.
  function draw(ctx, color, x, y, rx, ry = rx, alpha = 1) {
    if (alpha <= 0.002) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(get(color), x - rx, y - ry, rx * 2, ry * 2);
  }

  return { get, draw };
})();
