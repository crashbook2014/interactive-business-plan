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
  /* 5.0, not 4.5, and this is a ratchet rather than an aspiration: the shipped
     values are 5.20 on the page and 6.16 on a card in light, 7.86 and 6.13 in
     dark. Asserting 4.5 against a palette that already clears 5 left three
     quarters of a step of room for someone to lighten secondary text without
     the suite noticing. The bar is set where the product actually is. */
  ["ink-2",     "sand", 5.0, "secondary text on the page"],
  ["ink-2",     "card", 5.0, "secondary text on a card"],
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

/* ---- THE FADE THE TOKENS COULD NOT SEE.
 *
 * Everything above measures TOKENS, and a token is not what reaches the
 * reader's eye. Thirteen rules in this stylesheet set a colour and then dimmed
 * it further with `opacity`, and because opacity is not a hex value the whole
 * suite above ran green over every one of them:
 *
 *   .primary.soft            .6   →  2.84  the analyze button, deliberately LIVE
 *   .pcard li.off            .65  →  2.87  a feature not in this plan
 *   textarea::placeholder    .7   →  3.15  the instruction on the main input
 *   .src-line.method         .8   →  3.48  how the score was arrived at
 *   .demoted                 .62  →  3.71  a de-emphasised next step
 *   .plan.soon               .62  →  3.98  a plan not yet on sale
 *   .hm-up .tx span          .86  →  4.16  the upload row's own subtitle
 *   .dc-conf, .legal-id, .fld em, .scan-lock .scan-left, .home-plans
 *                            .85  →  4.37
 *   .src-line.law::before    .75  →  4.86  (the one that was already passing)
 *
 * All but the last are below AA, several at 12 or 13px, and one of them is a
 * primary call to action. They were not sloppiness — each was someone reaching
 * for "quieter" and finding the only dial that was to hand.
 *
 * So the dial gets a guard. This composites the declared opacity against the
 * surface underneath and asserts the EFFECTIVE ratio, which is the number the
 * reader actually gets. Without it the same thing returns the next time
 * anything needs to look secondary.
 *
 * WHAT IS EXEMPT, and why each is a real exemption rather than a hole:
 *   - :disabled — WCAG 1.4.3 exempts inactive controls by name.
 *   - :active and .busy — held for a few hundred milliseconds under the
 *     reader's own finger.
 *   - keyframe steps — a frame is not a state.
 *   - rules with no text: the ring bezel, the loading skeletons, the
 *     decorative artwork, an SVG mark.
 * Anything else that dims text has to clear the bar.
 */
{
  console.log("\n— text that is dimmed with opacity, measured as the reader sees it");
  const mix = (fg, bg, o) => {
    const p = (h, i) => parseInt(h.replace("#", "").slice(i, i + 2), 16);
    return "#" + [0, 2, 4]
      .map((i) => Math.round(o * p(fg, i) + (1 - o) * p(bg, i)))
      .map((x) => x.toString(16).padStart(2, "0")).join("");
  };
  /* Which surface a rule sits on cannot be read off the rule itself, so the
     worst of the two is used. Being wrong in the strict direction costs a
     false failure someone must look at; being wrong the other way costs a
     reader who cannot read the text. */
  const SURFACES = ["sand", "card"];
  /* Selectors whose dimming is not a contrast question. Matched on the
     SELECTOR, so adding one is a visible, arguable line in a diff. */
  const EXEMPT = [
    /:disabled\b/, /:active\b/, /\.busy\b/,
    /^\d|^from$|^to$|%$/,                     /* keyframe steps */
    /\.ob-art::before$/, /\.ring circle\.bezel$/, /\.nr-mark$/,
    /\.skel-ring$/, /^\.sk$/, /\.doc \.box svg$/,
  ];
  const scanned = [], checked = [], bad = [];
  const RULE = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = RULE.exec(app))) {
    /* The capture runs back to the previous `}`, so it picks up any comment
       sitting above the rule — and these comments are long. Strip them, or a
       failure message arrives with three paragraphs of prose inside the
       selector and is unreadable exactly when it is needed. */
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\s+/g, " ");
    const body = m[2];
    const op = body.match(/(?:^|;)\s*opacity:\s*([0-9.]+)/);
    if (!op || !sel) continue;
    const o = Number(op[1]);
    if (!(o > 0 && o < 1)) continue;
    scanned.push(sel);
    if (EXEMPT.some((re) => re.test(sel))) continue;
    checked.push(sel);
    for (const [theme, tok] of Object.entries(themes)) {
      /* The colour on the rule if it names one; otherwise the token this app
         uses for anything secondary, which is what an inheriting rule almost
         always lands on. */
      const named = (body.match(/(?:^|;)\s*color:\s*var\(--([a-z0-9-]+)\)/) || [])[1];
      const fg = tok[named] || tok["ink-2"];
      if (!fg) continue;
      for (const surf of SURFACES) {
        if (!tok[surf]) continue;
        const r = ratio(mix(fg, tok[surf], o), tok[surf]);
        if (r < 4.5) bad.push(`${sel} @${o} on ${surf} (${theme.split(" ")[0]}) = ${r.toFixed(2)}`);
      }
    }
  }
  /* SCANNED, not checked. Every assertion below is a filter, and a filter over
     an empty list passes — so what is counted is what the PARSER found, before
     any exemption. If the regex stops matching, this says so instead of the
     suite reporting success over nothing. It is deliberately not `checked > 0`:
     the correct state of this codebase is that nothing dims text any more, and
     a guard that demands a violation exist would fail the day the last one is
     fixed. */
  ok(scanned.length > 0,
     `the stylesheet was parsed for dimmed rules at all (${scanned.length} found, ${checked.length} not exempt)`);
  console.log(`         exempt: ${scanned.filter((x) => !checked.includes(x)).join(", ")}`);
  ok(bad.length === 0,
     `and nothing that dims text falls below AA once the fade is composited${bad.length ? " — " + bad.join("; ") : ""}`);
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
