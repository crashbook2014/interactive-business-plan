/* Termination assessment — the flow as a person actually walks it.
 *
 * termination.test.js drives the state directly; this one clicks. It exists
 * because the two can disagree: a computation can be right while the screen
 * that reaches it is unreachable, mis-sized on a phone, or silently English
 * in an Arabic session.
 *
 * Run with `npm test`, which starts the server for you. Set WODOUH_URL
 * to point the same assertions at the deployed site.
 */
const { playwright, launchOpts, BASE, APP, signInStub, paywallOn } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");
  await p.evaluate(signInStub);
  await p.evaluate(paywallOn);

  /* Clear onboarding and pick a track the way a first-time reader would. */
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload();
  await p.waitForFunction(() => typeof window.show === "function");
  await p.evaluate(signInStub);
  await p.evaluate(paywallOn);
  /* The app opens in Arabic. These assertions read English strings, so switch
     first and come back to Arabic at the end — the RTL pass is the point. */
  await p.evaluate(() => { nat = "sa"; obDone = true; lang = "en"; applyLang(); show("home"); });

  console.log("— entry from the home screen");
  /* The door on the chooser, not a card further down the same screen. Home
     used to carry both: a sit-card for "I've been terminated" and an
     assist-entry to the identical destination about a hundred lines below it,
     under a different name. One destination, one door. */
  const card = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("#screen-home .sit-card")];
    const el = btns.find(x => x.getAttribute("onclick") === "pickSituation('term')");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const txt = el.textContent.trim();
    el.click();
    return { h: r.height, txt, screen: document.querySelector(".screen.active").id };
  });
  ok(card, "the home card exists");
  ok(card && card.h >= 44, `home card meets the 44px touch minimum (${card && Math.round(card.h)}px)`);
  ok(card && card.screen === "screen-term", "tapping it opens the termination flow");
  ok(card && /terminated/i.test(card.txt), "the card says what it is");

  console.log("\n— the seven options are all reachable and tappable");
  const opts = await p.evaluate(() => {
    const bs = [...document.querySelectorAll("#termHow button")];
    return { n: bs.length, small: bs.filter(x => x.getBoundingClientRect().height < 44).length,
             labels: bs.map(x => x.textContent.trim()) };
  });
  ok(opts.n === 7, `seven options rendered (${opts.n})`);
  ok(opts.small === 0, `every option meets 44px (${opts.small} too small)`);
  ok(new Set(opts.labels).size === 7, "all seven labels are distinct");

  console.log("\n— clicking through the questions");
  await p.evaluate(() => document.querySelectorAll("#termHow button")[0].click());
  ok(await p.evaluate(() => document.querySelector(".screen.active").id === "screen-termq"),
     "choosing an option advances to the questions");

  const step = async (vals) => p.evaluate(v => {
    for (const [id, val] of Object.entries(v)){
      const el = document.getElementById(id);
      if (!el) continue;
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    document.getElementById("tqNext").click();
    return document.querySelector(".screen.active").id;
  }, vals);

  await step({ tmStart:"2018-01-01", tmEnd:"2026-01-31", tmWage:"12000" });
  ok(await p.evaluate(() => document.getElementById("tqTitle").textContent.length > 0),
     "step 2 renders");
  await step({ tmNoticeDue:"60", tmNoticeGiven:"10" });
  const afterLast = await step({ tmUnpaid:"2", tmLeave:"14", tmOther:"3000" });
  ok(afterLast === "screen-termev", "the last step lands on the evidence screen");

  const captured = await p.evaluate(() => ({ ...term }));
  ok(captured.wage === 12000 && captured.noticeDue === 60 && captured.leaveDays === 14,
     "typed answers were captured");

  console.log("\n— evidence, then the paywall, then the result");
  const ev = await p.evaluate(() => {
    const docs = [...document.querySelectorAll("[data-tdoc]")];
    docs.slice(0, 3).forEach(d => d.click());
    return { n: docs.length, ticked: term.docs.length,
             strength: document.querySelector("#termEvOut .tm-tag").textContent.trim(),
             honest: document.querySelector(".ev-honest").textContent };
  });
  ok(ev.n === 10, `ten document types offered (${ev.n})`);
  ok(ev.ticked === 3, "ticking three records three");
  ok(/doesn't read|does not read/i.test(ev.honest),
     "the screen says plainly that Wodouh does not read the files");

  const gate = await p.evaluate(() => {
    document.querySelector('#screen-termev .primary').click();
    return document.querySelector(".screen.active").id;
  });
  ok(gate === "screen-paywall", "the assessment is gated");

  const paid = await p.evaluate(() => {
    /* The full tier, because this walk goes on to open the case file and the
       letter. The cheaper tier deliberately does not include them — that
       separation is exercised in commerce.test.js. */
    document.querySelectorAll("#plans .plan")[1].click();
    document.getElementById("payBtn").click();
    return new Promise(r => setTimeout(() => r(document.querySelector(".screen.active").id), 1200));
  });
  ok(paid === "screen-termres", "paying lands on the assessment");

  const res = await p.evaluate(() => ({
    secs: document.querySelectorAll("#termSections .tm-sec").length,
    /* The totals used to be one row, so "lines - 1" counted the money rows.
       Contested money is now its own labelled figure, so the money rows are
       asked for directly rather than inferred from a count that assumed one
       total. */
    lines: document.querySelectorAll("#termMoney .r:not(.tot)").length,
    srcs: document.querySelectorAll("#termMoney .src-line").length,
    claims: document.querySelectorAll(".tm-claim").length,
    hows: document.querySelectorAll(".tm-how details").length,
    /* The totals live in the hero card now — the one figure this screen
       exists to give, at the size of an answer rather than of a table row. */
    total: (document.querySelector("#termMoney .tm-hero") || { textContent: "" }).textContent,
    heroPx: (() => { const a = document.querySelector("#termMoney .tm-hero .amt");
                     return a ? parseFloat(getComputedStyle(a).fontSize) : 0; })(),
    rowPx: (() => { const r = document.querySelector("#termMoney .r > b");
                    return r ? parseFloat(getComputedStyle(r).fontSize) : 0; })(),
    text: document.getElementById("screen-termres").textContent
  }));
  ok(res.secs >= 6, `assessment renders ${res.secs} sections`);
  ok(res.srcs === res.lines, `every money line has a source line (${res.srcs} for ${res.lines} lines)`);
  ok(res.claims >= 1, `${res.claims} per-claim breakdowns`);
  ok(res.hows === 5, `five "how we got here" factors (${res.hows})`);
  /* Either shape is correct, and which one appears depends on whether this
     case carries contested money — but a bare unlabelled figure is not. */
  ok(/Estimated potential entitlement/i.test(res.total) ||
     (/Owed on the face of it/i.test(res.total) && /Depends on a ruling/i.test(res.total)),
     `the totals are labelled, and contested money is separated when there is any (${res.total.trim().slice(0,80)})`);
  /* The screen answers one question, and set the answer in the same 15px as
     every other row on it. A hierarchy is not a hierarchy if the reader has
     to hunt for the figure they came for. */
  ok(res.heroPx >= res.rowPx * 2,
     `the figure the reader came for is allowed to be big (${res.heroPx}px against ${res.rowPx}px rows)`);
  ok(/not a final determination/i.test(res.text), "the screen says it is not a final determination");

  console.log("\n— next steps, case file and letter");
  const next = await p.evaluate(() => {
    document.querySelector("#screen-termres .primary").click();
    return { screen: document.querySelector(".screen.active").id,
             steps: document.querySelectorAll(".tm-step").length,
             text: document.getElementById("screen-termnext").textContent };
  });
  ok(next.screen === "screen-termnext" && next.steps === 5, `five next steps (${next.steps})`);
  ok(/does not file/i.test(next.text), "it states plainly that Wodouh files nothing for you");

  const docScreen = await p.evaluate(() => {
    [...document.querySelectorAll("#termSteps button")].find(b => b.dataset.step === "3").click();
    return { screen: document.querySelector(".screen.active").id,
             body: document.getElementById("termDocBody").textContent };
  });
  ok(docScreen.screen === "screen-termdoc", "the case file opens");
  ok(docScreen.body.split("\n").length > 20, "the case file has real content");
  ok(!/undefined|NaN/.test(docScreen.body), "no undefined or NaN in the case file");

  const tones = await p.evaluate(() => {
    show("termnext");
    [...document.querySelectorAll("#termSteps button")].find(b => b.dataset.step === "2").click();
    const out = {};
    [...document.querySelectorAll("#termTone button")].forEach(btn => {
      btn.click();
      out[btn.textContent.trim()] = document.getElementById("termLtrBody").textContent;
    });
    return out;
  });
  const toneNames = Object.keys(tones);
  ok(toneNames.length === 4, `four tones (${toneNames.join(", ")})`);
  ok(new Set(Object.values(tones)).size === 4, "each tone produces a different letter");
  const amounts = Object.values(tones).map(v => (v.match(/[\d,]{4,}/g) || []).sort().join("|"));
  ok(new Set(amounts).size === 1, "the amounts are identical across all four tones");
  const threat = /\b(sue|court action|legal action against|report you|we will take)\b/i;
  ok(!Object.values(tones).some(v => threat.test(v)), "no tone contains a threat");

  /* ---------------------------------------------------------------------
   * NOTHING THIS LETTER SAYS MAY COST THE READER A CLAIM.
   *
   * This is the only assertion block in the suite where a failure is legal
   * harm rather than a defect. The letter is addressed to the opposing party,
   * so every sentence in it is a sentence the reader's employer gets to quote
   * back at them — and the reader did not write any of it. We did.
   *
   * The bug being guarded shipped. The letter separated the amounts that
   * follow from stated facts from the one that turns on a ruling nobody has
   * made — correct, and worth keeping — but it described the second as noted
   * "not as part of this request" / "لا للمطالبة به في هذه المرحلة". In the
   * walked example that was 44,993 SAR of Article 77 compensation, against
   * 59,986 of end-of-service: the largest contingent sum in the case, and the
   * app put in writing, over the reader's name, that they were not asking for
   * it. There was also no reservation of rights anywhere in the letter, which
   * is what turned a clumsy sentence into a dangerous one.
   *
   * So: the contingent item stays separated, but recorded as reserved, and
   * every letter in every tone carries the reservation.
   */
  console.log("\n— the letter concedes nothing");
  const legal = await p.evaluate(() => {
    show("termnext");
    [...document.querySelectorAll("#termSteps button")].find(b => b.dataset.step === "2").click();
    const out = { letters: [] };
    [...document.querySelectorAll("#termTone button")].forEach(btn => {
      btn.click();
      out.letters.push({ tone: btn.textContent.trim(),
                         body: document.getElementById("termLtrBody").textContent,
                         certain: termTotalCertain(), contested: termTotalContested() });
    });
    show("termnext");
    [...document.querySelectorAll("#termSteps button")].find(b => b.dataset.step === "3").click();
    out.doc = document.getElementById("termDocBody").textContent;
    /* Back to the letter: the language check below starts from this screen,
       and leaving the app on the case file made it fail for the wrong reason. */
    show("termnext");
    [...document.querySelectorAll("#termSteps button")].find(b => b.dataset.step === "2").click();
    return out;
  });
  /* Any sentence that reads as declining to claim, in either language. */
  const RESERVE = [/rights are reserved|not a waiver/i, /حفظ كافة حقوقي|لا يُعدّ تنازلًا/];
  /* WHAT IS ACTUALLY DANGEROUS IS THE CLAIMANT DECLINING — not the word
     "waive". Two earlier versions of this list matched the word itself and
     both flagged protective sentences: the reservation clause ("this letter
     is not a waiver of any right") and, better still, the line telling the
     reader that leave pay "can't be waived by agreement" — which is the app
     defending a right, scored as if it were surrendering one.
     So these patterns require the reader to be the one giving something up. */
  const WAIVER = [
    /not as part of this request/i,
    /\bI (?:do not|don't|am not|will not|won't)\s+(?:claim|seek|pursue)/i,
    /\bI (?:hereby )?waive\b/i,
    /waiving (?:my|any) (?:right|claim)/i,
    /لا للمطالبة/,
    /لا أطالب/,
    /أتنازل/
  ];
  ok(legal.letters.length === 4, `all four tones checked (${legal.letters.length})`);
  for (const { tone, body } of legal.letters) {
    const bad = WAIVER.filter((re) => re.test(body));
    ok(bad.length === 0,
       `${tone}: nothing in the letter declines a claim (${bad.join(", ") || "clean"})`);
    ok(RESERVE.some((re) => re.test(body)),
       `${tone}: and it reserves the reader's rights explicitly`);
  }
  /* ---- and what the letter must SAY, not merely avoid saying.
     A letter reached by pressing "claim your rights" that asks them to review
     some figures is an enquiry wearing a demand's clothes. These four things
     are what make it the second: a date, a named sum, a deadline, and enough
     identity for the recipient to file it and not to claim they never got
     anything specific. */
  console.log("\n— the letter is a demand, not an enquiry");
  const YEAR = String(new Date().getFullYear());
  const DEADLINE = /fifteen days|خمسة عشر يومًا/;
  for (const { tone, body, certain, contested } of legal.letters) {
    /* Its OWN date line, not just the year appearing somewhere. The first
       version of this checked body.includes(year) and passed happily with the
       date line deleted, because the employment end date carries the same
       year — a guard that cannot fail is not a guard. */
    const dateLine = body.split("\n").find((l) => /^\s*(Date|التاريخ)\s*:/.test(l)) || "";
    ok(dateLine.includes(YEAR),
       `${tone}: the letter carries its own date line (${dateLine.trim() || "ABSENT"})`);
    /* The date matters because the app itself tells this reader, two screens
       earlier, that a claim is generally not heard after twelve months. */
    ok(DEADLINE.test(body), `${tone}: and sets a response deadline`);
    const demand = body.split("\n").find((l) => /request payment|أطلب صرف/.test(l)) || "";
    ok(!!demand, `${tone}: and names a sum it is asking for`);
    /* The sum demanded is the one that follows from stated facts. Demanding
       the contingent figure as though it were owed would be the mirror of the
       concession this letter used to make. */
    /* Not "carries a figure" — carries the RIGHT figure. The demand must be
       the certain total, so a refactor that reached for termTotal() and swept
       the contingent item in with it fails here rather than in a letter
       somebody has already sent. */
    const asked = Number((demand.match(/[\d,]{4,}/) || ["0"])[0].replace(/,/g, ""));
    ok(asked === Math.round(certain),
       `${tone}: demands the certain total, not the contingent one (asked ${asked}, certain ${Math.round(certain)})`);
    if (contested > 0) {
      ok(asked !== Math.round(certain + contested),
         `${tone}: and never the two summed (${Math.round(certain + contested)})`);
    }
    for (const ph of [/\[Company name\]|\[اسم الشركة\]/, /\[Your name\]|\[اسمك\]/,
                      /Employee number|الرقم الوظيفي/, /email address|بريدك/]) {
      ok(ph.test(body), `${tone}: carries ${ph.source.slice(0, 28)}`);
    }
  }

  /* Instructions to the sender must not travel to the recipient, so they live
     on the screen and must NOT appear in the copied text. */
  console.log("\n— the reader is told what to do with it");
  const send = await p.evaluate(() => ({
    items: [...document.querySelectorAll("#ltrSend li")].map((l) => l.textContent.trim()),
    inLetter: /proof of sending|إثبات الإرسال/.test(document.getElementById("termLtrBody").textContent)
  }));
  ok(send.items.length >= 4, `the send guidance renders (${send.items.length} points)`);
  ok(send.items.every((x) => x.length > 10), "and none of it is blank");
  ok(send.inLetter === false, "and none of it leaks into the letter the employer receives");

  /* The case file goes to the employer and to the friendly-settlement filing,
     so it is held to the same rule as the letter. */
  const docBad = WAIVER.filter((re) => re.test(legal.doc));
  const docLine = legal.doc.split("\n").find((l) => WAIVER.some((re) => re.test(l))) || "";
  ok(docBad.length === 0,
     `the case file declines nothing either (${docBad.join(", ")} :: ${docLine.slice(0, 120)})`);
  ok(RESERVE.some((re) => re.test(legal.doc)), "and the case file reserves rights too");

  console.log("\n— Arabic, RTL");
  const ar = await p.evaluate(() => {
    lang = "en"; toggleLang();   /* -> ar */
    return { dir: document.documentElement.dir, lang: document.documentElement.lang,
             ltr: document.getElementById("termLtrBody").textContent,
             screen: document.querySelector(".screen.active").id };
  });
  ok(ar.dir === "rtl" && ar.lang === "ar", "Arabic switches the document to RTL");
  ok(!/undefined|NaN/.test(ar.ltr), "the Arabic letter has no undefined or NaN");
  ok(/[؀-ۿ]/.test(ar.ltr), "the Arabic letter is actually in Arabic");
  ok(ar.screen === "screen-termltr", "switching language does not navigate away");

  console.log("\n" + (FAIL.length ? `${FAIL.length} FAILURES\n` + FAIL.map(f => "  - " + f).join("\n")
                                  : "all UI checks passed"));
  await b.close();
  process.exit(FAIL.length ? 1 : 0);
})();
