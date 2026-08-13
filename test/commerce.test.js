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
    all: [].concat(PLANS, PLANS_CASE, PLANS_TERM).map(x => ({ n: x.name, a: x.amt }))
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

  await seedTermination(p);
  const cheap = await p.evaluate(async () => {
    await openTermResult();                       /* -> paywall */
    const gated = document.querySelector(".screen.active").id;
    document.querySelectorAll("#plans .plan")[0].click();   /* the assessment only */
    grantAndGo();
    show("termnext"); renderTermSteps();
    const btns = [...document.querySelectorAll("#termSteps button")];
    const letterBtn = btns.find(x => x.dataset.step === "2");
    const fileBtn = btns.find(x => x.dataset.step === "3");
    letterBtn.click();
    const afterLetter = document.querySelector(".screen.active").id;
    return { gated, held: owned.term, label: fileBtn.textContent, afterLetter,
             upgrade: upgradeCost("term", "plan_term_full") };
  });
  ok(cheap.gated === "screen-paywall", "the assessment is gated behind payment");
  ok(cheap.held === "plan_term", "buying the first tier records the first tier");
  /* The defect in one line: this used to open the letter. */
  ok(cheap.afterLetter === "screen-paywall",
     "the cheaper tier does not hand over the employer letter");
  ok(cheap.upgrade === 150, `the upgrade is priced at the difference (${cheap.upgrade})`);
  ok(/150/.test(cheap.label) || /١٥٠/.test(cheap.label),
     "the locked button names what the upgrade costs rather than going dead");

  const upgraded = await p.evaluate(() => {
    /* The upgrade paywall offers exactly one thing: the tier not yet held. */
    const offered = [...document.querySelectorAll("#plans .plan")].length;
    const payLabel = document.getElementById("payBtn").textContent;
    grantAndGo();
    const landed = document.querySelector(".screen.active").id;
    show("termnext"); renderTermSteps();
    [...document.querySelectorAll("#termSteps button")].find(x => x.dataset.step === "3").click();
    return { offered, payLabel, landed, held: owned.term,
             screen: document.querySelector(".screen.active").id,
             body: document.getElementById("termDocBody").textContent };
  });
  ok(upgraded.offered === 1, `the upgrade offers only the tier not yet held (${upgraded.offered})`);
  ok(/150/.test(upgraded.payLabel) || /١٥٠/.test(upgraded.payLabel),
     "the upgrade button charges the difference, not the full price again");
  ok(upgraded.landed === "screen-termnext",
     "paying an upgrade returns the reader to the step they were on");
  ok(upgraded.held === "plan_term_full", "the upgrade is recorded as the higher tier");
  ok(upgraded.screen === "screen-termdoc", "the full tier opens the case file");
  ok(upgraded.body.split("\n").length > 20, "the case file has real content");

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
    pwMode = "term"; pwUpgrade = null; pwPlan = 0; renderPaywall(); out.term = read();
    /* The case flow needs its own seeded result. */
    eosData = { start: Date.parse("2018-01-01"), end: Date.parse("2026-01-01"),
                wage: 12000, total: 66000, parts: { y: 8, m: 0 } };
    pwMode = "case"; pwPlan = 0; renderPaywall(); out.case = read();
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
    owned = { letter:null, case:null, term:"plan_term_full" };
    /* The downgrade path: re-enter the paywall on the cheap tier while holding
       the dear one. No route in the UI does this today; the point is that no
       route added later can either. */
    pwMode = "term"; pwUpgrade = null; pwPlan = 0;
    grantAndGo();
    return { held: owned.term, stillFull: has("term", "plan_term_full") };
  });
  ok(monotonic.held === "plan_term_full",
     `a 295 holder stays a 295 holder (${monotonic.held})`);
  ok(monotonic.stillFull === true,
     "and the case file and letter stay unlocked");

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
    owned = { letter:null, case:null, term:null };
    pwMode = "term"; pwUpgrade = null; pwPlan = 0; renderPaywall();
    return { lock: document.getElementById("pwLockLine").textContent,
             lowTier: t("plan_term_d"), highTier: t("plan_term_full_d") };
  });
  /* The strip renders above a card selling the cheaper tier. Naming the case
     file and the letter there sold them as included when they are not — a trap
     sprung on the buying screen. */
  ok(!/case file/i.test(strip.lock),
     "the lock strip does not promise the case file, which is the higher tier");
  ok(!/letter/i.test(strip.lock),
     "nor the employer letter");
  ok(/case file/i.test(strip.highTier) && /letter/i.test(strip.highTier),
     "the higher tier's own description still names both");

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
     window, so the second purchase of the 130 SAR pack granted a lapsed one and
     the buyer received the 65 SAR product. The only customer who repurchases
     the pack is the one it was built for. */
  const pack = await p.evaluate(() => {
    letterSet = new Set([0]);
    current = { doc:"doc_emp", score:40,
                clauses:[{ id:"x", s:"amber", q:null, t:{ar:"بند",en:"Clause"},
                           p:{ar:"وصف",en:"desc"}, a:{ar:"نصيحة",en:"Advice"} }],
                verdict:{ ar:"تحقق", en:"Check" } };
    owned = { letter:null, case:null, term:null }; packUntil = 0;
    pwMode = "letter"; pwUpgrade = null;
    pwPlan = PLANS.findIndex(x => x.name === "plan_pack");
    grantAndGo();
    const first = { held: owned.letter, live: packLive(), until: packUntil };

    /* Six months pass and the window lapses — exactly what the copy promises
       will happen. Then they come back with a new contract and buy again. */
    packUntil = Date.now() - 86400000;
    owned.letter = null;
    pwPlan = PLANS.findIndex(x => x.name === "plan_pack");
    grantAndGo();
    return { first, second: { held: owned.letter, live: packLive(),
                              days: Math.round((packUntil - Date.now()) / 86400000) } };
  });
  ok(pack.first.held === "plan_pack" && pack.first.live,
     "the first purchase grants a live six-month window");
  ok(pack.second.held === "plan_pack", "the second purchase records the pack");
  ok(pack.second.live === true,
     "and the window it grants is actually live — not one that already expired");
  ok(pack.second.days > 175,
     `the repurchased window is a full term (${pack.second.days} days)`);

  /* ------------------------------- a paywall must not wear another's clothes */
  console.log("\n— one paywall does not inherit another's title and button");

  const inherited = await p.evaluate(() => {
    eosData = { start: Date.parse("2018-01-01"), end: Date.parse("2026-01-01"),
                wage: 12000, total: 66000, parts: { y: 8, m: 0 } };
    owned = { letter:null, case:null, term:"plan_term" };
    /* Open the termination upgrade, then leave it — which is what a reader does
       when they decide 150 SAR is not for them today. */
    openUpgrade("term", "plan_term_full", "termnext");
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
    owned = { letter:null, case:null, term:"plan_term_full" };
    packUntil = 0; saveState();
  });
  await p.evaluate(() => location.reload());
  await p.waitForFunction(() => typeof window.show === "function");
  const reloaded = await p.evaluate(() => owned.term);
  ok(reloaded === "plan_term_full", "a real entitlement survives a reload");

  const forged = await p.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem(STORE));
    raw.owned = { letter:"plan_free_everything", case:42, term:"plan_term" };
    raw.packUntil = 8.64e15;
    localStorage.setItem(STORE, JSON.stringify(raw));
    loadState();
    return { letter: owned.letter, cs: owned.case, term: owned.term, pack: packUntil };
  });
  ok(forged.letter === null && forged.cs === null,
     "a hand-edited payload cannot mint a tier the code has never heard of");
  ok(forged.term === "plan_term", "a real tier id in that same payload is still honoured");
  ok(forged.pack <= Date.now() + 183 * 86400000,
     "a forged pack expiry is clamped to the window that was actually sold");

  await b.close();
  if (FAIL.length){
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach(f => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nall commercial checks passed");
})().catch(e => { console.error(e); process.exit(1); });
