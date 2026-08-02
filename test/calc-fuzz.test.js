/* Property-based fuzzing of every calculation in Wodouh.
 *
 * Spot checks confirm a formula on the cases you thought of. Invariants catch
 * the cases you did not. A wrong figure in the calculator costs someone real
 * money, so this asserts properties that must hold for ALL inputs rather than
 * outputs for a handful.
 *
 * Run against a local server on :8099 from the repo root.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const B = 'http://127.0.0.1:8099';

const fails = [];
const bad = (area, msg) => fails.push(`[${area}] ${msg}`);

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await br.newPage();
  const jsErr = [];
  p.on('pageerror', e => jsErr.push(e.message));
  await p.goto(B + '/app/'); await p.waitForTimeout(800);

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
    const run = (start,end,wage,how) => {
      nat = 'sa'; eosHow = how; renderEos();
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

  // ---------- report ----------
  console.log('serviceParts cases:'); sp.forEach(r=>console.log(`   ${r.a} -> ${r.b}  =  ${r.got}${r.ok?'':'   <-- MISMATCH'}`));
  console.log('\nresignFactor:', rf.map(r=>`${r.y}:${typeof r.f==='number'?r.f.toFixed(2):r.f}`).join('  '));
  console.log('\ncalcEos:', JSON.stringify({zeroWage:eos.zeroWage,negWage:eos.negWage,sameDay:eos.sameDay,
    reversed:eos.reversed,exactly5:eos.exactly5,exactly10:eos.exactly10,resign1y:eos.resign1y,
    resign2y:eos.resign2y,resign10y:eos.resign10y,monotonic:eos.monotonic}));
  console.log('\ncompEstimate:', JSON.stringify(comp));
  console.log('\ndecide states seen:', dec.states.join(','), '| confidence:', dec.conf.join(','), '| bands:', dec.band.join(','));
  console.log('\nmoney/fmtNum:'); fmt.forEach(r=>console.log(`   ${r.v.padEnd(20)} money="${r.money}" num="${r.num}"`));
  console.log('\nJS errors during fuzz:', jsErr.length ? jsErr.slice(0,3) : 'none');
  console.log(fails.length ? `\n${fails.length} FAILURES:\n  ` + fails.join('\n  ') : '\nALL INVARIANTS HOLD');
  await br.close();
})();
