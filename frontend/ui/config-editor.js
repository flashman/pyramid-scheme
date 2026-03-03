// ── FILE: ui/config-editor.js ────────────────────────────
// Payout table renderer.
//
// The interactive rate-tuning panel has been removed — payout parameters
// are now server-owned (backend/app/payout.py, served via GET /api/config).
// This file only contains renderPayoutTable(), which reads the current
// (server-fetched) values and updates the left-panel display.

import { payoutAtDepth, getCFG } from '../game/config.js';

/** Re-renders the payout table in the left panel and updates the "how it works" blurb. */
export function renderPayoutTable() {
  const tbody = document.getElementById('pt-body');
  if (!tbody) return;
  const CFG = getCFG();
  const rows = [];
  let d = 1;
  while (true) {
    const p = payoutAtDepth(d);
    if (!p) break;
    rows.push(`<tr><td>D${d}</td><td>→ $${p.toFixed(2)}</td></tr>`);
    d++;
    if (d > 20) break;
  }
  rows.push(`<tr class="pt-sep"><td colspan="2"><hr style="border:none;border-top:1px dashed #402000"></td></tr>`);
  rows.push(`<tr class="pt-fee"><td>PLATFORM</td><td>$${CFG.platformFee.toFixed(2)}</td></tr>`);
  rows.push(`<tr><td style="color:#c8a020">TOTAL IN</td><td style="color:#c8a020">$${CFG.entryFee}</td></tr>`);
  tbody.innerHTML = rows.join('');

  const p1 = payoutAtDepth(1), p2 = payoutAtDepth(2), p3 = payoutAtDepth(3);
  const d1el = document.getElementById('hw-d1');
  const d2el = document.getElementById('hw-d2');
  const d3el = document.getElementById('hw-d3');
  if (d1el) d1el.textContent = `D1 → $${p1.toFixed(2)}`;
  if (d2el) d2el.textContent = `D2 → $${p2.toFixed(2)}`;
  if (d3el) d3el.textContent = `D3 → $${p3.toFixed(2)}`;
}
