// ── FILE: worlds/nile/shop/StallOverlay.js ───────────────
// First-person stall: a canvas sub-mode owned by NileRealm. Not a realm.
// Draws the merchant's table from the player's POV; spends `earned`.

import { X, CW, CH }        from '../../../engine/canvas.js';
import { G }                from '../../../game/state.js';
import { Api }              from '../../../game/api.js';
import { loadConfig, getShop, shopLoaded } from '../../../game/config.js';
import { WARES }            from './catalogue.js';
import { purchase, isOwned } from './buy.js';

const COLS = 5;
const CARD_W = 132, CARD_H = 96, GAP = 10;
const GRID_X = (CW - (COLS * CARD_W + (COLS - 1) * GAP)) / 2;
const GRID_Y = 190;

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

  close() { this._open = false; }

  onKeyDown(key) {
    if (!this._open) return false;
    if (key === 'Escape' || key === 'q' || key === 'Q') { this.close(); return true; }
    const n = WARES.length;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { this._sel = (this._sel + 1) % n; return true; }
    if (key === 'ArrowLeft'  || key === 'a' || key === 'A') { this._sel = (this._sel - 1 + n) % n; return true; }
    if (key === 'ArrowDown'  || key === 's' || key === 'S') { this._sel = Math.min(n - 1, this._sel + COLS); return true; }
    if (key === 'ArrowUp'    || key === 'w' || key === 'W') { this._sel = Math.max(0, this._sel - COLS); return true; }
    if (key === ' ' || key === 'Enter' || key === 'z' || key === 'Z') {
      const ware = WARES[this._sel];
      if (ware) purchase(ware.id);   // fire-and-forget; render re-reads state
      return true;
    }
    return true;   // swallow all keys while open
  }

  render() {
    if (!this._open) return;
    const shop = getShop();

    // ── Backdrop: darken the frozen Nile scene ──
    X.fillStyle = 'rgba(12,9,6,0.92)';
    X.fillRect(0, 0, CW, CH);

    // ── First-person framing: tent eave + merchant bust + table edge ──
    X.fillStyle = '#3a2c18'; X.fillRect(0, 0, CW, 150);                 // tent interior
    X.fillStyle = '#6b4a2a'; X.beginPath();                            // tent eave arc
    X.moveTo(CW / 2 - 130, 96); X.quadraticCurveTo(CW / 2, 18, CW / 2 + 130, 96); X.fill();
    // merchant bust
    X.fillStyle = '#caa05a'; X.fillRect(CW / 2 - 16, 70, 32, 44);       // robe
    X.fillStyle = '#e8c28a'; X.beginPath(); X.arc(CW / 2, 62, 14, 0, Math.PI * 2); X.fill();  // head
    // table edge across the foreground
    X.fillStyle = '#7a5a32'; X.fillRect(0, CH - 70, CW, 70);
    X.fillStyle = '#a07a44'; X.fillRect(0, CH - 74, CW, 5);

    // ── Header + balance ──
    X.textAlign = 'center'; X.fillStyle = '#e6c179'; X.font = 'bold 18px monospace';
    X.fillText('✦ BAZAAR OF BELIEVERS ✦', CW / 2, 34);
    X.textAlign = 'right'; X.fillStyle = '#9fd98a'; X.font = '14px monospace';
    X.fillText(`BALANCE  $${(G.earned || 0).toFixed(2)}`, CW - 16, 34);

    if (this._loading) {
      X.textAlign = 'center'; X.fillStyle = '#cbb288'; X.font = '14px monospace';
      X.fillText('the merchant unrolls his catalogue…', CW / 2, GRID_Y + 60);
      return;
    }

    // ── Ware grid ──
    WARES.forEach((w, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = GRID_X + col * (CARD_W + GAP);
      const y = GRID_Y + row * (CARD_H + GAP);
      const priced = shop[w.id];
      const owned  = isOwned(w.id) && priced?.kind === 'keepsake';
      const afford = priced && (G.earned || 0) >= priced.price;
      const isSel  = i === this._sel;

      X.fillStyle = owned ? '#1a2414' : '#241c12';
      X.fillRect(x, y, CARD_W, CARD_H);
      X.lineWidth = isSel ? 3 : 1;
      X.strokeStyle = isSel ? '#f0d9a8' : '#4a3a22';
      X.strokeRect(x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1);

      X.textAlign = 'center'; X.font = '26px monospace'; X.fillStyle = '#fff';
      X.fillText(w.glyph, x + CARD_W / 2, y + 36);
      X.font = '10px monospace'; X.fillStyle = '#cbb288';
      X.fillText(w.name.slice(0, 20), x + CARD_W / 2, y + 58);

      if (owned)           { X.fillStyle = '#9fd98a'; X.fillText('OWNED',        x + CARD_W / 2, y + 80); }
      else if (priced)     { X.fillStyle = afford ? '#caa05a' : '#a05a4a';
                             X.fillText(`$${priced.price}`,                     x + CARD_W / 2, y + 80); }
    });

    // ── Detail line for the selected ware ──
    const w = WARES[this._sel];
    const priced = shop[w?.id];
    if (w && priced) {
      X.textAlign = 'center'; X.fillStyle = '#e6c179'; X.font = 'bold 13px monospace';
      X.fillText(`${w.name}  —  $${priced.price}`, CW / 2, CH - 46);
      X.fillStyle = '#cbb288'; X.font = '11px monospace';
      w.blurb.split('\n').forEach((line, k) => X.fillText(line, CW / 2, CH - 30 + k * 13));
    }

    // ── Controls hint ──
    X.textAlign = 'center'; X.fillStyle = '#7a6a4a'; X.font = '10px monospace';
    X.fillText('← → ↑ ↓ MOVE      SPACE / ENTER BUY      ESC LEAVE', CW / 2, 168);

    X.textAlign = 'left';   // restore default
  }
}
