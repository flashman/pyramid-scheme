"""
Challenge catalogue — answer-carrying key actions, as data.

CHALLENGE_CONFIG is the single source of truth for puzzle answers. The 12
sphinx riddle answers used to sit in plaintext in worlds/oasis/riddles.js.

The **responses** live here too, not just the answers: every sphinx response
opens by naming the solution ("A MAP.", "A HOLE."), so shipping them to the
client would leak all 12 answers even with the answer arrays removed. The
client holds the questions; the server hands back the response text only
once the riddle is answered (or when the mercy hint fires).

Per challenge:
  items                — {item_id: {answers: [...], response: str}}
  counter              — server-owned flag incremented once per solved item
  hint_after_attempts  — wrong-attempt threshold after which the response
                         includes the answer (the sphinx's mercy rule)
"""

CHALLENGE_CONFIG: dict[str, dict] = {
    "sphinx": {
        "counter": "sphinx_riddles_solved",
        "hint_after_attempts": 13,
        "items": {
            "r1": {   # map
                "answers": ["map"],
                "response": "A MAP.\nTHE LAND IS NOT THE TERRITORY.\nYET EVERY PHARAOH MISTAKES\nTHE MAP FOR THE WORLD ITSELF.",
            },
            "r2": {   # hole
                "answers": ["hole"],
                "response": "A HOLE.\nLIKE DEBT.\nLIKE THE SPACE BETWEEN\nWHAT THE SCHEME PROMISES AND WHAT IT DELIVERS.",
            },
            "r3": {   # echo
                "answers": ["echo"],
                "response": "ECHO.\nYOUR RECRUITERS ECHO YOUR PITCH\nDOWN TWELVE LEVELS OF THE CHAIN.\nBY THEN, NOTHING OF THE ORIGINAL REMAINS.",
            },
            "r4": {   # coffin
                "answers": ["coffin"],
                "response": "A COFFIN.\nI HAVE WATCHED FOUR THOUSAND YEARS\nOF PHARAOHS WHO BELIEVED\nTHEY WERE THE EXCEPTION.",
            },
            "r5": {   # trust
                "answers": ["trust"],
                "response": "TRUST.\nTHE ONLY CURRENCY THAT CANNOT BE PRINTED.\nEVERY PYRAMID SPENDS IT FIRST\nAND NOTICES LAST.",
            },
            "r6": {   # clock
                "answers": ["clock", "time"],
                "response": "THE CLOCK. TIME.\nYOUR PYRAMID TOOK WEEKS TO BUILD.\nFOUR THOUSAND YEARS FROM NOW\nNO ONE WILL REMEMBER THE PHARAOH.",
            },
            "r7": {   # stamp
                "answers": ["stamp"],
                "response": "A STAMP.\nYOUR INVITATION SCROLLS\nALSO TRAVEL FAR\nWITHOUT EVER LEAVING YOUR HAND.",
            },
            "r8": {   # future
                "answers": ["future", "horizon"],
                "response": "THE FUTURE. OR THE HORIZON.\nBOTH ARE CORRECT.\nBOTH DESCRIBE THE SAME THING:\nWHAT EVERY SCHEME SELLS.",
            },
            "r9": {   # letter_e
                "answers": ["e"],
                "response": "THE LETTER E.\nYOU DID NOT EXPECT THAT.\nNEITHER DID THE LAST\nFOUR THOUSAND PHARAOHS WHO STOOD HERE.",
            },
            "r10": {   # profit
                "answers": ["gold", "profit", "wealth", "money"],
                "response": "GOLD. PROFIT. WEALTH.\nALL CORRECT.\nAND AT THE TOP OF YOUR UPLINE?\nSOMETHING ELSE PROFITS FROM YOURS.",
            },
            "r11": {   # stone
                "answers": ["stone", "sand", "time", "worker", "labor"],
                "response": "STONE. SAND. TIME. WORKER.\nALL ACCEPTED.\nTHE BUILDERS HAVE ALWAYS\nOUTLASTED THE SCHEME.",
            },
            "r12": {   # truth
                "answers": ["truth", "reality", "facts"],
                "response": "TRUTH.\nOR REALITY.\nYOU HAVE ANSWERED WELL, PHARAOH.\nNOW WATCH CAREFULLY WHAT YOU HAVE BUILT.",
            },
        },
    },
}
