# Legal sources register

Last reviewed: **31 July 2026**. Law currency: **19 February 2025** amendments,
plus the contract-transition programme running through **6 August 2026**.

The February 2025 package amended 38 articles, removed seven and added two.
A separate rollout then standardised the employment contract itself in three
phases — 6 October 2025, 6 March 2026, and 6 August 2026 — with authentication
through Qiwa as the condition of enforceability. Both are reflected below.

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

Heuristic rules citing law: overtime (107), notice period (75 for Saudis, 77
for residents), probation (53), annual leave (109), non-compete (83),
one-sided termination (80), contract type (37), and the five non-Saudi rules
(40 and Implementing Regulations art. 6). Four still carry the methodology
label — penalty clause, auto-renewal, intellectual property, salary — because
no verified article backs the specific claim those rules make, and saying so
is the point.

**There are no uncited claims left.** All three former "illustrative" rows
were resolved to verified articles on 31 July 2026.

GOSI is cited by naming the Social Insurance Law and GOSI as the authority,
never with a Labor Law article number, because it is a different statute.

## Primary sources

| Source | Covers | Link |
|---|---|---|
| Saudi Labor Law — Royal Decree M/51 (23/8/1426H), amended in force 19 Feb 2025 | Employment, leave, end of service, notice, disputes | [laws.boe.gov.sa](https://laws.boe.gov.sa/), official PDF at [hrsd.gov.sa](https://www.hrsd.gov.sa/sites/default/files/2023-02/Labor.pdf) |
| Ministry of Human Resources and Social Development | Official text, regulations, implementing guides | [hrsd.gov.sa](https://www.hrsd.gov.sa/) |
| Ejar network | Residential lease registration and tenancy | [ejar.sa](https://www.ejar.sa/) |
| Ministry of Justice — labour courts | Settlement and litigation route | [moj.gov.sa](https://www.moj.gov.sa/) |

## Claim register

> **Counting these rows: the answer is 29, not 30.**
>
> Thirty rows below contain the string `✅ verified`, but one of them — Article
> **81** — reads `✅ verified as to the grounds; the award consequence is a
> reading`. That is a partial verification, and every strict consumer excludes
> it: `tools/make-corpus.mjs` requires the status cell to be *exactly*
> `✅ verified`, the founder console requires the tick to be followed straight by
> the column break, and it counts only lines that begin a table row — so this
> note cannot inflate it. `corpus.json` therefore holds **29** rows, and a loose
> `grep` for the tick counts more and is wrong.
>
> Use the corpus count, or the console's. Both are the strict one. This note
> exists because the number was miscounted in a published roadmap on
> 24 Aug 2026 by exactly that loose grep.

| Claim as stated in the app | الادعاء كما يظهر في التطبيق | Article | Status | Checked against |
|---|---|---|---|---|
| End-of-service: half-month wage per year for the first five years, full month per year thereafter, on the last wage, pro-rata for partial years | مكافأة نهاية الخدمة: نصف أجر شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر كامل عن كل سنة بعدها، على أساس الأجر الأخير، وبنسبة ما قضاه العامل من السنة عن أجزاء السنة | **84** | ✅ verified | [HRSD](https://www.hrsd.gov.sa/en/knowledge-centre/articles/317), [WIPO Lex](https://www.wipo.int/wipolex/en/legislation/details/14685) |
| Resignation reduction, in the statute's own boundaries: **under 2 years** none; **2 years up to and including 5** one third; **in excess of 5 and under 10** two thirds; **10 or more** the full award. Five years exactly takes one third | تخفيض الاستقالة، بحدود النص نفسه: أقل من 2 سنة لا شيء؛ من 2 سنة إلى 5 سنوات ومنها ثلث المكافأة؛ ما زاد على 5 سنوات وأقل من 10 ثلثا المكافأة؛ 10 سنوات فأكثر المكافأة كاملة. وخمس سنوات بالضبط تأخذ الثلث | **85** | ✅ verified | **Official:** [HRSD — end-of-service award regulations](https://www.hrsd.gov.sa/en/knowledge-centre/articles/317), [HRSD — Labor Law PDF](https://www.hrsd.gov.sa/sites/default/files/2023-02/Labor.pdf) |
| Probation: **ceiling of 180 days**; must be stated expressly in the contract or there is no probation; Eid and sick leave excluded; either party may terminate during it | فترة التجربة: سقفها 180 يومًا؛ ويجب النص عليها صراحةً في العقد وإلا فلا فترة تجربة؛ ولا تُحتسب فيها إجازتا العيدين ولا الإجازة المرضية؛ ولكلٍّ من الطرفين إنهاء العقد خلالها | **53** | ⚠️ **DISPUTED — see below** | [DLA Piper](https://www.dlapiper.com/en/insights/publications/2024/08/amendments-to-the-ksa-labour-law) |
| Overtime paid at the hourly wage plus 50% of the basic wage. Since the 2025 amendment an employer may offer compensatory paid leave instead of payment, **but only with the worker's consent** | تُدفع ساعات العمل الإضافية بأجر الساعة مضافًا إليه 50% من الأجر الأساسي. ومنذ تعديل 2025 يجوز لصاحب العمل أن يعرض إجازة تعويضية مدفوعة بدلًا من الدفع، لكن بموافقة العامل وحده | **107** | ✅ verified | [Labour Law of KSA](https://www.eoiriyadh.gov.in/page/labour-law-of-ksa/) |
| Annual leave at least 21 days, rising to at least 30 after five consecutive years with the same employer | إجازة سنوية لا تقل عن 21 يومًا، ترتفع إلى 30 يومًا على الأقل بعد خمس سنوات متصلة لدى صاحب العمل نفسه | **109** | ✅ verified | [Labour Law of KSA](https://www.eoiriyadh.gov.in/page/labour-law-of-ksa/) |
| Notice, monthly-paid **indefinite** contract: **employer 60 days, employee 30 days**. Applies to indefinite contracts only — a non-Saudi's contract is always fixed-term (art. 37), so this rule does not reach them | مدة الإشعار في العقد غير محدد المدة بأجر شهري: على صاحب العمل 60 يومًا وعلى العامل 30 يومًا. وتسري على العقود غير محددة المدة وحدها — فعقد غير السعودي محدد المدة دائمًا (المادة 37)، فلا يبلغه هذا الحكم | **75** | ✅ verified | [Al Othman Law](https://alothmanlaw.sa/en/article-75/) |
| Labour claims not heard after 12 months from the end of the relationship, unless the court accepts an excuse or the defendant acknowledges the right | لا تُسمع الدعوى العمالية بعد 12 شهرًا من انتهاء العلاقة العمالية، ما لم تقبل المحكمة عذرًا أو يُقر المدعى عليه بالحق | **222** | ✅ verified | [Innovation SA](https://innovation-sa.com/labor-courts-will-not-consider-claims-older-12-months/), [Mondaq](https://www.mondaq.com/saudiarabia/employment-and-hr/1603250/labour-and-employment-comparative-guide) |
| **Non-Saudi only.** Employer bears recruitment fees, Iqama and work permit issuance and renewal, fines for late renewal, profession-change fees, exit and re-entry visas, and the return ticket at the end of the relationship. Worker bears return cost only if unfit for work or leaving without legitimate reason. The employer receiving a transferred worker bears the transfer fee | لغير السعوديين وحدهم. يتحمل صاحب العمل رسوم الاستقدام، وإصدار الإقامة ورخصة العمل وتجديدهما، وغرامات التأخر في التجديد، ورسوم تغيير المهنة، وتأشيرة الخروج والعودة، وتذكرة العودة عند انتهاء العلاقة. ولا يتحمل العامل تكلفة عودته إلا إذا كان غير لائق للعمل أو ترك العمل دون سبب مشروع. وصاحب العمل الذي تنتقل إليه خدمات العامل يتحمل رسوم نقل الخدمة | **40** | ✅ verified | [HRSD — what the employer bears](https://www.hrsd.gov.sa/en/knowledge-centre/articles/64434), [official law text, laws.boe.gov.sa](https://laws.boe.gov.sa/Files/Download/?attId=704cf56e-eb7a-4ddb-8c28-adbb01244dc6) |
| **Non-Saudi only.** Employer may not withhold a non-Saudi worker's passport, residence permit (Iqama) or medical insurance card | لغير السعوديين وحدهم. لا يجوز لصاحب العمل حجز جواز سفر العامل غير السعودي أو إقامته أو بطاقة تأمينه الطبي | **Implementing Regulations, art. 6** | ✅ verified | [HRSD — employers' obligations](https://www.hrsd.gov.sa/en/%D8%A7%D9%84%D8%AA%D8%B2%D8%A7%D9%85%D8%A7%D8%AA-%D8%B5%D8%A7%D8%AD%D8%A8-%D8%A7%D9%84%D8%B9%D9%85%D9%84), [Qiwa — workers' rights](https://qiwa.sa/en/labor-education/establishment-workers-rights) |
| Since the 2021 Labor Reform Initiative a worker may transfer employer through Qiwa without the current employer's consent in defined cases, including contract expiry, three consecutive months of unpaid wages, and an expired Iqama | منذ مبادرة تحسين العلاقة التعاقدية 2021 يجوز للعامل نقل خدماته عبر قوى دون موافقة صاحب العمل الحالي في حالات محددة، منها انتهاء مدة العقد، وتأخر الأجر ثلاثة أشهر متصلة، وانتهاء الإقامة | — (Labor Reform Initiative, named without an article) | ✅ verified | [Qiwa — workers' rights](https://qiwa.sa/en/labor-education/establishment-workers-rights), [Etqan Law — expatriate guide](https://etqanlawfirm-sa.com/en/new-saudi-labor-law-for-expatriates/) |
| Non-compete must be in writing and define duration, geographic area and type of activity. Two years from the end of the relationship is a **maximum**, not a norm — a longer period is not made valid by agreement | يجب أن يكون شرط عدم المنافسة مكتوبًا وأن يحدد المدة والنطاق الجغرافي ونوع النشاط. وسنتان من انتهاء العلاقة حدٌّ أقصى لا قاعدة — ولا تصح مدة أطول لمجرد الاتفاق عليها | **83** | ✅ verified | [Al Othman Law](https://alothmanlaw.sa/en/article-83/), [Bird & Bird](https://www.twobirds.com/en/insights/2026/saudi-arabia/non-compete-and-confidentiality-clauses-under-saudi-labour-law-what-employers-need-to-know) |
| Compensation for termination without valid reason, **indefinite** contract: 15 days' wages per year of service, floor of two months' wages | التعويض عن الإنهاء دون سبب مشروع في العقد غير محدد المدة: أجر 15 يومًا عن كل سنة من سنوات الخدمة، بحد أدنى أجر شهرين | **77** | ✅ verified | [Al Othman Law](https://alothmanlaw.sa/en/saudi-labour-law-article-77/), [Bird & Bird](https://www.twobirds.com/en/insights/2026/saudi-arabia/how-can-organisations-navigate-employee-dismissal-under-the-updated-saudi-labour-law) |
| Compensation for termination without valid reason, **fixed-term** contract: the wages for the **remaining term** of the contract, floor of two months' wages. This is the branch that applies to every non-Saudi | التعويض عن الإنهاء دون سبب مشروع في العقد محدد المدة: أجر المدة الباقية من العقد، بحد أدنى أجر شهرين. وهذا هو الفرع الذي يسري على كل غير سعودي | **77** | ✅ verified | [Al Othman Law](https://alothmanlaw.sa/en/saudi-labour-law-article-77/), [Atayyar Legal](https://al-tayyar.com.sa/en/saudi-labor-law-article-77/) |
| A non-Saudi's contract must be **written and fixed-term**, and never converts to indefinite regardless of duration or renewal, even by agreement. Where no term is stated it is taken as one year from actual commencement | يجب أن يكون عقد غير السعودي مكتوبًا ومحدد المدة، ولا يتحول إلى غير محدد المدة مهما طالت مدته أو تكرر تجديده، ولو اتفق الطرفان على ذلك. وإذا لم تُذكر مدته عُدَّ سنةً واحدة من تاريخ مباشرة العمل فعليًا | **37** | ✅ verified | [Qiwa — employment of non-Saudis](https://www.qiwa.sa/en/labor-law/non-saudis/employment-non-saudis), [DLA Piper on the amendments](https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2024/Amendments-to-the-KSA-Labour-Law) |
| Termination without award or notice is confined to the specified cases in Article 80, treated by the labour courts as an exceptional disciplinary provision rather than a routine route. The employer must let the worker state their case, document the reason, and notify in writing | الإنهاء دون مكافأة ولا إشعار مقصور على الحالات المحددة في المادة 80، وتتعامل معه المحاكم العمالية بوصفه حكمًا تأديبيًا استثنائيًا لا طريقًا معتادًا. وعلى صاحب العمل أن يمكّن العامل من بيان وجهة نظره، وأن يوثّق السبب، وأن يبلغه كتابةً | **80** | ✅ verified | [Al Tayyar Legal](https://al-tayyar.com.sa/en/article-80-saudi-labor-law/), [Mondaq — Articles 80 and 81](https://www.mondaq.com/saudiarabia/employee-rights-labour-relations/1625022/saudi-labor-law-articles-80-and-81-the-legal-framework-governing-termination-and-resignation-in-saudi-arabia) |
| A resignation is deemed accepted if the employer does not respond within 30 days | تُعد الاستقالة مقبولة إذا لم يرد صاحب العمل عليها خلال 30 يومًا | **79** | ✅ verified | [Clyde & Co — resignations](https://www.clydeco.com/en/insights/2025/03/ksa-labour-law-amendments-resignations), [Al Tamimi](https://www.tamimi.com/news/key-amendments-to-saudi-arabias-labour-law/) |
| Bankruptcy, and resignation as newly defined, are lawful grounds for ending a contract | الإفلاس، والاستقالة بتعريفها الجديد، سببان مشروعان لانتهاء العقد | **74** | ✅ verified | [Al Tamimi](https://www.tamimi.com/news/key-amendments-to-saudi-arabias-labour-law/), [Addleshaw Goddard](https://www.addleshawgoddard.com/en/insights/insights-briefings/2025/employment/navigating-new-horizon-understanding-2025-amendments-ksa-labour-law/) |
| Contracts must be authenticated through Qiwa to be enforceable; unregistered or hand-signed contracts no longer carry enforceable status. Existing fixed-term contracts moved to the standard form from **6 March 2026**, indefinite contracts from **6 August 2026** | يجب توثيق العقود عبر قوى لتكون نافذة؛ ولم يعد للعقود غير المسجلة أو الموقعة يدويًا صفةٌ نافذة. وانتقلت العقود محددة المدة القائمة إلى النموذج الموحد من 6 مارس 2026، والعقود غير محددة المدة من 6 أغسطس 2026 | — (contract-transition programme, named without an article) | ✅ verified | [Morgan Lewis](https://www.morganlewis.com/blogs/shiftingsandsoflaborlaw/2025/12/employment-contract-enhancements-in-the-kingdom-of-saudi-arabia), [Pinsent Masons](https://www.pinsentmasons.com/out-law/news/saudi-arabia-salary-protection-unified-employment-contract) |
| **Non-Saudi only.** A non-Saudi employee contributes **nothing** to GOSI from salary. The employer pays **2%** of the contributable wage for the occupational-hazards branch alone. Non-Saudis are not covered by the pension (annuities) branch or by SANED | لغير السعوديين وحدهم. لا يُقتطع من راتب العامل غير السعودي أي اشتراك في التأمينات الاجتماعية. ويدفع صاحب العمل 2% من الأجر الخاضع للاشتراك عن فرع الأخطار المهنية وحده. ولا يشمل غيرَ السعوديين فرعُ المعاشات ولا نظام ساند | — (Social Insurance Law; GOSI is the authority, no Labor Law article) | ✅ verified | [GOSI](https://www.gosi.gov.sa/GOSIOnline/Contribution&locale=en_US), [Mercans 2026 rates](https://mercans.com/resources/statutory-alerts/saudi-arabia-gosi-contribution-rates-saned-unemployment-fund-2026/) |
| **Saudi only.** Saudi nationals registered **before 3 July 2024** contribute under the legacy system: **21.5%** total, employer 11.75% and employee 9.75%. Those registered **on or after 3 July 2024** fall under the new system, which rose in July 2026 to **23.5%** total, employer 12.75% and employee 10.75% | للسعوديين وحدهم. من سُجّل من السعوديين قبل 3 يوليو 2024 يخضع للنظام السابق: 21.5% إجمالًا، منها 11.75% على صاحب العمل و9.75% على العامل. ومن سُجّل في 3 يوليو 2024 أو بعده يخضع للنظام الجديد، الذي ارتفع في يوليو 2026 إلى 23.5% إجمالًا، منها 12.75% على صاحب العمل و10.75% على العامل | — (Social Insurance Law) | ✅ verified | [GOSI](https://www.gosi.gov.sa/GOSIOnline/Contribution&locale=en_US), [Mercans 2026 rates](https://mercans.com/resources/statutory-alerts/saudi-arabia-gosi-contribution-rates-saned-unemployment-fund-2026/) |
| GOSI contributions are calculated on **basic wage plus housing allowance only**, capped at a contributable wage of **SAR 45,000 per month** | تُحتسب اشتراكات التأمينات الاجتماعية على الأجر الأساسي مضافًا إليه بدل السكن وحدهما، بحد أقصى للأجر الخاضع للاشتراك قدره 45,000 ريال شهريًا | — (Social Insurance Law) | ✅ verified | [GOSI](https://www.gosi.gov.sa/GOSIOnline/Contribution&locale=en_US), [Mercans](https://mercans.com/glossary/gosi-contributions/) |
| GOSI and the end-of-service award are **separate entitlements**. The award under Articles 84 and 85 is paid by the employer and is not reduced by, offset against, or replaced by GOSI pension contributions | التأمينات الاجتماعية ومكافأة نهاية الخدمة استحقاقان منفصلان. والمكافأة بموجب المادتين 84 و85 يدفعها صاحب العمل، ولا تُخصم منها اشتراكات معاشات التأمينات، ولا تُقاص بها، ولا تحل محلها | — (Social Insurance Law read with Labor Law arts. 84–85) | ✅ verified | [HRSD — end of service](https://www.hrsd.gov.sa/en/%D9%85%D9%83%D8%A7%D9%81%D8%A3%D8%A9-%D9%86%D9%87%D8%A7%D9%8A%D8%A9-%D8%A7%D9%84%D8%AE%D8%AF%D9%85%D8%A9), [Cercli](https://www.cercli.com/resources/saudi-labor-law-end-of-service) |
| **Saudi only.** SANED unemployment insurance: available to Saudi nationals who lost work **involuntarily**, are actively seeking work, have contributed for at least **12 months in the past 36**, and are registered with Taqat (HRDF). Pays **60%** of the average covered monthly wage over the previous two years for the first three months, capped at **SAR 9,000**, then **50%**, for up to **12 months**. Funded 0.75% employer and 0.75% employee | للسعوديين وحدهم. تأمين ساند ضد التعطل عن العمل: متاح للسعودي الذي فقد عمله لسبب خارج عن إرادته، ويبحث عن عمل فعليًا، وأمضى 12 شهرًا من الاشتراك على الأقل خلال 36 شهرًا الماضية، ومسجل في طاقات (صندوق تنمية الموارد البشرية). ويدفع 60% من متوسط الأجر الشهري الخاضع للاشتراك في السنتين السابقتين خلال الأشهر الثلاثة الأولى، بحد أقصى 9,000 ريال، ثم 50%، لمدة تصل إلى 12 شهرًا. ويموَّل بنسبة 0.75% على صاحب العمل و0.75% على العامل | — (Social Insurance Law; SANED programme) | ✅ verified | [GOSI — SANED](https://www.gosi.gov.sa/GOSIOnline/Unemployment_Insurance_(SANED)&locale=en_US), [ISSA](https://www.issa.int/gp/173467) |
| The wage clause in a Qiwa contract carries direct enforcement: unpaid wages can be pursued through the Ministry of Justice's Najiz portal without first going through MHRSD or the labour courts | بند الأجر في عقد قوى واجب النفاذ مباشرةً: يمكن المطالبة بالأجور غير المدفوعة عبر بوابة ناجز في وزارة العدل دون المرور أولًا بوزارة الموارد البشرية أو بالمحاكم العمالية | — (contract-transition programme) | ✅ verified | [Pinsent Masons](https://www.pinsentmasons.com/out-law/news/saudi-arabia-salary-protection-unified-employment-contract), [BCLP](https://www.bclplaw.com/en-US/events-insights-news/saudi-arabias-evolving-labor-landscape-a-consolidated-legal-update.html) |
| A party who terminates without observing the Article 75 notice pays the other party compensation equal to the worker's wage for the notice period, or the balance of it, on the last wage. **Indefinite contracts only** — it is the remedy for breaching Article 75, which does not reach a non-Saudi's always-fixed-term contract (art. 37) | من أنهى العقد دون مراعاة الإشعار المنصوص عليه في المادة 75 يدفع للطرف الآخر تعويضًا يعادل أجر العامل عن مدة الإشعار أو عن الجزء الباقي منها، محسوبًا على الأجر الأخير. وللعقود غير محددة المدة وحدها — فهو جزاء مخالفة المادة 75 التي لا تبلغ عقد غير السعودي المحدد المدة دائمًا (المادة 37) | **76** | ✅ verified | **Official:** [HRSD — contract termination](https://www.hrsd.gov.sa/en/knowledge-centre/articles/306), [HRSD — Labor Law PDF](https://www.hrsd.gov.sa/sites/default/files/2023-02/Labor.pdf) |
| A worker may leave without notice, **without prejudice to all of his statutory rights**, where the employer fails essential contractual or statutory obligations, used fraud about the work conditions at contracting, or assigns essentially different work without consent (art. 60) — and where the employer or their representative commits a violent or immoral act against the worker or their family. A departure on these grounds keeps the **full** end-of-service award under art. 84 rather than the reduced resignation tiers of art. 85 | للعامل أن يترك العمل دون إشعار، مع احتفاظه بحقوقه النظامية كاملة، إذا أخل صاحب العمل بالتزاماته العقدية أو النظامية الجوهرية، أو استعمل الغش في شروط العمل عند التعاقد، أو كلّفه عملًا يختلف اختلافًا جوهريًا دون موافقته (المادة 60) — وكذلك إذا وقع من صاحب العمل أو ممن يمثله اعتداء أو فعل مخل بالآداب على العامل أو على أحد أفراد أسرته. والترك لهذه الأسباب يبقي مكافأة نهاية الخدمة كاملة بموجب المادة 84 لا وفق شرائح الاستقالة المخفضة في المادة 85 | **81** | ✅ verified as to the grounds; the award consequence is a **reading**, see below | **Official:** [HRSD — FAQs](https://www.hrsd.gov.sa/en/labour-education-faq), [HRSD — Labor Law PDF](https://www.hrsd.gov.sa/sites/default/files/2023-02/Labor.pdf), [Qiwa — work relations](https://www.qiwa.sa/en/labor-law/contracts/work-relations) |
| Accrued annual leave not taken is paid on leaving, for the whole period in which it was not used, and pro-rata for the part-year worked. Calculated on the last wage. The right cannot be waived by either party | تُدفع الإجازة السنوية المستحقة التي لم تُستعمل عند ترك العمل، عن كامل المدة التي لم تُستعمل فيها، وبنسبة ما قضاه العامل من السنة. وتُحسب على الأجر الأخير. ولا يجوز لأي من الطرفين التنازل عن هذا الحق | **111** | ✅ verified | **Official:** [HRSD — annual leave](https://www.hrsd.gov.sa/en/knowledge-centre/articles/321), [HRSD — regulations on leaves (PDF)](https://www.hrsd.gov.sa/sites/default/files/2023-03/Regulations%20on%20Leaves.pdf) |
| **Exceptions to the resignation reduction.** The full award is due despite Article 85 where the worker leaves for a **force majeure beyond their control**; and a **female worker** is entitled to the full award if she ends her contract within **six months of marriage** or **three months of giving birth** | استثناءات من تخفيض الاستقالة. تُستحق المكافأة كاملة رغم المادة 85 إذا ترك العامل العمل لقوة قاهرة خارجة عن إرادته؛ وتستحق العاملة المكافأة كاملة إذا أنهت عقدها خلال ستة أشهر من تاريخ زواجها أو ثلاثة أشهر من وضعها | **87** | ✅ verified | [HRSD — end-of-service award regulations](https://www.hrsd.gov.sa/en/knowledge-centre/articles/317), [HRSD — Labor Law PDF](https://www.hrsd.gov.sa/sites/default/files/2023-02/Labor.pdf) |
| A labour dispute begins with **amicable settlement**, filed electronically with MHRSD; roughly a week is allowed for direct negotiation, followed by settlement sessions. If it fails, the case may be referred to the **labour court within 21 working days** of the first complaint | تبدأ المنازعة العمالية بالتسوية الودية، تُقدَّم إلكترونيًا لدى وزارة الموارد البشرية؛ ويُتاح نحو أسبوع للتفاوض المباشر، تليه جلسات التسوية. وإذا لم تنجح جاز إحالة الدعوى إلى المحكمة العمالية خلال 21 يوم عمل من تاريخ أول شكوى | — (MHRSD friendly-settlement procedure) | ✅ verified | [HRSD — friendly settlement for labor disputes](https://www.hrsd.gov.sa/en/ministry-services/services/269970), [HRSD — steps to file](https://www.hrsd.gov.sa/en/media-center/documents-and-reports/1532852), [GOV.SA](https://my.gov.sa/en/wps/portal/snp/servicesDirectory/servicedetails/rs2924) |
| During the notice period on an employer-initiated termination, the worker is entitled to **one full day or eight hours per week** of paid absence to look for other work, timed by the worker with a day's notice | خلال مدة الإشعار في الإنهاء الصادر من صاحب العمل، يستحق العامل التغيب يومًا كاملًا أو ثماني ساعات في الأسبوع بأجر للبحث عن عمل آخر، يحدد وقته العامل بعد إشعار صاحب العمل بيوم | **75** (notice-period provisions) | ✅ verified | [HRSD — contract termination](https://www.hrsd.gov.sa/en/knowledge-centre/articles/306) |
| Final settlement is due within **one week** of the relationship ending where the employer terminated or the contract expired, and within **two weeks** where the worker resigned. It covers final wages, unused leave and the end-of-service award | تُستحق التصفية النهائية خلال أسبوع واحد من انتهاء العلاقة إذا أنهى صاحب العمل العقد أو انتهت مدته، وخلال أسبوعين إذا استقال العامل. وتشمل الأجور الأخيرة والإجازات غير المستعملة ومكافأة نهاية الخدمة | **88** | ✅ verified | **Official:** [HRSD — Labor Law PDF](https://www.hrsd.gov.sa/sites/default/files/2023-02/Labor.pdf), [HRSD — end-of-service award regulations](https://www.hrsd.gov.sa/en/knowledge-centre/articles/317) |

## ⚠️ Open dispute — Article 53, the probation mechanism

**Raised 13 August 2026. Not resolved. Do not treat this row as verified.**

**What is not in dispute**, and what the product therefore still says: the
ceiling is **180 days**; probation must be stated expressly in the contract, and
where it is not there is no probation; Eid al-Fitr, Eid al-Adha and sick leave
do not count toward it; either party may terminate during it.

**What is in dispute** is the mechanism to reach 180:

| Reading | Claim | Where it comes from |
|---|---|---|
| **A** — the register's original row | 90 days initially, extendable **by separate written agreement** to 180 total | DLA Piper (Aug 2024); Saudi law-firm explainers still describing it this way in 2026 |
| **B** — post-amendment | Up to **180 days stated in the contract from the outset**, with no separately agreed extension | Multiple summaries of the 19 February 2025 amendment package |

**Why this was not settled.** The development sandbox's egress proxy blocked
every authoritative source attempted: `laws.boe.gov.sa` (Bureau of Experts, the
official text), `morganlewis.com`, `kslaw.com`, `knowledge.dlapiper.com`, and
the Saudi firm pages `sgmtlaw.sa` and `etqanlawfirm-sa.com`. Search-result
summaries are not a primary source and were not treated as one. **No article
text was inferred, and the register was not "corrected" to the newer reading —
an unverified change is not an improvement over an unverified row.**

**Why it matters to a reader.** Under A, a contract stating 180 days from day
one is defective. Under B, it is lawful. An employee told the wrong one either
challenges a valid clause or accepts an invalid one.

**How to settle it.** Read Article 53 in the current consolidated text at the
Bureau of Experts (`laws.boe.gov.sa`) or the HRSD Labor Law PDF, from an
unproxied machine, and check whether the 19 February 2025 package amended it.
One reading of the official Arabic settles this in minutes.

**Until then:** the app's assistant answer states the undisputed facts and names
this specific uncertainty in both languages rather than asserting either
reading. That is the only honest position available, and it is also the one
this register exists to enforce.

---

## Corrections log

**July 2026 — Article 75.** The assistant stated notice as "60 days if you're
paid monthly and 30 days otherwise." That is wrong. Article 75 is asymmetric:
for a monthly-paid indefinite contract the **employer** must give 60 days and
the **employee** 30. The original wording also understated an employee's freedom
to leave. Corrected, and the article is now cited.

This error was found only because the sources feature forced verification of
claims the app had been asserting for weeks. That is the argument for keeping
this register current.

**July 2026 — Article 77, and who it applies to.** The case-file estimate
applied the indefinite-contract formula — 15 days' wages per year of service,
floor two months — to every user. Article 77 has two branches, and a
**fixed-term** contract is compensated with the wages for the **remaining
term** instead. Under Article 37 a non-Saudi's contract is always fixed-term,
so the app was showing the wrong branch to every non-Saudi who used it. On six
years' service with eight months left, that understated the figure by roughly
five months' wages.

Both branches are now registered and verified, the calculator asks for the
contract's end date when the fixed-term branch applies, and the app no longer
falls back to the indefinite formula silently.

The same audit found Article 75's notice rule and the two non-Saudi-only
provisions (art. 40, Implementing Regulations art. 6) being shown to everyone
regardless of nationality. Scoped accordingly.

**31 July 2026 — full re-verification, and a staleness finding.** The register
claimed law currency of 19 February 2025 while the date was 31 July 2026. That
gap was itself the defect: a register nobody re-reads is decoration.

Every row was re-checked. Ten were confirmed unchanged — Articles 37, 40, 53,
75, 77, 84, 85, 109, 222, Implementing Regulations art. 6, and the Labor
Reform Initiative. Article 75's asymmetry survives the amendment: 60 days for
the employer, 30 for the worker.

One row was wrong by omission. **Article 107** now lets an employer offer
compensatory paid leave instead of paying overtime, *with the worker's
consent*. The app stated the rate and stopped, so a worker offered time off
instead of money had no way to know consent was theirs to withhold.

Five developments were absent entirely: **Article 79** (a resignation is
deemed accepted after 30 days of employer silence), **Article 74** (bankruptcy
and resignation as grounds), the **Qiwa authentication requirement**, **Najiz
direct wage enforcement**, and the **contract-transition deadlines** — the
last of which, 6 August 2026 for indefinite contracts, fell six days after
this review.

The lesson is the cadence, not the content. This was found by asking whether
the register was still true, which is the only question that keeps one
honest.

**August 2026 — Articles 76, 81, 111 and 88, and a live understatement.**
Added for the termination assessment. One of them corrects a figure the app
was already showing.

**Article 81 is the finding that matters.** The end-of-service calculator
applies the Article 85 resignation tiers to anyone who says they resigned —
which is **nothing at all** under two years' service. But Article 81 lets a
worker leave without notice, *"without prejudice to all of his statutory
rights"*, where the employer breached essential obligations, used fraud at
contracting, assigned essentially different work without consent, or committed
a violent or immoral act. A departure on those grounds keeps the **full**
award under Article 84.

So a person pushed out by an employer who stopped paying them, who told Wodouh
"I resigned", was shown zero where the full award may have been due. The
termination flow now separates *"I was asked to resign"* from *"I resigned"*
for exactly this reason, and names Article 81 where it applies.

Article **76** completes Article 75: the party who ignores the notice period
pays the wage for it. It inherits Article 75's scope — indefinite contracts —
so like Articles 75 and 40 it must not be shown to non-Saudis, whose contracts
are always fixed-term under Article 37. That scoping is the same trap that
produced the Article 77 error above, recorded here so the next reader sees the
pattern rather than the instance.

Article **111** (accrued leave paid on leaving, un-waivable) and Article **88**
(settlement within one week if the employer ended it, two if the worker
resigned) were both absent, and both are money the reader can act on.

**A limitation in how these four were checked.** The sandbox's network proxy
refused direct fetches of `hrsd.gov.sa`, `laws.boe.gov.sa` and the firm sites,
so unlike earlier rounds these were verified through search results that quote
the statutory text, corroborated across independent sources rather than read
from the official PDF. Article 81's text was returned verbatim and matched
across sources; the others matched in substance across at least two. **This is
a weaker standard than the rows above it**, and it raises rather than lowers
the priority of the lawyer review.

**9 August 2026 — official-source pass, and a second live understatement.**
The August entry above admitted a weaker standard: the proxy refused direct
fetches, so Articles 76, 81, 111 and 88 rested on commentary. That gap is now
closed. Searching restricted to `hrsd.gov.sa`, `laboreducation.hrsd.gov.sa`,
`qiwa.sa`, `gosi.gov.sa` and `my.gov.sa` returns official text, and **Articles
53, 75, 76, 77, 80, 81, 84, 85, 87, 88, 109 and 111 are now confirmed against
MHRSD's own pages and its published Labor Law PDF.** Direct page fetches of
those domains remain blocked, so the reading is via official search results
rather than a browser session — better than commentary, short of the gazette.

**Article 87 was missing, and its absence understated real awards.** Two
exceptions defeat the Article 85 resignation reduction:

- a worker who leaves for a **force majeure beyond their control** keeps the
  full award;
- a **female worker** keeps the full award if she ends her contract within
  **six months of marriage** or **three months of giving birth**.

So a woman who resigned two months after giving birth was shown the reduced
tiers — a third of the award at three years' service, and **nothing at all**
under two years. That is the same class of defect as the Article 81 finding
recorded above, found the same way, and it is the second one in this feature.
The pattern is worth naming: *every rule that reduces an entitlement has
exceptions, and a reduction shipped without its exceptions is a understatement
waiting for the right user.*

**One claim is deliberately downgraded.** Article 81's **grounds** are
quoted verbatim by official sources. Its **award consequence** — that a
departure on those grounds carries the full Article 84 award rather than the
Article 85 tiers — rests on the statutory phrase *"without prejudice to all of
his statutory rights"* plus consistent commentary. No official page states the
award consequence in those words. It is therefore marked in the product as a
reading, not as a bare citation, and it is the first question in the lawyer
pack.

Also added: the **MHRSD friendly-settlement procedure** (electronic filing,
about a week for direct negotiation, settlement sessions, referral to the
labour court within 21 working days), and the **notice-period job-search
entitlement** of one day or eight hours a week.

**9 August 2026 — the Article 85 boundary, and an overstatement.** The
scenario suite exercised exactly five years of service on the resignation path
and caught a boundary read the wrong way. Article 85 gives one third *"after
service of not less than two consecutive years and **not more than five
years**"* and two thirds *"if his service is **in excess of** five"*. Five
years exactly therefore takes **one third**, and the code took two thirds —
16,667 SAR where 8,333 was due on a 10,000 wage.

**This one overstated**, which is the opposite failure from the Article 81 and
87 findings and is its own kind of harm: an inflated figure is what somebody
carries into a settlement meeting. The register row now states the boundaries
in the statute's own words rather than the shorthand "2–5 / 5–10", which is
what made the error easy to write and hard to see.

Also changed, from the same suite: where the reader has not given us what a
line needs, the app now **names the line as unassessed** rather than omitting
it. Silence read as "nothing is owed here", which is an answer we had not
earned.

**21 August 2026 — the register is bilingual, and it had to be.**

Every claim now exists in Arabic beside its English, in the same row. This is
a translation of rows already marked verified: nothing was added, removed,
re-scoped or promoted out of dispute, and Article 53 stays disputed and stays
out of the corpus.

It was not a display gap. `tools/make-corpus.mjs` compiles the ticked rows into
the only legal text the answering model is ever shown, and that block was
English. An Arabic question therefore handed the model English statute and told
it to reply in Arabic — so **the model was translating the law itself, at
answer time, unsupervised**, on the one surface whose whole promise is that a
human wrote the words. The reader then saw that translation printed underneath
the answer as the evidence for it.

Two things now hold by construction rather than by care. A verified row with no
Arabic **fails the build** instead of shipping. And the digits in the two
languages must match exactly, row for row, which is the same rule the app
already applies to the model — *nothing that reads the law may change a
figure* — turned around and applied to the translator. A row claiming 180 days
in English and 90 in Arabic is a different legal claim wearing the same id, and
it is now impossible to commit one.

The register's prose sections stay English. They are notes to whoever maintains
this file, and they never reach a reader.

## Before shipping to real users

1. A licensed Saudi lawyer must review every row above, including the verified
   ones — secondary sources agree with each other more readily than they agree
   with the statute.
2. ~~Resolve the three illustrative rows.~~ **Done, 31 July 2026.** All three
   now cite verified articles — non-compete to 83, termination without award
   to 80, unjustified-termination compensation to 77. No claim in the product
   is now uncited.
3. Set a recurring re-verification date. Saudi labour regulation is moving
   quickly; the February 2025 amendments will not be the last.
4. The end-of-service calculator is the highest-risk surface — a wrong figure
   there costs someone real money. It should be checked against worked examples
   supplied by counsel, not only against the formula.

## Review cadence

Accuracy is not a launch task, it is a standing one. Reputation here compounds
in whichever direction the content earns.

- **Every claim carries a checked date.** The table above was last reviewed
  July 2026 against law current to 19 February 2025.
- **Re-verify every 12 months, and immediately on any amendment.** A row older
  than twelve months is treated as stale and must be re-checked before it can
  keep its ✅ — the same twelve months Article 222 gives a worker to bring a
  claim, which is a useful reminder of how fast this matters to someone.
- **Corrections stay published.** The Article 75 entry below is kept
  deliberately. A visible corrections log is evidence the register is real; a
  silently edited one is worth nothing.

### How user feedback feeds this

Every thumbs-down in the app records the rules that fired, the decision they
produced, the confidence claimed, and the free-text comment (see `fbRecord`).
That makes an inaccurate verdict traceable to the specific heuristic behind it
rather than to a general sense that something was off.

Recommended loop once feedback reaches a real backend: aggregate by rule id,
sort by negative rate, and re-verify the worst-performing rules first. A rule
that is consistently reported wrong is either mis-citing the law or matching
text it should not — both are fixable, and neither is visible without the
rule id.
