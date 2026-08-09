# Termination assessment — verification record

**9 August 2026.** What was checked, against what, what it found, and what
still cannot be verified here.

Three defects were found by this pass. All three were in the money, all three
are fixed, and **one of them overstated** — which is a different and in some
ways worse failure than the two that understated.

---

## A. Sources

The instruction was to prefer official government sources. Direct page fetches
of `hrsd.gov.sa`, `laws.boe.gov.sa` and `qiwa.sa` are **blocked by this
environment's network proxy** — that has not changed. What does work is search
restricted to those domains, which returns MHRSD's own pages and its published
Labor Law PDF.

**Verified against MHRSD directly:** Articles **53, 75, 76, 77, 80, 81, 84, 85,
87, 88, 109, 111**, plus the friendly-settlement procedure and the
notice-period job-search entitlement.

This is a real upgrade on the previous round, where four of those rested on
firm commentary. It is still short of reading the gazette in a browser, and the
register says so rather than rounding up.

| Topic | Article | Status |
|---|---|---|
| Termination of contracts | 74, 75, 77, 80 | ✅ official |
| Fixed-term vs indefinite | 37, 77 | ✅ (37 via Qiwa) |
| Notice periods | 75, 76 | ✅ official |
| Compensation for termination | 77 | ✅ official |
| Probation | 53 | ✅ official |
| End-of-service | 84, 85, **87** | ✅ official |
| Unused annual leave | 109, **111** | ✅ official |
| Unpaid salary | — | no article; labelled as our reading |
| Allowances and commissions | — | contract-governed; labelled as our reading |
| Resignation vs termination | 79, 85, **87**, 81 | ✅ official (one reading, below) |
| Termination for cause | 80 | ✅ official |
| Contract expiry / non-renewal | 37, 74 | ✅ |
| Final settlement timing | **88** | ✅ official |
| Dispute resolution | — | ✅ official (MHRSD procedure) |

---

## B. What the legal check found

### B1 — Article 87 was missing, and its absence understated awards · FIXED

Article 85 reduces the award on resignation. **Article 87 defeats that
reduction** in two cases: a worker who leaves for a force majeure beyond their
control, and a female worker who ends her contract within six months of
marriage or three months of giving birth.

A woman who resigned two months after giving birth was being shown a third of
her award at three years' service, and **nothing at all** under two years.

The flow now asks directly, on the resignation path only, and pays the full
award where an exception applies.

### B2 — The Article 85 five-year boundary was read the wrong way · FIXED

**This one overstated.** The statute gives one third *"after service of not
less than two consecutive years and not more than five years"* and two thirds
*"in excess of five"*. Five years exactly therefore takes **one third**. The
code took two thirds: **16,667 SAR where 8,333 was due** on a 10,000 wage.

An inflated figure is what somebody carries into a settlement meeting. The
register row now states the boundaries in the statute's own words instead of
the shorthand "2–5 / 5–10", which is what made the error easy to write and
hard to see.

### B3 — Missing information was being answered with silence · FIXED

If the reader never told us their leave balance, no leave line appeared — and
an absent line reads as "nothing is owed here". That is an answer we had not
earned.

There is now a **"What we could not assess"** section that names each line we
could not compute and what input it needs, with the sentence the brief asks
for: *we need more information before we can assess this accurately*. Absence
from the money list no longer implies zero.

### B4 — One claim is deliberately marked as a reading, not a citation

Article 81's **grounds** are quoted verbatim by official sources. Its **award
consequence** — full Article 84 award rather than the Article 85 tiers — rests
on *"without prejudice to all of his statutory rights"* plus consistent
commentary. **No official page states the consequence in those words.**

It is therefore shown as **Likely**, never Confirmed, and it is the first
question in the lawyer pack.

### The pattern worth naming

Two of these three came from the same place: **a rule that reduces an
entitlement was shipped without its exceptions.** That is now a standing check
on any new rule.

---

## C. Calculations

Verified programmatically, not by reading. Three layers:

1. **Invariants** (`calc-fuzz`) over the shared money core — never negative,
   never non-finite, monotonic in service, and the Article 77 two-month floor
   holds for every combination of wage, years, branch and remaining term.
2. **Hand-checked worked examples** (`termination`, `scenarios`) — the award
   recomputed independently in the test, not asserted against the app's own
   output.
3. **A 560-case matrix** — two tracks × seven endings × five wages × eight date
   spans, including reversed dates, unparseable dates, future dates, zero wage
   and 10,000,000. Every combination is asserted finite, non-negative, and free
   of `NaN`, `Infinity`, `undefined` and `null` **in the rendered screen**, not
   just in the return value.

Four non-finite paths were found and closed in the core: every guard tested
positivity but not finiteness, and `Infinity` passes `> 0`. The sharpest was
fully-served notice computing `0 * (wage/30)`, which is `NaN`.

---

## The second pass

A **deterministic critical reviewer** runs on every assessment, offline, before
anything is displayed. It is not a repeat of the first answer — it asks what a
sceptic would:

- dates that cannot be true (reversed, future start, implausible term)
- contradictions between answers (award received but no settlement; notice
  during probation; indefinite contract on the resident track)
- double counting, and any line claimed after the reader said it was paid
- scope errors — Article 76 reaching a fixed-term contract
- a strength rating stronger than the evidence carries
- lines resting on inputs we were never given

Findings are graded. **Blocking findings stop the result entirely** rather than
annotating it; everything else is displayed under *"We reviewed our own
result"*. Then a **17-point verified check** runs, and anything it cannot
satisfy is shown as *"What we could not verify"* rather than passing silently.

**An AI second pass over the assessment was subsequently added**, on request.
It runs before display when configured and consented, and it is bounded by one
rule: **the model cannot move money.**

A concern it returns may only trigger a deterministic re-check the app already
owns, or appear as a visible note labelled *Unconfirmed*. It can never write an
amount, remove a line, or change a certainty level. Concerns arrive as codes
from a closed enum, dropped on the server if unrecognised and dropped again in
the browser — so a completion talked out of its role has nothing to steer.

That bound is tested under attack: every code at once, each carrying an
instruction to rewrite the total, across all 16 scenarios. The figures come
back byte-identical.

The deterministic pass remains the one that actually corrects, because the
brief requires that an identified error *is* corrected and a model cannot
guarantee that. The AI pass notices; the app decides.

It sends more than the contract read does — dates, wage, every amount, and the
free-text reason — so it has **its own consent**, and the consent copy names
the reason field explicitly, because that is where a reader might have typed an
employer's or manager's name.

---

## What still cannot be verified here

- **No lawyer has reviewed any of it.** 29 claims are waiting in
  `docs/lawyer-review-pack.md`. This feature raises the cost of that gap: it
  puts riyal figures in front of someone who has just lost their income.
- **Official sources were read through search, not a browser session.** The
  proxy blocks the domains directly.
- **Real Safari, iOS and Android.** All testing is headless Chromium.
- **Screen readers.** Programmatic checks only.
- **The Claude path end to end.** Verified against a stub; never against the
  live API, because that needs credentials this environment does not have.

---

## Suites

| Suite | Covers |
|---|---|
| `calc-fuzz` | Invariants over every calculation and the shared core |
| `scenarios` | 16 named scenarios + 560-case calculation matrix |
| `termination` | Money, legal scoping, paywall leakage, tampered storage |
| `termination-ui` | The flow as clicked, both languages, RTL, touch targets |
| `claude-path` | Zero off-origin requests unconfigured; consent; injection |
| `routing`, `routing-shadowing` | Assistant retrieval |
| `surfaces` | The screens no other suite touches |

All eight pass.
