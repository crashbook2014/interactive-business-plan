# Wodouh — full code review

**24 August 2026.** Against commit `939e8c0`, working tree clean, 22 suites and
the type-check green before this review started and untouched by it. Nothing in
`app/`, `admin/`, `supabase/` or `test/` was changed — this file is the only
thing the review wrote.

**Scope.** 121 tracked files, ~19,750 lines of non-test source. The last code
audit (`audit-2026-08.md`, `audit-2026-08-overhaul.md`) ran 1–12 August, so
everything shipped since has been read by nothing but its own tests: the August
catalogue, email sign-in, the account-backed scan record, the console rebuild,
and migrations `0006`–`0009`. That is where the weight went, and that is where
every finding below came from.

**Method.** Findings are demonstrated, not asserted. Each one names the file and
line, and says how it was reproduced. Where I could not reproduce something, it
is not in this list.

---

## Verdict

**Do not switch payments on until C1 and C2 are fixed.** Everything else here
can ship behind them.

The architecture is sound and the security model holds — I tried to break the
authorization layer and the injection surface and could not. What is wrong is
concentrated in one place: **the commerce layer written on 23 August**, which is
eight days newer than any audit and is the only part of this product that moves
money. Two defects there are live and reachable through the shipped UI. One
gives away product; the other takes 199 SAR and delivers nothing.

The third theme is smaller but worth naming: **the Terms page did not keep up
with the catalogue.** It describes a product with only one-time purchases and
makes a promise about the AI that the grader does not actually keep.

---

## Critical — fix before money moves

### C1 · Buying anything tops up the five-review pack

`app/index.html:10681`

```js
if (owned.review === "plan_reviews5"){
  if (packUntil < Date.now()){ packUntil = …; packLeft = PACK_CREDITS; }
  else packLeft += PACK_CREDITS;
}
```

This block runs on **every** purchase and is gated only on what the reader
already holds — never on what they just bought, and never on `pwMode`. So a
reader holding the pack is given five more review credits every time they buy
anything at all.

**Reproduced** by driving the real `grantAndGo()`:

```
bought plan_reviews5 (699) → packLeft=5
bought plan_letter    (149) → packLeft=10
bought plan_case      (349) → packLeft=15
```

699 SAR buys five reviews. A further 149 SAR buys five more. The load-time
clamp at `app/index.html:9440` caps the stored value at `PACK_CREDITS * 4` = 20,
so the damage is bounded at roughly **15 free reviews (≈2,100 SAR at the single
price)** — bounded, not prevented.

**Why it matters:** it is the only defect here that scales with how much a
customer spends, and it rewards exactly the best customers.

**The shape of the fix:** gate the top-up on the product actually purchased
(`want === "plan_reviews5"`), not on the entitlement already held.

---

### C2 · Paying at the scan limit does not analyse the contract you paid for

`app/index.html:10349` (`scanGate`), against `app/index.html:10353` (the
sign-in branch) and `resumeScan()` at `10366`

`scanGate()` has two ways to interrupt a scan, and they are not symmetrical:

| branch | records the pending scan | resumes it |
|---|---|---|
| not signed in | `pendingScan = kind` | yes — `resumeScan()` calls `analyze(kind)` |
| **no scans left** | **nothing** | **no** |

The paywall branch sets `pwMode`, `pwOrigin`, `pwPlan`, `pwUpgrade` and
`pwUpBack` — five pieces of state — and omits the one that remembers what the
reader was trying to do.

**Reproduced** with a signed-in reader at their limit, scanning a *new*
contract while a previous one is on screen:

```
before:  scansLeft=0  current.doc=doc_emp
scanGate('rent') → false, screen-paywall, pendingScan=null
after paying 199 → screen-result, current.doc=doc_emp, pendingScan=null
```

The reader pays 199 SAR and is shown **the previous contract's result**. The
contract they paid to have reviewed is never read.

**Why it matters:** this is a payment taken for a service not delivered, in the
default flow, at the exact moment the reader is most likely to be in crisis.
It is also the failure most likely to produce a chargeback, which is the thing
a new merchant account can least afford.

**The shape of the fix:** set `pendingScan = kind` in the paywall branch too,
and resume it from `grantAndGo()` the way `resumeScan()` already does.

---

## High

### H1 · The Terms promise a guarantee the grader does not keep

`terms/index.html` (both languages) against
`supabase/functions/_shared/grade.mjs:43` and `:52`

The Terms say, as a binding statement:

> "no article number and no riyal figure is shown unless it appears in a source
> we have verified, or the whole answer is refused"

and in Arabic:

> «لا يُعرض رقم مادة ولا مبلغ ريال إلا إذا كان في مصدر موثّق لدينا، وإلا رُفض
> الجواب كاملًا»

Both checks are keyed on a **word**, not on a number. `moneyIn()` only matches a
figure adjacent to `SAR`/`SR`/`ريال`/`﷼`; `articlesIn()` only matches a number
preceded by `article`/`art.`/`المادة`/`المواد`. Drop the word and the check is
blind.

**Reproduced against the real grader**, citing a row that contains neither
figure:

| answer | verdict |
|---|---|
| `You are owed SAR 45,000.` | **REFUSED** (money) ✅ |
| `You are owed 45000.` | **SHOWN, tier=verified** ❌ |
| `المستحق لك هو 45000 تقريبا.` | **SHOWN, tier=verified** ❌ |
| `Under 77 of the Labor Law you may claim.` | **SHOWN, tier=verified** ❌ |
| `Art 77 applies here.` | **SHOWN, tier=verified** ❌ |

A reader who sees "your benefit works out to 45000" reads riyals. The guarantee
holds against a model that phrases things conventionally and fails against one
that does not — and the whole point of a grader is that it does not depend on
the model's goodwill.

A second, smaller leak in the same function: `allowedNums`
(`grade.mjs:105`) is built from **every digit in the cited rows' claim text**,
not from the figures in them. 18 of the 29 corpus rows have digits in their
claim — `art-75` contributes `{60, 30}`, `art-109` contributes `{21, 30}` — so
citing them permits "SAR 60" or "30 ريال" as sourced money.

**Note this is currently unexposed**: the AI ships inert with no API key, so no
reader has met it. That is why it is High and not Critical — but it must be
fixed *before* the key is set, not after.

**The shape of the fix:** either tighten the grader (treat bare 4+ digit numbers
in a money context as money; widen the article pattern), or soften the Terms to
describe what the code actually does. The first is better; the second is
mandatory if the first is not done.

---

### H2 · The Terms never heard about the subscription or the pack

`terms/index.html` — last touched `25f80a4` (22 Aug), the day **before** the
catalogue landed in `2d75094` (23 Aug).

Counts of every relevant word in that file, both languages:

```
subscription 0   monthly 0   recurring 0   cancel 0
pack 0           expire 0    اشتراك 0     شهري 0
إلغاء 0          باقة 0
```

The "Prices and payment" section says, in full: *"A one-time purchase stays
available on that device."* That is the only commercial model it describes.

Meanwhile the app sells:

- **`plan_biz`, 799 SAR/month**, `monthly:true, sub:true` — a recurring charge
  with no stated billing period, no renewal terms and no cancellation route
- **`plan_reviews5`, 699 SAR** — credits that **expire after twelve months**

`refund/index.html` *was* updated on 23 August and covers the pack properly.
The Terms were simply missed. The plan for the pricing change said in as many
words that both belonged there.

**Why it matters:** a recurring charge with no cancellation terms is a standard
reason for a gateway to decline or later suspend a merchant, and Tap and Moyasar
both read these pages during approval. This is on the critical path to being
paid, not merely a documentation gap.

---

## Medium

### M1 · The bundle prices at zero through the upgrade path

`app/index.html:10227` (`upgradeCost`) with `10209` (`activePlans`)

`upgradeCost()` looks the target tier up in `PLAN_SETS[mode]`, which
deliberately **excludes** `BUNDLE` (correctly — it would break the ordinal
ladder). So `planIndex(mode, "plan_bundle")` is `-1`, `want` is `undefined`, and
the function returns its `0` fallback.

But `activePlans()` builds the upgrade offer from `offeredPlans(mode)`, which
**does** include the bundle. The two disagree.

**Reproduced:**

```
upgradeCost("review","plan_bundle") = 0
upgradeCost("letter","plan_bundle") = 0
upgradeCost("case",  "plan_bundle") = 0
activePlans() with pwUpgrade="plan_bundle" → [ plan_bundle : 0 ]
```

The 549 SAR bundle is offered at 0 SAR.

**It is latent, not live** — only because of M2. `activePlans()` is nonetheless
written to construct exactly this, so the bug is one wired-up button away.

### M2 · The entire upgrade path is dead code

`app/index.html:10416`

`openUpgrade()` is defined and **never called** — a `grep` for `openUpgrade(`
returns only its own definition. Everything downstream of it is therefore
unreachable: `pwUpgrade`, `pwUpBack`, the `pw_up_title` and `pw_pay_up` copy
keys in both languages, the `up:true` branch of `activePlans()`, the
`wasUpgrade` return path in `grantAndGo()`, and `upgradeCost()` itself.

This is what let M1 sit unnoticed, and it is a feature the copy already promises
("pay the difference, never the full price twice"). Either wire it up — after
fixing M1 — or delete it. Leaving unreachable code that computes prices is the
worst of the three options.

### M3 · The pack refund formula goes negative

`refund/index.html:107`

> "If you have used some, we refund what is left valued at the single-review
> price (199 SAR)"

Against a 699 SAR pack of five:

| reviews used | refund |
|---|---|
| 1 | 500 |
| 2 | 301 |
| 3 | 102 |
| **4** | **−97** |

At four used the policy as written says the customer owes money. It needs a
floor at zero, or a different formula.

### M4 · The 349 case file is bought once and kept forever

`app/index.html:4903` and `has("case")`

`analyze()` spends the single-contract tiers on a new contract:

```js
owned.letter = null;
if (owned.review === "plan_review") owned.review = null;
```

`owned.case` is **never set to null anywhere in the file.** The case file is
built from `eosData`, not from the scanned contract — so not clearing it on a
new *contract* is correct. But `eosData` is reassigned (`:6093`) every time the
calculator runs, and nothing clears the entitlement then either.

**Reproduced:**

```
after buying plan_case (349): has('case')=true
new assessment, different dates and wage: has('case')=true
  → openCasePaywall would SHOW THE DOCUMENT FREE
for comparison, the 149 letter after a new contract: owned.letter=null
```

So the **cheapest** single-use product (149) is metered per use and the **most
expensive** one (349) is unlimited for life. Nothing in the code, the catalogue
or `docs/pricing.md` says the case file is unlimited, and it carries neither
`credits` nor `monthly` — the two markers this codebase uses for "more than
once".

I cannot tell from the code whether this is generosity or an omission. It needs
a decision, and then either a `owned.case = null` beside the other two or a
sentence on the card saying it covers every assessment.

### M5 · The free-scan month boundary mixes local and UTC time

`app/index.html:10302` (`monthStartISO`) against `10315` (`thisMonth`)

```js
new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1))   // local Y/M, UTC instant
```

The server query counts rows since **00:00 UTC** on the 1st; `thisMonth()` and
the reader's sense of "this month" are **local**. In UTC+3 that is a three-hour
seam each month: scans made between 00:00 and 03:00 local on the 1st are not
counted at all, and scans made after 21:00 local on the last day are charged to
the following month.

Small, but it is a limit the product now describes to readers, and the fix is to
compute the boundary in one timezone.

---

## Low

### L1 · A stale comment quotes prices that no longer exist

`app/index.html:10670`–`10680` carries the same explanation twice, and the first
copy reasons about *"the repeat buyer paid 130 SAR and received the 65 SAR
product"*. Neither figure has existed since 23 August. Delete the first
paragraph.

### L2 · "Verified claims" is 29 or 30 depending on who counts

`docs/legal-sources.md` has **30** rows whose status cell contains `✅ verified`,
but one of them — **Article 81** — reads `"✅ verified as to the grounds; the
award consequence is a reading, see below"`.

The strict consumers get this right and agree on **29**:

- `tools/make-corpus.mjs:92` requires `/^✅\s*verified$/` — excludes it
- `admin/admin.js:93` requires `/✅\s*verified\s*\|/` — excludes it
- `supabase/functions/_shared/corpus.json` — 29 rows

Anything counting the tick loosely gets 30. **I made exactly that mistake in the
roadmap artifact published earlier today** and have corrected it there. The
product is right; the trap is real and worth a note in the register itself so
the next person counting does not fall in.

---

## What I tried to break and could not

Stated because a review that lists only faults tells you nothing about where
*not* to spend your time.

- **Injection through an uploaded contract.** I pasted a contract carrying
  `<img src=x onerror=…>` and `<script>` into the analyser and drove it through
  to the clause view, which quotes the reader's own sentences back. The markup
  rendered as **visible text**; `window.__pwned` was never set, no injected node
  entered the DOM, no dialog fired. The quote surface escapes correctly.
- **The authorization model.** All **9** tables have RLS enabled. All **10**
  `SECURITY DEFINER` functions have their EXECUTE revoked naming `public`,
  `anon` **and** `authenticated` — the gap `0006` was written to close does not
  recur anywhere, including in `0008` and `0009`, which are the newest.
  `is_admin` keeps its `anon` grant, deliberately and correctly.
- **Secrets in the shipped bundle.** No `service_role`, no `sb_secret`, no
  `GOCSPX`, no `sk-ant`, no API key anywhere under `app/`, `admin/`, `brand/`,
  `privacy/`, `terms/`, `refund/` or the root `index.html`.
- **Price consistency.** All nine catalogue figures appear identically in
  `app/index.html`, `docs/pricing.md` and the refund page. `ladderBreaks()`
  returns empty — containment holds across all sets including the cross-mode
  bundle.
- **Corpus integrity.** `tools/make-corpus.mjs` regenerates
  `corpus.json` byte-for-byte from the register; the disputed Article 53 row is
  excluded by construction, as designed.
- **Rate limiting** is present on the analyse endpoint (`index.ts:453`) and the
  bucket function is service-role only.

The grader's *design* is right, too — refusing the whole answer rather than
editing a citation out of it is the correct call, and the reasoning is written
down. H1 is a gap in its matchers, not in its architecture.

---

## What could not be verified here

Named rather than inferred, and none of it is a finding:

- **No live Postgres.** Every RLS claim above is read from the migration source.
  That the database *enforces* it is untested here, as in every prior audit.
- **No live model.** The grader was exercised against its own real code with
  crafted completions — not against Anthropic. What a real model actually emits
  is unknown.
- **`alwodouh.com` is unreachable** from this sandbox (the egress proxy refuses
  it), so nothing here describes the deployed site, only the committed tree.
- **No iOS device.** Safari remains the least-tested surface.
- **The Saudi law itself was not re-verified.** That stays a human check, and
  the lawyer review remains the critical path it has been since 1 August.
- **CI has still never run**, so "22 suites green" continues to mean green on
  one machine.

---

## Recommended order

| # | Item | Why this position |
|---|---|---|
| 1 | **C2** — resume the paid scan | Taking money for nothing. One line of state. |
| 2 | **C1** — gate the pack top-up | Giving away product, scales with spend. |
| 3 | **H2** — Terms cover the subscription and the pack | On the critical path to gateway approval. |
| 4 | **M3** — floor the refund formula | Same document set, same review pass. |
| 5 | **M4** — decide what the case file covers | A pricing decision, therefore yours, not mine. |
| 6 | **H1** — tighten the grader, or the Terms | Must land before the API key is ever set. |
| 7 | **M1 + M2** — fix `upgradeCost`, then wire or delete | Do them together; separately, M1 hides again. |
| 8 | **M5, L1, L2** | Housekeeping. |

Items 1, 2, 4 and 8 are mechanical and I can do them on your word. Item 5 is a
price decision and item 3 contains legal wording — both are yours, and the
project's standing rule that prices, privacy copy and legal claims are always a
human decision applies to every line of them.
