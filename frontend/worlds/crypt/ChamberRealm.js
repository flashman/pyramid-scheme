// ── FILE: worlds/crypt/ChamberRealm.js ──────────────────

import { G }                         from '../../game/state.js';
import { FlatRealm }                  from '../FlatRealm.js';
import { InteractableRegistry }       from '../../engine/interactables.js';
import { NPC }                        from '../../engine/entity.js';
import { Dialogue, DialogueManager }  from '../../engine/dialogue.js';
import { Flags, QuestManager }        from '../../engine/flags.js';
import { PortalRegistry }             from '../../engine/portal.js';
import { Events }                     from '../../engine/events.js';
import { CHAMBER_FLOOR, CHIEF_X }    from './constants.js';
import { drawChamber }                from './draw/chamber.js';
import { log }                        from '../../ui/panels.js';

function _buildChiefDialogue() {
  return new Dialogue({
    start: {
      speaker: 'SECTOR CHIEF  Ω-7',
      text: 'GREETINGS, PHARAOH.\nWE ARE THE ARCHITECTS.\n4,800 YEARS WE HAVE\nWATCHED YOUR KIND.',
      onEnter: () => Flags.set('chief_spoken', true),
      choices: [
        { label: 'Who built the pyramids?',  next: 'builders'  },
        { label: 'What is the cosmic upline?',
          next: 'upline',
          condition: () => Flags.get('seven_heavens_done') || Flags.get('ra_hierarchy_heard') },
        { label: 'I want to join.',
          next: 'offer',
          condition: () => Flags.get('seven_heavens_done') },
        { label: 'Goodbye.',                 next: null        },
      ],
    },
    builders: {
      speaker: 'SECTOR CHIEF  Ω-7',
      text: 'WE DID. YOUR ANCESTORS\nTHOUGHT THEY WERE BUILDING\nTOMBS. THEY WERE BUILDING\nRECRUIT PROCESSING NODES.',
      next: 'builders2',
    },
    builders2: {
      speaker: 'SECTOR CHIEF  Ω-7',
      text: 'EACH CAPSTONE IS AN\nANTENNA. EACH LAYER\nAMPLIFIES THE SIGNAL.\nWE RECEIVE IT. WE PROFIT.',
      next: 'start',
    },
    upline: {
      speaker: 'SECTOR CHIEF  Ω-7',
      text: 'ABOVE ME: THE COUNCIL.\nABOVE THEM: THE ARCHITECTS.\nABOVE THOSE: THE SCHEME.\nIT IS TURTLES ALL THE WAY UP.',
      onComplete: () => Flags.set('upline_explained', true),
      next: 'upline2',
    },
    upline2: {
      speaker: 'SECTOR CHIEF  Ω-7',
      text: 'EARTH IS FRANCHISE #7G.\nYOU ARE OUR TOP EARNER\nTHIS QUARTER. RELATIVELY\nSPEAKING. IT IS A LOW BAR.',
      next: 'start',
    },
    offer: {
      speaker: 'SECTOR CHIEF  Ω-7',
      text: 'YOU HAVE PROVEN YOURSELF.\nEARTH BRANCH 7G IS READY\nFOR GALACTIC EXPANSION.\nDO YOU ACCEPT THE UPLINE?',
      choices: [
        { label: 'Yes. I accept.',      next: 'accept'  },
        { label: 'What do I lose?',     next: 'cost'    },
        { label: 'Not yet.',            next: null      },
      ],
    },
    cost: {
      speaker: 'SECTOR CHIEF  Ω-7',
      text: 'ONLY YOUR CERTAINTY\nTHAT THIS IS A GAME.\nEVERYTHING ELSE STAYS.\nTHE SCHEME CONTINUES.',
      next: 'offer',
    },
    accept: {
      speaker: 'SECTOR CHIEF  Ω-7',
      text: 'EXCELLENT. YOUR FRANCHISE\nIS APPROVED. RECRUIT WORLDS.\nALWAYS 4. ALWAYS MORE.\nWELCOME TO THE UPLINE.',
      onComplete: () => {
        Flags.set('upline_accepted', true);
        Events.emit('upline_accepted', {});
        QuestManager.check();
      },
      next: null,
    },
  });
}

export class ChamberRealm extends FlatRealm {
  constructor() {
    super('chamber', 'THE CRYPT', { floor: CHAMBER_FLOOR, minX: 40, maxX: 740 });
    this.px = 120;

    this.registry = new InteractableRegistry();
    this.chief    = new NPC('chief', CHIEF_X, CHAMBER_FLOOR, 'SECTOR CHIEF Ω-7', _buildChiefDialogue());
    this.chief.interactRange = 100;
    this.registry.register(this.chief);

    // ── Portal exits ──────────────────────────────────────
    PortalRegistry.register({ from: 'chamber', to: 'world', key: 'ArrowUp' });
  }

  onEnter(fromId) {
    this.px     = 120;
    this.facing = 1;
    this.moving = false;
    this.frame  = 0;    G.shake = 6;
    Flags.set('crypt_entered', true);
    QuestManager.check();
    log('⚡ You step through the crypt door...', 'hi');
    if (!Flags.get('chief_spoken')) {
      setTimeout(() => DialogueManager.start(this.chief.dialogue), 800);
    }
  }

  onExit() { G.shake = 4; }

  update(ts) {
    if (DialogueManager.isActive()) return;
    this._walkStep(ts);
    this.registry.update(this.px, CHAMBER_FLOOR);
  }

  render() {
    drawChamber(this);
    DialogueManager.render();
  }

  onKeyDown(key) {
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if (PortalRegistry.handleKey(key, 'chamber', null)) return true;
    if (key === ' ') return this.registry.interact();
    return false;
  }
}
