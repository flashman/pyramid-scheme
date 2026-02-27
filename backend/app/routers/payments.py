from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User, GameState, Transaction
from app.schemas import BuyInRequest, BuyInResponse
from app.auth import get_current_user

router = APIRouter()

INVITES_PER_BUYIN = 4
PLATFORM_FEE_RATE = 0.20   # 20% kept by platform; rest flows up upline


# ── POST /api/buy-in ──────────────────────────────────────

@router.post("/buy-in", response_model=BuyInResponse)
async def buy_in(
    body: BuyInRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # ── Fetch or create game state ──────────────────────
    result = await db.execute(
        select(GameState).where(GameState.user_id == current_user.id)
    )
    state = result.scalar_one_or_none()
    if not state:
        state = GameState(user_id=current_user.id)
        db.add(state)

    # ── Real Stripe path (disabled until stripe_enabled = True) ──
    if settings.stripe_enabled:
        client_secret = await _create_stripe_payment_intent(body.fee, current_user)
        # Actual crediting happens in the webhook handler once payment confirms.
        return BuyInResponse(
            success=True,
            stub=False,
            client_secret=client_secret,
            message="Payment intent created — complete checkout to receive scrolls.",
            new_balance=current_user.balance,
            new_invites_left=state.invites_left,
        )

    # ── Stub path (stripe_enabled = False) ───────────────
    # Simulate immediate success so the full code path is exercised.
    platform_cut  = round(body.fee * PLATFORM_FEE_RATE, 2)
    upline_pool   = round(body.fee - platform_cut, 2)

    # Record the buy-in transaction
    db.add(Transaction(
        user_id=current_user.id,
        type="buyin",
        amount=-body.fee,           # debit from player
        ref_id="stub",
        meta={"platform_cut": platform_cut, "upline_pool": upline_pool},
    ))

    # Record platform fee
    db.add(Transaction(
        user_id=current_user.id,
        type="platform_fee",
        amount=platform_cut,
        ref_id="stub",
    ))

    # Update game state
    state.bought        = True
    state.invested      = (state.invested or 0) + body.fee
    state.invites_left  = (state.invites_left or 0) + INVITES_PER_BUYIN

    await db.commit()
    await db.refresh(state)

    return BuyInResponse(
        success=True,
        stub=True,
        message=f"[STUB] Buy-in accepted. ${platform_cut} platform fee. ${upline_pool} flows up upline.",
        new_balance=current_user.balance,
        new_invites_left=state.invites_left,
    )


# ── Stripe helper (placeholder) ───────────────────────────

async def _create_stripe_payment_intent(amount: float, user: User) -> str:
    """
    TODO: replace with real Stripe call when stripe_enabled = True.

    import stripe
    stripe.api_key = settings.stripe_secret_key
    intent = stripe.PaymentIntent.create(
        amount=int(amount * 100),   # Stripe uses cents
        currency="usd",
        metadata={"user_id": str(user.id)},
    )
    return intent.client_secret
    """
    raise NotImplementedError("Stripe not yet enabled.")


# ── POST /api/stripe/webhook ──────────────────────────────
# Receives Stripe events (payment_intent.succeeded, etc.)
# and credits the user's account after confirmed payment.

@router.post("/stripe/webhook")
async def stripe_webhook(
    # request: Request,   # uncomment when implementing — needs raw body for sig verification
    db: AsyncSession = Depends(get_db),
):
    """
    TODO: implement when Stripe is enabled.

    1. Verify webhook signature with settings.stripe_webhook_secret
    2. Handle payment_intent.succeeded:
       - Look up user_id from metadata
       - Credit invites + update GameState
       - Record Transaction
       - Trigger upline payout distribution
    """
    return {"received": True}
