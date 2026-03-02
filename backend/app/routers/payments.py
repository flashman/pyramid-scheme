from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User, GameState, Recruit, Transaction
from app.schemas import BuyInRequest, BuyInResponse
from app.auth import get_current_user
from app.payout import payout_at_depth, max_pay_depth
from app.ws import manager

router = APIRouter()

INVITES_PER_BUYIN = 4


@router.post("/buy-in", response_model=BuyInResponse)
async def buy_in(
    body: BuyInRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ── Fetch / create game state ─────────────────────────
    gs_res = await db.execute(select(GameState).where(GameState.user_id == current_user.id))
    state  = gs_res.scalar_one_or_none()
    if not state:
        state = GameState(user_id=current_user.id)
        db.add(state)

    # ── Stripe path ───────────────────────────────────────
    if settings.stripe_enabled:
        client_secret = await _create_stripe_payment_intent(body.fee, current_user)
        return BuyInResponse(
            success=True, stub=False,
            message="Payment intent created — complete checkout to receive scrolls.",
            new_balance=current_user.balance,
            new_invites_left=state.invites_left,
        )

    # ── Stub path ─────────────────────────────────────────
    platform_cut = round(body.fee * (settings_platform_fee_rate(body.fee)), 2)
    upline_pool  = round(body.fee - platform_cut, 2)

    # Charge the buyer
    db.add(Transaction(
        user_id=current_user.id, type="buyin", amount=-body.fee, ref_id="stub",
        meta={"platform_cut": platform_cut, "upline_pool": upline_pool},
    ))

    rebuy = state.bought
    state.bought       = True
    state.invested     = round((state.invested or 0) + body.fee, 2)
    state.invites_left = (state.invites_left or 0) + INVITES_PER_BUYIN

    # ── Walk the upline chain and distribute payouts ──────
    # For each ancestor at chain depth d: credit balance, create Recruit + Transaction rows.
    # We collect WS events and push AFTER commit so the DB is consistent if a push fails.
    ws_events: list[tuple[int, dict]] = []

    ancestor_uid = current_user.recruiter_id
    depth        = 1
    max_depth    = max_pay_depth()

    # Track the direct parent's username for depth>1 parent_name annotation
    chain_usernames: list[str] = []

    while ancestor_uid and depth <= max_depth:
        anc_res  = await db.execute(select(User).where(User.id == ancestor_uid))
        ancestor = anc_res.scalar_one_or_none()
        if not ancestor:
            break

        payout = payout_at_depth(depth)
        if payout <= 0:
            break

        # Credit the ancestor
        ancestor.balance = round((ancestor.balance or 0) + payout, 2)

        anc_gs_res   = await db.execute(select(GameState).where(GameState.user_id == ancestor.id))
        ancestor_state = anc_gs_res.scalar_one_or_none()
        if ancestor_state:
            ancestor_state.earned = round((ancestor_state.earned or 0) + payout, 2)

        # Who introduced the new user to this ancestor? (depth-1 in chain)
        parent_name = chain_usernames[-1] if chain_usernames else None

        recruit_row = Recruit(
            recruiter_id=ancestor.id,
            recruit_id=current_user.id,
            recruit_name=current_user.username,
            parent_name=parent_name,
            depth=depth,
            payout=payout,
            meta={},   # frontend patches visual layout via PATCH /api/recruits/{id}/meta
        )
        db.add(recruit_row)

        db.add(Transaction(
            user_id=ancestor.id, type="recruit_payout", amount=payout,
            ref_id=str(current_user.id),
            meta={"recruit_name": current_user.username, "depth": depth},
        ))

        # Must flush to get recruit_row.id before appending to ws_events
        await db.flush()

        ws_events.append((ancestor.id, {
            "type":          "recruit_joined",
            "name":          current_user.username,
            "depth":         depth,
            "payout":        payout,
            "db_recruit_id": recruit_row.id,
            "parent_name":   parent_name,
        }))

        chain_usernames.append(ancestor.username)
        ancestor_uid = ancestor.recruiter_id
        depth       += 1

    await db.commit()

    # ── Push WebSocket events (after commit — best-effort) ──
    for uid, event in ws_events:
        await manager.send_to_user(uid, event)

    # Also push a state_update to the buyer so their UI reflects the new
    # invites_left immediately even if they have another tab open.
    await manager.send_to_user(current_user.id, {
        "type":         "state_update",
        "bought":       True,
        "invites_left": state.invites_left,
        "invested":     state.invested,
    })

    return BuyInResponse(
        success=True, stub=True,
        message=(
            f"[STUB] Buy-in accepted. ${platform_cut} platform fee. "
            f"${upline_pool} distributed to {len(ws_events)} upline member(s)."
        ),
        new_balance=current_user.balance,
        new_invites_left=state.invites_left,
    )


def settings_platform_fee_rate(fee: float) -> float:
    """Platform keeps the portion that isn't paid out to the upline chain."""
    from app.payout import _DEFAULT
    total_pool = sum(
        payout_at_depth(d) for d in range(1, max_pay_depth() + 1)
    )
    return max(0.0, round((fee - total_pool) / fee, 6)) if fee else 0.2


async def _create_stripe_payment_intent(amount: float, user: User) -> str:
    raise NotImplementedError("Stripe not yet enabled.")


@router.post("/stripe/webhook")
async def stripe_webhook(db: AsyncSession = Depends(get_db)):
    return {"received": True}
