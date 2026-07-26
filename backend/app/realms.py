"""
Realm registry + server-authoritative unlock logic.

REALM_CATALOGUE is the single source of truth for realms — same pattern as
shop.py / payout.py. One entry per realm: where its frontend module lives
(consumed by GET /api/realms in Phase 2) and the rule that unlocks it.

Rule primitives (one generic evaluator covers every realm):
  default_unlocked     — always available, never stored in the DB
  server_event_only    — the claim endpoint refuses; only backend hooks grant
                         (nile/oasis: granted when the first invite is sent)
  requires_realms      — all listed realm ids must already be unlocked
  requires_bought      — GameState.bought must be true
  requires_flags       — all listed flags truthy in GameState.flags
  requires_flags_any   — at least one listed flag truthy
  requires_counters    — {flag_name: minimum} numeric thresholds
  requires_d1_recruits — minimum direct (depth-1) recruits; this is how the
                         client's tier gate (PHARAOH = 15 D1) is expressed
                         server-side, since recruit rows can't be forged

`legacy_flag` is mirrored into GameState.flags on grant so existing client
draw/quest code hydrates unchanged from /api/me.
"""
from __future__ import annotations

import logging
import time

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GameState, Recruit, UserRealmUnlock
from app.ws import manager

logger = logging.getLogger(__name__)


REALM_CATALOGUE: dict[str, dict] = {
    "world": {
        "dir": "earth", "module": "/worlds/earth/WorldRealm.js",
        "export": "WorldRealm", "sort": 0,
        "unlock_rule": {"default_unlocked": True},
    },
    "nile": {
        "dir": "nile", "module": "/worlds/nile/NileRealm.js",
        "export": "NileRealm", "sort": 1,
        "unlock_rule": {"server_event_only": True},   # granted on first invite
        "legacy_flag": "first_scroll_sent",
    },
    "oasis": {
        "dir": "oasis", "module": "/worlds/oasis/OasisRealm.js",
        "export": "OasisRealm", "sort": 2,
        "unlock_rule": {"server_event_only": True},   # granted on first invite
        "legacy_flag": "first_scroll_sent",
    },
    "vault": {
        # Lives in worlds/oasis/ until the Phase 2 module-graph hygiene move.
        "dir": "oasis", "module": "/worlds/oasis/VaultRealm.js",
        "export": "VaultRealm", "sort": 3,
        "unlock_rule": {"requires_counters": {"sphinx_riddles_solved": 1}},
    },
    "atlantis": {
        "dir": "atlantis", "module": "/worlds/atlantis/AtlantisRealm.js",
        "export": "AtlantisRealm", "sort": 4,
        "unlock_rule": {"requires_realms": ["vault"], "requires_flags": ["stele_read"]},
        "legacy_flag": "atlantis_vault_opened",
    },
    "deep": {
        "dir": "deep", "module": "/worlds/deep/DeepRealm.js",
        "export": "DeepRealm", "sort": 5,
        "unlock_rule": {"requires_realms": ["atlantis"]},
        "legacy_flag": "atlantis_crack_visible",
    },
    "chamber": {
        "dir": "crypt", "module": "/worlds/crypt/ChamberRealm.js",
        "export": "ChamberRealm", "sort": 6,
        # Mirrors the client's THE SEVEN HEAVENS quest: all 7 sky gods met
        # AND PHARAOH tier, which is 15 direct recruits (game/tiers.js).
        "unlock_rule": {
            "requires_bought": True,
            "requires_counters": {"gods_met": 7},
            "requires_d1_recruits": 15,
        },
        "legacy_flag": "crypt_open",
    },
    "council": {
        "dir": "council", "module": "/worlds/council/CouncilRealm.js",
        "export": "CouncilRealm", "sort": 7,
        "unlock_rule": {"requires_realms": ["chamber"], "requires_flags": ["upline_accepted"]},
        "legacy_flag": "cosmic_upline_done",
    },
}

DEFAULT_UNLOCKED: frozenset[str] = frozenset(
    rid for rid, entry in REALM_CATALOGUE.items()
    if entry["unlock_rule"].get("default_unlocked")
)


# ── Rule evaluator ────────────────────────────────────────

def rule_satisfied(rule: dict, *, unlocked: frozenset[str] | set[str],
                   bought: bool, flags: dict, d1_recruits: int = 0) -> bool:
    """Evaluate an unlock rule against server-visible state."""
    if rule.get("default_unlocked"):
        return True
    if rule.get("server_event_only"):
        return False
    for realm in rule.get("requires_realms", []):
        if realm not in unlocked:
            return False
    if rule.get("requires_bought") and not bought:
        return False
    if d1_recruits < rule.get("requires_d1_recruits", 0):
        return False
    for flag in rule.get("requires_flags", []):
        if not flags.get(flag):
            return False
    any_flags = rule.get("requires_flags_any")
    if any_flags and not any(flags.get(f) for f in any_flags):
        return False
    for name, minimum in rule.get("requires_counters", {}).items():
        try:
            value = float(flags.get(name) or 0)
        except (TypeError, ValueError):
            value = 0
        if value < minimum:
            return False
    return True


# ── Unlock-set lookup (with in-process TTL cache) ─────────
# Safe because the backend is a single instance (see CLAUDE.md invariant) —
# grant_realm invalidates in the same process that reads.

_CACHE_TTL = 30.0
_unlock_cache: dict[int, tuple[float, frozenset[str]]] = {}


async def unlocked_realm_ids(db: AsyncSession, user_id: int) -> frozenset[str]:
    now = time.monotonic()
    hit = _unlock_cache.get(user_id)
    if hit and hit[0] > now:
        return hit[1]
    rows = (await db.execute(
        select(UserRealmUnlock.realm_id).where(UserRealmUnlock.user_id == user_id)
    )).scalars().all()
    ids = frozenset(rows) | DEFAULT_UNLOCKED
    _unlock_cache[user_id] = (now + _CACHE_TTL, ids)
    return ids


async def d1_recruit_count(db: AsyncSession, user_id: int) -> int:
    """Direct (depth-1) recruits — the server-side basis for the tier gate."""
    return (await db.execute(
        select(func.count()).select_from(Recruit).where(
            Recruit.recruiter_id == user_id, Recruit.depth == 1,
        )
    )).scalar_one()


def invalidate_unlock_cache(user_id: int | None = None) -> None:
    if user_id is None:
        _unlock_cache.clear()
    else:
        _unlock_cache.pop(user_id, None)


# ── Granting ──────────────────────────────────────────────

async def grant_realm(db: AsyncSession, user_id: int, realm_id: str,
                      source: str) -> bool:
    """Idempotent unlock grant. Commits, mirrors the legacy flag into
    GameState.flags, invalidates the cache, and pushes a `realm_unlocked`
    WS event. Returns True if a new grant was written."""
    entry = REALM_CATALOGUE.get(realm_id)
    if entry is None:
        raise ValueError(f"Unknown realm: {realm_id}")

    existing = await db.get(UserRealmUnlock, (user_id, realm_id))
    if existing:
        return False

    db.add(UserRealmUnlock(user_id=user_id, realm_id=realm_id, source=source))

    legacy = entry.get("legacy_flag")
    if legacy:
        state = (await db.execute(
            select(GameState).where(GameState.user_id == user_id)
        )).scalar_one_or_none()
        if state and not (state.flags or {}).get(legacy):
            state.flags = {**(state.flags or {}), legacy: True}

    try:
        await db.commit()
    except IntegrityError:
        # Concurrent grant of the same (user, realm) — already done elsewhere.
        await db.rollback()
        return False

    invalidate_unlock_cache(user_id)
    await manager.send_to_user(user_id, {
        "type": "realm_unlocked", "realm": realm_id, "source": source,
        # The client mirrors this locally so portal conditions and draw code
        # react immediately, without waiting for the next /api/me hydration.
        "legacy_flag": legacy,
    })
    logger.info("realm_unlocked user=%s realm=%s source=%s", user_id, realm_id, source)
    return True
