"""Pin the Python offering_code to the canonical (fixed, unsigned) JS values.

Reference values were generated from the frontend algorithm with the unsigned
`>>>` shift. These MUST match what the buy-in dialog shows, or the admin
code->username lookup breaks. Do not hand-edit without regenerating from JS.
"""
import pytest

from app.offering import offering_code, OFFERING_EMOJIS

# username -> code, generated via node from the fixed (>>>) algorithm.
PINNED = {
    "admin":   "🦋🧿🐊💎🐊",
    "alice":   "🐍🏺🌊💀🐊",
    "pharaoh": "🦉🦂🐍💎🔮",   # high-bit hash: was "🦉undefined…" under the old bug
    "aok":     "🦁🦋🌛🔥🐍",
    "Bob":     "🌊🦅🦉🔥🐍",
    "a":       "🌙💀🐍🐍🐍",
    "écho":    "🌙🦂🧿🌛⭐",   # non-ASCII: UTF-16 code-unit fidelity
    "日本":     "🐫🗿🦋🌙🐍",   # multi-byte
}


@pytest.mark.parametrize("username,expected", PINNED.items())
def test_offering_code_matches_frontend(username, expected):
    assert offering_code(username) == expected


def test_offering_code_is_always_five_valid_emojis():
    # The old signed-shift bug produced "undefined"; guard against regressions.
    for username in ["pharaoh", "ZZZZZZ", "user-with-high-hash-99", "z"]:
        code = offering_code(username)
        assert "undefined" not in code
        # Exactly 5 emojis, each from the canonical set.
        chars = list(code)
        assert len(chars) == 5
        assert all(c in OFFERING_EMOJIS for c in chars)
