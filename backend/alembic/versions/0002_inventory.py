"""inventory table

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision      = "0002"
down_revision = "0001"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.create_table(
        "inventory",
        sa.Column("id",          sa.Integer,      primary_key=True),
        sa.Column("user_id",     sa.Integer,      sa.ForeignKey("users.id"), nullable=False),
        sa.Column("item_id",     sa.String(64),   nullable=False),
        sa.Column("quantity",    sa.Integer,      nullable=False, server_default="1"),
        sa.Column("equipped",    sa.Boolean,      nullable=False, server_default=sa.false()),
        sa.Column("acquired_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("user_id", "item_id", name="uq_inventory_user_item"),
    )
    op.create_index("ix_inventory_user_id", "inventory", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_inventory_user_id", table_name="inventory")
    op.drop_table("inventory")
