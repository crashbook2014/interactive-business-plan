/* Wodouh — commerce platform adapters.
 *
 * Everything platform-specific lives behind this one interface. Adding a
 * third platform means adding one object to PROVIDERS and one row to
 * integration_providers — no change to the OAuth function, the webhook
 * function, or the schema.
 *
 * Endpoint paths and webhook signature schemes are read from environment
 * variables where they vary, so a platform changing a host does not require
 * a redeploy of application logic. Defaults reflect each platform's public
 * documentation at time of writing and MUST be confirmed against their
 * current developer docs before going live — see docs/integrations.md.
 */

export interface Provider {
  id: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Space-delimited scopes requested at authorize time. */
  scopes: string;
  /** Pull the merchant/store identity out of a token response or profile call. */
  identify(token: TokenResponse): Promise<{ externalId: string; storeName: string }>;
  /** Verify an inbound webhook. Returns false on any doubt. */
  verify(req: Request, rawBody: string): Promise<boolean>;
  /** Map a provider payload onto our own topic vocabulary. */
  topicOf(req: Request, body: unknown): string;
  /** Provider's own delivery id, for replay protection. */
  eventIdOf(req: Request, body: unknown): string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  [k: string]: unknown;
}

const env = (k: string, fallback = ""): string => Deno.env.get(k) ?? fallback;

/* Constant-time compare so a signature check cannot be timing-attacked. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------ Salla */

const salla: Provider = {
  id: "salla",
  authorizeUrl: env("SALLA_AUTHORIZE_URL", "https://accounts.salla.sa/oauth2/auth"),
  tokenUrl: env("SALLA_TOKEN_URL", "https://accounts.salla.sa/oauth2/token"),
  scopes: env("SALLA_SCOPES", "offline_access"),

  async identify(token) {
    const r = await fetch(env("SALLA_PROFILE_URL", "https://accounts.salla.sa/oauth2/user/info"), {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!r.ok) throw new Error(`salla profile ${r.status}`);
    const j = await r.json();
    const d = j?.data ?? j;
    return {
      externalId: String(d?.merchant?.id ?? d?.id ?? ""),
      storeName: String(d?.merchant?.name ?? d?.name ?? ""),
    };
  },

  /* Salla signs the raw body with the webhook secret. */
  async verify(req, rawBody) {
    const secret = env("SALLA_WEBHOOK_SECRET");
    const given = req.headers.get("x-salla-signature") ?? "";
    if (!secret || !given) return false;
    return timingSafeEqual(given.toLowerCase(), await hmacHex(secret, rawBody));
  },

  topicOf(req, body) {
    const b = body as Record<string, unknown>;
    return String(b?.event ?? req.headers.get("x-salla-event") ?? "unknown");
  },

  eventIdOf(req, body) {
    const b = body as Record<string, unknown>;
    return (req.headers.get("x-salla-webhook-id") ?? (b?.id ? String(b.id) : null));
  },
};

/* -------------------------------------------------------------------- Zid */

const zid: Provider = {
  id: "zid",
  authorizeUrl: env("ZID_AUTHORIZE_URL", "https://oauth.zid.sa/oauth/authorize"),
  tokenUrl: env("ZID_TOKEN_URL", "https://oauth.zid.sa/oauth/token"),
  scopes: env("ZID_SCOPES", ""),

  async identify(token) {
    const r = await fetch(env("ZID_PROFILE_URL", "https://api.zid.sa/v1/managers/account/profile"), {
      headers: {
        Authorization: `Bearer ${env("ZID_API_TOKEN")}`,
        "X-Manager-Token": token.access_token,
        Accept: "application/json",
      },
    });
    if (!r.ok) throw new Error(`zid profile ${r.status}`);
    const j = await r.json();
    const store = j?.user?.store ?? j?.store ?? {};
    return {
      externalId: String(store?.id ?? j?.user?.id ?? ""),
      storeName: String(store?.title ?? store?.name ?? ""),
    };
  },

  async verify(req, rawBody) {
    const secret = env("ZID_WEBHOOK_SECRET");
    const given = req.headers.get("x-zid-signature") ?? "";
    if (!secret || !given) return false;
    return timingSafeEqual(given.toLowerCase(), await hmacHex(secret, rawBody));
  },

  topicOf(req, body) {
    const b = body as Record<string, unknown>;
    return String(b?.event ?? req.headers.get("x-zid-event") ?? "unknown");
  },

  eventIdOf(req, body) {
    const b = body as Record<string, unknown>;
    return (req.headers.get("x-zid-delivery-id") ?? (b?.id ? String(b.id) : null));
  },
};

export const PROVIDERS: Record<string, Provider> = { salla, zid };

export function providerFor(id: string): Provider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`unknown provider: ${id}`);
  return p;
}

/* Client credentials stay in function secrets, never in the repo. */
export function credentials(id: string) {
  const up = id.toUpperCase();
  const clientId = env(`${up}_CLIENT_ID`);
  const clientSecret = env(`${up}_CLIENT_SECRET`);
  if (!clientId || !clientSecret) throw new Error(`${id}: missing client credentials`);
  return { clientId, clientSecret };
}
