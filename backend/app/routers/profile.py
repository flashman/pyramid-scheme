from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import func
from app.database import get_db
from app.models import User, GameState, Recruit
from app.schemas import (
    ChangePasswordRequest, ChangeUsernameRequest, ChangeEmailRequest,
    ProfileResponse,
)
from app.auth import get_current_user, verify_password, hash_password, create_access_token

router = APIRouter()


# ── GET /api/profile ──────────────────────────────────────

@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GameState).where(GameState.user_id == current_user.id))
    state  = result.scalar_one_or_none()

    recruit_count_res = await db.execute(
        select(func.count()).where(Recruit.recruiter_id == current_user.id)
    )
    recruit_count = recruit_count_res.scalar() or 0

    return ProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        balance=float(current_user.balance or 0),
        earned=float(state.earned or 0) if state else 0.0,
        invested=float(state.invested or 0) if state else 0.0,
        recruits=recruit_count,
        created_at=current_user.created_at,
    )


# ── PATCH /api/profile/password ───────────────────────────

@router.patch("/profile/password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password.")

    current_user.password_hash = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}


# ── PATCH /api/profile/username ───────────────────────────

@router.patch("/profile/username")
async def change_username(
    body: ChangeUsernameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    new_username = body.new_username.strip()

    if new_username == current_user.username:
        raise HTTPException(status_code=400, detail="That is already your username.")

    # Check availability
    result = await db.execute(select(User).where(User.username == new_username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken.")

    current_user.username = new_username
    await db.commit()

    # Issue a new token so the embedded username claim is up to date.
    new_token = create_access_token(current_user.id, new_username)
    return {"ok": True, "new_token": new_token, "username": new_username}


# ── PATCH /api/profile/email ──────────────────────────────

@router.patch("/profile/email")
async def change_email(
    body: ChangeEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    new_email = body.new_email.strip().lower() if body.new_email else None

    if new_email == current_user.email:
        raise HTTPException(status_code=400, detail="That is already your email address.")

    if new_email:
        # Check uniqueness
        result = await db.execute(select(User).where(User.email == new_email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use by another account.")

    current_user.email = new_email
    await db.commit()
    return {"ok": True, "email": new_email}
