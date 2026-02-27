// ── FILE: ui/config-editor.js ────────────────────────────
// The payout rate tuner panel.
//
// The panel lets the player tweak the scheme's economics at runtime.
// The golden rule: platformFee + (d1Payout / (1 - decay)) must equal entryFee.
// validateConfig() checks this; applyConfig() enforces it before saving.

import { CFG, payoutAtDepth, maxPayDepth } from '../game/config.js';
import { COL }                             from '../engine/colors.js';
import { log }                             from './panels.js';

/** Re-renders the payout table in the left panel and updates the "how it works" blurb. */
export function renderPayoutTable() {
  const tbody = document.getElementById('pt-body');
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
  const p1=payoutAtDepth(1), p2=payoutAtDepth(2), p3=payoutAtDepth(3);
  const d1el=document.getElementById('hw-d1'), d2el=document.getElementById('hw-d2'), d3el=document.getElementById('hw-d3');
  if(d1el) d1el.textContent=`D1 → $${p1.toFixed(2)}`;
  if(d2el) d2el.textContent=`D2 → $${p2.toFixed(2)}`;
  if(d3el) d3el.textContent=`D3 → $${p3.toFixed(2)}`;
}

/** Opens the config panel, pre-filling inputs from the current CFG. */
export function openConfig() {
  document.getElementById('cfg-fee').value=CFG.entryFee;
  document.getElementById('cfg-cut').value=CFG.platformFee;
  document.getElementById('cfg-d1').value=CFG.d1Payout;
  document.getElementById('cfg-dc').value=CFG.decay;
  document.getElementById('cfg-min').value=CFG.minPayout;
  document.getElementById('cfg-valid').textContent='';
  document.getElementById('cfg-panel').classList.add('show');
}

/** Hides the config panel without saving. */
export function closeConfig() {
  document.getElementById('cfg-panel').classList.remove('show');
}

/** Checks whether the current input values satisfy the balance equation and shows the result. */
export function validateConfig() {
  const fee=parseFloat(document.getElementById('cfg-fee').value);
  const cut=parseFloat(document.getElementById('cfg-cut').value);
  const d1=parseFloat(document.getElementById('cfg-d1').value);
  const dc=parseFloat(document.getElementById('cfg-dc').value);
  const pool=d1/(1-dc);
  const check=Math.abs((cut+pool)-fee)<0.005;
  const el=document.getElementById('cfg-valid');
  if (check) { el.style.color=COL.GREEN; el.textContent=`✓ MATH OK: $${cut}+$${pool.toFixed(2)}=$${fee}`; }
  else        { el.style.color=COL.RED; el.textContent=`✗ FAILS: $${cut}+$${pool.toFixed(2)}≠$${fee}`; }
}

/** Validates and, if the math balances, writes the new values into CFG and refreshes the UI. */
export function applyConfig() {
  const fee=parseFloat(document.getElementById('cfg-fee').value);
  const cut=parseFloat(document.getElementById('cfg-cut').value);
  const d1=parseFloat(document.getElementById('cfg-d1').value);
  const dc=parseFloat(document.getElementById('cfg-dc').value);
  const minP=parseFloat(document.getElementById('cfg-min').value);
  const pool=d1/(1-dc);
  if (Math.abs((cut+pool)-fee)>0.01) { validateConfig(); return; }
  // Mutate CFG fields (ES modules export live bindings for objects)
  CFG.entryFee=fee; CFG.platformFee=cut; CFG.d1Payout=d1; CFG.decay=dc; CFG.minPayout=minP;
  renderPayoutTable(); closeConfig(); log('⚙ Payout rates updated!','hi');
}
