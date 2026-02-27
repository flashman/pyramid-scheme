from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState, GameEvent
from app.schemas import MeResponse, SaveStateRequest, LogEventRequest
from app.auth import get_current_user

router = APIRouter()


# ── GET /api/me ───────────────────────────────────────────
# Returns the current user's identity + saved game state.

@router.get("/me", response_model=MeResponse)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GameState).where(GameState.user_id == current_user.id)
    )
    state = result.scalar_one_or_none()

    if not state:
        # Should have been created on register, but create defensively
        state = GameState(user_id=current_user.id)
        db.add(state)
        await db.commit()
        await db.refresh(state)

    return MeResponse(
        username=current_user.username,
        bought=state.bought,
        invested=state.invested,
        earned=state.earned,
        invites_left=state.invites_left,
        flags=state.flags or {},
        balance=current_user.balance,
    )


# ── PUT /api/state ────────────────────────────────────────
# Upsert the player's saved game state.
# Only fields explicitly sent are updated (None = skip).

@router.put("/state")
async def save_state(
    body: SaveStateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GameState).where(GameState.user_id == current_user.id)
    )
    state = result.scalar_one_or_none()
    if not state:
        state = GameState(user_id=current_user.id)
        db.add(state)

    if body.bought       is not None: state.bought       = body.bought
    if body.invested     is not None: state.invested     = body.invested
    if body.earned       is not None: state.earned       = body.earned
    if body.invites_left is not None: state.invites_left = body.invites_left
    if body.flags        is not None:
        # Merge flags rather than replace — avoids clobbering unsent keys
        merged = {**(state.flags or {}), **body.flags}
        state.flags = merged

    await db.commit()
    return {"ok": True}


# ── POST /api/event ───────────────────────────────────────
# Append-only event log. Used for recruits, milestones, etc.

@router.post("/event")
async def log_event(
    body: LogEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ALLOWED_TYPES = {"buyin", "recruit", "milestone", "flag_change", "realm_enter"}
    if body.type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown event type: {body.type}")

    event = GameEvent(
        user_id=current_user.id,
        type=body.type,
        payload=body.payload,
    )
    db.add(event)
    await db.commit()
    return {"ok": True}
