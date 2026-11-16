// EMBERFALL — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Waves in one run. Wave 5 and wave 10 end in a boss; wave 10's boss is the win. */
export const WAVES = 10;

export const PLAYER = {
  radius: 16,
  hull: 100,
  speed: 340,
  accel: 2600,
  friction: 5.2,
  fireInterval: 0.16,
  bulletSpeed: 640,
  bulletDamage: 12,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 2.4,
  dashInvulnerable: 0.35,
  magnetRadius: 90,
};

export const ENEMY = {
  drifter: { radius: 17, hull: 22, speed: 122, score: 50, damage: 12, color: '#ff4d6d' },
  weaver: { radius: 15, hull: 16, speed: 150, score: 70, damage: 10, color: '#ff9f1c' },
  spitter: { radius: 18, hull: 30, speed: 82, score: 90, damage: 10, color: '#b388ff' },
  splitter: { radius: 22, hull: 40, speed: 72, score: 110, damage: 14, color: '#2ec4b6' },
  mini: { radius: 10, hull: 8, speed: 190, score: 25, damage: 8, color: '#5eead4' },
  boss: { radius: 58, hull: 1150, speed: 46, score: 2500, damage: 22, color: '#ff3d00' },
};

/** How a wave is built: base enemies plus a per-wave growth, then the boss waves. */
export const WAVE = {
  baseCount: 6,
  perWave: 3,
  maxAlive: 14,
  spawnInterval: 0.85,
  spawnIntervalMin: 0.34,
  hpGrowth: 0.12,
  speedGrowth: 0.05,
  clearBonus: 150,
};

export const COMBO = { window: 3.0, step: 0.25, max: 8 };

export const PICKUP = {
  hull: { heal: 30, chance: 0.1 },
  shield: { amount: 40, chance: 0.08 },
  overdrive: { seconds: 8, chance: 0.08 },
  nova: { chance: 0.05 },
};

export const UPGRADES = [
  { id: 'damage', name: 'FORGED ROUNDS', desc: '+35% bullet damage', apply: (u) => { u.damageMul *= 1.35; } },
  { id: 'rapid', name: 'OVERLOCK', desc: '+25% fire rate', apply: (u) => { u.fireMul *= 1.25; } },
  { id: 'hull', name: 'REINFORCED HULL', desc: '+25 max hull, repair 40', apply: (u) => { u.hullMax += 25; u.hull = Math.min(u.hullMax, u.hull + 40); } },
  { id: 'speed', name: 'ION THRUSTERS', desc: '+15% move speed', apply: (u) => { u.speedMul *= 1.15; } },
  { id: 'dash', name: 'PHASE DASH', desc: 'Dash recharges 40% faster', apply: (u) => { u.dashMul *= 1.4; } },
  { id: 'multi', name: 'SPLIT CANNON', desc: '+1 bullet stream (max 3)', apply: (u) => { u.streams = Math.min(3, u.streams + 1); } },
  { id: 'magnet', name: 'TRACTOR WEB', desc: '+90% pickup magnet range', apply: (u) => { u.magnetMul *= 1.9; } },
  { id: 'shield', name: 'AEGIS PLATING', desc: '+50 shield, shield regens', apply: (u) => { u.shieldMax += 50; u.shield = u.shieldMax; u.shieldRegen = 4; } },
];

/** Seconds between waves, and the pause before the first wave. */
export const BETWEEN_WAVES = 3.2;

export const PALETTE = {
  backdrop: '#070a18',
  nebulaA: '#1b2a6b',
  nebulaB: '#4b1d5e',
  nebulaC: '#0d3b4d',
  grid: '#141c38',
  player: '#4df3ff',
  playerCore: '#eafcff',
  bullet: '#ffe66d',
  enemyBullet: '#ff5d8f',
  gem: '#ffd166',
  hullCell: '#7dff9b',
  shieldCell: '#7db4ff',
  overdriveCell: '#ff8a5c',
  novaCell: '#f5f0ff',
  text: '#eef2ff',
  muted: '#8b93b8',
  panel: '#101736',
  panelEdge: '#2a3566',
  danger: '#ff4d6d',
  gold: '#ffd166',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';

/** Pool sizes, allocated once at boot: no new objects in the hot loops. */
export const POOL = { bullets: 256, enemyBullets: 192, particles: 512, texts: 48, gems: 96 };
