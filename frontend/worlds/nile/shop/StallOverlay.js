// ── FILE: worlds/nile/shop/StallOverlay.js ───────────────
// First-person stall: a canvas sub-mode owned by NileRealm. Not a realm.
// You stand inside the tent: a life-size merchant (reused bazaar art) stands
// behind his table, the wares laid out on it. The selected ware's description
// is spoken through the real #dlg dialogue window below the canvas.

import { X, CW, CH }        from '../../../engine/canvas.js';
import { G }                from '../../../game/state.js';
import { Api }              from '../../../game/api.js';
import { loadConfig, getShop, shopLoaded } from '../../../game/config.js';
import { WARES }            from './catalogue.js';
import { purchase, isOwned } from './buy.js';
import { drawWareArt }      from './ware-art.js';
import { drawMerchant, drawMerchantTent } from '../draw/nile.js';

// Scene geometry (tunable). The merchant is drawn life-size and stands behind
// the table; the table occludes his lower legs.
const SCALE   = 2.7;     // merchant + tent magnification ("life size" in frame)
const FEET_Y  = 345;     // merchant feet (just behind the table top → legs hidden)
const TABLE_Y = 318;     // table surface line
const PER_ROW = 9;       // wares per row laid on the table (2 rows for 17)

/** The merchant's spoken line for a ware — its blurb, with an owned aside. */
function speechFor(w) {
  if (!w) return '';
  if (isOwned(w.id)) return `${w.blurb}\n("YOU ALREADY CARRY ONE. ONE IS THE CORRECT NUMBER.")`;
  return w.blurb;
}

export class StallOverlay {
  constructor() {
    this._open = false;
    this._sel  = 0;
    this._loading = false;
  }

  isOpen() { return this._open; }

  async open() {
    this._open = true;
    this._sel  = 0;
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

  /** Speak the selected ware through the real #dlg dialogue window (below the canvas). */
  _speak(w) {
    const dlg = document.getElementById('dlg');
    if (!dlg) return;
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('dlg-speaker', 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS');
    set('dlg-text', speechFor(w));
    const ch = document.getElementById('dlg-choices'); if (ch) ch.innerHTML = '';
    set('dlg-hint', '← → ↑ ↓ MOVE    SPACE BUY    ESC LEAVE');
    dlg.classList.add('active');   // re-asserted each frame (DialogueManager clears it when idle)
  }

  render() {
    if (!this._open) return;
    const shop = getShop();
    const now  = performance.now();

    // ── Inside the tent: warm dark interior fills the view ──
    const bg = X.createLinearGradient(0, 0, 0, CH);
    bg.addColorStop(0, '#2a1c10'); bg.addColorStop(1, '#160f08');
    X.fillStyle = bg; X.fillRect(0, 0, CW, CH);

    // ── The tent structure + the life-size merchant behind the table ──
    // Transform: translate so drawX(local) → screen-centered, scaled. Passing
    // x = G.px to drawMerchant keeps his look = (G.px - G.px)/140 = 0 (faces you).
    X.save();
    X.translate(CW / 2 - G.px * SCALE, FEET_Y - 0 * SCALE);
    X.scale(SCALE, SCALE);
    drawMerchantTent(G.px, 0, now);     // tent framed around him (back wall behind, canopy up top)
    drawMerchant(G.px, -2, now);        // the same shopkeeper as outside, life-size
    X.restore();

    if (this._loading) {
      X.textAlign = 'center'; X.fillStyle = '#cbb288'; X.font = '14px monospace';
      X.fillText('the merchant unrolls his catalogue…', CW / 2, CH / 2);
      X.textAlign = 'left';
      this._speak(null);
      return;
    }

    // ── The table across the foreground ──
    X.fillStyle = '#5a3a1c'; X.fillRect(0, TABLE_Y, CW, CH - TABLE_Y);
    X.fillStyle = '#7a5226'; X.fillRect(0, TABLE_Y, CW, 8);          // lit table surface
    X.fillStyle = '#3a2410'; X.fillRect(0, TABLE_Y + 8, CW, 3);      // shadow under the lip
    X.fillStyle = '#8a6a3a'; for (let gx = 0; gx < CW; gx += 40) X.fillRect(gx, TABLE_Y, 2, CH - TABLE_Y);  // plank seams

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

      // resting shadow on the table
      X.save(); X.globalAlpha = 0.4; X.fillStyle = '#1a1008';
      X.beginPath(); X.ellipse(cx, cy + 22, 22, 6, 0, 0, Math.PI * 2); X.fill(); X.restore();

      if (sel) {   // selection: warm ring + lift
        X.strokeStyle = '#f0d9a8'; X.lineWidth = 2;
        X.strokeRect(cx - slotW / 2 + 4, cy - 30, slotW - 8, 58);
      }
      drawWareArt(X, w.id, cx, cy - (sel ? 8 : 0), 46, now);

      X.textAlign = 'center'; X.font = '9px monospace';
      if (owned)       { X.fillStyle = '#9fd98a'; X.fillText('OWNED', cx, cy + 30); }
      else if (priced) { X.fillStyle = afford ? '#e8c878' : '#a05a4a';
                         X.fillText(`$${priced.price}`, cx, cy + 30); }
    });

    X.textAlign = 'left';

    // ── The shopkeeper speaks through the real dialogue window ──
    this._speak(WARES[this._sel]);
  }
}
