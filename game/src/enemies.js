// Enemies: five kinds, each with its own movement and attack, plus the boss.
// Every enemy is a plain object from a pool-friendly factory; the world owns the list.
import { ENEMY, FIELD } from './config.js';

const TYPES = ['drifter', 'weaver', 'spitter', 'splitter'];

export function makeEnemy(type, x, y, hpMul, speedMul, random) {
  const base = ENEMY[type];
  return {
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: base.radius,
    hull: base.hull * hpMul,
    hullMax: base.hull * hpMul,
    speed: base.speed * speedMul,
    score: base.score,
    damage: base.damage,
    color: base.color,
    angle: 0,
    t: random.range(0, Math.PI * 2),
    fireTimer: random.range(1.2, 2.4),
    burst: 0,
    burstTimer: 0,
    flash: 0,
    dead: false,
  };
}

/** Pick a spawn point just outside the playfield, away from the player. */
export function spawnPoint(player, random) {
  const side = random.int(0, 3);
  const m = 30;
  if (side === 0) return { x: random.range(0, FIELD.width), y: -m };
  if (side === 1) return { x: random.range(0, FIELD.width), y: FIELD.height + m };
  if (side === 2) return { x: -m, y: random.range(0, FIELD.height) };
  return { x: FIELD.width + m, y: random.range(0, FIELD.height) };
}

/** Which types a wave may use: the roster grows as the run goes on. */
export function waveRoster(wave) {
  const roster = ['drifter'];
  if (wave >= 2) roster.push('weaver');
  if (wave >= 3) roster.push('spitter');
  if (wave >= 4) roster.push('splitter');
  return roster;
}

export function pickType(wave, random) {
  const roster = waveRoster(wave);
  const weights = roster.map((t) => (t === 'drifter' ? 3 : t === 'weaver' ? 2 : 1));
  let total = 0;
  for (const w of weights) total += w;
  let roll = random.next() * total;
  for (let i = 0; i < roster.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return roster[i];
  }
  return 'drifter';
}

/** Move one enemy for a step. Spitters fire orbs through the fire callback. */
export function updateEnemy(e, player, dt, fireOrb) {
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;

  if (e.type === 'drifter' || e.type === 'mini') {
    e.vx = nx * e.speed;
    e.vy = ny * e.speed;
    e.angle = Math.atan2(dy, dx);
  } else if (e.type === 'weaver') {
    const px = -ny;
    const py = nx;
    const sway = Math.sin(e.t * 4) * 0.8;
    e.vx = (nx + px * sway) * e.speed;
    e.vy = (ny + py * sway) * e.speed;
    e.angle = Math.atan2(dy, dx);
  } else if (e.type === 'spitter') {
    // Keep a firing distance: close in when far, back off when too near.
    const want = 300;
    const dir = dist > want + 40 ? 1 : dist < want - 40 ? -1 : 0;
    e.vx = nx * e.speed * dir;
    e.vy = ny * e.speed * dir;
    e.angle = Math.atan2(dy, dx);
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && dist < 560) {
      e.fireTimer = 2.2;
      fireOrb(e.x, e.y, nx, ny, 230);
    }
  } else if (e.type === 'splitter') {
    e.vx = nx * e.speed;
    e.vy = ny * e.speed;
    e.angle += dt * 1.5;
  } else if (e.type === 'boss') {
    updateBoss(e, player, dt, fireOrb);
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

/** The Ember Colossus: slow approach, radial bursts, and minion summons. */
export function updateBoss(e, player, dt, fireOrb) {
  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const want = 260;
  const dir = dist > want + 30 ? 1 : dist < want - 30 ? -1 : 0;
  e.vx = nx * e.speed * dir;
  e.vy = ny * e.speed * dir;
  e.angle = Math.atan2(dy, dx);
  e.fireTimer -= dt;
  if (e.fireTimer <= 0) {
    e.fireTimer = 3.4;
    e.burst = 10;
    e.burstTimer = 0;
  }
  if (e.burst > 0) {
    e.burstTimer -= dt;
    if (e.burstTimer <= 0) {
      e.burstTimer = 0.09;
      e.burst -= 1;
      const baseAngle = e.t * 0.7;
      const count = 8;
      for (let i = 0; i < count; i++) {
        const a = baseAngle + (i / count) * Math.PI * 2;
        fireOrb(e.x, e.y, Math.cos(a), Math.sin(a), 170);
      }
    }
  }
}

export { TYPES };
