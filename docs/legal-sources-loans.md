# Loan and consumer-financing sources — the register that does not exist yet

Last reviewed: **never**. Every row below is UNVERIFIED.

## Read this before you read the table

This file is the same shape as `docs/legal-sources.md` and holds none of its
authority. The employment register carries 29 rows a human checked against a
primary source, one at a time, and the product cites them because of that
checking — not because they are written down.

Nothing here has been checked. The rows below were assembled from
search-engine summaries of the Saudi Central Bank (SAMA) Rulebook during a
session that could not reach the Rulebook itself: `rulebook.sama.gov.sa`,
`www.sama.gov.sa` and `laws.boe.gov.sa` are all blocked by the network egress
policy of the environment this was written in. A search snippet is a
paraphrase of a regulation by a third party, sometimes years stale. That is
not a source; it is a lead.

So this file's job is narrow and worth doing anyway: it turns "research Saudi
financing law" into "open four pages and correct six rows".

**The product currently cites nothing at all on the loan path.** That is not
an oversight to be fixed by filling this table in casually — it is enforced in
two places, and both will keep holding until real verification happens:

- `CR_SYSTEM_LOAN` in `supabase/functions/analyze/index.ts` forbids the model
  from naming any regulation, circular or article.
- `gradeContractReview()` in `supabase/functions/_shared/review-contract.mjs`
  sets `law_reference` to null on every loan finding regardless of what the
  model returned.

## How to verify a row

1. Open the source URL in the row. If it 404s or redirects, the regulation may
   have been amended or renumbered — that is itself the finding, record it.
2. Read the actual article. Confirm the claim as written in the table matches
   what the article says, in both languages.
3. Correct the claim text to match the source rather than bending the source
   to the claim.
4. Change the row's status from `⬜ unverified` to `✅ verified` and fill the
   "Checked against" column with the URL and the date you read it.
5. Re-run `node tools/make-corpus.mjs` and `node test/run.js`.

Only a row reading exactly `✅ verified` is ever compiled. Anything else —
including `⬜ unverified`, a row mid-dispute, or a row someone annotated — is
excluded by construction, the same rule the employment register runs on.

## Claim register

| Claim as stated in the app | الادعاء كما يظهر في التطبيق | Article | Status | Checked against |
|---|---|---|---|---|
| A borrower may repay consumer financing early at any time, except during a prohibition period for real-estate financing which may not exceed two years from the contract date | يجوز للمقترض سداد التمويل الاستهلاكي مبكرًا في أي وقت، عدا فترة منع السداد المبكر في التمويل العقاري التي لا تتجاوز سنتين من تاريخ العقد | **11** | ⬜ unverified | LEAD ONLY — [SAMA Rulebook, Article 11: Early payments](https://rulebook.sama.gov.sa/en/article-11-early-payments) |
| On early repayment the creditor's compensation may not exceed the term cost for the three months following the payment, calculated on a declining balance | عند السداد المبكر لا يتجاوز تعويض الجهة الممولة تكلفة الأجل عن الأشهر الثلاثة التالية للسداد، محسوبة على أساس الرصيد المتناقص | **11** | ⬜ unverified | LEAD ONLY — [SAMA Rulebook, Article 11](https://rulebook.sama.gov.sa/en/article-11-early-payments), [Guide for Calculating the Early Payment Amount](https://rulebook.sama.gov.sa/en/guide-calculating-early-payment-amount) |
| A financing provider must accept partial early repayment equal to one installment or a multiple of it | على الجهة الممولة قبول السداد الجزئي المبكر بما يعادل قسطًا واحدًا أو مضاعفاته | — | ⬜ unverified | LEAD ONLY — [Regulations for Consumer Financing](https://rulebook.sama.gov.sa/en/regulations-consumer-financing) |
| The creditor must give the borrower written initial disclosure including the total cost of financing before the contract is signed | على الجهة الممولة تزويد المقترض بإفصاح أولي مكتوب يشمل التكلفة الإجمالية للتمويل قبل توقيع العقد | — | ⬜ unverified | LEAD ONLY — [Responsible Lending Principles for Individual Customers](https://rulebook.sama.gov.sa/en/responsible-lending-principles-individual-customers-0), Circular 46538/99 dated 02/09/1439H |
| A consumer has a cooling-off period of ten business days to withdraw from certain financing products | للمستهلك مهلة خيار مدتها عشرة أيام عمل للعدول عن بعض منتجات التمويل | — | ⬜ unverified | LEAD ONLY — same circular. **Which products this covers is exactly what needs checking; the snippet did not say.** |
| On full and final settlement the creditor must issue a clearance letter within seven business days and update the credit bureau record | عند السداد الكامل والنهائي على الجهة الممولة إصدار خطاب إخلاء طرف خلال سبعة أيام عمل وتحديث السجل لدى شركة المعلومات الائتمانية | — | ⬜ unverified | LEAD ONLY — [Regulations for Consumer Financing](https://rulebook.sama.gov.sa/en/regulations-consumer-financing) |

## What is deliberately NOT in this table

**Whether a rate is a good deal.** No regulation sets a fair profit rate — it
is market-determined, and Wodouh holds no benchmark to compare against. The
loan prompt forbids the model from judging price for exactly this reason
(`CR_SYSTEM_LOAN` rule 5). If a published SAMA average-rate series is found
later, that is a different kind of row than the ones above and needs its own
decision about whether a comparison is a claim Wodouh wants to make.

## Corrections log

Nothing to correct yet — nothing has been verified. When a row is checked and
the claim as written here turns out to be wrong, record what it said, what the
source actually says, and the date, exactly as `docs/legal-sources.md` does.
The log is the reason that file is trustworthy.
