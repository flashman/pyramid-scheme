"""add meta + parent_name to recruits

Revision ID: 0002
Revises: 0001
Create Date: 2026-02-28

Adds a JSON `meta` column to recruits (stores visual layout data: pid,
rootPid, zLayer, wx) so the frontend can reconstruct the pyramid scene on
login without re-running random slot assignments.

parent_name was added by 0001; this migration makes it safe to run on
databases that skipped 0001 by checking for its existence first.
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "recruits" not in inspector.get_table_names():
        return   # table will be created fresh by create_all; columns included

    existing_cols = {c["name"] for c in inspector.get_columns("recruits")}

    if "parent_name" not in existing_cols:
        op.add_column("recruits", sa.Column("parent_name", sa.String(64), nullable=True))

    if "meta" not in existing_cols:
        # server_default for JSON must be a SQL text expression, not a plain
        # Python string — otherwise SQLAlchemy wraps it in extra quotes.
        op.add_column("recruits", sa.Column("meta", sa.JSON, nullable=True,
                                            server_default=sa.text("'{}'")))



def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "recruits" not in inspector.get_table_names():
        return
    existing_cols = {c["name"] for c in inspector.get_columns("recruits")}
    if "meta" in existing_cols:
        op.drop_column("recruits", "meta")
