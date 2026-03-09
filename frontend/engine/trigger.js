// ── FILE: engine/trigger.js ──────────────────────────────
// TriggerZone: fires callbacks when the player enters / exits a
// world-space region.  TriggerRegistry manages a list of zones and
// drives them from a realm's update() loop.
//
// Replaces hardcoded proximity helpers like _oasisGateNear() and
// _cryptDoorNear() — those patterns are all the same shape, so they
// belong here.
//
// ── Typical realm usage ───────────────────────────────────
//
//   import { TriggerZone, TriggerRegistry } from '../../engine/trigger.js';
//
//   // In constructor:
//   this.triggers = new TriggerRegistry();
//   this.triggers.add(new TriggerZone('oasis-gate', {
//     x1: OASIS_ENTRY_X - 220,
//     x2: OASIS_ENTRY_X + 220,
//     condition: () => G.pZ === 0,
//     hint:      '[↑] ENTER THE OASIS',
//     onEnter:   () => log('The east wind pulls you forward.', ''),
//   }));
//
//   // In update():
//   this.triggers.update(G.px, G.py);
//
//   // In render() after world draw:
//   this.triggers.renderHints(G.camX);
//
//   // In onKeyDown():
//   if (key === 'ArrowUp' && this.triggers.isInside('oasis-gate')) { ... }
//
// ─────────────────────────────────────────────────────────

import { X, CW, CH } from './canvas.js';

export class TriggerZone {
  /**
   * @param {string} id     – unique id for this zone
   * @param {object} opts
   * @param {number}   opts.x1        – left world-x bound (inclusive)
   * @param {number}   opts.x2        – right world-x bound (inclusive)
   * @param {function} opts.condition – extra gate; zone only fires when true (default: always)
   * @param {function} opts.onEnter   – called once when player enters
   * @param {function} opts.onExit    – called once when player exits
   * @param {function} opts.onStay    – called every frame while inside
   * @param {string}   opts.hint      – prompt text drawn while inside, e.g. '[↑] ENTER'
   * @param {number}   opts.hintY     – canvas Y for hint text (default: CH/2 - 20)
   * @param {string}   opts.hintColor – hint color (default: '#f0c020')
   */
  constructor(id, {
    x1         = 0,
    x2         = 0,
    condition  = () => true,
    onEnter    = null,
    onExit     = null,
    onStay     = null,
    hint       = null,
    hintY      = null,
    hintColor  = '#f0c020',
  } = {}) {
    this.id        = id;
    this.x1        = x1;
    this.x2        = x2;
    this.condition = condition;
    this.onEnter   = onEnter;
    this.onExit    = onExit;
    this.onStay    = onStay;
    this.hint      = hint;
    this.hintY     = hintY;
    this.hintColor = hintColor;
    this._inside   = false;
    this.active    = true;
  }

  /** Returns true if the player is currently inside this zone. */
  get inside() { return this._inside; }

  /** Call once per frame. Fires enter/exit/stay callbacks as appropriate. */
  check(px) {
    if (!this.active) return false;
    const inside = px >= this.x1 && px <= this.x2 && this.condition();
    if (inside && !this._inside) {
      this._inside = true;
      this.onEnter?.();
    } else if (!inside && this._inside) {
      this._inside = false;
      this.onExit?.();
    } else if (inside) {
      this.onStay?.();
    }
    return inside;
  }
}

// ─────────────────────────────────────────────────────────
// TriggerRegistry — owns a list of zones, drives them each frame,
// and renders hint text for active zones.
// ─────────────────────────────────────────────────────────

export class TriggerRegistry {
  constructor() {
    this._zones = [];
  }

  /** Register a zone. Returns this for chaining. */
  add(zone) {
    this._zones.push(zone);
    return this;
  }

  /** Remove a zone by id. */
  remove(id) {
    this._zones = this._zones.filter(z => z.id !== id);
    return this;
  }

  /** Enable or disable a zone by id. */
  setActive(id, active) {
    const z = this.get(id);
    if (z) z.active = active;
    return this;
  }

  /** Returns true if the player is inside the named zone. */
  isInside(id) {
    return this.get(id)?._inside ?? false;
  }

  /** Returns a zone by id (or undefined). */
  get(id) {
    return this._zones.find(z => z.id === id);
  }

  /** Call once per frame from realm.update(). */
  update(px) {
    for (const z of this._zones) z.check(px);
  }

  /**
   * Draw pulsing hint text for every active zone the player is inside.
   * Call after world drawing, before dialogue overlays.
   *
   * @param {number} camX – current camera X offset (0 for fixed-camera realms)
   */
  renderHints(camX = 0) {
    for (const z of this._zones) {
      if (!z.active || !z._inside || !z.hint) continue;
      const zoneCenter = (z.x1 + z.x2) / 2;
      const sx  = Math.round(zoneCenter - camX);
      const sy  = z.hintY ?? (CH / 2 - 20);
      const alpha = 0.65 + 0.35 * Math.abs(Math.sin(Date.now() / 460));
      X.save();
      X.globalAlpha = alpha;
      X.fillStyle   = z.hintColor;
      X.font        = '6px monospace';
      X.textAlign   = 'center';
      X.fillText(z.hint, Math.max(80, Math.min(CW - 80, sx)), sy);
      X.textAlign = 'left';
      X.restore();
    }
  }

  /** Clear all zones. */
  clear() {
    this._zones = [];
  }
}
