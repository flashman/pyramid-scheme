// ── FILE: game/pyramids.js ───────────────────────────────
// Pyramid data model and game-layer operations.
//
// This module owns:
//   PyramidLayout  — slot manager for near/mid/far pyramid placement
//   mkPyr          — factory for a new pyramid data object
//   addLayer       — mutates a pyramid's data; emits 'pyramid:layer_added'
//   pyrEarnings    — computes total payout a pyramid has generated for the player
//
// What is NOT here:
//   Geometry / physics (lyrRect, surfAt, canStep, …) → worlds/earth/terrain.js
//   Visual effects (particles, shake)                → handled in main.js via
//                                                       the 'pyramid:layer_added' event
//
// As a result, this module's only external dependencies are game state
// and the engine event bus — no draw layer, no world constants.

import { G }      from './state.js';
import { Events } from '../engine/events.js';

// ─────────────────────────────────────────────────────────
// PyramidLayout — slot manager for pyramid placement.
//
// Realms that place friend pyramids use a near/mid/far slot pattern:
// depth-1 recruits go to near slots, depth-2 to mid, depth-3+ to far.
// PyramidLayout owns those arrays and their round-robin counters,
// keeping the bookkeeping out of game state (G) and recruit functions.
//
// Each realm that needs pyramid placement creates its own instance:
//
//   const myLayout = new PyramidLayout({
//     near: [500, 700, 900, …],
//     mid:  [600, 800, …],
//     far:  [400, 650, …],
//   });
//   const wx = myLayout.nextX(depth);
//   myLayout.reset();   // dev-panel hard-reset
// ─────────────────────────────────────────────────────────

export class PyramidLayout {
  constructor({ near = [], mid = [], far = [] } = {}) {
    this._near = near;
    this._mid  = mid;
    this._far  = far;
    this._iN   = 0;
    this._iM   = 0;
    this._iF   = 0;
  }

  nextX(depth) {
    if (depth === 1) return this._near[this._iN++ % this._near.length];
    if (depth === 2) return this._mid [this._iM++ % this._mid.length];
    return                 this._far  [this._iF++ % this._far.length];
  }

  reset() { this._iN = this._iM = this._iF = 0; }
}

// ─────────────────────────────────────────────────────────
// Pyramid data model
// ─────────────────────────────────────────────────────────

/** Construct a new pyramid data object. */
export function mkPyr(id, wx, owner, isPlayer, zLayer) {
  return {
    id, wx,
    layers: 0, tiers: [], names: [], owner,
    isPlayer: !!isPlayer,
    depthCounts: {},
    zLayer: zLayer || 0,
    _anim: false, _animT: 0,
  };
}

/**
 * Append a recruit layer to pyramid pyrId.
 *
 * Mutates the pyramid's data arrays, then emits 'pyramid:layer_added'
 * so the presentation layer (main.js) can spawn particles and apply
 * screen-shake without this module importing anything from draw/.
 *
 * Event payload: { pyrId, wx, layers, depth, zLayer }
 */
export function addLayer(pyrId, depth, name) {
  const p = G.pyramids.find(q => q.id === pyrId);
  if (!p) return;
  p.layers++;
  p.tiers.push(depth);
  p.names.push(name || '');
  p.depthCounts[depth] = (p.depthCounts[depth] || 0) + 1;
  p._anim  = true;
  p._animT = Date.now();
  Events.emit('pyramid:layer_added', {
    pyrId,
    wx:     p.wx,
    layers: p.layers,
    depth,
    zLayer: p.zLayer || 0,
  });
}

// ─────────────────────────────────────────────────────────
// Economic queries
// ─────────────────────────────────────────────────────────

/** Total payout this pyramid has generated for the player across all recruits. */
export function pyrEarnings(p) {
  let total = 0;
  for (const rec of G.recruits) {
    if (rec.pid === p.id) total += rec.payoutToPlayer;
  }
  return Math.round(total * 100) / 100;
}
