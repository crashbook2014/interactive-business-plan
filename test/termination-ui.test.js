/* Termination assessment — the flow as a person actually walks it.
 *
 * termination.test.js drives the state directly; this one clicks. It exists
 * because the two can disagree: a computation can be right while the screen
 * that reaches it is unreachable, mis-sized on a phone, or silently English
 * in an Arabic session.
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

  /* Clear onboarding and pick a track the way a first-time reader would. */
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload();
  await p.waitForFunction(() => typeof window.show === "function");
  /* The app opens in Arabic. These assertions read English strings, so switch
     first and come back to Arabic at the end — the RTL pass is the point. */
  await p.evaluate(() => { nat = "sa"; obDone = true; lang = "en"; applyLang(); show("home"); });

  console.log("— entry from the home screen");
  /* The door on the chooser, not a card further down the same screen. Home
     used to carry both: a sit-card for "I've been terminated" and an
     assist-entry to the identical destination about a hundred lines below it,
     under a different name. One destination, one door. */
  const card = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("#screen-home .sit-card")];
    const el = btns.find(x => x.getAttribute("onclick") === "pickSituation('term')");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const txt = el.textContent.trim();
    el.click();
    return { h: r.height, txt, screen: document.querySelector(".screen.active").id };
  });
  ok(card, "the home card exists");
  ok(card && card.h >= 44, `home card meets the 44px touch minimum (${card && Math.round(card.h)}px)`);
  ok(card && card.screen === "screen-term", "tapping it opens the termination flow");
  ok(card && /terminated/i.test(card.txt), "the card says what it is");

  console.log("\n— the seven options are all reachable and tappable");
  const opts = await p.evaluate(() => {
    const bs = [...document.querySelectorAll("#termHow button")];
    return { n: bs.length, small: bs.filter(x => x.getBoundingClientRect().height < 44).length,
             labels: bs.map(x => x.textContent.trim()) };
  });
  ok(opts.n === 7, `seven options rendered (${opts.n})`);
  ok(opts.small === 0, `every option meets 44px (${opts.small} too small)`);
  ok(new Set(opts.labels).size === 7, "all seven labels are distinct");

  console.log("\n— clicking through the questions");
  await p.evaluate(() => document.querySelectorAll("#termHow button")[0].click());
  ok(await p.evaluate(() => document.querySelector(".screen.active").id === "screen-termq"),
     "choosing an option advances to the questions");

  const step = async (vals) => p.evaluate(v => {
    for (const [id, val] of Object.entries(v)){
      const el = document.getElementById(id);
      if (!el) continue;
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    document.getElementById("tqNext").click();
    return document.querySelector(".screen.active").id;
  }, vals);

  await step({ tmStart:"2018-01-01", tmEnd:"2026-01-31", tmWage:"12000" });
  ok(await p.evaluate(() => document.getElementById("tqTitle").textContent.length > 0),
     "step 2 renders");
  await step({ tmNoticeDue:"60", tmNoticeGiven:"10" });
  const afterLast = await step({ tmUnpaid:"2", tmLeave:"14", tmOther:"3000" });
  ok(afterLast === "screen-termev", "the last step lands on the evidence screen");

  const captured = await p.evaluate(() => ({ ...term }));
  ok(captured.wage === 12000 && captured.noticeDue === 60 && captured.leaveDays === 14,
     "typed answers were captured");

  console.log("\n— evidence, then the paywall, then the result");
  const ev = await p.evaluate(() => {
    const docs = [...document.querySelectorAll("[data-tdoc]")];
    docs.slice(0, 3).forEach(d => d.click());
    return { n: docs.length, ticked: term.docs.length,
             strength: document.querySelector("#termEvOut .tm-tag").textContent.trim(),
             honest: document.querySelector(".ev-honest").textContent };
  });
  ok(ev.n === 10, `ten document types offered (${ev.n})`);
  ok(ev.ticked === 3, "ticking three records three");
  ok(/doesn't read|does not read/i.test(ev.honest),
     "the screen says plainly that Wodouh does not read the files");

  const gate = await p.evaluate(() => {
    document.querySelector('#screen-termev .primary').click();
    return document.querySelector(".screen.active").id;
  });
  ok(gate === "screen-paywall", "the assessment is gated");

  const paid = await p.evaluate(() => {
    /* The full tier, because this walk goes on to open the case file and the
       letter. The cheaper tier deliberately does not include them — that
       separation is exercised in commerce.test.js. */
    document.querySelectorAll("#plans .plan")[1].click();
    document.getElementById("payBtn").click();
    return new Promise(r => setTimeout(() => r(document.querySelector(".screen.active").id), 1200));
  });
  ok(paid === "screen-termres", "paying lands on the assessment");

  const res = await p.evaluate(() => ({
    secs: document.querySelectorAll("#termSections .tm-sec").length,
    lines: document.querySelectorAll("#termMoney .r").length,
    srcs: document.querySelectorAll("#termMoney .src-line").length,
    claims: document.querySelectorAll(".tm-claim").length,
    hows: document.querySelectorAll(".tm-how details").length,
    total: document.querySelector("#termMoney .r.tot") ? document.querySelector("#termMoney .r.tot").textContent : "",
    text: document.getElementById("screen-termres").textContent
  }));
  ok(res.secs >= 6, `assessment renders ${res.secs} sections`);
  ok(res.srcs === res.lines - 1, `every money line has a source line (${res.srcs} for ${res.lines - 1} lines)`);
  ok(res.claims >= 1, `${res.claims} per-claim breakdowns`);
  ok(res.hows === 5, `five "how we got here" factors (${res.hows})`);
  ok(/Estimated potential entitlement/i.test(res.total), "the total is labelled as an estimate");
  ok(/not a final determination/i.test(res.text), "the screen says it is not a final determination");

  console.log("\n— next steps, case file and letter");
  const next = await p.evaluate(() => {
    document.querySelector("#screen-termres .primary").click();
    return { screen: document.querySelector(".screen.active").id,
             steps: document.querySelectorAll(".tm-step").length,
             text: document.getElementById("screen-termnext").textContent };
  });
  ok(next.screen === "screen-termnext" && next.steps === 5, `five next steps (${next.steps})`);
  ok(/does not file/i.test(next.text), "it states plainly that Wodouh files nothing for you");

  const docScreen = await p.evaluate(() => {
    [...document.querySelectorAll("#termSteps button")].find(b => b.dataset.step === "3").click();
    return { screen: document.querySelector(".screen.active").id,
             body: document.getElementById("termDocBody").textContent };
  });
  ok(docScreen.screen === "screen-termdoc", "the case file opens");
  ok(docScreen.body.split("\n").length > 20, "the case file has real content");
  ok(!/undefined|NaN/.test(docScreen.body), "no undefined or NaN in the case file");

  const tones = await p.evaluate(() => {
    show("termnext");
    [...document.querySelectorAll("#termSteps button")].find(b => b.dataset.step === "2").click();
    const out = {};
    [...document.querySelectorAll("#termTone button")].forEach(btn => {
      btn.click();
      out[btn.textContent.trim()] = document.getElementById("termLtrBody").textContent;
    });
    return out;
  });
  const toneNames = Object.keys(tones);
  ok(toneNames.length === 4, `four tones (${toneNames.join(", ")})`);
  ok(new Set(Object.values(tones)).size === 4, "each tone produces a different letter");
  const amounts = Object.values(tones).map(v => (v.match(/[\d,]{4,}/g) || []).sort().join("|"));
  ok(new Set(amounts).size === 1, "the amounts are identical across all four tones");
  const threat = /\b(sue|court action|legal action against|report you|we will take)\b/i;
  ok(!Object.values(tones).some(v => threat.test(v)), "no tone contains a threat");

  console.log("\n— Arabic, RTL");
  const ar = await p.evaluate(() => {
    lang = "en"; toggleLang();   /* -> ar */
    return { dir: document.documentElement.dir, lang: document.documentElement.lang,
             ltr: document.getElementById("termLtrBody").textContent,
             screen: document.querySelector(".screen.active").id };
  });
  ok(ar.dir === "rtl" && ar.lang === "ar", "Arabic switches the document to RTL");
  ok(!/undefined|NaN/.test(ar.ltr), "the Arabic letter has no undefined or NaN");
  ok(/[؀-ۿ]/.test(ar.ltr), "the Arabic letter is actually in Arabic");
  ok(ar.screen === "screen-termltr", "switching language does not navigate away");

  console.log("\n" + (FAIL.length ? `${FAIL.length} FAILURES\n` + FAIL.map(f => "  - " + f).join("\n")
                                  : "all UI checks passed"));
  await b.close();
  process.exit(FAIL.length ? 1 : 0);
})();
