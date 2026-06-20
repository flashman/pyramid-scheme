from sqlalchemy import select

from app.models import User, GameState, Recruit, Transaction
from app.payout import payout_at_depth
from app.auth import hash_password
from tests.conftest import TestingSessionLocal, auth_headers


async def _mk(username, *, is_admin=False, recruiter_id=None, bought=False, balance=0.0):
    """Insert a User (+ GameState) with explicit fields; return its id."""
    async with TestingSessionLocal() as db:
        u = User(
            username=username,
            password_hash=hash_password("password123"),
            is_admin=is_admin,
            recruiter_id=recruiter_id,
            balance=balance,
        )
        db.add(u)
        await db.flush()
        db.add(GameState(user_id=u.id, bought=bought, earned=0.0, invites_left=0))
        await db.commit()
        return u.id


async def test_confirm_buyin_rejects_non_admin(client):
    caller = await _mk("plebeian", is_admin=False)
    buyer  = await _mk("buyer")
    async with client as c:
        res = await c.post(
            "/api/admin/confirm-buyin",
            json={"username": "buyer"},
            headers=auth_headers(caller, "plebeian"),
        )
    assert res.status_code == 403


async def test_confirm_buyin_credits_the_upline(client):
    admin    = await _mk("pharaoh", is_admin=True)
    ancestor = await _mk("ancestor")
    buyer    = await _mk("buyer", recruiter_id=ancestor)

    async with client as c:
        res = await c.post(
            "/api/admin/confirm-buyin",
            json={"username": "buyer"},
            headers=auth_headers(admin, "pharaoh"),
        )
    assert res.status_code == 200, res.text

    d1 = payout_at_depth(1)  # 4.0
    async with TestingSessionLocal() as db:
        # Buyer is now bought in with a fresh batch of scrolls.
        buyer_gs = (await db.execute(
            select(GameState).where(GameState.user_id == buyer))).scalar_one()
        assert buyer_gs.bought is True
        assert buyer_gs.invites_left == 4

        # The ancestor was actually paid — balance + earned both moved.
        anc = (await db.execute(select(User).where(User.id == ancestor))).scalar_one()
        assert float(anc.balance) == d1
        anc_gs = (await db.execute(
            select(GameState).where(GameState.user_id == ancestor))).scalar_one()
        assert float(anc_gs.earned) == d1

        # A Recruit row + recruit_payout ledger row were written for the ancestor.
        recruit = (await db.execute(
            select(Recruit).where(Recruit.recruiter_id == ancestor))).scalar_one()
        assert recruit.depth == 1 and float(recruit.payout) == d1
        assert recruit.recruit_id == buyer

        payout_tx = (await db.execute(select(Transaction).where(
            Transaction.user_id == ancestor,
            Transaction.type == "recruit_payout"))).scalar_one()
        assert float(payout_tx.amount) == d1

        # The buyer's own buy-in is recorded with the venmo source.
        buyin_tx = (await db.execute(select(Transaction).where(
            Transaction.user_id == buyer,
            Transaction.type == "buyin"))).scalar_one()
        assert buyin_tx.ref_id == "venmo"


async def test_confirm_buyin_already_bought_requires_allow_rebuy(client):
    admin = await _mk("pharaoh", is_admin=True)
    buyer = await _mk("buyer", bought=True)
    async with client as c:
        blocked = await c.post(
            "/api/admin/confirm-buyin",
            json={"username": "buyer"},
            headers=auth_headers(admin, "pharaoh"),
        )
        assert blocked.status_code == 409

        allowed = await c.post(
            "/api/admin/confirm-buyin",
            json={"username": "buyer", "allow_rebuy": True},
            headers=auth_headers(admin, "pharaoh"),
        )
        assert allowed.status_code == 200


async def test_me_exposes_is_admin(client):
    admin = await _mk("pharaoh", is_admin=True)
    pleb  = await _mk("plebeian", is_admin=False)
    async with client as c:
        admin_me = await c.get("/api/me", headers=auth_headers(admin, "pharaoh"))
        pleb_me  = await c.get("/api/me", headers=auth_headers(pleb, "plebeian"))
    assert admin_me.status_code == 200 and admin_me.json()["is_admin"] is True
    assert pleb_me.status_code == 200 and pleb_me.json()["is_admin"] is False


async def test_me_exposes_offering_code(client):
    from app.offering import offering_code
    uid = await _mk("admin")
    async with client as c:
        me = await c.get("/api/me", headers=auth_headers(uid, "admin"))
    assert me.json()["offering_code"] == offering_code("admin")


async def test_lookup_resolves_code_to_username(client):
    from app.offering import offering_code
    admin = await _mk("pharaoh", is_admin=True)
    buyer = await _mk("alice", bought=True)
    async with client as c:
        res = await c.post(
            "/api/admin/lookup",
            json={"code": offering_code("alice")},
            headers=auth_headers(admin, "pharaoh"),
        )
    assert res.status_code == 200
    matches = res.json()["matches"]
    assert {"username": "alice", "bought": True} in matches


async def test_lookup_no_match_returns_empty(client):
    admin = await _mk("pharaoh", is_admin=True)
    async with client as c:
        res = await c.post(
            "/api/admin/lookup",
            json={"code": "🐍🐍🐍🐍🐍"},
            headers=auth_headers(admin, "pharaoh"),
        )
    assert res.status_code == 200 and res.json()["matches"] == []


async def test_lookup_rejects_non_admin(client):
    from app.offering import offering_code
    caller = await _mk("plebeian", is_admin=False)
    async with client as c:
        res = await c.post(
            "/api/admin/lookup",
            json={"code": offering_code("plebeian")},
            headers=auth_headers(caller, "plebeian"),
        )
    assert res.status_code == 403


async def test_confirm_buyin_unknown_user_404(client):
    admin = await _mk("pharaoh", is_admin=True)
    async with client as c:
        res = await c.post(
            "/api/admin/confirm-buyin",
            json={"username": "ghost"},
            headers=auth_headers(admin, "pharaoh"),
        )
    assert res.status_code == 404
