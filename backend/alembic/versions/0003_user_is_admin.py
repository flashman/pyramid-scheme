"""add is_admin to users, seed user 1 as admin

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-20
"""
from alembic import op
import sqlalchemy as sa

revision      = "0003"
down_revision = "0002"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # User 1 is the sole admin for now. Only flags the row if it already exists
    # (no-op on a fresh DB seeded after migration — see the dev-DB caveat).
    op.execute("UPDATE users SET is_admin = true WHERE id = 1")


def downgrade() -> None:
    op.drop_column("users", "is_admin")
