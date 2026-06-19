from sqlalchemy import select
from app.models import Inventory
from app.inventory import grant_item, inventory_list
from tests.conftest import TestingSessionLocal, make_user


async def test_grant_keepsake_creates_qty1_then_stays_at_1():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        await grant_item(db, uid, "scarab_amulet"); await db.commit()
        await grant_item(db, uid, "scarab_amulet"); await db.commit()  # keepsake: no stack
        row = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalar_one()
        assert row.quantity == 1


async def test_grant_consumable_stacks():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        await grant_item(db, uid, "invite_scroll"); await db.commit()
        await grant_item(db, uid, "invite_scroll"); await db.commit()
        row = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalar_one()
        assert row.quantity == 2


async def test_inventory_list_shape():
    uid = await make_user()
    async with TestingSessionLocal() as db:
        await grant_item(db, uid, "scarab_amulet"); await db.commit()
        lst = await inventory_list(db, uid)
    assert lst == [{"item_id": "scarab_amulet", "quantity": 1, "equipped": False}]
