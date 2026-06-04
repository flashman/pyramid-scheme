# Boot Flicker Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent raw game HTML from ever flashing before the login/hourglass overlay appears, using a static boot-screen div as the structural floor and a 500ms health probe to decide whether to show the hourglass.

**Architecture:** A `#boot-screen` div baked into `index.html` covers the page from the first browser paint. `waitForBackend()` probes `/api/health` with a 500ms timeout — warm backend skips the hourglass entirely; cold backend shows it with a 5s minimum. The boot-screen is removed when the game loop starts, by which point an overlay (auth or hourglass) has already taken over.

**Tech Stack:** Vanilla JS ES modules, no build step, nginx static. Backend FastAPI. Manual browser verification (no JS test runner).

---

### Task 1: Add `#boot-screen` to `index.html`

**Files:**
- Modify: `frontend/index.html` (add one line after `<body>`)

- [ ] **Step 1: Add the boot-screen div**

In `frontend/index.html`, insert immediately after the opening `<body>` tag (before `<div id="title-bar">`):

```html
<body>
<div id="boot-screen" style="position:fixed;inset:0;z-index:9997;background:#0a0500"></div>
<div id="title-bar">
```

- [ ] **Step 2: Verify it appears in the DOM before any JS loads**

Open `frontend/index.html` source in a text editor and confirm `#boot-screen` is the first child of `<body>`, before any `<script>` tags. This ensures the browser paints it on the first frame before JS executes.

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "fix: add boot-screen div to cover raw HTML before JS overlays inject"
```

---

### Task 2: Rewrite `waitForBackend()` in `loading-hourglass.js`

**Files:**
- Modify: `frontend/ui/loading-hourglass.js`

The current file exports `waitForBackend()` and has a private `_showOverlayAndPoll()`. Replace both with the new logic below. The `_startHourglass()` function (line 79 to end of file) is **unchanged** — do not touch it.

- [ ] **Step 1: Replace `waitForBackend()` and `_showOverlayAndPoll()` with new implementation**

Replace everything from line 32 (`export function waitForBackend()`) through line 76 (closing `}` of `_showOverlayAndPoll`) with:

```js
const PROBE_TIMEOUT_MS = 500;
const MIN_DISPLAY_MS   = 5000;
const POLL_INTERVAL_MS = 3000;

export async function waitForBackend() {
  const BASE = window.API_BASE || '';
  const warm = await _probe(BASE);
  if (warm) return;
  await _showOverlayAndWait(BASE);
}

async function _probe(BASE) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const r = await fetch(`${BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    return r.ok;
  } catch {
    return false;
  }
}

function _minDelay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function _pollUntilHealthy(BASE) {
  return new Promise(resolve => {
    async function poll() {
      try {
        const r = await fetch(`${BASE}/api/health`);
        if (r.ok) { resolve(); return; }
      } catch { /* still starting */ }
      setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
  });
}

function _showOverlayAndWait(BASE) {
  return new Promise(resolve => {
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

    Promise.all([_minDelay(MIN_DISPLAY_MS), _pollUntilHealthy(BASE)]).then(() => {
      stopAnim();
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); style.remove(); resolve(); }, 320);
    });
  });
}
```

- [ ] **Step 2: Verify the file structure is correct**

After the edit, the file should read:
1. `const CSS = ...` block (unchanged, lines 3–30)
2. `const PROBE_TIMEOUT_MS`, `MIN_DISPLAY_MS`, `POLL_INTERVAL_MS` constants
3. `export async function waitForBackend()`
4. `async function _probe(BASE)`
5. `function _minDelay(ms)`
6. `function _pollUntilHealthy(BASE)`
7. `function _showOverlayAndWait(BASE)`
8. `function _startHourglass(...)` — **unchanged from original**

- [ ] **Step 3: Commit**

```bash
git add frontend/ui/loading-hourglass.js
git commit -m "fix: rewrite waitForBackend — 500ms health probe, hourglass only on cold start, 5s min display"
```

---

### Task 3: Remove `#boot-screen` in `main.js` when game loop starts

**Files:**
- Modify: `frontend/main.js` (add one line)

- [ ] **Step 1: Add boot-screen removal before `requestAnimationFrame`**

In `frontend/main.js`, find this block near the end of `init()`:

```js
  SoundManager.playRealm('world');
  requestAnimationFrame(gameLoop);
```

Insert one line before it:

```js
  document.getElementById('boot-screen')?.remove();
  SoundManager.playRealm('world');
  requestAnimationFrame(gameLoop);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/main.js
git commit -m "fix: remove boot-screen when game loop starts"
```

---

### Task 4: Manual verification

No automated test runner — verify in browser via Docker Compose.

- [ ] **Step 1: Start the stack**

```bash
docker compose up --build
```

Wait for `uvicorn` to log `Application startup complete.`

- [ ] **Step 2: Verify warm path — no flicker, no hourglass**

1. Open `http://localhost:5173` in a fresh browser tab (no cached session).
2. **Expected:** Dark screen → auth overlay appears smoothly. No raw HTML (title bar, panels) ever visible. No hourglass.
3. Log in or play as guest.
4. **Expected:** Game starts smoothly. No dark flash.

- [ ] **Step 3: Verify warm path — logged in**

1. Reload the page while already logged in (token in localStorage).
2. **Expected:** Dark screen → game canvas appears. No flicker, no hourglass.

- [ ] **Step 4: Simulate cold backend**

In a separate terminal, stop just the backend:

```bash
docker compose stop backend
```

Then open/reload `http://localhost:5173`.

**Expected:** Dark screen → hourglass appears (not a flicker — it should appear and stay). Hourglass animates. Restart the backend:

```bash
docker compose start backend
```

**Expected:** After backend comes up AND at least 5 seconds have elapsed, hourglass fades out → auth overlay appears.

- [ ] **Step 5: Verify 5-second minimum**

If the backend restarts in < 5s (unlikely but possible locally), confirm the hourglass still shows for the full 5s before resolving.
