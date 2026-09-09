/* What comes out of the printer.
 *
 * WHY THIS SUITE EXISTS
 *
 * The letter and the case file are the two things a reader opens a laptop FOR:
 * proofreading before sending, handing a lawyer a case file, putting a demand
 * in an envelope. Until now the only way either left the browser was
 * copyLetter() — a clipboard string, which is phone behaviour: paste it into
 * WhatsApp. There were no @media print rules in the app at all, so anyone who
 * reached for print got the nav, the tab bar, the buttons and a warm sand
 * backdrop across the sheet.
 *
 * THE RULE THIS SUITE ENFORCES, and it is not a styling preference: a CASE
 * FILE keeps its provenance and a LETTER does not. The case file is the
 * reader's own working paper and saying how it was prepared is useful there.
 * A letter is signed in their name and handed to the other side, and a Wodouh
 * letterhead on it tells a landlord or an employer that it came out of an app
 * — which invites them to weigh it as software rather than as the sender's own
 * demand. That argument is already in the file by lt_foot, where the FOOTER
 * was dropped from letters; the LETTERHEAD was not, and on paper it stops
 * being chrome around the document and becomes part of it.
 */
const fs = require("node:fs");
const path = require("node:path");
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const SRC = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");

/* Reaches each of the four documents through the app rather than by setting
   state, so a route that stops producing a document fails here too. */
const ROUTES = {
  letter: `const k = Object.keys(SAMPLES)[0]; current = SAMPLES[k];
           current.clauses.forEach((c,i)=>{ if (c.a) letterSet.add(i); });
           show("letter"); renderLetter();`,
  casedoc: `goTab("rights"); openEos();
            document.getElementById("eosStart").value = "2018-03-01";
            document.getElementById("eosEnd").value = "2026-08-31";
            document.getElementById("eosWage").value = "12000";
            calcEos(); openCase(); show("casedoc"); renderCaseDoc();`,
};

(async () => {
  const b = await chromium.launch(launchOpts());

  console.log("— there is a print stylesheet at all");
  ok(/@media\s+print/.test(SRC), "the app declares @media print");
  ok(/@page\s*\{[^}]*margin/.test(SRC), "with a page margin, so nothing prints to the paper edge");

  const inPrint = async (route, lang, vw) => {
    const p = await b.newPage({ viewport: { width: vw || 794, height: 1123 } });
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");
    await p.evaluate((l) => {
      nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
      if (document.documentElement.lang !== l) toggleLang();
    }, lang);
    // eslint-disable-next-line no-eval
    await p.evaluate((r) => { eval(r); }, ROUTES[route]);
    await p.emulateMedia({ media: "print" });
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const vis = (el) => !!el && getComputedStyle(el).visibility === "visible"
                              && getComputedStyle(el).display !== "none";
      const scr = document.querySelector(".screen.active");
      const letter = scr.querySelector(".letter");
      const box = letter.getBoundingClientRect();
      return {
        screen: scr.id,
        body: vis(letter.querySelector(".body")),
        letterhead: vis(scr.querySelector(".letterhead")),
        foot: (scr.querySelector(".letterfoot") || {}).textContent || "",
        nav: vis(document.getElementById("tabbar")),
        bar: vis(document.querySelector(".bar")),
        actions: vis(scr.querySelector(".letter-actions")),
        back: vis(scr.querySelector(".back")),
        width: Math.round(box.width), left: Math.round(box.left),
        vw: window.innerWidth,
        bg: getComputedStyle(letter).backgroundColor,
        shadow: getComputedStyle(letter).boxShadow,
      };
    });
    await p.close();
    return r;
  };

  for (const lang of ["ar", "en"]) {
    console.log(`\n— ${lang}: the letter prints as a letter, not as a screenshot of an app`);
    const L = await inPrint("letter", lang);
    ok(L.body, "the letter's text is on the page");
    ok(!L.nav && !L.bar, "the navigation is not");
    ok(!L.actions, "nor the copy and print buttons");
    ok(!L.back, "nor the back control");
    ok(L.shadow === "none", "the card treatment is gone");
    /* THE CONTAINING-BLOCK BUG. The screen's entry animation carries a
       transform, which makes it a containing block for absolutely-positioned
       descendants — so the document anchored to the 440px phone column and
       printed as a 402px strip down the middle of the sheet. */
    ok(L.width > L.vw * 0.9,
       `and it spans the sheet rather than a phone column (${L.width} of ${L.vw})`);
    ok(L.left <= 1, `starting at the edge of the page area (${L.left})`);

    /* AT THE WIDTH A LAPTOP ACTUALLY PRINTS FROM. At 794 the reading column
       does not apply, so this passed with the containing-block bug still in
       place — proved by breaking it, which is the only reason the second
       viewport is here. Above 900 the screen is capped at 1080 and the
       document anchors to that cap instead of to the sheet unless the entry
       animation, whose transform creates the containing block, is off. */
    const W = await inPrint("letter", lang, 1440);
    ok(W.width > W.vw * 0.9,
       `${lang}: and from a 1440px window too (${W.width} of ${W.vw})`);
    ok(!W.nav && !W.actions && !W.letterhead,
       `${lang}: with the same chrome and letterhead gone at that width`);

    console.log(`— ${lang}: and it does not carry our name to the other side`);
    ok(!L.letterhead, "no Wodouh letterhead on a document the reader signs and sends");
    ok(!/وضوح|Wodouh/i.test(L.foot), `and no provenance footer either (${L.foot || "empty"})`);

    console.log(`— ${lang}: the case file is the reader's own paper, and keeps its provenance`);
    const C = await inPrint("casedoc", lang);
    ok(C.screen === "screen-casedoc", `the case document was reached (${C.screen})`);
    ok(C.body, "its text is on the page");
    ok(!C.nav && !C.actions, "with the chrome gone there too");
    ok(C.letterhead, "but the letterhead stays — this one is not sent to an opponent");
    ok(/وضوح|Wodouh/i.test(C.foot),
       `and it still says how it was prepared (${C.foot.trim() || "empty"})`);
  }

  console.log("\n— every document offers the way out, and it is one handler");
  const btns = await b.newPage({ viewport: { width: 390, height: 844 } });
  await btns.goto(APP);
  await btns.waitForFunction(() => typeof window.show === "function");
  const wiring = await btns.evaluate(() => {
    const ids = ["printLetter", "printCase", "printTermDoc", "printTermLtr"];
    let called = 0;
    const real = window.print;
    window.print = () => { called++; };
    const found = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return { id, missing: true };
      el.click();
      return { id, label: el.textContent.trim() };
    });
    window.print = real;
    return { found, called };
  });
  await btns.close();
  for (const f of wiring.found) ok(!f.missing, `${f.id} exists`);
  ok(wiring.called === 4,
     `and all four reach the browser's own print dialog (${wiring.called}/4)`);
  ok(wiring.found.every((f) => f.label && f.label.length > 2),
     `each is labelled (${wiring.found.map((f) => f.label).join(" / ")})`);
  /* "or save as PDF", because that is what the dialog offers and PDF is what a
     reader actually sends a lawyer. */
  ok(wiring.found.every((f) => /PDF/i.test(f.label)),
     "and says PDF, not only print");

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nthe letter leaves as a letter, and the case file leaves as the reader's own file");
})();
