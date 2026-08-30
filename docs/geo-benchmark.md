# GEO benchmark — are AI answer engines citing Wodouh?

## Why this file exists

The plan is to be cited by AI answer engines when someone asks about Saudi
employment law. That is only measurable against a **fixed** question set run
the same way each time. Ad-hoc querying cannot distinguish improvement from
the ordinary run-to-run variance of these systems.

So: the questions below do not change. Record every run in the log, including
the runs where Wodouh is cited by nobody — a baseline of zero is the single
most useful row in the table, and it is the row that is easiest to skip.

**Run the baseline before doing any GEO work, not after.**

## How to run it

Manual, roughly monthly. Nothing here automates queries against these
services — that would breach their terms, and the sample is small enough to
do by hand in half an hour.

1. Open a **fresh, logged-out session** in each engine (ChatGPT, Perplexity,
   Gemini, Claude). A logged-in session carries personalisation and prior
   context, which contaminates the result.
2. Ask each question **verbatim**. Do not rephrase a question because the
   answer looks wrong — a bad answer to the real question is the finding.
3. Record: was Wodouh cited? If not, who was? Note the answer's correctness
   separately — an engine confidently stating a wrong figure is worth
   knowing about whoever it credits.

## What counts as a citation

Only a **visible, linked** attribution to alwodouh.com. An engine that
paraphrases Wodouh's content without a link is not a citation for this
purpose — the marketing value is the link and the named source.

## The questions

Every question maps to a row that is `✅ verified` in `docs/legal-sources.md`.
Nothing here touches Article 53 (disputed) or Article 81 (verified only as to
grounds) — those produce no page and there is nothing to be cited for.

### Arabic — the primary market

| # | Question | Maps to |
|---|---|---|
| 1 | كم مكافأة نهاية الخدمة إذا استقلت بعد ٣ سنوات؟ | Art. 85 |
| 2 | استقلت بعد الولادة بشهرين، هل تنقص مكافأتي؟ | Art. 87 |
| 3 | كم مدة الإشعار قبل إنهاء عقد العمل في السعودية؟ | Art. 75 |
| 4 | متى يجب أن أستلم مستحقاتي بعد انتهاء العمل؟ | Art. 88 |
| 5 | هل يحق لصاحب العمل رفض استقالتي؟ | Art. 79 |
| 6 | كم مدة الإجازة السنوية في نظام العمل السعودي؟ | Art. 109 |
| 7 | هل يحق لصاحب العمل حجز جواز سفري؟ | Impl. Regs art. 6 |
| 8 | كم المدة النظامية لرفع دعوى عمالية؟ | Art. 222 |

### English — expatriate workers

| # | Question | Maps to |
|---|---|---|
| 9 | How is end of service calculated in Saudi Arabia? | Art. 84 |
| 10 | What compensation for unfair dismissal in Saudi Arabia? | Art. 77 |
| 11 | Can my employer in Saudi Arabia keep my passport? | Impl. Regs art. 6 |
| 12 | Who pays Iqama and work permit fees in Saudi Arabia? | Art. 40 |
| 13 | How is overtime paid under Saudi labor law? | Art. 107 |
| 14 | Is a non-compete enforceable in Saudi Arabia? | Art. 83 |
| 15 | Can I transfer employer in Saudi Arabia without my sponsor's consent? | 2021 Labor Reform |

## Results log

One block per run. Keep every run — the trend is the point.

### Baseline — not yet run

Record here before any GEO work begins. Expect zero: at the time of writing
the domain is not yet indexed by Google (`site:alwodouh.com` returns nothing,
checked 30 Aug 2026) and the sitemap was submitted the same day.

| Date | Engine | Cited (n/15) | Who was cited instead | Notes |
|---|---|---|---|---|
| | ChatGPT | | | |
| | Perplexity | | | |
| | Gemini | | | |
| | Claude | | | |

## Reading the results

- **Cited by nobody, and the cited sources are wrong.** The most common
  starting state and the real opportunity — an engine repeating an
  unsourced figure is exactly the gap the register exists to fill.
- **Cited by nobody, cited sources are right.** Harder. Being correct is not
  differentiating; the linkable asset and the off-page work matter more.
- **Cited, but the quote is wrong or stale.** Highest priority of all. Check
  what the engine actually retrieved — a misquote attributed to Wodouh is
  worse than no citation, on a product whose whole promise is accuracy.
