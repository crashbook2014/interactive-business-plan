/* Row level security, run against a real Postgres.
 *
 * WHAT CHANGED. Every migration in supabase/migrations/ had never been
 * executed — not once, anywhere. schema.test.js reads them as text, which
 * catches a missing policy and cannot catch a policy that does not compile, a
 * trigger that references a column that is not there, or a permission that is
 * granted by accident. This suite executes all five against PostgreSQL and
 * then asks the database the questions that actually matter:
 *
 *   - is a viewer REFUSED a flag change, by Postgres rather than by the page
 *   - is an owner ALLOWED one, so the refusal above means something
 *   - does the audit trigger fire, and can any client role forge, amend or
 *     delete what it wrote
 *   - can a client insert itself into admins — the console granting itself
 *     access is the failure that would make every other control decorative
 *   - can user B read or change user A's employment situation
 *
 * WHAT IT STILL DOES NOT PROVE. It is not Supabase. test/pg-shim.sql creates
 * the objects the migrations reference and nothing more, so GoTrue, JWT
 * signature verification and PostgREST are all out of scope. Green here means
 * the SQL executes and the policies refuse what they should. It does not mean
 * sign-in works.
 *
 * SKIPS RATHER THAN FAILS where there is no Postgres, so this never breaks
 * another machine or a CI runner that has no database.
 */
const { execFileSync } = require("node:child_process");
const { writeFileSync, mkdtempSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DB = "wodouh_rls_test";
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* World-readable on purpose: psql runs as the postgres user, and mkdtemp
   creates 0700 directories owned by whoever is running the tests. Without the
   chmod every statement fails with "Permission denied" from psql, which reads
   like a database problem and is not one. */
const tmp = mkdtempSync(path.join(os.tmpdir(), "wodouh-rls-"));
require("node:fs").chmodSync(tmp, 0o755);

/* Everything goes through a file rather than -c, because these statements
   contain quotes, dollar-quoting and Arabic, and shell-escaping all three
   correctly every time is a bug waiting to happen. */
function psql(sql, { db = DB } = {}) {
  const f = path.join(tmp, "q.sql");
  writeFileSync(f, sql, { mode: 0o644 });
  return execFileSync("su", ["postgres", "-c",
    `psql -v ON_ERROR_STOP=1 -tAq -d ${db} -f ${f}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
/* Did this statement get refused? Returns null on success, the error on
   refusal — so a test reads as the question it is asking.

   ONLY USE THIS FOR INSERT. Row level security refuses the three write verbs
   in two different ways, and conflating them is how a permission test comes to
   pass for the wrong reason: an INSERT that violates a with-check RAISES,
   while an UPDATE or DELETE whose rows the policy hides simply affects NOTHING
   and reports success. Asking `refused()` about an update therefore gets
   "no error" back and reads it as "allowed", which is exactly backwards. Use
   unchanged() for those. */
function refused(sql) {
  try { psql(sql); return null; } catch (e) {
    return String(e.stderr || e.message).split("\n").find(l => /ERROR|error/.test(l)) || "refused";
  }
}

/* Did this update or delete reach anything? Runs the mutation as the given
   user, then reads the world back as a role that can see everything, and
   compares. This is the honest question for a verb RLS answers with silence. */
function unchanged(uuid, mutation, probe, expected) {
  try { psql(asUser(uuid, mutation)); } catch (e) { /* a raise is also a refusal */ }
  return psql(probe).trim() === expected;
}
/* Runs as a signed-in client, exactly as PostgREST would: the id goes into the
   same session setting auth.uid() reads, and the role is switched so RLS
   applies. The policies are exercised as written — none is modified for the
   test, which is the only version of this worth running. */
const asUser = (uuid, sql) =>
  `select auth.test_login('${uuid}'::uuid);\nset role authenticated;\n${sql}\nreset role;`;

function available() {
  try {
    execFileSync("su", ["postgres", "-c", "psql -tAc 'select 1'"], { stdio: "ignore" });
    return true;
  } catch { return false; }
}

if (!available()) {
  console.log("\n— SKIPPED: no local PostgreSQL. Start one with `pg_ctlcluster 16 main start`,");
  console.log("  or run this on a machine that has Postgres 16. Everything else still runs.");
  process.exit(0);
}

/* ---- build the database from nothing, every run */
console.log("\n— applying the shim and all five migrations to a fresh database");
try {
  execFileSync("su", ["postgres", "-c", `dropdb --if-exists ${DB} && createdb ${DB}`], { stdio: "ignore" });
  psql(require("node:fs").readFileSync(path.join(ROOT, "test/pg-shim.sql"), "utf8"));
  const files = require("node:fs").readdirSync(path.join(ROOT, "supabase/migrations"))
    .filter(f => f.endsWith(".sql")).sort();
  for (const f of files) {
    psql(require("node:fs").readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8"));
    console.log("  ok   " + f + " applied");
  }
  ok(files.length === 5, `all ${files.length} migrations executed without an error`);
} catch (e) {
  console.log("  FAIL a migration did not apply:\n" + String(e.stderr || e.message).slice(0, 1200));
  process.exit(1);
}

/* ---- four identities: two ordinary readers, an owner, a viewer */
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const OWNER = "33333333-3333-4333-8333-333333333333";
const VIEWER = "44444444-4444-4444-8444-444444444444";
/* A failed statement anywhere below should read as a test failure, not as a
   Node stack trace. */
process.on("uncaughtException", (e) => {
  console.log("  FAIL an unexpected database error:\n" +
    String(e.stderr || e.message).split("\n").slice(0, 4).join("\n"));
  process.exit(1);
});

psql(`
insert into auth.users (id, email) values
  ('${A}','a@example.com'), ('${B}','b@example.com'),
  ('${OWNER}','owner@example.com'), ('${VIEWER}','viewer@example.com');
insert into public.admins (user_id, role) values
  ('${OWNER}','owner'), ('${VIEWER}','viewer');
`);

/* ================================================== the console's controls */
console.log("\n— only an owner may move a switch, and Postgres is what decides");

const before = psql(asUser(OWNER, `select enabled from public.app_flags where key='payments';`)).trim();
ok(before === "f", "payments starts off, as seeded");

const viewerTried = psql(asUser(VIEWER,
  `update public.app_flags set enabled = true where key='payments';
   select count(*) from public.app_flags where key='payments' and enabled;`));
ok(viewerTried.trim().split("\n").pop() === "0",
   "a viewer's update changes nothing — RLS filters the row out rather than raising");

const anonTried = psql(`set role anon;
  update public.app_flags set enabled = true where key='payments';
  reset role;
  select count(*) from public.app_flags where key='payments' and enabled;`);
ok(anonTried.trim().split("\n").pop() === "0", "and a signed-out visitor changes nothing either");

const ownerTried = psql(asUser(OWNER,
  `update public.app_flags set enabled = true where key='payments';
   select enabled from public.app_flags where key='payments';`));
ok(ownerTried.trim().split("\n").pop() === "t",
   "an owner CAN turn it on — so the two refusals above are about permission, not about nothing working");

console.log("\n— the switch is world-readable, because every reader's app needs it");
const anonRead = psql(`set role anon; select count(*) from public.app_flags; reset role;`);
ok(Number(anonRead.trim()) === 5, `a signed-out visitor reads all ${anonRead.trim()} flags`);

/* ================================================== the record of what moved */
console.log("\n— the audit log records the change and cannot be forged");
const logged = psql(asUser(OWNER,
  `select key || ':' || from_enabled || '->' || to_enabled || ':' || (changed_by = '${OWNER}')
     from public.flag_audit order by id desc limit 1;`));
ok(logged.trim() === "payments:false->true:true",
   `the trigger wrote the change, with the right before, after and author (${logged.trim()})`);

ok(!!refused(asUser(OWNER,
   `insert into public.flag_audit (key, to_enabled) values ('payments', false);`)),
   "an OWNER cannot insert a log entry — not even the person allowed to move switches");
ok(unchanged(OWNER, `update public.flag_audit set to_enabled = false;`,
   `select count(*) from public.flag_audit where to_enabled;`, "1"),
   "nor amend one — the update reaches no row");
ok(unchanged(OWNER, `delete from public.flag_audit;`,
   `select count(*) from public.flag_audit;`, "1"),
   "nor delete the one they wish had not happened");

const viewerReads = psql(asUser(VIEWER, `select count(*) from public.flag_audit;`));
ok(Number(viewerReads.trim()) === 1, "a viewer can read the log, which is the point of having one");
const strangerReads = psql(asUser(A, `select count(*) from public.flag_audit;`));
ok(Number(strangerReads.trim()) === 0, "someone who is not an operator sees nothing of it");

console.log("\n— nothing reachable from a browser can create an operator");
ok(!!refused(asUser(A, `insert into public.admins (user_id, role) values ('${A}','owner');`)),
   "an ordinary user cannot make themselves an owner");
ok(!!refused(asUser(OWNER, `insert into public.admins (user_id, role) values ('${A}','owner');`)),
   "and neither can an existing owner — the console cannot grant access, only the dashboard can");
ok(unchanged(VIEWER, `update public.admins set role='owner' where user_id='${VIEWER}';`,
   `select role from public.admins where user_id='${VIEWER}';`, "viewer"),
   "a viewer cannot promote themselves — the update reaches no row");

console.log("\n— a flag can be flipped and never invented or removed");
ok(!!refused(asUser(OWNER, `insert into public.app_flags (key) values ('free_money');`)),
   "an owner cannot add a flag the app does not know about");
ok(unchanged(OWNER, `delete from public.app_flags where key='payments';`,
   `select count(*) from public.app_flags;`, "5"),
   "nor delete one, which would silently read as off");

/* ================================================== ordinary readers' data */
console.log("\n— one reader cannot reach another's employment situation");
/* No explicit profile insert: 0003's handle_new_user trigger already created
   one for each auth.users row. Trying to add a second raises
   profiles_pkey — which is the trigger doing its job, and is worth asserting
   rather than working around. */
const autoProfiles = psql(`select count(*) from public.profiles;`);
ok(Number(autoProfiles.trim()) === 4,
   `the sign-up trigger created a profile for each of the ${autoProfiles.trim()} users, without anyone inserting one`);
psql(asUser(A, `insert into public.contracts (user_id, original_filename) values ('${A}','A-contract.pdf');`));

const bSees = psql(asUser(B, `select count(*) from public.contracts;`));
ok(Number(bSees.trim()) === 0, "B sees none of A's contracts");
const aSees = psql(asUser(A, `select count(*) from public.contracts;`));
ok(Number(aSees.trim()) === 1, "and A still sees their own, so the filter is scoped and not blanket");

ok(unchanged(B, `update public.contracts set original_filename='mine-now.pdf';`,
   `select original_filename from public.contracts;`, "A-contract.pdf"),
   "B's update reaches nothing — A's row is unchanged");

console.log("\n— the secrets table is closed to every client, by privilege and by policy");
ok(!!refused(asUser(A, `select * from public.integration_secrets;`)),
   "a signed-in user cannot read integration_secrets at all");

/* ============================================ can these tests actually fail?
   A permission test that has never failed has not been shown to test
   anything. Each of these opens the exact hole the assertion above claims is
   closed, confirms the database now allows it, and closes it again. */
console.log("\n— and every one of those refusals can be made to fail on purpose");

psql(`create policy tmp_open on public.flag_audit for insert to authenticated with check (true);`);
const forgeNowWorks = refused(asUser(OWNER,
  `insert into public.flag_audit (key, to_enabled) values ('forged', true);`)) === null;
psql(`drop policy tmp_open on public.flag_audit;`);
ok(forgeNowWorks, "adding an insert policy to flag_audit lets a forgery through — so its absence is what stops one");

psql(`create policy tmp_admins on public.admins for insert to authenticated with check (true);`);
const grantNowWorks = refused(asUser(A,
  `insert into public.admins (user_id, role) values ('${A}','owner');`)) === null;
psql(`drop policy tmp_admins on public.admins;`);
ok(grantNowWorks, "adding one to admins lets a user make themselves an owner — so its absence is the control");

psql(`alter policy app_flags_update on public.app_flags using (true) with check (true);`);
const viewerNowWorks = psql(asUser(VIEWER,
  `update public.app_flags set enabled = false where key='payments';
   select enabled from public.app_flags where key='payments';`)).trim().split("\n").pop() === "f";
psql(`alter policy app_flags_update on public.app_flags
        using (public.is_admin('owner')) with check (public.is_admin('owner'));`);
ok(viewerNowWorks, "opening the flag policy lets a viewer move a switch — so is_admin('owner') is doing the work");

console.log(FAIL.length
  ? `\n${FAIL.length} FAILURES`
  : "\nthe migrations execute and row level security refuses what it should" +
    " — NOTE: this is Postgres, not Supabase. GoTrue, JWT verification and PostgREST are not exercised here.");
process.exit(FAIL.length ? 1 : 0);
