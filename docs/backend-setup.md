# Wodouh — backend setup

Everything in `supabase/` and `app/js/` is written but **has never been run
against a live project**. No Supabase project exists yet, and the environment
this was authored in cannot reach `supabase.com`, `appleid.apple.com`,
`api.zid.sa` or `accounts.salla.sa`. Treat the code as reviewed-but-unverified
until you have completed the steps below and seen it work.

What *is* verified: the app runs exactly as before with none of this
configured. Sync is additive — if `config.js` is missing, the app is the
local-only product it is today.

---

## 1. Create the project

1. Create a Supabase project (region: choose the closest to Saudi Arabia —
   `eu-central-1` is usually the lowest latency option today).
2. Copy `supabase/config.example.js` to `supabase/config.js` and fill in the
   project URL and the **anon** key.
3. `config.js` is gitignored. The anon key is safe in frontend source — it is
   a JWT meaning "anonymous visitor" and grants nothing on its own, because
   every table is protected by row level security. The **service_role** key is
   the opposite: it bypasses RLS entirely and must never appear in the repo,
   in `app/`, or in `web/`. It belongs only in Edge Function secrets.

## 2. Run the migrations

```
supabase link --project-ref YOUR-REF
supabase db push
```

`0001_init.sql` creates profiles, analyses, letters, case_files and reminders.
`0002_integrations.sql` adds the commerce integration tables.

### Verify RLS actually holds

Do not take the policies on trust. With two test accounts:

```sql
-- as user A
insert into analyses (user_id, doc_kind, score) values (auth.uid(), 'doc_emp', 70);
-- as user B: must return zero rows, not A's row
select * from analyses;
-- as user B: must fail
update analyses set score = 0 where user_id <> auth.uid();
```

`integration_secrets` has RLS enabled and **no policies at all**. That is
deliberate — with RLS on and no policy, neither `anon` nor `authenticated` can
read or write it. Confirm:

```sql
-- as any signed-in user: must return zero rows
select * from integration_secrets;
```

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
https://crashbook2014.github.io/interactive-business-plan/app/index.html
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
  APP_URL="https://crashbook2014.github.io/interactive-business-plan/app/index.html" \
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
