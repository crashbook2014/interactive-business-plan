# Selling through Zid — paid test runbook

How to charge real money for the negotiation letter without building a
payment integration. Sized for a test of roughly 5–50 buyers.

---

## Read this first

**This is not a payment system and it is not secure.**

The code check happens in the buyer's own browser. Anyone willing to open the
developer tools can set `pwPaid = true` and skip the paywall entirely. Storing
hashes rather than plaintext only stops the page from *listing* working codes;
it does not make the gate hold.

That is a deliberate trade. For a test whose purpose is to learn whether people
will pay at all, it is fine — the people who bypass it were never going to pay,
and there are few enough buyers that the loss is nil. As a launch mechanism it
is not acceptable, and it must be replaced with server-side verification
(Moyasar, Tap, or the Supabase functions in `supabase/`) before any real
volume.

**Do not describe this to anyone as a payment integration.**

---

## Setup

### 1. Generate codes

```
node test/make-codes.mjs 30
```

Two blocks are printed. The **plaintext codes** go to Zid. The **hashes** go
into the app.

Codes look like `WD-4T2A-EEXG`. The alphabet excludes `O/0` and `I/1/L`
because buyers will be typing them off a phone screen.

### 2. Arm the app

Paste the hashes into `REDEEM_HASHES` in `app/index.html`:

```js
const REDEEM_HASHES = [
  "7b440336809c2ac3",
  ...
];
```

**It ships empty.** While the list is empty the redemption UI does not render
at all, so an un-armed build cannot be unlocked by anything.

Commit the change, push, and let Pages deploy.

### 3. Never commit the plaintext codes

They go to Zid and to buyers. Keep them out of the repo. `.gitignore` already
covers `.env` and key material; if you save the list locally, save it outside
the working tree.

### 4. Create the Zid product

- **Product:** "خطاب التفاوض — وضوح" / "Wodouh negotiation letter"
- **Price:** 65 SAR, matching the in-app price exactly. A mismatch here is the
  fastest way to lose the trust the product is built on.
- **Type:** digital / no shipping
- **Delivery:** the code. If Zid can attach a per-order digital item, use one
  code per unit. If not, send it manually after each order — at this volume
  that is a few minutes a day.

---

## What the buyer does

1. Uses Wodouh free, reaches the paywall
2. Buys on your Zid store
3. Receives the code
4. Returns to Wodouh → **"Bought from the store? Enter your code"** → enters it
5. The letter opens

The redemption route lands in exactly the same place the simulated payment
does, so there is one path to the paid state rather than two that can drift.

---

## Known limits, stated plainly

| Limit | Consequence |
|---|---|
| Checks run in the browser | Bypassable by anyone who reads the JavaScript |
| Redemption is recorded per device | The same code works again on another phone. One-code-one-use needs a server |
| Clearing site data clears redemption | A buyer who clears storage must re-enter their code. Tell them to keep it |
| Manual code delivery | Fine at this volume, breaks past ~50 orders |
| No refund path in-app | Handle refunds through Zid |

---

## What to actually measure

The transaction is not the point. The point is what it tells you.

1. **How many reach the paywall** versus complete an analysis — is the letter
   even wanted?
2. **How many buy** after reaching it
3. **How many redeem** after buying — a gap here means the hand-off is broken,
   not that the product failed
4. **What they say** when they hesitate. This is worth more than the
   conversion rate at this sample size.

At 5–50 buyers you will not get a statistically meaningful conversion rate.
You will get something better: the specific sentence people say just before
they decide.

---

## When to stop using this

Replace it the moment any of these is true:

- More than ~50 buyers
- You start advertising
- Someone bypasses it and you notice
- You want subscriptions, refunds, or receipts

At that point the honest options are Moyasar or Tap in-app, or standing up the
Supabase functions and having Zid webhooks unlock server-side.
