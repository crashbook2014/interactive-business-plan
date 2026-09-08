# Roadmap

What is announced in the product but not yet working, what is next, and what
has been decided against. A thing belongs here the moment the app tells a
reader it is coming — an announcement with no owner and no definition of done
is how "coming soon" turns into a lie told slowly.

**Rule for this file:** nothing is listed as shipped until it has done its job
once, for real, on a real device. Code that runs in a test is not a shipped
feature.

Last updated: 5 September 2026 — **launched**.

---

## Blocked on the founder — nothing moves until these do

Everything in this section is finished code waiting on an account, a payment,
or a signature. None of it can be unblocked from inside the repository.

| What | What is needed | Unblocks |
|---|---|---|
| **Twilio account** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either a Messaging Service SID or a From-number. Set as Supabase secrets, never committed. | Phone sign-in |
| **Apple Developer account** | ~$99/yr, then the provider configured in Supabase → Authentication → Providers → Apple | Apple sign-in |
| **Deploy `analyze`** | Supabase access, to redeploy the edge function. The repo now also carries the **contract answer tier** for "اسأل سؤالك" — a fourth tier graded by checking every quote for containment in the document the reader sent — and the `CR_SCHEMA` asks the model for `obligations` and a `topic` on every finding; **production is still on version 6, which knows about neither**, so a real contract gets no obligations section until this is done. Nothing breaks in the meantime — the client renders a v6 response exactly as it did before, and `test/contract-review.test.js` asserts that against the literal v6 shape. | Contract-grounded answers, obligations, and dispute-ordering for pasted contracts. **Runbook: `docs/deploy-analyze.md`** — the bundle is verified by `test/deploy-bundle.test.js`, which prints the exact file list. |
| **Legal review** | Read the rewritten *Accounts* sections of `/terms/` and `/privacy/` in both languages and say whether the wording stands. **Two things changed under this row in Sept 2026 and need reading with it:** the ask-consent copy now describes *three* tick boxes rather than two — the third sends the contract's own text to be quoted back — and the privacy page still states that a photo or scan is never uploaded, which stops being true the day scan reading ships. | Publishing the current gate copy |

Both sign-in methods are announced in the app right now, as disabled buttons
marked *قريبًا*. That promise is live and ageing from today.

Photograph-the-contract is announced the same way, on the intake screen. It
needs no account and no payment — only the client work described below.

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

### Reading a photographed or scanned contract

- **State:** the SERVER side is built and deployed. `analyze` accepts an
  `upload` reference, resolves it against the caller in `resolveUpload()`, and
  sends the file to Claude as a document block; the grader is told the source
  is a scan so it drops every unattested figure. None of that is wired to the
  app.
- **Blocked on:** client work only. The intake screen needs to capture or pick
  an image, POST it to the `upload` function, and pass the returned row id to
  `analyze` — plus the consent step, because this is the one path where the
  file itself leaves the device.
- **Done when:** a photograph of a paper contract taken on a real phone comes
  back with real findings.
- **Why it matters:** a large share of this product's readers have their
  contract on paper or as a photo, not as text they can select and copy. Today
  they are told to type it out.
- **The copy that has to move with it:** `/privacy/` and the account screen
  both currently state that a photo or scan is NOT uploaded and that the reader
  is asked to paste instead. That is true today and becomes false the moment
  this ships. It is a privacy promise, so it needs the founder's review, not a
  quiet edit.

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

- **Launch** (5 Sept 2026) — the curtain is up. `/app/` opens with no
  `#preview` key. `soon.test.js` now reads the flag and asserts whichever side
  is shipped, so un-launching stays a one-line change with test cover, tested
  green in both directions.
- **Everything is free** (5 Sept 2026) — `FREE_NOW` opens every entitlement
  from one switch. This is also what made launching defensible: the launch
  checklist's own blocker was that launching with payments off shows strangers
  a paywall that cannot take money, and now no paywall renders at all.
- **AI contract analysis, verified live** (5 Sept 2026) — `analyze` deployed as
  version 6 with the fail-closed limiter, and confirmed working on the live
  site by the founder: a real contract returned real findings.
  What that single check actually proves, since the function imports
  `corpus.json`, `grade.mjs` and `review-contract.mjs` at module load: all
  four files are structurally intact — invalid JSON or a syntax error in
  either grader would have stopped it booting at all — `checkLimit` returned
  "allow", so `SUPABASE_URL`, the service key and `bump_rate_limit` are all
  reachable in production, and CORS matches the live origin.
  What it does NOT prove: that the legal register's CONTENT is byte-perfect. A
  transposed digit still parses. The `ask` feature is what exercises those
  rows — see below.

- **Navigation is intention** (Sept 2026) — the signed-out tab bar carried all
  five tabs and three of them (home, timeline, account) bounced the reader
  straight to sign-in. Five doors, two that opened. The bar now renders only
  the tabs that open, and the account slot becomes an explicit *sign in* door,
  so reaching that screen is a choice rather than a rebound. `authRedirect()`
  is unchanged and still catches deep links. `test/nav-intent.test.js` presses
  every visible tab in both languages and fails if any of them lands on
  sign-in. The same commit stopped the two *قريبًا* buttons being faded to .55
  opacity — they now read as unavailable structurally, with their words at
  full contrast.

- **The fake camera is gone** (Sept 2026) — the intake screen offered
  "Photograph it" as a live button beside Upload. It opened a camera screen
  whose viewfinder was a styled `div` with four corner brackets and no
  `getUserMedia` anywhere, and whose shutter captured nothing: pressing it
  revealed a note admitting the feature "isn't enabled in this prototype".
  A reader spent two taps and a moment of hope to be told that. The button now
  carries the same disabled-and-badged treatment as the unbuilt sign-in
  methods, the screen and its functions are deleted rather than merely
  unadvertised, and the feature is listed above where it can be held to
  account.

- **A copy key was overwriting another one** (Sept 2026) — `ph_title` was
  declared twice in the dictionary: once for the phone-number screen and once,
  sixty lines later, for the photo screen. A duplicate key in an object
  literal is not an error; the second silently wins. So the screen that asks a
  stranger for their mobile number was headed "Photograph the contract" in the
  shipped build, in both languages. Deleting the photo screen resolved it, and
  `test/copy-keys.test.js` now fails the build on any collision.

- **The free scan showed the first clause, not the worst one** (Sept 2026) —
  the sort that picks the single flag a free reader sees read its severities
  from a map keyed `{bad, warn, ok}`, while every clause in the app is `red`,
  `amber` or `green`. The lookup was undefined on all of them, every clause
  ranked equal, and the sort did nothing. It stayed accidentally right only
  because the samples are authored red-first and `analyzePasted()` sorts before
  returning — either could have changed and a reader would have been shown a
  green clause as the one finding on a contract with a red flag in it. Guarded
  now with contracts written down backwards and shuffled.

- **Our name is off the reader's letters** (Sept 2026) — «أُعدّ بمساعدة وضوح»
  was printed on the employer letter and the demand letters, which are signed
  in the reader's name and handed to the other side. It told a landlord or an
  employer that the letter came out of an app, and it was our branding on
  someone else's correspondence. The case documents keep it: provenance is
  useful on a working file that reaches a lawyer.

- **Email sign-in by one-time code** — no password path, by design.
- **Google sign-in.**
- **The sign-in gate** (Sept 2026) — an account is required for everything
  except the end-of-service calculator and the rights library, which are
  deliberately left open. First shipped covering every screen including the
  calculator; narrowed within a day, because the two open surfaces are what
  make the free proposition true rather than merely claimed. The decision and
  what it cost are in `docs/pricing.md`.
- **The account is disclosed in the tour** (Sept 2026) — a note above the final
  onboarding button, in the same words the sign-in screen uses. Without it the
  tour ended on "check my contract free" and the next screen asked for an
  account, which is a bait-and-switch even though both statements are true.
- **The onboarding footer stays on screen** (Sept 2026) — a pre-existing bug
  found while placing that note: the tour's advance button was rendering below
  the viewport on the last card (English at 390×844, both languages at
  360×640), reachable only by scrolling a screen that gives no sign there is
  anything below it. Guarded now at three small viewports in both languages.

---

## Known, not scheduled

Real, worth doing, nobody is doing it yet. Listed so it is a decision rather
than an oversight.

- **No signed-out reader has ever been observed using this build.** Every claim
  about where the gate feels earned is reasoning, not evidence. The first real
  users are the test.
- **The legal register has not been verified since the version-6 deploy.** Its
  29 rows were hand-transcribed into the deploy call, and while the function
  boots (so the JSON parses), nothing has yet checked that an article number or
  a riyal figure did not change in transit. Asking a question through "اسأل
  سؤالك" that returns a *verified*-tier answer with a citation would exercise
  those rows against the real register. Worth doing once.
- **The iOS runbook has still never been run on a real iPhone.**
  `docs/ios-test-runbook.md`. Every automated test to date is headless
  Chromium on Linux.
