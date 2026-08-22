-- Wodouh — the founder console: who may operate it, what it can switch, and
-- an unforgeable record of every switch that moved.
--
-- WHY THIS TABLE SET EXISTS
--
-- Every feature switch in Wodouh is a constant compiled into app/index.html:
-- PAYMENT_LIVE, SUBSCRIPTIONS_LIVE, LAWYER_DESK.live, WODOUH_LAUNCHED. Changing
-- one means an edit, a test run, a push and a Pages deploy. That is a good
-- default and a bad emergency procedure — when payments are misbehaving in
-- front of real people, "wait for a deploy" is not an answer.
--
-- So the switches move here, and the app asks. That trade is real and it is
-- recorded rather than glossed:
--
--   WHAT IS GAINED   a flag can be turned off in seconds, from a phone.
--   WHAT IS PAID     the app now makes a network request it did not make
--                    before. app/index.html fetches LAZILY — only when a
--                    reader first reaches a surface a flag governs — so
--                    someone who only uses the free calculator still makes no
--                    request at all. The privacy copy says so in both
--                    languages. If that ever stops being true, the copy is
--                    wrong and this comment is the reason it must be fixed.
--
-- FAILURE FALLS TO THE SAFE SIDE, ALWAYS
--
-- A flag row that is missing, unreadable, or stale reads as OFF, because the
-- app falls back to the compiled-in constant and every one of those is false.
-- An attacker who could make this table unreachable could turn features off.
-- They could not turn one on, and that asymmetry is deliberate.
--
-- THE AUDIT LOG CANNOT BE WRITTEN BY A CLIENT
--
-- flag_audit has a SELECT policy and no other policy, so under row level
-- security every insert, update and delete from a browser is denied. The only
-- thing that writes it is the trigger below, which runs inside the database on
-- the way through. "Who turned payments on at 2am" is therefore a question with
-- an answer that the person who did it could not have edited.
--
-- PDPL: nothing here is a data subject's personal data beyond the operator's
-- own auth.users id.

-- ------------------------------------------------------------- operators
-- Membership is granted BY HAND in the Supabase dashboard, deliberately. There
-- is no client-facing write policy below, so nothing reachable from a browser
-- can add an operator — including the console itself. Making yourself an admin
-- requires the database, which requires the project owner.
create table if not exists public.admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  -- owner may move a switch; viewer may only look. Two roles, because a third
  -- would be a permission system nobody asked for.
  role     text not null default 'viewer' check (role in ('owner', 'viewer')),
  added_at timestamptz not null default now(),
  note     text check (note is null or length(note) <= 200)
);

comment on table public.admins is
  'Who may open the founder console. Granted by hand in the dashboard; no client write policy exists.';

alter table public.admins enable row level security;

-- An operator may confirm their own membership, and learns nothing about any
-- other operator. Absent any other policy, RLS denies every write from a
-- client — which is the point.
create policy admins_select_self on public.admins
  for select using ((select auth.uid()) = user_id);

-- SECURITY DEFINER so it can see rows the caller's own policy hides, and
-- search_path pinned to '' so a caller cannot shadow public.admins with a
-- table of their own and answer the question themselves.
create or replace function public.is_admin(want text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
     where a.user_id = (select auth.uid())
       and (want = 'viewer' or a.role = 'owner')
  );
$$;

revoke all on function public.is_admin(text) from public;
grant execute on function public.is_admin(text) to authenticated;

-- ---------------------------------------------------------------- flags
-- WORLD-READABLE ON PURPOSE. Every reader's app needs to know whether payments
-- are live, and they are not signed in. There is nothing here to protect: the
-- contents are exactly what the app's own behaviour reveals within one tap.
--
-- The KEY SET IS FIXED BY THE CODE THAT READS IT. There is no insert or delete
-- policy, so the console can flip a flag and can never invent one. A key the
-- app does not know would do nothing anyway, and a key the app DOES know that
-- someone deleted would read as off — this way neither can happen by accident.
create table if not exists public.app_flags (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{2,40}$'),
  enabled    boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  note       text check (note is null or length(note) <= 280)
);

comment on table public.app_flags is
  'Runtime feature switches. Public read; only an owner may change one. A missing or unreadable row reads as OFF in the app.';
comment on column public.app_flags.enabled is
  'The app never trusts this to turn a feature ON without its credential also being present — see the dependency guard in admin/admin.js.';

alter table public.app_flags enable row level security;

create policy app_flags_select on public.app_flags
  for select using (true);

-- The with-check matters as much as the using: without it an owner could pass
-- the row-level test on the way in and write something the policy would not
-- have allowed on the way out.
create policy app_flags_update on public.app_flags
  for update using (public.is_admin('owner'))
  with check (public.is_admin('owner'));

-- The five switches the app reads, all off. Seeding them here rather than
-- letting the console create them is what keeps the key set a property of the
-- code rather than of whoever clicked last.
insert into public.app_flags (key, enabled, note) values
  ('launched',      false, 'The pre-launch curtain. False sends visitors to the coming-soon page.'),
  ('payments',      false, 'Card payment. Turning this on charges real people.'),
  ('subscriptions', false, 'Recurring plans on the account screen.'),
  ('ai_analysis',   false, 'Sends contract text off the device. Needs ANALYZE_URL configured too.'),
  ('lawyer_desk',   false, 'The lawyer handoff. Needs an actual arrangement with a lawyer.')
on conflict (key) do nothing;

-- ----------------------------------------------------------- the record
-- Append-only from every direction a client can reach. One SELECT policy and
-- nothing else: RLS denies what it does not permit, so a browser cannot insert
-- a false entry, amend a true one, or delete the one it wishes had not
-- happened.
create table if not exists public.flag_audit (
  id           bigint generated always as identity primary key,
  key          text not null,
  from_enabled boolean,
  to_enabled   boolean not null,
  changed_at   timestamptz not null default now(),
  changed_by   uuid references auth.users(id) on delete set null,
  note         text
);

comment on table public.flag_audit is
  'Every flag change, written only by the trigger below. No client can write, amend or delete a row here.';

alter table public.flag_audit enable row level security;

create policy flag_audit_select on public.flag_audit
  for select using (public.is_admin('viewer') and (select auth.uid()) is not null);

-- Stamps the row and records the change in one place, so "who changed it" and
-- "when" cannot disagree with the log. SECURITY DEFINER because flag_audit
-- has no insert policy — not even for an owner — and this is the only writer.
create or replace function public.log_flag_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  /* The key is immutable: a rename would orphan the audit trail from the
     switch it describes. */
  new.key := old.key;

  if new.enabled is distinct from old.enabled then
    insert into public.flag_audit (key, from_enabled, to_enabled, changed_by, note)
    values (old.key, old.enabled, new.enabled, (select auth.uid()), new.note);
  end if;
  return new;
end;
$$;

drop trigger if exists app_flags_audit on public.app_flags;
create trigger app_flags_audit
  before update on public.app_flags
  for each row execute function public.log_flag_change();
