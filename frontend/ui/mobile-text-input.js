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
    btn.className = 'mc-btn'; // .mc-btn styling is defined in mobile-controls.js (shared)
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
