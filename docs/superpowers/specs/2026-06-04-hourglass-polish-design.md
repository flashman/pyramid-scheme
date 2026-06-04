# Hourglass Polish — Design Spec

**Date:** 2026-06-04
**Status:** Approved

## Overview

Three small improvements to the cold-start hourglass in `frontend/ui/loading-hourglass.js`:

1. Slower sand animation
2. Four cycling label sets (one per glass turn)
3. Procedural sandy white noise audio

All changes are confined to `loading-hourglass.js`. No other files touched.

---

## 1. Speed

Change `SPEED` from `0.00018` to `0.00012`.

At 60fps this makes each drain cycle ~8.3 seconds (up from ~5.6s). Feels more contemplative, less rushed.

---

## 2. Cycling Label Sets

Replace the single `LABELS` array with a `LABEL_SETS` array of 4 sets. A `turnIndex` variable (starting at 0) increments each time a flip completes. Active set is `LABEL_SETS[turnIndex % 4]`.

```js
const LABEL_SETS = [
  // A — original
  ['THE GODS REQUIRE TIME', 'THE SANDS FALL...', 'PATIENCE, PHARAOH...', 'NEARLY THERE...', 'THE DESERT STIRS...'],
  // B — satirical
  ['WAKING THE PHARAOH...', 'BRIBING THE SCRIBES...', 'STACKING THE STONES...', 'PYRAMID RISING...', 'ALMOST OPEN...'],
  // C — mystical
  ['THE ORACLE SLEEPS...', 'SANDS OF ETERNITY...', 'THE ANCIENTS STIR...', 'THE VEIL THINS...', 'THE DESERT WAKES...'],
  // D — poetic
  ['IN THE BEGINNING...', 'THE SANDS REMEMBER...', 'A WORLD STIRS...', 'A PHARAOH DREAMS...', 'THE EMPIRE WAKES...'],
];
```

Label lookup during drain: `LABEL_SETS[turnIndex % 4][Math.min(4, Math.floor(sandRatio * 5))]`

`turnIndex` increments at the point in the `flipping` state where `flipProg >= 1` (the existing flip-completion block).

The "TURNING THE GLASS..." caption text during the pause and flip states is unchanged.

---

## 3. Sandy White Noise Audio

A new `_startSandAudio()` function, self-contained in `loading-hourglass.js`. Independent of `SoundManager` — plays regardless of the game's mute/volume setting.

### Signal chain

```
BufferSourceNode (white noise, loop) → BiquadFilterNode (bandpass, 2000 Hz, Q 0.8) → GainNode → AudioContext.destination
```

### White noise buffer

2-second mono buffer filled with `Math.random() * 2 - 1`. Loop enabled.

### Parameters

| Parameter | Value | Reason |
|---|---|---|
| Filter type | bandpass | Cuts rumble and shrillness, leaves sandy hiss |
| Filter frequency | 2000 Hz | Sweet spot for sand-on-glass texture |
| Filter Q | 0.8 | Gentle shaping, not narrow |
| Gain | 0.07 | Very quiet, ambient |
| Fade in | 800ms linear ramp | Soft entry |
| Fade out | 320ms linear ramp | Syncs with overlay opacity fade |

### Lifecycle

- `_startSandAudio()` is called at the start of `_showOverlayAndWait`, after the overlay is appended to the DOM.
- It returns a `stopAudio()` function.
- `stopAudio()` is called alongside `stopAnim()` when `Promise.all` resolves, before the opacity fade.
- On stop: ramp gain to 0 over 320ms, then `source.stop()` and `ctx.close()`.

### Browser autoplay

`AudioContext` is created inside `_startSandAudio()`. On some browsers, autoplay requires a prior user gesture. Since the hourglass shows before any user interaction (cold start at page load), the `AudioContext` may start in `suspended` state. The function calls `ctx.resume()` after creation and silently proceeds even if audio doesn't play (no error thrown).

---

## File Changes

### `frontend/ui/loading-hourglass.js`

- Change `SPEED` constant from `0.00018` to `0.00012`
- Replace `const LABELS = [...]` with `const LABEL_SETS = [[...], [...], [...], [...]]`
- Add `let turnIndex = 0` inside `_startHourglass`
- Update label lookup in the `draining` state to use `LABEL_SETS[turnIndex % 4][...]`
- Increment `turnIndex` in the flip-completion block (`if (flipProg >= 1)`)
- Add `_startSandAudio()` function
- Call `_startSandAudio()` in `_showOverlayAndWait`, store result as `stopAudio`
- Call `stopAudio()` alongside `stopAnim()` on dismiss
