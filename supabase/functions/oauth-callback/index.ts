/* Wodouh — OAuth start and callback for commerce platforms.
 *
 * Why this runs server-side at all: the token exchange needs a client secret.
 * Putting that in the frontend would expose it to every visitor, so the whole
 * exchange happens here and only the resulting connection *metadata* is ever
 * visible to the browser.
 *
 * Routes:
 *   GET /oauth-callback/start?provider=salla   (authenticated)  -> 302 to provider
 *   GET /oauth-callback/return?code=..&state=..                 -> 302 back to app
 *
 * CSRF: `state` is a signed, expiring token binding the flow to one user.
 * We verify the signature and the expiry before touching the code.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { providerFor, credentials, timingSafeEqual } from "../_shared/providers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STATE_SECRET = Deno.env.get("OAUTH_STATE_SECRET")!;
const APP_URL = Deno.env.get("APP_URL") ?? "/";
const FN_URL = Deno.env.get("FUNCTION_BASE_URL")!; // e.g. https://ref.supabase.co/functions/v1

/* service role: bypasses RLS. Only ever instantiated here, never client-side. */
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const enc = new TextEncoder();

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(STATE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function makeState(userId: string, provider: string): Promise<string> {
  const body = btoa(JSON.stringify({ u: userId, p: provider, e: Date.now() + 10 * 60_000 }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${body}.${await sign(body)}`;
}

async function readState(state: string) {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  if (!timingSafeEqual(sig, await sign(body))) return null;
  try {
    const j = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof j.e !== "number" || Date.now() > j.e) return null;   // expired
    return { userId: String(j.u), provider: String(j.p) };
  } catch { return null; }
}

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { Location: to } });
}

function fail(msg: string, status = 400) {
  /* Never echo the caller's input back into the response body. */
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.split("/").pop();

  /* ---------------------------------------------------------- start ---- */
  if (route === "start") {
    const jwt = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
    if (!jwt) return fail("unauthorized", 401);

    const { data: { user }, error } = await admin.auth.getUser(jwt);
    if (error || !user) return fail("unauthorized", 401);

    /* Rate limit per user: an OAuth start is cheap for us and expensive for
       the provider, and it is a convenient amplification primitive. */
    const { data: ok } = await admin.rpc("bump_rate_limit", {
      p_bucket: `oauth:${user.id}`, p_limit: 10, p_window: "00:05:00",
    });
    if (ok === false) return fail("rate_limited", 429);

    const providerId = url.searchParams.get("provider") ?? "";
    let p;
    try { p = providerFor(providerId); } catch { return fail("unknown_provider"); }

    const { clientId } = credentials(p.id);
    const state = await makeState(user.id, p.id);
    const auth = new URL(p.authorizeUrl);
    auth.searchParams.set("client_id", clientId);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("redirect_uri", `${FN_URL}/oauth-callback/return`);
    auth.searchParams.set("state", state);
    if (p.scopes) auth.searchParams.set("scope", p.scopes);
    return redirect(auth.toString());
  }

  /* --------------------------------------------------------- return ---- */
  if (route === "return") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return fail("missing_params");

    const parsed = await readState(state);
    if (!parsed) return fail("bad_state", 403);

    let p;
    try { p = providerFor(parsed.provider); } catch { return fail("unknown_provider"); }
    const { clientId, clientSecret } = credentials(p.id);

    const tokenRes = await fetch(p.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${FN_URL}/oauth-callback/return`,
      }),
    });
    if (!tokenRes.ok) return redirect(`${APP_URL}#integration=error`);
    const token = await tokenRes.json();

    let ident;
    try { ident = await p.identify(token); }
    catch { return redirect(`${APP_URL}#integration=error`); }

    const { data: conn, error: connErr } = await admin
      .from("integration_connections")
      .upsert({
        user_id: parsed.userId,
        provider_id: p.id,
        external_id: ident.externalId,
        store_name: ident.storeName,
        scopes: p.scopes ? p.scopes.split(/\s+/) : [],
        status: "active",
        last_error: null,
      }, { onConflict: "user_id,provider_id,external_id" })
      .select("id").single();

    if (connErr || !conn) return redirect(`${APP_URL}#integration=error`);

    /* Tokens go to the table no client role can read. */
    await admin.from("integration_secrets").upsert({
      connection_id: conn.id,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    });

    return redirect(`${APP_URL}#integration=connected`);
  }

  return fail("not_found", 404);
});
