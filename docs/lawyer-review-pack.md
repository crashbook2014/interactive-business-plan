# Wodouh — legal review pack

**Prepared 1 August 2026 for review by a licensed Saudi lawyer.**

---

## What we are asking you to do

Wodouh is a bilingual consumer app that reads a Saudi employment contract and
tells the reader whether to sign, negotiate, or seek a lawyer. Every statement
it makes carries a visible citation.

**29 legal claims are listed below.** For each one we need one of three
answers:

| Verdict | Meaning |
|---|---|
| **Confirmed** | The claim is correct as stated, and the article is right. |
| **Correct but reword** | Legally sound, but the wording could mislead a layperson. |
| **Wrong** | The claim, the article, or the scope is incorrect. Please say what it should be. |

We would rather be told a claim is wrong now than have a user rely on it.

### What we are *not* asking

We are not asking you to advise our users, take responsibility for their
matters, or endorse the product. We are asking whether these 29 statements
accurately describe Saudi law as at today.

---

## How these claims were prepared, and why that is not enough

Each claim was checked against published sources — HRSD and the official law
text on laws.boe.gov.sa where they cover the point, Qiwa for non-Saudi
employment and the contract-transition programme, GOSI for social insurance,
and firm commentary (DLA Piper, Al Othman, Bird & Bird, Clyde & Co, Morgan
Lewis, Al Tamimi and others) elsewhere.

**Since the last revision these were re-checked against MHRSD's own pages**
and its published Labor Law PDF: Articles 53, 75, 76, 77, 80, 81, 84, 85, 87,
88, 109 and 111. Direct page fetches remain blocked from our environment, so
this is official search results rather than a browser session on the gazette.

**One claim is deliberately weaker than the rest.** Article 81's *grounds* are
quoted verbatim by official sources. Its *award consequence* — that a departure
on those grounds carries the full Article 84 award rather than the Article 85
tiers — rests on the statutory phrase "without prejudice to all of his
statutory rights" plus consistent commentary. **No official page states the
consequence in those words.** It is claim 25, it is the first thing we would
like checked, and the product labels it as a reading rather than a bare
citation.

**No qualified lawyer has reviewed any of it.** That is the gap this review
exists to close.

Two reasons we do not consider our own verification sufficient:

1. **Commentary agrees with itself more readily than with the statute.** Firm
   summaries cite each other. A confident consensus among secondary sources is
   not the same as the text of the law.
2. **We have already been wrong this way.** In July 2026 the app stated notice
   periods as "60 days if paid monthly and 30 days otherwise." Article 75 is
   asymmetric — 60 days for the employer, 30 for the worker. It shipped, cited
   a real article, read authoritatively, and was wrong for weeks. Our
   corrections log is public and records this.

---

## Please review in this order

Claims are ranked by what a wrong answer costs the user, not by article number.

### Priority 1 — money, and nationality-dependent

A wrong answer here changes a figure someone relies on, or applies the wrong
body of law to them entirely. **This is the section to read if you read only
one.**

| # | Claim as the app states it | Cited as | Where it appears |
|---|---|---|---|
| 1 | End-of-service: half-month wage per year for the first five years, full month per year thereafter, on the last wage, pro-rata for partial years | Art. **84** | Calculator, rights library, assistant |
| 2 | Resignation reduction: under 2 years none; **2 up to and including 5** one third; **in excess of 5, under 10** two thirds; 10+ full. **Five years exactly takes one third** | Art. **85** | Calculator, rights library, termination assessment |
| 29 | The Article 85 reduction does not apply where the worker leaves for a **force majeure beyond their control**, or where a **female worker** ends her contract within **six months of marriage** or **three months of giving birth** — the full award is due | Art. **87** | Termination assessment |
| 3 | Compensation for termination without valid reason, **indefinite** contract: 15 days' wages per year of service, floor two months | Art. **77** | Case file (Saudi track) |
| 4 | Compensation for termination without valid reason, **fixed-term** contract: wages for the **remaining term**, floor two months | Art. **77** | Case file (resident track) |
| 5 | A non-Saudi's contract must be **written and fixed-term**, never converts to indefinite even by agreement; where no term is stated it is one year from actual commencement | Art. **37** | Analyzer rule, rights library |
| 6 | Notice on a monthly-paid **indefinite** contract: employer 60 days, worker 30. Does **not** reach non-Saudis, whose contracts are always fixed-term | Art. **75** | Analyzer rule (Saudi only), library, assistant |
| 25 | A worker who leaves under Article 81 — employer breach of essential obligations, fraud at contracting, essentially different work without consent, or a violent or immoral act — keeps the **full** end-of-service award under Article 84, **not** the reduced resignation tiers of Article 85 | Art. **81** | Termination assessment, rights library |
| 26 | A party terminating without observing the Article 75 notice pays the other the wage for the notice period or its balance, on the last wage. **Indefinite contracts only**, so it does not reach non-Saudis | Art. **76** | Termination assessment (Saudi track only) |

**Specific questions on this section:**

- **Claims 3 and 4 are the highest-stakes pair in the product.** We apply the
  remaining-term branch to every non-Saudi on the basis that Article 37 makes
  their contract fixed-term. Is that inference sound? We previously applied the
  indefinite formula to everyone, which understated a resident's figure by
  roughly five months' wages on a representative case.
- **Claim 6:** is it correct that Article 75's notice periods have no
  application to a fixed-term contract, so a resident should not be given them?
- **Claim 1:** "last wage" — should this be the full wage, or basic only?
  We state the last wage and would like that confirmed.
- **Claim 25 is the one we are least willing to be wrong about.** We were
  showing a worker who said "I resigned" the Article 85 tiers unconditionally —
  which is nothing at all under two years. If someone was pushed out by an
  employer who had stopped paying them, we showed them zero. We now separate
  "I was asked to resign" from "I resigned" and point at Article 81. **Is that
  separation sound, and does an Article 81 departure really carry the full
  Article 84 award?** If the answer is no, we are creating a false expectation
  in the most vulnerable user we have.
- **Claim 26:** we treat Article 76 as inheriting Article 75's scope, so we
  never show notice compensation to a non-Saudi. Is that right?
- **Claim 2, the five-year boundary.** We now read "not more than five years"
  as inclusive, so five years exactly takes one third rather than two thirds.
  We previously had this the other way and were **overstating** the award.
  Please confirm the boundary, and tell us how the courts treat it in practice.
- **Claim 29 (Article 87).** We ask the reader directly whether they left for a
  force majeure, or within six months of marriage or three months of giving
  birth, and give the full award if so. Is that the right test, and is
  "force majeure beyond his control" as narrow in practice as the wording
  suggests?

### Priority 2 — non-Saudi specific

Wrong scope here means telling a resident they have a right they do not, or
withholding one they do.

| # | Claim | Cited as |
|---|---|---|
| 7 | Employer bears recruitment fees, Iqama and work permit issuance and renewal, late-renewal fines, profession-change fees, exit and re-entry visas, and the return ticket. Worker bears return cost only if unfit for work or leaving without legitimate reason. Receiving employer bears transfer fees | Art. **40** |
| 8 | Employer may not withhold a non-Saudi worker's passport, Iqama or medical insurance card | **Implementing Regulations, art. 6** |
| 9 | Since the 2021 Labor Reform Initiative a worker may transfer employer through Qiwa without the current employer's consent in defined cases — contract expiry, three consecutive months of unpaid wages, an expired Iqama | Labor Reform Initiative (no article cited) |

**Specific question:** claim 8 cites the Implementing Regulations rather than
the Labor Law. We saw reports of an April 2026 revision touching passport
confiscation penalties. **Is art. 6 of the Implementing Regulations still the
right instrument to cite?** We deliberately state no fine amount.

### Priority 3 — social insurance (a second statute)

These are cited to the Social Insurance Law and GOSI, never to a Labor Law
article. Please confirm that framing is correct as well as the substance.

| # | Claim | Cited as |
|---|---|---|
| 10 | A non-Saudi contributes **nothing** to GOSI from salary; employer pays **2%** for occupational hazards alone; no pension branch, no SANED | Social Insurance Law / GOSI |
| 11 | Saudis registered before 3 July 2024: **21.5%** total (11.75 / 9.75). Registered on or after: new system, **23.5%** since July 2026 (12.75 / 10.75) | Social Insurance Law |
| 12 | Contributions calculated on basic wage plus housing allowance only, capped at **SAR 45,000** per month | Social Insurance Law |
| 13 | GOSI and the end-of-service award are **separate entitlements**; the award is not reduced by, offset against, or replaced by GOSI | Social Insurance Law with arts. 84–85 |
| 14 | SANED: Saudis only; involuntary loss; actively seeking; 12 months' contributions in the last 36; registered with Taqat. **60%** of the two-year average covered wage for three months, capped **SAR 9,000**, then **50%**, up to 12 months | Social Insurance Law / SANED |

**Specific question:** claim 13 is the one users are most often told the
opposite of by an employer. We would like it confirmed in the strongest terms
you are comfortable with, or corrected.

### Priority 4 — termination, resignation, and the contract transition

| # | Claim | Cited as |
|---|---|---|
| 15 | Termination without award or notice is confined to the Article 80 cases, treated by the courts as exceptional and disciplinary. Employer must let the worker state their case, document the reason, and notify in writing | Art. **80** |
| 16 | A resignation is deemed accepted if the employer does not respond within 30 days | Art. **79** |
| 17 | Bankruptcy, and resignation as newly defined, are lawful grounds for ending a contract | Art. **74** |
| 18 | Contracts must be authenticated through Qiwa to be enforceable; unregistered or hand-signed contracts no longer carry enforceable status. Fixed-term migrated from 6 March 2026, indefinite from 6 August 2026 | Contract-transition programme |
| 19 | The wage clause in a Qiwa contract carries direct enforcement; unpaid wages can be pursued through Najiz without first going through MHRSD or the labour courts | Contract-transition programme |

**Specific question on 18:** the app currently tells users the migration
obligation sits on the **employer**, and that the worker loses nothing on
6 August — their only step is to check their contract is registered and
matches their copy. Please confirm that framing is accurate.

### Priority 5 — remaining terms

| # | Claim | Cited as |
|---|---|---|
| 20 | Probation up to 90 days, extendable by written agreement to 180 total | Art. **53** |
| 21 | Overtime at the hourly wage plus 50% of basic. Since the 2025 amendment an employer may offer compensatory paid leave instead, **only with the worker's consent** | Art. **107** |
| 22 | Annual leave at least 21 days, rising to at least 30 after five consecutive years with the same employer | Art. **109** |
| 23 | Non-compete must be written and define duration, area and type of activity. Two years is a **maximum**, not a norm, and agreement cannot extend it | Art. **83** |
| 24 | Labour claims not heard after 12 months from the end of the relationship, unless the court accepts an excuse or the defendant acknowledges the right | Art. **222** |
| 27 | Accrued annual leave not taken is paid on leaving, for the whole unused period and pro-rata for the part-year, on the last wage. The right cannot be waived by either party | Art. **111** |
| 28 | Final settlement is due within **one week** where the employer terminated or the contract expired, and within **two weeks** where the worker resigned | Art. **88** |

---

## Also worth your view, beyond the 24

1. **Is anything materially missing** that a worker deciding whether to sign
   would need? We know we do not cover discrimination, harassment,
   work-injury procedure, or domestic-worker rules.
2. **Our disclaimer** reads: *"Wodouh gives you general legal information and
   its source — not legal advice on your situation. For complex disputes, see
   a lawyer."* Is that sufficient for what the product actually does?
3. **Anything we should stop saying**, regardless of whether it is technically
   correct.
4. **PDPL and where the data sits. Added 22 August 2026, and the one item here
   that is a live decision rather than a wording question.** The database will
   be hosted in **Frankfurt (`eu-central-1`)**. Supabase offers no Saudi
   region, and the region cannot be changed later without recreating the
   project.

   What will be stored there about Saudi residents:

   - a **phone number**, and a separate **marketing-consent record** holding
     when consent was given and the exact wording shown at the time
     (`public.profiles`)
   - **`original_filename`** — the name of the file the reader uploaded. In
     Saudi practice these routinely read like `عقد-عبدالإله-أرامكو.pdf`, so
     this is personal data about **two** parties, one of whom never agreed to
     anything
   - the **outcome** of an analysis: a score, which rules fired, a verdict key

   What will **not** be stored there, by design and enforced in the schema:
   contract text, PDF bytes, or quoted clauses.

   The questions: does this constitute a cross-border transfer requiring a
   specific basis under PDPL, and if so which? Does the phone-number and
   consent record change the answer? Is `original_filename` defensible given
   the second party, or should it be dropped or hashed? And is anything
   required of us before the first real user, rather than before scale?

---

## How to return this

Free text is fine. If it helps, per claim:

```
Claim #   Verdict (Confirmed / Reword / Wrong)
          Correct position, if wrong
          Source you relied on
```

Anything marked Wrong is corrected before it reaches another user, and the
change is recorded in our public corrections log.

---

## Product context you may want

- Live: https://alwodouh.com/app/
- Register with sources and corrections log: `docs/legal-sources.md`
- Standing rule: an article number appears in the product **only** if it is
  marked verified in that register. Everything else is labelled
  *"Wodouh's reading — not a statutory rule"* and claims no statutory
  authority.
- The app applies a different body of law depending on whether the user is
  Saudi or a resident. That split is the single most consequential design
  decision in the product, and it rests on claim 5.
