/* One dropped connection is not a broken product.
 *
 * WHAT THIS IS FOR. The Supabase project this app talks to is hosted a long
 * way from the people using it, and a long-haul route does not fail cleanly —
 * it fails sometimes. The founder's own desktop produced
 * ERR_CONNECTION_TIMED_OUT on a Google sign-in and then completed the next
 * attempt from the same browser minutes later, while a phone on a different
 * carrier went through every time. Before this, one dropped packet meant the
 * reader was told the request failed and left to press the button again — on
 * screens where what they pressed it for is a contract they are frightened
 * about.
 *
 * THREE THINGS PINNED HERE, because each is a separate way a retry can be
 * wrong rather than right:
 *
 * 1. A TRANSPORT FAILURE IS RETRIED. The request never arrived, so sending it
 *    again asks nothing twice.
 * 2. A DEADLINE IS NOT. Our own AbortController firing means the request very
 *    likely DID arrive and is still being worked on; a second copy is a second
 *    job, a second charge and a second rate-limit slot. This is the assertion
 *    most likely to be "simplified" away by someone who reads the retry as a
 *    general-purpose one.
 * 3. THE UPLOAD IS NOT RETRIED AT ALL. A browser cannot tell a request that
 *    died on the way out from one whose response died on the way back, and
 *    guessing wrong sends the same file to Anthropic twice — billed, stored
 *    and swept twice.
 *
 * And the copy, which was the part actively telling a falsehood: a reader
 * whose request fails this way is usually online. Their browser is fine and
 * their other tabs are fine; what failed is the route to our service. "No
 * connection" sent them to restart a router that was never broken.
 */
const { playwright, launchOpts, APP, signInStub } = require("./_env.js");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const AI_HOST = "https://stub.supabase.co";
const ANALYZE = `${AI_HOST}/functions/v1/analyze`;
const UPLOAD = `${AI_HOST}/functions/v1/upload`;

/* A TEST FOR RETRIES MUST NOT HANG EITHER — same reasoning as its sibling
   network-deadline.test.js, and the same outer cap for the same reason. */
const CAP_MS = 9000;
const withCap = (promise, label) => Promise.race([
  promise,
  new Promise((res) => setTimeout(() => res({ __hung: true, label }), CAP_MS)),
]);

(async () => {
  const b = await chromium.launch(launchOpts());

  /* A page whose CSP allows the stub host, with both endpoints configured and
     counted. `mode` decides how the endpoint misbehaves. */
  const wired = async (mode) => {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    p.on("pageerror", (e) => FAIL.push(`pageerror: ${e.message}`));
    const seen = { analyze: 0, upload: 0 };

    await p.route("**/app/", async (route) => {
      const res = await route.fetch();
      const body = (await res.text()).replace(/connect-src [^;]*/, `connect-src ${AI_HOST}`);
      await route.fulfill({ response: res, body });
    });

    await p.route(`${ANALYZE}**`, async (route) => {
      seen.analyze++;
      /* abort() is a TRANSPORT failure — the browser surfaces it as a
         TypeError, which is exactly what a refused connection or a dead route
         looks like. never() leaves it pending so our own deadline is what
         fires, which is the case that must NOT be retried. */
      if (mode === "never") return;            /* deliberately never fulfilled */
      await route.abort();
    });
    await p.route(`${UPLOAD}**`, async (route) => { seen.upload++; await route.abort(); });

    await p.addInitScript(() => {
      window.WODOUH_CONFIG = {
        ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze",
        UPLOAD_URL: "https://stub.supabase.co/functions/v1/upload",
      };
    });
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");
    await p.evaluate(signInStub);
    return { p, seen };
  };

  /* ------------------------------------ 1. a dropped connection is retried */
  console.log("— a connection that never landed is tried again");
  {
    const { p, seen } = await wired("abort");
    const out = await withCap(p.evaluate(async () => {
      RETRY_PAUSE_MS = 20;        /* see its declaration: suites shorten it */
      nat = "sa"; obDone = true; openAssist("home");
      const before = askLeft();
      document.getElementById("askInput").value = "هل يحق لهم فصلي بدون إشعار؟";
      document.getElementById("askSend").click();
      await new Promise((r) => setTimeout(r, 2200));
      const bots = [...document.querySelectorAll("#chat .msg.bot")];
      return { text: bots[bots.length - 1].textContent || "", spent: before - askLeft() };
    }), "retry");

    ok(!out.__hung, `the screen finishes rather than hanging${out.__hung ? " — STILL HANGING" : ""}`);
    /* THE ASSERTION THIS FILE EXISTS FOR. One original, one retry. */
    ok(seen.analyze === 2,
       `the request is sent twice, not once (${seen.analyze} request${seen.analyze === 1 ? "" : "s"})`);
    /* And not three times. A retry that loops is a worse failure than none:
       it turns one dropped packet into a queue of them. */
    ok(seen.analyze <= 2, `and never more than twice (${seen.analyze})`);
    ok((out.text || "").trim().length > 10, "the reader is told, rather than left with a spinner");
    /* The guarantee this screen has always made, still standing after a retry:
       a question that produced no answer costs nothing. */
    ok(out.spent === 0, `and a failure that produced no answer still costs nothing (${out.spent})`);
    await p.close();
  }

  /* --------------------------------- 2. a deadline is deliberately NOT retried */
  console.log("\n— but our own deadline is not retried, because it may have arrived");
  {
    const { p, seen } = await wired("never");
    const out = await withCap(p.evaluate(async () => {
      AI_TIMEOUT_MS = 350; RETRY_PAUSE_MS = 20;
      nat = "sa"; obDone = true; openAssist("home");
      document.getElementById("askInput").value = "سؤال";
      document.getElementById("askSend").click();
      await new Promise((r) => setTimeout(r, 1800));
      const bots = [...document.querySelectorAll("#chat .msg.bot")];
      return { text: bots[bots.length - 1].textContent || "" };
    }), "deadline");

    ok(!out.__hung, `it still gives up${out.__hung ? " — STILL HANGING" : ""}`);
    /* THE ONE A GENERAL-PURPOSE RETRY BREAKS. The request is very likely being
       worked on at the other end; a second copy is a second job. */
    ok(seen.analyze === 1,
       `a timed-out request is sent once only (${seen.analyze} request${seen.analyze === 1 ? "" : "s"})`);
    ok((out.text || "").trim().length > 10, "and the reader is still told");
    await p.close();
  }

  /* ------------------------------------- 3. the upload is never sent twice */
  console.log("\n— and the upload is never sent twice, whatever happened to it");
  {
    const { p, seen } = await wired("abort");
    const out = await withCap(p.evaluate(async () => {
      RETRY_PAUSE_MS = 20;
      nat = "sa"; obDone = true;
      await handleFile(new File([new Uint8Array([137, 80, 78, 71])], "c.png", { type: "image/png" }));
      await new Promise((r) => setTimeout(r, 2600));
      offerScan();
      await new Promise((r) => setTimeout(r, 400));
      const dlg = document.getElementById("confirmDlg");
      (dlg.querySelector("#dlgYes") || dlg.querySelectorAll("button")[1]).click();
      await new Promise((r) => setTimeout(r, 2000));
      const n = document.getElementById("offlineNotice");
      return { msg: n && !n.hidden ? n.textContent : "" };
    }), "upload");

    ok(!out.__hung, `the scan finishes rather than hanging${out.__hung ? " — STILL HANGING" : ""}`);
    ok(seen.upload >= 1, `the upload was actually attempted (${seen.upload})`);
    /* THE EXPENSIVE ONE. Two uploads means two files at Anthropic for one
       contract the reader sent once. */
    ok(seen.upload === 1,
       `and sent exactly once, never retried (${seen.upload} request${seen.upload === 1 ? "" : "s"})`);
    await p.close();
  }

  /* ------------------------- 4. what it says to a reader who IS online */
  console.log("\n— and it does not blame a connection that is working");
  {
    const { p } = await wired("abort");
    const out = await withCap(p.evaluate(async () => {
      RETRY_PAUSE_MS = 20;
      nat = "sa"; obDone = true;
      /* Both languages, because the Arabic is the one most readers see and the
         English is the one most likely to be edited without it. */
      const read = async (l) => {
        lang = l; applyLang();
        document.getElementById("pasteBox").value = "عقد عمل\n".repeat(60);
        aiConsent = true; aiError = null;
        await aiRun();
        return t(aiError || "ai_offline");
      };
      return { ar: await read("ar"), en: await read("en") };
    }), "copy");

    ok(!out.__hung, `the read finishes${out.__hung ? " — STILL HANGING" : ""}`);
    for (const [l, msg] of [["ar", out.ar], ["en", out.en]]) {
      /* THE FALSEHOOD THAT WAS ON SCREEN. Their connection is usually fine. */
      ok(!/ما فيه اتصال|no connection/i.test(msg || ""),
         `${l}: does not tell a working reader their connection is down ("${(msg || "").slice(0, 46)}")`);
      /* And says the thing that makes one dropped packet not look like a
         broken product — that we already tried again. */
      ok(/أعدنا المحاولة|tried again/i.test(msg || ""),
         `${l}: and says we already tried again`);
    }
    await p.close();
  }

  await b.close();
  console.log("\n" + (FAIL.length
    ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
    : "a dropped connection is retried once, a deadline is not, the upload never is" +
      " — NOTE: every endpoint here is intercepted; no live request was made"));
  process.exit(FAIL.length ? 1 : 0);
})();
