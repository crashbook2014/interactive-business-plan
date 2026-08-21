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

  /* ------------------------------ one question, one answer, everywhere */
  console.log("\n— the library and the assistant do not disagree with each other");

  /* The same question is answered in two places: LIB (the rights library) and
     KB (what the assistant retrieves). Article 53's answer was corrected in one
     and left asserting a disputed legal mechanism in the other — and the commit
     message said it was fixed. Two stores, one subject, no check between them. */
  /* Enumerated BY CITATION, not by store. The first version of this checked the
     two stores that happened to be wrong that day — and a third surface, the
     clause matcher a reader actually acts on, kept marking a 180-day probation
     "green, normal" on the same disputed article. Anything that cites 53 has to
     answer for it, wherever it lives. */
  const dual = await p.evaluate(() => {
    const CITES = /Article 53|المادة ٥٣/;
    const out = {};
    const kbHit = KB.find(e => e.k.test("probation"));
    if (kbHit) out.kb = { ar: kbHit.a.ar, en: kbHit.a.en };
    const libItem = LIB.flatMap(g => g.items)
      .find(i => /probation|التجربة/i.test(i.q.en + i.q.ar));
    if (libItem) out.lib = { ar: libItem.a.ar, en: libItem.a.en };
    /* Every heuristic clause rule and every authored sample clause citing 53. */
    RULES.forEach((r, i) => {
      if (r.src && CITES.test(r.src.en + r.src.ar))
        out["rule" + i] = { ar: r.p.ar, en: r.p.en, severity: r.s };
    });
    Object.keys(SAMPLES).forEach(k => (SAMPLES[k].clauses || []).forEach((c, i) => {
      if (c.src && CITES.test(c.src.en + c.src.ar))
        out["sample_" + k + "_" + i] = { ar: c.p.ar, en: c.p.en, severity: c.s };
    }));
    return out;
  });
  const surfaces = Object.keys(dual);
  ok(surfaces.length >= 3,
     `every surface citing Article 53 is enumerated (${surfaces.length}: ${surfaces.join(", ")})`);

  /* Article 53 is DISPUTED in docs/legal-sources.md. Neither surface may state
     the 90-then-extend mechanism as settled while that is true. */
  const assertsMechanism = s =>
    /extendable to 180 by written agreement|extendable by written agreement to 180/i.test(s) ||
    /ويمكن تمديدها باتفاق مكتوب إلى ١٨٠|وتُمدّد باتفاق مكتوب إلى ١٨٠/.test(s);
  surfaces.forEach(which => {
    ["ar", "en"].forEach(l => {
      ok(!assertsMechanism(dual[which][l]),
         `${which}.${l} does not assert the disputed Article 53 mechanism`);
    });
    ok(/have not confirmed|could not verify|not confirmed/i.test(dual[which].en),
       `${which}.en names the uncertainty explicitly`);
    ok(/لم نتحقق|لم نستطع/.test(dual[which].ar),
       `${which}.ar names the uncertainty explicitly`);
    /* And a clause citing a disputed article may not be waved through green.
       "Normal, nothing to check" is a resolution of the dispute, in the
       employer's favour, made silently. */
    if (dual[which].severity)
      ok(dual[which].severity !== "green",
         `${which} is not marked green while the article it cites is disputed`);
  });

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

  /* ---- the letter bar, which a QA pass reported as flaky
   *
   * It was not reproducible: the bar appears, sits inside the viewport, is not
   * covered, and the button navigates. There is no auto-dismiss timer in
   * renderBuilder() at all — nothing to time out.
   *
   * The likely cause of the flake is that .builder is position:sticky, so it
   * lives INSIDE the scrolling container rather than floating over it. An
   * automated click issued before the container has scrolled can find it
   * off-screen. That is worth pinning rather than "fixing", because this bar
   * sits directly in front of the negotiation-letter paywall and friction here
   * costs money.
   */
  console.log("\n— the letter bar appears, stays reachable, and opens the letter");
  const letter = await p.evaluate(async () => {
    nat = "sa"; analyze("employment");
    await new Promise(r => setTimeout(r, 2800));
    const add = document.querySelector("[data-add]");
    if (!add) return { err: "no add button", screen: document.querySelector(".screen.active").id };
    add.click();
    await new Promise(r => setTimeout(r, 400));
    const el = document.getElementById("builder");
    const r = el.getBoundingClientRect();
    const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      screen: document.querySelector(".screen.active").id,
      hidden: el.hidden,
      inViewport: r.top >= 0 && r.bottom <= innerHeight && r.height > 0,
      /* Whatever is at the bar's centre must belong to the bar. Anything else
         means something is drawn over the button. */
      covered: !el.contains(mid),
      count: document.getElementById("bCount").textContent.trim(),
    };
  });
  ok(!letter.err, `a clause can be added on the result screen${letter.err ? " — " + letter.err : ""}`);
  ok(letter.hidden === false, "adding one reveals the bar");
  ok(letter.inViewport === true, "which sits inside the viewport, not below the fold");
  ok(letter.covered === false, "with nothing drawn over its centre");
  ok(letter.count.length > 0, `and a live count of what is in the letter ("${letter.count}")`);

  /* The click, through the real event path rather than by calling the
     handler — which is the thing the QA pass could not do reliably. */
  let clicked = "did not navigate";
  try {
    await p.click("#bView", { timeout: 3000 });
    clicked = await p.evaluate(() => document.querySelector(".screen.active").id);
  } catch (e) { clicked = "click failed: " + String(e.message).split("\n")[0]; }
  ok(clicked === "screen-paywall",
     `and a real click on it reaches the paywall (${clicked})`);

  /* It must NOT linger on a screen it does not belong to — a floating bar that
     survives navigation is the other half of this complaint. */
  const elsewhere = await p.evaluate(() => {
    show("home"); renderBuilder();
    return document.getElementById("builder").hidden;
  });
  ok(elsewhere === true, "and it disappears when the reader leaves the result screen");

  /* ---- the floor under every feature switch
   *
   * `hidden` is how this app turns features off: an unconfigured AI, a dark
   * paywall, a lawyer desk with no lawyer. It silently did not work. The
   * attribute's display:none comes from the user-agent stylesheet, and
   * `.fld{display:block}` — an ordinary author rule — outranks it. Six
   * elements were switched off in code and on screen for the reader, and
   * every suite passed the whole time because they all read el.hidden.
   *
   * Three of the six were promises the product cannot keep: a refund
   * guarantee while payments are dark, a lawyer desk with no lawyer, and two
   * doors to an AI that is not deployed.
   *
   * This is the one assertion that catches all of them, and any seventh.
   */
  console.log("\n— everything marked hidden is actually off the screen");
  const ghosts = await p.evaluate(() => {
    /* Screens are display:none until active, which would mask a hidden child
       and make this pass for the wrong reason. Force them all on first. */
    document.querySelectorAll(".screen").forEach(s => s.classList.add("active"));
    const all = [...document.querySelectorAll("[hidden]")];
    return {
      total: all.length,
      visible: all.filter(el => getComputedStyle(el).display !== "none")
                  .map(el => el.id || el.className || el.tagName),
    };
  });
  ok(ghosts.total > 20, `${ghosts.total} elements carry the hidden attribute`);
  ok(ghosts.visible.length === 0,
     `and every one of them computes to display:none${ghosts.visible.length ? " — ON SCREEN: " + ghosts.visible.join(", ") : ""}`);

  console.log("\n" + (FAIL.length ? `${FAIL.length} FAILURES\n` + FAIL.map(f => "  - " + f).join("\n")
                                  : "all surface checks passed"));
  await b.close();
  process.exit(FAIL.length ? 1 : 0);
})();
