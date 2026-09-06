/* Nine type sizes, and only nine.
 *
 * The app had twenty-five, from 10px up. Not a scale — an accumulation: 12px
 * and 12.5px both existed, 13px and 13.5px both existed, and the difference
 * between a label and a heading was sometimes half a pixel. A reader cannot
 * use a distinction they cannot see, so twenty-five sizes bought no hierarchy;
 * they only made the dense screens harder to scan.
 *
 * The point of this suite is not the number nine. It is that adding a size is
 * now a decision someone has to make on purpose, in a diff, with a reason —
 * rather than the default outcome of nudging a heading until it looked right
 * on the one screen the author happened to be on.
 *
 * If a new size is genuinely needed, add it here in the same commit and say
 * why. That is the whole cost, and it is the right cost.
 */
const fs = require("node:fs");
const path = require("node:path");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const SCALE = [10.5, 12, 13, 14, 15, 16.5, 19, 24, 36];

const src = fs.readFileSync(path.join(__dirname, "..", "app", "index.html"), "utf8");
const found = new Map();
for (const m of src.matchAll(/font-size:\s*([0-9.]+)px/g)) {
  const v = Number(m[1]);
  found.set(v, (found.get(v) || 0) + 1);
}

console.log("— the sizes actually declared in the shipped app");
const sizes = [...found.keys()].sort((a, b) => a - b);
for (const s of sizes) console.log(`  ${String(s).padStart(5)}px  ×${found.get(s)}`);

const off = sizes.filter((s) => !SCALE.includes(s));
ok(off.length === 0,
   `every size is on the scale (${off.length ? "off-scale: " + off.join(", ") + "px" : SCALE.join(" · ")})`);
ok(sizes.length <= SCALE.length,
   `nine steps or fewer (${sizes.length})`);

/* Below 12px is allowed only where small is a decision rather than a habit.
   Two justifications count, and nothing else:

     - a LETTERSPACED MICRO LABEL — uppercase Latin at .2em tracking, which is
       a texture rather than a sentence and is read as a mark;
     - the TAB LABEL, which has five columns on a 360px phone to live in and
       must not wrap, and whose meaning is carried by an icon beside it.

   "It is a badge" is deliberately NOT on the list. The قريبًا badge in a
   disabled sign-in button is the single most important word on that control —
   it is the difference between "broken" and "not yet" — and it was set at
   10.5px. Every badge in the app now sets at 12px for that reason. */
console.log("\n— nothing is small by accident");
const ALLOWED_SMALL = [".tab span"];
const tiny = [...src.matchAll(/([^{}]*)\{([^{}]*font-size:\s*(?:10|10\.5|11)px[^{}]*)\}/g)];
ok(tiny.length > 0, "the small sizes are still findable, so this check is live");
for (const [, sel, body] of tiny) {
  const name = sel.trim().split("\n").pop().trim();
  const why = /letter-spacing/.test(body) ? "letterspaced label"
            : ALLOWED_SMALL.some((a) => name.endsWith(a)) ? "the tab-bar label, which has five columns to live in"
            : null;
  ok(!!why, `${name} — small on purpose (${why || "NO JUSTIFICATION"})`);
}

if (FAIL.length) {
  console.log(`\n${FAIL.length} FAILURES`);
  FAIL.forEach((f) => console.log("  - " + f));
  process.exit(1);
}
console.log("\nthe type scale is nine steps and adding a tenth takes a decision");
