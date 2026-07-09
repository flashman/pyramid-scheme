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


# ── presence module ──────────────────────────────────────────────────────

async def test_direct_recruiter_id_returns_recruiter():
    from app.presence import direct_recruiter_id
    alice_id, bob_id = await _make_pair()
    async with TestingSessionLocal() as db:
        assert await direct_recruiter_id(db, bob_id) == alice_id


async def test_direct_recruiter_id_none_when_no_recruiter():
    from app.presence import direct_recruiter_id
    lonely_id = await make_user(username="lonely")
    async with TestingSessionLocal() as db:
        assert await direct_recruiter_id(db, lonely_id) is None


async def test_notify_presence_pushes_to_recruiter():
    from app import presence
    alice_id, bob_id = await _make_pair()
    with patch.object(presence, "AsyncSessionLocal", TestingSessionLocal), \
         patch.object(presence, "manager") as mock_mgr:
        mock_mgr.send_to_user = AsyncMock(return_value=True)
        await presence.notify_presence(bob_id, online=True)
    mock_mgr.send_to_user.assert_awaited_once()
    target, payload = mock_mgr.send_to_user.await_args.args
    assert target == alice_id
    assert payload == {"type": "recruit_presence", "user_id": bob_id, "online": True}


async def test_notify_presence_noop_without_recruiter():
    from app import presence
    lonely_id = await make_user(username="lonely")
    with patch.object(presence, "AsyncSessionLocal", TestingSessionLocal), \
         patch.object(presence, "manager") as mock_mgr:
        mock_mgr.send_to_user = AsyncMock()
        await presence.notify_presence(lonely_id, online=False)
    mock_mgr.send_to_user.assert_not_awaited()


# ── connect/disconnect transitions (multi-tab) ───────────────────────────

async def test_presence_push_only_on_first_connect_and_last_disconnect():
    """Drives the REAL on_socket_connect/on_socket_disconnect against a fresh
    manager. Two tabs: first connect pushes online; closing one pushes nothing;
    closing the last pushes offline."""
    from app import presence
    from app.ws import ConnectionManager
    from unittest.mock import MagicMock

    mgr = ConnectionManager()
    pushes = []

    async def fake_notify(user_id, online):
        pushes.append((user_id, online))

    ws1, ws2 = MagicMock(name="ws1"), MagicMock(name="ws2")
    for s in (ws1, ws2):
        s.accept = AsyncMock()

    # Patch the module globals the transition fns look up at call time.
    with patch.object(presence, "manager", mgr), \
         patch.object(presence, "notify_presence", fake_notify):
        await presence.on_socket_connect(7, ws1)      # online push
        await presence.on_socket_connect(7, ws2)      # no push (already online)
        await presence.on_socket_disconnect(7, ws1)   # no push (still has ws2)
        await presence.on_socket_disconnect(7, ws2)   # offline push

    assert pushes == [(7, True), (7, False)]


async def test_direct_recruiter_id_survives_rebuy_duplicate_rows():
    """A rebought recruit has multiple depth=1 rows (chain.py inserts one per
    buy-in), all with the same recruiter_id. limit(1) must not raise."""
    from app.presence import direct_recruiter_id
    alice_id, bob_id = await _make_pair()
    async with TestingSessionLocal() as db:
        db.add(Recruit(recruiter_id=alice_id, recruit_id=bob_id,
                       recruit_name="bob", parent_name="alice", depth=1, payout=5.0))
        await db.commit()
    async with TestingSessionLocal() as db:
        assert await direct_recruiter_id(db, bob_id) == alice_id
