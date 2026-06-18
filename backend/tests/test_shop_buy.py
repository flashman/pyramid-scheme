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
