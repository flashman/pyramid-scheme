"""THE SEA: the realm grant, the arrival step, and the Letter of Passage ware.

All three are catalogue data — no new routes. The Letter check itself is
client-side for now (no requires_items rule primitive; see the design spec).
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.channels import ChannelRegistry
from app.realms import grant_realm, invalidate_unlock_cache
from tests.conftest import TestingSessionLocal, make_user, auth_headers


@pytest.fixture(autouse=True)
def _clear_unlock_cache():
    invalidate_unlock_cache()
    yield
    invalidate_unlock_cache()


@pytest.fixture(autouse=True)
def _silence_ws():
    with patch("app.realms.manager") as mgr:
        mgr.send_to_user = AsyncMock()
        yield mgr


async def _grant(uid, realm):
    async with TestingSessionLocal() as db:
        await grant_realm(db, uid, realm, "test")


# ── The realm ─────────────────────────────────────────────

async def test_evaluate_grants_sea_once_the_nile_is_open(client):
    uid = await make_user()
    await _grant(uid, "nile")
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={}, headers=auth_headers(uid))).json()
    assert "sea" in body["newly_unlocked"]


async def test_evaluate_withholds_sea_without_the_nile(client):
    uid = await make_user()
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={}, headers=auth_headers(uid))).json()
    assert "sea" not in body["unlocked"]


# ── The arrival step ──────────────────────────────────────

async def test_crete_reached_is_refused_before_sailing(client):
    uid = await make_user()
    async with client as c:
        res = await c.post("/api/progress", json={"step_id": "crete_reached"}, headers=auth_headers(uid))
    assert res.status_code == 403


async def test_crete_reached_is_recorded_once_at_sea(client):
    uid = await make_user()
    await _grant(uid, "nile")
    await _grant(uid, "sea")
    async with client as c:
        res = await c.post("/api/progress", json={"step_id": "crete_reached"}, headers=auth_headers(uid))
        me = (await c.get("/api/me", headers=auth_headers(uid))).json()
    assert res.status_code == 200
    assert me["flags"]["crete_reached"] is True


async def test_forged_crete_reached_flag_is_stripped(client):
    """A future Crete realm will read this flag — it must not be console-writable."""
    uid = await make_user()
    async with client as c:
        await c.put("/api/state", json={"flags": {"crete_reached": True, "nile_baby": "adopted"}},
                    headers=auth_headers(uid))
        me = (await c.get("/api/me", headers=auth_headers(uid))).json()
    assert "crete_reached" not in me["flags"]
    assert me["flags"]["nile_baby"] == "adopted"


# ── The ware ──────────────────────────────────────────────

async def test_letter_of_passage_is_a_keepsake_bought_once(client):
    uid = await make_user(earned=20.0)
    async with client as c:
        first  = await c.post("/api/shop/buy", json={"item_id": "letter_of_passage"}, headers=auth_headers(uid))
        second = await c.post("/api/shop/buy", json={"item_id": "letter_of_passage"}, headers=auth_headers(uid))
    assert first.status_code == 200
    assert first.json()["earned"] == 12.0
    assert {"item_id": "letter_of_passage", "quantity": 1, "equipped": False} in first.json()["inventory"]
    assert second.status_code == 409


# ── The WS gate ───────────────────────────────────────────

async def _enter(uid, realm, reg, ws):
    with patch("app.routers.ws.channels", reg), \
         patch("app.routers.ws.manager") as mgr, \
         patch("app.routers.ws.AsyncSessionLocal", TestingSessionLocal):
        mgr.get_meta.return_value = {"username": "buyer", "projection_session": None,
                                     "px": 0, "py": 0, "pZ": 0, "facing": 1, "frame": 0}
        mgr.set_meta = MagicMock()
        from app.routers.ws import _on_realm_enter
        await _on_realm_enter(ws, uid, "buyer", {"realm": realm, "owner_id": uid})


async def test_ws_realm_enter_sea_is_gated_on_the_grant():
    uid = await make_user()
    reg = ChannelRegistry()
    ws = MagicMock()
    ws.send_json = AsyncMock()
    await reg.join(ws, (uid, "world"))

    await _enter(uid, "sea", reg, ws)
    assert ws not in reg.peers((uid, "sea"))

    await _grant(uid, "sea")
    invalidate_unlock_cache(uid)
    await _enter(uid, "sea", reg, ws)
    assert ws in reg.peers((uid, "sea"))
