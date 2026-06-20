"""Deterministic 5-emoji "offering code" derived from a username.

This is the canonical implementation. The frontend does NOT compute it — it
reads `offering_code` off GET /api/me (mirrors how payout/shop values are
single-sourced on the server). The buy-in dialog displays it; the admin
confirm page resolves a pasted code back to a username via /api/admin/lookup.

The hash mirrors JS `charCodeAt` (UTF-16 code units) and unsigned 32-bit math.
NOTE: we use unsigned right shifts. An earlier JS version used signed `>>`,
which produced negative indices (and literal "undefined" emojis) for ~half of
usernames whose hash had the high bit set. Codes here are always 5 valid emojis.
"""
from __future__ import annotations

OFFERING_EMOJIS = [
    '🐍', '🌙', '🔥', '💀', '🦅', '🌊', '⭐', '🗿',
    '🌵', '🦂', '🧿', '🔮', '🏺', '🌿', '🐝', '🐫',
    '🐊', '🦉', '🌀', '🪙', '💎', '🦁', '🌛', '🦋',
]


def _utf16_units(s: str) -> list[int]:
    """UTF-16 code units, matching JS String.charCodeAt iteration."""
    data = s.encode('utf-16-le')
    return [data[i] | (data[i + 1] << 8) for i in range(0, len(data), 2)]


def offering_code(username: str) -> str:
    h = 0
    for unit in _utf16_units(username):
        h = (h * 31 + unit) & 0xFFFFFFFF
    n = len(OFFERING_EMOJIS)
    return ''.join(
        OFFERING_EMOJIS[(h >> shift) % n]
        for shift in (0, 5, 10, 15, 20)
    )
