// ── FILE: worlds/atlantis/AtlantisRealm.js ──────────────
// The Lost City of Atlantis — alternative history deep-world.
// Full 2D swimming: arrow keys control velocity with drag and buoyancy.
// Entered by diving from the Oasis pool. Exit by swimming back to surface.

import { Realm, RealmManager } from '../../engine/realm.js';
import { G }                   from '../../game/state.js';
import { CW, CH }              from '../../engine/canvas.js';
import { Flags }               from '../../engine/flags.js';
import { log }                 from '../../ui/panels.js';
import {
  ATLANTIS_WORLD_W, ATLANTIS_WORLD_H,
  ATLANTIS_ENTRY_Y, ATLANTIS_EXIT_Y,
  SWIM_ACC, SWIM_DRAG, SWIM_MAX_SPD, SWIM_BUOYANCY,
} from './constants.js';
import { drawAtlantis } from './draw/atlantis.js';
import { atlantisTransRender } from '../transitions.js';

// ── Depth-dependent haze colours ─────────────────────────
function _depthHaze() {
  return 'rgba(0,12,32,0.18)';
}

export class AtlantisRealm extends Realm {
  constructor() {
    super('atlantis', 'THE LOST CITY OF ATLANTIS');

    // World-space position
    this.px  = ATLANTIS_WORLD_W / 2;
    this.py  = ATLANTIS_ENTRY_Y;

    // Velocity
    this.pvx = 0;
    this.pvy = 0;

    // Camera (top-left corner of viewport in world coords)
    this.camX = 0;
    this.camY = 0;

    // For drawing
    this.moving  = false;
    this.frame   = 0;
    this._frameT = 0;
  }

  // ── Lifecycle ─────────────────────────────────────────

  onEnter(fromId) {
    this.px  = ATLANTIS_WORLD_W / 2;
    this.py  = ATLANTIS_ENTRY_Y;
    this.pvx = 0;
    this.pvy = 1.5;   // start with a small downward push — you just dived in
    this._syncCamera();
    this._syncToG();

    Flags.set('atlantis_visited', true);
    G.shake = 6;

    log('✦ You plunge beneath the surface.', 'hi');
    setTimeout(() => {
      log('The water closes above you.', '');
      log('Arrow keys to swim. [↑] to surface.', '');
    }, 600);
    setTimeout(() => {
      log('Something vast lies below.', '');
    }, 1600);
  }

  onExit() {
    G.shake = 4;
  }

  // ── Camera ────────────────────────────────────────────

  _syncCamera() {
    const targetX = this.px - CW / 2;
    const targetY = this.py - CH / 2;
    this.camX += (targetX - this.camX) * 0.1;
    this.camY += (targetY - this.camY) * 0.1;
    this.camX = Math.max(0, Math.min(ATLANTIS_WORLD_W - CW, this.camX));
    this.camY = Math.max(0, Math.min(ATLANTIS_WORLD_H - CH, this.camY));
  }

  // ── State → G ─────────────────────────────────────────

  _syncToG() {
    G.px      = this.px;
    G.py      = this.py;
    G.pvx     = this.pvx;
    G.pvy     = this.pvy;
    G.camX    = this.camX;
    G.camY    = this.camY;
    G.facing  = this.pvx < -0.3 ? -1 : 1;
    G.pmoving = this.moving;
    G.pframe  = this.frame;
  }

  // ── Player pose ───────────────────────────────────────

  getPlayerPose() {
    return {
      px:     this.px,
      py:     this.py,
      camX:   this.camX,
      camY:   this.camY,
      pZ:     0,
      facing: G.facing,
      frame:  this.frame,
    };
  }

  // ── Update ────────────────────────────────────────────

  update(ts) {
    if (RealmManager.isTransitioning) return;

    const keys = G.keys;

    // ── Buoyancy: gentle upward drift ────────────────────
    this.pvy += SWIM_BUOYANCY;

    // ── Player input ──────────────────────────────────────
    let inputting = false;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) { this.pvx -= SWIM_ACC; inputting = true; }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) { this.pvx += SWIM_ACC; inputting = true; }
    if (keys['ArrowUp']    || keys['w'] || keys['W']) { this.pvy -= SWIM_ACC; inputting = true; }
    if (keys['ArrowDown']  || keys['s'] || keys['S']) { this.pvy += SWIM_ACC; inputting = true; }

    // Speed boost
    const speedMult = keys['Shift'] ? 1.6 : 1.0;

    // ── Drag ──────────────────────────────────────────────
    this.pvx *= SWIM_DRAG;
    this.pvy *= SWIM_DRAG;

    // ── Clamp speed ───────────────────────────────────────
    const maxSpd = SWIM_MAX_SPD * speedMult;
    this.pvx = Math.max(-maxSpd, Math.min(maxSpd, this.pvx));
    this.pvy = Math.max(-maxSpd, Math.min(maxSpd, this.pvy));

    // ── Stop micro-drift ──────────────────────────────────
    if (Math.abs(this.pvx) < 0.08) this.pvx = 0;
    if (Math.abs(this.pvy) < 0.08) this.pvy = 0;

    // ── Move ──────────────────────────────────────────────
    this.px += this.pvx;
    this.py += this.pvy;

    // ── Clamp to world ────────────────────────────────────
    this.px = Math.max(20, Math.min(ATLANTIS_WORLD_W - 20, this.px));
    this.py = Math.max(0, Math.min(ATLANTIS_WORLD_H - 20, this.py));

    // ── Bounce off floor and walls with slight dampening ──
    if (this.py >= ATLANTIS_WORLD_H - 20) {
      this.py  = ATLANTIS_WORLD_H - 20;
      this.pvy = -Math.abs(this.pvy) * 0.4;
    }
    if (this.py <= 0) {
      this.py  = 0;
      this.pvy = Math.abs(this.pvy) * 0.2;
    }

    // ── Animation ─────────────────────────────────────────
    this.moving = Math.abs(this.pvx) + Math.abs(this.pvy) > 0.3;
    if (this.moving && ts - this._frameT > 180) {
      this._frameT = ts;
      this.frame   = 1 - this.frame;
    } else if (!this.moving) {
      this.frame = 0;
    }

    // ── Camera ────────────────────────────────────────────
    this._syncCamera();

    // ── Sync to G ─────────────────────────────────────────
    this._syncToG();
  }

  // ── Key handling ──────────────────────────────────────

  onKeyDown(key) {
    if (RealmManager.isTransitioning) return false;

    // Surface exit: ArrowUp when near the surface
    if ((key === 'ArrowUp' || key === 'w' || key === 'W') && this.py <= ATLANTIS_EXIT_Y) {
      log('✦ You breach the surface and gasp for air.', 'hi');
      G.shake = 8;
      RealmManager.scheduleTransition('oasis', {
        duration: 1200,
        render:   atlantisTransRender,
      });
      return true;
    }

    // Log first discovery of key areas
    if (key === 'ArrowDown' || key === 's' || key === 'S') {
      if (this.py > 400 && !Flags.get('atlantis_deep_dived')) {
        Flags.set('atlantis_deep_dived', true);
        log('The city emerges from the dark.', '');
      }
    }

    return false;
  }

  // ── Render ────────────────────────────────────────────

  render() {
    drawAtlantis(this);
  }
}
