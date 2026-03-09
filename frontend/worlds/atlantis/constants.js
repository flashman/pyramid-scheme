// ── FILE: worlds/atlantis/constants.js ──────────────────

export const ATLANTIS_WORLD_W  = 2800;
export const ATLANTIS_WORLD_H  = 1900;

// Y coord where the player spawns after diving in (just below the surface)
export const ATLANTIS_ENTRY_Y  = 70;

// Y coord of the sunken city floor (buildings sit on this)
export const ATLANTIS_FLOOR_Y  = ATLANTIS_WORLD_H - 60;

// Exit portal zone: swim above this y to see the exit prompt
export const ATLANTIS_EXIT_Y   = 80;

// Swimming physics
export const SWIM_ACC       = 0.55;
export const SWIM_DRAG      = 0.90;
export const SWIM_MAX_SPD   = 7;
export const SWIM_BUOYANCY  = -0.04;  // gentle upward drift
