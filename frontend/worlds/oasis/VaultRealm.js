// ── FILE: worlds/oasis/VaultRealm.js ────────────────────
// The sealed chamber beneath the great sphinx.
// This place is wrong. Something has been happening here for a long time.
// But there is something deeper wrong. The sphinx is not Egyptian.
// It is not even pharaonic. It is older. Someone left a door down here,
// and they are waiting for you to find it.

import { G }                         from '../../game/state.js';
import { FlatRealm }                 from '../FlatRealm.js';
import { InteractableRegistry }      from '../../engine/interactables.js';
import { NPC, Entity }               from '../../engine/entity.js';
import { Dialogue, DialogueManager } from '../../engine/dialogue.js';
import { Flags, QuestManager }       from '../../engine/flags.js';
import { vaultTransRender }          from '../transitions.js';
import { PortalRegistry }            from '../../engine/portal.js';
import { VAULT_FLOOR, STELE_X,
         ALTAR_X }                   from './constants.js';
import { drawVault }                 from './draw/vault.js';
import { log }                       from '../../ui/panels.js';

// ── Dream Stele inscription ───────────────────────────────
// Begins as the real stele of Thutmose IV (~1400 BC).
// Then the text changes register.
// Because this was not built by Thutmose. Or Khafre. Or any pharaoh.
// The pharaohs found it half-buried. They put their names on it. As uplines do.

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
      next: 'older',
    },
    // ── The text changes. A different hand. A different millennium. ──
    older: {
      speaker: 'BENEATH THE INSCRIPTION  ✦  ~10,500 BC',
      text: 'WAIT.\nLOOK AT THE BODY OF THE SPHINX.\nNOT THE FACE.\nTHE BODY.',
      next: 'hydraulic',
    },
    hydraulic: {
      speaker: 'BENEATH THE INSCRIPTION  ✦  ~10,500 BC',
      text: 'THE EROSION IS HYDRAULIC.\nCUT BY RAINFALL. NOT SAND.\nNOT WIND.\nTHE LAST RAINS THAT COULD DO THIS\nFELL TEN THOUSAND YEARS BEFORE\nTHUTMOSE WAS BORN.',
      next: 'alignment',
    },
    alignment: {
      speaker: 'BENEATH THE INSCRIPTION  ✦  ~10,500 BC',
      text: 'THE SPHINX FACES EAST.\nON THE SPRING EQUINOX\nIN THE YEAR 10,500 BC,\nIT FACED THE RISING OF LEO\nPRECISELY. TO THE DEGREE.\nSOMEONE CALCULATED THIS.',
      next: 'found',
    },
    found: {
      speaker: 'BENEATH THE INSCRIPTION  ✦  ~10,500 BC',
      text: 'THE PHARAOHS DID NOT BUILD THIS.\nTHEY FOUND IT HALF-BURIED.\nTHEY CLEANED IT.\nTHEY PUT THEIR NAMES ON IT.\nAS UPLINES DO.',
      next: 'system',
    },
    system: {
      speaker: 'BENEATH THE INSCRIPTION  ✦  ~10,500 BC',
      text: 'THERE WAS A CIVILIZATION\nBEFORE THIS ONE.\nIT WAS TECHNICALLY ADVANCED.\nIT HAD A SYSTEM.\nIT BELIEVED THE SYSTEM\nWAS PERMANENT.',
      next: 'flood',
    },
    flood: {
      speaker: 'BENEATH THE INSCRIPTION  ✦  ~10,500 BC',
      text: 'THE ICE MELTED.\nSEA LEVELS ROSE 120 METRES.\nEVERYTHING COASTAL DROWNED.\nTHEY CALLED THE PLACE\nTHEY HAD COME FROM\nATLANTIS.',
      next: 'record',
    },
    record: {
      speaker: 'BENEATH THE INSCRIPTION  ✦  ~10,500 BC',
      text: 'THEY LEFT A PASSAGE\nBENEATH THE ALTAR IN THIS ROOM.\nFED BY THE SAME AQUIFER\nTHAT FEEDS THE POOL ABOVE.\nTHEY CALLED IT\nTHE HOUSE OF THE INUNDATED.',
      next: 'mirror',
    },
    mirror: {
      speaker: 'BENEATH THE INSCRIPTION  ✦  ~10,500 BC',
      text: 'THEIR CIVILIZATION ALSO\nHAD UPLINES AND DOWNLINES.\nALSO PROMISED THRONES.\nALSO HAD THREE PRINCES\nWHO DUG AND WERE NOT RECORDED.\nWE ARE THEIR DOWNLINE NOW.',
      next: 'door',
    },
    door: {
      speaker: 'BENEATH THE INSCRIPTION  ✦  ~10,500 BC',
      text: 'YOU ARE STANDING IN\nTHEIR BUILDING.\nTHE ALTAR HAS WAITED\nTEN THOUSAND YEARS\nFOR SOMEONE WHO HAS\nREAD THIS FAR.',
      onEnter: () => {
        Flags.set('stele_read', true);
        log('✦ The inscription settles in your chest like cold water.', 'hi');
        setTimeout(() => {
          log('The altar stone has shifted. Just slightly.', '');
          log('[SPACE] near the altar — it has been waiting.', '');
        }, 900);
        QuestManager.check();
      },
      next: null,
    },
  });
}

export class VaultRealm extends FlatRealm {
  constructor() {
    super('vault', 'BENEATH THE SPHINX', { floor: VAULT_FLOOR, minX: 40, maxX: 740 });
    this.px = 190;  // near the staircase entrance

    this.registry = new InteractableRegistry();

    // ── Portal exits ──────────────────────────────────────
    PortalRegistry.register({
      from: 'vault', to: 'oasis',
      key: 'ArrowUp',
      transition: vaultTransRender, duration: 1000,
    });

    // ── Dream Stele ──────────────────────────────────────
    this._stele = new NPC('stele', STELE_X, VAULT_FLOOR, 'DREAM STELE', _buildSteleDialogue());
    this._stele.interactRange = 110;
    this.registry.register(this._stele);

    // ── Altar slab ────────────────────────────────────────
    // Dormant until the stele is read.
    // Then it becomes the gate to a world that predates the pharaohs.
    this._altar = new Entity('altar', ALTAR_X, VAULT_FLOOR);
    this._altar.interactRange = 70;
    this._altar.onInteract = () => {
      if (!Flags.get('stele_read')) {
        log('A stone altar. Old stains. It is not polite to look closely.', '');
        return;
      }
      if (Flags.get('atlantis_vault_opened')) {
        log('Water breathes through the cracks. Something old is below.', '');
        return;
      }
      // ── Open the passage ─────────────────────────────
      Flags.set('atlantis_vault_opened', true);
      G.shake = 18;
      log('✦ THE ALTAR STONE GRINDS ASIDE.', 'hi');
      setTimeout(() => log('Water rises from below. Cold. Pre-diluvian.', ''), 700);
      setTimeout(() => log('The pool above is connected. It always was.', ''), 1500);
      setTimeout(() => log('✦ Return to the pool. A way in will reveal itself.', 'hi'), 2400);
      QuestManager.check();
    };
    this.registry.register(this._altar);
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
        log('[SPACE] to read the inscription.', '');
      }, 900);
    } else if (!Flags.get('atlantis_vault_opened')) {
      setTimeout(() => {
        log('The altar has shifted. It recognises you.', '');
        log('[SPACE] near the altar to open the passage.', '');
      }, 700);
    } else {
      setTimeout(() => {
        log('Water seeps through the altar stone.', '');
        log('Something breathes below. Old. Patient.', '');
      }, 700);
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
    if (PortalRegistry.handleKey(key, 'vault', null)) return true;
    if (key === ' ') return this.registry.interact();
    return false;
  }
}
