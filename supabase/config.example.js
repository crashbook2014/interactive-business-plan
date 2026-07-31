/* Wodouh — public runtime configuration.
 *
 * Copy to config.js and fill in. config.js is gitignored.
 *
 * Both values below are PUBLIC by design. The anon key is a JWT that says
 * "anonymous visitor"; it grants nothing on its own because every table is
 * protected by row level security. It is safe in frontend source.
 *
 * The service_role key is the opposite: it bypasses RLS entirely. It must
 * never appear in this file, in any file under app/ or web/, or in the repo
 * at all. It belongs only in Supabase Edge Function secrets.
 */
window.WODOUH_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY",

  /* Where OAuth sends the user back. Must be listed verbatim in
     Supabase → Authentication → URL Configuration → Redirect URLs. */
  REDIRECT_URL: "https://crashbook2014.github.io/interactive-business-plan/app/index.html"
};
