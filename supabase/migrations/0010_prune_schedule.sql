-- Wodouh — actually running the retention the privacy policy promises.
--
-- WHAT WAS WRONG
--
-- 0009 created public.scan_events and public.prune_scan_events(), and the
-- privacy policy tells readers, in both languages, "we keep those rows for
-- thirteen months". Nothing ever called the function. A retention period that
-- nothing enforces is not a retention period; it is a sentence on a page,
-- and it is the kind of sentence a data-protection review asks you to
-- demonstrate rather than assert.
--
-- WHY pg_cron AND NOT AN EDGE FUNCTION
--
-- The deletion is one statement against one table and needs no network, no
-- secret and no application code. Putting it in a scheduled Edge Function
-- would add a deploy step, an API key and a failure mode, all so the database
-- could ask an HTTP service to tell the database to delete rows. pg_cron runs
-- it where the data already is.
--
-- SAFE TO RUN TWICE, like every migration in this directory: the unschedule
-- is guarded on existence, so re-running replaces the job rather than
-- stacking a second copy of it.

create extension if not exists pg_cron;

-- pg_cron's own tables live in the cron schema and are owned by the postgres
-- role. Granting usage explicitly rather than relying on a default keeps this
-- working if Supabase tightens those defaults, the way 0006 had to for the
-- public schema.
grant usage on schema cron to postgres;

do $$
begin
  -- Replace rather than duplicate. cron.unschedule throws if the job is
  -- absent, so it is only called when one is actually there.
  if exists (select 1 from cron.job where jobname = 'wodouh_prune_scan_events') then
    perform cron.unschedule('wodouh_prune_scan_events');
  end if;

  -- 03:10 UTC daily. Off the hour on purpose: every job scheduled at :00
  -- lands on the same instant across a shared platform, and this one has no
  -- reason to join that queue. Daily rather than hourly because the boundary
  -- it enforces is measured in months — running it more often deletes the
  -- same zero rows more often.
  perform cron.schedule(
    'wodouh_prune_scan_events',
    '10 3 * * *',
    $job$ select public.prune_scan_events(); $job$
  );
end;
$$;

-- THE FUNCTION STAYS LOCKED DOWN. 0009 revoked it from public, anon and
-- authenticated so no client can trigger a mass delete; scheduling it does not
-- widen that. cron runs as the job's owner, not as a client role, so nothing
-- here grants a reader any new capability.

comment on function public.prune_scan_events() is
  'Deletes scan_events older than thirteen months. Scheduled daily by 0010 as '
  'wodouh_prune_scan_events. The thirteen months is the figure published in '
  'the privacy policy; if one changes the other must change with it.';
