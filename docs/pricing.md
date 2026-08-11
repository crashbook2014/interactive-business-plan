# Wodouh pricing — evidence, reasoning, and what still needs testing

Last reviewed: July 2026.

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

| Item | Price | Reasoning | Confidence |
|---|---|---|---|
| Score, flags, clause explanations, EOS calculator | **Free** | The verdict must never be shaded by revenue. If we earned more by finding more risk, the score stops meaning anything. This is a positioning decision, not a growth tactic. | High |
| Negotiation letter | **65 SAR** | ~0.6% of an average monthly wage; ~1/6th of the cheapest consultation. | **Low — test this first** |
| Job-change pack | **130 SAR** | The letter, plus a letter for any new contract for six months. Sold at the life event rather than as a subscription, because consumers sign contracts episodically. Positioned as the intended choice between 65 and 195. | Low |
| Letter + lawyer review | 195 SAR | Still under the cheapest direct consultation while including a lawyer, because the lawyer receives a prepared file and spends less time. Margin is the marketplace cut. | Medium |
| Termination assessment | 145 SAR | The only paid thing in the app that gates a result rather than a document. | Low |
| Case file | **245 SAR** *(was 325)* | Roughly a quarter to a sixth of attorney document review, against a claim often worth five figures. Lowered to end a containment break — see below. | Medium-high |
| Assessment + case file + letter | 295 SAR | The termination bundle. Must stay above every part it contains. | Medium |
| Case file + lawyer | **395 SAR** *(was 520)* | Mid-range of a consultation, but delivers the assembled file as well as the review. | Medium |
| Wodouh+ | 50 SAR/month (500/year) | Still under the $20–40 global band. The subscription's job is retention, not margin. Annual is exactly ten months, so "two months free" is literally true. | Medium |
| Business | 390 SAR/month per 5 seats (3,900/year) | 78 SAR/seat, still cheap for B2B. Priced for a beachhead, not capture. | **Low — do real discovery** |

All prices are VAT-inclusive (15%) and stated as such in the product.

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
- Whether the letter converts better at 49, 65, or 89, and whether the 130 pack
  outperforms the bare letter as expected.
- Whether businesses see 390/month as trivial (likely) or as an unbudgeted
  line item requiring procurement (also likely, and slower).
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
