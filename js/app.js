// ═══════════════════════════════════════════════════════
//  PATHMIND — MAIN APPLICATION
// ═══════════════════════════════════════════════════════
'use strict';

// ── Page Navigation ───────────────────────────────────
function goPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab, .mobile-tab').forEach(t => t.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');

  document.querySelectorAll(`[data-page="${pageId}"]`).forEach(t => t.classList.add('active'));

  // Close mobile menu
  document.getElementById('mobileMenu').classList.remove('open');
  document.getElementById('hamburgerBtn').classList.remove('open');

  // Resize canvases when switching to sim pages
  setTimeout(() => {
    if (pageId === 'sma') {
      fitCanvas(SMA.canvas);
      if (SMA.result) smaRenderIdle();
      else {
        clearCanvas(SMA.ctx, SMA.canvas.width, SMA.canvas.height);
        SMA.obstacles.forEach(o => drawObstacle(SMA.ctx, o));
        SMA.cities.forEach(c => { c.pulse = 0; drawCityNode(SMA.ctx, c, 0, '#2997ff'); });
        if (!SMA.cities.length)
          drawPlaceholder(SMA.ctx, SMA.canvas.width, SMA.canvas.height,
            'Place 2+ cities, draw obstacles, then click ▶ Compute Path');
      }
    }
    if (pageId === 'aco') {
      fitCanvas(ACO.canvas);
      _acoDraw();
    }
  }, 60);
}

// Bind nav tabs
document.querySelectorAll('.nav-tab, .mobile-tab').forEach(btn => {
  btn.addEventListener('click', () => goPage(btn.dataset.page));
});

// ── Hamburger ─────────────────────────────────────────
document.getElementById('hamburgerBtn').addEventListener('click', function() {
  this.classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
});

// ── Hero Background Canvas ────────────────────────────
(function initHeroBg() {
  const canvas = document.getElementById('heroBg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Animated node network
  const nodes = Array.from({ length: 28 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - .5) * 0.4,
    vy: (Math.random() - .5) * 0.4,
    r: 2 + Math.random() * 2
  }));

  function draw() {
    resize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Move
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > canvas.width)  n.vx *= -1;
      if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
    }

    // Edges
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 160) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = `rgba(41,151,255,${(1 - d/160) * 0.18})`;
          ctx.lineWidth   = 1;
          ctx.stroke();
        }
      }
    }

    // Nodes
    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(41,151,255,0.35)';
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }
  draw();
})();

// ── Global resize ─────────────────────────────────────
window.addEventListener('resize', () => {
  const active = document.querySelector('.page.active');
  if (!active) return;
  if (active.id === 'page-sma' && SMA.canvas) {
    fitCanvas(SMA.canvas);
    if (SMA.result) smaRenderIdle();
    else _drawSMAStatic();
  }
  if (active.id === 'page-aco' && ACO.canvas) {
    fitCanvas(ACO.canvas);
    _acoDraw();
  }
});

function _drawSMAStatic() {
  const W = SMA.canvas.width, H = SMA.canvas.height;
  clearCanvas(SMA.ctx, W, H);
  SMA.obstacles.forEach(o => drawObstacle(SMA.ctx, o));
  SMA.cities.forEach(c => drawCityNode(SMA.ctx, c, c.pulse || 0, '#2997ff'));
  if (!SMA.cities.length)
    drawPlaceholder(SMA.ctx, W, H, 'Place 2+ cities, draw obstacles, then click ▶ Compute Path');
}

// ── Keyboard shortcuts ────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    // Close mobile menu
    document.getElementById('mobileMenu').classList.remove('open');
    document.getElementById('hamburgerBtn').classList.remove('open');
  }
});

// ── Initialise on DOM ready ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSMAPage();
  initACOPage();
  setGlobalStatus('Ready', 'var(--green)');
});
