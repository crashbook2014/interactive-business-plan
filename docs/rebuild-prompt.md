# Rebuild prompt — Wodouh, from zero

Paste everything below the line into a fresh Claude Code session in an empty
repository. It is written as an instruction to the agent, not as documentation
about the agent, so it works as a single prompt.

It describes what this repository actually contains as of 28 August 2026 —
every phase, every invariant, and every acceptance test — in the order the work
has to happen. Numbers marked **[CONFIRM]** are decisions a human must make;
the agent must not invent them.

---

# Build Wodouh (وضوح) — a bilingual Saudi employment-contract companion

You are building a complete product from nothing: a privacy-first web app that
reads a Saudi employment contract and tells the reader what it means for them,
in Arabic and English. Work through the phases in order. Do not skip ahead to a
later phase to "unblock" an earlier one — each phase has an acceptance test, and
a phase is not done until its test passes.

## 0. The non-negotiables

These are not preferences. Every one of them was learned by getting it wrong.
Violating any of them invalidates the work, no matter how good the rest is.

1. **Never invent a law, an article number, a calculation, or a capability.**
   A legal claim appears in this product only if it exists as a `✅ verified`
   row in `docs/legal-sources.md`, with the official source that was checked and
   the date it was checked. Everywhere else, name the law without a number.
   Invented precision manufactures exactly the authority the register exists to
   earn honestly.
2. **Never claim something is AI-powered when it is deterministic.** Most of
   this product is ordinary code. Say so.
3. **A model may never change a riyal figure.** Every currency amount is
   computed by code and is immutable downstream. Enforce this in the server, not
   in the prompt.
4. **Two kinds of statement, never blurred.** A result that cites an article is
   marked as *law*. A result that comes from our own reading or weighting is
   marked as *methodology*, in those words, and claims no statutory authority.
   The score is always methodology — no statute produces a number out of 100.
5. **Privacy claims, prices, and legal wording are human decisions, always.**
   Draft them; never finalise them alone. If a change makes a privacy sentence
   stop being true, the sentence changes in the same commit.
6. **Ship AI surfaces inert.** With no endpoint configured, an AI feature
   renders *nothing* — not an error, not a placeholder. That is the shipping
   default, and it is what keeps the privacy promise unqualified.
7. **Secrets never enter the repository.** Service-role keys, API keys, and
   plaintext redemption codes live only in secret stores. If one is ever pasted
   into a chat or a file, it is burned — rotate it, do not reuse it.
8. **Run the app; do not read it.** A claim about behaviour is unproven until
   something drove the real product and observed it. Assert the resolved state,
   not the rendered string.
9. **Every new assertion must fail against the pre-change tree first.** A test
   that passes before your fix is testing nothing. Negative-test it, then keep it.
10. **An assertion that matches your own prose proves nothing.** If you write a
    comment saying "we removed X" and then assert `!/X/`, your comment is the
    match. Strip comments before asserting on source.

## 1. The product

A single reader — often someone who has just been terminated, often not a native
English speaker, often on a phone at a bad moment — pastes or uploads their
employment contract and gets:

- **A decision first**, not a score first: *safe to sign* / *negotiate these
  points* / *see a lawyer*. The score supports the decision; it is not the
  headline.
- **Clause-by-clause review**, with the offending sentence quoted from the
  reader's own text, flagged red/amber/green, each flag carrying a "what to do".
  Severity is never colour-only — every flag also states its severity in words.
- **An end-of-service calculator** implementing the verified articles, with the
  arithmetic shown.
- **A rights library** and a **dates timeline** exportable to calendar (.ics and
  Google Calendar).
- **A termination assessment** across seven paths and roughly fourteen
  questions, producing a case file and an employer letter in four tones.
- **Ask Wodouh** — a narrow question-answering surface that either grounds its
  answer in a verified row or refuses, and says which.

Everything above analyses the contract **in the browser, on the reader's
device**. Nothing about the document leaves it unless the reader separately
consents, per feature.

## 2. Stack and shape

- **The app is one HTML file.** `app/index.html`, around 700 KB, zero runtime
  dependencies, no build step, no framework. Roughly 29 screens routed
  imperatively by `show(name)` and `goTab(id)`. Deployment is `git push`.
- **Bilingual by dictionary.** A `T` object of ~1,260 key pairs (`{ar, en}`) and
  an `applyLang()` that rewrites every `[data-t]` node on switch. **Copy whose
  text depends on state must not carry `data-t`** — `applyLang()` would
  overwrite it. Render that copy from a function called by both the opener and
  `applyLang()`.
- **RTL and LTR both first-class.** Latin digits in both languages. Arabic is
  the default.
- **Static host** (GitHub Pages) serving the domain from `CNAME`. `.nojekyll`.
- **Supabase** for Postgres, Auth and Edge Functions. Row Level Security **is**
  the authorization model — there is no server-side app tier to enforce
  anything else.
- **Node only for tests and tools.** `package.json` has two dev dependencies:
  Playwright and TypeScript.

Repository layout to create:

```
index.html            marketing landing page, bilingual
app/index.html        the product
app/auth.js  app/sw.js  app/manifest.webmanifest  app/icons/
admin/                founder console (index.html, admin.js, config.js)
brand/                brand reference page (robots-excluded)
legal/legal.css legal/legal.js      shared by the policy pages
privacy/ terms/ refund/             bilingual policy pages
answers/ how-we-verify/             GENERATED SEO pages — never hand-edited
docs/                 the register, runbooks, audits, pricing rationale
supabase/migrations/  0001…0009
supabase/functions/   analyze, upload, webhook, oauth-callback, _shared/
test/                 23 suites + runner + static server
tools/                generators (corpus, seo, icons, og, sql paste)
.github/workflows/    ci.yml, watchdog.yml
_headers robots.txt sitemap.xml CNAME
```

## 3. Build order

### Phase 1 — The legal register, before any product code

Create `docs/legal-sources.md`. This is the spine of the entire product and
everything else is generated from or checked against it.

Structure: a header stating **Last reviewed** and the law currency; a primary
sources table; then `## Claim register`, a markdown table with exactly these
columns:

```
| Claim as stated in the app | الادعاء كما يظهر في التطبيق | Article | Status | Checked against |
```

Rules the register enforces:

- **Status must be exactly `✅ verified`** to count. Anything else — disputed,
  partially verified, annotated — is excluded by every consumer. Keep at least
  one genuinely excluded row and say why; a register that never excludes
  anything is a register nobody is applying.
- **Both languages, or neither.** A verified row with no Arabic claim fails the
  build. Digit parity between the two languages is enforced at build time, so a
  translation can never move a figure.
- **An em-dash in the Article column means "verified, no article number"** —
  such a row must never acquire one downstream.
- **The `Checked against` column holds real links to official sources**
  (the ministry, the official gazette, the labour platform).

Research and verify each claim against official Saudi sources. Cover at minimum:
end-of-service award and its resignation reduction; the exceptions to that
reduction; notice periods and the asymmetry between employer and employee;
compensation for termination without valid reason, separately for indefinite and
fixed-term contracts; the confined grounds for termination without award or
notice; deemed acceptance of resignation; overtime; annual leave and payment of
accrued leave; non-compete limits; the non-Saudi-specific rules including who
bears recruitment costs and the prohibition on withholding documents; contract
authentication; the claim limitation period; final settlement timing; and the
social-insurance and unemployment-insurance rows, which are a **different
statute** and must never be cited with a labour-law article number.

**Acceptance:** every row has a status, a source link and a date; the excluded
rows are visibly excluded; a human has signed off on the file.

### Phase 2 — The corpus generator

`tools/make-corpus.mjs`. Reads the register, keeps only the strictly verified
rows, emits `supabase/functions/_shared/corpus.json`. Export the parser as
`verifiedRows(md)` — a **second parser over the same file is a second definition
of "verified"**, and the whole point is that there is exactly one.

Deliberately **drop the sources column** from the corpus: a URL in the corpus is
a URL a completion can put in front of someone as a source it never opened.
Keep it available on the parsed row for other consumers.

**Acceptance:** regenerating produces no diff; a test fails if the committed
corpus and the register disagree.

### Phase 3 — The app skeleton and the language system

Build `app/index.html`: the `T` dictionary, `applyLang()`, `show()`/`goTab()`
routing, the design tokens, and the screens as empty shells. Establish the
**pre-launch curtain** now: `window.WODOUH_LAUNCHED = false` blanks the app
except for a preview key in the URL fragment. Use a **fragment, not a query
string**, so the document request stays exactly `/app/` and every route glob in
every future test keeps matching.

**Acceptance:** a routing test walks every screen in both languages and finds no
dead route and no untranslated node.

### Phase 4 — Reading the contract

- Paste and file upload. **Arabic PDF extraction that actually works** — parse
  ToUnicode CMaps, or Word-exported Arabic arrives as mojibake.
- **A structural gate before scoring.** Adversarial or nonsense prose must be
  refused rather than scored. Text that is not a contract never reaches the
  scorer.
- What cannot be read is refused clearly, not scored badly.

**Acceptance:** a fixtures suite of real-shaped contracts in both languages
scores; nonsense refuses; an Arabic PDF round-trips to readable text.

### Phase 5 — Analysis, scoring and sourcing

Implement the clause rules, each carrying its own source label — *law* with an
article number from the register, or *methodology* in those words. Keep rules
honest: if no verified article backs the specific claim a rule makes, it is
methodology and says so.

The score is methodology. The end-of-service figure is law. Tint the score ring
to the **decision**, not to the score band. Give each decision state exactly one
primary next step.

Add the **nationality track** (`"sa"` / `"nonsa"`) — several rules diverge, and
a non-Saudi's contract is always fixed-term, which changes which rules reach
them. Ask for the track **at the point of divergence**, not at the front door,
and ask once. Any code filtering by track must handle the not-yet-chosen state
by asking, never by silently withholding every answer.

**Acceptance:** a scenarios suite of named end-to-end cases plus a calculation
matrix; a fuzz suite asserting invariants over the calculations (monotonicity,
bounds, no negative results, pro-rata continuity).

### Phase 6 — The termination flow

Entry, seven paths, ~14 questions, evidence capture, an assessment screen with
a financial summary, the claims available, and a case-strength reading labelled
as methodology. Then the **case file document** and the **employer letter in
four tones**. The assessment is merged *into* the case file rather than sold
beside it — it is a step toward the file, not a destination.

**Acceptance:** a termination suite covering all seven paths and a UI suite
driving the real screens.

### Phase 7 — Accounts, backend and RLS

Nine migrations building ~19 tables with **RLS on every one** and roughly 40
policies:

- `0001` core: profiles, contracts, analyses, reminders, rate limits
- `0002` integrations: providers, connections, events, secrets
- `0003` accounts: contract analyses, case files, letters
- `0004` uploads
- `0005` admin: `admins`, `app_flags`, `flag_audit`
- `0006` function grants
- `0007` launch blockers
- `0008` operator allowlist
- `0009` scan events

Discipline:

- **`public.admins` has no write policy at all**, so no page can grant itself
  access.
- **Revoking from `PUBLIC` alone does nothing.** Supabase grants EXECUTE to
  `anon` and `authenticated` as roles in their own right — revoke from those
  roles explicitly.
- Migrations must be **safe to run twice**, and proven so against a real
  Postgres, not asserted.
- `scan_events` stores a user id and a timestamp and **nothing about the
  document** — not its text, filename, length, score or type. When this table
  appears, the privacy policy changes in the same commit.

Auth: Google plus **email one-time code, no password**. Google must not be the
only door. Pre-flight the provider request and explain failures in place, in
both languages, rather than stranding the reader on a provider error.

**Acceptance:** a schema suite by static analysis, plus an RLS suite that
executes the real SQL against a real Postgres and asks the database what it
allows — never infers it from reading the SQL.

### Phase 8 — Commerce

An ordinal plan ladder per flow, where **array position is tier height** and a
higher index includes everything below it. Enforce a **containment invariant in
code**: a bundle can never cost less than something it contains.

Catalogue shape **[CONFIRM every figure with the owner]** — as built:
free quick scan (1/month) · review 199 · letter 149 · contract drafting 249
*listed but deliberately unbuyable* · case file 349 · bundle 549 · five-review
pack 699 with a 12-month expiry · lawyer tiers 399 and 749, dark until a lawyer
exists · business 799/month, one seat.

Traps to avoid, each of which was a live defect:

- **The bundle must not be spliced into the flow arrays.** It is orthogonal —
  it grants several entitlements — and inserting it makes the ladder
  non-monotonic, which tells the entitlement check that a cheaper tier includes
  bundle-level access. Keep it out of the ladder and offer it *inside* the flow
  the reader is already in.
- **Resolve an upgrade against what is *offered*, not against the raw ladder**,
  or the bundle resolves to index −1 and prices at zero.
- **A credit pack must top up only when the pack itself is bought.** Gate the
  grant on the purchased product, not on "a purchase happened".
- **Paying at the scan limit must analyse the contract just paid for.** Remember
  the pending scan in the paywall branch exactly as the sign-in branch does, and
  resume it *after* state is saved — resuming before re-enters the gate and
  bounces the reader back.
- **The monthly reset must use one clock.** Compute the month boundary in a
  single timezone consistently.
- **A one-assessment entitlement is spent by a genuinely different assessment.**
  Compare a signature of the inputs; identical inputs are the same assessment.

Payments ship **simulated** until a gateway approves. Write the integration
against a stub — hosted redirect checkout, webhook signature verification, the
entitlement path — so approval day is a configuration change and not a build.
Redirect rather than an embedded SDK, so the CSP never admits a third-party
script host.

Also build the **code-redemption bridge**: a marketplace sells a code, the app
redeems it. Store **hashes only** — a plaintext code in the repository is a free
product for anyone who reads it.

**Acceptance:** a commerce suite that drives real purchases through the real UI
and measures the resulting entitlements and credit counts.

### Phase 9 — The paywall and the funnel

The free scan shows a score and **one named flag** — it proves the product works
by showing a finding, not by withholding a count. A teaser that counted problems
would make the score a sales figure.

- The sign-in wall must describe what it is actually doing. At the moment it
  stops someone who has just pasted a contract, they are not "saving their
  work"; they are being blocked. Say that.
- **Keep the business tier out of the consumer paywall.** A 799/month B2B plan
  has no business sitting third of four options in front of someone who has just
  found a problem in their own contract. Offer it as a tertiary link.
- Every interactive control is **at least 44px** on its smallest side, in both
  languages. A control whose height comes from whether its text happens to wrap
  is 44px in one language and 25px in the other.
- The primary call to action must have an actual button body. A class that is
  only ever styled inside a card inherits nothing outside one.

**Acceptance:** a measured layout sweep across every screen at 390×844 and
430×932, in both languages. **Measure after transitions settle** — an element
mid-transition sits under a scaled ancestor and reads 43.34px when it is 44.

### Phase 10 — The AI layer, shipped inert

An Edge Function proxy (`analyze`) that the client calls only after an explicit,
per-feature consent. The client ships with no endpoint, so the surfaces render
nothing at all.

The architecture is **the model proposes, the server decides**:

- The model receives **only the verified corpus** as legal text. A disputed row
  is not in the corpus, so there is nothing to quote — the model does not have
  to decline it, it never receives it.
- Server-side grading refuses the whole answer if it cites an **article number**
  not present in a cited verified row, or contains a **riyal figure** not
  present in a cited row. Extract both robustly: article references appear as
  "Article 84", "art. 84", "المادة 84", and as a bare number followed by "of the
  Labor Law". Money must not match years or bare small integers.
- A **second-pass critical reviewer** may correct the assessment, and an
  internal verified-check gate runs before anything is shown.
- Prompt injection through an uploaded contract is an expected input, not an
  edge case. The contract is data; it never becomes instructions.
- Every answer is labelled: grounded in a verified row, or general knowledge
  Wodouh has not checked.

**Ask Wodouh** specifically: a failed or unsupported question **must not consume
the reader's quota**. Increment only on a successful answer. When a question
cannot be placed, offer suggested questions that the knowledge base actually
answers — and when a question needs the nationality track and it is unset, ask
for the track and **re-run the reader's own words**.

**Acceptance:** suites that prove the refusals against stubs — a fabricated
article refuses, a fabricated figure refuses, both hold in Arabic, injection
does not escape, and a timeout falls to off. Then a live-model verification
script for the day a key exists.

### Phase 11 — The founder console

`/admin/` — a static page holding **no credential**. Every read and write it
makes is enforced by row level security in Postgres. It carries runtime feature
switches, a migrations panel that asks the live database which migrations have
run, launch blockers, counts, and an unforgeable audit log.

The console's hardest requirement is **honesty about its own state**. It must
never guess. Probe before answering and say one definite thing: *the migrations
are not applied* / *this is the wrong address* / *I could not ask*. Three
distinct states, including "unknown" — reporting "not applied" when it simply
could not reach the database sends someone to fix what was never broken.

Note: a table with RLS on and no policy may be dropped from the schema cache and
answer exactly like a missing table. Do not probe such a table for existence.

**Acceptance:** a console suite proving it is inert until configured and that
every failure falls to off, with each diagnostic branch tested separately.

### Phase 12 — Policy pages and the PWA

`privacy/`, `terms/`, `refund/` — bilingual, sharing `legal/legal.css`. A
payment gateway will not approve a merchant without them, and a policy nobody
can reach is a policy nobody was given. Label them as drafts until a lawyer has
read them.

The Terms must cover **everything the catalogue actually sells** — recurring
charges, when they are charged, that they renew until cancelled, how to cancel,
that cancelling stops the next charge rather than refunding the current period,
and the credit pack's expiry. A recurring charge with no cancellation terms is a
standard reason for a gateway to decline.

PWA: installable, works offline, tight CSP (`default-src 'none'` and no
third-party hosts). A `<meta>` CSP is the policy until `_headers` takes over —
and the header version must never be **weaker** than the tag it replaces.

**Acceptance:** a headers suite comparing every directive both ways, and a PWA
suite fetching every sitemap URL and asserting 200.

### Phase 13 — The SEO layer, generated from the register

`tools/make-seo.mjs`, sharing the Phase 2 parser. One page per verified row per
language — `/answers/<slug>/` and `/answers/<slug>/ar/` — plus two indexes and
`/how-we-verify/` in both languages.

Each page carries, and carries nothing else: the claim verbatim; the article
number **only where the row has one**; the row's own source links; the check
date; a link into the tool; `FAQPage` JSON-LD whose answer is **byte-identical**
to the rendered claim; and the app's disclaimer. No script executes on these
pages at all.

- **One URL per language.** `hreflang` requires it. If your other pages serve
  both languages from one URL with a toggle, they must declare **no** hreflang —
  declaring it would be a claim search engines act on and you cannot honour.
  Make the new pages the other way round and declare alternates for those only,
  reciprocally.
- Slugs and headings do not exist in the register, so **derive them by rule**
  from each claim's own opening words, and let the phrase read on until no two
  pages ask the same question.
- A citation that is not a bare article number belongs to a **different
  instrument**. Render it from an explicit map, and **fail the build** on an
  unmapped one rather than printing the wrong statute or an English source name
  inside an Arabic sentence.
- Localise the check date. An Arabic page printing an English month is a page
  translated everywhere except the line a reader checks first.

Regenerate `sitemap.xml` from the same script. Commit the output.

**Acceptance:** a suite proving the committed pages are byte-for-byte what the
register generates today; that no page cites an article its row does not hold
(allowing numbers the claim text itself cross-references); that the structured
answer equals the rendered one; that alternates are reciprocal and both ends are
in the sitemap; that every link came out of its own row; and that the Arabic
pages are right-to-left **as rendered**, not as attributed.

### Phase 14 — Testing doctrine and CI

A runner (`test/run.js`) that owns a static server's lifetime, orders suites
cheapest-first, and **fails if a suite exists but is not listed** — a test
nobody runs is the failure mode to design against. Roughly 23 suites covering:
headers, schema, RLS, calculation fuzzing, routing, route shadowing, PWA, SEO,
the pre-launch curtain, layout, surfaces, PDF, contract matching, situations,
accounts, commerce, the console, Ask, contract review, termination, the Claude
path, termination UI, and named scenarios.

Rules that matter more than coverage:

- **Playwright matches routes in reverse registration order.** A catch-all
  registered last swallows everything; register it **first**.
- Resolve Playwright and the target URL in one shared module so the suites run
  anywhere — a hardcoded sandbox path means no CI, no schedule and no agent can
  use them.
- Prefer the computed style over the attribute. `el.hidden` is a *request*;
  `getComputedStyle` is the answer, and an ordinary author rule outranks the
  user-agent `display:none`.
- Add a **pre-push git hook** running the suites, so the gate exists before CI
  billing does.

CI: a workflow on every push, plus a scheduled watchdog against the live site
that opens an issue when the deployed page breaks. Read the deployed origin from
`CNAME` rather than hardcoding it. Note that a job with `billable.total_ms: 0`
was never picked up by a runner — that is an account-level billing block, not a
workflow bug.

### Phase 15 — Marketing surface and launch

The landing page, the brand reference (robots-excluded, along with the console),
`robots.txt` pointing at the sitemap, OG images, icons.

Launch is two lines: `window.WODOUH_LAUNCHED = false → true` in the landing page
and the app. Tests, commit, push.

## 4. Documentation to write as you go

`docs/` is part of the deliverable, not an afterthought: the register; a pricing
rationale that records *why* a boundary moved rather than quietly dropping the
old principle; deployment and backend setup; an operations runbook; an iOS test
runbook; a lawyer review pack that asks three specific questions rather than
"please review this"; a launch checklist; and a dated audit for every review
pass, including the findings you rejected and why.

## 5. What only a human can do

Do not attempt these, and do not report them as done:

- Anything behind a credential, and anything that spends money.
- Applying to payment gateways; configuring an email sender; rotating secrets.
- Verifying the domain in Search Console (a DNS record).
- Engaging a lawyer, and deciding what their findings change.
- Approving prices, privacy copy, and any legal wording.
- Running the app on a real iPhone. Safari is where a bilingual RTL PWA is most
  likely to break, and headless Chromium on Linux will never tell you.

## 6. Definition of done

- Every suite green, and every assertion negative-tested against the pre-change
  tree.
- The register, the corpus and the public answer pages cannot disagree, because
  a test fails when they do.
- No riyal figure and no article number reaches a reader without passing the
  server gate.
- Every AI surface renders nothing when no endpoint is configured.
- No secret in the repository, in any history, or in any generated file.
- The privacy policy is true, sentence by sentence, of the code as it stands.
- Anything you could not verify is reported as unverified, in those words,
  rather than rounded up to done.
