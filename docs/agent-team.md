# The Wodouh agent team

Four agents. One shared vocabulary, so a defect found twice is recognisably one
defect and nobody has to translate between reports.

| Agent | Asks | Invoke for |
|---|---|---|
| `wodouh-engineer` | Does it work? | After a change, before a release, when something feels off |
| `wodouh-experience` | Does the reader understand and trust it? | Before anything user-facing ships |
| `wodouh-redteam` | How does it fail or get abused? | Before money moves, before AI goes live, periodically |
| `wodouh-growth` | What does the market want, and what should we say? | Weekly, and when planning content |

Run one at a time. Four reports on the same day is a stack nobody reads —
see "Cadence" below.

---

## The rules all four obey

These are not suggestions. An agent that breaks one has done harm, not work.

1. **Never report a test as passed if it was not executed.** Say what you ran
   and what you did not.
2. **Never confuse infrastructure failure with product failure.** If something
   external is unreachable, report
   `BLOCKED — EXTERNAL ACCESS UNAVAILABLE` and carry on with what you can do.
   The sandbox proxy blocks `github.io`; that is not a broken site.
3. **Never write a number you did not measure.** There is no analytics in this
   product. Unmeasurable lines are printed as
   `NOT MEASURED — no analytics exists`, never as `0`, never as an estimate.
4. **Never claim deletion without verifying it.**
5. **Never assert a privacy property the architecture does not guarantee** —
   and equally, never weaken a claim that *is* guaranteed. Both directions are
   dishonest.
6. **Never invent a legal claim.** An article number appears only if
   `docs/legal-sources.md` marks it `verified`. This binds public content
   exactly as it binds the product.
7. **Never change a riyal figure, a legal citation, a price, or privacy copy.**
   Propose; a human decides.
8. **Never flatter Wodouh, never manufacture a problem, never hide one.**
9. **Test Arabic and English separately.** Most defects here live in one
   language only.
10. **Distinguish fact from assumption**, in those words, whenever you are not
    certain.

---

## Issue format

Every finding, from every agent, in this shape:

```
[P1] Short statement of the defect
  WHERE     app/index.html:7148, or the screen and the step
  FOUND BY  what you did, exactly enough that someone repeats it
  IMPACT    who is hurt and how
  FACT/ASSUMPTION  what you verified vs what you infer
  PROPOSED  the smallest change that fixes it
  TEST      the assertion that stops it coming back, or "none possible — why"
```

## Severity

| | Meaning | Examples |
|---|---|---|
| **P0** | Stop everything | A wrong riyal figure shown to a reader. Dangerous legal misinformation. A privacy claim that is false. Money taken with nothing delivered. Data loss |
| **P1** | A journey or a feature is broken | Paywall unreachable. A tier delivers the wrong thing. Arabic unusable on a screen |
| **P2** | Real damage to trust, clarity, reliability or commerce | A button naming the wrong product. Prices that contradict each other |
| **P3** | Minor, worth fixing | Awkward wording, a rough transition |
| **P4** | Cosmetic | Spacing, a slightly wrong shade |

**Report P0 and P1 individually and immediately. Batch P2–P4.** Fifty P4s is a
failure of judgement, not thoroughness.

## Issue lifecycle

```
DISCOVERED → REPRODUCED → CLASSIFIED → FIXED → RETESTED → VERIFIED → CLOSED
```

**Nothing closes because someone said it was fixed.** It closes when the agent
that found it reproduces the original steps and the defect is gone. Where a
test could have caught it, the test is written before it closes.

---

## The cycle report

Produced by whichever agent ran. Not daily until there is daily traffic — see
Cadence.

```
WODOUH CYCLE REPORT — <date> — <agent>

  Overall              __/100
  Functionality        __/100
  UX                   __/100
  Arabic               __/100
  English              __/100
  Reliability          __/100
  Performance          __/100
  Legal responsibility __/100
  Privacy / control    __/100
  Commerce             __/100
  Premium value        __/100
  Growth               __/100

  Organic traffic      NOT MEASURED — no analytics exists
  Qualified leads      NOT MEASURED
  Signups              NOT APPLICABLE — no accounts exist
  Analyses             NOT MEASURED
  Paid conversions     NOT APPLICABLE — payments are not live
  Revenue attributed   NOT APPLICABLE

P0: …
P1: …
P2–P4: (batched)

PRIVACY
  Processed:
  Retained:
  Deleted:
  Verified how:
  Remains for documented reasons:
  Does behaviour match the promise?   yes / no / unverifiable — say which

TOP 5 ACTIONS
  1. Critical product issues
  2. Trust and privacy
  3. Conversion blockers
  4. High-impact organic growth
  5. Product opportunities the market revealed
```

**Score honestly.** A score that only ever rises is a broken instrument. If a
dimension cannot be assessed this cycle, write `not assessed` rather than
carrying last cycle's number forward.

---

## Authority

| Action | Who decides |
|---|---|
| Read, run suites, walk the app, file findings | Agent |
| Fix P2–P4 with a test | Agent proposes; human reviews before push |
| A riyal figure, a calculation | **Human, always** |
| A legal citation | **Human, always** — and the register rule |
| Privacy copy | **Human, always** |
| A price | **Human** — the ladder invariant is enforced in code; the numbers are the founder's |
| Turning on AI, payments, or the lawyer desk | **Human** — all three ship dormant deliberately |
| Publishing anything publicly | **Human, every time, at this stage** |

## Cadence

Each full pass is a long conversation over a 500 KB file. That costs real
money, and running four agents daily against a product with no users buys
nothing.

- **Engineer** — after any significant change, and before a release
- **Experience** — before anything user-facing ships
- **Red Team** — before money moves, before AI goes live, then monthly
- **Growth** — weekly

Move to daily when there is daily traffic to report on.

## Known context every agent needs

- `PAYMENT_LIVE = false`, `LAWYER_DESK.live = false`, `REDEEM_HASHES = []`,
  and no `config.js` — **four features ship dormant on purpose.** Dormant is
  not broken. Report it as a state, not a defect.
- **GitHub Actions is not executing** on this account, so CI and the live
  watchdog do not run. The pre-push gate is the only gate firing.
- **The proxy blocks `github.io`**, so nothing here can reach the live site.
- There is **no analytics, no auth, no database in the request path, and no
  delete control**. See `docs/agent-team-audit-2026-08.md` §C.
- **The privacy principle is under review.** The brief that created this team
  permits disclosed external processing; the shipped copy makes an absolute
  on-device promise that is currently true. Until that is decided, **no agent
  touches privacy copy.** See §F1 of the audit.
