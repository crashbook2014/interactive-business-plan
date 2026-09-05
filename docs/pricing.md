# Wodouh pricing — evidence, reasoning, and what still needs testing

Last reviewed: 22 August 2026.

This file exists so the prices stop being folklore. Everything below is either
a cited comparable or an explicitly-flagged assumption.

## What the market actually looks like

| Comparable | Figure | Source |
|---|---|---|
| Lawyer consultation, Saudi Arabia | **400–1,000 SAR per consultation** | [Dag Law Firm](https://dlc.com.sa/en/individual-services/legal-consultation-services-and-fees/) |
| Attorney contract review (global) | $200–500 per document (≈750–1,875 SAR) | [TheLawGPT comparison](https://www.thelawgpt.com/blog/best-ai-tools-contract-review-2026) |
| Consumer AI contract review, per scan | $2–3 (≈8–11 SAR) | [Redline](https://redlineapp.net/blog/best-ai-contract-review-apps-2026), [Justee](https://justee.ai/free-contract-review) |
| Consumer AI contract review, subscription | $19.99–39.99/month (≈75–150 SAR) | [TheLawGPT](https://www.thelawgpt.com/blog/best-ai-tools-contract-review-2026) |
| Average Saudi private-sector wage (nationals) | ≈10,100 SAR/month | [SalaryExplorer](https://salaryexplorer.io/average-salary-in-saudia-arabia/) |
| Saudi minimum wage (nationals, private) | 4,000 SAR/month | [Vision2030.ai](https://vision2030.ai/encyclopedia/minimum-wage-saudi-arabia/) |

**Correction made:** the app previously claimed a consultation "starts at 500 SAR
**an hour**." That overstated the anchor. Saudi consultations are quoted per
consultation, 400–1,000 SAR. The copy now states the real range. An inflated
anchor is the one form of dishonesty this brand cannot survive.

## The prices and why

*Superseded by the August 2026 catalogue below. Kept because the reasoning
behind a price that was replaced is part of why the replacement was chosen.*

<details><summary>The July 2026 list</summary>

| Item | Price |
|---|---|
| Score, flags, clause explanations, EOS calculator | Free, unlimited |
| Negotiation letter | 65 |
| Job-change pack | 130 |
| Letter + lawyer review | 195 |
| Termination assessment | 145 |
| Case file | 245 |
| Assessment + case file + letter | 295 |
| Case file + lawyer | 395 |
| Wodouh+ | 50/month |
| Business | 390/month per 5 seats |

</details>

All prices are the total payable. Wodouh is **not registered for VAT**, so
no VAT is charged and none is represented as included — confirmed by the
owner on 30 Aug 2026. The product said "prices include 15% VAT" until then,
which was a tax the business could not collect. The status is declared once,
in the Terms; the price lines simply say the shown price is the total.
If registration ever becomes required (the mandatory threshold is turnover
based), this line, the Terms, the refund policy and both price lines change
together — test/commerce.test.js fails if any page reintroduces the claim.

## August 2026 — the current catalogue

Founder decision. Not a repricing: the shape changed.

| Item | Price | Reasoning | Confidence |
|---|---|---|---|
| Quick scan | **Free**, 1/month | Score, decision, and **one named flag explained in full**. Acquisition, not a price. | Medium |
| Full contract review | **199** | Every clause with its source. ~2% of an average monthly wage; half the cheapest consultation. | **Low — test first** |
| Letter drafting | **149** | Was 65. The letter is a finished document, not a lead magnet. | Low |
| Contract drafting | **249** | **Listed, not sellable.** No such capability exists. | n/a |
| Case file build | **349** | Now includes the termination assessment. | Medium |
| Full bundle | **549** | Review + case + letter. Their sum is 697, so the bundle saves 148. | Medium |
| Five-review pack | **699** | 140 a review. Replaces the consumer subscription. 12-month expiry. | Low |
| Letter + lawyer | **399** | Inside the 400–1,000 consultation band. Dark until a lawyer exists. | Medium |
| Case file + lawyer | **749** | The lawyer receives an assembled file, not a blank brief. Dark. | Medium |
| أعمال / Business | **799/month** | Unlimited reviews, one seat. | **Low — do discovery** |

### Three shape changes, and why

**The full review became paid, and the scan above it free.** Previously the
whole review was free and unlimited. This is the largest change here and the
one with a cost: see the principle below.

**The termination assessment stopped being sold on its own.** It was 145 alone
or 295 with the case file and letter. It was a step toward the file rather than
a destination, and asking someone mid-crisis to choose between two prices for
one journey is a decision they should not have to make. One product, 349.

**The consumer subscription became a prepaid pack.** A monthly bill is the
wrong shape for someone who signs a contract every few years: most of what it
collected would come from people not using it, which is a business that
resents its own customers. Business keeps a subscription, because an HR team, a
broker or a firm doing triage genuinely sees contracts weekly.

### The principle this changed, stated rather than deleted

This file used to say:

> The verdict must never be shaded by revenue. If we earned more by finding
> more risk, the score stops meaning anything.

Moving the review behind a price does not by itself break that. **A teaser that
counted problems would.** "We found 4 issues — pay to see them" makes a bigger
number worth more money, and that is the exact mechanism the principle names.

So the free scan shows **one real finding, explained in full, with its source** —
and states no count anywhere. Not in the lock panel, and not in the decision
line above it, which was printing "1 red and 3 amber" until it was caught by
opening the screen. `test/commerce.test.js` asserts both.

The principle now reads: **the verdict is free and never counts what it is
withholding.** Weaker than "everything is free". Still true, and still the
thing that makes the score worth reading.

### The free cap is honest, not enforced

One scan a month, counted in the browser. Clearing storage or opening a private
window resets it. The copy says "you get one free scan a month"; it does not
claim we prevent a second. Enforcing it would require an account before the
first thing anyone tries, which costs more trust than the scans are worth.

> **Partly superseded — September 2026.** See *An account is now required for
> most of the app* below. The argument above was not refuted, and it is the
> reason the calculator and the rights library stayed open: those are still
> reachable before anyone is asked for anything. An account IS now required
> before reading a contract, setting a reminder, or asking the assistant, and
> the trust cost that paragraph names is real and was accepted knowingly.

## September 2026 — an account is now required for most of the app

**The decision.** Every screen past the introductory tour requires a signed-in
account, **except the end-of-service calculator and the rights library**, which
are deliberately left open. Reading a contract, the reminders and the assistant
all require one. The other exception is an unconfigured build (no Supabase
project at all), where there is no account to be had and gating would produce a
locked box rather than a product.

The two open surfaces are the ones that give something away before asking for
anything: a real end-of-service figure with the arithmetic shown, and the law
itself. They are what makes the free proposition true rather than merely
claimed, and they are what someone arriving from a search result came for.
Asking for an account first would be asking to be trusted before having done
anything to earn it. The first cut of this change gated them too; that lasted
one review and was reversed by the founder on exactly this reasoning.

**Whose decision and why.** The founder's, made explicitly, and narrowed by
them again after the first cut shipped and the costs below were put in writing. The reason is not
monetisation and not scan-limit enforcement: it is that someone who used
Wodouh and leaves no way to be contacted cannot be followed up with, supported,
or asked what happened next — and at this stage of the product, being able to
reach the person who used it is worth more than the readers the door turns
away.

**What it costs, recorded so it is not rediscovered as a surprise.**

- It reverses the principle above, and the stronger one in `app/auth.js` that
  read *"the signed-out app is the whole app."* Both are rewritten in place with
  a pointer here rather than deleted.
- The reminders and the assistant were free to reach and are no longer. That is
  a real loss for a reader who wanted to track a deadline without committing to
  anything, and it is the part of this change with the least to say for itself.
  The calculator and the rights library were kept open precisely so the
  product still demonstrates good faith before asking for anything.
- `docs/audit-2026-08-overhaul.md` called a false "these are free" claim *the
  single most damaging defect in the codebase*. Nothing here makes that claim
  false again — free still means free of charge, and the account is free — but
  the wording of every affected surface had to change, because "free" and "no
  sign-up" were being read as one promise and are now two different things.
  The calculator's own "no sign-up" claim was removed and then restored, since
  it is true again.
- Six test suites asserted accountless access as a property of the product.
  They were not deleted: the assertions were **inverted** and annotated at each
  site, so the record shows a decision that changed rather than a test that
  quietly went missing. `test/accounts.test.js` now proves the gate holds by
  walking every screen in the markup with no session.

**What did NOT change.** The price of anything, the privacy architecture, or
where a contract is read. The contract is still analysed on the reader's own
device and still never stored. The door moved; nothing behind it did.

## July 2026 — 30% uplift

All paid tiers were raised roughly 30% by founder decision, rounded to clean
multiples of five so every figure reads deliberately rather than arithmetically:
49→65, 99→130, 149→195, 249→325, 399→520, 39→50/month, 299→390/month. Annual
plans are set at exactly ten times monthly so the "two months free" claim stays
literally true.

The uplift is **still within every comparable**: the letter remains about a
sixth of the cheapest Saudi consultation, and the case file remains well under
attorney document review. Nothing here crossed a ceiling the research
established. But it moves the letter further from the "obvious yes" zone, which
makes the price test below more important, not less.

## August 2026 — the containment invariant

This file used to justify each price on its own and never check one against
another. That is how a **295 SAR bundle came to contain a 325 SAR product**:
the termination bundle includes a case file, and the case file was dearer than
the whole bundle. Both prices were defensible alone. Together they told a
reader the pricing was arbitrary — and price coherence is a trust signal in
the same family as legal sourcing. If the numbers we choose ourselves do not
hold together, the numbers we compute get read the same way.

**The rule, now enforced in code rather than in this document:**

> No bundle may cost less than any product it contains.

`ladderBreaks()` in `app/index.html` walks the three plan lists and returns
every violating pair; `test/commerce.test.js` asserts the list is empty. Change
any price and the suite tells you whether the ladder still holds — the check no
longer depends on someone remembering to reread this page.

Two prices moved to satisfy it: the case file 325 → **245**, and case file +
lawyer 520 → **395**. 245 keeps the file well clear of the 65 SAR letter, which
is the comparison that matters — it is a claim document with money on the table
— while ending the collision.

Two descriptions also changed, for a reason closer to the bone. The **pack**
sold "6 months of reminders + unlimited questions"; both are free to every
reader and always have been. The **lawyer tiers** promised a licensed Saudi
lawyer within 24 hours, and nothing in the repository could deliver that. A
price attached to a deliverable that does not exist is worse than a wrong riyal
figure: a wrong figure is an error, and that is a promise. The pack now names
something genuinely withheld and genuinely delivered, and the lawyer tiers do
not render to a reader until a real arrangement exists behind them.

## What is not validated

Nothing here has met a paying Saudi customer. Research narrows a range;
only customers confirm a price. Specifically unproven:

- Whether Saudi consumers will pay **anything** for a legal output from an
  unknown brand, at any price.
- Whether the letter converts better at 149 than at 65 — a 2.3× rise, tested
  on nobody.
- **Whether charging for the review at all suppresses the top of the funnel
  more than it earns.** The free unlimited review was the acquisition engine;
  one scan a month is a much narrower door.
- Whether the 699 pack outperforms the 199 single, or whether asking for 3.5×
  up front from a first-time buyer simply loses them.
- Whether businesses see 799/month as trivial (possible) or as an unbudgeted
  line item requiring procurement (likely, and slower).
- Whether the refund promise increases conversion enough to cover its cost.

## The test to run

**1. Letter price test.** Three cohorts — 49 / 65 / 89 SAR — assigned randomly
and held for the user's session. Target ≈100 paywall views per arm before
reading anything into it. Measure:

- paywall view → purchase rate
- refund rate per arm (a high rate at 89 means the price outran the value)
- revenue per paywall view, which is the number that actually decides it

Expect 65 to win on revenue per view even if 49 wins on raw conversion. If 89
holds conversion within a few points of 65, the product is still underpriced.
Run the same test on the 130 pack, which is now the default selection and so
carries most of the revenue.

**2. Five decline interviews.** Recruit five people who reached the paywall and
did not buy. Ask what they expected the letter to contain, what they would have
paid, and what they did instead. Refusal reasons are more informative than
purchase reasons, and five is enough to hear the same objection twice.

**3. Business discovery before pricing.** Ten conversations with Saudi SMEs and
freelancers who issue contracts. Do not lead with a price; ask what they
currently spend on legal review and what would have to be true to replace it.
B2B price discovery almost always reveals the first guess was wrong.

## Standing rule

Free stays free. The moment a paid tier depends on the score finding problems,
the incentive is corrupted and the brand's only real asset — being believed —
is gone.
