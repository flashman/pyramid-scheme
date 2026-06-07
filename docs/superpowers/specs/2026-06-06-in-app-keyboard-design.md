# In-App Keyboard — Design Spec

**Date:** 2026-06-06  
**Status:** Approved

## Overview

A custom on-screen keyboard rendered as an HTML panel directly below the `#dlg` dialogue box. Replaces the native OS keyboard (currently triggered via `MobileTextInput`) for touch devices. Supports two modes — ABC (letters) and 123 (numbers + symbols) — toggled by a single key, iPhone-style.

## Motivation

Native OS keyboards on mobile browsers can cause viewport resizing, scroll jumping, and focus loss. An in-app keyboard gives full control over layout, appearance, and input behaviour, and can be styled to match the game's desert/monospace aesthetic.

## Module

**File:** `frontend/ui/in-app-keyboard.js`  
**Export:** `InAppKeyboard` singleton

### Public API

Matches `MobileTextInput` exactly so `RiddleManager` can swap between them with a one-line change.

```js
InAppKeyboard.init()                          // called once from initMobileControls()
InAppKeyboard.open({ onChar, onSubmit, onEscape, onCursor })
InAppKeyboard.close()
InAppKeyboard.isOpen()                        // → boolean
```

Callback signatures:
- `onChar(ch: string)` — single character; `'\b'` for backspace
- `onSubmit()` — ENTER tapped
- `onEscape()` — ESC tapped
- `onCursor(dir: 'left' | 'right')` — arrow key tapped; caller manages cursor position within its own input string

### Rendering

- Injected as a `<div id="in-app-kb">` placed immediately after `#dlg` in the DOM (so it sits flush below the dialogue box in normal document flow).
- `display: none` by default; `display: block` when open.
- When open: hides `#mc-pad` and `#mc-aux` (same as `MobileTextInput`).
- When closed: restores `#mc-pad` and `#mc-aux`.
- No fixed/absolute positioning — flows with the page so it doesn't cover the canvas.

## Layout

### ABC mode (default)

```
[ Q ][ W ][ E ][ R ][ T ][ Y ][ U ][ I ][ O ][ P ]
[ A ][ S ][ D ][ F ][ G ][ H ][ J ][ K ][ L ][⌫ DEL]
     [ Z ][ X ][ C ][ V ][ B ][ N ][ M ]
[ESC] ··  [123][    SPACE    ][ ← ][ → ]  ·· [ENTER↵]
```

- Row widths: Q-P = 10 keys, A-L+DEL = 9 keys + 1 wide (fills), Z-M = 7 keys (indented ~30 px left)
- DEL is at the right end of the A row, directly above ENTER — same right-column position
- Z row stagger: `margin-left: 30px` relative to Q row

### 123 mode

```
[ 1 ][ 2 ][ 3 ][ 4 ][ 5 ][ 6 ][ 7 ][ 8 ][ 9 ][ 0 ]
[ - ][ / ][ : ][ ; ][ ( ][ ) ][ $ ][ & ][ @ ][⌫ DEL]
     [ . ][ , ][ ? ][ ! ][ ' ][ " ][ # ]
[ESC] ··  [ABC][    SPACE    ][ ← ][ → ]  ·· [ENTER↵]
```

- Same structure as ABC — only the three letter/number rows swap out
- Action row is identical and stays rendered at all times (no re-render on toggle)
- `[123]` label swaps to `[ABC]` and back on each tap

### Key sizing (desktop reference; scales on mobile via viewport)

| Key type | Width | Height |
|---|---|---|
| Standard letter/number | 36 px | 38 px |
| DEL (flexible) | fills remaining A-row width | 38 px |
| ESC | 48 px | 38 px |
| ENTER | 64 px | 38 px |
| 123 / ABC toggle | 52 px | 38 px |
| SPACE | flex (fills) | 38 px |
| Arrow ← → | 38 px | 38 px |

Gap between all keys: 4 px. Visual separator gap between ESC/ENTER and inner action keys: 10 px (empty `<div>`).

### Visual style

Inherits the game's existing `.mc-btn` aesthetic:
- Background: `rgba(10,5,0,0.9)` standard; `rgba(25,12,0,0.9)` action keys
- Border: `1.5px solid #8a6a20` standard; `#b07830` action keys
- Text: `#f0c020` standard; `#ffcc40` action keys
- ESC: red-tinted border `#8a3010`, text `#d06030`
- ENTER: green-tinted border `#207840`, text `#40c060`
- Border-radius: 4 px

## Input Handling

- All keys use `touchstart` + `e.preventDefault()` + `{ passive: false }` — same pattern as existing mobile controls. No `click` events (eliminates 300 ms tap delay).
- Letter keys call `onChar(key)` with the uppercase letter.
- Number and symbol keys call `onChar(key)` with the raw character.
- `⌫ DEL` calls `onChar('\b')`.
- `ENTER` calls `onSubmit()`.
- `ESC` calls `onEscape()`.
- `←` / `→` call `onCursor('left')` / `onCursor('right')`.
- `SPACE` calls `onChar(' ')`.

## Integration points

### `RiddleManager` (`worlds/oasis/riddles.js`)

`_openMobileInput()` currently calls `MobileTextInput.open(...)`. Replace with `InAppKeyboard.open(...)`. `MobileTextInput` is left in place but no longer called from riddles — it can be removed later once `InAppKeyboard` is confirmed working.

`onCursor` is a new callback not present in `MobileTextInput`. `RiddleManager` must track a cursor index into `_input` and use it when appending/deleting characters. Backspace deletes the character before the cursor; new characters insert at the cursor position.

### `initMobileControls` (`ui/mobile-controls.js`)

Call `InAppKeyboard.init()` after the existing `MobileTextInput.init()` call (or replace it, once `InAppKeyboard` is the confirmed path).

## Out of scope

- Swipe gestures
- Long-press alternate characters
- Caps lock / shift
- Haptic feedback
- Desktop keyboard support (physical keyboard path unchanged)
