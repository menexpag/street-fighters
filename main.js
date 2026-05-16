/* =====================================================
   main.js — Game Loop Principal
   Orquesta todos los sistemas del juego.
   Game states: MENU | SELECT | INTRO | FIGHT | KO | VICTORY
   ===================================================== */

(function() {
  'use strict';

  // ── Canvas setup ──────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  // Resolución interna del juego (estilo retro 4:3 arcade)
  const GAME_W = 800;
  const GAME_H = 480;

  // ── Escalar canvas manteniendo relación de aspecto ───
  function resizeCanvas() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const scale = Math.min(winW / GAME_W, winH / GAME_H);
    canvas.width  = GAME_W;
    canvas.height = GAME_H;
    canvas.style.width  = Math.floor(GAME_W * scale) + 'px';
    canvas.style.height = Math.floor(GAME_H * scale) + 'px';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ── Constantes del escenario ─────────────────────────
  const FLOOR_Y      = 380;
  const STAGE_LEFT   = 20;
  const STAGE_RIGHT  = 780;
  const FIGHT_TIME   = 99;    // segundos por round
  const MAX_ROUNDS   = 3;     // primer jugador en ganar 2 gana el match

  // ── Estado global del juego ───────────────────────────
  const GameState = {
    phase: 'MENU',      // MENU | SELECT | INTRO | FIGHT | KO_PAUSE | VICTORY
    debug: false,
    round: 1,
    timer: FIGHT_TIME,
    p1Wins: 0,
    p2Wins: 0,
    koTimer: 0,         // duración de pausa tras KO
    introTimer: 0,      // countdown "FIGHT!"
    victoryTimer: 0,
    roundText: '',
    roundTextTimer: 0,
    selectedChar: null, // personaje elegido por P1
    floorY:     FLOOR_Y,
    stageLeft:  STAGE_LEFT,
    stageRight: STAGE_RIGHT,
  };

  // ── Input ─────────────────────────────────────────────
  const keys = {};
  const keyDown = new Set(); // teclas recién presionadas este frame

  window.addEventListener('keydown', e => {
    if (!keys[e.code]) keyDown.add(e.code);
    keys[e.code] = true;
    // Prevenir scroll con flechas y espacio
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => {
    keys[e.code] = false;
    keyDown.delete(e.code);
  });

  // ── Personajes ────────────────────────────────────────
  let p1 = null;
  let p2 = null;

  // ── Configs de personajes ─────────────────────────────
  const CHAR_CONFIGS = {
    ignis: {
      charType:       'fire',
      name:           'IGNIS',
      primaryColor:   '#ff4a00',
      secondaryColor: '#ffd700',
      glowColor:      '#ff8c00',
      maxHP:          100,
      walkSpeed:      270,
      jumpPower:      -620,
      dashSpeed:      500,
      dmgLight:       8,
      dmgHeavy:       16,
      dmgSpecial:     22,
      dmgUltimate:    38,
    },
    volt: {
      charType:       'elec',
      name:           'VOLT',
      primaryColor:   '#00cfff',
      secondaryColor: '#7affff',
      glowColor:      '#00cfff',
      maxHP:          90,
      walkSpeed:      310,
      jumpPower:      -660,
      dashSpeed:      560,
      dmgLight:       7,
      dmgHeavy:       13,
      dmgSpecial:     19,
      dmgUltimate:    32,
    },
  };

  // ── Spawner de fighters ───────────────────────────────
  function createPlayer(charId, id, x, facingRight) {
    const cfg = { ...CHAR_CONFIGS[charId], id, x, facingRight };
    return new Fighter(cfg);
  }

  function createEnemy(charId, id, x, facingRight) {
    const cfg = { ...CHAR_CONFIGS[charId], id, x, facingRight };
    return new EnemyAI(cfg);
  }

  // ── Iniciar round ─────────────────────────────────────
  function startRound() {
    const p1CharId = GameState.selectedChar?.id ?? 'ignis';
    // Enemy siempre elige el otro personaje (variante)
    const p2CharId = p1CharId === 'ignis' ? 'volt' : 'ignis';

    p1 = createPlayer(p1CharId, 'p1', 160,  true);
    p2 = createEnemy (p2CharId, 'p2', 560, false);

    p1.opponent = p2;
    p2.opponent = p1;

    GameState.timer      = FIGHT_TIME;
    GameState.phase      = 'INTRO';
    GameState.introTimer = 2.2;
    GameState.roundText  = `ROUND ${GameState.round}`;
    GameState.roundTextTimer = 1.8;

    AudioEngine.startMusic();
  }

  // ── Reiniciar todo el match ───────────────────────────
  function resetMatch() {
    GameState.round   = 1;
    GameState.p1Wins  = 0;
    GameState.p2Wins  = 0;
    startRound();
  }

  // ── Flujo de victorias / rounds ───────────────────────
  function handleRoundEnd(winner) {
    // winner: 'p1' | 'p2' | 'draw'
    AudioEngine.stopMusic();

    if (winner === 'p1') GameState.p1Wins++;
    if (winner === 'p2') GameState.p2Wins++;

    const needed = Math.ceil(MAX_ROUNDS / 2);

    if (GameState.p1Wins >= needed || GameState.p2Wins >= needed) {
      // Match terminado → pantalla de victoria HTML
      const winnerFighter = GameState.p1Wins >= needed ? p1 : p2;
      GameState.phase = 'VICTORY';
      setTimeout(() => {
        UI.showVictory(
          winnerFighter.name,
          winnerFighter.charType,
          GameState.p1Wins,
          GameState.p2Wins,
          () => { UI.clearOverlay(); resetMatch(); },
          () => { UI.clearOverlay(); GameState.phase = 'MENU'; UI.showMainMenu(onStartGame); }
        );
      }, 1800);
    } else {
      // Siguiente round
      GameState.round++;
      setTimeout(() => { startRound(); }, 2200);
    }
  }

  // ── Detección de colisiones de combate ───────────────
  function checkCombat() {
    if (!p1 || !p2) return;

    checkAttack(p1, p2);
    checkAttack(p2, p1);

    // Separar entidades si se solapan
    Physics.separateEntities(p1, p2);
  }

  function checkAttack(attacker, defender) {
    if (!attacker.attackActive || attacker.attackHit) return;

    const atkBox = Physics.getAttackBox(attacker);
    const defBox = Physics.getHitbox(defender);

    if (!atkBox || !defBox) return;
    if (!Physics.rectsOverlap(atkBox, defBox)) return;

    // ¡Impacto!
    attacker.attackHit = true;

    const isHeavy    = attacker.state === 'heavyAttack' || attacker.state === 'ultimate';
    const isSpecial  = attacker.state === 'special' || attacker.state === 'ultimate';
    const attackerCX = attacker.x + attacker.width / 2;

    let damage       = 0;
    let knockback    = 0;

    switch (attacker.state) {
      case 'lightAttack': damage = attacker.dmgLight;   knockback = 200; break;
      case 'heavyAttack': damage = attacker.dmgHeavy;   knockback = 350; break;
      case 'airAttack':   damage = attacker.dmgLight + 2; knockback = 250; break;
      case 'special':     damage = attacker.dmgSpecial; knockback = 420; break;
      case 'ultimate':    damage = attacker.dmgUltimate; knockback = 600; break;
    }

    // Bonus de combo
    if (attacker.comboCount >= 3) damage = Math.floor(damage * 1.15);
    if (attacker.comboCount >= 5) damage = Math.floor(damage * 1.25);

    defender.takeDamage(damage, attackerCX, knockback, isHeavy);

    // Efectos especiales según tipo del atacante
    const hitX = defender.x + defender.width / 2;
    const hitY = defender.y + defender.height * 0.35;

    if (attacker.state === 'special' || attacker.state === 'ultimate') {
      if (attacker.charType === 'fire') {
        Effects.spawnFireExplosion(hitX, hitY);
      } else {
        Effects.spawnElectricBurst(hitX, hitY);
      }
    }

    // Cargar energía del atacante al golpear
    attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + damage * 0.8);
  }

  // ── Renderizado del escenario ─────────────────────────
  function drawStage(ctx) {
    // Cielo gradiente
    const skyGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
    skyGrad.addColorStop(0, '#0a0015');
    skyGrad.addColorStop(0.6, '#100025');
    skyGrad.addColorStop(1, '#1a0030');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Estrellas de fondo (generadas con seed fija)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137.5) % GAME_W);
      const sy = ((i * 89.3)  % (FLOOR_Y * 0.9));
      const ss = (i % 3 === 0) ? 2 : 1;
      ctx.fillRect(sx, sy, ss, ss);
    }

    // Edificios/montañas de fondo (silueta)
    ctx.fillStyle = '#0d001f';
    // Montañas
    const mtns = [
      {x:0,   w:200, h:180},
      {x:150, w:180, h:220},
      {x:300, w:220, h:160},
      {x:480, w:200, h:200},
      {x:620, w:180, h:170},
      {x:750, w:150, h:190},
    ];
    mtns.forEach(m => {
      ctx.beginPath();
      ctx.moveTo(m.x, FLOOR_Y);
      ctx.lineTo(m.x + m.w/2, FLOOR_Y - m.h);
      ctx.lineTo(m.x + m.w, FLOOR_Y);
      ctx.fill();
    });

    // Columnas tipo arena neon
    const colColor = 'rgba(255,100,0,0.08)';
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = colColor;
      ctx.fillRect(i * 140 + 10, FLOOR_Y - 260, 6, 260);
    }

    // Plataforma / suelo
    const floorGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, GAME_H);
    floorGrad.addColorStop(0, '#1a0a2e');
    floorGrad.addColorStop(0.3, '#0d0520');
    floorGrad.addColorStop(1, '#050010');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, FLOOR_Y, GAME_W, GAME_H - FLOOR_Y);

    // Línea de suelo neon
    const lineGrad = ctx.createLinearGradient(0, FLOOR_Y, GAME_W, FLOOR_Y);
    lineGrad.addColorStop(0,   'rgba(255,74,0,0.8)');
    lineGrad.addColorStop(0.5, 'rgba(255,100,255,0.6)');
    lineGrad.addColorStop(1,   'rgba(0,207,255,0.8)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff4a00';
    ctx.beginPath();
    ctx.moveTo(STAGE_LEFT, FLOOR_Y);
    ctx.lineTo(STAGE_RIGHT, FLOOR_Y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Reflejos neon en el suelo
    ctx.save();
    ctx.globalAlpha = 0.08;
    const refGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, GAME_H);
    refGrad.addColorStop(0, '#ff4a00');
    refGrad.addColorStop(0.5, '#cc00ff');
    refGrad.addColorStop(1, '#00cfff');
    ctx.fillStyle = refGrad;
    ctx.fillRect(STAGE_LEFT, FLOOR_Y, STAGE_RIGHT - STAGE_LEFT, GAME_H - FLOOR_Y);
    ctx.restore();

    // Panel lateral izquierdo (decoración)
    ctx.fillStyle = 'rgba(255,74,0,0.06)';
    ctx.fillRect(0, 0, STAGE_LEFT, GAME_H);
    ctx.fillStyle = 'rgba(0,207,255,0.06)';
    ctx.fillRect(STAGE_RIGHT, 0, GAME_W - STAGE_RIGHT, GAME_H);

    // Texto del juego en el fondo
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.font = 'bold 48px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('BLAZE FIGHT', GAME_W/2, FLOOR_Y - 30);
    ctx.restore();
  }

  // ── Debug overlay ─────────────────────────────────────
  let fpsBuffer = [];
  let lastFPS = 0;

  function drawDebugOverlay(ctx, dt) {
    fpsBuffer.push(1/dt);
    if (fpsBuffer.length > 30) fpsBuffer.shift();
    const fps = Math.round(fpsBuffer.reduce((a,b)=>a+b,0)/fpsBuffer.length);

    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = '#0f0';
    ctx.textAlign = 'left';
    ctx.fillText(`FPS: ${fps}`, 8, GAME_H - 30);
    if (p1) ctx.fillText(`P1: ${p1.state} | vx:${p1.vx.toFixed(0)} vy:${p1.vy.toFixed(0)}`, 8, GAME_H - 18);
    if (p2) ctx.fillText(`P2(AI): ${p2.state} | mode:${p2.aiMode}`, 8, GAME_H - 6);

    // Grid de colisiones (hitbox suelo)
    ctx.strokeStyle = 'rgba(255,255,0,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(STAGE_LEFT, FLOOR_Y);
    ctx.lineTo(STAGE_RIGHT, FLOOR_Y);
    ctx.stroke();
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════
  //   GAME LOOP PRINCIPAL
  // ══════════════════════════════════════════════════════
  let lastTime = 0;

  function gameLoop(timestamp) {
    // deltaTime en segundos, cappado a 100ms para evitar saltos
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    // ── Limpiar canvas ──
    ctx.clearRect(0, 0, GAME_W, GAME_H);

    // ── Escenario siempre visible de fondo ──
    if (GameState.phase !== 'MENU' && GameState.phase !== 'SELECT') {
      drawStage(ctx);
    }

    // ── Screen shake ──
    const shake = Effects.getShake();

    switch (GameState.phase) {

      // ─────────────────────────────────────────────────
      case 'INTRO':
        ctx.save();
        ctx.translate(shake.x, shake.y);

        Effects.update(dt);
        Effects.drawForeground(ctx);

        // Dibuja personajes estáticos durante intro
        if (p1) p1.draw(ctx, GameState.debug);
        if (p2) p2.draw(ctx, GameState.debug);

        ctx.restore();

        UI.drawHUD(ctx, p1, p2, FIGHT_TIME, GameState.round, GAME_W, GAME_H);

        // Overlay oscuro que se desvanece
        const introAlpha = Math.max(0, GameState.introTimer - 0.5) / 1.5;
        UI.drawDarkOverlay(ctx, GAME_W, GAME_H, introAlpha * 0.7);
        UI.drawRoundText(ctx, GAME_W, GAME_H, GameState.roundText, Math.min(1, 1 - (GameState.introTimer - 1.5) / 0.7));

        GameState.introTimer -= dt;
        if (GameState.introTimer <= 0) {
          GameState.phase = 'FIGHT';
          GameState.roundText = 'FIGHT!';
          GameState.roundTextTimer = 0.9;
        }
        break;

      // ─────────────────────────────────────────────────
      case 'FIGHT':
        // Actualizar efectos
        Effects.update(dt);

        // Actualizar fighters
        p1.update(dt, keys, GameState);
        p2.update(dt, keys, GameState);    // p2 es IA

        // Colisiones de combate
        checkCombat();

        // Timer de pelea
        GameState.timer -= dt;
        if (GameState.timer <= 0) {
          GameState.timer = 0;
          // Tiempo agotado: gana quien tiene más vida
          const winner = p1.hp > p2.hp ? 'p1' : (p2.hp > p1.hp ? 'p2' : 'draw');
          GameState.phase = 'KO_PAUSE';
          GameState.koTimer = 2.0;
          handleRoundEnd(winner);
        }

        // Detectar KO
        if ((p1.isDead || p2.isDead) && GameState.phase === 'FIGHT') {
          GameState.phase = 'KO_PAUSE';
          GameState.koTimer = 2.5;
          const winner = p1.isDead ? 'p2' : 'p1';
          handleRoundEnd(winner);
        }

        // Renderizado
        ctx.save();
        ctx.translate(shake.x, shake.y);

        Effects.drawBackground(ctx);
        if (p1) p1.draw(ctx, GameState.debug);
        if (p2) p2.draw(ctx, GameState.debug);
        Effects.drawForeground(ctx);

        ctx.restore();

        UI.drawHUD(ctx, p1, p2, GameState.timer, GameState.round, GAME_W, GAME_H);

        // Texto de "FIGHT!" al inicio del round
        if (GameState.roundTextTimer > 0) {
          const a = Math.min(1, GameState.roundTextTimer * 2);
          UI.drawRoundText(ctx, GAME_W, GAME_H, GameState.roundText, a);
          GameState.roundTextTimer -= dt;
        }

        if (GameState.debug) drawDebugOverlay(ctx, dt);
        break;

      // ─────────────────────────────────────────────────
      case 'KO_PAUSE':
        Effects.update(dt);

        ctx.save();
        ctx.translate(shake.x, shake.y);
        if (p1) p1.draw(ctx, GameState.debug);
        if (p2) p2.draw(ctx, GameState.debug);
        Effects.drawForeground(ctx);
        ctx.restore();

        UI.drawHUD(ctx, p1, p2, GameState.timer, GameState.round, GAME_W, GAME_H);
        UI.drawKOText(ctx, GAME_W, GAME_H, Math.min(1, GameState.koTimer));

        GameState.koTimer -= dt;
        break;

      // ─────────────────────────────────────────────────
      case 'VICTORY':
        // Pausa, la pantalla de victoria la muestra UI HTML
        Effects.update(dt);
        if (p1) p1.draw(ctx, false);
        if (p2) p2.draw(ctx, false);
        Effects.drawForeground(ctx);
        break;

      // MENU y SELECT los maneja la UI HTML — canvas vacío
      case 'MENU':
      case 'SELECT':
        // Fondo animado en el menú
        const t = timestamp * 0.0005;
        ctx.fillStyle = `hsl(${260 + Math.sin(t)*20},60%,4%)`;
        ctx.fillRect(0,0,GAME_W,GAME_H);
        // Partículas de menú
        Effects.update(dt);
        Effects.drawForeground(ctx);
        break;
    }

    requestAnimationFrame(gameLoop);
  }

  // ── Arrancar menú ─────────────────────────────────────
  function onStartGame(debugMode) {
    GameState.debug = debugMode;
    GameState.phase = 'SELECT';

    UI.showCharSelect(char => {
      GameState.selectedChar = char;
      UI.clearOverlay();
      resetMatch();
    });
  }

  // Spawn partículas de fondo en menú
  setInterval(() => {
    if (GameState.phase === 'MENU' || GameState.phase === 'SELECT') {
      Effects.spawnHitSpark(
        Math.random() * GAME_W,
        Math.random() * GAME_H * 0.8,
        Math.random() > 0.5 ? '#ff4a00' : '#00cfff'
      );
    }
  }, 300);

  // ── Iniciar ───────────────────────────────────────────
  UI.showMainMenu(onStartGame);
  requestAnimationFrame(gameLoop);

})();
