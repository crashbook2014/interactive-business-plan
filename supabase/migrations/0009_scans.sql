-- Wodouh — the record of how many free scans an account has used.
--
-- WHAT THIS IS FOR
--
-- The free tier is one contract scan a month. That was counted in
-- localStorage, which meant clearing site data or opening a private window
-- reset it. Counting it against an account instead makes the limit survive
-- both.
--
-- WHAT IT DOES NOT DO, SAID PLAINLY
--
-- It does not ENFORCE anything, and describing it as enforcement would be
-- wrong. Wodouh analyses a contract on the reader's own device — that is the
-- product's central privacy promise — so no server is in a position to
-- withhold a scan. This table is a RECORD, and the app honours it.
--
-- That defeats clearing storage, private windows, and a second browser. It
-- does not defeat someone who edits the JavaScript to skip the insert. Real
-- enforcement would mean sending the contract to a server to be analysed,
-- which is the one thing this product promises never to do. The trade is
-- deliberate and the weaker guarantee is the correct one.
--
-- WHAT IS RECORDED, AND WHAT IS NOT
--
-- A user id and a timestamp. That is the whole row.
--
-- NOT the contract, its text, its filename, its length, its score, its
-- clauses, or what kind of document it was. Someone reading this table learns
-- that an account scanned something on a date, and nothing whatsoever about
-- what they scanned. The privacy policy says so in both languages, because
-- this is new personal data and appearing in a migration is not disclosure.
--
-- PDPL: a Saudi resident's activity timestamps, tied to an identity. Minimal,
-- but not nothing. Retention below is 13 months for the reason given.

create table if not exists public.scan_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.scan_events is
  'One row per free scan: user id and time, nothing about the document. A record the app honours, not an enforcement mechanism — analysis is on-device.';

create index if not exists scan_events_user_month_idx
  on public.scan_events (user_id, created_at desc);

alter table public.scan_events enable row level security;

-- A reader may see and add their OWN rows, and nothing else. Insert is open to
-- the owner because the client is what knows a scan happened — the server
-- never sees the contract and could not infer it.
drop policy if exists scan_events_select on public.scan_events;
create policy scan_events_select on public.scan_events
  for select using ((select auth.uid()) = user_id);

drop policy if exists scan_events_insert on public.scan_events;
create policy scan_events_insert on public.scan_events
  for insert with check ((select auth.uid()) = user_id);

-- NO UPDATE OR DELETE POLICY, deliberately. A reader who could delete their
-- own rows would have a one-click reset of the very limit this table exists to
-- record, which would leave it doing nothing at all while looking like it did
-- something. Erasure still works: deleting the account cascades from
-- auth.users, which is the right granularity for a data-subject request.

-- --------------------------------------------------------------- retention
-- Thirteen months, so a "this month" question can always look one full year
-- back and still find the boundary. Older rows answer no question anyone asks.
create or replace function public.prune_scan_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  delete from public.scan_events where created_at < now() - interval '13 months';
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Named roles, not just PUBLIC: revoking from PUBLIC alone leaves Supabase's
-- default grants to anon and authenticated untouched, which is what 0006
-- exists to fix. Do not shorten this.
revoke all on function public.prune_scan_events() from public, anon, authenticated;
