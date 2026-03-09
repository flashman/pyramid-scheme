// ── FILE: worlds/oasis/constants.js ─────────────────────

export const OASIS_FLOOR    = 440;
export const OASIS_WORLD_W  = 3000;  // total width of the oasis world
export const POOL_FLOOR     = 468;   // deeper floor when wading in the pool

// World-space x positions
export const POOL_WX        = 620;   // pool sits mid-journey — player walks dry desert first
export const POOL_WIDTH     = 360;
export const SPHINX_WX      = 1800;  // world-x center of sphinx body
export const PASSAGE_WX     = 1680;  // center of the staircase between the sphinx paws
export const OASIS_ENTRY_X  = 7400;  // world-x in the main world that triggers gate prompt

// Vault (chamber beneath the sphinx)
export const VAULT_FLOOR    = 436;
export const STELE_X        = 390;   // world-x of the Dream Stele
export const ALTAR_X        = 310;   // world-x of the sacrificial altar (STELE_X - 80)

// Atlantis gate — statue rises from the pool centre after vault ritual
export const POOL_CENTER_WX = 800;   // world-x of the dive point (POOL_WX + POOL_WIDTH/2)
export const POOL_DIVE_RANGE = 110;  // proximity range to trigger the dive prompt
