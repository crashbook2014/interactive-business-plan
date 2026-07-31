/* Wodouh — inbound webhooks from commerce platforms.
 *
 * POST /webhook/:provider
 *
 * Order of operations matters and is deliberate:
 *   1. read the raw body ONCE (signatures are over raw bytes, not reparsed JSON)
 *   2. rate limit before any crypto, so a flood cannot burn CPU
 *   3. verify the signature before parsing
 *   4. record the event, relying on a unique constraint for replay protection
 *   5. only then process
 *
 * An unverified request is dropped with 401 and never recorded, so the events
 * table cannot be used as free storage by an unauthenticated caller.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { providerFor } from "../_shared/providers.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/* 1 MB is far above any legitimate webhook and well below anything that
   would strain the function. */
const MAX_BODY = 1_000_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

/* Hash the caller address rather than storing it: we need a rate-limit key,
   not a record of who called. */
async function bucketFor(req: Request, providerId: string): Promise<string> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const hex = Array.from(new Uint8Array(digest)).slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0")).join("");
  return `wh:${providerId}:${hex}`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const providerId = new URL(req.url).pathname.split("/").pop() ?? "";
  let provider;
  try { provider = providerFor(providerId); } catch { return json({ error: "unknown_provider" }, 404); }

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) return json({ error: "payload_too_large" }, 413);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "payload_too_large" }, 413);

  const { data: allowed } = await admin.rpc("bump_rate_limit", {
    p_bucket: await bucketFor(req, providerId), p_limit: 600, p_window: "00:01:00",
  });
  if (allowed === false) return json({ error: "rate_limited" }, 429);

  if (!(await provider.verify(req, raw))) return json({ error: "bad_signature" }, 401);

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "bad_json" }, 400); }

  const topic = provider.topicOf(req, body);
  const externalEventId = provider.eventIdOf(req, body);

  const { error } = await admin.from("integration_events").insert({
    provider_id: providerId,
    topic,
    external_event_id: externalEventId,
    payload: body as Record<string, unknown>,
  });

  /* 23505 = unique_violation: this delivery was already recorded. Providers
     retry on anything but a 2xx, so a replay must succeed, not error. */
  if (error && error.code !== "23505") return json({ error: "store_failed" }, 500);

  return json({ ok: true });
});
