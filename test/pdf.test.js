/* Reading the contract.
 *
 * A real Saudi employment contract, exported from Word, was uploaded to the
 * live site and came back as "ما قدرنا نقرأ هذا النص". The refusal was
 * correct — the extractor had produced glyph soup and legible() caught it,
 * which is the only reason nobody was shown a score for a document the app
 * had not actually read. But the file was perfectly readable. We just could
 * not read it.
 *
 * The cause: Word writes Arabic with a subset font in Identity-H encoding.
 * The bytes inside a text operator are two-byte indices into that one font's
 * private glyph table, written as hex — <0648 0636> — and the old regex only
 * matched literal (…) strings, so most Arabic text was skipped outright and
 * what survived was decoded one byte at a time into nonsense. Latin text from
 * the same exporter uses literal strings and worked fine, which is exactly why
 * this went unnoticed.
 *
 * So this suite pins the properties that failure had:
 *
 *   1. An Identity-H Arabic PDF comes back as Arabic, through its /ToUnicode
 *      CMap — the map the file already carries, which is what lets a desktop
 *      reader copy the same text out.
 *   2. Two fonts on one page are each decoded through THEIR OWN map. A single
 *      global map passes a one-font test and silently corrupts real documents.
 *   3. Latin PDFs still work. The fix must not trade one encoding for another.
 *   4. A file we genuinely cannot decode is still refused. Emitting soup is a
 *      worse outcome than admitting defeat, and that has not changed.
 *   5. A scan is told apart from a font failure, because they need different
 *      answers: one is "paste the text instead", the other is "re-export and
 *      try again". Giving the scan reader the retry advice sends them round a
 *      loop that cannot terminate.
 *
 * Fixtures are built byte by byte in test/fixtures/make-pdf.mjs rather than
 * committed as binaries — same no-dependency bargain the app itself keeps.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* Long enough to clear legible()'s 40-character floor, and real contract
   wording rather than filler so a partial decode is visible as a partial
   sentence rather than as a length. */
const AR = "هذا عقد عمل بين صاحب العمل والعامل. الأجر الشهري عشرة آلاف ريال وفترة التجربة تسعون يومًا من تاريخ المباشرة.";
const EN = "This employment contract is between the employer and the worker. The monthly wage is 10000 SAR and probation is ninety days.";
const AR_A = "الأجر الشهري عشرة آلاف ريال سعودي يدفع في نهاية كل شهر ميلادي.";
const AR_B = "مدة الإشعار ستون يومًا قبل إنهاء العقد من أي من الطرفين.";

(async () => {
  const mk = await import("./fixtures/make-pdf.mjs");
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.extractPdf === "function");

  /* The fixture is generated in Node and handed to the page as a plain array,
     because a Uint8Array does not survive the structured clone into evaluate
     as one. The page rebuilds it and calls the SHIPPED extractPdf — no test
     copy of the logic exists anywhere. */
  const run = (buf) => p.evaluate(async (arr) => {
    const u8 = new Uint8Array(arr);
    const got = await extractPdf(u8.buffer);
    return { text: got.text, ops: got.ops, legible: legible(got.text) };
  }, Array.from(buf));

  /* ---- 1. the file from the screenshot */
  console.log("\n— an Arabic PDF exported from Word reads as Arabic");
  const ar = await run(mk.identityH(AR));
  ok(ar.text.includes("عقد عمل"),
     `the Identity-H document decodes through its ToUnicode map ("${ar.text.slice(0, 28)}…")`);
  ok(ar.text.includes("فترة التجربة") && ar.text.includes("عشرة آلاف ريال"),
     "including the clauses that decide the score — probation and the wage");
  ok(ar.legible === true, "and it now passes the legibility check that used to reject it");
  ok(ar.ops > 0, `with the text operators counted (${ar.ops})`);

  /* Every Arabic letter that went in comes back. A partial CMap that decodes
     most of a sentence still passes a substring check, so count instead. */
  const missing = [...new Set(AR.replace(/[^؀-ۿ]/g, ""))]
    .filter(ch => !ar.text.includes(ch));
  ok(missing.length === 0,
     `every distinct Arabic character survives the round trip${missing.length ? " — lost: " + missing.join(" ") : ""}`);

  /* ---- 2. per-font maps */
  console.log("\n— each font on the page is decoded through its own map");
  const two = await run(mk.twoFonts(AR_A, AR_B));
  ok(two.text.includes("الأجر الشهري"), "the first font's run decodes");
  ok(two.text.includes("مدة الإشعار"), "and so does the second, which uses different glyph ids for the same letters");
  ok(two.text.indexOf("الأجر") < two.text.indexOf("مدة الإشعار"),
     "in the order they appear in the document, not merged or reordered");

  /* ---- 3. no regression on what already worked */
  console.log("\n— the Latin path that already worked still works");
  const en = await run(mk.winAnsi(EN));
  ok(en.text.includes("employment contract") && en.text.includes("ninety days"),
     "literal strings and the TJ array form both still decode");
  ok(en.legible === true, "and the result is legible");

  /* ---- 4. defeat is still admitted */
  console.log("\n— a document we cannot decode is still refused, not guessed at");
  const soup = await run(mk.identityHNoMap(AR));
  ok(soup.legible === false,
     "glyph indices with no ToUnicode map do not pass as text — the honesty check is intact");
  ok(soup.ops > 0,
     `and the text operators are still counted (${soup.ops}), which is what separates this from a scan`);

  /* ---- 5. a scan is a different problem and gets a different answer */
  console.log("\n— a scan is told apart from a font failure");
  const scan = await run(mk.scanned());
  ok(scan.ops === 0, "a page whose only content is an image yields zero text operators");
  ok(scan.legible === false, "so there is nothing to analyse");

  /* The distinction has to reach the reader, not just the log. */
  const msgs = await p.evaluate(() => {
    const out = {};
    for (const r of ["scan", "glyphs"]) {
      noreadReason = r;
      renderNoread();
      out[r] = {
        title: document.getElementById("nrTitle").textContent,
        body: document.getElementById("nrBody").textContent,
        tips: document.getElementById("nrTips").textContent
      };
    }
    return out;
  });
  ok(msgs.scan.title !== msgs.glyphs.title,
     "the two failures show different headlines");
  ok(/صورة|image|scan/i.test(msgs.scan.title + msgs.scan.body),
     "the scan reader is told the file is an image");
  ok(/الصق|paste/i.test(msgs.scan.tips),
     "and is pointed at pasting the text, which is the only thing that can work");
  ok(!/طباعة|Save as PDF/i.test(msgs.scan.tips),
     "and is NOT told to re-export — for a scan that is a loop with no exit");
  ok(/Save as PDF|طباعة/i.test(msgs.glyphs.tips),
     "while the font failure IS told to re-export, which genuinely fixes it");

  /* Both messages exist in both languages. A reader who hits this in Arabic
     and gets an English string has hit a second bug on top of the first. */
  const bothLangs = await p.evaluate(() => {
    const seen = {};
    for (const want of ["ar", "en"]) {
      if ((document.documentElement.lang === "ar") !== (want === "ar")) toggleLang();
      seen[want] = ["nrs_title", "nrs_body", "nr_title"].map(k => t(k))
        .concat(T.nrs_tips[want], T.nr_tips[want]);
    }
    return seen;
  });
  ok(bothLangs.ar.every(x => x && x.trim()) && bothLangs.en.every(x => x && x.trim()),
     "every read-failure string is present in both Arabic and English");

  /* ---- 6. malformed input must not hang the tab */
  console.log("\n— a malformed or hostile PDF fails quietly instead of hanging");
  const junk = await p.evaluate(async () => {
    const t0 = Date.now();
    const cases = [
      new Uint8Array(0),
      new TextEncoder().encode("%PDF-1.7\nnot really a pdf at all"),
      /* A bfrange claiming four billion entries. Unbounded expansion here
         would freeze the phone of anyone who opened the file. */
      new TextEncoder().encode(
        "%PDF-1.7\n1 0 obj\n<< /Type /Font /ToUnicode 2 0 R >>\nendobj\n" +
        "2 0 obj\n<< /Length 60 >>\nstream\nbeginbfrange\n<0000> <FFFFFFFF> <0041>\nendbfrange\nendstream\nendobj\n")
    ];
    const out = [];
    for (const c of cases) {
      try { out.push((await extractPdf(c.buffer)).text.length); }
      catch (e) { out.push("threw: " + e.message); }
    }
    return { out, ms: Date.now() - t0 };
  });
  ok(junk.out.every(x => x === 0 || typeof x === "number"),
     `empty, non-PDF and malformed input all return without throwing (${JSON.stringify(junk.out)})`);
  ok(junk.ms < 5000, `and finish promptly (${junk.ms}ms) — the CMap expansion is capped`);

  /* ---- WHAT THE READER IS TOLD WHILE THIS IS HAPPENING.
   *
   * Everything above proves the extraction is correct. None of it says the
   * reader knows it is running — and for the whole of extractPdf(), which is
   * the slow and variable step, they were shown a dimmed icon, a pulse, and a
   * label still reading "Upload contract file": an invitation to do the thing
   * they had just done. Nothing named the file, so nothing confirmed the app
   * had taken the one they meant, and that matters most for a DROP, since the
   * drop handler is bound to the whole app and fires on screens where the
   * upload box is not visible at all.
   *
   * A screen-reader user had it worse than nothing: the error path has had a
   * live region since the beginning and the success path had none, so they
   * were told when it went wrong and heard silence when it went right.
   *
   * ASSERTED ACROSS THE WHOLE OPERATION, not at the end. handleFile is awaited
   * here so the state DURING extraction can be sampled — checking after it
   * resolves would pass against a build that says nothing until it is over,
   * which is exactly the build this replaces.
   */
  console.log("\n— and the reader is told which file, while it is being read");
  for (const L of ["ar", "en"]) {
    const feedback = await p.evaluate(async ([arr, l]) => {
      if ((document.documentElement.lang === "ar") !== (l === "ar")) toggleLang();
      nat = "sa"; obDone = true; authUser = { id: "t" };
      goTab("home"); pickSituation("contract");
      const idle = document.getElementById("upCta").textContent;
      const file = new File([new Uint8Array(arr)], "employment-contract-final-v3.pdf",
                            { type: "application/pdf" });
      const p2 = handleFile(file);
      /* One frame in: extraction is running and has not resolved. */
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const during = {
        cta: document.getElementById("upCta").textContent,
        busy: document.getElementById("upMain").classList.contains("busy"),
        said: document.getElementById("offlineNotice").textContent,
        saidShown: !document.getElementById("offlineNotice").hidden,
      };
      await p2;
      await new Promise((r) => setTimeout(r, 60));
      const toasts = [...document.querySelectorAll(".toast")].map((x) => x.textContent.trim());
      return { idle, during, toasts, after: document.getElementById("upCta").textContent };
    }, [Array.from(mk.identityH(AR)), L]);

    ok(feedback.during.busy, `${L}: the row is marked busy while the file is read`);
    ok(feedback.during.cta !== feedback.idle,
       `${L}: and the label stops inviting an upload that already happened ("${feedback.during.cta}")`);
    ok(/employment-contract|v3\.pdf/.test(feedback.during.cta),
       `${L}: it names the file, so the reader knows which one was taken ("${feedback.during.cta}")`);
    /* U+2068/U+2069. A Latin filename in an Arabic sentence renders split and
       reordered without them — measured: «نقرأ contract-v3.pdf» came out as
       "ontract-final-signed-… نقرأ" over two lines, showing the reader a name
       that was not the one they picked, at the moment it is being confirmed. */
    ok(/\u2068[^\u2069]*\u2069/.test(feedback.during.cta),
       `${L}: with the name bidi-isolated, so it survives an Arabic sentence intact`);
    ok(feedback.during.saidShown && /employment-contract|v3\.pdf/.test(feedback.during.said),
       `${L}: and it is announced, not only drawn (${feedback.during.saidShown ? "live" : "silent"})`);
    ok(feedback.after === feedback.idle,
       `${L}: the label goes back to the invitation afterwards ("${feedback.after}")`);
    ok(feedback.toasts.length === 1,
       `${L}: exactly one toast confirms the read, never a stack (${feedback.toasts.length})`);
    ok(/employment-contract|v3\.pdf/.test(feedback.toasts[0] || ""),
       `${L}: and it says what was read ("${feedback.toasts[0] || "none"}")`);
  }

  /* AND NOT ON THE PATH THAT FAILED. A tick reading "Read contract.pdf" on the
     way to "we could not read this" is the app contradicting itself inside one
     second, which costs more trust than the confirmation buys. */
  const onFail = await p.evaluate(async (arr) => {
    nat = "sa"; obDone = true; authUser = { id: "t" };
    goTab("home"); pickSituation("contract");
    document.querySelectorAll(".toast").forEach((x) => x.remove());
    await handleFile(new File([new Uint8Array(arr)], "scan.pdf", { type: "application/pdf" }));
    await new Promise((r) => setTimeout(r, 60));
    return { toasts: document.querySelectorAll(".toast").length,
             screen: (document.querySelector(".screen.active") || {}).id };
  }, Array.from(mk.scanned()));
  ok(onFail.screen === "screen-loading" || onFail.screen === "screen-noread",
     `an unreadable file still routes to the honest answer (${onFail.screen})`);
  ok(onFail.toasts === 0,
     `and nothing claims to have read it (${onFail.toasts} toasts)`);

  await b.close();
  console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\nArabic PDFs read, and what we cannot read we still refuse");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
