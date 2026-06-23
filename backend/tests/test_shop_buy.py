from sqlalchemy import select
from app.models import GameState, Inventory, Transaction
from tests.conftest import TestingSessionLocal, make_user, auth_headers


async def test_buy_keepsake_creates_inventory_row_and_ledger(client):
    uid = await make_user(earned=20.0)
    async with client as c:
        res = await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
    assert res.status_code == 200
    body = res.json()
    assert body["earned"] == 16.0
    assert {"item_id": "scarab_amulet", "quantity": 1, "equipped": False} in body["inventory"]
    async with TestingSessionLocal() as db:
        inv = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalar_one()
        assert inv.item_id == "scarab_amulet" and inv.quantity == 1
        tx = (await db.execute(select(Transaction).where(Transaction.user_id == uid))).scalar_one()
        assert tx.type == "shop_buy" and float(tx.amount) == -4.0 and tx.ref_id == "scarab_amulet"


async def test_buy_keepsake_twice_returns_409(client):
    uid = await make_user(earned=50.0)
    async with client as c:
        await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
        res = await c.post("/api/shop/buy", json={"item_id": "scarab_amulet"}, headers=auth_headers(uid))
    assert res.status_code == 409
    async with TestingSessionLocal() as db:
        st = (await db.execute(select(GameState).where(GameState.user_id == uid))).scalar_one()
        assert float(st.earned) == 46.0   # only the first buy charged


async def test_buy_consumable_applies_effect_and_is_not_inventoried(client):
    # Flavor-true model: consumables are effect-only — invites rise, a ledger row
    # is written, but no inventory row is created (you don't "hold" a used scroll).
    uid = await make_user(earned=20.0, invites=0)
    async with client as c:
        await c.post("/api/shop/buy", json={"item_id": "invite_scroll"}, headers=auth_headers(uid))
        r2 = await c.post("/api/shop/buy", json={"item_id": "invite_scroll"}, headers=auth_headers(uid))
    body = r2.json()
    assert body["earned"] == 16.0
    assert body["invites_left"] == 2
    assert body["inventory"] == []        # consumables never appear in inventory
    async with TestingSessionLocal() as db:
        inv = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalars().all()
        assert inv == []
        txs = (await db.execute(select(Transaction).where(
            Transaction.user_id == uid, Transaction.type == "shop_buy"))).scalars().all()
        assert len(txs) == 2              # both purchases recorded in the ledger


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
