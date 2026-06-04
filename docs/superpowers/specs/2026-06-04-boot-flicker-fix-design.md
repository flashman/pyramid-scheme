# Boot Flicker Fix — Design Spec

**Date:** 2026-06-04  
**Status:** Approved

## Problem

On page load, the raw game HTML (title bar, panels, canvas) is briefly visible before any overlay (auth or hourglass) is injected by JS. This causes two flicker variants:

1. **Warm backend, not logged in:** game HTML flashes → auth overlay appears
2. **Cold backend:** game HTML flashes → hourglass appears (or, currently, nothing visible until JS fetches fail)

The previous fix (reverted commit 2ca7951) used a `#boot-screen` div but was reverted to rethink the approach holistically.

## Design

### Two-layer boot protection

| Layer | Element | z-index | Lifetime |
|---|---|---|---|
| Floor | `#boot-screen` (static HTML) | 9997 | First paint → game loop starts |
| Cold-start overlay | `#hg-overlay` (JS-injected) | 9999 | Cold probe fail → backend ready + 5s min |
| Auth | `#auth-overlay` (JS-injected) | 10000 | backend ready → user logs in |

The `#boot-screen` div is the structural fix — it covers the raw HTML from the very first browser paint, before any JS runs. All JS-injected overlays sit above it.

### Warm vs cold detection

`waitForBackend()` probes `GET /api/health` with a **500ms AbortController timeout**:

- Response OK within 500ms → **warm** → return immediately, no hourglass touches the DOM
- Timeout or error → **cold** → inject hourglass overlay, then wait for `Promise.all([minDelay(5000), pollHealth()])`, then fade out (320ms) and resolve

500ms is chosen because warm Render backends respond in 100–300ms, and cold ones don't respond for 10–30 seconds — no ambiguity at the boundary.

### Health polling (cold path)

Poll `GET /api/health` every 3 seconds after the initial failed probe. Resolve when any poll returns `ok`. The 5-second minimum and the health poll race via `Promise.all` — whichever finishes last wins.

### User sequences

**Cold start, not logged in:**
```
HTML loads → #boot-screen covers game
→ probe /api/health → timeout (500ms) → cold
→ hourglass injected (z-index 9999, above boot-screen)
→ Promise.all: [5s timer, health poll every 3s]
→ both resolve → hourglass fades (320ms) → waitForBackend resolves
→ requireAuth() → auth overlay (z-index 10000)
→ user logs in → auth fades → init completes
→ requestAnimationFrame(gameLoop) → #boot-screen removed
```

**Warm, not logged in:**
```
HTML loads → #boot-screen covers game
→ probe /api/health → OK ~100–300ms → warm → no hourglass
→ requireAuth() → restoreToken fails → auth overlay injected (10000)
→ user logs in → auth fades → init completes
→ requestAnimationFrame(gameLoop) → #boot-screen removed
```

**Warm, logged in:**
```
HTML loads → #boot-screen covers game
→ probe /api/health → OK fast → warm → no hourglass
→ requireAuth() → restoreToken succeeds → resolves immediately (no overlay)
→ game init → requestAnimationFrame(gameLoop) → #boot-screen removed
→ first visible frame is the game canvas
```

## File Changes

### `frontend/index.html`
Add one line immediately after `<body>`:
```html
<div id="boot-screen" style="position:fixed;inset:0;z-index:9997;background:#0a0500"></div>
```

### `frontend/ui/loading-hourglass.js`
Rewrite `waitForBackend()` exported function:

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
```

`_probe(BASE)` — fires `GET /api/health` with a 500ms AbortController, returns `true` if `r.ok`, `false` otherwise (timeout or error).

`_showOverlayAndWait(BASE)` — injects the hourglass overlay (existing `_showOverlayAndPoll` logic), but resolves via `Promise.all([_minDelay(MIN_DISPLAY_MS), _pollUntilHealthy(BASE)])` instead of the current poll-only resolve. The `stopAnim` + fade + `overlay.remove()` happen after both promises settle.

`_pollUntilHealthy(BASE)` — polls `GET /api/health` every `POLL_INTERVAL_MS` ms until `r.ok`.

`_minDelay(ms)` — `new Promise(r => setTimeout(r, ms))`.

### `frontend/main.js`
Add one line before `requestAnimationFrame(gameLoop)`:
```js
document.getElementById('boot-screen')?.remove();
```

## Out of Scope
- No changes to auth overlay, game session logic, or backend routes.
- No changes to the hourglass animation itself.
