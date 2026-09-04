/* Wodouh — scanned-contract upload.
 *
 * THE ONLY FLOW IN THIS APP WHERE THE DOCUMENT ITSELF LEAVES THE PHONE.
 *
 * Text-based PDFs are extracted on the reader's own device and only the TEXT
 * is sent for analysis. This endpoint exists for the one case no on-device
 * code can handle: a scan or a photograph, which has no text layer at all.
 * It is a separate, explicit opt-in in the app, and it is deliberately narrow.
 *
 * THE OWNERSHIP RULE, WHICH IS THE WHOLE POINT OF THIS FILE
 *
 * Anthropic's Files API returns a file_id that is WORKSPACE-scoped: every
 * file_id our key ever created is readable by our key. So a file_id is not a
 * capability. A client that sends `file_id: "file_abc"` is making a claim
 * about ownership, not proving one, and a caller replaying or guessing another
 * user's id would read a stranger's employment contract.
 *
 * Therefore, without exception:
 *   - the client NEVER sends a file_id, and is never shown one
 *   - the server records the owner at the moment of upload, in public.uploads
 *   - every later use looks the id up in that table, SCOPED TO THE CALLER
 *   - this endpoint requires a signed-in user, because an anonymous upload has
 *     no owner to record and therefore no way to be checked later
 *
 * DELETION IS AN OBLIGATION, NOT AN INTENTION. The file is deleted upstream as
 * soon as the analysis returns. That call can fail and this function can time
 * out, so `deleted_at` is only set once the delete is CONFIRMED, and anything
 * past expires_at with deleted_at still null is swept later. "We delete it
 * immediately" is only true if something notices when it did not happen.
 */
const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
/* Bypasses RLS, which is exactly why it lives only in function secrets and
   must never appear in the repo, in app/, or in web/. */
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";

/* A scan of a contract. Generous enough for a phone photo of every page,
   small enough that it cannot be used as free storage. */
const MAX_BYTES = 8 * 1024 * 1024;
const MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

/* THIS ENDPOINT HAD NO LIMIT AT ALL. Every other function that costs real
   money per call (analyze) or fans out to a third party (oauth-callback,
   webhook) is rate-limited; this one proxies a real upload to Anthropic's
   paid Files API on every call and was not. Auth-gated is not the same as
   rate-limited: a single compromised or shared account could still upload
   without bound. Per-user, since this route always has a signed-in caller —
   there is no IP fallback to reach for. Same durable, cross-instance counter
   the other three functions use (bump_rate_limit, service_role-only). */
const RATE_MAX = 6;
const RATE_WINDOW = "00:01:00";

function cors() {
  return {
    "access-control-allow-origin": ALLOWED_ORIGIN || "null",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors() },
  });
}

/* Who is calling. The access token is verified by Supabase, not by us — we
   never parse a JWT ourselves, because a JWT we parse is a JWT we might
   forget to verify. */
async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/i.test(auth)) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization: auth, apikey: SERVICE_KEY },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  return u && typeof u.id === "string" ? u.id : null;
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

/* Delete upstream, then record it. Exported shape kept simple on purpose: the
   caller wants to know whether the file is gone, not why it is not. */
export async function deleteUpstream(fileId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.anthropic.com/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
    });
    /* 404 means it is already gone, which is the outcome we wanted. */
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!API_KEY || !SERVICE_KEY || !SUPABASE_URL) return json({ error: "not_configured" }, 503);

  /* No anonymous uploads. An upload with no owner cannot be ownership-checked
     later, and an unowned file_id in a workspace-scoped namespace is precisely
     the hazard this whole design exists to avoid. */
  const uid = await callerId(req);
  if (!uid) return json({ error: "sign_in_required" }, 401);

  const limited = await rest("rpc/bump_rate_limit", {
    method: "POST",
    body: JSON.stringify({ p_bucket: `upload:${uid}`, p_limit: RATE_MAX, p_window: RATE_WINDOW }),
  }).then((r) => r.ok ? r.json().catch(() => null) : null, () => null);
  /* Same fail-open-on-infra-trouble, fail-closed-on-explicit-refusal shape as
     analyze/index.ts and oauth-callback/index.ts: a limiter outage must not
     take uploads down with it. */
  if (limited === false) return json({ error: "rate_limited" }, 429);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "no_file" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "too_large", max: MAX_BYTES }, 413);
  if (!MIME.has(file.type)) return json({ error: "bad_type", allowed: [...MIME] }, 415);

  /* Upload to Anthropic. */
  const up = new FormData();
  up.append("file", file, "document");
  let fileId: string;
  try {
    const res = await fetch("https://api.anthropic.com/v1/files", {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "files-api-2025-04-14",
      },
      body: up,
    });
    if (!res.ok) return json({ error: "upstream_error", status: res.status }, 502);
    const d = await res.json().catch(() => null);
    if (!d || typeof d.id !== "string") return json({ error: "bad_upstream_shape" }, 502);
    fileId = d.id;
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }

  /* Record the owner BEFORE returning anything. If this insert fails we have a
     file upstream that nothing owns, so it is deleted immediately rather than
     left orphaned — an unowned file is the one state this design must not
     produce. */
  const ins = await rest("uploads", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      user_id: uid, file_id: fileId, purpose: "contract_scan",
      byte_size: file.size, mime_type: file.type,
    }),
  });
  if (!ins.ok) {
    await deleteUpstream(fileId);
    return json({ error: "record_failed" }, 500);
  }
  const row = (await ins.json().catch(() => null))?.[0];
  if (!row?.id) {
    await deleteUpstream(fileId);
    return json({ error: "record_failed" }, 500);
  }

  /* THE HANDLE THE CLIENT GETS IS OUR ROW ID, NOT THE FILE ID. Our row id is
     meaningless to Anthropic and is checked against the caller on every use,
     so replaying someone else's is a lookup that returns nothing rather than a
     document. */
  return json({ upload: row.id, expires_at: row.expires_at });
});
