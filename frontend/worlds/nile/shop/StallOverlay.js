// ── FILE: worlds/nile/shop/StallOverlay.js ───────────────
// First-person stall: a canvas sub-mode owned by NileRealm. Not a realm.
// Renders the merchant's tent interior (reusing the bazaar art), the wares as
// custom icons, and the merchant speaking each ware's description.

import { X, CW, CH }        from '../../../engine/canvas.js';
import { G }                from '../../../game/state.js';
import { Api }              from '../../../game/api.js';
import { loadConfig, getShop, shopLoaded } from '../../../game/config.js';
import { WARES }            from './catalogue.js';
import { purchase, isOwned } from './buy.js';
import { drawWareArt }      from './ware-art.js';
import { drawMerchant, drawMerchantTent } from '../draw/nile.js';

const COLS = 6;
const SLOT = 78, GAP = 6;

/** The merchant's spoken line for a ware — its blurb, with an owned aside. */
function owned_aside(w) {
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
    const now  = performance.now();

    // ── Darken the frozen Nile behind the tent ──
    X.fillStyle = 'rgba(10,8,5,0.94)'; X.fillRect(0, 0, CW, CH);

    // ── The tent interior + the shopkeeper (reused bazaar art) ──
    const baseY = CH - 150;                         // interior floor line
    drawMerchantTent(CW / 2, baseY, now);
    // Translating by (center - G.px) renders the merchant at screen-center AND
    // makes his look = (G.px - G.px)/140 = 0, so he faces the player.
    X.save();
    X.translate(CW / 2 - G.px, 0);
    drawMerchant(G.px, baseY - 2, now);
    X.restore();

    // ── Title ──
    X.textAlign = 'center'; X.fillStyle = '#e6c179'; X.font = 'bold 16px monospace';
    X.fillText('✦ BAZAAR OF BELIEVERS ✦', CW / 2, 26);

    if (this._loading) {
      X.fillStyle = '#cbb288'; X.font = '14px monospace';
      X.fillText('the merchant unrolls his catalogue…', CW / 2, CH / 2);
      X.textAlign = 'left'; return;
    }

    // ── Ware slots (icons on shelves; the merchant shows behind/below) ──
    const gridW = COLS * SLOT + (COLS - 1) * GAP;
    const gx0 = (CW - gridW) / 2, gy0 = 44;
    WARES.forEach((w, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = gx0 + col * (SLOT + GAP), y = gy0 + row * (SLOT + GAP);
      const cx = x + SLOT / 2, cy = y + SLOT / 2;
      const priced = shop[w.id];
      const owned  = isOwned(w.id);
      const afford = priced && (G.earned || 0) >= priced.price;
      const sel    = i === this._sel;

      X.fillStyle = owned ? '#1c2614' : '#241c12';
      X.fillRect(x, y, SLOT, SLOT);
      X.lineWidth = sel ? 3 : 1; X.strokeStyle = sel ? '#f0d9a8' : '#4a3a22';
      X.strokeRect(x + 0.5, y + 0.5, SLOT - 1, SLOT - 1);

      drawWareArt(X, w.id, cx, cy - (sel ? 6 : 2), SLOT * 0.74, now);

      X.textAlign = 'center'; X.font = '9px monospace';
      if (owned)       { X.fillStyle = '#9fd98a'; X.fillText('OWNED', cx, y + SLOT - 6); }
      else if (priced) { X.fillStyle = afford ? '#caa05a' : '#a05a4a';
                         X.fillText(`$${priced.price}`, cx, y + SLOT - 6); }
    });

    // ── The shopkeeper speaks: dialogue-styled bar (mirrors #dlg) ──
    const w = WARES[this._sel];
    const barY = CH - 92, barH = 84, pad = 14;
    X.fillStyle = 'rgba(14,10,6,0.96)'; X.fillRect(0, barY, CW, barH);
    X.fillStyle = '#caa040'; X.fillRect(0, barY, CW, 2);
    X.textAlign = 'left'; X.fillStyle = '#e6c179'; X.font = 'bold 11px monospace';
    X.fillText('THE MERCHANT  ✦  BAZAAR OF BELIEVERS', pad, barY + 18);
    if (w) {
      X.fillStyle = '#e8dcc0'; X.font = '12px monospace';
      owned_aside(w).split('\n').forEach((ln, k) => X.fillText(ln, pad, barY + 38 + k * 15));
    }
    X.fillStyle = '#7a6a4a'; X.font = '9px monospace'; X.textAlign = 'right';
    X.fillText('← → ↑ ↓  ·  SPACE BUY  ·  ESC LEAVE', CW - pad, barY + barH - 8);
    X.textAlign = 'left';
  }
}
