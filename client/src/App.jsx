import React, { useEffect, useState, useMemo, useRef, createContext, useContext } from 'react';
import { api, Icon, riyadhClock, useNow } from './ui.jsx';
import { Home, Shift } from './modules-core.jsx';
import { Journeys, Events, Clients } from './modules-experience.jsx';
import { Residents, Feedback, Cases, Experience, Oversight } from './modules-mgmt.jsx';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const GROUPS = [
  { label: 'Experience', items: ['home', 'shift', 'journeys'] },
  { label: 'Events', items: ['events', 'clients'] },
  { label: 'Community', items: ['residents', 'feedback', 'cases'] },
  { label: 'Management', items: ['experience', 'oversight'] }
];
const TITLES = {
  home: 'Home', shift: 'Shift', journeys: 'Journeys', events: 'Events', clients: 'Clients',
  residents: 'Residents', feedback: 'Feedback', cases: 'Cases',
  experience: 'Experience', oversight: 'Oversight'
};
const VIEWS = { home: Home, shift: Shift, journeys: Journeys, events: Events, clients: Clients, residents: Residents, feedback: Feedback, cases: Cases, experience: Experience, oversight: Oversight };

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { module: parts[0] || '', param: parts[1] || null };
}

export default function App() {
  const [user, setUser] = useState(null);
  const [gate, setGate] = useState('loading'); // loading | login | no-role | ok
  const [noRoleEmail, setNoRoleEmail] = useState(null);

  const checkAuth = () => {
    api('/auth/me')
      .then(({ user }) => { setUser(user); setGate('ok'); })
      .catch(e => {
        if (e.status === 403) { setNoRoleEmail('signed-in'); setGate('no-role'); }
        else setGate('login');
      });
  };
  useEffect(() => {
    checkAuth();
    if ('serviceWorker' in navigator && !window.__demoApi) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  if (gate === 'loading') return <div className="gate"><div className="muted">Loading…</div></div>;
  if (gate === 'login') return <Login onDone={checkAuth} />;
  if (gate === 'no-role') return <NoAccess />;
  return <Shell user={user} />;
}

function Login({ onDone }) {
  const [status, setStatus] = useState(null);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { api('/auth/status').then(setStatus).catch(() => {}); }, []);
  const testLogin = async (e) => {
    try { await api('/auth/test-login', { method: 'POST', body: { email: e } }); onDone(); }
    catch (x) { setErr(x.message); }
  };
  return (
    <div className="gate">
      <div className="card screen-enter">
        <img src="/icon.svg" alt="" width="56" style={{ borderRadius: 12 }} />
        <h1 className="wordmark mt">PULSE</h1>
        <div className="subtitle">Resident Experience Co.</div>
        <p className="tagline">The heartbeat of your community.</p>
        {status?.googleConfigured &&
          <a className="btn accent mt" href="/api/auth/google" style={{ justifyContent: 'center', width: '100%' }}>
            Sign in with Google Workspace
          </a>}
        {status?.testLogin && (
          <div className="mt" style={{ textAlign: 'left' }}>
            <p className="muted" style={{ fontSize: '.78rem' }}>Local development sign-in (disabled in production)</p>
            <select value={email} onChange={e => setEmail(e.target.value)}>
              <option value="">Choose a teammate…</option>
              {status.roster?.map(u => <option key={u.email} value={u.email}>{u.name} — {u.role}</option>)}
            </select>
            <button className="btn mt" disabled={!email} onClick={() => testLogin(email)} style={{ width: '100%', justifyContent: 'center' }}>
              Enter as selected
            </button>
            <button className="btn small mt" onClick={() => testLogin('stranger@pulse.sa')} style={{ width: '100%', justifyContent: 'center' }}>
              Try an email with no role
            </button>
          </div>
        )}
        {!status?.googleConfigured && !status?.testLogin &&
          <p className="muted mt">Sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.</p>}
        {err && <p className="mt" style={{ color: 'var(--roots)' }}>{err}</p>}
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="gate">
      <div className="card screen-enter">
        <Icon name="oversight" size={40} />
        <h1 className="mt">No access yet</h1>
        <p className="muted">Your account is signed in, but it is not on the PULSE org chart for this portfolio. Ask your Operations Manager to add your role.</p>
        <button className="btn mt" onClick={async () => { await api('/auth/logout', { method: 'POST' }); window.location.reload(); }}>
          <Icon name="out" size={15} /> Sign out
        </button>
      </div>
    </div>
  );
}

function Shell({ user }) {
  const route = useHashRoute();
  const [property, setProperty] = useState(user.homeProperty);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  useNow(30_000);

  // Landing redirect + unknown/forbidden module guard.
  const module = route.module || user.landing;
  useEffect(() => {
    if (!route.module) window.location.replace(`#/${user.landing}`);
    else if (!user.modules.includes(route.module) && TITLES[route.module]) window.location.replace(`#/${user.landing}`);
  }, [route.module, user]);

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(s => !s); }
      if (e.key === 'Escape') setSearch(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const clock = riyadhClock();
  const propName = user.properties.find(p => p.id === property)?.name || property;
  const View = VIEWS[module] || Home;
  const ctx = useMemo(() => ({ user, property, date }), [user, property, date]);

  return (
    <AppCtx.Provider value={ctx}>
      <header className="header">
        <div className="header-brand">
          <button className="btn small hamburger" aria-label="Menu" onClick={() => setDrawer(true)}><Icon name="menu" /></button>
          <img className="logo" src="/icon.svg" alt="" style={{ borderRadius: 8 }} />
          <div>
            <div className="word">PULSE</div>
            <div className="sub">Resident Experience Co.</div>
          </div>
          <div className="header-tools">
            <button className="btn small" onClick={() => setSearch(true)}><Icon name="search" size={14} /> <span className="muted">⌘K</span></button>
            <span className="pill muted" title={user.email}><Icon name="user" size={12} /> {user.name.split(' ')[0]} · {user.roleTitle}</span>
            <button className="btn small" onClick={async () => { await api('/auth/logout', { method: 'POST' }); window.location.reload(); }} aria-label="Sign out"><Icon name="out" size={14} /></button>
          </div>
        </div>
        <div className="ambient">
          <span>{propName}</span><span className="dot">·</span>
          <span>{clock.time}</span><span className="dot">·</span>
          <span>{clock.date}</span><span className="dot">·</span>
          <span>Riyadh</span><span className="dot">·</span>
          <span className="mode">{user.financials ? 'full access' : 'operational view'}</span>
          <span className="dot">·</span>
          <span style={{ fontStyle: 'italic' }}>The heartbeat of your community.</span>
        </div>
      </header>

      <div className="shell">
        {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
        <nav className={`sidebar ${drawer ? 'open' : ''}`}>
          {GROUPS.map(g => {
            const items = g.items.filter(m => user.modules.includes(m));
            if (!items.length) return null;
            return (
              <div key={g.label}>
                <div className="group-label">{g.label}</div>
                {items.map(m => (
                  <a key={m} href={`#/${m}`} className={`nav-item ${module === m ? 'active' : ''}`} onClick={() => setDrawer(false)}>
                    <Icon name={m} /> {TITLES[m]}
                  </a>
                ))}
              </div>
            );
          })}
        </nav>

        <main className="main">
          <div className="context-bar">
            <select value={property} onChange={e => setProperty(e.target.value)} disabled={user.properties.length < 2} aria-label="Property">
              {user.properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />
          </div>
          {/* key on module+param+property → entrance animation on navigation only */}
          <div key={`${module}/${route.param || ''}/${property}`} className="screen-enter">
            <View param={route.param} />
          </div>
        </main>
      </div>

      {search && <SearchOverlay onClose={() => setSearch(false)} />}
    </AppCtx.Provider>
  );
}

function SearchOverlay({ onClose }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const box = useRef(null);
  useEffect(() => { box.current?.focus(); }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => api(`/search?q=${encodeURIComponent(q)}`).then(d => setResults(d.results)).catch(() => {}), 180);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={e => e.stopPropagation()}>
        <input ref={box} type="text" placeholder="Search units, residents, work orders, cases…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="results">
          {results.map((r, i) => (
            <a key={i} className="search-hit" href={r.hash} onClick={onClose}>
              <div className="m">{r.module}</div>
              <div>{r.title} <span className="muted">— {r.sub}</span></div>
            </a>
          ))}
          {q.length >= 2 && !results.length && <div className="muted" style={{ padding: 10 }}>Nothing found for “{q}”</div>}
        </div>
      </div>
    </div>
  );
}
