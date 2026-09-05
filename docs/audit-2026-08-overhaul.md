# Audit — production readiness, trust and conversion

**Date:** 10 August 2026. **Scope:** `app/index.html` (25 screens), `web/`,
`brand/`, `supabase/functions/analyze`, the test suites, and the docs.

This is step 1 of the overhaul brief: *inspect before changing.* Nothing here
is a fix. Every item below was traced through the code rather than judged by
how the screen looks, and every one carries the line and the reasoning that
found it.

**Method.** For each finding: what is wrong → why it matters → how it was
found. Fixes, tests and remaining risk are recorded in step 2 onward, against
these same IDs.

---

## Summary

| Severity | Count | Theme |
|---|---|---|
| **Critical** | 3 | Paid tiers are decorative; a bundle undercuts its own component; the assessment paywall shows no value |
| **High** | 5 | Buy button names the wrong product; back label lies; preview loses its line breaks; refund promise on a prototype; no legal-review governance |
| **Medium** | 6 | No analytics of any kind; thin accessibility for 25 screens; no production error signal; Safari untested; guarantee copy; plan-card claims |
| **Low** | 3 | Cosmetic and documentation drift |

The pattern across the Critical band is one thing, and it is worth naming
before the list: **the commercial layer was designed as copy, not as
behaviour.** The legal engine has been verified article by article and fuzzed;
the payment layer has never been traced end to end. Every Critical finding is
in the half nobody tested.

---

## Critical

### C1 — Every paid tier delivers exactly the same thing

**What is wrong.** `pwPlan` (`app/index.html:6939`) records which tier the
reader selected. It is read in exactly two places: to draw the selected radio
(`:7053`) and to print the price on the button (`:7064`). It is never
persisted and never consulted after payment. Both payment paths —
`pwPay()` (`:7148`) and code redemption (`:7139`) — set a single boolean
(`pwPaid` / `termPaid` / `casePaid`) and route to the same screen.

So:

| Reader pays | Reader receives |
|---|---|
| 65 SAR "Negotiation letter" | The letter |
| 130 SAR "Job-change pack" | The letter |
| 195 SAR "Letter + lawyer review" | The letter |
| 145 SAR "The assessment" | Assessment **+ case file + employer letter** |
| 295 SAR "Assessment, case file and letter" | The same |
| 325 SAR "Case file" | The case file |
| 520 SAR "File + licensed lawyer" | The same |

**Why it matters.** Two of these are not merely a missing feature — they are
untrue statements attached to a price. The 130 SAR pack claims to add "6
months of reminders + unlimited questions on this contract"; reminders
(`trackOrView`, `:6558`) and the assistant (`openAssist`, `:5712`) contain no
payment check at all and are free to every reader. The 195 and 520 tiers
promise a licensed Saudi lawyer reviewing the output within 24 hours; there is
no mechanism in the repository that would deliver that.

For a product whose entire proposition is *never take our word for it*, selling
a deliverable that does not exist is the single most damaging defect in the
codebase. It is worse than a wrong riyal figure, because a wrong figure is an
error and this is a promise.

> **Note, September 2026.** The premise of the paragraph above — that reminders
> and the assistant "are free to every reader" — was about *price*, and that is
> still true: they cost nothing. It is no longer true that they are reachable
> *without an account*; every screen now requires one by explicit founder
> decision. The finding stands as written; only the sentence "free to every
> reader" now needs the word "free" read as costing nothing rather than as
> needing nothing. See `docs/pricing.md`, *September 2026 — an account is now
> required for everything*, for the decision and what it cost.

**How it was found.** Traced `pwPlan` through every reference; then grepped
`trackOrView` and `openAssist` for a paid gate and found none.

### C2 — The 295 SAR bundle contains the 325 SAR product

**What is wrong.** `PLANS_TERM[1]` is 295 SAR for "Assessment, case file and
letter" (`:6957`). `PLANS_CASE[0]` is 325 SAR for the case file alone
(`:6950`). The cheaper item strictly contains the dearer one.

**Why it matters.** Any reader who sees both price lists learns that the
pricing is arbitrary. Price coherence is a trust signal in exactly the same
family as legal sourcing: if the numbers we choose ourselves do not hold
together, the numbers we compute are read the same way.

**How it was found.** Reading the three plan arrays side by side against
`docs/pricing.md`, which justifies each price in isolation and never checks
them against each other.

### C3 — The assessment paywall shows the reader their own answers

**What is wrong.** For `pwMode === "term"` the preview is
`buildTermPreview()` (`:5525`), which is the facts heading plus `termFacts()` —
the reader's own inputs, read back. Not one figure, claim, article or
certainty rating appears. The comment above it (`:7031`) states the intent
plainly: *"Not one riyal figure and not one assessment reaches the DOM before
payment."*

**Why it matters.** The intent — no unpaid result sitting in the DOM behind a
CSS blur — is right and should survive. The execution asks someone who has
just lost their job for 145 or 295 SAR while demonstrating nothing they could
not have written themselves. This is the brief's "the paywall does not
demonstrate sufficient value", and it is Critical because it is simultaneously
the revenue ceiling and a poor experience for a frightened reader.

The correct resolution is not to leak the figures. It is to show *shape*
without *content*: how many claims were found, how many carry a verified
article, what the assessment covers, what could not be assessed and why. That
is real withheld value described honestly, and none of it is a riyal figure.

**How it was found.** Read `renderPaywall` (`:7008`) branch by branch against
each of the three modes.

---

## High

### H1 — The buy button reads "Get my letter" on the case file and the assessment

`pw_pay` (`:1987`) is a single key, `"احصل على خطابي"` / `"Get my letter"`,
printed for all three modes (`:7064`). A reader buying a 325 SAR case file, or
a 295 SAR termination assessment, is asked to confirm a purchase of a letter.
The most consequential button in the product names the wrong product.

### H2 — "Back to score" on screens that have no score

`back_score` (`:1958`) labels the back button on the paywall (`:1348`), which
returns to `case` or `termev` depending on mode, and on `clauses` (`:1706`).
Neither destination is a score. The keyboard/back-gesture map at `:6270`
routes correctly; only the label is wrong. Small, but it is on the screen where
the reader is deciding whether to trust us with money.

### H3 — The paywall preview collapses every line break

`.preview .body` (`:340`) has no `white-space` declaration, while
`.letter .body` (`:377`) sets `pre-line`. The preview is written with
`textContent` from newline-joined strings (`:7043`), so the case-file preview
and the letter preview render as one run-on paragraph. The single screen whose
job is to make the document look worth buying is the one screen that makes it
look unformatted.

### H4 — A no-questions refund promise sits beside "no real payment happens"

`guarantee` (`:1906`) promises a full refund, no questions. `pw_demo`
(`:1989`) states the app is a prototype and no payment occurs. Both render on
the paywall (`:1364`, `:1379`). Whichever is true, one of them is false on the
screen where it is read, and there is no refund process anywhere in the repo
or the runbook.

### H5 — Legal-review governance does not exist

`docs/legal-sources.md` carries 29 verified claims and a "last reviewed" date
of 31 July 2026 for the register as a whole. There is no per-claim review
date, no next-review date, no named reviewer, no change history tied to
affected logic, and nothing in the product surfaces any of it. A register that
is verified once and then ages silently becomes the thing it was built to
prevent.

**This one is blocked on you — see the question at the end.**

---

## Medium

- **M1 — No analytics of any kind.** Grep for beacons, event functions or any
  telemetry returns nothing. Not one of the brief's named events
  (`onboarding_started`, `paywall_viewed`, `purchase_completed`) exists, so
  activation, conversion and drop-off are unmeasurable. The privacy promise
  makes a third-party SDK impossible; a local, privacy-safe event log the
  reader can see and clear is not.
- **M2 — No production error signal.** Already recorded in
  `docs/operations.md` as a known gap; restated here because it belongs in the
  same list.
- **M3 — Accessibility is thin for the surface area.** `:focus-visible`,
  reduced-motion and RTL are handled properly, and `show()` moves focus to the
  heading (`:3261`). But 12 aria attributes across 25 screens is not enough:
  screen changes are not announced, and the dynamic money and claim regions
  have no live-region treatment. Programmatic checks passing is necessary, not
  sufficient.
- **M4 — Safari and iOS never tested.** PDF intake depends on
  `DecompressionStream` and needs Safari 16.4+. Everything to date is headless
  Chromium.
- **M5 — Plan-card feature lists.** Same family as C1, in the subscription
  screen (`PLANS_T`, `:5630`) rather than the one-off paywall. Needs the same
  audit once C1 is resolved.
- **M6 — Redemption codes are client-side only.** Documented honestly at
  `:7085` and in `docs/zid-test-runbook.md`; acceptable for a test of tens of
  buyers, not for launch. Listed so it is not forgotten at the moment it stops
  being acceptable.

## Low

- **L1** — `guarantee` Arabic reads colloquially (`ما أعجبك؟`) against the
  formal register used elsewhere.
- **L2** — `docs/pricing.md` justifies each price alone and has no
  cross-consistency check, which is how C2 survived.
- **L3** — `docs/lawyer-review-pack.md` and `docs/legal-sources.md` will
  contradict each other the moment H5 is answered.

---

## What I checked and found sound

Recorded so the list is not mistaken for the whole picture:

- The money core (`awardBase`, `compFor`, `noticeFor`, `leaveFor`,
  `resignFactor`, `exc87Applies`) is shared by both flows, guarded for
  finiteness, and fuzzed with invariants.
- The Article 76 scope guard correctly refuses to reach non-Saudis.
- The deterministic reviewer blocks display rather than warning
  (`assessmentSafe`), and the AI second pass cannot move a riyal figure — its
  output is a closed enum that maps to our own re-checks.
- The two-kind sourcing split (law § vs methodology, italic) holds everywhere
  I traced it.
- Zero off-origin requests; the CSP is tight; no plaintext codes and no
  service-role key anywhere in the repo.
- The pre-push gate runs every suite and refuses a red push.

---

## Step 2 — what changed, and what risk is left

Every row below states what was wrong, what was changed, how it was tested, and
what remains. All nine suites are green.

### C1 — Every paid tier delivered the same thing → **fixed**

Three booleans became one entitlement record, `owned = { letter, case, term }`,
holding a plan id rather than a flag. `grantAndGo()` is now the only route to
the paid state — both the pay button and code redemption land there — and
`has(mode, tier)` is the only question anyone asks about entitlement.

- The employer letter and the case file now sit behind `plan_term_full`.
  Holding only `plan_term`, the buttons become an upgrade priced at the
  difference (150 SAR) rather than dead controls or a silent handover.
- The pack's description was a false statement attached to a price: reminders
  and the assistant are free to every reader and always have been. It now sells
  a further letter for any new contract for six months — withheld, delivered,
  and stored as a real expiry rather than a flag.
- The lawyer tiers do not render at all while `LAWYER_DESK.live` is false. The
  request desk exists and is tested; nothing states a turnaround until one is
  set.

**Tested:** `test/commerce.test.js` buys the cheaper tier and asserts the letter
does *not* open, that the upgrade is priced at the difference, that paying it
returns the reader to the step they were on, and that the higher tier then
delivers. Entitlement is asserted to survive a reload, and a hand-edited
`localStorage` payload is asserted not to mint an unknown tier.

**Remaining risk:** entitlement is still enforced in the reader's own browser.
Anyone opening the developer tools can set `owned` themselves. That is
unchanged by this work and documented where the redemption codes are — it is
acceptable for a test of tens of buyers and not for launch.

### C2 — A 295 SAR bundle contained a 325 SAR product → **fixed**

Prices became numbers rather than two hand-written strings each, and the
containment rule became `ladderBreaks()`, which returns every pair where a
bundle costs no more than something it contains. Case file 325 → 245, case file
+ lawyer 520 → 395.

**Tested:** the suite asserts `ladderBreaks()` is empty, so any future price
edit that reintroduces the collision fails the build.

**Remaining risk:** none of these prices has met a paying customer. The ladder
is coherent; whether it is *right* is still unvalidated, as `docs/pricing.md`
has always said.

### C3 — The paywall showed the reader their own answers → **fixed**

The rule it was protecting was correct and survives: no computed figure reaches
the DOM before payment. What was missing is that the *shape* of the work is not
the work. The paywall now states how many entitlements were found and names
them, how many cite a verified article versus Wodouh's own reading, how many
items could not be assessed and what each one needs, and that every amount
carries a rule, a source and a certainty.

**Tested:** the suite asserts that none of the case's computed amounts appear
anywhere in the paywall's text or markup, in Latin or Arabic-Indic numerals,
while the shape block is present and populated.

**Remaining risk:** for a reader with very few entitlements the shape block is
thin. That is honest rather than a bug — but it means the paywall is least
persuasive exactly where the claim is smallest, which is worth watching once
there is conversion data to watch it with.

### H1–H4 → **fixed**

| ID | Change |
|---|---|
| H1 | `pw_pay_case` and `pw_pay_term` added; the button names what it sells |
| H2 | The paywall's back label is set per destination — `back_case`, `back_ev` |
| H3 | `.preview .body` gained `white-space:pre-line`, matching `.letter .body` |
| H4 | One `PAYMENT_LIVE` flag drives both the prototype note and the refund promise, asserted mutually exclusive |

### H5 → **still blocked.** See below.

---

## The one question that blocks step 4

The brief states, as a new fact, that *"the legal content and the 29 currently
verified claims have been reviewed by a qualified lawyer."*

`docs/lawyer-review-pack.md:54` currently states the opposite in as many
words: **"No qualified lawyer has reviewed any of it."**

I can write the review into the register and surface a "last legal review" in
the product, but not from that sentence alone. To represent it *accurately* —
which is the brief's own standard — I need three things:

1. **Who.** Name and licence number, or the firm, as it should appear.
2. **When.** The date of the review.
3. **The outcome per claim.** Confirmed as written, confirmed with a change,
   or not covered. All 29 marked "reviewed" on one reviewer's say-so, with no
   per-claim record, would manufacture exactly the authority this product
   exists to avoid.

Everything else in the overhaul proceeds without this. Only H5, the "last
legal review" surface, and the monthly-review system wait on it.
