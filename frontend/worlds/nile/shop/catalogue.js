// ── FILE: worlds/nile/shop/catalogue.js ──────────────────
// Presentation data for the bazaar stall. IDs MUST match backend
// app/shop.py exactly. Prices are NOT here — they come from the server
// via game/config.js getShop(). Utility (if any) is a flag read elsewhere.

export const WARES = [
  { id: 'invite_scroll',      name: 'Invite Scroll',                 tier: 'SCROLLS',     glyph: '📜',
    blurb: 'ONE MORE SCROLL. ONE MORE BELIEVER.\nTHE CHAIN GROWS BY ONE EITHER WAY.' },
  { id: 'protection_scroll',  name: 'Protection Scroll',             tier: 'SCROLLS',     glyph: '🧧',
    blurb: 'IT ABSORBS THE SPIRITUAL SHORTFALL.\nYOURS, OR SOMEONE BELOW YOU. UNSPECIFIED.' },
  { id: 'blank_scroll',       name: 'Blank Scroll',                  tier: 'SCROLLS',     glyph: '📄',
    blurb: 'THE BLANK SPACE IS CALLED POTENTIAL.\nPOTENTIAL IS THE PREMIUM PRODUCT.' },
  { id: 'scarab_amulet',      name: 'Scarab Amulet',                 tier: 'AMULETS',     glyph: '🪲',
    blurb: 'HAND-PRESSED FROM NILE CLAY.\nIMPACT IS ATMOSPHERIC. NOT QUANTIFIABLE.' },
  { id: 'bronze_coin',        name: 'Bronze Coin',                   tier: 'RELICS',      glyph: '🪙',
    blurb: 'EGYPTIAN STANDARD WEIGHT.\nA CROSSING SOMEWHERE WILL ASK FOR EXACTLY ONE.' },
  { id: 'croc_sandals',       name: 'Crocodile-leather Sandals',     tier: 'REGALIA',     glyph: '👡',
    blurb: 'THE RIVER RECOGNISES ITS OWN.\nIT IS LESS HUNGRY FOR THOSE WHO WEAR IT.' },
  { id: 'secret_flood',       name: 'The Secret of the Flood',       tier: 'SECRETS',     glyph: '🌊',
    blurb: 'YOU WILL KNOW BEFORE THE OTHERS KNOW.\nTHEY WERE NOT AT THE WELL.' },
  { id: 'secret_compounding', name: 'The Secret of Compounding',     tier: 'SECRETS',     glyph: '➰',
    blurb: 'THE MATH BENEATH THE MATH.\nIT DOES NOT STOP. THAT IS THE SECRET.' },
  { id: 'secret_orgchart',    name: 'The Org Chart',                 tier: 'SECRETS',     glyph: '🗂️',
    blurb: 'THERE IS MORE ABOVE YOU THAN YOU WERE TOLD.\nTHE TOP IS NOT YOU. THE TOP IS NOT SHOWN.' },
  { id: 'secret_name',        name: 'The Secret Name of God',        tier: 'SECRETS',     glyph: '𓂀',
    blurb: 'SPOKEN ONCE, CORRECTLY, IT IS ANSWERED.\nWE DO NOT REHEARSE IT HERE.' },
  { id: 'paperwork_above',    name: 'The Paperwork From Above',      tier: 'SECRETS',     glyph: '📋',
    blurb: 'YOU WERE ENROLLED BEFORE YOU ARRIVED.\nTHIS IS YOUR COPY. THE OTHER IS NOT KEPT HERE.' },
  { id: 'tongue_stone',       name: 'The Tongue Stone',              tier: 'RELICS',      glyph: '🗿',
    blurb: 'AFTERWARD YOU UNDERSTAND THINGS\nNOT SAID TO YOU. WE DO NOT DISCUSS BY WHOM.' },
  { id: 'sky_iron',           name: 'A Sliver of Meteoric Iron',     tier: 'RELICS',      glyph: '☄️',
    blurb: 'A RELIC OF THE SKY GODS.\nIT CAME DOWN. IT DID NOT COME FROM HERE.' },
  { id: 'future_receipt',     name: 'A Receipt from the Future',     tier: 'CURIOS',      glyph: '🧾',
    blurb: 'PROOF YOU WILL HAVE PAID.\nKEEP IT. IT WILL NOT SURVIVE THE CROSSING.' },
  { id: 'seed_phrase',        name: "A Founder's Seed Phrase",       tier: 'CURIOS',      glyph: '🪡',
    blurb: 'TWELVE WORDS ON LINEN.\nTHE ORIGINAL COLD STORAGE. DO NOT LOSE THE LINEN.' },
];

export const WARES_BY_ID = Object.fromEntries(WARES.map(w => [w.id, w]));
