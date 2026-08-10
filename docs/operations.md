# Operations — what watches Wodouh, and what to do when it goes red

Before this existed, the answer to "is the app working right now?" was "run the
tests by hand and find out." Three things watch it now, and they catch
different failures.

| | What it proves | When | Where it tells you |
|---|---|---|---|
| **`npm test`** | The code is correct | Every push, and whenever you run it | The CI tab, red or green |
| **`test/watchdog.js`** | The *deployment* is working | Every 6 hours | Opens a GitHub issue |
| **`wodouh-engineer`** | The product is still *good* | When you ask | In conversation |

The distinction between the first two matters. The suites run against a local
copy — they can be perfectly green while the live site serves a stale page, a
404ing font, or nothing at all. The watchdog is the one that loads what a real
person loads.

---

## Day to day

```
npm test                    # all eight suites, ~30s, starts its own server
npm test routing            # only suites matching "routing"
node test/serve.js 8099     # just a server, for poking at it yourself
```

`npm test` starts a server on a free port, runs everything cheapest-first so a
broken build fails in seconds, tears the server down, and exits non-zero if
anything failed. That exit code is what makes it usable as a gate.

**Against the live site:**

```
npm run test:live
node test/watchdog.js https://crashbook2014.github.io/interactive-business-plan
```

---

## CI

`.github/workflows/ci.yml` — every push, every PR to `main`.

Runs the suites, then type-checks `supabase/functions/analyze/index.ts` under
`--strict`. That last step exists because the Edge Function is deployed by hand
and nothing else would catch a type error in it before it was live.

**GitHub Pages deploys whatever lands on `main`.** CI going red does not stop
the deploy — it tells you. If CI is red on `main`, treat the live site as
suspect until it is green.

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

## The engineer

`.claude/agents/wodouh-engineer.md` — invoke it when you want a real inspection
rather than a pass/fail.

It exists because of a specific gap. Everything the last review found by
walking the app — a buy button reading *"Get my letter"* on a case file,
*"Back to score"* on a screen with no score, a paywall showing nothing but the
reader's own answers, a 295 SAR bundle worth more than a 325 SAR product —
**passed all eight suites.** Tests catch regressions. They do not catch a
product quietly getting worse.

Worth running before a launch, after a large change, or every few weeks.

---

## What still is not watched

**Production errors.** If a real user hits a bug right now, nothing tells you.
The app reports nothing, by design — it is the other half of the audit's 0/10
observability score, and closing it means the app phoning home, which touches
the privacy promise. That is a product decision, not a default, so it has been
left alone.

**Real Safari and iOS.** Everything above runs headless Chromium. PDF intake
needs Safari 16.4+ and has never run on Apple hardware.

**Screen readers.** Programmatic accessibility checks pass. That is necessary,
not sufficient.
