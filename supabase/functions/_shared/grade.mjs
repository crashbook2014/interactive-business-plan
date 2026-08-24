/* Wodouh — the grader for AI answers.
 *
 * WHY THIS IS A SEPARATE FILE
 *
 * Everything that decides whether a reader sees an answer lives here, in plain
 * JavaScript, so the Deno function and the Node test suite run the SAME code.
 * A guarantee proven against a re-implementation is not proven.
 *
 * WHAT IT GUARANTEES
 *
 * The model proposes; this decides. Given a completion and the corpus it was
 * allowed to draw from, gradeAnswer returns what may be shown:
 *
 *   - "verified"   — it cited real rows, and every article number and riyal
 *                    figure in the answer comes from one of them.
 *   - "unverified" — general knowledge. No article number, no money, at all.
 *   - "refused"    — the model declined, or it broke one of those two rules.
 *
 * Breaking a rule refuses the WHOLE answer rather than editing it. Stripping a
 * citation out of a sentence leaves a sentence that reads like it never made a
 * legal claim, which is a worse lie than the one being removed.
 */

/* Arabic-Indic digits are digits. Every check runs on normalised text, because
   a rule that only holds in English is not a rule in this app. */
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function normNum(s){
  return String(s)
    .replace(/[٠-٩]/g, d => String(AR_DIGITS.indexOf(d)))
    /* U+066C ARABIC THOUSANDS SEPARATOR and U+066B ARABIC DECIMAL SEPARATOR.
       Without these, "٤٥٬٠٠٠ ريال" normalises to "45٬000 ريال" and the money
       matcher reads it as the number 000 — a figure written the way Arabic
       actually writes it was invisible to a check whose whole job is to see
       figures. It failed safe (an unrecognised number is refused, not
       allowed), but it failed. */
    .replace(/\u066C/g, ",")
    .replace(/\u066B/g, ".");
}

/* Every article number the text asserts, in either language. Deliberately
   greedy: a false positive costs one refused answer, a false negative ships an
   unsourced citation under a brand whose entire claim is sourcing.

   THE LEAD-IN WAS THE WHOLE TEST, and on its own it is not enough. The pattern
   demanded "article" / "art." / "المادة" in front, so "Art 77 applies" — no
   dot — and "Under 77 of the Labor Law" each asserted an article number and
   each sailed past the check that exists to catch exactly that. Both measured
   against this grader before the change: shown, tier=verified.

   A number now counts as a citation if EITHER side names the statute: an
   article word in front, or the law named behind it.

   What is deliberately NOT added is a bare number with nothing either side.
   "She is 84 years old" asserts no article, and a rule that refused it would
   refuse ordinary prose until the feature was unusable. ask.test.js pins that
   case, and it must keep passing. */
const ART_LEAD  = /(?:articles?|arts?\.?|المادة|المواد)\s*\.?\s*(\d{1,3})/gi;
const ART_TRAIL = /(\d{1,3})\s*(?:of\s+the\s+)?(?:saudi\s+)?labou?r\s+(?:law|code)|(\d{1,3})\s*(?:من\s+)?نظام\s+العمل/gi;
export function articlesIn(text){
  const t = normNum(text);
  const out = new Set();
  for (const m of t.matchAll(ART_LEAD)) out.add(m[1]);
  for (const m of t.matchAll(ART_TRAIL)) out.add(m[1] || m[2]);
  return [...out];
}

/* Any amount of money the text asserts. The unit leads in English and trails
   in Arabic, so both orders are matched.

   A CURRENCY WORD USED TO BE REQUIRED, which made the guarantee depend on the
   model's phrasing. "You are owed SAR 45,000" was refused; "You are owed
   45000" — same claim, same reader, same number — was shown as verified. Both
   measured. A reader who sees "your benefit works out to 45000" reads riyals,
   and the point of a grader is that it does not rely on the model being tidy.

   So a bare number counts as an asserted amount when it is large enough to be
   one. FOUR DIGITS IS THE THRESHOLD, because that is where this domain's
   quantities separate: Saudi wages, awards and caps are four figures and up,
   while article numbers, notice days, leave days and percentages are one to
   three. A lower threshold would refuse ordinary sentences about Article 84 and
   30 days' notice until the feature was unusable.

   YEARS ARE EXCLUDED, and the corpus is the reason. Every 4-digit number in it
   is either 45,000, 9,000, or one of 2021 / 2024 / 2025 / 2026 sitting in a
   date. Without the exclusion an answer correctly citing "the 2025 amendment"
   would be refused as an unsourced riyal figure. A thousands separator escapes
   the exclusion — 2,025 is money, 2025 is a year — because nobody writes a year
   with a comma.

   The residual gap, stated rather than hidden: a bare figure that looks like a
   year and IS meant as riyals slips through. Written naturally that amount is
   "SAR 2,025" or "2025 ريال", and both are caught above. */
const YEARISH = /^(?:19|20)\d\d$/;
export function moneyIn(text){
  const t = normNum(text);
  const out = new Set();
  const strip = n => n.replace(/,/g, "");
  for (const m of t.matchAll(/(?:SAR|SR|ريال|ريالا?ً?|﷼)\s*([\d,]+(?:\.\d+)?)/gi)) out.add(strip(m[1]));
  for (const m of t.matchAll(/([\d,]+(?:\.\d+)?)\s*(?:SAR|SR|ريال|ريالا?ً?|﷼)/gi)) out.add(strip(m[1]));
  for (const m of t.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = m[0], n = strip(raw);
    if (n.replace(/\..*$/, "").length < 4) continue;      /* too small to be an award */
    if (!raw.includes(",") && YEARISH.test(n)) continue;  /* a date, not an amount */
    out.add(n);
  }
  return [...out];
}

/** JSDoc, not TypeScript — these files stay plain JavaScript so the Deno
   function and the Node suites run the same bytes. The annotations exist so
   `npm run typecheck` can see the shape of what crosses into analyze/index.ts;
   they are comments, erased at runtime, and change nothing about how this
   executes. Without them the empty `cites: []` below infers as never[], and
   the caller's `.map()` over it becomes an unchecked any.

   @typedef {{ id: string, article: string | null, claim: string, claim_ar: string }} Row
   @typedef {{ tier: "verified"|"unverified"|"refused", answer: string, cites: Row[], reason?: string }} Graded */

/**
 * @param {any} proposed the model's completion, untrusted
 * @param {(id: string) => Row | undefined} lookup resolves a citation id to a register row
 * @returns {Graded}
 */
export function gradeAnswer(proposed, lookup){
  const answer = String(proposed?.answer ?? "").slice(0, 1500).trim();
  if (!answer) return { tier: "refused", answer: "", cites: [], reason: "empty" };

  const asked = Array.isArray(proposed?.cites) ? proposed.cites : [];
  const cites = asked
    .map(id => (typeof id === "string" ? lookup(id) : undefined))
    .filter(Boolean)
    .filter((r, i, a) => a.indexOf(r) === i)
    .slice(0, 6);

  if (proposed?.tier === "refused") return { tier: "refused", answer, cites: [], reason: "model" };

  /* A claim of "verified" with nothing real behind it is an unverified answer
     wearing the wrong label. Demote rather than trust. */
  const tier = proposed?.tier === "verified" && cites.length ? "verified" : "unverified";

  /* Money is allowed only where the exact figure appears in a row this answer
     cited. That keeps "the model may never state an amount" true without also
     making it impossible to quote the SAR 45,000 GOSI cap that a verified row
     genuinely contains. */
  /* Compared as numbers, not as substrings: "45000" must match the row's own
     45,000 and must NOT be satisfied by a row that happens to contain 145000
     somewhere. Thousands separators are stripped on both sides so the same
     figure written two ways is still the same figure. */
  /* Both languages of the row count. The register carries every claim in
     English and Arabic, and the figures are identical by construction — but an
     Arabic answer quotes the Arabic row, so a check that only reads the
     English one would refuse a figure the reader is entitled to see. */
  /* BUILT FROM THE FIGURES A ROW ASSERTS, NOT EVERY DIGIT IN ITS PROSE.
     This used to take every number anywhere in the cited rows' claim text, so
     citing art-75 ("employer 60 days, employee 30 days") licensed the answer to
     state "SAR 60" as a sourced amount, and art-109 licensed 21 and 30. 18 of
     the 29 corpus rows carry digits, so a handful of citations turned most
     small integers into permitted money.

     moneyIn() is the same reader used on the answer, pointed at the row: a
     figure is allowed only where the row states it AS money. Both language
     sides count, because an Arabic answer quotes the Arabic claim and a check
     that read only the English would refuse a figure the reader is entitled to.

     Deliberately conservative. A row that stated an amount with no currency
     word would no longer license it, and the answer would be refused — the
     safe direction, and not a case the corpus actually contains: its only two
     real amounts, 45,000 and 9,000, are currency-marked in both languages. */
  const allowedNums = new Set(
    cites.flatMap(r => moneyIn(`${r.claim} ${r.claim_ar || ""}`)),
  );
  const money = moneyIn(answer).filter(n => !allowedNums.has(n));
  if (money.length) return { tier: "refused", answer: "", cites: [], reason: "money" };

  /* Article numbers are allowed only from the rows this answer cited — which
     means never in the unverified tier, because it has no rows. */
  const allowed = new Set(cites.flatMap(r => (r.article ? articlesIn("article " + r.article) : [])));
  const stray = articlesIn(answer).filter(n => !allowed.has(n));
  if (stray.length) return { tier: "refused", answer: "", cites: [], reason: "citation" };

  return { tier, answer, cites };
}
