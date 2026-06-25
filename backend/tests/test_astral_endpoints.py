"""Tests for GET /api/astral/downline and POST /api/astral/beckon."""
import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy import select
from datetime import datetime, timezone, timedelta
from app.models import User, GameState, Recruit, Transaction, Inventory
from tests.conftest import TestingSessionLocal, make_user, auth_headers


async def make_recruit_pair_with_email():
    async with TestingSessionLocal() as db:
        alice = User(username="alice", password_hash="x", email="alice@test.com")
        bob   = User(username="bob",   password_hash="x", email="bob@test.com")
        db.add_all([alice, bob])
        await db.flush()
        bob.recruiter_id = alice.id
        db.add(GameState(user_id=alice.id, bought=True, earned=50.0, invites_left=0, flags={}))
        db.add(GameState(user_id=bob.id,   bought=True, earned=50.0, invites_left=0, flags={}))
        db.add(Recruit(recruiter_id=alice.id, recruit_id=bob.id,
                       recruit_name="bob", parent_name="alice", depth=1, payout=5.0))
        db.add(Inventory(user_id=alice.id, item_id="astral_lens", quantity=1))
        await db.commit()
        return alice.id, bob.id


async def test_downline_returns_only_own_direct_recruits(client):
    alice_id, bob_id = await make_recruit_pair_with_email()
    with patch("app.routers.astral.manager") as mock_mgr, \
         patch("app.routers.astral.channels") as mock_ch:
        mock_mgr.is_connected.return_value = True
        mock_mgr._meta = {}

        async with client as c:
            res = await c.get("/api/astral/downline",
                              headers=auth_headers(alice_id, "alice"))

    assert res.status_code == 200
    data = res.json()
    assert len(data["downline"]) == 1
    assert data["downline"][0]["username"] == "bob"
    assert data["downline"][0]["online"] is True


async def test_downline_excludes_other_users_recruits(client):
    """Alice cannot see carol's recruits even if carol recruited dave."""
    alice_id, _ = await make_recruit_pair_with_email()

    async with client as c:
        with patch("app.routers.astral.manager") as mock_mgr:
            mock_mgr.is_connected.return_value = False
            res = await c.get("/api/astral/downline",
                              headers=auth_headers(alice_id, "alice"))

    body = res.json()
    assert all(d["username"] != "carol" for d in body.get("downline", []))


async def test_beckon_sends_email_and_records_transaction(client):
    alice_id, bob_id = await make_recruit_pair_with_email()
    with patch("app.routers.astral.send_beckon_email", new_callable=AsyncMock) as mock_email, \
         patch("app.routers.astral.manager") as mock_mgr:
        mock_mgr.is_connected.return_value = False

        async with client as c:
            res = await c.post("/api/astral/beckon",
                               json={"target_user_id": bob_id},
                               headers=auth_headers(alice_id, "alice"))

    assert res.status_code == 200
    mock_email.assert_called_once()
    async with TestingSessionLocal() as db:
        txs = (await db.execute(
            select(Transaction).where(
                Transaction.user_id == alice_id,
                Transaction.type    == "beckon",
            )
        )).scalars().all()
        assert len(txs) == 1
        assert str(txs[0].ref_id) == str(bob_id)


async def test_beckon_rate_limit_429(client):
    alice_id, bob_id = await make_recruit_pair_with_email()
    async with TestingSessionLocal() as db:
        # Seed a recent beckon transaction
        db.add(Transaction(user_id=alice_id, type="beckon",
                           ref_id=str(bob_id), amount=0,
                           created_at=datetime.now(timezone.utc)))
        await db.commit()

    with patch("app.routers.astral.send_beckon_email", new_callable=AsyncMock) as mock_email, \
         patch("app.routers.astral.manager") as mock_mgr:
        mock_mgr.is_connected.return_value = False
        async with client as c:
            res = await c.post("/api/astral/beckon",
                               json={"target_user_id": bob_id},
                               headers=auth_headers(alice_id, "alice"))

    assert res.status_code == 429
    mock_email.assert_not_called()


async def test_beckon_rejects_non_downline(client):
    alice_id, _ = await make_recruit_pair_with_email()
    carol_id = await make_user(username="carol")

    with patch("app.routers.astral.send_beckon_email", new_callable=AsyncMock) as mock_email, \
         patch("app.routers.astral.manager") as mock_mgr:
        mock_mgr.is_connected.return_value = False
        async with client as c:
            res = await c.post("/api/astral/beckon",
                               json={"target_user_id": carol_id},
                               headers=auth_headers(alice_id, "alice"))

    assert res.status_code == 403
    mock_email.assert_not_called()
