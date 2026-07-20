// All module APIs. Every endpoint: auth → module gate → property scope → work.
// Financial redaction happens in send(); mutations are audit-logged.
import express from 'express';
import crypto from 'node:crypto';
import { read, update } from '../lib/store.js';
import { requireModule, resolveProperty, redactFinancials, seesFinancials } from '../lib/rbac.js';
import { withSla, slaState } from '../lib/sla.js';
import { audit } from '../lib/audit.js';
import { composeBrief, meetingBrief } from '../lib/brief.js';
import { eventScorecard, journeyStats, atRiskTravelers } from '../lib/brief-core.js';
import { PROPERTIES, ORG, MODULE_ACCESS } from '../config.js';

const router = express.Router();
router.use(express.json());

const id = p => `${p}-${crypto.randomBytes(4).toString('hex')}`;
const send = (req, res, data) => res.json(redactFinancials(data, req.user));
const byProp = (name, prop) => read(name, []).filter(x => x.property === prop);

/* ---------- Home / dashboard ---------- */
router.get('/dashboard', requireModule('home'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const events = byProp('events', prop);
  const residents = byProp('residents', prop);
  const fb = byProp('feedback', prop);
  const cases = withSla(byProp('cases', prop));
  const shifts = read('shifts', {})[prop] || { duty: [] };
  const reported = events.filter(e => e.status === 'reported').map(eventScorecard).filter(Boolean);
  send(req, res, {
    property: PROPERTIES.find(p => p.id === prop),
    eventsLive: events.filter(e => e.status === 'live').length,
    eventsPlanning: events.filter(e => ['planning', 'concept'].includes(e.status)).length,
    journeysAtRisk: atRiskTravelers(residents).length,
    newFeedback: fb.filter(f => f.status === 'new').length,
    slaAtRisk: cases.filter(x => ['at-risk', 'breached'].includes(x.sla.state)).length,
    onDuty: shifts.duty.filter(d => d.on).length,
    avgEventScore: reported.length ? Math.round(reported.reduce((s, r) => s + r.score, 0) / reported.length) : null,
    metrics: read('metrics', {})[prop] || {},
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

/* ---------- Journeys ---------- */
router.get('/journeys', requireModule('journeys'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const journeys = byProp('journeys', prop);
  const residents = byProp('residents', prop);
  const clients = byProp('clients', prop);
  send(req, res, {
    journeys: journeys.map(j => ({
      ...j,
      stats: j.kind === 'resident'
        ? journeyStats(j, residents)
        : { stages: j.stages.map((s, si) => ({ name: s.name, touchpoints: s.touchpoints, travelersHere: clients.filter(c => ['inquiry','proposal','planning','event-day','report-renewal'][si] === c.stage).length })), travelers: clients.length }
    })),
    atRisk: atRiskTravelers(residents).map(r => ({ id: r.id, name: r.name, stageIndex: r.stageIndex }))
  });
});

router.post('/journeys/resident/:rid/touchpoint', requireModule('journeys'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const { stage, index, done, score } = req.body;
  let ok = false;
  await update('residents', list => {
    const r = list.find(x => x.id === req.params.rid && x.property === prop);
    const tp = r?.touchpoints?.[Number(stage)]?.[Number(index)];
    if (tp) {
      if (done !== undefined) { tp.done = !!done; tp.at = tp.done ? new Date().toISOString() : null; }
      if (score !== undefined) tp.score = score === null ? null : Math.max(1, Math.min(5, Number(score)));
      // advance stageIndex to first incomplete stage
      r.stageIndex = r.touchpoints.findIndex(st => st.some(t => !t.done));
      if (r.stageIndex === -1) r.stageIndex = r.touchpoints.length - 1;
      ok = true;
    }
  }, []);
  if (!ok) return res.status(404).json({ error: 'Touchpoint not found' });
  audit(req.user, 'journeys.touchpoint', { property: prop, resident: req.params.rid, stage, index, done, score });
  send(req, res, { ok: true });
});

/* ---------- Events (studio) ---------- */
router.get('/events', requireModule('events'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const clients = byProp('clients', prop);
  send(req, res, {
    events: byProp('events', prop).map(e => ({
      ...e,
      clientName: clients.find(c => c.id === e.clientId)?.name || null,
      scorecard: eventScorecard(e),
      openTasks: e.checklist.filter(c => !c.done).length,
      ticketsIssued: (e.tickets || []).length,
      ticketsIn: (e.tickets || []).filter(t => t.checkedInAt).length
    })),
    team: ORG.filter(u => u.property === prop || !u.property).map(u => ({ email: u.email, name: u.name }))
  });
});

const EVENT_STATUSES = ['concept', 'planning', 'ready', 'live', 'wrap-up', 'reported'];
router.post('/events', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const { title, when, where = '', capacity = 50, kind = 'resident', clientId = null } = req.body;
  if (!title || !when) return res.status(400).json({ error: 'Title and time required' });
  const e = {
    id: id('ev'), property: prop, title: String(title).slice(0, 140), kind, clientId,
    when, where, capacity, status: 'concept', budget: null, spend: null,
    checklist: [], runOfShow: [], rsvps: 0, attended: 0, surveys: [], reportSentAt: null, tickets: [], budgetLines: []
  };
  await update('events', list => { list.push(e); }, []);
  audit(req.user, 'events.create', { property: prop, id: e.id });
  send(req, res, e);
});

router.patch('/events/:eid', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  let out = null;
  await update('events', list => {
    const e = list.find(x => x.id === req.params.eid && x.property === prop);
    if (!e) return;
    if (req.body.status && EVENT_STATUSES.includes(req.body.status)) {
      e.status = req.body.status;
      if (req.body.status === 'reported' && !e.reportSentAt) e.reportSentAt = new Date().toISOString();
    }
    for (const k of ['rsvps', 'attended']) if (k in req.body) e[k] = Math.max(0, Number(req.body[k]) || 0);
    out = e;
  }, []);
  if (!out) return res.status(404).json({ error: 'Event not found' });
  audit(req.user, 'events.update', { property: prop, id: req.params.eid, ...req.body });
  send(req, res, { ...out, scorecard: eventScorecard(out) });
});

router.post('/events/:eid/checklist', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  await update('events', list => {
    const e = list.find(x => x.id === req.params.eid && x.property === prop);
    if (!e) return;
    if (req.body.add) e.checklist.push({ item: String(req.body.add).slice(0, 160), owner: req.body.owner || null, due: req.body.due || null, done: false });
    else if (req.body.toggle !== undefined) { const c = e.checklist[Number(req.body.toggle)]; if (c) c.done = !c.done; }
  }, []);
  audit(req.user, 'events.checklist', { property: prop, event: req.params.eid, ...req.body });
  send(req, res, { ok: true });
});

router.post('/events/:eid/runofshow', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const { time, item, owner = '' } = req.body;
  if (!time || !item) return res.status(400).json({ error: 'Time and item required' });
  await update('events', list => {
    const e = list.find(x => x.id === req.params.eid && x.property === prop);
    if (e) {
      e.runOfShow.push({ time, item: String(item).slice(0, 160), owner });
      e.runOfShow.sort((a, b) => a.time.localeCompare(b.time));
    }
  }, []);
  audit(req.user, 'events.runofshow.add', { property: prop, event: req.params.eid });
  send(req, res, { ok: true });
});

router.post('/events/:eid/survey', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const csat = Math.max(1, Math.min(5, Number(req.body.csat)));
  if (!csat) return res.status(400).json({ error: 'Score 1-5 required' });
  let out = null;
  await update('events', list => {
    const e = list.find(x => x.id === req.params.eid && x.property === prop);
    if (e) { e.surveys.push({ csat, comment: String(req.body.comment || '').slice(0, 400) }); out = e; }
  }, []);
  if (!out) return res.status(404).json({ error: 'Event not found' });
  audit(req.user, 'events.survey.add', { property: prop, event: req.params.eid, csat });
  send(req, res, { ok: true, scorecard: eventScorecard(out) });
});


/* ---------- Tickets & check-in ---------- */
router.post('/events/:eid/tickets', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const name = String(req.body.name || '').slice(0, 120).trim();
  if (!name) return res.status(400).json({ error: 'Guest name required' });
  let ticket = null;
  await update('events', list => {
    const e = list.find(x => x.id === req.params.eid && x.property === prop);
    if (!e) return;
    ticket = {
      id: id('tk'), code: crypto.randomBytes(3).toString('hex').toUpperCase(),
      name, issuedAt: new Date().toISOString(), checkedInAt: null
    };
    (e.tickets ||= []).push(ticket);
    e.rsvps = (e.rsvps || 0) + 1;
  }, []);
  if (!ticket) return res.status(404).json({ error: 'Event not found' });
  audit(req.user, 'tickets.issue', { property: prop, event: req.params.eid, ticket: ticket.id });
  send(req, res, ticket);
});

router.post('/events/:eid/checkin', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const code = String(req.body.code || '').trim().toUpperCase();
  let result = null;
  await update('events', list => {
    const e = list.find(x => x.id === req.params.eid && x.property === prop);
    if (!e) return;
    const t = (e.tickets || []).find(x => x.code === code || x.id === req.body.ticketId);
    if (!t) { result = { error: 'Ticket not found' }; return; }
    if (t.checkedInAt) { result = { error: 'Already checked in', ticket: t }; return; }
    t.checkedInAt = new Date().toISOString();
    e.attended = (e.attended || 0) + 1;
    result = { ok: true, ticket: t, attended: e.attended };
  }, []);
  if (!result) return res.status(404).json({ error: 'Event not found' });
  if (result.error) return res.status(409).json(result);
  audit(req.user, 'tickets.checkin', { property: prop, event: req.params.eid, code });
  send(req, res, result);
});

/* ---------- Event P&L (budget lines — financial-gated) ---------- */
router.post('/events/:eid/budget', requireModule('events'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  if (!seesFinancials(req.user)) return res.status(403).json({ error: 'Financial access required' });
  let out = null;
  await update('events', list => {
    const e = list.find(x => x.id === req.params.eid && x.property === prop);
    if (!e) return;
    e.budgetLines ||= [];
    if (req.body.add) e.budgetLines.push({ label: String(req.body.add).slice(0, 120), planned: Number(req.body.planned) || 0, actual: 0 });
    else if (req.body.line !== undefined) {
      const l = e.budgetLines[Number(req.body.line)];
      if (l) { if ('actual' in req.body) l.actual = Number(req.body.actual) || 0; if ('planned' in req.body) l.planned = Number(req.body.planned) || 0; }
    }
    e.budget = e.budgetLines.reduce((s, l) => s + l.planned, 0);
    e.spend = e.budgetLines.reduce((s, l) => s + l.actual, 0);
    out = e;
  }, []);
  if (!out) return res.status(404).json({ error: 'Event not found' });
  audit(req.user, 'events.budget', { property: prop, event: req.params.eid });
  send(req, res, { ok: true, budgetLines: out.budgetLines, budget: out.budget, spend: out.spend });
});

/* ---------- Live Ops ---------- */
router.get('/liveops', requireModule('liveops'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const events = byProp('events', prop).filter(e => ['ready', 'live', 'wrap-up'].includes(e.status));
  const incidents = byProp('incidents', prop);
  const shifts = read('shifts', {})[prop] || { duty: [] };
  send(req, res, {
    events: events.map(e => ({
      id: e.id, title: e.title, when: e.when, where: e.where, status: e.status,
      runOfShow: e.runOfShow, checklistDone: e.checklist.filter(c => c.done).length,
      checklistTotal: e.checklist.length,
      ticketsIssued: (e.tickets || []).length, ticketsIn: (e.tickets || []).filter(t => t.checkedInAt).length,
      rsvps: e.rsvps, attended: e.attended
    })),
    incidents: incidents.sort((a, b) => new Date(b.at) - new Date(a.at)),
    onDuty: shifts.duty.filter(d => d.on),
    alert: incidents.some(i => i.severity === 'high' && i.status !== 'resolved')
  });
});

router.post('/liveops/incidents', requireModule('liveops'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const { title, severity = 'medium', eventId = null } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  if (!['low', 'medium', 'high'].includes(severity)) return res.status(400).json({ error: 'Bad severity' });
  const inc = { id: id('inc'), property: prop, eventId, title: String(title).slice(0, 200), severity, status: 'open', at: new Date().toISOString(), by: req.user.email };
  await update('incidents', list => { list.push(inc); }, []);
  audit(req.user, 'liveops.incident.create', { property: prop, id: inc.id, severity });
  send(req, res, inc);
});

router.patch('/liveops/incidents/:iid', requireModule('liveops'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  let out = null;
  await update('incidents', list => {
    const i = list.find(x => x.id === req.params.iid && x.property === prop);
    if (i && ['open', 'mitigating', 'resolved'].includes(req.body.status)) { i.status = req.body.status; out = i; }
  }, []);
  if (!out) return res.status(404).json({ error: 'Incident not found' });
  audit(req.user, 'liveops.incident.update', { property: prop, id: req.params.iid, status: req.body.status });
  send(req, res, out);
});

/* ---------- Clients (B2B pipeline) ---------- */
router.get('/clients', requireModule('clients'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const events = byProp('events', prop);
  send(req, res, {
    clients: byProp('clients', prop).map(c => ({
      ...c,
      events: events.filter(e => e.clientId === c.id).map(e => ({ id: e.id, title: e.title, status: e.status, scorecard: eventScorecard(e) }))
    })),
    pipelineValue: byProp('clients', prop).reduce((s, c) => s + (c.contractValue || 0), 0)
  });
});

const PIPELINE = ['inquiry', 'proposal', 'planning', 'event-day', 'report-renewal'];
router.post('/clients', requireModule('clients'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  if (!req.body.name) return res.status(400).json({ error: 'Name required' });
  const c = { id: id('cl'), property: prop, name: String(req.body.name).slice(0, 120), contact: req.body.contact || '', stage: 'inquiry', contractValue: null, since: new Date().toISOString(), satisfaction: null, eventIds: [], nextStep: req.body.nextStep || 'Discovery call to book', journeyId: 'jr-client' };
  await update('clients', list => { list.push(c); }, []);
  audit(req.user, 'clients.create', { property: prop, id: c.id });
  send(req, res, c);
});

router.patch('/clients/:cid', requireModule('clients'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  let out = null;
  await update('clients', list => {
    const c = list.find(x => x.id === req.params.cid && x.property === prop);
    if (!c) return;
    if (req.body.stage && PIPELINE.includes(req.body.stage)) c.stage = req.body.stage;
    for (const k of ['nextStep', 'satisfaction', 'contractValue']) if (k in req.body) c[k] = req.body[k];
    out = c;
  }, []);
  if (!out) return res.status(404).json({ error: 'Client not found' });
  audit(req.user, 'clients.update', { property: prop, id: req.params.cid, stage: req.body.stage });
  send(req, res, out);
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
  const journey = byProp('journeys', prop).find(j => j.id === r.journeyId);
  send(req, res, {
    resident: r, journey,
    feedback: byProp('feedback', prop).filter(f => f.resident === r.id),
    cases: withSla(byProp('cases', prop).filter(c => c.resident === r.id))
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

// Draft-only compose. Returns text; never sends anything anywhere.
router.post('/residents/:rid/compose', requireModule('residents'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const r = byProp('residents', prop).find(x => x.id === req.params.rid);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const firstName = r.name.split(' ')[0];
  const templates = {
    welcome: `Welcome home, ${firstName}.\n\nYour community is live — events on the calendar, services a message away, and a team that answers in real time. Anything you need, reply here and it is handled.\n\n— The PULSE team`,
    'event-invite': `${firstName}, you are invited.\n\nSomething special is coming up at the compound and we saved you a place. RSVP with one tap — we would love to see you there.\n\n— The PULSE team`,
    'check-in': `A quick check-in from PULSE, ${firstName}.\n\nHow is everything so far. If anything is off, tell us — we move fast.\n\n— The PULSE team`
  };
  audit(req.user, 'residents.compose.draft', { property: prop, resident: r.id, template: req.body.template });
  send(req, res, { draft: templates[req.body.template] || templates['check-in'], draftOnly: true });
});

/* ---------- Feedback ---------- */
router.get('/feedback', requireModule('feedback'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const residents = byProp('residents', prop);
  const events = byProp('events', prop);
  send(req, res, {
    feedback: byProp('feedback', prop).map(f => ({
      ...f,
      residentName: residents.find(r => r.id === f.resident)?.name || 'Unknown',
      eventTitle: events.find(e => e.id === f.eventId)?.title || null
    })),
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

router.post('/feedback/:fid/escalate', requireModule('feedback'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const f = byProp('feedback', prop).find(x => x.id === req.params.fid);
  if (!f) return res.status(404).json({ error: 'Not found' });
  if (f.linkedCase) return res.status(409).json({ error: 'Already escalated', caseId: f.linkedCase });
  const c = {
    id: id('case'), property: prop,
    title: `Feedback follow-up: ${f.text.slice(0, 80)}`,
    category: 'experience', priority: f.sentiment === 'negative' ? 'high' : 'normal',
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

/* ---------- Cases ---------- */
router.get('/cases', requireModule('cases'), (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  send(req, res, { cases: withSla(byProp('cases', prop)) });
});

router.post('/cases', requireModule('cases'), async (req, res) => {
  const prop = resolveProperty(req, res); if (!prop) return;
  const { title, category = 'production', priority = 'normal' } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const c = { id: id('case'), property: prop, title: String(title).slice(0, 200), category, priority, status: 'open', createdAt: new Date().toISOString(), createdBy: req.user.email, assignee: null, linkedFeedback: null, history: [] };
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

/* ---------- Experience dashboard ---------- */
router.get('/experience', requireModule('experience'), (req, res) => {
  const metrics = read('metrics', {});
  const allEvents = read('events', []);
  const allResidents = read('residents', []);
  const journeysAll = read('journeys', []);
  const board = PROPERTIES.map(p => ({ ...p, ...(metrics[p.id] || { dataMode: { experience: 'awaiting-data' } }) }));
  const reported = allEvents.filter(e => e.status === 'reported').map(e => ({ id: e.id, title: e.title, when: e.when, kind: e.kind, scorecard: eventScorecard(e) }));
  const testimonials = reported.flatMap(e => (e.scorecard?.testimonials || []).map(t => ({ text: t, event: e.title })));
  const rj = journeysAll.find(j => j.kind === 'resident');
  send(req, res, {
    board,
    rollup: {
      eventsReported: reported.length,
      exceptional: reported.filter(e => e.scorecard?.tier === 'Exceptional').length,
      avgEventScore: reported.length ? Math.round(reported.reduce((s, e) => s + (e.scorecard?.score || 0), 0) / reported.length) : null,
      journey: rj ? journeyStats(rj, allResidents) : null,
      atRisk: atRiskTravelers(allResidents).length
    },
    reported, testimonials: testimonials.slice(0, 8),
    financialsVisible: seesFinancials(req.user), financialsSource: 'sample'
  });
});

router.get('/experience/trends', requireModule('experience'), (req, res) => {
  send(req, res, { trends: read('trends', {}) });
});

/* ---------- Oversight ---------- */
router.get('/oversight', requireModule('oversight'), (req, res) => {
  const shifts = read('shifts', {});
  const allEvents = read('events', []);
  send(req, res, {
    board: PROPERTIES.map(p => {
      const s = shifts[p.id];
      if (!s) return { property: p, status: 'awaiting-data' };
      return {
        property: p,
        onDuty: s.duty.filter(d => d.on), offDuty: s.duty.filter(d => !d.on),
        checklistDone: s.checklist?.filter(c => c.done).length || 0,
        checklistTotal: s.checklist?.length || 0,
        openTasks: s.tasks?.filter(t => t.status === 'open') || [],
        liveEvents: allEvents.filter(e => e.property === p.id && e.status === 'live').map(e => e.title),
        handover: s.handover ? { from: s.handover.from, at: s.handover.at, readCount: s.handover.readBy.length, note: s.handover.note } : null
      };
    })
  });
});

/* ---------- Global search ---------- */
router.get('/search', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  const q = String(req.query.q || '').toLowerCase().trim();
  if (q.length < 2) return send(req, res, { results: [] });
  const results = [];
  const can = m => MODULE_ACCESS[m].includes(req.user.role);
  const scope = new Set(req.user.property ? [req.user.property] : PROPERTIES.map(p => p.id));
  const inScope = x => scope.has(x.property);
  const push = (module, title, sub, hash) => results.push({ module, title, sub, hash });
  if (can('events')) for (const e of read('events', []).filter(inScope)) if (e.title.toLowerCase().includes(q)) push('events', e.title, e.status, '#/events');
  if (can('residents')) for (const r of read('residents', []).filter(inScope)) if (r.name.toLowerCase().includes(q)) push('residents', r.name, `stage ${r.stageIndex + 1}`, `#/residents/${r.id}`);
  if (can('clients')) for (const c of read('clients', []).filter(inScope)) if (c.name.toLowerCase().includes(q)) push('clients', c.name, c.stage, '#/clients');
  if (can('feedback')) for (const f of read('feedback', []).filter(inScope)) if (f.text.toLowerCase().includes(q)) push('feedback', f.text.slice(0, 60), f.sentiment, '#/feedback');
  if (can('cases')) for (const c of read('cases', []).filter(inScope)) if (c.title.toLowerCase().includes(q)) push('cases', c.title, c.status, '#/cases');
  send(req, res, { results: results.slice(0, 20) });
});

export default router;
