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
import { WARES, GENERIC_RETORTS, WARE_RETORTS } from './catalogue.js';
import { purchase, isOwned } from './buy.js';
import { drawWareArt }      from './ware-art.js';
import { drawMerchant, drawMerchantTent, drawBalanceScale } from '../draw/nile.js';

const SCALE   = 2.7;     // merchant + tent magnification ("life size" in frame)
const FEET_Y  = 345;     // merchant feet (just behind the table top → legs hidden)
const TABLE_Y = 318;     // table surface line
const PER_ROW = 9;       // wares per row laid on the table (2 rows for 17)
const TYPE_MS = 26;      // ms per character of the merchant's spoken pitch
const WELCOME = 'STEP IN, FUTURE PHARAOH. MIND THE POTS.\nEVERYTHING ON THE TABLE IS FOR SALE.\nTHE LOOKING IS FREE. THE WANTING, ALSO.';

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
    this._welcomed = false;  // show the welcome first; first interaction hands off to item pitches
    this._retort = '';       // a snarky line shown briefly after a successful buy
    this._retortUntil = 0;
  }

  isOpen() { return this._open; }

  async open() {
    this._open = true;
    this._sel  = 0;
    this._typeFull = '';
    this._welcomed = false;
    this._retortUntil = 0;
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
    this._welcomed = true;     // first interaction hands off from the welcome to item pitches
    const n = WARES.length;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { this._sel = (this._sel + 1) % n; return true; }
    if (key === 'ArrowLeft'  || key === 'a' || key === 'A') { this._sel = (this._sel - 1 + n) % n; return true; }
    if (key === 'ArrowDown'  || key === 's' || key === 'S') { this._sel = Math.min(n - 1, this._sel + PER_ROW); return true; }
    if (key === 'ArrowUp'    || key === 'w' || key === 'W') { this._sel = Math.max(0, this._sel - PER_ROW); return true; }
    if (key === ' ' || key === 'Enter' || key === 'z' || key === 'Z') {
      const ware = WARES[this._sel];
      if (ware) purchase(ware.id).then(r => { if (r && r.ok) this._fireRetort(ware.id); });
      return true;
    }
    return true;   // swallow all keys while open
  }

  /** Speak a line through the real #dlg window — typed out (the merchant "speaks").
      Used for both the entry welcome and per-ware pitches. */
  _say(speaker, full) {
    const dlg = document.getElementById('dlg');
    if (!dlg) return;
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    if (full !== this._typeFull) { this._typeFull = full; this._typeStart = performance.now(); }
    const shown = full.slice(0, Math.floor((performance.now() - this._typeStart) / TYPE_MS));
    set('dlg-speaker', speaker);
    set('dlg-text', shown);
    const ch = document.getElementById('dlg-choices'); if (ch) ch.innerHTML = '';
    set('dlg-hint', '← → ↑ ↓ MOVE    SPACE BUY    ESC LEAVE');
    dlg.classList.add('active');     // re-asserted each frame (DialogueManager clears it when idle)
  }

  /** Begin a snarky retort (item-specific if defined, else a random generic). */
  _fireRetort(id) {
    const pool = GENERIC_RETORTS;
    this._retort = WARE_RETORTS[id] || pool[Math.floor(Math.random() * pool.length)];
    this._retortUntil = performance.now() + 3600;
  }

  /** What the merchant is currently saying: a buy retort if one is active, else
      the welcome until the player browses, then the selected ware's pitch. */
  _speakCurrent() {
    if (performance.now() < this._retortUntil) return this._say('THE MERCHANT  ✦  JUST POTS', this._retort);
    if (!this._welcomed) return this._say('THE MERCHANT  ✦  JUST POTS', WELCOME);
    const w = WARES[this._sel];
    this._say(w ? `THE MERCHANT  ✦  ${w.name.toUpperCase()}` : 'THE MERCHANT  ✦  JUST POTS', pitchFor(w));
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
    vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(8,5,2,0.5)');
    X.fillStyle = vg; X.fillRect(0, 0, CW, CH);
  }

  // ── A hookah on the table corner: glass base, gold stem, glowing bowl, hose, smoke ──
  _drawHookah(x, baseY, t) {
    X.fillStyle = '#3a6a8a'; X.beginPath(); X.ellipse(x, baseY - 11, 13, 15, 0, 0, Math.PI * 2); X.fill();   // glass base
    X.fillStyle = '#5a9ac8'; X.beginPath(); X.ellipse(x - 4, baseY - 16, 4, 6, 0, 0, Math.PI * 2); X.fill(); // highlight
    X.fillStyle = '#244a64'; X.fillRect(x - 13, baseY - 7, 26, 4);                                            // liquid line
    X.fillStyle = '#caa040'; X.fillRect(x - 2, baseY - 50, 4, 39);                                            // stem
    X.fillStyle = '#9a7c3a'; X.fillRect(x - 5, baseY - 32, 10, 4);                                            // joint
    X.fillStyle = '#8a5a3a'; X.beginPath(); X.moveTo(x - 8, baseY - 50); X.lineTo(x + 8, baseY - 50); X.lineTo(x + 4, baseY - 58); X.lineTo(x - 4, baseY - 58); X.closePath(); X.fill();  // clay bowl
    X.save(); X.globalAlpha = 0.5 + 0.35 * Math.sin(t / 300); X.fillStyle = '#e8602a'; X.fillRect(x - 3, baseY - 60, 6, 3); X.restore();  // coal glow
    X.strokeStyle = '#7a3a30'; X.lineWidth = 3; X.beginPath(); X.moveTo(x + 3, baseY - 30); X.quadraticCurveTo(x + 30, baseY - 18, x + 24, baseY + 4); X.stroke();  // hose
    X.fillStyle = '#caa040'; X.fillRect(x + 22, baseY + 2, 5, 7);                                             // mouthpiece
    X.save(); X.globalAlpha = 0.15; X.strokeStyle = '#d8d0c0'; X.lineWidth = 2;                               // smoke
    X.beginPath(); X.moveTo(x, baseY - 60); for (let yy = baseY - 60; yy > baseY - 128; yy -= 10) X.lineTo(x + Math.sin(yy / 16 + t / 600) * 7, yy); X.stroke(); X.restore();
  }

  // ── A plain clay pot — the only honest merchandise; used here as furniture ──
  _drawPot(x, baseY, w, h) {
    X.fillStyle = '#8a5836'; X.beginPath();
    X.moveTo(x - w * 0.45, baseY - h);
    X.bezierCurveTo(x - w, baseY - h * 0.55, x - w, baseY - h * 0.1, x, baseY);
    X.bezierCurveTo(x + w, baseY - h * 0.1, x + w, baseY - h * 0.55, x + w * 0.45, baseY - h);
    X.closePath(); X.fill();
    X.fillStyle = '#a06a3e'; X.fillRect(x - w * 0.5, baseY - h - 2, w, 3);           // rim
    X.fillStyle = '#a8744c'; X.fillRect(x - w * 0.4, baseY - h * 0.7, 3, h * 0.5);   // lit side
    X.fillStyle = '#5a3620'; X.fillRect(x + w * 0.3, baseY - h * 0.7, 3, h * 0.5);   // shade
  }

  /** A short stack of plain pots, used as a pedestal for the merchant's dressing. */
  _drawPotStack(x, baseY) {
    this._drawPot(x - 9, baseY, 11, 17);
    this._drawPot(x + 8, baseY + 1, 10, 15);
    this._drawPot(x, baseY - 15, 12, 18);
  }

  // ── Weird stock hung on the tent wall, flanking the merchant ──
  _drawWallHangings(now) {
    const peg = (x, topY) => { X.fillStyle = '#caa040'; X.fillRect(x - 2, topY - 2, 4, 3);
      X.strokeStyle = '#2a1810'; X.lineWidth = 1; X.beginPath(); X.moveTo(x, topY); X.lineTo(x, topY + 12); X.stroke(); };

    // LEFT, upper — a jackal mask (it is watching too)
    peg(286, 150); const mx = 286, my = 174;
    X.fillStyle = '#1a1a20'; X.fillRect(mx - 12, my - 10, 5, 11); X.fillRect(mx + 7, my - 10, 5, 11);   // ears
    X.fillStyle = '#2a2a30'; X.beginPath(); X.moveTo(mx - 11, my - 4); X.lineTo(mx + 11, my - 4); X.lineTo(mx + 7, my + 22); X.lineTo(mx - 7, my + 22); X.closePath(); X.fill();
    X.fillStyle = '#caa040'; X.fillRect(mx - 6, my + 6, 3, 2); X.fillRect(mx + 3, my + 6, 3, 2);          // eyes

    // LEFT, lower — a bundle of dried reeds
    peg(304, 236);
    X.strokeStyle = '#7a6a3a'; X.lineWidth = 2;
    for (let i = -3; i <= 3; i++) { X.beginPath(); X.moveTo(304, 248); X.lineTo(304 + i * 3, 248 + 24); X.stroke(); }
    X.fillStyle = '#9a7a3a'; X.fillRect(304 - 6, 248, 12, 4);

    // RIGHT, upper — a string of eyes that follow you
    peg(494, 150);
    for (let i = 0; i < 4; i++) { const ey = 168 + i * 15;
      X.fillStyle = '#e8e2d0'; X.beginPath(); X.ellipse(494, ey, 6, 4, 0, 0, Math.PI * 2); X.fill();
      X.fillStyle = '#1a2a3a'; X.beginPath(); X.arc(494 + Math.sin(now / 1300 + i) * 2, ey, 2, 0, Math.PI * 2); X.fill(); }

    // RIGHT, lower — an hourglass (time is, allegedly, money)
    peg(512, 236); const hx = 512, hy = 252;
    X.fillStyle = '#8a6a3a'; X.fillRect(hx - 9, hy, 18, 3); X.fillRect(hx - 9, hy + 25, 18, 3);
    X.fillStyle = '#bfa86a';
    X.beginPath(); X.moveTo(hx - 8, hy + 3); X.lineTo(hx + 8, hy + 3); X.lineTo(hx, hy + 15); X.closePath(); X.fill();
    X.beginPath(); X.moveTo(hx - 8, hy + 25); X.lineTo(hx + 8, hy + 25); X.lineTo(hx, hy + 15); X.closePath(); X.fill();
    X.fillStyle = '#e8d8a0'; X.fillRect(hx - 1, hy + 13, 2, 12);
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
      X.textAlign = 'left'; this._say('THE MERCHANT  ✦  JUST POTS', WELCOME); return;
    }

    // ── Weird stock hung on the tent wall, flanking the merchant ──
    this._drawWallHangings(now);

    // ── Trade dressing on stacks of (actual) pots, spread out past the tent
    //    footprint into the side voids. Drawn before the table so their bases
    //    tuck behind it, like his legs. ──
    this._drawPotStack(150, 340); this._drawHookah(150, 310, now);       // hookah, far left
    this._drawPotStack(630, 336);                                        // scale, far right
    X.save(); X.translate(630, 306); X.scale(1.5, 1.5); drawBalanceScale(0, 0, now); X.restore();

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
    this._speakCurrent();
  }
}
