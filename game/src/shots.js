// Screenshot staging: builds a fixed scene for each ?shot= name with the seeded
// world and the real renderer, then paints it twice. These are real renders of the
// game's own code, not mockups — the same draw() the live game uses.
import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { makeEnemy } from './enemies.js';
import {
  PHASE_OVER, PHASE_TITLE, PHASE_VICTORY, createWorld, resetRun, stepWorld,
} from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

/** A bot input for staged scenes: aims at the nearest enemy, strafes, fires always,
    so a staged frame shows the game mid-fight — kills, gems and particles included. */
function botInput(state, t) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  const aim = best ? { x: best.x, y: best.y } : { x: FIELD.width / 2, y: 200 };
  const dir = Math.sin(t * 1.3) > 0 ? 1 : -1;
  return {
    axes: () => ({ x: dir, y: Math.cos(t * 0.7) > 0 ? -0.4 : 0.4 }),
    aim: () => aim,
    firing: true,
    digit: () => 0,
    takeClick: () => null,
    takeActions: () => 0,
  };
}

function simulate(state, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) stepWorld(state, botInput(state, i * STEP), STEP);
}

/** Stage one named scene. Returns the screen the renderer should draw. */
export function stageShot(name, state) {
  const random = state.random;
  if (name === 'start') {
    state.phase = PHASE_TITLE;
    return { screen: SCREEN_TITLE, best: state.best };
  }
  if (name === 'play') {
    resetRun(state);
    // Fight wave 3 for a while: a busy mid-game frame with HUD, bullets and gems.
    state.wave = 3;
    state.spawnQueue = 12;
    state.score = 2840;
    state.combo = 9;
    state.comboMul = 2;
    state.comboTimer = 2.4;
    state.player.x = FIELD.width / 2;
    state.player.y = 480;
    state.player.novas = 2;
    simulate(state, 8);
    return { screen: SCREEN_PLAY, best: state.best };
  }
  if (name === 'boss') {
    resetRun(state);
    state.wave = 5;
    state.spawnQueue = 6;
    state.score = 9120;
    state.combo = 14;
    state.comboMul = 3;
    state.comboTimer = 2.8;
    state.player.x = FIELD.width / 2;
    state.player.y = 520;
    state.player.novas = 1;
    // The wave-5 boss, placed mid-arena and already firing its radial bursts.
    const boss = makeEnemy('boss', FIELD.width / 2, 210, 1.36, 1, state.random);
    boss.fireTimer = 0.4;
    state.enemies.push(boss);
    state.boss = boss;
    simulate(state, 4);
    return { screen: SCREEN_PLAY, best: state.best };
  }
  if (name === 'victory') {
    resetRun(state);
    state.texts.length = 0; // no "WAVE 1" banner behind the victory panel
    state.wave = 10;
    state.score = 24850;
    state.best = 24850;
    state.kills = 187;
    state.shotsFired = 940;
    state.shotsHit = 611;
    state.phase = PHASE_VICTORY;
    return { screen: SCREEN_VICTORY, best: state.best };
  }
  if (name === 'over') {
    resetRun(state);
    state.texts.length = 0; // no "WAVE 1" banner behind the game-over panel
    state.wave = 7;
    state.score = 12340;
    state.best = 24850;
    state.kills = 96;
    state.shotsFired = 520;
    state.shotsHit = 301;
    state.player.alive = false;
    state.player.hull = 0;
    state.phase = PHASE_OVER;
    return { screen: SCREEN_OVER, best: state.best };
  }
  return { screen: SCREEN_TITLE, best: state.best };
}

export function createShotWorld(seed) {
  return createWorld(createRandom(seed), {
    shoot() {}, hit() {}, explode() {}, pickup() {}, hurt() {}, dash() {}, nova() {},
    waveHorn() {}, bossRoar() {}, upgrade() {}, click() {}, victory() {}, defeat() {},
  });
}
