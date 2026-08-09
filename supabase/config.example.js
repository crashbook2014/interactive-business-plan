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

  /* OPTIONAL — Claude document analysis.
   *
   * Leave this out and the feature does not exist: no panel renders and no
   * request is ever made. That is the shipping default, and it is the only
   * state in which Wodouh's "nothing leaves your device" promise is true
   * without qualification.
   *
   * Setting it turns on the one feature that sends contract text off the
   * device. Before you do:
   *   - deploy supabase/functions/analyze
   *   - set ANTHROPIC_API_KEY and ALLOWED_ORIGIN as function secrets, never here
   *   - read docs/claude-analysis.md, which says what changes about the privacy
   *     promise and what the app must tell people
   *
   * ANALYZE_URL: "https://YOUR-PROJECT-REF.supabase.co/functions/v1/analyze"
   */
};
