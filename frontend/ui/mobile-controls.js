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
}
