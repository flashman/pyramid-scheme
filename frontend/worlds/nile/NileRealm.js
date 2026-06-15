// ── FILE: worlds/nile/NileRealm.js ───────────────────────
import { PhysicsRealm, RealmManager }     from '../../engine/realm.js';
import { TriggerZone, TriggerRegistry }   from '../../engine/trigger.js';
import { InteractableRegistry }           from '../../engine/interactables.js';
import { DialogueManager }                from '../../engine/dialogue.js';
import { PortalRegistry }                 from '../../engine/portal.js';
import { G }                              from '../../game/state.js';
import { inputDx, SPEED, SPDHALF }        from '../constants.js';
import { CW }                             from '../../engine/canvas.js';
import { log }                            from '../../ui/panels.js';
import { nileTransRender }                from '../transitions.js';
import {
  NILE_W, TOWPATH_Y, RIVER_FLOOR, CURRENT_SPD,
  NILE_ENTRY_X, NILE_RETURN_X,
  CROCS, CROC_SPEED, CROC_HURT,
} from './constants.js';
import { drawNile }      from './draw/nile.js';
import { Enemy }         from '../../engine/entity.js';
import { HealthSystem }  from '../../engine/health.js';

const _CROC_DEATH = [
  'SOBEK HAS REVIEWED YOUR ACCOUNT.\nYOU DID NOT PAY UP THE CHAIN.',
  'THE CROCODILE WEEPS AS IT WORKS.\nIT ALWAYS WEEPS.\nIT ALWAYS WORKS.',
  'YOU HAVE BEEN PROCESSED DOWNSTREAM.\nLIKE EVERYONE BELOW YOU.',
];

export class NileRealm extends PhysicsRealm {
  constructor() {
    super('nile', 'THE NILE', {
      gravity:      0.5,
      worldW:       NILE_W,
      floor:        TOWPATH_Y,
      maxFallSpeed: 14,
    });

    this.registry = new InteractableRegistry();
    this._deltaSeen = false;

    this.health = new HealthSystem({
      respawnDelay: 2200, immunityAfterSpawn: 2500,
      onKill:   (cause, msg) => {
        G.shake = 20;
        setTimeout(() => log('✦ ' + msg.split('\n')[0], 'hi'), 300);
      },
      onRespawn: () => {
        G.px = NILE_ENTRY_X; G.py = TOWPATH_Y; G.pvy = 0; G.pZ = 0;
        G.camX = Math.max(0, G.px - CW / 2); G.shake = 8;
        log('✦ You wash up on the entry bank. The river returned you.', 'hi');
      },
    });

    this.crocs = CROCS.map(c => new Enemy(c.id, c.x, RIVER_FLOOR, {
      speed: CROC_SPEED, patrol: { x1: c.x1, x2: c.x2 },
      hurtRange: CROC_HURT, surfaceFn: () => RIVER_FLOOR,
    }));

    this.triggers = new TriggerRegistry();
    this.triggers.add(new TriggerZone('return-gate', {
      x1: NILE_RETURN_X - 90, x2: NILE_RETURN_X + 90,
      condition: () => G.pZ === 0,                       // exit only from the towpath
      hint: '[↑] BACK TO THE DESERT',
      hintY: TOWPATH_Y - 50,
    }));

    // ── Inbound portal from the Desert (graph edge owned here). ──
    // Condition reads GLOBAL G.px (player's Desert position), not `this`.
    PortalRegistry.register({
      from: 'world', to: 'nile',
      key: 'ArrowUp', trigger: 'nile-gate',
      condition:  () => G.bought,
      onUse:      () => { G.shake = 6; },
      transition: nileTransRender, duration: 1100,
    });

    // ── Outbound portal back to the Desert (from the towpath). ──
    PortalRegistry.register({
      from: 'nile', to: 'world',
      key: 'ArrowUp', trigger: 'return-gate',
      onUse: () => { G.shake = 6; },
      transition: nileTransRender, duration: 1100,
    });

    // ── Disabled Crete portal (seeds the future chapter). ──
    PortalRegistry.register({
      from: 'nile', to: 'crete',
      key: null, condition: () => false,
    });
  }

  // Required by drawRealmPharaoh(). pZ tells the pharaoh which plane it's on.
  getPlayerPose() {
    return { px: G.px, py: G.py, camX: G.camX, pZ: G.pZ, facing: G.facing, frame: G.pframe };
  }

  onEnter(fromId) {
    if (fromId === 'world') {
      G.px = NILE_ENTRY_X; G.py = TOWPATH_Y; G.pvy = 0; G.pZ = 0;
      G.camX = Math.max(0, G.px - CW / 2);
    }
    this.health.setImmunity(1500);   // brief spawn grace, matching the Atlantis contract
    G.camY = 0;          // insurance: never inherit a negative camY from another realm
    G.shake = 6;
    log('✦ You walk west, and the sand turns to mud.', 'hi');
  }

  onExit() { G.shake = 4; }

  update(ts) {
    // INVARIANT: the current applies iff pZ === -1 (every frame, no jump on the
    // river), so the river is strictly one-way; the pZ 0 towpath is continuous
    // end-to-end and current-free — the guaranteed two-way return path.
    if (RealmManager.isTransitioning) return;
    if (this.health.update()) { G.camX = this._trackCameraX(G.camX, G.px); return; }
    if (DialogueManager.isActive()) return;

    const dx = inputDx(SPEED);
    if (dx !== 0) G.px = this._clampX(G.px + dx, SPDHALF);

    if (G.pZ === 0) {
      // ── Towpath: gravity + jump, free two-way walking, no current. ──
      const r = this._gravityStep(G.py, G.pvy, TOWPATH_Y);
      G.py = r.py; G.pvy = r.pvy;
    } else {
      // ── River: flat plane + one-way westward current (every frame). ──
      G.py = RIVER_FLOOR; G.pvy = 0;
      G.px = this._clampX(G.px - CURRENT_SPD, SPDHALF);
      G.pmoving = true;   // current counts as motion for the walk animation
    }

    if (G.pmoving && ts - G.legT > 120) { G.legT = ts; G.pframe = 1 - G.pframe; }
    else if (!G.pmoving) G.pframe = 0;

    G.camX = this._trackCameraX(G.camX, G.px);

    this.registry.updateEntities(ts);
    G.nearEntity = this.registry.update(G.px, G.py - 24);

    for (const c of this.crocs) c.update(ts);

    if (G.pZ === -1 && this.health.canTakeDamage()) {
      for (const c of this.crocs) {
        if (c.hurtCheck(G.px, G.py)) {
          this.health.kill('croc', _CROC_DEATH[Math.floor(Math.random() * _CROC_DEATH.length)]);
          break;
        }
      }
    }

    this.triggers.update(G.px);

    if (G.px < 1100 && !this._deltaSeen) {
      this._deltaSeen = true;
      log(G.recruits.length
        ? '✦ The Delta. Everyone you sent downstream is here.'
        : '✦ The Delta. Empty water, all the way to the sea.', 'hi');
    }
  }

  render() {
    drawNile(this);
    if (!RealmManager.isTransitioning) this.triggers.renderHints(G.camX);
    DialogueManager.render();
  }

  onKeyDown(key) {
    if (RealmManager.isTransitioning) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);

    // ↓ : towpath → river.
    if (key === 'ArrowDown' && G.pZ === 0) { G.pZ = -1; G.py = RIVER_FLOOR; G.pvy = 0; return true; } // instant snap onto the river plane (only a ~42px drop)

    // ↑ : portal first (return gate from towpath); else river → towpath.
    if (key === 'ArrowUp') {
      if (PortalRegistry.handleKey('ArrowUp', 'nile', this.triggers)) return true;
      if (G.pZ === -1) { G.pZ = 0; G.py = TOWPATH_Y; G.pvy = 0; return true; }
    }

    // Z : jump (towpath only).
    if ((key === 'z' || key === 'Z') && G.pZ === 0 && G.py >= TOWPATH_Y - 1) {
      G.pvy = -9; return true;
    }

    if (key === ' ') return this.registry.interact();
    return false;
  }
}
