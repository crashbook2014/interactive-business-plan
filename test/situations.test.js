/* The front door.
 *
 * Wodouh's home screen used to be an upload box, which asks the visitor one
 * question: "do you have a contract file?" Everyone whose job has already
 * ENDED answers no and leaves — and that reader has the most money at stake
 * and the most reason to pay. Two independent reviews found the same gap from
 * opposite directions.
 *
 * The chooser adds no capability. Every destination below already existed and
 * was reachable only by someone who knew where to look. So what this suite
 * guards is not the flows — they have their own suites — but the doors:
 *
 *   - every situation has a door, in both languages, with no empty label
 *   - every door opens the flow it names, and not a different one
 *   - "I'm not sure" does NOT open a menu, because a menu is the thing the
 *     reader already could not choose from
 *   - the question door only exists in a build that can answer
 *   - the upload box the old front door was built around is still reachable
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const SITUATIONS = ["contract", "resign", "term", "owed", "ask", "unsure"];

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* ---- 1. every situation has a door, and it says something */
  console.log("\n— every situation a reader arrives in has a door");
  for (const lang of ["ar", "en"]) {
    const labels = await p.evaluate(([want, keys]) => {
      if ((document.documentElement.lang === "ar") !== (want === "ar")) toggleLang();
      show("home");
      return keys.map(k => ({
        k,
        title: (document.querySelector(`[data-t="sit_${k}"]`) || {}).textContent || "",
        sub: (document.querySelector(`[data-t="sit_${k}_d"]`) || {}).textContent || ""
      }));
    }, [lang, SITUATIONS]);
    const empty = labels.filter(l => !l.title.trim() || !l.sub.trim());
    ok(empty.length === 0,
       `${lang}: all ${SITUATIONS.length} doors are labelled${empty.length ? " — blank: " + empty.map(e => e.k).join(", ") : ""}`);
  }

  /* The gap this whole screen exists to close. */
  const front = await p.evaluate(() => {
    if (document.documentElement.lang !== "ar") toggleLang();
    show("home");
    return document.getElementById("situations").textContent;
  });
  ok(/تم إنهاء عقدي/.test(front),
     "the terminated reader is named on the front door, not buried four screens down");
  ok(/كم أستحق/.test(front), "and so is the one who only wants to know what they are owed");

  /* ---- 2. each door opens the flow it names */
  console.log("\n— each door opens the flow it names, and not another one");
  const routes = { term: "term", owed: "eos", resign: "eos" };
  for (const [which, screen] of Object.entries(routes)) {
    const landed = await p.evaluate((w) => {
      /* The termination flow diverges by nationality and asks for the track
         first when it does not have one — see the gate below. Choose it here
         so this assertion measures the ROUTE and not the gate. */
      nat = "sa";
      show("home");
      pickSituation(w);
      const el = document.querySelector(".screen.active");
      return { id: el ? el.id : null, journey };
    }, which);
    ok(landed.id === "screen-" + screen,
       `"${which}" opens ${screen} (landed on ${String(landed.id).replace("screen-", "")})`);
    ok(landed.journey === which, `and records which door was used (${landed.journey})`);
  }

  /* Thinking about resigning is a PLANNING question — the job has not ended —
     so it must not drop the reader into the termination assessment, which asks
     how it ended. */
  const resign = await p.evaluate(() => {
    show("home"); pickSituation("resign");
    return document.querySelector(".screen.active").id;
  });
  ok(resign !== "screen-term",
     "and 'thinking about resigning' does NOT open the termination flow — nothing has ended yet");

  /* ---- 3. "not sure" asks, it does not list */
  console.log("\n— 'I'm not sure' asks one question instead of offering a menu");
  const unsure = await p.evaluate(() => {
    show("home");
    const before = document.getElementById("sitUnsure").hidden;
    pickSituation("unsure");
    const box = document.getElementById("sitUnsure");
    return { before, after: box.hidden, stayed: document.querySelector(".screen.active").id,
             acts: box.querySelectorAll("button").length, text: box.textContent };
  });
  ok(unsure.before === true && unsure.after === false,
     "the follow-up is hidden until asked for, then appears");
  ok(unsure.stayed === "screen-home",
     "and the reader is not navigated anywhere — the question is asked in place");
  ok(unsure.acts === 2, `with exactly two answers, not a list (${unsure.acts})`);
  ok(/انتهى|ended/i.test(unsure.text), "and the question is about whether the job ended");

  const answered = await p.evaluate(() => {
    nat = "sa";
    show("home"); pickSituation("unsure");
    document.querySelectorAll("#sitUnsure button")[0].click();
    return document.querySelector(".screen.active").id;
  });
  ok(answered === "screen-term", "answering 'yes, it ended' lands on the termination flow");

  /* The gate is not a bug in the door — a reader whose track is unknown gets
     asked, because the termination rules diverge by nationality and Wodouh
     never renders law for an unknown track. Pinning it so a future change to
     the chooser cannot quietly route around it. */
  const gated = await p.evaluate(() => {
    nat = null;
    show("home"); pickSituation("term");
    return document.querySelector(".screen.active").id;
  });
  ok(gated !== "screen-term",
     `an unknown nationality is asked for before the termination flow opens (${gated.replace("screen-", "")})`);

  /* ---- 4. the question door tracks the build */
  console.log("\n— the question door only exists in a build that can answer");
  const off = await p.evaluate(() => {
    show("home");
    return { hidden: document.getElementById("sitAsk").hidden, avail: askAvailable() };
  });
  ok(off.avail === false && off.hidden === true,
     "with no endpoint configured, the question door is not shown");

  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p2.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p2.addInitScript(() => {
    window.WODOUH_CONFIG = { ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze" };
  });
  await p2.goto(APP);
  await p2.waitForFunction(() => typeof window.show === "function");
  const on = await p2.evaluate(() => {
    show("home");
    return { hidden: document.getElementById("sitAsk").hidden,
             opens: (pickSituation("ask"), document.querySelector(".screen.active").id) };
  });
  ok(on.hidden === false, "configured, it appears");
  ok(on.opens === "screen-ask", "and opens the ask screen");
  await p2.close();

  /* ---- 5. the old front door still works */
  console.log("\n— the upload box the old front door was built around is intact");
  const intake = await p.evaluate(() => {
    show("home"); pickSituation("contract");
    const box = document.getElementById("pasteBox");
    const btn = document.getElementById("analyzeBtn");
    return { stayed: document.querySelector(".screen.active").id,
             boxVisible: !!box && getComputedStyle(box).display !== "none",
             btnVisible: !!btn && getComputedStyle(btn).display !== "none" };
  });
  ok(intake.stayed === "screen-home", "'received a contract' keeps the reader on the intake screen");
  ok(intake.boxVisible && intake.btnVisible,
     "and the paste box and analyze button are still there, not hidden behind the chooser");

  await b.close();
  console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\nevery situation has a door, and each opens what it names");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
