// ── FILE: worlds/nile/draw/nile.js ───────────────────────
// The Nile — a living river that flows one way, west, toward the setting sun and
// the people the scheme shed on its way up. Drawn to the realm bar: a layered
// dusk sky with a setting sun on the water, ibis birds and feluccas, a detailed
// far shore, a prominent reflective river, a mud towpath broken by open-water
// gaps, floating papyrus, real crocodiles, the Bazaar of Believers, Moses in the
// bulrushes — and (later chunks) the Ferryman, Sobek, Joseph, and the Delta.
//
// Screen-space: sky, sun, clouds/birds, far shore, HUD, hints.
// World-space  (under X.translate(-camX,0)): river, banks, palms, beats, player.

import { X, CW, CH }        from '../../../engine/canvas.js';
import { G }                from '../../../game/state.js';
import { Flags }            from '../../../engine/flags.js';
import { drawRealmPharaoh } from '../../../draw/pharaoh.js';
import { DialogueManager }  from '../../../engine/dialogue.js';
import {
  NILE_W, BANK_Y, WATER_Y, WATER_BOTTOM,
  REED_TOP, BANK_SEGMENTS, REEDS,
  BAZAAR_X, MOSES_X, FERRY_X, SOBEK_X, JOSEPH_X,
  BOAT_X,
} from '../constants.js';

// ── Palette ──────────────────────────────────────────────
const SKY_HI   = '#352a5e';   // dusk indigo (east/zenith)
const SKY_MID  = '#9c4a2e';   // burnt orange
const SKY_LO   = '#e29044';   // gold at the waterline
const SUN      = '#ffc24e';
const SUN_CORE = '#fff2c8';
const WATER_HI = '#6a8e86';   // lit surface
const WATER_MD = '#356068';
const WATER_DK = '#13313d';   // deep
const MUD_HI   = '#9a6e34';
const MUD      = '#6f4d1e';
const MUD_DK   = '#422e12';
const REED_GRN = '#5a7a2a';
const REED_DK  = '#3c5418';
const CROC_BD  = '#33502a';
const CROC_LT  = '#46662f';
const CROC_DK  = '#21351b';
const FAR_SIL  = '#241a33';   // far-shore silhouette
const BANK_FOOT = BANK_Y + 30;  // quay base — sits in the water

// ── Tall date palms framing the dry banks ([x, scale]) ────
const PALMS = [
  [7050, 1.35], [7340, 1.2],                // frame the new eastern entry/gate (clear of the arch at 7280)
  [5700, 1.4], [6090, 1.2], [6280, 1.5],
  [4500, 1.3], [4800, 1.15],
  [3560, 1.25], [3880, 1.2],
  [2560, 1.3], [2900, 1.2],
];

// ── Seeded RNG for stable decorative placement ────────────
function _rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

// Far-shore vegetation across the water (world-x, parallax-scrolled silhouettes).
const _farProps = (() => {
  const r = _rng(0x5a1e9b3d); const props = [];
  for (let x = 40; x < NILE_W; x += 80 + Math.floor(r() * 80)) {
    props.push({ x, kind: r() < 0.62 ? 'palm' : 'reeds', h: 16 + r() * 26, w: 10 + r() * 14 });
  }
  return props;
})();

// Distant temple LANDMARKS on the far shore — Egyptian, and foreshadowing the
// beats: Sobek's crocodile temple (Kom Ombo), pylon gates, obelisks, a far
// pyramid (the Desert you came from).
const _farTemples = [
  { x: 600,  kind: 'temple'   }, { x: 1500, kind: 'sobek'  },
  { x: 2350, kind: 'obelisks' }, { x: 3300, kind: 'pyramid'},
  { x: 4150, kind: 'pylon'    }, { x: 5050, kind: 'sobek'  },
  { x: 6000, kind: 'pylon'    },
];

// Feluccas drifting downstream near the horizon.
const _feluccas = (() => {
  const r = _rng(0x10ce5a11); const f = [];
  for (let i = 0; i < 7; i++) f.push({ x: r() * NILE_W, sp: 0.2 + r() * 0.3, s: 0.7 + r() * 0.6 });
  return f;
})();

const _eastStars = (() => {
  const r = _rng(0xc0ffee11); const s = [];
  for (let i = 0; i < 30; i++) s.push([Math.floor(r() * CW), Math.floor(r() * 210), r()]);
  return s;
})();

const _clouds = (() => {
  const r = _rng(0xbeef77); const c = [];
  for (let i = 0; i < 4; i++) c.push({ x: r() * CW * 1.4, y: 44 + r() * 130, w: 70 + r() * 90, sp: 0.004 + r() * 0.005 });
  return c;
})();

function _onBank(x) {
  for (const s of BANK_SEGMENTS) if (x >= s.x1 && x <= s.x2) return true;
  return false;
}

// ── Sky + setting sun (screen-space; west = left) ─────────
function drawSky(t) {
  const g = X.createLinearGradient(0, 0, 0, WATER_Y);
  g.addColorStop(0.00, SKY_HI);
  g.addColorStop(0.50, SKY_MID);
  g.addColorStop(1.00, SKY_LO);
  X.fillStyle = g;
  X.fillRect(0, 0, CW, WATER_Y);

  // Early stars, east (right) side — the sky dies toward the west.
  _eastStars.forEach(([sx, sy, p]) => {
    if (sx < CW * 0.42) return;
    const tw = 0.2 + 0.3 * p + 0.25 * Math.sin(t / 700 + p * 6.28);
    X.globalAlpha = Math.max(0, tw) * (sx / CW);
    X.fillStyle = '#ffe6b0';
    X.fillRect(sx, sy, 1, 1);
  });
  X.globalAlpha = 1;

  // The sun, low in the west, half-sunk at the horizon.
  const sunX = CW * 0.24, sunY = WATER_Y + 6;
  X.save();
  X.globalAlpha = 0.6;
  const halo = X.createRadialGradient(sunX, sunY, 10, sunX, sunY, 210);
  halo.addColorStop(0, '#ffc66a'); halo.addColorStop(1, 'transparent');
  X.fillStyle = halo; X.fillRect(sunX - 210, sunY - 210, 420, 420);
  X.globalAlpha = 1;
  X.beginPath(); X.rect(0, 0, CW, WATER_Y); X.clip();   // disc sets below the water
  X.fillStyle = SUN;
  X.beginPath(); X.arc(sunX, sunY, 52, 0, Math.PI * 2); X.fill();
  X.fillStyle = '#ffd982';
  X.beginPath(); X.arc(sunX, sunY - 4, 40, 0, Math.PI * 2); X.fill();
  X.fillStyle = SUN_CORE;
  X.beginPath(); X.arc(sunX, sunY - 8, 24, 0, Math.PI * 2); X.fill();
  // heat bands across the disc
  X.globalAlpha = 0.22; X.fillStyle = SKY_MID;
  for (let i = 0; i < 4; i++) X.fillRect(sunX - 52, sunY - 22 + i * 12, 104, 3);
  X.restore();

  // A pale moon rising in the east — the night follows you downstream.
  const moonX = CW * 0.8, moonY = 96;
  X.save();
  X.globalAlpha = 0.18;
  const mh = X.createRadialGradient(moonX, moonY, 6, moonX, moonY, 70);
  mh.addColorStop(0, '#cfd6e8'); mh.addColorStop(1, 'transparent');
  X.fillStyle = mh; X.fillRect(moonX - 70, moonY - 70, 140, 140);
  X.globalAlpha = 0.9;
  X.fillStyle = '#d8dce6';
  X.beginPath(); X.arc(moonX, moonY, 26, 0, Math.PI * 2); X.fill();
  X.fillStyle = '#c2c8d6';                       // craters / maria
  X.beginPath(); X.arc(moonX - 8, moonY - 6, 5, 0, Math.PI * 2); X.fill();
  X.beginPath(); X.arc(moonX + 7, moonY + 5, 4, 0, Math.PI * 2); X.fill();
  X.beginPath(); X.arc(moonX + 2, moonY - 10, 3, 0, Math.PI * 2); X.fill();
  X.restore();
}

// ── Clouds + ibis birds (screen-space, slow parallax) ─────
function drawSkyLife(t) {
  // warm dusk clouds
  X.save();
  for (const c of _clouds) {
    const x = ((c.x - t * c.sp) % (CW + 200) + CW + 200) % (CW + 200) - 100;
    X.globalAlpha = 0.09;
    X.fillStyle = '#d98a4e';
    X.beginPath(); X.ellipse(x, c.y, c.w * 0.5, c.w * 0.1, 0, 0, Math.PI * 2); X.fill();
    X.beginPath(); X.ellipse(x - c.w * 0.26, c.y + 1.5, c.w * 0.26, c.w * 0.075, 0, 0, Math.PI * 2); X.fill();
    X.beginPath(); X.ellipse(x + c.w * 0.28, c.y + 1, c.w * 0.30, c.w * 0.085, 0, 0, Math.PI * 2); X.fill();
  }
  X.restore();

  // a small skein of ibis, gliding west
  X.save();
  X.strokeStyle = '#241a2a'; X.lineWidth = 1; X.globalAlpha = 0.6;
  for (let i = 0; i < 5; i++) {
    const bx = ((-t * 0.02 + i * 70 + 800) % (CW + 120)) - 60;
    const by = 70 + i * 9 + Math.sin(t / 900 + i) * 3;
    const flap = Math.sin(t / 220 + i * 1.3) * 2;
    X.beginPath();
    X.moveTo(bx - 5, by + flap); X.lineTo(bx, by); X.lineTo(bx + 5, by + flap);
    X.stroke();
  }
  X.restore();
}

// ── Far shore across the river (screen-space, parallax) ───
function drawFarBank(t, camX) {
  const hy = WATER_Y;
  const par = camX * 0.32;

  // hazy horizon glow
  X.save();
  X.globalAlpha = 0.55;
  const haze = X.createLinearGradient(0, hy - 46, 0, hy);
  haze.addColorStop(0, 'transparent'); haze.addColorStop(1, '#7a3c1e');
  X.fillStyle = haze; X.fillRect(0, hy - 46, CW, 46);
  X.restore();

  // distant dune / shore band
  X.save();
  X.globalAlpha = 0.5;
  X.fillStyle = FAR_SIL;
  X.beginPath(); X.moveTo(0, hy);
  for (let sx = 0; sx <= CW; sx += 60) {
    const wob = Math.sin((sx + par) * 0.02) * 6 + Math.sin((sx + par) * 0.006) * 10;
    X.lineTo(sx, hy - 10 - wob);
  }
  X.lineTo(CW, hy); X.fill();
  X.restore();

  // distant temple landmarks (drawn first so vegetation sits in front of them)
  X.save();
  X.globalAlpha = 0.6;
  for (const tm of _farTemples) {
    const sx = tm.x - par;
    const wx = ((sx % NILE_W) + NILE_W) % NILE_W;
    const x = wx > CW + 90 ? wx - NILE_W : wx;
    if (x < -90 || x > CW + 90) continue;
    drawFarTemple(x, hy, tm.kind, t);
  }
  X.restore();

  // silhouetted palms / reeds, parallax-wrapped
  X.save();
  X.globalAlpha = 0.62;
  X.fillStyle = FAR_SIL;
  for (const p of _farProps) {
    const sx = p.x - par;
    const wx = ((sx % NILE_W) + NILE_W) % NILE_W;
    const x = wx > CW + 60 ? wx - NILE_W : wx;
    if (x < -60 || x > CW + 60) continue;
    if (p.kind === 'palm') {
      const sway = Math.sin(t / 2200 + p.x) * 2;
      X.fillRect(x, hy - p.h, 2, p.h);
      for (let f = 0; f < 6; f++) {
        const a = -Math.PI / 2 + (f - 2.5) * 0.45;
        X.fillRect(x + Math.cos(a) * 9 + sway, hy - p.h + Math.sin(a) * 7, 9, 2);
      }
    } else {
      for (let r = 0; r < 5; r++) X.fillRect(x + r * 3, hy - p.h * 0.5 - (r % 2) * 4, 1, p.h * 0.5);
    }
  }
  X.restore();

  // feluccas drifting downstream on the far water
  X.save();
  X.globalAlpha = 0.5;
  for (const f of _feluccas) {
    const sx = ((f.x - t * f.sp - par * 0.5) % NILE_W + NILE_W) % NILE_W;
    const x = sx > CW + 40 ? sx - NILE_W : sx;
    if (x < -40 || x > CW + 40) continue;
    const y = hy + 8 + (f.x % 10);
    const s = f.s;
    X.fillStyle = '#1d2630';
    X.fillRect(x - 8 * s, y, 16 * s, 2 * s);             // hull
    X.fillStyle = '#3a4450';
    X.beginPath();                                       // lateen sail
    X.moveTo(x, y); X.lineTo(x - 2 * s, y - 16 * s); X.lineTo(x + 9 * s, y - 2 * s); X.fill();
  }
  X.restore();
}

// A distant temple silhouette on the far shore (screen-space, base at hy).
function drawFarTemple(x, hy, kind, t) {
  X.fillStyle = FAR_SIL;
  if (kind === 'pylon') {
    // two battered trapezoid towers flanking a gateway
    const H = 46, W = 26, gap = 14;
    for (const ox of [x, x + W + gap]) {
      X.beginPath();
      X.moveTo(ox, hy); X.lineTo(ox + 3, hy - H);
      X.lineTo(ox + W - 3, hy - H); X.lineTo(ox + W, hy); X.fill();
    }
    X.fillRect(x + W, hy - 12, gap, 12);                 // gateway lintel block
    // flag-poles with pennants
    for (const px of [x + 5, x + W + gap + W - 5]) {
      X.fillRect(px, hy - H - 14, 1, 14);
      X.fillStyle = '#7a3c1e';
      X.fillRect(px + 1, hy - H - 14 + Math.sin(t / 600 + px) * 1, 6, 3);
      X.fillStyle = FAR_SIL;
    }
  } else if (kind === 'sobek') {
    // Kom Ombo — a colonnade with a great reclining crocodile on a plinth in front
    X.fillRect(x + 14, hy - 6, 60, 6);                    // platform
    for (let c = 0; c < 6; c++) X.fillRect(x + 18 + c * 10, hy - 34, 5, 28);  // columns
    X.fillRect(x + 12, hy - 40, 64, 7);                   // architrave
    X.fillRect(x + 10, hy - 41, 68, 2);                   // cornice
    // crocodile statue on a low plinth, head raised toward the river
    const ry = hy - 4;
    X.fillRect(x - 6, ry - 4, 44, 4);                     // plinth
    X.fillRect(x - 2, ry - 9, 34, 5);                     // body
    X.fillRect(x + 30, ry - 7, 12, 3);                    // tail
    X.fillRect(x - 12, ry - 12, 14, 6);                   // raised head
    X.fillRect(x - 20, ry - 10, 10, 3);                   // snout
    X.fillStyle = '#6a4a2a'; X.fillRect(x - 18, ry - 11, 2, 1);  // eye glint
    X.fillStyle = FAR_SIL;
  } else if (kind === 'obelisks') {
    for (const ox of [x, x + 30]) {
      X.beginPath();
      X.moveTo(ox - 3, hy); X.lineTo(ox - 1, hy - 52); X.lineTo(ox + 1, hy - 52); X.lineTo(ox + 3, hy); X.fill();
      X.beginPath();
      X.moveTo(ox - 2, hy - 52); X.lineTo(ox, hy - 58); X.lineTo(ox + 2, hy - 52); X.fill();   // pyramidion
    }
    X.fillRect(x - 6, hy - 8, 48, 8);                     // shared base
  } else if (kind === 'pyramid') {
    X.beginPath(); X.moveTo(x, hy); X.lineTo(x + 36, hy - 52); X.lineTo(x + 72, hy); X.fill();
    X.beginPath(); X.moveTo(x + 52, hy); X.lineTo(x + 74, hy - 32); X.lineTo(x + 96, hy); X.fill();  // smaller behind
  } else { // 'temple' — long hypostyle hall
    X.fillRect(x - 2, hy - 6, 78, 6);
    for (let c = 0; c < 8; c++) X.fillRect(x + 3 + c * 9, hy - 34, 5, 28);
    X.fillRect(x - 2, hy - 40, 78, 7);
    X.fillRect(x - 4, hy - 41, 82, 2);
  }
}

// ── River body + animated one-way current (world-space) ───
function drawWater(t) {
  const g = X.createLinearGradient(0, WATER_Y, 0, WATER_BOTTOM);
  g.addColorStop(0, WATER_HI);
  g.addColorStop(0.35, WATER_MD);
  g.addColorStop(1, WATER_DK);
  X.fillStyle = g;
  X.fillRect(0, WATER_Y, NILE_W, WATER_BOTTOM - WATER_Y);

  // Sun reflection column on the water (tracks the sun's screen position).
  const reflWX = G.camX + CW * 0.24;
  X.save();
  X.globalAlpha = 0.20;
  const rg = X.createLinearGradient(0, WATER_Y, 0, WATER_BOTTOM);
  rg.addColorStop(0, '#ffd27a'); rg.addColorStop(1, 'transparent');
  X.fillStyle = rg;
  X.fillRect(reflWX - 30, WATER_Y, 60, WATER_BOTTOM - WATER_Y);
  // broken shimmer in the reflection
  X.globalAlpha = 0.18;
  X.fillStyle = '#ffe6b0';
  for (let i = 0; i < 7; i++) {
    const ry = WATER_Y + 6 + i * 11 + Math.sin(t / 500 + i) * 2;
    X.fillRect(reflWX - 24 + Math.sin(t / 700 + i) * 6, ry, 30, 1);
  }
  X.restore();

  // ── Westward current streaks — the river flows one way. ──
  const viewX0 = G.camX - 40, viewX1 = G.camX + CW + 40;
  X.save();
  X.strokeStyle = '#bfe2dc';
  X.lineWidth = 1;
  for (let lane = 0; lane < 7; lane++) {
    const ly = WATER_Y + 8 + lane * 9;
    const spacing = 130;
    const drift = (t * (0.05 + lane * 0.012)) % spacing;
    X.globalAlpha = 0.15 - lane * 0.016;
    for (let x = Math.floor(viewX0 / spacing) * spacing - drift; x < viewX1; x += spacing) {
      const len = 16 + (lane % 2) * 8;
      X.beginPath(); X.moveTo(x, ly); X.lineTo(x - len, ly); X.stroke();   // tail east → reads west
    }
  }
  X.restore();

  // Surface line.
  X.save();
  X.globalAlpha = 0.22 + 0.06 * Math.sin(t / 900);
  X.fillStyle = '#cdeae3';
  X.fillRect(0, WATER_Y, NILE_W, 1);
  X.restore();
}

// ── Banks: a mud quay over the dry segments (world-space) ──
function drawBanks(t) {
  for (const s of BANK_SEGMENTS) {
    const x = s.x1, w = s.x2 - s.x1;
    // quay body (sits in the water; the river shows below it)
    X.fillStyle = MUD_DK;
    X.fillRect(x, BANK_Y, w, BANK_FOOT - BANK_Y);
    // top mud surface
    const g = X.createLinearGradient(0, BANK_Y, 0, BANK_Y + 14);
    g.addColorStop(0, MUD_HI); g.addColorStop(1, MUD);
    X.fillStyle = g;
    X.fillRect(x, BANK_Y, w, 14);
    // lit lip
    X.fillStyle = '#bb8c46';
    X.fillRect(x, BANK_Y, w, 2);
    // damp quay face + foam at the waterline
    X.fillStyle = '#3a2a12';
    X.fillRect(x, BANK_FOOT - 4, w, 4);
    X.save(); X.globalAlpha = 0.45; X.fillStyle = '#cdeae3';
    X.fillRect(x, BANK_FOOT, w, 1); X.restore();
    // cracked-mud texture
    X.fillStyle = MUD_DK;
    const r = _rng((x * 2654435761) >>> 0);
    for (let i = 0; i < w / 12; i++) {
      const dx = x + i * 12 + Math.floor(r() * 6);
      X.fillRect(dx, BANK_Y + 4 + Math.floor(r() * 8), 2, 1);
    }
    // reed fringe along the quay's water edge
    drawReedFringe(s.x1, s.x2, BANK_FOOT, t);
  }
}

function drawReedFringe(x1, x2, baseY, t) {
  const r = _rng(((x1 + 7) * 40503) >>> 0);
  for (let x = x1 + 6; x < x2; x += 16 + Math.floor(r() * 12)) {
    const h = 12 + r() * 14;
    const sway = Math.sin(t / 1300 + x) * 1.6;
    X.strokeStyle = r() < 0.5 ? REED_GRN : REED_DK;
    X.lineWidth = 1;
    X.beginPath();
    X.moveTo(x, baseY);
    X.quadraticCurveTo(x + sway, baseY - h * 0.6, x + sway * 2, baseY - h);
    X.stroke();
    X.fillStyle = '#7a8a3a';
    X.fillRect(x + sway * 2 - 1, baseY - h - 2, 3, 3);
  }
}

// ── Tall date palms (world-space, on the dry banks) ───────
function drawPalm(wx, baseY, scale, t) {
  const s = scale;
  const sway = Math.sin(t / 1700 + wx) * 3 * s;
  const trunkH = 96 * s;
  const topX = wx + sway, topY = baseY - trunkH;
  // trunk
  for (let i = 0; i < 9; i++) {
    const segY = baseY - i * (trunkH / 9);
    const segX = wx + sway * (i / 8);
    X.fillStyle = i % 2 ? '#5a3a14' : '#6e4a1c';
    X.fillRect(Math.round(segX - 3 * s), Math.round(segY - 10 * s), Math.round(6 * s), Math.round(11 * s));
  }
  // crown
  X.fillStyle = '#4a3010';
  X.fillRect(Math.round(topX - 5 * s), Math.round(topY), Math.round(10 * s), Math.round(6 * s));
  const fronds = [-2.5, -1.7, -0.9, -0.2, 0.2, 0.9, 1.7, 2.5];
  for (const fr of fronds) {
    const a = -Math.PI / 2 + fr * 0.5;
    const len = (30 + Math.abs(fr) * 4) * s;
    const droop = a + Math.sin(t / 1500 + fr) * 0.1;
    const ex = topX + Math.cos(droop) * len, ey = topY + Math.sin(droop) * len + len * 0.18;
    X.strokeStyle = Math.abs(fr) > 1.6 ? '#2e6808' : '#3c7e12';
    X.lineWidth = Math.max(1, 2 * s);
    X.beginPath(); X.moveTo(topX, topY); X.quadraticCurveTo((topX + ex) / 2, topY + (ey - topY) * 0.3, ex, ey); X.stroke();
  }
  // date cluster
  X.fillStyle = '#caa030';
  X.fillRect(Math.round(topX - 3 * s), Math.round(topY + 2), Math.round(3 * s), Math.round(4 * s));
}

function drawPalms(t) {
  for (const [x, sc] of PALMS) drawPalm(x, BANK_Y + 2, sc, t);
}

// ── Floating papyrus reeds — the one-way platforms ────────
function drawReeds(t) {
  for (const rd of REEDS) {
    const x = rd.x, w = rd.w;
    const bob = Math.sin(t / 700 + x * 0.05) * 1.5;
    const top = REED_TOP + bob;
    X.fillStyle = REED_DK; X.fillRect(x - w / 2, top + 2, w, 6);
    X.fillStyle = '#6a8a32'; X.fillRect(x - w / 2, top, w, 3);
    X.save(); X.globalAlpha = 0.3; X.strokeStyle = '#bfe2dc'; X.lineWidth = 1;
    X.beginPath(); X.ellipse(x, top + 12, w / 2 + 4, 3, 0, 0, Math.PI * 2); X.stroke(); X.restore();
    for (let i = 0; i < 4; i++) {
      const sx = x - w / 2 + 3 + i * (w / 4);
      const h = 12 + (i % 2) * 6;
      const sway = Math.sin(t / 1100 + sx) * 1.4;
      X.strokeStyle = REED_GRN; X.lineWidth = 1;
      X.beginPath(); X.moveTo(sx, top); X.lineTo(sx + sway, top - h); X.stroke();
      X.fillStyle = '#8a9a44'; X.fillRect(sx + sway - 1, top - h - 2, 3, 3);
    }
  }
}

// ── Crocodiles — real art; the back is a one-way platform ─
function drawCrocs(realm, t) {
  for (const c of realm.crocs) {
    const x = c.worldX;
    const dir = (c._dir || 1) > 0 ? 1 : -1;
    const stunned = c.isStunned;
    const calm = c.sated;                                  // fed (Sobek favor) → basking
    const submerge = Math.sin(t / 1600 + x * 0.03) * 2 + (calm ? 3 : 0);
    const backY = REED_TOP + 6 + submerge;

    X.save();
    X.translate(x, 0);
    X.scale(dir, 1);
    const BD = stunned ? '#5a6a38' : CROC_BD;
    X.fillStyle = BD; X.fillRect(-26, backY, 52, 9);
    X.fillStyle = CROC_LT; X.fillRect(-26, backY, 52, 2);
    X.fillStyle = CROC_DK;
    for (let i = -22; i < 24; i += 7) X.fillRect(i, backY - 2, 3, 3);
    X.fillStyle = BD; X.fillRect(-40, backY + 2, 16, 6); X.fillRect(-50, backY + 4, 12, 4);
    X.fillStyle = BD; X.fillRect(24, backY + 1, 18, 7); X.fillRect(40, backY + 2, 8, 5);
    X.fillStyle = CROC_DK; X.fillRect(24, backY + 5, 24, 1);
    X.fillStyle = '#e8e2cc';
    for (let i = 0; i < 5; i++) X.fillRect(28 + i * 4, backY + 6, 1, 2);
    X.fillStyle = CROC_DK; X.fillRect(16, backY - 3, 5, 4);
    if (calm) {
      X.fillStyle = CROC_DK; X.fillRect(17, backY - 1, 4, 1);   // eye shut — sated, no hunt
    } else {
      X.fillStyle = stunned ? '#caca60' : '#f0d24a'; X.fillRect(17, backY - 2, 3, 2);
      X.fillStyle = '#1a1000'; X.fillRect(18, backY - 2, 1, 2);
      if (!stunned && Math.sin(t / 900 + x) > 0.6) { X.fillStyle = '#bfe2f0'; X.fillRect(17, backY + 1, 1, 2); }
    }
    X.restore();

    X.save(); X.globalAlpha = 0.4; X.fillStyle = WATER_DK;
    X.fillRect(x - 30, backY + 9, 64, 5); X.restore();
  }
}

// ── The city district — mud-brick buildings behind the bazaar (east end) ──
// Matches the desert→city transition's vocabulary: flat roofs + parapets, a
// warm sunset wash on the east face, domes, a minaret, warm-lit windows and a
// great arched gate (near the return gate). Clusters at the east where you
// arrive and tapers west into the river wilds. A backdrop — drawn first, so
// the river, banks, palms and bazaar all render in front of it.
const _cityRnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function _cityLamp(lx, ly, t, s) {
  const a = s * (0.7 + 0.3 * Math.sin(t / 500 + lx));
  X.save();
  const g = X.createRadialGradient(lx, ly, 0, lx, ly, 14 * s);
  g.addColorStop(0,   `rgba(255,214,120,${0.9 * a})`);
  g.addColorStop(0.5, `rgba(240,150,55,${0.4 * a})`);
  g.addColorStop(1,   'transparent');
  X.fillStyle = g; X.fillRect(lx - 14 * s, ly - 14 * s, 28 * s, 28 * s);
  X.fillStyle = `rgba(255,234,170,${Math.min(1, a)})`; X.fillRect(lx - 1.5, ly - 1.5, 3, 3);
  X.restore();
}

function drawCityscape(t) {
  const rnd = _cityRnd;
  const baseY  = BANK_Y;
  const X0 = 6120, X1 = 7380;          // the city — east of (right of) the riverside bazaar
                                       // (west edge pulled back to clear the shifted bazaar)
  const GATE_X = 7280;                  // the great arched gate (by the return gate)

  // cull: the district only sits at the east end — skip it entirely elsewhere
  if (G.camX + CW < X0 - 40 || G.camX > X1 + 40) return;

  // back row — distant, cooler, hazy rooftops for depth
  X.save();
  X.globalAlpha = 0.5; X.fillStyle = '#2c2340';
  for (let x = X0 - 30, i = 0; x < X1 + 40; i++) {
    const bw = 40 + rnd(i * 5.1) * 50;
    const east = (x - X0) / (X1 - X0);
    const bh = (30 + rnd(i * 3.3 + 2) * 46) * (0.5 + Math.max(0, east) * 0.7);
    X.fillRect(x, baseY - bh - 26, bw + 1, bh + 26);
    if (rnd(i * 4 + 1) > 0.8) { X.beginPath(); X.arc(x + bw / 2, baseY - bh - 26, bw * 0.4, Math.PI, 0); X.fill(); }
    x += bw;
  }
  X.restore();

  // near row — the main mud-brick buildings
  for (let x = X0, i = 0; x < X1; i++) {
    const bw   = 50 + rnd(i * 1.3) * 66;
    const east = (x - X0) / (X1 - X0);                 // 0 west .. 1 east
    const bh   = (60 + rnd(i * 2.1 + 3) * 84) * (0.82 + east * 0.34);  // full city, gentle east lift
    const topY = baseY - bh;
    const isTower = rnd(i * 6 + 2) > 0.8;
    const hasDome = !isTower && rnd(i * 3 + 7) > 0.7;
    const isGate  = x <= GATE_X && x + bw > GATE_X;

    // body + a warm sunset wash on the east (right) face
    X.fillStyle = '#241a30'; X.fillRect(x, topY, bw, bh + 4);
    const lit = X.createLinearGradient(x, 0, x + bw, 0);
    lit.addColorStop(0, 'rgba(150,90,46,0)');
    lit.addColorStop(1, 'rgba(168,100,50,0.7)');
    X.fillStyle = lit; X.fillRect(x, topY, bw, bh + 4);
    X.fillStyle = '#2e2236'; X.fillRect(x - 2, topY, bw + 4, 5);                 // parapet
    X.fillStyle = 'rgba(176,104,54,0.55)'; X.fillRect(x - 2, topY, bw + 4, 1);   // sunlit lip

    if (isTower) {
      const tw = bw * 0.44;
      X.fillStyle = '#241a30'; X.fillRect(x + bw / 2 - tw / 2, topY - 22, tw, 22);
      X.fillStyle = '#2e2236';
      X.beginPath();
      X.moveTo(x + bw / 2 - tw / 2, topY - 22);
      X.lineTo(x + bw / 2, topY - 40);
      X.lineTo(x + bw / 2 + tw / 2, topY - 22); X.fill();
      _cityLamp(x + bw / 2, topY - 14, t, 1.2);
    } else if (hasDome) {
      X.fillStyle = '#2a2038';
      X.beginPath(); X.arc(x + bw / 2, topY, bw * 0.42, Math.PI, 0); X.fill();
      X.fillStyle = 'rgba(168,100,50,0.4)';
      X.beginPath(); X.arc(x + bw / 2, topY, bw * 0.42, Math.PI, Math.PI * 1.5); X.fill();
    }

    if (isGate) {
      const gw = Math.min(bw * 0.6, 44), gx = GATE_X, gy = baseY;
      const gg = X.createLinearGradient(0, gy - bh * 0.55, 0, gy);
      gg.addColorStop(0, 'rgba(255,196,96,0.35)');
      gg.addColorStop(1, 'rgba(255,150,60,0.8)');
      X.fillStyle = gg;
      X.beginPath();
      X.moveTo(gx - gw / 2, gy);
      X.lineTo(gx - gw / 2, gy - bh * 0.4);
      X.quadraticCurveTo(gx, gy - bh * 0.6, gx + gw / 2, gy - bh * 0.4);
      X.lineTo(gx + gw / 2, gy);
      X.fill();
      _cityLamp(gx - gw / 2, gy - bh * 0.36, t, 0.9);
      _cityLamp(gx + gw / 2, gy - bh * 0.36, t, 0.9);
    }

    // warm-lit windows (you arrive at dusk into a lit city)
    const cols = Math.max(1, Math.floor(bw / 18));
    const rows = Math.max(1, Math.floor(bh / 30));
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        const wx = x + 10 + cc * 18, wy = topY + 16 + r * 28;
        if (wy > baseY - 8) continue;
        if (rnd(i * 41 + r * 7 + cc * 3) > 0.4) {
          const fl = 0.7 + 0.3 * Math.sin(t / 600 + wx);
          X.fillStyle = `rgba(255,150,50,${0.22 * fl})`; X.fillRect(wx - 3, wy - 4, 7, 9);
          X.fillStyle = `rgba(255,206,110,${0.9 * fl})`; X.fillRect(wx - 1.5, wy - 2, 3, 5);
        } else {
          X.fillStyle = 'rgba(18,10,26,0.5)'; X.fillRect(wx - 1.5, wy - 2, 3, 5);
        }
      }
    }
    x += bw;
  }
}

// ── The Bazaar of Believers (world-space, on the east bank) ──
function drawBazaar(t) {
  const baseY = BANK_Y;

  // festival bunting strung across the whole market
  X.save(); X.globalAlpha = 0.85;
  for (let i = 0; i < 15; i++) {
    const bx = BAZAAR_X - 168 + i * 24;
    X.fillStyle = ['#b8483a', '#c8a040', '#3a6a8a', '#caa060'][i % 4];
    X.beginPath(); X.moveTo(bx, baseY - 96); X.lineTo(bx + 6, baseY - 88); X.lineTo(bx + 12, baseY - 96); X.fill();
  }
  X.restore();

  // the lesser vendors flank the Merchant's tent, pushed out to clear it
  drawStall(BAZAAR_X - 124, baseY, t, '#b8483a');
  drawStall(BAZAAR_X + 124, baseY, t, '#3a6a8a');

  // the faithful, browsing the market
  drawBeliever(BAZAAR_X +  78, baseY, 0, t, false);   // at the tent mouth
  drawBeliever(BAZAAR_X + 150, baseY, 1, t, true);    // kneeling by the right stall
  drawBeliever(BAZAAR_X - 150, baseY, 2, t, false);   // by the left stall

  // the Merchant's own full tent — back wall + roof drawn first, he stands in it
  drawMerchantTent(BAZAAR_X, baseY, t);
  drawMerchant(BAZAAR_X, baseY - 4, t);

  // his trade dressing, in front of him: the scale of belief and the wares
  drawBalanceScale(BAZAAR_X - 30, baseY, t);
  drawWareTable(BAZAAR_X + 32, baseY, t);
}

// The Merchant's full tent — a proper peaked market pavilion he stands inside.
// Back wall + poles + canopy are drawn behind the figure; the valance, side
// drapes, lantern and sign hang at/above head height so the figure reads as
// sheltered within it.
export function drawMerchantTent(cx, baseY, t) {
  const HW = 54;                       // half-width at the base
  const ridgeY = baseY - 120;          // roof peak
  const eaveY  = baseY - 84;           // where the canopy meets the poles
  const TENT = '#7a3a30', TENT_LT = '#9a4f42', TENT_DK = '#5a281f';
  const POLE = '#5a3a16', POLE_LT = '#7a5224';

  // back wall (interior fabric) — the Merchant stands in front of this
  X.fillStyle = '#3a1d18'; X.fillRect(cx - HW + 6, eaveY, (HW - 6) * 2, baseY - eaveY);
  X.fillStyle = '#46241d';
  for (let i = 0; i < 10; i++) X.fillRect(cx - HW + 8 + i * 10, eaveY, 4, baseY - eaveY);   // seams
  X.fillStyle = '#00000033'; X.fillRect(cx - HW + 6, baseY - 4, (HW - 6) * 2, 4);           // floor shadow

  // two front poles + gilt finials
  X.fillStyle = POLE;    X.fillRect(cx - HW, eaveY, 5, baseY - eaveY); X.fillRect(cx + HW - 5, eaveY, 5, baseY - eaveY);
  X.fillStyle = POLE_LT; X.fillRect(cx - HW, eaveY, 2, baseY - eaveY); X.fillRect(cx + HW - 5, eaveY, 2, baseY - eaveY);
  X.fillStyle = '#caa040'; X.fillRect(cx - HW - 1, eaveY - 4, 7, 4); X.fillRect(cx + HW - 6, eaveY - 4, 7, 4);

  // peaked canopy
  X.fillStyle = TENT;
  X.beginPath(); X.moveTo(cx, ridgeY); X.lineTo(cx + HW + 8, eaveY); X.lineTo(cx - HW - 8, eaveY); X.closePath(); X.fill();
  X.fillStyle = TENT_LT;                                                                  // lit left slope
  X.beginPath(); X.moveTo(cx, ridgeY); X.lineTo(cx - HW - 8, eaveY); X.lineTo(cx - HW + 4, eaveY); X.lineTo(cx - 2, ridgeY + 4); X.closePath(); X.fill();
  X.fillStyle = TENT_DK; X.fillRect(cx - 1, ridgeY, 2, 12);                               // ridge
  X.save(); X.globalAlpha = 0.45; X.strokeStyle = '#caa040'; X.lineWidth = 1;             // gilt seams
  for (let i = 1; i <= 3; i++) {
    X.beginPath(); X.moveTo(cx, ridgeY + i * 8); X.lineTo(cx + (HW + 8) * i / 4, eaveY); X.stroke();
    X.beginPath(); X.moveTo(cx, ridgeY + i * 8); X.lineTo(cx - (HW + 8) * i / 4, eaveY); X.stroke();
  }
  X.restore();

  // scalloped valance hanging from the eave
  X.fillStyle = TENT_DK;
  for (let i = 0; i < 11; i++) {
    const vx = cx - HW - 6 + i * ((HW * 2 + 12) / 10);
    X.beginPath(); X.moveTo(vx - 5, eaveY); X.lineTo(vx, eaveY + 7); X.lineTo(vx + 5, eaveY); X.closePath(); X.fill();
  }
  X.fillStyle = '#caa040'; X.fillRect(cx - HW - 6, eaveY - 2, HW * 2 + 12, 2);            // valance rail

  // side drapes tied back at the poles
  X.fillStyle = TENT_DK;
  X.beginPath(); X.moveTo(cx - HW, eaveY); X.lineTo(cx - HW + 11, eaveY + 8); X.lineTo(cx - HW + 4, baseY); X.lineTo(cx - HW, baseY); X.closePath(); X.fill();
  X.beginPath(); X.moveTo(cx + HW, eaveY); X.lineTo(cx + HW - 11, eaveY + 8); X.lineTo(cx + HW - 4, baseY); X.lineTo(cx + HW, baseY); X.closePath(); X.fill();
  X.fillStyle = '#caa040'; X.fillRect(cx - HW + 6, eaveY + 7, 2, 2); X.fillRect(cx + HW - 8, eaveY + 7, 2, 2);  // ties

  // hanging lantern at the right of the mouth
  const la = 0.6 + 0.3 * Math.sin(t / 500);
  X.save(); X.globalAlpha = 0.5 * la;
  const lg = X.createRadialGradient(cx + 40, eaveY + 16, 1, cx + 40, eaveY + 16, 20);
  lg.addColorStop(0, '#ffcf80'); lg.addColorStop(1, 'transparent');
  X.fillStyle = lg; X.fillRect(cx + 20, eaveY - 4, 40, 40); X.restore();
  X.strokeStyle = '#3a2410'; X.lineWidth = 1; X.beginPath(); X.moveTo(cx + 40, eaveY + 2); X.lineTo(cx + 40, eaveY + 12); X.stroke();
  X.fillStyle = '#c8902c'; X.fillRect(cx + 38, eaveY + 12, 5, 6);

  // signboard across the front, above the Merchant's head
  X.save(); X.globalAlpha = 0.94;
  X.fillStyle = '#e8dcc0'; X.fillRect(cx - 42, eaveY + 1, 84, 11);
  X.fillStyle = '#caa040'; X.fillRect(cx - 42, eaveY + 1, 84, 1);
  X.fillStyle = '#9a3a2a'; X.font = '5px monospace'; X.textAlign = 'center';
  X.fillText('BAZAAR OF BELIEVERS', cx, eaveY + 9);
  X.textAlign = 'left'; X.restore();
}

// A standing balance — he values belief "at face amount". The beam tips slowly.
function drawBalanceScale(px, baseY, t) {
  const postH = 40, baseTop = baseY - postH;
  X.fillStyle = '#5a3a16'; X.fillRect(px - 7, baseY - 3, 16, 3);     // foot
  X.fillStyle = '#7a5a2a'; X.fillRect(px - 1, baseTop, 3, postH);    // post
  const tip = Math.sin(t / 1500) * 2.2;
  const bx1 = px - 13, bx2 = px + 15, by1 = baseTop - tip, by2 = baseTop + tip;
  X.strokeStyle = '#caa040'; X.lineWidth = 1.5;
  X.beginPath(); X.moveTo(bx1, by1); X.lineTo(bx2, by2); X.stroke();
  X.strokeStyle = '#9a7c3a'; X.lineWidth = 1;
  X.beginPath(); X.moveTo(bx1, by1); X.lineTo(bx1, by1 + 7); X.stroke();
  X.beginPath(); X.moveTo(bx2, by2); X.lineTo(bx2, by2 + 7); X.stroke();
  X.fillStyle = '#b8902c';
  X.beginPath(); X.ellipse(bx1, by1 + 8, 5, 2, 0, 0, Math.PI * 2); X.fill();
  X.beginPath(); X.ellipse(bx2, by2 + 8, 5, 2, 0, 0, Math.PI * 2); X.fill();
}

// The wares laid out, finally distinct: a blue scarab, a sealed protection
// scroll, and the upright blank "bundle" scroll (the premium product is potential).
function drawWareTable(tx, baseY, t) {
  const top = baseY - 20;
  X.fillStyle = '#6a461c'; X.fillRect(tx - 22, top, 44, 4);          // table top
  X.fillStyle = '#3a2410'; X.fillRect(tx - 22, top, 44, 1);
  X.fillStyle = '#4a3014'; X.fillRect(tx - 20, top + 4, 3, 16); X.fillRect(tx + 17, top + 4, 3, 16);  // legs
  // scarab amulet (blue, winged)
  X.fillStyle = '#2f6a8a'; X.beginPath(); X.ellipse(tx - 13, top - 3, 5, 4, 0, 0, Math.PI * 2); X.fill();
  X.fillStyle = '#5aa6c8'; X.fillRect(tx - 14, top - 6, 2, 2);
  X.fillStyle = '#1a3a4a'; X.fillRect(tx - 13, top - 4, 1, 5);
  // rolled protection scroll, ribboned
  X.fillStyle = '#d8c8a0'; X.fillRect(tx - 3, top - 6, 8, 6);
  X.fillStyle = '#b8a276'; X.fillRect(tx - 3, top - 6, 8, 1); X.fillRect(tx - 3, top - 1, 8, 1);
  X.fillStyle = '#9a3a2a'; X.fillRect(tx + 0, top - 5, 1, 4);
  // upright blank bundle scroll, tied
  X.fillStyle = '#e8dcc0'; X.fillRect(tx + 12, top - 9, 6, 9);
  X.fillStyle = '#caa040'; X.fillRect(tx + 12, top - 5, 6, 1);
}

function drawStall(cx, baseY, t, awning) {
  X.fillStyle = '#5a3a16';
  X.fillRect(cx - 40, baseY - 72, 5, 72);
  X.fillRect(cx + 35, baseY - 72, 5, 72);
  X.fillStyle = '#6a461c'; X.fillRect(cx - 44, baseY - 24, 88, 12);
  X.fillStyle = '#83592a'; X.fillRect(cx - 44, baseY - 24, 88, 3);
  X.fillStyle = '#7a5224'; X.fillRect(cx - 38, baseY - 34, 8, 10); X.fillRect(cx + 26, baseY - 33, 9, 9);
  X.fillStyle = '#3a6a3a';
  for (let i = 0; i < 5; i++) X.fillRect(cx - 16 + i * 7, baseY - 30, 4, 3);
  // awning
  X.fillStyle = awning; X.fillRect(cx - 46, baseY - 80, 92, 10);
  X.fillStyle = '#efe2c2';
  for (let i = 0; i < 6; i++) X.fillRect(cx - 46 + i * 16, baseY - 80, 8, 10);
  X.fillStyle = awning;
  for (let i = 0; i < 9; i++) X.fillRect(cx - 46 + i * 10, baseY - 70, 6, 4);
  // hanging identical charms
  X.save();
  const swing = Math.sin(t / 1300 + cx) * 1.5;
  for (let i = 0; i < 6; i++) {
    const hx = cx - 34 + i * 13 + swing;
    X.strokeStyle = '#caa060'; X.lineWidth = 1;
    X.beginPath(); X.moveTo(hx, baseY - 70); X.lineTo(hx, baseY - 56); X.stroke();
    X.fillStyle = '#2e7a4e'; X.fillRect(hx - 2, baseY - 56, 5, 5);
    X.fillStyle = '#7fe0a0'; X.fillRect(hx - 1, baseY - 55, 1, 1);
  }
  X.restore();
  // banner
  X.save(); X.globalAlpha = 0.92;
  X.fillStyle = '#e8dcc0'; X.fillRect(cx - 30, baseY - 52, 60, 12);
  X.fillStyle = '#9a3a2a'; X.font = '4px monospace'; X.textAlign = 'center';
  X.fillText('GUARANTEED DOWNLINE', cx, baseY - 44);
  X.textAlign = 'left'; X.restore();
  // lantern glow
  const la = 0.6 + 0.3 * Math.sin(t / 500 + cx);
  X.save(); X.globalAlpha = 0.5 * la;
  const lg = X.createRadialGradient(cx + 30, baseY - 64, 1, cx + 30, baseY - 64, 22);
  lg.addColorStop(0, '#ffcf80'); lg.addColorStop(1, 'transparent');
  X.fillStyle = lg; X.fillRect(cx + 8, baseY - 86, 44, 44); X.restore();
  X.fillStyle = '#c8902c'; X.fillRect(cx + 28, baseY - 66, 5, 6);
}

// A robed pilgrim — standers raise both arms in praise, kneelers bow. Drawn so the
// silhouette reads unmistakably as a person, not an urn.
function drawBeliever(x, baseY, variant, t, kneel) {
  const robe   = ['#8a5a3a', '#6a4e7a', '#4e6a64'][variant % 3];
  const robeLt = ['#a8744c', '#806094', '#5e8078'][variant % 3];
  const skin   = '#c2926a';
  const bob = Math.sin(t / 800 + variant * 1.7) * 1.2;
  const y = baseY + bob;

  if (kneel) {
    // robe pooled on the ground (wide base → clearly seated/kneeling)
    X.fillStyle = robe;
    X.beginPath();
    X.moveTo(x - 11, y); X.lineTo(x - 4, y - 17); X.lineTo(x + 5, y - 17); X.lineTo(x + 11, y); X.fill();
    X.fillStyle = robeLt; X.fillRect(x - 4, y - 17, 9, 3);
    X.fillStyle = skin; X.fillRect(x - 3, y - 24, 7, 7);       // bowed head
    X.fillStyle = robe; X.fillRect(x - 4, y - 25, 9, 3);       // head-cloth
    X.fillStyle = skin; X.fillRect(x - 1, y - 15, 4, 3);       // clasped hands
    return;
  }

  // standing worshipper — robe flares at the hem (trapezoid body)
  X.fillStyle = robe;
  X.beginPath();
  X.moveTo(x - 4, y - 27); X.lineTo(x + 5, y - 27);
  X.lineTo(x + 9, y); X.lineTo(x - 8, y); X.fill();
  X.fillStyle = robeLt; X.fillRect(x - 4, y - 27, 9, 3);       // shoulders
  X.fillStyle = '#00000022'; X.fillRect(x - 8, y - 2, 17, 2);  // ground shadow
  // head + cloth
  X.fillStyle = skin; X.fillRect(x - 3, y - 36, 7, 8);
  X.fillStyle = robe; X.fillRect(x - 4, y - 37, 9, 3);
  X.fillStyle = robeLt; X.fillRect(x - 4, y - 37, 9, 1);
  // both arms raised up-and-out in praise
  const lift = Math.sin(t / 600 + variant) * 2;
  X.strokeStyle = robe; X.lineWidth = 2;
  X.beginPath(); X.moveTo(x - 3, y - 25); X.lineTo(x - 9, y - 35 - lift); X.stroke();
  X.beginPath(); X.moveTo(x + 4, y - 25); X.lineTo(x + 10, y - 35 - lift); X.stroke();
  X.fillStyle = skin;                                          // hands
  X.fillRect(x - 11, y - 37 - lift, 3, 3);
  X.fillRect(x + 9, y - 37 - lift, 3, 3);
}

export function drawMerchant(x, baseY, t) {
  const y = baseY;
  const look = Math.max(-1, Math.min(1, (G.px - x) / 140));   // eyes track the mark

  // robe — richer purple, lit shoulders, shaded side, gold hem
  X.fillStyle = '#7a2f6a'; X.fillRect(x - 8, y - 42, 16, 42);
  X.fillStyle = '#9a4f8a'; X.fillRect(x - 8, y - 42, 16, 4);
  X.fillStyle = '#5a1f4e'; X.fillRect(x + 6, y - 40, 2, 38);
  X.fillStyle = '#caa040'; X.fillRect(x - 8, y - 4, 16, 3);
  X.fillStyle = '#d8b040'; X.fillRect(x - 8, y - 22, 16, 3);          // sash
  // coin-pouch slung on the sash
  X.fillStyle = '#6a4a1a'; X.beginPath(); X.ellipse(x + 6, y - 17, 4, 5, 0, 0, Math.PI * 2); X.fill();
  X.fillStyle = '#caa040'; X.fillRect(x + 3, y - 22, 6, 2);
  // head, jaw shade, fez + tassel
  X.fillStyle = '#c2926a'; X.fillRect(x - 5, y - 54, 10, 12);
  X.fillStyle = '#a8744c'; X.fillRect(x - 5, y - 47, 10, 1);
  X.fillStyle = '#8a2020'; X.fillRect(x - 6, y - 64, 12, 10);
  X.fillStyle = '#a83030'; X.fillRect(x - 6, y - 64, 12, 2);
  X.fillStyle = '#d8b040'; X.fillRect(x - 1, y - 66, 2, 4);
  // tracking eyes (whites + shifting pupils)
  X.fillStyle = '#e8e2d0'; X.fillRect(x - 4, y - 49, 3, 2); X.fillRect(x + 1, y - 49, 3, 2);
  X.fillStyle = '#1a1008'; X.fillRect(x - 3 + Math.round(look), y - 49, 1, 2); X.fillRect(x + 2 + Math.round(look), y - 49, 1, 2);
  // sly grin with a gold-tooth glint
  X.fillStyle = '#3a1810'; X.fillRect(x - 3, y - 45, 6, 1);
  X.save(); X.globalAlpha = 0.5 + 0.4 * Math.sin(t / 300);
  X.fillStyle = '#ffe9b0'; X.fillRect(x + 1, y - 45, 1, 1); X.restore();
  // raised arm — a scarab held up to the light, gold ring on the hand
  const wav = Math.sin(t / 600) * 2;
  X.fillStyle = '#7a2f6a'; X.fillRect(x + 6, y - 46 + wav, 4, 12);
  X.fillStyle = '#2f6a8a'; X.beginPath(); X.ellipse(x + 9, y - 50 + wav, 4, 3, 0, 0, Math.PI * 2); X.fill();
  X.fillStyle = '#5aa6c8'; X.fillRect(x + 7, y - 52 + wav, 2, 1);
  X.fillStyle = '#caa040'; X.fillRect(x + 7, y - 37 + wav, 4, 2);     // ring
  X.save(); X.globalAlpha = 0.4 + 0.2 * Math.sin(t / 400);
  X.fillStyle = '#ffe9b0'; X.fillRect(x + 10, y - 51 + wav, 1, 1); X.restore();
}

// ── Moses-in-the-bulrushes (world-space, in the reeds) ────
function drawMosesBasket(t) {
  const x = MOSES_X;
  const decided = Flags.get('nile_baby');           // 'adopted' | 'drowned' | false
  const bob = Math.sin(t / 800) * 1.5;
  const y = WATER_Y + 2 + bob;

  // reeds always sway here, marking the place
  X.strokeStyle = REED_GRN; X.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    const rx = x + i * 5; const h = 16 + (i % 2) * 6; const sway = Math.sin(t / 1200 + rx) * 1.4;
    X.beginPath(); X.moveTo(rx, y + 2); X.lineTo(rx + sway, y - h); X.stroke();
  }

  // drowned: no basket — it sank. Just the reeds and a slow ripple.
  if (decided === 'drowned') {
    X.save(); X.globalAlpha = 0.3; X.strokeStyle = '#bfe2dc';
    X.beginPath(); X.ellipse(x, y + 5, 14, 3, 0, 0, Math.PI * 2); X.stroke(); X.restore();
    return;
  }

  // the basket itself
  X.fillStyle = '#8a6a30'; X.fillRect(x - 8, y - 6, 16, 8);
  X.fillStyle = '#a07c38'; X.fillRect(x - 8, y - 6, 16, 2);
  X.fillStyle = '#6a4f22';
  for (let i = 0; i < 4; i++) X.fillRect(x - 8 + i * 4, y - 6, 1, 8);
  // swaddle/lid only while the child is still inside (before the choice)
  if (!decided) { X.fillStyle = '#d8c8b0'; X.fillRect(x - 5, y - 8, 10, 3); }
  X.save(); X.globalAlpha = 0.3; X.strokeStyle = '#bfe2dc';
  X.beginPath(); X.ellipse(x, y + 5, 14, 3, 0, 0, Math.PI * 2); X.stroke(); X.restore();
}

// ── The Ferryman & his reed ferry (world-space, water's edge) ─
function drawFerry(t) {
  const cx = FERRY_X, baseY = BANK_Y, wy = BANK_FOOT + 6;

  // mooring post on the quay
  X.fillStyle = '#5a3a16'; X.fillRect(cx - 46, baseY - 12, 4, 12);
  X.fillStyle = '#3a2410'; X.fillRect(cx - 46, baseY - 12, 4, 2);

  // reed-bundle raft
  X.fillStyle = '#6a5226'; X.fillRect(cx - 30, wy, 70, 7);
  X.fillStyle = '#8a6c34'; X.fillRect(cx - 30, wy, 70, 2);
  X.fillStyle = '#4a3814';
  for (let i = 0; i < 7; i++) X.fillRect(cx - 28 + i * 10, wy, 1, 7);
  X.fillStyle = '#6a5226';                                  // upturned prow (west)
  X.beginPath(); X.moveTo(cx - 30, wy); X.lineTo(cx - 46, wy - 9); X.lineTo(cx - 30, wy + 3); X.fill();

  // stern lantern
  const la = 0.5 + 0.3 * Math.sin(t / 500);
  X.save(); X.globalAlpha = 0.5 * la;
  const lg = X.createRadialGradient(cx + 34, wy - 12, 1, cx + 34, wy - 12, 18);
  lg.addColorStop(0, '#ffcf80'); lg.addColorStop(1, 'transparent');
  X.fillStyle = lg; X.fillRect(cx + 18, wy - 30, 32, 30); X.restore();
  X.fillStyle = '#5a3a16'; X.fillRect(cx + 34, wy - 24, 1, 13);
  X.fillStyle = '#c8902c'; X.fillRect(cx + 32, wy - 13, 5, 5);

  // ── the Ferryman: tall, hooded, working a long pole ──
  const fx = cx - 4, fy = baseY;
  X.strokeStyle = '#6a4a24'; X.lineWidth = 2;
  X.beginPath(); X.moveTo(fx + 6, fy - 46); X.lineTo(cx + 26, wy + 6); X.stroke();   // pole
  X.fillStyle = '#2a2230';                                  // long cloak
  X.beginPath(); X.moveTo(fx - 8, fy); X.lineTo(fx - 4, fy - 48); X.lineTo(fx + 5, fy - 48); X.lineTo(fx + 9, fy); X.fill();
  X.fillStyle = '#3a3040'; X.fillRect(fx - 4, fy - 48, 9, 4);
  X.fillStyle = '#241d2a'; X.fillRect(fx - 5, fy - 56, 11, 12);   // hood
  X.fillStyle = '#000000'; X.fillRect(fx - 2, fy - 51, 5, 6);     // void face
  X.save(); X.globalAlpha = 0.6 + 0.3 * Math.sin(t / 400);
  X.fillStyle = '#9ad0c0'; X.fillRect(fx - 1, fy - 49, 1, 1); X.fillRect(fx + 1, fy - 49, 1, 1);
  X.restore();
}

// ── Sobek — the crocodile-god enforcer, a monumental idol, weeping ──
function drawSobekIdol(t) {
  const cx = SOBEK_X, baseY = BANK_Y;
  const S_DK = '#2f3a2e', S_MD = '#46563e', S_LT = '#627250';
  const GOLD = '#d8b040', GOLD_DK = '#a07c20';

  // aura
  X.save(); X.globalAlpha = 0.10 + 0.04 * Math.sin(t / 1400);
  const aura = X.createRadialGradient(cx, baseY - 130, 12, cx, baseY - 130, 160);
  aura.addColorStop(0, '#9ad08a'); aura.addColorStop(1, 'transparent');
  X.fillStyle = aura; X.fillRect(cx - 160, baseY - 290, 320, 320); X.restore();

  // plinth + hieroglyph band
  X.fillStyle = S_DK; X.fillRect(cx - 54, baseY - 28, 108, 28);
  X.fillStyle = S_MD; X.fillRect(cx - 54, baseY - 28, 108, 5);
  X.fillStyle = GOLD_DK;
  for (let i = 0; i < 9; i++) X.fillRect(cx - 48 + i * 11, baseY - 22, 6, 9);

  // throne
  X.fillStyle = S_DK; X.fillRect(cx - 40, baseY - 150, 80, 122);
  X.fillStyle = S_MD; X.fillRect(cx - 40, baseY - 150, 80, 3);          // lit top edge
  // carved hieroglyph columns down the throne sides (give the slab mass)
  X.save(); X.globalAlpha = 0.45; X.fillStyle = GOLD_DK;
  for (const tx of [cx - 37, cx + 31]) {
    for (let i = 0; i < 7; i++) X.fillRect(tx, baseY - 142 + i * 15, 6, 8);
  }
  X.restore();
  // thighs → knees (seated)
  X.fillStyle = S_MD; X.fillRect(cx - 34, baseY - 42, 26, 16); X.fillRect(cx + 8, baseY - 42, 26, 16);
  X.fillStyle = S_LT; X.fillRect(cx - 34, baseY - 42, 26, 3); X.fillRect(cx + 8, baseY - 42, 26, 3);
  X.fillStyle = S_LT; X.fillRect(cx - 32, baseY - 48, 11, 8); X.fillRect(cx + 21, baseY - 48, 11, 8);  // hands on knees
  // kilt
  X.fillStyle = GOLD; X.fillRect(cx - 20, baseY - 72, 40, 30);
  X.fillStyle = GOLD_DK; for (let i = 0; i < 6; i++) X.fillRect(cx - 18 + i * 7, baseY - 72, 2, 30);
  // torso + arms
  X.fillStyle = S_MD; X.fillRect(cx - 22, baseY - 120, 44, 50);
  X.fillStyle = S_LT; X.fillRect(cx - 22, baseY - 120, 44, 6);
  X.fillStyle = S_MD; X.fillRect(cx - 31, baseY - 112, 10, 66); X.fillRect(cx + 21, baseY - 112, 10, 66);
  // broad collar
  X.fillStyle = GOLD; X.fillRect(cx - 22, baseY - 114, 44, 8);
  X.fillStyle = GOLD_DK; for (let i = 0; i < 8; i++) X.fillRect(cx - 20 + i * 5.4, baseY - 112, 3, 4);

  // ── crocodile head ──
  const hy = baseY - 120;
  X.fillStyle = S_MD; X.fillRect(cx - 12, hy - 18, 24, 20);          // neck
  X.fillStyle = S_MD; X.fillRect(cx - 16, hy - 46, 32, 30);          // head block
  X.fillStyle = S_LT; X.fillRect(cx - 16, hy - 46, 32, 5);
  X.fillStyle = S_MD; X.fillRect(cx - 46, hy - 32, 32, 13);          // long snout (west)
  X.fillStyle = S_LT; X.fillRect(cx - 46, hy - 32, 32, 3);
  X.fillStyle = S_DK; X.fillRect(cx - 46, hy - 20, 32, 2);           // jaw line
  X.fillStyle = '#e8e2cc'; for (let i = 0; i < 8; i++) X.fillRect(cx - 44 + i * 4, hy - 19, 1, 3);  // teeth
  X.fillStyle = S_DK; X.fillRect(cx - 44, hy - 30, 3, 2);            // nostril
  X.fillStyle = S_DK; X.fillRect(cx - 13, hy - 40, 8, 7);            // eye socket
  X.fillStyle = '#f0d24a'; X.fillRect(cx - 12, hy - 39, 5, 4);
  X.fillStyle = '#1a1000'; X.fillRect(cx - 9, hy - 39, 2, 4);

  // weeping — a tear track down the snout, and a slow drip
  X.save();
  X.globalAlpha = 0.7; X.fillStyle = '#bfe2f0';
  X.fillRect(cx - 10, hy - 36, 1, 16);
  const drip = (t / 1100) % 1;
  X.globalAlpha = 0.85 * (1 - drip); X.fillRect(cx - 10, hy - 20 + drip * 28, 2, 3);
  X.restore();

  // ── crown: horns + double plumes + sun disc + uraeus ──
  const cyy = hy - 46;
  X.fillStyle = GOLD; X.fillRect(cx - 14, cyy - 4, 28, 5);
  X.strokeStyle = GOLD_DK; X.lineWidth = 2;
  X.beginPath(); X.arc(cx - 9, cyy, 6, Math.PI * 0.2, Math.PI * 1.1); X.stroke();   // ram horns
  X.beginPath(); X.arc(cx + 9, cyy, 6, -Math.PI * 0.1, Math.PI * 0.9); X.stroke();
  X.fillStyle = GOLD; X.fillRect(cx - 8, cyy - 36, 5, 34); X.fillRect(cx + 3, cyy - 36, 5, 34);  // plumes
  X.fillStyle = GOLD_DK; X.fillRect(cx - 8, cyy - 36, 5, 2); X.fillRect(cx + 3, cyy - 36, 5, 2);
  X.fillStyle = '#e8a23c'; X.beginPath(); X.arc(cx, cyy - 22, 7, 0, Math.PI * 2); X.fill();        // sun disc
  X.fillStyle = '#ffcf6e'; X.beginPath(); X.arc(cx, cyy - 22, 4, 0, Math.PI * 2); X.fill();
  X.fillStyle = GOLD; X.fillRect(cx - 1, cyy - 9, 3, 7);                                            // uraeus

  // offerings + braziers at the base
  X.fillStyle = '#6a4a2a'; X.fillRect(cx - 32, baseY - 7, 9, 7); X.fillRect(cx + 23, baseY - 7, 9, 7);
  const bz = 0.5 + 0.4 * Math.sin(t / 220);
  X.save(); X.globalAlpha = 0.7 * bz; X.fillStyle = '#f06020';
  X.fillRect(cx - 30, baseY - 12, 5, 5); X.fillRect(cx + 25, baseY - 12, 5, 5); X.restore();
}

// ── Joseph's granary, the Nilometer, and Joseph himself ───
function drawSilo(x, baseY, h, t) {
  const W = 30;
  X.fillStyle = '#8a6024';
  X.beginPath(); X.moveTo(x - W / 2, baseY); X.lineTo(x - W / 2 + 3, baseY - h);
  X.lineTo(x + W / 2 - 3, baseY - h); X.lineTo(x + W / 2, baseY); X.fill();
  X.fillStyle = '#6e4a18';
  for (let i = 0; i < h / 8; i++) X.fillRect(x - W / 2 + 1 + (i % 2), baseY - i * 8, W - 2, 1);  // mudbrick courses
  X.fillStyle = '#a3782e'; X.fillRect(x - W / 2 + 2, baseY - h, 4, h);                            // lit side
  X.fillStyle = '#7a5420'; X.beginPath(); X.ellipse(x, baseY - h, W / 2 - 2, 8, 0, Math.PI, 0); X.fill();  // dome
  X.fillStyle = '#3a280e'; X.fillRect(x - 3, baseY - h - 6, 6, 5);                                 // top opening
}

function drawNilometer(x, baseY, t) {
  const W = 34;
  X.fillStyle = '#7a6a4a'; X.fillRect(x - W / 2, baseY - 32, W, 32);          // headwall
  X.fillStyle = '#5a4c30'; X.fillRect(x - W / 2, baseY - 32, W, 4);
  X.fillStyle = '#1a140a'; X.fillRect(x - W / 2 + 5, baseY - 27, W - 10, 27); // shaft
  X.fillStyle = '#caa050';
  for (let i = 0; i < 6; i++) X.fillRect(x - W / 2 + 6, baseY - 24 + i * 4, W - 12, 1);  // flood graduations
  X.save(); X.globalAlpha = 0.45 + 0.2 * Math.sin(t / 500);                   // water glint at the bottom
  X.fillStyle = '#3a8aa0'; X.fillRect(x - W / 2 + 6, baseY - 7, W - 12, 6); X.restore();
  X.strokeStyle = '#caa050'; X.lineWidth = 1;                                 // cubit rod
  X.beginPath(); X.moveTo(x + W / 2 - 2, baseY - 36); X.lineTo(x + W / 2 + 4, baseY); X.stroke();
}

function drawJoseph(x, baseY, t) {
  const y = baseY;
  // the famous coat of many colours
  X.fillStyle = '#4a5a8a'; X.fillRect(x - 8, y - 44, 16, 44);
  X.fillStyle = '#8a4a3a'; X.fillRect(x - 8, y - 38, 16, 3);
  X.fillStyle = '#caa040'; X.fillRect(x - 8, y - 30, 16, 2);
  X.fillStyle = '#3a7a5a'; X.fillRect(x - 8, y - 22, 16, 2);
  X.fillStyle = '#8a4a3a'; X.fillRect(x - 8, y - 14, 16, 2);
  X.fillStyle = '#d8b040'; X.fillRect(x - 8, y - 44, 16, 4);          // gold collar
  X.fillStyle = '#c2926a'; X.fillRect(x - 5, y - 56, 10, 12);         // head
  X.fillStyle = '#3a5a8a'; X.fillRect(x - 6, y - 58, 12, 5);          // governor's headcloth
  X.fillStyle = '#d8b040'; X.fillRect(x - 6, y - 58, 12, 1);
  X.fillStyle = '#1a1008'; X.fillRect(x - 3, y - 50, 2, 2); X.fillRect(x + 1, y - 50, 2, 2);
  // arms — the right hand grips the staff of office
  X.fillStyle = '#4a5a8a'; X.fillRect(x - 11, y - 40, 4, 18);
  X.fillStyle = '#c2926a'; X.fillRect(x - 11, y - 24, 4, 4);
  X.fillStyle = '#4a5a8a'; X.fillRect(x + 7, y - 40, 4, 16);
  X.fillStyle = '#c2926a'; X.fillRect(x + 8, y - 26, 4, 4);
  X.fillStyle = '#caa050'; X.fillRect(x + 9, y - 60, 2, 60);          // staff of office
  X.fillStyle = '#d8b040'; X.fillRect(x + 7, y - 60, 6, 5);
}

function drawGranary(t) {
  const cx = JOSEPH_X, baseY = BANK_Y;
  drawSilo(cx - 112, baseY, 70, t);
  drawSilo(cx - 74,  baseY, 94, t);
  drawSilo(cx - 38,  baseY, 78, t);
  // grain heap spilling from the silos
  X.fillStyle = '#d8b24a';
  X.beginPath(); X.moveTo(cx - 132, baseY); X.lineTo(cx - 120, baseY - 12); X.lineTo(cx - 108, baseY); X.fill();
  X.fillStyle = '#c89a30';
  X.beginPath(); X.moveTo(cx - 124, baseY); X.lineTo(cx - 116, baseY - 7); X.lineTo(cx - 108, baseY); X.fill();
  drawNilometer(cx + 90, baseY, t);
  drawJoseph(cx, baseY, t);
}

function drawBoat(x, t) {
  const y = WATER_Y + 6 + Math.sin(t / 900) * 1.5;
  X.fillStyle = '#6b4a22'; X.fillRect(x - 26, y, 52, 7);
  X.beginPath(); X.moveTo(x - 26, y); X.lineTo(x - 42, y + 3); X.lineTo(x - 26, y + 7); X.fill();   // prow west
  X.fillStyle = '#6b4a22'; X.beginPath(); X.moveTo(x + 26, y); X.lineTo(x + 38, y - 6); X.lineTo(x + 26, y + 5); X.fill();
  X.strokeStyle = '#caa060'; X.lineWidth = 1; X.beginPath(); X.moveTo(x, y); X.lineTo(x, y - 30); X.stroke();  // mast
  X.fillStyle = '#d8c8a8'; X.beginPath(); X.moveTo(x, y - 28); X.lineTo(x - 14, y - 6); X.lineTo(x, y - 6); X.fill();  // sail
  X.save(); X.globalAlpha = 0.3; X.strokeStyle = '#bfe2dc';
  X.beginPath(); X.ellipse(x, y + 8, 30, 3, 0, 0, Math.PI * 2); X.stroke(); X.restore();
}

function drawDelta(realm, t) {
  // sea brightening at the far west — the river opens to the open water
  X.save(); X.globalAlpha = 0.32;
  const sg = X.createLinearGradient(0, WATER_Y, 420, WATER_Y);
  sg.addColorStop(0, '#7aa6ac'); sg.addColorStop(1, 'transparent');
  X.fillStyle = sg; X.fillRect(0, WATER_Y, 420, WATER_BOTTOM - WATER_Y); X.restore();

  // sandbars braiding the channel
  for (const [sx, sw] of [[1000, 120], [780, 90], [520, 150], [300, 90]]) {
    X.save(); X.globalAlpha = 0.85; X.fillStyle = '#7a5e30';
    X.beginPath(); X.ellipse(sx, WATER_Y + 28, sw / 2, 9, 0, 0, Math.PI * 2); X.fill(); X.restore();
    X.strokeStyle = REED_GRN; X.lineWidth = 1;
    for (let i = 0; i < sw / 16; i++) {
      const rx = sx - sw / 2 + i * 16;
      X.beginPath(); X.moveTo(rx, WATER_Y + 26); X.lineTo(rx + Math.sin(t / 1200 + rx) * 2, WATER_Y + 12); X.stroke();
    }
  }

  drawBoat(BOAT_X, t);
}

// ── NPC / interactable speak hint (screen-space) ──────────
function drawNpcHint(realm, t) {
  const e = G.nearEntity;
  if (!e || DialogueManager.isActive()) return;
  const label = e.id === 'boat' ? '[SPACE] THE BOAT'
              : e.id === 'moses' ? '[SPACE] THE BASKET'
              : `[SPACE] SPEAK${e.name ? '  ·  ' + e.name : ''}`;
  // Float above the player's head (never across tall scenery), with a backing.
  const sx = Math.max(60, Math.min(CW - 60, Math.round(G.px - G.camX)));
  const hy = Math.round(G.py - 58);
  const a = 0.6 + 0.4 * Math.abs(Math.sin(t / 420));
  X.save();
  X.font = '6px monospace'; X.textAlign = 'center';
  const w = X.measureText(label).width;
  X.globalAlpha = a * 0.5; X.fillStyle = '#000000';
  X.fillRect(sx - w / 2 - 3, hy - 7, w + 6, 9);
  X.globalAlpha = a; X.fillStyle = '#ffd98a';
  X.fillText(label, sx, hy);
  X.textAlign = 'left'; X.restore();
}

// ── HUD ───────────────────────────────────────────────────
function drawHUD() {
  X.fillStyle = '#0c0a08'; X.fillRect(0, CH - 28, CW, 28);
  X.fillStyle = '#73501f'; X.fillRect(0, CH - 28, CW, 1);
  X.font = '6px monospace';
  X.fillStyle = '#a87a36'; X.fillText('THE NILE', 8, CH - 10);
  X.textAlign = 'center';
  X.fillStyle = '#c89048'; X.fillText('← → MOVE / SWIM     [Z] JUMP     [SPACE] SPEAK     [↑] BACK', CW / 2, CH - 10);
  X.textAlign = 'right';
  X.fillStyle = '#6a4818'; X.fillText('WEST OF THE DESERT — DOWNSTREAM', CW - 8, CH - 10);
  X.textAlign = 'left';
}

// ── Master draw ───────────────────────────────────────────
export function drawNile(realm) {
  const t = Date.now();
  const camX = G.camX;

  // Screen-space background
  drawSky(t);
  drawSkyLife(t);
  drawFarBank(t, camX);

  // World-space scene
  X.save();
  X.translate(-Math.round(camX), 0);

  drawCityscape(t);                  // backdrop: the city behind the east-end bazaar
  drawWater(t);
  drawPalms(t);
  drawBanks(t);
  drawSobekIdol(t);
  drawGranary(t);
  drawBazaar(t);
  drawFerry(t);
  drawDelta(realm, t);
  drawReeds(t);
  drawMosesBasket(t);
  drawCrocs(realm, t);

  X.restore();

  // Player (screen-space; reads realm.getPlayerPose())
  drawRealmPharaoh(realm);

  // Screen-space overlays
  drawNpcHint(realm, t);
  drawHUD();
}
