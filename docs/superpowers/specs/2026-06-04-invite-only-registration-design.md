# Invite-Only Registration

**Date:** 2026-06-04
**Status:** Approved

## Problem

Registration is currently open to anyone. The game should only allow users with a valid invite token to register. Tokens may arrive via invite link or be shared manually (e.g. via message).

## Out of Scope

- Seed invite generation (owner already has an account and can send invites via the normal buy-in flow)
- Admin endpoint for invite management
- Token expiry changes

## Backend (`backend/app/routers/auth.py`)

The `register` endpoint currently accepts registration with no invite token (silently ignoring missing or invalid tokens). Change this behaviour:

- If `invite_token` is absent or does not match an unused `Invite` record, return `HTTP 400` with `detail: "A valid invite token is required to register."`
- All other registration logic is unchanged.

## Frontend (`frontend/ui/auth.js`)

The REGISTER tab always shows the full registration form, with one new field added: **INVITE TOKEN**.

- If `?invite=TOKEN` is present in the URL, the field is pre-filled with the token value.
- If no URL param is present, the field is empty and the user types their token in manually.
- The field is a plain text input — no validation client-side beyond "non-empty before submit".
- On submit, the token value is sent to the backend as `invite_token` (already done for the URL case; now also covers the manual entry case).

The LOGIN tab and guest/demo mode are unaffected.

## Data Flow

```
Invite link → page loads → REGISTER tab auto-selected, token field pre-filled → submit
Manual token → click REGISTER tab → type token → submit
Either path → backend validates token → success or 400
No token entered → submit → backend returns 400 "A valid invite token is required"
```

## What Is Not Changed

- Login flow
- Guest/demo mode  
- Invite sending (`POST /api/invites`)
- Invite token format, generation, or expiry
- URL-based pre-fill behaviour
