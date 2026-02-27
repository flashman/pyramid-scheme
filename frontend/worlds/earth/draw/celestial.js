// ── FILE: worlds/earth/draw/celestial.js ────────────────

import { G }            from '../../../game/state.js';
import { X, CW, CH }   from '../../../engine/canvas.js';
import { WORLD_W, GND } from '../constants.js';
import { COL }          from '../../../engine/colors.js';

export const CLOUDS = [];
(function buildClouds() {
  const seed2 = [0.22,0.61,0.45,0.83,0.09,0.52,0.74,0.31,0.96,0.14,0.67,0.38];
  for (let i=0; i<12; i++) {
    CLOUDS.push({ baseWx:seed2[i]*WORLD_W, worldY:15+seed2[(i+4)%12]*100,
      layer:1, w:50+seed2[(i+2)%12]*100, h:16+seed2[(i+1)%12]*22,
      parallax:0.28, alpha:0.55+seed2[i]*0.25 });
  }
  const seed3 = [0.35,0.7,0.15,0.9,0.5,0.05,0.8,0.25,0.6,0.42];
  for (let i=0; i<10; i++) {
    CLOUDS.push({ baseWx:seed3[i]*WORLD_W, worldY:5+seed3[(i+3)%10]*50,
      layer:2, w:80+seed3[(i+1)%10]*160, h:5+seed3[(i+2)%10]*8,
      parallax:0.14, alpha:0.3+seed3[i]*0.22 });
  }
})();

export function drawCloudsAndCelestial(camY) {
  const t  = Date.now();
  const cy = camY || 0;
  const altitude = Math.max(0, -cy);

  const planet1ScreenY = -500 - cy;
  if (planet1ScreenY > -60 && planet1ScreenY < CH+60) {
    const px = CW - 180;
    X.save();
    X.globalAlpha = Math.min(1, Math.max(0, (altitude - 350) / 180));
    if (X.globalAlpha > 0) {
      X.fillStyle='#c8a060';
      X.beginPath(); X.arc(px, planet1ScreenY, 28, 0, Math.PI*2); X.fill();
      X.fillStyle='#a06820';
      for (let b=0; b<5; b++) X.fillRect(px-28, planet1ScreenY-14+b*6, 56, 3);
      X.fillStyle='#e0c080';
      X.beginPath(); X.arc(px+8, planet1ScreenY-6, 8, 0, Math.PI*2); X.fill();
      X.strokeStyle='#d4a840'; X.lineWidth=3; X.globalAlpha*=0.6;
      X.beginPath(); X.ellipse(px, planet1ScreenY, 46, 10, 0, 0, Math.PI*2); X.stroke();
      X.lineWidth=1;
    }
    X.restore();
  }

  const planet2ScreenY = -1100 - cy;
  if (planet2ScreenY > -60 && planet2ScreenY < CH+60) {
    const p2x = 140;
    X.save();
    X.globalAlpha = Math.min(1, Math.max(0, (altitude - 700) / 200));
    if (X.globalAlpha > 0) {
      const baseAlpha = X.globalAlpha;
      X.beginPath(); X.arc(p2x, planet2ScreenY, 18, 0, Math.PI*2); X.clip();
      X.fillStyle='#c04820'; X.fillRect(p2x-18, planet2ScreenY-18, 36, 36);
      X.fillStyle='#a03010';
      X.beginPath(); X.arc(p2x+5, planet2ScreenY-3, 10, 0, Math.PI*2); X.fill();
      X.fillStyle='#e06030';
      X.beginPath(); X.arc(p2x-5, planet2ScreenY+4, 6, 0, Math.PI*2); X.fill();
      X.globalAlpha = baseAlpha * 0.6;
      X.fillStyle='#f0d0c0';
      X.beginPath(); X.arc(p2x, planet2ScreenY-12, 7, 0, Math.PI*2); X.fill();
    }
    X.restore();
  }

  const planet3ScreenY = -1700 - cy;
  if (planet3ScreenY > -60 && planet3ScreenY < CH+60) {
    const p3x = CW - 100;
    X.save();
    X.globalAlpha = Math.min(1, Math.max(0, (altitude - 1300) / 200));
    if (X.globalAlpha > 0) {
      X.beginPath(); X.arc(p3x, planet3ScreenY, 22, 0, Math.PI*2); X.clip();
      X.fillStyle='#1828b0'; X.fillRect(p3x-22, planet3ScreenY-22, 44, 44);
      X.fillStyle='#2840d0'; X.fillRect(p3x-22, planet3ScreenY-4, 44, 8);
      X.fillStyle='#1020a0'; X.fillRect(p3x-22, planet3ScreenY+2, 44, 4);
      X.fillStyle='#4080f0';
      X.beginPath(); X.arc(p3x-6, planet3ScreenY-2, 5, 0, Math.PI*2); X.fill();
    }
    X.restore();
    const ringAlpha = Math.min(1, Math.max(0, (altitude - 1300) / 200));
    if (ringAlpha > 0) {
      X.save(); X.globalAlpha = ringAlpha * 0.35;
      X.strokeStyle='#6080c0'; X.lineWidth=2;
      X.beginPath(); X.ellipse(p3x, planet3ScreenY, 34, 7, 0.2, 0, Math.PI*2); X.stroke();
      X.lineWidth=1; X.restore();
    }
  }

  const skyDarkForMoon = Math.min(1, altitude / 500);
  const moonSkyTop = `rgb(${Math.round(4+skyDarkForMoon*2)},${Math.round(2+skyDarkForMoon*1)},${Math.round(18-skyDarkForMoon*4)})`;
  const moonY = 55 - cy * 0.12;
  if (moonY > -30 && moonY < CH+30) {
    X.fillStyle='#c8d8e8';
    X.beginPath(); X.arc(80,moonY,28,0,Math.PI*2); X.fill();
    X.fillStyle=moonSkyTop;
    X.beginPath(); X.arc(90,moonY-5,24,0,Math.PI*2); X.fill();
  }

  const cloudFade = Math.min(1, Math.max(0, altitude / 200));
  for (const c of CLOUDS) {
    if (cloudFade <= 0) break;
    const screenY = c.worldY - cy * (1 - c.parallax * 0.3);
    if (screenY < -60 || screenY > CH+60) continue;
    const driftX = Math.sin(t / 18000 + c.baseWx * 0.001) * 40;
    const rawScreenX = (c.baseWx + driftX) - G.camX * c.parallax;
    const sx = ((rawScreenX % (CW + c.w + 20)) + CW + c.w + 20) % (CW + c.w + 20) - c.w - 10;
    X.save();
    X.globalAlpha = c.alpha * cloudFade;
    if (c.layer === 1) {
      X.fillStyle='#e8e8f0';
      X.fillRect(sx+c.h/2, screenY, c.w-c.h, c.h);
      X.fillRect(sx, screenY+c.h*0.3, c.w, c.h*0.7);
      X.fillStyle='#ffffff';
      X.fillRect(sx+c.h/2+2, screenY+2, c.w-c.h-4, c.h*0.4);
      X.fillStyle='#b0b0c0';
      X.fillRect(sx+4, screenY+c.h*0.75, c.w-8, c.h*0.2);
    } else {
      X.fillStyle='#c8d0f0'; X.fillRect(sx, screenY, c.w, c.h);
      X.fillStyle='#e0e8ff'; X.fillRect(sx+8, screenY+1, c.w-20, c.h-3);
    }
    X.restore();
  }
}
