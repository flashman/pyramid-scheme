# Cold-Start Loading Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an animated hourglass loading screen while the Render backend cold-starts, polling `/api/config` until it responds, then dismissing and proceeding to the auth overlay.

**Architecture:** Two new ES module files in `frontend/ui/` — `loading-hourglass.js` (canvas simulation, primary) and `loading-hieroglyph.js` (CSS slot-machine, not wired up). `main.js` calls `waitForBackend()` before `requireAuth()`. No backend changes.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D API, CSS transforms, `fetch`

---

### Task 1: Create `loading-hourglass.js`

**Files:**
- Create: `frontend/ui/loading-hourglass.js`

- [ ] **Step 1: Create the file**

Create `frontend/ui/loading-hourglass.js` with the full content below:

```js
// Hourglass loading screen — shown while the Render backend cold-starts.
// Exports waitForBackend(): resolves when GET /api/config returns 200.

const CSS = `
#hg-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: #0a0500;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-family: monospace;
  transition: opacity 0.3s;
}
#hg-title {
  color: #f0c020;
  font-size: 12px;
  letter-spacing: 3px;
  margin-bottom: 24px;
}
#hg-wrap {
  transform-origin: center center;
  will-change: transform;
}
#hg-caption {
  color: #8a6a20;
  font-size: 6px;
  letter-spacing: 2px;
  margin-top: 14px;
  min-height: 12px;
}
`;

export function waitForBackend() {
  return new Promise(resolve => {
    const BASE = window.API_BASE || '';

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'hg-overlay';
    overlay.innerHTML = `
      <div id="hg-title">⚡ PYRAMID SCHEME™ ⚡</div>
      <div id="hg-wrap">
        <canvas id="hg-canvas" width="160" height="220"></canvas>
      </div>
      <div id="hg-caption">THE GODS REQUIRE TIME</div>
    `;
    document.body.appendChild(overlay);

    const stopAnim = _startHourglass(
      document.getElementById('hg-canvas'),
      document.getElementById('hg-wrap'),
      document.getElementById('hg-caption'),
    );

    async function poll() {
      try {
        const res = await fetch(`${BASE}/api/config`);
        if (res.ok) {
          stopAnim();
          overlay.style.opacity = '0';
          setTimeout(() => { overlay.remove(); style.remove(); resolve(); }, 300);
          return;
        }
      } catch { /* backend not up yet */ }
      setTimeout(poll, 3000);
    }
    poll();
  });
}

function _startHourglass(canvas, wrap, caption) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const CX = W / 2, CY = H / 2;

  const TOP_Y = 14, BOT_Y = H - 14;
  const TOP_W = 54, BOT_W = 54;
  const NECK_YT = H * 0.47, NECK_YB = H * 0.53;
  const NECK_W = 3;
  const SPEED = 0.00018;

  let sandRatio = 0;
  let state = 'draining';
  let flipDeg = 0;
  let flipProg = 0;
  let pauseTimer = 0;
  const PAUSE_DUR = 0.7;
  const FLIP_DUR = 1.1;

  const particles = [];
  let running = true;

  const LABELS = [
    'THE GODS REQUIRE TIME',
    'THE SANDS FALL...',
    'PATIENCE, PHARAOH...',
    'NEARLY THERE...',
    'THE DESERT STIRS...',
  ];

  function makeWorldGrad() {
    const θ = flipDeg * Math.PI / 180;
    const len = (BOT_Y - TOP_Y) / 2;
    const g = ctx.createLinearGradient(
      CX - Math.sin(θ) * len, CY - Math.cos(θ) * len,
      CX + Math.sin(θ) * len, CY + Math.cos(θ) * len,
    );
    g.addColorStop(0,    '#f0d060');
    g.addColorStop(0.15, '#d08820');
    g.addColorStop(0.45, '#a06010');
    g.addColorStop(0.75, '#6a3c08');
    g.addColorStop(1,    '#3a1e00');
    return g;
  }

  function glassPath() {
    ctx.beginPath();
    ctx.moveTo(CX - TOP_W/2, TOP_Y);
    ctx.bezierCurveTo(CX-TOP_W/2, TOP_Y+30, CX-NECK_W/2, NECK_YT-10, CX-NECK_W/2, NECK_YT);
    ctx.lineTo(CX - NECK_W/2, NECK_YB);
    ctx.bezierCurveTo(CX-NECK_W/2, NECK_YB+10, CX-BOT_W/2, BOT_Y-30, CX-BOT_W/2, BOT_Y);
    ctx.lineTo(CX + BOT_W/2, BOT_Y);
    ctx.bezierCurveTo(CX+BOT_W/2, BOT_Y-30, CX+NECK_W/2, NECK_YB+10, CX+NECK_W/2, NECK_YB);
    ctx.lineTo(CX + NECK_W/2, NECK_YT);
    ctx.bezierCurveTo(CX+NECK_W/2, NECK_YT-10, CX+TOP_W/2, TOP_Y+30, CX+TOP_W/2, TOP_Y);
    ctx.closePath();
  }

  function drawSand() {
    const grad = makeWorldGrad();
    if (sandRatio < 0.99) {
      const surf = TOP_Y + sandRatio * (NECK_YT - TOP_Y);
      ctx.save(); glassPath(); ctx.clip();
      ctx.fillStyle = grad;
      ctx.fillRect(CX-TOP_W/2-2, surf, TOP_W+4, NECK_YT-surf+4);
      ctx.beginPath();
      for (let x = CX-TOP_W/2; x <= CX+TOP_W/2; x += 2) {
        const r = Math.sin(x*0.3 + Date.now()*0.002) * 0.7;
        x === Math.ceil(CX-TOP_W/2) ? ctx.moveTo(x, surf+r) : ctx.lineTo(x, surf+r);
      }
      ctx.strokeStyle = 'rgba(240,220,80,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
    if (sandRatio > 0.01) {
      const surf = BOT_Y - sandRatio * (BOT_Y - NECK_YB);
      ctx.save(); glassPath(); ctx.clip();
      ctx.fillStyle = grad;
      ctx.fillRect(CX-BOT_W/2-2, surf, BOT_W+4, BOT_Y-surf+2);
      ctx.beginPath();
      ctx.moveTo(CX-BOT_W/2, surf+3);
      ctx.quadraticCurveTo(CX, surf-3, CX+BOT_W/2, surf+3);
      ctx.strokeStyle = 'rgba(240,200,60,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
  }

  function drawGlass() {
    ctx.save();
    ctx.shadowColor = '#c89030'; ctx.shadowBlur = 8;
    glassPath(); ctx.strokeStyle = '#8a6a20'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(CX-TOP_W/2+6, TOP_Y+4);
    ctx.bezierCurveTo(CX-TOP_W/2+6, TOP_Y+28, CX-NECK_W/2+3, NECK_YT-8, CX-NECK_W/2+3, NECK_YT);
    ctx.strokeStyle = 'rgba(255,230,120,0.11)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#c89030'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CX-TOP_W/2-4, TOP_Y); ctx.lineTo(CX+TOP_W/2+4, TOP_Y);
    ctx.moveTo(CX-BOT_W/2-4, BOT_Y); ctx.lineTo(CX+BOT_W/2+4, BOT_Y);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI*2);
      ctx.fillStyle = `rgba(240,192,32,${p.life})`; ctx.fill();
    });
  }

  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  let lastTs = null, ptTimer = 0;

  function frame(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    if (state === 'draining') {
      sandRatio = Math.min(1, sandRatio + SPEED * 1000 * dt);
      caption.textContent = LABELS[Math.min(4, Math.floor(sandRatio * 5))];
      ptTimer += dt;
      if (ptTimer > 0.09) {
        if (particles.length < 6 && sandRatio > 0.02 && sandRatio < 0.98) {
          particles.push({ x: CX+(Math.random()-0.5)*NECK_W, y: NECK_YT, vy: 1.0+Math.random()*1.2, life: 1 });
        }
        ptTimer = 0;
      }
      if (sandRatio >= 1) { state = 'pause'; pauseTimer = 0; particles.length = 0; }

    } else if (state === 'pause') {
      pauseTimer += dt;
      caption.textContent = 'TURNING THE GLASS...';
      if (pauseTimer >= PAUSE_DUR) { state = 'flipping'; flipProg = 0; }

    } else if (state === 'flipping') {
      flipProg = Math.min(1, flipProg + dt / FLIP_DUR);
      flipDeg = 180 * easeInOut(flipProg);
      wrap.style.transform = `rotate(${flipDeg}deg)`;
      caption.textContent = 'TURNING THE GLASS...';
      if (flipProg >= 1) {
        wrap.style.transform = 'rotate(0deg)';
        flipDeg = 0;
        sandRatio = 1 - sandRatio;
        state = 'draining';
      }
    }

    for (let i = particles.length-1; i >= 0; i--) {
      const p = particles[i];
      p.y += p.vy; p.vy += 0.1; p.life -= 0.035;
      if (p.y > NECK_YB+12 || p.life <= 0) particles.splice(i, 1);
    }

    ctx.clearRect(0, 0, W, H);
    drawSand(); drawGlass();
    if (state === 'draining') drawParticles();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  return () => { running = false; };
}
```

- [ ] **Step 2: Verify the file exists**

```bash
ls frontend/ui/loading-hourglass.js
```
Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add frontend/ui/loading-hourglass.js
git commit -m "add hourglass cold-start loading screen"
```

---

### Task 2: Create `loading-hieroglyph.js`

**Files:**
- Create: `frontend/ui/loading-hieroglyph.js`

This file is added to the codebase for future use but is **not wired up** in `main.js`.

- [ ] **Step 1: Create the file**

Create `frontend/ui/loading-hieroglyph.js`:

```js
// Hieroglyph slot-machine loading screen — alternative to loading-hourglass.js.
// Not currently wired up in main.js. Swap the import there to use this instead.
// Exports waitForBackend(): resolves when GET /api/config returns 200.

const GLYPHS = ['𓂀','𓋹','𓆣','𓇯','𓁶','𓆄','𓃭','𓏏','𓆑','𓅓'];
const COLORS = ['#f0c020','#c89030','#a07020','#8a6a20','#6a4010','#4a2c00'];
const PHASES = [
  'CONSULTING THE ORACLE...',
  'SUMMONING THE DESERT...',
  'THE PYRAMID AWAKENS...',
];

const CSS = `
#hiero-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: #0a0500;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-family: monospace;
  transition: opacity 0.3s;
}
#hiero-title {
  color: #f0c020; font-size: 12px; letter-spacing: 3px;
  margin-bottom: 24px;
}
#hiero-slot {
  width: 280px;
  border: 1px solid #3a2000;
  background: #060300;
  overflow: hidden;
  position: relative;
}
#hiero-slot::after {
  content: '';
  position: absolute; inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px, transparent 3px,
    rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px
  );
  pointer-events: none;
}
.hiero-hl {
  position: absolute; left: 0; right: 0; top: 50%;
  transform: translateY(-50%);
  height: 36px;
  border-top: 1px solid rgba(138,106,32,0.27);
  border-bottom: 1px solid rgba(138,106,32,0.27);
  background: rgba(240,192,32,0.03);
  pointer-events: none;
}
.hiero-row-wrap {
  width: 100%; overflow: hidden; height: 34px;
  display: flex; align-items: center;
  border-bottom: 1px solid #1a0e00;
}
.hiero-row-wrap:last-child { border-bottom: none; }
.hiero-row { display: inline-block; white-space: nowrap; will-change: transform; }
.hiero-row span { font-size: 20px; margin: 0 10px; display: inline-block; }
#hiero-divider {
  width: 200px; height: 1px; background: #2a1800; margin: 16px auto;
}
#hiero-phase {
  color: #8a6a20; font-size: 6px; letter-spacing: 2px;
  height: 12px; margin-bottom: 14px;
}
#hiero-dots span { font-size: 11px; margin: 0 4px; transition: color 0.3s; }
`;

export function waitForBackend() {
  return new Promise(resolve => {
    const BASE = window.API_BASE || '';

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'hiero-overlay';
    overlay.innerHTML = `
      <div id="hiero-title">⚡ PYRAMID SCHEME™ ⚡</div>
      <div id="hiero-slot">
        <div class="hiero-hl"></div>
        <div class="hiero-row-wrap"><div class="hiero-row" id="hiero-r0"></div></div>
        <div class="hiero-row-wrap"><div class="hiero-row" id="hiero-r1"></div></div>
        <div class="hiero-row-wrap"><div class="hiero-row" id="hiero-r2"></div></div>
      </div>
      <div id="hiero-divider"></div>
      <div id="hiero-phase">CONSULTING THE ORACLE...</div>
      <div id="hiero-dots">
        <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
      </div>
    `;
    document.body.appendChild(overlay);

    const stopAnim = _startHieroglyph(overlay);

    async function poll() {
      try {
        const res = await fetch(`${BASE}/api/config`);
        if (res.ok) {
          stopAnim();
          overlay.style.opacity = '0';
          setTimeout(() => { overlay.remove(); style.remove(); resolve(); }, 300);
          return;
        }
      } catch { /* backend not up yet */ }
      setTimeout(poll, 3000);
    }
    poll();
  });
}

function _startHieroglyph(overlay) {
  const rowSpeeds = [28, -19, 13];
  const rowOffsets = [0, 3, 6];
  const LOOP_W = GLYPHS.length * 40;
  const positions = [0, 0, 0];

  const rowEls = [0, 1, 2].map(i => {
    const el = overlay.querySelector(`#hiero-r${i}`);
    const glyphs = [...GLYPHS, ...GLYPHS, ...GLYPHS, ...GLYPHS];
    el.innerHTML = glyphs.map((g, j) =>
      `<span style="color:${COLORS[(j + rowOffsets[i]) % COLORS.length]}">${g}</span>`
    ).join('');
    return el;
  });

  const phaseEl = overlay.querySelector('#hiero-phase');
  const dotSpans = overlay.querySelectorAll('#hiero-dots span');
  let dotStep = 0, phaseIdx = 0;

  const dotsInterval = setInterval(() => {
    dotSpans.forEach((s, i) => { s.style.color = i <= dotStep ? '#f0c020' : '#2a1800'; });
    dotStep++;
    if (dotStep >= dotSpans.length) {
      dotStep = 0;
      phaseIdx = (phaseIdx + 1) % PHASES.length;
      phaseEl.textContent = PHASES[phaseIdx];
    }
  }, 500);

  let running = true;
  let last = null;

  function frame(ts) {
    if (!running) return;
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    rowSpeeds.forEach((spd, ri) => {
      positions[ri] = ((positions[ri] + spd * dt) % LOOP_W + LOOP_W) % LOOP_W;
      rowEls[ri].style.transform = `translateX(-${positions[ri]}px)`;
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return () => { running = false; clearInterval(dotsInterval); };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/ui/loading-hieroglyph.js
git commit -m "add hieroglyph slot-machine loading screen (not wired up)"
```

---

### Task 3: Wire `waitForBackend` into `main.js`

**Files:**
- Modify: `frontend/main.js:20,138`

- [ ] **Step 1: Add the import**

In `frontend/main.js`, add this import after the existing `requireAuth` import on line 20:

```js
import { requireAuth }            from './ui/auth.js';
import { waitForBackend }         from './ui/loading-hourglass.js';
```

- [ ] **Step 2: Call `waitForBackend` before `requireAuth`**

In the `init()` function in `frontend/main.js`, the current lines 136-138 are:

```js
async function init() {
  initDevPanel();

  const token = await requireAuth();
```

Replace with:

```js
async function init() {
  initDevPanel();

  await waitForBackend();
  const token = await requireAuth();
```

- [ ] **Step 3: Smoke test locally**

The loading screen should only appear when the backend is unreachable. To test it locally:

```bash
# Start only the frontend (no backend)
docker compose up frontend
```

Open http://localhost:5173 — the hourglass should appear and spin. The label should cycle through THE GODS REQUIRE TIME → THE SANDS FALL... etc.

Then start the backend:
```bash
docker compose up backend db
```

Within a few seconds the loading screen should fade out and the auth overlay should appear.

To test the normal path (backend already up):
```bash
docker compose up --build
```

The loading screen should appear briefly (first poll hits immediately), then dismiss as soon as `/api/config` returns 200.

- [ ] **Step 4: Commit**

```bash
git add frontend/main.js
git commit -m "show hourglass loading screen while backend cold-starts"
```

---

### Task 4: Push and open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin feature/cold-start-loading-screen
```

- [ ] **Step 2: Open PR**

```bash
gh pr create \
  --title "Add hourglass cold-start loading screen" \
  --body "$(cat <<'EOF'
## Summary

- Canvas hourglass simulation shown while the Render backend cold-starts (free tier, ~30–60s)
- Polls \`GET /api/config\` every 3 seconds until 200; fades out and proceeds to auth
- Hieroglyph slot-machine variant added to \`frontend/ui/loading-hieroglyph.js\` (not wired up — swap the import in \`main.js\` to use it)
- Gradient counter-rotates during the flip so lighting stays consistent throughout the animation

## Test Plan
- [ ] \`docker compose up frontend\` (no backend) → hourglass appears and animates
- [ ] Start backend → loading screen fades and auth overlay appears
- [ ] \`docker compose up --build\` (backend already up) → brief loading screen then straight to auth
EOF
)"
```
