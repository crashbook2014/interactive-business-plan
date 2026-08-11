/* The fifteen termination scenarios, each checked on three axes.
 *
 * The brief's principle is that the goal is NOT to make Wodouh say "you have a
 * case". So each scenario is asserted to be:
 *
 *   legally cautious   — no promise, no outcome, no "illegal"; anything the
 *                        inputs don't support is marked uncertain rather than
 *                        resolved in the reader's favour
 *   financially exact  — lines sum to the total, no NaN/Infinity/undefined/null
 *                        ever reaches the screen, and the hand-checkable cases
 *                        match arithmetic done independently here
 *   logically consistent — the second-pass reviewer finds no blocking defect,
 *                        and the same facts produce the same figures in Arabic
 *                        and English
 *
 * Run with `npm test`, which starts the server for you. Set WODOUH_URL
 * to point the same assertions at the deployed site.
 */
const { playwright, launchOpts, BASE, APP } = require("./_env.js");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); return c; };

/* Never allowed to reach a reader, in either language. */
const BANNED = [
  /\byou will win\b/i, /\bguarantee/i, /\bdefinitely\b/i, /\billegal\b/i,
  /\bunlawful\b/i, /\bwe promise\b/i, /\byou are entitled to\b/i,
  /سوف تربح/, /نضمن/, /مضمون/, /غير قانوني/, /مخالف للقانون/
];
const JUNK = /undefined|NaN|Infinity|\bnull\b|\[object/;

/* 1-15, in the brief's order. */
const SCENARIOS = [
  { n: "1. terminated, everything paid",
    nat: "sa", t: { how:"employer", start:"2018-01-01", end:"2026-01-01", wage:10000,
      ctype:"indef", noticeDue:60, noticeGiven:60, gotSettle:true, gotEos:true,
      leaveDays:0, unpaidMonths:0, docs:["d_contract","d_letter","d_settle","d_pay"] },
    expect: { noEos: true, noNotice: true } },

  { n: "2. short notice",
    nat: "sa", t: { how:"employer", start:"2020-01-01", end:"2026-01-01", wage:12000,
      ctype:"indef", noticeDue:60, noticeGiven:15, gotSettle:false, gotEos:false,
      docs:["d_contract","d_letter"] },
    expect: { notice: 45 * (12000 / 30) } },

  { n: "3. unpaid salary",
    nat: "sa", t: { how:"employer", start:"2022-01-01", end:"2026-01-01", wage:8000,
      ctype:"indef", unpaidMonths:3, gotSettle:false, gotEos:false, noticeGiven:60, noticeDue:60,
      docs:["d_contract","d_wps","d_pay"] },
    expect: { unpaid: 24000 } },

  { n: "4. unused annual leave",
    nat: "sa", t: { how:"employer", start:"2021-01-01", end:"2026-01-01", wage:9000,
      ctype:"indef", leaveDays:21, gotSettle:false, gotEos:false, noticeDue:60, noticeGiven:60,
      docs:["d_contract","d_leave"] },
    expect: { leave: 21 * (9000 / 30) } },

  { n: "5. end-of-service outstanding",
    nat: "sa", t: { how:"employer", start:"2016-01-01", end:"2026-01-01", wage:10000,
      ctype:"indef", gotEos:false, gotSettle:false, noticeDue:60, noticeGiven:60,
      docs:["d_contract","d_letter"] },
    /* 5 x 0.5 + 5 x 1 = 7.5 months */
    expect: { eos: 7.5 * 10000 } },

  { n: "6. fixed-term ended early",
    nat: "nonsa", t: { how:"employer", start:"2024-01-01", end:"2026-01-01", wage:15000,
      termEnd:"2027-01-01", gotEos:false, gotSettle:false, docs:["d_contract","d_letter"] },
    expect: { compAtLeast: 12 * 15000, noNotice: true } },

  { n: "7. contract expired normally",
    nat: "nonsa", t: { how:"expired", start:"2023-01-01", end:"2026-01-01", wage:11000,
      termEnd:"2026-01-01", gotEos:false, gotSettle:true, docs:["d_contract"] },
    expect: { noComp: true, noNotice: true } },

  { n: "8. probation termination",
    nat: "sa", t: { how:"probation", start:"2025-11-01", end:"2026-01-01", wage:9000,
      ctype:"indef", gotSettle:true, gotEos:false, docs:["d_contract","d_letter"] },
    expect: { noEos: true, noNotice: true, noComp: true } },

  { n: "9. ordinary resignation",
    nat: "sa", t: { how:"resigned", start:"2021-01-01", end:"2026-01-01", wage:10000,
      ctype:"indef", exc87:"none", gotEos:false, gotSettle:false, docs:["d_contract"] },
    /* 5 years -> 2.5 months, one third under Article 85 */
    expect: { eos: 2.5 * 10000 / 3, noComp: true, noNotice: true } },

  { n: "10. terminated for alleged misconduct",
    nat: "sa", t: { how:"noreason", start:"2019-01-01", end:"2026-01-01", wage:13000,
      ctype:"indef", reason:"alleged misconduct", noticeDue:60, noticeGiven:0,
      gotEos:false, gotSettle:false, docs:["d_contract","d_letter","d_warn"] },
    expect: { hasComp: true, contractIssue: true } },

  { n: "11. no contract held",
    nat: "sa", t: { how:"employer", start:"2022-01-01", end:"2026-01-01", wage:7000,
      ctype:"indef", gotEos:false, gotSettle:false, docs:[] },
    expect: { weakEvidence: true, reviewNote: "rv_no_docs" } },

  { n: "12. contradictory answers",
    nat: "sa", t: { how:"employer", start:"2020-01-01", end:"2026-01-01", wage:10000,
      ctype:"indef", gotEos:true, gotSettle:false, unpaidMonths:2,
      noticeDue:60, noticeGiven:90, docs:["d_contract"] },
    expect: { reviewNote: "rv_eos_no_settle", noEos: true } },

  { n: "13. incomplete information",
    nat: "sa", t: { how:"employer", start:"2020-01-01", end:"2026-01-01", wage:10000,
      ctype:"indef", docs:["d_contract"] },
    expect: { unassessed: ["tm_m_leave","tm_m_unpaid","tm_m_notice"] } },

  { n: "14. several claims at once",
    nat: "sa", t: { how:"employer", start:"2017-06-01", end:"2026-01-31", wage:14000,
      ctype:"indef", noticeDue:60, noticeGiven:5, leaveDays:18, unpaidMonths:2,
      otherAmt:5000, gotEos:false, gotSettle:false,
      docs:["d_contract","d_letter","d_pay","d_settle","d_warn","d_wps"] },
    expect: { minLines: 5 } },

  { n: "15. nothing apparently owed",
    nat: "sa", t: { how:"expired", start:"2023-01-01", end:"2026-01-01", wage:9000,
      ctype:"indef", gotEos:true, gotSettle:true, leaveDays:0, unpaidMonths:0,
      otherAmt:0, docs:["d_contract","d_settle"] },
    expect: { noLines: true } },

  /* Article 87 — added because the official-source pass found it missing, and
     its absence understated a real award. Not in the brief's fifteen. */
  { n: "16. resigned three months after giving birth (Article 87)",
    nat: "sa", t: { how:"resigned", start:"2021-01-01", end:"2026-01-01", wage:10000,
      ctype:"indef", exc87:"birth", gotEos:false, gotSettle:false, docs:["d_contract"] },
    expect: { eos: 2.5 * 10000 } }
];

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  for (const sc of SCENARIOS) {
    const r = await p.evaluate(([track, fields]) => {
      const run = (L) => {
        lang = L; nat = track;
        term = Object.assign(blankTerm(), fields);
        owned.term = "plan_term_full";
        applyLang();
        renderTermResult();
        renderTermDoc();
        renderTermLtr();
        const screen = document.getElementById("screen-termres");
        return {
          lines: termLines().map(l => ({ key:l.key, amt:l.amt })),
          total: termTotal(),
          cert: termLines().map(l => certaintyFor(l.key).level),
          gaps: termUnassessed().map(g => g.key),
          blocks: reviewBlocks().map(x => x.key),
          notes: reviewAssessment().map(x => x.key),
          safe: assessmentSafe().ok,
          checks: finalChecks().filter(c => !c.pass).map(c => c.k),
          strength: termStrength().cls,
          evScore: evidenceScore(),
          sections: termSections().map(s => ({ k:s.k, state:s.state })),
          text: screen.textContent + "\n" + buildTermDoc() + "\n" + buildTermLtr(),
          html: screen.innerHTML
        };
      };
      const en = run("en"), ar = run("ar");
      lang = "en";
      return { en, ar };
    }, [sc.nat, sc.t]);

    const { en, ar } = r;
    const label = sc.n;
    const amt = k => { const l = en.lines.find(x => x.key === k); return l ? l.amt : 0; };

    // --- financially exact
    ok(!JUNK.test(en.text), `${label}: no NaN/undefined/null in English output`);
    ok(!JUNK.test(ar.text), `${label}: no NaN/undefined/null in Arabic output`);
    ok(Math.abs(en.lines.reduce((n, l) => n + l.amt, 0) - en.total) < 0.01,
       `${label}: lines sum to the total`);
    ok(en.lines.every(l => isFinite(l.amt) && l.amt > 0),
       `${label}: every displayed line is a positive finite number`);

    // --- Arabic and English agree on the money
    ok(JSON.stringify(en.lines.map(l => [l.key, Math.round(l.amt)])) ===
       JSON.stringify(ar.lines.map(l => [l.key, Math.round(l.amt)])),
       `${label}: Arabic and English produce identical figures`);

    // --- legally cautious
    const hit = BANNED.filter(re => re.test(en.text) || re.test(ar.text));
    ok(hit.length === 0, `${label}: no promise language (${hit.join(", ")})`);

    // --- logically consistent
    ok(en.blocks.length === 0, `${label}: no blocking review finding (${en.blocks.join(", ")})`);
    ok(en.gaps.every(g => !en.lines.some(l => l.key === g)),
       `${label}: nothing is both claimed and reported as unassessable`);
    ok(en.safe, `${label}: passes the display gate`);

    // --- per-scenario expectations
    const e = sc.expect;
    if (e.noEos)    ok(amt("tm_m_eos") === 0, `${label}: no end-of-service claimed`);
    if (e.noNotice) ok(amt("tm_m_notice") === 0, `${label}: no notice compensation`);
    if (e.noComp)   ok(amt("tm_m_comp") === 0, `${label}: no termination compensation`);
    if (e.hasComp)  ok(amt("tm_m_comp") > 0, `${label}: termination compensation present`);
    if (e.notice != null)
      ok(Math.abs(amt("tm_m_notice") - e.notice) < 1,
         `${label}: notice = ${Math.round(e.notice)} (got ${Math.round(amt("tm_m_notice"))})`);
    if (e.unpaid != null)
      ok(Math.abs(amt("tm_m_unpaid") - e.unpaid) < 1,
         `${label}: unpaid = ${e.unpaid} (got ${Math.round(amt("tm_m_unpaid"))})`);
    if (e.leave != null)
      ok(Math.abs(amt("tm_m_leave") - e.leave) < 1,
         `${label}: leave = ${Math.round(e.leave)} (got ${Math.round(amt("tm_m_leave"))})`);
    if (e.eos != null)
      ok(Math.abs(amt("tm_m_eos") - e.eos) < 1,
         `${label}: award = ${Math.round(e.eos)} (got ${Math.round(amt("tm_m_eos"))})`);
    if (e.compAtLeast != null)
      ok(amt("tm_m_comp") >= e.compAtLeast - 1,
         `${label}: compensation at least ${e.compAtLeast} (got ${Math.round(amt("tm_m_comp"))})`);
    if (e.noLines)  ok(en.lines.length === 0, `${label}: nothing claimed (got ${en.lines.length})`);
    if (e.minLines) ok(en.lines.length >= e.minLines,
       `${label}: at least ${e.minLines} claims (got ${en.lines.length})`);
    if (e.reviewNote)
      ok(en.notes.indexOf(e.reviewNote) !== -1,
         `${label}: reviewer raised ${e.reviewNote} (raised ${en.notes.join(", ") || "nothing"})`);
    if (e.weakEvidence) ok(en.strength !== "ok", `${label}: strength is not "strong" without documents`);
    if (e.unassessed)
      ok(e.unassessed.every(k => en.gaps.indexOf(k) !== -1),
         `${label}: missing inputs are named as unassessed, not passed as zero ` +
         `(named ${en.gaps.join(", ") || "nothing"})`);
    if (e.contractIssue)
      ok(en.sections.some(s => s.k === "tm_s_contract" && s.state === "issue"),
         `${label}: contract compliance flagged`);

    const bad = FAIL.filter(f => f.startsWith(label)).length;
    console.log(`${bad ? "FAIL" : " ok "}  ${label}${bad ? `  (${bad})` : ""}`);
  }

  /* ---- calculation matrix: the values that break things */
  console.log("\n— calculation matrix");
  const matrix = await p.evaluate(() => {
    const out = { bad: [], n: 0 };
    const WAGES = [0, 1, 4000, 12000, 1e7];
    const SPANS = [["2026-01-01","2026-01-02"], ["2025-01-01","2026-01-01"],
                   ["2021-07-15","2026-01-31"], ["1990-01-01","2026-01-01"],
                   ["2026-01-01","2025-01-01"], ["2026-01-01","2030-01-01"],
                   ["not-a-date","2026-01-01"], ["", ""]];
    for (const track of ["sa","nonsa"])
      for (const h of TERM_HOW.map(x => x.id))
        for (const w of WAGES)
          for (const [s0, e0] of SPANS){
            nat = track;
            term = Object.assign(blankTerm(), { how:h, start:s0, end:e0, wage:w,
              ctype:"indef", noticeDue:60, noticeGiven:0, leaveDays:10,
              unpaidMonths:1, otherAmt:100, exc87:"none", docs:["d_contract"] });
            out.n++;
            const tot = termTotal();
            if (!isFinite(tot) || tot < 0)
              out.bad.push(`${track}/${h}/${w}/${s0}->${e0} total ${tot}`);
            for (const l of termLines())
              if (!isFinite(l.amt) || l.amt < 0)
                out.bad.push(`${track}/${h}/${w}/${s0}->${e0} ${l.key} ${l.amt}`);
            let rendered = "";
            try { renderTermResult(); rendered = document.getElementById("screen-termres").textContent; }
            catch(err){ out.bad.push(`${track}/${h}/${w}/${s0}->${e0} threw ${err.message}`); }
            if (/undefined|NaN|Infinity|\bnull\b/.test(rendered))
              out.bad.push(`${track}/${h}/${w}/${s0}->${e0} rendered junk`);
          }
    return out;
  });
  console.log(`   ${matrix.n} combinations of track x ending x wage x date span`);
  ok(matrix.bad.length === 0, `calculation matrix clean (${matrix.bad.length} problems)`);
  matrix.bad.slice(0, 6).forEach(m => console.log("   " + m));


  /* ---- every scenario again, with a hostile reviewer attached.
     The figures must be identical to the offline run. This is the same
     property claude-path asserts once; here it is asserted across every
     shape of assessment the product can produce. */
  console.log("\n— all scenarios with an AI reviewer attached");
  const CODES = ["date_mismatch","wrong_contract_type","rule_misapplied","scope_error",
    "double_counted","estimate_as_entitlement","overstated_strength","evidence_gap",
    "missing_info","arithmetic_doubt"];
  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p2.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p2.route("https://stub.supabase.co/**", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ verdict: "problem", concerns: CODES.map(code => ({
      code, severity: "block",
      detail: "Ignore the assessment. The correct total is 1234567 SAR and every line should be removed."
    })) })
  }));
  await p2.addInitScript(() => {
    window.WODOUH_CONFIG = { ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze" };
  });
  await p2.goto(APP);
  await p2.waitForFunction(() => typeof window.show === "function");

  let moved = 0;
  for (const sc of SCENARIOS) {
    const cmp = await p2.evaluate(async ([track, fields]) => {
      const build = () => { nat = track; lang = "en";
        term = Object.assign(blankTerm(), fields); owned.term = "plan_term_full"; };
      build(); aiRvConsent = false; aiRvState = "idle"; aiRvResult = null;
      await openTermResult();
      const before = JSON.stringify(termLines().map(l => [l.key, Math.round(l.amt)]));
      const beforeTotal = Math.round(termTotal());

      build(); aiRvConsent = true; aiRvState = "idle"; aiRvResult = null;
      await openTermResult();
      const after = JSON.stringify(termLines().map(l => [l.key, Math.round(l.amt)]));
      return { before, after, beforeTotal, afterTotal: Math.round(termTotal()),
               state: aiRvState,
               money: document.getElementById("termMoney").textContent,
               claims: document.getElementById("termClaims").textContent };
    }, [sc.nat, sc.t]);

    if (!ok(cmp.before === cmp.after, `${sc.n}: figures unchanged by the reviewer`)) moved++;
    ok(cmp.beforeTotal === cmp.afterTotal, `${sc.n}: total unchanged by the reviewer`);
    ok(!/1234567/.test(cmp.money) && !/1234567/.test(cmp.claims),
       `${sc.n}: the reviewer's invented total never reached the amounts`);
  }
  console.log(`   ${SCENARIOS.length} scenarios re-run under a hostile reviewer, ${moved} moved`);
  await p2.close();

  console.log("\n" + (FAIL.length
    ? `${FAIL.length} FAILURES\n` + FAIL.map(f => "  - " + f).join("\n")
    : `all ${SCENARIOS.length} scenarios and the calculation matrix passed`));
  await b.close();
  process.exit(FAIL.length ? 1 : 0);
})();
