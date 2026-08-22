# The four-agent operating team — audit before build

**Date:** 11 August 2026. Written before any agent was created, because the
brief says inspect first and because three items below change what the agents
should be told to do.

---

## A. Current system audit

### Architecture

One self-contained file. `app/index.html` is 509,601 bytes — 25 screens, a
772-key bilingual dictionary, the whole legal engine, and every calculation.
**No framework, no build step, no runtime dependency, no package manager in the
shipped artifact.** `package.json` exists solely so the test suites can run.

Deployment is GitHub Pages from `main`. There is no server in the request path:
push, and it is live. That is why the pre-push gate matters more here than CI
would elsewhere.

### What is actually running in front of a reader

| Layer | State |
|---|---|
| Frontend | `app/index.html`, live |
| Landing / brand | `index.html` (root), `brand/index.html`, live |
| Home-screen install + offline | `app/manifest.webmanifest`, `app/sw.js`, live |
| Backend | **None in the request path.** Supabase code exists, is deployed nowhere |
| Auth | **None.** No sign-in exists in the app at all |
| Database | **None in use.** Two migrations written, never applied |
| Payments | **None.** `PAYMENT_LIVE = false`; `REDEEM_HASHES` empty |
| AI | **None.** No `config.js`, so `analyzeUrl()` returns null and the feature does not exist |
| Analytics | **None.** No events, no beacons, nothing |
| CI | Registered, **not executing** — account-level, see `docs/operations.md` |
| Live watchdog | Written, blocked behind the same Actions problem |
| Pre-push gate | `.githooks/pre-push`, working, the only gate actually firing |

### Data flow, as it exists today

```
PDF / photo / pasted text
   → parsed in the browser (DecompressionStream for PDF)
   → matched against rules in the page
   → score, flags, figures rendered
   → nothing transmitted anywhere
```

`localStorage["wodouh.v1"]` holds: nationality track, two dismissal flags,
redeemed code hashes, entitlements, the termination answer set, up to 8 past
contract scores, and tracked deadlines. **It never holds contract text.**

Every value is rebuilt field by field on read, so a hand-edited payload cannot
reach the money.

### Tests

Ten suites, ~32 seconds, all green: `calc-fuzz`, `routing`,
`routing-shadowing`, `pwa`, `surfaces`, `commerce`, `termination`,
`claude-path`, `termination-ui`, `scenarios`. `test/run.js` refuses to start if
a `.test.js` exists that is not in its ORDER list, so a test cannot exist
unrun.

### Existing agent

One: `.claude/agents/wodouh-engineer.md`. On-demand, not scheduled. Its last
pass found the buy button naming the wrong product, "Back to score" with no
score, a paywall showing only the reader's own answers, and a 295 SAR bundle
containing a 325 SAR product — **all of which passed every test suite**, and
all of which are now fixed and guarded by `test/commerce.test.js`.

**It has one defect right now:** its brief instructs it to begin with
`node test/watchdog.js` against the live site. This sandbox's proxy blocks
`github.io`, so a fresh run would open with a false alarm and, following its own
instruction to stop and report, would never reach the actual review.

---

## B. What already works

Stated plainly so the new agents do not "fix" it.

- **The money core.** `awardBase`, `compFor`, `noticeFor`, `leaveFor`,
  `resignFactor`, `exc87Applies` — shared by both flows, guarded for
  finiteness, fuzzed with invariants. Article 85's five-year boundary and
  Article 87's exceptions are both correct, and both were wrong at some point.
- **Two-kind sourcing.** Law (§, verified article) versus Wodouh methodology
  (italic, our own reading), never blurred. An article number appears in the
  product only if `docs/legal-sources.md` marks it verified.
- **The certainty taxonomy** — confirmed / likely / uncertain / na — and
  `termUnassessed()`, which names what could not be computed instead of going
  silent.
- **The deterministic reviewer.** `assessmentSafe()` blocks display on a
  non-finite figure or a blocking finding. It refuses; it does not warn.
- **The AI containment design.** Concern codes are a closed enum mapped to our
  own re-checks; the model cannot move a riyal figure. Tested with injection.
- **Entitlements.** One record holding a plan id, one route to the paid state,
  tier-gated deliverables, an upgrade priced at the difference, and a
  containment invariant on prices enforced in code.
- **The offline shell.** Installs to the home screen, works with no signal, and
  contacts nothing off-origin.
- **Nationality track.** Saudi and resident diverge where the law diverges,
  including the Article 76 scope guard that must never reach a non-Saudi.

---

## C. What is missing

Ordered by how much it blocks the four agents.

| # | Missing | Consequence for the agents |
|---|---|---|
| 1 | **Any measurement at all** | The Daily Report asks for traffic, signups, analyses, conversions and revenue. **None of these can be produced.** An agent that fills those lines is fabricating |
| 2 | **A user-facing delete control** | The brief specifies a DELETE / KEEP IN HISTORY choice. There is **no delete button anywhere in the app today**, and no history feature to keep. Red Team cannot verify a deletion promise that has no mechanism |
| 3 | **Payments** | Commerce Red Team has nothing live to attack. It can only attack the model, which it should |
| 4 | **Auth and accounts** | "Another account" as an attack path does not exist. Sessions are one browser's localStorage |
| 5 | **AI in the request path** | AI red-teaming is against a dormant integration. The tests are real; the deployment is not |
| 6 | **Legal-review governance** | Still blocked on who reviewed the 29 claims, when, and per-claim outcome |
| 7 | ~~**Terms / privacy / refund pages**~~ **RESOLVED 22 Aug 2026** | Were needed for gateway onboarding and for anything Growth publishes. All three now exist at `/terms`, `/privacy` and `/refund`, bilingual, linked, and labelled as drafts pending legal review. Left in this table rather than deleted: a dated audit is a record, and a reader arriving at it later needs to know the item closed rather than assume it is still open |
| 8 | **A production error signal** | Nothing tells you when a real reader hits a bug |
| 9 | **Working CI and watchdog** | Account setting; both are written |

---

## D. Proposed four-agent architecture

```
                    MARKET
                      │
            ┌─────────▼─────────┐
            │      GROWTH       │  what does the market ask for,
            │  discover → draft │  and what should we publish?
            └─────────┬─────────┘
                      │ market pain → product opportunity
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
  ┌─────────┐   ┌──────────┐   ┌──────────┐
  │ENGINEER │   │EXPERIENCE│   │ RED TEAM │
  │Does it  │   │Does the  │   │How does  │
  │ work?   │   │user trust│   │it fail   │
  │         │   │and under-│   │or get    │
  │         │   │stand it? │   │abused?   │
  └────┬────┘   └────┬─────┘   └────┬─────┘
       └─────────────┼──────────────┘
                     ▼
              ISSUE LIFECYCLE
   discovered → reproduced → classified → fixed
              → retested → verified → closed
```

**The division that matters**: Engineer proves behaviour, Experience judges
comprehension, Red Team assumes malice or bad luck, Growth listens outward.
Overlap is fine; identical output is not. Each writes findings in the same
issue format so the same defect found twice is recognisably one defect.

**Boundaries I am imposing, and why:**

- **Only Engineer and Red Team may claim a test result**, and only for a test
  they actually ran. Experience and Growth produce judgements and drafts.
- **Growth never publishes.** It discovers, drafts, and stops. Publishing needs
  platform credentials that do not exist in this project and should not be
  handed to an automated process before a human has watched it work.
- **No agent writes a number it did not measure.** Unmeasurable lines in the
  Daily Report are printed as `NOT MEASURED — no analytics exists`, never as 0
  and never as an estimate.
- **No agent may change a riyal figure, a legal citation, or privacy copy**
  without a human decision. Those three are where this product's reputation
  actually lives.

---

## E. Implementation plan

**Now (no credentials needed):**

1. Four agent definitions in `.claude/agents/`, plus `docs/agent-team.md`
   carrying the shared issue lifecycle, severity ladder and report format.
2. Fix the Engineer's watchdog instruction so a blocked network is reported as
   `BLOCKED — EXTERNAL ACCESS UNAVAILABLE` rather than a product failure. The
   brief demands exactly this distinction and the current file gets it wrong.
3. Run all four for a first real pass and file what they find.

**Next, unblocked by a decision rather than a credential:**

4. The privacy decision in **F1** below. Everything about DELETE / KEEP waits
   on it, and so does turning the AI on.
5. A delete control and a history model, once F1 is settled.
6. Privacy-safe on-device analytics, so the Daily Report stops being mostly
   `NOT MEASURED`.

**Then, credential-gated:** payments, AI in the request path, legal pages,
working CI.

---

## F. Risks

### F1. The privacy principle in this brief reverses the product's current promise — **this is the biggest item in this document**

The new brief says on-device processing is not required, and external
processing is acceptable when properly implemented and disclosed. The app
currently tells readers, in Arabic and English:

> *"Your text is analyzed on your device — it never leaves it and we don't keep
> it."*
> *"We don't upload it to a server, we don't store it, we don't share it with
> anyone. Delete the app and it all goes with it."*

Those are absolute claims, and today they are **true**. Under the new
principle they would become conditional.

This is not a copy edit. It is the product's central differentiator, it is why
the CSP is shaped the way it is, and it is the reason the AI integration ships
dormant. It also cuts both ways: the brief's own rule — *never make an absolute
privacy claim unless the architecture guarantees it* — currently **supports the
existing copy**, because the architecture does guarantee it.

**I have changed no privacy copy and will not without your explicit decision.**
Weakening a true absolute promise costs trust for no gain; keeping an absolute
promise after adding a server is a lie. Both are P0.

### F2. The Daily Report invites fabrication

Eleven of its lines cannot be computed from anything that exists. An agent
under instruction to produce a report will feel pressure to fill them. The
agent definitions therefore forbid it explicitly, in the same words the brief
uses about unexecuted tests.

### F3. Growth's word-of-mouth work is reputational surface area

The brief's own guardrails are sound — no fake personas, no manufactured social
proof, value first, disclose where platforms require it. The residual risk is
subtler: **an agent posting a confident sentence about Saudi labour law that is
not in the verified register.** Growth is therefore bound by the same rule as
the product — no article number that `docs/legal-sources.md` does not mark
verified — and every legal claim in a draft is flagged for human review.

### F4. Four agents can generate more findings than anyone acts on

A report nobody reads is the same as no report. The severity ladder is the
throttle: P0 and P1 are reported individually and immediately; P2–P4 are
batched. An agent that files fifty P4s has failed at its job, not done it
thoroughly.

### F5. The Red Team may attack things that do not exist

Auth, accounts, server-side deletion, live payments. Attacking absent
infrastructure produces findings that read as vulnerabilities and are actually
"not built yet". Its brief separates **VULNERABILITY** from **NOT IMPLEMENTED**.

---

## G. Required credentials and integrations

| For | Needed | Who |
|---|---|---|
| Payments | Moyasar merchant account; publishable key to me, secret key to Supabase secrets only | You |
| Backend, AI, entitlements | Supabase project URL + anon key | You |
| AI in the request path | `ANTHROPIC_API_KEY` as a function secret, never in the repo | You |
| Real address | Domain name + DNS at GitHub Pages | You |
| CI + live watchdog | Clear the Actions block (billing or Actions settings) | You |
| Growth listening | Platform accounts. **I recommend none for now** — Growth drafts, you post | You, later |
| Legal governance | Reviewer name, date, per-claim outcome | You |

Nothing in Growth requires an API key while it stays in discover-and-draft mode.

---

## H. Estimated operating costs

Honest ranges; I have not metered any of this.

| Item | Cost |
|---|---|
| GitHub Pages + repo | **0** |
| Supabase free tier | **0** until real volume |
| Moyasar | ~2.5% + fees per transaction, no monthly minimum typically |
| Domain | ~40–120 SAR/yr (`.sa` differs from `.com`) |
| Anthropic API, if the AI is switched on | Dominated by contract length. A long contract plus a review pass is a few cents; **1,000 analyses/month is plausibly $20–60**, and it scales with usage rather than users |
| Four agents running | The real cost. Each full pass is a long conversation over a 500 KB file. **A daily four-agent cycle is not free and should not be daily at the start** |
| Apple Developer, later | $99/yr, plus 15% of App Store sales |

**My recommendation on cadence:** Engineer and Red Team weekly or after a large
change; Experience before anything user-facing ships; Growth weekly. The
"Daily Report" becomes a *cycle* report until there is daily traffic to report
on. Running four agents daily against a product with no users would cost real
money to tell you nothing changed.

---

## I. Automation versus human approval

| Action | Authority |
|---|---|
| Read code, run the suites, walk the app | **Agent, automatic** |
| File findings, classify severity, propose fixes | **Agent, automatic** |
| Fix a P2–P4 with a test proving it | **Agent, then human review before push** |
| Change a riyal figure or a calculation | **Human decision, always** |
| Add or change a legal citation | **Human decision, always** — register rule stands |
| Change privacy copy | **Human decision, always** — see F1 |
| Change a price | **Human decision.** The ladder invariant is enforced; the numbers are yours |
| Turn on AI, payments, or the lawyer desk | **Human decision.** All three ship dormant on purpose |
| Publish anything publicly | **Human, every time, at this stage** |
| Any legal claim in public content | **Human, plus the verified register** |
| Delete user data | Not applicable yet; when it exists, the user's decision, never an agent's |

The brief asks for `DISCOVER → DRAFT → HUMAN APPROVAL → PUBLISH → MEASURE`.
That is what Growth does. I would keep it there for considerably longer than
feels necessary: the failure mode of an over-trusted growth agent is public and
permanent, and this product sells on trust.

---

## The three things I need from you before the agents can do their best work

1. **The privacy decision (F1).** Keep the absolute on-device promise, or move
   to disclosed external processing with real user control? Everything about
   DELETE/KEEP, the AI switch, and a large amount of copy hangs on it.
2. **Analytics: yes or no.** Without it, twelve lines of the Daily Report will
   read `NOT MEASURED` forever, and Growth's conversion engine has nothing to
   analyse. A privacy-safe, on-device, user-visible, user-clearable event log
   is possible without contradicting even the strictest reading of the current
   promise.
3. **Cadence.** How often do you actually want these four to run? See H.
