/* Point Wodouh at a Supabase project, and open the policy that lets it talk.
 *
 *   node tools/setup-supabase.mjs https://YOUR-REF.supabase.co sb_publishable_...
 *
 * WHAT IT EDITS, AND WHY NOT A CONFIG FILE. It writes the project into the
 * inline WODOUH_CONFIG block of app/index.html and admin/index.html, and opens
 * `connect-src` in each file's CSP in the same run.
 *
 * The first version of this script wrote supabase/config.js instead. That file
 * is GITIGNORED and nothing in the app loads it, so running the script as
 * documented would have produced a working-looking success message and a
 * deployed site where accounts, flags and the console stayed silently dark,
 * with no error to explain it. The config is inline for a reason the app states
 * itself: turning on the network and opening the policy that permits it must
 * land in the same diff, where one reviewer sees both.
 *
 * TWO KEY FORMATS, BOTH ACCEPTED:
 *
 *   public   legacy `eyJ…` JWT with role "anon"   ·   new `sb_publishable_…`
 *   secret   legacy `eyJ…` with role service_role ·   new `sb_secret_…`
 *
 * WHAT IT REFUSES TO WRITE. A secret key, in either format. That key bypasses
 * row level security entirely; it belongs in `supabase secrets set`, typed by
 * you, and nowhere else. This matters MORE with the new format: an
 * `sb_secret_…` key is opaque, so a check written only for JWTs called it
 * "unreadable" and refused it for the wrong reason — one relaxed branch away
 * from writing a key that bypasses RLS into a file served to every visitor.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "app/index.html");
const ADMIN = path.join(ROOT, "admin/index.html");
const ADMIN_CFG = path.join(ROOT, "admin/config.js");

const [, , rawUrl, key, ...rest] = process.argv;
const redirect = rest[0] || "https://alwodouh.com/app/index.html";

function die(msg) { console.error("\n" + msg + "\n"); process.exit(1); }

if (!rawUrl || !key) {
  die("usage: node tools/setup-supabase.mjs <project-url> <publishable-key> [redirect-url]\n" +
      "       both values come from Supabase -> Settings -> API");
}

/* Accepts the bare project URL or the REST endpoint, because Settings -> API
   shows the second one and pasting what is on screen should just work. */
const host = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(host)) {
  die("That does not look like a project URL: " + rawUrl + "\n" +
      "Expected something like https://abcdefghijklm.supabase.co");
}

/* Explicit classification. Nothing here verifies a signature — we hold no key
   and do not need to; this guards against a paste mistake, and a paste mistake
   does not forge anything. */
function classify(k) {
  if (/^sb_secret_/.test(k)) return "secret";
  if (/^sb_publishable_/.test(k)) return "public";
  if (/^eyJ/.test(k)) {
    try {
      const body = JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString("utf8"));
      if (body.role === "service_role") return "secret";
      if (body.role === "anon") return "public";
    } catch { /* unknown */ }
  }
  return "unknown";
}

const kind = classify(key);
if (kind === "secret") {
  die("REFUSED: that is a SECRET key.\n\n" +
      "It bypasses row level security completely. Anyone who reads the app -\n" +
      "and it is served to every visitor - could read and change every row in\n" +
      "your database, including other people's employment contracts.\n\n" +
      "Use the publishable key (sb_publishable_..., or the legacy one labelled\n" +
      "anon public). The secret key goes in `supabase secrets set`, on your\n" +
      "machine, and nowhere else.\n\n" +
      "If you have already pasted that key anywhere it could be read - a chat,\n" +
      "an email, a commit - ROTATE IT NOW in Settings -> API.");
}
if (kind !== "public") {
  die("REFUSED: this does not look like a publishable key.\n\n" +
      "Expected sb_publishable_... or a legacy eyJ... token whose role is\n" +
      "anon. Copy it from Settings -> API, under Publishable / anon public.");
}

/* ---------------------------------------------------------------- the edits
   EVERY EDIT IS ANCHORED AND COUNTED. An earlier version matched connect-src
   with an unanchored character class that ran past newlines, and merged a
   documentation comment into the live policy tag of a 640 KB file. So each
   replacement must match EXACTLY ONCE or the script writes nothing at all. A
   tool that half-edits a file it does not understand is worse than one that
   stops. */
const q = (v) => JSON.stringify(v);

function once(src, re, what, label) {
  const n = (src.match(re) || []).length;
  if (n !== 1) {
    die("REFUSED: found " + n + " matches for " + what + " in " + label + ", expected exactly 1.\n" +
        "The file has changed shape. Fix this script rather than let it guess.");
  }
}

const CFG = /(window\.WODOUH_CONFIG = Object\.assign\(\{)[\s\S]*?(\}, window\.WODOUH_CONFIG \|\| \{\}\);)/;
/* Inside the meta tag only, never in the prose above it that spells out the
   same directive as an instruction. */
/* The two pages start from different policies and must end at different ones.
   app/ ships `connect-src 'none'` and becomes the project host alone. admin/
   ships `connect-src 'self'` and must KEEP 'self': its status panel reads the
   deployed files at this origin, which is the one part of the console that
   works with no credentials at all. Replacing 'self' would have broken it. */
/* CAPTURE THE WHOLE DIRECTIVE, UP TO THE SEMICOLON. The first version
   alternated ('none'|'self'|'self' https://…). Regex alternation is
   leftmost-first, so against `connect-src 'self' https://old.supabase.co` it
   matched the bare 'self' and STOPPED — leaving the old host in the file and
   prepending the new one. Re-running accumulated hosts, and the exact-once
   guard could not see it, because the regex still matched exactly once.

   Harmless as duplication. Not harmless as behaviour: point the app at a
   different project and the previous project's origin stays allowed in
   connect-src forever, which is a stale hole in the one directive that says
   where this page may talk to. */
const CSP = /(<meta http-equiv="Content-Security-Policy"[^>]*?connect-src )([^;"]+)/;
const cspValue = (current, h) => /'self'/.test(current) ? "'self' " + h : h;

/* PRE-FLIGHT EVERY FILE BEFORE WRITING ANY OF THEM. The first version checked
   and wrote one file at a time, so a failure on the second left the first
   already edited — a half-configured app, which is the state this script
   exists to prevent. Found by the guard firing for real. */
function check(file, label, wantCfg) {
  const src = readFileSync(file, "utf8");
  if (wantCfg) once(src, new RegExp(CFG.source, "g"), "the WODOUH_CONFIG block", label);
  once(src, new RegExp(CSP.source, "g"), "connect-src inside the CSP meta tag", label);
}

/* THE CONSOLE GETS A FILE, NOT AN INLINE BLOCK, and that is not a style
   choice. admin/index.html ships `script-src 'self'` with no 'unsafe-inline',
   so an inline config is REFUSED by the browser — which is exactly what
   happened the first time this ran: correct values written into the file, the
   script never executed, and the console reading "Not connected" forever with
   nothing on screen to explain it.

   The app keeps its config inline because it stays a single file on purpose
   and its own policy permits it. The console is already multi-file, so an
   external config costs nothing there and its policy stays strict. */
function writeAdminConfig() {
  writeFileSync(ADMIN_CFG,
    "/* Wodouh — the founder console's public configuration.\n" +
    " *\n" +
    " * Written by tools/setup-supabase.mjs. COMMITTED ON PURPOSE: these values\n" +
    " * are public by design, and the deployed console cannot reach the project\n" +
    " * unless they ship with it.\n" +
    " *\n" +
    " * An empty object is a valid state — every panel then says it is not\n" +
    " * connected rather than failing, and the status panel still works, because\n" +
    " * it reads the deployed files at this origin and needs no credentials.\n" +
    " *\n" +
    " * NO REDIRECT_URL HERE, DELIBERATELY. app/auth.js falls back to\n" +
    " * location.origin + location.pathname when the key is absent, which sends an\n" +
    " * operator back to /admin/ after Google. Setting it to the app's URL — as this\n" +
    " * file once did — signed you in and then dropped you in the product, on the\n" +
    " * one screen where you had come to do something else.\n" +
    " */\n" +
    "window.WODOUH_CONFIG = Object.assign({\n" +
    "  SUPABASE_URL: " + q(host) + ",\n" +
    "  SUPABASE_ANON_KEY: " + q(key) + "\n" +
    "}, window.WODOUH_CONFIG || {});\n");
}

/* The console needs its policy opened, but has no config block to edit. */
function editCsp(file, label) {
  const before = readFileSync(file, "utf8");
  const after = before.replace(CSP, (m, lead, current) => lead + cspValue(current, host));
  if (after === before) die("connect-src did not change in " + label + ".");
  writeFileSync(file, after);
  return after.length - before.length;
}

function edit(file, label) {
  const before = readFileSync(file, "utf8");

  let after = before.replace(CFG, (m, open, close) =>
    open + "\n" +
    "  SUPABASE_URL: " + q(host) + ",\n" +
    "  SUPABASE_ANON_KEY: " + q(key) + ",\n" +
    "  REDIRECT_URL: " + q(redirect) + ",\n" +
    "  /* Uncomment once supabase/functions/analyze is deployed AND you have read\n" +
    "     docs/claude-analysis.md - it changes what the privacy copy must say.\n" +
    "  ANALYZE_URL: " + q(host + "/functions/v1/analyze") + ", */\n" +
    "  ANALYZE_URL: \"\"\n" + close);

  after = after.replace(CSP, (m, lead, current) => lead + cspValue(current, host));

  /* Re-running with the same values is a legitimate thing to do — checking a
     setup, or after a git checkout — and it produces an identical file. The
     first version treated that as "an anchor matched itself" and died, which
     is a guard firing on success. Only an unchanged file that does NOT already
     carry the intended config is a real failure. */
  if (after === before) {
    if (before.indexOf("SUPABASE_URL: " + q(host)) === -1) {
      die("Nothing changed in " + label + " and it does not already hold this project.\n" +
          "An anchor matched itself. Fix this script rather than let it guess.");
    }
    console.log("  " + label + " already holds this project — left as is.");
    return 0;
  }
  writeFileSync(file, after);
  return after.length - before.length;
}

check(APP, "app/index.html", true);
check(ADMIN, "admin/index.html", false);

const d1 = edit(APP, "app/index.html");
const d2 = editCsp(ADMIN, "admin/index.html");
writeAdminConfig();
const ref = host.slice("https://".length).split(".")[0];

console.log("\n" +
"Wrote the project into app/index.html (inline, " + d1 + " bytes) and admin/config.js (new file),\n" +
"and opened connect-src to " + host + " in both pages.\n" +
"\n" +
"COMMIT BOTH FILES. These values are public by design, and the deployed site\n" +
"cannot reach your project until they ship.\n" +
"\n" +
"ONE THING ONLY YOU CAN DO, and it fails in a way that looks like an app bug:\n" +
"\n" +
"  Supabase -> Authentication -> URL Configuration -> Redirect URLs\n" +
"  Add this line VERBATIM:\n" +
"\n" +
"      " + redirect + "\n" +
"\n" +
"  A mismatch here is the usual cause of \"sign-in succeeds but the app never\n" +
"  signs in\".\n" +
"\n" +
"THEN, in order:\n" +
"\n" +
"   supabase link --project-ref " + ref + "\n" +
"   supabase migration list       # check the filenames BEFORE pushing\n" +
"   supabase db push              # applies all five migrations\n" +
"   # then add yourself to public.admins with role 'owner', in the dashboard -\n" +
"   # no client policy can do it, deliberately\n");
