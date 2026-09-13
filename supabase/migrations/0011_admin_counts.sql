-- ============================================================ admin counts
-- Four numbers on the founder console, and until now not one of them was
-- trustworthy.
--
-- TWO SAID "unreadable". They counted public.uploads, which 0004 puts in the
-- strictest state Postgres offers — RLS enabled with no policies at all, plus
-- `revoke all ... from anon, authenticated` underneath it. The console asks as
-- the `authenticated` role like every other panel, so the request is refused at
-- the GRANT layer before RLS is even consulted, apiCount() throws, and the
-- catch writes a word where a number should be. That configuration is correct
-- and stays: it is what guarantees no file_id ever reaches a browser.
--
-- THE OTHER TWO WERE WORSE, because they answered. profiles and contracts are
-- owner-only (auth.uid() = id / = user_id), so a count run by an operator
-- returns the operator's own rows. On a project with five thousand accounts,
-- "Accounts" reads 1 — confidently, with no indication anything is missing. A
-- dashboard that admits it cannot see is safer than one that quietly shows you
-- your own reflection.
--
-- THE FIX IS A COUNT, NOT A GRANT. Nothing here opens a table to anybody. One
-- security definer function returns four integers, guarded by is_admin(), and
-- integers carry no identifiers: not a file_id, not a user_id, not a document.
-- The privacy guarantee in 0004 is untouched, and a non-admin gets zeros
-- rather than an error, because "you may not ask" and "the query broke" must
-- not look alike either.
--
-- Pattern copied from what is already here: security definer + `set
-- search_path = ''` (0004's uploads_pending_delete, 0005's is_admin), revoke
-- from public, then grant execute to authenticated only.

create or replace function public.admin_counts()
returns table (
  accounts        bigint,
  contracts_saved bigint,
  scans_uploaded  bigint,
  scans_pending   bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    /* Every branch returns 0 for a caller who is not an operator, rather than
       raising. The console distinguishes three states — a number, zero, and
       "could not read" — and an exception here would collapse the first two
       into the third for everyone who is simply not staff. */
    coalesce((select count(*) from public.profiles  where public.is_admin('viewer')), 0),
    coalesce((select count(*) from public.contracts where public.is_admin('viewer')), 0),
    coalesce((select count(*) from public.uploads   where public.is_admin('viewer')), 0),
    /* Should trend to zero: the retention sweep deletes upstream and stamps
       deleted_at. A number that stays high here means the sweep is not
       running, which is the one thing this row exists to reveal. */
    coalesce((select count(*) from public.uploads
               where deleted_at is null and public.is_admin('viewer')), 0);
$$;

comment on function public.admin_counts is
  'Operator dashboard totals. Returns counts only — never a row, an id or a file_id. Zeros for non-admins.';

revoke all on function public.admin_counts() from public, anon;
grant execute on function public.admin_counts() to authenticated;
