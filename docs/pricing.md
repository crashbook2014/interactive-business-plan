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
| Negotiation letter | **49 SAR** | ~0.5% of an average monthly wage; ~1/10th of a consultation. Raised from 29 because 29 sits below the point where price signals seriousness for a legal good — under-pricing a trust good suppresses both perceived value and conversion. | **Low — test this first** |
| Letter + lawyer review | 149 SAR | Undercuts a direct consultation while the lawyer receives a prepared file, so their time is shorter. Margin is the marketplace cut. | Medium |
| Case file | 249 SAR | A third to a seventh of attorney document review, against a claim often worth five figures. The strongest-justified price in the set. | Medium-high |
| Case file + lawyer | 399 SAR | Same logic, higher stakes. | Medium |
| Wodouh+ | 39 SAR/month | Below the $20–40 global band. Deliberately cheap: the subscription's job is retention and habit, not margin. | Medium |
| Business | 299 SAR/month per 5 seats | 60 SAR/seat, cheap for B2B. Priced for a beachhead, not for capture. Expect to raise substantially once template scoring proves its value. | **Low — do real discovery** |

All prices are VAT-inclusive (15%) and stated as such in the product.

## What is not validated

Nothing here has met a paying Saudi customer. Research narrows a range;
only customers confirm a price. Specifically unproven:

- Whether Saudi consumers will pay **anything** for a legal output from an
  unknown brand, at any price.
- Whether the letter converts better at 29, 49, or 79.
- Whether businesses see 299/month as trivial (likely) or as an unbudgeted
  line item requiring procurement (also likely, and slower).
- Whether the refund promise increases conversion enough to cover its cost.

## The test to run

**1. Letter price test.** Three cohorts — 29 / 49 / 79 SAR — assigned randomly
and held for the user's session. Target ≈100 paywall views per arm before
reading anything into it. Measure:

- paywall view → purchase rate
- refund rate per arm (a high rate at 79 means the price outran the value)
- revenue per paywall view, which is the number that actually decides it

Expect 49 to win on revenue per view even if 29 wins on raw conversion. If 79
holds conversion within a few points of 49, the product is underpriced.

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
