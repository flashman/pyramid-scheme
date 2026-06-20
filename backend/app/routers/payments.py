from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User, GameState, Transaction
from app.schemas import BuyInRequest, BuyInResponse
from app.auth import get_current_user
from app.chain import run_buyin_chain
from app.payout import payout_at_depth, max_pay_depth, PAYOUT_CONFIG
from app.ws import manager

router = APIRouter()

INVITES_PER_BUYIN = 4


@router.post("/buy-in", response_model=BuyInResponse)
async def buy_in(
    body: BuyInRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Reject any fee that doesn't match the server-authoritative entry cost.
    # This prevents clients from submitting an arbitrarily low fee.
    expected_fee = PAYOUT_CONFIG["entry_fee"]
    if round(body.fee, 2) != expected_fee:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid fee. Expected {expected_fee}.",
        )
    gs_res = await db.execute(select(GameState).where(GameState.user_id == current_user.id))
    state  = gs_res.scalar_one_or_none()
    if not state:
        state = GameState(user_id=current_user.id)
        db.add(state)

    if settings.stripe_enabled:
        await _create_stripe_payment_intent(body.fee, current_user)
        return BuyInResponse(
            success=True, stub=False,
            message="Payment intent created — complete checkout to receive scrolls.",
            new_balance=current_user.balance,
            new_invites_left=state.invites_left,
        )

    # Stripe not yet wired — block self-grant until payment is confirmed externally.
    raise HTTPException(
        status_code=503,
        detail="Payment processing is not yet enabled. The gods are still being consulted.",
    )


async def _create_stripe_payment_intent(amount: float, user: User) -> str:
    raise NotImplementedError("Stripe not yet enabled.")


async def _apply_confirmed_buyin(
    fee: float,
    current_user: User,
    state: GameState,
    db: AsyncSession,
) -> BuyInResponse:
    """Apply a verified payment to a user's account and walk the upline chain.

    Call this from the Stripe webhook handler after signature verification,
    or from any future manual-grant admin endpoint.
    """
    total_pool   = sum(payout_at_depth(d) for d in range(1, max_pay_depth() + 1))
    platform_cut = round(fee - total_pool, 2)

    db.add(Transaction(
        user_id=current_user.id, type="buyin", amount=-fee, ref_id="stripe",
        meta={"platform_cut": platform_cut, "upline_pool": round(total_pool, 2)},
    ))

    state.bought       = True
    state.invested     = round((state.invested or 0) + fee, 2)
    state.invites_left = (state.invites_left or 0) + INVITES_PER_BUYIN

    ws_events: list = []
    if current_user.recruiter_id:
        ws_events = await run_buyin_chain(
            first_recruiter_id=current_user.recruiter_id,
            buyer_name=current_user.username,
            buyer_user_id=current_user.id,
            db=db,
        )

    await db.commit()

    for uid, event in ws_events:
        await manager.send_to_user(uid, event)

    await manager.send_to_user(current_user.id, {
        "type":         "state_update",
        "bought":       True,
        "invites_left": state.invites_left,
        "invested":     state.invested,
    })

    return BuyInResponse(
        success=True, stub=False,
        message=(
            f"Buy-in confirmed. ${platform_cut} platform fee. "
            f"${total_pool} distributed to {len(ws_events)} upline member(s)."
        ),
        new_balance=current_user.balance,
        new_invites_left=state.invites_left,
    )


@router.post("/stripe/webhook")
async def stripe_webhook(db: AsyncSession = Depends(get_db)):
    # TODO (before enabling Stripe): verify the webhook signature.
    # Without this, anyone can POST fake payment events.
    # Use stripe.WebhookEvent.construct_from(await request.body(), STRIPE_WEBHOOK_SECRET)
    # and return 400 on signature failure.
    return {"received": True}
