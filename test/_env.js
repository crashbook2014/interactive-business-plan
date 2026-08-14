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

module.exports = { playwright, launchOpts, BASE, APP };
