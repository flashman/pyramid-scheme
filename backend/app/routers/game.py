from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState, GameEvent, Recruit
from app.schemas import MeResponse, SaveStateRequest, LogEventRequest, RecruitCreate, RecruitResponse, RecruitListResponse
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


# ── GET /api/recruits ─────────────────────────────────────
# Returns all recruits the current user has made, sorted by
# creation order so the client can replay visual layout correctly.

@router.get("/recruits", response_model=RecruitListResponse)
async def list_recruits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Recruit)
        .where(Recruit.recruiter_id == current_user.id)
        .order_by(Recruit.created_at)
    )
    rows = result.scalars().all()
    return RecruitListResponse(
        recruits=[
            RecruitResponse(
                id=r.id,
                name=r.recruit_name,
                depth=r.depth,
                payout=r.payout,
                parent_name=r.parent_name,
                meta=r.meta or {},
                created_at=r.created_at,
            )
            for r in rows
        ]
    )


# ── POST /api/recruits ────────────────────────────────────
# Persist a single recruit event.  Called each time a new
# recruit joins so the record exists even if the player
# closes the tab before the periodic state save fires.

@router.post("/recruits", response_model=RecruitResponse, status_code=201)
async def create_recruit(
    body: RecruitCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rec = Recruit(
        recruiter_id=current_user.id,
        recruit_name=body.name,
        parent_name=body.parent_name,
        depth=body.depth,
        payout=body.payout,
        meta=body.meta,
    )
    db.add(rec)

    # Also update the user's earned total in game_state so /api/me stays
    # consistent even if the client never sends an explicit PUT /state.
    result = await db.execute(
        select(GameState).where(GameState.user_id == current_user.id)
    )
    state = result.scalar_one_or_none()
    if state:
        state.earned = (state.earned or 0) + body.payout
        state.invites_left = max(0, (state.invites_left or 0))

    await db.commit()
    await db.refresh(rec)

    return RecruitResponse(
        id=rec.id,
        name=rec.recruit_name,
        depth=rec.depth,
        payout=rec.payout,
        parent_name=rec.parent_name,
        meta=rec.meta or {},
        created_at=rec.created_at,
    )
