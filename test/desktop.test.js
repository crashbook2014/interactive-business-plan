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
    const hero = document.querySelector(".hm-hero");
    return { h: (document.getElementById("hmHeroH") || {}).textContent || "",
             sub: (document.getElementById("hmHeroP") || {}).textContent || "",
             meta: (document.getElementById("deskMeta") || {}).textContent || "",
             shown: a ? getComputedStyle(a).display !== "none" : false,
             heroShown: hero ? getComputedStyle(hero).display !== "none" : false };
  }, fn);

  console.log("— the retired aside, and the copy that outlived it");
  const home = await asideOn('goTab("home")');
  /* Retired, not deleted. The panel is gone from the laptop; the lines it
     chose are the ones home now reads as its own hero, so every assertion
     below still guards live copy. */
  ok(!home.shown, "the brand panel no longer sits beside a framed phone");
  ok(home.heroShown, "and its two lines are read as home's own hero instead");
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
    const before = document.getElementById("hmHeroH").textContent;
    toggleLang();
    const after = document.getElementById("hmHeroH").textContent;
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

  /* HOME, WHICH IS THE WHOLE COMPLAINT. "The desktop still looks like a
     phone" — and measured, it was worse than one: eight doors at 199px each on
     a 1440px laptop against 354px on a 390px phone, because .sit-grid switched
     to two columns on WINDOW width while the frame stayed 440px. */
  console.log("\n— home is a front page, and its doors are not narrower than a phone's");
  const doorAt = async (w, h) => {
    const q = await b.newPage({ viewport: { width: w, height: h } });
    await q.goto(APP);
    await q.waitForFunction(() => typeof window.show === "function");
    const r = await q.evaluate(() => {
      nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
      goTab("home");
      const cards = [...document.querySelectorAll("#situations .sit-card")].filter((c) => !c.hidden);
      const first = cards[0].getBoundingClientRect();
      const top = first.top;
      const hero = document.querySelector(".hm-hero");
      return {
        n: cards.length,
        w: Math.round(first.width),
        perRow: cards.filter((c) => Math.abs(c.getBoundingClientRect().top - top) < 4).length,
        allAbove: cards.every((c) => c.getBoundingClientRect().bottom <= window.innerHeight + 1),
        heroShown: hero ? getComputedStyle(hero).display !== "none" : false,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    await q.close();
    return r;
  };

  const phoneDoor = await doorAt(390, 844);
  ok(phoneDoor.perRow === 1, `on a phone the doors are one per row (${phoneDoor.perRow})`);
  ok(!phoneDoor.heroShown,
     "and there is no hero on a phone, where it would only push them under the fold");

  const deskDoor = await doorAt(1440, 900);
  ok(deskDoor.perRow === 2, `on a laptop they are two across (${deskDoor.perRow})`);
  /* THE NUMBER THE WHOLE COMPLAINT COMES DOWN TO. 199px was the bug, 354px is
     what a 390px phone gives, and a laptop must beat the phone rather than
     merely beat the bug. Three columns cleared 320 but never cleared 354 at
     any width, which is why they are not used. */
  ok(deskDoor.w > 354,
     `and a door is ${deskDoor.w}px — wider than the phone's 354px, where the defect drew 199px`);
  ok(deskDoor.allAbove,
     `with all ${deskDoor.n} of them reachable without scrolling`);
  ok(deskDoor.heroShown, "and a hero above them");
  ok(!deskDoor.overflow, "with no sideways overflow");

  /* THE SMALL LAPTOP, where three columns fit only in the sense that they do
     not overflow: they draw a 319px door, narrower than the 354px the phone
     gets. Column count follows the room, not the breakpoint. */
  const smallLaptop = await doorAt(1024, 768);
  ok(smallLaptop.perRow === 2,
     `a 1024px laptop gets two doors across, not three squeezed (${smallLaptop.perRow})`);
  ok(smallLaptop.w > 354,
     `at ${smallLaptop.w}px each, still beating the phone — three across drew 319px here`);
  ok(!smallLaptop.overflow, "with no sideways overflow there either");

  /* THE BOUNDARY WHERE A THIRD COLUMN USED TO APPEAR. A door must never get
     smaller because the window got bigger — that is the defect in one
     sentence, and it is worth asserting across the crossing rather than only
     at convenient widths. */
  const below = await doorAt(1099, 900), above = await doorAt(1100, 900);
  ok(above.w >= below.w - 1,
     `crossing 1100 does not shrink a door (${below.w}px -> ${above.w}px)`);

  /* THE TABLET BAND, which had the same defect and no one had looked. At 768px
     the window is over 600 so the two-column rule fired, inside a 440px frame:
     197px doors on a device with more room than a phone, not less. */
  const tabletDoor = await doorAt(768, 1024);
  ok(tabletDoor.perRow === 1,
     `a tablet gets one door per row too, not two crushed into a phone column (${tabletDoor.perRow})`);
  ok(tabletDoor.w >= 320, `at ${tabletDoor.w}px (the old rule gave it 197px)`);

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

  /* NAVIGATION MUST STILL BE ANNOUNCED, ON BOTH PLATFORMS.
     show() focuses the new screen's first heading so a screen reader is told
     it has arrived. Focusing a display:none element is a SILENT no-op, so the
     moment a desktop-only heading was added above a screen's own one, the
     phone stopped moving focus at all — a reader changing tabs was left on the
     heading of the screen they had just left. Every suite stayed green. This
     is the assertion that was missing. */
  console.log("\n— arriving on a screen still moves focus into it, on both platforms");
  for (const [w, h, label] of [[390, 844, "phone"], [1440, 900, "laptop"]]) {
    const q = await b.newPage({ viewport: { width: w, height: h } });
    await q.goto(APP);
    await q.waitForFunction(() => typeof window.show === "function");
    const moved = await q.evaluate(() => {
      nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
      const out = {};
      for (const dest of ["home", "rights", "future"]) {
        goTab(dest === "home" ? "rights" : "home");   /* start somewhere else */
        goTab(dest);
        const a = document.activeElement;
        const scr = document.getElementById("screen-" + dest);
        out[dest] = { inside: scr.contains(a),
                      visible: a.offsetParent !== null,
                      what: a.tagName + "." + String(a.className).slice(0, 14) };
      }
      return out;
    });
    await q.close();
    for (const dest of ["home", "rights", "future"]) {
      ok(moved[dest].inside,
         `${label}: arriving at ${dest} moves focus into it (${moved[dest].what})`);
      ok(moved[dest].visible,
         `${label}: and onto something actually on screen, not a hidden element`);
    }
  }

  /* THE SIDEWAYS FLASH, which only a mid-animation measurement can see.
     screen-lateral settles DOWN from scale(1.012). While a screen was a 440px
     column inside a wider window there was nowhere for 1.2% to go; now the
     screen is the page, so at 1024 it became 1036 for the length of every tab
     change and a horizontal scrollbar appeared and vanished each time. A
     settled measurement says the layout is fine, and it is — which is exactly
     why this one is taken while the animation is still running. */
  console.log("\n— and no sideways flash while a screen is arriving");
  const flash = await b.newPage({ viewport: { width: 1024, height: 768 } });
  await flash.goto(APP);
  await flash.waitForFunction(() => typeof window.show === "function");
  const mid = await flash.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    goTab("rights"); goTab("home");
    const de = document.documentElement;
    const s = document.getElementById("screen-home").getBoundingClientRect();
    return { over: de.scrollWidth - de.clientWidth,
             w: Math.round(s.width), vw: de.clientWidth };
  });
  await flash.close();
  ok(mid.over <= 0,
     `nothing overhangs mid-transition at 1024 (${mid.w}px in ${mid.vw}px, ${mid.over}px over)`);

  /* THE EMPTY HALF, which the split itself created. #eosOut has nothing in it
     until the reader presses Calculate, so widening this screen bought a 496px
     column of blank cream beside the form — the same emptiness the desktop
     layout exists to remove. */
  console.log("\n— the calculator's second column is never blank");
  const preState = await p.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    /* Explicit, not inherited. An earlier section of this suite toggles the
       language to prove the hero follows it, so anything after that runs in
       English unless it says otherwise — which is how the Arabic assertion
       below first failed on text that was perfectly correct. */
    if (document.documentElement.lang !== "ar") toggleLang();
    goTab("rights"); openEos();
    const col = document.querySelector(".screen.active .dk-b").getBoundingClientRect();
    const pre = document.getElementById("eosPre");
    const before = { h: Math.round(col.height), shown: !pre.hidden,
                     text: pre.textContent.replace(/\s+/g, " ").trim() };
    document.getElementById("eosStart").value = "2019-01-01";
    document.getElementById("eosEnd").value = "2025-01-01";
    document.getElementById("eosWage").value = "10000";
    calcEos();
    const after = { preHidden: pre.hidden,
                    hasFigure: !!document.getElementById("eosOut").textContent.trim() };
    document.getElementById("eosWage").value = "";
    calcEos();
    return { before, after, preBack: !pre.hidden };
  });
  ok(preState.before.h > 40,
     `it has something in it before a figure exists (${preState.before.h}px tall, was 0)`);
  ok(preState.before.shown, "and what it holds is the method, not filler");
  /* The words are the app's own, already-reviewed copy — the two band labels
     the result itself prints — so this is also the check that they were not
     quietly replaced with something new and unreviewed about the law. */
  ok(/نصف شهر عن كل سنة/.test(preState.before.text) && /84/.test(preState.before.text),
     "the rule and its articles, in the app's existing words");
  ok(preState.after.hasFigure && preState.after.preHidden,
     "it yields the slot the moment there is a real answer");
  ok(preState.preBack,
     "and comes back when the inputs are cleared, rather than leaving it blank again");

  const preOnPhone = await b.newPage({ viewport: { width: 390, height: 844 } });
  await preOnPhone.goto(APP);
  await preOnPhone.waitForFunction(() => typeof window.show === "function");
  const phonePre = await preOnPhone.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    goTab("rights"); openEos();
    return getComputedStyle(document.getElementById("eosPre")).display !== "none";
  });
  await preOnPhone.close();
  ok(!phonePre,
     "and it does not appear on a phone, where there is no column for it to fill");

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
