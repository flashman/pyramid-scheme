# Mobile Text Input — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mobile OS keyboard support to the sphinx riddle (and any future in-game text input) via a reusable `MobileTextInput` module that swaps the d-pad for a 3-button overlay (⌫ ↵ ESC) when typing is needed.

**Architecture:** A new `ui/mobile-text-input.js` module owns a hidden `<input>` element and the `#mc-type` overlay. When `open()` is called it focuses the input (triggering the native keyboard) and hides the d-pad. `RiddleManager` calls `open()`/`close()` at phase transitions. `mobile-controls.js` calls `syncFocus()` inside every touchstart handler to guarantee focus() runs within a user gesture.

**Tech Stack:** Vanilla JS ES modules, no bundler, nginx static serving. No unit test framework — verification is manual in a mobile browser / DevTools mobile emulation.

---

## File Map

| File | Action |
|---|---|
| `frontend/ui/mobile-text-input.js` | **Create** — owns hidden input + `#mc-type` overlay |
| `frontend/ui/mobile-controls.js` | **Modify** — import module, call `init()` + `syncFocus()` |
| `frontend/worlds/oasis/riddles.js` | **Modify** — import module, call `open()`/`close()` at phase transitions |

---

## Task 1: Create the git branch

- [ ] **Step 1: Create and check out the feature branch**

```bash
git checkout -b feat/mobile-text-input
```

Expected: `Switched to a new branch 'feat/mobile-text-input'`

---

## Task 2: Create `ui/mobile-text-input.js`

**Files:**
- Create: `frontend/ui/mobile-text-input.js`

- [ ] **Step 1: Create the file**

Create `frontend/ui/mobile-text-input.js` with the full content below:

```js
// ── FILE: ui/mobile-text-input.js ────────────────────────
// Reusable mobile text input: focuses a hidden <input> to trigger the
// native OS keyboard, and swaps the d-pad for a 3-button overlay (⌫ ↵ ESC).
// Usage: MobileTextInput.open({ onChar, onSubmit, onEscape }) / .close()

const CSS = `
#mobile-text-input {
  position: fixed;
  top: -100px;
  left: -100px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
#mc-type {
  display: none;
  position: fixed;
  bottom: 20px;
  right: 20px;
  grid-template-columns: repeat(2, 52px);
  grid-template-rows: repeat(2, 52px);
  gap: 4px;
  z-index: 1000;
  user-select: none;
  -webkit-user-select: none;
}
#mc-type.active {
  display: grid;
}
`;

export const MobileTextInput = (() => {
  let _open    = false;
  let _onChar  = null;
  let _onSubmit = null;
  let _onEscape = null;
  let _input   = null;

  function _makeBtn(label, col, row, spanCols, fontSize) {
    const btn = document.createElement('div');
    btn.className = 'mc-btn';
    btn.textContent = label;
    btn.style.gridColumn = spanCols ? `${col} / span ${spanCols}` : String(col);
    btn.style.gridRow = String(row);
    if (fontSize) btn.style.fontSize = fontSize;
    return btn;
  }

  return {
    init() {
      const style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      // Hidden input — captures native keyboard events
      _input = document.createElement('input');
      _input.id = 'mobile-text-input';
      _input.type = 'text';
      _input.setAttribute('autocorrect', 'off');
      _input.setAttribute('autocapitalize', 'off');
      _input.setAttribute('spellcheck', 'false');
      _input.setAttribute('inputmode', 'text');
      document.body.appendChild(_input);

      // input event: character typed on native keyboard
      _input.addEventListener('input', e => {
        if (!_open || !_onChar) return;
        const ch = e.data;
        if (ch) _onChar(ch);
        _input.value = '';  // reset so each event gives exactly one char
      });

      // keydown event: special keys (Enter, Backspace, Escape)
      // stopPropagation prevents double-processing by the game's global keydown handler
      _input.addEventListener('keydown', e => {
        if (!_open) return;
        e.stopPropagation();
        if (e.key === 'Enter')     { _onSubmit?.(); }
        else if (e.key === 'Escape')    { _onEscape?.(); }
        else if (e.key === 'Backspace') { _onChar?.('\b'); }
      });

      // #mc-type overlay: ⌫ and ↵ on top row, ESC spanning bottom row
      const overlay = document.createElement('div');
      overlay.id = 'mc-type';

      const backBtn = _makeBtn('⌫', 1, 1, null, null);
      backBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        if (_open) { _onChar?.('\b'); MobileTextInput.syncFocus(); }
      }, { passive: false });
      backBtn.addEventListener('touchend',   e => e.preventDefault(), { passive: false });

      const submitBtn = _makeBtn('↵', 2, 1, null, null);
      submitBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        if (_open) { _onSubmit?.(); MobileTextInput.syncFocus(); }
      }, { passive: false });
      submitBtn.addEventListener('touchend',   e => e.preventDefault(), { passive: false });

      const escBtn = _makeBtn('esc', 1, 2, 2, '9px');
      escBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        if (_open) { _onEscape?.(); }
      }, { passive: false });
      escBtn.addEventListener('touchend',   e => e.preventDefault(), { passive: false });

      overlay.appendChild(backBtn);
      overlay.appendChild(submitBtn);
      overlay.appendChild(escBtn);
      document.body.appendChild(overlay);
    },

    open({ onChar, onSubmit, onEscape }) {
      _open     = true;
      _onChar   = onChar;
      _onSubmit = onSubmit;
      _onEscape = onEscape;

      const pad = document.getElementById('mc-pad');
      const aux = document.getElementById('mc-aux');
      if (pad) pad.style.display = 'none';
      if (aux) aux.style.display = 'none';

      const overlay = document.getElementById('mc-type');
      if (overlay) overlay.classList.add('active');

      if (_input) _input.focus();
    },

    close() {
      _open     = false;
      _onChar   = null;
      _onSubmit = null;
      _onEscape = null;

      if (_input) { _input.blur(); _input.value = ''; }

      const overlay = document.getElementById('mc-type');
      if (overlay) overlay.classList.remove('active');

      const pad = document.getElementById('mc-pad');
      const aux = document.getElementById('mc-aux');
      if (pad) pad.style.display = '';
      if (aux) aux.style.display = '';
    },

    syncFocus() {
      if (_open && _input) _input.focus();
    },

    isOpen() { return _open; },
  };
})();
```

- [ ] **Step 2: Verify the file was created**

```bash
ls frontend/ui/mobile-text-input.js
```

Expected: file listed, no error.

- [ ] **Step 3: Commit**

```bash
git add frontend/ui/mobile-text-input.js
git commit -m "feat: add MobileTextInput module (hidden input + #mc-type overlay)"
```

---

## Task 3: Wire `MobileTextInput` into `mobile-controls.js`

**Files:**
- Modify: `frontend/ui/mobile-controls.js`

The `makeBtn` function currently fires `fireKey('keydown', key)` on touchstart with no awareness of text input mode. We need to:
1. Import `MobileTextInput`
2. Call `MobileTextInput.init()` at the end of `initMobileControls()`
3. Add `MobileTextInput.syncFocus()` inside each button's touchstart handler, after `fireKey`

- [ ] **Step 1: Add the import at the top of `mobile-controls.js`**

Add this as the first line of `frontend/ui/mobile-controls.js`:

```js
import { MobileTextInput } from './mobile-text-input.js';
```

- [ ] **Step 2: Update `makeBtn` to call `syncFocus()` on touchstart**

Replace the existing `makeBtn` function:

```js
function makeBtn(label, key, col, row, fontSize) {
  const btn = document.createElement('div');
  btn.className = 'mc-btn';
  btn.textContent = label;
  btn.style.gridColumn = col;
  btn.style.gridRow = row;
  if (fontSize) btn.style.fontSize = fontSize;

  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    fireKey('keydown', key);
    MobileTextInput.syncFocus();
  }, { passive: false });
  btn.addEventListener('touchend',   e => { e.preventDefault(); fireKey('keyup', key); }, { passive: false });
  btn.addEventListener('touchcancel',e => { e.preventDefault(); fireKey('keyup', key); }, { passive: false });

  return btn;
}
```

- [ ] **Step 3: Call `MobileTextInput.init()` at the end of `initMobileControls()`**

Replace the final two lines of `initMobileControls()`:

```js
  document.body.appendChild(aux);

  MobileTextInput.init();
}
```

- [ ] **Step 4: Verify the full file looks correct**

The complete `frontend/ui/mobile-controls.js` should now be:

```js
import { MobileTextInput } from './mobile-text-input.js';

const CSS = `
#mc-pad {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: grid;
  grid-template-columns: repeat(3, 52px);
  grid-template-rows: repeat(2, 52px);
  gap: 4px;
  z-index: 1000;
  user-select: none;
  -webkit-user-select: none;
}
#mc-aux {
  position: fixed;
  bottom: 20px;
  left: 20px;
  display: grid;
  grid-template-columns: repeat(2, 52px);
  grid-template-rows: repeat(2, 52px);
  gap: 4px;
  z-index: 1000;
  user-select: none;
  -webkit-user-select: none;
}
.mc-btn {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10,5,0,0.75);
  border: 1.5px solid #8a6a20;
  border-radius: 6px;
  color: #f0c020;
  font-family: monospace;
  font-size: 20px;
  cursor: pointer;
  touch-action: none;
}
.mc-btn:active {
  background: rgba(40,25,0,0.9);
}
`;

function fireKey(type, key) {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
}

function makeBtn(label, key, col, row, fontSize) {
  const btn = document.createElement('div');
  btn.className = 'mc-btn';
  btn.textContent = label;
  btn.style.gridColumn = col;
  btn.style.gridRow = row;
  if (fontSize) btn.style.fontSize = fontSize;

  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    fireKey('keydown', key);
    MobileTextInput.syncFocus();
  }, { passive: false });
  btn.addEventListener('touchend',   e => { e.preventDefault(); fireKey('keyup',   key); }, { passive: false });
  btn.addEventListener('touchcancel',e => { e.preventDefault(); fireKey('keyup',   key); }, { passive: false });

  return btn;
}

export function initMobileControls() {
  if (!navigator.maxTouchPoints) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const pad = document.createElement('div');
  pad.id = 'mc-pad';

  pad.appendChild(makeBtn('↑',     'ArrowUp',    2, 1));
  pad.appendChild(makeBtn('space', ' ',          3, 1, '10px'));
  pad.appendChild(makeBtn('←',     'ArrowLeft',  1, 2));
  pad.appendChild(makeBtn('↓',     'ArrowDown',  2, 2));
  pad.appendChild(makeBtn('→',     'ArrowRight', 3, 2));

  document.body.appendChild(pad);

  const aux = document.createElement('div');
  aux.id = 'mc-aux';

  const esc = makeBtn('esc', 'Escape', null, null, '9px');
  esc.style.gridColumn = '1 / span 2';
  esc.style.gridRow = '1';
  aux.appendChild(esc);
  aux.appendChild(makeBtn('Z', 'z',     1, 2));
  aux.appendChild(makeBtn('⇧', 'Shift', 2, 2));

  document.body.appendChild(aux);

  MobileTextInput.init();
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/ui/mobile-controls.js
git commit -m "feat: wire MobileTextInput into mobile-controls (init + syncFocus)"
```

---

## Task 4: Wire `MobileTextInput` into `RiddleManager`

**Files:**
- Modify: `frontend/worlds/oasis/riddles.js`

Three integration points:
1. `_skipOrAdvance()` — open when entering `'typing'` phase
2. `_submit()` — close when phase changes to `'correct'` or `'wrong'`
3. `onKeyDown('Escape')` — close when riddle is abandoned

- [ ] **Step 1: Add the import**

In `frontend/worlds/oasis/riddles.js`, the first line is:
```js
import { Flags } from '../../engine/flags.js';
```

Add the `MobileTextInput` import on the next line:

```js
import { Flags }           from '../../engine/flags.js';
import { MobileTextInput } from '../../ui/mobile-text-input.js';
```

- [ ] **Step 2: Update `_skipOrAdvance()` to open mobile text input**

Find the existing `_skipOrAdvance` function (currently lines 116–124):

```js
  function _skipOrAdvance() {
    if (!_typewriterDone()) {
      _typeLen = _currentText().length;
    } else if (_phase === 'reading') {
      _phase    = 'typing';
      _input    = '';
      _attempts = 0;
    }
  }
```

Replace it with:

```js
  function _skipOrAdvance() {
    if (!_typewriterDone()) {
      _typeLen = _currentText().length;
    } else if (_phase === 'reading') {
      _phase    = 'typing';
      _input    = '';
      _attempts = 0;
      if (navigator.maxTouchPoints > 0) {
        MobileTextInput.open({
          onChar(ch) {
            if (ch === '\b') {
              _input = _input.slice(0, -1);
            } else if (_input.length < 18) {
              _input += ch.toUpperCase();
            }
          },
          onSubmit() {
            if (_input.trim().length > 0) _submit();
          },
          onEscape() {
            _active = false;
            _phase  = 'idle';
            MobileTextInput.close();
            const el = document.getElementById('dlg');
            if (el) el.classList.remove('active');
          },
        });
      }
    }
  }
```

- [ ] **Step 3: Update `_submit()` to close mobile text input when leaving typing phase**

Find the existing `_submit` function (currently lines 126–147):

```js
  function _submit() {
    const answer = _input.trim().toLowerCase();
    if (_riddle.answers.includes(answer)) {
      _phase     = 'correct';
      _respText  = _riddle.response;
      _typeLen   = 0;
      _typeStart = Date.now();
      Flags.inc('sphinx_riddles_solved');
    } else {
      _attempts++;
      if (_attempts >= 13) {
        const hint = _riddle.answers[0].toUpperCase();
        _phase    = 'correct';
        _respText = `THE ANSWER IS: ${hint}.\n${_riddle.response}`;
      } else {
        _phase    = 'wrong';
        _respText = 'INCORRECT.\nTHE SPHINX REGARDS YOU\nIN SILENCE.';
      }
      _typeLen   = 0;
      _typeStart = Date.now();
    }
  }
```

Replace it with:

```js
  function _submit() {
    const answer = _input.trim().toLowerCase();
    MobileTextInput.close();
    if (_riddle.answers.includes(answer)) {
      _phase     = 'correct';
      _respText  = _riddle.response;
      _typeLen   = 0;
      _typeStart = Date.now();
      Flags.inc('sphinx_riddles_solved');
    } else {
      _attempts++;
      if (_attempts >= 13) {
        const hint = _riddle.answers[0].toUpperCase();
        _phase    = 'correct';
        _respText = `THE ANSWER IS: ${hint}.\n${_riddle.response}`;
      } else {
        _phase    = 'wrong';
        _respText = 'INCORRECT.\nTHE SPHINX REGARDS YOU\nIN SILENCE.';
      }
      _typeLen   = 0;
      _typeStart = Date.now();
    }
  }
```

- [ ] **Step 4: Update `onKeyDown` Escape branch to also close mobile text input**

Find this block inside `onKeyDown` (currently around line 168–172):

```js
      if (key === 'Escape') {
        _active = false;
        _phase  = 'idle';
        const el = document.getElementById('dlg');
        if (el) el.classList.remove('active');
        return true;
      }
```

Replace it with:

```js
      if (key === 'Escape') {
        _active = false;
        _phase  = 'idle';
        MobileTextInput.close();
        const el = document.getElementById('dlg');
        if (el) el.classList.remove('active');
        return true;
      }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/oasis/riddles.js
git commit -m "feat: wire MobileTextInput into RiddleManager typing phase"
```

---

## Task 5: Rebuild and verify

This is a vanilla JS frontend served by nginx. JS changes require a Docker image rebuild to be picked up.

- [ ] **Step 1: Rebuild the frontend image**

```bash
docker compose build frontend && docker compose up -d
```

Wait for `up-to-date` or `Started`.

- [ ] **Step 2: Open the game in DevTools mobile emulation**

1. Navigate to `http://localhost:5173`
2. Open Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Select any phone profile (e.g. iPhone 12 Pro)

- [ ] **Step 3: Verify d-pad controls still work normally (regression check)**

- Mobile d-pad should be visible (arrows, space, Z, Shift, ESC)
- Walk the player character left and right using the arrow buttons
- Expected: character moves, no console errors

- [ ] **Step 4: Walk to the sphinx and start a riddle**

- Walk right until you reach the sphinx in the Oasis
- Tap the `space` button — the riddle reading phase should begin
- The `#dlg` panel should show the riddle question with typewriter animation
- Tap `space` again to advance past the reading phase

- [ ] **Step 5: Verify the typing overlay appears**

When the riddle enters typing phase:
- `#mc-pad` and `#mc-aux` should disappear
- `#mc-type` overlay should appear at bottom-right with ⌫, ↵, and `esc` buttons
- The native OS keyboard should pop up automatically (in DevTools emulation: a soft keyboard simulator may or may not appear — on a real phone it will)
- The `#dlg` panel should show `YOUR ANSWER › █`

- [ ] **Step 6: Type an answer using DevTools keyboard**

In DevTools mobile emulation, typing on your physical keyboard sends input events to the focused hidden input. Type the answer to the riddle (e.g. `map` for the first riddle, `hole`, `echo`, etc.). The answer text should appear in the `#dlg` panel cursor line as you type.

- [ ] **Step 7: Test ⌫ (backspace) button**

Tap the `⌫` button — one character should be removed from the answer display.

- [ ] **Step 8: Submit the answer**

Tap the `↵` button. If the answer is correct, the response text should typewriter in and `#mc-type` should disappear, restoring the normal d-pad.

- [ ] **Step 9: Test the ESC button during typing**

Start a new riddle, reach typing phase, then tap the `esc` button in `#mc-type`. The dialogue should close and the normal d-pad should restore.

- [ ] **Step 10: Verify desktop is unaffected**

Switch DevTools back to desktop view (disable device emulation). The mobile controls should not appear (`navigator.maxTouchPoints` is 0 on desktop). The riddle should work normally with keyboard input.

- [ ] **Step 11: Final commit if any tweaks were needed**

If any small fixes were made during testing:

```bash
git add -p
git commit -m "fix: mobile text input tweaks from manual testing"
```

---

## Task 6: Open a PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/mobile-text-input
```

- [ ] **Step 2: Create the PR**

```bash
gh pr create \
  --title "feat: mobile text input for sphinx riddles" \
  --body "$(cat <<'EOF'
## Summary
- Adds `MobileTextInput` module (`ui/mobile-text-input.js`) with a hidden `<input>` and 3-button overlay (⌫ ↵ ESC)
- When the sphinx riddle enters typing phase on a touch device, the d-pad hides and the OS keyboard opens automatically
- `RiddleManager` calls `open()`/`close()` at phase transitions; desktop path unchanged
- Pattern is reusable: any future in-game text input (chat, NPC prompts) calls the same API

## Test plan
- [ ] Mobile emulation in DevTools: d-pad visible normally, swaps to ⌫ ↵ ESC overlay on riddle typing phase
- [ ] Typing on physical/emulated keyboard updates the answer display correctly
- [ ] ⌫ removes last character, ↵ submits, ESC dismisses and restores d-pad
- [ ] Correct/wrong answer both close the overlay and restore d-pad
- [ ] Desktop: no regressions, mobile controls never appear
EOF
)"
```
