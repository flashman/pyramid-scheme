"""
Progression steps — quest actions that feed realm unlock rules, as data.

These are the *inputs* the unlock rules read. Without them the gates would
be honour-system: reserving `crypt_open` alone is pointless if the client
can forge the `gods_met` counter the chamber rule reads.

The server can't verify a player actually walked to the stele — but it can
verify the step is *reachable*, which forces the chain to be walked in
order (you can't claim `stele_read` without the vault, and the vault only
opens on a real riddle answer). Every flag written here is server-owned;
app/flags.py derives its reserved set from this catalogue so the two can't
drift apart.

Per step:
  requires_*   — preconditions, evaluated by the same realms.rule_satisfied
  sets_flag    — server-owned boolean written on success
  items        — if present, the step is per-item (each distinct item counts
                 once toward `counter`, recorded as `item_flag`.format(item))
  counter      — server-owned counter incremented once per distinct item
"""

STEP_CONFIG: dict[str, dict] = {
    # The seven sky gods. Each is met once; the count gates the crypt.
    "god_met": {
        "requires": {"requires_bought": True},
        "items": [str(i) for i in range(7)],
        "counter": "gods_met",
        "item_flag": "god_{item}_met",
    },
    # Reading the dream stele beneath the sphinx — gates Atlantis.
    "stele_read": {
        "requires": {"requires_realms": ["vault"]},
        "sets_flag": "stele_read",
    },
    # Accepting the Sector Chief's offer in the crypt — gates the Council.
    "upline_accepted": {
        "requires": {"requires_realms": ["chamber"]},
        "sets_flag": "upline_accepted",
    },
}


def owned_flag_names() -> set[str]:
    """Every flag name this catalogue writes — the server-owned set."""
    names: set[str] = set()
    for cfg in STEP_CONFIG.values():
        if cfg.get("sets_flag"):
            names.add(cfg["sets_flag"])
        if cfg.get("counter"):
            names.add(cfg["counter"])
        item_flag = cfg.get("item_flag")
        if item_flag:
            names.update(item_flag.format(item=i) for i in cfg.get("items", []))
    return names
