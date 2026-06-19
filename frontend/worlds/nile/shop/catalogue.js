// ── FILE: worlds/nile/shop/catalogue.js ──────────────────
// Presentation data for the bazaar stall. IDs MUST match backend app/shop.py.
// Prices come from the server (game/config.js getShop()). `art` keys ware-art.js.

export const WARES = [
  { id: 'invite_scroll',      name: 'Invite Scroll',                 tier: 'SCROLLS',     art: 'invite_scroll',
    blurb: 'ONE MORE SCROLL. ONE MORE BELIEVER.\nTHE CHAIN GROWS BY ONE EITHER WAY.' },
  { id: 'scarab_amulet',      name: 'Scarab Amulet',                 tier: 'AMULETS',     art: 'scarab_amulet',
    blurb: 'HAND-PRESSED FROM NILE CLAY.\nIMPACT IS ATMOSPHERIC. NOT QUANTIFIABLE.' },
  { id: 'bronze_coin',        name: 'Bronze Coin',                   tier: 'RELICS',      art: 'bronze_coin',
    blurb: 'EGYPTIAN STANDARD WEIGHT.\nA CROSSING SOMEWHERE WILL ASK FOR EXACTLY ONE.' },
  { id: 'croc_sandals',       name: 'Crocodile-leather Sandals',     tier: 'REGALIA',     art: 'croc_sandals',
    blurb: 'THE RIVER RECOGNISES ITS OWN.\nIT IS LESS HUNGRY FOR THOSE WHO WEAR IT.' },
  { id: 'secret_flood',       name: 'The Secret of the Flood',       tier: 'SECRETS',     art: 'secret_flood',
    blurb: 'YOU WILL KNOW BEFORE THE OTHERS KNOW.\nTHEY WERE NOT AT THE WELL.' },
  { id: 'secret_compounding', name: 'The Secret of Compounding',     tier: 'SECRETS',     art: 'secret_compounding',
    blurb: 'THE MATH BENEATH THE MATH.\nIT DOES NOT STOP. THAT IS THE SECRET.' },
  { id: 'secret_recursion',   name: 'The Secret of Recursion',       tier: 'SECRETS',     art: 'secret_recursion',
    blurb: 'YOU ARE YOUR OWN UPLINE.\nDO NOT THINK ABOUT IT TOO LONG.' },
  { id: 'secret_fire',        name: 'The Secret of Fire',            tier: 'SECRETS',     art: 'secret_fire',
    blurb: 'YOU BOUGHT FIRE. FROM A MERCHANT. IN A BAZAAR.\nI DO NOT EXPLAIN. I ONLY SELL.' },
  { id: 'secret_name',        name: 'The Secret Name of God',        tier: 'SECRETS',     art: 'secret_name',
    blurb: 'SPOKEN ONCE, CORRECTLY, IT IS ANSWERED.\nWE DO NOT REHEARSE IT HERE.' },
  { id: 'secret_orgchart',    name: 'The Org Chart',                 tier: 'SECRETS',     art: 'secret_orgchart',
    blurb: 'THERE IS MORE ABOVE YOU THAN YOU WERE TOLD.\nTHE TOP IS NOT YOU. THE TOP IS NOT SHOWN.' },
  { id: 'paperwork_above',    name: 'The Paperwork From Above',      tier: 'SECRETS',     art: 'paperwork_above',
    blurb: 'YOU WERE ENROLLED BEFORE YOU ARRIVED.\nTHIS IS YOUR COPY. THE OTHER IS NOT KEPT HERE.' },
  { id: 'tongue_stone',       name: 'The Tongue Stone',              tier: 'RELICS',      art: 'tongue_stone',
    blurb: 'AFTERWARD YOU UNDERSTAND THINGS\nNOT SAID TO YOU. WE DO NOT DISCUSS BY WHOM.' },
  { id: 'attentive_reel',     name: 'A Reel of Something Attentive', tier: 'RELICS',      art: 'attentive_reel',
    blurb: 'YOU HAVE BEEN OBSERVED. THE OBSERVATION IS THOROUGH.\nTHE OBSERVER IS NOT LISTED.' },
  { id: 'sky_iron',           name: 'A Sliver of Meteoric Iron',     tier: 'RELICS',      art: 'sky_iron',
    blurb: 'A RELIC OF THE SKY GODS.\nIT CAME DOWN. IT DID NOT COME FROM HERE.' },
  { id: 'seed_phrase',        name: "A Founder's Seed Phrase",       tier: 'CURIOS',      art: 'seed_phrase',
    blurb: 'TWELVE WORDS ON LINEN.\nTHE ORIGINAL COLD STORAGE. DO NOT LOSE THE LINEN.' },
  { id: 'future_receipt',     name: 'A Receipt from the Future',     tier: 'CURIOS',      art: 'future_receipt',
    blurb: 'PROOF YOU WILL HAVE PAID.\nKEEP IT. IT WILL NOT SURVIVE THE CROSSING.' },
  { id: 'self_equity',        name: 'Stock Certificate in Yourself', tier: 'CURIOS',      art: 'self_equity',
    blurb: 'LITERAL EQUITY. NOTARISED.\nYOU NOW OWN A SLICE OF THE MOST VOLATILE ASSET YOU KNOW.' },
];

export const WARES_BY_ID = Object.fromEntries(WARES.map(w => [w.id, w]));
