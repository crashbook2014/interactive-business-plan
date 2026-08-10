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
 * Run with `npm test`, which starts the server for you. Set WODOUH_URL
 * to point the same assertions at the deployed site.
 */
const { playwright, launchOpts, BASE, APP } = require("./_env.js");
const { chromium } = playwright();
// Realistic questions -> the reference the correct answer must carry.
const CASES = [
  // [question, track, expected substring of r.en]
  ['كم مكافأة نهاية الخدمة؟','sa','84'],
  ['how is end of service calculated','sa','84'],
  ['هل التأمينات تنقص المكافأة؟','sa','read with'],
  ['does gosi replace my gratuity','sa','read with'],
  ['كم مدة الإشعار؟','sa','75'],
  ['what notice must I give','sa','75'],
  ['what notice must I give','nonsa','77'],
  ['كم إجازتي السنوية؟','sa','109'],
  ['how many annual leave days','sa','109'],
  ['كم فترة التجربة؟','sa','53'],
  ['probation length','sa','53'],
  ['كيف يحسب العمل الإضافي؟','sa','107'],
  ['overtime rate','sa','107'],
  ['كم عندي وقت أرفع دعوى؟','sa','222'],
  ['how long do I have to sue my employer','sa','222'],
  ['what is the time limit to file a claim','sa','222'],
  ['هل يحق له حجز جوازي؟','nonsa','Regulations'],
  ['can they keep my passport','nonsa','Regulations'],
  ['مين يدفع رسوم الإقامة؟','nonsa','40'],
  ['who pays the iqama fees','nonsa','40'],
  ['أقدر أنقل كفالتي؟','nonsa','Qiwa'],
  ['وش نسبة التأمينات عليّ؟','sa','GOSI'],
  ['what percentage is gosi','sa','GOSI'],
  ['do I pay gosi as an expat','nonsa','GOSI'],
  ['هل لي ساند؟','sa','SANED'],
  ['am I eligible for unemployment support','sa','SANED'],
  ['قدمت استقالتي وما ردوا','sa','79'],
  ['I resigned and heard nothing back','sa','79'],
  ['هل عقدي في قوى؟','sa','Qiwa'],
  ['is my contract authenticated','sa','Qiwa'],
  ['راتبي ما صرف','sa','Najiz'],
  ['my salary was not paid','sa','Najiz'],
  ['بند عدم المنافسة','sa','83'],
  ['non-compete clause','sa','83'],
];
(async()=>{
  const br=await chromium.launch(launchOpts());
  const p=await br.newPage(); await p.goto(APP); await p.waitForTimeout(800);
  let fail=0;
  for(const [q,tr,want] of CASES){
    const r=await p.evaluate(a=>{ nat=a.tr;
      const h=KB.find(e=>forTrack(e)&&e.k.test(a.q));
      return h?h.r.en:'NO MATCH'; }, {q,tr});
    const ok=r.includes(want);
    if(!ok){ fail++; console.log(`FAIL [${tr}] "${q}"`);
             console.log(`      want ~"${want}"  got "${r}"`); }
  }
  console.log(`\n${CASES.length - fail}/${CASES.length} routed correctly, ${fail} failures`);
  await br.close();
})();
