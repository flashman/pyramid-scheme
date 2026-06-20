"""
Email sending service.

Two delivery paths, chosen at runtime:

  • Resend HTTPS API (production) — Render blocks outbound SMTP, so we POST
    to https://api.resend.com/emails over 443 instead. Used whenever an
    API key is available and SMTP_HOST points at Resend.
  • SMTP (local dev) — hits Mailhog (mailhog:1025), the local catch-all
    server, so you see rendered emails without real delivery. View them at
    http://localhost:8025 when running via Docker.

Email delivery is best-effort: failures are logged, never raised, so the
invite endpoint always succeeds for the caller.
"""
from __future__ import annotations
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import partial

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"


def _resend_key() -> str:
    """Resend API key — explicit setting, else the SMTP password (same value)."""
    return settings.resend_api_key or settings.smtp_password


def _use_resend_api() -> bool:
    """Use the HTTPS API when we have a key and SMTP_HOST targets Resend."""
    return bool(_resend_key()) and "resend" in settings.smtp_host.lower()


def _send_smtp_sync(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """Synchronous SMTP call — run in a thread pool to avoid blocking the event loop."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = settings.smtp_from
    msg["To"]      = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # timeout guards against a hung connection (e.g. a blocked SMTP port).
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        if settings.smtp_tls:
            server.ehlo()
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, to_email, msg.as_string())
        logger.info(f"Email sent via SMTP → {to_email}  subject='{subject}'")


async def _send_resend_api(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """Deliver via the Resend HTTPS API (works where outbound SMTP is blocked)."""
    payload = {
        "from":    f"PYRAMID SCHEME <{settings.smtp_from}>",
        "to":      [to_email],
        "subject": subject,
        "html":    html_body,
        "text":    text_body,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {_resend_key()}"},
            json=payload,
        )
    if resp.status_code >= 400:
        # Surface Resend's reason (bad key, unverified domain, etc.) in the logs.
        logger.error(f"Resend API {resp.status_code} for {to_email}: {resp.text}")
        return
    logger.info(f"Email sent via Resend → {to_email}  id={resp.json().get('id')}")


async def send_invite_email(
    to_email: str,
    inviter_username: str,
    invite_url: str,
) -> None:
    subject   = f"{inviter_username} has invited you to PYRAMID SCHEME™"
    text_body = (
        f"{inviter_username} has invited you to join PYRAMID SCHEME™!\n\n"
        f"Click the link to register and claim your place in the pyramid:\n"
        f"{invite_url}\n\n"
        f"⚡ PYRAMID SCHEME™ — TOTALLY LEGAL™"
    )
    html_body = f"""<!DOCTYPE html>
<html>
<body style="background:#0a0500;color:#d0a060;font-family:monospace;padding:24px;margin:0">
  <h1 style="color:#f0c020;letter-spacing:3px;font-size:18px">⚡ PYRAMID SCHEME™ ⚡</h1>
  <p style="margin:16px 0">
    <strong style="color:#f0c020">{inviter_username}</strong>
    has sent you an invite scroll.
  </p>
  <p style="margin:0 0 20px">Click below to register and build your empire:</p>
  <a href="{invite_url}"
     style="display:inline-block;background:#1a0e00;border:1px solid #8a6a20;
            color:#f0c020;padding:10px 22px;text-decoration:none;
            letter-spacing:2px;font-size:13px;font-family:monospace">
    ► ENTER THE DESERT
  </a>
  <p style="color:#f0c020;font-size:11px;margin-top:20px">
    Invite link: <a href="{invite_url}" style="color:#8a6a20">{invite_url}</a>
  </p>
  <p style="color:#6a5030;font-size:11px;margin-top:16px">★ TOTALLY LEGAL™ ★</p>
</body>
</html>"""

    if not _use_resend_api() and not settings.smtp_host:
        logger.warning(
            f"No email transport configured — invite link for {to_email}: {invite_url}"
        )
        return

    try:
        if _use_resend_api():
            await _send_resend_api(to_email, subject, html_body, text_body)
        else:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                partial(_send_smtp_sync, to_email, subject, html_body, text_body),
            )
    except Exception as exc:
        # Log but don't crash the invite flow — email failure is non-fatal.
        logger.error(f"Failed to send invite email to {to_email}: {exc}")
