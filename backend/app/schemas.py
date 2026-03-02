from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any
import re


# ── Auth ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username:     str = Field(..., min_length=3, max_length=32)
    password:     str = Field(..., min_length=6, max_length=128)
    email:        str | None = None
    invite_token: str | None = None   # hex UUID from invite link ?invite=TOKEN


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Game state ────────────────────────────────────────────

class MeResponse(BaseModel):
    username:     str
    email:        str | None
    bought:       bool
    invested:     float
    earned:       float
    invites_left: int
    flags:        dict
    balance:      float

    class Config:
        from_attributes = True


class SaveStateRequest(BaseModel):
    bought:       bool  | None = None
    invested:     float | None = None
    earned:       float | None = None
    invites_left: int   | None = None
    flags:        dict  | None = None


# ── Events ────────────────────────────────────────────────

class LogEventRequest(BaseModel):
    type:    str
    payload: dict[str, Any] = {}


# ── Invites ───────────────────────────────────────────────

class SendInviteRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=128)

    @property
    def email_lower(self) -> str:
        return self.email.strip().lower()

    def validate_email(self) -> bool:
        return bool(re.match(r"[^@]+@[^@]+\.[^@]+", self.email))


class InviteResponse(BaseModel):
    id:               int
    invitee_email:    str
    token:            str
    accepted:         bool
    created_at:       datetime
    new_invites_left: int | None = None   # populated on POST only

    class Config:
        from_attributes = True


class InviteListResponse(BaseModel):
    invites: list[InviteResponse]


# ── Recruits ──────────────────────────────────────────────

class RecruitResponse(BaseModel):
    id:          int
    name:        str
    depth:       int
    payout:      float
    parent_name: str | None
    meta:        dict[str, Any]
    created_at:  datetime

    class Config:
        from_attributes = True


class RecruitListResponse(BaseModel):
    recruits: list[RecruitResponse]


class PatchRecruitMetaRequest(BaseModel):
    """Client sends visual layout data after slot assignment."""
    pid:     str
    root_pid: str | None = None
    z_layer: int
    wx:      float


# ── Payments ──────────────────────────────────────────────

class BuyInRequest(BaseModel):
    fee: float = Field(..., gt=0)


class BuyInResponse(BaseModel):
    success:          bool
    stub:             bool
    message:          str
    new_balance:      float
    new_invites_left: int
