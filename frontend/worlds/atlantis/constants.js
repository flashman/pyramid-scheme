// ── FILE: worlds/atlantis/constants.js ──────────────────

export const ATLANTIS_WORLD_W  = 2800;
export const ATLANTIS_WORLD_H  = 1900;

export const ATLANTIS_ENTRY_Y  = 70;
export const ATLANTIS_FLOOR_Y  = ATLANTIS_WORLD_H - 60;
export const ATLANTIS_EXIT_Y   = 80;

// Swimming physics
export const SWIM_ACC       = 0.55;
export const SWIM_DRAG      = 0.90;
export const SWIM_MAX_SPD   = 7;
export const SWIM_BUOYANCY  = -0.04;

// ── Zone Y boundaries ─────────────────────────────────────
export const ZONE_1_END = 450;
export const ZONE_2_END = 820;
export const ZONE_3_END = 1200;
export const ZONE_4_END = 1540;

// ── Zone 1: The Atrium ────────────────────────────────────
export const GREETER_WX  = 1200;  export const GREETER_WY  = 385;
export const PILLAR_WX   = 780;   export const PILLAR_WY   = 345;

// ── Zone 1-2: Testimonial plaques (5 total) ───────────────
// Reading all five fills in the world. Testimonial 2 has the keyword.
// Testimonial 3 hints at the archive and the Founder's prior name.
export const TESTIMONIALS = [
  { wx: 340,  wy: 380,  id: 'test_0' },   // zone 1, west side
  { wx: 820,  wy: 455,  id: 'test_1' },   // zone 1-2 boundary
  { wx: 1050, wy: 535,  id: 'test_2' },   // zone 2 — contains the keyword
  { wx: 1700, wy: 505,  id: 'test_3' },   // zone 2 — mentions the archive
  { wx: 2300, wy: 490,  id: 'test_4' },   // zone 2, far east
];

// ── Zone 3: The Processing Chamber ───────────────────────
export const CHAIR_WX  = 900;
export const CHAIR_WY  = 880;

// Archive room — far west of zone 3
export const ARCHIVE_DOOR_WX = 185;
export const ARCHIVE_DOOR_WY = 1050;
export const ARCHIVE_TABLETS = [
  { wx: 90, wy: 1120, id: 'arch_0' },
  { wx: 90, wy: 1250, id: 'arch_1' },
  { wx: 90, wy: 1380, id: 'arch_2' },
];


// Zone 3 Auditor face (visual reference for the chair)
export const AUDITOR_FACE_WX = 2420;

// ── Zone 4: The Devoted Quarter ───────────────────────────
export const CHOIR_WX    = 1400;
export const CHOIR_WY    = 1340;
export const CHOIR_RADIUS = 68;

// Name alcove — east of choir, opens after surviving choir
export const NAME_TABLET_WX = 1750;
export const NAME_TABLET_WY = 1340;

// ── Zone 5: The Founder's Vault ───────────────────────────
export const FOUNDER_WX  = 1390;  export const FOUNDER_WY  = 1700;
export const TABLET_WX   = 660;   export const TABLET_WY   = 1775;

// ── Enemy parameters ──────────────────────────────────────

// Compliance Shark — zones 1 & 2
export const SHARK_PATROL_Y   = 360;
export const SHARK_PATROL_X1  = 280;
export const SHARK_PATROL_X2  = 2520;
export const SHARK_SPEED      = 2.8;
export const SHARK_CHASE_SPD  = 6.0;
export const SHARK_AGGRO      = 210;
export const SHARK_HURT       = 32;

// The Auditor (giant squid) — zone 3. Non-aggressive when player is CLEARED.
export const SQUID_START_WX   = 1600;
export const SQUID_START_WY   = 980;
export const SQUID_SPEED      = 0.55;
export const SQUID_CHASE_SPD  = 1.3;
export const SQUID_AGGRO      = 300;
export const SQUID_HURT       = 55;

// The Devoted — zones 4 & 5. Non-aggressive when player knows Founder's name.
export const DEVOTED_SPEED    = 1.1;
export const DEVOTED_AGGRO    = 190;
export const DEVOTED_HURT     = 26;
