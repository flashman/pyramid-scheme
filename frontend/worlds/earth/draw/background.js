// ── FILE: worlds/earth/draw/background.js ───────────────

import { G }                   from '../../../game/state.js';
import { X, CW, CH }           from '../../../engine/canvas.js';
import { GND, WORLD_W }        from '../constants.js';
import { COL }                 from '../../../engine/colors.js';

export const STARS = [
  [60,18],[130,8],[210,30],[300,12],[390,25],[480,6],[560,20],[650,35],[730,10],
  [50,55],[160,45],[270,60],[380,42],[490,55],[600,48],[710,38],[80,85],[200,75],
  [340,90],[470,80],[590,70],[700,82],[110,110],[280,100],[430,115],[610,95],[740,108]
];
let _sp = 0;

export function drawBG(camY) {
  const cy = camY || 0;
  const altitude = Math.max(0, -cy);
  const skyDark  = Math.min(1, altitude / 500);
  const sk = X.createLinearGradient(0,0,0,CH);
  const top1 = `rgb(${Math.round(4+skyDark*2)},${Math.round(2+skyDark*1)},${Math.round(18-skyDark*4)})`;
  const top2 = `rgb(${Math.round(20-skyDark*10)},${Math.round(40-skyDark*20)},${Math.round(72-skyDark*30)})`;
  sk.addColorStop(0, top1); sk.addColorStop(1, top2);
  X.fillStyle=sk; X.fillRect(0,0,CW,CH);

  _sp += 0.012;
  const starAlpha = 0.4 + skyDark * 0.6;
  STARS.forEach(([sx,sy],i) => {
    if (sy < 0 || sy > CH) return;
    const b = Math.sin(_sp*1.7+i*0.9) > 0.65;
    X.globalAlpha = starAlpha * (b ? 1.0 : 0.5);
    X.fillStyle = b ? '#ffffff' : '#6070a0';
    X.fillRect(sx, sy, b?2:1, b?2:1);
    X.globalAlpha = 1;
  });

  const desertTop = 265 - cy;
  const gndScreen = GND - cy;
  if (gndScreen > 0 && desertTop < CH) {
    const dg = X.createLinearGradient(0,Math.max(0,desertTop),0,gndScreen);
    dg.addColorStop(0,'#b88020'); dg.addColorStop(1,'#7a5010');
    X.fillStyle=dg;
    X.fillRect(0, Math.max(0,desertTop), CW, Math.min(CH,gndScreen)-Math.max(0,desertTop));
  }

  const duneBase = 380 - cy;
  if (duneBase < CH && duneBase > -60) {
    const off = (G.camX * 0.35) % 520;
    X.fillStyle='#9a6818';
    X.beginPath(); X.moveTo(0, Math.min(CH, duneBase+20));
    X.quadraticCurveTo(130-off%100, duneBase-70, 260-off%100, duneBase-20);
    X.quadraticCurveTo(390-off%130, duneBase-75, 520-off%110, duneBase-22);
    X.quadraticCurveTo(650-off%90,  duneBase-65, 780, duneBase-22);
    X.lineTo(CW,CH); X.lineTo(0,CH); X.fill();
  }

  if (gndScreen < CH) {
    X.fillStyle='#c89028';
    X.fillRect(0, Math.max(0,gndScreen), CW, CH-Math.max(0,gndScreen));
    X.fillStyle='#a06818';
    for (let i=0; i<70; i++) {
      const gx = ((i*41 - G.camX) % CW + CW) % CW;
      const gy = gndScreen + ((i*19)%52);
      if (gy >= 0 && gy < CH) X.fillRect(gx,gy,2,1);
    }
  }
}
