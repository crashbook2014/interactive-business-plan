/* The marketing page, checked against the product it describes.
 *
 * WHY THIS EXISTS. Two files describe Wodouh to a stranger: `index.html` with
 * `assets/landing.js`, and the app itself. Nothing held them to each other, and
 * they had come apart in the way that matters most.
 *
 * The landing page promised, of ANY of the three contract types it names, "the
 * clauses to watch and where each one sits in the law" and "what you're owed if
 * it ends". Measured against the app, neither half was true for a lease:
 * seventeen clause rules can fire on an employment contract and three on a
 * lease, `ruleInDomain()` strips every article number outside the employment
 * doors on purpose, and the end-of-service calculator is labour-only. The
 * register says the same thing about itself — thirty-five labour rows carry the
 * `verified` token and rental's three deliberately do not, so they stay out of
 * the corpus the ask path grades against.
 *
 * None of that is a flaw in the product. Employment is the spine and the
 * scoping is careful and deliberate. It was a flaw in the sentence.
 *
 * THE PRODUCT IS THE AUTHORITY, which is the rule `test/future.test.js` already
 * applies to the roadmap screen. Every assertion below derives its facts from
 * `app/index.html` and `docs/legal-sources.md` rather than from a list written
 * here, so a change to the product moves the bar rather than needing this file
 * edited to agree with it.
 */
const fs = require("node:fs");
const path = require("node:path");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const R = (...p) => path.join(__dirname, "..", ...p);
const app = fs.readFileSync(R("app", "index.html"), "utf8");
const page = fs.readFileSync(R("index.html"), "utf8");
const register = fs.readFileSync(R("docs", "legal-sources.md"), "utf8");

/* The copy object is a bare object literal with no dependencies, so it can be
   evaluated rather than pattern-matched — which means the assertions below read
   real strings and not whatever a regex made of them. Same slice trick
   test/copy-keys.test.js uses on the app. */
function copyOf(src, label){
  const start = src.indexOf("const T = {");
  const end = src.indexOf("\n};", start);
  ok(start >= 0 && end > start, `${label}: the copy dictionary is where this suite expects it`);
  if (start < 0 || end <= start) return {};
  // eslint-disable-next-line no-new-func
  return new Function("return " + src.slice(start + "const T = ".length, end + 2))();
}
const L = copyOf(fs.readFileSync(R("assets", "landing.js"), "utf8"), "landing");
const A = copyOf(app, "app");

const LANGS = ["ar", "en"];
/* FLATTENED, INCLUDING THE ARRAYS — which is the whole FAQ.
 *
 * The first version collected `v[l]` only where it was a string, so `faq`,
 * whose value per language is an array of [question, answer] pairs, produced
 * nothing. That made the suite blind to the single most claim-dense block on
 * the page: "Which contracts are supported?", "Does this replace a lawyer?",
 * "Where do you get your information?". Planting a fabricated supplier-contract
 * claim in the FAQ passed every assertion below.
 *
 * Anything string-shaped anywhere under a key is prose a reader can see, so
 * this walks the whole value rather than one expected shape. */
const strings = (v) =>
  typeof v === "string" ? [v]
  : Array.isArray(v) ? v.flatMap(strings)
  : v && typeof v === "object" ? Object.values(v).flatMap(strings)
  : [];
const all = (o) => Object.values(o).flatMap(strings);

/* ---------------------------------------------------------------- 1. shape */
console.log("— the marketing copy is well-formed in both languages");
/* Nothing checked this before. `st3` carried a stray `e:""` key beside its
   `en` — dead, harmless, and exactly the kind of thing that is invisible to
   the language, to the page and to anyone reading the line. */
const keys = Object.keys(L);
ok(keys.length > 50, `the landing dictionary was read (${keys.length} keys)`);
const badShape = keys.filter((k) => {
  const v = L[k];
  if (Array.isArray(v)) return false;              /* the FAQ tables are arrays */
  if (!v || typeof v !== "object") return true;
  const extra = Object.keys(v).filter((x) => !LANGS.includes(x));
  return !v.ar || !v.en || extra.length > 0;
});
ok(badShape.length === 0,
   `every key has exactly ar and en${badShape.length ? " — offending: " + badShape.join(", ") : ""}`);

/* ------------------------------------------------- 2. types have doors */
console.log("\n— every contract type the page names has a door in the app");
/* Derived from the app's own doc kinds, as test/future.test.js does for the
   roadmap. A fourth type added to the marketing page with nothing behind it
   fails here rather than at the first reader who clicks through. */
const KIND = {
  employment: { doc: "doc_emp",  en: /\bemployment\b/i,          ar: /عقود\s*(?:ال)?عمل|عقد\s*عمل/ },
  /* NOT «شبكة إيجار». Ejar is the government rental-registration platform and
     the page cites it as a SOURCE, in the same breath as the Ministry of
     Justice — a proper noun, not the contract type. Without this the sentence
     "official sources: the Labour Law, MHRSD, the Ejar network, the Ministry
     of Justice" reads as rental-in-the-same-sentence-as-a-law and fails §3,
     while its English twin ("the Ejar network") passes, because English names
     the institution and Arabic names it with the same word as the contract.
     The English side needs no such carve-out for the same reason. */
  rental:     { doc: "doc_rent", en: /\brental\b|\blease\b/i,
                ar: /(?<!(?:شبكة|منصة|بوابة|موقع)\s{0,2})(?:ال)?إيجار/ },
  freelance:  { doc: "doc_free", en: /\bfreelance\b/i,            ar: /عمل\s*حر/ },
  supplier:   { doc: "doc_supp", en: /\bsupplier\b/i,             ar: /(?:ال)?مورّ?د/ },
};
const prose = all(L).join("  ");
/* Counted, because every assertion in this file filters this string and a
   filter over an empty parse passes — which is exactly how the FAQ went
   unread. */
ok(all(L).length > 150 && prose.length > 8000,
   `the page's prose was collected (${all(L).length} strings, ${prose.length} chars)`);
const named = Object.keys(KIND).filter((k) => KIND[k].en.test(prose) || KIND[k].ar.test(prose));
ok(named.length >= 3, `the page names contract types at all (${named.join(", ") || "none"})`);
const orphan = named.filter((k) => !new RegExp(KIND[k].doc + "\\s*:").test(app));
ok(orphan.length === 0,
   `and each one exists as a real doc kind in the app${orphan.length ? " — no door for: " + orphan.join(", ") : ""}`);

/* ------------------------------------ 3. law is claimed only where verified */
console.log("\n— a type is called legally sourced only where the register is");
/* The register is the authority on what may carry an article number. Rental's
   three rows carry `founder-confirmed` precisely so they stay out of the graded
   corpus, and freelance has no rows at all — so a sentence that puts rental or
   freelance in the same breath as an article is a sentence the register cannot
   back. Counted first, because a filter over a failed parse passes. */
const rows = register.split("\n").filter((l) => /^\|/.test(l));
const verified = rows.filter((l) => /✅ verified/.test(l));
ok(rows.length > 30 && verified.length > 20,
   `the register was parsed (${rows.length} rows, ${verified.length} verified)`);
ok(!/إيجار|rental|lease/i.test(verified.join("\n")),
   "and no verified row is a rental row — which is why rental may not cite");

const LAW = /\barticle\b|\blabou?r law\b|مادة|مواد|نظام العمل/i;
const UNSOURCED = ["rental", "freelance"];
/* WALKED, NOT INDEXED — and this was wrong until it was broken on purpose.
 *
 * This loop used to read `v[l]` and `continue` unless it was a string. `faq`'s
 * value per language is an ARRAY of [question, answer] pairs, so every FAQ
 * answer was skipped: a planted "Your rental contract is checked against
 * Article 12 of the rental law" sat in the FAQ and this assertion printed ok.
 *
 * §2 above had already been fixed for exactly this and this was not, because
 * §2 flattens with `strings()` and §2 is the assertion that got broken when
 * the blindness was first found. Fixing the one that was tested and leaving
 * the one that was not is how a suite ends up guarding its own reputation
 * instead of the product. It now walks every string under every key, carrying
 * the path so a failure names where to look. */
const walk = (v, at) =>
  typeof v === "string" ? [[at, v]]
  : Array.isArray(v) ? v.flatMap((x, i) => walk(x, `${at}[${i}]`))
  : v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => walk(x, `${at}.${k}`))
  : [];
const sentences = Object.entries(L).flatMap(([k, v]) => walk(v, k));
ok(sentences.length > 200, `every string was reached, arrays included (${sentences.length})`);
const claims = [];
for (const [at, s] of sentences) {
  /* Sentence by sentence: a paragraph may legitimately mention employment's
     articles AND rental's absence of them, and judging the paragraph whole
     would fail the one string that is doing this correctly. */
  for (const sent of s.split(/[.؟?!।]|؟/)) {
    if (!LAW.test(sent)) continue;
    const hits = UNSOURCED.filter((u) => KIND[u].en.test(sent) || KIND[u].ar.test(sent));
    /* A sentence that says rental has NO articles is the point, not a
       violation. The negation is what this whole suite is protecting. */
    const denies = /بدون|لا\s|ليست|ما\s+عندنا|ما\s+تحققنا|without|not\s|no\s+article|only\b/i.test(sent);
    if (hits.length && !denies) claims.push(`${at}: "${sent.trim().slice(0, 90)}"`);
  }
}
ok(claims.length === 0,
   `no string ties rental or freelance to an article number${claims.length ? " — " + claims.join(" | ") : ""}`);

/* ------------------------- 4. the caveat is kept where it changes a decision */
console.log("\n— the app still states the rental caveat where a reader is holding a lease");
/* THIS USED TO REQUIRE THE CAVEAT ON THE LANDING PAGE TOO, and no longer does.
   A positioning band is where a stranger meets the product; the third thing it
   says about itself should not be what it cannot do, and the founder's call was
   that the apology belonged out of the marketing copy. Removed deliberately —
   not lost, not loosened by accident.

   What the removal MUST NOT take with it is the caveat itself, which is still
   load-bearing in the two places a reader is actually looking at a lease: the
   roadmap screen (fu_cat_rent_d) and the line under the score (scope_rent,
   driven by docDomain()). Those are asserted here so that dropping the
   marketing sentence cannot quietly become dropping all of them. Claims, not
   wording, so either can be rewritten but neither can become the broader one.

   The marketing side is not unguarded: §3 above still refuses any sentence
   that ties rental or freelance to an article number, which is the half of
   the original claim the first click would expose. */
const appRental = (A.fu_cat_rent_d || {}).ar || "";
const appScope = (A.scope_rent || {}).ar || "";
ok(appRental.length > 40 && appScope.length > 20,
   `both in-app sentences were found (roadmap ${appRental.length}, result ${appScope.length} chars)`);
const CLAIMS = {
  "reads the contract itself": /نص عقدك|عقدك نفسه|قراءة لنص|نص العقد/,
  "no article numbers behind it": /بدون مواد|ولا مواد|ما تحققنا|بلا مواد/,
};
for (const [what, re] of Object.entries(CLAIMS)) {
  ok(re.test(appRental + "  " + appScope),
     `the app tells a lease reader: ${what}`);
}

/* ------------------------- 4b. business is claimed at the tense it is built */
console.log("\n— the business card is marked a preview for as long as it is one");
/* The positioning line now says "for individuals and businesses", and the
   feature grid has a "Wodouh for Business" card describing team seats, redline
   review and template scoring. All of that markup exists — and renderBiz()
   fills it from a hardcoded BIZ object, and the screen carries `pw_demo`,
   "prototype — no real payment happens".

   So the rule is conditional on the product, not written down here: WHILE the
   business workspace still carries its demo disclaimer, the marketing card for
   it must be marked as a preview in both languages. Build the thing for real,
   delete the disclaimer, and this assertion stops applying on its own — which
   is the only kind of claim guard that does not go stale. */
const bizScreen = (app.match(/id="screen-biz"[\s\S]*?<\/section>/) || [""])[0];
ok(bizScreen.length > 200, `the business workspace markup was found (${bizScreen.length} chars)`);
const bizIsDemo = /data-t="pw_demo"/.test(bizScreen);
if (bizIsDemo) {
  const PREVIEW = { ar: /معاينة|نموذج|قريبًا|الاتجاه/, en: /\bpreview\b|\bheading\b|\bcoming\b|\bplanned\b/i };
  for (const l of LANGS) {
    const said = ((L.f6_tag || {})[l] || "") + "  " + ((L.f6p || {})[l] || "");
    ok(PREVIEW[l].test(said),
       `${l}: the business card says it is a preview, because the workspace still says pw_demo`);
  }
} else {
  ok(true, "the workspace no longer carries pw_demo — the preview wording is free to go");
}

/* ------------------------------------- 5. the hero mock is the real screen */
console.log("\n— the hero mock shows the product that exists");
/* A mock is a promise the first click either keeps or exposes. The result
   screen has stated each flag's severity in WORDS since colour stopped being
   allowed to carry it alone; a mock without them is a picture of a product
   that no longer ships. Verbatim against the app's own strings, because "close
   enough" is how two copies of one sentence start disagreeing. */
for (const [shot, act] of [["shot_s1", "act_red"], ["shot_s2", "act_amber"], ["shot_s3", "act_green"]]) {
  for (const l of LANGS) {
    const a = (L[shot] || {})[l], b = (A[act] || {})[l];
    ok(!!a && a === b, `${l}: ${shot} is the app's ${act} verbatim ("${a}" vs "${b}")`);
  }
}
/* And the markup actually renders them, rather than the keys sitting unused. */
for (const k of ["shot_s1", "shot_s2", "shot_s3"]) {
  ok(new RegExp(`data-t="${k}"`).test(page), `${k} is on the page, not just in the dictionary`);
}

console.log("\n" + (FAIL.length
  ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
  : "the marketing page claims only what the product and the register can back"));
process.exit(FAIL.length ? 1 : 0);
