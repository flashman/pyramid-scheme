# Shop Inventory + Ledger — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the MVP shop's flag-based ownership with first-class DB state — an `inventory` table, the `Transaction` table as an append-only ledger, a namespace lock so ownership can't be forged via client flag-sync, and a frontend `Inventory` store that the buy flow, stall, and NPC hooks read instead of `shop_owned_*` flags.

**Architecture:** Ownership becomes rows in a new `inventory` table (`user_id, item_id, quantity, equipped`, unique per user+item). `POST /api/shop/buy` upserts that row and writes a `shop_buy` row to the existing `Transaction` ledger, atomically. `GET /api/me` and a WS `inventory_update` carry the inventory to a client `Inventory` store; `buy.js`, `StallOverlay`, and the Ferryman/Sobek/Joseph hooks read the store. Phase 1 keeps consumables applying their effect on buy (use-on-demand is Phase 2).

**Tech Stack:** Backend — FastAPI, async SQLAlchemy, Alembic (hand-written migrations), pytest (`backend/tests/`, conftest harness). Frontend — vanilla ES modules, no bundler (node smoke checks + manual verification).

**Spec:** `docs/superpowers/specs/2026-06-18-shop-inventory-ledger-design.md` (Phase 1 scope only)

**Branch:** continue on `feat/bazaar-marketplace` (this supersedes its flag-ownership).

---

## File structure (Phase 1)

| File | Responsibility | Action |
|---|---|---|
| `backend/app/models.py` | `Inventory` model + `User.inventory` rel | modify |
| `backend/alembic/versions/0002_inventory.py` | create `inventory` table | create |
| `backend/app/inventory.py` | inventory helpers (grant/list) | create |
| `backend/app/schemas.py` | `InventoryItemOut`; `MeResponse.inventory`; `ShopBuyResponse.inventory` | modify |
| `backend/app/routers/shop.py` | buy → inventory + ledger | modify |
| `backend/app/routers/game.py` | `/api/me` inventory; namespace lock in `/api/state` | modify |
| `frontend/game/inventory.js` | client `Inventory` store | create |
| `frontend/game/session.js` | hydrate inventory; WS `inventory_update` | modify |
| `frontend/worlds/nile/shop/buy.js` | read/write `Inventory` (not flags) | modify |
| `frontend/worlds/nile/shop/buy-plan.js` | drop obsolete `ownedKey` | modify |
| `frontend/worlds/nile/dialogue.js` | 3 hooks → `Inventory.owned` | modify |

`StallOverlay.js` needs no change — it imports `isOwned` from `buy.js`, which we re-point internally.

---

## Task 1: `Inventory` model

**Files:**
- Modify: `backend/app/models.py:4` (import) and add the model + `User.inventory` relationship
- Test: `backend/tests/test_inventory_model.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_inventory_model.py
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import Inventory
from tests.conftest import TestingSessionLocal, make_user


async def test_inventory_row_roundtrips_and_is_unique_per_user_item():
    uid = await make_user(earned=0)
    async with TestingSessionLocal() as db:
        db.add(Inventory(user_id=uid, item_id="scarab_amulet", quantity=1))
        await db.commit()
    async with TestingSessionLocal() as db:
        row = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalar_one()
        assert row.item_id == "scarab_amulet"
        assert row.quantity == 1
        assert row.equipped is False
    # duplicate (user_id, item_id) is rejected
    with pytest.raises(IntegrityError):
        async with TestingSessionLocal() as db:
            db.add(Inventory(user_id=uid, item_id="scarab_amulet", quantity=1))
            await db.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T backend pytest tests/test_inventory_model.py -v`
Expected: FAIL — `ImportError: cannot import name 'Inventory'`

- [ ] **Step 3: Add the model**

In `backend/app/models.py`, extend the sqlalchemy import (line 4) to include `UniqueConstraint`:

```python
from sqlalchemy import Integer, String, Numeric, Boolean, DateTime, ForeignKey, JSON, UniqueConstraint
```

Add the `User.inventory` relationship inside the `User` class, next to the other relationships (after the `events` relationship line):

```python
    inventory:     Mapped[list[Inventory]]       = relationship("Inventory", back_populates="user")
```

Add the model (place it after the `GameState` class):

```python
# ── Inventory ─────────────────────────────────────────────

class Inventory(Base):
    __tablename__ = "inventory"

    id:          Mapped[int]      = mapped_column(Integer, primary_key=True)
    user_id:     Mapped[int]      = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    item_id:     Mapped[str]      = mapped_column(String(64), nullable=False)
    quantity:    Mapped[int]      = mapped_column(Integer, default=1, nullable=False)
    equipped:    Mapped[bool]     = mapped_column(Boolean, default=False, nullable=False)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_inventory_user_item"),)

    user: Mapped[User] = relationship("User", back_populates="inventory")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T backend pytest tests/test_inventory_model.py -v`
Expected: PASS (the conftest creates tables from model metadata via `Base.metadata.create_all`)

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py backend/tests/test_inventory_model.py
git commit -m "feat(inventory): Inventory model + User.inventory relationship"
```

---

## Task 2: Alembic migration for the `inventory` table

**Files:**
- Create: `backend/alembic/versions/0002_inventory.py`

Tests run off `Base.metadata` (conftest), so they don't need this migration — but the real dev/prod DB does. This task creates and applies it.

- [ ] **Step 1: Write the migration** (hand-written, matching `0001_initial_schema.py` style)

```python
# backend/alembic/versions/0002_inventory.py
"""inventory table

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision      = "0002"
down_revision = "0001"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.create_table(
        "inventory",
        sa.Column("id",          sa.Integer,      primary_key=True),
        sa.Column("user_id",     sa.Integer,      sa.ForeignKey("users.id"), nullable=False),
        sa.Column("item_id",     sa.String(64),   nullable=False),
        sa.Column("quantity",    sa.Integer,      nullable=False, server_default="1"),
        sa.Column("equipped",    sa.Boolean,      nullable=False, server_default=sa.false()),
        sa.Column("acquired_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "item_id", name="uq_inventory_user_item"),
    )
    op.create_index("ix_inventory_user_id", "inventory", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_inventory_user_id", table_name="inventory")
    op.drop_table("inventory")
```

- [ ] **Step 2: Apply it to the dev DB**

Run: `docker compose exec backend alembic upgrade head`
Expected: `Running upgrade 0001 -> 0002, inventory table`

- [ ] **Step 3: Verify the table exists**

Run: `docker compose exec backend alembic current`
Expected: `0002 (head)`

Run: `docker compose exec -T db psql -U pyramid -d pyramid_scheme -c "\d inventory" | head -14`
Expected: the `inventory` table with columns and the `uq_inventory_user_item` constraint. (DB creds from compose: user `pyramid`, db `pyramid_scheme`.)

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/0002_inventory.py
git commit -m "feat(inventory): alembic migration creating the inventory table"
```

---

## Task 3: Inventory helpers (`app/inventory.py`)

**Files:**
- Create: `backend/app/inventory.py`
- Test: `backend/tests/test_inventory_helpers.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_inventory_helpers.py
from sqlalchemy import select
from app.models import Inventory
from app.inventory import grant_item, inventory_list
from tests.conftest import TestingSessionLocal, make_user


async def test_grant_keepsake_creates_qty1_then_stays_at_1():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        await grant_item(db, uid, "scarab_amulet"); await db.commit()
        await grant_item(db, uid, "scarab_amulet"); await db.commit()  # keepsake: no stack
        row = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalar_one()
        assert row.quantity == 1


async def test_grant_consumable_stacks():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        await grant_item(db, uid, "invite_scroll"); await db.commit()
        await grant_item(db, uid, "invite_scroll"); await db.commit()
        row = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalar_one()
        assert row.quantity == 2


async def test_inventory_list_shape():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        await grant_item(db, uid, "scarab_amulet"); await db.commit()
        lst = await inventory_list(db, uid)
    assert lst == [{"item_id": "scarab_amulet", "quantity": 1, "equipped": False}]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec -T backend pytest tests/test_inventory_helpers.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.inventory'`

- [ ] **Step 3: Implement the helpers**

```python
# backend/app/inventory.py
"""Inventory mutation + read helpers. Operate on a session; never commit
(callers commit so the deduction + grant + ledger row stay atomic)."""
from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Inventory
from app.shop import get_item


async def grant_item(db: AsyncSession, user_id: int, item_id: str) -> Inventory:
    """Upsert one unit. Keepsake → ensure a qty-1 row (no stacking);
    consumable → create at 1 or increment. Returns the row. Does NOT commit."""
    item = get_item(item_id)
    res  = await db.execute(select(Inventory).where(
        Inventory.user_id == user_id, Inventory.item_id == item_id))
    row = res.scalar_one_or_none()
    if row is None:
        row = Inventory(user_id=user_id, item_id=item_id, quantity=1)
        db.add(row)
    elif item and item["kind"] == "consumable":
        row.quantity += 1
    return row


async def inventory_list(db: AsyncSession, user_id: int) -> list[dict]:
    """Client-safe inventory: [{item_id, quantity, equipped}]."""
    res = await db.execute(select(Inventory).where(Inventory.user_id == user_id))
    return [{"item_id": r.item_id, "quantity": r.quantity, "equipped": r.equipped}
            for r in res.scalars().all()]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec -T backend pytest tests/test_inventory_helpers.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/inventory.py backend/tests/test_inventory_helpers.py
git commit -m "feat(inventory): grant_item + inventory_list helpers"
```

---

## Task 4: Schemas — `InventoryItemOut`, and add inventory to responses

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Add the inventory item schema and wire it into responses**

Add near the Shop section of `backend/app/schemas.py`:

```python
class InventoryItemOut(BaseModel):
    item_id:  str
    quantity: int
    equipped: bool
```

Change `ShopBuyResponse` — replace its `owned: list[str]` field with inventory:

```python
class ShopBuyResponse(BaseModel):
    ok:           bool
    item_id:      str
    earned:       float
    invites_left: int
    inventory:    list[InventoryItemOut]
```

Add `inventory` to `MeResponse` (after the `flags` field):

```python
    inventory:    list[InventoryItemOut] = []
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat(inventory): InventoryItemOut; inventory in Me + ShopBuy responses"
```

---

## Task 5: Rework `POST /api/shop/buy` → inventory + ledger

**Files:**
- Modify: `backend/app/routers/shop.py` (replace the buy logic)
- Modify: `backend/tests/test_shop_buy.py` (update assertions: inventory + Transaction, not flags)

- [ ] **Step 1: Update the tests first**

Replace `backend/tests/test_shop_buy.py` with:

```python
from sqlalchemy import select
from app.models import GameState, Inventory, Transaction
from tests.conftest import TestingSessionLocal, make_user, auth_headers


async def test_buy_keepsake_creates_inventory_row_and_ledger(client):
    uid = await make_user(earned=20.0)
    async with client as c:
        res = await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
    assert res.status_code == 200
    body = res.json()
    assert body["earned"] == 11.0
    assert {"item_id": "scarab_amulet", "quantity": 1, "equipped": False} in body["inventory"]
    async with TestingSessionLocal() as db:
        inv = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalar_one()
        assert inv.item_id == "scarab_amulet" and inv.quantity == 1
        tx = (await db.execute(select(Transaction).where(Transaction.user_id == uid))).scalar_one()
        assert tx.type == "shop_buy" and float(tx.amount) == -9.0 and tx.ref_id == "scarab_amulet"


async def test_buy_keepsake_twice_returns_409(client):
    uid = await make_user(earned=50.0)
    async with client as c:
        await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
        res = await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
    assert res.status_code == 409
    async with TestingSessionLocal() as db:
        st = (await db.execute(select(GameState).where(GameState.user_id == uid))).scalar_one()
        assert float(st.earned) == 41.0   # only the first buy charged


async def test_buy_consumable_stacks_qty_and_applies_effect(client):
    uid = await make_user(earned=20.0, invites=0)
    async with client as c:
        await c.post("/api/shop/buy", json={"item_id": "invite_scroll"}, headers=auth_headers(uid))
        r2 = await c.post("/api/shop/buy", json={"item_id": "invite_scroll"}, headers=auth_headers(uid))
    body = r2.json()
    assert body["earned"] == 10.0
    assert body["invites_left"] == 2      # effect still applied on buy in Phase 1
    assert {"item_id": "invite_scroll", "quantity": 2, "equipped": False} in body["inventory"]


async def test_buy_insufficient_funds_returns_400_no_change(client):
    uid = await make_user(earned=2.0)
    async with client as c:
        res = await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
    assert res.status_code == 400
    async with TestingSessionLocal() as db:
        st  = (await db.execute(select(GameState).where(GameState.user_id == uid))).scalar_one()
        inv = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalars().all()
        assert float(st.earned) == 2.0 and inv == []


async def test_buy_unknown_item_returns_404(client):
    uid = await make_user(earned=50.0)
    async with client as c:
        res = await c.post("/api/shop/buy", json={"item_id": "nope"}, headers=auth_headers(uid))
    assert res.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec -T backend pytest tests/test_shop_buy.py -v`
Expected: FAIL (current endpoint returns `owned`, sets flags, no Inventory/Transaction)

- [ ] **Step 3: Rewrite the buy endpoint**

Replace the body of `buy_item` in `backend/app/routers/shop.py`. New full file:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState, Inventory, Transaction
from app.schemas import ShopBuyRequest, ShopBuyResponse
from app.auth import get_current_user
from app.shop import get_item
from app.inventory import grant_item, inventory_list
from app.ws import manager

router = APIRouter()


@router.post("/shop/buy", response_model=ShopBuyResponse)
async def buy_item(
    body: ShopBuyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = get_item(body.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Unknown item: {body.item_id}")

    res   = await db.execute(select(GameState).where(GameState.user_id == current_user.id))
    state = res.scalar_one_or_none()
    if not state:
        state = GameState(user_id=current_user.id)
        db.add(state)

    # Keepsakes are unique: reject a second purchase.
    if item["kind"] == "keepsake":
        existing = await db.execute(select(Inventory).where(
            Inventory.user_id == current_user.id, Inventory.item_id == body.item_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Already owned.")

    price = item["price"]
    if float(state.earned or 0) < price:
        raise HTTPException(status_code=400, detail="Insufficient earned credits.")

    # ── Atomic: deduct → grant inventory → ledger row, one commit ──
    state.earned = round(float(state.earned or 0) - price, 2)
    # Phase 1: consumables apply their effect on buy (use-on-demand is Phase 2).
    if item["kind"] == "consumable" and item["effect"]["type"] == "invites":
        state.invites_left = (state.invites_left or 0) + item["effect"]["amount"]

    await grant_item(db, current_user.id, body.item_id)
    db.add(Transaction(user_id=current_user.id, type="shop_buy",
                       amount=-price, ref_id=body.item_id, meta={"qty": 1}))
    await db.commit()
    await db.refresh(state)

    inv = await inventory_list(db, current_user.id)

    await manager.send_to_user(current_user.id, {"type": "inventory_update", "inventory": inv})
    await manager.send_to_user(current_user.id, {
        "type": "state_update", "earned": float(state.earned), "invites_left": state.invites_left,
    })

    return ShopBuyResponse(
        ok=True, item_id=body.item_id,
        earned=float(state.earned), invites_left=state.invites_left, inventory=inv,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose exec -T backend pytest tests/test_shop_buy.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/shop.py backend/tests/test_shop_buy.py
git commit -m "feat(inventory): buy writes inventory row + shop_buy ledger (no flags)"
```

---

## Task 6: `GET /api/me` returns inventory + namespace lock on `PUT /api/state`

**Files:**
- Modify: `backend/app/routers/game.py` (`/api/me` and `/api/state`)
- Test: `backend/tests/test_state_namespace_lock.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_state_namespace_lock.py
from sqlalchemy import select
from app.models import GameState, Inventory
from tests.conftest import TestingSessionLocal, make_user, auth_headers


async def test_me_returns_inventory(client):
    uid = await make_user(earned=20.0)
    async with client as c:
        await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
        me = (await c.get("/api/me", headers=auth_headers(uid))).json()
    assert {"item_id": "scarab_amulet", "quantity": 1, "equipped": False} in me["inventory"]


async def test_state_strips_reserved_shop_owned_flags(client):
    uid = await make_user()
    async with client as c:
        res = await c.put("/api/state", json={"flags": {"shop_owned_secret_name": True, "nile_baby": "adopted"}},
                          headers=auth_headers(uid))
        me = (await c.get("/api/me", headers=auth_headers(uid))).json()
    assert res.status_code == 200
    assert "shop_owned_secret_name" not in me["flags"]   # reserved → stripped
    assert me["flags"]["nile_baby"] == "adopted"          # normal flag → kept
    async with TestingSessionLocal() as db:
        inv = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalars().all()
        assert inv == []                                   # no ownership granted
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec -T backend pytest tests/test_state_namespace_lock.py -v`
Expected: FAIL — `me["inventory"]` missing / `shop_owned_secret_name` present

- [ ] **Step 3: Update `/api/me`**

In `backend/app/routers/game.py`, add the import at the top:

```python
from app.inventory import inventory_list
```

In the `me` endpoint, build the inventory before the return and pass it:

```python
    inv = await inventory_list(db, current_user.id)
    return MeResponse(
        username=current_user.username,
        email=current_user.email,
        bought=state.bought,
        invested=state.invested,
        earned=state.earned,
        invites_left=state.invites_left,
        flags=state.flags or {},
        balance=current_user.balance,
        inventory=inv,
    )
```

- [ ] **Step 4: Add the namespace lock to `/api/state`**

In the same file, add the module-level constant after the imports:

```python
RESERVED_FLAG_PREFIXES = ("shop_owned_",)   # server-owned; never client-settable
```

Replace the flag-merge block in `save_state`:

```python
    # Only flags are client-settable — and reserved (server-owned) namespaces
    # are stripped so ownership can't be forged through this channel.
    if body.flags is not None:
        incoming = {k: v for k, v in body.flags.items()
                    if not k.startswith(RESERVED_FLAG_PREFIXES)}
        state.flags = {**(state.flags or {}), **incoming}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec -T backend pytest tests/test_state_namespace_lock.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Full backend suite (no regressions)**

Run: `docker compose exec -T backend pytest -q`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/game.py backend/tests/test_state_namespace_lock.py
git commit -m "feat(inventory): /api/me returns inventory; lock shop_owned_* in /api/state"
```

---

## Task 7: Frontend `Inventory` store

**Files:**
- Create: `frontend/game/inventory.js`
- Test: `frontend/worlds/nile/shop/__smoke__/inventory.smoke.mjs`

- [ ] **Step 1: Write the failing smoke test**

```js
// frontend/worlds/nile/shop/__smoke__/inventory.smoke.mjs
import { Inventory } from '../../../../game/inventory.js';

Inventory.hydrate([{ item_id: 'scarab_amulet', quantity: 1, equipped: false },
                   { item_id: 'invite_scroll', quantity: 3, equipped: false }]);
if (!Inventory.owned('scarab_amulet')) throw new Error('owned() wrong');
if (Inventory.qty('invite_scroll') !== 3) throw new Error('qty() wrong');
if (Inventory.owned('bronze_coin')) throw new Error('unowned should be false');
if (Inventory.isEquipped('scarab_amulet')) throw new Error('equipped should be false');

// guest local add: keepsake caps at 1, consumable stacks
Inventory.clear();
Inventory.addLocal('scarab_amulet', 'keepsake');
Inventory.addLocal('scarab_amulet', 'keepsake');
if (Inventory.qty('scarab_amulet') !== 1) throw new Error('keepsake must cap at 1');
Inventory.addLocal('invite_scroll', 'consumable');
Inventory.addLocal('invite_scroll', 'consumable');
if (Inventory.qty('invite_scroll') !== 2) throw new Error('consumable must stack');

console.log('inventory smoke OK');
```

- [ ] **Step 2: Run it (fails — module missing)**

Run: `cd frontend && node worlds/nile/shop/__smoke__/inventory.smoke.mjs`
Expected: FAIL — cannot find `game/inventory.js`

- [ ] **Step 3: Implement the store**

```js
// ── FILE: game/inventory.js ──────────────────────────────
// Client mirror of the server inventory. Hydrated from GET /api/me and
// WS inventory_update; read by buy.js, StallOverlay, and NPC hooks
// (replacing the old shop_owned_* flags). For guests it is the sole store.

import { Events } from '../engine/events.js';

export const Inventory = {
  _store: {},   // item_id → { quantity, equipped }

  /** Replace the whole store from a server list [{item_id, quantity, equipped}]. */
  hydrate(list) {
    this._store = {};
    for (const r of (list || [])) this._store[r.item_id] = { quantity: r.quantity, equipped: !!r.equipped };
    Events.emit('inventory:change', {});
  },

  owned(id)      { return (this._store[id]?.quantity || 0) >= 1; },
  qty(id)        { return this._store[id]?.quantity || 0; },
  isEquipped(id) { return !!this._store[id]?.equipped; },

  /** Snapshot as a server-shaped list. */
  all() {
    return Object.entries(this._store).map(([item_id, v]) =>
      ({ item_id, quantity: v.quantity, equipped: v.equipped }));
  },

  /** Guest-only local grant: keepsake caps at 1, consumable stacks. */
  addLocal(id, kind) {
    const cur = this._store[id];
    if (!cur) this._store[id] = { quantity: 1, equipped: false };
    else if (kind === 'consumable') cur.quantity += 1;
    Events.emit('inventory:change', {});
  },

  clear() { this._store = {}; Events.emit('inventory:change', {}); },
};
```

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `cd frontend && node worlds/nile/shop/__smoke__/inventory.smoke.mjs`
Expected: `inventory smoke OK`

- [ ] **Step 5: Commit**

```bash
git add frontend/game/inventory.js frontend/worlds/nile/shop/__smoke__/inventory.smoke.mjs
git commit -m "feat(inventory): client Inventory store"
```

---

## Task 8: Hydrate inventory in `session.js` (+ WS)

**Files:**
- Modify: `frontend/game/session.js` (import, hydrate in `_hydrateState`, WS handler)

No automated test (DOM/WS-coupled); verified in Task 12.

- [ ] **Step 1: Import the store**

Add to the imports in `frontend/game/session.js` (next to the `Flags` import):

```js
import { Inventory }            from './inventory.js';
```

- [ ] **Step 2: Hydrate from `/api/me`**

In `_hydrateState(me)`, after the flags hydration block, add:

```js
    if (Array.isArray(me.inventory)) Inventory.hydrate(me.inventory);
```

- [ ] **Step 3: Apply WS `inventory_update`**

In the WebSocket event wiring (`_wireWsEvents`, where other `evt.type` / state-sync events are handled), add a branch that hydrates on inventory pushes:

```js
      if (evt.type === 'inventory_update' && Array.isArray(evt.inventory)) {
        Inventory.hydrate(evt.inventory);
      }
```

> NOTE: read the existing handler to match its shape — the file already updates `G.earned`/`G.invitesLeft` from `state_update` events (see the lines that read `evt.earned` / `evt.invites_left`). Add the inventory branch alongside those, using the same `evt`/event-object variable name the surrounding code uses.

- [ ] **Step 4: Syntax check**

Run: `cd frontend && node --check game/session.js`
Expected: no output (valid)

- [ ] **Step 5: Commit**

```bash
git add frontend/game/session.js
git commit -m "feat(inventory): hydrate Inventory from /api/me and WS inventory_update"
```

---

## Task 9: Re-point `buy.js` to the `Inventory` store

**Files:**
- Modify: `frontend/worlds/nile/shop/buy.js` (read/write Inventory, apply server inventory)
- Modify: `frontend/worlds/nile/shop/buy-plan.js` (drop obsolete `ownedKey`)

- [ ] **Step 1: Drop `ownedKey` from `buy-plan.js`**

Remove the `ownedKey` export line from `frontend/worlds/nile/shop/buy-plan.js` (the flag key helper is obsolete — ownership is no longer a flag):

```js
// DELETE this line:
export const ownedKey = id => `shop_owned_${id}`;
```

`planPurchase` stays unchanged (it already takes `owned` keyed by `item_id`).

- [ ] **Step 2: Rewrite `buy.js`**

Replace `frontend/worlds/nile/shop/buy.js` with:

```js
// ── FILE: worlds/nile/shop/buy.js ────────────────────────
// Bazaar purchase flow. Pure planning (planPurchase) + side-effecting
// purchase() — server-authoritative for accounts, local for guests.
// Ownership lives in the Inventory store (not flags).

import { G }            from '../../../game/state.js';
import { Api }          from '../../../game/api.js';
import { getShop }      from '../../../game/config.js';
import { Inventory }    from '../../../game/inventory.js';
import { WARES_BY_ID }  from './catalogue.js';
import { planPurchase } from './buy-plan.js';
import { updateStats, updateSlots, log } from '../../../ui/panels.js';

// Re-export the pure decision so callers can import it from here.
export { planPurchase } from './buy-plan.js';

function _ownedMap() {
  const m = {};
  for (const id of Object.keys(getShop())) m[id] = Inventory.owned(id);
  return m;
}

const _BARK = {
  poor:    '✦ THE MERCHANT SMILES. "COME BACK WITH BELIEF. AND CREDITS."',
  owned:   '✦ "YOU ALREADY CARRY ONE. ONE IS THE CORRECT NUMBER."',
  unknown: '✦ The stall is empty where that was.',
  fail:    '✦ "THE PAPYRUS IS NOT READY. TRY AGAIN."',
};

export async function purchase(itemId) {
  const plan = planPurchase(itemId, {
    prices: getShop(), earned: G.earned, owned: _ownedMap(), isGuest: G.isGuest,
  });
  if (!plan.ok) { log(_BARK[plan.reason] || _BARK.fail, ''); return plan; }

  const meta = WARES_BY_ID[itemId];

  if (G.isGuest) {
    // Local-only, like guest recruits.
    G.earned = Math.round((G.earned - plan.cost) * 100) / 100;
    Inventory.addLocal(itemId, plan.kind);
    if (plan.kind === 'consumable') { G.invitesLeft += 1; updateSlots(); }  // Phase 1: effect on buy
    updateStats();
    log(`✦ The Merchant wraps the ${meta.name} in papyrus. It feels like belief.`, 'hi');
    return plan;
  }

  // Authenticated: server is authoritative; apply its response.
  const resp = await Api.buyItem(itemId);
  if (!resp || resp.error || resp.detail) { log(_BARK.fail, ''); return { ok: false, reason: 'fail' }; }
  G.earned      = resp.earned;
  G.invitesLeft = resp.invites_left;
  Inventory.hydrate(resp.inventory);
  updateStats(); updateSlots();
  log(`✦ The Merchant wraps the ${meta.name} in papyrus. It feels like belief.`, 'hi');
  return plan;
}

/** Owned-state helper for the overlay. */
export function isOwned(itemId) { return Inventory.owned(itemId); }
```

- [ ] **Step 3: Update the buy smoke test (owned shape unchanged, but confirm it still passes)**

The pure `planPurchase` and its smoke test are unchanged. Run:

Run: `cd frontend && node worlds/nile/shop/__smoke__/buy.smoke.mjs`
Expected: `buy smoke OK`

- [ ] **Step 4: Syntax-check the rewritten modules**

Run: `cd frontend && node --check worlds/nile/shop/buy.js && node --check worlds/nile/shop/buy-plan.js`
Expected: both valid (no output)

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/nile/shop/buy.js frontend/worlds/nile/shop/buy-plan.js
git commit -m "feat(inventory): buy.js reads/writes Inventory store (not flags)"
```

---

## Task 10: Re-point the NPC dialogue hooks to `Inventory`

**Files:**
- Modify: `frontend/worlds/nile/dialogue.js` (3 hooks + import)

- [ ] **Step 1: Import the store**

Add to the imports in `frontend/worlds/nile/dialogue.js` (next to the `Events` import). `dialogue.js` is at `worlds/nile/`, so the path to `game/inventory.js` is `../../game/`:

```js
import { Inventory } from '../../game/inventory.js';
```

- [ ] **Step 2: Replace the three flag reads**

Change each hook's condition from a flag read to an inventory read:

```js
// Ferryman (was: Flags.get('shop_owned_bronze_coin'))
        { label: '(Offer the Bronze Coin)', condition: () => Inventory.owned('bronze_coin'),
```

```js
// Sobek (was: Flags.get('shop_owned_croc_sandals'))
        { label: 'I wear the river\'s own skin', condition: () => Inventory.owned('croc_sandals'),
```

```js
// Joseph (was: Flags.get('shop_owned_secret_flood'))
        { label: 'I read the well too', condition: () => Inventory.owned('secret_flood'),
```

(Leave the rest of each choice — `action`, `next` — unchanged. `Flags` stays imported; it's still used for `nile_ferry_paid`, `nile_baby`, etc.)

- [ ] **Step 3: Syntax check + confirm the hooks reference Inventory**

Run: `cd frontend && node --check worlds/nile/dialogue.js`
Expected: valid (no output)

Run: `grep -n "Inventory.owned" worlds/nile/dialogue.js`
Expected: three matches (bronze_coin, croc_sandals, secret_flood)

- [ ] **Step 4: Commit**

```bash
git add frontend/worlds/nile/dialogue.js
git commit -m "feat(inventory): NPC hooks read Inventory.owned (not shop_owned_* flags)"
```

---

## Task 11: Rebuild + verify the frontend loads

**Files:** none (build + smoke).

- [ ] **Step 1: Rebuild the frontend image**

Run: `docker compose up -d --build frontend`
Expected: frontend container restarts.

- [ ] **Step 2: Confirm modules serve and the game loads**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173`
Expected: `200`

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/game/inventory.js`
Expected: `200`

- [ ] **Step 3: Commit (empty marker if nothing changed)**

No code change here; skip the commit.

---

## Task 12: End-to-end verification (live stack)

**Files:** none. Requires `docker compose up --build` and `docker compose exec backend alembic upgrade head` (Task 2).

- [ ] **Step 1: Automated live buy → inventory + ledger**

Create a user with `earned` via the backend session, then drive the live endpoint:

```bash
TOKEN=$(docker compose exec -T backend python -c "
import asyncio, uuid
from app.database import AsyncSessionLocal
from app.models import User, GameState
from app.auth import hash_password, create_access_token
async def main():
    uname='inv_'+uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        u=User(username=uname, password_hash=hash_password('password123')); db.add(u); await db.flush()
        db.add(GameState(user_id=u.id, bought=True, earned=100.0, invites_left=0, flags={}))
        await db.commit(); print(create_access_token(u.id, uname))
asyncio.run(main())" 2>&1 | tail -1)

# buy a keepsake → inventory row + ledger row
curl -s -X POST http://localhost:5173/api/shop/buy -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"item_id":"scarab_amulet"}'; echo
# /api/me reflects inventory
curl -s http://localhost:5173/api/me -H "Authorization: Bearer $TOKEN" -o /tmp/me.json
python3 -c "import json;d=json.load(open('/tmp/me.json'));print('inventory:',d['inventory'])"
```
Expected: buy returns `inventory: [{item_id: scarab_amulet, quantity:1, equipped:false}]`; `/api/me` shows the same.

- [ ] **Step 2: Namespace lock holds on the live stack**

```bash
curl -s -X PUT http://localhost:5173/api/state -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"flags":{"shop_owned_secret_name":true}}'; echo
curl -s http://localhost:5173/api/me -H "Authorization: Bearer $TOKEN" -o /tmp/me2.json
python3 -c "import json;d=json.load(open('/tmp/me2.json'));print('forged flag present:', 'shop_owned_secret_name' in d['flags'], '| inventory still:', [i['item_id'] for i in d['inventory']])"
```
Expected: `forged flag present: False` and inventory unchanged (no `secret_name`) — the lock works end-to-end.

- [ ] **Step 3: Verify the ledger row in the DB**

```bash
docker compose exec -T db psql -U pyramid -d pyramid_scheme -c \
  "select type, amount, ref_id from transactions where type='shop_buy' order by id desc limit 1;"
```
Expected: `shop_buy | -9.00 | scarab_amulet`.

- [ ] **Step 4: Manual in-browser (your eyes)**

Open `http://localhost:5173`, log in, dev panel (`` ` ``) → +$500 EARNED, walk to THE MERCHANT → "Step up to the table". Buy the Scarab → shows OWNED (now driven by `Inventory`, not flags). Buy the Bronze Coin, talk to the Ferryman → the "(Offer the Bronze Coin)" branch appears (hook reads `Inventory.owned`). Reload → OWNED persists (from `/api/me` inventory).

- [ ] **Step 5: Full backend suite once more**

Run: `docker compose exec -T backend pytest -q`
Expected: all pass.

---

## Self-review checklist (run before declaring done)

- [ ] Spec §1.1 inventory table → Tasks 1, 2. §1.2 ledger (`shop_buy`) → Task 5. §1.3 namespace lock → Task 6. §4 Inventory store → Task 7; hydrate → Task 8. §4 re-point buy/stall/hooks → Tasks 9, 10 (StallOverlay rides `isOwned`). §5 `/api/me` inventory → Task 6. §6 migration (clean, no backfill) → Task 2. §7 tests → each task.
- [ ] Phase-1 caveat honored: consumables still apply effect on buy (Task 5 Step 3, Task 9 Step 2).
- [ ] No `shop_owned_*` writes remain: `grep -rn "shop_owned_" frontend/ backend/app` → only the namespace-lock prefix in `game.py` and (harmlessly) none in frontend.
- [ ] Type consistency: buy response `inventory: [{item_id, quantity, equipped}]` matches `Inventory.hydrate` input and `MeResponse.inventory`.

## Out of scope (Phase 2 / Phase 3)

- `use` / `equip` endpoints, held-then-used consumables, equip-aware hooks (Phase 2).
- `sell` / `discard` / `gift` (Phase 3).
- In-game inventory UI panel (separate brainstorm).
