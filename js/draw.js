// ═══════════════════════════════════════════════════════
//  PATHMIND — DRAW UTILITIES
// ═══════════════════════════════════════════════════════
'use strict';

// ─── Clear canvas with dark background + subtle grid ──
function clearCanvas(ctx, W, H) {
  ctx.fillStyle = '#050508';
  ctx.fillRect(0, 0, W, H);
  // Dot grid
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let x = 0; x < W; x += 44)
    for (let y = 0; y < H; y += 44) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
}

// ─── Placeholder text ─────────────────────────────────
function drawPlaceholder(ctx, W, H, msg) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = '13px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, W / 2, H / 2);
  ctx.restore();
}

// ─── Draw obstacle (building or water) ────────────────
function drawObstacle(ctx, o, alpha) {
  alpha = alpha !== undefined ? alpha : 1;
  ctx.save();
  ctx.globalAlpha = alpha;

  if (o.tp === 'water') {
    // Gradient fill
    const g = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
    g.addColorStop(0, '#0a2440');
    g.addColorStop(1, '#061828');
    ctx.fillStyle = g;
    ctx.fillRect(o.x, o.y, o.w, o.h);

    // Ripple lines
    ctx.strokeStyle = 'rgba(30,90,160,0.55)';
    ctx.lineWidth = 1;
    for (let yy = o.y + 11; yy < o.y + o.h - 5; yy += 14) {
      ctx.beginPath();
      let xx = o.x + 6;
      while (xx < o.x + o.w - 10) {
        ctx.moveTo(xx, yy);
        ctx.bezierCurveTo(xx + 4, yy - 4, xx + 12, yy + 4, xx + 18, yy);
        xx += 22;
      }
      ctx.stroke();
    }

    // Label
    if (o.w > 55 && o.h > 26) {
      ctx.fillStyle = 'rgba(30,100,180,0.4)';
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WATER', o.x + o.w / 2, o.y + o.h / 2);
    }

    // Border
    ctx.strokeStyle = 'rgba(30,80,140,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(o.x, o.y, o.w, o.h);

  } else {
    // Building body
    ctx.fillStyle = '#0f0c09';
    ctx.fillRect(o.x, o.y, o.w, o.h);

    // Window grid
    const rows = Math.max(1, (o.h / 22) | 0);
    const cols = Math.max(1, (o.w / 16) | 0);
    const gx = o.w / cols, gy = o.h / rows;
    const ww = Math.max(3, gx - 5), wh = Math.max(2, gy - 5);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = o.x + c * gx + (gx - ww) / 2;
        const wy = o.y + r * gy + (gy - wh) / 2;
        const lit = Math.random() > 0.42;
        ctx.fillStyle = lit ? 'rgba(250,210,80,0.18)' : 'rgba(255,255,255,0.025)';
        ctx.fillRect(wx, wy, ww, wh);
      }
    }

    // Rooftop stripe
    ctx.fillStyle = '#1a1510';
    ctx.fillRect(o.x, o.y, o.w, 4);

    // Border
    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x, o.y, o.w, o.h);

    // Label
    if (o.w > 48 && o.h > 24) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BLOCK', o.x + o.w / 2, o.y + o.h / 2);
    }
  }

  ctx.restore();
}

// ─── Draw city node ────────────────────────────────────
function drawCityNode(ctx, city, pulse, color) {
  color = color || '#2997ff';
  const {x, y, name} = city;
  const p = Math.sin(pulse || 0) * 2.5;

  ctx.save();

  // Outer glow ring
  const rg = ctx.createRadialGradient(x, y, 5, x, y, 20 + p);
  rg.addColorStop(0, color + '44');
  rg.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(x, y, 20 + p, 0, Math.PI * 2);
  ctx.fillStyle = rg;
  ctx.fill();

  // Mid ring
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.strokeStyle = color + '55';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Inner filled circle
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = color + 'cc';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Center white dot
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Name label with subtle bg
  ctx.font = '600 10px Inter, sans-serif';
  ctx.textAlign = 'center';
  const labelY = y + 17;
  const tw = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - tw / 2 - 3, labelY - 1, tw + 6, 13);
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.fillText(name, x, labelY);

  ctx.restore();
}

// ─── Draw drag-preview rect ────────────────────────────
function drawTempRect(ctx, rect) {
  if (!rect || rect.w < 2 || rect.h < 2) return;
  drawObstacle(ctx, rect, 0.5);
}
