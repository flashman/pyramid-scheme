// ── FILE: worlds/earth/WorldRealm.js ────────────────────

import { G }                              from '../../game/state.js';
import { PhysicsRealm, RealmManager }     from '../../engine/realm.js';
import { InteractableRegistry }           from '../../engine/interactables.js';
import { TriggerZone, TriggerRegistry }   from '../../engine/trigger.js';
import { DialogueManager }                from '../../engine/dialogue.js';
import { Flags }                          from '../../engine/flags.js';
import { X, CW, CH }                      from '../../engine/canvas.js';
import { COL }                            from '../../engine/colors.js';
import { GND, WORLD_W, Z_LAYERS }         from './constants.js';
import { SPEED, SPDHALF, LH, inputDx }   from '../constants.js';
import { OASIS_ENTRY_X }                  from '../oasis/constants.js';
import { oasisTransRender, launchTransRender } from '../transitions.js';
import { spawnParts }                     from '../../draw/utils.js';
import {
  surfAt, surfAtExcluding, canStep,
  pyrUnderPlayer, playerPyrSurfAt, nearbyFriendPyr,
} from './terrain.js';
import { inspectPyr, say }               from '../../game/recruits.js';
import { drawBG }                         from './draw/background.js';
import { drawCloudsAndCelestial }         from './draw/celestial.js';
import { buildGodEntities, drawGodsLayer } from './draw/gods.js';
import { drawPyr }                        from './draw/pyramids.js';
import { drawPharaoh }                    from '../../draw/pharaoh.js';
import { drawParts, drawHUD, drawMinimap } from '../../draw/hud.js';
import { log }                            from '../../ui/panels.js';

const OASIS_GATE_RANGE = 220;

// ── WorldRealm ────────────────────────────────────────────

export class WorldRealm extends PhysicsRealm {
  constructor() {
    super('world', 'THE DESERT', {
      gravity:      0.5,
      worldW:       WORLD_W,
      floor:        GND,
      maxFallSpeed: 14,
    });
    this.registry    = new InteractableRegistry();
    this.godEntities = buildGodEntities();
    this.godEntities.forEach(g => this.registry.register(g));

    // ── TriggerRegistry: gate zones ──────────────────────
    // Replaces the 3 hardcoded _xxxNear() helpers.
    // Each zone draws its hint text via renderHints(); the onEnter
    // callbacks handle side-effects like log messages.
    this.triggers = new TriggerRegistry();

    this.triggers.add(new TriggerZone('oasis-gate', {
      x1:        OASIS_ENTRY_X - OASIS_GATE_RANGE,
      x2:        OASIS_ENTRY_X + OASIS_GATE_RANGE,
      condition: () => G.pZ === 0,
      hint:      '[↑] ENTER THE OASIS',
      onEnter:   () => log('The east wind pulls you forward.', ''),
    }));

    // Crypt door and capstone-ascend zones are registered lazily in
    // onEnter (so they can read the player pyramid position at that time)
    // and refreshed whenever the player pyramid changes.
    this._rebuildDynamicTriggers();
  }

  // Rebuild triggers that depend on player pyramid position.
  // Called once in constructor and again whenever G.pyramids changes.
  _rebuildDynamicTriggers() {
    this.triggers.remove('crypt-door');
    this.triggers.remove('capstone-tip');

    const pp = G.pyramids.find(p => p.isPlayer);

    this.triggers.add(new TriggerZone('crypt-door', {
      x1:        pp ? pp.wx - 55 : -9999,
      x2:        pp ? pp.wx + 55 : -9999,
      condition: () => G.pZ === -1 && G.py >= GND - 2 && Flags.get('crypt_open'),
      hint:      '[↑] ENTER THE CRYPT',
      hintY:     GND - 30,
    }));

    if (pp && pp.layers) {
      const topY = GND - pp.layers * LH;
      this.triggers.add(new TriggerZone('capstone-tip', {
        x1:        pp.wx - 20,
        x2:        pp.wx + 20,
        condition: () => G.pZ === 0 && G.py <= topY + 6 && Flags.get('cosmic_upline_done'),
        hint:      '[↑] ASCEND',
        hintY:     topY - 14,
        hintColor: COL.GOLD_BRIGHT,
      }));
    }
  }

  // ── Terrain interface ─────────────────────────────────

  surfaceAt(x) {
    return G.descendId
      ? surfAtExcluding(x, G.descendId)
      : surfAt(x);
  }

  canStepTo(feetY, x) {
    return canStep(feetY, x);
  }

  // ── Lifecycle ─────────────────────────────────────────

  onEnter(fromId) {
    G.shake = 4;
    if (fromId === 'chamber') log('You emerge from the pyramid.', '');
    if (fromId === 'council') {
      const pp = G.pyramids.find(p => p.isPlayer);
      if (pp) { G.px = pp.wx; G.py = GND - pp.layers * LH; }
      G.camX = Math.max(0, G.px - CW / 2);
      G.shake = 10;
      log('★ You descend from the stars.', 'hi');
      spawnParts(G.px, G.py - 10, '#aa44ff', 40);
      say('BACK ON EARTH!', 180);
    }
    // Refresh pyramid-position-dependent triggers on every entry
    this._rebuildDynamicTriggers();
  }

  onExit() {}

  // ── Update ────────────────────────────────────────────

  update(ts) {
    if (RealmManager.isTransitioning) return;
    if (!G.bought) return;

    // ── Horizontal movement (inputDx handles keys + G.facing/pmoving) ─
    const dx = inputDx(SPEED);
    G.pmoving = dx !== 0;

    if (G.pZ === 0) {
      // ── Z-layer 0: surface plane ──────────────────────
      if (dx !== 0) {
        const edgeX = G.px + dx + (dx > 0 ? SPDHALF : -SPDHALF);
        if (this.canStepTo(G.py, edgeX)) G.px = this._clampX(G.px + dx, SPDHALF);
        const ns = this.surfaceAt(G.px);
        if (ns < G.py) { G.py = ns; G.pvy = 0; }
      }
      // ── Gravity ───────────────────────────────────────
      const surf   = this.surfaceAt(G.px);
      const result = this._gravityStep(G.py, G.pvy, surf);
      G.py  = result.py;
      G.pvy = result.pvy;

      // ── Cancel phase-through once clear of the pyramid ──
      if (G.descendId && surfAt(G.px) >= G.py) G.descendId = null;

    } else {
      // ── Z-layer -1: foreground plane ──────────────────
      if (dx !== 0) G.px = this._clampX(G.px + dx, SPDHALF);
      G.py = GND; G.pvy = 0;
    }

    // ── Walk animation ────────────────────────────────────
    if (G.pmoving && ts - G.legT > 120) { G.legT = ts; G.pframe = 1 - G.pframe; }
    else if (!G.pmoving) G.pframe = 0;

    // ── Camera ────────────────────────────────────────────
    G.camX = this._trackCameraX(G.camX, G.px);
    const targetCamY = Math.min(0, G.py - CH * 0.65);
    G.camY += (targetCamY - G.camY) * 0.08;

    // ── Entity / proximity updates ────────────────────────
    this.registry.updateEntities(ts);
    G.nearEntity = this.registry.update(G.px, G.py - 24);
    G.nearPyr    = nearbyFriendPyr(G.px);

    // ── Trigger zones ─────────────────────────────────────
    this.triggers.update(G.px);

    // ── Oasis gate: clamp player at the east edge ─────────
    if (G.pZ === 0 && G.px > OASIS_ENTRY_X + OASIS_GATE_RANGE) {
      G.px = OASIS_ENTRY_X + OASIS_GATE_RANGE;
    }
  }

  // ── Render ────────────────────────────────────────────

  render() {
    drawBG(G.camY);
    drawCloudsAndCelestial(G.camY);
    X.save();
    X.translate(0, -Math.round(G.camY));
    for (let z = 2; z >= 0; z--)
      for (const p of G.pyramids) if (!p.isPlayer && (p.zLayer||0) === z) drawPyr(p);
    for (const p of G.pyramids) if (p.isPlayer) drawPyr(p);
    drawPharaoh();
    drawParts();
    X.restore();
    drawGodsLayer(this.godEntities, this.registry);
    drawHUD();
    drawMinimap();
    DialogueManager.render();

    // Trigger hints (crypt door, capstone ascend, oasis gate)
    if (!RealmManager.isTransitioning) {
      this.triggers.renderHints(G.camX);
    }
  }

  // ── Input ─────────────────────────────────────────────

  onKeyDown(key) {
    if (RealmManager.isTransitioning) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);

    if (key === 'ArrowDown' && G.bought && G.pZ === 0) {
      if (G.py >= GND - 2) {
        G.pZ = -1;
      } else {
        const standingOn = pyrUnderPlayer(G.px, G.py);
        if (standingOn && !standingOn.isPlayer) {
          const ownSurf = playerPyrSurfAt(G.px);
          if (ownSurf < GND) G.descendId = standingOn.id;
        }
      }
      return true;
    }

    if (key === 'ArrowUp' && G.bought) {
      if (this.triggers.isInside('oasis-gate')) {
        RealmManager.scheduleTransition('oasis', {
          duration: 1200,
          render:   oasisTransRender,
        });
        G.shake = 6;
        return true;
      }
      if (this.triggers.isInside('crypt-door')) {
        RealmManager.transitionTo('chamber');
        return true;
      }
      if (this.triggers.isInside('capstone-tip')) {
        RealmManager.scheduleTransition('council', {
          duration: 2600,
          render:   launchTransRender,
        });
        G.shake = 12;
        spawnParts(G.px, G.py - 10, COL.GOLD_BRIGHT, 50);
        spawnParts(G.px, G.py - 10, '#aa44ff', 30);
        say('TO THE STARS!', 300);
        return true;
      }
      if (G.pZ === -1 && surfAt(G.px) === GND) {
        G.pZ = 0;
        return true;
      }
    }

    if ((key === 'z' || key === 'Z') && G.bought && G.pZ === 0) {
      const surf = this.surfaceAt(G.px);
      if (G.py >= surf - 1) { G.pvy = -9; return true; }
    }

    if (key === ' ') {
      if (this.registry.interact()) return true;
      if (G.nearPyr) { inspectPyr(G.nearPyr); return true; }
    }
    return false;
  }
}
