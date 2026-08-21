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
   unsourced citation under a brand whose entire claim is sourcing. */
export function articlesIn(text){
  const t = normNum(text);
  const out = new Set();
  for (const m of t.matchAll(/(?:articles?|arts?\.|المادة|المواد)\s*\.?\s*(\d{1,3})/gi)) out.add(m[1]);
  return [...out];
}

/* Any amount of money the text asserts. The unit leads in English and trails
   in Arabic, so both orders are matched. */
export function moneyIn(text){
  const t = normNum(text);
  const out = new Set();
  const strip = n => n.replace(/,/g, "");
  for (const m of t.matchAll(/(?:SAR|SR|ريال|ريالا?ً?|﷼)\s*([\d,]+(?:\.\d+)?)/gi)) out.add(strip(m[1]));
  for (const m of t.matchAll(/([\d,]+(?:\.\d+)?)\s*(?:SAR|SR|ريال|ريالا?ً?|﷼)/gi)) out.add(strip(m[1]));
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
  const allowedNums = new Set(
    cites.flatMap(r => normNum(`${r.claim} ${r.claim_ar || ""}`).replace(/,/g, "").match(/\d+(?:\.\d+)?/g) || []),
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
