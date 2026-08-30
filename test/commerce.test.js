/* The commercial layer.
 *
 * WHY THIS SUITE EXISTS
 *
 * The legal engine has been verified article by article and fuzzed. The half of
 * the app that takes money had never had a single trace run through it, and an
 * audit found that it did not do what it said:
 *
 *   - the selected tier was drawn on the radio, printed on the pay button, and
 *     then never read again, so 145 SAR and 295 SAR bought identical output
 *   - a 295 SAR bundle contained a 325 SAR product
 *   - the pay button read "Get my letter" on a case file
 *   - the termination paywall showed the reader their own answers back
 *
 * Every one of those passed all eight existing suites. Tests catch regressions;
 * they do not catch a product quietly promising something it does not deliver.
 * These assertions are the ones whose absence let that happen.
 *
 * Run with `npm test`. WODOUH_URL points them at the deployed site.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* One termination case, used by every walk below so the figures are constant
   and any difference between runs is the entitlement, not the facts. */
const CASE = {
  how: "employer", start: "2018-01-01", end: "2026-01-01", ctype: "indef",
  wage: 12000, basic: 12000, noticeDue: 60, noticeGiven: 0,
  leaveDays: 10, unpaidMonths: 2
};

async function seedTermination(p){
  await p.evaluate(c => {
    term = Object.assign(blankTerm(), c);
    owned = { letter:null, case:null, term:null };
    saveState();
  }, CASE);
}

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* ------------------------------------------------- the price ladder */
  console.log("\n— the price ladder");

  const ladder = await p.evaluate(() => ({
    breaks: ladderBreaks(),
    all: [].concat(PLANS_REVIEW, PLANS, PLANS_CASE, PLANS_DRAFT, PLANS_BUNDLE)
            .map(x => ({ n: x.name, a: x.amt }))
  }));
  /* The invariant that a document could not enforce: no bundle may cost less
     than something it contains. This is the assertion that fails the moment a
     future price edit reintroduces the 295-contains-325 collision. */
  ok(ladder.breaks.length === 0,
     `no bundle costs less than a product it contains${ladder.breaks.length ? " — " + ladder.breaks.join("; ") : ""}`);
  ok(ladder.all.every(x => Number.isFinite(x.a) && x.a > 0),
     "every plan carries a finite positive price");

  /* ------------------------------------------- tiers deliver different things */
  console.log("\n— each tier delivers its own contents");

  /* WHAT CHANGED. This block walked the 145 SAR assessment, proved it withheld
     the employer letter, then bought the 295 upgrade. Both prices are gone:
     the assessment merged into the case file at 349, so there is no cheaper
     termination tier left to under-deliver. The property survives the merge
     and is what is asserted now — unpaid reaches neither document, paid
     reaches both, because that is what the single price promises. */

  await seedTermination(p);
  const gatedAt = await p.evaluate(async () => {
    await openTermResult();
    return { screen: document.querySelector(".screen.active").id, mode: pwMode, origin: pwOrigin };
  });
  ok(gatedAt.screen === "screen-paywall", "the assessment is gated behind payment");
  ok(gatedAt.mode === "case",
     `it asks for the case entitlement, not a termination one (${gatedAt.mode})`);
  /* Without this the reader would land in a case builder they never opened,
     because `case` is now reached from two different flows. */
  ok(gatedAt.origin === "term",
     `and it remembers which flow it came from (${gatedAt.origin})`);

  const bought = await p.evaluate(() => {
    document.querySelectorAll("#plans .plan")[0].click();
    grantAndGo();
    show("termnext"); renderTermSteps();
    [...document.querySelectorAll("#termSteps button")].find(x => x.dataset.step === "2").click();
    const afterLetter = document.querySelector(".screen.active").id;
    show("termnext"); renderTermSteps();
    [...document.querySelectorAll("#termSteps button")].find(x => x.dataset.step === "3").click();
    return { held: owned.case, afterLetter,
             afterFile: document.querySelector(".screen.active").id,
             body: document.getElementById("termDocBody").textContent };
  });
  ok(bought.held === "plan_case", `buying the case file records it (${bought.held})`);
  ok(bought.afterLetter === "screen-termltr",
     "and it hands over the employer letter, which used to cost a second 150");
  ok(bought.afterFile === "screen-termdoc", "and the case file");
  ok(bought.body.split("\n").length > 20, "the case file has real content");

  /* ------------------------------- a limit met after paying is not a limit */
  console.log("\n— the pack states its term where it is sold");

  const packSale = await p.evaluate(() => {
    if (lang === "ar") toggleLang();
    return { card: t("plan_reviews5_d"), ar: T.plan_reviews5_d.ar,
             acct: t("acc_pack_left") };
  });
  /* Twelve months is a term of the sale, so it belongs on the card the reader
     is looking at when they decide — not only in the refund policy, which is
     read after. */
  ok(/12 months|twelve months/i.test(packSale.card),
     `the purchase card states the expiry (${packSale.card})`);
  ok(/١٢|12/.test(packSale.ar), "and so does the Arabic");
  ok(/\{n\}/.test(packSale.acct) && /\{d\}/.test(packSale.acct),
     "and the account screen shows what is left and when it lapses");

  /* ---- the free tier's quota is the one the code enforces.
     It advertised "3 free assistant questions per contract" while askLeft()
     allowed five, counted per calendar day and never per contract — both the
     number and the unit were wrong, on the screen where a stranger decides
     whether we are careful. The string now carries {n} and is filled from
     ASK_PER_DAY at render, so what is asserted here is that the promise and
     the enforcement cannot come apart again. */
  console.log("\n— the free tier promises the quota the code actually allows");
  const quota = await p.evaluate(() => {
    const out = { perDay: ASK_PER_DAY, raw: T.f_qfree, shown: {} };
    /* askLeft() resets on the calendar day, which is the unit the copy must
       name — proven here rather than read off the constant's name. */
    askUsed = { day: "1970-01-01", n: 99 };
    out.resetsDaily = askLeft() === ASK_PER_DAY;
    for (const L of ["en", "ar"]) {
      lang = L; applyLang(); renderPlans();
      /* The free tier's own feature line, not the whole screen: the screen
         carries 699, 12 and other figures, so a substring search across it
         would pass on a page that never mentions the allowance at all. */
      const li = Array.from(document.querySelectorAll("#screen-plans li"))
        .map(n => n.textContent.trim())
        .find(s => /assistant questions|أسئلة مجانية/.test(s));
      out.shown[L] = li || "(the allowance is not on the plan screen)";
      out.whole = (out.whole || "") + document.getElementById("screen-plans").textContent;
    }
    return out;
  });
  ok(quota.resetsDaily, "the allowance is per calendar day, not per contract");
  ok(/\{n\}/.test(quota.raw.en) && /\{n\}/.test(quota.raw.ar),
     "the copy holds a placeholder rather than a second copy of the number");
  for (const L of ["en", "ar"]) {
    ok(quota.shown[L].includes(String(quota.perDay)),
       `${L}: the plan card states the enforced allowance (${quota.perDay})`);
    ok(!/\{n\}/.test(quota.shown[L]), `${L}: and the placeholder is filled, not shown`);
  }
  ok(!/per contract|لكل عقد/i.test(quota.whole),
     "and no longer claims the allowance is per contract");

  const refund = readFileSync(path.join(ROOT, "refund/index.html"), "utf8");
  ok(/twelve months/i.test(refund) && /اثني عشر/.test(refund),
     "the refund policy carries the same term, in both languages");
  /* A part-used pack refunded at the pack rate would refund more than the
     unused reviews are worth. Saying which rate applies is the difference
     between a policy and an argument. */
  ok(/199/.test(refund), "and says which rate a part-used pack is refunded at");

  /* THE REFUND FORMULA MUST NOT GO NEGATIVE. Charging used reviews at 199
     against a 699 pack produces −97 at four used, which as written told the
     customer they owed us money. The figures are recomputed here rather than
     read, so the page and the arithmetic cannot drift apart. */
  {
    const src = readFileSync(path.join(ROOT, "app/index.html"), "utf8");
    const packAmt = (src.match(/name:"plan_reviews5"[\s\S]{0,120}?amt:(\d+)/) || [])[1];
    const oneAmt  = (src.match(/name:"plan_review"[\s\S]{0,120}?amt:(\d+)/) || [])[1];
    ok(!!packAmt && !!oneAmt, `both prices read from the catalogue (${packAmt}, ${oneAmt})`);
    const credits = +((src.match(/PACK_CREDITS\s*=\s*(\d+)/) || [])[1] || 0);
    ok(credits > 0, `and the credit count (${credits})`);
    let negative = null, stated = [];
    for (let used = 1; used <= credits; used++){
      const owed = +packAmt - used * +oneAmt;
      if (owed < 0 && negative === null) negative = used;
      if (owed > 0) stated.push(String(owed));
    }
    ok(negative !== null,
       `the un-floored formula does go negative, at ${negative} used — so the page must say what happens`);
    ok(/never less than nothing|no refund|ولا يقل|لا يوجد ردّ/.test(refund),
       "the refund page states the floor rather than leaving the arithmetic to run negative");
    const missing = stated.filter(n => !refund.includes(n));
    ok(missing.length === 0,
       `and every positive refund figure is worked out on the page${missing.length ? " — missing " + missing.join(", ") : " (" + stated.join(", ") + ")"}`);
    ok(!/-\s*97|−97/.test(refund), "no negative figure appears on the page");
  }

  /* THE TERMS MUST DESCRIBE WHAT IS ACTUALLY SOLD. terms/index.html was last
     touched the day before the August catalogue landed and described a product
     with only one-time purchases, while the app sells a recurring monthly plan
     and a pack that expires. A gateway reads this page during approval. */
  console.log("\n— the Terms describe every kind of thing the app sells");
  {
    const terms = readFileSync(path.join(ROOT, "terms/index.html"), "utf8");
    const src2 = readFileSync(path.join(ROOT, "app/index.html"), "utf8");
    const sub = src2.match(/name:"(\w+)"[^}]*sub:true/);
    ok(!!sub, `the catalogue does sell a subscription (${sub && sub[1]})`);
    for (const [what, en, ar] of [
      ["the recurring charge", /subscription|recurring/i, /اشتراك/],
      ["its billing period",   /each calendar month|monthly/i, /كل شهر|شهري/],
      ["how to cancel",        /cancel/i, /إلغاء|تلغيه/],
      ["the pack's expiry",    /twelve months/i, /اثني عشر شهرًا/],
      ["that unused reviews lapse", /expire/i, /ينتهي|تنتهي/],
    ]) {
      ok(en.test(terms) && ar.test(terms),
         `the Terms state ${what}, in both languages` +
         (en.test(terms) ? "" : " — missing in English") +
         (ar.test(terms) ? "" : " — missing in Arabic"));
    }
    ok(/renews automatically|until you cancel/i.test(terms),
       "and that it renews until cancelled rather than lapsing on its own");
  }

  /* --------------------------------- the pricing doc names every real price */
  console.log("\n— docs/pricing.md is not folklore");

  /* That file exists so the prices stop being folklore, which only works while
     it lists the prices that actually ship. Checked as a relationship — every
     sellable figure in the code appears in the document — rather than against
     a fixed list that would itself go stale. */
  const priced = await p.evaluate(() =>
    [].concat(PLANS_REVIEW, PLANS, PLANS_CASE, PLANS_DRAFT, PLANS_BUNDLE)
      .map(x => x.amt).filter((v, i, a) => a.indexOf(v) === i));
  const doc = readFileSync(path.join(ROOT, "docs/pricing.md"), "utf8");
  for (const amt of priced) {
    ok(new RegExp("\\b" + amt + "\\b").test(doc),
       `${amt} SAR is accounted for in docs/pricing.md`);
  }

  /* ------------------------------------------ the free scan counts nothing */
  console.log("\n— the free scan shows a finding, never a tally");

  /* THE TRUST DECISION, asserted rather than trusted. A teaser that says "we
     found 4 problems" earns more by finding more, and the moment that is true
     the score stops meaning anything — which is the entire product. So the
     scan shows ONE real finding in full and states no count anywhere.

     The decision banner was printing "1 red and 3 amber" directly above a lock
     panel carefully written not to say a number. No test saw it; opening the
     screen did. */
  const scan = await p.evaluate(async () => {
    localStorage.clear();
    obDone = true; nat = "sa"; scanUsed = { month:"", n:0 };
    owned = { review:null, letter:null, case:null }; packUntil = 0; packLeft = 0;
    if (lang === "ar") toggleLang();
    /* Signed in with no scans used: the state a first-time reader is in after
       creating an account, which is now required before any scan. Stubbed
       because the project is not reachable from a test runner. */
    scanServer = 0;
    /* A STATEFUL stub, because a stub that always answers 0 is not a server.
       useScan() increments optimistically and then re-reads — correct, since
       the server is the truth — so a stub whose count never moves silently
       undoes the increment and hands out a second free scan. Counting here
       makes the test exercise what actually happens. */
    window.__rows = 0;
    window.WodouhAuth = Object.assign({}, window.WodouhAuth, {
      configured: () => true, user: () => ({ id: "test-user" }),
      apiCount: () => Promise.resolve(window.__rows),
      api: (p, o) => { if (o && o.method === "POST") window.__rows += 1;
                       return Promise.resolve(null); } });
    analyze("employment");
    await new Promise(r => setTimeout(r, 2200));
    const card = document.querySelector(".score-card").textContent;
    return { flags: document.querySelectorAll("#flags .flag").length,
             lock: !!document.querySelector(".scan-lock"),
             why: document.getElementById("dcWhy").textContent,
             lockText: (document.querySelector(".scan-lock") || {}).textContent || "",
             card, left: scansLeft() };
  });
  ok(scan.flags === 1, `the scan shows exactly one clause, in full (${scan.flags})`);
  ok(scan.lock, "and says plainly that there is more");
  /* The property, in the place it actually failed. */
  ok(!/\b\d+\s*(red|amber|problem|issue)/i.test(scan.why),
     `the decision line states a kind, not a count (${scan.why})`);
  ok(!/\b\d+\s*(more|other|remaining)/i.test(scan.lockText),
     "and the lock panel counts nothing either");
  ok(scan.left === 0, "the scan is counted against the month's free one");

  const paid = await p.evaluate(() => {
    owned.review = "plan_review"; renderResult();
    return { flags: document.querySelectorAll("#flags .flag").length,
             lock: !!document.querySelector(".scan-lock"),
             why: document.getElementById("dcWhy").textContent };
  });
  ok(paid.flags > 1, `paid, every clause renders (${paid.flags})`);
  ok(!paid.lock, "and the lock panel is gone");
  /* Paid, the breakdown is what a reader wants — they have the clauses it
     refers to. The asymmetry is the point, so it is asserted in both
     directions rather than only where it fails. */
  ok(/\d/.test(paid.why), `and the breakdown returns (${paid.why})`);

  /* ------------------------------------------------------- the bundle */
  console.log("\n— the bundle grants everything it names, across flows");

  const bundle = await p.evaluate(() => {
    owned = { review:null, letter:null, case:null };
    pwMode = "bundle"; pwPlan = 0; pwUpgrade = null; pwOrigin = null;
    grantAndGo();
    return { r: owned.review, l: owned.letter, c: owned.case };
  });
  /* The one structural risk in this catalogue: the bundle is the first product
     that crosses what used to be separate flows. Writing owned[pwMode] alone
     would have set owned.bundle — a mode nothing asks about — and granted the
     buyer none of the three things they paid for. */
  ok(bundle.r === "plan_review" && bundle.l === "plan_letter" && bundle.c === "plan_case",
     `the bundle grants review, letter and case together (${bundle.r}, ${bundle.l}, ${bundle.c})`);

  const single = await p.evaluate(() => {
    owned = { review:null, letter:null, case:null };
    pwMode = "letter"; pwPlan = 0; pwUpgrade = null; pwOrigin = null;
    grantAndGo();
    return { r: owned.review, l: owned.letter, c: owned.case };
  });
  ok(single.l === "plan_letter" && !single.r && !single.c,
     "and buying one part grants only that part");

  /* --------------------------------------- a product that cannot be bought */
  console.log("\n— a listed-but-unbuilt product cannot be bought");

  /* On the CATALOGUE screen, not in a paywall: contract drafting has no flow
     to gate, and a paywall mode with no entry point is dead code that looks
     like a feature. */
  const draft = await p.evaluate(() => {
    renderPlans();
    const cards = [...document.querySelectorAll("#planCards .pcard")];
    /* Matched on the HEADING, not the card text. Searching the whole card for
       "drafting" found the free tier, which lists "Letter and document
       drafting" among the things it does NOT include — a substring match
       against a feature list picking the wrong card entirely. */
    const card = cards.find(c => {
      const h = c.querySelector("h3");
      return h && /^(contract drafting|صياغة عقد)$/i.test(h.textContent.trim());
    });
    if (!card) return { shown:false };
    return { shown:true, disabled: !!card.querySelector(".cta").disabled,
             text: card.textContent, price: /249|٢٤٩/.test(card.textContent) };
  });
  ok(draft.shown, "contract drafting is listed on the catalogue");
  ok(draft.price, "with its real price");
  ok(draft.disabled, "and its button cannot be pressed");
  ok(/not yet|قريب/i.test(draft.text), "and it says why");

  /* The annual toggle went with the consumer subscription. Leaving it would
     have offered a yearly figure nobody ever set. */
  const seg = await p.evaluate(() => {
    const el = document.getElementById("billSeg");
    return { hidden: !el || el.hidden, kids: el ? el.children.length : 0 };
  });
  ok(seg.hidden && seg.kids === 0,
     "the monthly/annual toggle is gone, because no annual price exists");

  /* ------------------------------------ nothing computed before payment */
  console.log("\n— no figure reaches the DOM before payment");

  await p.evaluate(() => location.reload());
  await p.waitForFunction(() => typeof window.show === "function");
  await seedTermination(p);

  const before = await p.evaluate(async () => {
    /* The app opens in Arabic. These assertions read the English strings, so
       the walk switches first — and the switch itself is a re-render, which is
       worth exercising on this screen anyway. */
    if (lang === "ar") toggleLang();
    await openTermResult();
    const scr = document.getElementById("screen-paywall");
    return { text: scr.textContent, html: scr.innerHTML,
             shape: document.getElementById("pwShape").textContent,
             hidden: document.getElementById("pwShape").hidden };
  });
  /* The termination assessment's own figures, in both numeral systems. The
     wage is an input the reader gave us; the computed amounts are not. */
  const AMOUNTS = ["66,000", "٦٦٬٠٠٠", "24,000", "٢٤٬٠٠٠", "4,000", "٤٬٠٠٠"];
  const leaked = AMOUNTS.filter(a => before.text.includes(a) || before.html.includes(a));
  ok(leaked.length === 0, `no computed amount is in the paywall DOM${leaked.length ? " — " + leaked.join(", ") : ""}`);
  ok(!before.hidden && before.shape.length > 40,
     "the paywall describes what is behind the lock rather than showing the reader their own answers back");
  ok(/entitlement/i.test(before.shape), "the shape block names how many entitlements were found");
  ok(/verified article/i.test(before.shape), "it says how many cite a verified article");
  ok(/certain/i.test(before.shape), "it states that every amount carries a certainty");

  /* ------------------------------------------------- labels per mode */
  console.log("\n— the buttons name what they sell");

  const labels = await p.evaluate(() => {
    if (lang === "ar") toggleLang();
    const out = {};
    const read = () => ({ pay: document.getElementById("payBtn").textContent.trim(),
                          back: document.getElementById("pwBackLabel").textContent.trim() });
    /* The termination paywall is the CASE one now, entered from the term
       flow — which is exactly why pwOrigin exists. */
    pwMode = "case"; pwOrigin = "term"; pwUpgrade = null; pwPlan = 0; renderPaywall(); out.term = read();
    /* The case flow needs its own seeded result. */
    eosData = { start: Date.parse("2018-01-01"), end: Date.parse("2026-01-01"),
                wage: 12000, total: 66000, parts: { y: 8, m: 0 } };
    pwMode = "case"; pwOrigin = "case"; pwPlan = 0; renderPaywall(); out.case = read();
    return out;
  });
  /* Both of these read "Get my letter" before this build. */
  ok(/assessment/i.test(labels.term.pay), `the assessment button names the assessment (${labels.term.pay})`);
  ok(/case file/i.test(labels.case.pay), `the case-file button names the case file (${labels.case.pay})`);
  ok(!/score/i.test(labels.term.back) && !/score/i.test(labels.case.back),
     "the back button does not say \"back to score\" on screens with no score");

  /* --------------------------------------- the refund promise and the flag */
  console.log("\n— the payment state is stated once");

  const money = await p.evaluate(() => ({
    live: PAYMENT_LIVE,
    guarantee: !document.getElementById("pwGuarantee").hidden,
    demo: !document.getElementById("pwDemo").hidden
  }));
  ok(money.guarantee !== money.demo,
     "a refund promise and \"no real payment happens\" are never on screen together");
  ok(money.guarantee === money.live, "the refund promise appears only when payments are live");

  /* ------------------------------------------------- the lawyer tiers */
  console.log("\n— the lawyer tiers are not sold until they can be delivered");

  const lawyer = await p.evaluate(() => {
    const dark = { live: LAWYER_DESK.live };
    letterSet = new Set([0]);
    current = { doc: "doc_emp", score: 40,
                clauses: [{ id:"x", s:"amber", q:null, t:{ar:"بند",en:"Clause"},
                            p:{ar:"وصف",en:"desc"}, a:{ar:"نصيحة",en:"Advice"} }],
                verdict: { ar:"تحقق", en:"Check" } };
    owned = { letter:null, case:null, term:null };
    pwMode = "letter"; pwUpgrade = null; renderPaywall();
    dark.offered = [...document.querySelectorAll("#plans .plan")].length;
    dark.names = activePlans().map(x => x.name);
    /* And the same list once a desk exists. LAWYER_DESK is a const object, but
       its fields are what the code reads. */
    LAWYER_DESK.live = true; LAWYER_DESK.turnaround = "3 days";
    renderPaywall();
    dark.liveOffered = [...document.querySelectorAll("#plans .plan")].length;
    owned.letter = "plan_lawyer"; renderLawyerTease();
    dark.teaseShown = !document.getElementById("lawyerTease").hidden;
    openDesk("letter");
    dark.deskScreen = document.querySelector(".screen.active").id;
    dark.turn = document.getElementById("ldTurn").textContent;
    dark.turnHidden = document.getElementById("ldTurn").hidden;
    LAWYER_DESK.live = false; LAWYER_DESK.turnaround = null;
    renderDesk();
    dark.turnHiddenAgain = document.getElementById("ldTurn").hidden;
    return dark;
  });
  ok(lawyer.live === false, "the app ships with the lawyer desk dark");
  ok(lawyer.names.indexOf("plan_lawyer") === -1,
     "a tier promising a lawyer is not offered while no lawyer can be reached");
  ok(lawyer.liveOffered === lawyer.offered + 1,
     "and it is offered the moment the desk is live");
  ok(lawyer.teaseShown, "a reader holding a lawyer tier is shown the way to the desk");
  ok(lawyer.deskScreen === "screen-lawyerdesk", "the desk opens");
  ok(/3 days/.test(lawyer.turn) && !lawyer.turnHidden,
     "the desk states a turnaround when one has been set");
  ok(lawyer.turnHiddenAgain,
     "and states none when none has been set — no unbacked \"within 24 hours\"");

  /* ------------------------------------------- a grant may only move up */
  console.log("\n— granting a cheaper tier never revokes a dearer one");

  const monotonic = await p.evaluate(() => {
    term = Object.assign(blankTerm(), { how:"employer", start:"2018-01-01",
      end:"2026-01-01", ctype:"indef", wage:12000, basic:12000 });
    /* The 145/295 pair this used merged into the 349 case file, so the walk
       uses the pair that still exists: the lawyer tier above the plain file.
       The property is unchanged and is the one that matters. */
    owned = { review:null, letter:null, case:"plan_case_lawyer" };
    /* The downgrade path: re-enter the paywall on the cheap tier while holding
       the dear one. No route in the UI does this today; the point is that no
       route added later can either. */
    pwMode = "case"; pwOrigin = "case"; pwUpgrade = null; pwPlan = 0;
    grantAndGo();
    return { held: owned.case, stillFull: has("case", "plan_case_lawyer") };
  });
  ok(monotonic.held === "plan_case_lawyer",
     `a dearer holder stays a dearer holder (${monotonic.held})`);
  ok(monotonic.stillFull === true,
     "and what the dearer tier unlocked stays unlocked");

  /* --------------------------------- the subscription ladder stays dark */
  console.log("\n— nothing sells a subscription that does not exist");

  const subs = await p.evaluate(() => {
    const out = { live: SUBSCRIPTIONS_LIVE };
    /* Every route in: the assistant's quota gate and the account screen. */
    chat.length = 0; asked = FREE_QUESTIONS; openAssist("home"); renderQuota();
    out.quotaBtns = [...document.querySelectorAll("#quota button")].map(x => x.textContent.trim());
    out.quotaText = document.getElementById("quota").textContent || "";
    out.quotaStillExplains = out.quotaText.length > 20;
    renderAccount();
    out.accountHasCta = !!document.querySelector("#accPlan button");
    /* And the door itself, in case a future route calls it directly. */
    openPlans("home");
    out.screenAfterOpenPlans = document.querySelector(".screen.active").id;
    return out;
  });
  ok(subs.live === false, "the app ships with subscriptions dark");
  /* This used to assert the gate had NO button, which was the wrong target: a
     panel that names the rights library and offers no way to reach it is a
     dead end wearing a signpost. What must be absent is a price, not a way
     forward. */
  ok(!subs.quotaBtns.some(b => /SAR|ر\.س|subscribe|اشترك/i.test(b)),
     `the gate offers no subscription to buy (${subs.quotaBtns.join(", ") || "no buttons"})`);
  ok(!/Wodouh\+|وضوح\+/.test(subs.quotaText),
     "and its copy does not sell a product that is not on the screen");
  ok(subs.quotaBtns.length === 1,
     "but it does offer one way forward");
  ok(subs.quotaStillExplains,
     "and it still explains that the free questions have ended");
  ok(!subs.accountHasCta, "the account screen offers no plan upgrade");
  ok(subs.screenAfterOpenPlans !== "screen-plans",
     `openPlans() refuses to open the screen (landed on ${subs.screenAfterOpenPlans})`);

  /* ------------------------------- the lock strip must not oversell the tier */
  console.log("\n— the lock strip promises only what the selected tier delivers");

  const strip = await p.evaluate(() => {
    if (lang === "ar") toggleLang();
    term = Object.assign(blankTerm(), { how:"employer", start:"2018-01-01",
      end:"2026-01-01", ctype:"indef", wage:12000, basic:12000 });
    owned = { review:null, letter:null, case:null };
    pwMode = "case"; pwOrigin = "term"; pwUpgrade = null; pwPlan = 0; renderPaywall();
    const card = document.querySelector("#plans .plan");
    return { lock: document.getElementById("pwLockLine").textContent,
             card: card ? card.textContent : "" };
  });
  /* THIS INVERTED, and the inversion is the point. It used to check the strip
     did NOT name the case file or the letter, because they belonged to a
     dearer 295 tier and naming them above a 145 card sold them as included
     when they were not. Both tiers merged into the 349 case file, which
     genuinely includes both — so the failure worth catching is now the
     opposite one: a card that UNDERSELLS what the reader is paying for. */
  ok(/assessment/i.test(strip.card),
     "the card says the assessment is included, which is what the merge means");
  ok(/file/i.test(strip.card) && /letter/i.test(strip.card),
     "and names the case file and the employer letter it also delivers");

  /* ------------------------------------- no unmeasurable social proof */
  console.log("\n— nothing claims a popularity nobody measured");

  const badges = await p.evaluate(() => {
    const out = [];
    ["letter", "case", "term"].forEach(mode => {
      pwMode = mode; pwUpgrade = null;
      (PLAN_SETS[mode] || []).forEach(pl => { if (pl.pop) out.push(t(pl.tag || "plan_pop")); });
    });
    return out;
  });
  ok(badges.length > 0, `${badges.length} plan badges render`);
  ok(!badges.some(b => /popular|most|الأكثر|الأشهر/i.test(b)),
     `no badge claims popularity with no customers to count (${badges.join(", ")})`);

  /* ------------------------------------------- the pack, bought twice */
  console.log("\n— repurchasing the pack grants a live window, not a dead one");

  /* The engineer's pass found that `!packUntil` refused to refresh an EXPIRED
     window, so a second purchase granted a lapsed one and the buyer received
     nothing. The only customer who repurchases a pack is the one it was built
     for. The pack has since changed flow (letter -> review), shape (a
     six-month letter window -> five reviews) and term (182 -> 365 days); the
     defect it guards against is identical. */
  const pack = await p.evaluate(() => {
    owned = { review:null, letter:null, case:null }; packUntil = 0; packLeft = 0;
    pwMode = "review"; pwOrigin = "review"; pwUpgrade = null;
    pwPlan = PLANS_REVIEW.findIndex(x => x.name === "plan_reviews5");
    grantAndGo();
    const first = { held: owned.review, live: packLive(), left: packLeft };

    /* A year passes and the window lapses — exactly what the copy promises
       will happen. Then they come back with a new contract and buy again. */
    packUntil = Date.now() - 86400000;
    pwPlan = PLANS_REVIEW.findIndex(x => x.name === "plan_reviews5");
    grantAndGo();
    return { first, second: { held: owned.review, live: packLive(), left: packLeft,
                              days: Math.round((packUntil - Date.now()) / 86400000) } };
  });
  ok(pack.first.held === "plan_reviews5" && pack.first.live,
     "the first purchase grants a live window");
  ok(pack.first.left === 5, `and five reviews to spend (${pack.first.left})`);
  ok(pack.second.held === "plan_reviews5", "the second purchase records the pack");
  ok(pack.second.live === true,
     "and the window it grants is actually live — not one that already expired");
  /* Credits reset with the window rather than stacking on a dead one: an
     expired pack holds nothing, whatever its stored count said. */
  ok(pack.second.left === 5, `and a fresh five (${pack.second.left})`);
  ok(pack.second.days > 355,
     `the repurchased window is a full twelve months (${pack.second.days} days)`);

  /* ------------------------------- a paywall must not wear another's clothes */
  console.log("\n— one paywall does not inherit another's title and button");

  const inherited = await p.evaluate(() => {
    eosData = { start: Date.parse("2018-01-01"), end: Date.parse("2026-01-01"),
                wage: 12000, total: 66000, parts: { y: 8, m: 0 } };
    /* The 145/295 termination pair this used is gone. It now upgrades within
       the review flow — and NOT within the case flow, because openCasePaywall
       short-circuits when the reader already holds the case tier, which would
       skip the very code this asserts. */
    owned = { review:"plan_review", letter:null, case:null };
    /* Open an upgrade, then leave it — what a reader does when they decide the
       dearer tier is not for them today. */
    openUpgrade("review", "plan_reviews5", "result");
    show(pwBack());
    /* Later, from the calculator, they ask for the case file. */
    openCasePaywall();
    return { upgrade: pwUpgrade, mode: pwMode, back: pwBack(),
             pay: document.getElementById("payBtn").textContent.trim(),
             title: document.querySelector('#screen-paywall [data-t="pw_title"]').textContent.trim() };
  });
  ok(inherited.upgrade === null, "the case-file paywall is not left in an upgrade state");
  ok(inherited.back === "case",
     `its back control points at the calculator it came from (${inherited.back})`);
  ok(/case file/i.test(inherited.pay),
     `the pay button names the case file (${inherited.pay})`);
  ok(!/add the case file and letter/i.test(inherited.title),
     `and the heading is not the upgrade's (${inherited.title})`);

  /* ------------------------------------------------- entitlement storage */
  console.log("\n— entitlement survives a reload, and only in a shape we know");

  await p.evaluate(() => {
    owned = { review:null, letter:null, case:"plan_case" };
    packUntil = 0; packLeft = 0; saveState();
  });
  await p.evaluate(() => location.reload());
  await p.waitForFunction(() => typeof window.show === "function");
  const reloaded = await p.evaluate(() => owned.case);
  ok(reloaded === "plan_case", "a real entitlement survives a reload");

  const forged = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem(STORE));
    raw.owned = { review:"plan_free_everything", letter:42, case:"plan_case" };
    raw.packUntil = 8.64e15;
    raw.packLeft = 9999;
    localStorage.setItem(STORE, JSON.stringify(raw));
    loadState();
    return { review: owned.review, letter: owned.letter, cs: owned.case,
             pack: packUntil, left: packLeft };
  });
  ok(forged.review === null && forged.letter === null,
     "a hand-edited payload cannot mint a tier the code has never heard of");
  ok(forged.cs === "plan_case", "a real tier id in that same payload is still honoured");
  ok(forged.pack <= Date.now() + 366 * 86400000,
     "a forged pack expiry is clamped to the window that was actually sold");
  /* A count is as forgeable as a date; clamping one and trusting the other
     protects nothing. */
  ok(forged.left <= 20, `a forged credit count is clamped too (${forged.left})`);

  /* ============================================ the pages onboarding needs
     A payment gateway will not approve a merchant without published terms,
     privacy and refund pages, and a reader deserves them regardless. All three
     were missing entirely until 22 August 2026. These assertions exist so they
     cannot quietly go missing again, or drift from what the product does. */
  console.log("\n— the three legal pages exist, in both languages, and are linked");

  const PAGES = [
    ["privacy", /سياسة الخصوصية/, /Privacy Policy/],
    ["terms",   /شروط الاستخدام/, /Terms of Service/],
    ["refund",  /سياسة الاسترجاع/, /Refund Policy/],
  ];

  for (const [name, arRe, enRe] of PAGES){
    const lp = await b.newPage();
    const res = await lp.goto(APP.replace(/\/app\/#preview$/, "") + "/" + name + "/");
    ok(!!res && res.status() === 200, `/${name}/ is published and returns 200`);

    /* Arabic first, because that is what most of this product's readers read —
       and because a policy that defaults to a language the reader cannot read
       is a policy they have not been given. */
    const langAr = await lp.evaluate(() => document.documentElement.lang);
    const dirAr = await lp.evaluate(() => document.documentElement.dir);
    ok(langAr === "ar" && dirAr === "rtl", `/${name}/ opens in Arabic, right-to-left`);

    const arText = await lp.evaluate(() => document.body.innerText);
    ok(arRe.test(arText), `/${name}/ shows its Arabic heading`);
    ok(!enRe.test(arText), `/${name}/ shows one language at a time, not both stacked`);

    /* ?lang=en is what gets SENT to an onboarding reviewer. "Open it and press
       the toggle" is a step that goes wrong. */
    await lp.goto(APP.replace(/\/app\/#preview$/, "") + "/" + name + "/?lang=en");
    const enText = await lp.evaluate(() => document.body.innerText);
    ok(enRe.test(enText), `/${name}/?lang=en links straight to the English version`);

    ok(/Draft|مسودّة/.test(arText) || /Draft/.test(enText),
       `/${name}/ says plainly that it is a draft, and never that a lawyer approved it`);
    ok(!/reviewed by (a|our) lawyer|راجعها محامٍ(?! بعد)/i.test(arText + enText),
       `/${name}/ makes no claim of legal review it has not had`);

    const noScroll = await lp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok(noScroll, `/${name}/ does not scroll sideways`);
    await lp.close();
  }

  /* Orphaned policies are policies nobody finds. */
  const root = readFileSync(path.join(ROOT, "index.html"), "utf8");
  const app = readFileSync(path.join(ROOT, "app/index.html"), "utf8");
  for (const name of ["privacy", "terms", "refund"]){
    ok(root.includes(`href="${name}/"`), `the root page footer links to /${name}/`);
    ok(app.includes(`href="../${name}/"`), `the app links to /${name}/`);
  }

  /* ---- the refund page and the paywall are the same promise, twice */
  console.log("\n— the refund page does not contradict the guarantee on the paywall");
  const guarantee = await p.evaluate(() => ({ ar: T.guarantee.ar, en: T.guarantee.en }));
  const refundAr = readFileSync(path.join(ROOT, "refund/index.html"), "utf8");
  ok(/no questions/i.test(guarantee.en) && /no questions/i.test(refundAr),
     "both say 'no questions' — the page honours the promise rather than quietly narrowing it");
  ok(!/non-refundable|غير قابل للاسترجاع|لا يُسترجع/i.test(refundAr),
     "and the refund page contains no blanket non-refundable clause that would contradict it");
  ok(/14/.test(refundAr), "the refund window is stated as a number rather than left vague");

  /* ================================================================
     The 24 August code review. Each of these was measured against the
     tree at 939e8c0 BEFORE the fix, and each failed there. */

  /* DERIVED FROM THE CATALOGUE, never written out by hand. A second copy of a
     price in a test is a price that drifts, and the difference between two of
     them is exactly the kind of figure that goes stale silently. */
  const BUNDLE_LESS_REVIEW = await p.evaluate(
    () => BUNDLE.amt - PLANS_REVIEW.find(x => x.name === "plan_review").amt);

  console.log("\n— buying something else never tops up the review pack");
  /* THE DEFECT: the top-up read owned.review — what the reader HOLDS — with no
     reference to what they had just bought, so every purchase of anything
     credited a pack they already had. Measured before the fix: 5 → 10 → 15. */
  const topup = await p.evaluate(() => {
    owned = { review:null, letter:null, case:null }; packUntil = 0; packLeft = 0;
    const buy = (mode, name) => {
      pwMode = mode; pwOrigin = mode; pwUpgrade = null;
      pwPlan = activePlans().findIndex(x => x.name === name);
      grantAndGo();
    };
    const seen = {};
    buy("review", "plan_reviews5"); seen.afterPack = packLeft;
    buy("letter", "plan_letter");   seen.afterLetter = packLeft;
    buy("case",   "plan_case");     seen.afterCase = packLeft;
    /* And the case the guard must NOT break: a real second pack still credits. */
    buy("review", "plan_reviews5"); seen.afterSecondPack = packLeft;
    return seen;
  });
  ok(topup.afterPack === 5, `the pack grants five reviews (${topup.afterPack})`);
  ok(topup.afterLetter === 5,
     `a 149 letter grants none of them (${topup.afterLetter})`);
  ok(topup.afterCase === 5,
     `nor does a 349 case file (${topup.afterCase})`);
  ok(topup.afterSecondPack === 10,
     `but buying the pack again really does add five (${topup.afterSecondPack})`);

  console.log("\n— the bundle is never priced at nothing");
  /* THE DEFECT: upgradeCost() resolved the wanted tier in PLAN_SETS, which
     deliberately excludes the bundle, so planIndex returned -1 and the function
     fell through to `return 0`. activePlans() then offered 549 for free. */
  const bundlePrice = await p.evaluate(() => {
    owned = { review:null, letter:null, case:null };
    const scratch = { review: upgradeCost("review","plan_bundle"),
                      letter: upgradeCost("letter","plan_bundle"),
                      case:   upgradeCost("case","plan_bundle") };
    owned.review = "plan_review";
    const holdingReview = upgradeCost("review","plan_bundle");
    /* Every offer in every mode, checked for a zero — the property, not the
       one instance that broke. */
    const zeros = [];
    ["review","letter","case","bundle"].forEach(m => {
      pwMode = m; pwUpgrade = null;
      activePlans().forEach(x => { if (!(x.amt > 0)) zeros.push(m + "/" + x.name); });
    });
    pwMode = "review"; pwUpgrade = "plan_bundle";
    const offered = activePlans().map(x => x.name + ":" + x.amt);
    pwUpgrade = null;
    return { scratch, holdingReview, zeros, offered, full: BUNDLE.amt };
  });
  ok(bundlePrice.scratch.review === bundlePrice.full &&
     bundlePrice.scratch.letter === bundlePrice.full &&
     bundlePrice.scratch.case === bundlePrice.full,
     `holding nothing, the bundle costs its full price in every mode (${JSON.stringify(bundlePrice.scratch)})`);
  ok(bundlePrice.holdingReview === BUNDLE_LESS_REVIEW,
     `holding the 199 review it costs the difference, ${BUNDLE_LESS_REVIEW} (${bundlePrice.holdingReview})`);
  ok(bundlePrice.zeros.length === 0,
     `no plan in any mode is offered at zero${bundlePrice.zeros.length ? " — " + bundlePrice.zeros.join(", ") : ""}`);
  ok(!/plan_bundle:0\b/.test(bundlePrice.offered.join(" ")),
     `and the upgrade offer carries a real price (${bundlePrice.offered.join(", ")})`);

  console.log("\n— the upgrade has a door, and it grants all three products");
  /* THE DEFECT: openUpgrade() was called from nowhere in the product, so every
     branch downstream of pwUpgrade was unreachable — which is how the bundle
     came to price at zero without anyone noticing. */
  const upsell = await p.evaluate(() => {
    nat = "saudi";
    owned = { review:"plan_review", letter:null, case:null };
    current = SAMPLES.employment; current.srcText = null;
    renderResult();
    const tease = document.getElementById("bundleUp");
    const out = { shown: !!tease, text: tease ? tease.innerText.replace(/\s+/g," ").trim() : "" };
    if (tease) {
      tease.onclick();
      out.upgrade = pwUpgrade;
      out.priced = activePlans().map(x => x.amt);
      pwPlan = 0; grantAndGo();
      out.owned = JSON.parse(JSON.stringify(owned));
      out.landed = (document.querySelector(".screen.active") || {}).id;
    }
    /* Nothing left to add — the row must not appear. */
    owned = { review:"plan_review", letter:"plan_letter", case:"plan_case" };
    renderResult();
    out.shownWhenComplete = !!document.getElementById("bundleUp");
    return out;
  });
  ok(upsell.shown, "a reader holding only the review is offered the rest");
  ok(upsell.upgrade === "plan_bundle", `the control opens the bundle upgrade (${upsell.upgrade})`);
  ok(JSON.stringify(upsell.priced) === JSON.stringify([BUNDLE_LESS_REVIEW]),
     `at the difference and not the full price (${JSON.stringify(upsell.priced)})`);
  ok(upsell.owned && upsell.owned.review && upsell.owned.letter && upsell.owned.case,
     `and paying grants all three (${JSON.stringify(upsell.owned)})`);
  ok(!upsell.shownWhenComplete,
     "a reader who already holds all three is not sold them again");
  /* The rendered text, because this is where a duplicated copy key showed up:
     pw_up_title and pw_pay_up are the same six words in Arabic, so using both
     printed the title twice. Only visible by reading the output. */
  {
    const words = upsell.text.split(" ").filter(Boolean);
    const half = words.slice(0, Math.floor(words.length / 2)).join(" ");
    ok(!(half && upsell.text.indexOf(half) !== upsell.text.lastIndexOf(half)),
       `the upsell does not repeat itself (${upsell.text})`);
  }

  console.log("\n— paying at the scan limit analyses the contract you paid for");
  /* THE DEFECT, and the worst one found: scanGate() interrupts a scan two ways.
     The sign-in branch recorded pendingScan and resumed it; the paywall branch
     set five pieces of paywall state and recorded nothing. Measured before the
     fix: the reader paid 199 and was shown the PREVIOUS contract's result. */
  const paidScan = await p.evaluate(() => {
    const B = [
      "EMPLOYMENT CONTRACT",
      "This agreement is made between the Employer and the Employee.",
      "Article 1. Basic salary: 8,000 SAR per month.",
      "Article 2. Probation period: 180 days from the start date.",
      "Article 3. Non-compete: the employee shall not compete for 5 years in any territory.",
      "Article 4. Termination: the employer may terminate at any time without notice.",
      "Article 5. Annual leave: 15 days per year.",
      "Article 6. Working hours: 12 hours per day, six days a week.",
      "Signed by both parties."
    ].join("\n");
    nat = "saudi";
    authOn = () => true;
    window.WodouhAuth = Object.assign({}, window.WodouhAuth || {}, {
      user: () => ({ id: "u1", email: "a@b.c" }),
      api: () => Promise.resolve(null),
      apiCount: () => Promise.resolve(1)
    });
    scanServer = 1;                                  /* the month's scan is used */
    owned = { review:null, letter:null, case:null }; packLeft = 0; packUntil = 0;
    current = SAMPLES.employment;                    /* contract A is on screen */
    const wasA = current.doc;
    document.getElementById("pasteBox").value = B;
    analyze("pasted");                               /* they try to scan B */
    const atGate = { screen: (document.querySelector(".screen.active")||{}).id,
                     pending: pendingScan };
    pwPlan = activePlans().findIndex(x => x.name === "plan_review");
    grantAndGo();                                    /* they pay 199 */
    return { wasA, atGate };
  });
  ok(paidScan.atGate.screen === "screen-paywall",
     `the scan limit sends the reader to the paywall (${paidScan.atGate.screen})`);
  ok(paidScan.atGate.pending === "pasted",
     `and records what they were trying to read (${paidScan.atGate.pending})`);
  await p.waitForTimeout(2600);                      /* runLoading() is animated */
  const landed = await p.evaluate(() => ({
    screen: (document.querySelector(".screen.active") || {}).id,
    doc: (current || {}).doc,
    isB: !!(current && current.srcText && /Non-compete/.test(current.srcText)),
    clauses: ((current && current.clauses) || []).length,
    pending: pendingScan
  }));
  ok(landed.isB,
     `after paying, the contract analysed is the one they paid for, not ${paidScan.wasA} (doc=${landed.doc})`);
  ok(landed.clauses > 0, `and it produced a real reading (${landed.clauses} clauses)`);
  ok(landed.screen !== "screen-paywall",
     `the reader is not bounced back to the paywall they just paid at (${landed.screen})`);
  ok(landed.pending === null, "and the pending scan is cleared, so it cannot run twice");

  console.log("\n— the case file is spent on a new assessment, and says so");
  /* THE DEFECT: owned.case was cleared nowhere, so the 349 case file was bought
     once and kept for life while the 149 letter was metered per contract. */
  /* DRIVES THE REAL CALCULATOR. An earlier draft of this test re-ran the
     signature comparison inline, which tested a copy of the logic rather than
     the logic — it would have passed with the fix reverted. calcEos() is the
     function that actually assigns eosData, so that is what gets called. */
  const caseScope = await p.evaluate(() => {
    const run = (start, end, wage) => {
      document.getElementById("eosStart").value = start;
      document.getElementById("eosEnd").value = end;
      document.getElementById("eosWage").value = String(wage);
      calcEos();
    };
    nat = "saudi"; eosHow = "term";
    run("2020-01-01", "2026-01-01", 10000);      /* the assessment they buy against */
    owned = { review:null, letter:null, case:"plan_case" };
    const before = has("case");
    run("2020-01-01", "2026-01-01", 10000);      /* same numbers, recomputed */
    const afterSameRecompute = has("case");
    run("2019-01-01", "2026-08-01", 12000);      /* a genuinely different case */
    const afterNew = has("case");
    return { before, afterSameRecompute, afterNew };
  });
  ok(caseScope.before, "a bought case file is held");
  ok(!caseScope.afterNew, "a genuinely different assessment spends it");
  ok(caseScope.afterSameRecompute,
     "but recomputing the same assessment does not take it away");
  ok(/for one assessment/i.test(app) && /لتقييم واحد/.test(app),
     "and the card says so before the reader pays, in both languages");

  /* ---- what the paywall says it accepts is a claim about the gateway */
  console.log("\n— the payment marks on screen match the declared list");
  const marks = await p.evaluate(() => ({
    rendered: [...document.querySelectorAll("#payMarks i")].map(i => i.textContent),
    declared: PAY_MARKS,
  }));
  ok(marks.rendered.length > 0, `the marks render (${marks.rendered.join(", ")})`);
  ok(JSON.stringify(marks.rendered) === JSON.stringify(marks.declared),
     "and they are exactly PAY_MARKS — one place to correct when a gateway is chosen");
  ok(!/<i>mada<\/i>|<i>Apple/.test(app),
     "no payment method is hard-coded in the markup any more");

  await b.close();
  if (FAIL.length){
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach(f => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nall commercial checks passed");
})().catch(e => { console.error(e); process.exit(1); });
