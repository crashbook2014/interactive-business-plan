// Residents (journey 360), Feedback, Cases, Experience dashboard, Oversight.
import React, { useState } from 'react';
import { api, useData, Icon, Pill, SlaPill, DataModePill, Spark } from './ui.jsx';
import { useApp } from './App.jsx';
import { Loading, Err, alertErr } from './modules-core.jsx';
import { ScoreBadge } from './modules-experience.jsx';

const q = (prop) => `?property=${encodeURIComponent(prop)}`;
const fmtSAR = n => n == null ? '—' : `SAR ${Math.round(n).toLocaleString('en-GB')}`;
const dt = (s, o = {}) => new Date(s).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...o });

/* ================= RESIDENTS ================= */
export function Residents({ param }) {
  if (param) return <Resident360 rid={param} />;
  return <ResidentList />;
}

function ResidentList() {
  const { property } = useApp();
  const { data, error } = useData(`/residents${q(property)}`);
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  return (
    <div className="grid">
      <h1>Residents</h1>
      <div className="grid g3">
        {data.residents.map(r => {
          const total = r.touchpoints.flat().length;
          const done = r.touchpoints.flat().filter(t => t.done).length;
          const low = r.touchpoints.flat().some(t => t.score !== null && t.score <= 3);
          return (
            <a key={r.id} href={`#/residents/${r.id}`} className="card white" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="row spread"><strong>{r.name}</strong>{low ? <Pill tone="warn">at risk</Pill> : <Pill tone="ok">stage {r.stageIndex + 1}</Pill>}</div>
              <p className="muted" style={{ fontSize: '.8rem' }}>Unit {r.unit} · journey {done}/{total}</p>
              <div className="jbar"><div className="jfill" style={{ width: `${Math.round(done / total * 100)}%` }} /></div>
            </a>
          );
        })}
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
  const j = data.journey;
  const tp = (si, i, body) => api(`/journeys/resident/${r.id}/touchpoint${q(property)}`, { method: 'POST', body: { stage: si, index: i, ...body } }).then(reload).catch(alertErr);
  return (
    <div className="grid g2">
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <a href="#/residents" className="muted" style={{ fontSize: '.8rem' }}>← All residents</a>
        <div className="row spread mt">
          <div><h1>{r.name}</h1>
            <p className="muted">Unit {r.unit} · with us since {dt(r.since, { hour: undefined, minute: undefined })} · stage {r.stageIndex + 1}: {j?.stages[r.stageIndex]?.name}</p></div>
        </div>
      </div>

      <div className="card white" style={{ gridColumn: '1 / -1' }}>
        <h2>{j?.name}</h2>
        <div className="journey mt">
          {j?.stages.map((s, si) => (
            <div key={si} className={`jstage ${si === r.stageIndex ? 'here' : ''}`}>
              <div className="jname">{si + 1}. {s.name}</div>
              {s.touchpoints.map((t, i) => {
                const state = r.touchpoints[si][i];
                return (
                  <div key={i} className={`check ${state.done ? 'done' : ''}`} onClick={() => tp(si, i, { done: !state.done })}>
                    <span className="box">{state.done && <Icon name="check" size={12} />}</span>
                    <span className="lbl" style={{ fontSize: '.82rem' }}>{t}</span>
                    {state.done && (
                      <select value={state.score ?? ''} onClick={e => e.stopPropagation()} onChange={e => tp(si, i, { score: e.target.value ? Number(e.target.value) : null })}
                        style={{ width: 62, marginLeft: 'auto', fontSize: '.74rem', padding: '2px 4px' }}>
                        <option value="">–/5</option>
                        {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n}/5</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="card white">
        <h2>Notes</h2>
        {r.notes?.map((n, i) => <p key={i} style={{ fontSize: '.85rem' }}><span className="muted">{n.by.split('@')[0]} · {dt(n.at)}</span><br />{n.text}</p>)}
        <textarea placeholder="Add a note…" value={note} onChange={e => setNote(e.target.value)} />
        <button className="btn small mt" disabled={!note.trim()} onClick={() => { api(`/residents/${r.id}/notes${q(property)}`, { method: 'POST', body: { text: note } }).then(() => { setNote(''); reload(); }).catch(alertErr); }}>Save note</button>
      </div>

      <div className="card white">
        <h2>Feedback & cases</h2>
        {data.feedback.length ? data.feedback.map(f => <p key={f.id} style={{ fontSize: '.85rem' }}><Pill tone={f.sentiment === 'positive' ? 'good' : f.sentiment === 'negative' ? 'bad' : 'muted'}>{f.csat}/5</Pill> {f.text}</p>) : <p className="muted">No feedback yet.</p>}
        {data.cases.map(c => <p key={c.id} style={{ fontSize: '.85rem' }}><SlaPill sla={c.sla} /> {c.title}</p>)}
        <h3 className="mt">Compose message <Pill tone="sample">draft only — never sends</Pill></h3>
        <div className="row mt">
          {['welcome', 'event-invite', 'check-in'].map(t => (
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
            {f.eventTitle && <p className="muted" style={{ fontSize: '.75rem' }}>about: {f.eventTitle}</p>}
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

/* ================= CASES ================= */
export function Cases() {
  const { property } = useApp();
  const { data, error, reload } = useData(`/cases${q(property)}`, { refreshMs: 45_000 });
  const [form, setForm] = useState({ title: '', category: 'production', priority: 'normal' });
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
            {['production', 'venue', 'experience', 'it', 'admin'].map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
            <option value="high">High (8h)</option><option value="normal">Normal (48h)</option><option value="low">Low (120h)</option>
          </select>
          <button className="btn small accent" disabled={!form.title.trim()} onClick={() =>
            api(`/cases${q(property)}`, { method: 'POST', body: form }).then(() => { setForm({ title: '', category: 'production', priority: 'normal' }); reload(); }).catch(alertErr)
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

/* ================= EXPERIENCE (dashboard) ================= */
export function Experience() {
  const { user } = useApp();
  const { data, error } = useData('/experience', { refreshMs: 60_000 });
  const trends = useData('/experience/trends');
  if (error) return <Err e={error} />;
  if (!data) return <Loading />;
  const lat = [24.66, 24.86], lng = [46.56, 46.72];
  const pos = p => ({ left: `${((p.lng - lng[0]) / (lng[1] - lng[0])) * 100}%`, top: `${(1 - (p.lat - lat[0]) / (lat[1] - lat[0])) * 100}%` });
  const t = trends.data?.trends?.['narjis-gardens'];
  const jr = data.rollup.journey;
  return (
    <div className="grid">
      <div className="row spread">
        <h1>Experience — Riyadh portfolio</h1>
        {!data.financialsVisible
          ? <Pill tone="muted">financials hidden for your role</Pill>
          : <Pill tone="sample">financials: {data.financialsSource}</Pill>}
      </div>

      <div className="grid g4">
        <div className="kpi"><div className="n">{data.rollup.avgEventScore ?? '—'}</div><div className="l">Avg event score</div></div>
        <div className="kpi"><div className="n">{data.rollup.exceptional}/{data.rollup.eventsReported}</div><div className="l">Exceptional events</div></div>
        <div className="kpi"><div className="n">{jr ? `${jr.completedJourney}/${jr.travelers}` : '—'}</div><div className="l">Journeys completed</div></div>
        <div className="kpi"><div className="n">{data.rollup.atRisk}</div><div className="l">Journeys at risk</div></div>
      </div>

      {t && (
        <div className="card white">
          <div className="row spread"><h2>14-day trends</h2><DataModePill mode={t.dataMode} /></div>
          <div className="grid g3 mt">
            <div><div className="muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>Satisfaction</div><Spark points={t.csat} color="var(--brass)" /><div style={{ fontSize: '.8rem' }}>{t.csat.at(-1).value}/5 today</div></div>
            <div><div className="muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>NPS</div><Spark points={t.nps} color="var(--rose)" /><div style={{ fontSize: '.8rem' }}>{t.nps.at(-1).value} today</div></div>
            <div><div className="muted" style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>Event rating</div><Spark points={t.eventRating} color="var(--wine)" /><div style={{ fontSize: '.8rem' }}>{t.eventRating.at(-1).value}/5 today</div></div>
          </div>
        </div>
      )}

      {data.testimonials.length > 0 && (
        <div className="card">
          <h2>What guests are saying</h2>
          <div className="grid g2 mt">
            {data.testimonials.map((x, i) => (
              <div key={i}>
                <p style={{ fontFamily: 'var(--font-head)', fontStyle: 'italic', margin: 0 }}>“{x.text}”</p>
                <p className="muted" style={{ fontSize: '.74rem' }}>— {x.event}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card white table-wrap">
        <h2>Reported events</h2>
        <table className="table">
          <thead><tr><th>Event</th><th>When</th><th>Score</th></tr></thead>
          <tbody>
            {data.reported.map(e => (
              <tr key={e.id}><td><strong>{e.title}</strong></td><td>{dt(e.when, { hour: undefined, minute: undefined })}</td><td><ScoreBadge scorecard={e.scorecard} /></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="map" aria-label="Riyadh map">
        {data.board.map(p => (
          <div key={p.id} className="pin" style={pos(p)} title={p.name}>
            <Icon name="pin" size={22} />
            <div className="tag">{p.name}{p.csat ? ` · ${p.csat}/5` : ''}</div>
          </div>
        ))}
      </div>

      <div className="card white table-wrap">
        <table className="table">
          <thead><tr><th>Compound</th><th>CSAT</th><th>NPS</th><th>Journeys on track</th><th>Events YTD</th>{data.financialsVisible && <><th>Revenue</th><th>Budget</th><th>Spend</th></>}<th>Data</th></tr></thead>
          <tbody>
            {data.board.map(p => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><div className="muted" style={{ fontSize: '.75rem' }}>{p.type}</div></td>
                <td>{p.csat ?? '—'}</td><td>{p.nps ?? '—'}</td>
                <td>{p.journeyOnTrack != null ? `${Math.round(p.journeyOnTrack * 100)}%` : '—'}</td>
                <td>{p.eventsYTD ?? '—'}</td>
                {data.financialsVisible && <>
                  <td>{fmtSAR(p.revenue)}</td><td>{fmtSAR(p.budget)}</td><td>{fmtSAR(p.spend)}</td>
                </>}
                <td><DataModePill mode={p.dataMode?.experience || 'awaiting-data'} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
                {b.liveEvents?.length > 0 && <Pill tone="bad">live: {b.liveEvents.join(', ')}</Pill>}
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

const STATUS_TONE = { concept: 'muted', planning: 'warn', ready: 'ok', live: 'bad', 'wrap-up': 'ok', reported: 'good' };
