"""Admin-only operations. Gated by `get_admin_user` (User.is_admin).

Unlike /api/dev/*, these routes are NOT behind DEBUG — they run in production.
The sole admin for now is user 1 (seeded by migration 0003).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_admin_user
from app.database import get_db
from app.models import User, GameState
from app.offering import offering_code
from app.payout import PAYOUT_CONFIG
from app.routers.payments import _apply_confirmed_buyin
from app.schemas import BuyInResponse

router = APIRouter()


class LookupRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)


class LookupMatch(BaseModel):
    username: str
    bought:   bool


class LookupResponse(BaseModel):
    matches: list[LookupMatch]


@router.post("/admin/lookup", response_model=LookupResponse)
async def lookup_offering_code(
    body: LookupRequest,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve a pasted 5-emoji offering code back to the username(s) that
    produce it. The code is a lossy hash, so collisions are possible — return
    every match (with bought status) so the admin can disambiguate.
    """
    code = body.code.strip()
    rows = await db.execute(
        select(User.username, GameState.bought)
        .outerjoin(GameState, GameState.user_id == User.id)
    )
    matches = [
        LookupMatch(username=username, bought=bool(bought))
        for username, bought in rows.all()
        if offering_code(username) == code
    ]
    return LookupResponse(matches=matches)


class ConfirmBuyInRequest(BaseModel):
    username:    str  = Field(..., min_length=1, max_length=32)
    # Each call pays the upline chain once. A user buying in again is legitimate
    # (more scrolls), but it also means confirming twice double-pays the chain.
    # Guard the common first-buy double-click: refuse an already-bought user
    # unless the admin explicitly opts into a rebuy.
    allow_rebuy: bool = False


@router.post("/admin/confirm-buyin", response_model=BuyInResponse)
async def confirm_buyin(
    body: ConfirmBuyInRequest,
    _admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually confirm an out-of-band payment (e.g. Venmo) for `username`.

    Marks the buyer bought, grants scrolls, and walks the upline chain crediting
    every ancestor — the same logic the Stripe webhook will call once wired.
    """
    res   = await db.execute(select(User).where(User.username == body.username))
    buyer = res.scalar_one_or_none()
    if not buyer:
        raise HTTPException(status_code=404, detail=f"No user named '{body.username}'.")

    gs_res = await db.execute(select(GameState).where(GameState.user_id == buyer.id))
    state  = gs_res.scalar_one_or_none()
    if not state:
        state = GameState(user_id=buyer.id)
        db.add(state)

    if state.bought and not body.allow_rebuy:
        raise HTTPException(
            status_code=409,
            detail=(
                f"'{body.username}' is already bought in. Confirming again pays the "
                "upline chain a second time — resend with allow_rebuy=true only if "
                "this is a genuine second payment."
            ),
        )

    # `current_user`/`state` are the BUYER's records — _apply_confirmed_buyin
    # owns the commit and WS push; do not commit here.
    return await _apply_confirmed_buyin(
        fee=PAYOUT_CONFIG["entry_fee"],
        current_user=buyer,
        state=state,
        db=db,
        source="venmo",
    )
