/* Wodouh — Tap charge webhooks.
 *
 * POST from Tap, no Supabase JWT. verify_jwt is off in config.toml for that
 * reason: left on, the gateway answers 401 and the check below never runs.
 * Tap's check is the hashstring header: HMAC-SHA256 of a fixed field string,
 * keyed with the secret API key. See https://developers.tap.company/docs/webhook.
 * TAP_WEBHOOK_SECRET, when set, replaces that key. Leave it empty unless Tap
 * gave you a different signing secret — a random value will reject every
 * real delivery. A delivery that fails the compare is not stored.
 *
 * A matching hash is not enough to mark an order paid. The charge is fetched
 * again with the secret key, and the order moves only when that fetched
 * amount, currency, live_mode, and status agree with the row we created.
 * The amount in the webhook body is never the one we trust.
 *
 * Idempotent: a repeat of the same hashstring returns 200, and a second paid
 * mark finds the row already paid. Missing secrets return 503 not_configured
 * so a half-deployed function does not accept events.
 *
 * Tap retries a non-2xx. We still write the order before answering. A 2xx
 * sent first, followed by a crash, is a paid customer with a pending row and
 * no retry. The work here is one fetch and one update.
 *
 * This function does not touch the Zid/Salla webhook.
 */

import {
  chargeHashMaterial,
  decideCharge,
  hmacHex,
  isChargeId,
  isUuid,
  modeAgrees,
  paymentMode,
  publicEvent,
  tokensMatch,
} from "../_shared/tap.mjs";

const SECRET = Deno.env.get("TAP_SECRET_KEY") ?? "";
const PUBLISHABLE = Deno.env.get("TAP_PUBLIC_KEY") ?? "";
const HOOK = Deno.env.get("TAP_WEBHOOK_SECRET") ?? "";
const MODE = paymentMode(Deno.env.get("PAYMENT_MODE"));
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_BODY = 1_000_000;
const SIGNING = HOOK || SECRET;

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
  return `tap:${hex}`;
}

async function fetchCharge(id: string): Promise<Record<string, unknown> | "retry" | "bad_key"> {
  try {
    const res = await fetch(`https://api.tap.company/v2/charges/${id}`, {
      headers: { authorization: `Bearer ${SECRET}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 401 || res.status === 403) return "bad_key";
    if (!res.ok) return "retry";
    const charge = await res.json().catch(() => null);
    if (!charge || typeof charge !== "object" || Array.isArray(charge)) return "retry";
    return charge as Record<string, unknown>;
  } catch {
    return "retry";
  }
}

async function findOrder(charge: Record<string, unknown>): Promise<OrderRow | null> {
  const meta = charge.metadata && typeof charge.metadata === "object"
    ? charge.metadata as Record<string, unknown>
    : {};
  const ref = charge.reference && typeof charge.reference === "object"
    ? charge.reference as Record<string, unknown>
    : {};
  const chargeId = typeof charge.id === "string" ? charge.id : "";
  const orderId = typeof meta.order_id === "string" ? meta.order_id
    : typeof ref.order === "string" ? ref.order : "";
  const cols = "id,user_id,plan_id,amount,currency,status,mode";

  async function one(query: string): Promise<OrderRow | null> {
    const res = await rest(query);
    if (!res.ok) return null;
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !isUuid(row.id)) return null;
    return row as OrderRow;
  }

  if (isChargeId(chargeId)) {
    const byCharge = await one(`orders?tap_id=eq.${chargeId}&select=${cols}&limit=1`);
    if (byCharge) return byCharge;
  }
  if (isUuid(orderId)) return await one(`orders?id=eq.${orderId}&select=${cols}&limit=1`);
  return null;
}

async function setStatus(order: OrderRow, status: string, chargeId: string): Promise<boolean> {
  if (order.status === status) return true;
  const patch: Record<string, string> = { status };
  if (status === "paid") {
    patch.paid_at = new Date().toISOString();
    if (isChargeId(chargeId)) patch.tap_id = chargeId;
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
  const res = await rest("tap_events", {
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

  if (!SIGNING || !SECRET || !SERVICE_KEY || !SUPABASE_URL) {
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

  const posted = (req.headers.get("hashstring") ?? "").trim().toLowerCase();
  const material = chargeHashMaterial(event);
  const expected = material ? (await hmacHex(SIGNING, material)).toLowerCase() : "";
  if (!tokensMatch(posted, expected)) return json({ error: "bad_signature" }, 401);

  const eventId = posted;
  const chargeId = typeof event.id === "string" ? event.id : "";
  const eventType = typeof event.status === "string" ? event.status.toUpperCase().slice(0, 40) : "UNKNOWN";

  const seen = await rest(`tap_events?event_id=eq.${eventId}&select=event_id&limit=1`);
  if (seen.ok) {
    const rows = await seen.json().catch(() => []);
    if (Array.isArray(rows) && rows.length > 0) return json({ ok: true, duplicate: true });
  }

  if (!isChargeId(chargeId)) {
    await remember(eventId, eventType, null, publicEvent(event));
    return json({ ok: true, ignored: "not_a_charge" });
  }

  const fetched = await fetchCharge(chargeId);
  if (fetched === "bad_key") return json({ error: "misconfigured" }, 503);
  if (fetched === "retry") return json({ error: "upstream_error" }, 502);
  if (fetched.id !== chargeId) return json({ error: "upstream_error" }, 502);

  const order = await findOrder(fetched);
  if (!order) {
    await remember(eventId, eventType, null, publicEvent(event));
    return json({ ok: true, ignored: "unknown_order" });
  }

  const decision = decideCharge(order, fetched, MODE);
  if (decision.action === "set") {
    if (!decision.status) return json({ error: "store_failed" }, 500);
    const wrote = await setStatus(order, decision.status, chargeId);
    if (!wrote) return json({ error: "store_failed" }, 500);
  }

  const audited = await remember(eventId, eventType, order.id, publicEvent(event));
  if (!audited) return json({ error: "store_failed" }, 500);
  if (decision.action === "ignore") return json({ ok: true, ignored: decision.reason });
  return json({ ok: true });
});
