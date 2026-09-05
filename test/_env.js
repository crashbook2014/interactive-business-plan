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

/* SIGN THE TEST READER IN — because since the gate landed, every screen past
 * the tour requires an account and a suite that walks the app is a suite that
 * has to get through the door.
 *
 * WHAT THIS DOES NOT DO is turn the gate off. It puts a session in place, which
 * is what a real reader does, so the assertions still run through the gate
 * rather than around it. A suite that wants to prove the gate HOLDS simply does
 * not call this.
 *
 * Both halves are needed. authAllow() reads signedIn() → authUser, and boot
 * routing waits on authReady; a stub that sets only the first still races the
 * real init() resolving to null underneath it. WodouhAuth.user() is stubbed too
 * because scanGate() asks that one rather than authUser.
 *
 * Exported as a FUNCTION (Playwright serialises it into the page) rather than a
 * source string like SHOWN_SRC, since callers run it, not inject it into
 * another expression. signInSrc is the same thing as text, for the two suites
 * that build page scripts as strings.
 */
function signInStub(){
  authUser = { id: "test-user", email: "test@example.com" };
  authReady = Promise.resolve();
  if (typeof WodouhAuth !== "undefined"){
    WodouhAuth.init = () => Promise.resolve(authUser);
    WodouhAuth.user = () => authUser;
  }
}
const signInSrc = "(" + signInStub.toString() + ")();";

/* TURN THE PAYWALL BACK ON, FOR THE SUITES THAT EXIST TO PROVE IT WORKS.
 *
 * The shipped build has FREE_NOW = true (see app/index.html): every door is
 * open and nothing is charged, by the founder's decision while the product is
 * pre-launch. That is a switch, not a deletion — the gates, the prices and the
 * entitlement ladder are all still there, waiting.
 *
 * Which means they can rot. A paywall nobody exercises is one that fails the
 * day it is switched back on, and by then the failure is a revenue bug found
 * by a customer. So the paid suites flip the switch and walk the real journey:
 * they prove the paywall STILL WORKS while it is off.
 *
 * Anything asserting the free-for-everyone behaviour deliberately does not
 * call this.
 */
function paywallOn(){ FREE_NOW = false; }
const paywallSrc = "(" + paywallOn.toString() + ")();";

module.exports = { playwright, launchOpts, BASE, APP, SHOWN_SRC, signInStub, signInSrc, paywallOn, paywallSrc };
