// ── FILE: engine/portal.js ────────────────────────────────
// PortalRegistry — the directed graph of realm connections.
//
// Each realm registers its outgoing portals in its constructor
// (where `this` is available for condition closures). Realms
// call PortalRegistry.handleKey() from onKeyDown() instead of
// directly calling RealmManager.scheduleTransition().
//
// This decouples the realm graph from individual realm files:
// adding a portal from realm A to realm B no longer requires
// editing realm A — just register a portal with from: 'a'.
//
// Usage in realm constructors:
//
//   import { PortalRegistry } from '../../engine/portal.js';
//
//   constructor() {
//     // ...
//     PortalRegistry.register({
//       from: 'myRealm', to: 'otherRealm',
//       key: 'ArrowUp',
//       condition: () => this.someState && Flags.get('some_flag'),
//       onUse: () => { G.shake = 8; log('You leave.', ''); },
//       transition: myTransRender,
//       duration: 1200,
//     });
//   }
//
// Usage in realm onKeyDown():
//
//   onKeyDown(key) {
//     if (PortalRegistry.handleKey(key, this.id, this.triggers)) return true;
//     // ... other key handling ...
//   }
//
// Boundary-triggered exits (in update()) still call
// RealmManager.transitionTo() directly but can be registered
// here with key: null for graph completeness.

import { RealmManager } from './realm.js';

export const PortalRegistry = {
  _portals: [],

  /**
   * Register a portal (directed edge in the realm graph).
   *
   * @param {object} opts
   * @param {string}    opts.from        source realm id
   * @param {string}    opts.to          destination realm id
   * @param {string}    [opts.key]       key that activates ('ArrowUp', 'ArrowDown', …)
   *                                     null = boundary-triggered; registered for graph only
   * @param {string}    [opts.trigger]   TriggerZone id that must be active (optional)
   * @param {function}  [opts.condition] () => bool — additional guard (optional)
   * @param {function}  [opts.onUse]     side effects to fire before transition (optional)
   * @param {function}  [opts.transition] canvas overlay renderer fn, or null for instant swap
   * @param {number}    [opts.duration]  animation duration ms (default 800)
   */
  register({
    from,
    to,
    key        = 'ArrowUp',
    trigger    = null,
    condition  = null,
    onUse      = null,
    transition = null,
    duration   = 800,
  }) {
    this._portals.push({
      fromId: from, toId: to,
      key, triggerId: trigger,
      condition, onUse, transition, duration,
    });
  },

  /**
   * Try to activate a portal from the given realm on a key press.
   * Returns true if a portal fired (so the caller can return true from onKeyDown).
   *
   * @param {string}           key             pressed key
   * @param {string}           fromId          current realm id
   * @param {TriggerRegistry}  [triggerRegistry] the realm's trigger registry (optional)
   */
  handleKey(key, fromId, triggerRegistry) {
    for (const p of this._portals) {
      if (p.fromId !== fromId)  continue;
      if (p.key    !== key)     continue;                        // key must match
      if (p.triggerId && !triggerRegistry?.isInside(p.triggerId)) continue;
      if (p.condition && !p.condition())                continue;

      p.onUse?.();

      if (p.transition) {
        RealmManager.scheduleTransition(p.toId, { duration: p.duration, render: p.transition });
      } else {
        RealmManager.transitionTo(p.toId);
      }
      return true;
    }
    return false;
  },

  /**
   * Returns all portals outgoing from a realm.
   * Useful for map rendering or debug overlays.
   */
  exitsFrom(realmId) {
    return this._portals.filter(p => p.fromId === realmId);
  },

  /** Returns the full portal graph (all edges). */
  all() { return [...this._portals]; },
};
