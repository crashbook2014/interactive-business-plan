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
const { playwright, launchOpts, APP, signInStub, paywallOn } = require("./_env.js");
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
  await p.evaluate(signInStub);
  await p.evaluate(paywallOn);
    await p.evaluate(signInStub);
    await p.evaluate(paywallOn);
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
        return { slack: Math.round(A.bottom - T.bottom) };
      });
      ok(after.slack <= 2,
         `nothing shows below the tab bar at the frame edge (${after.slack}px of slack)`);

      /* The analyze button lives on the intake screen now, not on home — so
         this walks there before measuring it. Still worth measuring: the
         screen scrolls, and a CTA the reader can see but not press is the
         same defect wherever it happens to live. */
      const cta = await p.evaluate(() => {
        show("intake");
        const a = document.querySelector(".app");
        if (a.scrollHeight > a.clientHeight) a.scrollTop = a.scrollHeight;
        else window.scrollTo(0, document.body.scrollHeight);
        return null;
      });
      void cta;
      await p.waitForTimeout(300);
      const reach = await p.evaluate(() => {
        const btn = document.getElementById("analyzeBtn");
        const B = btn ? btn.getBoundingClientRect() : null;
        if (!B || !B.height) return null;
        const centre = document.elementFromPoint(B.left + B.width / 2, B.top + B.height / 2);
        return centre ? (centre.id === "analyzeBtn" || btn.contains(centre)) : null;
      });
      if (reach !== null)
        ok(reach === true,
           "the primary call to action is clickable once scrolled to, not buried under the bar");
      await p.evaluate(() => show("home"));
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
  await p.evaluate(signInStub);
  await p.evaluate(paywallOn);
  await p.evaluate(() => { nat = "sa"; if (lang === "ar") toggleLang(); show("home"); });
  await p.waitForTimeout(300);
  const en = await geometry(p);
  ok(await p.evaluate(() => document.documentElement.dir) === "ltr", "the document is LTR");
  ok(near(en.gap, 56, 2), `the gap survives the direction flip (${en.gap})`);
  ok(near(en.leftEdge, en.rightEdge, 2),
     `still centred in LTR (${en.leftEdge} / ${en.rightEdge})`);
  ok(!en.hScroll, "no horizontal scroll in LTR");
  await p.close();

  /* ==================================================================
     Touch targets, both viewports the brief names, both languages.
     A sweep of every screen found four control groups under the 44px minimum
     the rest of the app already held to — and one of them, the privacy line on
     home, was under it ONLY IN ARABIC, because the English text wraps to two
     lines and the Arabic does not. Height should never be a translation side
     effect, which is why this runs in both. */
  console.log("\n— every control meets the 44px touch minimum, in both languages");
  {
    const SCENES = {
      onboard: `nat=null;obDone=false;obIndex=0;natGate=false;renderOnboard();show("onboard");`,
      home:    `nat="sa";obDone=true;show("home");`,
      result:  `nat="sa";obDone=true;owned={review:null,letter:null,case:null};
                current=SAMPLES.employment;current.srcText=null;renderResult();show("result");`,
      paywall: `nat="sa";obDone=true;owned={review:null,letter:null,case:null};
                current=SAMPLES.employment;current.srcText=null;
                pwMode="review";pwOrigin="review";pwUpgrade=null;pwPlan=0;
                renderPaywall();show("paywall");`,
      eos:     `nat="sa";obDone=true;show("eos");
                document.getElementById("eosStart").value="2020-01-01";
                document.getElementById("eosEnd").value="2026-01-01";
                document.getElementById("eosWage").value="9000";eosHow="term";calcEos();`,
      account: `nat="sa";obDone=true;goTab("account");`,
      assist:  `nat="sa";obDone=true;asked=0;chat=[];openAssist("rights");`,
    };
    for (const vw of [390, 430]) {
      for (const L of ["en", "ar"]) {
        const pg = await b.newPage({ viewport: { width: vw, height: vw === 390 ? 844 : 932 } });
        const errs = []; pg.on("pageerror", e => errs.push(e.message.slice(0, 90)));
        await pg.goto(APP); await pg.waitForTimeout(500);
    await pg.evaluate(signInStub);
    await pg.evaluate(paywallOn);
        await pg.evaluate(l => { if (lang !== l) { lang = l; applyLang(); } }, L);
        for (const [name, code] of Object.entries(SCENES)) {
          await pg.evaluate(code);
          /* AFTER the transition. Measuring during it reads a scaled ancestor
             and reports 43px for a control that is really 44 — which sent an
             earlier pass chasing a bug that did not exist. */
          await pg.waitForTimeout(700);
          const r = await pg.evaluate(() => {
            const scr = document.querySelector(".screen.active");
            if (!scr) return { small: ["NO ACTIVE SCREEN"], hScroll: false };
            const small = [...scr.querySelectorAll("button, a")]
              .filter(e => { if (e.closest(".sr-only")) return false;
                const b = e.getBoundingClientRect();
                return b.height > 0 && b.height < 44; })
              .map(e => (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 22)
                        + " " + Math.round(e.getBoundingClientRect().height) + "px");
            return { small: [...new Set(small)],
                     hScroll: document.documentElement.scrollWidth > window.innerWidth + 1 };
          });
          ok(r.small.length === 0,
             `${vw} ${L} ${name}: every control is at least 44px${r.small.length ? " — " + r.small.join(", ") : ""}`);
          ok(!r.hScroll, `${vw} ${L} ${name}: the page does not scroll sideways`);
        }
        ok(errs.length === 0, `${vw} ${L}: no page errors${errs.length ? " — " + errs[0] : ""}`);
        await pg.close();
      }
    }
  }

  /* The single most important control in the funnel had no button styling at
     all: `.cta` has no base rule in this stylesheet, so inside .scan-lock it
     inherited nothing — 27px tall, no background, no padding, rendering as a
     line of text. Asserted on the computed style, not on the class list. */
  console.log("\n— the free-scan paywall button looks like a button");
  {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    await pg.goto(APP); await pg.waitForTimeout(500);
    await pg.evaluate(signInStub);
    await pg.evaluate(paywallOn);
    for (const L of ["en", "ar"]) {
      const r = await pg.evaluate(l => {
        lang = l; applyLang(); nat = "sa"; obDone = true;
        owned = { review:null, letter:null, case:null };
        current = SAMPLES.employment; current.srcText = null;
        renderResult(); show("result");
        const el = document.getElementById("scanBuy");
        if (!el) return null;
        const c = getComputedStyle(el), b = el.getBoundingClientRect();
        return { h: b.height, bg: c.backgroundColor, pad: parseFloat(c.paddingTop),
                 w: b.width, parentW: el.parentElement.clientWidth };
      }, L);
      ok(!!r, `${L}: the unlock button renders`);
      if (r) {
        ok(r.h >= 44, `${L}: it is at least 44px tall (${Math.round(r.h)})`);
        ok(r.pad >= 10, `${L}: it has real padding (${r.pad}px)`);
        ok(!/rgba\(0, 0, 0, 0\)|transparent/.test(r.bg), `${L}: it has a filled background (${r.bg})`);
        ok(r.w > r.parentW * 0.8, `${L}: and spans its panel (${Math.round(r.w)} of ${r.parentW})`);
      }
    }
    await pg.close();
  }

  /* THE TOUR'S "NEXT" BUTTON WAS OFF THE BOTTOM OF THE SCREEN, and had been
     for some time — measured off-viewport in English at 390x844 and in both
     languages at 360x640, before any of the recent copy was added. The card
     had a min-height and no max-height, so the tallest one (the nationality
     question: two choice boxes and the longest body text) simply grew past the
     viewport and took its own advance button with it. The only way on was to
     scroll a screen that gives no sign there is anything to scroll to.

     Geometric, and across the small viewports where it actually broke — the
     rest of this suite runs at 1440x900 and 390x844, which is exactly why
     nothing caught it. The disclosure note is included: a disclosure the
     reader has to scroll to find is not a disclosure. */
  console.log("\n— every onboarding card keeps its footer on screen");
  {
    for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 },
                      { width: 414, height: 896 }]) {
      const pg = await b.newPage({ viewport: vp });
      await pg.goto(APP); await pg.waitForTimeout(400);
      for (const L of ["en", "ar"]) {
        const worst = await pg.evaluate(l => {
          lang = l; applyLang();
          let out = { off: [], n: 0 };
          for (let i = 0; i < OB.length; i++) {
            obIndex = i; natGate = false; renderOnboard();
            out.n++;
            const btn = document.getElementById("obNext").getBoundingClientRect();
            const note = document.getElementById("obNote");
            const nr = note.hidden ? null : note.getBoundingClientRect();
            if (btn.bottom > innerHeight + 1 || btn.top < 0) out.off.push("button@" + i);
            if (nr && (nr.bottom > innerHeight + 1 || nr.top < 0)) out.off.push("note@" + i);
          }
          return out;
        }, L);
        ok(worst.n === 5, `${vp.width}x${vp.height} ${L}: all ${worst.n} cards rendered`);
        ok(worst.off.length === 0,
           `${vp.width}x${vp.height} ${L}: footer stays on screen (${worst.off.join(", ") || "every card"})`);
      }
      await pg.close();
    }
  }

  await b.close();
  if (FAIL.length){
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach(f => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nall layout checks passed");
})().catch(e => { console.error(e); process.exit(1); });
