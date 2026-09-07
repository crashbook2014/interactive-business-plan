/* The copy dictionary, checked for the mistakes it cannot report itself.
 *
 * THE BUG THIS EXISTS FOR. `ph_title` was declared twice in T — once for the
 * phone-number screen ("Your number? Completely optional") and once, 60 lines
 * later, for the photo screen ("Photograph the contract"). A duplicate key in
 * a JavaScript object literal is not an error. The second one silently wins.
 *
 * So the screen that asks a stranger for their personal mobile number — the
 * screen in this entire product where trust is thinnest and the consent
 * language matters most — was headed "Photograph the contract", in both
 * languages, in the shipped build. Nothing failed. No test caught it, because
 * every test asserted the heading was non-empty and it was.
 *
 * That is the whole class: a key collision is invisible to the language, to
 * the tests, and to anyone reading either declaration on its own. It is only
 * visible from above, which is what this file is.
 *
 * The second check is the same shape: a key present in one language but not
 * the other renders as a blank where a sentence should be, and looks like a
 * layout bug rather than a missing translation.
 */
const fs = require("node:fs");
const path = require("node:path");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const src = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");

/* The T dictionary only. LETTER_TO and the other small tables legitimately
   reuse names like doc_emp, because they are separate objects — a collision
   only matters inside one. */
const start = src.indexOf("const T = {");
const end = src.indexOf("\n};", start);
ok(start > 0 && end > start, "the copy dictionary is where this suite expects it");
const T = src.slice(start, end);

console.log("\n— no key is declared twice");
const seen = new Map();
for (const m of T.matchAll(/^ {2}([a-z0-9_]+)\s*:\s*\{/gm)) {
  const line = T.slice(0, m.index).split("\n").length;
  seen.set(m[1], [...(seen.get(m[1]) || []), line]);
}
const dupes = [...seen.entries()].filter(([, at]) => at.length > 1);
ok(dupes.length === 0,
   `every copy key is unique (${dupes.length
     ? dupes.map(([k, at]) => `${k} at ${at.join(" and ")}`).join("; ")
     : seen.size + " keys"})`);

/* THE CHECK THAT IS NOT HERE, and why.
   "Is every key still read by something?" cannot be answered honestly by
   static analysis of this file. Keys are assembled at runtime all over it —
   t("dc_" + decision), t("tm_l_open_" + tone), and the four-way Arabic plural
   tables (_1, _2, _p, _m) picked by number. A first attempt flagged 120 live
   keys as orphans. A suite that cries wolf at that scale gets its exclusion
   list padded until it asserts nothing, which is worse than not having it. */

console.log("\n— every key reads in both languages");
/* Brace-counting rather than a regex, because the copy is full of {n}
   placeholders whose closing brace ends a naive match halfway through the
   value — which is exactly what made the first version of this check report
   sixty bilingual keys as monolingual. Quotes are tracked so a brace inside
   a string is not counted as structure. */
function valueOf(src, at){
  let i = src.indexOf("{", at), depth = 0, q = null;
  const from = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(from, i + 1);
  }
  return "";
}
const oneLang = [];
for (const m of T.matchAll(/^ {2}([a-z0-9_]+)\s*:\s*\{/gm)) {
  const v = valueOf(T, m.index);
  if (!/[{,]\s*ar\s*:/.test(v) || !/[{,]\s*en\s*:/.test(v)) oneLang.push(m[1]);
}
ok(oneLang.length === 0,
   `no key renders blank for half the readers (${oneLang.join(", ") || seen.size + " keys, both languages"})`);

if (FAIL.length) {
  console.log(`\n${FAIL.length} FAILURES`);
  FAIL.forEach((f) => console.log("  - " + f));
  process.exit(1);
}
console.log("\nthe copy dictionary has no collisions and no half-translations");
