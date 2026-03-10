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

// ── Zone Y boundaries (increasing depth) ─────────────────
// Zone 1 — The Atrium:          ATLANTIS_ENTRY_Y → ZONE_1_END
// Zone 2 — The Abundance Hall:  ZONE_1_END → ZONE_2_END
// Zone 3 — The Processing Chamber: ZONE_2_END → ZONE_3_END
// Zone 4 — The Devoted Quarter: ZONE_3_END → ZONE_4_END
// Zone 5 — The Founder's Vault: ZONE_4_END → ATLANTIS_FLOOR_Y
export const ZONE_1_END = 450;
export const ZONE_2_END = 820;
export const ZONE_3_END = 1200;
export const ZONE_4_END = 1540;

// ── NPC / interactable world positions ───────────────────
export const GREETER_WX  = 1200;  export const GREETER_WY  = 385;
export const PILLAR_WX   = 780;   export const PILLAR_WY   = 345;
export const FOUNDER_WX  = 1390;  export const FOUNDER_WY  = 1700;
export const TABLET_WX   = 660;   export const TABLET_WY   = 1775;

// Choir circle centre (zone 4 hazard)
export const CHOIR_WX    = 1400;  export const CHOIR_WY    = 1340;
export const CHOIR_RADIUS = 68;   // entering this kills the player after a delay

// ── Enemy spawn / patrol parameters ──────────────────────

// Compliance Shark — zones 1 & 2
export const SHARK_PATROL_Y   = 360;   // Y it patrols (deeper — further from spawn at y=70)
export const SHARK_PATROL_X1  = 280;
export const SHARK_PATROL_X2  = 2520;
export const SHARK_SPEED      = 2.8;
export const SHARK_CHASE_SPD  = 6.0;
export const SHARK_AGGRO      = 210;   // aggro radius
export const SHARK_HURT       = 32;    // contact kill radius

// The Auditor (giant squid) — zone 3
export const SQUID_START_WX   = 1600;
export const SQUID_START_WY   = 980;
export const SQUID_SPEED      = 0.55;
export const SQUID_CHASE_SPD  = 1.3;
export const SQUID_AGGRO      = 300;
export const SQUID_HURT       = 55;    // large — you don't see it until it's on you

// The Devoted (three skeletal swimmers) — zones 4 & 5
export const DEVOTED_SPEED    = 1.1;
export const DEVOTED_AGGRO    = 190;
export const DEVOTED_HURT     = 26;
