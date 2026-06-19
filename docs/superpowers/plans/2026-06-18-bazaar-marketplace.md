# Bazaar Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn THE MERCHANT in the Nile bazaar into a first-person stall overlay where the player spends real `earned` credits on a curated, mostly-satirical catalogue of wares — server-authoritative for accounts, local for guests.

**Architecture:** A canvas sub-mode (`StallOverlay`) owned by `NileRealm` (not a new realm). Ownership is a flag (`shop_owned_<id>`) in `GameState.flags`; consumables credit a counter. Prices live server-side in `app/shop.py` (single source of truth, served via `GET /api/config`). One endpoint `POST /api/shop/buy` deducts `earned` and records ownership atomically. The merchant's existing dialogue opens the stall via the `Events` bus.

**Tech Stack:** Backend — FastAPI, async SQLAlchemy, pytest (`backend/tests/`). Frontend — vanilla ES modules, canvas 2D, no bundler/npm (so: pure-function node smoke checks + manual in-browser verification).

**Spec:** `docs/superpowers/specs/2026-06-18-bazaar-marketplace-design.md`

---

## Reference: the canonical ware catalogue

Both `app/shop.py` (Task 1) and `frontend/worlds/nile/shop/catalogue.js` (Task 6) implement this list. The backend holds `name`/`price`/`kind`/`effect`; the frontend holds `name`/`tier`/`glyph`/`blurb` (no price). IDs MUST match exactly across both.

| id | name | price | kind | effect | tier | glyph |
|---|---|---|---|---|---|---|
| `invite_scroll` | Invite Scroll | 5 | consumable | invites +1 | scroll | 📜 |
| `protection_scroll` | Protection Scroll | 8 | keepsake | — | scroll | 🧧 |
| `scarab_amulet` | Scarab Amulet | 9 | keepsake | — | amulet | 🪲 |
| `blank_scroll` | Blank Scroll | 3 | keepsake | — | scroll | 📄 |
| `future_receipt` | A Receipt from the Future | 13 | keepsake | — | anachronism | 🧾 |
| `bronze_coin` | Bronze Coin | 6 | keepsake | — | relic | 🪙 |
| `croc_sandals` | Crocodile-leather Sandals | 12 | keepsake | — | clothing | 👡 |
| `secret_flood` | The Secret of the Flood | 25 | keepsake | — | secret | 🌊 |
| `secret_compounding` | The Secret of Compounding | 30 | keepsake | — | secret | ➰ |
| `secret_orgchart` | The Org Chart (Upper Portion Redacted) | 40 | keepsake | — | secret | 🗂️ |
| `secret_name` | The Secret Name of God | 50 | keepsake | — | secret | 𓂀 |
| `sky_iron` | A Sliver of Meteoric Iron | 44 | keepsake | — | relic | ☄️ |
| `paperwork_above` | The Paperwork From Above | 33 | keepsake | — | secret | 📋 |
| `tongue_stone` | The Tongue Stone | 28 | keepsake | — | relic | 🗿 |
| `seed_phrase` | A Founder's Seed Phrase | 50 | keepsake | — | anachronism | 🪡 |

Backend `kind` is the only behavioural axis: `consumable` (repeatable, applies `effect`) vs `keepsake` (one-time, sets owned flag). `tier`/`glyph`/`blurb` are frontend presentation only.

---

## Task 1: Backend ware catalogue (`app/shop.py`)

**Files:**
- Create: `backend/app/shop.py`
- Test: `backend/tests/test_shop_catalogue.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_shop_catalogue.py
from app.shop import SHOP_CATALOGUE, get_item, price_of, public_catalogue


def test_every_item_has_required_fields():
    for item_id, item in SHOP_CATALOGUE.items():
        assert item["name"], f"{item_id} missing name"
        assert isinstance(item["price"], (int, float)) and item["price"] > 0
        assert item["kind"] in ("consumable", "keepsake")
        if item["kind"] == "consumable":
            assert item["effect"]["type"] == "invites"
            assert item["effect"]["amount"] >= 1


def test_get_item_and_price_of():
    assert get_item("invite_scroll")["kind"] == "consumable"
    assert price_of("invite_scroll") == 5
    assert get_item("does_not_exist") is None
    assert price_of("does_not_exist") is None


def test_public_catalogue_exposes_id_name_price_kind_only():
    pub = public_catalogue()
    assert pub["scarab_amulet"] == {"name": "Scarab Amulet", "price": 9, "kind": "keepsake"}
    # effect is internal — never leaked to clients
    assert "effect" not in pub["invite_scroll"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec backend pytest tests/test_shop_catalogue.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.shop'`

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/shop.py
"""
Server-side shop catalogue.
SHOP_CATALOGUE is the single source of truth for ware prices and behaviour,
mirroring app/payout.py. Frontend reads prices via GET /api/config; it never
hardcodes them. `effect` is internal and never exposed to clients.
"""
from __future__ import annotations

SHOP_CATALOGUE: dict = {
    "invite_scroll":      {"name": "Invite Scroll",                        "price": 5,  "kind": "consumable", "effect": {"type": "invites", "amount": 1}},
    "protection_scroll":  {"name": "Protection Scroll",                    "price": 8,  "kind": "keepsake"},
    "scarab_amulet":      {"name": "Scarab Amulet",                        "price": 9,  "kind": "keepsake"},
    "blank_scroll":       {"name": "Blank Scroll",                         "price": 3,  "kind": "keepsake"},
    "future_receipt":     {"name": "A Receipt from the Future",           "price": 13, "kind": "keepsake"},
    "bronze_coin":        {"name": "Bronze Coin",                          "price": 6,  "kind": "keepsake"},
    "croc_sandals":       {"name": "Crocodile-leather Sandals",            "price": 12, "kind": "keepsake"},
    "secret_flood":       {"name": "The Secret of the Flood",             "price": 25, "kind": "keepsake"},
    "secret_compounding": {"name": "The Secret of Compounding",           "price": 30, "kind": "keepsake"},
    "secret_orgchart":    {"name": "The Org Chart (Upper Portion Redacted)", "price": 40, "kind": "keepsake"},
    "secret_name":        {"name": "The Secret Name of God",              "price": 50, "kind": "keepsake"},
    "sky_iron":           {"name": "A Sliver of Meteoric Iron",           "price": 44, "kind": "keepsake"},
    "paperwork_above":    {"name": "The Paperwork From Above",            "price": 33, "kind": "keepsake"},
    "tongue_stone":       {"name": "The Tongue Stone",                    "price": 28, "kind": "keepsake"},
    "seed_phrase":        {"name": "A Founder's Seed Phrase",             "price": 50, "kind": "keepsake"},
}


def get_item(item_id: str) -> dict | None:
    return SHOP_CATALOGUE.get(item_id)


def price_of(item_id: str) -> float | None:
    item = SHOP_CATALOGUE.get(item_id)
    return item["price"] if item else None


def public_catalogue() -> dict:
    """Client-safe view: id → {name, price, kind}. Never leaks `effect`."""
    return {
        iid: {"name": i["name"], "price": i["price"], "kind": i["kind"]}
        for iid, i in SHOP_CATALOGUE.items()
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec backend pytest tests/test_shop_catalogue.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/shop.py backend/tests/test_shop_catalogue.py
git commit -m "feat(shop): server-side ware catalogue (single source of truth)"
```

---

## Task 2: Shared test harness + expose prices via `GET /api/config`

**Files:**
- Create: `backend/tests/conftest.py` (shared fixtures — used by Tasks 2 & 4)
- Modify: `backend/app/routers/game.py:70-73` (the `get_config` endpoint)
- Test: `backend/tests/test_shop_config.py`

- [ ] **Step 1: Create the shared test harness**

`backend/tests/test_auth.py` defines its own engine/fixtures inline. New shop tests use a shared `conftest.py` instead (pytest auto-injects conftest fixtures by name — no imports, no cross-module fixture sharing). `test_auth` keeps its module-local fixtures, which override conftest's for that file, so it is unaffected.

```python
# backend/tests/conftest.py
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db
from app.models import Base, User, GameState
from app.auth import hash_password, create_access_token

DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    app.dependency_overrides[get_db] = override_get_db
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    app.dependency_overrides.clear()


async def make_user(username="buyer", earned=100.0, invites=0, flags=None):
    """Insert a bought-in user + GameState; return the user id."""
    async with TestingSessionLocal() as db:
        u = User(username=username, password_hash=hash_password("password123"))
        db.add(u)
        await db.flush()
        db.add(GameState(user_id=u.id, bought=True, earned=earned,
                         invites_left=invites, flags=flags or {}))
        await db.commit()
        return u.id


def auth_headers(uid, username="buyer"):
    return {"Authorization": f"Bearer {create_access_token(uid, username)}"}
```

- [ ] **Step 2: Write the failing test** (uses the conftest `client` fixture)

```python
# backend/tests/test_shop_config.py
async def test_config_includes_shop_prices(client):
    async with client as c:
        res = await c.get("/api/config")
    assert res.status_code == 200
    body = res.json()
    assert "payout" in body
    assert body["shop"]["invite_scroll"] == {"name": "Invite Scroll", "price": 5, "kind": "consumable"}
    assert "effect" not in body["shop"]["invite_scroll"]
```

- [ ] **Step 3: Run test to verify it fails**

Run: `docker compose exec backend pytest tests/test_shop_config.py -v`
Expected: FAIL — `KeyError: 'shop'`

- [ ] **Step 4: Write minimal implementation**

Replace the body of `get_config` in `backend/app/routers/game.py`:

```python
@router.get("/config")
async def get_config():
    from app.payout import PAYOUT_CONFIG
    from app.shop import public_catalogue
    return {"payout": PAYOUT_CONFIG, "shop": public_catalogue()}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `docker compose exec backend pytest tests/test_shop_config.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/tests/conftest.py backend/app/routers/game.py backend/tests/test_shop_config.py
git commit -m "feat(shop): serve ware prices via GET /api/config (+ shared test harness)"
```

---

## Task 3: Buy endpoint schemas

**Files:**
- Modify: `backend/app/schemas.py` (append at end)

- [ ] **Step 1: Add the schemas** (no separate test — exercised by Task 4)

Append to `backend/app/schemas.py`:

```python
# ── Shop ──────────────────────────────────────────────────

class ShopBuyRequest(BaseModel):
    item_id: str = Field(..., min_length=1, max_length=64)


class ShopBuyResponse(BaseModel):
    ok:           bool
    item_id:      str
    earned:       float
    invites_left: int
    owned:        list[str]
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat(shop): request/response schemas for buy endpoint"
```

---

## Task 4: Buy endpoint (`POST /api/shop/buy`)

**Files:**
- Create: `backend/app/routers/shop.py`
- Modify: `backend/app/main.py:7` (import) and `:40` (register router)
- Test: `backend/tests/test_shop_buy.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_shop_buy.py
from sqlalchemy import select
from app.models import GameState
from tests.conftest import TestingSessionLocal, make_user, auth_headers


async def test_buy_keepsake_deducts_and_owns(client):
    uid = await make_user(earned=20.0)
    async with client as c:
        res = await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
    assert res.status_code == 200
    body = res.json()
    assert body["earned"] == 11.0          # 20 - 9
    assert "scarab_amulet" in body["owned"]
    async with TestingSessionLocal() as db:
        st = (await db.execute(select(GameState).where(GameState.user_id == uid))).scalar_one()
        assert float(st.earned) == 11.0
        assert st.flags.get("shop_owned_scarab_amulet") is True


async def test_buy_keepsake_twice_returns_409(client):
    uid = await make_user(earned=50.0, flags={"shop_owned_scarab_amulet": True})
    async with client as c:
        res = await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
    assert res.status_code == 409
    async with TestingSessionLocal() as db:
        st = (await db.execute(select(GameState).where(GameState.user_id == uid))).scalar_one()
        assert float(st.earned) == 50.0   # unchanged


async def test_buy_consumable_is_repeatable_and_adds_invites(client):
    uid = await make_user(earned=20.0, invites=0)
    async with client as c:
        r1 = await c.post("/api/shop/buy", json={"item_id": "invite_scroll"}, headers=auth_headers(uid))
        r2 = await c.post("/api/shop/buy", json={"item_id": "invite_scroll"}, headers=auth_headers(uid))
    assert r1.status_code == 200 and r2.status_code == 200
    assert r2.json()["earned"] == 10.0        # 20 - 5 - 5
    assert r2.json()["invites_left"] == 2


async def test_buy_insufficient_funds_returns_400_no_change(client):
    uid = await make_user(earned=2.0)
    async with client as c:
        res = await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
    assert res.status_code == 400
    async with TestingSessionLocal() as db:
        st = (await db.execute(select(GameState).where(GameState.user_id == uid))).scalar_one()
        assert float(st.earned) == 2.0
        assert not st.flags.get("shop_owned_scarab_amulet")


async def test_buy_unknown_item_returns_404(client):
    uid = await make_user(earned=50.0)
    async with client as c:
        res = await c.post("/api/shop/buy", json={"item_id": "nope"}, headers=auth_headers(uid))
    assert res.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec backend pytest tests/test_shop_buy.py -v`
Expected: FAIL — 404 from the not-yet-registered route (all tests error)

- [ ] **Step 3: Write the router**

```python
# backend/app/routers/shop.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState
from app.schemas import ShopBuyRequest, ShopBuyResponse
from app.auth import get_current_user
from app.shop import get_item
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

    owned_key = f"shop_owned_{body.item_id}"
    flags     = dict(state.flags or {})

    if item["kind"] == "keepsake" and flags.get(owned_key):
        raise HTTPException(status_code=409, detail="Already owned.")

    price = item["price"]
    if float(state.earned or 0) < price:
        raise HTTPException(status_code=400, detail="Insufficient earned credits.")

    # ── Atomic: deduct, then apply ownership/effect, one commit ──
    state.earned = round(float(state.earned or 0) - price, 2)
    if item["kind"] == "consumable":
        if item["effect"]["type"] == "invites":
            state.invites_left = (state.invites_left or 0) + item["effect"]["amount"]
    else:
        flags[owned_key] = True
        state.flags = flags

    await db.commit()
    await db.refresh(state)

    owned = [k[len("shop_owned_"):] for k, v in (state.flags or {}).items()
             if k.startswith("shop_owned_") and v]

    # Reconcile other tabs.
    await manager.send_to_user(current_user.id, {
        "type":         "state_update",
        "earned":       float(state.earned),
        "invites_left": state.invites_left,
    })

    return ShopBuyResponse(
        ok=True, item_id=body.item_id,
        earned=float(state.earned), invites_left=state.invites_left, owned=owned,
    )
```

> NOTE: reassigning `state.flags = flags` (a new dict) is required — SQLAlchemy's JSON column does not track in-place mutation of the existing dict.

- [ ] **Step 4: Register the router in `main.py`**

In `backend/app/main.py`, change the import line (currently line 7):

```python
from app.routers import auth, game, payments, shop
```

And add after the profile router registration (after line 40):

```python
app.include_router(shop.router,           prefix="/api",      tags=["shop"])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `docker compose exec backend pytest tests/test_shop_buy.py -v`
Expected: PASS (5 passed)

- [ ] **Step 6: Run the whole backend suite (no regressions)**

Run: `docker compose exec backend pytest -q`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/shop.py backend/app/main.py backend/tests/test_shop_buy.py
git commit -m "feat(shop): POST /api/shop/buy — atomic spend + ownership"
```

---

## Task 5: Frontend config + Api wiring

**Files:**
- Modify: `frontend/game/config.js` (add shop store + `getShop`, extend `loadConfig`)
- Modify: `frontend/game/api.js` (add `buyItem` helper)
- Test: `frontend/worlds/nile/shop/__smoke__/config.smoke.mjs` (node, pure)

- [ ] **Step 1: Extend `config.js`**

Add a module-level store and accessor, and read `data.shop` in `loadConfig`. After the existing `_cfg` block (around line 16) add:

```js
let _shop = {};   // id → { name, price, kind } — from GET /api/config
```

Inside `loadConfig`, after the existing `if (data && data.payout ...)` block, add:

```js
  if (data && data.shop && !data.error) _shop = data.shop;
```

At the end of the file add:

```js
/** Read-only snapshot of the shop catalogue prices (id → {name, price, kind}). */
export function getShop() { return { ..._shop }; }

/** True once shop prices have been loaded from the server. */
export function shopLoaded() { return Object.keys(_shop).length > 0; }
```

- [ ] **Step 2: Add `buyItem` to `api.js`**

In the `Api` object's "Game-specific helpers" section, add:

```js
  /** Purchase a ware from the bazaar. Returns { ok, earned, invites_left, owned } or { error/detail }. */
  buyItem(itemId) { return Api.post('/api/shop/buy', { item_id: itemId }); },
```

- [ ] **Step 3: Write a node smoke check for the pure config logic**

```js
// frontend/worlds/nile/shop/__smoke__/config.smoke.mjs
// Pure check: getShop reflects what loadConfig stored. Stubs the Api.
import { loadConfig, getShop, shopLoaded } from '../../../../game/config.js';

const fakeApi = { get: async () => ({
  payout: { entry_fee: 10 },
  shop: { invite_scroll: { name: "Invite Scroll", price: 5, kind: "consumable" } },
}) };

await loadConfig(fakeApi);
if (!shopLoaded()) throw new Error("shopLoaded() should be true after loadConfig");
const s = getShop();
if (s.invite_scroll.price !== 5) throw new Error("price not stored");
console.log("config smoke OK");
```

- [ ] **Step 4: Run the smoke check**

Run: `cd frontend && node worlds/nile/shop/__smoke__/config.smoke.mjs`
Expected: `config smoke OK` (config.js imports nothing DOM-bound, so node runs it)

- [ ] **Step 5: Commit**

```bash
git add frontend/game/config.js frontend/game/api.js frontend/worlds/nile/shop/__smoke__/config.smoke.mjs
git commit -m "feat(shop): frontend config store for ware prices + Api.buyItem"
```

---

## Task 6: Presentation catalogue (`catalogue.js`)

**Files:**
- Create: `frontend/worlds/nile/shop/catalogue.js`
- Test: `frontend/worlds/nile/shop/__smoke__/catalogue.smoke.mjs`

- [ ] **Step 1: Write the catalogue (presentation only — no prices)**

```js
// ── FILE: worlds/nile/shop/catalogue.js ──────────────────
// Presentation data for the bazaar stall. IDs MUST match backend
// app/shop.py exactly. Prices are NOT here — they come from the server
// via game/config.js getShop(). Utility (if any) is a flag read elsewhere.

export const WARES = [
  { id: 'invite_scroll',      name: 'Invite Scroll',                 tier: 'SCROLLS',     glyph: '📜',
    blurb: 'ONE MORE SCROLL. ONE MORE BELIEVER.\nTHE CHAIN GROWS BY ONE EITHER WAY.' },
  { id: 'protection_scroll',  name: 'Protection Scroll',             tier: 'SCROLLS',     glyph: '🧧',
    blurb: 'IT ABSORBS THE SPIRITUAL SHORTFALL.\nYOURS, OR SOMEONE BELOW YOU. UNSPECIFIED.' },
  { id: 'blank_scroll',       name: 'Blank Scroll',                  tier: 'SCROLLS',     glyph: '📄',
    blurb: 'THE BLANK SPACE IS CALLED POTENTIAL.\nPOTENTIAL IS THE PREMIUM PRODUCT.' },
  { id: 'scarab_amulet',      name: 'Scarab Amulet',                 tier: 'AMULETS',     glyph: '🪲',
    blurb: 'HAND-PRESSED FROM NILE CLAY.\nIMPACT IS ATMOSPHERIC. NOT QUANTIFIABLE.' },
  { id: 'bronze_coin',        name: 'Bronze Coin',                   tier: 'RELICS',      glyph: '🪙',
    blurb: 'EGYPTIAN STANDARD WEIGHT.\nA CROSSING SOMEWHERE WILL ASK FOR EXACTLY ONE.' },
  { id: 'croc_sandals',       name: 'Crocodile-leather Sandals',     tier: 'REGALIA',     glyph: '👡',
    blurb: 'THE RIVER RECOGNISES ITS OWN.\nIT IS LESS HUNGRY FOR THOSE WHO WEAR IT.' },
  { id: 'secret_flood',       name: 'The Secret of the Flood',       tier: 'SECRETS',     glyph: '🌊',
    blurb: 'YOU WILL KNOW BEFORE THE OTHERS KNOW.\nTHEY WERE NOT AT THE WELL.' },
  { id: 'secret_compounding', name: 'The Secret of Compounding',     tier: 'SECRETS',     glyph: '➰',
    blurb: 'THE MATH BENEATH THE MATH.\nIT DOES NOT STOP. THAT IS THE SECRET.' },
  { id: 'secret_orgchart',    name: 'The Org Chart',                 tier: 'SECRETS',     glyph: '🗂️',
    blurb: 'THERE IS MORE ABOVE YOU THAN YOU WERE TOLD.\nTHE TOP IS NOT YOU. THE TOP IS NOT SHOWN.' },
  { id: 'secret_name',        name: 'The Secret Name of God',        tier: 'SECRETS',     glyph: '𓂀',
    blurb: 'SPOKEN ONCE, CORRECTLY, IT IS ANSWERED.\nWE DO NOT REHEARSE IT HERE.' },
  { id: 'paperwork_above',    name: 'The Paperwork From Above',      tier: 'SECRETS',     glyph: '📋',
    blurb: 'YOU WERE ENROLLED BEFORE YOU ARRIVED.\nTHIS IS YOUR COPY. THE OTHER IS NOT KEPT HERE.' },
  { id: 'tongue_stone',       name: 'The Tongue Stone',              tier: 'RELICS',      glyph: '🗿',
    blurb: 'AFTERWARD YOU UNDERSTAND THINGS\nNOT SAID TO YOU. WE DO NOT DISCUSS BY WHOM.' },
  { id: 'sky_iron',           name: 'A Sliver of Meteoric Iron',     tier: 'RELICS',      glyph: '☄️',
    blurb: 'A RELIC OF THE SKY GODS.\nIT CAME DOWN. IT DID NOT COME FROM HERE.' },
  { id: 'future_receipt',     name: 'A Receipt from the Future',     tier: 'CURIOS',      glyph: '🧾',
    blurb: 'PROOF YOU WILL HAVE PAID.\nKEEP IT. IT WILL NOT SURVIVE THE CROSSING.' },
  { id: 'seed_phrase',        name: "A Founder's Seed Phrase",       tier: 'CURIOS',      glyph: '🪡',
    blurb: 'TWELVE WORDS ON LINEN.\nTHE ORIGINAL COLD STORAGE. DO NOT LOSE THE LINEN.' },
];

export const WARES_BY_ID = Object.fromEntries(WARES.map(w => [w.id, w]));
```

- [ ] **Step 2: Write a node smoke check (ID parity + shape)**

```js
// frontend/worlds/nile/shop/__smoke__/catalogue.smoke.mjs
import { WARES, WARES_BY_ID } from '../catalogue.js';

const ids = WARES.map(w => w.id);
if (new Set(ids).size !== ids.length) throw new Error("duplicate ware ids");
for (const w of WARES) {
  if (!w.name || !w.glyph || !w.blurb || !w.tier) throw new Error(`incomplete ware ${w.id}`);
  if ('price' in w) throw new Error(`ware ${w.id} must not hardcode a price`);
}
if (WARES_BY_ID.invite_scroll.tier !== 'SCROLLS') throw new Error("index broken");
console.log(`catalogue smoke OK (${WARES.length} wares)`);
```

- [ ] **Step 3: Run it**

Run: `cd frontend && node worlds/nile/shop/__smoke__/catalogue.smoke.mjs`
Expected: `catalogue smoke OK (15 wares)`

- [ ] **Step 4: Verify ID parity with the backend**

Run: `cd frontend && node -e "import('./worlds/nile/shop/catalogue.js').then(m=>console.log(m.WARES.map(w=>w.id).sort().join('\n')))"`
Then compare against `docker compose exec backend python -c "from app.shop import SHOP_CATALOGUE as c; print('\n'.join(sorted(c)))"`
Expected: identical id lists.

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/nile/shop/catalogue.js frontend/worlds/nile/shop/__smoke__/catalogue.smoke.mjs
git commit -m "feat(shop): frontend presentation catalogue (15 wares)"
```

---

## Task 7: Purchase logic (`buy.js`)

**Files:**
- Create: `frontend/worlds/nile/shop/buy.js`
- Test: `frontend/worlds/nile/shop/__smoke__/buy.smoke.mjs`

The decision of *what a buy should do* is factored into a pure function `planPurchase` (node-testable). The side-effecting `purchase` wraps it.

- [ ] **Step 1: Write the failing smoke test for `planPurchase`**

```js
// frontend/worlds/nile/shop/__smoke__/buy.smoke.mjs
import { planPurchase } from '../buy.js';

const price = { invite_scroll: 5, scarab_amulet: 9 };
const C = (over) => ({ prices: price, earned: 20, owned: {}, isGuest: false, ...over });

// affordable keepsake
let p = planPurchase('scarab_amulet', C());
if (!p.ok || p.cost !== 9) throw new Error("keepsake plan wrong");

// can't afford
p = planPurchase('scarab_amulet', C({ earned: 2 }));
if (p.ok || p.reason !== 'poor') throw new Error("should be unaffordable");

// already owned keepsake
p = planPurchase('scarab_amulet', C({ owned: { scarab_amulet: true } }));
if (p.ok || p.reason !== 'owned') throw new Error("should reject owned");

// consumable is always re-buyable when affordable
p = planPurchase('invite_scroll', C({ owned: { invite_scroll: true } }));
if (!p.ok || p.kind !== 'consumable') throw new Error("consumable must be re-buyable");

// unknown item
p = planPurchase('nope', C());
if (p.ok || p.reason !== 'unknown') throw new Error("unknown should fail");

console.log("buy smoke OK");
```

- [ ] **Step 2: Run it (fails — module missing)**

Run: `cd frontend && node worlds/nile/shop/__smoke__/buy.smoke.mjs`
Expected: FAIL — cannot find `../buy.js`

- [ ] **Step 3: Implement `buy.js`**

```js
// ── FILE: worlds/nile/shop/buy.js ────────────────────────
// Bazaar purchase flow. Pure planning (planPurchase) + side-effecting
// purchase() that hits the server for accounts and stays local for guests.

import { G }            from '../../../game/state.js';
import { Flags }        from '../../../engine/flags.js';
import { Api }          from '../../../game/api.js';
import { getShop }      from '../../../game/config.js';
import { WARES_BY_ID }  from './catalogue.js';
import { updateStats, updateSlots, log } from '../../../ui/panels.js';

const ownedKey = id => `shop_owned_${id}`;

/**
 * Pure decision: can this buy proceed, and what does it cost/do?
 * @returns {{ok:boolean, reason?:string, cost?:number, kind?:string}}
 *   reason ∈ 'unknown' | 'poor' | 'owned'
 */
export function planPurchase(itemId, { prices, earned, owned, isGuest }) {
  const meta = WARES_BY_ID[itemId];
  const priced = prices[itemId];
  if (!meta || !priced) return { ok: false, reason: 'unknown' };
  const kind = priced.kind;                 // 'consumable' | 'keepsake'
  if (kind === 'keepsake' && owned[itemId]) return { ok: false, reason: 'owned' };
  if (earned < priced.price)               return { ok: false, reason: 'poor', cost: priced.price };
  return { ok: true, cost: priced.price, kind };
}

function _ownedMap() {
  const shop = getShop();
  const m = {};
  for (const id of Object.keys(shop)) m[id] = Flags.get(ownedKey(id), false);
  return m;
}

const _BARK = {
  poor:    '✦ THE MERCHANT SMILES. "COME BACK WITH BELIEF. AND CREDITS."',
  owned:   '✦ "YOU ALREADY CARRY ONE. ONE IS THE CORRECT NUMBER."',
  unknown: '✦ The stall is empty where that was.',
  fail:    '✦ "THE PAPYRUS IS NOT READY. TRY AGAIN."',
};

/**
 * Attempt to buy `itemId`. Returns the plan result. On success, mutates G,
 * Flags, and refreshes the HUD; the StallOverlay re-reads state on its next render.
 */
export async function purchase(itemId) {
  const prices = getShop();
  const plan = planPurchase(itemId, {
    prices, earned: G.earned, owned: _ownedMap(), isGuest: G.isGuest,
  });
  if (!plan.ok) { log(_BARK[plan.reason] || _BARK.fail, ''); return plan; }

  const meta = WARES_BY_ID[itemId];

  if (G.isGuest) {
    // Local-only, exactly like guest recruits.
    G.earned = Math.round((G.earned - plan.cost) * 100) / 100;
    if (plan.kind === 'consumable') { G.invitesLeft += 1; updateSlots(); }
    else                            { Flags.set(ownedKey(itemId), true); }
    updateStats();
    log(`✦ The Merchant wraps the ${meta.name} in papyrus. It feels like belief.`, 'hi');
    return plan;
  }

  // Authenticated: server is authoritative. No optimistic deduction.
  const resp = await Api.buyItem(itemId);
  if (!resp || resp.error || resp.detail) { log(_BARK.fail, ''); return { ok: false, reason: 'fail' }; }
  G.earned      = resp.earned;
  G.invitesLeft = resp.invites_left;
  if (plan.kind !== 'consumable') Flags.set(ownedKey(itemId), true);
  updateStats(); updateSlots();
  log(`✦ The Merchant wraps the ${meta.name} in papyrus. It feels like belief.`, 'hi');
  return plan;
}

/** Owned-state helper for the overlay. */
export function isOwned(itemId) { return Flags.get(ownedKey(itemId), false); }
```

- [ ] **Step 4: Run the smoke test to verify it passes**

Run: `cd frontend && node worlds/nile/shop/__smoke__/buy.smoke.mjs`
Expected: `buy smoke OK`

> NOTE: the smoke test imports only `planPurchase`, but node also parses `buy.js`'s top-level imports. This chain was verified node-safe: `buy.js` → `state.js` / `flags.js` / `events.js` / `api.js` / `config.js` / `catalogue.js` / `panels.js`, and `panels.js` → `state.js` / `colors.js` / `draw/utils.js` / `tiers.js` — none of which import `engine/canvas.js` (the only module that touches `document` at load), and `api.js` is `window`-guarded. So the import resolves under node. (Contingency, should that ever change: move `planPurchase` + `WARES_BY_ID` into a tiny `buy-plan.js` with no side-effecting imports and re-point both `buy.js` and the smoke test at it.)

- [ ] **Step 5: Commit**

```bash
git add frontend/worlds/nile/shop/buy.js frontend/worlds/nile/shop/__smoke__/buy.smoke.mjs
git commit -m "feat(shop): purchase flow (pure planPurchase + guest/account paths)"
```

---

## Tasks 8–9 execution notes (read first)

**Render order is already verified.** `main.js`'s loop is `update → render() → renderTransition()`, wrapped in a `G.shake` translate + `clearRect`. The HUD, stats, log, and dialogue box are **HTML DOM elements** (updated via `panels.js` / `DialogueManager` writing to `#dlg`), **not** canvas draws — so the stall, painted on the canvas inside `NileRealm.render()`, is the topmost *canvas* content. No later draw hook is needed. (The HTML side-panels remain visible beside the canvas, which is fine; the `#dlg` box is inactive while shopping because the opening choice closed the dialogue with `next: null`.)

**Recommended sequencing — skeleton before art.** To surface any wiring/order bugs while they're cheap, implement Task 9 (NileRealm + dialogue wiring) against a *stub* `render()` first — e.g. dim the screen and draw the word `STALL` — confirm in-browser that the stall opens from the merchant, swallows keys, freezes movement, and closes on Esc. *Then* replace the stub with Task 8's full render. (This reverses the written task order; do Task 9's wiring against a stub, validate, then Task 8.)

## Task 8: The first-person stall overlay (`StallOverlay.js`)

**Files:**
- Create: `frontend/worlds/nile/shop/StallOverlay.js`

No automated test (pure canvas rendering + input). Verified manually in Task 10.

- [ ] **Step 1: Implement the overlay**

```js
// ── FILE: worlds/nile/shop/StallOverlay.js ───────────────
// First-person stall: a canvas sub-mode owned by NileRealm. Not a realm.
// Draws the merchant's table from the player's POV; spends `earned`.

import { X, CW, CH }        from '../../../engine/canvas.js';
import { G }                from '../../../game/state.js';
import { Api }              from '../../../game/api.js';
import { loadConfig, getShop, shopLoaded } from '../../../game/config.js';
import { WARES }            from './catalogue.js';
import { purchase, isOwned } from './buy.js';

const COLS = 5;
const CARD_W = 132, CARD_H = 96, GAP = 10;
const GRID_X = (CW - (COLS * CARD_W + (COLS - 1) * GAP)) / 2;
const GRID_Y = 190;

export class StallOverlay {
  constructor() {
    this._open = false;
    this._sel  = 0;
    this._loading = false;
  }

  isOpen() { return this._open; }

  async open() {
    this._open = true;
    this._sel  = 0;
    G.shake = 0;                    // steady frame — the loop applies G.shake around render()
    if (!shopLoaded()) {            // guests skip GameSession → no prices yet
      this._loading = true;
      try { await loadConfig(Api); } catch { /* leave _loading; render shows a notice */ }
      this._loading = false;
    }
  }

  close() { this._open = false; }

  onKeyDown(key) {
    if (!this._open) return false;
    if (key === 'Escape' || key === 'q' || key === 'Q') { this.close(); return true; }
    const n = WARES.length;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') { this._sel = (this._sel + 1) % n; return true; }
    if (key === 'ArrowLeft'  || key === 'a' || key === 'A') { this._sel = (this._sel - 1 + n) % n; return true; }
    if (key === 'ArrowDown'  || key === 's' || key === 'S') { this._sel = Math.min(n - 1, this._sel + COLS); return true; }
    if (key === 'ArrowUp'    || key === 'w' || key === 'W') { this._sel = Math.max(0, this._sel - COLS); return true; }
    if (key === ' ' || key === 'Enter' || key === 'z' || key === 'Z') {
      const ware = WARES[this._sel];
      if (ware) purchase(ware.id);   // fire-and-forget; render re-reads state
      return true;
    }
    return true;   // swallow all keys while open
  }

  render() {
    if (!this._open) return;
    const shop = getShop();

    // ── Backdrop: darken the frozen Nile scene ──
    X.fillStyle = 'rgba(12,9,6,0.92)';
    X.fillRect(0, 0, CW, CH);

    // ── First-person framing: tent eave + merchant bust + table edge ──
    X.fillStyle = '#3a2c18'; X.fillRect(0, 0, CW, 150);                 // tent interior
    X.fillStyle = '#6b4a2a'; X.beginPath();                            // tent eave arc
    X.moveTo(CW / 2 - 130, 96); X.quadraticCurveTo(CW / 2, 18, CW / 2 + 130, 96); X.fill();
    // merchant bust
    X.fillStyle = '#caa05a'; X.fillRect(CW / 2 - 16, 70, 32, 44);       // robe
    X.fillStyle = '#e8c28a'; X.beginPath(); X.arc(CW / 2, 62, 14, 0, Math.PI * 2); X.fill();  // head
    // table edge across the foreground
    X.fillStyle = '#7a5a32'; X.fillRect(0, CH - 70, CW, 70);
    X.fillStyle = '#a07a44'; X.fillRect(0, CH - 74, CW, 5);

    // ── Header + balance ──
    X.textAlign = 'center'; X.fillStyle = '#e6c179'; X.font = 'bold 18px monospace';
    X.fillText('✦ BAZAAR OF BELIEVERS ✦', CW / 2, 34);
    X.textAlign = 'right'; X.fillStyle = '#9fd98a'; X.font = '14px monospace';
    X.fillText(`BALANCE  $${(G.earned || 0).toFixed(2)}`, CW - 16, 34);

    if (this._loading) {
      X.textAlign = 'center'; X.fillStyle = '#cbb288'; X.font = '14px monospace';
      X.fillText('the merchant unrolls his catalogue…', CW / 2, GRID_Y + 60);
      return;
    }

    // ── Ware grid ──
    WARES.forEach((w, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const x = GRID_X + col * (CARD_W + GAP);
      const y = GRID_Y + row * (CARD_H + GAP);
      const priced = shop[w.id];
      const owned  = isOwned(w.id) && priced?.kind === 'keepsake';
      const afford = priced && (G.earned || 0) >= priced.price;
      const isSel  = i === this._sel;

      X.fillStyle = owned ? '#1a2414' : '#241c12';
      X.fillRect(x, y, CARD_W, CARD_H);
      X.lineWidth = isSel ? 3 : 1;
      X.strokeStyle = isSel ? '#f0d9a8' : '#4a3a22';
      X.strokeRect(x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1);

      X.textAlign = 'center'; X.font = '26px monospace'; X.fillStyle = '#fff';
      X.fillText(w.glyph, x + CARD_W / 2, y + 36);
      X.font = '10px monospace'; X.fillStyle = '#cbb288';
      X.fillText(w.name.slice(0, 20), x + CARD_W / 2, y + 58);

      if (owned)           { X.fillStyle = '#9fd98a'; X.fillText('OWNED',        x + CARD_W / 2, y + 80); }
      else if (priced)     { X.fillStyle = afford ? '#caa05a' : '#a05a4a';
                             X.fillText(`$${priced.price}`,                     x + CARD_W / 2, y + 80); }
    });

    // ── Detail line for the selected ware ──
    const w = WARES[this._sel];
    const priced = shop[w?.id];
    if (w && priced) {
      X.textAlign = 'center'; X.fillStyle = '#e6c179'; X.font = 'bold 13px monospace';
      X.fillText(`${w.name}  —  $${priced.price}`, CW / 2, CH - 46);
      X.fillStyle = '#cbb288'; X.font = '11px monospace';
      w.blurb.split('\n').forEach((line, k) => X.fillText(line, CW / 2, CH - 30 + k * 13));
    }

    // ── Controls hint ──
    X.textAlign = 'center'; X.fillStyle = '#7a6a4a'; X.font = '10px monospace';
    X.fillText('← → ↑ ↓ MOVE      SPACE / ENTER BUY      ESC LEAVE', CW / 2, 168);

    X.textAlign = 'left';   // restore default
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/worlds/nile/shop/StallOverlay.js
git commit -m "feat(shop): first-person stall overlay (canvas sub-mode)"
```

---

## Task 9: Wire the overlay into NileRealm + open it from dialogue

**Files:**
- Modify: `frontend/worlds/nile/NileRealm.js` (import, construct, Events listener, `onKeyDown`, `update`, `render`)
- Modify: `frontend/worlds/nile/dialogue.js` (add "Step up to the table" choice that emits `shop:open`)

- [ ] **Step 1: Import the overlay and the Events bus in NileRealm**

Add to the imports near the top of `NileRealm.js` (after the `Flags` import on line 21):

```js
import { Events }                         from '../../engine/events.js';
import { StallOverlay }                   from './shop/StallOverlay.js';
```

- [ ] **Step 2: Construct the stall and listen for the open event**

In the `NileRealm` constructor, immediately after `this.registry = new InteractableRegistry();` (line 68), add:

```js
    this.stall = new StallOverlay();
    Events.on('shop:open', () => { if (!this.stall.isOpen()) this.stall.open(); });
```

- [ ] **Step 3: Intercept input while the stall is open**

At the very top of `onKeyDown(key)` (currently line 303), before the transition check, add:

```js
    if (this.stall.isOpen()) return this.stall.onKeyDown(key);
```

- [ ] **Step 4: Freeze movement while the stall is open**

At the top of `update(ts)` (currently line 217), after `if (RealmManager.isTransitioning) return;`, add:

```js
    if (this.stall.isOpen()) return;   // frozen at the table
```

- [ ] **Step 5: Draw the stall on top**

In `render()` (currently lines 296-301), add the stall draw as the last line, after `DialogueManager.render();`:

```js
    this.stall.render();
```

- [ ] **Step 6: Open the stall from the merchant dialogue**

In `frontend/worlds/nile/dialogue.js`, add the Events import at the top (after the `log` import on line 12):

```js
import { Events }   from '../../engine/events.js';
```

Then in `buildMerchantDialogue`, add a new first choice to the `wares` node (line 50-56) so the player can step up to the stall:

```js
      choices: [
        { label: '✦ Step up to the table', action: () => Events.emit('shop:open'), next: null },
        { label: 'Tell me about the Scarab Amulet',     next: 'scarab'  },
        { label: 'Tell me about the Protection Scroll',  next: 'scroll'  },
        { label: 'Tell me about the Bundle',             next: 'bundle'  },
        { label: 'None of these sound real',             next: 'real'    },
        { label: 'Leave',                                next: null      },
      ],
```

> NOTE: `action` fires on confirm, then the node closes (`next: null`), then the `shop:open` listener opens the overlay on the next frame. This matches the dialogue engine (`_confirm` runs `choice.action?.()` before `_goto(choice.next)`).

- [ ] **Step 7: Rebuild the frontend and smoke-launch**

Run: `docker compose up -d --build frontend`
Then open `http://localhost:5173`.
Expected: game loads with no console errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/worlds/nile/NileRealm.js frontend/worlds/nile/dialogue.js
git commit -m "feat(shop): open the stall from the merchant; wire overlay into NileRealm"
```

---

## Task 10: Manual end-to-end verification

**Files:** none (verification only). Requires a running stack: `docker compose up --build` and (first time) `docker compose exec backend alembic upgrade head`.

- [ ] **Step 1: Reach the bazaar with funds**

Open `http://localhost:5173`, log in (or restore a session). Open the dev panel (backtick `` ` ``) and click **💸 +$500 EARNED**. Walk west into the Nile, reach THE MERCHANT, press space to talk, choose "Show me the wares" → "✦ Step up to the table".
Expected: the screen reframes to the first-person stall; balance shows ~$500.

- [ ] **Step 2: Buy a keepsake**

Select the Scarab Amulet, press Enter.
Expected: balance drops by $9; the card flips to **OWNED**; pressing Enter on it again does nothing but a merchant bark in the log. Press Esc — you're back on the bank, free to walk.

- [ ] **Step 3: Buy a consumable**

Re-open the stall, select the Invite Scroll, buy it twice.
Expected: balance drops $5 each time; the scroll never shows OWNED; the HUD invite-scroll count ("N SCROLLS LEFT") rises by 1 each purchase.

- [ ] **Step 4: Insufficient funds**

Use the dev panel to reset, or pick an item priced above balance.
Expected: 400-path — no deduction, merchant bark in the log.

- [ ] **Step 5: Persistence (account)**

Reload the page (stay logged in).
Expected: the Scarab still reads OWNED (flag persisted via `GameState.flags`); balance reflects the spend.

- [ ] **Step 6: Guest path**

Log out, choose "play as guest", grant earnings via the dev panel, open the stall, buy a keepsake and an invite scroll.
Expected: identical UX with no network call to `/api/shop/buy` (check the Network tab — only `/api/config` is fetched once); state is local-only.

- [ ] **Step 7: Commit a note if anything was adjusted** (else skip)

```bash
git commit --allow-empty -m "test(shop): manual E2E verified — buy/own/consume/guest/persistence"
```

---

## Task 11: v1 wired NPC reactions (Ferryman, Sobek, Joseph)

The non-obvious utility for three owned items: NPCs gain a dialogue branch when you carry the item. Reads `Flags.get('shop_owned_<id>')`.

**Files:**
- Modify: `frontend/worlds/nile/dialogue.js` (Ferryman, Sobek, Joseph trees)

- [ ] **Step 1: Bronze Coin → Ferryman**

In `buildFerrymanDialogue`, add a `condition`-gated choice to the `terms` node so a coin-holder can settle exactly:

```js
        { label: '(Offer the Bronze Coin)', condition: () => Flags.get('shop_owned_bronze_coin'),
          action: () => { Flags.set('nile_ferry_paid', true);
                          log('✦ The coin is exact. The Ferryman does not look surprised.', 'hi'); },
          next: 'receipt' },
```

Insert it as the first entry in that node's `choices` array (before "I will pay the toll").

- [ ] **Step 2: Crocodile Sandals → Sobek**

In `buildSobekDialogue`, add a `condition`-gated choice to the `start` node:

```js
        { label: 'I wear the river\'s own skin', condition: () => Flags.get('shop_owned_croc_sandals'),
          next: 'sandals' },
```

And add the node it points to, alongside the other Sobek nodes:

```js
    sandals: {
      speaker: 'SOBEK  ✦  DIVINE COLLECTIONS',
      text: 'YOU WEAR ONE OF MINE.\nI DO NOT EAT MY OWN HIDE.\nIT WOULD BE UNPROFESSIONAL.\n\nWE UNDERSTAND EACH OTHER.\nFOR NOW.',
      onComplete: () => log('✦ Sobek regards your sandals. Something passes between you.', 'hi'),
      next: null,
    },
```

- [ ] **Step 3: Secret of the Flood → Joseph**

In `buildJosephDialogue`, add a `condition`-gated choice to the `start` node:

```js
        { label: 'I read the well too', condition: () => Flags.get('shop_owned_secret_flood'),
          next: 'fellow_insider' },
```

And add the node:

```js
    fellow_insider: {
      speaker: 'JOSEPH  ✦  GOVERNOR OF GRAIN',
      text: 'THEN YOU KNOW.\nYOU KNEW BEFORE THE OTHERS KNEW.\nYOU WERE AT THE WELL.\n\nWE ARE NOT MANY.\nWE NEVER WERE.\nTHAT IS RATHER THE POINT.',
      onComplete: () => log('✦ Joseph nods, slowly. You are not strangers. You never were.', 'hi'),
      next: 'heir',
    },
```

- [ ] **Step 4: Verify the dialogue file still parses**

Run: `cd frontend && node -e "import('./worlds/nile/dialogue.js').then(()=>console.log('dialogue OK'))"`
Expected: `dialogue OK` (it imports `Flags`/`Events`/`log`/`Dialogue`/`Ledger` — all pure or DOM-safe at import time).

- [ ] **Step 5: Manual check**

Rebuild (`docker compose up -d --build frontend`). Buy the Bronze Coin, talk to the Ferryman → the "(Offer the Bronze Coin)" choice appears. Buy the Sandals → Sobek's new line. Buy the Secret of the Flood → Joseph's "I read the well too" branch.
Expected: each branch appears only when the matching item is owned.

- [ ] **Step 6: Commit**

```bash
git add frontend/worlds/nile/dialogue.js
git commit -m "feat(shop): wired item hooks — Ferryman/Sobek/Joseph react to owned wares"
```

---

## Self-review checklist (run before declaring done)

- [ ] Spec coverage: stall overlay (T8/T9), real spend of `earned` (T4/T7), server-authoritative + guest-local (T7), four item tiers / two backend kinds (T1/T6), prices single-source via `/api/config` (T2/T5), ownership in `GameState.flags` (T4), ~15 wares (T1/T6), v1 wired hooks: invite scroll mechanical (T4/T7) + Ferryman/Sobek/Joseph reactions (T11), cryptic-cosmic tone (T6 blurbs), dormant cosmic items (catalogue, no hooks). ✓
- [ ] No hardcoded prices in JS (`grep -rn "price" frontend/worlds/nile/shop/catalogue.js` → none). ✓
- [ ] IDs identical across `app/shop.py` and `catalogue.js` (Task 6 Step 4). ✓
- [ ] Type consistency: response `{ ok, item_id, earned, invites_left, owned }` matches what `buy.js` reads (`resp.earned`, `resp.invites_left`). ✓

## Out of scope (deferred — see spec "Open / deferred")

- Re-buyable keepsakes (boolean flag now, counter later).
- Procedural pixel icons (glyphs for v1).
- The ✦✦ utilities (Eye of Horus, Clay Lamp, Anubis Mask, Priest's Vestments, Vial of Nile Water, Linen Robe) and all cosmic items ship ownable-but-dormant.
