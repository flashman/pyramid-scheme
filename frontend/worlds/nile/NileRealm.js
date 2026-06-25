// ── FILE: worlds/nile/NileRealm.js ───────────────────────
// The Nile — west of the Desert. The river runs to the Delta and the sea.
//
// MOVEMENT (position/surface-based — see constants.js for the model):
//   • Dry bank segments are solid, current-free ground (the beats live there).
//   • The water gaps between them sweep you WEST every frame your feet are in the
//     water (and the current beats the swim speed) — strictly one-way.
//   • Reeds and crocodile backs are one-way platforms ABOVE the waterline; landing
//     on one lifts your feet out of the current. Hop them to cross the gaps.
//   • A "quay wall" stops you walking into a dry bank from the water — you must
//     climb out onto it from above (a reed, a croc-back, or a jump).
//   • Soft-lock guarantee: the riverbed is standable everywhere and a jump from the
//     shallows always reaches a bank/reed, so you can never be trapped; death just
//     washes you back to the entry bank.

import { PhysicsRealm, RealmManager }     from '../../engine/realm.js';
import { TriggerZone, TriggerRegistry }   from '../../engine/trigger.js';
import { InteractableRegistry }           from '../../engine/interactables.js';
import { DialogueManager }                from '../../engine/dialogue.js';
import { PortalRegistry }                 from '../../engine/portal.js';
import { Flags }                          from '../../engine/flags.js';
import { Events }                         from '../../engine/events.js';
import { StallOverlay }                   from './shop/StallOverlay.js';
import { G }                              from '../../game/state.js';
import { inputDx, SPEED, SPDHALF }        from '../constants.js';
import { CW }                             from '../../engine/canvas.js';
import { log }                            from '../../ui/panels.js';
import { cityTransRender,
         desertTransRender }              from '../transitions.js';
import {
  NILE_W, BANK_Y, WATER_Y, RIVERBED_Y, REED_TOP, CROC_BACK,
  CURRENT_SPD, SWIM_SPD, JUMP_VY,
  NILE_ENTRY_X, NILE_RETURN_X,
  BANK_SEGMENTS, REEDS,
  CROCS, CROC_SPEED, CROC_HURT,
  BAZAAR_X, MOSES_X, FERRY_X, SOBEK_X, JOSEPH_X,
  DELTA_START_X, BOAT_X,
} from './constants.js';
import { drawNile }                  from './draw/nile.js';
import { spawnParts }                from '../../draw/utils.js';
import { drawParts }                 from '../../draw/hud.js';
import { Enemy, NPC, Entity }        from '../../engine/entity.js';
import { HealthSystem }              from '../../engine/health.js';
import {
  buildMerchantDialogue,
  buildFerrymanDialogue,
  buildSobekDialogue,
  buildJosephDialogue,
  buildBabyDialogue,
} from './dialogue.js';

const CROC_BACK_HW = 20;   // half-width of a crocodile's standable back

const _CROC_DEATH = [
  'SOBEK HAS REVIEWED YOUR ACCOUNT.\nYOU DID NOT PAY UP THE CHAIN.',
  'THE CROCODILE WEEPS AS IT WORKS.\nIT ALWAYS WEEPS.\nIT ALWAYS WORKS.',
  'YOU HAVE BEEN PROCESSED DOWNSTREAM.\nLIKE EVERYONE BELOW YOU.',
  'THE RIVER BALANCES ITS LEDGER.\nYOU WERE A LINE ITEM.',
];

export class NileRealm extends PhysicsRealm {
  constructor() {
    super('nile', 'THE NILE', {
      gravity:      0.5,
      worldW:       NILE_W,
      floor:        BANK_Y,
      maxFallSpeed: 14,
    });

    this.registry = new InteractableRegistry();
    this._deltaSeen = false;

    // The bazaar stall — a first-person canvas sub-mode (not a realm). Opened
    // from the merchant dialogue via the Events bus so dialogue.js stays decoupled.
    this.stall = new StallOverlay();
    Events.on('shop:open', () => { if (!this.stall.isOpen()) this.stall.open(); });

    this.health = new HealthSystem({
      respawnDelay: 2200, immunityAfterSpawn: 2500,
      onKill:   (cause, msg) => {
        G.shake = 20;
        spawnParts(G.px, G.py - 10, '#7a2018', 26);   // the river takes its cut
        spawnParts(G.px, G.py - 10, '#bfe2dc', 10);
        setTimeout(() => log('✦ ' + msg.split('\n')[0], 'hi'), 300);
      },
      onRespawn: () => {
        G.px = NILE_ENTRY_X; G.py = BANK_Y; G.pvy = 0;
        G.camX = Math.max(0, G.px - CW / 2); G.shake = 8;
        log('✦ You wash up on the entry bank. The river returned you. It returns everything, eventually.', 'hi');
      },
    });

    // Crocodiles patrol the gaps; their backs double as moving platforms.
    this.crocs = CROCS.map(c => new Enemy(c.id, c.x, RIVERBED_Y - 14, {
      speed: CROC_SPEED, patrol: { x1: c.x1, x2: c.x2 },
      hurtRange: CROC_HURT, surfaceFn: () => RIVERBED_Y - 14,
    }));

    // NPCs (interaction anchors; figures are drawn in draw/nile.js).
    const merchant = new NPC('merchant', BAZAAR_X, BANK_Y, 'THE MERCHANT', buildMerchantDialogue());
    merchant.interactRange = 70;
    this.registry.register(merchant);

    const ferryman = new NPC('ferryman', FERRY_X, BANK_Y, 'THE FERRYMAN', buildFerrymanDialogue());
    ferryman.interactRange = 76;
    this.registry.register(ferryman);

    const sobek = new NPC('sobek', SOBEK_X, BANK_Y, 'SOBEK', buildSobekDialogue());
    sobek.interactRange = 96;
    this.registry.register(sobek);

    const joseph = new NPC('joseph', JOSEPH_X, BANK_Y, 'JOSEPH', buildJosephDialogue());
    joseph.interactRange = 80;
    this.registry.register(joseph);

    // The reed boat at the river mouth — seeds a future chapter across the sea
    // (no travel yet; the destination is unrevealed to the player).
    const boat = new Entity('boat', BOAT_X, RIVERBED_Y - 8);
    boat.interactRange = 72;
    boat.onInteract = () => {
      log('✦ A reed boat, pointed at the open sea.', 'hi');
      setTimeout(() => log('It faces something past the horizon. Too far to make out what.', ''), 600);
      setTimeout(() => log('Not yet. The sea is not ready for you.', ''), 1200);
    };
    this.registry.register(boat);

    // The basket in the bulrushes — a fork. Take it or drown it (see
    // buildBabyDialogue). The choice is decided once; after that the reeds
    // just report what you did. Downstream layers read Ledger('nile_baby').
    const moses = new Entity('moses', MOSES_X, WATER_Y - 2);
    moses.interactRange = 58;
    moses.onInteract = () => {
      if (Flags.get('nile_baby')) return;          // decided once — life is a downline
      DialogueManager.start(buildBabyDialogue());
    };
    this.registry.register(moses);
    this._baby = moses;                            // deactivated in update() once processed

    this.triggers = new TriggerRegistry();
    this.triggers.add(new TriggerZone('return-gate', {
      x1: NILE_RETURN_X - 90, x2: NILE_RETURN_X + 90,
      condition: () => this._onBank(G.px) && G.py <= BANK_Y + 2,  // exit only from the bank
      hint: '[↑] BACK TO THE DESERT',
      hintY: BANK_Y - 56,
    }));

    // ── Inbound portal from the Desert (graph edge owned here). ──
    PortalRegistry.register({
      from: 'world', to: 'nile',
      key: 'ArrowUp', trigger: 'nile-gate',
      // Locked until the first scroll is sent — set once at the send site in
      // recruits.js (monotonic; immune to invite-count accumulation).
      condition:  () => Flags.get('first_scroll_sent'),
      onUse:      () => { G.shake = 6; },
      transition: cityTransRender, duration: 3000,
    });

    // ── Outbound portal back to the Desert (from the bank). ──
    PortalRegistry.register({
      from: 'nile', to: 'world',
      key: 'ArrowUp', trigger: 'return-gate',
      onUse: () => { G.shake = 6; },
      transition: desertTransRender, duration: 2600,
    });

    // ── Disabled outbound portal — seeds the future across-the-sea chapter.
    //    Destination intentionally unnamed (the player doesn't know it yet). ──
    PortalRegistry.register({
      from: 'nile', to: 'sea',
      key: null, condition: () => false,
    });
  }

  // ── Terrain helpers ───────────────────────────────────────

  /** Is world-x on a dry, solid, current-free bank segment? */
  _onBank(x) {
    for (const s of BANK_SEGMENTS) if (x >= s.x1 && x <= s.x2) return true;
    return false;
  }

  /**
   * The standable surface Y under the player. Dry bank = solid BANK_Y. In a water
   * gap the riverbed is always standable (wading); reeds and croc-backs are
   * one-way platforms — they only catch you when you come down onto them from
   * at/above their top (pyPrev).
   */
  _groundUnder(px, pyPrev) {
    if (this._onBank(px)) return BANK_Y;
    let best = RIVERBED_Y;
    for (const r of REEDS) {
      if (px >= r.x - r.w / 2 && px <= r.x + r.w / 2 && pyPrev <= REED_TOP + 1)
        best = Math.min(best, REED_TOP);
    }
    for (const c of this.crocs) {
      if (px >= c.worldX - CROC_BACK_HW && px <= c.worldX + CROC_BACK_HW && pyPrev <= CROC_BACK + 1)
        best = Math.min(best, CROC_BACK);
    }
    return best;
  }

  /** A dry bank presents a quay wall to anyone in the water — climb out from above. */
  _bankWall(x, py) { return this._onBank(x) && py >= WATER_Y; }

  // Required by drawRealmPharaoh(). pZ 0 → normal feet-at-py rendering.
  getPlayerPose() {
    return { px: G.px, py: G.py, camX: G.camX, pZ: 0, facing: G.facing, frame: G.pframe };
  }

  onEnter(fromId) {
    if (fromId === 'world') {
      G.px = NILE_ENTRY_X; G.py = BANK_Y; G.pvy = 0;
      G.camX = Math.max(0, G.px - CW / 2);
    }
    G.pZ = 0;
    this.health.setImmunity(1500);
    G.camY = 0;
    G.shake = 6;
    log('✦ You walk west, and the sand turns to mud. The sun is setting on this side of the river.', 'hi');
  }

  onExit() { G.shake = 4; }

  update(ts) {
    if (RealmManager.isTransitioning) return;
    if (this.stall.isOpen()) return;   // frozen at the table
    if (this.health.update()) { G.camX = this._trackCameraX(G.camX, G.px); return; }
    if (DialogueManager.isActive()) return;

    const pyPrev     = G.py;
    const feetInWater = pyPrev >= WATER_Y - 0.5;

    // ── Horizontal movement ───────────────────────────────
    if (feetInWater) {
      // Swim: reduced control, no sprint; the current dominates.
      let sdx = 0;
      if (G.keys['ArrowLeft'])  { sdx = -SWIM_SPD; G.facing = -1; }
      if (G.keys['ArrowRight']) { sdx =  SWIM_SPD; G.facing =  1; }
      G.pmoving = sdx !== 0;
      // Firm current everywhere except the Delta, where the river spreads and
      // slows so you can wade freely toward the boat. Also no push mid-jump-launch.
      const inDelta = G.px < DELTA_START_X;
      const cur = (G.pvy >= -0.5 && !inDelta) ? CURRENT_SPD : 0;
      const tryX = G.px + sdx - cur;
      G.px = this._bankWall(tryX, G.py) ? G.px : this._clampX(tryX, SPDHALF);
    } else {
      const dx = inputDx(SPEED);
      if (dx !== 0) {
        const tryX = G.px + dx;
        if (!this._bankWall(tryX, G.py)) G.px = this._clampX(tryX, SPDHALF);
      }
    }

    // ── Vertical: gravity against the surface under us ─────
    const surf = this._groundUnder(G.px, pyPrev);
    const r = this._gravityStep(G.py, G.pvy, surf);
    G.py = r.py; G.pvy = r.pvy;

    // splash when the player breaks the surface (falling/wading in)
    if (pyPrev < WATER_Y && G.py >= WATER_Y && G.pvy > 1.2) {
      spawnParts(G.px, WATER_Y, '#bfe2dc', 12);
    }

    // ── Walk / wade animation ─────────────────────────────
    if (G.pmoving && ts - G.legT > 120) { G.legT = ts; G.pframe = 1 - G.pframe; }
    else if (!G.pmoving) G.pframe = 0;

    G.camX = this._trackCameraX(G.camX, G.px);
    G.camY = 0;

    // ── Entities / proximity ──────────────────────────────
    this.registry.updateEntities(ts);
    G.nearEntity = this.registry.update(G.px, G.py - 24);

    // The basket fork is decided once; afterwards the basket can no longer be
    // handled — life is a downline, and this one has already gone downstream.
    if (this._baby?.active && Flags.get('nile_baby')) this._baby.active = false;

    // LAYER 1 of the baby fork: drowning the child feeds Sobek. A fed river is
    // owed nothing — the crocs stop hunting (they go still and bask) and spare
    // you. Otherwise they patrol as normal.
    const sobekFavor = Flags.get('nile_baby') === 'drowned';
    for (const c of this.crocs) { c.sated = sobekFavor; if (!sobekFavor) c.update(ts); }

    // ── Croc bite — only while actually in the water (riding a back is safe,
    //    since then your feet are above the waterline and this never runs). ──
    if (feetInWater && !sobekFavor && this.health.canTakeDamage()) {
      for (const c of this.crocs) {
        if (c.hurtCheck(G.px, G.py)) {
          this.health.kill('croc', _CROC_DEATH[Math.floor(Math.random() * _CROC_DEATH.length)]);
          break;
        }
      }
    }

    this.triggers.update(G.px);

    if (G.px < DELTA_START_X && !this._deltaSeen) {
      this._deltaSeen = true;
      log('✦ The Delta. The river spreads wide, all the way to the sea.', 'hi');
    }
  }

  render() {
    drawNile(this);
    drawParts();                       // water splashes (screen-space; handles camX)
    if (!RealmManager.isTransitioning) this.triggers.renderHints(G.camX);
    DialogueManager.render();
    this.stall.render();               // topmost canvas content while open
  }

  onKeyDown(key) {
    if (this.stall.isOpen()) return this.stall.onKeyDown(key);
    if (RealmManager.isTransitioning) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);

    // ↑ : return gate (from the bank); delegated to the portal registry.
    if (key === 'ArrowUp') {
      if (PortalRegistry.handleKey('ArrowUp', 'nile', this.triggers)) return true;
    }

    // Z : jump / lunge — works off the bank, a reed, a croc-back, or out of the shallows.
    if (key === 'z' || key === 'Z') {
      const surf = this._groundUnder(G.px, G.py);
      if (G.py >= surf - 1) { G.pvy = JUMP_VY; return true; }
    }

    if (key === ' ') return this.registry.interact();
    return false;
  }
}
