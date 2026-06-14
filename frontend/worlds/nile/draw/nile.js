// ── FILE: worlds/nile/draw/nile.js ───────────────────────
import { X, CW, CH }        from '../../../engine/canvas.js';
import { G }                from '../../../game/state.js';
import { drawRealmPharaoh } from '../../../draw/pharaoh.js';
import { TOWPATH_Y, RIVER_FLOOR, NILE_W } from '../constants.js';

export function drawNile(realm) {
  // screen-space sky (drawn before camera translate)
  // Dusk sky (west bank = setting sun = death).
  const g = X.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, '#e8a23c');
  g.addColorStop(0.55, '#c66a2e');
  g.addColorStop(1, '#5a3418');
  X.fillStyle = g;
  X.fillRect(0, 0, CW, CH);

  X.save();
  X.translate(-Math.round(G.camX), 0);

  // River band (pZ -1 plane).
  X.fillStyle = '#2a5a6a';
  X.fillRect(0, RIVER_FLOOR, NILE_W, CH - RIVER_FLOOR);

  // Towpath bank (pZ 0 plane) — drawn as a ledge above the water.
  X.fillStyle = '#7a5a2a';
  X.fillRect(0, TOWPATH_Y, NILE_W, RIVER_FLOOR - TOWPATH_Y + 4);

  // Crocodiles (river plane, pZ -1).
  for (const c of realm.crocs) {
    X.fillStyle = c.isStunned ? '#6a7a3a' : '#3a5a2a';
    X.fillRect(c.worldX - 24, c.worldY - 12, 48, 12);                          // body
    X.fillRect(c.worldX + (c._dir > 0 ? 18 : -30), c.worldY - 16, 12, 8);    // snout
  }

  X.restore();

  drawRealmPharaoh(realm);   // reads realm.getPlayerPose() (includes pZ)
}
