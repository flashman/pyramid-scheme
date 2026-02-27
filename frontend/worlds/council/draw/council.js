// ── FILE: worlds/council/draw/council.js ────────────────

import { X, CW, CH }            from '../../../engine/canvas.js';
import { COL }                   from '../../../engine/colors.js';
import { COUNCIL_FLOOR, COUNCIL_ARCHON_X, COUNCIL_PORTAL_X } from '../constants.js';
import { Flags }                 from '../../../engine/flags.js';
import { drawCouncilPharaoh }    from '../../../draw/pharaoh.js';

// ── FILE: draw/council.js ─────────────────────────────────
// All drawing for the Galactic Council realm.
// Aesthetic: deep space, violet/gold, corporate-cosmic.

// ── Star field ─ 3 parallax layers ───────────────────────
const _cStars = (function() {
  const layers = [[], [], []];
  let s = 0xc0de1234;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 0) / 0xffffffff; };
  for (let i = 0; i < 70; i++) layers[0].push([Math.floor(r()*780), Math.floor(r()*430), r()]);
  for (let i = 0; i < 35; i++) layers[1].push([Math.floor(r()*780), Math.floor(r()*430), r()]);
  for (let i = 0; i < 18; i++) layers[2].push([Math.floor(r()*780), Math.floor(r()*430), r()]);
  return layers;
})();

function drawCouncilBG(t) {
  // Void
  X.fillStyle = '#000008'; X.fillRect(0, 0, CW, CH);

  // Nebula wisps — faint violet clouds
  X.save();
  X.globalAlpha = 0.07 + 0.03 * Math.sin(t/4000);
  const nb1 = X.createRadialGradient(580, 160, 10, 580, 160, 200);
  nb1.addColorStop(0, '#8820f0'); nb1.addColorStop(1, 'transparent');
  X.fillStyle = nb1; X.fillRect(380, 0, 400, 360);
  X.globalAlpha = 0.05 + 0.02 * Math.sin(t/5500 + 1.3);
  const nb2 = X.createRadialGradient(120, 100, 5, 120, 100, 160);
  nb2.addColorStop(0, '#2040c0'); nb2.addColorStop(1, 'transparent');
  X.fillStyle = nb2; X.fillRect(0, 0, 300, 280);
  X.restore();

  // Stars — 3 layers drifting slowly (parallax)
  const speeds = [0.004, 0.009, 0.018];
  const sizes  = [1, 1, 2];
  for (let layer = 0; layer < 3; layer++) {
    for (const [sx, sy, phase] of _cStars[layer]) {
      const drift = (sx - t * speeds[layer]) % CW;
      const x = ((drift % CW) + CW) % CW;
      if (sy >= COUNCIL_FLOOR - 20) continue;
      const blink = Math.sin(t / 800 + phase * 6.28) > 0.6;
      X.globalAlpha = (0.3 + phase * 0.5) * (blink ? 1.0 : 0.4);
      X.fillStyle = layer === 2 ? (blink ? '#ffffff' : '#a0b0d0') : '#6070a0';
      X.fillRect(x, sy, sizes[layer], sizes[layer]);
    }
  }
  X.globalAlpha = 1;

  // Earth — partially visible lower-left, as if seen from orbit
  const ex = 60, ey = COUNCIL_FLOOR + 90, er = 190;
  X.save();
  // Atmosphere glow
  X.globalAlpha = 0.18;
  const atm = X.createRadialGradient(ex, ey, er - 10, ex, ey, er + 40);
  atm.addColorStop(0, '#4488ff'); atm.addColorStop(1, 'transparent');
  X.fillStyle = atm; X.fillRect(ex - er - 40, ey - er - 40, (er + 40) * 2, (er + 40) * 2);
  // Earth body (clip to canvas)
  X.globalAlpha = 1;
  X.fillStyle = '#1448a0';
  X.beginPath(); X.arc(ex, ey, er, 0, Math.PI * 2); X.fill();
  // Ocean shimmer
  X.fillStyle = '#1a60c8';
  X.beginPath(); X.arc(ex, ey, er - 4, 0, Math.PI * 2); X.fill();
  // Cloud patches
  X.fillStyle = 'rgba(220,235,255,0.55)';
  X.fillRect(ex - 30, ey - er + 15, 60, 14);
  X.fillRect(ex + 40, ey - er + 40, 45, 10);
  X.fillRect(ex - 80, ey - er + 55, 50, 12);
  X.fillRect(ex - 10, ey - er + 72, 80, 9);
  // Atmosphere edge
  X.globalAlpha = 0.35;
  X.strokeStyle = '#80b0ff'; X.lineWidth = 6;
  X.beginPath(); X.arc(ex, ey, er, 0, Math.PI * 2); X.stroke();
  X.restore();
}

function drawCouncilStation(realm, t) {
  const p1 = Math.sin(t / 900);
  const p2 = Math.sin(t / 1400 + 0.8);

  // Back wall — spans full width, behind everything
  X.fillStyle = '#060010'; X.fillRect(0, 0, CW, COUNCIL_FLOOR - 60);

  // Ticker tape at top
  X.fillStyle = '#0a0020'; X.fillRect(0, 0, CW, 22);
  X.fillStyle = '#8820f0'; X.fillRect(0, 20, CW, 1);
  X.save();
  X.font = '5px monospace';
  const tickerText = '  ✦  GALACTIC COUNCIL  ✦  SESSION 7,821,445  ✦  ACTIVE PLANETS: 847,291  ✦  TOTAL RECRUITS: ∞  ✦  EARTH COMPLIANCE: NOMINAL  ✦  ';
  const tickX = (-(t * 0.04) % (tickerText.length * 3.2 + CW) + CW * 2) % (tickerText.length * 3.2 + CW) - CW;
  X.fillStyle = `rgba(180,80,255,${0.7 + 0.2 * p1})`;
  X.fillText(tickerText + tickerText, -tickX % (tickerText.length * 3.2), 14);
  X.restore();

  // Back wall circuit lines
  X.save(); X.strokeStyle = 'rgba(100,30,200,0.18)'; X.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const wy = 30 + i * 48;
    X.beginPath(); X.moveTo(200, wy); X.lineTo(CW - 200, wy); X.stroke();
  }
  for (let i = 0; i < 5; i++) {
    const wx = 220 + i * 88;
    X.beginPath(); X.moveTo(wx, 30); X.lineTo(wx, COUNCIL_FLOOR - 60); X.stroke();
  }
  X.restore();

  // Large viewport — Earth side (shows the atmosphere outside)
  _drawViewport(160, 180, 72, t, 'earth');
  // Large viewport — deep space side
  _drawViewport(CW - 160, 180, 72, t, 'space');

  // Wall panels flanking viewport area
  for (let side = 0; side < 2; side++) {
    const px = side === 0 ? 12 : CW - 52;
    X.fillStyle = '#080018'; X.fillRect(px, 30, 40, COUNCIL_FLOOR - 90);
    _drawWallCircuits(px + 4, 55, t, side);
  }

  // Platform floor
  X.fillStyle = '#0c0828'; X.fillRect(0, COUNCIL_FLOOR - 2, CW, 50);
  // Gold edge trim
  X.fillStyle = `rgba(170,60,255,${0.5 + 0.2 * p2})`;
  X.fillRect(0, COUNCIL_FLOOR - 2, CW, 2);
  // Floor grid
  X.save(); X.strokeStyle = 'rgba(100,30,200,0.12)'; X.lineWidth = 1;
  for (let gx = 0; gx <= CW; gx += 44) {
    X.beginPath(); X.moveTo(gx, COUNCIL_FLOOR); X.lineTo(gx, COUNCIL_FLOOR + 50); X.stroke();
  }
  X.restore();
  // Platform edge lights
  for (let i = 0; i < 16; i++) {
    const lx = 24 + i * 48;
    const la = 0.5 + 0.5 * Math.abs(Math.sin(t / 600 + i * 0.7));
    X.fillStyle = `rgba(${i % 3 === 0 ? '255,200,60' : i % 3 === 1 ? '170,60,255' : '60,180,255'},${la})`;
    X.fillRect(lx - 2, COUNCIL_FLOOR - 4, 4, 4);
  }
}

function _drawViewport(cx, cy, r, t, type) {
  X.save();
  // Frame
  X.strokeStyle = '#5518a0'; X.lineWidth = 4;
  X.beginPath(); X.arc(cx, cy, r, 0, Math.PI * 2); X.stroke();
  X.strokeStyle = '#8830f0'; X.lineWidth = 1;
  X.beginPath(); X.arc(cx, cy, r - 5, 0, Math.PI * 2); X.stroke();

  // Clip to circle
  X.beginPath(); X.arc(cx, cy, r - 2, 0, Math.PI * 2); X.clip();

  if (type === 'earth') {
    // Shows Earth close up — blue ocean, clouds
    X.fillStyle = '#1040a0'; X.fillRect(cx - r, cy - r, r * 2, r * 2);
    X.fillStyle = '#1a58c8'; X.fillRect(cx - r, cy - r/2, r * 2, r);
    X.fillStyle = 'rgba(220,235,255,0.6)';
    X.fillRect(cx - 40, cy - 30, 80, 12);
    X.fillRect(cx - 20, cy + 10, 60, 9);
    // Horizon glow
    const hg = X.createLinearGradient(cx - r, cy - r, cx - r, cy + r);
    hg.addColorStop(0, 'rgba(80,150,255,0.3)'); hg.addColorStop(1, 'transparent');
    X.fillStyle = hg; X.fillRect(cx - r, cy - r, r * 2, r * 2);
  } else {
    // Deep space + distant galaxy
    X.fillStyle = '#010006'; X.fillRect(cx - r, cy - r, r * 2, r * 2);
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 37 + 11) * 53) % (r * 2) + cx - r;
      const sy = ((i * 29 + 7) * 41) % (r * 2) + cy - r;
      const blink = Math.sin(t / 700 + i * 0.9) > 0.5;
      X.globalAlpha = blink ? 0.9 : 0.3;
      X.fillStyle = blink ? '#ffffff' : '#8090c0';
      X.fillRect(sx, sy, 1, 1);
    }
    // Distant galaxy smear
    X.globalAlpha = 0.15 + 0.05 * Math.sin(t / 3000);
    const gal = X.createRadialGradient(cx + 20, cy - 10, 2, cx + 20, cy - 10, 35);
    gal.addColorStop(0, '#c080ff'); gal.addColorStop(1, 'transparent');
    X.fillStyle = gal; X.fillRect(cx - 15, cy - 45, 75, 70);
  }
  X.restore();
  X.globalAlpha = 1;
  // Viewport glare
  X.save(); X.globalAlpha = 0.08;
  X.fillStyle = '#ffffff';
  X.beginPath(); X.arc(cx - r * 0.25, cy - r * 0.28, r * 0.3, 0, Math.PI * 2); X.fill();
  X.restore();
}

function _drawWallCircuits(x, startY, t, side) {
  const a = 0.3 + 0.15 * Math.sin(t / 1200 + side);
  X.save(); X.strokeStyle = `rgba(140,40,255,${a})`; X.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const cy = startY + i * 56;
    X.beginPath(); X.moveTo(x, cy); X.lineTo(x + 30, cy); X.stroke();
    X.beginPath(); X.moveTo(x + 30, cy); X.lineTo(x + 30, cy + 24); X.stroke();
    X.fillStyle = `rgba(200,80,255,${Math.min(1, a + 0.2 * Math.sin(t / 700 + i + side * 2))})`;
    X.fillRect(x + 28, cy - 2, 4, 4);
  }
  X.restore();
}

function drawArrivalCapstone(playerX, t) {
  const cx = COUNCIL_PORTAL_X;
  const fy = COUNCIL_FLOOR;
  const glow = 0.18 + 0.10 * Math.sin(t / 700);

  // Capstone glow on floor
  X.save(); X.globalAlpha = glow;
  const flGrd = X.createRadialGradient(cx, fy, 0, cx, fy, 55);
  flGrd.addColorStop(0, COL.GOLD); flGrd.addColorStop(1, 'transparent');
  X.fillStyle = flGrd; X.fillRect(cx - 55, fy - 20, 110, 40);
  X.restore();

  // Capstone body — layered pyramid shape
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const w = 8 + i * 12;
    const ly = fy - (layers - i) * 9;
    X.fillStyle = i === 0 ? COL.GOLD_BRIGHT : COL.GOLD;
    X.fillRect(cx - Math.round(w / 2), ly, w, 8);
    // Shadow/depth
    X.fillStyle = COL.AMBER_DARK;
    X.fillRect(cx - Math.round(w / 2), ly + 6, w, 2);
  }
  // Eye of the capstone (glowing)
  const ea = 0.7 + 0.3 * Math.sin(t / 400);
  X.save(); X.globalAlpha = ea;
  X.fillStyle = '#ff8800';
  X.fillRect(cx - 3, fy - layers * 9 + 2, 6, 5);
  X.fillStyle = '#ffffff';
  X.fillRect(cx - 1, fy - layers * 9 + 3, 2, 2);
  X.restore();

  // Floating label
  X.font = '5px monospace'; X.textAlign = 'center';
  X.fillStyle = `rgba(200,150,50,${0.6 + 0.3 * Math.sin(t / 600)})`;
  X.fillText('EARTH 7G', cx, fy - layers * 9 - 8);

  // Return portal hint
  if (Math.abs(playerX - cx) < 80) {
    const ha = 0.6 + 0.4 * Math.abs(Math.sin(t / 480));
    X.save(); X.globalAlpha = ha;
    X.fillStyle = COL.GOLD_BRIGHT;
    X.font = '6px monospace';
    X.fillText('[↑] RETURN TO EARTH', cx, fy - layers * 9 - 22);
    X.restore();
  }
  X.textAlign = 'left';
}

function drawCouncillor(cx, floorY, variant, t) {
  const colors = [
    { body: '#1a3060', head: '#505880', eye: '#4080ff', accent: '#2060c0' },
    { body: '#0e3018', head: '#406840', eye: '#40c060', accent: '#20a040' },
    { body: '#401808', head: '#705040', eye: '#e06020', accent: '#c04010' },
  ];
  const col = colors[variant % 3];
  const bob = Math.sin(t / 900 + variant * 2.1) * 1.5;
  const fy  = floorY + bob;

  // Console/desk
  X.fillStyle = '#0c0820'; X.fillRect(cx - 28, Math.round(fy - 24), 56, 10);
  X.strokeStyle = `rgba(${variant === 1 ? '40,180,80' : variant === 0 ? '60,120,240' : '200,80,20'},0.5)`;
  X.lineWidth = 1; X.strokeRect(cx - 28, Math.round(fy - 24), 56, 10);
  const screenText = ['∞⟶∞', '▪▪▪▪', '$→$→'][variant];
  X.font = '3px monospace'; X.textAlign = 'center';
  X.fillStyle = col.accent;
  X.fillText(screenText, cx, Math.round(fy - 17));
  X.textAlign = 'left';

  // Arms reaching to console
  X.fillStyle = col.body;
  X.fillRect(cx - 22, Math.round(fy - 34), 8, 14);
  X.fillRect(cx + 14, Math.round(fy - 34), 8, 14);

  // Torso
  X.fillStyle = col.body;
  X.fillRect(cx - 14, Math.round(fy - 52), 28, 22);
  // Collar/rank insignia
  X.fillStyle = col.accent;
  X.fillRect(cx - 14, Math.round(fy - 52), 28, 4);
  // Chest detail
  X.fillStyle = '#0a0018';
  X.fillRect(cx - 8, Math.round(fy - 46), 10, 8);
  X.fillStyle = col.eye;
  X.fillRect(cx - 7, Math.round(fy - 45), 3, 2); X.fillRect(cx - 4, Math.round(fy - 42), 6, 2);

  // Head
  X.fillStyle = col.head;
  X.fillRect(cx - 9, Math.round(fy - 66), 18, 14);
  // Eye ridge
  X.fillStyle = '#0a0015';
  X.fillRect(cx - 7, Math.round(fy - 63), 7, 5);
  X.fillRect(cx + 0, Math.round(fy - 63), 7, 5);
  X.fillStyle = col.eye;
  X.fillRect(cx - 6, Math.round(fy - 62), 3, 2);
  X.fillRect(cx + 1, Math.round(fy - 62), 3, 2);
  // Antenna nub
  X.fillStyle = col.accent;
  X.fillRect(cx - 2, Math.round(fy - 72), 2, 8);
  X.fillRect(cx + 2, Math.round(fy - 73), 2, 6);
}

function drawArchon(cx, floorY, t) {
  const bob = Math.sin(t / 1150) * 2.5;
  const fy  = floorY + bob;
  const s   = (n) => Math.round(n);

  // Aura — pulsing violet halo
  X.save();
  X.globalAlpha = 0.13 + 0.07 * Math.sin(t / 800);
  const aura = X.createRadialGradient(cx, fy - 55, 8, cx, fy - 55, 82);
  aura.addColorStop(0, '#bb44ff'); aura.addColorStop(1, 'transparent');
  X.fillStyle = aura; X.fillRect(cx - 82, fy - 137, 164, 145);
  X.restore();

  // Crown — 5 ornate spires
  const crownBase = s(fy - 98);
  for (let i = 0; i < 5; i++) {
    const spx  = cx - 10 + i * 5;
    const spH  = i % 2 === 0 ? 22 : 14;
    X.fillStyle = i % 2 === 0 ? '#7015d8' : '#9530f8';
    X.fillRect(spx, crownBase - spH, 3, spH);
    X.fillStyle = i % 2 === 0 ? COL.GOLD_BRIGHT : COL.GOLD_DIM;
    X.fillRect(spx, crownBase - spH, 3, 4);
  }
  // Crown band
  X.fillStyle = '#4a0898'; X.fillRect(cx - 13, crownBase, 26, 9);
  X.fillStyle = COL.GOLD;  X.fillRect(cx - 13, crownBase, 26, 2);
  X.fillStyle = '#2a0060'; X.fillRect(cx - 13, crownBase + 2, 26, 7);
  // Crown gems
  for (let g = 0; g < 4; g++) {
    const ga = 0.7 + 0.3 * Math.sin(t / 400 + g * 1.57);
    X.save(); X.globalAlpha = ga;
    X.fillStyle = g % 2 === 0 ? '#dd66ff' : COL.GOLD_BRIGHT;
    X.fillRect(cx - 10 + g * 7, crownBase + 3, 4, 3);
    X.restore();
  }

  // Head
  const headTop = s(fy - 98);
  X.fillStyle = '#5a4878';
  X.fillRect(cx - 10, headTop, 20, 18);
  // Side ridges
  X.fillStyle = '#3a2858';
  X.fillRect(cx - 13, s(fy - 94), 4, 10);
  X.fillRect(cx + 9, s(fy - 94), 4, 10);
  // Four eyes — 2 large outer, 2 small inner
  X.fillStyle = '#06000e';
  X.fillRect(cx - 9, s(fy - 93), 8, 6);  // outer left
  X.fillRect(cx + 1, s(fy - 93), 8, 6);  // outer right
  X.fillStyle = '#9922cc';
  X.fillRect(cx - 8, s(fy - 92), 4, 3);  // iris left
  X.fillRect(cx + 2, s(fy - 92), 4, 3);  // iris right
  X.fillStyle = '#dd88ff';
  X.fillRect(cx - 7, s(fy - 92), 2, 2);  // glint left
  X.fillRect(cx + 3, s(fy - 92), 2, 2);  // glint right
  // Inner small eyes
  X.fillStyle = '#06000e';
  X.fillRect(cx - 4, s(fy - 90), 3, 3);
  X.fillRect(cx + 1, s(fy - 90), 3, 3);
  X.fillStyle = '#cc44ff';
  X.fillRect(cx - 3, s(fy - 89), 1, 1);
  X.fillRect(cx + 2, s(fy - 89), 1, 1);
  // Mouth slit
  X.fillStyle = '#28104a';
  X.fillRect(cx - 4, s(fy - 82), 8, 2);

  // Collar — ornate gold band
  X.fillStyle = COL.GOLD;
  X.fillRect(cx - 15, s(fy - 80), 30, 6);
  X.fillStyle = '#a07000';
  for (let c = 0; c < 6; c++) X.fillRect(cx - 13 + c * 5, s(fy - 79), 3, 3);

  // Pauldrons / shoulder plates
  X.fillStyle = '#3a1468';
  X.fillRect(cx - 26, s(fy - 76), 14, 12);
  X.fillRect(cx + 12, s(fy - 76), 14, 12);
  X.fillStyle = COL.GOLD_DIM;
  X.fillRect(cx - 26, s(fy - 76), 14, 2);
  X.fillRect(cx + 12, s(fy - 76), 14, 2);
  // Shoulder gem
  X.fillStyle = '#9920e0';
  X.fillRect(cx - 20, s(fy - 71), 4, 4);
  X.fillRect(cx + 16, s(fy - 71), 4, 4);

  // Four arms
  X.fillStyle = '#4a3060';
  // Upper pair (wide)
  X.fillRect(cx - 30, s(fy - 72), 5, 22);
  X.fillRect(cx + 25, s(fy - 72), 5, 22);
  // Lower pair (inner)
  X.fillRect(cx - 23, s(fy - 58), 4, 20);
  X.fillRect(cx + 19, s(fy - 58), 4, 20);
  // Hands
  X.fillStyle = '#604878';
  X.fillRect(cx - 32, s(fy - 52), 7, 6);
  X.fillRect(cx + 25, s(fy - 52), 7, 6);
  X.fillRect(cx - 24, s(fy - 40), 6, 5);
  X.fillRect(cx + 18, s(fy - 40), 6, 5);

  // Torso
  X.fillStyle = '#220848';
  X.fillRect(cx - 12, s(fy - 76), 24, 36);
  // Torso circuit lines
  X.fillStyle = '#7720c0';
  for (let r = 0; r < 4; r++) X.fillRect(cx - 9, s(fy - 72) + r * 7, 12, 1);
  // Chest piece — central gem
  const gemPulse = 0.7 + 0.3 * Math.sin(t / 500);
  X.save(); X.globalAlpha = gemPulse;
  X.fillStyle = '#cc44ff';
  X.fillRect(cx - 5, s(fy - 60), 10, 10);
  X.fillStyle = '#8800bb';
  X.fillRect(cx - 4, s(fy - 59), 8, 8);
  X.fillStyle = '#ffffff';
  X.fillRect(cx - 2, s(fy - 57), 2, 2);
  X.restore();

  // Robe — lower body, flared
  X.fillStyle = '#180438';
  X.fillRect(cx - 18, s(fy - 40), 36, 40);
  // Robe trim
  X.fillStyle = COL.GOLD_DIM;
  X.fillRect(cx - 18, s(fy - 40), 36, 2);
  // Robe hem detail
  for (let h = 0; h < 5; h++) X.fillRect(cx - 16 + h * 8, s(fy - 5), 5, 5);

  // Scepter — right side, tall
  X.fillStyle = COL.GOLD;
  X.fillRect(cx + 28, s(fy - 100), 3, 68);
  X.fillStyle = '#a07000';
  X.fillRect(cx + 26, s(fy - 70), 7, 3);
  X.fillRect(cx + 26, s(fy - 50), 7, 3);
  // Crystal orb at top
  const oa = 0.85 + 0.15 * Math.sin(t / 380);
  X.save(); X.globalAlpha = oa;
  X.fillStyle = '#dd66ff';
  X.fillRect(cx + 25, s(fy - 108), 11, 11);
  X.fillStyle = '#aa00dd';
  X.fillRect(cx + 26, s(fy - 107), 9, 9);
  X.fillStyle = '#ffffff';
  X.fillRect(cx + 29, s(fy - 105), 2, 2);
  X.restore();
  // Scepter glow
  X.save(); X.globalAlpha = 0.25 + 0.15 * Math.sin(t / 380);
  const sg = X.createRadialGradient(cx + 30, s(fy - 104), 0, cx + 30, s(fy - 104), 22);
  sg.addColorStop(0, '#dd66ff'); sg.addColorStop(1, 'transparent');
  X.fillStyle = sg; X.fillRect(cx + 8, s(fy - 126), 44, 44);
  X.restore();

  // Nameplate
  X.fillStyle = '#0e0028'; X.fillRect(cx - 46, fy + 3, 92, 13);
  X.fillStyle = '#8820f0'; X.fillRect(cx - 46, fy + 3, 92, 1);
  X.font = '5px monospace'; X.textAlign = 'center';
  X.fillStyle = '#cc66ff';
  X.fillText('GRAND ARCHON  Ω-1', cx, fy + 13);
  X.textAlign = 'left';
}

// drawCouncilPharaoh(realm) lives in draw/pharaoh.js
// — it now passes a pose object, so G state is never mutated.

function drawCouncilHUD(realm) {
  const t = Date.now();
  X.fillStyle = '#060012'; X.fillRect(0, CH - 28, CW, 28);
  X.fillStyle = '#8820f0'; X.fillRect(0, CH - 28, CW, 1);
  X.font = '6px monospace';
  X.fillStyle = '#9930e0'; X.fillText('GALACTIC COUNCIL', 8, CH - 10);
  X.textAlign = 'center';
  X.fillStyle = '#cc66ff'; X.fillText('← → MOVE     [↑] RETURN TO EARTH', CW / 2, CH - 10);
  X.textAlign = 'right';
  X.fillStyle = '#7720b0';
  X.fillText(`PLANET: EARTH 7G  |  RANK: TIER OMEGA`, CW - 8, CH - 10);
  X.textAlign = 'left';

  if (realm.registry?.nearest?.id === 'archon' && Flags.get('council_entered')) {
    const hp = 0.55 + 0.45 * Math.abs(Math.sin(t / 420));
    X.save(); X.globalAlpha = hp;
    X.fillStyle = '#cc66ff'; X.font = '5px monospace'; X.textAlign = 'right';
    X.fillText('[SPACE] CONVERSE WITH ARCHON', CW - 8, CH - 20);
    X.textAlign = 'left'; X.restore();
  }
}

// ── Master draw function ──────────────────────────────────
export function drawCouncil(realm) {
  const t = Date.now();
  drawCouncilBG(t);
  drawCouncilStation(realm, t);

  // Arrival capstone + return portal
  drawArrivalCapstone(realm.px, t);

  // Councillors at consoles — right side
  drawCouncillor(560, COUNCIL_FLOOR, 0, t);
  drawCouncillor(640, COUNCIL_FLOOR, 1, t);
  drawCouncillor(720, COUNCIL_FLOOR, 2, t);

  // Player
  drawCouncilPharaoh(realm);

  // Grand Archon (drawn after player so nameplate is on top)
  drawArchon(COUNCIL_ARCHON_X, COUNCIL_FLOOR, t);

  drawCouncilHUD(realm);
}
