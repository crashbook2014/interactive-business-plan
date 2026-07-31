-- Wodouh — initial schema.
--
-- Design constraint that drives this whole file: the product promises "your
-- contract never leaves your device". Nothing here stores contract text, PDF
-- bytes, or extracted clause quotes. We persist the *outcome* of an analysis
-- (a score, which rule ids fired, a verdict key) and the artefacts the user
-- explicitly authors. Analysis stays client-side.
--
-- Every table is keyed by auth.uid() and protected by RLS. There is no
-- service-role read path in the app; only Edge Functions use the service key.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
-- Minimum viable identity. No name, no phone, no address: we ask for nothing
-- we do not use. Email already lives in auth.users; we do not duplicate it.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  lang         text not null default 'ar' check (lang in ('ar','en')),
  theme        text not null default 'system' check (theme in ('system','light','dark')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Per-user preferences. Deliberately holds no PII beyond the auth.users link.';

-- ------------------------------------------------------------- analyses
-- The result of a contract review. `doc_kind` is an i18n key (doc_emp,
-- doc_rent, doc_free, doc_pasted, ...), not free text. `rule_ids` records
-- which heuristics fired so history can be re-rendered in either language
-- without storing any of the user's own words.
create table public.analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  doc_kind    text not null,
  score       smallint not null check (score between 0 and 100),
  signed_mode boolean not null default false,
  rule_ids    text[] not null default '{}',
  verdict_key text,
  created_at  timestamptz not null default now()
);

comment on column public.analyses.rule_ids is
  'Heuristic rule identifiers that matched. Never the matched text itself.';

-- --------------------------------------------------------------- letters
-- A negotiation letter the user chose to save. Body is authored by the user
-- (assembled from our templates and editable), so it is theirs to store.
create table public.letters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  title       text not null default '',
  body        text not null default '',
  lang        text not null default 'ar' check (lang in ('ar','en')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint letters_body_len check (char_length(body) <= 20000),
  constraint letters_title_len check (char_length(title) <= 200)
);

-- ------------------------------------------------------------ case_files
-- End-of-service / termination claim workspace. Amounts are the user's own
-- figures, entered by hand in the calculator.
create table public.case_files (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  reason        text,
  last_wage     numeric(12,2) check (last_wage is null or last_wage >= 0),
  start_date    date,
  end_date      date,
  unused_leave  smallint check (unused_leave is null or unused_leave between 0 and 365),
  claim_total   numeric(12,2) check (claim_total is null or claim_total >= 0),
  docs_ready    text[] not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint case_dates_ordered check (start_date is null or end_date is null or start_date <= end_date)
);

-- ------------------------------------------------------------- reminders
-- Contract deadlines. These are what Phase 5 exports to Apple/Google Calendar.
create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete cascade,
  doc_kind    text not null,
  event_key   text not null,
  due_at      timestamptz not null,
  kind        text not null default 'info' check (kind in ('info','action','deadline')),
  rrule       text,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on column public.reminders.rrule is
  'RFC 5545 RRULE for recurring deadlines, e.g. annual leave accrual. Null = one-off.';

-- ------------------------------------------------------------------ RLS
alter table public.profiles   enable row level security;
alter table public.analyses   enable row level security;
alter table public.letters    enable row level security;
alter table public.case_files enable row level security;
alter table public.reminders  enable row level security;

-- profiles: a user sees and edits exactly one row — their own. No delete:
-- account deletion cascades from auth.users.
create policy profiles_select on public.profiles
  for select using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles
  for insert with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- The owner-only pattern below is identical for the four data tables. The
-- with-check on update is what stops a user reassigning a row to someone else.
create policy analyses_select on public.analyses
  for select using ((select auth.uid()) = user_id);
create policy analyses_insert on public.analyses
  for insert with check ((select auth.uid()) = user_id);
create policy analyses_update on public.analyses
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy analyses_delete on public.analyses
  for delete using ((select auth.uid()) = user_id);

create policy letters_select on public.letters
  for select using ((select auth.uid()) = user_id);
create policy letters_insert on public.letters
  for insert with check ((select auth.uid()) = user_id);
create policy letters_update on public.letters
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy letters_delete on public.letters
  for delete using ((select auth.uid()) = user_id);

create policy case_files_select on public.case_files
  for select using ((select auth.uid()) = user_id);
create policy case_files_insert on public.case_files
  for insert with check ((select auth.uid()) = user_id);
create policy case_files_update on public.case_files
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy case_files_delete on public.case_files
  for delete using ((select auth.uid()) = user_id);

create policy reminders_select on public.reminders
  for select using ((select auth.uid()) = user_id);
create policy reminders_insert on public.reminders
  for insert with check ((select auth.uid()) = user_id);
create policy reminders_update on public.reminders
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy reminders_delete on public.reminders
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------- indexes
-- Every query the app makes is "my rows, newest first", so each index leads
-- with user_id. RLS filters on user_id too, so these serve both.
create index analyses_user_created_idx   on public.analyses   (user_id, created_at desc);
create index letters_user_created_idx    on public.letters    (user_id, created_at desc);
create index case_files_user_created_idx on public.case_files (user_id, created_at desc);
create index reminders_user_due_idx      on public.reminders  (user_id, due_at)
  where done = false;

-- ------------------------------------------------------------- triggers
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch   before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger letters_touch    before update on public.letters
  for each row execute function public.touch_updated_at();
create trigger case_files_touch before update on public.case_files
  for each row execute function public.touch_updated_at();

-- A profile row must exist the moment a user signs up, whichever provider
-- they used. security definer because the new user has no session yet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
