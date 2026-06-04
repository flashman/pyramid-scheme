import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import get_db
from app.models import Base, Invite, User
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


@pytest.fixture
async def valid_invite():
    """Insert a valid unused invite into the test DB."""
    token = uuid.uuid4().hex
    async with TestingSessionLocal() as db:
        # Create a minimal inviter user
        inviter = User(
            username="inviter",
            password_hash=hash_password("password123"),
        )
        db.add(inviter)
        await db.flush()
        invite = Invite(
            inviter_id=inviter.id,
            invitee_email="recruit@example.com",
            token=token,
        )
        db.add(invite)
        await db.commit()
    return token


async def test_register_without_token_returns_400(client):
    async with client as c:
        res = await c.post("/api/auth/register", json={
            "username": "newuser",
            "password": "password123",
        })
    assert res.status_code == 400
    assert "invite" in res.json()["detail"].lower()


async def test_register_with_valid_token_succeeds(client, valid_invite):
    async with client as c:
        res = await c.post("/api/auth/register", json={
            "username": "newuser",
            "password": "password123",
            "invite_token": valid_invite,
        })
    assert res.status_code == 201
    assert "access_token" in res.json()


async def test_register_with_used_token_returns_400(client, valid_invite):
    async with client as c:
        # Use the token once
        await c.post("/api/auth/register", json={
            "username": "firstuser",
            "password": "password123",
            "invite_token": valid_invite,
        })
        # Try to reuse it
        res = await c.post("/api/auth/register", json={
            "username": "seconduser",
            "password": "password123",
            "invite_token": valid_invite,
        })
    assert res.status_code == 400
    assert "invite" in res.json()["detail"].lower()
