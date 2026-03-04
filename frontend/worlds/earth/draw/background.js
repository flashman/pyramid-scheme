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

// ── Distant sphinx ───────────────────────────────────────
// Appears at the far-east horizon as a parallax landmark.
// screenX = 1100 - camX * 0.1, so it drifts into view slowly
// as the player walks east past x ~3500.

// Draws the sphinx silhouette in the far background.
// Scale is 3× the old version; alpha is high and solid (no shimmer wash).
// sx/sy = screen position of the body's right-rear corner base.
function _drawDistantSphinx(sx, sy, alpha) {
  if (alpha <= 0) return;
  X.save();

  // Desert atmosphere tint — slight warm haze but NOT ghostly
  const BODY  = '#b87c20';
  const BODY_LT = '#d4a030';
  const BODY_DK = '#7a4e0e';
  const GOLD  = '#e8c020';
  const BLUE  = '#1840a0';

  X.globalAlpha = alpha;

  // ── Ground shadow ──────────────────────────────────────
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 20, sy - 4, 340, 8);

  // ── Front paws (extend left of body) ──────────────────
  X.fillStyle = BODY;
  X.fillRect(sx - 40, sy - 20, 130, 20);  // paw slab
  X.fillStyle = BODY_LT;
  X.fillRect(sx - 40, sy - 20, 130, 5);   // top highlight
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 40, sy - 6,  130, 6);   // toe shadow
  // Toe lines
  for (let t = 0; t < 4; t++) {
    X.fillRect(sx - 34 + t * 28, sy - 6, 4, 6);
  }

  // Second paw (staggered behind)
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 20, sy - 14, 100, 14);
  X.fillStyle = BODY;
  X.fillRect(sx - 26, sy - 16, 100, 14);
  X.fillStyle = BODY_LT;
  X.fillRect(sx - 26, sy - 16, 100, 4);

  // ── Lion body ──────────────────────────────────────────
  X.fillStyle = BODY_DK;
  X.fillRect(sx + 50,  sy - 110, 230, 110);  // shadow
  X.fillStyle = BODY;
  X.fillRect(sx + 46,  sy - 112, 228, 108);  // main torso
  X.fillStyle = BODY_LT;
  X.fillRect(sx + 46,  sy - 112, 228, 16);   // top highlight
  X.fillStyle = BODY_DK;
  X.fillRect(sx + 46,  sy - 40,  220, 6);    // belly crease

  // Rear haunch
  X.fillStyle = BODY;
  X.fillRect(sx + 236, sy - 140, 60, 140);
  X.fillStyle = BODY_LT;
  X.fillRect(sx + 236, sy - 140, 60, 12);
  X.fillStyle = BODY_DK;
  X.fillRect(sx + 286, sy - 140, 10, 140);

  // ── Neck ───────────────────────────────────────────────
  X.fillStyle = BODY_DK;
  X.fillRect(sx + 18,  sy - 180, 44, 76);
  X.fillStyle = BODY;
  X.fillRect(sx + 14,  sy - 182, 44, 76);

  // ── Nemes headdress side flaps ─────────────────────────
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 18,  sy - 296, 30, 150);  // left flap shadow
  X.fillRect(sx + 40,  sy - 280, 26, 130);  // right flap shadow
  X.fillStyle = BODY;
  X.fillRect(sx - 22,  sy - 298, 28, 148);  // left flap
  X.fillRect(sx + 36,  sy - 280, 24, 128);  // right flap

  // Headdress stripes (blue/gold alternating — readable at this size)
  for (let stripe = 0; stripe < 8; stripe++) {
    const sy2 = sy - 292 + stripe * 16;
    X.fillStyle = stripe % 2 === 0 ? BLUE : BODY;
    X.fillRect(sx - 22, sy2, 28, 8);   // left flap stripe
    X.fillRect(sx + 36, sy2 + 2, 24, 8); // right flap
  }

  // Crown band (top of headdress)
  X.fillStyle = BODY;
  X.fillRect(sx - 10, sy - 310, 100, 28);
  X.fillStyle = BODY_LT;
  X.fillRect(sx - 10, sy - 310, 100, 7);

  // Gold forehead band — visible and distinct
  X.fillStyle = GOLD;
  X.fillRect(sx + 2,   sy - 322, 76, 14);
  X.fillStyle = '#b08000';
  X.fillRect(sx + 2,   sy - 322, 76, 3);

  // Uraeus cobra stub
  X.fillStyle = GOLD;
  X.fillRect(sx + 32,  sy - 348, 8, 28);
  X.fillRect(sx + 26,  sy - 360, 18, 14);
  X.fillStyle = '#cc0000';
  X.fillRect(sx + 28,  sy - 362, 8, 6);

  // ── Head ──────────────────────────────────────────────
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 14,  sy - 308, 72, 126);  // head shadow
  X.fillStyle = BODY;
  X.fillRect(sx - 18,  sy - 310, 72, 124);  // head main
  X.fillStyle = BODY_LT;
  X.fillRect(sx - 18,  sy - 310, 72, 10);   // forehead highlight

  // ── Eye (clear and readable at this size) ──────────────
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 12,  sy - 284, 28, 18);   // socket
  X.fillStyle = '#c89028';
  X.fillRect(sx - 10,  sy - 282, 22, 14);   // iris
  X.fillStyle = '#100800';
  X.fillRect(sx - 7,   sy - 281, 12, 10);   // pupil
  X.fillStyle = '#ffe0a0';
  X.fillRect(sx - 5,   sy - 280, 4, 4);     // gleam
  // Kohl line
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 14,  sy - 282, 4, 14);
  X.fillRect(sx + 12,  sy - 282, 16, 4);

  // ── Nose (damaged/missing tip — iconic) ────────────────
  X.fillStyle = BODY_LT;
  X.fillRect(sx - 12,  sy - 260, 16, 24);   // bridge
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 14,  sy - 240, 20, 10);   // missing tip void

  // ── Lips / mouth ───────────────────────────────────────
  X.fillStyle = BODY;
  X.fillRect(sx - 16,  sy - 228, 46, 8);
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 14,  sy - 222, 42, 4);

  // ── Beard (royal, extending down) ──────────────────────
  X.fillStyle = BODY_DK;
  X.fillRect(sx - 8,   sy - 216, 22, 38);
  X.fillStyle = BODY;
  X.fillRect(sx - 10,  sy - 218, 22, 38);
  X.fillStyle = GOLD;
  X.fillRect(sx - 10,  sy - 218, 22, 4);
  X.fillRect(sx - 10,  sy - 184, 22, 4);
  X.fillStyle = BODY;
  X.fillRect(sx - 8,   sy - 182, 18, 10);  // beard tip

  X.restore();
}

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

  // ── Distant sphinx (far-east parallax landmark) ─────────
  // Appears at camX ~2000, fully visible by camX ~5000.
  // Parallax: slower than ground (0.08x) so it stays visible longer.
  // Scaled down to ~35% — it's distant, not looming.
  const sphinxScreenX = Math.round(1050 - G.camX * 0.08);
  if (sphinxScreenX < CW + 200 && sphinxScreenX > -400) {
    const sphinxAlpha = Math.max(0, Math.min(0.82, (G.camX - 2000) / 3000 * 0.82));
    // Fuzzy heat-haze shimmer — more prominent at low alpha (far away)
    const fuzz = Math.max(0, 1 - sphinxAlpha / 0.4);  // 0=close/sharp, 1=far/blurry
    const shimmer = sphinxAlpha * (0.88 + 0.12 * Math.sin(Date.now() / 1200));
    // Sit on the sand horizon line, not floating above it
    const sphinxBase = Math.round(desertTop + 72);
    const SCALE = 0.35;
    X.save();
    // Blur more when far away (low alpha = low camX = early approach)
    if (fuzz > 0.05) X.filter = `blur(${(fuzz * 2.2).toFixed(1)}px)`;
    // Scale around the sphinx base point so it grows from the ground up
    X.translate(sphinxScreenX, sphinxBase);
    X.scale(SCALE, SCALE);
    X.translate(-sphinxScreenX, -sphinxBase);
    _drawDistantSphinx(sphinxScreenX, sphinxBase, shimmer);
    X.restore();
    X.filter = 'none';
  }
}
