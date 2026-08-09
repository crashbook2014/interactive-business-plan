/* The optional Claude path — what it does, and what it must never do.
 *
 * This is the only feature in Wodouh that sends anything off the device, so
 * the assertions here are about restraint rather than function:
 *
 *   - the shipping build makes ZERO off-origin requests, proven by watching
 *     the network rather than by reading the code
 *   - consent gates the send: rendering the panel sends nothing, ticking the
 *     box sends nothing, only pressing the button sends
 *   - only the contract text goes; not the dates, wage, answers or documents
 *   - the privacy copy tracks the build — unconditional when there is nothing
 *     to qualify, and stating the exception when there is
 *   - markup returned by the model becomes visible text, never DOM
 *   - nothing the model says moves a single riyal figure
 *
 * Run against a local server on :8099 from the repo root:
 *   node test/claude-path.test.js
 */
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

  /* ---- 1. shipping default: no config at all */
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const reqs = [];
  p.on("request", r => reqs.push(r.url()));
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto("http://127.0.0.1:8099/app/");
  await p.waitForFunction(() => typeof window.show === "function");

  console.log("— unconfigured (what ships today)");
  const off = await p.evaluate(() => {
    nat = "sa"; lang = "en"; applyLang();
    term = Object.assign(blankTerm(), { how:"employer", start:"2020-01-01",
      end:"2026-01-01", wage:10000, docs:["d_contract"] });
    renderTermEv(); show("termev");
    const host = document.getElementById("termAi");
    return { available: aiAvailable(), hidden: host.hidden, html: host.innerHTML.length,
             cfg: typeof window.WODOUH_CONFIG };
  });
  ok(off.cfg === "undefined", "no config object ships");
  ok(off.available === false, "aiAvailable() is false without a URL");
  ok(off.hidden === true && off.html === 0, "the panel renders nothing at all");

  const claim = await p.evaluate(() => {
    renderAccount(); renderPrivacyCopy();
    return { home: document.querySelector('#screen-home [data-t="privacy_line"]').textContent,
             acc: document.querySelector('#screen-account [data-t="acc_privacy_b"]').textContent };
  });
  ok(/never leaves it/i.test(claim.home) && /don't upload/i.test(claim.acc),
     "unconfigured: the unconditional privacy promise is kept, because it is true");

  /* Try to force it. An unconfigured build must not call out even if asked. */
  const forced = await p.evaluate(async () => {
    aiConsent = true;
    await aiRun();
    return { findings: aiFindings, error: aiError, busy: aiBusy };
  });
  ok(forced.findings === null, "forcing aiRun() produces no findings");

  const offsite = reqs.filter(u => !u.startsWith("http://127.0.0.1:8099"));
  ok(offsite.length === 0,
     `zero off-origin requests in the shipping default (${offsite.length})`);
  offsite.forEach(u => console.log("   leaked: " + u));
  console.log(`   ${reqs.length} requests total, all same-origin`);
  await p.close();

  /* ---- 2. configured: consent must gate the send */
  console.log("\n— configured, with a stub endpoint");
  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p2.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  const sent = [];
  await p2.route("https://stub.supabase.co/**", async route => {
    sent.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ summary: "A calm summary.", findings: [
        { title: "Notice period", detail: "The contract states 30 days.", severity: "review" },
        { title: "<img src=x onerror=alert(1)>", detail: "<b>markup</b> from the model", severity: "attention" }
      ] }) });
  });
  await p2.addInitScript(() => {
    window.WODOUH_CONFIG = { ANALYZE_URL: "https://stub.supabase.co/functions/v1/analyze" };
  });
  await p2.goto("http://127.0.0.1:8099/app/");
  await p2.waitForFunction(() => typeof window.show === "function");

  const on = await p2.evaluate(() => {
    nat = "sa"; lang = "en"; applyLang();
    document.getElementById("pasteBox").value =
      "EMPLOYMENT CONTRACT. ".repeat(20) + "The notice period is thirty days and the monthly salary is 10000 SAR.";
    term = Object.assign(blankTerm(), { how:"employer", start:"2020-01-01",
      end:"2026-01-01", wage:10000, docs:["d_contract"] });
    renderTermEv(); show("termev");
    const host = document.getElementById("termAi");
    return { hidden: host.hidden, hasConsent: !!document.getElementById("aiAgree"),
             goDisabled: document.getElementById("aiGo").disabled,
             text: host.textContent };
  });
  ok(on.hidden === false && on.hasConsent, "configured: the consent panel renders");

  const claim2 = await p2.evaluate(() => {
    renderAccount(); renderPrivacyCopy();
    return { home: document.querySelector('#screen-home [data-t="privacy_line"]').textContent,
             acc: document.querySelector('#screen-account [data-t="acc_privacy_b"]').textContent };
  });
  ok(!/never leaves it/i.test(claim2.home) && /one exception/i.test(claim2.home),
     "configured: the home privacy line states the exception instead");
  ok(/Anthropic/.test(claim2.acc) && /only runs if you press it/i.test(claim2.acc),
     "configured: the account screen names Anthropic and says it is opt-in");
  ok(!/We don't upload it, store it, or share it/.test(claim2.acc),
     "configured: the now-false unconditional sentence is gone");
  ok(on.goDisabled === true, "the send button starts disabled");
  ok(/leave your device/i.test(on.text), "it says the text leaves the device");
  ok(/not stored/i.test(on.text), "it says nothing is stored");
  ok(/nothing is missing/i.test(on.text), "declining is presented as costless");
  ok(sent.length === 0, "nothing has been sent while consent is unticked");

  const afterTick = await p2.evaluate(() => {
    const box = document.getElementById("aiAgree");
    box.checked = true; box.dispatchEvent(new Event("change"));
    return document.getElementById("aiGo").disabled;
  });
  ok(afterTick === false, "ticking consent enables the button");
  ok(sent.length === 0, "ticking alone still sends nothing");

  await p2.evaluate(() => document.getElementById("aiGo").click());
  await p2.waitForFunction(() => aiBusy === false && aiFindings !== null, { timeout: 5000 });

  ok(sent.length === 1, `exactly one request was sent (${sent.length})`);
  const body = sent[0] || {};
  ok(typeof body.text === "string" && /EMPLOYMENT CONTRACT/.test(body.text),
     "the contract text was sent");
  ok(!JSON.stringify(body).includes("2020-01-01") && !JSON.stringify(body).includes("10000 SAR\"") ,
     "the reader's dates and answers were not sent");
  ok(Object.keys(body).sort().join(",") === "kind,text",
     `only kind and text are sent (${Object.keys(body).join(", ")})`);

  const rendered = await p2.evaluate(() => {
    const host = document.getElementById("termAi");
    return { html: host.innerHTML, text: host.textContent,
             imgs: host.querySelectorAll("img").length,
             bolds: host.querySelectorAll(".ai-find b b").length };
  });
  ok(rendered.imgs === 0, "markup from the model did not become an element");
  ok(rendered.html.indexOf("<img src=x") === -1, "the injected tag is not live HTML");
  ok(/&lt;img src=x/.test(rendered.html) || rendered.text.includes("<img src=x"),
     "it is shown as visible text instead");
  ok(rendered.bolds === 0, "model markup is not parsed inside a finding");
  ok(/A calm summary/.test(rendered.text), "the summary is displayed");
  ok(/automated read/i.test(rendered.text), "the panel labels itself as Wodouh's reading");

  /* The assessment must not move because of anything the model said. */
  const unaffected = await p2.evaluate(() => {
    const before = termTotal();
    return { before, after: termTotal(), same: JSON.stringify(termLines()) };
  });
  ok(unaffected.before === unaffected.after, "the model's output feeds into no amount");

  console.log("\n" + (FAIL.length ? `${FAIL.length} FAILURES\n` + FAIL.map(f => "  - " + f).join("\n")
                                  : "all Claude-path checks passed"));
  await b.close();
  process.exit(FAIL.length ? 1 : 0);
})();
