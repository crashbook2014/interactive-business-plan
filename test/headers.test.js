/* The response headers, checked against the pages they protect.
 *
 * `_headers` does nothing until the site moves to Cloudflare Pages. That is
 * exactly why it needs a test: a file that has no effect today is a file that
 * drifts silently, and the day it starts working is the day anyone finds out.
 *
 * The failure this exists to prevent is specific. The <meta> CSP in each page
 * is the policy today. When the header version takes over, it must not be
 * WEAKER than the tag it replaces — a missing directive there is a directive
 * that stops being enforced, and nothing would fail, and nobody would notice.
 *
 * So every directive is compared, both ways, for both pages. Plus the three
 * things a <meta> tag cannot do at all, which are the whole reason to move.
 *
 * No network. This reads files.
 */
const { readFileSync } = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* Cloudflare's format: a path at column 0, then indented "Name: value" lines
   until the next path or a blank line. Comments start with #. */
function parseHeaders(src){
  const rules = [];
  let cur = null;
  for (const raw of src.split("\n")){
    const line = raw.replace(/\s+$/, "");
    if (!line || /^\s*#/.test(line)) continue;
    if (!/^\s/.test(line)){
      cur = { path: line.trim(), headers: {} };
      rules.push(cur);
      continue;
    }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    cur.headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return rules;
}

function directives(csp){
  const out = {};
  String(csp).split(";").map(s => s.trim()).filter(Boolean).forEach(d => {
    const [name, ...vals] = d.split(/\s+/);
    out[name.toLowerCase()] = vals.join(" ");
  });
  return out;
}

function metaCsp(file){
  const src = readFileSync(path.join(ROOT, file), "utf8");
  const m = src.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  if (!m) throw new Error(`no meta CSP found in ${file}`);
  return m[1];
}

const rules = parseHeaders(readFileSync(path.join(ROOT, "_headers"), "utf8"));
const find = p => rules.find(r => r.path === p);

console.log("\n— the file parses as Cloudflare expects");
ok(rules.length >= 4, `${rules.length} rules parsed`);
ok(!!find("/*"), "there is a catch-all rule");

/* ---- the three things a meta tag cannot do */
console.log("\n— the three protections that only exist as headers");
const all = find("/*").headers;
ok(/max-age=\d{7,}/.test(all["strict-transport-security"] || ""),
   "HSTS is set with a long max-age, so a first visit over http is not interceptable");
ok((all["x-content-type-options"] || "") === "nosniff", "content-type sniffing is off");
ok(/^(DENY|SAMEORIGIN)$/i.test(all["x-frame-options"] || ""),
   "and the legacy framing header is set for old browsers");

const sw = find("/app/sw.js");
ok(!!sw, "the service worker has its own rule");
const swCsp = directives(sw.headers["content-security-policy"] || "");
ok(swCsp["connect-src"] === "'none'",
   "THE ONE THAT MATTERS: the worker gets connect-src 'none' — the only way to enforce it");
ok(swCsp["default-src"] === "'none'", "and default-src 'none' beneath it");

/* ---- the headers must never be weaker than the tags they replace */
console.log("\n— no page's header policy is weaker than its meta policy");
for (const [file, rulePath] of [["index.html", "/"], ["app/index.html", "/app/*"]]) {
  const meta = directives(metaCsp(file));
  const rule = find(rulePath);
  ok(!!rule, `${file} has a matching rule (${rulePath})`);
  if (!rule) continue;
  const head = directives(rule.headers["content-security-policy"] || "");

  const missing = Object.keys(meta).filter(d => !(d in head));
  ok(missing.length === 0,
     `${rulePath} carries every directive the meta tag has${missing.length ? " — missing " + missing.join(", ") : ""}`);

  const weaker = Object.keys(meta).filter(d => d in head && head[d] !== meta[d]);
  ok(weaker.length === 0,
     `${rulePath} matches the meta tag value for value${weaker.length ? " — differs on " + weaker.map(d => `${d} (meta "${meta[d]}" vs header "${head[d]}")`).join("; ") : ""}`);

  /* frame-ancestors is ignored inside a meta tag, so it can only ever be an
     addition here. Its absence is the whole reason a header is worth having. */
  ok(head["frame-ancestors"] === "'none'",
     `${rulePath} adds frame-ancestors 'none', which a meta tag cannot express`);
}

/* ---- the AI, when it is switched on, has to be switched on in two places */
console.log("\n— the AI switch is documented as a two-file change");
const hdrSrc = readFileSync(path.join(ROOT, "_headers"), "utf8");
ok(/enable-ai-runbook/.test(hdrSrc),
   "the file points at the runbook, so nobody opens connect-src here and forgets the meta tag");
/* Both directions, like the meta tag it mirrors: closed when nothing is
   configured, and naming exactly the configured host when something is. */
{
  const cfg = (readFileSync(path.join(ROOT, "app/index.html"), "utf8")
    .match(/SUPABASE_URL:\s*"([^"]+)"/) || [])[1] || null;
  const conn = directives(find("/app/*").headers["content-security-policy"])["connect-src"];
  ok(cfg ? conn === cfg : !/supabase|https:\/\//.test(conn), cfg
    ? `the header names exactly the configured project (${conn})`
    : "and no endpoint is currently allowed — this ships closed like everything else");
}

/* ==================================================== supabase/config.toml
   The same argument as `_headers` above, applied to a different file: this one
   has no effect until someone runs `supabase link`, which is exactly why it
   drifts unnoticed and exactly why it needs a test.

   The setting that matters is verify_jwt. Supabase's gateway checks a JWT
   BEFORE the function runs. That is right for functions the app calls and
   wrong for functions the outside world calls — and getting it wrong is
   silent in both directions:

     left ON for webhook   → Zid and Salla get 401 from the gateway, the
                             function never runs, its signature check never
                             executes, and the integration fails completely
                             while looking configured
     turned OFF for analyze → an endpoint that spends real money per call stops
                             requiring even the anon key */
console.log("\n— the Edge Functions verify the right caller, by the right method");
const toml = readFileSync(path.join(ROOT, "supabase/config.toml"), "utf8");

/* Derived from the directory rather than a list here, so a function added
   tomorrow without a decision about its caller fails this instead of shipping
   on a default nobody chose. */
const fns = require("node:fs")
  .readdirSync(path.join(ROOT, "supabase/functions"), { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith("_"))
  .map(d => d.name);

/* Called by machines that have never heard of Supabase and carry no JWT. Each
   authenticates its own caller: webhook by HMAC over the raw body,
   oauth-callback by a signed expiring state parameter. */
const EXTERNAL = new Set(["webhook", "oauth-callback"]);

for (const fn of fns){
  const block = toml.match(new RegExp(`\\[functions\\.${fn}\\][\\s\\S]*?verify_jwt\\s*=\\s*(true|false)`));
  ok(!!block, `${fn}: config.toml states a verify_jwt decision rather than inheriting a default`);
  if (!block) continue;
  const off = block[1] === "false";
  ok(off === EXTERNAL.has(fn), EXTERNAL.has(fn)
    ? `${fn}: verify_jwt is off, because its caller has no Supabase JWT and it checks its own signature`
    : `${fn}: verify_jwt is on, so the anon key is required before it can spend money`);
}

ok(/site_url\s*=\s*"https:\/\/alwodouh\.com\/app\/index\.html"/.test(toml),
   "the auth site_url matches REDIRECT_URL verbatim — the usual cause of 'sign-in works but the app never signs in'");
ok(/\[auth\.email\][\s\S]*?enable_signup\s*=\s*false/.test(toml),
   "email and password sign-up stays off, because this product has no password path at all");
ok(/\[auth\.external\.apple\][\s\S]*?enabled\s*=\s*false/.test(toml),
   "Apple stays off until there is a paid developer account, so no dead sign-in button renders");

console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\nthe headers hold, and none of them is weaker than the tag it replaces");
process.exit(FAIL.length ? 1 : 0);
