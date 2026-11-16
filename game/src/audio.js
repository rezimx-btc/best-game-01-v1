// Synthesised sound effects, built with the Web Audio API: no audio files, no
// network. The context is created on the first user gesture (browsers block audio
// before one) and every call is guarded, so a headless run without audio never breaks.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx !== null;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  return {
    unlock() {
      ensure();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      tone(720, 0.07, 'square', 0.10, 320);
    },
    hit() {
      tone(220, 0.05, 'triangle', 0.12, 140);
    },
    explode(big) {
      noise(big ? 0.5 : 0.28, big ? 0.5 : 0.3, big ? 900 : 1400);
      tone(big ? 90 : 140, big ? 0.45 : 0.25, 'sawtooth', 0.22, 40);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.16, 990);
      tone(990, 0.12, 'sine', 0.12, 1320);
    },
    hurt() {
      tone(160, 0.18, 'sawtooth', 0.25, 60);
      noise(0.15, 0.2, 700);
    },
    dash() {
      noise(0.16, 0.16, 2400);
    },
    nova() {
      noise(0.6, 0.4, 600);
      tone(60, 0.6, 'sine', 0.3, 30);
    },
    waveHorn() {
      tone(196, 0.35, 'triangle', 0.2, 196);
      tone(294, 0.35, 'triangle', 0.16, 294);
    },
    bossRoar() {
      tone(70, 0.7, 'sawtooth', 0.3, 45);
      noise(0.6, 0.25, 500);
    },
    upgrade() {
      tone(523, 0.1, 'sine', 0.16);
      tone(659, 0.1, 'sine', 0.16);
      tone(784, 0.18, 'sine', 0.16);
    },
    click() {
      tone(880, 0.05, 'sine', 0.12);
    },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => tone(f, 0.22, 'triangle', 0.18), i * 110);
      });
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) => {
        setTimeout(() => tone(f, 0.3, 'triangle', 0.16), i * 140);
      });
    },
  };
}
