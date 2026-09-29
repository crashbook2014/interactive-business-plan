/* Screenshots of the LIVE site, for the founder. Run by the "live
 * screenshots" workflow, which pushes the PNGs to the live-shots branch.
 * Nothing here is stubbed: no flags, no sign-in, no cached shell. What it
 * captures is what a first-time visitor to alwodouh.com sees. */
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = (process.argv[2] || "https://alwodouh.com").replace(/\/$/, "");
const OUT = process.argv[3] || "shots";
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const shots = [];
  for (const lang of ["ar", "en"]) {
    for (const scheme of ["light", "dark"]) {
      const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2,
                                  colorScheme: scheme, serviceWorkers: "block" });
      await p.goto(BASE + "/app/?shots=" + Date.now(), { waitUntil: "networkidle", timeout: 60000 });
      await p.waitForFunction(() => typeof show === "function", null, { timeout: 30000 });
      const served = await p.evaluate((L) => {
        try { obDone = true; } catch (e) {}
        lang = L; applyLang(); renderFuture(); show("future");
        return { free: typeof FREE_NOW === "undefined" ? null : FREE_NOW,
                 icons: typeof FU_ICONS === "object",
                 emoji: /[\u{1F300}-\u{1FAFF}]/u.test(document.getElementById("fuGrid").textContent) };
      }, lang);
      await p.waitForTimeout(600);
      await p.evaluate(() => document.getElementById("fuGrid").scrollIntoView());
      const file = `${OUT}/roadmap-${lang}-${scheme}.png`;
      await p.screenshot({ path: file });
      shots.push({ file, ...served });
      await p.close();
    }
  }
  /* THE PAYWALLS. Reaching one on the live site normally takes a signed-in
     reader with a scan behind them. The walk below uses the live page's own
     functions to get there: the first free scan of the built-in sample
     contract, then the letter, review and termination paywalls. The only
     stand-in is a local signed-in marker so navigation is not redirected to
     the sign-in screen; nothing is sent to any server and no checkout opens.
     What renders is the live catalogue, prices and copy. */
  for (const lang of ["ar", "en"]) {
    for (const mode of ["letter", "review", "case"]) {
      const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2,
                                  colorScheme: "light", serviceWorkers: "block" });
      await p.goto(BASE + "/app/?shots=" + Date.now(), { waitUntil: "networkidle", timeout: 60000 });
      await p.waitForFunction(() => typeof show === "function", null, { timeout: 30000 });
      const served = await p.evaluate(async ([L, mode]) => {
        obDone = true; nat = "sa"; lang = L; applyLang();
        authUser = { id: "00000000-0000-0000-0000-000000000000", email: "preview@alwodouh.com" };
        authReady = Promise.resolve();
        if (typeof WodouhAuth !== "undefined") { WodouhAuth.user = () => authUser; WodouhAuth.api = () => Promise.resolve(null); }
        if (mode === "case") {
          term = Object.assign(blankTerm(), { how: "employer", start: "2020-01-01", end: "2026-01-01", wage: 10000, docs: ["d_contract"] });
        } else {
          current = SAMPLES.employment; renderResult(); addAllPoints();
        }
        pwMode = mode; pwOrigin = mode === "case" ? "term" : mode; pwUpgrade = null; pwPlan = 0;
        /* What openPaywall() does first: load the live flags from the project.
           Skipping this renders the compiled default ("checkout opens
           shortly") instead of what a real visitor sees. */
        const flagsLoaded = await Promise.race([ensureFlags(), new Promise(r => setTimeout(() => r("timeout"), 8000))]);
        const ok = renderPaywall(); if (ok) show("paywall");
        window.__flagsLoaded = flagsLoaded;
        return { ok, flags: String(window.__flagsLoaded), free: FREE_NOW, live: PAYMENT_LIVE,
                 plans: activePlans().map(x => x.name + ":" + x.amt),
                 guarantee: !document.getElementById("pwGuarantee").hidden };
      }, [lang, mode]);
      await p.waitForTimeout(500);
      await p.evaluate(() => document.getElementById("pwGuarantee").scrollIntoView({ block: "start" }));
      await p.evaluate(() => window.scrollBy(0, -40));
      const file = `${OUT}/paywall-${mode}-${lang}.png`;
      await p.screenshot({ path: file });
      shots.push({ file, ...served });
      await p.close();
    }
  }
  fs.writeFileSync(`${OUT}/served.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), shots }, null, 2));
  console.log(JSON.stringify(shots, null, 2));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
