"""Unit tests for the realm registry, rule evaluator and grant path."""
import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import select

from app.models import GameState, UserRealmUnlock
from app.realms import (
    DEFAULT_UNLOCKED, REALM_CATALOGUE, grant_realm, invalidate_unlock_cache,
    rule_satisfied, unlocked_realm_ids,
)
from tests.conftest import TestingSessionLocal, make_user


@pytest.fixture(autouse=True)
def _clear_unlock_cache():
    invalidate_unlock_cache()
    yield
    invalidate_unlock_cache()


# ── Rule evaluator ────────────────────────────────────────

def _eval(rule, *, unlocked=frozenset(), bought=False, flags=None):
    return rule_satisfied(rule, unlocked=unlocked, bought=bought, flags=flags or {})


def test_default_unlocked_always_passes():
    assert _eval({"default_unlocked": True})


def test_server_event_only_never_passes_evaluation():
    # nile/oasis are granted by the invite hook, never by rule evaluation.
    assert not _eval({"server_event_only": True}, bought=True,
                     flags={"first_scroll_sent": True})


def test_requires_realms():
    rule = {"requires_realms": ["vault"]}
    assert not _eval(rule)
    assert _eval(rule, unlocked={"vault"})


def test_requires_bought():
    assert not _eval({"requires_bought": True})
    assert _eval({"requires_bought": True}, bought=True)


def test_requires_flags_all_must_be_truthy():
    rule = {"requires_flags": ["stele_read", "other"]}
    assert not _eval(rule, flags={"stele_read": True})
    assert _eval(rule, flags={"stele_read": True, "other": True})


def test_requires_flags_any_needs_only_one():
    rule = {"requires_flags_any": ["a", "b"]}
    assert not _eval(rule, flags={})
    assert _eval(rule, flags={"b": True})


def test_requires_counters_threshold():
    rule = {"requires_counters": {"sphinx_riddles_solved": 1}}
    assert not _eval(rule, flags={"sphinx_riddles_solved": 0})
    assert _eval(rule, flags={"sphinx_riddles_solved": 1})
    assert _eval(rule, flags={"sphinx_riddles_solved": 5})


def test_requires_counters_tolerates_junk_values():
    rule = {"requires_counters": {"gods_met": 7}}
    assert not _eval(rule, flags={"gods_met": "not a number"})
    assert not _eval(rule, flags={"gods_met": None})


def test_catalogue_realm_dependencies_all_exist():
    for realm_id, entry in REALM_CATALOGUE.items():
        for dep in entry["unlock_rule"].get("requires_realms", []):
            assert dep in REALM_CATALOGUE, f"{realm_id} requires unknown realm {dep}"


def test_world_is_the_only_default_realm():
    assert DEFAULT_UNLOCKED == frozenset({"world"})


# ── grant_realm ───────────────────────────────────────────

async def test_grant_is_idempotent_and_writes_one_row():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        with patch("app.realms.manager") as mgr:
            mgr.send_to_user = AsyncMock()
            assert await grant_realm(db, uid, "chamber", "test") is True
            assert await grant_realm(db, uid, "chamber", "test") is False
            # Only the first grant pushes a WS event.
            assert mgr.send_to_user.await_count == 1

    async with TestingSessionLocal() as db:
        rows = (await db.execute(
            select(UserRealmUnlock).where(UserRealmUnlock.user_id == uid)
        )).scalars().all()
    assert len(rows) == 1
    assert rows[0].realm_id == "chamber"


async def test_grant_mirrors_legacy_flag_into_game_state():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        with patch("app.realms.manager") as mgr:
            mgr.send_to_user = AsyncMock()
            await grant_realm(db, uid, "council", "test")

    async with TestingSessionLocal() as db:
        state = (await db.execute(
            select(GameState).where(GameState.user_id == uid)
        )).scalar_one()
    # council mirrors cosmic_upline_done so existing client code hydrates unchanged.
    assert state.flags["cosmic_upline_done"] is True


async def test_grant_rejects_unknown_realm():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        with pytest.raises(ValueError):
            await grant_realm(db, uid, "narnia", "test")


# ── unlocked_realm_ids ────────────────────────────────────

async def test_unlocked_always_includes_defaults():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        assert await unlocked_realm_ids(db, uid) == frozenset({"world"})


async def test_unlocked_reflects_grants_after_invalidation():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        await unlocked_realm_ids(db, uid)          # prime the cache
        with patch("app.realms.manager") as mgr:
            mgr.send_to_user = AsyncMock()
            await grant_realm(db, uid, "vault", "test")   # invalidates
        assert await unlocked_realm_ids(db, uid) == frozenset({"world", "vault"})
