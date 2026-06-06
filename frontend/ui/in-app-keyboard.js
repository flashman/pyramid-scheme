// ── FILE: ui/in-app-keyboard.js ────────────────────────────
// Custom on-screen QWERTY keyboard rendered below #dlg.
// Replaces MobileTextInput for the riddle typing phase on touch devices.
// API: InAppKeyboard.open({ onChar, onSubmit, onEscape, onCursor }) / .close()

const CSS = `
#in-app-kb {
  width: 780px;
  box-sizing: border-box;
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.38s cubic-bezier(0.16, 1, 0.3, 1);
}
#in-app-kb.active {
  max-height: 640px;
  background: #0a0500;
  border: 4px solid #8a6a20;
  border-top: 2px solid #5a3a08;
}
.kb-inner {
  width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 0 14px;
}
.kb-row {
  display: flex;
  gap: 4px;
}
.kb-row.row-a { margin-left: 20px; }
.kb-row.row-z { margin-left: 40px; }
.kb-key {
  background: rgba(10,5,0,0.9);
  border: 1.5px solid #8a6a20;
  border-radius: 5px;
  color: #f0c020;
  font-family: monospace;
  height: 70px;
  width: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  font-size: 18px;
  flex-shrink: 0;
  touch-action: none;
  box-sizing: border-box;
}
.kb-key.action {
  background: rgba(25,12,0,0.9);
  border-color: #b07830;
  color: #ffcc40;
  font-size: 13px;
}
.kb-key.kb-del {
  flex: 1;
  width: auto;
  font-size: 13px;
  background: rgba(25,12,0,0.9);
  border-color: #b07830;
  color: #ffcc40;
}
.kb-key.kb-esc {
  width: 70px;
  background: rgba(20,5,0,0.9);
  border-color: #8a3010;
  color: #d06030;
  font-size: 13px;
}
.kb-key.kb-enter {
  width: 100px;
  background: rgba(5,20,0,0.9);
  border-color: #207840;
  color: #40c060;
  font-size: 13px;
}
.kb-key.kb-toggle {
  width: 84px;
  background: rgba(20,15,5,0.9);
  border-color: #a08030;
  color: #e0c060;
  font-size: 13px;
  font-weight: bold;
}
.kb-key.kb-space {
  flex: 1;
  width: auto;
  font-size: 11px;
  letter-spacing: 3px;
}
.kb-key.kb-arrow {
  width: 70px;
  font-size: 20px;
}
.kb-sep { width: 16px; flex-shrink: 0; }
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
    aRow.className = 'kb-row row-a';
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
    sym1Row.className = 'kb-row row-a';
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

  return {
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

      const kb = document.getElementById('in-app-kb');
      if (kb) kb.classList.add('active');
      document.getElementById('mc-pad')?.style.setProperty('display', 'none');
      document.getElementById('mc-aux')?.style.setProperty('display', 'none');
    },

    close() {
      _open     = false;
      _onChar   = null;
      _onSubmit = null;
      _onEscape = null;
      _onCursor = null;

      const kb = document.getElementById('in-app-kb');
      if (kb) kb.classList.remove('active');
      const pad = document.getElementById('mc-pad');
      const aux = document.getElementById('mc-aux');
      if (pad) pad.style.display = '';
      if (aux) aux.style.display = '';
    },

    isOpen() { return _open; },
  };
})();
