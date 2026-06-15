// ── FILE: worlds/nile/dialogue.js ─────────────────────────
// The Merchant — Bazaar of Believers dialogue tree.
// A fast-talking huckster selling downline-insurance charms
// and scarab amulets on installments. The upsell is the joke.

import { Dialogue } from '../../engine/dialogue.js';
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
        { label: 'Tell me about the Scarab Amulet',    next: 'scarab'  },
        { label: 'Tell me about the Protection Scroll', next: 'scroll'  },
        { label: 'Tell me about the Bundle',            next: 'bundle'  },
        { label: 'None of these sound real',            next: 'real'    },
        { label: 'Leave',                               next: null      },
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
