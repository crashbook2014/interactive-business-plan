# PULSE — Deploy guide

## Run locally

```bash
npm install
npm start          # builds the client, serves everything on http://localhost:8787
npm test           # unit tests (RBAC matrix, redaction, scoping, SLA, storage)
```

Local dev ships in **stub mode**: bundled sample data, test-login enabled (pick any
roster member on the sign-in screen). No credentials needed.

## Environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Listen port (default 8787) |
| `NODE_ENV=production` | Turns test-login OFF, secure cookies ON, HTTPS enforcement ON |
| `TEST_LOGIN=0` | Explicitly disable test-login in dev too |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Workspace SSO |
| `ALLOWED_DOMAIN` | Workspace domain allowed to sign in (default `pulse.sa`) |
| `PUBLIC_URL` | Public base URL, used for the OAuth redirect |
| `SESSION_KEY` | 64-hex-char AES-256-GCM key for sessions at rest (else a keyfile is generated in `~/.pulse-ops/`, outside the app tree) |
| `DATA_DIR` | JSON data directory — point at the persistent volume |
| `ANTHROPIC_API_KEY` | Optional: AI-written shift briefing (deterministic fallback otherwise) |
| `SHEETS_OCCUPANCY_ID` | Optional: live RACK occupancy from Google Sheets (read-only) |
| `YARDI_API_KEY` | Optional: live financials (read-only; sample + badged until set) |

## Google Cloud Run (me-central2, Dammam — data residency)

```bash
gcloud builds submit --tag me-central2-docker.pkg.dev/PROJECT/ops/pulse-ops
gcloud run deploy pulse-ops \
  --image me-central2-docker.pkg.dev/PROJECT/ops/pulse-ops \
  --region me-central2 \
  --min-instances 1 --max-instances 1 \
  --port 8787 \
  --set-env-vars NODE_ENV=production,ALLOWED_DOMAIN=pulse.sa,PUBLIC_URL=https://ops.pulse.sa,DATA_DIR=/data \
  --set-secrets SESSION_KEY=pulse-session-key:latest,GOOGLE_CLIENT_ID=pulse-oauth-id:latest,GOOGLE_CLIENT_SECRET=pulse-oauth-secret:latest \
  --add-volume name=data,type=cloud-storage,bucket=pulse-ops-data \
  --add-volume-mount volume=data,mount-path=/data
```

Single instance is required — storage is file-based. Keep `min=max=1`.

On Render: a Web Service from this repo's Dockerfile, one instance, a persistent
disk mounted at `/data`, and the same env vars as secrets.

## Google OAuth

1. Create an OAuth client (Web) in the Google Cloud console.
2. Authorized redirect URI: `{PUBLIC_URL}/api/auth/google/callback`.
3. Restrict the consent screen to Internal (your Workspace org).

## Production checklist

- [ ] `NODE_ENV=production` (test-login off, secure cookies on, HTTP→HTTPS redirect)
- [ ] `SESSION_KEY` from Secret Manager, not committed anywhere
- [ ] OAuth client + secret from Secret Manager
- [ ] Persistent volume mounted at `DATA_DIR` (daily backups land in `DATA_DIR/backups/`)
- [ ] Roster emails in `server/config.js` replaced with real pulse.sa addresses
