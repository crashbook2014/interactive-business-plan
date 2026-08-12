/* Layout at widths that are not a phone.
 *
 * WHY THIS SUITE EXISTS
 *
 * The founder opened the app on a laptop and said it "doesn't show the right
 * way". It didn't, and none of the other suites could have known: every one of
 * them runs at 390×844, so the desktop layout had never been rendered by
 * anything that looks at it.
 *
 * Three defects, all invisible to a phone-sized test:
 *
 *   1. `.app` inherits `margin: 0 auto` from the mobile rule. Inside the
 *      desktop flex body, an auto margin swallows the free space *before*
 *      justify-content runs — so the 56px gap rendered as 323px and shoved the
 *      brand panel to the far edge while the phone floated left of centre.
 *   2. The frame was a fixed-height scroll box at any window height. On a
 *      1280×720 laptop the home screen's 1329px was crushed into 660px.
 *   3. The frame kept 20px of padding under a bottom-stuck tab bar, so a strip
 *      of whatever you were scrolling showed through the gap between the bar
 *      and the rounded frame edge. It read as a rendering fault.
 *
 * These assertions are geometric on purpose. "Looks fine" is not a test; a gap
 * that must equal 56 and margins that must match each other are.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* Real sizes, not round numbers: a 13" MacBook, a 14" laptop, an older 1080p
   desktop, a tablet, and the two edges of the desktop breakpoint. */
const VIEWPORTS = [
  /* A phone, so this suite notices if a desktop rule ever leaks down. */
  { w:  390, h: 844, desk: false, framed: false, name: "iPhone" },
  { w: 1512, h: 982, desk: true,  name: "MacBook 14\"" },
  { w: 1440, h: 900, desk: true,  name: "MacBook 13\"" },
  { w: 1280, h: 720, desk: true,  name: "1280×720 laptop" },
  { w: 1024, h: 768, desk: true,  name: "1024×768" },
  { w:  900, h: 800, desk: true,  name: "breakpoint, just over" },
  { w:  899, h: 800, desk: false, name: "breakpoint, just under" },
  { w:  768, h: 900, desk: false, name: "tablet" },
];

async function geometry(p){
  return p.evaluate(() => {
    const box = el => {
      const b = el.getBoundingClientRect();
      return { l: Math.round(b.left), r: Math.round(b.right),
               t: Math.round(b.top), b: Math.round(b.bottom),
               w: Math.round(b.width), h: Math.round(b.height) };
    };
    const app = document.querySelector(".app");
    const aside = document.querySelector(".desk-aside");
    const tab = document.getElementById("tabbar");
    const asideShown = getComputedStyle(aside).display !== "none";
    const A = box(app), S = asideShown ? box(aside) : null;
    return {
      vw: innerWidth, vh: innerHeight,
      app: A, aside: S, asideShown,
      appMarginInline: getComputedStyle(app).marginInlineStart,
      gap: S ? Math.min(Math.abs(S.l - A.r), Math.abs(A.l - S.r)) : null,
      leftEdge: S ? Math.min(A.l, S.l) : A.l,
      rightEdge: innerWidth - (S ? Math.max(A.r, S.r) : A.r),
      hScroll: document.documentElement.scrollWidth > innerWidth + 1,
      pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
      appScrolls: app.scrollHeight > app.clientHeight + 1,
      tabShown: tab && !tab.hidden,
      tabBottom: tab && !tab.hidden ? box(tab).b : null,
    };
  });
}

(async () => {
  const b = await chromium.launch(launchOpts());

  for (const v of VIEWPORTS) {
    console.log(`\n— ${v.name} (${v.w}×${v.h})`);
    const p = await b.newPage({ viewport: { width: v.w, height: v.h } });
    p.on("pageerror", e => FAIL.push(`pageerror @${v.name}: ${e.message}`));
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");
    await p.evaluate(() => { nat = "sa"; show("home"); });
    await p.waitForTimeout(250);

    const g = await geometry(p);

    /* Never, at any width. A horizontal scrollbar on a layout this simple
       means something is wider than its container. */
    ok(!g.hScroll, "no horizontal page scroll");

    ok(g.asideShown === v.desk,
       `brand panel ${v.desk ? "shown" : "hidden"} as expected`);

    if (v.desk) {
      /* The defect, stated as a number. 56px is what the CSS asks for; the
         bug rendered 323. */
      ok(near(g.gap, 56, 2), `frame and panel sit 56px apart (${g.gap})`);

      /* An auto margin here is the bug itself, so assert its absence directly
         rather than only its symptom. */
      ok(g.appMarginInline !== "auto" && g.appMarginInline !== "0px auto",
         `the frame has no auto margin to swallow the gap (${g.appMarginInline})`);

      /* Equal margins either side is what "centred" means, and it is the thing
         the eye actually notices. */
      ok(near(g.leftEdge, g.rightEdge, 2),
         `the pair is centred (${g.leftEdge} left, ${g.rightEdge} right)`);
    } else {
      ok(near(g.leftEdge, g.rightEdge, 2),
         `single column is centred (${g.leftEdge} / ${g.rightEdge})`);
    }

    /* Content must be reachable one way or another: either the frame scrolls
       or the page does. If neither, something is unreachable — which is what
       "the paste box is behind the tab bar" actually meant. */
    const homeIsTall = await p.evaluate(() => {
      const app = document.querySelector(".app");
      return app.scrollHeight > 1000;
    });
    if (homeIsTall)
      ok(g.appScrolls || g.pageScrolls,
         "the home screen is reachable — something scrolls");

    /* On a tall desktop the frame should be a fixed device, so the page itself
       must not scroll. A framed phone that also scrolls the page wobbles under
       a trackpad and looks unfinished. */
    if (v.desk && v.h >= 900)
      ok(!g.pageScrolls, "on a tall window the frame is fixed and the page does not scroll");

    /* On a short desktop the opposite: the frame grows and the page scrolls,
       rather than crushing 1329px of content into a 660px box. */
    if (v.desk && v.h < 860)
      ok(g.pageScrolls, "on a short window the page scrolls instead of trapping content");

    /* Scroll to the bottom and check nothing peeks below the tab bar. That
       strip of leftover content was the "clipped teal bar" on the home screen.
       Only meaningful where a frame edge is drawn — on a phone the same strip
       sits below the viewport and nobody ever sees it. */
    const framed = v.framed !== false && v.w >= 600;
    if (g.tabShown && framed) {
      await p.evaluate(() => {
        const a = document.querySelector(".app");
        if (a.scrollHeight > a.clientHeight) a.scrollTop = a.scrollHeight;
        else window.scrollTo(0, document.body.scrollHeight);
      });
      await p.waitForTimeout(300);
      const after = await p.evaluate(() => {
        const app = document.querySelector(".app");
        const tab = document.getElementById("tabbar");
        const A = app.getBoundingClientRect(), T = tab.getBoundingClientRect();
        const btn = document.getElementById("analyzeBtn");
        const B = btn ? btn.getBoundingClientRect() : null;
        const centre = B ? document.elementFromPoint(B.left + B.width / 2, B.top + B.height / 2) : null;
        return { slack: Math.round(A.bottom - T.bottom),
                 ctaReachable: centre ? (centre.id === "analyzeBtn" || btn.contains(centre)) : null };
      });
      ok(after.slack <= 2,
         `nothing shows below the tab bar at the frame edge (${after.slack}px of slack)`);
      if (after.ctaReachable !== null)
        ok(after.ctaReachable === true,
           "the primary call to action is clickable once scrolled to, not buried under the bar");
    }

    await p.close();
  }

  /* Both languages, because RTL reverses the flex row and the panel changes
     sides. A layout that only holds in one direction holds in neither. */
  console.log("\n— English, LTR, at desktop width");
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on("pageerror", e => FAIL.push("pageerror @en: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");
  await p.evaluate(() => { nat = "sa"; if (lang === "ar") toggleLang(); show("home"); });
  await p.waitForTimeout(300);
  const en = await geometry(p);
  ok(await p.evaluate(() => document.documentElement.dir) === "ltr", "the document is LTR");
  ok(near(en.gap, 56, 2), `the gap survives the direction flip (${en.gap})`);
  ok(near(en.leftEdge, en.rightEdge, 2),
     `still centred in LTR (${en.leftEdge} / ${en.rightEdge})`);
  ok(!en.hScroll, "no horizontal scroll in LTR");
  await p.close();

  await b.close();
  if (FAIL.length){
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach(f => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nall layout checks passed");
})().catch(e => { console.error(e); process.exit(1); });
