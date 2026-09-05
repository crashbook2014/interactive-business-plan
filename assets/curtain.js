/* ============================================================ THE CURTAIN
 *
 * ONE FLAG. Set it to true and the site is a launched product again — every
 * section, every price, every link into the app. Set it to false and the same
 * page becomes a pre-launch page: the same benefits, the same prices, but the
 * calls to action become "talk to us" instead of "try it now", and the app
 * itself is locked.
 *
 * NOTHING IS DELETED BY THIS. No section is removed, no copy is thrown away,
 * no feature is disabled anywhere in app/. The product is complete and tested
 * behind the curtain — twelve suites still run against it on every push, and
 * they run through the lock rather than around it.
 *
 * TO LAUNCH: set this to true HERE and in app/index.html. Two lines, one
 * commit. docs/launch-checklist.md is the full list.
 *
 * It lives in the head so the page never paints the wrong version first — a
 * flash of "Try it now" before it turns into "Coming soon" would look broken
 * on a slow connection, which is most connections.
 */
window.WODOUH_LAUNCHED = true;
if (!window.WODOUH_LAUNCHED) document.documentElement.className += " soon";
