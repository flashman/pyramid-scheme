# Admin Confirm-Buyin Page — Design

**Date:** 2026-06-20
**Status:** Approved, pending implementation
**Builds on:** PR #16 (`is_admin` flag, `POST /api/admin/confirm-buyin`, `_apply_confirmed_buyin`)

## Problem

Confirming a manual (Venmo) buy-in currently requires a hand-rolled `curl` against
`POST /api/admin/confirm-buyin` with a Bearer token. The admin wants a page to do
this instead of using the API directly.

## Scope

A single-purpose admin page that **confirms buy-ins** — nothing more. No dashboard,
no user search, no balance editing. (Explicitly out of scope; can come later.)

## Authorization model

The page is a thin client; **the server is the security boundary, and it already
exists** (the `is_admin` gate shipped in PR #16). Nothing about authorization
changes server-side.

- The static HTML is public and inert — it holds no secrets and shows no data
  until a valid admin token is present.
- The real gate is unchanged: every action calls `POST /api/admin/confirm-buyin`,
  gated by `get_admin_user` → the `is_admin` flag. Non-admin token → `403`,
  no token → `401`. The client cannot bypass this.
- **No separate admin credential.** The admin logs in through the normal game
  login at `/` (as user 1), which stores the JWT under the `ps_auth_token`
  localStorage key. The admin page reuses that same-origin token.
- **Redirect-away gate:** on load, `/admin` reads `ps_auth_token` and calls
  `/api/me`. If there is no token, the call returns `401`, or `is_admin` is
  false → the page immediately `window.location`-redirects to `/` (main login).
  The confirm UI only renders for a verified admin. This redirect is UX only;
  the server `403`/`401` remains authoritative even if the client check were
  bypassed.

## Components

1. **`frontend/admin/index.html`** (+ inline JS) — served by nginx at the clean
   URL `/admin` via the existing `try_files $uri $uri/ =404` rule (a request for
   `/admin` resolves to the `admin/` directory's `index.html`). **No nginx change
   required.** Contains:
   - Gate logic (token check + `/api/me` → redirect if not admin).
   - A confirm form: username text field + "allow rebuy" checkbox + submit.
   - A result/status area for success and error messages.
   - A "back to game" link to `/`. It only navigates — it does **not** clear
     `ps_auth_token`, since that token is shared with the game session and
     clearing it would log the admin out of the game too.
   - No canvas, no imports from the game bundle. Plain inline `<script>`.

2. **Backend — expose `is_admin` in `/api/me`:**
   - Add `is_admin: bool` to `MeResponse` (`schemas.py`).
   - Populate it from the `User` row in the `/api/me` handler (`routers/game.py`).
   - This is the field the gate reads. It is the only backend change.

## Flow

1. Admin logs in at `/` (normal game login) as user 1 → token stored.
2. Admin navigates to `/admin`.
3. Gate runs: read `ps_auth_token`; call `/api/me`.
   - No token / `401` / `is_admin` false → redirect to `/`.
   - `is_admin` true → render confirm view.
4. Confirm view: enter a username → `POST /api/admin/confirm-buyin` with the
   Bearer token (and `allow_rebuy` if the checkbox is set).
5. On `200`: show the response message (platform cut + amount distributed to N
   upline members).
6. On error, show inline:
   - `404` → "No user named '…'."
   - `409` (already bought) → message + reveal/enable the "allow rebuy" path so
     the admin can intentionally re-confirm a genuine second payment.
   - `401` (token expired mid-session) → redirect to `/`.
7. "Back to game" link returns to `/` without clearing the shared token.

## Error handling

All server error `detail` strings are surfaced verbatim in the result area. The
page never invents authorization decisions — it reflects what the API returns.

## Testing

- **Backend:** a test asserting `/api/me` includes `is_admin`, true for an admin
  user and false for a normal user. Extends the existing `/api/me` coverage.
- **Frontend:** the page is static HTML with inline JS and no JS test runner in
  this project. Verified manually after a frontend rebuild:
  - Visiting `/admin` while logged out → redirected to `/`.
  - Visiting `/admin` as a non-admin user → redirected to `/`.
  - Visiting `/admin` as user 1 → confirm UI renders; confirming a real buyer
    pays the upline (already covered by the PR #16 backend tests).

## Out of scope (YAGNI)

- nginx-level IP allowlist / basic-auth on `/admin` (defense-in-depth; the API
  gate is authoritative).
- Recent-activity list, user lookup, balance edits, cashout — a future fuller
  console if ever needed.
