/* Wodouh — authentication and per-user sync.
 *
 * Two rules govern this module.
 *
 * 1. The app must work exactly as it does today when signed out. Nothing here
 *    gates a screen, blocks a flow, or changes navigation. If Supabase is not
 *    configured, or the network is down, or the user never signs in, every
 *    existing code path continues to run against localStorage. Sync is
 *    strictly additive.
 *
 * 2. Contract text never leaves the device. We sync the *outcome* of an
 *    analysis (score, which rules fired, doc kind) and artefacts the user
 *    authored (letters, case files, reminders, preferences). We never send
 *    pasted text, PDF bytes, or extracted clause quotes. This keeps the
 *    product's central promise literally true.
 *
 * The Supabase JS client is loaded lazily, only once a user actually tries to
 * sign in, so the signed-out app keeps making zero external requests.
 */
(function (global) {
  "use strict";

  var SUPABASE_JS =
    "https://esm.sh/@supabase/supabase-js@2";

  var cfg = global.WODOUH_CONFIG || null;
  var client = null;
  var session = null;
  var listeners = [];

  function configured() {
    return !!(cfg && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
              cfg.SUPABASE_URL.indexOf("YOUR-PROJECT-REF") === -1);
  }

  /* Resolves to the Supabase client, importing the SDK on first use. Rejects
     if unconfigured so callers can degrade to local-only silently. */
  function getClient() {
    if (client) return Promise.resolve(client);
    if (!configured()) return Promise.reject(new Error("wodouh: not configured"));
    return import(/* webpackIgnore: true */ SUPABASE_JS).then(function (mod) {
      client = mod.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,      /* "remember me" across reloads */
          autoRefreshToken: true,    /* keeps long sessions alive     */
          detectSessionInUrl: true,  /* completes the OAuth redirect  */
          flowType: "pkce"           /* no token in the URL fragment  */
        }
      });
      client.auth.onAuthStateChange(function (_evt, s) {
        session = s;
        listeners.forEach(function (fn) { try { fn(user()); } catch (e) {} });
      });
      return client.auth.getSession().then(function (r) {
        session = r.data.session;
        return client;
      });
    });
  }

  function user() {
    return session && session.user
      ? { id: session.user.id, email: session.user.email || null }
      : null;
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  /* ------------------------------------------------------------- sign in */

  function withProvider(provider) {
    return getClient().then(function (c) {
      return c.auth.signInWithOAuth({
        provider: provider,                       /* "apple" | "google" */
        options: {
          redirectTo: cfg.REDIRECT_URL || global.location.href,
          /* Ask for nothing beyond identity. We store only a user id. */
          scopes: provider === "google" ? "email" : undefined
        }
      });
    });
  }

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validEmail(email) { return typeof email === "string" && EMAIL_RE.test(email.trim()); }

  /* Supabase enforces its own minimum, but failing fast here gives the user a
     useful message instead of a round trip. */
  function validPassword(pw) { return typeof pw === "string" && pw.length >= 8; }

  function signUp(email, password) {
    if (!validEmail(email)) return Promise.reject(new Error("bad_email"));
    if (!validPassword(password)) return Promise.reject(new Error("weak_password"));
    return getClient().then(function (c) {
      return c.auth.signUp({
        email: email.trim(),
        password: password,
        options: { emailRedirectTo: cfg.REDIRECT_URL || global.location.href }
      });
    });
  }

  function signIn(email, password) {
    if (!validEmail(email)) return Promise.reject(new Error("bad_email"));
    return getClient().then(function (c) {
      return c.auth.signInWithPassword({ email: email.trim(), password: password });
    });
  }

  function resetPassword(email) {
    if (!validEmail(email)) return Promise.reject(new Error("bad_email"));
    return getClient().then(function (c) {
      return c.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: cfg.REDIRECT_URL || global.location.href
      });
    });
  }

  function signOut() {
    if (!client) { session = null; return Promise.resolve(); }
    return client.auth.signOut().then(function () { session = null; });
  }

  /* ---------------------------------------------------------------- sync */

  function requireUser() {
    var u = user();
    return u ? Promise.resolve(u) : Promise.reject(new Error("signed_out"));
  }

  /* Note what is absent: no contract text, no quotes, no file. */
  function saveAnalysis(a) {
    return requireUser().then(function (u) {
      return client.from("analyses").insert({
        user_id: u.id,
        doc_kind: a.doc,
        score: Math.max(0, Math.min(100, Number(a.score) || 0)),
        signed_mode: !!a.signed,
        rule_ids: Array.isArray(a.ruleIds) ? a.ruleIds.slice(0, 40) : [],
        verdict_key: a.verdictKey || null
      }).select().single();
    });
  }

  function listAnalyses(limit) {
    return requireUser().then(function (u) {
      return client.from("analyses")
        .select("id, doc_kind, score, signed_mode, rule_ids, verdict_key, created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(Math.min(Number(limit) || 20, 100));
    });
  }

  function saveLetter(l) {
    return requireUser().then(function (u) {
      return client.from("letters").insert({
        user_id: u.id,
        analysis_id: l.analysisId || null,
        title: String(l.title || "").slice(0, 200),
        body: String(l.body || "").slice(0, 20000),
        lang: l.lang === "en" ? "en" : "ar"
      }).select().single();
    });
  }

  function listLetters() {
    return requireUser().then(function (u) {
      return client.from("letters")
        .select("id, title, body, lang, created_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false });
    });
  }

  function saveCaseFile(cf) {
    return requireUser().then(function (u) {
      return client.from("case_files").insert({
        user_id: u.id,
        reason: cf.reason || null,
        last_wage: cf.lastWage != null ? Number(cf.lastWage) : null,
        start_date: cf.startDate || null,
        end_date: cf.endDate || null,
        unused_leave: cf.unusedLeave != null ? Number(cf.unusedLeave) : null,
        claim_total: cf.claimTotal != null ? Number(cf.claimTotal) : null,
        docs_ready: Array.isArray(cf.docsReady) ? cf.docsReady : []
      }).select().single();
    });
  }

  function saveReminders(rows) {
    return requireUser().then(function (u) {
      var payload = (rows || []).slice(0, 200).map(function (r) {
        return {
          user_id: u.id,
          analysis_id: r.analysisId || null,
          doc_kind: r.doc,
          event_key: r.key,
          due_at: new Date(r.when).toISOString(),
          kind: ["info", "action", "deadline"].indexOf(r.kind) >= 0 ? r.kind : "info",
          rrule: r.rrule || null
        };
      });
      return payload.length ? client.from("reminders").insert(payload) : { data: [], error: null };
    });
  }

  function listReminders() {
    return requireUser().then(function (u) {
      return client.from("reminders")
        .select("id, doc_kind, event_key, due_at, kind, rrule, done")
        .eq("user_id", u.id)
        .order("due_at", { ascending: true });
    });
  }

  function getPreferences() {
    return requireUser().then(function (u) {
      return client.from("profiles").select("lang, theme").eq("id", u.id).single();
    });
  }

  function savePreferences(p) {
    return requireUser().then(function (u) {
      return client.from("profiles").update({
        lang: p.lang === "en" ? "en" : "ar",
        theme: ["system", "light", "dark"].indexOf(p.theme) >= 0 ? p.theme : "system"
      }).eq("id", u.id);
    });
  }

  global.WodouhAuth = {
    configured: configured,
    user: user,
    onChange: onChange,
    signInWithApple: function () { return withProvider("apple"); },
    signInWithGoogle: function () { return withProvider("google"); },
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    resetPassword: resetPassword,
    saveAnalysis: saveAnalysis,
    listAnalyses: listAnalyses,
    saveLetter: saveLetter,
    listLetters: listLetters,
    saveCaseFile: saveCaseFile,
    saveReminders: saveReminders,
    listReminders: listReminders,
    getPreferences: getPreferences,
    savePreferences: savePreferences
  };
})(window);
