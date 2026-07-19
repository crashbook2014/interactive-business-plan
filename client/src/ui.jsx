// Shared UI atoms: monoline SVG icons, api helper, hooks, small components.
import React, { useEffect, useState, useCallback, useRef } from 'react';

export async function api(path, opts = {}) {
  if (window.__demoApi) return window.__demoApi(path, opts); // shareable demo build
  const res = await fetch(`/api${path}`, {
    headers: opts.body ? { 'content-type': 'application/json' } : {},
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status });
  return data;
}

// Data hook with optional silent auto-refresh (no animation retrigger).
export function useData(path, { refreshMs } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async (silent = false) => {
    if (!silent) setState(s => ({ ...s, loading: true }));
    try {
      const data = await api(path);
      setState({ data, error: null, loading: false });
    } catch (e) {
      setState(s => ({ data: s.data, error: e, loading: false }));
    }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!refreshMs) return;
    const t = setInterval(() => load(true), refreshMs);
    return () => clearInterval(t);
  }, [refreshMs, load]);
  return { ...state, reload: () => load(true) };
}

const paths = {
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5',
  shift: 'M12 8v4l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
  units: 'M4 21V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v16M4 21h16M9 8h2M9 12h2M13 8h2M13 12h2M10 21v-4h4v4',
  moves: 'M5 12h14M13 6l6 6-6 6',
  housekeeping: 'M6 21l4-11 3-6 2 1-3 6M6 21l7-3M6 21l-2-1',
  maintenance: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.9 2.9-2.1-2.1 2.9-2.9z',
  cases: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  residents: 'M16 19a4 4 0 0 0-8 0M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19a4 4 0 0 0-3-3.9M17 5.5a3.5 3.5 0 0 1 0 6',
  feedback: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  events: 'M5 6h14v14H5zM5 10h14M9 4v4M15 4v4',
  operations: 'M4 20V10M10 20V4M16 20v-8M20 20H4',
  oversight: 'M12 5c5 0 8.5 4.2 9.5 7-1 2.8-4.5 7-9.5 7s-8.5-4.2-9.5-7c1-2.8 4.5-7 9.5-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.5-4.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  user: 'M17 20a5 5 0 0 0-10 0M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  out: 'M15 12H4M8 8l-4 4 4 4M11 4h8v16h-8',
  check: 'M5 12l5 5 9-10',
  plus: 'M12 5v14M5 12h14',
  pin: 'M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
};

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || paths.home} />
    </svg>
  );
}

export const Pill = ({ tone = 'muted', children }) => <span className={`pill ${tone}`}>{children}</span>;

export function SlaPill({ sla }) {
  if (!sla) return null;
  const tone = { 'on-track': 'ok', 'at-risk': 'warn', breached: 'bad', met: 'good' }[sla.state] || 'muted';
  const label = sla.state === 'met' ? 'SLA met'
    : sla.state === 'breached' ? 'SLA breached'
    : `${sla.state} · ${hrs(sla.remainingMs)} left`;
  return <Pill tone={tone}>{label}</Pill>;
}

export function hrs(ms) {
  if (ms <= 0) return '0h';
  const h = Math.floor(ms / 3600_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  const m = Math.floor((ms % 3600_000) / 60000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function DataModePill({ mode }) {
  if (!mode) return null;
  const sample = String(mode).includes('sample') || String(mode).includes('stub');
  const awaiting = String(mode).includes('awaiting');
  return <Pill tone={awaiting ? 'muted' : sample ? 'sample' : 'good'}>{awaiting ? 'awaiting data' : sample ? 'sample data' : 'live'}</Pill>;
}

export function Check({ done, label, onToggle, sub }) {
  return (
    <div className={`check ${done ? 'done' : ''}`} onClick={onToggle} role="checkbox" aria-checked={done} tabIndex={0}
      onKeyDown={e => e.key === ' ' && (e.preventDefault(), onToggle())}>
      <span className="box">{done && <Icon name="check" size={12} />}</span>
      <span className="lbl">{label}{sub && <span className="muted" style={{ fontSize: '.75rem' }}> · {sub}</span>}</span>
    </div>
  );
}

export function Spark({ points, color = 'var(--ocean)' }) {
  if (!points?.length) return null;
  const vals = points.map(p => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const W = 200, Hh = 44, pad = 4;
  const d = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - 2 * pad);
    const y = Hh - pad - ((v - min) / range) * (Hh - 2 * pad);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function riyadhClock() {
  const fmt = (o) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', ...o }).format(new Date());
  return { time: fmt({ hour: '2-digit', minute: '2-digit' }), date: fmt({ weekday: 'short', day: 'numeric', month: 'short' }) };
}

export function useNow(ms = 30_000) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), ms); return () => clearInterval(t); }, [ms]);
}
