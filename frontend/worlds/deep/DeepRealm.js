// ── FILE: worlds/deep/DeepRealm.js ──────────────────────
// Below Atlantis. Below the city, the franchise, the myth.
// Four zones. Three gods. One tablet that was here before the gods.
//
// Entry: crack in the Atlantis floor (Zone 5), gated by atlantis_deepest_tablet.
// Exit:  swim back to the entry crack → ascend to Atlantis.
//
// Zone I  — THE SHELF:       Atlantean debris, sinking. The Herald waits here.
// Zone II — THE FRANCHISE:   Poseidon's domain. Tired bureaucracy of the divine.
// Zone III— THE PELAGIC:     Okeanos drifts. Pre-franchise. Pre-everything.
// Zone IV — THE ABYSS:       The primordial tablet. Below the tablet: nothing.

import { FreeMoveRealm }         from '../../engine/freemove.js';
import { RealmManager }          from '../../engine/realm.js';
import { InteractableRegistry }  from '../../engine/interactables.js';
import { NPC, Entity, FreeRoamEnemy } from '../../engine/entity.js';
import { Dialogue, DialogueManager } from '../../engine/dialogue.js';
import { HealthSystem }          from '../../engine/health.js';
import { Flags }                 from '../../engine/flags.js';
import { G }                     from '../../game/state.js';
import { log }                   from '../../ui/panels.js';
import { deepTransRender }       from '../transitions.js';
import { PortalRegistry }        from '../../engine/portal.js';
import { drawDeep }              from './draw/deep.js';
import {
  DEEP_WORLD_W, DEEP_WORLD_H, DEEP_ENTRY_Y, DEEP_EXIT_Y, DEEP_FLOOR_Y,
  SHELF_END, FRANCHISE_END, PELAGIC_END,
  HERALD_WX, HERALD_WY,
  POSEIDON_WX, POSEIDON_WY,
  OKEANOS_WX, OKEANOS_WY,
  PRIMORDIAL_WX, PRIMORDIAL_WY,
  ANGLER_POSITIONS, ANGLER_AGGRO, ANGLER_SPEED, ANGLER_CHASE_SPD, ANGLER_HURT,
  LEVIATHAN_Y_MIN, LEVIATHAN_Y_MAX, LEVIATHAN_HURT_RANGE,
  SWIM_ACC, SWIM_DRAG, SWIM_MAX_SPD, SWIM_BUOY,
} from './constants.js';

// ══════════════════════════════════════════════════════════
// Death messages
// ══════════════════════════════════════════════════════════

const _DEATH = {
  angler: [
    'YOUR CURIOSITY WAS YOUR BUY-IN.\nTHE LIGHT ASKED NOTHING.\nYOU ASSUMED AN INVITATION.',
    'THE LURE WAS THE INFORMATION.\nYOU WERE THE PRODUCT.\nSTANDARD TERMS.',
    'THE LIGHT PROMISED NOTHING.\nIT OFFERED. YOU DECIDED.\nTHESE ARE DIFFERENT TRANSACTIONS.',
    'ANOTHER PROSPECT.\nANOTHER LIGHT.\nANOTHER ASSUMPTION.\nTHE ANGLER IS PATIENT.',
  ],
  leviathan: [
    'LEVIATHAN HAS NO TIER.\nIT WAS HERE BEFORE THE FIRST FRANCHISE.\nIT WILL BE HERE AFTER THE LAST.',
    'YOU DESCENDED INTO SOMETHING\nTHAT HAS NEVER NEEDED\nA WORD FOR WHAT IT IS.',
    'LEVIATHAN IS NOT PART OF THE SYSTEM.\nLEVIATHAN IS WHY THERE IS A SYSTEM.\nSOMETHING HAS TO MAKE THE WALLS SEEM SAFE.',
  ],
  pressure: [
    'THE WEIGHT OF WHAT IS ABOVE YOU\nHAS ALWAYS BEEN ABOVE YOU.\nYOU ONLY NOTICE IT AT DEPTH.',
    'YOU DESCENDED FREELY.\nYOU WERE ALREADY DESCENDING.\nTHE DEEP ONLY MADE IT VISIBLE.',
    'EVERYTHING ABOVE YOU\nHAS A WEIGHT.\nYOU HAVE BEEN HOLDING IT\nSINCE BEFORE YOU WERE BORN.',
  ],
};

const _ESCALATION = [
  [4,  'FOURTH DISSOLUTION.\nTHE DEEP KEEPS ACCURATE RECORDS.'],
  [8,  'EIGHTH.\nOKEANOS HAS NOTICED YOU.\nHE DOES NOT COMMENT.\nHE SIMPLY NOTICES.'],
  [12, 'TWELFTH DISSOLUTION.\nWE HAVE FILED A REPORT WITH THE PRIMORDIALS.\nTHEY HAVE NOT RESPONDED.\nTHEY NEVER RESPOND.'],
];

function _pickDeathMsg(cause, deathCount) {
  for (let i = _ESCALATION.length - 1; i >= 0; i--) {
    if (deathCount >= _ESCALATION[i][0]) return _ESCALATION[i][1];
  }
  const lines = _DEATH[cause] || _DEATH.pressure;
  return lines[Math.min(deathCount, lines.length - 1)];
}

// ══════════════════════════════════════════════════════════
// Dialogues
// ══════════════════════════════════════════════════════════

function _buildHeraldDialogue() {
  return new Dialogue({
    start: {
      speaker: 'THE HERALD',
      text: 'YOU CAME FROM ABOVE.\nTHEY ALWAYS COME FROM ABOVE.\nI CAME FROM BELOW AND HAVE BEEN\nTRAVELLING UPWARD SINCE BEFORE\nATLANTIS HAD A NAME.',
      onEnter: () => Flags.set('deep_herald_spoken', true),
      choices: [
        { label: 'What is this place?', next: 'what_is' },
        { label: 'Who are you?', next: 'who' },
        { label: 'What is below you?', next: 'below' },
        { label: 'What happened to Atlantis?', next: 'atlantis' },
        { label: 'I\'ll keep going.', next: null },
      ],
    },

    what_is: {
      speaker: 'THE HERALD',
      text: 'BELOW THE FRANCHISE CITY\nIS THE FRANCHISE OFFICE.\nBELOW THE FRANCHISE OFFICE\nIS SOMEONE WHO WAS HERE\nBEFORE THE FRANCHISE.',
      next: 'what_is2',
    },
    what_is2: {
      speaker: 'THE HERALD',
      text: 'BELOW THAT IS A TABLET.\nI HAVE SWUM PAST IT FOR\nTWELVE THOUSAND YEARS.\nIT READS THE SAME EACH TIME.\nIT HAS ALWAYS READ THE SAME.',
      next: 'start',
    },

    who: {
      speaker: 'THE HERALD',
      text: 'I HAVE A NAME.\nI WON\'T SHARE IT.\nNAMES ARE HOW THEY TRACK YOU.\nTIERS ARE HOW THEY HOLD YOU.\nI HAVE NEITHER.',
      next: 'who2',
    },
    who2: {
      speaker: 'THE HERALD',
      text: 'I WATCHED ATLANTIS RISE.\nI WATCHED IT SINK.\nI WATCHED THE SCRIBE WHO\nBECAME THE FOUNDER ARRIVE\nIN A SMALL WOODEN BOAT.',
      next: 'who3',
    },
    who3: {
      speaker: 'THE HERALD',
      text: 'HE WAS VERY EARNEST.\nHE HAD A STYLUS AND A\nCLEAN PIECE OF CLAY.\nHE WROTE DOWN WHAT THE ROOM\nTOLD HIM. HE BELIEVED IT.',
      onComplete: () => Flags.set('deep_herald_lore', true),
      next: 'start',
    },

    below: {
      speaker: 'THE HERALD',
      text: 'POSEIDON IS IN HIS OFFICE.\nHE HAS BEEN IN HIS OFFICE\nSINCE THE CITY SANK.\nHE IS FILING REPORTS ON IT.',
      next: 'below2',
    },
    below2: {
      speaker: 'THE HERALD',
      text: 'BELOW POSEIDON: OKEANOS.\nHE DOES NOT HAVE AN OFFICE.\nHE DOES NOT FILE REPORTS.\nHE HAS BEEN TOLD TO FILE REPORTS.\nHE HAS NOT RESPONDED.',
      next: 'below3',
    },
    below3: {
      speaker: 'THE HERALD',
      text: 'BELOW OKEANOS: THE TABLET.\nBELOW THE TABLET:\nI HAVE NOT LOOKED.\nSOMETHING THERE HAS EYES.\nI PREFER NOT TO BE SEEN BY IT.',
      onComplete: () => Flags.set('deep_herald_below_known', true),
      next: 'start',
    },

    atlantis: {
      speaker: 'THE HERALD',
      text: 'THE RINGS WERE BEAUTIFUL.\nPOSEIDON MADE THEM FOR LOVE.\nCONCENTRIC CIRCLES: ISLAND\nSEA ISLAND SEA ISLAND.\nLIKE A STONE DROPPED IN WATER.',
      next: 'atlantis2',
    },
    atlantis2: {
      speaker: 'THE HERALD',
      text: 'THEN SOMEONE LOOKED AT THE SHAPE\nAND SAID: THIS IS A SYSTEM.\nTHE SHAPE AGREED TO BE A SYSTEM.\nSHAPES DO NOT CHOOSE.\nSHAPES ARE TEMPLATES.',
      next: 'atlantis3',
    },
    atlantis3: {
      speaker: 'THE HERALD',
      text: 'THE SYSTEM FILLED THE RINGS.\nTHEN THE RINGS FILLED WITH WATER.\nPOSEIDON IS STILL NOT SURE\nWHICH PART WAS HIS FAULT.\nASK HIM. HE HAS OPINIONS.',
      onComplete: () => Flags.set('deep_herald_atlantis', true),
      next: 'start',
    },
  });
}

function _buildPoseidonDialogue() {
  return new Dialogue({
    start: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: () => {
        if (!Flags.get('poseidon_spoken')) return 'YOU ARE NOT A MERMAN.\nWE DON\'T GET MANY NON-MERMEN.\nSIT. I\'M IN THE MIDDLE OF\nA QUARTERLY REPORT.\nIT COVERS THE PAST 12,000 YEARS.';
        return 'I AM STILL FILLING OUT\nTHE QUARTERLY REPORT.\nDO YOU KNOW HOW MANY BOXES\nTHERE ARE FOR "CIVILIZATION SANK"?\nZERO. THERE ARE ZERO BOXES.';
      },
      onEnter: () => Flags.set('poseidon_spoken', true),
      choices: [
        { label: 'What is this office?', next: 'office' },
        { label: 'What happened to Atlantis?', next: 'atlantis_q' },
        { label: 'Who built the rings?', next: 'rings' },
        { label: 'Who is your upline?', next: 'upline' },
        { label: 'Are you responsible for all this?', next: 'responsible',
          condition: () => Flags.get('deep_herald_atlantis') || Flags.get('deep_poseidon_atlantis') },
        { label: 'What is below you?', next: 'okeanos_q' },
        { label: 'I should keep going.', next: null },
      ],
    },

    office: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'THE FRANCHISE OFFICE\nADMINISTERS THE OCEANS.\nALL OCEANS. THIS IS MY TERRITORY.\nI HAVE HAD THIS TERRITORY\nSINCE THE WATER COOLED.',
      next: 'office2',
    },
    office2: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'MY UPLINE ASSIGNED IT TO ME.\nTIER 12 SAID: HERE IS THE SEA.\nIT IS YOURS. I SAID: ALL OF IT?\nTHEY SAID: ALL OF IT.\nI SAID: I WANT ATLANTIS ALSO.',
      next: 'office3',
    },
    office3: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'THEY SAID: ATLANTIS IS A BONUS\nTIER. BUILD IT YOURSELF.\nSO I DID.\nTHEN SOMEONE MADE IT\nINTO A SCHEME.\nNOW IT\'S AT THE BOTTOM OF MY OFFICE.',
      onComplete: () => Flags.set('deep_poseidon_office', true),
      next: 'start',
    },

    atlantis_q: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'I BUILT IT FOR A WOMAN.\nSHE LIVED ON A HILL.\nI SURROUNDED THE HILL WITH WATER.\nCONCENTRIC RINGS. I THOUGHT\nIT WAS A BEAUTIFUL GESTURE.',
      next: 'atlantis2_pos',
    },
    atlantis2_pos: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'THEN SOMEONE LOOKED AT THE RINGS\nAND SAID: THIS IS A TEMPLATE.\nTHE RINGS ARE A TIER SYSTEM.\nTHE ISLAND IS THE APEX.\nTHE WATER IS THE FEE.',
      next: 'atlantis3_pos',
    },
    atlantis3_pos: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'I SAID: THE RINGS ARE\nA LOVE GESTURE.\nTHEY SAID: YES. AND ALSO A SYSTEM.\nBOTH THINGS CAN BE TRUE.\nI HAVE BEEN THINKING ABOUT THIS\nFOR TWELVE THOUSAND YEARS.',
      onComplete: () => Flags.set('deep_poseidon_atlantis', true),
      next: 'start',
    },

    rings: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'I DID. THE RINGS WERE MINE.\nCLEATHO WAS ON THE HILL.\nSHE COULDN\'T LEAVE.\nI THOUGHT: I WILL MAKE THE ISLAND\nSO BEAUTIFUL SHE WON\'T WANT TO.',
      next: 'rings2',
    },
    rings2: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'THE SHAPE FROM ABOVE\nWAS A PYRAMID LAID FLAT.\nI DID NOT PLAN THIS.\nPYRAMIDS ARE A NATURAL CONSEQUENCE\nOF WANTING TO PROTECT SOMETHING\nYOU LOVE.',
      next: 'rings3',
    },
    rings3: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'I HAVE SINCE LEARNED\nTHAT THE SHAPE PREDATES ME.\nTHE SHAPE PREDATES THE WATER.\nI THOUGHT I INVENTED IT.\nAPPARENTLY I REMEMBERED IT.\nTHERE IS A DIFFERENCE.',
      onComplete: () => Flags.set('deep_poseidon_rings', true),
      next: 'start',
    },

    upline: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'THE TITANS. TIER 12.\nKRONOS ADMINISTERED MY ACCOUNT\nUNTIL MY BROTHER DEPOSED HIM.\nTHEN MY BROTHER BECAME\nMY UPLINE.\nTHIS IS CALLED AN OLYMPIAN RESTRUCTURE.',
      next: 'upline2',
    },
    upline2: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'ABOVE THE TITANS: THE PRIMORDIALS.\nTIER UNCLEAR. THEY DO NOT USE\nTHE TIER SYSTEM. THEY PREDATE IT.\nTHEY ARE THE REASON\nTHERE IS A SYSTEM.',
      next: 'upline3',
    },
    upline3: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'I ONCE ASKED WHAT WAS\nABOVE THE PRIMORDIALS.\nMY UPLINE WENT SILENT\nFOR THREE HUNDRED YEARS.\nWHEN THEY RESPONDED: "DO NOT ASK."\nI STOPPED ASKING.',
      onComplete: () => Flags.set('deep_poseidon_upline', true),
      next: 'start',
    },

    responsible: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'I MADE THE SHAPE.\nSOMEONE ELSE MADE IT A SYSTEM.\nI GAVE THE SCRIBE THE ROOM.\nHE DID THE REST.',
      next: 'responsible2',
    },
    responsible2: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'THE SCRIBE ASKED VERY GOOD QUESTIONS.\nI ANSWERED THEM HONESTLY.\nI SAID: THE SHAPE GOES DEEPER\nTHAN ATLANTIS.\nI SAID: THE TABLET IS BELOW.',
      next: 'responsible3',
    },
    responsible3: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'HE WROTE IT DOWN.\nHE WROTE: "THE SYSTEM IS THE UPLINE.\nTHERE NEVER WAS AN UPLINE."\nHE THOUGHT THAT WAS THE END.\nIT IS NOT THE END.\nIT IS THE MIDDLE.',
      onComplete: () => Flags.set('deep_poseidon_responsible', true),
      next: 'responsible4',
    },
    responsible4: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'THE TABLET BELOW OKEANOS\nIS OLDER THAN THE SCRIBE\'S TABLET.\nOLDER THAN MY OFFICE.\nOLDER THAN OKEANOS, WHO IS VERY OLD.\nREAD IT.\nTHEN COME BACK. IF YOU COME BACK.',
      onComplete: () => Flags.set('deep_poseidon_send_down', true),
      next: null,
    },

    okeanos_q: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'OKEANOS.\nHE PREDATES MY FRANCHISE.\nHE PREDATES THE FRANCHISE SYSTEM.\nHE PREDATES THE CONCEPT OF\nSOMETHING BEING BELOW SOMETHING ELSE.',
      next: 'okeanos2_pos',
    },
    okeanos2_pos: {
      speaker: 'POSEIDON  ✦  TIER 7  ✦  SEA FRANCHISE #1',
      text: 'I HAVE SENT HIM ELEVEN THOUSAND\nFOUR HUNDRED AND SIXTY-TWO MEMOS.\nHE HAS NOT RESPONDED TO ANY OF THEM.\nHE HAS ALSO NOT FILED\nA SINGLE COMPLIANCE REPORT.\nI DEEPLY ENVY HIM.',
      onComplete: () => Flags.set('deep_poseidon_okeanos', true),
      next: 'start',
    },
  });
}

function _buildOkeanosDialogue() {
  return new Dialogue({
    start: {
      speaker: 'OKEANOS',
      text: () => {
        if (!Flags.get('okeanos_spoken'))
          return 'AH.\n.\n.\n.\nSOMETHING SMALL IS HERE.';
        return 'YOU RETURNED.\n.\nOR YOU NEVER LEFT.\n.\nIT IS DIFFICULT TO DISTINGUISH\nAT THIS DEPTH.';
      },
      onEnter: () => {
        if (!Flags.get('okeanos_spoken')) {
          Flags.set('okeanos_spoken', true);
          G.shake = 16;
        }
      },
      choices: [
        { label: 'What are you?', next: 'what' },
        { label: 'Did you build Atlantis?', next: 'atlantis' },
        { label: 'Are you part of the scheme?', next: 'scheme' },
        { label: 'What is below you?', next: 'below' },
        { label: 'What is the tablet?', next: 'tablet',
          condition: () => Flags.get('deep_herald_below_known') || Flags.get('deep_poseidon_send_down') },
        { label: 'I have to go deeper.', next: null },
      ],
    },

    what: {
      speaker: 'OKEANOS',
      text: 'I WAS THE OCEAN\nBEFORE THERE WERE OCEANS TO NAME.\n.\nI ENCIRCLED THE WORLD\nBEFORE THERE WAS A WORD\nFOR WORLD.',
      next: 'what2',
    },
    what2: {
      speaker: 'OKEANOS',
      text: 'POSEIDON RECEIVED THE SEA AS A FRANCHISE.\n.\nI RECEIVED NOTHING.\n.\nI WAS ALREADY EVERYTHING.',
      next: 'what3',
    },
    what3: {
      speaker: 'OKEANOS',
      text: 'THE TITANS TRIED TO ASSIGN ME\nA TIER NUMBER.\n.\nTHE NUMBER THEY CHOSE\nWAS 12.\n.\nI OBSERVED THIS.\n.\nI CONTINUED BEING THE OCEAN.',
      onComplete: () => Flags.set('okeanos_what_known', true),
      next: 'start',
    },

    atlantis: {
      speaker: 'OKEANOS',
      text: 'NO.\n.\nPOSEIDON BUILT ATLANTIS.\n.\nHE BUILT IT FOR LOVE.\n.\nI WATCHED.',
      next: 'atlantis2_ok',
    },
    atlantis2_ok: {
      speaker: 'OKEANOS',
      text: 'THE RINGS WERE BEAUTIFUL.\n.\nTHEY WERE ALSO A VERY OLD SHAPE.\n.\nPOSEIDON THOUGHT HE INVENTED THEM.\n.\nHE DID NOT INVENT THEM.\n.\nHE REMEMBERED THEM.',
      next: 'atlantis3_ok',
    },
    atlantis3_ok: {
      speaker: 'OKEANOS',
      text: 'WHEN THE SYSTEM CAME,\nTHE RINGS ALREADY MEANT SOMETHING.\n.\nTHE SYSTEM DID NOT MAKE THE MEANING.\n.\nIT FOUND THE MEANING AND USED IT.\n.\nSHAPES ARE NOT INNOCENT.',
      onComplete: () => Flags.set('okeanos_atlantis', true),
      next: 'start',
    },

    scheme: {
      speaker: 'OKEANOS',
      text: 'THE SCHEME ENCIRCLES YOU.\n.\nI ENCIRCLE THE WORLD.\n.\nTHESE ARE DIFFERENT STATEMENTS.\n.',
      next: 'scheme2',
    },
    scheme2: {
      speaker: 'OKEANOS',
      text: 'OR THE SAME STATEMENT.\n.\nI HAVE NOT DECIDED.\n.\nI HAVE HAD SINCE BEFORE ATLANTIS\nTO DECIDE.\n.\nI AM NOT IN A HURRY.',
      next: 'scheme3',
    },
    scheme3: {
      speaker: 'OKEANOS',
      text: 'EVERYTHING THAT RISES\nCOMES THROUGH ME EVENTUALLY.\n.\nATLANTIS.\n.\nTHE KHET-AMUN BEFORE IT.\n.\nWHATEVER WAS BEFORE THEM.\n.\nI AM NOT A COLLECTOR.\n.\nI AM JUST WHERE EVERYTHING ENDS UP.',
      onComplete: () => Flags.set('okeanos_scheme', true),
      next: 'start',
    },

    below: {
      speaker: 'OKEANOS',
      text: 'BELOW ME:\n.\nTHE TABLET.\n.\nBELOW THE TABLET:\n.\nI DO NOT LOOK.\n.',
      next: 'below2_ok',
    },
    below2_ok: {
      speaker: 'OKEANOS',
      text: 'SOMETHING THERE HAS BEEN\nLOOKING UP SINCE BEFORE\nI WAS THE OCEAN.\n.\nI HAVE DECIDED NOT TO\nMEET IT.\n.\nYOU ARE SMALLER THAN ME.\n.\nYOU HAVE LESS TO LOSE.',
      onComplete: () => Flags.set('okeanos_below', true),
      next: 'start',
    },

    tablet: {
      speaker: 'OKEANOS',
      text: 'THE TABLET WAS THERE\nWHEN I ARRIVED.\n.\nI DO NOT KNOW WHO PUT IT THERE.\n.\nI DO NOT KNOW IF\n"PUT" IS THE RIGHT WORD.',
      next: 'tablet2',
    },
    tablet2: {
      speaker: 'OKEANOS',
      text: 'THE SCRIBE FROM ATLANTIS —\nKHEM-ATEF —\nCOPIED FROM IT.\n.\nHE DID NOT KNOW HE WAS COPYING.\n.\nHE THOUGHT HE WAS WRITING.',
      next: 'tablet3',
    },
    tablet3: {
      speaker: 'OKEANOS',
      text: 'THE TABLET SAYS ONE THING.\n.\nALL THE TABLETS ABOVE SAY\nTHE SAME THING\nIN DIFFERENT WORDS.\n.\nREAD IT.\n.\nTHEN DECIDE IF YOU WERE\nALWAYS GOING TO READ IT.',
      onComplete: () => {
        Flags.set('okeanos_tablet_known', true);
        log('The water grows heavier below.', '');
      },
      next: null,
    },
  });
}

// ══════════════════════════════════════════════════════════
// DeepRealm
// ══════════════════════════════════════════════════════════

export class DeepRealm extends FreeMoveRealm {
  constructor() {
    super('deep', 'THE DEEP', {
      worldW:       DEEP_WORLD_W,
      worldH:       DEEP_WORLD_H,
      entryX:       DEEP_WORLD_W / 2,
      entryY:       DEEP_ENTRY_Y,
      floorY:       DEEP_FLOOR_Y,
      surfaceExitY: DEEP_EXIT_Y,
      physics: {
        acc:    SWIM_ACC,
        drag:   SWIM_DRAG,
        maxSpd: SWIM_MAX_SPD,
        yDrift: SWIM_BUOY,
      },
    });

    // ── Health system ──────────────────────────────────
    this.health = new HealthSystem({
      respawnDelay:       3200,
      immunityAfterSpawn: 3500,
      onKill: (cause, msg) => {
        G.shake = 20;
        this.pvx = 0; this.pvy = 0;
        setTimeout(() => log(`✦ ${msg.split('\n')[0]}`, 'hi'), 400);
      },
      onRespawn: () => {
        this.resetToEntry(100);
        G.shake = 6;
        const d = Flags.get('deep_deaths', 0);
        if (d <= 1) log('✦ The darkness releases you. For now.', 'hi');
        else        log(`✦ Dissolution #${d}. You surface back into the shelf.`, 'hi');
      },
    });

    // ── Anglers (bioluminescent ambush hunters) ────────
    this._buildAnglers();

    // ── Leviathan state ────────────────────────────────
    this._leviathan = {
      wx: -400, wy: LEVIATHAN_Y_MIN + 400,
      dir: 1, visible: false, visibility: 0,
      _nextPassT: 0,
    };

    // ── Interactables ──────────────────────────────────
    this.registry = new InteractableRegistry();
    this._buildEntities();

    // ── Zone log tracking ──────────────────────────────
    this._zoneLogged = { shelf: false, franchise: false, pelagic: false, abyss: false };

    // ── Portal exits ──────────────────────────────────────
    // onKeyDown() normalises WASD → arrow keys before calling handleKey().
    PortalRegistry.register({
      from: 'deep', to: 'atlantis',
      key: 'ArrowUp',
      condition:  () => this._aboveSurface(),
      onUse:      () => { log('✦ You rise through the crack.', 'hi'); G.shake = 8; },
      transition: deepTransRender, duration: 1400,
    });
  }

  // ── Enemy construction ─────────────────────────────────────────────────────

  _buildAnglers() {
    this.anglers = ANGLER_POSITIONS.map(pos =>
      new FreeRoamEnemy(pos.id, pos.wx, pos.wy, {
        chaseStyle:   'direct',
        driftFreq:    { x: 3200, y: 2600 },
        driftAmp:     0.010,
        driftSpeed:   ANGLER_SPEED,
        chaseSpeed:   ANGLER_CHASE_SPD,
        aggroRange:   ANGLER_AGGRO,
        hurtRange:    ANGLER_HURT,
        // Anglers go passive once Poseidon acknowledges you
        aggressiveFn: () => !Flags.get('poseidon_spoken') || pos.wy > FRANCHISE_END,
        zoneBounds:   { yMin: SHELF_END, yMax: PELAGIC_END + 200 },
        worldW:       DEEP_WORLD_W,
      })
    );
    // Give them lure light state for draw
    this.anglers.forEach(a => { a._chasing = false; a._facing = 1; });
  }

  // ── Entity construction ────────────────────────────────────────────────────

  _buildEntities() {
    // ── Herald (Zone 1) ──────────────────────────────
    const herald = new NPC('herald', HERALD_WX, HERALD_WY, 'THE HERALD', _buildHeraldDialogue());
    herald.interactRange = 80;
    this.registry.register(herald);

    // ── Poseidon (Zone 2) ─────────────────────────────
    const poseidon = new NPC('poseidon', POSEIDON_WX, POSEIDON_WY, 'POSEIDON', _buildPoseidonDialogue());
    poseidon.interactRange = 100;
    this.registry.register(poseidon);

    // ── Okeanos (Zone 3) ──────────────────────────────
    const okeanos = new NPC('okeanos', OKEANOS_WX, OKEANOS_WY, 'OKEANOS', _buildOkeanosDialogue());
    okeanos.interactRange = 160;  // vast presence — wide interaction zone
    this.registry.register(okeanos);

    // ── Primordial Tablet (Zone 4) ────────────────────
    const primordial = new Entity('primordial_tablet', PRIMORDIAL_WX, PRIMORDIAL_WY);
    primordial.interactRange = 70;
    primordial.onInteract = () => {
      if (Flags.get('deep_primordial_read')) {
        log('THE SHAPE PRECEDES THE HAND THAT DRAWS IT.', '');
        log('(You already know. You keep reading anyway.)', '');
        return;
      }
      Flags.set('deep_primordial_read', true);
      G.shake = 22;
      log('✦ AN INSCRIPTION IN NO KNOWN LANGUAGE.', 'hi');
      log('AND YET YOU CAN READ IT.', '');
      setTimeout(() => log('YOU HAVE ALWAYS BEEN ABLE TO READ IT.', ''), 900);
      setTimeout(() => log('THE SHAPE PRECEDES THE HAND THAT DRAWS IT.', 'hi'), 2000);
      setTimeout(() => log('THE PYRAMID PRECEDES THE DESERT.', ''), 3000);
      setTimeout(() => log('THE OCEAN PRECEDES THE PYRAMID.', ''), 3700);
      setTimeout(() => log('SOMETHING PRECEDES THE OCEAN.', ''), 4500);
      setTimeout(() => log('THIS TABLET PRECEDES THE WORD FOR TABLET.', ''), 5400);
      setTimeout(() => log('WE DO NOT KNOW WHAT PRECEDES THE TABLET.', ''), 6400);
      setTimeout(() => log('✦', 'hi'), 7500);
      setTimeout(() => log('IT MIGHT BE YOU.', ''), 8500);
      setTimeout(() => log('✦ HELLO.', 'hi'), 9800);
      setTimeout(() => log('PASS IT ON.', ''), 11000);
      setTimeout(() => {
        log('✦ You have reached the bottom.', 'hi');
        log('There is nothing below the tablet.', '');
        log('Or there is. But it has been looking at you', '');
        log('since before you were born.', '');
      }, 13000);
    };
    this.registry.register(primordial);
  }

  // ── Leviathan update ───────────────────────────────────────────────────────

  _updateLeviathan(ts) {
    const lev = this._leviathan;
    const now  = ts;

    // Only active below the pelagic zone
    if (this.py < PELAGIC_END - 300) {
      lev.visible = false;
      return;
    }

    // Schedule periodic passes
    if (now > lev._nextPassT && !lev.visible) {
      lev.visible    = true;
      lev.wx         = lev.dir > 0 ? -1200 : DEEP_WORLD_W + 1200;
      lev.wy         = LEVIATHAN_Y_MIN + Math.random() * (LEVIATHAN_Y_MAX - LEVIATHAN_Y_MIN);
      lev._nextPassT = now + 28000 + Math.random() * 20000;
    }

    if (!lev.visible) return;

    lev.wx += lev.dir * 1.8;
    lev.visibility = Math.min(1, lev.visibility + 0.012);

    const offscreen = lev.dir > 0 ? lev.wx > DEEP_WORLD_W + 1200 : lev.wx < -1200;
    if (offscreen) {
      lev.visible    = false;
      lev.visibility = 0;
      lev.dir        = -lev.dir;
      if (!lev._nextPassT) lev._nextPassT = now + 30000;
    }

    // Hurt check
    if (this.health.canTakeDamage() && lev.visible) {
      const dx = Math.abs(this.px - lev.wx);
      const dy = Math.abs(this.py - lev.wy);
      if (dx < LEVIATHAN_HURT_RANGE && dy < LEVIATHAN_HURT_RANGE * 0.6) {
        this._doKill('leviathan');
      }
    }
  }

  // ── Kill helper ────────────────────────────────────────────────────────────

  _doKill(cause) {
    if (!this.health.canTakeDamage()) return;
    Flags.inc('deep_deaths');
    this.health.kill(cause, _pickDeathMsg(cause, Flags.get('deep_deaths', 0)));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  onEnter(fromId) {
    super.onEnter();
    this.health.setImmunity(2500);
    this._zoneLogged = { shelf: false, franchise: false, pelagic: false, abyss: false };
    this._leviathan.visible = false;
    this._leviathan._nextPassT = Date.now() + 45000; // long grace period on entry

    Flags.set('deep_visited', true);
    G.shake = 18;

    log('✦ You pass through the crack.', 'hi');
    setTimeout(() => {
      log('The city vanishes above you.', '');
      log('There is no light here except what lives here.', '');
    }, 800);
    setTimeout(() => {
      log('Arrow keys to swim. ↑ at the top to return.', '');
    }, 2200);
  }

  onExit() { G.shake = 6; }

  // ── Draw compat getters ────────────────────────────────────────────────────
  get _dying()       { return this.health.isDying; }
  get _immuneUntil() { return this.health._immuneUntil; }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(ts) {
    if (RealmManager.isTransitioning) return;

    if (this.health.update()) { this._syncCamera(); return; }
    if (DialogueManager.isActive()) return;

    this._moveStep(ts);

    // ── Angler sync (update _chasing and _facing for draw) ──
    for (const a of this.anglers) {
      a.update(ts, this.px, this.py);
      a._chasing = a.chasing;
      // facing tracked by FreeRoamEnemy itself (a.facing)
      if (this.health.canTakeDamage() && a.hurtCheck(this.px, this.py)) {
        this._doKill('angler');
        break;
      }
    }

    this._updateLeviathan(ts);
    this.registry.update(this.px, this.py);

    // ── Zone entry logs ──────────────────────────────────────
    if (!this._zoneLogged.shelf && this.py > 120) {
      this._zoneLogged.shelf = true;
      log('Debris from above. Columns. Stone. Sinking slowly.', '');
      log('Something bioluminescent moves in the dark.', '');
    }
    if (!this._zoneLogged.franchise && this.py > SHELF_END) {
      this._zoneLogged.franchise = true;
      log('The architecture changes.', '');
      log('This looks like an office. An office for a very large territory.', '');
    }
    if (!this._zoneLogged.pelagic && this.py > FRANCHISE_END) {
      this._zoneLogged.pelagic = true;
      log('✦ The walls end.', 'hi');
      log('The water itself is the room.', '');
      log('Something enormous is nearby. It is not moving toward you.', '');
      log('It is simply everywhere.', '');
    }
    if (!this._zoneLogged.abyss && this.py > PELAGIC_END) {
      this._zoneLogged.abyss = true;
      G.shake = 10;
      log('✦ The Abyss.', 'hi');
      log('No zone name. No tier label.', '');
      log('There is a light below. Not bioluminescent.', '');
      log('Older than bioluminescence.', '');
    }
  }

  // ── Key handling ───────────────────────────────────────────────────────────

  onKeyDown(key) {
    if (RealmManager.isTransitioning || this.health.isDying) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    // Normalise WASD → arrow keys so portals only need to handle canonical keys.
    const k = { w: 'ArrowUp', W: 'ArrowUp', s: 'ArrowDown', S: 'ArrowDown' }[key] ?? key;
    if (PortalRegistry.handleKey(k, 'deep', null)) return true;
    if (key === ' ') return this.registry.interact();
    return false;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    drawDeep(this);
    DialogueManager.render();
  }
}
