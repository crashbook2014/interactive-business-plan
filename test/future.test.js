/* The roadmap screen, and the one thing it must never do.
 *
 * Every card on this screen describes something Wodouh CANNOT DO YET. That
 * makes it the easiest screen in the product to lie on — not by writing
 * anything false, but by letting a reader walk away believing a planned thing
 * is a built thing. A roadmap that leaves someone unsure which half is real
 * has taken more from them than it gave.
 *
 * So the assertions here are almost entirely about the boundary between built
 * and intended:
 *
 *   1. Everything on the build-list carries a "coming soon" badge. Not most of
 *      it. A single unbadged card is a claim.
 *   2. The contract types that WORK are marked available and carry no soon
 *      badge, and the ones that do not are marked planned. This is checked
 *      against the app's real doc kinds rather than against the roadmap's own
 *      opinion of itself — the roadmap must agree with the product, and the
 *      product is the authority.
 *   3. Supplier contracts specifically. The brief that commissioned this
 *      screen asserted supplier contracts already existed. They do not exist
 *      anywhere in this codebase. Asserted by name so that "supplier" cannot
 *      quietly move to the available column without someone building it.
 *   4. The screen carries a line saying none of it has a date and none of it
 *      is buyable. Without that, a roadmap reads as a specification.
 *
 * Plus the ordinary things: it renders in both languages with nothing empty
 * (a card added in one language and forgotten in the other renders as a blank
 * row, which is how half-translated screens ship), and it does not need an
 * account, because requiring one to read what a product intends to build one
 * day would be hard to say out loud.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* ---- reachable, and reachable WITHOUT an account */
  console.log("\n— the roadmap is reachable, and needs no account");
  const reach = await p.evaluate(() => {
    nat = "sa"; obDone = true; authUser = null;      /* signed out, tour done */
    goTab("future");
    return {
      landed: (document.querySelector(".screen.active") || {}).id,
      tabs: [...document.querySelectorAll(".tab span")].map((x) => x.textContent),
      barShown: !document.getElementById("tabbar").hidden
    };
  });
  ok(reach.landed === "screen-future",
     `the tab opens the roadmap with no session (${reach.landed})`);
  ok(reach.tabs.length === 5, `the tab bar carries five tabs (${reach.tabs.length})`);
  ok(reach.barShown === true, "and the roadmap is a root screen, so the bar stays up");

  /* ---- the badge rule, in both languages */
  for (const L of ["ar", "en"]) {
    console.log(`\n— ${L}: nothing planned is presented as built`);
    const r = await p.evaluate((l) => {
      if (lang !== l) toggleLang();
      goTab("future");
      const cards = [...document.querySelectorAll("#fuGrid .fu-card")];
      const cats = [...document.querySelectorAll("#fuCats .fu-cat")];
      const txt = (el, sel) => ((el.querySelector(sel) || {}).textContent || "").trim();
      return {
        dir: document.documentElement.dir,
        cards: cards.map((c) => ({
          name: txt(c, "b"), desc: txt(c, "span"), badge: txt(c, ".badge")
        })),
        cats: cats.map((c) => ({
          name: txt(c, "b"), desc: txt(c, "span"), badge: txt(c, ".badge"),
          now: c.classList.contains("now")
        })),
        steps: [...document.querySelectorAll("#fuArc .fu-step")].map((s) => ({
          name: txt(s, "b"), desc: txt(s, "span"), now: s.classList.contains("now")
        })),
        foot: (document.querySelector("#screen-future .disclaimer") || {}).textContent || "",
        overflow: document.documentElement.scrollWidth > window.innerWidth
      };
    }, L);

    ok(r.dir === (L === "ar" ? "rtl" : "ltr"), `${L}: the document direction is right (${r.dir})`);
    ok(r.cards.length === 10, `${L}: every planned feature renders (${r.cards.length})`);

    /* A card added in one language and forgotten in the other renders as a
       blank row rather than as an error, so emptiness is the assertion. */
    const blank = r.cards.filter((c) => !c.name || !c.desc).map((c) => c.name || "(unnamed)");
    ok(blank.length === 0, `${L}: none of them is missing its name or description (${blank.join(", ") || "all present"})`);

    /* THE RULE. One unbadged card is a claim that Wodouh can do something it
       cannot, on the one screen whose entire subject is things it cannot do. */
    const unbadged = r.cards.filter((c) => !c.badge).map((c) => c.name);
    ok(unbadged.length === 0,
       `${L}: every planned feature is badged as coming (${unbadged.join(", ") || "all badged"})`);

    /* ---- built vs intended, checked against the product rather than the page */
    const avail = r.cats.filter((c) => c.now).map((c) => c.name);
    const planned = r.cats.filter((c) => !c.now).map((c) => c.name);
    ok(avail.length === 3, `${L}: three contract types are shown as available (${avail.join(", ")})`);
    ok(planned.length === 2, `${L}: two are shown as planned (${planned.join(", ")})`);

    /* Supplier by name. The commissioning brief asserted it already existed;
       it exists nowhere in this codebase, and this assertion is what stops it
       drifting into the available column without being built. */
    const supplier = r.cats.find((c) => /supplier|توريد/i.test(c.name));
    ok(!!supplier, `${L}: supplier contracts are listed`);
    ok(supplier && supplier.now === false,
       `${L}: and listed as PLANNED, because no supplier analysis exists`);
    const loans = r.cats.find((c) => /financing|تمويل/i.test(c.name));
    ok(!!loans && loans.now === false, `${L}: bank financing is listed as planned`);

    /* The progression names one step as working today and exactly one. */
    const nowSteps = r.steps.filter((s) => s.now);
    ok(r.steps.length === 4, `${L}: the four-step progression renders (${r.steps.length})`);
    ok(nowSteps.length === 1,
       `${L}: exactly one step is marked as working today (${nowSteps.map((s) => s.name).join(", ")})`);

    /* Without this line a roadmap reads as a specification and someone plans
       their year around a date nobody gave them. */
    ok(/no date|ما له تاريخ/i.test(r.foot),
       `${L}: the screen says plainly that none of this has a date`);
    ok(/buy|تشتري|مدفوعة|pay/i.test(r.foot),
       `${L}: and that none of it is part of anything purchasable today`);

    ok(r.overflow === false, `${L}: and the page does not scroll sideways`);
  }

  /* ---- the roadmap must agree with the product's own doc kinds.
     The page says employment, rental and freelance are supported. The product
     is the authority on that, so it is asked rather than trusted: those three
     doc kinds must exist in the shipped source, and a supplier one must not. */
  console.log("\n— the roadmap agrees with the product it describes");
  const src = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
  ok(/doc_emp:/.test(src) && /doc_rent:/.test(src) && /doc_free:/.test(src),
     "the three types shown as available all exist as real doc kinds");
  ok(!/doc_supp/.test(src),
     "and there is no supplier doc kind, which is why supplier is shown as planned");

  /* ---- narrow viewport, where a two-up grid would have broken */
  console.log("\n— it holds together on the smallest phone");
  const small = await b.newPage({ viewport: { width: 360, height: 640 } });
  small.on("pageerror", (e) => FAIL.push("pageerror(360): " + e.message));
  await small.goto(APP);
  await small.waitForFunction(() => typeof window.show === "function");
  const narrow = await small.evaluate(() => {
    nat = "sa"; obDone = true; authUser = null;
    goTab("future");
    const bar = document.getElementById("tabbar");
    const labels = [...document.querySelectorAll(".tab span")];
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      /* Five tabs on a 360px phone is ~70px each. A label that wraps to two
         lines changes the bar's height and shoves the layout above it. */
      barHeight: Math.round(bar.getBoundingClientRect().height),
      wrapped: labels.some((l) => l.getBoundingClientRect().height > 20)
    };
  });
  ok(narrow.overflow === false, "no sideways scroll at 360px");
  ok(narrow.wrapped === false, `and no tab label wraps to a second line (bar ${narrow.barHeight}px)`);
  await small.close();

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nthe roadmap is honest about what is built and what is not");
})();
