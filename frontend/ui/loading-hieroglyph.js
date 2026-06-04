// Hieroglyph slot-machine loading screen — alternative to loading-hourglass.js.
// Not currently wired up in main.js. Swap the import there to use this instead.
// Exports waitForBackend(): resolves when GET /api/config returns 200.

const GLYPHS = ['𓂀','𓋹','𓆣','𓇯','𓁶','𓆄','𓃭','𓏏','𓆑','𓅓'];
const COLORS = ['#f0c020','#c89030','#a07020','#8a6a20','#6a4010','#4a2c00'];
const PHASES = [
  'CONSULTING THE ORACLE...',
  'SUMMONING THE DESERT...',
  'THE PYRAMID AWAKENS...',
];

const CSS = `
#hiero-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: #0a0500;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-family: monospace;
  transition: opacity 0.3s;
}
#hiero-title {
  color: #f0c020; font-size: 12px; letter-spacing: 3px;
  margin-bottom: 24px;
}
#hiero-slot {
  width: 280px;
  border: 1px solid #3a2000;
  background: #060300;
  overflow: hidden;
  position: relative;
}
#hiero-slot::after {
  content: '';
  position: absolute; inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px, transparent 3px,
    rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px
  );
  pointer-events: none;
}
.hiero-hl {
  position: absolute; left: 0; right: 0; top: 50%;
  transform: translateY(-50%);
  height: 36px;
  border-top: 1px solid rgba(138,106,32,0.27);
  border-bottom: 1px solid rgba(138,106,32,0.27);
  background: rgba(240,192,32,0.03);
  pointer-events: none;
}
.hiero-row-wrap {
  width: 100%; overflow: hidden; height: 34px;
  display: flex; align-items: center;
  border-bottom: 1px solid #1a0e00;
}
.hiero-row-wrap:last-child { border-bottom: none; }
.hiero-row { display: inline-block; white-space: nowrap; will-change: transform; }
.hiero-row span { font-size: 20px; margin: 0 10px; display: inline-block; }
#hiero-divider {
  width: 200px; height: 1px; background: #2a1800; margin: 16px auto;
}
#hiero-phase {
  color: #8a6a20; font-size: 6px; letter-spacing: 2px;
  height: 12px; margin-bottom: 14px;
}
#hiero-dots span { font-size: 11px; margin: 0 4px; transition: color 0.3s; }
`;

export function waitForBackend() {
  const BASE = window.API_BASE || '';
  return new Promise(resolve => {
    fetch(`${BASE}/api/config`).then(r => {
      if (r.ok) { resolve(); return; }
      _showOverlayAndPoll(BASE, resolve);
    }).catch(() => _showOverlayAndPoll(BASE, resolve));
  });
}

function _showOverlayAndPoll(BASE, resolve) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'hiero-overlay';
  overlay.innerHTML = `
    <div id="hiero-title">⚡ PYRAMID SCHEME™ ⚡</div>
    <div id="hiero-slot">
      <div class="hiero-hl"></div>
      <div class="hiero-row-wrap"><div class="hiero-row" id="hiero-r0"></div></div>
      <div class="hiero-row-wrap"><div class="hiero-row" id="hiero-r1"></div></div>
      <div class="hiero-row-wrap"><div class="hiero-row" id="hiero-r2"></div></div>
    </div>
    <div id="hiero-divider"></div>
    <div id="hiero-phase">CONSULTING THE ORACLE...</div>
    <div id="hiero-dots">
      <span>●</span><span>●</span><span>●</span><span>●</span><span>●</span>
    </div>
  `;
  document.body.appendChild(overlay);

  const stopAnim = _startHieroglyph(overlay);

  async function poll() {
    try {
      const res = await fetch(`${BASE}/api/config`);
      if (res.ok) {
        stopAnim();
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); style.remove(); resolve(); }, 320);
        return;
      }
    } catch { /* backend not up yet */ }
    setTimeout(poll, 3000);
  }
  poll();
}

function _startHieroglyph(overlay) {
  const rowSpeeds = [28, -19, 13];
  const rowOffsets = [0, 3, 6];
  const LOOP_W = GLYPHS.length * 40;
  const positions = [0, 0, 0];

  const rowEls = [0, 1, 2].map(i => {
    const el = overlay.querySelector(`#hiero-r${i}`);
    const glyphs = [...GLYPHS, ...GLYPHS, ...GLYPHS, ...GLYPHS];
    el.innerHTML = glyphs.map((g, j) =>
      `<span style="color:${COLORS[(j + rowOffsets[i]) % COLORS.length]}">${g}</span>`
    ).join('');
    return el;
  });

  const phaseEl = overlay.querySelector('#hiero-phase');
  const dotSpans = overlay.querySelectorAll('#hiero-dots span');
  let dotStep = 0, phaseIdx = 0;

  const dotsInterval = setInterval(() => {
    dotSpans.forEach((s, i) => { s.style.color = i <= dotStep ? '#f0c020' : '#2a1800'; });
    dotStep++;
    if (dotStep >= dotSpans.length) {
      dotStep = 0;
      phaseIdx = (phaseIdx + 1) % PHASES.length;
      phaseEl.textContent = PHASES[phaseIdx];
    }
  }, 500);

  let running = true;
  let last = null;

  function frame(ts) {
    if (!running) return;
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    rowSpeeds.forEach((spd, ri) => {
      positions[ri] = ((positions[ri] + spd * dt) % LOOP_W + LOOP_W) % LOOP_W;
      rowEls[ri].style.transform = `translateX(-${positions[ri]}px)`;
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return () => { running = false; clearInterval(dotsInterval); };
}
