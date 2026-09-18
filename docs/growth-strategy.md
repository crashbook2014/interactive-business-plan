# Wodouh growth strategy

Last reviewed: 17 September 2026.

This file exists for the same reason `docs/pricing.md` does: growth plans
turn into folklore the moment a number in them stops being labeled as either
a fact or a guess. Everything below is one or the other, marked as such.

---

## 1. Where this stands today

Two things have to be said plainly before any channel or target means
anything.

**The paywall contradicts the homepage.** The public homepage shows real
prices (199/149/349/549 SAR) and a 14-day refund guarantee, live since the
5 September launch. The paywall itself still renders `pw_demo` —
"Prototype — no real payment happens" — at the exact moment someone who has
entered their wage and dates decides whether to trust the product with
money. This was flagged in the 14 September audit with a line worth
repeating here: **nothing in this document matters while that is true.** A
visitor who reads "real prices, 14-day refund" on the homepage and then
"prototype" on the paywall does not conclude the product is in beta — they
conclude it lied on the way in.

The fix already has a recommendation on record (growth audit, 14 Sept):
while payments are off, the paywall and the pricing section should say the
same thing — *"Pricing is set; checkout opens shortly. Leave your number and
we'll open it for you"* — routed to the WhatsApp link already on the page.
That is a founder wording decision, not a growth-strategy decision, and it
is not re-litigated here. It is listed as **the actual first item** on every
phase below.

**One internal doc is stale, not contradictory.** `docs/roadmap.md` (8 Sept)
says the product launched 5 September. `docs/launch-checklist.md` still
describes the app as locked behind a preview key — but its last edit shares
a timestamp with the launch commit itself (`1acd5e4`, "Launch: lift the
curtain," both at 14:52:58 on 5 Sept). It reads as a runbook that was never
updated after the launch it documents, not as a live discrepancy. Worth a
one-line fix in that file, not worth building strategy around.

## 2. Positioning — confirmed, not reinvented

The positioning already on the homepage (`assets/landing.js`) is sound and
this document does not change it:

> "Know whether you can sign — before you do."

Audience: "individuals and businesses in Saudi Arabia." Deliberately not
AI-branded — the code comment on the headline is explicit that leading with
the mechanism instead of the outcome was a considered choice, not an
oversight. Trust is built on three stated pillars: analysis happens
on-device except for named, consented exceptions; legal content is reviewed
by a licensed Saudi lawyer before publication; the product states outright
that it is not a law firm and holds no commercial registration. That last
disclosure is unusual for a product asking to be trusted with a legal
document, and it is a genuine differentiator: most competitors in this
category either overstate their authority or hide the gap.

**The one real gap**: nothing on the homepage names who the reader is
choosing Wodouh *over*. The honest competitors for a first-time Saudi user
are not other legal-tech products — they are doing nothing, asking a
coworker or a friend who "knows about this stuff," or pasting the contract
into a free general-purpose AI chatbot. The pitch that beats those three is
narrower than "contract intelligence": it is *sourced* — every figure ties
to a named article, and a friend's guess or a chatbot's paraphrase does not.
This is a copy opportunity on the existing homepage, not a new product
claim, and it does not require inventing anything not already true of the
product.

## 3. Channels, in priority order

Ordered by what it costs versus what already exists to build on — the same
zero-budget-first instinct already visible in the growth agent's own
recommendations across both audits.

### 0. Fix the paywall (precondition, not a channel)
Covered above. Every channel below assumes this is done, because acquiring
a visitor to send them to a page that contradicts the one that brought them
is negative-value marketing.

### 1. SEO / GEO — the channel that is half-built already
58 answer pages exist, each tracing a single verified claim in
`docs/legal-sources.md` to its statute article. The `<title>` truncation and
duplicate-title bugs are fixed as of this week (`f84bb0b`). What remains,
in the order `docs/geo-benchmark.md` and `docs/launch-checklist.md` already
specify:
- Verify the domain and confirm indexing (`site:alwodouh.com` returned
  nothing as of 30 Aug, the day the sitemap was submitted — this needs a
  fresh check, not a re-submission).
- Run the GEO baseline: 15 fixed questions across ChatGPT, Perplexity,
  Gemini and Claude, logged-out, checking for a *visible linked* citation to
  alwodouh.com. Not yet run. Costs nothing but the ~30 minutes the file
  states, and the before/after value is destroyed if titles change again
  before it happens — they will not, this pass is done.
- The 29-topic question-title draft (reviewed separately this session) is
  ready to wire in once approved — it is the next lever on the same channel,
  not a new one.

### 2. WhatsApp as the primary lead-capture surface
Already the contact pattern on the homepage, and named first "because in
this market it is the one people actually use." The paywall fix above turns
it from a contact method into the site's only working conversion path while
payments are off. This is not a new channel to build — it is making the
existing one the actual destination of every "buy" button until checkout
exists.

### 3. Content built from what is already verified
The 29 register topics are real, sourced answers to real questions. Content
repurposing (short-form video, a LinkedIn post, a WhatsApp-shareable
one-pager) built from those 29 topics costs nothing but time and needs no
new legal claim — every sentence in it already exists, reviewed, in
`docs/legal-sources.md`. The August audit already drafted three outreach
pieces (Reddit, X, LinkedIn) still marked **NEEDS LEGAL REVIEW** because two
touch article citations directly — that review is the blocker on the
content already written, not a new task.

### 4. Partnerships / B2B — not yet a channel, flagged honestly
`docs/pricing.md` marks the `أعمال` (Business) 799/month tier **"Low
confidence — do discovery"** and pricing.md's own proposed test is ten
discovery conversations with Saudi SMEs and freelancers before pricing,
not after. There is no partnership pipeline to describe here because none
has been researched. Building one before that discovery would be inventing
a channel this document has no basis for.

### 5. Paid acquisition — not now
No CAC, LTV, or conversion figure exists anywhere in this repository (see
below). Spending against channels 1–3, which cost nothing and are already
half-built, is strictly higher-leverage than paying for traffic to a
product that has not yet confirmed anyone will pay for it at all —
`pricing.md`'s own first unvalidated assumption is "whether Saudi consumers
will pay anything for a legal output from an unknown brand, at any price."
Paid acquisition answers a scaling question this product has not yet earned
the right to ask.

## 4. Unit economics — a model, not a measurement

**Every number in this section is a stated assumption, not a fact.** The
repository has zero recorded user count, CAC, LTV, or conversion rate
anywhere — the product has never had a paying customer. `docs/
zid-test-runbook.md` says this directly: at 5–50 buyers "you will not get a
statistically meaningful conversion rate." Treat everything below as inputs
to test, in the same spirit `pricing.md` marks its own tiers "Low confidence
— test first."

**Real prices, real gap:** `docs/pricing.md` gives the actual tier prices —
149 / 199 / 349 / 549 SAR. What it does not give, and what nothing in the
repository gives, is a real payment-gateway fee: `docs/payments.md` itself
declines to quote one ("fees and feature sets change… compare on a 145 SAR
sale" when the time comes), and the only figure anywhere in the repo close
to one — "~2.5% + fees, no monthly minimum typically" in `docs/
agent-team-audit-2026-08.md` — is prefaced by its own author as "honest
ranges; I have not metered any of this." Computing a precise net-per-tier
figure from an admittedly unmetered guess would manufacture false precision
this document exists to avoid, so it is not done here. The two facts that
are real and worth stating plainly: **channels 1–3 above cost approximately
0 SAR in cash** (SEO, WhatsApp, content repurposed from already-written
material — the real cost is founder time, unpriced here), and gateway fees,
whatever they turn out to be, are a single-digit percentage on any of these
tiers, not a figure that changes which channel to pursue first.

**On CAC and LTV specifically: neither is estimated in this document.** At
zero cash CAC on channels 1–3, the immediate question is not "what's the
CAC" but "does anyone buy at all" — `pricing.md`'s own first listed
unvalidated assumption. A CAC or LTV figure requires a purchase and a
repeat-purchase rate, and this repository has recorded neither. The
honest content of this section is the absence, not a placeholder number
standing in for it.

## 5. Phased targets

Not a user-count target — the repository holds no baseline to grow from,
and a number like "500,000 users" attached to a product with zero recorded
sales is not a target, it is a wish stated as a plan.

**Phase 0 — remove the self-inflicted blockers (cost: founder time only)**
- Fix the paywall contradiction (the one decision everything else depends on)
- Confirm domain indexing status and run the GEO baseline
- Legal review of the three drafted outreach pieces
- One-line update to `docs/launch-checklist.md` so it stops describing a
  pre-launch state

**Phase 1 — first real signal (cost: founder time + whatever WhatsApp leads convert)**
- Route paywall traffic to WhatsApp per the fix above; treat every resulting
  conversation as one of `zid-test-runbook.md`'s four measurements: reach,
  buy intent, follow-through, and — the most valuable one — what people say
  when they hesitate
- Run `docs/pricing.md`'s five decline interviews once there is a paywall
  to decline
- Do not compute a conversion rate below ~50 conversations; read the
  qualitative pattern instead, per the runbook's own instruction

**Phase 2 — scale what showed signal (cost: informed by Phase 1, not this document)**
- Whichever channel produced real conversations in Phase 1 gets founder
  attention next; this document does not pick a winner in advance of that
  evidence
- Revisit this file's unit-economics section (§4) once real purchase data
  exists — replace the absence there with a measured CAC and LTV, not a
  guess dressed up as one

## 6. What this document is not

It does not decide the paywall copy or the checkout-opens-shortly wording —
that is the founder's call, already on the ranked audit list. It does not
resolve the Article 53 dispute blocking the highest-demand unanswered
topic — that needs a lawyer's reading, not a growth decision. It assumes
both get made and plans around the fact that they haven't yet.
