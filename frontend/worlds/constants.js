// ── FILE: worlds/constants.js ────────────────────────────
// Shared constants that apply across ALL worlds/realms.

export const SPEED   = 5;
export const SPDHALF = 10;

export const LH     = 22;
export const CAP_W  = 28;
export const SLOPE  = 16;

// ── Shared movement helper ────────────────────────────────
// inputDx reads G.keys and returns the horizontal delta for one frame,
// also setting G.facing and G.pmoving as side-effects.
//
// Use this instead of repeating the ArrowLeft/Right/WASD block in
// every realm's update():
//
//   import { inputDx, SPEED, SPDHALF } from '../constants.js';
//   const dx = inputDx(SPEED);
//   if (dx !== 0) G.px = this._clampX(G.px + dx, SPDHALF);
//
// Pass a custom speed to handle modifiers like pool wading:
//   const dx = inputDx(inPool ? SPEED * 0.55 : SPEED);

import { G } from '../game/state.js';

export function inputDx(baseSpeed) {
  const speed = G.keys['Shift'] ? baseSpeed * 2 : baseSpeed;
  let dx = 0;
  if (G.keys['ArrowLeft']  || G.keys['a'] || G.keys['A']) { dx = -speed; G.facing = -1; }
  if (G.keys['ArrowRight'] || G.keys['d'] || G.keys['D']) { dx =  speed; G.facing =  1; }
  G.pmoving = dx !== 0;
  return dx;
}
