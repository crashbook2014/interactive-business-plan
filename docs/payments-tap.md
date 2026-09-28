# Tap payments / مدفوعات تاب

Wodouh charges through [Tap Payments](https://www.tap.company) (تاب) on a hosted charge page (`source.id: src_all`). The secret key stays in Supabase Edge Function secrets. The browser only ever receives `transaction.url` on an `https://*.tap.company` host.

This is the sandbox path. It does not turn `FREE_NOW` off, and it does not charge anyone until `TAP_SECRET_KEY` is set. Live percentage fees are a quote from Tap. This document does not invent them. A pending deposit setup on the dashboard does not block creating charges.

Moyasar is not used.

## What is wired / ما الذي رُبط

| Piece | Role |
|---|---|
| `supabase/functions/create-payment` | Signed-in reader asks for a `plan_id`. The function prices it from `supabase/functions/_shared/tap.mjs` and creates a Tap charge. Tap is sent riyals (`199`). Our `orders.amount` stays halalas (`19900`) so the table never stores a float. A client amount is ignored. |
| `supabase/functions/tap-webhook` | Tap posts the charge here. `verify_jwt` is **off** so the gateway does not 401 before the hash check. Separate from the Zid/Salla `webhook`. |
| `supabase/migrations/0012_orders.sql` | `orders` (the reader can select their own rows, and cannot write them) and `tap_events` (service role only). |
| `app/payments-tap.js` | Checkout. Hidden unless `CREATE_PAYMENT_URL` is set. Refuses to redirect if the server amount does not match the price on screen. |

Catalogue prices, in SAR, matching `app/index.html`: review 199, letter 149, case file 349, bundle 549, five reviews 699, Business 799 for one month. Lawyer tiers and contract drafting are not sold. Business is a single charge, not a subscription that renews itself. An upgrade priced as a difference is not sent to Tap; the charge is the full plan price.

## Keys / المفاتيح

1. Sign in to the Tap dashboard for the Wodouh account. Receiving payments can already be active while deposits are still pending.
2. Open goSell → API Credentials and copy the **test** pair: `sk_test_…` (secret) and `pk_test_…` (public).
3. Leave live keys alone until the go-live list below is done.

Do not paste keys into git. Tap publishes sample test keys in their docs; those are not this account's keys, and they do not belong in the repo either.

## Secrets

Set these on the Supabase project. They are listed in `.env.example`. Do not put the secret key in `app/` or `supabase/config.js`.

```bash
supabase secrets set PAYMENT_MODE=test
supabase secrets set TAP_SECRET_KEY=sk_test_your_key
supabase secrets set TAP_PUBLIC_KEY=pk_test_your_key
supabase secrets set ALLOWED_ORIGIN=https://alwodouh.com
```

`PAYMENT_MODE` defaults to `test` when unset. `test` refuses an `sk_live_` key, and `live` refuses an `sk_test_` key. If the secret is missing, both functions return **503** `not_configured` and the app does not grant a purchase.

`TAP_PUBLIC_KEY` is optional. The hosted charge is created with the secret key. The public key is what Tap's card SDK would use in a browser; this build does not embed that SDK. If you set the public key, it must match `PAYMENT_MODE`.

`TAP_WEBHOOK_SECRET` stays empty. Tap's `hashstring` is HMAC-SHA256 of a fixed field string, keyed with the **secret API key** ([webhook docs](https://developers.tap.company/docs/webhook)). Set `TAP_WEBHOOK_SECRET` only if Tap gave you a different signing secret. A random value rejects every real delivery.

The charge needs the reader's email. An account with no email gets `400 needs_email` and is not charged.

Deploy the two functions (the analyze workflow does not deploy them):

```bash
supabase functions deploy create-payment
supabase functions deploy tap-webhook --no-verify-jwt
```

`config.toml` already sets `verify_jwt = false` for `tap-webhook` and `true` for `create-payment`. Pass `--no-verify-jwt` on the webhook so the CLI does not override that.

In the app config (the inline `window.WODOUH_CONFIG` in `app/index.html`, documented in `supabase/config.example.js`), and only after the function is deployed:

```js
CREATE_PAYMENT_URL: "https://<project-ref>.supabase.co/functions/v1/create-payment"
```

The URL must be that exact path on the same project already named in the page's `connect-src`. Unset, the pay button stays the prototype and the account slot stays hidden.

## Webhook / الرابط

There is no separate webhook screen to paste a URL into for this flow. Each charge carries its own post URL, which `create-payment` sets to:

`https://<project-ref>.supabase.co/functions/v1/tap-webhook`

Tap posts the charge JSON when the status is captured or failed. `INITIATED` and `ABANDONED` are not posted. The header is `hashstring`. The string that is hashed, for a charge, is:

`x_id` + id + `x_amount` + amount rounded to SAR's two decimals (`199.00`) + `x_currency` + currency + `x_gateway_reference` + `reference.gateway` + `x_payment_reference` + `reference.payment` + `x_status` + status + `x_created` + `transaction.created`

An empty gateway reference is still included. After the hash matches, the function fetches `GET /v2/charges/:id` with the secret key and marks the order paid only when the fetched status is `CAPTURED`, `live_mode` matches `PAYMENT_MODE`, the currency is `SAR`, and the amount in halalas matches the order. A repeat of the same hashstring returns 200 and does not grant twice.

`orders.tap_id` is the charge id (`chg_…`). `orders.amount` is halalas.

## Test cards / بطاقات التجربة

Sandbox only, with the test secret key. Any future expiry, any CVV. The full list is [Tap's test cards](https://developers.tap.company/reference/testing-cards). These succeed and are 3-D Secure enrolled:

| Network | Number |
|---|---|
| mada | `4464040000000007` |
| Visa | `4508750015741019` |
| Mastercard | `5123450000000008` |

How to walk it:

1. Set the secrets and `CREATE_PAYMENT_URL`, deploy both functions, apply `0012_orders.sql`.
2. Sign in with an account that has an email. The account screen shows **ادفع عبر تاب / Pay with Tap** with the catalogue prices.
3. Choose a plan. The request body is `{ plan_id, lang }` and nothing else.
4. Complete the hosted page with a test card.
5. You return to the app with `tap_order` (Tap also appends `tap_id`). The order row becomes `paid` when the webhook has fetched the charge. Refresh once if the redirect wins the race.
6. With the URL unset, or with the secret empty, the same button is absent or the function answers `not_configured`, and nothing is unlocked by a charge that did not happen.

`FREE_NOW` still opens every feature. The account note says payment is optional while that is true. Turning charging into the only door is a separate switch (`FREE_NOW` in `app/index.html`), not something this integration flips.

## Go-live checklist / قائمة التشغيل

Do these before `PAYMENT_MODE=live`. Until then the functions reject a live secret key.

1. Live keys from the same dashboard (`sk_live_…`, `pk_live_…`). Deposits can still be pending; do not block the code on them. Confirm with Tap that live charges will actually settle.
2. Ask Tap for the live percentage. Write that number down where the business keeps fees. Do not copy a guess into the product.
3. `supabase secrets set PAYMENT_MODE=live` together with the live secret key.
4. Confirm `ALLOWED_ORIGIN` is `https://alwodouh.com` (live refuses an `http://` origin).
5. Pay a small live charge with a real card, confirm the order row, then refund it from the Tap dashboard and confirm the row becomes `refunded` if Tap posts the charge as `REFUNDED`.
6. Decide separately whether `FREE_NOW` stays on. Live keys do not, by themselves, close the free doors.

## What this does not do

- It does not charge while the secret is empty.
- It does not put the secret key in the browser.
- It does not call Moyasar.
- It does not renew Business monthly. One charge is one month.
- It does not sell the upgrade difference. The paywall, when Tap is configured, says so instead of charging a number the server does not have.
- It does not revoke a local unlock on refund. The order status becomes `refunded`; entitlement in the browser was already a local record. Treat a refund as a support action until entitlement moves server-side.
