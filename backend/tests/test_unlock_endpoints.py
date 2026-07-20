"""End-to-end tests for the two generic unlock routes.

Realm ids never appear in a URL path — /api/unlocks/evaluate takes no realm
argument at all, and /api/challenge names its challenge in the body.
"""
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import select

from app.models import GameState, UserRealmUnlock
from app.realms import invalidate_unlock_cache
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


async def _unlocked_ids(uid):
    async with TestingSessionLocal() as db:
        rows = (await db.execute(
            select(UserRealmUnlock.realm_id).where(UserRealmUnlock.user_id == uid)
        )).scalars().all()
    return set(rows)


# ── /api/unlocks/evaluate ─────────────────────────────────

async def test_evaluate_grants_nothing_for_a_fresh_player(client):
    uid = await make_user()
    async with client as c:
        res = await c.post("/api/unlocks/evaluate", json={}, headers=auth_headers(uid))
    body = res.json()
    assert res.status_code == 200
    assert body["newly_unlocked"] == []
    assert body["unlocked"] == ["world"]


async def test_evaluate_grants_realm_once_its_rule_passes(client):
    uid = await make_user(flags={"sphinx_riddles_solved": 1})
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={},
                             headers=auth_headers(uid))).json()
    assert "vault" in body["newly_unlocked"]
    assert "vault" in await _unlocked_ids(uid)


async def test_evaluate_is_idempotent(client):
    uid = await make_user(flags={"sphinx_riddles_solved": 1})
    async with client as c:
        first  = (await c.post("/api/unlocks/evaluate", json={},
                               headers=auth_headers(uid))).json()
        second = (await c.post("/api/unlocks/evaluate", json={},
                               headers=auth_headers(uid))).json()
    assert first["newly_unlocked"] == ["vault"]
    assert second["newly_unlocked"] == []          # already granted
    assert "vault" in second["unlocked"]


async def test_evaluate_opens_a_dependency_chain_in_one_call(client):
    """vault → atlantis → deep all become satisfiable at once; the evaluator
    loops to a fixpoint rather than granting one link per request."""
    uid = await make_user(flags={"sphinx_riddles_solved": 1, "stele_read": True})
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={},
                             headers=auth_headers(uid))).json()
    assert set(body["newly_unlocked"]) == {"vault", "atlantis", "deep"}


async def test_evaluate_ignores_any_client_supplied_body(client):
    """Evaluate takes no arguments: every rule input is server-owned, so
    there is nothing a caller could say that changes the outcome. A body
    full of forged progression must be inert."""
    uid = await make_user()
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate",
                             json={"flags": {"cosmic_upline_done": True,
                                             "sphinx_riddles_solved": 99,
                                             "gods_met": 7,
                                             "stele_read": True,
                                             "upline_accepted": True}},
                             headers=auth_headers(uid))).json()
    assert body["newly_unlocked"] == []
    assert await _unlocked_ids(uid) == set()


async def test_evaluate_reconciles_state_written_by_the_step_routes(client):
    """Grants happen inline, but evaluate must still reconcile a client that
    drifted (fresh login, missed WS event)."""
    uid = await make_user(flags={"sphinx_riddles_solved": 1})
    async with client as c:
        first = (await c.post("/api/unlocks/evaluate",
                              headers=auth_headers(uid))).json()
    assert "vault" in first["newly_unlocked"]


async def test_evaluate_never_grants_server_event_only_realms(client):
    """nile/oasis open on the first invite, not on any client-visible state."""
    uid = await make_user(flags={"first_scroll_sent": True})
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={},
                             headers=auth_headers(uid))).json()
    assert "nile"  not in body["unlocked"]
    assert "oasis" not in body["unlocked"]


async def test_evaluate_requires_auth(client):
    async with client as c:
        res = await c.post("/api/unlocks/evaluate", json={})
    assert res.status_code == 401


async def test_chamber_opens_for_a_bought_player_who_met_the_gods(client):
    uid = await make_user(flags={"gods_met": 7})   # make_user is bought=True
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={},
                             headers=auth_headers(uid))).json()
    assert "chamber" in body["newly_unlocked"]


async def test_chamber_stays_shut_without_the_buy_in(client):
    """Both halves of the rule are required — meeting the gods isn't enough."""
    uid = await make_user(username="notbought", flags={"gods_met": 7})
    async with TestingSessionLocal() as db:
        state = (await db.execute(
            select(GameState).where(GameState.user_id == uid)
        )).scalar_one()
        state.bought = False
        await db.commit()

    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={},
                             headers=auth_headers(uid))).json()
    assert "chamber" not in body["newly_unlocked"]


async def test_chamber_stays_shut_below_the_god_count(client):
    uid = await make_user(flags={"gods_met": 6})
    async with client as c:
        body = (await c.post("/api/unlocks/evaluate", json={},
                             headers=auth_headers(uid))).json()
    assert "chamber" not in body["newly_unlocked"]


# ── /api/progress ─────────────────────────────────────────

async def test_progress_records_a_step_and_unlocks(client):
    uid = await make_user(flags={"sphinx_riddles_solved": 1})
    async with client as c:
        await c.post("/api/unlocks/evaluate", json={}, headers=auth_headers(uid))
        body = (await c.post("/api/progress", json={"step_id": "stele_read"},
                             headers=auth_headers(uid))).json()
    assert "atlantis" in body["newly_unlocked"]


async def test_progress_refuses_a_step_out_of_order(client):
    """stele_read needs the vault — which needs a real riddle answer. This is
    what stops the console from skipping straight to Atlantis."""
    uid = await make_user()
    async with client as c:
        res = await c.post("/api/progress", json={"step_id": "stele_read"},
                           headers=auth_headers(uid))
    assert res.status_code == 403
    assert await _unlocked_ids(uid) == set()


async def test_progress_counts_each_god_once(client):
    uid = await make_user()
    async with client as c:
        for _ in range(3):
            body = (await c.post("/api/progress",
                                 json={"step_id": "god_met", "item_id": "0"},
                                 headers=auth_headers(uid))).json()
    assert body["count"] == 1


async def test_meeting_all_seven_gods_opens_the_crypt(client):
    uid = await make_user()
    async with client as c:
        for i in range(7):
            body = (await c.post("/api/progress",
                                 json={"step_id": "god_met", "item_id": str(i)},
                                 headers=auth_headers(uid))).json()
    assert body["count"] == 7
    assert "chamber" in body["newly_unlocked"]


async def test_god_step_requires_buy_in(client):
    uid = await make_user(username="broke")
    async with TestingSessionLocal() as db:
        state = (await db.execute(
            select(GameState).where(GameState.user_id == uid)
        )).scalar_one()
        state.bought = False
        await db.commit()

    async with client as c:
        res = await c.post("/api/progress",
                           json={"step_id": "god_met", "item_id": "0"},
                           headers=auth_headers(uid))
    assert res.status_code == 403


async def test_progress_rejects_unknown_step_and_item(client):
    uid = await make_user()
    async with client as c:
        bad_step = await c.post("/api/progress", json={"step_id": "nope"},
                                headers=auth_headers(uid))
        bad_item = await c.post("/api/progress",
                                json={"step_id": "god_met", "item_id": "99"},
                                headers=auth_headers(uid))
    assert bad_step.status_code == 404
    assert bad_item.status_code == 404


async def test_progress_requires_auth(client):
    async with client as c:
        res = await c.post("/api/progress", json={"step_id": "stele_read"})
    assert res.status_code == 401


async def test_full_chain_cannot_be_short_circuited(client):
    """The end-to-end integrity claim: with no forged state, a fresh player
    can only reach the Council by walking every gate in order."""
    uid = await make_user()
    async with client as c:
        h = auth_headers(uid)
        # Forging everything at once achieves nothing.
        forged = await c.post("/api/unlocks/evaluate",
                              json={"flags": {"gods_met": 7, "stele_read": True,
                                              "upline_accepted": True,
                                              "sphinx_riddles_solved": 12}},
                              headers=h)
        assert forged.json()["newly_unlocked"] == []

        # The council step is refused until the crypt is genuinely open.
        assert (await c.post("/api/progress", json={"step_id": "upline_accepted"},
                             headers=h)).status_code == 403

        # Walk it properly: seven gods → crypt, then the chief's offer.
        for i in range(7):
            await c.post("/api/progress",
                         json={"step_id": "god_met", "item_id": str(i)}, headers=h)
        body = (await c.post("/api/progress", json={"step_id": "upline_accepted"},
                             headers=h)).json()
    assert "council" in body["newly_unlocked"]


# ── /api/challenge ────────────────────────────────────────

async def test_challenge_correct_answer_increments_counter(client):
    uid = await make_user()
    async with client as c:
        body = (await c.post("/api/challenge",
                             json={"challenge_id": "sphinx", "item_id": "map",
                                   "answer": "MAP"},
                             headers=auth_headers(uid))).json()
    assert body["correct"] is True
    assert body["solved_count"] == 1


async def test_challenge_correct_answer_unlocks_the_vault(client):
    uid = await make_user()
    async with client as c:
        body = (await c.post("/api/challenge",
                             json={"challenge_id": "sphinx", "item_id": "hole",
                                   "answer": "hole"},
                             headers=auth_headers(uid))).json()
    assert "vault" in body["newly_unlocked"]
    assert "vault" in await _unlocked_ids(uid)


async def test_challenge_accepts_any_configured_synonym(client):
    uid = await make_user()
    async with client as c:
        body = (await c.post("/api/challenge",
                             json={"challenge_id": "sphinx", "item_id": "clock",
                                   "answer": "  Time  "},
                             headers=auth_headers(uid))).json()
    assert body["correct"] is True


async def test_challenge_resolving_the_same_riddle_does_not_farm_the_counter(client):
    uid = await make_user()
    async with client as c:
        for _ in range(3):
            body = (await c.post("/api/challenge",
                                 json={"challenge_id": "sphinx", "item_id": "map",
                                       "answer": "map"},
                                 headers=auth_headers(uid))).json()
    assert body["solved_count"] == 1


async def test_challenge_wrong_answer_counts_attempts_without_hint(client):
    uid = await make_user()
    async with client as c:
        body = (await c.post("/api/challenge",
                             json={"challenge_id": "sphinx", "item_id": "map",
                                   "answer": "wrong"},
                             headers=auth_headers(uid))).json()
    assert body["correct"] is False
    assert body["attempts"] == 1
    assert "hint" not in body


async def test_challenge_reveals_the_hint_at_the_configured_threshold(client):
    uid = await make_user()
    async with client as c:
        for i in range(13):
            body = (await c.post("/api/challenge",
                                 json={"challenge_id": "sphinx", "item_id": "map",
                                       "answer": "nope"},
                                 headers=auth_headers(uid))).json()
            if i < 12:
                assert "hint" not in body, f"hint leaked at attempt {i + 1}"
    assert body["attempts"] == 13
    assert body["hint"] == "MAP"


async def test_challenge_guest_gets_validation_but_nothing_persists(client):
    async with client as c:
        body = (await c.post("/api/challenge",
                             json={"challenge_id": "sphinx", "item_id": "map",
                                   "answer": "map"})).json()
    assert body["correct"] is True
    assert body["solved_count"] == 0
    async with TestingSessionLocal() as db:
        rows = (await db.execute(select(UserRealmUnlock))).scalars().all()
    assert rows == []


async def test_challenge_unknown_ids_404(client):
    uid = await make_user()
    async with client as c:
        bad_challenge = await c.post("/api/challenge",
                                     json={"challenge_id": "nope", "item_id": "map",
                                           "answer": "map"},
                                     headers=auth_headers(uid))
        bad_item = await c.post("/api/challenge",
                                json={"challenge_id": "sphinx", "item_id": "nope",
                                      "answer": "map"},
                                headers=auth_headers(uid))
    assert bad_challenge.status_code == 404
    assert bad_item.status_code == 404
