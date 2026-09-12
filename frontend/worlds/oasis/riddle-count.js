// ── FILE: worlds/oasis/riddle-count.js ──────────────────
// What sphinx_riddles_solved becomes after a correct answer. Pure (no imports)
// so it's unit-testable under node — see tests/riddle-count.test.js.
//
// Logged in: POST /api/challenge returns the server-owned count; use it.
// Guest:     the server validates but persists nothing and always returns 0,
//            so the count is local-only (guest progress isn't saved anyway).

export function solvedCountAfterCorrect({ isGuest, serverCount, localCount }) {
  if (isGuest) return localCount + 1;
  return serverCount ?? localCount;
}
