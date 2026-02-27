// ── FILE: game/state.js ──────────────────────────────────
// Shared game state — economics, world navigation, player position.

import { GND }       from '../worlds/earth/constants.js';
import { CW }        from '../engine/canvas.js';

export const G = {
  // ── Economics ──────────────────────────────────────────
  bought: false, invested: 0, earned: 0, invitesLeft: 0,
  recruits: [],

  // ── Player world-space position & animation ────────────
  px: 2450, py: GND,
  pvy: 0,
  facing: 1,
  pframe: 0, pmoving: false,

  // Shared leg-animation timer.
  legT: 0,

  // ── Camera ─────────────────────────────────────────────
  camX: 1970, camY: 0,

  // ── Z-layer (depth plane) ──────────────────────────────
  pZ: 0,

  // ── World objects — Earth ─────────────────────────────
  pyramids: [],

  // ── Visual FX ──────────────────────────────────────────
  particles: [],
  shake: 0,

  // ── Speech bubble ──────────────────────────────────────
  speech: null, speakT: 0,

  // ── Nearest interactable (set by registry each frame, read by HUD) ──
  nearEntity: null,

  // ── Nearest pyramid for inspect tooltip ────────────────
  nearPyr: null,

  // ── Id of pyramid to phase through during a Down-step descent ──
  descendId: null,

  // ── Held keys ──────────────────────────────────────────
  keys: {},
};
