"""
Astral projection REST endpoints.

GET  /api/astral/downline          — direct recruits with online presence
POST /api/astral/beckon            — email an offline recruit to come online
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.channels import channels  # noqa: F401  — imported for test patching
from app.database import get_db
from app.email import send_beckon_email
from app.models import Recruit, Transaction, User
from app.ws import manager

router = APIRouter()

GAME_URL = "https://pyramid-scheme.live"   # overridden by env in future


class BeckonRequest(BaseModel):
    target_user_id: int


@router.get("/astral/downline")
async def downline_presence(
    current_user: User  = Depends(get_current_user),
    db: AsyncSession    = Depends(get_db),
):
    """Return direct recruits (depth=1, real users only) with live presence info."""
    rows = (await db.execute(
        select(Recruit, User)
        .join(User, User.id == Recruit.recruit_id)
        .where(
            Recruit.recruiter_id == current_user.id,
            Recruit.recruit_id   != None,     # noqa: E711
            Recruit.depth        == 1,
        )
    )).all()

    result = []
    for recruit_row, user_row in rows:
        online = manager.is_connected(user_row.id)
        realm  = None
        if online:
            # Find realm from the socket metadata
            for ws in list(getattr(manager, "_conns", {}).get(user_row.id, [])):
                meta = manager.get_meta(ws)
                ch   = meta.get("channel_key")
                if ch:
                    realm = ch[1]
                    break
        result.append({
            "user_id":  user_row.id,
            "username": user_row.username,
            "online":   online,
            "realm":    realm,
        })

    return {"downline": result}


@router.post("/astral/beckon", status_code=200)
async def beckon(
    body: BeckonRequest,
    current_user: User  = Depends(get_current_user),
    db: AsyncSession    = Depends(get_db),
):
    """Email a direct recruit to come online. Rate-limited to once per hour per target."""
    # 1. Validate direct recruit relationship
    recruit_row = (await db.execute(
        select(Recruit).where(
            Recruit.recruiter_id == current_user.id,
            Recruit.recruit_id   == body.target_user_id,
            Recruit.recruit_id   != None,    # noqa: E711
            Recruit.depth        == 1,
        )
    )).scalar_one_or_none()
    if not recruit_row:
        raise HTTPException(status_code=403, detail="Not your direct recruit.")

    # 2. Rate limit: one beckon per (projector, target) per hour
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = (await db.execute(
        select(Transaction).where(
            Transaction.user_id    == current_user.id,
            Transaction.type       == "beckon",
            Transaction.ref_id     == str(body.target_user_id),
            Transaction.created_at >= one_hour_ago,
        )
    )).scalar_one_or_none()
    if recent:
        raise HTTPException(status_code=429, detail="Beckon already sent in the last hour.")

    # 3. Fetch target's email
    target_user = (await db.execute(
        select(User).where(User.id == body.target_user_id)
    )).scalar_one_or_none()
    if not target_user or not target_user.email:
        raise HTTPException(status_code=422, detail="Target has no email address.")

    # 4. Record transaction (rate-limit token)
    db.add(Transaction(
        user_id=current_user.id, type="beckon",
        ref_id=str(body.target_user_id), amount=0,
    ))
    await db.commit()

    # 5. Send email (best-effort — failure is logged, not raised)
    await send_beckon_email(
        to_email=target_user.email,
        from_username=current_user.username,
        game_url=GAME_URL,
    )

    return {"ok": True}
