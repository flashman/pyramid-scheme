from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any


# ── Auth ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=6, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Game state ────────────────────────────────────────────

class MeResponse(BaseModel):
    username:    str
    bought:      bool
    invested:    float
    earned:      float
    invites_left:int
    flags:       dict
    balance:     float

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


# ── Recruits ──────────────────────────────────────────────

class RecruitCreate(BaseModel):
    name:        str
    depth:       int
    payout:      float
    parent_name: str | None = None
    # Visual layout data so the client can reconstruct pyramids on next login
    meta:        dict[str, Any] = {}   # { pid, rootPid, zLayer, wx }


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




class BuyInRequest(BaseModel):
    fee: float = Field(..., gt=0)


class BuyInResponse(BaseModel):
    success:           bool
    stub:              bool
    client_secret:     str | None = None   # populated when Stripe is live
    message:           str
    new_balance:       float
    new_invites_left:  int
