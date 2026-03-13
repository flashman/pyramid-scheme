// ── FILE: worlds/deep/draw/deep.js ───────────────────────
// The Deep — below Atlantis, below the franchise, below the myth.
// Near-total darkness. Bioluminescence only. The gods keep offices here.
// Called as drawDeep(realm) once per frame.

import { X, CW, CH }  from '../../../engine/canvas.js';
import { G }           from '../../../game/state.js';
import { Flags }       from '../../../engine/flags.js';
import {
  DEEP_WORLD_W, DEEP_WORLD_H, DEEP_FLOOR_Y, DEEP_EXIT_Y,
  SHELF_END, FRANCHISE_END, PELAGIC_END,
  HERALD_WX, HERALD_WY, HIERARCHY_WX, HIERARCHY_WY,
  POSEIDON_WX, POSEIDON_WY, OKEANOS_WX, OKEANOS_WY,
  PRIMORDIAL_WX, PRIMORDIAL_WY,
  ANGLER_POSITIONS,
} from '../constants.js';

// ── Deterministic pseudo-random ───────────────────────────
const _seed = (() => {
  let s = 0xD33B109;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 0) / 0xffffffff; };
})();
const _r = _seed;

// ── Pre-generated bioluminescent particles ────────────────
const BIOGLINTS = Array.from({ length: 90 }, () => ({
  wx:    10 + Math.floor(_r() * (DEEP_WORLD_W - 20)),
  wy:    50 + Math.floor(_r() * (DEEP_FLOOR_Y - 100)),
  col:   ['#00ffe0','#0088ff','#88ffaa','#ff44cc','#44ffff','#aaffee'][Math.floor(_r() * 6)],
  r:     1 + _r() * 2.5,
  phase: _r() * Math.PI * 2,
  speed: 0.0005 + _r() * 0.0015,
}));

// ── Sinking debris from Atlantis above (shelf zone) ───────
const DEBRIS = Array.from({ length: 30 }, () => ({
  wx:    20 + Math.floor(_r() * (DEEP_WORLD_W - 40)),
  wy:    40 + Math.floor(_r() * (SHELF_END - 80)),
  w:     8 + Math.floor(_r() * 32),
  h:     4 + Math.floor(_r() * 18),
  angle: (_r() - 0.5) * 1.8,
  drift: (_r() - 0.5) * 0.003,
}));

// ── Hydrothermal vents (pelagic zone boundary) ────────────
const VENTS = [
  { wx: 180,  wy: PELAGIC_END - 60 },
  { wx: 680,  wy: PELAGIC_END - 40 },
  { wx: 1180, wy: PELAGIC_END - 70 },
];

// ── Pre-calc Poseidon office wall carvings ────────────────
const ORG_CHART_LINES = [
  { tier: '∞',  label: '[REDACTED]',                   col: '#550055' },
  { tier: '12', label: 'THE PRIMORDIALS',               col: '#220033' },
  { tier: '8',  label: 'THE TITANS  ✦  DEPOSED',       col: '#1a2a3a' },
  { tier: '7',  label: 'THE OLYMPIANS',                 col: '#2a3a5a' },
  { tier: '4',  label: 'DEMIGODS / HEROES',             col: '#1a2a30' },
  { tier: '1',  label: 'MORTALS',                       col: '#101820' },
  { tier: '0',  label: 'EVERYTHING ELSE',               col: '#080c10' },
];

// ── Water background ──────────────────────────────────────

function drawWaterBg(camY) {
  // Goes from deep blue-black (shallow) to absolute void (deep)
  const depthFrac = Math.min(1, camY / DEEP_WORLD_H);
  const r0 = Math.round(0 * (1 - depthFrac));
  const g0 = Math.round(8 * (1 - depthFrac * 0.95));
  const b0 = Math.round(20 * (1 - depthFrac * 0.8));

  const bg = X.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, `rgb(${r0},${g0},${b0})`);
  bg.addColorStop(1, `rgb(0,0,${Math.max(0, 8 - Math.round(depthFrac * 8))})`);
  X.fillStyle = bg;
  X.fillRect(0, 0, CW, CH);
}

// ── Zone atmosphere ───────────────────────────────────────

function drawZoneAtmosphere(camY) {
  const midY = camY + CH / 2;
  let col = null, alpha = 0;
  if (midY < SHELF_END) {
    col = '#001a30'; alpha = 0.12; // shelf — deep remnant blue
  } else if (midY < FRANCHISE_END) {
    const t = (midY - SHELF_END) / (FRANCHISE_END - SHELF_END);
    col = '#0a001a'; alpha = 0.08 + t * 0.06; // franchise — dark purple haze
  } else if (midY < PELAGIC_END) {
    col = '#000010'; alpha = 0.15; // pelagic — near void
  } else {
    col = '#000000'; alpha = 0.22; // abyss — complete blackout tint
  }
  if (col) {
    X.save(); X.globalAlpha = alpha; X.fillStyle = col;
    X.fillRect(0, 0, CW, CH); X.restore();
  }
}

// ── Bioluminescent glints ─────────────────────────────────

function drawBioglints(t) {
  for (const g of BIOGLINTS) {
    const pulse = 0.25 + Math.sin(t * g.speed + g.phase) * 0.2;
    X.save();
    X.globalAlpha = pulse;
    X.shadowColor = g.col;
    X.shadowBlur  = 8;
    X.fillStyle   = g.col;
    X.beginPath();
    X.arc(g.wx, g.wy, g.r, 0, Math.PI * 2);
    X.fill();
    X.restore();
  }
  X.shadowBlur = 0;
}

// ── Sinking debris ────────────────────────────────────────

function drawDebris(t) {
  for (const d of DEBRIS) {
    const drift = Math.sin(t * 0.0008 + d.wx * 0.01) * 4 * (1 / (d.wy + 1));
    X.save();
    X.translate(d.wx + drift, d.wy);
    X.rotate(d.angle + Math.sin(t * 0.0005 + d.wx) * 0.02);
    X.globalAlpha = 0.35;
    X.fillStyle = '#1a3040';
    X.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
    X.strokeStyle = '#0e2030';
    X.lineWidth = 1;
    X.strokeRect(-d.w / 2, -d.h / 2, d.w, d.h);
    X.restore();
  }
}

// ── The Shelf (Zone 1) ────────────────────────────────────
// Ruins from above. Atlantean stonework dissolving into darkness.
// The Herald waits here like an usher at the end of everything.

function drawShelf(t) {
  // Fallen arch sections from Atlantis, drifting down
  const archFrag = [
    { wx: 220, wy: SHELF_END - 180, span: 90 },
    { wx: 760, wy: SHELF_END - 240, span: 130 },
    { wx: 1100, wy: SHELF_END - 160, span: 80 },
  ];
  for (const a of archFrag) {
    X.save();
    X.globalAlpha = 0.4;
    X.strokeStyle = '#1a3a50';
    X.lineWidth = 10;
    X.beginPath();
    X.arc(a.wx + a.span / 2, a.wy, a.span / 2, Math.PI, 0, false);
    X.stroke();
    X.lineWidth = 6;
    X.strokeStyle = '#0e2230';
    X.stroke();
    X.restore();
  }

  // Stone slabs half-buried in sediment at shelf boundary
  X.save();
  X.globalAlpha = 0.3;
  X.fillStyle = '#122030';
  for (let i = 0; i < 8; i++) {
    const sx = 60 + i * 165;
    X.fillRect(sx, SHELF_END - 14, 120, 20);
  }
  X.restore();

  // The Herald — a luminous dolphin-form, ancient and knowing
  const hx = HERALD_WX;
  const hy = HERALD_WY;
  const bob = Math.sin(t / 700) * 5;
  const glide = Math.sin(t / 1200) * 0.04;
  X.save();
  X.translate(hx, hy + bob);
  X.rotate(glide);

  // Bioluminescent aura
  X.save();
  const hg = X.createRadialGradient(0, 0, 4, 0, 0, 50);
  hg.addColorStop(0, 'rgba(0,220,180,0.18)');
  hg.addColorStop(1, 'transparent');
  X.fillStyle = hg;
  X.beginPath(); X.arc(0, 0, 50, 0, Math.PI * 2); X.fill();
  X.restore();

  // Body — elongated, dolphin-like but ancient
  X.save();
  X.fillStyle = '#006080';
  X.beginPath();
  X.ellipse(0, 0, 38, 14, 0, 0, Math.PI * 2);
  X.fill();
  // Tail
  X.fillStyle = '#004a65';
  X.beginPath();
  X.moveTo(-38, 0);
  X.lineTo(-58, -12);
  X.lineTo(-55, 0);
  X.lineTo(-58, 12);
  X.closePath();
  X.fill();
  // Dorsal fin
  X.fillStyle = '#005570';
  X.beginPath();
  X.moveTo(0, -14);
  X.lineTo(12, -28);
  X.lineTo(20, -14);
  X.closePath();
  X.fill();
  // Bioluminescent markings
  X.save();
  X.strokeStyle = '#00ffcc';
  X.lineWidth = 1;
  X.globalAlpha = 0.4 + Math.sin(t / 500) * 0.2;
  X.shadowColor = '#00ffcc';
  X.shadowBlur = 6;
  for (let i = 0; i < 4; i++) {
    X.beginPath();
    X.arc(10 - i * 12, -4 + i * 2, 3, 0, Math.PI * 2);
    X.stroke();
  }
  X.restore();
  // Eye — ancient intelligence
  X.fillStyle = '#00ffcc';
  X.globalAlpha = 0.9;
  X.beginPath(); X.arc(28, -3, 4, 0, Math.PI * 2); X.fill();
  X.fillStyle = '#000';
  X.beginPath(); X.arc(29, -3, 2, 0, Math.PI * 2); X.fill();
  // pupil glow
  X.fillStyle = '#00ffcc';
  X.globalAlpha = 0.5;
  X.beginPath(); X.arc(29, -3, 1, 0, Math.PI * 2); X.fill();
  X.restore();

  X.restore();
}

// ── The Franchise Office (Zone 2) ─────────────────────────
// Poseidon's domain. Bureaucratic infrastructure of the divine.
// His office walls are carved with the org chart of creation.

function drawFranchiseOffice(t) {
  const officeFloor = FRANCHISE_END - 60;

  // Office walls — dark stone, carved with tier lines
  X.save();
  X.globalAlpha = 0.55;
  // Left wall
  const lwg = X.createLinearGradient(0, SHELF_END, 0, FRANCHISE_END);
  lwg.addColorStop(0, '#0a0818'); lwg.addColorStop(1, '#050410');
  X.fillStyle = lwg;
  X.fillRect(0, SHELF_END, 60, FRANCHISE_END - SHELF_END);
  // Right wall
  X.fillRect(DEEP_WORLD_W - 60, SHELF_END, 60, FRANCHISE_END - SHELF_END);
  X.restore();

  // Wall carvings — tier lines etched into stone
  X.save();
  X.globalAlpha = 0.4;
  X.font = '5px monospace';
  X.textAlign = 'right';
  for (let i = 0; i < 20; i++) {
    const ly = SHELF_END + 40 + i * 44;
    X.strokeStyle = '#1a1a2a'; X.lineWidth = 1;
    X.beginPath(); X.moveTo(62, ly); X.lineTo(0, ly); X.stroke();
    X.fillStyle = '#2a2a4a';
    X.fillText(`✦`, 50, ly - 4);
  }
  X.textAlign = 'left';
  X.restore();

  // The Hierarchy Tablet — org chart stone on left wall
  const hx = HIERARCHY_WX;
  const hy = HIERARCHY_WY;
  X.save();
  // Stone slab
  const slabG = X.createLinearGradient(hx - 5, hy, hx + 5, hy);
  slabG.addColorStop(0, '#0a0820'); slabG.addColorStop(0.5, '#14102e'); slabG.addColorStop(1, '#0a0820');
  X.fillStyle = slabG;
  X.fillRect(hx - 95, hy - 180, 190, 360);
  X.strokeStyle = '#1e1a3a'; X.lineWidth = 2;
  X.strokeRect(hx - 95, hy - 180, 190, 360);

  // Title
  X.globalAlpha = 0.7;
  X.font = '6px monospace'; X.fillStyle = '#6644aa';
  X.textAlign = 'center';
  X.fillText('THE DEEP STRUCTURE', hx, hy - 158);
  X.fillText('DIVINE COMPLIANCE REGISTRY', hx, hy - 148);
  X.globalAlpha = 0.35;
  X.strokeStyle = '#2a2040'; X.lineWidth = 1;
  X.beginPath(); X.moveTo(hx - 85, hy - 140); X.lineTo(hx + 85, hy - 140); X.stroke();

  // Tier rows
  ORG_CHART_LINES.forEach((row, i) => {
    const ry = hy - 128 + i * 44;
    X.globalAlpha = 0.5;
    X.fillStyle = row.col;
    X.fillRect(hx - 88, ry, 176, 38);

    X.globalAlpha = 0.75;
    X.font = 'bold 5px monospace';
    X.fillStyle = '#4466aa';
    X.textAlign = 'left';
    X.fillText(`TIER ${row.tier}`, hx - 82, ry + 12);
    X.globalAlpha = 0.6;
    X.font = '5px monospace';
    X.fillStyle = '#8899bb';
    X.fillText(row.label, hx - 82, ry + 24);

    // Connecting line
    if (i < ORG_CHART_LINES.length - 1) {
      X.globalAlpha = 0.2;
      X.strokeStyle = '#334466'; X.lineWidth = 1;
      X.beginPath();
      X.moveTo(hx, ry + 38);
      X.lineTo(hx, ry + 44);
      X.stroke();
    }
  });
  X.textAlign = 'left';
  X.restore();

  // Poseidon on his throne
  drawPoseidon(t);

  // Office floor texture
  X.save();
  X.globalAlpha = 0.2;
  X.fillStyle = '#0e0820';
  X.fillRect(0, officeFloor, DEEP_WORLD_W, 40);
  // Stone tiles
  X.strokeStyle = '#181430'; X.lineWidth = 0.5;
  for (let tx = 0; tx < DEEP_WORLD_W; tx += 48) {
    X.beginPath(); X.moveTo(tx, officeFloor); X.lineTo(tx, officeFloor + 40); X.stroke();
  }
  X.restore();
}

// ── Poseidon ──────────────────────────────────────────────
// Lord of Sea Franchise #1. Not happy about Atlantis.

function drawPoseidon(t) {
  const px = POSEIDON_WX;
  const py = POSEIDON_WY;

  // Throne — stone, bureaucratic, with carved tiers
  X.save();
  X.globalAlpha = 0.9;
  // Throne back
  const tg = X.createLinearGradient(px - 40, py - 140, px + 40, py - 140);
  tg.addColorStop(0, '#080618'); tg.addColorStop(0.5, '#100e22'); tg.addColorStop(1, '#080618');
  X.fillStyle = tg;
  X.fillRect(px - 44, py - 150, 88, 150);
  // Throne seat
  X.fillStyle = '#0a0820';
  X.fillRect(px - 52, py - 28, 104, 28);
  // Arm rests
  X.fillRect(px - 56, py - 80, 14, 60);
  X.fillRect(px + 42, py - 80, 14, 60);

  // Tier carvings on throne back
  X.globalAlpha = 0.3;
  X.font = '4px monospace'; X.fillStyle = '#4444aa'; X.textAlign = 'center';
  X.fillText('FRANCHISE #1', px, py - 130);
  X.fillText('SEA DIVISION', px, py - 120);
  X.fillText('TIER 7', px, py - 108);
  X.textAlign = 'left';
  X.restore();

  // Poseidon figure — seated, massive, ancient
  X.save();
  const sway = Math.sin(t / 2800) * 0.012;
  X.translate(px, py - 28);
  X.rotate(sway);

  // Robe/body
  const rg = X.createLinearGradient(-30, -110, 30, 0);
  rg.addColorStop(0, '#1a2050'); rg.addColorStop(0.5, '#121a3a'); rg.addColorStop(1, '#0c1228');
  X.fillStyle = rg;
  X.fillRect(-28, -110, 56, 110);

  // Torso musculature (implied)
  X.fillStyle = '#1e2858';
  X.fillRect(-24, -90, 48, 30);

  // Head
  X.fillStyle = '#b8a078'; // weathered bronze skin
  X.fillRect(-16, -138, 32, 32);
  // Crown / seaweed-encrusted tiara
  X.fillStyle = '#1a3050';
  X.fillRect(-20, -148, 40, 12);
  // Crown spikes
  for (let i = 0; i < 5; i++) {
    X.fillRect(-18 + i * 9, -158, 4, 12);
  }

  // Beard — long, tangled, ancient
  X.fillStyle = '#6a7a8a';
  X.beginPath();
  X.moveTo(-14, -108);
  X.quadraticCurveTo(-20, -60, -18, -20);
  X.lineTo(-12, -20);
  X.quadraticCurveTo(-10, -55, -8, -108);
  X.fill();
  X.fillRect(-8, -108, 16, 88);
  // Beard lines
  X.strokeStyle = '#4a5a6a'; X.lineWidth = 1; X.globalAlpha = 0.6;
  for (let i = 0; i < 5; i++) {
    X.beginPath();
    X.moveTo(-6 + i * 3, -100);
    X.lineTo(-8 + i * 4, -20 + i * 3);
    X.stroke();
  }

  // Eyes — tired, bureaucratic
  X.globalAlpha = 1;
  X.fillStyle = '#000';
  X.fillRect(-10, -132, 6, 6);
  X.fillRect(4, -132, 6, 6);
  // Eye colour — deep sea green
  X.fillStyle = '#004a20';
  X.fillRect(-9, -131, 4, 4);
  X.fillRect(5, -131, 4, 4);

  // Arms — crossed, one holding trident
  X.fillStyle = '#b8a078';
  X.fillRect(-28, -80, 18, 10); // left arm
  X.fillRect(10, -80, 18, 10);  // right arm

  // Trident in right hand
  X.save();
  X.translate(28, -80);
  X.strokeStyle = '#6a9a8a'; X.lineWidth = 3;
  X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -90); X.stroke();
  // Tines
  X.lineWidth = 2;
  X.beginPath(); X.moveTo(0, -90); X.lineTo(-10, -110); X.stroke();
  X.beginPath(); X.moveTo(0, -90); X.lineTo(0, -114); X.stroke();
  X.beginPath(); X.moveTo(0, -90); X.lineTo(10, -110); X.stroke();
  // Bioluminescent glow on trident (KPI tracker)
  X.save();
  X.globalAlpha = 0.3 + Math.sin(t / 800) * 0.1;
  X.shadowColor = '#00cc88';
  X.shadowBlur = 10;
  X.strokeStyle = '#00cc88'; X.lineWidth = 1;
  X.beginPath(); X.moveTo(0, -40); X.lineTo(0, -90); X.stroke();
  X.restore();
  X.restore();

  // Stone clipboard on lap (compliance metrics)
  X.fillStyle = '#0e1420';
  X.fillRect(-24, -44, 36, 22);
  X.globalAlpha = 0.4;
  X.font = '3px monospace'; X.fillStyle = '#4488aa'; X.textAlign = 'center';
  X.fillText('Q3 TIDE REPORT', -6, -36);
  X.fillText('OVERFLOW: N/A', -6, -30);
  X.textAlign = 'left';

  X.restore();

  // Nameplate
  X.save();
  X.globalAlpha = 0.55;
  X.fillStyle = '#06040e';
  X.fillRect(px - 70, py + 4, 140, 14);
  X.font = '5px monospace'; X.fillStyle = '#4455aa'; X.textAlign = 'center';
  X.fillText('POSEIDON  ✦  LORD OF SEA FRANCHISE #1', px, py + 14);
  X.fillText('TIER 7 ASSOCIATE  ✦  PELAGIC DIVISION', px, py + 22);
  X.textAlign = 'left';
  X.restore();
}

// ── Anglers (Bioluminescent Recruiters) ───────────────────

export function drawAngler(angler, camX, camY, t) {
  if (!angler.active) return;
  const sx = Math.round(angler.worldX - camX);
  const sy = Math.round(angler.worldY - camY);

  X.save();
  X.translate(sx, sy);
  if (angler.facing === -1) X.scale(-1, 1);

  // Body
  X.fillStyle = '#0a0a14';
  X.beginPath();
  X.ellipse(0, 0, 22, 16, 0, 0, Math.PI * 2);
  X.fill();

  // Terrible teeth
  X.fillStyle = '#cccccc';
  const mouthOpen = angler._chasing ? 0.7 : 0.2;
  for (let i = 0; i < 5; i++) {
    const tx = -14 + i * 7;
    X.fillRect(tx, -mouthOpen * 8, 3, mouthOpen * 10);
    X.fillRect(tx + 2, 0, 3, mouthOpen * 8);
  }

  // Dorsal spine / lure
  X.strokeStyle = '#1a1a2a'; X.lineWidth = 2;
  X.beginPath(); X.moveTo(8, -14); X.lineTo(8, -38); X.stroke();

  // Lure orb — bioluminescent, pulsing
  const lurePulse = 0.6 + Math.sin(t * 0.003 + (angler.worldX * 0.01)) * 0.35;
  const lureCol = angler._chasing ? '#ff6633' : '#00ffcc'; // red when chasing, teal normally
  X.save();
  X.globalAlpha = lurePulse;
  X.shadowColor = lureCol; X.shadowBlur = 16;
  X.fillStyle = lureCol;
  X.beginPath(); X.arc(8, -42, 6, 0, Math.PI * 2); X.fill();
  // Inner bright spot
  X.globalAlpha = lurePulse * 0.8;
  X.fillStyle = '#ffffff';
  X.beginPath(); X.arc(7, -43, 2, 0, Math.PI * 2); X.fill();
  X.restore();

  // Eyes — yellow, hungry
  X.fillStyle = '#aa8800';
  X.beginPath(); X.arc(-8, -4, 5, 0, Math.PI * 2); X.fill();
  X.fillStyle = '#000';
  X.beginPath(); X.arc(-8, -4, 2, 0, Math.PI * 2); X.fill();

  // Pectoral fins
  X.fillStyle = '#0d0d1a';
  X.save(); X.translate(10, 8); X.rotate(0.4);
  X.fillRect(0, 0, 14, 5); X.restore();
  X.save(); X.translate(10, -8); X.rotate(-0.4);
  X.fillRect(0, -5, 14, 5); X.restore();

  X.restore();
}

// ── The Pelagic / Okeanos zone (Zone 3) ───────────────────
// Absolute darkness except bioluminescence.
// Okeanos exists here as a vast coiled presence.

function drawPelagic(t) {
  // Faint suggestion of walls dissolving into void
  X.save();
  X.globalAlpha = 0.08;
  X.fillStyle = '#000008';
  X.fillRect(0, FRANCHISE_END, 40, PELAGIC_END - FRANCHISE_END);
  X.fillRect(DEEP_WORLD_W - 40, FRANCHISE_END, 40, PELAGIC_END - FRANCHISE_END);
  X.restore();

  // Hydrothermal vents
  for (const v of VENTS) {
    const plume = Math.sin(t * 0.0018 + v.wx * 0.01) * 8;
    X.save();
    X.translate(v.wx, v.wy);
    // Vent chimney
    X.fillStyle = '#1a0a08'; X.globalAlpha = 0.8;
    X.fillRect(-8, -20, 16, 20);
    // Superheated plume
    X.globalAlpha = 0.25;
    for (let p = 0; p < 6; p++) {
      const py2 = -20 - p * 30 + (t * 0.04) % 30;
      const pw = 8 + p * 4;
      const pr = Math.sin(t * 0.002 + p + v.wx) * 8 + plume;
      const pg = X.createRadialGradient(pr, py2, 0, pr, py2, pw * 1.5);
      pg.addColorStop(0, 'rgba(220,80,20,0.4)');
      pg.addColorStop(0.5, 'rgba(80,20,10,0.15)');
      pg.addColorStop(1, 'transparent');
      X.fillStyle = pg;
      X.beginPath(); X.arc(pr, py2, pw * 1.5, 0, Math.PI * 2); X.fill();
    }
    X.restore();
  }

  // Okeanos — drawn as a vast ambient presence
  drawOkeanos(t);
}

// ── Okeanos ───────────────────────────────────────────────
// The primordial ocean personified. He is larger than the screen.
// You can only ever see part of him. He speaks in geological time.

function drawOkeanos(t) {
  const ox = OKEANOS_WX;
  const oy = OKEANOS_WY;

  // His presence is implied by a vast circular motion of water
  X.save();
  // Enormous slow vortex — the "body" of Okeanos
  X.translate(ox, oy);
  const vortexRot = t * 0.00008;
  for (let ring = 0; ring < 5; ring++) {
    const r = 180 + ring * 120;
    const a = 0.03 - ring * 0.005;
    X.save();
    X.rotate(vortexRot + ring * 0.4);
    X.globalAlpha = a;
    X.strokeStyle = '#001a2a';
    X.lineWidth = 12 - ring * 2;
    X.beginPath();
    X.arc(0, 0, r, 0, Math.PI * 1.6);
    X.stroke();
    X.restore();
  }

  // A partially-visible coiled serpentine form
  const scale = OKEANOS_WX > 0 ? 1.2 : 1; // always 1.2
  X.save();
  X.rotate(vortexRot * 0.4);
  // Vast body segment (only part visible)
  const bodyAlpha = 0.18 + Math.sin(t * 0.0004) * 0.06;
  X.globalAlpha = bodyAlpha;
  // Main coil arc
  X.strokeStyle = '#003344';
  X.lineWidth = 90;
  X.lineCap = 'round';
  X.beginPath();
  X.arc(0, 0, 280, Math.PI * 0.1, Math.PI * 0.9);
  X.stroke();
  // Scale detail on coil
  X.globalAlpha = bodyAlpha * 0.4;
  X.strokeStyle = '#004455';
  X.lineWidth = 2;
  for (let s = 0; s < 12; s++) {
    const ang = Math.PI * 0.1 + (s / 12) * Math.PI * 0.8;
    const bx = Math.cos(ang) * 280;
    const by = Math.sin(ang) * 280;
    X.save();
    X.translate(bx, by);
    X.rotate(ang + Math.PI / 2);
    X.beginPath(); X.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2); X.stroke();
    X.restore();
  }
  X.restore();

  // Eye — vast, ancient, barely visible
  const eyeX = Math.cos(vortexRot + 0.3) * 270;
  const eyeY = Math.sin(vortexRot + 0.3) * 270;
  X.save();
  X.globalAlpha = 0.25 + Math.sin(t * 0.0006) * 0.1;
  const eg = X.createRadialGradient(eyeX, eyeY, 2, eyeX, eyeY, 30);
  eg.addColorStop(0, '#006688');
  eg.addColorStop(0.4, '#003344');
  eg.addColorStop(1, 'transparent');
  X.fillStyle = eg;
  X.beginPath(); X.arc(eyeX, eyeY, 30, 0, Math.PI * 2); X.fill();
  // Pupil slit
  X.strokeStyle = '#008899'; X.lineWidth = 4;
  X.globalAlpha = 0.15;
  X.beginPath();
  X.moveTo(eyeX - 16, eyeY);
  X.lineTo(eyeX + 16, eyeY);
  X.stroke();
  X.restore();

  // Nameplate (very subtle)
  X.save();
  X.globalAlpha = 0.3 + Math.sin(t * 0.0007) * 0.1;
  X.font = '6px monospace'; X.fillStyle = '#004466'; X.textAlign = 'center';
  X.fillText('OKEANOS  ✦  TIER 12  ✦  THE ENCIRCLER', 0, 90);
  X.fillText('PRE-FRANCHISE  ✦  PRIMORDIAL DIVISION', 0, 104);
  X.textAlign = 'left';
  X.restore();

  X.restore();
}

// ── The Abyss (Zone 4) ────────────────────────────────────
// Total darkness. The primordial tablet rests here.
// The Leviathan is from here.

function drawAbyss(t) {
  // The absolute floor — sediment that has been here since the earth was cooling
  const floorG = X.createLinearGradient(0, DEEP_FLOOR_Y - 20, 0, DEEP_FLOOR_Y + 50);
  floorG.addColorStop(0, '#030206');
  floorG.addColorStop(0.5, '#020104');
  floorG.addColorStop(1, '#000000');
  X.fillStyle = floorG;
  X.fillRect(0, DEEP_FLOOR_Y - 20, DEEP_WORLD_W, 70);

  // Sediment texture — millenia of everything sinking
  X.save();
  X.globalAlpha = 0.15;
  X.fillStyle = '#0a080c';
  for (let i = 0; i < 200; i++) {
    const gx = (i * 43) % DEEP_WORLD_W;
    const gy = DEEP_FLOOR_Y - 8 + (i * 7) % 20;
    X.fillRect(gx, gy, 3, 1);
  }
  X.restore();

  // Primordial tablet — half-submerged in floor sediment
  drawPrimordialTablet(t);
}

// ── Primordial Tablet ─────────────────────────────────────

function drawPrimordialTablet(t) {
  const tx = PRIMORDIAL_WX;
  const ty = PRIMORDIAL_WY;
  const read = Flags.get('deep_primordial_read');

  // Barely visible unless you're very close — just a slight glow
  const nearDist = 0; // will be computed per-frame if needed
  const glowAmt = 0.08 + (read ? 0.15 : 0) + Math.sin(t * 0.0006) * 0.04;

  X.save();
  X.globalAlpha = glowAmt;
  const tg = X.createRadialGradient(tx, ty - 40, 4, tx, ty - 40, 60);
  tg.addColorStop(0, '#220033');
  tg.addColorStop(0.5, '#110022');
  tg.addColorStop(1, 'transparent');
  X.fillStyle = tg;
  X.beginPath(); X.arc(tx, ty - 40, 60, 0, Math.PI * 2); X.fill();
  X.restore();

  // The slab itself — ancient beyond age
  X.save();
  X.globalAlpha = 0.55;
  X.fillStyle = '#06040a';
  X.fillRect(tx - 40, ty - 100, 80, 90);
  X.strokeStyle = '#110820'; X.lineWidth = 2;
  X.strokeRect(tx - 40, ty - 100, 80, 90);

  // Ancient script that only partially resolves
  if (read) {
    X.globalAlpha = 0.4;
    X.font = '4px monospace'; X.fillStyle = '#440066'; X.textAlign = 'center';
    X.fillText('THE SHAPE', tx, ty - 82);
    X.fillText('PRECEDES', tx, ty - 72);
    X.fillText('THE HAND', tx, ty - 62);
    X.fillText('THAT DRAWS IT', tx, ty - 52);
    X.globalAlpha = 0.2;
    X.fillText('───────────', tx, ty - 42);
    X.fillText('I HAVE BEEN', tx, ty - 32);
    X.fillText('WRITING THIS', tx, ty - 22);
    X.fillText('FOREVER', tx, ty - 12);
  } else {
    // Unread — just eroded marks
    X.globalAlpha = 0.15;
    X.font = '5px monospace'; X.fillStyle = '#330044'; X.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      const noise = ((tx * 37 + ty * 13 + i * 997) % 100) / 100;
      X.fillText('- - - - - - -', tx, ty - 80 + i * 18);
    }
  }
  X.textAlign = 'left';
  X.restore();
}

// ── The Leviathan ─────────────────────────────────────────

export function drawLeviathan(realm, camX, camY, t) {
  if (!realm._leviathan) return;
  const lev = realm._leviathan;
  if (!lev.visible) return;

  const sx = Math.round(lev.wx - camX);
  const sy = Math.round(lev.wy - camY);

  X.save();
  X.translate(sx, sy);
  if (lev.dir < 0) X.scale(-1, 1);

  // Vast form — mostly in darkness, only partially visible
  const vis = lev.visibility * (0.12 + Math.sin(t * 0.0007) * 0.04);
  X.globalAlpha = vis;

  // Main body — enormous cylindrical form
  const bodyLen = 900;
  const bodyH   = 200;
  const bg = X.createLinearGradient(-bodyLen / 2, 0, bodyLen / 2, 0);
  bg.addColorStop(0, 'transparent');
  bg.addColorStop(0.1, '#001408');
  bg.addColorStop(0.5, '#002010');
  bg.addColorStop(0.9, '#001408');
  bg.addColorStop(1, 'transparent');
  X.fillStyle = bg;
  X.fillRect(-bodyLen / 2, -bodyH / 2, bodyLen, bodyH);

  // Scale patterns
  X.globalAlpha = vis * 0.5;
  X.strokeStyle = '#003820';
  X.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    const scx = -380 + i * 42;
    const scy = -40 + (i % 3) * 28;
    X.beginPath();
    X.ellipse(scx, scy, 16, 12, 0, 0, Math.PI * 2);
    X.stroke();
  }

  // Eyes — multiple, very faint
  X.globalAlpha = vis * 1.5;
  const eyePositions = [-300, -120, 60, 200];
  for (const ex of eyePositions) {
    const eg = X.createRadialGradient(ex, -20, 0, ex, -20, 18);
    eg.addColorStop(0, '#004400');
    eg.addColorStop(1, 'transparent');
    X.fillStyle = eg;
    X.beginPath(); X.arc(ex, -20, 18, 0, Math.PI * 2); X.fill();
  }

  X.restore();
}

// ── Player (swimming pharaoh — deep version) ──────────────
// Re-uses the atlantis swimmer but with pressure distortion

function drawDeepSwimmer(realm) {
  if (!G.bought) return;
  const sx  = Math.round(realm.px - realm.camX);
  const sy  = Math.round(realm.py - realm.camY);
  const t   = Date.now();
  const bob = Math.sin(t / 500) * 1.2;
  const tilt = Math.atan2(realm.pvy, Math.abs(realm.pvx) + 0.01) * 0.2;
  const facing = realm.pvx < -0.3 ? -1 : 1;
  const swimming = Math.abs(realm.pvx) + Math.abs(realm.pvy) > 0.5;

  X.save();
  X.translate(sx, sy + bob);
  X.rotate(tilt);
  if (facing === -1) X.scale(-1, 1);

  // Pressure aura — subtly distorting around the player at depth
  const depthFrac = Math.min(1, realm.py / DEEP_WORLD_H);
  if (depthFrac > 0.3) {
    X.save();
    X.globalAlpha = (depthFrac - 0.3) * 0.15;
    const pg = X.createRadialGradient(0, 0, 4, 0, 0, 32);
    pg.addColorStop(0, '#440066');
    pg.addColorStop(1, 'transparent');
    X.fillStyle = pg;
    X.beginPath(); X.arc(0, 0, 32, 0, Math.PI * 2); X.fill();
    X.restore();
  }

  const fr = swimming && Math.floor(t / 220) % 2;
  X.fillStyle = '#c8b060'; X.fillRect(-14, -8, 28, 16); // torso
  X.fillStyle = '#1a60a0'; X.fillRect(-8, -20, 16, 14); // headdress
  X.fillStyle = '#e8c878'; X.fillRect(-6, -18, 12, 10); // face
  X.fillStyle = '#e8c060'; X.fillRect(-14, -8, 28, 5);  // collar
  X.fillStyle = '#e0e0e0';
  if (fr) { X.fillRect(12, -4, 12, 6); X.fillRect(12, 4, 10, 5); }
  else    { X.fillRect(12, -6, 10, 5); X.fillRect(12, 2, 12, 6); }
  X.fillStyle = '#c8b060'; X.fillRect(14, -10, 14, 5);
  X.fillStyle = '#000'; X.fillRect(-4, -16, 2, 2); X.fillRect(2, -16, 2, 2);
  X.restore();
}

// ── Surface shimmer (entry from Atlantis) ─────────────────

function drawDeepSurface(camX, camY) {
  const surfaceScreenY = -camY;
  if (surfaceScreenY < -30 || surfaceScreenY > CH + 30) return;
  X.save();
  const sg = X.createLinearGradient(0, surfaceScreenY, 0, surfaceScreenY + 24);
  sg.addColorStop(0, 'rgba(0,30,50,0.6)');
  sg.addColorStop(1, 'rgba(0,10,20,0)');
  X.fillStyle = sg;
  X.fillRect(0, surfaceScreenY, CW, 24);
  // Exit ripples
  const t2 = Date.now();
  X.strokeStyle = 'rgba(0,100,160,0.3)'; X.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const rx = ((i * 120 + camX * 0.2 + t2 * 0.01) % (CW + 80)) - 40;
    X.beginPath();
    X.moveTo(rx, surfaceScreenY + 4);
    X.quadraticCurveTo(rx + 25, surfaceScreenY + 7, rx + 50, surfaceScreenY + 4);
    X.stroke();
  }
  X.restore();
}

// ── Exit prompt ───────────────────────────────────────────

function drawExitPrompt(realm) {
  if (realm.py > DEEP_EXIT_Y + 50) return;
  const alpha = Math.max(0, 1 - realm.py / (DEEP_EXIT_Y + 50));
  const t = Date.now();
  X.save();
  X.globalAlpha = alpha * (0.6 + Math.sin(t * 0.005) * 0.2);
  X.font = 'bold 11px monospace'; X.fillStyle = '#006688'; X.textAlign = 'center';
  X.fillText('[↑] ASCEND — RETURN TO ATLANTIS', CW / 2, 40);
  X.restore();
  X.textAlign = 'left';
}


// ── Interact hint (screen-space) ─────────────────────────

function drawInteractHint(realm) {
  if (!realm.registry) return;
  const nearest = realm.registry.nearest;
  if (!nearest) return;

  const labels = {
    herald:           '[SPACE] SPEAK WITH THE HERALD',
    poseidon:         '[SPACE] APPROACH POSEIDON',
    okeanos:          '[SPACE] SPEAK WITH OKEANOS',
    primordial_tablet:'[SPACE] READ THE PRIMORDIAL TABLET',
  };
  const label = labels[nearest.id] || '[SPACE] INTERACT';

  const t  = Date.now();
  const ha = 0.5 + 0.4 * Math.abs(Math.sin(t / 440));
  X.save();
  X.globalAlpha = ha;
  X.font = '7px monospace';
  X.textAlign = 'center';
  X.fillStyle = '#006688';
  X.fillText(label, CW / 2, CH - 60);
  X.textAlign = 'left';
  X.restore();
}

// ── Depth HUD ─────────────────────────────────────────────

function drawDeepHUD(realm) {
  const depthM = Math.max(0, Math.round((realm.py - DEEP_EXIT_Y) / 6));
  const t      = Date.now();
  const deaths = Flags.get('deep_deaths', 0);

  const zoneName =
    realm.py < SHELF_END      ? 'THE SHELF — DEBRIS LAYER' :
    realm.py < FRANCHISE_END  ? 'THE FRANCHISE OFFICE' :
    realm.py < PELAGIC_END    ? 'THE PELAGIC — PRE-FRANCHISE' :
                                'THE ABYSS';

  X.save();
  X.globalAlpha = 0.5;
  X.font = '7px monospace'; X.fillStyle = '#006688';
  X.fillText(`DEPTH: ${depthM}m`, 12, 20);
  X.globalAlpha = 0.3 + Math.sin(t * 0.0015) * 0.07;
  X.font = '8px monospace'; X.fillStyle = '#004455';
  X.fillText('✦ THE DEEP ✦', 12, 36);
  X.globalAlpha = 0.35;
  X.font = '6px monospace'; X.fillStyle = '#003344';
  X.fillText(zoneName, 12, 52);
  if (deaths > 0) {
    X.globalAlpha = 0.3;
    X.fillStyle = '#442244';
    X.fillText(`DISSOLUTIONS: ${deaths}`, CW - 120, 20);
  }
  X.globalAlpha = 0.25;
  X.font = '5px monospace'; X.fillStyle = '#003344'; X.textAlign = 'center';
  X.fillText('ARROW KEYS: SWIM   SHIFT: FAST   SPACE: INTERACT   ↑ AT TOP: RETURN', CW / 2, CH - 8);
  X.textAlign = 'left';
  X.restore();
}

// ── Death overlay ─────────────────────────────────────────

function drawDeathOverlay(realm, t) {
  if (!realm.health.isDying) return;
  const elapsed = realm.health.deathElapsed;
  if (elapsed < 200) return;
  const textAlpha = Math.min(1, (elapsed - 200) / 1200);
  X.save();
  X.globalAlpha = Math.min(0.96, elapsed / 2200);
  X.fillStyle = '#000000';
  X.fillRect(0, 0, CW, CH);
  X.globalAlpha = textAlpha;
  X.textAlign = 'center';
  const lines = realm.health.deathMsg.split('\n');
  const startY = CH / 2 - lines.length * 10;
  lines.forEach((line, i) => {
    if (i === 0) { X.font = 'bold 10px monospace'; X.fillStyle = '#002244'; }
    else         { X.font = '8px monospace'; X.fillStyle = '#001a30'; }
    X.fillText(line, CW / 2, startY + i * 20);
  });
  X.textAlign = 'left';
  X.restore();
}

// ── Immunity flash ────────────────────────────────────────

function drawImmunityFlash(realm) {
  const remaining = realm.health._immuneUntil - Date.now();
  if (remaining <= 0) return;
  X.save();
  X.globalAlpha = Math.max(0, (remaining / 2000) * 0.12);
  X.fillStyle = '#001122';
  X.fillRect(0, 0, CW, CH);
  X.restore();
}

// ── Main draw entry ───────────────────────────────────────

export function drawDeep(realm) {
  const t    = Date.now();
  const camX = realm.camX;
  const camY = realm.camY;

  drawWaterBg(camY);
  drawZoneAtmosphere(camY);

  // World-space objects
  X.save();
  X.translate(-camX, -camY);

  drawDebris(t);
  drawShelf(t);
  drawFranchiseOffice(t);
  drawPelagic(t);
  drawAbyss(t);
  drawBioglints(t);

  X.restore();

  // Enemies (screen-space from world coords)
  if (realm.anglers) realm.anglers.forEach(a => drawAngler(a, camX, camY, t));
  drawLeviathan(realm, camX, camY, t);

  // Surface
  drawDeepSurface(camX, camY);

  // Player
  drawDeepSwimmer(realm);

  // Overlays
  drawInteractHint(realm);
  drawDeepHUD(realm);
  drawExitPrompt(realm);
  drawImmunityFlash(realm);
  drawDeathOverlay(realm, t);
}
