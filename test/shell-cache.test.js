/* The offline cache cannot go stale without somebody noticing.
 *
 * WHAT WENT WRONG, AND FOR HOW LONG.
 *
 * app/sw.js said "Bump CACHE on any change to the shell" and nothing did,
 * through every shell change between v2 and the day it was found. A comment is
 * a request; nothing was holding anyone to it.
 *
 * The consequence is not a cosmetic staleness. `activate` deletes every cache
 * whose key is not the current one — so with the key unchanged there is
 * nothing to delete, and stale-while-revalidate keeps returning the cached
 * copy first and refreshing it only for next time. A returning reader opens
 * the PREVIOUS build and gets the current one on their second visit.
 *
 * This app's shell carries the legal figures and the rules that compute them,
 * so an old shell is old law. It is also exactly what produced a week of "it
 * works on my phone but not my laptop": two devices holding two different
 * builds, one of them from before the apikey header was added, disagreeing
 * about whether the product worked at all. That looks like a network fault and
 * is not one.
 *
 * WHAT IS ASSERTED. The cache name is derived from a fingerprint of the
 * shell's own bytes, so this suite only has to check that the recorded
 * fingerprint still matches the files on disk. Change a shell file without
 * regenerating and this fails with the command that fixes it.
 *
 * Both halves are read from the shipped files, never restated here: the file
 * list comes out of SHELL in sw.js, so a file added to the shell is
 * fingerprinted without anyone remembering to add it in two places.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SW = path.join(ROOT, "app", "sw.js");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const tool = await import("../tools/shell-fingerprint.mjs");
  const src = fs.readFileSync(SW, "utf8");

  /* ---------------------------------------------- 1. the shell is complete */
  console.log("— every file the offline shell promises is actually there");
  const files = tool.shellFiles(src);
  ok(files.length >= 8, `the SHELL list was read out of sw.js (${files.length} files)`);
  const missing = files.filter((f) => !fs.existsSync(f));
  /* install() adds each URL with .catch(() => {}) so one bad path cannot fail
     the whole install — which also means a missing file installs a shell that
     is quietly incomplete, and the reader finds out with the network off. */
  ok(missing.length === 0,
     `and each one exists on disk${missing.length ? " — missing: " + missing.map((f) => path.relative(ROOT, f)).join(", ") : ""}`);

  /* ------------------------------------- 2. the fingerprint is not stale */
  console.log("\n— the cache name still matches the bytes it is named after");
  const actual = tool.fingerprint(files);
  const recorded = tool.recordedHash(src);
  ok(!!recorded, `sw.js records a SHELL_HASH (${recorded || "none"})`);
  /* THE ASSERTION THIS FILE EXISTS FOR. A shell change without a regenerated
     fingerprint leaves every returning reader on the previous build. */
  ok(recorded === actual,
     recorded === actual
       ? `the recorded fingerprint matches the shell (${actual})`
       : `the shell changed and the fingerprint did not — recorded ${recorded}, actual ${actual}. Run: node tools/shell-fingerprint.mjs --write`);

  /* --------------------------- 3. the name is derived, never hand-written */
  console.log("\n— and the name is derived from it rather than chosen");
  /* Without this, the fix above is one edit away from being undone: somebody
     writes `const CACHE = "wodouh-shell-v4"` back, the fingerprint keeps
     passing on its own, and the version is a human decision again. */
  ok(/const CACHE = ["'][^"']*["']\s*\+\s*SHELL_HASH/.test(src),
     "CACHE is built from SHELL_HASH, so the two cannot drift apart");
  ok(!/const CACHE = ["'][^"']*v\d+["']\s*;/.test(src),
     "and is not a hand-written version string");

  /* ------------------------------------------- 4. no circular fingerprint */
  console.log("\n— and sw.js is not fingerprinting itself");
  /* Writing the hash into a file that is part of its own hash can never
     settle: the write changes the bytes the hash was taken over. */
  ok(!files.some((f) => path.basename(f) === "sw.js"),
     "sw.js is not in its own SHELL list");

  console.log("\n" + (FAIL.length
    ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
    : "the offline cache is named after the shell it holds, and says so truthfully"));
  process.exit(FAIL.length ? 1 : 0);
})();
