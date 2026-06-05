# Mobile Controls — Design Spec

**Date:** 2026-06-04
**Status:** Approved

## Problem

The game uses keyboard input (← → ↑ ↓ Space) exclusively. Touch device users cannot interact at all.

## Design

### Detection

Check `navigator.maxTouchPoints > 0` once at init. If false, `initMobileControls()` returns immediately and nothing is injected into the DOM.

### Layout

A single d-pad cluster, fixed to the bottom-center of the viewport:

```
      [↑]
  [←] [⚡] [→]
      [↓]
```

- `position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%)`
- Stays centered regardless of scroll or zoom
- ⚡ = Space (interact)
- Styled to match game aesthetic: dark semi-transparent background (`rgba(10,5,0,0.75)`), gold borders (`#8a6a20`), monospace font

### Input Mechanics

Each button fires synthetic `KeyboardEvent`s on `document`:

| Button | `touchstart` → keydown | `touchend`/`touchcancel` → keyup |
|--------|------------------------|-----------------------------------|
| ↑ | `ArrowUp` | `ArrowUp` |
| ↓ | `ArrowDown` | `ArrowDown` |
| ← | `ArrowLeft` | `ArrowLeft` |
| → | `ArrowRight` | `ArrowRight` |
| ⚡ | ` ` (Space) | ` ` (Space) |

`main.js` already listens on `document` for exactly these key names — no changes needed to the input system.

All touch listeners use `{ passive: false }` and call `e.preventDefault()` to suppress browser scroll/zoom while using the controls.

### Multi-touch

Each direction is a separate DOM element so the browser handles simultaneous touches natively (e.g. holding ← while tapping ⚡).

## File Changes

### New: `frontend/ui/mobile-controls.js`

Self-contained module following the same pattern as `auth.js` and `loading-hourglass.js` — inline CSS string, injects DOM on call, exports a single function.

```js
export function initMobileControls() {
  if (!navigator.maxTouchPoints) return;
  // inject CSS + d-pad HTML
  // wire touchstart/touchend on each button
}
```

### Modify: `frontend/main.js`

Add import and one call after `waitForBackend()`:

```js
import { initMobileControls } from './ui/mobile-controls.js';
// ...
await waitForBackend();
initMobileControls();
```

## Out of Scope

- Swipe gestures
- Gamepad API
- Any changes to realm input handling or keyboard event routing
