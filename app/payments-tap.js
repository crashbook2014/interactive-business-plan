/* Wodouh — Tap checkout, in the browser.
 *
 * WHAT THIS FILE IS ALLOWED TO KNOW
 *
 * The create-payment URL, the reader's session, and a plan id. It never
 * sees TAP_SECRET_KEY and it never sends an amount. The server prices
 * the charge. The amount that comes back is halalas, and we refuse to
 * follow the link unless it matches the price already on screen and the
 * host is an https tap.company host.
 *
 * WHEN IT DOES NOTHING
 *
 * CREATE_PAYMENT_URL unset — the shipping default — means configured() is
 * false. The pay button keeps the prototype path (no charge), and the
 * account slot stays hidden. A 503 not_configured from a deployed function
 * whose keys are missing is shown as text and does not unlock anything.
 *
 * Entitlement still lives in this browser, the same way the prototype
 * grant does. The order row is the record that money moved. Unlocking
 * here only happens after that row says paid, and only once per order id.
 */
(function (global) {
  "use strict";

  var APPLIED = "wodouh.tap.applied";
  var PENDING = "wodouh.tap.pending";
  var busy = false;

  function cfg() { return global.WODOUH_CONFIG || {}; }

  /* FREE_NOW, lang and pwPlan are `let` in the app script. They sit in the
     page's lexical global, not on window, so window.FREE_NOW is always
     undefined from this file. Read the names themselves. */
  function productIsFree() {
    return typeof FREE_NOW !== "undefined" && FREE_NOW === true;
  }
  function pageLang() {
    return typeof lang !== "undefined" && lang === "en" ? "en" : "ar";
  }
  function selectedPlanIndex() {
    return typeof pwPlan === "number" ? pwPlan : 0;
  }

  /* Tap's publishable key. Only a pk_test_ / pk_live_ value is accepted.
     The charge itself is still created on the server. This key is not posted. */
  function publicKey() {
    var key = cfg().TAP_PUBLIC_KEY;
    if (typeof key !== "string") return "";
    if (!/^pk_(test|live)_[A-Za-z0-9]+$/.test(key)) return "";
    return key;
  }

  function configured() {
    var c = cfg();
    var base = c.SUPABASE_URL;
    var url = c.CREATE_PAYMENT_URL;
    if (typeof base !== "string" || typeof url !== "string") return false;
    if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(base.replace(/\/$/, ""))) return false;
    return url === base.replace(/\/$/, "") + "/functions/v1/create-payment";
  }

  function say(key) {
    var text = typeof global.t === "function" ? global.t(key) : "";
    ["tapStatus", "tapMsg"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = !text;
      el.textContent = text;
    });
  }

  function safeCheckoutUrl(url) {
    var u;
    try { u = new URL(String(url)); } catch (e) { return null; }
    if (u.username || u.password) return null;
    if (u.protocol !== "https:") return null;
    var host = u.hostname.toLowerCase();
    var suffix = ".tap.company";
    if (host !== "tap.company" && host.slice(-suffix.length) !== suffix) return null;
    return u.toString();
  }

  function appliedIds() {
    try {
      var raw = JSON.parse(localStorage.getItem(APPLIED) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) { return []; }
  }

  function markApplied(orderId) {
    var ids = appliedIds();
    if (ids.indexOf(orderId) !== -1) return;
    ids.push(orderId);
    try { localStorage.setItem(APPLIED, JSON.stringify(ids.slice(-40))); } catch (e) {}
  }

  function signedIn() {
    return !!(global.WodouhAuth && typeof global.WodouhAuth.user === "function" && global.WodouhAuth.user());
  }

  function needSignIn(orderId) {
    say("tap_signin");
    if (orderId) {
      try { sessionStorage.setItem(PENDING, orderId); } catch (e) {}
    }
    if (typeof global.openSignin === "function" && typeof global.authOn === "function" && global.authOn()) {
      global.openSignin("account");
    }
  }

  function start(planId, expectedSar) {
    if (!configured() || busy) return;
    if (!signedIn()) { needSignIn(null); return; }
    if (typeof global.authHeaders !== "function") { say("tap_fail"); return; }
    busy = true;
    say("tap_busy");
    var pay = document.getElementById("payBtn");
    if (pay) pay.disabled = true;

    fetch(cfg().CREATE_PAYMENT_URL, {
      method: "POST",
      headers: global.authHeaders(),
      body: JSON.stringify({
        plan_id: planId,
        lang: pageLang()
      })
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, data: data || {} };
      });
    }).then(function (out) {
      busy = false;
      var data = out.data;
      if (out.status === 503) { say("tap_off"); if (pay) pay.disabled = false; return; }
      if (out.status === 401) { if (pay) pay.disabled = false; needSignIn(null); return; }
      if (out.status === 400 && data.error === "needs_email") {
        say("tap_email"); if (pay) pay.disabled = false; return;
      }
      if (out.status === 429) { say("tap_fail"); if (pay) pay.disabled = false; return; }
      var url = safeCheckoutUrl(data.checkout_url);
      var halalas = typeof expectedSar === "number" ? Math.round(expectedSar * 100) : NaN;
      if (!url || data.currency !== "SAR" || data.amount !== halalas || data.plan_id !== planId) {
        say(data && data.amount && data.amount !== halalas ? "tap_mismatch" : "tap_fail");
        if (pay) pay.disabled = false;
        return;
      }
      location.assign(url);
    }).catch(function () {
      busy = false;
      say("tap_fail");
      if (pay) pay.disabled = false;
    });
  }

  function payFromWall() {
    if (!configured()) return;
    var list = typeof global.activePlans === "function" ? global.activePlans() : [];
    var chosen = list[selectedPlanIndex()];
    if (!chosen || (typeof global.buyable === "function" && !global.buyable(chosen))) {
      say("tap_fail");
      return;
    }
    /* An upgrade on screen is a difference. The server sells the catalogue
       price of the plan, and sending the reader to pay a different number
       than the button shows is not a checkout. */
    if (chosen.up) { say("tap_upgrade"); return; }
    start(chosen.name, chosen.amt);
  }

  function mount() {
    var slot = document.getElementById("tapSlot");
    if (!slot) return;
    if (!configured() || typeof global.t !== "function" || typeof global.wodouhCatalogue !== "function") {
      slot.hidden = true;
      slot.textContent = "";
      return;
    }
    slot.hidden = false;
    slot.textContent = "";

    var h = document.createElement("h3");
    h.textContent = global.t("tap_h");
    var p = document.createElement("p");
    p.textContent = global.t("tap_b");
    slot.appendChild(h);
    slot.appendChild(p);
    if (productIsFree()) {
      var free = document.createElement("p");
      free.textContent = global.t("tap_free");
      slot.appendChild(free);
    }

    var list = document.createElement("div");
    list.className = "tap-plans";
    global.wodouhCatalogue().forEach(function (plan) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ghost";
      var label = global.t(plan.id);
      var price = typeof global.priceLabel === "function"
        ? global.priceLabel(plan.amt, plan.monthly) : String(plan.amt);
      b.textContent = label + " — " + price;
      b.addEventListener("click", function () { start(plan.id, plan.amt); });
      list.appendChild(b);
    });
    slot.appendChild(list);

    var msg = document.createElement("p");
    msg.id = "tapMsg";
    msg.setAttribute("role", "status");
    msg.hidden = true;
    slot.appendChild(msg);

    var refund = document.createElement("a");
    refund.href = "../refund/";
    refund.target = "_blank";
    refund.rel = "noopener noreferrer";
    refund.textContent = global.t("ll_refund");
    slot.appendChild(refund);
  }

  function applyPaid(order) {
    if (!order || order.status !== "paid" || !order.id || !order.plan_id) return false;
    if (appliedIds().indexOf(order.id) !== -1) return true;
    if (typeof global.grantPurchasedPlan !== "function") return false;
    if (!global.grantPurchasedPlan(order.plan_id)) return false;
    markApplied(order.id);
    return true;
  }

  function confirm(orderId, attempt, back) {
    if (!global.WodouhAuth || typeof global.WodouhAuth.api !== "function") {
      say("tap_fail");
      return;
    }
    say("tap_wait");
    if (typeof global.show === "function") global.show("account");
    global.WodouhAuth.api(
      "/rest/v1/orders?id=eq." + orderId + "&select=id,plan_id,status,amount,currency"
    ).then(function (rows) {
      var row = Array.isArray(rows) ? rows[0] : null;
      if (!row) { say("tap_pending"); return; }
      if (row.status === "paid") {
        applyPaid(row);
        try { sessionStorage.removeItem(PENDING); } catch (e) {}
        say("tap_paid");
        return;
      }
      if (row.status === "failed" || row.status === "canceled") {
        say("tap_bad");
        return;
      }
      if (!back && attempt < 6) {
        setTimeout(function () { confirm(orderId, attempt + 1, false); }, 2000);
        return;
      }
      say("tap_pending");
    }).catch(function () { say("tap_pending"); });
  }

  function takePending() {
    var id = null;
    try { id = sessionStorage.getItem(PENDING); } catch (e) { id = null; }
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    if (!signedIn()) return;
    confirm(id, 0, false);
  }

  function resume() {
    var params;
    try { params = new URLSearchParams(global.location.search); } catch (e) { return; }
    var id = params.get("tap_order");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      try {
        var u = new URL(global.location.href);
        u.searchParams.delete("tap_order");
        u.searchParams.delete("tap_id");
        global.history.replaceState(null, "", u.pathname + u.search + u.hash);
      } catch (e) {}
      if (!signedIn()) { needSignIn(id); return; }
      confirm(id, 0, false);
      return;
    }
    takePending();
  }

  if (global.WodouhAuth && typeof global.WodouhAuth.onChange === "function") {
    global.WodouhAuth.onChange(function (user) {
      if (user) takePending();
    });
  }

  global.WodouhTap = {
    configured: configured,
    publicKey: publicKey,
    payFromWall: payFromWall,
    mount: mount,
    resume: resume
  };
})(typeof window !== "undefined" ? window : this);
