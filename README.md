# Wodouh (وضوح)

A bilingual (Arabic/English) Saudi employment-contract companion. It reads a
contract and tells the reader what it means for them — decision first, then
the clause-by-clause detail — entirely on their own device.

## What's here

- **`index.html`** — the marketing landing page.
- **`app/index.html`** — the product itself: one self-contained file, no
  runtime dependencies, no build step. Deployment is `git push`.
- **`admin/`** — the founder console. Holds no credential; every read and
  write is enforced by Postgres row level security.
- **`answers/`, `how-we-verify/`** — generated, not written. See
  `tools/make-seo.mjs` and `docs/legal-sources.md` below.
- **`docs/legal-sources.md`** — the register: every legal claim the product
  makes, each with the official source it was checked against and the date.
  An article number appears in the app only if its row here reads
  `✅ verified`.
- **`supabase/`** — Postgres schema (`migrations/`), Edge Functions
  (`functions/`), and the RLS policies that are the entire authorization
  model.
- **`test/`** — 23 suites (Playwright + Node), run against a local static
  server by default.
- **`tools/`** — generators: the legal corpus the AI reads, the SEO answer
  pages, icons, OG images.

## Running it

```
npm install
npm test              # the full suite, against a server this starts for you
npm run typecheck      # type-checks the one hand-deployed Edge Function
npm run serve           # just the static server, for manual poking
```

`npm run setup` wires a pre-push git hook that runs the suite before every
push — the only gate that exists while CI is unauthenticated on this account.

To run the suites against the live site instead of a local server:

```
WODOUH_URL=https://alwodouh.com npm run test:live
```

## The non-negotiables

- **No invented law.** A legal claim appears in the product only if it's a
  `✅ verified` row in `docs/legal-sources.md`, sourced and dated.
- **A model can never move money.** Every riyal figure is computed by
  deterministic code; server-side grading refuses any AI answer that cites a
  figure or article number not present in a verified row.
- **AI ships inert.** With no endpoint configured, AI-dependent surfaces
  render nothing at all — not an error, not a placeholder.
- **Nothing about a reader's contract leaves their device** unless they give
  explicit, per-feature consent.

See `docs/rebuild-prompt.md` for the full account of how this was built and
why, phase by phase — it's written as a standalone instruction, so it also
works as the deepest available documentation of the design.
