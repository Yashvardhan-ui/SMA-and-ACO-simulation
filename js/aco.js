// ═══════════════════════════════════════════════════════
//  PATHMIND — ANT COLONY OPTIMIZATION ENGINE
// ═══════════════════════════════════════════════════════
'use strict';

// ── State ─────────────────────────────────────────────
const ACO = {
  canvas:     null,
  ctx:        null,
  wrap:       null,
  nodes:      [],      // city nodes
  obstacles:  [],
  mode:       'city',
  dragging:   false,
  dragStart:  null,
  tempRect:   null,
  // algorithm
  pheromone:  null,    // 2D Float64 matrix
  ants:       [],
  running:    false,
  animFrame:  null,
  iter:       0,
  found:      0,
  bestDist:   Infinity,
  bestTour:   [],
  prevBest:   Infinity,
  stagnant:   0
};

// ── Init ──────────────────────────────────────────────
function initACOPage() {
  ACO.canvas = document.getElementById('acoCanvas');
  ACO.ctx    = ACO.canvas.getContext('2d');
  ACO.wrap   = document.getElementById('acoCanvasContainer');

  ACO.canvas.addEventListener('mousedown', onACOMouseDown);
  ACO.canvas.addEventListener('mousemove', onACOMouseMove);
  ACO.canvas.addEventListener('mouseup',   onACOMouseUp);
  ACO.canvas.addEventListener('mouseleave',onACOMouseLeave);

  ACO.canvas.addEventListener('touchstart', e => {
    e.preventDefault(); onACOMouseDown(touchToMouseACO(e));
  }, {passive:false});
  ACO.canvas.addEventListener('touchmove', e => {
    e.preventDefault(); onACOMouseMove(touchToMouseACO(e));
  }, {passive:false});
  ACO.canvas.addEventListener('touchend', e => {
    e.preventDefault(); onACOMouseUp(touchToMouseACO(e));
  }, {passive:false});

  fitCanvas(ACO.canvas);
  _acoDraw();
}

function touchToMouseACO(e) {
  const t = e.touches[0] || e.changedTouches[0];
  return { clientX: t.clientX, clientY: t.clientY };
}

// ── Draw mode ─────────────────────────────────────────
function setAMode(mode, btn) {
  ACO.mode = mode;
  document.querySelectorAll('#acoModeGrid .mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Canvas events ─────────────────────────────────────
function onACOMouseDown(e) {
  fitCanvas(ACO.canvas);
  const pt = canvasXY(ACO.canvas, e);

  if (ACO.mode === 'city') {
    if (ACO.nodes.length >= 16) return;
    const tp = ACO.nodes.length === 0 ? 'hub' : 'city';
    ACO.nodes.push({ x: pt.x, y: pt.y, tp, name: tp === 'hub' ? 'Origin' : nextCityName() });
    if (ACO.pheromone) _rebuildPheromone();
    updateACOSidebar(); _acoDraw();

  } else if (ACO.mode === 'erase') {
    const prev = ACO.nodes.length;
    ACO.nodes = ACO.nodes.filter(n => Math.hypot(n.x - pt.x, n.y - pt.y) > 24);
    if (ACO.nodes.length !== prev) _cityIdx = Math.max(0, _cityIdx - 1);
    ACO.obstacles = ACO.obstacles.filter(o =>
      !(pt.x >= o.x && pt.x <= o.x + o.w && pt.y >= o.y && pt.y <= o.y + o.h)
    );
    if (ACO.pheromone) _rebuildPheromone();
    updateACOSidebar(); _acoDraw();

  } else {
    ACO.dragging  = true;
    ACO.dragStart = pt;
  }
}

function onACOMouseMove(e) {
  if (!ACO.dragging) return;
  const pt = canvasXY(ACO.canvas, e);
  ACO.tempRect = {
    x:  Math.min(ACO.dragStart.x, pt.x),
    y:  Math.min(ACO.dragStart.y, pt.y),
    w:  Math.abs(pt.x - ACO.dragStart.x),
    h:  Math.abs(pt.y - ACO.dragStart.y),
    tp: ACO.mode
  };
  _acoDraw();
}

function onACOMouseUp() {
  if (!ACO.dragging) return;
  ACO.dragging = false;
  if (ACO.tempRect && ACO.tempRect.w > 8 && ACO.tempRect.h > 8) {
    ACO.obstacles.push({ ...ACO.tempRect });
  }
  ACO.tempRect = null;
  updateACOSidebar(); _acoDraw();
}

function onACOMouseLeave() {
  ACO.dragging = false; ACO.tempRect = null; _acoDraw();
}

// ── Sidebar ───────────────────────────────────────────
function updateACOSidebar() {
  document.getElementById('acoCities').textContent   = ACO.nodes.length;
  document.getElementById('acoObsCount').textContent = ACO.obstacles.length;
}

// ── LOAD DEMO ─────────────────────────────────────────
function loadACODemo() {
  resetACO(true);
  fitCanvas(ACO.canvas);
  const W = ACO.canvas.width, H = ACO.canvas.height;

  ACO.nodes = [
    { x: W*.50, y: H*.50, tp:'hub',  name:'Origin'    },
    { x: W*.12, y: H*.14, tp:'city', name:'Northgate'  },
    { x: W*.88, y: H*.14, tp:'city', name:'Southport'  },
    { x: W*.12, y: H*.86, tp:'city', name:'Eastholm'   },
    { x: W*.88, y: H*.86, tp:'city', name:'Westbury'   },
    { x: W*.50, y: H*.07, tp:'city', name:'Central'    },
    { x: W*.20, y: H*.50, tp:'city', name:'Riverside'  },
    { x: W*.80, y: H*.50, tp:'city', name:'Uptown'     },
    { x: W*.50, y: H*.93, tp:'city', name:'Midway'     },
    { x: W*.33, y: H*.30, tp:'city', name:'Harbor'     },
    { x: W*.67, y: H*.30, tp:'city', name:'Junction'   },
    { x: W*.33, y: H*.70, tp:'city', name:'Summit'     },
    { x: W*.67, y: H*.70, tp:'city', name:'Lakeside'   },
  ];
  _cityIdx = 12;

  ACO.obstacles = [
    { x: W*.28, y: H*.09, w: W*.14, h: H*.18, tp:'building' },
    { x: W*.58, y: H*.09, w: W*.14, h: H*.18, tp:'building' },
    { x: W*.28, y: H*.71, w: W*.14, h: H*.18, tp:'building' },
    { x: W*.58, y: H*.71, w: W*.14, h: H*.18, tp:'building' },
    { x: W*.36, y: H*.33, w: W*.28, h: H*.24, tp:'water'    },
    { x: W*.10, y: H*.27, w: W*.08, h: H*.28, tp:'building' },
    { x: W*.82, y: H*.27, w: W*.08, h: H*.28, tp:'building' },
  ];

  updateACOSidebar(); _acoDraw();
  document.getElementById('acoCanvasStatus').textContent = 'Demo loaded — click Initialize then Run';
}

// ── INIT ──────────────────────────────────────────────
function initACO() {
  if (!ACO.nodes.length) { loadACODemo(); return; }

  const n = parseInt(document.getElementById('ac-ants').value);
  _rebuildPheromone();

  ACO.ants      = _spawnAnts(n);
  ACO.iter      = 0;
  ACO.found     = 0;
  ACO.bestDist  = Infinity;
  ACO.bestTour  = [];
  ACO.prevBest  = Infinity;
  ACO.stagnant  = 0;

  document.getElementById('acoAnts').textContent   = n;
  document.getElementById('acoBadge').className    = 'badge-pill running';
  document.getElementById('acoBadge').textContent  = 'Ready';
  document.getElementById('acoCanvasStatus').textContent = `${n} ants ready — click ▶ Run`;
  updateACOSidebar(); _acoDraw();
}

function _rebuildPheromone() {
  const N = ACO.nodes.length;
  ACO.pheromone = Array.from({ length: N }, () => new Float64Array(N).fill(0.1));
}

function _spawnAnts(n) {
  if (!ACO.nodes.length) return [];
  const origin = ACO.nodes[0];
  return Array.from({ length: n }, () => ({
    px: origin.x, py: origin.y,
    ni: 0, vis: [0], ret: false, path: [0],
    tx: origin.x, ty: origin.y
  }));
}

// ── Edge distance with obstacle cost ──────────────────
function _acoEdgeDist(i, j) {
  const a = ACO.nodes[i], b = ACO.nodes[j];
  const dx = a.x - b.x, dy = a.y - b.y;
  const base = Math.sqrt(dx*dx + dy*dy) || 0.001;
  return base * edgeObsCost(a.x, a.y, b.x, b.y, ACO.obstacles);
}

// ── Toggle run/pause ──────────────────────────────────
function toggleACO() {
  if (!ACO.pheromone || !ACO.ants.length) { initACO(); return; }
  ACO.running = !ACO.running;

  const btn = document.getElementById('acoRunBtn');
  if (ACO.running) {
    btn.textContent       = '⏸ Pause';
    btn.className         = 'btn-action danger';
    document.getElementById('acoBadge').className   = 'badge-pill running';
    document.getElementById('acoBadge').textContent = 'Running';
    setGlobalStatus('ACO Active', 'var(--orange)');
    _acoLoop();
  } else {
    cancelAnimationFrame(ACO.animFrame);
    btn.textContent       = '▶ Run';
    btn.className         = 'btn-action success';
    document.getElementById('acoBadge').className   = 'badge-pill';
    document.getElementById('acoBadge').textContent = 'Paused';
    setGlobalStatus('ACO Paused', 'var(--amber)');
  }
}

function _acoLoop() {
  if (!ACO.running) return;
  for (let i = 0; i < 2; i++) _acoStep();
  _acoDraw();
  ACO.animFrame = requestAnimationFrame(_acoLoop);
}

// ── Single ACO step ───────────────────────────────────
function _acoStep() {
  const alpha = parseFloat(document.getElementById('ac-al').value) / 10;
  const beta  = parseFloat(document.getElementById('ac-be').value) / 10;
  const rho   = parseFloat(document.getElementById('ac-ev').value) / 100;
  const Q     = parseFloat(document.getElementById('ac-q').value);
  const elite = parseFloat(document.getElementById('ac-el').value);
  const N     = ACO.nodes.length;
  if (!N) return;

  // Global evaporation
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      ACO.pheromone[i][j] *= (1 - rho);

  // Elitist deposit on best tour
  if (elite > 0 && ACO.bestTour.length > 1) {
    for (let i = 0; i < ACO.bestTour.length - 1; i++) {
      const a = ACO.bestTour[i], b = ACO.bestTour[i+1];
      ACO.pheromone[a][b] += elite / ACO.bestDist;
      ACO.pheromone[b][a] += elite / ACO.bestDist;
    }
  }

  // Move each ant
  for (const ant of ACO.ants) {
    const dx = ant.tx - ant.px, dy = ant.ty - ant.py;
    const d = Math.sqrt(dx*dx + dy*dy);

    if (d < 3.5) {
      ant.px = ant.tx; ant.py = ant.ty;

      if (!ant.ret) {
        // Choose next unvisited city
        const cur  = ant.ni;
        const unv  = [];
        for (let i = 0; i < N; i++)
          if (!ant.vis.includes(i) && ACO.nodes[i].tp !== 'hub') unv.push(i);

        if (!unv.length) {
          // Tour complete — return to origin
          ant.ret = true;
          ant.tx  = ACO.nodes[0].x;
          ant.ty  = ACO.nodes[0].y;

          // Compute tour distance
          let td = 0;
          for (let i = 1; i < ant.path.length; i++)
            td += _acoEdgeDist(ant.path[i-1], ant.path[i]);

          if (td < ACO.bestDist && ant.path.length > 2) {
            ACO.bestDist = td;
            ACO.bestTour = [...ant.path];
          }

          // Deposit pheromone
          for (let i = 1; i < ant.path.length; i++) {
            const a = ant.path[i-1], b = ant.path[i];
            const dp = Q / td;
            ACO.pheromone[a][b] += dp;
            ACO.pheromone[b][a] += dp;
          }
          ACO.found += ant.path.length - 1;

        } else {
          // Probabilistic selection
          const probs = unv.map(i =>
            Math.pow(ACO.pheromone[cur][i], alpha) *
            Math.pow(1 / _acoEdgeDist(cur, i), beta)
          );
          const sum = probs.reduce((s,v) => s+v, 0) || 1;
          let r = Math.random() * sum;
          let chosen = unv[unv.length - 1];
          for (let i = 0; i < unv.length; i++) {
            r -= probs[i];
            if (r <= 0) { chosen = unv[i]; break; }
          }
          ant.ni = chosen;
          ant.vis.push(chosen);
          ant.path.push(chosen);
          ant.tx = ACO.nodes[chosen].x;
          ant.ty = ACO.nodes[chosen].y;
        }

      } else {
        // Returned to origin — reset for next tour
        ant.ni   = 0;
        ant.vis  = [0];
        ant.path = [0];
        ant.ret  = false;
        ant.tx   = ACO.nodes[0].x;
        ant.ty   = ACO.nodes[0].y;
      }
    } else {
      ant.px += dx / d * 3.2;
      ant.py += dy / d * 3.2;
    }
  }

  ACO.iter++;
  if (ACO.bestDist < ACO.prevBest) { ACO.stagnant = 0; ACO.prevBest = ACO.bestDist; }
  else ACO.stagnant++;

  const bl = ACO.bestDist === Infinity ? '—' : Math.round(ACO.bestDist);
  const conv = ACO.stagnant > 40 ? 'Converged' : ACO.stagnant > 15 ? 'Stabilizing' : 'Searching';

  document.getElementById('acoCycles').textContent = ACO.iter;
  document.getElementById('acoBest').textContent   = bl;
  document.getElementById('acoBestR').textContent  = bl;
  document.getElementById('acoRoutes').textContent = (ACO.found / 10) | 0;
  document.getElementById('acoConv').textContent   = conv;
  document.getElementById('acoMeta').textContent   = `Cycle ${ACO.iter} · Best: ${bl} · ${conv}`;
  document.getElementById('acoCanvasStatus').textContent = `Cycle ${ACO.iter} — Best tour: ${bl} units`;
}

// ── Draw ──────────────────────────────────────────────
function _acoDraw() {
  fitCanvas(ACO.canvas);
  const ctx = ACO.ctx;
  const W = ACO.canvas.width, H = ACO.canvas.height;

  clearCanvas(ctx, W, H);
  ACO.obstacles.forEach(o => drawObstacle(ctx, o));
  if (ACO.tempRect) drawTempRect(ctx, ACO.tempRect);

  if (!ACO.pheromone || ACO.nodes.length < 2) {
    drawPlaceholder(ctx, W, H, 'Place cities → Initialize → Run');
    ACO.nodes.forEach(n => drawCityNode(ctx, n, 0, n.tp==='hub'?'#fb923c':'#2997ff'));
    return;
  }

  const N = ACO.nodes.length;

  // Find max pheromone
  let maxPh = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      if (ACO.pheromone[i][j] > maxPh) maxPh = ACO.pheromone[i][j];
  if (maxPh < 0.01) maxPh = 0.01;

  // Draw pheromone edges
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const ph  = (ACO.pheromone[i][j] + ACO.pheromone[j][i]) * 0.5;
      const str = Math.pow(ph / maxPh, 0.5);
      if (str < 0.04) continue;
      ctx.beginPath();
      ctx.moveTo(ACO.nodes[i].x, ACO.nodes[i].y);
      ctx.lineTo(ACO.nodes[j].x, ACO.nodes[j].y);
      ctx.strokeStyle = `rgba(41,151,255,${Math.min(str * 0.75, 0.72)})`;
      ctx.lineWidth   = Math.max(str * 5, 0.5);
      ctx.stroke();
    }
  }

  // Best tour overlay (gold dashed)
  if (ACO.bestTour.length > 1) {
    ctx.save();
    ctx.shadowColor = 'rgba(251,191,36,0.55)';
    ctx.shadowBlur  = 14;
    ctx.beginPath();
    ctx.moveTo(ACO.nodes[ACO.bestTour[0]].x, ACO.nodes[ACO.bestTour[0]].y);
    for (let i = 1; i < ACO.bestTour.length; i++)
      ctx.lineTo(ACO.nodes[ACO.bestTour[i]].x, ACO.nodes[ACO.bestTour[i]].y);
    // close
    ctx.lineTo(ACO.nodes[ACO.bestTour[0]].x, ACO.nodes[ACO.bestTour[0]].y);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth   = 2.5;
    ctx.setLineDash([9, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // City nodes
  ACO.nodes.forEach(n =>
    drawCityNode(ctx, n, 0, n.tp === 'hub' ? '#fb923c' : '#2997ff')
  );

  // Ants
  for (const ant of ACO.ants) {
    ctx.save();
    ctx.shadowColor = ant.ret ? 'rgba(251,191,36,.6)' : 'rgba(249,115,22,.55)';
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.arc(ant.px, ant.py, 3, 0, Math.PI * 2);
    ctx.fillStyle = ant.ret ? '#fbbf24' : '#f97316';
    ctx.fill();
    ctx.restore();
  }
}

// ── RESET ─────────────────────────────────────────────
function resetACO(soft) {
  ACO.running = false;
  cancelAnimationFrame(ACO.animFrame);
  ACO.nodes      = [];
  ACO.obstacles  = [];
  ACO.pheromone  = null;
  ACO.ants       = [];
  ACO.iter       = 0;
  ACO.found      = 0;
  ACO.bestDist   = Infinity;
  ACO.bestTour   = [];
  ACO.stagnant   = 0;
  if (!soft) resetCityIdx();

  const runBtn = document.getElementById('acoRunBtn');
  runBtn.textContent = '▶ Run';
  runBtn.className   = 'btn-action success';
  document.getElementById('acoBadge').className   = 'badge-pill';
  document.getElementById('acoBadge').textContent = 'Idle';
  ['acoAnts','acoCycles','acoRoutes'].forEach(id =>
    document.getElementById(id).textContent = '0'
  );
  ['acoBest','acoBestR','acoConv'].forEach(id =>
    document.getElementById(id).textContent = '—'
  );
  document.getElementById('acoObsCount').textContent = '0';
  document.getElementById('acoMeta').textContent = '—';
  document.getElementById('acoCanvasStatus').textContent = 'Place cities → Initialize → Run';
  setGlobalStatus('Ready', 'var(--green)');

  fitCanvas(ACO.canvas);
  clearCanvas(ACO.ctx, ACO.canvas.width, ACO.canvas.height);
  drawPlaceholder(ACO.ctx, ACO.canvas.width, ACO.canvas.height,
    'Place cities and obstacles, then Initialize and Run');
}
