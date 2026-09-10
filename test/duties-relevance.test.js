/* Two changes to the clause list that must not become one.
 *
 * RELEVANCE. In a dispute, the clause the argument is about leads the result,
 * whatever colour it is. It usually is not red: a tenant's deposit clause is
 * normally a perfectly fair one, so it sorted last by severity and, on the
 * result screen — which shows a single flag — was not shown at all. The reader
 * came to the app about that clause and the app did not mention it.
 *
 * THE LINE THIS SUITE EXISTS TO HOLD: severity is NOT relevance. `c.s` drives
 * the score, the red/amber counts and the verdict band. If a dispute could
 * change a severity, the same lease would score differently depending on which
 * door the reader came through, and the one number this product asks to be
 * trusted on would depend on the reader's mood. Only the ORDER may change.
 *
 * OBLIGATIONS. Every other part of the result answers "what can they do to
 * me". Nothing answered "what did I agree to", and a reader who only ever sees
 * their rights walks into the obligation they did not read. The duties list is
 * read from a `duty` flag on the clause and invents nothing: a contract with no
 * duty-flagged clauses renders no section rather than guessing at one.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* ---- THE SAFETY PROPERTY, first because everything else is cosmetic if it
     fails: the same contract must score identically through every door. */
  console.log("\n— the door a reader came through cannot change the score");
  /* Measured through analyzePasted(), which is where a score is actually
     COMPUTED. An earlier version of this block read current.score off a
     SAMPLES object — a hardcoded constant — and so compared a literal with
     itself: introducing a journey term into the scoring loop produced zero
     failures. The samples cannot answer this question; only the scorer can. */
  /* THE PROBE IS A LEASE THAT A RENTAL RULE ACTUALLY FIRES ON, and both halves
     of that sentence are corrections.
     It was a lease whose only flaggable clause was an employment-shaped
     non-compete, and it was being READ AS EMPLOYMENT — measured on the commit
     before this one, through the contract door it came back with three clauses
     citing «نظام العمل السعودي — المادة 75» on a document titled «عقد إيجار».
     The probe for "the door cannot change the score" was itself an instance of
     the door changing what law applied.
     A penalty clause and an auto-renewal are added so it is recognised AS a
     lease — those two rules declare themselves general — which is what lets
     this block measure a real score rather than a null. */
  const CONTRACT = [
    "عقد إيجار",
    "البند الأول: يلتزم المستأجر بعدم العمل في أي نشاط مشابه لمدة سنتين.",
    "البند الثاني: مدة الإشعار شهر واحد من الطرفين.",
    "البند الثالث: يتحمل المستأجر جميع أعمال الصيانة الدورية والطارئة.",
    "البند الرابع: تُزاد الأجرة السنوية بنسبة 10% عند كل تجديد.",
    "البند الخامس: يتجدد هذا العقد تلقائيًا ما لم يخطر أحد الطرفين الآخر.",
    "البند السادس: في حال تأخر المستأجر عن السداد يلتزم بغرامة قدرها عشرة آلاف ريال عن كل شهر تأخير."
  ].join("\n");
  const scores = await p.evaluate((txt) => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    const out = {};
    for (const j of ["contract", "rent", "gig"]) {
      goTab("home"); pickSituation(j);
      if (j === "rent") setRentClaim("deposit");
      /* THE DOOR IS PASSED, which it was not. This called analyzePasted(txt)
         with one argument, so every iteration analysed with dom === undefined
         and the three "different doors" were the same call three times. It
         compared a literal with itself, which is the exact defect the comment
         above records about the SAMPLES version — the same mistake, one layer
         further in. */
      const a = analyzePasted(txt, j);
      out[j] = a && {
        score: a.score,
        reds: a.clauses.filter(c => c.s === "red").length,
        ambers: a.clauses.filter(c => c.s === "amber").length,
        greens: a.clauses.filter(c => c.s === "green").length
      };
    }
    return out;
  }, CONTRACT);
  ok(!!scores.contract, "the probe contract is recognised at all, so this measures something");
  ok(JSON.stringify(scores.contract) === JSON.stringify(scores.rent),
     `a rent dispute scores it identically (${JSON.stringify(scores.contract)} vs ${JSON.stringify(scores.rent)})`);
  ok(JSON.stringify(scores.contract) === JSON.stringify(scores.gig),
     `and so does a freelance dispute (${JSON.stringify(scores.gig)})`);
  /* ---- SEVERITY ORDER, which decides the one flag a free reader is shown.
   *
   * This sort was dead. It read SEV[c.s] from a map keyed { bad, warn, ok }
   * while every clause in the app is red, amber or green — so the lookup was
   * undefined on all of them, every clause ranked equal, and the free scan
   * showed whichever clause happened to sit first in the array.
   *
   * It passed inspection for as long as it did because two unrelated things
   * kept it accidentally right: the samples are authored red-first, and
   * analyzePasted() sorts before returning. So the test has to break that
   * accident deliberately — a contract whose green clauses come first is the
   * only shape that can tell a working sort from a dead one, and it is the
   * shape no fixture had.
   */
  console.log("\n— the worst clause leads, whatever order it was written in");
  const order = await p.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    const worstOf = (clauses) => {
      current = { score: 60, doc: "doc_emp",
                  verdict: { ar: "x", en: "x" }, clauses };
      show("result"); renderResult(true); renderClauses();
      return (document.querySelector("#flags .flag") || {}).className || "";
    };
    const base = JSON.parse(JSON.stringify(SAMPLES.employment)).clauses;
    return {
      authored: worstOf(base),
      /* the same contract, written down backwards */
      reversed: worstOf(base.slice().reverse()),
      /* and with the red clause buried in the middle */
      shuffled: worstOf([base[3], base[4], base[0], base[1], base[2]].filter(Boolean)),
    };
  });
  for (const [how, cls] of Object.entries(order)) {
    ok(/\bred\b/.test(cls),
       `${how} order still leads with the red clause (${cls.trim() || "none"})`);
  }

  /* ---- relevance: the disputed clause leads, and says why it is there */
  for (const lang of ["ar", "en"]) {
    console.log(`\n— ${lang}: the clause the dispute is about comes first`);
    for (const [claim, needle] of [["deposit", /deposit|التأمين/i], ["eviction", /terminat|إنهاء/i]]) {
      const r = await p.evaluate(([c, want]) => {
        if ((document.documentElement.lang === "ar") !== (want === "ar")) toggleLang();
        nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
        goTab("home"); pickSituation("rent");
        current = SAMPLES.rental;
        show("result"); renderResult(true); renderClauses(); renderDuties();
        setRentClaim(c);
        renderResult(true); renderClauses();
        return { first: (document.querySelector("#flags .flag h4") || {}).textContent || "",
                 marked: (document.querySelector("#flags .flag.indispute .fl-mark") || {}).textContent || "",
                 markedCount: document.querySelectorAll("#flags .flag.indispute").length };
      }, [claim, lang]);
      ok(needle.test(r.first), `${lang}/${claim}: it leads the list (${r.first})`);
      ok(!!r.marked.trim(), `${lang}/${claim}: and says why it is at the top`);
      ok(r.markedCount === 1, `${lang}/${claim}: exactly one clause is marked (${r.markedCount})`);
    }
  }

  /* ---- the green disputed clause reaches the letter, which was the whole
     point: it could not before, because letters filtered on advice. */
  console.log("\n— a fair clause can still be cited as evidence");
  const cited = await p.evaluate(() => {
    if (document.documentElement.lang !== "ar") toggleLang();
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    goTab("home"); pickSituation("rent");
    current = SAMPLES.rental;
    show("result"); renderResult(true); renderClauses();
    setRentClaim("deposit");
    addAllPoints(); renderLetter(); show("letter");
    const body = document.getElementById("letterBody").textContent;
    const dep = current.clauses.find(c => c.topic === "deposit");
    return { body, sev: dep.s, hasAdvice: !!dep.a, quote: dep.q.ar };
  });
  ok(cited.sev === "green" && !cited.hasAdvice,
     `the deposit clause is green and carries no advice (${cited.sev})`);
  ok(cited.body.includes(cited.quote),
     "and its wording is quoted in the demand letter anyway");
  /* Evidence, not advice — and nothing invented to fill the gap where advice
     would have been. The deposit entry must be exactly its heading and its
     quote: two lines, not three. (An earlier version of this assertion ended
     in "|| true", which made it incapable of failing — a guard that cannot
     fail is not a guard, and this suite has no business shipping one.) */
  const lines = cited.body.split("\n");
  const at = lines.findIndex((l) => l.includes(cited.quote));
  const entry = lines.slice(at - 1, at + 2);
  ok(at > 0, "the deposit entry is findable in the letter");
  ok(/التأمين/.test(entry[0]), `its heading names the clause (${(entry[0] || "").trim()})`);
  ok(!entry[2] || !entry[2].startsWith("   ") || /^\s*$/.test(entry[2]),
     `and no advice line follows it (${JSON.stringify((entry[2] || "").slice(0, 50))})`);

  /* ---- obligations */
  for (const lang of ["ar", "en"]) {
    console.log(`\n— ${lang}: what the reader agreed to do is on the page`);
    const d = await p.evaluate((want) => {
      if ((document.documentElement.lang === "ar") !== (want === "ar")) toggleLang();
      nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
      const out = {};
      for (const k of ["employment", "rental", "freelance"]) {
        current = SAMPLES[k];
        show("result"); renderResult(true); renderClauses(); renderDuties();
        out[k] = {
          shown: !document.getElementById("duties").hidden,
          heading: (document.getElementById("dutyH") || {}).textContent || "",
          items: [...document.querySelectorAll("#dutyList li b")].map(x => x.textContent),
          bodies: [...document.querySelectorAll("#dutyList li span")].map(x => x.textContent),
          flagged: current.clauses.filter(c => c.duty).length
        };
      }
      return out;
    }, lang);
    for (const k of ["employment", "rental", "freelance"]) {
      ok(d[k].flagged > 0, `${lang}/${k}: the sample marks obligations at all (${d[k].flagged})`);
      ok(d[k].shown, `${lang}/${k}: the section renders`);
      ok(d[k].items.length === d[k].flagged,
         `${lang}/${k}: every flagged clause is listed, and only those (${d[k].items.length}/${d[k].flagged})`);
      ok(d[k].items.every((x) => x.trim()) && d[k].bodies.every((x) => x.trim()),
         `${lang}/${k}: nothing in it is blank`);
      ok(/agreed to do|التزمت/.test(d[k].heading),
         `${lang}/${k}: the heading says whose obligations these are (${d[k].heading})`);
    }
  }

  /* ---- and it invents nothing */
  console.log("\n— a contract with no obligations flagged shows no section");
  const none = await p.evaluate(() => {
    current = JSON.parse(JSON.stringify(SAMPLES.rental));
    current.clauses.forEach(c => { delete c.duty; });
    show("result"); renderResult(true); renderClauses(); renderDuties();
    return !document.getElementById("duties").hidden;
  });
  ok(none === false, "no duty flags, no duties section");

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nrelevance moves the order, never the score — and obligations are on the page");
})();
