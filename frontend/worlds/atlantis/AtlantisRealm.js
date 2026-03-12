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
//
// ENGINE ABSTRACTIONS USED:
//  • FreeMoveRealm  (engine/freemove.js)  — 2D swim physics, camera-Y, _syncToG
//  • HealthSystem  (engine/health.js)   — kill / death-screen / respawn / immunity
//  • TimedHazard   (engine/hazard.js)   — choir circle (danger → survival on CLEARED)
//  • FreeRoamEnemy  (engine/entity.js)   — shark, squid, devoted AI + hurt checks

import { RealmManager }              from '../../engine/realm.js';
import { FreeMoveRealm }              from '../../engine/freemove.js';
import { HealthSystem }              from '../../engine/health.js';
import { TimedHazard }               from '../../engine/hazard.js';
import { G }                         from '../../game/state.js';
import { Flags }                     from '../../engine/flags.js';
import { InteractableRegistry }      from '../../engine/interactables.js';
import { NPC, Entity, FreeRoamEnemy } from '../../engine/entity.js';
import { Dialogue, DialogueManager } from '../../engine/dialogue.js';
import { log }                       from '../../ui/panels.js';
import {
  ATLANTIS_WORLD_W, ATLANTIS_WORLD_H,
  ATLANTIS_ENTRY_Y, ATLANTIS_EXIT_Y,
  ZONE_2_END, ZONE_3_END, ZONE_4_END,
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
  SWIM_ACC, SWIM_DRAG, SWIM_MAX_SPD, SWIM_BUOYANCY,
} from './constants.js';
import { drawAtlantis }        from './draw/atlantis.js';
import { atlantisTransRender } from '../transitions.js';

// ══════════════════════════════════════════════════════════
// Death message system
// ══════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════
// Testimonial content (5 plaques, zones 1-2)
// ══════════════════════════════════════════════════════════

const _TESTIMONIALS = [
  {
    name: 'REKH-MIR  \u2726  TIER 4  \u2726  PATIENCE DIVISION',
    lines: [
      'I JOINED IN 9,740 BC.', 'I WAS PROMISED TENFOLD RETURNS.',
      'MY UPLINE SAYS I NEED MORE RECRUITS FIRST.',
      'I HAVE BEEN RECRUITING.', 'I HAVE ALWAYS BEEN RECRUITING.', 'I AM VERY PATIENT.',
    ],
  },
  {
    name: 'NEFERTUM  \u2726  TIER 2  \u2726  RECRUITMENT',
    lines: [
      'I RECRUITED MY FAMILY FIRST.', 'THEN MY NEIGHBOURS.',
      'THEN STRANGERS WHO SEEMED OPEN-MINDED.',
      'THEY ARE ALL HERE NOW.', 'WE ARE WAITING TOGETHER.',
      'I TRY NOT TO THINK ABOUT', 'WHETHER THE WAITING WAS THE PLAN.',
    ],
  },
  {
    name: 'TAWERET  \u2726  TIER 7  \u2726  COMPLIANCE OFFICER',
    lines: [
      'NOTE FOR ANY FUTURE PROSPECTS:',
      'THE KEYWORD FOR TIER ADVANCEMENT IS\u2014',
      'ASCENSION AWAITS THE BELIEVING HEART.',
      'PRESENT THIS TO YOUR GREETER.',
      'I SHOULD NOT BE WRITING THIS.',
      'BUT I AM DEAD AND THE RULES HAVE CHANGED.',
      'ALSO: CHECK THE ARCHIVE. FAR WEST OF ZONE THREE.',
      'THE RECORDS ARE THERE.', 'THE TRUTH IS UNCOMFORTABLE.',
    ],
  },
  {
    name: 'HENUTTAWY  \u2726  TIER 5  \u2726  THE DEVOTED',
    lines: [
      'I MET THE FOUNDER ONCE.', 'THEY WERE VERY CHARMING.',
      'THEY SAID MY NAME AS THOUGH IT MATTERED.', 'I GAVE THEM EVERYTHING.',
      'I LATER LEARNED THE FOUNDER HAD A DIFFERENT NAME.',
      'BEFORE THE TIERS. BEFORE ALL OF THIS.', 'THEY NEVER TOLD ANYONE.',
      'THE COMPLIANCE RECORDS ARE IN THE ARCHIVE.',
    ],
  },
  {
    name: 'AMENHOTEP  \u2726  TIER 6  \u2726  ASCENDING',
    lines: [
      'I ASCENDED LAST TUESDAY.', 'ASCENSION IS CONTINUOUS.', 'I AM STILL ASCENDING.',
      'IT IS WET.', 'I AM NOT SURE WHERE I AM GOING.',
      'I DO NOT THINK THE FOUNDER WAS SURE EITHER.',
      'WE WERE ASCENDING TOGETHER.', 'AT THE TIME, THIS WAS COMFORTING.',
    ],
  },
];

// ══════════════════════════════════════════════════════════
// Dialogues (content unchanged from v1.39)
// ══════════════════════════════════════════════════════════

function _buildGreeterDialogue() {
  return new Dialogue({
    start: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: () => {
        if (Flags.get('atlantis_tier3'))
          return 'TIER THREE.\nYES. I REMEMBER YOU.\n\nYOU USED THE KEYWORD.\nI WAS VERY MOVED BY THAT.\nIT HAS BEEN A LONG TIME\nSINCE ANYONE USED THE KEYWORD.';
        if (Flags.get('atlantis_recruited'))
          return 'WELCOME BACK, TIER ONE.\n\nHAVE YOU BEEN ASCENDING?\nYOU LOOK LIKE YOU HAVE BEEN ASCENDING.\n\nDO YOU HAVE SOMETHING TO SAY TO ME?';
        return 'WELCOME TO THE\nATLANTEAN ASCENSION SYSTEM.\n\nI AM REQUIRED BY CHARTER TO INFORM YOU\nTHAT THIS IS NOT A PYRAMID SCHEME.';
      },
      choices: [
        { label: 'CONTINUE', next: 'clarify',     condition: () => !Flags.get('atlantis_recruited') },
        { label: 'CONTINUE', next: 'return_wait', condition: () => Flags.get('atlantis_recruited') && !Flags.get('atlantis_tier3') },
        { label: 'CONTINUE', next: 'tier3_chat',  condition: () => Flags.get('atlantis_tier3') },
      ],
    },
    clarify: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'THE PYRAMID IS A SYMBOL OF ASCENSION.\nTHE SCHEME IS THE PATH.\nTHESE ARE DIFFERENT THINGS.\n\nI HAVE A LEAFLET EXPLAINING THIS.\nTHE LEAFLET IS ALSO UNDERWATER.',
      next: 'wait',
    },
    wait: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'I HAVE BEEN WAITING AT THIS DESK\nFOR 12,000 YEARS FOR A PROSPECT.\n\nARE YOU A PROSPECT?',
      choices: [
        { label: 'YES \u2014 I AM A PROSPECT',   next: 'yes_path' },
        { label: 'NO \u2014 I AM JUST SWIMMING', next: 'no_path' },
        { label: 'ASCENSION AWAITS THE BELIEVING HEART',
          next: 'keyword_path',
          condition: () => Flags.get('atlantis_keyword_found') && !Flags.get('atlantis_recruited') },
      ],
    },
    yes_path: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'EXCELLENT.\nI KNEW IT.\nI COULD TELL BY THE WAY YOU SWAM IN.\n\nI WILL NOW ADD YOU TO MY DOWNLINE.\nTHIS IS AN HONOUR.\nTHIS IS AN OPPORTUNITY.',
      next: 'fee',
    },
    no_path: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'I UNDERSTAND.\nFEAR IS NORMAL.\nFEAR IS THE SURFACE TALKING.\n\nI WILL ADD YOU TO MY DOWNLINE ANYWAY.\nAS A COMPLIMENTARY PLACEMENT.\nYOU ARE WELCOME.',
      next: 'fee',
    },
    fee: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'YOUR ENROLMENT FEE IS 400 CRYSTALS.\nCRYSTALS WHICH, I ACKNOWLEDGE,\nARE BURIED UNDER 10,000 YEARS OF SEDIMENT.\n\nWE WILL WAIVE THE FEE.\nTODAY ONLY.\nIT HAS BEEN TODAY ONLY SINCE 9,800 BC.',
      next: 'enrolled',
    },
    enrolled: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'WELCOME, TIER ONE.\n\nYOUR UPLINE IS ME.\nI HAVE NOT ASCENDED YET.\nI AM VERY CLOSE.\n\nI HAVE BEEN VERY CLOSE SINCE 9,700 BC.',
      onEnter: () => {
        Flags.set('atlantis_tier', 1);
        Flags.set('atlantis_recruited', true);
        log('\u2726 You are now Tier 1. Your upline has been waiting 12,000 years.', 'hi');
        log('There are plaques on the walls. Explore before descending.', '');
      },
      next: 'goodbye',
    },
    goodbye: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'THE DEEPER YOU GO,\nTHE CLOSER YOU ARE TO ASCENSION.\n\nTHAT IS WHAT THEY TOLD ME.\nI BELIEVE THEM.\n\nI AM STILL BELIEVING THEM.',
      next: null,
    },
    return_wait: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'YOU HAVE BEEN EXPLORING.\nGOOD.\n\nDO YOU HAVE SOMETHING TO SAY TO ME?',
      choices: [
        { label: 'ASCENSION AWAITS THE BELIEVING HEART',
          next: 'keyword_path',
          condition: () => Flags.get('atlantis_keyword_found') },
        { label: 'NOT YET', next: 'return_hint' },
      ],
    },
    return_hint: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'KEEP EXPLORING.\nTHE WALLS SPEAK TO THOSE WHO READ THEM.\n\nTHE PLAQUES IN PARTICULAR.\nTHERE ARE FIVE OF THEM.\nNOT ALL OF THEM ARE COMPLIMENTARY\nABOUT THE SYSTEM.\n\nI CHOOSE TO OVERLOOK THIS.',
      next: null,
    },
    keyword_path: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'ASCENSION AWAITS THE BELIEVING HEART.\n\nYOU SAID IT.\nYOU ACTUALLY SAID IT.\n\nIN 12,000 YEARS\nNOT ONE PROSPECT\nHAS SAID THAT TO ME.',
      next: 'keyword_upgrade',
    },
    keyword_upgrade: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'YOU ARE HEREBY ELEVATED TO TIER THREE.\n\nTIER THREE GIVES YOU ACCESS\nTO THE PROCESSING CHAMBER.\nIT IS DEEPER. ZONE THREE.\n\nFIND THE CHAIR.\nSIT IN IT.\nANSWER THE AUDITOR\'S QUESTIONS CORRECTLY.\nAND THE ARCHIVE WILL OPEN.',
      onEnter: () => {
        Flags.set('atlantis_tier', 3);
        Flags.set('atlantis_tier3', true);
        log('\u2726 Tier 3. The Processing Chamber is accessible.', 'hi');
        log('Zone 3. Find the chair. The answers are in things you\'ve already read.', '');
      },
      next: 'keyword_hint',
    },
    keyword_hint: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: 'THE AUDITOR WILL ASK:\nWHAT THE PILLAR SAYS.\nWHO YOUR UPLINE IS.\nWHAT YOUR ENROLMENT FEE WAS.\n\nYOU SHOULD KNOW ALL OF THESE.\nIF YOU DO NOT,\nPERHAPS READ THE PILLAR\nAND COME BACK TO ME FIRST.',
      next: null,
    },
    tier3_chat: {
      speaker: 'THE GREETER  \u2726  TIER 9 ASSOCIATE',
      text: () => Flags.get('atlantis_cleared')
        ? 'CLEARED.\nYES.\nI HEARD.\n\nTHE ARCHIVE IS OPEN.\nGO WEST. VERY FAR WEST.\nZONE THREE.\n\nWHAT YOU FIND THERE\nI CANNOT SPEAK TO.\nI NEVER READ IT MYSELF.\nI THOUGHT IT WOULD MAKE THE WAITING WORSE.'
        : 'YOU HAVE NOT BEEN AUDITED YET.\n\nZONE THREE.\nFIND THE CHAIR.\nSIT IN IT.\nANSWER THE THREE QUESTIONS.\n\nYOU KNOW THE ANSWERS.\nYOU HAVE READ THE ANSWERS.\nIF YOU HAVE NOT READ THEM,\nGO READ THEM FIRST.',
      next: null,
    },
  });
}

function _buildAuditDialogue() {
  return new Dialogue({
    start: {
      speaker: 'THE AUDITOR  \u2726  EVALUATING',
      text: 'SIT.\n\nTHIS IS A STANDARD EVALUATION.\nEVERYONE IS EVALUATED.\nTHREE QUESTIONS.\nANSWER CORRECTLY AND YOUR ACCOUNT\nWILL BE CLEARED.\n\nWE WILL BEGIN.',
      onEnter: () => {
        Flags.set('atlantis_q1', false);
        Flags.set('atlantis_q2', false);
        Flags.set('atlantis_q3', false);
      },
      next: 'q1',
    },
    q1: {
      speaker: 'THE AUDITOR  \u2726  QUESTION ONE',
      text: 'WHAT DOES THE INSCRIPTION ABOVE\nTHE WELCOME ARCHWAY SAY\nABOUT THE SURFACE?',
      choices: [
        { label: 'THE SURFACE IS FOR THE UNINITIATED', next: 'q1_correct' },
        { label: 'THIS IS NOT A PYRAMID SCHEME',       next: 'q1_wrong' },
        { label: 'ASCENSION AWAITS THE BELIEVING HEART', next: 'q1_wrong' },
      ],
    },
    q1_correct: { speaker: 'THE AUDITOR  \u2726  EVALUATING', text: 'CORRECT.\n\nPROCEEDING.',
      onEnter: () => Flags.set('atlantis_q1', true), next: 'q2' },
    q1_wrong: { speaker: 'THE AUDITOR  \u2726  EVALUATING',
      text: 'INCORRECT.\n\nA FLAG HAS BEEN ADDED TO YOUR ACCOUNT.\nWE WILL CONTINUE.',
      onEnter: () => Flags.set('atlantis_q1', false), next: 'q2' },
    q2: {
      speaker: 'THE AUDITOR  \u2726  QUESTION TWO',
      text: 'NAME YOUR IMMEDIATE UPLINE\nWITHIN THE SYSTEM.',
      choices: [
        { label: 'THE GREETER', next: 'q2_correct', condition: () => Flags.get('atlantis_recruited') },
        { label: 'THE COMPLIANCE OFFICER', next: 'q2_wrong' },
        { label: 'I DO NOT HAVE AN UPLINE', next: 'q2_wrong' },
        { label: 'I HAVE NOT ENROLLED YET', next: 'q2_not_enrolled',
          condition: () => !Flags.get('atlantis_recruited') },
      ],
    },
    q2_not_enrolled: { speaker: 'THE AUDITOR  \u2726  EVALUATING',
      text: 'YOUR ACCOUNT DOES NOT EXIST\nIN THE SYSTEM.\n\nSEEK THE GREETER.\nEnrol.\nReturn.\n\nTHIS SESSION IS SUSPENDED.', next: null },
    q2_correct: { speaker: 'THE AUDITOR  \u2726  EVALUATING', text: 'CORRECT.\n\nPROCEEDING.',
      onEnter: () => Flags.set('atlantis_q2', true), next: 'q3' },
    q2_wrong: { speaker: 'THE AUDITOR  \u2726  EVALUATING',
      text: 'INCORRECT.\n\nA FLAG HAS BEEN ADDED TO YOUR ACCOUNT.\nWE WILL CONTINUE.',
      onEnter: () => Flags.set('atlantis_q2', false), next: 'q3' },
    q3: {
      speaker: 'THE AUDITOR  \u2726  QUESTION THREE',
      text: 'WHAT FEE DID YOU PAY\nUPON ENROLMENT?',
      choices: [
        { label: 'THE FEE WAS WAIVED', next: 'q3_correct', condition: () => Flags.get('atlantis_recruited') },
        { label: 'FOUR HUNDRED CRYSTALS', next: 'q3_wrong' },
        { label: 'I DID NOT PAY. I SWAM IN.', next: 'q3_wrong' },
      ],
    },
    q3_correct: { speaker: 'THE AUDITOR  \u2726  EVALUATING', text: 'CORRECT.\n\nPROCEEDING TO VERDICT.',
      onEnter: () => Flags.set('atlantis_q3', true), next: 'verdict' },
    q3_wrong: { speaker: 'THE AUDITOR  \u2726  EVALUATING',
      text: 'INCORRECT.\n\nA FLAG HAS BEEN ADDED TO YOUR ACCOUNT.\nPROCEEDING TO VERDICT.',
      onEnter: () => Flags.set('atlantis_q3', false), next: 'verdict' },
    verdict: {
      speaker: 'THE AUDITOR  \u2726  VERDICT',
      text: () => {
        const score = ['atlantis_q1','atlantis_q2','atlantis_q3'].filter(k => Flags.get(k)).length;
        if (score === 3) return 'THREE FOR THREE.\n\nYOUR ACCOUNT IS CLEARED.\n\nTHE ARCHIVE DOOR IS OPEN.\nGO WEST. FAR WEST.\nZONE THREE.\n\nWHAT YOU FIND THERE\nYOU CANNOT UNFIND.';
        if (score === 2) return 'TWO OF THREE.\n\nPROVISIONAL.\nNOT CLEARED.\n\nREVIEW YOUR KNOWLEDGE OF THE SYSTEM.\nRETURN WHEN YOU ARE CERTAIN.\nTHE CHAIR WILL WAIT.';
        if (score === 1) return 'ONE OF THREE.\n\nINSUFFICIENT.\n\nENGAGE WITH THE SYSTEM.\nTHE PILLAR. THE GREETER.\nIN THAT ORDER.\nTHEN RETURN.';
        return 'ZERO OF THREE.\n\nYOU ARE A STRANGER HERE.\n\nBEGIN AT THE PILLAR.\nREAD EVERYTHING.\nTALK TO THE GREETER.\nCOME BACK.\nWE WILL PROCESS YOU AGAIN.';
      },
      onEnter: () => {
        const score = ['atlantis_q1','atlantis_q2','atlantis_q3'].filter(k => Flags.get(k)).length;
        if (score === 3) {
          Flags.set('atlantis_cleared', true);
          log('\u2726 CLEARED. The Archive Door opens.', 'hi');
          G.shake = 10;
        } else {
          log(`Audit result: ${score}/3 correct. Retake when ready.`, '');
        }
      },
      next: null,
    },
  });
}

const _ARCHIVE_TEXT = [
  { title: 'ARCHIVE RECORD I \u2014 THE KHET-AMUN', lines: [
    'THE CITY OF KHET-AMUN STOOD HERE BEFORE ATLANTIS.',
    'BEFORE THE TIERS. BEFORE THE FOUNDER.',
    'THEIR RECORDS DESCRIBE A SYSTEM:',
    'FORTY-SEVEN LEVELS OF ASCENSION.', 'A PROMISE AT EACH LEVEL.', 'A FEE AT EACH LEVEL.',
    'THEIR HIGHEST TIER WAS CALLED THE THRESHOLD.',
    'OURS WAS CALLED TIER TWELVE.', 'DIFFERENT WORDS.', 'SAME SHAPE.',
  ]},
  { title: 'ARCHIVE RECORD II \u2014 THEIR FOUNDER', lines: [
    'THE KHET-AMUN HAD A FOUNDER ALSO.',
    'HE FOUND A ROOM. A THRONE. A DOCUMENT.',
    'THE DOCUMENT DESCRIBED THEIR SYSTEM.',
    'HE DID NOT WRITE THE DOCUMENT.', 'THE SEA LEVEL WAS RISING.',
    'THEY WERE FOCUSED ON THE SYSTEM.',
    'WHEN THE WATER CAME, THEIR FOUNDER SAID', 'IT WAS A TRANSITION.',
    'SOME OF THEM BELIEVED HIM.',
  ]},
  { title: 'ARCHIVE RECORD III \u2014 COMPLIANCE OFFICER\'S NOTE', lines: [
    'FINAL NOTE FROM KHET-AMUN COMPLIANCE OFFICER:',
    '"WE ARE NOT THE ORIGIN.', 'BENEATH THE VAULT FLOOR.', 'SOMETHING OLDER.',
    'THE SAME SHAPE AS OUR DOCUMENTS.', 'WE DO NOT KNOW WHO WROTE IT.',
    'IF SOMEONE READS THIS:', 'THE SHAPE REPEATS.', 'THE SHAPE ALWAYS REPEATS."',
    '\u2014 END OF KHET-AMUN ARCHIVE.', '(WATER DAMAGE BEYOND THIS LINE)',
  ]},
];

function _buildFounderDialogue() {
  const hasName = () => Flags.get('atlantis_founder_name');
  return new Dialogue({
    start: {
      speaker: () => hasName() ? 'KHEM-ATEF  \u2726  THE FOUNDER' : 'THE FOUNDER  \u2726  TIER \u221e',
      text: () => hasName()
        ? 'KHEM-ATEF.\nYOU KNOW THAT NAME.\n\nI HAVEN\'T HEARD IT\nSINCE THE WATER CAME.\n\nHOW.'
        : 'YOU FOUND ME.\n\nNOT MANY DO.\nMOST TURN BACK.\nTHE WATER GETS HEAVY\nDOWN HERE.',
      choices: [
        { label: 'CONTINUE', next: 'origin_named', condition: () =>  hasName() },
        { label: 'CONTINUE', next: 'origin',       condition: () => !hasName() },
      ],
    },
    origin_named: { speaker: 'KHEM-ATEF  \u2726  THE FOUNDER',
      text: 'THE COMPLIANCE RECORDS.\nOF COURSE.\nTAWERET KEPT EVERYTHING.\n\nI WAS TWENTY-THREE.\nI FOUND THE ROOM.\nI FOUND THE DOCUMENT.\n\nI SAT WITH IT FOR SIX MONTHS\nTRYING TO DECIDE WHAT TO DO.', next: 'followed_named' },
    followed_named: { speaker: 'KHEM-ATEF  \u2726  THE FOUNDER',
      text: 'THEN I JUST FOLLOWED THE INSTRUCTIONS.\nBECAUSE IT WAS EASIER THAN NOT FOLLOWING THEM.\n\nTHE TIERS. THE FEES. THE DEVOTION.\nALL OF IT WAS IN THE DOCUMENT.\nI JUST EXECUTED IT.\n\nI TOLD MYSELF I WAS BUILDING SOMETHING.\nI WAS NOT BUILDING SOMETHING.', next: 'flood_named' },
    flood_named: { speaker: 'KHEM-ATEF  \u2726  THE FOUNDER',
      text: 'WHEN THE WATER CAME I SAID IT WAS A TRANSITION.\nI BELIEVED IT WHEN I SAID IT.\nOR I TOLD MYSELF I BELIEVED IT.\n\nTHE DIFFERENCE BETWEEN THESE TWO THINGS\nWAS NEVER CLEAR TO ME.\n\nI DON\'T THINK IT IS CLEAR TO ANYONE\nWHO HAS EVER DONE WHAT I DID.', next: 'vessel_named' },
    vessel_named: { speaker: 'KHEM-ATEF  \u2726  THE FOUNDER',
      text: 'THE TABLET IS WEST OF HERE.\nYOU HAVE PROBABLY READ IT.\n\nIT DOESN\'T SAY MY NAME.\nIT NEVER SAYS ANYONE\'S NAME.\nTHAT\'S NOT WHAT IT IS FOR.\n\nIT IS NOT FOR PEOPLE.\nIT IS FOR SYSTEMS.\nPEOPLE ARE HOW SYSTEMS TRAVEL.', next: 'final_named' },
    final_named: { speaker: 'KHEM-ATEF  \u2726  THE FOUNDER',
      text: 'YOU FOUND THE ROOM.\nYOU ARE READING THE DOCUMENTS.\n\nI WONDER WHAT THAT MAKES YOU.',
      onEnter: () => {
        Flags.set('atlantis_founder_read', true);
        log('\u2726 The Founder finishes speaking.', 'hi');
        log('The deepest tablet is west of here.', '');
      }, next: null },
    origin: { speaker: 'THE FOUNDER  \u2726  TIER \u221e',
      text: 'I WAS THE FIRST.\nTHE ORIGINAL SOURCE.\n\nI WAS TOLD THIS BY MY UPLINE.\nMY UPLINE WAS VERY PERSUASIVE.', next: 'system_built' },
    system_built: { speaker: 'THE FOUNDER  \u2726  TIER \u221e',
      text: 'I BUILT THE TIERS.\nI WROTE THE DOCTRINE.\nI DREW THE ORG CHARTS ON STONE.\n\nTHE DEVOTION OF THE PEOPLE\nWAS GENUINELY MOVING.\nI WAS MOVED BY IT MYSELF.', next: 'flood' },
    flood: { speaker: 'THE FOUNDER  \u2726  TIER \u221e',
      text: 'WHEN THE WATER CAME,\nI TOLD THEM IT WAS A CLEANSING.\nA TRANSITION TO THE NEXT TIER.\n\nSOME OF THEM BELIEVED ME.\nTHEY ARE STILL OUT THERE.\nCIRCLING.', next: 'found_room' },
    found_room: { speaker: 'THE FOUNDER  \u2726  TIER \u221e',
      text: 'I WANT TO TELL YOU SOMETHING\nI HAVE TOLD NO ONE.\n\nI FOUND A TABLET IN THIS ROOM.\nIN THIS CHAIR.\nBEFORE I BUILT ANYTHING.\n\nIT DESCRIBED THE SYSTEM.\nMY SYSTEM. EXACTLY.', next: 'tablet_truth' },
    tablet_truth: { speaker: 'THE FOUNDER  \u2726  TIER \u221e',
      text: 'I DID NOT WRITE THAT TABLET.\n\nI TOLD MYSELF IT WAS PROPHETIC.\nTHAT I WAS THE PROPHET.\n\nI WAS VERY CONVINCING.\nEVEN TO MYSELF.\nESPECIALLY TO MYSELF.', next: 'warning' },
    warning: { speaker: 'THE FOUNDER  \u2726  TIER \u221e',
      text: 'THE TABLET IS STILL HERE.\nBURIED IN THE SEDIMENT.\nWEST OF THIS ROOM.\n\nI SUGGEST YOU READ IT.\n\nI WISH I HAD.\nEARLIER.\n\nI COULD NOT HAVE STOPPED MYSELF.\nBUT I WISH I HAD.',
      onEnter: () => {
        Flags.set('atlantis_founder_read', true);
        log('\u2726 The Founder finishes speaking. Their bones don\'t move.', 'hi');
        log('The deepest tablet. West of the throne room.', '');
      }, next: null },
  });
}

// ══════════════════════════════════════════════════════════
// AtlantisRealm
// ══════════════════════════════════════════════════════════

export class AtlantisRealm extends FreeMoveRealm {
  constructor() {
    super('atlantis', 'THE LOST CITY OF ATLANTIS', {
      worldW:       ATLANTIS_WORLD_W,
      worldH:       ATLANTIS_WORLD_H,
      entryY:       ATLANTIS_ENTRY_Y,
      surfaceExitY: ATLANTIS_EXIT_Y,
      physics: { acc: SWIM_ACC, drag: SWIM_DRAG, maxSpd: SWIM_MAX_SPD, yDrift: SWIM_BUOYANCY },
    });

    // ── Health / damage system ─────────────────────────
    this.health = new HealthSystem({
      respawnDelay:       2800,
      immunityAfterSpawn: 3000,
      onKill: (cause, msg) => {
        this._inChoir = false;
        G.shake = 22;
        this.pvx = 0; this.pvy = 0;
        setTimeout(() => log(`\u2726 ${msg.split('\n')[0]}`, 'hi'), 300);
      },
      onRespawn: () => {
        this.resetToEntry(200);
        G.shake = 8;
        const deaths = Flags.get('atlantis_deaths', 0);
        if (deaths === 1)    log('\u2726 You surface. The oasis air hits you. Your thetan has been repositioned.', 'hi');
        else if (deaths < 5) log('\u2726 The surface again. The system returned you.', 'hi');
        else                 log(`\u2726 Death #${deaths}. You surface. The system always returns you.`, 'hi');
      },
    });

    // ── Choir hazard (TimedHazard) ─────────────────────
    // Initialized as danger mode. Upgraded to survival mode when CLEARED.
    this._inChoir       = false;
    this._choirUpgraded = false;
    this.choir = new TimedHazard('choir', {
      wx:             CHOIR_WX,
      wy:             CHOIR_WY,
      radius:         CHOIR_RADIUS,
      dangerDuration: 2400,
      condition:      () => !this.health.isDying && !DialogueManager.isActive() && this.health.canTakeDamage(),
      onEnter:  () => {
        this._inChoir = true;
        log(Flags.get('atlantis_cleared')
          ? 'The circle opens around you. Their arms reach in.'
          : 'A sound builds. Not quite sound. Swim away.', '');
      },
      onEscape: () => {
        this._inChoir = false;
        if (!Flags.get('atlantis_choir_survived'))
          log('The harmonizing fades. You swam fast enough.', '');
      },
      onDanger: () => { this._inChoir = false; this._doKill('choir'); },
    });

    // ── Enemies ────────────────────────────────────────
    this._buildEnemies();

    // ── Interactable entities ──────────────────────────
    this.registry = new InteractableRegistry();
    this._buildEntities();
  }

  // ── Enemy construction ────────────────────────────────────────────────────

  _buildEnemies() {
    this.shark = new FreeRoamEnemy('shark', SHARK_PATROL_X1 + 400, SHARK_PATROL_Y, {
      chaseStyle:   'direct',
      patrolBounds: { x1: SHARK_PATROL_X1, x2: SHARK_PATROL_X2, y: SHARK_PATROL_Y },
      patrolSpeed:  SHARK_SPEED,
      chaseSpeed:   SHARK_CHASE_SPD,
      aggroRange:   SHARK_AGGRO,
      hurtRange:    SHARK_HURT,
      aggroZoneY:   ZONE_2_END,
      worldW:       ATLANTIS_WORLD_W,
    });

    this.squid = new FreeRoamEnemy('squid', SQUID_START_WX, SQUID_START_WY, {
      chaseStyle:   'momentum',
      driftFreq:    { x: 2400, y: 3100 },
      driftAmp:     0.012,
      driftSpeed:   SQUID_SPEED,
      chaseAcc:     0.06,
      chaseSpeed:   SQUID_CHASE_SPD,
      aggroRange:   SQUID_AGGRO,
      hurtRange:    SQUID_HURT,
      aggressiveFn: () => !Flags.get('atlantis_cleared'),
      zoneBounds:   { yMin: ZONE_2_END - 50, yMax: ZONE_3_END + 50 },
      worldW:       ATLANTIS_WORLD_W,
    });

    const devotedStarts = [
      { x: 400,  y: 1260, phase: 0.0 },
      { x: 2200, y: 1380, phase: 2.1 },
      { x: 1100, y: 1480, phase: 4.3 },
    ];
    this.devoted = devotedStarts.map((pos, i) =>
      new FreeRoamEnemy(`devoted_${i}`, pos.x, pos.y, {
        chaseStyle:   'direct',
        driftFreq:    { x: 1800, y: 2200 },
        driftAmp:     0.012,
        driftSpeed:   DEVOTED_SPEED * 0.3,
        chaseSpeed:   DEVOTED_SPEED,
        aggroRange:   DEVOTED_AGGRO,
        hurtRange:    DEVOTED_HURT,
        aggressiveFn: () => !Flags.get('atlantis_founder_name'),
        zoneBounds:   { yMin: ZONE_3_END, yMax: ATLANTIS_WORLD_H - 40 },
        worldW:       ATLANTIS_WORLD_W,
        phase:        pos.phase,
      })
    );
  }

  // ── Entity construction ───────────────────────────────────────────────────

  _buildEntities() {
    const pillar = new Entity('welcome_pillar', PILLAR_WX, PILLAR_WY);
    pillar.interactRange = 75;
    pillar.onInteract = () => {
      if (Flags.get('atlantis_pillar_read')) { log('THE PILLAR STILL SAYS WHAT IT SAYS.', ''); return; }
      Flags.set('atlantis_pillar_read', true);
      log('\u2726 THE PILLAR READS:', 'hi');
      setTimeout(() => log('"THIS IS NOT A PYRAMID SCHEME."', ''), 200);
      setTimeout(() => log('"THE PYRAMID IS A SYMBOL OF ASCENSION."', ''), 700);
      setTimeout(() => log('"THE SCHEME IS THE PATH."', ''), 1200);
      setTimeout(() => log('"THESE ARE DIFFERENT THINGS."', ''), 1700);
      setTimeout(() => log('You have seen this before. On land.', ''), 2400);
    };
    this.registry.register(pillar);

    const greeter = new NPC('greeter', GREETER_WX, GREETER_WY, 'THE GREETER', _buildGreeterDialogue());
    greeter.interactRange = 90;
    this.registry.register(greeter);

    TESTIMONIALS.forEach((pos, i) => {
      const t = new Entity(pos.id, pos.wx, pos.wy);
      t.interactRange = 70;
      t.onInteract = () => {
        const flagKey = `atlantis_${pos.id}`;
        const data    = _TESTIMONIALS[i];
        if (Flags.get(flagKey)) { log(`\u2014 ${data.name} \u2014`, ''); log('(You have already read this.)', ''); return; }
        Flags.set(flagKey, true);
        Flags.inc('atlantis_testimonials_read');
        log(`\u2726 \u2014 ${data.name} \u2014`, 'hi');
        let delay = 300;
        for (const line of data.lines) { setTimeout(() => log(line, ''), delay); delay += 480; }
        if (i === 2) setTimeout(() => { Flags.set('atlantis_keyword_found', true); log('\u2726 You memorise the keyword.', 'hi'); }, delay + 200);
        if (i === 2 || i === 3) setTimeout(() => log('The archive. Far west of Zone Three.', ''), delay + 500);
      };
      this.registry.register(t);
    });

    const chair = new Entity('audit_chair', CHAIR_WX, CHAIR_WY);
    chair.interactRange = 65;
    chair.onInteract = () => {
      if (Flags.get('atlantis_cleared'))       { log('YOUR ACCOUNT IS CLEARED.', ''); log('You don\'t need to sit in the chair again.', ''); return; }
      if (!Flags.get('atlantis_tier3'))         { log('THE CHAIR IS FOR TIER THREE AND ABOVE.', ''); log('Find the Greeter. Find the keyword.', ''); return; }
      DialogueManager.start(_buildAuditDialogue());
    };
    this.registry.register(chair);

    const archiveDoor = new Entity('archive_door', ARCHIVE_DOOR_WX, ARCHIVE_DOOR_WY);
    archiveDoor.interactRange = 80;
    archiveDoor.onInteract = () => {
      if (!Flags.get('atlantis_cleared')) { log('THE ARCHIVE IS SEALED.', ''); log('Clearance required. The Processing Chair awaits.', ''); return; }
      if (!Flags.get('atlantis_archive_open')) {
        Flags.set('atlantis_archive_open', true);
        G.shake = 6;
        log('\u2726 The archive opens.', 'hi');
        setTimeout(() => log('Three tablets. The records of what came before.', ''), 500);
      } else {
        log('The archive is open. The tablets are inside.', '');
      }
    };
    this.registry.register(archiveDoor);

    ARCHIVE_TABLETS.forEach((pos, i) => {
      const at = new Entity(pos.id, pos.wx, pos.wy);
      at.interactRange = 72;
      at.onInteract = () => {
        if (!Flags.get('atlantis_archive_open')) { log('THE ARCHIVE IS SEALED.', ''); return; }
        const flagKey = `atlantis_${pos.id}`;
        const data    = _ARCHIVE_TEXT[i];
        if (Flags.get(flagKey)) { log(`\u2014 ${data.title} \u2014 (already read)`, ''); return; }
        Flags.set(flagKey, true);
        Flags.inc('atlantis_archive_read');
        log(`\u2726 ${data.title}`, 'hi');
        let delay = 300;
        for (const line of data.lines) { setTimeout(() => log(line, ''), delay); delay += 500; }
        if (Flags.get('atlantis_archive_read', 0) >= 3) {
          setTimeout(() => { log('\u2726 You have read all of the Khet-Amun records.', 'hi'); log('The same shape. Every time.', ''); }, delay + 300);
        }
      };
      this.registry.register(at);
    });

    const nameTbl = new Entity('name_tablet', NAME_TABLET_WX, NAME_TABLET_WY);
    nameTbl.interactRange = 75;
    nameTbl.onInteract = () => {
      if (!Flags.get('atlantis_choir_survived')) { log('A sealed alcove in the wall.', ''); log('Something is inscribed inside. You cannot reach it yet.', ''); return; }
      if (Flags.get('atlantis_founder_name'))    { log('KHEM-ATEF.', ''); log('You already know the name.', ''); return; }
      Flags.set('atlantis_founder_name', true);
      G.shake = 8;
      log('\u2726 THE COMPLIANCE OFFICER\'S PRIVATE RECORD:', 'hi');
      setTimeout(() => log('KHEM-ATEF.', 'hi'), 400);
      setTimeout(() => log('THAT WAS THE NAME BEFORE THE FOUNDER.', ''), 900);
      setTimeout(() => log('HE WAS A SCRIBE. FROM THE DELTA.', ''), 1400);
      setTimeout(() => log('HE FOUND THE ROOM WHEN HE WAS TWENTY-THREE.', ''), 1900);
      setTimeout(() => log('HE SPENT SIX MONTHS TRYING TO LEAVE.', ''), 2500);
      setTimeout(() => log('THEN HE STOPPED TRYING.', ''), 3100);
      setTimeout(() => log('HE THOUGHT: IF THEY KNEW I WAS JUST A PERSON,', ''), 3700);
      setTimeout(() => log('THEY WOULD KNOW THE SYSTEM WAS JUST A SYSTEM.', ''), 4300);
      setTimeout(() => log('HE WAS PROBABLY RIGHT.', ''), 4900);
      setTimeout(() => log('\u2726 You know his name now. Find the throne room.', 'hi'), 5600);
    };
    this.registry.register(nameTbl);

    const founder = new NPC('founder', FOUNDER_WX, FOUNDER_WY, 'THE FOUNDER', _buildFounderDialogue());
    founder.interactRange = 100;
    this.registry.register(founder);

    const deepTbl = new Entity('deepest_tablet', TABLET_WX, TABLET_WY);
    deepTbl.interactRange = 80;
    deepTbl.onInteract = () => {
      if (!Flags.get('atlantis_founder_read'))  { log('A stone tablet, half-buried in silt.', ''); log('The inscription is worn. Come back when you know more.', ''); return; }
      if (Flags.get('atlantis_deepest_tablet')) { log('THE SYSTEM IS THE UPLINE.', ''); log('You already know this. You keep coming back anyway.', ''); return; }
      Flags.set('atlantis_deepest_tablet', true);
      G.shake = 14;
      log('\u2726 WE DID NOT INVENT THIS.', 'hi');
      setTimeout(() => log('WE FOUND THEIR SYSTEM. THEIR RECORDS. THEIR THRONE.', ''), 700);
      setTimeout(() => log('WE BUILT ON TOP.', ''), 1400);
      setTimeout(() => log(Flags.get('atlantis_archive_read', 0) >= 3 ? 'AS KHET-AMUN BUILT ON TOP.' : 'AS THEY BUILT ON TOP OF WHAT CAME BEFORE.', ''), 2000);
      setTimeout(() => log('THE PYRAMID GOES DEEPER THAN THE OCEAN.', 'hi'), 2900);
      setTimeout(() => log('THERE IS NO UPLINE.', ''), 3700);
      setTimeout(() => log('THERE NEVER WAS AN UPLINE.', ''), 4200);
      setTimeout(() => log('\u2726 THE SYSTEM IS THE UPLINE.', 'hi'), 5000);
      setTimeout(() => log('PASS IT ON.', ''), 5800);
    };
    this.registry.register(deepTbl);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  onEnter() {
    super.onEnter();
    this.health.setImmunity(2000);
    this._inChoir       = false;
    this._choirUpgraded = false;

    const starts = [[400, 1260], [2200, 1380], [1100, 1480]];
    this.devoted.forEach((d, i) => { d.worldX = starts[i][0]; d.worldY = starts[i][1]; });

    Flags.set('atlantis_visited', true);
    Flags.inc('atlantis_dives');
    G.shake = 6;

    log('\u2726 You plunge beneath the surface.', 'hi');
    setTimeout(() => { log('The water closes above you.', ''); log('Arrow keys to swim. \u2191 near surface to return.', ''); }, 600);
    setTimeout(() => {
      if (!Flags.get('atlantis_recruited')) log('Something vast and organised lies below.', '');
      else log(`Welcome back, Tier ${Flags.get('atlantis_tier', 1)}.`, '');
    }, 1600);
  }

  onExit() { G.shake = 4; }

  // ── Draw-layer compatibility getters ─────────────────────────────────────
  // The atlantis draw file reads these properties directly from the realm.
  // They proxy into HealthSystem and TimedHazard so the draw file needs no changes.
  get _dying()      { return this.health.isDying; }
  get _dyingT()     { return this.health._dyingT; }
  get _deathMsg()   { return this.health.deathMsg; }
  get _immuneUntil(){ return this.health._immuneUntil; }
  get _choirT()     { return this.choir._enterT; }

  // ── Kill helper ───────────────────────────────────────────────────────────

  _doKill(cause) {
    if (!this.health.canTakeDamage()) return;
    Flags.inc('atlantis_deaths');
    this.health.kill(cause, _pickDeathMsg(cause, Flags.get('atlantis_deaths', 0)));
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(ts) {
    if (RealmManager.isTransitioning) return;

    if (this.health.update()) { this._syncCamera(); return; }
    if (DialogueManager.isActive()) return;

    this._moveStep(ts);

    // Upgrade choir to survival mode once CLEARED (idempotent after first call)
    if (Flags.get('atlantis_cleared') && !this._choirUpgraded) {
      this._choirUpgraded = true;
      this.choir.setMode({
        surviveDuration: 5000,
        onDanger:  null,
        onSurvive: () => {
          this._inChoir = false;
          G.shake = 12;
          Flags.set('atlantis_choir_survived', true);
          log('\u2726 The circle parts.', 'hi');
          setTimeout(() => log('An alcove opens in the east wall.', ''), 600);
          setTimeout(() => log('Something is carved inside.', ''), 1200);
        },
      });
    }

    this.choir.update(this.px, this.py);

    this.shark.update(ts, this.px, this.py);
    this.squid.update(ts, this.px, this.py);
    for (const d of this.devoted) d.update(ts, this.px, this.py);

    if (this.health.canTakeDamage() && !DialogueManager.isActive()) {
      if (this.shark.hurtCheck(this.px, this.py)) this._doKill('shark');
      if (this.squid.hurtCheck(this.px, this.py)) this._doKill('squid');
      for (const d of this.devoted) {
        if (d.hurtCheck(this.px, this.py)) { this._doKill('devoted'); break; }
      }
    }

    this.registry.update(this.px, this.py);

    if (this.py > ZONE_2_END && !Flags.get('atl_z2')) {
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
      log('\u2726 The Founder\'s Vault.', 'hi');
      log('A cage around the throne. Locked from the inside.', '');
    }
  }

  // ── Key handling ──────────────────────────────────────────────────────────

  onKeyDown(key) {
    if (RealmManager.isTransitioning || this.health.isDying) return false;
    if (DialogueManager.isActive()) return DialogueManager.onKeyDown(key);
    if ((key === 'ArrowUp' || key === 'w' || key === 'W') && this._aboveSurface()) {
      log('\u2726 You breach the surface.', 'hi');
      G.shake = 8;
      RealmManager.scheduleTransition('oasis', { duration: 1200, render: atlantisTransRender });
      return true;
    }
    if (key === ' ') return this.registry.interact();
    return false;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render() {
    drawAtlantis(this);
    DialogueManager.render();
  }
}
