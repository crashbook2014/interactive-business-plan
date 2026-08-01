/* Redemption code generator for the Zid paid test.
 *
 *   node test/make-codes.mjs 30
 *
 * Prints two blocks:
 *   1. the plaintext codes — these go to Zid, one sent to each buyer
 *   2. the SHA-256 hashes  — these go into app/index.html
 *
 * The app never contains a plaintext code, so reading the page source does not
 * hand someone a working code. That is the only protection this provides, and
 * it is deliberately modest: see docs/zid-test-runbook.md. A determined reader
 * can still bypass the paywall by editing the JavaScript, because every check
 * happens in their browser. This is sized for a test of tens of buyers, not a
 * launch.
 *
 * Codes are unambiguous by construction: no O/0, no I/1/L. People will be
 * typing these off a phone screen.
 */
import { createHash, randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const n = Math.max(1, Math.min(500, Number(process.argv[2] ?? 20)));

function block(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/* WD-XXXX-XXXX — the prefix makes it obvious what it is when it turns up in a
   support message six weeks later. */
const codes = new Set();
while (codes.size < n) codes.add(`WD-${block()}-${block()}`);

const list = [...codes];
const hashes = list.map(c => createHash("sha256").update(c).digest("hex").slice(0, 16));

console.log(`\n=== ${n} codes — send these to buyers via Zid, never commit them ===\n`);
list.forEach(c => console.log("  " + c));

console.log(`\n=== hashes — paste into REDEEM_HASHES in app/index.html ===\n`);
console.log("const REDEEM_HASHES = [");
hashes.forEach(h => console.log(`  "${h}",`));
console.log("];\n");
