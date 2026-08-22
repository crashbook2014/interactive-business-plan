-- Wodouh — take back the EXECUTE grants that Supabase hands out by default.
--
-- WHY THIS FILE EXISTS, AND WHY THE EARLIER REVOKES DID NOT WORK
--
-- 0003 ends with `revoke all on function public.delete_my_account() from
-- public;` followed by a grant to authenticated. That reads as "only signed-in
-- callers may run this". It is not what happened. Checked against the real
-- project after the migrations were applied:
--
--   delete_my_account   anon => TRUE
--
-- Supabase's default privileges grant EXECUTE on every new function in the
-- public schema to `anon` and `authenticated` as roles in their own right.
-- Revoking from PUBLIC removes the PUBLIC grant and leaves those two
-- untouched. So a revoke that names only PUBLIC changes nothing a client can
-- reach, while looking in the source exactly like a revoke that does.
--
-- 0004 got this right by accident of thoroughness — it names all three roles,
-- and uploads_pending_delete is correspondingly unreachable. That contrast is
-- the whole lesson: name the roles.
--
-- WHAT WAS ACTUALLY REACHABLE
--
-- Every SECURITY DEFINER function below was callable by an anonymous browser
-- over /rest/v1/rpc/. The one that matters is bump_rate_limit: it takes the
-- bucket as an argument, so anyone could inflate the counter for any bucket
-- they liked and push a chosen user over their limit. A rate limiter that a
-- stranger can drive is a denial-of-service tool pointed at your own readers.
--
-- The trigger functions (touch_updated_at, handle_new_user,
-- contract_analysis_owner, log_flag_change) would error if called directly,
-- having no trigger context — but "it happens to fail" is not access control,
-- and they have no business on the public API surface. Triggers execute as the
-- table owner and do not consult these grants, so revoking costs nothing.
--
-- WHAT IS DELIBERATELY LEFT ALONE
--
-- public.is_admin(text) keeps its grant to anon, for the reason 0005 records
-- at length: policies call it during signed-out requests, and without the
-- grant a routine denial surfaces as "permission denied for function
-- is_admin" instead of quietly returning nothing. It leaks nothing — for a
-- signed-out caller auth.uid() is null, so it returns false.
--
-- service_role holds its own EXECUTE grant, independent of these, so the Edge
-- Functions that call bump_rate_limit are unaffected. Verified before writing
-- this, not assumed.

-- The rate limiter: service_role only, like the table it writes.
revoke all on function public.bump_rate_limit(text, int, interval)
  from public, anon, authenticated;

-- Trigger functions. Triggers do not consult these grants.
revoke all on function public.touch_updated_at()          from public, anon, authenticated;
revoke all on function public.handle_new_user()           from public, anon, authenticated;
revoke all on function public.contract_analysis_owner()   from public, anon, authenticated;
revoke all on function public.log_flag_change()           from public, anon, authenticated;

-- Account erasure: what 0003 meant to say. A signed-in caller may delete their
-- own account and nobody else's; anon cannot reach it at all. The function's
-- own `if uid is null then raise` stays as the second line of defence.
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
