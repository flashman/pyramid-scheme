// ── FILE: worlds/transitions.js ─────────────────────────
// Canvas overlay renderers passed to RealmManager.scheduleTransition().
// Centralised here so WorldRealm and OasisRealm don't each define their own.
//
// Each renderer is (progress: 0..1) => void.
// progress is computed by RealmManager from elapsed / duration.

import { X, CW, CH } from '../engine/canvas.js';
import { COL }        from '../engine/colors.js';
import { G }          from '../game/state.js';
import { GND }        from './earth/constants.js';
import { LH }         from './constants.js';

// ── Oasis entry ───────────────────────────────────────────
// Warm golden haze — bleaches the screen as you step east into the oasis.

export function oasisTransRender(progress) {
  const p = Math.min(1, progress * 1.4);
  // Heat ripple bands
  const numBands = 8;
  for (let i = 0; i < numBands; i++) {
    const bandY = (((i / numBands) + progress * 0.7) % 1) * CH;
    const bandA = (1 - Math.abs(i / numBands - 0.5) * 2) * 0.18 * p;
    X.save();
    X.globalAlpha = bandA;
    X.fillStyle = '#e8c060';
    X.fillRect(0, bandY, CW, 18);
    X.restore();
  }
  // Golden fade-to-white
  X.save();
  X.globalAlpha = Math.min(1, p * p * 1.1);
  const hg = X.createLinearGradient(0, 0, 0, CH);
  hg.addColorStop(0,   '#d08020');
  hg.addColorStop(0.5, '#f0d090');
  hg.addColorStop(1,   '#d08020');
  X.fillStyle = hg;
  X.fillRect(0, 0, CW, CH);
  X.restore();
}

// ── Capstone launch ───────────────────────────────────────
// Expanding gold rings → star-streak warp → white flash.
// Used when ascending from capstone to the Galactic Council.

export function launchTransRender(progress) {
  const pp      = G.pyramids.find(p => p.isPlayer);
  const cx      = pp ? Math.round(pp.wx - G.camX) : CW / 2;
  const cy      = pp ? Math.round(GND - pp.layers * LH - G.camY) : CH / 2;
  const elapsed = progress * 2600;

  if (elapsed < 1000) {
    const pct = elapsed / 1000;
    for (let r = 0; r < 7; r++) {
      const rp = ((r / 7) + pct * 1.8) % 1;
      X.save(); X.globalAlpha = (1 - rp) * 0.55;
      X.strokeStyle = r % 2 === 0 ? COL.GOLD : COL.GOLD_BRIGHT;
      X.lineWidth = 2;
      X.beginPath(); X.arc(cx, cy, rp * 360 + 8, 0, Math.PI * 2); X.stroke();
      X.restore();
    }
    X.save(); X.globalAlpha = 0.25 + 0.2 * pct;
    const cg = X.createRadialGradient(cx, cy, 0, cx, cy, 70);
    cg.addColorStop(0, COL.GOLD_BRIGHT); cg.addColorStop(1, 'transparent');
    X.fillStyle = cg; X.fillRect(cx - 70, cy - 70, 140, 140); X.restore();
  } else if (elapsed < 2200) {
    const pct = (elapsed - 1000) / 1200;
    X.save(); X.globalAlpha = Math.min(1, pct * 1.4);
    X.fillStyle = '#000000'; X.fillRect(0, 0, CW, CH); X.restore();
    for (let line = 0; line < 24; line++) {
      const angle  = (line / 24) * Math.PI * 2;
      const startR = 6 + pct * 40;
      const len    = 60 + pct * 500;
      X.save();
      X.globalAlpha = (0.7 - pct * 0.3) * (line % 3 === 0 ? 1.0 : 0.45);
      X.strokeStyle = line % 4 === 0 ? COL.GOLD_BRIGHT : line % 4 === 1 ? '#aa44ff' : '#ffffff';
      X.lineWidth   = line % 5 === 0 ? 2 : 1;
      X.beginPath();
      X.moveTo(cx + Math.cos(angle) * startR,        cy + Math.sin(angle) * startR);
      X.lineTo(cx + Math.cos(angle) * (startR + len), cy + Math.sin(angle) * (startR + len));
      X.stroke(); X.restore();
    }
    if (pct > 0.4) {
      X.save(); X.globalAlpha = (pct - 0.4) * 0.8;
      X.fillStyle = '#ffffff';
      for (let s = 0; s < 30; s++) {
        const a = (s / 30) * Math.PI * 2;
        const d = 80 + ((s * 37) % 200);
        X.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 2, 2);
      }
      X.restore();
    }
  } else {
    const pct = Math.min(1, (elapsed - 2200) / 400);
    X.save(); X.globalAlpha = pct;
    X.fillStyle = '#ffffff'; X.fillRect(0, 0, CW, CH); X.restore();
  }
}

// ── Atlantis dive / surface ───────────────────────────────
// Ripple rings from centre, then deep-blue wash.
// Used both on dive-in and on surfacing (reversed feel is fine — water either way).

export function atlantisTransRender(progress) {
  const p = Math.min(1, progress);
  const cx = CW / 2;
  const cy = CH / 2;

  // Expanding concentric water rings
  if (p < 0.5) {
    const rp = p / 0.5;
    for (let r = 0; r < 5; r++) {
      const rr = ((r / 5) + rp * 1.2) % 1;
      X.save();
      X.globalAlpha = (1 - rr) * 0.45;
      X.strokeStyle = '#44bbdd';
      X.lineWidth   = 2;
      X.beginPath();
      X.arc(cx, cy, rr * Math.max(CW, CH) * 0.9 + 8, 0, Math.PI * 2);
      X.stroke();
      X.restore();
    }
    // Blue tint washing in
    X.save();
    X.globalAlpha = rp * 0.5;
    X.fillStyle   = '#001428';
    X.fillRect(0, 0, CW, CH);
    X.restore();
  } else {
    // Full deep-water fade
    const fp = (p - 0.5) * 2;
    X.save();
    X.globalAlpha = Math.min(1, fp * 1.15);
    const dg = X.createLinearGradient(0, 0, 0, CH);
    dg.addColorStop(0, '#002040');
    dg.addColorStop(1, '#000810');
    X.fillStyle = dg;
    X.fillRect(0, 0, CW, CH);
    X.restore();
  }
}

// ── Vault descent ─────────────────────────────────────────
// Gold blaze in (warmth of the oasis above), then darkness
// (the sealed chamber swallows all light).

export function vaultTransRender(progress) {
  const p = Math.min(1, progress);
  if (p < 0.5) {
    // Golden flare in
    X.save();
    X.globalAlpha = p * 2;
    const cg = X.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.7);
    cg.addColorStop(0.0, '#ffffff');
    cg.addColorStop(0.3, '#f8e870');
    cg.addColorStop(0.7, '#c06010');
    cg.addColorStop(1.0, '#060200');
    X.fillStyle = cg;
    X.fillRect(0, 0, CW, CH);
    X.restore();
  } else {
    // Fade into dark
    X.save();
    X.globalAlpha = (p - 0.5) * 2;
    X.fillStyle = '#060100';
    X.fillRect(0, 0, CW, CH);
    X.restore();
  }
}

// ── Descent into The Deep ─────────────────────────────────
// Crushing darkness. Purple crack-light, then absolute void.
// Used when descending through the Atlantis vault floor.

export function deepTransRender(progress) {
  const p = Math.min(1, progress);

  if (p < 0.35) {
    // Crack-light flare — purple bleed from below
    const rp = p / 0.35;
    const cx = CW / 2;
    const cy = CH;
    X.save();
    X.globalAlpha = rp * 0.7;
    const cg = X.createRadialGradient(cx, cy, 0, cx, cy, CH * 1.1);
    cg.addColorStop(0, '#440066');
    cg.addColorStop(0.3, '#220033');
    cg.addColorStop(1, 'transparent');
    X.fillStyle = cg;
    X.fillRect(0, 0, CW, CH);
    X.restore();

    // Crack line spreading across bottom
    X.save();
    X.globalAlpha = rp * 0.9;
    X.strokeStyle = '#cc00ff';
    X.lineWidth = 3;
    X.shadowColor = '#cc00ff';
    X.shadowBlur  = 16;
    X.beginPath();
    const spread = rp * CW * 0.7;
    X.moveTo(cx - spread, CH - 8);
    X.lineTo(cx - spread * 0.5, CH - 4);
    X.lineTo(cx + spread * 0.3, CH - 9);
    X.lineTo(cx + spread, CH - 5);
    X.stroke();
    X.restore();
  } else {
    // Full void collapse — crack light eaten by absolute dark
    const fp = (p - 0.35) / 0.65;
    X.save();
    X.globalAlpha = Math.min(1, fp * 1.2);
    X.fillStyle = '#000000';
    X.fillRect(0, 0, CW, CH);
    X.restore();

    // Last glimmer of purple, then nothing
    if (fp < 0.5) {
      X.save();
      X.globalAlpha = (0.5 - fp) * 0.4;
      X.fillStyle = '#220033';
      X.fillRect(0, 0, CW, CH);
      X.restore();
    }
  }
}
