// ── FILE: engine/entity.js ───────────────────────────────
// Base Entity, NPC, Enemy, and Collectible classes.
//
// Entity hierarchy:
//   Entity           – world-space object with proximity detection
//   ├─ NPC           – Entity that opens a Dialogue on interact
//   ├─ Enemy         – Entity that patrols and can hurt the player
//   └─ Collectible   – Entity auto-collected on proximity (no press needed)
//
// All entity types are registered with InteractableRegistry, which calls
// update() and draw() each frame and fires onNear/onLeave/onInteract.
//
// ── Enemy usage example ───────────────────────────────────
//
//   import { Enemy } from '../../engine/entity.js';
//
//   const scarab = new Enemy('scarab-1', 1800, GND, {
//     speed:     2,
//     patrol:    { x1: 1600, x2: 2000 },
//     hurtRange: 22,
//     surfaceFn: (wx) => surfAt(wx),   // snap to terrain surface
//   });
//   this.registry.register(scarab);
//
//   // In update(): check hurt each frame
//   if (scarab.hurtCheck(G.px, G.py)) { /* player took damage */ }
//
//   // On stomp: scarab.stun(ts);
//
// ── Collectible usage example ─────────────────────────────
//
//   import { Collectible } from '../../engine/entity.js';
//
//   const scroll = new Collectible('scroll-drop-1', 2100, GND - 30, {
//     type:      'invite_scroll',
//     value:     1,
//     onCollect: (item) => { G.invitesLeft++; log('Found a scroll!', 'hi'); },
//   });
//   this.registry.register(scroll);   // auto-collected when player walks near

import { DialogueManager } from './dialogue.js';

// ─────────────────────────────────────────────────────────
// Entity — base class for all world objects.
// ─────────────────────────────────────────────────────────

export class Entity {
  constructor(id, worldX, worldY) {
    this.id            = id;
    this.worldX        = worldX;
    this.worldY        = worldY;
    this.active        = true;
    this.interactRange = 80;
    this.interactHint  = 'SPACE';
  }

  update(ts) {}
  draw(screenX, screenY) {}

  checkProximity(px, py) {
    return Math.hypot(px - this.worldX, py - this.worldY) < this.interactRange;
  }

  onNear()     {}
  onLeave()    {}
  onInteract() {}
}

// ─────────────────────────────────────────────────────────
// NPC — Entity that opens a Dialogue tree on SPACE.
// ─────────────────────────────────────────────────────────

export class NPC extends Entity {
  constructor(id, worldX, worldY, name, dialogue) {
    super(id, worldX, worldY);
    this.name     = name;
    this.dialogue = dialogue;
    this.facing   = 1;
    this.frame    = 0;
    this.moving   = false;
  }

  onInteract() {
    if (this.dialogue) DialogueManager.start(this.dialogue);
  }
}

// ─────────────────────────────────────────────────────────
// Enemy — patrols a world-space range and hurts the player
// on contact.  Supports surface-snapping for sloped terrain.
//
// States: 'patrol' → 'stunned' (timed) → back to 'patrol'
// ─────────────────────────────────────────────────────────

export class Enemy extends Entity {
  /**
   * @param {string} id
   * @param {number} worldX  – initial world X
   * @param {number} worldY  – initial world Y (floor)
   * @param {object} opts
   * @param {number}   opts.speed      – patrol speed px/frame (default 1.5)
   * @param {object}   opts.patrol     – { x1, x2 } world-space patrol bounds
   * @param {number}   opts.hurtRange  – px radius that damages the player (default 24)
   * @param {number}   opts.stunMs     – how long stun lasts in ms (default 800)
   * @param {function} opts.surfaceFn  – (wx) => floorY; snaps enemy to terrain.
   *                                    If null, enemy stays at initial worldY.
   * @param {boolean}  opts.hostile    – if false, enemy won't hurt player (default true)
   */
  constructor(id, worldX, worldY, {
    speed     = 1.5,
    patrol    = null,
    hurtRange = 24,
    stunMs    = 800,
    surfaceFn = null,
    hostile   = true,
  } = {}) {
    super(id, worldX, worldY);
    this.speed      = speed;
    this.patrol     = patrol;
    this.hurtRange  = hurtRange;
    this.stunMs     = stunMs;
    this.surfaceFn  = surfaceFn;
    this.hostile    = hostile;
    this.facing     = 1;
    this.frame      = 0;
    this.interactRange = 0;    // enemies aren't interactable by default
    this._dir       = 1;       // patrol direction: +1 right, -1 left
    this._state     = 'patrol';
    this._stunStart = 0;
    this._frameT    = 0;
  }

  get isStunned() { return this._state === 'stunned'; }

  update(ts) {
    if (this._state === 'stunned') {
      if (ts - this._stunStart >= this.stunMs) this._state = 'patrol';
      return;
    }

    if (!this.patrol) return;

    // Walk in current direction, bounce at bounds
    this.worldX += this.speed * this._dir;
    if (this.worldX >= this.patrol.x2) { this.worldX = this.patrol.x2; this._dir = -1; }
    if (this.worldX <= this.patrol.x1) { this.worldX = this.patrol.x1; this._dir =  1; }
    this.facing = this._dir;

    // Terrain snap: keep enemy on the surface (e.g. pyramid slopes)
    if (this.surfaceFn) this.worldY = this.surfaceFn(this.worldX);

    // Walk animation
    if (ts - this._frameT > 160) { this._frameT = ts; this.frame = 1 - this.frame; }
  }

  /**
   * Returns true if the player is within hurt range.
   * Call from realm.update() after entity updates.
   *
   * @param {number} px  – player world X
   * @param {number} py  – player world Y (feet)
   */
  hurtCheck(px, py) {
    return this.hostile && !this.isStunned &&
      Math.hypot(px - this.worldX, py - this.worldY) < this.hurtRange;
  }

  /**
   * Stun the enemy (e.g. player stomped it).
   * @param {number} ts – current timestamp from update(ts)
   */
  stun(ts) {
    this._state     = 'stunned';
    this._stunStart = ts;
  }
}

// ─────────────────────────────────────────────────────────
// Collectible — auto-collected when the player walks near.
// No button press needed — onNear fires collection.
//
// The collect action runs once; the entity deactivates itself
// so the registry stops checking it.
// ─────────────────────────────────────────────────────────

export class Collectible extends Entity {
  /**
   * @param {string} id
   * @param {number} worldX
   * @param {number} worldY
   * @param {object} opts
   * @param {string}   opts.type       – semantic type tag, e.g. 'coin', 'scroll', 'gem'
   * @param {number}   opts.value      – numeric value (amount of currency, charges, etc.)
   * @param {function} opts.onCollect  – (item: Collectible) => void; called on pickup
   */
  constructor(id, worldX, worldY, {
    type      = 'coin',
    value     = 1,
    onCollect = null,
  } = {}) {
    super(id, worldX, worldY);
    this.type         = type;
    this.value        = value;
    this._onCollect   = onCollect;
    this.collected    = false;
    this.interactRange = 32;
  }

  // Collectibles trigger on proximity — no keypress required.
  onNear() {
    if (this.collected) return;
    this.collected = true;
    this.active    = false;
    this._onCollect?.(this);
  }

  // draw() is intentionally empty here — concrete collectibles render
  // themselves by extending this class and overriding draw(screenX, screenY).
  // The realm's InteractableRegistry.drawEntities() calls draw() each frame.
}
