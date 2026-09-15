# Wodouh — project guide for Claude

## What it is
Arabic-first Saudi employment rights PWA. Bilingual AR/EN. Helps workers
calculate EOS/notice pay (Articles 84–87), review contract clauses, and
generate demand letters. Deployed on GitHub Pages at alwodouh.com. No build
step — `main` → live immediately via Pages.

## Stack
- **App:** `app/index.html` — one ~13,900-line file, inline CSS + JS, no framework
- **Landing:** `index.html` + `assets/landing.js`
- **Backend:** Supabase Edge Functions (Deno/TypeScript), Postgres
- **AI:** Anthropic Claude via `supabase/functions/analyze/`
- **Tests:** Playwright, 47 suites, `node test/run.js`
- **Package manager:** npm (devDeps only — playwright, typescript)

## Directory map
| Path | Purpose |
|---|---|
| `app/index.html` | Entire PWA — all screens, logic, styles |
| `index.html` | Marketing landing page |
| `privacy/`, `terms/`, `refund/`, `legal/`, `support/` | Static policy pages |
| `admin/index.html` | Internal admin console |
| `supabase/functions/` | Edge Functions: `analyze`, `upload`, `oauth-callback`, `webhook`, `_shared/` |
| `supabase/migrations/` | SQL migrations 0001–0011 |
| `test/` | 47 Playwright suites + `_env.js`, `serve.js`, `run.js` |
| `tools/` | `make-seo.mjs`, `make-corpus.mjs`, `make-icons.mjs`, `setup-supabase.mjs` |
| `answers/` | 58 generated SEO answer pages — do not edit directly |
| `docs/` | Status reports, runbooks, legal sources, roadmap |
| `assets/` | `landing.js`, `curtain.js`, fonts, OG image |
| `types/` | TypeScript stubs for Edge Function type-checking |

## Commands
```bash
npm test                    # run all 47 suites (auto-starts server)
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

## Compiled constants (app/index.html ~line 12639–12863)
- `PAYMENT_COMPILED = false` — payments off; `FREE_NOW = true` — free mode
- `LAWYER_COMPILED = false` — lawyer desk off
- **`FREE_NOW` must stay `true`** until payments are live
- `ANALYZE_URL` hardcoded at line 1343 (AI is live)
- `UPLOAD_URL` hardcoded at line 1356 (scan upload is live)
- `AI_COMPILED = false` + `AI_LIVE` (line ~12699) — the AI surface compiles OFF
  and only a well-formed `ai_analysis` flag raises it. The row must be `true`
  in production or the AI ships dark.

## Config
- Browser: inline `window.WODOUH_CONFIG` in `app/index.html` (line 1337). Set via `setup-supabase.mjs`.
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
- `app/index.html` is ~13,900 lines. Read 50 lines around any target before editing.
- Migrations `0007–0009` unapplied in prod; schema-advisor fixes need `0010`.
- `ai_analysis` defaults to `true` on flag-fetch failure (open bug).
- `supabase/functions/analyze/index.ts` is deployed by hand — run `npm run typecheck` before touching it.

## Active bugs (Sep 2026) — see docs/status-2026-09-14.md
All four Claude-fixable items from the 14 Sep audit are now closed:
`ai_analysis` fail-open (029f54e), the ten BANNED-list bypasses, the missing
Article 81 door on the resign path, and the employer-pays-fees polarity bug.
The remaining items in that report need a founder or legal decision, not code.

## Compact context rules
**Preserve:** current task goal, files changed this session, commands run,
failing tests with exact error, decisions made, next steps.
**Drop:** exploration paths that didn't pan out, repeated logs, resolved threads.
