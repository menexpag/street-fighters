/* =====================================================
   enemy.js — IA del enemigo (extiende Fighter)
   Árbol de comportamiento con 4 modos:
   APPROACH, COMBAT, DEFEND, RETREAT
   La IA evalúa distancia, vida, energía y timers.
   ===================================================== */

class EnemyAI extends Fighter {
  constructor(config) {
    super({ ...config, isPlayer: false });

    // ── Parámetros de IA ──
    this.aiMode       = 'APPROACH'; // APPROACH | COMBAT | DEFEND | RETREAT
    this.aiTimer      = 0;          // timer de decisión
    this.aiDecisionInterval = 0.28; // segundos entre decisiones
    this.aiReactionDelay    = 0.12; // retraso de reacción (hace la IA más humana)
    this.reactionTimer      = 0;
    this.pendingAction      = null; // acción pendiente tras retraso

    // ── Historial de patrones ──
    this.consecutiveBlocks  = 0;
    this.aggressionLevel    = 0.5 + Math.random() * 0.3; // varía por instancia
    this.jumpCooldown       = 0;
    this.randomSeed         = Math.random();
  }

  // ══════════════════════════════════════════════════════
  //   UPDATE IA (se llama cada frame)
  // ══════════════════════════════════════════════════════
  update(dt, keys, gameState) {
    if (this.isDead) return;

    // Lógica de Fighter (físicas, animación, timers)
    // Llamamos al update de Fighter pero sin input de teclado
    this.updateBase(dt, gameState);

    // ── Actualizar facing hacia oponente ──
    if (this.opponent) {
      const oppCX = this.opponent.x + this.opponent.width / 2;
      const myCX  = this.x + this.width / 2;
      this.facingRight = oppCX > myCX;
    }

    // ── Lógica de decisión ──
    this.aiTimer       = Math.max(0, this.aiTimer - dt);
    this.reactionTimer = Math.max(0, this.reactionTimer - dt);
    this.jumpCooldown  = Math.max(0, this.jumpCooldown - dt);

    if (!this.opponent || this.hitstunTimer > 0 ||
        this.state === 'ko' || this.state === 'ultimate') return;

    if (this.aiTimer <= 0) {
      this.makeDecision();
      this.aiTimer = this.aiDecisionInterval * (0.7 + Math.random() * 0.6);
    }

    if (this.reactionTimer <= 0 && this.pendingAction) {
      this.executeAction(this.pendingAction);
      this.pendingAction = null;
    }

    this.executeCurrentMode(dt);
  }

  // Update base sin input de teclado
  updateBase(dt, gameState) {
    if (this.isDead) return;

    this.stateTimer  += dt;
    this.animTimer   += dt;
    this.invulTimer   = Math.max(0, this.invulTimer - dt);
    this.hitstunTimer = Math.max(0, this.hitstunTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.comboTimer   = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.comboCount = 0;

    this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen * dt);

    if (this.animTimer >= 1 / this.animFPS) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % this.totalFrames;
      const af = this.getAttackActiveFrame();
      if (af >= 0 && this.animFrame === af) this.attackActive = true;
      else if (this.animFrame !== af)       this.attackActive = false;
    }

    this.autoStateTransition(dt);

    if (this.state === 'dash') Effects.spawnDashTrail(this, this.primaryColor);

    Physics.applyGravity(this, dt);
    Physics.moveEntity(this, dt, gameState.floorY, gameState.stageLeft, gameState.stageRight);

    if (!this.onGround && this.state !== 'jump' && this.state !== 'fall' &&
        this.state !== 'airAttack' && this.state !== 'hurt' &&
        this.state !== 'ko' && this.state !== 'ultimate' && this.state !== 'special') {
      if (this.vy > 0) this.setState('fall');
    }
  }

  // ══════════════════════════════════════════════════════
  //   ÁRBOL DE DECISIÓN
  // ══════════════════════════════════════════════════════
  makeDecision() {
    if (!this.opponent) return;
    const inAttack = ['lightAttack','heavyAttack','airAttack','special','ultimate'].includes(this.state);
    if (inAttack) return;

    const oppCX  = this.opponent.x + this.opponent.width / 2;
    const myCX   = this.x + this.width / 2;
    const dist   = Math.abs(oppCX - myCX);
    const hpRatio    = this.hp / this.maxHP;
    const enerRatio  = this.energy / this.maxEnergy;
    const oppInAttack= ['lightAttack','heavyAttack','special'].includes(this.opponent.state);

    // ── Seleccionar modo ──
    if (hpRatio < 0.2 && this.aggressionLevel < 0.7) {
      this.aiMode = 'RETREAT';
    } else if (oppInAttack && dist < 130) {
      this.aiMode = 'DEFEND';
    } else if (dist < 160) {
      this.aiMode = 'COMBAT';
    } else {
      this.aiMode = 'APPROACH';
    }

    // ── Seleccionar acción según modo ──
    let action = null;

    switch (this.aiMode) {
      case 'APPROACH':
        if (Math.random() < 0.08 && this.jumpCooldown <= 0) {
          action = 'jump';
        } else if (Math.random() < 0.15 && this.dashCooldown <= 0) {
          action = 'dash';
        } else {
          action = 'move_toward';
        }
        break;

      case 'COMBAT':
        if (enerRatio >= 1.0 && Math.random() < 0.3) {
          action = 'ultimate';
        } else if (enerRatio >= 0.3 && Math.random() < 0.25 * this.aggressionLevel) {
          action = 'special';
        } else if (dist > 90 && Math.random() < 0.15) {
          action = 'dash_attack';
        } else {
          const r = Math.random();
          if (r < 0.45) action = 'light';
          else if (r < 0.75) action = 'heavy';
          else action = 'move_toward';
        }
        break;

      case 'DEFEND':
        this.consecutiveBlocks++;
        if (this.consecutiveBlocks > 3 && Math.random() < 0.5) {
          // Romper patrón defensivo con contraataque
          this.consecutiveBlocks = 0;
          action = 'heavy';
        } else {
          action = 'block';
        }
        break;

      case 'RETREAT':
        if (Math.random() < 0.35 && this.dashCooldown <= 0) action = 'dash_back';
        else action = 'move_away';
        break;
    }

    // Agregar retraso de reacción (más humano)
    if (action) {
      this.pendingAction = action;
      this.reactionTimer = this.aiReactionDelay * (0.5 + Math.random());
    }
  }

  // ── Ejecutar acción seleccionada ─────────────────────
  executeAction(action) {
    const inAttack = ['lightAttack','heavyAttack','airAttack','special','ultimate','hurt'].includes(this.state);

    switch (action) {
      case 'jump':
        if (this.onGround) {
          this.doJump();
          this.jumpCooldown = 1.2 + Math.random() * 0.5;
        }
        break;
      case 'light':
        if (!inAttack) this.doLightAttack();
        break;
      case 'heavy':
        if (!inAttack) this.doHeavyAttack();
        break;
      case 'special':
        if (!inAttack) this.doSpecial();
        break;
      case 'ultimate':
        if (!inAttack && this.energy >= 100) this.doUltimate();
        break;
      case 'block':
        if (!inAttack) { this.setState('block'); this.isBlocking = true; }
        break;
      case 'dash':
        if (this.dashCooldown <= 0 && this.onGround) {
          const dir = this.facingRight ? 1 : -1;
          this.doDash(dir);
        }
        break;
      case 'dash_attack':
        if (this.dashCooldown <= 0 && this.onGround) {
          const dir = this.facingRight ? 1 : -1;
          this.doDash(dir);
          // Queuerear ataque justo después del dash
          setTimeout(() => {
            if (!this.isDead) this.doHeavyAttack();
          }, 150);
        }
        break;
      case 'dash_back':
        if (this.dashCooldown <= 0 && this.onGround) {
          const dir = this.facingRight ? -1 : 1;
          this.doDash(dir);
        }
        break;
    }
  }

  // ── Ejecutar movimiento continuo según modo ──────────
  executeCurrentMode(dt) {
    if (!this.opponent) return;
    const attackStates = ['lightAttack','heavyAttack','airAttack','special','ultimate','hurt','block'];
    if (attackStates.includes(this.state)) return;

    const oppCX = this.opponent.x + this.opponent.width / 2;
    const myCX  = this.x + this.width / 2;
    const dist  = Math.abs(oppCX - myCX);
    const dir   = oppCX > myCX ? 1 : -1;

    switch (this.aiMode) {
      case 'APPROACH':
      case 'COMBAT':
        if (dist > 80) {
          this.vx = dir * this.walkSpeed * 0.85;
          if (this.onGround && this.state !== 'walk') this.setState('walk');
        } else {
          if (this.vx !== 0) this.vx *= 0.7;
          if (this.onGround && this.state === 'walk') this.setState('idle');
        }
        break;
      case 'RETREAT':
        this.vx = -dir * this.walkSpeed * 0.9;
        if (this.onGround && this.state !== 'walk') this.setState('walk');
        break;
      case 'DEFEND':
        this.vx *= 0.8;
        break;
    }
  }
}
