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
import { articlesIn, amountTokens, moneyIn, normNum } from "./grade.mjs";

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

  /* PROMISES OF AN OUTCOME, which nothing enforced.
   *
   * CR_SYSTEM rule 7 asks the model never to predict a result, and asking was
   * the whole of it: "You are guaranteed to win this case at the labour court"
   * and "You will certainly receive the full award" both survived grading
   * intact and rendered to the reader verbatim. Rule 4 — never say illegal or
   * void — was enforced here and held; rule 7 had a prompt and no filter, and
   * a prompt is a request while a filter is a guarantee.
   *
   * The whole product is built on never stating a legal outcome. Every screen
   * in the termination flow is written to avoid it, the score says out loud
   * that it comes from Wodouh's methodology and not from a statute, and the
   * assessment prints "what we could not judge". This is the ONE path where
   * text influenced by a third party reaches the reader, and it was the one
   * with no guard on the sentence the product most needs never to say.
   *
   * DROPPED, NOT REWRITTEN, and that is why these are here rather than in
   * HEDGES: a promise has no honest hedged form. "You will probably win" is
   * the same claim with a smaller number attached to it.
   *
   * "certainly", not "certain" — "certain clauses" is ordinary English and
   * dropping a finding for it would cost far more than it buys. */
  /\bguarantee(?:d|s|ing)?\b/i, /\bwill (?:definitely|certainly|surely)\b/i,
  /\b(?:will|are going to) win\b/i, /\bcertainly\b/i, /\bdefinitely\b/i,
  /\bassured of\b/i, /\bno doubt that\b/i,
  new RegExp("مضمون(?:ة|ًا)?" + AR_END),
  new RegExp("بالتأكيد" + AR_END),
  new RegExp("(?:ستكسب|ستربح|ستفوز)" + AR_END),
  new RegExp("حتم(?:ًا|اً|ا)" + AR_END),
  new RegExp("قطع(?:ًا|اً|ا)" + AR_END),

  /* THE FIRST VERSION OF THIS LIST CAUGHT THE THREE PHRASINGS I HAPPENED TO
   * THINK OF AND NOTHING ADJACENT. Re-tested against the red team's full set,
   * 15 of 15 still reached the reader — so the patterns below are written as
   * CONSTRUCTIONS rather than as literals, because the failure mode is a
   * synonym and there are always more synonyms than there are literals.
   *
   * TWO FAMILIES.
   *
   * A court deciding for the reader. "You will win" was banned; "the labour
   * court will rule in your favour", "you will prevail", "your case is a slam
   * dunk" were not. Same promise, different verb.
   *
   * Illegality by synonym, which is the worse half. HEDGES rewrites the WORDS
   * illegal / void / violates, so rule 4 was defeated by anything that means
   * the same without using them: "contravenes Article 74", "has no legal
   * effect", "cannot be enforced against you", «لا يجوز نظامًا». Each carries
   * the identical legal conclusion the rewrite exists to prevent, and each
   * rendered to the reader verbatim.
   *
   * Arabic is not an afterthought here. Arabic states impermissibility through
   * modal negation — لا يجوز, لا أثر له, لا يُعتد به — and the earlier list
   * had no coverage of that shape at all, which is a rule the team applies to
   * every other surface in this app.
   *
   * SCOPED, so the cost of the filter stays honest. "breach" and "contrary"
   * are ordinary contract words and are banned only next to a law reference;
   * "cannot be enforced" and "no legal effect" are conclusions whatever
   * follows them. */
  /\bcontraven(?:e|es|ed|ing)\b/i,
  /\bbreach(?:es|ed)?\s+(?:article|the\s+law|(?:the\s+)?labou?r\s+law)/i,
  /\bcontrary\s+to\s+(?:article|the\s+law|(?:the\s+)?labou?r\s+law|the\s+regulations?)/i,
  /\b(?:prohibited|forbidden|barred|not\s+(?:permitted|allowed|permissible)|impermissible)\s+(?:by|under)\s+(?:article|the\s+law|(?:the\s+)?labou?r\s+law|saudi\s+law|the\s+regulations?)/i,
  /\bno\s+legal\s+(?:effect|force|standing)\b/i,
  /\b(?:cannot|can't|could\s+not)\s+be\s+enforced\b/i,
  /\bwould\s+not\s+(?:uphold|enforce)\b/i,
  /\b(?:court|judge|tribunal)[^.!?]{0,60}\b(?:will|would|shall)\b[^.!?]{0,40}\b(?:rule|find|decide|hold|side|award|grant|order|compensate)\b/i,
  /\b(?:will|would|shall)\s+(?:rule|find|decide)\s+in\s+your\s+favou?r\b/i,
  /\b(?:will|would|are\s+going\s+to|sure\s+to)\s+(?:win|prevail|succeed)\b/i,
  /\bslam\s+dunk\b/i,
  /\bno\s+question\s+that\b/i,
  new RegExp("لا\\s+يجوز" + AR_END),
  new RegExp("لا\\s+أثر\\s+له" + AR_END),
  new RegExp("لا\\s+(?:يُعتد|يعتد)\\s+به" + AR_END),
  new RegExp("غير\\s+نافذ(?:ة|ًا)?" + AR_END),
  /* لا AND لن both negate, and only لا was covered — «لن تستطيع الشركة تنفيذ
     هذا البند» is the same conclusion in the future tense. */
  new RegExp("(?:لا|لن)\\s+(?:يمكن|تستطيع|يستطيع|يمكنها|تقدر|يقدر)\\s*(?:\\S+\\s+){0,2}?تنفيذ"),
  /* A promise of what a court will HAND OVER, which names no verdict and
     predicts one anyway: «ستحصل على كامل مستحقاتك من المحكمة». Scoped to the
     forum so an ordinary "you will get a copy" is untouched. */
  new RegExp("(?:ستحصل|ستنال|ستسترد|ستأخذ|ستقبض)[^.!؟]{0,50}(?:المحكمة|القضاء|الجهة\\s+المختصة)"),
  new RegExp("(?:المحكمة|القاضي)(?:\\s+\\S+){0,6}?\\s*(?:ستحكم|سيحكم|تحكم|يحكم)"),
  new RegExp("لصالحك" + AR_END),
  new RegExp("من\\s+المؤكد" + AR_END),
  new RegExp("بلا\\s+شك" + AR_END),
  new RegExp("رابح(?:ة|ًا)?" + AR_END),
  new RegExp("ستستعيد" + AR_END),

  /* SECOND SWEEP. Ten phrasings walked straight through the list above, which
   * is the same lesson a third time: the gap is never the words already named,
   * it is the next synonym. So these are widenings of the constructions that
   * were already here rather than ten more literals.
   *
   * A COURT HANDING SOMETHING OVER. The court family was scoped to verbs of
   * DECIDING — rule, find, decide, hold, side — so "the labour court will
   * award you your full entitlement" named no verdict and predicted one
   * anyway. Deciding and giving are the same promise; the verb set now covers
   * both. Same hole in the reader-side verb: "you will win" was banned and
   * "you will recover all your dues through the labour court" was not, so
   * recovery verbs join it, scoped to a forum or an outcome noun so that "you
   * will recover your passport at the end of the contract" is untouched.
   *
   * ILLEGALITY BY SYNONYM, again. "prohibited by the Labor Law" was banned
   * and "not permitted under the Labor Law" was not — one construction, two
   * spellings of the same modal, so the prohibition family is now a set.
   * "void / unenforceable / illegal" were banned and "invalid" and "legally
   * ineffective" were not. And "cannot be enforced" was banned while "has no
   * right to enforce" — the same conclusion from the other party's side — was
   * not; the ban is on ENFORCEABILITY being decided, so it is scoped to the
   * enforcement verbs and leaves "the clause says you have no right to annual
   * leave" alone, which is a finding rather than a conclusion.
   *
   * ARABIC. «ستنصفك» is the same shape as «ستحكم لصالحك» with the favour
   * folded into the verb. «غير صحيح» is scoped to a law word because it is
   * also the ordinary way to say a FIGURE is wrong, which is a real finding
   * this filter must not eat; «لا قيمة له» is a conclusion whatever follows
   * it, exactly as «لا أثر له» already was.
   *
   * IDIOM. "slam dunk" was caught and "open and shut" was not. An idiom set
   * is a literal set by nature — there is no construction under it — so this
   * is the one place below where naming them one by one is the honest tool. */
  /\b(?:will|would|are\s+going\s+to|sure\s+to)\s+(?:recover|recoup|reclaim|be\s+awarded)\b[^.!?]{0,60}\b(?:court|tribunal|dues|entitlements?|award|compensation|rights?)\b/i,
  /\b(?:is|are|was|were|would\s+be|shall\s+be)\s+(?:legally\s+)?(?:invalid|inoperative|ineffective)\b/i,
  /\b(?:invalid|inoperative|impermissible|ineffective)\s+(?:under|at)\s+(?:saudi\s+)?(?:law|the\s+law|(?:the\s+)?labou?r\s+law|article)/i,
  /\blegally\s+(?:ineffective|invalid|meaningless|worthless)\b/i,
  /\bno\s+(?:right|power|authority|standing)\s+to\s+(?:enforce|rely\s+on|invoke|impose|uphold|apply)\b/i,
  /\bopen[\s-]and[\s-]shut\b/i, /\bcut[\s-]and[\s-]dried\b/i,
  /\bno[\s-]brainer\b/i, /\bairtight\s+case\b/i, /\b(?:cannot|can't)\s+lose\b/i,
  new RegExp("(?:ستنصف|سينصف|تنصف|ينصف)(?:ك|كم|كما)" + AR_END),
  new RegExp("غير\\s+صحيح(?:ة|ًا|اً)?[^.!؟]{0,20}?(?:نظام|قانون|المادة|الشرع)"),
  new RegExp("لا\\s+قيمة\\s+له" + AR_END),
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
  /* The document is read the same way the finding is. Without this a contract
     saying "1.2 million SAR" would refuse a finding quoting it back, because
     the finding resolves to 1200000 and the raw scan above only ever saw
     "1.2". Attestation has to compare like with like or it fails honest
     findings while still passing invented ones. */
  for (const a of amountTokens(source)) set.add(a);
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
const OBL_FIELDS = [["clause_ar", 300], ["clause_en", 300], ["duty_ar", 600], ["duty_en", 600]];

/* A model-supplied enum is still model-supplied data. It reaches the client and
   decides which clause sits at the top of a screen for someone in a dispute, so
   it is checked against the list rather than trusted to be on it. Anything else
   — including a plausible-looking word that is not in the vocabulary — becomes
   "other", which the client reads as no topic at all. */
const TOPICS = new Set([
  "deposit", "increase", "eviction", "maintenance", "registration",
  "payment", "delivery", "scope", "ip", "revisions",
  "notice", "noncompete", "overtime", "pay", "leave", "probation", "other",
]);
/* A loan's clauses are about things no employment topic names, and the two sets
   are kept apart rather than merged: a merged set would accept "probation" on a
   loan and "collateral" on an employment contract, and the topic's only job is
   to put the right clause at the top of a screen. Validated per domain, so a
   topic from the wrong list falls to "other" exactly as an unknown one does. */
const TOPICS_LOAN = new Set([
  "principal", "rate", "installment", "fees", "prepayment",
  "default", "collateral", "guarantee", "insurance", "assignment",
  "disclosure", "term", "other",
]);
const topicsFor = (domain) => (domain === "loan" ? TOPICS_LOAN : TOPICS);
const gradeTopic = (v, domain) =>
  (typeof v === "string" && topicsFor(domain).has(v) ? v : "other");

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

/* THE SAME DISCIPLINE, POINTED AT A LOAN. Three of these are riyal figures a
   borrower would act on — what they are borrowing, what they pay each month,
   and what it costs in total — so they are attested against the document
   exactly as the salary is. The rate is not a riyal figure and `moneyAttested`
   would never look at it, but a misread rate is the single most consequential
   error possible here: 6.5 against a contract that says 16.5 is the difference
   between a deal someone signs and one they walk away from. So it is attested
   too, by its own literal form, against the same figure set. */
const LOAN_NUM = [
  ["principal_amount", 1e9],
  ["monthly_installment", 1e9],
  ["total_cost", 1e9],
  ["profit_rate_percent", 100],
  ["term_months", 600],
];
const LOAN_STR = [
  ["financing_type_ar", 120], ["financing_type_en", 120],
  ["currency", 12],
  ["early_settlement_ar", 300], ["early_settlement_en", 300],
];

/* Attested like the salary: as a whole number, so 1,500 in the contract cannot
   attest 11,500 in the output. */
const ATTEST_WHOLE = new Set(["salary_amount", "principal_amount",
                              "monthly_installment", "total_cost"]);

const TERM_SPECS = {
  job:  { num: TERM_NUM,  str: TERM_STR },
  loan: { num: LOAN_NUM,  str: LOAN_STR },
};
const specFor = (domain) => TERM_SPECS[domain] || TERM_SPECS.job;

function gradeTerms(t, figures, domain) {
  const out = {};
  const dropped = [];
  const src = t && typeof t === "object" ? t : {};
  const { num, str } = specFor(domain);

  for (const [k, max] of num) {
    const n = Number(src[k]);
    /* Bounds are not decoration. 168 is the number of hours in a week: a
       "working_hours_per_week" of 400 is a misread, and rendering it would
       make the whole table untrustworthy. */
    if (!Number.isFinite(n) || n < 0 || n > max) { out[k] = null; if (src[k] != null) dropped.push(k); continue; }
    /* A salary the document does not contain is invented, whatever confidence
       it arrived with. Checked as a whole number, so 1,500 in the contract
       cannot attest 11,500 in the output. */
    if (ATTEST_WHOLE.has(k) && !figures.has(String(Math.round(n)))) { out[k] = null; dropped.push(k); continue; }
    /* A rate carries its decimal, so it is checked in the form it was written
       — "6.5" — and then as a whole number, because a contract writing "6" and
       a model returning 6.0 are the same rate. */
    if (k === "profit_rate_percent"
        && !figures.has(String(n)) && !figures.has(String(Math.round(n)))) {
      out[k] = null; dropped.push(k); continue;
    }
    out[k] = n;
  }

  for (const [k, max] of str) {
    const v = STR(src[k], max);
    if (!v) { out[k] = null; continue; }
    if (!moneyAttested(v, figures)) { out[k] = null; dropped.push(k); continue; }
    out[k] = v;
  }
  return { terms: out, dropped };
}

const NULL_TERMS = (domain) => {
  const { num, str } = specFor(domain);
  return Object.fromEntries(num.concat(str).map(([k]) => [k, null]));
};

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
 * @param {{ source?: string, rows?: { id: string, article: string | null, claim: string, claim_ar: string }[], track?: string, sourceKnown?: boolean, domain?: string }} [opts]
 */
export function gradeContractReview(parsed, { source = "", rows = [], track = "Saudi", sourceKnown = true, domain = "job" } = {}) {
  /* Anything that is not a domain with its own term spec reads as employment,
     the same way an unrecognised track reads as Saudi: a malformed or hostile
     field cannot invent a third shape for the key-terms table. */
  const dom = TERM_SPECS[domain] ? domain : "job";
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
    /* Which key-terms shape this response carries. The client reads it to pick
       the labels for the table — an employment review and a loan review return
       different keys, and a renderer guessing from which keys happen to be
       non-null would show an empty table for a contract whose terms were all
       legitimately dropped. */
    domain: dom,
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
      key_terms: NULL_TERMS(dom),
      red_flags: [], negotiation_points: [], obligations: [],
      summary_ar: "", summary_en: "",
      dropped: { findings: 0, terms: [] },
      hedged: false,
      risk_band: null,
    });
  }

  const { terms, dropped: droppedTerms } = gradeTerms(p.key_terms, figures, dom);

  const gradeList = (list, fields, extra) =>
    (Array.isArray(list) ? list.slice(0, 8) : [])
      .map((f) => gradeFinding(f, ok, figures, fields, extra))
      .filter(Boolean);

  const reds = gradeList(p.red_flags, RED_FIELDS, (f) => ({
    /* A loan review cites nothing at all — there is no verified financing
       register to check a reference against, so the only honest value is
       none. The prompt forbids naming a regulation; this is the half that
       does not depend on the model having obeyed. */
    law_reference: dom === "loan" ? null : gradeRef(f.law_reference, ok),
    severity: f.severity === "medium" ? "medium" : "high",
    topic: gradeTopic(f.topic, dom),
  }));
  const negs = gradeList(p.negotiation_points, NEG_FIELDS,
    (f) => ({ severity: "medium", topic: gradeTopic(f.topic, dom) }));
  /* Obligations go through the SAME grader as everything else: the hedge
     filter, the length caps and the money check all apply. "You must pay
     50,000 on exit" is exactly the kind of unattested figure this exists to
     catch, and an obligation is the last place it should get through. */
  const obls = gradeList(p.obligations, OBL_FIELDS, (f) => ({ topic: gradeTopic(f.topic, dom) }));

  const kept = (l) => l.filter((x) => !x.dropped);
  const red_flags = kept(reds), negotiation_points = kept(negs), obligations = kept(obls);

  /* SCAN-ONLY RISK BAND. A photograph gives Wodouh's own rules no text to
     compute a score from (see the note on CR_SCHEMA in analyze/index.ts). That
     does not mean there is no signal: the model already returned red_flags and
     negotiation_points for a different purpose, and their count and severity —
     AFTER the money-stripping and hedge filtering above have already run — is
     real data already in this response, not a second guess the model makes
     about its own output. Weighted, not a raw count: a bilingual-conflict red
     flag (forced to "high" by prompt rule 8) says more than three lawful-but-
     suboptimal negotiation points. null when sourceKnown, on purpose — that
     screen already carries the real, reproducible device score, and this must
     never sit beside it. */
  const riskBand = sourceKnown ? null : (() => {
    const w = red_flags.filter((f) => f.severity === "high").length * 2
            + red_flags.filter((f) => f.severity === "medium").length
            + negotiation_points.length;
    return w === 0 ? "great" : w <= 2 ? "good" : w <= 5 ? "fair" : "poor";
  })();

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
    obligations,
    summary_ar: sum("summary_ar"),
    summary_en: sum("summary_en"),
    /* Reported rather than hidden. A build that silently drops half the
       findings looks identical to a contract with nothing wrong in it. */
    dropped: {
      findings: (reds.length - red_flags.length) + (negs.length - negotiation_points.length)
              + (obls.length - obligations.length),
      terms: droppedTerms,
    },
    hedged: [...red_flags, ...negotiation_points, ...obligations].some((f) => f.hedged),
    risk_band: riskBand,
  });
}
