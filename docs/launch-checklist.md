# Launch — what "say launch and it all comes back" actually means

The product is finished and hidden. This file is the entire procedure for
un-hiding it, and the guarantee that hiding it cost nothing.

---

## The state today

| | |
|---|---|
| `alwodouh.com` | Pre-launch page. Same product story, same prices, contact instead of "try it now" |
| `alwodouh.com/app/` | **Locked.** Redirects to the pre-launch page |
| `alwodouh.com/app/#preview` | **The key.** Opens the full working app — use it to demo |
| The product itself | Untouched. Every screen, every calculation, every paywall |
| The tests | 27 suites, all green. `soon.test.js` reads the flag and asserts whichever side is shipped, so un-launching stays tested |

**Nothing was deleted or disabled to do this.** `test/soon.test.js` asserts
that directly: every launch-day element is still in the document, one CSS class
from visible, and the end-of-service calculation still returns 66,986 SAR on
the worked example from behind the curtain.

---

## To launch

Two lines. Change `false` to `true` in both:

| File | Line |
|---|---|
| `assets/curtain.js` | `window.WODOUH_LAUNCHED = false;` — the landing flag moved here from `index.html`'s `<head>` |
| `app/index.html` | `window.WODOUH_LAUNCHED = false;` — in the `<head>` |

Then:

```sh
npm test            # all 27 suites must pass
git commit -am "Launch"
git push origin HEAD:main
```

That is the whole mechanism. The pre-launch framing disappears, the app opens
to everyone, and every link into it comes back.

### What changes the moment those two lines flip

- The nav, hero, pricing and closing CTAs point at the app again instead of at
  the contact section
- The contact section **stays visible**. This file used to say it is hidden; it
  never was — `#contact` carries no `.soon-only` class, so it survives the
  flip. Left that way deliberately at the September 2026 launch: the whole
  justification for requiring an account is that someone who used Wodouh can be
  reached and supported, and removing the one place showing a number and an
  address at the moment real people arrive would contradict it
- `/app/` opens for everyone, with or without the `#preview` key
- The pre-launch badge, the "we're finishing the final review" note and the
  launch-pricing line all retire

### What does NOT change, and still needs its own decision

Flipping the flag does **not** make these true. Each is a separate switch, and
each is off for a reason:

| Still off | Where | What it needs |
|---|---|---|
| **Payments** | `PAYMENT_LIVE = false` in `app/index.html` | Merchant approval from a payment gateway — Tap and Moyasar are both applied for, first one wins; see `docs/payments.md`. Then the server work. Until then a reader can reach a paywall and cannot pay — decide whether to launch free-only or wait |
| **Subscriptions** | `SUBSCRIPTIONS_LIVE = false` | Same |
| **The lawyer desk** | `LAWYER_DESK.live = false` | A real lawyer, a real turnaround time, and an answer to who reviewed the 29 claims |
| **The AI** | `ANALYZE_URL: ""` | `docs/enable-ai-runbook.md` — a Supabase project, an Anthropic key, and a CSP edit |

**Read that table before launching.** "Everything comes back" means everything
that was ever on. Launching with `PAYMENT_LIVE` false means visitors reach
paywalls that cannot take money, which is the single worst page you can show a
stranger. Either turn payments on first, or launch with the paid tiers hidden.

---

## Before you flip it — the ten-minute pass

1. **Prices.** Are 65/130/195, 245/395 and 145/295 still the prices you want?
   They are named on the pre-launch page now, so anyone who called has been
   quoted them.
2. **Article 53.** Still marked DISPUTED in the register, and the product says
   so in four places. Fine to launch with — settle it when you can.
3. **The legal review.** `docs/lawyer-review-pack.md` is still unanswered: who
   reviewed the claims, when, and with what outcome. Not a blocker for a free
   product; it is one before you charge.
4. **The iOS pass.** `docs/ios-test-runbook.md` has never been run on a real
   iPhone. Every test to date is headless Chromium on Linux.
5. **Search Console.** Verify the domain and submit `sitemap.xml`. Every week
   it is not connected is a week of query data permanently lost — and it is the
   only measurement that exists.

---

## To un-launch

Set both flags back to `false`. Same two lines, same commit. The curtain is
symmetric on purpose: nothing about launching is one-way.
