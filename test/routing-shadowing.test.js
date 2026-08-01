/* Assistant routing suite.
 *
 * KB.find() returns the FIRST pattern that matches, so a broad pattern placed
 * above a specific one silently answers a question nobody asked — with a
 * confident, well-sourced answer to a different question. That is the worst
 * failure mode this product has, because nothing looks wrong.
 *
 * Two halves, and both matter:
 *   routing.test.js    — real questions reach the right verified answer
 *   routing-shadowing  — widening a pattern did not swallow its neighbours
 *
 * Run against a local server on :8099 from the repo root.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
// Questions that must NOT be captured by the patterns I just widened.
const NEG = [
  ['هل أقدر أسافر برة السعودية؟','nonsa','إجاز','annual-leave must not catch travel'],
  ['can I leave the country on my vacation','nonsa','109','travel question must reach exit/re-entry, not annual leave'],
  ['كم يوم إجازة لي؟','sa','40','a plain leave question must not hit exit/re-entry'],
  ['كم راتبي الأساسي؟','sa','Najiz','plain salary question must not hit unpaid-wages'],
  ['what is my basic salary','sa','Najiz','plain salary question must not hit unpaid-wages'],
  ['أبي محامي','sa','222','plain lawyer request must not hit the limitation entry'],
  ['I need a lawyer','sa','222','plain lawyer request must not hit the limitation entry'],
];
(async()=>{
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const p=await br.newPage(); await p.goto('http://127.0.0.1:8099/app/'); await p.waitForTimeout(800);
  let bad=0;
  for(const [q,tr,mustNot,why] of NEG){
    const r=await p.evaluate(a=>{ nat=a.tr;
      const h=KB.find(e=>forTrack(e)&&e.k.test(a.q));
      return h?h.r.en:'NO MATCH'; }, {q,tr});
    const violated = r.includes(mustNot);
    if(violated){ bad++; console.log(`FAIL "${q}" -> ${r}\n      (${why})`); }
    else console.log(`ok   "${q.slice(0,38)}" -> ${r}`);
  }
  console.log(bad? `\n${bad} new shadowing regressions` : '\nno new shadowing introduced');
  await br.close();
})();
