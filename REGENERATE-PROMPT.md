# Regeneration prompt — PULSE platform

Paste everything below the line into a fresh AI coding session to rebuild this
application from scratch.

---

You are a senior full-stack engineer. Build (and explain step by step as you
go) an internal web platform called **PULSE — Resident Experience Co.**: an
event management and customer-experience-journey operating platform for a
resident experience company serving premium residential compounds in Riyadh
(timezone Asia/Riyadh). It is used on phone and desktop by the operations
team, with strict role-based access enforced on the server.

== GOAL ==
One role-aware console that unifies: the team's daily shift work, customer
journey design and tracking (residents AND corporate clients), the full event
lifecycle with proof of exceptional outcomes, live event-day operations,
ticketing with QR check-in, per-event P&L, and management dashboards that
demonstrate satisfaction and journey success with real numbers.

== TECH STACK & HOW IT RUNS ==
- Node.js (>=20), Express 5 (ESM). Plain JSON files for storage (no database).
- React 19 + Vite front end. Single origin: Express serves the built client
  (dist/) AND /api on one port ($PORT, default 8787).
- Only light dependencies (express, react, vite, qrcode-generator). Optional
  Anthropic API for AI briefing text, deterministic fallback with no key.
- `npm install` then `npm start` (builds client, serves on localhost).
  `npm test` runs unit tests (node --test).
- Ships in stub mode with bundled fictional sample data, zero credentials.
- Also produce a SECOND build target: a fully self-contained single-file
  demo (vite config with one input, inlineDynamicImports) where an in-browser
  mock API (`window.__demoApi` hook in the fetch helper) implements every
  endpoint against in-memory copies of the seed data, importing the SAME
  server modules for the access matrix, redaction, SLA and scorecard math.
  Timestamps in the demo shift relative to a seed epoch so data is always
  "today". Demo session persists in sessionStorage. This file deploys to
  GitHub Pages / static hosting with zero external requests (no font CDNs).

== THE 11 MODULES (grouped sidebar) ==
Groups: Experience (Home, Shift, Journeys) · Events (Events, Live Ops,
Clients) · Community (Residents, Feedback, Cases) · Management (Experience,
Oversight).

1. Home — role-aware greeting + KPI command-center strip (events live, in
   planning, journeys at risk, new feedback, SLA at-risk, on duty, avg event
   score), auto-refreshing.
2. Shift — "Master of the Day": an AI/deterministic prioritized action plan
   synthesized from stub Slack/Gmail/Calendar signals plus live events,
   planning gaps, negative feedback and at-risk journeys; calendar conflict
   detection; shift checklist; task assignment; on/off-duty; handover with
   read-receipt; 15:00 meeting brief.
3. Journeys — Journey Designer: journey templates with stages and touchpoints.
   Two ship ready: "Resident Experience Journey" (Arrival & Welcome →
   Settling In → Engaged Living → Renewal & Advocacy, 3 touchpoints each) and
   "Client Event Journey" (Inquiry → Proposal → Planning → Event Day →
   Report & Renewal). Per-stage completion bars, avg satisfaction, traveler
   counts, and a rescue list of at-risk travelers (any touchpoint scored ≤3
   or current stage fully stalled).
4. Events — Event Studio: lifecycle concept → planning → ready → live →
   wrap-up → reported. Per event: planning checklist (owner + due date),
   run-of-show timeline, tickets tab, survey tab, P&L tab (financial roles
   only), and an auto-built Event Report with an "Exceptional" scorecard:
   score = round(avgCsat/5*60 + attendanceRate*30 + (has 5★ testimonials ?
   10 : 0)); tiers ≥90 Exceptional, ≥75 Strong, ≥60 Solid, else Needs review.
   Testimonials = 5★ survey comments.
5. Live Ops — event-day board (all roles): ready/live/wrap-up events with
   run-of-show and a NOW marker on the current moment, checklist and
   attendance counters, incident log (low/medium/high; open → mitigating →
   resolved) and a HIGH INCIDENT OPEN alert banner; 15s auto-refresh.
6. Clients — B2B pipeline: inquiry → proposal → planning → event-day →
   report-renewal; linked events with scorecards, satisfaction, next step,
   contract values (financial-redacted).
7. Residents — profile list with journey progress bars; a 360 view where the
   full journey map is interactive: toggle touchpoints done, score each 1–5;
   notes; linked feedback and cases; draft-only compose templates (welcome /
   event-invite / check-in) that never send.
8. Feedback — CSAT + sentiment, triage new → actioned → thanked / resolved /
   dismissed, optional link to an event, and a "→ Case" escalation that
   creates a linked SLA-tracked case (negative sentiment ⇒ high priority).
9. Cases — categories production/venue/experience/it/admin with SLA timers.
10. Experience — management dashboard: avg event score, Exceptional count,
    journeys completed, at-risk count, 14-day CSAT/NPS/event-rating
    sparklines, a testimonial wall, reported-events table, an inline Riyadh
    map with compound pins, and a per-compound board (CSAT, NPS, journeys
    on-track, events YTD + revenue/budget/spend for financial roles).
11. Oversight — live shift board across compounds: on duty, checklist
    progress, open tasks, live events, handover read state.

Shell: two-tier sticky header (wine brand bar with tracked serif "PULSE"
wordmark + "RESIDENT EXPERIENCE CO." subtitle; ambient strip with compound ·
time · date · Riyadh · access mode · tagline "The heartbeat of your
community."). Grouped sidebar collapsing to a hamburger drawer on phones.
Global ⌘K search (role- and scope-filtered on the server). Hash routing with
back/forward. Compound + date context bar. Installable PWA with offline
shell. Entrance animation on navigation only, never on background refresh.

== RBAC (enforced on the server, on every endpoint) ==
8 roles from an org chart in config: director (region scope), ops_manager
(portfolio), gm, agm, senior_rx, rx, production_manager, venue_manager (all
property scope). Access matrix:
- home, events, liveops: ALL roles.
- shift, journeys, residents, feedback: director, ops_manager, gm, agm,
  senior_rx, rx.
- cases: everyone EXCEPT venue_manager.
- clients, experience, oversight: director, ops_manager, gm, agm, senior_rx.
- FINANCIALS (revenue, cost, reserve, noi, budget, spend, contractValue,
  pipelineValue, b2bAccounts, budgetLines): director, ops_manager, gm, agm
  only — deep-stripped from every API response for others; budget writes
  return 403 below GM.
Default landing: director/ops_manager/gm → experience; agm → oversight;
senior_rx/rx → shift; production_manager/venue_manager → events.
Cross-compound requests return 403. Unknown signed-in emails get a locked
"no access" screen.

== ORG / DATA (ALL FICTIONAL — placeholder domain pulse.sa) ==
Compounds (Riyadh, only the first has live data; others "awaiting data"):
narjis-gardens "Narjis Gardens" (diplomatic & corporate, lat 24.8226 lng
46.6431), olaya-nine, hittin-hills, yasmin-grove, malqa-oasis.
Roster: Rania Kassem director@pulse.sa (Director); Amal Rashed (Ops Manager);
Omar Hadi gm.narjisgardens@ (GM); Sara Nasser (AGM); Lina Fares + Karim Saleh
(Senior RX); Noor Hamdan, Ziad Qassim, Maha Suleiman (RX); Fadi Mansour
production.narjisgardens@ (Events Production Manager); Huda Bakr
venue.narjisgardens@ (Venue Manager).
Seed sample data: 16 residents with journey progress and touchpoint scores;
4 corporate clients (Meridian Energy planning SAR 145k, Northstar Consulting
report-renewal SAR 98k with a reported family day, Deema Tech proposal,
Crescent Partners inquiry); 5 events across the lifecycle (2 reported with
surveys + 5★ testimonials + budget lines scoring Exceptional, 1 live run
club with pre-issued tickets partially checked in, 1 planning client dinner,
1 concept festival); feedback items incl. one negative welcome-kit complaint;
3 cases; shift state with duty/checklist/tasks/handover; stub Slack/Gmail/
Calendar signals containing one deliberate calendar overlap; per-compound
metrics (CSAT 4.6, NPS 52, journeyOnTrack 0.84, eventsYTD 18 + sample
financials) badged "sample"; 14-day CSAT/NPS/event-rating trend series.
Include a SECURITY-NOTE.md declaring all people and data fictional and that
no secrets are committed.

== WAVE-ONE FEATURES (must be included) ==
- Ticketing: issue named tickets with unique short codes; render a branded
  wine ticket card with a real QR (qrcode-generator, payload
  PULSE:eventId:code); check-in by code entry or tapping the ticket list;
  duplicate check-in returns 409; registered/checked-in counters update.
- Live Ops incidents as described above.
- Event P&L: budget lines {label, planned, actual} with inline actual
  editing, add-line, totals and variance; recompute event budget/spend on
  write; endpoint 403s for non-financial roles and budgetLines is redacted
  from reads.

== SLA ==
high 8h / normal 48h / low 120h; at-risk at 75% elapsed; done/resolved/
closed = met.

== SECURITY ==
Google Workspace SSO (domain-restricted, default pulse.sa) with opaque
server-side sessions AES-256-GCM encrypted at rest, key from SESSION_KEY env
or a keyfile OUTSIDE the app tree (~/.pulse-ops/). Dev-only test login
(roster picker), hard-off in production. Security headers (CSP, X-Frame-
Options DENY, HSTS on HTTPS), per-IP rate limiting, HTTPS enforcement
off-localhost in production. Atomic JSON writes (tmp+rename) with per-file
async locking, corrupt-file quarantine with seed restore, daily backups.
Append-only audit log of every mutating action (including ticket issue/
check-in and incidents). Draft-only compose; all external connectors
read-only stubs activated by env vars (ANTHROPIC_API_KEY optional).

== BRAND (PULSE identity guide) ==
Deep Wine #4A1620 (signature: header, active nav, primary CTAs, fills),
deeper wine #38101A (ambient strip), Cream #F3EBE0 (page), Ink #241014
(text), Warm White #FBF4EA (on wine), Rose-Taupe #9C7A78 (muted text/labels),
Aged Brass #8A6A3F (sparing accent: KPI top ticks, focus rings). Serif
display (Playfair Display, Georgia fallback) for headings and the tracked
all-caps wordmark; Inter/system sans for body. Wine splash sign-in screen
with an arch icon (two mirrored arches meeting at center, warm stroke on
wine rounded square — also the favicon/PWA icon) above the wordmark lockup
and italic tagline. Working UI on cream: centered 1200px content column,
paper-white cards with layered soft shadows and hover lift, brass focus
rings, tabular numerals in tables/KPIs, a faint arch watermark on the page
background, subtle entrance animation, reduced-motion respected. Alignment
rules: context-bar selects size to content; headerless tables may wrap text
(overflow-wrap: anywhere) so trailing buttons never clip; header lockup
never wraps (subtitle hides on small phones); journey checklist labels flex
with trailing score selects pinned. No emojis anywhere; no exclamation
points in copy; warm, direct, real-time voice ("— The PULSE team").

== TESTS & VALIDATION ==
Unit tests (node --test) covering: the exact access matrix incl. liveops for
all roles, financial redaction (incl. budgetLines, deep nesting), scoping
(director=all compounds, rx=one, unknown email=null), landing validity, SLA
window math, and storage (round-trip, locking under 25 concurrent updates,
quarantine, daily backup). After building, validate end-to-end in a real
browser: sign in as GM and as RX; verify the P&L tab exists only for GM,
ticket issue → QR renders → check-in increments → duplicate rejected, high
incident raises then clears the alert banner, and RX gets 403s on clients/
experience and cross-compound requests. Also validate the same paths against
the real server with curl (403/409/redaction/audit log).

== DEPLOYMENT ==
Multi-stage Dockerfile (build client → lean Node runtime serving dist + /api
on $PORT, DATA_DIR=/data volume). DEPLOY.md with: env var table
(NODE_ENV, TEST_LOGIN, GOOGLE_CLIENT_ID/SECRET, ALLOWED_DOMAIN, PUBLIC_URL,
SESSION_KEY, DATA_DIR, ANTHROPIC_API_KEY), Google Cloud Run me-central2
single-instance command with Secret Manager and a mounted volume, Render
alternative, OAuth redirect {PUBLIC_URL}/api/auth/google/callback, and a
production checklist. README summarizing the platform. Prioritize airtight
server-side RBAC and honest "sample data" badging over breadth.
