import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.models import Inventory
from tests.conftest import TestingSessionLocal, make_user


async def test_inventory_row_roundtrips_and_is_unique_per_user_item():
    uid = await make_user(earned=0)
    async with TestingSessionLocal() as db:
        db.add(Inventory(user_id=uid, item_id="scarab_amulet", quantity=1))
        await db.commit()
    async with TestingSessionLocal() as db:
        row = (await db.execute(select(Inventory).where(Inventory.user_id == uid))).scalar_one()
        assert row.item_id == "scarab_amulet"
        assert row.quantity == 1
        assert row.equipped is False
    # duplicate (user_id, item_id) is rejected
    with pytest.raises(IntegrityError):
        async with TestingSessionLocal() as db:
            db.add(Inventory(user_id=uid, item_id="scarab_amulet", quantity=1))
            await db.commit()
