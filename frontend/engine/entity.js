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
    drawFn    = null,   // (enemy, screenX, screenY, ts) => void — optional inline renderer
  } = {}) {
    super(id, worldX, worldY);
    this.speed      = speed;
    this.patrol     = patrol;
    this.hurtRange  = hurtRange;
    this.stunMs     = stunMs;
    this.surfaceFn  = surfaceFn;
    this.hostile    = hostile;
    this._drawFn    = drawFn;
    this.facing     = 1;
    this.frame      = 0;
    this.interactRange = 0;    // enemies aren't interactable by default
    this._dir       = 1;       // patrol direction: +1 right, -1 left
    this._state     = 'patrol';
    this._stunStart = 0;
    this._frameT    = 0;
  }

  get isStunned() { return this._state === 'stunned'; }

  /** Calls the constructor-supplied drawFn if one was provided. */
  draw(screenX, screenY, ts) {
    this._drawFn?.(this, screenX, screenY, ts);
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// FreeRoamEnemy — 2D underwater enemy with patrol, sinusoidal drift, and
// proximity-triggered chase.
//
// Supports two chase styles:
//   'direct'   – constant-speed steering toward the player each frame
//                (shark, devoted: responsive, snappy).
//   'momentum' – accumulates velocity toward the player with a max speed cap
//                (squid: feels heavy and inevitable).
//
// An aggressiveFn constructor option gates whether this enemy will chase at
// all — useful for enemies that become non-hostile after a game flag changes
// (e.g. squid calms down when CLEARED, devoted become harmless when the
// player knows the Founder's name).
//
// ── Usage ─────────────────────────────────────────────────────────────────
//
//   import { FreeRoamEnemy } from '../../engine/entity.js';
//   import { Flags } from '../../engine/flags.js';
//
//   // Shark — direct chase, horizontal patrol
//   this.shark = new FreeRoamEnemy('shark', startX, SHARK_PATROL_Y, {
//     chaseStyle:   'direct',
//     patrolBounds: { x1: 280, x2: 2520, y: SHARK_PATROL_Y },
//     patrolSpeed:  SHARK_SPEED,
//     chaseSpeed:   SHARK_CHASE_SPD,
//     aggroRange:   SHARK_AGGRO,
//     hurtRange:    SHARK_HURT,
//     aggroZoneY:   ZONE_2_END,       // only chases while player is above this Y
//     drawFn:       (e, sx, sy, t) => drawShark(e, sx, sy, t),
//   });
//
//   // Squid — momentum chase, sinusoidal drift
//   this.squid = new FreeRoamEnemy('squid', startX, startY, {
//     chaseStyle:   'momentum',
//     chaseAcc:     0.06,
//     chaseSpeed:   SQUID_CHASE_SPD,
//     driftSpeed:   SQUID_SPEED,
//     driftFreq:    { x: 2400, y: 3100 },
//     aggroRange:   SQUID_AGGRO,
//     hurtRange:    SQUID_HURT,
//     aggressiveFn: () => !Flags.get('atlantis_cleared'),
//     zoneBounds:   { yMin: ZONE_2_END - 50, yMax: ZONE_3_END + 50 },
//     drawFn:       (e, sx, sy, t) => drawSquid(e, sx, sy, t),
//   });
//
//   // In realm update():
//   this.shark.update(ts, px, py);
//   if (health.canTakeDamage() && this.shark.hurtCheck(px, py)) {
//     health.kill('shark', msg);
//   }
// ─────────────────────────────────────────────────────────────────────────────

export class FreeRoamEnemy extends Entity {
  /**
   * @param {string} id
   * @param {number} worldX        - Initial world X
   * @param {number} worldY        - Initial world Y
   * @param {object} opts
   * @param {string}   opts.chaseStyle   - 'direct' or 'momentum' (default 'direct')
   *
   * Patrol / drift (idle AI):
   * @param {object}   opts.patrolBounds - { x1, x2, y } for horizontal patrol (optional)
   * @param {number}   opts.patrolSpeed  - Patrol movement speed (default 2.8)
   * @param {object}   opts.driftFreq    - { x, y } sinusoidal drift frequencies in ms (default 2400/3100)
   * @param {number}   opts.driftAmp     - Drift amplitude multiplier (default 0.012)
   * @param {number}   opts.driftSpeed   - Max drift speed (default 0.55)
   *
   * Chase AI:
   * @param {number}   opts.chaseSpeed   - Max speed when chasing (default 6.0)
   * @param {number}   opts.chaseAcc     - Momentum accumulation per frame (momentum mode, default 0.06)
   * @param {number}   opts.aggroRange   - Proximity distance to start chase (default 210)
   * @param {number}   opts.hurtRange    - Proximity distance to deal damage (default 32)
   * @param {number}   opts.aggroZoneY   - Player must be above (< ) this Y to trigger aggro
   *                                       (optional; null = no zone restriction)
   * @param {function} opts.aggressiveFn - () => bool — false disables chase entirely (e.g. flag check)
   *
   * World bounds:
   * @param {number}   opts.worldW       - Hard X clamp (default 2800)
   * @param {object}   opts.zoneBounds   - { yMin, yMax } — keep enemy in its zone (optional)
   *
   * @param {function} opts.drawFn       - (enemy, screenX, screenY, ts) => void — inline renderer
   * @param {number}   opts.phase        - Drift phase offset for groups of enemies (default 0)
   */
  constructor(id, worldX, worldY, {
    chaseStyle   = 'direct',
    patrolBounds = null,
    patrolSpeed  = 2.8,
    driftFreq    = { x: 2400, y: 3100 },
    driftAmp     = 0.012,
    driftSpeed   = 0.55,
    chaseSpeed   = 6.0,
    chaseAcc     = 0.06,
    aggroRange   = 210,
    hurtRange    = 32,
    aggroZoneY   = null,
    aggressiveFn = () => true,
    worldW       = 2800,
    zoneBounds   = null,
    drawFn       = null,
    phase        = 0,
  } = {}) {
    super(id, worldX, worldY);

    this.chaseStyle   = chaseStyle;
    this.patrolBounds = patrolBounds;
    this.patrolSpeed  = patrolSpeed;
    this.driftFreq    = driftFreq;
    this.driftAmp     = driftAmp;
    this.driftSpeed   = driftSpeed;
    this.chaseSpeed   = chaseSpeed;
    this.chaseAcc     = chaseAcc;
    this.aggroRange   = aggroRange;
    this.hurtRange    = hurtRange;
    this.aggroZoneY   = aggroZoneY;
    this._aggressiveFn = aggressiveFn;
    this.worldW        = worldW;
    this.zoneBounds    = zoneBounds;
    this._drawFn       = drawFn;
    this.phase         = phase;

    this.pvx      = 0;       // velocity (momentum mode only)
    this.pvy      = 0;
    this.chasing  = false;
    this.facing   = 1;
    this._dir     = 1;       // patrol direction
    this.interactRange = 0;  // not interactable
  }

  /**
   * Advance AI for one frame.
   *
   * @param {number} ts - Current requestAnimationFrame timestamp
   * @param {number} px - Player world X
   * @param {number} py - Player world Y
   */
  update(ts, px, py) {
    if (!this.active) return;

    const dx   = px - this.worldX;
    const dy   = py - this.worldY;
    const dist = Math.hypot(dx, dy);

    // Gate aggression by flag condition and optional zone restriction
    const canAggro = this._aggressiveFn() &&
      (this.aggroZoneY === null || py < this.aggroZoneY);

    this.chasing = canAggro && dist < this.aggroRange;

    if (this.chasing) {
      this._doChase(dx, dy, dist);
    } else {
      this._doIdle(ts);
    }

    // World clamp
    const margin = 80;
    this.worldX = Math.max(margin, Math.min(this.worldW - margin, this.worldX));
    if (this.zoneBounds) {
      this.worldY = Math.max(this.zoneBounds.yMin, Math.min(this.zoneBounds.yMax, this.worldY));
    }

    this.facing = this.worldX < px ? 1 : -1;
  }

  _doChase(dx, dy, dist) {
    const len = dist || 1;
    if (this.chaseStyle === 'momentum') {
      // Accumulate velocity — feels like weight and inevitability
      this.pvx += (dx / len) * this.chaseAcc;
      this.pvy += (dy / len) * this.chaseAcc;
      const spd = Math.hypot(this.pvx, this.pvy);
      if (spd > this.chaseSpeed) {
        this.pvx = (this.pvx / spd) * this.chaseSpeed;
        this.pvy = (this.pvy / spd) * this.chaseSpeed;
      }
      this.pvx *= 0.96; this.pvy *= 0.96;
      this.worldX += this.pvx;
      this.worldY += this.pvy;
    } else {
      // Direct: constant-speed steering, no mass
      this.worldX += (dx / len) * this.chaseSpeed;
      this.worldY += (dy / len) * this.chaseSpeed * 0.25;
      this._dir = dx > 0 ? 1 : -1;
    }
  }

  _doIdle(ts) {
    if (this.patrolBounds) {
      // Horizontal patrol bounce
      this.worldX += this.patrolSpeed * this._dir;
      if (this.worldX > this.patrolBounds.x2) { this.worldX = this.patrolBounds.x2; this._dir = -1; }
      if (this.worldX < this.patrolBounds.x1) { this.worldX = this.patrolBounds.x1; this._dir =  1; }
      if (this.patrolBounds.y != null) {
        this.worldY += (this.patrolBounds.y - this.worldY) * 0.02;
      }
    } else {
      // Sinusoidal drift
      this.pvx += Math.sin(ts / this.driftFreq.x + this.phase) * this.driftAmp;
      this.pvy += Math.cos(ts / this.driftFreq.y + this.phase) * this.driftAmp;
      const spd = Math.hypot(this.pvx, this.pvy);
      if (spd > this.driftSpeed) {
        this.pvx = (this.pvx / spd) * this.driftSpeed;
        this.pvy = (this.pvy / spd) * this.driftSpeed;
      }
      this.pvx *= 0.96; this.pvy *= 0.96;
      this.worldX += this.pvx;
      this.worldY += this.pvy;
    }
  }

  // ── Draw-layer compatibility getters ──────────────────────────────────────
  // The atlantis draw file (and any future draw file) accesses enemy positions
  // as .wx/.wy and patrol direction as .dir. These alias the Entity base fields
  // so draw code doesn't need to know about the Entity naming convention.
  get wx()      { return this.worldX; }
  set wx(v)     { this.worldX = v; }
  get wy()      { return this.worldY; }
  set wy(v)     { this.worldY = v; }
  get dir()     { return this._dir; }

  /**
   * Returns true if the player is within hurt range and the enemy is chasing.
   * Only hostile when actively chasing — passive/drifting enemies don't damage.
   */
  hurtCheck(px, py) {
    return this.active && this.chasing &&
      Math.hypot(px - this.worldX, py - this.worldY) < this.hurtRange;
  }

  /** Calls the constructor-supplied drawFn if one was provided. */
  draw(screenX, screenY, ts) {
    this._drawFn?.(this, screenX, screenY, ts);
  }
}
