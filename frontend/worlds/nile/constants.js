// ── FILE: worlds/nile/constants.js ───────────────────────
// Layout + physics for The Nile (west of the Desert).
//
// MOVEMENT MODEL — position/surface-based (not the old pZ two-plane):
//   • The TOWPATH BANK is a continuous one-way platform at BANK_Y. It is the
//     current-free walk-home and the soft-lock guarantee: from the shallows you
//     can always jump up onto it and walk east.
//   • The WATER fills the channel below. While the player's feet are at/below
//     WATER_Y the westward CURRENT sweeps them downstream every frame, and the
//     current exceeds the swim speed — so the river is strictly one-way.
//   • The RIVERBED is standable everywhere (wading) at RIVERBED_Y — you never
//     drown, so you can never be trapped; but standing in the water still drifts.
//   • REEDS and CROC-BACKS are one-way platforms ABOVE the waterline: landing on
//     one lifts your feet out of the water and stops the drift. They are the
//     footholds the spec's "crocodile-hopping across floating papyrus" rides on.
//   • ↓ drops you through the bank/reed into the water; Z jumps; ↑ at the gate
//     returns to the Desert.

export const NILE_W = 6400;          // world width (player travels west → Delta)

// ── Vertical geometry (screen Y; the player's feet sit at G.py) ──────────────
export const BANK_Y       = 400;     // towpath bank surface — one-way, continuous, current-free
export const WATER_Y      = 416;     // water surface line; feet at/below ⇒ in the current
export const RIVERBED_Y   = 472;     // shallow standable bottom (wading; still in the current)
export const WATER_BOTTOM = 506;     // drawn bottom of the water band (HUD begins at CH-28)
export const REED_TOP     = 404;     // top of a floating papyrus platform (pokes above the water)
export const CROC_BACK    = 410;     // top of a crocodile's back when used as a platform

// ── Current / swim tuning ("firm but fair") ──────────────────────────────────
// Idle/falling-in drifts you firmly WEST (~4 px/frame); swimming hard EAST nets a
// slow forward crawl (+0.6) — a current you work WITH, hopping reeds to advance.
export const CURRENT_SPD  = 4.0;     // westward drift px/frame while feet are in the water
export const SWIM_SPD     = 4.6;     // in-water horizontal control (no sprint)
export const JUMP_VY      = -9;      // matches the Desert; apex ≈ 81px (reaches BANK from RIVERBED)
export const DROP_FRAMES  = 12;      // frames the bank/reed under you is ignored after pressing ↓

// ── Entry / exit ─────────────────────────────────────────────────────────────
export const NILE_ENTRY_X  = NILE_W - 200;  // spawn here on entry (east end, on the bank)
export const NILE_RETURN_X  = NILE_W - 120; // return-to-Desert gate (east end, on the bank)
export const NILE_GATE_X    = 150;          // Desert-side: player must be at/below this X to enter

// ── Beat anchor X positions (east → west = sunlit bazaar → cold Delta) ────────
export const BAZAAR_X = 5900;   // The Bazaar of Believers (Merchant) — on dry bank
export const MOSES_X  = 5480;   // Moses-in-the-bulrushes basket — among the reeds (in water)
export const FERRY_X  = 4640;   // The Ferryman & the crossing — on dry bank, water's edge
export const SOBEK_X  = 3720;   // Sobek, the crocodile-god enforcer (idol) — on dry bank
export const JOSEPH_X = 2720;   // Joseph's granary & the Nilometer — on dry bank

// ── Dry bank segments — solid ground at BANK_Y, current-free, the beats live here.
// Everywhere ELSE is open water (a gap to be crossed by reed/croc hopping).
// The east segment holds the entry + return gate; segments shrink toward the Delta.
export const BANK_SEGMENTS = [
  { x1: 5680, x2: 6400 },   // entry + Bazaar + return gate (big, sunlit, safe)
  { x1: 4480, x2: 4820 },   // the Ferry landing
  { x1: 3540, x2: 3900 },   // Sobek's idol
  { x1: 2540, x2: 2920 },   // Joseph's granary
  { x1: 1240, x2: 1360 },   // a last dry lip before the Delta opens
];

// ── Floating papyrus reeds — one-way platforms ({ x, w } at REED_TOP) ─────────
// Placed in the water GAPS between bank segments, spaced within jump range so a
// chain of them carries the player across. Moses' basket rides the G1 reeds.
export const REEDS = [
  // G1: Bazaar → Ferry  (4820 … 5680)
  { x: 5600, w: 26 }, { x: 5480, w: 24 }, { x: 5320, w: 24 }, { x: 5160, w: 26 }, { x: 5000, w: 24 }, { x: 4900, w: 22 },
  // G2: Ferry → Sobek   (3900 … 4480)
  { x: 4400, w: 24 }, { x: 4260, w: 26 }, { x: 4120, w: 24 }, { x: 3980, w: 22 },
  // G3: Sobek → Joseph  (2920 … 3540)
  { x: 3480, w: 24 }, { x: 3320, w: 26 }, { x: 3160, w: 24 }, { x: 3020, w: 22 },
  // G4: Joseph → Delta  (1360 … 2540)
  { x: 2480, w: 24 }, { x: 2340, w: 26 }, { x: 2200, w: 24 }, { x: 2060, w: 24 },
  { x: 1920, w: 26 }, { x: 1780, w: 24 }, { x: 1640, w: 24 }, { x: 1500, w: 22 },
  // Delta shallows (a few, thinning out)
  { x: 1080, w: 24 }, { x: 920, w: 22 }, { x: 760, w: 22 },
];

// ── Crocodiles — patrol the gaps; their backs double as moving platforms ──────
export const CROCS = [
  { id: 'croc-1', x: 5200, x1: 5040, x2: 5360 },   // G1
  { id: 'croc-2', x: 4200, x1: 4040, x2: 4400 },   // G2
  { id: 'croc-3', x: 3260, x1: 3060, x2: 3480 },   // G3
  { id: 'croc-4', x: 2240, x1: 2020, x2: 2480 },   // G4 east
  { id: 'croc-5', x: 1640, x1: 1460, x2: 1900 },   // G4 west
];
export const CROC_SPEED = 1.5;
export const CROC_HURT  = 22;

// ── Delta: the river mouth, west of DELTA_START_X — opens to the sea ─────────
export const DELTA_START_X = 1180;
export const BOAT_X        = 230;    // the reed boat at the river mouth (sea exit — a future chapter)
