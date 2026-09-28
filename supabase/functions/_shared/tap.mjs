/* Wodouh — Tap amounts, the hashstring, and the paid/not-paid decision.
 *
 * WHY THIS IS A SEPARATE FILE
 *
 * The Edge Functions and the Node tests have to run the SAME code. A test
 * that re-implements "mark paid only when the fetched amount matches" proves
 * the copy, not the function that will actually run.
 *
 * WHAT THIS FILE REFUSES TO DO
 *
 * It does not read a price from the client, and it does not know Tap's own
 * fees. Live percentage fees are a quote. Nothing here invents one.
 *
 * OUR stored amount is halalas (1 SAR = 100), so a float never sits in the
 * orders table. Tap's charge API does not use that unit. Tap wants the
 * currency's major unit in ISO decimal places: 199 SAR is the number 199,
 * and a webhook hash rounds SAR to "199.00". See
 * https://developers.tap.company/reference/create-a-charge and
 * https://developers.tap.company/docs/webhook.
 *
 * The riyal figures are the August 2026 catalogue in app/index.html
 * (PLANS_REVIEW, PLANS, PLANS_CASE, BUNDLE). The 549 plan_bundle was retired
 * in September 2026 and replaced by plan_review_letter at 299; it is no longer
 * chargeable, though old paid orders for it stay valid. Lawyer tiers and contract
 * drafting are absent on purpose: the app will not sell them
 * (sellable() / soon), and a server that will is a second catalogue.
 *
 * plan_biz is one month, paid once. This charge is not a subscription.
 * Renewing it is a later product decision, not something this charge implies.
 */

export const PLANS = {
  plan_review:   { sar: 199, ar: "وضوح — مراجعة العقد كاملة", en: "Wodouh — full contract review" },
  plan_reviews5: { sar: 699, ar: "وضوح — خمس مراجعات", en: "Wodouh — five reviews" },
  plan_letter:   { sar: 149, ar: "وضوح — خطاب التفاوض", en: "Wodouh — negotiation letter" },
  plan_case:     { sar: 349, ar: "وضوح — ملف القضية", en: "Wodouh — case file" },
  plan_review_letter: { sar: 299, ar: "وضوح — المراجعة والخطاب", en: "Wodouh — review and letter" },
  plan_biz:      { sar: 799, monthly: true, ar: "وضوح — أعمال، 30 يوم", en: "Wodouh — Business, 30 days" },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHARGE_ID = /^chg_[A-Za-z0-9]{8,80}$/;
const THREE_DECIMALS = new Set(["BHD", "KWD", "OMR", "JOD"]);

export function isUuid(v) {
  return typeof v === "string" && UUID.test(v);
}

/* Tap charge ids look like chg_TS05A4120230736x9K22710693. They are not uuids. */
export function isChargeId(v) {
  return typeof v === "string" && CHARGE_ID.test(v);
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

/* Length-independent enough that a mismatch does not return early. */
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

/* SAR is 2 decimal places. KWD, BHD, OMR and JOD are 3. Tap's hashstring
   is wrong if this rounding is skipped — "1" does not match "1.00". */
export function formatAmount(amount, currency) {
  const decimals = THREE_DECIMALS.has(String(currency || "").toUpperCase()) ? 3 : 2;
  let n = NaN;
  if (typeof amount === "number" && Number.isFinite(amount)) n = amount;
  else if (typeof amount === "string" && /^-?\d+(\.\d+)?$/.test(amount.trim())) n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return "";
  return n.toFixed(decimals);
}

/* Halalas for SAR: "199.00" → 19900. Null when the amount will not format. */
export function toMinor(amount, currency) {
  const formatted = formatAmount(amount, currency);
  if (!formatted) return null;
  const [whole, frac] = formatted.split(".");
  return Number(whole) * (10 ** frac.length) + Number(frac);
}

function text(v) {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
  return "";
}

/* The string Tap HMACs. Field order is theirs, including an empty
   gateway reference: dropping the label rejects every real delivery.
   https://developers.tap.company/docs/webhook */
export function chargeHashMaterial(charge) {
  if (!charge || typeof charge !== "object") return "";
  const ref = charge.reference && typeof charge.reference === "object" ? charge.reference : {};
  const tx = charge.transaction && typeof charge.transaction === "object" ? charge.transaction : {};
  const created = charge.object === "refund" ? text(charge.created || tx.created) : text(tx.created);
  return "x_id" + text(charge.id) +
    "x_amount" + formatAmount(charge.amount, charge.currency) +
    "x_currency" + text(charge.currency) +
    "x_gateway_reference" + text(ref.gateway) +
    "x_payment_reference" + text(ref.payment) +
    "x_status" + text(charge.status) +
    "x_created" + created;
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(message)));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* The browser is about to navigate here. Only an https Tap host is allowed,
   so a surprising url field cannot become an open redirect. Sandbox charges
   come back on acceptance.sandbox.tap.company, which is https. */
export function safeCheckoutUrl(url) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  if (u.username || u.password) return null;
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (host !== "tap.company" && !host.endsWith(".tap.company")) return null;
  return u.toString();
}

/* The row we keep. Card, customer and source never land in the database. */
export function publicEvent(body) {
  if (!body || typeof body !== "object") return {};
  const ref = body.reference && typeof body.reference === "object" ? body.reference : null;
  return {
    id: body.id,
    object: body.object,
    status: body.status,
    amount: body.amount,
    currency: body.currency,
    live_mode: body.live_mode,
    metadata: body.metadata,
    reference: ref ? {
      order: ref.order,
      transaction: ref.transaction,
      payment: ref.payment,
      gateway: ref.gateway,
    } : undefined,
  };
}

/* Whether a re-fetched charge may change an order.
 *
 * The webhook body is not the authority for amount or status. `charge` is
 * the object GET /v2/charges/:id returned with the secret key. live_mode on
 * that object has to agree with PAYMENT_MODE. A test deployment must not
 * mark a live charge paid, and the reverse.
 *
 * Returns:
 *   { action: "set", status }     write this status (idempotent)
 *   { action: "ignore", reason }  200, do not change the order
 */
export function decideCharge(order, charge, mode) {
  if (!order || typeof order !== "object") return { action: "ignore", reason: "unknown_order" };
  if (order.currency !== "SAR") return { action: "ignore", reason: "currency" };
  if (mode !== "test" && mode !== "live") return { action: "ignore", reason: "mode" };
  if (order.mode !== mode) return { action: "ignore", reason: "mode_mismatch" };
  if (!charge || typeof charge !== "object") return { action: "ignore", reason: "no_charge" };
  if (typeof charge.live_mode !== "boolean" || charge.live_mode !== (mode === "live")) {
    return { action: "ignore", reason: "mode_mismatch" };
  }

  const minor = toMinor(charge.amount, "SAR");
  if (minor === null || minor !== order.amount) return { action: "ignore", reason: "amount_mismatch" };
  if (charge.currency !== "SAR") return { action: "ignore", reason: "currency" };

  const meta = charge.metadata && typeof charge.metadata === "object" ? charge.metadata : {};
  if (meta.order_id && meta.order_id !== order.id) return { action: "ignore", reason: "order_mismatch" };
  if (meta.user_id && meta.user_id !== order.user_id) return { action: "ignore", reason: "user_mismatch" };
  if (meta.plan_id && meta.plan_id !== order.plan_id) return { action: "ignore", reason: "plan_mismatch" };

  if (order.status === "refunded") return { action: "ignore", reason: "already_refunded" };

  const status = String(charge.status || "").toUpperCase();
  if (status === "CAPTURED") return { action: "set", status: "paid" };
  if (status === "REFUNDED") {
    if (order.status !== "paid") return { action: "ignore", reason: "not_paid" };
    return { action: "set", status: "refunded" };
  }
  const canceled = status === "VOID" || status === "CANCELLED" || status === "CANCELED" || status === "ABANDONED";
  const failed = status === "FAILED" || status === "DECLINED" || status === "TIMEDOUT" || status === "RESTRICTED";
  if (canceled || failed) {
    if (order.status === "paid") return { action: "ignore", reason: "already_paid" };
    return { action: "set", status: canceled ? "canceled" : "failed" };
  }
  if (status === "INITIATED" || status === "IN_PROGRESS") return { action: "ignore", reason: "not_settled" };
  return { action: "ignore", reason: "status" };
}
