/* The result screen, checked as a document rather than as output.
 *
 * WHY THIS EXISTS. The screen that reads a contract is the one people
 * screenshot, forward, and argue from. It had every fact a report needs and
 * none of a report's structure: the provenance was four separately-centred
 * grey captions stacked under the ring, and the findings list opened with a
 * screen-reader-only heading, so a sighted reader got no "findings" at all and
 * no count of what was found.
 *
 * Structure is the kind of thing that decays quietly — a line gets moved out
 * of the block "temporarily", a heading goes back to sr-only in a layout pass,
 * and nothing fails. So each of the three claims below is asserted on the
 * rendered DOM, in both languages.
 *
 * THE FOURTH CLAIM IS THE ONE THAT MATTERS COMMERCIALLY. The free scan shows
 * one flag and deliberately withholds how many there are — renderDecision()
 * switches #dcWhy to a kind rather than a count for exactly that reason, and
 * test/commerce.test.js holds that line. A tally above the list would hand
 * over the number the rest of the screen is careful not to give. That it is
 * suppressed when locked is checked here rather than left to the eye.
 */
const { playwright, launchOpts, APP, paywallOn } = require("./_env.js");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const LANGS = ["ar", "en"];

(async () => {
  const b = await chromium.launch(launchOpts());

  /* show(), not just renderResult(). An inactive screen is display:none, so
     every geometry read comes back 0 and every visibility read lies — which is
     how an earlier guard in this repo reported a passing three-step size
     ladder above three zero-height rows. */
  const render = async (p, l, unlocked) => p.evaluate(([lang_, un]) => {
    lang = lang_; applyLang(); nat = "sa"; obDone = true;
    owned = { review: un ? "plan_review" : null, letter: null, case: null };
    current = SAMPLES.employment; current.srcText = null;
    journey = "contract";
    renderResult(); renderDuties(); show("result");
  }, [l, unlocked]);

  for (const l of LANGS) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");
    await p.evaluate(paywallOn);

    /* ------------------------------------------------ 1. the masthead */
    console.log(`\n— ${l}: the screen says what kind of document it is`);
    /* RENDER FIRST. The first version read the masthead straight after goto(),
       before render() had set the language — so both passes read the page in
       its default Arabic and the English assertions printed «مراجعة عقد» and
       called it English. A bilingual loop that never switches language is two
       copies of one test. */
    await render(p, l, true);
    const head = await p.evaluate(() => {
      const el = document.querySelector("#screen-result .rp-head");
      if (!el) return null;
      const vis = (n) => {
        const s = getComputedStyle(n);
        return s.display !== "none" && s.visibility !== "hidden";
      };
      const card = document.querySelector("#screen-result .score-card");
      return {
        shown: vis(el),
        first: !!card && card.firstElementChild === el,
        kicker: (el.querySelector(".rp-kicker") || {}).textContent || "",
        date: (el.querySelector("#rpDate") || {}).textContent || "",
        mark: !!el.querySelector("svg use"),
      };
    });
    const head2 = head ? head.date : "";

    ok(!!head && head.shown, `${l}: the masthead is present and visible`);
    ok(!!head && head.first, `${l}: it is the first thing in the card, above the verdict`);
    ok(!!head && head.kicker.trim().length > 2,
       `${l}: it names the document ("${head && head.kicker.trim()}")`);
    ok(!!head && head.mark, `${l}: it carries the Wodouh mark`);
    /* A date, and a real one — not the empty string the element ships with.
       Asserted after a render, because renderReportHead() is what fills it. */
    ok(/\d|[٠-٩]/.test(head2),
       `${l}: and a date the review can be filed by ("${head2}")`);

    /* -------------------------------------- 2. scope and sources, collected */
    console.log(`\n— ${l}: the provenance is one block, not four loose captions`);
    const meta = await p.evaluate(() => {
      const m = document.querySelector("#screen-result .rp-meta");
      if (!m) return null;
      const inside = (sel) => !!m.querySelector(sel);
      return {
        heading: (m.querySelector(".rp-meta-h") || {}).textContent || "",
        scope: inside("#scopeNote"),
        method: inside(".src-line.method"),
        stamp: inside(".currency"),
        how: inside(".how-built"),
        /* Nothing of the four may remain OUTSIDE the block — moving one out is
           exactly the regression this exists to catch, and a test that only
           checks what is inside would pass with a duplicate left behind. */
        strayScope: !!document.querySelector("#screen-result #scopeNote:not(.rp-meta *)"),
        strayHow: !!document.querySelector("#screen-result .how-built:not(.rp-meta *)"),
      };
    });
    ok(!!meta, `${l}: the scope-and-sources block exists`);
    ok(!!meta && meta.heading.trim().length > 2,
       `${l}: it is labelled ("${meta && meta.heading.trim()}")`);
    for (const [what, key] of [["the scope line", "scope"], ["the method line", "method"],
                               ["the references date", "stamp"], ["the how-it-is-built link", "how"]])
      ok(!!meta && meta[key], `${l}: it contains ${what}`);
    ok(!!meta && !meta.strayScope && !meta.strayHow,
       `${l}: and none of them is left loose outside it`);

    /* ------------------------------------------ 3. the findings have a head */
    console.log(`\n— ${l}: the findings are headed and counted`);
    const fx = await p.evaluate(() => {
      const h = document.querySelector("#screen-result .fx-head h3");
      const t = document.getElementById("flagTally");
      const chips = [...(t ? t.querySelectorAll(".fx-chip") : [])];
      const shown = (n) => {
        if (!n) return false;
        const s = getComputedStyle(n);
        return s.display !== "none" && s.visibility !== "hidden"
            && !n.closest(".sr-only") && !n.classList.contains("sr-only");
      };
      /* Counted from the RENDERED flags, never from a number written in this
         file: the assertion is "the tally agrees with the list", and a list
         length hardcoded here would stop being that the first time the sample
         changes. */
      const real = {};
      document.querySelectorAll("#flags .flag").forEach((f) => {
        ["red", "amber", "green"].forEach((s) => {
          if (f.classList.contains(s)) real[s] = (real[s] || 0) + 1;
        });
      });
      const said = {};
      chips.forEach((c) => {
        const sev = ["red", "amber", "green"].find((s) => c.classList.contains(s));
        const n = (c.querySelector("b") || {}).textContent || "";
        /* Arabic-Indic digits are what fmtNum produces in Arabic. */
        said[sev] = Number(n.replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660));
      });
      return { headShown: shown(h), headText: (h || {}).textContent || "",
               chips: chips.length, real, said };
    });
    ok(fx.headShown, `${l}: the findings heading is on screen, not screen-reader-only`);
    ok(fx.headText.trim().length > 2, `${l}: and it says something ("${fx.headText.trim()}")`);
    ok(fx.chips > 0, `${l}: the tally rendered (${fx.chips} chips)`);
    const mismatch = Object.keys(fx.real).filter((s) => fx.said[s] !== fx.real[s]);
    ok(mismatch.length === 0,
       `${l}: every count matches the flags on the page (${
         Object.keys(fx.real).map((s) => `${s} ${fx.real[s]}`).join(", ")})${
         mismatch.length ? " — disagrees on: " + mismatch.join(", ") : ""}`);

    /* ----------------------------- 4. the free scan still counts nothing */
    console.log(`\n— ${l}: a locked review is not handed the number it is denied`);
    await render(p, l, false);
    const locked = await p.evaluate(() => {
      const t = document.getElementById("flagTally");
      const shown = t && getComputedStyle(t).display !== "none";
      const head = document.querySelector("#screen-result .fx-head");
      return { shown: !!shown, chips: t ? t.querySelectorAll(".fx-chip").length : -1,
               headText: head ? head.textContent : "",
               flags: document.querySelectorAll("#flags .flag").length };
    });
    ok(locked.flags === 1,
       `${l}: the free scan still shows one flag (${locked.flags}) — the premise of this check`);
    ok(locked.chips === 0 && !locked.shown,
       `${l}: the tally is gone, not merely emptied (${locked.chips} chips, shown=${locked.shown})`);
    ok(!/\d|[٠-٩]/.test(locked.headText),
       `${l}: and no digit survives anywhere in the findings header ("${locked.headText.trim()}")`);

    await p.close();
  }

  await b.close();
  console.log("\n" + (FAIL.length
    ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
    : "the result screen reads as a report: headed, dated, sourced in one place, and counted only where counting is paid for"));
  process.exit(FAIL.length ? 1 : 0);
})();
