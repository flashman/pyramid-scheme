// ── FILE: engine/hazard.js ──────────────────────────────────────────────────
//
// TimedHazard — a circular world-space zone where standing still for too long
// has consequences (death, flag set, etc.).
//
// Generalises the Atlantis choir mechanic so future hazards (lava pools,
// radiation zones, devotion circles) share the same enter/exit/survive/die
// lifecycle without duplicating the timer logic.
//
// Two modes, controlled by constructor options:
//
//   DANGER mode  (surviveDuration = null)
//     • Entering the zone starts a countdown.
//     • If the player doesn't leave within dangerDuration ms → onDanger fires.
//     • Leaving before timeout → onEscape fires and resets the timer.
//     • Use for: choir without CLEARED, lava, radiation.
//
//   SURVIVAL mode (surviveDuration > 0)
//     • Entering starts a countdown toward a goal.
//     • If the player stays the full surviveDuration ms → onSurvive fires (once).
//     • Leaving early resets the timer (unless already survived).
//     • Use for: choir after CLEARED, endurance tests, hidden unlocks.
//
// The same TimedHazard can switch modes at runtime via setMode().
// AtlantisRealm uses this to turn the choir from danger→survival when CLEARED.
//
// ── Usage ─────────────────────────────────────────────────────────────────
//
//   import { TimedHazard } from '../../engine/hazard.js';
//
//   // In constructor:
//   this.choir = new TimedHazard('choir', {
//     wx:             CHOIR_WX,
//     wy:             CHOIR_WY,
//     radius:         CHOIR_RADIUS,
//     dangerDuration: 2400,
//     onEnter:  () => log('A sound builds. Swim away.', ''),
//     onEscape: () => log('The harmonizing fades.', ''),
//     onDanger: () => this.health.kill('choir', MSG),
//   });
//
//   // In update():
//   this.choir.update(this.px, this.py);
//
//   // Switch to survival mode when the player is CLEARED:
//   if (Flags.get('atlantis_cleared')) {
//     this.choir.setMode({ surviveDuration: 5000, onSurvive: () => { ... } });
//   }
//
//   // In render(): optional warning overlay — see isInside / elapsed below.
//   if (this.choir.isInside) drawChoirWarning(this.choir, t);
//
// ─────────────────────────────────────────────────────────────────────────────

export class TimedHazard {
  /**
   * @param {string} id
   * @param {object} opts
   * @param {number}   opts.wx              - World X centre of the hazard circle
   * @param {number}   opts.wy              - World Y centre of the hazard circle
   * @param {number}   opts.radius          - Hazard radius in world-px (default 68)
   * @param {number}   opts.dangerDuration  - ms until onDanger fires (default 2400)
   * @param {number}   opts.surviveDuration - ms of continuous presence to trigger onSurvive.
   *                                          null = danger mode only (default null)
   * @param {function} opts.onEnter         - Called once when player enters the zone
   * @param {function} opts.onEscape        - Called when player leaves before danger/survive fires
   * @param {function} opts.onDanger        - Called when danger timer expires (danger mode only)
   * @param {function} opts.onSurvive       - Called when survive timer completes (survival mode only).
   *                                          Only fires once; zone becomes inert afterward.
   * @param {function} opts.condition       - () => bool — gate; hazard only activates when true.
   *                                          Defaults to always active.
   */
  constructor(id, {
    wx              = 0,
    wy              = 0,
    radius          = 68,
    dangerDuration  = 2400,
    surviveDuration = null,
    onEnter         = null,
    onEscape        = null,
    onDanger        = null,
    onSurvive       = null,
    condition       = () => true,
  } = {}) {
    this.id              = id;
    this.wx              = wx;
    this.wy              = wy;
    this.radius          = radius;
    this.dangerDuration  = dangerDuration;
    this.surviveDuration = surviveDuration;
    this._onEnter        = onEnter;
    this._onEscape       = onEscape;
    this._onDanger       = onDanger;
    this._onSurvive      = onSurvive;
    this.condition       = condition;

    this._inside   = false;
    this._enterT   = 0;
    this._survived = false;  // onSurvive fires at most once
    this.active    = true;
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  /** True while the player is inside the hazard radius. */
  get isInside() { return this._inside; }

  /**
   * Milliseconds elapsed since the player entered the zone.
   * 0 if not inside.
   */
  get elapsed() {
    return this._inside ? Date.now() - this._enterT : 0;
  }

  /**
   * Progress toward danger/survive as a 0..1 fraction.
   * Useful for drawing warning overlays (e.g. choir vignette opacity).
   */
  get progress() {
    if (!this._inside) return 0;
    const dur = this.surviveDuration ?? this.dangerDuration;
    return Math.min(1, this.elapsed / dur);
  }

  // ── Control ────────────────────────────────────────────────────────────────

  /**
   * Update mode at runtime — AtlantisRealm calls this when CLEARED turns the
   * choir from a danger into a survival challenge.
   *
   * @param {object} opts - Same keys as constructor (dangerDuration, surviveDuration, onSurvive, etc.)
   */
  setMode({ dangerDuration, surviveDuration, onEnter, onEscape, onDanger, onSurvive, condition } = {}) {
    if (dangerDuration  != null) this.dangerDuration  = dangerDuration;
    if (surviveDuration != null) this.surviveDuration = surviveDuration;
    if (onEnter    != null) this._onEnter   = onEnter;
    if (onEscape   != null) this._onEscape  = onEscape;
    if (onDanger   != null) this._onDanger  = onDanger;
    if (onSurvive  != null) this._onSurvive = onSurvive;
    if (condition  != null) this.condition  = condition;
    // Reset timer so new mode starts fresh
    this._inside = false;
    this._enterT = 0;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  /**
   * Advance the hazard state. Call once per frame from realm.update().
   *
   * @param {number} px - Player world X
   * @param {number} py - Player world Y
   */
  update(px, py) {
    if (!this.active || this._survived) return;

    const inside = this.active &&
      this.condition() &&
      Math.hypot(px - this.wx, py - this.wy) < this.radius;

    if (inside && !this._inside) {
      // ── Enter ──────────────────────────────────────────────────────────
      this._inside = true;
      this._enterT = Date.now();
      this._onEnter?.();

    } else if (!inside && this._inside) {
      // ── Exit ───────────────────────────────────────────────────────────
      this._inside = false;
      this._onEscape?.();

    } else if (inside) {
      // ── Stay — check timers ────────────────────────────────────────────
      const elapsed = Date.now() - this._enterT;

      if (this.surviveDuration != null) {
        // Survival mode: stay the full duration to trigger onSurvive
        if (elapsed >= this.surviveDuration) {
          this._inside   = false;
          this._survived = true;
          this._onSurvive?.();
        }
      } else {
        // Danger mode: leave or die
        if (elapsed >= this.dangerDuration) {
          this._inside = false;
          this._onDanger?.();
        }
      }
    }
  }
}
