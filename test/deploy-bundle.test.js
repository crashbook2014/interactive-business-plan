/* The edge function's deploy bundle, checked before it is deployed.
 *
 * THE FAILURE THIS EXISTS FOR HAPPENED. A deploy earlier in this project sent
 * corpus.json without the entrypoint and was rejected — that one failed loudly
 * and production was untouched, which was luck rather than design. The
 * dangerous version of the same mistake is a bundle that deploys and is
 * missing something the entrypoint imports at module load: the function then
 * fails to boot on the first real request, and the reader gets nothing while
 * the dashboard says the deploy succeeded.
 *
 * analyze/index.ts imports three files from _shared at module load. All four
 * must travel together. This suite reads the imports out of the entrypoint
 * rather than being told what they are, so a fourth import added next year is
 * covered without anyone remembering this file exists.
 *
 * It also checks the two things that make a bundle boot: that every imported
 * module parses, and that it really exports the names the entrypoint binds.
 * A typo in an export name is invisible until the runtime tries to resolve it.
 */
const fs = require("node:fs");
const path = require("node:path");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const FN = path.join(__dirname, "..", "supabase", "functions");
const ENTRY = path.join(FN, "analyze", "index.ts");

(async () => {
  const src = fs.readFileSync(ENTRY, "utf8");

  console.log("— everything the entrypoint imports exists and travels with it");
  /* Both shapes: `import X from "..."` and `import { a, b } from "..."`. */
  const imports = [...src.matchAll(/^import\s+(?:(\w+)|\{([^}]+)\})\s+from\s+"([^"]+)"/gm)]
    .map(([, dflt, named, spec]) => ({
      spec,
      names: dflt ? [dflt] : named.split(",").map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean),
    }))
    .filter(i => i.spec.startsWith("."));

  ok(imports.length >= 3, `the entrypoint has relative imports to ship (${imports.length})`);

  for (const imp of imports) {
    const file = path.resolve(path.dirname(ENTRY), imp.spec);
    ok(fs.existsSync(file), `${imp.spec} exists on disk`);
    if (!fs.existsSync(file)) continue;

    if (file.endsWith(".json")) {
      let parsed = null;
      try { parsed = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { parsed = null; }
      ok(parsed !== null, `${imp.spec} is valid JSON — invalid JSON stops the function booting`);
      ok(Array.isArray(parsed) ? parsed.length > 0 : Object.keys(parsed || {}).length > 0,
         `${imp.spec} is not empty`);
      continue;
    }

    /* A module that does not parse cannot be imported, and the failure lands
       at boot rather than at deploy. */
    let mod = null;
    try { mod = await import(file); } catch (e) { FAIL.push(`${imp.spec} does not load: ${e.message}`); }
    if (!mod) continue;
    for (const name of imp.names) {
      ok(typeof mod[name] !== "undefined",
         `${imp.spec} really exports ${name}, which the entrypoint binds`);
    }
  }

  /* The whole set, named, so a human deploying by hand can check it against
     what they are about to upload. */
  console.log("\n— the bundle, for whoever deploys it");
  const bundle = ["analyze/index.ts", ...imports.map(i =>
    path.relative(FN, path.resolve(path.dirname(ENTRY), i.spec)).split(path.sep).join("/"))];
  bundle.forEach(f => console.log("     " + f));
  ok(bundle.length === new Set(bundle).size, "no file is listed twice");
  ok(bundle.includes("analyze/index.ts"), "and the entrypoint is in it — a bundle without it is rejected");

  if (FAIL.length) {
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach(f => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nthe bundle is complete, parses, and exports what the entrypoint binds");
})();
