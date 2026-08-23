/* The founder console, and the promise it must not break.
 *
 * The console lets four features be switched on and off without a deploy. That
 * is a real capability and it costs something: the app now makes a network
 * request it did not make before. This suite pins the terms of that trade.
 *
 *   - UNCONFIGURED, NOTHING CHANGES. With no project, the app fetches nothing,
 *     every switch reads its compiled constant, and the console says so rather
 *     than failing. This is the shipping state, so it is the first assertion.
 *   - THE FREE PATH STAYS SILENT. Open the app, run the calculator, read a
 *     result — zero requests. The flag fetch is lazy by design and this is what
 *     proves the design survived contact with the code.
 *   - FAILURE FALLS TO OFF. No flags, malformed flags, a stale cache, an
 *     unknown key, a string where a boolean belongs: every one lands on the
 *     compiled constant, and every compiled constant is false.
 *   - THE PAGE IS NOT THE PERMISSION. The console ships no service key, no
 *     GitHub token, and no SQL box. Checked as bytes, because "we would never"
 *     is not a control.
 *
 * The database half — that row level security actually refuses a viewer — can
 * only be proven against a live Postgres, which does not exist here. That gap
 * is named at the end rather than papered over.
 */
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { playwright, launchOpts, BASE, APP } = require("./_env.js");

const ROOT = path.join(__dirname, "..");
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

(async () => {
  const appSrc = readFileSync(path.join(ROOT, "app/index.html"), "utf8");
  const adminHtml = readFileSync(path.join(ROOT, "admin/index.html"), "utf8");
  const adminJs = readFileSync(path.join(ROOT, "admin/admin.js"), "utf8");
  const migration = readFileSync(path.join(ROOT, "supabase/migrations/0005_admin.sql"), "utf8");

  /* ---- 1. every compiled default is off */
  console.log("\n— the compiled default of every switch is off");
  for (const k of ["PAYMENT_COMPILED", "SUBSCRIPTIONS_COMPILED", "LAWYER_COMPILED"]) {
    const m = appSrc.match(new RegExp(`const ${k}\\s*=\\s*(true|false)`));
    ok(!!m && m[1] === "false", `${k} is false, so an unreachable flag table cannot leave it on`);
  }
  ok(/window\.WODOUH_LAUNCHED\s*=\s*false/.test(appSrc),
     "the launch curtain is still a compiled constant, not a remote flag");

  const browser = await playwright().chromium.launch(launchOpts());
  const page = await browser.newPage();

  /* Everything the page asks the network for, in order. The whole privacy
     claim is a statement about this list. */
  const requests = [];
  page.on("request", r => requests.push(r.url()));

  await page.goto(APP);
  await page.waitForTimeout(300);

  /* ---- 2. unconfigured means silent */
  console.log("\n— with no project configured, the app asks the network for nothing");
  const external = () => requests.filter(u => !u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:"));
  ok(external().length === 0,
     `no request leaves this origin on load${external().length ? " — " + external().join(", ") : ""}`);

  const state = await page.evaluate(() => ({
    values: flagValues,
    pending: !!flagPending,
    url: flagsUrl(),
    pay: PAYMENT_LIVE, subs: SUBSCRIPTIONS_LIVE, lawyer: LAWYER_DESK.live,
  }));
  /* Both directions. Before a project existed this asserted null; that was
     the state of the day, not a property. What must always hold is that the
     URL exists exactly when the configuration does. */
  const cfgUrl = await page.evaluate(() => (window.WODOUH_CONFIG || {}).SUPABASE_URL || null);
  ok(cfgUrl ? String(state.url).startsWith(cfgUrl) : state.url === null, cfgUrl
    ? "flagsUrl() points at the configured project and nowhere else"
    : "flagsUrl() is null without a project, so there is nothing to fetch");
  ok(state.values === null, "no flags are loaded");
  ok(state.pay === false && state.subs === false && state.lawyer === false,
     "and all three switches read their compiled constant");

  /* ---- 3. the free path is still silent, end to end */
  /* THIS CLAIM NARROWED, and the narrowing is the honest half of a decision
     made elsewhere. It read "a reader who never reaches a paid surface still
     makes no request", and that was true while a scan needed no account. The
     free scan is now one a month counted per person, so reaching a scan means
     reaching a sign-in — and the sign-in screen asks the project which
     providers are enabled, so a request leaves the device.

     What still holds, and is the part that ever mattered: NOTHING ABOUT THE
     CONTRACT OR THE READER GOES ANYWHERE. The probe is a bare GET for a list
     of sign-in methods. So the assertion becomes: the only thing that leaves
     is that probe, and it carries no body. */
  console.log("\n— reaching a scan asks which sign-ins exist, and nothing else");
  requests.length = 0;
  await page.evaluate(() => { obFinish(); analyze("employment"); });
  await page.waitForTimeout(1200);
  const out = external();
  ok(out.every(u => /\/auth\/v1\/settings/.test(u)),
     `the only request is the sign-in probe${out.length ? " — " + out.join(", ") : " (none at all)"}`);
  const bodies = await page.evaluate(() => (window.__sentBodies || []).length);
  ok(!bodies, "and nothing is posted — no contract, no text, no figures");
  /* The contract itself must still never appear in a URL. */
  ok(!out.some(u => /clause|contract|score|text=/i.test(u)),
     "and no request names the document or its result");

  /* ---- 4. fail-safe, in every shape the network can fail */
  console.log("\n— every way this can go wrong lands on the compiled constant");
  const cases = [
    ["nothing loaded", null],
    ["an empty response", []],
    ["a flag key the app does not know", [{ key: "free_money", enabled: true }]],
    ["a string where a boolean belongs", [{ key: "payments", enabled: "true" }]],
    ["null rows", [{ key: "payments", enabled: null }]],
    ["a malformed body", "not-json-at-all"],
  ];
  for (const [name, rows] of cases) {
    const got = await page.evaluate((r) => {
      flagValues = r === null ? null : (typeof flagShape === "function" ? flagShape(r) : null);
      applyFlags();
      return { pay: PAYMENT_LIVE, subs: SUBSCRIPTIONS_LIVE, lawyer: LAWYER_DESK.live };
    }, rows);
    ok(got.pay === false && got.subs === false && got.lawyer === false,
       `${name} → payments, subscriptions and the lawyer desk all stay off`);
  }

  /* A flag CAN turn something on — otherwise the fail-safe assertions above
     would pass on a feature that simply never works. */
  const raised = await page.evaluate(() => {
    flagValues = flagShape([{ key: "payments", enabled: true }]);
    applyFlags();
    return PAYMENT_LIVE;
  });
  ok(raised === true, "and a well-formed flag genuinely does turn one on, so the checks above mean something");

  /* ---- 5. a cached "on" expires */
  console.log("\n— a stale cache cannot keep charging people");
  const stale = await page.evaluate(() => {
    localStorage.setItem("wodouh.flags.v1", JSON.stringify({
      at: Date.now() - (13 * 60 * 60 * 1000),
      rows: [{ key: "payments", enabled: true }],
    }));
    return flagCacheRead();
  });
  ok(stale === null, "a cache older than twelve hours is ignored rather than trusted");
  const fresh = await page.evaluate(() => {
    localStorage.setItem("wodouh.flags.v1", JSON.stringify({
      at: Date.now(), rows: [{ key: "payments", enabled: true }],
    }));
    return flagCacheRead();
  });
  ok(!!fresh && fresh.payments === true, "and a fresh one is read, so the expiry is a ceiling and not a wall");

  /* ---- 6. the console holds no secret and no SQL box */
  console.log("\n— the console carries no credential and cannot run SQL");
  const both = adminHtml + adminJs;
  const SECRETS = [
    ["a service_role key", /service_role|SUPABASE_SERVICE/],
    ["a GitHub token", /gh[pousr]_[A-Za-z0-9]|GITHUB_TOKEN/],
    ["an Anthropic key", /sk-ant-/],
  ];
  for (const [what, re] of SECRETS) ok(!re.test(both), `no ${what} appears in the console`);
  ok(!/\/rpc\/(exec|run)_?sql|["'`]\s*select .*from/i.test(adminJs),
     "no arbitrary SQL is sent from the page — Studio is linked instead");
  /* A CREDENTIAL IS NOT THE ONLY THING THAT SHOULD NOT BE PUBLIC.
     The list above catches keys. It did not catch the blockers panel, which
     was a hardcoded array in admin.js naming everything not yet ready — "the
     pay button simulates", "CI is unbilled", and "Every register row needs a
     licensed Saudi lawyer before real users". This file is served from a
     public URL, so all of it was one `curl` away.

     It granted no capability, which is why every RLS assertion in this suite
     passed while it was true. A disclosure is not a hole, and no policy test
     will ever find one — only a check on the bytes shipped. That is this.

     Phrases, not the array, so a reworded row is still caught. */
  const NOT_PUBLIC = [
    ["the lawyer-review status", /licensed Saudi lawyer|lawyer review/i],
    ["that payment is simulated", /pay button simulates|simulates and grants/i],
    ["the CI billing state", /Actions billing/i],
  ];
  for (const [what, re] of NOT_PUBLIC) {
    ok(!re.test(both),
       `${what} is not shipped in the console — what is NOT ready is not a public fact`);
  }

  /* THE BUILD STAMP MUST NOT LIE ABOUT ITS OWN AGE.
     It exists so a cached copy of admin.js is visible as a stale value rather
     than invisible. I added it, then changed this directory five more times
     without bumping it — so it reported a build four commits old and could not
     do the one job it was added for. "Remember to bump it" had already failed
     once by the time anyone looked.

     So the stamp is checked against the last commit that touched admin/.
     Skips where git history is unavailable, the same way rls.test.js skips
     without Postgres — a check that cannot run must not fail someone's clone. */
  let lastAdminCommit = null;
  try {
    lastAdminCommit = require("node:child_process")
      .execFileSync("git", ["log", "-1", "--format=%cd", "--date=format:%Y-%m-%d", "--", "admin/"],
                    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { /* no git, no history — nothing to compare against */ }
  /* Date, then an optional letter that increments within the day. The letter
     matters: a bump from "2026-08-22c" to "2026-08-22" reads as going
     backwards, and a stamp that cannot be ordered cannot answer "is this the
     build I just pushed". Only the date is compared below; the shape is
     asserted here so the letter cannot quietly become something else. */
  const full = (adminJs.match(/var BUILD\s*=\s*"(\d{4}-\d{2}-\d{2}[a-z]?)"/) || [])[1] || null;
  const stamp = full ? full.slice(0, 10) : null;
  ok(!!stamp, `the console carries a build stamp${full ? " (" + full + ")" : ""}`);
  if (stamp && lastAdminCommit) {
    ok(stamp >= lastAdminCommit,
       `the build stamp (${stamp}) is not older than the last change to admin/ (${lastAdminCommit})`);
  }

  /* ---- the migration row. THE QUESTION THAT COST THE MOST TIME.
     "Not an operator", dark switches and a free-scan limit that did nothing
     were three symptoms of one cause — migrations in the repository that had
     never been applied — and nothing on this page could see it, so each was
     diagnosed separately and wrongly.

     PostgREST tells the two apart without credentials: a missing table says
     "could not find the table"; an existing one whose RLS refuses you says 200
     and an empty array. The third state is the one that matters most: a
     network failure must read UNKNOWN, never "not applied". */
  console.log("\n— the console can tell what the database actually has");
  for (const c of [
    { label: "tables missing", status: 404,
      body: JSON.stringify({ message: "Could not find the table 'public.x' in the schema cache" }),
      want: /PENDING/, not: /APPLIED/ },
    { label: "tables present", status: 200, body: "[]", want: /APPLIED/, not: /PENDING/ },
    { label: "unreachable",    abort: true, want: /UNKNOWN/, not: /PENDING|APPLIED/ },
  ]) {
    const mp = await browser.newPage();
    await mp.route("**/rest/v1/**", r => c.abort ? r.abort()
      : r.fulfill({ status: c.status, contentType: "application/json", body: c.body }));
    await mp.goto(BASE + "/admin/");
    await mp.waitForTimeout(1500);
    const txt = await mp.evaluate(() => (document.getElementById("migrations") || {}).textContent || "");
    await mp.close();
    ok(c.want.test(txt) && !c.not.test(txt),
       `${c.label}: the migration row reads ${c.want.source}${c.not.test(txt) ? " — but also " + c.not.source : ""}`);
  }

  /* ---- the not-an-operator panel. WHY THIS IS TESTED BY DRIVING THE PAGE.
     The panel used to name two possible causes — "the migrations have not run"
     and "this address is not on the list" — and could not tell them apart, so
     it hedged. A reader who had already applied the migrations was sent to
     apply them again. The page can now ask, so it must not hedge; and the one
     failure that matters is the third branch silently falling back to a guess
     when the probe cannot answer.

     Asserted on the RENDERED TEXT, not on the source, because "the source
     contains a sentence" has been wrong here before: a string can exist in the
     file and never reach the screen, and a panel that renders nothing at all
     would pass every source-level check ever written for it. */
  console.log("\n— signed in but not an operator: the panel diagnoses, it does not guess");
  const USER = { id: "00000000-0000-0000-0000-000000000001", email: "someone@example.com" };
  for (const c of [
    { label: "migrations not applied", blockers: { status: 404,
        body: JSON.stringify({ message: "Could not find the table 'public.launch_blockers' in the schema cache" }) },
      want: /have not been applied/, not: /about the address|Could not ask/ },
    { label: "migrations applied",     blockers: { status: 200, body: "[]" },
      want: /about the address/,      not: /have not been applied|Could not ask/ },
    { label: "database unreachable",   blockers: "abort",
      want: /Could not ask the database/, not: /have not been applied|about the address/ },
  ]) {
    const op = await browser.newPage();
    await op.route("**/auth/v1/token**", r => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ access_token: "a", refresh_token: "b", expires_in: 3600, user: USER }) }));
    await op.route("**/auth/v1/user**", r => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(USER) }));
    /* No role: the account is signed in and is not an operator. This is the
       state the panel exists for, and PostgREST expresses it as an empty
       array rather than an error, exactly as it would in production. */
    /* ORDER MATTERS AND IT IS THE OPPOSITE OF WHAT IT LOOKS LIKE. Playwright
       matches routes in REVERSE registration order, so the catch-all is
       registered FIRST and the specific handlers after it. Registered the
       other way round, the catch-all swallows launch_blockers, every case
       gets a 200, and all three "cases" silently test the same branch — which
       is exactly what happened on the first run of this test. */
    await op.route("**/rest/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await op.route("**/rest/v1/admins**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    await op.route("**/rest/v1/launch_blockers**", r => c.blockers === "abort" ? r.abort()
      : r.fulfill({ status: c.blockers.status, contentType: "application/json", body: c.blockers.body }));
    await op.addInitScript(() => {
      try {
        localStorage.setItem("wodouh.session.v1", JSON.stringify({
          refresh_token: "b",
          user: { id: "00000000-0000-0000-0000-000000000001", email: "someone@example.com" }
        }));
      } catch (e) {}
    });
    await op.goto(BASE + "/admin/");
    await op.waitForTimeout(1800);
    const txt = await op.evaluate(() => (document.getElementById("flags") || {}).textContent || "");
    await op.close();
    ok(/not an operator/.test(txt), `${c.label}: the panel renders at all`);
    ok(txt.includes(USER.email),
       `${c.label}: it shows which address is signed in, so "is it on the list" is answerable`);
    ok(c.want.test(txt) && !c.not.test(txt),
       `${c.label}: it says ${c.want.source}${c.not.test(txt) ? " — but ALSO " + c.not.source : ""}`);
  }

  /* THE SECOND WRITER TO THE SAME PANEL. loadFlags() also rewrites #flags when
     its own read fails, and it carried an identical hedge — "if the migrations
     have not been run, app_flags does not exist, that is the likely cause".
     Fixing one and leaving the other would give a page that diagnoses or
     guesses depending on which request happened to fail first.

     Asserted by rendering, not by grepping the source for the old sentence:
     the removed string still appears in this file as a comment explaining why
     it was removed, so a source-level check would pass on prose and prove
     nothing about behaviour. That exact mistake has been made in this suite
     before. */
  {
    const fp = await browser.newPage();
    await fp.route("**/auth/v1/token**", r => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ access_token: "a", refresh_token: "b", expires_in: 3600, user: USER }) }));
    await fp.route("**/auth/v1/user**", r => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(USER) }));
    await fp.route("**/rest/v1/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
    /* loadFlags() runs only for a real operator — `if (A.user() && role)` — so
       this branch is unreachable without a role, and a test that forgot it
       would assert against the signed-out panel and pass for the wrong reason. */
    await fp.route("**/rest/v1/admins**", r => r.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify([{ role: "owner" }]) }));
    await fp.route("**/rest/v1/app_flags**", r => r.fulfill({ status: 404, contentType: "application/json",
      body: JSON.stringify({ message: "Could not find the table 'public.app_flags' in the schema cache" }) }));
    await fp.addInitScript(() => {
      try {
        localStorage.setItem("wodouh.session.v1", JSON.stringify({
          refresh_token: "b",
          user: { id: "00000000-0000-0000-0000-000000000001", email: "someone@example.com" }
        }));
      } catch (e) {}
    });
    await fp.goto(BASE + "/admin/");
    await fp.waitForTimeout(1800);
    const txt = await fp.evaluate(() => (document.getElementById("flags") || {}).textContent || "");
    await fp.close();
    ok(/have not been applied/.test(txt) && !/likely/.test(txt),
       "when the switch table is missing the panel says so outright, instead of offering a likely cause");
  }
  /* 0008's table is deliberately unreadable by any browser, so probing it
     would report a false PENDING on a project where it had run. If someone
     adds it to the probe list later, this fails and says why. */
  ok(!/admin_allowlist/.test((adminJs.match(/var MIGRATION_PROBES[\s\S]*?\];/) || [""])[0]),
     "admin_allowlist is not probed — RLS-with-no-policy can answer like a missing table");

  ok(/noindex/.test(adminHtml), "the page asks not to be indexed");
  ok(/default-src 'none'/.test(adminHtml) && /connect-src 'self'/.test(adminHtml),
     "and it ships its own content security policy");

  /* ---- 7. the console degrades honestly */
  console.log("\n— unconfigured, the console explains itself instead of breaking");
  const errors = [];
  const cspViolations = [];
  page.on("pageerror", e => errors.push(e.message));
  /* THE CHECK WHOSE ABSENCE LET THE CONSOLE SHIP BROKEN. The config was
     written into admin/index.html as an INLINE script, and that page ships
     `script-src 'self'` with no 'unsafe-inline', so the browser refused it.
     WODOUH_CONFIG was never set and the console read "Not connected" — with
     the correct values sitting in the file.

     A pageerror listener does not see this: a refused script is not an
     uncaught exception. Only the console message says so. */
  page.on("console", m => {
    if (/Content Security Policy/.test(m.text()) && !/frame-ancestors/.test(m.text())) {
      cspViolations.push(m.text().slice(0, 120));
    }
  });
  await page.goto(BASE + "/admin/");
  await page.waitForTimeout(900);
  ok(cspViolations.length === 0,
     `no content security policy violation on load${cspViolations.length ? " — " + cspViolations[0] : ""}`);
  const text = await page.evaluate(() => document.body.innerText);
  ok(errors.length === 0, `it loads without a script error${errors.length ? " — " + errors[0] : ""}`);
  /* Assert the RESOLVED STATE, not the rendered string. "Not connected" was
     true of an unconfigured build and equally true of a configured one whose
     config the browser refused to execute — two different problems with two
     different fixes, and the old assertion could not tell them apart. */
  const resolved = await page.evaluate(() => ({
    url: (window.WODOUH_CONFIG || {}).SUPABASE_URL || null,
    configured: typeof WodouhAuth !== "undefined" && WodouhAuth.configured(),
  }));
  const fileHasCfg = readFileSync(path.join(ROOT, "admin/config.js"), "utf8").includes("SUPABASE_URL:");
  ok(!!resolved.url === fileHasCfg, fileHasCfg
    ? `the console's config actually EXECUTES in the browser (${resolved.url})`
    : "the console has no config, and reports none");
  ok(resolved.configured === fileHasCfg,
     fileHasCfg ? "and it resolves as configured" : "and it resolves as unconfigured");
  ok(fileHasCfg ? !/Not connected/i.test(text) : /Not connected/i.test(text),
     fileHasCfg ? "so the switches panel no longer says it is not connected"
                : "the switches panel says it is not connected");
  if (fileHasCfg) {
    ok(/Sign in/i.test(text),
       "and, signed out, it offers the sign-in that is the only way to become an operator");
  }
  /* ---- 7c. the links panel. A console is also the place you leave FROM, and
     a panel of links that 404 is worse than no panel: it costs trust in every
     other row on the page. "#soon" was in the first draft and is a CSS class
     the launch flag toggles, not a route — it would have quietly reloaded the
     front door. Every internal path is fetched here rather than eyeballed. */
  console.log("\n— every link on the console goes somewhere real");
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll("#links a")].map(a => ({
      text: a.textContent.trim(), href: a.getAttribute("href"),
      blank: a.getAttribute("target") === "_blank",
      rel: a.getAttribute("rel") || ""
    })));
  ok(hrefs.length > 15, `the panel carries ${hrefs.length} links`);
  ok(hrefs.every(h => h.href && h.href !== "#"), "none of them is empty or a bare hash");
  ok(hrefs.filter(h => /^https?:/.test(h.href)).every(h => h.blank && /noopener/.test(h.rel)),
     "every off-site link opens in a new tab with rel=noopener");
  for (const h of hrefs.filter(h => h.href.startsWith("/"))) {
    const res = await page.request.get(BASE + h.href.split("#")[0]).catch(() => null);
    ok(!!res && res.status() < 400,
       `"${h.text}" resolves (${h.href} → ${res ? res.status() : "no response"})`);
  }

  /* Was: "the blockers panel names what is missing". It does not any more, and
     must not — signed out, there is nothing to name. */
  ok(!/Waiting/i.test(text) && /operator/i.test(text),
     "signed out, the blockers panel names nothing and asks for an operator");

  /* ---- 7a. the console must not offer a provider the project has not enabled.
     This shipped: admin.js rendered "Sign in with Google" unconditionally, so
     clicking it on a project with Google switched off left the owner on
     Supabase's raw JSON — {"code":400,...,"msg":"Unsupported provider: provider
     is not enabled"} — a blank page with no way back, on the one screen an
     operator uses. The app had this gate; the console did not.

     Three states, and the third is the one that matters most: a settings
     endpoint that is slow, blocked, or unreachable must leave the button
     alone. Hiding a working sign-in because a check failed would lock the
     owner out of their own console — a worse failure than the one being
     fixed. */
  if (fileHasCfg) {
    console.log("\n— the console offers Google only when the project enables it");
    for (const c of [
      { label: "the project reports google disabled", body: '{"external":{"google":false}}', button: false },
      { label: "the project reports google enabled",  body: '{"external":{"google":true}}',  button: true  },
      { label: "the settings endpoint is unreachable", body: null,                            button: true  },
    ]) {
      const probe = await browser.newPage();
      await probe.route("**/auth/v1/settings*", r => c.body
        ? r.fulfill({ status: 200, contentType: "application/json", body: c.body })
        : r.abort());
      await probe.goto(BASE + "/admin/");
      await probe.waitForTimeout(1200);
      const shown = await probe.evaluate(() => !!document.getElementById("signin"));
      const body = await probe.evaluate(() => document.body.innerText);
      await probe.close();
      ok(shown === c.button, `when ${c.label}, the Google button is ${c.button ? "offered" : "withheld"}`);
      if (!c.button) {
        ok(/Sign In \/ Providers/.test(body),
           "and the panel names the Supabase toggle, which is the entire content of that 400");
      }
    }
  }

  /* The console must send an operator back to the CONSOLE. It once carried
     REDIRECT_URL pointing at the app, so Google signed you in and dropped you
     in the product. Absent, app/auth.js falls back to this page's own URL. */
  /* ---- 7b. clicking sign-in must never end on Supabase's raw JSON.
     THIS IS THE VIDEO. The render-time gate above fails open on purpose, so
     when /auth/v1/settings is slow or blocked the button is still offered —
     and clicking it navigated straight to
     {"code":400,...,"msg":"Unsupported provider: provider is not enabled"}:
     unstyled text on a Supabase URL, with no way back. Two rounds of fixes
     did not catch it because no test ever CLICKED the button.

     Each case below routes both endpoints and then clicks, asserting where
     the browser ended up. The last two assert the fail-safe in the direction
     of letting people in: an unreadable check must not become a locked
     console. */
  if (fileHasCfg) {
    console.log("\n— clicking sign-in never dead-ends on raw JSON");
    const REFUSAL = '{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}';
    for (const c of [
      { label: "settings never answers and the provider is off",
        settings: "hang", authorize: "refuse", stays: true },
      { label: "settings claims google is enabled but authorize refuses",
        settings: '{"external":{"google":true}}', authorize: "refuse", stays: true },
      { label: "both are healthy",
        settings: '{"external":{"google":true}}', authorize: "redirect", stays: false },
      { label: "the pre-flight itself fails",
        settings: '{"external":{"google":true}}', authorize: "abort", stays: false },
    ]) {
      const probe = await browser.newPage();
      await probe.route("**/auth/v1/settings*", r => c.settings === "hang"
        ? new Promise(() => {})                       /* never resolves */
        : r.fulfill({ status: 200, contentType: "application/json", body: c.settings }));
      /* The navigation must be observable without actually leaving, so the
         redirect target is fulfilled rather than followed. */
      let navigated = false;
      await probe.route("**/auth/v1/authorize*", r => {
        if (r.request().resourceType() === "document") { navigated = true; return r.abort(); }
        if (c.authorize === "abort") return r.abort();
        return c.authorize === "refuse"
          ? r.fulfill({ status: 400, contentType: "application/json", body: REFUSAL })
          : r.fulfill({ status: 302, headers: { location: "https://accounts.google.com/o/oauth2/auth" }, body: "" });
      });
      await probe.goto(BASE + "/admin/");
      await probe.waitForTimeout(600);
      const btn = await probe.$("#signin");
      ok(!!btn, `${c.label}: the button is offered, so there is something to click`);
      if (btn) {
        await btn.click();
        await probe.waitForTimeout(5200);            /* past both aborts */
        const body = await probe.evaluate(() => document.body.innerText);
        if (c.stays) {
          ok(!navigated, `${c.label}: the browser did NOT navigate to Supabase`);
          ok(/Sign In \/ Providers/.test(body),
             `${c.label}: and the page explains it, naming the Supabase toggle`);
        } else {
          ok(navigated, `${c.label}: sign-in is attempted anyway — an unreadable check is not a refusal`);
        }
      }
      await probe.close();
    }
  }

  /* Exactly one project origin may be reachable from the console. The setup
     script used to leave the previous one behind on every re-run. */
  const adminCsp = (readFileSync(path.join(ROOT, "admin/index.html"), "utf8")
    .match(/<meta http-equiv="Content-Security-Policy"[^>]*?connect-src ([^;"]+)/) || [])[1] || "";
  ok((adminCsp.match(/supabase\.co/g) || []).length === 1,
     `connect-src names exactly one supabase.co origin — got "${adminCsp.trim()}"`);

  const back = await page.evaluate(() => (window.WODOUH_CONFIG || {}).REDIRECT_URL || null);
  ok(back === null,
     `the console sets no REDIRECT_URL, so Google returns to /admin/ and not to the app${back ? " — got " + back : ""}`);

  /* The status panel reads the deployed files, so it must have found the real
     constants rather than defaulting to something reassuring. */
  ok(/PRE-LAUNCH|OPEN|MISMATCH/.test(text), "the status panel read the launch state out of the deployed files");
  ok(/verified/.test(text), "and the register row counted the verified claims");

  /* ---- 7b. the privacy screen describes the flag check, but only where it
     can happen. A privacy screen that lists something this build cannot do is
     as wrong as one that omits something it can. */
  console.log("\n— the privacy copy matches the build it ships in");
  ok(/acc_privacy_flags:\{ar:/.test(appSrc), "the flag sentence exists in both languages");
  ok(/flagsUrl\(\) \? "\\n\\n" \+ t\("acc_privacy_flags"\)/.test(appSrc),
     "and it is gated on flagsUrl() — the same test the fetch itself makes, so copy and behaviour cannot disagree");
  await page.goto(APP);
  await page.waitForTimeout(300);
  const privacy = await page.evaluate(() => {
    goTab("account");
    const b = document.querySelector('#screen-account [data-t="acc_privacy_b"]');
    return b ? b.textContent : "";
  });
  /* The copy must describe the build, in both directions: mention the flag
     check when it can happen, and stay silent when it cannot. */
  const mentions = /single question|سؤالًا واحدًا/.test(privacy);
  ok(privacy.length > 0 && mentions === !!cfgUrl, cfgUrl
    ? "the privacy screen describes the flag check, because it now happens"
    : "unconfigured, the privacy screen does NOT mention a check that never happens");

  /* ---- 8. the migration's shape, which is what actually enforces any of this */
  console.log("\n— the audit log cannot be written from a browser");
  ok(/create policy flag_audit_select on public\.flag_audit\s+for select/.test(migration),
     "flag_audit has a select policy");
  ok(!/create policy \w+ on public\.flag_audit\s+for (insert|update|delete)/.test(migration),
     "and no insert, update or delete policy — so RLS denies all three to every client");
  ok(/create policy admins_select_self on public\.admins/.test(migration) &&
     !/create policy \w+ on public\.admins\s+for (insert|update|delete)/.test(migration),
     "and nothing reachable from a browser can add an operator, including the console");
  ok(/for update using \(public\.is_admin\('owner'\)\)[\s\S]{0,120}with check \(public\.is_admin\('owner'\)\)/.test(migration),
     "only an owner may move a switch, on the way in and on the way out");
  ok(!/create policy \w+ on public\.app_flags\s+for (insert|delete)/.test(migration),
     "the console can flip a flag and can never invent or delete one");

  await browser.close();

  console.log(FAIL.length
    ? `\n${FAIL.length} FAILURES`
    : "\nthe console is inert until configured, and every failure falls to off" +
      " — NOTE: row level security itself is unproven here, there is no Postgres in this environment");
  process.exit(FAIL.length ? 1 : 0);
})();
