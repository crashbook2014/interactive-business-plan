# Turning the AI on — the runbook

Everything AI in Wodouh ships **off**. This is the sequence that turns it on,
in order, with the checks that tell you each step actually worked.

Read `docs/claude-analysis.md` first for what it costs — this file is only the
mechanics.

**Two of these steps cannot be done for you**: creating the accounts, and
paying for them. The rest is copy-paste.

---

## Before you start

| You need | Why | Cost |
|---|---|---|
| A Supabase project | Somewhere to run a server that can hold a secret. GitHub Pages cannot. | Free tier is enough |
| An Anthropic API key | The model itself | Pay per request — see below |
| The Supabase CLI | To deploy the function | Free |

**What it costs to run.** Claude Opus 5 is $5 per million input tokens and $25
per million output. A question carries the 29-row corpus plus the system
prompt — a few thousand input tokens — and returns a few hundred. That is
roughly **one to two US cents per question**, which is why the client caps a
device at five questions a day and the server rate-limits per IP. A hundred
readers asking their five questions each is single-digit dollars a day, not
hundreds. Set a spend limit in the Anthropic console anyway.

---

## 1. Create the project and get the key

1. `supabase.com` → new project. Note the **project ref** (the subdomain in
   `https://<ref>.supabase.co`).
2. `console.anthropic.com` → API keys → create one. Copy it once; you cannot
   read it again.
3. Set a monthly spend limit in the Anthropic console before you go further.

---

## 2. Deploy the function

```sh
npm i -g supabase          # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>

# Secrets. These live on Supabase and are never in the repo.
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ALLOWED_ORIGIN=https://alwodouh.com

supabase functions deploy analyze
```

**Run it locally once before deploying**, because nothing in the test suite
executes this file — the suite tests the grading logic, which is shared, but
not the Deno wrapper around it:

```sh
supabase functions serve analyze --env-file supabase/.env.local
```

Then, in another terminal:

```sh
curl -s -X POST http://localhost:54321/functions/v1/analyze \
  -H 'content-type: application/json' \
  -d '{"kind":"ask","lang":"en","q":"When is my final settlement due after I leave?"}' | jq
```

**What a healthy answer looks like:**

```json
{
  "tier": "verified",
  "answer": "…",
  "cites": [{ "id": "art-88", "article": "88", "claim": "Final settlement is due within one week…" }]
}
```

**What each failure means:**

| Response | Cause |
|---|---|
| `{"error":"not_configured"}` | `ANTHROPIC_API_KEY` is not set on the function |
| `{"error":"upstream_error","status":401}` | The key is wrong or revoked |
| `{"error":"rate_limited"}` | More than 10 requests a minute from one IP — that is your own limiter, working |
| `{"error":"unparsable"}` | The model returned something that is not JSON. Report it; do not loosen the schema |
| `{"tier":"refused","reason":"citation"}` | The grader caught an article number that no cited row contains. **This is the system working**, not a bug |
| `{"tier":"refused","reason":"money"}` | The grader caught a riyal figure the model invented. Also working |

A run of `tier: "unverified"` answers is expected, not broken. The corpus is 29
rows; most questions fall outside it. That is the honest state of the product
and the label exists to say so.

---

## 3. Point the app at it — BOTH edits, in `app/index.html`

Step 3a alone is the confusing failure mode: the buttons appear and every
request is blocked by the browser with a CSP violation in the console.

**3a — the endpoint.** Near the top of the `<script>` block:

```js
window.WODOUH_CONFIG = Object.assign({
  ANALYZE_URL: "https://<your-project-ref>.supabase.co/functions/v1/analyze"
}, window.WODOUH_CONFIG || {});
```

**3b — the Content-Security-Policy meta tag**, at the top of the same file:

```
connect-src 'none'   ->   connect-src https://<your-project-ref>.supabase.co
```

Name that one host. **Never `*.supabase.co`** — it is a shared multi-tenant
domain that anyone can register a project inside, and this policy is the only
thing standing between a future script injection and a reader's contract text.
GitHub Pages sets no response headers, so there is no second line of defence.

---

## 4. Prove it works, then prove it is honest

```sh
npm test
```

Four suites will fail, and **they are supposed to**. They assert the shipping
build sends nothing, and you have just changed that:

- `the shipping build configures no endpoint`
- `aiAvailable() is false without a URL`
- `the panel renders nothing at all`
- `with no endpoint configured, the ask entry does not exist for a reader`

That is the gate doing its job: you cannot turn this on without the test suite
saying out loud that the promise changed. Do not delete those assertions.
Either keep the AI configuration out of the committed file — set it at deploy
time — or fork the assertions to describe the enabled build honestly.

Then, on the live site:

1. Open **My rights**. The "Ask a question" entry should be there.
2. Ask something the register covers: *"When is my final settlement due?"*
   Expect a teal, source-carrying answer citing Article 88.
3. Ask something it does not: *"When exactly is my monthly wage legally due?"*
   Expect an amber block saying we have not verified it, with **no article
   number**. If an article number appears there, stop and open an issue — that
   is the one failure that matters.
4. Open the account screen. The privacy text must now say **three** exceptions
   and name the question box. If it says two, the copy did not follow the
   build.

---

## Turning it back off

Set `ANALYZE_URL` back to `""` and restore `connect-src 'none'`. The feature
disappears completely — no panel, no entry, no request — and the unconditional
privacy promise becomes true again. Nothing else in the app depends on it.
