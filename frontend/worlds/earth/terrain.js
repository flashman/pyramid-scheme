// ── FILE: worlds/earth/terrain.js ────────────────────────
// Earth terrain: pyramid geometry, surface queries, and step collision.
//
// These functions describe the shape of Earth's terrain — walkable pyramid
// surfaces, phase-through descent, proximity checks. They are not shared
// with other worlds; each world defines its own terrain model.
//
// All functions read directly from G.pyramids and GND. There are no
// (pyrs, floor) optional params — that scaffolding existed to support the
// Moon realm, which is gone.
//
// Imported by:
//   worlds/earth/WorldRealm.js  — physics loop
//   worlds/earth/draw/pyramids.js — rendering (lyrRect only)
//   draw/hud.js                 — surface-check for depth-switch hint

import { G }              from '../../game/state.js';
import { GND }            from './constants.js';
import { LH, CAP_W, SLOPE } from '../constants.js';

// ── Geometry ──────────────────────────────────────────────

/** Bounding rect of layer i on pyramid p at Earth's ground level. */
export function lyrRect(p, i) {
  const w = CAP_W + i * SLOPE * 2;
  return { x: p.wx - w / 2, y: GND - (p.layers - i) * LH, w, h: LH };
}

// ── Surface queries ───────────────────────────────────────

/**
 * Highest (lowest Y value) surface at world-x wx, considering only
 * foreground (zLayer 0) pyramids. Returns GND when nothing is above the ground.
 */
export function surfAt(wx) {
  let sy = GND;
  for (const p of G.pyramids) {
    if (!p.layers || (p.zLayer || 0) > 0) continue;
    for (let i = 0; i < p.layers; i++) {
      const r = lyrRect(p, i);
      if (wx >= r.x && wx <= r.x + r.w) sy = Math.min(sy, r.y);
    }
  }
  return sy;
}

/**
 * surfAt but skipping one pyramid by id.
 * Used during phase-through descent so the player can fall past
 * the pyramid they initiated a ↓-descent on.
 */
export function surfAtExcluding(wx, excludeId) {
  let sy = GND;
  for (const p of G.pyramids) {
    if (!p.layers || (p.zLayer || 0) > 0 || p.id === excludeId) continue;
    for (let i = 0; i < p.layers; i++) {
      const r = lyrRect(p, i);
      if (wx >= r.x && wx <= r.x + r.w) sy = Math.min(sy, r.y);
    }
  }
  return sy;
}

/**
 * Returns true if the player at feetY can walk one step to toWX without
 * stepping up more than one layer height (i.e. not hitting a wall).
 * Respects G.descendId for phase-through descent.
 */
export function canStep(feetY, toWX) {
  const s = G.descendId
    ? surfAtExcluding(toWX, G.descendId)
    : surfAt(toWX);
  return (feetY - s) <= LH + 1;
}

// ── Player-pyramid relationship queries ───────────────────

/**
 * Returns the highest surface Y produced only by the player's own pyramid.
 * Used to detect whether the player is standing above their own capstone
 * (e.g. to decide whether a ↓ descent should engage phase-through).
 */
export function playerPyrSurfAt(wx) {
  let sy = GND;
  for (const p of G.pyramids) {
    if (!p.layers || !p.isPlayer || (p.zLayer || 0) > 0) continue;
    for (let i = 0; i < p.layers; i++) {
      const r = lyrRect(p, i);
      if (wx >= r.x && wx <= r.x + r.w) sy = Math.min(sy, r.y);
    }
  }
  return sy;
}

/**
 * Returns the foreground pyramid the player is currently standing on top of,
 * or null. "On top of" means the player's feet are within 2px of that
 * pyramid's topmost layer surface.
 */
export function pyrUnderPlayer(px, py) {
  let bestPyr = null, bestY = Infinity;
  for (const p of G.pyramids) {
    if (!p.layers || (p.zLayer || 0) > 0) continue;
    for (let i = 0; i < p.layers; i++) {
      const r = lyrRect(p, i);
      if (px >= r.x && px <= r.x + r.w && r.y < bestY) {
        bestY = r.y; bestPyr = p;
      }
    }
  }
  return (bestPyr && Math.abs(py - bestY) < 2) ? bestPyr : null;
}

/**
 * Returns the nearest non-player foreground pyramid within 90px of px,
 * or null. Used each frame to set G.nearPyr for the inspect tooltip.
 */
export function nearbyFriendPyr(px) {
  for (const p of G.pyramids) {
    if (!p.layers || (p.zLayer || 0) > 0 || p.isPlayer) continue;
    if (Math.abs(px - p.wx) < 90) return p;
  }
  return null;
}

/**
 * Returns true if wx falls within the footprint of any layer of pyramid pyrId.
 * Useful for future overlap/collision checks.
 */
export function pyrCoversX(pyrId, wx) {
  const p = G.pyramids.find(q => q.id === pyrId);
  if (!p || !p.layers) return false;
  for (let i = 0; i < p.layers; i++) {
    const r = lyrRect(p, i);
    if (wx >= r.x && wx <= r.x + r.w) return true;
  }
  return false;
}
