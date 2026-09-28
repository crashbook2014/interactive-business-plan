/* Wodouh — start a Tap hosted charge for a catalogue plan.
 *
 * POST { plan_id, lang?: "ar" | "en" }
 *   -> { order_id, checkout_url, amount, currency, plan_id, mode }
 *
 * `amount` in the response is halalas, echoed so the browser can refuse to
 * redirect if it does not match the price on screen. It is not an input.
 * A body field named amount is ignored. The price comes from
 * _shared/tap.mjs, which is the same table the tests check against
 * app/index.html. Tap itself is charged in riyals (199), not halalas.
 *
 * The secret key stays here. The browser receives transaction.url on an
 * https tap.company host and nothing else. Card numbers never touch this app.
 * source.id is src_all, Tap's hosted page for every method on the account.
 *
 * Missing keys return 503 not_configured. A live key while PAYMENT_MODE is
 * test (the default), or the reverse, returns 503 misconfigured and does
 * not call Tap. FREE_NOW is a client switch; this function does not grant
 * entitlement. The webhook does the paid mark, after it has fetched the
 * charge back from Tap and checked the amount.
 *
 * Secrets: TAP_SECRET_KEY, PAYMENT_MODE (test|live, default test),
 * ALLOWED_ORIGIN, and the Supabase URL and service role (injected).
 * TAP_PUBLIC_KEY is optional for this hosted flow. If it is set, it must
 * be the same mode as the secret key. It is not sent to the browser.
 *
 * Tap requires a customer email on the charge. A signed-in account with no
 * email gets 400 needs_email. We do not invent one.
 */

import {
  isChargeId,
  isUuid,
  modeAgrees,
  paymentMode,
  planById,
  safeCheckoutUrl,
  toMinor,
} from "../_shared/tap.mjs";

const SECRET = Deno.env.get("TAP_SECRET_KEY") ?? "";
const PUBLISHABLE = Deno.env.get("TAP_PUBLIC_KEY") ?? "";
const MODE = paymentMode(Deno.env.get("PAYMENT_MODE"));
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const TAP_CHARGES = "https://api.tap.company/v2/charges";
const RATE_MAX = 8;
const RATE_WINDOW = "00:10:00";

interface Caller {
  id: string;
  email: string;
  name: string;
}

function cors(extra: Record<string, string> = {}) {
  return {
    "access-control-allow-origin": ALLOWED_ORIGIN || "null",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
    ...extra,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors({ "content-type": "application/json" }),
  });
}

function appOrigin(): string | null {
  const raw = ALLOWED_ORIGIN.trim().replace(/\/$/, "");
  if (/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(raw)) return raw;
  if (/^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/i.test(raw)) return raw;
  return null;
}

function configured(): { ok: true; origin: string } | { ok: false; error: string } {
  if (!SECRET || !SERVICE_KEY || !SUPABASE_URL) return { ok: false, error: "not_configured" };
  if (!SUPABASE_URL.startsWith("https://")) return { ok: false, error: "not_configured" };
  const origin = appOrigin();
  if (!origin) return { ok: false, error: "not_configured" };
  if (!modeAgrees(MODE, SECRET, PUBLISHABLE)) return { ok: false, error: "misconfigured" };
  if (MODE === "live" && !origin.startsWith("https://")) return { ok: false, error: "misconfigured" };
  return { ok: true, origin };
}

function firstName(user: Record<string, unknown>, email: string): string {
  const meta = user.user_metadata && typeof user.user_metadata === "object"
    ? user.user_metadata as Record<string, unknown>
    : {};
  const raw = [meta.first_name, meta.full_name, meta.name].find(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
  const cleaned = String(raw || "").trim().slice(0, 40);
  if (cleaned && !cleaned.includes("@")) return cleaned;
  const local = email.split("@")[0].replace(/[^A-Za-z\u0600-\u06FF ]/g, "").trim().slice(0, 40);
  return local || "Wodouh";
}

async function caller(req: Request): Promise<Caller | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(auth)) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization: auth, apikey: SERVICE_KEY },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  if (!u || typeof u.id !== "string" || !isUuid(u.id)) return null;
  const email = typeof u.email === "string" ? u.email.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { id: u.id, email: "", name: "" };
  return { id: u.id, email, name: firstName(u, email) };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const cfg = configured();
  if (!cfg.ok) return json({ error: cfg.error }, 503);

  const who = await caller(req);
  if (!who) return json({ error: "sign_in_required" }, 401);
  if (!who.email) return json({ error: "needs_email" }, 400);

  const limited = await rest("rpc/bump_rate_limit", {
    method: "POST",
    body: JSON.stringify({ p_bucket: `pay:${who.id}`, p_limit: RATE_MAX, p_window: RATE_WINDOW }),
  }).then((r) => r.ok ? r.json().catch(() => null) : "unavailable", () => "unavailable");
  /* Fail closed. This call creates a charge. A limiter we cannot reach
     must not become an unlimited charge factory. */
  if (limited === "unavailable") return json({ error: "unavailable" }, 503);
  if (limited === false) return json({ error: "rate_limited" }, 429);

  const raw = await req.text();
  if (raw.length > 4096) return json({ error: "payload_too_large" }, 413);
  let body: Record<string, unknown> = {};
  if (raw) {
    try { body = JSON.parse(raw); } catch { return json({ error: "bad_json" }, 400); }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "bad_json" }, 400);
  }

  /* plan_id only. amount, currency, metadata and any other field are not read. */
  const plan = planById(body.plan_id);
  if (!plan) return json({ error: "unknown_plan" }, 400);
  const lang = body.lang === "en" ? "en" : "ar";

  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const reuse = await rest(
    "orders?user_id=eq." + who.id +
      "&plan_id=eq." + plan.id +
      "&status=eq.pending&mode=eq." + MODE +
      "&amount=eq." + plan.halalas +
      "&checkout_url=not.is.null" +
      "&created_at=gte." + encodeURIComponent(since) +
      "&select=id,checkout_url,amount,currency,plan_id,mode&order=created_at.desc&limit=1",
  );
  if (reuse.ok) {
    const rows = await reuse.json().catch(() => []);
    const prev = Array.isArray(rows) ? rows[0] : null;
    const url = prev ? safeCheckoutUrl(prev.checkout_url) : null;
    if (prev && url && prev.amount === plan.halalas) {
      return json({
        order_id: prev.id,
        checkout_url: url,
        amount: plan.halalas,
        currency: "SAR",
        plan_id: plan.id,
        mode: MODE,
      });
    }
  }

  const inserted = await rest("orders", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      user_id: who.id,
      plan_id: plan.id,
      amount: plan.halalas,
      currency: "SAR",
      status: "pending",
      mode: MODE,
    }),
  });
  if (!inserted.ok) return json({ error: "store_failed" }, 500);
  const created = (await inserted.json().catch(() => null))?.[0];
  if (!created?.id || !isUuid(created.id)) return json({ error: "store_failed" }, 500);

  const redirect = `${cfg.origin}/app/index.html?tap_order=${created.id}`;
  const hook = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/tap-webhook`;

  let charge: Record<string, unknown> | null = null;
  try {
    const res = await fetch(TAP_CHARGES, {
      method: "POST",
      headers: {
        authorization: `Bearer ${SECRET}`,
        "content-type": "application/json",
        lang_code: lang,
      },
      body: JSON.stringify({
        amount: plan.sar,
        currency: "SAR",
        customer_initiated: true,
        threeDSecure: true,
        save_card: false,
        description: lang === "en" ? plan.en : plan.ar,
        metadata: {
          order_id: created.id,
          user_id: who.id,
          plan_id: plan.id,
        },
        reference: {
          transaction: created.id,
          order: created.id,
          idempotent: created.id,
        },
        receipt: { email: false, sms: false },
        customer: { first_name: who.name, email: who.email },
        source: { id: "src_all" },
        redirect: { url: redirect },
        post: { url: hook },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) charge = await res.json().catch(() => null);
  } catch {
    charge = null;
  }

  const tx = charge && charge.transaction && typeof charge.transaction === "object"
    ? charge.transaction as Record<string, unknown>
    : null;
  const checkout = tx ? safeCheckoutUrl(tx.url) : null;
  const chargeId = charge && typeof charge.id === "string" ? charge.id : "";
  const minor = charge ? toMinor(charge.amount, charge.currency) : null;
  const liveOk = charge?.live_mode === (MODE === "live");
  if (!checkout || !isChargeId(chargeId) || minor !== plan.halalas || charge?.currency !== "SAR" || !liveOk) {
    await rest("orders?id=eq." + created.id + "&status=eq.pending", {
      method: "PATCH",
      body: JSON.stringify({ status: "canceled" }),
    });
    return json({ error: "upstream_error" }, 502);
  }

  const saved = await rest("orders?id=eq." + created.id, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({ tap_id: chargeId, checkout_url: checkout }),
  });
  if (!saved.ok) return json({ error: "store_failed" }, 500);

  return json({
    order_id: created.id,
    checkout_url: checkout,
    amount: plan.halalas,
    currency: "SAR",
    plan_id: plan.id,
    mode: MODE,
  });
});
