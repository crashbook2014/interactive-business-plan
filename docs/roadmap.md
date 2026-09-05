# Roadmap

What is announced in the product but not yet working, what is next, and what
has been decided against. A thing belongs here the moment the app tells a
reader it is coming — an announcement with no owner and no definition of done
is how "coming soon" turns into a lie told slowly.

**Rule for this file:** nothing is listed as shipped until it has done its job
once, for real, on a real device. Code that runs in a test is not a shipped
feature.

---

## Announced in the app, not yet working

These appear on the sign-in screen as visible, disabled buttons marked
*قريبًا / Not yet available*. They cannot be pressed, so they cannot fail — but
they are a promise, and this section is what makes that promise accountable.

### Apple sign-in

- **State:** built, switched off. `APPLE_SIGNIN` is absent from config, which
  means off.
- **Blocked on:** an Apple Developer account (~$99/yr), then the provider
  configured in Supabase → Authentication → Providers → Apple.
- **Done when:** a real Apple ID signs in on a real iPhone and lands on home.
- **Why it matters:** a large share of this product's readers are on iOS, where
  Apple sign-in is the expected default and its absence reads as an unfinished
  app.
- **Turn it on:** set `APPLE_SIGNIN: true` in `WODOUH_CONFIG` (`app/index.html`).
  `renderAppleAuth()` promotes the button from announcement to working door on
  that one flag plus the project's own settings answer.

### Phone sign-in by SMS code

- **State:** built and tested against stubs (`test/phone-auth.test.js`),
  switched off. `PHONE_SIGNIN` is absent from config, which means off.
- **Blocked on:** a Twilio account. Needs `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, and a Messaging Service SID (or a From-number), set as
  Supabase secrets — never committed.
- **Done when:** a code arrives on a real Saudi handset and signs that number
  in. Not before: every message costs money, and a form that cannot deliver is
  a dead end.
- **Why it matters:** it is the door for a reader who has a mobile number and no
  email address they check — which, for this product's audience, is not a small
  group.
- **Turn it on:** the ordered steps are written in `app/index.html` at the
  `PHONE_SIGNIN` comment, and the secret names in `supabase/config.example.js`.
- **Note:** Saudi mobiles only, deliberately. See `normalizeSaudiPhone()` in
  `app/auth.js` for why a sign-in number is held to a stricter rule than a
  contact number.

---

## Decided against, for now

Recorded so the same question is not re-opened from scratch every few months.

### WhatsApp OTP instead of SMS

Considered as the delivery channel for sign-in codes, since WhatsApp is how
this audience actually communicates. Not pursued: it requires the WhatsApp
Business Platform and Meta template approval, which is materially more setup
and more ongoing surface than plain SMS for the same six digits. Revisit if SMS
deliverability or cost turns out to be a real problem in practice, rather than
a theoretical one.

---

## Shipped, kept here for the record

- **Email sign-in by one-time code** — no password path, by design.
- **Google sign-in.**
- **The sign-in gate** — an account is required for everything except the
  end-of-service calculator and the rights library, which are deliberately left
  open. The decision and what it cost are in `docs/pricing.md`, September 2026.
