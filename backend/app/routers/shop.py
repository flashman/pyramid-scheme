from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState, Inventory, Transaction
from app.schemas import ShopBuyRequest, ShopBuyResponse
from app.auth import get_current_user
from app.shop import get_item
from app.inventory import grant_item, inventory_list
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

    # Keepsakes are unique: reject a second purchase.
    if item["kind"] == "keepsake":
        existing = await db.execute(select(Inventory).where(
            Inventory.user_id == current_user.id, Inventory.item_id == body.item_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Already owned.")

    price = item["price"]
    if float(state.earned or 0) < price:
        raise HTTPException(status_code=400, detail="Insufficient earned credits.")

    # ── Atomic: deduct → grant inventory → ledger row, one commit ──
    state.earned = round(float(state.earned or 0) - price, 2)
    # Phase 1: consumables apply their effect on buy (use-on-demand is Phase 2).
    effect = item.get("effect") or {}
    if item["kind"] == "consumable" and effect.get("type") == "invites":
        state.invites_left = (state.invites_left or 0) + effect["amount"]

    await grant_item(db, current_user.id, body.item_id)
    db.add(Transaction(user_id=current_user.id, type="shop_buy",
                       amount=-price, ref_id=body.item_id, meta={"qty": 1}))
    try:
        await db.commit()
    except IntegrityError:
        # Concurrent keepsake buy raced past the SELECT check and hit the
        # uq_inventory_user_item constraint — surface the correct 409, not a 500.
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already owned.")

    inv = await inventory_list(db, current_user.id)

    await manager.send_to_user(current_user.id, {"type": "inventory_update", "inventory": inv})
    await manager.send_to_user(current_user.id, {
        "type": "state_update", "earned": float(state.earned), "invites_left": state.invites_left,
    })

    return ShopBuyResponse(
        ok=True, item_id=body.item_id,
        earned=float(state.earned), invites_left=state.invites_left, inventory=inv,
    )
