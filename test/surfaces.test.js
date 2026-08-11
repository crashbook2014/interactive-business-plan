/* Surface sweep.
 *
 * The calculation fuzzer covers the arithmetic and the routing suites cover the
 * assistant. This covers the screens neither touches: the letter builder and
 * its selective assembly, paywall plan selection, termination triage, the
 * case-file checklist, the business tier, photo intake, the unreadable path and
 * the clause list.
 *
 * It found two latent traps, both of which rendered "undefined" to the reader
 * once the surrounding limits moved: a nine-slot Arabic numeral table used to
 * number an unbounded list, and a plan index carried across two plan lists of
 * different lengths. Neither was reachable at the time — both were within two
 * rules of being so, which is why the assertions test the boundary rather than
 * today's value.
 *
 * Run with `npm test`, which starts the server for you. Set WODOUH_URL
 * to point the same assertions at the deployed site.
 */
const { playwright, launchOpts, BASE, APP } = require("./_env.js");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* ---------------------------------------------- letter builder */
  console.log("\n— letter builder / selective assembly");

  const many = await p.evaluate(() => {
    /* Twelve negotiable clauses — more than the nine Arabic numerals in
       AR_NUM. Nothing stops a real contract producing this many. */
    current = { doc: "doc_emp", score: 40, clauses: [] };
    for (let i = 0; i < 40; i++)
      current.clauses.push({ id: "x" + i, s: "amber", q: null,
        t: { ar: "بند " + i, en: "Clause " + i },
        p: { ar: "وصف", en: "desc" },
        a: { ar: "نصيحة " + i, en: "Advice " + i } });
    current.verdict = { ar: "تحقق", en: "Check" };
    letterSet = new Set(current.clauses.map((c, i) => i));
    return { n: selected().length, letter: buildLetter() };
  });
  ok(many.n === 40, `40 clauses selected (got ${many.n})`);
  ok(!/undefined/.test(many.letter),
     "English letter has no undefined text\n         " +
     (many.letter.split("\n").filter(l => /undefined/.test(l))[0] || ""));

  const arLetter = await p.evaluate(() => { lang = "ar"; applyLang(); return buildLetter(); });
  ok(!/undefined/.test(arLetter),
     "Arabic letter has no undefined text — AR_NUM covers every point\n         " +
     (arLetter.split("\n").filter(l => /undefined/.test(l))[0] || ""));
  await p.evaluate(() => { lang = "en"; applyLang(); });

  /* Deselection must actually shrink the letter, and an empty selection must
     not produce a document with no points. */
  const shrink = await p.evaluate(() => {
    letterSet = new Set([0, 3]);
    const two = buildLetter();
    letterSet = new Set();
    return { two, none: selected().length, guardedLetter: (renderLetter(), true) };
  });
  ok(/1\. Clause 0/.test(shrink.two) && /2\. Clause 3/.test(shrink.two),
     "selection renumbers from 1 rather than keeping clause index");
  ok(!/Clause 1:/.test(shrink.two), "deselected clauses are absent from the letter");

  /* ---------------------------------------------- paywall */
  console.log("\n— paywall plan selection");

  const pw = await p.evaluate(() => {
    letterSet = new Set([0, 1, 2]);
    owned.letter = null; openPaywall();
    const btns = [...document.querySelectorAll("#plans .plan")];
    const label = document.getElementById("payBtn").textContent;
    return { n: btns.length, plan: pwPlan, sel: btns.filter(x => x.classList.contains("sel")).length,
             label, price: priceLabel(activePlans()[pwPlan].amt) };
  });
  ok(pw.n >= 2, `paywall renders ${pw.n} plans`);
  ok(pw.sel === 1, "exactly one plan is marked selected");
  ok(pw.label.includes(pw.price), "pay button price matches the selected plan");

  const swap = await p.evaluate(() => {
    document.querySelectorAll("#plans .plan")[0].click();
    return { plan: pwPlan, label: document.getElementById("payBtn").textContent,
             price: priceLabel(activePlans()[0].amt),
             sel: [...document.querySelectorAll("#plans .plan")].findIndex(x => x.classList.contains("sel")) };
  });
  ok(swap.plan === 0 && swap.sel === 0, "clicking a plan moves the selection");
  ok(swap.label.includes(swap.price), "pay button follows the new selection");

  /* The withheld points must not be in the DOM before payment. */
  const leak = await p.evaluate(() => {
    const html = document.getElementById("screen-paywall").innerHTML;
    return { c2: html.includes("Clause 2"), c0: html.includes("Clause 0") };
  });
  ok(leak.c0, "the revealed first point is present");
  ok(!leak.c2, "withheld points never enter the DOM before payment");

  /* Case mode uses a different plan list; the index must stay in range. */
  const caseIdx = await p.evaluate(() => {
    pwMode = "letter"; pwPlan = PLANS.length - 1;
    pwMode = "case"; renderPaywall();
    return { plans: PLANS.length, casePlans: PLANS_CASE.length,
             inRange: activePlans()[pwPlan] !== undefined,
             label: document.getElementById("payBtn").textContent };
  });
  ok(caseIdx.inRange,
     `pwPlan survives a mode switch (PLANS ${caseIdx.plans}, PLANS_CASE ${caseIdx.casePlans})`);
  ok(!/undefined/.test(caseIdx.label), "pay button never reads 'Pay undefined'");

  /* ---------------------------------------------- triage */
  console.log("\n— termination triage");
  const tri = await p.evaluate(async () => {
    /* Drive it the way a reader does: fill the calculator, choose "terminated",
       calculate, then answer the three questions. */
    const runTriage = (reason, notice, probation) => {
      show("eos");
      document.getElementById("eosStart").value = "2020-01-01";
      document.getElementById("eosEnd").value = "2026-01-15";
      document.getElementById("eosWage").value = "10000";
      eosHow = "term"; renderEos(); calcEos();
      const pick = (q, v) => [...document.querySelectorAll(`#eosOut .yn[data-q="${q}"] button`)]
        .find(b => b.dataset.v === (v ? "1" : "0")).click();
      pick("reason", reason); pick("notice", notice); pick("probation", probation);
      const box = document.querySelector("#triageOut .verdict-box");
      return { got: box ? [...box.classList].filter(x => x !== "verdict-box")[0] : null,
               hasCase: !!document.getElementById("caseBtn"),
               hasClock: !!document.getElementById("clockBtn"),
               text: box ? box.textContent.trim().length : 0 };
    };
    const cases = [
      [true,  true,  false, "ok"],
      [false, true,  false, "act"],
      [true,  false, false, "act"],
      [false, false, false, "act"],
      [true,  true,  true,  "warn"],
      [false, false, true,  "warn"]
    ];
    return cases.map(c => Object.assign({ want: c[3] }, runTriage(c[0], c[1], c[2])));
  });
  tri.forEach((r, i) => {
    ok(r.got === r.want, `triage case ${i + 1}: expected ${r.want}, got ${r.got}`);
    ok(r.text > 20, `triage case ${i + 1} renders non-empty guidance`);
    ok(r.hasClock, `triage case ${i + 1} always offers the claim clock`);
    ok(r.hasCase === (r.want === "act"), `triage case ${i + 1} offers the case file only when claiming`);
  });

  /* An incomplete triage must render nothing rather than a partial verdict. */
  const partial = await p.evaluate(() => {
    show("eos");
    document.getElementById("eosStart").value = "2020-01-01";
    document.getElementById("eosEnd").value = "2026-01-15";
    document.getElementById("eosWage").value = "10000";
    eosHow = "term"; renderEos(); calcEos();
    const first = document.querySelector('#eosOut .yn[data-q="reason"] button');
    first.click();
    return document.getElementById("triageOut").innerHTML;
  });
  ok(partial === "", "an unanswered triage question renders no verdict");

  /* ---------------------------------------------- case file */
  console.log("\n— case file checklist");
  const cf = await p.evaluate(() => {
    /* Shaped exactly as calcEos() builds it — years included, since
       compEstimate()'s Saudi branch reads it. */
    eosData = { start: Date.UTC(2020, 0, 1), end: Date.UTC(2026, 0, 1), wage: 10000,
                years: 6, total: 45000, parts: { y: 6, m: 0, d: 0 }, how: "term" };
    caseDocs = new Set(); leaveDays = 0;
    renderCase();
    const zero = { meter: document.querySelector("#caseReady .meter i").style.width,
                   doc: buildCaseDoc() };
    document.querySelectorAll("[data-doc]").forEach(x => x.click());
    const all = { meter: document.querySelector("#caseReady .meter i").style.width,
                  n: caseDocs.size, doc: buildCaseDoc() };
    document.querySelectorAll("[data-doc]")[0].click();
    return { zero, all, afterUntick: caseDocs.size, total: CASE_DOCS.length,
             onCount: document.querySelectorAll(".doc.on").length };
  });
  ok(cf.zero.meter === "0%", "empty checklist reads 0%");
  ok(/—/.test(cf.zero.doc), "an empty checklist renders an em dash, not a blank section");
  ok(cf.all.meter === "100%" && cf.all.n === cf.total, "ticking every document reads 100%");
  ok(cf.afterUntick === cf.total - 1 && cf.onCount === cf.total - 1,
     "un-ticking removes exactly one document");
  ok(!/undefined|NaN/.test(cf.all.doc), "the case document contains no undefined or NaN\n         " +
     (cf.all.doc.split("\n").filter(l => /undefined|NaN/.test(l)).join(" | ") || ""));

  const leave = await p.evaluate(() => {
    const el = document.getElementById("leaveDays");
    const set = v => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); return leaveDays; };
    return { neg: set("-5"), over: set("9999"), txt: set("abc"), good: set("14") };
  });
  ok(leave.neg === 0, `negative leave days clamp to 0 (got ${leave.neg})`);
  ok(leave.over === 365, `leave days clamp to 365 (got ${leave.over})`);
  ok(leave.txt === 0, `non-numeric leave input falls back to 0 (got ${leave.txt})`);
  ok(leave.good === 14, "a normal value is kept");

  /* ---------------------------------------------- business tier */
  console.log("\n— business tier");
  const biz = await p.evaluate(() => {
    openPlans("home");
    const cards = document.querySelectorAll("#planCards .pcard").length;
    const seg = document.querySelectorAll("#billSeg button").length;
    const monthly = document.getElementById("planCards").textContent;
    document.querySelectorAll("#billSeg button")[1].click();
    const yearly = document.getElementById("planCards").textContent;
    renderBiz();
    return { cards, seg, changed: monthly !== yearly,
             stats: document.querySelectorAll("#bizStats > *").length,
             contracts: document.querySelectorAll("#bizContracts > *").length,
             seats: document.querySelectorAll("#bizSeats > *").length,
             bizText: document.getElementById("screen-biz").textContent };
  });
  ok(biz.cards === 3, `plans screen renders 3 cards (got ${biz.cards})`);
  ok(biz.seg === 2, "billing has a monthly/yearly toggle");
  ok(biz.changed, "switching to yearly changes the prices shown");
  ok(biz.stats > 0 && biz.contracts > 0 && biz.seats > 0, "business workspace renders all three sections");
  ok(!/undefined|NaN/.test(biz.bizText), "business workspace contains no undefined or NaN");

  /* ---------------------------------------------- photo + noread */
  console.log("\n— photo intake and the unreadable path");
  const ph = await p.evaluate(() => {
    show("photo");
    const before = document.getElementById("phNote").hidden;
    shoot();
    return { before, after: document.getElementById("phNote").hidden,
             visible: document.getElementById("screen-photo").classList.contains("active") };
  });
  ok(ph.before === true && ph.after === false, "the shutter reveals the honest 'not yet' note");
  ok(ph.visible, "photo screen activates");

  const nr = await p.evaluate(() => {
    show("noread");
    const filled = ["nrTitle", "nrBody", "nrRetry", "nrSample"]
      .every(id => document.getElementById(id).textContent.trim().length > 0);
    const tips = document.querySelectorAll("#nrTips li").length;
    document.getElementById("nrRetry").click();
    return { filled, tips, home: document.getElementById("screen-home").classList.contains("active"),
             box: document.getElementById("pasteBox").value };
  });
  ok(nr.filled, "every string on the unreadable screen is populated");
  ok(nr.tips >= 2, `unreadable screen offers ${nr.tips} tips`);
  ok(nr.home && nr.box === "", "retry returns home with the box cleared");

  /* legible() must reject what the noread path exists for */
  const leg = await p.evaluate(() => ({
    empty: legible(""),
    short: legible("hello"),
    gibberish: legible("¤¤¤¤ ¤¤¤¤ ¤¤¤¤ ¤¤¤¤ ¤¤¤¤ ¤¤¤¤ ¤¤¤¤ ¤¤¤¤ ¤¤¤¤ ¤¤¤¤ ¤¤¤¤ ¤¤¤¤"),
    real: legible("This employment contract is between the employer and the worker. The monthly wage is 10000 SAR and the probation period is ninety days from the start date.")
  }));
  ok(!leg.empty && !leg.short && !leg.gibberish, "legible() rejects empty, short and gibberish input");
  ok(leg.real, "legible() accepts a real contract paragraph");

  /* ---------------------------------------------- clauses screen */
  console.log("\n— clauses screen");
  const cl = await p.evaluate(() => {
    current = { doc: "doc_emp", score: 40, clauses: [
      { id: "a", s: "red",   q: null, t: { ar: "أ", en: "A" }, p: { ar: "و", en: "d" }, a: { ar: "ن", en: "f" } },
      { id: "b", s: "amber", q: null, t: { ar: "ب", en: "B" }, p: { ar: "و", en: "d" }, a: { ar: "ن", en: "f" } },
      { id: "c", s: "green", q: null, t: { ar: "ج", en: "C" }, p: { ar: "و", en: "d" } }
    ], verdict: { ar: "تحقق", en: "Check" } };
    renderClauses(); show("clauses");
    const rows = [...document.querySelectorAll("#clauseList .clause")];
    return { rows: rows.length, text: document.getElementById("screen-clauses").textContent,
             expandable: rows.filter(r => r.querySelector("button, [role=button]") || r.onclick).length };
  });
  ok(cl.rows === 3, `clauses screen lists every clause (got ${cl.rows})`);
  ok(!/undefined|NaN/.test(cl.text), "clauses screen contains no undefined or NaN");

  console.log("\n" + (FAIL.length ? `${FAIL.length} FAILURES\n` + FAIL.map(f => "  - " + f).join("\n")
                                  : "all surface checks passed"));
  await b.close();
  process.exit(FAIL.length ? 1 : 0);
})();
