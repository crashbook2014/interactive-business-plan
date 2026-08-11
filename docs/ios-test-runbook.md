# iOS test runbook

**Run this on a real iPhone before you tell anyone the app exists.**

## Why this is a document and not a test

Every automated check in this repository runs headless Chromium on Linux. That
is a good browser and it is not the browser your readers use. Three things in
Wodouh depend on Safari specifically:

- **PDF text extraction** uses `DecompressionStream`, which needs **Safari
  16.4+** (iOS 16.4, March 2023). Below that the app should fall through to its
  unreadable-file path, not break.
- **Home-screen install** is the whole point of the last change, and Safari
  ignores most of the manifest — it reads the `apple-*` tags instead.
- **The safe areas.** `viewport-fit=cover` puts the page under the notch and the
  home indicator. Getting that wrong looks broken in a way no test catches.

I have no Apple hardware and cannot run any of this. I would rather hand you a
checklist than report a check that never ran.

Takes about 20 minutes. Do it once now, and again after any change to intake,
the paywall, or the shell.

---

## Before you start

- An iPhone on **iOS 16.4 or newer** (Settings → General → About → Software
  Version). If you can also borrow something older, do — that is the fallback
  path, and it is the one most likely to be wrong.
- Safari, not Chrome. Chrome on iOS is Safari underneath but cannot install to
  the home screen, which is half of what you are testing.
- A real employment contract as a **PDF**, and one as a **photo**.
- Both languages. Half of these steps only fail in one of them.

---

## 1. Install

| # | Do | Expect |
|---|---|---|
| 1.1 | Open the site in Safari | The install hint appears on the home screen, in Arabic |
| 1.2 | Read the hint | It names the **share button** and **Add to Home Screen** — if the wording does not match what you see on screen, the copy is wrong, not you |
| 1.3 | Share → Add to Home Screen | The suggested name is **وضوح**, and the icon is the teal lens — not a screenshot of the page |
| 1.4 | Look at the icon on the home screen | Rounded the way iOS rounds every icon. No white box, no dark ring inside the corners, mark not clipped |
| 1.5 | Open it from the home screen | **No Safari address bar.** If you can see a URL, `apple-mobile-web-app-capable` is not being read |
| 1.6 | Look at the top and bottom | Background colour reaches under the clock and under the home indicator. No white strip |
| 1.7 | Tap "Got it" on the hint, then reopen | The hint does not come back |

**If 1.5 fails,** everything after it is still worth doing, but say so — an
install that opens in a browser is the difference between an app and a
bookmark.

## 2. Offline — the reason any of this was built

| # | Do | Expect |
|---|---|---|
| 2.1 | With the app open, enable **Airplane Mode** | Nothing changes |
| 2.2 | Force-quit the app, reopen it, still in Airplane Mode | **It opens.** Fonts correct, Arabic correct, no browser error page |
| 2.3 | Run a full termination assessment offline | Every figure computes. This app never needed a network to do it |
| 2.4 | Turn the network back on, pull to refresh | Still fine, no duplicate state |

## 3. Reading a contract

| # | Do | Expect |
|---|---|---|
| 3.1 | Upload a **text-based PDF** | Clauses are found; the score screen appears |
| 3.2 | Upload a **scanned/image PDF** | The "we could not read this" screen — **not** a crash, not an empty score |
| 3.3 | Photo intake, real contract | The photo path explains plainly that Wodouh does not read the image |
| 3.4 | Paste text directly | Same result as 3.1 |
| 3.5 | **On an older iPhone (iOS < 16.4)**, upload a PDF | The unreadable-file screen, with a way forward. Never a blank page or a spinner that never ends |

## 4. The money screens

| # | Do | Expect |
|---|---|---|
| 4.1 | Reach the termination paywall | "What paying unlocks" lists what was found. **No riyal figure anywhere** |
| 4.2 | Read the pay button | It names what it sells — "Show my assessment", not "Get my letter" |
| 4.3 | Check the footer | "Prototype — no real payment happens", and **no refund promise** beside it |
| 4.4 | Buy the cheaper tier, then open the case file | An upgrade priced at the difference, not a dead button and not a free handover |
| 4.5 | Case-file price | **245 SAR** |
| 4.6 | Switch to English mid-flow | Nothing navigates away; every figure is identical |

## 5. Arabic and RTL

| # | Do | Expect |
|---|---|---|
| 5.1 | Every screen in Arabic | Text right-aligned; back arrows point right; no Latin numerals in Arabic prose |
| 5.2 | Rotate to landscape | Nothing overlaps the notch |
| 5.3 | Settings → Accessibility → Larger Text, near maximum | Nothing clipped; no button becomes unreachable |
| 5.4 | Settings → Accessibility → Reduce Motion, on | Screens change without sliding |

## 6. VoiceOver

Programmatic accessibility checks pass. That is necessary and not sufficient —
this is the part no automated check can do.

| # | Do | Expect |
|---|---|---|
| 6.1 | Turn on VoiceOver, open the app | The first thing announced is meaningful, not "button" |
| 6.2 | Swipe through the home screen | Every control announces what it does |
| 6.3 | Reach a score | The number and the decision are both announced, not just the number |
| 6.4 | Reach the money summary | Each line's amount **and its source** are reachable |

---

## Reporting what you find

For each failure write down: the step number, the iOS version, the language,
and what you saw instead. A screenshot beats a description. Anything under
**§4** is urgent — that is money and trust. Anything under **§2** means the
offline shell is not doing its job and should be treated as a broken build.

Add fixed items to `test/pwa.test.js` where a headless browser could have
caught them. Where it could not, they stay here — that is what this file is
for.
