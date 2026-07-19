import React, { useState } from 'react';
import { api, useData, Icon, Pill, SlaPill, DataModePill, Check, hrs } from './ui.jsx';
import { useApp } from './App.jsx';

const q = (prop) => `?property=${encodeURIComponent(prop)}`;

/* ================= HOME ================= */
export function Home() {
  const { user, property } = useApp();
  const { data, error } = useData(`/dashboard${q(property)}`, { refreshMs: 20_000 });
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const roleKpis = {
    rx: ['arrivalsDue', 'newFeedback', 'onDuty'], senior_rx: ['arrivalsDue', 'slaAtRisk', 'newFeedback'],
    housekeeping_manager: ['roomsToClean', 'arrivalsDue', 'onDuty'], maintenance_manager: ['highWorkOrders', 'slaAtRisk', 'onDuty'],
    gm: ['slaAtRisk', 'arrivalsDue', 'newFeedback'], agm: ['slaAtRisk', 'arrivalsDue', 'onDuty'],
    director: ['slaAtRisk', 'arrivalsDue', 'newFeedback'], ops_manager: ['slaAtRisk', 'arrivalsDue', 'newFeedback']
  };
  const labels = {
    arrivalsDue: 'Arrivals due', roomsToClean: 'Rooms to clean', highWorkOrders: 'High-priority work orders',
    slaAtRisk: 'SLA at-risk', onDuty: 'On duty now', newFeedback: 'New feedback'
  };
  return (
    <div className="grid">
      <div>
        <h1>{greet}, {user.name.split(' ')[0]}</h1>
        <p className="muted">{user.roleTitle} · {user.scope === 'property' ? data.property?.name : user.scope === 'portfolio' ? 'Riyadh portfolio' : 'MENA region'}</p>
      </div>
      <div className="command" aria-label="Command center">
        {[
          ['Occupancy', `${Math.round((data.occupancy?.occupancyRate || 0) * 100)}%`, false],
          ['Arrivals due', data.arrivalsDue, false],
          ['Rooms to clean', data.roomsToClean, data.roomsToClean > 3],
          ['High work orders', data.highWorkOrders, data.highWorkOrders > 0],
          ['SLA at-risk', data.slaAtRisk, data.slaAtRisk > 0],
          ['On duty', data.onDuty, false]
        ].map(([l, n, alert]) => (
          <div key={l} className={`cc ${alert ? 'alert' : ''}`}><div className="n">{n}</div><div className="l">{l}</div></div>
        ))}
      </div>
      <div className="grid g3">
        {(roleKpis[user.role] || []).map(k => (
          <div key={k} className="kpi"><div className="n">{data[k]}</div><div className="l">{labels[k]}</div></div>
        ))}
      </div>
      <div className="card white">
        <div className="row spread"><h2>Today at {data.property?.name}</h2><DataModePill mode={data.metrics?.dataMode?.occupancy || 'sample'} /></div>
        <p className="muted">{data.occupancy?.occupied} of {data.occupancy?.total} units occupied · {data.occupancy?.vacantReady} ready · {data.occupancy?.vacantDirty} to turn · {data.occupancy?.outOfOrder} out of order</p>
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

/* ================= UNITS ================= */
const STATUS_LABEL = { occupied: 'Occupied', 'vacant-ready': 'Ready', 'vacant-dirty': 'Dirty', arriving: 'Arriving', departing: 'Departing', 'out-of-order': 'Out of order' };
export function Units() {
  const { property } = useApp();
  const { data, error, reload } = useData(`/units${q(property)}`, { refreshMs: 30_000 });
  const [sel, setSel] = useState(null);
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const s = data.summary;
  return (
    <div className="grid">
      <div className="row spread">
        <h1>Units — RACK board</h1>
        <DataModePill mode={data.dataMode} />
      </div>
      <div className="grid g4">
        {[['Occupancy', `${Math.round(s.occupancyRate * 100)}%`], ['Occupied', s.occupied], ['Ready', s.vacantReady], ['To turn', s.vacantDirty], ['Arriving', s.arriving], ['Out of order', s.outOfOrder]]
          .map(([l, n]) => <div key={l} className="kpi"><div className="n">{n}</div><div className="l">{l}</div></div>)}
      </div>
      {data.units.length === 0 && <div className="card"><p className="muted">This property is awaiting occupancy data.</p></div>}
      <div className="rack">
        {data.units.map(u => (
          <div key={u.id} className={`room ${u.status}`} onClick={() => setSel(sel === u.id ? null : u.id)} title={u.corporateAccount || ''}>
            <div className="rid">{u.id}</div>
            <div className="rs">{STATUS_LABEL[u.status]}</div>
            {sel === u.id && (
              <select value={u.status} onClick={e => e.stopPropagation()} onChange={e =>
                api(`/units/${u.id}/status${q(property)}`, { method: 'POST', body: { status: e.target.value } }).then(() => { setSel(null); reload(); }).catch(alertErr)
              } style={{ marginTop: 6, fontSize: '.68rem', padding: '2px 4px' }}>
                {Object.keys(STATUS_LABEL).map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= MOVES ================= */
export function Moves() {
  const { property } = useApp();
  const { data, error, reload } = useData(`/moves${q(property)}`);
  const [open, setOpen] = useState(null);
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  return (
    <div className="grid">
      <h1>Moves</h1>
      {['move-in', 'move-out'].map(kind => (
        <div key={kind} className="card white">
          <h2>{kind === 'move-in' ? 'Move-in readiness' : 'Move-out turnover'}</h2>
          {data.moves.filter(m => m.kind === kind).map(m => (
            <div key={m.id} className="mt" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <div className="row spread">
                <div><strong>Unit {m.unit}</strong> · {m.residentName || '—'} <span className="muted">due {new Date(m.due).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
                <div className="row">
                  <Pill tone={m.status === 'done' ? 'good' : m.status === 'in-progress' ? 'warn' : 'muted'}>{m.status}</Pill>
                  <Pill tone="ok">{m.progress}</Pill>
                  <button className="btn small" onClick={() => setOpen(open === m.id ? null : m.id)}>{open === m.id ? 'Hide' : '30-point checklist'}</button>
                </div>
              </div>
              {open === m.id && (
                <div className="grid g2 mt">
                  {m.checklist.map((c, i) => (
                    <Check key={i} done={c.done} label={c.item}
                      onToggle={() => api(`/moves/${m.id}/checklist/${i}${q(property)}`, { method: 'POST' }).then(reload).catch(alertErr)} />
                  ))}
                </div>
              )}
            </div>
          ))}
          {!data.moves.some(m => m.kind === kind) && <p className="muted">Nothing scheduled.</p>}
        </div>
      ))}
    </div>
  );
}

/* ================= HOUSEKEEPING ================= */
export function Housekeeping() {
  const { property } = useApp();
  const { data, error, reload } = useData(`/housekeeping${q(property)}`, { refreshMs: 30_000 });
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  return (
    <div className="grid">
      <div className="row spread"><h1>Housekeeping — turn board</h1><Pill tone={data.toClean ? 'warn' : 'good'}>{data.toClean} to clean</Pill></div>
      <p className="muted">Arrivals first, then vacant-dirty, then departures.</p>
      <div className="grid g3">
        {data.board.map(u => (
          <div key={u.id} className="card white">
            <div className="row spread">
              <div><strong style={{ fontFamily: 'var(--font-head)', fontSize: '1.2rem' }}>{u.id}</strong><div className="muted" style={{ fontSize: '.78rem' }}>{u.type} · floor {u.floor}</div></div>
              <Pill tone={u.status === 'arriving' ? 'bad' : u.status === 'vacant-dirty' ? 'warn' : 'muted'}>{STATUS_LABEL[u.status]}</Pill>
            </div>
            {u.status !== 'arriving' &&
              <button className="btn small mt" onClick={() => api(`/housekeeping/${u.id}/clean${q(property)}`, { method: 'POST' }).then(reload).catch(alertErr)}>
                <Icon name="check" size={13} /> Mark clean
              </button>}
            {u.status === 'arriving' && <p className="muted mt" style={{ fontSize: '.78rem' }}>Arrival due — verify ready state with the desk.</p>}
          </div>
        ))}
        {!data.board.length && <div className="card"><p className="muted">Turn board is clear. Lovely.</p></div>}
      </div>
    </div>
  );
}

/* ================= MAINTENANCE ================= */
export function Maintenance() {
  const { property } = useApp();
  const { data, error, reload } = useData(`/workorders${q(property)}`, { refreshMs: 30_000 });
  const [form, setForm] = useState({ title: '', category: 'General', priority: 'normal', unit: '' });
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const upd = (id, body) => api(`/workorders/${id}${q(property)}`, { method: 'PATCH', body }).then(reload).catch(alertErr);
  return (
    <div className="grid">
      <h1>Maintenance — work orders</h1>
      <div className="card white">
        <div className="row">
          <input type="text" placeholder="Describe the issue…" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ flex: 3, minWidth: 180 }} />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ flex: 1, minWidth: 110 }}>
            {['HVAC', 'Plumbing', 'Electrical', 'Appliance', 'Doors & locks', 'General'].map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ flex: 1, minWidth: 90 }}>
            <option value="high">High (8h)</option><option value="normal">Normal (48h)</option><option value="low">Low (120h)</option>
          </select>
          <input type="text" placeholder="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={{ width: 70 }} />
          <button className="btn small accent" disabled={!form.title.trim()} onClick={() =>
            api(`/workorders${q(property)}`, { method: 'POST', body: { ...form, unit: form.unit || null } }).then(() => { setForm({ title: '', category: 'General', priority: 'normal', unit: '' }); reload(); }).catch(alertErr)
          }><Icon name="plus" size={13} /> Create</button>
        </div>
      </div>
      <div className="card white table-wrap">
        <table className="table">
          <thead><tr><th>Work order</th><th>Priority</th><th>SLA</th><th>Assignee</th><th>Status</th></tr></thead>
          <tbody>
            {data.workorders.map(w => (
              <tr key={w.id}>
                <td><strong>{w.title}</strong><div className="muted" style={{ fontSize: '.75rem' }}>{w.category}{w.unit ? ` · unit ${w.unit}` : ''} · opened {new Date(w.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></td>
                <td><Pill tone={w.priority === 'high' ? 'bad' : w.priority === 'normal' ? 'warn' : 'muted'}>{w.priority}</Pill></td>
                <td><SlaPill sla={w.sla} /></td>
                <td>
                  <select value={w.assignee || ''} onChange={e => upd(w.id, { assignee: e.target.value || null })} style={{ minWidth: 130 }}>
                    <option value="">Unassigned</option>
                    {data.assignees.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
                  </select>
                </td>
                <td>
                  <select value={w.status} onChange={e => upd(w.id, { status: e.target.value })}>
                    {['open', 'in-progress', 'done'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const Loading = () => <p className="muted">Loading…</p>;
export const Err = ({ e }) => (
  <div className="card"><h2>{e.status === 403 ? 'Not available for your role or property' : 'Something went wrong'}</h2><p className="muted">{e.message}</p></div>
);
export const alertErr = e => window.alert(e.message);
