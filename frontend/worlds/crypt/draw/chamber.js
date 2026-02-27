// ── FILE: worlds/crypt/draw/chamber.js ──────────────────

import { X, CW, CH }           from '../../../engine/canvas.js';
import { COL }                  from '../../../engine/colors.js';
import { CHAMBER_FLOOR, CHIEF_X } from '../constants.js';
import { Flags }                from '../../../engine/flags.js';
import { drawChamberPharaoh }   from '../../../draw/pharaoh.js';

// All chamber/crypt interior draw functions.
// drawChamber(realm) receives the ChamberRealm instance for state access.

export function drawChamber(realm) {
  const t  = Date.now();
  const p1 = Math.sin(t / 800);
  const p2 = Math.sin(t / 1300 + 1.1);

  // Background — deep cosmic void
  const bg = X.createRadialGradient(CW/2, CH/2, 30, CW/2, CH/2, 520);
  bg.addColorStop(0, '#021008'); bg.addColorStop(1, '#000204');
  X.fillStyle = bg; X.fillRect(0, 0, CW, CH);

  // Star field
  for (let i = 0; i < 60; i++) {
    const sx = ((i*137+11)*53) % CW;
    const sy = ((i*79+23)*31) % (CHAMBER_FLOOR - 80) + 80;
    const blink = Math.sin(t/900 + i*0.73) > 0.55;
    X.globalAlpha = blink ? 0.7 : 0.25;
    X.fillStyle = blink ? '#aaffcc' : '#448866';
    X.fillRect(sx, sy, blink?2:1, blink?2:1);
  }
  X.globalAlpha = 1;

  // Wall panels
  X.fillStyle = '#030b06';
  X.fillRect(0, 70, 52, CHAMBER_FLOOR - 70);
  X.fillRect(CW-52, 70, 52, CHAMBER_FLOOR - 70);
  drawWallCircuits(8, 110, t);
  drawWallCircuits(CW-50, 110, t);

  // Ceiling
  X.fillStyle = '#030a06'; X.fillRect(0, 0, CW, 78);
  for (let ci = 0; ci < 6; ci++) {
    const hx = 70 + ci * 132;
    const ga = 0.4 + 0.3 * Math.sin(t/650 + ci*1.2);
    X.fillStyle = '#0a1c0e'; X.fillRect(hx-8, 40, 16, 38);
    X.fillStyle = '#051008'; X.fillRect(hx-5, 44, 10, 30);
    X.save();
    X.globalAlpha = ga;
    const ng = X.createRadialGradient(hx, 78, 0, hx, 78, 32);
    ng.addColorStop(0, COL.NEON); ng.addColorStop(1, 'transparent');
    X.fillStyle = ng; X.fillRect(hx-32, 46, 64, 60);
    X.restore();
    X.fillStyle = `rgba(0,255,136,${ga})`; X.fillRect(hx-6, 74, 12, 4);
  }

  // Floor
  X.fillStyle = '#060f09'; X.fillRect(0, CHAMBER_FLOOR, CW, CH-CHAMBER_FLOOR);
  X.save();
  X.strokeStyle = 'rgba(0,255,136,0.10)'; X.lineWidth = 1;
  for (let gx = 0; gx <= CW; gx += 40) { X.beginPath(); X.moveTo(gx, CHAMBER_FLOOR); X.lineTo(gx, CH); X.stroke(); }
  for (let gy = CHAMBER_FLOOR; gy <= CH; gy += 32) { X.beginPath(); X.moveTo(0, gy); X.lineTo(CW, gy); X.stroke(); }
  X.restore();
  X.save(); X.globalAlpha = 0.18 + 0.08 * p1;
  const fg = X.createLinearGradient(0, CHAMBER_FLOOR-6, 0, CHAMBER_FLOOR+10);
  fg.addColorStop(0, COL.NEON); fg.addColorStop(1, 'transparent');
  X.fillStyle = fg; X.fillRect(0, CHAMBER_FLOOR-6, CW, 16);
  X.restore();

  // Header
  X.textAlign = 'center';
  X.font = '9px monospace';
  X.fillStyle = `rgba(0,255,136,${0.75 + 0.2 * p1})`;
  X.fillText('✦  GALACTIC PYRAMID SCHEME™  —  EARTH BRANCH 7G  ✦', CW/2, 30);
  X.font = '5px monospace';
  X.fillStyle = `rgba(0,200,110,${0.55 + 0.18 * p2})`;
  X.fillText('ACTIVE PLANETS: 847   |   TOTAL RECRUITS: ∞   |   EARTH TIER: 1   |   COMPLIANCE: NOMINAL', CW/2, 48);
  X.textAlign = 'left';

  drawHoloPyramid(300, 220, t);
  drawDeskAlien(150, CHAMBER_FLOOR, 0, t);
  drawDeskAlien(270, CHAMBER_FLOOR, 1, t);
  drawDeskAlien(430, CHAMBER_FLOOR, 2, t);
  drawDeskAlien(540, CHAMBER_FLOOR, 3, t);
  drawFounderPortrait(CW-30, 140, t);
  drawChiefAlien(CHIEF_X, CHAMBER_FLOOR, t);

  if (realm.registry?.nearest?.id === 'chief' && Flags.get('chief_spoken')) {
    X.textAlign = 'center';
    const hp = 0.55 + 0.45 * Math.abs(Math.sin(t/420));
    X.fillStyle = `rgba(0,255,136,${hp})`; X.font = '5px monospace';
    X.fillText('[SPACE] CONVERSE', CHIEF_X, CHAMBER_FLOOR - 76);
    X.textAlign = 'left';
  }

  drawChamberPharaoh(realm);

  // Chamber HUD
  X.fillStyle = '#020a05'; X.fillRect(0, CH-28, CW, 28);
  X.fillStyle = COL.NEON; X.fillRect(0, CH-28, CW, 1);
  X.font = '6px monospace';
  X.fillStyle = COL.NEON_DIM; X.fillText('PYRAMID CRYPT', 8, CH-10);
  X.textAlign = 'center';
  X.fillStyle = COL.NEON; X.fillText('← → MOVE     [↑] EXIT', CW/2, CH-10);
  X.textAlign = 'left';
  if (realm.registry?.nearest?.id === 'chief' && !Flags.get('chief_spoken')) {
    const a = 0.5 + 0.5 * Math.sin(t/380);
    X.fillStyle = `rgba(0,255,136,${a})`;
    X.textAlign = 'right';
    X.fillText('APPROACHING SECTOR CHIEF Ω-7', CW-8, CH-10);
    X.textAlign = 'left';
  }
}

function drawWallCircuits(x, startY, t) {
  const a = 0.25 + 0.18 * Math.sin(t/1100);
  X.save(); X.strokeStyle = `rgba(0,200,100,${a})`; X.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const cy = startY + i * 52;
    X.beginPath(); X.moveTo(x, cy); X.lineTo(x+38, cy); X.stroke();
    X.beginPath(); X.moveTo(x+38, cy); X.lineTo(x+38, cy+22); X.stroke();
    const na = a + 0.15 * Math.sin(t/600 + i*0.8);
    X.fillStyle = `rgba(0,255,136,${Math.min(1,na+0.2)})`;
    X.fillRect(x+36, cy-2, 4, 4);
  }
  X.restore();
}

function drawHoloPyramid(cx, cy, t) {
  const lean  = Math.sin(t / 4200) * 28;
  const bob   = Math.sin(t / 1700) * 7;
  const baseW = 170, ht = 145;
  const apx   = cx + lean * 0.25;
  const apy   = cy - ht / 2 + bob;
  const baseY = cy + ht / 2 + bob;
  X.save(); X.lineWidth = 1;
  for (let lv = 0; lv <= 6; lv++) {
    const pct  = lv / 6;
    const lw   = baseW * pct;
    const lx   = apx + lean * pct;
    const ly   = apy + (baseY - apy) * pct;
    const alph = 0.65 - pct * 0.12;
    X.strokeStyle = `rgba(0,255,136,${alph})`;
    X.beginPath(); X.moveTo(lx-lw/2, ly); X.lineTo(lx+lw/2, ly); X.stroke();
    if (lv < 6) {
      const pct2 = (lv+1)/6, lw2 = baseW*pct2;
      const lx2  = apx + lean*pct2, ly2 = apy + (baseY-apy)*pct2;
      X.strokeStyle = `rgba(0,255,136,0.45)`;
      X.beginPath(); X.moveTo(lx-lw/2, ly);  X.lineTo(lx2-lw2/2, ly2); X.stroke();
      X.beginPath(); X.moveTo(lx+lw/2, ly);  X.lineTo(lx2+lw2/2, ly2); X.stroke();
      X.fillStyle = `rgba(0,220,110,${alph-0.1})`;
      X.font = '4px monospace'; X.textAlign = 'left';
      X.fillText(`TIER ${lv+1}`, lx2+lw2/2+3, ly2+1);
    }
  }
  const ta = 0.7 + 0.3 * Math.sin(t/550);
  X.fillStyle = `rgba(0,255,136,${ta})`; X.font = '5px monospace'; X.textAlign = 'center';
  X.fillText('GALACTIC SCHEME', apx, apy-10);
  X.fillText('TIER 7,891,234',  apx, apy-3);
  X.globalAlpha = 0.1 + 0.06 * Math.sin(t/750);
  const grd = X.createRadialGradient(apx+lean, baseY, 0, apx+lean, baseY, baseW/2);
  grd.addColorStop(0, COL.NEON); grd.addColorStop(1, 'transparent');
  X.fillStyle = grd; X.fillRect(cx-baseW/2-10, baseY-18, baseW+20, 36);
  X.lineWidth = 1; X.textAlign = 'left'; X.restore();
}

function drawDeskAlien(cx, floorY, variant, t) {
  const bob   = Math.sin(t/950 + variant*1.6) * 1.5;
  const asleep = variant === 2;
  X.fillStyle = '#0b1c10'; X.fillRect(cx-32, floorY-26, 64, 8);
  X.fillStyle = '#060f08'; X.fillRect(cx-28, floorY-18, 56, 18);
  X.fillStyle = '#050e07';
  X.fillRect(cx-26, floorY-1, 6, 12); X.fillRect(cx+20, floorY-1, 6, 12);
  const mp = 0.4 + 0.3 * Math.sin(t/620 + variant*2.2);
  X.fillStyle = '#030e06'; X.fillRect(cx-18, floorY-48, 36, 20);
  X.strokeStyle = `rgba(0,255,136,${mp})`; X.lineWidth = 1;
  X.strokeRect(cx-18, floorY-48, 36, 20);
  const rows = ['▪▪▪ ∞ ▪▪', '10110111', '$$$→∞$$$'];
  X.font = '3px monospace'; X.textAlign = 'center';
  X.fillStyle = `rgba(0,255,136,${mp*0.8})`;
  X.fillText(rows[variant%3], cx, floorY-36); X.fillText(rows[(variant+1)%3], cx, floorY-30);
  X.textAlign = 'left';
  const headY = floorY - (asleep ? 62 : 74) + bob;
  if (asleep) {
    X.fillStyle = '#7a8a78'; X.fillRect(cx-10, floorY-30, 20, 10);
    const za = 0.45 + 0.35 * Math.sin(t/820);
    X.fillStyle = `rgba(0,255,136,${za})`; X.font = '6px monospace';
    X.fillText('zz', cx+10, floorY-50+Math.sin(t/900)*3);
    return;
  }
  X.fillStyle = '#7a8878'; X.fillRect(cx-9, headY, 18, 13);
  X.fillStyle = '#666e66'; X.fillRect(cx-10, headY+3, 2, 7); X.fillRect(cx+8, headY+3, 2, 7);
  X.fillStyle = '#050808'; X.fillRect(cx-7, headY+3, 6, 5); X.fillRect(cx+1, headY+3, 6, 5);
  X.fillStyle = '#103025'; X.fillRect(cx-6, headY+4, 2, 2); X.fillRect(cx+2, headY+4, 2, 2);
  X.fillStyle = '#404840'; X.fillRect(cx-3, headY+11, 6, 1);
  X.fillStyle = '#696e68'; X.fillRect(cx-2, headY+13, 4, 4);
  X.fillStyle = '#182818'; X.fillRect(cx-7, headY+17, 14, 10);
  X.fillStyle = '#7a8878';
  X.fillRect(cx-16, floorY-28, 14, 4); X.fillRect(cx+2, floorY-28, 14, 4);
}

function drawFounderPortrait(rx, topY, t) {
  const pa = 0.4 + 0.15 * Math.sin(t/1400);
  X.save(); X.globalAlpha = pa;
  X.fillStyle = '#003818'; X.fillRect(rx-34, topY, 34, 48);
  X.strokeStyle = '#00aa55'; X.lineWidth = 1; X.strokeRect(rx-34, topY, 34, 48);
  X.fillStyle = '#556655'; X.fillRect(rx-28, topY+8, 22, 28);
  X.fillStyle = '#0a0e0a';
  X.fillRect(rx-24, topY+12, 6, 5); X.fillRect(rx-16, topY+12, 6, 5);
  X.fillStyle = '#00884433'; X.fillRect(rx-28, topY+12, 4, 8); X.fillRect(rx-8, topY+12, 4, 8);
  X.fillStyle = COL.NEON_MID; X.font = '3px monospace'; X.textAlign = 'center';
  X.fillText('OVERLORD', rx-17, topY+42); X.fillText('SUPREME', rx-17, topY+47);
  X.textAlign = 'left'; X.restore();
}

function drawChiefAlien(cx, floorY, t) {
  const bob = Math.sin(t/1050) * 2.5;
  const s   = 1.4;
  const fy  = floorY + bob;
  X.save();
  X.globalAlpha = 0.12 + 0.07 * Math.sin(t/720);
  const aura = X.createRadialGradient(cx, fy-50, 4, cx, fy-50, 60);
  aura.addColorStop(0, COL.NEON); aura.addColorStop(1, 'transparent');
  X.fillStyle = aura; X.fillRect(cx-64, fy-110, 128, 120);
  X.restore();
  const tip = 0.55 + 0.45 * Math.sin(t/520);
  X.fillStyle = '#009944';
  X.fillRect(cx-12, Math.round(fy-110*s), 3, Math.round(16*s));
  X.fillRect(cx+9,  Math.round(fy-108*s), 3, Math.round(14*s));
  X.fillStyle = `rgba(0,255,136,${tip})`;
  X.fillRect(cx-14, Math.round(fy-113*s), 7, 5); X.fillRect(cx+8, Math.round(fy-111*s), 7, 5);
  const headY = Math.round(fy-92*s);
  X.fillStyle = '#8a9a88'; X.fillRect(cx-Math.round(11*s), headY, Math.round(22*s), Math.round(18*s));
  X.fillStyle = '#707870';
  X.fillRect(cx-Math.round(13*s), headY+Math.round(5*s), 3, Math.round(8*s));
  X.fillRect(cx+Math.round(10*s), headY+Math.round(5*s), 3, Math.round(8*s));
  X.fillStyle = '#040708';
  X.fillRect(cx-Math.round(9*s), headY+Math.round(4*s), Math.round(8*s), Math.round(7*s));
  X.fillRect(cx+Math.round(1*s), headY+Math.round(4*s), Math.round(8*s), Math.round(7*s));
  X.fillStyle = '#0d3530';
  X.fillRect(cx-Math.round(8*s), headY+Math.round(5*s), 3, 3);
  X.fillRect(cx+Math.round(2*s), headY+Math.round(5*s), 3, 3);
  X.fillStyle = '#505850'; X.fillRect(cx-1, headY+Math.round(13*s), 1, 2); X.fillRect(cx+1, headY+Math.round(13*s), 1, 2);
  X.fillStyle = '#484c48'; X.fillRect(cx-Math.round(4*s), headY+Math.round(16*s), Math.round(8*s), 1);
  X.fillStyle = '#7a8878'; X.fillRect(cx-2, headY+Math.round(18*s), 4, Math.round(5*s));
  X.fillStyle = '#132218'; X.fillRect(cx-Math.round(10*s), headY+Math.round(23*s), Math.round(20*s), Math.round(22*s));
  X.fillStyle = COL.NEON_MID;
  X.fillRect(cx-Math.round(6*s), headY+Math.round(25*s), Math.round(8*s), 1);
  X.fillRect(cx-Math.round(6*s), headY+Math.round(27*s), Math.round(6*s), 1);
  X.fillRect(cx-Math.round(6*s), headY+Math.round(29*s), Math.round(4*s), 1);
  X.fillStyle = `rgba(0,255,136,${0.6+0.4*tip})`;
  X.fillRect(cx+Math.round(2*s), headY+Math.round(25*s), Math.round(5*s), Math.round(5*s));
  X.fillStyle = '#001a0a'; X.fillRect(cx+Math.round(3*s), headY+Math.round(26*s), Math.round(3*s), Math.round(3*s));
  X.fillStyle = '#7a8878';
  X.fillRect(cx-Math.round(14*s), headY+Math.round(25*s), Math.round(4*s), Math.round(16*s));
  X.fillRect(cx+Math.round(10*s), headY+Math.round(25*s), Math.round(4*s), Math.round(16*s));
  X.fillStyle = '#8a9888';
  X.fillRect(cx-Math.round(15*s), headY+Math.round(40*s), Math.round(6*s), 4);
  X.fillRect(cx+Math.round(9*s),  headY+Math.round(40*s), Math.round(6*s), 4);
  X.fillStyle = '#0a2010';
  X.fillRect(cx+Math.round(11*s), headY+Math.round(28*s), Math.round(12*s), Math.round(15*s));
  X.strokeStyle = COL.NEON_MID; X.lineWidth = 1;
  X.strokeRect(cx+Math.round(11*s), headY+Math.round(28*s), Math.round(12*s), Math.round(15*s));
  X.fillStyle = 'rgba(0,255,136,0.6)';
  for (let row = 0; row < 4; row++) {
    X.fillRect(cx+Math.round(13*s), headY+Math.round((31+row*3)*s), Math.round((8-row*1.5)*s), 1);
  }
  X.fillStyle = '#0e2014';
  X.fillRect(cx-Math.round(8*s), headY+Math.round(45*s), Math.round(6*s), Math.round(14*s));
  X.fillRect(cx+Math.round(2*s), headY+Math.round(45*s), Math.round(6*s), Math.round(14*s));
  X.fillStyle = '#070f0a';
  X.fillRect(cx-Math.round(9*s), headY+Math.round(59*s), Math.round(8*s), 5);
  X.fillRect(cx+Math.round(1*s), headY+Math.round(59*s), Math.round(8*s), 5);
  X.fillStyle = '#001408'; X.fillRect(cx-44, fy+2, 88, 11);
  X.fillStyle = COL.NEON_MID; X.font = '5px monospace'; X.textAlign = 'center';
  X.fillText('SECTOR CHIEF  Ω-7', cx, fy+11);
  X.textAlign = 'left';
}
