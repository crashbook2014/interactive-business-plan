-- Wodouh — Tap orders.
--
-- WHAT THIS TABLE IS
--
-- One row per checkout a signed-in reader started. The amount is halalas
-- (1 SAR = 100), our stored unit, so the table never holds a riyal float.
-- Tap's charge API is sent the major unit (199 SAR is 199, hashed as
-- "199.00"). The figure is written by the create-payment Edge Function from
-- the server catalogue. The client never supplies it, and there is no insert
-- policy through which it could.
--
-- WHO MAY TOUCH IT
--
-- A signed-in reader may SELECT their own rows, so the app can see that a
-- charge came back CAPTURED and unlock what they bought. They cannot insert,
-- update, or delete: marking a row paid is the webhook's job, and it runs
-- as the service role, which bypasses RLS. Anon is revoked entirely.
--
-- tap_events is the webhook's idempotency log, one row per hashstring. It
-- holds no client policy at all. Card and customer fields are removed
-- before insert.
--
-- Lawyer tiers and contract drafting are not plan ids here. They are not
-- sold. See supabase/functions/_shared/tap.mjs.

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  plan_id       text not null check (plan_id in (
                  'plan_review', 'plan_reviews5', 'plan_letter',
                  'plan_case', 'plan_bundle', 'plan_biz'
                )),
  -- Halalas. 199 SAR is 19900. Never a riyal float. Tap is charged 199.
  amount        integer not null check (amount >= 100),
  currency      text not null default 'SAR' check (currency = 'SAR'),
  status        text not null default 'pending' check (status in (
                  'pending', 'paid', 'failed', 'refunded', 'canceled'
                )),
  mode          text not null default 'test' check (mode in ('test', 'live')),
  tap_id        text,
  checkout_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  paid_at       timestamptz
);

comment on table public.orders is
  'Tap checkouts. amount is halalas (SAR × 100), written only by the Edge Function. Readers may see their own rows and cannot mark them paid.';
comment on column public.orders.amount is
  'Halalas, our stored unit. 199 SAR is 19900 here and 199.00 on Tap''s charge API.';
comment on column public.orders.tap_id is
  'Tap charge id (chg_…). Null until the charge is created.';

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);
create unique index if not exists orders_tap_id_uidx
  on public.orders (tap_id) where tap_id is not null;

alter table public.orders enable row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select using ((select auth.uid()) = user_id);

-- No insert, update, or delete policy. RLS denies those for every client
-- role. The revokes below are the other half: TRUNCATE is not covered by
-- RLS at all, and Supabase's default privileges grant it.
revoke all on public.orders from anon;
revoke insert, update, delete, truncate on public.orders from authenticated;
grant select on public.orders to authenticated;

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------- webhook idempotency
create table if not exists public.tap_events (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null,
  event_type  text not null,
  order_id    uuid references public.orders(id) on delete set null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  constraint tap_events_event_id_unique unique (event_id),
  constraint tap_events_payload_size check (pg_column_size(payload) <= 65536)
);

comment on table public.tap_events is
  'Tap webhook deliveries, one row per hashstring. Service role only. Card and customer fields are removed before insert.';

alter table public.tap_events enable row level security;
revoke all on public.tap_events from anon, authenticated;
