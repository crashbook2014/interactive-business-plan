// In-browser API for the shareable demo build. Implements the same endpoints
// against in-memory copies of the seed data, reusing the real server modules
// for the access matrix, redaction, SLA, scorecards and journey math — so the
// demo enforces exactly the rules the server does. State lives for the tab.
import {
  MODULE_ACCESS, FINANCIAL_ROLES, FINANCIAL_FIELDS, PROPERTIES, ORG, ROLES,
  DEFAULT_LANDING, ALLOWED_DOMAIN, findUser, scopeProperties
} from '../../server/config.js';
import { slaState } from '../../server/lib/sla.js';
import { composeCore, meetingCore, eventScorecard, journeyStats, atRiskTravelers } from '../../server/lib/brief-core.js';
import seedJourneys from '../../server/seed/journeys.json';
import seedResidents from '../../server/seed/residents.json';
import seedClients from '../../server/seed/clients.json';
import seedEvents from '../../server/seed/events.json';
import seedFeedback from '../../server/seed/feedback.json';
import seedCases from '../../server/seed/cases.json';
import seedShifts from '../../server/seed/shifts.json';
import seedSignals from '../../server/seed/signals.json';
import seedMetrics from '../../server/seed/metrics.json';
import seedTrends from '../../server/seed/trends.json';

// Shift every timestamp so the demo data is always "today", whenever opened.
const SEED_EPOCH = Date.parse('2026-07-19T18:00:00Z');
const DELTA = Date.now() - SEED_EPOCH;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
function shiftDates(v) {
  if (typeof v === 'string' && ISO_RE.test(v)) return new Date(Date.parse(v) + DELTA).toISOString();
  if (Array.isArray(v)) return v.map(shiftDates);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shiftDates(x)]));
  return v;
}
const clone = v => shiftDates(JSON.parse(JSON.stringify(v)));

const db = {
  journeys: clone(seedJourneys), residents: clone(seedResidents), clients: clone(seedClients),
  events: clone(seedEvents), feedback: clone(seedFeedback), cases: clone(seedCases),
  shifts: clone(seedShifts), signals: clone(seedSignals), metrics: clone(seedMetrics), trends: clone(seedTrends)
};

const store = (() => { try { sessionStorage.setItem('__t', '1'); sessionStorage.removeItem('__t'); return sessionStorage; } catch { return null; } })();
let sessionEmail = store?.getItem('demo_email') || null;
const remember = v => { sessionEmail = v; try { v ? store?.setItem('demo_email', v) : store?.removeItem('demo_email'); } catch { /* memory only */ } };

let idn = 0;
const id = p => `${p}-demo${++idn}`;
const err = (status, message) => { throw Object.assign(new Error(message), { status }); };
const byProp = (name, prop) => db[name].filter(x => x.property === prop);
const withSla = list => list.map(i => ({ ...i, sla: slaState(i) }));
const can = (user, m) => (MODULE_ACCESS[m] || []).includes(user.role);
const seesFin = user => FINANCIAL_ROLES.includes(user.role);

function redact(v, user) {
  if (seesFin(user)) return v;
  if (Array.isArray(v)) return v.map(x => redact(x, user));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([k]) => !FINANCIAL_FIELDS.includes(k)).map(([k, x]) => [k, redact(x, user)]));
  }
  return v;
}

function requireUser() {
  const u = sessionEmail ? findUser(sessionEmail) : null;
  if (!u) err(401, 'Sign in required');
  return u;
}
function gate(user, module) { if (!can(user, module)) err(403, `Your role does not include ${module}`); }
function scopeProp(user, params) {
  const allowed = scopeProperties(user);
  const requested = params.get('property') || user.property || allowed[0];
  if (!allowed.includes(requested)) err(403, 'Compound outside your scope');
  return requested;
}

function contextFor(user) {
  const props = scopeProperties(user);
  return {
    email: user.email, name: user.name, role: user.role, roleTitle: ROLES[user.role].title,
    scope: ROLES[user.role].scope,
    properties: PROPERTIES.filter(p => props.includes(p.id)),
    homeProperty: user.property || PROPERTIES[0].id,
    modules: Object.keys(MODULE_ACCESS).filter(m => can(user, m)),
    financials: seesFin(user), landing: DEFAULT_LANDING[user.role]
  };
}

const briefData = prop => ({
  signals: db.signals,
  events: byProp('events', prop),
  residents: byProp('residents', prop),
  feedback: byProp('feedback', prop),
  cases: byProp('cases', prop)
});

export function demoApi(path, opts = {}) {
  return new Promise((resolve, reject) => {
    try { resolve(handle(path, opts)); } catch (e) { reject(e); }
  });
}

function handle(path, opts) {
  const [p, qs] = path.split('?');
  const params = new URLSearchParams(qs || '');
  const method = (opts.method || 'GET').toUpperCase();
  const body = opts.body || {};
  const seg = p.split('/').filter(Boolean);

  /* ---- auth ---- */
  if (p === '/auth/status') return {
    signedIn: !!sessionEmail, googleConfigured: false, testLogin: true, domain: ALLOWED_DOMAIN,
    roster: ORG.map(u => ({ email: u.email, name: u.name, role: u.role }))
  };
  if (p === '/auth/me') {
    if (!sessionEmail) err(401, 'unauthenticated');
    const u = findUser(sessionEmail);
    if (!u) err(403, 'no-role');
    return { user: contextFor(u) };
  }
  if (p === '/auth/test-login') { remember(String(body.email || '').toLowerCase()); return { ok: true, hasRole: !!findUser(sessionEmail) }; }
  if (p === '/auth/logout') { remember(null); return { ok: true }; }

  const user = requireUser();
  const R = data => redact(data, user);

  /* ---- search ---- */
  if (p === '/search') {
    const q = (params.get('q') || '').toLowerCase().trim();
    if (q.length < 2) return { results: [] };
    const scope = new Set(scopeProperties(user));
    const inScope = x => scope.has(x.property);
    const results = [];
    const push = (module, title, sub, hash) => results.push({ module, title, sub, hash });
    if (can(user, 'events')) for (const e of db.events.filter(inScope)) if (e.title.toLowerCase().includes(q)) push('events', e.title, e.status, '#/events');
    if (can(user, 'residents')) for (const r of db.residents.filter(inScope)) if (r.name.toLowerCase().includes(q)) push('residents', r.name, `stage ${r.stageIndex + 1}`, `#/residents/${r.id}`);
    if (can(user, 'clients')) for (const c of db.clients.filter(inScope)) if (c.name.toLowerCase().includes(q)) push('clients', c.name, c.stage, '#/clients');
    if (can(user, 'feedback')) for (const f of db.feedback.filter(inScope)) if (f.text.toLowerCase().includes(q)) push('feedback', f.text.slice(0, 60), f.sentiment, '#/feedback');
    if (can(user, 'cases')) for (const c of db.cases.filter(inScope)) if (c.title.toLowerCase().includes(q)) push('cases', c.title, c.status, '#/cases');
    return { results: results.slice(0, 20) };
  }

  /* ---- dashboard ---- */
  if (p === '/dashboard') {
    gate(user, 'home');
    const prop = scopeProp(user, params);
    const events = byProp('events', prop);
    const cases = withSla(byProp('cases', prop));
    const s = db.shifts[prop] || { duty: [] };
    const reported = events.filter(e => e.status === 'reported').map(eventScorecard).filter(Boolean);
    return R({
      property: PROPERTIES.find(x => x.id === prop),
      eventsLive: events.filter(e => e.status === 'live').length,
      eventsPlanning: events.filter(e => ['planning', 'concept'].includes(e.status)).length,
      journeysAtRisk: atRiskTravelers(byProp('residents', prop)).length,
      newFeedback: byProp('feedback', prop).filter(f => f.status === 'new').length,
      slaAtRisk: cases.filter(x => ['at-risk', 'breached'].includes(x.sla.state)).length,
      onDuty: s.duty.filter(d => d.on).length,
      avgEventScore: reported.length ? Math.round(reported.reduce((a, r) => a + r.score, 0) / reported.length) : null,
      metrics: db.metrics[prop] || {},
      now: new Date().toISOString()
    });
  }

  /* ---- shift ---- */
  if (seg[0] === 'shift') {
    gate(user, 'shift');
    const prop = scopeProp(user, params);
    const s = (db.shifts[prop] ||= { duty: [], checklist: [], tasks: [], handover: null });
    if (p === '/shift') { const b = composeCore(briefData(prop)); return R({ ...s, brief: b, meetingBrief: meetingCore(b) }); }
    if (seg[1] === 'checklist') { const c = s.checklist.find(x => x.id === seg[2]); if (c) c.done = !c.done; return { ok: true }; }
    if (seg[1] === 'tasks' && method === 'POST') {
      const t = { id: id('t'), title: String(body.title || '').slice(0, 200), assignee: body.assignee || null, status: 'open', createdAt: new Date().toISOString() };
      if (!t.title) err(400, 'Title required');
      s.tasks.push(t); return t;
    }
    if (seg[1] === 'tasks') { const t = s.tasks.find(x => x.id === seg[2]); if (t) { if (body.status) t.status = body.status; if ('assignee' in body) t.assignee = body.assignee; } return { ok: true }; }
    if (seg[1] === 'duty') {
      let me = s.duty.find(d => d.email === user.email);
      if (!me) { me = { email: user.email, name: user.name }; s.duty.push(me); }
      me.on = !!body.on; me.since = new Date().toISOString();
      return { ok: true, on: me.on };
    }
    if (seg[1] === 'handover' && seg[2] === 'ack') {
      if (s.handover && !s.handover.readBy.some(r => r.email === user.email)) s.handover.readBy.push({ email: user.email, name: user.name, at: new Date().toISOString() });
      return { ok: true };
    }
    if (seg[1] === 'handover') {
      if (!body.note) err(400, 'Handover note required');
      s.handover = { from: user.email, at: new Date().toISOString(), note: String(body.note).slice(0, 4000), readBy: [] };
      return { ok: true };
    }
  }

  /* ---- journeys ---- */
  if (seg[0] === 'journeys') {
    gate(user, 'journeys');
    const prop = scopeProp(user, params);
    if (p === '/journeys') {
      const journeys = byProp('journeys', prop);
      const residents = byProp('residents', prop);
      const clients = byProp('clients', prop);
      return R({
        journeys: journeys.map(j => ({
          ...j,
          stats: j.kind === 'resident'
            ? journeyStats(j, residents)
            : { stages: j.stages.map((s, si) => ({ name: s.name, touchpoints: s.touchpoints, travelersHere: clients.filter(c => ['inquiry','proposal','planning','event-day','report-renewal'][si] === c.stage).length })), travelers: clients.length }
        })),
        atRisk: atRiskTravelers(residents).map(r => ({ id: r.id, name: r.name, stageIndex: r.stageIndex }))
      });
    }
    if (seg[1] === 'resident' && seg[3] === 'touchpoint') {
      const r = db.residents.find(x => x.id === seg[2] && x.property === prop);
      const tp = r?.touchpoints?.[Number(body.stage)]?.[Number(body.index)];
      if (!tp) err(404, 'Touchpoint not found');
      if (body.done !== undefined) { tp.done = !!body.done; tp.at = tp.done ? new Date().toISOString() : null; }
      if (body.score !== undefined) tp.score = body.score === null ? null : Math.max(1, Math.min(5, Number(body.score)));
      r.stageIndex = r.touchpoints.findIndex(st => st.some(t => !t.done));
      if (r.stageIndex === -1) r.stageIndex = r.touchpoints.length - 1;
      return { ok: true };
    }
  }

  /* ---- events ---- */
  if (seg[0] === 'events') {
    gate(user, 'events');
    const prop = scopeProp(user, params);
    if (p === '/events' && method === 'GET') {
      const clients = byProp('clients', prop);
      return R({
        events: byProp('events', prop).map(e => ({
          ...e,
          clientName: clients.find(c => c.id === e.clientId)?.name || null,
          scorecard: eventScorecard(e),
          openTasks: e.checklist.filter(c => !c.done).length
        })),
        team: ORG.filter(u => u.property === prop || !u.property).map(u => ({ email: u.email, name: u.name }))
      });
    }
    if (method === 'POST' && seg.length === 1) {
      if (!body.title || !body.when) err(400, 'Title and time required');
      const e = { id: id('ev'), property: prop, title: String(body.title).slice(0, 140), kind: body.kind || 'resident', clientId: body.clientId || null, when: body.when, where: body.where || '', capacity: body.capacity || 50, status: 'concept', budget: null, spend: null, checklist: [], runOfShow: [], rsvps: 0, attended: 0, surveys: [], reportSentAt: null };
      db.events.push(e); return e;
    }
    const e = db.events.find(x => x.id === seg[1] && x.property === prop);
    if (!e) err(404, 'Event not found');
    if (seg[2] === 'checklist') {
      if (body.add) e.checklist.push({ item: String(body.add).slice(0, 160), owner: body.owner || null, due: body.due || null, done: false });
      else if (body.toggle !== undefined) { const c = e.checklist[Number(body.toggle)]; if (c) c.done = !c.done; }
      return { ok: true };
    }
    if (seg[2] === 'runofshow') {
      if (!body.time || !body.item) err(400, 'Time and item required');
      e.runOfShow.push({ time: body.time, item: String(body.item).slice(0, 160), owner: body.owner || '' });
      e.runOfShow.sort((a, b) => a.time.localeCompare(b.time));
      return { ok: true };
    }
    if (seg[2] === 'survey') {
      const csat = Math.max(1, Math.min(5, Number(body.csat)));
      if (!csat) err(400, 'Score 1-5 required');
      e.surveys.push({ csat, comment: String(body.comment || '').slice(0, 400) });
      return { ok: true, scorecard: eventScorecard(e) };
    }
    if (method === 'PATCH') {
      if (body.status) { e.status = body.status; if (body.status === 'reported' && !e.reportSentAt) e.reportSentAt = new Date().toISOString(); }
      for (const k of ['rsvps', 'attended']) if (k in body) e[k] = Math.max(0, Number(body[k]) || 0);
      return { ...e, scorecard: eventScorecard(e) };
    }
  }

  /* ---- clients ---- */
  if (seg[0] === 'clients') {
    gate(user, 'clients');
    const prop = scopeProp(user, params);
    if (p === '/clients' && method === 'GET') {
      const events = byProp('events', prop);
      return R({
        clients: byProp('clients', prop).map(c => ({
          ...c,
          events: events.filter(e => e.clientId === c.id).map(e => ({ id: e.id, title: e.title, status: e.status, scorecard: eventScorecard(e) }))
        })),
        pipelineValue: byProp('clients', prop).reduce((s, c) => s + (c.contractValue || 0), 0)
      });
    }
    if (method === 'POST' && seg.length === 1) {
      if (!body.name) err(400, 'Name required');
      const c = { id: id('cl'), property: prop, name: String(body.name).slice(0, 120), contact: body.contact || '', stage: 'inquiry', contractValue: null, since: new Date().toISOString(), satisfaction: null, eventIds: [], nextStep: 'Discovery call to book', journeyId: 'jr-client' };
      db.clients.push(c); return c;
    }
    const c = db.clients.find(x => x.id === seg[1] && x.property === prop);
    if (!c) err(404, 'Client not found');
    if (body.stage) c.stage = body.stage;
    for (const k of ['nextStep', 'satisfaction', 'contractValue']) if (k in body) c[k] = body[k];
    return c;
  }

  /* ---- residents ---- */
  if (seg[0] === 'residents') {
    gate(user, 'residents');
    const prop = scopeProp(user, params);
    if (p === '/residents') return R({ residents: byProp('residents', prop) });
    const r = db.residents.find(x => x.id === seg[1] && x.property === prop);
    if (!r) err(404, 'Not found');
    if (seg.length === 2) return R({
      resident: r,
      journey: byProp('journeys', prop).find(j => j.id === r.journeyId),
      feedback: byProp('feedback', prop).filter(f => f.resident === r.id),
      cases: withSla(byProp('cases', prop).filter(c => c.resident === r.id))
    });
    if (seg[2] === 'notes') { if (!body.text) err(400, 'Note required'); (r.notes ||= []).push({ at: new Date().toISOString(), by: user.email, text: String(body.text).slice(0, 2000) }); return { ok: true }; }
    if (seg[2] === 'compose') {
      const firstName = r.name.split(' ')[0];
      const templates = {
        welcome: `Welcome home, ${firstName}.\n\nYour community is live — events on the calendar, services a message away, and a team that answers in real time. Anything you need, reply here and it is handled.\n\n— The PULSE team`,
        'event-invite': `${firstName}, you are invited.\n\nSomething special is coming up at the compound and we saved you a place. RSVP with one tap — we would love to see you there.\n\n— The PULSE team`,
        'check-in': `A quick check-in from PULSE, ${firstName}.\n\nHow is everything so far. If anything is off, tell us — we move fast.\n\n— The PULSE team`
      };
      return { draft: templates[body.template] || templates['check-in'], draftOnly: true };
    }
  }

  /* ---- feedback ---- */
  if (seg[0] === 'feedback') {
    gate(user, 'feedback');
    const prop = scopeProp(user, params);
    if (p === '/feedback') {
      const residents = byProp('residents', prop);
      const events = byProp('events', prop);
      return R({
        feedback: byProp('feedback', prop).map(f => ({
          ...f,
          residentName: residents.find(r => r.id === f.resident)?.name || 'Unknown',
          eventTitle: events.find(e => e.id === f.eventId)?.title || null
        })),
        dataMode: 'sample'
      });
    }
    const f = db.feedback.find(x => x.id === seg[1] && x.property === prop);
    if (!f) err(404, 'Not found');
    if (seg[2] === 'triage') { f.status = body.status; return { ok: true }; }
    if (seg[2] === 'escalate') {
      if (f.linkedCase) err(409, 'Already escalated');
      const c = { id: id('case'), property: prop, title: `Feedback follow-up: ${f.text.slice(0, 80)}`, category: 'experience', priority: f.sentiment === 'negative' ? 'high' : 'normal', status: 'open', createdAt: new Date().toISOString(), createdBy: user.email, assignee: null, linkedFeedback: f.id, resident: f.resident, history: [] };
      db.cases.push(c); f.linkedCase = c.id; f.status = 'actioned';
      return { ok: true, case: { ...c, sla: slaState(c) } };
    }
  }

  /* ---- cases ---- */
  if (seg[0] === 'cases') {
    gate(user, 'cases');
    const prop = scopeProp(user, params);
    if (p === '/cases' && method === 'GET') return R({ cases: withSla(byProp('cases', prop)) });
    if (method === 'POST' && seg.length === 1) {
      if (!body.title) err(400, 'Title required');
      const c = { id: id('case'), property: prop, title: String(body.title).slice(0, 200), category: body.category || 'production', priority: body.priority || 'normal', status: 'open', createdAt: new Date().toISOString(), createdBy: user.email, assignee: null, linkedFeedback: null, history: [] };
      db.cases.push(c); return { ...c, sla: slaState(c) };
    }
    const c = db.cases.find(x => x.id === seg[1] && x.property === prop);
    if (!c) err(404, 'Case not found');
    for (const k of ['status', 'assignee', 'priority']) if (k in body) c[k] = body[k];
    return { ...c, sla: slaState(c) };
  }

  /* ---- experience / oversight ---- */
  if (p === '/experience') {
    gate(user, 'experience');
    const board = PROPERTIES.map(pr => ({ ...pr, ...(db.metrics[pr.id] || { dataMode: { experience: 'awaiting-data' } }) }));
    const reported = db.events.filter(e => e.status === 'reported').map(e => ({ id: e.id, title: e.title, when: e.when, kind: e.kind, scorecard: eventScorecard(e) }));
    const testimonials = reported.flatMap(e => (e.scorecard?.testimonials || []).map(t => ({ text: t, event: e.title })));
    const rj = db.journeys.find(j => j.kind === 'resident');
    return R({
      board,
      rollup: {
        eventsReported: reported.length,
        exceptional: reported.filter(e => e.scorecard?.tier === 'Exceptional').length,
        avgEventScore: reported.length ? Math.round(reported.reduce((s, e) => s + (e.scorecard?.score || 0), 0) / reported.length) : null,
        journey: rj ? journeyStats(rj, db.residents) : null,
        atRisk: atRiskTravelers(db.residents).length
      },
      reported, testimonials: testimonials.slice(0, 8),
      financialsVisible: seesFin(user), financialsSource: 'sample'
    });
  }
  if (p === '/experience/trends') { gate(user, 'experience'); return R({ trends: db.trends }); }
  if (p === '/oversight') {
    gate(user, 'oversight');
    return R({
      board: PROPERTIES.map(pr => {
        const s = db.shifts[pr.id];
        if (!s) return { property: pr, status: 'awaiting-data' };
        return {
          property: pr,
          onDuty: s.duty.filter(d => d.on), offDuty: s.duty.filter(d => !d.on),
          checklistDone: s.checklist?.filter(c => c.done).length || 0, checklistTotal: s.checklist?.length || 0,
          openTasks: s.tasks?.filter(t => t.status === 'open') || [],
          liveEvents: db.events.filter(e => e.property === pr.id && e.status === 'live').map(e => e.title),
          handover: s.handover ? { from: s.handover.from, at: s.handover.at, readCount: s.handover.readBy.length, note: s.handover.note } : null
        };
      })
    });
  }

  err(404, `Not found: ${method} ${p}`);
}
