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
  /* THE BASELINE IS A NAMED DOOR NOW, and that change is the point rather than
     a tidy-up. It used to be `undefined` — "no door set" — used as a
     convenient default to compare the five employment doors against. The
     comparison it was making is still made below and still matters; what was
     wrong was the thing it quietly asserted along the way, that an unrouted
     document is employment. See the unrouted block that follows. */
  const base = await read(JOB, "contract");
  ok(!base.nulled && base.n >= 5,
     `an employment contract through the contract door is read in full (${base.n} clauses)`);
  ok(base.srcs.length >= 3,
     `and keeps its citations (${base.srcs.length})`);

  for (const door of ["contract", "term", "resign", "owed", "unsure"]) {
    const r = await read(JOB, door);
    ok(!r.nulled, `${door}: still reads an employment contract`);
    ok(r.n === base.n && r.srcs.length === base.srcs.length,
       `${door}: identical to the baseline — ${r.n} clauses, ${r.srcs.length} cited`);
  }

  /* ---- NO DOOR AT ALL, WHICH IS NOT THE SAME CLAIM AS "EMPLOYMENT".
   *
   * `journey` is null until a door is picked, and the file-drop handler is
   * bound to `.app` rather than to the intake screen — so a contract dropped
   * anywhere before a door is chosen was analysed with dom === null. That fell
   * through `!NON_EMPLOYMENT.includes(null)` and was read as employment.
   *
   * Measured on the same lease this file already uses: 4 clauses carrying
   * «نظام العمل السعودي — المادة 80» against the landlord's termination
   * clause, versus 3 and no citation through the rental door. Article 80 is
   * about an employer dismissing an employee without award or notice. It is
   * the exact defect the first half of this suite exists to prevent, surviving
   * in the one state that had no door to test.
   *
   * The rule now reads "is this employment", not "is this one of the two
   * exceptions". An unknown document is read — the general rules still fire,
   * because a penalty clause is a penalty clause — and carries no article
   * number, which is the standing rule applied to the case of not yet knowing
   * what we are reading. Failing closed has to mean saying LESS, not nothing:
   * the first attempt at this returned zero clauses for every unrouted
   * document, which is the `dom === "job"` defect arrived at from the other
   * direction, so the count is asserted as well as the citations. */
  /* ---- THE DOCUMENT DECIDES, NOT THE DOOR.
   *
   * The door is a statement about the READER. It stopped matching the file the
   * moment the upload row went on home: that row opens the employment journey,
   * the way the card it replaced did, so a lease pasted through it was read by
   * the employment heuristics and cited the Labour Law at a landlord. Fixing
   * that by asking the reader what kind of document they had would be the
   * situation chooser again, one screen further in, put to the person least
   * able to answer — knowing which law applies is what they came for.
   *
   * WHICH WAY IT MUST FAIL. A citation is only defensible on an employment
   * contract, because the register is labour-only. A misfire towards "unknown"
   * costs a reader their article numbers, which is a paragraph they can still
   * act on. A misfire towards "employment" hands a tenant a labour-law
   * citation they might carry into a real dispute. Those are not comparable,
   * so both directions are asserted separately below rather than as one
   * accuracy number.
   *
   * ASSERTED THROUGH EVERY DOOR, which is the actual claim: the same document
   * gets the same reading whichever situation the reader picked, including the
   * door that contradicts it.
   */
  console.log("\n— the same document reads the same way through every door");
  const DOORS = ["contract", "term", "resign", "owed", "unsure", "rent", "gig", null];
  for (const [name, text, cites] of [["an employment contract", JOB, true],
                                     ["a lease", LEASE, false]]) {
    const seen = [];
    for (const door of DOORS) seen.push(await read(text, door));
    const counts = [...new Set(seen.map((x) => x.n))];
    const srcs = [...new Set(seen.map((x) => x.srcs.length))];
    ok(counts.length === 1,
       `${name}: the same clauses through all ${DOORS.length} doors (${counts.join("/")})`);
    ok(srcs.length === 1,
       `${name}: and the same citations (${srcs.join("/")})`);
    ok(cites ? srcs[0] >= 3 : srcs[0] === 0,
       cites
         ? `${name}: keeps its article numbers even through the landlord door (${srcs[0]})`
         : `${name}: carries none even through the contract door, which is where this broke (${srcs[0]})`);
  }
  /* And the classifier itself, on the two shapes that matter most: the plainly
     written contract with none of the legal register, and English. Both were
     wrong in the first version — English scored at most 1 because it had one
     catch-all family against Arabic's four, so an employment contract saying
     "Employment Contract", "Employee", "salary" and "probation" in its first
     four lines came back "we cannot tell". */
  const kinds = await p.evaluate(() => ({
    plain: docDomain("اتفاقية توظيف\nيعمل الطرف الثاني بوظيفة محاسب.\n"
      + "يستحق الطرف الثاني مبلغ ثمانية آلاف ريال في نهاية كل شهر ميلادي.\nالدوام الرسمي من الثامنة صباحاً."),
    english: docDomain("EMPLOYMENT CONTRACT\nThe Employee shall serve as Site Engineer.\n"
      + "Monthly salary: SAR 10,000. Probation period: 90 days.\nAnnual leave: 21 days."),
    leaseEn: docDomain("RESIDENTIAL LEASE AGREEMENT\nThe Landlord leases the premises to the Tenant.\n"
      + "Annual rent: SAR 65,000. The Tenant maintains the property."),
    prose: docDomain("القطط حيوانات أليفة تحب اللعب والنوم في الشمس طوال اليوم."),
  }));
  ok(kinds.plain === "job",
     `a plainly written contract with none of the legal register is still employment (${kinds.plain})`);
  ok(kinds.english === "job", `and so is an English one (${kinds.english})`);
  ok(kinds.leaseEn === "rent", `an English lease is a lease (${kinds.leaseEn})`);
  ok(kinds.prose === null,
     `and prose about cats is nothing at all, rather than the first guess (${kinds.prose})`);

  console.log("\n— a document with no door yet is read on its own evidence");
  const strayJob = await read(JOB, null);
  ok(!strayJob.nulled && strayJob.n >= 1,
     `an unrouted employment contract is still read rather than refused (${strayJob.n} clauses)`);
  /* REVERSED, AND THE REVERSAL IS THE IMPROVEMENT. This asserted that an
     unrouted employment contract carries NO article number, on the reasoning
     that no door had said it was employment. That was right while the door was
     the only evidence there was: with none, we did not know.
     The document is now read for itself, and it says what it is — «عقد عمل»,
     «صاحب العمل», «الراتب», «فترة التجربة». The register applies because THAT
     is true, not because a reader pressed something, so the citations are
     correct here and withholding them would be the app knowing an answer and
     declining to give it.
     The half that mattered is untouched and sits directly below: an unrouted
     LEASE still carries nothing, which is the direction the whole scoping
     rule exists to protect. */
  ok(strayJob.srcs.length >= 3,
     `and keeps its article numbers, because the document itself says it is employment (${strayJob.srcs.length})`);
  const strayLease = await read(LEASE, null);
  ok(!strayLease.nulled && strayLease.n >= 1,
     `an unrouted lease is read too (${strayLease.n} clauses)`);
  ok(strayLease.srcs.length === 0,
     `and this is the one that mattered — no labour citation on a lease (${strayLease.srcs.join(" / ") || "none"})`);
  ok(!/المادة 80/.test(strayLease.srcs.join(" ")),
     "in particular not Article 80, which is what it used to say");
  ok(!/الراتب/.test(strayLease.titles),
     `and no salary clause is found in it (${strayLease.titles})`);
  /* undefined and null are the same state to a reader and must be to the code:
     `journey` is null, but a caller that simply omits the argument is the same
     "we were not told". */
  const strayUndef = await read(LEASE, undefined);
  ok(strayUndef.srcs.length === 0,
     `and an omitted argument is the same as an absent one (${strayUndef.srcs.join(" / ") || "none"})`);

  /* A rule that has not declared a domain must never leak into one. */
  console.log("\n— an undeclared rule cannot leak into a domain it was not written for");
  const leaked = await p.evaluate(() =>
    RULES.filter((x) => !x.dom).map((x) => x.t.ar));
  const rentTitles = (await read(LEASE, "rent")).titles;
  ok(leaked.every((t) => !rentTitles.includes(t)),
     `none of the ${leaked.length} employment-only rules appear on the lease`);

  /* ---- A TENANT IS NOT ASKED AN EMPLOYMENT-LAW QUESTION ABOUT THEIR FLAT.
     needsTrack() raises a gate reading "نظام العمل يفرّق بين السعودي والمقيم
     في نوع العقد ومدة الإشعار والتعويض", offering the resident "الجواز،
     الإقامة، الرسوم، نقل الكفالة، وتذكرة العودة" — Labour Law, all of it — and
     it fired when a tenant asked us to read their lease. It changes nothing
     there either: forTrack() filters on a rule's `nat`, and after
     ruleInDomain() a lease meets only the three general rules, none of which
     carries one. A question whose answer cannot alter the output is a toll. */
  console.log("\n— the track question is asked about work, and only about work");
  const gates = await p.evaluate(() => {
    obDone = true; authUser = { id: "t", email: "t@t.t" };
    const out = {};
    for (const [door, sample] of [["contract", "employment"], ["rent", "rental"], ["gig", "freelance"]]) {
      nat = null; natGate = false;
      goTab("home"); pickSituation(door);
      analyze(sample);
      out[door] = document.querySelector(".screen.active").id;
    }
    /* The two other callers are employment surfaces and must still gate. */
    nat = null; journey = null; natGate = false; openTerm();
    out.termination = document.querySelector(".screen.active").id;
    nat = null; journey = null; natGate = false; openCase();
    out.caseFile = document.querySelector(".screen.active").id;
    return out;
  });
  ok(gates.contract === "screen-onboard",
     `an employment contract still asks (${gates.contract})`);
  ok(gates.termination === "screen-onboard" && gates.caseFile === "screen-onboard",
     `and so do the termination and case-file paths (${gates.termination}, ${gates.caseFile})`);
  ok(gates.rent !== "screen-onboard" && gates.gig !== "screen-onboard",
     `a lease and a freelance agreement are read without it (${gates.rent}, ${gates.gig})`);

  /* ---- THE CASE FILE MUST STATE THE ENDING THE READER CHOSE, AND CLAIM ONLY
     WHAT THAT ENDING CAN CLAIM.
     buildCaseDoc() printed t("eos_h_term") — "Employer ended it" — whatever
     the reader selected, and compEstimate() read only the wage and the years.
     So someone who told the app they RESIGNED saw a correct 44,658 on the
     calculator and then a claim document demanding 93,151: the award plus
     48,493 of Article 77 compensation for a termination they had just said did
     not happen, over a line asserting their employer ended it. Twice what they
     are owed, in a document headed "ready for settlement or a lawyer".
     Article 77 is a remedy for being terminated. A resigner cannot claim it. */
  console.log("\n— the claim document matches the ending the reader chose");
  const endings = await p.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    if (document.documentElement.lang !== "ar") toggleLang();
    const out = {};
    for (const how of ["term", "resign", "expiry"]) {
      goTab("rights"); openEos();
      eosHow = how; renderEos();
      document.getElementById("eosStart").value = "2018-01-01";
      document.getElementById("eosEnd").value = "2026-01-31";
      document.getElementById("eosWage").value = "12000";
      calcEos();
      const screenTotal = Math.round(eosData.total);
      openRightsCase();
      const doc = buildCaseDoc();
      const line = (l) => (doc.split("\n").find((x) => x.includes(l)) || "").trim();
      out[how] = { screenTotal, comp: Math.round(compEstimate()),
                   howLine: line("طريقة الإنهاء"),
                   claimTotal: Math.round(claimTotal()),
                   onScreenComp: /تعويض الإنهاء/.test(
                     document.getElementById("caseClaim").innerText) };
    }
    return out;
  });
  for (const [how, r] of Object.entries(endings)) {
    const expect = { term: "إنهاء من صاحب العمل", resign: "استقالة",
                     expiry: "انتهاء مدة العقد" }[how];
    ok(r.howLine.includes(expect),
       `${how}: the document says how it ended, truthfully ("${r.howLine}")`);
  }
  ok(endings.resign.comp === 0 && endings.expiry.comp === 0,
     `no Article 77 compensation for a resigner or an expiry (${endings.resign.comp}, ${endings.expiry.comp})`);
  ok(endings.term.comp > 0,
     `and it is still claimed where it can arise (${endings.term.comp})`);
  ok(!endings.resign.onScreenComp && !endings.expiry.onScreenComp,
     "the screen omits the row entirely rather than printing a zero against it");
  /* The screen and the document are one claim stated twice; they must agree. */
  for (const [how, r] of Object.entries(endings)) {
    ok(r.claimTotal === r.screenTotal + r.comp,
       `${how}: the claim total is the award plus what that ending allows (${r.claimTotal})`);
  }

  /* ---- ANSWERING THE NATIONALITY QUESTION MUST NOT PUT LABOUR LAW BACK ON A
     LEASE. setNat() re-analyses a pasted contract, because which rules apply is
     exactly what changed — but it called analyzePasted() without the door. With
     dom undefined every employment rule runs and the citation strip never
     fires, so a tenant who answered a question the app INSISTS on got a Salary
     clause in their lease and Article 80 — an employer dismissing an employee —
     cited at their landlord. The same defect 5c5ac20 fixed, through the one
     call site it missed, and invisible to a suite that never re-analysed. */
  console.log("\n— and it survives the track question, which re-reads the contract");
  const reread = await p.evaluate((txt) => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    goTab("home"); pickSituation("rent");
    current = analyzePasted(txt, journey);
    current.srcText = txt;
    const before = current.clauses.filter((c) => c.src).length;
    setNat("nonsa");
    const after = current.clauses.filter((c) => c.src).length;
    return { before, after,
             titles: current.clauses.map((c) => c.t.ar || c.t).join(" | "),
             srcs: current.clauses.filter((c) => c.src).map((c) => c.src.ar || c.src) };
  }, LEASE);
  ok(reread.before === 0 && reread.after === 0,
     `changing the track leaves the lease with no citation (${reread.srcs.join(" / ") || "none"})`);
  ok(!/الراتب/.test(reread.titles),
     `and no salary clause appears in a lease (${reread.titles})`);

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
    /* Read while home is the ACTIVE screen. offsetParent is null for anything
       inside an inactive one, so asking after the navigation below would
       measure the screen having been left, not the row being absent. */
    const upEl = document.querySelector(".hm-up");
    const upShown = !!upEl && upEl.offsetParent !== null;
    pickSituation("contract");                    /* the reading path */
    const reading = document.querySelector(".screen.active").id;
    goTab("home"); pickSituation("owed");         /* the calculator */
    const free = document.querySelector(".screen.active").id;
    /* And one that keeps something, which is where the gate lives now. */
    show("timeline");
    const kept = document.querySelector(".screen.active").id;
    return { landed, doors, reading, free, kept, upShown };
  });
  ok(stranger.landed === "screen-home",
     `the tour ends on the front page, not a sign-in wall (${stranger.landed})`);
  ok(stranger.doors >= 6, `with the doors on it (${stranger.doors})`);
  ok(stranger.upShown,
     "and the upload row above them, so a reader holding the contract can see Wodouh wants it");
  /* REVERSED, DELIBERATELY. This asserted that the contract door reaches
     sign-in — which was true, and was the thing worth changing: the calculator
     opened to anyone while READING A CONTRACT, the thing the product is for,
     demanded an account before it would do anything. The cheapest output was
     free and the best one was walled, so a stranger had to open an account to
     find out whether Wodouh could read their contract at all.
     The gate did not disappear; it moved to the things that KEEP or SPEND
     something, which is what the third assertion below now checks. */
  ok(stranger.reading === "screen-intake",
     `reading a contract opens without an account (${stranger.reading})`);
  ok(stranger.free === "screen-eos",
     "and the calculator still opens without one");
  ok(stranger.kept === "screen-signin",
     `while a screen that KEEPS something still asks, which is where the gate went (${stranger.kept})`);

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

  /* THE BADGE IS A CLAIM TOO, AND THIS IS THE HALF THE FIRST FIX MISSED.
   *
   * The rental prose was cleaned of "this is challengeable" because no
   * verified source stands behind it outside employment. The BADGE on the same
   * card still read «تستطيع الاعتراض» / "Contestable" — the identical legal
   * conclusion, on the identical screen, in larger type. A fix that cleans the
   * paragraph and leaves the label is not a fix.
   *
   * So the rule is asserted where it belongs: on the strings, for every
   * severity, in both signed modes, in both languages. A badge may tell the
   * reader what to DO — document it, raise it, negotiate it, pause. It may not
   * tell them what the law will DO. */
  const badges = await p.evaluate(() => {
    const out = [];
    for (const l of ["ar", "en"]) {
      lang = l;
      for (const signed of [true, false]) {
        signedMode = signed;
        for (const sv of ["red", "amber", "green"]) {
          out.push({ lang: l, signed, sv, text: actionLabel(sv) });
        }
      }
    }
    return out;
  });
  /* Verbs of entitlement and of outcome. "اعتراض"/"contest"/"challenge" say a
     right exists; "void", "illegal", "win" say how it ends. Neither has a
     verified source behind it outside employment, and the badge does not know
     which door the reader came through. */
  const CONCLUDES =
    /تستطيع|يحق|باطل|ملزم|اعتراض|مخالف|contest|challeng|void|illegal|unenforce|invalid|entitled|win\b/i;
  const loud = badges.filter((x) => CONCLUDES.test(x.text));
  ok(loud.length === 0,
     `no clause badge states a legal conclusion, in either language` +
     (loud.length ? ` — ${loud.map((x) => `${x.lang}/${x.sv}${x.signed ? "/signed" : ""}: "${x.text}"`).join(", ")}` : ""));
  ok(badges.every((x) => x.text && x.text.trim().length > 0),
     "and every one of the twelve still says something");
  ok(badges.length === 12, `all twelve combinations were read (${badges.length})`);

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nthe register reaches employment contracts and stops at the door of every other kind");
})();
