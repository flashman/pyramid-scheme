import uuid
import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User, GameState, Invite
from app.schemas import SendInviteRequest, InviteResponse, InviteListResponse
from app.auth import get_current_user
from app.email import send_invite_email
from app.config import settings

router = APIRouter()

_EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


@router.post("/invites", response_model=InviteResponse, status_code=201)
async def send_invite(
    body: SendInviteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Invalid email address.")

    # Must have bought in to have scrolls
    gs_res = await db.execute(select(GameState).where(GameState.user_id == current_user.id))
    state  = gs_res.scalar_one_or_none()
    if not state or not state.bought:
        raise HTTPException(status_code=400, detail="Buy in before sending invites.")
    if state.invites_left <= 0:
        raise HTTPException(status_code=400, detail="No invite scrolls remaining.")

    # Duplicate invite guard
    dup = await db.execute(
        select(Invite).where(
            Invite.inviter_id == current_user.id,
            Invite.invitee_email == email,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already sent a scroll to that address.")

    # Guard against inviting someone already registered
    taken = await db.execute(select(User).where(User.email == email))
    if taken.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="That email already has an account.")

    # Create invite record and decrement scroll count
    token  = uuid.uuid4().hex
    invite = Invite(inviter_id=current_user.id, invitee_email=email, token=token)
    db.add(invite)
    state.invites_left -= 1
    await db.commit()
    await db.refresh(invite)

    # Send email (dev mode logs; prod sends SMTP)
    invite_url = f"{settings.frontend_url}?invite={token}"
    await send_invite_email(email, current_user.username, invite_url)

    return InviteResponse(
        id=invite.id,
        invitee_email=invite.invitee_email,
        token=invite.token,
        accepted=False,
        created_at=invite.created_at,
        new_invites_left=state.invites_left,
    )


@router.get("/invites", response_model=InviteListResponse)
async def list_invites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invite)
        .where(Invite.inviter_id == current_user.id)
        .order_by(Invite.created_at.desc())
    )
    rows = result.scalars().all()
    return InviteListResponse(invites=[
        InviteResponse(
            id=r.id,
            invitee_email=r.invitee_email,
            token=r.token,
            accepted=r.used_at is not None,
            created_at=r.created_at,
        )
        for r in rows
    ])
