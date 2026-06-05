const CSS = `
#mc-pad {
  position: fixed;
  bottom: 20px;
  left: 20px;
  display: grid;
  grid-template-columns: repeat(3, 52px);
  grid-template-rows: repeat(3, 52px);
  gap: 4px;
  z-index: 1000;
  user-select: none;
  -webkit-user-select: none;
}
.mc-btn {
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

  btn.addEventListener('touchstart', e => { e.preventDefault(); fireKey('keydown', key); }, { passive: false });
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
  pad.appendChild(makeBtn('←',     'ArrowLeft',  1, 2));
  pad.appendChild(makeBtn('space', ' ',          2, 2, '10px'));
  pad.appendChild(makeBtn('→',     'ArrowRight', 3, 2));
  pad.appendChild(makeBtn('Z',     'z',          1, 3));
  pad.appendChild(makeBtn('↓',     'ArrowDown',  2, 3));
  pad.appendChild(makeBtn('⇧',     'Shift',      3, 3));

  document.body.appendChild(pad);
}
