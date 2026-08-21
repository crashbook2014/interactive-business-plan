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

/* One finding, in either list. `fields` names which text keys this shape
   carries, so red flags (clause + issue) and negotiation points (clause +
   suggestion) go through the SAME money, hedge and length guards rather than
   through two near-copies that drift apart. */
function gradeFinding(f, ok, figures, fields, extra) {
  if (!f || typeof f !== "object") return null;

  const out = {};
  const parts = [];
  for (const [k, max] of fields) {
    const h = hedge(STR(f[k], max));
    if (!h.text) return null;              /* a half-filled finding is not a finding */
    if (h.residue) return { dropped: "language" };
    out[k] = h.text;
    parts.push(h.text);
  }

  /* Dropped whole, not edited. See rule 1 in the header. */
  if (!moneyAttested(parts.join(" "), figures)) return { dropped: "money" };

  out.hedged = fields.some(([k]) => hedge(STR(f[k], 2000)).changed);
  return Object.assign(out, extra(f));
}

/* clause_ar / clause_en quote the reader's own contract back to them, which is
   how they find the clause in their document. It is also the one place in this
   response that carries contract TEXT rather than a description of it — so it
   is length-capped hard, and the app must never persist it. 0001_init.sql
   still stores no contract text and this does not change that. */
const RED_FIELDS = [["clause_ar", 300], ["clause_en", 300], ["issue_ar", 600], ["issue_en", 600]];
const NEG_FIELDS = [["clause_ar", 300], ["clause_en", 300], ["suggestion_ar", 600], ["suggestion_en", 600]];

/* The key terms table, now typed: the brief asks for numbers where the value is
   a number, because "180" and "180 days" and "one hundred eighty" are the same
   fact and only one of them can be compared, sorted, or checked against the
   law. Strings stay strings.

   THE SALARY IS THE DANGEROUS ONE. It is the single figure most likely to be
   believed and acted on, so it must appear in the document — a misread wage
   that looks authoritative is worse than no wage at all. And none of these ever
   reach the calculator: Wodouh computes money on the device, from what the
   reader typed, and that has not changed. */
const TERM_NUM = [
  ["salary_amount", 1e9],
  ["probation_period_days", 3650],
  ["notice_period_days", 3650],
  ["working_hours_per_week", 168],
];
const TERM_STR = [
  ["position_ar", 120], ["position_en", 120],
  ["salary_currency", 12], ["contract_duration", 60],
];

function gradeTerms(t, figures) {
  const out = {};
  const dropped = [];
  const src = t && typeof t === "object" ? t : {};

  for (const [k, max] of TERM_NUM) {
    const n = Number(src[k]);
    /* Bounds are not decoration. 168 is the number of hours in a week: a
       "working_hours_per_week" of 400 is a misread, and rendering it would
       make the whole table untrustworthy. */
    if (!Number.isFinite(n) || n < 0 || n > max) { out[k] = null; if (src[k] != null) dropped.push(k); continue; }
    /* A salary the document does not contain is invented, whatever confidence
       it arrived with. Checked as a whole number, so 1,500 in the contract
       cannot attest 11,500 in the output. */
    if (k === "salary_amount" && !figures.has(String(Math.round(n)))) { out[k] = null; dropped.push(k); continue; }
    out[k] = n;
  }

  for (const [k, max] of TERM_STR) {
    const v = STR(src[k], max);
    if (!v) { out[k] = null; continue; }
    if (!moneyAttested(v, figures)) { out[k] = null; dropped.push(k); continue; }
    out[k] = v;
  }
  return { terms: out, dropped };
}

const TERM_KEYS = TERM_NUM.concat(TERM_STR).map(([k]) => k);
const NULL_TERMS = () => Object.fromEntries(TERM_KEYS.map((k) => [k, null]));

export const DISCLAIMER_AR =
  "هذا التحليل لأغراض معلوماتية فقط ولا يغني عن استشارة محامٍ مختص.";
export const DISCLAIMER_EN =
  "This analysis is for informational purposes only and does not substitute for advice from a licensed attorney.";

/* The whole response, graded. `source` is the document text the reader
   submitted, used only to attest figures — never stored, never returned.
   `track` is "Saudi" or "Resident", carried through so the app can show which
   reading it got. THERE IS NO SCORE HERE, deliberately: the device computes it.
   See the note on CR_SCHEMA in analyze/index.ts. */
/**
 * @param {any} parsed the model's completion, untrusted
 * @param {{ source?: string, rows?: { id: string, article: string | null, claim: string, claim_ar: string }[], track?: string, sourceKnown?: boolean }} [opts]
 */
export function gradeContractReview(parsed, { source = "", rows = [], track = "Saudi", sourceKnown = true } = {}) {
  const p = parsed && typeof parsed === "object" ? parsed : {};
  const meta = p.contract_meta && typeof p.contract_meta === "object" ? p.contract_meta : {};
  const ok = verifiedArticles(rows);
  /* A SCAN HAS NO TEXT TO CHECK AGAINST. When the document reached the model
     as an image, there is no extracted text on this side, so no figure can be
     attested — and an empty figure set means every figure is refused rather
     than every figure allowed. A scanned contract therefore shows findings and
     no numbers, which is the honest version of "we could not verify this",
     and is a far better failure than a confident wrong salary. */
  const figures = sourceKnown ? figuresIn(source) : new Set();

  const conf = ["high", "medium", "low"].includes(meta.extraction_confidence)
    ? meta.extraction_confidence : "low";

  const shell = {
    track: track === "Resident" ? "Resident" : "Saudi",
    contract_meta: {
      contract_type_ar: hedge(STR(meta.contract_type_ar, 120)).text || null,
      contract_type_en: hedge(STR(meta.contract_type_en, 120)).text || null,
      parties_identified: meta.parties_identified === true,
      extraction_confidence: conf,
      extraction_notes_ar: hedge(STR(meta.extraction_notes_ar, 400)).text || null,
      extraction_notes_en: hedge(STR(meta.extraction_notes_en, 400)).text || null,
    },
    disclaimer_ar: DISCLAIMER_AR,
    disclaimer_en: DISCLAIMER_EN,
  };

  /* Rule 6 of the brief, made structural rather than requested: a document we
     could not read yields NO terms and NO findings, whatever the completion
     filled in around the low-confidence flag. Fabricated terms under an honest
     label are still fabricated terms — and this is the exact path the "I like
     cats and coffee" acceptance test walks. */
  if (conf === "low") {
    return Object.assign(shell, {
      key_terms: NULL_TERMS(),
      red_flags: [], negotiation_points: [],
      summary_ar: "", summary_en: "",
      dropped: { findings: 0, terms: [] },
      hedged: false,
    });
  }

  const { terms, dropped: droppedTerms } = gradeTerms(p.key_terms, figures);

  const gradeList = (list, fields, extra) =>
    (Array.isArray(list) ? list.slice(0, 8) : [])
      .map((f) => gradeFinding(f, ok, figures, fields, extra))
      .filter(Boolean);

  const reds = gradeList(p.red_flags, RED_FIELDS, (f) => ({
    law_reference: gradeRef(f.law_reference, ok),
    severity: f.severity === "medium" ? "medium" : "high",
  }));
  const negs = gradeList(p.negotiation_points, NEG_FIELDS, () => ({ severity: "medium" }));

  const kept = (l) => l.filter((x) => !x.dropped);
  const red_flags = kept(reds), negotiation_points = kept(negs);

  const sum = (k) => {
    const h = hedge(STR(p[k], 600));
    /* A summary carrying an invented figure or a flat legal ruling is
       emptied rather than shown — it is the line the reader trusts most. */
    if (h.residue || !moneyAttested(h.text, figures)) return "";
    return h.text;
  };

  return Object.assign(shell, {
    key_terms: terms,
    red_flags,
    negotiation_points,
    summary_ar: sum("summary_ar"),
    summary_en: sum("summary_en"),
    /* Reported rather than hidden. A build that silently drops half the
       findings looks identical to a contract with nothing wrong in it. */
    dropped: {
      findings: (reds.length - red_flags.length) + (negs.length - negotiation_points.length),
      terms: droppedTerms,
    },
    hedged: [...red_flags, ...negotiation_points].some((f) => f.hedged),
  });
}
