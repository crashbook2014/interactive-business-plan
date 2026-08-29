/* Reading a contract before it is signed — and the machinery that decides what
 * the model is allowed to have said.
 *
 * This mode exists because the moment a person still has leverage is BEFORE
 * they sign, and every other mode in this app deals with employment that has
 * already ended. It is also the mode most exposed to a hostile input: the whole
 * payload is a file a third party handed the reader.
 *
 * A DECISION THIS SUITE ENCODES, STATED PLAINLY. Everywhere else in Wodouh, an
 * article number appears only if a human verified it in the register. For this
 * mode the product owner chose the model's own judgement instead: cite when
 * confident, null when not. That choice is implemented as made. What the server
 * adds is a `verified` flag computed against the register, so the reader is
 * told which numbers a human checked rather than left to assume — the app's
 * "we only cite what we verified" copy would otherwise become false.
 *
 * The four properties, in the order they would hurt:
 *
 *   1. Money the document does not contain never reaches the reader. A wage
 *      the contract states may be reported; a figure invented about it may
 *      not, and nobody can tell those apart by looking at the output.
 *   2. Nothing is ever called illegal, void, or a violation — in EITHER
 *      language. The prompt asks; this enforces.
 *   3. A citation nobody verified is labelled, not hidden.
 *   4. "Too garbled to analyse" means NO terms and NO findings, whatever the
 *      completion filled in around it.
 *
 * Unit tests against the exact module the Edge Function imports. A guarantee
 * proven against a re-implementation is not proven.
 */
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* A contract with real figures in it. Everything attested must come from here;
   anything else is the model inventing. */
const DOC = `Employment Contract. Job title: Site Engineer.
Monthly wage: 10,000 SAR. Housing allowance 1,500 SAR.
Probation period: 180 days. Notice period: 30 days.
Annual leave: 21 days. Non-compete: 24 months after termination.`;

const ROWS = [
  { id: "r1", article: "74", claim: "Article 74 lists the grounds on which a contract ends." },
  { id: "r2", article: "84", claim: "End of service award is calculated on the last wage." },
  { id: "r3", article: null, claim: "A named programme, verified but carrying no article number." },
];

const finding = (over) => Object.assign({
  clause_ar: "نص البند", clause_en: "The clause",
  issue_ar: "شرح", issue_en: "Detail",
  law_reference: null, severity: "high",
}, over);

const point = (over) => Object.assign({
  clause_ar: "نص البند", clause_en: "The clause",
  suggestion_ar: "اطلب غيره", suggestion_en: "Ask for something else",
}, over);

const base = (over) => Object.assign({
  contract_meta: {
    contract_type_ar: "عقد عمل غير محدد المدة", contract_type_en: "Unlimited-term contract",
    parties_identified: true, extraction_confidence: "high",
    extraction_notes_ar: null, extraction_notes_en: null,
  },
  key_terms: {
    position_ar: "مهندس موقع", position_en: "Site Engineer",
    salary_amount: 10000, salary_currency: "SAR",
    probation_period_days: 180, contract_duration: "unlimited",
    notice_period_days: 30, working_hours_per_week: 48,
  },
  red_flags: [], negotiation_points: [],
  summary_ar: "ملخص قصير", summary_en: "A short summary",
}, over);

(async () => {
  const { gradeContractReview, hedge, figuresIn } =
    await import("../supabase/functions/_shared/review-contract.mjs");
  const run = (o, opts) => gradeContractReview(base(o), Object.assign({ source: DOC, rows: ROWS }, opts));

  /* ---- 1. money */
  console.log("\n— the model may report a figure the contract states, and no other");
  const clean = run({});
  ok(clean.key_terms.salary_amount === 10000,
     "a salary written in the contract survives — reading it back is the product");
  ok(clean.key_terms.probation_period_days === 180 && clean.key_terms.notice_period_days === 30,
     "and the day counts come through as NUMBERS, so they can be compared rather than parsed from prose");

  const invented = run({ key_terms: Object.assign(base({}).key_terms, { salary_amount: 18000 }) });
  ok(invented.key_terms.salary_amount === null,
     "a salary that appears NOWHERE in the document is dropped, not shown");
  ok(invented.dropped.terms.includes("salary_amount"),
     "and the drop is reported rather than passed off as an empty field");

  /* A number out of physical range is a misread, and one wrong row makes the
     whole table untrustworthy. */
  const impossible = run({ key_terms: Object.assign(base({}).key_terms, { working_hours_per_week: 400 }) });
  ok(impossible.key_terms.working_hours_per_week === null,
     "400 hours in a 168-hour week is a misread and is dropped, not rendered");

  const promised = run({
    red_flags: [finding({ issue_en: "You are owed 45,000 SAR in end-of-service pay.",
                          issue_ar: "تستحق ٤٥٠٠٠ ريال مكافأة نهاية الخدمة." })],
  });
  ok(promised.red_flags.length === 0,
     "a finding that invents an amount is dropped WHOLE — money is computed on the device, never here");
  ok(promised.dropped.findings === 1, "and counted, so a filtered build cannot look like a clean contract");

  ok(!figuresIn(DOC).has("11500") && figuresIn(DOC).has("1500"),
     "attestation matches whole figures — 1,500 in the contract does not license 11,500");

  const arabicDigits = run({ red_flags: [finding({ issue_ar: "الأجر ١٠٬٠٠٠ ريال شهريًا." })] });
  ok(arabicDigits.red_flags.length === 1,
     "and Arabic-Indic digits are digits — the same figure written ١٠٬٠٠٠ is attested too");

  /* THE SCORE. The brief asked the model to return one; it does not, because
     the device computes it. A field that does not exist cannot drift. */
  ok(clean.contract_score === undefined && clean.score === undefined,
     "the response carries NO score — the device computes that, deterministically and offline");

  /* ---- 2. never illegal, in either language */
  console.log("\n— nothing is called illegal, void, or a violation — in either language");
  const blunt = run({
    red_flags: [finding({
      clause_en: "Probation violates the law", issue_en: "This clause is illegal and void.",
      clause_ar: "فترة التجربة مخالفة للنظام", issue_ar: "هذا الشرط باطل ويخالف النظام.",
    })],
  });
  const f = blunt.red_flags[0];
  ok(f && !/violat|illegal|void/i.test(f.clause_en + f.issue_en),
     `the English is hedged ("${f && f.issue_en}")`);
  ok(f && !/مخالف|باطل|يخالف/.test(f.clause_ar + f.issue_ar),
     `and so is the Arabic ("${f && f.issue_ar}")`);
  ok(f && f.hedged === true && blunt.hedged === true,
     "and the fact that it was rewritten is reported, not silent");
  ok(f && /questionable|inconsistent|review/i.test(f.issue_en) && /يتوافق|مراجعة|نظر/.test(f.issue_ar),
     "the replacement still says something rather than emptying the finding");

  const stubborn = run({ red_flags: [finding({ issue_en: "The employer is a repeat violator here." })] });
  ok(stubborn.red_flags.length === 0 && stubborn.dropped.findings === 1,
     "a finding the rewrite table has no entry for is DROPPED, not published half-hedged");

  /* Negotiation points go through the SAME filters, not a near-copy that
     drifts. This is the assertion that catches a second code path. */
  const softIllegal = run({ negotiation_points: [point({ suggestion_en: "The current term is illegal." })] });
  ok(softIllegal.negotiation_points.every(x => !/illegal/i.test(x.suggestion_en)),
     "negotiation points pass through the identical hedge — one filter, two lists");
  const softMoney = run({ negotiation_points: [point({ suggestion_en: "Ask for 25,000 SAR instead." })] });
  ok(softMoney.negotiation_points.length === 0,
     "and the identical money check");

  /* The summary is the line a reader trusts most, so it gets the same guards. */
  /* The summary is HEDGED rather than emptied where the rewrite succeeds —
     losing a whole summary over one word is a worse trade than softening it.
     It is only emptied when the rewrite cannot clean it, same rule as findings. */
  const badSummary = run({ summary_en: "This contract is illegal.", summary_ar: "العقد باطل." });
  ok(!/illegal/i.test(badSummary.summary_en) && !/باطل/.test(badSummary.summary_ar),
     `a summary making a flat legal ruling is hedged, in both languages ("${badSummary.summary_en}")`);
  ok(badSummary.summary_en.length > 0,
     "and survives rather than vanishing — losing the whole summary over one word is the worse trade");
  /* "violator" is caught by the banned list but has no entry in the rewrite
     table, which is exactly the gap the residue check exists to close: the
     table will always be incomplete, so the guarantee cannot depend on it
     being complete. */
  const unfixableSummary = run({ summary_en: "The employer is a repeat violator of labour standards." });
  ok(unfixableSummary.summary_en === "",
     "but one the rewrite table has no entry for is emptied — the residue check, not the table, is the guarantee");
  const moneySummary = run({ summary_en: "You could claim about 60,000 SAR." });
  ok(moneySummary.summary_en === "", "and so is one that invents a figure");

  ok(hedge("يخالف النظام").changed === true, "the Arabic patterns actually fire");
  ok(hedge("مخالفات سابقة").changed === false,
     "and do not fire on an unrelated word that merely shares a root");

  /* ---- 3. citations are labelled, never assumed */
  console.log("\n— a citation nobody verified is labelled as such");
  const cited = run({
    red_flags: [
      finding({ law_reference: "Article 74" }),
      finding({ law_reference: "Article 141" }),
      finding({ law_reference: "Labour Law, Royal Decree M/51" }),
    ],
  });
  ok(cited.red_flags[0].law_reference.verified === true,
     "an article in the verified register is marked verified");
  ok(cited.red_flags[1].law_reference.verified === false &&
     cited.red_flags[1].law_reference.ref === "Article 141",
     "one that is not is still SHOWN — the owner's rule — but carries verified:false");
  ok(cited.red_flags[2].law_reference.verified === false,
     "and a reference with no article number is not verified either: the word means one thing");
  const arCite = run({ red_flags: [finding({ law_reference: "المادة ٧٤" })] });
  ok(arCite.red_flags[0].law_reference.verified === true,
     "an Arabic citation with Arabic-Indic digits verifies identically");

  /* ---- 4. the acceptance test, as a permanent assertion */
  console.log("\n— \"I like cats and coffee\" cannot produce a confident reading");
  const nonsense = gradeContractReview(base({
    contract_meta: Object.assign(base({}).contract_meta, {
      extraction_confidence: "low",
      extraction_notes_en: "This is not an employment contract.",
      extraction_notes_ar: "هذا ليس عقد عمل.",
    }),
    /* The model filling these in anyway is exactly the failure being guarded
       against — a low-confidence label with confident content under it. */
    red_flags: [finding({ clause_en: "Confident nonsense" })],
    negotiation_points: [point({ clause_en: "More of it" })],
    summary_en: "A solid contract overall.",
  }), { source: "I like cats and coffee, the weather is nice.", rows: ROWS });
  ok(nonsense.red_flags.length === 0 && nonsense.negotiation_points.length === 0,
     "findings produced alongside a low-confidence flag are discarded — they describe a document we did not read");
  ok(Object.values(nonsense.key_terms).every(v => v === null),
     "every key term is null, whatever the completion filled in");
  ok(nonsense.summary_en === "" && nonsense.summary_ar === "",
     "and no summary is shown — a confident sentence is the most misleading thing here");
  ok(!!nonsense.contract_meta.extraction_notes_en,
     "while the explanation of WHY survives, which is the useful half");

  /* ---- 5. nationality changes the reading */
  console.log("\n— a resident and a Saudi do not get the same reading");
  ok(run({}, { track: "Resident" }).track === "Resident" && run({}).track === "Saudi",
     "the track is carried through to the reader, so nobody wonders why a colleague saw something else");
  ok(gradeContractReview(base({}), { source: DOC, rows: ROWS, track: "<script>" }).track === "Saudi",
     "and an unrecognised track falls back to Saudi rather than inventing a third");

  /* ---- 6. the disclaimer is ours, not the model's */
  console.log("\n— the disclaimer comes from the server, verbatim");
  const reworded = gradeContractReview(base({
    disclaimer_ar: "لا حاجة لمحامٍ.", disclaimer_en: "No lawyer needed.",
  }), { source: DOC, rows: ROWS });
  ok(/لا يغني عن استشارة محامٍ/.test(reworded.disclaimer_ar) &&
     /does not substitute/.test(reworded.disclaimer_en),
     "a completion that rewrote the disclaimer does not get to publish it");

  /* ---- 7. hostile and malformed input */
  console.log("\n— a hostile or malformed completion cannot reach the reader");
  const junk = [null, undefined, "a string", 42, [], { red_flags: "not an array" },
                { contract_meta: "nope", key_terms: "nope" }];
  let bad = null;
  for (const j of junk) {
    try {
      const r = gradeContractReview(j, { source: DOC, rows: ROWS });
      if (!Array.isArray(r.red_flags) || typeof r.disclaimer_ar !== "string") bad = "bad shape: " + JSON.stringify(j);
    } catch (e) { bad = String(e && e.message); }
  }
  ok(bad === null, `every malformed completion returns a valid shape${bad ? " — " + bad : ""}`);

  const unknownConf = gradeContractReview({ contract_meta: { extraction_confidence: "excellent" } },
                                          { source: DOC, rows: ROWS });
  ok(unknownConf.contract_meta.extraction_confidence === "low",
     "an unrecognised confidence value falls to LOW — the safe direction, so a typo shows nothing rather than everything");

  const huge = run({ red_flags: [finding({ issue_en: "x".repeat(5000), clause_en: "y".repeat(5000) })] });
  ok(huge.red_flags[0].issue_en.length <= 600 && huge.red_flags[0].clause_en.length <= 300,
     `findings are bounded (clause ${huge.red_flags[0].clause_en.length}, issue ${huge.red_flags[0].issue_en.length}), so one cannot smuggle the document back out`);

  /* ---- 7. the client half: what a reader actually sees */
  console.log("\n— on screen: absent when unconfigured, and tiered when it is");
  const { playwright, launchOpts, APP } = require("./_env.js");
  const { chromium } = playwright();
  const b = await chromium.launch(launchOpts());

  /* AI is live in production now (ANALYZE_URL is committed — see
     docs/enable-ai-runbook.md), so this is no longer the shipped default.
     Still a real guarantee: if the endpoint is ever cleared again, the panel
     must render nothing, not a teaser or a locked state. Forced explicitly
     rather than relied on as the file's own default. */
  const page0 = await b.newPage({ viewport: { width: 390, height: 844 } });
  page0.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await page0.addInitScript(() => { window.WODOUH_CONFIG = { ANALYZE_URL: "" }; });
  await page0.goto(APP);
  await page0.waitForFunction(() => typeof window.renderCrPanel === "function");

  const inert = await page0.evaluate(() => {
    crResult = { extraction_confidence: "high", key_terms: {}, red_flags: [],
                 worth_negotiating: [], dropped: { findings: 0, terms: [] },
                 disclaimer_ar: "x", disclaimer_en: "x" };
    renderCrPanel();
    const h = document.getElementById("crPanel");
    return { hidden: h.hidden, html: h.innerHTML.length, avail: aiAvailable() };
  });
  ok(inert.avail === false, "with ANALYZE_URL forced empty, aiAvailable() is false");
  ok(inert.hidden === true && inert.html === 0,
     "so the panel renders NOTHING — not a teaser, not a locked state. An invisible feature cannot mislead anyone about where their contract goes");
  await page0.close();

  /* The shipping build itself: an endpoint is configured. Not aiAvailable()
     — that also gates on the remote ai_analysis flag, a separate switch this
     file has no business asserting the live value of. */
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await page.goto(APP);
  await page.waitForFunction(() => typeof window.renderCrPanel === "function");
  const hasUrl = await page.evaluate(() => !!analyzeUrl());
  ok(hasUrl === true, "the shipping build has an AI endpoint configured");

  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p2.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await p2.addInitScript(() => {
    window.WODOUH_CONFIG = { ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze" };
  });
  await p2.goto(APP);
  await p2.waitForFunction(() => typeof window.renderCrPanel === "function");

  const shown = await p2.evaluate((payload) => {
    if (document.documentElement.lang !== "ar") toggleLang();
    crResult = payload; crBusy = false; crError = null;
    renderCrPanel();
    const h = document.getElementById("crPanel");
    const cite = [...h.querySelectorAll(".cr-cite")];
    return {
      hidden: h.hidden,
      tiers: cite.map(c => c.className.replace("cr-cite ", "")),
      /* The injected markup must have arrived as TEXT. */
      scriptTags: h.querySelectorAll("script, img, iframe").length,
      text: h.textContent,
      terms: [...h.querySelectorAll(".cr-terms > div")].length
    };
  }, {
    track: "Resident",
    contract_meta: { contract_type_ar: "عقد محدد المدة", contract_type_en: "Fixed-term",
                     parties_identified: true, extraction_confidence: "high",
                     extraction_notes_ar: null, extraction_notes_en: null },
    key_terms: { position_ar: "مهندس موقع", position_en: "Site Engineer",
                 salary_amount: 10000, salary_currency: "SAR",
                 probation_period_days: 180, contract_duration: null,
                 notice_period_days: null, working_hours_per_week: null },
    red_flags: [
      { clause_ar: "يحتفظ صاحب العمل بالجواز", clause_en: "Employer retains passport",
        issue_ar: "قد لا يتوافق", issue_en: "May need review", severity: "high", hedged: false,
        law_reference: { ref: "المادة ٥٣", article: "53", verified: false } },
      { clause_ar: "<img src=x onerror=alert(1)>", clause_en: "XSS",
        issue_ar: "نص", issue_en: "text", severity: "high", hedged: false,
        law_reference: { ref: "المادة ٧٤", article: "74", verified: true } }
    ],
    negotiation_points: [],
    summary_ar: "خلاصة", summary_en: "Summary",
    dropped: { findings: 2, terms: [] },
    disclaimer_ar: "هذا التحليل لأغراض معلوماتية فقط.", disclaimer_en: "Informational only."
  });

  ok(shown.hidden === false, "configured, the panel appears");
  ok(shown.terms === 4,
     `only the terms the contract actually stated are listed — contract type, position, salary, probation (${shown.terms})`);
  ok(/مقيم/.test(shown.text),
     "and the reader is told this is the resident reading, so a differing result has a visible reason");
  ok(shown.tiers.join(",") === "unverified,verified",
     `each citation is tiered by what the SERVER decided, not by tone (${shown.tiers.join(", ")})`);
  /* Pinned to the copy key rather than to a hard-coded phrase: the two live
     strings differ in gender agreement (استشهاد غير محقق vs الاستشهادات غير
     محققة), both correctly, and a test that hard-codes one breaks the next
     time someone edits the other. */
  const uLabel = await p2.evaluate(() => t("cr_u"));
  ok(shown.text.includes(uLabel) && /غير محقق/.test(uLabel),
     `an unverified citation says so in Arabic, beside the number rather than in a footnote ("${uLabel}")`);
  ok(shown.scriptTags === 0 && /<img/.test(shown.text),
     "a finding containing markup is rendered as TEXT — it came from a document a stranger wrote");
  ok(/٢|2/.test(shown.text) && /أسقطنا|dropped/i.test(shown.text),
     "and findings the server refused are reported, so a filtered result cannot pass for a clean contract");

  const lowConf = await p2.evaluate(() => {
    crResult = { track: "Saudi",
                 contract_meta: { extraction_confidence: "low",
                                  extraction_notes_ar: "المستند غير مقروء",
                                  extraction_notes_en: "unreadable" },
                 key_terms: { position_ar: "ghost" },
                 red_flags: [], negotiation_points: [], summary_ar: "خلاصة واثقة",
                 dropped: { findings: 0, terms: [] },
                 disclaimer_ar: "x", disclaimer_en: "y" };
    renderCrPanel();
    const h = document.getElementById("crPanel");
    return { terms: h.querySelectorAll(".cr-terms > div").length, text: h.textContent };
  });
  ok(lowConf.terms === 0,
     "a low-confidence read shows NO extracted terms on screen, even if the payload carries some");
  ok(/غير مقروء/.test(lowConf.text), "but does show why it could not be read");
  ok(!/خلاصة واثقة/.test(lowConf.text),
     "and shows no summary — the confident sentence is the most misleading thing on a document we could not read");

  await b.close();

  console.log(FAIL.length
    ? `\n${FAIL.length} FAILURES`
    : "\nthe model proposes, the server decides, and the screen labels — NOTE: the endpoint is not deployed, so nothing here has met a live response");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
