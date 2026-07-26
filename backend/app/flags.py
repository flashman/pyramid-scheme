"""
Client-settable flag policy — the namespace lock.

The client legitimately syncs its whole Flags store, so server-owned names
are **stripped silently** rather than rejected (rejecting would break every
honest sync). Same policy the shop's `shop_owned_` prefix established.

Reserved names are the gate flags the server now owns: they are mirrored
into GameState.flags by realms.grant_realm() so existing client draw/quest
code hydrates unchanged from /api/me, but a client can never write them.
"""

RESERVED_FLAG_PREFIXES: tuple[str, ...] = (
    "shop_owned_",          # inventory ownership (app/inventory.py)
    "unlock_",              # reserved for future server-owned unlock flags
    "challenge_solved_",    # per-item challenge solve records
    "challenge_attempts_",  # per-item wrong-attempt counters
)

from app.steps import owned_flag_names

# Realm gate flags, mirrored by realms.grant_realm().
_GATE_FLAGS = {
    "first_scroll_sent",
    "crypt_open",
    "cosmic_upline_done",
    "atlantis_vault_opened",
    "atlantis_crack_visible",
    "sphinx_riddles_solved",
}

# Gate flags plus every flag the step catalogue writes. Derived rather than
# hand-listed: reserving a gate but leaving the input it reads client-settable
# would make the gate decorative, so the two must not drift apart.
RESERVED_FLAG_NAMES: frozenset[str] = frozenset(_GATE_FLAGS | owned_flag_names())


def sanitize_flags(incoming: dict) -> dict:
    """Drop every server-owned key from a client-supplied flag dict."""
    return {
        k: v for k, v in incoming.items()
        if not k.startswith(RESERVED_FLAG_PREFIXES) and k not in RESERVED_FLAG_NAMES
    }
