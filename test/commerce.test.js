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

  const refund = readFileSync(path.join(ROOT, "refund/index.html"), "utf8");
  ok(/twelve months/i.test(refund) && /اثني عشر/.test(refund),
     "the refund policy carries the same term, in both languages");
  /* A part-used pack refunded at the pack rate would refund more than the
     unused reviews are worth. Saying which rate applies is the difference
     between a policy and an argument. */
  ok(/199/.test(refund), "and says which rate a part-used pack is refunded at");

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
