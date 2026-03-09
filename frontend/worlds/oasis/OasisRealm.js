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
         POOL_WX, POOL_WIDTH,
         POOL_CENTER_WX,
         POOL_DIVE_RANGE }           from './constants.js';
import { vaultTransRender,
         atlantisTransRender }       from '../transitions.js';
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

    // ── Atlantis gate state ──────────────────────────────
    // The vault ritual opens the passage. The pool shows the result.
    // The statue rise is a one-way animation triggered by atlantis_vault_opened.
    this._statueRisen    = Flags.get('atlantis_statue_risen') || false;
    this._statueProgress = this._statueRisen ? 1 : 0;
    this._statueRising   = false;
    this._statueRiseStart = 0;

    // ── TriggerZone: pool entry ─────────────────────────
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
    const fromVault    = fromId === 'vault';
    const fromAtlantis = fromId === 'atlantis';

    this.px   = fromVault    ? PASSAGE_WX + 20
              : fromAtlantis ? POOL_CENTER_WX
              : 60;
    this.py   = OASIS_FLOOR;
    this.pvy  = 0;
    this.camX = fromVault
      ? Math.max(0, Math.min(OASIS_WORLD_W - 800, PASSAGE_WX - 400))
      : fromAtlantis
        ? Math.max(0, Math.min(OASIS_WORLD_W - 800, POOL_CENTER_WX - 400))
        : 0;
    this.facing   = (fromVault || fromAtlantis) ? -1 : 1;
    this.moving   = false;
    this.frame    = 0;
    this._wasInPool = false;

    // Restore statue state from flags
    this._statueRisen    = Flags.get('atlantis_statue_risen') || false;
    this._statueProgress = this._statueRisen ? 1 : 0;
    this._statueRising   = false;

    // If vault was opened but statue hasn't fully risen yet, resume the animation.
    if (Flags.get('atlantis_vault_opened') && !this._statueRisen) {
      this._statueRising   = true;
      this._statueRiseStart = Date.now() - 500; // half-second head start
    }

    G.shake     = fromVault ? 4 : fromAtlantis ? 8 : 3;
    Flags.set('oasis_entered', true);

    if (fromAtlantis) {
      log('✦ You breach the surface and gasp for warm air.', 'hi');
    } else if (fromVault) {
      log('✦ You climb back into the light.', 'hi');
      if (Flags.get('atlantis_vault_opened') && !this._statueRisen) {
        setTimeout(() => log('The pool is changing. Walk to the water.', ''), 800);
      }
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

    // ── Pool state ────────────────────────────────────────
    const inPool = this.px >= POOL_WX && this.px <= POOL_WX + POOL_WIDTH;
    const activeFloor = inPool ? POOL_FLOOR : OASIS_FLOOR;

    this.triggers.update(this.px);

    // ── Horizontal movement ───────────────────────────────
    let dx = 0;
    const baseSpeed = inPool ? SPEED * 0.55 : SPEED;
    const speed = G.keys['Shift'] ? baseSpeed * 2 : baseSpeed;
    if (G.keys['ArrowLeft'] || G.keys['a'] || G.keys['A']) { dx = -speed; this.facing = -1; }
    if (G.keys['ArrowRight'] || G.keys['d'] || G.keys['D']) { dx =  speed; this.facing =  1; }
    this.moving = dx !== 0;

    if (dx !== 0) this.px = this._clampX(this.px + dx, SPDHALF);

    // ── Statue rise animation ─────────────────────────────
    // Triggered by the vault altar being opened (atlantis_vault_opened flag).
    // If we enter the oasis and the vault is open but statue not risen, start rising.
    if (!this._statueRising && !this._statueRisen && Flags.get('atlantis_vault_opened')) {
      this._statueRising   = true;
      this._statueRiseStart = Date.now();
      _spawnSplash(POOL_CENTER_WX, OASIS_FLOOR);
      log('Something rises in the pool.', '');
    }
    if (this._statueRising && !this._statueRisen) {
      const elapsed = Date.now() - this._statueRiseStart;
      this._statueProgress = Math.min(1, elapsed / 5000);
      if (this._statueProgress >= 1) {
        this._statueRising   = false;
        this._statueRisen    = true;
        Flags.set('atlantis_statue_risen', true);
        G.shake = 8;
        log('✦ The statue stands in the pool. A passage opens below.', 'hi');
        log('[↓] Dive into the pool to enter Atlantis.', '');
      }
    }

    if (this.px <= SPDHALF + 2) {
      RealmManager.transitionTo('world');
      return;
    }

    // ── Gravity + jump ────────────────────────────────────
    const result = this._gravityStep(this.py, this.pvy, activeFloor);
    this.py  = result.py;
    this.pvy = result.pvy;

    // ── Walk animation ────────────────────────────────────
    if (this.moving && ts - G.legT > 120) { G.legT = ts; this.frame = 1 - this.frame; }
    else if (!this.moving) this.frame = 0;

    // ── Camera ───────────────────────────────────────────
    this.camX = this._trackCameraX(this.camX, this.px);

    this._syncToG();
  }

  render() {
    drawOasis(this);
  }

  onKeyDown(key) {
    if (RiddleManager.isActive()) return RiddleManager.onKeyDown(key);
    if (RealmManager.isTransitioning) return false;

    // Jump
    if (key === 'z' || key === 'Z') {
      const inPool = this.px >= POOL_WX && this.px <= POOL_WX + POOL_WIDTH;
      const jumpPow = inPool ? -6 : -9;
      if (this.py >= (inPool ? POOL_FLOOR : OASIS_FLOOR) - 1) {
        this.pvy = jumpPow;
        if (inPool) _spawnSplash(this.px, OASIS_FLOOR - 2);
        return true;
      }
    }

    if (key === 'ArrowDown') {
      const inPool   = this.px >= POOL_WX && this.px <= POOL_WX + POOL_WIDTH;
      const nearDive = Math.abs(this.px - POOL_CENTER_WX) < POOL_DIVE_RANGE;

      // ── Dive to Atlantis — statue must be fully risen ─
      if (this._statueRisen && nearDive && inPool) {
        log('✦ You take a breath and dive beneath the pool.', 'hi');
        G.shake = 10;
        RealmManager.scheduleTransition('atlantis', {
          duration: 1400,
          render:   atlantisTransRender,
        });
        Flags.inc('atlantis_dives');
        return true;
      }

      // ── Descend to vault ──────────────────────────────
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
      // Hint if near pool but vault not opened yet
      const inPool = this.px >= POOL_WX && this.px <= POOL_WX + POOL_WIDTH;
      if (inPool && !Flags.get('atlantis_vault_opened') && Flags.get('stele_read')) {
        log('The pool is still. Something has been opened below.', '');
        log('Wait for the water to change.', '');
        return true;
      }
      return false;
    }

    return false;
  }
}
