/* Wodouh — the founder console's public configuration.
 *
 * Written by tools/setup-supabase.mjs. COMMITTED ON PURPOSE: these values
 * are public by design, and the deployed console cannot reach the project
 * unless they ship with it.
 *
 * An empty object is a valid state — every panel then says it is not
 * connected rather than failing, and the status panel still works, because
 * it reads the deployed files at this origin and needs no credentials.
 */
window.WODOUH_CONFIG = Object.assign({
  SUPABASE_URL: "https://nkgjgpageqohalerccfu.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_RYzk7dHgfpv4ZlFN8sFWrQ_Uz3UhQIX",
  REDIRECT_URL: "https://alwodouh.com/app/index.html"
}, window.WODOUH_CONFIG || {});
