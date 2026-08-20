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
  await p.evaluate((t) => { window.FORMAL_T = t; }, FORMAL);

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
    /* Wrapped in a minimal real document: a bare clause no longer clears the
       structural gate, and rightly so — the reader pastes a contract, not a
       sentence. What is under test here is the ال prefix, not the gate. */
    const head = "عقد عمل\nأبرم هذا العقد بين شركة الأفق ويشار إليها بالطرف الأول، وبين أحمد ويشار إليه بالطرف الثاني.\n";
    const withAl = head + "البند الخامس: الإجازة السنوية إحدى وعشرون يوماً مدفوعة الأجر.";
    const without = head + "البند الخامس: إجازة سنوية إحدى وعشرون يوماً مدفوعة الأجر.";
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
    const r = analyzePasted("عقد عمل\nأبرم هذا العقد بين الطرف الأول والطرف الثاني.\nالبند الثاني: مدة العقد سنة واحدة وتتجدد تلقائياً ما لم يشعر أحد الطرفين.");
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

  /* ---- 4b. a topic word is not a clause
   *
   * Paste "أنا أحب القطط والقهوة… راتبي الشهري ثمانية آلاف ريال والعمل الإضافي
   * والإجازة السنوية وفترة التجربة كلها كلمات موجودة هنا" and the app returned
   * 84/100 with four flagged clauses. None of them existed in that text. The
   * reader was told their contract scored 84 when they pasted a paragraph
   * about cats.
   *
   * The matcher was asking "does this MENTION probation?" when the only
   * question that matters is "does this document IMPOSE a probation term?".
   * The NONSENSE case above never caught it because that string is English and
   * carries no contract vocabulary — a test that cannot fail is not a test.
   */
  console.log("\n— prose that borrows contract words is not a contract");
  const CATS = "أنا أحب القطط والقهوة. اليوم الطقس جميل في الرياض. لا يوجد هنا أي عقد أو بند قانوني إطلاقًا، هذا مجرد نص عشوائي لاختبار النظام. راتبي الشهري هو ثمانية آلاف ريال والعمل الإضافي والإجازة السنوية وفترة التجربة كلها كلمات موجودة هنا لكن بلا سياق عقدي حقيقي.";
  const cats = await run(CATS, "sa");
  ok(cats.matched === 0 && cats.score === null,
     `prose stuffed with contract vocabulary produces NO score (was 84/100 with 4 fabricated clauses)`);

  const gate = await p.evaluate((t) => ({
    cats: looksLikeContract(t).signals,
    formal: looksLikeContract(FORMAL_T).signals,
  }), CATS);
  ok(gate.cats.length === 0,
     `it carries none of the structural signals a legal instrument has (${gate.cats.length})`);

  /* The gate must not turn away real contracts, which is the expensive
     direction to get wrong. */
  for (const [label, txt] of [["formal", FORMAL], ["plain", PLAIN], ["english", ENGLISH]]) {
    const g = await p.evaluate((t) => looksLikeContract(t), txt);
    ok(g.ok === true, `a real ${label} contract clears the gate (${g.signals.join(", ")})`);
  }

  /* Chatty prose ABOUT work, with no adversarial intent — the everyday version
     of the same mistake. */
  const chatty = await run("سألت صديقي عن راتبه الشهري وفترة التجربة في شركته الجديدة، وقال لي إن الإجازة السنوية عندهم ثلاثون يوماً والعمل الإضافي مدفوع.", "sa");
  ok(chatty.matched === 0, "and so is ordinary conversation about a job");

  /* ---- 4c. a red flag must not fire on a clause that says the opposite
   *
   * A real contract read "فترة التجربة تسعون يوماً، يجوز خلالها لأي من الطرفين
   * إنهاء العقد دون إشعار أو مكافأة" — ordinary, lawful, and EXPLICITLY MUTUAL.
   * The app raised a red flag saying one party appeared able to end the
   * contract unilaterally, cited Article 80, scored the contract 44/100, told
   * the reader to see a lawyer, and offered to sell them a letter demanding
   * the clause be changed.
   *
   * A false red flag is the most expensive output this product has: it
   * frightens someone about a term that is fine, in the same breath as asking
   * for money.
   */
  console.log("\n— a red flag does not fire on a clause that says the opposite");
  const HEAD = "عقد عمل\nأبرم هذا العقد بين شركة الأفق ويشار إليها بالطرف الأول، وبين أحمد ويشار إليه بالطرف الثاني.\n";
  const oneSided = (txt) => p.evaluate((t) => {
    nat = "sa";
    const r = analyzePasted(t);
    return r ? r.clauses.some(c => /طرف واحد/.test((c.t && c.t.ar) || "")) : null;
  }, txt);

  ok(await oneSided(HEAD + "البند الثالث: فترة التجربة تسعون يوماً، يجوز خلالها لأي من الطرفين إنهاء العقد دون إشعار أو مكافأة.") === false,
     "a mutual termination clause is NOT called one-sided");
  ok(await oneSided(HEAD + "البند الثالث: يحق للطرف الأول إنهاء العقد في أي وقت ودون إبداء الأسباب ودون إشعار.") === true,
     "while a genuinely one-sided clause still is — the guard excuses, it does not disable");
  ok(await oneSided("EMPLOYMENT CONTRACT\nThe Employer and the Employee agree as follows.\n1. Either party may terminate this agreement without notice during probation.") === false,
     "and the same holds in English");

  /* The failure that would hide the worst clause in a contract. */
  ok(await oneSided(HEAD + "البند الثالث: لأي من الطرفين إنهاء العقد بإشعار ثلاثين يوماً.\nالبند التاسع: ومع ذلك يحق للطرف الأول إنهاء العقد في أي وقت دون إشعار ودون سبب.") === true,
     "a mutual clause elsewhere in the document does NOT excuse a one-sided one — the guard is bounded to its own clause");

  /* ---- 4d. the Arabic reader must not get the weaker analysis */
  console.log("\n— the Arabic reader gets the same analysis as the English one");
  const nc = await p.evaluate((t) => {
    nat = "sa";
    const r = analyzePasted(t);
    return r ? r.clauses.some(c => /منافس/.test((c.t && c.t.ar) || "")) : false;
  }, HEAD + "البند التاسع: يلتزم الطرف الثاني بعدم العمل لدى أي جهة منافسة داخل المملكة لمدة سنتين بعد انتهاء العقد.");
  ok(nc === true,
     "a non-compete written the way contracts write it is caught, not only the term of art عدم المنافسة");

  const tracks = await p.evaluate((t) => {
    const names = (n) => { nat = n; const r = analyzePasted(t); return r ? r.clauses.length : 0; };
    return { sa: names("sa"), nonsa: names("nonsa") };
  }, FORMAL);
  ok(tracks.nonsa >= tracks.sa,
     `a resident is never shown FEWER findings than a Saudi on the same contract (${tracks.nonsa} vs ${tracks.sa})`);

  /* ---- 4e. the reader is shown the sentence we acted on
   *
   * Wodouh's proposition is "never take our word for it", and the result
   * screen was the one place a reader could not check: every flag on a pasted
   * contract showed a generic paragraph, and the matched text appeared only
   * for the built-in samples. That is also how a red flag came to fire on a
   * clause that said the opposite of what it claimed — shown the sentence, a
   * reader would have said "but it says either party".
   *
   * The quote is EVIDENCE, so three things have to hold: it must come from
   * their document verbatim, it must be marked as theirs rather than ours, and
   * it must be text — a contract is a file someone else wrote.
   */
  console.log("\n— every flag quotes the sentence it fired on");
  const HEAD_Q = "عقد عمل\nأبرم هذا العقد بين شركة الأفق ويشار إليها بالطرف الأول، وبين أحمد ويشار إليه بالطرف الثاني.\n";
  const quoted = await p.evaluate(async (txt) => {
    if (document.documentElement.lang !== "ar") toggleLang();
    nat = "sa"; show("home");
    document.getElementById("pasteBox").value = txt;
    pasteChanged(); analyze("pasted");
    await new Promise(r => setTimeout(r, 2800));
    const host = document.getElementById("flags");
    return {
      flags: host.querySelectorAll(".flag").length,
      quotes: [...host.querySelectorAll(".quote")].map(q => q.textContent.trim()),
      own: host.querySelectorAll('.quote[data-own]').length,
      labelled: [...host.querySelectorAll('.quote[data-own]')].every(q => !!q.dataset.label),
    };
  }, HEAD_Q + "البند التاسع: يلتزم الطرف الثاني بعدم العمل لدى أي جهة منافسة داخل المملكة لمدة سنتين.\nالبند الثالث: الراتب الشهري عشرة آلاف ريال سعودي.");

  ok(quoted.quotes.length === quoted.flags && quoted.flags > 0,
     `every flag carries a quote, not just some (${quoted.quotes.length}/${quoted.flags})`);
  ok(quoted.quotes.some(q => /جهة منافسة داخل المملكة/.test(q)),
     "and the quote is the reader's OWN sentence, verbatim from their contract");
  ok(quoted.quotes.every(q => !/^«?\s*(?:ال)?بند\s/.test(q)),
     `with the clause label stripped — "البند التاسع:" is scaffolding, not a term (${quoted.quotes[0].slice(0, 34)}…)`);
  ok(quoted.own === quoted.flags && quoted.labelled,
     "marked as theirs and labelled, so it reads as evidence rather than our paraphrase");

  /* An authored sample quote is bilingual and must still render — the two
     shapes share one code path and a regression would silently blank one. */
  const authored = await p.evaluate(async () => {
    nat = "sa"; analyze("employment");
    await new Promise(r => setTimeout(r, 2800));
    const host = document.getElementById("flags");
    return { quotes: host.querySelectorAll(".quote").length,
             own: host.querySelectorAll('.quote[data-own]').length };
  });
  ok(authored.quotes > 0, `a built-in sample still shows its authored quotes (${authored.quotes})`);
  ok(authored.own === 0, "and they are NOT marked as the reader's own, because they are not");

  /* A contract is a document a third party wrote. It does not get innerHTML. */
  const evil = await p.evaluate(async (txt) => {
    nat = "sa"; show("home");
    document.getElementById("pasteBox").value = txt;
    pasteChanged(); analyze("pasted");
    await new Promise(r => setTimeout(r, 2800));
    const host = document.getElementById("flags");
    return { executed: !!window.__pwned,
             nodes: host.querySelectorAll("img,script,iframe,svg[onload]").length,
             /* An angle bracket surviving as a CHARACTER is the proof it was
                escaped — had it been parsed as markup there would be a node
                instead. Only one bracket is asserted: the quote is bounded to
                its own sentence, so which side of the tag survives depends on
                where the boundary fell, and pinning both would be pinning the
                fixture rather than the property. */
             asText: host.textContent.includes(">") || host.textContent.includes("<") };
    /* NO FULL STOP INSIDE THE TAG. The first version of this fixture used
       onerror="window.__pwned=1" — and the quote boundary split at the dot in
       "window.__pwned", stripping the opening "<" so no tag could ever form.
       The assertions passed with escaping REMOVED, which makes them decoration.
       Verified by deleting esc() and watching this fail. */
  }, HEAD_Q + 'البند الثالث: <img src=q onerror="__pwned=1"> الراتب الشهري عشرة آلاف ريال سعودي.');
  ok(evil.executed === false, "markup inside a contract does not execute");
  ok(evil.nodes === 0, "and injects no nodes");
  ok(evil.asText === true, "it renders as the text it is");

  /* A full stop between digits is a decimal point, not a sentence end. */
  const decimal = await p.evaluate((txt) => {
    nat = "sa";
    const r = analyzePasted(txt);
    return r ? r.clauses.map(c => c.q).filter(Boolean) : [];
  }, HEAD_Q + "البند الثالث: الراتب الشهري 10.500 ريال سعودي شاملاً البدلات.");
  ok(decimal.some(q => /10\.500/.test(q)),
     `a decimal figure is not cut in half by the quote boundary (${decimal[0] || "no quote"})`);

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

  /* A genuine contract — it clears the structural gate — of which we recognise
     almost nothing. That is the case the coverage caution exists for. */
  const thin = await shown(`اتفاقية
يعمل الطرف الثاني بوظيفة محاسب لدى الطرف الأول.
الراتب الشهري ثمانية آلاف ريال.`);
  ok(thin.screen === "screen-result" && thin.level === "low",
     `a contract we barely recognised is marked low coverage (${thin.level})`);
  ok(thin.score >= 80,
     `and it still scores high (${thin.score}) — which is exactly why the caveat has to carry weight`);
  ok(thin.marked === true && thin.icon === true,
     "so at low coverage the line is a marked caution, not a footnote");
  ok(/محسوبة على ما تعرّفنا عليه وحده|covers those alone/.test(thin.text),
     "and it says what the number MEANS: the score covers the recognised clauses alone");
  /* Arabic inflects a counted noun by its count AND by its case. Every use
     site reads "تعرّفنا على {n}", so the noun is majrūr — "على بندًا واحدًا"
     was wrong, in the most-read sentence on the screen. */
  const forms = await p.evaluate(() =>
    [1, 2, 5, 15].map(n => countNoun("dc_cl", n)));
  ok(/بندٍ واحدٍ/.test(forms[0]), `one is genitive singular (${forms[0]})`);
  ok(/بندين/.test(forms[1]), `two is the dual, not "٢ بنود" (${forms[1]})`);
  ok(/بنود/.test(forms[2]) && /بندًا/.test(forms[3]),
     `and 3-10 takes the plural while 11+ takes the singular accusative (${forms[2]} / ${forms[3]})`);
  ok(!/هذي/.test(thin.text),
     "and the sentence stays in Modern Standard Arabic — no colloquial هذي mid-sentence");

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
