"""
Server-authoritative realm unlocks — two generic routes.

Realm ids never appear in a URL path. The server already holds everything
needed to decide what a player has opened, so the unlock route takes no
realm argument at all; the challenge route names its challenge in the body.

POST /api/unlocks/evaluate  {flags?}
  Optionally merge a client flag snapshot (same reserved-name stripping as
  PUT /api/state — see app/flags.py), then re-evaluate every rule in
  REALM_CATALOGUE against server-visible state and grant whatever is now
  satisfied. Idempotent, no oracle: a caller learns only its own unlock set.

  The optional flags body exists so a call site can push-and-evaluate in one
  round trip. Without it, a rule keyed on a flag still sitting in the
  client's 1.5s sync debounce would evaluate false.

POST /api/challenge  {challenge_id, item_id, answer}
  Validate against CHALLENGE_CONFIG. On first solve of an item, increment
  the configured server-owned counter, then run the same evaluation pass.
  Hint (the answer) only after the configured attempt threshold.
  Auth is optional: guests get validation only, nothing persisted.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_optional_user
from app.challenges import CHALLENGE_CONFIG
from app.database import get_db
from app.flags import sanitize_flags
from app.models import User, GameState
from app.realms import (
    REALM_CATALOGUE, grant_realm, invalidate_unlock_cache,
    rule_satisfied, unlocked_realm_ids,
)

router = APIRouter()


async def _get_or_create_state(db: AsyncSession, user_id: int) -> GameState:
    state = (await db.execute(
        select(GameState).where(GameState.user_id == user_id)
    )).scalar_one_or_none()
    if not state:
        state = GameState(user_id=user_id)
        db.add(state)
        await db.flush()
    return state


async def _evaluate_all(db: AsyncSession, user_id: int,
                        state: GameState, source: str) -> list[str]:
    """Grant every rule-based realm whose rule now passes. Loops to a
    fixpoint so a chain (vault → atlantis → deep) opens in one call when
    the state warrants it. Returns the newly granted ids."""
    invalidate_unlock_cache(user_id)
    unlocked = set(await unlocked_realm_ids(db, user_id))
    flags    = state.flags or {}
    newly: list[str] = []

    changed = True
    while changed:
        changed = False
        for realm_id, entry in REALM_CATALOGUE.items():
            rule = entry["unlock_rule"]
            # server_event_only realms are granted by backend hooks only
            # (nile/oasis on first invite) — never by evaluation.
            if realm_id in unlocked or rule.get("server_event_only"):
                continue
            if rule_satisfied(rule, unlocked=unlocked,
                              bought=state.bought, flags=flags):
                if await grant_realm(db, user_id, realm_id, source=source):
                    newly.append(realm_id)
                unlocked.add(realm_id)
                changed = True
    return newly


# ── POST /api/unlocks/evaluate ────────────────────────────

class EvaluateRequest(BaseModel):
    flags: dict | None = None


@router.post("/unlocks/evaluate")
async def evaluate_unlocks(
    body: EvaluateRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await _get_or_create_state(db, current_user.id)

    if body and body.flags is not None:
        incoming = sanitize_flags(body.flags)
        if incoming:
            state.flags = {**(state.flags or {}), **incoming}
            await db.commit()

    newly = await _evaluate_all(db, current_user.id, state, source="evaluate")
    unlocked = await unlocked_realm_ids(db, current_user.id)
    return {"ok": True, "unlocked": sorted(unlocked), "newly_unlocked": newly}


# ── POST /api/challenge ───────────────────────────────────

class ChallengeRequest(BaseModel):
    challenge_id: str
    item_id:      str
    answer:       str


@router.post("/challenge")
async def submit_challenge(
    body: ChallengeRequest,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    cfg = CHALLENGE_CONFIG.get(body.challenge_id)
    if cfg is None:
        raise HTTPException(status_code=404, detail="Unknown challenge.")
    answers = cfg["answers"].get(body.item_id)
    if answers is None:
        raise HTTPException(status_code=404, detail="Unknown item.")

    correct = body.answer.strip().lower() in answers
    counter = cfg["counter"]

    # ── Guest: validate only, persist nothing ─────────────
    if current_user is None:
        return {"correct": correct, "solved_count": 0, "attempts": 0}

    state = await _get_or_create_state(db, current_user.id)
    flags = dict(state.flags or {})
    solved_key   = f"challenge_solved_{body.challenge_id}_{body.item_id}"
    attempts_key = f"challenge_attempts_{body.challenge_id}_{body.item_id}"

    if correct:
        # Counter moves once per distinct item, so re-answering a riddle
        # you've already solved can't farm the count up to a gate.
        if not flags.get(solved_key):
            flags[solved_key] = True
            flags[counter]    = int(flags.get(counter) or 0) + 1
        state.flags = flags
        await db.commit()
        newly = await _evaluate_all(db, current_user.id, state, source="challenge")
        return {"correct": True, "solved_count": int(flags.get(counter) or 0),
                "newly_unlocked": newly}

    attempts = int(flags.get(attempts_key) or 0) + 1
    flags[attempts_key] = attempts
    state.flags = flags
    await db.commit()
    resp = {"correct": False, "attempts": attempts,
            "solved_count": int(flags.get(counter) or 0)}
    if attempts >= cfg["hint_after_attempts"]:
        resp["hint"] = answers[0].upper()
    return resp
