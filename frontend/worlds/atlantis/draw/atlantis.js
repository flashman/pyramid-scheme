// ── FILE: worlds/atlantis/draw/atlantis.js ───────────────
// Underwater Atlantis — the drowned org chart.
// Five zones of increasing cult depth. Three kinds of death.
// Called as drawAtlantis(realm) once per frame.

import { X, CW, CH }   from '../../../engine/canvas.js';
import { G }            from '../../../game/state.js';
import { Flags }        from '../../../engine/flags.js';
import {
  ATLANTIS_WORLD_W, ATLANTIS_WORLD_H,
  ATLANTIS_FLOOR_Y, ATLANTIS_EXIT_Y,
  ZONE_1_END, ZONE_2_END, ZONE_3_END, ZONE_4_END,
  GREETER_WX, GREETER_WY, PILLAR_WX, PILLAR_WY,
  TESTIMONIALS,
  CHAIR_WX, CHAIR_WY,
  ARCHIVE_DOOR_WX, ARCHIVE_DOOR_WY, ARCHIVE_TABLETS,
  FOUNDER_WX, FOUNDER_WY, TABLET_WX, TABLET_WY,
  CHOIR_WX, CHOIR_WY, CHOIR_RADIUS,
  NAME_TABLET_WX, NAME_TABLET_WY,
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

// ── Zone colour atmosphere (screen-space overlay) ─────────

function drawZoneAtmosphere(camY) {
  const midY = camY + CH / 2; // world Y at screen centre

  // Each zone has a faint coloured haze that bleeds in
  let col = null, alpha = 0;

  if (midY < ZONE_1_END) {
    // Zone 1: cold recruitment blue-white — welcoming, false
    col = '#88ccff'; alpha = 0.04;
  } else if (midY < ZONE_2_END) {
    // Zone 2: false gold — abundance that isn't
    const t = (midY - ZONE_1_END) / (ZONE_2_END - ZONE_1_END);
    col = '#c8a020'; alpha = 0.06 * t;
  } else if (midY < ZONE_3_END) {
    // Zone 3: processing sickly green
    const t = (midY - ZONE_2_END) / (ZONE_3_END - ZONE_2_END);
    col = '#204a10'; alpha = 0.07 * t;
  } else if (midY < ZONE_4_END) {
    // Zone 4: devoted crimson
    const t = (midY - ZONE_3_END) / (ZONE_4_END - ZONE_3_END);
    col = '#5a0808'; alpha = 0.09 * t;
  } else {
    // Zone 5: founder's void — near black, deep purple
    const t = Math.min(1, (midY - ZONE_4_END) / 300);
    col = '#1a0020'; alpha = 0.18 * t;
  }

  if (col && alpha > 0) {
    X.save();
    X.globalAlpha = alpha;
    X.fillStyle   = col;
    X.fillRect(0, 0, CW, CH);
    X.restore();
  }
}

// ── Zone 1: The Atrium ────────────────────────────────────
// Ruins of the welcome level. A reception desk. A pillar.
// Everything too well-preserved to be comforting.

function drawAtrium(t) {
  const TEAL = '#2a6888';
  const TEAL_LT = '#3a8aaa';
  const TEAL_DK = '#183a4a';

  // Welcome Archway above the greeter
  const ax = GREETER_WX - 10;
  const ay = GREETER_WY - 90;
  const aW = 120;
  X.save();
  X.globalAlpha = 0.85;
  // Arch uprights
  X.fillStyle = TEAL;
  X.fillRect(ax, ay, 12, 90);
  X.fillRect(ax + aW - 12, ay, 12, 90);
  // Arch keystone curve
  X.strokeStyle = TEAL_LT;
  X.lineWidth   = 12;
  X.beginPath();
  X.arc(ax + aW / 2, ay + 8, aW / 2 - 6, Math.PI, 0, false);
  X.stroke();
  X.lineWidth = 6;
  X.strokeStyle = TEAL_DK;
  X.stroke();
  // Arch inscription
  X.globalAlpha = 0.5;
  X.font = '5px monospace';
  X.fillStyle = '#aaddcc';
  X.textAlign = 'center';
  X.fillText('WELCOME TO TIER 1', ax + aW / 2, ay - 8);
  X.fillText('THE SURFACE IS FOR THE UNINITIATED', ax + aW / 2, ay - 2);
  X.textAlign = 'left';
  X.restore();

  // Reception desk
  const dx = GREETER_WX - 40;
  const dy = GREETER_WY - 24;
  X.save();
  X.fillStyle = TEAL_DK;
  X.fillRect(dx, dy, 80, 24);
  X.fillStyle = TEAL;
  X.fillRect(dx, dy, 80, 6);
  // Stone ledge / counter top
  X.fillStyle = '#2a5070';
  X.fillRect(dx - 4, dy - 4, 88, 8);
  // Stacks of "applications" on the desk
  X.fillStyle = '#1a3040';
  for (let i = 0; i < 4; i++) {
    X.fillRect(dx + 10 + i * 4, dy - 16 - i * 2, 18, 14 + i * 2);
  }
  // Greeter NPC — skeletal figure behind desk
  const gx = GREETER_WX;
  const gy = GREETER_WY - 24;
  X.fillStyle = '#d4c89a'; // bone colour
  X.fillRect(gx - 6, gy - 32, 12, 28); // torso
  X.fillRect(gx - 4, gy - 46, 8, 16);  // skull
  // Outstretched welcoming arm
  const armSway = Math.sin(t / 1200) * 0.08;
  X.save();
  X.translate(gx + 6, gy - 26);
  X.rotate(armSway - 0.3);
  X.fillRect(0, -2, 24, 4);
  X.restore();
  // Eye sockets (empty, friendly, wrong)
  X.fillStyle = '#0a0a14';
  X.fillRect(gx - 3, gy - 44, 3, 3);
  X.fillRect(gx + 1, gy - 44, 3, 3);
  // Small glow pips in eyes — the enthusiasm never left
  X.fillStyle = '#aaffcc';
  X.globalAlpha = 0.5 + Math.sin(t / 400) * 0.3;
  X.fillRect(gx - 2, gy - 43, 1, 1);
  X.fillRect(gx + 2, gy - 43, 1, 1);
  X.restore();

  // Welcome Pillar — standing carved monolith
  const px = PILLAR_WX;
  const py = PILLAR_WY;
  X.save();
  const sway = Math.sin(t / 3000) * 0.004;
  X.translate(px, py + 10);
  X.rotate(sway);
  X.translate(-px, -(py + 10));
  // Pillar body
  const pg = X.createLinearGradient(px - 10, 0, px + 10, 0);
  pg.addColorStop(0, TEAL_DK);
  pg.addColorStop(0.5, TEAL);
  pg.addColorStop(1, TEAL_DK);
  X.fillStyle = pg;
  X.fillRect(px - 10, py - 80, 20, 90);
  // Pillar capital
  X.fillStyle = TEAL_LT;
  X.fillRect(px - 14, py - 84, 28, 8);
  // Carved text
  X.globalAlpha = 0.55;
  X.font = '4px monospace';
  X.fillStyle = '#88ccaa';
  X.textAlign = 'center';
  X.fillText('THIS IS NOT A', px, py - 58);
  X.fillText('PYRAMID SCHEME', px, py - 50);
  X.fillText('─────────────', px, py - 44);
  X.fillText('THE PYRAMID IS', px, py - 36);
  X.fillText('A SYMBOL', px, py - 28);
  X.fillText('THE SCHEME', px, py - 20);
  X.fillText('IS THE PATH', px, py - 12);
  X.textAlign = 'left';
  X.restore();
}

// ── Zone 2: The Abundance Hall ────────────────────────────
// False gold. Columns painted to look like gold.
// You can see the paint flaking from here.

function drawAbundanceHall(t) {
  const FAKE_GOLD  = '#c8a020';
  const FAKE_GOLD2 = '#a07810';
  const STONE_BASE = '#1e3a50';

  // Four painted columns at zone 2 depth
  const colPositions = [500, 920, 1480, 1980];
  colPositions.forEach((cx, i) => {
    const cy = ZONE_2_END - 60;
    const ch = 200 + i * 20;
    X.save();
    // Stone base
    X.fillStyle = STONE_BASE;
    X.fillRect(cx - 12, cy - ch, 24, ch);
    // Gold paint (flaking — more gone from higher columns)
    const peelFrac = 0.3 + i * 0.15;
    X.globalAlpha = 1 - peelFrac * 0.4;
    X.fillStyle = FAKE_GOLD;
    X.fillRect(cx - 12, cy - ch, 24, Math.floor(ch * (1 - peelFrac)));
    // Flake patches visible
    X.globalAlpha = 0.6;
    X.fillStyle = STONE_BASE;
    for (let f = 0; f < 4; f++) {
      const fy = cy - ch * 0.6 + f * 28 + (i * 7);
      const fw = 4 + (f * 3);
      X.fillRect(cx - 8 + (f * 5), fy, fw, 6);
    }
    X.restore();
  });

  // The Abundance Zone archway — collapsed, but you can still read the label
  const archX = 1300;
  const archY = ZONE_1_END + 200;
  X.save();
  // Left upright — still standing
  X.fillStyle = '#2a5070';
  X.fillRect(archX - 60, archY - 80, 16, 80);
  // Right upright — collapsed
  X.translate(archX + 44 + 16, archY - 4);
  X.rotate(0.45);
  X.fillStyle = '#1e3848';
  X.fillRect(0, -80, 16, 80);
  X.setTransform(1, 0, 0, 1, 0, 0);

  // Fallen keystone on the ground
  X.fillStyle = '#2a4a60';
  X.save();
  X.translate(archX + 50, archY - 12);
  X.rotate(0.8);
  X.fillRect(-30, -8, 60, 16);
  X.restore();

  // Inscription on the left upright
  X.globalAlpha = 0.5;
  X.font = '4px monospace';
  X.fillStyle = '#c8a020';
  X.textAlign = 'center';
  X.fillText('ABUNDANCE', archX - 52, archY - 58);
  X.fillText('ZONE', archX - 52, archY - 50);
  X.textAlign = 'left';
  X.restore();
}

// ── Zone 3: The Processing Chamber ───────────────────────
// Rows of stone chairs. The Auditor face carved at one end.
// Everything is oriented toward The Auditor.

function drawProcessingChamber(t) {
  const chairY = ZONE_2_END + 180;  // ~1000
  const STONE = '#1a3040';
  const STONE_LT = '#2a4a60';

  // Stone chairs in rows — 2 rows × 8 chairs
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 8; col++) {
      const cx = 520 + col * 220;
      const cy = chairY + row * 80;

      X.save();
      X.fillStyle = STONE;
      // Seat
      X.fillRect(cx - 16, cy - 20, 32, 6);
      // Back
      X.fillRect(cx - 14, cy - 50, 8, 32);
      X.fillRect(cx + 6, cy - 50, 8, 32);
      X.fillRect(cx - 14, cy - 52, 28, 6);
      // Legs
      X.fillRect(cx - 14, cy - 14, 6, 14);
      X.fillRect(cx + 8, cy - 14, 6, 14);
      // Occupant — skeletal figure still seated
      if ((col + row) % 3 !== 2) { // some chairs are empty — they already ascended
        X.fillStyle = '#c0b890'; // pale bone
        // Body slumped toward screen
        X.fillRect(cx - 6, cy - 44, 12, 24);
        X.fillRect(cx - 5, cy - 54, 10, 12); // skull
        // Skeletal hands on armrests — waiting for evaluation
        X.fillRect(cx - 14, cy - 30, 10, 4);
        X.fillRect(cx + 4, cy - 30, 10, 4);
        // Eyes
        X.fillStyle = '#0a0510';
        X.fillRect(cx - 4, cy - 52, 2, 2);
        X.fillRect(cx + 2, cy - 52, 2, 2);
      }
      X.restore();
    }
  }

  // The Auditor Face — carved into an enormous stone wall at the east end
  const faceX = 2420;
  const faceY = ZONE_2_END + 80;
  const fw = 110;
  const fh = 160;

  X.save();
  // Stone wall slab
  X.fillStyle = '#0e1e2e';
  X.fillRect(faceX - fw / 2 - 30, faceY - 10, fw + 60, fh + 40);

  // Face outline — severe, no mouth (auditors don't speak, they process)
  X.globalAlpha = 0.7;
  X.fillStyle = '#1a3040';
  X.fillRect(faceX - fw / 2, faceY, fw, fh);

  // Brow ridge — heavy, oppressive
  X.fillStyle = '#2a4a60';
  X.fillRect(faceX - fw / 2 - 6, faceY + 20, fw + 12, 18);

  // Eye sockets — vast, black, no irises
  const eyeA = 0.7 + Math.sin(t / 1400) * 0.15;
  X.globalAlpha = eyeA;
  X.fillStyle = '#000608';
  X.fillRect(faceX - 38, faceY + 44, 28, 22);
  X.fillRect(faceX + 10, faceY + 44, 28, 22);

  // No mouth — just a horizontal carved indentation
  X.globalAlpha = 0.4;
  X.fillStyle = '#0a1820';
  X.fillRect(faceX - 28, faceY + 100, 56, 8);

  // Inscription above the face
  X.globalAlpha = 0.55;
  X.font = '5px monospace';
  X.fillStyle = '#4a8a6a';
  X.textAlign = 'center';
  X.fillText('THE AUDITOR', faceX, faceY - 4);
  X.fillText('SPEAKS FOR THE SYSTEM', faceX, faceY + 4);
  X.textAlign = 'left';

  // Slight glow from eye sockets — it is processing you
  X.globalAlpha = 0.08 + Math.sin(t / 800) * 0.05;
  const eg = X.createRadialGradient(faceX, faceY + 55, 4, faceX, faceY + 55, 60);
  eg.addColorStop(0, '#004040');
  eg.addColorStop(1, 'transparent');
  X.fillStyle = eg;
  X.fillRect(faceX - 70, faceY + 20, 140, 90);
  X.restore();
}

// ── Zone 4: The Devoted Quarter ───────────────────────────
// Portraits of The Founder everywhere. The circle.
// They gathered here. They sang. The water came. They kept singing.

function drawDevotedQuarter(t) {
  const qY = ZONE_3_END + 80;

  // Founder portrait plaques on every surface
  const plaquePositions = [
    { wx: 300,  wy: qY + 40  },
    { wx: 700,  wy: qY + 90  },
    { wx: 950,  wy: qY + 30  },
    { wx: 1700, wy: qY + 70  },
    { wx: 2000, wy: qY + 40  },
    { wx: 2400, wy: qY + 80  },
  ];

  plaquePositions.forEach(({ wx, wy }) => {
    X.save();
    // Plaque backing
    X.fillStyle = '#1e1020';
    X.fillRect(wx - 22, wy - 38, 44, 50);
    X.fillStyle = '#2e1830';
    X.fillRect(wx - 20, wy - 36, 40, 44);
    // Face (always the same face — The Founder)
    X.fillStyle = '#8a6840';  // skin tone
    X.fillRect(wx - 12, wy - 30, 24, 28);
    // Eyes — certain, serene, terrifying
    X.fillStyle = '#201028';
    X.fillRect(wx - 8,  wy - 24, 5, 5);
    X.fillRect(wx + 3,  wy - 24, 5, 5);
    // Wide fixed smile
    X.fillStyle = '#d09060';
    X.fillRect(wx - 9, wy - 14, 18, 4);
    // Crown / headdress
    X.fillStyle = '#6030a0';
    X.fillRect(wx - 14, wy - 34, 28, 8);
    for (let s = 0; s < 3; s++) {
      X.fillRect(wx - 10 + s * 9, wy - 40, 5, 7);
    }
    // Caption
    X.globalAlpha = 0.55;
    X.font = '4px monospace';
    X.fillStyle = '#8a60aa';
    X.textAlign = 'center';
    X.fillText('FOUNDER', wx, wy + 16);
    X.textAlign = 'left';
    X.restore();
  });

  // The Circle of Devotion — 12 skeletal figures in a ring
  const cx = CHOIR_WX;
  const cy = CHOIR_WY;
  const cr = CHOIR_RADIUS + 20; // figure orbit radius

  X.save();
  // Floor markings — the ritual groove
  X.globalAlpha = 0.3;
  X.strokeStyle = '#4a0820';
  X.lineWidth = 2;
  X.beginPath();
  X.arc(cx, cy, cr, 0, Math.PI * 2);
  X.stroke();
  X.lineWidth = 1;
  X.strokeStyle = '#6a1030';
  X.beginPath();
  X.arc(cx, cy, CHOIR_RADIUS * 0.6, 0, Math.PI * 2);
  X.stroke();
  X.restore();

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const fx = cx + Math.cos(angle) * cr;
    const fy = cy + Math.sin(angle) * cr;
    // Figures face inward (toward centre)
    const facingAngle = angle + Math.PI;

    X.save();
    X.translate(fx, fy);
    X.rotate(facingAngle - Math.PI / 2);

    // Swaying very slightly — still harmonizing
    const sway = Math.sin(t / 1100 + i * 0.52) * 0.04;
    X.rotate(sway);

    X.globalAlpha = 0.75;
    // Torso
    X.fillStyle = '#c0b480';
    X.fillRect(-5, -22, 10, 20);
    // Skull
    X.fillRect(-5, -34, 10, 14);
    // Arms outstretched toward centre — always reaching
    X.fillRect(-22, -24, 18, 4);  // left arm
    X.fillRect(4, -24, 18, 4);    // right arm
    // Eye sockets with faint glow — they're still singing
    X.fillStyle = '#0a0410';
    X.fillRect(-3, -32, 2, 2);
    X.fillRect(1, -32, 2, 2);
    // Subtle glow — devotion persists
    const gA = 0.12 + Math.sin(t / 600 + i) * 0.06;
    X.globalAlpha = gA;
    X.fillStyle = '#cc2244';
    X.fillRect(-3, -31, 2, 1);
    X.fillRect(1, -31, 2, 1);

    X.restore();
  }

  // Glow at the centre of the circle — the harmonizing
  X.save();
  const centreGlow = 0.06 + Math.sin(t / 700) * 0.04;
  X.globalAlpha = centreGlow;
  const cg = X.createRadialGradient(cx, cy, 4, cx, cy, CHOIR_RADIUS);
  cg.addColorStop(0, '#ff1144');
  cg.addColorStop(0.5, '#660020');
  cg.addColorStop(1, 'transparent');
  X.fillStyle = cg;
  X.fillRect(cx - CHOIR_RADIUS - 10, cy - CHOIR_RADIUS - 10,
             CHOIR_RADIUS * 2 + 20, CHOIR_RADIUS * 2 + 20);
  X.restore();
}


// ── Vault crack — entry to The Deep ──────────────────────
// Visible only after atlantis_deepest_tablet is read.
// Pulses with an ancient non-bioluminescent light.

function drawVaultCrack(t) {
  if (!Flags.get('atlantis_crack_visible')) return;

  // Place crack near the tablet but away from the building at wx=620 (w=260, reaches x=880).
  // Use FOUNDER_WX area — open vault floor, no building geometry above it.
  const cx  = FOUNDER_WX - 120;   // 1270 — open floor in the vault
  const cy  = ATLANTIS_FLOOR_Y - 10;
  const pulse = 0.55 + Math.sin(t * 0.0016) * 0.35;

  X.save();

  // Wide upward glow — makes it unmissable when you're in the vault
  const glowGrad = X.createRadialGradient(cx, cy, 4, cx, cy - 40, 110);
  glowGrad.addColorStop(0,   `rgba(120,0,160,${pulse * 0.7})`);
  glowGrad.addColorStop(0.3, `rgba(60,0,90,${pulse * 0.4})`);
  glowGrad.addColorStop(0.7, `rgba(20,0,30,${pulse * 0.15})`);
  glowGrad.addColorStop(1,   'transparent');
  X.fillStyle = glowGrad;
  X.beginPath(); X.ellipse(cx, cy - 20, 110, 70, 0, 0, Math.PI * 2); X.fill();

  // Black void underneath — stone is broken open
  X.fillStyle = '#000000';
  X.beginPath();
  X.ellipse(cx, cy + 2, 52, 6, 0, 0, Math.PI * 2);
  X.fill();

  // Crack lines — thick, clearly visible
  X.strokeStyle = '#110011';
  X.lineWidth = 6;
  X.shadowColor = '#220033';
  X.shadowBlur  = 0;
  X.globalAlpha = 1.0;
  X.beginPath();
  X.moveTo(cx - 60, cy + 1);
  X.lineTo(cx - 32, cy - 3);
  X.lineTo(cx - 10, cy + 4);
  X.lineTo(cx + 8,  cy - 2);
  X.lineTo(cx + 30, cy + 5);
  X.lineTo(cx + 58, cy);
  X.stroke();

  // Secondary crack branch
  X.lineWidth = 3;
  X.beginPath();
  X.moveTo(cx - 10, cy + 4);
  X.lineTo(cx - 18, cy + 16);
  X.moveTo(cx + 8,  cy - 2);
  X.lineTo(cx + 20, cy + 12);
  X.stroke();

  // Purple light bleeding up through crack
  X.globalAlpha = pulse * 0.9;
  X.strokeStyle = '#aa00cc';
  X.lineWidth = 3;
  X.shadowColor = '#dd00ff';
  X.shadowBlur  = 18;
  X.beginPath();
  X.moveTo(cx - 56, cy + 1);
  X.lineTo(cx - 30, cy - 3);
  X.lineTo(cx - 8,  cy + 4);
  X.lineTo(cx + 10, cy - 2);
  X.lineTo(cx + 32, cy + 5);
  X.lineTo(cx + 54, cy);
  X.stroke();

  // Bright hot centre of the crack
  X.globalAlpha = pulse * 0.6;
  X.strokeStyle = '#ff88ff';
  X.lineWidth = 1;
  X.shadowBlur  = 6;
  X.beginPath();
  X.moveTo(cx - 20, cy + 1);
  X.lineTo(cx + 20, cy + 1);
  X.stroke();

  // Label — larger, brighter
  X.shadowBlur  = 0;
  X.globalAlpha = 0.7 + 0.3 * pulse;
  X.font = '7px monospace';
  X.fillStyle = '#cc66ff';
  X.textAlign = 'center';
  X.fillText('[\u2193] THE DEEP', cx, cy - 50);
  X.font = '6px monospace';
  X.fillStyle = '#884499';
  X.fillText('something below', cx, cy - 40);
  X.textAlign = 'left';

  X.restore();
}

// ── Zone 5: The Founder's Vault ───────────────────────────
// The throne. The cage. The tablet.

function drawFounderVault(t) {
  const vx = FOUNDER_WX;
  const vy = FOUNDER_WY;

  // ── Throne room floor ─────────────────────────────────
  X.save();
  X.fillStyle = '#10080e';
  X.fillRect(vx - 140, vy - 100, 280, 110);
  // Floor tiles
  X.fillStyle = '#18101c';
  for (let tx = vx - 130; tx < vx + 130; tx += 20) {
    X.fillRect(tx, vy - 100, 1, 110);
  }
  for (let ty = vy - 80; ty < vy + 10; ty += 20) {
    X.fillRect(vx - 140, ty, 280, 1);
  }
  X.restore();

  // ── The Cage ──────────────────────────────────────────
  const barColor = '#3a2848';
  const barCount = 9;
  const cageW = 120;
  const cageH = 90;
  const cageX = vx - cageW / 2;
  const cageY = vy - cageH - 10;

  X.save();
  X.fillStyle = barColor;
  // Top bar
  X.fillRect(cageX, cageY, cageW, 5);
  // Bottom bar
  X.fillRect(cageX, cageY + cageH - 5, cageW, 5);
  // Vertical bars
  for (let b = 0; b <= barCount; b++) {
    X.fillRect(cageX + b * (cageW / barCount) - 2, cageY, 4, cageH);
  }
  // Lock — on the inside. Notably.
  X.fillStyle = '#5a3868';
  X.fillRect(vx - 4, cageY + cageH - 20, 8, 12);
  X.fillStyle = '#3a2848';
  X.fillRect(vx - 2, cageY + cageH - 18, 4, 4);
  X.restore();

  // ── The Throne ────────────────────────────────────────
  X.save();
  X.fillStyle = '#2a1838';
  // Seat
  X.fillRect(vx - 26, vy - 40, 52, 8);
  // Back (tall, imposing)
  X.fillRect(vx - 24, vy - 88, 48, 52);
  // Arm rests
  X.fillRect(vx - 34, vy - 46, 12, 14);
  X.fillRect(vx + 22, vy - 46, 12, 14);
  // Throne decorations — concentric tier symbols
  X.globalAlpha = 0.35;
  X.fillStyle = '#8a50cc';
  for (let i = 0; i < 3; i++) {
    X.fillRect(vx - 18 + i * 6, vy - 82 + i * 12, 36 - i * 12, 4);
  }
  X.restore();

  // ── The Founder's skeleton on throne ──────────────────
  X.save();
  X.fillStyle = '#d0c49a'; // aged bone
  // Slumped but still regal — they waited
  X.fillRect(vx - 10, vy - 78, 20, 36); // torso
  X.fillRect(vx - 9,  vy - 94, 18, 18); // skull
  // Head slightly tilted — still looking at the door, waiting
  X.translate(vx, vy - 80);
  X.rotate(0.12);
  X.fillRect(-9, -14, 18, 18);
  X.setTransform(1, 0, 0, 1, 0, 0);
  // Arm bones on rests
  X.fillRect(vx - 34, vy - 54, 28, 4);
  X.fillRect(vx + 6, vy - 54, 28, 4);
  // Crown still on skull — the last thing they held onto
  X.fillStyle = '#5a28a0';
  X.fillRect(vx - 12, vy - 97, 24, 6);
  for (let s = 0; s < 3; s++) {
    X.fillRect(vx - 8 + s * 8, vy - 102, 5, 6);
  }
  // Eyes — crown-gem glow
  const eyePulse = 0.4 + Math.sin(t / 1800) * 0.2;
  X.fillStyle = '#aa44ff';
  X.globalAlpha = eyePulse;
  X.fillRect(vx - 6, vy - 90, 3, 3);
  X.fillRect(vx + 3, vy - 90, 3, 3);
  X.restore();

  // ── The Deepest Tablet ────────────────────────────────
  const tx = TABLET_WX;
  const ty = TABLET_WY;
  const tabletRead = Flags.get('atlantis_deepest_tablet') || false;

  X.save();
  // Tablet half-buried in sediment
  X.fillStyle = '#0e1820';
  X.fillRect(tx - 16, ty - 64, 32, 76);
  const tg = X.createLinearGradient(tx - 16, 0, tx + 16, 0);
  tg.addColorStop(0, '#1a2a3a');
  tg.addColorStop(0.5, '#243848');
  tg.addColorStop(1, '#1a2a3a');
  X.fillStyle = tg;
  X.fillRect(tx - 14, ty - 62, 28, 72);

  // Inscription (glows brighter after reading)
  const inscAlpha = tabletRead ? 0.8 : 0.3;
  X.globalAlpha = inscAlpha + Math.sin(t / 1200) * 0.08;
  X.font = '4px monospace';
  X.fillStyle = tabletRead ? '#aaddcc' : '#4a7060';
  X.textAlign = 'center';
  const lines = ['WE DID NOT', 'INVENT THIS.', '────', 'PASS IT ON.'];
  lines.forEach((line, i) => X.fillText(line, tx, ty - 50 + i * 11));
  X.textAlign = 'left';

  if (tabletRead) {
    // Glow aura after reading
    X.globalAlpha = 0.12 + Math.sin(t / 900) * 0.05;
    const rg = X.createRadialGradient(tx, ty - 30, 2, tx, ty - 30, 40);
    rg.addColorStop(0, '#00ffcc');
    rg.addColorStop(1, 'transparent');
    X.fillStyle = rg;
    X.fillRect(tx - 44, ty - 74, 88, 80);
  }
  X.restore();
}

// ── Enemy draw: Compliance Shark ─────────────────────────

function drawShark(shark, camX, camY, t) {
  if (!shark.active) return;
  const sx = Math.round(shark.wx - camX);
  const sy = Math.round(shark.wy - camY);
  if (sx < -80 || sx > CW + 80 || sy < -80 || sy > CH + 80) return;

  const dir     = shark.dir > 0 ? 1 : -1;
  const chasing = shark.chasing;
  const L = chasing ? 52 : 44;  // longer when charging

  X.save();
  X.translate(sx, sy);
  if (dir === -1) X.scale(-1, 1);

  // Glow when chasing
  if (chasing) {
    X.globalAlpha = 0.15;
    const sg = X.createRadialGradient(0, 0, 4, 0, 0, 36);
    sg.addColorStop(0, '#ff2200');
    sg.addColorStop(1, 'transparent');
    X.fillStyle = sg;
    X.fillRect(-38, -32, 76, 64);
  }

  X.globalAlpha = 1;
  // Body — torpedo shape
  X.fillStyle = chasing ? '#606060' : '#7a7a8a';
  X.fillRect(-L / 2, -8, L, 16);
  // Snout taper
  X.fillStyle = chasing ? '#505050' : '#6a6a7a';
  X.fillRect(L / 2 - 6, -5, 10, 10);
  X.fillRect(L / 2 + 2, -3, 6, 6);
  // White underbelly
  X.fillStyle = '#d0d0d8';
  X.fillRect(-L / 2 + 4, 2, L - 12, 6);
  // Dorsal fin
  X.fillStyle = chasing ? '#484848' : '#606070';
  X.fillRect(-4, -16, 8, 12);
  X.fillRect(-2, -20, 4, 5);
  // Pectoral fin
  X.fillRect(-L / 4, 6, 14, 8);
  // Caudal (tail) fin
  X.fillRect(-L / 2 - 10, -8, 10, 8);
  X.fillRect(-L / 2 - 10, 2, 10, 8);
  // Eye
  X.fillStyle = chasing ? '#ff1100' : '#0a0a12';
  X.fillRect(L / 2 - 10, -5, 5, 5);
  // Teeth — show when chasing
  if (chasing) {
    X.fillStyle = '#eeeeee';
    for (let i = 0; i < 4; i++) {
      X.fillRect(L / 2 - 2 + i * 0, -3 + i * 0, 2, 3);
      X.fillRect(L / 2 - i - 4, 0, 2, 3);
    }
  }

  X.restore();
}

// ── Enemy draw: The Auditor (giant squid) ─────────────────

function drawSquid(squid, camX, camY, t) {
  if (!squid.active) return;
  const sx = Math.round(squid.wx - camX);
  const sy = Math.round(squid.wy - camY);
  if (sx < -120 || sx > CW + 120 || sy < -120 || sy > CH + 120) return;

  const chasing = squid.chasing;
  const pulse   = 0.7 + Math.sin(t / 600) * 0.15;
  const MANTLEC = chasing ? '#2a1040' : '#1a0830';
  const TENTCLR = chasing ? '#3a1a50' : '#221040';

  X.save();
  X.translate(sx, sy);
  X.globalAlpha = 0.88;

  // Eight short arms reaching downward / outward
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 2;
    const armLen = 28 + Math.sin(t / 400 + i) * 6;
    const sway   = Math.sin(t / 700 + i * 0.8) * 0.18;
    X.strokeStyle = TENTCLR;
    X.lineWidth   = 4 - i * 0.2;
    X.beginPath();
    X.moveTo(0, 18);
    const endX = Math.cos(angle + sway) * armLen;
    const endY = 18 + Math.sin(angle + sway) * armLen * 0.6;
    X.quadraticCurveTo(endX * 0.6, 18 + (endY - 18) * 0.4, endX, endY);
    X.stroke();
  }

  // Two long tentacles — extend when chasing
  const tentLen = chasing ? 70 : 50;
  [-1, 1].forEach(side => {
    const sway = Math.sin(t / 1000 + side) * 0.3;
    X.strokeStyle = TENTCLR;
    X.lineWidth = 3;
    X.beginPath();
    X.moveTo(side * 12, 10);
    X.quadraticCurveTo(side * (20 + tentLen * 0.3), 40, side * 18, 10 + tentLen);
    X.stroke();
    // Sucker pad at tip
    X.fillStyle = chasing ? '#6030aa' : '#3a1870';
    X.globalAlpha = 0.7;
    X.beginPath();
    X.arc(side * 18, 10 + tentLen, 4, 0, Math.PI * 2);
    X.fill();
  });

  // Mantle — large, bulbous
  X.globalAlpha = 0.92;
  const mg = X.createRadialGradient(0, -10, 8, 0, -5, 42);
  mg.addColorStop(0, chasing ? '#3a1858' : '#221040');
  mg.addColorStop(0.6, MANTLEC);
  mg.addColorStop(1, '#0e0618');
  X.fillStyle = mg;
  X.beginPath();
  X.ellipse(0, -5, 34, 42, 0, 0, Math.PI * 2);
  X.fill();

  // Chromatophore spots — pulse when chasing
  if (chasing) {
    X.globalAlpha = 0.3 + pulse * 0.2;
    X.fillStyle = '#8030cc';
    const spots = [[-12, -12], [8, -8], [-6, 4], [14, 0], [0, -22]];
    spots.forEach(([ox, oy]) => {
      X.beginPath();
      X.arc(ox, oy, 3 + pulse * 2, 0, Math.PI * 2);
      X.fill();
    });
  }

  // Eyes — one massive eye on each side
  const eyePulse = chasing ? 0.9 + Math.sin(t / 200) * 0.1 : 0.6;
  [-1, 1].forEach(side => {
    // White sclera
    X.globalAlpha = 0.7;
    X.fillStyle = '#d0c8e8';
    X.beginPath();
    X.ellipse(side * 22, -8, 8, 9, 0, 0, Math.PI * 2);
    X.fill();
    // Pupil — rectangular when chasing (like a real squid / like an auditor)
    X.fillStyle = '#0a0618';
    X.globalAlpha = 1;
    if (chasing) {
      X.fillRect(side * 22 - 3, -12, 6, 8);
    } else {
      X.beginPath();
      X.arc(side * 22, -8, 5, 0, Math.PI * 2);
      X.fill();
    }
    // Iris glow
    X.globalAlpha = eyePulse * 0.6;
    X.fillStyle = chasing ? '#cc44ff' : '#6622aa';
    X.beginPath();
    X.arc(side * 22, -8, 3, 0, Math.PI * 2);
    X.fill();
  });

  X.restore();
}

// ── Enemy draw: The Devoted ───────────────────────────────

function drawDevoted(d, camX, camY, t) {
  const sx = Math.round(d.wx - camX);
  const sy = Math.round(d.wy - camY);
  if (sx < -60 || sx > CW + 60 || sy < -60 || sy > CH + 60) return;

  const sway = Math.sin(t / 1100 + d.phase) * 0.08;

  X.save();
  X.translate(sx, sy);
  X.rotate(sway); // gentle swaying

  X.globalAlpha = 0.8;

  // Tattered loincloth — rags behind
  X.fillStyle = '#3a2820';
  X.fillRect(-4, 4, 8, 16);
  X.fillRect(-6, 8, 4, 12);
  X.fillRect(2, 8, 4, 12);

  // Skeleton body — horizontal swimming pose
  X.fillStyle = '#c8bc8a'; // aged bone
  // Torso
  X.fillRect(-8, -5, 16, 12);
  // Pelvis
  X.fillRect(-6, 5, 12, 6);
  // Arms outstretched FORWARD (toward player) — this is the disturbing part
  X.fillRect(8, -4, 22, 4); // right arm reaching
  X.fillRect(-30, -4, 22, 4); // left arm reaching
  // Hands spread
  X.fillRect(28, -5, 6, 3);
  X.fillRect(28, -2, 6, 3);
  X.fillRect(-34, -5, 6, 3);
  X.fillRect(-34, -2, 6, 3);
  // Skull
  X.fillRect(-7, -18, 14, 14);
  // Jaw
  X.fillRect(-5, -8, 10, 4);
  // Spine visible beneath torso
  X.fillStyle = '#b0a478';
  X.fillRect(-1, -4, 2, 12);
  // Ribs
  for (let r = 0; r < 3; r++) {
    X.fillRect(-7, -2 + r * 4, 5, 2);
    X.fillRect(2,  -2 + r * 4, 5, 2);
  }

  // Eye sockets — hollow black with ancient belief still glowing
  X.fillStyle = '#08060e';
  X.fillRect(-5, -15, 4, 4);
  X.fillRect(1,  -15, 4, 4);
  // The glow — they still believe, even now
  const devotGlow = 0.25 + Math.sin(t / 500 + d.phase) * 0.15;
  X.fillStyle = '#cc1133';
  X.globalAlpha = devotGlow;
  X.fillRect(-4, -14, 2, 2);
  X.fillRect(2,  -14, 2, 2);

  // Cult markings on bones — carved runes
  X.globalAlpha = 0.3;
  X.fillStyle = '#8a3066';
  X.fillRect(-6, 0, 2, 6);
  X.fillRect(-2, 0, 2, 6);
  X.fillRect(2,  0, 2, 6);

  X.restore();
}

// ── Testimonial plaques (zones 1-2) ──────────────────────
// Five carved wall-plaques scattered through the upper city.
// Visual state: unread (dark stone, faint) vs read (lit, glowing).

function drawTestimonialPlaques(t) {
  TESTIMONIALS.forEach((pos, i) => {
    const flagKey = `atlantis_test_${i}`;
    const read    = Flags.get(`atlantis_${pos.id}`);
    const wx = pos.wx;
    const wy = pos.wy;

    X.save();
    // Backing stone — slightly different per testimonial to feel found, not placed
    X.fillStyle = read ? '#1a2a3a' : '#121c26';
    X.fillRect(wx - 26, wy - 50, 52, 58);

    // Border
    X.strokeStyle = read ? '#3a6080' : '#1a2a38';
    X.lineWidth = 1;
    X.strokeRect(wx - 26, wy - 50, 52, 58);

    // Inscription lines (carved marks)
    const lineCount = 5;
    X.strokeStyle = read ? '#4a8a6a' : '#1e3040';
    X.lineWidth   = 0.8;
    X.globalAlpha = read ? 0.7 : 0.3;
    for (let l = 0; l < lineCount; l++) {
      const ly = wy - 40 + l * 9;
      const w  = 28 + Math.sin(i * 1.3 + l) * 8; // irregular line lengths
      X.beginPath();
      X.moveTo(wx - w / 2, ly);
      X.lineTo(wx + w / 2, ly);
      X.stroke();
    }

    // Glow when read
    if (read) {
      const pulse = 0.08 + Math.sin(t / 1400 + i * 0.7) * 0.04;
      X.globalAlpha = pulse;
      const rg = X.createRadialGradient(wx, wy - 20, 2, wx, wy - 20, 36);
      rg.addColorStop(0, '#4a8aaa');
      rg.addColorStop(1, 'transparent');
      X.fillStyle = rg;
      X.fillRect(wx - 38, wy - 58, 76, 68);

      // Small glow badge at top-right corner (tier symbol)
      X.globalAlpha = 0.5;
      X.fillStyle = '#2a5070';
      X.fillRect(wx + 16, wy - 54, 12, 10);
      X.fillStyle = '#66aacc';
      X.globalAlpha = 0.7;
      X.font = '4px monospace';
      X.textAlign = 'center';
      X.fillText(`T${[4,2,7,5,6][i]}`, wx + 22, wy - 46);
    } else {
      // Unread: subtle interaction hint shimmer when near
      const shimmer = 0.03 + Math.sin(t / 800 + i) * 0.015;
      X.globalAlpha = shimmer;
      X.fillStyle = '#aaccdd';
      X.fillRect(wx - 26, wy - 50, 52, 58);
    }

    X.textAlign = 'left';
    X.restore();
  });
}

// ── Processing Chair highlight (zone 3) ───────────────────
// The special audit chair glows differently than the generic rows.

function drawAuditChair(t) {
  const cx = CHAIR_WX;
  const cy = CHAIR_WY;
  const cleared = Flags.get('atlantis_cleared');
  const tier3   = Flags.get('atlantis_tier3');

  // Outer glow ring — colour signals state
  const glowCol = cleared ? '#20cc60' : tier3 ? '#00aacc' : '#443820';
  const glowA   = cleared
    ? 0.12 + Math.sin(t / 800) * 0.04
    : tier3
    ? 0.10 + Math.sin(t / 600) * 0.05
    : 0.04;

  X.save();
  X.globalAlpha = glowA;
  const rg = X.createRadialGradient(cx, cy - 20, 4, cx, cy - 20, 52);
  rg.addColorStop(0, glowCol);
  rg.addColorStop(1, 'transparent');
  X.fillStyle = rg;
  X.fillRect(cx - 55, cy - 74, 110, 96);

  X.globalAlpha = 1;

  // Chair body — more detailed than generic chairs
  X.fillStyle = cleared ? '#1a3030' : '#1a2040';
  X.fillRect(cx - 18, cy - 22, 36, 8);   // seat
  X.fillRect(cx - 16, cy - 56, 10, 36);  // left back post
  X.fillRect(cx + 6,  cy - 56, 10, 36);  // right back post
  X.fillRect(cx - 16, cy - 58, 32, 6);   // headrest

  // Carved tier-three symbol on back
  X.globalAlpha = 0.55;
  X.fillStyle = cleared ? '#30cc80' : '#2060a0';
  X.font = '7px monospace';
  X.textAlign = 'center';
  X.fillText(cleared ? '✦ CLEARED ✦' : 'III', cx, cy - 38);

  // Armrests
  X.globalAlpha = 1;
  X.fillStyle = '#223040';
  X.fillRect(cx - 26, cy - 30, 12, 16);
  X.fillRect(cx + 14, cy - 30, 12, 16);

  // Floor runes beneath chair — Auditor markings
  X.globalAlpha = 0.3 + Math.sin(t / 1200) * 0.1;
  X.strokeStyle = cleared ? '#30cc80' : '#1060a0';
  X.lineWidth   = 0.8;
  for (let r = 0; r < 4; r++) {
    const angle = (r / 4) * Math.PI * 2 + t / 4000;
    X.beginPath();
    X.moveTo(cx + Math.cos(angle) * 28, cy + Math.sin(angle) * 8);
    X.lineTo(cx + Math.cos(angle) * 36, cy + Math.sin(angle) * 12);
    X.stroke();
  }

  X.textAlign = 'left';
  X.restore();
}

// ── Archive Room (zone 3, far west) ──────────────────────
// A sealed side-chamber. Locked until Cleared. Contains 3 tablets.

function drawArchiveRoom(t) {
  const dx = ARCHIVE_DOOR_WX;
  const dy = ARCHIVE_DOOR_WY;
  const open    = Flags.get('atlantis_archive_open');
  const cleared = Flags.get('atlantis_cleared');

  // Archive chamber walls — a recessed alcove in the west side
  const roomX = 20;
  const roomY = 1000;
  const roomW = 240;
  const roomH = 480;

  X.save();
  // Chamber interior fill
  X.fillStyle = open ? '#0e1a14' : '#0a1018';
  X.fillRect(roomX, roomY, roomW, roomH);

  // Stone walls
  X.strokeStyle = open ? '#1a3a28' : '#152030';
  X.lineWidth   = 3;
  X.strokeRect(roomX, roomY, roomW, roomH);

  // Interior wall texture
  X.strokeStyle = open ? '#162a20' : '#10181e';
  X.lineWidth   = 1;
  X.globalAlpha = 0.5;
  for (let ry = roomY + 20; ry < roomY + roomH; ry += 22) {
    X.beginPath();
    X.moveTo(roomX + 4, ry);
    X.lineTo(roomX + roomW - 4, ry);
    X.stroke();
  }
  X.globalAlpha = 1;

  // Archive label above door
  X.globalAlpha = cleared ? 0.6 : 0.25;
  X.font        = '5px monospace';
  X.fillStyle   = cleared ? '#4a8a6a' : '#2a4050';
  X.textAlign   = 'center';
  X.fillText('THE ARCHIVE', dx, dy - 64);
  X.fillText('CLEARANCE REQUIRED', dx, dy - 56);

  // Door frame
  X.globalAlpha = 1;
  X.fillStyle   = open ? '#1a3a28' : '#1a2838';
  X.fillRect(dx - 22, dy - 48, 44, 4);    // top lintel
  X.fillRect(dx - 22, dy - 48, 4, 52);    // left post
  X.fillRect(dx + 18, dy - 48, 4, 52);    // right post

  // Door panel — sealed (dark) or open (passage visible)
  if (open) {
    // Open — interior glow visible through doorway
    const portGlow = 0.15 + Math.sin(t / 1100) * 0.05;
    X.globalAlpha = portGlow;
    const dg = X.createLinearGradient(dx - 18, 0, dx + 18, 0);
    dg.addColorStop(0, 'transparent');
    dg.addColorStop(0.5, '#20aa60');
    dg.addColorStop(1, 'transparent');
    X.fillStyle = dg;
    X.fillRect(dx - 18, dy - 44, 36, 48);
    X.globalAlpha = 1;
  } else {
    // Closed — heavy stone door with compliance seal
    X.fillStyle   = cleared ? '#1e3040' : '#141c28';
    X.fillRect(dx - 18, dy - 44, 36, 48);
    // Lock symbol
    X.globalAlpha = cleared ? 0.7 : 0.3;
    X.strokeStyle = cleared ? '#4488aa' : '#2a3a48';
    X.lineWidth   = 1.5;
    X.beginPath();
    X.arc(dx, dy - 16, 7, Math.PI, 0, false);
    X.stroke();
    X.fillStyle = cleared ? '#2a5070' : '#1a2838';
    X.globalAlpha = cleared ? 1 : 0.5;
    X.fillRect(dx - 6, dy - 16, 12, 12);
    // Keyhole
    X.globalAlpha = 0.6;
    X.fillStyle   = cleared ? '#66aacc' : '#2a3a4a';
    X.beginPath();
    X.arc(dx, dy - 10, 3, 0, Math.PI * 2);
    X.fill();
  }

  // Archive tablets (inside the chamber)
  if (open) {
    ARCHIVE_TABLETS.forEach((pos, i) => {
      const archKey = `atlantis_${pos.id}`;
      const read    = Flags.get(archKey);
      const tx = pos.wx;
      const ty = pos.wy;

      // Tablet stone
      const tg = X.createLinearGradient(tx - 14, 0, tx + 14, 0);
      tg.addColorStop(0, '#141e18');
      tg.addColorStop(0.5, '#1e3028');
      tg.addColorStop(1, '#141e18');
      X.globalAlpha = 1;
      X.fillStyle   = tg;
      X.fillRect(tx - 14, ty - 64, 28, 76);

      // Carved lines
      const lineA = read ? 0.65 : 0.25;
      X.globalAlpha = lineA;
      X.fillStyle   = read ? '#4a8a6a' : '#2a4a38';
      for (let l = 0; l < 5; l++) {
        const lw = 12 + (l % 3) * 4;
        X.fillRect(tx - lw / 2, ty - 54 + l * 11, lw, 2);
      }

      // Glow if read
      if (read) {
        X.globalAlpha = 0.12 + Math.sin(t / 1200 + i * 0.9) * 0.05;
        const rg2 = X.createRadialGradient(tx, ty - 28, 2, tx, ty - 28, 30);
        rg2.addColorStop(0, '#20aa60');
        rg2.addColorStop(1, 'transparent');
        X.fillStyle = rg2;
        X.fillRect(tx - 34, ty - 70, 68, 76);
      }

      // Archive record label
      X.globalAlpha = read ? 0.5 : 0.2;
      X.font        = '4px monospace';
      X.fillStyle   = read ? '#4a8a6a' : '#2a4840';
      X.textAlign   = 'center';
      X.fillText(`RECORD ${['I', 'II', 'III'][i]}`, tx, ty + 18);
      X.textAlign = 'left';
      X.globalAlpha = 1;
    });
  }

  X.textAlign = 'left';
  X.restore();
}

// ── Name Alcove (east of choir, zone 4) ───────────────────
// Sealed until choir survival. Contains the Compliance Officer's
// private record: the Founder's birth name.

function drawNameAlcove(t) {
  const nx = NAME_TABLET_WX;
  const ny = NAME_TABLET_WY;
  const survived = Flags.get('atlantis_choir_survived');
  const nameRead = Flags.get('atlantis_founder_name');

  // East wall section — always present
  X.save();
  X.fillStyle = '#0e0c18';
  X.fillRect(nx - 30, ny - 70, 72, 82);
  X.strokeStyle = survived ? '#3a2050' : '#1a1428';
  X.lineWidth   = 2;
  X.strokeRect(nx - 30, ny - 70, 72, 82);

  if (!survived) {
    // Sealed — hairline crack in wall, barely perceptible
    X.globalAlpha = 0.15;
    X.strokeStyle = '#4a3060';
    X.lineWidth   = 0.5;
    X.beginPath();
    X.moveTo(nx - 2, ny - 70);
    X.lineTo(nx + 4, ny - 10);
    X.stroke();
    X.globalAlpha = 1;
    X.restore();
    return;
  }

  // Opened — crack becomes passage glow
  X.globalAlpha = 0.18 + Math.sin(t / 900) * 0.06;
  const ag = X.createRadialGradient(nx + 6, ny - 28, 4, nx + 6, ny - 28, 44);
  ag.addColorStop(0, '#8030cc');
  ag.addColorStop(1, 'transparent');
  X.fillStyle = ag;
  X.fillRect(nx - 32, ny - 72, 76, 84);

  // Tablet inside the alcove
  X.globalAlpha = 1;
  const tg = X.createLinearGradient(nx - 12, 0, nx + 12, 0);
  tg.addColorStop(0, '#16101e');
  tg.addColorStop(0.5, '#20182e');
  tg.addColorStop(1, '#16101e');
  X.fillStyle = tg;
  X.fillRect(nx - 12, ny - 58, 24, 64);

  // Glow intensity depends on read state
  const glowA = nameRead ? 0.6 : 0.3 + Math.sin(t / 700) * 0.15;
  X.globalAlpha = glowA;
  const tglow = X.createRadialGradient(nx, ny - 24, 2, nx, ny - 24, 28);
  tglow.addColorStop(0, '#9940ff');
  tglow.addColorStop(1, 'transparent');
  X.fillStyle = tglow;
  X.fillRect(nx - 30, ny - 64, 60, 72);

  // Inscription lines
  X.globalAlpha = nameRead ? 0.7 : 0.4;
  X.fillStyle   = '#aa60ff';
  X.font        = '4px monospace';
  X.textAlign   = 'center';
  if (nameRead) {
    X.fillText('KHEM-ATEF', nx, ny - 34);
    X.fillText('────────', nx, ny - 26);
    X.fillText('PRIVATE', nx, ny - 18);
    X.fillText('RECORD', nx, ny - 10);
  } else {
    // Unread: just marks, not decipherable
    for (let l = 0; l < 4; l++) {
      X.fillRect(nx - 8, ny - 48 + l * 10, 16, 2);
    }
  }
  X.textAlign = 'left';
  X.restore();
}

// ── Interactable hint (screen-space) ─────────────────────

function drawInteractHint(realm) {
  if (!realm.registry) return;
  const nearest = realm.registry.nearest;
  if (!nearest) return;

  const labels = {
    welcome_pillar: '[SPACE] READ THE PILLAR',
    greeter:        '[SPACE] SPEAK WITH THE GREETER',
    test_0:         '[SPACE] READ THE PLAQUE',
    test_1:         '[SPACE] READ THE PLAQUE',
    test_2:         '[SPACE] READ THE PLAQUE',
    test_3:         '[SPACE] READ THE PLAQUE',
    test_4:         '[SPACE] READ THE PLAQUE',
    audit_chair:    Flags.get('atlantis_cleared')
                      ? '[SPACE] YOU ARE ALREADY CLEARED'
                      : '[SPACE] SIT FOR THE AUDIT',
    archive_door:   Flags.get('atlantis_archive_open')
                      ? '[SPACE] THE ARCHIVE IS OPEN'
                      : '[SPACE] OPEN THE ARCHIVE',
    arch_0:         '[SPACE] READ ARCHIVE RECORD I',
    arch_1:         '[SPACE] READ ARCHIVE RECORD II',
    arch_2:         '[SPACE] READ ARCHIVE RECORD III',
    name_tablet:    Flags.get('atlantis_choir_survived')
                      ? '[SPACE] READ THE PRIVATE RECORD'
                      : '[SPACE] THE ALCOVE IS SEALED',
    founder:        '[SPACE] APPROACH THE THRONE',
    deepest_tablet: '[SPACE] READ THE TABLET',
    vault_crack:    '[↓] DESCEND INTO THE DEEP',
  };
  const label = labels[nearest.id] || '[SPACE] INTERACT';

  const t  = Date.now();
  const ha = 0.6 + 0.4 * Math.abs(Math.sin(t / 420));
  X.save();
  X.globalAlpha = ha;
  X.font = '7px monospace';
  X.textAlign = 'center';
  X.fillStyle = '#aaeebb';
  X.fillText(label, CW / 2, CH - 60);
  X.textAlign = 'left';
  X.restore();
}

// ── Post-respawn immunity flash (screen-space) ────────────

function drawImmunityFlash(realm) {
  const remaining = realm._immuneUntil - Date.now();
  if (remaining <= 0 || realm._dying) return;
  // Only show during the first second (flash fades quickly)
  const frac = Math.min(1, remaining / 3000);
  X.save();
  X.globalAlpha = frac * 0.12 * (0.5 + 0.5 * Math.sin(Date.now() / 120));
  X.fillStyle = '#aaeeff';
  X.fillRect(0, 0, CW, CH);
  X.restore();
}

function drawDeathOverlay(realm, t) {
  if (!realm._dying) return;

  const elapsed  = Date.now() - realm._dyingT;
  const progress = Math.min(1, elapsed / 2800);

  // First 0.6: flash white
  // 0.6–1.0: deep teal void settles in
  let r, g, b, a;
  if (progress < 0.15) {
    // Instant white flash
    a = progress / 0.15;
    r = 220; g = 240; b = 255;
  } else if (progress < 0.45) {
    // Settle to deep teal-black
    const p = (progress - 0.15) / 0.3;
    a = 1;
    r = Math.round(220 * (1 - p));
    g = Math.round(240 * (1 - p) + 4 * p);
    b = Math.round(255 * (1 - p) + 18 * p);
  } else {
    a = 1; r = 0; g = 4; b = 18;
  }

  X.save();
  X.globalAlpha = a;
  X.fillStyle = `rgb(${r},${g},${b})`;
  X.fillRect(0, 0, CW, CH);

  // Death message — appears after flash settles
  if (progress > 0.35) {
    const textAlpha = Math.min(1, (progress - 0.35) / 0.2);
    X.globalAlpha = textAlpha;
    X.textAlign = 'center';

    // Split message on newline
    const lines = realm._deathMsg.split('\n');
    const startY = CH / 2 - lines.length * 10;

    lines.forEach((line, i) => {
      // First line: larger
      if (i === 0) {
        X.font = 'bold 10px monospace';
        X.fillStyle = '#aaeeff';
      } else {
        X.font = '8px monospace';
        X.fillStyle = '#6699aa';
      }
      X.fillText(line, CW / 2, startY + i * 20);
    });

    // Tier label
    const tier = Flags.get('atlantis_tier', 0);
    if (tier > 0) {
      X.globalAlpha = textAlpha * 0.4;
      X.font = '6px monospace';
      X.fillStyle = '#4488aa';
      X.fillText(`TIER ${tier}  ✦  YOUR THETAN IS REPOSITIONING`, CW / 2, CH - 30);
    }

    X.textAlign = 'left';
  }

  X.restore();
}

// ── Choir warning (screen-space) ─────────────────────────

function drawChoirWarning(realm, t) {
  if (!realm._inChoir) return;
  const elapsed = Date.now() - realm._choirT;
  const frac    = elapsed / 2400;

  X.save();
  X.globalAlpha = frac * 0.35;
  X.fillStyle = '#440010';
  X.fillRect(0, 0, CW, CH);

  X.globalAlpha = frac * 0.8;
  X.textAlign = 'center';
  X.font = '7px monospace';
  X.fillStyle = '#ff3366';
  X.fillText('THE CIRCLE IS HARMONIZING YOU', CW / 2, CH / 2 - 10);
  X.fillText('SWIM AWAY', CW / 2, CH / 2 + 8);
  X.textAlign = 'left';
  X.restore();
}

// ── Updated depth HUD with zone + tier ───────────────────

function drawAtlantisHUD(realm) {
  const depthM = Math.max(0, Math.round((realm.py - ATLANTIS_EXIT_Y) / 8));
  const t      = Date.now();
  const tier   = Flags.get('atlantis_tier', 0);
  const deaths = Flags.get('atlantis_deaths', 0);

  // Zone label
  const zoneName =
    realm.py < ZONE_1_END ? 'ZONE I — THE ATRIUM' :
    realm.py < ZONE_2_END ? 'ZONE II — THE ABUNDANCE HALL' :
    realm.py < ZONE_3_END ? 'ZONE III — THE PROCESSING CHAMBER' :
    realm.py < ZONE_4_END ? 'ZONE IV — THE DEVOTED QUARTER' :
                            'ZONE V — THE FOUNDER\'S VAULT';

  const testiCount = Flags.get('atlantis_testimonials_read', 0);
  const cleared    = Flags.get('atlantis_cleared');

  X.save();
  X.globalAlpha = 0.65;
  X.font = '7px monospace';
  X.fillStyle = '#aaeeff';
  X.fillText(`DEPTH: ${depthM}m`, 12, 20);

  X.globalAlpha = 0.4 + Math.sin(t * 0.002) * 0.08;
  X.font = '8px monospace';
  X.fillStyle = '#66ccaa';
  X.fillText('✦ THE LOST CITY OF ATLANTIS ✦', 12, 36);

  X.globalAlpha = 0.45;
  X.font = '6px monospace';
  X.fillStyle = '#88aabb';
  X.fillText(zoneName, 12, 52);

  if (tier > 0) {
    X.globalAlpha = 0.5;
    X.fillStyle = '#9966cc';
    X.fillText(`TIER ${tier}`, CW - 80, 20);
  }

  // Status indicators top-right
  if (cleared) {
    X.globalAlpha = 0.55;
    X.fillStyle = '#30cc80';
    X.fillText('✦ CLEARED', CW - 80, 36);
  } else if (testiCount > 0) {
    X.globalAlpha = 0.45;
    X.fillStyle = '#88aabb';
    X.fillText(`PLAQUES: ${testiCount}/5`, CW - 90, 36);
  }

  if (deaths > 0) {
    X.globalAlpha = 0.4;
    X.fillStyle = '#886688';
    X.fillText(`DEATHS: ${deaths}`, CW - 80, 36);
  }

  X.globalAlpha = 0.35;
  X.font = '5px monospace';
  X.fillStyle = '#667788';
  X.textAlign = 'center';
  X.fillText('ARROW KEYS: SWIM   SHIFT: FAST   SPACE: INTERACT   ↑ AT SURFACE: ASCEND', CW / 2, CH - 8);
  X.textAlign = 'left';

  X.restore();
}

// ── Main draw entry ───────────────────────────────────────

export function drawAtlantis(realm) {
  const t    = Date.now();
  const camX = realm.camX;
  const camY = realm.camY;

  // 1. Background
  drawWaterBg(camY);

  // 2. Zone atmosphere overlay
  drawZoneAtmosphere(camY);

  // 3. Caustic shimmer (screen-space)
  drawCaustics(t);

  // 4. Surface layer
  drawSurface(camX, camY);

  // 5. World-space objects
  X.save();
  X.translate(-camX, -camY);

  drawFloor(ATLANTIS_WORLD_W);

  // Zone-specific architecture
  drawAtrium(t);
  drawAbundanceHall(t);
  drawProcessingChamber(t);
  drawDevotedQuarter(t);
  drawFounderVault(t);

  // Puzzle elements (world-space, drawn over base geometry)
  drawTestimonialPlaques(t);
  drawAuditChair(t);
  drawArchiveRoom(t);
  drawNameAlcove(t);

  // Original city geometry
  drawBuildings();
  drawArches();
  drawRubble();
  drawColumns();
  drawInscriptions(t);
  drawCoral(t);
  drawBiolum(t);
  drawFish(t);

  // Crack in vault floor — drawn last so it renders over all geometry
  drawVaultCrack(t);

  X.restore();

  // 6. Enemies — screen-space positions computed from world coords
  if (realm.shark)   drawShark(realm.shark, camX, camY, t);
  if (realm.squid)   drawSquid(realm.squid, camX, camY, t);
  if (realm.devoted) realm.devoted.forEach(d => drawDevoted(d, camX, camY, t));

  // 7. Sediment
  drawSediment(t, camX, camY);

  // 8. Bubbles
  drawBubbles(t);

  // 8. Player
  drawSwimmingPharaoh(realm);

  // 9. Screen-space overlays
  drawChoirWarning(realm, t);
  drawInteractHint(realm);
  drawAtlantisHUD(realm);
  drawExitPrompt(realm);

  // 10. Immunity flash (fades over 3s after respawn)
  drawImmunityFlash(realm);

  // 11. Death (topmost — covers everything)
  drawDeathOverlay(realm, t);
}
