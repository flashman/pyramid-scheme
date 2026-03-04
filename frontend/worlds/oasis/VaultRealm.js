// ── FILE: worlds/oasis/VaultRealm.js ────────────────────
// The sealed chamber beneath the great sphinx.
// This place is wrong. Something has been happening here for a long time.

import { G }                         from '../../game/state.js';
import { RealmManager }              from '../../engine/realm.js';
import { FlatRealm }                 from '../FlatRealm.js';
import { InteractableRegistry }      from '../../engine/interactables.js';
import { NPC }                       from '../../engine/entity.js';
import { Dialogue, DialogueManager } from '../../engine/dialogue.js';
import { Flags, QuestManager }       from '../../engine/flags.js';
import { vaultTransRender }          from '../transitions.js';
import { VAULT_FLOOR, STELE_X }      from './constants.js';
import { drawVault }                 from './draw/vault.js';
import { log }                       from '../../ui/panels.js';

// ── Dream Stele inscription ───────────────────────────────
// Based on the real stele of Thutmose IV (~1400 BC), repurposed.

function _buildSteleDialogue() {
  return new Dialogue({
    start: {
      speaker: 'DREAM STELE  ✦  1400 BC',
      text: 'I THE GREAT SPHINX\nCAME TO THE PRINCE\nWHILE HE SLEPT BETWEEN MY PAWS.\nI SAID: LOOK AT ME.',
      next: 'promise',
    },
    promise: {
      speaker: 'DREAM STELE  ✦  1400 BC',
      text: 'I SAID: THE SAND BURIES ME.\nFREE ME, AND I WILL GIVE YOU\nYOUR FATHER\'S THRONE.\nHE WOKE. HE DID AS I ASKED.',
      next: 'built',
    },
    built: {
      speaker: 'DREAM STELE  ✦  1400 BC',
      text: 'HE BUILT THIS STONE\nTO RECORD THE DREAM.\nTHE PROMISE WAS KEPT.\nTHUTMOSE IV BECAME PHARAOH.',
      next: 'others',
    },
    others: {
      speaker: 'DREAM STELE  ✦  1400 BC',
      text: 'BUT BEFORE THUTMOSE,\nTHREE OTHER PRINCES\nSLEPT HERE AND RECEIVED\nTHE SAME DREAM.',
      next: 'silence',
    },
    silence: {
      speaker: 'DREAM STELE  ✦  1400 BC',
      text: 'THEY ARE NOT RECORDED.\nTHEIR STONES WERE NOT BUILT.\nTHERE IS ONLY ONE THRONE.\nTHE REST ONLY DIG.',
      next: 'you',
    },
    you: {
      speaker: 'DREAM STELE  ✦  1400 BC',
      text: 'YOU HAVE ALSO BEEN\nPROMISED THE THRONE, PHARAOH.\nBY YOUR UPLINE.\nBY YOUR UPLINE\'S UPLINE.',
      next: 'question',
    },
    question: {
      speaker: 'DREAM STELE  ✦  1400 BC',
      text: 'HOW MANY HAVE BEEN\nGIVEN THE SAME PROMISE?\nHOW MANY ARE DIGGING NOW?\nWHO BUILT THIS STONE?',
      onEnter: () => {
        Flags.set('stele_read', true);
        log('✦ The inscription settles in your chest like sand.', 'hi');
        QuestManager.check();
      },
      next: null,
    },
  });
}

export class VaultRealm extends FlatRealm {
  constructor() {
    super('vault', 'BENEATH THE SPHINX', { floor: VAULT_FLOOR, minX: 40, maxX: 740 });
    this.px       = 190;  // near the staircase entrance

    this.registry = new InteractableRegistry();
    this._stele   = new NPC('stele', STELE_X, VAULT_FLOOR, 'DREAM STELE', _buildSteleDialogue());
    this._stele.interactRange = 110;
    this.registry.register(this._stele);
  }

  onEnter(fromId) {
    this.px     = 190;
    this.facing = 1;
    this.moving = false;
    this.frame  = 0;
    G.shake = 6;
    Flags.set('vault_entered', true);
    log('✦ You descend beneath the sphinx.', 'hi');
    if (!Flags.get('stele_read')) {
      setTimeout(() => {
        log('Something has been done here. Repeatedly.', '');
        log('A great stone stands at the far end.', '');
        log('Press [SPACE] to read the inscription.', '');
      }, 900);
    }
  }

  onExit() {
    G.shake = 4;
  }

  update(ts) {
    if (DialogueManager.isActive()) return;
    this._walkStep(ts);
    this.registry.update(this.px, VAULT_FLOOR);
  }

  render() {
    drawVault(this);
    DialogueManager.render();
  }

  onKeyDown(key) {
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if (key === 'ArrowUp') {
      RealmManager.scheduleTransition('oasis', {
        duration: 1000,
        render: vaultTransRender,
      });
      return true;
    }
    if (key === ' ') return this.registry.interact();
    return false;
  }
}
