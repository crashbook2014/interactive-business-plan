-- What Supabase provides, and a plain Postgres does not.
--
-- WHY THIS FILE EXISTS. Every migration in supabase/migrations/ had never been
-- executed — not once, anywhere. schema.test.js read them as text and asserted
-- properties a regex can see, which is genuinely useful and cannot compile a
-- policy expression, type-check a trigger body, or discover that a function
-- references a column that does not exist. This shim is the smallest thing
-- that lets a real Postgres run them, so those failures happen here instead of
-- against a live project holding real people's data.
--
-- WHAT IT IS NOT. It is not Supabase. It creates the objects the migrations
-- REFERENCE — the auth schema, auth.users, auth.uid(), and the three client
-- roles — with behaviour close enough to test authorisation against. It does
-- not reproduce GoTrue, JWT verification, PostgREST, or Supabase's own grants.
-- So a green run here proves the SQL executes and that row level security
-- refuses what it should; it does not prove sign-in works. Those are different
-- claims and the suite says so rather than blurring them.
--
-- HOW auth.uid() IS FAKED, AND WHY THIS WAY. Supabase reads the caller's id
-- out of the verified JWT claims that PostgREST puts in a session setting.
-- This does the same read from the same setting name, so the POLICIES ARE
-- EXERCISED EXACTLY AS WRITTEN — no policy is modified for testing, which is
-- the only version of this worth running. What is skipped is the part that
-- verifies the token's signature, which is PostgREST's job and not the
-- database's.

create schema if not exists auth;

-- Supabase ships these; a bare Postgres does not. Created without login so
-- nothing here can be connected to from outside.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth   to anon, authenticated, service_role;

-- THE DETAIL THAT DECIDES WHETHER ANY OF THIS TESTS ANYTHING.
--
-- Supabase grants the client roles full privileges on public tables and then
-- relies on row level security to restrict them. Row level security is the
-- control; the GRANT is wide open underneath it.
--
-- Without this line, a bare Postgres gives `authenticated` no privileges at
-- all — so every "this must be refused" assertion in rls.test.js would pass
-- because of a MISSING GRANT rather than because of a policy. The suite would
-- be green, the policies would be untested, and a policy deleted by accident
-- would still look fine. Verified before adding it: has_table_privilege
-- returned false for authenticated on every table.
--
-- Set BEFORE the migrations run, so tables they create pick it up the way they
-- would in a real project — and so the explicit `revoke` statements inside
-- those migrations still take effect afterwards, in the same order.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- Enough of auth.users for the foreign keys, the delete cascade and the
-- handle_new_user trigger to behave.
--
-- BOTH metadata columns, and the distinction is not cosmetic. Supabase's
-- auth.users carries raw_app_meta_data (written by GoTrue — which provider
-- signed you in) and raw_user_meta_data (the profile the provider returned:
-- name, avatar). 0003's trigger reads BOTH. The first version of this shim had
-- only raw_user_meta_data, and the very first insert failed with
--   record "new" has no field "raw_app_meta_data"
-- which is a gap in this file rather than a bug in the migration — but it is
-- exactly the class of thing no amount of reading the SQL would have found.
create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on auth.users to authenticated, service_role;

-- The same read Supabase performs. Null when nobody is signed in, which is the
-- state every policy has to survive.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json ->> 'sub', ''
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::json ->> 'role', ''),
    'anon'
  );
$$;

-- Sign in as somebody, the way a test needs to. Not part of Supabase; used
-- only by test/rls.test.js.
create or replace function auth.test_login(u uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end,
    false);
$$;
