'use strict';

// Arcade car physics, police AI and car rendering.

const PLAYER_CFG = { maxSpeed: 560, accel: 640, brake: 950, turn: 3.4, grip: 7.5, mass: 1 };
const POLICE_CFG = { maxSpeed: 450, accel: 560, brake: 850, turn: 3.0, grip: 6.5, mass: 1.25 };

class Car {
  constructor(x, y, a, cfg, police = false) {
    this.x = x; this.y = y; this.a = a;
    this.vx = 0; this.vy = 0;
    this.cfg = cfg;
    this.maxSpeed = cfg.maxSpeed;
    this.police = police;
    this.r = 17;
    this.slip = 0;
    this.braking = false;
    this.steerVis = 0;
    this.prevWheels = null;
    this.phase = Math.random() * 10;
    // AI state
    this.stuckT = 0; this.reverseT = 0; this.losT = 0; this.los = false; this.farT = 0;
    this.speedVar = U.rand(0.95, 1.05);
    this.wp = { x: 0, y: 0, d: 0 };
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  forwardSpeed() { return this.vx * Math.cos(this.a) + this.vy * Math.sin(this.a); }

  update(dt, c) {
    const cfg = this.cfg, max = this.maxSpeed;
    let cs = Math.cos(this.a), sn = Math.sin(this.a);
    let vF = this.vx * cs + this.vy * sn;
    let vR = -this.vx * sn + this.vy * cs;

    this.braking = false;
    if (c.throttle > 0) {
      vF += cfg.accel * c.throttle * dt * (vF < 0 ? 2 : 1);
    } else if (c.throttle < 0) {
      if (vF > 15) {
        vF = Math.max(0, vF - cfg.brake * -c.throttle * dt);
        this.braking = true;
      } else {
        vF += cfg.accel * 0.6 * c.throttle * dt;
      }
    } else {
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), 110 * dt);
    }
    vF -= vF * 0.22 * dt;
    if (vF > max) vF = max + (vF - max) * Math.exp(-4 * dt);
    if (vF < -max * 0.4) vF = -max * 0.4;

    // Steering authority grows with speed and fades a little at the top end.
    const sf = U.clamp(vF / 110, -1, 1);
    const hi = 1 - 0.3 * U.clamp(Math.abs(vF) / max, 0, 1);
    this.a += c.steer * cfg.turn * (c.handbrake ? 1.4 : 1) * sf * hi * dt;

    // Lateral grip: low grip lets the car slide (handbrake drifts).
    vR *= Math.exp(-(c.handbrake ? cfg.grip * 0.16 : cfg.grip) * dt);
    if (c.handbrake) { vF -= vF * 0.8 * dt; this.braking = true; }
    this.slip = Math.abs(vR);

    cs = Math.cos(this.a); sn = Math.sin(this.a);
    this.vx = cs * vF - sn * vR;
    this.vy = sn * vF + cs * vR;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.steerVis += (c.steer - this.steerVis) * Math.min(1, dt * 10);
    this.throttle = c.throttle;
  }

  rearWheels() {
    const cs = Math.cos(this.a), sn = Math.sin(this.a);
    const bx = this.x - cs * 14, by = this.y - sn * 14;
    return [bx - sn * 9, by + cs * 9, bx + sn * 9, by - cs * 9];
  }
}

// ------------------------------------------------------------------ police AI

const PoliceAI = {
  // target: { x, y, vx, vy }. mode: 'chase' | 'hold' (stop near target after a bust).
  control(p, target, dt, lead, mode) {
    const dx = target.x - p.x, dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);
    const speed = p.speed;
    const lt = U.clamp(dist / 650, 0, 1) * lead;
    const px = target.x + target.vx * lt, py = target.y + target.vy * lt;

    p.losT -= dt;
    if (p.losT <= 0) {
      p.los = dist < 750 && City.lineOfSight(p.x, p.y, target.x, target.y);
      p.losLead = p.los && lt > 0.05 && City.lineOfSight(p.x, p.y, px, py);
      p.losT = U.rand(0.12, 0.22);
    }

    let tx, ty;
    if (p.losLead) { tx = px; ty = py; }
    else if (p.los) { tx = target.x; ty = target.y; }
    else {
      const w = City.waypoint(p.x, p.y, 5, p.wp);
      tx = w.x; ty = w.y;
    }

    const desired = Math.atan2(ty - p.y, tx - p.x);
    const diff = U.angleDiff(desired, p.a);
    const ctrl = { throttle: 1, steer: U.clamp(diff * 2.4, -1, 1), handbrake: false };

    if (Math.abs(diff) > 1.25 && speed > 250) { ctrl.throttle = 0.3; ctrl.handbrake = true; }
    else if (Math.abs(diff) > 0.65 && speed > 360) ctrl.throttle = 0.2;

    if (mode === 'hold' && dist < 140) {
      ctrl.throttle = speed > 40 ? -1 : 0;
      ctrl.handbrake = speed < 40;
      return ctrl;
    }

    // Unstick: back up while turning the nose towards the target.
    if (p.reverseT > 0) {
      p.reverseT -= dt;
      ctrl.throttle = -1;
      ctrl.steer = -(Math.sign(diff) || 1);
      ctrl.handbrake = false;
    } else {
      if (speed < 40 && dist > 70) p.stuckT += dt;
      else p.stuckT = Math.max(0, p.stuckT - dt * 2);
      if (p.stuckT > 0.6) { p.reverseT = U.rand(0.55, 0.9); p.stuckT = 0; }
    }
    return ctrl;
  },
};

// ------------------------------------------------------------------ rendering

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const CarArt = {
  // Additive light pass, drawn beneath the cars: headlights, underglow, sirens.
  drawLights(ctx, car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.a);
    Glow.draw(ctx, '#fff1c8', 120, 0, 110, 46, car.police ? 0.16 : 0.22);
    if (car.police) {
      const on = Math.sin(time * 14 + car.phase) > 0;
      Glow.draw(ctx, on ? '#ff1e3c' : '#2a5bff', 0, 0, 95, 95, 0.55);
    } else {
      Glow.draw(ctx, '#ff2bd6', 0, 0, 52, 34, 0.75);
      if (car.braking) Glow.draw(ctx, '#ff2040', -28, 0, 30, 30, 0.6);
    }
    ctx.restore();
  },

  draw(ctx, car, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.a);
    const L = 46, Wd = 24;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, -L / 2 + 3, -Wd / 2 + 4, L, Wd, 7);
    ctx.fill();

    // Wheels (front ones turn with steering)
    ctx.fillStyle = '#050508';
    ctx.fillRect(-L / 2 + 6, -Wd / 2 - 2, 10, 4);
    ctx.fillRect(-L / 2 + 6, Wd / 2 - 2, 10, 4);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(L / 2 - 11, s * (Wd / 2));
      ctx.rotate(car.steerVis * 0.45);
      ctx.fillRect(-5, -2, 10, 4);
      ctx.restore();
    }

    if (car.police) {
      roundRect(ctx, -L / 2, -Wd / 2, L, Wd, 6);
      ctx.fillStyle = '#e9ecf5';
      ctx.fill();
      ctx.fillStyle = '#0f1530';
      ctx.fillRect(-8, -Wd / 2, 20, Wd);
      ctx.fillStyle = '#9fd6ff';
      roundRect(ctx, 8, -Wd / 2 + 3, 7, Wd - 6, 2); ctx.fill();
      ctx.fillStyle = '#4a6a90';
      roundRect(ctx, -15, -Wd / 2 + 3, 6, Wd - 6, 2); ctx.fill();
      // Light bar
      const on = Math.sin(time * 14 + car.phase) > 0;
      ctx.fillStyle = on ? '#ff2b47' : '#3a0d18';
      ctx.fillRect(-3, -Wd / 2 + 2, 5, Wd / 2 - 2);
      ctx.fillStyle = on ? '#14204a' : '#3d6bff';
      ctx.fillRect(-3, 0, 5, Wd / 2 - 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(L / 2 - 3, -Wd / 2 + 3, 3, 5);
      ctx.fillRect(L / 2 - 3, Wd / 2 - 8, 3, 5);
      ctx.fillStyle = '#ff2a2a';
      ctx.fillRect(-L / 2, -Wd / 2 + 3, 2, 5);
      ctx.fillRect(-L / 2, Wd / 2 - 8, 2, 5);
      ctx.restore();
      return;
    }

    // Player: hot-pink sports car with a cyan racing stripe.
    const g = ctx.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
    g.addColorStop(0, '#ff5be3');
    g.addColorStop(0.5, '#e01ab8');
    g.addColorStop(1, '#8a0f74');
    roundRect(ctx, -L / 2, -Wd / 2, L, Wd, 8);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,245,0.9)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Stripe
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(-L / 2 + 2, -2.5, L - 4, 5);
    // Cabin glass
    ctx.fillStyle = '#1a0b2a';
    roundRect(ctx, -10, -Wd / 2 + 3.5, 22, Wd - 7, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,240,255,0.55)';
    roundRect(ctx, 5, -Wd / 2 + 4.5, 6, Wd - 9, 2);
    ctx.fill();
    // Spoiler
    ctx.fillStyle = '#5a0a4c';
    ctx.fillRect(-L / 2 - 1, -Wd / 2 + 1, 4, Wd - 2);
    // Head / tail lights
    ctx.fillStyle = '#fffbe0';
    ctx.fillRect(L / 2 - 3, -Wd / 2 + 2, 3, 6);
    ctx.fillRect(L / 2 - 3, Wd / 2 - 8, 3, 6);
    ctx.fillStyle = car.braking ? '#ff3355' : '#a01030';
    ctx.fillRect(-L / 2 + 2, -Wd / 2 + 2, 2, 6);
    ctx.fillRect(-L / 2 + 2, Wd / 2 - 8, 2, 6);
    ctx.restore();
  },
};
