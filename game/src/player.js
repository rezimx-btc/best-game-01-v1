// The player ship: movement with acceleration and friction, mouse-aimed weapons,
// a dash with invulnerability frames, and the upgrade multipliers a run collects.
import { FIELD, PLAYER } from './config.js';

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height - 130,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    angle: -Math.PI / 2,
    hull: PLAYER.hull,
    hullMax: PLAYER.hull,
    shield: 0,
    shieldMax: 0,
    shieldRegen: 0,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: 1,
    invulnerable: 0,
    overdrive: 0,
    novas: 1,
    // Upgrade multipliers, changed only by the between-wave upgrade cards.
    damageMul: 1,
    fireMul: 1,
    speedMul: 1,
    dashMul: 1,
    magnetMul: 1,
    streams: 1,
    alive: true,
  };
}

/** Move the ship, aim at the mouse, and fire while the button is held. */
export function updatePlayer(p, input, dt, fireBullet) {
  if (!p.alive) return;
  const axes = input.axes();
  const aim = input.aim();
  p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.dashX * PLAYER.dashSpeed;
    p.vy = p.dashY * PLAYER.dashSpeed;
  } else {
    const speed = PLAYER.speed * p.speedMul;
    p.vx += axes.x * PLAYER.accel * dt;
    p.vy += axes.y * PLAYER.accel * dt;
    const drag = Math.exp(-PLAYER.friction * dt);
    p.vx *= drag;
    p.vy *= drag;
    const v = Math.hypot(p.vx, p.vy);
    if (v > speed) {
      p.vx = (p.vx / v) * speed;
      p.vy = (p.vy / v) * speed;
    }
  }
  p.x = Math.max(p.radius, Math.min(FIELD.width - p.radius, p.x + p.vx * dt));
  p.y = Math.max(p.radius, Math.min(FIELD.height - p.radius, p.y + p.vy * dt));

  if (p.dashCooldown > 0) p.dashCooldown -= dt;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  if (p.overdrive > 0) p.overdrive -= dt;
  if (p.shieldRegen > 0 && p.shield < p.shieldMax) {
    p.shield = Math.min(p.shieldMax, p.shield + p.shieldRegen * dt);
  }

  p.fireTimer -= dt;
  if (input.firing && p.fireTimer <= 0) {
    const interval = PLAYER.fireInterval / p.fireMul / (p.overdrive > 0 ? 1.6 : 1);
    p.fireTimer = interval;
    fireBullet(p);
  }
}

/** Start a dash in the current move direction (or the aim direction when still). */
export function tryDash(p) {
  if (!p.alive || p.dashCooldown > 0 || p.dashTimer > 0) return false;
  let dx = p.vx;
  let dy = p.vy;
  if (Math.hypot(dx, dy) < 10) {
    dx = Math.cos(p.angle);
    dy = Math.sin(p.angle);
  }
  const len = Math.hypot(dx, dy);
  p.dashX = dx / len;
  p.dashY = dy / len;
  p.dashTimer = PLAYER.dashTime;
  p.dashCooldown = PLAYER.dashCooldown / p.dashMul;
  p.invulnerable = Math.max(p.invulnerable, PLAYER.dashInvulnerable);
  return true;
}

/** Damage the ship: shield absorbs first, then hull. Returns the hull damage taken. */
export function damagePlayer(p, amount) {
  if (!p.alive || p.invulnerable > 0) return 0;
  let left = amount;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, left);
    p.shield -= absorbed;
    left -= absorbed;
  }
  if (left > 0) {
    p.hull -= left;
    p.invulnerable = 0.6;
    if (p.hull <= 0) {
      p.hull = 0;
      p.alive = false;
    }
  }
  return left;
}
