"""
Tests for recruit-join email notifications.

Behaviors under test:
  - send_recruit_joined_inviter dispatches with chainmail@ sender
  - send_recruit_joined_admin dispatches with amun@ sender
  - POST /api/auth/register fires inviter notification when invite accepted
  - POST /api/auth/register fires admin notification(s) for every admin user
  - POST /api/auth/register sends no admin notification when no admins exist
"""
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db
from app.models import Base, User, Invite
from app.auth import hash_password

DATABASE_URL = "sqlite+aiosqlite:///:memory:"
engine = create_async_engine(DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client():
    app.dependency_overrides[get_db] = override_get_db
    yield AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    app.dependency_overrides.clear()


async def _make_invite(inviter_email="inviter@example.com", invitee_email="recruit@example.com"):
    token = uuid.uuid4().hex
    async with TestingSessionLocal() as db:
        inviter = User(
            username="inviter",
            password_hash=hash_password("password123"),
            email=inviter_email,
        )
        db.add(inviter)
        await db.flush()
        invite = Invite(
            inviter_id=inviter.id,
            invitee_email=invitee_email,
            token=token,
        )
        db.add(invite)
        await db.commit()
    return token


async def _make_admin(username="pharaoh", email="pharaoh@pyramid-scheme.live"):
    async with TestingSessionLocal() as db:
        admin = User(
            username=username,
            password_hash=hash_password("password123"),
            email=email,
            is_admin=True,
        )
        db.add(admin)
        await db.commit()
        return admin.id


# ---------------------------------------------------------------------------
# Email function unit tests — sender addresses
# ---------------------------------------------------------------------------

async def test_send_recruit_joined_inviter_uses_chainmail_sender():
    from app.email import send_recruit_joined_inviter
    with patch("app.email._dispatch", new_callable=AsyncMock) as mock_dispatch:
        await send_recruit_joined_inviter("inviter@example.com", "Pharaoh", "Recruit")
    assert mock_dispatch.called
    from_email = mock_dispatch.call_args.kwargs["from_email"]
    assert "chainmail@" in from_email


async def test_send_recruit_joined_admin_uses_amun_sender():
    from app.email import send_recruit_joined_admin
    with patch("app.email._dispatch", new_callable=AsyncMock) as mock_dispatch:
        await send_recruit_joined_admin("admin@example.com", "Recruit", "Pharaoh")
    assert mock_dispatch.called
    from_email = mock_dispatch.call_args.kwargs["from_email"]
    assert "amun@" in from_email


# ---------------------------------------------------------------------------
# Integration tests — register endpoint fires notifications
# ---------------------------------------------------------------------------

async def test_register_sends_inviter_notification(client):
    token = await _make_invite(inviter_email="inviter@example.com")
    with patch("app.routers.auth.send_recruit_joined_inviter", new_callable=AsyncMock) as mock_notify:
        async with client as c:
            res = await c.post("/api/auth/register", json={
                "username": "newrecruit",
                "password": "password123",
                "invite_token": token,
            })
    assert res.status_code == 201
    mock_notify.assert_called_once()
    to_email, inviter_username, recruit_username = mock_notify.call_args.args
    assert to_email == "inviter@example.com"
    assert recruit_username == "newrecruit"


async def test_register_sends_admin_notification_for_each_admin(client):
    token = await _make_invite()
    await _make_admin(username="god1", email="god1@pyramid-scheme.live")
    await _make_admin(username="god2", email="god2@pyramid-scheme.live")
    with patch("app.routers.auth.send_recruit_joined_admin", new_callable=AsyncMock) as mock_notify:
        async with client as c:
            res = await c.post("/api/auth/register", json={
                "username": "newrecruit",
                "password": "password123",
                "invite_token": token,
            })
    assert res.status_code == 201
    assert mock_notify.call_count == 2
    notified_emails = {call.args[0] for call in mock_notify.call_args_list}
    assert notified_emails == {"god1@pyramid-scheme.live", "god2@pyramid-scheme.live"}


async def test_register_skips_admin_notification_when_no_admins(client):
    token = await _make_invite()
    with patch("app.routers.auth.send_recruit_joined_admin", new_callable=AsyncMock) as mock_notify:
        async with client as c:
            await c.post("/api/auth/register", json={
                "username": "newrecruit",
                "password": "password123",
                "invite_token": token,
            })
    mock_notify.assert_not_called()
