# Moving to Cloudflare Pages

Two reasons to do this, one of them free and one of them structural:

1. **A private repo can serve the site.** GitHub Pages needs a paid plan for
   that; Cloudflare Pages does it on the free tier. `docs/legal-sources.md` —
   the verified register — should not be public.
2. **Response headers become possible.** GitHub Pages cannot send one. That
   limitation is why `app/sw.js` is held closed by its own source code and
   nothing else, and why `frame-ancestors` and HSTS do not exist on the site
   today. `_headers` in the repo root fixes all three the moment Cloudflare
   serves the site — and `test/headers.test.js` already proves it is not
   weaker than the `<meta>` tags it reinforces.

**Do this on a weekday morning. Not at night, not in a hurry, and not on the
same day you launch.**

---

## ⚠️ Read this before anything else — your email

`Abdulelah@alwodouh.com` depends on DNS records at IONOS. Moving nameservers
to Cloudflare moves **all** of your DNS. If the MX records do not come across,
**email stops arriving** — and it fails silently. The website will look fine.
You find out when someone says "I emailed you last week."

**Before you touch anything:**

1. Open the IONOS DNS panel for `alwodouh.com`.
2. **Screenshot every record.** Not just the ones you recognise.
3. Write down, specifically: every **MX** record with its priority, every
   **TXT** record (SPF looks like `v=spf1 ...`, DKIM sits on a name like
   `default._domainkey`), and any **CNAME** used by mail or a verification.

Cloudflare's import usually picks these up. "Usually" is not good enough for
the address printed on your own website — check the imported list against your
screenshots before you switch nameservers.

---

## The order that means no downtime

The site stays up throughout because GitHub keeps serving it until the very
last step, and by then Cloudflare is already serving the identical files.

### 1. Make the repo private

GitHub → repo → Settings → General → bottom → Change visibility → Private.

Do this **first**. It is the urgent part; hosting is not. The GitHub Pages
site will stop working — that is expected and it is why step 2 comes next in
the same sitting.

### 2. Create the Pages project

Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
Authorise the GitHub app for the now-private repo.

Build settings — **all three of these are important**:

| Setting | Value |
|---|---|
| Framework preset | **None** |
| Build command | *(leave empty)* |
| Build output directory | `/` |

There is no build step. This repo is static files served as they are; a build
command is how you end up with an empty site.

Cloudflare deploys and gives you a `something.pages.dev` URL.

### 3. Check the `.pages.dev` URL before going near DNS

- The landing page loads, in Arabic, with the pre-launch framing
- `something.pages.dev/app/` **redirects back to the landing page** (the curtain)
- `something.pages.dev/app/#preview` opens the full app
- In DevTools → Network → click the document → Headers, confirm
  `strict-transport-security` and `content-security-policy` are now **response
  headers**, not just meta tags

That last check is the whole point of the move. If the headers are not there,
`_headers` is not being read — stop and fix that before touching DNS.

### 4. Add the custom domain, then move DNS

Pages project → Custom domains → Set up a domain → `alwodouh.com`.

Cloudflare will ask you to move the domain onto its nameservers and will give
you two nameserver addresses. At IONOS, replace the existing nameservers with
those two.

**Then, in Cloudflare's DNS panel, verify your MX and TXT records from step 0
are all present.** Add anything missing before you walk away.

Propagation takes anywhere from minutes to a few hours. During it, some
visitors reach GitHub Pages and some reach Cloudflare. Both serve the same
site, so nobody sees anything broken.

### 5. After it has propagated

- `alwodouh.com` loads over HTTPS with a valid certificate
- The response headers are present on the real domain
- Send yourself an email at `Abdulelah@alwodouh.com` **and confirm it arrives**
- `CNAME` at the repo root is now dead weight — Cloudflare does not read it.
  Leave it or delete it; it changes nothing either way.

---

## What changes about how you work

Nothing. Cloudflare Pages watches the same repo and redeploys on every push to
`main`, exactly as GitHub Pages did. `npm test` is unchanged, the pre-push gate
is unchanged.

---

## What to do afterwards, not during

Two follow-ups that only make sense once the headers are real. **Neither is
true yet, so neither has been written into the code.**

1. **`app/sw.js` currently says** *"there is no second line of defence here...
   If the site ever moves somewhere that can set headers, send
   `Content-Security-Policy: connect-src 'none'` on this file and the claim
   becomes structural instead of editorial."* Once Cloudflare is serving the
   site, that comment should be rewritten — and `test/pwa.test.js`, which
   currently frames the worker assertion as a source review rather than proof
   of enforcement, can assert the header instead. Tell me when the migration is
   done and I will make both changes.

2. **Cloudflare Workers could replace the Supabase Edge Function** for the AI
   and, later, for the payment gateway — one vendor instead of two, plus AI Gateway for
   cost visibility. But `supabase/` already holds two migrations and a webhook
   function. **Do not move the backend because you moved the hosting.**
   Cloudflare Pages in front and Supabase behind is a perfectly good
   arrangement and it is the smaller change.

---

## If something goes wrong

**The site is down after the DNS change.** Point the nameservers back at IONOS.
Propagation reverses the same way it applied.

**Email stopped.** Compare Cloudflare's DNS list against your step-0
screenshots and re-add the missing MX records. Mail queues and retries for
hours or days, so messages sent during the gap usually still arrive.

**The site loads but looks unstyled.** The build output directory is wrong.
Set it to `/` and redeploy.

**Everything works but there are no response headers.** `_headers` must be at
the **repository root**, which is where it is. Confirm the build output
directory is `/` and not a subfolder.
