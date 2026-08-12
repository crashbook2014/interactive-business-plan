/* The installable, offline shell.
 *
 * Three things can quietly stop being true here and nothing else would notice:
 *
 *   1. The manifest or an icon 404s. The app still works, so no other suite
 *      fails — it just stops being installable, and nobody finds out until a
 *      user says "it opens in Safari".
 *   2. The service worker caches a file whose path has moved. Offline breaks
 *      only when someone is offline, which is exactly when they cannot tell you.
 *   3. The Content-Security-Policy gets loosened to make one of the above work.
 *      This suite pins the policy: the two directives that had to open are
 *      asserted same-origin, and everything that was forbidden before is
 *      asserted still forbidden.
 *
 * Run with `npm test`. WODOUH_URL points it at the deployed site, which is the
 * only way to catch a Pages MIME-type surprise.
 */
const { playwright, launchOpts, BASE, APP } = require("./_env.js");
const { chromium } = playwright();

const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch(launchOpts());
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");

  /* --------------------------------------------------------- the front door */
  console.log("\n— the site root actually serves Wodouh");

  /* This is here because the root served a different product entirely — an
     older business plan, `PULSE — Resident Experience Co.` — for weeks, while
     every suite tested `/app/` and never once loaded `/`. Nobody noticed until
     the founder clicked the link. A domain pointed at Pages would have served
     that page to every visitor who typed the bare address. */
  const root = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const rootFails = [];
  root.on("requestfailed", r => rootFails.push(r.url()));
  root.on("pageerror", e => rootFails.push("pageerror: " + e.message));
  await root.goto(BASE + "/");
  await root.waitForTimeout(400);

  const front = await root.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
    text: document.body.textContent.slice(0, 4000),
    ctas: [...document.querySelectorAll("a[href]")]
      .map(a => a.getAttribute("href"))
      .filter(h => h && !h.startsWith("#") && !h.startsWith("data:")),
  }));
  ok(/وضوح|Wodouh/i.test(front.title), `the root page is Wodouh (${front.title})`);
  ok(!/PULSE|Resident Experience/i.test(front.text),
     "no trace of the old business plan remains at the front door");
  ok(front.lang === "ar" && front.dir === "rtl",
     `the landing page is Arabic and RTL (${front.lang}/${front.dir})`);
  ok(rootFails.length === 0,
     `nothing on the landing page fails to load${rootFails.length ? " — " + rootFails.join(", ") : ""}`);

  /* Every link off the front door must resolve. Moving this file up a
     directory rewrote all of them at once, which is exactly the change that
     silently 404s. */
  for (const href of [...new Set(front.ctas)]) {
    const r = await root.request.get(new URL(href, BASE + "/").href);
    ok(r.status() === 200, `landing link resolves: ${href} (${r.status()})`);
  }

  /* ------------------------------------------------------ link previews */
  console.log("\n— a forwarded link renders as something, not a grey URL");

  /* Wodouh spreads by one person sending it to a colleague, if it spreads at
     all. Without these the forward is a bare URL on WhatsApp, X and LinkedIn. */
  const share = await root.evaluate(() => {
    const m = (sel, attr) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute(attr) : null;
    };
    return {
      canonical: m('link[rel="canonical"]', "href"),
      ogTitle: m('meta[property="og:title"]', "content"),
      ogDesc: m('meta[property="og:description"]', "content"),
      ogImage: m('meta[property="og:image"]', "content"),
      ogUrl: m('meta[property="og:url"]', "content"),
      twCard: m('meta[name="twitter:card"]', "content"),
      hreflang: document.querySelectorAll("link[hreflang]").length,
      absolutes: [...document.querySelectorAll('meta[property^="og:"], link[rel="canonical"]')]
        .map(e => e.getAttribute("content") || e.getAttribute("href"))
        .filter(v => v && /^https?:\/\//.test(v)),
    };
  });
  ok(!!share.ogTitle && !!share.ogDesc, "og:title and og:description are set");
  ok(share.twCard === "summary_large_image", `twitter card is a large image (${share.twCard})`);
  ok(!!share.canonical, "a canonical URL is declared");
  /* The image is the whole point of a large-image card, and a 404 here is
     invisible until someone shares it. */
  if (share.ogImage) {
    const img = await root.request.get(share.ogImage.replace(/^https?:\/\/[^/]+\/[^/]*\//, BASE + "/"));
    ok(img.status() === 200, `the preview image exists (${img.status()})`);
    ok(/image\/png/.test(img.headers()["content-type"] || ""), "and it is a PNG");
  } else {
    ok(false, "og:image is declared");
  }
  /* Every absolute URL must agree with every other. When the domain changes,
     a forgotten one points previews and search engines at the old address —
     and nothing else would notice. */
  const shareOrigins = new Set(share.absolutes.map(u => new URL(u).origin));
  ok(shareOrigins.size === 1,
     `every absolute URL shares one origin${shareOrigins.size > 1 ? " — " + [...shareOrigins].join(", ") : ""}`);

  /* hreflang needs one URL per language. This page serves both from one URL
     with a JS toggle, so declaring it would be a claim we cannot honour. */
  ok(share.hreflang === 0,
     "no hreflang, because one URL serves both languages and the tag would lie");

  console.log("\n— robots and sitemap");
  const robots = await root.request.get(BASE + "/robots.txt");
  ok(robots.status() === 200, `robots.txt is served (${robots.status()})`);
  const robotsText = await robots.text();
  ok(/Sitemap:/i.test(robotsText), "robots.txt points at the sitemap");

  const sitemap = await root.request.get(BASE + "/sitemap.xml");
  ok(sitemap.status() === 200, `sitemap.xml is served (${sitemap.status()})`);
  const sm = await sitemap.text();
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok(locs.length >= 2, `the sitemap lists ${locs.length} URLs`);
  for (const loc of locs) {
    const r = await root.request.get(loc.replace(/^https?:\/\/[^/]+\/[^/]*\//, BASE + "/"));
    ok(r.status() === 200, `sitemap URL resolves: ${new URL(loc).pathname} (${r.status()})`);
  }

  await root.close();

  /* ------------------------------------------------------- the manifest */
  console.log("\n— the manifest");

  const href = await p.evaluate(() => {
    const l = document.querySelector('link[rel="manifest"]');
    return l ? l.href : null;
  });
  ok(!!href, "the page links a manifest");

  const mres = await p.request.get(href);
  ok(mres.status() === 200, `the manifest is served (${mres.status()})`);
  const ctype = (mres.headers()["content-type"] || "");
  /* Chrome refuses a manifest served as text/plain, and a local server that is
     more permissive than Pages hides it until deploy. */
  ok(/manifest\+json|application\/json/.test(ctype),
     `served as a manifest type (${ctype || "none"})`);

  const man = await mres.json();
  ok(man.display === "standalone", "display is standalone, so it opens without a browser bar");
  ok(man.dir === "rtl" && man.lang === "ar", "it declares Arabic and RTL");
  ok(typeof man.short_name === "string" && man.short_name.length <= 12,
     `short_name fits under a home-screen icon (${man.short_name})`);
  ok(!!man.background_color && !!man.theme_color, "background and theme colours are set");

  /* Maskable is a different picture, not a flag on the same one — Android crops
     to the inner 80%, so shipping the standard icon as maskable clips the mark. */
  const maskable = (man.icons || []).filter(i => /maskable/.test(i.purpose || ""));
  ok(maskable.length >= 1, "a maskable icon is declared");
  const big = (man.icons || []).some(i => /512/.test(i.sizes || ""));
  ok(big, "a 512px icon is declared");

  console.log("\n— every icon actually exists");
  const base = href.replace(/[^/]*$/, "");
  for (const icon of man.icons || []) {
    const r = await p.request.get(new URL(icon.src, base).href);
    ok(r.status() === 200, `${icon.src} (${r.status()})`);
  }
  const apples = await p.evaluate(() =>
    [...document.querySelectorAll('link[rel="apple-touch-icon"]')].map(l => l.href));
  ok(apples.length >= 1, `apple-touch-icon declared (${apples.length})`);
  for (const a of apples) {
    const r = await p.request.get(a);
    ok(r.status() === 200, `${a.split("/").pop()} (${r.status()})`);
    /* Safari will not accept an SVG here, and the failure is silent — you get
       a screenshot of the page as your icon. */
    ok(/image\/png/.test(r.headers()["content-type"] || ""),
       "apple-touch-icon is a PNG, which is the only thing Safari accepts");
  }

  console.log("\n— the iOS meta Safari actually reads");
  const meta = await p.evaluate(() => {
    const get = n => { const m = document.querySelector(`meta[name="${n}"]`); return m && m.content; };
    return { cap: get("apple-mobile-web-app-capable"),
             title: get("apple-mobile-web-app-title"),
             bar: get("apple-mobile-web-app-status-bar-style"),
             viewport: get("viewport") };
  });
  ok(meta.cap === "yes", "apple-mobile-web-app-capable is set");
  ok(!!meta.title, `a home-screen title is set (${meta.title})`);
  ok(!!meta.bar, "a status-bar style is set");
  ok(/viewport-fit=cover/.test(meta.viewport || ""),
     "viewport-fit=cover, so the page reaches under the notch when installed");

  /* --------------------------------------------------- the service worker */
  console.log("\n— the offline shell");

  const swRes = await p.request.get(BASE + "/app/sw.js");
  ok(swRes.status() === 200, `sw.js is served (${swRes.status()})`);
  const sw = await swRes.text();

  /* Every path the worker promises to cache must resolve. A moved font is the
     realistic way this breaks, and it breaks only for people with no signal. */
  const listed = (sw.match(/"\.[^"]*"/g) || []).map(s => s.slice(1, -1))
    .filter(s => /\.(html|woff2|png|svg|webmanifest)$/.test(s));
  ok(listed.length >= 4, `the worker names ${listed.length} shell files`);
  for (const rel of listed) {
    const r = await p.request.get(new URL(rel, APP).href);
    ok(r.status() === 200, `precache ${rel} (${r.status()})`);
  }

  /* The worker is the one part of this app that can reach the network with no
     screen in front of it. The privacy promise depends on it never doing so. */
  const hosts = (sw.match(/https?:\/\/[^\s"')]+/g) || [])
    .filter(u => !/^https?:\/\/(localhost|127\.)/.test(u));
  ok(hosts.length === 0,
     `the worker contacts no third party${hosts.length ? " — " + hosts.join(", ") : ""}`);
  /* Comments stripped first: the worker's own header explains that it does no
     background sync, and matching that sentence was the first version of this
     assertion failing on its own documentation. */
  const swCode = sw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok(!/addEventListener\(\s*["'](periodic)?sync["']|PushManager|showNotification/.test(swCode),
     "no background sync or push — nothing runs without the reader present");

  /* Registration only matters over https or localhost. WODOUH_URL against the
     live site exercises the real path; locally this asserts it is attempted. */
  const reg = await p.evaluate(() => new Promise(r => {
    if (!("serviceWorker" in navigator)) return r("unsupported");
    navigator.serviceWorker.getRegistration().then(x => r(x ? "registered" : "none"), () => r("error"));
  }));
  ok(reg === "registered" || reg === "none",
     `service worker registration did not throw (${reg})`);

  /* ------------------------------------------------------------- the CSP */
  console.log("\n— the policy did not quietly widen");

  const csp = await p.evaluate(() => {
    const m = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return m ? m.content : "";
  });
  const dir = name => {
    const m = csp.match(new RegExp(name + "\\s+([^;]+)"));
    return m ? m[1].trim() : null;
  };
  ok(dir("default-src") === "'none'", "default-src is still 'none'");
  ok(dir("manifest-src") === "'self'", `manifest-src is same-origin (${dir("manifest-src")})`);
  ok(dir("worker-src") === "'self'", `worker-src is same-origin (${dir("worker-src")})`);
  ok(dir("object-src") === "'none'" && dir("frame-src") === "'none'",
     "object-src and frame-src are still 'none'");
  ok(dir("form-action") === "'none'" && dir("base-uri") === "'none'",
     "form-action and base-uri are still 'none'");
  /* esm.sh was allowed and never used. An unused allowance is the kind that
     nobody notices being used. */
  ok(!/esm\.sh/.test(csp), "the unused esm.sh allowance is gone");
  ok(!/script-src[^;]*https:/.test(csp), "no third-party script host is permitted");

  /* ------------------------------------------------------- install hint */
  console.log("\n— the install hint tells the truth about where it is shown");

  const hint = await p.evaluate(() => {
    const el = document.getElementById("installHint");
    const before = el.hidden;
    /* Not iOS Safari here, so it must stay hidden. Forcing the branch open is
       the only way to assert the copy without an iPhone. */
    installOff = false;
    const ua = navigator.userAgent;
    return { hiddenOnDesktop: before, ua,
             copyAr: (typeof T === "object" && T.inst_b) ? T.inst_b.ar : "",
             copyEn: (typeof T === "object" && T.inst_b) ? T.inst_b.en : "" };
  });
  ok(hint.hiddenOnDesktop, "hidden where it would be untrue — this is not iOS Safari");
  ok(/Home Screen/i.test(hint.copyEn) && /share/i.test(hint.copyEn),
     "the English copy names the share button and Add to Home Screen");
  ok(hint.copyAr.length > 20, "the Arabic copy is present and not a stub");

  const dismissed = await p.evaluate(() => {
    dismissInstall();
    const stored = JSON.parse(localStorage.getItem(STORE) || "{}");
    return { off: installOff, stored: stored.installOff };
  });
  ok(dismissed.off === true && dismissed.stored === true,
     "dismissing it is remembered, so it never comes back as an advert");

  await b.close();
  if (FAIL.length){
    console.log(`\n${FAIL.length} FAILURES`);
    FAIL.forEach(f => console.log("  - " + f));
    process.exit(1);
  }
  console.log("\nall install and offline checks passed");
})().catch(e => { console.error(e); process.exit(1); });
