"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-02

Squashed from the original 0001–0003 migrations.
Creates the full schema from scratch:
  • users              (id, username, email, password_hash, balance, is_active,
                        created_at, recruiter_id)
  • game_states        (id, user_id, bought, invested, earned, invites_left,
                        flags, updated_at)
  • invites            (id, inviter_id, invitee_email, token, used_at,
                        invitee_id, created_at)
  • recruits           (id, recruiter_id, recruit_id, recruit_name, parent_name,
                        depth, payout, meta, created_at)
  • transactions       (id, user_id, type, amount, ref_id, meta, created_at)
  • game_events        (id, user_id, type, payload, created_at)

Money columns (balance, invested, earned, payout, amount) use NUMERIC(10, 2)
to avoid floating-point rounding issues.
"""

from alembic import op
import sqlalchemy as sa

revision      = "0001"
down_revision = None
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id",            sa.Integer,       primary_key=True),
        sa.Column("username",      sa.String(32),    nullable=False),
        sa.Column("email",         sa.String(128),   nullable=True),
        sa.Column("password_hash", sa.String(128),   nullable=False),
        sa.Column("balance",       sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("is_active",     sa.Boolean(),     nullable=False, server_default="true"),
        sa.Column("created_at",    sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
        sa.Column("recruiter_id",  sa.Integer,       sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_users_id",           "users", ["id"],       unique=False)
    op.create_index("ix_users_username",     "users", ["username"], unique=True)
    op.create_index("ix_users_email",        "users", ["email"],    unique=True)
    op.create_index("ix_users_recruiter_id", "users", ["recruiter_id"])

    # ── game_states ───────────────────────────────────────
    op.create_table(
        "game_states",
        sa.Column("id",           sa.Integer,        primary_key=True),
        sa.Column("user_id",      sa.Integer,        sa.ForeignKey("users.id"), nullable=False),
        sa.Column("bought",       sa.Boolean(),      nullable=False, server_default="false"),
        sa.Column("invested",     sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("earned",       sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("invites_left", sa.Integer(),      nullable=False, server_default="0"),
        sa.Column("flags",        sa.JSON(),         nullable=True,  server_default=sa.text("'{}'")),
        sa.Column("updated_at",   sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_game_states_user_id", "game_states", ["user_id"], unique=True)

    # ── invites ───────────────────────────────────────────
    op.create_table(
        "invites",
        sa.Column("id",            sa.Integer,      primary_key=True),
        sa.Column("inviter_id",    sa.Integer,      sa.ForeignKey("users.id"), nullable=False),
        sa.Column("invitee_email", sa.String(128),  nullable=False),
        sa.Column("token",         sa.String(64),   nullable=False),
        sa.Column("used_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("invitee_id",    sa.Integer,      sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_invites_inviter_id",    "invites", ["inviter_id"])
    op.create_index("ix_invites_invitee_email", "invites", ["invitee_email"])
    op.create_index("ix_invites_token",         "invites", ["token"], unique=True)

    # ── recruits ──────────────────────────────────────────
    op.create_table(
        "recruits",
        sa.Column("id",           sa.Integer,        primary_key=True),
        sa.Column("recruiter_id", sa.Integer,        sa.ForeignKey("users.id"), nullable=False),
        sa.Column("recruit_id",   sa.Integer,        sa.ForeignKey("users.id"), nullable=True),
        sa.Column("recruit_name", sa.String(64),     nullable=False),
        sa.Column("parent_name",  sa.String(64),     nullable=True),
        sa.Column("depth",        sa.Integer(),      nullable=False),
        sa.Column("payout",       sa.Numeric(10, 2), nullable=False),
        sa.Column("meta",         sa.JSON(),         nullable=True, server_default=sa.text("'{}'")),
        sa.Column("created_at",   sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_recruits_recruiter_id", "recruits", ["recruiter_id"])
    op.create_index("ix_recruits_recruit_id",   "recruits", ["recruit_id"])

    # ── transactions ──────────────────────────────────────
    op.create_table(
        "transactions",
        sa.Column("id",         sa.Integer,        primary_key=True),
        sa.Column("user_id",    sa.Integer,        sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type",       sa.String(32),     nullable=False),
        sa.Column("amount",     sa.Numeric(10, 2), nullable=False),
        sa.Column("ref_id",     sa.String(64),     nullable=True),
        sa.Column("meta",       sa.JSON(),         nullable=True, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"])

    # ── game_events ───────────────────────────────────────
    op.create_table(
        "game_events",
        sa.Column("id",         sa.Integer,  primary_key=True),
        sa.Column("user_id",    sa.Integer,  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type",       sa.String(32), nullable=False),
        sa.Column("payload",    sa.JSON(),   nullable=True, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index("ix_game_events_user_id", "game_events", ["user_id"])


def downgrade() -> None:
    op.drop_table("game_events")
    op.drop_table("transactions")
    op.drop_table("recruits")
    op.drop_table("invites")
    op.drop_table("game_states")
    op.drop_table("users")
