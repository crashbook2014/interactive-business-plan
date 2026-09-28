/* Wodouh — Moyasar webhooks.
 *
 * POST from Moyasar, no Supabase JWT. verify_jwt is off in config.toml for
 * that reason: left on, the gateway answers 401 and the check below never
 * runs. The check is Moyasar's own: the JSON body carries secret_token, the
 * shared secret configured when the webhook was created. It is compared in
 * constant time. A delivery that fails the compare is not stored.
 *
 * A matching token is not enough to mark an order paid. The payment is
 * fetched again with the secret key, and the order moves only when that
 * fetched amount, currency, and status agree with the row we created.
 * The amount in the webhook body is never the one we trust.
 *
 * Idempotent: a repeat delivery of an event id returns 200, and a second
 * paid mark finds the row already paid. Missing secrets return 503
 * not_configured so a half-deployed function does not accept events.
 *
 * Moyasar asks for a fast 2xx. We still write the order before answering.
 * A 2xx sent first, followed by a crash, is a paid customer with a pending
 * row and no retry. The work here is one fetch and one update.
 *
 * This function does not touch the Zid/Salla webhook.
 */

import {
  decidePayment,
  isUuid,
  modeAgrees,
  paymentMode,
  publicEvent,
  tokensMatch,
} from "../_shared/moyasar.mjs";

const SECRET = Deno.env.get("MOYASAR_SECRET_KEY") ?? "";
const PUBLISHABLE = Deno.env.get("MOYASAR_PUBLISHABLE_KEY") ?? "";
const HOOK = Deno.env.get("MOYASAR_WEBHOOK_SECRET") ?? "";
const MODE = paymentMode(Deno.env.get("PAYMENT_MODE"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_BODY = 1_000_000;

interface OrderRow {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  currency: string;
  status: string;
  mode: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function basic(secret: string): string {
  return "Basic " + btoa(secret + ":");
}

function rest(path: string, opts: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      authorization: `Bearer ${SERVICE_KEY}`,
      "content-type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
}

async function bucketFor(req: Request): Promise<string> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const hex = Array.from(new Uint8Array(digest)).slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return `moyasar:${hex}`;
}

async function fetchPayment(id: string): Promise<Record<string, unknown> | "retry" | "bad_key"> {
  try {
    const res = await fetch(`https://api.moyasar.com/v1/payments/${id}`, {
      headers: { authorization: basic(SECRET) },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 401 || res.status === 403) return "bad_key";
    if (!res.ok) return "retry";
    const payment = await res.json().catch(() => null);
    if (!payment || typeof payment !== "object" || Array.isArray(payment)) return "retry";
    return payment as Record<string, unknown>;
  } catch {
    return "retry";
  }
}

async function findOrder(payment: Record<string, unknown>): Promise<OrderRow | null> {
  const meta = payment.metadata && typeof payment.metadata === "object"
    ? payment.metadata as Record<string, unknown>
    : {};
  const invoiceId = typeof payment.invoice_id === "string" ? payment.invoice_id : "";
  const orderId = typeof meta.order_id === "string" ? meta.order_id : "";
  const cols = "id,user_id,plan_id,amount,currency,status,mode";

  async function one(query: string): Promise<OrderRow | null> {
    const res = await rest(query);
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !isUuid(row.id)) return null;
    return row as OrderRow;
  }

  if (isUuid(invoiceId)) {
    const byInvoice = await one(`orders?moyasar_id=eq.${invoiceId}&select=${cols}&limit=1`);
    if (byInvoice) return byInvoice;
  }
  if (isUuid(orderId)) {
    return await one(`orders?id=eq.${orderId}&select=${cols}&limit=1`);
  }
  return null;
}

async function setStatus(order: OrderRow, status: string, paymentId: string): Promise<boolean> {
  if (order.status === status) return true;
  const patch: Record<string, string> = { status };
  if (status === "paid") {
    patch.paid_at = new Date().toISOString();
    patch.moyasar_payment_id = paymentId;
  }
  const from = status === "refunded" ? "paid" : "pending";
  const res = await rest(`orders?id=eq.${order.id}&status=eq.${from}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  if (Array.isArray(rows) && rows.length > 0) return true;
  const now = await rest(`orders?id=eq.${order.id}&select=status&limit=1`);
  if (!now.ok) return false;
  const current = await now.json().catch(() => []);
  return Array.isArray(current) && current[0]?.status === status;
}

/* 23505 on event_id is a duplicate delivery, which is success. */
async function remember(eventId: string, eventType: string, orderId: string | null, payload: unknown): Promise<boolean> {
  const res = await rest("moyasar_events", {
    method: "POST",
    headers: { prefer: "return=minimal" },
    body: JSON.stringify({
      event_id: eventId,
      event_type: eventType,
      order_id: orderId,
      payload,
    }),
  });
  if (res.ok || res.status === 201 || res.status === 204) return true;
  if (res.status === 409) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!HOOK || !SECRET || !SERVICE_KEY || !SUPABASE_URL) {
    return json({ error: "not_configured" }, 503);
  }
  if (!modeAgrees(MODE, SECRET, PUBLISHABLE)) {
    return json({ error: "misconfigured" }, 503);
  }

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) return json({ error: "payload_too_large" }, 413);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "payload_too_large" }, 413);

  const limited = await rest("rpc/bump_rate_limit", {
    method: "POST",
    body: JSON.stringify({
      p_bucket: await bucketFor(req), p_limit: 600, p_window: "00:01:00",
    }),
  }).then((r) => r.ok ? r.json().catch(() => null) : null, () => null);
  if (limited === false) return json({ error: "rate_limited" }, 429);

  let event: Record<string, unknown>;
  try { event = JSON.parse(raw); } catch { return json({ error: "bad_json" }, 400); }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return json({ error: "bad_json" }, 400);
  }

  const token = typeof event.secret_token === "string" ? event.secret_token : "";
  if (!tokensMatch(token, HOOK)) return json({ error: "bad_signature" }, 401);

  const eventId = typeof event.id === "string" ? event.id : "";
  const eventType = typeof event.type === "string" ? event.type : "";
  if (!isUuid(eventId) || !/^[a-z_]{1,80}$/.test(eventType)) {
    return json({ error: "bad_json" }, 400);
  }

  const seen = await rest(`moyasar_events?event_id=eq.${eventId}&select=event_id&limit=1`);
  if (seen.ok) {
    const rows = await seen.json().catch(() => []);
    if (Array.isArray(rows) && rows.length > 0) return json({ ok: true, duplicate: true });
  }

  const data = event.data && typeof event.data === "object" && !Array.isArray(event.data)
    ? event.data as Record<string, unknown>
    : null;
  const paymentId = data && typeof data.id === "string" ? data.id : "";

  if (!eventType.startsWith("payment_") || !isUuid(paymentId)) {
    await remember(eventId, eventType, null, publicEvent(event));
    return json({ ok: true, ignored: "not_a_payment" });
  }

  const fetched = await fetchPayment(paymentId);
  if (fetched === "bad_key") return json({ error: "misconfigured" }, 503);
  if (fetched === "retry") return json({ error: "upstream_error" }, 502);
  if (fetched.id !== paymentId) return json({ error: "upstream_error" }, 502);

  const order = await findOrder(fetched);
  if (!order) {
    await remember(eventId, eventType, null, publicEvent(event));
    return json({ ok: true, ignored: "unknown_order" });
  }

  const decision = decidePayment(order, fetched, eventType, MODE, event.live);
  if (decision.action === "retry") return json({ error: decision.reason ?? "retry" }, 502);
  if (decision.action === "set") {
    if (!decision.status) return json({ error: "store_failed" }, 500);
    const wrote = await setStatus(order, decision.status, paymentId);
    if (!wrote) return json({ error: "store_failed" }, 500);
  }

  const audited = await remember(eventId, eventType, order.id, publicEvent(event));
  if (!audited) return json({ error: "store_failed" }, 500);
  if (decision.action === "ignore") return json({ ok: true, ignored: decision.reason });
  return json({ ok: true });
});
