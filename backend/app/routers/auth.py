from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState
from app.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.auth import hash_password, verify_password, create_access_token

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check username taken
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken.")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()   # get user.id before committing

    # Create an empty game state row for this user
    db.add(GameState(user_id=user.id))
    await db.commit()
    await db.refresh(user)

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
