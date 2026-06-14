// ── FILE: worlds/nile/constants.js ───────────────────────
// Layout + physics for The Nile (west of the Desert).
// Two planes: pZ 0 = towpath bank (TOWPATH_Y), pZ -1 = river (RIVER_FLOOR).

export const NILE_W       = 6000;   // world width (player travels west → Delta)
export const TOWPATH_Y    = 446;    // pZ 0 floor — the bank, walkable both ways
export const RIVER_FLOOR  = 488;    // pZ -1 floor — the one-way water
export const CURRENT_SPD  = 7;      // westward drift px/frame — MUST exceed SPEED (5)

export const NILE_RETURN_X = NILE_W - 120;  // east end: return-to-Desert gate (towpath)
export const NILE_ENTRY_X  = NILE_W - 200;  // where the player spawns on entry

// Desert-side gate: player must be at/below this world-X in the Desert to enter.
export const NILE_GATE_X = 150;

// Beat anchor X positions (entities live on the river plane, pZ -1).
export const BAZAAR_X = NILE_W - 500;
export const FERRY_X  = 4300;
export const SOBEK_X  = 3450;
export const JOSEPH_X = 2550;
export const DELTA_X  = 500;

// Crocodiles patrol the river plane (pZ -1) at RIVER_FLOOR.
export const CROCS = [
  { id: 'croc-1', x: 4000, x1: 3700, x2: 4200 },
  { id: 'croc-2', x: 3000, x1: 2750, x2: 3250 },
  { id: 'croc-3', x: 1900, x1: 1650, x2: 2150 },
];
export const CROC_SPEED = 1.6;
export const CROC_HURT  = 26;
