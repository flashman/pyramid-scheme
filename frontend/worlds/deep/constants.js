// ── FILE: worlds/deep/constants.js ──────────────────────
// Below Atlantis. Below the system. Below the ocean floor.
// The pre-franchise layer — where the gods keep their offices.

export const DEEP_WORLD_W   = 1400;
export const DEEP_WORLD_H   = 3800;
export const DEEP_ENTRY_Y   = 80;
export const DEEP_EXIT_Y    = 100;
export const DEEP_FLOOR_Y   = DEEP_WORLD_H - 50;

// ── Zone boundaries (Y axis, increasing = deeper) ─────────
export const SHELF_END      = 900;   // Zone 1 — THE SHELF: transitional, Atlantis debris
export const FRANCHISE_END  = 1900;  // Zone 2 — THE FRANCHISE OFFICE: Poseidon's domain
export const PELAGIC_END    = 3000;  // Zone 3 — THE PELAGIC: Okeanos drifts here
// Zone 4 — THE ABYSS: 3000–3800. The primordial. No name.

// ── Zone 1: The Shelf ─────────────────────────────────────
export const HERALD_WX      = 700;   export const HERALD_WY   = 380;

// ── Zone 2: The Franchise Office ──────────────────────────
export const HIERARCHY_WX   = 280;   export const HIERARCHY_WY  = 1120;
export const POSEIDON_WX    = 720;   export const POSEIDON_WY   = 1460;

// ── Zone 3: The Pelagic ───────────────────────────────────
export const OKEANOS_WX     = 700;   export const OKEANOS_WY    = 2540;

// ── Zone 4: The Abyss ─────────────────────────────────────
export const PRIMORDIAL_WX  = 700;   export const PRIMORDIAL_WY = 3710;

// ── Anglers (bioluminescent recruiters) ───────────────────
export const ANGLER_POSITIONS = [
  { wx: 920, wy: 1180, id: 'angler_0' },
  { wx: 380, wy: 1740, id: 'angler_1' },
  { wx: 600, wy: 2260, id: 'angler_2' },
];
export const ANGLER_AGGRO     = 220;
export const ANGLER_SPEED     = 0.7;
export const ANGLER_CHASE_SPD = 2.8;
export const ANGLER_HURT      = 40;

// ── The Leviathan ─────────────────────────────────────────
// Not an enemy — a presence. Periodic passes through zones 3-4.
export const LEVIATHAN_Y_MIN  = PELAGIC_END - 200;
export const LEVIATHAN_Y_MAX  = DEEP_FLOOR_Y - 100;
export const LEVIATHAN_HURT_RANGE = 120;

// ── Swimming physics (heavier than Atlantis) ──────────────
export const SWIM_ACC     = 0.38;
export const SWIM_DRAG    = 0.89;
export const SWIM_MAX_SPD = 5.5;
export const SWIM_BUOY    = -0.02;   // slight upward pressure
