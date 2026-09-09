/* The palette's contrast, computed from the shipped tokens.
 *
 * Before this suite the app's ratios were good BY ACCIDENT OF CARE. Every text
 * pair cleared AA, and nothing whatsoever protected that: a designer nudging
 * --sand half a step warmer would have shipped a regression that no test, no
 * reviewer and no screenshot would have caught, because a 4.4:1 body text
 * looks exactly like a 4.6:1 one to anyone whose eyes work.
 *
 * It also pins the two defects that were actually found and fixed:
 *
 *   - --card against --sand measured 1.08:1, so a card was invisible against
 *     the page and structure was carried entirely by spacing and shadow.
 *   - --amber measured 2.45:1, under the 3:1 that WCAG 1.4.11 requires of a
 *     colour that carries meaning — and amber is the MODAL verdict in this
 *     product. The state a low-vision reader could least distinguish was the
 *     one they would meet most often.
 *
 * Read from the source rather than from a copied table, in BOTH themes, and in
 * every file that carries the palette — the app, the landing page, the legal
 * pages, the admin console and the brand page all declare it separately, and a
 * palette that drifts between them is the same bug as a palette that is wrong.
 */
const fs = require("node:fs");
const path = require("node:path");
const R = (...p) => path.join(__dirname, "..", ...p);
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* WCAG 2.x relative luminance and contrast ratio. */
const lin = (c) => (c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
function lum(hex){
  const h = hex.replace("#", "");
  const v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]);
}
function ratio(a, b){
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/* Pull every :root block out of a stylesheet with its body, and say which
   theme it belongs to. Four shapes carry the palette in this codebase: the
   base :root, the @media (prefers-color-scheme: dark) override, and the two
   explicit :root[data-theme="…"] blocks the manual switch uses. Reading them
   as one flat stream would let the last one win and quietly hide the other
   three — which is exactly the bug this suite was written with. */
const DARK = "@media (prefers-color-scheme: dark)";
function balancedEnd(src, openBrace){
  let i = openBrace + 1, depth = 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
    i++;
  }
  return i;
}
function rootBlocks(src){
  /* Where the dark media query starts and stops, so a block's theme is decided
     by where it actually sits rather than by guessing from the text before it. */
  const darkRanges = [];
  let at = -1;
  while ((at = src.indexOf(DARK, at + 1)) >= 0) {
    const brace = src.indexOf("{", at);
    if (brace >= 0) darkRanges.push([brace, balancedEnd(src, brace)]);
  }
  const inDark = (i) => darkRanges.some(([a, b]) => i > a && i < b);

  const out = [];
  const re = /:root([^{]*)\{/g;
  let m;
  while ((m = re.exec(src))) {
    const end = balancedEnd(src, re.lastIndex - 1);
    /* :not(...) is a guard, not a claim about this block's theme —
       :root:not([data-theme="light"]) IS the dark block. */
    const sel = m[1].replace(/:not\([^)]*\)/g, "");
    const dark = /data-theme=.dark./.test(sel) ||
      (!/data-theme=.light./.test(sel) && inDark(m.index));
    const tok = {};
    const t = /--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g;
    const body = src.slice(m.index, end);
    let k;
    while ((k = t.exec(body))) tok[k[1]] = k[2];
    if (Object.keys(tok).length) out.push({ sel: (m[1].trim() || ":root"), dark, tok });
  }
  return out;
}

/* The palette lives in app/app.css since the stylesheet was split out of the
   HTML. Reading index.html still "worked" after that move: rootBlocks() found
   nothing, themes came out empty, and every AA assertion below ran zero times
   and reported success. A suite that measures nothing is worse than no suite,
   so the block count is asserted before anything is measured. */
const app = ["app.css", "desktop.css"]
  .map((f) => fs.readFileSync(R("app", f), "utf8")).join("\n");
const blocks = rootBlocks(app);
const base = { light: {}, dark: {} };
for (const b of blocks) Object.assign(base[b.dark ? "dark" : "light"], b.tok);
/* An override block declares only what it changes, so each is measured on top
   of its own theme's base rather than on its own — a block that redefines
   --sand alone still has to clear AA against the --ink it inherits. */
ok(blocks.length >= 2,
   `the palette was found at all — ${blocks.length} :root blocks (0 means this suite is measuring nothing)`);
const themes = {};
for (const b of blocks) {
  themes[`${b.dark ? "dark" : "light"} ${b.sel}`] =
    Object.assign({}, base[b.dark ? "dark" : "light"], b.tok);
}

/* WHAT EACH PAIR HAS TO CLEAR, and why.
   4.5 — WCAG 1.4.3, text.
   3.0 — WCAG 1.4.11, a colour that carries meaning without words: the score
         ring, the status dots, the flag stripes.
   1.15 — not a WCAG number. It is the floor below which a card stops being a
         surface, established by measuring the version that failed (1.08). */
const RULES = [
  ["ink",       "sand", 4.5, "body text on the page"],
  ["ink",       "card", 4.5, "body text on a card"],
  ["ink-2",     "sand", 4.5, "secondary text on the page"],
  ["ink-2",     "card", 4.5, "secondary text on a card"],
  ["teal",      "sand", 4.5, "the accent as text on the page"],
  ["teal",      "card", 4.5, "the accent as text on a card"],
  ["teal-ink",  "sand", 4.5, "the deep accent on the page"],
  ["on-teal",   "teal", 4.5, "text on a teal button"],
  ["amber-ink", "amber-bg", 4.5, "the negotiate label on its own tint"],
  ["green-ink", "green-bg", 4.5, "the clear label on its own tint"],
  ["red-ink",   "red-bg",   4.5, "the red-flag label on its own tint"],
  ["amber",     "sand", 3.0, "AMBER AS A SIGNAL — the modal verdict"],
  ["amber",     "card", 3.0, "amber as a signal, on a card"],
  ["green",     "sand", 3.0, "green as a signal"],
  ["red",       "sand", 3.0, "red as a signal"],
  ["card",      "sand", 1.15, "A CARD MUST BE VISIBLE against the page"],
  ["line",      "sand", 1.6,  "a hairline must be a line, on the page"],
  ["line",      "card", 1.6,  "a hairline must be a line, on a card"]
];

for (const [name, tok] of Object.entries(themes)) {
  console.log(`\n— ${name} theme`);
  for (const [a, b, min, why] of RULES) {
    if (!tok[a] || !tok[b]) { ok(false, `${name}: --${a} or --${b} is missing`); continue; }
    const r = ratio(tok[a], tok[b]);
    ok(r >= min, `${name}: ${why} — ${tok[a]} on ${tok[b]} is ${r.toFixed(2)}:1 (needs ${min})`);
  }
}

/* ---- one palette, five files. The app is the authority; the rest must match.
   Only the tokens both files declare are compared, so a surface is free to
   carry fewer of them — it is not free to carry a different value. */
console.log("\n— every surface carries the same palette");
const OTHERS = [
  ["the landing page", "index.html"],
  ["the legal pages",  path.join("legal", "legal.css")],
  ["the admin console", path.join("admin", "index.html")],
  ["the brand page",   path.join("brand", "index.html")]
];
const SKIP = new Set(["page", "chrome", "line-2"]);   /* surface-local by design */
for (const [label, rel] of OTHERS) {
  const file = R(rel);
  if (!fs.existsSync(file)) { ok(false, `${label}: ${rel} is missing`); continue; }
  const src = fs.readFileSync(file, "utf8");
  const theirs = {};
  for (const b of rootBlocks(src)) if (!b.dark) Object.assign(theirs, b.tok);
  const drift = Object.keys(theirs)
    .filter((k) => !SKIP.has(k) && base.light[k] && base.light[k].toUpperCase() !== theirs[k].toUpperCase())
    .map((k) => `--${k} ${theirs[k]} ≠ ${base.light[k]}`);
  ok(drift.length === 0, `${label}: matches the app (${drift.join("; ") || "no drift"})`);
}

if (FAIL.length) {
  console.log(`\n${FAIL.length} FAILURES`);
  FAIL.forEach((f) => console.log("  - " + f));
  process.exit(1);
}
console.log("\nthe palette clears AA for text and 3:1 for every colour that carries meaning");
