/* Gesture navigation and the motion around it.
 *
 * A back-swipe is the one interaction where the reader supplies the animation
 * themselves, so it is also the one where a mistake is felt rather than seen.
 * Three defects lived here, and none of them would have shown up in a
 * screenshot:
 *
 *   1. Committing threw the drag away. The handler reset the transform and
 *      navigated in the same tick, so a screen the reader had just pulled 60px
 *      snapped back to centre and the destination replayed a canned entry from
 *      the opposite side. The gesture succeeded and looked like it had failed.
 *   2. Commit was decided on distance alone. A fast 45px flick — unmistakably
 *      a back gesture — sprang back and did nothing, because velocity was
 *      never sampled at all.
 *   3. Root screens rendered no drag feedback whatsoever, then jumped to
 *      another tab on release. A gesture that does not track the finger is not
 *      a gesture; it is a hidden shortcut.
 *
 * And one timing bug: the intake screen focused its paste box on a hardcoded
 * 260ms against a 360ms (--t-slow) entry animation, so the iOS keyboard rose
 * 100ms early — a visual-viewport resize and full relayout landing inside a
 * running transform animation.
 *
 * These are asserted as behaviour, not as source text: the point is what the
 * screen does, not which constant produced it.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch(launchOpts());
  /* hasTouch, because initGestures() returns early on a non-coarse pointer —
     without it every assertion below would pass against a handler that never
     bound a single listener. */
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");
  await p.evaluate(() => { nat = "sa"; obDone = true; show("home"); });

  /* ---- 1. the tab a drag would reach, and the ends of the row */
  console.log("— a horizontal drag knows which tab it would reach, and when there is none");
  const nb = await p.evaluate(() => ({
    ltrLeftFromHome:  tabNeighbour("home", -50, false),
    ltrRightFromHome: tabNeighbour("home", 50, false),
    ltrLeftFromAcct:  tabNeighbour("account", -50, false),
    rtlLeftFromHome:  tabNeighbour("home", -50, true),
    rtlRightFromHome: tabNeighbour("home", 50, true),
    notARoot:         tabNeighbour("intake", -50, false)
  }));
  ok(nb.ltrLeftFromHome === "rights",
     `dragging left from home reaches rights (${nb.ltrLeftFromHome})`);
  ok(nb.ltrRightFromHome === null,
     "and there is nothing to the right of the first tab, so no preview is promised");
  ok(nb.ltrLeftFromAcct === null,
     "nor past the last tab");
  /* RTL reverses the row. Getting this backwards would send an Arabic reader
     the wrong way on every swipe, which is most of this product's readers. */
  ok(nb.rtlLeftFromHome === null && nb.rtlRightFromHome === "rights",
     "and the direction is mirrored in Arabic, not repeated");
  ok(nb.notARoot === null, "a non-root screen has no tab neighbour at all");

  /* ---- 2. arriving by gesture does not replay a slide the thumb already did */
  console.log("\n— a screen entered by gesture cross-fades instead of sliding");
  const ent = await p.evaluate(() => {
    show("home");
    gestureNav = true; show("intake"); gestureNav = false;
    const el = document.getElementById("screen-intake");
    const byGesture = { cls: el.classList.contains("gesture"),
                        name: getComputedStyle(el).animationName,
                        ms: getComputedStyle(el).animationDuration };
    show("home"); show("intake");
    const el2 = document.getElementById("screen-intake");
    return { byGesture, byTap: { cls: el2.classList.contains("gesture"),
                                 name: getComputedStyle(el2).animationName } };
  });
  ok(ent.byGesture.cls === true, "a gesture-committed navigation marks the screen");
  ok(ent.byGesture.name === "screen-gesture",
     `and it cross-fades rather than sliding (${ent.byGesture.name})`);
  ok(ent.byTap.cls === false && ent.byTap.name === "screen-in",
     `while an ordinary tap still slides along the reading direction (${ent.byTap.name})`);

  /* The whole point of the cross-fade is that it moves nothing. A translate
     here would play a movement the reader's thumb has already performed. */
  const frames = await p.evaluate(() => {
    for (const s of document.styleSheets) {
      let rules; try { rules = s.cssRules; } catch (e) { continue; }
      for (const r of rules)
        if (r.type === CSSRule.KEYFRAMES_RULE && r.name === "screen-gesture")
          return [...r.cssRules].map(k => k.style.cssText).join(" | ");
    }
    return null;
  });
  ok(frames && !/transform|translate/.test(frames),
     `the gesture entry animates opacity only (${frames})`);

  /* ---- 3. a committed drag leaves no transform behind
   *
   * The inline transform is cleared AFTER navigating, not before — clearing it
   * first is what produced the snap-back. But it must still be cleared, or the
   * screen opens offset the next time it is reached. */
  console.log("\n— a dragged screen is not left offset for its next visit");
  const left = await p.evaluate(async () => {
    const el = document.getElementById("screen-intake");
    show("intake");
    el.style.transform = "translateX(64px)";     /* as a live drag would set it */
    gestureNav = true; show("home"); gestureNav = false;
    el.style.transform = "";                     /* what release() does on commit */
    show("intake");
    /* The INLINE transform, not the computed one: at this instant the computed
       value is the entry animation's own first keyframe (translateX(16px)
       scale(.985)), which is the animation working correctly and says nothing
       about whether the drag was cleaned up. */
    return el.style.transform;
  });
  ok(left === "",
     `the inline drag transform is cleared after committing (got "${left}")`);

  /* ---- 4. the keyboard does not rise inside the entry animation */
  console.log("\n— the paste box is focused after the entry animation, not during it");
  const focus = await p.evaluate(() => new Promise(resolve => {
    show("home");
    const box = document.getElementById("pasteBox");
    box.blur();
    const el = document.getElementById("screen-intake");
    openIntake();
    const at0 = document.activeElement === box;
    /* 300ms: past the 260ms the old hardcoded timer used, and still inside the
       360ms (--t-slow) entry animation. This is the sample that catches the
       bug — checking only at t=0 and at the end passes happily against a focus
       that fires 100ms early, which is exactly what shipped. */
    let mid = null, settled = null;
    setTimeout(() => { mid = document.activeElement === box; }, 300);
    el.addEventListener("animationend", function done(ev) {
      if (ev.target !== el) return;
      el.removeEventListener("animationend", done);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        settled = document.activeElement === box;
        resolve({ at0, mid, settled });
      }));
    });
    setTimeout(() => { if (settled === null) resolve({ at0, mid, settled: document.activeElement === box }); }, 1500);
  }));
  ok(focus.at0 === false, "focus has not landed the instant the screen opens");
  ok(focus.mid === false,
     `nor 300ms in, while the entry animation is still running (was ${focus.mid})`);
  ok(focus.settled === true,
     "and it has landed once the animation finishes");

  /* ---- 4b. the finger actually moves something
   *
   * tabNeighbour() being right is not the fix; USING it in pointermove is. A
   * root screen used to render nothing at all while the finger travelled and
   * then jump to another tab on release. Synthetic touch pointer events,
   * because the handler ignores pointerType "mouse" outright. */
  console.log("\n— the screen tracks the finger, on a tab swipe as well as a back swipe");
  /* The app opens in Arabic, so dir is rtl and "inward" is mirrored. A first
     draft of this dragged left on both and measured nothing in either — which
     is not a bug in the handler but the exact confusion the handler exists to
     absorb. Both directions are asserted, because most of this product's
     readers are on the mirrored one. */
  const swipe = await p.evaluate(([screen, dx, wantAr]) => {
    if ((document.documentElement.lang === "ar") !== wantAr) toggleLang();
    show(screen);
    const app = document.querySelector(".app");
    const fire = (type, x) => app.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: "touch", clientX: x, clientY: 400, bubbles: true }));
    const el = document.querySelector(".screen.active");
    fire("pointerdown", 200);
    fire("pointermove", 200 + dx * 0.4);
    fire("pointermove", 200 + dx);
    const moved = el.style.transform;
    fire("pointerup", 200 + dx);
    el.style.transform = "";
    return moved;
  }, ["home", -70, false]);
  ok(/translateX\(-?\d/.test(swipe),
     `English: dragging on a root screen moves it under the finger (${swipe || "nothing"})`);

  const swipeAr = await p.evaluate(([screen, dx, wantAr]) => {
    if ((document.documentElement.lang === "ar") !== wantAr) toggleLang();
    show(screen);
    const app = document.querySelector(".app");
    const fire = (type, x) => app.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: "touch", clientX: x, clientY: 400, bubbles: true }));
    const el = document.querySelector(".screen.active");
    fire("pointerdown", 200);
    fire("pointermove", 200 + dx * 0.4);
    fire("pointermove", 200 + dx);
    const moved = el.style.transform;
    fire("pointerup", 200 + dx);
    el.style.transform = "";
    return moved;
  }, ["home", 70, true]);
  ok(/translateX\(\d/.test(swipeAr),
     `Arabic: the same swipe mirrored also moves it (${swipeAr || "nothing"})`);

  const back = await p.evaluate(([screen, dx, wantAr]) => {
    if ((document.documentElement.lang === "ar") !== wantAr) toggleLang();
    show(screen);
    const app = document.querySelector(".app");
    const fire = (type, x) => app.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: "touch", clientX: x, clientY: 400, bubbles: true }));
    const el = document.querySelector(".screen.active");
    fire("pointerdown", 100);
    fire("pointermove", 140);
    fire("pointermove", 180);
    const moved = el.style.transform;
    fire("pointerup", 180);
    el.style.transform = "";
    return moved;
  }, ["intake", 80, false]);
  ok(/translateX\(\d/.test(back),
     `and a back-swipe on a deep screen tracks the finger too (${back || "nothing"})`);
  /* The back-swipe pulls further per pixel than a tab swipe: it is a real
     page-drag, where the tab preview only hints. */
  const pull = parseFloat((back.match(/-?[\d.]+/) || [0])[0]);
  ok(pull > 40, `and pulls further per pixel than a tab hint (${pull}px for 80px of finger)`);

  /* ---- 4c. a flick commits; the same distance, dawdled over, does not
   *
   * This is the pair that proves velocity is carrying the decision. 45px is
   * deliberately under the 60px distance threshold, so a handler measuring
   * distance alone fails the first assertion — and one that has thrown the
   * threshold away entirely fails the second. Real delays between the events,
   * because velocity is sampled from event timestamps and a synchronous burst
   * has dt of zero. */
  console.log("\n— a fast flick commits, and the same distance dawdled over does not");
  const flick = await p.evaluate(async (wantAr) => {
    if ((document.documentElement.lang === "ar") !== wantAr) toggleLang();
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const app = document.querySelector(".app");
    const fire = (type, x) => app.dispatchEvent(new PointerEvent(type, {
      pointerId: 1, pointerType: "touch", clientX: x, clientY: 400, bubbles: true }));

    show("intake");
    fire("pointerdown", 100);
    await wait(16);
    fire("pointermove", 145);          /* 45px in ~16ms — unmistakably a flick */
    fire("pointerup", 145);
    const fast = document.querySelector(".screen.active").id;

    show("intake");
    fire("pointerdown", 100);
    for (let x = 105; x <= 145; x += 5){ await wait(30); fire("pointermove", x); }
    await wait(140);                   /* held still: the velocity goes stale */
    fire("pointerup", 145);
    const slow = document.querySelector(".screen.active").id;
    return { fast, slow };
  }, false);
  ok(flick.fast === "screen-home",
     `a 45px flick commits even though it never reaches 60px (landed on ${flick.fast.replace("screen-","")})`);
  ok(flick.slow === "screen-intake",
     `while the same 45px crawled and held does not (stayed on ${flick.slow.replace("screen-","")})`);

  /* ---- 5. reduced motion is honoured by the drag itself, not only by CSS
   *
   * The global prefers-reduced-motion rule shortens durations, but a live drag
   * writes an inline transform that no duration override touches. The handler
   * has to check for itself. */
  console.log("\n— a reader who asked for reduced motion is not dragged around");
  const rp = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true,
                               reducedMotion: "reduce" });
  rp.on("pageerror", e => FAIL.push("pageerror(reduced): " + e.message));
  await rp.goto(APP);
  await rp.waitForFunction(() => typeof window.show === "function");
  const red = await rp.evaluate(() => ({ matches: REDUCED.matches }));
  ok(red.matches === true, "the page sees the reduced-motion preference");

  const redFocus = await rp.evaluate(() => {
    nat = "sa"; obDone = true; show("home");
    document.getElementById("pasteBox").blur();
    openIntake();
    /* With reduced motion there is no animation to wait for, so focus is
       immediate rather than never. */
    return document.activeElement === document.getElementById("pasteBox");
  });
  ok(redFocus === true,
     "and the paste box is still focused — the wait is skipped, not the focus");
  await rp.close();

  /* ---- 6. long-scrolling screens move as you scroll, without a burst of
     entrance animation.
     armReveals() and onScroll() already gave the score card and several
     screens a small, restrained fade-and-rise plus a capped parallax drift.
     The rights library and the termination result were rebuilt with new
     card classes this session (.lib-item, .tm-sec, .tm-hero) and were never
     added to the selector or the drift target — they rendered fully formed
     with no relationship to scroll position at all, on the two screens most
     likely to be long enough for it to matter. */
  console.log("\n— the rights library and the termination result move with scroll");

  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p2.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p2.goto(APP);
  await p2.waitForFunction(() => typeof window.show === "function");

  const rights = await p2.evaluate(async () => {
    nat = "sa"; renderLib(); show("rights");
    const total = document.querySelectorAll("#screen-rights .lib-item").length;
    const before = document.querySelectorAll("#screen-rights .lib-item.in").length;
    window.scrollTo(0, 2000);
    await new Promise(r => setTimeout(r, 250));
    const after = document.querySelectorAll("#screen-rights .lib-item.in").length;
    return { total, before, after };
  });
  ok(rights.total > 5, `the library has enough cards to be worth revealing (${rights.total})`);
  ok(rights.before < rights.total,
     `cards below the fold are not all pre-revealed on arrival (${rights.before} of ${rights.total})`);
  ok(rights.after > rights.before,
     `scrolling reveals more of them (${rights.before} -> ${rights.after})`);

  const term = await p2.evaluate(async () => {
    term = Object.assign(blankTerm(), { how:"employer", start:"2018-01-01",
      end:"2026-01-31", wage:12000, noticeDue:60, noticeGiven:10, leaveDays:14,
      unpaidMonths:2, ctype:"indef", docs:["d_contract","d_letter"] });
    owned.case = "plan_case"; renderTermResult(); show("termres");
    window.scrollTo(0, 0);
    const flat = document.querySelector("#screen-termres .tm-hero .amt").style.transform;
    window.scrollTo(0, 600);
    await new Promise(r => setTimeout(r, 250));
    const drifted = document.querySelector("#screen-termres .tm-hero .amt").style.transform;
    const total = document.querySelectorAll("#screen-termres .tm-sec").length;
    const revealed = document.querySelectorAll("#screen-termres .tm-sec.in").length;
    return { flat, drifted, total, revealed };
  });
  ok(term.flat === "" || term.flat === "translateY(0px)",
     `the answer sits still at the top of the page (${term.flat})`);
  ok(term.drifted !== term.flat && /translateY\(-\d/.test(term.drifted),
     `and drifts a few pixels once the reader has scrolled past it (${term.drifted})`);
  ok(/translateY\(-([0-4]|5)(\.\d+)?px\)/.test(term.drifted),
     `the drift stays small — a few pixels, not a slide (${term.drifted})`);
  ok(term.revealed > 0 && term.total > 0,
     `the section cards themselves are part of the same reveal system (${term.revealed}/${term.total})`);

  /* Reduced motion must still refuse this, exactly as it refuses the score
     card's own drift — a second surface using the same onScroll() function
     must not be able to reintroduce motion the first surface correctly
     turns off. */
  const p3 = await b.newPage({ viewport: { width: 390, height: 844 },
                                reducedMotion: "reduce" });
  p3.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p3.goto(APP);
  await p3.waitForFunction(() => typeof window.show === "function");
  const stillFlat = await p3.evaluate(async () => {
    term = Object.assign(blankTerm(), { how:"employer", start:"2018-01-01",
      end:"2026-01-31", wage:12000, noticeDue:60, noticeGiven:10, leaveDays:14,
      unpaidMonths:2, ctype:"indef", docs:["d_contract","d_letter"] });
    owned.case = "plan_case"; renderTermResult(); show("termres");
    window.scrollTo(0, 600);
    await new Promise(r => setTimeout(r, 250));
    return document.querySelector("#screen-termres .tm-hero .amt").style.transform;
  });
  ok(stillFlat === "" || stillFlat === "translateY(0px)",
     `a reader who asked for reduced motion gets no drift here either (${stillFlat})`);
  await p2.close(); await p3.close();

  await b.close();
  console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\ngestures commit on flick or distance, keep their motion continuous, and never fight reduced motion");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
