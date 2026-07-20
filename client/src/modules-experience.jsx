// Journeys, Events studio, Clients — the experience layer.
import React, { useState } from 'react';
import qrcode from 'qrcode-generator';
import { api, useData, Icon, Pill, SlaPill, DataModePill } from './ui.jsx';
import { useApp } from './App.jsx';
import { Loading, Err, alertErr } from './modules-core.jsx';

const q = (prop) => `?property=${encodeURIComponent(prop)}`;
const fmtSAR = n => n == null ? '—' : `SAR ${Math.round(n).toLocaleString('en-GB')}`;
const dt = (s, o = {}) => new Date(s).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...o });
const pct = v => v == null ? '—' : `${Math.round(v * 100)}%`;

export function ScoreBadge({ scorecard }) {
  if (!scorecard) return <Pill tone="muted">no data yet</Pill>;
  const tone = scorecard.tier === 'Exceptional' ? 'good' : scorecard.tier === 'Strong' ? 'ok' : scorecard.tier === 'Solid' ? 'muted' : 'bad';
  return <Pill tone={tone}><Icon name="star" size={11} /> {scorecard.score} · {scorecard.tier}</Pill>;
}

/* ================= JOURNEYS ================= */
export function Journeys() {
  const { property } = useApp();
  const { data, error } = useData(`/journeys${q(property)}`, { refreshMs: 60_000 });
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  return (
    <div className="grid">
      <div className="row spread"><h1>Journey Designer</h1>
        {data.atRisk.length > 0 && <Pill tone="warn">{data.atRisk.length} at risk</Pill>}
      </div>
      {data.journeys.map(j => (
        <div key={j.id} className="card white">
          <div className="row spread">
            <h2>{j.name}</h2>
            <Pill tone="muted">{j.stats.travelers} {j.kind === 'resident' ? 'residents' : 'clients'} on the journey</Pill>
          </div>
          <div className="journey mt">
            {j.stats.stages.map((s, si) => (
              <div key={si} className="jstage">
                <div className="jname">{si + 1}. {s.name}</div>
                {s.completion !== undefined && (
                  <div className="jbar"><div className="jfill" style={{ width: pct(s.completion) }} /></div>
                )}
                <div className="jmeta">
                  {s.travelersHere > 0 && <Pill tone="ok">{s.travelersHere} here</Pill>}
                  {s.avgScore != null && <Pill tone={s.avgScore >= 4.5 ? 'good' : s.avgScore >= 4 ? 'muted' : 'warn'}>{s.avgScore}/5</Pill>}
                  {s.completion !== undefined && <span className="muted" style={{ fontSize: '.72rem' }}>{pct(s.completion)} done</span>}
                </div>
                <ul className="jtp">{s.touchpoints.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
          {j.kind === 'resident' && j.stats.completedJourney > 0 &&
            <p className="muted mt" style={{ fontSize: '.8rem' }}>{j.stats.completedJourney} resident{j.stats.completedJourney > 1 ? 's have' : ' has'} completed the full journey — advocacy achieved.</p>}
        </div>
      ))}
      {data.atRisk.length > 0 && (
        <div className="card">
          <h2>Rescue list</h2>
          <p className="muted" style={{ fontSize: '.82rem' }}>Journeys with a low-scored or stalled touchpoint — reach out personally today.</p>
          <div className="row mt">
            {data.atRisk.map(r => <a key={r.id} className="btn small" href={`#/residents/${r.id}`}>{r.name}</a>)}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= EVENTS (studio) ================= */
const STATUS_TONE = { concept: 'muted', planning: 'warn', ready: 'ok', live: 'bad', 'wrap-up': 'ok', reported: 'good' };
export function Events({ param }) {
  const { property } = useApp();
  const { data, error, reload } = useData(`/events${q(property)}`, { refreshMs: 45_000 });
  const [form, setForm] = useState({ title: '', when: '', where: '' });
  const [open, setOpen] = useState(param || null);
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const ev = data.events.find(e => e.id === open);
  if (ev) return <EventDetail e={ev} team={data.team} back={() => { setOpen(null); reload(); }} reload={reload} />;
  return (
    <div className="grid">
      <h1>Event Studio</h1>
      <div className="card white">
        <div className="row">
          <input type="text" placeholder="New event concept…" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ flex: 2, minWidth: 170 }} />
          <input type="datetime-local" value={form.when} onChange={e => setForm({ ...form, when: e.target.value })} style={{ flex: 1, minWidth: 150, border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', background: '#FFFDF9' }} />
          <input type="text" placeholder="Where" value={form.where} onChange={e => setForm({ ...form, where: e.target.value })} style={{ flex: 1, minWidth: 100 }} />
          <button className="btn small accent" disabled={!form.title.trim() || !form.when} onClick={() =>
            api(`/events${q(property)}`, { method: 'POST', body: { ...form, when: new Date(form.when).toISOString() } }).then(() => { setForm({ title: '', when: '', where: '' }); reload(); }).catch(alertErr)
          }><Icon name="plus" size={13} /> Create</button>
        </div>
      </div>
      <div className="grid g2">
        {[...data.events].sort((a, b) => new Date(b.when) - new Date(a.when)).map(e => (
          <div key={e.id} className="card white" style={{ cursor: 'pointer' }} onClick={() => setOpen(e.id)}>
            <div className="row spread">
              <strong>{e.title}</strong>
              <Pill tone={STATUS_TONE[e.status]}>{e.status}</Pill>
            </div>
            <p className="muted" style={{ fontSize: '.8rem' }}>{dt(e.when)} · {e.where}{e.clientName ? ` · for ${e.clientName}` : ''}</p>
            <div className="row">
              <ScoreBadge scorecard={e.scorecard} />
              {e.openTasks > 0 && <Pill tone="warn">{e.openTasks} tasks open</Pill>}
              {e.rsvps > 0 && <Pill tone="muted">{e.rsvps} RSVPs</Pill>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventDetail({ e, team, back, reload }) {
  const { property } = useApp();
  const [tab, setTab] = useState('report');
  const [task, setTask] = useState({ item: '', owner: '' });
  const [row, setRow] = useState({ time: '', item: '', owner: '' });
  const [survey, setSurvey] = useState({ csat: 5, comment: '' });
  const [guest, setGuest] = useState('');
  const [codeIn, setCodeIn] = useState('');
  const [lastTicket, setLastTicket] = useState(null);
  const [budget, setBudget] = useState({ label: '', planned: '' });
  const { user } = useApp();
  const act = (p, body) => api(p + q(property), { method: 'POST', body }).then(reload).catch(alertErr);
  const patch = body => api(`/events/${e.id}${q(property)}`, { method: 'PATCH', body }).then(reload).catch(alertErr);
  const sc = e.scorecard;
  return (
    <div className="grid">
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <a className="muted" style={{ fontSize: '.8rem', cursor: 'pointer' }} onClick={back}>← All events</a>
        <div className="row spread mt">
          <div><h1>{e.title}</h1>
            <p className="muted">{dt(e.when)} · {e.where} · capacity {e.capacity}{e.clientName ? ` · for ${e.clientName}` : ''}</p></div>
          <div className="row">
            <ScoreBadge scorecard={sc} />
            <select value={e.status} onChange={x => patch({ status: x.target.value })} style={{ width: 'auto' }}>
              {['concept', 'planning', 'ready', 'live', 'wrap-up', 'reported'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="row mt">
          {['report', 'checklist', 'run-of-show', 'tickets', 'survey', ...(user.financials ? ['p&l'] : [])].map(t => (
            <button key={t} className={`btn small ${tab === t ? 'accent' : ''}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      {tab === 'report' && (
        <div className="card white">
          <h2>Event report {sc?.tier === 'Exceptional' && <Pill tone="good"><Icon name="star" size={11} /> Exceptional</Pill>}</h2>
          {sc ? (
            <>
              <div className="grid g4 mt">
                <div className="kpi"><div className="n">{sc.score}</div><div className="l">Experience score</div></div>
                <div className="kpi"><div className="n">{sc.avgCsat ?? '—'}</div><div className="l">Avg satisfaction /5</div></div>
                <div className="kpi"><div className="n">{pct(sc.attendanceRate)}</div><div className="l">Attendance rate</div></div>
                <div className="kpi"><div className="n">{sc.responses}</div><div className="l">Survey responses</div></div>
              </div>
              {sc.testimonials.length > 0 && (
                <div className="mt">
                  <h3>Guest voices</h3>
                  {sc.testimonials.map((t, i) => <p key={i} style={{ fontFamily: 'var(--font-head)', fontStyle: 'italic' }}>“{t}”</p>)}
                </div>
              )}
              {e.reportSentAt && <p className="muted mt" style={{ fontSize: '.78rem' }}>Report sent {dt(e.reportSentAt)}</p>}
            </>
          ) : <p className="muted">The report builds itself as check-ins and survey responses arrive.</p>}
        </div>
      )}

      {tab === 'checklist' && (
        <div className="card white">
          <h2>Planning checklist</h2>
          {e.checklist.map((c, i) => (
            <div key={i} className={`check ${c.done ? 'done' : ''}`} onClick={() => act(`/events/${e.id}/checklist`, { toggle: i })}>
              <span className="box">{c.done && <Icon name="check" size={12} />}</span>
              <span className="lbl">{c.item}<span className="muted" style={{ fontSize: '.74rem' }}> · {c.owner ? c.owner.split('@')[0] : 'unowned'}{c.due ? ` · due ${dt(c.due, { hour: undefined, minute: undefined })}` : ''}</span></span>
            </div>
          ))}
          <div className="row mt">
            <input type="text" placeholder="Add task…" value={task.item} onChange={x => setTask({ ...task, item: x.target.value })} style={{ flex: 2, minWidth: 150 }} />
            <select value={task.owner} onChange={x => setTask({ ...task, owner: x.target.value })} style={{ flex: 1, minWidth: 130 }}>
              <option value="">Owner…</option>
              {team.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
            </select>
            <button className="btn small" disabled={!task.item.trim()} onClick={() => { act(`/events/${e.id}/checklist`, { add: task.item, owner: task.owner || null }); setTask({ item: '', owner: '' }); }}><Icon name="plus" size={13} /> Add</button>
          </div>
        </div>
      )}

      {tab === 'run-of-show' && (
        <div className="card white">
          <h2>Run of show</h2>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Time</th><th>Moment</th><th>Owner</th></tr></thead>
            <tbody>{e.runOfShow.map((r, i) => <tr key={i}><td><strong>{r.time}</strong></td><td>{r.item}</td><td>{r.owner}</td></tr>)}</tbody>
          </table></div>
          <div className="row mt">
            <input type="text" placeholder="18:30" value={row.time} onChange={x => setRow({ ...row, time: x.target.value })} style={{ width: 80 }} />
            <input type="text" placeholder="Moment…" value={row.item} onChange={x => setRow({ ...row, item: x.target.value })} style={{ flex: 2, minWidth: 140 }} />
            <input type="text" placeholder="Owner" value={row.owner} onChange={x => setRow({ ...row, owner: x.target.value })} style={{ flex: 1, minWidth: 100 }} />
            <button className="btn small" disabled={!row.time || !row.item} onClick={() => { act(`/events/${e.id}/runofshow`, row); setRow({ time: '', item: '', owner: '' }); }}><Icon name="plus" size={13} /> Add</button>
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="grid g2">
          <div className="card white">
            <h2>Registration</h2>
            <div className="grid g3 mt">
              <div className="kpi"><div className="n">{e.rsvps}</div><div className="l">Registered</div></div>
              <div className="kpi"><div className="n">{e.attended}</div><div className="l">Checked in</div></div>
              <div className="kpi"><div className="n">{e.capacity}</div><div className="l">Capacity</div></div>
            </div>
            <div className="row mt">
              <input type="text" placeholder="Guest name…" value={guest} onChange={x => setGuest(x.target.value)} style={{ flex: 2, minWidth: 150 }} />
              <button className="btn small accent" disabled={!guest.trim()} onClick={() =>
                api(`/events/${e.id}/tickets${q(property)}`, { method: 'POST', body: { name: guest } })
                  .then(t => { setLastTicket(t); setGuest(''); reload(); }).catch(alertErr)
              }><Icon name="plus" size={13} /> Issue ticket</button>
            </div>
            {lastTicket && <TicketCard ticket={lastTicket} event={e} />}
            <h3 className="mt">Check-in by code</h3>
            <div className="row">
              <input type="text" placeholder="Ticket code, e.g. A1B2C3" value={codeIn} onChange={x => setCodeIn(x.target.value)} style={{ flex: 1, minWidth: 120 }} />
              <button className="btn small" disabled={!codeIn.trim()} onClick={() =>
                api(`/events/${e.id}/checkin${q(property)}`, { method: 'POST', body: { code: codeIn } })
                  .then(r => { setCodeIn(''); reload(); window.alert(`Welcome, ${r.ticket.name}`); }).catch(alertErr)
              }><Icon name="check" size={13} /> Check in</button>
            </div>
          </div>
          <div className="card white">
            <h2>Ticket list</h2>
            {(e.tickets || []).length === 0 && <p className="muted">No tickets issued yet.</p>}
            {(e.tickets || []).map(t => (
              <div key={t.id} className="row spread" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                <span>{t.name} <span className="muted" style={{ fontSize: '.74rem' }}>· {t.code}</span></span>
                {t.checkedInAt
                  ? <Pill tone="good">in · {dt(t.checkedInAt, { day: undefined, month: undefined })}</Pill>
                  : <button className="btn small" onClick={() =>
                      api(`/events/${e.id}/checkin${q(property)}`, { method: 'POST', body: { ticketId: t.id, code: t.code } }).then(reload).catch(alertErr)
                    }>Check in</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'p&l' && user.financials && (
        <div className="card white">
          <h2>Event P&L <Pill tone="sample">sample · GM+ only</Pill></h2>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Line</th><th>Planned</th><th>Actual</th><th>Variance</th></tr></thead>
            <tbody>
              {(e.budgetLines || []).map((l, i) => (
                <tr key={i}>
                  <td>{l.label}</td>
                  <td>{fmtSAR(l.planned)}</td>
                  <td><input type="text" defaultValue={l.actual} onBlur={x =>
                    api(`/events/${e.id}/budget${q(property)}`, { method: 'POST', body: { line: i, actual: Number(x.target.value) || 0 } }).then(reload).catch(alertErr)
                  } style={{ width: 90, padding: '3px 6px' }} /></td>
                  <td style={{ color: l.actual > l.planned ? 'var(--wine)' : 'var(--brass)' }}>{fmtSAR(l.planned - l.actual)}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Total</strong></td>
                <td><strong>{fmtSAR((e.budgetLines || []).reduce((s, l) => s + l.planned, 0))}</strong></td>
                <td><strong>{fmtSAR((e.budgetLines || []).reduce((s, l) => s + l.actual, 0))}</strong></td>
                <td><strong>{fmtSAR((e.budgetLines || []).reduce((s, l) => s + l.planned - l.actual, 0))}</strong></td>
              </tr>
            </tbody>
          </table></div>
          <div className="row mt">
            <input type="text" placeholder="New line…" value={budget.label} onChange={x => setBudget({ ...budget, label: x.target.value })} style={{ flex: 2, minWidth: 140 }} />
            <input type="text" placeholder="Planned SAR" value={budget.planned} onChange={x => setBudget({ ...budget, planned: x.target.value })} style={{ width: 110 }} />
            <button className="btn small" disabled={!budget.label.trim()} onClick={() => {
              api(`/events/${e.id}/budget${q(property)}`, { method: 'POST', body: { add: budget.label, planned: Number(budget.planned) || 0 } }).then(() => { setBudget({ label: '', planned: '' }); reload(); }).catch(alertErr);
            }}><Icon name="plus" size={13} /> Add line</button>
          </div>
        </div>
      )}

      {tab === 'survey' && (
        <div className="card white">
          <h2>Post-event survey</h2>
          {e.surveys.map((s, i) => (
            <p key={i} style={{ fontSize: '.88rem' }}><Pill tone={s.csat >= 4 ? 'good' : s.csat === 3 ? 'muted' : 'bad'}>{s.csat}/5</Pill> {s.comment}</p>
          ))}
          <div className="row mt">
            <select value={survey.csat} onChange={x => setSurvey({ ...survey, csat: Number(x.target.value) })} style={{ width: 90 }}>
              {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n}/5</option>)}
            </select>
            <input type="text" placeholder="Comment…" value={survey.comment} onChange={x => setSurvey({ ...survey, comment: x.target.value })} style={{ flex: 2, minWidth: 160 }} />
            <button className="btn small" onClick={() => { act(`/events/${e.id}/survey`, survey); setSurvey({ csat: 5, comment: '' }); }}>Record response</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= CLIENTS ================= */
const STAGES = ['inquiry', 'proposal', 'planning', 'event-day', 'report-renewal'];
const STAGE_LABEL = { inquiry: 'Inquiry', proposal: 'Proposal', planning: 'Planning', 'event-day': 'Event day', 'report-renewal': 'Report & renewal' };
export function Clients() {
  const { user, property } = useApp();
  const { data, error, reload } = useData(`/clients${q(property)}`, { refreshMs: 60_000 });
  const [name, setName] = useState('');
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const patch = (id, body) => api(`/clients/${id}${q(property)}`, { method: 'PATCH', body }).then(reload).catch(alertErr);
  return (
    <div className="grid">
      <div className="row spread"><h1>Client pipeline</h1>
        {user.financials && data.pipelineValue != null && <Pill tone="sample">pipeline {fmtSAR(data.pipelineValue)} · sample</Pill>}
      </div>
      <div className="card white">
        <div className="row">
          <input type="text" placeholder="New client company…" value={name} onChange={e => setName(e.target.value)} style={{ flex: 2, minWidth: 180 }} />
          <button className="btn small accent" disabled={!name.trim()} onClick={() =>
            api(`/clients${q(property)}`, { method: 'POST', body: { name } }).then(() => { setName(''); reload(); }).catch(alertErr)
          }><Icon name="plus" size={13} /> Add client</button>
        </div>
      </div>
      <div className="grid g2">
        {data.clients.map(c => (
          <div key={c.id} className="card white">
            <div className="row spread">
              <div><strong>{c.name}</strong><div className="muted" style={{ fontSize: '.76rem' }}>{c.contact} · with us since {dt(c.since, { hour: undefined, minute: undefined })}</div></div>
              <select value={c.stage} onChange={e => patch(c.id, { stage: e.target.value })} style={{ width: 'auto' }}>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="row mt">
              {c.satisfaction != null && <Pill tone={c.satisfaction >= 4.5 ? 'good' : 'muted'}>{c.satisfaction}/5 satisfaction</Pill>}
              {user.financials && c.contractValue != null && <Pill tone="sample">{fmtSAR(c.contractValue)}</Pill>}
            </div>
            {c.events?.length > 0 && (
              <div className="mt">
                {c.events.map(e => (
                  <p key={e.id} style={{ fontSize: '.84rem' }}>
                    <Pill tone={STATUS_TONE[e.status]}>{e.status}</Pill> {e.title} {e.scorecard && <ScoreBadge scorecard={e.scorecard} />}
                  </p>
                ))}
              </div>
            )}
            <p className="muted mt" style={{ fontSize: '.8rem' }}><Icon name="shift" size={12} /> Next: {c.nextStep}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TicketCard({ ticket, event }) {
  const qr = qrcode(0, 'M');
  qr.addData(`PULSE:${event.id}:${ticket.code}`);
  qr.make();
  const svg = qr.createSvgTag({ cellSize: 3, margin: 2 });
  return (
    <div className="card mt" style={{ background: 'var(--wine)', color: 'var(--warm)', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-head)', letterSpacing: '.3em', textTransform: 'uppercase', fontSize: '.9rem' }}>PULSE</div>
      <div style={{ fontSize: '.82rem', margin: '4px 0' }}>{event.title}</div>
      <div style={{ background: '#fff', display: 'inline-block', padding: 6, borderRadius: 8, marginTop: 6 }}
        dangerouslySetInnerHTML={{ __html: svg }} />
      <div style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem', letterSpacing: '.2em', marginTop: 6 }}>{ticket.code}</div>
      <div style={{ fontSize: '.8rem', opacity: .85 }}>{ticket.name}</div>
    </div>
  );
}

/* ================= LIVE OPS ================= */
export function LiveOps() {
  const { property } = useApp();
  const { data, error, reload } = useData(`/liveops${q(property)}`, { refreshMs: 15_000 });
  const [inc, setInc] = useState({ title: '', severity: 'medium' });
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const nowHM = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const sevTone = { low: 'muted', medium: 'warn', high: 'bad' };
  return (
    <div className="grid">
      <div className="row spread"><h1>Live Ops</h1>
        {data.alert
          ? <Pill tone="bad">HIGH INCIDENT OPEN</Pill>
          : <Pill tone="good">{data.onDuty.length} on duty · all clear</Pill>}
      </div>

      {data.events.length === 0 && <div className="card"><p className="muted">No events in ready, live, or wrap-up right now.</p></div>}
      {data.events.map(e => (
        <div key={e.id} className="card white">
          <div className="row spread">
            <h2>{e.title}</h2>
            <div className="row">
              <Pill tone="bad">{e.status}</Pill>
              <Pill tone="ok">checklist {e.checklistDone}/{e.checklistTotal}</Pill>
              <Pill tone="good">{e.attended} in · {e.rsvps} expected</Pill>
            </div>
          </div>
          <p className="muted" style={{ fontSize: '.8rem' }}>{e.where}</p>
          <div className="table-wrap mt"><table className="table">
            <thead><tr><th>Time</th><th>Moment</th><th>Owner</th><th></th></tr></thead>
            <tbody>
              {e.runOfShow.map((r, i) => {
                const past = r.time <= nowHM;
                const isNow = past && (i === e.runOfShow.length - 1 || e.runOfShow[i + 1].time > nowHM);
                return (
                  <tr key={i} style={{ opacity: past && !isNow ? .55 : 1 }}>
                    <td><strong>{r.time}</strong></td><td>{r.item}</td><td>{r.owner}</td>
                    <td>{isNow && <Pill tone="bad">NOW</Pill>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      ))}

      <div className="card white">
        <h2>Incidents</h2>
        <div className="row mt">
          <input type="text" placeholder="Report an incident…" value={inc.title} onChange={x => setInc({ ...inc, title: x.target.value })} style={{ flex: 3, minWidth: 170 }} />
          <select value={inc.severity} onChange={x => setInc({ ...inc, severity: x.target.value })} style={{ width: 100 }}>
            {['low', 'medium', 'high'].map(sv => <option key={sv}>{sv}</option>)}
          </select>
          <button className="btn small accent" disabled={!inc.title.trim()} onClick={() =>
            api(`/liveops/incidents${q(property)}`, { method: 'POST', body: inc }).then(() => { setInc({ title: '', severity: 'medium' }); reload(); }).catch(alertErr)
          }><Icon name="plus" size={13} /> Report</button>
        </div>
        <div className="table-wrap mt"><table className="table">
          <thead><tr><th>Incident</th><th>Severity</th><th>Status</th></tr></thead>
          <tbody>
            {data.incidents.map(i => (
              <tr key={i.id}>
                <td>{i.title}<div className="muted" style={{ fontSize: '.74rem' }}>{dt(i.at)} · {i.by.split('@')[0]}</div></td>
                <td><Pill tone={sevTone[i.severity]}>{i.severity}</Pill></td>
                <td><select value={i.status} onChange={x =>
                  api(`/liveops/incidents/${i.id}${q(property)}`, { method: 'PATCH', body: { status: x.target.value } }).then(reload).catch(alertErr)
                }>{['open', 'mitigating', 'resolved'].map(st => <option key={st}>{st}</option>)}</select></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
