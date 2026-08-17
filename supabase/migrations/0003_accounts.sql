-- Wodouh — accounts, identity, and stored contracts.
--
-- WHY THIS EXTENDS `profiles` INSTEAD OF ADDING A `users` TABLE
--
-- The spec this implements asked for a `users` table holding id, full_name,
-- email, phone, consent, provider. Every one of those either already exists in
-- auth.users or belongs beside the preferences already in public.profiles. A
-- second table keyed on the same uuid would be two rows to keep in step, two
-- RLS surfaces, and two places for an email to go stale. So the columns land
-- on `profiles`, which 0001 already created, already protects, and already
-- populates by trigger.
--
-- WHAT CHANGED ABOUT THE PRIVACY POSITION, STATED PLAINLY
--
-- 0001 opens: "Nothing here stores contract text, PDF bytes, or extracted
-- clause quotes." THAT REMAINS TRUE and every table below keeps it.
--
-- What is new is `contracts.original_filename`, and it deserves naming rather
-- than burying. A Saudi filename routinely carries the person's name and their
-- employer's — عقد-عبدالإله-أرامكو.pdf — so this column is personal data about
-- two parties, one of whom never agreed to anything. It is stored because the
-- product owner decided a recognisable list is worth it, which is a legitimate
-- call. What makes it defensible is that the reader can edit or clear it
-- (`contracts_update`), delete the row outright (`contracts_delete`), and that
-- it is the ONLY free text about a document anywhere in this schema.
--
-- CONSENT IS RECORDED, NOT ASSUMED
--
-- phone_marketing_consent defaults to false and is a separate column from the
-- phone number itself, so storing a number never implies permission to market
-- to it. Alongside it: WHEN consent was given and THE EXACT WORDING shown at
-- the time. A boolean alone cannot answer "what did they agree to?" a year
-- later, and that is the question that actually gets asked.
--
-- PDPL: this file stores Saudi personal data including a phone number and a
-- marketing flag. Region choice, retention and the data-subject rights in the
-- Personal Data Protection Law are not settled by any code here. Get advice
-- before the first real user.

-- ------------------------------------------------------------- identity
-- From the OAuth provider, written by the trigger below. Nullable throughout:
-- a provider may withhold any of them, and a missing name must never block a
-- sign-in.
alter table public.profiles
  add column if not exists full_name     text,
  add column if not exists email         text,
  add column if not exists avatar_url    text,
  add column if not exists auth_provider text
    check (auth_provider is null or auth_provider in ('google','apple'));

comment on column public.profiles.email is
  'Mirrored from auth.users at sign-up for convenience. auth.users is the source of truth.';

-- --------------------------------------------------------------- phone
-- Reference data only. No OTP, no verification, and NOTHING in the sign-in
-- path reads it — a phone number here can never be used to authenticate, which
-- is what keeps a wrong or recycled number from becoming an account takeover.
alter table public.profiles
  add column if not exists phone_number text
    check (phone_number is null or phone_number ~ '^\+?[0-9 ()-]{7,20}$'),
  add column if not exists phone_marketing_consent boolean not null default false,
  add column if not exists phone_consent_at timestamptz,
  add column if not exists phone_consent_text text,
  -- Asked once. This records that the question was put, whatever the answer,
  -- so a reader who skipped is not asked again on every visit.
  add column if not exists phone_prompted_at timestamptz;

comment on column public.profiles.phone_number is
  'Reference only. Never used for authentication, verification, or account recovery.';
comment on column public.profiles.phone_consent_text is
  'The exact sentence shown when consent was given. A boolean cannot answer "what did they agree to?".';

-- Consent cannot be true without a record of when it was given and what was
-- shown. This is the constraint that stops a future code path from flipping
-- the flag silently.
alter table public.profiles
  drop constraint if exists profiles_consent_recorded;
alter table public.profiles
  add constraint profiles_consent_recorded check (
    phone_marketing_consent = false
    or (phone_consent_at is not null and phone_consent_text is not null)
  );

-- ----------------------------------------------------------- contracts
-- A document the reader chose to keep a record of. The document itself is not
-- here: no bytes, no text, no quotes. This row is a label and a status.
create table if not exists public.contracts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  original_filename text,
  language          text not null default 'ar' check (language in ('ar','en')),
  status            text not null default 'uploaded'
    check (status in ('uploaded','analyzed','archived')),
  uploaded_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint contracts_filename_len check (
    original_filename is null or char_length(original_filename) <= 255)
);

comment on table public.contracts is
  'A record that a document was reviewed. Never the document.';

-- --------------------------------------------------- contract_analyses
-- The outcome of a review. red_flags and negotiation_points are jsonb because
-- their shape is the app''s, not the database''s — but they must stay
-- REFERENCES to findings (rule ids, keys, scores), never the reader''s clause
-- text. The size ceiling below is the crude guard against that: quoted
-- contract text does not fit in 16 KB, findings do.
create table if not exists public.contract_analyses (
  id                 uuid primary key default gen_random_uuid(),
  contract_id        uuid not null references public.contracts(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  score              smallint not null check (score between 0 and 100),
  verdict_summary    text,
  red_flags          jsonb not null default '[]'::jsonb,
  negotiation_points jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  constraint analyses_verdict_len check (
    verdict_summary is null or char_length(verdict_summary) <= 2000),
  constraint analyses_flags_shape check (
    jsonb_typeof(red_flags) = 'array' and jsonb_typeof(negotiation_points) = 'array'),
  constraint analyses_flags_size check (
    pg_column_size(red_flags) + pg_column_size(negotiation_points) <= 16384)
);

-- user_id is carried here as well as on contracts. It is redundant by design:
-- it lets RLS decide ownership without a join, so a policy cannot be defeated
-- by a subquery that the planner rewrites. The trigger below keeps it honest.
comment on column public.contract_analyses.user_id is
  'Denormalised from contracts so RLS never needs a join. Enforced by trigger.';

create or replace function public.contract_analysis_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare owner uuid;
begin
  select c.user_id into owner from public.contracts c where c.id = new.contract_id;
  if owner is null then
    raise exception 'contract % not found', new.contract_id;
  end if;
  -- The parent decides. A client that sends someone else's user_id is
  -- corrected rather than trusted.
  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists contract_analyses_owner on public.contract_analyses;
create trigger contract_analyses_owner
  before insert or update on public.contract_analyses
  for each row execute function public.contract_analysis_owner();

drop trigger if exists contracts_touch on public.contracts;
create trigger contracts_touch
  before update on public.contracts
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ RLS
alter table public.contracts         enable row level security;
alter table public.contract_analyses enable row level security;

create policy contracts_select on public.contracts
  for select using ((select auth.uid()) = user_id);
create policy contracts_insert on public.contracts
  for insert with check ((select auth.uid()) = user_id);
create policy contracts_update on public.contracts
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy contracts_delete on public.contracts
  for delete using ((select auth.uid()) = user_id);

-- Same owner-only shape. The insert check additionally requires that the
-- parent contract is the caller''s, so an analysis cannot be attached to a
-- stranger''s contract even though the trigger would overwrite user_id.
create policy contract_analyses_select on public.contract_analyses
  for select using ((select auth.uid()) = user_id);
create policy contract_analyses_insert on public.contract_analyses
  for insert with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.user_id = (select auth.uid())));
create policy contract_analyses_update on public.contract_analyses
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy contract_analyses_delete on public.contract_analyses
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- indexes
create index if not exists contracts_user_idx
  on public.contracts (user_id, uploaded_at desc);
create index if not exists contract_analyses_user_idx
  on public.contract_analyses (user_id, created_at desc);
create index if not exists contract_analyses_contract_idx
  on public.contract_analyses (contract_id);

-- ------------------------------------------------- new-user profile fill
-- Replaces the 0001 version, which created an empty row. The provider hands us
-- a name, an email and an avatar at first sign-in and never again as reliably,
-- so they are captured now.
--
-- Apple is deliberately handled: it returns the full name ONLY on the very
-- first authorisation, and its "hide my email" relay address is a real address
-- that must be stored as given. Both are read from raw_user_meta_data with
-- fallbacks rather than assumed present.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  prov text := nullif(new.raw_app_meta_data ->> 'provider', '');
begin
  insert into public.profiles (id, full_name, email, avatar_url, auth_provider)
  values (
    new.id,
    nullif(coalesce(meta ->> 'full_name', meta ->> 'name', ''), ''),
    nullif(coalesce(new.email, meta ->> 'email', ''), ''),
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture', ''), ''),
    case when prov in ('google','apple') then prov end
  )
  on conflict (id) do update set
    -- Never overwrite something already there with a null on a later sign-in:
    -- Apple gives the name once, and a second sign-in would erase it.
    full_name     = coalesce(public.profiles.full_name, excluded.full_name),
    email         = coalesce(excluded.email, public.profiles.email),
    avatar_url    = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    auth_provider = coalesce(public.profiles.auth_provider, excluded.auth_provider);
  return new;
end;
$$;

-- --------------------------------------------------------- account erasure
-- PDPL gives a data subject the right to have their data deleted, and "email
-- support and wait" is not an implementation of it. Deleting the auth user
-- cascades to every table above; this is the callable, auditable version.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
