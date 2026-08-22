-- Wodouh — who may operate the console, decided before they first sign in.
--
-- THE PROBLEM THIS SOLVES
--
-- public.admins.user_id references auth.users(id), so a person cannot be made
-- an operator until they have signed in at least once and a row exists to
-- point at. That is a sound foreign key and an impossible starting position:
-- the console is the thing you sign in to, and until someone is an operator it
-- shows them nothing. Every operator so far had to be inserted by hand, from
-- outside the product, after their first sign-in.
--
-- An allowlist keyed by EMAIL can be written in advance, because an email is
-- not a foreign key to anything. The trigger below promotes a matching user
-- the moment their auth.users row appears.
--
-- WHY MATCHING ON EMAIL IS SAFE HERE, AND WHERE ITS LIMIT IS
--
-- The match requires a CONFIRMED email. For Google and Apple that means the
-- provider asserted it, which is the same assurance any "invite by email"
-- flow in any product relies on: to be promoted you must be able to sign in as
-- that address, which means controlling it. Someone who merely knows the
-- address gains nothing.
--
-- The limit worth naming: this is only as strong as the mailbox and the
-- identity provider behind it. If an allowlisted Google account is taken over,
-- the console goes with it. That is true of every admin system that has a
-- password reset, and it is the reason the allowlist is short and the roles
-- are two.
--
-- CASE AND WHITESPACE. Addresses are compared lowercased and trimmed, because
-- "Abdulelah@..." and "abdulelah@..." are the same mailbox and a checklist
-- that says otherwise fails in the least helpful way possible — silently, at
-- the moment someone needs to get in.
--
-- NO CLIENT MAY READ OR WRITE THIS. RLS is enabled with no policy at all, so
-- anon and authenticated can do nothing with it — the same configuration
-- 0002 uses for integration_secrets. The list of people who can operate your
-- product is not a public fact, and neither is the fact that a given address
-- is on it.

create table if not exists public.admin_allowlist (
  email    text primary key check (email = lower(btrim(email)) and email like '%@%'),
  role     text not null default 'owner' check (role in ('owner', 'viewer')),
  added_at timestamptz not null default now(),
  note     text check (note is null or length(note) <= 200)
);

comment on table public.admin_allowlist is
  'Emails that become operators on first sign-in. RLS on with no policies: service role only, never reachable from a browser.';

alter table public.admin_allowlist enable row level security;
revoke all on public.admin_allowlist from anon, authenticated;

insert into public.admin_allowlist (email, role, note) values
  ('abdulelah@alwodouh.com',    'owner', 'Founder'),
  ('crashbook2014@gmail.com',   'owner', 'Founder'),
  ('abdulelah-alshi@hotmail.com','owner', 'Founder')
on conflict (email) do nothing;

-- --------------------------------------------------------- the promotion
-- Runs on insert AND update of auth.users. Update matters: an OAuth user's
-- email_confirmed_at is often set microseconds after the row is created, so an
-- insert-only trigger would miss the very case it exists for.
create or replace function public.promote_allowlisted_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  want text;
  addr text := lower(btrim(coalesce(new.email, '')));
begin
  if addr = '' or new.email_confirmed_at is null then
    return new;
  end if;

  select a.role into want
    from public.admin_allowlist a
   where a.email = addr;

  if want is null then
    return new;
  end if;

  -- do nothing on conflict: a role set by hand in the dashboard outranks the
  -- list, so re-signing in never silently demotes or promotes an existing
  -- operator.
  insert into public.admins (user_id, role, note)
  values (new.id, want, 'from admin_allowlist')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.promote_allowlisted_admin()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_allowlisted on auth.users;
create trigger on_auth_user_allowlisted
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.promote_allowlisted_admin();

-- Anyone already signed in who is on the list but not yet an operator. Makes
-- the migration correct whether it runs before or after the first sign-in,
-- which is the whole point of writing it as a table rather than as an INSERT
-- someone has to remember to run at the right moment.
insert into public.admins (user_id, role, note)
select u.id, a.role, 'from admin_allowlist'
  from auth.users u
  join public.admin_allowlist a on a.email = lower(btrim(u.email))
 where u.email_confirmed_at is not null
on conflict (user_id) do nothing;
