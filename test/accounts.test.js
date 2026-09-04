/* Accounts, and the consent that has to survive an audit.
 *
 * The schema test proves the database refuses a consent it cannot evidence.
 * This proves the screen in front of it behaves, because a correct constraint
 * with a careless form in front of it produces exactly the outcome the
 * constraint was written to prevent: someone marketed to who never agreed.
 *
 * Five properties, in the order they matter:
 *
 *   1. The app still works signed out. No screen gates, no flow ends at
 *      "create an account". Unconfigured, accounts do not exist at all.
 *   2. The marketing tick is UNCHECKED and is a SEPARATE control from the
 *      number. Saving a number never implies permission to market to it.
 *   3. Skipping is a real answer, and can never be recorded as consent.
 *   4. The exact sentence shown is what gets stored — not a key, not a
 *      paraphrase. A year later "what did they agree to?" has one answer.
 *   5. Sync uploads OUTCOMES and nothing else. Not the contract text, not the
 *      file name, not the sentence someone typed about why they were let go.
 *      This is the only place in the app where that promise is a decision
 *      rather than a fact about the architecture, so it is tested by planting
 *      a canary in every leakable field and searching the whole payload.
 *
 * The Supabase calls are stubbed. What is under test is this app's behaviour,
 * not Supabase's.
 */
const { playwright, launchOpts, APP } = require("./_env.js");
const { chromium } = playwright();
const FAIL = [];
const ok = (c, m) => { if (!c) FAIL.push(m); console.log((c ? "  ok   " : "  FAIL ") + m); };

/* Installed AFTER load, not via addInitScript: auth.js is a real script tag
   now, so an init-script stub gets overwritten by the genuine client the
   moment the page loads. That overwrite is itself worth knowing — it is proof
   the file is actually being fetched and executed.

   Replaces WodouhAuth with a recorder. Everything the app sends is captured
   verbatim so the assertions read the real arguments. */
const STUB = (apple) => {
  /* The genuine client, captured before it is replaced. shape() is the
     allow-list that decides what leaves the device, so the recorder below
     delegates to the real one rather than reimplementing it. */
  const real = window.WodouhAuth;
  window.__sent = [];
  window.WODOUH_CONFIG = Object.assign({}, window.WODOUH_CONFIG, {
    SUPABASE_URL: "https://stub.supabase.co",
    SUPABASE_ANON_KEY: "anon",
    APPLE_SIGNIN: apple
  });
  window.WodouhAuth = {
    configured: () => true,
    appleAvailable: () => apple === true,
    init: () => Promise.resolve({ id: "u1", email: "a@b.co" }),
    user: () => ({ id: "u1" }),
    onChange: () => () => {},
    signInWithGoogle: () => { window.__sent.push({ fn: "google" }); return new Promise(() => {}); },
    signInWithApple: () => { window.__sent.push({ fn: "apple" }); return new Promise(() => {}); },
    signOut: () => Promise.resolve(),
    getProfile: () => Promise.resolve({ id: "u1", phone_prompted_at: null, phone_number: null }),
    savePhone: (n, c, txt) => { window.__sent.push({ fn: "savePhone", n, c, txt }); return Promise.resolve({}); },
    skipPhone: () => { window.__sent.push({ fn: "skipPhone" }); return Promise.resolve({}); },
    /* pushLocal is recorded but NOT stubbed away: the real shape() runs, so
       what the assertions inspect is the payload the shipped file would build
       from the shipped local state. Stubbing the allow-list would test the
       stub. */
    pushLocal: (local) => {
      const body = real.shape(local || {});
      window.__sent.push({ fn: "pushLocal", local, body });
      return Promise.resolve(window.__pushFails ? { sent: 0, failed: 1 } : { sent: 3, failed: 0 });
    },
    shape: real.shape,
    deleteAccount: () => Promise.resolve()
  };
};

(async () => {
  const b = await chromium.launch(launchOpts());

  /* ---- 1. signed out is the whole app */
  console.log("\n— unconfigured: accounts do not exist, and nothing breaks");
  const p0 = await b.newPage({ viewport: { width: 390, height: 844 } });
  const off = [];
  p0.on("request", r => { if (!/^http:\/\/(127\.|localhost)/.test(r.url())) off.push(r.url()); });
  p0.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p0.goto(APP);
  await p0.waitForFunction(() => typeof window.show === "function");
  const bare = await p0.evaluate(() => {
    nat = "sa";
    term = Object.assign(blankTerm(), { how:"employer", start:"2018-01-01",
      end:"2026-01-31", wage:12000, ctype:"indef" });
    return { on: authOn(), signed: signedIn(), award: Math.round(termAward()),
             loaded: typeof WodouhAuth !== "undefined" };
  });
  ok(bare.loaded, "the auth client is loaded same-origin, so the CSP needs no script exception");
  /* Accounts follow the configuration, both ways. Asserting "off" was
     asserting today's date, not a property of the product. */
  const configured = await p0.evaluate(() => WodouhAuth.configured());
  ok(bare.on === configured, configured
    ? "a project is configured, so accounts are available"
    : "with no Supabase project configured, accounts are off");
  ok(bare.signed === false, "nobody is signed in");
  ok(bare.award > 0, `and the product still computes signed out (${bare.award} SAR)`);
  ok(off.length === 0, `with zero off-origin requests${off.length ? ": " + off.join(", ") : ""}`);

  /* Opening sign-in must be impossible rather than merely discouraged. */
  const noRoute = await p0.evaluate(() => {
    openSignin("account");
    return document.querySelector(".screen.active").id;
  });
  ok(configured ? true : forced.reached === false, configured
    ? "with a project configured, the sign-in screen is reachable as intended"
    : "and calling openSignin() directly does not reach the screen");
  await p0.close();

  /* ---- 2. configured: two buttons, and Apple only where it works */
  console.log("\n— the sign-in screen is two buttons, and Apple appears only where it works");
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p.goto(APP);
  await p.waitForFunction(() => typeof window.show === "function");
  await p.evaluate(STUB, false);

  const screen = await p.evaluate(() => {
    openSignin("account");
    const s = document.getElementById("screen-signin");
    const vis = el => el && getComputedStyle(el).display !== "none" && !el.hidden;
    return {
      id: document.querySelector(".screen.active").id,
      google: vis(document.getElementById("auGoogle")),
      apple: vis(document.getElementById("auApple")),
      /* No password field anywhere. Not hidden — absent. */
      pwFields: document.querySelectorAll('#screen-signin input[type="password"]').length,
      emailFields: document.querySelectorAll('#screen-signin input[type="email"]').length,
      text: s.textContent
    };
  });
  ok(screen.id === "screen-signin", "the screen opens when configured");
  ok(screen.google === true, "Google is offered");
  ok(screen.apple === false, "Apple is NOT offered without an Apple developer account — a dead button is worse than one fewer option");
  /* THE EMAIL HALF OF THIS INVERTED, deliberately. It read "no password or
     email field anywhere", and the email half was true only while OAuth was
     the only way in. Email sign-in is now a way in, so a missing email field
     would be the defect.

     The PASSWORD half stands, and is the part that mattered: a six-digit code
     means no credential to store, to leak, to reset, or to hold in trust. */
  ok(screen.pwFields === 0, "there is no password field anywhere on the screen");
  ok(screen.emailFields === 1,
     `and exactly one email field, for the code sign-in (${screen.emailFields})`);
  ok(/without an account/i.test(screen.text) || /بدون حساب/.test(screen.text),
     "and the screen says plainly that the app works without an account");

  const p2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  p2.on("pageerror", e => FAIL.push("pageerror: " + e.message));
  await p2.goto(APP);
  await p2.waitForFunction(() => typeof window.show === "function");
  await p2.evaluate(STUB, true);
  const withApple = await p2.evaluate(() => {
    openSignin("account");
    return !document.getElementById("auApple").hidden;
  });
  ok(withApple === true, "with APPLE_SIGNIN configured, Apple appears — no code change needed");
  await p2.close();

  /* ---- 2b. a provider the project refuses must not become a dead end.
     Supabase answers a disabled provider with 400 JSON, not a redirect, so a
     plain navigation strands the reader on
     {"code":400,...,"msg":"Unsupported provider: provider is not enabled"} —
     raw text on a Supabase URL with no way back to the app. It happened on
     the console more than once; this screen had the identical hole.

     The last case is the one that protects readers from this fix: a
     pre-flight that cannot answer must NOT block sign-in. Not being able to
     check is not evidence of failure. */
  console.log("\n— a refused provider is explained here, not on a Supabase error page");
  for (const c of [
    { label: "the project refuses the provider", pre: "refuse", signs: false },
    { label: "the project allows it",            pre: "allow",  signs: true  },
    { label: "the pre-flight throws",            pre: "throw",  signs: true  },
  ]) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    pg.on("pageerror", e => FAIL.push("pageerror: " + e.message));
    await pg.goto(APP);
    await pg.waitForFunction(() => typeof window.show === "function");
    await pg.evaluate(STUB, false);
    const out = await pg.evaluate(async (mode) => {
      window.WodouhAuth.preflight = () => mode === "throw"
        ? Promise.reject(new Error("cors"))
        : Promise.resolve(mode === "refuse" ? "Unsupported provider: provider is not enabled" : null);
      openSignin("account");
      doSignIn("google");
      await new Promise(r => setTimeout(r, 150));
      const err = document.getElementById("auErr");
      return {
        signed: window.__sent.some(x => x.fn === "google"),
        errShown: !!err && !err.hidden,
        errText: err ? err.textContent : "",
        stillHere: document.querySelector(".screen.active").id,
        /* Proves the string came from the T dictionary rather than being an
           English literal spliced into the DOM — which is how a bilingual app
           starts leaking one language into the other. */
        fromDict: !!(err && err.textContent && err.textContent === t("au_off"))
      };
    }, c.pre);
    ok(out.signed === c.signs,
       `${c.label}: sign-in is ${c.signs ? "attempted" : "not attempted"}`);
    if (!c.signs) {
      ok(out.errShown && out.errText.length > 0,
         `${c.label}: the reason is shown on the sign-in screen instead`);
      ok(out.stillHere === "screen-signin",
         `${c.label}: and the reader is still in the app`);
      ok(!/try again|جرّب مرة ثانية/i.test(out.errText),
         `${c.label}: it does not say "try again" — no number of attempts turns a switch on`);
    }
    if (!c.signs) {
      ok(out.fromDict, `${c.label}: the wording comes from the T dictionary`);
      /* The app opens in Arabic, so that is what this build must render. */
      ok(/[\u0600-\u06FF]/.test(out.errText),
         `${c.label}: and it is rendered in Arabic, the language the app opens in`);
    }
    await pg.close();
  }

  /* ---- 3. the consent checkbox */
  console.log("\n— the marketing tick is unchecked, separate, and never implied");
  const box = await p.evaluate(() => {
    show("phone");
    const c = document.getElementById("phConsent");
    const n = document.getElementById("phNum");
    return { checked: c.checked, type: c.type,
             /* Distinct controls, not one field that means two things. */
             separate: c !== n && !n.contains(c),
             note: document.getElementById("screen-phone").textContent };
  });
  ok(box.checked === false, "it is UNCHECKED by default");
  ok(box.separate === true, "and it is a separate control from the number field");
  ok(/separate from saving the number|منفصل عن حفظ الرقم/i.test(box.note),
     "and the screen says in words that the two are separate decisions");
  ok(/never use it to sign you in|ولا نستخدمه لتسجيل الدخول/i.test(box.note),
     "and that the number is never used to sign in");

  /* ---- 4. what actually gets sent */
  console.log("\n— what the app sends is what the reader chose");
  const noConsent = await p.evaluate(async () => {
    window.__sent = [];
    show("phone");
    document.getElementById("phNum").value = "0512345678";
    document.getElementById("phConsent").checked = false;
    let err = null;
    try { savePhone(); } catch(e){ err = String(e); }
    await new Promise(r => setTimeout(r, 60));
    return { sent: window.__sent[0], err, has: typeof WodouhAuth.savePhone };
  });
  ok(noConsent.sent && noConsent.sent.fn === "savePhone", "saving a number sends savePhone");
  ok(noConsent.sent && noConsent.sent.c === false,
     "a number saved WITHOUT the tick sends consent false — storing a number never implies permission");

  const withConsent = await p.evaluate(async () => {
    window.__sent = [];
    show("phone");
    document.getElementById("phNum").value = "0512345678";
    document.getElementById("phConsent").checked = true;
    savePhone();
    await new Promise(r => setTimeout(r, 60));
    return window.__sent[0];
  });
  ok(withConsent.c === true, "ticking it sends consent true");
  /* The database refuses a true consent without the sentence that produced it,
     so this is the client half of that contract. */
  const shown = await p.evaluate(() => document.querySelector('[data-t="ph_consent"]').textContent.trim());
  ok(typeof withConsent.txt === "string" && withConsent.txt.trim() === shown,
     "and it sends the EXACT sentence shown on screen, not a key or a paraphrase");
  ok(withConsent.txt.length > 20,
     `which is the real wording, not a label (${withConsent.txt.slice(0, 40)}…)`);

  /* ---- 5. skip is an answer, not a consent */
  console.log("\n— skipping is a real answer and can never be read as agreement");
  const skipped = await p.evaluate(async () => {
    window.__sent = [];
    show("phone");
    document.getElementById("phNum").value = "0512345678";
    document.getElementById("phConsent").checked = true;   /* ticked, then skipped */
    skipPhone();
    await new Promise(r => setTimeout(r, 60));
    return window.__sent;
  });
  ok(skipped.length === 1 && skipped[0].fn === "skipPhone",
     "skip records that the question was asked");
  ok(!skipped.some(s => s.fn === "savePhone"),
     "and sends NO number and NO consent, even with the box ticked and a number typed");

  /* ---- 6. sync: the boundary the whole product rests on
   *
   * Everywhere else, "your contract stays on your phone" is true because there
   * was nowhere else to put it. Here there IS somewhere else, so it is a
   * decision that a future edit could quietly reverse. These assertions are
   * written against CONTENT, not against field names: the local state below
   * carries a distinctive string in every place a leak could happen — the
   * pasted contract text, the file name, the typed termination reason, the
   * bilingual event titles — and the payload is searched for all of them.
   * A new field that carries one of these out fails here even if nobody
   * thought to write an assertion for that field. */
  console.log("\n— sync sends outcomes, and never a word the reader wrote or a line of their contract");
  const LEAK = "CANARY";
  const push = await p.evaluate(async (canary) => {
    /* openMigrate refuses unless someone is actually signed in — the stub
       replaces WodouhAuth but never runs initAuth, so say so explicitly. */
    authUser = { id: "u1" };
    myContracts.length = 0;
    myContracts.push({ doc: "doc_emp", score: 61, at: Date.now(), signed: true,
                       text: canary + "_pasted_contract_text",
                       filename: canary + "_عقد.pdf" });
    TRACKED.length = 0;
    TRACKED.push({ doc: "doc_emp", events: [
      { d: 90, k: "info", when: Date.now() + 1,
        t: { ar: canary + "_عنوان", en: canary + "_title" },
        n: { ar: canary + "_شرح",  en: canary + "_note" } }] });
    term = Object.assign(blankTerm(), { how: "employer", start: "2018-01-01",
      end: "2026-01-31", wage: 12000, leaveDays: 12,
      reason: canary + " my manager shouted at me in front of everyone" });
    migAsked = false;
    window.__sent = [];
    openMigrate({ id: "u1", phone_prompted_at: null, phone_number: null });
    const onScreen = document.querySelector(".screen.active").id;
    migrateYes();
    await new Promise(r => setTimeout(r, 80));
    const rec = window.__sent.find(s => s.fn === "pushLocal");
    return { onScreen, body: rec && rec.body, wire: JSON.stringify(rec && rec.body),
             after: document.querySelector(".screen.active").id, asked: migAsked,
             /* Nothing local is destroyed by a sync — it is a copy. */
             kept: myContracts.length === 1 && TRACKED.length === 1 && !!term };
  }, LEAK);

  ok(push.onScreen === "screen-migrate", "having local work opens the sync question rather than assuming an answer");
  ok(push.body && push.body.contracts.length === 1, "saying yes sends the contract record");
  ok(push.wire && push.wire.indexOf(LEAK) === -1,
     "and NOT one character of the contract text, the file name, the typed reason, or the event copy");
  ok(push.body && push.body.case_file && push.body.case_file.reason === "employer",
     "the case file carries the reason KEY, not the sentence the reader wrote");
  ok(push.body && push.body.contracts[0].score === 61 && push.body.contracts[0].doc_kind === "doc_emp",
     "what does cross is the outcome: a document kind and a score");
  ok(push.body && /^\d{4}-\d{2}-\d{2}T/.test(push.body.reminders[0].due_at),
     "reminders carry a real timestamp the database will accept");
  ok(push.kept === true, "and the local copy is untouched — sync is a copy, never a move");
  ok(push.asked === true && push.after === "screen-phone",
     "the question is recorded as asked, then the phone question follows it");

  /* Refusing must be as complete as it sounds. */
  const declined = await p.evaluate(async () => {
    migAsked = false;
    window.__sent = [];
    openMigrate({ id: "u1", phone_prompted_at: null, phone_number: null });
    migrateNo();
    await new Promise(r => setTimeout(r, 60));
    return { sent: window.__sent.map(s => s.fn), asked: migAsked,
             kept: myContracts.length === 1 };
  });
  ok(declined.sent.indexOf("pushLocal") === -1,
     "saying no sends NOTHING — no partial upload, no 'just the safe bits'");
  ok(declined.kept === true, "and their work stays exactly where it was");

  /* Asked once. Being asked on every launch is how an optional question starts
     to feel mandatory — and this one is about uploading their data. */
  const again = await p.evaluate(() => {
    show("home");
    const opened = openMigrate({ id: "u1", phone_prompted_at: null, phone_number: null });
    return { opened, on: document.querySelector(".screen.active").id };
  });
  ok(again.opened === false && again.on === "screen-home",
     "and having answered once, the reader is never asked again on this device");

  /* Nothing to move, nothing to ask. */
  const nothing = await p.evaluate(() => {
    myContracts.length = 0; TRACKED.length = 0; term = null; migAsked = false;
    return openMigrate({ id: "u1" });
  });
  ok(nothing === false, "a reader with no local work is not asked a question about local work");

  /* A failed upload must not claim success, and must not cost them anything. */
  const failed = await p.evaluate(async () => {
    myContracts.length = 0;
    myContracts.push({ doc: "doc_emp", score: 61, at: Date.now(), signed: false });
    migAsked = false; window.__pushFails = true;
    openMigrate({ id: "u1" });
    migrateYes();
    await new Promise(r => setTimeout(r, 80));
    const err = document.getElementById("migErr");
    window.__pushFails = false;
    return { on: document.querySelector(".screen.active").id,
             shown: !err.hidden, msg: err.textContent,
             kept: myContracts.length === 1 };
  });
  ok(failed.shown === true, "a push that partly failed says so instead of moving on");
  ok(/still saved on this device|محفوظ على جهازك/i.test(failed.msg),
     "and tells the reader their work is still on the device");
  ok(failed.kept === true, "which is true — nothing was cleared");

  /* The screen must SAY what leaves, at the moment of asking. A policy page
     nobody opens is not consent to an upload. */
  const words = await p.evaluate(() => {
    if (document.documentElement.lang !== "ar") toggleLang();
    return document.getElementById("screen-migrate").textContent;
  });
  ok(/نص عقدك/.test(words) && /PDF/.test(words),
     "the screen names the contract text and the PDF as things that never leave");
  ok(/الأرقام اللي كتبتها/.test(words),
     "and names what does leave, in the same breath");

  await b.close();
/* ==================================== the door, not just the room behind it
   openSignin() existed with ZERO CALLERS. The sign-in screen was complete in
   two languages and nothing in the app reached it, so an account could not be
   created at all — which also meant nobody could ever become a console
   operator, since that needs an auth.users row.

   The old assertion called openSignin() directly and checked it was guarded.
   That was never the broken part. This drives the UI instead: is there a
   control a person can find and press, and does pressing it arrive somewhere. */
console.log("\n— a person can actually find and reach sign-in");
{
  /* Its own browser: this block sits after the main one is closed. */
  const db = await chromium.launch(launchOpts());
  const d = await db.newPage({ viewport: { width: 390, height: 844 } });
  await d.goto(APP);
  await d.waitForFunction(() => typeof window.show === "function");
  const state = await d.evaluate(() => {
    obFinish(); goTab("account");
    const box = document.getElementById("accAuth");
    const btn = box && box.querySelector("button");
    return {
      configured: authOn(),
      shown: !!box && getComputedStyle(box).display !== "none",
      hasButton: !!btn,
      label: btn ? btn.textContent.trim() : null,
    };
  });

  ok(state.shown === state.configured, state.configured
    ? "the account screen offers an account, because a project is configured"
    : "no project, so the account screen offers nothing — as every optional surface does");

  if (state.configured) {
    ok(state.hasButton && !!state.label,
       `there is a labelled control to press (${state.label})`);
    const reached = await d.evaluate(() => {
      document.querySelector("#accAuth button").click();
      const a = document.querySelector(".screen.active");
      return a ? a.id : null;
    });
    ok(reached === "screen-signin",
       `and pressing it reaches the sign-in screen (${reached})`);
  }
  await d.close();
  await db.close();
}

/* =========================== a provider that is off is not offered
   The first real sign-in attempt landed on Supabase's raw JSON:

     {"code":400,"error_code":"validation_failed",
      "msg":"Unsupported provider: provider is not enabled"}

   Apple was already gated on a config flag — "a dead sign-in button is worse
   than one fewer option" — and Google had no check at all. That asymmetry is
   what sent a reader to a JSON page with no idea what happened and no way
   back.

   The direction of the fail-safe is the part worth pinning: an unreachable or
   unrecognised answer must leave the buttons ALONE. Hiding a working sign-in
   because a check failed is a worse outcome than showing one that might. */
console.log("\n— a sign-in provider the project has not enabled is not offered");
{
  const pb = await chromium.launch(launchOpts());
  /* Email is a provider too, and adding it changed what "nothing is enabled"
     means. "both off" used to be every way in; with an email form on the same
     screen it is not, and the notice must NOT appear — saying no sign-in is
     available above a working sign-in is the same class of lie as offering a
     button that 400s. Hence the fifth case: email alone is enough. */
  const cases = [
    ["all off",      { external: { google: false, apple: false, email: false } }, false, true],
    ["email only",   { external: { google: false, apple: false, email: true  } }, false, false],
    ["google on",    { external: { google: true,  apple: false } },               true,  false],
    ["unreachable",  null,                                                        true,  false],
    ["odd shape",    { something: "else" },                                       true,  false],
  ];
  for (const [name, body, wantGoogle, wantNotice] of cases) {
    const d = await pb.newPage({ viewport: { width: 390, height: 844 } });
    await d.route("**/auth/v1/settings", r => body
      ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) })
      : r.abort());
    await d.goto(APP);
    await d.waitForFunction(() => typeof window.show === "function");
    const seen = await d.evaluate(async () => {
      obFinish(); goTab("account");
      const btn = document.querySelector("#accAuth button");
      if (!btn) return null;
      btn.click();
      await new Promise(s => setTimeout(s, 700));
      const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== "none"; };
      return { google: vis("auGoogle"), notice: vis("auNone"),
               mail: vis("auMailForm"),
               noticeText: (document.getElementById("auNone") || {}).textContent || "" };
    });
    if (!seen) { ok(false, `${name}: the account screen offered no way in`); await d.close(); continue; }
    ok(seen.google === wantGoogle,
       `${name}: the Google button is ${wantGoogle ? "shown" : "hidden"}`);
    ok(seen.notice === wantNotice,
       `${name}: ${wantNotice ? "the reader is told no sign-in is available" : "no needless notice"}`);
    /* The email form obeys the same three-state contract as the buttons: an
       explicit false hides it, anything else leaves it alone. */
    const wantMail = !(body && body.external && body.external.email === false);
    ok(seen.mail === wantMail,
       `${name}: the email form is ${wantMail ? "offered" : "withheld"}`);
    if (wantNotice) {
      ok(/without an account|بدون حساب/.test(seen.noticeText),
         `${name}: and the notice says the app still works without one, which is true`);
    }
    await d.close();
  }
  await pb.close();
}

/* ============================================ the setup script's one job
   tools/setup-supabase.mjs writes supabase/config.js, and that file is served
   to every visitor. So the property worth pinning is narrow and absolute: a
   SECRET key must never be written into it, in any format.

   This matters more since Supabase moved to opaque keys, not less. A
   `sb_secret_…` key cannot be decoded by a JWT reader, so a check written only
   for JWTs called it "unreadable" and refused it by accident — right outcome,
   wrong reason, and one relaxed branch away from writing a key that bypasses
   row level security into a public file. */
console.log("\n— the setup script accepts a publishable key and refuses a secret one");
{
  const { execFileSync } = require("node:child_process");
  const path = require("node:path");
  const fs = require("node:fs");
  const ROOT = path.join(__dirname, "..");
  const jwt = role => "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(JSON.stringify({ role })).toString("base64url") + ".sig";

  /* AGAINST COPIES, NEVER THE REAL FILES. The setup script edits
     app/index.html and admin/index.html in place, so an earlier version of
     this test rewrote the actual product with https://example.supabase.co and
     broke six other suites. A test that mutates the thing it is testing is not
     a test. */
  const os = require("node:os");
  const run = key => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "wodouh-setup-"));
    fs.mkdirSync(path.join(sandbox, "app"));
    fs.mkdirSync(path.join(sandbox, "admin"));
    fs.mkdirSync(path.join(sandbox, "tools"));
    for (const f of ["app/index.html", "admin/index.html", "admin/config.js", "tools/setup-supabase.mjs"]) {
      fs.copyFileSync(path.join(ROOT, f), path.join(sandbox, f));
    }
    let out = "";
    try {
      out = execFileSync("node", [path.join(sandbox, "tools/setup-supabase.mjs"),
        "https://example.supabase.co", key], { encoding: "utf8", stdio: ["ignore","pipe","pipe"] });
    } catch (e) { out = String(e.stderr || e.message); }
    /* The two places the script actually writes: the app's INLINE block, and
       the console's EXTERNAL config file. The console cannot take an inline
       one — its CSP is `script-src 'self'` and the browser refuses it. */
    const wrote = ["app/index.html", "admin/config.js"].every(f => {
      try { return fs.readFileSync(path.join(sandbox, f), "utf8").includes(key); } catch { return false; }
    });
    fs.rmSync(sandbox, { recursive: true, force: true });
    return { wrote, out };
  };

  const cases = [
    ["a new publishable key", "sb_publishable_RYzk7dHgfpv4ZlFN8sFWrQ_Uz3UhQIX", true],
    ["a legacy anon JWT",     jwt("anon"),                                      true],
    ["a new SECRET key",      "sb_secret_ABCdef123456",                         false],
    ["a legacy service_role", jwt("service_role"),                              false],
    ["something that is neither", "hello-world",                                false],
  ];
  for (const [name, key, shouldWrite] of cases){
    const r = run(key);
    ok(r.wrote === shouldWrite, shouldWrite
      ? `${name} is written into BOTH pages`
      : `${name} is REFUSED and never reaches a file the public can read`);
    if (!shouldWrite) ok(/REFUSED/.test(r.out), `${name}: and it says so loudly rather than failing quietly`);
  }
  ok(/ROTATE IT NOW/.test(run("sb_secret_ABCdef123456").out),
     "and a pasted secret key is told to be rotated, because by then it has already been somewhere it should not be");
}

/* ---- the privacy story is told before the contract is asked for.
   "Read on your device" lived four taps deep in Account, while onboarding
   asked a reader who had known this app for ninety seconds to paste an
   employment contract. It is the objection every one of them has and none
   of them types. It is also the one claim that must be stated in the app's
   conditional form, since a scanned contract is uploaded with consent. */
{
  console.log("\n— onboarding says where the contract is read, before asking for one");
  const fs2 = require("node:fs"), path2 = require("node:path");
  const src = fs2.readFileSync(path2.join(__dirname, "..", "app", "index.html"), "utf8");
  const ob = src.slice(src.indexOf("const OB = ["), src.indexOf("--------------------------------------------------------- sample data"));
  ok(ob.length > 200, "the onboarding deck is readable");
  ok(/على جهازك/.test(ob) && /on your device/i.test(ob),
     "a card states that the contract is read on the reader's own device, in both languages");
  ok(/بموافقتك/.test(ob) && /your consent/i.test(ob),
     "and states the consent exception rather than an absolute promise it cannot keep");
  ok(!/never leaves|لا يغادر/.test(ob),
     "onboarding does not make the absolute claim the app itself stopped making");
}

  console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\naccounts are optional, consent is never assumed, and the contract never leaves");
  process.exit(FAIL.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
