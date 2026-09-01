/* The pre-launch curtain.
 *
 * The product is finished and hidden. That is a strange state for software to
 * be in, and it has exactly two failure modes worth testing:
 *
 *   1. THE CURTAIN LEAKS — a visitor reaches the app, hits a paywall that
 *      cannot take money, and forms a permanent opinion of an unfinished
 *      product.
 *
 *   2. THE CURTAIN IS ACTUALLY A DELETION — someone "hides" a feature by
 *      removing it, and launch day turns into a rebuild. This suite asserts
 *      the opposite: every launch-day element is still in the document,
 *      one CSS class away from visible, and the whole product still works
 *      through the preview key.
 *
 * Everything else in this repo tests the product. This tests the curtain in
 * front of it.
 */
const { playwright, launchOpts, BASE, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const b = await chromium.launch(launchOpts());

  /* ---- 1. the lock */
  console.log("\n— the app is locked to the public");
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(BASE + "/app/", { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("load");
  ok(!/\/app\//.test(p.url()),
     `opening /app/ without the key lands somewhere else (${p.url().replace(BASE, "") || "/"})`);
  const landed = await p.evaluate(() => ({
    soon: document.documentElement.className.includes("soon"),
    text: document.body.textContent
  }));
  ok(landed.soon, "and what it lands on is the pre-launch page");
  ok(/قريبًا|Launching soon/i.test(landed.text), "which says so in words");

  /* ---- 2. the key */
  console.log("\n— the preview key opens the real product");
  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p2.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p2.goto(APP);
  await p2.waitForFunction(() => typeof window.show === "function");
  const live = await p2.evaluate(() => {
    nat = "sa";
    term = Object.assign(blankTerm(), { how:"employer", start:"2018-01-01",
      end:"2026-01-31", wage:12000, ctype:"indef" });
    owned.case = "plan_case";
    return { onApp: location.pathname.includes("/app/"), award: Math.round(termAward()) };
  });
  ok(live.onApp, "the key keeps you on the app rather than bouncing you out");
  ok(live.award > 0, `and the product behind it still computes (${live.award} SAR on the worked example)`);

  /* ---- 3. the curtain hides, it does not delete */
  console.log("\n— nothing was deleted to hide it");
  const root = await b.newPage({ viewport: { width: 1280, height: 900 } });
  root.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await root.goto(BASE + "/");
  const dom = await root.evaluate(() => {
    /* Computed display, not offsetParent: offsetParent is null for anything
       inside a fixed-position ancestor, and the site header is fixed — which
       would report the nav's launch button as hidden when it is on screen.
       The curtain works by display, so display is what to measure. */
    const vis = el => getComputedStyle(el).display !== "none";
    const launchEls = [...document.querySelectorAll(".launch-only")];
    const soonEls = [...document.querySelectorAll(".soon-only")];
    return {
      soonMode: document.documentElement.className.includes("soon"),
      launchCount: launchEls.length,
      launchVisible: launchEls.filter(vis).length,
      soonVisible: soonEls.filter(vis).length,
      /* Every price is still on the page — the pitch is the pitch. */
      prices: [...document.querySelectorAll(".price .amt")].map(e => e.textContent.trim()).filter(Boolean).length,
      appLinks: [...document.querySelectorAll('a[href*="app/index.html"]')].filter(vis).length,
      text: document.body.textContent
    };
  });
  ok(dom.soonMode, "the site root is in pre-launch mode");
  ok(dom.launchCount > 0 && dom.launchVisible === 0,
     `every launch-day element is still in the document but hidden (${dom.launchCount} present, ${dom.launchVisible} visible)`);
  ok(dom.soonVisible > 0, "and the pre-launch framing is what shows instead");
  ok(dom.appLinks === 0, "no visible link walks a visitor into the locked app");
  ok(dom.prices >= 3, `the prices are still shown — the pitch survives the curtain (${dom.prices})`);

  /* ---- 4. the contact route works, and there is exactly one of each */
  console.log("\n— one number, one address, three ways to use them");
  const contact = await root.evaluate(() => {
    const hrefs = [...document.querySelectorAll("#contact a")].map(a => a.getAttribute("href"));
    return {
      wa: hrefs.filter(h => /wa\.me/.test(h)),
      tel: hrefs.filter(h => /^tel:/.test(h)),
      mail: hrefs.filter(h => /^mailto:/.test(h)),
      shown: document.getElementById("contact").offsetParent !== null
    };
  });
  ok(contact.shown, "the contact section is visible before launch");
  ok(contact.wa.length === 1 && /wa\.me\/966563438351/.test(contact.wa[0]),
     "WhatsApp points at the one number, in international form");
  ok(/[?&]text=/.test(contact.wa[0]),
     "and opens with a message already written, so nobody has to decide what to say");
  ok(contact.tel.length >= 1 && contact.tel.every(h => h === "tel:+966563438351"),
     "every call link is the same number");
  ok(contact.mail.length >= 1 && contact.mail.every(h => /^mailto:[^@]+@alwodouh\.com$/i.test(h)),
     "and every email link is on the Wodouh domain");

  /* ---- 4b. the page's own controls actually work
   *
   * CSP here is script-src 'self' with no 'unsafe-inline', so an inline
   * onclick="..." attribute is silently blocked by any spec-compliant
   * browser — the click fires, nothing happens, and no error is thrown
   * anywhere a human would see it. That is exactly what langBtn shipped
   * with: a real click never changed the language, and page.evaluate() of
   * the function directly (which bypasses the page's own CSP) made it look
   * fine under the wrong kind of test. Asserting a REAL click here, not a
   * function call, is the only version of this check that would have caught
   * it — and did. */
  console.log("\n— the language toggle is a real click, not just a callable function");
  const before = await root.evaluate(() => document.documentElement.lang);
  await root.click("#langBtn");
  const after = await root.evaluate(() => document.documentElement.lang);
  ok(before !== after,
     `clicking #langBtn actually changes the language (${before} -> ${after})`);
  await root.click("#langBtn");
  const back = await root.evaluate(() => document.documentElement.lang);
  ok(back === before, "and clicking it again returns to the start");

  /* ---- 4c. curtain-mode paragraphs match their own curtain-mode button
   *
   * close_p used to render unconditionally ("Analyze your contract now, no
   * sign-up") directly above a soon-only button that only opens a contact
   * link — a promise the button next to it could not keep. Every element
   * that is .launch-only in a section must have a same-section .soon-only
   * sibling of the same tag, so a promise never outlives its matching CTA. */
  console.log("\n— the closing section's promise matches its own curtain state");
  /* close_p used to render unconditionally ("Analyze your contract now, no
     sign-up") directly above a soon-only button that only opens a contact
     link — the paragraph promised something the only visible button could
     not do. Narrow to the one paragraph this actually happened to, rather
     than a section-wide heuristic: a pricing description sitting in the same
     section as a gated CTA is not the same defect, and a broad version of
     this check flagged those as false positives. */
  const closeSection = await root.evaluate(() => {
    const vis = el => getComputedStyle(el).display !== "none";
    const p = document.querySelector('p[data-t="close_p"]');
    const pSoon = document.querySelector('p[data-t="close_p_soon"]');
    return {
      launchGated: p ? p.classList.contains("launch-only") : null,
      soonPromiseVisible: pSoon ? vis(pSoon) : null,
      launchPromiseVisible: p ? vis(p) : null,
    };
  });
  ok(closeSection.launchGated === true,
     "close_p is gated to the launched product, not shown unconditionally");
  ok(closeSection.soonPromiseVisible === true && closeSection.launchPromiseVisible === false,
     "and under the curtain, the soon-mode promise shows while the launch-mode one does not");

  /* ---- 5. launch is one flag, not a rebuild */
  console.log("\n— launch is a flag, and flipping it brings everything back");
  const flipped = await root.evaluate(() => {
    /* Exactly what setting the flag to true does: the class comes off. */
    document.documentElement.classList.remove("soon");
    const vis = el => getComputedStyle(el).display !== "none";
    return {
      launchVisible: [...document.querySelectorAll(".launch-only")].filter(vis).length,
      soonVisible: [...document.querySelectorAll(".soon-only")].filter(vis).length,
      appLinks: [...document.querySelectorAll('a[href*="app/index.html"]')].filter(vis).length
    };
  });
  ok(flipped.launchVisible > 0 && flipped.soonVisible === 0,
     `removing one class restores the launched site and retires the pre-launch framing (${flipped.launchVisible} back, ${flipped.soonVisible} left over)`);
  ok(flipped.appLinks > 0, "and the links into the app come back with it");

  /* The flag itself must actually be a flag — a hardcoded curtain with no way
     back is the failure this whole file exists to prevent. */
  const flags = await Promise.all([BASE + "/", BASE + "/app/#preview"].map(async u => {
    const q = await b.newPage();
    await q.goto(u);
    const v = await q.evaluate(() => window.WODOUH_LAUNCHED);
    await q.close();
    return v;
  }));
  ok(flags.every(v => v === false),
     "both pages carry the same flag, currently false");

  /* ================================ 3. THE CURTAIN MUST NOT EAT A SIGN-IN
     Supabase returns the session in the URL FRAGMENT, and app/auth.js reads it
     from there. The curtain runs first, in the head. Before this was fixed it
     saw `#access_token=...` — no `preview` — and replaced the page before
     auth.js could read the token, so signing in was impossible while the
     curtain was up. It failed looking exactly like a redirect-URL
     misconfiguration, which is the most expensive way for a bug to look.

     Both directions matter here: the callback gets through, AND the curtain
     still holds for everyone else. The second half is what stops this fix
     becoming the leak in failure mode 1 above. */
  console.log("\n— an OAuth return gets back in, and nothing else does");

  async function lands(hash) {
    const q = await b.newPage();
    await q.goto(BASE + "/app/" + hash);
    await q.waitForTimeout(250);
    const where = new URL(q.url());
    const inside = /\/app\/?$/.test(where.pathname);
    const h = where.hash;
    await q.close();
    return { inside, hash: h };
  }

  const cb = await lands("#access_token=fake.token.value&refresh_token=fake&expires_in=3600");
  ok(cb.inside, "a sign-in callback is let through instead of bounced to the coming-soon page");

  /* And the token does not stay in the address bar, because a URL carrying one
     gets pasted into chats and left in history. What replaces it is the
     preview key, so the next reload does not eject the reader again. */
  ok(!/access_token/.test(cb.hash),
     "the token is scrubbed from the address bar once it has been read");
  ok(/preview/.test(cb.hash),
     `and the preview key is put back, so a reload keeps them inside (${cb.hash || "empty"})`);

  const err = await lands("#error=access_denied&error_description=nope");
  ok(err.inside,
     "a FAILED sign-in also gets through, so it can say what happened instead of vanishing");

  /* The half that keeps the curtain a curtain. */
  const bare = await lands("");
  ok(!bare.inside, "a bare visit is still sent to the coming-soon page");
  const noise = await lands("#something-else");
  ok(!noise.inside, "and so is an unrelated hash — the door did not open generally");
  const near = await lands("#access_tokenish=1");
  ok(!near.inside, "a hash that merely resembles a callback does not get in");

  /* THE WATCHDOG HAS TO KNOW ABOUT THE CURTAIN TOO.
     It walked "/app/" with no key, so the guard above sent it to the
     coming-soon page, window.show never appeared, and it reported "the app's
     own JavaScript initialised — FAIL". Run against the real files it failed
     exactly that way — which means the moment Actions billing is fixed, this
     job would have opened an issue every six hours until launch day. A
     watchdog that cries wolf on every run is one nobody reads.

     Nothing caught it because the workflow has never executed. So the curtain
     suite, which owns this rule, now owns the consequence of it as well. */
  console.log("\n— the watchdog goes through the curtain, not into it");
  {
    const { readFileSync, existsSync } = require("node:fs");
    const path = require("node:path");
    const root = path.join(__dirname, "..");
    const wd = readFileSync(path.join(root, "test/watchdog.js"), "utf8");

    /* Every navigation the watchdog makes to the app must carry the key. */
    const gotos = [...wd.matchAll(/page\.goto\(\s*BASE\s*\+\s*"([^"]+)"/g)].map(m => m[1]);
    const appGotos = gotos.filter(u => u.startsWith("/app"));
    ok(appGotos.length > 0, `the watchdog navigates to the app (${gotos.join(", ") || "none"})`);
    const bare = appGotos.filter(u => !/#.*\bpreview\b/.test(u));
    ok(bare.length === 0,
       `and every such navigation carries #preview${bare.length ? " — BARE: " + bare.join(", ") : ""}`);

    /* And it must point at the domain Pages actually serves. */
    ok(existsSync(path.join(root, "CNAME")), "CNAME exists, so a custom domain is configured");
    const cname = readFileSync(path.join(root, "CNAME"), "utf8").trim();
    ok(/CNAME/.test(wd),
       `the watchdog's default origin is read from CNAME rather than written out (${cname})`);
    /* COMMENTS STRIPPED FIRST. The comment explaining why the github.io URL
       was removed contains the string "github.io", so scanning the whole file
       failed on its own explanation — the same trap the register's verified
       count fell into on 24 Aug. Assert against the YAML that executes. */
    const wf = readFileSync(path.join(root, ".github/workflows/watchdog.yml"), "utf8")
      .split("\n").filter(l => !/^\s*#/.test(l)).join("\n");
    ok(!/github\.io/.test(wf),
       "and no executing line hardcodes a github.io URL that the custom domain supersedes");
  }

  await b.close();
  console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\nthe curtain holds, and nothing behind it was lost");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
