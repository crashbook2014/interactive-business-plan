-- Wodouh — uploaded files, and who owns them.
--
-- WHY THIS TABLE EXISTS AT ALL
--
-- Anthropic's Files API returns a file_id that is WORKSPACE-scoped, not
-- user-scoped. Every file_id our API key ever created is readable by our API
-- key. So a file_id is not a capability and must never be treated as one: a
-- client that sends us `file_id: "file_abc"` is making a claim about ownership,
-- not proving it, and a signed-in user guessing or replaying another user's id
-- would read a stranger's employment contract.
--
-- This table is the proof. The server records who uploaded what at the moment
-- it uploads, and every later request looks the id up HERE, scoped to the
-- caller, before it goes anywhere near Anthropic. The client never sends a
-- file_id and is never shown one.
--
-- WHEN THIS PATH IS USED, WHICH IS NOT OFTEN
--
-- Text-based PDFs are extracted on the reader's own device and only the TEXT is
-- sent for analysis — no file is uploaded and nothing lands here. This table
-- serves the one case on-device code cannot handle: a scan or a photograph,
-- which has no text layer at all. That upload is an explicit, separate opt-in,
-- because it is the only flow in Wodouh where the document itself leaves the
-- phone.
--
-- RETENTION IS AN OBLIGATION, NOT AN INTENTION
--
-- A file uploaded to Anthropic persists until it is explicitly deleted. The
-- delete call can fail, and a function can time out between upload and delete,
-- so "we delete it immediately" is only true if something notices when it did
-- not happen. deleted_at plus expires_at is what makes the sweep possible:
-- anything past expires_at with deleted_at still null is a file that outlived
-- its purpose and needs removing.
--
-- PDPL: this records that a Saudi resident's identity document or employment
-- contract was transmitted to a processor outside the Kingdom. Retention,
-- cross-border transfer and the data subject's rights are not settled by any
-- code here. Get advice before the first real user.

create table if not exists public.uploads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- The Anthropic file_id. Written by the server only, never accepted from a
  -- client, never returned to one.
  file_id      text not null,
  purpose      text not null default 'contract_scan'
    check (purpose in ('contract_scan')),
  byte_size    integer check (byte_size is null or byte_size between 0 and 33554432),
  mime_type    text,
  created_at   timestamptz not null default now(),
  -- Short by design. A scan is uploaded, read once, and deleted; an hour is
  -- generous for a retry and far short of anything resembling storage.
  expires_at   timestamptz not null default now() + interval '1 hour',
  deleted_at   timestamptz,
  constraint uploads_file_id_unique unique (file_id)
);

comment on table public.uploads is
  'Which user owns which Anthropic file_id. A file_id from a client is a claim, not a proof — this table is the proof.';
comment on column public.uploads.deleted_at is
  'Set when the file has actually been deleted upstream. Null past expires_at means the delete did not happen and the sweep must retry.';

create index if not exists uploads_user_idx on public.uploads (user_id, created_at desc);
-- The sweep's query: everything expired that was never confirmed deleted.
create index if not exists uploads_sweep_idx on public.uploads (expires_at)
  where deleted_at is null;

-- ------------------------------------------------------------------ RLS
-- Enabled with NO policies, and rights revoked from both client roles. This is
-- the strictest configuration available: only the service role, inside an Edge
-- Function, can read or write it. The same pattern 0002 uses for
-- integration_secrets, and for the same reason — a reader has no legitimate
-- need to see a file_id, and the one thing that must never happen is a client
-- learning an identifier it could replay.
alter table public.uploads enable row level security;
revoke all on public.uploads from anon, authenticated;

-- --------------------------------------------------------------- the sweep
-- Called by the Edge Function on a schedule. Returns what still needs deleting
-- upstream; the function does the delete and then marks the row.
create or replace function public.uploads_pending_delete(max_rows integer default 100)
returns table (id uuid, file_id text)
language sql
security definer
set search_path = ''
as $$
  select u.id, u.file_id
  from public.uploads u
  where u.deleted_at is null and u.expires_at < now()
  order by u.expires_at
  limit least(greatest(coalesce(max_rows, 100), 1), 1000);
$$;

revoke all on function public.uploads_pending_delete(integer) from public, anon, authenticated;
