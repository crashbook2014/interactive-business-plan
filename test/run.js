/* Runs every suite, and owns the server's lifetime so nobody has to remember to
 * start one.
 *
 *   npm test                     against a server this script starts
 *   npm run test:live            against the deployed site
 *   node test/run.js routing     only suites whose name contains "routing"
 *
 * Exits non-zero if any suite fails, which is what makes it usable as a gate in
 * CI rather than something a human reads and interprets.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { serve } = require("./serve.js");

const DIR = __dirname;
const args = process.argv.slice(2);
const noServer = args.includes("--no-server");
const filter = args.find((a) => !a.startsWith("--"));

/* Ordered cheapest-first, so a broken build fails in seconds rather than
   minutes. The two heavy suites run last. */
const ORDER = [
  "headers.test.js",
  "schema.test.js",
  "rls.test.js",
  "calc-fuzz.test.js",
  "routing.test.js",
  "routing-shadowing.test.js",
  "pwa.test.js",
  "seo.test.js",
  "soon.test.js",
  "layout.test.js",
  "surfaces.test.js",
  "pdf.test.js",
  "matching.test.js",
  "situations.test.js",
  "motion.test.js",
  "accounts.test.js",
  "phone-auth.test.js",
  "commerce.test.js",
  "admin.test.js",
  "ask.test.js",
  "contract-review.test.js",
  "termination.test.js",
  "claude-path.test.js",
  "termination-ui.test.js",
  "scenarios.test.js",
];

const suites = ORDER
  .filter((f) => fs.existsSync(path.join(DIR, f)))
  .filter((f) => !filter || f.includes(filter));

/* Any suite present but missing from ORDER would be silently skipped, which is
   the failure mode where a test exists and nobody runs it. */
const known = new Set(ORDER);
const stray = fs.readdirSync(DIR)
  .filter((f) => f.endsWith(".test.js") && !known.has(f));
if (stray.length) {
  console.error(`\nThese suites exist but are not listed in test/run.js, so nothing runs them:\n  ${stray.join("\n  ")}\n`);
  process.exit(2);
}

function run(file, baseUrl) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(DIR, file)], {
      env: { ...process.env, WODOUH_URL: baseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => {
      resolve({ file, code, out, ms: Date.now() - started });
    });
  });
}

(async () => {
  let server = null;
  let baseUrl = process.env.WODOUH_URL || "";

  if (!noServer) {
    server = await serve(0);
    baseUrl = server.url;
    console.log(`\nserving locally at ${baseUrl}`);
  } else {
    if (!baseUrl) {
      console.error("--no-server needs WODOUH_URL set to the site to test");
      process.exit(2);
    }
    console.log(`\ntesting the deployed site at ${baseUrl}`);
  }

  console.log(`running ${suites.length} suite${suites.length === 1 ? "" : "s"}\n`);

  const results = [];
  for (const file of suites) {
    process.stdout.write(`  ${file.padEnd(28)}`);
    const r = await run(file, baseUrl);
    results.push(r);
    const secs = (r.ms / 1000).toFixed(1);
    if (r.code === 0) {
      /* The last non-empty line is each suite's own verdict. */
      const last = r.out.trim().split("\n").filter(Boolean).pop() || "passed";
      console.log(`ok    ${secs}s  ${last.trim()}`);
    } else {
      console.log(`FAIL  ${secs}s`);
    }
  }

  if (server) await server.close();

  const failed = results.filter((r) => r.code !== 0);
  if (failed.length) {
    console.log(`\n${"=".repeat(64)}`);
    for (const f of failed) {
      console.log(`\n--- ${f.file} ---\n`);
      console.log(f.out.trim());
    }
    console.log(`\n${failed.length} of ${results.length} suites failed\n`);
    process.exit(1);
  }

  const total = (results.reduce((n, r) => n + r.ms, 0) / 1000).toFixed(1);
  console.log(`\nall ${results.length} suites passed in ${total}s\n`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
