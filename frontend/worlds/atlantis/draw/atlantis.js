// ── FILE: worlds/atlantis/draw/atlantis.js ───────────────
// Underwater Atlantis — sunken city of the alternative deep.
// Called as drawAtlantis(realm) once per frame.

import { X, CW, CH }   from '../../../engine/canvas.js';
import { G }            from '../../../game/state.js';
import {
  ATLANTIS_WORLD_W, ATLANTIS_WORLD_H,
  ATLANTIS_FLOOR_Y, ATLANTIS_EXIT_Y,
} from '../constants.js';

// ── Deterministic pseudo-random seeded at startup ────────
const _seed = (() => {
  let s = 0xA71305;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 0) / 0xffffffff; };
})();
const _r = _seed;

// ── Pre-generated scene geometry ─────────────────────────

// Columns: { wx, baseY, height, radius, lean }
const COLUMNS = (() => {
  const cols = [];
  const positions = [
    180, 340, 520, 700, 820, 1000, 1160, 1380, 1520, 1700,
    1860, 2020, 2180, 2360, 2520, 2680
  ];
  for (let i = 0; i < positions.length; i++) {
    const h = 80 + Math.floor(_r() * 140);
    cols.push({
      wx:     positions[i],
      baseY:  ATLANTIS_FLOOR_Y,
      height: h,
      radius: 10 + Math.floor(_r() * 8),
      lean:   (_r() - 0.5) * 0.06,
      broken: _r() > 0.55,
      breakAt: 0.4 + _r() * 0.45,
    });
  }
  return cols;
})();

// Arches: { wx, baseY, span, height } — connecting pairs of columns
const ARCHES = (() => {
  const a = [];
  for (let i = 0; i < COLUMNS.length - 2; i += 3) {
    const c1 = COLUMNS[i];
    const c2 = COLUMNS[i + 2];
    if (c2 && !c1.broken && !c2.broken) {
      a.push({ wx1: c1.wx, wx2: c2.wx, baseY: ATLANTIS_FLOOR_Y - Math.min(c1.height, c2.height) });
    }
  }
  return a;
})();

// Scattered rubble: { wx, wy, w, h, angle }
const RUBBLE = (() => {
  const r = [];
  for (let i = 0; i < 60; i++) {
    r.push({
      wx:    20 + Math.floor(_r() * (ATLANTIS_WORLD_W - 40)),
      wy:    ATLANTIS_FLOOR_Y - Math.floor(_r() * 30),
      w:     12 + Math.floor(_r() * 40),
      h:     6 + Math.floor(_r() * 16),
      angle: (_r() - 0.5) * 1.2,
    });
  }
  return r;
})();

// Coral clusters: { wx, wy, branches, col }
const CORAL = (() => {
  const cs = [];
  const colors = ['#ff6688', '#ff4499', '#cc3366', '#ee8844', '#dd5599'];
  for (let i = 0; i < 35; i++) {
    cs.push({
      wx:      30 + Math.floor(_r() * (ATLANTIS_WORLD_W - 60)),
      wy:      ATLANTIS_FLOOR_Y - 2,
      branches: 2 + Math.floor(_r() * 4),
      col:     colors[Math.floor(_r() * colors.length)],
      h:       20 + Math.floor(_r() * 50),
    });
  }
  return cs;
})();

// Bioluminescent plants: { wx, wy, col, phase }
const BIOLUM = (() => {
  const b = [];
  const cols = ['#00ffe0', '#00ccff', '#88ffcc', '#66aaff', '#aaffee'];
  for (let i = 0; i < 50; i++) {
    b.push({
      wx:    10 + Math.floor(_r() * (ATLANTIS_WORLD_W - 20)),
      wy:    ATLANTIS_FLOOR_Y - 5,
      h:     15 + Math.floor(_r() * 45),
      col:   cols[Math.floor(_r() * cols.length)],
      phase: _r() * Math.PI * 2,
    });
  }
  return b;
})();

// Fish: { wx, wy, dir, speed, col, size, phase }
const FISH = (() => {
  const f = [];
  const cols = ['#ffdd88', '#88ddff', '#ff9966', '#aaff88', '#ffffff'];
  for (let i = 0; i < 24; i++) {
    f.push({
      wx:    Math.floor(_r() * ATLANTIS_WORLD_W),
      wy:    100 + Math.floor(_r() * (ATLANTIS_FLOOR_Y - 200)),
      dir:   _r() > 0.5 ? 1 : -1,
      speed: 0.4 + _r() * 1.2,
      col:   cols[Math.floor(_r() * cols.length)],
      size:  4 + Math.floor(_r() * 10),
      phase: _r() * Math.PI * 2,
    });
  }
  return f;
})();

// Buildings (large sunken structure blocks)
const BUILDINGS = [
  { wx: 60,   wy: ATLANTIS_FLOOR_Y - 120, w: 180, h: 120 },
  { wx: 620,  wy: ATLANTIS_FLOOR_Y - 200, w: 260, h: 200 },
  { wx: 1100, wy: ATLANTIS_FLOOR_Y - 90,  w: 140, h: 90 },
  { wx: 1480, wy: ATLANTIS_FLOOR_Y - 240, w: 320, h: 240 },  // temple
  { wx: 1900, wy: ATLANTIS_FLOOR_Y - 110, w: 200, h: 110 },
  { wx: 2300, wy: ATLANTIS_FLOOR_Y - 160, w: 220, h: 160 },
];

// Inscriptions: { wx, wy, text }
const INSCRIPTIONS = [
  { wx: 650,  wy: ATLANTIS_FLOOR_Y - 210, text: '𓂀 ATLAS BUILT THIS CITY 𓂀' },
  { wx: 1500, wy: ATLANTIS_FLOOR_Y - 250, text: '𓇳 POSEIDON DROWNED IT  𓇳' },
  { wx: 1900, wy: ATLANTIS_FLOOR_Y - 120, text: '𓋴 WE BUILT TOO HIGH     𓋴' },
  { wx: 2300, wy: ATLANTIS_FLOOR_Y - 170, text: '𓊪 AS ABOVE, SO BELOW    𓊪' },
];

// ── Bubbles (screen-space, constantly rising) ─────────────
const BUBBLES = Array.from({ length: 18 }, (_, i) => ({
  x: Math.floor(Math.random() * CW),
  y: Math.floor(Math.random() * CH),
  r: 1 + Math.floor(Math.random() * 3),
  speed: 0.3 + Math.random() * 0.6,
  phase: Math.random() * Math.PI * 2,
}));

// ── Water background ──────────────────────────────────────

function drawWaterBg(camY) {
  // Deep ocean gradient — darker with depth
  const depthFrac = Math.min(1, camY / ATLANTIS_WORLD_H);
  const r0 = Math.round(0x00 + (0x00 - 0x00) * depthFrac);
  const g0 = Math.round(0x18 + (0x06 - 0x18) * depthFrac);
  const b0 = Math.round(0x40 + (0x12 - 0x40) * depthFrac);
  const r1 = Math.round(0x00);
  const g1 = Math.round(0x08);
  const b1 = Math.round(0x1a);

  const bg = X.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, `rgb(${r0},${g0},${b0})`);
  bg.addColorStop(1, `rgb(${r1},${g1},${b1})`);
  X.fillStyle = bg;
  X.fillRect(0, 0, CW, CH);
}

// ── Caustic light patterns (screen-space) ─────────────────

function drawCaustics(t) {
  X.save();
  X.globalAlpha = 0.04;
  X.strokeStyle = '#88ddff';
  X.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const cx = (i * 83 + t * 0.015) % (CW + 80) - 40;
    const cy = (i * 47 + t * 0.008 + Math.sin(t * 0.0012 + i) * 30) % (CH + 40);
    const r  = 15 + Math.sin(t * 0.002 + i * 0.8) * 10;
    X.beginPath();
    X.arc(cx, cy, r, 0, Math.PI * 2);
    X.stroke();
  }
  X.globalAlpha = 0.035;
  for (let i = 0; i < 8; i++) {
    const cx = ((i * 120 + t * 0.022) % (CW + 60)) - 30;
    const cy = ((i * 65 + t * 0.011) % (CH + 40)) - 20;
    const r  = 25 + Math.sin(t * 0.003 + i * 1.3) * 14;
    X.beginPath();
    X.arc(cx, cy, r, 0, Math.PI * 2);
    X.stroke();
  }
  X.globalAlpha = 1;
  X.restore();
}

// ── Floating particles (world-space sediment) ─────────────

function drawSediment(t, camX, camY) {
  X.save();
  X.translate(-camX, -camY);
  X.fillStyle = '#aaddcc';
  for (let i = 0; i < 40; i++) {
    const wx = (i * 317 + t * 0.018) % ATLANTIS_WORLD_W;
    const wy = (i * 213 + t * 0.012 + Math.sin(t * 0.001 + i) * 20) % ATLANTIS_FLOOR_Y;
    const a  = 0.04 + Math.sin(t * 0.0015 + i * 0.5) * 0.03;
    X.globalAlpha = a;
    X.fillRect(Math.round(wx), Math.round(wy), 1, 1);
  }
  X.globalAlpha = 1;
  X.restore();
}

// ── Ocean floor ───────────────────────────────────────────

function drawFloor(worldW) {
  // Sandy silt floor
  const fg = X.createLinearGradient(0, ATLANTIS_FLOOR_Y, 0, ATLANTIS_FLOOR_Y + 60);
  fg.addColorStop(0, '#1a3a4a');
  fg.addColorStop(0.4, '#0e2030');
  fg.addColorStop(1, '#060d14');
  X.fillStyle = fg;
  X.fillRect(0, ATLANTIS_FLOOR_Y, worldW, 100);

  // Floor texture
  X.fillStyle = '#1e3a44';
  for (let i = 0; i < 600; i++) {
    const gx = (i * 37) % worldW;
    const gy = ATLANTIS_FLOOR_Y + ((i * 13) % 28);
    X.fillRect(gx, gy, 2, 1);
  }
}

// ── Sunken buildings ──────────────────────────────────────

function drawBuildings() {
  for (const b of BUILDINGS) {
    // Shadow
    X.save();
    X.globalAlpha = 0.25;
    X.fillStyle = '#000';
    X.fillRect(b.wx + 4, b.wy + 4, b.w, b.h);
    X.restore();

    // Wall face
    const wg = X.createLinearGradient(b.wx, b.wy, b.wx, b.wy + b.h);
    wg.addColorStop(0, '#1e4060');
    wg.addColorStop(0.5, '#163048');
    wg.addColorStop(1, '#0e1e2e');
    X.fillStyle = wg;
    X.fillRect(b.wx, b.wy, b.w, b.h);

    // Stone texture lines
    X.save();
    X.strokeStyle = '#0c2030';
    X.lineWidth = 1;
    X.globalAlpha = 0.5;
    for (let row = 0; row < b.h; row += 16) {
      X.beginPath();
      X.moveTo(b.wx, b.wy + row);
      X.lineTo(b.wx + b.w, b.wy + row);
      X.stroke();
    }
    for (let col = 0; col < b.w; col += 24) {
      X.beginPath();
      X.moveTo(b.wx + col, b.wy);
      X.lineTo(b.wx + col, b.wy + b.h);
      X.stroke();
    }
    X.restore();

    // Algae on top
    X.save();
    X.globalAlpha = 0.35;
    X.fillStyle = '#1a5520';
    X.fillRect(b.wx, b.wy, b.w, 4);
    X.restore();
  }
}

// ── Columns ───────────────────────────────────────────────

function drawColumns() {
  for (const col of COLUMNS) {
    const topY = col.baseY - col.height;
    const r    = col.radius;

    X.save();
    if (col.lean !== 0) {
      X.translate(col.wx, col.baseY);
      X.rotate(col.lean);
      X.translate(-col.wx, -col.baseY);
    }

    if (col.broken) {
      const breakY = col.baseY - col.height * col.breakAt;
      // Bottom stump
      const cg1 = X.createLinearGradient(col.wx - r, 0, col.wx + r, 0);
      cg1.addColorStop(0, '#1a3850'); cg1.addColorStop(0.5, '#2a5070'); cg1.addColorStop(1, '#1a3850');
      X.fillStyle = cg1;
      X.fillRect(col.wx - r, breakY, r * 2, col.height * col.breakAt);

      // Cap on stump (rough break)
      X.fillStyle = '#3a6080';
      X.fillRect(col.wx - r, breakY - 4, r * 2, 4);

      // Fallen top piece (leaning on ground nearby)
      X.save();
      X.translate(col.wx + r * 3, col.baseY - 6);
      X.rotate(Math.PI / 2 + 0.2);
      const cg2 = X.createLinearGradient(-r, 0, r, 0);
      cg2.addColorStop(0, '#1a3850'); cg2.addColorStop(0.5, '#2a5070'); cg2.addColorStop(1, '#1a3850');
      X.fillStyle = cg2;
      X.fillRect(-r, 0, r * 2, col.height * (1 - col.breakAt));
      X.restore();
    } else {
      // Full column
      const cg = X.createLinearGradient(col.wx - r, 0, col.wx + r, 0);
      cg.addColorStop(0, '#1a3850'); cg.addColorStop(0.5, '#2a5070'); cg.addColorStop(1, '#1a3850');
      X.fillStyle = cg;
      X.fillRect(col.wx - r, topY, r * 2, col.height);

      // Capital
      X.fillStyle = '#2a5878';
      X.fillRect(col.wx - r - 4, topY, r * 2 + 8, 10);
      X.fillRect(col.wx - r - 2, topY + 10, r * 2 + 4, 4);

      // Base
      X.fillStyle = '#2a5878';
      X.fillRect(col.wx - r - 4, col.baseY - 8, r * 2 + 8, 8);
    }

    X.restore();
  }
}

// ── Arches ────────────────────────────────────────────────

function drawArches() {
  for (const a of ARCHES) {
    const midX  = (a.wx1 + a.wx2) / 2;
    const arcH  = Math.abs(a.wx2 - a.wx1) * 0.35;
    const arcY  = a.baseY;
    X.save();
    X.globalAlpha = 0.8;
    X.strokeStyle = '#2a5878';
    X.lineWidth   = 14;
    X.beginPath();
    X.moveTo(a.wx1, arcY);
    X.quadraticCurveTo(midX, arcY - arcH, a.wx2, arcY);
    X.stroke();
    X.lineWidth = 8;
    X.strokeStyle = '#1a3850';
    X.stroke();
    X.restore();
  }
}

// ── Coral ─────────────────────────────────────────────────

function drawCoral(t) {
  for (const c of CORAL) {
    for (let b = 0; b < c.branches; b++) {
      const angle = -Math.PI / 2 + (b - c.branches / 2 + 0.5) * 0.6;
      const sway  = Math.sin(t * 0.001 + c.wx * 0.01 + b) * 0.04;
      const finalAngle = angle + sway;
      const len   = c.h * (0.6 + b * 0.15);

      X.save();
      X.translate(c.wx, c.wy);
      X.strokeStyle = c.col;
      X.lineWidth   = 3 - b * 0.3;
      X.globalAlpha = 0.8;
      X.beginPath();
      X.moveTo(0, 0);
      X.lineTo(
        Math.cos(finalAngle) * len,
        Math.sin(finalAngle) * len
      );
      X.stroke();

      // Branch tips
      const tx = Math.cos(finalAngle) * len;
      const ty = Math.sin(finalAngle) * len;
      for (let t2 = 0; t2 < 2; t2++) {
        const ta = finalAngle + (t2 === 0 ? 0.3 : -0.3);
        X.beginPath();
        X.moveTo(tx, ty);
        X.lineTo(tx + Math.cos(ta) * len * 0.4, ty + Math.sin(ta) * len * 0.4);
        X.stroke();
      }
      X.restore();
    }
  }
  X.globalAlpha = 1;
}

// ── Bioluminescent plants ─────────────────────────────────

function drawBiolum(t) {
  for (const b of BIOLUM) {
    const sway  = Math.sin(t * 0.0012 + b.phase) * 5;
    const pulse = 0.4 + Math.sin(t * 0.002 + b.phase) * 0.25;
    X.save();
    X.globalAlpha = pulse;
    X.strokeStyle = b.col;
    X.lineWidth   = 2;
    X.shadowColor = b.col;
    X.shadowBlur  = 8;
    X.beginPath();
    X.moveTo(b.wx, b.wy);
    X.quadraticCurveTo(b.wx + sway, b.wy - b.h / 2, b.wx + sway * 1.5, b.wy - b.h);
    X.stroke();

    // Glow dot at tip
    X.globalAlpha = pulse * 0.7;
    X.fillStyle = b.col;
    X.beginPath();
    X.arc(b.wx + sway * 1.5, b.wy - b.h, 3, 0, Math.PI * 2);
    X.fill();
    X.restore();
  }
  X.shadowBlur = 0;
}

// ── Rubble ────────────────────────────────────────────────

function drawRubble() {
  for (const r of RUBBLE) {
    X.save();
    X.translate(r.wx, r.wy);
    X.rotate(r.angle);
    X.fillStyle = '#1a3a50';
    X.fillRect(-r.w / 2, -r.h / 2, r.w, r.h);
    X.strokeStyle = '#0e2030';
    X.lineWidth = 1;
    X.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
    X.restore();
  }
}

// ── Inscriptions ──────────────────────────────────────────

function drawInscriptions(t) {
  for (const ins of INSCRIPTIONS) {
    const pulse = 0.55 + Math.sin(t * 0.001 + ins.wx * 0.002) * 0.2;
    X.save();
    X.globalAlpha = pulse;
    X.font        = '8px monospace';
    X.fillStyle   = '#66ccaa';
    X.shadowColor = '#00ffcc';
    X.shadowBlur  = 6;
    X.fillText(ins.text, ins.wx, ins.wy);
    X.restore();
  }
  X.shadowBlur = 0;
}

// ── Fish ──────────────────────────────────────────────────

function drawFish(t) {
  for (const f of FISH) {
    // Move fish (wrap around world)
    f.wx += f.dir * f.speed;
    if (f.wx > ATLANTIS_WORLD_W + 50) f.wx = -50;
    if (f.wx < -50) f.wx = ATLANTIS_WORLD_W + 50;

    const bob = Math.sin(t * 0.002 + f.phase) * 4;
    const sx  = Math.round(f.wx);
    const sy  = Math.round(f.wy + bob);

    X.save();
    X.translate(sx, sy);
    if (f.dir === -1) X.scale(-1, 1);

    X.fillStyle   = f.col;
    X.globalAlpha = 0.75;

    // Body
    X.beginPath();
    X.ellipse(0, 0, f.size, f.size * 0.55, 0, 0, Math.PI * 2);
    X.fill();

    // Tail
    X.beginPath();
    X.moveTo(-f.size, 0);
    X.lineTo(-f.size - f.size * 0.7, -f.size * 0.5);
    X.lineTo(-f.size - f.size * 0.7,  f.size * 0.5);
    X.closePath();
    X.fill();

    // Eye
    X.fillStyle   = '#000';
    X.globalAlpha = 0.9;
    X.beginPath();
    X.arc(f.size * 0.5, -f.size * 0.1, f.size * 0.18, 0, Math.PI * 2);
    X.fill();

    X.restore();
  }
  X.globalAlpha = 1;
}

// ── Bubbles (screen-space) ────────────────────────────────

function drawBubbles(t) {
  X.save();
  for (const b of BUBBLES) {
    b.y -= b.speed;
    if (b.y < -10) {
      b.y = CH + 10;
      b.x = Math.floor(Math.random() * CW);
    }
    const sway = Math.sin(t * 0.001 + b.phase) * 3;
    X.globalAlpha = 0.18;
    X.strokeStyle = '#aaeeff';
    X.lineWidth   = 1;
    X.beginPath();
    X.arc(b.x + sway, b.y, b.r, 0, Math.PI * 2);
    X.stroke();
  }
  X.restore();
}

// ── Player (swimming pharaoh) ─────────────────────────────

function drawSwimmingPharaoh(realm) {
  if (!G.bought) return;

  const sx  = Math.round(realm.px - realm.camX);
  const sy  = Math.round(realm.py - realm.camY);
  const t   = Date.now();
  const bob = Math.sin(t / 400) * 1.5;

  // Tilt in direction of movement
  const tiltX   = realm.pvx * 0.03;
  const tiltY   = realm.pvy * 0.015;
  const tilt    = Math.atan2(realm.pvy, Math.abs(realm.pvx) + 0.01) * 0.25;
  const facing  = realm.pvx < -0.3 ? -1 : 1;
  const swimming = Math.abs(realm.pvx) + Math.abs(realm.pvy) > 0.5;

  // Draw bubbles trailing behind player
  if (swimming && t % 3 === 0) {
    // tiny bubble trail
  }

  X.save();
  X.translate(sx, sy + bob);
  X.rotate(tilt);
  if (facing === -1) X.scale(-1, 1);

  // Shadow glow
  X.save();
  X.globalAlpha = 0.2;
  const sg = X.createRadialGradient(0, 0, 2, 0, 0, 28);
  sg.addColorStop(0, '#00ffcc');
  sg.addColorStop(1, 'transparent');
  X.fillStyle = sg;
  X.beginPath();
  X.arc(0, 0, 28, 0, Math.PI * 2);
  X.fill();
  X.restore();

  // Body (simplified horizontal swimmer)
  const fr = swimming && Math.floor(t / 200) % 2;

  // Torso
  X.fillStyle = '#c8b060';  // golden robe
  X.fillRect(-14, -8, 28, 16);
  // Head
  X.fillStyle = '#1a60a0';  // headdress
  X.fillRect(-8, -20, 16, 14);
  X.fillStyle = '#e8c878';  // face
  X.fillRect(-6, -18, 12, 10);
  // Gold collar
  X.fillStyle = '#e8c060';
  X.fillRect(-14, -8, 28, 5);
  // Legs (kicking)
  X.fillStyle = '#e0e0e0';
  if (fr) {
    X.fillRect(12, -4, 12, 6);
    X.fillRect(12, 4, 10, 5);
  } else {
    X.fillRect(12, -6, 10, 5);
    X.fillRect(12, 2, 12, 6);
  }
  // Arms (reaching forward)
  X.fillStyle = '#c8b060';
  X.fillRect(14, -10, 14, 5);

  // Eyes
  X.fillStyle = '#000';
  X.fillRect(-4, -16, 2, 2);
  X.fillRect(2, -16, 2, 2);

  X.restore();
}

// ── Surface shimmer (top of world) ───────────────────────

function drawSurface(camX, camY) {
  // Surface is at y=0 in world space — sy in screen space = -camY
  const surfaceScreenY = -camY;
  if (surfaceScreenY < -30 || surfaceScreenY > CH + 30) return;

  X.save();
  const sg = X.createLinearGradient(0, surfaceScreenY, 0, surfaceScreenY + 30);
  sg.addColorStop(0, 'rgba(100,200,240,0.5)');
  sg.addColorStop(1, 'rgba(20,40,80,0)');
  X.fillStyle = sg;
  X.fillRect(0, surfaceScreenY, CW, 30);

  // Ripple lines
  X.strokeStyle = 'rgba(160,230,255,0.4)';
  X.lineWidth   = 1;
  const t = Date.now();
  for (let i = 0; i < 8; i++) {
    const rx = ((i * 140 + camX * 0.3 + t * 0.02) % (CW + 80)) - 40;
    X.beginPath();
    X.moveTo(rx, surfaceScreenY + 4);
    X.quadraticCurveTo(rx + 30, surfaceScreenY + 8, rx + 60, surfaceScreenY + 4);
    X.stroke();
  }
  X.restore();
}

// ── Exit prompt ───────────────────────────────────────────

function drawExitPrompt(realm) {
  // Show when near the surface
  if (realm.py > ATLANTIS_EXIT_Y + 50) return;
  const alpha = Math.max(0, 1 - realm.py / (ATLANTIS_EXIT_Y + 50));
  const t = Date.now();
  X.save();
  X.globalAlpha = alpha * (0.7 + Math.sin(t * 0.005) * 0.2);
  X.font        = 'bold 11px monospace';
  X.fillStyle   = '#aaeeff';
  X.textAlign   = 'center';
  X.fillText('[↑] SURFACE — RETURN TO THE OASIS', CW / 2, 40);
  X.restore();
  X.textAlign = 'left';
}

// ── Depth indicator ───────────────────────────────────────

function drawDepthHUD(realm) {
  const depthM = Math.max(0, Math.round((realm.py - ATLANTIS_EXIT_Y) / 8));
  const t      = Date.now();
  X.save();
  X.globalAlpha = 0.55;
  X.font        = '8px monospace';
  X.fillStyle   = '#aaeeff';
  X.fillText(`DEPTH: ${depthM}m`, 12, 20);

  // Realm name
  X.globalAlpha = 0.4 + Math.sin(t * 0.002) * 0.1;
  X.font        = '9px monospace';
  X.fillStyle   = '#66ccaa';
  X.fillText('✦ THE LOST CITY OF ATLANTIS ✦', 12, 36);
  X.restore();
}

// ── Main draw entry ───────────────────────────────────────

export function drawAtlantis(realm) {
  const t    = Date.now();
  const camX = realm.camX;
  const camY = realm.camY;

  // 1. Background
  drawWaterBg(camY);

  // 2. Caustic shimmer (screen-space)
  drawCaustics(t);

  // 3. Surface layer
  drawSurface(camX, camY);

  // 4. World-space objects
  X.save();
  X.translate(-camX, -camY);

  drawFloor(ATLANTIS_WORLD_W);
  drawBuildings();
  drawArches();
  drawRubble();
  drawColumns();
  drawInscriptions(t);
  drawCoral(t);
  drawBiolum(t);
  drawFish(t);

  X.restore();

  // 5. Sediment (world-space)
  drawSediment(t, camX, camY);

  // 6. Bubbles (screen-space)
  drawBubbles(t);

  // 7. Player
  drawSwimmingPharaoh(realm);

  // 8. HUD overlays
  drawDepthHUD(realm);
  drawExitPrompt(realm);
}
