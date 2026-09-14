/* The preflight allowlist and the headers the client actually sends.
 *
 * THE DEFECT THIS EXISTS FOR, WHICH WAS LIVE FOR A FORTNIGHT.
 *
 * a8b5ea2 added the anon `apikey` header to every AI call, because the gateway
 * in front of the Edge Functions enforces verify_jwt and rejects a call
 * without it. It fixed the gateway and broke the browser, because nothing
 * updated the functions' `access-control-allow-headers` to say that header was
 * allowed.
 *
 * A browser will not send a cross-origin request whose headers the preflight
 * did not authorise. So the sequence became: OPTIONS goes out, the function
 * answers 204, and the POST is never sent. Every AI question and every scanned
 * PDF failed, and the server logs showed nothing but healthy 204s — the live
 * logs carried five preflights with no POST behind any of them.
 *
 * WHY NOTHING CAUGHT IT. Every other suite intercepts these endpoints, which
 * is correct for testing the client's behaviour and useless for this: an
 * intercepted route performs no preflight at all. There was no test anywhere
 * that compared the two halves, so they were free to drift, and they did.
 *
 * WHAT THIS ASSERTS. Both sides are PARSED FROM THE SHIPPED FILES rather than
 * listed here, so adding a header to the client moves the bar rather than
 * needing this file edited to agree with it. A header the client sends and the
 * function does not allow fails, in either direction.
 */
const fs = require("node:fs");
const path = require("node:path");

const R = (...p) => path.join(__dirname, "..", ...p);
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const app = fs.readFileSync(R("app", "index.html"), "utf8");

/* ---------------------------------------- what the client puts on a request */
/* analyzeHeaders() is the base for every AI call; authHeaders() adds the
   Bearer for the scan path. Read both out of the shipped file. */
const fn = (name) => {
  const m = app.match(new RegExp("function " + name + "\\([^)]*\\)\\{[\\s\\S]*?\\n\\}"));
  return m ? m[0] : "";
};
const analyzeSrc = fn("analyzeHeaders");
const authSrc = fn("authHeaders");
ok(analyzeSrc.length > 40, "analyzeHeaders() was found in the shipped app");
ok(authSrc.length > 40, "authHeaders() was found in the shipped app");

/* Header names appear either quoted ("content-type") or as bare object keys
   (apikey:). Both forms are collected; `authorization` is set by assignment
   into the returned object, so the bracket form is read too. */
const sent = new Set();
for (const src of [analyzeSrc, authSrc]) {
  for (const m of src.matchAll(/["']([a-z-]+)["']\s*:/g)) sent.add(m[1]);
  for (const m of src.matchAll(/(?:^|[{,\s])([a-z][a-z-]*)\s*:\s*(?:key|tok)/g)) sent.add(m[1]);
  for (const m of src.matchAll(/h\[["']([a-z-]+)["']\]\s*=/g)) sent.add(m[1]);
}
/* content-type is deleted again on the multipart upload so the browser can set
   its own boundary — it is still sent on every JSON call, so it stays. */
ok(sent.size >= 2, `the headers the client sends were parsed (${[...sent].join(", ") || "none"})`);
/* Named explicitly, because these two are what the gateway and the ownership
   check respectively depend on. */
for (const h of ["content-type", "authorization"]) {
  ok(sent.has(h), `the client sends ${h}`);
}
/* AND IT MUST NOT SEND `apikey`, which is the half that cannot be tested
   against the repo alone.
   The function that is DEPLOYED allows only `content-type, authorization` —
   the apikey entry exists in this repo and has never shipped. So a client that
   sends apikey is a client whose every AI call the browser refuses, no matter
   how correct the repo's allowlist looks here. The anon key travels as
   `Authorization: Bearer`, which the gateway accepts and the live preflight
   already permits.
   Delete this assertion the day analyze is redeployed and not before. */
ok(!sent.has("apikey"),
   "and does not send apikey, which the deployed preflight has never allowed");

/* ------------------------------------------- what each function will accept */
for (const f of ["analyze", "upload"]) {
  const src = fs.readFileSync(R("supabase", "functions", f, "index.ts"), "utf8");
  const m = src.match(/["']access-control-allow-headers["']\s*:\s*["']([^"']+)["']/);
  ok(!!m, `${f}: the preflight allowlist was found`);
  const allowed = new Set((m ? m[1] : "").split(",").map((s) => s.trim().toLowerCase()));
  ok(allowed.size >= 2, `${f}: and parsed (${[...allowed].join(", ") || "none"})`);

  /* THE ASSERTION. A header the client sends that this list omits is a request
     the browser will refuse to make. */
  const missing = [...sent].filter((h) => !allowed.has(h));
  ok(missing.length === 0,
     `${f}: every header the client sends is allowed by the preflight` +
     (missing.length ? ` — NOT allowed: ${missing.join(", ")}` : ""));

  /* The other direction is not an error, but a list that allows something
     nobody sends is either dead or a hint that a call site was removed without
     its header. Reported, not failed. */
  const extra = [...allowed].filter((h) => !sent.has(h));
  if (extra.length) console.log(`         (${f} also allows, unused: ${extra.join(", ")})`);

  /* The method has to be there too — same class of bug, same silence. */
  const meth = (src.match(/["']access-control-allow-methods["']\s*:\s*["']([^"']+)["']/) || [])[1] || "";
  ok(/POST/i.test(meth) && /OPTIONS/i.test(meth),
     `${f}: the preflight allows the method the client uses (${meth || "none"})`);

  /* Never a wildcard on a paid endpoint. analyze/index.ts explains why at
     length: "*" lets any site a reader has open spend our Anthropic budget
     against their rate-limit bucket. */
  const origin = (src.match(/["']access-control-allow-origin["']\s*:\s*([^,\n]+)/) || [])[1] || "";
  ok(!/["']\*["']/.test(origin),
     `${f}: and never wildcards the origin on a paid endpoint`);
}

console.log("\n" + (FAIL.length
  ? `${FAIL.length} FAILURES\n` + FAIL.map((f) => "  - " + f).join("\n")
  : "the preflight allows exactly what the client sends — the two halves cannot drift apart"));
process.exit(FAIL.length ? 1 : 0);
