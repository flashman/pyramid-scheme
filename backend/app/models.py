from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Numeric, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


# ── User ──────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id:            Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    username:      Mapped[str]      = mapped_column(String(32), unique=True, index=True, nullable=False)
    email:         Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True, index=True)
    password_hash: Mapped[str]      = mapped_column(String(128), nullable=False)
    balance:       Mapped[float]    = mapped_column(Numeric(10, 2), default=0.0)
    is_active:     Mapped[bool]     = mapped_column(Boolean, default=True)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Self-referential FK: who directly recruited this user. Null = organic / root.
    recruiter_id:  Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    game_state:    Mapped[Optional[GameState]]   = relationship("GameState",   back_populates="user", uselist=False)
    transactions:  Mapped[list[Transaction]]     = relationship("Transaction", back_populates="user",
                                                                foreign_keys="[Transaction.user_id]")
    recruits_made: Mapped[list[Recruit]]         = relationship("Recruit",     back_populates="recruiter",
                                                                foreign_keys="[Recruit.recruiter_id]")
    events:        Mapped[list[GameEvent]]       = relationship("GameEvent",   back_populates="user")
    invites_sent:  Mapped[list[Invite]]          = relationship("Invite",      back_populates="inviter",
                                                                foreign_keys="[Invite.inviter_id]")

    recruiter: Mapped[Optional[User]] = relationship(
        "User", remote_side="User.id", foreign_keys="[User.recruiter_id]",
    )


# ── GameState ─────────────────────────────────────────────

class GameState(Base):
    __tablename__ = "game_states"

    id:           Mapped[int]            = mapped_column(Integer, primary_key=True)
    user_id:      Mapped[int]            = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    bought:       Mapped[bool]           = mapped_column(Boolean, default=False)
    invested:     Mapped[float]          = mapped_column(Numeric(10, 2), default=0.0)
    earned:       Mapped[float]          = mapped_column(Numeric(10, 2), default=0.0)
    invites_left: Mapped[int]            = mapped_column(Integer, default=0)
    flags:        Mapped[dict]           = mapped_column(JSON, default=dict)
    updated_at:   Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship("User", back_populates="game_state")


# ── Invite ────────────────────────────────────────────────

class Invite(Base):
    """One row per email invited. used_at + invitee_id are set when they register."""
    __tablename__ = "invites"

    id:            Mapped[int]           = mapped_column(Integer, primary_key=True)
    inviter_id:    Mapped[int]           = mapped_column(ForeignKey("users.id"), index=True)
    invitee_email: Mapped[str]           = mapped_column(String(128), nullable=False, index=True)
    token:         Mapped[str]           = mapped_column(String(64), unique=True, index=True, nullable=False)
    used_at:       Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    invitee_id:    Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at:    Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=utcnow)

    inviter: Mapped[User]           = relationship("User", back_populates="invites_sent",
                                                   foreign_keys="[Invite.inviter_id]")
    invitee: Mapped[Optional[User]] = relationship("User", foreign_keys="[Invite.invitee_id]")


# ── Recruit ───────────────────────────────────────────────

class Recruit(Base):
    """Created server-side during buy-in for every ancestor in the upline chain.
    meta (visual layout: pid/rootPid/zLayer/wx) is patched by the frontend after
    slot assignment via PATCH /api/recruits/{id}/meta."""
    __tablename__ = "recruits"

    id:           Mapped[int]            = mapped_column(Integer, primary_key=True)
    recruiter_id: Mapped[int]            = mapped_column(ForeignKey("users.id"), index=True)
    recruit_id:   Mapped[Optional[int]]  = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    recruit_name: Mapped[str]            = mapped_column(String(64))
    parent_name:  Mapped[Optional[str]]  = mapped_column(String(64), nullable=True)
    depth:        Mapped[int]            = mapped_column(Integer)
    payout:       Mapped[float]          = mapped_column(Numeric(10, 2))
    meta:         Mapped[dict]           = mapped_column(JSON, default=dict)
    created_at:   Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=utcnow)

    recruiter: Mapped[User] = relationship("User", back_populates="recruits_made",
                                           foreign_keys="[Recruit.recruiter_id]")


# ── Transaction ───────────────────────────────────────────

class Transaction(Base):
    __tablename__ = "transactions"

    id:         Mapped[int]           = mapped_column(Integer, primary_key=True)
    user_id:    Mapped[int]           = mapped_column(ForeignKey("users.id"), index=True)
    type:       Mapped[str]           = mapped_column(String(32))
    amount:     Mapped[float]         = mapped_column(Numeric(10, 2))
    ref_id:     Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    meta:       Mapped[dict]          = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship("User", back_populates="transactions",
                                      foreign_keys="[Transaction.user_id]")


# ── GameEvent ─────────────────────────────────────────────

class GameEvent(Base):
    __tablename__ = "game_events"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True)
    user_id:    Mapped[int]      = mapped_column(ForeignKey("users.id"), index=True)
    type:       Mapped[str]      = mapped_column(String(32))
    payload:    Mapped[dict]     = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship("User", back_populates="events")
