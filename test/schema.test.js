/* The database, checked as source.
 *
 * HONEST SCOPE FIRST. What follows is STATIC ANALYSIS — it reads every
 * migration and asserts the properties that, if missing, are silent. A missing
 * RLS policy does not error; it just lets one user read another's employment
 * situation, and nothing anywhere says so.
 *
 * Since 22 August 2026 it has a companion that does the other half:
 * test/rls.test.js applies these migrations to a REAL PostgreSQL and asks the
 * database whether the policies actually refuse what they should. Both are
 * worth having. This file catches a table added with no policy at all — which
 * a live test cannot see, because there is nothing to try. That one catches a
 * policy that does not compile, a trigger reading a column that is not there,
 * and a grant that quietly opens what a policy was meant to close.
 *
 * So these are the invariants worth pinning without a server:
 *
 *   - every table holding user data has RLS ON, and a policy for all four
 *     operations. Enabling RLS without a policy denies everything; adding a
 *     table without enabling it exposes everything. Both are silent.
 *   - every policy scopes to auth.uid(), and every UPDATE carries a with-check
 *     — the clause that stops a user reassigning their row to someone else
 *   - marketing consent defaults to FALSE and cannot be true without a record
 *     of when it was given and what was shown
 *   - the schema stores no contract text, which is the promise 0001 was
 *     written around and the one the privacy copy in the app depends on
 *
 * These run over ALL migrations, not just the newest, so the next table added
 * without a policy fails here rather than in production.
 */
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "supabase", "migrations");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

const files = readdirSync(DIR).filter(f => f.endsWith(".sql")).sort();
const sql = files.map(f => readFileSync(path.join(DIR, f), "utf8")).join("\n");

/* Comments carry the words we search for — "contract text", "auth.uid()" —
   so every structural check runs on code with comments stripped. */
const code = sql.replace(/--[^\n]*/g, "");

console.log(`\n— ${files.length} migrations: ${files.join(", ")}`);

/* ---- 1. every user table is protected */
console.log("\n— every table holding user data has RLS on, with a policy per operation");
const tables = [...code.matchAll(/create table (?:if not exists )?public\.(\w+)/g)].map(m => m[1]);
ok(tables.length >= 7, `${tables.length} tables found: ${tables.join(", ")}`);

/* A table is safe in one of exactly two ways, and the test has to know both.
   0002 deliberately ships tables with RLS ON and NO policies — with rights
   revoked from anon and authenticated, that is the STRICTEST configuration
   there is: only the service role, inside an Edge Function, can touch them.
   Demanding four policies there would push a genuinely locked table towards
   being opened.

   So the property is: every table is either owner-scoped (a policy per
   operation, keyed to auth.uid()) or explicitly revoked from client roles. A
   table that is neither is the silent hole this file exists to catch. */
for (const t of tables) {
  ok(new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(code),
     `${t}: row level security is enabled`);

  const revoked = new RegExp(`revoke all on public\\.${t} from [^;]*authenticated`).test(code);
  const ops = ["select", "insert", "update", "delete"].filter(op =>
    new RegExp(`create policy \\w+ on public\\.${t}\\s+for ${op}\\b`, "s").test(code));

  if (revoked) {
    ok(ops.length === 0,
       `${t}: locked to the service role — revoked from clients, and no policy re-opens it${ops.length ? " (but " + ops.join(", ") + " exists)" : ""}`);
    continue;
  }
  /* profiles has no delete on purpose: an account goes through auth.users,
     which cascades. integration_providers is public reference data with a
     read-only policy and no owner. */
  /* Some tables are read-and-revoke: a client may see its own rows and remove
     them, while WRITES happen only in an Edge Function. Fewer policies there
     is a narrower surface, not a gap — so the floor is "select is scoped",
     and anything more is a bonus. */
  /* 0005's three tables are the strictest shape a client-reachable table can
     take: RLS on, exactly the policies the product needs, and nothing else —
     so every operation without a policy is denied. admins has no write policy
     at all, which is why making yourself an operator requires the dashboard.
     flag_audit has no write policy either, which is what makes the log
     unforgeable: only the trigger writes it. */
  const PARTIAL = { profiles: 3, integration_providers: 1,
                    integration_connections: 2, integration_events: 1,
                    admins: 1, app_flags: 2, flag_audit: 1 };
  const need = PARTIAL[t] || 4;
  ok(ops.length >= need,
     `${t}: reachable by clients, so it carries ${ops.length}/${need} policies (${ops.join(", ") || "none"})`);
}

/* Public reference data: a catalogue with no owner, where a READ legitimately
   does not name auth.uid(). Named explicitly so a future unscoped policy on a
   table that does have an owner still fails.

   app_flags is here because every reader's app must know whether payments are
   live before anyone signs in. Note what this exemption does NOT cover: it
   applies to `for select` only, so the write policies on these tables are held
   to the same standard as everywhere else. */
const REFERENCE = new Set(["integration_providers", "app_flags"]);

/* ---- 2. every policy is scoped, and updates cannot reassign a row */
console.log("\n— no policy is open, and no update can hand a row to someone else");
const policies = [...code.matchAll(
  /create policy (\w+) on public\.(\w+)\s+for (\w+)([\s\S]*?);/g)];
ok(policies.length >= 25, `${policies.length} policies parsed`);

/* A policy may scope directly, or through a function that scopes. Which
   functions those are is DERIVED from the SQL rather than listed here: a
   helper only counts if its own body names auth.uid(). So a future
   `public.is_staff()` that forgot to check anything cannot launder an open
   policy past this test. */
const SCOPING_FNS = [...code.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)([\s\S]*?)\$\$([\s\S]*?)\$\$/g)]
  .filter(m => /auth\.uid\(\)/.test(m[4]))
  .map(m => m[1]);
const scoped = body =>
  /auth\.uid\(\)/.test(body) ||
  SCOPING_FNS.some(fn => new RegExp(`public\\.${fn}\\s*\\(`).test(body));

const unscoped = policies.filter(([, , tbl, op, body]) =>
  !(REFERENCE.has(tbl) && op === "select") && !scoped(body));
ok(unscoped.length === 0,
   `every policy scopes to auth.uid(), directly or through a function that does${unscoped.length ? " — open: " + unscoped.map(p => p[1]).join(", ") : ""}`);
ok(SCOPING_FNS.length > 0, `${SCOPING_FNS.length} scoping helpers verified to name auth.uid() themselves: ${SCOPING_FNS.join(", ")}`);

const updates = policies.filter(p => p[3] === "update");
const noCheck = updates.filter(p => !/with check/i.test(p[4]));
ok(updates.length > 0 && noCheck.length === 0,
   `all ${updates.length} update policies carry a with-check${noCheck.length ? " — missing on " + noCheck.map(p => p[1]).join(", ") : ""}`);

/* ---- 3. consent is recorded, never assumed */
console.log("\n— marketing consent is off by default and cannot be true silently");
ok(/phone_marketing_consent boolean not null default false/.test(code),
   "phone_marketing_consent defaults to false");
ok(/phone_marketing_consent = false\s*\n?\s*or \(phone_consent_at is not null and phone_consent_text is not null\)/.test(code),
   "and cannot be true without a timestamp AND the exact wording that was shown");
ok(/phone_number[\s\S]{0,200}?phone_marketing_consent/.test(code),
   "the number and the permission to use it are separate columns, so storing one never implies the other");

/* The number must never become a credential. */
ok(!/phone[\s\S]{0,40}(otp|verify|verification|sign_?in)/i.test(code),
   "nothing in the schema ties the phone number to verification or sign-in");

/* ---- 4. the promise 0001 was written around */
console.log("\n— the schema still stores no contract text");
const BANNED = ["contract_text", "clause_text", "raw_text", "document_text", "pdf_bytes", "file_bytes", "quote"];
const found = BANNED.filter(c => new RegExp(`\\b${c}\\b`).test(code));
ok(found.length === 0,
   `no column stores document contents${found.length ? " — found: " + found.join(", ") : ""}`);
ok(/pg_column_size\(red_flags\)/.test(code),
   "and the findings columns carry a size ceiling, so quoted contract text cannot be smuggled into jsonb");

/* ---- 5. ownership of a child row is decided by the parent, not the client */
console.log("\n— a client cannot attach its analysis to someone else's contract");
ok(/new\.user_id\s*:=\s*owner/.test(code),
   "the trigger overwrites whatever user_id the client sent with the contract's real owner");
ok(/contract_analyses_insert[\s\S]*?exists \([\s\S]*?from public\.contracts c[\s\S]*?c\.user_id = \(select auth\.uid\(\)\)/.test(code),
   "and the insert policy independently requires the parent contract to be the caller's");

/* ---- 6. erasure exists as code, not as a support promise */
console.log("\n— a user can delete their own account");
ok(/create or replace function public\.delete_my_account\(\)/.test(code),
   "delete_my_account() exists");
ok(/revoke all on function public\.delete_my_account\(\) from public/.test(code),
   "it is revoked from public");
ok(/grant execute on function public\.delete_my_account\(\) to authenticated/.test(code),
   "and granted only to a signed-in user");

/* Every security-definer function must pin search_path, or a caller can shadow
   the tables it references and run its body against their own. */
console.log("\n— every security definer function pins its search path");
/* Parameters allowed in the match, not just `()`: the original only caught
   zero-argument functions, so a security definer helper taking a parameter —
   exactly what public.is_admin(text) is — would have slipped past the
   search_path check entirely. */
const definers = [...code.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)[\s\S]*?\$\$/g)]
  .filter(m => /security definer/.test(m[0]));
const unpinned = definers.filter(m => !/set search_path\s*=\s*''/.test(m[0]));
ok(definers.length > 0 && unpinned.length === 0,
   `all ${definers.length} security definer functions set search_path${unpinned.length ? " — missing on " + unpinned.map(m => m[1]).join(", ") : ""}`);

/* ---- 7. the one-paste copy cannot go stale
   tools/apply-all.sql is every migration concatenated for the Supabase SQL
   Editor, for when the CLI is not available. A hand-kept copy of five files is
   a copy that goes stale the first time one of them changes, and nothing would
   say so — the same argument that guards corpus.json. */
console.log("\n— the SQL-editor paste is still the migrations it claims to be");
{
  const { execFileSync } = require("node:child_process");
  const fresh = execFileSync("node", ["-e",
    `import(${JSON.stringify("file://" + path.join(DIR, "..", "..", "tools/make-sql-paste.mjs"))})` +
    `.then(m => process.stdout.write(m.buildPaste()))`],
    { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const committed = readFileSync(path.join(DIR, "..", "..", "tools/apply-all.sql"), "utf8");
  ok(fresh === committed,
     "tools/apply-all.sql matches what the migrations generate today" +
     (fresh === committed ? "" : " — run: node tools/make-sql-paste.mjs"));

  /* Every migration present, in order, and each recorded for the CLI. */
  for (const f of files) {
    ok(committed.includes("-- " + f), `${f} is in the paste`);
    const version = f.split("_")[0];
    ok(new RegExp(`\\('${version}', '`).test(committed),
       `and ${version} is recorded in schema_migrations, so db push will not re-run it`);
  }
  ok(/^begin;/m.test(committed) && /^commit;/m.test(committed),
     "the whole thing is one transaction, so a failed re-run leaves the database unchanged");
  ok(/public\.admins/.test(committed) && /^-- insert into public\.admins/m.test(committed),
     "the become-an-operator step is present but commented out — it needs a user id that does not exist yet");
}

console.log(FAIL.length
  ? `\n${FAIL.length} FAILURES`
  : "\nthe schema holds — static analysis; rls.test.js runs the same SQL against a real Postgres");
process.exit(FAIL.length ? 1 : 0);
