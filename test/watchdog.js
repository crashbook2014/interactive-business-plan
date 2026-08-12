/* Walks the LIVE app and reports whether it is actually working.
 *
 *   node test/watchdog.js https://alwodouh.com
 *
 * Different job from the suites. They prove the code is correct; this proves
 * the deployment is. Those fail apart more often than people expect — a build
 * that never published, a font that 404s, a CDN serving a stale page, a change
 * that quietly started calling out to the network.
 *
 * Everything here is checked against what a browser actually loaded, not
 * against the repository.
 */
const { playwright, launchOpts } = require("./_env.js");
const { chromium } = playwright();

const BASE = (process.argv[2] || process.env.WODOUH_URL || "").replace(/\/$/, "");
if (!BASE) {
  console.error("Usage: node test/watchdog.js <site url>");
  process.exit(2);
}

const problems = [];
const notes = [];
const check = (ok, msg, detail) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`);
  if (!ok) problems.push(detail ? `${msg} — ${detail}` : msg);
  return ok;
};

/* A figure a reader could actually be shown, recomputed here by hand so the
   watchdog does not simply agree with whatever the app says.
   Article 84: 5 x half a month + 3 full months, on a 12,000 wage. */
const CASE = {
  start: "2018-01-31", end: "2026-01-31", wage: 12000,
  expectAward: (5 * 0.5 + 3) * 12000,   // 66,000
};

(async () => {
  console.log(`\nWodouh watchdog — ${BASE}\n${new Date().toISOString()}\n`);
  const browser = await chromium.launch(launchOpts());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const consoleErrors = [];
  const pageErrors = [];
  const requests = [];
  const failedRequests = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  page.on("requestfailed", (r) => failedRequests.push(`${r.url()} (${r.failure()?.errorText})`));

  /* ---- 1. the pages are actually being served */
  console.log("1. Pages served");
  for (const path of ["/app/", "/", "/brand/"]) {
    let status = 0;
    try {
      const res = await page.request.get(BASE + path);
      status = res.status();
    } catch (e) {
      notes.push(`${path}: ${e.message}`);
    }
    check(status === 200, `${path} returns 200`, `got ${status}`);
  }

  /* ---- 2. it booted. A 200 that renders nothing is the failure people miss */
  console.log("\n2. The app boots");
  let booted = false;
  try {
    await page.goto(BASE + "/app/", { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(() => typeof window.show === "function", { timeout: 15000 });
    booted = true;
  } catch (e) {
    notes.push(`boot: ${e.message}`);
  }
  if (!check(booted, "the app's own JavaScript initialised")) {
    await finish(browser);
    return;
  }
  const shell = await page.evaluate(() => ({
    screens: document.querySelectorAll(".screen").length,
    active: !!document.querySelector(".screen.active"),
    title: document.title,
  }));
  check(shell.screens > 15, `${shell.screens} screens present`);
  check(shell.active, "a screen is visible");

  /* ---- 3. the fonts and assets the page asked for actually arrived */
  console.log("\n3. Assets");
  check(failedRequests.length === 0, "no failed requests",
        failedRequests.slice(0, 3).join("; "));

  /* ---- 4. nothing is phoning home.
     The privacy promise, checked in production rather than assumed. */
  console.log("\n4. Privacy");
  const offOrigin = requests.filter((u) => !u.startsWith(BASE) && !u.startsWith("data:"));
  check(offOrigin.length === 0, "zero off-origin requests on load",
        offOrigin.slice(0, 3).join("; "));

  /* ---- 5. a real journey, end to end, with the arithmetic checked */
  console.log("\n5. The termination journey");
  let journey = null;
  try {
    journey = await page.evaluate(async (c) => {
      nat = "sa"; lang = "en"; applyLang();
      term = Object.assign(blankTerm(), {
        how: "employer", start: c.start, end: c.end, wage: c.wage,
        ctype: "indef", noticeDue: 60, noticeGiven: 10, leaveDays: 14,
        unpaidMonths: 2, gotEos: false, gotSettle: false,
        docs: ["d_contract", "d_letter"],
      });
      owned.term = "plan_term_full";
      await openTermResult();
      const screen = document.getElementById("screen-termres");
      return {
        award: termAward(),
        total: termTotal(),
        lines: termLines().length,
        sources: document.querySelectorAll("#termMoney .src-line").length,
        blocks: reviewBlocks().length,
        safe: assessmentSafe().ok,
        text: screen.textContent,
      };
    }, CASE);
  } catch (e) {
    notes.push(`journey: ${e.message}`);
  }

  if (check(!!journey, "the assessment renders")) {
    check(Math.abs(journey.award - CASE.expectAward) < 1,
          `the end-of-service figure is right (${Math.round(journey.award)})`,
          `expected ${CASE.expectAward}`);
    check(journey.lines >= 4, `${journey.lines} money lines`);
    check(journey.sources === journey.lines, "every money line carries a source",
          `${journey.sources} sources for ${journey.lines} lines`);
    check(journey.safe && journey.blocks === 0, "the display gate passes");
    check(!/undefined|NaN|Infinity|\[object/.test(journey.text),
          "no undefined or NaN on screen");
    /* The promises this product must never make, checked on the live page. */
    const banned = [/\byou will win\b/i, /\bguarantee/i, /\billegal\b/i, /\bunlawful\b/i];
    const hit = banned.filter((re) => re.test(journey.text));
    check(hit.length === 0, "no promise language", hit.join(", "));
  }

  /* ---- 6. Arabic and RTL, which is half the audience */
  console.log("\n6. Arabic");
  const ar = await page.evaluate(() => {
    lang = "en"; toggleLang();
    return {
      dir: document.documentElement.dir,
      arabic: /[؀-ۿ]/.test(document.body.textContent),
      text: document.getElementById("screen-termres").textContent,
    };
  }).catch(() => null);
  if (check(!!ar, "the language toggle works")) {
    check(ar.dir === "rtl", "the document switches to RTL");
    check(ar.arabic, "Arabic renders");
    check(!/undefined|NaN/.test(ar.text), "no undefined or NaN in Arabic");
  }

  /* ---- 7. errors surfaced by the browser itself */
  console.log("\n7. Runtime errors");
  check(pageErrors.length === 0, "no uncaught page errors", pageErrors.slice(0, 3).join("; "));
  check(consoleErrors.length === 0, "no console errors", consoleErrors.slice(0, 3).join("; "));

  await finish(browser);
})().catch((e) => {
  console.error("\nwatchdog itself failed:", e.message);
  process.exit(1);
});

async function finish(browser) {
  await browser.close();
  console.log("");
  if (notes.length) {
    console.log("Notes:");
    notes.forEach((n) => console.log("  - " + n));
    console.log("");
  }
  if (problems.length) {
    console.log(`${problems.length} PROBLEM${problems.length === 1 ? "" : "S"} on the live site:\n`);
    problems.forEach((p) => console.log("  - " + p));
    console.log("");
    process.exit(1);
  }
  console.log("The live site is healthy.\n");
}
