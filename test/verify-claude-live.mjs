/* Proves a real Claude connection, end to end, against the live endpoint.
 *
 *   node test/verify-claude-live.mjs https://YOUR-REF.supabase.co/functions/v1/analyze
 *
 * Everything else in test/ runs against a stub, because a stub is enough to
 * prove the wiring and nothing here can hold your credentials. This one is the
 * opposite: it makes one real request to your deployed function and reports
 * exactly which link in the chain is broken if it does not come back.
 *
 * It sends a short specimen contract, never a real one.
 */

const url = process.argv[2];
if (!url || !/^https:\/\//.test(url)) {
  console.error("\nUsage: node test/verify-claude-live.mjs <ANALYZE_URL>\n" +
                "The URL must be https and should end in /functions/v1/analyze\n");
  process.exit(2);
}

const SPECIMEN = `EMPLOYMENT CONTRACT (specimen, not a real contract)
The employee is engaged for a fixed term of two years commencing 1 January 2025.
The monthly salary is 12,000 SAR inclusive of allowances.
Either party may terminate this agreement by giving thirty days written notice.
The probation period is ninety days from the commencement date.
Annual leave shall be twenty-one days per year.
The employee shall not work for a competitor for two years after leaving.`;

const step = (n, s) => console.log(`${n}. ${s}`);
const fail = (s, hint) => {
  console.error(`\n   FAILED: ${s}`);
  if (hint) console.error(`   ${hint}`);
  process.exit(1);
};

console.log(`\nChecking ${url}\n`);

/* 1. Reachable at all, and CORS configured for a browser. */
step(1, "Endpoint reachable, CORS preflight");
let pre;
try {
  pre = await fetch(url, {
    method: "OPTIONS",
    headers: { origin: "https://example.test", "access-control-request-method": "POST" },
  });
} catch (e) {
  fail(`cannot reach the endpoint (${e.message})`,
       "Check the URL, and that `supabase functions deploy analyze` succeeded.");
}
console.log(`   HTTP ${pre.status}`);
const allow = pre.headers.get("access-control-allow-origin");
if (!allow) {
  console.log("   ! no access-control-allow-origin header — a browser will be blocked");
} else {
  console.log(`   access-control-allow-origin: ${allow}`);
  if (allow !== "*" && !allow.startsWith("http")) {
    console.log("   ! that does not look like an origin. Set ALLOWED_ORIGIN to your site.");
  }
}

/* 2. A real analysis. */
step(2, "Sending a specimen contract");
const t0 = Date.now();
let res;
try {
  res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "contract", text: SPECIMEN }),
  });
} catch (e) {
  fail(`request failed (${e.message})`);
}
const ms = Date.now() - t0;
console.log(`   HTTP ${res.status} in ${ms} ms`);

const body = await res.json().catch(() => null);

if (res.status === 503 && body?.error === "not_configured")
  fail("the function is deployed but has no API key",
       "supabase secrets set ANTHROPIC_API_KEY=sk-ant-...");
if (res.status === 429)
  fail("rate limited", "Wait a minute and run it again.");
if (res.status === 502 && body?.error === "upstream_error")
  fail(`Anthropic rejected the call (upstream status ${body.status})`,
       body.status === 401 ? "The API key is wrong or revoked."
       : body.status === 400 ? "Check ANTHROPIC_MODEL — the model name may be wrong."
       : "Check your Anthropic account status and billing.");
if (res.status === 502)
  fail(`the model replied but the response could not be used (${body?.error})`,
       "Usually transient. Run it again; if it persists the prompt needs a look.");
if (!res.ok) fail(`unexpected status ${res.status}: ${JSON.stringify(body)}`);

/* 3. The shape the app depends on. */
step(3, "Checking the response shape");
if (!body || !Array.isArray(body.findings))
  fail("no findings array in the response", JSON.stringify(body).slice(0, 300));
console.log(`   summary: ${(body.summary || "(none)").slice(0, 120)}`);
console.log(`   findings: ${body.findings.length}`);

const badShape = body.findings.filter(
  (f) => typeof f?.title !== "string" || typeof f?.detail !== "string" ||
         !["info", "review", "attention"].includes(f?.severity));
if (badShape.length) fail(`${badShape.length} findings have the wrong shape`);

body.findings.slice(0, 4).forEach((f) =>
  console.log(`   - [${f.severity}] ${f.title}`));

/* 4. The guardrails that matter for what this is used for. */
step(4, "Checking the guardrails");
const all = (body.summary || "") + " " + body.findings.map(f => f.title + " " + f.detail).join(" ");
const banned = [/\billegal\b/i, /\bunlawful\b/i, /\bviolation\b/i, /\bguarantee/i,
                /\byou will win\b/i];
const hits = banned.filter((re) => re.test(all));
if (hits.length) {
  console.log(`   ! the model used language it was told to avoid: ${hits.join(", ")}`);
  console.log("     Not fatal — the app labels this panel as a reading — but worth watching.");
} else {
  console.log("   no outcome or legality language");
}
if (/article\s*\d+/i.test(all)) {
  console.log("   ! the model cited an article number. Check it against docs/legal-sources.md");
  console.log("     before trusting it: the app's own citations are verified, this one is not.");
} else {
  console.log("   no article numbers invented");
}

console.log(`\nConnected. Put this in config.js and the panel will appear:\n
window.WODOUH_CONFIG = { ANALYZE_URL: "${url}" };\n
Then re-read docs/claude-analysis.md — turning this on changes what the app
promises about privacy, and the copy switches to match.\n`);
