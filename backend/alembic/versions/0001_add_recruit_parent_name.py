"""add parent_name to recruits

Revision ID: 0001
Revises:
Create Date: 2026-02-28

Adds the parent_name column to the recruits table so the frontend can
reconstruct the visual pyramid tree on login without replaying random
slot assignments.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tables fresh if they don't exist yet (idempotent first-run).
    # The engine's create_all in lifespan handles that; we only need to
    # handle the column addition for existing databases.
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "recruits" in inspector.get_table_names():
        existing_cols = [c["name"] for c in inspector.get_columns("recruits")]
        if "parent_name" not in existing_cols:
            op.add_column(
                "recruits",
                sa.Column("parent_name", sa.String(64), nullable=True),
            )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "recruits" in inspector.get_table_names():
        existing_cols = [c["name"] for c in inspector.get_columns("recruits")]
        if "parent_name" in existing_cols:
            op.drop_column("recruits", "parent_name")
