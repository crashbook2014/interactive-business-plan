/* The legal claims the product makes about ITSELF, checked against the record.
 *
 * Every other suite in this repo applies one rule: the product is the
 * authority, so a test derives its facts from the shipped source rather than
 * from a list written in the test (test/future.test.js:139).
 *
 * FOR A LEGAL CLAIM THAT RULE INVERTS. The register is the authority, and the
 * product may not claim more than the register records. Nothing enforced that,
 * and the gap it left was not theoretical: "our legal content is reviewed by a
 * licensed Saudi lawyer" shipped in the present tense on around eighty
 * surfaces — the disclaimer on ten app screens, a trust badge on the landing
 * page, sixty-three answer pages, and a bolded clause in the Terms of Service
 * — while docs/legal-sources.md listed that same review, unstruck, as step one
 * of "Before shipping to real users", and test/admin.test.js quoted a blocker
 * that had shipped publicly saying it too.
 *
 * The claim turned out to be true and the record stale. That is the lucky
 * direction of a failure with no lucky direction, because nothing in the
 * repository could tell the two apart — and the surface it sat on was a
 * contract term.
 *
 * THE SECOND HALF is the answers library. Fifteen of the eighteen articles the
 * app cites have a published, article-specific page, and until now nothing
 * linked them: a reader who saw «نظام العمل السعودي — المادة 83» had no way to
 * reach Wodouh's own sourced explanation of Article 83. The three cited
 * articles with NO page are exactly the three that should not have one, and
 * that is asserted by REASON rather than by an allow-list, so the day Article
 * 53 stops being disputed this suite demands its page instead of tolerating
 * the hole.
 */
const fs = require("node:fs");
const path = require("node:path");

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const R = (...p) => path.join(__dirname, "..", ...p);
const app = fs.readFileSync(R("app", "index.html"), "utf8");
const landing = fs.readFileSync(R("assets", "landing.js"), "utf8");
const terms = fs.readFileSync(R("terms", "index.html"), "utf8");
const register = fs.readFileSync(R("docs", "legal-sources.md"), "utf8");

/* ------------------------------------- 1. the review claim is on the record */
console.log("— the product claims no lawyer review the register does not record");

const CLAIM = /reviewed by a licensed Saudi lawyer|محامٍ سعودي مرخّص/;
const claimants = [["the app", app], ["the landing page", landing], ["the terms", terms]]
  .filter(([, src]) => CLAIM.test(src)).map(([name]) => name);
/* Counted first. Every assertion below is conditional on the claim existing,
   and a condition that silently stops matching turns the whole section into a
   no-op that still prints ok. */
ok(claimants.length > 0,
   `the lawyer-review claim was found in the shipped copy (${claimants.join(", ")})`);

if (claimants.length) {
  /* The record itself. Matched on what it MEANS, not on one phrasing, so the
     entry can be rewritten — or replaced with the real completion date — and
     still satisfy this. */
  /* \s+ between the words, not a literal space: the entry is prose in a
     wrapped markdown file, and the sentence it has to find breaks across a
     line. The first version of this assertion failed on the record it was
     written against. */
  const recorded = /lawyer review[^\n]*recorded|recorded[^\n]*lawyer review/i.test(register)
    && /licensed\s+Saudi\s+lawyer\s+has\s+reviewed\s+this\s+register/i.test(register);
  ok(recorded,
     "docs/legal-sources.md records that the review happened");

  /* AND the pre-launch checklist must no longer carry it as OPEN. This is the
     half that was actually wrong: the claim shipped while this item sat
     unstruck. Markdown strikethrough is the form item 2 beside it already
     uses, so "done" has a shape here and is not a matter of tone. */
  const PRELAUNCH = /## Before shipping to real users([\s\S]*?)(?=\n## |$)/;
  const block = (register.match(PRELAUNCH) || [])[1] || "";
  ok(block.length > 100, `the pre-launch checklist was found (${block.length} chars)`);
  const lawyerItem = block.split(/\n(?=\d+\. )/).find((x) => /licensed Saudi lawyer/i.test(x));
  ok(!!lawyerItem, "and it still has a lawyer-review item to check the state of");
  ok(!!lawyerItem && /~~/.test(lawyerItem),
     "which is struck through — the claim is not shipped against an open blocker");
}

/* ------------------------------------ 2. what the answers library covers */
console.log("\n— every verified citation can reach its own answer page");

/* THE SLUGS ARE READ OFF DISK, never listed here. A page deleted in a content
   pass has to break this, which is the only reason the map is worth guarding. */
const answersDir = R("answers");
const slugs = fs.readdirSync(answersDir)
  .filter((d) => fs.statSync(path.join(answersDir, d)).isDirectory() && d !== "ar");
ok(slugs.length > 20, `the answers library was read (${slugs.length} pages)`);

/* THE CITED ARTICLES ARE PARSED OUT OF THE APP, for the same reason. Only
   citations naming the Saudi Labour Law count: the app also cites the
   Implementing Regulations, the Social Insurance Law, Qiwa, Najiz, Ejar, GOSI
   and SANED, and none of those is this library's subject. */
const LABOUR_EN = /Saudi Labor Law — Article (\d+)/g;
const cited = new Set();
for (const m of app.matchAll(LABOUR_EN)) cited.add(Number(m[1]));
ok(cited.size > 10, `the app's Labour Law citations were parsed (${[...cited].sort((a,b)=>a-b).join(", ")})`);

/* The map the product actually uses, lifted out of the shipped file rather
   than duplicated here. */
const mapSrc = (app.match(/const ANSWER_PAGE = \{[\s\S]*?\};/) || [""])[0];
ok(mapSrc.length > 100, "the ANSWER_PAGE map is in the app");
const mapped = new Map();
for (const m of mapSrc.matchAll(/(\d+)\s*:\s*"([^"]+)"/g)) mapped.set(Number(m[1]), m[2]);
ok(mapped.size > 10, `and it was parsed (${mapped.size} entries)`);

/* Every entry points at a page that exists — in both languages. The Arabic
   mirror is asserted separately because dropping the "ar/" suffix is a silent
   failure: the English page loads, so the link still works, and an Arabic
   reader is quietly handed English. */
const missing = [...mapped].filter(([, slug]) => !slugs.includes(slug));
ok(missing.length === 0,
   `every mapped article points at a real page${missing.length ? " — dangling: " + missing.map(([a, s]) => `${a}→${s}`).join(", ") : ""}`);
const noAr = [...mapped].filter(([, slug]) =>
  slugs.includes(slug) && !fs.existsSync(path.join(answersDir, slug, "ar", "index.html")));
ok(noAr.length === 0,
   `and each has an Arabic mirror${noAr.length ? " — missing ar/: " + noAr.map(([a]) => a).join(", ") : ""}`);

/* ------------------ 3. the gaps are the register's gaps, not an allow-list */
console.log("\n— and the articles with no page are the ones the register excludes");

/* The register's own tokens decide this. An article the app cites and the
   library does not cover is acceptable ONLY where the register says that
   article is not fully verified — so resolving Article 53 one day makes this
   assertion demand its page rather than keep excusing it. */
const rows = register.split("\n").filter((l) => /^\|/.test(l));
ok(rows.length > 30, `the register was parsed (${rows.length} rows)`);
const notFullyVerified = new Set();
for (const row of rows) {
  const cells = row.split("|").map((c) => c.trim());
  const art = (cells.find((c) => /^\*\*\d+\*\*$/.test(c)) || "").replace(/\*/g, "");
  if (!art) continue;
  if (/DISPUTED/i.test(row) || /verified as to/i.test(row)) notFullyVerified.add(Number(art));
}
ok(notFullyVerified.size > 0,
   `the register names articles it does not fully verify (${[...notFullyVerified].sort((a,b)=>a-b).join(", ")})`);

const unmapped = [...cited].filter((a) => !mapped.has(a));
const unexcused = unmapped.filter((a) => !notFullyVerified.has(a));
ok(unexcused.length === 0,
   `every fully-verified cited article has a page${unexcused.length ? " — no page and no excuse: " + unexcused.join(", ") : ` (unlinked: ${unmapped.join(", ") || "none"}, each excluded by the register)`}`);

/* ---------------------------- 4. the instrument, not the number */
console.log("\n— a citation is matched by its instrument, never by a bare number");

/* THE ONE THAT BREAKS SILENTLY. «نظام التأمينات الاجتماعية مع المادتين 84 و85»
   — the Social Insurance Law read with Articles 84 and 85 — contains "84". A
   lookup keyed on the number alone attaches the Labour Law's article-84 page
   to a GOSI figure: a false citation, on a money line, that looks right.
   Asserted against the shipped resolver rather than re-implemented here. */
const fnSrc = (app.match(/function answerHref\([\s\S]*?\n\}/) || [""])[0];
ok(fnSrc.length > 80, "the resolver is in the app");
/* THE PATTERNS, not the function body. The first version of this grepped
   answerHref() for the law's name and failed — the function reads
   LABOUR_CITE[lang], and the names live in that const above it. Asserting
   against the wrong span is how a check ends up testing its own phrasing. */
const citeSrc = (app.match(/const LABOUR_CITE = \{[\s\S]*?\n\};/) || [""])[0];
ok(citeSrc.length > 60, "and the citation patterns it uses are too");
ok(/Saudi Labor Law/.test(citeSrc) && /نظام العمل السعودي/.test(citeSrc),
   "they name the Labour Law itself, in both languages");
/* ANCHORED AT BOTH ENDS is the load-bearing property. «اللائحة التنفيذية
   لنظام العمل — المادة 6» contains the words «نظام العمل», so an unanchored
   pattern matches the Implementing Regulations and hands back a Labour Law
   page. Count the anchors rather than trusting the eye. */
const anchored = (citeSrc.match(/\/\^/g) || []).length;
const closed = (citeSrc.match(/\$\//g) || []).length;
ok(anchored >= 2 && closed >= 2,
   `both patterns are anchored to the whole citation (${anchored} starts, ${closed} ends)`);

const DECOYS = [
  ["نظام التأمينات الاجتماعية مع المادتين 84 و85", "Social Insurance Law read with Articles 84 and 85"],
  ["اللائحة التنفيذية لنظام العمل — المادة 6", "Labor Law Implementing Regulations — Article 6"],
  ["شبكة إيجار", "Ejar network"],
];
for (const [ar, en] of DECOYS) {
  ok(app.includes(ar) && app.includes(en),
     `the decoy citation is still in the product, so this check is live ("${en}")`);
}

/* --------------------------------- 5. rendered, because static cannot see it */
/* EVERYTHING ABOVE READS FILES, and there is one failure that shape cannot
   catch: dropping the "ar/" suffix from the href. The map still points at a
   real page, the patterns are still anchored, the English page still loads —
   and an Arabic reader following an Arabic citation lands on English. Proven
   by breaking it: with the suffix removed, every static assertion above still
   passed. So the last check renders the screen and reads the href. */
(async () => {
  const { playwright, launchOpts, APP } = require("./_env.js");
  const { chromium } = playwright();
  const b = await chromium.launch(launchOpts());
  console.log("\n— the rendered citation links where it says it does");
  for (const [l, wantAr] of [["ar", true], ["en", false]]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    p.on("pageerror", (e) => FAIL.push("pageerror: " + e.message));
    await p.goto(APP);
    await p.waitForFunction(() => typeof window.show === "function");
    const got = await p.evaluate((lang_) => {
      lang = lang_; applyLang(); nat = "sa"; obDone = true;
      owned = { review: "plan_review", letter: null, case: null };
      current = SAMPLES.employment; current.srcText = null; journey = "contract";
      renderResult(); show("result");
      const a = [...document.querySelectorAll("#flags .src-line.law .art-link")]
        .find((x) => /83/.test(x.textContent));
      const lines = document.querySelectorAll("#flags .src-line.law").length;
      return { lines, href: a ? a.getAttribute("href") : null,
               target: a ? a.getAttribute("target") : null,
               text: a ? a.textContent.trim() : "" };
    }, l);
    ok(got.lines > 0, `${l}: the result screen rendered cited clauses (${got.lines})`);
    ok(!!got.href, `${l}: the Article 83 citation is a link ("${got.text}")`);
    ok(!!got.href && got.href.includes("non-compete-must-be-in-writing-article-83"),
       `${l}: pointing at the Article 83 page (${got.href})`);
    ok(!!got.href && /\/ar\/$/.test(got.href) === wantAr,
       `${l}: ${wantAr ? "through the Arabic mirror" : "with no ar/ suffix"} (${got.href})`);
    /* A new tab, or the reader loses the analysis they are reading. */
    ok(got.target === "_blank", `${l}: and it opens in a new tab, not over the result`);
    await p.close();
  }
  await b.close();

  console.log("\n" + (FAIL.length
    ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
    : "the product claims only the review the register records, and every verified citation reaches its own page"));
  process.exit(FAIL.length ? 1 : 0);
})();

