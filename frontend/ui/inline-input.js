// ── FILE: ui/inline-input.js ──────────────────────────────
// A self-rendered single-line text field with a blinking block caret —
// before-text + █ + after-text spans, driven by an internal buffer. No native
// <input>, so the caret (via .kb-cursor) blinks on BOTH desktop and the
// in-app QWERTY, and keystrokes ride the game's existing key routing.
//
// Used by the Sphinx riddle and the astral chat. Desktop consumers route their
// keydown into handleKey(key); touch input is wired through InAppKeyboard
// automatically. The caller owns where the field mounts and what submit/cancel
// mean (validate-and-close vs send-and-stay).
//
//   const field = createInlineInput({ maxLength, transform, label,
//                                     rowClass, rowStyle, textColor, caretColor,
//                                     onSubmit(value), onCancel() });
//   field.open(mountEl);     // build + show; wires InAppKeyboard on touch
//   field.handleKey(key);    // desktop keystroke (Enter/Esc/Backspace/←/→/char)
//   field.value();           // current buffer
//   field.clear();           // reset to empty (e.g. after sending)
//   field.el;                // the row element (to insert siblings around it)
//   field.close();           // tear down + close InAppKeyboard

import { InAppKeyboard } from './in-app-keyboard.js';

const IS_TOUCH = () => navigator.maxTouchPoints > 0;

export function createInlineInput(opts = {}) {
  const {
    maxLength  = 200,
    transform  = (c) => c,            // e.g. c => c.toUpperCase()
    label      = '',                  // optional gold-dim prefix
    rowClass   = '',
    rowStyle   = '',
    textColor  = 'var(--gold)',
    caretColor = 'var(--gold)',
    onSubmit   = () => {},            // (value) => void  — caller trims/decides
    onCancel   = () => {},            // () => void
  } = opts;

  let buf = '', cur = 0;
  let row = null, beforeEl = null, afterEl = null, isOpen = false;

  function _render() {
    if (!beforeEl) return;
    beforeEl.textContent = buf.slice(0, cur);
    afterEl.textContent  = buf.slice(cur);
  }

  function insert(ch) {
    if (buf.length >= maxLength) return;
    const c = transform(ch);
    buf = buf.slice(0, cur) + c + buf.slice(cur);
    cur++;
    _render();
  }

  function backspace() {
    if (cur <= 0) return;
    buf = buf.slice(0, cur - 1) + buf.slice(cur);
    cur--;
    _render();
  }

  function moveCursor(dir) {
    if (dir === 'left')  cur = Math.max(0, cur - 1);
    if (dir === 'right') cur = Math.min(buf.length, cur + 1);
    _render();
  }

  return {
    get el() { return row; },
    value()  { return buf; },
    clear()  { buf = ''; cur = 0; _render(); },

    open(mount) {
      if (isOpen || !mount) return row;
      isOpen = true;
      buf = ''; cur = 0;

      row = document.createElement('div');
      if (rowClass) row.className = rowClass;
      if (rowStyle) row.style.cssText = rowStyle;

      if (label) {
        const l = document.createElement('span');
        l.style.color = 'var(--gold-dim)';
        l.textContent = label;
        row.appendChild(l);
      }
      beforeEl = document.createElement('span'); beforeEl.style.color = textColor;
      const caret = document.createElement('span');
      caret.textContent = '█';
      caret.className   = 'kb-cursor';
      caret.style.color = caretColor;
      afterEl = document.createElement('span');  afterEl.style.color = textColor;
      row.append(beforeEl, caret, afterEl);

      mount.appendChild(row);
      _render();

      if (IS_TOUCH()) {
        InAppKeyboard.open({
          onChar:   (ch) => (ch === '\b' ? backspace() : insert(ch)),
          onSubmit: ()   => onSubmit(buf),
          onEscape: ()   => onCancel(),
          onCursor: (dir) => moveCursor(dir),
        });
      }
      return row;
    },

    close() {
      if (!isOpen) return;
      isOpen = false;
      if (IS_TOUCH()) InAppKeyboard.close();
      row?.remove();
      row = beforeEl = afterEl = null;
    },

    // Desktop keystroke, routed from the consumer's onKeyDown.
    handleKey(key) {
      if      (key === 'Enter')      onSubmit(buf);
      else if (key === 'Escape')     onCancel();
      else if (key === 'Backspace')  backspace();
      else if (key === 'ArrowLeft')  moveCursor('left');
      else if (key === 'ArrowRight') moveCursor('right');
      else if (key.length === 1)     insert(key);
      // ArrowUp/Down, Shift, Tab, etc. are ignored while typing.
    },
  };
}
