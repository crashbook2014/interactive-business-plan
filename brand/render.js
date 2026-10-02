/* Renders brand/wodouh-brand-guide.html to PDF with the real fonts.
 * Start the static server first (node test/serve.js), then:
 *   node brand/render.js
 */
const path = require("path");
const env = require(path.join(__dirname, "..", "test", "_env.js"));
(async () => {
  const b = await env.playwright().chromium.launch(env.launchOpts());
  const p = await b.newPage();
  await p.goto(env.BASE + "/brand/wodouh-brand-guide.html", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: path.join(__dirname, "wodouh-brand-guide.pdf"), width: "297mm", height: "210mm",
                printBackground: true, preferCSSPageSize: true });
  if (process.argv[2] === "--preview") {
    await p.setViewportSize({ width: 1123, height: 794 });
    const pages = await p.$$(".page");
    for (const i of [0, 2, 4, 9, 10]) if (pages[i]) await pages[i].screenshot({ path: path.join(process.argv[3] || ".", `page-${i + 1}.png`) });
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
