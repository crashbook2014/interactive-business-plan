/* Wodouh — the grader for pre-signing contract review.
 *
 * Same bargain as grade.mjs: this is plain JavaScript so the Deno function and
 * the Node test suite run the SAME code. A guarantee proven against a
 * re-implementation is not proven.
 *
 * WHAT THIS MODE IS, AND HOW IT DIFFERS FROM ASK
 *
 * Ask answers a question against a fixed verified corpus and refuses anything
 * outside it. This reads a contract the person has not signed yet and tells
 * them what is in it. The product owner decided the model may cite an article
 * whenever it is confident, rather than only from the register. That decision
 * is implemented here exactly as made — and it is why `verified` exists on
 * every citation. The reader is never told which is which by tone; they are
 * told by a field the server computes.
 *
 * THREE THINGS THE MODEL IS NOT ALLOWED TO DO, ENFORCED HERE RATHER THAN ASKED
 *
 * 1. INVENT MONEY. Every riyal figure in the output must appear in the
 *    document the reader submitted. Extracting "the wage is 10,000" is
 *    reading; producing a figure that is nowhere in the contract is inventing
 *    one, and a reader cannot tell those apart by looking. Narrative findings
 *    that carry an unattested figure are DROPPED whole rather than edited —
 *    stripping the number out of a sentence leaves a sentence that reads as
 *    though it never made a claim, which is the worse lie.
 *
 * 2. DECLARE ILLEGALITY. "This violates Article 74" is a legal conclusion
 *    about a named employer, published by software. The prompt forbids it; a
 *    prompt is a request, so this is the guarantee. Prohibited wording is
 *    rewritten to the hedge the rest of the app uses, and `hedged` is set so
 *    the fact that it happened is visible rather than silent.
 *
 * 3. PASS OFF ITS OWN CITATION AS VERIFIED. Every law_reference is checked
 *    against the register. In it → verified. Not in it → the reader sees the
 *    citation AND sees that nobody checked it.
 */
import { articlesIn, moneyIn, normNum } from "./grade.mjs";

const STR = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/* Rewrites, not deletions, because a finding is worth keeping and only its
   framing is wrong. Each replacement is chosen to leave the sentence
   grammatical in its own language — an Arabic substitution that produced
   broken Arabic would be a worse outcome than the claim it removed.

   JS \b is a boundary between a word character and a non-word one, and Arabic
   letters are NOT word characters outside Unicode mode — so /يخالف\b/ never
   matches "يخالف النظام", and the Arabic hedges silently did nothing while the
   English ones worked. Arabic patterns use an explicit "not followed by
   another Arabic letter" lookahead instead. Arabic is the primary language
   here; a guarantee that holds only in English is not a guarantee. */
const AR_END = "(?![\u0621-\u064A\u0660-\u0669])";

const HEDGES = [
  /* Verbs become verbs and adjectives become adjectives, so the sentence
     survives the substitution. An earlier version mapped "is illegal" to "may
     need review", which turned "this clause is illegal and void" into "this
     clause may need review and void" — the banned word walked straight
     through the gap the first replacement opened. */
  [/\bin violation of\b/gi, "appears inconsistent with"],
  [/\bviolation of\b/gi, "inconsistency with"],
  [/\bviolat(?:es|ed|ing)\b/gi, "appears inconsistent with"],
  [/\bbreaches the law\b/gi, "appears inconsistent with the law"],
  [/\bnull and void\b/gi, "questionable"],
  [/\b(?:illegal|unlawful|void|unenforceable)\b/gi, "questionable"],
  [/\b(?:illegally|unlawfully)\b/gi, "questionably"],
  [new RegExp("مخالف(?:ة|ًا)?\\s+(?:صريحة\\s+)?(?:للنظام|للقانون|لنظام العمل)", "g"),
   "قد لا يتوافق مع النظام"],
  [new RegExp("يخالف" + AR_END, "g"), "قد لا يتوافق مع"],
  [new RegExp("تخالف" + AR_END, "g"), "قد لا تتوافق مع"],
  [new RegExp("مخالف(?:ة|ًا)?" + AR_END, "g"), "محل نظر"],
  [new RegExp("غير\\s+(?:قانوني|نظامي)(?:ة|ًا)?" + AR_END, "g"), "محل نظر"],
  [new RegExp("(?:باطل|لاغٍ|لاغي)(?:ة|ًا)?" + AR_END, "g"), "محل نظر"],
];

/* The safety net. Rewriting is best-effort — a sentence can combine these
   words in ways no substitution table anticipates. So after rewriting we look
   again, and a finding with a banned word still in it is DROPPED rather than
   published half-cleaned. This is the guarantee; the table above is only the
   attempt to keep a useful finding. */
const BANNED = [
  /\bviolat/i, /\billegal/i, /\bunlawful/i, /\bvoid\b/i, /\bunenforceable\b/i,
  new RegExp("يخالف" + AR_END), new RegExp("تخالف" + AR_END),
  new RegExp("مخالف(?:ة|ًا)?" + AR_END),
  new RegExp("(?:باطل|لاغٍ|لاغي)" + AR_END),
  new RegExp("غير\\s+(?:قانوني|نظامي)"),
];

/* "questionable and questionable" is what two adjectives in one sentence
   collapse to. Grammatical, but it reads like a machine — so fold the
   repetition rather than leaving the seam showing. */
function tidy(s) {
  return s
    .replace(/\b(questionable|محل نظر)\s*(?:and|و)\s*\1\b/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/* Replace unconditionally and compare, rather than test-then-replace: a /g
   regex carries lastIndex across calls, and test() advancing it is a classic
   way for the second of two identical strings to escape the filter. */
export function hedge(text) {
  const before = String(text ?? "");
  let out = before;
  for (const [re, to] of HEDGES) out = out.replace(re, to);
  out = tidy(out);
  return { text: out, changed: out !== before, residue: BANNED.some((re) => re.test(out)) };
}

/* Every number the document itself contains, digits only and comma-stripped,
   so "10,000" in the contract attests "10000" in the output. Arabic-Indic
   digits normalise first — a rule that only holds in English is not a rule in
   this app. */
export function figuresIn(source) {
  const set = new Set();
  for (const m of normNum(String(source ?? "")).matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    set.add(m[0].replace(/,/g, ""));
  }
  return set;
}

/* Does every riyal figure in `text` appear in the source document? */
function moneyAttested(text, figures) {
  return moneyIn(text).every((n) => figures.has(n));
}

/* Which article numbers the register has verified. */
function verifiedArticles(rows) {
  return new Set((rows ?? []).map((r) => r && r.article).filter(Boolean).map(String));
}

/* A citation the model produced, plus whether a human ever checked it.
   `verified` is false for a reference carrying no article number at all: the
   claim may be perfectly true, but "verified" in this app means "we found this
   article in the official text", and nothing else may borrow the word. */
function gradeRef(ref, ok) {
  const text = STR(ref, 120);
  if (!text) return null;
  const nums = articlesIn(text);
  return {
    ref: text,
    article: nums[0] ?? null,
    verified: nums.length > 0 && nums.every((n) => ok.has(n)),
  };
}

function gradeFinding(f, ok, figures, severity) {
  if (!f || typeof f !== "object") return null;
  const title_ar = hedge(STR(f.title_ar, 120));
  const title_en = hedge(STR(f.title_en, 120));
  const detail_ar = hedge(STR(f.detail_ar, 800));
  const detail_en = hedge(STR(f.detail_en, 800));
  if (!title_ar.text || !title_en.text || !detail_ar.text || !detail_en.text) return null;

  /* Dropped whole, not edited. See rule 1 in the header. */
  const all = [title_ar.text, title_en.text, detail_ar.text, detail_en.text].join(" ");
  if (!moneyAttested(all, figures)) return { dropped: "money" };
  /* Rewriting failed to clean it. Publishing a half-hedged legal conclusion is
     worse than publishing nothing, so this one does not go out. */
  if ([title_ar, title_en, detail_ar, detail_en].some((x) => x.residue)) {
    return { dropped: "language" };
  }

  return {
    title_ar: title_ar.text, title_en: title_en.text,
    detail_ar: detail_ar.text, detail_en: detail_en.text,
    law_reference: gradeRef(f.law_reference, ok),
    severity,
    hedged: title_ar.changed || title_en.changed || detail_ar.changed || detail_en.changed,
  };
}

/* The key terms table. Every value is a short string lifted from the document,
   and any that reads as money must be attested — a misread wage is the single
   figure most likely to be believed and acted on. These NEVER reach the
   calculator: Wodouh computes money on the device, from what the reader typed,
   and that has not changed. */
const TERM_KEYS = [
  "job_title", "monthly_wage", "contract_type", "probation_days",
  "notice_days", "annual_leave_days", "non_compete_months",
];

function gradeTerms(t, figures) {
  const out = {};
  const dropped = [];
  for (const k of TERM_KEYS) {
    const v = STR(t && t[k], 120);
    if (!v) { out[k] = null; continue; }
    if (!moneyAttested(v, figures)) { out[k] = null; dropped.push(k); continue; }
    out[k] = v;
  }
  return { terms: out, dropped };
}

export const DISCLAIMER_AR =
  "هذا التحليل لأغراض معلوماتية فقط ولا يغني عن استشارة محامٍ مختص.";
export const DISCLAIMER_EN =
  "This analysis is for informational purposes only and does not substitute for advice from a licensed attorney.";

/* The whole response, graded. `source` is the document text the reader
   submitted, and it is used only to attest figures — it is never stored and
   never returned. */
export function gradeContractReview(parsed, { source = "", rows = [] } = {}) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const ok = verifiedArticles(rows);
  const figures = figuresIn(source);

  const conf = ["high", "medium", "low"].includes(p.extraction_confidence)
    ? p.extraction_confidence : "low";

  /* Rule 5 of the brief, made structural: a document we could not read yields
     no terms and no findings, whatever the model filled in. Fabricated terms
     under a "low confidence" label are still fabricated terms. */
  if (conf === "low") {
    return {
      extraction_confidence: "low",
      extraction_notes_ar: hedge(STR(p.extraction_notes_ar, 400)).text,
      extraction_notes_en: hedge(STR(p.extraction_notes_en, 400)).text,
      key_terms: Object.fromEntries(TERM_KEYS.map((k) => [k, null])),
      red_flags: [],
      worth_negotiating: [],
      dropped: { findings: 0, terms: [] },
      hedged: false,
      disclaimer_ar: DISCLAIMER_AR,
      disclaimer_en: DISCLAIMER_EN,
    };
  }

  const { terms, dropped: droppedTerms } = gradeTerms(p.key_terms, figures);

  const grade = (list, severity) =>
    (Array.isArray(list) ? list.slice(0, 8) : [])
      .map((f) => gradeFinding(f, ok, figures, severity))
      .filter(Boolean);

  const reds = grade(p.red_flags, "high");
  const negs = grade(p.worth_negotiating, "medium");
  const kept = (l) => l.filter((f) => !f.dropped);
  const red_flags = kept(reds), worth_negotiating = kept(negs);

  return {
    extraction_confidence: conf,
    extraction_notes_ar: hedge(STR(p.extraction_notes_ar, 400)).text,
    extraction_notes_en: hedge(STR(p.extraction_notes_en, 400)).text,
    key_terms: terms,
    red_flags,
    worth_negotiating,
    /* Reported rather than hidden. A build that silently drops half the
       findings looks identical to a contract with nothing wrong in it. */
    dropped: {
      findings: (reds.length - red_flags.length) + (negs.length - worth_negotiating.length),
      terms: droppedTerms,
    },
    hedged: [...red_flags, ...worth_negotiating].some((f) => f.hedged),
    /* Returned from here, verbatim, rather than trusted from the completion.
       A disclaimer the model could reword is not a disclaimer. */
    disclaimer_ar: DISCLAIMER_AR,
    disclaimer_en: DISCLAIMER_EN,
  };
}
