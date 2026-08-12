# Deployment — hosting, domain, rollback, verification

Completes the parts of the deployment question the Zid runbook does not cover.
`docs/zid-test-runbook.md` covers taking money. This covers serving the app.

**Verified in this environment:** the git and shell commands below, and the
Pages build status via the GitHub API. **Not verified:** anything requiring a
request to an external host — the sandbox proxy refuses `CONNECT` to
`github.io` and to vendor sites with a 403, so no live page was fetched and no
vendor pricing page was read while writing this. Where a vendor's terms matter
to your decision, check them yourself rather than taking a figure from here.

---

## Zid cannot host this

Settled, and not re-litigated: **Zid is an e-commerce platform, not a web
host.** It runs a storefront. It cannot serve a single-page application at your
own path, and there is no upload target for `app/index.html`.

What it *can* do is take the money. That is exactly the split the runbook
uses: Wodouh is served from Pages, the buyer pays on Zid, and a code bridges
the two. The same is true of Salla.

---

## Where this is served today

**GitHub Pages, from `main`, at the repository root.**

| | |
|---|---|
| App | `https://alwodouh.com/app/` |
| Landing | `.../` |
| Brand | `.../brand/` |
| Root `/` | The unrelated PULSE business plan — see the audit, L4 |

Every push to `main` triggers a `pages build and deployment` run. The last one
(`72cbeb2`) completed **success** at 15:14 UTC on 2 August 2026, checked
through the GitHub API rather than by loading the page.

**This is a good fit and there is no urgent reason to move.** The app is three
static files and two fonts, with no build step, no server code and no
database. Pages serves that well and free.

### The two things Pages cannot do

1. **No custom response headers.** `frame-ancestors` and HSTS cannot be set,
   so they ship as meta tags where the platform allows and not at all where it
   does not. This is the structural reason Security scores 12/15 rather than
   higher in the audit.
2. **No server-side anything.** No redirects with logic, no rate limiting, no
   payment verification. The redemption codes are browser-side *because of
   this*, which is why they are documented as not secure.

### When moving hosts would actually be justified

Only when one of those bites:

- **You need real payment verification.** That needs a server. At that point
  the Supabase Edge Functions in `supabase/` are the path already scaffolded,
  and the host question follows from it rather than leading it.
- **You need response headers.** Cloudflare Pages and Netlify both serve
  custom headers on static sites; Pages does not. This alone is not worth a
  migration today.
- **You are advertising.** Then you want a custom domain and analytics, and
  the header question arrives with them.

Until then, migrating costs a day and buys nothing a user would notice.

---

## Custom domain — alwodouh.com

**Done in the repository, on 12 August 2026.** `CNAME` holds `alwodouh.com`,
and every absolute URL in the product — canonical, `og:url`, `og:image`,
`twitter:image`, `robots.txt`, `sitemap.xml`, `REDIRECT_URL`, `test:live` —
points at it. `test/pwa.test.js` asserts they all share one origin **and that
the origin matches the CNAME file**, so the next domain move cannot leave a
forgotten URL pointing at an address the site no longer answers on.

### What is left, and only you can do it

**1. DNS.** At the registrar for `alwodouh.com`:

| Type | Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `crashbook2014.github.io` |

Those four addresses are GitHub's published Pages anycast set. An earlier
version of this file said not to use A records because "they have changed
before" — that advice was wrong for an apex domain, which cannot hold a CNAME
at all. If your registrar offers `ALIAS`/`ANAME` at the apex, that is the
better option and points at `crashbook2014.github.io`.

**2. Repository → Settings → Pages → Custom domain.** Enter `alwodouh.com`.
GitHub verifies DNS and may rewrite the `CNAME` file — that is expected and it
already holds the right value.

**3. Wait for the certificate**, then tick **Enforce HTTPS**. Provisioning is
usually minutes and can take up to 24 hours. Until it completes the site is
reachable over HTTP and the padlock is missing; that is normal and not a
failure.

### What breaks the moment the domain switches

- **Installed home-screen apps are tied to the old origin.** Anyone who added
  Wodouh to their home screen from `crashbook2014.github.io` keeps pointing
  there. There are none yet beyond your own test, but there will be after
  launch — so switch domains before anyone installs it, not after.
- **`localStorage` does not follow.** Entitlements, saved contracts and tracked
  deadlines are per-origin. Again: no real users yet, which is the whole reason
  to do this now.
- **The old URL keeps working.** `crashbook2014.github.io/interactive-business-plan`
  continues to serve until Pages redirects it to the custom domain, which it
  does automatically once the domain is verified.

---

## Rollback

Every deployed state is a commit on `main`, and Pages rebuilds from whatever
`main` points at. So rollback is a git operation and nothing else. Verified:
`9998bb7` is still reachable and still yields the 339,728-byte `app/index.html`
that was live before this audit's changes.

**Preferred — revert forward.** Keeps the history honest about what happened:

```
git revert --no-edit <bad-sha>
git push origin main
```

**Faster, when the last push is plainly wrong and nothing has landed on top:**

```
git reset --hard <last-good-sha>
git push --force-with-lease origin main
```

`--force-with-lease` rather than `--force`: it refuses if someone else has
pushed since you fetched, which is the whole point.

**Recovering a single file** — usually enough, since one file is the product:

```
git checkout <last-good-sha> -- app/index.html
git commit -m "Roll app back to <sha>"
git push origin main
```

Redeployment takes about a minute. There is no cache to purge and no build to
invalidate.

**Known-good SHAs**

| SHA | State |
|---|---|
| `9998bb7` | Before the August audit — the last state with the 18.5× year-typo defect present. Roll back *past* this, not to it, if the reason is a calculation |
| `72cbeb2` | Current: all ten audit fixes, 60-assertion surface suite |

---

## Post-deploy verification

Run after every deploy. It takes under a minute and it is the only check that
runs against what users actually get.

**1. The three pages load.**

```
for u in app web brand; do
  printf '%s ' "$u"
  curl -s -o /dev/null -w '%{http_code}\n' "https://<host>/$u/"
done
```

Three `200`s. Anything else stops the deploy.

**2. The change you shipped is actually in the served file.**

The one people skip, and the one that catches a deploy that silently served a
stale build:

```
curl -s "https://<host>/app/" | grep -c '<a string unique to this change>'
```

Non-zero. This is how you tell "the build succeeded" apart from "the build
succeeded and shipped your change".

**3. The suites pass against the deployed copy**, not just your working tree:

```
npm run test:live
```

That runs every suite against the live URL rather than localhost. CI
already ran them against the working tree on push — this is the one that proves
the thing actually serving to people is right.

**3b. Walk the deployment.**

```
node test/watchdog.js https://<host>
```

Different job from the suites: they prove the code is correct, this proves the
deployment is. It checks the app's JavaScript actually initialised, that no
request failed, that there are **zero off-origin requests**, and that a known
worked example still produces the exact figure it should — recomputed inside
the watchdog rather than agreed with. It runs on a schedule anyway; running it
by hand after a deploy just means you find out now instead of within six hours.

**4. One human pass on a phone.** Paste a contract, reach a decision, open the
letter, switch language. Programmatic checks have never caught a layout that is
merely wrong-looking.

**What none of this covers:** real Safari and iOS. The audit says so and it
remains the largest untested surface — PDF intake requires Safari 16.4+ and has
never run on Apple hardware.
