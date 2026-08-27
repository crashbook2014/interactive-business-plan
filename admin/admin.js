/* Wodouh — the founder console.
 *
 * WHAT THIS PAGE IS
 *
 * One place to see what is actually live, move the four runtime switches, and
 * read the numbers. It is deliberately small and deliberately powerless on its
 * own: every permission it appears to have is enforced by row level security in
 * Postgres, and every panel below degrades to an honest empty state rather than
 * an error when the thing it needs does not exist yet.
 *
 * THE STATUS PANEL NEEDS NO CREDENTIALS, AND THAT IS THE POINT
 *
 * It reads the DEPLOYED files at this domain — /index.html, /app/index.html,
 * /docs/legal-sources.md — and parses the constants straight out of them. So it
 * reports what readers are actually getting, not what is in someone's working
 * tree. That distinction has mattered repeatedly on this project: "pushed" and
 * "live" are different claims, and only one of them is checkable from here.
 *
 * It stays public deliberately. Everything it reports is derived from files
 * that are already public, so a stranger could compute it themselves; hiding
 * it would buy nothing and would cost the one panel that still works when the
 * database does not.
 *
 * THE BLOCKERS PANEL IS THE OPPOSITE, AND USED TO GET THIS WRONG
 *
 * What is NOT ready is not a public fact. That list was once a hardcoded array
 * in this file — served from a public URL, so a row stating in plain English
 * that the legal register has not been through professional review was one
 * `curl` away from anyone, on a product that gives Saudi employment-law
 * guidance. (The sentence is not reproduced here: a comment explaining why a
 * string must not ship is not a licence to ship it. My own test caught this
 * comment on the first run.) It granted no
 * capability, so row level security had nothing to say about it: a disclosure
 * is not a hole, and it is fixed by not publishing, not by locking. The rows
 * now live in public.launch_blockers behind is_admin('viewer').
 *
 * WHAT IT WILL NOT DO
 *
 * There is no arbitrary SQL box. An endpoint that runs whatever SQL a browser
 * hands it, using a key that bypasses row level security, is remote code
 * execution against the production database behind one JWT check. Supabase
 * Studio already has a full SQL editor behind Supabase's own auth, and it is
 * one tap away below. What is here instead is a set of named, read-only
 * queries.
 */
(function () {
  "use strict";

  var A = window.WodouhAuth;
  var el = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function row(title, sub, pill, cls, right) {
    return '<div class="row"><span class="tx"><b>' + esc(title) + "</b>" +
      (sub ? "<small>" + esc(sub) + "</small>" : "") + "</span>" +
      (pill ? '<span class="pill ' + cls + '">' + esc(pill) + "</span>" : "") +
      (right || "") + "</div>";
  }
  function empty(html) { return '<div class="empty">' + html + "</div>"; }

  /* ==================================================== 1. what is live
     Same-origin GETs of the published files. No token, no account, nothing
     that could be turned against the reader of the app. */
  var live = {};

  function grab(text, re, cast) {
    var m = text.match(re);
    return m ? (cast ? cast(m[1]) : m[1]) : null;
  }
  var asBool = function (v) { return v === "true"; };

  function readDeployed() {
    return Promise.all([
      fetch("../index.html", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; }),
      fetch("../app/index.html", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; }),
      fetch("../docs/legal-sources.md", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; })
    ]).then(function (res) {
      var root = res[0], app = res[1], reg = res[2];
      live.rootLaunched = grab(root, /window\.WODOUH_LAUNCHED\s*=\s*(true|false)/, asBool);
      live.appLaunched  = grab(app,  /window\.WODOUH_LAUNCHED\s*=\s*(true|false)/, asBool);
      live.payments     = grab(app,  /const PAYMENT_COMPILED\s*=\s*(true|false)/, asBool);
      live.subs         = grab(app,  /const SUBSCRIPTIONS_COMPILED\s*=\s*(true|false)/, asBool);
      live.lawyer       = grab(app,  /const LAWYER_COMPILED\s*=\s*(true|false)/, asBool);
      live.codes        = /const REDEEM_HASHES\s*=\s*\[\s*\]/.test(app) ? 0 : (app ? 1 : null);
      live.appReached   = !!app;

      /* The register, read the same way the register asks to be read: a row
         counts as verified only if a human ticked it.

         COUNTED PER TABLE ROW, not per occurrence in the file. The old pattern
         scanned the whole document, so ANY prose containing the same literal
         inflated the count — and it did: a note added to legal-sources.md on
         24 Aug, warning readers not to miscount these rows, quoted the console's
         own matcher and pushed the console from 29 to 30. A counter that a
         sentence about counting can move is not a counter.

         A row starts at the line beginning with a pipe. Anchoring there means
         the register's prose can say anything it likes about the format. */
      var rows = reg.split("\n").filter(function (l) { return l.charAt(0) === "|"; });
      live.verified = rows.filter(function (l) { return /✅\s*verified\s*\|/.test(l); }).length;
      live.disputed = (reg.match(/⚠️\s*\*\*DISPUTED/g) || []).length;
      var d = reg.match(/Last reviewed:\s*\*\*([^*]+)\*\*/);
      live.reviewed = d ? d[1].trim() : null;
      live.reviewedDays = null;
      if (live.reviewed) {
        var when = new Date(live.reviewed);
        if (!isNaN(when.getTime())) live.reviewedDays = Math.round((Date.now() - when.getTime()) / 86400000);
      }
    });
  }

  /* ONE VERDICT, ABOVE EVERYTHING.
     The question this page exists to answer is "is anything wrong right now",
     and a list of seven rows makes you assemble that answer yourself, every
     time. So it is assembled here.

     Derived from the SAME `live` object the rows below use — not from a second
     read, and not from the flags table. A summary that can disagree with the
     detail under it is worse than no summary, because it is the one people
     will trust and stop scrolling. */
  function renderHero() {
    var host = el("hero");
    if (!host) return;
    var state, why, cls;

    if (!live.appReached) {
      cls = "hold"; state = "Cannot read the deployed site";
      why = "Everything below is unknown rather than fine. If you are on a local server, that is expected.";
    } else if (live.rootLaunched !== live.appLaunched) {
      cls = "bad"; state = "The two curtain flags disagree";
      why = "A visitor can reach an open app through a closed front door, or the reverse. Fix this before anything else.";
    } else if (live.rootLaunched === true) {
      cls = "ok"; state = "Live to the public";
      why = "Real people can reach this. " +
            (live.payments ? "Card payment is on — charges are real." : "Payments are off, so nothing is charged.");
    } else {
      cls = "hold"; state = "Pre-launch";
      why = "Visitors see the coming-soon page. /app/#preview still opens the product.";
    }

    host.className = "hero " + cls;
    host.innerHTML = '<span class="dot" style="background:currentColor"></span>' +
      '<span class="txt"><span class="state">' + esc(state) + '</span>' +
      '<span class="why">' + esc(why) + '</span></span>';
  }

  /* WHICH MIGRATIONS HAVE ACTUALLY RUN.
     This is the question that cost the most time on this project: the console
     said "not an operator", the app's switches stayed dark, and the free-scan
     limit did nothing — all three because migrations existed in the repository
     and had never been applied to the project. Nothing on this page could see
     that, so every symptom was diagnosed separately and wrongly.

     PostgREST distinguishes the two cases for free and WITHOUT CREDENTIALS: a
     table that does not exist answers "could not find the table"; a table that
     exists but whose row level security refuses you answers 200 with an empty
     array. So an anonymous probe of one table per migration says exactly how
     far the database has got.

     Three states, as everywhere else here. A network failure is "unknown", not
     "missing" — reporting a migration as unapplied because the wifi dropped is
     the kind of confidently wrong answer this row exists to end.

     0008 IS DELIBERATELY NOT PROBED, and this is not an oversight. Its table,
     admin_allowlist, has row level security on with no policy at all AND its
     grants revoked from anon and authenticated, precisely so no browser can
     learn who may operate this product. A table in that state may be dropped
     from PostgREST's schema cache entirely, in which case it answers "could
     not find the table" — the exact answer a table that was never created
     gives. A probe of it would therefore report 0008 as PENDING on a project
     where it had run perfectly, which is worse than not asking: it would send
     someone to fix something that was never broken.

     0007 stands in for it, and legitimately. The three pending migrations ship
     as one paste, so launch_blockers being present is evidence the paste
     happened. Evidence, not proof — which is why the panel below says what it
     saw rather than what it concluded. */
  var MIGRATION_PROBES = [
    { table:"app_flags",       upto:"0005" },
    { table:"launch_blockers", upto:"0007" },
    { table:"scan_events",     upto:"0009" }
  ];
  /* The one 0007 answers for. Named once so the operator panel and the
     migrations panel cannot come to disagree about which table that is. */
  var PASTE_WITNESS = "launch_blockers";
  var MISSING = /could not find the table|does not exist|PGRST205|http_404/i;

  function probeTable(name) {
    return A.api("/rest/v1/" + encodeURIComponent(name) + "?select=*&limit=1")
      .then(function () { return "yes"; })
      .catch(function (e) { return MISSING.test(String(e && e.message)) ? "no" : "unknown"; });
  }

  function renderMigrations() {
    var host = el("migrations");
    if (!host) return;
    if (!A || !A.configured()) {
      host.innerHTML = row("Migrations", "No project configured, so there is nothing to have run",
                           "N/A", "off");
      return;
    }
    host.innerHTML = row("Migrations", "Checking what the database actually has\u2026", "\u2026", "off");
    Promise.all(MIGRATION_PROBES.map(function (m) { return probeTable(m.table); }))
      .then(function (r) {
        if (r.indexOf("unknown") >= 0) {
          host.innerHTML = row("Migrations",
            "Could not ask the database. Nothing is concluded from that.", "UNKNOWN", "warn");
          return;
        }
        var last = null, missing = null;
        MIGRATION_PROBES.forEach(function (m, i) {
          if (r[i] === "yes") last = m.upto;
          else if (!missing) missing = m.upto;
        });
        if (!missing) {
          host.innerHTML = row("Migrations", "Everything in supabase/migrations has been applied",
                               "APPLIED", "on");
        } else {
          host.innerHTML = row("Migrations",
            (last ? "Applied up to " + last + ". " : "None applied. ") +
            missing + " onwards has not run \u2014 paste tools/apply-all.sql into the SQL editor",
            "PENDING", "bad");
        }
      });
  }

  function renderStatus() {
    if (!live.appReached) {
      el("status").innerHTML = empty(
        "Could not read the deployed app from this domain. If you are running " +
        "this from a local server, that is expected — open it on the real site " +
        "to see live state.");
      /* The verdict must be right in THIS branch too. An early return that
         skips it would leave the tile showing the last thing it said, which
         on a page whose job is "is anything wrong" is the worst possible
         failure: stale reassurance. */
      renderHero();
      return;
    }
    var h = "";

    /* The two curtain flags live in different files and CAN drift. A visitor
       who reaches an open app through a closed front door, or the reverse, is
       a state neither file knows it is in, so it is checked rather than
       assumed. */
    var launched = live.rootLaunched === true && live.appLaunched === true;
    var split = live.rootLaunched !== live.appLaunched;
    h += row("Launched", split
      ? "The two curtain flags disagree — index.html says " + live.rootLaunched +
        ", app/index.html says " + live.appLaunched
      : (launched ? "The site is open to the public"
                  : "Visitors see the coming-soon page. /app/#preview still opens it"),
      split ? "MISMATCH" : (launched ? "OPEN" : "PRE-LAUNCH"),
      split ? "bad" : (launched ? "on" : "off"));

    /* "Dark" is enough. The previous wording spelled out what happens instead,
       which on a public page is an instruction rather than a status: anyone
       reading it learned how to reach the paid product without paying. The
       fact that payments are off IS derivable from the deployed constant —
       but derivable and advertised are not the same thing, and only one of
       them is a sentence someone can act on. */
    h += row("Payments", live.payments ? "Card payment is live — real charges"
                                       : "Dark. No real charge is taken",
             live.payments ? "ON" : "OFF", live.payments ? "on" : "off");
    h += row("Subscriptions", live.subs ? "Plans render on the account screen"
                                        : "Dark. No recurring plan is offered",
             live.subs ? "ON" : "OFF", live.subs ? "on" : "off");
    h += row("Lawyer desk", live.lawyer ? "The handoff and the lawyer tiers render"
                                        : "Dark. No lawyer tier is sellable",
             live.lawyer ? "ON" : "OFF", live.lawyer ? "on" : "off");
    h += row("Redemption codes", live.codes ? "Codes are armed"
                                            : "None armed. The code box does not render",
             live.codes ? "ARMED" : "EMPTY", live.codes ? "on" : "off");
    h += row("AI analysis",
      A && A.configured() ? "Configured — governed by the switch below"
                          : "No project configured, so no AI surface renders at all",
      A && A.configured() ? "READY" : "OFF", A && A.configured() ? "on" : "off");

    /* The register sets its own twelve-month cadence. Twelve months is also
       the window Article 222 gives a worker to bring a claim, which is a
       useful reminder of who pays for a stale row. */
    var stale = live.reviewedDays != null && live.reviewedDays > 365;
    h += row("Legal register",
      live.verified + " verified, " + live.disputed + " disputed" +
      (live.reviewed ? " — last reviewed " + live.reviewed : ""),
      stale ? "STALE" : (live.disputed ? "1 OPEN" : "CURRENT"),
      stale ? "bad" : (live.disputed ? "warn" : "on"));

    el("status").innerHTML = h;
    renderMigrations();
    renderHero();
  }

  /* ==================================================== 2. the switches */
  var FLAGS = [
    { key: "payments", name: "Payments",
      why: "Turning this on charges real people.",
      danger: true, needs: "a payment processor configured" },
    { key: "subscriptions", name: "Subscriptions",
      why: "Shows recurring plans on the account screen.", danger: false },
    { key: "ai_analysis", name: "AI contract read",
      why: "Sends contract text off the device.",
      danger: true, needs: "ANALYZE_URL set in supabase/config.js" },
    { key: "lawyer_desk", name: "Lawyer desk",
      why: "Renders the lawyer tiers and the handoff.",
      danger: false, needs: "an actual arrangement with a lawyer" }
  ];

  var role = null;       /* null | "viewer" | "owner" */
  var flagRows = null;

  /* A UI guard, not a security control — said plainly because the difference
     matters. It cannot stop a determined operator; it stops a tired one from
     enabling a feature whose credential does not exist, which would fail in
     front of a reader rather than here. */
  function unmet(f) {
    if (f.key === "ai_analysis") {
      var c = window.WODOUH_CONFIG || {};
      return /^https:\/\//.test(c.ANALYZE_URL || "") ? null : f.needs;
    }
    if (f.key === "payments") return f.needs;      /* no gateway is wired yet */
    return null;
  }

  /* Do not offer a provider the project has not enabled.
     Clicking it does not fail politely — Supabase answers the authorize
     request with raw JSON, {"code":400,...,"msg":"Unsupported provider:
     provider is not enabled"}, on a blank page with no way back. The app
     already gates its buttons this way; the console did not, so the one
     screen an operator uses was the one place that still handed them that
     page.

     Three states, matching app/index.html's renderProviders exactly:
       google === false  the project says no — replace the button with the
                         fix, because "turn it on in Supabase" is the entire
                         content of that 400.
       an answer, or none  leave the button alone. A blocked or slow
                         /auth/v1/settings must never lock the owner out of
                         their own console. */
  /* Say why sign-in is unavailable, on THIS page. The whole point of the two
     checks below is that this sentence exists somewhere the reader can act on
     it, rather than as raw JSON on a Supabase URL with no way back. */
  function refuse(host, msg) {
    host.innerHTML = empty(
      "<b>Google sign-in is not available on this project.</b><br>" +
      (msg ? "<br>Supabase said: <code>" + esc(msg) + "</code><br>" : "") +
      "<br>Turn it on under <b>Authentication \u2192 Sign In / Providers \u2192 " +
      "Google</b>: the toggle at the top must be on and <b>saved</b>, not just " +
      "the client id and secret filled in. Then reload this page.");
  }

  /* CHECK AT THE CLICK, NOT ONLY AT THE PAINT.
     offerSignin below runs when the panel renders, and it fails open on
     purpose — a slow or blocked /auth/v1/settings must never hide a working
     sign-in. But failing open at paint time means the button can still be
     there to click, and clicking it is a one-way navigation. So the same
     question is asked again here, where the consequence actually is, and this
     time it is awaited.

     Then the request itself is pre-flighted, because the settings endpoint is
     a claim about configuration and /authorize is the truth. If they
     disagree — and a project can report a provider enabled while authorize
     refuses it — only this catches it.

     ANY INCONCLUSIVE ANSWER NAVIGATES. Not being able to check is not
     evidence of failure, and refusing to try would turn a network hiccup into
     a locked console. */
  function attemptSignin(host) {
    var btn = el("signin");
    if (btn) { btn.disabled = true; btn.textContent = "Checking\u2026"; }
    var settings = A.providers ? A.providers() : Promise.resolve(null);
    settings.then(function (ext) {
      if (ext && ext.google === false) return "provider is not enabled";
      return A.preflight ? A.preflight("google") : null;
    }).catch(function () { return null; })
      .then(function (msg) {
        if (msg) { refuse(host, msg); return; }
        A.signInWithGoogle();
      });
  }

  function offerSignin(host) {
    if (!A.providers) return;
    A.providers().then(function (ext) {
      if (!ext || ext.google !== false) return;
      var btn = el("signin");
      if (!btn || btn.closest("#flags") !== host) return;   /* re-rendered since */
      refuse(host, "provider is not enabled");
    }).catch(function () {});
  }

  /* Bumped by every renderFlags(), so an in-flight probe can tell whether the
     panel it was asked about is still the panel on screen. */
  var flagsGen = 0;

  /* WHY THIS PANEL ASKS THE DATABASE A QUESTION BEFORE IT SAYS ANYTHING.
     It used to say: operators are named in admin_allowlist, and "if this
     address is on that list, 0008 has probably not been applied". Every word
     of that was true and it still sent the reader nowhere, because it named
     two possible causes and could not tell them apart — while the same page,
     three cards down, was already asking the database which migrations had
     run. A page that holds the answer and prints the guess is worse than one
     that has neither, because the guess is believed.

     So: one probe, then one definite sentence. And the address is shown,
     because "if this address is on that list" is unanswerable by someone who
     cannot see which address they are signed in as. It is the reader's own
     email on the reader's own screen — nothing is disclosed that the account
     menu does not already show.

     The third branch matters as much as the other two. When the probe cannot
     reach the database, this says so and stops. It does not fall back to the
     old guess, because a guess that appears only when the evidence is missing
     is exactly the guess most likely to be wrong. */
  function notOperator(host) {
    /* renderFlags() rewrites this host's innerHTML, it does not replace the
       element — so comparing the element against el("flags") when the probe
       returns would compare a thing to itself and guard nothing. A counter is
       the only thing that actually changes across a re-render. */
    var gen = ++flagsGen;
    var u = A.user() || {};
    var addr = u.email ? "<code>" + esc(u.email) + "</code>" : "this account";
    var head = "<b>You are signed in, but this account is not an operator.</b>" +
               "<br><br>Signed in as " + addr + ".<br><br>";
    var floor = "<br><br>No page can grant itself access, including this one: " +
                "<code>public.admins</code> has no write policy at all.";

    host.innerHTML = empty(head + "Checking whether the migrations have run\u2026");

    probeTable(PASTE_WITNESS).then(function (r) {
      if (gen !== flagsGen) return;                    /* re-rendered since */
      var body;
      if (r === "no") {
        body = "<b>The migrations have not been applied.</b> " +
          "<code>public." + esc(PASTE_WITNESS) + "</code> does not exist in this " +
          "project, so the paste that also creates the operator allowlist " +
          "(<code>0008</code>) has not run either. This is the cause, and it is " +
          "not about this account.<br><br>" +
          "Supabase dashboard \u2192 SQL Editor \u2192 paste " +
          "<code>tools/apply-all.sql</code> \u2192 Run, then reload this page. " +
          "It is safe to run more than once.";
      } else if (r === "yes") {
        body = "<b>The migrations have run</b> \u2014 so this is about the " +
          "address, not the database. To become an operator, " + addr + " must " +
          "be listed in <code>public.admin_allowlist</code> <em>and</em> its " +
          "email must be confirmed; the trigger promotes it on sign-in and " +
          "backfills anyone already signed in.<br><br>" +
          "The usual answer is that this is a different address from the one on " +
          "the list. Check it character for character \u2014 the list is " +
          "compared lowercased and trimmed, so case and stray spaces are not " +
          "the problem, but a different mailbox is.";
      } else {
        body = "<b>Could not ask the database</b> whether the migrations have " +
          "run, so nothing is concluded from that. It could be the paste or it " +
          "could be the address; this page will not guess between them. Reload " +
          "when the connection is back.";
      }
      host.innerHTML = empty(head + body + floor);
    });
  }

  function renderFlags() {
    flagsGen++;
    var host = el("flags");
    if (!A || !A.configured()) {
      host.innerHTML = empty(
        "<b>Not connected.</b> There is no Supabase project yet, so there is " +
        "nothing to switch. Create one, run <code>node tools/setup-supabase.mjs</code> " +
        "to write its URL and publishable key into <code>admin/config.js</code> and " +
        "the app, paste <code>tools/apply-all.sql</code> into the SQL editor, then " +
        "add yourself to <code>public.admins</code> with role <code>owner</code>." +
        "<br><br>" +
        "Until then every switch is the constant compiled into the app, and " +
        "the panel above shows what those are.");
      return;
    }
    if (!A.user()) {
      host.innerHTML = empty("Sign in to see the switches.") +
        '<div class="row"><span class="tx"></span>' +
        '<button class="go" id="signin">Sign in with Google</button></div>';
      el("signin").onclick = function () { attemptSignin(host); };
      offerSignin(host);
      return;
    }

    if (!role) { notOperator(host); return; }

    var byKey = {};
    (flagRows || []).forEach(function (r) { byKey[r.key] = r; });

    host.innerHTML = FLAGS.map(function (f) {
      var r = byKey[f.key], on = !!(r && r.enabled), miss = unmet(f);
      var can = role === "owner" && (on || !miss);
      var sub = f.why + (miss ? "  ·  blocked: needs " + miss : "");
      var btn = '<button ' + (can ? "" : "disabled ") +
        'data-flag="' + f.key + '" data-to="' + (on ? "0" : "1") + '"' +
        (on ? "" : ' class="go"') + ">" + (on ? "Turn off" : "Turn on") + "</button>";
      return row(f.name, sub, on ? "ON" : "OFF", on ? "on" : "off", btn);
    }).join("");

    Array.prototype.forEach.call(host.querySelectorAll("button[data-flag]"), function (b) {
      b.onclick = function () { askThenSet(b.getAttribute("data-flag"), b.getAttribute("data-to") === "1"); };
    });
  }

  /* Turning something OFF is never gated: it is the safe direction, and an
     operator reaching for it is usually reaching for it in a hurry. Turning a
     dangerous one ON asks you to type its name, because the two failure modes
     here are charging real people and sending someone's contract off their
     phone. */
  function askThenSet(key, to) {
    var f = FLAGS.filter(function (x) { return x.key === key; })[0];
    if (!to || !f.danger) return setFlag(key, to);

    var dlg = el("confirm");
    el("cfTitle").textContent = "Turn on " + f.name + "?";
    el("cfBody").textContent = f.why + " This takes effect for every reader within seconds. Type " + key + " to confirm.";
    var input = el("cfInput");
    input.value = ""; input.placeholder = key;
    el("cfGo").onclick = function () {
      if (input.value.trim() !== key) { input.value = ""; input.placeholder = "type " + key; return; }
      dlg.close(); setFlag(key, to);
    };
    dlg.showModal();
  }

  function setFlag(key, to) {
    /* PATCH one row. The database decides whether it is allowed — this call
       fails with a 403 for a viewer, and the audit trigger records it for an
       owner. Neither outcome depends on anything this file did. */
    A.api("/rest/v1/app_flags?key=eq." + encodeURIComponent(key), {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: { enabled: to }
    }).then(loadFlags).catch(function (e) {
      el("flags").insertAdjacentHTML("beforeend",
        '<div class="row"><span class="tx"><b>Not changed</b><small>' +
        esc(e.message === "http_403" || /permission/i.test(e.message)
          ? "The database refused it. Only an owner may move a switch."
          : e.message) + "</small></span></div>");
    });
  }

  /* The same guess lived here too, in the same panel: "if the migrations have
     not been run yet, app_flags does not exist — that is the likely cause".
     It was a guess about an answer the error already contained. PostgREST
     names a missing table in its message, so this branch can say which of the
     two things happened instead of offering both and choosing neither.

     Removing one hedge and leaving its twin two hundred lines away would have
     shipped a page that diagnoses or guesses depending on which request failed
     first — which is worse than guessing consistently. */
  function loadFlags() {
    return A.api("/rest/v1/app_flags?select=key,enabled,updated_at,note")
      .then(function (rows) { flagRows = rows; renderFlags(); return rows; })
      .catch(function (e) {
        var gone = MISSING.test(String(e && e.message));
        el("flags").innerHTML = empty(gone
          ? "<b>The migrations have not been applied.</b> " +
            "<code>public.app_flags</code> does not exist in this project, so " +
            "there are no switches to read. Supabase dashboard \u2192 SQL Editor " +
            "\u2192 paste <code>tools/apply-all.sql</code> \u2192 Run, then reload."
          : "<b>Could not read the switches.</b> The table exists as far as this " +
            "page can tell; the request itself failed. Nothing is concluded from " +
            "that \u2014 reload when the connection is back.");
      });
  }

  /* ======================================================== 3. numbers */
  var COUNTS = [
    { name: "Accounts", path: "/rest/v1/profiles?select=id", note: "profiles" },
    { name: "Contracts saved", path: "/rest/v1/contracts?select=id", note: "contracts" },
    { name: "Scans uploaded", path: "/rest/v1/uploads?select=id", note: "uploads" },
    { name: "Scans not yet deleted", path: "/rest/v1/uploads?select=id&deleted_at=is.null", note: "uploads — should trend to zero" }
  ];

  function renderNumbers() {
    var host = el("numbers");
    if (!A || !A.configured()) {
      host.innerHTML = empty("Nothing to count yet — no project, no database, no users.");
      return;
    }
    if (!A.user() || !role) { host.innerHTML = empty("Sign in as an operator to see the numbers."); return; }

    host.innerHTML = COUNTS.map(function (c) { return row(c.name, c.note, "…", "off"); }).join("");
    COUNTS.forEach(function (c, i) {
      /* A header read, not a table download. These rows are people's
         employment situations; counting them should not mean transferring
         them. */
      A.apiCount(c.path).then(function (n) {
        var r = host.children[i];
        if (!r) return;
        r.querySelector(".pill").textContent = String(n);
        r.querySelector(".pill").className = "pill " + (n ? "on" : "off");
      }).catch(function () {
        var r = host.children[i];
        /* Not zero. Zero is a fact; this is the absence of one, and the two
           must never look alike on a page you make decisions from. */
        if (r) r.querySelector(".pill").textContent = "unreadable";
      });
    });
    host.insertAdjacentHTML("beforeend", empty(
      "These read the tables the migrations define. They stay empty until there " +
      "are real users. For anything beyond a count, use Studio below."));
  }

  /* ====================================================== 4. your data */
  function projectRef() {
    var m = ((window.WODOUH_CONFIG || {}).SUPABASE_URL || "").match(/https:\/\/([a-z0-9-]+)\.supabase\.co/);
    return m ? m[1] : null;
  }
  function renderData() {
    var ref = projectRef();
    el("data").innerHTML = ref
      ? row("Supabase Studio", "SQL editor, table editor, auth users and logs — behind Supabase's own sign-in",
            "OPEN", "on",
            '<button onclick="window.open(\'https://supabase.com/dashboard/project/' + esc(ref) + '/sql\',\'_blank\',\'noopener\')">Open</button>')
      : empty(
          "<b>No project yet.</b> When there is one, this links straight to its SQL " +
          "editor.<br><br>There is no SQL box on this page on purpose: an endpoint " +
          "that runs whatever SQL a browser sends it, with a key that bypasses row " +
          "level security, is remote code execution against your production data. " +
          "Studio does the same job behind Supabase's own auth.");
  }

  /* ============================================== 4b. everywhere else
     A console is also the place you leave FROM. Every destination that
     matters to running this product, in one panel, so none of them is a
     bookmark you have to have kept.

     WHAT IS AND IS NOT HERE. The product links are pages any visitor can
     already open, so they are shown to anyone. The operations links go to
     consoles that each have their own sign-in — Supabase, GitHub, Google —
     so the URL grants nothing on its own; what it saves is the thirty seconds
     of finding the right project. Nothing here is a credential and nothing
     describes what is unfinished, which is the line the blockers panel
     crossed.

     The project ref comes from the deployed config rather than being written
     twice, so pointing this console at another project moves these links with
     it. */
  var LINKS_PRODUCT = [
    ["Front door", "/"],
    ["The app", "/app/#preview"],
    /* No "coming soon" chip: #soon is a CSS class the launch flag toggles on
       <html>, not a route, so the link would have quietly reloaded the front
       door. Pre-launch the front door IS the coming-soon page. Checked rather
       than assumed — every path in this list returns 200. */
    ["Terms", "/terms/"],
    ["Privacy", "/privacy/"],
    ["Refunds", "/refund/"],
    ["Brand", "/brand/"],
    ["Legal register", "/docs/legal-sources.md"]
  ];

  /* github.com/<owner>/<repo> is here in a file anyone can fetch. It is a
     deliberate call, not an oversight: it names a repository, which is not a
     secret, a weakness, or a credential — a private repo simply 404s for
     anyone without access. If you would rather it were not published, say so
     and it moves into launch_blockers' table alongside the rest. */
  var REPO = "crashbook2014/interactive-business-plan";

  function supaLinks(ref) {
    var base = "https://supabase.com/dashboard/project/" + ref;
    return [
      ["Table editor", base + "/editor"],
      ["SQL editor", base + "/sql/new"],
      ["Auth users", base + "/auth/users"],
      ["Sign-in providers", base + "/auth/providers"],
      ["URL configuration", base + "/auth/url-configuration"],
      ["Edge functions", base + "/functions"],
      ["Function secrets", base + "/settings/functions"],
      ["Logs", base + "/logs/explorer"],
      ["API keys", base + "/settings/api"]
    ];
  }

  function chips(items) {
    return '<div class="chips">' + items.map(function (i) {
      var ext = /^https?:/.test(i[1]);
      return '<a href="' + esc(i[1]) + '"' +
        (ext ? ' target="_blank" rel="noopener noreferrer" data-ext="1"' : "") +
        ">" + esc(i[0]) + "</a>";
    }).join("") + "</div>";
  }

  function group(title, items) {
    return '<div class="lg"><h3>' + esc(title) + "</h3>" + chips(items) + "</div>";
  }

  function renderLinks() {
    var ref = projectRef();
    var h = group("This product", LINKS_PRODUCT);

    h += group("Supabase", ref ? supaLinks(ref) : [["Supabase dashboard", "https://supabase.com/dashboard"]]);

    h += group("Code and deploys", [
      ["Repository", "https://github.com/" + REPO],
      ["Actions", "https://github.com/" + REPO + "/actions"],
      ["Pages settings", "https://github.com/" + REPO + "/settings/pages"],
      ["Commits on main", "https://github.com/" + REPO + "/commits/main"]
    ]);

    h += group("Identity and payments", [
      ["Google Cloud credentials", "https://console.cloud.google.com/apis/credentials"],
      ["Google OAuth consent", "https://console.cloud.google.com/auth/branding"],
      ["Apple Developer", "https://developer.apple.com/account"],
      ["Moyasar", "https://dashboard.moyasar.com"],
      ["Tap Payments", "https://business.tap.company"]
    ]);

    h += group("Search and reach", [
      ["Google Search Console", "https://search.google.com/search-console"],
      ["Bing Webmaster Tools", "https://www.bing.com/webmasters"],
      ["PageSpeed Insights", "https://pagespeed.web.dev/analysis?url=https%3A%2F%2Falwodouh.com"],
      ["Rich results test", "https://search.google.com/test/rich-results?url=https%3A%2F%2Falwodouh.com"],
      ["sitemap.xml", "/sitemap.xml"],
      ["robots.txt", "/robots.txt"]
    ]);

    h += group("The law this product cites", [
      ["Labour Law (HRSD)", "https://hrsd.gov.sa"],
      ["GOSI", "https://www.gosi.gov.sa"],
      ["Qiwa", "https://qiwa.sa"],
      ["Board of Grievances", "https://www.bog.gov.sa"],
      ["Najiz", "https://najiz.sa"]
    ]);

    el("links").innerHTML = h;
  }

  /* ================================================ 5. what changed */
  function renderAudit() {
    var host = el("audit");
    if (!A || !A.configured() || !A.user() || !role) {
      host.innerHTML = empty("The change log appears here once you are signed in as an operator.");
      return;
    }
    A.api("/rest/v1/flag_audit?select=key,from_enabled,to_enabled,changed_at&order=changed_at.desc&limit=10")
      .then(function (rows) {
        host.innerHTML = rows && rows.length
          ? rows.map(function (r) {
              return row(r.key + " → " + (r.to_enabled ? "on" : "off"),
                new Date(r.changed_at).toLocaleString(),
                r.to_enabled ? "ON" : "OFF", r.to_enabled ? "on" : "off");
            }).join("")
          : empty("Nothing has been switched yet.");
      })
      .catch(function () { host.innerHTML = empty("Could not read the change log."); });
  }

  /* ====================================================== 6. blockers */

  /* THE LABELS AND NOTES ARE NOT IN THIS FILE, AND THAT IS THE POINT.
     They used to be a hardcoded array here. This file is served from a public
     URL, so every row in it — including "Every register row needs a licensed
     Saudi lawyer before real users" — was one `curl` away from anyone. On a
     product that gives Saudi employment-law guidance, that is a published
     admission that the legal content is unreviewed.

     Nothing in that array granted a capability, so row level security had
     nothing to say about it. It was a disclosure, not a hole, and the fix for
     a disclosure is to stop publishing it. Refusing to DRAW the panel would
     have been theatre while the strings were still fetchable — so they moved
     to public.launch_blockers, behind is_admin('viewer').

     What stays here is the key set, because a key is not a disclosure. */
  var DERIVED = {
    /* Three rows the browser knows better than the database does: they are
       facts about the deployed configuration, not decisions someone records.
       The stored `done` is overridden rather than kept in step by hand. */
    supabase_project: function () { return !!(A && A.configured()); },
    anthropic_key:    function () { return /^https:\/\//.test((window.WODOUH_CONFIG || {}).ANALYZE_URL || ""); },
    apple_signin:     function () { return (window.WODOUH_CONFIG || {}).APPLE_SIGNIN === true; }
  };

  function renderBlockers() {
    var host = el("blockers");
    if (!A || !A.configured() || !A.user() || !role) {
      host.innerHTML = empty("Sign in as an operator to see what is blocking launch.");
      return;
    }
    A.api("/rest/v1/launch_blockers?select=key,label,note,done,sort&order=sort")
      .then(function (rows) {
        if (!rows || !rows.length) {
          host.innerHTML = empty("No blockers recorded. If that looks wrong, the migrations may not have run.");
          return;
        }
        host.innerHTML = rows.map(function (b) {
          var done = DERIVED[b.key] ? DERIVED[b.key]() : b.done === true;
          return row(b.label, b.note, done ? "DONE" : "WAITING", done ? "on" : "warn");
        }).join("");
      })
      .catch(function () {
        host.innerHTML = empty("Could not read the launch checklist.");
      });
  }

  /* ========================================================== startup */
  function refreshRole() {
    if (!A || !A.configured() || !A.user()) { role = null; return Promise.resolve(); }
    return A.api("/rest/v1/admins?select=role&limit=1")
      .then(function (rows) { role = rows && rows[0] ? rows[0].role : null; })
      .catch(function () { role = null; });
  }

  /* WHAT THE PROJECT ACTUALLY ANSWERED, in one line.
     Three rounds were lost to not knowing which of these was true: the
     project saying a provider is off, the probe never resolving, or a cached
     build of this file running instead of the deployed one. None of the three
     was visible from the outside, and none is distinguishable from the
     others by looking at the page. So the page says.

     BUILD is the date this file last changed, plus a letter that increments
     within the day. The letter is not decoration: the previous bump went from
     "2026-08-22c" to "2026-08-22", which READS AS GOING BACKWARDS, and a
     reader comparing a deployed stamp against a newer one could not tell
     which was which. A version that cannot be ordered cannot answer "is this
     the build I just pushed", which is the only question it is for.

     "Bumped by hand" was the
     original plan and it lasted five commits before I forgot — which made the
     stamp report a build four commits old and unable to do the one job it
     exists for. admin.test.js now compares it against the last commit that
     touched admin/, so forgetting fails the suite instead of quietly
     producing a misleading diagnostic. If the line reports an old date, the
     answer is a hard reload, not another theory. */
  var BUILD = "2026-08-27a";

  function renderConn() {
    var host = el("conn");
    if (!host) return;
    if (!A || !A.configured()) { host.textContent = "build " + BUILD + " · no project configured"; return; }
    host.textContent = "build " + BUILD + " · checking the project\u2026";
    A.providers().then(function (ext) {
      if (!ext) {
        host.textContent = "build " + BUILD + " · /auth/v1/settings did not answer " +
          "(blocked, slow, or unreachable) — sign-in buttons are left showing on purpose";
        return;
      }
      var on = Object.keys(ext).filter(function (k) { return ext[k] === true; });
      host.textContent = "build " + BUILD + " · project reachable · providers enabled: " +
        (on.length ? on.join(", ") : "none");
    }).catch(function () {
      host.textContent = "build " + BUILD + " · the provider check threw";
    });
  }

  function renderAll() {
    var u = A && A.user();
    el("who").textContent = !A || !A.configured()
      ? "Not connected to a project — status below is read from the deployed site."
      : u ? (u.email || "Signed in") + (role ? " · " + role : " · not an operator")
          : "Signed out.";
    renderConn();
    renderFlags(); renderNumbers(); renderData(); renderAudit(); renderBlockers();
    renderLinks();
  }

  readDeployed().then(renderStatus);

  /* Render FIRST, then let the session resolve. The previous order was
     init().then(refreshRole).then(renderAll), so a project that could not be
     reached — offline, paused on the free tier, or a network that blocks it —
     rejected the chain and the page rendered nothing at all. Blank, no error,
     nothing to act on. Found by pointing it at a real project from a machine
     that cannot reach Supabase, which is exactly the state a paused free
     project produces. */
  renderAll();
  if (A && A.configured()) {
    A.init()
      .then(refreshRole)
      .then(function () {
        renderAll();
        if (A.user() && role) loadFlags();
      })
      .catch(function () {
        /* The status panel above needs no credentials and is already on
           screen. Say the project is unreachable rather than implying it is
           not configured — those are different problems with different fixes. */
        var who = el("who");
        if (who) who.textContent =
          "Configured, but the project could not be reached. If it is on the free tier it may be paused — open the Supabase dashboard to resume it. Status below is read from the deployed site and is unaffected.";
      });
    A.onChange(function () { refreshRole().then(renderAll); });
  }
})();
