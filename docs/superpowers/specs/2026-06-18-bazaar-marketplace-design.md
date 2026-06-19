# Design: The Bazaar Marketplace — a first-person stall you can actually buy from

**Date:** 2026-06-18
**Status:** Approved (brainstorm) — pending spec review
**Realm:** `nile` (The Nile — Bazaar of Believers)

## Summary

Turn THE MERCHANT in the Nile bazaar from a pure dialogue tree into an **actual
shop**. Walking up and talking still plays his existing patter; choosing "Show me
the wares" opens a **first-person stall overlay** — the screen reframes to *your
point of view* at his table. You spend your real `earned` credits on wares, you
really own them (persisted), and the deduction is server-authoritative so it
survives WebSocket state sync.

Most wares are deadpan-satirical junk. **Some are quietly useful** in other parts
of the game, with non-obvious utility. A few are anachronistic or cosmic, sold
without explanation. Because every owned item is just a **flag**, items can ship
**ownable-but-dormant** today and be read by whatever the game becomes later —
which matches the game being an open-ended work in progress.

## Goals

- A first-person stall **overlay** on the existing canvas while you stay in the
  `nile` realm (not a new realm).
- Spend `earned`; real deduction; persisted ownership.
- Server-authoritative for accounts; local-only for guests (consistent with how
  guest recruits already work).
- An item model that supports: re-buyable consumables, flavor-only keepsakes,
  quietly-useful keepsakes, and learnable "Secret of X" knowledge.
- A curated ~14-ware catalogue with the right tone (deadpan, cryptic about
  anything cosmic; never names a hidden realm or "aliens").
- Wire only the cheap hooks that have a target *today*; everything else dormant.

## Non-goals

- No new walkable realm; no raycaster/3D.
- No real money (this spends in-game `earned` only — unrelated to Stripe/cashout).
- No general "item effect engine." Utility rides existing systems (the
  `invitesLeft` counter, NPC dialogue gates, portal conditions reading flags).
- No anti-cheat beyond making the spend server-authoritative.
- No inventory *table* or `User.balance` plumbing. (`balance` is the unrelated,
  unimplemented cashout wallet — we do not touch it.)

## Currency decision

Spend **`GameState.earned`** (shown to the player as `$` in the stats panel; the
money the scheme actually paid them). Spending it lowers `net`, which is exactly
right thematically. We do **not** use `User.balance` — that is earmarked for the
unbuilt withdrawal feature and nothing funds it. Nothing requires `earned` to be
monotonic: its only consumer is the milestone popup, which is `!Flags.get(key)`-
gated, so spending down and re-earning will not re-fire popups.

## Item model

Four presentation tiers, but only **two backend kinds** (what `buy` logic needs):

| Backend kind | Repeatable? | On buy (server/local) | Tiers that use it |
|---|---|---|---|
| `consumable` | yes | apply an effect (e.g. `invites_left += n`) | Scrolls (invite) |
| `keepsake`   | no (reject if owned) | set `flags["shop_owned_<id>"] = true` | everything else |

Presentation tiers (frontend grouping only): **Consumable**, **Keepsake
(flavor)**, **Keepsake (useful)**, **Knowledge / Secret**. A "useful keepsake"
and a "Secret" are both just `keepsake` to the backend — their utility is a flag
read elsewhere.

**Ownership = a flag.** `flags["shop_owned_<id>"] = true`. Set by the server
inside the same transaction as the deduction (atomic). For guests, set locally.
The game's existing Flags-gated systems (portal conditions, dialogue branches,
riddle checks) read these flags to express non-obvious utility.

## The catalogue (~15 wares)

Prices are in `earned` dollars. `WIRED` = utility built in v1; `dormant` = ownable
now, read by future content. All blurbs are written in the merchant's deadpan
voice; final copy lives in `catalogue.js`.

### 📜 Scrolls
- **Invite Scroll** (`invite_scroll`) — **$5** — *consumable*, `invites_left += 1`.
  **WIRED (mechanical).** The one genuinely mechanical hook in v1.
- **Protection Scroll** (`protection_scroll`) *(canon)* — **$8** — *keepsake*,
  dormant. "Absorbs spiritual shortfall." No collection mechanic exists yet, so
  it is ownable flavor that a future Sobek-collection system can read.

### 🪲 Keepsake — flavor (canon + satire)
- **Scarab Amulet** (`scarab_amulet`) *(canon)* — **$9** — atmospheric, non-
  quantifiable. Pure flavor.
- **Blank Scroll** (`blank_scroll`) *(canon "potential")* — **$3** — does nothing.
- **A Receipt from the Future** (`future_receipt`) — **$13** — proof you will have
  paid. Flavor.

### 👗👞 Keepsake — useful (dialogue-reaction hooks)
- **Bronze Coin** (`bronze_coin`) — **$6** — Egyptian standard weight. **WIRED:**
  the Ferryman gets a new dialogue branch when you carry it (he literally wants
  "one coin"). Reads `shop_owned_bronze_coin`.
- **Crocodile-leather Sandals** (`croc_sandals`) — **$12** — **WIRED:** Sobek
  acknowledges them in a new dialogue line. Reads `shop_owned_croc_sandals`.

### 🤫 Knowledge / Secret — learnable "tech"
- **The Secret of the Flood** (`secret_flood`) — **$25** — insider foreknowledge.
  **WIRED:** unlocks a Joseph dialogue branch (the Nilometer / "you knew" thread).
  Reads `shop_owned_secret_flood`.
- **The Secret of Compounding** (`secret_compounding`) — **$30** — the foundational
  math. Dormant.
- **The Org Chart (Upper Portion Redacted)** (`secret_orgchart`) — **$40** —
  "there is more above you than you were told." Dormant, cryptic.
- **The Secret Name of God** (`secret_name`) — **$50** — a god reacts differently
  if you know it. Dormant.

### 🌌 The grounded weird / off-world — cryptic, dormant
- **A Sliver of Meteoric Iron** (`sky_iron`) — **$44** — a relic of the sky gods.
  Not bound by space. (User-approved phrasing; "sky gods" stays.) Dormant.
- **The Paperwork From Above** (`paperwork_above`) — **$33** — "you were enrolled
  before you arrived." Dormant, cryptic — never names what is above.
- **The Tongue Stone** (`tongue_stone`) — **$28** — afterward you understand things
  not said to you. Dormant, cryptic.
- **A Founder's Seed Phrase** (`seed_phrase`) — **$50** — twelve words on linen.
  The original cold storage. Dormant, anachronistic.

**v1 wired hooks:** `invite_scroll` (mechanical), `bronze_coin` + `croc_sandals` +
`secret_flood` (NPC dialogue reactions). Everything else is ownable-but-dormant.

## Architecture

### Frontend — `frontend/worlds/nile/shop/`

Isolated module. NileRealm owns one `StallOverlay` and delegates to it.

- **`catalogue.js`** — *presentation only*: for each ware `{ id, name, tier, icon,
  blurb }`. **No prices** (server owns those). `icon` is a small procedural draw
  fn (game's pixel idiom) with a glyph fallback; v1 may use simple shapes/glyphs,
  polish later.
- **`StallOverlay.js`** — the first-person view + input + state:
  - `open()` / `close()` / `isOpen()`.
  - On first `open()`, ensures the catalogue/prices are loaded (see "Config &
    guests") and caches them.
  - `render(ctx)` draws: merchant bust behind a table across the top; a grid of
    ware cards on the table; balance readout (`$earned`); a selection cursor; a
    detail line for the highlighted ware (name, blurb, price, and
    `OWNED` / `CAN'T AFFORD` / buyable state); a controls hint.
  - `onKeyDown(key)`: arrows move the cursor; `Enter`/`Space` buys the highlighted
    ware; `Esc` closes. (Optional mouse: click a card to select/buy.)
- **`buy.js`** — `purchase(item)`:
  - Affordability check (`G.earned >= price`). If not, merchant bark, no spend.
  - Keepsake already owned → no-op bark.
  - **Guest** (`G.isGuest`): apply locally — `G.earned -= price`; consumable →
    apply effect (e.g. `G.invitesLeft += n`); keepsake → `Flags.set('shop_owned_
    <id>', true)`; refresh stats + stall.
  - **Account**: `POST /api/shop/buy {item_id}`. **No optimistic deduction** —
    apply the server's returned `earned` (+ `invites_left`) and set the owned flag
    only on success, so `G.earned` never drifts from sync. On error → merchant
    bark mapped from the status (insufficient / already owned / unknown).

**NileRealm integration** (`NileRealm.js`):
- Hold `this.stall = new StallOverlay()`.
- `onKeyDown(key)`: if `this.stall.isOpen()` return `this.stall.onKeyDown(key)`
  *before* the existing dialogue/portal delegation.
- `update(ts)`: when the stall is open, freeze player movement (skip the walk/
  physics step); still advance any stall animation.
- `render()`: after the normal Nile render, if open, `this.stall.render(ctx)`.
- The merchant dialogue's "Show me the wares" choice calls `this.stall.open()`
  (via an `action`/`onComplete` hook on that node). The rest of the patter
  (pitch / honesty / "none of these sound real") is unchanged.

### Backend

- **`app/shop.py`** — single source of truth, mirroring `payout.py`:
  ```python
  SHOP_CATALOGUE = {
    "invite_scroll":   {"name": "Invite Scroll",   "price": 5,  "kind": "consumable",
                        "effect": {"type": "invites", "amount": 1}},
    "scarab_amulet":   {"name": "Scarab Amulet",   "price": 9,  "kind": "keepsake"},
    # ... all wares ...
  }
  def price_of(item_id): ...
  ```
  Backend only needs `name`, `price`, `kind`, and (consumables) `effect`. Tiers,
  icons, and blurbs are frontend concerns.
- **`GET /api/config`** (extend `game.py`): return
  `{"payout": PAYOUT_CONFIG, "shop": <catalogue prices>}`. Frontend reads shop
  prices from here — never hardcodes them in JS.
- **`routers/shop.py` — `POST /api/shop/buy {item_id}`** (auth required):
  1. `item = SHOP_CATALOGUE.get(item_id)` → 404 if missing.
  2. Load the user's `GameState`.
  3. `earned < price` → **400** (insufficient), no change.
  4. `keepsake` already owned (`flags["shop_owned_<id>"]`) → **409**, no change.
  5. Atomically: `earned -= price`; then `keepsake` → set the owned flag;
     `consumable` → apply effect (`invites_left += amount`). One commit.
  6. Push a WS `state_update` (`earned`, `invites_left`) via the `manager`
     singleton so other tabs reconcile.
  7. Return `{ earned, invites_left, owned: [...] }`.
  - Register the router in the app the same way the others are.

### Config & guests

Guests skip `GameSession` and therefore `loadConfig()`, so they would lack shop
prices. Fix: `StallOverlay.open()` ensures config is loaded — call the existing
`loadConfig`/`/api/config` path lazily on first open if prices aren't present and
cache them. `/api/config` is unauthenticated, so this works for guests. Guests
never call `/api/shop/buy`; their purchases are entirely local, exactly like
guest recruits.

## Data flow

```
walk up → interact → merchant patter (unchanged)
  → "Show me the wares" → stall.open()
      → ensure catalogue/prices loaded (cached; guest-safe)
      → render first-person grid from catalogue + owned flags + $earned
  → select ware → Enter/Space → buy.purchase(item)
      guest:   local deduct + effect/own flag → refresh
      account: POST /api/shop/buy → server deducts + owns atomically
               → WS state_update → client applies returned earned/invites/flag
  → stats panel + stall re-render
  → Esc → stall.close() → back to walking the Nile
```

## Error handling

- Insufficient `earned`: merchant bark, no deduction (server 400 / local guard).
- Keepsake already owned: shown `OWNED`, not buyable (server 409 as backstop).
- Unknown item: server 404 (should be unreachable from a valid client).
- Network failure (account): no optimistic deduction — `earned` only changes on a
  confirmed response; on failure, a "the papyrus is not ready" bark, state intact.
- Guest: never hits the network; purely local.

## Testing

**Backend (pytest, `backend/tests/`, matching `test_auth.py` conventions):**
`backend/tests/test_shop.py` —
- buy keepsake: `earned` decreases by price, owned flag set.
- buy keepsake already owned → 409, no change.
- buy consumable (`invite_scroll`): `earned` down, `invites_left` up, repeatable.
- insufficient funds → 400, `earned`/flags unchanged.
- unknown item → 404.
- atomicity: a rejected buy leaves no flag set and no deduction.

**Frontend:** pure-logic unit test of `buy.purchase` branch selection
(afford / can't-afford / guest-vs-account / already-owned) if a JS test runner is
available; otherwise manual via the dev panel (`+$500 EARNED`, then buy and
confirm `earned`, ownership, and an NPC reacting to a wired item).

**Manual end-to-end:** buy an Invite Scroll → `invitesLeft` rises; buy the Bronze
Coin → the Ferryman's new branch appears; buy a dormant cosmic item → owned, no
visible effect, deadpan.

## Open / deferred

- Re-buyable keepsakes (buying multiple worthless trinkets) — deferred; v1 is
  one-time per keepsake (boolean flag). Revisit with a counter if desired.
- Procedural pixel icons vs glyphs — v1 may ship simple glyphs/shapes; art polish
  is a follow-up.
- The ✦✦ utilities (Eye of Horus reveal, Clay Lamp lighting, Anubis Mask, Priest's
  Vestments, Vial of Nile Water, Linen Robe cosmetic) are out of v1 scope; they
  can be added as future wares or future hooks without reworking the system.
```
