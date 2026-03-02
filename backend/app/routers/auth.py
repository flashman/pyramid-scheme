from datetime import timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState, Invite, utcnow
from app.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.auth import hash_password, verify_password, create_access_token
from app.ws import manager

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Validate username availability
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken.")

    # Resolve invite token → find inviter
    invite: Invite | None = None
    if body.invite_token:
        inv_result = await db.execute(
            select(Invite).where(
                Invite.token == body.invite_token,
                Invite.used_at.is_(None),
            )
        )
        invite = inv_result.scalar_one_or_none()
        # Silently ignore invalid/expired tokens — user can still register

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        email=invite.invitee_email if invite else (body.email or None),
        recruiter_id=invite.inviter_id if invite else None,
    )
    db.add(user)
    await db.flush()  # get user.id

    # Create empty game state
    db.add(GameState(user_id=user.id))

    # Mark invite used
    if invite:
        invite.used_at = utcnow()
        invite.invitee_id = user.id

    await db.commit()
    await db.refresh(user)

    # Notify inviter that their recruit has registered (joined, not yet bought in)
    if invite:
        await manager.send_to_user(invite.inviter_id, {
            "type": "invite_accepted",
            "email": invite.invitee_email,
            "recruit_username": user.username,
        })

    token = create_access_token(user.id, user.username)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user   = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect username or password.")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled.")

    token = create_access_token(user.id, user.username)
    return TokenResponse(access_token=token)
