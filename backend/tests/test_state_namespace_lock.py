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
