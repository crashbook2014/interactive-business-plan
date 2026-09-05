/* DOES THE MODEL ACTUALLY GET THE READER'S CONTRACT?
 *
 * Everything else about the AI path is asserted elsewhere: that an
 * unconfigured build sends nothing (claude-path), that consent gates the send
 * (ask, claude-path), that model output cannot move a riyal (claude-path,
 * contract-review). Nobody had checked the plainest question of all — when the
 * app says "a closer read of your contract", do the contract's own words reach
 * the request, or does the reader get a general answer wearing a personal
 * label?
 *
 * That question cannot be answered by reading the code and it must never be
 * answered by calling Anthropic: a live call costs the owner money, and a
 * response that reads well is not evidence that the document arrived. So this
 * suite intercepts the outbound request and reads the BYTES THE APP BUILT.
 * Nothing here touches the network beyond the page's own origin — the stub
 * host is fulfilled by Playwright, never dialled.
 *
 * The three things it pins:
 *
 *   1. THE DOCUMENT REACHES THE REQUEST. A synthetic contract carrying five
 *      distinctive markers is pasted, analysed, and every marker is found in
 *      the request body. Both document modes are checked, because they are
 *      two separate call sites (aiRun -> kind "contract", crRun -> kind
 *      "contract_review") and only one of them being wired would be invisible.
 *
 *   2. IT IS NOT QUIETLY SHORTENED. A contract comfortably under the server's
 *      documented 40,000-character ceiling arrives whole — same length, same
 *      last line. A summarising or head-only client would still "work", and
 *      the reader would never learn that clause 41 was never read.
 *
 *   3. ASK SENDS NO DOCUMENT — AND THAT IS THE HONEST, CURRENT STATE.
 *      The question box answers from Wodouh's verified legal register, not
 *      from the reader's own contract, and its consent copy says exactly that.
 *      askCtx() sends the termination CASE (dates, wage, contract type), never
 *      contract text. So "ask a question about MY contract" is a roadmap item,
 *      not a shipped feature, and this suite states it as one. If someone
 *      later wires the document into the ask payload, the assertions below
 *      fail loudly — which is the point. Do not delete them to make them pass:
 *      the consent string on that screen ("Your question, exactly as you typed
 *      it, and nothing else") becomes false in the same commit, and both have
 *      to be changed together, deliberately.
 *
 * Run with `npm test`, which starts the server for you. Set WODOUH_URL to
 * point the same assertions at the deployed site.
 */
const fs = require("node:fs");
const path = require("node:path");
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const AI_HOST = "https://stub.supabase.co";

/* The five markers. Deliberately mundane and deliberately spread through the
   document: each one is a fact a reader would expect a "closer read" to have
   seen, and each one is unique enough that finding it in the request body
   cannot be a coincidence of boilerplate. */
const MARKERS = [
  "Employee name: Test Employee",
  "Monthly salary: 17,500 SAR",
  "Probation period: 90 days",
  "Notice period: 60 days",
  "Annual leave: 30 days",
];

/* A plausible contract with the markers scattered through it rather than
   stacked at the top — a client that sent only the first paragraph would pass
   a test built on a header block, and that is precisely the failure worth
   catching. */
const CONTRACT = [
  "EMPLOYMENT CONTRACT",
  "This agreement is made between Falcon Industrial Services Company (the Employer)",
  "and the Employee named below, under the Saudi Labor Law (Royal Decree M/51).",
  "",
  "1. PARTIES",
  MARKERS[0],
  "Position: Site Engineer. Place of work: Dammam, Eastern Province.",
  "",
  "2. TERM",
  "This is a fixed-term contract of two Gregorian years, renewable by agreement.",
  MARKERS[2],
  "During probation either party may end this contract without award.",
  "",
  "3. REMUNERATION",
  MARKERS[1],
  "Housing allowance is included in the figure above. Transport is not provided.",
  "",
  "4. WORKING HOURS AND LEAVE",
  "Forty-eight hours per week, six days, with Friday as the weekly rest day.",
  MARKERS[4],
  "Leave is scheduled at the Employer's discretion and may not be carried over.",
  "",
  "5. ENDING THIS CONTRACT",
  MARKERS[3],
  "The Employee waives any claim to an end-of-service award if they resign.",
  "",
  "6. AFTER EMPLOYMENT",
  "The Employee shall not work for any competitor in the Kingdom for 24 months.",
].join("\n");

/* Whatever the CSP currently is, replaced with a single-host grant to the stub
   — the same shape a real deployment makes, and lifted from claude-path.test.js
   for the same reason it exists there: without it the browser blocks the
   request before route interception can see it, and every assertion in this
   file fails for a reason that has nothing to do with contracts. */
async function serveWithAiCsp(page) {
  await page.route("**/app/", async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace(/connect-src [^;]*/, `connect-src ${AI_HOST}`);
    await route.fulfill({ response: res, body });
  });
}

(async () => {
  /* ---- 1. the ceiling this suite measures against
   *
   * Read from the two files rather than hard-coded, because a limit that lives
   * in a test's own constant is a limit that stops describing the product the
   * moment someone changes it. The client slices to exactly the server's
   * MAX_TEXT; if those two ever drift apart, the reader gets a 413 on a
   * document the app told them it had sent. */
  console.log("— the documented limit, read from the code that enforces it");
  const fn = fs.readFileSync(
    path.join(__dirname, "..", "supabase", "functions", "analyze", "index.ts"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");

  const serverMax = Number((fn.match(/const MAX_TEXT = ([\d_]+)/) || [])[1]?.replace(/_/g, ""));
  ok(serverMax === 40000, `the server documents a ${serverMax}-character ceiling for a document`);
  /* The client's ceiling now lives in one named constant instead of being
     written out at each call site — which is the shape that made the two
     drift-able in the first place. The assertion follows the constant rather
     than the literal, so it still fails if the client and the server disagree
     and no longer fails merely because the duplication was removed. */
  const clientMax = Number((app.match(/const AI_MAX = (\d+)/) || [])[1]);
  ok(clientMax === serverMax,
     `and the client's own ceiling matches it exactly (AI_MAX = ${clientMax})`);
  const cutCalls = (app.match(/aiCut\(text\)/g) || []).length;
  ok(cutCalls >= 2, `both document call sites go through that one helper (${cutCalls})`);
  ok(!/text\.slice\(0,\s*40000\)/.test(app),
     "and no call site slices to a hardcoded 40000 behind the helper's back");
  /* Over the ceiling the server refuses rather than reading half a contract.
     That is the honest behaviour and it is what makes the client-side slice
     the thing worth watching — see part 4. */
  ok(/too_large.*max: MAX_TEXT.*413|max: MAX_TEXT \}, 413/s.test(fn),
     "and over it the server returns 413 rather than silently analysing a fragment");

  /* The ask mode's user block, read out of the server. It is built from the
     question and an optional <case> block, and there is no branch in it that
     can produce a <document>. This is the server half of point 3 above. */
  const askBlock = (fn.match(/userContent = `<question>[^`]*`/) || [])[0] || "";
  ok(askBlock.includes("<question>") && !askBlock.includes("<document>"),
     `ask mode's user block carries the question and nothing document-shaped (${askBlock.trim()})`);

  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await serveWithAiCsp(p);

  /* Every request the app makes to the analyze endpoint, as the app built it.
     The reply is deliberately minimal — enough shape for the client's own
     coercion to accept it, nothing more. Nothing about the response is under
     test here; the request is. */
  const sent = [];
  await p.route(`${AI_HOST}/**`, async route => {
    const body = JSON.parse(route.request().postData() || "{}");
    sent.push(body);
    const reply =
      body.kind === "contract_review"
        ? { contract_meta: { extraction_confidence: "high" }, key_terms: {},
            red_flags: [], negotiation_points: [], summary_en: "ok", summary_ar: "ok",
            dropped: { findings: 0, terms: [] } }
        : body.kind === "ask"
        ? { tier: "unverified", answer: "General guidance.", cites: [] }
        : { summary: "A calm summary.", findings: [] };
    await route.fulfill({ status: 200, contentType: "application/json",
                          body: JSON.stringify(reply) });
  });
  await p.addInitScript(() => {
    window.WODOUH_CONFIG = { ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze" };
  });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* ---- 2. the closer read: does the document reach the request? */
  console.log("\n— a closer read of the contract (kind: contract)");
  await p.evaluate(async (text) => {
    lang = "en"; applyLang(); nat = "sa";
    document.getElementById("pasteBox").value = text;
    term = Object.assign(blankTerm(), { how: "employer", start: "2020-01-01",
      end: "2026-01-01", wage: 10000, docs: ["d_contract"] });
    aiConsent = true;
    await aiRun();
  }, CONTRACT);

  ok(sent.length === 1, `exactly one request was sent (${sent.length})`);
  const doc = sent[0] || {};
  ok(doc.kind === "contract", `it is the document mode (kind: ${doc.kind})`);
  /* THE HEADLINE ASSERTION OF THIS FILE. Not "a request was made" and not
     "the response looked plausible" — the reader's own words, byte for byte,
     in the body the app produced. */
  const missing = MARKERS.filter(m => !String(doc.text || "").includes(m));
  ok(missing.length === 0,
     `every marker from the contract is in the request body (${MARKERS.length - missing.length}/${MARKERS.length})`);
  missing.forEach(m => console.log("   absent: " + m));
  /* Whole, not headed. The last clause is the non-compete, which is both the
     furthest thing from the top and the one a worker most needs read. */
  ok(String(doc.text || "").includes("shall not work for any competitor"),
     "including the last clause in the document, so this is the whole contract and not its first page");
  ok(doc.text.length === CONTRACT.length,
     `and it is exactly the length that was pasted (${doc.text.length} of ${CONTRACT.length})`);

  /* ---- 3. the pre-signing review is a second, separate call site */
  console.log("\n— the pre-signing review (kind: contract_review)");
  sent.length = 0;
  await p.evaluate(async () => { aiConsent = true; await crRun(); });
  const cr = sent[0] || {};
  ok(sent.length === 1 && cr.kind === "contract_review",
     `the pre-signing review sends its own request (kind: ${cr.kind})`);
  const crMissing = MARKERS.filter(m => !String(cr.text || "").includes(m));
  ok(crMissing.length === 0,
     `it carries the same document, whole (${MARKERS.length - crMissing.length}/${MARKERS.length} markers)`);
  /* The reader's track travels as context and is a closed value — a resident
     and a Saudi must not get the same findings on a passport-retention clause.
     Checked here because it rides on this payload and nothing else asserts
     that it actually leaves. */
  ok(cr.nat === "sa" || cr.nat === "nonsa", `and the reader's track, as a closed value (${cr.nat})`);

  /* ---- 4. not silently shortened below the ceiling, and honest at it */
  console.log("\n— length: whole under the ceiling, cut at it");
  sent.length = 0;
  /* Comfortably under 40,000 so the slice cannot be what preserves it, and
     with the markers at the very END, where a truncating client would lose
     them first. A contract this long is not unusual: a bilingual one runs to
     two columns of everything. */
  const filler = ("Clause text of no particular interest. ").repeat(600);
  const LONG = filler + "\n" + CONTRACT;
  await p.evaluate(async (text) => {
    document.getElementById("pasteBox").value = text;
    aiConsent = true;
    await aiRun();
  }, LONG);
  const long = sent[0] || {};
  ok(long.text === LONG,
     `a ${LONG.length}-character contract arrives byte-identical — no truncation, no summary, no sampling`);
  const longMissing = MARKERS.filter(m => !String(long.text || "").includes(m));
  ok(longMissing.length === 0,
     "and the markers at its very end survive, which is where a head-only send would drop them");

  /* WHAT HAPPENS ABOVE THE CEILING. This assertion was written to pin the old
     behaviour rather than endorse it: the client sliced to 40,000 and said
     nothing, so a reader who pasted a 45,000-character bilingual contract was
     analysed on the first 89% of it and shown a finished result with a score
     on it. The last pages of an employment contract are where the non-compete
     and the penalty clauses usually sit, so the silent part was the expensive
     part. It said the day someone fixed it they would have to come here and
     say so on purpose. This is that edit.

     The cut stays — rejecting a long contract outright helps nobody, and a
     legitimate contract can exceed the ceiling — but it is now declared on
     screen, above the findings rather than below them, naming both the number
     of characters read and where the missing part falls. Same rule the
     assessment already follows when it lists what it could not evaluate:
     absence is reported, never hidden. */
  sent.length = 0;
  const OVER = "A".repeat(45000);
  const over = await p.evaluate(async (text) => {
    document.getElementById("pasteBox").value = text;
    aiConsent = true;
    await aiRun();
    const note = document.querySelector("#termAi .ai-cut");
    const findings = document.querySelector("#termAi .ai-find, #termAi .ai-summary");
    return {
      shown: !!note,
      text: note ? note.textContent : "",
      /* Above the findings: a reader who learns the document was cut only
         after reading eight findings has already formed a view. */
      before: !!(note && findings &&
                 (note.compareDocumentPosition(findings) & Node.DOCUMENT_POSITION_FOLLOWING))
    };
  }, OVER);
  ok((sent[0] || {}).text.length === serverMax,
     `above the ceiling the client still cuts to ${serverMax}, because the server refuses more`);
  ok(over.shown === true, "but it now says so on screen instead of showing a silent partial read");
  ok(over.before === true, "and says it above the findings, not after them");
  ok(over.text.includes("45,000") || over.text.includes("٤٥٬٠٠٠"),
     `naming the true length of what was pasted, so the reader can judge what is missing (${over.text.slice(0, 60)})`);

  /* And the notice must NOT appear for a document that fitted — a warning that
     cries wolf on every analysis teaches the reader to ignore it. */
  sent.length = 0;
  const under = await p.evaluate(async (text) => {
    document.getElementById("pasteBox").value = text;
    aiConsent = true;
    await aiRun();
    return !!document.querySelector("#termAi .ai-cut");
  }, CONTRACT);
  ok(under === false, "and stays silent when the whole contract fitted");

  /* ---- 5. Ask: the question goes, the contract does not */
  console.log("\n— asking a question sends the question, not the contract");
  sent.length = 0;
  await p.evaluate(async (text) => {
    /* PUT THE MARKED CONTRACT BACK FIRST. The length checks above left filler
       in the paste box, and a leak check run against a box full of "AAAA" is a
       check that can never fail — it would report "no marker leaked" while the
       app cheerfully shipped the whole document. Asserting on markers that are
       not on the device at the time is the way this suite would rot into
       decoration, so the state it measures is set explicitly here.
       This is also the condition under which a reader would most reasonably
       assume the question is being answered from their contract: it is loaded,
       it is analysed, and it is on the screen behind them. */
    document.getElementById("pasteBox").value = text;
    show("rights");
    openAsk();
    const q = document.getElementById("askQ");
    q.value = "Is my 90-day probation period allowed?";
    q.dispatchEvent(new Event("input"));
    const box = document.getElementById("askAgree");
    box.checked = true; box.dispatchEvent(new Event("change"));
    await askRun();
  }, CONTRACT);
  ok(sent.length === 1 && sent[0].kind === "ask", "the question is sent as an ask");
  /* The guard on the guard: the document really is on the device at this
     moment, so the absence checks below are absences and not vacancies. */
  const loaded = await p.evaluate(() => document.getElementById("pasteBox").value);
  ok(MARKERS.every(m => loaded.includes(m)),
     "the contract is loaded on the device while the question is asked");
  const askWire = JSON.stringify(sent[0] || {});
  /* THE DOCUMENTED, HONEST STATE. The ask consent says "your question, exactly
     as you typed it, and nothing else", and the screen promises answers from
     the Saudi Labor Law as far as Wodouh has verified it — not from the
     reader's own contract. This is that promise, checked against the wire.
     A failure here means one of two things, and both need a human:
       - the contract was wired into ask, and the consent copy on that screen
         is now false and must be rewritten in the same commit; or
       - something else began leaking document text into a payload that the
         reader was told carries only a sentence.
     Contract-grounded Q&A is a roadmap item. Until it ships WITH the copy
     that discloses it, this must hold. */
  const leaked = MARKERS.filter(m => askWire.includes(m));
  ok(leaked.length === 0,
     `no marker from the contract appears anywhere in the ask payload (${leaked.length} leaked)`);
  leaked.forEach(m => console.log("   leaked: " + m));
  ok(!askWire.includes("EMPLOYMENT CONTRACT") && !askWire.includes("competitor"),
     "and no clause text of any kind rides along with it");
  ok(Object.keys(sent[0] || {}).sort().join(",") === "kind,lang,q",
     `the whole payload is the question, its language and the mode (${Object.keys(sent[0] || {}).join(", ")})`);

  /* ---- 6. and the same holds with case details attached
   *
   * The second tick box on that screen sends askCtx(): dates, wage, contract
   * type, how it ended. That is materially more than the question — and it is
   * still not the contract. Worth its own assertion because "we already send
   * the case" is exactly the reasoning by which document text would one day be
   * folded into the same object without anyone noticing. */
  console.log("\n— and with case details ticked, it is still the case and not the contract");
  sent.length = 0;
  await p.evaluate(async () => {
    askAnswer = null; askError = null; renderAsk();
    const q = document.getElementById("askQ");
    q.value = "Is my 60-day notice period allowed?";
    q.dispatchEvent(new Event("input"));
    const agree = document.getElementById("askAgree");
    agree.checked = true; agree.dispatchEvent(new Event("change"));
    const ctx = document.getElementById("askCtxAgree");
    ctx.checked = true; ctx.dispatchEvent(new Event("change"));
    await askRun();
  });
  const withCtx = sent[0] || {};
  ok(!!withCtx.ctx, "the case details are attached when the second box is ticked");
  const ctxWire = JSON.stringify(withCtx.ctx || {});
  ok(MARKERS.every(m => !ctxWire.includes(m)) && !/probation|competitor|Falcon/i.test(ctxWire),
     `and the case is dates, wage and contract type — no clause, no quote (${Object.keys(withCtx.ctx || {}).join(", ")})`);

  await p.close();
  await b.close();

  console.log("\n" + (FAIL.length
    ? `${FAIL.length} FAILURES\n` + FAIL.map(f => "  - " + f).join("\n")
    : "the document reaches the request whole; the question box does not carry it — which is what the consent on that screen says"));
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
