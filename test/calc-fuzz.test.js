/* Property-based fuzzing of every calculation in Wodouh.
 *
 * Spot checks confirm a formula on the cases you thought of. Invariants catch
 * the cases you did not. A wrong figure in the calculator costs someone real
 * money, so this asserts properties that must hold for ALL inputs rather than
 * outputs for a handful.
 *
 * Run with `npm test`, which starts the server for you. Set WODOUH_URL
 * to point the same assertions at the deployed site.
 */
const { playwright, launchOpts, BASE, APP } = require("./_env.js");
const { chromium } = playwright();
const B = BASE;

const fails = [];
const bad = (area, msg) => fails.push(`[${area}] ${msg}`);

(async () => {
  const br = await chromium.launch(launchOpts());
  const p = await br.newPage();
  const jsErr = [];
  p.on('pageerror', e => jsErr.push(e.message));
  await p.goto(APP); await p.waitForTimeout(800);

  // ---------- serviceParts: calendar arithmetic ----------
  const sp = await p.evaluate(() => {
    const out = [];
    const cases = [
      ['2020-01-01','2025-01-01', 5, 0],   // exact 5 years
      ['2020-01-31','2020-03-01', 0, 1],   // month-end rollover
      ['2020-02-29','2021-02-28', 0, 11],  // leap day -> non-leap
      ['2024-02-29','2028-02-29', 4, 0],   // leap to leap
      ['2020-01-01','2020-01-01', 0, 0],   // zero service
      ['2025-01-01','2020-01-01', -5, 0],  // REVERSED dates
      ['1899-01-01','2100-01-01', 201, 0], // absurd range
    ];
    for (const [a,b,ey,em] of cases){
      const r = serviceParts(new Date(a), new Date(b));
      out.push({ a, b, got:`${r.y}y ${r.m}m ${r.d}d`, wantY:ey, wantM:em,
                 ok: r.y===ey && r.m===em, negative: r.y<0||r.m<0||r.d<0 });
    }
    return out;
  });
  sp.forEach(r => {
    if (!r.ok) bad('serviceParts', `${r.a}->${r.b} got ${r.got}, expected ${r.wantY}y ${r.wantM}m`);
  });

  // ---------- resignFactor: the Article 85 tiers ----------
  const rf = await p.evaluate(() => {
    const pts = [-1,0,1,1.99,2,2.5,4.99,5,7,9.99,10,40,1e6,NaN,Infinity];
    return pts.map(y => ({ y: String(y), f: resignFactor(y) }));
  });
  rf.forEach(r => {
    const f = r.f;
    if (!(f >= 0 && f <= 1)) bad('resignFactor', `y=${r.y} gave ${f} (must be 0..1)`);
  });
  // monotonic: more service can never reduce the factor
  for (let i = 1; i < rf.length - 3; i++) {
    if (rf[i].f < rf[i-1].f) bad('resignFactor', `not monotonic at y=${rf[i].y}`);
  }

  // ---------- calcEos: the award itself ----------
  const eos = await p.evaluate(() => {
    /* `exc` is the Article 87 answer and defaults to null — the shipping
       state — so every pre-existing call below is unchanged by it. */
    const run = (start,end,wage,how,exc) => {
      nat = 'sa'; eosHow = how; eosExc87 = exc || null; renderEos();
      document.getElementById('eosStart').value = start;
      document.getElementById('eosEnd').value = end;
      document.getElementById('eosWage').value = String(wage);
      calcEos();
      return eosData ? eosData.total : null;
    };
    const out = {};
    out.zeroWage      = run('2020-01-01','2025-01-01', 0,    'term');
    out.negWage       = run('2020-01-01','2025-01-01', -5000,'term');
    out.sameDay       = run('2025-01-01','2025-01-01', 10000,'term');
    out.reversed      = run('2025-01-01','2020-01-01', 10000,'term');
    out.huge          = run('2020-01-01','2025-01-01', Number.MAX_SAFE_INTEGER,'term');
    out.exactly5      = run('2020-01-01','2025-01-01', 12000,'term');
    out.exactly10     = run('2015-01-01','2025-01-01', 12000,'term');
    out.resign1y      = run('2024-01-01','2025-01-01', 12000,'resign');
    out.resign2y      = run('2023-01-01','2025-01-01', 12000,'resign');
    out.resign10y     = run('2015-01-01','2025-01-01', 12000,'resign');
    /* ARTICLE 87. The free calculator applied the Article 85 reduction on
       length of service alone and never asked about the exceptions, so a
       woman who resigned within three months of giving birth was shown a
       third of what the register says she is owed. Five years at 10,000 is
       25,000 under Article 84; the unfixed calculator returned 8,333. */
    out.exc87base     = awardBase(5, 10000);
    out.excNull       = run('2021-01-01','2026-01-01', 10000,'resign', null);
    out.excNone       = run('2021-01-01','2026-01-01', 10000,'resign', 'none');
    out.excForce      = run('2021-01-01','2026-01-01', 10000,'resign', 'force');
    out.excMarriage   = run('2021-01-01','2026-01-01', 10000,'resign', 'marriage');
    out.excBirth      = run('2021-01-01','2026-01-01', 10000,'resign', 'birth');
    /* The same reader through the paid termination path. These two numbers
       disagreeing IS the bug, so equality is the assertion that matters. */
    term = Object.assign(blankTerm(), { how:'resigned', start:'2021-01-01',
      end:'2026-01-01', wage:10000, exc87:'birth' });
    out.termBirth = termAward();
    term.exc87 = 'none';
    out.termNone  = termAward();
    // monotonicity: a longer service must never pay less
    const svc = [1,2,3,5,7,10,15,20,30].map(n =>
      run(`${2025-n}-01-01`,'2025-01-01', 10000,'term'));
    out.monotonic = svc.every((v,i) => i===0 || v===null || svc[i-1]===null || v >= svc[i-1]);
    out.series = svc;
    return out;
  });

  if (eos.zeroWage !== null)  bad('calcEos', `zero wage produced a figure (${eos.zeroWage}); expected suppression`);
  if (eos.negWage !== null)   bad('calcEos', `negative wage produced ${eos.negWage}; expected suppression`);
  if (eos.sameDay !== null)   bad('calcEos', `same start/end produced ${eos.sameDay}; expected suppression`);
  if (eos.reversed !== null)  bad('calcEos', `reversed dates produced ${eos.reversed}; expected suppression`);
  if (!eos.monotonic)         bad('calcEos', `award not monotonic in service: ${JSON.stringify(eos.series)}`);
  if (eos.exactly5 !== null && eos.exactly5 !== 12000*2.5)
    bad('calcEos', `5y@12000 gave ${eos.exactly5}, expected 30000 (half-month x5)`);
  if (eos.exactly10 !== null && eos.exactly10 !== 12000*2.5 + 12000*5)
    bad('calcEos', `10y@12000 gave ${eos.exactly10}, expected 90000`);
  if (eos.resign1y !== null && eos.resign1y !== 0)
    bad('calcEos', `resign under 2y gave ${eos.resign1y}, expected 0`);

  // ---------- Article 87: the exceptions to the Article 85 reduction ----------
  // Unanswered and "none" must not move the figure: the default can only ever
  // understate, never overstate, and only the reader's own answer lifts it.
  const reduced = eos.exc87base / 3;
  for (const k of ['excNull','excNone'])
    if (Math.abs(eos[k] - reduced) > 0.01)
      bad('Article 87', `${k} gave ${eos[k]}, expected the reduced ${reduced.toFixed(2)}`);
  // Each of the three qualifying cases keeps the FULL award.
  for (const k of ['excForce','excMarriage','excBirth'])
    if (Math.abs(eos[k] - eos.exc87base) > 0.01)
      bad('Article 87', `${k} gave ${eos[k]}, expected the full ${eos.exc87base}`);
  // And the free calculator must agree with the paid assessment about the same
  // reader. The two disagreeing is the defect this section exists to prevent.
  if (Math.abs(eos.excBirth - eos.termBirth) > 0.01)
    bad('Article 87', `calculator ${eos.excBirth} vs termination ${eos.termBirth} — the two paths disagree`);
  if (Math.abs(eos.excNone - eos.termNone) > 0.01)
    bad('Article 87', `calculator ${eos.excNone} vs termination ${eos.termNone} — the two paths disagree`);

  // ---------- compEstimate: Article 77, both branches ----------
  const comp = await p.evaluate(() => {
    const setup = (track,start,end,wage,termEnd) => {
      nat = track; eosHow = 'term'; renderEos();
      document.getElementById('eosStart').value = start;
      document.getElementById('eosEnd').value = end;
      document.getElementById('eosWage').value = String(wage);
      calcEos();
      const te = document.getElementById('eosTermEnd');
      if (te) te.value = termEnd || '';
      return compEstimate();
    };
    const W = 10000;
    return {
      saFloor:     setup('sa',   '2024-06-01','2025-01-01', W, ''),
      sa6y:        setup('sa',   '2019-01-01','2025-01-01', W, ''),
      nsaNoDate:   setup('nonsa','2019-01-01','2025-01-01', W, ''),
      nsa8m:       setup('nonsa','2019-01-01','2025-01-01', W, '2025-09-01'),
      nsaPastTerm: setup('nonsa','2019-01-01','2025-01-01', W, '2024-01-01'),
      nsaFarFuture:setup('nonsa','2019-01-01','2025-01-01', W, '2099-01-01'),
      nsaGarbage:  setup('nonsa','2019-01-01','2025-01-01', W, 'not-a-date'),
      floorRef: W * 2,
    };
  });
  const FLOOR = comp.floorRef;
  ['saFloor','sa6y','nsaNoDate','nsa8m','nsaPastTerm','nsaFarFuture','nsaGarbage'].forEach(k => {
    const v = comp[k];
    if (!Number.isFinite(v)) bad('compEstimate', `${k} produced ${v}`);
    else if (v < FLOOR) bad('compEstimate', `${k}=${v} is below the two-month floor ${FLOOR}`);
  });
  if (comp.nsa8m <= comp.nsaNoDate)
    bad('compEstimate', `remaining-term branch (${comp.nsa8m}) should exceed the bare floor (${comp.nsaNoDate})`);

  // ---------- decide / confidence / scoreBand ----------
  const dec = await p.evaluate(() => {
    const mk = (reds,ambers,score) => ({
      score, doc:'doc_pasted',
      clauses:[...Array(reds).fill({s:'red'}), ...Array(ambers).fill({s:'amber'})]
    });
    const out = { states:new Set(), bad:[] };
    for (let r=0;r<5;r++) for (let a=0;a<5;a++) for (const s of [0,25,49,50,75,100]) {
      const d = decide(mk(r,a,s));
      out.states.add(d);
      if (!['safe','negotiate','lawyer'].includes(d)) out.bad.push(`r=${r} a=${a} s=${s} -> ${d}`);
      if (r===0 && a===0 && d!=='safe') out.bad.push(`clean contract scored ${d}`);
      if (r>=2 && d!=='lawyer') out.bad.push(`${r} reds gave ${d}, expected lawyer`);
    }
    const conf = [0,1,3,4,10,50].map(n => confidence({doc:'doc_pasted',clauses:Array(n).fill({s:'red'})}).level);
    const band = [-10,0,39,40,59,60,79,80,100,1e9].map(n => scoreBand(n));
    return { states:[...out.states], bad:out.bad, conf, band };
  });
  dec.bad.forEach(m => bad('decide', m));
  if (!dec.band.every(b => ['great','good','fair','poor'].includes(b)))
    bad('scoreBand', `out-of-range value produced: ${JSON.stringify(dec.band)}`);
  if (!dec.conf.every(c => ['high','med','low'].includes(c)))
    bad('confidence', `unexpected level: ${JSON.stringify(dec.conf)}`);

  // ---------- money / fmtNum formatting ----------
  const fmt = await p.evaluate(() => {
    const vals = [0, -1, 0.5, 1e6, 1e15, NaN, Infinity, -Infinity];
    return vals.map(v => ({ v:String(v), money:String(money(v)), num:String(fmtNum(v)) }));
  });
  fmt.forEach(r => {
    if (/undefined|NaN|Infinity/.test(r.money) && !/NaN|Infinity/.test(r.v))
      bad('money', `money(${r.v}) = ${r.money}`);
  });

  // ---------- the shared money core ----------
  // These are pure and used by BOTH the calculator and the termination
  // assessment, so a broken invariant here is broken in two places at once.
  const core = await p.evaluate(() => {
    const out = { bad: [] };
    const WAGES = [0, -1, 0.5, 1, 1000, 12000, 1e7, 1e15, NaN, Infinity, -Infinity];
    const YEARS = [-5, 0, 0.001, 1, 1.99, 2, 5, 5.001, 10, 40, 201, NaN, Infinity];

    // awardBase: never negative, never decreases with service, and the
    // Article 84 shape holds — the rate doubles after year five.
    for (const w of WAGES){
      let prev = -Infinity;
      for (const y of YEARS){
        const v = awardBase(y, w);
        if (w > 0 && y >= 0 && isFinite(y) && isFinite(w)){
          if (!(v >= 0)) out.bad.push(`awardBase(${y},${w}) = ${v} is negative`);
          if (v < prev) out.bad.push(`awardBase not monotonic at y=${y}, w=${w}`);
          prev = v;
        }
      }
    }
    // The post-five rate is exactly double the first-five rate.
    const w = 12000;
    const five = awardBase(5, w), six = awardBase(6, w);
    if (Math.abs(five - 2.5 * w) > 0.01) out.bad.push(`awardBase(5) = ${five}, expected ${2.5 * w}`);
    if (Math.abs((six - five) - w) > 0.01) out.bad.push(`year six should add one full month, added ${six - five}`);

    // monthsBetween: never negative, null where unknown, symmetric-safe.
    const MB = [
      [null, 1, null], [1, null, null], [NaN, 1, null], [1, NaN, null],
      [Date.UTC(2026,0,1), Date.UTC(2025,0,1), 0],       // already past its term
      [Date.UTC(2026,0,1), Date.UTC(2026,0,1), 0],
      [Date.UTC(2026,0,1), Date.UTC(2027,0,1), 12]
    ];
    for (const [a, b, want] of MB){
      const v = monthsBetween(a, b);
      if (want === null ? v !== null : Math.abs(v - want) > 0.05)
        out.bad.push(`monthsBetween(${a},${b}) = ${v}, expected ${want}`);
      if (v !== null && v < 0) out.bad.push(`monthsBetween(${a},${b}) went negative`);
    }

    // compFor: the Article 77 floor of two months' wages must ALWAYS hold on
    // both branches, and no input may produce a negative or NaN.
    for (const wage of WAGES){
      for (const y of YEARS){
        for (const branch of ["fixed", "indef"]){
          for (const rem of [null, 0, 1, 12, 600, NaN]){
            const v = compFor(wage, y, branch, rem);
            if (!isFinite(v) && isFinite(wage)) out.bad.push(`compFor(${wage},${y},${branch},${rem}) = ${v}`);
            if (isFinite(wage) && wage > 0 && v < wage * 2 - 0.01)
              out.bad.push(`Article 77 floor broken: compFor(${wage},${y},${branch},${rem}) = ${v} < ${wage*2}`);
            if (v < 0) out.bad.push(`compFor(${wage},${y},${branch},${rem}) is negative`);
          }
        }
      }
    }
    // A fixed-term contract with an unknown remaining term returns the floor,
    // never a guess from the other branch.
    if (compFor(10000, 20, "fixed", null) !== 20000)
      out.bad.push(`fixed branch with unknown term should be the floor, got ${compFor(10000,20,"fixed",null)}`);

    // leaveFor and noticeFor: zero or positive, never NaN, and shorter notice
    // can never owe less than longer notice.
    for (const wage of WAGES){
      for (const d of [-5, 0, 1, 21, 365, 1e6, NaN]){
        const l = leaveFor(d, wage), n = noticeFor(60, d, wage);
        if (!isFinite(l) || l < 0) out.bad.push(`leaveFor(${d},${wage}) = ${l}`);
        if (!isFinite(n) || n < 0) out.bad.push(`noticeFor(60,${d},${wage}) = ${n}`);
      }
      if (isFinite(wage) && wage > 0){
        if (noticeFor(60, 0, wage) < noticeFor(60, 30, wage))
          out.bad.push(`less notice given should owe more, wage=${wage}`);
        if (noticeFor(60, 90, wage) !== 0)
          out.bad.push(`over-served notice should owe nothing, wage=${wage}`);
      }
    }
    return out;
  });
  core.bad.forEach(m => bad('money core', m));

  // ---------- termination award: the Article 81 distinction ----------
  const term81 = await p.evaluate(() => {
    const out = { bad: [], rows: [] };
    const base = { start:"2020-01-01", end:"2026-01-01", wage:10000 };
    for (const nation of ["sa", "nonsa"]){
      nat = nation;
      const seen = {};
      for (const h of TERM_HOW.map(x => x.id)){
        term = Object.assign(blankTerm(), base, { how:h, ctype:"indef",
          noticeDue:60, noticeGiven:0 });
        seen[h] = { award: termAward(), notice: termNoticeOwed(), comp: termComp() };
        if (!(seen[h].award >= 0)) out.bad.push(`${nation}/${h} award ${seen[h].award}`);
        if (!isFinite(seen[h].notice) || seen[h].notice < 0)
          out.bad.push(`${nation}/${h} notice ${seen[h].notice}`);
      }
      // The distinction this whole feature exists for.
      if (seen.forced.award !== seen.employer.award)
        out.bad.push(`${nation}: Article 81 award should equal a termination award`);
      if (!(seen.resigned.award < seen.forced.award))
        out.bad.push(`${nation}: ordinary resignation should be less than an Article 81 departure`);
      if (seen.probation.award !== 0)
        out.bad.push(`${nation}: probation should carry no award`);
      // Article 76 must never reach the resident track.
      if (nation === "nonsa" && Object.values(seen).some(v => v.notice > 0))
        out.bad.push(`Article 76 notice compensation leaked onto the resident track`);
      out.rows.push({ nation, seen });
    }
    // Under two years an ordinary resignation is zero, and Article 81 is not.
    nat = "sa";
    const short = { start:"2025-01-01", end:"2026-01-01", wage:10000, ctype:"indef" };
    term = Object.assign(blankTerm(), short, { how:"resigned" });
    const quitShort = termAward();
    term = Object.assign(blankTerm(), short, { how:"forced" });
    const forcedShort = termAward();
    if (quitShort !== 0) out.bad.push(`under 2 years an ordinary resignation should be 0, got ${quitShort}`);
    if (!(forcedShort > 0)) out.bad.push(`under 2 years an Article 81 departure should still pay, got ${forcedShort}`);
    out.shortCase = { quitShort, forcedShort };
    return out;
  });
  term81.bad.forEach(m => bad('termination', m));

  // ---------- report ----------
  console.log('serviceParts cases:'); sp.forEach(r=>console.log(`   ${r.a} -> ${r.b}  =  ${r.got}${r.ok?'':'   <-- MISMATCH'}`));
  console.log('\nresignFactor:', rf.map(r=>`${r.y}:${typeof r.f==='number'?r.f.toFixed(2):r.f}`).join('  '));
  console.log('\ncalcEos:', JSON.stringify({zeroWage:eos.zeroWage,negWage:eos.negWage,sameDay:eos.sameDay,
    reversed:eos.reversed,exactly5:eos.exactly5,exactly10:eos.exactly10,resign1y:eos.resign1y,
    resign2y:eos.resign2y,resign10y:eos.resign10y,monotonic:eos.monotonic}));
  console.log(`\nArticle 87 (5y @ 10,000 — full award ${eos.exc87base}):` +
    `\n   unanswered ${eos.excNull}  none ${eos.excNone}` +
    `  force ${eos.excForce}  marriage ${eos.excMarriage}  birth ${eos.excBirth}` +
    `\n   same reader via the paid termination path: birth ${eos.termBirth}  none ${eos.termNone}`);
  console.log('\ncompEstimate:', JSON.stringify(comp));
  console.log('\ndecide states seen:', dec.states.join(','), '| confidence:', dec.conf.join(','), '| bands:', dec.band.join(','));
  console.log('\nmoney/fmtNum:'); fmt.forEach(r=>console.log(`   ${r.v.padEnd(20)} money="${r.money}" num="${r.num}"`));
  console.log('\nmoney core: awardBase / monthsBetween / compFor / leaveFor / noticeFor —',
    core.bad.length ? `${core.bad.length} broken invariants` : 'all invariants hold');
  console.log('termination awards, 6 years, 10,000 SAR:');
  term81.rows.forEach(r => console.log('   ' + r.nation.padEnd(6) +
    Object.entries(r.seen).map(([k,v]) => `${k}=${Math.round(v.award)}`).join('  ')));
  console.log(`   under 2 years: ordinary resignation ${term81.shortCase.quitShort}, ` +
              `Article 81 departure ${Math.round(term81.shortCase.forcedShort)}`);
  console.log('\nJS errors during fuzz:', jsErr.length ? jsErr.slice(0,3) : 'none');
  console.log(fails.length ? `\n${fails.length} FAILURES:\n  ` + fails.join('\n  ') : '\nALL INVARIANTS HOLD');
  await br.close();
})();
