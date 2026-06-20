# Admin Confirm-Buyin Page — Design

**Date:** 2026-06-20
**Status:** Implemented (PR #16)
**Builds on:** PR #16 (`is_admin` flag, `POST /api/admin/confirm-buyin`, `_apply_confirmed_buyin`)

> **Implementation note (post-approval):** during build, the page also gained
> offering-code resolution — the admin can paste the 5-emoji code from a payment
> note and the page resolves it to a username via `POST /api/admin/lookup`. This
> uncovered and fixed a pre-existing bug in the offering-code hash (signed `>>`
> shift produced "undefined" emojis for ~half of usernames); the code generator
> is now server-canonical in `app/offering.py`. See the Components / Testing
> sections below, which reflect what shipped.

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
   URL `/admin` via the `try_files $uri $uri/ =404` rule (a request for `/admin`
   resolves to the `admin/` directory's `index.html`). One nginx change was
   needed: `absolute_redirect off` so the `/admin` → `/admin/` directory redirect
   preserves `host:port` (otherwise nginx drops the dev `:5173` port). Contains:
   - Gate logic (token check + `/api/me` → redirect if not admin).
   - A confirm form: a **username-or-offering-code** text field + "allow rebuy"
     checkbox + submit. An emoji code is detected client-side
     (`\p{Extended_Pictographic}`) and resolved live (debounced) via
     `POST /api/admin/lookup`; a "→ username (bought?)" indicator shows the
     resolved player. Confirm targets the resolved username; an unresolved /
     ambiguous code blocks confirm.
   - A result/status area for success and error messages.
   - A "back to game" link to `/`. It only navigates — it does **not** clear
     `ps_auth_token`, since that token is shared with the game session and
     clearing it would log the admin out of the game too.
   - No canvas, no imports from the game bundle. Plain inline `<script>`.

2. **Backend:**
   - Add `is_admin: bool` to `MeResponse` (`schemas.py`), populated in the
     `/api/me` handler (`routers/game.py`). This is the field the gate reads.
   - Add `offering_code: str` to `MeResponse`, computed by the new canonical
     `app/offering.py` (the frontend stops computing it — `modal.js` reads
     `G.offeringCode`, hydrated from `/api/me`).
   - Add `POST /api/admin/lookup {code}` (`routers/admin.py`, admin-gated):
     iterates users, computes each `offering_code`, returns all matches with
     `bought` status. Returns all matches so the lossy-hash collisions can be
     disambiguated by the admin.

## Flow

1. Admin logs in at `/` (normal game login) as user 1 → token stored.
2. Admin navigates to `/admin`.
3. Gate runs: read `ps_auth_token`; call `/api/me`.
   - No token / `401` / `is_admin` false → redirect to `/`.
   - `is_admin` true → render confirm view.
4. Confirm view: enter a username **or paste the offering code**. A pasted code
   is resolved to a username via `POST /api/admin/lookup` first; then
   `POST /api/admin/confirm-buyin` with the Bearer token (and `allow_rebuy` if
   the checkbox is set).
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

- **Backend (full suite: 37 passed):**
  - `/api/me` includes `is_admin` (true for admin, false for normal user) and
    `offering_code`.
  - `test_offering_code.py` pins `offering_code` to the frontend reference
    values, including non-ASCII usernames, and asserts every code is 5 valid
    emojis (regression guard for the old "undefined" bug).
  - `POST /api/admin/lookup` resolves a code → username, returns empty for no
    match, and 403s a non-admin caller.
  - `confirm-buyin` (from PR #16): non-admin 403, ancestor `balance`/`earned`
    actually move, `allow_rebuy` 409 guard, 404 unknown user.
- **Frontend:** static HTML + inline JS, no JS test runner. Data paths verified
  live via curl; the in-browser gate redirect + paste→resolve→confirm round-trip
  verified manually after rebuild.

## Out of scope (YAGNI)

- nginx-level IP allowlist / basic-auth on `/admin` (defense-in-depth; the API
  gate is authoritative).
- Recent-activity list, balance edits, cashout — a future fuller console if ever
  needed. (Code → username lookup, originally listed here, was implemented.)
