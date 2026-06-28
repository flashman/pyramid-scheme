"""Tests for recruit online-indicator plumbing + presence push."""
import pytest
from unittest.mock import patch, AsyncMock
from app.models import User, GameState, Recruit
from tests.conftest import TestingSessionLocal, make_user, auth_headers


async def _make_pair():
    """alice recruits bob (depth=1, real user). Returns (alice_id, bob_id)."""
    async with TestingSessionLocal() as db:
        alice = User(username="alice", password_hash="x")
        bob   = User(username="bob",   password_hash="x")
        db.add_all([alice, bob])
        await db.flush()
        bob.recruiter_id = alice.id
        db.add(GameState(user_id=alice.id, bought=True, earned=0, invites_left=0, flags={}))
        db.add(GameState(user_id=bob.id,   bought=True, earned=0, invites_left=0, flags={}))
        db.add(Recruit(recruiter_id=alice.id, recruit_id=bob.id,
                       recruit_name="bob", parent_name="alice", depth=1, payout=5.0))
        await db.commit()
        return alice.id, bob.id


async def test_list_recruits_includes_user_id(client):
    alice_id, bob_id = await _make_pair()
    async with client as c:
        res = await c.get("/api/recruits", headers=auth_headers(alice_id, "alice"))
    assert res.status_code == 200
    rows = res.json()["recruits"]
    assert len(rows) == 1
    assert rows[0]["user_id"] == bob_id


async def test_list_recruits_user_id_null_for_sim(client):
    alice_id = await make_user(username="alice")
    async with TestingSessionLocal() as db:
        db.add(Recruit(recruiter_id=alice_id, recruit_id=None,
                       recruit_name="simguy", parent_name="alice", depth=1, payout=5.0))
        await db.commit()
    async with client as c:
        res = await c.get("/api/recruits", headers=auth_headers(alice_id, "alice"))
    assert res.json()["recruits"][0]["user_id"] is None


async def test_recruit_joined_event_carries_user_id_and_online():
    from app.chain import run_buyin_chain
    alice_id, _ = await _make_pair()
    async with TestingSessionLocal() as db:
        with patch("app.chain.manager") as mock_mgr:
            mock_mgr.is_connected.return_value = True
            events = await run_buyin_chain(alice_id, "carol", buyer_user_id=999, db=db)
            await db.commit()
    # events is a list of (recipient_user_id, payload) tuples
    payloads = [p for (_uid, p) in events if p.get("type") == "recruit_joined"]
    assert payloads, "expected at least one recruit_joined event"
    assert payloads[0]["user_id"] == 999
    assert payloads[0]["online"] is True
