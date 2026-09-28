-- Wodouh — Moyasar orders.
--
-- WHAT THIS TABLE IS
--
-- One row per checkout a signed-in reader started. The amount is halalas
-- (1 SAR = 100), which is the unit Moyasar charges in. The figure is written
-- by the create-payment Edge Function from the server catalogue. The client
-- never supplies it, and there is no insert policy through which it could.
--
-- WHO MAY TOUCH IT
--
-- A signed-in reader may SELECT their own rows, so the app can see that an
-- invoice came back paid and unlock what they bought. They cannot insert,
-- update, or delete: marking a row paid is the webhook's job, and it runs
-- as the service role, which bypasses RLS. Anon is revoked entirely.
--
-- moyasar_events is the webhook's idempotency log. It holds no client
-- policy at all. secret_token is stripped before insert; the shared secret
-- does not live in this table.
--
-- Lawyer tiers and contract drafting are not plan ids here. They are not
-- sold. See supabase/functions/_shared/moyasar.mjs.

create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  plan_id             text not null check (plan_id in (
                        'plan_review', 'plan_reviews5', 'plan_letter',
                        'plan_case', 'plan_bundle', 'plan_biz'
                      )),
  -- Halalas. 199 SAR is 19900. Never a riyal float.
  amount              integer not null check (amount >= 100),
  currency            text not null default 'SAR' check (currency = 'SAR'),
  status              text not null default 'pending' check (status in (
                        'pending', 'paid', 'failed', 'refunded', 'canceled'
                      )),
  mode                text not null default 'test' check (mode in ('test', 'live')),
  moyasar_id          text,
  moyasar_payment_id  text,
  checkout_url        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  paid_at             timestamptz
);

comment on table public.orders is
  'Moyasar checkouts. amount is halalas (SAR × 100), written only by the Edge Function. Readers may see their own rows and cannot mark them paid.';
comment on column public.orders.amount is
  'Halalas, Moyasar''s smallest unit for SAR. 199 SAR is stored as 19900.';
comment on column public.orders.moyasar_id is
  'Moyasar invoice id. Null until the invoice is created.';

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);
create unique index if not exists orders_moyasar_id_uidx
  on public.orders (moyasar_id) where moyasar_id is not null;
create unique index if not exists orders_moyasar_payment_uidx
  on public.orders (moyasar_payment_id) where moyasar_payment_id is not null;

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
create table if not exists public.moyasar_events (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null,
  event_type  text not null,
  order_id    uuid references public.orders(id) on delete set null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  constraint moyasar_events_event_id_unique unique (event_id),
  constraint moyasar_events_payload_size check (pg_column_size(payload) <= 65536)
);

comment on table public.moyasar_events is
  'Moyasar webhook deliveries, one row per event id. Service role only. secret_token is removed before insert.';

alter table public.moyasar_events enable row level security;
revoke all on public.moyasar_events from anon, authenticated;
