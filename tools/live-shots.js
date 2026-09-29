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
  fs.writeFileSync(`${OUT}/served.json`, JSON.stringify({ base: BASE, at: new Date().toISOString(), shots }, null, 2));
  console.log(JSON.stringify(shots, null, 2));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
