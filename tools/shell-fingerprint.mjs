/* Wodouh — fingerprint the offline shell, and name the cache after it.
 *
 * WHY THIS FILE EXISTS
 *
 * app/sw.js carried the rule in a comment — "Bump CACHE on any change to the
 * shell" — and the rule lapsed, through every shell change between v2 and the
 * day someone noticed. A comment is a request. With the version unchanged,
 * `activate` has nothing to delete, so stale-while-revalidate keeps handing a
 * returning reader the previous build and only refreshes it for next time.
 *
 * That is not a cosmetic staleness problem for this product. The shell carries
 * the legal figures and the rules that compute them, so an old shell is old
 * law. It is also what produced a week of "it works on my phone but not my
 * laptop": two devices holding two builds, one of them from before the apikey
 * header was added, disagreeing about whether the product worked at all.
 *
 * WHAT THIS DOES INSTEAD
 *
 * The cache name is DERIVED from the shell's own bytes:
 *
 *     const SHELL_HASH = "…";
 *     const CACHE = "wodouh-shell-" + SHELL_HASH;
 *
 * so there is no version for a human to choose and therefore none to forget.
 * Change any shell file and the hash changes; change the hash and the cache
 * name changes with it, in one edit that cannot be done by halves. The old
 * cache is dropped on activate because its key no longer matches.
 *
 * `node tools/shell-fingerprint.mjs`          prints the current hash
 * `node tools/shell-fingerprint.mjs --write`  updates app/sw.js in place
 *
 * test/shell-cache.test.js fails when the recorded hash and the files on disk
 * disagree, which is what makes this structural rather than another comment.
 *
 * sw.js IS NOT PART OF ITS OWN FINGERPRINT, deliberately — it cannot be, since
 * writing the hash into the file would change the file and invalidate the hash
 * it just recorded. It does not need to be: a service worker is updated by the
 * browser's own byte-comparison of the worker script, which is the one file
 * that already has a working update mechanism.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SW = path.join(ROOT, "app", "sw.js");

/* The shell is whatever sw.js says it is — read out of the file rather than
   repeated here, so a file added to SHELL is fingerprinted without anyone
   remembering to add it in two places. */
export function shellFiles(swSrc = readFileSync(SW, "utf8")) {
  const block = (swSrc.match(/const SHELL = \[([\s\S]*?)\];/) || [])[1] || "";
  return [...block.matchAll(/["']([^"']+)["']/g)]
    .map((m) => m[1])
    /* "./" is the app's own directory, served by index.html, which is already
       in the list on its own. Hashing it twice would say nothing. */
    .filter((p) => p !== "./")
    .map((p) => path.join(ROOT, "app", p));
}

export function fingerprint(files = shellFiles()) {
  const h = createHash("sha256");
  for (const f of files) {
    /* The path goes into the hash as well as the bytes, so moving a file or
       renaming one changes the fingerprint even when its contents do not. */
    h.update(path.relative(ROOT, f).replace(/\\/g, "/"));
    h.update(existsSync(f) ? readFileSync(f) : Buffer.from("<missing>"));
  }
  /* Twelve hex characters. Long enough that a collision is not a thing that
     happens, short enough to read in a cache key in devtools. */
  return h.digest("hex").slice(0, 12);
}

export function recordedHash(swSrc = readFileSync(SW, "utf8")) {
  return (swSrc.match(/const SHELL_HASH = ["']([0-9a-f]+)["']/) || [])[1] || null;
}

/* --------------------------------------------------------------- CLI */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const files = shellFiles();
  const hash = fingerprint(files);
  const missing = files.filter((f) => !existsSync(f));

  if (process.argv.includes("--write")) {
    const src = readFileSync(SW, "utf8");
    if (!/const SHELL_HASH = ["'][0-9a-f]*["']/.test(src)) {
      console.error("app/sw.js has no SHELL_HASH line to update.");
      process.exit(2);
    }
    const next = src.replace(/const SHELL_HASH = ["'][0-9a-f]*["']/,
                             `const SHELL_HASH = "${hash}"`);
    writeFileSync(SW, next);
    console.log(`app/sw.js updated — SHELL_HASH = "${hash}"`);
  } else {
    console.log(`shell files : ${files.length}`);
    for (const f of files) console.log(`  ${path.relative(ROOT, f)}${existsSync(f) ? "" : "   MISSING"}`);
    console.log(`\nfingerprint : ${hash}`);
    const rec = recordedHash();
    console.log(`recorded    : ${rec || "(none)"}`);
    console.log(rec === hash
      ? "\nin step."
      : "\nOUT OF STEP — run: node tools/shell-fingerprint.mjs --write");
  }
  if (missing.length) {
    console.error(`\n${missing.length} shell file(s) missing from disk — the cache would install incomplete.`);
    process.exit(1);
  }
}
