// All module APIs. Every endpoint: auth → module gate → property scope → work.
// Financial redaction happens in send(); mutations are audit-logged.
import express from 'express';
import crypto from 'node:crypto';
import { read, update } from '../lib/store.js';
import { requireModule, resolveProperty, redactFinancials, seesFinancials } from '../lib/rbac.js';
import { withSla, slaState } from '../lib/sla.js';
import { audit } from '../lib/audit.js';
import { composeBrief, composeBriefDeterministic, meetingBrief } from '../lib/brief.js';
import { PROPERTIES, ORG, MODULE_ACCESS } from '../config.js';

const router = express.Router();
router.use(express.json());

const id = p => `${p}-${crypto.randomBytes(4).toString('hex')}`;
const send = (req, res, data) => res.json(redactFinancials(data, req.user));
const byProp = (name, prop) => read(name, []).filter(x => x.property === prop);

function occupancySummary(units) {
  const total = units.length;
  const count = s => units.filter(u => u.status === s).length;
  const occupied = count('occupied') + count('departing');
  return {
    total, occupied,
    vacantReady: count('vacant-ready'), vacantDirty: count('vacant-dirty'),
    arriving: count('arriving'), outOfOrder: count('out-of-order'), departing: count('departing'),
    occupancyRate: total ? +(occupied / total).toFixed(3) : 0
  };
}

/* ---------- Home / dashboard ---------- */
router.get('/dashboard', requireModule('home'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const units = byProp('units', prop);
  const wos = withSla(byProp('workorders', prop));
  const cases = withSla(byProp('cases', prop));
  const shifts = read('shifts', {})[prop] || { duty: [] };
  const fb = byProp('feedback', prop);
  const metrics = read('metrics', {})[prop] || {};
  send(req, res, {
    property: PROPERTIES.find(p => p.id === prop),
    occupancy: occupancySummary(units),
    arrivalsDue: units.filter(u => u.status === 'arriving').length,
    roomsToClean: units.filter(u => u.status === 'vacant-dirty').length,
    highWorkOrders: wos.filter(w => w.priority === 'high' && w.status !== 'done').length,
    slaAtRisk: [...wos, ...cases].filter(x => ['at-risk', 'breached'].includes(x.sla.state)).length,
    onDuty: shifts.duty.filter(d => d.on).length,
    newFeedback: fb.filter(f => f.status === 'new').length,
    metrics,
    now: new Date().toISOString()
  });
});

/* ---------- Shift ---------- */
router.get('/shift', requireModule('shift'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const shifts = read('shifts', {})[prop] || { duty: [], checklist: [], tasks: [], handover: null };
  const brief = await composeBrief(prop);
  send(req, res, { ...shifts, brief, meetingBrief: meetingBrief(prop) });
});

router.post('/shift/checklist/:cid/toggle', requireModule('shift'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  await update('shifts', s => {
    const item = (s[prop]?.checklist || []).find(c => c.id === req.params.cid);
    if (item) item.done = !item.done;
  }, {});
  audit(req.user, 'shift.checklist.toggle', { property: prop, item: req.params.cid });
  send(req, res, { ok: true });
});

router.post('/shift/tasks', requireModule('shift'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const task = { id: id('t'), title: String(req.body.title || '').slice(0, 200), assignee: req.body.assignee || null, status: 'open', createdAt: new Date().toISOString() };
  if (!task.title) return res.status(400).json({ error: 'Title required' });
  await update('shifts', s => { (s[prop] ||= { duty: [], checklist: [], tasks: [] }).tasks.push(task); }, {});
  audit(req.user, 'shift.task.create', { property: prop, task: task.id });
  send(req, res, task);
});

router.patch('/shift/tasks/:tid', requireModule('shift'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  await update('shifts', s => {
    const t = (s[prop]?.tasks || []).find(x => x.id === req.params.tid);
    if (t) {
      if (req.body.status) t.status = req.body.status;
      if ('assignee' in req.body) t.assignee = req.body.assignee;
    }
  }, {});
  audit(req.user, 'shift.task.update', { property: prop, task: req.params.tid, ...req.body });
  send(req, res, { ok: true });
});

router.post('/shift/duty', requireModule('shift'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const on = !!req.body.on;
  await update('shifts', s => {
    const duty = (s[prop] ||= { duty: [], checklist: [], tasks: [] }).duty;
    let me = duty.find(d => d.email === req.user.email);
    if (!me) { me = { email: req.user.email, name: req.user.name }; duty.push(me); }
    me.on = on; me.since = new Date().toISOString();
  }, {});
  audit(req.user, on ? 'shift.duty.on' : 'shift.duty.off', { property: prop });
  send(req, res, { ok: true, on });
});

router.post('/shift/handover', requireModule('shift'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const note = String(req.body.note || '').slice(0, 4000);
  if (!note) return res.status(400).json({ error: 'Handover note required' });
  await update('shifts', s => {
    (s[prop] ||= { duty: [], checklist: [], tasks: [] }).handover = { from: req.user.email, at: new Date().toISOString(), note, readBy: [] };
  }, {});
  audit(req.user, 'shift.handover.write', { property: prop });
  send(req, res, { ok: true });
});

router.post('/shift/handover/ack', requireModule('shift'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  await update('shifts', s => {
    const h = s[prop]?.handover;
    if (h && !h.readBy.some(r => r.email === req.user.email)) {
      h.readBy.push({ email: req.user.email, name: req.user.name, at: new Date().toISOString() });
    }
  }, {});
  audit(req.user, 'shift.handover.ack', { property: prop });
  send(req, res, { ok: true });
});

/* ---------- Units ---------- */
router.get('/units', requireModule('units'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const units = byProp('units', prop);
  send(req, res, { units, summary: occupancySummary(units), dataMode: PROPERTIES.find(p => p.id === prop)?.live ? (process.env.SHEETS_OCCUPANCY_ID ? 'live' : 'live-stub') : 'awaiting-data' });
});

const UNIT_STATUSES = ['occupied', 'vacant-ready', 'vacant-dirty', 'arriving', 'departing', 'out-of-order'];
router.post('/units/:uid/status', requireModule('units'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const status = req.body.status;
  if (!UNIT_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
  let found = false;
  await update('units', units => {
    const u = units.find(x => x.id === req.params.uid && x.property === prop);
    if (u) { u.status = status; found = true; }
  }, []);
  if (!found) return res.status(404).json({ error: 'Unit not found' });
  audit(req.user, 'units.status', { property: prop, unit: req.params.uid, status });
  send(req, res, { ok: true });
});

/* ---------- Moves ---------- */
router.get('/moves', requireModule('moves'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const residents = byProp('residents', prop);
  const moves = byProp('moves', prop).map(m => ({
    ...m,
    residentName: residents.find(r => r.id === m.resident)?.name || null,
    progress: m.checklist.filter(c => c.done).length + '/' + m.checklist.length
  }));
  send(req, res, { moves });
});

router.post('/moves/:mid/checklist/:index', requireModule('moves'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  await update('moves', moves => {
    const m = moves.find(x => x.id === req.params.mid && x.property === prop);
    const item = m?.checklist[Number(req.params.index)];
    if (item) {
      item.done = !item.done;
      if (m.checklist.every(c => c.done)) m.status = 'done';
      else if (m.status === 'done') m.status = 'in-progress';
    }
  }, []);
  audit(req.user, 'moves.checklist.toggle', { property: prop, move: req.params.mid, index: req.params.index });
  send(req, res, { ok: true });
});

/* ---------- Housekeeping ---------- */
router.get('/housekeeping', requireModule('housekeeping'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const units = byProp('units', prop);
  const board = units
    .filter(u => u.status === 'vacant-dirty' || u.status === 'arriving' || u.status === 'departing')
    .sort((a, b) => {
      const rank = s => s === 'arriving' ? 0 : s === 'vacant-dirty' ? 1 : 2;
      return rank(a.status) - rank(b.status) || a.id.localeCompare(b.id);
    });
  send(req, res, { board, toClean: units.filter(u => u.status === 'vacant-dirty').length });
});

router.post('/housekeeping/:uid/clean', requireModule('housekeeping'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  let ok = false;
  await update('units', units => {
    const u = units.find(x => x.id === req.params.uid && x.property === prop);
    if (u && (u.status === 'vacant-dirty' || u.status === 'departing')) { u.status = 'vacant-ready'; ok = true; }
  }, []);
  if (!ok) return res.status(400).json({ error: 'Unit is not on the turn board' });
  audit(req.user, 'housekeeping.clean', { property: prop, unit: req.params.uid });
  send(req, res, { ok: true });
});

/* ---------- Maintenance (work orders) ---------- */
router.get('/workorders', requireModule('maintenance'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const assignees = ORG.filter(u => (u.property === prop || !u.property) && ['maintenance_manager', 'agm', 'gm'].includes(u.role))
    .map(u => ({ email: u.email, name: u.name }));
  send(req, res, { workorders: withSla(byProp('workorders', prop)), assignees });
});

router.post('/workorders', requireModule('maintenance'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const { title, category = 'General', priority = 'normal', unit = null } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  if (!['high', 'normal', 'low'].includes(priority)) return res.status(400).json({ error: 'Bad priority' });
  const wo = { id: id('wo'), property: prop, title: String(title).slice(0, 200), category, priority, status: 'open', unit, createdAt: new Date().toISOString(), createdBy: req.user.email, assignee: null, history: [] };
  await update('workorders', list => { list.push(wo); }, []);
  audit(req.user, 'workorders.create', { property: prop, id: wo.id, priority });
  send(req, res, { ...wo, sla: slaState(wo) });
});

router.patch('/workorders/:wid', requireModule('maintenance'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  let out = null;
  await update('workorders', list => {
    const w = list.find(x => x.id === req.params.wid && x.property === prop);
    if (!w) return;
    for (const k of ['status', 'assignee', 'priority']) {
      if (k in req.body && w[k] !== req.body[k]) {
        w.history.push({ at: new Date().toISOString(), by: req.user.email, field: k, from: w[k], to: req.body[k] });
        w[k] = req.body[k];
      }
    }
    out = w;
  }, []);
  if (!out) return res.status(404).json({ error: 'Work order not found' });
  audit(req.user, 'workorders.update', { property: prop, id: req.params.wid, ...req.body });
  send(req, res, { ...out, sla: slaState(out) });
});

/* ---------- Cases ---------- */
router.get('/cases', requireModule('cases'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  send(req, res, { cases: withSla(byProp('cases', prop)) });
});

router.post('/cases', requireModule('cases'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const { title, category = 'admin', priority = 'normal' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const c = { id: id('case'), property: prop, title: String(title).slice(0, 200), category, priority, status: 'open', createdAt: new Date().toISOString(), createdBy: req.user.email, assignee: null, linkedFeedback: req.body.linkedFeedback || null, history: [] };
  await update('cases', list => { list.push(c); }, []);
  audit(req.user, 'cases.create', { property: prop, id: c.id });
  send(req, res, { ...c, sla: slaState(c) });
});

router.patch('/cases/:cid', requireModule('cases'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  let out = null;
  await update('cases', list => {
    const c = list.find(x => x.id === req.params.cid && x.property === prop);
    if (!c) return;
    for (const k of ['status', 'assignee', 'priority']) if (k in req.body) c[k] = req.body[k];
    out = c;
  }, []);
  if (!out) return res.status(404).json({ error: 'Case not found' });
  audit(req.user, 'cases.update', { property: prop, id: req.params.cid, ...req.body });
  send(req, res, { ...out, sla: slaState(out) });
});

/* ---------- Residents ---------- */
router.get('/residents', requireModule('residents'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  send(req, res, { residents: byProp('residents', prop) });
});

router.get('/residents/:rid', requireModule('residents'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const r = byProp('residents', prop).find(x => x.id === req.params.rid);
  if (!r) return res.status(404).json({ error: 'Not found' });
  send(req, res, {
    resident: r,
    feedback: byProp('feedback', prop).filter(f => f.resident === r.id),
    cases: withSla(byProp('cases', prop).filter(c => c.resident === r.id || byProp('feedback', prop).some(f => f.resident === r.id && f.linkedCase === c.id))),
    moves: byProp('moves', prop).filter(m => m.resident === r.id)
  });
});

router.post('/residents/:rid/notes', requireModule('residents'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const text = String(req.body.text || '').slice(0, 2000);
  if (!text) return res.status(400).json({ error: 'Note required' });
  await update('residents', list => {
    const r = list.find(x => x.id === req.params.rid && x.property === prop);
    if (r) (r.notes ||= []).push({ at: new Date().toISOString(), by: req.user.email, text });
  }, []);
  audit(req.user, 'residents.note', { property: prop, resident: req.params.rid });
  send(req, res, { ok: true });
});

router.post('/residents/:rid/milestones/:index', requireModule('residents'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  await update('residents', list => {
    const r = list.find(x => x.id === req.params.rid && x.property === prop);
    const m = r?.milestones[Number(req.params.index)];
    if (m) m.done = !m.done;
  }, []);
  audit(req.user, 'residents.milestone', { property: prop, resident: req.params.rid, index: req.params.index });
  send(req, res, { ok: true });
});

const STAGES = ['prospect', 'onboarding', 'active', 'renewal', 'departed'];
router.post('/residents/:rid/stage', requireModule('residents'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  if (!STAGES.includes(req.body.stage)) return res.status(400).json({ error: 'Unknown stage' });
  await update('residents', list => {
    const r = list.find(x => x.id === req.params.rid && x.property === prop);
    if (r) r.stage = req.body.stage;
  }, []);
  audit(req.user, 'residents.stage', { property: prop, resident: req.params.rid, stage: req.body.stage });
  send(req, res, { ok: true });
});

// Draft-only compose. Returns text; never sends anything anywhere.
router.post('/residents/:rid/compose', requireModule('residents'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const r = byProp('residents', prop).find(x => x.id === req.params.rid);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const firstName = r.name.split(' ')[0];
  const templates = {
    welcome: `Welcome home, ${firstName}.

Your unit ${r.unit || ''} is ready and your community is live — events on the calendar, services a message away, and a team that answers in real time. Anything you need, reply here and it is handled.

— The PULSE team`,
    'check-in': `A quick check-in from PULSE, ${firstName}.

How is life in ${r.unit ? `unit ${r.unit}` : 'your home'} so far. If anything is off, tell us — we move fast.

— The PULSE team`,
    renewal: `${firstName}, your stay is coming up for renewal.

We would love to keep you in the community. Reply here and we will walk you through the options.

— The PULSE team`
  };
  const draft = templates[req.body.template] || templates['check-in'];
  audit(req.user, 'residents.compose.draft', { property: prop, resident: r.id, template: req.body.template });
  send(req, res, { draft, draftOnly: true, note: 'Draft only — this tool never sends messages.' });
});

/* ---------- Feedback ---------- */
router.get('/feedback', requireModule('feedback'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const residents = byProp('residents', prop);
  send(req, res, {
    feedback: byProp('feedback', prop).map(f => ({ ...f, residentName: residents.find(r => r.id === f.resident)?.name || 'Unknown' })),
    dataMode: 'sample'
  });
});

const TRIAGE = ['new', 'actioned', 'thanked', 'resolved', 'dismissed'];
router.post('/feedback/:fid/triage', requireModule('feedback'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  if (!TRIAGE.includes(req.body.status)) return res.status(400).json({ error: 'Unknown status' });
  await update('feedback', list => {
    const f = list.find(x => x.id === req.params.fid && x.property === prop);
    if (f) f.status = req.body.status;
  }, []);
  audit(req.user, 'feedback.triage', { property: prop, id: req.params.fid, status: req.body.status });
  send(req, res, { ok: true });
});

// Escalate a feedback item into a linked, SLA-tracked case.
router.post('/feedback/:fid/escalate', requireModule('feedback'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const f = byProp('feedback', prop).find(x => x.id === req.params.fid);
  if (!f) return res.status(404).json({ error: 'Not found' });
  if (f.linkedCase) return res.status(409).json({ error: 'Already escalated', caseId: f.linkedCase });
  const c = {
    id: id('case'), property: prop,
    title: `Feedback follow-up: ${f.text.slice(0, 80)}`,
    category: 'facilities', priority: f.sentiment === 'negative' ? 'high' : 'normal',
    status: 'open', createdAt: new Date().toISOString(), createdBy: req.user.email,
    assignee: null, linkedFeedback: f.id, resident: f.resident, history: []
  };
  await update('cases', list => { list.push(c); }, []);
  await update('feedback', list => {
    const x = list.find(y => y.id === f.id);
    if (x) { x.linkedCase = c.id; x.status = 'actioned'; }
  }, []);
  audit(req.user, 'feedback.escalate', { property: prop, feedback: f.id, case: c.id });
  send(req, res, { ok: true, case: { ...c, sla: slaState(c) } });
});

/* ---------- Events ---------- */
router.get('/events', requireModule('events'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const residents = byProp('residents', prop);
  send(req, res, {
    events: byProp('events', prop).map(e => ({
      ...e,
      rsvpNames: e.rsvps.map(rid => residents.find(r => r.id === rid)?.name).filter(Boolean)
    })),
    residents: residents.map(r => ({ id: r.id, name: r.name }))
  });
});

router.post('/events', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const { title, when, where = '', capacity = 20 } = req.body;
  if (!title || !when) return res.status(400).json({ error: 'Title and time required' });
  const e = { id: id('ev'), property: prop, title: String(title).slice(0, 120), when, where, capacity, rsvps: [], attended: [] };
  await update('events', list => { list.push(e); }, []);
  audit(req.user, 'events.create', { property: prop, id: e.id });
  send(req, res, e);
});

router.post('/events/:eid/rsvp', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  await update('events', list => {
    const e = list.find(x => x.id === req.params.eid && x.property === prop);
    if (e && req.body.resident) {
      const i = e.rsvps.indexOf(req.body.resident);
      i >= 0 ? e.rsvps.splice(i, 1) : e.rsvps.push(req.body.resident);
    }
  }, []);
  audit(req.user, 'events.rsvp', { property: prop, event: req.params.eid, resident: req.body.resident });
  send(req, res, { ok: true });
});

router.post('/events/:eid/attendance', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  await update('events', list => {
    const e = list.find(x => x.id === req.params.eid && x.property === prop);
    if (e && req.body.resident) {
      const i = e.attended.indexOf(req.body.resident);
      i >= 0 ? e.attended.splice(i, 1) : e.attended.push(req.body.resident);
    }
  }, []);
  audit(req.user, 'events.attendance', { property: prop, event: req.params.eid, resident: req.body.resident });
  send(req, res, { ok: true });
});

/* ---------- Operations ---------- */
router.get('/operations', requireModule('operations'), (req, res) => {
  const metrics = read('metrics', {});
  const allUnits = read('units', []);
  const scoped = PROPERTIES; // operations roles are portfolio/region scoped by matrix
  const board = scoped.map(p => {
    const units = allUnits.filter(u => u.property === p.id);
    return {
      ...p,
      occupancy: units.length ? occupancySummary(units) : null,
      ...(metrics[p.id] || { dataMode: { occupancy: 'awaiting-data' } })
    };
  });
  const live = board.filter(b => b.occupancy);
  const rollup = {
    weightedOccupancy: live.length ? +(live.reduce((s, b) => s + b.occupancy.occupancyRate * b.occupancy.total, 0) / live.reduce((s, b) => s + b.occupancy.total, 0)).toFixed(3) : null,
    propertiesLive: live.length, propertiesTotal: scoped.length,
    revenue: live.reduce((s, b) => s + (b.revenue || 0), 0),
    cost: live.reduce((s, b) => s + (b.cost || 0), 0),
    reserve: live.reduce((s, b) => s + (b.reserve || 0), 0),
    noi: live.reduce((s, b) => s + (b.noi || 0), 0),
    csat: live.length ? +(live.reduce((s, b) => s + (b.csat || 0), 0) / live.filter(b => b.csat).length || 0).toFixed(2) : null
  };
  send(req, res, { board, rollup, financialsVisible: seesFinancials(req.user), financialsSource: process.env.YARDI_API_KEY ? 'yardi' : 'sample' });
});

router.get('/operations/trends', requireModule('operations'), (req, res) => {
  send(req, res, { trends: read('trends', {}) });
});

/* ---------- Oversight ---------- */
router.get('/oversight', requireModule('oversight'), (req, res) => {
  const shifts = read('shifts', {});
  const board = PROPERTIES.map(p => {
    const s = shifts[p.id];
    if (!s) return { property: p, status: 'awaiting-data' };
    return {
      property: p,
      onDuty: s.duty.filter(d => d.on),
      offDuty: s.duty.filter(d => !d.on),
      checklistDone: s.checklist?.filter(c => c.done).length || 0,
      checklistTotal: s.checklist?.length || 0,
      openTasks: s.tasks?.filter(t => t.status === 'open') || [],
      handover: s.handover ? { from: s.handover.from, at: s.handover.at, readCount: s.handover.readBy.length, note: s.handover.note } : null
    };
  });
  send(req, res, { board });
});

/* ---------- Global search ---------- */
router.get('/search', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  const q = String(req.query.q || '').toLowerCase().trim();
  if (q.length < 2) return send(req, res, { results: [] });
  const results = [];
  const can = m => MODULE_ACCESS[m].includes(req.user.role);
  const scope = new Set((req.user.property ? [req.user.property] : PROPERTIES.map(p => p.id)));
  const inScope = x => scope.has(x.property);
  const push = (module, title, sub, hash) => results.push({ module, title, sub, hash });
  if (can('units')) for (const u of read('units', []).filter(inScope)) if (u.id.includes(q) || u.status.includes(q)) push('units', `Unit ${u.id}`, u.status, '#/units');
  if (can('residents')) for (const r of read('residents', []).filter(inScope)) if (r.name.toLowerCase().includes(q) || (r.unit || '').includes(q)) push('residents', r.name, `${r.stage}${r.unit ? ' · unit ' + r.unit : ''}`, `#/residents/${r.id}`);
  if (can('maintenance')) for (const w of read('workorders', []).filter(inScope)) if (w.title.toLowerCase().includes(q)) push('maintenance', w.title, `${w.priority} · ${w.status}`, '#/maintenance');
  if (can('cases')) for (const c of read('cases', []).filter(inScope)) if (c.title.toLowerCase().includes(q)) push('cases', c.title, c.status, '#/cases');
  if (can('feedback')) for (const f of read('feedback', []).filter(inScope)) if (f.text.toLowerCase().includes(q)) push('feedback', f.text.slice(0, 60), f.sentiment, '#/feedback');
  if (can('events')) for (const e of read('events', []).filter(inScope)) if (e.title.toLowerCase().includes(q)) push('events', e.title, e.where, '#/events');
  send(req, res, { results: results.slice(0, 20) });
});

export default router;
