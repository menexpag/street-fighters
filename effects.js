/* =====================================================
   effects.js — Sistema de efectos visuales
   Partículas, screen-shake, trails, flash de impacto,
   efectos de fuego y electricidad al estilo arcade.
   ===================================================== */

const Effects = (() => {

  // ── Pool de partículas ───────────────────────────────
  let particles = [];

  // ── Screen Shake ─────────────────────────────────────
  let shakeIntensity = 0;
  let shakeDuration  = 0;
  let shakeX = 0, shakeY = 0;

  // ── Flash de impacto ─────────────────────────────────
  let flashAlpha    = 0;
  let flashColor    = '#ffffff';
  let flashDuration = 0;

  // ── Actualizar todos los efectos ─────────────────────
  function update(dt) {
    // Partículas
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x   += p.vx * dt;
      p.y   += p.vy * dt;
      p.vy  += 400 * dt;           // gravedad leve en partículas
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.size  = p.baseSize * p.alpha;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Screen shake
    if (shakeDuration > 0) {
      shakeDuration -= dt;
      shakeX = (Math.random() * 2 - 1) * shakeIntensity;
      shakeY = (Math.random() * 2 - 1) * shakeIntensity;
      shakeIntensity = Math.max(0, shakeIntensity - dt * 60);
    } else {
      shakeX = 0; shakeY = 0;
    }

    // Flash
    if (flashDuration > 0) {
      flashDuration -= dt;
      flashAlpha = Math.max(0, flashDuration * 8);
    }
  }

  // ── Dibujar efectos DETRÁS de los personajes ─────────
  function drawBackground(ctx) {
    // Nada atrás por ahora
  }

  // ── Dibujar efectos DELANTE de los personajes ────────
  function drawForeground(ctx) {
    // Partículas
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      if (p.glow) {
        ctx.shadowBlur  = 12;
        ctx.shadowColor = p.color;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Flash global
    if (flashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.7, flashAlpha);
      ctx.fillStyle   = flashColor;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
  }

  // ── Getters para screen shake ─────────────────────────
  function getShake() { return { x: shakeX, y: shakeY }; }

  // ── Disparadores de efectos específicos ──────────────

  // Impacto de golpe débil
  function spawnHitSpark(x, y, color = '#ffffff') {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 120;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        color,
        baseSize: 3 + Math.random() * 3,
        size: 4,
        life: 0.25 + Math.random() * 0.15,
        maxLife: 0.3,
        alpha: 1,
        glow: true,
      });
    }
  }

  // Impacto fuerte con más partículas
  function spawnHeavyHitSpark(x, y, color = '#ff8c00') {
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 200;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        color: Math.random() > 0.5 ? color : '#ffffff',
        baseSize: 4 + Math.random() * 5,
        size: 5,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.45,
        alpha: 1,
        glow: true,
      });
    }
    triggerScreenShake(5, 0.18);
    triggerFlash('#ffffff', 0.08);
  }

  // Explosión de fuego
  function spawnFireExplosion(x, y) {
    const colors = ['#ff4a00', '#ff8c00', '#ffd700', '#ff2200'];
    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 / 30) * i + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 260;
      particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        color: colors[Math.floor(Math.random() * colors.length)],
        baseSize: 5 + Math.random() * 8,
        size: 6,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.7,
        alpha: 1,
        glow: true,
      });
    }
    triggerScreenShake(8, 0.25);
    triggerFlash('#ff4a00', 0.12);
  }

  // Arco eléctrico — partículas que zigzaguean
  function spawnElectricBurst(x, y) {
    const colors = ['#00cfff', '#7affff', '#ffffff', '#a0f0ff'];
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 280;
      particles.push({
        x: x + (Math.random() - 0.5) * 15,
        y: y + (Math.random() - 0.5) * 15,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.sin(angle) * speed - 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        baseSize: 2 + Math.random() * 5,
        size: 3,
        life: 0.2 + Math.random() * 0.35,
        maxLife: 0.45,
        alpha: 1,
        glow: true,
      });
    }
    triggerScreenShake(7, 0.22);
    triggerFlash('#00cfff', 0.1);
  }

  // Ultimate — maximalista
  function spawnUltimateEffect(x, y, isFireChar) {
    const color1 = isFireChar ? '#ff4a00' : '#00cfff';
    const color2 = isFireChar ? '#ffd700' : '#7affff';
    for (let ring = 0; ring < 3; ring++) {
      setTimeout(() => {
        for (let i = 0; i < 40; i++) {
          const angle = (Math.PI * 2 / 40) * i;
          const speed = (100 + ring * 80) + Math.random() * 80;
          particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 120,
            color: ring % 2 === 0 ? color1 : color2,
            baseSize: 6 + Math.random() * 8,
            size: 7,
            life: 0.6 + Math.random() * 0.5,
            maxLife: 0.9,
            alpha: 1,
            glow: true,
          });
        }
        triggerScreenShake(14 - ring * 3, 0.3);
        triggerFlash(color1, 0.2 - ring * 0.04);
      }, ring * 120);
    }
  }

  // Trail de dash
  function spawnDashTrail(entity, color) {
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: entity.x + entity.width / 2 + (Math.random() - 0.5) * entity.width * 0.7,
        y: entity.y + entity.height * 0.4 + Math.random() * entity.height * 0.4,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 30,
        color,
        baseSize: 4 + Math.random() * 4,
        size: 5,
        life: 0.15 + Math.random() * 0.1,
        maxLife: 0.2,
        alpha: 0.7,
        glow: true,
      });
    }
  }

  // Trigger screen shake
  function triggerScreenShake(intensity, duration) {
    if (intensity > shakeIntensity) {
      shakeIntensity = intensity;
      shakeDuration  = duration;
    }
  }

  // Trigger flash de pantalla
  function triggerFlash(color, duration) {
    flashColor    = color;
    flashDuration = duration;
    flashAlpha    = 1;
  }

  // ── API pública ──────────────────────────────────────
  return {
    update,
    drawBackground,
    drawForeground,
    getShake,
    spawnHitSpark,
    spawnHeavyHitSpark,
    spawnFireExplosion,
    spawnElectricBurst,
    spawnUltimateEffect,
    spawnDashTrail,
    triggerScreenShake,
    triggerFlash,
  };
})();
