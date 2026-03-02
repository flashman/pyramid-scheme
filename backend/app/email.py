"""
Email sending service.
Dev mode (EMAIL_DEV_MODE=true, the default): logs the invite URL to the console
instead of sending real email — zero configuration needed for local development.

Production: set EMAIL_DEV_MODE=false and configure SMTP_* env vars.
"""
from __future__ import annotations
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import partial

from app.config import settings

logger = logging.getLogger(__name__)


def _send_smtp_sync(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """Synchronous SMTP call — run via executor so it doesn't block the event loop."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_tls:
            server.ehlo()
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, to_email, msg.as_string())


async def send_invite_email(
    to_email: str,
    inviter_username: str,
    invite_url: str,
) -> None:
    subject = f"{inviter_username} has invited you to PYRAMID SCHEME™"

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
  <p style="color:#6a5030;font-size:11px;margin-top:28px">★ TOTALLY LEGAL™ ★</p>
</body>
</html>"""

    if settings.email_dev_mode or not settings.smtp_host:
        logger.info(
            "── INVITE EMAIL (dev mode — not sent) ──\n"
            f"  To:          {to_email}\n"
            f"  From:        {inviter_username}\n"
            f"  Invite URL:  {invite_url}\n"
            "────────────────────────────────────────"
        )
        return

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        partial(_send_smtp_sync, to_email, subject, html_body, text_body),
    )
