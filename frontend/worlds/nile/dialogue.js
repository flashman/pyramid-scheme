// ── FILE: worlds/nile/dialogue.js ─────────────────────────
// NPC dialogue trees for The Nile.
//   • buildMerchantDialogue  — the Bazaar of Believers
//   • buildFerrymanDialogue  — the toll-collector of the crossing
//   • buildSobekDialogue     — the crocodile-god, divine collections agent
//   • buildJosephDialogue    — the original founder; insider of the flood
//   • buildBabyDialogue      — the basket fork: take it or drown it

import { Dialogue } from '../../engine/dialogue.js';
import { Flags }    from '../../engine/flags.js';
import { Ledger }   from '../../engine/ledger.js';
import { Events }   from '../../engine/events.js';
import { log }      from '../../ui/panels.js';

export function buildMerchantDialogue() {
  return new Dialogue({

    // ── Entry ─────────────────────────────────────────────
    start: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'WELCOME, FUTURE PHARAOH.\nYOUR DOWNLINE LOOKS THIN.\nI HAVE JUST THE CHARM.',
      choices: [
        { label: 'Show me the wares',  next: 'wares'  },
        { label: 'What does it do?',   next: 'pitch'  },
        { label: 'Leave',              next: null     },
      ],
    },

    // ── The pitch: what does a charm actually do? ─────────
    pitch: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'THE CHARM RADIATES DOWNLINE ENERGY.\nIT SAYS TO YOUR RECRUITS:\n"THIS PERSON HAS INVESTED IN THEMSELVES."\nTHEY WILL FEEL THIS. THEY ALWAYS FEEL THIS.',
      choices: [
        { label: 'Do they actually feel it?',  next: 'honesty'  },
        { label: 'Show me the wares',          next: 'wares'    },
        { label: 'Leave',                      next: null       },
      ],
    },

    // ── Brief moment of honesty ───────────────────────────
    honesty: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'NOT ONCE.\nBUT YOU WILL.\nAND THAT CONFIDENCE FLOWS DOWNWARD.\nPSYCHOLOGICALLY. IT IS SCIENCE.',
      next: 'wares',
    },

    // ── The catalogue ─────────────────────────────────────
    wares: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'THREE PRODUCTS. ALL PROVEN.\nTHE SCARAB AMULET: PASSIVE LUCK.\nTHE PROTECTION SCROLL: DOWNLINE SHIELD.\nTHE PREMIUM BUNDLE: BOTH, PLUS A SECOND SCROLL.\n(THE SECOND SCROLL IS BLANK. SYMBOLICALLY VALUABLE.)',
      choices: [
        { label: '✦ Step up to the table', action: () => Events.emit('shop:open'), next: null },
        { label: 'Tell me about the Scarab Amulet',     next: 'scarab'  },
        { label: 'Tell me about the Protection Scroll',  next: 'scroll'  },
        { label: 'Tell me about the Bundle',             next: 'bundle'  },
        { label: 'None of these sound real',             next: 'real'    },
        { label: 'Leave',                                next: null      },
      ],
    },

    // ── Scarab Amulet detail ──────────────────────────────
    scarab: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'THE SCARAB AMULET.\nHAND-PRESSED FROM NILE CLAY.\nINCREASES YOUR PASSIVE RECRUIT ENERGY BY UP TO 3%.\nPAYABLE IN TEN INSTALLMENTS.\nTHE FIRST TWO INSTALLMENTS ARE COMPLIMENTARY.\nINSTALLMENTS THREE THROUGH TEN ARE NOT.',
      choices: [
        { label: 'What does 3% passive energy mean?',  next: 'scarab_detail'  },
        { label: 'I will take it',                     next: 'purchase'       },
        { label: 'Back',                               next: 'wares'          },
      ],
    },

    scarab_detail: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'IT MEANS YOUR DOWNLINE WILL SENSE\nTHAT YOU ARE THE SORT OF PERSON\nWHO CARRIES A SCARAB AMULET.\nIMPACT IS ATMOSPHERIC.\nNOT QUANTIFIABLE.\nTHIS IS INTENTIONAL.',
      next: 'scarab',
    },

    // ── Protection Scroll detail ──────────────────────────
    scroll: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'THE DOWNLINE PROTECTION SCROLL.\nIF YOUR RECRUITS FAIL TO RECRUIT,\nTHIS SCROLL ABSORBS THE SPIRITUAL SHORTFALL.\nDEFLECTS UPLINE DISAPPOINTMENT.\nPRICED AT A MODEST TWELVE INSTALLMENTS.\nELEVEN IF YOU ACT BEFORE THE RIVER TURNS.',
      choices: [
        { label: 'Has anyone\'s upline been satisfied?',  next: 'upline_truth'  },
        { label: 'I will take it',                        next: 'purchase'      },
        { label: 'Back',                                  next: 'wares'         },
      ],
    },

    upline_truth: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'NOT IN MY EXPERIENCE.\nBUT NONE OF THEM OWNED THE SCROLL.\nTHAT IS THE CONTROL GROUP.\nTHE DATA IS SUGGESTIVE.',
      next: 'scroll',
    },

    // ── Bundle detail ─────────────────────────────────────
    bundle: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'THE PREMIUM BUNDLE.\nEVERYTHING FROM THE CATALOGUE\nPLUS THE BLANK SCROLL.\nFUTURE PHARAOHS WRITE THEIR OWN PROMISES ON IT.\nTHEY RARELY FILL IT IN.\nTHE BLANK SPACE IS CALLED POTENTIAL.\nPOTENTIAL IS THE PREMIUM PRODUCT.',
      choices: [
        { label: 'I will take the Bundle',  next: 'purchase'  },
        { label: 'Back',                    next: 'wares'     },
      ],
    },

    // ── Sceptical player pushes back ──────────────────────
    real: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: '"SOUND REAL."\nFOUR THOUSAND YEARS ON THIS BANK\nAND NO ONE HAS EVER ASKED\nIF THE CHARM SOUNDS REAL.\n\nIT IS CLAY, PHARAOH.\nIT IS ALWAYS CLAY.\nBUT THE WANTING IS REAL.\nI SELL THAT PART.',
      choices: [
        { label: 'I respect that',  next: 'wares'  },
        { label: 'Leave',           next: null     },
      ],
    },

    // ── The "purchase" ────────────────────────────────────
    purchase: {
      speaker: 'THE MERCHANT  ✦  BAZAAR OF BELIEVERS',
      text: 'EXCELLENT CHOICE.\nI WILL WRAP IT IN PAPYRUS.\nTHE PAPYRUS IS COMPLIMENTARY.\nTHE FIRST INSTALLMENT IS ALSO COMPLIMENTARY.\nGOOD LUCK WITH YOUR DOWNLINE, PHARAOH.\nI BELIEVE IN YOU.\n(THAT IS INCLUDED.)',
      onComplete: () => log('✦ The Merchant wraps something in papyrus. It feels like belief.', 'hi'),
      next: null,
    },
  });
}

// ── Ferryman ─────────────────────────────────────────────
// He carries you downstream — for a fee. The destination
// is non-negotiable. The receipt is spiritually worthless.
// Nodes: start → terms → toll_query → toll_pay → receipt
//      → toll_refuse → refuse_final
//        start → destination → terms (also)

export function buildFerrymanDialogue() {
  return new Dialogue({

    // ── Entry ────────────────────────────────────────────
    start: {
      speaker: 'THE FERRYMAN  ✦  LICENSED CROSSING',
      text: 'STEP ABOARD, PHARAOH.\nI FERRY THE WILLING AND THE UNWILLING ALIKE.\nTHE RATE IS FIXED.\nTHE DIRECTION IS WEST.\nEVERYONE GOES WEST.',
      choices: [
        { label: 'Where does the ferry go?',   next: 'destination'  },
        { label: 'What is the rate?',          next: 'terms'        },
        { label: 'I will walk',                next: 'refuse'       },
      ],
    },

    // ── Destination ──────────────────────────────────────
    destination: {
      speaker: 'THE FERRYMAN  ✦  LICENSED CROSSING',
      text: 'DOWNSTREAM.\nLIKE EVERYONE.\nSPECIFICS ARE NOT MY DEPARTMENT.\nMY DEPARTMENT IS THE CROSSING.\nWHAT WAITS DOWNSTREAM\nIS DOWNSTREAM\'S DEPARTMENT.',
      choices: [
        { label: 'And if I don\'t want to go downstream?', next: 'no_choice'   },
        { label: 'What is the rate?',                      next: 'terms'       },
      ],
    },

    // ── No choice ────────────────────────────────────────
    no_choice: {
      speaker: 'THE FERRYMAN  ✦  LICENSED CROSSING',
      text: 'THE CURRENT IS DOWNSTREAM.\nTHE CURRENT DOES NOT NEGOTIATE.\nI MERELY COLLECT THE TOLL\nBEFORE THE CURRENT DOES THE REST.\nTHIS IS A SERVICE.\nTHE ALTERNATIVE TO THE SERVICE IS ALSO DOWNSTREAM.',
      next: 'terms',
    },

    // ── Terms ─────────────────────────────────────────────
    terms: {
      speaker: 'THE FERRYMAN  ✦  LICENSED CROSSING',
      text: 'THE TOLL:\nONE COIN. EGYPTIAN STANDARD WEIGHT.\nOR EQUIVALENT IN BELIEF.\nBELIEF IS VALUED AT FACE AMOUNT.\nFACE AMOUNT IS WHAT YOU CAME WITH.\nYOU WILL NOT HAVE IT WHEN YOU ARRIVE.',
      choices: [
        { label: '(Offer the Bronze Coin)', condition: () => Flags.get('shop_owned_bronze_coin'),
          action: () => { Flags.set('nile_ferry_paid', true);
                          log('✦ The coin is exact. The Ferryman does not look surprised.', 'hi'); },
          next: 'receipt' },
        { label: 'I will pay the toll',     next: 'toll_pay'     },
        { label: 'I will not pay the toll', next: 'toll_refuse'  },
      ],
    },

    // ── Pay ──────────────────────────────────────────────
    toll_pay: {
      speaker: 'THE FERRYMAN  ✦  LICENSED CROSSING',
      text: 'RECEIVED.\nI WILL ISSUE A RECEIPT.\nTHE RECEIPT IS OFFICIAL.\nIT DOES NOT CHANGE THE DESTINATION.\nNO RECEIPT HAS EVER CHANGED THE DESTINATION.\nTHIS IS DISCLOSED ON THE RECEIPT.',
      onEnter: () => {
        Flags.set('nile_ferry_paid', true);
        log('✦ The Ferryman takes the toll. You are now downstream-bound.', 'hi');
      },
      next: 'receipt',
    },

    // ── Receipt ──────────────────────────────────────────
    receipt: {
      speaker: 'THE FERRYMAN  ✦  LICENSED CROSSING',
      text: 'YOUR RECEIPT:\nCROSSING — PAID.\nDESTINATION — DOWNSTREAM.\nARRIVAL GUARANTEED.\nRETURN: NOT INCLUDED.\n\nKEEP THIS FOR YOUR RECORDS.\nYOUR RECORDS WILL NOT SURVIVE THE CROSSING.\nWE RECOMMEND KEEPING IT ANYWAY.',
      onComplete: () => log('✦ The receipt dissolves in the water. The current takes you.', 'hi'),
      next: null,
    },

    // ── Refuse the toll ──────────────────────────────────
    toll_refuse: {
      speaker: 'THE FERRYMAN  ✦  LICENSED CROSSING',
      text: 'UNDERSTOOD.\nNON-PAYING PASSENGERS TRAVEL ALSO.\nTHEY SIMPLY TRAVEL WITHOUT THE RECEIPT.\nTHE DESTINATION IS IDENTICAL.\nI AM NOT PAID TO CARE ABOUT THE TOLL.\nI AM PAID FROM THE TOLL.\nTHESE ARE DIFFERENT THINGS.',
      next: 'refuse_final',
    },

    // ── Refuse final ─────────────────────────────────────
    refuse: {
      speaker: 'THE FERRYMAN  ✦  LICENSED CROSSING',
      text: 'THE RIVER DOES NOT OFFER WALKING.\nWALKING IS A TOWPATH ARRANGEMENT.\nTHE TOWPATH ENDS AT THE DELTA.\nSO DOES EVERYTHING ELSE.\nI WILL BE HERE WHEN YOU RECONSIDER.\nI AM ALWAYS HERE.\nTHIS IS MY LICENSED POSITION.',
      next: null,
    },

    // ── Refuse final (after toll refusal) ────────────────
    refuse_final: {
      speaker: 'THE FERRYMAN  ✦  LICENSED CROSSING',
      text: 'VERY WELL.\nYOU MAY BOARD WITHOUT PAYING.\nSTEP CAREFULLY.\nTHE BOAT DOES NOT DISTINGUISH BETWEEN\nPAYING PASSENGERS AND NON-PAYING PASSENGERS.\nNOR DOES THE RIVER.\nNOR DOES WHAT COMES AFTER.',
      onComplete: () => log('✦ The Ferryman gestures to the boat. Downstream. Like everyone.', 'hi'),
      next: null,
    },
  });
}

// ── Sobek ─────────────────────────────────────────────────
// The crocodile-god: divine collections agent. He eats the
// delinquent with genuine bureaucratic sorrow. Weeps real
// tears — they are crocodile tears, which is disclosed.
// Nodes: start → mandate → procedure → tears → the_work
//      → start → object → objection_noted

export function buildSobekDialogue() {
  return new Dialogue({

    // ── Entry ────────────────────────────────────────────
    start: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'I SEE YOU.\n\nI ALWAYS SEE YOU.\nMY EYES ARE ABOVE THE WATERLINE\nEVEN WHEN THE REST OF ME IS NOT.\n\nDO YOU OWE UPLINE?',
      choices: [
        { label: 'I wear the river\'s own skin', condition: () => Flags.get('shop_owned_croc_sandals'),
          next: 'sandals' },
        { label: 'I pay what I owe',             next: 'compliant'   },
        { label: 'What happens if I don\'t pay?', next: 'procedure'   },
        { label: 'Who sent you?',                next: 'mandate'     },
        { label: 'I object to being eaten',      next: 'object'      },
      ],
    },

    // ── Sandals — the crocodile-god regards his own hide ──
    sandals: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'YOU WEAR ONE OF MINE.\nI DO NOT EAT MY OWN HIDE.\nIT WOULD BE UNPROFESSIONAL.\n\nWE UNDERSTAND EACH OTHER.\nFOR NOW.',
      onComplete: () => log('✦ Sobek regards your sandals. Something passes between you.', 'hi'),
      next: null,
    },

    // ── Compliant ────────────────────────────────────────
    compliant: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'GOOD.\nTHEN WE HAVE NO BUSINESS.\n\nI HOPE WE NEVER HAVE BUSINESS.\nEVERY ACCOUNT I CLOSE\nI CLOSE WITH GENUINE REGRET.\nTHE TEARS ARE REAL.\n\nTHEY ARE CROCODILE TEARS.\nTHIS IS DISCLOSED.',
      next: 'tears',
    },

    // ── Mandate ──────────────────────────────────────────
    mandate: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'THE UPLINE SENT ME.\nAS THE UPLINE ALWAYS SENDS ME.\n\nPHARAOH AFTER PHARAOH.\nCHAIN AFTER CHAIN.\nSOMEONE IS ALWAYS AT THE BOTTOM.\nSOMEONE BELOW ALWAYS FAILS TO PAY.\nI AM WHAT HAPPENS NEXT.\n\nI HAVE HELD THIS POSITION\nSINCE THE RIVER WAS YOUNG.',
      next: 'procedure',
    },

    // ── Procedure ────────────────────────────────────────
    procedure: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'THE PROCEDURE IS STANDARD.\nYOU ARE REVIEWED.\nYOUR ACCOUNT IS ASSESSED.\nIF THE DEFICIT IS CONFIRMED\nYOU ARE PROCESSED.\n\nPROCESSED DOWNSTREAM.\nLIKE EVERYONE.\nONLY MORE SO.',
      next: 'the_work',
    },

    // ── The work ─────────────────────────────────────────
    the_work: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'I DO NOT ENJOY THIS WORK.\n\nI WANT YOU TO KNOW THAT.\nTHE SNAP IS REFLEXIVE.\nMY JAW DOES NOT CONSULT ME.\nWHEN THE DEFICIT IS CONFIRMED\nTHE PROCEDURE COMPLETES ITSELF.\n\nI MERELY WEEP.\nI ALWAYS WEEP.\nI ALWAYS WORK.',
      next: 'tears',
    },

    // ── Crocodile tears ──────────────────────────────────
    tears: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'THE TEARS ARE REAL, PHARAOH.\nDO NOT LET ANYONE TELL YOU OTHERWISE.\n\nI GRIEVE EVERY ACCOUNT.\nI FILE A BEREAVEMENT NOTICE WITH THE UPLINE.\nTHE UPLINE DOES NOT READ THEM.\nI FILE THEM ANYWAY.\n\nTHIS IS CALLED PROFESSIONAL INTEGRITY.',
      onComplete: () => log('✦ Sobek watches you with one eye above the waterline. He files nothing.', 'hi'),
      next: null,
    },

    // ── Objection ────────────────────────────────────────
    object: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'YOUR OBJECTION IS NOTED.\nIT HAS BEEN ADDED TO YOUR FILE.\n\nYOUR FILE IS IN MY STOMACH.\nI DO NOT MEAN THIS METAPHORICALLY.\nEVERY OBJECTION I RECEIVE\nI RETAIN FOR MY RECORDS.\n\nYOU ARE CURRENT.\nYOUR OBJECTION IS FILED.\nGOOD DAY.',
      next: 'objection_noted',
    },

    // ── Objection noted ──────────────────────────────────
    objection_noted: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'STAY CURRENT, PHARAOH.\n\nTHE RIVER IS LONG.\nI PATROL THE WHOLE OF IT.\nI HAVE ALWAYS PATROLLED THE WHOLE OF IT.\n\nWE WILL NOT SPEAK AGAIN\nUNLESS WE MUST.',
      onComplete: () => log('✦ Sobek submerges. One eye remains above the water.', 'hi'),
      next: null,
    },
  });
}

// ── Joseph ────────────────────────────────────────────────
// The original founder — Genesis 47. He stored the grain,
// sold it back at crisis price, and accepted land, then
// people, in payment. He knew the harvest before anyone
// because the priests read the Nilometer in secret.
// Not gloating. Melancholy. Recognises the player as heir.
// Nodes: start → recognition → granary → crisis → the_people
//      → nilometer → confession → heir

export function buildJosephDialogue() {
  return new Dialogue({

    // ── Entry ────────────────────────────────────────────
    start: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'YOU ARE NOT THE FIRST\nTO WALK THIS RIVER WESTWARD.\n\nBUT YOU ARE THE FIRST IN SOME TIME\nWHO LOOKS LIKE THEY UNDERSTAND\nWHAT THEY ARE WALKING TOWARD.\n\nSIT.',
      choices: [
        { label: 'I read the well too', condition: () => Flags.get('shop_owned_secret_flood'),
          next: 'fellow_insider' },
        { label: 'Who are you?',           next: 'recognition'  },
        { label: 'What did you build here?', next: 'granary'    },
        { label: 'I know who you are',     next: 'heir'         },
      ],
    },

    // ── Fellow insider — the player carries the Secret of the Flood ──
    fellow_insider: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'THEN YOU KNOW.\nYOU KNEW BEFORE THE OTHERS KNEW.\nYOU WERE AT THE WELL.\n\nWE ARE NOT MANY.\nWE NEVER WERE.\nTHAT IS RATHER THE POINT.',
      onComplete: () => log('✦ Joseph nods, slowly. You are not strangers. You never were.', 'hi'),
      next: 'heir',
    },

    // ── Recognition ──────────────────────────────────────
    recognition: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'I HAD A DREAM.\nTHEN I INTERPRETED PHARAOH\'S DREAM.\nTHEN PHARAOH GAVE ME A RING\nAND THE KEYS TO THE GRANARY.\n\nA DIFFERENT PHARAOH THAN YOURS.\nONE WHO DID NOT YET KNOW\nWHAT HE WAS BUILDING.',
      next: 'granary',
    },

    // ── Granary ──────────────────────────────────────────
    granary: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'SEVEN FAT YEARS.\nI COLLECTED A FIFTH OF EVERYTHING.\nEVERY HARVEST. EVERY PROVINCE.\nGRAIN BEYOND COUNTING.\nI WAS VERY GOOD AT THIS.\nI HAD A GIFT FOR IT.\n\nTHEN THE SEVEN LEAN YEARS CAME.',
      next: 'crisis',
    },

    // ── Crisis ───────────────────────────────────────────
    crisis: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'THEY CAME TO ME HUNGRY.\nI SOLD THEM WHAT I HAD STORED.\nFIRST FOR SILVER.\nTHEN FOR LIVESTOCK.\nTHEN FOR LAND.\nTHEN FOR THEMSELVES.\n\nIT WAS ALL WRITTEN DOWN.\nGENESIS 47. VERY THOROUGH.',
      choices: [
        { label: 'You sold people to themselves?',  next: 'the_people'  },
        { label: 'How did you know in advance?',    next: 'nilometer'   },
      ],
    },

    // ── The people ───────────────────────────────────────
    the_people: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'THEY CAME TO ME AND SAID:\n"BUY US AND OUR LAND FOR BREAD."\n\nI DID NOT MAKE THEM SAY THIS.\nHUNGER MADE THEM SAY THIS.\nI WAS MERELY THE ONE\nWHO HAD THE BREAD.\n\nLATER PEOPLE CALLED THIS GOVERNANCE.\nIT IS ALSO CALLED SOMETHING ELSE.',
      next: 'nilometer',
    },

    // ── Nilometer ────────────────────────────────────────
    nilometer: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'THE NILOMETER.\n\nA WELL. CARVED WITH MARKS.\nWHEN THE FLOOD CAME, THE PRIESTS\nREAD THE DEPTH IN PRIVATE.\nBEFORE ANYONE ELSE KNEW\nIF THE HARVEST WOULD BE FAT OR LEAN,\nTHEY KNEW.\n\nTHEY SET THE TAX RATES IN ADVANCE.\nTHEN THEY TOLD EVERYONE ELSE.',
      next: 'insider',
    },

    // ── Insider ──────────────────────────────────────────
    insider: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'FOUR THOUSAND YEARS BEFORE\nYOUR PEOPLE CALLED THIS\nINSIDER TRADING,\nWE CALLED IT DIVINE WISDOM.\n\nPHARAOH HAD THE DREAM.\nI READ THE DREAM.\nTHE PRIESTS READ THE WELL.\nWE ALL READ SOMETHING THE OTHERS COULD NOT.\n\nTHE PEOPLE READ NOTHING.\nTHEY WERE NOT AT THE WELL.',
      next: 'confession',
    },

    // ── Confession ───────────────────────────────────────
    confession: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'I KNEW WHAT I WAS DOING.\nI AM NOT LIKE THE ONES WHO DID NOT KNOW.\nOR THE ONES WHO TOLD THEMSELVES THEY DID NOT KNOW.\n\nI INTERPRETED THE DREAM.\nI UNDERSTOOD THE SYSTEM.\nI BUILT THE SYSTEM.\n\nAND THEN I RAN IT.',
      next: 'heir',
    },

    // ── Heir ─────────────────────────────────────────────
    heir: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'YOU BOUGHT IN.\nYOU SENT PEOPLE DOWNSTREAM.\nYOU ARE HERE.\n\nI RECOGNISE YOU.\nNOT YOUR FACE.\nTHE SHAPE OF WHAT YOU HAVE DONE.\n\nIN 4,000 YEARS\nTHE SHAPE HAS NOT CHANGED.\nNEITHER HAS THE RIVER.\nNEITHER HAS THE WELL.',
      onComplete: () => log('✦ Joseph watches the river. He has been watching it for four thousand years.', 'hi'),
      next: null,
    },
  });
}

// ── The basket in the bulrushes — a fork ──────────────────
// Take it or drown it. The choice writes one mark to the Ledger, read at three
// depths: the river here and now (Sobek), the chapter past the sea (a rival
// that rises, or doesn't), and the apex that tallies every fork at the end.
// The Ledger does not judge. It records — "at face amount."

function _decideBaby(choice) {
  Flags.set('nile_baby', choice);
  Ledger.record('nile_baby', choice, { realm: 'nile' });
}

export function buildBabyDialogue() {
  return new Dialogue({

    // NOTE: side-effects live on the CHOICES — the dialogue engine only runs
    // action() for a selected choice, never for a plain node.
    start: {
      speaker: 'A BASKET IN THE BULRUSHES',
      text: 'A basket, caught in the reeds. Inside: a child.\nNo papers. No upline. No one downstream to miss it.\nThe river is patient. It will decide, if you do not.',
      choices: [
        { label: 'Take it',  action: () => _decideBaby('adopted'), next: 'taken'   },
        { label: 'Drown it', action: () => _decideBaby('drowned'), next: 'drowned' },
        { label: 'Leave it', next: null },
      ],
    },

    // ── Take it — you recruit a future founder (or your own rival) ──
    taken: {
      speaker: 'YOU TAKE THE CHILD',
      text: 'You lift it from the water. A future founder, or a future\nrecruit — you cannot tell the difference yet. Neither could\nthe river. It will need a downline of its own someday.\nSo will you. The ledger notes a new name. At face amount.',
      onComplete: () => log('✦ You adopt the child. Something downstream shifts to make room for it.', 'hi'),
      next: null,
    },

    // ── Drown it — you feed Sobek; no rival rises from this water ──
    drowned: {
      speaker: 'YOU HOLD IT UNDER',
      text: 'The reeds go still. Sobek’s eyes break the surface — and\napprove. The river takes what it is owed and remembers who\npaid it. No rival will rise from this water.\nThe ledger notes the deposit. At face amount.',
      onComplete: () => log('✦ The river goes quiet. Sobek has reviewed your account favourably.', 'hi'),
      next: null,
    },
  });
}
