# Wodouh — backend setup

**Last updated 22 August 2026.** This page was stale in a way that would have
cost you an afternoon: it documented **two** migrations when there are **five**.
Following the old version left a database with no accounts, no uploads, and
none of the tables the founder console needs. Fixed below.

No Supabase project exists yet. The environment this was authored in cannot
reach `supabase.com` (the egress proxy returns 403 on CONNECT), so nothing here
has been run against a live project.

**What HAS been run, since 22 August 2026:** all five migrations execute
against a real PostgreSQL 16, and row level security has been tested by asking
the database rather than by reading the SQL. See `test/rls.test.js` and
`npm test`. That covers the schema and the policies. It does not cover GoTrue,
JWT verification or PostgREST, which only a live project can exercise.

What is also verified: the app runs exactly as before with none of this
configured. Sync is additive — if `config.js` is missing, the app is the
local-only product it is today.

---

## Decisions already taken

| | | |
|---|---|---|
| **Backend** | Supabase, kept | Owner, 22 Aug 2026 |
| **Region** | Frankfurt, `eu-central-1` | Owner, 22 Aug 2026 |
| **Tier** | Free now, upgrade before launch | Owner, 22 Aug 2026 |

**Region cannot be changed later** without recreating the project and migrating
the data.

### Why Supabase, when the app has no dependency on it

Written down because a decision without its reasoning gets reopened, and this
one was reopened once already.

The app is portable in principle: `package.json` has **zero runtime
dependencies**, there is no Supabase SDK, and `app/auth.js` is 476 lines of
plain `fetch`. What is *not* portable is the security model. **The 35 RLS
policies in `supabase/migrations/` ARE the authorization model** — they are why
`/admin/` can be a public page holding no credential, and why the audit log
cannot be forged. Postgres refuses; the page does not.

The alternatives worth considering — Firebase, Cloudflare D1, Appwrite — have
no database-level row security. Moving to one means re-implementing all 35
rules in application code, where a single missed check is a silent hole. That
is a rewrite of the security model, not a port, and it would trade away the
most defensible property this project has.

The one real argument against Supabase is that it has **no Middle East
region**, which is why the row above says Frankfurt. If counsel decides Saudi
personal data must stay in or near the Kingdom, the answer is not a different
backend-as-a-service — it is **managed Postgres in a Gulf region**, keeping all
890 lines of SQL and all 35 policies, and rewriting only `app/auth.js` and the
16 PostgREST call sites. Roughly a week.

**The timing is the whole point.** With zero users that migration is a week of
work and no data movement at all. After launch it is a PDPL data migration with
real people's employment records in it. So this decision is cheap to revisit
now and expensive to revisit later — which is an argument for getting the
residency answer early, not for delaying the project.

**The open question this leaves.** Frankfurt puts Saudi residents' personal data
outside the Kingdom. `0003_accounts.sql` stores a phone number, a
marketing-consent record, and `original_filename` — which in Saudi routinely
carries the worker's name and their employer's. Saudi PDPL restricts
cross-border transfer of personal data. This is logged as an open item in
`docs/lawyer-review-pack.md` and is not settled by any code here.

**What the free tier does.** The project pauses after roughly a week with no
activity. When it does, the console reads "unreadable" and every feature switch
falls back to its compiled-off constant. Nothing breaks for a reader — that is
the fail-safe behaving correctly — but the switches stop moving until you
resume the project from the dashboard.

---

## 1. Create the project

1. **supabase.com → New project.** Name `wodouh`, region **Frankfurt
   (eu-central-1)**. Generate a strong database password and store it in a
   password manager — it is not recoverable.
2. **Settings → API**, and copy the **Project URL** and the **anon / public**
   key.
3. Point the app at it:

   ```
   node tools/setup-supabase.mjs https://YOUR-REF.supabase.co eyJhbGci...
   ```

   That writes `supabase/config.js` (gitignored), **refuses a service_role key
   rather than saving one**, and prints the two follow-ups in step 3 below.

The publishable key is safe in frontend source: it identifies the project and
grants no access on its own, because every table is behind row level security —
which `test/rls.test.js` now proves rather than asserts.

**Two formats, both accepted.** Newer projects issue `sb_publishable_…`; older
ones a JWT labelled `anon` `public`. Either goes in `SUPABASE_ANON_KEY`, and
`tools/setup-supabase.mjs` recognises both.

The **secret** key is the opposite — `sb_secret_…`, or a legacy `service_role`
token. It bypasses RLS entirely and must never appear in the repo, in `app/`,
or in `web/`. It belongs only in Edge Function secrets, and the setup script
refuses to write one into a file that is served to every visitor.

## 2. Run the migrations

```
supabase link --project-ref YOUR-REF
supabase migration list          # <- do this FIRST. See below.
supabase db push
```

### Check the migration names before the first push — 30 seconds, once

`supabase/migrations/` uses `0001_init.sql` … `0005_admin.sql`. The CLI's own
convention is a 14-digit timestamp (`20260822081500_init.sql`), and it records
the leading digits as the migration **version** in
`supabase_migrations.schema_migrations` on your project.

**Run `supabase migration list` before `db push` and see what it says.**

- **If the CLI lists all five happily**, leave the names alone. Mixed
  conventions are harmless going forward: a future timestamped migration sorts
  after `0005` either way.
- **If the CLI rejects the names**, they need renaming to the timestamp form —
  and *that is a job for right now, before the first push, not later.* Once
  `db push` succeeds, `0001`…`0005` are written into your project's migration
  table. Rename them afterwards and the CLI sees five brand-new migrations and
  tries to run all of them again, against a database that already has those
  tables. Renaming is free today and unpleasant tomorrow.

This is written as a check rather than a pre-emptive rename because the CLI's
behaviour here varies by version, and renaming five files plus every reference
to them across the docs on an untested assumption is worse than asking the tool.

## 2b. What `supabase/config.toml` already decides for you

`supabase init` was never run here, so the repo had migrations and functions
but no CLI project — `link` and `db push` would have complained. It exists now,
and one setting in it is worth knowing about.

**`verify_jwt` per function.** Supabase's gateway checks a JWT *before* your
function runs. That is correct for functions the app calls and wrong for
functions the outside world calls:

| Function | verify_jwt | Why |
|---|---|---|
| `analyze` | **on** | Called by the app with the anon key. Requiring it is a free first filter on an endpoint that spends real money per call |
| `upload` | **on** | Same, and it requires a signed-in user in its own code as well |
| `webhook` | **off** | Zid and Salla POST with an HMAC signature and no JWT. Left on, the gateway returns 401, the function never runs, **its signature check never executes**, and the integration fails silently while looking configured |
| `oauth-callback` | **off** | A browser redirect from the merchant's storefront. Secured by a signed, expiring `state` parameter it verifies itself |

Turning it off does not make those two open — each authenticates its own caller
by a method appropriate to who is calling. The gateway check is simply the
wrong check for them. `test/headers.test.js` asserts this, and derives the
function list from the directory, so a function added later without a decision
about its caller fails the suite instead of shipping on a default nobody chose.

All five, in order — `supabase db push` handles the ordering, but know what
you are getting:

| Migration | What it creates |
|---|---|
| `0001_init.sql` | profiles, analyses, letters, case_files, reminders |
| `0002_integrations.sql` | the Zid/Salla commerce tables, including `integration_secrets` |
| `0003_accounts.sql` | identity on profiles, phone + consent, contracts, contract_analyses, `delete_my_account()` |
| `0004_uploads.sql` | `uploads` — the scanned-contract ownership record |
| `0005_admin.sql` | `admins`, `app_flags`, `flag_audit` — the founder console |

Then, **in the dashboard**, add yourself to `public.admins` with role `owner`.
There is no client write policy on that table, deliberately, so no page can
grant itself access — including the console.

### Verify RLS actually holds

**This is now automated.** `npm test` runs `test/rls.test.js`, which applies
all five migrations to a local Postgres and asks the database directly: is a
viewer refused a flag change, can an owner be refused an audit-log forgery, can
user B reach user A's contract, is `integration_secrets` closed. Each assertion
is also negative-tested — the suite opens the hole, confirms the database now
allows it, and closes it again.

Re-run the same questions against **your** project once it exists, because a
local Postgres is not Supabase. With two test accounts:

```sql
-- as user B: must return zero rows, not A's row
select * from public.contracts;
-- as user B: must change nothing
update public.contracts set original_filename = 'mine';
-- as any signed-in user: must return zero rows
select * from public.integration_secrets;
-- as a viewer: must change nothing
update public.app_flags set enabled = true where key = 'payments';
```

`integration_secrets` has RLS enabled and **no policies at all**. That is
deliberate — with RLS on and no policy, neither `anon` nor `authenticated` can
read or write it.

## 3. Authentication

In **Authentication → Providers**:

- **Email**: enable. Turn on "Confirm email".
- **Google**: needs a Google Cloud project → OAuth consent screen → OAuth
  client (Web). Authorized redirect URI is the one Supabase shows you.
- **Apple**: needs a *paid* Apple Developer account, a Services ID, a Sign in
  with Apple key (`.p8`), and your Team ID. Apple is the slowest of the three
  to get approved — start it first.

In **Authentication → URL Configuration**, add the app URL to **Redirect
URLs**, matching `REDIRECT_URL` in `config.js` verbatim:

```
https://alwodouh.com/app/index.html
```

A mismatch here is the single most common cause of "the login popup succeeds
but the app never signs in".

## 4. Edge Functions

```
supabase functions deploy oauth-callback
supabase functions deploy webhook
```

Set the secrets (never commit these):

```
supabase secrets set \
  OAUTH_STATE_SECRET="$(openssl rand -hex 32)" \
  APP_URL="https://alwodouh.com/app/index.html" \
  FUNCTION_BASE_URL="https://YOUR-REF.supabase.co/functions/v1" \
  SALLA_CLIENT_ID=... SALLA_CLIENT_SECRET=... SALLA_WEBHOOK_SECRET=... \
  ZID_CLIENT_ID=...   ZID_CLIENT_SECRET=...   ZID_WEBHOOK_SECRET=... ZID_API_TOKEN=...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 5. Zid and Salla

Register the app in each platform's partner portal:

- **Redirect URI**: `https://YOUR-REF.supabase.co/functions/v1/oauth-callback/return`
- **Webhook URL**: `https://YOUR-REF.supabase.co/functions/v1/webhook/salla`
  (and `/webhook/zid`)

**Confirm the endpoints before launch.** The defaults in
`supabase/functions/_shared/providers.ts` reflect each platform's published
documentation at time of writing, but both are actively developed and neither
was reachable from the authoring environment to verify. Every URL is
overridable by environment variable precisely so a change does not require a
code edit:

```
SALLA_AUTHORIZE_URL, SALLA_TOKEN_URL, SALLA_PROFILE_URL, SALLA_SCOPES
ZID_AUTHORIZE_URL,   ZID_TOKEN_URL,   ZID_PROFILE_URL,   ZID_SCOPES
```

Also confirm the **webhook signature scheme** for each platform. Both adapters
currently assume an HMAC-SHA256 hex digest over the raw body, compared in
constant time. If a platform signs differently, change only that adapter's
`verify()` — nothing else depends on it.

### Adding a third platform

One object in `PROVIDERS`, one row in `integration_providers`. No schema
change, and no edit to the OAuth or webhook functions.

## 6. Wire the app

`supabase/client/wodouh-auth.js` is written and loads the Supabase SDK lazily — only
when a user actually tries to sign in — so the signed-out app keeps making
zero external requests.

Per the agreed privacy model, sync carries **results only, never contract
text**: score, which rule ids fired, doc kind, plus the letters, case files,
reminders and preferences the user authored. Pasted text, PDF bytes and
extracted clause quotes are never sent. This is what keeps *"your contract
never leaves your device"* literally true, and it is a product commitment, not
an implementation detail — do not relax it without changing the copy first.

Sign-in belongs inside the existing Account tab. The app must keep working
fully signed-out.

## Known limitations

- **Not verified against a live project.** No migration has been applied, no
  login completed, no webhook received.
- **CSP already allows the backend.** `app/index.html` permits
  `https://*.supabase.co` and `https://esm.sh` in `connect-src`/`script-src`.
  Pinning `esm.sh` to an exact version is worth doing before launch.
- **GitHub Pages cannot set HTTP headers**, so CSP ships in a `<meta>` tag and
  `frame-ancestors` and HSTS cannot be enforced. If clickjacking protection
  matters, move the app behind a host that can set headers (Cloudflare Pages,
  Netlify and Vercel all can).
- **Rate limiting** is a fixed-window counter in Postgres. It is adequate for
  webhooks and OAuth starts; it is not a substitute for an edge WAF under a
  real attack.
