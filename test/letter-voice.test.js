/* Who the letter is written BY, and who it is written TO.
 *
 * WHY THIS SUITE EXISTS
 *
 * buildLetter() printed adviceFor(c) — the same string the result screen
 * shows. But advice is written TO the reader and a letter is written BY them,
 * so a letter addressed to قسم الموارد البشرية read:
 *
 *   "بند عدم المنافسة: اطلب تضييقه … أو حذفه إذا كانت وظيفتك لا تمس أسرار
 *    الشركة."
 *
 * — an imperative instructing HR to ask HR, calling HR's job "your job". Some
 * lines were worse than merely misdirected: "سجّل موعد الاعتراض في تقويمك"
 * told the recipient to put a date in their own calendar, and "لا توقّع على
 * تنازل" told them not to sign the thing they are being asked to change. This
 * is a 149 SAR artefact and the payoff of the whole contract-review journey.
 *
 * A clause carries `ask` now: the same substance in the first person. This
 * suite is the wall between the two voices, and it checks the OUTPUT rather
 * than the field, because the defect was a caller reaching for the wrong
 * string and a check on the data would have passed straight through it.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* Second person addressed at the recipient, in a document the recipient is
   the one reading. "وظيفتك" to HR is the clearest specimen. */
const READER_VOICE_AR = [
  /\bاطلب\b/, /\bاجعل\b/, /\bتأكد\b/, /\bسجّل\b/, /\bفاوض\b/, /\bاحصر\b/, /\bحدد\b/,
  /\bلا توقّع\b/, /وظيفتك/, /عقدك/, /تقويمك/, /حقك/, /لك\b/,
];
const READER_VOICE_EN = [
  /\bask to\b/i, /\bmake sure\b/i, /\byour job\b/i, /\byour contract\b/i,
  /\byour calendar\b/i, /\bdon't sign\b/i, /\bnegotiate\b/i,
];

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* EVERY clause that can reach a letter, not a sample of them: the letter is
     assembled from whichever ones the reader ticked. */
  const letters = await p.evaluate(() => {
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    const out = [];
    for (const lang of ["ar", "en"]) {
      if (document.documentElement.lang !== lang) toggleLang();
      for (const key of Object.keys(SAMPLES)) {
        for (const signed of [false, true]) {
          current = SAMPLES[key];
          signedMode = signed;
          letterSet.clear();
          current.clauses.forEach((c, i) => { if (c.a) letterSet.add(i); });
          if (!selected().length) continue;
          out.push({ lang, key, signed, text: letterText() });
        }
      }
    }
    return out;
  });

  ok(letters.length >= 4, `letters were produced to inspect (${letters.length})`);

  console.log("— nothing in an outgoing letter speaks to the person holding it");
  for (const L of letters) {
    const pats = L.lang === "ar" ? READER_VOICE_AR : READER_VOICE_EN;
    const hit = pats.find((re) => re.test(L.text));
    ok(!hit,
       `${L.lang} ${L.key}${L.signed ? " (signed)" : ""}: no reader-voice instruction` +
       (hit ? ` — found ${hit}` : ""));
  }

  console.log("\n— and it reads as a request from the sender");
  for (const L of letters.filter((x) => x.lang === "ar")) {
    ok(/أرجو|أطلب|أتمنى/.test(L.text),
       `${L.key}${L.signed ? " (signed)" : ""}: asks in the first person`);
  }
  /* The opener carried an indefinite noun with a definite adjective — "عقد عمل
     المعروض" — on the first line of a document going to an employer. */
  const ar = letters.find((x) => x.lang === "ar" && x.key === "employment" && !x.signed);
  ok(ar && !/عقد عمل المعروض|عقد إيجار المعروض|عقد عمل حر المعروض/.test(ar.text),
     "and its first line is grammatical Arabic, not an indefinite noun with a definite adjective");

  /* THE FALLBACK MUST NEVER BE LOAD-BEARING. A clause added later without an
     `ask` still produces a correctly-voiced line, but a useless one — so this
     fails rather than letting the generic quietly become the product. */
  console.log("\n— every clause that can reach a letter says something specific");
  const missing = await p.evaluate(() => {
    const out = [];
    for (const [k, S] of Object.entries(SAMPLES))
      for (const c of S.clauses)
        if (c.a && !(c.ask && c.ask.ar && c.ask.en)) out.push(`${k}: ${c.t.ar}`);
    for (const r of RULES)
      if (r.a && !(r.ask && r.ask.ar && r.ask.en)) out.push(`rule: ${r.t.ar}`);
    return out;
  });
  ok(missing.length === 0,
     `no clause is relying on the generic fallback (${missing.join("; ") || "none"})`);

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nthe letter is written by the reader, to the other side, and reads like it");
})();
