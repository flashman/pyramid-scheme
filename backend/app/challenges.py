"""
Challenge catalogue — answer-carrying key actions, as data.

CHALLENGE_CONFIG is the single source of truth for puzzle answers (the
sphinx riddle answers used to sit in plaintext in worlds/oasis/riddles.js).
A future puzzle realm adds an entry here, not an endpoint.

Per challenge:
  answers              — {item_id: [accepted answers], ...} lowercase
  counter              — server-owned flag incremented once per solved item
  hint_after_attempts  — wrong-attempt threshold after which the response
                         includes the answer (the sphinx's mercy rule)
"""

CHALLENGE_CONFIG: dict[str, dict] = {
    "sphinx": {
        "answers": {
            "map":      ["map"],
            "hole":     ["hole"],
            "echo":     ["echo"],
            "coffin":   ["coffin"],
            "trust":    ["trust"],
            "clock":    ["clock", "time"],
            "stamp":    ["stamp"],
            "future":   ["future", "horizon"],
            "letter_e": ["e"],
            "profit":   ["gold", "profit", "wealth", "money"],
            "stone":    ["stone", "sand", "time", "worker", "labor"],
            "truth":    ["truth", "reality", "facts"],
        },
        "counter": "sphinx_riddles_solved",
        "hint_after_attempts": 13,
    },
}
