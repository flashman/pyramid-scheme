// ── FILE: worlds/nile/shop/ware-art.js ───────────────────
// Procedural pixel icons for the bazaar wares, in the game's draw idiom.
// drawWareArt(X, id, cx, cy, s, t) renders a centered icon (footprint ~s);
// any missing id falls back to a generic crate so the grid never blanks.
// These per-item fns are the iterate-later surface — small and characterful.

const ICON = {
  invite_scroll(X, x, y, s, t) {
    X.fillStyle = '#e8d8b0'; X.fillRect(x - s*0.32, y - s*0.18, s*0.64, s*0.36);
    X.fillStyle = '#cdb888'; X.fillRect(x - s*0.32, y - s*0.18, s*0.06, s*0.36); X.fillRect(x + s*0.26, y - s*0.18, s*0.06, s*0.36);
    X.fillStyle = '#9a3a2a'; X.beginPath(); X.arc(x, y, s*0.1, 0, Math.PI*2); X.fill();
  },
  scarab_amulet(X, x, y, s, t) {
    X.fillStyle = '#caa040'; X.beginPath(); X.ellipse(x, y, s*0.3, s*0.24, 0, 0, Math.PI*2); X.fill();
    X.fillStyle = '#2f7a6a'; X.beginPath(); X.ellipse(x, y, s*0.22, s*0.17, 0, 0, Math.PI*2); X.fill();
    X.fillStyle = '#3f9a86'; X.fillRect(x - s*0.02, y - s*0.16, s*0.04, s*0.32);
    X.fillStyle = '#1a4a40'; X.fillRect(x - s*0.2, y - s*0.02, s*0.4, s*0.03);
  },
  bronze_coin(X, x, y, s, t) {
    X.fillStyle = '#9a6a2a'; X.beginPath(); X.arc(x, y, s*0.34, 0, Math.PI*2); X.fill();
    X.fillStyle = '#c89030'; X.beginPath(); X.arc(x, y, s*0.27, 0, Math.PI*2); X.fill();
    X.fillStyle = '#6a4a1a'; X.fillRect(x - s*0.06, y - s*0.16, s*0.12, s*0.3);
    X.save(); X.globalAlpha = 0.4 + 0.3*Math.sin(t/300); X.fillStyle = '#ffe9b0';
    X.fillRect(x - s*0.18, y - s*0.18, s*0.06, s*0.06); X.restore();
  },
  croc_sandals(X, x, y, s, t) {
    for (const dx of [-s*0.16, s*0.16]) {
      X.fillStyle = '#3a6a3a'; X.beginPath(); X.ellipse(x + dx, y, s*0.1, s*0.26, 0, 0, Math.PI*2); X.fill();
      X.fillStyle = '#5a9a4a'; for (let i = -2; i <= 2; i++) X.fillRect(x + dx - s*0.06, y + i*s*0.08, s*0.12, s*0.03);
      X.fillStyle = '#caa040'; X.fillRect(x + dx - s*0.04, y - s*0.06, s*0.08, s*0.03);
    }
  },
  secret_flood(X, x, y, s, t) {
    X.fillStyle = '#8a7a5a'; X.fillRect(x - s*0.1, y - s*0.3, s*0.2, s*0.6);   // nilometer column
    X.fillStyle = '#5a4a2a'; for (let i = 0; i < 6; i++) X.fillRect(x - s*0.1, y - s*0.26 + i*s*0.09, s*0.2, s*0.02);
    X.save(); X.globalAlpha = 0.55; X.fillStyle = '#3a7a8a'; X.fillRect(x - s*0.34, y + s*0.06, s*0.68, s*0.24); X.restore();
    X.fillStyle = '#bfe2dc'; X.fillRect(x - s*0.34, y + s*0.06, s*0.68, s*0.02);
  },
  secret_compounding(X, x, y, s, t) {
    X.fillStyle = '#c89030';
    for (let i = 0; i < 5; i++) { const r = s*0.3 - i*s*0.05; X.beginPath(); X.arc(x, y, r, i, i + 1.6); X.lineWidth = s*0.05; X.strokeStyle = '#c89030'; X.stroke(); }
    X.fillStyle = '#ffe9b0'; X.beginPath(); X.arc(x, y, s*0.04, 0, Math.PI*2); X.fill();
  },
  secret_recursion(X, x, y, s, t) {
    const tri = (cx, cy, w) => { X.beginPath(); X.moveTo(cx, cy - w); X.lineTo(cx + w, cy + w*0.7); X.lineTo(cx - w, cy + w*0.7); X.closePath(); X.fill(); };
    X.fillStyle = '#caa040'; tri(x, y, s*0.32);
    X.fillStyle = '#7a5a20'; tri(x, y + s*0.06, s*0.18);
    X.fillStyle = '#ffe9b0'; X.fillRect(x - s*0.02, y + s*0.04, s*0.04, s*0.04);
  },
  secret_fire(X, x, y, s, t) {
    X.fillStyle = '#1a140c'; X.fillRect(x - s*0.3, y - s*0.3, s*0.6, s*0.6);   // deadpan dark tile
    const f = Math.sin(t/180)*s*0.02;
    X.fillStyle = '#e86a20'; X.beginPath(); X.moveTo(x, y - s*0.26 + f); X.quadraticCurveTo(x + s*0.16, y, x, y + s*0.2); X.quadraticCurveTo(x - s*0.16, y, x, y - s*0.26 + f); X.fill();
    X.fillStyle = '#ffd070'; X.beginPath(); X.moveTo(x, y - s*0.1); X.quadraticCurveTo(x + s*0.07, y + s*0.04, x, y + s*0.16); X.quadraticCurveTo(x - s*0.07, y + s*0.04, x, y - s*0.1); X.fill();
  },
  secret_name(X, x, y, s, t) {
    X.fillStyle = '#d8c9a0'; X.fillRect(x - s*0.28, y - s*0.3, s*0.56, s*0.6);
    X.save(); X.globalAlpha = 0.4 + 0.4*Math.sin(t/400); X.fillStyle = '#ffe9b0'; X.fillRect(x - s*0.16, y - s*0.18, s*0.32, s*0.36); X.restore();
    X.fillStyle = '#6a3a8a'; X.fillRect(x - s*0.1, y - s*0.14, s*0.2, s*0.04); X.fillRect(x - s*0.02, y - s*0.14, s*0.04, s*0.24); X.fillRect(x - s*0.1, y + s*0.06, s*0.2, s*0.04);
  },
  secret_orgchart(X, x, y, s, t) {
    X.fillStyle = '#caa040'; X.beginPath(); X.moveTo(x, y - s*0.3); X.lineTo(x + s*0.32, y + s*0.26); X.lineTo(x - s*0.32, y + s*0.26); X.closePath(); X.fill();
    X.fillStyle = '#1a140c'; X.fillRect(x - s*0.14, y - s*0.3, s*0.28, s*0.16);   // redacted apex
    X.fillStyle = '#7a5a20'; X.fillRect(x - s*0.28, y + s*0.08, s*0.56, s*0.02); X.fillRect(x - s*0.18, y - s*0.06, s*0.36, s*0.02);
  },
  paperwork_above(X, x, y, s, t) {
    X.fillStyle = '#e8e0cc'; X.fillRect(x - s*0.26, y - s*0.22, s*0.52, s*0.5);
    X.fillStyle = '#8a8276'; for (let i = 0; i < 4; i++) X.fillRect(x - s*0.2, y - s*0.12 + i*s*0.1, s*0.4, s*0.02);
    X.fillStyle = '#9a3a2a'; X.beginPath(); X.arc(x + s*0.14, y + s*0.18, s*0.07, 0, Math.PI*2); X.fill();   // stamp
    X.fillStyle = '#caa040'; X.fillRect(x - s*0.02, y - s*0.34, s*0.04, s*0.12); X.beginPath(); X.moveTo(x, y - s*0.2); X.lineTo(x - s*0.06, y - s*0.28); X.lineTo(x + s*0.06, y - s*0.28); X.fill();   // arrow from above
  },
  tongue_stone(X, x, y, s, t) {
    X.fillStyle = '#7a7a82'; X.beginPath(); X.ellipse(x, y, s*0.32, s*0.26, 0, 0, Math.PI*2); X.fill();
    X.fillStyle = '#9a9aa2'; X.beginPath(); X.ellipse(x - s*0.08, y - s*0.08, s*0.12, s*0.08, 0, 0, Math.PI*2); X.fill();
    X.fillStyle = '#2a2a30'; X.beginPath(); X.ellipse(x, y + s*0.06, s*0.16, s*0.06, 0, 0, Math.PI*2); X.fill();   // carved mouth
    X.fillStyle = '#b04a4a'; X.fillRect(x - s*0.06, y + s*0.06, s*0.12, s*0.03);
  },
  attentive_reel(X, x, y, s, t) {
    X.fillStyle = '#caa86a'; X.beginPath(); X.arc(x, y, s*0.32, 0, Math.PI*2); X.fill();
    X.fillStyle = '#8a6a3a'; X.beginPath(); X.arc(x, y, s*0.12, 0, Math.PI*2); X.fill();
    X.fillStyle = '#e8e2d0'; X.beginPath(); X.ellipse(x, y, s*0.16, s*0.1, 0, 0, Math.PI*2); X.fill();
    const lx = Math.sin(t/600)*s*0.05;
    X.fillStyle = '#1a2a3a'; X.beginPath(); X.arc(x + lx, y, s*0.05, 0, Math.PI*2); X.fill();
  },
  sky_iron(X, x, y, s, t) {
    X.save(); X.globalAlpha = 0.3 + 0.2*Math.sin(t/500); X.fillStyle = '#5a7a9a'; X.beginPath(); X.arc(x, y, s*0.34, 0, Math.PI*2); X.fill(); X.restore();
    X.fillStyle = '#2a2e36'; X.beginPath(); X.moveTo(x - s*0.2, y + s*0.24); X.lineTo(x - s*0.04, y - s*0.26); X.lineTo(x + s*0.16, y - s*0.04); X.lineTo(x + s*0.22, y + s*0.22); X.closePath(); X.fill();
    X.fillStyle = '#4a525e'; X.fillRect(x - s*0.04, y - s*0.2, s*0.04, s*0.34);
  },
  seed_phrase(X, x, y, s, t) {
    X.fillStyle = '#e6e0cc'; X.fillRect(x - s*0.36, y - s*0.16, s*0.72, s*0.32);
    X.fillStyle = '#3a3020';
    for (let i = 0; i < 12; i++) { const cx = x - s*0.3 + (i % 6) * s*0.12, cy = y - s*0.07 + Math.floor(i/6) * s*0.14; X.fillRect(cx, cy, s*0.05, s*0.05); }
  },
  future_receipt(X, x, y, s, t) {
    X.fillStyle = '#eee8dc'; X.beginPath(); X.moveTo(x - s*0.14, y - s*0.3);
    for (let i = 0; i <= 6; i++) X.lineTo(x - s*0.14 + (i%2? s*0.04 : 0), y - s*0.3 + i*s*0.1);
    X.lineTo(x + s*0.14, y + s*0.3); X.lineTo(x + s*0.14, y - s*0.3); X.closePath(); X.fill();
    X.fillStyle = '#9a9486'; for (let i = 0; i < 4; i++) X.fillRect(x - s*0.08, y - s*0.18 + i*s*0.1, s*0.16, s*0.02);
  },
  self_equity(X, x, y, s, t) {
    X.fillStyle = '#caa040'; X.fillRect(x - s*0.32, y - s*0.24, s*0.64, s*0.48);
    X.fillStyle = '#f4ecc8'; X.fillRect(x - s*0.27, y - s*0.19, s*0.54, s*0.38);
    X.fillStyle = '#6a4a8a'; X.beginPath(); X.arc(x, y - s*0.02, s*0.08, Math.PI, 0); X.fill(); X.fillRect(x - s*0.05, y - s*0.02, s*0.1, s*0.1);   // tiny self portrait
    X.fillStyle = '#9a8a6a'; X.fillRect(x - s*0.18, y + s*0.12, s*0.36, s*0.02);
  },
};

function _crate(X, x, y, s) {
  X.fillStyle = '#6b4a2a'; X.fillRect(x - s*0.3, y - s*0.3, s*0.6, s*0.6);
  X.fillStyle = '#8a6a3a'; X.fillRect(x - s*0.3, y - s*0.3, s*0.6, s*0.08);
  X.fillStyle = '#caa040'; X.font = `${Math.round(s*0.4)}px monospace`; X.textAlign = 'center';
  X.fillText('?', x, y + s*0.14);
}

export function drawWareArt(X, id, cx, cy, s, t) {
  X.save();
  const fn = ICON[id];
  if (fn) fn(X, cx, cy, s, t); else _crate(X, cx, cy, s);
  X.restore();
}
