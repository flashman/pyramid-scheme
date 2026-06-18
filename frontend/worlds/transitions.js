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

// Stable per-element pseudo-random + a reusable wind-blown sand veil, shared by
// the desert↔city transitions so they feel like one storm in one world.
const _tRnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function _sandVeil(p, amount) {
  if (amount <= 0) return;
  const rnd = _tRnd;
  X.save();                                                // haze sheet
  X.globalAlpha = amount * 0.55;
  const haze = X.createLinearGradient(0, 0, 0, CH);
  haze.addColorStop(0,   'rgba(216,184,120,0.25)');
  haze.addColorStop(0.6, 'rgba(200,158,98,0.55)');
  haze.addColorStop(1,   'rgba(168,118,68,0.72)');
  X.fillStyle = haze; X.fillRect(0, 0, CW, CH);
  X.restore();
  X.save();                                                // drifting wind streaks
  X.strokeStyle = '#e7c98e'; X.lineWidth = 1;
  for (let i = 0; i < 22; i++) {
    const sy  = rnd(i * 9) * CH;
    const len = 60 + rnd(i * 3) * 170;
    const sx  = ((rnd(i * 2.2) + p * 1.7) % 1.35) * CW - 110;
    X.globalAlpha = amount * (0.12 + rnd(i) * 0.26);
    X.beginPath(); X.moveTo(sx, sy); X.lineTo(sx + len, sy + (rnd(i * 5) - 0.5) * 9); X.stroke();
  }
  X.restore();
  X.save();                                                // individual grains
  for (let i = 0; i < 80; i++) {
    const gx = ((rnd(i * 1.7) + p * (0.8 + rnd(i) * 1.5)) % 1.25) * CW - 70;
    const gy = ((rnd(i * 3.3) + Math.sin(p * 5 + i) * 0.03) % 1) * CH;
    const gr = 0.6 + rnd(i * 2) * 1.7;
    X.globalAlpha = amount * (0.2 + rnd(i * 4) * 0.5);
    X.fillStyle = i % 4 === 0 ? '#fff0d0' : '#d8b878';
    X.fillRect(gx, gy, gr, gr);
  }
  X.restore();
}

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

// ── Desert → City (the bazaar) entry ──────────────────────
// You come out of the empty desert into the city. Wind-blown sand kicks up and
// veils the screen; through it a mud-brick skyline rises from below — flat
// roofs, domes, a minaret, a glowing arched gate — and the bazaar's lanterns
// bloom on, one by one, settling into the warm dusk you arrive into. Drawn
// over the live desert, so it ends opaque (the realm swaps only at progress 1).
//   (nileTransRender, the water flood below, is kept for reaching the river.)

export function cityTransRender(progress) {
  const p      = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const c01    = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (t) => t * t * (3 - 2 * t);
  // stable per-element pseudo-random (same hash family used elsewhere)
  const rnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  // ── timeline ──────────────────────────────────────────
  // The scene fully assembles by ~0.82, then HOLDS so the finished city can be
  // read for a beat before the realm swaps in at progress 1 (no rushed cut).
  const cover = c01(p / 0.36);                       // backdrop establishes, hiding the desert
  const riseE = smooth(c01((p - 0.16) / 0.54));      // skyline rises into place (~0.70)
  const lamps = c01((p - 0.42) / 0.34);              // lanterns bloom on (~0.76)
  const dust  = Math.sin(c01(p / 0.82) * Math.PI);   // sand rises, then fully clears by ~0.82

  const horizon = CH * 0.58;
  const groundY = CH * 0.82;
  const slide   = (1 - riseE) * 96;                  // city slides up from below

  // soft radial glow (lanterns / sun) — used sparingly (the prominent lights)
  const glow = (gx, gy, r, a, core = '#ffe6b0') => {
    X.save();
    const g = X.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0,   `rgba(255,210,120,${a})`);
    g.addColorStop(0.5, `rgba(240,150,55,${a * 0.45})`);
    g.addColorStop(1,   'transparent');
    X.fillStyle = g; X.fillRect(gx - r, gy - r, r * 2, r * 2);
    X.fillStyle = core; X.globalAlpha = a; X.fillRect(gx - 1.5, gy - 1.5, 3, 3);
    X.restore();
  };

  // ── 1. Dusk sky ───────────────────────────────────────
  X.save();
  X.globalAlpha = cover;
  const sky = X.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0.00, '#241a48');   // indigo zenith
  sky.addColorStop(0.45, '#5a3a58');   // violet
  sky.addColorStop(0.68, '#9c4a2e');   // burnt-orange horizon
  sky.addColorStop(1.00, '#d18a44');   // warm ground glow
  X.fillStyle = sky; X.fillRect(0, 0, CW, CH);
  X.restore();

  // ── 2. Setting sun + halo (behind the skyline; gets occluded by it) ──
  const sunX = CW * 0.66, sunY = horizon - 4;
  X.save();
  X.globalAlpha = cover;
  const halo = X.createRadialGradient(sunX, sunY, 0, sunX, sunY, 128);
  halo.addColorStop(0.0,  'rgba(255,228,150,0.82)');
  halo.addColorStop(0.4,  'rgba(246,160,70,0.4)');
  halo.addColorStop(1.0,  'transparent');
  X.fillStyle = halo; X.fillRect(sunX - 138, sunY - 138, 276, 276);
  X.globalAlpha = cover * 0.85; X.fillStyle = '#ffd277';
  X.beginPath(); X.arc(sunX, sunY, 22, 0, Math.PI * 2); X.fill();
  X.restore();

  // ── 3. Birds drifting across the dusk ─────────────────
  X.save();
  X.globalAlpha = cover * 0.5; X.strokeStyle = '#1c1430'; X.lineWidth = 1;
  for (let b = 0; b < 5; b++) {
    const bx = ((rnd(b * 7) + p * 0.45) % 1) * CW;
    const by = CH * (0.16 + rnd(b * 5) * 0.16) + Math.sin(p * 6 + b) * 2;
    const ws = 4 + rnd(b) * 3;
    X.beginPath(); X.moveTo(bx - ws, by); X.lineTo(bx, by - ws * 0.5); X.lineTo(bx + ws, by); X.stroke();
  }
  X.restore();

  // ── 4. Far skyline — opaque silhouette so it OCCLUDES the sun (the sun is
  // behind it). A lighter, hazier violet than the near city = distance cue. ──
  X.save();
  X.globalAlpha = cover; X.fillStyle = '#473a52';
  const farY = horizon + (1 - riseE) * 22;
  for (let fx = 0, fi = 0; fx < CW; fi++) {
    const fw = 20 + rnd(fi * 2.3) * 26;
    const fh = 16 + rnd(fi * 1.7 + 9) * 30;
    X.fillRect(fx, farY - fh, fw + 1, fh + (CH - farY));
    if (rnd(fi * 4) > 0.82) { X.beginPath(); X.arc(fx + fw / 2, farY - fh, fw / 2, Math.PI, 0); X.fill(); }
    fx += fw;
  }
  X.restore();

  // ── 5. Dark street/ground band the city stands on ─────
  X.save();
  X.globalAlpha = cover; X.fillStyle = '#241820';
  X.fillRect(0, groundY + slide - 2, CW, CH);
  X.restore();

  // ── 6. Main skyline (mud-brick city, rising from below) ──
  X.save();
  X.globalAlpha = cover;
  for (let x = -12, i = 0; x < CW + 12; i++) {
    const bw   = 44 + rnd(i * 1.3) * 54;
    const bh   = 70 + rnd(i * 2.1 + 3) * 120;
    const topY = groundY - bh + slide;
    const isGate  = i > 1 && Math.abs((x + bw / 2) - CW * 0.5) < bw * 0.55;
    const isTower = !isGate && rnd(i * 6 + 2) > 0.85;
    const hasDome = !isGate && !isTower && rnd(i * 3 + 7) > 0.72;

    // body: dark mass + a warm sunset wash on the sun-facing (right) side
    X.fillStyle = '#241a30';
    X.fillRect(x, topY, bw, bh + slide + 6);
    const lit = X.createLinearGradient(x, 0, x + bw, 0);
    lit.addColorStop(0, 'rgba(140,80,44,0)');
    lit.addColorStop(1, 'rgba(160,96,48,0.8)');
    X.fillStyle = lit; X.fillRect(x, topY, bw, bh + slide + 6);
    // parapet roof lip with a sunlit top edge
    X.fillStyle = '#2e2236'; X.fillRect(x - 2, topY, bw + 4, 5);
    X.fillStyle = 'rgba(170,100,52,0.6)'; X.fillRect(x - 2, topY, bw + 4, 1);

    if (isTower) {
      const tw = bw * 0.46;
      X.fillStyle = '#241a30'; X.fillRect(x + bw / 2 - tw / 2, topY - 20, tw, 20);
      X.fillStyle = '#2e2236';
      X.beginPath();
      X.moveTo(x + bw / 2 - tw / 2, topY - 20);
      X.lineTo(x + bw / 2, topY - 36);
      X.lineTo(x + bw / 2 + tw / 2, topY - 20); X.fill();
      if (lamps > 0) glow(x + bw / 2, topY - 12, 14, lamps * 0.9);
    } else if (hasDome) {
      X.fillStyle = '#2a2038';
      X.beginPath(); X.arc(x + bw / 2, topY, bw * 0.42, Math.PI, 0); X.fill();
      X.fillStyle = 'rgba(160,96,48,0.4)';
      X.beginPath(); X.arc(x + bw / 2, topY, bw * 0.42, Math.PI, Math.PI * 1.5); X.fill();
    }

    if (isGate) {
      // a great arched way into the bazaar, glowing warm from within
      const gw = bw * 0.52, gx = x + bw / 2, gy = groundY + slide;
      const gg = X.createLinearGradient(0, gy - bh * 0.6, 0, gy);
      gg.addColorStop(0, `rgba(255,196,96,${0.2 + lamps * 0.5})`);
      gg.addColorStop(1, `rgba(255,150,60,${0.45 + lamps * 0.5})`);
      X.fillStyle = gg;
      X.beginPath();
      X.moveTo(gx - gw / 2, gy);
      X.lineTo(gx - gw / 2, gy - bh * 0.4);
      X.quadraticCurveTo(gx, gy - bh * 0.62, gx + gw / 2, gy - bh * 0.4);
      X.lineTo(gx + gw / 2, gy);
      X.fill();
      if (lamps > 0) { glow(gx - gw / 2, gy - bh * 0.36, 12, lamps); glow(gx + gw / 2, gy - bh * 0.36, 12, lamps); }
    }

    // windows — a grid; lit ones warm up during the lamps phase (cheap rects)
    const cols = Math.max(1, Math.floor(bw / 17));
    const rows = Math.max(1, Math.floor(bh / 28));
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        const wx = x + 9 + cc * 17, wy = topY + 16 + r * 26;
        if (wy > groundY + slide - 8) continue;
        const on = rnd(i * 41 + r * 7 + cc * 3);
        if (lamps > 0 && on > 0.42) {
          const a = lamps * (0.55 + on * 0.45);
          X.fillStyle = `rgba(255,150,50,${a * 0.3})`;  X.fillRect(wx - 3, wy - 4, 7, 9);   // soft halo
          X.fillStyle = `rgba(255,206,110,${a})`;       X.fillRect(wx - 1.5, wy - 2, 3, 5); // bright core
        } else {
          X.fillStyle = 'rgba(18,10,26,0.55)'; X.fillRect(wx - 1.5, wy - 2, 3, 5);
        }
      }
    }
    x += bw;
  }
  X.restore();

  // ── 7. Foreground bazaar edge — bunting, awnings, lamps ──
  const fgY = CH - 16 + (1 - riseE) * 34;
  X.save();
  X.globalAlpha = cover;
  for (let i = 0; i < Math.ceil(CW / 22); i++) {           // festival bunting
    const bx = i * 22;
    X.fillStyle = ['#b8483a', '#c8a040', '#3a6a8a', '#caa060'][i % 4];
    X.beginPath(); X.moveTo(bx, fgY - 18); X.lineTo(bx + 6, fgY - 10); X.lineTo(bx + 12, fgY - 18); X.fill();
  }
  for (let i = 0; i < Math.ceil(CW / 92); i++) {           // stall awnings
    const ax = 32 + i * 92;
    X.fillStyle = '#3a2616'; X.fillRect(ax - 38, fgY, 76, 30);
    X.fillStyle = ['#7a2e26', '#2e5670', '#8a6a24'][i % 3]; X.fillRect(ax - 42, fgY - 7, 84, 8);
    if (lamps > 0) glow(ax, fgY - 2, 13, lamps);
  }
  X.restore();

  // ── 8. Wind-blown sand veil (on top — masks the swap, then clears) ──
  _sandVeil(p, dust);

  // ── 9. Cinematic vignette ─────────────────────────────
  X.save();
  X.globalAlpha = cover * 0.5;
  const vg = X.createRadialGradient(CW / 2, CH * 0.55, CH * 0.32, CW / 2, CH * 0.55, CH * 0.98);
  vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(10,6,20,0.82)');
  X.fillStyle = vg; X.fillRect(0, 0, CW, CH);
  X.restore();
}

// ── City → Desert (the return) ────────────────────────────
// Leaving the city the way you came: the sand rises and, as it clears, the
// open desert is revealed — bare dunes, a low sun, distant pyramids. Empty
// where the city was full. Drawn over the live Nile, ends opaque on the desert
// (the realm swaps at progress 1), so it cuts cleanly back to the Desert.

export function desertTransRender(progress) {
  const p      = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const c01    = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (t) => t * t * (3 - 2 * t);

  const cover   = c01(p / 0.36);                       // backdrop establishes, hiding the city
  const riseE   = smooth(c01((p - 0.16) / 0.54));      // dunes + pyramids settle (~0.70)
  const dust    = Math.sin(c01(p / 0.82) * Math.PI);   // sand rises, clears by ~0.82, then holds
  const horizon = CH * 0.62;

  // ── 1. Bleached desert sky ────────────────────────────
  X.save();
  X.globalAlpha = cover;
  const sky = X.createLinearGradient(0, 0, 0, CH);
  sky.addColorStop(0.00, '#2e2850');   // dusk indigo, high
  sky.addColorStop(0.48, '#a85a30');   // hot amber
  sky.addColorStop(0.74, '#e0a85a');   // bleached horizon glow
  sky.addColorStop(1.00, '#caa060');   // sand
  X.fillStyle = sky; X.fillRect(0, 0, CW, CH);
  X.restore();

  // ── 2. Low desert sun + halo ──────────────────────────
  const sunX = CW * 0.5, sunY = horizon + 6;
  X.save();
  X.globalAlpha = cover;
  const halo = X.createRadialGradient(sunX, sunY, 0, sunX, sunY, 190);
  halo.addColorStop(0.0,  'rgba(255,232,160,0.95)');
  halo.addColorStop(0.35, 'rgba(244,170,80,0.5)');
  halo.addColorStop(1.0,  'transparent');
  X.fillStyle = halo; X.fillRect(sunX - 200, sunY - 200, 400, 400);
  X.globalAlpha = cover * 0.95; X.fillStyle = '#ffdc82';
  X.beginPath(); X.arc(sunX, sunY, 34, 0, Math.PI * 2); X.fill();
  X.restore();

  // ── 3. Distant pyramids (the Desert's motif), rising into place ──
  // Bases sit on the dune line so the foreground dunes (drawn next) overlap
  // them — they read as standing behind the sand, not floating in the sky.
  X.save();
  X.globalAlpha = cover * 0.92;
  const py = CH * 0.76 + (1 - riseE) * 34;
  for (const [px, ph] of [[CW * 0.28, 78], [CW * 0.45, 116], [CW * 0.63, 64]]) {
    X.fillStyle = '#6a4424';
    X.beginPath(); X.moveTo(px, py - ph); X.lineTo(px - ph * 0.92, py); X.lineTo(px + ph * 0.92, py); X.fill();
    X.fillStyle = 'rgba(232,172,92,0.5)';   // sunlit east face
    X.beginPath(); X.moveTo(px, py - ph); X.lineTo(px, py); X.lineTo(px + ph * 0.92, py); X.fill();
  }
  X.restore();

  // ── 4. Rolling dunes (nearest darkest), sliding up into place ──
  const dunes = [
    { y: CH * 0.74, col: '#ca9c56', amp: 13, k: 0.013 },
    { y: CH * 0.85, col: '#b3823f', amp: 19, k: 0.009 },
    { y: CH * 0.97, col: '#8a5f2e', amp: 26, k: 0.007 },
  ];
  for (const d of dunes) {
    const dy = d.y + (1 - riseE) * 52;
    X.save();
    X.globalAlpha = cover;
    X.fillStyle = d.col;
    X.beginPath(); X.moveTo(0, CH);
    for (let xx = 0; xx <= CW; xx += 8) X.lineTo(xx, dy + Math.sin(xx * d.k + d.y) * d.amp);
    X.lineTo(CW, CH); X.fill();
    X.restore();
  }

  // ── 5. Wind-blown sand veil (masks the swap, then clears) ──
  _sandVeil(p, dust);

  // ── 6. Cinematic vignette ─────────────────────────────
  X.save();
  X.globalAlpha = cover * 0.45;
  const vg = X.createRadialGradient(CW / 2, CH * 0.55, CH * 0.34, CW / 2, CH * 0.55, CH * 0.98);
  vg.addColorStop(0, 'transparent'); vg.addColorStop(1, 'rgba(20,10,6,0.78)');
  X.fillStyle = vg; X.fillRect(0, 0, CW, CH);
  X.restore();
}

// ── Nile river flood (kept for reaching the water, not the city) ──
// The desert gives way to the river: a dusk-coloured flood wipes westward,
// its leading edge a bright sunlit waterline that ripples as it advances,
// settling into the Nile's indigo-and-amber dusk. Shared by both the
// desert→nile crossing and the return (a flood reads fine either way).

export function nileTransRender(progress) {
  const p     = Math.min(1, progress);
  const w     = CW * p;          // flood width, advancing from the right (west)
  const edgeX = CW - w;          // the leading waterline

  // The flooded panel — dusk sky over an amber horizon over deep river water,
  // matching the Nile realm's own palette so the arrival is seamless.
  const g = X.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0.00, '#352a5e');   // dusk indigo (SKY_HI)
  g.addColorStop(0.42, '#9c4a2e');   // burnt-orange horizon (SKY_MID)
  g.addColorStop(0.54, '#3a6a6a');   // the waterline
  g.addColorStop(1.00, '#0c2230');   // deep river
  X.save();
  X.globalAlpha = 0.94;
  X.fillStyle = g;
  X.fillRect(edgeX, 0, w, CH);
  X.restore();

  // Ripple glints on the new water surface (lower half), riding the flood in.
  X.save();
  X.globalAlpha = 0.22 * p;
  X.strokeStyle = '#bfe2dc';
  X.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const ry    = CH * (0.56 + i * 0.09);
    const phase = progress * 6 + i;
    X.beginPath();
    for (let xx = edgeX; xx <= CW; xx += 6) {
      const yy = ry + Math.sin(xx * 0.05 + phase) * 1.6;
      xx === edgeX ? X.moveTo(xx, yy) : X.lineTo(xx, yy);
    }
    X.stroke();
  }
  X.restore();

  // Bright leading waterline — the low sun catching the flood's advancing edge.
  if (w > 2) {
    X.save();
    const eg = X.createLinearGradient(edgeX - 26, 0, edgeX + 4, 0);
    eg.addColorStop(0, 'transparent');
    eg.addColorStop(1, 'rgba(240,210,140,0.55)');
    X.fillStyle = eg;
    X.fillRect(edgeX - 26, 0, 30, CH);
    X.globalAlpha = 0.8;
    X.fillStyle = '#f0e0b0';
    X.fillRect(edgeX, 0, 2, CH);    // crisp glint line
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
