// ── FILE: worlds/oasis/draw/vault.js ────────────────────
// The vault beneath the sphinx — a sealed underground chamber.
// Warm torchlight, ancient stone, the Dream Stele at center.

import { X, CW, CH }              from '../../../engine/canvas.js';
import { VAULT_FLOOR, STELE_X }   from '../constants.js';
import { drawVaultPharaoh }       from '../../../draw/pharaoh.js';
import { Flags }                  from '../../../engine/flags.js';

const STONE    = '#b07828';
const STONE_LT = '#c89038';
const STONE_SH = '#7a5010';
const STONE_DK = '#4a2e06';
const SAND     = '#c09028';

// ── Background & ceiling ──────────────────────────────────

function drawVaultBG(t) {
  // Underground dark warm fill
  const bg = X.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0,   '#0e0700');
  bg.addColorStop(0.3, '#1a0d02');
  bg.addColorStop(1,   '#0a0400');
  X.fillStyle = bg;
  X.fillRect(0, 0, CW, CH);

  // Ceiling stone blocks
  const ceilH = 80;
  X.fillStyle = STONE_DK;
  X.fillRect(0, 0, CW, ceilH);
  X.fillStyle = '#3a2004';
  X.fillRect(0, ceilH - 4, CW, 4);

  // Ceiling block joints — horizontal mortar lines
  for (let row = 0; row < 3; row++) {
    X.fillStyle = '#2e1800';
    X.fillRect(0, 14 + row * 22, CW, 1);
    // Vertical joints offset per row
    const offset = row % 2 === 0 ? 0 : 55;
    for (let bx = offset; bx < CW; bx += 110) {
      X.fillRect(bx, 14 + row * 22, 1, 22);
    }
  }

  // Staircase opening in ceiling — top-left, where player descended
  const stairX = 110;
  const stairW = 72;
  X.fillStyle = '#050200';
  X.fillRect(stairX, 0, stairW, ceilH + 4);
  // Stone frame around opening
  X.strokeStyle = STONE_SH;
  X.lineWidth = 2;
  X.strokeRect(stairX - 1, 0, stairW + 2, ceilH + 4);
  // Warm glow from above (oasis light leaking down)
  X.save();
  X.globalAlpha = 0.22 + 0.06 * Math.sin(t / 1100);
  const og = X.createLinearGradient(stairX, 0, stairX, ceilH);
  og.addColorStop(0, '#d09020');
  og.addColorStop(1, 'transparent');
  X.fillStyle = og;
  X.fillRect(stairX, 0, stairW, ceilH);
  X.restore();
  // [↑] EXIT hint above the opening
  const ha = 0.45 + 0.45 * Math.abs(Math.sin(t / 540));
  X.save();
  X.globalAlpha = ha;
  X.font = '5px monospace';
  X.textAlign = 'center';
  X.fillStyle = '#c89028';
  X.fillText('[↑] ASCEND', stairX + stairW / 2, ceilH - 4);
  X.textAlign = 'left';
  X.restore();
}

// ── Walls ─────────────────────────────────────────────────

function drawVaultWalls(t) {
  const wallW = 60;
  const wallTop = 80;

  // Left wall
  X.fillStyle = STONE_DK;
  X.fillRect(0, wallTop, wallW, VAULT_FLOOR - wallTop);
  X.fillStyle = '#3d2008';
  X.fillRect(wallW - 4, wallTop, 4, VAULT_FLOOR - wallTop);

  // Right wall
  X.fillStyle = STONE_DK;
  X.fillRect(CW - wallW, wallTop, wallW, VAULT_FLOOR - wallTop);
  X.fillStyle = '#3d2008';
  X.fillRect(CW - wallW, wallTop, 4, VAULT_FLOOR - wallTop);

  // Wall block joints
  for (let side = 0; side < 2; side++) {
    const wx = side === 0 ? 0 : CW - wallW;
    for (let row = 0; row < 7; row++) {
      const ry = wallTop + 10 + row * 50;
      X.fillStyle = '#2e1800';
      X.fillRect(wx, ry, wallW - 4, 1);
    }
  }

  drawHieroglyphs(t);
}

// ── Hieroglyphs on both walls ─────────────────────────────
// Simplified pixel glyphs — eye, ankh, pyramid, bird, wavy line.

function drawHieroglyphs(t) {
  const glyphs = [
    // Eye of Horus — rough pixel
    (bx, by) => {
      X.fillRect(bx,     by + 3, 18, 2);
      X.fillRect(bx + 4, by,     10, 3);
      X.fillRect(bx + 7, by + 1, 4,  4);
      X.fillRect(bx + 8, by + 2, 2,  2);
      X.fillRect(bx + 3, by + 5, 2,  5);
      X.fillRect(bx + 13,by + 5, 3,  3);
    },
    // Ankh
    (bx, by) => {
      X.fillRect(bx + 5, by,      8,  2);
      X.fillRect(bx + 7, by + 2,  4,  2);
      X.fillRect(bx + 2, by + 4,  14, 2);
      X.fillRect(bx + 7, by + 6,  4,  10);
      X.fillRect(bx + 5, by + 14, 8,  2);
    },
    // Pyramid silhouette
    (bx, by) => {
      for (let row = 0; row < 8; row++) {
        const w = 2 + row * 2;
        X.fillRect(bx + 8 - row, by + row * 2, w * 2 - 2, 2);
      }
    },
    // Bird (ibis profile)
    (bx, by) => {
      X.fillRect(bx + 1, by + 6,  14, 3);
      X.fillRect(bx + 2, by + 3,  4,  4);
      X.fillRect(bx,     by + 2,  4,  2);
      X.fillRect(bx + 14,by + 5,  4,  2);
      X.fillRect(bx + 3, by + 9,  4,  5);
      X.fillRect(bx + 9, by + 9,  4,  5);
    },
    // Wavy water lines
    (bx, by) => {
      for (let w = 0; w < 4; w++) {
        const wy = by + w * 4;
        X.fillRect(bx,     wy, 4, 2);
        X.fillRect(bx + 5, wy + 2, 4, 2);
        X.fillRect(bx + 10,wy, 4, 2);
        X.fillRect(bx + 15,wy + 2, 4, 2);
      }
    },
  ];

  const positions = [
    // Left wall
    [8, 110], [8, 170], [8, 240], [8, 320], [32, 140], [32, 210], [32, 280],
    // Right wall
    [CW - 54, 110], [CW - 54, 175], [CW - 54, 250], [CW - 54, 330],
    [CW - 32, 145], [CW - 32, 215], [CW - 32, 290],
  ];

  const glowA = 0.35 + 0.12 * Math.sin(t / 900);
  X.save();
  X.globalAlpha = glowA;
  X.fillStyle = '#c89028';
  positions.forEach(([bx, by], i) => {
    glyphs[i % glyphs.length](bx, by);
  });
  X.restore();
}

// ── Torches ───────────────────────────────────────────────

function drawTorch(tx, ty, t, phase) {
  const flicker = Math.sin(t / 120 + phase) * 0.3 + Math.sin(t / 80 + phase * 2.1) * 0.2;

  // Torch cone glow on wall
  X.save();
  X.globalAlpha = 0.18 + 0.08 * Math.abs(flicker);
  const tg = X.createRadialGradient(tx, ty - 10, 2, tx, ty - 10, 80);
  tg.addColorStop(0, '#f0c040');
  tg.addColorStop(0.5, '#c07010');
  tg.addColorStop(1, 'transparent');
  X.fillStyle = tg;
  X.fillRect(tx - 80, ty - 80, 160, 120);
  X.restore();

  // Bracket
  X.fillStyle = STONE_SH;
  X.fillRect(tx - 3, ty + 8, 6, 16);
  X.fillRect(tx - 8, ty + 20, 16, 4);

  // Torch body
  X.fillStyle = '#5a3010';
  X.fillRect(tx - 2, ty - 2, 4, 14);

  // Flame (multiple layers)
  const fh = 14 + Math.round(flicker * 4);
  X.save();
  X.globalAlpha = 0.9 + flicker * 0.1;
  X.fillStyle = '#f0e040';
  X.fillRect(tx - 2, ty - fh, 4, fh);
  X.globalAlpha = 0.7;
  X.fillStyle = '#f08020';
  X.fillRect(tx - 3, ty - fh + 4, 6, fh - 4);
  X.globalAlpha = 0.5;
  X.fillStyle = '#e04010';
  X.fillRect(tx - 4, ty - fh + 8, 8, fh - 8);
  X.globalAlpha = 0.35;
  X.fillStyle = '#c82000';
  X.fillRect(tx - 2, ty - fh - 2, 4, 4);
  X.restore();
}

// ── Floor ─────────────────────────────────────────────────

function drawVaultFloor(t) {
  // Stone slab floor
  const sg = X.createLinearGradient(0, VAULT_FLOOR, 0, CH);
  sg.addColorStop(0, STONE_SH);
  sg.addColorStop(1, STONE_DK);
  X.fillStyle = sg;
  X.fillRect(0, VAULT_FLOOR, CW, CH - VAULT_FLOOR);

  // Floor slab joints
  X.fillStyle = STONE_DK;
  X.fillRect(0, VAULT_FLOOR, CW, 2);
  for (let fx = 80; fx < CW; fx += 120) {
    X.fillStyle = '#3a1e08';
    X.fillRect(fx, VAULT_FLOOR, 1, CH - VAULT_FLOOR);
  }
  for (let fy = VAULT_FLOOR + 30; fy < CH; fy += 40) {
    X.fillStyle = '#3a1e08';
    X.fillRect(0, fy, CW, 1);
  }

  // Sand drifts accumulated against walls
  X.save();
  X.globalAlpha = 0.55;
  X.fillStyle = SAND;
  // Left drift
  X.beginPath();
  X.moveTo(0, VAULT_FLOOR);
  X.quadraticCurveTo(30, VAULT_FLOOR - 22, 80, VAULT_FLOOR - 10);
  X.lineTo(80, VAULT_FLOOR); X.lineTo(0, VAULT_FLOOR);
  X.fill();
  // Right drift
  X.beginPath();
  X.moveTo(CW, VAULT_FLOOR);
  X.quadraticCurveTo(CW - 40, VAULT_FLOOR - 18, CW - 80, VAULT_FLOOR - 6);
  X.lineTo(CW - 80, VAULT_FLOOR); X.lineTo(CW, VAULT_FLOOR);
  X.fill();
  X.restore();
}

// ── Dream Stele ───────────────────────────────────────────
// A large upright granite tablet. Standing 140px tall, 62px wide.
// Hieroglyphic figures and inscription carved into the face.

function drawStele(cx, fy, t, isRead) {
  const sw = 62;
  const sh = 140;
  const sx = cx - sw / 2;
  const sy = fy - sh;

  // Base slab the stele stands on
  X.fillStyle = STONE_DK;
  X.fillRect(sx - 8, fy - 6, sw + 16, 10);
  X.fillStyle = STONE_SH;
  X.fillRect(sx - 6, fy - 6, sw + 12, 4);

  // Stele body — darker granite than the walls
  const GRANITE    = '#6a4820';
  const GRANITE_LT = '#8a6030';
  const GRANITE_DK = '#3a2008';
  const CARVE      = '#c89028';

  X.fillStyle = GRANITE_DK;
  X.fillRect(sx - 2, sy - 2, sw + 4, sh + 2);
  X.fillStyle = GRANITE;
  X.fillRect(sx, sy, sw, sh);
  X.fillStyle = GRANITE_LT;
  X.fillRect(sx, sy, sw, 6);
  X.fillRect(sx, sy, 3, sh);
  X.fillStyle = GRANITE_DK;
  X.fillRect(sx + sw - 3, sy, 3, sh);

  // Rounded top (traditional stele shape — lunette)
  X.fillStyle = GRANITE;
  X.beginPath();
  X.arc(cx, sy + 10, sw / 2, Math.PI, 0, false);
  X.fill();
  X.fillStyle = GRANITE_LT;
  X.beginPath();
  X.arc(cx, sy + 10, sw / 2 - 1, Math.PI, 0, false);
  X.fill();

  // Lunette scene: sphinx + sun disk (carved into the rounded top)
  X.fillStyle = CARVE;
  X.globalAlpha = 0.55;
  // Sun disk
  X.beginPath();
  X.arc(cx, sy + 4, 7, 0, Math.PI * 2); X.fill();
  X.fillRect(cx - 1, sy - 4, 2, 8);  // sun rays up
  X.fillRect(cx - 7, sy + 4, 14, 1); // ray horizontal
  // Small sphinx silhouette below sun
  X.fillRect(cx - 14, sy + 12, 28, 5);  // body
  X.fillRect(cx - 14, sy + 9,  10, 3);  // head
  X.globalAlpha = 1;

  // Main inscription area — horizontal register lines
  X.fillStyle = CARVE;
  X.globalAlpha = 0.3;
  for (let r = 0; r < 6; r++) {
    X.fillRect(sx + 6, sy + 22 + r * 18, sw - 12, 1);
  }
  X.globalAlpha = 1;

  // Carved figures in the registers (simplified glyphs)
  X.fillStyle = CARVE;
  X.globalAlpha = 0.50;

  // Register 1: kneeling pharaoh offering
  const r1y = sy + 26;
  X.fillRect(cx - 18, r1y,      4, 12);   // pharaoh body
  X.fillRect(cx - 20, r1y,      8, 3);    // pharaoh head
  X.fillRect(cx - 18, r1y + 8,  4, 2);    // arm
  X.fillRect(cx - 14, r1y + 7,  6, 2);    // offering
  // Sphinx receiving
  X.fillRect(cx + 2,  r1y + 6,  16, 6);   // sphinx body
  X.fillRect(cx + 2,  r1y + 2,  7,  5);   // sphinx head

  // Register 2: text lines (dotted)
  const r2y = sy + 44;
  for (let dot = 0; dot < 8; dot++) {
    X.fillRect(sx + 8 + dot * 6, r2y, 3, 2);
    X.fillRect(sx + 8 + dot * 6, r2y + 6, 3, 2);
    X.fillRect(sx + 8 + dot * 6, r2y + 12, 3, 2);
  }

  // Register 3: the dream — sleeping figure
  const r3y = sy + 80;
  X.fillRect(cx - 20, r3y + 8,  28, 4);   // lying body
  X.fillRect(cx - 20, r3y + 4,  8,  5);   // head
  // Dream figure above (sphinx in dream)
  X.fillRect(cx - 8,  r3y,      18, 4);   // dream sphinx body
  X.fillRect(cx - 8,  r3y - 4,  6,  4);   // dream sphinx head
  X.save();
  X.globalAlpha = 0.25;
  X.strokeStyle = CARVE; X.lineWidth = 1;
  X.beginPath(); X.moveTo(cx - 16, r3y + 4); X.lineTo(cx - 4, r3y); X.stroke();
  X.restore();

  // Register 4: bottom inscription — throne
  const r4y = sy + 104;
  // Simple throne glyph
  X.fillRect(cx - 14, r4y,     4,  12);
  X.fillRect(cx - 14, r4y,     14, 3);
  X.fillRect(cx - 4,  r4y + 4, 4,  8);
  // Staff / was-scepter
  X.fillRect(cx + 4,  r4y - 2, 2,  14);
  X.fillRect(cx + 2,  r4y - 4, 4,  3);

  X.globalAlpha = 1;

  // Glow when the stele has been read — gold edge light
  if (isRead) {
    const readGlow = 0.10 + 0.07 * Math.sin(t / 900);
    X.save();
    X.globalAlpha = readGlow;
    const rg = X.createRadialGradient(cx, sy + sh / 2, 10, cx, sy + sh / 2, sw + 20);
    rg.addColorStop(0, '#f0c840');
    rg.addColorStop(1, 'transparent');
    X.fillStyle = rg;
    X.fillRect(sx - 24, sy - 20, sw + 48, sh + 40);
    X.restore();
  }

  // Interaction hint
  if (!isRead) {
    const ha = 0.5 + 0.5 * Math.abs(Math.sin(t / 480));
    X.save();
    X.globalAlpha = ha;
    X.font = '5px monospace';
    X.textAlign = 'center';
    X.fillStyle = '#c89028';
    X.fillText('[SPACE] READ INSCRIPTION', cx, sy - 10);
    X.textAlign = 'left';
    X.restore();
  }
}

// ── Scattered offerings ───────────────────────────────────

function drawOfferings(t) {
  // Small clay pots, canopic jar shapes, scattered debris
  const items = [
    { x: STELE_X - 55, w: 10, h: 14 },  // tall jar
    { x: STELE_X - 38, w: 14, h: 10 },  // wide bowl
    { x: STELE_X + 36, w: 10, h: 14 },  // tall jar
    { x: STELE_X + 50, w: 8,  h: 8  },  // small pot
  ];
  X.fillStyle = '#8a5820';
  items.forEach(({ x, w, h }) => {
    X.fillRect(x - w / 2, VAULT_FLOOR - h, w, h);
    X.fillStyle = STONE_SH;
    X.fillRect(x - w / 2, VAULT_FLOOR - h, w, 2);
    X.fillStyle = '#8a5820';
  });

  // Sand spill around base of stele
  X.save();
  X.globalAlpha = 0.4;
  X.fillStyle = SAND;
  X.beginPath();
  X.ellipse(STELE_X, VAULT_FLOOR, 50, 8, 0, 0, Math.PI * 2);
  X.fill();
  X.restore();
}

// ── Master draw ───────────────────────────────────────────

export function drawVault(realm) {
  const t = Date.now();
  const steleRead = Flags.get('stele_read') || false;

  drawVaultBG(t);
  drawVaultWalls(t);
  drawVaultFloor(t);

  // Torches on inner wall faces
  drawTorch(78,  VAULT_FLOOR - 100, t, 0.0);
  drawTorch(CW - 78, VAULT_FLOOR - 100, t, 1.8);
  drawTorch(200, VAULT_FLOOR - 80,  t, 3.2);
  drawTorch(CW - 200, VAULT_FLOOR - 80, t, 0.9);

  drawOfferings(t);
  drawStele(STELE_X, VAULT_FLOOR, t, steleRead);

  drawVaultPharaoh(realm);

  // HUD
  X.fillStyle = '#0e0700';
  X.fillRect(0, CH - 28, CW, 28);
  X.fillStyle = STONE_SH;
  X.fillRect(0, CH - 28, CW, 1);
  X.font = '6px monospace';
  X.fillStyle = '#a07820';
  X.fillText('BENEATH THE SPHINX', 8, CH - 10);
  X.textAlign = 'center';
  X.fillStyle = '#c89028';
  X.fillText('← → MOVE     [SPACE] EXAMINE     [↑] ASCEND', CW / 2, CH - 10);
  X.textAlign = 'left';
}
