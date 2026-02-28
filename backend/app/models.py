from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Integer, String, Float, Boolean, DateTime, ForeignKey, JSON
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
    balance:       Mapped[float]    = mapped_column(Float, default=0.0)
    is_active:     Mapped[bool]     = mapped_column(Boolean, default=True)
    created_at:    Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    game_state:    Mapped[Optional[GameState]]   = relationship("GameState",   back_populates="user", uselist=False)
    transactions:  Mapped[list[Transaction]]     = relationship("Transaction", back_populates="user")
    recruits_made: Mapped[list[Recruit]]         = relationship("Recruit",     back_populates="recruiter",
                                                                foreign_keys="[Recruit.recruiter_id]")
    events:        Mapped[list[GameEvent]]       = relationship("GameEvent",   back_populates="user")


# ── GameState ─────────────────────────────────────────────

class GameState(Base):
    __tablename__ = "game_states"

    id:           Mapped[int]            = mapped_column(Integer, primary_key=True)
    user_id:      Mapped[int]            = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    bought:       Mapped[bool]           = mapped_column(Boolean, default=False)
    invested:     Mapped[float]          = mapped_column(Float, default=0.0)
    earned:       Mapped[float]          = mapped_column(Float, default=0.0)
    invites_left: Mapped[int]            = mapped_column(Integer, default=0)
    flags:        Mapped[dict]           = mapped_column(JSON, default=dict)
    updated_at:   Mapped[datetime]       = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship("User", back_populates="game_state")


# ── Recruit ───────────────────────────────────────────────

class Recruit(Base):
    __tablename__ = "recruits"

    id:           Mapped[int]            = mapped_column(Integer, primary_key=True)
    recruiter_id: Mapped[int]            = mapped_column(ForeignKey("users.id"), index=True)
    recruit_id:   Mapped[Optional[int]]  = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    recruit_name: Mapped[str]            = mapped_column(String(64))
    parent_name:  Mapped[Optional[str]]  = mapped_column(String(64), nullable=True)
    depth:        Mapped[int]            = mapped_column(Integer)
    payout:       Mapped[float]          = mapped_column(Float)
    # Stores visual layout info needed to reconstruct pyramids on login:
    # { pid, rootPid, zLayer, wx }
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
    amount:     Mapped[float]         = mapped_column(Float)
    ref_id:     Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    meta:       Mapped[dict]          = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime]      = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship("User", back_populates="transactions")


# ── GameEvent ─────────────────────────────────────────────

class GameEvent(Base):
    __tablename__ = "game_events"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True)
    user_id:    Mapped[int]      = mapped_column(ForeignKey("users.id"), index=True)
    type:       Mapped[str]      = mapped_column(String(32))
    payload:    Mapped[dict]     = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship("User", back_populates="events")
