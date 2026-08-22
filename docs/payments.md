# Wodouh — payments

**Status: no gateway chosen, and no payment code exists.** The entire
implementation today is a 900 ms `setTimeout` in `pwPay()` that grants access
without charging anything. The paywall carries a demo tag saying so.

That is worth stating plainly because it makes the decision cheap: switching
between candidates costs nothing right now, and will cost a week once one is
integrated.

---

## The decision, 22 August 2026

**Apply to both Tap and Moyasar. Use whichever approves first.**

Merchant approval is a third-party duration measured in weeks, it sits on the
critical path of a launch that includes payments, and neither approval is
guaranteed. Two applications cost about an hour each and remove the single-queue
risk entirely. The integration is written to make the winner a configuration
choice rather than a rebuild.

## The architecture rule, which applies to either

**Hosted redirect checkout. Never an embedded SDK.**

`app/index.html` ships `script-src 'self'` and `connect-src 'none'`. Embedding a
gateway's JavaScript means widening `script-src` to a third-party host — and
that policy is the one line standing between a script injection and a reader's
contract text. It is not a line to spend on a convenience.

So:

1. The reader presses pay. The app calls **our** Edge Function.
2. The function creates the payment server-side, holding the secret key, and
   returns a URL.
3. The reader is redirected to the gateway's own page and pays there.
4. The gateway redirects back and, separately, calls our **webhook**.
5. **The webhook grants the entitlement — not the redirect.** A redirect is the
   reader's browser making a claim; a signed webhook is the gateway telling us
   what happened. Someone who edits a return URL must not thereby own the
   product.

Card details never touch our servers, our CSP never changes, and PCI scope
stays minimal. This is the same shape as the existing `oauth-callback` and
`webhook` functions, so it is a pattern this codebase already runs.

## What to check before choosing — your checklist, not my findings

The sandbox cannot reach either company, and fees and feature sets change.
Verify each of these yourself rather than taking a number from me:

| | Why it matters here |
|---|---|
| **mada** | The domestic debit network carries the majority of Saudi card payments. Non-negotiable. |
| **Apple Pay** | The app is a PWA that many readers will use on iPhone. |
| **Recurring billing** | `PLANS_T` has a 50 SAR/month and 500 SAR/year tier. If the gateway cannot do subscriptions, `SUBSCRIPTIONS_LIVE` can never turn on. |
| **Arabic hosted checkout** | An Arabic-first product handing the reader an English-only payment page, at the exact moment they decide to trust it. Ask to see the page before you commit. |
| **Settlement** | To a Saudi bank account, and how long it takes. |
| **Onboarding requirements** | Commercial registration, bank details, and — see below — published terms, privacy and refund pages. |
| **Refund API** | Our refund policy promises money back with no questions. Issuing refunds must not be a support ticket to the gateway. |
| **Webhook signing** | A webhook you cannot verify is a webhook anyone can forge. |
| **Fees** | Per transaction, plus anything monthly. Compare on a 145 SAR sale, which is the common one. |

## What onboarding needs from the site

Both gateways ask for these before approving a merchant. **All three now exist**
— they were missing entirely until 22 August 2026, and an earlier audit had
flagged their absence as a blocker:

- `/terms` — what the service is and is not
- `/privacy` — what leaves the device, when, and what is stored
- `/refund` — honours the "no questions" promise already on the paywall

They are linked from the app's account screen and the root page footer. They
are labelled as drafts pending legal review, and they go to the lawyer with the
rest of the pack.

## The payment marks are a claim

`PAY_MARKS` in `app/index.html` declares what the paywall says it accepts —
mada, Apple Pay, STC Pay. Those were three hard-coded `<i>` tags until this was
written. **Set that list from the chosen gateway's actual capabilities on the
day it is chosen.** A method advertised under the pay button that the gateway
cannot take is a false claim on the screen where somebody decides to trust us
with money. `commerce.test.js` asserts the rendered marks match the list, so
there is one place to correct and a test that notices if they drift.

## Before payments go live

- `PAYMENT_LIVE` / the `payments` flag turned on — see `docs/operations.md`
- The refund guarantee is real: someone must actually be able to issue one
- Test a real card end to end, and a real refund end to end
- The lawyer review returned, because charging money is what makes it a blocker
