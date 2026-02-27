// ── FILE: worlds/earth/constants.js ─────────────────────
// Physics, layout, and parallax data for the Earth desert world.

export const WORLD_W = 8000;
export const GND     = 480;

export const F_SLOTS = [
  3400, 1850, 4400, 1100, 5150,  450, 5900, 6650,
  3800, 1500, 5500,  700,
];
export const F_SLOTS_MID = [
  3000, 3900, 1400, 4600,  800, 5300, 6200, 2300,
  5000, 1700, 6700, 3200,  550, 5900, 2700,
];
export const F_SLOTS_FAR = [
  2700, 4000, 1600, 4700,  900, 5500, 6300, 2400,
  3300, 1200, 6000,  700, 4300, 2100, 6900, 3600,
  1050, 4800,  300, 5200, 2900, 3700, 6500, 1900,
];

export const Z_LAYERS = [
  { parallax: 1.0,  groundY: GND,       scale: 1.0,  alpha: 1.0,  fog: 0.0  },
  { parallax: 0.68, groundY: GND - 52,  scale: 0.62, alpha: 0.72, fog: 0.28 },
  { parallax: 0.35, groundY: GND - 105, scale: 0.38, alpha: 0.45, fog: 0.60 },
];
