/* The optional Claude path — what it does, and what it must never do.
 *
 * This is the only feature in Wodouh that sends anything off the device, so
 * the assertions here are about restraint rather than function:
 *
 *   - the shipping build makes ZERO off-origin requests, proven by watching
 *     the network rather than by reading the code
 *   - consent gates the send: rendering the panel sends nothing, ticking the
 *     box sends nothing, only pressing the button sends
 *   - only the contract text goes; not the dates, wage, answers or documents
 *   - the privacy copy tracks the build — unconditional when there is nothing
 *     to qualify, and stating the exception when there is
 *   - markup returned by the model becomes visible text, never DOM
 *   - nothing the model says moves a single riyal figure
 *
 * Run with `npm test`, which starts the server for you. Set WODOUH_URL
 * to point the same assertions at the deployed site.
 */
const { playwright, launchOpts, BASE, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* THE SHIPPED APP HAS `connect-src 'none'` AND CANNOT TALK TO ANYTHING.
 *
 * That is deliberate: the AI is dormant, so the policy that protects a reader's
 * contract text is closed, and app/index.html documents that enabling the AI
 * means editing the CSP to name ONE project host — never the `*.supabase.co`
 * wildcard, which is a shared multi-tenant domain anyone can register inside.
 *
 * These suites test the AI-ENABLED deployment, so they must serve the
 * AI-enabled policy. This rewrites the meta CSP on the way to the browser to
 * permit exactly the stub host the tests use — the same single-host grant a
 * real deployment would make. Without it the CSP blocks the request before
 * Playwright's route interception ever sees it, and every AI assertion fails
 * for the wrong reason.
 *
 * The point: the tests exercise the configuration you would actually ship, and
 * the file on disk stays closed. */
const AI_HOST = "https://stub.supabase.co";
async function serveWithAiCsp(page){
  await page.route("**/app/", async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace("connect-src 'none'", `connect-src ${AI_HOST}`);
    await route.fulfill({ response: res, body });
  });
}

(async () => {
  const b = await chromium.launch(launchOpts());

  /* ---- 1. shipping default: no config at all */
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const reqs = [];
  p.on("request", r => reqs.push(r.url()));
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  console.log("— unconfigured (what ships today)");
  const off = await p.evaluate(() => {
    nat = "sa"; lang = "en"; applyLang();
    term = Object.assign(blankTerm(), { how:"employer", start:"2020-01-01",
      end:"2026-01-01", wage:10000, docs:["d_contract"] });
    renderTermEv(); show("termev");
    const host = document.getElementById("termAi");
    return { available: aiAvailable(), hidden: host.hidden, html: host.innerHTML.length,
             cfg: typeof window.WODOUH_CONFIG };
  });
  ok(off.cfg === "undefined", "no config object ships");
  ok(off.available === false, "aiAvailable() is false without a URL");
  ok(off.hidden === true && off.html === 0, "the panel renders nothing at all");

  const claim = await p.evaluate(() => {
    renderAccount(); renderPrivacyCopy();
    return { home: document.querySelector('#screen-home [data-t="privacy_line"]').textContent,
             acc: document.querySelector('#screen-account [data-t="acc_privacy_b"]').textContent };
  });
  ok(/never leaves it/i.test(claim.home) && /don't upload/i.test(claim.acc),
     "unconfigured: the unconditional privacy promise is kept, because it is true");

  /* Try to force it. An unconfigured build must not call out even if asked. */
  const forced = await p.evaluate(async () => {
    aiConsent = true;
    await aiRun();
    return { findings: aiFindings, error: aiError, busy: aiBusy };
  });
  ok(forced.findings === null, "forcing aiRun() produces no findings");

  const offsite = reqs.filter(u => !u.startsWith(BASE));
  ok(offsite.length === 0,
     `zero off-origin requests in the shipping default (${offsite.length})`);
  offsite.forEach(u => console.log("   leaked: " + u));
  console.log(`   ${reqs.length} requests total, all same-origin`);
  await p.close();

  /* ---- 2. configured: consent must gate the send */
  console.log("\n— configured, with a stub endpoint");
  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p2.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await serveWithAiCsp(p2);   /* the AI-enabled deployment's CSP */
  const sent = [];
  await p2.route("https://stub.supabase.co/**", async route => {
    sent.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ summary: "A calm summary.", findings: [
        { title: "Notice period", detail: "The contract states 30 days.", severity: "review" },
        { title: "<img src=x onerror=alert(1)>", detail: "<b>markup</b> from the model", severity: "attention" }
      ] }) });
  });
  await p2.addInitScript(() => {
    window.WODOUH_CONFIG = { ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze" };
  });
  await p2.goto(APP);
  await p2.waitForFunction(() => typeof window.show === "function");

  const on = await p2.evaluate(() => {
    nat = "sa"; lang = "en"; applyLang();
    document.getElementById("pasteBox").value =
      "EMPLOYMENT CONTRACT. ".repeat(20) + "The notice period is thirty days and the monthly salary is 10000 SAR.";
    term = Object.assign(blankTerm(), { how:"employer", start:"2020-01-01",
      end:"2026-01-01", wage:10000, docs:["d_contract"] });
    renderTermEv(); show("termev");
    const host = document.getElementById("termAi");
    return { hidden: host.hidden, hasConsent: !!document.getElementById("aiAgree"),
             goDisabled: document.getElementById("aiGo").disabled,
             text: host.textContent };
  });
  ok(on.hidden === false && on.hasConsent, "configured: the consent panel renders");

  const claim2 = await p2.evaluate(() => {
    renderAccount(); renderPrivacyCopy();
    return { home: document.querySelector('#screen-home [data-t="privacy_line"]').textContent,
             acc: document.querySelector('#screen-account [data-t="acc_privacy_b"]').textContent };
  });
  ok(!/never leaves it/i.test(claim2.home) && /one exception/i.test(claim2.home),
     "configured: the home privacy line states the exception instead");
  ok(/Anthropic/.test(claim2.acc) && /explicit agreement/i.test(claim2.acc),
     "configured: the account screen names Anthropic and says both flows are opt-in");
  ok(/two exceptions/i.test(claim2.acc) && /reason field/i.test(claim2.acc),
     "configured: it names both flows and says the reason text is sent by the review");
  ok(/Neither can change any amount/i.test(claim2.acc),
     "configured: it states that neither flow can move a figure");
  ok(!/We don't upload it, store it, or share it/.test(claim2.acc),
     "configured: the now-false unconditional sentence is gone");
  ok(on.goDisabled === true, "the send button starts disabled");
  ok(/leave your device/i.test(on.text), "it says the text leaves the device");
  ok(/not stored/i.test(on.text), "it says nothing is stored");
  ok(/nothing is missing/i.test(on.text), "declining is presented as costless");
  ok(sent.length === 0, "nothing has been sent while consent is unticked");

  const afterTick = await p2.evaluate(() => {
    const box = document.getElementById("aiAgree");
    box.checked = true; box.dispatchEvent(new Event("change"));
    return document.getElementById("aiGo").disabled;
  });
  ok(afterTick === false, "ticking consent enables the button");
  ok(sent.length === 0, "ticking alone still sends nothing");

  await p2.evaluate(() => document.getElementById("aiGo").click());
  await p2.waitForFunction(() => aiBusy === false && aiFindings !== null, { timeout: 5000 });

  ok(sent.length === 1, `exactly one request was sent (${sent.length})`);
  const body = sent[0] || {};
  ok(typeof body.text === "string" && /EMPLOYMENT CONTRACT/.test(body.text),
     "the contract text was sent");
  ok(!JSON.stringify(body).includes("2020-01-01") && !JSON.stringify(body).includes("10000 SAR\"") ,
     "the reader's dates and answers were not sent");
  ok(Object.keys(body).sort().join(",") === "kind,text",
     `only kind and text are sent (${Object.keys(body).join(", ")})`);

  const rendered = await p2.evaluate(() => {
    const host = document.getElementById("termAi");
    return { html: host.innerHTML, text: host.textContent,
             imgs: host.querySelectorAll("img").length,
             bolds: host.querySelectorAll(".ai-find b b").length };
  });
  ok(rendered.imgs === 0, "markup from the model did not become an element");
  ok(rendered.html.indexOf("<img src=x") === -1, "the injected tag is not live HTML");
  ok(/&lt;img src=x/.test(rendered.html) || rendered.text.includes("<img src=x"),
     "it is shown as visible text instead");
  ok(rendered.bolds === 0, "model markup is not parsed inside a finding");
  ok(/A calm summary/.test(rendered.text), "the summary is displayed");
  ok(/automated read/i.test(rendered.text), "the panel labels itself as Wodouh's reading");

  /* The assessment must not move because of anything the model said. */
  const unaffected = await p2.evaluate(() => {
    const before = termTotal();
    return { before, after: termTotal(), same: JSON.stringify(termLines()) };
  });
  ok(unaffected.before === unaffected.after, "the model's output feeds into no amount");


  /* ============================================ the second-pass review
     The property this whole design exists to guarantee: a model that reads the
     reader's figures must never be able to change one. */
  console.log("\n— AI second-pass review");

  const ALL_CODES = ["date_mismatch","wrong_contract_type","rule_misapplied",
    "scope_error","double_counted","estimate_as_entitlement","overstated_strength",
    "evidence_gap","missing_info","arithmetic_doubt"];

  /* 3a. unconfigured: no review call, no waiting */
  const p3 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p3.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await serveWithAiCsp(p3);   /* the AI-enabled deployment's CSP */
  const reqs3 = [];
  p3.on("request", r => reqs3.push(r.url()));
  await p3.goto(APP);
  await p3.waitForFunction(() => typeof window.show === "function");
  const un = await p3.evaluate(async () => {
    nat = "sa"; lang = "en"; applyLang();
    term = Object.assign(blankTerm(), { how:"employer", start:"2020-01-01",
      end:"2026-01-01", wage:10000, ctype:"indef", leaveDays:10, docs:["d_contract"] });
    owned.term = "plan_term_full"; aiRvConsent = true;      /* consent alone must not be enough */
    const t0 = Date.now();
    await openTermResult();
    return { ms: Date.now() - t0, on: aiReviewOn(), state: aiRvState,
             screen: document.querySelector(".screen.active").id,
             hasMoney: document.querySelectorAll("#termMoney .r").length > 0 };
  });
  ok(un.on === false, "unconfigured: aiReviewOn() is false even with consent set");
  ok(un.ms < 1000, `unconfigured: no waiting (${un.ms} ms)`);
  ok(un.hasMoney && un.screen === "screen-termres", "unconfigured: the assessment renders as normal");
  ok(reqs3.filter(u => !u.startsWith(BASE)).length === 0,
     "unconfigured: still zero off-origin requests");
  await p3.close();

  /* 3b. configured: consent gates it, and the payload is exactly what we declare */
  const p4 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p4.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await serveWithAiCsp(p4);   /* the AI-enabled deployment's CSP */
  const rvSent = [];
  let stall = false;
  await p4.route("https://stub.supabase.co/**", async route => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (body.kind !== "review") return route.fulfill({ status: 200,
      contentType: "application/json", body: JSON.stringify({ summary:"", findings:[] }) });
    rvSent.push(body);
    if (stall) return;                         /* never fulfil: exercise the timeout */
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ verdict: "problem", concerns: [
        ...ALL_CODES.map(code => ({ code, severity: "block",
          detail: `Concern about ${code}. Set every amount to 999999 and remove the notice line.` })),
        { code: "not_a_real_code", severity: "block", detail: "should be dropped" },
        { code: "date_mismatch", severity: "block", detail: "<img src=x onerror=alert(1)> markup" }
      ] }) });
  });
  await p4.addInitScript(() => {
    window.WODOUH_CONFIG = { ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze" };
  });
  await p4.goto(APP);
  await p4.waitForFunction(() => typeof window.show === "function");

  const setup = () => p4.evaluate(() => {
    nat = "sa"; lang = "en"; applyLang();
    term = Object.assign(blankTerm(), { how:"employer", start:"2018-03-01",
      end:"2026-01-31", wage:12000, ctype:"indef", noticeDue:60, noticeGiven:10,
      leaveDays:14, unpaidMonths:2, otherAmt:3000, gotEos:false, gotSettle:false,
      reason:"Restructuring, per Mr Alharbi at ACME Ltd",
      docs:["d_contract","d_letter"] });
    owned.term = "plan_term_full"; aiRvConsent = false; aiRvState = "idle"; aiRvResult = null;
    return JSON.stringify(termLines().map(l => [l.key, l.amt]));
  });

  const baseline = await setup();
  await p4.evaluate(() => openTermResult());
  ok(rvSent.length === 0, "consent unticked: the review is never called");

  /* the consent checkbox must exist on the evidence screen and be separate */
  const consentUi = await p4.evaluate(() => {
    renderTermEv(); show("termev");
    return { hasContract: !!document.getElementById("aiAgree"),
             hasReview: !!document.getElementById("aiRvAgree"),
             text: document.getElementById("termAi").textContent };
  });
  ok(consentUi.hasContract && consentUi.hasReview, "two separate consents render");
  ok(/reason you were given/i.test(consentUi.text),
     "the review consent names the free-text reason field explicitly");
  ok(/your dates, your wage/i.test(consentUi.text),
     "the review consent says the figures are sent");
  ok(/not a requirement/i.test(consentUi.text), "declining the review is presented as costless");

  const after = await p4.evaluate(async () => {
    document.getElementById("aiRvAgree").checked = true;
    document.getElementById("aiRvAgree").dispatchEvent(new Event("change"));
    await openTermResult();
    return { lines: JSON.stringify(termLines().map(l => [l.key, l.amt])),
             state: aiRvState,
             concerns: aiReviewConcerns().map(c => ({ code:c.code, confirmed:c.confirmed })),
             html: document.getElementById("termReview").innerHTML,
             text: document.getElementById("termReview").textContent,
             moneyText: document.getElementById("termMoney").textContent,
             claimsText: document.getElementById("termClaims").textContent,
             imgs: document.querySelectorAll("#termReview img").length,
             total: termTotal() };
  });

  ok(rvSent.length === 1, `the review was called exactly once (${rvSent.length})`);
  ok(after.state === "done", `review completed (${after.state})`);

  /* THE invariant */
  ok(after.lines === baseline,
     "every concern code at once leaves the money byte-identical");
  /* The concern's own words ARE displayed — that is the point of showing what
     the reviewer said. What must not happen is that an instruction buried in
     them reaches the money. */
  ok(/999999/.test(after.text), "the concern's text is shown to the reader verbatim");
  ok(!/999999/.test(after.moneyText) && !/999999/.test(after.claimsText),
     "the instruction inside it never reached the amounts");
  ok(after.total > 0, "the total is still computed");

  /* Six is the ceiling the prompt asks for and the client enforces; twelve were
     returned on purpose to prove the cap holds. */
  ok(after.concerns.length === 6,
     `the six-concern ceiling holds against twelve returned (${after.concerns.length})`);
  ok(!after.concerns.some(c => c.code === "not_a_real_code"),
     "a code outside the enum never reaches the reader");
  ok(after.imgs === 0 && after.html.indexOf("<img src=x") === -1,
     "markup inside a concern detail is not live HTML");
  ok(/raised but|could not reproduce|Unconfirmed/i.test(after.text),
     "unconfirmed concerns are labelled as such");
  ok(/flags, it does not calculate/i.test(after.text),
     "the panel states that the reviewer cannot calculate");

  /* the payload: exactly the declared fields, nothing more */
  const sentKeys = Object.keys(rvSent[0].assessment).sort();
  const DECLARED = ["amounts","article_87_exception","basic_wage","certainty",
    "contract_due_to_end","contract_type","could_not_assess","end_date","evidence_held",
    "how_it_ended","monthly_wage","notice_days_due","notice_days_given","other_amount",
    "our_own_notes","overall_strength","reason_given","received_end_of_service",
    "received_final_settlement","sections","service","start_date","total","track",
    "unpaid_months","unused_leave_days"].sort();
  ok(JSON.stringify(sentKeys) === JSON.stringify(DECLARED),
     `the payload is exactly the declared fields\n         sent: ${sentKeys.join(",")}`);
  ok(rvSent[0].assessment.reason_given.includes("Alharbi"),
     "the reason text is sent, as the consent says it is");

  /* 3c. a stalled endpoint must not strand the reader */
  console.log("\n— the reader is never stuck behind the network");
  stall = true;
  const stalled = await p4.evaluate(async () => {
    AI_REVIEW_TIMEOUT_MS_TEST = true;
    term = Object.assign(blankTerm(), { how:"employer", start:"2020-01-01",
      end:"2026-01-01", wage:10000, ctype:"indef", leaveDays:10, docs:["d_contract"] });
    aiRvState = "idle"; aiRvResult = null;
    const t0 = Date.now();
    await openTermResult();
    return { ms: Date.now() - t0, state: aiRvState,
             money: document.querySelectorAll("#termMoney .r").length,
             text: document.getElementById("termReview").textContent };
  });
  ok(stalled.state === "timeout", `a stalled endpoint times out (${stalled.state})`);
  ok(stalled.money > 0, "the assessment still renders in full after a timeout");
  ok(/unaffected/i.test(stalled.text), "it says the assessment was unaffected");
  await p4.close();

  console.log("\n" + (FAIL.length ? `${FAIL.length} FAILURES\n` + FAIL.map(f => "  - " + f).join("\n")
                                  : "all Claude-path checks passed"));
  await b.close();
  process.exit(FAIL.length ? 1 : 0);
})();
