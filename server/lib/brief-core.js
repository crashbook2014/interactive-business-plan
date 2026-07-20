// Pure briefing core — no filesystem imports, shared by server and the
// in-browser demo build. Composes the Master of the Day plan from events,
// journeys, feedback and calendar signals.
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

// Travelers whose current stage has a low-scored or fully stalled touchpoint set.
export function atRiskTravelers(residents) {
  return residents.filter(r =>
    r.touchpoints?.some(stage => stage.some(t => t.done && t.score !== null && t.score <= 3)) ||
    (r.touchpoints?.[r.stageIndex] || []).every(t => !t.done)
  );
}

export function composeCore({ signals, events, residents, feedback, cases }) {
  const soon = events.filter(e => ['live', 'planning'].includes(e.status));
  const live = events.filter(e => e.status === 'live');
  const openChecklist = e => e.checklist.filter(c => !c.done).length;
  const newFb = feedback.filter(f => f.status === 'new');
  const negFb = newFb.filter(f => f.sentiment === 'negative');
  const risky = atRiskTravelers(residents);
  const hotCases = (cases || []).filter(c => c.priority === 'high' && !['resolved', 'closed'].includes(c.status));
  const conflicts = detectConflicts(signals.calendar);

  const actions = [];
  let p = 1;
  for (const e of live) actions.push({ priority: p++, title: `Run today: ${e.title} (${e.rsvps} RSVPs)`, why: `Live event — ${openChecklist(e)} checklist items open`, module: 'events' });
  for (const c of hotCases) actions.push({ priority: p++, title: `Resolve: ${c.title}`, why: `High priority, SLA ${slaState(c).state}`, module: 'cases' });
  for (const f of negFb.slice(0, 2)) actions.push({ priority: p++, title: `Personal follow-up on negative feedback`, why: `“${f.text.slice(0, 70)}…”`, module: 'feedback' });
  for (const e of events.filter(x => x.status === 'planning').slice(0, 2)) {
    actions.push({ priority: p++, title: `Advance planning: ${e.title}`, why: `${openChecklist(e)} checklist items open`, module: 'events' });
  }
  if (risky.length) actions.push({ priority: p++, title: `Rescue ${risky.length} at-risk journey${risky.length > 1 ? 's' : ''}`, why: 'Low-scored or stalled touchpoints', module: 'journeys' });
  for (const g of signals.gmail.slice(0, 2)) actions.push({ priority: p++, title: `Reply: ${g.subject}`, why: `Email from ${g.from}`, module: 'shift' });
  for (const c of conflicts) actions.push({ priority: p++, title: 'Resolve schedule conflict', why: c.note, module: 'shift' });

  const summary = [
    `${live.length} event${live.length === 1 ? '' : 's'} running today, ${soon.length - live.length} in planning.`,
    `${newFb.length} new feedback item${newFb.length === 1 ? '' : 's'}${negFb.length ? ` (${negFb.length} negative — handle personally)` : ''}.`,
    risky.length ? `${risky.length} journey${risky.length === 1 ? ' is' : 's are'} at risk.` : 'All tracked journeys are on course.',
    conflicts.length ? `${conflicts.length} calendar conflict${conflicts.length === 1 ? ' needs' : 's need'} attention.` : 'Calendar is clean.'
  ].join(' ');

  return {
    generatedAt: new Date().toISOString(),
    engine: 'deterministic',
    dataMode: signals.mode,
    summary, actions, conflicts,
    calendar: signals.calendar, slack: signals.slack, gmail: signals.gmail
  };
}

export function meetingCore(b) {
  return {
    at: '15:00 Asia/Riyadh',
    headline: b.summary,
    agenda: [
      'Today’s events and run-of-show owners',
      'Upcoming events: planning checklist gaps',
      'At-risk journeys and rescue actions',
      'New feedback needing action',
      'Client pipeline movements',
      'Handover items for the evening shift'
    ],
    topActions: b.actions.slice(0, 5)
  };
}

/* ---- Event scorecard: is this event "exceptional"? ---- */
export function eventScorecard(e) {
  if (!e.surveys?.length && !e.attended) return null;
  const avgCsat = e.surveys.length ? +(e.surveys.reduce((s, x) => s + x.csat, 0) / e.surveys.length).toFixed(2) : null;
  const attendanceRate = e.rsvps ? +(e.attended / e.rsvps).toFixed(3) : null;
  const testimonials = e.surveys.filter(s => s.csat === 5 && s.comment).map(s => s.comment);
  let score = 0;
  if (avgCsat) score += (avgCsat / 5) * 60;
  if (attendanceRate) score += Math.min(attendanceRate, 1) * 30;
  if (testimonials.length) score += 10;
  score = Math.round(score);
  const tier = score >= 90 ? 'Exceptional' : score >= 75 ? 'Strong' : score >= 60 ? 'Solid' : 'Needs review';
  return { avgCsat, attendanceRate, responses: e.surveys.length, testimonials, score, tier };
}

/* ---- Journey stats across travelers ---- */
export function journeyStats(journey, travelers) {
  const stages = journey.stages.map((s, si) => {
    let done = 0, total = 0, scoreSum = 0, scoreN = 0;
    for (const t of travelers) {
      const stage = t.touchpoints?.[si] || [];
      for (const tp of stage) {
        total++;
        if (tp.done) done++;
        if (tp.score != null) { scoreSum += tp.score; scoreN++; }
      }
    }
    return {
      name: s.name, touchpoints: s.touchpoints,
      completion: total ? +(done / total).toFixed(3) : 0,
      avgScore: scoreN ? +(scoreSum / scoreN).toFixed(2) : null,
      travelersHere: travelers.filter(t => t.stageIndex === si).length
    };
  });
  const finished = travelers.filter(t => t.touchpoints?.every(st => st.every(tp => tp.done))).length;
  return { stages, travelers: travelers.length, completedJourney: finished };
}
