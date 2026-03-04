// ── FILE: worlds/oasis/OasisRealm.js ────────────────────
// The Oasis — a seamless eastward extension of the desert world.
// A great sphinx waits at the far end. Entered automatically when the
// player walks past the east edge of the pyramid world.

import { G }                         from '../../game/state.js';
import { PhysicsRealm, RealmManager } from '../../engine/realm.js';
import { Flags }                     from '../../engine/flags.js';
import { SPEED, SPDHALF }            from '../constants.js';
import { CW, CH, X }                 from '../../engine/canvas.js';
import { OASIS_FLOOR, OASIS_WORLD_W,
         POOL_FLOOR,
         SPHINX_WX, PASSAGE_WX,
         POOL_WX, POOL_WIDTH }       from './constants.js';
import { drawOasis }                 from './draw/oasis.js';
import { RiddleManager }             from './riddles.js';
import { log }                       from '../../ui/panels.js';

const INTERACT_RANGE = 220;  // world-px from SPHINX_WX center to trigger riddle

// ── Splash particle burst ─────────────────────────────────
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

// ── Passage transition renderer ───────────────────────────
// Golden blaze, then darkness, like stepping through a veil.
function _passageTransRender(progress) {
  const p = Math.min(1, progress);
  if (p < 0.5) {
    // Blaze in
    X.save();
    X.globalAlpha = p * 2;
    const cg = X.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.7);
    cg.addColorStop(0.0, '#ffffff');
    cg.addColorStop(0.3, '#f8e870');
    cg.addColorStop(0.7, '#c06010');
    cg.addColorStop(1.0, '#060200');
    X.fillStyle = cg;
    X.fillRect(0, 0, CW, CH);
    X.restore();
  } else {
    // Fade to dark
    X.save();
    X.globalAlpha = (p - 0.5) * 2;
    X.fillStyle = '#020100';
    X.fillRect(0, 0, CW, CH);
    X.restore();
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
  }

  onEnter() {
    this.px       = 60;
    this.py       = OASIS_FLOOR;
    this.pvy      = 0;
    this.camX     = 0;
    this.facing   = 1;
    this.moving   = false;
    this.frame    = 0;
    this._wasInPool = false;
    G.shake     = 3;
    Flags.set('oasis_entered', true);
    log('✦ The air stills. An oasis opens before you.', 'hi');
    if (!Flags.get('sphinx_spoken')) {
      setTimeout(() => {
        log('A colossal stone face watches from the east.', '');
        log('Walk toward it and press [SPACE] to speak.', '');
      }, 800);
    }
  }

  onExit() {
    G.shake = 2;
  }

  _nearSphinx() {
    return Math.abs(this.px - SPHINX_WX) < INTERACT_RANGE;
  }

  update(ts) {
    if (RiddleManager.isActive()) return;
    if (RealmManager.isTransitioning) return;

    // ── Pool wading: is player inside the water footprint? ──
    const inPool = this.px >= POOL_WX && this.px <= POOL_WX + POOL_WIDTH;
    const activeFloor = inPool ? POOL_FLOOR : OASIS_FLOOR;

    // Splash particles on pool entry
    if (inPool && !this._wasInPool) {
      _spawnSplash(this.px, OASIS_FLOOR - 2);
      log('You wade into the still water.', '');
    }
    this._wasInPool = inPool;

    // ── Horizontal movement ───────────────────────────────
    let dx = 0;
    const baseSpeed = inPool ? SPEED * 0.55 : SPEED;  // wade slowly
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
          render:   _passageTransRender,
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
