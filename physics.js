/* =====================================================
   physics.js — Motor de físicas del juego
   Maneja gravedad, fricción, colisiones y hitboxes.
   ===================================================== */

const Physics = (() => {

  // ── Constantes de mundo ──────────────────────────────
  const GRAVITY       = 2200;   // px/s² — sensación arcade rápida
  const FRICTION      = 0.80;   // factor de fricción horizontal por frame
  const FLOOR_Y       = 420;    // Y del suelo (se ajusta con canvas height)
  const STAGE_LEFT    = 30;     // pared izquierda
  const STAGE_RIGHT   = 770;    // pared derecha (se ajusta dinámicamente)
  const MAX_FALL_SPD  = 900;    // velocidad máxima de caída

  // ── Resolución de colisión AABB ──────────────────────
  // Retorna true si dos rectángulos se solapan
  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  // ── Aplicar gravedad a una entidad ──────────────────
  // entity debe tener: vy, onGround, y, height
  function applyGravity(entity, dt) {
    if (!entity.onGround) {
      entity.vy += GRAVITY * dt;
      if (entity.vy > MAX_FALL_SPD) entity.vy = MAX_FALL_SPD;
    }
  }

  // ── Mover entidad y resolver suelo / paredes ─────────
  function moveEntity(entity, dt, floorY, stageLeft, stageRight) {
    // Movimiento horizontal
    entity.x += entity.vx * dt;

    // Fricción en suelo
    if (entity.onGround) {
      entity.vx *= FRICTION;
      if (Math.abs(entity.vx) < 5) entity.vx = 0;
    }

    // Paredes
    const left  = stageLeft;
    const right = stageRight - entity.width;
    if (entity.x < left)  { entity.x = left;  entity.vx = 0; }
    if (entity.x > right) { entity.x = right; entity.vx = 0; }

    // Movimiento vertical
    entity.y += entity.vy * dt;

    // Colisión con suelo
    const groundY = floorY - entity.height;
    if (entity.y >= groundY) {
      entity.y = groundY;
      entity.vy = 0;
      entity.onGround = true;
      entity.jumpCount = 0;
    } else {
      entity.onGround = false;
    }
  }

  // ── Separar dos entidades que se solapan ────────────
  // Evita que los personajes se superpongan en X
  function separateEntities(a, b) {
    const aRight  = a.x + a.width;
    const bRight  = b.x + b.width;
    const overlapX = Math.min(aRight, bRight) - Math.max(a.x, b.x);
    if (overlapX > 0) {
      const push = overlapX / 2 + 1;
      if (a.x < b.x) { a.x -= push; b.x += push; }
      else            { a.x += push; b.x -= push; }
    }
  }

  // ── Hitbox de un personaje según estado ─────────────
  // Retorna {x, y, w, h} relativo a la esquina superior-izquierda del canvas
  function getHitbox(entity) {
    let w = entity.width  * 0.55;
    let h = entity.height * 0.55;
    let ox = entity.width  * 0.22;
    let oy = entity.height * 0.22;

    // Agachado es más compacto
    if (entity.state === 'crouch') {
      h *= 0.5;
      oy = entity.height * 0.5;
    }

    return {
      x: entity.x + ox,
      y: entity.y + oy,
      w,
      h,
    };
  }

  // ── Hurtbox de ataque — generada por estado ──────────
  // Retorna null si no hay ataque activo
  function getAttackBox(entity) {
    if (!entity.attackActive) return null;

    const dir = entity.facingRight ? 1 : -1;

    let bx, by, bw, bh;
    switch (entity.state) {
      case 'lightAttack':
        bw = 55; bh = 28;
        bx = entity.x + (entity.facingRight ? entity.width - 8 : -bw + 8);
        by = entity.y + entity.height * 0.25;
        break;
      case 'heavyAttack':
        bw = 80; bh = 40;
        bx = entity.x + (entity.facingRight ? entity.width - 10 : -bw + 10);
        by = entity.y + entity.height * 0.2;
        break;
      case 'airAttack':
        bw = 60; bh = 50;
        bx = entity.x + (entity.facingRight ? entity.width - 5 : -bw + 5);
        by = entity.y + entity.height * 0.1;
        break;
      case 'special':
        bw = 90; bh = 45;
        bx = entity.x + (entity.facingRight ? entity.width : -bw);
        by = entity.y + entity.height * 0.15;
        break;
      case 'ultimate':
        bw = 140; bh = 80;
        bx = entity.x + (entity.facingRight ? entity.width - 20 : -bw + 20);
        by = entity.y;
        break;
      default:
        return null;
    }

    return { x: bx, y: by, w: bw, h: bh };
  }

  // ── Knockback al recibir un golpe ───────────────────
  function applyKnockback(entity, sourceX, force, upward = 0.35) {
    const dir  = entity.x + entity.width / 2 > sourceX ? 1 : -1;
    entity.vx  = dir * force;
    entity.vy  = -force * upward;
    entity.onGround = false;
  }

  // ── API pública ──────────────────────────────────────
  return {
    GRAVITY,
    FRICTION,
    FLOOR_Y,
    STAGE_LEFT,
    STAGE_RIGHT,
    MAX_FALL_SPD,
    rectsOverlap,
    applyGravity,
    moveEntity,
    separateEntities,
    getHitbox,
    getAttackBox,
    applyKnockback,
  };
})();
