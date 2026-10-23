# Wodouh — project guide for Claude

## What it is
Arabic-first Saudi contract and employment-rights PWA. Bilingual AR/EN. Reads
contracts (employment, rental, freelance, loans), assesses terminations that
have already happened, calculates end-of-service and notice pay (Articles
84–87), and drafts letters. Deployed on GitHub Pages at alwodouh.com. No build
step — `main` → live immediately via Pages.

Who it is for: often someone who has just lost their income. Fear-selling,
false certainty and invented law are defects, not tactics. Wodouh is not a law
firm; the opinion is never "you will win".

How it makes money: one-off Tap payments (no subscriptions). Read the live
plans from `PLANS_REVIEW`, `PLANS`, `PLANS_CASE`, `BUNDLE` in the app and
`PLANS` in `supabase/functions/_shared/tap.mjs`; the 299 review-and-letter
package is the recommended option. Free: one scan a month with an account
(score, verdict, most serious flag), the EOS calculator, the rights library.

Founder's standing rules: never commit secrets (`sk_live`, service role,
tokens); never use Moyasar; never invent legal articles or credentials; Gulf
Arabic, no em dashes or slashes in copy; refunds are reviewed — full refund
when the fault is ours, none when the product was delivered as described.

## Stack
- **App:** `app/index.html` — one ~14,800-line file, inline JS; styles in `app/app.css`, `app/desktop.css`; Tap client in `app/payments-tap.js`
- **Landing:** `index.html` + `assets/landing.js`
- **Backend:** Supabase Edge Functions (Deno/TypeScript), Postgres
- **AI:** Anthropic Claude via `supabase/functions/analyze/`
- **Tests:** Playwright, 50 suites, `node test/run.js`
- **Package manager:** npm (devDeps only — playwright, typescript)

## Directory map
| Path | Purpose |
|---|---|
| `app/index.html` | Entire PWA — all screens, logic, styles |
| `index.html` | Marketing landing page |
| `privacy/`, `terms/`, `refund/`, `legal/`, `support/` | Static policy pages |
| `admin/index.html` | Internal admin console |
| `supabase/functions/` | Edge Functions: `analyze`, `upload`, `create-payment`, `tap-webhook`, `oauth-callback`, `webhook`, `_shared/` |
| `supabase/migrations/` | SQL migrations 0001–0013, all applied in prod |
| `test/` | 50 Playwright suites + `_env.js`, `serve.js`, `run.js` |
| `tools/` | `make-seo.mjs`, `make-corpus.mjs`, `make-icons.mjs`, `setup-supabase.mjs` |
| `answers/` | Generated SEO answer pages — do not edit directly |
| `docs/` | Status reports, runbooks, legal sources (`legal-sources.md`), roadmap, agent team (`agent-team.md`) |
| `brand/` | Brand guide, served at alwodouh.com/brand/, PDF via `brand/render.js` |
| `.claude/agents/` | Review agents: engineer, experience, redteam, conversion (the core four), growth |
| `assets/` | `landing.js`, `curtain.js`, fonts, OG image |
| `types/` | TypeScript stubs for Edge Function type-checking |

## Commands
```bash
npm test                    # run all 50 suites (auto-starts server)
npm run test:live           # test against alwodouh.com
npm run typecheck           # tsc on supabase/functions/analyze/index.ts
node tools/make-seo.mjs     # regenerate answers/ pages
node tools/setup-supabase.mjs <url> <anon-key>  # write config into app + admin
```

## Key functions in app/index.html
- `show(name, back)` — screen navigation
- `applyLang()` — AR↔EN switch
- `saveState()` / `loadState()` — localStorage persistence
- `t(k)` — translation lookup from `const T` dictionary
- `flagOn(key, fallback)` — feature flag with compiled-constant fallback
- `applyFlags()` — fetches flags from Supabase at startup
- `blankTerm()` / `termCtype()` / `termQNext()` — termination wizard state
- `calcEos()` — free EOS calculator (Articles 84/85/87)
- `renderWipe()` — erase-my-data panel

## Compiled constants (app/index.html, search for `_COMPILED`)
- `PAYMENT_COMPILED = false` (the `payments` app_flags row is `true` in prod)
- `FREE_NOW = false` — Tap checkout is live (Sep 2026). `CREATE_PAYMENT_URL`
  is set in `WODOUH_CONFIG`; `pwPay()` refuses rather than granting when
  checkout cannot run. Tap secrets live in Supabase, never in the repo.
- `LAWYER_COMPILED = false` — lawyer desk off
- `ANALYZE_URL` set in `WODOUH_CONFIG` (AI is live)
- `UPLOAD_URL` set in `WODOUH_CONFIG` (scan upload is live, signed-in only)
- `AI_COMPILED = false` + `AI_LIVE` — the AI surface compiles OFF
  and only a well-formed `ai_analysis` flag raises it. The row must be `true`
  in production or the AI ships dark.

## Config
- Browser: inline `window.WODOUH_CONFIG` in `app/index.html` (near line 1370). Set via `setup-supabase.mjs`.
- Edge Function secrets: `supabase secrets set`. See `.env.example`.

## Environment variables (Edge Functions only — never in browser)
`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ALLOWED_ORIGIN`,
`SUPABASE_URL`*, `SUPABASE_SERVICE_ROLE_KEY`* (*auto-injected by Supabase)

## Do not touch
- `answers/` — generated; edit source data, not output
- `supabase/config.js` — gitignored, written by setup script
- `sitemap.xml` — generated
- `.walk/` — agent scratch

## Fragile areas
- `app/index.html` is ~14,800 lines. Read 50 lines around any target before editing.
- After changing `app/index.html`, `app/app.css` or `app/desktop.css`, run
  `node tools/shell-fingerprint.mjs --write` or the service worker serves stale files.
- `ai_analysis` compiles OFF and only a well-formed flag raises it, so a failed
  flag fetch ships the AI dark rather than open. Set the row `true` in prod.
- `supabase/functions/analyze/index.ts` deploys via the **deploy analyze**
  workflow (needs the `SUPABASE_ACCESS_TOKEN` repo secret); `api.supabase.com` is
  egress-blocked from the sandbox. The Supabase MCP tools can deploy a function
  (`deploy_edge_function`), but only with the founder's explicit go-ahead for
  that deploy. Check the live version with `list_edge_functions` rather than
  trusting a number written here (it was 9, dated 5 Sep, on 23 Oct 2026). Run
  `npm run typecheck` and `node test/deploy-bundle.test.js` before touching it.

## Reading production
The Supabase MCP tools reach the production project `nkgjgpageqohalerccfu`.
Read freely (flags, function versions, counts, logs, advisors); counts only,
never quote a person's data. Writing (migrations, deploys, flag changes,
secrets) needs the founder's explicit go-ahead each time. Live screenshots of
alwodouh.com: the `live screenshots` workflow, read back from the
`live-shots` branch. Details in `docs/agent-team.md`.

## Open issues (agent review 7 Oct 2026, still open 23 Oct)
1. **Checkout has never reached Tap.** All 4 live orders (29 Sep, founder
   testing) were cancelled by `create-payment`'s `upstream_error` branch with
   no Tap id. The function does not log why. Needs a log line, then one real
   purchase.
2. **Uploaded scans are never deleted**, though privacy/ promises one hour.
   Nothing calls `deleteUpstream` after analysis or `uploads_pending_delete()`.
   Latent: 0 uploads ever.
3. **Deployed `analyze` (v9) is a month behind the repo**: the BANNED-list
   fixes, the loan prompt, obligations and quotes are not live.
4. **The termination-screen AI panel (`kind:"contract"`) has no server-side
   filter** (banned phrases, figures, articles).
5. **A paid order confirmed after ~12 s is never granted**; nothing re-reads
   the reader's paid orders on sign-in or on a new device.
6. **A signed-out terminated reader loops** between sign-in and home
   (`AUTH_FREE` excludes term screens). Founder decision.
Also for the founder: two privacy strings (`au_what_b`, `wipe_b`) still say
the contract never leaves the device; «مؤكد» on an estimated amount; the
notice-clause advice vs Article 75; the free clause screen showing the whole
paid review; the unbacked "reviewed by a licensed Saudi lawyer" line.

## Compact context rules
**Preserve:** current task goal, files changed this session, commands run,
failing tests with exact error, decisions made, next steps.
**Drop:** exploration paths that didn't pan out, repeated logs, resolved threads.
