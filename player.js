/* =====================================================
   player.js — Clase Fighter (base para jugador e IA)
   Contiene sistema de estados, animaciones procedurales,
   combate, combos e interacción con físicas y efectos.
   ===================================================== */

/* ── Definición de personajes originales ─────────────

   IGNIS — El Luchador de Fuego
   Nombre: Kael "Ignis" Vorne
   Historia: Forjado en las minas volcánicas del sur,
   Kael absorbe el calor de la tierra para combatir.
   No pelea por gloria, pelea para proteger su pueblo.
   Stats: HP 100, ATK 85, SPD 78, DEF 70

   VOLT — El Luchador Eléctrico
   Nombre: Zara "Volt" Nex
   Historia: Ex-ingeniera de reactores de plasma,
   un accidente la fundió con la red de energía de la ciudad.
   Ahora canaliza millones de voltios con precisión quirúrgica.
   Stats: HP 90, ATK 90, SPD 92, DEF 65
================================================================ */

class Fighter {
  constructor(config) {
    // ── Identidad ──
    this.id         = config.id;         // 'player' | 'enemy'
    this.charType   = config.charType;   // 'fire' | 'elec'
    this.name       = config.name;
    this.isPlayer   = config.isPlayer ?? true;

    // ── Posición y dimensiones ──
    this.x      = config.x     ?? 100;
    this.y      = config.y     ?? 200;
    this.width  = 64;
    this.height = 96;

    // ── Velocidades ──
    this.walkSpeed  = config.walkSpeed  ?? 280;
    this.jumpPower  = config.jumpPower  ?? -640;
    this.dashSpeed  = config.dashSpeed  ?? 520;

    // ── Físicas ──
    this.vx       = 0;
    this.vy       = 0;
    this.onGround = false;
    this.jumpCount = 0;
    this.maxJumps  = 1;         // sin doble salto por defecto
    this.facingRight = config.facingRight ?? true;

    // ── Vida y energía ──
    this.maxHP   = config.maxHP  ?? 100;
    this.hp      = this.maxHP;
    this.maxEnergy = 100;
    this.energy    = 50;
    this.energyRegen = 12;      // por segundo

    // ── Daños ──
    this.dmgLight   = config.dmgLight   ?? 7;
    this.dmgHeavy   = config.dmgHeavy  ?? 14;
    this.dmgSpecial = config.dmgSpecial ?? 20;
    this.dmgUltimate= config.dmgUltimate?? 35;

    // ── Colores del personaje ──
    this.primaryColor   = config.primaryColor   ?? '#ff4a00';
    this.secondaryColor = config.secondaryColor ?? '#ffd700';
    this.glowColor      = config.glowColor      ?? '#ff8c00';

    // ── Estado de máquina de estados ──
    this.state         = 'idle';      // ver lista abajo
    this.prevState     = 'idle';
    this.stateTimer    = 0;           // tiempo en estado actual (s)
    this.attackActive  = false;       // frame activo de hitbox
    this.attackHit     = false;       // ¿ya golpeamos en este ataque?
    this.comboCount    = 0;
    this.comboTimer    = 0;
    this.comboWindow   = 0.6;         // ventana para encadenar combo

    // ── Invulnerabilidad / stun ──
    this.invulTimer  = 0;
    this.hitstunTimer= 0;
    this.isBlocking  = false;
    this.isDead      = false;

    // ── Dash ──
    this.dashTimer   = 0;
    this.dashCooldown= 0;

    // ── Animación ──
    this.animFrame    = 0;
    this.animTimer    = 0;
    this.animFPS      = 8;           // frames por segundo de animación
    this.totalFrames  = 4;           // frames por estado por defecto

    // ── Historial de entradas (para combos) ──
    this.inputBuffer = [];

    // ── Referencia al oponente (se asigna externamente) ──
    this.opponent = null;
  }

  // ══════════════════════════════════════════════════════
  //   CAMBIO DE ESTADO
  // ══════════════════════════════════════════════════════
  // Lista de estados: idle, walk, crouch, jump, fall, 
  //   lightAttack, heavyAttack, airAttack,
  //   block, hurt, ko, dash,
  //   special, ultimate
  
  setState(newState, force = false) {
    // No interrumpir estados de alta prioridad salvo fuerza
    const locked = ['hurt','ko','ultimate'];
    if (!force && locked.includes(this.state) && this.stateTimer < this.getStateDuration()) return;
    if (this.state === newState && !force) return;

    this.prevState  = this.state;
    this.state      = newState;
    this.stateTimer = 0;
    this.animFrame  = 0;
    this.animTimer  = 0;
    this.attackActive = false;
    this.attackHit    = false;

    // Frames y velocidades por estado
    switch (newState) {
      case 'idle':        this.totalFrames = 4; this.animFPS = 6; break;
      case 'walk':        this.totalFrames = 6; this.animFPS = 10; break;
      case 'crouch':      this.totalFrames = 2; this.animFPS = 4; break;
      case 'jump':        this.totalFrames = 3; this.animFPS = 8; break;
      case 'fall':        this.totalFrames = 2; this.animFPS = 6; break;
      case 'lightAttack': this.totalFrames = 4; this.animFPS = 14; break;
      case 'heavyAttack': this.totalFrames = 5; this.animFPS = 10; break;
      case 'airAttack':   this.totalFrames = 3; this.animFPS = 12; break;
      case 'block':       this.totalFrames = 2; this.animFPS = 5; break;
      case 'hurt':        this.totalFrames = 3; this.animFPS = 10; break;
      case 'ko':          this.totalFrames = 5; this.animFPS = 6; break;
      case 'dash':        this.totalFrames = 3; this.animFPS = 16; break;
      case 'special':     this.totalFrames = 6; this.animFPS = 12; break;
      case 'ultimate':    this.totalFrames = 8; this.animFPS = 9; break;
    }
  }

  // Duración total de cada estado en segundos
  getStateDuration() {
    const dur = {
      idle: 99, walk: 99, crouch: 99, fall: 99,
      jump: 0.5,
      lightAttack: 0.28,
      heavyAttack: 0.45,
      airAttack:   0.32,
      block:       99,
      hurt:        0.35,
      ko:          2.5,
      dash:        0.18,
      special:     0.55,
      ultimate:    1.1,
    };
    return dur[this.state] ?? 0.3;
  }

  // Frame activo donde la hitbox está encendida (para ataque)
  getAttackActiveFrame() {
    const frames = {
      lightAttack: 1,
      heavyAttack: 2,
      airAttack:   1,
      special:     3,
      ultimate:    4,
    };
    return frames[this.state] ?? -1;
  }

  // ══════════════════════════════════════════════════════
  //   UPDATE PRINCIPAL
  // ══════════════════════════════════════════════════════
  update(dt, keys, gameState) {
    if (this.isDead) return;

    // ── Timers ──
    this.stateTimer  += dt;
    this.animTimer   += dt;
    this.invulTimer   = Math.max(0, this.invulTimer   - dt);
    this.hitstunTimer = Math.max(0, this.hitstunTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.comboTimer   = Math.max(0, this.comboTimer   - dt);
    if (this.comboTimer <= 0) this.comboCount = 0;

    // Regenerar energía pasivamente
    if (this.state !== 'ultimate' && this.state !== 'special') {
      this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen * dt);
    }

    // ── Animación ──
    if (this.animTimer >= 1 / this.animFPS) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % this.totalFrames;

      // Activar hitbox en frame correcto
      const activeFrame = this.getAttackActiveFrame();
      if (activeFrame >= 0 && this.animFrame === activeFrame) {
        this.attackActive = true;
      } else if (this.animFrame !== activeFrame) {
        this.attackActive = false;
      }
    }

    // ── Transición de estados automática ──
    this.autoStateTransition(dt);

    // ── Input (solo si no está en hitstun / ko) ──
    if (this.isPlayer && this.hitstunTimer <= 0 && this.state !== 'ko' && this.state !== 'ultimate') {
      this.handleInput(keys, dt);
    }

    // ── Físicas ──
    Physics.applyGravity(this, dt);
    Physics.moveEntity(this, dt, gameState.floorY, gameState.stageLeft, gameState.stageRight);

    // ── Actualizar facing ──
    if (this.opponent && this.state === 'idle' || this.state === 'walk' || this.state === 'crouch') {
      const oppCenter = this.opponent.x + this.opponent.width / 2;
      const myCenter  = this.x + this.width / 2;
      this.facingRight = oppCenter > myCenter;
    }

    // ── Dash trail ──
    if (this.state === 'dash') {
      Effects.spawnDashTrail(this, this.primaryColor);
    }

    // ── Estado jump/fall ──
    if (!this.onGround && this.state !== 'jump' && this.state !== 'fall' &&
        this.state !== 'airAttack' && this.state !== 'hurt' &&
        this.state !== 'ko' && this.state !== 'ultimate' && this.state !== 'special') {
      if (this.vy > 0) this.setState('fall');
    }
  }

  // ── Transiciones automáticas de estado ──────────────
  autoStateTransition(dt) {
    const dur = this.getStateDuration();

    switch (this.state) {
      case 'hurt':
        if (this.stateTimer >= dur) {
          this.setState(this.onGround ? 'idle' : 'fall');
        }
        break;
      case 'lightAttack':
      case 'heavyAttack':
      case 'airAttack':
      case 'special':
        if (this.stateTimer >= dur) {
          this.setState(this.onGround ? 'idle' : 'fall');
        }
        break;
      case 'ultimate':
        if (this.stateTimer >= dur) {
          this.setState('idle', true);
        }
        break;
      case 'dash':
        if (this.stateTimer >= dur) {
          this.vx = 0;
          this.setState('idle');
        }
        break;
      case 'jump':
        if (this.vy >= 0) this.setState('fall');
        break;
      case 'fall':
        if (this.onGround) this.setState('idle');
        break;
      case 'ko':
        if (!this.isDead && this.stateTimer > 0.5) {
          this.isDead = true;
        }
        break;
    }
  }

  // ══════════════════════════════════════════════════════
  //   MANEJO DE INPUT (jugador humano)
  // ══════════════════════════════════════════════════════
  handleInput(keys, dt) {
    const attackStates = ['lightAttack','heavyAttack','airAttack','special','ultimate'];
    const inAttack = attackStates.includes(this.state);
    const inBlock  = this.state === 'block';

    // ── Bloqueo ──
    // Jugador 1: Shift izquierdo | Jugador 2: Num0
    const blockKey = this.id === 'p1' ? 'ShiftLeft' : 'Numpad0';
    if (keys[blockKey] && this.onGround && !inAttack) {
      this.setState('block');
      this.isBlocking = true;
      return;
    } else {
      this.isBlocking = false;
      if (this.state === 'block') this.setState('idle');
    }

    // ── Ataques ──
    if (!inAttack && !inBlock) {
      if (this.id === 'p1') {
        if (keys['KeyU']) { this.doSpecial(); return; }
        if (keys['KeyI']) { this.doUltimate(); return; }
        if (keys['KeyL']) { this.doHeavyAttack(); return; }
        if (keys['KeyK']) { this.doLightAttack(); return; }
        if (keys['KeyJ']) { this.onGround ? this.doLightAttack() : this.doAirAttack(); return; }
      } else {
        if (keys['Numpad7']) { this.doSpecial(); return; }
        if (keys['Numpad8']) { this.doUltimate(); return; }
        if (keys['Numpad6']) { this.doHeavyAttack(); return; }
        if (keys['Numpad5']) { this.doLightAttack(); return; }
        if (keys['Numpad4']) { this.onGround ? this.doLightAttack() : this.doAirAttack(); return; }
      }
    }

    if (inAttack || inBlock) return;

    // ── Movimiento ──
    const leftKey  = this.id === 'p1' ? 'KeyA'      : 'ArrowLeft';
    const rightKey = this.id === 'p1' ? 'KeyD'      : 'ArrowRight';
    const upKey    = this.id === 'p1' ? 'KeyW'      : 'ArrowUp';
    const downKey  = this.id === 'p1' ? 'KeyS'      : 'ArrowDown';
    const dashKey  = this.id === 'p1' ? 'ShiftLeft' : 'ShiftRight';

    const movingLeft  = keys[leftKey];
    const movingRight = keys[rightKey];
    const crouching   = keys[downKey] && this.onGround;
    const jumpPressed = keys[upKey];

    // Agacharse
    if (crouching) {
      this.setState('crouch');
      this.vx *= 0.7;
      return;
    }

    // Dash
    if (keys[dashKey] && this.dashCooldown <= 0 && this.onGround) {
      this.doDash(movingLeft ? -1 : 1);
      return;
    }

    // Movimiento horizontal
    if (movingLeft)  { this.vx = -this.walkSpeed; this.setState('walk'); }
    if (movingRight) { this.vx =  this.walkSpeed; this.setState('walk'); }
    if (!movingLeft && !movingRight && this.onGround && this.state === 'walk') {
      this.setState('idle');
    }
    if (!movingLeft && !movingRight && this.onGround && this.state !== 'jump') {
      // decelerar
    }

    // Salto
    if (jumpPressed && (this.onGround || this.jumpCount < this.maxJumps)) {
      this.doJump();
    }

    // Idle si quieto en suelo
    if (!movingLeft && !movingRight && !crouching && this.onGround &&
        this.state !== 'idle' && !inAttack) {
      this.setState('idle');
    }
  }

  // ══════════════════════════════════════════════════════
  //   ACCIONES DE COMBATE
  // ══════════════════════════════════════════════════════

  doJump() {
    if (this.onGround || this.jumpCount < this.maxJumps) {
      this.vy = this.jumpPower;
      this.onGround = false;
      this.jumpCount++;
      this.setState('jump');
      AudioEngine.playJump();
    }
  }

  doDash(dir) {
    if (this.dashCooldown > 0) return;
    this.vx = dir * this.dashSpeed;
    this.setState('dash');
    this.dashCooldown = 0.7;
    this.invulTimer   = 0.12; // pequeña invulnerabilidad en dash
  }

  doLightAttack() {
    this.setState('lightAttack');
    AudioEngine.playPunch();
    // Combo tracking
    this.comboCount++;
    this.comboTimer = this.comboWindow;
  }

  doHeavyAttack() {
    this.setState('heavyAttack');
    AudioEngine.playHeavyPunch();
    this.comboCount++;
    this.comboTimer = this.comboWindow;
  }

  doAirAttack() {
    if (!this.onGround) {
      this.setState('airAttack');
      AudioEngine.playPunch();
    }
  }

  doSpecial() {
    if (this.energy < 30) return;
    this.energy -= 30;
    this.setState('special');
    if (this.charType === 'fire') AudioEngine.playFireSpecial();
    else                          AudioEngine.playElecSpecial();
  }

  doUltimate() {
    if (this.energy < 100) return;
    this.energy = 0;
    this.setState('ultimate', true);
    AudioEngine.playUltimate();

    // Efecto visual de ultimate
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    Effects.spawnUltimateEffect(cx, cy, this.charType === 'fire');
    Effects.triggerScreenShake(18, 0.5);
    Effects.triggerFlash(this.primaryColor, 0.25);
  }

  // ══════════════════════════════════════════════════════
  //   RECIBIR DAÑO
  // ══════════════════════════════════════════════════════
  takeDamage(amount, sourceX, knockbackForce, isHeavy = false) {
    // Invulnerable o muerto
    if (this.invulTimer > 0 || this.isDead) return false;

    // Bloqueo — reduce 60% de daño
    if (this.isBlocking) {
      amount = Math.floor(amount * 0.4);
      AudioEngine.playBlock();
      Effects.spawnHitSpark(this.x + this.width / 2, this.y + this.height * 0.4, '#88ccff');
      // Pequeño retroceso al bloquear
      Physics.applyKnockback(this, sourceX, knockbackForce * 0.3);
      return false; // no cuenta como hit "completo"
    }

    this.hp = Math.max(0, this.hp - amount);
    this.invulTimer = 0.22;

    // Hitstun
    this.hitstunTimer = isHeavy ? 0.35 : 0.22;
    this.setState('hurt', true);
    this.attackActive = false;

    // Knockback
    Physics.applyKnockback(this, sourceX, knockbackForce, isHeavy ? 0.5 : 0.28);

    // Efectos visuales
    const hitX = this.x + this.width / 2;
    const hitY = this.y + this.height * 0.35;
    if (isHeavy) {
      Effects.spawnHeavyHitSpark(hitX, hitY, this.primaryColor);
    } else {
      Effects.spawnHitSpark(hitX, hitY, '#ffffff');
    }

    // KO
    if (this.hp <= 0) {
      this.hp = 0;
      this.setState('ko', true);
      AudioEngine.playKO();
      Effects.triggerScreenShake(20, 0.6);
    }

    return true; // hit registrado
  }

  // ══════════════════════════════════════════════════════
  //   RESET ENTRE ROUNDS
  // ══════════════════════════════════════════════════════
  reset(x, facingRight) {
    this.x = x;
    this.y = 200;
    this.vx = 0; this.vy = 0;
    this.hp = this.maxHP;
    this.energy = 50;
    this.onGround = false;
    this.isDead = false;
    this.isBlocking = false;
    this.invulTimer = 0;
    this.hitstunTimer = 0;
    this.dashCooldown = 0;
    this.comboCount = 0;
    this.facingRight = facingRight;
    this.setState('idle', true);
  }

  // ══════════════════════════════════════════════════════
  //   RENDERIZADO PROCEDURAL (sprites generados en canvas)
  // ══════════════════════════════════════════════════════
  draw(ctx, debug = false) {
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    if (!this.facingRight) ctx.scale(-1, 1);

    // ── Parpadeo de invulnerabilidad ──
    if (this.invulTimer > 0 && Math.floor(this.invulTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // ── Dibujar personaje según estado ──
    this.drawCharacter(ctx);

    ctx.restore();

    // ── Debug: hitboxes ──
    if (debug) this.drawDebug(ctx);
  }

  drawCharacter(ctx) {
    const t  = this.animFrame / Math.max(1, this.totalFrames - 1); // 0..1
    const W  = this.width;
    const H  = this.height;
    const hW = W / 2;
    const hH = H / 2;
    const pc = this.primaryColor;
    const sc = this.secondaryColor;
    const gc = this.glowColor;

    // Ajuste según estado
    let scaleY = 1;
    let scaleX = 1;
    let bodyOffY = 0;

    switch (this.state) {
      case 'idle':
        // Respiración suave
        scaleY = 1 + Math.sin(Date.now() * 0.004) * 0.018;
        bodyOffY = Math.sin(Date.now() * 0.004) * 1.5;
        break;
      case 'crouch':
        scaleY = 0.68;
        bodyOffY = H * 0.16;
        break;
      case 'jump':
        scaleY = 1.08;
        scaleX = 0.94;
        break;
      case 'fall':
        scaleY = 0.94;
        break;
      case 'hurt':
        scaleX = 1 - t * 0.12;
        break;
      case 'ko':
        scaleY = Math.max(0.3, 1 - t * 0.7);
        bodyOffY = H * 0.35 * t;
        break;
    }

    ctx.save();
    ctx.scale(scaleX, scaleY);
    ctx.translate(0, bodyOffY / scaleY);

    // ── Sombra / glow ──
    ctx.shadowBlur  = 18;
    ctx.shadowColor = gc;

    // ── Cuerpo principal ──
    this.drawBody(ctx, hW, hH, pc, sc, gc);

    // ── Efectos de estado ──
    this.drawStateEffect(ctx, hW, hH, t, gc);

    ctx.restore();
  }

  drawBody(ctx, hW, hH, pc, sc, gc) {
    // Torso
    ctx.fillStyle = pc;
    ctx.fillRect(-hW * 0.55, -hH * 0.45, hW * 1.1, hH * 0.7);

    // Cabeza (yelmo/casco pixel art)
    ctx.fillStyle = sc;
    ctx.fillRect(-hW * 0.4, -hH * 0.95, hW * 0.8, hH * 0.52);

    // Ojos
    ctx.fillStyle = gc;
    ctx.fillRect(-hW * 0.22, -hH * 0.75, hW * 0.15, hH * 0.1);
    ctx.fillRect( hW * 0.07, -hH * 0.75, hW * 0.15, hH * 0.1);

    // Piernas (con separación estilo pixel)
    ctx.fillStyle = pc;
    ctx.fillRect(-hW * 0.45, hH * 0.25, hW * 0.38, hH * 0.72);
    ctx.fillRect( hW * 0.07, hH * 0.25, hW * 0.38, hH * 0.72);

    // Cinturón / detalle central
    ctx.fillStyle = sc;
    ctx.fillRect(-hW * 0.55, hH * 0.22, hW * 1.1, hH * 0.08);

    // Brazos (posición varía con estado)
    this.drawArms(ctx, hW, hH, pc, sc);
  }

  drawArms(ctx, hW, hH, pc, sc) {
    const armAnim = Math.sin(this.animFrame / Math.max(1,this.totalFrames-1) * Math.PI);
    let lArmRot = 0, rArmRot = 0, rArmExtend = 0;

    switch(this.state) {
      case 'walk':
        lArmRot = -armAnim * 0.6;
        rArmRot =  armAnim * 0.6;
        break;
      case 'lightAttack':
        rArmExtend = armAnim * hW * 0.6;
        rArmRot = -0.4 + armAnim * 0.4;
        break;
      case 'heavyAttack':
        rArmExtend = armAnim * hW * 0.9;
        rArmRot = -0.7 + armAnim * 0.7;
        lArmRot = 0.4;
        break;
      case 'airAttack':
        rArmExtend = armAnim * hW * 0.7;
        rArmRot = 0.6 - armAnim * 0.8;
        break;
      case 'block':
        lArmRot = -1.1;
        rArmRot = -0.9;
        break;
      case 'special':
        rArmExtend = armAnim * hW * 1.1;
        rArmRot = -0.5;
        break;
      case 'hurt':
        lArmRot =  0.8;
        rArmRot = -0.5;
        break;
    }

    // Brazo izquierdo
    ctx.save();
    ctx.translate(-hW * 0.55, -hH * 0.1);
    ctx.rotate(lArmRot);
    ctx.fillStyle = pc;
    ctx.fillRect(-hW * 0.22, 0, hW * 0.22, hH * 0.55);
    ctx.restore();

    // Brazo derecho (con extensión de ataque)
    ctx.save();
    ctx.translate(hW * 0.55 + rArmExtend, -hH * 0.1);
    ctx.rotate(rArmRot);
    ctx.fillStyle = pc;
    ctx.fillRect(0, 0, hW * 0.22, hH * 0.55);
    // Mano/guante
    ctx.fillStyle = sc;
    ctx.fillRect(0, hH * 0.42, hW * 0.28, hH * 0.22);
    ctx.restore();
  }

  drawStateEffect(ctx, hW, hH, t, gc) {
    // Efectos especiales según tipo y estado
    if (this.state === 'special' || this.state === 'ultimate') {
      const intensity = t;
      if (this.charType === 'fire') {
        this.drawFireAura(ctx, hW, hH, intensity);
      } else {
        this.drawElecAura(ctx, hW, hH, intensity);
      }
    }

    // Glow pasivo tipo personaje
    if (this.charType === 'fire' && this.energy > 60) {
      ctx.globalAlpha = 0.15 + (this.energy / 100) * 0.1;
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#ff4a00';
      ctx.fillStyle = '#ff4a00';
      ctx.beginPath();
      ctx.ellipse(0, -hH * 0.5, hW * 0.7, hH * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.charType === 'elec' && this.energy > 60) {
      ctx.globalAlpha = 0.12;
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#00cfff';
      ctx.fillStyle = '#00cfff';
      ctx.beginPath();
      ctx.ellipse(0, -hH * 0.5, hW * 0.7, hH * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawFireAura(ctx, hW, hH, t) {
    const time = Date.now() * 0.008;
    ctx.save();
    ctx.globalAlpha = 0.55 + t * 0.3;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + time;
      const r = hW * (0.9 + Math.sin(time + i) * 0.2);
      const fx = Math.cos(angle) * r;
      const fy = Math.sin(angle) * r * 0.6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#ff4a00';
      ctx.fillStyle = i % 2 === 0 ? '#ff4a00' : '#ffd700';
      ctx.beginPath();
      ctx.arc(fx, fy - hH * 0.2, 5 + t * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawElecAura(ctx, hW, hH, t) {
    const time = Date.now() * 0.012;
    ctx.save();
    ctx.globalAlpha = 0.6 + t * 0.3;
    ctx.strokeStyle = '#00cfff';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00cfff';
    // Rayos tipo zigzag
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + time * 0.5;
      const len = hW * (0.8 + Math.sin(time + i) * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, -hH * 0.2);
      for (let s = 0; s < 5; s++) {
        const px = Math.cos(angle + s * 0.5) * len * (s / 4);
        const py = Math.sin(angle + s * 0.5) * len * (s / 4) - hH * 0.2;
        ctx.lineTo(px + (Math.random()-0.5)*8*t, py + (Math.random()-0.5)*8*t);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Debug: muestra hitbox y hurtbox ─────────────────
  drawDebug(ctx) {
    // Hurtbox
    const hb = Physics.getHitbox(this);
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,0,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    ctx.restore();

    // Hitbox de ataque
    const ab = Physics.getAttackBox(this);
    if (ab) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,50,50,0.9)';
      ctx.fillStyle   = 'rgba(255,50,50,0.2)';
      ctx.lineWidth = 2;
      ctx.fillRect(ab.x, ab.y, ab.w, ab.h);
      ctx.strokeRect(ab.x, ab.y, ab.w, ab.h);
      ctx.restore();
    }

    // Estado
    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = '#0f0';
    ctx.fillText(`[${this.state}] HP:${this.hp} EN:${Math.floor(this.energy)}`, this.x, this.y - 12);
    ctx.restore();
  }
}
