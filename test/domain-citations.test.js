/* A claim carries a verified source, or it carries no article number at all.
 *
 * WHY THIS SUITE EXISTS
 *
 * All seventeen RULES are employment heuristics and every citation they carry
 * is the Saudi Labour Law. The door the reader came through was discarded at
 * the call site, so a residential lease pasted after choosing "I have a
 * dispute with my landlord" was read by all seventeen. It came back flagging a
 * SALARY clause in a lease and citing "Saudi Labour Law — Article 80" — a rule
 * about an employer dismissing an employee without award or notice — at the
 * landlord's termination clause. A tenant could carry that into a real
 * dispute. The register at docs/legal-sources.md is labour-only, so there is
 * no verified source behind any claim about a lease.
 *
 * THE SECOND DEFECT, WHICH THE FIX ITSELF INTRODUCED AND THIS SUITE CAUGHT:
 * `journey` holds the situation the reader picked — contract, resign, term,
 * owed, unsure, rent, gig — so "is this employment?" cannot be asked as
 * `dom === "job"`, a value nothing ever sets. The first version did exactly
 * that and every employment contract through the main door came back with no
 * clauses at all. The employment assertions below are the larger half of this
 * file for that reason.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const LEASE = [
  "عقد إيجار سكني",
  "مدة الإيجار سنة واحدة وتتجدد تلقائيًا ما لم يخطر أحد الطرفين الآخر.",
  "الأجرة السنوية خمسة وستون ألف ريال تدفع مقدمًا على دفعتين.",
  "يحق للمؤجر إنهاء العقد في أي وقت دون إبداء الأسباب.",
  "في حال تأخر المستأجر عن السداد يلتزم بغرامة قدرها عشرة آلاف ريال عن كل شهر تأخير.",
  "يتحمل المستأجر تكاليف الصيانة الدورية للوحدة.",
].join("\n");

const JOB = [
  "عقد عمل بين صاحب العمل والموظف.",
  "الراتب الشهري الأساسي عشرة آلاف ريال يدفع نهاية كل شهر.",
  "فترة التجربة ستة أشهر قابلة للتمديد.",
  "يحق لصاحب العمل إنهاء العقد في أي وقت دون إبداء الأسباب.",
  "مدة الإشعار خمسة عشر يومًا من الموظف وثلاثون يومًا من الشركة.",
  "الإجازة السنوية خمسة عشر يومًا في السنة.",
  "العمل الإضافي غير مدفوع.",
].join("\n");

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  const read = (text, dom) => p.evaluate(({ t, d }) => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    const r = analyzePasted(t, d);
    if (!r) return { nulled: true };
    return {
      nulled: false,
      n: r.clauses.length,
      titles: r.clauses.map((c) => (c.t && (c.t.ar || c.t)) || "").join(" | "),
      srcs: r.clauses.filter((c) => c.src).map((c) => c.src.ar || c.src),
    };
  }, { t: text, d: dom });

  /* ---- THE DEFECT, at the door it happened on. */
  console.log("— a lease read through the landlord door cites no labour law");
  const lease = await read(LEASE, "rent");
  ok(!lease.nulled, "the lease is still read rather than refused outright");
  ok(lease.srcs.length === 0,
     `and carries no article number at all (${lease.srcs.join(" / ") || "none"})`);
  ok(!/المادة 80/.test(lease.srcs.join(" ")),
     "in particular not Article 80, which is about dismissing an employee");
  ok(!/الراتب/.test(lease.titles),
     `and no salary clause is found in a lease (${lease.titles})`);

  const gig = await read(LEASE, "gig");
  ok(gig.nulled || gig.srcs.length === 0,
     "the freelance door carries no labour citation either");

  /* ---- THE HALF THAT MUST NOT MOVE. Every employment door, by name. */
  console.log("\n— and every employment door still gets the full register");
  const base = await read(JOB, undefined);
  ok(!base.nulled && base.n >= 5,
     `an employment contract with no door set is read in full (${base.n} clauses)`);
  ok(base.srcs.length >= 3,
     `and keeps its citations (${base.srcs.length})`);

  for (const door of ["contract", "term", "resign", "owed", "unsure"]) {
    const r = await read(JOB, door);
    ok(!r.nulled, `${door}: still reads an employment contract`);
    ok(r.n === base.n && r.srcs.length === base.srcs.length,
       `${door}: identical to the default — ${r.n} clauses, ${r.srcs.length} cited`);
  }

  /* A rule that has not declared a domain must never leak into one. */
  console.log("\n— an undeclared rule cannot leak into a domain it was not written for");
  const leaked = await p.evaluate(() =>
    RULES.filter((x) => !x.dom).map((x) => x.t.ar));
  const rentTitles = (await read(LEASE, "rent")).titles;
  ok(leaked.every((t) => !rentTitles.includes(t)),
     `none of the ${leaked.length} employment-only rules appear on the lease`);

  /* ---- THE CASE FILE MUST NOT ANSWER FROM MEMORY.
     calcEos() used to empty the screen and return without clearing eosData,
     and eosData is what the case file is built from. The reader's path:
     compute as "employer ended it", delete the wage (the column empties, so
     the app is saying there is no result), switch to "I resigned" — which does
     not recalculate, because that button only recalculates when the output is
     non-empty — then open the case file. It offered the old award PLUS
     compensation for termination without valid reason, on a wage they had
     deleted, for a termination they had just said did not happen. Someone who
     resigned cannot claim Article 77 at all, and that document is headed
     "ready for settlement or a lawyer". */
  console.log("\n— a cleared calculator leaves no claim behind it");
  const stale = await p.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    goTab("rights"); openEos();
    document.getElementById("eosStart").value = "2015-01-01";
    document.getElementById("eosEnd").value = "2020-01-01";
    document.getElementById("eosWage").value = "10000";
    calcEos();
    const computed = eosData && eosData.total;
    document.getElementById("eosWage").value = "";
    calcEos();
    const afterClear = { screenEmpty: !document.getElementById("eosOut").textContent.trim(),
                         data: eosData };
    eosHow = "resign";
    openRightsCase();
    return { computed, afterClear, landed: document.querySelector(".screen.active").id };
  });
  ok(stale.computed === 25000, `the assessment computed first (${stale.computed})`);
  ok(stale.afterClear.screenEmpty, "clearing the wage empties the result column");
  ok(stale.afterClear.data === null,
     "and clears the claim behind it, not just the pixels");
  ok(stale.landed === "screen-eos",
     `so the case file refuses and sends them back (landed on ${stale.landed})`);

  /* THE OTHER HALF OF THE SAME DEFECT, AND THE ONE THAT WAS LEFT LIVE.
     The guard above covers a reader who presses Calculate again. Nothing
     listened to the inputs themselves, so only that button ever recalculated —
     a reader who computed a figure and then changed the start date and cleared
     the wage still had the old figure on screen, beside an empty wage box,
     above a service line describing the period they had just replaced, and
     next to a date echo that HAD updated. The screen confirmed the inputs
     changed and kept the answer contradicting them, and eosData kept the claim
     behind it. Driven by editing ONLY — Calculate is never pressed again. */
  console.log("\n— and editing an input retires the answer it produced");
  const edited = await p.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    goTab("rights"); openEos();
    /* Explicit, not inherited. The assertion above leaves eosHow on "resign",
       so this read 8,333 — the same award with Article 85's one-third applied.
       Correct arithmetic, wrong premise for what is being tested here. */
    eosHow = "term"; renderEos();
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("eosStart", "2015-01-01"); set("eosEnd", "2020-01-01"); set("eosWage", "10000");
    calcEos();
    const before = { total: eosData && Math.round(eosData.total),
                     shown: !!document.getElementById("eosOut").innerHTML };
    /* One field, one event, no button. */
    set("eosStart", "2023-01-01");
    const after = { shown: !!document.getElementById("eosOut").innerHTML,
                    data: eosData,
                    method: !document.getElementById("eosPre").hidden };
    openRightsCase();
    return { before, after, landed: document.querySelector(".screen.active").id };
  });
  ok(edited.before.total === 25000 && edited.before.shown,
     `a figure was on screen first (${edited.before.total})`);
  ok(!edited.after.shown,
     "changing a date clears the figure it produced, without pressing Calculate");
  ok(edited.after.data === null, "and the claim behind it");
  ok(edited.after.method,
     "with the method panel back in the column rather than a blank half");
  ok(edited.landed === "screen-eos",
     `so the case file refuses on this path too (landed on ${edited.landed})`);

  /* IT CLEARS, IT DOES NOT RECALCULATE, and this is the assertion that says so.
     Recomputing per keystroke prints a figure from a half-typed wage: type
     "10000" and the screen shows an award for 1 riyal, then 10, then 100, each
     one a wrong riyal figure presented as the answer. The first version of
     this check missed it — it edited a date into an invalid range, so
     recalculating happened to clear too and the guard passed while the wrong
     behaviour was in place. */
  const midType = await p.evaluate(() => {
    goTab("rights"); openEos();
    eosHow = "term"; renderEos();
    const set = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set("eosStart", "2015-01-01"); set("eosEnd", "2020-01-01"); set("eosWage", "10000");
    calcEos();
    const had = !!document.getElementById("eosOut").innerHTML;
    /* One keystroke into retyping the wage: still a VALID number, just not the
       one they mean. Every date is still valid, so nothing else forces a
       clear — only the decision not to recalculate does. */
    set("eosWage", "1");
    return { had, shown: !!document.getElementById("eosOut").innerHTML,
             data: eosData };
  });
  ok(midType.had, "a figure was on screen before the reader started retyping");
  ok(!midType.shown,
     "a half-typed wage produces no figure at all, rather than an award for 1 riyal");
  ok(midType.data === null, "and no claim either");

  /* ---- THE METHOD PANEL MUST MATCH THE ANSWER THE READER SELECTED.
     It states Article 84 and cites 84 AND 85, but 85 is the resignation
     reduction and none of it was shown. A reader resigning after three years
     did the arithmetic the panel gives and expected one and a half months;
     the calculator returned a third of it. Under two years the panel promised
     half a month per year and the calculator returned zero. */
  console.log("\n— and the method beside the form matches the answer it will give");
  const wide = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await wide.goto(APP);
  await wide.waitForFunction(() => typeof window.show === "function");
  const panel = await wide.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    if (document.documentElement.lang !== "ar") toggleLang();
    goTab("rights"); openEos();
    const out = {};
    for (const how of ["term", "resign", "expiry"]) {
      eosHow = how; renderEos();
      const li = document.getElementById("eosPreResign");
      out[how] = { shown: !li.hidden && li.offsetParent !== null,
                   text: document.getElementById("eosPre").innerText };
    }
    return out;
  });
  await wide.close();
  ok(panel.resign.shown, "a reader who resigned is shown the reduction");
  ok(/الثلث/.test(panel.resign.text) && /أقل من سنتين/.test(panel.resign.text),
     "with the bands the calculator will actually apply");
  ok(!panel.term.shown && !panel.expiry.shown,
     "and it is not shown where it does not apply");

  /* ---- THE RENTAL PATH STATES NO LAW IT CANNOT SOURCE.
     Four of five rental clauses carried no citation while asserting outcomes:
     eviction "is contestable", major faults "usually remain the landlord's".
     The employment path cites an article per clause; the newest door was
     running on opinion. The rental register in docs/legal-sources.md has three
     rows, so those are the only rental claims the app may make. */
  console.log("\n— the rental sample claims only what the rental register holds");
  const rent = await p.evaluate(() => {
    const S = SAMPLES.rental, all = JSON.stringify(S);
    return { all,
             srcs: S.clauses.filter((c) => c.src).map((c) => c.src.ar),
             n: S.clauses.length };
  });
  ok(!/المادة\s*\d|Article\s*\d/.test(rent.all),
     "no article number appears anywhere on the rental path");
  ok(!/نظام العمل/.test(rent.all),
     "and the Labour Law is never named on a lease");
  /* The exact sentences that were being asserted without a source. */
  for (const claim of ["قابل للاعتراض", "عادة على المالك", "مهما اتسعت"]) {
    ok(!rent.all.includes(claim),
       `no unsourced legal outcome: "${claim}"`);
  }
  /* Every citation that IS there must be one the rental register can back. */
  const ALLOWED = ["شبكة إيجار", "الهيئة العامة للعقار"];
  ok(rent.srcs.every((x) => ALLOWED.some((a) => x.includes(a))),
     `every rental citation is a registered rental source (${rent.srcs.join(" / ") || "none"})`);
  /* The freeze is the one rental claim with a verified row, and the advice
     changed when it arrived: it used to coach a Riyadh tenant to negotiate a
     smaller version of an increase that is frozen. */
  const inc = await p.evaluate(() =>
    SAMPLES.rental.clauses.find((c) => c.topic === "increase"));
  ok(!!inc.src, "the annual-increase clause carries its source");
  ok(/النطاق العمراني/.test(inc.a.ar) && !/فاوض على 5/.test(inc.a.ar),
     "and the advice asks about the freeze before it talks about a percentage");

  /* ---- HOME IS REACHABLE WITHOUT AN ACCOUNT, and the doors behind it are not.
     obFinish() sends every reader who completes the tour to home, and home was
     gated — so a stranger got five onboarding slides and then a wall asking for
     Google, Apple or their email, having been shown nothing at all. */
  console.log("\n— a stranger who finishes the tour lands on the product");
  const stranger = await p.evaluate(() => {
    nat = "sa"; authUser = null; obDone = false;
    obFinish();
    const landed = document.querySelector(".screen.active").id;
    const doors = [...document.querySelectorAll("#situations .sit-card")]
      .filter((c) => !c.hidden).length;
    pickSituation("contract");                    /* a door that needs an account */
    const gated = document.querySelector(".screen.active").id;
    goTab("home"); pickSituation("owed");         /* one that does not */
    const free = document.querySelector(".screen.active").id;
    return { landed, doors, gated, free };
  });
  ok(stranger.landed === "screen-home",
     `the tour ends on the front page, not a sign-in wall (${stranger.landed})`);
  ok(stranger.doors >= 7, `with the doors on it (${stranger.doors})`);
  ok(stranger.gated === "screen-signin",
     "a door that reads a contract still asks for an account, at the moment it is chosen");
  ok(stranger.free === "screen-eos",
     "and the calculator still opens without one");

  const hatch = await p.evaluate(() => {
    nat = "sa"; authUser = null; obDone = true;
    openSignin("home");
    const f = document.getElementById("auFree");
    const cs = getComputedStyle(f);
    const bordered = cs.borderTopStyle !== "none" && parseFloat(cs.borderTopWidth) > 0;
    f.click();
    return { bordered, landed: document.querySelector(".screen.active").id };
  });
  ok(hatch.landed === "screen-home",
     `the "no account" way out lands on the product too (${hatch.landed})`);
  ok(hatch.bordered,
     "and reads as a control rather than as fine print under three buttons");

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nthe register reaches employment contracts and stops at the door of every other kind");
})();
