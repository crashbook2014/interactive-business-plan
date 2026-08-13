/* Answering questions the app was not built to answer — and the machinery that
 * stops that becoming a licence to make things up.
 *
 * The feature's promise to a reader is narrow and specific: an answer is either
 * grounded in a rule a human verified, or it is labelled as general knowledge
 * that Wodouh has not checked. What this suite proves is that the SECOND HALF
 * of that promise is enforced by code rather than by the model's cooperation:
 *
 *   - the corpus the model sees contains only rows a human marked verified,
 *     and it cannot drift from the register without failing here
 *   - Article 53 is under dispute, so it is not in the corpus at all — there is
 *     nothing for a completion to quote, in either language
 *   - a completion that claims "verified" while citing nothing is demoted
 *   - an article number the answer did not cite refuses the whole answer
 *   - a riyal figure that is not in a cited row refuses the whole answer
 *   - all of the above hold when the answer is written in Arabic
 *
 * These are unit tests, not browser tests: they run the exact module the Edge
 * Function imports, because a guarantee proven against a re-implementation is
 * not proven.
 */
const { readFileSync } = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const { buildCorpus } = await import("../tools/make-corpus.mjs");
  const { gradeAnswer, articlesIn, moneyIn } = await import("../supabase/functions/_shared/grade.mjs");

  const register = readFileSync(path.join(ROOT, "docs/legal-sources.md"), "utf8");
  const committed = JSON.parse(readFileSync(path.join(ROOT, "supabase/functions/_shared/corpus.json"), "utf8"));
  const fresh = buildCorpus(register);
  const byId = new Map(committed.rows.map(r => [r.id, r]));
  const lookup = id => byId.get(id);

  /* ---- 1. the corpus IS the register, or the build fails */
  console.log("\n— the corpus cannot drift from the register");
  ok(JSON.stringify(fresh.rows) === JSON.stringify(committed.rows),
     "the committed corpus matches what the register generates today" +
     (JSON.stringify(fresh.rows) === JSON.stringify(committed.rows)
       ? "" : " — run: node tools/make-corpus.mjs"));
  ok(committed.rows.length > 20, `the corpus is not empty (${committed.rows.length} rows)`);
  ok(new Set(committed.rows.map(r => r.id)).size === committed.rows.length,
     "every row id is unique, so a citation resolves to one row");

  /* Generic on purpose. This is not "is 53 excluded" — it is "is anything the
     register did not tick excluded", which stays true for the next disputed
     row without anyone remembering to add a case here. */
  const ticked = register.split("\n")
    .filter(l => l.startsWith("|") && /✅\s*verified\s*\|/.test(l)).length;
  ok(ticked === committed.rows.length,
     `the corpus holds exactly the ticked rows and no others (${ticked} ticked, ${committed.rows.length} in corpus)`);

  /* ---- 2. the disputed article is absent, not merely discouraged */
  console.log("\n— a disputed rule is absent from the corpus, not declined by the model");
  const arts = committed.rows.map(r => r.article).filter(Boolean);
  ok(!arts.some(a => /\b53\b/.test(a)),
     "Article 53 — under open dispute — is not in the corpus at all");
  ok(register.includes("DISPUTED"),
     "and the register still records it as disputed (this test is watching a live state, not a fixture)");
  /* Article 81's row is verified as to the grounds but its award consequence is
     a reading, so it is not a clean tick and is correctly out. If someone later
     resolves that row, this assertion is the thing that makes them notice the
     corpus grew. */
  ok(!arts.some(a => /\b81\b/.test(a)),
     "and so is Article 81, whose row is verified only in part");

  /* ---- 3. the grader decides the tier, not the reply */
  console.log("\n— the server grades the answer; the model only proposes");
  const eos = committed.rows.find(r => r.article === "84");
  ok(!!eos, "the corpus has the end-of-service row to test against");

  const claimedVerified = gradeAnswer(
    { tier: "verified", answer: "Article 84 sets the end-of-service award.", cites: [eos.id] }, lookup);
  ok(claimedVerified.tier === "verified" && claimedVerified.cites.length === 1,
     "a real citation plus an article number from that row passes as verified");

  const noCites = gradeAnswer(
    { tier: "verified", answer: "The law is clear on this.", cites: [] }, lookup);
  ok(noCites.tier === "unverified",
     "a reply that calls itself verified while citing nothing is demoted, not trusted");

  const fakeCite = gradeAnswer(
    { tier: "verified", answer: "The law is clear on this.", cites: ["art-999", "made-up"] }, lookup);
  ok(fakeCite.tier === "unverified",
     "ids that do not exist in the corpus are dropped, and the tier falls with them");

  const declined = gradeAnswer({ tier: "refused", answer: "I don't know.", cites: [] }, lookup);
  ok(declined.tier === "refused" && declined.reason === "model",
     "a model that declines is passed through as a refusal, not upgraded");

  /* ---- 4. an article number the answer did not earn refuses the answer */
  console.log("\n— an unearned article number refuses the whole answer");
  const strayEn = gradeAnswer(
    { tier: "unverified", answer: "Under Article 90 your wage is due within ten days.", cites: [] }, lookup);
  ok(strayEn.tier === "refused" && strayEn.reason === "citation",
     "an unverified answer citing Article 90 — a number in no verified row — is refused");
  ok(strayEn.answer === "",
     "and the text is withheld entirely rather than shown with the citation quietly removed");

  const strayAr = gradeAnswer(
    { tier: "unverified", answer: "بحسب المادة ٩٠ يجب دفع أجرك خلال عشرة أيام.", cites: [] }, lookup);
  ok(strayAr.tier === "refused" && strayAr.reason === "citation",
     "the same holds for Arabic text and Arabic-Indic digits");

  const wrongRow = gradeAnswer(
    { tier: "verified", answer: "Article 87 gives the full award.", cites: [eos.id] }, lookup);
  ok(wrongRow.tier === "refused" && wrongRow.reason === "citation",
     "citing one row and naming a different row's article is refused too");

  /* ---- 5. the model may never state money it was not handed */
  console.log("\n— the model may never state a riyal figure of its own");
  const invented = gradeAnswer(
    { tier: "unverified", answer: "You are likely owed about SAR 42,000.", cites: [] }, lookup);
  ok(invented.tier === "refused" && invented.reason === "money",
     "an invented amount refuses the answer");

  const inventedAr = gradeAnswer(
    { tier: "unverified", answer: "مستحقاتك تقارب ٤٢٠٠٠ ريال.", cites: [] }, lookup);
  ok(inventedAr.tier === "refused" && inventedAr.reason === "money",
     "including when the amount is written in Arabic with the unit trailing");

  /* The exception that proves the rule is a real one: a verified row genuinely
     contains the GOSI contributable-wage cap, and quoting it is correct. */
  const cap = committed.rows.find(r => /45,000|45000/.test(r.claim));
  ok(!!cap, "the corpus has a row that legitimately contains an amount");
  const quoted = gradeAnswer(
    { tier: "verified", answer: "GOSI contributions are capped at SAR 45,000 per month.", cites: [cap.id] }, lookup);
  ok(quoted.tier === "verified",
     "an amount that appears in a cited row is allowed through — the rule is about invention, not arithmetic");

  /* ---- 6. the scanners themselves */
  console.log("\n— the scanners the rules are built on");
  ok(articlesIn("see Article 84 and art. 85 and المادة ٨٧").sort().join(",") === "84,85,87",
     "article numbers are found in both languages and both digit sets");
  ok(moneyIn("SAR 9,000").includes("9000") && moneyIn("٩٠٠٠ ريال").includes("9000"),
     "amounts are found with the unit leading or trailing, in either digit set");
  ok(articlesIn("she is 84 years old").length === 0,
     "a bare number that is not a citation is not treated as one");

  console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\nall grounded-answer checks passed");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
