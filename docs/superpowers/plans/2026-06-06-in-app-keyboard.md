# In-App Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a custom QWERTY on-screen keyboard rendered below the `#dlg` dialogue box, replacing the native OS keyboard for the Sphinx riddle typing phase on touch devices.

**Architecture:** A new `InAppKeyboard` singleton (`ui/in-app-keyboard.js`) is injected into the DOM after `#dlg` on `init()`. It exposes the same `open/close/isOpen` API as `MobileTextInput` plus an `onCursor` callback for ← → navigation. `RiddleManager` swaps its `_openMobileInput()` call from `MobileTextInput` to `InAppKeyboard` and adds cursor-index tracking to `_input`.

**Tech Stack:** Vanilla JS ES modules, HTML/CSS injected at runtime, `touchstart` events with `preventDefault`.

---

## File map

| Action | File | Purpose |
|---|---|---|
| Create | `frontend/ui/in-app-keyboard.js` | InAppKeyboard singleton — CSS, DOM, callbacks, toggle |
| Modify | `frontend/ui/mobile-controls.js` | Import + call `InAppKeyboard.init()` |
| Modify | `frontend/worlds/oasis/riddles.js` | Swap to InAppKeyboard, add `_cursorPos` state, cursor-aware render |

---

## Key sizing reference

The keyboard matches `#dlg` width (780px). All measurements are for the inner 676px container centered inside.

| Key | Width | Height |
|---|---|---|
| Standard letter / number / symbol | 64px | 44px |
| DEL | flex: 1 (fills A-row remainder) | 44px |
| ESC | 60px | 44px |
| ENTER | 88px | 44px |
| 123 / ABC toggle | 68px | 44px |
| SPACE | flex: 1 | 44px |
| ← → arrow | 52px | 44px |
| Separator (visual gap) | 14px | — |

Gap between all keys in a row: 4px.

---

## Task 1: Create `in-app-keyboard.js` — CSS and skeleton

**Files:**
- Create: `frontend/ui/in-app-keyboard.js`

- [ ] **Step 1: Create the file with CSS constant and empty module shell**

```js
// ── FILE: ui/in-app-keyboard.js ────────────────────────────
// Custom on-screen QWERTY keyboard rendered below #dlg.
// Replaces MobileTextInput for the riddle typing phase on touch devices.
// API: InAppKeyboard.open({ onChar, onSubmit, onEscape, onCursor }) / .close()

const CSS = `
#in-app-kb {
  display: none;
  width: 780px;
  background: #0a0500;
  border: 4px solid #8a6a20;
  border-top: 2px solid #5a3a08;
  padding: 10px 10px 14px;
  box-sizing: border-box;
}
#in-app-kb.active { display: block; }
.kb-inner {
  width: 676px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kb-row {
  display: flex;
  gap: 4px;
}
.kb-row.row-z { margin-left: 30px; }
.kb-key {
  background: rgba(10,5,0,0.9);
  border: 1.5px solid #8a6a20;
  border-radius: 4px;
  color: #f0c020;
  font-family: monospace;
  height: 44px;
  width: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  font-size: 14px;
  flex-shrink: 0;
  touch-action: none;
  box-sizing: border-box;
}
.kb-key.action {
  background: rgba(25,12,0,0.9);
  border-color: #b07830;
  color: #ffcc40;
  font-size: 11px;
}
.kb-key.kb-del {
  flex: 1;
  width: auto;
  font-size: 11px;
  background: rgba(25,12,0,0.9);
  border-color: #b07830;
  color: #ffcc40;
}
.kb-key.kb-esc {
  width: 60px;
  background: rgba(20,5,0,0.9);
  border-color: #8a3010;
  color: #d06030;
  font-size: 11px;
}
.kb-key.kb-enter {
  width: 88px;
  background: rgba(5,20,0,0.9);
  border-color: #207840;
  color: #40c060;
  font-size: 11px;
}
.kb-key.kb-toggle {
  width: 68px;
  background: rgba(20,15,5,0.9);
  border-color: #a08030;
  color: #e0c060;
  font-size: 11px;
  font-weight: bold;
}
.kb-key.kb-space {
  flex: 1;
  width: auto;
  font-size: 10px;
  letter-spacing: 3px;
}
.kb-key.kb-arrow {
  width: 52px;
  font-size: 16px;
}
.kb-sep { width: 14px; flex-shrink: 0; }
`;

export const InAppKeyboard = (() => {
  let _open      = false;
  let _onChar    = null;
  let _onSubmit  = null;
  let _onEscape  = null;
  let _onCursor  = null;
  let _isAbc     = true;
  let _modeAbc   = null;
  let _mode123   = null;
  let _toggleBtn = null;

  return {
    init() {},
    open({ onChar, onSubmit, onEscape, onCursor }) {},
    close() {},
    isOpen() { return _open; },
  };
})();
```

- [ ] **Step 2: Commit skeleton**

```bash
git add frontend/ui/in-app-keyboard.js
git commit -m "feat: scaffold InAppKeyboard module (CSS + empty shell)"
```

---

## Task 2: Build DOM — ABC rows and 123 rows

**Files:**
- Modify: `frontend/ui/in-app-keyboard.js`

- [ ] **Step 1: Add helper functions and `_buildAbcRows()` inside the IIFE, above the `return` statement**

```js
  // ── Helpers ───────────────────────────────────────────────

  function _tap(fn) {
    return e => { e.preventDefault(); if (_open) fn(); };
  }

  function _touchKey(el, fn) {
    el.addEventListener('touchstart', _tap(fn), { passive: false });
    el.addEventListener('touchend',   e => e.preventDefault(), { passive: false });
  }

  function _key(label, extraClass) {
    const k = document.createElement('div');
    k.className = 'kb-key' + (extraClass ? ' ' + extraClass : '');
    k.textContent = label;
    return k;
  }

  function _charKey(ch, extraClass) {
    const k = _key(ch, extraClass);
    _touchKey(k, () => _onChar?.(ch));
    return k;
  }

  // ── ABC rows ─────────────────────────────────────────────

  function _buildAbcRows() {
    const wrap = document.createElement('div');

    // Q–P row
    const qRow = document.createElement('div');
    qRow.className = 'kb-row';
    for (const ch of 'QWERTYUIOP') qRow.appendChild(_charKey(ch));
    wrap.appendChild(qRow);

    // A–L row + DEL (fills remaining width)
    const aRow = document.createElement('div');
    aRow.className = 'kb-row';
    for (const ch of 'ASDFGHJKL') aRow.appendChild(_charKey(ch));
    const del1 = _key('⌫ DEL', 'kb-del');
    _touchKey(del1, () => _onChar?.('\b'));
    aRow.appendChild(del1);
    wrap.appendChild(aRow);

    // Z–M row (staggered via .row-z)
    const zRow = document.createElement('div');
    zRow.className = 'kb-row row-z';
    for (const ch of 'ZXCVBNM') zRow.appendChild(_charKey(ch));
    wrap.appendChild(zRow);

    return wrap;
  }
```

- [ ] **Step 2: Add `_build123Rows()` below `_buildAbcRows()`**

```js
  // ── 123 rows ─────────────────────────────────────────────

  function _build123Rows() {
    const wrap = document.createElement('div');

    // 1–0 row
    const numRow = document.createElement('div');
    numRow.className = 'kb-row';
    for (const ch of '1234567890') numRow.appendChild(_charKey(ch));
    wrap.appendChild(numRow);

    // Symbols row 1 + DEL
    const sym1Row = document.createElement('div');
    sym1Row.className = 'kb-row';
    for (const ch of ['-', '/', ':', ';', '(', ')', '$', '&', '@']) {
      sym1Row.appendChild(_charKey(ch));
    }
    const del2 = _key('⌫ DEL', 'kb-del');
    _touchKey(del2, () => _onChar?.('\b'));
    sym1Row.appendChild(del2);
    wrap.appendChild(sym1Row);

    // Symbols row 2 (staggered, same offset as Z row)
    const sym2Row = document.createElement('div');
    sym2Row.className = 'kb-row row-z';
    for (const ch of ['.', ',', '?', '!', "'", '"', '#']) {
      sym2Row.appendChild(_charKey(ch));
    }
    wrap.appendChild(sym2Row);

    return wrap;
  }
```

- [ ] **Step 3: Commit rows**

```bash
git add frontend/ui/in-app-keyboard.js
git commit -m "feat: build ABC and 123 key rows for InAppKeyboard"
```

---

## Task 3: Build action row, toggle logic, and `init()`

**Files:**
- Modify: `frontend/ui/in-app-keyboard.js`

- [ ] **Step 1: Add `_buildActionRow()` and `_toggleMode()` below the row builders**

```js
  // ── Toggle ────────────────────────────────────────────────

  function _toggleMode() {
    _isAbc = !_isAbc;
    _modeAbc.style.display = _isAbc ? '' : 'none';
    _mode123.style.display = _isAbc ? 'none' : '';
    _toggleBtn.textContent = _isAbc ? '123' : 'ABC';
  }

  // ── Action row ────────────────────────────────────────────

  function _buildActionRow() {
    const row = document.createElement('div');
    row.className = 'kb-row';

    const escBtn = _key('ESC', 'kb-esc');
    _touchKey(escBtn, () => _onEscape?.());
    row.appendChild(escBtn);

    const sep1 = document.createElement('div');
    sep1.className = 'kb-sep';
    row.appendChild(sep1);

    _toggleBtn = _key('123', 'kb-toggle');
    _touchKey(_toggleBtn, _toggleMode);
    row.appendChild(_toggleBtn);

    const spaceBtn = _key('SPACE', 'kb-space');
    _touchKey(spaceBtn, () => _onChar?.(' '));
    row.appendChild(spaceBtn);

    const leftBtn = _key('←', 'kb-arrow action');
    _touchKey(leftBtn, () => _onCursor?.('left'));
    row.appendChild(leftBtn);

    const rightBtn = _key('→', 'kb-arrow action');
    _touchKey(rightBtn, () => _onCursor?.('right'));
    row.appendChild(rightBtn);

    const sep2 = document.createElement('div');
    sep2.className = 'kb-sep';
    row.appendChild(sep2);

    const enterBtn = _key('ENTER ↵', 'kb-enter');
    _touchKey(enterBtn, () => _onSubmit?.());
    row.appendChild(enterBtn);

    return row;
  }
```

- [ ] **Step 2: Implement `init()` inside the `return` block**

Replace the empty `init() {}` with:

```js
    init() {
      const style = document.createElement('style');
      style.textContent = CSS;
      document.head.appendChild(style);

      const kb = document.createElement('div');
      kb.id = 'in-app-kb';

      const inner = document.createElement('div');
      inner.className = 'kb-inner';

      _modeAbc = _buildAbcRows();
      _mode123 = _build123Rows();
      _mode123.style.display = 'none';

      inner.appendChild(_modeAbc);
      inner.appendChild(_mode123);
      inner.appendChild(_buildActionRow());
      kb.appendChild(inner);

      // Insert flush below #dlg in document flow
      document.getElementById('dlg').insertAdjacentElement('afterend', kb);
    },
```

- [ ] **Step 3: Implement `open()` and `close()` inside the `return` block**

Replace the empty stubs:

```js
    open({ onChar, onSubmit, onEscape, onCursor }) {
      _open     = true;
      _onChar   = onChar;
      _onSubmit = onSubmit;
      _onEscape = onEscape;
      _onCursor = onCursor ?? null;

      // Always open in ABC mode
      _isAbc = true;
      _modeAbc.style.display = '';
      _mode123.style.display = 'none';
      if (_toggleBtn) _toggleBtn.textContent = '123';

      document.getElementById('in-app-kb').classList.add('active');
      document.getElementById('mc-pad')?.style.setProperty('display', 'none');
      document.getElementById('mc-aux')?.style.setProperty('display', 'none');
    },

    close() {
      _open     = false;
      _onChar   = null;
      _onSubmit = null;
      _onEscape = null;
      _onCursor = null;

      document.getElementById('in-app-kb').classList.remove('active');
      const pad = document.getElementById('mc-pad');
      const aux = document.getElementById('mc-aux');
      if (pad) pad.style.display = '';
      if (aux) aux.style.display = '';
    },
```

- [ ] **Step 4: Commit**

```bash
git add frontend/ui/in-app-keyboard.js
git commit -m "feat: complete InAppKeyboard — action row, toggle, init/open/close"
```

---

## Task 4: Wire into `mobile-controls.js`

**Files:**
- Modify: `frontend/ui/mobile-controls.js` (line 1 import, line 101 init call)

- [ ] **Step 1: Add import at the top of `mobile-controls.js`**

After line 1 (`import { MobileTextInput } ...`), add:

```js
import { InAppKeyboard } from './in-app-keyboard.js';
```

- [ ] **Step 2: Call `InAppKeyboard.init()` at the end of `initMobileControls()`**

After line 101 (`MobileTextInput.init();`), add:

```js
  InAppKeyboard.init();
```

- [ ] **Step 3: Commit**

```bash
git add frontend/ui/mobile-controls.js
git commit -m "feat: call InAppKeyboard.init() from initMobileControls"
```

- [ ] **Step 4: Smoke-test in browser — keyboard appears below dialogue**

```
docker compose up
open http://localhost:5173
```

- Walk to the Sphinx in the Oasis realm.
- Interact — the riddle reading phase should show the `#dlg` panel.
- Press Space/Enter to advance to the typing phase.
- Expected on a touch device (or DevTools → mobile emulation): the `#in-app-kb` panel appears below `#dlg` showing QWERTY rows. No native keyboard opens.
- Expected on desktop: `#in-app-kb` does not appear (guarded by `navigator.maxTouchPoints`).
- Tap `123` — rows switch to numbers/symbols. Tap `ABC` — rows switch back.

---

## Task 5: Update `RiddleManager` — swap to `InAppKeyboard` + cursor tracking

**Files:**
- Modify: `frontend/worlds/oasis/riddles.js`

The current `_input` is a simple string appended/sliced at the end. With ← → arrow support, we need `_cursorPos` (an integer index into `_input`). All char insertions and deletions go through `_cursorPos`.

- [ ] **Step 1: Swap the import (line 8)**

Replace:
```js
import { MobileTextInput } from '../../ui/mobile-text-input.js';
```
With:
```js
import { InAppKeyboard } from '../../ui/in-app-keyboard.js';
```

- [ ] **Step 2: Add `_cursorPos` to module-level state (after line 93 `let _input = ''`)**

```js
let _cursorPos  = 0;
```

- [ ] **Step 3: Reset `_cursorPos` in `start()` (after `_input = ''` on line 185)**

```js
      _cursorPos = 0;
```

- [ ] **Step 4: Replace `_openMobileInput()` entirely**

Current (lines 117–139):
```js
  function _openMobileInput() {
    if (navigator.maxTouchPoints > 0) {
      MobileTextInput.open({
        onChar(ch) {
          if (ch === '\b') {
            _input = _input.slice(0, -1);
          } else {
            _input = (_input + ch.toUpperCase()).slice(0, 18);
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
```

Replace with:
```js
  function _openMobileInput() {
    if (navigator.maxTouchPoints > 0) {
      _cursorPos = _input.length;
      InAppKeyboard.open({
        onChar(ch) {
          if (ch === '\b') {
            if (_cursorPos > 0) {
              _input = _input.slice(0, _cursorPos - 1) + _input.slice(_cursorPos);
              _cursorPos--;
            }
          } else if (_input.length < 18) {
            const upper = ch.toUpperCase();
            _input = _input.slice(0, _cursorPos) + upper + _input.slice(_cursorPos);
            _cursorPos++;
          }
        },
        onSubmit() {
          if (_input.trim().length > 0) _submit();
        },
        onEscape() {
          _active = false;
          _phase  = 'idle';
          InAppKeyboard.close();
          const el = document.getElementById('dlg');
          if (el) el.classList.remove('active');
        },
        onCursor(dir) {
          if (dir === 'left')  _cursorPos = Math.max(0, _cursorPos - 1);
          if (dir === 'right') _cursorPos = Math.min(_input.length, _cursorPos + 1);
        },
      });
    }
  }
```

- [ ] **Step 5: Replace the three remaining `MobileTextInput.close()` calls**

Line 154 — in `_submit()`:
```js
    MobileTextInput.close();
```
→
```js
    InAppKeyboard.close();
```

Line 198 — in `onKeyDown` Escape handler:
```js
      MobileTextInput.close();
```
→
```js
      InAppKeyboard.close();
```

Line 229 — in wrong-phase retry (`_input = '';`):
Reset cursor after clearing input. This block currently reads:
```js
      } else if (key === 'Enter' || key === ' ') {
          _phase     = 'typing';
          _input     = '';
          _openMobileInput();
        }
```
Add `_cursorPos = 0;` before `_openMobileInput()`:
```js
      } else if (key === 'Enter' || key === ' ') {
          _phase     = 'typing';
          _input     = '';
          _cursorPos = 0;
          _openMobileInput();
        }
```

- [ ] **Step 6: Update the typing-phase render to place cursor at `_cursorPos`**

Find the render block (around line 294–301):
```js
      if (_phase === 'typing') {
        const cursor = Math.floor(t / 500) % 2 === 0 ? '█' : ' ';
        // Escape input before injecting into innerHTML
        const safeInput = _input.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        choicesEl.innerHTML =
          `<div class="dlg-choice" style="margin-top:6px">` +
          `<span style="color:var(--gold-dim)">YOUR ANSWER &rsaquo; </span>` +
          `<span style="color:var(--gold)">${safeInput}${cursor}</span></div>`;
```

Replace with:
```js
      if (_phase === 'typing') {
        const cursor = Math.floor(t / 500) % 2 === 0 ? '█' : ' ';
        const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const before = esc(_input.slice(0, _cursorPos));
        const after  = esc(_input.slice(_cursorPos));
        choicesEl.innerHTML =
          `<div class="dlg-choice" style="margin-top:6px">` +
          `<span style="color:var(--gold-dim)">YOUR ANSWER &rsaquo; </span>` +
          `<span style="color:var(--gold)">${before}${cursor}${after}</span></div>`;
```

- [ ] **Step 7: Commit**

```bash
git add frontend/worlds/oasis/riddles.js
git commit -m "feat: wire InAppKeyboard into RiddleManager with cursor-aware input"
```

---

## Task 6: End-to-end verification

- [ ] **Step 1: Rebuild and open the game in mobile emulation**

```
docker compose up
open http://localhost:5173
```

Open DevTools → Toggle device toolbar → pick a phone preset (e.g. iPhone 12, 390px wide).

- [ ] **Step 2: Verify ABC typing**

- Walk to the Sphinx, interact to start a riddle.
- Press Space to advance to typing phase.
- Expected: `#in-app-kb` appears below `#dlg`. No native keyboard pops up.
- Tap `H`, `O`, `L`, `E` — "YOUR ANSWER › HOLE█" appears in the dialogue box.
- Tap `⌫ DEL` — removes `E`, cursor moves back.
- Tap `←` twice — cursor moves left past `L` and `O`. Tap `→` once — cursor moves right. Type `X` — inserts mid-word.
- Tap `ENTER ↵` — submits; correct answer shows response text.
- Tap `ESC` — closes dialogue and keyboard, `#mc-pad` and `#mc-aux` restore.

- [ ] **Step 3: Verify 123 mode**

- Re-enter the Sphinx typing phase.
- Tap `123` — rows switch to `1–0` / `- / : ; ( ) $ & @` / `. , ? ! ' " #`.
- Tap `ABC` — rows switch back to QWERTY.
- Tap `.` then `?` in 123 mode — characters appear in the answer field as `. ?`.

- [ ] **Step 4: Verify wrong-answer retry flow**

- Type a wrong answer and submit.
- "INCORRECT." response appears. Press Enter (physical keyboard, desktop test) to retry.
- Expected: `_input` clears, `_cursorPos` resets to 0, keyboard re-opens in ABC mode.

- [ ] **Step 5: Final commit**

```bash
git add -p   # review any stray changes
git commit -m "feat: in-app keyboard complete and verified"
```
