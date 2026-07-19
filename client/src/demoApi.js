// In-browser API for the shareable demo build. Implements the same endpoints
// against in-memory copies of the seed data, reusing the real server modules
// for the access matrix, redaction fields, SLA math and briefing — so the
// demo enforces exactly the rules the server does. State lives for the tab.
import {
  MODULE_ACCESS, FINANCIAL_ROLES, FINANCIAL_FIELDS, PROPERTIES, ORG, ROLES,
  DEFAULT_LANDING, ALLOWED_DOMAIN, findUser, scopeProperties
} from '../../server/config.js';
import { slaState } from '../../server/lib/sla.js';
import { composeCore, meetingCore } from '../../server/lib/brief-core.js';
import seedUnits from '../../server/seed/units.json';
import seedResidents from '../../server/seed/residents.json';
import seedWos from '../../server/seed/workorders.json';
import seedCases from '../../server/seed/cases.json';
import seedFeedback from '../../server/seed/feedback.json';
import seedEvents from '../../server/seed/events.json';
import seedMoves from '../../server/seed/moves.json';
import seedShifts from '../../server/seed/shifts.json';
import seedSignals from '../../server/seed/signals.json';
import seedMetrics from '../../server/seed/metrics.json';
import seedTrends from '../../server/seed/trends.json';

// Shift every timestamp so the demo data is always "today", whenever opened.
const SEED_EPOCH = Date.parse('2026-07-19T07:00:00Z');
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
  units: clone(seedUnits), residents: clone(seedResidents), workorders: clone(seedWos),
  cases: clone(seedCases), feedback: clone(seedFeedback), events: clone(seedEvents),
  moves: clone(seedMoves), shifts: clone(seedShifts), signals: clone(seedSignals),
  metrics: clone(seedMetrics), trends: clone(seedTrends)
};

// Session survives reloads where storage is available; memory otherwise.
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
  if (!allowed.includes(requested)) err(403, 'Property outside your scope');
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

function occupancySummary(units) {
  const count = s => units.filter(u => u.status === s).length;
  const occupied = count('occupied') + count('departing');
  return {
    total: units.length, occupied,
    vacantReady: count('vacant-ready'), vacantDirty: count('vacant-dirty'),
    arriving: count('arriving'), outOfOrder: count('out-of-order'), departing: count('departing'),
    occupancyRate: units.length ? +(occupied / units.length).toFixed(3) : 0
  };
}

function briefData(prop) {
  return {
    signals: db.signals,
    units: byProp('units', prop),
    wos: byProp('workorders', prop),
    moves: byProp('moves', prop).filter(m => m.status !== 'done')
  };
}

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

  /* ---- search (auth only, role+scope filtered) ---- */
  if (p === '/search') {
    const q = (params.get('q') || '').toLowerCase().trim();
    if (q.length < 2) return { results: [] };
    const scope = new Set(scopeProperties(user));
    const inScope = x => scope.has(x.property);
    const results = [];
    const push = (module, title, sub, hash) => results.push({ module, title, sub, hash });
    if (can(user, 'units')) for (const u of db.units.filter(inScope)) if (u.id.includes(q) || u.status.includes(q)) push('units', `Unit ${u.id}`, u.status, '#/units');
    if (can(user, 'residents')) for (const r of db.residents.filter(inScope)) if (r.name.toLowerCase().includes(q) || (r.unit || '').includes(q)) push('residents', r.name, r.stage, `#/residents/${r.id}`);
    if (can(user, 'maintenance')) for (const w of db.workorders.filter(inScope)) if (w.title.toLowerCase().includes(q)) push('maintenance', w.title, `${w.priority} · ${w.status}`, '#/maintenance');
    if (can(user, 'cases')) for (const c of db.cases.filter(inScope)) if (c.title.toLowerCase().includes(q)) push('cases', c.title, c.status, '#/cases');
    if (can(user, 'feedback')) for (const f of db.feedback.filter(inScope)) if (f.text.toLowerCase().includes(q)) push('feedback', f.text.slice(0, 60), f.sentiment, '#/feedback');
    if (can(user, 'events')) for (const e of db.events.filter(inScope)) if (e.title.toLowerCase().includes(q)) push('events', e.title, e.where, '#/events');
    return { results: results.slice(0, 20) };
  }

  /* ---- dashboard ---- */
  if (p === '/dashboard') {
    gate(user, 'home');
    const prop = scopeProp(user, params);
    const units = byProp('units', prop);
    const wos = withSla(byProp('workorders', prop));
    const cases = withSla(byProp('cases', prop));
    const s = db.shifts[prop] || { duty: [] };
    return R({
      property: PROPERTIES.find(x => x.id === prop),
      occupancy: occupancySummary(units),
      arrivalsDue: units.filter(u => u.status === 'arriving').length,
      roomsToClean: units.filter(u => u.status === 'vacant-dirty').length,
      highWorkOrders: wos.filter(w => w.priority === 'high' && w.status !== 'done').length,
      slaAtRisk: [...wos, ...cases].filter(x => ['at-risk', 'breached'].includes(x.sla.state)).length,
      onDuty: s.duty.filter(d => d.on).length,
      newFeedback: byProp('feedback', prop).filter(f => f.status === 'new').length,
      metrics: db.metrics[prop] || {},
      now: new Date().toISOString()
    });
  }

  /* ---- shift ---- */
  if (seg[0] === 'shift') {
    gate(user, 'shift');
    const prop = scopeProp(user, params);
    const s = (db.shifts[prop] ||= { duty: [], checklist: [], tasks: [], handover: null });
    if (p === '/shift') return R({ ...s, brief: composeCore(briefData(prop)), meetingBrief: meetingCore(composeCore(briefData(prop))) });
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

  /* ---- units ---- */
  if (seg[0] === 'units') {
    gate(user, 'units');
    const prop = scopeProp(user, params);
    if (p === '/units') {
      const units = byProp('units', prop);
      return R({ units, summary: occupancySummary(units), dataMode: PROPERTIES.find(x => x.id === prop)?.live ? 'live-stub' : 'awaiting-data' });
    }
    const u = db.units.find(x => x.id === seg[1] && x.property === prop);
    if (!u) err(404, 'Unit not found');
    u.status = body.status; return { ok: true };
  }

  /* ---- moves ---- */
  if (seg[0] === 'moves') {
    gate(user, 'moves');
    const prop = scopeProp(user, params);
    if (p === '/moves') {
      const residents = byProp('residents', prop);
      return R({ moves: byProp('moves', prop).map(m => ({ ...m, residentName: residents.find(r => r.id === m.resident)?.name || null, progress: `${m.checklist.filter(c => c.done).length}/${m.checklist.length}` })) });
    }
    const m = db.moves.find(x => x.id === seg[1] && x.property === prop);
    const item = m?.checklist[Number(seg[3])];
    if (item) { item.done = !item.done; m.status = m.checklist.every(c => c.done) ? 'done' : 'in-progress'; }
    return { ok: true };
  }

  /* ---- housekeeping ---- */
  if (seg[0] === 'housekeeping') {
    gate(user, 'housekeeping');
    const prop = scopeProp(user, params);
    if (p === '/housekeeping') {
      const units = byProp('units', prop);
      const rank = s => s === 'arriving' ? 0 : s === 'vacant-dirty' ? 1 : 2;
      const board = units.filter(u => ['vacant-dirty', 'arriving', 'departing'].includes(u.status)).sort((a, b) => rank(a.status) - rank(b.status) || a.id.localeCompare(b.id));
      return R({ board, toClean: units.filter(u => u.status === 'vacant-dirty').length });
    }
    const u = db.units.find(x => x.id === seg[1] && x.property === prop);
    if (!u || !['vacant-dirty', 'departing'].includes(u.status)) err(400, 'Unit is not on the turn board');
    u.status = 'vacant-ready'; return { ok: true };
  }

  /* ---- workorders ---- */
  if (seg[0] === 'workorders') {
    gate(user, 'maintenance');
    const prop = scopeProp(user, params);
    if (p === '/workorders' && method === 'GET') {
      const assignees = ORG.filter(u => (u.property === prop || !u.property) && ['maintenance_manager', 'agm', 'gm'].includes(u.role)).map(u => ({ email: u.email, name: u.name }));
      return R({ workorders: withSla(byProp('workorders', prop)), assignees });
    }
    if (method === 'POST') {
      if (!body.title) err(400, 'Title required');
      const wo = { id: id('wo'), property: prop, title: String(body.title).slice(0, 200), category: body.category || 'General', priority: body.priority || 'normal', status: 'open', unit: body.unit || null, createdAt: new Date().toISOString(), createdBy: user.email, assignee: null, history: [] };
      db.workorders.push(wo); return { ...wo, sla: slaState(wo) };
    }
    const w = db.workorders.find(x => x.id === seg[1] && x.property === prop);
    if (!w) err(404, 'Work order not found');
    for (const k of ['status', 'assignee', 'priority']) if (k in body) w[k] = body[k];
    return { ...w, sla: slaState(w) };
  }

  /* ---- cases ---- */
  if (seg[0] === 'cases') {
    gate(user, 'cases');
    const prop = scopeProp(user, params);
    if (p === '/cases' && method === 'GET') return R({ cases: withSla(byProp('cases', prop)) });
    if (method === 'POST' && seg.length === 1) {
      if (!body.title) err(400, 'Title required');
      const c = { id: id('case'), property: prop, title: String(body.title).slice(0, 200), category: body.category || 'admin', priority: body.priority || 'normal', status: 'open', createdAt: new Date().toISOString(), createdBy: user.email, assignee: null, linkedFeedback: null, history: [] };
      db.cases.push(c); return { ...c, sla: slaState(c) };
    }
    const c = db.cases.find(x => x.id === seg[1] && x.property === prop);
    if (!c) err(404, 'Case not found');
    for (const k of ['status', 'assignee', 'priority']) if (k in body) c[k] = body[k];
    return { ...c, sla: slaState(c) };
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
      feedback: byProp('feedback', prop).filter(f => f.resident === r.id),
      cases: withSla(byProp('cases', prop).filter(c => c.resident === r.id || byProp('feedback', prop).some(f => f.resident === r.id && f.linkedCase === c.id))),
      moves: byProp('moves', prop).filter(m => m.resident === r.id)
    });
    if (seg[2] === 'notes') { if (!body.text) err(400, 'Note required'); (r.notes ||= []).push({ at: new Date().toISOString(), by: user.email, text: String(body.text).slice(0, 2000) }); return { ok: true }; }
    if (seg[2] === 'milestones') { const m = r.milestones[Number(seg[3])]; if (m) m.done = !m.done; return { ok: true }; }
    if (seg[2] === 'stage') { r.stage = body.stage; return { ok: true }; }
    if (seg[2] === 'compose') {
      const firstName = r.name.split(' ')[0];
      const templates = {
        welcome: `Welcome home, ${firstName}.

Your unit ${r.unit || ''} is ready and your community is live — events on the calendar, services a message away, and a team that answers in real time. Anything you need, reply here and it is handled.

— The PULSE team`,
        'check-in': `A quick check-in from PULSE, ${firstName}.

How is life in ${r.unit ? 'unit ' + r.unit : 'your home'} so far. If anything is off, tell us — we move fast.

— The PULSE team`,
        renewal: `${firstName}, your stay is coming up for renewal.

We would love to keep you in the community. Reply here and we will walk you through the options.

— The PULSE team`
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
      return R({ feedback: byProp('feedback', prop).map(f => ({ ...f, residentName: residents.find(r => r.id === f.resident)?.name || 'Unknown' })), dataMode: 'sample' });
    }
    const f = db.feedback.find(x => x.id === seg[1] && x.property === prop);
    if (!f) err(404, 'Not found');
    if (seg[2] === 'triage') { f.status = body.status; return { ok: true }; }
    if (seg[2] === 'escalate') {
      if (f.linkedCase) err(409, 'Already escalated');
      const c = { id: id('case'), property: prop, title: `Feedback follow-up: ${f.text.slice(0, 80)}`, category: 'facilities', priority: f.sentiment === 'negative' ? 'high' : 'normal', status: 'open', createdAt: new Date().toISOString(), createdBy: user.email, assignee: null, linkedFeedback: f.id, resident: f.resident, history: [] };
      db.cases.push(c); f.linkedCase = c.id; f.status = 'actioned';
      return { ok: true, case: { ...c, sla: slaState(c) } };
    }
  }

  /* ---- events ---- */
  if (seg[0] === 'events') {
    gate(user, 'events');
    const prop = scopeProp(user, params);
    if (p === '/events' && method === 'GET') {
      const residents = byProp('residents', prop);
      return R({
        events: byProp('events', prop).map(e => ({ ...e, rsvpNames: e.rsvps.map(rid => residents.find(r => r.id === rid)?.name).filter(Boolean) })),
        residents: residents.map(r => ({ id: r.id, name: r.name }))
      });
    }
    if (method === 'POST' && seg.length === 1) {
      if (!body.title || !body.when) err(400, 'Title and time required');
      const e = { id: id('ev'), property: prop, title: body.title, when: body.when, where: body.where || '', capacity: body.capacity || 20, rsvps: [], attended: [] };
      db.events.push(e); return e;
    }
    const e = db.events.find(x => x.id === seg[1] && x.property === prop);
    if (!e) err(404, 'Not found');
    const list = seg[2] === 'rsvp' ? e.rsvps : e.attended;
    const i = list.indexOf(body.resident);
    i >= 0 ? list.splice(i, 1) : list.push(body.resident);
    return { ok: true };
  }

  /* ---- operations / oversight ---- */
  if (p === '/operations') {
    gate(user, 'operations');
    const board = PROPERTIES.map(pr => {
      const units = byProp('units', pr.id);
      return { ...pr, occupancy: units.length ? occupancySummary(units) : null, ...(db.metrics[pr.id] || { dataMode: { occupancy: 'awaiting-data' } }) };
    });
    const live = board.filter(b => b.occupancy);
    const rollup = {
      weightedOccupancy: live.length ? +(live.reduce((s, b) => s + b.occupancy.occupancyRate * b.occupancy.total, 0) / live.reduce((s, b) => s + b.occupancy.total, 0)).toFixed(3) : null,
      propertiesLive: live.length, propertiesTotal: PROPERTIES.length,
      revenue: live.reduce((s, b) => s + (b.revenue || 0), 0),
      cost: live.reduce((s, b) => s + (b.cost || 0), 0),
      reserve: live.reduce((s, b) => s + (b.reserve || 0), 0),
      noi: live.reduce((s, b) => s + (b.noi || 0), 0),
      csat: live.length ? +(live.reduce((s, b) => s + (b.csat || 0), 0) / (live.filter(b => b.csat).length || 1)).toFixed(2) : null
    };
    return R({ board, rollup, financialsVisible: seesFin(user), financialsSource: 'sample' });
  }
  if (p === '/operations/trends') { gate(user, 'operations'); return R({ trends: db.trends }); }
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
          handover: s.handover ? { from: s.handover.from, at: s.handover.at, readCount: s.handover.readBy.length, note: s.handover.note } : null
        };
      })
    });
  }

  err(404, `Not found: ${method} ${p}`);
}
