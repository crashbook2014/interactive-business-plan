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

/* Markdown that is presentation, not content. The model reads the claim as a
   sentence; asterisks and link syntax are noise that shows up in quotes. */
function plain(s){
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

export function buildCorpus(md){
  const lines = md.split("\n");
  const start = lines.findIndex(l => /^##\s+Claim register/.test(l));
  if (start < 0) throw new Error("no '## Claim register' heading in the register");

  const rows = [], seen = {};
  let disputed = 0, header = 0;
  for (let i = start + 1; i < lines.length; i++){
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1);
    if (cells.length < 3) continue;
    if (/^[\s:-]+$/.test(cells[0])) continue;          /* the --- separator */
    if (header++ === 0) continue;                       /* the column names */

    const status = plain(cells[2]);
    /* Anything that is not a clean tick is out. A row mid-dispute, a row
       marked partly verified, a row someone annotated — all excluded. The
       corpus is the conservative reading of the register, always. */
    if (!/^✅\s*verified$/i.test(status)){ disputed++; continue; }

    const article = articleOf(cells[1]);
    rows.push({ id: idFor(article, seen), article, claim: plain(cells[0]) });
  }

  if (!rows.length) throw new Error("no verified rows found — refusing to write an empty corpus");
  return { generated_from: "docs/legal-sources.md", verified: rows.length, excluded: disputed, rows };
}

if (process.argv[1] === fileURLToPath(import.meta.url)){
  const corpus = buildCorpus(readFileSync(REGISTER, "utf8"));
  writeFileSync(OUT, JSON.stringify(corpus, null, 2) + "\n");
  console.log(`corpus: ${corpus.verified} verified rows, ${corpus.excluded} excluded`);
  corpus.rows.forEach(r => console.log(`  ${r.id.padEnd(22)} ${r.claim.slice(0, 64)}…`));
}
