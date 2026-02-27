// ── FILE: draw/utils.js ──────────────────────────────────
// Canvas drawing helpers shared across all realms:
//   depthColor / depthHex  — colour a recruit pyramid by chain depth
//   fogTint                — blend a colour toward the background fog
//   spawnParts             — create a burst of particles in G.particles

import { G }   from '../game/state.js';
import { COL } from '../engine/colors.js';

/**
 * Returns an RGBA colour set for a pyramid at the given chain depth.
 * Deeper = darker/cooler. Returns { face, top, bot, txt } rgb() strings.
 * @param {number} d - Depth (1 = direct recruit, higher = further down chain)
 */
export function depthColor(d) {
  const pct = Math.min(1, (d - 1) / 8);
  const r = Math.round(200 - pct * 140);
  const g = Math.round(149 - pct * 110);
  const b = Math.round(42  - pct * 30);
  return {
    face: `rgb(${r},${g},${b})`,
    top:  `rgb(${Math.min(255,r+30)},${Math.min(255,g+24)},${Math.min(255,b+10)})`,
    bot:  `rgb(${Math.max(0,r-60)},${Math.max(0,g-40)},${Math.max(0,b-18)})`,
    txt:  `rgb(${Math.max(0,r-155)},${Math.max(0,g-110)},${Math.max(0,b-25)})`,
  };
}

/**
 * Same depth-to-colour mapping as depthColor but returns a single hex string.
 * Used where a simple fill colour is enough (e.g. minimap dots).
 * @param {number} d - Chain depth
 */
export function depthHex(d) {
  const pct = Math.min(1, (d - 1) / 8);
  const r = Math.round(200 - pct*140);
  const g = Math.round(149 - pct*110);
  const b = Math.round(42  - pct*30);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

/**
 * Blends an rgb() colour string toward the background fog colour.
 * @param {string} col - An `rgb(r,g,b)` colour string.
 * @param {number} fog - 0 = no fog, 1 = fully fogged (used by Z-layer parallax).
 */
export function fogTint(col, fog) {
  if (!fog) return col;
  const m = col.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return col;
  const fr=80, fg=100, fb=130;
  const r=Math.round(+m[1]*(1-fog)+fr*fog);
  const g=Math.round(+m[2]*(1-fog)+fg*fog);
  const b=Math.round(+m[3]*(1-fog)+fb*fog);
  return `rgb(${r},${g},${b})`;
}

/**
 * Spawns a burst of particles at a world-space position.
 * Particles are stored in G.particles and rendered by drawParts() in hud.js.
 * @param {number} wx   - World X position
 * @param {number} wy   - World Y position
 * @param {string} col  - Fill colour (any CSS colour string)
 * @param {number} [n]  - Number of particles to spawn (default 16)
 */
export function spawnParts(wx, wy, col, n=16) {
  for (let i=0; i<n; i++) {
    G.particles.push({
      x:wx, y:wy,
      vx:(Math.random()-.5)*5, vy:(Math.random()-.5)*4-2,
      c:col, s:Math.random()*5+2, life:1
    });
  }
}
