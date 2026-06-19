"""Inventory mutation + read helpers. Operate on a session; never commit
(callers commit so the deduction + grant + ledger row stay atomic)."""
from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Inventory


async def grant_item(db: AsyncSession, user_id: int, item_id: str) -> Inventory:
    """Grant a keepsake the player holds (qty 1). Idempotent if already owned.

    Only keepsakes are inventoried — consumables are effect-only (applied at
    purchase, recorded in the ledger) and never create a row. The `quantity`
    column stays 1 in this flavor-true model. Does NOT commit."""
    res = await db.execute(select(Inventory).where(
        Inventory.user_id == user_id, Inventory.item_id == item_id))
    row = res.scalar_one_or_none()
    if row is None:
        row = Inventory(user_id=user_id, item_id=item_id, quantity=1)
        db.add(row)
    return row


async def inventory_list(db: AsyncSession, user_id: int) -> list[dict]:
    """Client-safe inventory: [{item_id, quantity, equipped}]."""
    res = await db.execute(select(Inventory).where(Inventory.user_id == user_id))
    return [{"item_id": r.item_id, "quantity": r.quantity, "equipped": r.equipped}
            for r in res.scalars().all()]
