/* What a reader on a laptop gets.
 *
 * Wodouh is a phone-first product served in a framed phone column on desktop,
 * with a brand aside beside it. That framing is deliberate and this suite does
 * not argue with it — most of the thirty screens are linear forms that would be
 * worse stretched across 1440px.
 *
 * What it asserts is the part that was wrong: the aside was written once, in
 * applyLang(), and never touched again. So it showed the landing pitch — "read
 * your contract, BEFORE YOU SIGN" — to someone working out what they are owed
 * after being fired, and it sat there for their whole session rather than for
 * one screen. It is the same defect as the intake headline in 71ce2d0, in a
 * place that is harder to notice because nothing about it ever changes.
 *
 * The aside is only visible at ≥900px, so every assertion here is about a
 * width no phone test covers — which is exactly why it went unseen.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  const asideOn = async (fn) => p.evaluate((f) => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    // eslint-disable-next-line no-eval
    eval(f);
    const a = document.querySelector(".desk-aside");
    return { h: (document.getElementById("deskTitle") || {}).textContent || "",
             sub: (document.getElementById("deskSub") || {}).textContent || "",
             meta: (document.getElementById("deskMeta") || {}).textContent || "",
             shown: a ? getComputedStyle(a).display !== "none" : false };
  }, fn);

  console.log("— the aside says something true for the screen it is beside");
  const home = await asideOn('goTab("home")');
  ok(home.shown, "the aside is visible on a laptop");
  ok(/قبل ما توقّع/.test(home.h), `home keeps the pitch it was written for (${home.h})`);

  const term = await asideOn('goTab("home"); pickSituation("term")');
  ok(!/قبل ما توقّع/.test(term.h),
     `a terminated reader is not told "before you sign" (${term.h})`);
  ok(term.h !== home.h, "and gets something written for them instead");

  const eos = await asideOn('goTab("rights"); openEos()');
  ok(!/قبل ما توقّع/.test(eos.h), `nor does someone at the calculator (${eos.h})`);
  ok(eos.h !== home.h && eos.h !== term.h, "with its own line again");

  const rent = await asideOn('goTab("home"); pickSituation("rent")');
  ok(!/قبل ما توقّع/.test(rent.h), `nor a tenant in a dispute (${rent.h})`);

  /* Every one of them has to be filled in, in both languages — an aside that
     renders blank is worse than one that repeats itself. */
  for (const [name, a] of [["home", home], ["termination", term], ["calculator", eos], ["rent", rent]]) {
    ok(a.h.trim() && a.sub.trim(), `${name}: neither line is blank`);
  }

  /* The line under the divider called this an interactive prototype, months
     after launch, beside a product real people are using. */
  console.log("\n— and it does not describe a launched product as a prototype");
  ok(!/prototype|نموذج تفاعلي/i.test(home.meta), `(${home.meta})`);

  console.log("\n— switching language does not reset it to the home pitch");
  const switched = await p.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    goTab("home"); pickSituation("term");
    const before = document.getElementById("deskTitle").textContent;
    toggleLang();
    const after = document.getElementById("deskTitle").textContent;
    return { before, after, lang: document.documentElement.lang };
  });
  ok(switched.after !== switched.before, "the aside follows the language");
  ok(!/before you sign/i.test(switched.after),
     `and still speaks to the reader's situation after the switch (${switched.after})`);

  /* ---- THE TWO-COLUMN SHELL.
   * Opt-in, not global: widening every screen would stretch thirty linear
   * forms across a laptop, which is worse than the phone column rather than
   * better. So the assertions are as much about what does NOT split as what
   * does.
   */
  console.log("\n— a screen that asked for two columns gets two columns");
  const at = async (w, h, fn) => {
    const q = await b.newPage({ viewport: { width: w, height: h } });
    await q.goto(APP);
    await q.waitForFunction(() => typeof window.show === "function");
    const r = await q.evaluate((f) => {
      nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
      // eslint-disable-next-line no-eval
      eval(f);
      const scr = document.querySelector(".screen.active");
      const A = scr.querySelector(".dk-a"), B = scr.querySelector(".dk-b");
      const app = document.querySelector(".app");
      const box = (e) => e && e.getBoundingClientRect();
      const a = box(A), c = box(B);
      return {
        hasCols: !!(A && B),
        sideBySide: !!(a && c) && Math.abs(a.top - c.top) < 40 && Math.round(a.left) !== Math.round(c.left),
        formIsInline: !!(a && c) && (document.documentElement.dir === "rtl" ? a.left > c.left : a.left < c.left),
        appW: Math.round(box(app).width),
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        liveRegion: (document.getElementById("eosOut") || {}).getAttribute
          ? document.getElementById("eosOut").getAttribute("aria-live") : null,
      };
    }, fn);
    await q.close();
    return r;
  };

  const EOS = 'goTab("rights"); openEos()';
  const wide = await at(1440, 900, EOS);
  ok(wide.hasCols, "the calculator declares two columns");
  ok(wide.sideBySide, `and they sit side by side at 1440 (app ${wide.appW}px)`);
  ok(wide.appW > 600, `the frame widened for it (${wide.appW}px)`);
  ok(!wide.overflow, "with no sideways overflow");
  /* Positioned, never reordered — so this survives the split. */
  ok(wide.liveRegion === "polite", `the result keeps its live region (${wide.liveRegion})`);

  const narrow = await at(1000, 800, EOS);
  ok(!narrow.sideBySide, "below 1100px it is one column again");
  ok(narrow.appW <= 460, `and the frame is back to phone width (${narrow.appW}px)`);

  const onPhone = await at(390, 844, EOS);
  ok(!onPhone.sideBySide, "and on a phone, where it never had any business splitting");
  ok(!onPhone.overflow, "with no overflow there either");

  /* A screen that did NOT opt in must be untouched at the same width. */
  const notSplit = await at(1440, 900, 'goTab("rights")');
  ok(!notSplit.hasCols, "a screen that did not opt in has no columns");
  ok(notSplit.appW <= 460,
     `and keeps the 440px frame while its neighbour widens (${notSplit.appW}px)`);

  /* ---- the other two screens that asked for columns */
  console.log("\n— the result reads its verdict and its findings together");
  const RESULT = 'goTab("home"); pickSituation("rent"); current = SAMPLES.rental; ' +
                 'show("result"); renderResult(true); renderClauses(); renderDuties()';
  const res = await at(1440, 900, RESULT);
  ok(res.sideBySide, "the verdict and the clause list sit side by side");
  /* THE ASSERTION THAT WAS MISSING, and a screenshot found what it did not.
     Two columns inside a frame that never widened is two 200px columns — worse
     than the single 404px column it replaced. Splitting is only an improvement
     if the frame grows with it, so every split screen is checked for both. */
  ok(res.appW > 600,
     `and the frame widened to hold them (${res.appW}px — 440 means it did not)`);
  ok(!res.overflow, "with no sideways overflow");
  const resNarrow = await at(1000, 800, RESULT);
  ok(!resNarrow.sideBySide, "and stack again below 1100px");

  /* THE MEASURE, which is the whole reason the letter got a column of its own.
     It rendered at 347px on a 1440px screen — 24px more than the phone it
     replaced — for the document a reader is most likely to have opened a
     laptop to read before sending it. */
  console.log("\n— the letter is wide enough to proofread");
  const LETTER = RESULT + '; addAllPoints(); renderLetter(); show("letter")';
  const letterWide = await p.evaluate(async (f) => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    // eslint-disable-next-line no-eval
    eval(f);
    const body = document.getElementById("letterBody").getBoundingClientRect();
    const scr = document.querySelector(".screen.active");
    const a = scr.querySelector(".dk-a").getBoundingClientRect();
    const c = scr.querySelector(".dk-b").getBoundingClientRect();
    return { w: Math.round(body.width),
             split: Math.abs(a.top - c.top) < 60 && Math.round(a.left) !== Math.round(c.left),
             docIsWider: a.width > c.width };
  }, LETTER);
  ok(letterWide.split, "the document and its controls sit side by side");
  ok(letterWide.w >= 450,
     `and the document gets a readable measure (${letterWide.w}px, was 347)`);
  ok(letterWide.docIsWider,
     "with the document taking the larger column, not an even half");

  console.log("\n— and the columns follow the language, not a hardcoded side");
  const ar = await at(1440, 900, 'if (document.documentElement.lang !== "ar") toggleLang(); ' + EOS);
  const en = await at(1440, 900, 'if (document.documentElement.lang === "ar") toggleLang(); ' + EOS);
  ok(ar.formIsInline && en.formIsInline,
     "the inputs lead in both directions — right in Arabic, left in English");

  console.log("\n— the phone is unaffected: no aside below 900px");
  const small = await b.newPage({ viewport: { width: 390, height: 844 } });
  await small.goto(APP);
  await small.waitForFunction(() => typeof window.show === "function");
  const hidden = await small.evaluate(() => {
    const a = document.querySelector(".desk-aside");
    return a ? getComputedStyle(a).display : "missing";
  });
  ok(hidden === "none", `the aside is not rendered on a phone (${hidden})`);
  await small.close();

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nthe laptop aside speaks to the screen it sits beside");
})();
