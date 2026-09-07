/* The demand letters for disputes that are not employment ones.
 *
 * A tenant whose deposit is being held and a freelancer who delivered and was
 * not paid used to be offered exactly one instrument: the negotiation letter,
 * which closes with "I'm confident we can reach wording that is fair to both
 * sides". That is the right letter to send before signing something and the
 * wrong one to send to someone who is keeping your money.
 *
 * These letters are held to the same standard as the employer letter, for the
 * same reason — they are addressed to the opposing party, and the reader wrote
 * none of the words in them:
 *
 *   - they concede nothing and reserve rights explicitly
 *   - they are dated, because every one of these disputes has a clock on it
 *   - they make a demand with a deadline, not an enquiry
 *   - they carry enough identity to be filed and answered
 *
 * And one rule of their own, which the employer letter does not need:
 *
 *   - THEY CITE NO STATUTE. The verified register is Saudi Labor Law only, so
 *     there is no source behind an article number for a lease or a freelance
 *     agreement. These letters quote the reader's own contract instead. An
 *     article number appearing here would be invented precision, which is the
 *     one thing this product must never do.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const RESERVE = [/rights are reserved|not a waiver/i, /حفظ كافة حقوقي|لا يُعدّ تنازلًا/];
const WAIVER = [
  /not as part of this request/i,
  /\bI (?:do not|don't|am not|will not|won't)\s+(?:claim|seek|pursue)/i,
  /\bI (?:hereby )?waive\b/i,
  /لا للمطالبة/, /لا أطالب/, /أتنازل/
];
/* Any article citation at all. The register behind them is labour-only. */
const STATUTE = [/Article\s*\d+/i, /المادة\s*[\d٠-٩]/];
const DEADLINE = /fifteen days|خمسة عشر يومًا/;

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  const YEAR = String(new Date().getFullYear());

  for (const lang of ["ar", "en"]) {
    for (const [journey, sample] of [["rent", "rental"], ["gig", "freelance"]]) {
      console.log(`\n— ${lang}/${journey}: the letter a dispute actually needs`);
      const r = await p.evaluate(([j, s, want]) => {
        if ((document.documentElement.lang === "ar") !== (want === "ar")) toggleLang();
        nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
        goTab("home"); pickSituation(j);
        current = SAMPLES[s];
        show("result"); renderResult(true); renderClauses();
        addAllPoints(); renderLetter(); show("letter");
        return {
          body: document.getElementById("letterBody").textContent,
          guidance: [...document.querySelectorAll("#ltrSendD li")].map((l) => l.textContent),
          guidanceShown: !document.getElementById("ltrSendD").hidden
        };
      }, [journey, sample, lang]);

      const bad = WAIVER.filter((re) => re.test(r.body));
      ok(bad.length === 0, `${lang}/${journey}: concedes nothing (${bad.join(", ") || "clean"})`);
      ok(RESERVE.some((re) => re.test(r.body)), `${lang}/${journey}: reserves rights explicitly`);

      const dateLine = r.body.split("\n").find((l) => /^\s*(Date|التاريخ)\s*:/.test(l)) || "";
      ok(dateLine.includes(YEAR), `${lang}/${journey}: carries its own date line (${dateLine.trim() || "ABSENT"})`);
      ok(DEADLINE.test(r.body), `${lang}/${journey}: sets a deadline`);
      ok(/request|أطلب/.test(r.body), `${lang}/${journey}: makes a demand`);

      /* THE RULE OF ITS OWN. */
      const cited = STATUTE.filter((re) => re.test(r.body));
      ok(cited.length === 0,
         `${lang}/${journey}: cites no statute, only the contract (${cited.join(", ") || "none"})`);
      /* And it does quote the contract — otherwise "cites nothing" would pass
         on a letter that references nothing at all. */
      ok(/«|»|"/.test(r.body), `${lang}/${journey}: and does quote the contract's own wording`);

      for (const ph of [/\[.+\]/]) ok(ph.test(r.body), `${lang}/${journey}: has fields for the reader to fill`);
      ok(r.guidanceShown && r.guidance.length >= 3,
         `${lang}/${journey}: sending guidance is on screen (${r.guidance.length})`);
      ok(!/proof of sending|إثبات الإرسال/.test(r.body),
         `${lang}/${journey}: and does not leak into what the other party receives`);
    }
  }

  /* ---- the three rent claims, because the door names all three */
  console.log("\n— a rent demand names the claim the reader actually has");
  const claims = await p.evaluate(() => {
    if (document.documentElement.lang !== "ar") toggleLang();
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    goTab("home"); pickSituation("rent");
    current = SAMPLES.rental; show("result"); renderResult(true); renderClauses();
    addAllPoints(); renderLetter(); show("letter");
    const line = () => document.getElementById("letterBody").textContent
      .split("\n").find((l) => /أطلب/.test(l)) || "";
    const out = {};
    for (const c of RENT_CLAIMS) { setRentClaim(c); out[c] = line(); }
    return out;
  });
  ok(new Set(Object.values(claims)).size === 3,
     "each of the three claims produces a different demand");
  ok(/التأمين/.test(claims.deposit), "the deposit claim asks for the deposit");
  ok(/الإخلاء/.test(claims.eviction), "the eviction claim asks about the notice");
  ok(!/التأمين/.test(claims.eviction),
     "and an eviction letter does not demand a deposit nobody mentioned");

  /* ---- the negotiation letter is untouched for a reader who has not signed */
  console.log("\n— before signing, the letter is still a negotiation");
  const neg = await p.evaluate(() => {
    nat = "sa"; goTab("home"); pickSituation("contract");
    current = SAMPLES.employment; show("result"); renderResult(true); renderClauses();
    addAllPoints(); renderLetter(); show("letter");
    return { body: document.getElementById("letterBody").textContent,
             guidance: !document.getElementById("ltrSendD").hidden };
  });
  ok(!/أطلب صرف|request payment/.test(neg.body),
     "a pre-signature letter makes no demand");
  ok(neg.guidance === false, "and carries no dispute guidance");

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nthe dispute letters demand, cite the contract, and give nothing away");
})();
