/* The public answer pages, checked against the register they came from.
 *
 * These 62 pages are the first thing a stranger will read about Wodouh, and
 * they make legal claims with article numbers attached. Nobody writes them —
 * tools/make-seo.mjs generates them from docs/legal-sources.md — and this suite
 * is what makes "generated" mean something:
 *
 *   - the committed pages ARE what the register generates today, byte for byte,
 *     so a claim cannot be edited on the page and left true nowhere else
 *   - a page states only article numbers its own row holds — its citation, or
 *     one its own claim text cross-references — and a row with no article
 *     number produces a page with no article number anywhere
 *   - the JSON-LD answer is the same string the page renders, so the copy
 *     machines read cannot say something the copy humans read does not
 *   - hreflang is reciprocal in both directions and both pages are in the
 *     sitemap; a one-way alternate is a claim search engines act on
 *   - the Arabic pages render right-to-left in a browser, not merely carry the
 *     attribute
 *
 * Mostly files, so it is fast. The last section needs a browser, because
 * `dir="rtl"` in the source is a request and the computed direction is the
 * answer.
 */
const { readFileSync, existsSync, readdirSync } = require("node:fs");
const path = require("node:path");
const { playwright, launchOpts, BASE } = require("./_env.js");
const { chromium } = playwright();

const ROOT = path.join(__dirname, "..");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const read = p => readFileSync(path.join(ROOT, p), "utf8");
const attr = (html, re) => { const m = html.match(re); return m ? m[1] : null; };

(async () => {
  const { build } = await import("../tools/make-seo.mjs");
  const register = read("docs/legal-sources.md");
  const out = build(register);

  /* ---- 1. the pages ARE the register, or the build fails */
  console.log("\n— the pages cannot drift from the register");

  let drifted = 0, missing = 0;
  for (const f of out.files){
    const p = path.join(f.path, "index.html").replace(/^\//, "");
    if (!existsSync(path.join(ROOT, p))){ missing++; continue; }
    if (read(p) !== f.html) drifted++;
  }
  ok(missing === 0, `every generated page exists on disk (${missing} missing)`
     + (missing ? " — run: node tools/make-seo.mjs" : ""));
  ok(drifted === 0, `every committed page matches what the register generates today (${drifted} differ)`
     + (drifted ? " — run: node tools/make-seo.mjs" : ""));
  ok(read("sitemap.xml") === out.sitemap,
     "the committed sitemap matches what the register generates today"
     + (read("sitemap.xml") === out.sitemap ? "" : " — run: node tools/make-seo.mjs"));
  ok(read("answers/answers.css") === read("tools/answers.css"),
     "the published stylesheet matches its source in tools/");

  /* A page for a row that no longer exists would keep answering a URL the
     register no longer stands behind. The generator deletes the directory
     first; this proves nothing was left behind by hand. */
  const onDisk = readdirSync(path.join(ROOT, "answers"), { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== "ar").map(d => d.name);
  const slugs = new Set(out.rows.map(r => r.slug));
  const orphans = onDisk.filter(d => !slugs.has(d));
  ok(orphans.length === 0, `no page survives a row leaving the register (${orphans.join(", ") || "none"})`);
  ok(out.files.length === out.rows.length * 2 + 4,
     `${out.rows.length} verified rows produced ${out.files.length} pages (two each, plus two indexes and two "how we verify")`);
  ok(out.excluded > 0,
     `the register still excludes rows rather than ticking everything (${out.excluded} excluded, and neither has a page)`);

  /* ---- 2. no page states an article number its row does not hold */
  console.log("\n— an article number appears only where the register put one");

  const rowFor = new Map();
  for (const r of out.rows){
    rowFor.set(`/answers/${r.slug}/`, { row: r, lang: "en" });
    rowFor.set(`/answers/${r.slug}/ar/`, { row: r, lang: "ar" });
  }

  let numberBugs = 0, silentRows = 0, citedRows = 0;
  for (const f of out.files){
    const hit = rowFor.get(f.path);
    if (!hit) continue;
    /* Everything the page presents AS an article number, in either language.
       Digits inside a claim ("21 days", "12 months") are not matched: the
       pattern requires the word that turns a number into a citation. */
    const found = new Set([
      ...[...f.html.matchAll(/Article\s+(\d+)/g)].map(m => m[1]),
      ...[...f.html.matchAll(/art\.\s*(\d+)/g)].map(m => m[1]),
      ...[...f.html.matchAll(/المادة\s+(\d+)/g)].map(m => m[1])
    ]);
    /* What the ROW is allowed to put on the page: its own article, plus any
       article its own claim cross-references. Several claims genuinely do —
       the notice rule names art. 37 to explain who it does not reach — and
       that number was written by the same human who verified the row. What is
       forbidden is a number the generator produced, which is the failure this
       is here to catch. */
    const own = hit.row.cite ? hit.row.cite.slug.replace(/\D+/g, "") : null;
    const claimText = hit.row.claim + " " + hit.row.claim_ar;
    const allowed = new Set([
      ...(own ? [own] : []),
      ...[...claimText.matchAll(/(?:Article|art\.|المادة)\s*(\d+)/gi)].map(m => m[1])
    ]);
    if (!own){
      if (found.size > allowed.size || [...found].some(n => !allowed.has(n))){
        numberBugs++;
        console.log(`       ${f.path} states ${[...found]} and its row cites none of them`);
      } else silentRows++;
    } else {
      citedRows++;
      const wrong = [...found].filter(n => !allowed.has(n));
      if (wrong.length || !found.has(own)){
        numberBugs++;
        console.log(`       ${f.path} may cite ${[...allowed]}, found ${[...found].join(",") || "none"}`);
      }
    }
  }
  ok(numberBugs === 0, `no page cites an article its row does not hold (${numberBugs} bad pages)`);
  ok(silentRows > 0, `rows with no article number produce pages with none (${silentRows} pages, silent by construction)`);
  ok(citedRows > 0, `rows with an article number carry it (${citedRows} pages)`);

  /* ---- 3. the machine-readable answer is the human-readable one */
  console.log("\n— the structured data says exactly what the page says");

  let ldBad = 0, ldSeen = 0;
  for (const f of out.files){
    const hit = rowFor.get(f.path);
    if (!hit) continue;
    const raw = attr(f.html, /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
    if (!raw){ ldBad++; continue; }
    let ld;
    try { ld = JSON.parse(raw); } catch(e){ ldBad++; console.log(`       ${f.path} JSON-LD does not parse: ${e.message}`); continue; }
    const answer = ld.mainEntity?.[0]?.acceptedAnswer?.text;
    const claim = hit.lang === "ar" ? hit.row.claim_ar : hit.row.claim;
    const rendered = attr(f.html, /<div class="key">\s*<p>([\s\S]*?)<\/p>/);
    if (answer !== claim || rendered !== claim.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")){
      ldBad++; console.log(`       ${f.path} structured answer and rendered answer disagree`);
    } else ldSeen++;
    if (ld.inLanguage !== hit.lang){ ldBad++; console.log(`       ${f.path} declares inLanguage ${ld.inLanguage}`); }
  }
  ok(ldBad === 0, `every answer page's JSON-LD parses and matches its rendered claim (${ldBad} bad)`);
  ok(ldSeen === out.rows.length * 2, `all ${ldSeen} answer pages carry structured data`);

  /* ---- 4. hreflang, reciprocal or not at all */
  console.log("\n— hreflang is a claim we can honour");

  const origin = "https://" + read("CNAME").trim();
  const byPath = new Map(out.files.map(f => [f.path, f]));
  const sm = out.sitemap;
  const locs = new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));

  let hrefBugs = 0;
  for (const f of out.files){
    const en = attr(f.html, /hreflang="en" href="([^"]+)"/);
    const ar = attr(f.html, /hreflang="ar" href="([^"]+)"/);
    const xd = attr(f.html, /hreflang="x-default" href="([^"]+)"/);
    const self = attr(f.html, /rel="canonical" href="([^"]+)"/);
    const mine = origin + f.path;
    const pair = self === en ? ar : en;
    const problems = [];
    if (self !== mine) problems.push("canonical is not its own URL");
    if (!en || !ar) problems.push("an alternate is missing");
    if (xd !== en) problems.push("x-default is not the English page");
    if (![en, ar].includes(mine)) problems.push("it is not among its own alternates");
    /* Reciprocity, not merely presence: follow the alternate and check that the
       page at the other end points back here. */
    const other = byPath.get(pair ? pair.replace(origin, "") : "");
    if (!other) problems.push("its alternate is not a page we generated");
    else if (!other.html.includes(`href="${mine}"`)) problems.push("its alternate does not point back");
    if (!locs.has(mine)) problems.push("it is not in the sitemap");
    if (pair && !locs.has(pair)) problems.push("its alternate is not in the sitemap");
    if (problems.length){ hrefBugs++; console.log(`       ${f.path}: ${problems.join("; ")}`); }
  }
  ok(hrefBugs === 0, `every page's alternates are reciprocal and both ends are in the sitemap (${hrefBugs} bad)`);

  /* The five older URLs deliberately declare NO alternates — they serve both
     languages from one URL. If that ever changes silently, the sitemap starts
     making a claim the pages cannot honour. */
  const SINGLE_URL = ["/", "/app/", "/privacy/", "/terms/", "/refund/"].map(u => `<loc>${origin + u}</loc>`);
  const staticBlock = sm.split("<url>").filter(b => SINGLE_URL.some(u => b.includes(u)));
  ok(staticBlock.length === 5, `the five single-URL pages are still listed (${staticBlock.length})`);
  ok(staticBlock.every(b => !/hreflang/.test(b)),
     "none of them declares hreflang, because one URL serves both languages there");

  /* ---- 5. the sources are the register's sources */
  console.log("\n— every link on a page came out of its own row");

  let linkBugs = 0, links = 0;
  for (const f of out.files){
    const hit = rowFor.get(f.path);
    if (!hit) continue;
    for (const m of f.html.matchAll(/<li><a href="([^"]+)" rel="nofollow noopener">/g)){
      links++;
      const href = m[1].replace(/&amp;/g, "&");
      if (!/^https:\/\//.test(href)){ linkBugs++; console.log(`       ${f.path} links ${href}`); continue; }
      if (!hit.row.sourcesCell.includes(href)){ linkBugs++; console.log(`       ${f.path} links ${href}, not in its row`); }
    }
  }
  ok(linkBugs === 0, `every source link is https and present in its own register row (${links} links, ${linkBugs} bad)`);
  ok(links >= out.rows.length * 2, `every page carries at least one source (${links} links across ${out.rows.length * 2} pages)`);

  /* ---- 6. these pages run no code */
  console.log("\n— nothing on these pages executes");

  let scripts = 0;
  for (const f of out.files){
    for (const m of f.html.matchAll(/<script([^>]*)>/g)){
      if (!/type="application\/ld\+json"/.test(m[1])) scripts++;
    }
    if (!/Content-Security-Policy/.test(f.html)) scripts++;
  }
  ok(scripts === 0, `no page carries an executable script, and every page carries a CSP (${scripts} problems)`);
  ok(out.files.every(f => /default-src 'none'/.test(f.html)),
     "the CSP denies by default, as it does on the policy pages");
  ok(out.files.every(f => /not legal advice|ليست استشارة قانونية/.test(f.html)),
     "every page carries the same disclaimer the app carries");

  /* ---- 7. rendered, in a browser */
  console.log("\n— the Arabic pages are actually right-to-left");

  const b = await chromium.launch(launchOpts());
  const p = await b.newPage();
  const sample = out.rows[0];

  const arUrl = `${BASE}/answers/${sample.slug}/ar/`;
  const r = await p.goto(arUrl, { waitUntil: "load" });
  ok(r && r.status() === 200, `an Arabic answer page is served (${r ? r.status() : "no response"})`);
  const rtl = await p.evaluate(() => ({
    dir: getComputedStyle(document.body).direction,
    lang: document.documentElement.lang,
    h1: (document.querySelector("h1") || {}).textContent || "",
    styled: getComputedStyle(document.querySelector(".key")).backgroundColor
  }));
  ok(rtl.dir === "rtl", `it renders right-to-left (direction: ${rtl.dir})`);
  ok(rtl.lang === "ar", `it declares lang="ar" (${rtl.lang})`);
  ok(/[؀-ۿ]/.test(rtl.h1), "its heading is in Arabic");
  ok(rtl.styled !== "rgba(0, 0, 0, 0)", `the stylesheets load (.key background: ${rtl.styled})`);

  /* The language switch is a link, not a toggle — these pages run no script,
     so if it does not navigate, a reader is stranded in the wrong language. */
  await p.click('.langs a');
  await p.waitForLoadState("load");
  const back = await p.evaluate(() => ({ lang: document.documentElement.lang, url: location.pathname }));
  ok(back.lang === "en" && back.url === `/answers/${sample.slug}/`,
     `the language switch navigates to the paired page (${back.url}, lang=${back.lang})`);

  const idx = await p.goto(`${BASE}/answers/`, { waitUntil: "load" });
  ok(idx && idx.status() === 200, `the English index is served (${idx ? idx.status() : "no response"})`);
  const listed = await p.evaluate(() => document.querySelectorAll(".answer-list a").length);
  ok(listed === out.rows.length, `the index lists every answer (${listed} of ${out.rows.length})`);

  await b.close();

  console.log(FAIL.length ? `\n${FAIL.length} FAILURES`
    : `\n${out.files.length} pages, ${out.rows.length} verified rows, and not one claim that is not in the register`);
  process.exit(FAIL.length ? 1 : 0);
})();
