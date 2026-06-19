# Design: Bazaar Stall — Visual Redo + Weird Catalogue

**Date:** 2026-06-18
**Status:** Approved (brainstorm) — starting point; art/items may be iterated by the user later.
**Branch:** `feat/bazaar-marketplace`
**Scope:** Frontend `StallOverlay` rework + per-item art + catalogue redo. Backend change is limited to keeping `SHOP_CATALOGUE` ids/prices in sync. **No inventory/ledger/endpoint changes.**

## Goals (the six asks)
1. Custom per-item art instead of emojis.
2. The shopkeeper inside looks like he does outside (reuse existing art).
3. A tent-interior scene: wares laid out on the table and hung on the walls.
4. Selecting a ware shows its description as the shopkeeper *speaking* (dialogue-styled bar).
5. No balance readout in the top-right.
6. Redo the catalogue back to the weirder cosmic/cryptic/anachronistic set.

## 1. The tent scene (reuse existing art)
`StallOverlay.render()` composes a first-person tent interior on the canvas:
- **Backdrop:** the existing `drawMerchantTent(cx, baseY, t)` (back wall, canopy, valance, lantern, signboard) — same art as the exterior bazaar, so it reads as "inside his tent."
- **Shopkeeper:** the existing `drawMerchant(x, baseY, t)` centered behind the table — identical figure (fez, sly grin, tracking eyes). Eye-tracking input (`G.px - x`) is neutralized while the stall is open (pass a stable reference so he faces the player).
- **Ware table:** a wooden counter across the foreground. Wares are arranged in **slots**: a front row on the table, a back row **hung on the tent wall**. ~8–9 slots visible; if the catalogue exceeds the slots, the grid paginates or scrolls (simple left/right page; decided at plan time — start with a single fitted grid sized to the count).
- **Selection:** the cursor highlights the active slot (warm gold outline + a few px "lift"); arrow keys move it; Space/Enter buys; Esc leaves (unchanged input model).

These draw functions live in `worlds/nile/draw/nile.js` and are already exported/usable; the overlay imports them. (If not exported, export them — no behavior change to the bazaar.)

## 2. Per-item art (`worlds/nile/shop/ware-art.js`)
A new module mapping `item_id → draw(x, y, size, t)`, each a small procedural pixel icon in the game's idiom (a handful of shapes, characterful, animated subtly via `t` where it helps). Examples of intent:
- `seed_phrase` — a linen strip with twelve tiny glyph-ticks.
- `sky_iron` — a jagged dark shard with a faint cold glow.
- `attentive_reel` — a papyrus reel with a single watching eye.
- `bronze_coin` — a struck coin with a worn profile.
- `tongue_stone` — a smooth stone with a carved mouth.

`catalogue.js` entries carry `art: '<item_id>'` (the registry key) and **drop `glyph`**. A small fallback (a question-mark crate) covers any id without art so the grid never blanks. Fidelity is "clear and characterful," not elaborate — these are easy to iterate later.

## 3. Description as the shopkeeper speaking
A **dialogue-styled bar** drawn across the bottom of the canvas (not the HTML `#dlg`), mirroring its look: dark rounded panel, a gold speaker line `THE MERCHANT  ✦  BAZAAR OF BELIEVERS`, and the selected ware's `blurb` rendered as his line (word-wrapped). It updates **reactively** as the cursor moves — browsing becomes him pitching each ware. Owned/affordability state is reflected in his line (e.g. an `OWNED` tag or a "you already carry one" aside), keeping that info without a separate HUD.

## 4. No balance readout
Remove the top-right `BALANCE $…`. Affordability is conveyed per-ware: the price sits on/under each slot, dimmed/reddened when unaffordable, replaced by `OWNED` for keepsakes already held (read from the `Inventory` store, as today).

## 5. Catalogue redo (weird set)
`backend/app/shop.py` `SHOP_CATALOGUE` and `frontend/worlds/nile/shop/catalogue.js` updated in lockstep (ids must match; prices server-owned). Dev data is wiped, so dropping old ids is fine. **The three gameplay-wired ids are kept** (`secret_flood`→Joseph, `bronze_coin`→Ferryman, `croc_sandals`→Sobek) plus the consumable `invite_scroll`.

Proposed ~17 wares (final names/blurbs written at implementation; `*`=wired id kept, `+`=restored weird item):

| id | name | price | kind |
|---|---|---|---|
| `invite_scroll`* | Invite Scroll | 5 | consumable |
| `scarab_amulet` | Scarab Amulet | 9 | keepsake |
| `bronze_coin`* | Bronze Coin | 6 | keepsake |
| `croc_sandals`* | Crocodile-leather Sandals | 12 | keepsake |
| `secret_flood`* | The Secret of the Flood | 25 | keepsake |
| `secret_compounding` | The Secret of Compounding | 30 | keepsake |
| `secret_recursion`+ | The Secret of Recursion | 35 | keepsake |
| `secret_fire`+ | The Secret of Fire | 20 | keepsake |
| `secret_name` | The Secret Name of God | 50 | keepsake |
| `secret_orgchart` | The Org Chart (Upper Portion Redacted) | 40 | keepsake |
| `paperwork_above` | The Paperwork From Above | 33 | keepsake |
| `tongue_stone` | The Tongue Stone | 28 | keepsake |
| `attentive_reel`+ | A Reel of Something Attentive | 36 | keepsake |
| `sky_iron` | A Sliver of Meteoric Iron | 44 | keepsake |
| `seed_phrase` | A Founder's Seed Phrase | 50 | keepsake |
| `future_receipt` | A Receipt from the Future | 13 | keepsake |
| `self_equity`+ | Stock Certificate in Yourself | 22 | keepsake |

Dropped from the current set: `protection_scroll`, `blank_scroll` (flavor scrolls; cut to keep the grid weird and tight). Blurbs stay deadpan and cryptic about anything cosmic (never names "aliens"/the Council).

## Architecture & isolation
- `ware-art.js` — pure draw registry (one responsibility: ware icons). Node-safe? No — it draws on the canvas context, so it imports `engine/canvas.js`; not node-smoke-testable (manual/visual verify).
- `StallOverlay.js` — rework `render()` only; input/open/close/buy logic unchanged. It already imports `X, CW, CH`; add imports of the merchant/tent draws and `WARE_ART`.
- `catalogue.js` — data only (`art` replaces `glyph`).
- `shop.py` — catalogue data only.

## Testing
- **Backend:** update `test_shop_catalogue.py` expectations if it asserts specific ids/counts; keep `public_catalogue` shape; `pytest -q` green. ID-parity check (frontend ids == backend ids) as before.
- **Frontend:** `catalogue.smoke.mjs` updated (no `glyph`; `art` present for each; count). `ware-art.js` is canvas-coupled → manual visual verify. Live: rebuild, open the stall, confirm tent scene + merchant + per-item art + speaking descriptions + no balance + new items buyable; wired NPC hooks still fire for the kept ids.

## Out of scope
Inventory/ledger/endpoints (unchanged); the in-game inventory panel; any Phase 2/3 economy (cut).
