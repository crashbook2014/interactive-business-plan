/* Wodouh — Moyasar amounts, signatures, and the paid/not-paid decision.
 *
 * WHY THIS IS A SEPARATE FILE
 *
 * The Edge Functions and the Node tests have to run the SAME code. A test
 * that re-implements "mark paid only when the fetched amount matches" proves
 * the copy, not the function that will actually run.
 *
 * WHAT THIS FILE REFUSES TO DO
 *
 * It does not read a price from the client, and it does not know Moyasar's
 * own fees. Live percentage fees are a sales quote. Nothing here invents one.
 *
 * Amounts are halalas: 1 SAR = 100. That is Moyasar's smallest currency unit
 * for SAR. The riyal figures are the August 2026 catalogue in app/index.html
 * (PLANS_REVIEW, PLANS, PLANS_CASE, BUNDLE). Lawyer tiers and contract
 * drafting are absent on purpose: the app will not sell them
 * (sellable() / soon), and a server that will is a second catalogue.
 *
 * plan_biz is one month, paid once. Moyasar's invoice is not a subscription.
 * Renewing it is a later product decision, not something this charge implies.
 */

export const PLANS = {
  plan_review:   { sar: 199, ar: "وضوح — مراجعة العقد كاملة", en: "Wodouh — full contract review" },
  plan_reviews5: { sar: 699, ar: "وضوح — خمس مراجعات", en: "Wodouh — five reviews" },
  plan_letter:   { sar: 149, ar: "وضوح — خطاب التفاوض", en: "Wodouh — negotiation letter" },
  plan_case:     { sar: 349, ar: "وضوح — ملف القضية", en: "Wodouh — case file" },
  plan_bundle:   { sar: 549, ar: "وضوح — المراجعة والملف والخطاب", en: "Wodouh — review, case file and letter" },
  plan_biz:      { sar: 799, monthly: true, ar: "وضوح — أعمال، شهر واحد", en: "Wodouh — Business, one month" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v) {
  return typeof v === "string" && UUID.test(v);
}

export function planById(id) {
  if (typeof id !== "string" || !Object.prototype.hasOwnProperty.call(PLANS, id)) return null;
  const p = PLANS[id];
  return {
    id,
    sar: p.sar,
    halalas: p.sar * 100,
    ar: p.ar,
    en: p.en,
    monthly: !!p.monthly,
  };
}

/* "" when unset, "test" by default, "live" only when asked, "invalid"
   for anything else so a typo cannot fall through into a charge. */
export function paymentMode(raw) {
  const m = String(raw ?? "test").trim().toLowerCase();
  if (m === "" || m === "test") return "test";
  if (m === "live") return "live";
  return "invalid";
}

/* sk_test_ / pk_test_ are sandbox. sk_live_ / pk_live_ move real money.
   Anything else is not a mode we will guess. */
export function keyMode(secret) {
  if (typeof secret !== "string" || !secret) return "";
  if (secret.startsWith("sk_test_") || secret.startsWith("pk_test_")) return "test";
  if (secret.startsWith("sk_live_") || secret.startsWith("pk_live_")) return "live";
  return "";
}

/* The secret key and PAYMENT_MODE have to name the same world. A live key
   left in a function whose mode was never switched must not charge. */
export function modeAgrees(mode, secret, publishable) {
  if (mode !== "test" && mode !== "live") return false;
  if (keyMode(secret) !== mode) return false;
  if (publishable) return keyMode(publishable) === mode;
  return true;
}

/* Length-independent enough that a mismatch does not return early.
   Moyasar's check is equality of secret_token, not an HMAC. */
export function tokensMatch(given, expected) {
  if (typeof given !== "string" || typeof expected !== "string") return false;
  if (!expected) return false;
  const len = Math.max(given.length, expected.length);
  let diff = given.length === expected.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const ca = i < given.length ? given.charCodeAt(i) : 0;
    const cb = i < expected.length ? expected.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/* The browser is about to navigate here. Only a Moyasar host is allowed,
   so a surprising url field cannot become an open redirect. */
export function safeCheckoutUrl(url) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  if (u.username || u.password) return null;
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (host !== "moyasar.com" && !host.endsWith(".moyasar.com")) return null;
  return u.toString();
}

/* Drop the webhook secret before the payload is written anywhere. */
export function publicEvent(body) {
  if (!body || typeof body !== "object") return {};
  const clone = JSON.parse(JSON.stringify(body));
  delete clone.secret_token;
  return clone;
}

/* Whether a verified, re-fetched payment may change an order.
 *
 * The webhook body is not the authority for amount or status. `payment` is
 * the object GET /v1/payments/:id returned with the secret key. `eventLive`
 * is the webhook's own `live` boolean. A test deployment must not mark a
 * live payment paid, and the reverse.
 *
 * Returns:
 *   { action: "set", status }     write this status (idempotent)
 *   { action: "ignore", reason }  200, do not change the order
 *   { action: "retry", reason }   500, so Moyasar delivers again
 */
export function decidePayment(order, payment, eventType, mode, eventLive) {
  if (!order || typeof order !== "object") return { action: "ignore", reason: "unknown_order" };
  if (order.currency !== "SAR") return { action: "ignore", reason: "currency" };
  if (mode !== "test" && mode !== "live") return { action: "ignore", reason: "mode" };
  if (order.mode !== mode) return { action: "ignore", reason: "mode_mismatch" };
  if (typeof eventLive !== "boolean" || eventLive !== (mode === "live")) {
    return { action: "ignore", reason: "mode_mismatch" };
  }
  if (!payment || typeof payment !== "object") return { action: "retry", reason: "no_payment" };

  const amount = Number(payment.amount);
  if (!Number.isInteger(amount) || amount !== order.amount) {
    return { action: "ignore", reason: "amount_mismatch" };
  }
  if (payment.currency !== "SAR") return { action: "ignore", reason: "currency" };

  const meta = payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {};
  if (meta.order_id && meta.order_id !== order.id) return { action: "ignore", reason: "order_mismatch" };
  if (meta.user_id && meta.user_id !== order.user_id) return { action: "ignore", reason: "user_mismatch" };
  if (meta.plan_id && meta.plan_id !== order.plan_id) return { action: "ignore", reason: "plan_mismatch" };

  const type = String(eventType || "");
  const status = String(payment.status || "");
  const success = type === "payment_paid" || type === "payment_captured";
  /* Moyasar's own docs spell one of these "payment_faild". Accept both. */
  const fail = type === "payment_failed" || type === "payment_faild" || type === "payment_voided";
  const refund = type === "payment_refunded";

  if (order.status === "refunded") return { action: "ignore", reason: "already_refunded" };

  if (success) {
    if (status === "paid" || status === "captured") return { action: "set", status: "paid" };
    if (status === "initiated" || status === "authorized") return { action: "retry", reason: "not_settled" };
    return { action: "ignore", reason: "status_mismatch" };
  }
  if (fail) {
    if (order.status === "paid") return { action: "ignore", reason: "already_paid" };
    if (status === "failed") return { action: "set", status: "failed" };
    if (status === "voided") return { action: "set", status: "canceled" };
    return { action: "ignore", reason: "status_mismatch" };
  }
  if (refund) {
    if (status === "refunded") return { action: "set", status: "refunded" };
    if (order.status !== "paid") return { action: "ignore", reason: "not_paid" };
    return { action: "retry", reason: "not_settled" };
  }
  return { action: "ignore", reason: "event_type" };
}
