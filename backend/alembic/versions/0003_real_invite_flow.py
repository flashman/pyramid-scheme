"""real invite flow — users.email, users.recruiter_id, invites table

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-28

Schema additions required for the real invite/upline flow:
  • users.email       — nullable, unique; set from invite record on registration
  • users.recruiter_id — self-FK nullable; who directly recruited this user
  • invites table      — one row per email invited; tracks token + acceptance
"""
from alembic import op
import sqlalchemy as sa

revision      = "0003"
down_revision = "0002"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    bind      = op.get_bind()
    inspector = sa.inspect(bind)
    tables    = inspector.get_table_names()

    # On a FRESH database, `users` doesn't exist yet — it will be created by
    # SQLAlchemy's create_all() in the app lifespan (which runs after migrations).
    # create_all uses the current models, so it will include email, recruiter_id,
    # and the invites table automatically.  Nothing to do here.
    if "users" not in tables:
        return

    # ── Existing database being migrated ─────────────────
    # users table exists: add the new columns and create invites.

    existing_user_cols = {c["name"] for c in inspector.get_columns("users")}

    if "email" not in existing_user_cols:
        op.add_column("users", sa.Column("email", sa.String(128), nullable=True))
        op.create_index("ix_users_email", "users", ["email"], unique=True)

    if "recruiter_id" not in existing_user_cols:
        op.add_column(
            "users",
            sa.Column("recruiter_id", sa.Integer,
                      sa.ForeignKey("users.id"), nullable=True),
        )
        op.create_index("ix_users_recruiter_id", "users", ["recruiter_id"])

    if "invites" not in tables:
        op.create_table(
            "invites",
            sa.Column("id",            sa.Integer, primary_key=True),
            sa.Column("inviter_id",    sa.Integer, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("invitee_email", sa.String(128), nullable=False),
            sa.Column("token",         sa.String(64),  nullable=False, unique=True),
            sa.Column("used_at",       sa.DateTime(timezone=True), nullable=True),
            sa.Column("invitee_id",    sa.Integer, sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at",    sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.text("now()")),
        )
        op.create_index("ix_invites_inviter_id",    "invites", ["inviter_id"])
        op.create_index("ix_invites_invitee_email", "invites", ["invitee_email"])
        op.create_index("ix_invites_token",         "invites", ["token"], unique=True)


def downgrade() -> None:
    bind      = op.get_bind()
    inspector = sa.inspect(bind)
    tables    = inspector.get_table_names()

    if "invites" in tables:
        op.drop_table("invites")

    if "users" in tables:
        cols = {c["name"] for c in inspector.get_columns("users")}
        if "recruiter_id" in cols:
            op.drop_index("ix_users_recruiter_id", table_name="users")
            op.drop_column("users", "recruiter_id")
        if "email" in cols:
            op.drop_index("ix_users_email", table_name="users")
            op.drop_column("users", "email")
