/* No request may hang forever.
 *
 * A stalled connection does not reject. A phone that walks into a lift, or on
 * to a captive-portal wifi that swallows the packet, leaves fetch() pending
 * for as long as the page lives — and three of this app's five network calls
 * had no deadline at all. The ask screen, the closer read and the contract
 * review each showed a working state indefinitely, with nothing to press and
 * nothing said, while the reader sat believing their contract was being read.
 *
 * The two calls that DID handle it each carried their own copy of the same six
 * lines, which is how the other three came to be written without them. There
 * is one copy now and this suite asserts every call site uses it.
 *
 * The second assertion is about honesty rather than hanging: a deadline is not
 * a disconnection. Telling a reader to check their connection when the service
 * was simply slow sends them looking for a fault on their end that does not
 * exist.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };
const AI_HOST = "https://stub.supabase.co";

/* A TEST FOR HANGING MUST NOT HANG.
 *
 * The thing under test is a request that never answers. Remove the deadline
 * and the app waits forever — and so does page.evaluate, and so does the
 * suite, and so does CI. The first version of this file did exactly that: the
 * regression it exists to catch stalled it instead of failing it, which is a
 * worse outcome than not having the test, because a stalled run tells nobody
 * anything and eventually gets killed by something with no idea why.
 *
 * So every wait here has its own outer limit, generous enough that a working
 * deadline always wins the race and short enough that a broken one reports.
 */
const CAP_MS = 8000;
const withCap = (promise, label) => Promise.race([
  promise,
  new Promise((res) => setTimeout(() => res({ __hung: true, label }), CAP_MS)),
]);

(async () => {
  /* ---- static: every call site goes through the one helper */
  console.log("— every network call has a deadline, from one place");
  const src = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
  const bare = [...src.matchAll(/await fetch\(/g)].length;
  ok(bare === 1,
     `only fetchWithDeadline() calls fetch() directly (${bare} bare call${bare === 1 ? "" : "s"})`);
  ok(/async function fetchWithDeadline/.test(src), "and the helper exists");
  /* Nobody may rebuild the plumbing beside it. */
  const rolled = [...src.matchAll(/new AbortController\(\)/g)].length;
  ok(rolled === 1, `the abort plumbing is written once (${rolled})`);

  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
  await p.route("**/app/", async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace(/connect-src [^;]*/, `connect-src ${AI_HOST}`);
    await route.fulfill({ response: res, body });
  });
  /* The failure being reproduced: a request that never answers. */
  await p.route(`${AI_HOST}/**`, async () => { /* deliberately never fulfilled */ });
  await p.addInitScript(() => {
    window.WODOUH_CONFIG = { ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze" };
  });
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.askRun === "function");

  console.log("\n— a request that never answers still ends");
  const started = Date.now();
  const asked = await withCap(p.evaluate(async () => {
    AI_TIMEOUT_MS = 400;               /* see the comment on its declaration */
    nat = "sa"; obDone = true; authUser = { id: "t", email: "t@t.t" };
    askUsed = { day: null, n: 0 }; askAnswer = null; askError = null;
    openAsk();
    document.getElementById("askQ").value = "How long is my notice period?";
    document.getElementById("askQ").dispatchEvent(new Event("input"));
    const agree = document.getElementById("askAgree");
    agree.checked = true; agree.dispatchEvent(new Event("change"));
    await askRun();
    return { err: askError, busy: askBusy,
             shown: (document.getElementById("askBody") || {}).textContent || "" };
  }), "ask");
  const took = Date.now() - started;
  ok(!asked.__hung, `the ask screen gives up rather than hanging (${asked.__hung ? "STILL HANGING after " + CAP_MS + "ms" : took + "ms"})`);
  ok(asked.busy === false, "and stops showing a working state");
  ok(asked.err === "ask_timeout", `naming it a timeout, not a disconnection (${asked.err})`);
  ok(asked.shown.trim().length > 0, "with something on screen to read");
  /* The distinction that matters to the reader: do not send them to look for
     a network fault that is not theirs. */
  ok(!/no connection|ما فيه اتصال/.test(asked.shown),
     "and does not tell them their connection is down when it is not");

  console.log("\n— the closer read and the contract review, the same");
  /* Read as bindings rather than through window: a top-level `let` is not a
     property of the global object, so window.aiError is undefined no matter
     what aiError holds — which is how the first version of this block reported
     null for both and looked like a product bug. */
  for (const [name, which] of [
    ["the closer read", "ai"],
    ["the contract review", "cr"],
  ]) {
    const t0 = Date.now();
    const r = await withCap(p.evaluate(async (w) => {
      AI_TIMEOUT_MS = 400;
      document.getElementById("pasteBox").value = "عقد عمل\n".repeat(60);
      aiConsent = true;
      if (w === "ai"){ aiError = null; await aiRun(); return { err: aiError, busy: aiBusy }; }
      crError = null; await crRun(); return { err: crError, busy: crBusy };
    }, which), name);
    const dt = Date.now() - t0;
    ok(!r.__hung, `${name} gives up rather than hanging (${r.__hung ? "STILL HANGING after " + CAP_MS + "ms" : dt + "ms"})`);
    ok(r.busy === false, `${name} stops showing a working state`);
    ok(r.err === "ai_timeout", `${name} names it a timeout (${r.err})`);
  }

  await b.close();
  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nnothing waits forever, and a slow service is not called a lost connection");
})();
