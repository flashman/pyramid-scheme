# Design: Shop Inventory + DB Ledger (first-class items)

**Date:** 2026-06-18
**Status:** Approved (brainstorm) — pending spec review
**Builds on:** `feat/bazaar-marketplace` (the MVP shop). This design **replaces that shop's flag-based ownership** with a real DB-backed inventory and an append-only ledger.

## Summary

The MVP shop stores ownership as booleans (`GameState.flags["shop_owned_<id>"]`) — not first-class, not auditable, and forgeable because `PUT /api/state` lets the client write any flag. This design makes items real DB state: a dedicated **`inventory`** table for what each user holds, the existing **`Transaction`** table as an **append-only ledger** of every shop event, a **namespace lock** so ownership changes only through shop endpoints, and **player control** over items (use, equip, sell/discard, gift). Currency stays in-game `earned` — "real transactions" means real ledger rows, not real money (Stripe stays stubbed).

The system is designed in full here but **built in three phases**, each shipping working software:

- **Phase 1 — Foundation:** `inventory` table + `Transaction` ledger + namespace lock + clean migration; rework `POST /api/shop/buy` to write inventory + ledger (no flags); `GET /api/me` returns inventory; re-point the NPC hooks + `StallOverlay` + `buy.js` from `shop_owned_*` flags to a new client `Inventory` store.
- **Phase 2 — Control:** `use` and `equip`; consumables become *held then used*; equip-aware NPC hooks.
- **Phase 3 — Economy:** `sell`, `discard`, `gift`.

## Goals

- Items are first-class, queryable DB rows (quantity, equipped, timestamps).
- Every shop event is recorded in an append-only ledger (the `Transaction` table).
- Ownership is server-authoritative and **not** forgeable via the client flag-sync channel.
- Players can use, equip, sell/discard, and gift items.
- Each phase is independently shippable and reviewable.

## Non-goals

- No real money / Stripe (spend stays in-game `earned`).
- No flag→inventory data backfill — **we start clean** (dev data is wiped; `down -v`).
- No equip *slots* (equipped is a per-item boolean; multiple items may be equipped).
- No gift rate-limiting/anti-abuse beyond "direct recruits only" + basic validation.
- No marketplace between arbitrary users (gifts flow to direct recruits only).

## Currency

Unchanged: spend and refund `GameState.earned`. Sell-back credits `earned`. The `Transaction.amount` column records the credit delta of each event (negative = spent, positive = refunded, 0 = item-only move).

---

## 1. Data model

### 1.1 `inventory` table (new — Alembic migration)

| column | type | notes |
|---|---|---|
| `id` | int PK | |
| `user_id` | int FK→users.id, indexed | owner |
| `item_id` | str(64) | matches `SHOP_CATALOGUE` key |
| `quantity` | int, default 1 | keepsakes capped at 1; consumables stack |
| `equipped` | bool, default false | Phase 2 |
| `acquired_at` | datetime | first acquisition |
| `updated_at` | datetime | onupdate |

**Unique constraint `(user_id, item_id)`** — one row per item type per user. A SQLAlchemy `Inventory` model is added to `models.py` with a `User.inventory` relationship.

### 1.2 `Transaction` table = the append-only ledger (existing)

No schema change. Shop events append rows:

| `type` | `amount` (Δ `earned`) | `ref_id` | `meta` |
|---|---|---|---|
| `shop_buy`      | −price  | `item_id` | `{qty}` |
| `shop_sell`     | +refund | `item_id` | `{qty, refund}` |
| `shop_use`      | 0       | `item_id` | `{effect}` |
| `shop_discard`  | 0       | `item_id` | `{qty}` |
| `shop_gift_out` | 0       | `item_id` | `{counterparty_user_id}` |
| `shop_gift_in`  | 0       | `item_id` | `{counterparty_user_id}` |

This mirrors how buy-ins already write `Transaction` rows, so the shop is consistent with the existing economy. Revenue, per-item popularity, and a user's purchase history all become plain SQL.

### 1.3 Namespace lock (the security fix)

`PUT /api/state` currently merges arbitrary client flags. It will **strip reserved keys** before merging:

```python
RESERVED_FLAG_PREFIXES = ("shop_owned_",)   # server-owned; never client-settable
# in save_state, before merge:
incoming = {k: v for k, v in body.flags.items()
            if not k.startswith(RESERVED_FLAG_PREFIXES)}
state.flags = {**(state.flags or {}), **incoming}
```

After Phase 1 nothing writes `shop_owned_*` anymore, but the lock guarantees a client can never grant itself ownership through the flag channel. (Defense in depth — ownership lives in `inventory`, not flags.)

---

## 2. Catalogue schema (extends `app/shop.py`)

`SHOP_CATALOGUE` entries gain optional behaviour fields (frontend `catalogue.js` keeps presentation only):

```python
"invite_scroll": {
    "name": "Invite Scroll", "price": 5, "kind": "consumable",
    "effect": {"type": "invites", "amount": 1},   # applied on buy (P1) / on use (P2)
},
"croc_sandals": {
    "name": "Crocodile-leather Sandals", "price": 12, "kind": "keepsake",
    "equip": True,                                 # P2: equippable; hooks check equipped
},
"secret_flood": {
    "name": "The Secret of the Flood", "price": 25, "kind": "keepsake",
    # owned-gated hook (Joseph); no equip/use
},
# optional per-item sell-back override; global default 0.25
"...": { "sell_pct": 0.25 },
```

- `kind` governs stacking (`keepsake`→max qty 1, idempotent buy → 409; `consumable`→qty++).
- `effect` — consumable effect; Phase 1 applies it on buy, Phase 2 applies it on **use**.
- `equip: True` — item is equippable (Phase 2).
- `sell_pct` — optional override of the global `SELL_BACK_PCT = 0.25` (Phase 3).

---

## 3. The four verbs (semantics)

### Buy (Phase 1 rework)
1. Validate item exists, affordability (`earned >= price`).
2. Keepsake already owned (qty ≥ 1) → **409**.
3. Atomic, one commit: deduct `earned`; upsert `inventory` row (keepsake → create qty1; consumable → qty++); write `shop_buy` ledger row. **Phase 1:** consumables *also* apply their `effect` immediately (so the invite-scroll hook doesn't regress); **Phase 2** moves effect application to `use`.
4. WS `state_update` (earned) + `inventory_update`.

### Use (Phase 2)
`POST /api/shop/use {item_id}` — require qty ≥ 1.
- **consumable:** apply `effect`, `quantity -= 1` (delete row at 0); `shop_use` ledger row.
- **keepsake with a `use`:** apply effect, not consumed (re-usable).
- No `use` defined → 400.

### Equip (Phase 2)
`POST /api/shop/equip {item_id, equipped: bool}` — require ownership and `equip: True`; set `equipped`. NPC/portal hooks that gate on a worn item check `equipped` (e.g. Crocodile Sandals protect only when worn; Bronze Coin offered when held). Phase 1 hooks gate on *owned*; Phase 2 upgrades the equip-relevant ones to *equipped*.

### Sell / Discard (Phase 3)
- `POST /api/shop/sell {item_id}` — require qty ≥ 1; `quantity -= 1`; credit `earned += floor(price * sell_pct)`; `shop_sell` ledger row.
- `POST /api/shop/discard {item_id}` — require qty ≥ 1; `quantity -= 1`; no refund; `shop_discard` ledger row.
- Selling/discarding an equipped last unit auto-unequips.

### Gift (Phase 3)
`POST /api/shop/gift {item_id, to_user_id}`:
- `to_user_id` must be a **direct recruit** of the giver (recipient's `recruiter_id == giver.id`, per the `User.recruiter_id` self-FK); else 403.
- Giver must hold qty ≥ 1 and the item must not be `equipped` (400 if equipped).
- One DB transaction: giver `quantity -= 1`; recipient `inventory` row upsert `quantity += 1`; two ledger rows (`shop_gift_out` for giver, `shop_gift_in` for recipient).
- WS `inventory_update` to both users.
- **Guests cannot gift** (no real recipient); endpoint requires auth on both sides.

---

## 4. Client architecture

### `Inventory` store (`frontend/game/inventory.js`)
A small module mirroring `Flags`' shape: holds `{ item_id: {quantity, equipped} }`, hydrated from `GET /api/me` and updated on shop responses + WS `inventory_update`.

```
Inventory.owned(itemId)      // quantity >= 1
Inventory.qty(itemId)        // number
Inventory.isEquipped(itemId) // bool
Inventory.all()              // snapshot
Inventory.hydrate(arr)       // from /api/me
Inventory.apply(update)      // from a shop action / WS
```

### Re-pointing (Phase 1, the heart of it)
- `GET /api/me` returns an `inventory` array (`{item_id, quantity, equipped}`); `session.js` hydrates the store.
- **`buy.js`, `StallOverlay.js`, and the NPC dialogue hooks stop reading `Flags.get('shop_owned_*')` and read `Inventory.owned(...)` instead.** This is the breaking change that removes flag-ownership.
- Guest mode: the store is client-only (no server calls), exactly like guest recruits. Buy/use/equip/sell mutate the local store; **gift is disabled for guests**.

### WS events
`inventory_update` carries the changed rows (`[{item_id, quantity, equipped}]`); the store applies them so multiple tabs / gift recipients stay in sync. Reuses the `manager` singleton.

---

## 5. API surface by phase

| Phase | Endpoints | Other |
|---|---|---|
| 1 | rework `POST /api/shop/buy` (inventory+ledger, no flags) | `inventory` table + migration; `GET /api/me` inventory; namespace lock; `Inventory` store; re-point hooks/UI; WS `inventory_update` |
| 2 | `POST /api/shop/use`, `POST /api/shop/equip` | consumables held-then-used; equip-aware hooks |
| 3 | `POST /api/shop/sell`, `POST /api/shop/discard`, `POST /api/shop/gift` | gift validation (direct recruit); auto-unequip on remove |

## 6. Migration

Single Alembic migration (Phase 1): **create the `inventory` table** with the unique constraint and indexes. **No data backfill** — we start clean (existing `shop_owned_*` flags are abandoned; dev data is wiped via `docker compose down -v`). Schema is Alembic-only (no `create_all`), per project rules.

## 7. Testing

**Backend (pytest):**
- Phase 1: buy writes an `inventory` row + a `shop_buy` `Transaction`; keepsake re-buy → 409; consumable buy stacks qty and applies effect; `GET /api/me` returns inventory; **namespace lock** — `PUT /api/state` with `{flags:{shop_owned_x:true}}` does **not** grant ownership; migration creates the table.
- Phase 2: use decrements qty + applies effect + ledger row; use at qty 0 → 400; equip toggles flag; equip non-equippable → 400.
- Phase 3: sell refunds `floor(price*pct)` + decrements + ledger; discard no refund; gift to direct recruit moves qty atomically + two ledger rows; gift to non-recruit → 403; gift equipped item → 400; gift as guest → 401/403.

**Frontend:** `Inventory` store node smoke (hydrate/apply/owned/qty/equipped); manual E2E per phase (buy→inventory reflects; use spends; equip toggles a hook; sell refunds; gift appears on a recruit).

## 8. Open / deferred

- Equip **slots** (neck/feet/held) — deferred; boolean equip for now.
- Gift anti-abuse (rate limits, cooldowns) — deferred; direct-recruit-only is the only guard.
- Re-buyable/stackable **keepsakes** — keepsakes remain unique (qty 1); only consumables stack.
- A dedicated in-game **inventory UI panel** (browse/equip/sell/gift outside the stall) — likely needed by Phase 2/3; its visual design is a separate brainstorm.
