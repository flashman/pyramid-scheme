// ── FILE: worlds/oasis/draw/oasis.js ────────────────────
// World-space scrolling oasis scene.
// Sky/BG drawn in screen space; ground objects drawn under X.translate(-camX, 0).

import { X, CW, CH }         from '../../../engine/canvas.js';
import { COL }               from '../../../engine/colors.js';
import { OASIS_FLOOR,
         POOL_WX, POOL_WIDTH,
         SPHINX_WX,
         PASSAGE_WX,
         POOL_CENTER_WX,
         POOL_DIVE_RANGE }   from '../constants.js';
import { drawPharaoh }       from '../../../draw/pharaoh.js';
import { RiddleManager }     from '../riddles.js';
import { Flags }             from '../../../engine/flags.js';

// ── Sky ──────────────────────────────────────────────────

function drawOasisSky() {
  const sk = X.createLinearGradient(0, 0, 0, CH);
  sk.addColorStop(0.00, '#14082e');  // deep indigo at zenith
  sk.addColorStop(0.35, '#2e1860');  // purple mid
  sk.addColorStop(0.65, '#b83808');  // burnt orange near horizon
  sk.addColorStop(1.00, '#d08018');  // gold at sand line
  X.fillStyle = sk;
  X.fillRect(0, 0, CW, CH);
}

// ── Sparse stars (screen-space, golden hour) ──────────────

const _oStars = (() => {
  const s = []; let seed = 0xfade1234;
  const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed >>> 0) / 0xffffffff; };
  for (let i = 0; i < 22; i++) s.push([Math.floor(r() * CW), Math.floor(r() * 150), r()]);
  return s;
})();

function drawOasisStars(t) {
  _oStars.forEach(([sx, sy, p]) => {
    const blink = Math.sin(t / 700 + p * 6.28) > 0.5;
    X.globalAlpha = (0.15 + p * 0.25) * (blink ? 0.85 : 0.3);
    X.fillStyle   = '#ffe0a0';
    X.fillRect(sx, sy, 1, 1);
  });
  X.globalAlpha = 1;
}

// ── Horizon dunes (screen-space parallax) ─────────────────

function drawHorizonDunes(camX) {
  const hy = OASIS_FLOOR - 130;
  const off = (camX * 0.15) % 600;

  X.save();
  X.globalAlpha = 0.55;
  X.fillStyle = '#b06810';
  X.beginPath();
  X.moveTo(0, hy + 30);
  X.quadraticCurveTo(120 - off % 110, hy - 24, 240 - off % 90, hy + 8);
  X.quadraticCurveTo(360 - off % 130, hy - 36, 480 - off % 100, hy + 4);
  X.quadraticCurveTo(600 - off % 80,  hy - 28, 720 - off % 110, hy + 10);
  X.quadraticCurveTo(CW, hy - 16, CW, hy + 6);
  X.lineTo(CW, CH); X.lineTo(0, CH);
  X.fill();
  X.restore();

  // Horizon glow
  X.save();
  X.globalAlpha = 0.22;
  const haze = X.createLinearGradient(0, hy - 24, 0, hy + 70);
  haze.addColorStop(0, 'transparent');
  haze.addColorStop(0.5, '#e09820');
  haze.addColorStop(1, 'transparent');
  X.fillStyle = haze;
  X.fillRect(0, hy - 24, CW, 94);
  X.restore();
}

// ── Ground (world-space, drawn after translate) ───────────

function drawOasisGround(worldW) {
  const gy = OASIS_FLOOR;
  // Main sand
  const sg = X.createLinearGradient(0, gy, 0, gy + 100);
  sg.addColorStop(0, '#d4a030');
  sg.addColorStop(1, '#b07820');
  X.fillStyle = sg;
  X.fillRect(0, gy, worldW, 100);

  // Sand texture dots (world-space grid)
  X.fillStyle = '#c09020';
  for (let i = 0; i < 400; i++) {
    const gx = (i * 41) % worldW;
    const dot = gy + ((i * 19) % 52) + 2;
    X.fillRect(gx, dot, 2, 1);
  }

  // Ground shadow at floor line
  X.save();
  X.globalAlpha = 0.28;
  X.fillStyle = '#7a5010';
  X.fillRect(0, gy, worldW, 5);
  X.restore();
}

// ── Pool (world-space, left portion of scene) ─────────────
// Large body of still water. Player can wade in.
// Reflection changes based on riddles solved (prophetic vision).

function drawPool(t, playerWX, riddlesSolved) {
  const wx = POOL_WX;
  const ww = POOL_WIDTH;
  const wy = OASIS_FLOOR - 2;
  const wh = 52;

  // Pool shadow on sand
  X.save();
  X.globalAlpha = 0.35;
  X.fillStyle = '#2a1800';
  X.fillRect(wx + 10, wy + wh - 4, ww, 14);
  X.restore();

  // Water body — deep gradient
  const wg = X.createLinearGradient(wx, wy, wx, wy + wh);
  wg.addColorStop(0.0, '#1a90d0');
  wg.addColorStop(0.4, '#0e68a8');
  wg.addColorStop(1.0, '#083a68');
  X.fillStyle = wg;
  X.fillRect(wx, wy, ww, wh);

  // ── Prophetic reflection surface ──────────────────────────
  // 0 riddles: plain warm-sky reflection
  // 1+ riddles: stars begin to appear in the water (a sky that shouldn't exist)
  // 2+ riddles: golden archway shimmer reflected
  // 3+ riddles: full golden gate glow reflected
  if (riddlesSolved === 0) {
    // Plain golden-hour sky reflection
    X.save();
    X.globalAlpha = 0.22;
    X.fillStyle = '#d08018';
    X.fillRect(wx, wy, ww, 14);
    X.restore();
  } else {
    // Stars appearing in the water — they shouldn't be there at dusk
    X.save();
    const starCount = Math.min(24, riddlesSolved * 8 + 8);
    let seed = 0xabc123;
    const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed >>> 0) / 0xffffffff; };
    for (let i = 0; i < starCount; i++) {
      const rx = wx + rng() * ww;
      const ry = wy + 4 + rng() * (wh - 14);
      const blink = 0.4 + 0.6 * Math.abs(Math.sin(t / 600 + i * 1.3));
      X.globalAlpha = blink * Math.min(1, riddlesSolved / 2) * 0.85;
      X.fillStyle = '#e8f0ff';
      X.fillRect(rx, ry, 1, 1);
    }
    X.restore();

    if (riddlesSolved >= 2) {
      // Archway silhouette shimmers in the water
      const ax = wx + ww * 0.72;
      const rippleA = 0.18 + 0.10 * Math.sin(t / 900);
      X.save();
      X.globalAlpha = rippleA * Math.min(1, (riddlesSolved - 1) / 2);
      const ag = X.createLinearGradient(ax - 20, wy + 10, ax + 20, wy + wh - 4);
      ag.addColorStop(0, 'transparent');
      ag.addColorStop(0.4, '#f0c020');
      ag.addColorStop(0.6, '#f0c020');
      ag.addColorStop(1, 'transparent');
      X.fillStyle = ag;
      X.fillRect(ax - 24, wy + 8, 48, wh - 16);
      X.restore();
    }

    if (riddlesSolved >= 3) {
      // Full golden gate glow in the water
      X.save();
      X.globalAlpha = 0.28 + 0.12 * Math.sin(t / 700);
      const gg = X.createRadialGradient(wx + ww * 0.72, wy + wh / 2, 4, wx + ww * 0.72, wy + wh / 2, 60);
      gg.addColorStop(0, '#ffe090');
      gg.addColorStop(1, 'transparent');
      X.fillStyle = gg;
      X.fillRect(wx, wy, ww, wh);
      X.restore();
    }
  }

  // Ripple rings (ambient)
  X.save();
  X.globalAlpha = 0.30;
  X.strokeStyle = '#80d8f0';
  X.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const rx  = wx + 60 + i * 90;
    const ry  = wy + 14 + (i % 2) * 14;
    const rw  = 36 + i * 10;
    const bob = Math.sin(t / 900 + i * 1.4) * 3;
    X.beginPath();
    X.ellipse(rx, ry + bob, rw, 5, 0, 0, Math.PI * 2);
    X.stroke();
  }
  X.restore();

  // ── Player splash ripples when wading ─────────────────────
  if (playerWX !== undefined && playerWX >= wx && playerWX <= wx + ww) {
    const screenPX = playerWX;  // world-space, caller is inside translate
    const splashY  = wy + 10;
    X.save();
    const dist = Math.abs(playerWX - (wx + ww / 2)) / (ww / 2);
    X.globalAlpha = 0.60 - dist * 0.2;
    X.strokeStyle = '#a8e8f8';
    X.lineWidth = 1;
    // Two expanding ripple rings centered on player x
    for (let r = 0; r < 2; r++) {
      const phase = ((t / 400) + r * 0.5) % 1;
      const rw2   = 8 + phase * 28;
      const ra    = (1 - phase) * 0.7;
      X.globalAlpha = ra * 0.55;
      X.beginPath();
      X.ellipse(screenPX, splashY, rw2, Math.round(rw2 * 0.25), 0, 0, Math.PI * 2);
      X.stroke();
    }
    // Small wake V behind player
    X.globalAlpha = 0.35;
    X.strokeStyle = '#c0f0ff';
    X.lineWidth = 1;
    X.beginPath();
    X.moveTo(screenPX - 12, splashY + 4);
    X.lineTo(screenPX,      splashY - 2);
    X.lineTo(screenPX + 12, splashY + 4);
    X.stroke();
    X.restore();
  }

  // Shimmer band
  X.save();
  X.globalAlpha = 0.14 + 0.08 * Math.sin(t / 1100);
  X.fillStyle = '#c8f0ff';
  X.fillRect(wx + 10, wy + 5, ww - 20, 8);
  X.restore();

  // Pool rim / shore edge
  X.strokeStyle = '#3888a8';
  X.lineWidth = 1;
  X.strokeRect(wx, wy, ww, wh);

  // Sand shore pebbles
  X.fillStyle = '#a07830';
  for (let i = 0; i < 18; i++) {
    X.fillRect(wx + 10 + i * 27, wy + wh + 1, (i % 3) + 3, 2);
  }
}

// ── Palm tree (world-space) ───────────────────────────────

function drawPalm(wx, baseY, scale, t, sway) {
  const s   = scale || 1;
  const sw  = Math.sin(t / 1600 + sway) * 2.5 * s;
  const bx  = Math.round(wx);
  const by  = Math.round(baseY);
  const trunkH = Math.round(80 * s);

  // Trunk segments
  for (let i = 0; i < 8; i++) {
    const segY  = by - Math.round(i * 10 * s);
    const segX  = bx + Math.round(sw * (i / 7));
    const segW  = Math.max(2, Math.round((6 - i * 0.4) * s));
    X.fillStyle = i % 2 === 0 ? '#7c4c18' : '#5a3410';
    X.fillRect(segX - Math.floor(segW / 2), segY - Math.round(10 * s), segW, Math.round(10 * s) + 1);
  }

  const topX = bx + Math.round(sw);
  const topY = by - trunkH;

  // Crown cap
  X.fillStyle = '#5a3410';
  X.fillRect(topX - Math.round(5 * s), topY, Math.round(10 * s), Math.round(6 * s));

  // Fronds
  const frondColors = ['#3a7a10', '#4a8e18', '#2e6808'];
  const angles = [
    -Math.PI * 0.88, -Math.PI * 0.68, -Math.PI * 0.48,
    -Math.PI * 0.20,  0,
     Math.PI * 0.20,  Math.PI * 0.45,
  ];
  angles.forEach((angle, i) => {
    const len   = Math.round((32 + (i % 3) * 8) * s);
    const droop = angle + Math.sin(t / 1400 + i * 0.9 + sway) * 0.13;
    const ex    = topX + Math.round(Math.cos(droop) * len);
    const ey    = topY + Math.round(Math.sin(droop) * len);
    X.strokeStyle = frondColors[i % 3];
    X.lineWidth   = Math.max(1, Math.round(2 * s));
    X.beginPath(); X.moveTo(topX, topY); X.lineTo(ex, ey); X.stroke();
    // Leaflets
    X.fillStyle = frondColors[i % 3];
    for (let j = 1; j <= 5; j++) {
      const frac = j / 6;
      const lx   = topX + Math.round(Math.cos(droop) * len * frac);
      const ly   = topY + Math.round(Math.sin(droop) * len * frac);
      const lw   = Math.round((7 - j) * s);
      X.fillRect(lx - lw, ly - Math.round(4 * s), lw * 2, Math.round(4 * s));
    }
  });
}

// ── Sphinx (world-space, large, full detail) ───────────────
// cx = world-x center; fy = floor Y. Faces left (player approaches from west).
// riddlesSolved: how many riddles answered — reveals the hidden passage.

function drawSphinx(cx, fy, t, riddlesSolved) {
  const s = n => Math.round(n);

  const STONE    = '#c49028';
  const STONE_LT = '#daa840';
  const STONE_SH = '#8a5e10';
  const STONE_DK = '#6a4608';
  const GOLD     = '#f0c020';
  const BLUE     = '#1848a0';

  // ── Full stone undercoat ─────────────────────────────────
  // Painted first so that any pixel gap between individual parts
  // shows sphinx-stone rather than sky or sand.  Covers the entire
  // lower footprint (paws + body + haunches) in one pass.
  X.fillStyle = STONE;
  X.fillRect(s(cx - 215), s(fy - 175), 455, 175);

  // Shadow on sand
  X.save();
  X.globalAlpha = 0.40;
  X.fillStyle = '#3a1800';
  X.fillRect(s(cx - 160), s(fy - 10), 390, 16);
  X.restore();

  // ── Front paws ───────────────────────────────────────────
  X.fillStyle = STONE;
  X.fillRect(s(cx - 200), s(fy - 24), 130, 24);
  X.fillStyle = STONE_LT;
  X.fillRect(s(cx - 200), s(fy - 24), 130, 6);
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 200), s(fy - 9),  130, 9);
  X.fillStyle = STONE_DK;
  for (let toe = 0; toe < 4; toe++) X.fillRect(s(cx - 192) + toe * 28, s(fy - 8), 4, 8);

  // Rear paw
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 174), s(fy - 18), 108, 18);
  X.fillStyle = STONE;
  X.fillRect(s(cx - 178), s(fy - 20), 110, 18);
  X.fillStyle = STONE_LT;
  X.fillRect(s(cx - 178), s(fy - 20), 110, 5);
  X.fillStyle = STONE_DK;
  for (let toe = 0; toe < 3; toe++) X.fillRect(s(cx - 170) + toe * 30, s(fy - 10), 4, 10);

  // ── Body ─────────────────────────────────────────────────
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 60),  s(fy - 140), 260, 140);
  X.fillStyle = STONE;
  X.fillRect(s(cx - 66),  s(fy - 144), 258, 140);
  X.fillStyle = STONE_LT;
  X.fillRect(s(cx - 66),  s(fy - 144), 258, 18);
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 66),  s(fy - 44),  252, 7);

  // Rear haunch
  X.fillStyle = STONE;
  X.fillRect(s(cx + 162), s(fy - 172), 68, 172);
  X.fillStyle = STONE_LT;
  X.fillRect(s(cx + 162), s(fy - 172), 68, 14);
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx + 218), s(fy - 172), 12, 172);

  // ── Neck ─────────────────────────────────────────────────
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 126), s(fy - 222), 46, 90);
  X.fillStyle = STONE;
  X.fillRect(s(cx - 130), s(fy - 225), 46, 92);

  // ── Nemes headdress flaps ─────────────────────────────────
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 162), s(fy - 360), 38, 180);
  X.fillRect(s(cx - 58),  s(fy - 342), 32, 160);
  X.fillStyle = STONE;
  X.fillRect(s(cx - 166), s(fy - 362), 36, 178);
  X.fillRect(s(cx - 62),  s(fy - 342), 30, 158);

  // Nemes stripes
  for (let stripe = 0; stripe < 10; stripe++) {
    const sy2 = s(fy - 356) + stripe * 18;
    X.fillStyle = stripe % 2 === 0 ? BLUE : STONE;
    X.fillRect(s(cx - 166), sy2, 36, 9);
    X.fillRect(s(cx - 62),  sy2 + 2, 30, 9);
  }

  // Crown band
  X.fillStyle = STONE;
  X.fillRect(s(cx - 148), s(fy - 376), 122, 32);
  X.fillStyle = STONE_LT;
  X.fillRect(s(cx - 148), s(fy - 376), 122, 8);

  // Gold forehead band
  X.fillStyle = GOLD;
  X.fillRect(s(cx - 134), s(fy - 392), 92, 18);
  X.fillStyle = '#b09010';
  X.fillRect(s(cx - 134), s(fy - 392), 92, 4);

  // Uraeus cobra
  const ux = s(cx - 96);
  X.fillStyle = GOLD;
  X.fillRect(ux - 4, s(fy - 428), 8, 38);
  X.fillRect(ux - 9, s(fy - 444), 18, 16);
  X.fillStyle = '#c80000';
  X.fillRect(ux - 5, s(fy - 448), 10, 8);
  X.fillStyle = '#181000';
  X.fillRect(ux - 1, s(fy - 433), 2, 3);

  // ── Head ─────────────────────────────────────────────────
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 144), s(fy - 378), 86, 154);
  X.fillStyle = STONE;
  X.fillRect(s(cx - 148), s(fy - 380), 86, 154);
  X.fillStyle = STONE_LT;
  X.fillRect(s(cx - 148), s(fy - 380), 86, 12);

  // ── Eye socket ───────────────────────────────────────────
  X.fillStyle = STONE_DK;
  X.fillRect(s(cx - 140), s(fy - 348), 30, 20);
  X.fillStyle = '#c89028';
  X.fillRect(s(cx - 137), s(fy - 346), 22, 16);
  X.fillStyle = '#100800';
  X.fillRect(s(cx - 133), s(fy - 344), 12, 11);
  X.fillStyle = '#ffe0a0';
  X.fillRect(s(cx - 131), s(fy - 343), 5, 5);
  // Kohl
  X.fillStyle = STONE_DK;
  X.fillRect(s(cx - 142), s(fy - 346), 4, 18);
  X.fillRect(s(cx - 112), s(fy - 346), 20, 4);

  // ── Nose ─────────────────────────────────────────────────
  X.fillStyle = STONE_LT;
  X.fillRect(s(cx - 138), s(fy - 320), 18, 28);
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 124), s(fy - 320), 6, 28);
  X.fillStyle = STONE_DK;  // missing tip
  X.fillRect(s(cx - 140), s(fy - 296), 24, 12);

  // ── Lips / mouth ─────────────────────────────────────────
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 142), s(fy - 278), 58, 9);
  X.fillStyle = STONE;
  X.fillRect(s(cx - 144), s(fy - 281), 56, 9);
  X.fillStyle = STONE_DK;
  X.fillRect(s(cx - 141), s(fy - 272), 52, 5);

  // Chin
  X.fillStyle = STONE;
  X.fillRect(s(cx - 138), s(fy - 264), 42, 14);

  // ── Beard ────────────────────────────────────────────────
  X.fillStyle = STONE_SH;
  X.fillRect(s(cx - 124), s(fy - 252), 24, 46);
  X.fillStyle = STONE;
  X.fillRect(s(cx - 128), s(fy - 254), 24, 46);
  X.fillStyle = GOLD;
  X.fillRect(s(cx - 128), s(fy - 254), 24, 5);
  X.fillRect(s(cx - 128), s(fy - 212), 24, 5);
  X.fillStyle = STONE;
  X.fillRect(s(cx - 125), s(fy - 210), 18, 12);

  // ── Solid paw base — always present ──────────────────────
  // Fills the gap between the front paws and body so the dark background
  // never shows through, regardless of riddles solved.
  const pbx = s(cx - 154);
  const pbw = 90;
  X.fillStyle = STONE_DK;
  X.fillRect(pbx, s(fy - 66), pbw, 66);
  X.fillStyle = STONE;
  X.fillRect(pbx + 3, s(fy - 64), pbw - 6, 62);
  X.fillStyle = STONE_LT;
  X.fillRect(pbx + 3, s(fy - 64), pbw - 6, 5);
  // Horizontal mortar lines — looks like stone masonry
  X.fillStyle = STONE_SH;
  X.fillRect(pbx + 3, s(fy - 42), pbw - 6, 1);
  X.fillRect(pbx + 3, s(fy - 22), pbw - 6, 1);
  // Side shadow recesses
  X.fillStyle = STONE_SH;
  X.fillRect(pbx, s(fy - 66), 3, 66);
  X.fillRect(pbx + pbw - 3, s(fy - 66), 3, 66);

  // ── Vault staircase between the paws ─────────────────────
  // Revealed after solving the first riddle. Descends into the chamber below.
  if (riddlesSolved > 0) {
    const ax  = s(cx - 148);
    const aw  = 72;

    // Stone lintel / threshold header
    X.fillStyle = STONE;
    X.fillRect(ax - 6, s(fy - 64), aw + 12, 8);
    X.fillStyle = STONE_LT;
    X.fillRect(ax - 6, s(fy - 64), aw + 12, 2);
    X.fillStyle = STONE_DK;
    X.fillRect(ax - 6, s(fy - 57), aw + 12, 1);

    // Dark shaft opening
    X.fillStyle = '#050200';
    X.fillRect(ax, s(fy - 56), aw, 56);

    // Steps — 5, each 10px, narrowing with depth (perspective)
    for (let step = 0; step < 5; step++) {
      const indent = step * 5;
      const sw     = aw - indent * 2;
      const sx2    = ax + indent;
      const sy2    = s(fy - 52) + step * 10;
      // Step riser (front face — lighter)
      X.fillStyle = step % 2 === 0 ? STONE : STONE_SH;
      X.fillRect(sx2, sy2, sw, 3);
      // Step tread (top surface — dark from above)
      X.fillStyle = STONE_DK;
      X.fillRect(sx2, sy2 + 3, sw, 7);
      // Step leading edge shadow
      X.fillStyle = '#050200';
      X.fillRect(sx2, sy2 + 9, sw, 1);
    }

    // Warm amber glow rising from the vault below — grows with riddles solved
    const glowA = Math.min(0.75, (riddlesSolved / 3) * 0.75)
                * (0.88 + 0.12 * Math.sin(t / 700));
    X.save();
    X.globalAlpha = glowA;
    const ig = X.createLinearGradient(ax, s(fy - 56), ax, s(fy));
    ig.addColorStop(0.0, 'transparent');
    ig.addColorStop(0.5, '#a06018');
    ig.addColorStop(1.0, '#f0d060');
    X.fillStyle = ig;
    X.fillRect(ax, s(fy - 56), aw, 56);
    X.restore();

    // Dust motes rising from below (riddles >= 2)
    if (riddlesSolved >= 2) {
      X.save();
      for (let m = 0; m < 6; m++) {
        const mxOff = 8 + (m * 11) % (aw - 16);
        const myPct = 1 - ((t / 1400 + m * 0.16) % 1);
        const my2   = s(fy) - myPct * 50;
        if (my2 < s(fy - 56)) continue;
        X.globalAlpha = 0.5 * myPct * Math.abs(Math.sin(t / 500 + m));
        X.fillStyle = '#ffe0a0';
        X.fillRect(ax + mxOff, my2, 2, 2);
      }
      X.restore();
    }

    // Glow spill onto sand at staircase opening
    X.save();
    X.globalAlpha = 0.10 * glowA;
    const sg = X.createLinearGradient(ax, s(fy - 6), ax, s(fy + 24));
    sg.addColorStop(0, '#f0d060');
    sg.addColorStop(1, 'transparent');
    X.fillStyle = sg;
    X.fillRect(ax - 6, s(fy - 6), aw + 12, 30);
    X.restore();
  }

  // ── Ancient power glow ────────────────────────────────────
  const glow = 0.06 + 0.035 * Math.sin(t / 1800);
  X.save();
  X.globalAlpha = glow;
  const aura = X.createRadialGradient(s(cx - 100), s(fy - 340), 14, s(cx - 100), s(fy - 340), 130);
  aura.addColorStop(0, '#f0c020');
  aura.addColorStop(1, 'transparent');
  X.fillStyle = aura;
  X.fillRect(s(cx - 230), s(fy - 470), 260, 260);
  X.restore();
}

// ── Sphinx proximity hint (screen-space) ──────────────────

function drawSphinxHint(worldPx, camX, t) {
  const screenX = Math.round(SPHINX_WX - camX);
  if (Math.abs(worldPx - SPHINX_WX) > 300) return;
  if (RiddleManager.isActive()) return;

  const ha = 0.5 + 0.5 * Math.abs(Math.sin(t / 460));
  X.save();
  X.globalAlpha = ha;
  X.font = '6px monospace';
  X.textAlign = 'center';
  X.fillStyle = '#f0c020';
  X.fillText('[SPACE] SPEAK TO THE SPHINX', Math.max(100, Math.min(CW - 100, screenX)), 56);
  X.textAlign = 'left';
  X.restore();
}

// ── HUD (screen-space) ────────────────────────────────────

function drawOasisHUD(realm) {
  X.fillStyle = '#100800';
  X.fillRect(0, CH - 28, CW, 28);
  X.fillStyle = '#c89028';
  X.fillRect(0, CH - 28, CW, 1);
  X.font = '6px monospace';
  X.fillStyle = '#a07820';
  X.fillText('THE OASIS', 8, CH - 10);
  X.textAlign = 'center';
  X.fillStyle = '#c89028';
  X.fillText('← → MOVE   [Z] JUMP   [SPACE] SPEAK   (← WALK BACK)', CW / 2, CH - 10);
  X.textAlign = 'right';
  X.fillStyle = '#6a4810';
  X.fillText('EAST OF THE DESERT', CW - 8, CH - 10);
  X.textAlign = 'left';
}

// ── Pool statue: rises after the vault ritual ─────────────
//
// drawPoolStatue(realm, t)
// Nothing is visible until atlantis_vault_opened is set from the vault.
// Then the statue rises from the pool water over a few seconds.
// When fully risen, a dive portal glows at the pool floor.
// Called INSIDE the world-space X.translate(-camX, 0) block.

function drawPoolStatue(realm, t) {
  const vaultOpened = Flags.get('atlantis_vault_opened') || false;
  if (!vaultOpened) return;

  const risen    = realm._statueRisen;
  const progress = realm._statueProgress || 0;  // 0..1
  const wx       = POOL_CENTER_WX;
  const floor    = OASIS_FLOOR;

  // ── Churning water effect when statue is rising ────────
  if (progress > 0 && progress < 1) {
    const churnA = (1 - progress) * 0.5;
    X.save();
    for (let i = 0; i < 4; i++) {
      const phase = (t / 800 + i * 0.25) % 1;
      const ripR  = 12 + i * 14 + phase * 20;
      X.globalAlpha = (1 - phase) * churnA;
      X.strokeStyle = '#66ddee';
      X.lineWidth   = 1;
      X.beginPath();
      X.ellipse(wx, floor + 6, ripR, ripR * 0.28, 0, 0, Math.PI * 2);
      X.stroke();
    }
    X.restore();
  }

  // ── Statue emerging from water ─────────────────────────
  if (progress > 0) {
    const statueH  = 90;
    const totalRise = statueH + 14;
    const visible  = progress * totalRise;
    const clampVis = Math.min(statueH, visible);
    const baseY    = floor;
    const topY     = baseY - clampVis;

    X.save();
    // Clip to the visible portion (rising from below waterline)
    X.beginPath();
    X.rect(wx - 24, topY, 48, clampVis + 12);
    X.clip();

    // Aura glow — teal, intensifies as statue rises
    const pulse = 0.25 + Math.sin(t * 0.002) * 0.12;
    X.globalAlpha = pulse * progress;
    const aura = X.createRadialGradient(wx, baseY - clampVis * 0.5, 0, wx, baseY - clampVis * 0.5, 46);
    aura.addColorStop(0, '#00ffcc');
    aura.addColorStop(1, 'transparent');
    X.fillStyle = aura;
    X.fillRect(wx - 50, topY - 20, 100, clampVis + 40);

    // Statue body — dark teal stone
    X.globalAlpha = 0.92;
    const stg = X.createLinearGradient(wx - 12, 0, wx + 12, 0);
    stg.addColorStop(0, '#1a4a5a');
    stg.addColorStop(0.5, '#2a6a7a');
    stg.addColorStop(1, '#1a4a5a');
    X.fillStyle = stg;

    // Torso
    X.fillRect(wx - 11, baseY - statueH, 22, statueH);
    // Shoulders / arms extended upward (supplication or offering)
    X.fillRect(wx - 18, baseY - statueH + 16, 36, 10);
    X.fillRect(wx - 22, baseY - statueH + 22, 8, 32);
    X.fillRect(wx + 14, baseY - statueH + 22, 8, 32);
    // Head
    X.fillRect(wx - 8, baseY - statueH - 15, 16, 17);

    // Crown / headdress — Atlantean, not Egyptian
    X.fillStyle = '#226655';
    X.fillRect(wx - 11, baseY - statueH - 20, 22, 6);
    X.fillStyle = '#00ddaa';
    X.globalAlpha = 0.55 + Math.sin(t * 0.0022) * 0.2;
    for (let i = 0; i < 5; i++) {
      const spireH = 4 + (i === 2 ? 4 : 0);
      X.fillRect(wx - 10 + i * 5, baseY - statueH - 20 - spireH, 3, spireH);
    }

    // Eye glow
    X.globalAlpha = 0.9 + Math.sin(t * 0.004) * 0.1;
    X.fillStyle = '#00ffee';
    X.fillRect(wx - 5, baseY - statueH - 8, 2, 2);
    X.fillRect(wx + 3, baseY - statueH - 8, 2, 2);

    // Inscriptions on torso (carved lines)
    X.globalAlpha = 0.3;
    X.fillStyle = '#005544';
    X.fillRect(wx - 7, baseY - statueH + 30, 14, 1);
    X.fillRect(wx - 7, baseY - statueH + 38, 14, 1);
    X.fillRect(wx - 7, baseY - statueH + 46, 14, 1);

    X.restore();
  }

  // ── Dive portal glow when fully risen ─────────────────
  if (risen) {
    // Elliptical portal at the pool floor
    X.save();
    const glow  = 0.18 + Math.sin(t * 0.0018) * 0.09;
    const pulse = Math.sin(t * 0.003);
    X.globalAlpha = glow;
    const pg = X.createRadialGradient(wx, floor + 8, 2, wx, floor + 8, 38);
    pg.addColorStop(0, '#00ffcc');
    pg.addColorStop(0.4, '#005566');
    pg.addColorStop(1, 'transparent');
    X.fillStyle = pg;
    X.beginPath();
    X.ellipse(wx, floor + 8, 38 + pulse * 4, 12 + pulse * 2, 0, 0, Math.PI * 2);
    X.fill();
    X.restore();

    // Dive hint
    const inPool  = realm.px >= POOL_WX && realm.px <= POOL_WX + POOL_WIDTH;
    const nearDive = realm.px && Math.abs(realm.px - wx) < POOL_DIVE_RANGE;
    if (inPool && nearDive) {
      const ha = 0.6 + 0.4 * Math.abs(Math.sin(t / 320));
      X.save();
      X.globalAlpha = ha;
      X.font = '7px monospace';
      X.fillStyle = '#00ffcc';
      X.textAlign = 'center';
      X.fillText('[↓] DIVE INTO ATLANTIS', wx, floor - 110);
      X.textAlign = 'left';
      X.restore();
    }
  }
}

// ── Passage entry hint (screen-space) ────────────────────

function drawPassageHint(worldPx, camX, t, riddlesSolved) {
  if (riddlesSolved < 1) return;
  if (RiddleManager.isActive()) return;
  const passageScreenX = Math.round(PASSAGE_WX - camX);
  if (Math.abs(worldPx - PASSAGE_WX) > 100) return;

  const ha = 0.5 + 0.5 * Math.abs(Math.sin(t / 480));
  X.save();
  X.globalAlpha = ha;
  X.font = '6px monospace';
  X.textAlign = 'center';
  X.fillStyle = '#f8e890';
  X.fillText('[↓] DESCEND INTO THE VAULT', Math.max(100, Math.min(CW - 100, passageScreenX)), CH - 210);
  X.textAlign = 'left';
  X.restore();
}

// ── Master draw ───────────────────────────────────────────

export function drawOasis(realm) {
  const t    = Date.now();
  const camX = realm.camX || 0;
  const riddlesSolved = Flags.get('sphinx_riddles_solved') || 0;

  // Screen-space background
  drawOasisSky();
  drawOasisStars(t);
  drawHorizonDunes(camX);

  // World-space objects (translate by -camX)
  X.save();
  X.translate(-Math.round(camX), 0);

  drawOasisGround(realm.worldW || 3000);

  // Pass player world-x and riddles solved so pool can react
  const playerInPool = realm.px >= POOL_WX && realm.px <= POOL_WX + POOL_WIDTH;
  drawPool(t, playerInPool ? realm.px : undefined, riddlesSolved);

  // Atlantis statue — rises from pool after the vault ritual
  drawPoolStatue(realm, t);

  // Palms — a few early lone trees on the dry entry stretch, then clustered around pool
  drawPalm(210,                         OASIS_FLOOR, 0.75, t, 0.8);
  drawPalm(430,                         OASIS_FLOOR, 0.65, t, 2.2);
  drawPalm(POOL_WX - 18,               OASIS_FLOOR, 1.0,  t, 0.0);
  drawPalm(POOL_WX + 80,               OASIS_FLOOR, 1.2,  t, 1.5);
  drawPalm(POOL_WX + 200,              OASIS_FLOOR, 0.9,  t, 2.8);
  drawPalm(POOL_WX + POOL_WIDTH - 80,  OASIS_FLOOR, 1.1,  t, 0.7);
  drawPalm(POOL_WX + POOL_WIDTH + 30,  OASIS_FLOOR, 0.85, t, 3.5);

  // Sphinx far to the east — pass riddles solved for passage reveal
  drawSphinx(SPHINX_WX, OASIS_FLOOR, t, riddlesSolved);

  X.restore();

  // Player rendered in screen-space
  drawPharaoh({
    px: realm.px, py: realm.py, camX: camX,
    pZ: 0, facing: realm.facing, frame: realm.frame,
  });

  drawSphinxHint(realm.px, camX, t);
  drawPassageHint(realm.px, camX, t, riddlesSolved);
  drawOasisHUD(realm);

  // Riddle overlay on top of everything
  RiddleManager.render();
}
