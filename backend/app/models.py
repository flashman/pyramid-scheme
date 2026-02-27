from datetime import datetime, timezone
from sqlalchemy import (
    Integer, String, Float, Boolean, DateTime,
    ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# ── User ──────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id:            Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    username:      Mapped[str]      = mapped_column(String(32), unique=True, index=True, nullable=False)
    password_hash: Mapped[str]      = mapped_column(String(128), nullable=False)
    balance:       Mapped[float]    = mapped_column(Float, default=0.0)   # liquid balance
    is_active:     Mapped[bool]     = mapped_column(Boolean, default=True)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    game_state:   "GameState"        = relationship("GameState",   back_populates="user", uselist=False)
    transactions: list["Transaction"]= relationship("Transaction", back_populates="user")
    recruits_made:list["Recruit"]    = relationship("Recruit",     back_populates="recruiter",
                                                     foreign_keys="Recruit.recruiter_id")
    events:       list["GameEvent"]  = relationship("GameEvent",   back_populates="user")


# ── GameState ─────────────────────────────────────────────
# One row per user. Stores the persisted parts of G.

class GameState(Base):
    __tablename__ = "game_states"

    id:           Mapped[int]   = mapped_column(Integer, primary_key=True)
    user_id:      Mapped[int]   = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    bought:       Mapped[bool]  = mapped_column(Boolean, default=False)
    invested:     Mapped[float] = mapped_column(Float,   default=0.0)
    earned:       Mapped[float] = mapped_column(Float,   default=0.0)
    invites_left: Mapped[int]   = mapped_column(Integer, default=0)

    # Flags stored as a JSON blob — avoids a separate flags table for now.
    # Shape: { "seven_heavens_done": true, "crypt_entered": true, ... }
    flags: Mapped[dict] = mapped_column(JSON, default=dict)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user: "User" = relationship("User", back_populates="game_state")


# ── Recruit ───────────────────────────────────────────────
# Records the tree structure needed to walk uplines for payouts.

class Recruit(Base):
    __tablename__ = "recruits"

    id:           Mapped[int]      = mapped_column(Integer, primary_key=True)
    recruiter_id: Mapped[int]      = mapped_column(ForeignKey("users.id"), index=True)
    recruit_id:   Mapped[int|None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    recruit_name: Mapped[str]      = mapped_column(String(64))   # NPC name if not a real user
    depth:        Mapped[int]      = mapped_column(Integer)
    payout:       Mapped[float]    = mapped_column(Float)
    created_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    recruiter: "User" = relationship("User", back_populates="recruits_made",
                                     foreign_keys=[recruiter_id])


# ── Transaction ───────────────────────────────────────────
# Ledger: every financial movement is recorded here.

class Transaction(Base):
    __tablename__ = "transactions"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True)
    user_id:    Mapped[int]      = mapped_column(ForeignKey("users.id"), index=True)
    type:       Mapped[str]      = mapped_column(String(32))   # 'buyin' | 'payout' | 'platform_fee'
    amount:     Mapped[float]    = mapped_column(Float)
    ref_id:     Mapped[str|None] = mapped_column(String(64), nullable=True)  # Stripe PaymentIntent id
    meta:       Mapped[dict]     = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: "User" = relationship("User", back_populates="transactions")


# ── GameEvent ─────────────────────────────────────────────
# Append-only audit log of notable in-game events.

class GameEvent(Base):
    __tablename__ = "game_events"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True)
    user_id:    Mapped[int]      = mapped_column(ForeignKey("users.id"), index=True)
    type:       Mapped[str]      = mapped_column(String(32))   # 'recruit' | 'milestone' | 'buyin'
    payload:    Mapped[dict]     = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: "User" = relationship("User", back_populates="events")
