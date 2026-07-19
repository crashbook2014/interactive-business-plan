import React, { useState } from 'react';
import { api, useData, Icon, Pill, SlaPill, DataModePill, Check, Spark } from './ui.jsx';
import { useApp } from './App.jsx';
import { Loading, Err, alertErr } from './modules-frontdesk.jsx';

const q = (prop) => `?property=${encodeURIComponent(prop)}`;
const fmtSAR = n => n == null ? '—' : `SAR ${Math.round(n).toLocaleString('en-GB')}`;
const dt = (s, o = {}) => new Date(s).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...o });

/* ================= CASES ================= */
export function Cases() {
  const { property } = useApp();
  const { data, error, reload } = useData(`/cases${q(property)}`, { refreshMs: 45_000 });
  const [form, setForm] = useState({ title: '', category: 'facilities', priority: 'normal' });
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const upd = (id, body) => api(`/cases/${id}${q(property)}`, { method: 'PATCH', body }).then(reload).catch(alertErr);
  return (
    <div className="grid">
      <h1>Cases</h1>
      <div className="card white">
        <div className="row">
          <input type="text" placeholder="Describe the issue…" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ flex: 3, minWidth: 180 }} />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {['facilities', 'admin', 'it', 'security'].map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="high">High (8h)</option><option value="normal">Normal (48h)</option><option value="low">Low (120h)</option>
          </select>
          <button className="btn small accent" disabled={!form.title.trim()} onClick={() =>
            api(`/cases${q(property)}`, { method: 'POST', body: form }).then(() => { setForm({ title: '', category: 'facilities', priority: 'normal' }); reload(); }).catch(alertErr)
          }><Icon name="plus" size={13} /> Open case</button>
        </div>
      </div>
      <div className="card white table-wrap">
        <table className="table">
          <thead><tr><th>Case</th><th>Category</th><th>SLA</th><th>Status</th></tr></thead>
          <tbody>
            {data.cases.map(c => (
              <tr key={c.id}>
                <td><strong>{c.title}</strong>
                  <div className="muted" style={{ fontSize: '.75rem' }}>opened {dt(c.createdAt)} by {c.createdBy?.split('@')[0]}
                    {c.linkedFeedback && <> · <Pill tone="ok">from feedback</Pill></>}</div></td>
                <td><Pill tone="muted">{c.category}</Pill></td>
                <td><SlaPill sla={c.sla} /></td>
                <td><select value={c.status} onChange={e => upd(c.id, { status: e.target.value })}>
                  {['open', 'in-progress', 'resolved', 'closed'].map(s => <option key={s}>{s}</option>)}
                </select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= RESIDENTS ================= */
const STAGES = ['prospect', 'onboarding', 'active', 'renewal', 'departed'];
export function Residents({ param }) {
  const { property } = useApp();
  if (param) return <Resident360 rid={param} />;
  return <ResidentList property={property} />;
}

function ResidentList({ property }) {
  const { data, error } = useData(`/residents${q(property)}`);
  const [stage, setStage] = useState('all');
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const list = data.residents.filter(r => stage === 'all' || r.stage === stage);
  return (
    <div className="grid">
      <div className="row spread"><h1>Residents</h1>
        <select value={stage} onChange={e => setStage(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">All stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid g3">
        {list.map(r => (
          <a key={r.id} href={`#/residents/${r.id}`} className="card white" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="row spread"><strong>{r.name}</strong><Pill tone={r.stage === 'active' ? 'good' : r.stage === 'renewal' ? 'warn' : 'muted'}>{r.stage}</Pill></div>
            <p className="muted" style={{ fontSize: '.8rem' }}>{r.unit ? `Unit ${r.unit}` : 'No unit'}{r.corporateAccount ? ` · ${r.corporateAccount}` : ''}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function Resident360({ rid }) {
  const { property } = useApp();
  const { data, error, reload } = useData(`/residents/${rid}${q(property)}`);
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState(null);
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const r = data.resident;
  return (
    <div className="grid g2">
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <a href="#/residents" className="muted" style={{ fontSize: '.8rem' }}>← All residents</a>
        <div className="row spread mt">
          <div><h1>{r.name}</h1>
            <p className="muted">{r.unit ? `Unit ${r.unit}` : 'No unit'}{r.corporateAccount ? ` · ${r.corporateAccount}` : ''} · with us since {dt(r.since, { hour: undefined, minute: undefined })}</p></div>
          <select value={r.stage} onChange={e => api(`/residents/${r.id}/stage${q(property)}`, { method: 'POST', body: { stage: e.target.value } }).then(reload).catch(alertErr)} style={{ width: 'auto' }}>
            {STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="card white">
        <h2>Onboarding milestones</h2>
        {r.milestones.map((m, i) => (
          <Check key={i} done={m.done} label={m.item} onToggle={() => api(`/residents/${r.id}/milestones/${i}${q(property)}`, { method: 'POST' }).then(reload).catch(alertErr)} />
        ))}
        <h2 className="mt">Notes</h2>
        {r.notes?.map((n, i) => <p key={i} style={{ fontSize: '.85rem' }}><span className="muted">{n.by.split('@')[0]} · {dt(n.at)}</span><br />{n.text}</p>)}
        <textarea placeholder="Add a note…" value={note} onChange={e => setNote(e.target.value)} />
        <button className="btn small mt" disabled={!note.trim()} onClick={() => { api(`/residents/${r.id}/notes${q(property)}`, { method: 'POST', body: { text: note } }).then(() => { setNote(''); reload(); }).catch(alertErr); }}>Save note</button>
      </div>
      <div className="card white">
        <h2>360 view</h2>
        <h3 className="mt">Feedback</h3>
        {data.feedback.length ? data.feedback.map(f => <p key={f.id} style={{ fontSize: '.85rem' }}><Pill tone={f.sentiment === 'positive' ? 'good' : f.sentiment === 'negative' ? 'bad' : 'muted'}>{f.csat}/5</Pill> {f.text}</p>) : <p className="muted">None yet.</p>}
        <h3 className="mt">Cases</h3>
        {data.cases.length ? data.cases.map(c => <p key={c.id} style={{ fontSize: '.85rem' }}><SlaPill sla={c.sla} /> {c.title}</p>) : <p className="muted">None linked.</p>}
        <h3 className="mt">Moves</h3>
        {data.moves.length ? data.moves.map(m => <p key={m.id} style={{ fontSize: '.85rem' }}><Pill tone="ok">{m.kind}</Pill> Unit {m.unit} · {m.status}</p>) : <p className="muted">None scheduled.</p>}
        <h3 className="mt">Compose message <Pill tone="sample">draft only — never sends</Pill></h3>
        <div className="row mt">
          {['welcome', 'check-in', 'renewal'].map(t => (
            <button key={t} className="btn small" onClick={() => api(`/residents/${r.id}/compose${q(property)}`, { method: 'POST', body: { template: t } }).then(d => setDraft(d.draft)).catch(alertErr)}>{t}</button>
          ))}
        </div>
        {draft && <textarea className="mt" value={draft} onChange={e => setDraft(e.target.value)} rows={7} />}
      </div>
    </div>
  );
}

/* ================= FEEDBACK ================= */
export function Feedback() {
  const { property } = useApp();
  const { data, error, reload } = useData(`/feedback${q(property)}`, { refreshMs: 45_000 });
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const act = (id, p, body) => api(`/feedback/${id}/${p}${q(property)}`, { method: 'POST', body }).then(reload).catch(alertErr);
  return (
    <div className="grid">
      <div className="row spread"><h1>Feedback</h1><DataModePill mode={data.dataMode} /></div>
      <div className="grid g2">
        {data.feedback.map(f => (
          <div key={f.id} className="card white">
            <div className="row spread">
              <strong>{f.residentName}</strong>
              <div className="row">
                <Pill tone={f.sentiment === 'positive' ? 'good' : f.sentiment === 'negative' ? 'bad' : 'muted'}>CSAT {f.csat}/5</Pill>
                <Pill tone={f.status === 'new' ? 'warn' : 'muted'}>{f.status}</Pill>
              </div>
            </div>
            <p>{f.text}</p>
            <div className="row">
              {f.status === 'new' && <button className="btn small" onClick={() => act(f.id, 'triage', { status: 'actioned' })}>Mark actioned</button>}
              {f.sentiment === 'positive' && f.status !== 'thanked' && <button className="btn small" onClick={() => act(f.id, 'triage', { status: 'thanked' })}>Thanked</button>}
              {f.status !== 'resolved' && f.status !== 'dismissed' && <button className="btn small" onClick={() => act(f.id, 'triage', { status: 'resolved' })}>Resolve</button>}
              {!f.linkedCase
                ? <button className="btn small accent" onClick={() => act(f.id, 'escalate')}>→ Case</button>
                : <a className="btn small" href="#/cases">Linked case open</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= EVENTS ================= */
export function Events() {
  const { property } = useApp();
  const { data, error, reload } = useData(`/events${q(property)}`);
  const [pick, setPick] = useState({});
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const act = (eid, p, resident) => api(`/events/${eid}/${p}${q(property)}`, { method: 'POST', body: { resident } }).then(reload).catch(alertErr);
  return (
    <div className="grid">
      <h1>Community events</h1>
      <div className="grid g2">
        {data.events.map(e => (
          <div key={e.id} className="card white">
            <div className="row spread"><h2>{e.title}</h2><Pill tone="ok">{e.rsvps.length}/{e.capacity} RSVP</Pill></div>
            <p className="muted">{dt(e.when)} · {e.where}</p>
            {e.rsvpNames.length > 0 && <p style={{ fontSize: '.82rem' }}>{e.rsvpNames.join(', ')}</p>}
            <div className="row mt">
              <select value={pick[e.id] || ''} onChange={x => setPick({ ...pick, [e.id]: x.target.value })} style={{ flex: 1, minWidth: 140 }}>
                <option value="">Choose resident…</option>
                {data.residents.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button className="btn small" disabled={!pick[e.id]} onClick={() => act(e.id, 'rsvp', pick[e.id])}>Toggle RSVP</button>
              <button className="btn small" disabled={!pick[e.id]} onClick={() => act(e.id, 'attendance', pick[e.id])}>Attended</button>
            </div>
            <p className="muted mt" style={{ fontSize: '.75rem' }}>{e.attended.length} attended</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= OPERATIONS ================= */
export function Operations() {
  const { user } = useApp();
  const { data, error } = useData('/operations', { refreshMs: 60_000 });
  const trends = useData('/operations/trends');
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const lat = [24.66, 24.86], lng = [46.56, 46.72];
  const pos = p => ({ left: `${((p.lng - lng[0]) / (lng[1] - lng[0])) * 100}%`, top: `${(1 - (p.lat - lat[0]) / (lat[1] - lat[0])) * 100}%` });
  const t = trends.data?.trends?.['narjis-gardens'];
  return (
    <div className="grid">
      <div className="row spread">
        <h1>Operations — Riyadh portfolio</h1>
        <div className="row">
          {!data.financialsVisible && <Pill tone="muted">financials hidden for your role</Pill>}
          {data.financialsVisible && <Pill tone="sample">financials: {data.financialsSource}</Pill>}
        </div>
      </div>

      <div className="grid g4">
        <div className="kpi"><div className="n">{data.rollup.weightedOccupancy != null ? `${Math.round(data.rollup.weightedOccupancy * 100)}%` : '—'}</div><div className="l">Weighted occupancy</div></div>
        <div className="kpi"><div className="n">{data.rollup.propertiesLive}/{data.rollup.propertiesTotal}</div><div className="l">Properties reporting</div></div>
        <div className="kpi"><div className="n">{data.rollup.csat ?? '—'}</div><div className="l">CSAT (sample)</div></div>
        {data.financialsVisible && <>
          <div className="kpi"><div className="n">{fmtSAR(data.rollup.revenue)}</div><div className="l">Revenue MTD (sample)</div></div>
          <div className="kpi"><div className="n">{fmtSAR(data.rollup.noi)}</div><div className="l">NOI (sample)</div></div>
          <div className="kpi"><div className="n">{fmtSAR(data.rollup.reserve)}</div><div className="l">Reserve (sample)</div></div>
        </>}
      </div>

      <div className="map" aria-label="Riyadh map">
        {data.board.map(p => (
          <div key={p.id} className="pin" style={pos(p)} title={p.name}>
            <Icon name="pin" size={22} />
            <div className="tag">{p.name.replace('PULSE ', '')}{p.occupancy ? ` · ${Math.round(p.occupancy.occupancyRate * 100)}%` : ''}</div>
          </div>
        ))}
      </div>

      <div className="card white table-wrap">
        <table className="table">
          <thead><tr><th>Property</th><th>Occupancy</th><th>CSAT</th>{data.financialsVisible && <><th>Revenue</th><th>Cost</th><th>Reserve</th><th>B2B concentration</th></>}<th>Data</th></tr></thead>
          <tbody>
            {data.board.map(p => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><div className="muted" style={{ fontSize: '.75rem' }}>{p.type}</div></td>
                <td>{p.occupancy ? `${Math.round(p.occupancy.occupancyRate * 100)}% (${p.occupancy.occupied}/${p.occupancy.total})` : '—'}</td>
                <td>{p.csat ?? '—'}</td>
                {data.financialsVisible && <>
                  <td>{fmtSAR(p.revenue)}</td><td>{fmtSAR(p.cost)}</td><td>{fmtSAR(p.reserve)}</td>
                  <td>{p.b2bRevenueConcentration != null ? `${Math.round(p.b2bRevenueConcentration * 100)}%` : '—'}</td>
                </>}
                <td><DataModePill mode={p.dataMode?.occupancy || 'awaiting-data'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.financialsVisible && data.board.find(b => b.b2bAccounts) && (
        <div className="card white">
          <h2>B2B corporate accounts — Narjis Gardens <Pill tone="sample">sample</Pill></h2>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Account</th><th>Units</th><th>Revenue share</th></tr></thead>
            <tbody>{data.board.find(b => b.b2bAccounts).b2bAccounts.map(a => (
              <tr key={a.name}><td>{a.name}</td><td>{a.units}</td><td>{Math.round(a.share * 100)}%</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      {t && (
        <div className="card white">
          <div className="row spread"><h2>14-day trends — Narjis Gardens</h2><DataModePill mode={t.dataMode} /></div>
          <div className="grid g3 mt">
            <div><div className="muted" style={{ fontSize: '.75rem' }}>Occupancy</div><Spark points={t.occupancy} color="var(--ocean)" /><div style={{ fontSize: '.8rem' }}>{Math.round(t.occupancy.at(-1).value * 100)}% today</div></div>
            <div><div className="muted" style={{ fontSize: '.75rem' }}>CSAT</div><Spark points={t.csat} color="var(--olive)" /><div style={{ fontSize: '.8rem' }}>{t.csat.at(-1).value} today</div></div>
            <div><div className="muted" style={{ fontSize: '.75rem' }}>90-day retention</div><div className="kpi" style={{ border: 'none', padding: 0 }}><div className="n">{Math.round(t.retention90 * 100)}%</div></div></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= OVERSIGHT ================= */
export function Oversight() {
  const { data, error } = useData('/oversight', { refreshMs: 30_000 });
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  return (
    <div className="grid">
      <h1>Oversight — live shift board</h1>
      <div className="grid g2">
        {data.board.map(b => (
          <div key={b.property.id} className="card white">
            <div className="row spread"><h2>{b.property.name}</h2>
              {b.status === 'awaiting-data' ? <Pill tone="muted">awaiting data</Pill> : <Pill tone={b.onDuty.length ? 'good' : 'warn'}>{b.onDuty?.length || 0} on duty</Pill>}
            </div>
            {b.status !== 'awaiting-data' && <>
              <p style={{ fontSize: '.85rem' }}>{b.onDuty.map(d => d.name).join(', ') || 'No one on duty'}</p>
              <div className="row">
                <Pill tone="ok">checklist {b.checklistDone}/{b.checklistTotal}</Pill>
                <Pill tone={b.openTasks.length ? 'warn' : 'good'}>{b.openTasks.length} open tasks</Pill>
                {b.handover && <Pill tone={b.handover.readCount ? 'good' : 'bad'}>handover read by {b.handover.readCount}</Pill>}
              </div>
              {b.handover && <p className="muted mt" style={{ fontSize: '.8rem' }}>“{b.handover.note.slice(0, 140)}{b.handover.note.length > 140 ? '…' : ''}” — {b.handover.from.split('@')[0]}</p>}
            </>}
          </div>
        ))}
      </div>
    </div>
  );
}
