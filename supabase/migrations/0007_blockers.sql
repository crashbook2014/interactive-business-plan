-- Wodouh — what is blocking launch, moved out of the public bundle.
--
-- WHY THIS TABLE EXISTS
--
-- The founder console's blockers panel was a hardcoded array in
-- admin/admin.js. That file is served from GitHub Pages at a guessable URL,
-- so every row in it was world-readable by anyone who ran `curl`. One of them
-- read:
--
--   Lawyer review — "Every register row needs a licensed Saudi lawyer before
--                    real users"
--
-- On a product that gives Saudi employment-law guidance, that is a published
-- admission that the legal content is unreviewed. Beside it sat "the pay
-- button simulates" and "CI is unbilled". None of this is a security hole —
-- nothing there grants any capability — which is exactly why row level
-- security did not answer it. It is a liability disclosure, and the fix for a
-- disclosure is to stop publishing it.
--
-- WHY GATING THE RENDER WOULD HAVE BEEN THEATRE
--
-- Refusing to draw the panel changes nothing while the strings are still in a
-- file anyone can fetch. The console could have shown a padlock and the
-- sentence would still have been one `curl` away. The strings had to LEAVE THE
-- BUNDLE, which means living somewhere with an authorisation check in front of
-- them. That is this table.
--
-- WHAT IS DELIBERATELY NOT MOVED
--
-- The status panel above it stays public and uncredentialed. It derives
-- everything from /index.html, /app/index.html and docs/legal-sources.md —
-- all already public — so a stranger could compute it themselves. Hiding it
-- would buy nothing and would cost the one panel that works when the database
-- does not.

create table if not exists public.launch_blockers (
  key   text primary key check (key ~ '^[a-z][a-z0-9_]{2,40}$'),
  label text not null check (length(label) <= 80),
  -- The sentence that must not be public. Kept here rather than in the client
  -- for the reason this whole file exists.
  note  text not null check (length(note) <= 280),
  done  boolean not null default false,
  sort  smallint not null default 0
);

comment on table public.launch_blockers is
  'Founder launch checklist. Operator-only by policy: these rows describe what is NOT ready, which is not a public fact.';

alter table public.launch_blockers enable row level security;

-- Unlike app_flags, which is world-readable because every reader's app needs
-- to know whether payments are live, nothing outside this console has any use
-- for these rows. An operator sees them; everyone else gets an empty result
-- rather than an error, which is the difference between "nothing to show you"
-- and "something is here that you may not have".
create policy launch_blockers_select on public.launch_blockers
  for select using (public.is_admin('viewer'));

-- with check as well as using, for the reason 0005 gives: without it an owner
-- could pass the test on the way in and write a row the policy would not have
-- allowed on the way out.
create policy launch_blockers_update on public.launch_blockers
  for update using (public.is_admin('owner'))
  with check (public.is_admin('owner'));

-- No insert or delete policy. The key set belongs to the code that reads it,
-- not to whoever clicked last — the same argument app_flags makes.

insert into public.launch_blockers (key, label, note, done, sort) values
  ('supabase_project', 'Supabase project',
   'Unblocks accounts, sync, the switches on this page, and the AI', false, 1),
  ('anthropic_key', 'Anthropic API key',
   'Set as a function secret, never in the browser. Unblocks Ask and the AI read', false, 2),
  ('payment_processor', 'Payment processor',
   'Unblocks charging. Until then the pay button simulates', false, 3),
  ('apple_signin', 'Apple Developer account',
   'Unblocks Apple sign-in. Google works without it', false, 4),
  ('actions_billing', 'GitHub Actions billing',
   'Unblocks CI and the live watchdog. Pages deploys either way', false, 5),
  ('lawyer_review', 'Lawyer review',
   'Every register row needs a licensed Saudi lawyer before real users', false, 6)
on conflict (key) do nothing;
