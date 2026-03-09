// ── FILE: draw/pharaoh.js ────────────────────────────────
// Draws the player sprite.
//
// drawPharaoh(pose?)         — main function; reads G if no pose passed
// drawRealmPharaoh(realm)    — preferred for non-world realms; calls realm.getPlayerPose()
// drawChamberPharaoh(realm)  — legacy shim (backward compat)
// drawCouncilPharaoh(realm)  — legacy shim
// drawOasisPharaoh(realm)    — legacy shim
// drawVaultPharaoh(realm)    — legacy shim

import { G }                        from '../game/state.js';
import { X, CW, CH }                from '../engine/canvas.js';
import { COL }                      from '../engine/colors.js';
import { getTier }                  from '../game/tiers.js';

export function drawPharaoh(pose) {
  const p = pose || {
    px: G.px, py: G.py, camX: G.camX, pZ: G.pZ,
    facing: G.facing, frame: G.pframe,
  };

  if (!G.bought) return;

  const sx  = Math.round(p.px - p.camX);
  const bob = Math.sin(Date.now() / 600) * 1.5;
  const dir = p.facing;
  const fr  = p.frame;

  X.save();

  if (p.pZ === -1) {
    const scale = 1.4;
    const feetY = CH - 32;
    const pivotX = sx + 16;
    X.translate(pivotX, feetY);
    X.scale(dir === -1 ? -scale : scale, scale);
    const bx = -16;
    const sy = -48 + bob;
    X.fillStyle = '#00000050'; X.fillRect(bx + 2, 0, 28, 5);
    _drawBody(bx, sy, fr);
  } else {
    const sy = Math.round(p.py - 48 + bob);
    if (dir === -1) { X.translate(sx + 16, 0); X.scale(-1, 1); }
    const bx = dir === -1 ? 0 : sx;
    X.fillStyle = '#00000040'; X.fillRect(bx + 2, p.py - 4, 28, 5);
    _drawBody(bx, sy, fr);
  }

  X.restore();

  if (G.speech && G.speakT > 0) {
    const sx2 = Math.round(G.px - G.camX);
    const sy2 = G.pZ === -1 ? CH - 100 : Math.round(G.py - 48);
    G.speakT--;
    const bx2 = Math.max(4, Math.min(sx2 + (dir === 1 ? 28 : -118), CW - 116));
    const by2 = Math.max(4, sy2 - 24);
    X.fillStyle = COL.BLACK;  X.fillRect(bx2 - 2, by2 - 2, 116, 24);
    X.fillStyle = '#ffe';     X.fillRect(bx2, by2, 112, 20);
    X.fillStyle = COL.BLACK;  X.font = '6px monospace';
    X.fillText(G.speech, bx2 + 4, by2 + 13);
  }
  if (G.speakT <= 0) G.speech = null;
}

export function _drawBody(bx, sy, fr) {
  X.fillStyle = COL.WHITE;
  X.fillRect(bx + 8,  sy + 34, 6, 14);
  X.fillRect(bx + 18, sy + 34 + (fr ? -2 : 0), 6, 14);
  X.fillStyle = '#e0e0e0'; X.fillRect(bx + 4, sy + 28, 24, 14);
  X.fillStyle = COL.GOLD_WARM; X.fillRect(bx + 8, sy + 14, 16, 16);
  X.fillStyle = COL.GOLD;     X.fillRect(bx + 6, sy + 14, 20, 6);
  X.fillStyle = COL.GOLD_DIM;
  for (let i = 0; i < 5; i++) X.fillRect(bx + 6 + i * 4, sy + 14, 3, 3);
  X.fillStyle = COL.GOLD_WARM; X.fillRect(bx + 9, sy + 4, 14, 12);
  X.fillStyle = COL.PLAYER_BLUE;
  X.fillRect(bx + 7, sy, 18, 10);
  X.fillRect(bx + 4, sy + 6, 6, 14);
  X.fillRect(bx + 22, sy + 6, 6, 14);
  X.fillStyle = COL.GOLD; X.fillRect(bx + 7, sy, 18, 3);
  if (getTier().name === 'PHARAOH') {
    X.fillStyle = COL.GOLD;
    X.fillRect(bx + 24, sy + 16, 3, 20);
    X.fillRect(bx + 24, sy + 16, 10, 3);
  }
  X.fillStyle = COL.BLACK;
  X.fillRect(bx + 12, sy + 7, 2, 2);
  X.fillRect(bx + 18, sy + 7, 2, 2);
  X.fillRect(bx + 11, sy + 8, 1, 4);
  X.fillRect(bx + 20, sy + 8, 1, 4);
  X.fillRect(bx + 13, sy + 12, 6, 1);
  X.fillRect(bx + 14, sy + 13, 4, 1);
}

export function drawChamberPharaoh(realm) { drawPharaoh(realm.getPlayerPose()); }
export function drawCouncilPharaoh(realm) { drawPharaoh(realm.getPlayerPose()); }
export function drawOasisPharaoh(realm)   { drawPharaoh(realm.getPlayerPose()); }
export function drawVaultPharaoh(realm)   { drawPharaoh(realm.getPlayerPose()); }

/**
 * Draw the player in any realm that implements getPlayerPose().
 * Prefer this over the realm-specific variants above — they exist
 * only for backward compatibility with existing draw file imports.
 *
 * In new draw files:
 *   import { drawRealmPharaoh } from '../../../draw/pharaoh.js';
 *   drawRealmPharaoh(realm);
 */
export function drawRealmPharaoh(realm) {
  const pose = realm.getPlayerPose();
  if (pose) drawPharaoh(pose);
}
