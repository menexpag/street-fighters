/* =====================================================
   ui.js — Sistema de UI
   Maneja todas las pantallas HTML superpuestas al canvas
   y el HUD dibujado directamente en canvas.
   ===================================================== */

const UI = (() => {

  const overlay = document.getElementById('ui-overlay');

  // ── Paleta de colores UI ──
  const C = {
    fire:  '#ff4a00',
    elec:  '#00cfff',
    gold:  '#ffd700',
    white: '#f0f0ff',
    dark:  'rgba(10,10,20,0.95)',
    bar_bg:'#1a1a2a',
  };

  // ── Estado de pantalla activa ──
  let currentScreen = null;

  // ── Limpiar overlay ──────────────────────────────────
  function clearOverlay() {
    overlay.innerHTML = '';
    overlay.classList.remove('active');
    currentScreen = null;
  }

  // ════════════════════════════════════════════════════
  //   MENÚ PRINCIPAL
  // ════════════════════════════════════════════════════
  function showMainMenu(onStart) {
    clearOverlay();
    overlay.classList.add('active');
    currentScreen = 'main';

    overlay.innerHTML = `
      <div class="screen" id="screen-main">
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;">
          <div class="screen-title" style="font-size:clamp(1.8rem,5vw,3.5rem);">
            🔥 BLAZE FIGHT ⚡
          </div>
          <div class="screen-subtitle">
            INSERT COIN — PRESS START
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:1rem;align-items:center;margin-top:1rem;">
          <button class="btn-arcade" id="btn-start">▶ START GAME</button>
          <button class="btn-arcade" id="btn-debug" style="background:rgba(255,255,255,0.1);color:#aaa;font-size:0.55rem;">
            [D] DEBUG MODE
          </button>
        </div>

        <div class="screen-subtitle" style="margin-top:2rem;font-size:clamp(0.38rem,0.9vw,0.55rem);line-height:2.2;">
          P1: WASD → Mover &nbsp;|&nbsp; J/K/L → Ataque &nbsp;|&nbsp; U → Especial &nbsp;|&nbsp; I → ULTIMATE<br/>
          P2: FLECHAS → Mover &nbsp;|&nbsp; NUM4/5/6 → Ataque &nbsp;|&nbsp; NUM7 → Especial &nbsp;|&nbsp; NUM8 → ULTIMATE<br/>
          SHIFT → Dash / Bloqueo
        </div>

        <div style="color:#555;font-size:0.4rem;margin-top:1.5rem;letter-spacing:1px;">
          BLAZE FIGHT v1.0 · ORIGINAL IP · NO COPYRIGHT INFRINGEMENT
        </div>
      </div>
    `;

    document.getElementById('btn-start').onclick = () => {
      AudioEngine.init();
      onStart(false);
    };
    document.getElementById('btn-debug').onclick = () => {
      AudioEngine.init();
      onStart(true);
    };
  }

  // ════════════════════════════════════════════════════
  //   SELECCIÓN DE PERSONAJE
  // ════════════════════════════════════════════════════
  function showCharSelect(onSelect) {
    clearOverlay();
    overlay.classList.add('active');
    currentScreen = 'select';

    const chars = [
      {
        id:   'ignis',
        type: 'fire',
        name: 'IGNIS',
        fullName: 'Kael "Ignis" Vorne',
        story: 'Forjado en las minas volcánicas del sur,\nKael absorbe el calor de la tierra para combatir.',
        stats: { HP: 100, ATK: 85, SPD: 78, DEF: 70 },
        special: 'Nova Flare — lanza una ola de fuego',
        color: '#ff4a00',
        bgGrad: 'radial-gradient(circle at 50% 30%, rgba(255,74,0,0.25), transparent 70%)',
      },
      {
        id:   'volt',
        type: 'elec',
        name: 'VOLT',
        fullName: 'Zara "Volt" Nex',
        story: 'Ex-ingeniera de reactores de plasma,\nun accidente la fundió con la red eléctrica.',
        stats: { HP: 90, ATK: 90, SPD: 92, DEF: 65 },
        special: 'Plasma Strike — ráfaga eléctrica en cadena',
        color: '#00cfff',
        bgGrad: 'radial-gradient(circle at 50% 30%, rgba(0,207,255,0.2), transparent 70%)',
      },
    ];

    const cardsHTML = chars.map(c => `
      <div class="char-card ${c.type}" data-char="${c.id}"
           style="background:${c.bgGrad},rgba(255,255,255,0.02);min-width:200px;">
        <canvas class="char-portrait" id="portrait-${c.id}" width="120" height="120"></canvas>
        <div class="char-name" style="color:${c.color};text-shadow:0 0 12px ${c.color};">
          ${c.name}
        </div>
        <div class="char-stats">
          ${Object.entries(c.stats).map(([k,v]) =>
            `<div style="display:flex;gap:0.5rem;align-items:center;">
               <span style="color:#666;width:36px;">${k}</span>
               <span style="flex:1;height:4px;background:#1a1a2a;display:block;">
                 <span style="display:block;height:100%;width:${v}%;background:${c.color};"></span>
               </span>
               <span style="color:${c.color};font-size:0.75rem;">${v}</span>
             </div>`
          ).join('')}
        </div>
        <div style="color:#888;font-size:0.55rem;text-align:center;line-height:1.8;max-width:160px;">
          ${c.story.replace(/\n/,'<br/>')}
        </div>
        <div style="color:${c.color};font-size:0.48rem;text-align:center;">
          ✦ ${c.special}
        </div>
        <button class="btn-arcade ${c.type}" style="margin-top:0.5rem;font-size:0.55rem;">
          SELECT
        </button>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="screen">
        <div class="screen-title" style="font-size:clamp(0.8rem,2.5vw,1.4rem);">
          — SELECT YOUR FIGHTER —
        </div>
        <div class="char-grid">${cardsHTML}</div>
      </div>
    `;

    // Dibujar retratos procedurales en los canvas de selección
    chars.forEach(c => {
      const cvs = document.getElementById(`portrait-${c.id}`);
      if (!cvs) return;
      const pCtx = cvs.getContext('2d');
      drawPortrait(pCtx, c.type, 120, 120);
    });

    // Eventos de selección
    document.querySelectorAll('.char-card').forEach(card => {
      card.querySelector('button').onclick = () => {
        const charId = card.dataset.char;
        onSelect(chars.find(c => c.id === charId));
      };
    });
  }

  // Dibuja un retrato pixel art procedural en un canvas pequeño
  function drawPortrait(pCtx, type, w, h) {
    const pc = type === 'fire' ? '#ff4a00' : '#00cfff';
    const sc = type === 'fire' ? '#ffd700' : '#7affff';
    pCtx.clearRect(0,0,w,h);

    // Fondo gradiente
    const bg = pCtx.createRadialGradient(w/2,h/2,5,w/2,h/2,w/2);
    bg.addColorStop(0, type === 'fire' ? 'rgba(255,74,0,0.3)' : 'rgba(0,207,255,0.25)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    pCtx.fillStyle = bg;
    pCtx.fillRect(0,0,w,h);

    // Cuerpo simplificado tipo ficha de personaje
    pCtx.shadowBlur = 14;
    pCtx.shadowColor = pc;

    // Torso
    pCtx.fillStyle = pc;
    pCtx.fillRect(38, 55, 44, 42);
    // Cabeza
    pCtx.fillStyle = sc;
    pCtx.fillRect(42, 22, 36, 36);
    // Ojos
    pCtx.fillStyle = '#ffffff';
    pCtx.fillRect(50, 32, 8, 7);
    pCtx.fillRect(62, 32, 8, 7);
    // Pupila
    pCtx.fillStyle = pc;
    pCtx.fillRect(53, 34, 4, 4);
    pCtx.fillRect(65, 34, 4, 4);
    // Piernas
    pCtx.fillStyle = pc;
    pCtx.fillRect(38, 97, 18, 20);
    pCtx.fillRect(64, 97, 18, 20);
    // Brazos
    pCtx.fillRect(20, 55, 18, 30);
    pCtx.fillRect(82, 55, 18, 30);
    // Cinturón
    pCtx.fillStyle = sc;
    pCtx.fillRect(38, 93, 44, 6);

    // Efecto de tipo
    if (type === 'fire') {
      pCtx.globalAlpha = 0.5;
      for (let i = 0; i < 5; i++) {
        pCtx.fillStyle = i % 2 === 0 ? '#ff4a00' : '#ffd700';
        pCtx.beginPath();
        pCtx.arc(30 + i*14, 15 + Math.sin(i)*5, 4+i%3*2, 0, Math.PI*2);
        pCtx.fill();
      }
      pCtx.globalAlpha = 1;
    } else {
      pCtx.globalAlpha = 0.5;
      pCtx.strokeStyle = '#00cfff';
      pCtx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        pCtx.beginPath();
        pCtx.moveTo(15+i*25, 18);
        pCtx.lineTo(20+i*25, 5);
        pCtx.lineTo(25+i*25, 18);
        pCtx.stroke();
      }
      pCtx.globalAlpha = 1;
    }
  }

  // ════════════════════════════════════════════════════
  //   PANTALLA DE VICTORIA
  // ════════════════════════════════════════════════════
  function showVictory(winnerName, winnerType, p1Wins, p2Wins, onRestart, onMenu) {
    clearOverlay();
    overlay.classList.add('active');
    currentScreen = 'victory';

    const typeColor = winnerType === 'fire' ? C.fire : C.elec;
    const emoji     = winnerType === 'fire' ? '🔥' : '⚡';

    overlay.innerHTML = `
      <div class="screen">
        <div class="screen-title" style="color:#888;font-size:clamp(0.5rem,1.5vw,0.8rem);">
          ROUND OVER
        </div>

        <div style="display:flex;flex-direction:column;align-items:center;gap:0.8rem;margin:1rem 0;">
          <div style="font-size:clamp(2rem,6vw,4rem);">${emoji}</div>
          <div class="winner-name ${winnerType}">
            ${winnerName.toUpperCase()}
          </div>
          <div class="screen-title" style="font-size:clamp(0.6rem,2vw,1rem);color:${typeColor};">
            WINS!
          </div>
        </div>

        <div style="display:flex;gap:3rem;align-items:center;margin:1rem 0;">
          <div style="text-align:center;">
            <div style="font-size:0.55rem;color:#666;margin-bottom:0.4rem;">P1 WINS</div>
            <div style="font-size:clamp(1.2rem,3vw,2rem);color:${C.fire};">${p1Wins}</div>
          </div>
          <div style="color:#444;font-size:2rem;">—</div>
          <div style="text-align:center;">
            <div style="font-size:0.55rem;color:#666;margin-bottom:0.4rem;">P2 WINS</div>
            <div style="font-size:clamp(1.2rem,3vw,2rem);color:${C.elec};">${p2Wins}</div>
          </div>
        </div>

        <div style="display:flex;gap:1.5rem;margin-top:1rem;">
          <button class="btn-arcade" id="btn-restart">↺ REMATCH</button>
          <button class="btn-arcade" id="btn-menu" 
                  style="background:rgba(255,255,255,0.08);color:#aaa;">
            MENU
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-restart').onclick = onRestart;
    document.getElementById('btn-menu').onclick    = onMenu;
  }

  // ════════════════════════════════════════════════════
  //   HUD — DIBUJADO EN CANVAS
  // ════════════════════════════════════════════════════
  function drawHUD(ctx, p1, p2, timer, round, W, H) {
    const BAR_W   = W * 0.38;
    const BAR_H   = 18;
    const BAR_Y   = 18;
    const EBAR_H  = 8;
    const MARGIN  = 18;

    ctx.save();

    // ── Panel fondo HUD ──
    ctx.fillStyle = 'rgba(5,5,15,0.72)';
    ctx.fillRect(0, 0, W, BAR_Y + BAR_H + EBAR_H + 28);

    // ── Nombre P1 ──
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = C.fire;
    ctx.textAlign = 'left';
    ctx.fillText(p1.name, MARGIN, 14);

    // ── Barra HP P1 ──
    drawLifeBar(ctx, MARGIN, BAR_Y, BAR_W, BAR_H, p1.hp, p1.maxHP, C.fire, 'left');

    // ── Barra Energía P1 ──
    drawEnergyBar(ctx, MARGIN, BAR_Y + BAR_H + 4, BAR_W, EBAR_H, p1.energy, p1.maxEnergy, C.fire);

    // ── Nombre P2 ──
    ctx.textAlign = 'right';
    ctx.fillStyle = C.elec;
    ctx.fillText(p2.name, W - MARGIN, 14);

    // ── Barra HP P2 ──
    drawLifeBar(ctx, W - MARGIN - BAR_W, BAR_Y, BAR_W, BAR_H, p2.hp, p2.maxHP, C.elec, 'right');

    // ── Barra Energía P2 ──
    drawEnergyBar(ctx, W - MARGIN - BAR_W, BAR_Y + BAR_H + 4, BAR_W, EBAR_H, p2.energy, p2.maxEnergy, C.elec);

    // ── Timer central ──
    const timerSec = Math.ceil(timer);
    const timerCol = timerSec <= 10 ? '#ff2200' : C.gold;
    ctx.textAlign = 'center';
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillStyle = timerCol;
    ctx.shadowBlur  = 15;
    ctx.shadowColor = timerCol;
    ctx.fillText(String(timerSec).padStart(2,'0'), W / 2, BAR_Y + BAR_H - 2);
    ctx.shadowBlur = 0;

    // ── Round indicator ──
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#666';
    ctx.fillText(`ROUND ${round}`, W / 2, 12);

    // ── Combo display ──
    if (p1.comboCount > 1) {
      drawComboText(ctx, MARGIN, BAR_Y + BAR_H + EBAR_H + 20, p1.comboCount, C.fire);
    }
    if (p2.comboCount > 1) {
      drawComboText(ctx, W - MARGIN - BAR_W, BAR_Y + BAR_H + EBAR_H + 20, p2.comboCount, C.elec);
    }

    ctx.restore();
  }

  function drawLifeBar(ctx, x, y, w, h, hp, maxHp, color, dir) {
    const ratio = Math.max(0, hp / maxHp);

    // Fondo
    ctx.fillStyle = C.bar_bg;
    ctx.fillRect(x, y, w, h);

    // Borde
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Barra de vida (rellena desde el lado correcto)
    const barW = Math.floor(w * ratio);
    const barX = dir === 'right' ? x + w - barW : x;

    // Gradiente de vida
    const grad = ctx.createLinearGradient(barX, y, barX + barW, y);
    if (ratio > 0.5) {
      grad.addColorStop(0, color);
      grad.addColorStop(1, lightenColor(color, 40));
    } else if (ratio > 0.25) {
      grad.addColorStop(0, '#ff8800');
      grad.addColorStop(1, '#ffcc00');
    } else {
      grad.addColorStop(0, '#ff0000');
      grad.addColorStop(1, '#ff4400');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(barX, y + 2, barW, h - 4);

    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(barX, y + 2, barW, (h-4) * 0.4);
  }

  function drawEnergyBar(ctx, x, y, w, h, energy, maxEnergy, color) {
    const ratio = energy / maxEnergy;
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(x, y, w, h);

    const segments = 5;
    const segW = Math.floor(w / segments);
    const filled = Math.floor(ratio * segments);

    for (let i = 0; i < segments; i++) {
      const sx = x + i * segW + 1;
      if (i < filled) {
        ctx.fillStyle = color === C.fire ? 'rgba(255,140,0,0.85)' : 'rgba(0,207,255,0.85)';
        ctx.fillRect(sx, y + 1, segW - 2, h - 2);
      } else if (i === filled && ratio % (1/segments) > 0) {
        const partial = (ratio * segments) % 1;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(sx, y + 1, (segW - 2) * partial, h - 2);
        ctx.globalAlpha = 1;
      }
    }

    // Label "ENERGY" cuando está llena
    if (ratio >= 1) {
      ctx.font = '5px monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.fillText('ENERGY FULL!', x, y + h + 8);
      ctx.shadowBlur = 0;
    }
  }

  function drawComboText(ctx, x, y, count, color) {
    ctx.save();
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillText(`${count} HIT!`, x, y);
    ctx.restore();
  }

  // ── Texto "KO" cinematográfico ────────────────────────
  function drawKOText(ctx, W, H, alpha) {
    ctx.save();
    const scale = 1 + (1 - alpha) * 0.3;
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H / 2 - 40);
    ctx.scale(scale, scale);
    ctx.font = '72px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Sombra roja
    ctx.shadowBlur  = 40;
    ctx.shadowColor = '#ff0000';
    ctx.fillStyle   = '#ff2200';
    ctx.fillText('K.O.', 2, 2);
    // Texto blanco sobre
    ctx.shadowColor = '#ffffff';
    ctx.fillStyle   = '#ffffff';
    ctx.fillText('K.O.', 0, 0);
    ctx.restore();
  }

  // ── Texto de round ────────────────────────────────────
  function drawRoundText(ctx, W, H, text, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '36px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur  = 30;
    ctx.shadowColor = C.gold;
    ctx.fillStyle   = C.gold;
    ctx.fillText(text, W / 2, H / 2 - 20);
    ctx.restore();
  }

  // ── Overlay oscuro entre rounds ───────────────────────
  function drawDarkOverlay(ctx, W, H, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Helpers
  function lightenColor(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1,3),16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3,5),16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5,7),16) + amount);
    return `rgb(${r},${g},${b})`;
  }

  // ── API pública ──────────────────────────────────────
  return {
    clearOverlay,
    showMainMenu,
    showCharSelect,
    showVictory,
    drawHUD,
    drawKOText,
    drawRoundText,
    drawDarkOverlay,
    drawPortrait,
  };
})();
