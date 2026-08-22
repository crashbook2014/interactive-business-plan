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
  console.log("\n— a reader who never reaches a paid surface still makes no request");
  requests.length = 0;
  await page.evaluate(() => { obFinish(); analyze("employment"); });
  await page.waitForTimeout(1200);
  ok(external().length === 0,
     `pasting a contract and reading the result sends nothing${external().length ? " — " + external().join(", ") : ""}`);

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
  ok(/noindex/.test(adminHtml), "the page asks not to be indexed");
  ok(/default-src 'none'/.test(adminHtml) && /connect-src 'self'/.test(adminHtml),
     "and it ships its own content security policy");

  /* ---- 7. the console degrades honestly */
  console.log("\n— unconfigured, the console explains itself instead of breaking");
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(BASE + "/admin/");
  await page.waitForTimeout(600);
  const text = await page.evaluate(() => document.body.innerText);
  ok(errors.length === 0, `it loads without a script error${errors.length ? " — " + errors[0] : ""}`);
  ok(/Not connected/i.test(text), "the switches panel says it is not connected");
  ok(/Waiting/i.test(text), "and the blockers panel names what is missing");

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
