/* Navigation is intention.
 *
 * A reader should move because they chose to, never because they were bounced.
 * That means no visible, enabled control may lead somewhere other than where
 * its label says — and specifically, nothing but a sign-in control may land a
 * reader on the sign-in screen.
 *
 * This is not the same assertion as the gate suites make. Those prove the gate
 * HOLDS: that a signed-out reader cannot reach a governed screen. This proves
 * the gate is never REACHED by accident — that the app does not offer a door
 * it will then refuse to open. Both can pass while the product is wrong in
 * opposite directions, so both exist.
 *
 * The failure this replaces was concrete: the tab bar rendered all five tabs
 * to a signed-out reader on the rights library, and three of them (home,
 * timeline, account) redirected straight to sign-in. Five doors, two that
 * opened.
 */
const { playwright, launchOpts, APP, SHOWN_SRC } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* The whole suite is meaningless on an unconfigured build, where authAllow()
     lets everything through by design. Say so rather than passing emptily. */
  const gated = await p.evaluate(() => typeof authOn === "function" && authOn());
  ok(gated === true, "the build is configured, so the gate is actually on");

  for (const L of ["ar", "en"]) {
    console.log(`\n— ${L}: signed out, every tab in the bar opens`);
    const r = await p.evaluate((l) => {
      if (lang !== l) toggleLang();
      nat = "sa"; obDone = true; authUser = null;         /* signed out, tour done */
      goTab("rights");                                     /* a surface they may read */
      const bar = document.getElementById("tabbar");
      const tabs = [...bar.querySelectorAll("[data-tab]")];
      return {
        landed: (document.querySelector(".screen.active") || {}).id,
        barShown: !bar.hidden,
        ids: tabs.map((t) => t.dataset.tab),
        labels: tabs.map((t) => (t.querySelector("span") || {}).textContent || ""),
        /* Nothing in the bar may be disabled: an inert tab is the same broken
           promise as a tab that bounces, drawn differently. */
        disabled: tabs.filter((t) => t.disabled).map((t) => t.dataset.tab)
      };
    }, L);

    ok(r.landed === "screen-rights", `${L}: the rights library opens with no account (${r.landed})`);
    ok(r.barShown === true, `${L}: and the tab bar is up, so its promises are on screen`);
    ok(r.disabled.length === 0, `${L}: no tab is inert (${r.disabled.join(", ") || "none"})`);
    ok(r.labels.every((s) => s.trim()), `${L}: every tab is labelled`);

    /* THE RULE. Press each tab in turn; none may deposit the reader on the
       sign-in screen except the one that says sign in. */
    for (const id of r.ids) {
      const res = await p.evaluate((tab) => {
        nat = "sa"; obDone = true; authUser = null;
        goTab("rights");
        const btn = document.querySelector(`#tabbar [data-tab="${tab}"]`);
        btn.click();
        return (document.querySelector(".screen.active") || {}).id;
      }, id);
      if (id === "signin"){
        ok(res === "screen-signin", `${L}: the sign-in tab opens sign-in (${res})`);
      } else {
        ok(res === "screen-" + id,
           `${L}: "${id}" opens ${id} rather than bouncing (${res})`);
      }
    }

    /* The bar must still be a way INTO the product. Hiding the shut doors
       without leaving an open one would be a different kind of dead end. */
    ok(r.ids.includes("signin"),
       `${L}: and there is an explicit sign-in door (${r.ids.join(", ")})`);
    ok(!r.ids.includes("account"),
       `${L}: with no account tab, because there is no account yet`);
  }

  /* ---- signed in, nothing was lost: all five tabs come back and all open */
  console.log("\n— signed in, the full bar returns");
  const full = await p.evaluate(() => {
    nat = "sa"; obDone = true;
    authUser = { id: "nav-test", email: "nav@test.local" };
    goTab("rights");
    return [...document.querySelectorAll("#tabbar [data-tab]")].map((t) => t.dataset.tab);
  });
  ok(full.length === 5, `five tabs for a signed-in reader (${full.length}: ${full.join(", ")})`);
  ok(full.includes("account") && !full.includes("signin"),
     "the account tab is back and the sign-in door is gone");

  /* ---- the announced-but-unavailable sign-in methods.
     They are kept deliberately (see docs/roadmap.md), so the assertion is not
     that they are absent — it is that a reader can tell they are unavailable
     WITHOUT pressing them, and can still read the words saying so. */
  console.log("\n— what is announced but not built looks it, before it is pressed");
  const soon = await p.evaluate((shownSrc) => {
    const shown = eval(shownSrc);
    obDone = true; authUser = null;
    openSignin("rights");
    const btns = [...document.querySelectorAll(".au-btn.soon")].filter(shown);
    return btns.map((b) => {
      const cs = getComputedStyle(b);
      return {
        id: b.id || "(apple)",
        disabled: b.disabled,
        badge: ((b.querySelector(".badge") || {}).textContent || "").trim(),
        borderStyle: cs.borderTopStyle,
        opacity: Number(cs.opacity)
      };
    });
  }, SHOWN_SRC);

  ok(soon.length > 0, `the unavailable methods are on screen (${soon.length})`);
  for (const s of soon) {
    ok(s.disabled === true, `${s.id}: cannot be pressed`);
    ok(!!s.badge, `${s.id}: carries its "coming" badge in the button (${s.badge})`);
    ok(s.borderStyle === "dashed",
       `${s.id}: is drawn as unavailable rather than as a live button (${s.borderStyle})`);
    /* A faded control is not a legible one, and the badge is the single piece
       of text the reader most needs here. */
    ok(s.opacity >= 0.99, `${s.id}: and its words are at full strength (opacity ${s.opacity})`);
  }

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nevery door the reader is shown is a door that opens");
})();
