// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, upgrade, paused, and the
// end screens (game over / victory).
//
// ?seed=N fixes the random pattern. ?shot=start|play|boss|victory|over (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import {
  PHASE_OVER, PHASE_PLAY, PHASE_UPGRADE, PHASE_VICTORY,
  applyUpgrade, createWorld, resetRun, stepWorld,
} from './world.js';
import {
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY,
  createRenderer,
} from './render.js';
import { createShotWorld, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
renderer.resize();
window.addEventListener('resize', () => renderer.resize());

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

if (shot) {
  // Screenshot mode: stage the scene, paint it twice, signal readiness.
  const world = createShotWorld(seed);
  world.best = readBest();
  const scene = stageShot(shot, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  runGame();
}

function runGame() {
  const audio = createAudio();
  const input = createInput(canvas);
  const world = createWorld(createRandom(seed), audio);
  world.best = readBest();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    input.takeClick();
    resetRun(world);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Survive 10 waves.');
  }

  function endTo(screenName) {
    screen = screenName;
    input.takeClick(); // a held fire button must not instantly restart the run
    if (world.score > world.best) {
      world.best = world.score;
      saveBest(world.best);
    }
    announce(
      screenName === SCREEN_VICTORY
        ? `Victory. Score ${world.score}. Best ${world.best}.`
        : `Game over. Score ${world.score}. Best ${world.best}.`,
    );
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (actions & ACTION_CONFIRM) {
        audio.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      const digit = input.digit();
      const click = input.takeClick();
      if (digit >= 1 && digit <= 3) {
        if (applyUpgrade(world, digit - 1)) screen = world.phase === PHASE_PLAY ? SCREEN_PLAY : SCREEN_VICTORY;
      } else if (click) {
        const idx = cardAt(click.x, click.y);
        if (idx >= 0 && applyUpgrade(world, idx)) {
          screen = world.phase === PHASE_PLAY ? SCREEN_PLAY : SCREEN_VICTORY;
        }
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  /** Which upgrade card (0-2) a click lands on, or -1. Mirrors render.js's layout. */
  function cardAt(x, y) {
    const cw = 300;
    const ch = 210;
    const gap = 30;
    const total = cw * 3 + gap * 2;
    const x0 = (1280 - total) / 2;
    const y0 = 240;
    if (y < y0 || y > y0 + ch) return -1;
    for (let i = 0; i < 3; i++) {
      const cx = x0 + i * (cw + gap);
      if (x >= cx && x <= cx + cw) return i;
    }
    return -1;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
    handleActions();
    // A click on the title / end screens also starts the game.
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      const click = input.takeClick();
      if (click) {
        audio.unlock();
        startGame();
      }
    } else if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        stepWorld(world, input, STEP);
        accumulator -= STEP;
        if (world.phase === PHASE_UPGRADE) {
          screen = SCREEN_UPGRADE;
          announce('Wave clear. Choose an upgrade.');
          break;
        }
        if (world.phase === PHASE_OVER) {
          endTo(SCREEN_OVER);
          break;
        }
        if (world.phase === PHASE_VICTORY) {
          endTo(SCREEN_VICTORY);
          break;
        }
      }
    } else if (screen === SCREEN_UPGRADE) {
      // The world idles behind the upgrade cards; ambient particles still drift.
      stepWorld(world, input, 0);
    }
    renderer.draw(world, screen);
  }

  // A small read-only hook for automated play-testing: the live state, nothing more.
  window.__emberfall = {
    get screen() { return screen; },
    get phase() { return world.phase; },
    get score() { return world.score; },
    get wave() { return world.wave; },
    get hull() { return world.player.hull; },
    get enemies() { return world.enemies.length; },
    get bullets() { return world.bullets.length; },
  };

  announce('Emberfall. Hold the last light. Press Enter to play.');
  requestAnimationFrame(frame);
}
