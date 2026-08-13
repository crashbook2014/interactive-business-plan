/* Termination assessment — logic, money and legal scoping.
 *
 * This is the highest-stakes surface in the product: it puts riyal figures in
 * front of someone who has just lost their income. Three things are asserted
 * here that nothing else can catch:
 *
 *   1. Article 81. A resignation forced by employer breach keeps the FULL
 *      Article 84 award; an ordinary resignation takes the reduced Article 85
 *      tiers, which are nothing at all under two years. Showing the wrong one
 *      to someone pushed out of their job is the defect this whole seven-way
 *      split exists to prevent.
 *   2. Article 76 must never reach the resident track. It is the remedy for
 *      breaching Article 75, which does not apply to an always-fixed-term
 *      contract. The same scoping error already shipped once with Article 77.
 *   3. Nothing computed may sit in the DOM before payment, and no generated
 *      string in either language may promise an outcome.
 *
 * Run with `npm test`, which starts the server for you. Set WODOUH_URL
 * to point the same assertions at the deployed site.
 */
const { playwright, launchOpts, BASE, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const fill = (how, nat, extra) => ({ how, nat, extra: extra || {} });

/* An unanswered Article 87 question must not produce a reduced award wearing
   the product's highest certainty label. Article 85's reduction applies by
   default and the exception has to be claimed, so silence used to mean "less
   money, stated confidently" — the third appearance here of one rule shipped
   without its exceptions. */
async function art87Certainty(p){
  return p.evaluate(() => {
    const out = {};
    const base = { how:"resigned", start:"2020-01-01", end:"2026-01-01",
                   ctype:"indef", wage:10000, basic:10000 };
    term = Object.assign(blankTerm(), base);               /* exc87 never answered */
    out.unanswered = { award: Math.round(termAward()),
                       cert: certaintyFor("tm_m_eos").level,
                       missing: certaintyFor("tm_m_eos").missing,
                       unassessed: termUnassessed().map(g => g.key) };
    term = Object.assign(blankTerm(), base, { exc87:"none" });   /* answered: no */
    out.answeredNone = { award: Math.round(termAward()),
                         cert: certaintyFor("tm_m_eos").level };
    term = Object.assign(blankTerm(), base, { exc87:"marriage" });
    out.answeredYes = { award: Math.round(termAward()),
                        cert: certaintyFor("tm_m_eos").level };
    /* The employer path never asks the question, so it must not be demanded. */
    term = Object.assign(blankTerm(), base, { how:"employer" });
    out.employer = { cert: certaintyFor("tm_m_eos").level };
    return out;
  });
}

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error") FAIL.push("console: " + m.text()); });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* Drive the real flow: home card -> 7 options -> questions -> evidence -> paid result */
  const run = await p.evaluate(([how, track, extra]) => {
    nat = track;
    term = blankTerm();
    term.how = how;
    Object.assign(term, extra);
    owned.term = "plan_term_full";
    renderTermHow(); renderTermQ(); renderTermEv(); renderTermResult();
    renderTermDoc(); renderTermLtr();
    return {
      lines: termLines().map(l => ({ key: l.key, amt: l.amt, kind: l.kind, src: l.src })),
      total: termTotal(),
      award: termAward(),
      notice: termNoticeOwed(),
      comp: termComp(),
      res: document.getElementById("screen-termres").textContent,
      doc: buildTermDoc(),
      ltr: buildTermLtr()
    };
  }, ["employer", "sa", { start:"2018-01-01", end:"2026-01-31", wage:12000,
                          noticeDue:60, noticeGiven:10, leaveDays:14,
                          unpaidMonths:2, otherAmt:3000, gotEos:false,
                          gotSettle:false, ctype:"indef", docs:["d_contract","d_letter","d_pay"] }]);

  console.log("\n— worked example: Saudi, employer terminated, 8y service, 12,000 SAR");
  run.lines.forEach(l => console.log(`   ${l.key.padEnd(14)} ${Math.round(l.amt).toString().padStart(9)}  ${l.kind}`));
  console.log(`   ${"TOTAL".padEnd(14)} ${Math.round(run.total).toString().padStart(9)}`);

  /* Article 84 by hand: 5 x 0.5 + 3.08 x 1 = 5.58 months x 12000 */
  const yrs = 8 + 30/365;
  const expectAward = (5 * 0.5 + (yrs - 5)) * 12000;
  ok(Math.abs(run.award - expectAward) < 50,
     `award matches Article 84 by hand (${Math.round(run.award)} vs ${Math.round(expectAward)})`);
  /* Article 76: 50 days short x 400/day */
  ok(Math.abs(run.notice - 50 * 400) < 1, `notice compensation = 50 days short x 400 (${Math.round(run.notice)})`);
  /* Article 77 indefinite: 15 days per year, floor 2 months */
  ok(Math.abs(run.comp - Math.max(24000, yrs * 15 * 400)) < 50,
     `Article 77 indefinite branch (${Math.round(run.comp)})`);
  const sum = run.lines.reduce((n, l) => n + l.amt, 0);
  ok(Math.abs(sum - run.total) < 0.01, "financial lines sum exactly to the stated total");
  ok(run.lines.every(l => l.src), "every money line carries a source");

  /* ---- all seven paths, both tracks, both languages */
  console.log("\n— all seven paths x two tracks x two languages");
  const paths = await p.evaluate(() => {
    const out = [];
    const base = { start:"2020-01-01", end:"2026-01-01", wage:10000, noticeDue:60,
                   noticeGiven:0, leaveDays:10, unpaidMonths:1, ctype:"indef",
                   gotEos:false, gotSettle:false, docs:["d_contract"] };
    for (const track of ["sa","nonsa"]){
      for (const h of TERM_HOW.map(x => x.id)){
        for (const L of ["ar","en"]){
          lang = L; nat = track;
          term = Object.assign(blankTerm(), base, { how:h });
          owned.term = "plan_term_full";
          let err = null;
          try { renderTermResult(); renderTermDoc(); renderTermLtr(); }
          catch(e){ err = e.message; }
          const txt = document.getElementById("screen-termres").textContent +
                      buildTermDoc() + buildTermLtr();
          out.push({ track, h, L, err, notice: termNoticeOwed(), award: termAward(),
                     bad: /undefined|NaN|\[object/.test(txt), txt });
        }
      }
    }
    lang = "en";
    return out;
  });

  ok(paths.every(r => !r.err), "every path renders without throwing");
  paths.filter(r => r.err).forEach(r => console.log("   threw:", r.track, r.h, r.L, r.err));
  ok(paths.every(r => !r.bad), "no undefined / NaN / [object Object] in any path");
  paths.filter(r => r.bad).forEach(r => console.log("   bad:", r.track, r.h, r.L));

  /* Article 76 must never reach the resident track */
  const leak = paths.filter(r => r.track === "nonsa" && r.notice > 0);
  ok(leak.length === 0,
     `Article 76 notice compensation never appears on the resident track (${leak.length} leaks)`);

  /* Article 81: forced resignation keeps the full award; ordinary does not */
  const forced = paths.find(r => r.track === "sa" && r.h === "forced" && r.L === "en");
  const quit   = paths.find(r => r.track === "sa" && r.h === "resigned" && r.L === "en");
  const fired  = paths.find(r => r.track === "sa" && r.h === "employer" && r.L === "en");
  ok(forced.award === fired.award,
     `Article 81 keeps the full award (forced ${Math.round(forced.award)} = terminated ${Math.round(fired.award)})`);
  ok(quit.award < forced.award,
     `ordinary resignation is reduced (${Math.round(quit.award)} < ${Math.round(forced.award)})`);
  const prob = paths.find(r => r.h === "probation" && r.L === "en");
  ok(prob.award === 0, "probation termination carries no award");

  /* ---- banned language, every generated string, both languages */
  console.log("\n— language safety");
  const BANNED = [
    /\byou will win\b/i, /\bguarantee/i, /\bdefinitely\b/i, /\billegal\b/i,
    /\bunlawful\b/i, /\bcertainly\b/i, /\bwe promise\b/i,
    /سوف تربح/, /نضمن/, /مضمون/, /بالتأكيد ستربح/, /غير قانوني/, /مخالف للقانون/
  ];
  const hits = [];
  paths.forEach(r => BANNED.forEach(re => { if (re.test(r.txt)) hits.push(`${r.track}/${r.h}/${r.L}: ${re}`); }));
  ok(hits.length === 0, `no banned promise language (${hits.length} hits)`);
  hits.slice(0, 8).forEach(h => console.log("   " + h));

  /* ---- paywall must not leak a single figure */
  console.log("\n— paywall withholds every computed figure");
  const pw = await p.evaluate(() => {
    nat = "sa"; lang = "en";
    term = Object.assign(blankTerm(), { how:"employer", start:"2020-01-01", end:"2026-01-01",
      wage:10000, leaveDays:10, unpaidMonths:1, ctype:"indef", docs:["d_contract"] });
    owned.term = null;
    openTermResult();
    const html = document.getElementById("screen-paywall").innerHTML;
    return { onPaywall: document.getElementById("screen-paywall").classList.contains("active"),
             html, total: Math.round(termTotal()) };
  });
  ok(pw.onPaywall, "an unpaid assessment lands on the paywall");
  ok(!new RegExp(pw.total.toLocaleString("en-US")).test(pw.html) && !/\b\d{2},\d{3}\b/.test(pw.html.replace(/\d+ SAR/g, "")),
     "no computed total appears in the paywall DOM");
  ok(/2020|2026/.test(pw.html), "the reader's own dates are shown back to them");

  /* ---- persistence round-trip */
  console.log("\n— persistence");
  const round = await p.evaluate(() => {
    term = Object.assign(blankTerm(), { how:"forced", start:"2019-05-01", end:"2026-02-01",
      wage:8000, leaveDays:12, docs:["d_contract","d_letter"] });
    saveState();
    term = null; loadState();
    return term ? { how:term.how, wage:term.wage, docs:term.docs.slice(), leave:term.leaveDays } : null;
  });
  ok(round && round.how === "forced" && round.wage === 8000 && round.leave === 12,
     "answers survive a save/load round trip");
  ok(round && round.docs.length === 2, "declared documents survive the round trip");

  const junk = await p.evaluate(() => {
    localStorage.setItem("wodouh.v1", JSON.stringify({
      term: { how:"../../evil", wage:"9e99", docs:["d_contract","<script>"], leaveDays:-5 } }));
    term = null; loadState();
    return { term, };
  });
  ok(junk.term === null, "a tampered payload with an unknown `how` is rejected outright");

  const junk2 = await p.evaluate(() => {
    localStorage.setItem("wodouh.v1", JSON.stringify({
      term: { how:"employer", wage:9e99, leaveDays:-5, docs:["d_contract","evil"], ctype:"nonsense" } }));
    term = null; loadState();
    return { wage:term.wage, leave:term.leaveDays, docs:term.docs.slice(), ctype:term.ctype };
  });
  ok(junk2.wage === 1e7, `an absurd stored wage is clamped (${junk2.wage})`);
  ok(junk2.leave === 0, "a negative stored leave balance floors at zero");
  ok(junk2.docs.length === 1 && junk2.docs[0] === "d_contract", "unknown document keys are dropped");
  ok(junk2.ctype === null, "an unknown contract type falls back to unset");

  console.log("\n— an unanswered Article 87 question is a missing input, not a silent reduction");
  const a87 = await art87Certainty(p);
  ok(a87.unanswered.cert === "uncertain",
     `unanswered: the award is not "confirmed" (${a87.unanswered.cert})`);
  ok(a87.unanswered.missing.indexOf("exc87") !== -1,
     "and the assessment names exc87 as what it is missing");
  ok(a87.unanswered.unassessed.indexOf("tm_m_eos") !== -1,
     "so the line appears under what we could not assess");
  ok(a87.answeredNone.cert === "confirmed",
     `answering "none of these" is a real answer and restores confidence (${a87.answeredNone.cert})`);
  ok(a87.answeredYes.award > a87.unanswered.award,
     `claiming the exception raises the award (${a87.answeredYes.award} vs ${a87.unanswered.award})`);
  ok(a87.answeredYes.cert === "likely",
     `and that award is "likely", never "confirmed" (${a87.answeredYes.cert})`);
  ok(a87.employer.cert === "confirmed",
     "the employer path never asks the question, so it is not demanded there");

  console.log("\n" + (FAIL.length ? `${FAIL.length} FAILURES\n` + FAIL.map(f => "  - " + f).join("\n")
                                  : "all termination checks passed"));
  await b.close();
  process.exit(FAIL.length ? 1 : 0);
})();
