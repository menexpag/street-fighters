/* =====================================================
   audio.js — Motor de audio procedural
   Genera sonidos tipo arcade con Web Audio API.
   No usa archivos externos, todo es síntesis.
   ===================================================== */

const AudioEngine = (() => {
  let ctx = null;          // AudioContext principal
  let masterGain = null;   // Volumen maestro
  let musicOsc = [];       // Osciladores de música de fondo
  let musicActive = false;

  // Inicializa el contexto (debe llamarse tras interacción del usuario)
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(ctx.destination);
  }

  // Crea un nodo de ganancia temporal con envelope ADSR simplificado
  function createEnvelope(attackT, decayT, sustainLevel, releaseT, peak = 1) {
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + attackT);
    g.gain.linearRampToValueAtTime(sustainLevel * peak, now + attackT + decayT);
    g.gain.setValueAtTime(sustainLevel * peak, now + attackT + decayT + releaseT * 0.3);
    g.gain.linearRampToValueAtTime(0, now + attackT + decayT + releaseT);
    g.connect(masterGain);
    return g;
  }

  // ── Sonidos de combate ──────────────────────────────

  // Golpe débil — "pap" corto
  function playPunch() {
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const env  = createEnvelope(0.001, 0.04, 0, 0.08, 0.6);
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
    osc.connect(env);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  // Golpe fuerte — "thud" profundo
  function playHeavyPunch() {
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const env  = createEnvelope(0.001, 0.06, 0, 0.15, 0.9);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
    osc.connect(env);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    // Ruido de impacto
    playImpactNoise(0.3);
  }

  // Ruido blanco breve para impactos
  function playImpactNoise(volume = 0.5) {
    if (!ctx) return;
    const bufSize = ctx.sampleRate * 0.05;
    const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * volume;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const env = createEnvelope(0.001, 0.02, 0, 0.03, volume);
    source.connect(env);
    source.start();
    source.stop(ctx.currentTime + 0.05);
  }

  // Bloqueo — sonido metálico
  function playBlock() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = createEnvelope(0.001, 0.1, 0.1, 0.2, 0.4);
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);
    osc.connect(env);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  // Salto — "boing" arcade
  function playJump() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = createEnvelope(0.001, 0.15, 0, 0.05, 0.3);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
    osc.connect(env);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  // Especial de fuego — woosh + crackle
  function playFireSpecial() {
    if (!ctx) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const env = createEnvelope(0.01, 0.2, 0.1, 0.3, 0.7);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80 + i * 20, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300 + i * 50, ctx.currentTime + 0.3);
        osc.connect(env);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
        playImpactNoise(0.2);
      }, i * 80);
    }
  }

  // Especial eléctrico — zap chirpy
  function playElecSpecial() {
    if (!ctx) return;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const env = createEnvelope(0.001, 0.05, 0, 0.1, 0.6);
        osc.type = 'square';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.12);
        osc.connect(env);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }, i * 60);
    }
  }

  // Ultimate — drama total
  function playUltimate() {
    if (!ctx) return;
    // Bajo profundo
    const bass = ctx.createOscillator();
    const bassEnv = createEnvelope(0.01, 0.5, 0.5, 1.0, 0.8);
    bass.type = 'sine';
    bass.frequency.setValueAtTime(55, ctx.currentTime);
    bass.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 1.5);
    bass.connect(bassEnv);
    bass.start(); bass.stop(ctx.currentTime + 1.5);
    // Chispazo
    for (let i = 0; i < 6; i++) {
      setTimeout(() => { playImpactNoise(0.5); playElecSpecial(); }, i * 150);
    }
  }

  // KO — sonido dramático descendente
  function playKO() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const env = createEnvelope(0.01, 1.0, 0.3, 1.5, 0.9);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 1.5);
    osc.connect(env);
    osc.start();
    osc.stop(ctx.currentTime + 2.5);
  }

  // ── Música de fondo procedural ──────────────────────
  // Genera un loop de música retro arcade con 3 voces

  const MUSIC_BPM = 130;
  const BEAT = 60 / MUSIC_BPM;

  // Escala pentatónica menor para sabor arcade
  const PENTATONIC = [220, 261.6, 293.7, 349.2, 392, 440, 523.3, 587.3, 698.5, 784];

  let musicTimeout = null;

  function startMusic() {
    if (!ctx || musicActive) return;
    musicActive = true;
    scheduleMusicLoop();
  }

  function stopMusic() {
    musicActive = false;
    if (musicTimeout) clearTimeout(musicTimeout);
    musicOsc.forEach(o => { try { o.stop(); } catch(e){} });
    musicOsc = [];
  }

  // Patrón de melodía (índices en PENTATONIC) — riff arcade de 16 pasos
  const MELODY = [0,2,4,5,4,2,0,7, 5,4,2,0,2,4,7,5];
  const BASS   = [0,0,5,5,4,4,2,2, 0,0,5,5,4,4,0,0];
  let step = 0;

  function scheduleMusicLoop() {
    if (!musicActive) return;
    const now = ctx.currentTime;

    // Melodía principal
    const mFreq = PENTATONIC[MELODY[step % MELODY.length]];
    const mOsc  = ctx.createOscillator();
    const mEnv  = ctx.createGain();
    mOsc.type = 'square';
    mOsc.frequency.value = mFreq * 2;
    mEnv.gain.setValueAtTime(0.08, now);
    mEnv.gain.linearRampToValueAtTime(0, now + BEAT * 0.9);
    mOsc.connect(mEnv);
    mEnv.connect(masterGain);
    mOsc.start(now);
    mOsc.stop(now + BEAT);
    musicOsc.push(mOsc);

    // Bajo
    const bFreq = PENTATONIC[BASS[step % BASS.length]];
    const bOsc  = ctx.createOscillator();
    const bEnv  = ctx.createGain();
    bOsc.type = 'sawtooth';
    bOsc.frequency.value = bFreq;
    bEnv.gain.setValueAtTime(0.06, now);
    bEnv.gain.linearRampToValueAtTime(0, now + BEAT * 0.6);
    bOsc.connect(bEnv);
    bEnv.connect(masterGain);
    bOsc.start(now);
    bOsc.stop(now + BEAT);
    musicOsc.push(bOsc);

    // Hi-hat (ruido filtrado)
    if (step % 2 === 0) {
      const bufSize = Math.floor(ctx.sampleRate * 0.04);
      const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d       = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
      const src  = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'highpass';
      filt.frequency.value = 5000;
      const hEnv = ctx.createGain();
      hEnv.gain.setValueAtTime(0.04, now);
      hEnv.gain.linearRampToValueAtTime(0, now + 0.03);
      src.connect(filt);
      filt.connect(hEnv);
      hEnv.connect(masterGain);
      src.start(now);
    }

    // Kick en tiempos 1 y 3 (pasos 0 y 8)
    if (step % 8 === 0) {
      const kOsc = ctx.createOscillator();
      const kEnv = ctx.createGain();
      kOsc.type = 'sine';
      kOsc.frequency.setValueAtTime(120, now);
      kOsc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      kEnv.gain.setValueAtTime(0.3, now);
      kEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      kOsc.connect(kEnv);
      kEnv.connect(masterGain);
      kOsc.start(now);
      kOsc.stop(now + 0.25);
    }

    step = (step + 1) % 16;
    musicTimeout = setTimeout(scheduleMusicLoop, BEAT * 1000 - 5);
  }

  // ── API pública ─────────────────────────────────────
  return {
    init,
    startMusic,
    stopMusic,
    playPunch,
    playHeavyPunch,
    playBlock,
    playJump,
    playFireSpecial,
    playElecSpecial,
    playUltimate,
    playKO,
    playImpactNoise,
  };
})();
