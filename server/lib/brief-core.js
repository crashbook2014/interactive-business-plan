// Pure briefing core — no filesystem imports, shared by server and the
// in-browser demo build.
import { slaState } from './sla.js';

export function detectConflicts(cal) {
  const conflicts = [];
  const sorted = [...cal].sort((a, b) => new Date(a.at) - new Date(b.at));
  for (let i = 0; i < sorted.length - 1; i++) {
    const aEnd = new Date(sorted[i].at).getTime() + (sorted[i].durationMin || 30) * 60000;
    const bStart = new Date(sorted[i + 1].at).getTime();
    if (bStart < aEnd) {
      conflicts.push({
        a: sorted[i].title, b: sorted[i + 1].title,
        note: `“${sorted[i].title}” overlaps “${sorted[i + 1].title}” — assign different owners or shift one.`
      });
    }
  }
  return conflicts;
}

// Pure composer — also used by the in-browser demo build.
export function composeCore({ signals, units, wos, moves }) {
  const arriving = units.filter(u => u.status === 'arriving');
  const dirty = units.filter(u => u.status === 'vacant-dirty');
  const highWos = wos.filter(w => w.priority === 'high' && w.status !== 'done');
  const atRisk = wos.filter(w => ['at-risk', 'breached'].includes(slaState(w).state));
  const conflicts = detectConflicts(signals.calendar);

  const actions = [];
  let p = 1;
  for (const w of highWos) actions.push({ priority: p++, title: `Push work order: ${w.title}`, why: `High priority, SLA ${slaState(w).state}`, module: 'maintenance' });
  if (arriving.length) actions.push({ priority: p++, title: `Confirm readiness for ${arriving.length} arriving unit${arriving.length > 1 ? 's' : ''} (${arriving.map(u => u.id).join(', ')})`, why: 'Arrivals due today', module: 'moves' });
  if (dirty.length) actions.push({ priority: p++, title: `Clear ${dirty.length} vacant-dirty unit${dirty.length > 1 ? 's' : ''} — arrivals first`, why: 'Turn board backlog', module: 'housekeeping' });
  for (const m of moves.slice(0, 2)) {
    const open = m.checklist.filter(c => !c.done).length;
    actions.push({ priority: p++, title: `${m.kind === 'move-in' ? 'Move-in' : 'Move-out'} ${m.unit}: ${open} checklist items open`, why: `Due ${new Date(m.due).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' })}`, module: 'moves' });
  }
  for (const g of signals.gmail.slice(0, 2)) actions.push({ priority: p++, title: `Reply: ${g.subject}`, why: `Email from ${g.from}`, module: 'shift' });
  for (const c of conflicts) actions.push({ priority: p++, title: `Resolve schedule conflict`, why: c.note, module: 'shift' });

  const summary = [
    `${arriving.length} arrival${arriving.length === 1 ? '' : 's'} due, ${dirty.length} unit${dirty.length === 1 ? '' : 's'} to turn, ${highWos.length} high-priority work order${highWos.length === 1 ? '' : 's'}.`,
    atRisk.length ? `${atRisk.length} work order${atRisk.length === 1 ? ' is' : 's are'} at-risk or breached on SLA.` : 'No SLA breaches at the moment.',
    conflicts.length ? `${conflicts.length} calendar conflict${conflicts.length === 1 ? ' needs' : 's need'} attention.` : 'Calendar is clean.'
  ].join(' ');

  return {
    generatedAt: new Date().toISOString(),
    engine: 'deterministic',
    dataMode: signals.mode,
    summary,
    actions,
    conflicts,
    calendar: signals.calendar,
    slack: signals.slack,
    gmail: signals.gmail
  };
}

export function meetingCore(b) {
  return {
    at: '15:00 Asia/Riyadh',
    headline: b.summary,
    agenda: [
      'Arrivals and unit readiness',
      'High-priority work orders and SLA risks',
      'Open moves and checklists',
      'Resident feedback needing action',
      'Handover items for the evening shift'
    ],
    topActions: b.actions.slice(0, 5)
  };
}
