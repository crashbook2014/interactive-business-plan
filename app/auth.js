/* Wodouh — accounts, without a dependency.
 *
 * THREE RULES GOVERN THIS FILE.
 *
 * 1. THE SIGNED-OUT APP IS THE WHOLE APP. Nothing here gates a screen, blocks
 *    a flow, or changes navigation. Unconfigured, offline, or never signed in,
 *    every existing path keeps running against localStorage. An account buys
 *    sync and nothing else.
 *
 * 2. CONTRACT TEXT NEVER LEAVES THE DEVICE. We sync the OUTCOME of an analysis
 *    — a score, which rules fired, a verdict key — and the artefacts the reader
 *    authored. Never pasted text, PDF bytes, or clause quotes. 0001_init.sql is
 *    written around the same constraint.
 *
 * 3. GOOGLE AND APPLE ONLY. There is no password path in this file. Not
 *    hidden, not disabled — absent. A password that does not exist cannot be
 *    reused, phished, or leaked, and it is one fewer screen to get right in two
 *    languages.
 *
 * WHY THERE IS NO SUPABASE SDK HERE
 *
 * The previous version imported @supabase/supabase-js from esm.sh. That import
 * COULD NOT RUN in this build: the app's CSP is `script-src 'self'`, and esm.sh
 * was deliberately removed from it once nothing was loading from there. So the
 * old file was already dead code that nobody had run.
 *
 * Rather than reopen that door, this talks to Supabase the way Supabase
 * actually works underneath: OAuth is a redirect, sessions are tokens, and
 * PostgREST is HTTP with two headers. About two hundred lines of fetch buys us
 * a policy that stays `script-src 'self'`, no build step, no supply chain, and
 * one host in connect-src instead of two. That is the same trade the rest of
 * this app has made everywhere else.
 *
 * WHAT IS PUBLIC HERE: the project URL and the anon key. Both are public by
 * design — the anon key is a JWT that says "anonymous visitor" and grants
 * nothing on its own, because every table is behind row level security. The
 * service_role key must never appear in this file, in app/, or in the repo.
 */
(function (global) {
  "use strict";

  var STORE = "wodouh.session.v1";

  function cfg() { return global.WODOUH_CONFIG || {}; }

  /* Unconfigured is a valid state, not an error. The placeholder from
     config.example.js counts as unconfigured, so a half-finished copy of that
     file cannot make the app think it has a backend. */
  function configured() {
    var c = cfg();
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY &&
              /^https:\/\//.test(c.SUPABASE_URL) &&
              c.SUPABASE_URL.indexOf("YOUR-PROJECT-REF") === -1);
  }

  /* Apple is a separate switch from Supabase itself. Apple Sign-In needs an
     Apple Developer account, so a project can be fully configured and still
     have no Apple. The button appears only where it would actually work —
     a dead sign-in button is worse than one fewer option. */
  function appleAvailable() { return configured() && cfg().APPLE_SIGNIN === true; }

  var session = null;      /* { access_token, refresh_token, expires_at, user } */
  var listeners = [];

  function emit() {
    var u = user();
    listeners.forEach(function (fn) { try { fn(u); } catch (e) {} });
  }
  function onChange(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  function user() {
    return session && session.user ? session.user : null;
  }

  /* ------------------------------------------------------------ storage
     Only the refresh token and the user's identity are persisted. The access
     token is short-lived and re-minted on load, so a stale copy in storage is
     never presented as valid. */
  function save() {
    try {
      if (!session) { localStorage.removeItem(STORE); return; }
      localStorage.setItem(STORE, JSON.stringify({
        refresh_token: session.refresh_token,
        user: session.user
      }));
    } catch (e) {}
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return null;
      var d = JSON.parse(raw);
      return d && typeof d.refresh_token === "string" ? d : null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------- fetch */
  function api(path, opts) {
    opts = opts || {};
    var h = opts.headers || {};
    h["apikey"] = cfg().SUPABASE_ANON_KEY;
    h["content-type"] = "application/json";
    if (session && session.access_token && !opts.anon) {
      h["authorization"] = "Bearer " + session.access_token;
    }
    return fetch(cfg().SUPABASE_URL + path, {
      method: opts.method || "GET",
      headers: h,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && (j.message || j.error_description)) || ("http_" + r.status));
        return j;
      }, function () {
        if (!r.ok) throw new Error("http_" + r.status);
        return null;
      });
    });
  }

  /* -------------------------------------------------------------- OAuth
     A redirect, not a popup. Popups are blocked on iOS Safari often enough
     that a popup-only flow is a flow that silently fails for a large share of
     this app's readers. */
  function signInWith(provider) {
    if (!configured()) return Promise.reject(new Error("not_configured"));
    if (provider === "apple" && !appleAvailable()) return Promise.reject(new Error("apple_unavailable"));
    var back = cfg().REDIRECT_URL || (location.origin + location.pathname);
    location.assign(cfg().SUPABASE_URL + "/auth/v1/authorize" +
      "?provider=" + encodeURIComponent(provider) +
      "&redirect_to=" + encodeURIComponent(back));
    return new Promise(function () {});   /* navigating away */
  }

  /* Supabase returns the session in the URL fragment. Read it, then REMOVE it
     from the address bar — a URL carrying an access token is a URL that gets
     pasted into a chat, screenshotted, or left in history. */
  function captureRedirect() {
    if (!location.hash || location.hash.indexOf("access_token=") === -1) return false;
    var q = new URLSearchParams(location.hash.slice(1));
    var at = q.get("access_token"), rt = q.get("refresh_token");
    if (!at || !rt) return false;
    session = {
      access_token: at,
      refresh_token: rt,
      expires_at: Date.now() + (parseInt(q.get("expires_in"), 10) || 3600) * 1000,
      user: null
    };
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (e) { location.hash = ""; }
    return true;
  }

  function refresh(token) {
    return api("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", anon: true, body: { refresh_token: token }
    }).then(function (d) {
      session = {
        access_token: d.access_token,
        refresh_token: d.refresh_token,
        expires_at: Date.now() + (d.expires_in || 3600) * 1000,
        user: d.user || null
      };
      return session;
    });
  }

  function fetchUser() {
    return api("/auth/v1/user").then(function (u) {
      if (session) session.user = u;
      return u;
    });
  }

  /* Called once at startup. Resolves to the user or null; NEVER rejects, so a
     backend that is down or misconfigured degrades to the signed-out app
     rather than to an error the reader has to understand. */
  function init() {
    if (!configured()) return Promise.resolve(null);
    var fresh = captureRedirect();
    var stored = fresh ? null : load();
    var step = fresh ? fetchUser()
             : stored ? refresh(stored.refresh_token).then(fetchUser)
             : Promise.resolve(null);
    return step.then(function (u) {
      save(); emit();
      return u;
    }).catch(function () {
      session = null; save(); emit();
      return null;
    });
  }

  function signOut() {
    var had = !!session;
    var p = had ? api("/auth/v1/logout", { method: "POST" }).catch(function () {}) : Promise.resolve();
    return p.then(function () {
      session = null; save(); emit();
    });
  }

  /* ----------------------------------------------------------- profile */
  function getProfile() {
    var u = user();
    if (!u) return Promise.resolve(null);
    return api("/rest/v1/profiles?select=*&id=eq." + encodeURIComponent(u.id))
      .then(function (rows) { return (rows && rows[0]) || null; });
  }

  function patchProfile(patch) {
    var u = user();
    if (!u) return Promise.reject(new Error("signed_out"));
    return api("/rest/v1/profiles?id=eq." + encodeURIComponent(u.id), {
      method: "PATCH",
      headers: { "prefer": "return=representation" },
      body: patch
    }).then(function (rows) { return (rows && rows[0]) || null; });
  }

  /* THE PHONE NUMBER AND THE PERMISSION TO USE IT ARE TWO DECISIONS.
   *
   * `consent` is passed separately from `number`, and `consentText` is the
   * exact sentence the reader saw. The database refuses a true consent without
   * both, so this signature is not a convention — it is the only shape the
   * schema accepts.
   *
   * A number with consent false is a perfectly normal outcome: it means "you
   * may keep this to reach me about my own case, but do not market to me."
   */
  function savePhone(number, consent, consentText) {
    var n = typeof number === "string" ? number.trim() : "";
    if (n && !/^\+?[0-9 ()-]{7,20}$/.test(n)) return Promise.reject(new Error("bad_phone"));
    var patch = {
      phone_number: n || null,
      phone_marketing_consent: consent === true,
      phone_prompted_at: new Date().toISOString()
    };
    if (consent === true) {
      if (!consentText) return Promise.reject(new Error("consent_text_required"));
      patch.phone_consent_at = new Date().toISOString();
      patch.phone_consent_text = String(consentText).slice(0, 500);
    } else {
      /* Withdrawal must clear the record too, or a later audit shows consent
         text against someone who has since said no. */
      patch.phone_consent_at = null;
      patch.phone_consent_text = null;
    }
    return patchProfile(patch);
  }

  /* The reader was asked and said not now. Recorded so they are not asked
     again on every visit — being asked repeatedly is how an optional question
     starts to feel mandatory. */
  function skipPhone() {
    return patchProfile({ phone_prompted_at: new Date().toISOString() });
  }

  /* --------------------------------------------------------- erasure */
  function deleteAccount() {
    if (!user()) return Promise.reject(new Error("signed_out"));
    return api("/rest/v1/rpc/delete_my_account", { method: "POST", body: {} })
      .then(function () { session = null; save(); emit(); });
  }

  global.WodouhAuth = {
    configured: configured,
    appleAvailable: appleAvailable,
    init: init,
    user: user,
    onChange: onChange,
    signInWithGoogle: function () { return signInWith("google"); },
    signInWithApple: function () { return signInWith("apple"); },
    signOut: signOut,
    getProfile: getProfile,
    savePhone: savePhone,
    skipPhone: skipPhone,
    deleteAccount: deleteAccount
  };
})(typeof window !== "undefined" ? window : this);
