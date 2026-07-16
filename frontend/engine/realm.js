// ── FILE: engine/realm.js ────────────────────────────────
// Base Realm class, and RealmManager with built-in transition
// animation support.

import { Events } from './events.js';

// ─────────────────────────────────────────────────────────
// Realm — minimal base class all realms extend.
// ─────────────────────────────────────────────────────────

export class Realm {
  constructor(id, name) {
    this.id   = id;
    this.name = name;
  }

  onEnter(fromId) {}
  onExit()        {}
  update(ts)      {}
  render()        {}
  onKeyDown(key)  { return false; }

  /**
   * Returns the player's current display pose for this realm.
   * Used by drawPharaoh() so realm draw files don't need to manually
   * reconstruct { px, py, camX, pZ, facing, frame } from different sources.
   *
   * WorldRealm reads from G directly, so its drawPharaoh() call doesn't
   * use this. All other realms (FlatRealm, OasisRealm) override it.
   *
   * @returns {{ px, py, camX, pZ, facing, frame } | null}
   */
  getPlayerPose() { return null; }
}

// ─────────────────────────────────────────────────────────
// RealmManager — registers realms, handles transitions,
// and manages a single active transition animation.
//
// Transition animations decouple "play a visual effect" from
// "swap the active realm". Realms call scheduleTransition()
// instead of directly calling transitionTo(); the manager
// plays the animation overlay, then fires the actual swap.
//
// Usage in main.js game loop:
//
//   RealmManager.current.update(ts);
//   RealmManager.tickTransition();        // advances + fires swap
//   X.clearRect(…);
//   RealmManager.current.render();
//   RealmManager.renderTransition();      // overlay on top
//
// ─────────────────────────────────────────────────────────

export const RealmManager = {
  _realms:     {},
  currentId:   'world',
  _transition: null,   // { toId, startT, duration, renderFn } | null

  get current() { return this._realms[this.currentId]; },

  register(realm) {
    this._realms[realm.id] = realm;
    return this;
  },

  // Immediate (no-animation) realm swap. Still fires onExit / onEnter.
  transitionTo(id) {
    if (!this._realms[id]) { console.warn('Unknown realm:', id); return; }
    const fromId = this.currentId;
    this.current.onExit();
    this.currentId = id;
    this.current.onEnter(fromId);
    Events.emit('realm:enter', { id, fromId });
  },

  // Schedule a realm swap with an optional overlay animation.
  //
  //   toId     – id of the destination realm
  //   duration – animation length in ms (default 800)
  //   render   – (progress: 0..1) => void  (drawn over current render each frame)
  //
  // Input is NOT blocked here — realms that want to block input during a
  // transition should check RealmManager.isTransitioning themselves.
  scheduleTransition(toId, { duration = 800, render = null } = {}) {
    if (!this._realms[toId]) { console.warn('Unknown realm:', toId); return; }
    this._transition = { toId, startT: Date.now(), duration, renderFn: render };
  },

  get isTransitioning() { return this._transition !== null; },

  // Advance the active transition animation one tick.
  // When progress reaches 1, fires transitionTo() and clears itself.
  // Call once per frame from the game loop.
  tickTransition() {
    if (!this._transition) return;
    const elapsed  = Date.now() - this._transition.startT;
    if (elapsed >= this._transition.duration) {
      const toId = this._transition.toId;
      this._transition = null;
      this.transitionTo(toId);
    }
  },

  // Draw the current transition overlay. Call after current.render().
  renderTransition() {
    if (!this._transition || !this._transition.renderFn) return;
    const elapsed  = Date.now() - this._transition.startT;
    const progress = Math.min(1, elapsed / this._transition.duration);
    this._transition.renderFn(progress);
  },
};
