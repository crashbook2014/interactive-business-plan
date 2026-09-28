# Moyasar payments / مدفوعات ميسر

Wodouh charges through [Moyasar](https://moyasar.com) (ميسر), a SAMA-listed payment institution, with Mada, Visa, Mastercard, and Apple Pay on a hosted invoice. The secret key stays in Supabase Edge Function secrets. The browser only ever receives an invoice URL on a `moyasar.com` host.

This is the sandbox path. It does not turn `FREE_NOW` off, and it does not charge anyone until the secrets below are set. Live percentage fees are a quote from Moyasar sales. This document does not invent them.

PayLink is not used.

## What is wired / ما الذي رُبط

| Piece | Role |
|---|---|
| `supabase/functions/create-payment` | Signed-in reader asks for a `plan_id`. The function prices it from `supabase/functions/_shared/moyasar.mjs` (halalas, SAR × 100) and creates a Moyasar invoice. A client `amount` is ignored. |
| `supabase/functions/moyasar-webhook` | Moyasar posts events here. `verify_jwt` is **off** so the gateway does not 401 before the secret check. Separate from the Zid/Salla `webhook`. |
| `supabase/migrations/0012_orders.sql` | `orders` (the reader can select their own rows, and cannot write them) and `moyasar_events` (service role only). |
| `app/payments-moyasar.js` | Checkout. Hidden unless `CREATE_PAYMENT_URL` is set. Refuses to redirect if the server amount does not match the price on screen. |

Catalogue prices, in SAR, matching `app/index.html`: review 199, letter 149, case file 349, bundle 549, five reviews 699, Business 799 for one month. Lawyer tiers and contract drafting are not sold. Business is a single invoice, not a subscription that renews itself. An upgrade priced as a difference is not sent to Moyasar; the invoice is the full plan price.

## Signup / التسجيل

1. Create an account at [dashboard.moyasar.com](https://dashboard.moyasar.com). The sandbox does not require a sales conversation or a live commercial registration.
2. Open API keys and copy the **test** pair: `sk_test_…` (secret) and `pk_test_…` (publishable).
3. Leave live keys alone until the go-live list below is done.

## Secrets

Set these on the Supabase project. They are listed in `.env.example`. Do not commit real values, and do not put the secret key in `app/` or `supabase/config.js`.

```bash
supabase secrets set PAYMENT_MODE=test
supabase secrets set MOYASAR_SECRET_KEY=sk_test_your_key
supabase secrets set MOYASAR_PUBLISHABLE_KEY=pk_test_your_key
supabase secrets set MOYASAR_WEBHOOK_SECRET="$(openssl rand -base64 32)"
supabase secrets set ALLOWED_ORIGIN=https://alwodouh.com
```

`PAYMENT_MODE` defaults to `test` when unset. `test` refuses an `sk_live_` key, and `live` refuses an `sk_test_` key. If the secret or the webhook secret is missing, both functions return **503** `not_configured` and the app does not grant a purchase.

`MOYASAR_PUBLISHABLE_KEY` is optional for this integration. Hosted invoices are created with the secret key. The publishable key is the one Moyasar.js would use in a browser; it is safe to expose, and this build does not. If you set it, it must match `PAYMENT_MODE`.

Deploy the two functions (the analyze workflow does not deploy them):

```bash
supabase functions deploy create-payment
supabase functions deploy moyasar-webhook --no-verify-jwt
```

`config.toml` already sets `verify_jwt = false` for `moyasar-webhook` and `true` for `create-payment`. Pass `--no-verify-jwt` on the webhook so the CLI does not override that.

In the app config (the inline `window.WODOUH_CONFIG` in `app/index.html`, documented in `supabase/config.example.js`), and only after the function is deployed:

```js
CREATE_PAYMENT_URL: "https://<project-ref>.supabase.co/functions/v1/create-payment"
```

The URL must be that exact path on the same project already named in the page's `connect-src`. Unset, the pay button stays the prototype and the account slot stays hidden.

## Webhook / الرابط

In the Moyasar dashboard, add a webhook:

| Field | Value |
|---|---|
| URL | `https://<project-ref>.supabase.co/functions/v1/moyasar-webhook` |
| Method | POST |
| Shared secret | the same string as `MOYASAR_WEBHOOK_SECRET` |
| Events | `payment_paid`, `payment_captured`, `payment_failed`, `payment_faild`, `payment_refunded`, `payment_voided` |

Moyasar's docs spell one failure event `payment_faild`. The handler accepts that spelling and `payment_failed`.

Moyasar puts the shared secret on the JSON body as `secret_token`. Verification is a constant-time compare of that field. It is not an HMAC header. After the compare, the function fetches `GET /v1/payments/:id` with the secret key and marks the order paid only when the fetched status is `paid` or `captured`, the currency is `SAR`, and the amount in halalas matches the order. A repeat delivery of the same event id returns 200 and does not grant twice.

`orders.moyasar_id` is the invoice id. `orders.amount` is halalas.

## Test cards / بطاقات التجربة

Sandbox only. Any future expiry, any 3-digit CVV, any cardholder name. The full list is [Moyasar's test cards](https://docs.moyasar.com/guides/card-payments/test-cards). These two succeed:

| Network | Number | Result |
|---|---|---|
| mada | `4201320111111010` | paid |
| Visa | `4111111111111111` | paid |

A failed card on that page (insufficient funds, declined) should leave the order unpaid.

How to walk it:

1. Set the secrets and `CREATE_PAYMENT_URL`, deploy both functions, register the webhook.
2. Sign in on the app. The account screen shows **ادفع عبر ميسر / Pay with Moyasar** with the catalogue prices.
3. Choose a plan. The request body is `{ plan_id, lang }` and nothing else.
4. Complete the invoice on Moyasar's page with a test card.
5. You return to the app. The order row becomes `paid` when the webhook has fetched the payment. Refresh once if the redirect wins the race.
6. With the URL unset, or with the secrets empty, the same button is absent or the function answers `not_configured`, and nothing is unlocked by a charge that did not happen.

`FREE_NOW` still opens every feature. The account note says payment is optional while that is true. Turning charging into the only door is a separate switch (`FREE_NOW` in `app/index.html`), not something this integration flips.

## Go-live checklist / قائمة التشغيل

Do these before `PAYMENT_MODE=live`. Until then the functions reject a live secret key.

1. Commercial registration (CR) and a bank account, completed with Moyasar. Sandbox does not require them; live does.
2. Ask Moyasar sales for the live percentage. Write that number down where the business keeps fees. Do not copy a guess into the product.
3. Replace the test keys with `sk_live_…` and `pk_live_…`.
4. `supabase secrets set PAYMENT_MODE=live`.
5. Point the live webhook at the same function URL, with the live shared secret.
6. Confirm `ALLOWED_ORIGIN` is `https://alwodouh.com` (live refuses an `http://` origin).
7. Pay a small live invoice with a real card, confirm the order row, then refund it from the Moyasar dashboard and confirm the row becomes `refunded`.
8. Decide separately whether `FREE_NOW` stays on. Live keys do not, by themselves, close the free doors.

## What this does not do

- It does not charge while the secrets are empty.
- It does not put the secret key in the browser.
- It does not renew Business monthly. One invoice is one month.
- It does not sell the upgrade difference. The paywall, when Moyasar is configured, says so instead of invoicing a number the server does not have.
- It does not revoke a local unlock on refund. The order status becomes `refunded`; entitlement in the browser was already a local record. Treat a refund as a support action until entitlement moves server-side.
