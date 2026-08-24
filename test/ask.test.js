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
 *   - every verified row exists in Arabic as well as English, and translation
 *     moved no figure: the digits in the two are identical, per row
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

  /* ---- 5b. the register is bilingual, and translation moved nothing
     Wodouh is read in Arabic. A verified row that exists only in English is
     not a display gap: the source block handed to the model becomes English,
     the model is told to reply in Arabic, and it ends up translating the
     statute itself at answer time — on the one surface whose entire promise is
     that a human wrote the words. These assertions are the mechanical proof
     that no such row can be compiled, and that no translation changed a
     number. */
  console.log("\n— every verified row exists in Arabic, and no figure moved in translation");

  const AR_LETTER = /[\u0621-\u064A]/;
  const missing = committed.rows.filter(r => !r.claim_ar || !AR_LETTER.test(r.claim_ar));
  ok(missing.length === 0,
     `every verified row carries an Arabic claim (${committed.rows.length - missing.length}/${committed.rows.length})` +
     (missing.length ? ` — missing: ${missing.map(r => r.id).join(", ")}` : ""));

  /* The invariant the whole register rests on, applied to the translator
     rather than to the model: the same figures, in the same quantities, in
     both languages. A row that says 180 days in English and 90 in Arabic is a
     different legal claim wearing the same id. */
  const digits = t => (String(t).replace(/,/g, "").match(/\d+(?:\.\d+)?/g) || []).sort();
  const drifted = committed.rows.filter(r =>
    digits(r.claim).join("|") !== digits(r.claim_ar).join("|"));
  ok(drifted.length === 0,
     "the digits in the Arabic claim match the English one exactly, row by row" +
     (drifted.length ? ` — drifted: ${drifted.map(r => r.id).join(", ")}` : ""));

  /* Latin digits throughout, the same rule the app enforces with
     ar-SA-u-nu-latn. A figure a reader carries into a settlement meeting is
     read off the screen; it should look the same everywhere it appears. */
  const indic = committed.rows.filter(r => /[\u0660-\u0669]/.test(r.claim_ar));
  ok(indic.length === 0,
     "Arabic claims use Latin digits, as the rest of the app does" +
     (indic.length ? ` — Arabic-Indic in: ${indic.map(r => r.id).join(", ")}` : ""));

  /* An article number that exists only in the Arabic is a citation no human
     verified in the column the register is checked against. */
  const extraCite = committed.rows.filter(r => {
    const en = new Set(articlesIn(r.claim));
    return articlesIn(r.claim_ar).some(n => !en.has(n));
  });
  ok(extraCite.length === 0,
     "no article number appears in the Arabic that is absent from the English" +
     (extraCite.length ? ` — ${extraCite.map(r => r.id).join(", ")}` : ""));

  /* The builder refuses rather than shipping an untranslated row. Proven by
     removing one, not by trusting the comment above it. */
  const holed = register.split("\n")
    .map(l => l.startsWith("| End-of-service:")
      ? l.split("|").map((c, i) => i === 2 ? " " : c).join("|") : l)
    .join("\n");
  let refused = false;
  try { buildCorpus(holed); } catch { refused = true; }
  ok(refused, "a verified row with its Arabic removed fails the build instead of shipping");

  /* And the grader recognises a figure quoted from the Arabic side of a row.
     Without this the Arabic reader gets the correct answer refused for
     reason:"money" — the guarantee holding so hard it stops being useful. */
  const capAr = committed.rows.find(r => /45,000|45000/.test(r.claim_ar || ""));
  ok(!!capAr, "the GOSI cap row carries its amount in Arabic too");
  if (capAr) {
    const quotedAr = gradeAnswer(
      { tier: "verified", answer: "الحد الأقصى للأجر الخاضع للاشتراك 45,000 ريال شهريًا.", cites: [capAr.id] },
      lookup);
    ok(quotedAr.tier === "verified",
       "an amount quoted from the Arabic claim of a cited row is allowed through");
    const strayAr = gradeAnswer(
      { tier: "verified", answer: "مستحقاتك 61,300 ريال.", cites: [capAr.id] }, lookup);
    ok(strayAr.tier === "refused" && strayAr.reason === "money",
       "and a figure in no row is still refused — the check widened, it did not soften");
  }

  /* ---- the 24 August code review: the guarantee the Terms actually make.
     terms/index.html states, in both languages, that no article number and no
     riyal figure is shown unless it appears in a verified source. Both checks
     were keyed on a WORD, so dropping the word dropped the check. Every row
     below was measured against the grader at 939e8c0 and every one was SHOWN
     with tier=verified. */
  console.log("\n— the figure and citation rules do not depend on the model's phrasing");
  if (capAr) {
    const stray = [
      /* 61300 and not 45000: 45,000 is the GOSI cap and IS in the row cited
         here, so an answer stating it is correctly allowed. A first draft of
         this test used it and failed for that reason — the figure has to be
         one the row does not contain, or the case proves nothing. */
      ["a bare figure in no cited row",       "You are owed 61300.",                         "money"],
      ["the same, in Arabic",                 "المستحق لك هو 61300 تقريبا.",                  "money"],
      ["a separated figure without a unit",   "Your award comes to 61,300.",                 "money"],
      ["an article named by the law, not the word", "Under 77 of the Labor Law you may claim.", "citation"],
      ["'Art 77' with no full stop",          "Art 77 applies here.",                        "citation"],
      ["an article named in Arabic prose",    "بموجب 77 من نظام العمل يحق لك ذلك.",           "citation"],
    ];
    for (const [label, answer, why] of stray) {
      const g = gradeAnswer({ tier:"verified", answer, cites:[capAr.id] }, lookup);
      ok(g.tier === "refused" && g.reason === why,
         `${label} is refused (${g.tier}${g.reason ? "/" + g.reason : ""})`);
    }

    /* AND THE OTHER HALF, which matters as much: a rule that refuses
       everything is not a working rule, it is a broken feature. These must all
       still come through. */
    const fine = [
      ["the cap quoted with its unit",  "The contributable wage is capped at SAR 45,000 per month.", [capAr.id]],
      ["the cap quoted bare",           "The cap is 45000 a month.",                                 [capAr.id]],
      ["the cap quoted from the Arabic","الحد الأقصى للأجر الخاضع للاشتراك 45,000 ريال شهريًا.",      [capAr.id]],
    ];
    for (const [label, answer, cites] of fine) {
      const g = gradeAnswer({ tier:"verified", answer, cites }, lookup);
      ok(g.tier === "verified", `${label} is still allowed through (${g.tier}${g.reason ? "/" + g.reason : ""})`);
    }
    /* A year is not an amount. Four corpus rows date something, and treating
       2025 as riyals would refuse an answer that cited them correctly. */
    const yearRow = committed.rows.find(r => /(19|20)\d\d/.test(r.claim));
    if (yearRow) {
      const g = gradeAnswer({ tier:"verified",
        answer: yearRow.claim.slice(0, 200), cites:[yearRow.id] }, lookup);
      ok(g.tier === "verified",
         `a row's own text, quoted back with its date, is not read as money (${g.tier}${g.reason ? "/" + g.reason : ""})`);
    }
    /* And the pollution: citing a row must not license every number in its
       prose as an amount. art-75 says "employer 60 days, employee 30 days". */
    const notice = committed.rows.find(r => /60/.test(r.claim) && /30/.test(r.claim));
    if (notice) {
      const g = gradeAnswer({ tier:"verified",
        answer: "You are owed SAR 60 for this.", cites:[notice.id] }, lookup);
      ok(g.tier === "refused" && g.reason === "money",
         `a day count in a cited row does not license it as an amount (${g.tier}${g.reason ? "/" + g.reason : ""})`);
    }
  }

  /* ---- 6. the scanners themselves */
  console.log("\n— the scanners the rules are built on");
  ok(articlesIn("see Article 84 and art. 85 and المادة ٨٧").sort().join(",") === "84,85,87",
     "article numbers are found in both languages and both digit sets");
  ok(moneyIn("SAR 9,000").includes("9000") && moneyIn("٩٠٠٠ ريال").includes("9000"),
     "amounts are found with the unit leading or trailing, in either digit set");
  ok(articlesIn("she is 84 years old").length === 0,
     "a bare number that is not a citation is not treated as one");

  /* ======================================================================
     The other half: what a reader actually sees.
     The grader above decides the tier; these assertions are about whether the
     screen makes that decision legible — and about the promise the consent
     text makes, which is checked against the bytes on the wire rather than
     against the copy. */
  const { playwright, launchOpts, APP } = require("./_env.js");
  const { chromium } = playwright();
  const AI_HOST = "https://stub.supabase.co";
  const b = await chromium.launch(launchOpts());

  /* ---- 7. what ships today */
  console.log("\n— the shipped build cannot ask anything");
  const p0 = await b.newPage({ viewport: { width: 390, height: 844 } });
  const off = [];
  p0.on("request", r => { if (!r.url().startsWith("http://127.") && !r.url().startsWith("http://localhost")) off.push(r.url()); });
  p0.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p0.goto(APP);
  await p0.waitForFunction(() => typeof window.show === "function");
  const shipped = await p0.evaluate(() => {
    show("rights");
    return { hidden: document.getElementById("askEntry").hidden, avail: askAvailable() };
  });
  ok(shipped.hidden === true, "with no endpoint configured, the ask entry does not exist for a reader");
  ok(shipped.avail === false, "and the app knows it cannot answer");
  ok(off.length === 0, `and the page makes no off-origin request${off.length ? ": " + off.join(", ") : ""}`);
  await p0.close();

  /* ---- 8. configured: consent gates the send */
  console.log("\n— consent gates the send, and the payload matches what the consent promised");
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  /* The shipped CSP is closed to everything, so the AI-enabled policy is
     served here — the same single-host grant a real deployment would make. */
  await p.route("**/app/", async route => {
    const res = await route.fetch();
    const body = (await res.text())/* Whatever the policy currently is, not the literal "'none'" it used
           to be. Once a real project was configured the app's connect-src
           named that host, this replacement silently stopped matching, and
           every stubbed AI request was blocked by a CSP the test believed it
           had opened. */
        .replace(/connect-src [^;]*/, `connect-src ${AI_HOST}`);
    await route.fulfill({ response: res, body });
  });
  let sent = [], reply = null;
  await p.route(`${AI_HOST}/**`, async route => {
    sent.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
  });
  await p.addInitScript(() => {
    window.WODOUH_CONFIG = { ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze" };
  });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  const opened = await p.evaluate(() => {
    lang = "en"; applyLang(); nat = "sa";
    term = Object.assign(blankTerm(), { how:"employer", start:"2020-01-01", end:"2026-01-01", wage:10000 });
    show("rights");
    const entry = document.getElementById("askEntry").hidden;
    openAsk();
    document.getElementById("askQ").value = "When is my final settlement due?";
    document.getElementById("askQ").dispatchEvent(new Event("input"));
    return { entry, goDisabled: document.getElementById("askGo").disabled };
  });
  ok(opened.entry === false, "configured: the ask entry appears");
  ok(opened.goDisabled === true, "typing a question is not enough — the button stays disabled until consent");
  ok(sent.length === 0, "and opening the screen and typing has sent nothing");

  reply = { tier:"verified", answer:"Within one week where the employer ended it.",
            cites:[{ id:"art-88", article:"88", claim:"Final settlement is due within one week…" }] };
  await p.evaluate(async () => {
    const box = document.getElementById("askAgree");
    box.checked = true; box.dispatchEvent(new Event("change"));
    await askRun();
  });
  /* `sent` counts requests to the ANALYZE endpoint. Once a project is
     configured the app also does a lazy flag GET on governed surfaces, which is
     a different request to a different URL and is asserted in admin.test.js —
     counting it here would make this suite fail for a reason it is not about. */
  ok(sent.length === 1, "ticking the box and pressing ask sends exactly one request to analyze");
  ok(sent[0].kind === "ask" && typeof sent[0].q === "string", "the request is an ask");
  /* The consent says the wage, dates and answers do not go. This is that
     sentence, checked against the wire. */
  ok(!("ctx" in sent[0]), "and it carries NO case details, because the second box was not ticked");
  const wire = JSON.stringify(sent[0]);
  ok(!/10000|2020-01-01|2026-01-01/.test(wire),
     "no wage and no date appear anywhere in the payload");

  /* The privacy copy has to track the build. A third thing can now leave the
     device, and a page that still says "two exceptions" is false. */
  console.log("\n— the privacy copy counts the exceptions this build actually has");
  const priv = await p.evaluate(() => {
    renderPrivacyCopy();
    return { acc: document.querySelector('#screen-account [data-t="acc_privacy_b"]').textContent,
             home: document.querySelector('#screen-home [data-t="privacy_line"]').textContent };
  });
  ok(/three exceptions/i.test(priv.acc), "the account page says three exceptions, not two");
  ok(/Ask a question/i.test(priv.acc), "and names the question box as one of them");
  ok(!/the one exception/i.test(priv.home), "and the home line no longer claims a single exception");

  /* ---- 9. the two tiers are not mistakable for each other */
  console.log("\n— a verified answer and an unverified one do not look alike");
  const ver = await p.evaluate(() => {
    const el = document.querySelector(".ask-ans");
    return { cls: el.className, srcLines: el.querySelectorAll(".src-line.law").length,
             text: el.textContent };
  });
  ok(/verified/.test(ver.cls) && !/unverified/.test(ver.cls), "the verified answer is marked verified");
  ok(ver.srcLines === 1, "and carries its source row in the same style as every other legal claim");
  ok(/\b88\b/.test(ver.text), "with the article number shown");
  /* The § is a CSS pseudo-element on .src-line.law, the same one every other
     legal claim in the app uses. It was ALSO being emitted inline, so the
     citation rendered "§  84 § —". Its absence from textContent is the proof
     there is now exactly one. */
  ok(!ver.text.includes("§"),
     "and the section mark comes from the shared style, not printed twice");

  /* An article number is a number, and this app writes numbers in the reader's
     own digits everywhere else — including the counter directly below this. */
  const arArt = await p.evaluate(async () => {
    toggleLang();
    document.getElementById("askQ").value = "متى تنزل مستحقاتي؟";
    document.getElementById("askQ").dispatchEvent(new Event("input"));
    await askRun();
    const el = document.querySelector(".ask-ans .src-line.law");
    const out = el.textContent;
    toggleLang();
    return out;
  });
  /* DIGITS ARE LATIN IN BOTH LANGUAGES — a product decision, not an oversight.
     This used to assert the opposite. Readers here move between Arabic
     contracts, bank apps and government portals that mostly use Latin digits,
     and the app was inconsistent with itself anyway: the score ring stayed
     Latin while everything around it did not. What must still hold is that the
     citation is rendered in ARABIC — the article number is Latin, the words
     around it are not. */
  ok(/88/.test(arArt) && !/٨٨/.test(arArt),
     `an Arabic session cites the article in Latin digits (${arArt.slice(0, 14)})`);
  /* NOT asserted here: that the citation text itself is Arabic. It is not, and
     that is a real product gap rather than a test problem — every row in the
     verified register is English-only, so an Arabic reader who opens a source
     is shown English evidence. Asserting it would fail for the right reason
     and block every unrelated change until the register is translated, so it
     is recorded in the plan instead of pinned here. */

  reply = { tier:"unverified", answer:"Wages are generally paid monthly.", cites:[] };
  const unv = await p.evaluate(async () => {
    document.getElementById("askQ").value = "When is my wage due?";
    document.getElementById("askQ").dispatchEvent(new Event("input"));
    await askRun();
    const el = document.querySelector(".ask-ans");
    return { cls: el.className, srcLines: el.querySelectorAll(".src-line.law").length,
             text: el.textContent };
  });
  ok(/unverified/.test(unv.cls), "the unverified answer is marked unverified");
  ok(unv.srcLines === 0, "and shows no source line, because it has no source");
  ok(/not verified/i.test(unv.text) && /no article number/i.test(unv.text),
     "and says in words that we have not checked it and it carries no article number");

  /* ---- 10. the client demotes too, and renders model output as text */
  console.log("\n— the browser never upgrades what the server sent");
  reply = { tier:"verified", answer:"Trust me.", cites:[] };
  const empty = await p.evaluate(async () => {
    document.getElementById("askQ").value = "Anything?";
    document.getElementById("askQ").dispatchEvent(new Event("input"));
    await askRun();
    return document.querySelector(".ask-ans").className;
  });
  ok(/unverified/.test(empty),
     "a reply claiming verified with no sources renders as unverified even if the server let it through");

  reply = { tier:"unverified", answer:"<img src=x onerror=alert(1)> <b>bold</b>", cites:[] };
  const markup = await p.evaluate(async () => {
    document.getElementById("askQ").value = "Markup?";
    document.getElementById("askQ").dispatchEvent(new Event("input"));
    await askRun();
    const el = document.querySelector(".ask-body");
    return { html: el.innerHTML, text: el.textContent, imgs: el.querySelectorAll("img,b").length };
  });
  ok(markup.imgs === 0, "markup returned by the model becomes visible text, never DOM");
  ok(markup.text.includes("<img"), "and the reader sees exactly what was returned");

  /* ---- 11. a refusal explains itself */
  console.log("\n— a refusal says which rule refused it");
  reply = { tier:"refused", reason:"money", answer:"", cites:[] };
  const ref = await p.evaluate(async () => {
    /* Adding an assertion above spends a question and silently removes the box
       from every block below. Reset where the box is needed. */
    askUsed = { day:"", n:0 }; renderAsk();
    document.getElementById("askQ").value = "How much am I owed?";
    document.getElementById("askQ").dispatchEvent(new Event("input"));
    await askRun();
    return document.getElementById("askBody").textContent;
  });
  ok(/never computes money|riyal amount/i.test(ref),
     "a money refusal tells the reader the model never computes money here");

  /* ---- 11b. a failed send must not cost the reader twice */
  console.log("\n— a failed question keeps its text and says the attempt counted");
  reply = null;   /* fulfil with null -> unusable shape -> error path */
  const failed = await p.evaluate(async () => {
    /* The assertions above have already spent the day's five, so the box is
       gone. Reset before measuring the failure path. */
    askUsed = { day:"", n:0 }; renderAsk();
    const before = askLeft();
    document.getElementById("askQ").value = "Will this survive a failure?";
    document.getElementById("askQ").dispatchEvent(new Event("input"));
    await askRun();
    return { before, after: askLeft(), kept: askText,
             box: (document.getElementById("askQ") || {}).value,
             text: document.getElementById("askBody").textContent };
  });
  ok(failed.after === failed.before - 1, "the attempt is deducted, as designed");
  ok(/counted against today/i.test(failed.text),
     "and the reader is TOLD it was deducted, rather than watching a meter move silently");
  ok(/survive a failure/.test(failed.box || failed.kept),
     "the question they typed is still there — they do not retype it from memory");
  ok(!/score above/i.test(failed.text),
     "and the failure message does not talk about a score that is not on this screen");

  /* ---- 12. the cap is real and survives a reload */
  console.log("\n— the daily cap holds, and holds across a reload");
  const capped = await p.evaluate(async () => {
    askUsed = { day:new Date().toISOString().slice(0,10), n:99 }; saveState();
    renderAsk();
    return { left: askLeft(), hasBox: !!document.getElementById("askQ"),
             text: document.getElementById("askBody").textContent };
  });
  ok(capped.left === 0 && !capped.hasBox, "at the cap the question box is gone, not merely disabled");
  ok(/today/i.test(capped.text), "and the reader is told it resets");
  await p.reload();
  await p.waitForFunction(() => typeof window.show === "function");
  const afterReload = await p.evaluate(() => { openAsk(); return askLeft(); });
  ok(afterReload === 0, "and a reload does not hand out five more questions");

  /* A hand-edited count must not be able to disable the feature permanently
     either — the failure mode of a NaN is worse than a free question. */
  const junk = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("wodouh.v1"));
    raw.askUsed = { day:"not-a-day", n:"lots" };
    localStorage.setItem("wodouh.v1", JSON.stringify(raw));
    loadState();
    return { left: askLeft(), finite: Number.isFinite(askLeft()) };
  });
  ok(junk.finite && junk.left > 0, "a corrupted count falls back to a working state rather than a locked one");

  await b.close();

  /* ---- the dates the reader is shown must be the register's own.
   Four sources in app/index.html carry a hardcoded `reviewed:"YYYY-MM"`, and
   docs/legal-sources.md carries its own "Last reviewed" and "Law currency" in
   a markdown header. NOTHING kept them in step. Re-review the register in six
   months and the app keeps telling readers it was checked in July 2026 —
   a stale claim about currency, on a product whose entire proposition is
   being current.

   Checked as a relationship, not as two fixed strings: whatever the register
   says, the app must say the same. */
{
  const reg = readFileSync(path.join(ROOT, "docs/legal-sources.md"), "utf8");
  const src = readFileSync(path.join(ROOT, "app/index.html"), "utf8");
  console.log("\n— the app's currency claims come from the register, not from memory");

  const MONTHS = ["january","february","march","april","may","june",
                  "july","august","september","october","november","december"];
  const revd = reg.match(/Last reviewed:\s*\*\*(\d{1,2})\s+(\w+)\s+(\d{4})\*\*/i);
  ok(!!revd, `the register states when it was last reviewed${revd ? " (" + revd[0].replace(/\*/g,"") + ")" : ""}`);
  if (revd) {
    const want = revd[3] + "-" + String(MONTHS.indexOf(revd[2].toLowerCase()) + 1).padStart(2, "0");
    const stamps = [...src.matchAll(/reviewed:\s*"(\d{4}-\d{2})"/g)].map(m => m[1]);
    ok(stamps.length > 0, `the app stamps ${stamps.length} sources with a review date`);
    ok(stamps.every(d => d === want),
       `every one of them matches the register (${want})${stamps.some(d => d !== want) ? " — got " + [...new Set(stamps)].join(", ") : ""}`);
  }

  const cur = reg.match(/Law currency:\s*\*\*(\d{1,2})\s+(\w+)\s+(\d{4})\*\*/i);
  ok(!!cur, `the register states the law currency${cur ? " (" + cur[0].replace(/\*/g,"") + ")" : ""}`);
  if (cur) {
    const month = cur[2], year = cur[3];
    /* Both languages: a currency claim that is right in English and stale in
       Arabic is stale for most of this product's readers. */
    ok(new RegExp(month + "\\s+" + year, "i").test(src),
       `the English copy names the same currency date (${month} ${year})`);
    const AR = { february:"فبراير", january:"يناير", march:"مارس", april:"أبريل", may:"مايو",
                 june:"يونيو", july:"يوليو", august:"أغسطس", september:"سبتمبر",
                 october:"أكتوبر", november:"نوفمبر", december:"ديسمبر" };
    const arm = AR[month.toLowerCase()];
    ok(!!arm && src.includes(arm + " " + year),
       `and the Arabic copy names it too (${arm || "?"} ${year})`);
  }
}

console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\nall grounded-answer checks passed");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
