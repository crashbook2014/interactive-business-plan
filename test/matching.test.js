/* Reading contracts as people actually write them.
 *
 * THE BUG THIS SUITE WAS BORN FROM.
 *
 * A realistic Saudi employment contract — ordinary wording, nothing unusual —
 * matched 2 of 17 rules. One of the 15 it missed was written verbatim in the
 * text: the contract said "الإجازة السنوية" and the rule looked for
 * /إجازة\s*سنوية/. It did not match, because Arabic attaches the definite
 * article ال to the FRONT of a word, so after "إجازة" the text reads
 * "السنوية" and the pattern expected "سنوية".
 *
 * That is not one careless regex. Arabic attaches ال and the conjunctions
 * و ف ب ك ل as prefixes rather than separate words, so every multi-word
 * Arabic pattern in the rule set had the same hole — and a rule set written
 * against sample contracts will always look fine, because the samples were
 * written to match it.
 *
 * WHY IT MATTERED MORE THAN A MISSED CLAUSE. When nothing matches,
 * analyzePasted returns null and the reader gets "we couldn't read this" —
 * the same screen a corrupt PDF produces. So a perfectly readable contract
 * and an unreadable file were indistinguishable to the person holding them.
 *
 * WHAT IS PINNED HERE, deliberately as PROPERTIES rather than as a target
 * number: a rule set is never finished, and a test asserting "matches exactly
 * 5" would fail every time someone improved it.
 *
 *   1. Ordinary contract wording is recognised at all — the null return, and
 *      the dead end it causes, is for text that genuinely is not a contract.
 *   2. The ال prefix does not hide a clause that is plainly present.
 *   3. Nonsense still matches nothing. Broadening the patterns must not turn
 *      the matcher into something that fires on anything.
 *   4. Normalisation is for matching only and never touches what is displayed.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* Written the way a Saudi employment contract is written — definite articles
   attached, numbers spelled out, no keyword helpfully isolated. */
const FORMAL = `عقد عمل
أبرم هذا العقد بين شركة النخبة للمقاولات ويشار إليها بالطرف الأول،
وبين المهندس عبدالله محمد، ويشار إليه بالطرف الثاني.
البند الأول: يعمل الطرف الثاني بوظيفة مهندس موقع.
البند الثاني: مدة العقد سنة واحدة وتتجدد تلقائياً ما لم يشعر أحد الطرفين الآخر.
البند الثالث: الراتب الشهري الأساسي عشرة آلاف ريال سعودي.
البند الرابع: فترة التجربة تسعون يوماً من تاريخ المباشرة.
البند الخامس: الإجازة السنوية إحدى وعشرون يوماً مدفوعة الأجر.
البند السادس: ساعات العمل ثمان وأربعون ساعة أسبوعياً.`;

/* The same substance, written plainly by a small employer — no headings, no
   legal register, and not one of the words the old rules keyed on. */
const PLAIN = `اتفاقية توظيف
الطرف الأول مؤسسة الأفق التجارية، والطرف الثاني أحمد علي.
يعمل الطرف الثاني بوظيفة محاسب.
يستحق الطرف الثاني مبلغ ثمانية آلاف ريال في نهاية كل شهر ميلادي.
الدوام الرسمي من الثامنة صباحاً حتى الرابعة مساءً.
يحق لأي من الطرفين إنهاء الاتفاقية بإشعار كتابي مسبق.`;

const ENGLISH = `EMPLOYMENT CONTRACT
The Employee shall serve as Site Engineer.
The monthly salary is 10,000 SAR payable at month end.
The probation period is ninety days from the start date.
Annual leave is twenty-one days paid.
This contract renews automatically unless either party gives prior notice.`;

const NONSENSE = `I like cats and coffee, the weather is nice today.
Yesterday I walked to the shop and bought bread and milk for the week.
My neighbour has a garden with tomatoes in it, and we talked for a while.`;

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.analyzePasted === "function");

  const run = (text, track) => p.evaluate(([txt, tr]) => {
    nat = tr;
    const res = analyzePasted(txt);
    return {
      matched: res ? res.clauses.length : 0,
      score: res ? res.score : null,
      topics: res ? res.clauses.map(c => (c.t && c.t.ar) || c.k || "?") : [],
    };
  }, [text, track]);

  /* ---- 1. ordinary wording is recognised */
  console.log("\n— a contract written the way contracts are written is recognised");
  const formal = await run(FORMAL, "sa");
  ok(formal.matched > 0,
     `a formally-worded Arabic contract analyses rather than dead-ending (${formal.matched} clauses)`);
  ok(formal.matched >= 4,
     `and recognises the substance of it, not one keyword (${formal.topics.join("، ")})`);

  const plain = await run(PLAIN, "sa");
  ok(plain.matched > 0,
     `a plainly-worded contract with none of the legal register still analyses (${plain.matched} clauses)`);

  const english = await run(ENGLISH, "sa");
  ok(english.matched >= 4, `and the English path is unaffected (${english.matched} clauses)`);

  /* ---- 2. the ال prefix specifically */
  console.log("\n— the definite article does not hide a clause that is plainly present");
  const leave = await p.evaluate(() => {
    /* Identical sentences: one with ال attached, one without. A reader writing
       either has written the same clause and must get the same reading. */
    const withAl = "البند الخامس: الإجازة السنوية إحدى وعشرون يوماً مدفوعة الأجر.";
    const without = "البند الخامس: إجازة سنوية إحدى وعشرون يوماً مدفوعة الأجر.";
    nat = "sa";
    const a = analyzePasted(withAl), c = analyzePasted(without);
    return { withAl: a ? a.clauses.length : 0, without: c ? c.clauses.length : 0 };
  });
  ok(leave.without > 0, "the un-prefixed form matches, as it always did");
  ok(leave.withAl === leave.without,
     `and the ال-prefixed form matches identically (${leave.withAl} vs ${leave.without}) — this is the bug that hid a clause written verbatim in the contract`);

  const renew = await p.evaluate(() => {
    nat = "sa";
    /* Contracts write the VERB "تتجدد", not the noun "تجديد". */
    const r = analyzePasted("مدة العقد سنة واحدة وتتجدد تلقائياً ما لم يشعر أحد الطرفين.");
    return r ? r.clauses.map(c => (c.t && c.t.ar) || "?") : [];
  });
  ok(renew.some(x => /تجديد|تلقائ/.test(x)),
     `auto-renewal is caught when written as a verb, which is how contracts write it (${renew.join("، ")})`);

  /* ---- 3. broadening must not make it fire on anything */
  console.log("\n— and nonsense still matches nothing");
  const junk = await run(NONSENSE, "sa");
  ok(junk.matched === 0 && junk.score === null,
     "unrelated prose matches no rule and returns null — the honest dead end is still there for text that is genuinely not a contract");

  const empty = await p.evaluate(() => {
    nat = "sa";
    return ["", "   ", "عقد", "hello"].map(t => (analyzePasted(t) ? "matched" : "null")).join(",");
  });
  ok(empty === "null,null,null,null",
     `empty and one-word input still returns null (${empty})`);

  /* ---- 4. normalisation is for matching only */
  console.log("\n— normalisation never touches what the reader sees");
  const display = await p.evaluate(() => {
    const original = "الإجازة السنوية إحدى وعشرون يوماً";
    nat = "sa";
    analyzePasted(original);
    document.getElementById("pasteBox").value = original;
    return { box: document.getElementById("pasteBox").value,
             normalised: normAr(original) };
  });
  ok(display.box === "الإجازة السنوية إحدى وعشرون يوماً",
     "the reader's own text is displayed exactly as they wrote it");
  ok(display.normalised !== display.box,
     `while the matching form differs from it ("${display.normalised}")`);

  /* Both sides go through the same transform. Normalising only the text was
     the first attempt and it made matching WORSE, because the patterns are
     written in un-normalised Arabic and stopped meeting the text. */
  const sym = await p.evaluate(() => {
    const r = RULES.find(x => /إجاز/.test(x.re.source));
    return { pattern: r ? r.re.source.slice(0, 40) : null,
             normalisedPattern: r ? normAr(r.re.source).slice(0, 40) : null };
  });
  ok(sym.pattern !== sym.normalisedPattern,
     "the patterns are normalised too, not just the text — normalising one side alone is what broke it the first time");

  /* ---- 5. the score says how much of the contract it covers
   *
   * The dangerous output is not a low score. It is a HIGH score on a contract
   * we barely read: "92 / 100" beside two recognised clauses reads as "your
   * contract is fine" to everyone who does not know what the number is
   * computed from.
   *
   * The line saying so already existed and was already accurate. It was set in
   * the smallest, faintest type on a card headlined by a large confident
   * number — correct, and said under its breath. So what is pinned here is
   * that at low coverage it stops being fine print.
   */
  console.log("\n— the score says how much of the contract it actually covers");
  const shown = (txt) => p.evaluate(async (t) => {
    nat = "sa"; show("home");
    document.getElementById("pasteBox").value = t;
    pasteChanged(); analyze("pasted");
    await new Promise(r => setTimeout(r, 2800));
    const conf = document.getElementById("dcConf");
    const cs = getComputedStyle(conf);
    return { screen: document.querySelector(".screen.active").id,
             score: +document.getElementById("scoreNum").textContent,
             level: conf.dataset.level,
             text: conf.textContent.trim(),
             px: parseFloat(cs.fontSize),
             marked: cs.backgroundColor !== "rgba(0, 0, 0, 0)",
             icon: !!conf.querySelector("svg") };
  }, txt);

  const thin = await shown(`اتفاقية
يعمل الطرف الثاني بوظيفة محاسب لدى الطرف الأول.
الراتب الشهري ثمانية آلاف ريال.
فترة التجربة تسعون يوماً.`);
  ok(thin.screen === "screen-result" && thin.level === "low",
     `a contract we barely recognised is marked low coverage (${thin.level})`);
  ok(thin.score >= 80,
     `and it still scores high (${thin.score}) — which is exactly why the caveat has to carry weight`);
  ok(thin.marked === true && thin.icon === true,
     "so at low coverage the line is a marked caution, not a footnote");
  ok(/محسوبة على هذي البنود وحدها|covers those alone/.test(thin.text),
     "and it says what the number MEANS: the score covers the recognised clauses alone");
  ok(/بندين/.test(thin.text),
     `with the count inflected as Arabic inflects it — the dual, not "٢ بنود" (${thin.text.slice(0, 30)}…)`);

  const full = await shown(FORMAL);
  ok(full.level === "med", `a better-recognised contract is not shouted at (${full.level})`);
  ok(full.marked === false && full.px < thin.px,
     `and its line stays quiet (${full.px}px vs ${thin.px}px) — a caution that fires every time stops being one`);

  /* A curated sample is a known quantity and must not be labelled as if we
     had guessed at it. */
  const sample = await p.evaluate(async () => {
    nat = "sa"; analyze("employment");
    await new Promise(r => setTimeout(r, 2800));
    return document.getElementById("dcConf").dataset.level;
  });
  ok(sample === "high", `a built-in sample reports high coverage, because it is authored not matched (${sample})`);

  await b.close();
  console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\nordinary contracts are read as contracts, nonsense still is not, and the score says what it covers");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
