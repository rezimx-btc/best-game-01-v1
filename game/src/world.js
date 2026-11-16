// The simulation: one state object, advanced in fixed 1/60 s steps. It knows nothing
// about the DOM or the canvas — the renderer only reads it — so the same code runs in
// the browser and in a headless test.
import {
  BETWEEN_WAVES, COMBO, ENEMY, FIELD, PICKUP, PLAYER, POOL, UPGRADES, WAVE, WAVES,
} from './config.js';
import { createPlayer, damagePlayer, tryDash, updatePlayer } from './player.js';
import { makeEnemy, pickType, spawnPoint, updateEnemy } from './enemies.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_UPGRADE = 'upgrade';
export const PHASE_OVER = 'over';
export const PHASE_VICTORY = 'victory';

export function createWorld(random, audio) {
  const state = {
    phase: PHASE_TITLE,
    random,
    audio,
    time: 0,
    wave: 0,
    score: 0,
    best: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 0,
    comboTimer: 0,
    comboMul: 1,
    spawnQueue: 0,
    spawnTimer: 0,
    betweenTimer: 0,
    upgradeChoices: [],
    boss: null,
    shake: 0,
    flashRed: 0,
    novaFlash: 0,
    player: createPlayer(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    texts: [],
    gems: [],
    pickups: [],
    stars: [],
  };
  for (let i = 0; i < 130; i++) {
    state.stars.push({
      x: random.range(0, FIELD.width),
      y: random.range(0, FIELD.height),
      z: random.pick([0.25, 0.5, 1]),
      r: random.range(0.6, 1.8),
      tw: random.range(0, Math.PI * 2),
    });
  }
  return state;
}

export function resetRun(state) {
  const { random, audio, best } = state;
  const fresh = createWorld(random, audio);
  fresh.best = best;
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, fresh);
  state.phase = PHASE_PLAY;
  // Two seconds of grace at the start of a run: time to read the field.
  state.player.invulnerable = 2.0;
  startWave(state, 1);
}

function startWave(state, wave) {
  state.wave = wave;
  state.betweenTimer = 0;
  const isBoss = wave === 5 || wave === 10;
  const count = WAVE.baseCount + WAVE.perWave * (wave - 1) + (isBoss ? 4 : 0);
  state.spawnQueue = count;
  state.spawnTimer = 0.6;
  if (isBoss) {
    const hpMul = 1 + WAVE.hpGrowth * (wave - 1);
    const boss = makeEnemy('boss', FIELD.width / 2, -70, wave === 10 ? hpMul * 1.6 : hpMul, 1, state.random);
    boss.y = -70;
    state.enemies.push(boss);
    state.boss = boss;
    state.audio.bossRoar();
  } else {
    state.audio.waveHorn();
  }
  addText(state, FIELD.width / 2, 300, `WAVE ${wave}`, '#ffd166', 34);
}

function offerUpgrades(state) {
  const pool = [...UPGRADES];
  const choices = [];
  while (choices.length < 3 && pool.length > 0) {
    const i = Math.floor(state.random.next() * pool.length);
    choices.push(pool.splice(i, 1)[0]);
  }
  state.upgradeChoices = choices;
  state.phase = PHASE_UPGRADE;
}

export function applyUpgrade(state, index) {
  const choice = state.upgradeChoices[index];
  if (!choice) return false;
  choice.apply(state.player);
  state.audio.upgrade();
  state.upgradeChoices = [];
  if (state.wave >= WAVES) {
    state.phase = PHASE_VICTORY;
    state.audio.victory();
    return true;
  }
  state.phase = PHASE_PLAY;
  state.betweenTimer = BETWEEN_WAVES;
  return true;
}

function addText(state, x, y, text, color, size) {
  if (state.texts.length >= POOL.texts) state.texts.shift();
  state.texts.push({ x, y, text, color, size: size || 16, life: 1 });
}

function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    if (state.particles.length >= POOL.particles) state.particles.shift();
    const a = state.random.range(0, Math.PI * 2);
    const v = state.random.range(speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: state.random.range(0.3, 0.8),
      maxLife: 0.8,
      size: state.random.range(2, 5),
      color,
    });
  }
}

function dropLoot(state, e) {
  const r = state.random;
  if (r.chance(PICKUP.hull.chance)) state.pickups.push({ kind: 'hull', x: e.x, y: e.y, t: 0 });
  else if (r.chance(PICKUP.shield.chance)) state.pickups.push({ kind: 'shield', x: e.x, y: e.y, t: 0 });
  else if (r.chance(PICKUP.overdrive.chance)) state.pickups.push({ kind: 'overdrive', x: e.x, y: e.y, t: 0 });
  else if (r.chance(PICKUP.nova.chance)) state.pickups.push({ kind: 'nova', x: e.x, y: e.y, t: 0 });
  const gems = e.type === 'boss' ? 12 : e.type === 'splitter' ? 3 : 1;
  for (let i = 0; i < gems; i++) {
    if (state.gems.length >= POOL.gems) break;
    state.gems.push({
      x: e.x + r.range(-14, 14),
      y: e.y + r.range(-14, 14),
      vx: r.range(-60, 60),
      vy: r.range(-60, 60),
      t: 0,
      value: 10,
    });
  }
}

function killEnemy(state, e) {
  e.dead = true;
  state.kills += 1;
  state.combo += 1;
  state.comboTimer = COMBO.window;
  state.comboMul = Math.min(COMBO.max, 1 + Math.floor(state.combo / 4) * COMBO.step * 4);
  const gained = Math.round(e.score * state.comboMul);
  state.score += gained;
  addText(state, e.x, e.y - 10, `+${gained}`, '#ffd166', 15);
  burst(state, e.x, e.y, e.color, e.type === 'boss' ? 60 : 16, e.type === 'boss' ? 320 : 220);
  state.audio.explode(e.type === 'boss');
  if (e.type === 'boss') {
    state.shake = 0.9;
    state.novaFlash = 0.5;
    state.boss = null;
  } else {
    state.shake = Math.max(state.shake, 0.12);
  }
  dropLoot(state, e);
  if (e.type === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const mini = makeEnemy('mini', e.x + (i === 0 ? -12 : 12), e.y, 1, 1, state.random);
      state.enemies.push(mini);
    }
  }
}

function firePlayerBullet(state, p) {
  const spread = 0.09;
  const n = p.streams;
  for (let i = 0; i < n; i++) {
    if (state.bullets.length >= POOL.bullets) return;
    const off = (i - (n - 1) / 2) * spread;
    const a = p.angle + off;
    state.bullets.push({
      x: p.x + Math.cos(p.angle) * (p.radius + 8),
      y: p.y + Math.sin(p.angle) * (p.radius + 8),
      vx: Math.cos(a) * PLAYER.bulletSpeed,
      vy: Math.sin(a) * PLAYER.bulletSpeed,
      damage: PLAYER.bulletDamage * p.damageMul,
      life: 1.1,
    });
  }
  state.shotsFired += n;
  state.audio.shoot();
}

function fireNova(state) {
  const p = state.player;
  if (p.novas <= 0 || !p.alive) return false;
  p.novas -= 1;
  state.novaFlash = 0.6;
  state.shake = 0.7;
  state.audio.nova();
  for (const b of state.enemyBullets) b.life = 0;
  state.enemyBullets.length = 0;
  for (const e of state.enemies) {
    e.hull -= 120;
    e.flash = 0.25;
    if (e.hull <= 0 && !e.dead) killEnemy(state, e);
  }
  state.enemies = state.enemies.filter((e) => !e.dead);
  return true;
}

function collide(state) {
  const p = state.player;
  // Player bullets vs enemies.
  for (const b of state.bullets) {
    if (b.life <= 0) continue;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      const rr = e.radius + 4;
      if (dx * dx + dy * dy < rr * rr) {
        b.life = 0;
        e.hull -= b.damage;
        e.flash = 0.08;
        state.shotsHit += 1;
        burst(state, b.x, b.y, '#ffe66d', 3, 120);
        state.audio.hit();
        if (e.hull <= 0) killEnemy(state, e);
        break;
      }
    }
  }
  // Enemy bullets vs player.
  if (p.alive) {
    for (const b of state.enemyBullets) {
      if (b.life <= 0) continue;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const rr = p.radius + 5;
      if (dx * dx + dy * dy < rr * rr) {
        b.life = 0;
        const taken = damagePlayer(p, 10);
        if (taken > 0) {
          state.flashRed = 0.4;
          state.shake = Math.max(state.shake, 0.25);
          state.audio.hurt();
          if (!p.alive) endRun(state, false);
        }
      }
    }
    // Enemies touching the player.
    for (const e of state.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const rr = e.radius + p.radius;
      if (dx * dx + dy * dy < rr * rr) {
        const taken = damagePlayer(p, e.damage);
        if (taken > 0) {
          state.flashRed = 0.4;
          state.shake = Math.max(state.shake, 0.3);
          state.audio.hurt();
          burst(state, p.x, p.y, '#ff4d6d', 10, 200);
          if (!p.alive) endRun(state, false);
        }
        // Push the enemy off so one touch is not a permanent overlap.
        const d = Math.hypot(dx, dy) || 1;
        e.x = p.x + (dx / d) * rr;
        e.y = p.y + (dy / d) * rr;
      }
    }
    // Gems and pickups.
    const magnet = PLAYER.magnetRadius * p.magnetMul;
    for (const g of state.gems) {
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < magnet) {
        g.vx += (dx / (d || 1)) * 900 * 0.016;
        g.vy += (dy / (d || 1)) * 900 * 0.016;
      }
      if (d < p.radius + 10) {
        g.t = -1;
        state.score += Math.round(g.value * state.comboMul);
      }
    }
    for (const pk of state.pickups) {
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy);
      if (d < magnet) {
        pk.x += (dx / (d || 1)) * 260 * 0.016;
        pk.y += (dy / (d || 1)) * 260 * 0.016;
      }
      if (d < p.radius + 14) {
        pk.t = -1;
        if (pk.kind === 'hull') {
          p.hull = Math.min(p.hullMax, p.hull + PICKUP.hull.heal);
          addText(state, p.x, p.y - 24, `+${PICKUP.hull.heal} HULL`, '#7dff9b', 15);
        } else if (pk.kind === 'shield') {
          if (p.shieldMax === 0) p.shieldMax = 40;
          p.shield = p.shieldMax;
          addText(state, p.x, p.y - 24, 'SHIELD UP', '#7db4ff', 15);
        } else if (pk.kind === 'overdrive') {
          p.overdrive = PICKUP.overdrive.seconds;
          addText(state, p.x, p.y - 24, 'OVERDRIVE!', '#ff8a5c', 16);
        } else if (pk.kind === 'nova') {
          p.novas = Math.min(3, p.novas + 1);
          addText(state, p.x, p.y - 24, '+1 NOVA', '#f5f0ff', 15);
        }
        state.audio.pickup();
      }
    }
  }
}

function endRun(state, won) {
  state.texts.length = 0; // floating "WAVE N" text must not sit on the end screen
  if (won) {
    state.phase = PHASE_VICTORY;
    state.audio.victory();
  } else {
    state.phase = PHASE_OVER;
    state.audio.defeat();
    burst(state, state.player.x, state.player.y, '#4df3ff', 50, 300);
    state.shake = 0.8;
  }
  if (state.score > state.best) state.best = state.score;
}

function waveCleared(state) {
  const bonus = WAVE.clearBonus * state.wave;
  state.score += bonus;
  addText(state, FIELD.width / 2, 330, `WAVE CLEAR  +${bonus}`, '#7dff9b', 22);
  state.audio.upgrade();
  if (state.wave >= WAVES) {
    endRun(state, true);
    return;
  }
  offerUpgrades(state);
}

/** Advance the simulation one fixed step. Input is read only while playing. */
export function stepWorld(state, input, dt) {
  state.time += dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.4);
  if (state.flashRed > 0) state.flashRed -= dt;
  if (state.novaFlash > 0) state.novaFlash -= dt;
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      state.comboMul = 1;
    }
  }
  for (const s of state.stars) s.tw += dt * 2;

  if (state.phase !== PHASE_PLAY) {
    updateAmbient(state, dt);
    return;
  }

  const p = state.player;
  const actions = input.takeActions();
  if (actions & 4) {
    if (tryDash(p)) state.audio.dash();
  }
  if (actions & 8) fireNova(state);
  updatePlayer(p, input, dt, (pl) => firePlayerBullet(state, pl));

  // Breather after an upgrade: no spawning and no wave-clear check until the
  // next wave starts, so the wave cannot clear itself twice.
  if (state.betweenTimer > 0) {
    state.betweenTimer -= dt;
    if (state.betweenTimer <= 0) startWave(state, state.wave + 1);
    updateAmbient(state, dt);
    return;
  }

  // Spawning.
  if (state.spawnQueue > 0) {
    state.spawnTimer -= dt;
    const alive = state.enemies.filter((e) => !e.dead).length;
    if (state.spawnTimer <= 0 && alive < WAVE.maxAlive) {
      state.spawnTimer = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval - state.wave * 0.05);
      state.spawnQueue -= 1;
      const type = pickType(state.wave, state.random);
      const at = spawnPoint(p, state.random);
      const hpMul = 1 + WAVE.hpGrowth * (state.wave - 1);
      const speedMul = 1 + WAVE.speedGrowth * (state.wave - 1);
      state.enemies.push(makeEnemy(type, at.x, at.y, hpMul, speedMul, state.random));
    }
  }

  // Enemies.
  for (const e of state.enemies) {
    if (e.dead) continue;
    updateEnemy(e, p, dt, (x, y, nx, ny, speed) => {
      if (state.enemyBullets.length >= POOL.enemyBullets) return;
      state.enemyBullets.push({ x, y, vx: nx * speed, vy: ny * speed, life: 4 });
    });
  }
  state.enemies = state.enemies.filter((e) => !e.dead);

  // Bullets.
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) b.life = 0;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  for (const b of state.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) b.life = 0;
  }
  state.enemyBullets = state.enemyBullets.filter((b) => b.life > 0);

  // Gems, pickups, particles, floating texts.
  for (const g of state.gems) {
    g.t += dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.vx *= 0.96;
    g.vy *= 0.96;
  }
  state.gems = state.gems.filter((g) => g.t >= 0 && g.t < 14);
  for (const pk of state.pickups) pk.t += dt;
  state.pickups = state.pickups.filter((pk) => pk.t >= 0 && pk.t < 12);
  updateAmbient(state, dt);

  collide(state);
  if (!p.alive) return;

  // Wave end: queue empty and nothing alive (and not in the post-upgrade breather).
  if (state.betweenTimer <= 0 && state.spawnQueue <= 0 && state.enemies.length === 0 && state.boss === null) {
    waveCleared(state);
  }
}

function updateAmbient(state, dt) {
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.985;
    pt.vy *= 0.985;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const t of state.texts) {
    t.y -= 34 * dt;
    t.life -= dt * 0.9;
  }
  state.texts = state.texts.filter((t) => t.life > 0);
}

export { ENEMY };
