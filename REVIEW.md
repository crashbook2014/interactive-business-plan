# PULSE — Review note

## What is done

All 12 modules are implemented and working end-to-end: Home (role-aware KPIs +
auto-refreshing command center), Shift (briefing with conflict detection,
checklist, tasks with assignment, on/off-duty, handover with read-receipt,
15:00 meeting brief), Units (RACK board with status changes), Moves (30-point
release checklist), Housekeeping (arrivals-first turn board with mark-clean),
Maintenance (work orders, categories, priorities, assignee dropdown, SLA timers
8h/48h/120h with at-risk at 75%), Cases (SLA-tracked, linkable to feedback),
Residents (lifecycle stages, onboarding milestones, notes, 360 view, draft-only
compose), Feedback (CSAT + sentiment, triage steps, → Case escalation), Events
(RSVP + attendance), Operations (per-property board on an inline Riyadh map,
weighted roll-up, B2B accounts, 14-day trends), Oversight (live shift board).

Shell: two-tier sticky header with ambient strip, grouped sidebar with mobile
drawer, ⌘K search (scope- and role-filtered on the server), hash routing with
back/forward, property + date context bar, installable PWA with offline shell,
entrance animation on navigation only.

Security: server-side RBAC on every endpoint, financial redaction below GM,
per-property 403 scoping, no-role lock screen, opaque sessions AES-256-GCM
encrypted at rest with the key outside the app tree, CSP / X-Frame-Options /
HSTS, per-IP rate limiting, HTTPS enforcement off-localhost in production,
atomic writes + per-file locking + corrupt-file quarantine + daily backups,
append-only audit log of every mutation. 13 unit tests cover the access
matrix, redaction, scoping, SLA math, and storage; all pass.

## Sample vs live

| Data | State |
|---|---|
| Narjis Gardens occupancy / RACK | Bundled stub, badged; goes live when `SHEETS_OCCUPANCY_ID` is set (read-only) |
| Revenue / cost / reserve / NOI / B2B | **Sample**, badged; live when Yardi connects (`YARDI_API_KEY`) |
| CSAT / feedback / trends | **Sample**, badged, until surveys connect |
| Slack / Gmail / Calendar signals | Bundled stub; briefing is deterministic unless `ANTHROPIC_API_KEY` is set |
| Other 4 Riyadh properties | "Awaiting data" throughout |

All connectors are read-only. Nothing is ever sent, edited, or deleted in an
external system; the resident compose tool is draft-only by design.

## Access matrix (enforced server-side; verified by tests + manual 403 checks)

| Module | director | ops_mgr | gm | agm | senior_rx | rx | maint_mgr | hk_mgr |
|---|---|---|---|---|---|---|---|---|
| Home, Units, Moves | ● | ● | ● | ● | ● | ● | ● | ● |
| Shift, Residents, Feedback, Events | ● | ● | ● | ● | ● | ● | — | — |
| Housekeeping | ● | ● | ● | ● | ● | — | — | ● |
| Maintenance, Cases | ● | ● | ● | ● | ● | ● | ● | — |
| Operations, Oversight | ● | ● | ● | ● | ● | — | — | — |
| **Financial fields** | ● | ● | ● | ● | — | — | — | — |

Scope: director → region, ops manager → Riyadh portfolio, everyone else → their
one property (cross-property requests return 403). Unknown emails get the
locked "no access" screen.

## Known limits

- File storage means exactly one instance (enforced in DEPLOY.md).
- Roster emails in `server/config.js` are placeholders — replace before go-live.
- The Google Sheets / Yardi connectors are wired as env-var switches with stub
  data behind them; the fetch adapters are the next increment.
