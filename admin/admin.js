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
         counts as verified only if a human ticked it. */
      live.verified = (reg.match(/✅\s*verified\s*\|/g) || []).length;
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

  function renderStatus() {
    if (!live.appReached) {
      el("status").innerHTML = empty(
        "Could not read the deployed app from this domain. If you are running " +
        "this from a local server, that is expected — open it on the real site " +
        "to see live state.");
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

    h += row("Payments", live.payments ? "Card payment is live — real charges"
                                       : "Dark. The pay button simulates and grants access",
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

  function renderFlags() {
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

    if (!role) {
      host.innerHTML = empty(
        "You are signed in, but this account is not an operator. Add its user " +
        "id to <code>public.admins</code> in the Supabase dashboard. That is " +
        "deliberately the only way in — no page can grant itself access.");
      return;
    }

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

  function loadFlags() {
    return A.api("/rest/v1/app_flags?select=key,enabled,updated_at,note")
      .then(function (rows) { flagRows = rows; renderFlags(); return rows; })
      .catch(function () {
        el("flags").innerHTML = empty(
          "Could not read the switches. If the migrations have not been run yet, " +
          "<code>public.app_flags</code> does not exist — that is the likely cause.");
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
  function renderBlockers() {
    var c = window.WODOUH_CONFIG || {};
    var items = [
      ["Supabase project", A && A.configured(), "Unblocks accounts, sync, the switches on this page, and the AI"],
      ["Anthropic API key", /^https:\/\//.test(c.ANALYZE_URL || ""), "Set as a function secret, never in the browser. Unblocks Ask and the AI read"],
      ["Payment processor", false, "Unblocks charging. Until then the pay button simulates"],
      ["Apple Developer account", c.APPLE_SIGNIN === true, "Unblocks Apple sign-in. Google works without it"],
      ["GitHub Actions billing", false, "Unblocks CI and the live watchdog. Pages deploys either way"],
      ["Lawyer review", false, "Every register row needs a licensed Saudi lawyer before real users"]
    ];
    el("blockers").innerHTML = items.map(function (i) {
      return row(i[0], i[2], i[1] ? "DONE" : "WAITING", i[1] ? "on" : "warn");
    }).join("");
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

     BUILD is a plain string bumped by hand when this file changes in a way
     worth confirming reached the browser. If the line reports an old one, the
     answer is a hard reload, not another theory. */
  var BUILD = "2026-08-22c";

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
