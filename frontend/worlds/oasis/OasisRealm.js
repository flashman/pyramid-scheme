// ── FILE: worlds/oasis/OasisRealm.js ────────────────────
// The Oasis — a seamless eastward extension of the desert world.
// A great sphinx waits at the far end. Entered automatically when the
// player walks past the east edge of the pyramid world.

import { G }                         from '../../game/state.js';
import { PhysicsRealm, RealmManager } from '../../engine/realm.js';
import { Flags }                     from '../../engine/flags.js';
import { TriggerZone, TriggerRegistry } from '../../engine/trigger.js';
import { SPEED, SPDHALF }            from '../constants.js';
import { CW, CH, X }                 from '../../engine/canvas.js';
import { OASIS_FLOOR, OASIS_WORLD_W,
         POOL_FLOOR,
         SPHINX_WX, PASSAGE_WX,
         POOL_WX, POOL_WIDTH }       from './constants.js';
import { vaultTransRender }          from '../transitions.js';
import { drawOasis }                 from './draw/oasis.js';
import { RiddleManager }             from './riddles.js';
import { log }                       from '../../ui/panels.js';

const INTERACT_RANGE = 220;  // world-px from SPHINX_WX center to trigger riddle

// Spawns water droplets stored in G.particles (world-space).
function _spawnSplash(wx, wy) {
  for (let i = 0; i < 14; i++) {
    G.particles.push({
      x: wx, y: wy,
      vx: (Math.random() - 0.5) * 4.5,
      vy: Math.random() * -4.5 - 1,
      c: i % 3 === 0 ? '#a8e0f8' : i % 3 === 1 ? '#60b8e0' : '#c0f0ff',
      s: Math.random() * 3 + 1.5,
      life: 1,
    });
  }
}


export class OasisRealm extends PhysicsRealm {
  constructor() {
    super('oasis', 'THE OASIS', {
      gravity:      0.5,
      worldW:       OASIS_WORLD_W,
      floor:        OASIS_FLOOR,
      maxFallSpeed: 14,
    });
    this.px       = 60;
    this.py       = OASIS_FLOOR;
    this.pvy      = 0;
    this.camX     = 0;
    this.facing   = 1;
    this.frame    = 0;
    this.moving   = false;
    this._wasInPool = false;

    // ── TriggerZone: pool entry ─────────────────────────
    // Tracks pool entry/exit to fire splash and log message.
    // Speed and jump modifications are handled inline in update()
    // since they need per-frame data (current speed, jump power).
    this.triggers = new TriggerRegistry();
    this.triggers.add(new TriggerZone('pool', {
      x1:      POOL_WX,
      x2:      POOL_WX + POOL_WIDTH,
      onEnter: () => {
        _spawnSplash(this.px, OASIS_FLOOR - 2);
        log('You wade into the still water.', '');
      },
    }));
  }

  // ── Player pose ───────────────────────────────────────

  /**
   * Returns the display pose for this realm.
   * Used by drawPharaoh(realm.getPlayerPose()) in draw/oasis.js so that
   * oasis doesn't need a custom pharaoh function.
   */
  getPlayerPose() {
    return {
      px:     this.px,
      py:     this.py,
      camX:   this.camX,
      pZ:     0,
      facing: this.facing,
      frame:  this.frame,
    };
  }

  /**
   * Sync realm-local player state → G so the HUD, minimap, and any
   * G-reading system see the correct position while in the oasis.
   * Called at the end of update().
   */
  _syncToG() {
    G.px      = this.px;
    G.py      = this.py;
    G.pvy     = this.pvy;
    G.camX    = this.camX;
    G.facing  = this.facing;
    G.pframe  = this.frame;
    G.pmoving = this.moving;
  }

  // ── Lifecycle ─────────────────────────────────────────

  onEnter(fromId) {
    // Coming back up from the vault — spawn near the staircase, facing west.
    const fromVault = fromId === 'vault';
    this.px       = fromVault ? PASSAGE_WX + 20 : 60;
    this.py       = OASIS_FLOOR;
    this.pvy      = 0;
    this.camX     = fromVault
      ? Math.max(0, Math.min(OASIS_WORLD_W - 800, PASSAGE_WX - 400))
      : 0;
    this.facing   = fromVault ? -1 : 1;
    this.moving   = false;
    this.frame    = 0;
    this._wasInPool = false;
    G.shake     = fromVault ? 4 : 3;
    Flags.set('oasis_entered', true);
    if (fromVault) {
      log('✦ You climb back into the light.', 'hi');
    } else {
      log('✦ The air stills. An oasis opens before you.', 'hi');
      if (!Flags.get('sphinx_spoken')) {
        setTimeout(() => {
          log('A colossal stone face watches from the east.', '');
          log('Walk toward it and press [SPACE] to speak.', '');
        }, 800);
      }
    }
  }

  onExit() {
    G.shake = 2;
  }

  _nearSphinx() {
    return Math.abs(this.px - SPHINX_WX) < INTERACT_RANGE;
  }

  // ── Update ────────────────────────────────────────────

  update(ts) {
    if (RiddleManager.isActive()) return;
    if (RealmManager.isTransitioning) return;

    // ── Pool state (drives speed + floor modifications) ──
    const inPool = this.px >= POOL_WX && this.px <= POOL_WX + POOL_WIDTH;
    const activeFloor = inPool ? POOL_FLOOR : OASIS_FLOOR;

    // TriggerRegistry drives pool onEnter/onExit callbacks.
    this.triggers.update(this.px);

    // ── Horizontal movement ───────────────────────────────
    let dx = 0;
    const baseSpeed = inPool ? SPEED * 0.55 : SPEED;
    const speed = G.keys['Shift'] ? baseSpeed * 2 : baseSpeed;
    if (G.keys['ArrowLeft'] || G.keys['a'] || G.keys['A']) { dx = -speed; this.facing = -1; }
    if (G.keys['ArrowRight'] || G.keys['d'] || G.keys['D']) { dx =  speed; this.facing =  1; }
    this.moving = dx !== 0;

    if (dx !== 0) this.px = this._clampX(this.px + dx, SPDHALF);

    // ── Auto-return: walked back past the west edge ───────
    if (this.px <= SPDHALF + 2) {
      RealmManager.transitionTo('world');
      return;
    }

    // ── Gravity + jump (wading: reduced jump, higher floor) ──
    const result = this._gravityStep(this.py, this.pvy, activeFloor);
    this.py  = result.py;
    this.pvy = result.pvy;

    // ── Walk animation ────────────────────────────────────
    if (this.moving && ts - G.legT > 120) { G.legT = ts; this.frame = 1 - this.frame; }
    else if (!this.moving) this.frame = 0;

    // ── Camera ───────────────────────────────────────────
    this.camX = this._trackCameraX(this.camX, this.px);

    // ── Sync realm state → G ─────────────────────────────
    this._syncToG();
  }

  render() {
    drawOasis(this);
  }

  onKeyDown(key) {
    if (RiddleManager.isActive()) return RiddleManager.onKeyDown(key);
    if (RealmManager.isTransitioning) return false;

    // Jump (reduced in pool)
    if (key === 'z' || key === 'Z') {
      const inPool = this.px >= POOL_WX && this.px <= POOL_WX + POOL_WIDTH;
      const jumpPow = inPool ? -6 : -9;
      if (this.py >= (inPool ? POOL_FLOOR : OASIS_FLOOR) - 1) {
        this.pvy = jumpPow;
        if (inPool) _spawnSplash(this.px, OASIS_FLOOR - 2);
        return true;
      }
    }

    // Enter vault — descend the staircase between the sphinx paws
    if (key === 'ArrowDown') {
      const riddlesSolved = Flags.get('sphinx_riddles_solved') || 0;
      if (riddlesSolved >= 1 && Math.abs(this.px - PASSAGE_WX) < 100) {
        log('✦ You descend the stone steps beneath the sphinx.', 'hi');
        G.shake = 8;
        RealmManager.scheduleTransition('vault', {
          duration: 1400,
          render:   vaultTransRender,
        });
        Flags.inc('passage_crossed');
        return true;
      }
      return false;
    }

    // Speak to sphinx
    if (key === ' ') {
      if (this._nearSphinx()) {
        Flags.set('sphinx_spoken', true);
        RiddleManager.start();
        return true;
      }
      return false;
    }

    return false;
  }
}
