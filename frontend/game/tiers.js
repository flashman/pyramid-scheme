// ── FILE: game/tiers.js ──────────────────────────────────
// Player rank tiers (based on direct D1 recruit count),
// the recruit name pool, and ID generation helpers.

import { G }     from './state.js';

// Rank thresholds — `min` is the number of direct (D1) recruits needed.
export const TIERS = [
  {name:'PEASANT',    desc:'Nothing built yet.',        min:0},
  {name:'SCRIBE',     desc:'The scrolls are signed.',   min:1},
  {name:'ACOLYTE',    desc:'The gods take notice.',     min:3},
  {name:'VIZIER',     desc:'Your scheme spreads...',    min:6},
  {name:'HIGH PRIEST',desc:'Half the kingdom bows.',   min:10},
  {name:'PHARAOH',    desc:'ALL HAIL THE PYRAMID LORD.',min:15},
];

/** Returns the current tier object based on how many D1 recruits the player has. */
export function getTier() {
  const d1count = G.recruits.filter(r => r.depth === 1).length;
  let t = TIERS[0];
  for (const td of TIERS) {
    if (d1count >= td.min) t = td;
  }
  return t;
}

// Pool of procedural recruit screen-names.
// When all names have been used, the pool resets and they can repeat.
export const NAMES = [
  'KHUFU_JR','NEFERTI','SAND_DAD','ANKH_BRO','RA_FAN','CLEO_VII',
  'RAMSES$$','MUMMY_MN','OSIRIS_W','HORUS_PR','ANUBIS_A','BASTET_B',
  'THOTH_BX','PTAH_PRF','SOBEK_SH','NUT_NETW','GEB_GAIN','MIN_$BAG',
  'HATHR_HD','AMUN_APY','SET_WIN_','TEFNUT_T','SEKH_STK','ISIS_PMP',
];

// Tracks which names have been handed out in the current cycle.
const _usedNames = new Set();
// Auto-incrementing recruit ID counter.
let _nextFriendId = 0;

/**
 * Returns a random name from the pool, ensuring no repeats until
 * the pool is exhausted, then resets and starts over.
 */
export function pickName() {
  let pool = NAMES.filter(n => !_usedNames.has(n));
  if (!pool.length) { _usedNames.clear(); pool = [...NAMES]; }
  const n = pool[Math.floor(Math.random() * pool.length)];
  _usedNames.add(n);
  return n;
}

/** Returns the next recruit ID (auto-incrementing integer). */
export function nextId() { return _nextFriendId++; }
