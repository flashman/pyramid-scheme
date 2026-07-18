// ── FILE: worlds/oasis/OasisRealm.js ────────────────────
// The Oasis — a seamless eastward extension of the desert world.
// A great sphinx waits at the far end. Entered automatically when the
// player walks past the east edge of the pyramid world.

import { G }                         from '../../game/state.js';
import { RealmManager }               from '../../engine/realm.js';
import { SolidRealm }                 from '../../engine/solidrealm.js';
import { TUNING }                     from '../../engine/kinematics.js';
import { Flags }                     from '../../engine/flags.js';
import { TriggerZone, TriggerRegistry } from '../../engine/trigger.js';
import { SPDHALF }                   from '../constants.js';
import { CW, CH, X }                 from '../../engine/canvas.js';
import { OASIS_FLOOR, OASIS_WORLD_W,
         POOL_FLOOR,
         SPHINX_WX, PASSAGE_WX,
         POOL_WX, POOL_WIDTH,
         POOL_CENTER_WX,
         POOL_DIVE_RANGE }           from './constants.js';
import { vaultTransRender,
         atlantisTransRender }       from '../transitions.js';
import { PortalRegistry }            from '../../engine/portal.js';
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


// Pool wading: same 0.55 speed factor as the old realm; flat −6 hop.
const POOL_TUNING = {
  ...TUNING,
  walkMax: TUNING.walkMax * 0.55, runMax: TUNING.runMax * 0.55,
  jumpVy: -6, jumpVyPerVx: 0,
};

export class OasisRealm extends SolidRealm {
  constructor() {
    super('oasis', 'THE OASIS', {
      worldW:    OASIS_WORLD_W,
      maxStepUp: 30,          // pool floor is 28px below the banks — walk out freely
    });

    // ── Geometry: dry floor either side of the sunken pool floor ──
    this.solids.addStatic([
      { x: -100,                   y: OASIS_FLOOR, w: POOL_WX + 100,                         h: 300 },
      { x: POOL_WX,                y: POOL_FLOOR,  w: POOL_WIDTH,                            h: 300 },
      { x: POOL_WX + POOL_WIDTH,   y: OASIS_FLOOR, w: OASIS_WORLD_W - POOL_WX - POOL_WIDTH + 100, h: 300 },
    ]);
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

    // ── Portal exits ──────────────────────────────────────
    // Registered with `this` in scope so conditions can read instance state.
    PortalRegistry.register({
      from: 'oasis', to: 'vault',
      key: 'ArrowDown',
      condition: () => {
        const riddlesSolved = Flags.get('sphinx_riddles_solved') || 0;
        return riddlesSolved >= 1 && Math.abs(this.px - PASSAGE_WX) < 100;
      },
      onUse: () => {
        log('✦ You descend the stone steps beneath the sphinx.', 'hi');
        G.shake = 8;
        Flags.inc('passage_crossed');
      },
      transition: vaultTransRender, duration: 1400,
    });
    PortalRegistry.register({
      from: 'oasis', to: 'atlantis',
      key: 'ArrowDown',
      condition: () => {
        const inPool   = this.px >= POOL_WX && this.px <= POOL_WX + POOL_WIDTH;
        const nearDive = Math.abs(this.px - POOL_CENTER_WX) < POOL_DIVE_RANGE;
        return this._statueRisen && nearDive && inPool;
      },
      onUse: () => {
        log('✦ You take a breath and dive beneath the pool.', 'hi');
        G.shake = 10;
        Flags.inc('atlantis_dives');
      },
      transition: atlantisTransRender, duration: 1400,
    });
    // oasis→world is boundary-triggered in update() — registered here for graph completeness.
    PortalRegistry.register({ from: 'oasis', to: 'world', key: null });
  }

  // ── Draw-file compat: state lives in G now ────────────
  get px()     { return G.px; }
  get py()     { return G.py; }
  get camX()   { return G.camX; }
  get facing() { return G.facing; }
  get frame()  { return G.pframe; }

  // ── Player pose ───────────────────────────────────────

  getPlayerPose() {
    return { px: G.px, py: G.py, camX: G.camX, pZ: 0, facing: G.facing, frame: G.pframe };
  }

  // ── Lifecycle ─────────────────────────────────────────

  onEnter(fromId) {
    this.resetMotion();
    const fromVault    = fromId === 'vault';
    const fromAtlantis = fromId === 'atlantis';

    G.px   = fromVault    ? PASSAGE_WX + 20
           : fromAtlantis ? POOL_CENTER_WX
           : 60;
    G.py   = OASIS_FLOOR;
    G.camX = fromVault
      ? Math.max(0, Math.min(OASIS_WORLD_W - 800, PASSAGE_WX - 400))
      : fromAtlantis
        ? Math.max(0, Math.min(OASIS_WORLD_W - 800, POOL_CENTER_WX - 400))
        : 0;
    G.facing   = (fromVault || fromAtlantis) ? -1 : 1;
    G.pmoving  = false;
    G.pframe   = 0;
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

    this.triggers.update(this.px);

    // ── Player physics (pool zone slows and softens the jump) ──
    this.physicsStep(ts, { tuning: inPool ? POOL_TUNING : this.tuning, edgeMargin: SPDHALF });

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

    // ── Walk animation ────────────────────────────────────
    this.stepWalkAnim(ts);

    // ── Camera ───────────────────────────────────────────
    G.camX = this._trackCameraX(G.camX, G.px);
  }

  render() {
    drawOasis(this);
  }

  onKeyDown(key) {
    if (RiddleManager.isActive()) return RiddleManager.onKeyDown(key);
    if (RealmManager.isTransitioning) return false;

    // Jump — not a portal.
    if (key === 'z' || key === 'Z') {
      const inPool = G.px >= POOL_WX && G.px <= POOL_WX + POOL_WIDTH;
      if (this.tryJump(inPool ? POOL_TUNING : this.tuning)) {
        if (inPool) _spawnSplash(G.px, OASIS_FLOOR - 2);
        return true;
      }
    }

    // Portal exits (vault, atlantis) — delegated to registry.
    if (key === 'ArrowDown') {
      if (PortalRegistry.handleKey('ArrowDown', 'oasis', null)) return true;
      return false;
    }

    // Speak to sphinx / pool hint.
    if (key === ' ') {
      if (this._nearSphinx()) {
        Flags.set('sphinx_spoken', true);
        RiddleManager.start();
        return true;
      }
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
