// Everything the player sees: the neon playfield, the ships, the HUD and the screens.
// It only reads the world state, never changes it.
import { FIELD, PALETTE, PLAYER, WAVES } from './config.js';
import {
  PHASE_OVER, PHASE_TITLE, PHASE_UPGRADE, PHASE_VICTORY,
} from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_UPGRADE = 'upgrade';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let nebula = null;

  function buildNebula() {
    nebula = document.createElement('canvas');
    nebula.width = FIELD.width;
    nebula.height = FIELD.height;
    const n = nebula.getContext('2d');
    n.fillStyle = PALETTE.backdrop;
    n.fillRect(0, 0, FIELD.width, FIELD.height);
    const blobs = [
      [300, 180, 420, PALETTE.nebulaA],
      [1020, 140, 380, PALETTE.nebulaB],
      [640, 620, 460, PALETTE.nebulaC],
      [1100, 600, 320, PALETTE.nebulaA],
    ];
    for (const [x, y, r, color] of blobs) {
      const g = n.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(7,10,24,0)');
      n.fillStyle = g;
      n.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function resize() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = Math.round(FIELD.width * scale);
    canvas.height = Math.round(FIELD.height * scale);
    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
  }

  function drawBackground(state) {
    if (!nebula) buildNebula();
    ctx.drawImage(nebula, 0, 0);
    // Faint grid, drifting slowly downward.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    const off = (state.time * 12) % 48;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 48) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = -48 + off; y <= FIELD.height; y += 48) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Parallax stars, twinkling.
    for (const s of state.stars) {
      const a = 0.35 + 0.4 * Math.abs(Math.sin(s.tw)) + 0.25 * s.z;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * s.z + 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function glowCircle(x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.alive) return;
    const blink = p.invulnerable > 0 && Math.floor(state.time * 18) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.dashTimer > 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(-p.dashX * 34, -p.dashY * 34, p.radius * 0.8, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    glowCircle(0, 0, 46, '#1fb6c9', 0.35);
    ctx.rotate(p.angle);
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(125,180,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, 0, TAU);
      ctx.stroke();
    }
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    glowCircle(0, 0, e.radius + 16, e.color, 0.3);
    if (e.flash > 0) ctx.fillStyle = '#ffffff';
    else ctx.fillStyle = e.color;
    ctx.strokeStyle = e.color;
    ctx.lineWidth = 2;
    ctx.rotate(e.angle);
    ctx.beginPath();
    if (e.type === 'drifter' || e.type === 'mini') {
      ctx.moveTo(e.radius, 0);
      ctx.lineTo(-e.radius * 0.8, -e.radius * 0.8);
      ctx.lineTo(-e.radius * 0.8, e.radius * 0.8);
      ctx.closePath();
    } else if (e.type === 'weaver') {
      ctx.moveTo(e.radius, 0);
      ctx.lineTo(0, -e.radius);
      ctx.lineTo(-e.radius, 0);
      ctx.lineTo(0, e.radius);
      ctx.closePath();
    } else if (e.type === 'spitter') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (e.type === 'splitter') {
      ctx.rect(-e.radius * 0.85, -e.radius * 0.85, e.radius * 1.7, e.radius * 1.7);
    } else if (e.type === 'boss') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
    ctx.fill();
    // Hull bar for tougher enemies.
    if (e.hull < e.hullMax && e.type !== 'boss') {
      ctx.rotate(-e.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-18, -e.radius - 12, 36, 5);
      ctx.fillStyle = '#ff5d73';
      ctx.fillRect(-18, -e.radius - 12, 36 * Math.max(0, e.hull / e.hullMax), 5);
    }
    ctx.restore();
  }

  function drawBullets(state) {
    ctx.fillStyle = '#ffe66d';
    for (const b of state.bullets) {
      glowCircle(b.x, b.y, 14, '#ffe66d', 0.5);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4.5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.enemyBullet;
    for (const b of state.enemyBullets) {
      glowCircle(b.x, b.y, 13, '#ff5d8f', 0.55);
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, TAU);
      ctx.fill();
    }
  }

  function drawPickups(state) {
    for (const g of state.gems) {
      const bob = Math.sin(g.t * 6) * 2;
      ctx.fillStyle = PALETTE.gem;
      ctx.save();
      ctx.translate(g.x, g.y + bob);
      ctx.rotate(g.t * 2);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    for (const pk of state.pickups) {
      const colors = { hull: '#7dff9b', shield: '#7db4ff', overdrive: '#ff8a5c', nova: '#f5f0ff' };
      const labels = { hull: '+', shield: 'S', overdrive: 'x2', nova: 'N' };
      const pulse = 1 + Math.sin(pk.t * 5) * 0.12;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(pulse, pulse);
      glowCircle(0, 0, 26, colors[pk.kind], 0.5);
      ctx.fillStyle = colors[pk.kind];
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0a0f24';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[pk.kind], 0, 0);
      ctx.restore();
    }
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
      ctx.font = `bold ${t.size}px system-ui, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function bar(x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawHud(state) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Top-left: hull + shield.
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('HULL', 24, 30);
    bar(24, 38, 220, 14, p.hull / p.hullMax, p.hull > 30 ? '#7dff9b' : '#ff4d6d', '#1a2140');
    if (p.shieldMax > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('SHIELD', 24, 74);
      bar(24, 80, 220, 10, p.shield / p.shieldMax, '#7db4ff', '#1a2140');
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`NOVA x${p.novas}  [E]`, 24, 112);
    if (p.overdrive > 0) {
      ctx.fillStyle = '#ff8a5c';
      ctx.fillText(`OVERDRIVE ${p.overdrive.toFixed(1)}s`, 24, 134);
    }
    // Top-center: wave + enemies left.
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    const left = state.spawnQueue + state.enemies.length;
    ctx.fillText(`WAVE ${state.wave} / ${WAVES}`, FIELD.width / 2, 32);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    const sub = state.phase === PHASE_UPGRADE
      ? 'CHOOSE AN UPGRADE'
      : state.phase === PHASE_OVER || state.phase === PHASE_VICTORY
        ? 'RUN COMPLETE'
        : `${left} HOSTILES LEFT`;
    ctx.fillText(sub, FIELD.width / 2, 54);
    // Boss bar.
    if (state.boss && !state.boss.dead) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#ff8a5c';
      ctx.fillText('EMBER COLOSSUS', FIELD.width / 2, 78);
      bar(FIELD.width / 2 - 190, 86, 380, 12, state.boss.hull / state.boss.hullMax, '#ff3d00', '#1a2140');
    }
    // Top-right: score + combo.
    ctx.textAlign = 'right';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`${state.score.toLocaleString('en-US')}`, FIELD.width - 24, 34);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${state.best.toLocaleString('en-US')}`, FIELD.width - 24, 56);
    if (state.comboMul > 1) {
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(`COMBO x${state.comboMul.toFixed(2).replace(/\.?0+$/, '')}`, FIELD.width - 24, 84);
    }
    // Bottom-left: dash cooldown.
    ctx.textAlign = 'left';
    const dashFrac = 1 - Math.max(0, p.dashCooldown) / (PLAYER.dashCooldown / p.dashMul);
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('DASH [SHIFT]', 24, FIELD.height - 40);
    bar(24, FIELD.height - 32, 120, 10, dashFrac, '#4df3ff', '#1a2140');
    // Bottom-right: controls reminder.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('WASD move · MOUSE aim · CLICK fire · SHIFT dash · E nova · P pause · M mute', FIELD.width - 24, FIELD.height - 20);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(10,14,34,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function drawTitle(state) {
    ctx.fillStyle = 'rgba(4,6,16,0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('EMBERFALL', FIELD.width / 2, 240);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText('Hold the last light. Survive 10 waves of the Hollow Tide.', FIELD.width / 2, 288);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('WASD move   ·   MOUSE aim   ·   HOLD CLICK to fire   ·   SHIFT dash   ·   E nova bomb', FIELD.width / 2, 340);
    ctx.fillText('Clear a wave, pick 1 of 3 upgrades, and break the Ember Colossus on waves 5 and 10.', FIELD.width / 2, 368);
    ctx.fillStyle = PALETTE.player;
    ctx.font = 'bold 22px system-ui, sans-serif';
    const blink = Math.floor(state.time * 2) % 2 === 0;
    if (blink) ctx.fillText('— CLICK OR PRESS ENTER TO IGNITE —', FIELD.width / 2, 440);
    if (state.best > 0) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText(`BEST SCORE  ${state.best.toLocaleString('en-US')}`, FIELD.width / 2, 486);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('A complete game: 10 waves, 2 bosses, upgrades, combos, pickups — and a restart.', FIELD.width / 2, 640);
  }

  function drawUpgrade(state) {
    ctx.fillStyle = 'rgba(4,6,16,0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(`WAVE ${state.wave} CLEAR`, FIELD.width / 2, 130);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Choose one upgrade — click a card or press 1, 2 or 3.', FIELD.width / 2, 170);
    const cw = 300;
    const ch = 210;
    const gap = 30;
    const total = cw * 3 + gap * 2;
    const x0 = (FIELD.width - total) / 2;
    const y0 = 240;
    state.upgradeChoices.forEach((u, i) => {
      const x = x0 + i * (cw + gap);
      panel(x, y0, cw, ch);
      ctx.fillStyle = PALETTE.player;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`[${i + 1}]`, x + cw / 2, y0 + 44);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(u.name, x + cw / 2, y0 + 92);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(u.desc, x + cw / 2, y0 + 132);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('— click to take —', x + cw / 2, y0 + 176);
    });
  }

  function drawEnd(state, victory) {
    ctx.fillStyle = 'rgba(4,6,16,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = victory ? PALETTE.gold : PALETTE.danger;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(victory ? 'THE LIGHT HOLDS' : 'THE LIGHT FADES', FIELD.width / 2, 220);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(
      victory
        ? 'The Ember Colossus is broken. All 10 waves survived.'
        : `The Hollow Tide took you on wave ${state.wave}.`,
      FIELD.width / 2, 268,
    );
    const acc = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
    const rows = [
      ['SCORE', state.score.toLocaleString('en-US')],
      ['BEST', state.best.toLocaleString('en-US')],
      ['WAVE REACHED', `${state.wave} / ${WAVES}`],
      ['KILLS', `${state.kills}`],
      ['ACCURACY', `${acc}%`],
    ];
    ctx.font = 'bold 20px system-ui, sans-serif';
    rows.forEach(([label, value], i) => {
      const y = 330 + i * 36;
      ctx.fillStyle = PALETTE.muted;
      ctx.textAlign = 'right';
      ctx.fillText(label, FIELD.width / 2 - 20, y);
      ctx.fillStyle = PALETTE.text;
      ctx.textAlign = 'left';
      ctx.fillText(value, FIELD.width / 2 + 20, y);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.player;
    ctx.font = 'bold 22px system-ui, sans-serif';
    const blink = Math.floor(state.time * 2) % 2 === 0;
    if (blink) ctx.fillText('— PRESS R OR CLICK TO FLY AGAIN —', FIELD.width / 2, 570);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4,6,16,0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('PAUSED', FIELD.width / 2, 330);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Press P or ESC to keep flying.', FIELD.width / 2, 380);
  }

  return {
    resize,
    draw(state, screen) {
      const scale = canvas.width / FIELD.width;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
      const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
      ctx.save();
      ctx.translate(shakeX, shakeY);
      drawBackground(state);
      if (screen === SCREEN_TITLE) {
        drawPlayer({ ...state, player: { ...state.player, x: FIELD.width / 2, y: 520, angle: -Math.PI / 2 } });
        drawTitle(state);
      } else {
        drawPickups(state);
        for (const e of state.enemies) drawEnemy(e);
        drawBullets(state);
        drawPlayer(state);
        drawParticles(state);
        drawHud(state);
        if (screen === SCREEN_UPGRADE) drawUpgrade(state);
        else if (screen === SCREEN_OVER) drawEnd(state, false);
        else if (screen === SCREEN_VICTORY) drawEnd(state, true);
        else if (screen === SCREEN_PAUSED) drawPaused();
      }
      ctx.restore();
      if (state.flashRed > 0) {
        ctx.fillStyle = `rgba(255,40,70,${Math.min(0.3, state.flashRed * 0.5)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      if (state.novaFlash > 0) {
        ctx.fillStyle = `rgba(245,240,255,${Math.min(0.55, state.novaFlash)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    },
  };
}
