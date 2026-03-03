from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState, GameEvent, Recruit
from app.schemas import (
    MeResponse, SaveStateRequest, LogEventRequest,
    RecruitResponse, RecruitListResponse, PatchRecruitMetaRequest,
)
from app.auth import get_current_user

router = APIRouter()


# ── GET /api/me ───────────────────────────────────────────

@router.get("/me", response_model=MeResponse)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GameState).where(GameState.user_id == current_user.id))
    state  = result.scalar_one_or_none()
    if not state:
        state = GameState(user_id=current_user.id)
        db.add(state)
        await db.commit()
        await db.refresh(state)

    return MeResponse(
        username=current_user.username,
        email=current_user.email,
        bought=state.bought,
        invested=state.invested,
        earned=state.earned,
        invites_left=state.invites_left,
        flags=state.flags or {},
        balance=current_user.balance,
    )


# ── PUT /api/state ────────────────────────────────────────

@router.put("/state")
async def save_state(
    body: SaveStateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GameState).where(GameState.user_id == current_user.id))
    state  = result.scalar_one_or_none()
    if not state:
        state = GameState(user_id=current_user.id)
        db.add(state)

    # Only flags are client-settable. bought / earned / invites_left are
    # mutated server-side only (buy-in flow, chain walk).
    if body.flags is not None:
        state.flags = {**(state.flags or {}), **body.flags}

    await db.commit()
    return {"ok": True}


# ── GET /api/config ───────────────────────────────────────
# Single source of truth for payout parameters.
# Frontend reads from here instead of duplicating the values locally.

@router.get("/config")
async def get_config():
    from app.payout import PAYOUT_CONFIG
    return {"payout": PAYOUT_CONFIG}


# ── POST /api/event ───────────────────────────────────────

@router.post("/event")
async def log_event(
    body: LogEventRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ALLOWED = {"buyin", "recruit", "milestone", "flag_change", "realm_enter"}
    if body.type not in ALLOWED:
        raise HTTPException(status_code=400, detail=f"Unknown event type: {body.type}")

    db.add(GameEvent(user_id=current_user.id, type=body.type, payload=body.payload))
    await db.commit()
    return {"ok": True}


# ── GET /api/recruits ─────────────────────────────────────

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
    return RecruitListResponse(recruits=[
        RecruitResponse(
            id=r.id, name=r.recruit_name, depth=r.depth, payout=r.payout,
            parent_name=r.parent_name, meta=r.meta or {}, created_at=r.created_at,
        )
        for r in rows
    ])


# ── PATCH /api/recruits/{id}/meta ─────────────────────────
# Client sends visual layout data (wx, pid, zLayer) after slot assignment.

@router.patch("/recruits/{recruit_id}/meta")
async def patch_recruit_meta(
    recruit_id: int,
    body: PatchRecruitMetaRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Recruit).where(
            Recruit.id == recruit_id,
            Recruit.recruiter_id == current_user.id,
        )
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recruit not found.")

    rec.meta = {
        "pid":     body.pid,
        "rootPid": body.root_pid,
        "zLayer":  body.z_layer,
        "wx":      body.wx,
    }
    await db.commit()
    return {"ok": True}
