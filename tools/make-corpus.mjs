/* Wodouh — build the answering corpus from the legal register.
 *
 * WHY THIS FILE EXISTS
 *
 * The app is about to answer questions it was not built to answer, using a
 * model. The whole product rests on one rule: an article number appears in
 * Wodouh only if it appears as verified in docs/legal-sources.md. A model
 * asked politely to respect that rule will respect it most of the time, and
 * "most of the time" is not a property you can sell.
 *
 * So the rule is enforced by construction instead. This script reads the
 * register, keeps ONLY the rows a human marked verified, and emits them as the
 * only legal text the answering prompt ever sees. A disputed row — Article 53
 * today — is not in the corpus, so there is nothing for the model to quote
 * from. It does not have to decline the row; it never receives it.
 *
 * WHAT IS DELIBERATELY LEFT OUT
 *
 * The "checked against" column. Those links are how a human re-verifies a row;
 * they are not evidence the model should be repeating to a reader, and a URL
 * in the corpus is a URL a completion can put in front of someone as a source
 * it never opened.
 *
 * BOTH LANGUAGES, OR NEITHER. Wodouh is read in Arabic. A row whose claim
 * exists only in English forces the model to translate the statute itself at
 * answer time, unsupervised — which is the one thing this whole design exists
 * to prevent. So a verified row without an Arabic claim is not compiled at
 * all: the build fails rather than shipping a claim no human wrote.
 *
 * REGENERATE AND COMMIT. corpus.test.js fails if the committed file and the
 * register disagree, so the two can never drift apart quietly.
 *
 *   node tools/make-corpus.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTER = join(root, "docs", "legal-sources.md");
const OUT = join(root, "supabase", "functions", "_shared", "corpus.json");

/* A SECOND REGISTER, AND WHY IT IS A SECOND FILE RATHER THAN MORE ROWS.
   Loan and consumer-financing claims answer to SAMA, not to the Labour Law.
   Putting them in the employment register would put them in the employment
   corpus, and `verifiedArticles()` builds one flat set of article numbers from
   whatever it is given — so "Article 11" of a financing regulation would
   silently verify "Article 11" cited against an employment contract. The
   rental table already lives apart for the same reason, one file down.
   Its corpus is EMPTY today and that is the correct state: not one row in
   docs/legal-sources-loans.md has been checked against a primary source. */
const REGISTERS = [
  { name: "employment", md: REGISTER, out: OUT, allowEmpty: false },
  { name: "loans",
    md: join(root, "docs", "legal-sources-loans.md"),
    out: join(root, "supabase", "functions", "_shared", "corpus-loans.json"),
    allowEmpty: true },
];

/* Markdown that is presentation, not content. The model reads the claim as a
   sentence; asterisks and link syntax are noise that shows up in quotes. */
export function plain(s){
  return s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* The article cell, reduced to what may be cited. An em-dash row means the
   register deliberately recorded no article number — the claim is verified,
   the citation is a named programme or a different statute. Those rows keep
   their name and must never acquire a number downstream. */
function articleOf(cell){
  const t = plain(cell);
  if (!t || t === "—" || t.startsWith("—")) return null;
  return t;
}

function idFor(article, seen){
  const base = article
    ? "art-" + article.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "no-article";
  const n = (seen[base] = (seen[base] || 0) + 1);
  return n === 1 ? base : `${base}-${n}`;
}

/* THE ONE PLACE THE REGISTER IS READ.
   Exported because a second consumer now exists — tools/make-seo.mjs builds the
   public answer pages from the same rows. Two parsers over one file is two
   definitions of "verified", and the whole point of the strict rule is that
   there is exactly one.

   Each row carries its RAW cells as well as the cleaned fields, because the
   consumers legitimately want different columns: the corpus deliberately drops
   the sources ("a URL in the corpus is a URL a completion can put in front of
   someone as a source it never opened"), while the public pages exist to show
   exactly those links. */
export function verifiedRows(md, { allowEmpty = false } = {}){
  const lines = md.split("\n");
  const start = lines.findIndex(l => /^##\s+Claim register/.test(l));
  if (start < 0) throw new Error("no '## Claim register' heading in the register");

  const rows = [], seen = {};
  let excluded = 0, header = 0;
  for (let i = start + 1; i < lines.length; i++){
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1);
    if (cells.length < 3) continue;
    if (/^[\s:-]+$/.test(cells[0])) continue;          /* the --- separator */
    if (header++ === 0) continue;                       /* the column names */

    const status = plain(cells[3]);
    /* Anything that is not a clean tick is out. A row mid-dispute, a row
       marked partly verified, a row someone annotated — all excluded. The
       conservative reading of the register, always. */
    if (!/^✅\s*verified$/i.test(status)){ excluded++; continue; }

    const article = articleOf(cells[2]);
    const id = idFor(article, seen);
    const claim_ar = plain(cells[1] ?? "");
    /* The rule, enforced by construction rather than by remembering. An
       untranslated verified row cannot be compiled, so it cannot reach an
       Arabic reader as English. */
    if (!claim_ar) throw new Error(`row "${id}" is verified but has no Arabic claim`);
    rows.push({ id, article, claim: plain(cells[0]), claim_ar, sourcesCell: cells[4] ?? "" });
  }
  /* An empty employment register is a broken build — that file has had rows
     since the product had a product. An empty LOAN register is the honest
     current state, so it is allowed rather than fatal: a register nobody has
     verified yet compiles to a corpus with nothing in it, which is exactly
     what "the product cites nothing on this path" looks like in data. */
  if (!rows.length && !allowEmpty) throw new Error("no verified rows found in the register");
  return { rows, excluded };
}

export function buildCorpus(md, { from = "docs/legal-sources.md", allowEmpty = false } = {}){
  const { rows, excluded } = verifiedRows(md, { allowEmpty });
  /* The sources column is dropped here, deliberately — see verifiedRows. */
  const clean = rows.map(({ id, article, claim, claim_ar }) => ({ id, article, claim, claim_ar }));
  return { generated_from: from, verified: clean.length,
           excluded, rows: clean };
}

if (process.argv[1] === fileURLToPath(import.meta.url)){
  for (const reg of REGISTERS){
    const corpus = buildCorpus(readFileSync(reg.md, "utf8"), {
      from: reg.md.slice(root.length + 1).replace(/\\/g, "/"),
      allowEmpty: reg.allowEmpty,
    });
    writeFileSync(reg.out, JSON.stringify(corpus, null, 2) + "\n");
    console.log(`${reg.name}: ${corpus.verified} verified rows, ${corpus.excluded} excluded`);
    corpus.rows.forEach(r => console.log(`  ${r.id.padEnd(22)} ${r.claim.slice(0, 64)}…`));
  }
}
