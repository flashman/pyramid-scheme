# Invite-Only Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block registration unless a valid unused invite token is provided, while allowing manual token entry in addition to URL pre-fill.

**Architecture:** Backend enforces the invariant in `auth.py` after the existing invite lookup — no schema change needed. Frontend adds an INVITE TOKEN input field to the register form, pre-filled from the URL param if present, read from the field on submit.

**Tech Stack:** FastAPI, SQLAlchemy async, pytest + pytest-asyncio + httpx (new test deps), vanilla JS

---

### Task 1: Add test dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add pytest dependencies**

In `backend/requirements.txt`, append:
```
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
```

- [ ] **Step 2: Add pytest config**

Create `backend/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 3: Install and verify**

```bash
docker compose exec backend pip install pytest pytest-asyncio httpx
docker compose exec backend pytest --version
```
Expected: `pytest 8.x.x`

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini
git commit -m "add pytest, pytest-asyncio, httpx for backend tests"
```

---

### Task 2: Backend — enforce invite token on registration

**Files:**
- Modify: `backend/app/routers/auth.py:28-35`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Create test file with three failing tests**

Create `backend/tests/__init__.py` (empty).

Create `backend/tests/test_auth.py`:
```python
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
def client():
    app.dependency_overrides[get_db] = override_get_db
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def valid_invite(setup_db):
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
```

- [ ] **Step 2: Add aiosqlite dependency**

In `backend/requirements.txt`, append:
```
aiosqlite>=0.20.0
```

Install it:
```bash
docker compose exec backend pip install aiosqlite
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
docker compose exec backend pytest tests/test_auth.py -v
```
Expected: all three tests FAIL (two with 201/422 instead of 400, one with 201 instead of 400 on reuse).

- [ ] **Step 4: Implement the guard in auth.py**

In `backend/app/routers/auth.py`, replace the invite lookup block:

```python
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
```

with:

```python
    # Resolve invite token → find inviter; a valid token is required to register
    invite: Invite | None = None
    if body.invite_token:
        inv_result = await db.execute(
            select(Invite).where(
                Invite.token == body.invite_token,
                Invite.used_at.is_(None),
            )
        )
        invite = inv_result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(
            status_code=400,
            detail="A valid invite token is required to register.",
        )
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
docker compose exec backend pytest tests/test_auth.py -v
```
Expected: all three tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/tests/__init__.py backend/tests/test_auth.py backend/app/routers/auth.py
git commit -m "enforce invite token required on registration"
```

---

### Task 3: Frontend — add INVITE TOKEN field to register form

**Files:**
- Modify: `frontend/ui/auth.js`

The register form currently has USERNAME, PASSWORD, CONFIRM PASSWORD, and ToS checkbox. Add an INVITE TOKEN field between CONFIRM PASSWORD and the ToS row. The field is pre-filled from the URL `?invite=` param if present, and read directly on submit.

- [ ] **Step 1: Add the INVITE TOKEN field to the HTML template**

In `frontend/ui/auth.js`, find the `HTML` const. After the confirm password field and before the ToS row, add the invite token field:

```js
      <div class="auth-field" id="auth-token-wrap" style="display:none">
        <label>INVITE TOKEN</label>
        <input id="auth-token" type="text" placeholder="paste your token here" maxlength="64" />
      </div>
```

The full HTML block around that area should look like:
```html
      <div class="auth-field" id="auth-confirm-wrap" style="display:none">
        <label>CONFIRM PASSWORD</label>
        <input id="auth-confirm" type="password" autocomplete="new-password" placeholder="••••••••" maxlength="128" />
      </div>
      <div class="auth-field" id="auth-token-wrap" style="display:none">
        <label>INVITE TOKEN</label>
        <input id="auth-token" type="text" placeholder="paste your token here" maxlength="64" />
      </div>
      <div id="auth-tos-row" style="display:none;margin-bottom:10px;">
```

- [ ] **Step 2: Wire up the new field in the JS logic**

In `requireAuth()`, after the line that gets `tosClose`:
```js
    const tosOverlay = document.getElementById('tos-overlay');
    const tosClose   = document.getElementById('tos-close');
```

Add:
```js
    const tokenWrap = document.getElementById('auth-token-wrap');
    const tokenEl   = document.getElementById('auth-token');
```

- [ ] **Step 3: Show/hide the field with the register tab and pre-fill from URL**

The token field should show/hide alongside the existing register-only fields. Find the `if (_inviteToken)` block that auto-switches to register:

```js
    if (_inviteToken) {
      mode = 'register';
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'register'));
      confirmW.style.display = 'block';
      tosRow.style.display   = 'block';
      submit.textContent     = '► FOUND YOUR DYNASTY';
    }
```

Replace with:
```js
    if (_inviteToken) {
      mode = 'register';
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'register'));
      confirmW.style.display  = 'block';
      tokenWrap.style.display = 'block';
      tosRow.style.display    = 'block';
      tokenEl.value           = _inviteToken;
      submit.textContent      = '► FOUND YOUR DYNASTY';
    }
```

- [ ] **Step 4: Show/hide on tab switch**

Find the tab switch handler block that sets `confirmW.style.display`:
```js
        const isReg = mode === 'register';
        confirmW.style.display = isReg ? 'block' : 'none';
        tosRow.style.display   = isReg ? 'block' : 'none';
        if (!isReg) tosCheck.checked = false; // reset on leaving register
```

Replace with:
```js
        const isReg = mode === 'register';
        confirmW.style.display  = isReg ? 'block' : 'none';
        tokenWrap.style.display = isReg ? 'block' : 'none';
        tosRow.style.display    = isReg ? 'block' : 'none';
        if (!isReg) tosCheck.checked = false;
```

- [ ] **Step 5: Read token from the field on submit**

In `doSubmit()`, find the register payload:
```js
      const payload  = mode === 'login'
        ? { username, password }
        : { username, password, invite_token: _inviteToken || undefined };
```

Replace with:
```js
      const payload  = mode === 'login'
        ? { username, password }
        : { username, password, invite_token: tokenEl.value.trim() || undefined };
```

- [ ] **Step 6: Add client-side required check for token**

In `doSubmit()`, find the register-mode validation block:
```js
      if (mode === 'register') {
        if (password !== confirmEl.value) { setError('Passwords do not match.'); return; }
        if (!tosCheck.checked) { setError('You must agree to the Terms of Participation.'); return; }
      }
```

Replace with:
```js
      if (mode === 'register') {
        if (password !== confirmEl.value)  { setError('Passwords do not match.'); return; }
        if (!tokenEl.value.trim())         { setError('An invite token is required.'); return; }
        if (!tosCheck.checked)             { setError('You must agree to the Terms of Participation.'); return; }
      }
```

- [ ] **Step 7: Smoke test locally**

```bash
docker compose up --build
```

1. Open http://localhost:5173 — click REGISTER tab — confirm INVITE TOKEN field appears
2. Confirm submitting without a token shows "An invite token is required."
3. Open http://localhost:5173?invite=abc123 — confirm REGISTER tab auto-selects and token field is pre-filled with `abc123`
4. Log in as your existing user — confirm login still works normally

- [ ] **Step 8: Commit**

```bash
git add frontend/ui/auth.js
git commit -m "add invite token field to register form"
```

---

### Task 4: Push and redeploy

- [ ] **Step 1: Push branch**

```bash
git push
```

- [ ] **Step 2: Verify Render redeploys both services**

Watch Render dashboard — backend and frontend should both redeploy automatically (auto-deploy is on for the branch).

- [ ] **Step 3: Smoke test on production**

1. Visit https://pyramid-scheme-frontend.onrender.com — click REGISTER — confirm INVITE TOKEN field is present
2. Try registering without a token — expect "An invite token is required." client-side
3. Log in as your existing account — confirm it works
4. Buy in → get 4 invite scrolls → send an invite → use the link → confirm registration succeeds with the pre-filled token
