// ═══════════════════════════════════════════════════════
//  PATHMIND — SHARED UTILITIES
// ═══════════════════════════════════════════════════════
'use strict';

const CITY_NAMES = [
  'Northgate','Southport','Eastholm','Westbury','Central','Riverside',
  'Uptown','Midway','Harbor','Junction','Summit','Lakeside','Crossroads',
  'Terminal','Skyline','Oldtown','Ironbridge','Clearwater','Duskwood',
  'Newfield','Silverton','Ashford','Crestview','Millhaven'
];

let _cityIdx = 0;
function nextCityName() { return CITY_NAMES[_cityIdx++ % CITY_NAMES.length]; }
function resetCityIdx() { _cityIdx = 0; }

// Canvas pointer coordinates (scaled)
function canvasXY(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width  / r.width),
    y: (e.clientY - r.top)  * (canvas.height / r.height)
  };
}

// Resize canvas to fill its CSS container
function fitCanvas(canvas) {
  const parent = canvas.parentElement;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w;
    canvas.height = h;
    return true; // resized
  }
  return false;
}

// Build a Uint8Array obstacle map  (0=free, 1=building, 2=water)
function buildObsMap(obstacles, W, H) {
  const map = new Uint8Array(W * H);
  for (const o of obstacles) {
    const val = o.tp === 'water' ? 2 : 1;
    const x0 = Math.max(0, o.x | 0), y0 = Math.max(0, o.y | 0);
    const x1 = Math.min(W - 1, (o.x + o.w) | 0);
    const y1 = Math.min(H - 1, (o.y + o.h) | 0);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        map[y * W + x] = val;
  }
  return map;
}

// Edge cost between two points given obstacle list
function edgeObsCost(ax, ay, bx, by, obstacles) {
  if (!obstacles.length) return 1;
  const N = 32; let pen = 0;
  for (let s = 0; s <= N; s++) {
    const t = s / N;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const o of obstacles)
      if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h)
        pen += (o.tp === 'water' ? 3 : 2);
  }
  return 1 + pen / (N + 1);
}

// Set global status bar
function setGlobalStatus(text, color) {
  const el = document.getElementById('statusText');
  const dot = document.querySelector('.status-dot');
  if (el) el.textContent = text;
  if (dot) {
    dot.style.background = color || 'var(--green)';
    dot.style.boxShadow  = `0 0 6px ${color || 'var(--green)'}`;
  }
}

// Clamp value
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
