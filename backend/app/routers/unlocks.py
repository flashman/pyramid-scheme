"""
Server-authoritative realm unlocks — two generic routes.

Realm ids never appear in a URL path. The server already holds everything
needed to decide what a player has opened, so the unlock route takes no
realm argument at all; the challenge route names its challenge in the body.

POST /api/unlocks/evaluate
  Re-evaluate every rule in REALM_CATALOGUE against server-visible state and
  grant whatever is now satisfied. Takes no arguments — every input a rule
  reads is server-owned (written by /api/progress and /api/challenge below),
  so there is nothing a caller could usefully tell us. Idempotent, and no
  oracle: a caller learns only its own unlock set.

  The grant paths already evaluate inline; this route is the reconcile net
  for a client that has drifted (fresh login, missed WS event, a rule whose
  dependency chain became satisfiable out of band).

POST /api/challenge  {challenge_id, item_id, answer}
  Validate against CHALLENGE_CONFIG. On first solve of an item, increment
  the configured server-owned counter, then run the same evaluation pass.
  Hint (the answer) only after the configured attempt threshold.
  Auth is optional: guests get validation only, nothing persisted.

POST /api/progress  {step_id, item_id?}
  Record a quest step from STEP_CONFIG after checking its preconditions,
  then run the same evaluation pass. The flags these steps write are
  server-owned, which is what stops the unlock rules that read them from
  being decorative.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user, get_optional_user
from app.challenges import CHALLENGE_CONFIG
from app.database import get_db
from app.models import User, GameState
from app.realms import (
    REALM_CATALOGUE, d1_recruit_count, grant_realm, invalidate_unlock_cache,
    rule_satisfied, unlocked_realm_ids,
)
from app.steps import STEP_CONFIG

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


async def _evaluate_all(db: AsyncSession, user_id: int, *, bought: bool,
                        flags: dict, source: str) -> list[str]:
    """Grant every rule-based realm whose rule now passes. Loops to a
    fixpoint so a chain (vault → atlantis → deep) opens in one call when
    the state warrants it. Returns the newly granted ids.

    Takes `bought`/`flags` by value rather than a GameState: callers run
    this after a commit, and reading an ORM attribute there would depend
    on the session's expire_on_commit setting."""
    invalidate_unlock_cache(user_id)
    unlocked = set(await unlocked_realm_ids(db, user_id))
    d1       = await d1_recruit_count(db, user_id)
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
            if rule_satisfied(rule, unlocked=unlocked, bought=bought,
                              flags=flags, d1_recruits=d1):
                if await grant_realm(db, user_id, realm_id, source=source):
                    newly.append(realm_id)
                unlocked.add(realm_id)
                changed = True
    return newly


# ── POST /api/unlocks/evaluate ────────────────────────────

@router.post("/unlocks/evaluate")
async def evaluate_unlocks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await _get_or_create_state(db, current_user.id)
    newly = await _evaluate_all(db, current_user.id, bought=state.bought,
                                flags=state.flags or {}, source="evaluate")
    unlocked = await unlocked_realm_ids(db, current_user.id)
    return {"ok": True, "unlocked": sorted(unlocked), "newly_unlocked": newly}


# ── POST /api/progress ────────────────────────────────────

class ProgressRequest(BaseModel):
    step_id: str
    item_id: str | None = None


@router.post("/progress")
async def record_step(
    body: ProgressRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cfg = STEP_CONFIG.get(body.step_id)
    if cfg is None:
        raise HTTPException(status_code=404, detail="Unknown step.")

    items = cfg.get("items")
    if items is not None and body.item_id not in items:
        raise HTTPException(status_code=404, detail="Unknown step item.")

    state    = await _get_or_create_state(db, current_user.id)
    flags    = dict(state.flags or {})
    bought   = state.bought
    unlocked = await unlocked_realm_ids(db, current_user.id)

    # The server can't watch the player walk to the stele, but it can refuse
    # a step whose prerequisites aren't met — which forces the chain in order.
    if not rule_satisfied(cfg.get("requires", {}), unlocked=unlocked,
                          bought=bought, flags=flags,
                          d1_recruits=await d1_recruit_count(db, current_user.id)):
        raise HTTPException(status_code=403)

    if items is not None:
        item_flag = cfg["item_flag"].format(item=body.item_id)
        if not flags.get(item_flag):
            flags[item_flag]   = True
            flags[cfg["counter"]] = int(flags.get(cfg["counter"]) or 0) + 1
    else:
        flags[cfg["sets_flag"]] = True

    state.flags = flags
    await db.commit()

    newly = await _evaluate_all(db, current_user.id, bought=bought,
                                flags=flags, source="progress")
    resp = {"ok": True, "step": body.step_id, "newly_unlocked": newly}
    if items is not None:
        resp["count"] = int(flags.get(cfg["counter"]) or 0)
    return resp


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
    item = cfg["items"].get(body.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Unknown item.")

    answers = item["answers"]
    correct = body.answer.strip().lower() in answers
    counter = cfg["counter"]

    # ── Guest: validate only, persist nothing ─────────────
    if current_user is None:
        resp = {"correct": correct, "solved_count": 0, "attempts": 0}
        if correct:
            resp["response"] = item["response"]
        return resp

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
        bought = state.bought
        await db.commit()
        newly = await _evaluate_all(db, current_user.id, bought=bought,
                                    flags=flags, source="challenge")
        return {"correct": True, "solved_count": int(flags.get(counter) or 0),
                "response": item["response"], "newly_unlocked": newly}

    attempts = int(flags.get(attempts_key) or 0) + 1
    flags[attempts_key] = attempts
    state.flags = flags
    await db.commit()
    resp = {"correct": False, "attempts": attempts,
            "solved_count": int(flags.get(counter) or 0)}
    # The sphinx's mercy: after enough failures it just tells you, and the
    # lore response comes with it.
    if attempts >= cfg["hint_after_attempts"]:
        resp["hint"]     = answers[0].upper()
        resp["response"] = item["response"]
    return resp
