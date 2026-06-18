from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState
from app.schemas import ShopBuyRequest, ShopBuyResponse
from app.auth import get_current_user
from app.shop import get_item
from app.ws import manager

router = APIRouter()


@router.post("/shop/buy", response_model=ShopBuyResponse)
async def buy_item(
    body: ShopBuyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = get_item(body.item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Unknown item: {body.item_id}")

    res   = await db.execute(select(GameState).where(GameState.user_id == current_user.id))
    state = res.scalar_one_or_none()
    if not state:
        state = GameState(user_id=current_user.id)
        db.add(state)

    owned_key = f"shop_owned_{body.item_id}"
    flags     = dict(state.flags or {})

    if item["kind"] == "keepsake" and flags.get(owned_key):
        raise HTTPException(status_code=409, detail="Already owned.")

    price = item["price"]
    if float(state.earned or 0) < price:
        raise HTTPException(status_code=400, detail="Insufficient earned credits.")

    # ── Atomic: deduct, then apply ownership/effect, one commit ──
    state.earned = round(float(state.earned or 0) - price, 2)
    if item["kind"] == "consumable":
        if item["effect"]["type"] == "invites":
            state.invites_left = (state.invites_left or 0) + item["effect"]["amount"]
    else:
        flags[owned_key] = True
        state.flags = flags

    await db.commit()
    await db.refresh(state)

    owned = [k[len("shop_owned_"):] for k, v in (state.flags or {}).items()
             if k.startswith("shop_owned_") and v]

    # Reconcile other tabs.
    await manager.send_to_user(current_user.id, {
        "type":         "state_update",
        "earned":       float(state.earned),
        "invites_left": state.invites_left,
    })

    return ShopBuyResponse(
        ok=True, item_id=body.item_id,
        earned=float(state.earned), invites_left=state.invites_left, owned=owned,
    )
