/* What a reader on a laptop gets.
 *
 * Wodouh used to be served on a desktop as a 440px framed phone on a warm
 * backdrop with a brand aside beside it. Measured, that treatment was worse
 * than the phone it imitated: on a 1440px laptop the eight doors on home
 * rendered at 199px each against 354px on a 390px phone, the headline stayed
 * 24px, and the calculator's only button sat 32px below the edge of a
 * fixed-height box that gives no hint it scrolls.
 *
 * So the frame, the backdrop and the aside are retired at >=900px and the app
 * takes the desktop language the brand already owns on its marketing site: a
 * sticky 66px nav, a 1080px measure, one readable column per screen. This
 * suite is the contract for that shell.
 *
 * TWO THINGS IT GUARDS THAT ARE EASY TO BREAK:
 *
 *   1. The nav is ONE element, moved between the header and the foot of the
 *      app when the breakpoint is crossed. Rendering it twice would give a
 *      keyboard reader two sets of tab stops for five destinations, so the
 *      count is asserted, not assumed.
 *   2. The aside's copy is not dead. deskAsideKeys() still chooses a line per
 *      screen and home reads it as its hero, so the assertions that a
 *      terminated reader is never told "before you sign" stay exactly where
 *      they were — they guard the hero now instead of the panel.
 *
 * Every assertion here is about a width no phone suite covers, which is why
 * all of this went unseen for so long.
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

  console.log("— the retired aside, and the copy that outlived it");
  const home = await asideOn('goTab("home")');
  /* Retired, not deleted. The panel is gone from the laptop; the lines it
     chose are the ones home now reads as its own hero, so every assertion
     below still guards live copy. */
  ok(!home.shown, "the brand panel no longer sits beside a framed phone");
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

  /* ---- THE SHELL ITSELF. */
  console.log("\n— the nav is one element, in the header on a laptop");
  const navAt = async (w, h, fn) => {
    const q = await b.newPage({ viewport: { width: w, height: h } });
    await q.goto(APP);
    await q.waitForFunction(() => typeof window.show === "function");
    const r = await q.evaluate((f) => {
      nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
      // eslint-disable-next-line no-eval
      eval(f);
      const navs = document.querySelectorAll("#tabbar");
      const bar = document.querySelector(".bar");
      const tb = document.getElementById("tabbar");
      const aside = document.querySelector(".desk-aside");
      return {
        navCount: navs.length,
        inHeader: !!(bar && tb && bar.contains(tb)),
        hidden: tb.hidden,
        links: document.querySelectorAll("#tabbar .tab").length,
        asideShown: aside ? getComputedStyle(aside).display !== "none" : false,
        barH: bar ? Math.round(bar.getBoundingClientRect().height) : null,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    }, fn);
    await q.close();
    return r;
  };

  const deskNav = await navAt(1440, 900, 'goTab("home")');
  ok(deskNav.navCount === 1,
     `exactly one nav exists, never a duplicate for a keyboard reader to walk twice (${deskNav.navCount})`);
  ok(deskNav.inHeader, "and on a laptop it sits in the header");
  ok(deskNav.barH === 66, `the nav is the marketing site's 66px (${deskNav.barH})`);
  ok(!deskNav.asideShown, "with no brand aside beside a frame that no longer exists");

  /* A WEBSITE DOES NOT LOSE ITS NAV THREE STEPS INTO A FLOW. On a phone the
     bar belongs to the five roots and would eat the bottom of every form; in a
     header there is no such cost. */
  const deep = await navAt(1440, 900, 'goTab("home"); show("intake")');
  ok(!deep.hidden, "the nav stays on a screen that is not one of the five roots");
  ok(deep.links >= 4, `and still carries its destinations (${deep.links})`);

  const phoneNav = await navAt(390, 844, 'goTab("home")');
  ok(phoneNav.navCount === 1, "the phone has one nav too");
  ok(!phoneNav.inHeader, "and on a phone it is a tab bar, not a header row");
  const phoneDeep = await navAt(390, 844, 'goTab("home"); show("intake")');
  ok(phoneDeep.hidden,
     "and it still gets out of the way on a phone form, where the room is not there");

  /* THE READING COLUMN. Most of the thirty-one screens are linear forms and an
     input stretched to 1080px is worse than one at 440px, not better. */
  console.log("\n— every screen sits in a readable column, not the whole window");
  const colAt = async (w, fn) => {
    const q = await b.newPage({ viewport: { width: w, height: 900 } });
    await q.goto(APP);
    await q.waitForFunction(() => typeof window.show === "function");
    const r = await q.evaluate((f) => {
      nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
      // eslint-disable-next-line no-eval
      eval(f);
      const scr = document.querySelector(".screen.active");
      const b2 = scr.getBoundingClientRect();
      return { w: Math.round(b2.width), vw: window.innerWidth,
               left: Math.round(b2.left), right: Math.round(window.innerWidth - b2.right),
               overflow: document.documentElement.scrollWidth > window.innerWidth };
    }, fn);
    await q.close();
    return r;
  };
  for (const w of [1024, 1280, 1440, 1920]) {
    const c = await colAt(w, 'goTab("rights")');
    ok(c.w <= 700, `${w}: a form screen is held to a readable column (${c.w}px)`);
    ok(Math.abs(c.left - c.right) <= 2, `${w}: and centred (${c.left} / ${c.right})`);
    ok(!c.overflow, `${w}: with no sideways overflow`);
  }

  /* THE DEFECT THE FRAME WAS CAUSING, stated as a reachability test rather
     than as a height. At 1440x900 the calculator form is 892px tall and the
     frame was an 820px scroll box, so the Calculate button — the only thing on
     the screen — was 32px past its bottom edge. */
  console.log("\n— and nothing is trapped below an edge that no longer exists");
  /* MEASURED AGAINST THE BOX THAT WAS DOING THE CLIPPING, not against the
     document. The first version of this guard compared the button to
     documentElement.scrollHeight and passed happily with the 820px frame put
     back — the button was clipped by .app's own overflow, which the document
     knows nothing about. Breaking a guard is the only way to find out it does
     not bite. */
  const reach = await p.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    goTab("rights"); openEos();
    window.scrollTo(0, document.body.scrollHeight);
    const app = document.querySelector(".app");
    const btn = [...document.querySelectorAll("#screen-eos button.primary")].pop();
    const r = btn.getBoundingClientRect(), A = app.getBoundingClientRect();
    const mid = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { overflowY: getComputedStyle(app).overflowY,
             clipped: Math.round(r.bottom - A.bottom),
             hit: !!mid && (mid === btn || btn.contains(mid)) };
  });
  /* Forbid the mechanism, not only its symptom: a desktop .app that is its own
     scroll container is the defect, whatever happens to fit inside it today. */
  ok(reach.overflowY === "visible",
     `.app is not a scroll box on a laptop (overflow-y: ${reach.overflowY})`);
  ok(reach.clipped <= 1,
     `and the Calculate button is not cut off by its edge (${reach.clipped}px past it)`);
  ok(reach.hit === true,
     "and it can actually be clicked where it is drawn");

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
        screenW: Math.round(box(scr).width),
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
  ok(wide.sideBySide, `and they sit side by side at 1440 (screen ${wide.screenW}px)`);
  ok(wide.screenW > 700,
     `the screen was let past the reading column to hold them (${wide.screenW}px)`);
  ok(!wide.overflow, "with no sideways overflow");
  /* Positioned, never reordered — so this survives the split. */
  ok(wide.liveRegion === "polite", `the result keeps its live region (${wide.liveRegion})`);

  const narrow = await at(1000, 800, EOS);
  ok(!narrow.sideBySide, "below 1100px it is one column again");
  ok(narrow.screenW <= 700,
     `and back inside the reading column (${narrow.screenW}px)`);

  const onPhone = await at(390, 844, EOS);
  ok(!onPhone.sideBySide, "and on a phone, where it never had any business splitting");
  ok(!onPhone.overflow, "with no overflow there either");

  /* A screen that did NOT opt in must be untouched at the same width. */
  const notSplit = await at(1440, 900, 'goTab("rights")');
  ok(!notSplit.hasCols, "a screen that did not opt in has no columns");
  ok(notSplit.screenW <= 700,
     `and stays in the reading column while its neighbour widens (${notSplit.screenW}px)`);

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
  ok(res.screenW > 700,
     `and the screen widened to hold them (${res.screenW}px — a reading column means it did not)`);
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
  console.log("\nthe laptop gets a website: one nav, a readable column, nothing trapped");
})();
