/* Resolve Playwright and the target URL the same way in every suite.
 *
 * These used to hardcode this sandbox — an absolute path into /opt and a
 * literal localhost:8099 — which meant the suites ran nowhere else and no CI,
 * schedule or agent could use them.
 *
 * WODOUH_URL is set by test/run.js. Setting it to the deployed site runs the
 * same assertions against production.
 */
const path = require("node:path");
const fs = require("node:fs");

function playwright(){
  /* Normal resolution first; fall back to the sandbox's global install so the
     suites still run here without an npm install. */
  try { return require("playwright"); } catch(e){}
  const fallback = "/opt/node22/lib/node_modules/playwright";
  if (fs.existsSync(fallback)) return require(fallback);
  throw new Error("Playwright not found. Run `npm install` first.");
}

/* Let Playwright pick its own browser when it has one; use the preinstalled
   Chromium only when it does not. */
function launchOpts(){
  const pre = "/opt/pw-browsers/chromium";
  return fs.existsSync(pre) ? { executablePath: pre } : {};
}

const BASE = (process.env.WODOUH_URL || "http://127.0.0.1:8099").replace(/\/$/, "");
/* The app is behind the pre-launch curtain (see the head of app/index.html).
   The suites run THROUGH the lock rather than around it, using the same
   preview key a human would — so every assertion below also proves the lock
   does not break the product it is hiding.

   A fragment, not a query string: the document request is still exactly
   "/app/", so every route glob in every suite keeps matching. Swap it for
   "?preview" and page.route("**\/app\/") stops matching, and the failures
   look like AI bugs rather than a URL change. */
const APP = BASE + "/app/#preview";

/* IS IT ON SCREEN? — the source string, to be injected into the page.
 *
 * Not `el.hidden`. The attribute is a REQUEST; the computed style is the
 * answer, and they disagreed on six elements in the shipped build. An author
 * rule as ordinary as `.fld{display:block}` outranks the user-agent
 * display:none that the hidden attribute relies on, so a feature could be
 * switched off in code, assert as off in every suite, and still be sitting
 * there on the reader's screen — including a refund guarantee while payments
 * were dark and a lawyer desk with no lawyer.
 *
 * Exported as SOURCE because the check runs inside page.evaluate, where a
 * Node closure cannot follow it. */
const SHOWN_SRC =
  "(el) => !!el && getComputedStyle(el).display !== 'none' " +
  "&& getComputedStyle(el).visibility !== 'hidden'";

module.exports = { playwright, launchOpts, BASE, APP, SHOWN_SRC };
