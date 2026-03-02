"""
Developer / simulation endpoints.
Only mounted when DEBUG=true in config.

POST /api/dev/sim-recruit
  Simulates a new user buying in through your invite chain.
  Runs the real chain-walk: creates Recruit + Transaction rows,
  pushes recruit_joined WebSocket events.  The delay means the
  WS event arrives asynchronously — identical to the real prod flow.

DELETE /api/dev/sim-users
  Removes all sim Recruit rows (those with recruit_id=NULL and
  recruit_name starting with the sim prefix).  Convenience cleanup.
"""
import asyncio
import random
import string

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db, AsyncSessionLocal
from app.models import User, Recruit
from app.chain import run_buyin_chain
from app.ws import manager

router = APIRouter()

SIM_PREFIX = "🤖 "   # visually distinct in the UI


# ── Schemas ───────────────────────────────────────────────

class SimRecruitRequest(BaseModel):
    delay_seconds: float = Field(default=4.0, ge=0, le=30)
    target_depth:  int   = Field(default=1,   ge=1, le=4)


class SimRecruitResponse(BaseModel):
    ok:           bool
    sim_name:     str
    delay_seconds: float
    message:      str


# ── Helpers ───────────────────────────────────────────────

def _random_sim_name() -> str:
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"{SIM_PREFIX}PHARAOH_{suffix}"


async def _do_sim(
    first_recruiter_id: int,
    sim_name: str,
):
    """Background task: sleep, then run the real chain walk."""
    async with AsyncSessionLocal() as db:
        ws_events = await run_buyin_chain(
            first_recruiter_id=first_recruiter_id,
            buyer_name=sim_name,
            buyer_user_id=None,   # sim has no real user row
            db=db,
        )
        await db.commit()

    for uid, event in ws_events:
        await manager.send_to_user(uid, event)


# ── Routes ────────────────────────────────────────────────

@router.post("/dev/sim-recruit", response_model=SimRecruitResponse)
async def sim_recruit(
    body: SimRecruitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Simulate a recruit buying in through your chain.

    target_depth=1  → recruit joins directly under YOU
    target_depth=2  → recruit joins under one of your existing D1 recruits,
                       so you receive a D2 payout (only works if you have ≥1 D1)
    target_depth=3+ → goes another level deeper
    """
    # Resolve the starting recruiter for the requested depth
    first_recruiter_id = current_user.id
    description        = "direct D1"

    if body.target_depth >= 2:
        # Find an existing recruit at depth (target_depth - 1) to act as intermediary.
        # We use recruit_id (the real user who was recruited) when it exists.
        # If none found, fall back to D1.
        target_child_depth = body.target_depth - 1
        result = await db.execute(
            select(Recruit)
            .where(
                Recruit.recruiter_id == current_user.id,
                Recruit.depth == target_child_depth,
                Recruit.recruit_id.isnot(None),
            )
            .order_by(Recruit.created_at.desc())
            .limit(10)
        )
        child_recruits = result.scalars().all()

        if child_recruits:
            chosen = random.choice(child_recruits)
            first_recruiter_id = chosen.recruit_id
            description = f"D{body.target_depth} (via {chosen.recruit_name})"
        else:
            description = "direct D1 (no deeper recruits found — falling back)"

    sim_name = _random_sim_name()

    # Schedule the delayed sim in a background task so this endpoint
    # returns immediately while the WS event fires after the delay.
    async def _delayed():
        await asyncio.sleep(body.delay_seconds)
        await _do_sim(first_recruiter_id, sim_name)

    asyncio.create_task(_delayed())

    return SimRecruitResponse(
        ok=True,
        sim_name=sim_name,
        delay_seconds=body.delay_seconds,
        message=f"Simulating {description} recruit '{sim_name}' in {body.delay_seconds:.0f}s…",
    )


@router.delete("/dev/sim-users", status_code=200)
async def clear_sim_recruits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove all sim Recruit rows belonging to the current user."""
    result = await db.execute(
        delete(Recruit)
        .where(
            Recruit.recruiter_id == current_user.id,
            Recruit.recruit_id.is_(None),
        )
        .returning(Recruit.id)
    )
    deleted = len(result.fetchall())
    await db.commit()
    return {"ok": True, "deleted": deleted}
