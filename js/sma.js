// ═══════════════════════════════════════════════════════
//  PATHMIND — SLIME MOULD ALGORITHM ENGINE
// ═══════════════════════════════════════════════════════
'use strict';

// ── State ─────────────────────────────────────────────
const SMA = {
  canvas:     null,
  ctx:        null,
  wrap:       null,
  cities:     [],
  obstacles:  [],
  mode:       'city',
  dragging:   false,
  dragStart:  null,
  tempRect:   null,
  result:     null,   // { paths, totalDist }
  animFrame:  null,
  pulse:      0,
  running:    false
};

// ── Initialise DOM bindings ────────────────────────────
function initSMAPage() {
  SMA.canvas = document.getElementById('smaCanvas');
  SMA.ctx    = SMA.canvas.getContext('2d');
  SMA.wrap   = document.getElementById('smaCanvasContainer');

  // Canvas events
  SMA.canvas.addEventListener('mousedown', onSMAMouseDown);
  SMA.canvas.addEventListener('mousemove', onSMAMouseMove);
  SMA.canvas.addEventListener('mouseup',   onSMAMouseUp);
  SMA.canvas.addEventListener('mouseleave',onSMAMouseLeave);

  // Touch support
  SMA.canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    onSMAMouseDown(touchToMouse(e));
  }, {passive: false});
  SMA.canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    onSMAMouseMove(touchToMouse(e));
  }, {passive: false});
  SMA.canvas.addEventListener('touchend', e => {
    e.preventDefault();
    onSMAMouseUp(touchToMouse(e));
  }, {passive: false});

  fitCanvas(SMA.canvas);
  smaRenderIdle();
}

function touchToMouse(e) {
  const t = e.touches[0] || e.changedTouches[0];
  return { clientX: t.clientX, clientY: t.clientY };
}

// ── Draw Mode ─────────────────────────────────────────
function setSMode(mode, btn) {
  SMA.mode = mode;
  document.querySelectorAll('#smaModeGrid .mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const hints = {
    city:     'Click on the canvas to place a city node.',
    building: 'Click and drag to draw a building block.',
    water:    'Click and drag to draw a water body.',
    erase:    'Click a city to remove it. Drag over an obstacle to erase it.'
  };
  document.getElementById('smaModeHint').textContent = hints[mode];
}

// ── Canvas Events ─────────────────────────────────────
function onSMAMouseDown(e) {
  fitCanvas(SMA.canvas);
  const pt = canvasXY(SMA.canvas, e);

  if (SMA.mode === 'city') {
    if (SMA.cities.length >= 14) return;
    SMA.cities.push({ x: pt.x, y: pt.y, name: nextCityName(), pulse: 0 });
    SMA.result = null;
    updateSMASidebar();
    smaRenderIdle();

  } else if (SMA.mode === 'erase') {
    // Remove city if near
    const prev = SMA.cities.length;
    SMA.cities = SMA.cities.filter(c => Math.hypot(c.x - pt.x, c.y - pt.y) > 24);
    if (SMA.cities.length !== prev) _cityIdx = Math.max(0, _cityIdx - 1);
    // Remove obstacle under cursor
    SMA.obstacles = SMA.obstacles.filter(o =>
      !(pt.x >= o.x && pt.x <= o.x + o.w && pt.y >= o.y && pt.y <= o.y + o.h)
    );
    SMA.result = null;
    updateSMASidebar();
    smaRenderIdle();

  } else {
    SMA.dragging  = true;
    SMA.dragStart = pt;
  }
}

function onSMAMouseMove(e) {
  if (!SMA.dragging) return;
  const pt = canvasXY(SMA.canvas, e);
  SMA.tempRect = {
    x:  Math.min(SMA.dragStart.x, pt.x),
    y:  Math.min(SMA.dragStart.y, pt.y),
    w:  Math.abs(pt.x - SMA.dragStart.x),
    h:  Math.abs(pt.y - SMA.dragStart.y),
    tp: SMA.mode
  };
  smaRenderIdle();
}

function onSMAMouseUp() {
  if (!SMA.dragging) return;
  SMA.dragging = false;
  if (SMA.tempRect && SMA.tempRect.w > 8 && SMA.tempRect.h > 8) {
    SMA.obstacles.push({ ...SMA.tempRect });
    SMA.result = null;
  }
  SMA.tempRect = null;
  updateSMASidebar();
  smaRenderIdle();
}

function onSMAMouseLeave() {
  SMA.dragging = false;
  SMA.tempRect = null;
  smaRenderIdle();
}

// ── Sidebar updates ───────────────────────────────────
function updateSMASidebar() {
  document.getElementById('smaCities').textContent = SMA.cities.length;
  document.getElementById('smaObs').textContent    = SMA.obstacles.length;

  const list = document.getElementById('smaCityList');
  if (!SMA.cities.length) {
    list.innerHTML = '<div class="city-list-empty">No cities placed yet.</div>';
    return;
  }
  list.innerHTML = SMA.cities.map((c, i) =>
    `<div class="city-tag">
      <span class="city-dot"></span>
      <span>${c.name}</span>
      <span class="city-idx">#${String(i + 1).padStart(2,'0')}</span>
    </div>`
  ).join('');
}

// ── Idle render (no simulation running) ───────────────
function smaRenderIdle() {
  cancelAnimationFrame(SMA.animFrame);
  fitCanvas(SMA.canvas);
  _smaDrawFrame();
  if (SMA.result) {
    // Keep animating to show path pulse
    SMA.animFrame = requestAnimationFrame(() => {
      SMA.pulse++;
      smaRenderIdle();
    });
  }
}

function _smaDrawFrame() {
  const ctx = SMA.ctx;
  const W = SMA.canvas.width, H = SMA.canvas.height;

  clearCanvas(ctx, W, H);
  SMA.obstacles.forEach(o => drawObstacle(ctx, o));
  if (SMA.tempRect) drawTempRect(ctx, SMA.tempRect);

  if (SMA.result) {
    _drawSMAResult(ctx, W, H);
  } else if (!SMA.cities.length) {
    drawPlaceholder(ctx, W, H, 'Place 2+ cities, draw obstacles, then click ▶ Compute Path');
  }

  SMA.cities.forEach(c => {
    c.pulse += 0.06;
    drawCityNode(ctx, c, c.pulse, '#2997ff');
  });
}

function _drawSMAResult(ctx, W, H) {
  const { trailData, trailW, trailH, obsMap, paths } = SMA.result;
  const pulse = Math.sin(SMA.pulse * 0.04);

  // Only draw trail if canvas size matches
  if (trailW === W && trailH === H && trailData) {
    const img = ctx.createImageData(W, H);
    const d = img.data;
    let maxT = 0;
    for (let i = 0; i < trailData.length; i++) if (trailData[i] > maxT) maxT = trailData[i];
    if (maxT > 0) {
      for (let i = 0; i < W * H; i++) {
        if (obsMap[i] > 0) continue;
        const v = trailData[i] / maxT;
        if (v > 0.015) {
          const bv = Math.pow(v, 0.65);
          d[i*4]   = (bv * 15)  | 0;
          d[i*4+1] = (bv * 60)  | 0;
          d[i*4+2] = (bv * 100) | 0;
          d[i*4+3] = (v  * 70)  | 0;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // Draw extracted paths
  for (const seg of paths) {
    if (!seg || seg.length < 2) continue;
    const W2 = trailW;

    // Glow
    ctx.save();
    ctx.shadowColor  = `rgba(52,211,153,${0.5 + pulse * 0.3})`;
    ctx.shadowBlur   = 18 + pulse * 6;
    ctx.beginPath();
    ctx.moveTo(seg[0] % W2, (seg[0] / W2) | 0);
    for (let i = 1; i < seg.length; i += 2) // subsample for speed
      ctx.lineTo(seg[i] % W2, (seg[i] / W2) | 0);
    ctx.strokeStyle = `rgba(52,211,153,${0.7 + pulse * 0.25})`;
    ctx.lineWidth   = 3;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
    ctx.restore();

    // Crisp path
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(seg[0] % W2, (seg[0] / W2) | 0);
    for (let i = 1; i < seg.length; i += 2)
      ctx.lineTo(seg[i] % W2, (seg[i] / W2) | 0);
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

// ── LOAD DEMO ─────────────────────────────────────────
function loadSMADemo() {
  resetSMA(true);
  fitCanvas(SMA.canvas);
  const W = SMA.canvas.width, H = SMA.canvas.height;

  SMA.cities = [
    { x: W * .12, y: H * .14, name: 'Northgate',  pulse: 0 },
    { x: W * .88, y: H * .14, name: 'Southport',  pulse: 0 },
    { x: W * .88, y: H * .86, name: 'Eastholm',   pulse: 0 },
    { x: W * .12, y: H * .86, name: 'Westbury',   pulse: 0 },
    { x: W * .50, y: H * .07, name: 'Central',    pulse: 0 },
    { x: W * .50, y: H * .93, name: 'Riverside',  pulse: 0 },
    { x: W * .18, y: H * .50, name: 'Uptown',     pulse: 0 },
    { x: W * .82, y: H * .50, name: 'Midway',     pulse: 0 },
  ];
  _cityIdx = 8;

  SMA.obstacles = [
    { x: W*.28, y: H*.09, w: W*.14, h: H*.20, tp:'building' },
    { x: W*.58, y: H*.09, w: W*.14, h: H*.20, tp:'building' },
    { x: W*.28, y: H*.70, w: W*.14, h: H*.20, tp:'building' },
    { x: W*.58, y: H*.70, w: W*.14, h: H*.20, tp:'building' },
    { x: W*.36, y: H*.32, w: W*.28, h: H*.24, tp:'water'    },
    { x: W*.10, y: H*.27, w: W*.08, h: H*.28, tp:'building' },
    { x: W*.82, y: H*.27, w: W*.08, h: H*.28, tp:'building' },
  ];

  updateSMASidebar();
  smaRenderIdle();
  document.getElementById('smaCanvasStatus').textContent = 'Demo loaded — click ▶ Compute Path';
}

// ── RESET ─────────────────────────────────────────────
function resetSMA(soft) {
  cancelAnimationFrame(SMA.animFrame);
  SMA.result    = null;
  SMA.running   = false;
  SMA.cities    = [];
  SMA.obstacles = [];
  SMA.pulse     = 0;
  if (!soft) resetCityIdx();

  document.getElementById('smaBadge').className = 'badge-pill';
  document.getElementById('smaBadge').textContent = 'Idle';
  document.getElementById('smaResultBox').style.display = 'none';
  document.getElementById('smaNoResult').style.display  = 'block';
  document.getElementById('smaCanvasStatus').textContent = 'Place 2+ cities then click Compute Path';
  document.getElementById('smaIterDisplay').textContent  = '—';
  ['smaTime','smaSegments','smaCoverage'].forEach(id =>
    document.getElementById(id).textContent = '—'
  );
  document.getElementById('smaPhase').textContent = 'IDLE';
  document.getElementById('smaAgents').textContent = '—';
  document.getElementById('smaIter').textContent   = '—';

  updateSMASidebar();
  fitCanvas(SMA.canvas);
  clearCanvas(SMA.ctx, SMA.canvas.width, SMA.canvas.height);
  drawPlaceholder(SMA.ctx, SMA.canvas.width, SMA.canvas.height,
    'Place 2+ cities, draw obstacles, then click ▶ Compute Path');
  setGlobalStatus('Ready', 'var(--green)');
}

// ── RUN SMA ───────────────────────────────────────────
function runSMA() {
  if (SMA.cities.length < 2) {
    alert('Please place at least 2 city nodes before computing.');
    return;
  }
  if (SMA.running) return;
  SMA.running = true;

  fitCanvas(SMA.canvas);
  const W = SMA.canvas.width;
  const H = SMA.canvas.height;

  const N_AGENTS   = parseInt(document.getElementById('sc-agt').value);
  const SENS_ANGLE = parseFloat(document.getElementById('sc-ang').value) * Math.PI / 180;
  const EVAP       = parseFloat(document.getElementById('sc-ev').value) / 100;
  const ITERATIONS = parseInt(document.getElementById('sc-it').value);
  const THRESHOLD  = parseFloat(document.getElementById('sc-th').value) / 10;

  // Show compute overlay
  const overlay = document.getElementById('smaComputeOverlay');
  overlay.style.display = 'flex';
  document.getElementById('smaProgressFill').style.width = '0%';
  document.getElementById('smaComputeLabel').textContent = 'Spawning agents…';
  document.getElementById('smaComputeSub').textContent   = `0 / ${ITERATIONS} iterations`;

  document.getElementById('smaBadge').className   = 'badge-pill computing';
  document.getElementById('smaBadge').textContent = 'Computing';
  document.getElementById('smaAgents').textContent = N_AGENTS;
  document.getElementById('smaPhase').textContent  = 'EXPLORING';
  setGlobalStatus('SMA Running', 'var(--amber)');

  const t0 = performance.now();

  // Build obstacle map
  const obsMap = buildObsMap(SMA.obstacles, W, H);

  // Trail buffer
  const trail = new Float32Array(W * H);

  // Spawn agents from all city positions
  const agPerCity = Math.ceil(N_AGENTS / SMA.cities.length);
  const agents = [];
  for (const city of SMA.cities) {
    for (let i = 0; i < agPerCity; i++) {
      let ax, ay, tries = 0;
      do {
        ax = city.x + (Math.random() - .5) * 70;
        ay = city.y + (Math.random() - .5) * 70;
        tries++;
      } while (
        tries < 40 &&
        ax >= 0 && ax < W && ay >= 0 && ay < H &&
        obsMap[(ay | 0) * W + (ax | 0)] > 0
      );
      ax = clamp(ax, 2, W - 3);
      ay = clamp(ay, 2, H - 3);
      agents.push({ x: ax, y: ay, a: Math.random() * Math.PI * 2 });
    }
  }

  const SPEED   = 2;
  const DEPOSIT = 12;
  const SENS_D  = 22;
  const BEACON  = 28; // city beacon radius

  let iter = 0;
  const CHUNK = 25;

  function simulate() {
    for (let ci = 0; ci < CHUNK && iter < ITERATIONS; ci++, iter++) {
      // Evaporate
      for (let i = 0; i < W * H; i++) trail[i] *= EVAP;

      // City beacons — strong deposit halo around each city
      for (const city of SMA.cities) {
        const cx = city.x | 0, cy = city.y | 0;
        for (let dy = -BEACON; dy <= BEACON; dy++) {
          for (let dx = -BEACON; dx <= BEACON; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
            if (obsMap[ny * W + nx] > 0) continue;
            const dist2 = dx * dx + dy * dy;
            if (dist2 <= BEACON * BEACON)
              trail[ny * W + nx] += DEPOSIT * 10 * (1 - Math.sqrt(dist2) / BEACON);
          }
        }
      }

      // Move agents
      for (const ag of agents) {
        // Sense three directions
        const sense = da => {
          const sx = (ag.x + Math.cos(ag.a + da) * SENS_D) | 0;
          const sy = (ag.y + Math.sin(ag.a + da) * SENS_D) | 0;
          if (sx < 0 || sx >= W || sy < 0 || sy >= H) return -5;
          if (obsMap[sy * W + sx] > 0) return -20;
          return trail[sy * W + sx];
        };

        const fl = sense(-SENS_ANGLE);
        const fc = sense(0);
        const fr = sense(SENS_ANGLE);

        if      (fc >= fl && fc >= fr) { /* keep heading */ }
        else if (fl  > fr)             { ag.a -= SENS_ANGLE * 0.5; }
        else if (fr  > fl)             { ag.a += SENS_ANGLE * 0.5; }
        else                           { ag.a += (Math.random() - .5) * 0.55; }

        // Move
        const nx = ag.x + Math.cos(ag.a) * SPEED;
        const ny = ag.y + Math.sin(ag.a) * SPEED;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && obsMap[(ny | 0) * W + (nx | 0)] === 0) {
          ag.x = nx; ag.y = ny;
        } else {
          ag.a += Math.PI * (0.4 + Math.random() * 0.9);
        }

        // Clamp
        ag.x = clamp(ag.x, 2, W - 3);
        ag.y = clamp(ag.y, 2, H - 3);

        // Deposit
        const tx = ag.x | 0, ty = ag.y | 0;
        if (obsMap[ty * W + tx] === 0) trail[ty * W + tx] += DEPOSIT;
      }
    }

    // Update progress
    const pct = (iter / ITERATIONS * 100).toFixed(0);
    document.getElementById('smaProgressFill').style.width = pct + '%';
    document.getElementById('smaComputeSub').textContent   = `${iter} / ${ITERATIONS} iterations`;
    document.getElementById('smaIter').textContent         = iter;

    if (iter < ITERATIONS) {
      const phase = iter < ITERATIONS * 0.3 ? 'EXPLORING'
                  : iter < ITERATIONS * 0.75 ? 'REINFORCING'
                  : 'CONVERGING';
      document.getElementById('smaPhase').textContent = phase;
      document.getElementById('smaComputeLabel').textContent =
        phase === 'EXPLORING'   ? 'Agents spreading across map…' :
        phase === 'REINFORCING' ? 'Corridors forming between cities…' :
                                  'Optimal paths converging…';
      setTimeout(simulate, 0);
    } else {
      extractAndShow(trail, obsMap, W, H, THRESHOLD, t0, N_AGENTS);
    }
  }

  simulate();
}

// ── PATH EXTRACTION (Dijkstra on trail map) ───────────
function extractPath(trail, obsMap, W, H, startCity, endCity, threshold) {
  const sx = startCity.x | 0, sy = startCity.y | 0;
  const ex = endCity.x   | 0, ey = endCity.y   | 0;

  // Clamp
  const sx_ = clamp(sx, 0, W-1), sy_ = clamp(sy, 0, H-1);
  const ex_ = clamp(ex, 0, W-1), ey_ = clamp(ey, 0, H-1);

  // Find max trail for normalisation
  let maxT = 0;
  for (let i = 0; i < W * H; i++) if (trail[i] > maxT) maxT = trail[i];
  if (maxT < 1) return null;

  const thr = maxT * threshold;

  const INF = 1e9;
  const dist = new Float32Array(W * H).fill(INF);
  const prev = new Int32Array(W * H).fill(-1);
  const startIdx = sy_ * W + sx_;
  dist[startIdx] = 0;

  // Simple BFS-style Dijkstra with array-based min-heap
  // Using a flat array sorted on demand (acceptable for this grid size ≤ 1200×700)
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];

  // Priority queue (simplified)
  const pq = [[0, startIdx]];

  const endIdx = ey_ * W + ex_;

  while (pq.length) {
    // Find min
    let minI = 0;
    for (let k = 1; k < pq.length; k++) if (pq[k][0] < pq[minI][0]) minI = k;
    const [d, idx] = pq[minI];
    pq.splice(minI, 1);

    if (d > dist[idx]) continue;
    if (idx === endIdx) break;

    const x = idx % W, y = (idx / W) | 0;

    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      if (obsMap[ni] > 0) continue;

      const step = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
      // Cost: low where trail is strong, high where it's weak
      const tc = trail[ni];
      const trailCost = tc >= thr ? 0 : (tc > thr * 0.2 ? 1 : 3.5);
      const nd = d + step + trailCost;

      if (nd < dist[ni]) {
        dist[ni] = nd;
        prev[ni] = idx;
        pq.push([nd, ni]);
      }
    }
  }

  if (dist[endIdx] === INF) return null;

  // Trace back
  const path = [];
  let cur = endIdx;
  let steps = 0;
  while (cur !== -1 && steps++ < W * H) {
    path.push(cur);
    cur = prev[cur];
  }
  path.reverse();
  return path;
}

function extractAndShow(trail, obsMap, W, H, threshold, t0, nAgents) {
  document.getElementById('smaComputeLabel').textContent = 'Extracting shortest paths…';

  // Extract path between every consecutive city pair
  const paths = [];
  let totalDist = 0;

  for (let i = 0; i < SMA.cities.length - 1; i++) {
    const p = extractPath(trail, obsMap, W, H, SMA.cities[i], SMA.cities[i + 1], threshold);
    paths.push(p);
    if (p) totalDist += _pathPixelLen(p, W);
  }

  // For > 2 cities, also close the loop (last → first)
  if (SMA.cities.length > 2) {
    const p = extractPath(trail, obsMap, W, H, SMA.cities[SMA.cities.length - 1], SMA.cities[0], threshold);
    paths.push(p);
    if (p) totalDist += _pathPixelLen(p, W);
  }

  SMA.result = { trailData: trail, trailW: W, trailH: H, obsMap, paths, totalDist };
  SMA.pulse = 0;
  SMA.running = false;

  // Hide overlay
  document.getElementById('smaComputeOverlay').style.display = 'none';

  // Update UI
  const elapsed = (performance.now() - t0).toFixed(0);
  const cityStr = SMA.cities.map(c => c.name).join(' → ')
    + (SMA.cities.length > 2 ? ' → ' + SMA.cities[0].name : '');

  document.getElementById('smaBadge').className   = 'badge-pill done';
  document.getElementById('smaBadge').textContent = 'Done';
  document.getElementById('smaResultBox').style.display = 'block';
  document.getElementById('smaNoResult').style.display  = 'none';
  document.getElementById('smaResultCities').textContent = cityStr;
  document.getElementById('smaResultDist').textContent   = Math.round(totalDist) + ' px';

  // Coverage
  const cov = Array.from(trail).filter(v => v > 0.5).length;
  const covPct = (cov / (W * H) * 100).toFixed(1);

  document.getElementById('smaTime').textContent     = elapsed + ' ms';
  document.getElementById('smaSegments').textContent = paths.filter(Boolean).length;
  document.getElementById('smaCoverage').textContent = covPct + '%';
  document.getElementById('smaPhase').textContent    = 'COMPLETE';
  document.getElementById('smaCanvasStatus').textContent =
    `Path found in ${elapsed}ms — Total: ${Math.round(totalDist)} px`;

  setGlobalStatus('Path Found', 'var(--green)');
  smaRenderIdle();
}

function _pathPixelLen(path, W) {
  let d = 0;
  for (let i = 1; i < path.length; i++) {
    const ax = path[i-1] % W, ay = (path[i-1] / W) | 0;
    const bx = path[i]   % W, by = (path[i]   / W) | 0;
    d += Math.sqrt((bx-ax)**2 + (by-ay)**2);
  }
  return d;
}
