// ── FILE: worlds/nile/shop/StallOverlay.js ───────────────
// First-person stall: a canvas sub-mode owned by NileRealm. Not a realm.
// You stand inside the tent: a life-size merchant (reused bazaar art) behind
// his table, the wares laid on it, framed by drapes / ceiling / a watching
// tapestry. The selected ware's name + pitch are spoken (typed) through the
// real #dlg dialogue window below the canvas.

import { X, CW, CH }        from '../../../engine/canvas.js';
import { G }                from '../../../game/state.js';
import { Api }              from '../../../game/api.js';
import { loadConfig, getShop, shopLoaded } from '../../../game/config.js';
import { WARES }            from './catalogue.js';
import { purchase, isOwned } from './buy.js';
import { drawWareArt }      from './ware-art.js';
import { drawMerchant, drawMerchantTent } from '../draw/nile.js';

const SCALE   = 2.7;     // merchant + tent magnification ("life size" in frame)
const FEET_Y  = 345;     // merchant feet (just behind the table top → legs hidden)
const TABLE_Y = 318;     // table surface line
const PER_ROW = 9;       // wares per row laid on the table (2 rows for 17)
const TYPE_MS = 26;      // ms per character of the merchant's spoken pitch

const RED = '#5a281f', RED_LT = '#7a3a30', RED_DK = '#3a1d18', GOLD = '#caa040';

/** The merchant's spoken pitch for a ware — its blurb, with an owned aside. */
function pitchFor(w) {
  if (!w) return '';
  if (isOwned(w.id)) return `${w.blurb}\n("YOU ALREADY CARRY ONE. ONE IS THE CORRECT NUMBER.")`;
  return w.blurb;
}

export class StallOverlay {
  constructor() {
    this._open = false;
    this._sel  = 0;
    this._loading = false;
    this._typeFull = '';     // current target pitch (resets the typewriter when it changes)
    this._typeStart = 0;
  }

  isOpen() { return this._open; }

  async open() {
    this._open = true;
    this._sel  = 0;
    this._typeFull = '';
    G.shake = 0;                    // steady frame — the loop applies G.shake around render()
    if (!shopLoaded()) {            // guests skip GameSession → no prices yet
      this._loading = true;
      try { await loadConfig(Api); } catch { /* leave _loading; render shows a notice */ }
      this._loading = false;
    }
  }

  close() {
    this._open = false;
    const dlg = document.getElementById('dlg');   // release the shared dialogue window
    if (dlg) dlg.classList.remove('active');
  }

  onKeyDown(key) {
    if (!this._open) return false;
    if (key === 'Escape' || key === 'q' || key === 'Q') { this.close(); return true; }
    const n = WARES.length;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { this._sel = (this._sel + 1) % n; return true; }
    if (key === 'ArrowLeft'  || key === 'a' || key === 'A') { this._sel = (this._sel - 1 + n) % n; return true; }
    if (key === 'ArrowDown'  || key === 's' || key === 'S') { this._sel = Math.min(n - 1, this._sel + PER_ROW); return true; }
    if (key === 'ArrowUp'    || key === 'w' || key === 'W') { this._sel = Math.max(0, this._sel - PER_ROW); return true; }
    if (key === ' ' || key === 'Enter' || key === 'z' || key === 'Z') {
      const ware = WARES[this._sel];
      if (ware) purchase(ware.id);   // fire-and-forget; render re-reads state
      return true;
    }
    return true;   // swallow all keys while open
  }

  /** Speak the selected ware through the real #dlg window — title in the gold
      speaker line; the pitch types out (the merchant "speaks" on select). */
  _speak(w) {
    const dlg = document.getElementById('dlg');
    if (!dlg) return;
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    const full = pitchFor(w);
    if (full !== this._typeFull) { this._typeFull = full; this._typeStart = performance.now(); }
    const shown = full.slice(0, Math.floor((performance.now() - this._typeStart) / TYPE_MS));
    set('dlg-speaker', w ? `THE MERCHANT  ✦  ${w.name.toUpperCase()}` : 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS');
    set('dlg-text', shown);
    const ch = document.getElementById('dlg-choices'); if (ch) ch.innerHTML = '';
    set('dlg-hint', '← → ↑ ↓ MOVE    SPACE BUY    ESC LEAVE');
    dlg.classList.add('active');     // re-asserted each frame (DialogueManager clears it when idle)
  }

  // ── Tent interior, behind the merchant ──────────────────
  _interiorBack(now) {
    // ceiling fabric: folds radiating from a central pole above the peak
    const cg = X.createLinearGradient(0, 0, 0, 150);
    cg.addColorStop(0, RED_DK); cg.addColorStop(1, '#2a1810');
    X.fillStyle = cg; X.fillRect(0, 0, CW, 150);
    X.save(); X.globalAlpha = 0.5; X.strokeStyle = RED; X.lineWidth = 2;
    for (let i = -6; i <= 6; i++) { X.beginPath(); X.moveTo(CW / 2, -10); X.lineTo(CW / 2 + i * 130, 150); X.stroke(); }
    X.restore();

    // side drapes framing the empty walls (table covers their lower half later)
    for (const left of [true, false]) {
      const x0 = left ? 0 : CW - 90, w = 90;
      const dg = X.createLinearGradient(x0, 0, x0 + w, 0);
      dg.addColorStop(0, left ? RED_DK : RED); dg.addColorStop(1, left ? RED : RED_DK);
      X.fillStyle = dg; X.fillRect(x0, 0, w, CH);
      X.strokeStyle = RED_DK; X.lineWidth = 2;
      for (let i = 1; i < 5; i++) { const fx = x0 + i * (w / 5); X.beginPath(); X.moveTo(fx, 0); X.lineTo(fx, CH); X.stroke(); }
      const inner = left ? x0 + w : x0;
      X.fillStyle = GOLD; X.globalAlpha = 0.5; X.fillRect(inner - (left ? 2 : 0), 0, 2, CH); X.globalAlpha = 1;   // gold trim
    }

    // back tapestry behind the merchant, with a watching eye (the apex is watching)
    X.fillStyle = '#241410'; X.fillRect(CW / 2 - 120, 110, 240, 240);
    X.save(); X.globalAlpha = 0.7; X.strokeStyle = GOLD; X.lineWidth = 2;
    X.beginPath(); X.moveTo(CW / 2, 140); X.lineTo(CW / 2 + 34, 200); X.lineTo(CW / 2 - 34, 200); X.closePath(); X.stroke();
    X.fillStyle = GOLD; X.beginPath(); X.ellipse(CW / 2, 178, 10, 6, 0, 0, Math.PI * 2); X.fill();
    X.fillStyle = '#241410'; X.beginPath(); X.arc(CW / 2 + Math.sin(now / 1400) * 3, 178, 3, 0, Math.PI * 2); X.fill();
    X.restore();

    // a hanging lantern, swaying, pooling warm light on the merchant
    const sway = Math.sin(now / 1300) * 6;
    X.strokeStyle = '#3a2410'; X.lineWidth = 1; X.beginPath(); X.moveTo(CW / 2, 0); X.lineTo(CW / 2 + sway, 64); X.stroke();
    X.save(); X.globalAlpha = 0.35 + 0.15 * Math.sin(now / 500);
    const lg = X.createRadialGradient(CW / 2 + sway, 80, 4, CW / 2 + sway, 80, 90);
    lg.addColorStop(0, '#ffcf80'); lg.addColorStop(1, 'transparent'); X.fillStyle = lg;
    X.fillRect(CW / 2 + sway - 90, 50, 180, 180); X.restore();
    X.fillStyle = '#c8902c'; X.fillRect(CW / 2 + sway - 5, 64, 10, 14);
    X.fillStyle = '#ffe9b0'; X.fillRect(CW / 2 + sway - 3, 68, 6, 8);
  }

  // ── Atmosphere in front: incense smoke + corner vignette ──
  _interiorFront(now) {
    for (const sx of [120, CW - 120]) {     // two incense curls rising off the table
      X.save(); X.globalAlpha = 0.18; X.strokeStyle = '#cfc4b0'; X.lineWidth = 2;
      X.beginPath(); X.moveTo(sx, TABLE_Y);
      for (let yy = TABLE_Y; yy > 120; yy -= 12) X.lineTo(sx + Math.sin(yy / 22 + now / 700) * 10, yy);
      X.stroke(); X.restore();
    }
    const vg = X.createRadialGradient(CW / 2, CH / 2, CH * 0.35, CW / 2, CH / 2, CH * 0.75);
    vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(8,5,2,0.7)');
    X.fillStyle = vg; X.fillRect(0, 0, CW, CH);
  }

  render() {
    if (!this._open) return;
    const shop = getShop();
    const now  = performance.now();

    // ── Warm dark interior base ──
    const bg = X.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, '#2a1c10'); bg.addColorStop(1, '#160f08');
    X.fillStyle = bg; X.fillRect(0, 0, CW, CH);

    this._interiorBack(now);

    // ── The tent structure + life-size merchant (transform keeps his look=0) ──
    X.save();
    X.translate(CW / 2 - G.px * SCALE, FEET_Y);
    X.scale(SCALE, SCALE);
    drawMerchantTent(G.px, 0, now);
    drawMerchant(G.px, -2, now);
    X.restore();

    if (this._loading) {
      X.textAlign = 'center'; X.fillStyle = '#cbb288'; X.font = '14px monospace';
      X.fillText('the merchant unrolls his catalogue…', CW / 2, CH / 2);
      X.textAlign = 'left'; this._speak(null); return;
    }

    // ── The table across the foreground ──
    X.fillStyle = '#5a3a1c'; X.fillRect(0, TABLE_Y, CW, CH - TABLE_Y);
    X.fillStyle = '#7a5226'; X.fillRect(0, TABLE_Y, CW, 8);
    X.fillStyle = '#3a2410'; X.fillRect(0, TABLE_Y + 8, CW, 3);
    X.fillStyle = '#8a6a3a'; for (let gx = 0; gx < CW; gx += 40) X.fillRect(gx, TABLE_Y, 2, CH - TABLE_Y);

    // ── Wares laid out on the table (two rows) ──
    const usable = CW - 80, slotW = usable / PER_ROW;
    const rowY = [TABLE_Y + 56, TABLE_Y + 128];
    WARES.forEach((w, i) => {
      const r = Math.floor(i / PER_ROW), c = i % PER_ROW;
      const cx = 40 + c * slotW + slotW / 2, cy = rowY[r];
      const priced = shop[w.id];
      const owned  = isOwned(w.id);
      const afford = priced && (G.earned || 0) >= priced.price;
      const sel    = i === this._sel;

      X.save(); X.globalAlpha = 0.4; X.fillStyle = '#1a1008';
      X.beginPath(); X.ellipse(cx, cy + 22, 22, 6, 0, 0, Math.PI * 2); X.fill(); X.restore();

      if (sel) { X.strokeStyle = '#f0d9a8'; X.lineWidth = 2; X.strokeRect(cx - slotW / 2 + 4, cy - 30, slotW - 8, 58); }
      drawWareArt(X, w.id, cx, cy - (sel ? 8 : 0), 46, now);

      X.textAlign = 'center'; X.font = '9px monospace';
      if (owned)       { X.fillStyle = '#9fd98a'; X.fillText('OWNED', cx, cy + 30); }
      else if (priced) { X.fillStyle = afford ? '#e8c878' : '#a05a4a'; X.fillText(`$${priced.price}`, cx, cy + 30); }
    });
    X.textAlign = 'left';

    this._interiorFront(now);
    this._speak(WARES[this._sel]);
  }
}
