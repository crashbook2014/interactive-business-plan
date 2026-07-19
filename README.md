# PULSE — Master of the Day

Role-aware operations console for a serviced-living operator. One app for the daily
shift, the physical estate, the resident experience, and management oversight —
built for Narjis Gardens (Riyadh, Asia/Riyadh) and multi-property ready
across the Riyadh portfolio.

```bash
npm install
npm start      # http://localhost:8787 — stub mode, zero credentials
npm test
```

- **Stack**: Node ≥20, Express 5 (ESM), JSON file storage, React 19 + Vite,
  single origin (Express serves the built client and `/api`).
- **RBAC**: 8 roles from the org chart in `server/config.js`, enforced on every
  API endpoint; financials redacted below GM; per-property scoping.
- **Integrations**: all read-only (Slack/Gmail/Calendar, Google Sheets, Yardi),
  stubbed with badged sample data until env vars activate them.

See `DEPLOY.md` for Cloud Run / Render deployment and `REVIEW.md` for what is
done, sample vs live data, and the full access matrix.
