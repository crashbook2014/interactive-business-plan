/* Wodouh — public runtime configuration.
 *
 * READ THIS FIRST: THIS FILE IS A REFERENCE, NOT A FILE THE APP LOADS.
 *
 * Nothing loads supabase/config.js. The app's configuration lives INLINE in
 * app/index.html, and the console's inline in admin/index.html, because
 * turning on the network and opening the CSP that permits it must land in the
 * same diff where one reviewer sees both. A separate config.js was also
 * gitignored, so it could never have reached the deployed site at all.
 *
 * TO CONFIGURE, run:
 *
 *     node tools/setup-supabase.mjs https://YOUR-REF.supabase.co sb_publishable_...
 *
 * That writes both files and opens both policies, refuses a secret key, and
 * prints the one step only you can do (the redirect URL). This file stays as
 * documentation of what each value means.
 *
 * Both values below are PUBLIC by design. The publishable key identifies the
 * project and grants no access on its own, because every table is protected by
 * row level security. It is safe in frontend source.
 *
 * Newer projects issue `sb_publishable_…`; older ones a JWT labelled `anon`
 * `public`. Either goes in SUPABASE_ANON_KEY below — the field keeps that name
 * so config.js files already written keep working, and nothing in the app
 * reads the key's contents.
 *
 * The SECRET key is the opposite: `sb_secret_…`, or a legacy `service_role`
 * token, bypasses RLS entirely. It must never appear in this file, in any file
 * under app/ or web/, or in the repo at all. It belongs only in Supabase Edge
 * Function secrets. `tools/setup-supabase.mjs` refuses to write one.
 */
window.WODOUH_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-KEY",

  /* Where OAuth sends the user back. Must be listed verbatim in
     Supabase → Authentication → URL Configuration → Redirect URLs. */
  REDIRECT_URL: "https://alwodouh.com/app/index.html"

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

  /* OPTIONAL — Apple sign-in.
   *
   * A SEPARATE SWITCH FROM SUPABASE ITSELF, because Apple Sign-In needs an
   * Apple Developer account ($99/yr) that a fully-configured project may not
   * have. Leave it out and the Apple button does not render at all — a dead
   * sign-in button is worse than one fewer option, and app.js checks this
   * rather than assuming both providers exist.
   *
   * Set it to true only once the provider is configured in
   * Supabase → Authentication → Providers → Apple.
   *
   * APPLE_SIGNIN: true
   */
};
