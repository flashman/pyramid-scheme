# Bazaar Stall Visual Redo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the emoji shop grid with a first-person tent scene — the existing merchant + tent art, custom per-item icons, descriptions spoken by the shopkeeper in a dialogue-styled bar, no balance readout — and redo the catalogue to the weirder cosmic/cryptic set.

**Architecture:** Frontend-only except keeping `SHOP_CATALOGUE` ids/prices in sync. `StallOverlay.render()` is reworked to compose `drawMerchantTent` + `drawMerchant` (reused from the bazaar) + a slot grid drawn via a new `ware-art.js` registry + a canvas dialogue bar. Input/open/close/buy logic is unchanged.

**Tech Stack:** Vanilla ES modules, canvas 2D, no bundler (node smoke for pure data; manual visual verify for canvas). Backend: FastAPI catalogue dict, pytest.

**Spec:** `docs/superpowers/specs/2026-06-18-stall-visual-redo-design.md`
**Branch:** `feat/bazaar-marketplace`

**Art note:** The per-item `draw` functions are the deliberate iterate-later surface. This plan ships ~5 complete reference icons that establish the visual vocabulary + a one-line brief for each remaining id; author the rest in the same style (or hand them to the product owner). A fallback icon guarantees the grid never blanks, so partial art still ships a working stall.

---

## Task 1: Export the merchant/tent draws + redo the catalogue (backend + frontend in sync)

**Files:**
- Modify: `frontend/worlds/nile/draw/nile.js` (add `export` to `drawMerchant`, `drawMerchantTent`)
- Modify: `backend/app/shop.py` (`SHOP_CATALOGUE`)
- Modify: `frontend/worlds/nile/shop/catalogue.js` (`art` replaces `glyph`; new items)
- Modify: `backend/tests/test_shop_catalogue.py` (id expectations)
- Modify: `frontend/worlds/nile/shop/__smoke__/catalogue.smoke.mjs` (`art` not `glyph`)

- [ ] **Step 1: Export the two draw functions**

In `frontend/worlds/nile/draw/nile.js`, change `function drawMerchantTent(` → `export function drawMerchantTent(` and `function drawMerchant(` → `export function drawMerchant(`. No other change (the bazaar calls them in the same module, unaffected).

- [ ] **Step 2: Redo `SHOP_CATALOGUE`** in `backend/app/shop.py` — replace the dict with these 17 ids:

```python
SHOP_CATALOGUE: dict = {
    "invite_scroll":      {"name": "Invite Scroll",                          "price": 5,  "kind": "consumable", "effect": {"type": "invites", "amount": 1}},
    "scarab_amulet":      {"name": "Scarab Amulet",                          "price": 9,  "kind": "keepsake"},
    "bronze_coin":        {"name": "Bronze Coin",                            "price": 6,  "kind": "keepsake"},
    "croc_sandals":       {"name": "Crocodile-leather Sandals",              "price": 12, "kind": "keepsake"},
    "secret_flood":       {"name": "The Secret of the Flood",               "price": 25, "kind": "keepsake"},
    "secret_compounding": {"name": "The Secret of Compounding",             "price": 30, "kind": "keepsake"},
    "secret_recursion":   {"name": "The Secret of Recursion",               "price": 35, "kind": "keepsake"},
    "secret_fire":        {"name": "The Secret of Fire",                    "price": 20, "kind": "keepsake"},
    "secret_name":        {"name": "The Secret Name of God",               "price": 50, "kind": "keepsake"},
    "secret_orgchart":    {"name": "The Org Chart (Upper Portion Redacted)","price": 40, "kind": "keepsake"},
    "paperwork_above":    {"name": "The Paperwork From Above",              "price": 33, "kind": "keepsake"},
    "tongue_stone":       {"name": "The Tongue Stone",                      "price": 28, "kind": "keepsake"},
    "attentive_reel":     {"name": "A Reel of Something Attentive",         "price": 36, "kind": "keepsake"},
    "sky_iron":           {"name": "A Sliver of Meteoric Iron",            "price": 44, "kind": "keepsake"},
    "seed_phrase":        {"name": "A Founder's Seed Phrase",              "price": 50, "kind": "keepsake"},
    "future_receipt":     {"name": "A Receipt from the Future",            "price": 13, "kind": "keepsake"},
    "self_equity":        {"name": "Stock Certificate in Yourself",        "price": 22, "kind": "keepsake"},
}
```

- [ ] **Step 3: Redo `catalogue.js`** — `art` replaces `glyph`, same 17 ids, deadpan/cryptic blurbs:

```js
// ── FILE: worlds/nile/shop/catalogue.js ──────────────────
// Presentation data for the bazaar stall. IDs MUST match backend app/shop.py.
// Prices come from the server (game/config.js getShop()). `art` keys ware-art.js.

export const WARES = [
  { id: 'invite_scroll',      name: 'Invite Scroll',                 tier: 'SCROLLS',     art: 'invite_scroll',
    blurb: 'ONE MORE SCROLL. ONE MORE BELIEVER.\nTHE CHAIN GROWS BY ONE EITHER WAY.' },
  { id: 'scarab_amulet',      name: 'Scarab Amulet',                 tier: 'AMULETS',     art: 'scarab_amulet',
    blurb: 'HAND-PRESSED FROM NILE CLAY.\nIMPACT IS ATMOSPHERIC. NOT QUANTIFIABLE.' },
  { id: 'bronze_coin',        name: 'Bronze Coin',                   tier: 'RELICS',      art: 'bronze_coin',
    blurb: 'EGYPTIAN STANDARD WEIGHT.\nA CROSSING SOMEWHERE WILL ASK FOR EXACTLY ONE.' },
  { id: 'croc_sandals',       name: 'Crocodile-leather Sandals',     tier: 'REGALIA',     art: 'croc_sandals',
    blurb: 'THE RIVER RECOGNISES ITS OWN.\nIT IS LESS HUNGRY FOR THOSE WHO WEAR IT.' },
  { id: 'secret_flood',       name: 'The Secret of the Flood',       tier: 'SECRETS',     art: 'secret_flood',
    blurb: 'YOU WILL KNOW BEFORE THE OTHERS KNOW.\nTHEY WERE NOT AT THE WELL.' },
  { id: 'secret_compounding', name: 'The Secret of Compounding',     tier: 'SECRETS',     art: 'secret_compounding',
    blurb: 'THE MATH BENEATH THE MATH.\nIT DOES NOT STOP. THAT IS THE SECRET.' },
  { id: 'secret_recursion',   name: 'The Secret of Recursion',       tier: 'SECRETS',     art: 'secret_recursion',
    blurb: 'YOU ARE YOUR OWN UPLINE.\nDO NOT THINK ABOUT IT TOO LONG.' },
  { id: 'secret_fire',        name: 'The Secret of Fire',            tier: 'SECRETS',     art: 'secret_fire',
    blurb: 'YOU BOUGHT FIRE. FROM A MERCHANT. IN A BAZAAR.\nI DO NOT EXPLAIN. I ONLY SELL.' },
  { id: 'secret_name',        name: 'The Secret Name of God',        tier: 'SECRETS',     art: 'secret_name',
    blurb: 'SPOKEN ONCE, CORRECTLY, IT IS ANSWERED.\nWE DO NOT REHEARSE IT HERE.' },
  { id: 'secret_orgchart',    name: 'The Org Chart',                 tier: 'SECRETS',     art: 'secret_orgchart',
    blurb: 'THERE IS MORE ABOVE YOU THAN YOU WERE TOLD.\nTHE TOP IS NOT YOU. THE TOP IS NOT SHOWN.' },
  { id: 'paperwork_above',    name: 'The Paperwork From Above',      tier: 'SECRETS',     art: 'paperwork_above',
    blurb: 'YOU WERE ENROLLED BEFORE YOU ARRIVED.\nTHIS IS YOUR COPY. THE OTHER IS NOT KEPT HERE.' },
  { id: 'tongue_stone',       name: 'The Tongue Stone',              tier: 'RELICS',      art: 'tongue_stone',
    blurb: 'AFTERWARD YOU UNDERSTAND THINGS\nNOT SAID TO YOU. WE DO NOT DISCUSS BY WHOM.' },
  { id: 'attentive_reel',     name: 'A Reel of Something Attentive', tier: 'RELICS',      art: 'attentive_reel',
    blurb: 'YOU HAVE BEEN OBSERVED. THE OBSERVATION IS THOROUGH.\nTHE OBSERVER IS NOT LISTED.' },
  { id: 'sky_iron',           name: 'A Sliver of Meteoric Iron',     tier: 'RELICS',      art: 'sky_iron',
    blurb: 'A RELIC OF THE SKY GODS.\nIT CAME DOWN. IT DID NOT COME FROM HERE.' },
  { id: 'seed_phrase',        name: "A Founder's Seed Phrase",       tier: 'CURIOS',      art: 'seed_phrase',
    blurb: 'TWELVE WORDS ON LINEN.\nTHE ORIGINAL COLD STORAGE. DO NOT LOSE THE LINEN.' },
  { id: 'future_receipt',     name: 'A Receipt from the Future',     tier: 'CURIOS',      art: 'future_receipt',
    blurb: 'PROOF YOU WILL HAVE PAID.\nKEEP IT. IT WILL NOT SURVIVE THE CROSSING.' },
  { id: 'self_equity',        name: 'Stock Certificate in Yourself', tier: 'CURIOS',      art: 'self_equity',
    blurb: 'LITERAL EQUITY. NOTARISED.\nYOU NOW OWN A SLICE OF THE MOST VOLATILE ASSET YOU KNOW.' },
];

export const WARES_BY_ID = Object.fromEntries(WARES.map(w => [w.id, w]));
```

- [ ] **Step 4: Update the catalogue smoke test** — assert `art` (not `glyph`) and the new count. In `frontend/worlds/nile/shop/__smoke__/catalogue.smoke.mjs` replace the per-ware loop body and final line:

```js
for (const w of WARES) {
  if (!w.name || !w.art || !w.blurb || !w.tier) throw new Error(`incomplete ware ${w.id}`);
  if ('glyph' in w) throw new Error(`ware ${w.id} should use art, not glyph`);
  if ('price' in w) throw new Error(`ware ${w.id} must not hardcode a price`);
}
if (WARES_BY_ID.invite_scroll.tier !== 'SCROLLS') throw new Error("index broken");
console.log(`catalogue smoke OK (${WARES.length} wares)`);
```

- [ ] **Step 5: Update `test_shop_catalogue.py`** if it asserts a specific count or the dropped ids. Add an explicit id-set check:

```python
def test_catalogue_has_expected_ids():
    assert "protection_scroll" not in SHOP_CATALOGUE  # dropped
    assert "blank_scroll" not in SHOP_CATALOGUE        # dropped
    for new_id in ("secret_recursion", "secret_fire", "attentive_reel", "self_equity"):
        assert new_id in SHOP_CATALOGUE
    assert len(SHOP_CATALOGUE) == 17
```

- [ ] **Step 6: Verify**

Run: `docker compose exec -T backend pytest tests/test_shop_catalogue.py -q` → PASS
Run: `cd frontend && node worlds/nile/shop/__smoke__/catalogue.smoke.mjs` → `catalogue smoke OK (17 wares)`
ID parity: `diff <(cd frontend && node -e "import('./worlds/nile/shop/catalogue.js').then(m=>console.log(m.WARES.map(w=>w.id).sort().join('\n')))") <(docker compose exec -T backend python -c "from app.shop import SHOP_CATALOGUE as c;print('\n'.join(sorted(c)))")` → identical.

- [ ] **Step 7: Commit**

```bash
git add frontend/worlds/nile/draw/nile.js backend/app/shop.py frontend/worlds/nile/shop/catalogue.js frontend/worlds/nile/shop/__smoke__/catalogue.smoke.mjs backend/tests/test_shop_catalogue.py
git commit -m "feat(stall): weird catalogue redo (17 wares) + export merchant draws"
```

---

## Task 2: Per-item art registry (`ware-art.js`)

**Files:**
- Create: `frontend/worlds/nile/shop/ware-art.js`

Canvas-coupled (no node smoke). One responsibility: a `WARE_ART` map of `item_id → draw(X, x, y, s, t)` drawing a centered icon of footprint ~`s`, plus a `drawWareArt(X, id, x, y, s, t)` that falls back to a generic crate for any missing id.

- [ ] **Step 1: Create the module with the fallback + ~5 reference icons**

```js
// ── FILE: worlds/nile/shop/ware-art.js ───────────────────
// Procedural pixel icons for the bazaar wares, in the game's draw idiom.
// drawWareArt(X, id, cx, cy, s, t) renders a centered icon; missing ids get
// a generic crate so the grid never blanks. The per-item fns are the
// deliberate iterate-later surface — keep them small and characterful.

const ICON = {
  // Invite scroll — rolled papyrus with a wax seal.
  invite_scroll(X, x, y, s, t) {
    X.fillStyle = '#e8d8b0'; X.fillRect(x - s*0.32, y - s*0.18, s*0.64, s*0.36);
    X.fillStyle = '#cdb888'; X.fillRect(x - s*0.32, y - s*0.18, s*0.06, s*0.36);
    X.fillStyle = '#cdb888'; X.fillRect(x + s*0.26, y - s*0.18, s*0.06, s*0.36);
    X.fillStyle = '#9a3a2a'; X.beginPath(); X.arc(x, y, s*0.1, 0, Math.PI*2); X.fill();
  },
  // Bronze coin — struck disc with a worn profile + glint.
  bronze_coin(X, x, y, s, t) {
    X.fillStyle = '#9a6a2a'; X.beginPath(); X.arc(x, y, s*0.34, 0, Math.PI*2); X.fill();
    X.fillStyle = '#c89030'; X.beginPath(); X.arc(x, y, s*0.27, 0, Math.PI*2); X.fill();
    X.fillStyle = '#6a4a1a'; X.fillRect(x - s*0.06, y - s*0.16, s*0.12, s*0.3);   // profile hint
    X.save(); X.globalAlpha = 0.4 + 0.3*Math.sin(t/300); X.fillStyle = '#ffe9b0';
    X.fillRect(x - s*0.18, y - s*0.18, s*0.06, s*0.06); X.restore();
  },
  // Sky iron — jagged dark shard with a cold glow.
  sky_iron(X, x, y, s, t) {
    X.save(); X.globalAlpha = 0.3 + 0.2*Math.sin(t/500);
    X.fillStyle = '#5a7a9a'; X.beginPath(); X.arc(x, y, s*0.34, 0, Math.PI*2); X.fill(); X.restore();
    X.fillStyle = '#2a2e36'; X.beginPath();
    X.moveTo(x - s*0.2, y + s*0.24); X.lineTo(x - s*0.04, y - s*0.26);
    X.lineTo(x + s*0.16, y - s*0.04); X.lineTo(x + s*0.22, y + s*0.22); X.closePath(); X.fill();
    X.fillStyle = '#4a525e'; X.fillRect(x - s*0.04, y - s*0.2, s*0.04, s*0.34);
  },
  // Attentive reel — papyrus reel with a single watching eye.
  attentive_reel(X, x, y, s, t) {
    X.fillStyle = '#caa86a'; X.beginPath(); X.arc(x, y, s*0.32, 0, Math.PI*2); X.fill();
    X.fillStyle = '#8a6a3a'; X.beginPath(); X.arc(x, y, s*0.12, 0, Math.PI*2); X.fill();
    X.fillStyle = '#e8e2d0'; X.beginPath(); X.ellipse(x, y, s*0.16, s*0.1, 0, 0, Math.PI*2); X.fill();
    const lx = Math.sin(t/600)*s*0.05;
    X.fillStyle = '#1a2a3a'; X.beginPath(); X.arc(x + lx, y, s*0.05, 0, Math.PI*2); X.fill();
  },
  // Founder's seed phrase — linen strip with twelve glyph-ticks.
  seed_phrase(X, x, y, s, t) {
    X.fillStyle = '#e6e0cc'; X.fillRect(x - s*0.36, y - s*0.16, s*0.72, s*0.32);
    X.fillStyle = '#3a3020';
    for (let i = 0; i < 12; i++) {
      const cx = x - s*0.3 + (i % 6) * s*0.12, cy = y - s*0.07 + Math.floor(i/6) * s*0.14;
      X.fillRect(cx, cy, s*0.05, s*0.05);
    }
  },
};

/** Generic crate fallback for any id without a bespoke icon. */
function _crate(X, x, y, s) {
  X.fillStyle = '#6b4a2a'; X.fillRect(x - s*0.3, y - s*0.3, s*0.6, s*0.6);
  X.fillStyle = '#8a6a3a'; X.fillRect(x - s*0.3, y - s*0.3, s*0.6, s*0.08);
  X.fillStyle = '#caa040'; X.font = `${Math.round(s*0.4)}px monospace`; X.textAlign = 'center';
  X.fillText('?', x, y + s*0.14);
}

export function drawWareArt(X, id, cx, cy, s, t) {
  X.save();
  (ICON[id] || ((X2) => _crate(X2, cx, cy, s)))(X, cx, cy, s, t);
  X.restore();
}
```

- [ ] **Step 2: Author the remaining icons (creative surface).** Add an `ICON.<id>` for each of: `scarab_amulet, croc_sandals, secret_flood, secret_compounding, secret_recursion, secret_fire, secret_name, secret_orgchart, paperwork_above, tongue_stone, future_receipt, self_equity`. Each follows the same shape (centered, footprint ~`s`, a few fills). One-line briefs (deadpan/cryptic where cosmic):
  - `scarab_amulet` — blue-green scarab beetle, gold rim.
  - `croc_sandals` — a pair of scaled sandals, green leather, stitch line.
  - `secret_flood` — a notched nilometer column half-submerged, water line.
  - `secret_compounding` — a spiral/loop of coins shrinking inward.
  - `secret_recursion` — a small pyramid containing a smaller pyramid containing a dot.
  - `secret_fire` — a single clean flame on a dark tile (deadpan-plain).
  - `secret_name` — a closed scroll with one glowing hieroglyph (`𓂀`-like shape via rects).
  - `secret_orgchart` — a pyramid with the apex blacked-out / redacted bar.
  - `paperwork_above` — a stamped contract corner, a downward arrow from off-top.
  - `tongue_stone` — a smooth grey stone with a carved mouth.
  - `future_receipt` — a thin receipt strip curling, faint future-date ticks.
  - `self_equity` — a framed certificate with a tiny portrait = the player silhouette.

  Until authored, the fallback crate renders for these — the stall is fully functional with partial art. **This step may be deferred to the product owner.**

- [ ] **Step 3: Syntax check**

Run: `cd frontend && node --check worlds/nile/shop/ware-art.js` → valid.

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/nile/shop/ware-art.js
git commit -m "feat(stall): procedural ware-art registry (reference icons + fallback)"
```

---

## Task 3: Rework `StallOverlay.render()` — tent scene + speaking bar, no balance

**Files:**
- Modify: `frontend/worlds/nile/shop/StallOverlay.js` (`render()` only; imports)

Input/open/close/buy and the grid navigation indices are unchanged — only the drawing changes. The grid still has `COLS` columns and `WARES.length` slots so `this._sel` math is untouched.

- [ ] **Step 1: Swap imports** at the top of `StallOverlay.js`:

```js
import { X, CW, CH }        from '../../../engine/canvas.js';
import { G }                from '../../../game/state.js';
import { Api }              from '../../../game/api.js';
import { loadConfig, getShop, shopLoaded } from '../../../game/config.js';
import { WARES }            from './catalogue.js';
import { purchase, isOwned } from './buy.js';
import { drawWareArt }      from './ware-art.js';
import { drawMerchant, drawMerchantTent } from '../draw/nile.js';
```

- [ ] **Step 2: Replace the whole `render()` method** with the tent-scene version:

```js
  render() {
    if (!this._open) return;
    const shop = getShop();

    // ── Darken the frozen Nile behind the tent ──
    X.fillStyle = 'rgba(10,8,5,0.94)'; X.fillRect(0, 0, CW, CH);

    // ── The tent interior + the shopkeeper (reused bazaar art) ──
    const baseY = CH - 150;                         // interior floor line
    drawMerchantTent(CW / 2, baseY, performance.now());
    // Draw the merchant centered & facing forward: translating by (center - G.px)
    // renders him at screen-center AND makes his look = (G.px - G.px)/140 = 0.
    X.save();
    X.translate(CW / 2 - G.px, 0);
    drawMerchant(G.px, baseY - 2, performance.now());
    X.restore();

    // ── Title ──
    X.textAlign = 'center'; X.fillStyle = '#e6c179'; X.font = 'bold 16px monospace';
    X.fillText('✦ BAZAAR OF BELIEVERS ✦', CW / 2, 26);

    if (this._loading) {
      X.fillStyle = '#cbb288'; X.font = '14px monospace';
      X.fillText('the merchant unrolls his catalogue…', CW / 2, CH / 2);
      X.textAlign = 'left'; return;
    }

    // ── Ware slots: a counter of icons (front rows = table, top row = wall) ──
    const COLS = 6;
    const SLOT = 78, GAP = 6;
    const gridW = COLS * SLOT + (COLS - 1) * GAP;
    const gx0 = (CW - gridW) / 2, gy0 = 70;
    WARES.forEach((w, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = gx0 + col * (SLOT + GAP), y = gy0 + row * (SLOT + GAP);
      const cx = x + SLOT / 2, cy = y + SLOT / 2;
      const priced = shop[w.id];
      const owned  = isOwned(w.id);
      const afford = priced && (G.earned || 0) >= priced.price;
      const sel    = i === this._sel;

      // slot tile
      X.fillStyle = owned ? '#1c2614' : '#241c12';
      X.fillRect(x, y, SLOT, SLOT);
      X.lineWidth = sel ? 3 : 1; X.strokeStyle = sel ? '#f0d9a8' : '#4a3a22';
      X.strokeRect(x + 0.5, y + 0.5, SLOT - 1, SLOT - 1);

      // the custom art (lifts slightly when selected)
      drawWareArt(X, w.id, cx, cy - (sel ? 6 : 2), SLOT * 0.74, performance.now());

      // price / OWNED footer
      X.textAlign = 'center'; X.font = '9px monospace';
      if (owned)        { X.fillStyle = '#9fd98a'; X.fillText('OWNED', cx, y + SLOT - 6); }
      else if (priced)  { X.fillStyle = afford ? '#caa05a' : '#a05a4a';
                          X.fillText(`$${priced.price}`, cx, y + SLOT - 6); }
    });

    // ── The shopkeeper speaks: dialogue-styled bar (mirrors #dlg) ──
    const w = WARES[this._sel], priced = shop[w?.id];
    const barY = CH - 92, barH = 84, pad = 14;
    X.fillStyle = 'rgba(14,10,6,0.96)'; X.fillRect(0, barY, CW, barH);
    X.fillStyle = '#caa040'; X.fillRect(0, barY, CW, 2);
    X.textAlign = 'left'; X.fillStyle = '#e6c179'; X.font = 'bold 11px monospace';
    X.fillText('THE MERCHANT  ✦  BAZAAR OF BELIEVERS', pad, barY + 18);
    if (w) {
      X.fillStyle = '#e8dcc0'; X.font = '12px monospace';
      const line = owned_aside(w, priced);
      line.split('\n').forEach((ln, k) => X.fillText(ln, pad, barY + 38 + k * 15));
    }
    X.fillStyle = '#7a6a4a'; X.font = '9px monospace'; X.textAlign = 'right';
    X.fillText('← → ↑ ↓  ·  SPACE BUY  ·  ESC LEAVE', CW - pad, barY + barH - 8);
    X.textAlign = 'left';
  }
```

- [ ] **Step 3: Add the `owned_aside` helper** as a module-level function in `StallOverlay.js` (above the class), so the merchant's line reflects owned/affordability without a HUD:

```js
/** The merchant's spoken line for a ware — its blurb, with an owned aside.
    Uses isOwned (already imported in Step 1). `priced` is reserved for future
    affordability phrasing; unused for now. */
function owned_aside(w, priced) {
  if (isOwned(w.id)) return `${w.blurb}\n("YOU ALREADY CARRY ONE. ONE IS THE CORRECT NUMBER.")`;
  return w.blurb;
}
```

> Place `owned_aside` after the imports and before `export class StallOverlay`. Do not re-import `isOwned` — Step 1 already did.

- [ ] **Step 4: Confirm the balance readout is gone.** The reworked `render()` above contains no `BALANCE` text — verify: `grep -n "BALANCE" frontend/worlds/nile/shop/StallOverlay.js` returns nothing.

- [ ] **Step 5: Syntax check**

Run: `cd frontend && node --check worlds/nile/shop/StallOverlay.js` → valid.

- [ ] **Step 6: Commit**

```bash
git add frontend/worlds/nile/shop/StallOverlay.js
git commit -m "feat(stall): first-person tent scene, custom art, spoken descriptions, no balance"
```

---

## Task 4: Rebuild + visual verification

**Files:** none.

- [ ] **Step 1: Rebuild the frontend**

Run: `docker compose up -d --build frontend` → frontend restarts.
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/worlds/nile/shop/ware-art.js` → `200`.

- [ ] **Step 2: Backend + parity green**

Run: `docker compose exec -T backend pytest -q` → all pass.

- [ ] **Step 3: Manual visual (your eyes)**

Open `http://localhost:5173`, log in, dev panel (`` ` ``) → +$500 EARNED, walk to THE MERCHANT → "Step up to the table". Confirm:
- the tent interior + the same shopkeeper as outside;
- wares as custom icons (reference icons bespoke, the rest as the `?` crate until authored);
- moving the cursor changes the **bottom bar** to the merchant speaking that ware's description;
- **no balance** in the top-right; price/OWNED shows per slot;
- buying still works; reload → OWNED persists; the Ferryman/Sobek/Joseph hooks still fire for `bronze_coin`/`croc_sandals`/`secret_flood`.

---

## Self-review checklist
- Spec §1 tent scene → Task 3 (drawMerchantTent + drawMerchant). §2 art → Task 2 + `art` field (Task 1). §3 spoken bar → Task 3. §4 no balance → Task 3 Step 4. §5 catalogue redo → Task 1 (backend+frontend in sync, 3 wired ids kept). §6 weird items → Task 1 list.
- Placeholder scan: art Step 2 is an explicit creative-surface deferral with a working fallback, not a silent TODO.
- Type consistency: `drawWareArt(X, id, cx, cy, s, t)` signature matches its call in Task 3; `WARES[].art` used as the registry key; ids identical backend/frontend (Task 1 Step 6 parity check).

## Out of scope
Inventory/ledger/endpoints; the in-game inventory panel; Phase 2/3 economy.
