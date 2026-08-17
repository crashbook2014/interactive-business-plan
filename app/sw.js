/* Wodouh — offline shell.
 *
 * WHAT THIS IS FOR
 *
 * Someone reads their termination assessment on the metro, in a lawyer's
 * waiting room, on a plane. The app already runs entirely on the device: no
 * API, no database, no round trip to produce a single riyal figure. The only
 * reason it needed a network at all was to fetch itself. This closes that.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * No background sync, no push, no fetch to anywhere. A service worker is the
 * one piece of this app that can talk to the network without a screen in front
 * of it, and Wodouh's promise is that nothing leaves the device. So this file
 * only ever serves bytes that came from our own origin, and it never posts
 * anything anywhere. If you find yourself adding a `fetch` to a third party
 * here, the privacy copy in the app has stopped being true.
 *
 * AND THIS FILE IS THE ONLY THING ENFORCING THAT — NOT THE CSP.
 *
 * A red-team pass proved it: a fetch issued from this worker's context reached
 * a foreign origin while the page's `connect-src 'none'` blocked every
 * equivalent request from the page. A `<meta>` CSP governs the document, not a
 * worker; a worker's policy comes from the response headers on its own script,
 * and GitHub Pages sends none.
 *
 * So there is no second line of defence here. The page has one — the app's meta
 * CSP is closed to everything, and pwa.test.js proves it with a live violation
 * event. The worker has this comment and the code below it.
 *
 * If the site ever moves somewhere that can set headers, send
 * `Content-Security-Policy: connect-src 'none'` on this file and the claim
 * becomes structural instead of editorial.
 *
 * CACHE STRATEGY
 *
 * Stale-while-revalidate on the shell. The page is one 500 KB HTML file plus
 * two fonts, so a cached copy opens instantly and a fresh copy replaces it in
 * the background. Cache-first alone would pin readers to an old build — and
 * this app's builds carry legal figures, so a stale one is not a cosmetic
 * problem. Network-first would give up the offline case entirely.
 *
 * VERSION
 *
 * Bump CACHE on any change to the shell. The old cache is deleted on activate,
 * so a reader never holds two builds at once.
 */
const CACHE = "wodouh-shell-v1";

/* Everything needed to open the app with the network off. Relative, so the
   same file works at /app/ today and at the domain root later. */
const SHELL = [
  "./",
  "./index.html",
  "./auth.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "../assets/fonts/noto-naskh-arabic-var.woff2",
  "../assets/fonts/nunito-var.woff2",
];

self.addEventListener("install", (e) => {
  /* One failed URL must not fail the whole install and leave the reader with
     no offline copy at all, so each is added independently. */
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map((u) => c.add(u).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  /* Same origin only. Anything else — and today there is nothing else — goes
     straight to the network without this file touching it. */
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      /* Cached copy immediately when there is one; the refresh lands for next
         time. With no cached copy, wait for the network — and if that fails
         too, fall back to the shell so a deep link still opens the app rather
         than the browser's offline page. */
      if (hit) { e.waitUntil(fresh); return hit; }
      const res = await fresh;
      if (res) return res;
      return (await cache.match("./index.html")) || Response.error();
    })
  );
});
