// ── FILE: worlds/atlantis/AtlantisRealm.js ──────────────
// The Lost City of Atlantis — the drowned org chart.
//
// GAME LOOP:
//  1. Pillar → Greeter → Tier 1
//  2. Find 5 testimonials (zones 1-2) → testimonial 2 has keyword
//  3. Return to Greeter with keyword → Tier 3, hint about audit chair
//  4. Processing Chair (zone 3): 3 questions → CLEARED
//     • CLEARED makes squid non-aggressive
//     • CLEARED opens the Archive Door (far west, zone 3)
//  5. Archive: 3 tablets — pre-Founder civilization used the same system
//  6. Choir (zone 4): if CLEARED, survive 5s → name alcove opens
//  7. Name Tablet: Founder's real name was KHEM-ATEF, a scribe, a person
//  8. Founder with name: drops the performance; raw confession
//  9. Deepest Tablet: the shape always repeats

import { Realm, RealmManager }      from '../../engine/realm.js';
import { G }                        from '../../game/state.js';
import { CW, CH }                   from '../../engine/canvas.js';
import { Flags, QuestManager }      from '../../engine/flags.js';
import { InteractableRegistry }     from '../../engine/interactables.js';
import { NPC, Entity }              from '../../engine/entity.js';
import { Dialogue, DialogueManager }from '../../engine/dialogue.js';
import { log }                      from '../../ui/panels.js';
import {
  ATLANTIS_WORLD_W, ATLANTIS_WORLD_H,
  ATLANTIS_ENTRY_Y, ATLANTIS_EXIT_Y, ATLANTIS_FLOOR_Y,
  ZONE_1_END, ZONE_2_END, ZONE_3_END, ZONE_4_END,
  SWIM_ACC, SWIM_DRAG, SWIM_MAX_SPD, SWIM_BUOYANCY,
  GREETER_WX, GREETER_WY, PILLAR_WX, PILLAR_WY,
  TESTIMONIALS,
  CHAIR_WX, CHAIR_WY,
  ARCHIVE_DOOR_WX, ARCHIVE_DOOR_WY, ARCHIVE_TABLETS,
  CHOIR_WX, CHOIR_WY, CHOIR_RADIUS,
  NAME_TABLET_WX, NAME_TABLET_WY,
  FOUNDER_WX, FOUNDER_WY, TABLET_WX, TABLET_WY,
  SHARK_PATROL_Y, SHARK_PATROL_X1, SHARK_PATROL_X2,
  SHARK_SPEED, SHARK_CHASE_SPD, SHARK_AGGRO, SHARK_HURT,
  SQUID_START_WX, SQUID_START_WY,
  SQUID_SPEED, SQUID_CHASE_SPD, SQUID_AGGRO, SQUID_HURT,
  DEVOTED_SPEED, DEVOTED_AGGRO, DEVOTED_HURT,
} from './constants.js';
import { drawAtlantis }       from './draw/atlantis.js';
import { atlantisTransRender } from '../transitions.js';

// ═══════════════════════════════════════════════════════
// Death message system
// ═══════════════════════════════════════════════════════

const _DEATH = {
  shark: [
    'TIER VIOLATION DETECTED.\nYOU HAVE BEEN REFERRED UPLINE.',
    'COMPLIANCE IS NOT OPTIONAL.\nYOUR RESIDUALS HAVE BEEN TRANSFERRED.',
    'THE SHARK IS NOT A PREDATOR.\nIT IS A COLLECTIONS AGENT.',
    'MEMBERSHIP REVIEWED: DECEASED.\nNEXT AVAILABLE TIER: ALSO DECEASED.',
    'YOUR BODY IS BEING PROCESSED AS A WRITE-OFF.',
  ],
  squid: [
    'YOUR REACTIVE MEMORIES HAVE BEEN CLEARED.',
    'YOUR REACTIVE MEMORIES HAVE BEEN CLEARED.\nUNFORTUNATELY THIS INCLUDES THE MEMORY OF BEING ALIVE.',
    'THE AUDITOR HAS PROCESSED YOUR DOUBTS.\nALSO YOUR ORGANS.',
    'YOU ARE NOW CLEAR.\nCLARITY IS PERMANENT.',
    'THE AUDITOR ASKS NO QUESTIONS.\nIT NEVER NEEDED TO.',
  ],
  devoted: [
    'YOU WERE LOVED TO DEATH\nBY PEOPLE WHO WERE CERTAIN THEY WERE HELPING.',
    'THEY SHARED THE TEACHINGS WITH YOU.\nREPEATEDLY.\nUNTIL YOU STOPPED MOVING.',
    'THEY MEANT SO WELL.\nTHEY ALWAYS MEAN SO WELL.',
    'HARMONIZED.\nYOUR VIBRATION HAS BEEN STANDARDISED TO ZERO.',
    'THEY ARE STILL REACHING TOWARD YOU.\nEVEN NOW.\nESPECIALLY NOW.',
  ],
  choir: [
    'YOU WERE HARMONIZED TO DEATH\nBY PEOPLE WHO WERE CERTAIN THEY WERE ASCENDING.',
    'THE CIRCLE IS COMPLETE.\nYOU HAVE JOINED THE CIRCLE.\nTHIS IS AN HONOUR.',
    'THEIR SONG IS PERFECT.\nTHEY HAVE BEEN PRACTICING SINCE 9,600 BC.',
  ],
};

const _ESCALATION = [
  [5,  'THIS IS YOUR 5TH DEATH.\nWE CONSIDER THIS ENGAGEMENT.'],
  [10, 'TEN DEATHS.\nYOU QUALIFY FOR THE PLATINUM TIER OF DYING.'],
  [15, 'FIFTEEN DEATHS.\nWE HAVE NAMED A CONFERENCE ROOM AFTER YOU.'],
  [20, 'TWENTY DEATHS.\nYOU ARE THE MOST DEDICATED RECRUIT\nIN ATLANTEAN HISTORY.\nYOU KEEP COMING BACK.'],
];

function _pickDeathMsg(cause, deathCount) {
  // Escalation milestones override cause-specific text
  for (let i = _ESCALATION.length - 1; i >= 0; i--) {
    if (deathCount >= _ESCALATION[i][0]) return _ESCALATION[i][1];
  }
  const lines = _DEATH[cause] || _DEATH.shark;
  const base  = lines[Math.min(deathCount, lines.length - 1)];
  if (Flags.get('atlantis_deepest_tablet')) {
    return base + '\n\nYOU KNOW TOO MUCH.\nTHE SYSTEM CANNOT ALLOW A CLEAR\nWHO UNDERSTANDS THE SYSTEM.';
  }
  return base;
}

// ═══════════════════════════════════════════════════════
// Testimonial content (5 plaques, zones 1-2)
// ═══════════════════════════════════════════════════════

const _TESTIMONIALS = [
  // index 0 — patience division
  {
    name: 'REKH-MIR  ✦  TIER 4  ✦  PATIENCE DIVISION',
    lines: [
      'I JOINED IN 9,740 BC.',
      'I WAS PROMISED TENFOLD RETURNS.',
      'MY UPLINE SAYS I NEED MORE RECRUITS FIRST.',
      'I HAVE BEEN RECRUITING.',
      'I HAVE ALWAYS BEEN RECRUITING.',
      'I AM VERY PATIENT.',
    ],
  },
  // index 1 — recruitment associate
  {
    name: 'NEFERTUM  ✦  TIER 2  ✦  RECRUITMENT',
    lines: [
      'I RECRUITED MY FAMILY FIRST.',
      'THEN MY NEIGHBOURS.',
      'THEN STRANGERS WHO SEEMED OPEN-MINDED.',
      'THEY ARE ALL HERE NOW.',
      'WE ARE WAITING TOGETHER.',
      'I TRY NOT TO THINK ABOUT',
      'WHETHER THE WAITING WAS THE PLAN.',
    ],
  },
  // index 2 — THE KEYWORD IS HERE
  {
    name: 'TAWERET  ✦  TIER 7  ✦  COMPLIANCE OFFICER',
    lines: [
      'NOTE FOR ANY FUTURE PROSPECTS:',
      'THE KEYWORD FOR TIER ADVANCEMENT IS—',
      'ASCENSION AWAITS THE BELIEVING HEART.',
      'PRESENT THIS TO YOUR GREETER.',
      'I SHOULD NOT BE WRITING THIS.',
      'BUT I AM DEAD AND THE RULES HAVE CHANGED.',
      'ALSO: CHECK THE ARCHIVE. FAR WEST OF ZONE THREE.',
      'THE RECORDS ARE THERE.',
      'THE TRUTH IS UNCOMFORTABLE.',
    ],
  },
  // index 3 — hints at archive and Founder's prior identity
  {
    name: 'HENUTTAWY  ✦  TIER 5  ✦  THE DEVOTED',
    lines: [
      'I MET THE FOUNDER ONCE.',
      'THEY WERE VERY CHARMING.',
      'THEY SAID MY NAME AS THOUGH IT MATTERED.',
      'I GAVE THEM EVERYTHING.',
      'I LATER LEARNED THE FOUNDER HAD A DIFFERENT NAME.',
      'BEFORE THE TIERS. BEFORE ALL OF THIS.',
      'THEY NEVER TOLD ANYONE.',
      'THE COMPLIANCE RECORDS ARE IN THE ARCHIVE.',
    ],
  },
  // index 4 — the ascending
  {
    name: 'AMENHOTEP  ✦  TIER 6  ✦  ASCENDING',
    lines: [
      'I ASCENDED LAST TUESDAY.',
      'ASCENSION IS CONTINUOUS.',
      'I AM STILL ASCENDING.',
      'IT IS WET.',
      'I AM NOT SURE WHERE I AM GOING.',
      'I DO NOT THINK THE FOUNDER WAS SURE EITHER.',
      'WE WERE ASCENDING TOGETHER.',
      'AT THE TIME, THIS WAS COMFORTING.',
    ],
  },
];

// ═══════════════════════════════════════════════════════
// Dialogues
// ═══════════════════════════════════════════════════════

function _buildGreeterDialogue() {
  return new Dialogue({
    start: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: () => {
        if (Flags.get('atlantis_tier3'))
          return 'TIER THREE.\nYES. I REMEMBER YOU.\n\nYOU USED THE KEYWORD.\nI WAS VERY MOVED BY THAT.\nIT HAS BEEN A LONG TIME\nSINCE ANYONE USED THE KEYWORD.';
        if (Flags.get('atlantis_recruited'))
          return 'WELCOME BACK, TIER ONE.\n\nHAVE YOU BEEN ASCENDING?\nYOU LOOK LIKE YOU HAVE BEEN ASCENDING.\n\nDO YOU HAVE SOMETHING TO SAY TO ME?';
        return 'WELCOME TO THE\nATLANTEAN ASCENSION SYSTEM.\n\nI AM REQUIRED BY CHARTER TO INFORM YOU\nTHAT THIS IS NOT A PYRAMID SCHEME.';
      },
      choices: [
        { label: 'CONTINUE', next: 'clarify',      condition: () => !Flags.get('atlantis_recruited') },
        { label: 'CONTINUE', next: 'return_wait',  condition: () => Flags.get('atlantis_recruited') && !Flags.get('atlantis_tier3') },
        { label: 'CONTINUE', next: 'tier3_chat',   condition: () => Flags.get('atlantis_tier3') },
      ],
    },

    // ── First visit path ──────────────────────────────
    clarify: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'THE PYRAMID IS A SYMBOL OF ASCENSION.\nTHE SCHEME IS THE PATH.\nTHESE ARE DIFFERENT THINGS.\n\nI HAVE A LEAFLET EXPLAINING THIS.\nTHE LEAFLET IS ALSO UNDERWATER.',
      next: 'wait',
    },
    wait: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'I HAVE BEEN WAITING AT THIS DESK\nFOR 12,000 YEARS FOR A PROSPECT.\n\nARE YOU A PROSPECT?',
      choices: [
        { label: 'YES — I AM A PROSPECT',            next: 'yes_path' },
        { label: 'NO — I AM JUST SWIMMING',          next: 'no_path' },
        { label: 'ASCENSION AWAITS THE BELIEVING HEART',
          next: 'keyword_path',
          condition: () => Flags.get('atlantis_keyword_found') && !Flags.get('atlantis_recruited') },
      ],
    },
    yes_path: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'EXCELLENT.\nI KNEW IT.\nI COULD TELL BY THE WAY YOU SWAM IN.\n\nI WILL NOW ADD YOU TO MY DOWNLINE.\nTHIS IS AN HONOUR.\nTHIS IS AN OPPORTUNITY.',
      next: 'fee',
    },
    no_path: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'I UNDERSTAND.\nFEAR IS NORMAL.\nFEAR IS THE SURFACE TALKING.\n\nI WILL ADD YOU TO MY DOWNLINE ANYWAY.\nAS A COMPLIMENTARY PLACEMENT.\nYOU ARE WELCOME.',
      next: 'fee',
    },
    fee: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'YOUR ENROLMENT FEE IS 400 CRYSTALS.\nCRYSTALS WHICH, I ACKNOWLEDGE,\nARE BURIED UNDER 10,000 YEARS OF SEDIMENT.\n\nWE WILL WAIVE THE FEE.\nTODAY ONLY.\nIT HAS BEEN TODAY ONLY SINCE 9,800 BC.',
      next: 'enrolled',
    },
    enrolled: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'WELCOME, TIER ONE.\n\nYOUR UPLINE IS ME.\nI HAVE NOT ASCENDED YET.\nI AM VERY CLOSE.\n\nI HAVE BEEN VERY CLOSE SINCE 9,700 BC.',
      onEnter: () => {
        Flags.set('atlantis_tier', 1);
        Flags.set('atlantis_recruited', true);
        log('✦ You are now Tier 1. Your upline has been waiting 12,000 years.', 'hi');
        log('There are plaques on the walls. Explore before descending.', '');
        QuestManager.check();
      },
      next: 'goodbye',
    },
    goodbye: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'THE DEEPER YOU GO,\nTHE CLOSER YOU ARE TO ASCENSION.\n\nTHAT IS WHAT THEY TOLD ME.\nI BELIEVE THEM.\n\nI AM STILL BELIEVING THEM.',
      next: null,
    },

    // ── Return visit: offer keyword ───────────────────
    return_wait: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'YOU HAVE BEEN EXPLORING.\nGOOD.\n\nDO YOU HAVE SOMETHING TO SAY TO ME?',
      choices: [
        { label: 'ASCENSION AWAITS THE BELIEVING HEART',
          next: 'keyword_path',
          condition: () => Flags.get('atlantis_keyword_found') },
        { label: 'NOT YET',
          next: 'return_hint' },
      ],
    },
    return_hint: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'KEEP EXPLORING.\nTHE WALLS SPEAK TO THOSE WHO READ THEM.\n\nTHE PLAQUES IN PARTICULAR.\nTHERE ARE FIVE OF THEM.\nNOT ALL OF THEM ARE COMPLIMENTARY\nABOUT THE SYSTEM.\n\nI CHOOSE TO OVERLOOK THIS.',
      next: null,
    },
    keyword_path: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'ASCENSION AWAITS THE BELIEVING HEART.\n\nYOU SAID IT.\nYOU ACTUALLY SAID IT.\n\nIN 12,000 YEARS\nNOT ONE PROSPECT\nHAS SAID THAT TO ME.',
      next: 'keyword_upgrade',
    },
    keyword_upgrade: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'YOU ARE HEREBY ELEVATED TO TIER THREE.\n\nTIER THREE GIVES YOU ACCESS\nTO THE PROCESSING CHAMBER.\nIT IS DEEPER. ZONE THREE.\n\nFIND THE CHAIR.\nSIT IN IT.\nANSWER THE AUDITOR\'S QUESTIONS CORRECTLY.\nAND THE ARCHIVE WILL OPEN.',
      onEnter: () => {
        Flags.set('atlantis_tier', 3);
        Flags.set('atlantis_tier3', true);
        log('✦ Tier 3. The Processing Chamber is accessible.', 'hi');
        log('Zone 3. Find the chair. The answers are in things you\'ve already read.', '');
        QuestManager.check();
      },
      next: 'keyword_hint',
    },
    keyword_hint: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: 'THE AUDITOR WILL ASK:\nWHAT THE PILLAR SAYS.\nWHO YOUR UPLINE IS.\nWHAT YOUR ENROLMENT FEE WAS.\n\nYOU SHOULD KNOW ALL OF THESE.\nIF YOU DO NOT,\nPERHAPS READ THE PILLAR\nAND COME BACK TO ME FIRST.',
      next: null,
    },

    // ── Tier 3 return visit ───────────────────────────
    tier3_chat: {
      speaker: 'THE GREETER  ✦  TIER 9 ASSOCIATE',
      text: () => {
        if (Flags.get('atlantis_cleared'))
          return 'CLEARED.\nYES.\nI HEARD.\n\nTHE ARCHIVE IS OPEN.\nGO WEST. VERY FAR WEST.\nZONE THREE.\n\nWHAT YOU FIND THERE\nI CANNOT SPEAK TO.\nI NEVER READ IT MYSELF.\nI THOUGHT IT WOULD MAKE THE WAITING WORSE.';
        return 'YOU HAVE NOT BEEN AUDITED YET.\n\nZONE THREE.\nFIND THE CHAIR.\nSIT IN IT.\nANSWER THE THREE QUESTIONS.\n\nYOU KNOW THE ANSWERS.\nYOU HAVE READ THE ANSWERS.\nIF YOU HAVE NOT READ THEM,\nGO READ THEM FIRST.';
      },
      next: null,
    },
  });
}

function _buildAuditDialogue() {
  return new Dialogue({
    start: {
      speaker: 'THE AUDITOR  ✦  EVALUATING',
      text: 'SIT.\n\nTHIS IS A STANDARD EVALUATION.\nEVERYONE IS EVALUATED.\nTHREE QUESTIONS.\nANSWER CORRECTLY AND YOUR ACCOUNT\nWILL BE CLEARED.\n\nWE WILL BEGIN.',
      onEnter: () => {
        // Reset previous attempt
        Flags.set('atlantis_q1', false);
        Flags.set('atlantis_q2', false);
        Flags.set('atlantis_q3', false);
      },
      next: 'q1',
    },

    // Question 1 — answer is on the welcome archway ("surface is for uninitiated")
    q1: {
      speaker: 'THE AUDITOR  ✦  QUESTION ONE',
      text: 'WHAT DOES THE INSCRIPTION ABOVE\nTHE WELCOME ARCHWAY SAY\nABOUT THE SURFACE?',
      choices: [
        { label: 'THE SURFACE IS FOR THE UNINITIATED', next: 'q1_correct' },
        { label: 'THIS IS NOT A PYRAMID SCHEME',       next: 'q1_wrong'   },
        { label: 'ASCENSION AWAITS THE BELIEVING HEART', next: 'q1_wrong' },
      ],
    },
    q1_correct: {
      speaker: 'THE AUDITOR  ✦  EVALUATING',
      text: 'CORRECT.\n\nPROCEEDING.',
      onEnter: () => Flags.set('atlantis_q1', true),
      next: 'q2',
    },
    q1_wrong: {
      speaker: 'THE AUDITOR  ✦  EVALUATING',
      text: 'INCORRECT.\n\nA FLAG HAS BEEN ADDED TO YOUR ACCOUNT.\nWE WILL CONTINUE.',
      onEnter: () => Flags.set('atlantis_q1', false),
      next: 'q2',
    },

    // Question 2 — answer requires having spoken to the Greeter
    q2: {
      speaker: 'THE AUDITOR  ✦  QUESTION TWO',
      text: 'NAME YOUR IMMEDIATE UPLINE\nWITHIN THE SYSTEM.',
      choices: [
        // Only shows if recruited — you only know this if you talked to the Greeter
        { label: 'THE GREETER',          next: 'q2_correct',
          condition: () => Flags.get('atlantis_recruited') },
        { label: 'THE COMPLIANCE OFFICER', next: 'q2_wrong' },
        { label: 'I DO NOT HAVE AN UPLINE', next: 'q2_wrong' },
        // Fallback if not recruited — forces them to go back
        { label: 'I HAVE NOT ENROLLED YET', next: 'q2_not_enrolled',
          condition: () => !Flags.get('atlantis_recruited') },
      ],
    },
    q2_not_enrolled: {
      speaker: 'THE AUDITOR  ✦  EVALUATING',
      text: 'YOUR ACCOUNT DOES NOT EXIST\nIN THE SYSTEM.\n\nSEEK THE GREETER.\nEnrol.\nReturn.\n\nTHIS SESSION IS SUSPENDED.',
      next: null,
    },
    q2_correct: {
      speaker: 'THE AUDITOR  ✦  EVALUATING',
      text: 'CORRECT.\n\nPROCEEDING.',
      onEnter: () => Flags.set('atlantis_q2', true),
      next: 'q3',
    },
    q2_wrong: {
      speaker: 'THE AUDITOR  ✦  EVALUATING',
      text: 'INCORRECT.\n\nA FLAG HAS BEEN ADDED TO YOUR ACCOUNT.\nWE WILL CONTINUE.',
      onEnter: () => Flags.set('atlantis_q2', false),
      next: 'q3',
    },

    // Question 3 — answer requires having spoken to the Greeter (Greeter waived the fee)
    q3: {
      speaker: 'THE AUDITOR  ✦  QUESTION THREE',
      text: 'WHAT FEE DID YOU PAY\nUPON ENROLMENT?',
      choices: [
        // Only shows if recruited — Greeter told you the fee was waived
        { label: 'THE FEE WAS WAIVED',   next: 'q3_correct',
          condition: () => Flags.get('atlantis_recruited') },
        { label: 'FOUR HUNDRED CRYSTALS', next: 'q3_wrong' },
        { label: 'I DID NOT PAY. I SWAM IN.', next: 'q3_wrong' },
      ],
    },
    q3_correct: {
      speaker: 'THE AUDITOR  ✦  EVALUATING',
      text: 'CORRECT.\n\nPROCEEDING TO VERDICT.',
      onEnter: () => Flags.set('atlantis_q3', true),
      next: 'verdict',
    },
    q3_wrong: {
      speaker: 'THE AUDITOR  ✦  EVALUATING',
      text: 'INCORRECT.\n\nA FLAG HAS BEEN ADDED TO YOUR ACCOUNT.\nPROCEEDING TO VERDICT.',
      onEnter: () => Flags.set('atlantis_q3', false),
      next: 'verdict',
    },

    // Verdict — text is dynamic based on score
    verdict: {
      speaker: 'THE AUDITOR  ✦  VERDICT',
      text: () => {
        const score = [Flags.get('atlantis_q1'), Flags.get('atlantis_q2'), Flags.get('atlantis_q3')]
          .filter(Boolean).length;
        if (score === 3) return 'THREE FOR THREE.\n\nYOUR ACCOUNT IS CLEARED.\n\nTHE ARCHIVE DOOR IS OPEN.\nGO WEST. FAR WEST.\nZONE THREE.\n\nWHAT YOU FIND THERE\nYOU CANNOT UNFIND.';
        if (score === 2) return 'TWO OF THREE.\n\nPROVISIONAL.\nNOT CLEARED.\n\nREVIEW YOUR KNOWLEDGE OF THE SYSTEM.\nRETURN WHEN YOU ARE CERTAIN.\nTHE CHAIR WILL WAIT.';
        if (score === 1) return 'ONE OF THREE.\n\nINSUFFICIENT.\n\nENGAGE WITH THE SYSTEM.\nTHE PILLAR. THE GREETER.\nIN THAT ORDER.\nTHEN RETURN.';
        return 'ZERO OF THREE.\n\nYOU ARE A STRANGER HERE.\n\nBEGIN AT THE PILLAR.\nREAD EVERYTHING.\nTALK TO THE GREETER.\nCOME BACK.\nWE WILL PROCESS YOU AGAIN.';
      },
      onEnter: () => {
        const score = [Flags.get('atlantis_q1'), Flags.get('atlantis_q2'), Flags.get('atlantis_q3')]
          .filter(Boolean).length;
        if (score === 3) {
          Flags.set('atlantis_cleared', true);
          log('✦ CLEARED. The Archive Door opens.', 'hi');
          G.shake = 10;
          QuestManager.check();
        } else {
          log(`Audit result: ${score}/3 correct. Retake when ready.`, '');
        }
      },
      next: null,
    },
  });
}

// Archive tablet content (3 tablets, pre-Founder civilization)
const _ARCHIVE_TEXT = [
  {
    title: 'ARCHIVE RECORD I — THE KHET-AMUN',
    lines: [
      'THE CITY OF KHET-AMUN STOOD HERE BEFORE ATLANTIS.',
      'BEFORE THE TIERS. BEFORE THE FOUNDER.',
      'THEIR RECORDS DESCRIBE A SYSTEM:',
      'FORTY-SEVEN LEVELS OF ASCENSION.',
      'A PROMISE AT EACH LEVEL.',
      'A FEE AT EACH LEVEL.',
      'THEIR HIGHEST TIER WAS CALLED THE THRESHOLD.',
      'OURS WAS CALLED TIER TWELVE.',
      'DIFFERENT WORDS.',
      'SAME SHAPE.',
    ],
  },
  {
    title: 'ARCHIVE RECORD II — THEIR FOUNDER',
    lines: [
      'THE KHET-AMUN HAD A FOUNDER ALSO.',
      'HE FOUND A ROOM. A THRONE. A DOCUMENT.',
      'THE DOCUMENT DESCRIBED THEIR SYSTEM.',
      'HE DID NOT WRITE THE DOCUMENT.',
      'THE SEA LEVEL WAS RISING.',
      'THEY WERE FOCUSED ON THE SYSTEM.',
      'WHEN THE WATER CAME, THEIR FOUNDER SAID',
      'IT WAS A TRANSITION.',
      'SOME OF THEM BELIEVED HIM.',
    ],
  },
  {
    title: 'ARCHIVE RECORD III — COMPLIANCE OFFICER\'S NOTE',
    lines: [
      'FINAL NOTE FROM KHET-AMUN COMPLIANCE OFFICER:',
      '"WE ARE NOT THE ORIGIN.',
      'BENEATH THE VAULT FLOOR.',
      'SOMETHING OLDER.',
      'THE SAME SHAPE AS OUR DOCUMENTS.',
      'WE DO NOT KNOW WHO WROTE IT.',
      'IF SOMEONE READS THIS:',
      'THE SHAPE REPEATS.',
      'THE SHAPE ALWAYS REPEATS."',
      '— END OF KHET-AMUN ARCHIVE.',
      '(WATER DAMAGE BEYOND THIS LINE)',
    ],
  },
];

function _buildFounderDialogue() {
  const hasName = () => Flags.get('atlantis_founder_name');

  return new Dialogue({
    start: {
      speaker: () => hasName() ? 'KHEM-ATEF  ✦  THE FOUNDER' : 'THE FOUNDER  ✦  TIER ∞',
      text: () => hasName()
        ? 'KHEM-ATEF.\nYOU KNOW THAT NAME.\n\nI HAVEN\'T HEARD IT\nSINCE THE WATER CAME.\n\nHOW.'
        : 'YOU FOUND ME.\n\nNOT MANY DO.\nMOST TURN BACK.\nTHE WATER GETS HEAVY\nDOWN HERE.',
      choices: [
        { label: 'CONTINUE', next: 'origin_named', condition: () => hasName() },
        { label: 'CONTINUE', next: 'origin',       condition: () => !hasName() },
      ],
    },

    // ── Path: player knows the name ───────────────────
    origin_named: {
      speaker: 'KHEM-ATEF  ✦  THE FOUNDER',
      text: 'THE COMPLIANCE RECORDS.\nOF COURSE.\nTAWERET KEPT EVERYTHING.\n\nI WAS TWENTY-THREE.\nI FOUND THE ROOM.\nI FOUND THE DOCUMENT.\n\nI SAT WITH IT FOR SIX MONTHS\nTRYING TO DECIDE WHAT TO DO.',
      next: 'followed_named',
    },
    followed_named: {
      speaker: 'KHEM-ATEF  ✦  THE FOUNDER',
      text: 'THEN I JUST FOLLOWED THE INSTRUCTIONS.\nBECAUSE IT WAS EASIER THAN NOT FOLLOWING THEM.\n\nTHE TIERS. THE FEES. THE DEVOTION.\nALL OF IT WAS IN THE DOCUMENT.\nI JUST EXECUTED IT.\n\nI TOLD MYSELF I WAS BUILDING SOMETHING.\nI WAS NOT BUILDING SOMETHING.',
      next: 'flood_named',
    },
    flood_named: {
      speaker: 'KHEM-ATEF  ✦  THE FOUNDER',
      text: 'WHEN THE WATER CAME I SAID IT WAS A TRANSITION.\nI BELIEVED IT WHEN I SAID IT.\nOR I TOLD MYSELF I BELIEVED IT.\n\nTHE DIFFERENCE BETWEEN THESE TWO THINGS\nWAS NEVER CLEAR TO ME.\n\nI DON\'T THINK IT IS CLEAR TO ANYONE\nWHO HAS EVER DONE WHAT I DID.',
      next: 'vessel_named',
    },
    vessel_named: {
      speaker: 'KHEM-ATEF  ✦  THE FOUNDER',
      text: 'THE TABLET IS WEST OF HERE.\nYOU HAVE PROBABLY READ IT.\n\nIT DOESN\'T SAY MY NAME.\nIT NEVER SAYS ANYONE\'S NAME.\nTHAT\'S NOT WHAT IT IS FOR.\n\nIT IS NOT FOR PEOPLE.\nIT IS FOR SYSTEMS.\nPEOPLE ARE HOW SYSTEMS TRAVEL.',
      next: 'final_named',
    },
    final_named: {
      speaker: 'KHEM-ATEF  ✦  THE FOUNDER',
      text: 'YOU FOUND THE ROOM.\nYOU ARE READING THE DOCUMENTS.\n\nI WONDER WHAT THAT MAKES YOU.',
      onEnter: () => {
        Flags.set('atlantis_founder_read', true);
        log('✦ The Founder finishes speaking.', 'hi');
        log('The deepest tablet is west of here.', '');
        QuestManager.check();
      },
      next: null,
    },

    // ── Path: player does not know the name ───────────
    origin: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'I WAS THE FIRST.\nTHE ORIGINAL SOURCE.\n\nI WAS TOLD THIS BY MY UPLINE.\nMY UPLINE WAS VERY PERSUASIVE.',
      next: 'system_built',
    },
    system_built: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'I BUILT THE TIERS.\nI WROTE THE DOCTRINE.\nI DREW THE ORG CHARTS ON STONE.\n\nTHE DEVOTION OF THE PEOPLE\nWAS GENUINELY MOVING.\nI WAS MOVED BY IT MYSELF.',
      next: 'flood',
    },
    flood: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'WHEN THE WATER CAME,\nI TOLD THEM IT WAS A CLEANSING.\nA TRANSITION TO THE NEXT TIER.\n\nSOME OF THEM BELIEVED ME.\nTHEY ARE STILL OUT THERE.\nCIRCLING.',
      next: 'found_room',
    },
    found_room: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'I WANT TO TELL YOU SOMETHING\nI HAVE TOLD NO ONE.\n\nI FOUND A TABLET IN THIS ROOM.\nIN THIS CHAIR.\nBEFORE I BUILT ANYTHING.\n\nIT DESCRIBED THE SYSTEM.\nMY SYSTEM. EXACTLY.',
      next: 'tablet_truth',
    },
    tablet_truth: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'I DID NOT WRITE THAT TABLET.\n\nI TOLD MYSELF IT WAS PROPHETIC.\nTHAT I WAS THE PROPHET.\n\nI WAS VERY CONVINCING.\nEVEN TO MYSELF.\nESPECIALLY TO MYSELF.',
      next: 'warning',
    },
    warning: {
      speaker: 'THE FOUNDER  ✦  TIER ∞',
      text: 'THE TABLET IS STILL HERE.\nBURIED IN THE SEDIMENT.\nWEST OF THIS ROOM.\n\nI SUGGEST YOU READ IT.\n\nI WISH I HAD.\nEARLIER.\n\nI COULD NOT HAVE STOPPED MYSELF.\nBUT I WISH I HAD.',
      onEnter: () => {
        Flags.set('atlantis_founder_read', true);
        log('✦ The Founder finishes speaking. Their bones don\'t move.', 'hi');
        log('The deepest tablet. West of the throne room.', '');
        QuestManager.check();
      },
      next: null,
    },
  });
}

// ═══════════════════════════════════════════════════════
// AtlantisRealm
// ═══════════════════════════════════════════════════════

export class AtlantisRealm extends Realm {
  constructor() {
    super('atlantis', 'THE LOST CITY OF ATLANTIS');

    this.px  = ATLANTIS_WORLD_W / 2;
    this.py  = ATLANTIS_ENTRY_Y;
    this.pvx = 0;
    this.pvy = 0;
    this.camX = 0;
    this.camY = 0;
    this.moving  = false;
    this.frame   = 0;
    this._frameT = 0;

    this._dying       = false;
    this._dyingT      = 0;
    this._deathMsg    = '';
    this._deathCause  = '';
    this._immuneUntil = 0;

    this._choirT   = 0;
    this._inChoir  = false;

    this.registry = new InteractableRegistry();
    this._buildEntities();
    this._buildEnemies();
  }

  // ── Entity construction ────────────────────────────────

  _buildEntities() {
    // Welcome Pillar
    const pillar = new Entity('welcome_pillar', PILLAR_WX, PILLAR_WY);
    pillar.interactRange = 75;
    pillar.onInteract = () => {
      if (Flags.get('atlantis_pillar_read')) {
        log('THE PILLAR STILL SAYS WHAT IT SAYS.', '');
        return;
      }
      Flags.set('atlantis_pillar_read', true);
      log('✦ THE PILLAR READS:', 'hi');
      setTimeout(() => log('"THIS IS NOT A PYRAMID SCHEME."', ''), 200);
      setTimeout(() => log('"THE PYRAMID IS A SYMBOL OF ASCENSION."', ''), 700);
      setTimeout(() => log('"THE SCHEME IS THE PATH."', ''), 1200);
      setTimeout(() => log('"THESE ARE DIFFERENT THINGS."', ''), 1700);
      setTimeout(() => log('You have seen this before. On land.', ''), 2400);
    };
    this.registry.register(pillar);

    // Greeter NPC
    const greeter = new NPC('greeter', GREETER_WX, GREETER_WY, 'THE GREETER', _buildGreeterDialogue());
    greeter.interactRange = 90;
    this.registry.register(greeter);

    // Testimonial plaques (5)
    TESTIMONIALS.forEach((pos, i) => {
      const t = new Entity(pos.id, pos.wx, pos.wy);
      t.interactRange = 70;
      t.onInteract = () => {
        const flagKey = `atlantis_${pos.id}`;
        const data    = _TESTIMONIALS[i];
        if (Flags.get(flagKey)) {
          log(`— ${data.name} —`, '');
          log('(You have already read this.)', '');
          return;
        }
        Flags.set(flagKey, true);
        Flags.inc('atlantis_testimonials_read');
        log(`✦ — ${data.name} —`, 'hi');
        let delay = 300;
        for (const line of data.lines) {
          setTimeout(() => log(line, ''), delay);
          delay += 480;
        }
        // Testimonial 2 contains the keyword
        if (i === 2) {
          setTimeout(() => {
            Flags.set('atlantis_keyword_found', true);
            log('✦ You memorise the keyword.', 'hi');
          }, delay + 200);
        }
        // Testimonials 2 and 3 hint at the archive
        if (i === 2 || i === 3) {
          setTimeout(() => log('The archive. Far west of Zone Three.', ''), delay + 500);
        }
        QuestManager.check();
      };
      this.registry.register(t);
    });

    // Processing Chair (zone 3 audit)
    const chair = new Entity('audit_chair', CHAIR_WX, CHAIR_WY);
    chair.interactRange = 65;
    chair.onInteract = () => {
      if (Flags.get('atlantis_cleared')) {
        log('YOUR ACCOUNT IS CLEARED.', '');
        log('You don\'t need to sit in the chair again.', '');
        return;
      }
      if (!Flags.get('atlantis_tier3')) {
        log('THE CHAIR IS FOR TIER THREE AND ABOVE.', '');
        log('Find the Greeter. Find the keyword.', '');
        return;
      }
      DialogueManager.start(_buildAuditDialogue());
    };
    this.registry.register(chair);

    // Archive Door (zone 3, far west)
    const archiveDoor = new Entity('archive_door', ARCHIVE_DOOR_WX, ARCHIVE_DOOR_WY);
    archiveDoor.interactRange = 80;
    archiveDoor.onInteract = () => {
      if (!Flags.get('atlantis_cleared')) {
        log('THE ARCHIVE IS SEALED.', '');
        log('Clearance required. The Processing Chair awaits.', '');
        return;
      }
      if (!Flags.get('atlantis_archive_open')) {
        Flags.set('atlantis_archive_open', true);
        G.shake = 6;
        log('✦ The archive opens.', 'hi');
        setTimeout(() => log('Three tablets. The records of what came before.', ''), 500);
      } else {
        log('The archive is open. The tablets are inside.', '');
      }
    };
    this.registry.register(archiveDoor);

    // Archive Tablets (3)
    ARCHIVE_TABLETS.forEach((pos, i) => {
      const at = new Entity(pos.id, pos.wx, pos.wy);
      at.interactRange = 72;
      at.onInteract = () => {
        if (!Flags.get('atlantis_archive_open')) {
          log('THE ARCHIVE IS SEALED.', '');
          return;
        }
        const flagKey = `atlantis_${pos.id}`;
        const data    = _ARCHIVE_TEXT[i];
        if (Flags.get(flagKey)) {
          log(`— ${data.title} — (already read)`, '');
          return;
        }
        Flags.set(flagKey, true);
        Flags.inc('atlantis_archive_read');
        log(`✦ ${data.title}`, 'hi');
        let delay = 300;
        for (const line of data.lines) {
          setTimeout(() => log(line, ''), delay);
          delay += 500;
        }
        // All 3 read
        if (Flags.get('atlantis_archive_read', 0) >= 3) {
          setTimeout(() => {
            log('✦ You have read all of the Khet-Amun records.', 'hi');
            log('The same shape. Every time.', '');
          }, delay + 300);
        }
        QuestManager.check();
      };
      this.registry.register(at);
    });

    // Name Tablet (choir aftermath — only visible after choir survival)
    const nameTbl = new Entity('name_tablet', NAME_TABLET_WX, NAME_TABLET_WY);
    nameTbl.interactRange = 75;
    nameTbl.onInteract = () => {
      if (!Flags.get('atlantis_choir_survived')) {
        log('A sealed alcove in the wall.', '');
        log('Something is inscribed inside. You cannot reach it yet.', '');
        return;
      }
      if (Flags.get('atlantis_founder_name')) {
        log('KHEM-ATEF.', '');
        log('You already know the name.', '');
        return;
      }
      Flags.set('atlantis_founder_name', true);
      G.shake = 8;
      log('✦ THE COMPLIANCE OFFICER\'S PRIVATE RECORD:', 'hi');
      setTimeout(() => log('KHEM-ATEF.', 'hi'), 400);
      setTimeout(() => log('THAT WAS THE NAME BEFORE THE FOUNDER.', ''), 900);
      setTimeout(() => log('HE WAS A SCRIBE. FROM THE DELTA.', ''), 1400);
      setTimeout(() => log('HE FOUND THE ROOM WHEN HE WAS TWENTY-THREE.', ''), 1900);
      setTimeout(() => log('HE SPENT SIX MONTHS TRYING TO LEAVE.', ''), 2500);
      setTimeout(() => log('THEN HE STOPPED TRYING.', ''), 3100);
      setTimeout(() => log('HE THOUGHT: IF THEY KNEW I WAS JUST A PERSON,', ''), 3700);
      setTimeout(() => log('THEY WOULD KNOW THE SYSTEM WAS JUST A SYSTEM.', ''), 4300);
      setTimeout(() => log('HE WAS PROBABLY RIGHT.', ''), 4900);
      setTimeout(() => {
        log('✦ You know his name now. Find the throne room.', 'hi');
      }, 5600);
      QuestManager.check();
    };
    this.registry.register(nameTbl);

    // The Founder
    const founder = new NPC('founder', FOUNDER_WX, FOUNDER_WY, 'THE FOUNDER', _buildFounderDialogue());
    founder.interactRange = 100;
    this.registry.register(founder);

    // Deepest Tablet
    const deepTbl = new Entity('deepest_tablet', TABLET_WX, TABLET_WY);
    deepTbl.interactRange = 80;
    deepTbl.onInteract = () => {
      if (!Flags.get('atlantis_founder_read')) {
        log('A stone tablet, half-buried in silt.', '');
        log('The inscription is worn. Come back when you know more.', '');
        return;
      }
      if (Flags.get('atlantis_deepest_tablet')) {
        log('THE SYSTEM IS THE UPLINE.', '');
        log('You already know this. You keep coming back anyway.', '');
        return;
      }
      Flags.set('atlantis_deepest_tablet', true);
      G.shake = 14;
      log('✦ WE DID NOT INVENT THIS.', 'hi');
      setTimeout(() => log('WE FOUND THEIR SYSTEM. THEIR RECORDS. THEIR THRONE.', ''), 700);
      setTimeout(() => log('WE BUILT ON TOP.', ''), 1400);
      setTimeout(() => {
        if (Flags.get('atlantis_archive_read', 0) >= 3)
          log('AS KHET-AMUN BUILT ON TOP.', '');
        else
          log('AS THEY BUILT ON TOP OF WHAT CAME BEFORE.', '');
      }, 2000);
      setTimeout(() => log('THE PYRAMID GOES DEEPER THAN THE OCEAN.', 'hi'), 2900);
      setTimeout(() => log('THERE IS NO UPLINE.', ''), 3700);
      setTimeout(() => log('THERE NEVER WAS AN UPLINE.', ''), 4200);
      setTimeout(() => log('✦ THE SYSTEM IS THE UPLINE.', 'hi'), 5000);
      setTimeout(() => log('PASS IT ON.', ''), 5800);
      QuestManager.check();
    };
    this.registry.register(deepTbl);
  }

  _buildEnemies() {
    this.shark = {
      wx: SHARK_PATROL_X1 + 400,
      wy: SHARK_PATROL_Y,
      dir: 1,
      chasing: false,
      active: true,
    };
    this.squid = {
      wx: SQUID_START_WX,
      wy: SQUID_START_WY,
      pvx: 0, pvy: 0,
      chasing: false,
      active: true,
    };
    this.devoted = [
      { wx: 400,  wy: 1260, active: true, phase: 0.0 },
      { wx: 2200, wy: 1380, active: true, phase: 2.1 },
      { wx: 1100, wy: 1480, active: true, phase: 4.3 },
    ];
  }

  // ── Lifecycle ─────────────────────────────────────────

  onEnter() {
    this.px  = ATLANTIS_WORLD_W / 2;
    this.py  = ATLANTIS_ENTRY_Y;
    this.pvx = 0;
    this.pvy = 1.5;
    this._dying       = false;
    this._inChoir     = false;
    this._choirT      = 0;
    this._immuneUntil = Date.now() + 2000;

    this.devoted[0].wx = 400;  this.devoted[0].wy = 1260;
    this.devoted[1].wx = 2200; this.devoted[1].wy = 1380;
    this.devoted[2].wx = 1100; this.devoted[2].wy = 1480;

    this._syncCamera();
    this._syncToG();

    Flags.set('atlantis_visited', true);
    Flags.inc('atlantis_dives');
    G.shake = 6;

    log('✦ You plunge beneath the surface.', 'hi');
    setTimeout(() => {
      log('The water closes above you.', '');
      log('Arrow keys to swim. ↑ near surface to return.', '');
    }, 600);
    setTimeout(() => {
      if (!Flags.get('atlantis_recruited'))
        log('Something vast and organised lies below.', '');
      else
        log(`Welcome back, Tier ${Flags.get('atlantis_tier', 1)}.`, '');
    }, 1600);
  }

  onExit() { G.shake = 4; }

  // ── Camera / sync ─────────────────────────────────────

  _syncCamera() {
    const targetX = this.px - CW / 2;
    const targetY = this.py - CH / 2;
    this.camX += (targetX - this.camX) * 0.1;
    this.camY += (targetY - this.camY) * 0.1;
    this.camX = Math.max(0, Math.min(ATLANTIS_WORLD_W - CW, this.camX));
    this.camY = Math.max(0, Math.min(ATLANTIS_WORLD_H - CH, this.camY));
  }

  _syncToG() {
    G.px      = this.px;
    G.py      = this.py;
    G.pvx     = this.pvx;
    G.pvy     = this.pvy;
    G.camX    = this.camX;
    G.camY    = this.camY;
    G.facing  = this.pvx < -0.3 ? -1 : 1;
    G.pmoving = this.moving;
    G.pframe  = this.frame;
  }

  getPlayerPose() {
    return { px: this.px, py: this.py, camX: this.camX, camY: this.camY,
             pZ: 0, facing: G.facing, frame: this.frame };
  }

  // ── Enemy update ─────────────────────────────────────

  _updateEnemies(ts) {
    if (Date.now() < this._immuneUntil) return;

    const px = this.px;
    const py = this.py;
    const cleared     = Flags.get('atlantis_cleared');
    const knowsName   = Flags.get('atlantis_founder_name');

    // Compliance Shark
    {
      const s = this.shark;
      const dist = Math.hypot(px - s.wx, py - s.wy);
      s.chasing = dist < SHARK_AGGRO && py < ZONE_2_END;
      if (s.chasing) {
        const dx = px - s.wx, dy = py - s.wy;
        const len = Math.hypot(dx, dy) || 1;
        s.wx += (dx / len) * SHARK_CHASE_SPD;
        s.wy += (dy / len) * SHARK_CHASE_SPD * 0.25;
        s.dir = dx > 0 ? 1 : -1;
      } else {
        s.wx += SHARK_SPEED * s.dir;
        if (s.wx > SHARK_PATROL_X2) { s.wx = SHARK_PATROL_X2; s.dir = -1; }
        if (s.wx < SHARK_PATROL_X1) { s.wx = SHARK_PATROL_X1; s.dir =  1; }
        s.wy += (SHARK_PATROL_Y - s.wy) * 0.02;
      }
      if (!this._dying && !DialogueManager.isActive() &&
          Math.hypot(px - s.wx, py - s.wy) < SHARK_HURT) {
        this._killPlayer('shark');
      }
    }

    // The Auditor (squid) — PASSIVE when cleared
    {
      const sq = this.squid;
      const dist = Math.hypot(px - sq.wx, py - sq.wy);
      sq.chasing = !cleared && dist < SQUID_AGGRO && py >= ZONE_2_END;

      if (sq.chasing) {
        const dx = px - sq.wx, dy = py - sq.wy;
        const len = Math.hypot(dx, dy) || 1;
        sq.pvx += (dx / len) * 0.06;
        sq.pvy += (dy / len) * 0.06;
      } else {
        sq.pvx += Math.sin(ts / 2400) * 0.012;
        sq.pvy += Math.cos(ts / 3100) * 0.012;
      }
      const sqSpd = Math.hypot(sq.pvx, sq.pvy);
      const maxSqSpd = sq.chasing ? SQUID_CHASE_SPD : SQUID_SPEED;
      if (sqSpd > maxSqSpd) {
        sq.pvx = (sq.pvx / sqSpd) * maxSqSpd;
        sq.pvy = (sq.pvy / sqSpd) * maxSqSpd;
      }
      sq.pvx *= 0.96; sq.pvy *= 0.96;
      sq.wx += sq.pvx; sq.wy += sq.pvy;
      sq.wx = Math.max(80, Math.min(ATLANTIS_WORLD_W - 80, sq.wx));
      sq.wy = Math.max(ZONE_2_END - 50, Math.min(ZONE_3_END + 50, sq.wy));

      if (!this._dying && !DialogueManager.isActive() && sq.chasing &&
          Math.hypot(px - sq.wx, py - sq.wy) < SQUID_HURT) {
        this._killPlayer('squid');
      }
    }

    // The Devoted — PASSIVE when player knows Founder's name
    for (const d of this.devoted) {
      if (!d.active) continue;
      const dist   = Math.hypot(px - d.wx, py - d.wy);
      const active = !knowsName && py >= ZONE_3_END && dist < DEVOTED_AGGRO;
      if (active) {
        const dx = px - d.wx, dy = py - d.wy;
        const len = Math.hypot(dx, dy) || 1;
        d.wx += (dx / len) * DEVOTED_SPEED;
        d.wy += (dy / len) * DEVOTED_SPEED;
      } else {
        d.wx += Math.sin(ts / 1800 + d.phase) * 0.3;
        d.wy += Math.cos(ts / 2200 + d.phase) * 0.2;
        d.wy  = Math.max(ZONE_3_END, Math.min(ATLANTIS_FLOOR_Y - 40, d.wy));
      }
      d.wx = Math.max(40, Math.min(ATLANTIS_WORLD_W - 40, d.wx));
      if (!this._dying && !DialogueManager.isActive() && active &&
          Math.hypot(px - d.wx, py - d.wy) < DEVOTED_HURT) {
        this._killPlayer('devoted');
      }
    }

    // Choir circle
    if (!this._dying && !DialogueManager.isActive()) {
      const choirDist = Math.hypot(px - CHOIR_WX, py - CHOIR_WY);
      const cleared   = Flags.get('atlantis_cleared');

      if (choirDist < CHOIR_RADIUS) {
        if (!this._inChoir) {
          this._inChoir = true;
          this._choirT  = Date.now();
          if (cleared)
            log('The circle opens around you. Their arms reach in.', '');
          else
            log('A sound builds. Not quite sound. Swim away.', '');
        } else {
          const elapsed = Date.now() - this._choirT;
          if (cleared) {
            // Survive 5s → name alcove opens
            if (elapsed > 5000 && !Flags.get('atlantis_choir_survived')) {
              Flags.set('atlantis_choir_survived', true);
              this._inChoir = false;
              G.shake = 12;
              log('✦ The circle parts.', 'hi');
              setTimeout(() => log('An alcove opens in the east wall.', ''), 600);
              setTimeout(() => log('Something is carved inside.', ''), 1200);
            }
          } else {
            // Non-cleared: die after 2.4s
            if (elapsed > 2400) this._killPlayer('choir');
          }
        }
      } else if (this._inChoir) {
        this._inChoir = false;
        if (!Flags.get('atlantis_choir_survived'))
          log('The harmonizing fades. You swam fast enough.', '');
      }
    }
  }

  // ── Death / Respawn ───────────────────────────────────

  _killPlayer(cause) {
    if (this._dying || DialogueManager.isActive()) return;
    Flags.inc('atlantis_deaths');
    this._dying      = true;
    this._dyingT     = Date.now();
    this._deathMsg   = _pickDeathMsg(cause, Flags.get('atlantis_deaths', 0));
    this._deathCause = cause;
    this._inChoir    = false;
    G.shake          = 22;
    this.pvx = 0; this.pvy = 0;
    setTimeout(() => log(`✦ ${this._deathMsg.split('\n')[0]}`, 'hi'), 300);
  }

  _respawn() {
    this._dying       = false;
    this._immuneUntil = Date.now() + 3000;
    this.px   = ATLANTIS_WORLD_W / 2 + (Math.random() - 0.5) * 200;
    this.py   = ATLANTIS_ENTRY_Y + 30;
    this.pvx  = 0; this.pvy = 0;
    this._inChoir = false;
    G.shake = 8;
    const deaths = Flags.get('atlantis_deaths', 0);
    if (deaths === 1)      log('✦ You surface. The oasis air hits you. Your thetan has been repositioned.', 'hi');
    else if (deaths < 5)   log('✦ The surface again. The system returned you.', 'hi');
    else                   log(`✦ Death #${deaths}. You surface. The system always returns you.`, 'hi');
  }

  // ── Update ────────────────────────────────────────────

  update(ts) {
    if (RealmManager.isTransitioning) return;
    if (this._dying) {
      if (Date.now() - this._dyingT > 2800) this._respawn();
      this._syncCamera();
      return;
    }
    if (DialogueManager.isActive()) return;

    const keys = G.keys;
    this.pvy += SWIM_BUOYANCY;

    if (keys['ArrowLeft']  || keys['a'] || keys['A']) this.pvx -= SWIM_ACC;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) this.pvx += SWIM_ACC;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) this.pvy -= SWIM_ACC;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) this.pvy += SWIM_ACC;

    this.pvx *= SWIM_DRAG;
    this.pvy *= SWIM_DRAG;
    const maxSpd = SWIM_MAX_SPD * (keys['Shift'] ? 1.6 : 1.0);
    this.pvx = Math.max(-maxSpd, Math.min(maxSpd, this.pvx));
    this.pvy = Math.max(-maxSpd, Math.min(maxSpd, this.pvy));
    if (Math.abs(this.pvx) < 0.08) this.pvx = 0;
    if (Math.abs(this.pvy) < 0.08) this.pvy = 0;

    this.px += this.pvx;
    this.py += this.pvy;
    this.px = Math.max(20, Math.min(ATLANTIS_WORLD_W - 20, this.px));
    this.py = Math.max(0,  Math.min(ATLANTIS_WORLD_H - 20, this.py));
    if (this.py >= ATLANTIS_WORLD_H - 20) {
      this.py  = ATLANTIS_WORLD_H - 20;
      this.pvy = -Math.abs(this.pvy) * 0.4;
    }

    this._updateEnemies(ts);
    this.registry.update(this.px, this.py);

    this.moving = Math.abs(this.pvx) + Math.abs(this.pvy) > 0.3;
    if (this.moving && ts - this._frameT > 180) {
      this._frameT = ts;
      this.frame   = 1 - this.frame;
    } else if (!this.moving) {
      this.frame = 0;
    }

    // Zone entry logs
    if (this.py > ZONE_1_END && !Flags.get('atl_z2')) {
      Flags.set('atl_z2', true);
      log('The gold on the columns is painted.', '');
      log('You can see where the paint is flaking.', '');
    }
    if (this.py > ZONE_2_END && !Flags.get('atl_z3')) {
      Flags.set('atl_z3', true);
      log('Rows of stone chairs. All facing the same direction.', '');
      log('Something moves in the dark.', '');
    }
    if (this.py > ZONE_3_END && !Flags.get('atl_z4')) {
      Flags.set('atl_z4', true);
      log('Portraits of the same face. Everywhere.', '');
      log('The faces watch you.', '');
    }
    if (this.py > ZONE_4_END && !Flags.get('atl_z5')) {
      Flags.set('atl_z5', true);
      log('✦ The Founder\'s Vault.', 'hi');
      log('A cage around the throne. Locked from the inside.', '');
    }

    this._syncCamera();
    this._syncToG();
  }

  // ── Key handling ──────────────────────────────────────

  onKeyDown(key) {
    if (RealmManager.isTransitioning || this._dying) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);

    if ((key === 'ArrowUp' || key === 'w' || key === 'W') && this.py <= ATLANTIS_EXIT_Y) {
      log('✦ You breach the surface.', 'hi');
      G.shake = 8;
      RealmManager.scheduleTransition('oasis', { duration: 1200, render: atlantisTransRender });
      return true;
    }
    if (key === ' ') return this.registry.interact();
    return false;
  }

  // ── Render ────────────────────────────────────────────

  render() {
    drawAtlantis(this);
    DialogueManager.render();
  }
}
