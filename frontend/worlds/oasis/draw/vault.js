// ── FILE: worlds/oasis/draw/vault.js ────────────────────
// The sealed chamber beneath the great sphinx.
// Ritual circle. Mummy guardians. Sacrificial altar. Apophis on the ceiling.
// This place has been used. Recently. And before that. And before that.

import { X, CW, CH }                    from '../../../engine/canvas.js';
import { VAULT_FLOOR, STELE_X, ALTAR_X } from '../constants.js';
import { drawVaultPharaoh }              from '../../../draw/pharaoh.js';
import { Flags }                         from '../../../engine/flags.js';

const STONE    = '#8a5c1c';
const STONE_LT = '#a87030';
const STONE_SH = '#5a3a0c';
const STONE_DK = '#321e04';
const BLOOD    = '#4a0808';
const BLOOD_LT = '#6a1010';

// ── Background ────────────────────────────────────────────

function drawBG() {
  X.fillStyle = '#080300';
  X.fillRect(0, 0, CW, CH);

  // Ceiling — low, oppressive stone
  X.fillStyle = STONE_DK;
  X.fillRect(0, 0, CW, 90);
  // Ceiling block joints
  X.fillStyle = '#1e0e02';
  for (let row = 0; row < 4; row++) {
    X.fillRect(0, 18 + row * 20, CW, 1);
    const off = row % 2 === 0 ? 0 : 60;
    for (let bx = off; bx < CW; bx += 120) X.fillRect(bx, 18 + row * 20, 1, 20);
  }
  // Ceiling soot stains — from years of fire below
  X.save();
  X.globalAlpha = 0.55;
  X.fillStyle = '#000000';
  const stains = [140, 310, 490, 640];
  stains.forEach(sx => {
    const sg = X.createRadialGradient(sx, 90, 2, sx, 70, 50);
    sg.addColorStop(0, 'rgba(0,0,0,0.7)');
    sg.addColorStop(1, 'transparent');
    X.fillStyle = sg;
    X.fillRect(sx - 55, 0, 110, 90);
  });
  X.restore();
}

// ── Stone walls ────────────────────────────────────────────

function drawWalls(t) {
  const wallW = 58;
  // Left wall
  X.fillStyle = STONE_DK;
  X.fillRect(0, 90, wallW, VAULT_FLOOR - 90);
  X.fillStyle = '#3a1e06';
  X.fillRect(wallW - 3, 90, 3, VAULT_FLOOR - 90);
  // Right wall
  X.fillStyle = STONE_DK;
  X.fillRect(CW - wallW, 90, wallW, VAULT_FLOOR - 90);
  X.fillStyle = '#3a1e06';
  X.fillRect(CW - wallW, 90, 3, VAULT_FLOOR - 90);
  // Wall block joints
  for (let side = 0; side < 2; side++) {
    const wx = side === 0 ? 0 : CW - wallW;
    for (let row = 0; row < 8; row++) {
      X.fillStyle = '#1e0e02';
      X.fillRect(wx, 100 + row * 44, wallW, 1);
    }
  }
  drawCurseInscriptions(t);
  drawMummyNiches(t);
}

// ── Curse inscriptions (in red, not decorative gold) ─────

function drawCurseInscriptions(t) {
  const flicker = 0.7 + 0.3 * Math.sin(t / 400);
  X.save();
  X.globalAlpha = 0.55 * flicker;
  X.fillStyle = '#8a1010';
  X.font = '4px monospace';
  X.textAlign = 'center';

  // Left wall inscription — vertical strip
  const leftLines = ['DEATH', 'COMES', 'ON', 'SWIFT', 'WINGS', 'TO', 'HIM', 'WHO', 'DISTURBS'];
  leftLines.forEach((line, i) => {
    X.fillText(line, 29, 120 + i * 26);
  });

  // Right wall inscription
  const rightLines = ['THE', 'REST', 'OF', 'THE', 'SPHINX', '⌖', 'IS', 'ETERNAL', 'DEBT'];
  rightLines.forEach((line, i) => {
    X.fillText(line, CW - 29, 120 + i * 26);
  });

  X.textAlign = 'left';
  X.restore();
}

// ── Mummy niches in the walls ─────────────────────────────
// Four guardians, two per side. Standing, wrapped, arms crossed.
// They have been here longer than the stele.

function drawMummyNiches(t) {
  const niches = [
    { x: 8,       y: 200, side: 'L' },
    { x: 8,       y: 320, side: 'L' },
    { x: CW - 58, y: 200, side: 'R' },
    { x: CW - 58, y: 320, side: 'R' },
  ];
  niches.forEach(({ x, y, side }, idx) => {
    const nw = 44, nh = 100;

    // Niche recess
    X.fillStyle = '#0e0600';
    X.fillRect(x + 4, y, nw - 8, nh);
    X.fillStyle = STONE_SH;
    X.fillRect(x + 2, y - 2, nw - 4, 3);  // lintel
    X.fillRect(x + 2, y, 2, nh);            // left jamb
    X.fillRect(x + nw - 4, y, 2, nh);       // right jamb

    // Mummy body — linen wrappings
    const mx = x + nw / 2;
    const mbase = y + nh - 2;
    const LINEN = '#a09060';
    const LINEN_DK = '#706040';
    const LINEN_SH = '#504030';

    // Feet/base
    X.fillStyle = LINEN_DK;
    X.fillRect(mx - 7, mbase - 12, 14, 12);

    // Legs — horizontal wrap lines
    X.fillStyle = LINEN;
    X.fillRect(mx - 6, mbase - 48, 12, 36);
    X.fillStyle = LINEN_SH;
    for (let w = 0; w < 5; w++) X.fillRect(mx - 6, mbase - 12 - w * 7, 12, 1);

    // Torso (wider, arms crossed)
    X.fillStyle = LINEN;
    X.fillRect(mx - 8, mbase - 72, 16, 26);
    // Crossed arms (X shape on torso)
    X.fillStyle = LINEN_DK;
    X.fillRect(mx - 8, mbase - 68, 16, 2);  // arm band
    X.fillRect(mx - 8, mbase - 60, 16, 2);  // arm band

    // Neck
    X.fillStyle = LINEN_DK;
    X.fillRect(mx - 4, mbase - 78, 8, 8);

    // Head — oval, tightly wrapped
    X.fillStyle = LINEN;
    X.fillRect(mx - 7, mbase - 96, 14, 20);
    X.fillStyle = LINEN_DK;
    X.fillRect(mx - 7, mbase - 96, 14, 3);  // top wrap
    X.fillRect(mx - 7, mbase - 88, 14, 1);  // forehead wrap
    X.fillRect(mx - 7, mbase - 82, 14, 1);  // cheek wrap

    // Eyes — hollow dark sockets that seem to track
    const eyeA = 0.55 + 0.45 * Math.sin(t / (800 + idx * 130) + idx);
    X.save();
    X.globalAlpha = eyeA;
    X.fillStyle = '#1a0800';
    X.fillRect(mx - 5, mbase - 92, 4, 3);
    X.fillRect(mx + 1, mbase - 92, 4, 3);
    // Faint eye-glow
    X.globalAlpha = eyeA * 0.4;
    X.fillStyle = '#ff2200';
    X.fillRect(mx - 4, mbase - 91, 2, 1);
    X.fillRect(mx + 2, mbase - 91, 2, 1);
    X.restore();
  });
}

// ── Staircase opening ─────────────────────────────────────

function drawStaircaseOpening(t) {
  const stairX = 108;
  const stairW = 72;
  // Dark shaft in ceiling
  X.fillStyle = '#030100';
  X.fillRect(stairX, 0, stairW, 94);
  // Stone frame
  X.fillStyle = STONE_SH;
  X.strokeStyle = STONE_SH;
  X.lineWidth = 2;
  X.strokeRect(stairX - 1, 0, stairW + 2, 95);
  // Daylight bleeding down from the oasis
  X.save();
  X.globalAlpha = 0.18 + 0.05 * Math.sin(t / 1300);
  const og = X.createLinearGradient(stairX, 0, stairX, 90);
  og.addColorStop(0, '#c08820');
  og.addColorStop(1, 'transparent');
  X.fillStyle = og;
  X.fillRect(stairX, 0, stairW, 90);
  X.restore();
  // [↑] EXIT hint
  const ha = 0.45 + 0.45 * Math.abs(Math.sin(t / 560));
  X.save();
  X.globalAlpha = ha;
  X.font = '5px monospace';
  X.textAlign = 'center';
  X.fillStyle = '#c07820';
  X.fillText('[↑] ASCEND', stairX + stairW / 2, 88);
  X.textAlign = 'left';
  X.restore();
}

// ── Apophis serpent on the ceiling ───────────────────────
// A massive serpent, mouth open, consuming a row of small figures.
// The tail is in its own mouth. It has been here since before the pharaohs.

function drawApophis(t) {
  const serpentY = 58;
  const sway = Math.sin(t / 2200) * 3;

  X.save();
  X.globalAlpha = 0.40 + 0.08 * Math.sin(t / 1600);

  // Body — segmented coils spanning the ceiling
  const SCALE_A = '#1a0808';
  const SCALE_B = '#2a1010';
  const segments = 22;
  for (let i = 0; i < segments; i++) {
    const pct = i / segments;
    const sx  = 200 + pct * (CW - 320);
    const sy  = serpentY + sway * Math.sin(pct * Math.PI * 3);
    const sw  = 12 - pct * 4;  // tapers toward tail
    X.fillStyle = i % 2 === 0 ? SCALE_A : SCALE_B;
    X.fillRect(Math.round(sx), Math.round(sy - sw / 2), Math.round(sw * 2.5), Math.round(sw));
    // Scale detail
    if (i % 3 === 0) {
      X.fillStyle = '#380e0e';
      X.fillRect(Math.round(sx + 2), Math.round(sy - sw / 2), Math.round(sw * 2.5 - 4), 2);
    }
  }

  // Head — open mouth, fangs
  const hx = 185;
  const hy = serpentY + sway;
  X.fillStyle = '#2a0c0c';
  X.fillRect(hx - 18, hy - 12, 24, 22);   // head
  X.fillStyle = '#4a1010';
  X.fillRect(hx - 22, hy - 6, 8, 10);     // upper jaw
  X.fillRect(hx - 22, hy + 2, 8, 8);      // lower jaw
  // Fangs
  X.fillStyle = '#d0c080';
  X.fillRect(hx - 20, hy - 5, 2, 6);
  X.fillRect(hx - 16, hy - 4, 2, 5);
  // Eye — glowing
  X.globalAlpha = (0.7 + 0.3 * Math.sin(t / 400));
  X.fillStyle = '#ff3300';
  X.fillRect(hx - 14, hy - 9, 4, 4);
  X.globalAlpha = 0.5;
  X.fillStyle = '#ff8800';
  X.fillRect(hx - 13, hy - 8, 2, 2);

  // Swallowed figures — small silhouettes entering mouth
  X.globalAlpha = 0.35;
  X.fillStyle = '#1a0800';
  for (let f = 0; f < 4; f++) {
    const fx = hx - 52 - f * 18;
    // Tiny pharaoh silhouette
    X.fillRect(fx,     hy - 8, 6, 10);   // body
    X.fillRect(fx + 1, hy - 13, 4, 6);   // head
    X.fillRect(fx + 5, hy - 2,  4, 2);   // arm
  }

  // Tail in mouth (ouroboros — it is eating itself)
  const tx = CW - 185;
  const ty = serpentY - sway;
  X.globalAlpha = 0.38;
  X.fillStyle = '#2a0c0c';
  X.fillRect(tx - 10, ty - 8, 18, 16);   // tail-head (same mouth)
  X.fillRect(tx + 4,  ty - 5, 6, 8);     // mouth open
  // The last segments curling into the mouth
  X.fillStyle = SCALE_A;
  X.fillRect(tx - 4, ty - 10, 4, 4);
  X.fillRect(tx,     ty - 12, 3, 3);

  X.restore();
}

// ── Ritual circle ──────────────────────────────────────────
// Burned into the floor. Used many times. The char is deep.

function drawRitualCircle(cx, fy, t) {
  const r1 = 110, r2 = 90, r3 = 60;
  const burnA = 0.70;

  X.save();
  // Outer char ring
  X.globalAlpha = burnA;
  X.strokeStyle = '#1a0802';
  X.lineWidth = 6;
  X.beginPath(); X.arc(cx, fy - 4, r1, 0, Math.PI * 2); X.stroke();

  // Middle ring with notches at cardinal points
  X.lineWidth = 3;
  X.strokeStyle = '#250e04';
  X.beginPath(); X.arc(cx, fy - 4, r2, 0, Math.PI * 2); X.stroke();

  // Inner ring — still faintly warm from the last use
  const warmGlow = 0.06 + 0.04 * Math.sin(t / 2000);
  X.strokeStyle = BLOOD;
  X.lineWidth = 2;
  X.beginPath(); X.arc(cx, fy - 4, r3, 0, Math.PI * 2); X.stroke();

  // Cardinal marks (N/S/E/W radial lines burned into floor)
  X.strokeStyle = '#1a0802';
  X.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    X.beginPath();
    X.moveTo(cx + Math.cos(angle) * r3, fy - 4 + Math.sin(angle) * r3);
    X.lineTo(cx + Math.cos(angle) * r1, fy - 4 + Math.sin(angle) * r1);
    X.stroke();
  }

  // Eight-pointed radial scratches
  X.strokeStyle = '#120604';
  X.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    X.beginPath();
    X.moveTo(cx + Math.cos(angle) * (r3 + 10), fy - 4 + Math.sin(angle) * (r3 + 10));
    X.lineTo(cx + Math.cos(angle) * r2, fy - 4 + Math.sin(angle) * r2);
    X.stroke();
  }

  // Blood staining — old dark pools at cardinal marks
  X.globalAlpha = 0.45;
  const bloodPts = [
    [cx, fy - 4 - r2 + 8],
    [cx + r2 - 8, fy - 4],
    [cx, fy - 4 + r2 - 8],
    [cx - r2 + 8, fy - 4],
  ];
  bloodPts.forEach(([bx, by]) => {
    const bg = X.createRadialGradient(bx, by, 0, bx, by, 18);
    bg.addColorStop(0, BLOOD);
    bg.addColorStop(0.5, BLOOD_LT);
    bg.addColorStop(1, 'transparent');
    X.fillStyle = bg;
    X.fillRect(bx - 20, by - 20, 40, 40);
  });

  // Center residue — something was here at the last ritual
  X.globalAlpha = warmGlow + 0.06;
  const cg = X.createRadialGradient(cx, fy - 4, 0, cx, fy - 4, 24);
  cg.addColorStop(0, BLOOD_LT);
  cg.addColorStop(1, 'transparent');
  X.fillStyle = cg;
  X.fillRect(cx - 26, fy - 30, 52, 52);

  X.globalAlpha = 1;
  X.restore();
}

// ── Sacrificial altar ─────────────────────────────────────
// Stone slab, shoulder-height, dark with old stains.
// Implements hang from hooks above.

function drawAltar(ax, fy, t, steleRead, vaultOpened) {
  const aw = 70, ah = 52;
  const ay = fy - ah;

  // Altar base
  X.fillStyle = STONE_DK;
  X.fillRect(ax - aw / 2 - 3, ay - 2, aw + 6, ah + 4);
  X.fillStyle = STONE_SH;
  X.fillRect(ax - aw / 2, ay, aw, ah);
  X.fillStyle = STONE;
  X.fillRect(ax - aw / 2, ay, aw, 5);   // top edge light

  // Top slab — the working surface
  X.fillStyle = '#3a1e06';
  X.fillRect(ax - aw / 2 - 4, ay - 6, aw + 8, 10);
  X.fillStyle = '#2a1204';
  X.fillRect(ax - aw / 2 - 4, ay - 6, aw + 8, 3);

  // Blood grooves (channels carved to drain)
  X.fillStyle = BLOOD_LT;
  X.fillRect(ax - aw / 2 + 8, ay - 5, 2, 8);
  X.fillRect(ax + aw / 2 - 10, ay - 5, 2, 8);
  X.fillRect(ax - 1, ay - 6, 2, 9);

  // Old dark staining over the whole top
  X.save();
  X.globalAlpha = 0.60;
  const stg = X.createRadialGradient(ax, ay, 0, ax, ay, aw / 2);
  stg.addColorStop(0, BLOOD);
  stg.addColorStop(0.6, BLOOD_LT);
  stg.addColorStop(1, 'transparent');
  X.fillStyle = stg;
  X.fillRect(ax - aw / 2 - 4, ay - 8, aw + 8, 12);
  X.restore();

  // Implements hanging from ceiling above altar — hooks, chains, blades
  const hookY = 92;
  X.fillStyle = '#505050';
  X.fillRect(ax - 20, hookY, 1, ay - hookY);  // chain left
  X.fillRect(ax,      hookY, 1, ay - hookY);  // chain center
  X.fillRect(ax + 20, hookY, 1, ay - hookY);  // chain right
  // Hook tips (slightly curved)
  X.fillRect(ax - 22, ay - 20, 5, 1);
  X.fillRect(ax - 2,  ay - 15, 4, 1);
  X.fillRect(ax + 18, ay - 18, 5, 1);
  // Blade on center chain (ancient obsidian knife)
  X.fillStyle = '#181818';
  X.fillRect(ax - 2, ay - 30, 4, 16);
  X.fillStyle = '#383838';
  X.fillRect(ax - 1, ay - 30, 2, 14);

  // Canopic jars arranged around the altar base (guardian spirits)
  const jarPositions = [ax - 44, ax - 30, ax + 26, ax + 40];
  jarPositions.forEach((jx, i) => {
    drawCanopicJar(jx, fy, i);
  });

  // ── Water seeping from altar base when vault opened ──────
  if (vaultOpened) {
    const seepA = 0.35 + 0.20 * Math.sin(t / 600);
    X.save();
    X.globalAlpha = seepA;
    // Teal-blue glow bleeding from the stone joints
    const sg = X.createRadialGradient(ax, fy - 4, 2, ax, fy - 4, 44);
    sg.addColorStop(0, '#00ccaa');
    sg.addColorStop(0.5, '#006655');
    sg.addColorStop(1, 'transparent');
    X.fillStyle = sg;
    X.fillRect(ax - 48, fy - 52, 96, 56);
    // Crack lines with water light
    X.globalAlpha = 0.5 + 0.3 * Math.sin(t / 300);
    X.strokeStyle = '#00ffcc';
    X.lineWidth = 1;
    X.beginPath();
    X.moveTo(ax - 6, fy - 4);
    X.lineTo(ax - 2, fy - 22);
    X.lineTo(ax + 4, fy - 14);
    X.stroke();
    X.beginPath();
    X.moveTo(ax + 8, fy - 4);
    X.lineTo(ax + 12, fy - 18);
    X.stroke();
    // Rising water drop particles
    const drops = 5;
    for (let d = 0; d < drops; d++) {
      const phase  = (t / 1200 + d * 0.2) % 1;
      const dropX  = ax - 10 + d * 6 + Math.sin(t / 400 + d) * 3;
      const dropY  = (fy - 4) - phase * 32;
      X.globalAlpha = (1 - phase) * 0.7;
      X.fillStyle = '#88eedd';
      X.fillRect(Math.round(dropX), Math.round(dropY), 2, 3);
    }
    X.restore();
  }

  // ── Altar interaction hint ────────────────────────────────
  if (steleRead && !vaultOpened) {
    const ha = 0.5 + 0.5 * Math.abs(Math.sin(t / 440));
    X.save();
    X.globalAlpha = ha;
    // Subtle pulse glow on altar surface
    const pg = X.createRadialGradient(ax, ay - 2, 2, ax, ay - 2, 38);
    pg.addColorStop(0, 'rgba(0,200,150,0.3)');
    pg.addColorStop(1, 'transparent');
    X.fillStyle = pg;
    X.fillRect(ax - 40, ay - 20, 80, 28);
    X.restore();
  }
}

function drawCanopicJar(jx, fy, variant) {
  const jh = 20 + (variant % 2) * 4;
  const jw = 10;
  const jy = fy - jh;
  // Jar body
  X.fillStyle = '#7a5018';
  X.fillRect(jx - jw / 2, jy, jw, jh);
  X.fillStyle = '#9a6828';
  X.fillRect(jx - jw / 2, jy, jw, 3);
  // Lid — different animal heads per variant
  X.fillStyle = '#9a7030';
  X.fillRect(jx - 5, jy - 8, 10, 10);  // base of lid
  X.fillStyle = '#7a5018';
  // Animal head silhouette (jackal / ibis / falcon / human)
  switch (variant % 4) {
    case 0:  // Jackal (Duamutef)
      X.fillRect(jx - 3, jy - 16, 6, 9);
      X.fillRect(jx - 5, jy - 20, 3, 6);
      X.fillRect(jx + 2, jy - 18, 3, 5);
      break;
    case 1:  // Human (Imsety)
      X.fillRect(jx - 4, jy - 16, 8, 9);
      X.fillRect(jx - 3, jy - 20, 6, 5);
      break;
    case 2:  // Falcon (Qebehsenuef)
      X.fillRect(jx - 3, jy - 16, 6, 8);
      X.fillRect(jx - 4, jy - 20, 8, 5);
      X.fillRect(jx - 5, jy - 17, 2, 3);
      X.fillRect(jx + 3, jy - 17, 2, 3);
      break;
    case 3:  // Baboon (Hapy)
      X.fillRect(jx - 4, jy - 16, 8, 9);
      X.fillRect(jx - 3, jy - 21, 6, 7);
      X.fillRect(jx - 5, jy - 18, 2, 5);
      X.fillRect(jx + 3, jy - 18, 2, 5);
      break;
  }
}

// ── Shadow figures at the edge of vision ─────────────────
// They are not there when you look directly. They are always there.

function drawShadowFigures(px, t) {
  const figures = [
    { x: 90,      bias: -1 },  // left edge
    { x: CW - 90, bias:  1 },  // right edge
  ];
  figures.forEach(({ x, bias }) => {
    // Only visible when player is looking the other way
    const dist = Math.abs(px - x);
    const visible = dist > 280;
    if (!visible) return;

    const fadeIn = Math.min(1, (dist - 280) / 120);
    const bob    = Math.sin(t / 1400 + x * 0.01) * 3;
    const flick  = 0.12 + 0.08 * Math.sin(t / 300 + x);

    X.save();
    X.globalAlpha = flick * fadeIn;
    X.fillStyle = '#0a0400';

    const fx = x;
    const fy = VAULT_FLOOR;

    // Standing figure silhouette — slightly taller than a mummy
    X.fillRect(fx - 6, fy - 90 + bob, 12, 30);   // torso
    X.fillRect(fx - 5, fy - 60 + bob, 10, 36);   // lower body
    X.fillRect(fx - 7, fy - 96 + bob, 14, 8);    // head
    // Outstretched arm (reaching slightly)
    X.fillRect(fx + (bias * 6), fy - 78 + bob, bias * 16, 3);

    X.restore();
  });
}

// ── Blood trail from staircase to altar ──────────────────

function drawBloodTrail(t) {
  const startX = 145;
  const endX   = 410;
  const fy     = VAULT_FLOOR - 2;

  X.save();
  X.globalAlpha = 0.45;

  // Main trail — irregular drips and smears
  for (let i = 0; i < 18; i++) {
    const pct = i / 18;
    const bx  = startX + pct * (endX - startX) + ((i * 37) % 14) - 7;
    const by  = fy - ((i * 11) % 4);
    const bw  = 3 + (i % 4);
    const bh  = 2 + (i % 3);
    X.fillStyle = i % 3 === 0 ? BLOOD : BLOOD_LT;
    X.fillRect(bx, by, bw, bh);
  }

  // Drag smear (something was dragged, not walked)
  X.globalAlpha = 0.25;
  X.fillStyle = BLOOD;
  X.fillRect(startX + 20, fy - 1, endX - startX - 30, 2);

  X.restore();
}

// ── Floor ─────────────────────────────────────────────────

function drawFloor(t) {
  X.fillStyle = STONE_SH;
  X.fillRect(0, VAULT_FLOOR, CW, CH - VAULT_FLOOR);
  // Slab joints
  X.fillStyle = STONE_DK;
  X.fillRect(0, VAULT_FLOOR, CW, 2);
  X.fillStyle = '#220e02';
  for (let fx = 90; fx < CW; fx += 130) X.fillRect(fx, VAULT_FLOOR, 1, CH - VAULT_FLOOR);
  for (let fy = VAULT_FLOOR + 28; fy < CH; fy += 40) X.fillRect(0, fy, CW, 1);
}

// ── Torches ───────────────────────────────────────────────

function drawTorch(tx, ty, t, phase) {
  const flicker = Math.sin(t / 120 + phase) * 0.3 + Math.sin(t / 77 + phase * 2.1) * 0.2;

  // Wall glow cone
  X.save();
  X.globalAlpha = 0.14 + 0.06 * Math.abs(flicker);
  const tg = X.createRadialGradient(tx, ty - 8, 1, tx, ty - 8, 72);
  tg.addColorStop(0, '#f04010');
  tg.addColorStop(0.5, '#801808');
  tg.addColorStop(1, 'transparent');
  X.fillStyle = tg;
  X.fillRect(tx - 72, ty - 72, 144, 100);
  X.restore();

  // Bracket
  X.fillStyle = STONE_SH;
  X.fillRect(tx - 3, ty + 6, 6, 14);
  X.fillRect(tx - 7, ty + 18, 14, 3);

  // Torch body (charred wood)
  X.fillStyle = '#2a1004';
  X.fillRect(tx - 2, ty - 2, 4, 12);

  // Flame — dark red/orange, not cheerful gold
  const fh = 12 + Math.round(flicker * 4);
  X.save();
  X.globalAlpha = 0.85 + flicker * 0.1;
  X.fillStyle = '#c83010';
  X.fillRect(tx - 3, ty - fh, 6, fh);
  X.globalAlpha = 0.65;
  X.fillStyle = '#f05020';
  X.fillRect(tx - 2, ty - fh + 3, 4, fh - 3);
  X.globalAlpha = 0.4;
  X.fillStyle = '#f08030';
  X.fillRect(tx - 1, ty - fh + 6, 2, fh - 6);
  X.restore();
}

// ── Dream Stele ───────────────────────────────────────────

function drawStele(cx, fy, t, isRead) {
  const sw = 62, sh = 140;
  const sx = cx - sw / 2;
  const sy = fy - sh;

  const GRANITE    = '#4a3014';
  const GRANITE_LT = '#6a4820';
  const GRANITE_DK = '#2a1808';
  const CARVE      = '#c07820';

  // Base slab
  X.fillStyle = GRANITE_DK;
  X.fillRect(sx - 8, fy - 6, sw + 16, 10);
  X.fillStyle = STONE_SH;
  X.fillRect(sx - 6, fy - 6, sw + 12, 4);

  // Stele body — dark granite
  X.fillStyle = GRANITE_DK;
  X.fillRect(sx - 2, sy - 2, sw + 4, sh + 2);
  X.fillStyle = GRANITE;
  X.fillRect(sx, sy, sw, sh);
  X.fillStyle = GRANITE_LT;
  X.fillRect(sx, sy, sw, 5);
  X.fillRect(sx, sy, 3, sh);
  X.fillStyle = GRANITE_DK;
  X.fillRect(sx + sw - 3, sy, 3, sh);

  // Lunette top
  X.fillStyle = GRANITE;
  X.beginPath();
  X.arc(cx, sy + 10, sw / 2, Math.PI, 0, false);
  X.fill();
  X.fillStyle = GRANITE_LT;
  X.beginPath();
  X.arc(cx, sy + 10, sw / 2 - 1, Math.PI, 0, false);
  X.fill();

  // Carved scenes (same as before — the story of the dream and the promise)
  X.fillStyle = CARVE;
  X.save();
  // Lunette: sun + sphinx
  X.globalAlpha = 0.5;
  X.beginPath(); X.arc(cx, sy + 4, 7, 0, Math.PI * 2); X.fill();
  X.fillRect(cx - 1, sy - 4, 2, 8);
  X.fillRect(cx - 7, sy + 4, 14, 1);
  X.fillRect(cx - 14, sy + 12, 28, 5);
  X.fillRect(cx - 14, sy + 9, 10, 3);
  // Register lines
  X.globalAlpha = 0.25;
  for (let r = 0; r < 6; r++) X.fillRect(sx + 6, sy + 22 + r * 18, sw - 12, 1);
  // Carved figures (abbreviated — same scenes as before)
  X.globalAlpha = 0.45;
  // Pharaoh offering
  X.fillRect(cx - 18, sy + 26, 4, 12);
  X.fillRect(cx - 20, sy + 26, 8, 3);
  X.fillRect(cx - 14, sy + 33, 6, 2);
  X.fillRect(cx + 2, sy + 32, 16, 6);
  X.fillRect(cx + 2, sy + 28, 7, 5);
  // Sleeping / dream figure
  X.fillRect(cx - 20, sy + 88, 28, 4);
  X.fillRect(cx - 20, sy + 84, 8, 5);
  X.fillRect(cx - 8, sy + 80, 18, 4);
  X.fillRect(cx - 8, sy + 76, 6, 4);
  X.restore();

  // Blood pooled at the base of the stele — the three princes who failed
  X.save();
  X.globalAlpha = 0.40;
  const poolG = X.createRadialGradient(cx, fy - 2, 2, cx, fy - 2, 32);
  poolG.addColorStop(0, BLOOD);
  poolG.addColorStop(0.5, BLOOD_LT);
  poolG.addColorStop(1, 'transparent');
  X.fillStyle = poolG;
  X.fillRect(cx - 35, fy - 8, 70, 12);
  X.restore();

  // Post-read glow — the stele recognises you
  if (isRead) {
    const readGlow = 0.08 + 0.06 * Math.sin(t / 800);
    X.save();
    X.globalAlpha = readGlow;
    const rg = X.createRadialGradient(cx, sy + sh / 2, 8, cx, sy + sh / 2, sw + 18);
    rg.addColorStop(0, '#d08010');
    rg.addColorStop(1, 'transparent');
    X.fillStyle = rg;
    X.fillRect(sx - 22, sy - 18, sw + 44, sh + 36);
    X.restore();
  }

  // Hint when stele is unread
  if (!isRead) {
    const ha = 0.5 + 0.5 * Math.abs(Math.sin(t / 480));
    X.save();
    X.globalAlpha = ha;
    X.font = '5px monospace';
    X.textAlign = 'center';
    X.fillStyle = '#c07820';
    X.fillText('[SPACE] READ THE INSCRIPTION', cx, sy - 10);
    X.textAlign = 'left';
    X.restore();
  }
}

// ── HUD ───────────────────────────────────────────────────

function drawHUD(vaultOpened) {
  X.fillStyle = '#060200';
  X.fillRect(0, CH - 28, CW, 28);
  X.fillStyle = STONE_DK;
  X.fillRect(0, CH - 28, CW, 1);
  X.font = '6px monospace';
  X.fillStyle = '#7a4810';
  X.fillText('BENEATH THE SPHINX', 8, CH - 10);
  X.textAlign = 'center';
  X.fillStyle = '#a06820';
  const hint = vaultOpened
    ? '← → MOVE     [SPACE] EXAMINE     [↑] ASCEND  ✦  PASSAGE OPEN'
    : '← → MOVE     [SPACE] EXAMINE     [↑] ASCEND';
  X.fillText(hint, CW / 2, CH - 10);
  X.textAlign = 'left';
}

// ── Master draw ───────────────────────────────────────────

export function drawVault(realm) {
  const t          = Date.now();
  const steleRead  = Flags.get('stele_read')         || false;
  const vaultOpened= Flags.get('atlantis_vault_opened') || false;
  const circleCX   = Math.round(CW * 0.58);   // ritual circle center — slightly right

  drawBG();
  drawApophis(t);
  drawWalls(t);
  drawFloor(t);
  drawStaircaseOpening(t);

  // Torches — dimmer and redder than typical
  drawTorch(82,          VAULT_FLOOR - 92, t, 0.0);
  drawTorch(CW - 82,     VAULT_FLOOR - 92, t, 1.8);
  drawTorch(220,         VAULT_FLOOR - 75, t, 3.1);
  drawTorch(CW - 220,    VAULT_FLOOR - 75, t, 0.9);

  drawBloodTrail(t);
  drawRitualCircle(circleCX, VAULT_FLOOR, t);

  // Altar — between the ritual circle and the stele; now a gate when stele is read
  drawAltar(ALTAR_X, VAULT_FLOOR, t, steleRead, vaultOpened);

  drawStele(STELE_X, VAULT_FLOOR, t, steleRead);

  // Altar proximity hint (screen-space, so not affected by camera)
  if (steleRead && !vaultOpened) {
    const nearAltar = Math.abs(realm.px - ALTAR_X) < 70;
    if (nearAltar) {
      const ha = 0.55 + 0.45 * Math.abs(Math.sin(t / 380));
      X.save();
      X.globalAlpha = ha;
      X.font = '6px monospace';
      X.textAlign = 'center';
      X.fillStyle = '#00ffcc';
      X.fillText('[SPACE] THE ALTAR AWAITS', CW / 2, VAULT_FLOOR - 100);
      X.textAlign = 'left';
      X.restore();
    }
  }

  // Shadow figures (appear at room edges when player looks away)
  drawShadowFigures(realm.px, t);

  drawVaultPharaoh(realm);
  drawHUD(vaultOpened);
}
