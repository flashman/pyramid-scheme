// ── FILE: worlds/nile/shop/catalogue.js ──────────────────
// Presentation data for the bazaar stall. IDs MUST match backend app/shop.py.
// Prices come from the server (game/config.js getShop()). `art` keys ware-art.js.
// Blurbs are THE MERCHANT's pitch, spoken when you select a ware — deadpan,
// MLM-satirical, and cryptic about anything cosmic (never names it outright).

export const WARES = [
  { id: 'invite_scroll',      name: 'Invite Scroll',                 tier: 'SCROLLS',     art: 'invite_scroll',
    blurb: 'ANOTHER SCROLL. ANOTHER SOUL.\nYOU DO NOT RECRUIT THEM — YOU OFFER THEM THE CHANCE\nTO RECRUIT THEMSELVES. THE SAME CHANCE I OFFERED YOU.' },
  { id: 'scarab_amulet',      name: 'Scarab Amulet',                 tier: 'AMULETS',     art: 'scarab_amulet',
    blurb: 'PRESSED FROM RIVER CLAY BY HANDS THAT BELIEVED.\nIT CONFERS NOTHING YOU CAN MEASURE.\nMEASUREMENT IS FOR PEOPLE WITHOUT AMULETS.' },
  { id: 'bronze_coin',        name: 'Bronze Coin',                   tier: 'RELICS',      art: 'bronze_coin',
    blurb: 'ONE COIN. STANDARD WEIGHT. NON-NEGOTIABLE.\nA FERRYMAN DOWNRIVER WILL WANT EXACTLY THIS.\nHE DOES NOT MAKE CHANGE. NO ONE DOWNRIVER DOES.' },
  { id: 'croc_sandals',       name: 'Crocodile-leather Sandals',     tier: 'REGALIA',     art: 'croc_sandals',
    blurb: 'CUT FROM SOMETHING STILL OWED A FAVOUR.\nWEAR THEM AND THE RIVER COUNTS YOU AMONG ITS OWN.\nIT EATS ITS OWN LAST.' },
  { id: 'secret_flood',       name: 'The Secret of the Flood',       tier: 'SECRETS',     art: 'secret_flood',
    blurb: 'THE WATER RISES ON A SCHEDULE. THE SCHEDULE IS NOT PUBLIC.\nLEARN IT, AND YOU WILL SELL GRAIN TO THE DROWNING\nAT A FAIR PRICE. FAIR TO YOU.' },
  { id: 'secret_compounding', name: 'The Secret of Compounding',     tier: 'SECRETS',     art: 'secret_compounding',
    blurb: 'THE FIRST TRUTH, AND THE LAST.\nA SMALL THING TAKING A SMALL CUT OF EVERYTHING, FOREVER.\nDO NOT TEACH IT DOWNWARD. THAT IS HOW IT KEEPS ITS VALUE.' },
  { id: 'secret_recursion',   name: 'The Secret of Recursion',       tier: 'SECRETS',     art: 'secret_recursion',
    blurb: 'YOU RECRUITED SOMEONE. THEY RECRUITED YOU.\nCHECK AGAIN — IT WAS ALWAYS YOU AT BOTH ENDS.\nMOST PHARAOHS NEVER NOTICE. YOU PAID EXTRA TO.' },
  { id: 'secret_fire',        name: 'The Secret of Fire',            tier: 'SECRETS',     art: 'secret_fire',
    blurb: 'YES. FIRE. THE ORIGINAL UNFAIR ADVANTAGE.\nSOMEONE SOLD IT FIRST. SOMEONE ALWAYS SELLS IT FIRST.\nI DO NOT EXPLAIN THE INVENTORY. I MOVE IT.' },
  { id: 'secret_name',        name: 'The Secret Name of God',        tier: 'SECRETS',     art: 'secret_name',
    blurb: 'ONE WORD. SAID CORRECTLY, IT OPENS AN ACCOUNT NO ONE CLOSES.\nSAID WRONG, IT OPENS SOMETHING ELSE.\nWE DO NOT REHEARSE IT ON THESE PREMISES.' },
  { id: 'secret_orgchart',    name: 'The Org Chart',                 tier: 'SECRETS',     art: 'secret_orgchart',
    blurb: 'THE REAL ONE — NOT THE ONE FROM ONBOARDING.\nYOUR NAME IS ON IT. LOOK UP. KEEP LOOKING UP.\nTHE PAGE DOES NOT END WHERE THEY TOLD YOU IT ENDS.' },
  { id: 'paperwork_above',    name: 'The Paperwork From Above',      tier: 'SECRETS',     art: 'paperwork_above',
    blurb: 'YOUR ENROLMENT, COUNTERSIGNED BEFORE YOU WERE BORN.\nTHIS IS YOUR COPY. IT IS THE ONLY ONE YOU ARE PERMITTED.\nTHE FILING OFFICE DOES NOT TAKE VISITORS.' },
  { id: 'tongue_stone',       name: 'The Tongue Stone',              tier: 'RELICS',      art: 'tongue_stone',
    blurb: 'HOLD IT UNDER YOUR TONGUE AND YOU WILL UNDERSTAND THEM.\nNOT THE WORDS — THE TERMS.\nMOST PEOPLE PREFER THE WORDS.' },
  { id: 'attentive_reel',     name: 'A Reel of Something Attentive', tier: 'RELICS',      art: 'attentive_reel',
    blurb: 'FOOTAGE. OF YOU. THOROUGH.\nI DID NOT FILM IT. I ONLY SELL IT BACK.\nCONSIDER IT A SUBSCRIPTION YOU DID NOT START.' },
  { id: 'sky_iron',           name: 'A Sliver of Meteoric Iron',     tier: 'RELICS',      art: 'sky_iron',
    blurb: 'IT FELL. NOTHING THAT LIVES HERE THREW IT.\nGODS USED TO MAKE BLADES OF THIS.\nNOW IT IS A NOVELTY. PROGRESS.' },
  { id: 'seed_phrase',        name: "A Founder's Seed Phrase",       tier: 'CURIOS',      art: 'seed_phrase',
    blurb: 'TWELVE WORDS ON LINEN — YOUR WHOLE FORTUNE, FOLDED SMALL.\nLOSE THE LINEN, LOSE THE PHARAOH.\nMEMORISE IT, THEN EAT IT. A TRADITION I JUST INVENTED.' },
  { id: 'future_receipt',     name: 'A Receipt from the Future',     tier: 'CURIOS',      art: 'future_receipt',
    blurb: 'PROOF OF A PAYMENT YOU HAVE NOT YET MADE.\nVERY USEFUL. VERY BINDING.\nIT DOES NOT SURVIVE THE CROSSING. NEITHER, STATISTICALLY, DO YOU.' },
  { id: 'self_equity',        name: 'Stock Certificate in Yourself', tier: 'CURIOS',      art: 'self_equity',
    blurb: 'ONE SHARE. THE ISSUER IS YOU.\nYOU ARE NOW LONG ON YOURSELF —\nTHE MOST VOLATILE POSITION ON THE RIVER. CONGRATULATIONS.' },
];

export const WARES_BY_ID = Object.fromEntries(WARES.map(w => [w.id, w]));

// Snarky retorts the merchant fires the moment a purchase clears. Item-specific
// where there's a joke; otherwise one of the generics is picked at random.
export const GENERIC_RETORTS = [
  'SOLD. NO REFUNDS, NO RETURNS, NO RECOLLECTION.',
  'A FINE CHOICE. THEY ARE ALL FINE CHOICES. THAT IS THE PROBLEM.',
  'WRAPPED. THE PAPYRUS IS THE ONLY PART THAT IS STRICTLY REAL.',
  "DONE. I WON'T SAY YOU WON'T REGRET IT — I KEEP RECORDS.",
  'YOUR BELIEF HAS BEEN DEBITED. THANK YOU FOR BANKING WITH JUST POTS.',
  "EXCELLENT. YOUR DOWNLINE WILL NEVER KNOW. NEITHER, IF WE'RE HONEST, WILL YOU.",
];

export const WARE_RETORTS = {
  invite_scroll:    "ANOTHER SCROLL GONE. SOMEWHERE A STRANGER'S LUCK JUST CHANGED. UPWARD.",
  bronze_coin:      'ONE COIN, SOLD. KEEP IT CLOSE. THE FERRYMAN BILLS ONCE — AND COLLECTS ALWAYS.',
  croc_sandals:     'WEAR THEM IN GOOD HEALTH. THE CROCODILE SENDS ITS PROFESSIONAL REGARDS.',
  secret_flood:     'SOLD. TRY NOT TO LOOK SMUG WHEN IT RAINS.',
  secret_recursion: 'YOU BOUGHT IT FROM YOURSELF, REALLY. I MERELY FILED THE PAPERWORK.',
  secret_fire:      "FIRE, SOLD. PLEASE DON'T TELL THE OTHER GODS WHERE YOU GOT IT.",
  secret_name:      'SOLD. DO NOT SAY IT IN HERE. THE POTS ARE LISTENING.',
  seed_phrase:      'TWELVE WORDS, YOURS. LOSE THEM AND YOU LOSE THE ARGUMENT OVER WHO YOU ARE.',
  future_receipt:   'PAID. OR YOU WILL HAVE. THE TENSES GET LOOSE BACK HERE.',
  self_equity:      'CONGRATULATIONS — YOU ARE NOW A SHAREHOLDER AND THE PRODUCT.',
  attentive_reel:   "ENJOY THE FOOTAGE. THEY HAVE THE DIRECTOR'S CUT.",
};

// Fired when you try to buy something you can't afford.
export const POOR_RETORTS = [
  'BELIEF IS FREE. THIS IS NOT. COME BACK HEAVIER.',
  'YOUR ENTHUSIASM EXCEEDS YOUR BALANCE. A COMMON PHARAOH AILMENT.',
  'INSUFFICIENT. RECRUIT SOMEONE, COME BACK. THAT IS THE ENTIRE IDEA.',
  'NO. THOUGH THE POTS ARE CHEAP, IF YOU MUST BUY SOMETHING.',
  'THE WANTING IS THERE. THE FUNDING IS NOT. WE HAVE ALL BEEN DOWNLINE.',
];

// Fired when you try to re-buy a keepsake you already own.
export const OWNED_RETORTS = [
  'YOU ALREADY CARRY ONE. ONE IS THE CORRECT NUMBER.',
  'OWNING IT TWICE IS CALLED A HOBBY. I DO NOT STOCK HOBBIES.',
  'ALREADY YOURS. EVEN I HAVE LIMITS. THAT ONE IS A NO.',
];
