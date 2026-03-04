// ── FILE: worlds/FlatRealm.js ────────────────────────────
// Base class for fixed-camera realms with a flat floor:
// ChamberRealm, CouncilRealm, VaultRealm.
//
// Eliminates the 12-line movement/animation block that was
// copy-pasted identically into each of those files.
//
// Usage:
//
//   import { FlatRealm } from '../FlatRealm.js';
//
//   export class MyRealm extends FlatRealm {
//     constructor() {
//       super('my-realm', 'MY REALM', { floor: 440, minX: 40, maxX: 740 });
//       // ... other setup
//     }
//     update(ts) {
//       if (DialogueManager.isActive()) return;
//       this._walkStep(ts);
//       this.registry?.update(this.px, this.floor);
//     }
//   }

import { Realm }  from '../engine/realm.js';
import { G }      from '../game/state.js';
import { SPEED }  from './constants.js';

export class FlatRealm extends Realm {
  /**
   * @param {string} id    – realm id registered with RealmManager
   * @param {string} name  – display name
   * @param {object} opts
   * @param {number} opts.floor  – ground Y coordinate (default 440)
   * @param {number} opts.minX   – left movement boundary (default 40)
   * @param {number} opts.maxX   – right movement boundary (default 740)
   */
  constructor(id, name, { floor = 440, minX = 40, maxX = 740 } = {}) {
    super(id, name);
    this.floor     = floor;
    this._minX     = minX;
    this._maxX     = maxX;
    this.px        = Math.round((minX + maxX) / 2);
    this.facing    = 1;
    this.frame     = 0;
    this.moving    = false;
  }

  /**
   * Advance horizontal movement and walk animation for one frame.
   * Call from update(ts) after any early-return guards.
   *
   * Reads G.keys for ArrowLeft/Right, A/D, Shift.
   * Updates this.px (clamped), this.facing, this.moving, this.frame.
   */
  _walkStep(ts) {
    const speed = G.keys['Shift'] ? SPEED * 2 : SPEED;
    let dx = 0;
    if (G.keys['ArrowLeft']  || G.keys['a'] || G.keys['A']) { dx = -speed; this.facing = -1; }
    if (G.keys['ArrowRight'] || G.keys['d'] || G.keys['D']) { dx =  speed; this.facing =  1; }
    this.moving = dx !== 0;
    if (dx !== 0) {
      this.px = Math.max(this._minX, Math.min(this._maxX, this.px + dx));
    }
    if (this.moving && ts - G.legT > 120) { G.legT = ts; this.frame = 1 - this.frame; }
    else if (!this.moving) this.frame = 0;
  }
}
