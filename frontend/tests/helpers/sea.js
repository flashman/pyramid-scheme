// Shared helpers for the sea simulation tests (not a test file itself).
import { stepVoyage, wrapAngle } from '../../worlds/sea/voyage.js';

/** Deterministic PRNG so lightning/narration tests are repeatable. */
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Step a voyage for `seconds` at `fps`; policy(v) → input. Returns every event. */
export function sail(v, seconds, fps, policy = () => ({})) {
  const events = [];
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) events.push(...stepVoyage(v, policy(v), 1 / fps));
  return events;
}

/** A helmsman: full sail, rudder proportional to the heading error. */
export function steerToward(angle) {
  return (v) => ({ steer: Math.max(-1, Math.min(1, wrapAngle(angle - v.heading) * 3)), trim: 1 });
}
