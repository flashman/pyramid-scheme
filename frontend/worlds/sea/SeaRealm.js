// ── FILE: worlds/sea/SeaRealm.js ─────────────────────────
// THE SEA — the voyage from the Nile Delta toward Crete, rendered in WebGL.
//
// Unlike every other realm, this one does not draw its world on the 2D canvas:
// three.js renders into #gl, which sits UNDER the transparent #c. The 2D canvas
// still carries overlays (the loading beat, the fade-in, dialogue, transitions).
//
// three.js loads lazily: this module never imports it (or scene.js) statically,
// and the constructor touches no DOM — the manifest constructs every realm at boot.

import { Realm, RealmManager } from '../../engine/realm.js';
import { PortalRegistry }  from '../../engine/portal.js';
import { DialogueManager } from '../../engine/dialogue.js';
import { Flags }           from '../../engine/flags.js';
import { Events }          from '../../engine/events.js';
import { X, CW, CH }       from '../../engine/canvas.js';
import { G }                from '../../game/state.js';
import { getTier }         from '../../game/tiers.js';
import { Api }             from '../../game/api.js';
import { log }             from '../../ui/panels.js';
import { SoundManager }    from '../../audio/sound.js';
import { seaTransRender }  from '../transitions.js';
import { COURSE_HEADING }  from './constants.js';
import { createVoyage, stepVoyage }       from './voyage.js';
import { createNarrationMemory, narrate } from './narration.js';
import { buildSeaMenuDialogue, buildArrivalDialogue } from './dialogue.js';

const FADE_MS = 1200;
const SPEED_OF_SOUND = 343;   // m/s — thunder arrives after the flash
const HIRED_HANDS = 4;

/** Your downline rows: one rower per recruit (24 benches); with no downline, a few hands are hired. */
const rowersFor = (g) => (g.recruits.length > 0 ? Math.min(24, g.recruits.length) : HIRED_HANDS);

let _sceneModule = null;
/** Start (or reuse) the lazy scene import; a failed import can be retried. */
function loadScene() {
  _sceneModule ??= import('./scene.js').catch(err => { _sceneModule = null; throw err; });
  return _sceneModule;
}

export class SeaRealm extends Realm {
  constructor() {
    super('sea', 'THE SEA');
    this._gl = null;
    this._scene = null;
    this._readyAt = 0;
    this._lastTs = null;
    this._dt = 0;
    this.voyage = null;
    this._narration = null;

    // Dragging on the 2D canvas (which sits on top of #gl) orbits the camera;
    // the view holds where you leave it (double-click resets). Attached only
    // while at sea.
    this._c = null;
    this._dragId = null;
    const release = (e) => { if (e.pointerId !== this._dragId) return; this._dragId = null; this._scene?.releaseOrbit(); };
    this._pointer = [
      ['pointerdown',   (e) => { if (!this._scene || DialogueManager.isActive()) return; this._dragId = e.pointerId; this._c.setPointerCapture(e.pointerId); }],
      ['pointermove',   (e) => { if (e.pointerId === this._dragId) this._scene.orbit(e.movementX, e.movementY); }],
      ['pointerup',     release],
      ['pointercancel', release],
      ['dblclick',      () => this._scene?.resetView()],
    ];

    // Back to the Delta — by turning back, or by sailing out of Crete's bay.
    PortalRegistry.register({
      from: 'sea', to: 'nile', key: null,
      onUse: () => { G.shake = 4; },
      transition: seaTransRender, duration: 2200,
    });

    // The Shipmaster's dialogue at the Delta asks for the scene early, so it
    // has usually finished loading by the time the player boards.
    Events.on('sea:preload', () => { loadScene().catch(() => {}); });
  }

  // No 2D pharaoh here — the pharaoh stands at the prow in the 3D scene.
  getPlayerPose() { return null; }

  onEnter() {
    this._gl ??= document.getElementById('gl');
    this._gl.hidden = false;
    this._c ??= document.getElementById('c');
    for (const [type, fn] of this._pointer) this._c.addEventListener(type, fn);
    this._c.style.touchAction = 'none';                 // a drag orbits the camera instead of scrolling
    this.voyage = createVoyage();
    this._narration = createNarrationMemory();
    this._lastTs = null;
    this._readyAt = performance.now();
    if (this._scene) { this._scene.introView(); return; }
    loadScene()
      .then(mod => {
        if (RealmManager.currentId !== 'sea' || this._scene) return;
        this._scene = mod.createSeaScene(this._gl, { windAngle: COURSE_HEADING, crew: rowersFor(G), rank: getTier().name });
        this._scene.introView();                          // open looking back at the Delta and the pyramids
        this._readyAt = performance.now();
      })
      .catch(err => {
        console.error('[sea] scene failed to load', err);
        log('✦ The sea will not take this vessel. The ship returns you to the Delta.', 'hi');
        PortalRegistry.use('sea', 'nile');
      });
  }

  onExit() {
    if (this._gl) this._gl.hidden = true;
    if (this._c) {
      for (const [type, fn] of this._pointer) this._c.removeEventListener(type, fn);
      this._c.style.touchAction = '';
    }
    this._dragId = null;
    SoundManager.setAmbience(1);   // leave other realms' noise tracks at full level
  }

  update(ts) {
    const now = ts / 1000;
    this._dt = this._lastTs == null ? 0 : Math.min(0.1, now - this._lastTs);
    this._lastTs = now;
    if (!this._scene || !this.voyage) return;           // hold at the Delta until the sails are raised

    const helm = DialogueManager.isActive()
      ? { steer: 0, trim: 0, row: 0 }                   // hands off the tiller while talking
      : {
          steer: (G.keys.ArrowLeft ? 1 : 0) - (G.keys.ArrowRight ? 1 : 0),
          trim:  G.keys.Shift ? 0 : (G.keys.ArrowUp ? 1 : 0) - (G.keys.ArrowDown ? 1 : 0),   // ↑/↓ trims the sail
          row:   G.keys.Shift ? (G.keys.ArrowUp ? 1 : 0) - (G.keys.ArrowDown ? 1 : 0) : 0,   // ⇧+↑/↓ sets the rowing effort
        };
    const events = stepVoyage(this.voyage, helm, this._dt);
    for (const line of narrate(events, this.voyage.t, this._narration)) log(line, 'hi');
    for (const e of events) this._onEvent(e);
    SoundManager.setAmbience(this.voyage.storm * this.voyage.storm);   // rain: a whisper in calm water, full in the storm
  }

  _onEvent(e) {
    if (e.type === 'lightning') {
      this._scene.flash(e);
      SoundManager.playThunder(e.distance / SPEED_OF_SOUND, e.power);
    } else if (e.type === 'arrived') {
      this._recordArrival();
      DialogueManager.start(buildArrivalDialogue());
    } else if (e.type === 'sunk') {
      // Wrecked on a rock: the Letter is kept (a keepsake); the Delta takes you back.
      log('✦ THE SEA HAS ACCEPTED YOUR PASSAGE. IT IS NON-REFUNDABLE. You wash up in the Delta reeds, your Letter somehow still dry.', 'hi');
      PortalRegistry.use('sea', 'nile');
    }
  }

  _recordArrival() {
    Flags.set('crete_reached', true);   // instant and local; /api/state strips it — the server records it below
    if (Api.hasToken()) Api.post('/api/progress', { step_id: 'crete_reached' }).catch(() => {});
  }

  render() {
    if (this._scene) {
      this._scene.render(this.voyage, this._dt);
      const fade = 1 - (performance.now() - this._readyAt) / FADE_MS;
      if (fade > 0) { X.fillStyle = `rgba(6, 10, 16, ${fade})`; X.fillRect(0, 0, CW, CH); }
    } else {
      X.fillStyle = '#060a10';
      X.fillRect(0, 0, CW, CH);
      X.fillStyle = '#9aa8b8';
      X.font = '10px monospace';
      X.textAlign = 'center';
      X.fillText('THE SAILS ARE BEING RAISED' + '.'.repeat(1 + Math.floor(performance.now() / 400) % 3), CW / 2, CH / 2);
      X.textAlign = 'left';
    }
    DialogueManager.render();
  }

  onKeyDown(key) {
    if (RealmManager.isTransitioning) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if (key === ' ' && this._scene) {
      DialogueManager.start(buildSeaMenuDialogue({
        arrived: this.voyage.arrived,
        onTurnBack: () => PortalRegistry.use('sea', 'nile'),
      }));
      return true;
    }
    return false;
  }
}
