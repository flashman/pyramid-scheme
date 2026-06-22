# Making the realms fun — the fractal deduction design

*Design doc — 2026-06-21*

## The question this answers

> The pyramid is the visually alive part of the game. The other realms feel less
> fun. How do we make exploring them fun — so the pyramid is just one aspect —
> **without** changing the real-money payout structure?

## Diagnosis (what's actually wrong)

The realms are **read-once dioramas**. Every interaction is the same skeleton:
`walk/swim → press SPACE → read text → set a flag`. The verbs are *move* and
*read*. Once you've read everything, there is **zero reason to return**, and a
solo player has nothing to *do*.

Two precise gaps, in the player's own words:

1. **"Nothing to DO."** This is *not* "no reward for doing" — it is **no
   satisfying *doing* in the first place.** There is no verb anywhere in the game
   that is pleasurable to perform.
2. **"No payoff / no stakes."** Exploring a realm doesn't feed the pyramid; the
   pyramid doesn't change the realms. The one fun system and the exploration
   system never talk to each other.

### The Nile is the cautionary baseline, not the template

The Nile is the **highest-effort proof that "add more content" does not produce
fun.** It has the most surface area in the game — a traversal model
(croc-back hopping against a one-way current), a moral fork (the basket baby),
four mythic NPCs, a shop — and it *still* isn't fun, because:

- **The verb is deliberately defanged.** The riverbed is standable everywhere and
  death just washes you back to the entry bank at no cost (its own code comment:
  *"you can never be trapped"*). A platformer where you can't fall in the pit and
  death is free has had the game taken out of it.
- **It is still transport-to-text.** Strip the costume and the loop is: cross
  west once → reach an NPC → read → flag. The exact read-once pattern.
- **Its myths are narrated, not played.** Joseph's grain monopoly — history's
  first recorded pyramid scheme, and *canon* — is a talking head, not a scheme
  you run.

**Lesson:** on this project, "make it fun" keeps getting answered with "add more
content," and the Nile is the receipt that content-volume doesn't convert. The
one idea worth salvaging from it is *the basket fork* — "a moral choice silently
rewires the world's mechanics" (drown the baby → the crocs spare you). That
**complicity engine** is a pillar worth scaling; the rest is a warning.

## The hard constraint (non-negotiable)

**The real payout chain is sacrosanct.** Realm activities never mint money, never
touch real balances, never fake the upline chain (`run_buyin_chain`). Their
payoff is a *separate, non-monetary* resource that grows the pyramid
**physically/visually** and unlocks structure. Money stays tied to real recruits
only. This makes the design *cleaner*: a casual solo player gets the
"my-thing-is-getting-bigger" dopamine **without** us counterfeiting the real
economy.

## What this game actually is

A satire on the **recursive history of schemes**, told through myth. Atlantis
already says it outright — *"there is no upline… the system is the upline… the
shape always repeats."* The Nile says it in scripture (Joseph). The thesis is
geometric: **the same con, nested at every scale.**

### Structural model: Mandelbrot, not Sierpinski

The Sierpinski gasket (a pyramid of identical pyramids) is the *legible* version —
useful precisely because the repetition is obvious. But the **true** structure is
the **Mandelbrot set**: self-similar *shape* with **novel detail in every
corner.** This distinction is load-bearing:

- **Recognition** (the shape repeats) → the **complicity / theme** beat. *"Oh god,
  it's the same con."*
- **Novelty** (new detail at every zoom) → the **curiosity / discovery** beat.
  *"But I've never seen this."*

Pure self-similarity kills curiosity (once you see the trick, every zoom is
predictable). Pure novelty kills the thesis. We need both: **same method, endlessly
new scheme.** Each realm rhymes with the others (the con-shape) but carries its own
novel myth, detail, and surprise.

## The realms interlock — progress is a web, not a corridor

**Actions in one realm open doors in others.** The realms are a web of state and
knowledge (a Metroidvania of knowledge; *Outer Wilds*' rumor-web), not a linear
sequence. The canonical example is already in the game: **the only way into the
crypt is by building the pyramid.** Other gates exist (the Oasis dive needs the
vault ritual; the Nile opens on the first scroll sent; the deepest Atlantis tablet
cracks the floor to The Deep).

Two consequences this design depends on:

1. **The deduction is assembled *across* realms, not per-room.** A fact learned in
   Atlantis explains a gate in the Nile; "the shape repeats" is a cross-realm
   deduction. This is the Mandelbrot set's corners *connecting* — and it's what
   makes the verb worth carrying from realm to realm.
2. **The non-monetary physical-pyramid loop is a *key*.** Gating the crypt (and
   others) on the *built* pyramid rather than only on 15 real recruits gives a solo
   player a genuine path inward. **This directly dissolves the original
   casual-play wall** named in the diagnosis: progress no longer requires a viral
   real-world social graph.

## The design pillar (the brief)

> **What is the one verb — performed *inside the realms* — that a player would do
> with every reward turned off, and whose *mastery is itself complicity*: getting
> good at it means seeing the scheme clearly enough to run it? And how does each
> myth-realm recontextualize that one verb so that, across all of them, the player
> *assembles* the discovery that the shape always repeats?**

A valid answer must satisfy **all five** — or it is the Nile again:

1. **It lives in the realms.** Not back at the home pyramid. The fun must happen
   where it's missing; relocating it to "home" just moves the empty room.
2. **It's fun with the pyramid payoff OFF.** The five-minute grey-box test. This
   is the exact step the Nile skipped.
3. **Mastery = complicity.** The *skill itself* implicates you — not theme as
   flavor. This is the single most ownable idea in the design; it's what keeps the
   game from being a clicker in a pharaoh skin.
4. **It grows the pyramid physically, never mints money.**
5. **One verb, recontextualized per myth — the recursion is *played, not
   narrated*.**

## The core verb: deduction

**Category: discovery / deduction** (the *Return of the Obra Dinn* / *Outer
Wilds* / *The Case of the Golden Idol* family). You **figure out the hidden
scheme-shape.**

Why this category wins (over a twitch verb or a "run-the-pitch" verb): it is the
only one where **curiosity, gratification, and "the shape repeats" align in a
single mechanic** instead of being bolted together — and the only one where
complicity is *reachable* with one deliberate design move (below).

- **It is active curiosity**, not passive reading — figuring out a hidden
  structure is itself an intrinsically fun, masterable verb. It passes the
  payoff-off test (people do it for the click of understanding alone).
- **It lives natively in the realms** (constraint 1).
- Obra Dinn's "the book locks in the instant you've correctly deduced three fates"
  is *exactly* the instant-gratification-on-curiosity loop the player described.

### Mastery = complicity is NOT free — the bridge we must build

This is the one place the deduction category does **not** give us a free lunch,
and it's the most important correction in the design. Obra Dinn, *Outer Wilds*,
and Golden Idol all cast the player as a **detective who walks away clean**, and
*understanding* a con is the opposite of *running* one. Deduction alone hands us
the detective, not the accomplice.

So complicity must be engineered into the verb's **output**:

> **Solving must *advance* the scheme — recruit the next layer, victimize someone,
> author the official account — not merely *reveal* it.** Only the first is
> complicity.

This is the discriminating test the grey-box must pass: a prototype where solving
just *lights up the truth* has failed the pillar even if the deduction is fun.

**Twitch demotes to optional in-realm distraction** — the croc-hop, a diversion
*within* a realm — texture on the deduction spine, never the spine itself.

## The progression model: Katamari scale-transition

Deduction gives the verb; **Katamari gives the feeling of progress.** Katamari is
one verb (roll/accrete) whose whole joy is **scale transition** — the giants
become motes as you grow, and the world re-frames around you. The ball *is* your
progress, visibly, every second — like the pyramid.

Fuse it with the Mandelbrot structure and the payoff beat falls out:

> **The deduction "click" triggers a zoom-out.** The moment you crack the scheme
> at scale N, the camera pulls back to reveal that the whole thing you just
> mastered is *a single tile in an identical scheme at scale N+1* — where you are
> now someone else's recruit. **"The shape repeats" becomes a camera move you
> earn**, shown, not told. That is the gratification beat.

- The **pyramid is your Katamari**: the non-monetary monument that visibly accretes
  and periodically **jumps scale**.
- Following Ueda, the growth should **ache** — complicity, not confetti. The
  monument swelling should feel a little like guilt.
- **The game already believes this.** Tier Omega literally says *"you are now
  recruiting planets"*; Earth Franchise 7G is one member of the Galactic Pyramid
  Scheme. The Katamari zoom-out pays off a promise the lore made years ago — it
  just never became a verb or a feeling.

## The trajectory: expansion is collapse

The scale-jumps are **not neutral.** As the scope expands outward, the
space-time continuum breaks down — **the walls of reality fall, and society and
meaning come apart with them.** This is the Mandelbrot set with *decay*, not just
novelty: each zoom-out doesn't only reveal new detail, it reveals a world coming
*undone*. Growth that aches (Ueda) becomes, at scale, growth that *dissolves*.

- **Tone trajectory: naive satire → cosmic horror.** It opens as a silly MLM
  joke. The deeper and wider you deduce, the more it stops being funny. The jokes
  are the surface of something that does not hold together.
- **The deepest discovery is the terminal object of the deduction spine.** The
  final "click" is not about any one realm's con. It is the realization that **the
  walls are falling and nothing was as it seemed — a naive pyramid scheme is much,
  much more.** The whole reality is one shape, and it is coming apart.
- **The last wall to fall is the fourth one** — and this is why the real-money
  constraint is load-bearing, not just legal hygiene. The player *paid real money*
  to play a game about a pyramid scheme. The terminal deduction collapses the
  boundary between "the game" and "the scheme you actually joined": the satire is
  real, you are a recruit, the money is real *because the scheme is real.* The game
  only admits this as the walls come down.
- **It compounds with the verb.** If the deduction mechanic is Golden-Idol-shaped
  (solving = authoring the official account/lie), the collapse is the *downstream
  consequence of the very lies the player wrote*: a reality built on authored lies
  cannot hold. The verb doesn't just *witness* the collapse — it *causes* it. That
  is mastery = complicity at cosmic scale.

**Implementation note:** the collapse is an *emergent property of stacking many
scale-transitions* — it is not built in one place. The prototype (steps 2–3) only
needs the single transition to **hint** at degradation (a first hairline crack in
the walls), not to deliver the apocalypse. Prove the beat; the collapse is what
many beats compound into.

## The three-beat heartbeat (how to pace it)

The design unit is not "is this room fun?" but **where the heartbeat goes flat:**

- **Curiosity** — the myth & mood gateways (Oasis, the one-way river). *Quiet on
  purpose.* Following Ueda's design-by-subtraction, these stay empty; their job is
  to hold the thread taut, not to entertain. (Caveat: an empty room only reads as
  "the inhale" if there's an exhale worth inhaling for — subtraction is only
  earned once the deduction beats are strong.)
- **Instant gratification** — the deduction click and its zoom-out. *This beat is
  missing everywhere in the game today.*
- **Pyramidal growth** — the accreting monument that jumps scale. *Decoupled from
  exploration today.*

You don't need fun in every room. You need this heartbeat to never go slack.

## Plan-for-a-plan (the de-risking sequence)

We do **not** plan the whole fractal game — that is how the Nile happened (content
before proof). We plan the smallest thing that de-risks all of it:

1. **Write this spec.** (This document. Done.)
2. **Grey-box the deduction verb — the Meier gate.** *First pick the mechanic and
   the complicity bridge (the blocking decisions below) — you can't prototype
   "deduction" in the abstract.* Then, no art, no realm, no story: *can the player
   figure out a hidden scheme-shape, feel the click, and have solving it **advance
   the scheme**,* and is it fun for five minutes **with the pyramid payoff off**?
   Nothing else gets built until this passes.
3. **Prove exactly one scale-transition.** One scheme decoded → the zoom-out → it
   is revealed as a node in the next, identical-but-novel scheme. If this one
   Katamari beat lands, the whole game is just this beat, fractally, forever.
4. **Only then** plan the realm-by-realm rollout (each myth as a scale of the
   set). Deferred to its own spec(s) + plan(s).

**Steps 2–3 are where the game lives or dies.** Steps 1 and 4 are bookkeeping
around them. The implementation plan that follows this spec targets **steps 2–3
only.**

## Initial per-realm map (starting point, not exhaustive)

| Realm | Role in the set | Notes |
|---|---|---|
| Desert (`world`) | Scale 0 — your own con / the home monument | The pyramid lives here. |
| Nile (`nile`) | A myth-scheme node (Joseph's grain monopoly, Sobek as collections, the Ferryman's toll) | Recast its narrated myths as *deducible* schemes. Keep the basket complicity fork; give the verb real stakes. Gateway-promise: the reed boat to the unbuilt `sea`. |
| Oasis (`oasis`) | Gateway / inhale | Stays quiet on purpose. Don't force a verb here. |
| Atlantis (`atlantis`) | A myth-scheme node + the explicit recursion (Khet-Amun *before* Atlantis) | Already nearly there as discovery; sharpen the *figuring-out*, don't bolt on twitch. The deepest tablet is the prototype's natural zoom-out. |
| Vault / Deep / Crypt / Council | Further scales / indoor reveals | Map to the set later (step 4). |

## Open decisions / risks

### Blocking — must be settled before writing the implementation plan

1. **Which deduction *mechanic*.** The three reference games are not one verb —
   they are three different games, and you can't grey-box "deduction" in the
   abstract. The choice is governed by the complicity bridge above:
   - **Golden Idol-shaped** — slot the words into the *official account*. Bends
     toward complicity most easily: **solving = writing the lie** (the
     testimonial, the pitch, the cover story that ensnares the next layer).
     *Current lean.*
   - **Obra Dinn fate-matrix** — neutral detective reconstruction. Hardest to make
     complicit.
   - **Outer Wilds pure-knowledge** — furthest from complicity.
2. **The solving = perpetrating bridge** (the discriminating test above) — decided
   together with the mechanic, since they constrain each other.

### To resolve in the prototype (steps 2–3)

- **Deduction content is authored, not procedural.** Each realm's scheme is a
  hand-built puzzle — a scope cost. The plan-for-a-plan exists to prove the verb
  before paying that cost across eight realms.
- **The non-monetary "physical pyramid" currency/loop** needs a name and a model
  (what accretes, how scale-jumps trigger). Step 3 defines the minimum version.
