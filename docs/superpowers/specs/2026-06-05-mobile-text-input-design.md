# Mobile Text Input — Design Spec
_2026-06-05_

## Problem

On mobile, the sphinx riddle requires typed answers but the existing mobile controls only fire arrow/space/escape/Z/shift events. There is no way to type letter characters. The same gap will affect any future in-game text input: NPC prompts ("how many?"), player chat, etc. All of these use the shared `#dlg` dialogue panel.

## Chosen Approach

**Option C: Auto-focus + minimal overlay.**  
A hidden `<input>` element is focused when text input is needed, triggering the native OS keyboard. The d-pad and aux controls are replaced by a 3-button context overlay (⌫ BACKSPACE, ↵ SUBMIT, ESC) for the duration of text entry. The pattern lives in a reusable `MobileTextInput` module so any future system can use it.

## Architecture

### New file: `ui/mobile-text-input.js`

Owns the hidden input element and the typing-mode control overlay.

**DOM elements created at init:**

- `<input id="mobile-text-input">` — positioned off-screen (`position:fixed; top:-100px; opacity:0`), `autocorrect="off"`, `autocapitalize="off"`, `spellcheck="false"`, `inputmode="text"`. Created once; reused across all open/close cycles.
- `<div id="mc-type">` — the 3-button overlay, hidden by default. Contains ⌫, ↵, ESC buttons styled to match the existing `.mc-btn` class. Positioned at bottom-right replacing `#mc-pad`.

**Public API:**

```js
MobileTextInput.init()
// Called once at startup (inside initMobileControls, guarded by navigator.maxTouchPoints).
// Creates the hidden input and #mc-type overlay, attaches input/keydown listeners.

MobileTextInput.open({ onChar, onSubmit, onEscape })
// Activates text input mode:
//   - Hides #mc-pad and #mc-aux
//   - Shows #mc-type
//   - Focuses the hidden input (works when called synchronously within a touch handler)

MobileTextInput.close()
// Deactivates text input mode:
//   - Blurs and clears the hidden input
//   - Hides #mc-type
//   - Restores #mc-pad and #mc-aux

MobileTextInput.syncFocus()
// If currently open, calls hiddenInput.focus().
// Called by mobile-controls.js inside every touchstart handler so focus() always
// runs within a user gesture, satisfying mobile browser keyboard policy.

MobileTextInput.isOpen()  // → boolean
```

**Input handling (inside the module):**

- `input` event on the hidden element: read `e.data` for the typed character; call `onChar(char)`. Immediately clear the input value (`hiddenInput.value = ''`) so each event delivers exactly one character.
- `keydown` on the hidden element: call `e.stopPropagation()` (prevents the keystroke from bubbling to the game's global `document.addEventListener('keydown')` and being double-processed by `RiddleManager`). Then: `Enter` → `onSubmit()`, `Escape` → `onEscape()`, `Backspace` → `onChar('\b')` (backspace sentinel).
- The ⌫ button: calls `onChar('\b')` directly (no synthetic event) and `syncFocus()`.
- The ↵ button: calls `onSubmit()` directly (no synthetic event) and `syncFocus()`.
- The ESC button: calls `onEscape()` directly (no synthetic event) and `syncFocus()`.

### Changes to `ui/mobile-controls.js`

- Import and call `MobileTextInput.init()` at the end of `initMobileControls()`.
- After every `fireKey(...)` call inside each button's touchstart handler, add `MobileTextInput.syncFocus()`.

### Changes to `worlds/oasis/riddles.js` (RiddleManager)

- Import `MobileTextInput`.
- In `_skipOrAdvance()`, when transitioning `'reading' → 'typing'`: call `MobileTextInput.open({ onChar, onSubmit, onEscape })` if `navigator.maxTouchPoints > 0`.
  - `onChar(char)`: if `char === '\b'` do `_input = _input.slice(0,-1)`, else append to `_input` (same 18-char limit as keyboard path).
  - `onSubmit()`: call `_submit()` if `_input.trim().length > 0`.
  - `onEscape()`: set `_active = false`, close `#dlg`, call `MobileTextInput.close()`.
- In `onKeyDown('Escape')`: also call `MobileTextInput.close()`.
- When leaving typing phase (correct/wrong response starts): call `MobileTextInput.close()`.

### No changes to `main.js`, `engine/dialogue.js`, or any realm file.

## Focus() and the User Gesture Requirement

Mobile browsers only open the OS keyboard when `.focus()` is called synchronously within a user-gesture event (touchstart/click). The flow that satisfies this:

1. Player taps the Space button → `touchstart` fires.
2. `fireKey('keydown', ' ')` dispatches a synthetic `KeyboardEvent` synchronously.
3. `RiddleManager.onKeyDown(' ')` runs (still inside the touchstart call stack).
4. Phase transitions to `'typing'`; `MobileTextInput.open(...)` is called.
5. `open()` calls `hiddenInput.focus()` — still synchronous, still within the original touchstart — so the browser accepts it.
6. After `fireKey`, `MobileTextInput.syncFocus()` is also called as a belt-and-suspenders measure.

If a browser still blocks the keyboard (rare), the overlay remains visible. The player can tap the ↵ button (which calls `syncFocus()`) to re-trigger focus. This is the graceful fallback.

## Future Use Cases

Any future system that needs free-text input in the `#dlg` panel follows the same pattern:

```js
MobileTextInput.open({
  onChar:   (ch) => { /* update local buffer */ },
  onSubmit: ()   => { /* handle submission */ },
  onEscape: ()   => { MobileTextInput.close(); /* dismiss */ },
});
```

No changes to mobile-controls.js are needed. The `#mc-type` overlay (⌫, ↵, ESC) is universal and fits all text-input contexts.

## Out of Scope

- Desktop keyboard behaviour is unchanged.
- No autocorrect or swipe-type suppression beyond the `autocorrect="off"` attribute.
- Chat UI layout / server integration is not part of this spec.
- The `#mc-type` overlay button labels are static (⌫, ↵, ESC); no per-context customisation in this iteration.

## Files Affected

| File | Change |
|---|---|
| `frontend/ui/mobile-text-input.js` | **New** — owns hidden input + overlay |
| `frontend/ui/mobile-controls.js` | Call `MobileTextInput.init()` + `syncFocus()` per button |
| `frontend/worlds/oasis/riddles.js` | Call `open()`/`close()` at phase transitions |
