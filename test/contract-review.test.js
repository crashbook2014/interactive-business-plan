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
  title_ar: "بند", title_en: "Clause",
  detail_ar: "شرح", detail_en: "Detail",
  law_reference: null,
}, over);

const base = (over) => Object.assign({
  extraction_confidence: "high",
  extraction_notes_ar: "قرأنا العقد كاملًا",
  extraction_notes_en: "Read the full contract",
  key_terms: {
    job_title: "Site Engineer", monthly_wage: "10,000 SAR", contract_type: "fixed",
    probation_days: "180", notice_days: "30", annual_leave_days: "21",
    non_compete_months: "24",
  },
  red_flags: [], worth_negotiating: [],
}, over);

(async () => {
  const { gradeContractReview, hedge, figuresIn } =
    await import("../supabase/functions/_shared/review-contract.mjs");
  const run = (o) => gradeContractReview(base(o), { source: DOC, rows: ROWS });

  /* ---- 1. money */
  console.log("\n— the model may report a figure the contract states, and no other");
  const clean = run({});
  ok(clean.key_terms.monthly_wage === "10,000 SAR",
     "a wage written in the contract survives — reading it back is the product");
  ok(clean.key_terms.probation_days === "180" && clean.key_terms.non_compete_months === "24",
     "and so do the other terms lifted from the document");

  const invented = run({
    key_terms: Object.assign(base({}).key_terms, { monthly_wage: "18,000 SAR" }),
  });
  ok(invented.key_terms.monthly_wage === null,
     "a wage that appears NOWHERE in the document is dropped, not shown");
  ok(invented.dropped.terms.includes("monthly_wage"),
     "and the drop is reported rather than passed off as an empty field");

  const promised = run({
    red_flags: [finding({ detail_en: "You are owed 45,000 SAR in end-of-service pay.",
                          detail_ar: "تستحق ٤٥٠٠٠ ريال مكافأة نهاية الخدمة." })],
  });
  ok(promised.red_flags.length === 0,
     "a finding that invents an amount is dropped WHOLE — money is computed on the device, never here");
  ok(promised.dropped.findings === 1, "and counted, so a filtered build cannot look like a clean contract");

  /* The figure has to be checked as a number, not as a substring: 1,500 in the
     contract must not attest 11,500 in the output. */
  ok(!figuresIn(DOC).has("11500") && figuresIn(DOC).has("1500"),
     "attestation matches whole figures — 1,500 in the contract does not license 11,500");

  const arabicDigits = run({
    red_flags: [finding({ detail_ar: "الأجر ١٠٬٠٠٠ ريال شهريًا." })],
  });
  ok(arabicDigits.red_flags.length === 1,
     "and Arabic-Indic digits are digits — the same figure written ١٠٠٠٠ is attested too");

  /* ---- 2. never illegal, in either language */
  console.log("\n— nothing is called illegal, void, or a violation — in either language");
  const blunt = run({
    red_flags: [finding({
      title_en: "Probation violates the law", detail_en: "This clause is illegal and void.",
      title_ar: "فترة التجربة مخالفة للنظام", detail_ar: "هذا الشرط باطل ويخالف النظام.",
    })],
  });
  const f = blunt.red_flags[0];
  ok(f && !/violat|illegal|void/i.test(f.title_en + f.detail_en),
     `the English is hedged ("${f && f.detail_en}")`);
  ok(f && !/مخالف|باطل|يخالف/.test(f.title_ar + f.detail_ar),
     `and so is the Arabic ("${f && f.detail_ar}")`);
  ok(f && f.hedged === true && blunt.hedged === true,
     "and the fact that it was rewritten is reported, not silent");
  ok(f && /questionable|inconsistent|review/i.test(f.detail_en) && /يتوافق|مراجعة|نظر/.test(f.detail_ar),
     `the replacement still says something rather than emptying the finding ("${f && f.detail_ar}")`);

  /* The rewrite table is best-effort; the residue check is the guarantee. A
     sentence the table cannot fully clean must not be published half-hedged. */
  const stubborn = run({
    red_flags: [finding({ detail_en: "Void ab initio under any reading of the law." })],
  });
  ok(stubborn.red_flags.every(x => !/\bvoid\b/i.test(x.detail_en)),
     "a finding the rewriter cannot fully clean is dropped, not published half-hedged");

  /* The Arabic half is the half that matters most here and is the easiest to
     get wrong: JS \b forms no boundary against Arabic letters, so a naive
     /يخالف\b/ silently never fires. */
  ok(hedge("يخالف النظام").changed === true, "the Arabic patterns actually fire");
  ok(hedge("مخالفات سابقة").changed === false,
     "and do not fire on an unrelated word that merely shares a root");

  /* ---- 3. citations are labelled, never assumed */
  console.log("\n— a citation nobody verified is labelled as such");
  const cited = run({
    red_flags: [
      finding({ title_en: "Grounds", law_reference: "Article 74" }),
      finding({ title_en: "Invented", law_reference: "Article 141" }),
      finding({ title_en: "Named law", law_reference: "Labour Law, Royal Decree M/51" }),
    ],
  });
  ok(cited.red_flags[0].law_reference.verified === true,
     "an article in the verified register is marked verified");
  ok(cited.red_flags[1].law_reference.verified === false &&
     cited.red_flags[1].law_reference.ref === "Article 141",
     "one that is not is still SHOWN — the owner's rule — but carries verified:false");
  ok(cited.red_flags[2].law_reference.verified === false,
     "and a reference with no article number is not verified either: the word means one thing");
  ok(cited.red_flags[0].law_reference.article === "74", "the article number is extracted for the UI to tier on");

  const arCite = run({ red_flags: [finding({ law_reference: "المادة ٧٤" })] });
  ok(arCite.red_flags[0].law_reference.verified === true,
     "an Arabic citation with Arabic-Indic digits verifies identically");

  /* ---- 4. low confidence means nothing, not something */
  console.log("\n— a document we could not read yields no terms and no findings");
  const garbled = gradeContractReview(base({
    extraction_confidence: "low",
    red_flags: [finding({ title_en: "Confident nonsense" })],
    worth_negotiating: [finding({ title_en: "More of it" })],
  }), { source: DOC, rows: ROWS });
  ok(garbled.red_flags.length === 0 && garbled.worth_negotiating.length === 0,
     "findings produced alongside a low-confidence flag are discarded — they describe a document we did not read");
  ok(Object.values(garbled.key_terms).every(v => v === null),
     "and every key term is null, whatever the completion filled in");
  ok(!!garbled.extraction_notes_ar && !!garbled.extraction_notes_en,
     "while the explanation of WHY survives, in both languages");

  /* ---- 5. the disclaimer is ours, not the model's */
  console.log("\n— the disclaimer comes from the server, verbatim");
  const reworded = gradeContractReview(base({
    disclaimer_ar: "لا حاجة لمحامٍ.", disclaimer_en: "No lawyer needed.",
  }), { source: DOC, rows: ROWS });
  ok(/لا يغني عن استشارة محامٍ/.test(reworded.disclaimer_ar) &&
     /does not substitute/.test(reworded.disclaimer_en),
     "a completion that rewrote the disclaimer does not get to publish it");

  /* ---- 6. hostile and malformed input */
  console.log("\n— a hostile or malformed completion cannot reach the reader");
  const junk = [null, undefined, "a string", 42, [], { red_flags: "not an array" },
                { extraction_confidence: "excellent", key_terms: "nope" }];
  let threw = null;
  for (const j of junk) {
    try {
      const r = gradeContractReview(j, { source: DOC, rows: ROWS });
      if (!Array.isArray(r.red_flags) || typeof r.disclaimer_ar !== "string") threw = "bad shape: " + JSON.stringify(j);
    } catch (e) { threw = String(e && e.message); }
  }
  ok(threw === null, `every malformed completion returns a valid shape${threw ? " — " + threw : ""}`);

  const unknownConf = gradeContractReview({ extraction_confidence: "excellent" }, { source: DOC, rows: ROWS });
  ok(unknownConf.extraction_confidence === "low",
     "an unrecognised confidence value falls to LOW — the safe direction, so a typo shows nothing rather than everything");

  /* Length limits exist so a completion cannot use a finding as a channel for
     the contract text it was told never to reproduce. */
  const huge = run({ red_flags: [finding({ detail_en: "x".repeat(5000) })] });
  ok(huge.red_flags[0].detail_en.length <= 800,
     `findings are bounded (${huge.red_flags[0].detail_en.length} chars), so one cannot smuggle the document back out`);

  /* ---- 7. the client half: what a reader actually sees */
  console.log("\n— on screen: absent when unconfigured, and tiered when it is");
  const { playwright, launchOpts, APP } = require("./_env.js");
  const { chromium } = playwright();
  const b = await chromium.launch(launchOpts());
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await page.goto(APP);
  await page.waitForFunction(() => typeof window.renderCrPanel === "function");

  const inert = await page.evaluate(() => {
    crResult = { extraction_confidence: "high", key_terms: {}, red_flags: [],
                 worth_negotiating: [], dropped: { findings: 0, terms: [] },
                 disclaimer_ar: "x", disclaimer_en: "x" };
    renderCrPanel();
    const h = document.getElementById("crPanel");
    return { hidden: h.hidden, html: h.innerHTML.length, avail: aiAvailable() };
  });
  ok(inert.avail === false, "the shipping build has no endpoint configured");
  ok(inert.hidden === true && inert.html === 0,
     "so the panel renders NOTHING — not a teaser, not a locked state. An invisible feature cannot mislead anyone about where their contract goes");

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
    extraction_confidence: "high",
    extraction_notes_ar: "", extraction_notes_en: "",
    key_terms: { job_title: "مهندس موقع", monthly_wage: "10,000 SAR",
                 contract_type: null, probation_days: "180", notice_days: null,
                 annual_leave_days: null, non_compete_months: null },
    red_flags: [
      { title_ar: "فترة التجربة", title_en: "Probation", detail_ar: "١٨٠ يومًا",
        detail_en: "180 days", severity: "high", hedged: false,
        law_reference: { ref: "المادة ٥٣", article: "53", verified: false } },
      { title_ar: "<img src=x onerror=alert(1)>", title_en: "XSS",
        detail_ar: "نص", detail_en: "text", severity: "high", hedged: false,
        law_reference: { ref: "المادة ٧٤", article: "74", verified: true } }
    ],
    worth_negotiating: [],
    dropped: { findings: 2, terms: [] },
    disclaimer_ar: "هذا التحليل لأغراض معلوماتية فقط.", disclaimer_en: "Informational only."
  });

  ok(shown.hidden === false, "configured, the panel appears");
  ok(shown.terms === 3, `only the terms the contract actually stated are listed (${shown.terms} of 7)`);
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
    crResult = { extraction_confidence: "low", extraction_notes_ar: "المستند غير مقروء",
                 extraction_notes_en: "unreadable", key_terms: { job_title: "ghost" },
                 red_flags: [], worth_negotiating: [], dropped: { findings: 0, terms: [] },
                 disclaimer_ar: "x", disclaimer_en: "y" };
    renderCrPanel();
    const h = document.getElementById("crPanel");
    return { terms: h.querySelectorAll(".cr-terms > div").length, text: h.textContent };
  });
  ok(lowConf.terms === 0,
     "a low-confidence read shows NO extracted terms on screen, even if the payload carries some");
  ok(/غير مقروء/.test(lowConf.text), "but does show why it could not be read");

  await b.close();

  console.log(FAIL.length
    ? `\n${FAIL.length} FAILURES`
    : "\nthe model proposes, the server decides, and the screen labels — NOTE: the endpoint is not deployed, so nothing here has met a live response");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
