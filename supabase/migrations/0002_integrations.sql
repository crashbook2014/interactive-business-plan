-- Wodouh — commerce platform integrations (Zid, Salla, and whatever follows).
--
-- The consumer app does not read these tables. They exist so a business
-- account can connect a store and have Wodouh review the contracts and
-- documents that flow through it.
--
-- Security posture: OAuth tokens are secrets. They are written and read only
-- by Edge Functions using the service role, never by the browser. The RLS
-- policies below therefore expose *connection metadata* to the owner (so the
-- UI can say "connected to Salla, 3 days ago") while the tokens themselves
-- live in a separate table with no anon-accessible policy at all.

-- ------------------------------------------------------------ providers
-- A row per supported platform. Adding a platform is an insert plus an
-- adapter file, not a schema change — that is the modularity requirement.
create table public.integration_providers (
  id          text primary key,              -- 'zid' | 'salla' | ...
  name        text not null,
  auth_kind   text not null default 'oauth2' check (auth_kind in ('oauth2','api_key')),
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.integration_providers (id, name) values
  ('zid',   'Zid'),
  ('salla', 'Salla')
on conflict (id) do nothing;

-- Public read: the UI needs to list what can be connected. Nothing secret here.
alter table public.integration_providers enable row level security;
create policy providers_read on public.integration_providers
  for select using (enabled);

-- ---------------------------------------------------------- connections
-- Owner-visible metadata about a store connection.
create table public.integration_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider_id   text not null references public.integration_providers(id),
  external_id   text,                        -- merchant/store id on their side
  store_name    text,
  scopes        text[] not null default '{}',
  status        text not null default 'pending'
                check (status in ('pending','active','revoked','error')),
  last_sync_at  timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider_id, external_id)
);

alter table public.integration_connections enable row level security;

-- The owner may see and disconnect. They may not write tokens or flip status
-- to 'active' by hand — inserts and status transitions are done by the Edge
-- Function under the service role, which bypasses RLS.
create policy connections_select on public.integration_connections
  for select using ((select auth.uid()) = user_id);
create policy connections_delete on public.integration_connections
  for delete using ((select auth.uid()) = user_id);

-- --------------------------------------------------------------- secrets
-- Deliberately has RLS enabled and NO policies. With RLS on and no policy,
-- anon and authenticated roles can do nothing at all; only the service role
-- (which bypasses RLS) can touch it. This is the whole point: an access
-- token must never be reachable from a browser session, even the owner's.
create table public.integration_secrets (
  connection_id  uuid primary key references public.integration_connections(id) on delete cascade,
  access_token   text not null,
  refresh_token  text,
  expires_at     timestamptz,
  updated_at     timestamptz not null default now()
);

alter table public.integration_secrets enable row level security;

revoke all on public.integration_secrets from anon, authenticated;

comment on table public.integration_secrets is
  'RLS enabled with no policies by design: service role only. Never expose to a client.';

-- -------------------------------------------------------- webhook events
-- Raw inbound webhooks, recorded before processing so a failed handler can be
-- replayed and a suspicious delivery can be audited.
create table public.integration_events (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid references public.integration_connections(id) on delete cascade,
  provider_id    text not null references public.integration_providers(id),
  topic          text not null,
  external_event_id text,
  payload        jsonb not null default '{}'::jsonb,
  processed_at   timestamptz,
  error          text,
  received_at    timestamptz not null default now(),
  -- Replay protection: the same delivery id is never stored twice.
  unique (provider_id, external_event_id)
);

alter table public.integration_events enable row level security;

-- Owners may read their own event history for transparency; only the service
-- role writes.
create policy events_select on public.integration_events
  for select using (
    exists (select 1 from public.integration_connections c
             where c.id = integration_events.connection_id
               and c.user_id = (select auth.uid()))
  );

create index events_conn_received_idx on public.integration_events (connection_id, received_at desc);
create index events_unprocessed_idx   on public.integration_events (received_at)
  where processed_at is null;

-- ------------------------------------------------------------ rate limit
-- Counter table backing the Edge Function limiter. Keyed by an opaque bucket
-- (user id, or a hash of the caller IP for unauthenticated routes) so we
-- never store raw addresses.
create table public.rate_limits (
  bucket      text not null,
  window_start timestamptz not null,
  count       integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.bump_rate_limit(p_bucket text, p_limit int, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  w timestamptz := date_trunc('second', now()) - (extract(epoch from now())::bigint % extract(epoch from p_window)::bigint) * interval '1 second';
  c int;
begin
  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, w, 1)
  on conflict (bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into c;
  return c <= p_limit;   -- false once the caller is over budget
end;
$$;

comment on function public.bump_rate_limit is
  'Fixed-window counter. Returns false when the caller has exceeded p_limit in the current window.';

create trigger connections_touch before update on public.integration_connections
  for each row execute function public.touch_updated_at();
