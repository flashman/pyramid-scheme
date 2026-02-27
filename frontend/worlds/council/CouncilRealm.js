// ── FILE: worlds/council/CouncilRealm.js ────────────────
// The Galactic Council station — high orbit, above everything.
// The player arrives via their launched capstone and meets the
// Grand Archon, supreme administrator of the cosmic pyramid scheme.

import { G }                         from '../../game/state.js';
import { Realm, RealmManager }       from '../../engine/realm.js';
import { InteractableRegistry }      from '../../engine/interactables.js';
import { NPC }                       from '../../engine/entity.js';
import { Dialogue, DialogueManager } from '../../engine/dialogue.js';
import { Flags, QuestManager }       from '../../engine/flags.js';
import { SPEED }                     from '../constants.js';
import { CW, X, CH }                 from '../../engine/canvas.js';
import { COUNCIL_FLOOR, COUNCIL_ARCHON_X, COUNCIL_PORTAL_X } from './constants.js';
import { drawCouncil }               from './draw/council.js';
import { log }                       from '../../ui/panels.js';

function _buildArchonDialogue() {
  return new Dialogue({
    start: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'PHARAOH OF EARTH 7G.\nYOUR CAPSTONE SIGNAL\nREACHED US ACROSS 12 PARSECS.\nWE HAVE BEEN EXPECTING YOU.',
      onEnter: () => Flags.set('archon_spoken', true),
      choices: [
        { label: 'What is this place?',
          next: 'about' },
        { label: 'Who is above the Council?',
          next: 'hierarchy',
          condition: () => Flags.get('ra_hierarchy_heard') || Flags.get('nut_beyond_heard') || Flags.get('council_hierarchy_known') },
        { label: 'Tell me the truth about the Scheme.',
          next: 'scheme' },
        { label: 'I want TIER OMEGA.',
          next: 'upgrade',
          condition: () => Flags.get('cosmic_upline_done') },
        { label: 'I should not be here.',
          next: null },
      ],
    },

    about: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'THE GALACTIC COUNCIL\nADMINISTERS 847,291 PLANETS.\nEARTH IS FRANCHISE #7G.\nOUR LOWEST-TIER MEMBER.',
      next: 'about2',
    },
    about2: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: () => {
        const r = G.recruits.length;
        return `YOUR ${r} RECRUIT${r !== 1 ? 'S' : ''} GENERATED\n$${G.earned.toFixed(2)} IN PAYOUTS.\nIN GALACTIC TERMS: 0.000003%\nOF ONE SECTOR. PROMISING.`;
      },
      onComplete: () => Flags.set('council_about_known', true),
      next: 'start',
    },

    hierarchy: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'ABOVE THE COUNCIL:\nTHE ARCHITECTS.\nABOVE THEM: THE FOUNDERS.\nABOVE THOSE: WE DO NOT ASK.',
      next: 'hierarchy2',
    },
    hierarchy2: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'I ONCE INQUIRED\nWHAT WAS ABOVE THE FOUNDERS.\nMY UPLINE WENT SILENT\nFOR 40,000 YEARS.',
      onComplete: () => Flags.set('council_hierarchy_known', true),
      next: 'hierarchy3',
    },
    hierarchy3: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'WHEN THEY RESPONDED,\nTHEY SAID ONLY THIS:\n"IT IS LEVELS ALL THE WAY UP."\nI STOPPED ASKING.',
      next: 'start',
    },

    scheme: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'THE SCHEME IS OLDER\nTHAN YOUR STAR SYSTEM.\nITS ORIGIN: UNKNOWN.\nITS END: ALSO UNKNOWN.',
      next: 'scheme2',
    },
    scheme2: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'SOME BELIEVE THE UNIVERSE\nITSELF IS A PYRAMID SCHEME.\nENERGY FLOWS UPWARD.\nSOMETHING PROFITS. ALWAYS.',
      next: 'scheme3',
    },
    scheme3: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'DARK ENERGY: AN UPLINE FEE.\nGRAVITY: TRICKLE-DOWN MATH.\nTHE BIG BANG: THE ORIGINAL\nBUY-IN. $10. ENTRY LEVEL.',
      onComplete: () => Flags.set('cosmic_truth_known', true),
      next: 'start',
    },

    upgrade: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'TIER OMEGA GRANTS YOU\nONE RECRUITABLE PLANET.\nSTANDARD TERMS APPLY.\n4 SCROLLS. $10 ENTRY.',
      choices: [
        { label: 'Only one planet?',
          next: 'upgrade_low' },
        { label: 'What is my upline cut?',
          next: 'upgrade_cut' },
        { label: 'What happened to the last Earth?',
          next: 'upgrade_lore',
          condition: () => Flags.get('cosmic_truth_known') },
        { label: 'I ACCEPT TIER OMEGA.',
          next: 'accept' },
        { label: 'Not yet.',
          next: null },
      ],
    },
    upgrade_low: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'I BEGAN WITH ONE MOON.\nNOW I MANAGE 14 SECTORS.\nALL EMPIRES START SMALL.\nYOURS ALREADY DID.',
      next: 'upgrade',
    },
    upgrade_cut: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'FOR EVERY PLANET YOU\nRECRUIT: 40% FLOWS UP.\n60% STAYS IN YOUR CHAIN.\nGALACTIC STANDARD RATE.',
      next: 'upgrade',
    },
    upgrade_lore: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'THERE WAS NO PREVIOUS EARTH.\nYOU ARE THE FIRST FRANCHISE\nTHIS SOLAR SYSTEM HAS PRODUCED.\nYOU SHOULD BE PROUD.',
      next: 'upgrade_lore2',
    },
    upgrade_lore2: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'THE DINOSAURS WERE\nA FAILED RECRUITMENT DRIVE.\nYOU ARE MORE PROMISING.\nSLIGHTLY.',
      next: 'upgrade',
    },

    accept: {
      speaker: 'GRAND ARCHON  Ω-1',
      text: 'EXCELLENT.\nEARTH BRANCH 7G IS NOW\nTIER OMEGA CERTIFIED.\nWELCOME TO THE UPLINE.',
      onComplete: () => {
        Flags.set('tier_omega_accepted', true);
        QuestManager.check();
      },
      next: null,
    },
  });
}

// ── CouncilRealm ─────────────────────────────────────────
export class CouncilRealm extends Realm {
  constructor() {
    super('council', 'GALACTIC COUNCIL');
    this.px      = COUNCIL_PORTAL_X + 80;
    this.facing  = 1;
    this.frame   = 0;
    this.moving  = false;

    this.registry = new InteractableRegistry();
    this.archon   = new NPC('archon', COUNCIL_ARCHON_X, COUNCIL_FLOOR,
                            'GRAND ARCHON Ω-1', _buildArchonDialogue());
    this.archon.interactRange = 120;
    this.registry.register(this.archon);
  }

  onEnter(fromId) {
    this.px     = COUNCIL_PORTAL_X + 80;
    this.facing = 1;
    this.moving = false;
    this.frame  = 0;
    G.shake = 8;
    Flags.set('council_entered', true);
    QuestManager.check();
    log('⚡ The capstone docks. You step onto the Council station.', 'hi');
    if (!Flags.get('archon_spoken')) {
      setTimeout(() => DialogueManager.start(this.archon.dialogue), 1200);
    }
  }

  onExit() {
    G.shake = 6;
  }

  update(ts) {
    if (DialogueManager.isActive()) return;
    if (RealmManager.isTransitioning) return;

    let cdx = 0;
    if (G.keys['ArrowLeft']  || G.keys['a'] || G.keys['A']) { cdx = -SPEED; this.facing = -1; }
    if (G.keys['ArrowRight'] || G.keys['d'] || G.keys['D']) { cdx =  SPEED; this.facing =  1; }
    this.moving = cdx !== 0;
    this.px = Math.max(60, Math.min(CW - 60, this.px + cdx));

    if (this.moving && ts - G.legT > 180) { G.legT = ts; this.frame = 1 - this.frame; }
    else if (!this.moving) this.frame = 0;

    this.registry.update(this.px, COUNCIL_FLOOR);
  }

  render() {
    drawCouncil(this);
    DialogueManager.render();
  }

  onKeyDown(key) {
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if (RealmManager.isTransitioning) return false;

    if (key === 'ArrowUp') {
      // Earth return portal — left side.
      if (Math.abs(this.px - COUNCIL_PORTAL_X) < 80) {
        RealmManager.transitionTo('world');
        return true;
      }
    }
    if (key === ' ') return this.registry.interact();
    return false;
  }
}
