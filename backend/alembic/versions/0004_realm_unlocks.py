"""user_realm_unlocks table + backfill grants from game_states.flags

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa

revision      = "0004"
down_revision = "0003"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.create_table(
        "user_realm_unlocks",
        sa.Column("user_id", sa.Integer(),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("realm_id", sa.String(32), primary_key=True),
        sa.Column("granted_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column("source", sa.String(32), nullable=False, server_default=""),
    )

    # ── Backfill grants from existing flags so no player regresses ──
    # `world` is default_unlocked in REALM_CATALOGUE and never gets rows.
    # JSON ->> operators are postgres-only; tests use create_all, not alembic.
    if op.get_bind().dialect.name != "postgresql":
        return

    # nile + oasis: any invite sent, any recruit, or the legacy gate flag.
    op.execute("""
        INSERT INTO user_realm_unlocks (user_id, realm_id, source)
        SELECT u.id, r.realm_id, 'backfill'
        FROM users u
        CROSS JOIN (VALUES ('nile'), ('oasis')) AS r(realm_id)
        WHERE EXISTS (SELECT 1 FROM invites i WHERE i.inviter_id = u.id)
           OR EXISTS (SELECT 1 FROM recruits rc WHERE rc.recruiter_id = u.id)
           OR EXISTS (SELECT 1 FROM game_states gs WHERE gs.user_id = u.id
                      AND gs.flags->>'first_scroll_sent' = 'true')
        ON CONFLICT DO NOTHING
    """)

    # vault: at least one sphinx riddle solved, or the stele already read.
    # The counter is client-written historically — treat any non-zero,
    # non-false value as "solved at least one".
    op.execute("""
        INSERT INTO user_realm_unlocks (user_id, realm_id, source)
        SELECT gs.user_id, 'vault', 'backfill'
        FROM game_states gs
        WHERE COALESCE(gs.flags->>'sphinx_riddles_solved', '0')
                  NOT IN ('0', 'false', 'null', '')
           OR gs.flags->>'stele_read' = 'true'
        ON CONFLICT DO NOTHING
    """)

    # Simple flag → realm backfills.
    for flag, realm in [
        ("crypt_open",             "chamber"),
        ("cosmic_upline_done",     "council"),
        ("atlantis_vault_opened",  "atlantis"),
        ("atlantis_statue_risen",  "atlantis"),
        ("atlantis_crack_visible", "deep"),
    ]:
        op.execute(f"""
            INSERT INTO user_realm_unlocks (user_id, realm_id, source)
            SELECT gs.user_id, '{realm}', 'backfill'
            FROM game_states gs
            WHERE gs.flags->>'{flag}' = 'true'
            ON CONFLICT DO NOTHING
        """)


def downgrade() -> None:
    op.drop_table("user_realm_unlocks")
