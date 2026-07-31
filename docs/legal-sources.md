# Legal sources register

Last reviewed: **July 2026**. Law currency: **19 February 2025** — the date the
current Saudi Labor Law amendments came into force.

This register exists so the app's legal claims can be re-verified rather than
trusted. **Rule: an article number appears in the product only if it appears
as `verified` below.** Everywhere else the product names the law without a
number. Invented citation precision manufactures exactly the authority this
register is meant to earn honestly.

## Two kinds of origin, never blurred

Every result the app displays states where it came from. There are exactly two
kinds, and they are visually distinct in the UI:

- **Law** (`.src-line.law`, marked §) — cites an article. Only articles marked
  `verified` in the register below may ever appear here.
- **Wodouh methodology** (`.src-line.method`, italic) — our own reading, our
  own weighting, or a date we inferred from the contract's terms. It says so
  in those words and claims no statutory authority.

The score is always methodology: no statute produces a number out of 100.
The end-of-service figure is always law: it implements Articles 84 and 85.

Heuristic rules currently citing law: overtime (107), notice period (75),
probation (53), annual leave (109). The remaining six — non-compete, penalty
clause, one-sided termination, auto-renewal, intellectual property, salary —
carry the methodology label, because no verified article backs the specific
claim the rule makes. Three of those are the deliberately uncited claims noted
at the bottom of this file.

## Primary sources

| Source | Covers | Link |
|---|---|---|
| Saudi Labor Law — Royal Decree M/51 (23/8/1426H), amended in force 19 Feb 2025 | Employment, leave, end of service, notice, disputes | [laws.boe.gov.sa](https://laws.boe.gov.sa/), official PDF at [hrsd.gov.sa](https://www.hrsd.gov.sa/sites/default/files/2023-02/Labor.pdf) |
| Ministry of Human Resources and Social Development | Official text, regulations, implementing guides | [hrsd.gov.sa](https://www.hrsd.gov.sa/) |
| Ejar network | Residential lease registration and tenancy | [ejar.sa](https://www.ejar.sa/) |
| Ministry of Justice — labour courts | Settlement and litigation route | [moj.gov.sa](https://www.moj.gov.sa/) |

## Claim register

| Claim as stated in the app | Article | Status | Checked against |
|---|---|---|---|
| End-of-service: half-month wage per year for the first five years, full month per year thereafter, on the last wage, pro-rata for partial years | **84** | ✅ verified | [HRSD](https://www.hrsd.gov.sa/en/knowledge-centre/articles/317), [WIPO Lex](https://www.wipo.int/wipolex/en/legislation/details/14685) |
| Resignation tiers: under 2 years none; 2–5 one third; 5–10 two thirds; 10+ full | **85** | ✅ verified | [Etqan Law](https://etqanlawfirm-sa.com/en/article-85-saudi-labor-law/), [Shangiti Law](https://law.shangiti.com/en/blogs/end-of-service-benefits-calculation-saudi-article-84-85) |
| Probation up to 90 days, extendable by written agreement to 180 total | **53** | ✅ verified | [DLA Piper](https://www.dlapiper.com/en/insights/publications/2024/08/amendments-to-the-ksa-labour-law) |
| Overtime paid at the hourly wage plus 50% of the basic wage | **107** | ✅ verified | [Labour Law of KSA](https://www.eoiriyadh.gov.in/page/labour-law-of-ksa/) |
| Annual leave at least 21 days, rising to at least 30 after five consecutive years with the same employer | **109** | ✅ verified | [Labour Law of KSA](https://www.eoiriyadh.gov.in/page/labour-law-of-ksa/) |
| Notice, monthly-paid indefinite contract: **employer 60 days, employee 30 days** | **75** | ✅ verified | [Al Othman Law](https://alothmanlaw.sa/en/article-75/) |
| Labour claims not heard after 12 months from the end of the relationship, unless the court accepts an excuse or the defendant acknowledges the right | **222** | ✅ verified | [Innovation SA](https://innovation-sa.com/labor-courts-will-not-consider-claims-older-12-months/), [Mondaq](https://www.mondaq.com/saudiarabia/employment-and-hr/1603250/labour-and-employment-comparative-guide) |
| Employer bears recruitment fees, Iqama and work permit issuance and renewal, fines for late renewal, profession-change fees, exit and re-entry visas, and the return ticket at the end of the relationship. Worker bears return cost only if unfit for work or leaving without legitimate reason. The employer receiving a transferred worker bears the transfer fee | **40** | ✅ verified | [HRSD — what the employer bears](https://www.hrsd.gov.sa/en/knowledge-centre/articles/64434), [official law text, laws.boe.gov.sa](https://laws.boe.gov.sa/Files/Download/?attId=704cf56e-eb7a-4ddb-8c28-adbb01244dc6) |
| Employer may not withhold a non-Saudi worker's passport, residence permit (Iqama) or medical insurance card | **Implementing Regulations, art. 6** | ✅ verified | [HRSD — employers' obligations](https://www.hrsd.gov.sa/en/%D8%A7%D9%84%D8%AA%D8%B2%D8%A7%D9%85%D8%A7%D8%AA-%D8%B5%D8%A7%D8%AD%D8%A8-%D8%A7%D9%84%D8%B9%D9%85%D9%84), [Qiwa — workers' rights](https://qiwa.sa/en/labor-education/establishment-workers-rights) |
| Since the 2021 Labor Reform Initiative a worker may transfer employer through Qiwa without the current employer's consent in defined cases, including contract expiry, three consecutive months of unpaid wages, and an expired Iqama | — (Labor Reform Initiative, named without an article) | ✅ verified | [Qiwa — workers' rights](https://qiwa.sa/en/labor-education/establishment-workers-rights), [Etqan Law — expatriate guide](https://etqanlawfirm-sa.com/en/new-saudi-labor-law-for-expatriates/) |
| Non-compete must be limited in duration, place and type of work; two years is the usual ceiling | — | ⚠️ **illustrative** — cite the law by name only, no article number, until verified | — |
| Compensation for termination without valid reason (15 days per year, floor of two months' wage) | — | ⚠️ **illustrative** — used in the case-file estimate and labelled conditional in-product | — |
| Termination without award in specified cases | — | ⚠️ **illustrative** | — |

## Corrections log

**July 2026 — Article 75.** The assistant stated notice as "60 days if you're
paid monthly and 30 days otherwise." That is wrong. Article 75 is asymmetric:
for a monthly-paid indefinite contract the **employer** must give 60 days and
the **employee** 30. The original wording also understated an employee's freedom
to leave. Corrected, and the article is now cited.

This error was found only because the sources feature forced verification of
claims the app had been asserting for weeks. That is the argument for keeping
this register current.

## Before shipping to real users

1. A licensed Saudi lawyer must review every row above, including the verified
   ones — secondary sources agree with each other more readily than they agree
   with the statute.
2. Resolve the three illustrative rows to verified articles or remove the
   claims.
3. Set a recurring re-verification date. Saudi labour regulation is moving
   quickly; the February 2025 amendments will not be the last.
4. The end-of-service calculator is the highest-risk surface — a wrong figure
   there costs someone real money. It should be checked against worked examples
   supplied by counsel, not only against the formula.
