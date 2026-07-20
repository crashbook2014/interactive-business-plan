import React, { useState } from 'react';
import { api, useData, Icon, Pill, DataModePill, Check } from './ui.jsx';
import { useApp } from './App.jsx';

const q = (prop) => `?property=${encodeURIComponent(prop)}`;

export const Loading = () => <p className="muted">Loading…</p>;
export const Err = ({ e }) => (
  <div className="card"><h2>{e.status === 403 ? 'Not available for your role or compound' : 'Something went wrong'}</h2><p className="muted">{e.message}</p></div>
);
export const alertErr = e => window.alert(e.message);

/* ================= HOME ================= */
export function Home() {
  const { user, property } = useApp();
  const { data, error } = useData(`/dashboard${q(property)}`, { refreshMs: 20_000 });
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="grid">
      <div>
        <h1>{greet}, {user.name.split(' ')[0]}</h1>
        <p className="muted">{user.roleTitle} · {user.scope === 'property' ? data.property?.name : user.scope === 'portfolio' ? 'Riyadh portfolio' : 'MENA region'}</p>
      </div>
      <div className="command" aria-label="Command center">
        {[
          ['Events live', data.eventsLive, data.eventsLive > 0],
          ['In planning', data.eventsPlanning, false],
          ['Journeys at risk', data.journeysAtRisk, data.journeysAtRisk > 0],
          ['New feedback', data.newFeedback, data.newFeedback > 2],
          ['SLA at-risk', data.slaAtRisk, data.slaAtRisk > 0],
          ['On duty', data.onDuty, false],
          ['Avg event score', data.avgEventScore ?? '—', false]
        ].map(([l, n, alert]) => (
          <div key={l} className={`cc ${alert ? 'alert' : ''}`}><div className="n">{n}</div><div className="l">{l}</div></div>
        ))}
      </div>
      <div className="card white">
        <div className="row spread"><h2>Today at {data.property?.name}</h2><DataModePill mode={data.metrics?.dataMode?.experience || 'sample'} /></div>
        <p className="muted">
          {data.eventsLive ? `${data.eventsLive} event${data.eventsLive > 1 ? 's' : ''} running today. ` : 'No live events today. '}
          {data.journeysAtRisk ? `${data.journeysAtRisk} journey${data.journeysAtRisk > 1 ? 's' : ''} need${data.journeysAtRisk === 1 ? 's' : ''} a rescue touch. ` : 'All journeys on course. '}
          {data.newFeedback ? `${data.newFeedback} new feedback item${data.newFeedback > 1 ? 's' : ''} waiting.` : 'Feedback inbox is clear.'}
        </p>
      </div>
    </div>
  );
}

/* ================= SHIFT ================= */
export function Shift() {
  const { user, property } = useApp();
  const { data, error, reload } = useData(`/shift${q(property)}`, { refreshMs: 45_000 });
  const [note, setNote] = useState('');
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const b = data.brief;
  const me = data.duty?.find(d => d.email === user.email);
  const act = (p, body) => api(p + q(property), { method: 'POST', body }).then(reload).catch(alertErr);
  return (
    <div className="grid g2">
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="row spread">
          <h1>Master of the Day</h1>
          <div className="row">
            <Pill tone={b.engine === 'anthropic' ? 'good' : 'muted'}>{b.engine === 'anthropic' ? 'AI brief' : 'deterministic brief'}</Pill>
            <DataModePill mode={b.dataMode} />
          </div>
        </div>
        <p className="mt">{b.summary}</p>
        {b.conflicts?.length > 0 && (
          <div className="mt">{b.conflicts.map((c, i) => <p key={i}><Pill tone="warn">conflict</Pill> {c.note}</p>)}</div>
        )}
      </div>

      <div className="card white">
        <h2>Action plan</h2>
        <div className="table-wrap"><table className="table"><tbody>
          {b.actions.map(a => (
            <tr key={a.priority}><td style={{ width: 30 }}><strong>{a.priority}</strong></td>
              <td>{a.title}<div className="muted" style={{ fontSize: '.78rem' }}>{a.why}</div></td>
              <td style={{ textAlign: 'right' }}><a className="btn small" href={`#/${a.module}`}>Open</a></td></tr>
          ))}
        </tbody></table></div>
      </div>

      <div className="card white">
        <h2>Shift checklist</h2>
        {data.checklist?.map(c => (
          <Check key={c.id} done={c.done} label={c.item} onToggle={() => act(`/shift/checklist/${c.id}/toggle`)} />
        ))}
        <h2 className="mt">Tasks</h2>
        {data.tasks?.map(t => (
          <Check key={t.id} done={t.status === 'done'} label={t.title} sub={t.assignee ? t.assignee.split('@')[0] : 'unassigned'}
            onToggle={() => api(`/shift/tasks/${t.id}${q(property)}`, { method: 'PATCH', body: { status: t.status === 'done' ? 'open' : 'done' } }).then(reload)} />
        ))}
        <div className="row mt">
          <input type="text" placeholder="New task…" value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 2, minWidth: 140 }} />
          <select value={assignee} onChange={e => setAssignee(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
            <option value="">Unassigned</option>
            {data.duty?.map(d => <option key={d.email} value={d.email}>{d.name}</option>)}
          </select>
          <button className="btn small" disabled={!title.trim()} onClick={() => { act('/shift/tasks', { title, assignee: assignee || null }); setTitle(''); }}><Icon name="plus" size={13} /> Add</button>
        </div>
      </div>

      <div className="card white">
        <div className="row spread"><h2>On duty</h2>
          <button className="btn small" onClick={() => act('/shift/duty', { on: !me?.on })}>{me?.on ? 'Go off duty' : 'Go on duty'}</button>
        </div>
        {data.duty?.map(d => (
          <div key={d.email} className="row spread mt" style={{ marginTop: 6 }}>
            <span>{d.name}</span>
            <Pill tone={d.on ? 'good' : 'muted'}>{d.on ? 'on duty' : 'off'}</Pill>
          </div>
        ))}
      </div>

      <div className="card white">
        <h2>Handover</h2>
        {data.handover ? (
          <>
            <p className="muted" style={{ fontSize: '.78rem' }}>From {data.handover.from} · {new Date(data.handover.at).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' })}</p>
            <p>{data.handover.note}</p>
            <div className="row">
              <Pill tone={data.handover.readBy?.length ? 'good' : 'warn'}>read by {data.handover.readBy?.length || 0}</Pill>
              {!data.handover.readBy?.some(r => r.email === user.email) &&
                <button className="btn small" onClick={() => act('/shift/handover/ack')}>Mark as read</button>}
            </div>
          </>
        ) : <p className="muted">No handover yet.</p>}
        <textarea className="mt" placeholder="Write your handover note…" value={note} onChange={e => setNote(e.target.value)} />
        <button className="btn small mt" disabled={!note.trim()} onClick={() => { act('/shift/handover', { note }); setNote(''); }}>Publish handover</button>
      </div>

      <div className="card">
        <h2>15:00 meeting brief</h2>
        <p className="mt">{data.meetingBrief?.headline}</p>
        <ol style={{ paddingLeft: 18, margin: '8px 0' }}>
          {data.meetingBrief?.agenda.map((a, i) => <li key={i}>{a}</li>)}
        </ol>
        <h3>Signals</h3>
        <div className="table-wrap"><table className="table"><tbody>
          {b.calendar?.map((c, i) => <tr key={'c' + i}><td><Pill tone="ok">calendar</Pill></td><td>{c.title} · {new Date(c.at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' })} · {c.where}</td></tr>)}
          {b.slack?.map((s, i) => <tr key={'s' + i}><td><Pill tone="muted">slack</Pill></td><td><strong>{s.from}</strong> in {s.channel}: {s.text}</td></tr>)}
          {b.gmail?.map((g, i) => <tr key={'g' + i}><td><Pill tone="warn">gmail</Pill></td><td><strong>{g.subject}</strong> — {g.snippet}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>
  );
}
