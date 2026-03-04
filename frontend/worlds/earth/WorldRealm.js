// ── FILE: worlds/earth/WorldRealm.js ────────────────────

import { G }                              from '../../game/state.js';
import { PhysicsRealm, RealmManager }     from '../../engine/realm.js';
import { InteractableRegistry }           from '../../engine/interactables.js';
import { DialogueManager }                from '../../engine/dialogue.js';
import { Flags }                          from '../../engine/flags.js';
import { X, CW, CH }                      from '../../engine/canvas.js';
import { COL }                            from '../../engine/colors.js';
import { GND, WORLD_W, Z_LAYERS }         from './constants.js';
import { SPEED, SPDHALF, LH }             from '../constants.js';
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

const OASIS_GATE_RANGE = 220;  // world-px around OASIS_ENTRY_X to show prompt

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
  }

  // ── Terrain interface ─────────────────────────────────
  //
  // Override PhysicsRealm's flat-floor defaults with pyramid terrain.
  // descendId is respected here so the physics loop can call
  // this.surfaceAt(x) uniformly without knowing about phase-through.

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
  }

  onExit() {}

  // ── Positional helpers ────────────────────────────────

  _oasisGateNear() {
    return G.pZ === 0 && Math.abs(G.px - OASIS_ENTRY_X) < OASIS_GATE_RANGE;
  }

  _cryptDoorNear() {
    const pp = G.pyramids.find(p => p.isPlayer);
    return G.pZ === -1 && G.py >= GND - 2 && pp && Math.abs(G.px - pp.wx) < 55;
  }

  _capstoneTipNear() {
    if (!Flags.get('cosmic_upline_done')) return false;
    const pp = G.pyramids.find(p => p.isPlayer);
    if (!pp || !pp.layers) return false;
    const topY = GND - pp.layers * LH;
    return G.pZ === 0 && G.py <= topY + 6 && Math.abs(G.px - pp.wx) < 20;
  }

  // ── Update ────────────────────────────────────────────

  update(ts) {
    if (RealmManager.isTransitioning) return;
    if (!G.bought) return;

    // ── Horizontal movement ───────────────────────────────
    const speed = (G.keys['Shift']) ? SPEED * 2 : SPEED;
    let dx = 0, moving = false;
    if (G.keys['ArrowLeft']  || G.keys['a'] || G.keys['A']) { dx = -speed; G.facing = -1; moving = true; }
    if (G.keys['ArrowRight'] || G.keys['d'] || G.keys['D']) { dx =  speed; G.facing =  1; moving = true; }
    G.pmoving = moving;

    if (G.pZ === 0) {
      // ── Z-layer 0: surface plane ──────────────────────
      if (dx !== 0) {
        const edgeX = G.px + dx + (dx > 0 ? SPDHALF : -SPDHALF);
        if (this.canStepTo(G.py, edgeX)) G.px = this._clampX(G.px + dx, SPDHALF);
        // Snap up slopes: if the surface rose ahead, pull the player up.
        const ns = this.surfaceAt(G.px);
        if (ns < G.py) { G.py = ns; G.pvy = 0; }
      }
      // ── Gravity ───────────────────────────────────────
      const surf   = this.surfaceAt(G.px);
      const result = this._gravityStep(G.py, G.pvy, surf);
      G.py  = result.py;
      G.pvy = result.pvy;

      // ── Cancel phase-through once clear of the pyramid ──
      // Use raw surfAt (not surfaceAt) here: we want the FULL surface
      // including the phased pyramid to know when we've fallen past it.
      if (G.descendId && surfAt(G.px) >= G.py) G.descendId = null;

    } else {
      // ── Z-layer -1: foreground plane (in front of everything) ──
      if (dx !== 0) G.px = this._clampX(G.px + dx, SPDHALF);
      G.py = GND; G.pvy = 0;
    }

    // ── Walk animation ────────────────────────────────────
    if (moving && ts - G.legT > 120) { G.legT = ts; G.pframe = 1 - G.pframe; }
    else if (!moving) G.pframe = 0;

    // ── Camera ────────────────────────────────────────────
    G.camX = this._trackCameraX(G.camX, G.px);
    const targetCamY = Math.min(0, G.py - CH * 0.65);
    G.camY += (targetCamY - G.camY) * 0.08;

    // ── Entity / proximity updates ────────────────────────
    this.registry.updateEntities(ts);
    G.nearEntity = this.registry.update(G.px, G.py - 24);
    G.nearPyr    = nearbyFriendPyr(G.px);

    // ── Oasis gate: clamp player at the east edge ─────────
    // Don't auto-enter — player must press [↑] at the gate.
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

    if (!RealmManager.isTransitioning && this._capstoneTipNear()) {
      const pp = G.pyramids.find(p => p.isPlayer);
      const sx = pp ? Math.round(pp.wx - G.camX): CW / 2 ;
      const ty = pp ?  Math.round(GND - pp.layers * LH - G.camY) - 14: CH / 2;
      X.save();
      X.globalAlpha = 0.65 + 0.35 * Math.abs(Math.sin(Date.now() / 480));
      X.fillStyle = COL.GOLD_BRIGHT; X.font = '6px monospace'; X.textAlign = 'center';
      X.fillText('[↑] ASCEND', sx, ty);
      X.textAlign = 'left'; X.restore();
    }

    if (!RealmManager.isTransitioning && this._oasisGateNear()) {
      const gx = Math.round(OASIS_ENTRY_X - G.camX);
      X.save();
      X.globalAlpha = 0.65 + 0.35 * Math.abs(Math.sin(Date.now() / 460));
      X.fillStyle = '#f0c020'; X.font = '6px monospace'; X.textAlign = 'center';
      X.fillText('[↑] ENTER THE OASIS', Math.max(80, Math.min(CW - 80, gx)), CH / 2 - 20);
      X.textAlign = 'left'; X.restore();
    }

  }


  // ── Input ─────────────────────────────────────────────

  onKeyDown(key){
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
      if (this._oasisGateNear()) {
        RealmManager.scheduleTransition('oasis', {
          duration: 1200,
          render:   oasisTransRender,
        });
        G.shake = 6;
        log('The east wind pulls you forward.', '');
        return true;
      }
      if (Flags.get('crypt_open') && this._cryptDoorNear()) {
        RealmManager.transitionTo('chamber');
      } else if (this._capstoneTipNear()) {
        RealmManager.scheduleTransition('council', {
          duration: 2600,
          render:   launchTransRender,
        });
        G.shake = 12;
        spawnParts(G.px, G.py - 10, COL.GOLD_BRIGHT, 50);
        spawnParts(G.px, G.py - 10, '#aa44ff', 30);
        say('TO THE STARS!', 300);
      } else if (G.pZ === -1 && surfAt(G.px) === GND) {
        G.pZ = 0;
      }
      return true;
    }

    if ((key === 'z' || key === 'Z') && G.bought && G.pZ === 0) {
      // ── Jump ───────────────────────────────────────────
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
