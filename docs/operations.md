# Operations — what watches Wodouh, and what to do when it goes red

Before this existed, the answer to "is the app working right now?" was "run the
tests by hand and find out." Three things watch it now, and they catch
different failures.

| | What it proves | When | Where it tells you |
|---|---|---|---|
| **`.githooks/pre-push`** | Nothing broken leaves the machine | Every push | Refuses the push |
| **`npm test`** | The code is correct | On demand, and inside the hook | Your terminal |
| **`test/watchdog.js`** | The *deployment* is working | Every 6 hours *(needs Actions)* | Opens a GitHub issue |
| **The four agents** | The product is still *good* | When you ask | In conversation |

**The pre-push hook is the one that actually protects you**, and it is the only
layer that depends on nothing but this repository. Pages deploys whatever lands
on `main`, so CI can only tell you `main` is broken *after* it is broken; the
hook stops the commit leaving at all.

The distinction between the suites and the watchdog matters too. The suites run
against a local copy — they can be perfectly green while the live site serves a
stale page, a 404ing font, or nothing at all. The watchdog is the one that loads
what a real person loads.

---

## First time on a machine

```
npm install
npm run setup               # arms the pre-push gate
```

`npm run setup` sets `core.hooksPath` to `.githooks`. Without it the hook file
is just a file — git will not run it. Confirm with
`git config --get core.hooksPath`.

## Day to day

```
npm test                    # every suite, ~30s, starts its own server
npm test routing            # only suites matching "routing"
node test/serve.js 8099     # just a server, for poking at it yourself
```

`npm test` starts a server on a free port, runs everything cheapest-first so a
broken build fails in seconds, tears the server down, and exits non-zero if
anything failed. That exit code is what makes it usable as a gate.

**Against the live site:**

```
npm run test:live
node test/watchdog.js https://alwodouh.com
```

---

## Live verification log

Every automated check in this repository runs against a **local copy**. That is
not the same as the deployed site, and the distinction has teeth: a manifest
served with the wrong MIME type, a stale service-worker build, a CNAME that
never took — none of those can fail locally. The suites can be perfectly green
while the live site is broken.

The sandbox this project is developed in cannot reach `alwodouh.com`; the
network proxy answers 403 to CONNECT. So live runs happen on the founder's own
machine, and they are recorded here rather than assumed.

| Date | Commit | Run by | Result |
|---|---|---|---|
| 13 Aug 2026 | `dd07fb8` | Founder, unproxied machine | `npm run test:live` — all suites passed |

**Read that table as what it says.** These are reported results, not results
this repository observed. That is the honest status of any check nobody here
can run, and it is better than the alternative, which was no live verification
at all.

Re-run after any deploy that changes the shell, the manifest, the service
worker, or the domain:

```
npm run test:live
node test/watchdog.js https://alwodouh.com
```

---

## ⚠ Actions is not currently executing on this account

**Read this before trusting anything below.** Both workflows are registered and
active, and GitHub creates a job for every push — but the job is never given a
runner. It dies in about two seconds with no steps, no log, no annotation and
`runner_id: 0`.

That is not a problem with the workflow files. A broken workflow reports
`startup_failure` with an error; a failing test reports which test failed. This
reports neither, because nothing ever ran.

It is an **account-level setting**, and only you can clear it:

1. **Repository → Settings → Actions → General.** Confirm "Allow all actions
   and reusable workflows" is selected.
2. **Account → Settings → Billing → Spending limit.** A limit reached on
   private-repo minutes can block workflow runs across the whole account, even
   on a public repo where the minutes are free.
3. Re-run the latest run from the Actions tab and confirm it gets a runner.

Until that clears, **CI is not protecting `main` and the watchdog is not
running.**

This is why the pre-push hook exists and why it is listed first. It runs the
same suites, refuses the push when they are red, and needs no runner, no
minutes and no account. **You are not unprotected while Actions is down** —
you are only missing the live-deployment check, which is the one thing the hook
cannot do from here.

---

## The pre-push gate

`.githooks/pre-push` — every push, from any machine where `npm run setup` has
been run.

It runs `npm test` and exits non-zero if anything is red, which aborts the push.
Skipped deliberately with `git push --no-verify` — that override is intentional,
because a gate with no way out gets worked around in worse ways than one that
leaves a trace in your shell history.

Verified in both directions: a clean tree pushes normally; a deliberately broken
`awardBase` refused the push and named the three wrong figures.

It does **not** skip docs-only pushes. Thirty seconds is cheap, and "it's only
docs" is exactly the assumption that left a stale test list in
`docs/deployment.md` for weeks.

---

## CI

`.github/workflows/ci.yml` — pushes to `main` and PRs to `main`. **The
backstop, not the primary gate** — the hook has already run by the time this
does. It used to trigger on every branch, which mailed two failures for one
piece of work; `main` is the branch Pages deploys, so `main` is the branch a
failure has to stop.

Runs the suites, then `npm run typecheck`, which type-checks
`supabase/functions/analyze/index.ts` under `--strict` via
`tsconfig.check.json`. That step exists because the Edge Function is deployed
by hand and nothing else would catch a type error in it before it was live.

**Two things about that step were wrong until 21 August 2026, and the lesson is
worth more than the fix.** It was a long inline `tsc` invocation carrying
`--types ""`, which TypeScript 6 rejects outright (TS6044) — so the step was
broken. And it existed *only* here, in a workflow that has never once executed.
A check that lives only in CI, when CI cannot start, is not a check. It runs in
the pre-push hook now, on the machine, in about two seconds.

**GitHub Pages deploys whatever lands on `main`.** CI going red does not stop
the deploy — it tells you. If CI is red on `main`, treat the live site as
suspect until it is green.

---

## The founder console — /admin/

One page: what is live, four switches, the numbers, the change log, and what is
blocking launch. Reachable at `alwodouh.com/admin/`.

**It is not protected by being hard to find.** The URL is public and anyone may
open it. It carries no credential of any kind — no service key, no GitHub
token — and every read and write goes through row level security in Postgres
against `public.admins`. A stranger who opens it sees the status panel, which
reads facts they could get off the deployed site anyway, and can change
nothing. Hiding a button is not a permission, and `test/admin.test.js` checks
the bytes rather than trusting the intention.

**The status panel needs no credentials, and reads the DEPLOYED files** —
`/index.html`, `/app/index.html`, `/docs/legal-sources.md` — parsing the
constants straight out of them. So it reports what readers are actually
getting, not what is in a working tree. On this project the difference between
"pushed" and "live" has mattered repeatedly; this is the panel that answers the
second one.

### The switches, and what they cost

Four features can be turned on and off without a deploy: payments,
subscriptions, the AI read, the lawyer desk. They live in `public.app_flags`.

The price is that the app now makes a request it did not make before. Three
rules keep that as small as it can be:

- **Lazy, never on boot.** Nothing is fetched until a reader first opens the
  paywall, the account screen or the AI panel. Someone who opens the app, pastes
  a contract and reads the result still makes no request at all.
- **It carries nothing** about the reader or the document — a GET of a public
  table with the anon key.
- **It never blocks.** Two-second timeout, and a failure is invisible.

**Every failure falls to off.** No config, no network, a timeout, a malformed
body, an unknown key, a cache older than twelve hours — all of them land on the
constant compiled into `app/index.html`, and all of those constants are false.
Someone who could make the flag table unreachable could turn features OFF. There
is no path by which they turn one ON.

**The launch curtain is deliberately not a flag.** Making it remote would mean a
request from every visitor before they consented to anything, for a switch that
moves twice in a product's life. It stays two lines — `index.html` and
`app/index.html` — and the console shows the state and flags a mismatch between
them.

### If the flags are unreachable

Nothing to do. The app falls back to the compiled constants, which is the
state it shipped in. To force it, deploy with the constant changed; that
overrides everything.

### Adding an operator

Only in the Supabase dashboard: insert the user's `auth.users` id into
`public.admins` with role `owner` or `viewer`. There is no client write policy
on that table, so no page — including the console — can grant access to itself.

---

## The watchdog

`.github/workflows/watchdog.yml` — every six hours, and on demand from the
Actions tab.

It checks:

- the three pages return 200
- **the app's own JavaScript actually initialised** — a 200 that renders nothing
  is the failure people miss
- no failed requests
- **zero off-origin requests** — the privacy promise, checked in production
  rather than assumed
- the full termination journey, with the end-of-service figure **recomputed
  independently in the watchdog** rather than agreed with
- every money line carries a source
- no `undefined`, `NaN` or promise language on the live page
- Arabic and RTL
- no console or page errors

It opens **one** issue labelled `watchdog` and comments on it rather than filing
a new one every six hours, and closes it when a later run passes. A watchdog
that floods the inbox stops being read, which is the same as not having one.

### When the watchdog goes red

1. **Open the run** — the log is in the issue and in the Actions tab.
2. **Is it the site or the check?** Load the app yourself. If it loads fine,
   suspect a transient network failure on the runner; re-run the job.
3. **`npm test` locally.** Green locally + red live means a deployment problem,
   not a code one — check the last Pages build succeeded.
4. **Roll back if the figures are wrong.** `docs/deployment.md` has the
   procedure and the known-good SHAs. A wrong riyal figure in front of someone
   who just lost their job is worth reverting for; a cosmetic glitch is not.

---

## The agent team

Four of them now — `wodouh-engineer`, `wodouh-experience`, `wodouh-redteam`,
`wodouh-growth`. `docs/agent-team.md` is the shared contract: issue format,
severity ladder, what they may and may not decide, and how often to run them.
Invoke one when you want a real inspection rather than a pass/fail.

They exist because of a specific gap. Everything the last review found by
walking the app — a buy button reading *"Get my letter"* on a case file,
*"Back to score"* on a screen with no score, a paywall showing nothing but the
reader's own answers, a 295 SAR bundle worth more than a 325 SAR product, and
worst of all three payment tiers that all delivered the same thing —
**passed every suite there was.** Tests catch regressions. They do not catch a
product quietly getting worse.

Those particular defects are fixed and `test/commerce.test.js` now guards them,
which is the point: the reviewer finds the class of problem, and a suite is
written so that instance can never come back. The gap it covers is permanent
even when today's findings are closed.

Cadence is in `docs/agent-team.md` — engineer after a change, experience before
anything user-facing ships, red team before money moves, growth weekly. Not all
four on the same day: four reports at once is a stack nobody reads.

---

## What still is not watched

**Production errors.** If a real user hits a bug right now, nothing tells you.
The app reports nothing, by design — it is the other half of the audit's 0/10
observability score, and closing it means the app phoning home, which touches
the privacy promise. That is a product decision, not a default, so it has been
left alone.

**Real Safari and iOS.** Everything above runs headless Chromium. PDF intake
needs Safari 16.4+ and has never run on Apple hardware. `docs/ios-test-runbook.md`
is the scripted pass to run on a real iPhone — it exists because I cannot run
it, and a checklist you actually perform beats a check I claim to have done.

**Screen readers.** Programmatic accessibility checks pass. That is necessary,
not sufficient.
