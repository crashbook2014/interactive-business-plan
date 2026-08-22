/* Point the app at a Supabase project, and name the two things that are
 * otherwise found the hard way.
 *
 *   node tools/setup-supabase.mjs https://YOUR-REF.supabase.co eyJhbGci...
 *
 * WHAT IT WRITES. supabase/config.js, which is gitignored. That file holds the
 * project URL and the PUBLIC key, which grants nothing on its own because
 * every table is behind row level security (proven, now, by test/rls.test.js).
 *
 * TWO KEY FORMATS, AND THIS ACCEPTS BOTH. Supabase moved from JWT-shaped keys
 * to opaque prefixed ones:
 *
 *   public   legacy `eyJ…` JWT with role "anon"   ·   new `sb_publishable_…`
 *   secret   legacy `eyJ…` JWT with role          ·   new `sb_secret_…`
 *            "service_role"
 *
 * The first version of this script only understood the legacy form, so it
 * refused a perfectly good `sb_publishable_` key as "unreadable". Refusing
 * safely is better than accepting blindly, but it was still wrong.
 *
 * WHAT IT REFUSES TO WRITE. A secret key, in EITHER format. That key bypasses
 * row level security entirely; it belongs in `supabase secrets set`, typed by
 * you, and nowhere else. This matters more with the new format, not less: an
 * `sb_secret_…` key is an opaque string that a JWT decoder cannot read, so a
 * check written only for JWTs would have called it unreadable and refused it
 * for the wrong reason — and would have accepted it the moment somebody
 * relaxed that branch.
 *
 * WHY A SCRIPT AT ALL. Copying config.example.js by hand works, and then two
 * separate things silently do not: the CSP has to name the project host or the
 * browser blocks every request, and the redirect URL has to match verbatim or
 * sign-in completes and the app never notices. Both produce failures that look
 * like application bugs. Printing them at the moment of setup is the cheapest
 * place to catch either.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "supabase/config.js");

const [, , url, anon, ...rest] = process.argv;
const redirect = rest[0] || "https://alwodouh.com/app/index.html";

function die(msg) { console.error("\n" + msg + "\n"); process.exit(1); }

if (!url || !anon) {
  die("usage: node tools/setup-supabase.mjs <project-url> <anon-key> [redirect-url]\n" +
      "       both values come from Supabase → Settings → API");
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  die(`That does not look like a project URL: ${url}\n` +
      "Expected something like https://abcdefghijklm.supabase.co");
}

/* Which of the four shapes is this? Explicit rather than inferred, so an
   unrecognised key is refused rather than written into a file served to every
   visitor. Nothing here verifies a signature — we hold no key and do not need
   to; this guards against a paste mistake, and a paste mistake does not forge
   anything. */
function classify(key) {
  if (/^sb_secret_/.test(key)) return "secret";
  if (/^sb_publishable_/.test(key)) return "public";
  if (/^eyJ/.test(key)) {
    try {
      const body = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
      if (body.role === "service_role") return "secret";
      if (body.role === "anon") return "public";
    } catch { /* falls through to unknown */ }
  }
  return "unknown";
}

const kind = classify(anon);

if (kind === "secret") {
  die("REFUSED: that is a SECRET key.\n\n" +
      "It bypasses row level security completely. Anyone who reads this file —\n" +
      "and it is served to every visitor — could read and change every row in\n" +
      "your database, including other people's employment contracts.\n\n" +
      "Use the publishable key (`sb_publishable_…`, or the legacy one labelled\n" +
      "`anon` `public`). The secret key goes in `supabase secrets set`, on your\n" +
      "machine, and nowhere else.\n\n" +
      "If you have already pasted that key anywhere it could be read — a chat,\n" +
      "an email, a commit — ROTATE IT NOW in Settings → API.");
}
if (kind !== "public") {
  die("REFUSED: this does not look like a publishable key.\n\n" +
      "Expected `sb_publishable_…` or a legacy `eyJ…` token whose role is\n" +
      "`anon`. Copy it from Settings → API, under Publishable / anon public.");
}

if (existsSync(OUT)) {
  const cur = readFileSync(OUT, "utf8");
  if (!cur.includes("YOUR-PROJECT-REF")) {
    die(`${path.relative(ROOT, OUT)} already exists and is filled in.\n` +
        "Delete it first if you really mean to point the app at a different project.");
  }
}

const host = url.replace(/\/$/, "");
writeFileSync(OUT, `/* Wodouh — public runtime configuration.
 *
 * Written by tools/setup-supabase.mjs. Gitignored.
 *
 * Both values are PUBLIC by design. The publishable key identifies the project
 * and nothing else; it grants no access on its own, because every table is
 * behind row level security. The SECRET key (\`sb_secret_…\`, or a legacy
 * service_role token) is the opposite and must never appear here — it belongs
 * only in Supabase Edge Function secrets.
 */
window.WODOUH_CONFIG = {
  SUPABASE_URL: ${JSON.stringify(host)},
  SUPABASE_ANON_KEY: ${JSON.stringify(anon)},
  REDIRECT_URL: ${JSON.stringify(redirect)}

  /* Add when the analyze function is deployed AND you have read
     docs/claude-analysis.md — it changes what the privacy copy must say:
     , ANALYZE_URL: ${JSON.stringify(host + "/functions/v1/analyze")} */

  /* Add once Apple Sign-In is configured in Supabase → Auth → Providers:
     , APPLE_SIGNIN: true */
};
`);

console.log(`
Wrote ${path.relative(ROOT, OUT)} — gitignored, as it should be.

TWO THINGS THAT ARE NOT DONE YET, and both fail in ways that look like app bugs:

1. CONTENT SECURITY POLICY. app/index.html ships connect-src 'none'. Until your
   project host is in it, the browser blocks every request and the app looks
   broken for no visible reason. Add exactly this host — not a wildcard, because
   *.supabase.co is a shared hostname anyone can register a project inside:

       connect-src ${host}

2. REDIRECT URL. In Supabase → Authentication → URL Configuration → Redirect
   URLs, add this line VERBATIM:

       ${redirect}

   A mismatch here is the single most common cause of "sign-in succeeds but the
   app never signs in".

THEN, in order:

   supabase link --project-ref ${host.match(/https:\/\/([a-z0-9-]+)\./)[1]}
   supabase db push              # applies all five migrations
   # add yourself to public.admins with role 'owner' — in the dashboard,
   # because no client policy can do it
`);
