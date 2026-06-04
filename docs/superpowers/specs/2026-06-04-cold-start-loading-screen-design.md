# Cold-Start Loading Screen

**Date:** 2026-06-04
**Status:** Approved

## Problem

The frontend is a Render static site that loads instantly, but the backend is on Render's free tier and cold-starts after 15 minutes of inactivity. The first request after a cold start takes 30–60 seconds. Currently the auth overlay appears immediately and API calls silently fail until the backend is up.

## Solution

Show a loading overlay before the auth screen, polling `GET /api/config` until the backend responds. Once up, fade out and proceed normally.

## Components

Two files added to `frontend/ui/`:

### `loading-hourglass.js` (primary — used in production)

Canvas-based hourglass simulation:
- Bezier-curved glass outline with gold glow
- Sand fills top→bottom with amber gradient, ripple on surface, dune curve at bottom
- Falling grain particles through the neck
- When full: pauses, animates a 180° CSS flip (wrapper div rotates, canvas always draws upright), snaps back, `sandRatio = 1 - sandRatio` so top is full again
- Gradient is counter-rotated in canvas space during the flip (`direction = (sin θ, cos θ)`) so lighting stays pinned to the visual world — no lighting switch at any rotation angle
- Cycling status label: THE GODS REQUIRE TIME → THE SANDS FALL... → PATIENCE, PHARAOH... → NEARLY THERE... → THE DESERT STIRS... → TURNING THE GLASS...
- Title: `⚡ PYRAMID SCHEME™ ⚡` in gold monospace, matching auth overlay style

### `loading-hieroglyph.js` (alternative — in codebase, not wired up)

CSS slot-machine spinner:
- Three rows of Egyptian hieroglyph characters scrolling at different speeds (28px/s, -19px/s reversed, 13px/s)
- Scanline overlay + centre highlight bar
- Dot progress indicator cycling left→right
- Phase message cycling: CONSULTING THE ORACLE... → SUMMONING THE DESERT... → THE PYRAMID AWAKENS...

## Backend health check

Uses `GET /api/config` — already exists, no auth required, returns payout config. No new backend endpoint needed.

## Polling logic

- First request fires immediately on mount
- On network error or non-200: retry every 3 seconds
- No maximum retries — keeps polling until backend is up
- On 200: 300ms CSS fade-out, then `onReady()` called

## `main.js` change

One line added before `requireAuth()`:
```js
import { waitForBackend } from './ui/loading-hourglass.js';
// ...
await waitForBackend();
const token = await requireAuth();
```

## Out of scope

- No backend changes
- No timeout / "server unreachable" error state (demo context, backend always eventually wakes)
- `loading-hieroglyph.js` is not wired up — added for future use only
