// Server-side RBAC: module gates, per-property scoping (403 cross-property),
// and financial redaction for anyone below GM level.
import {
  MODULE_ACCESS, FINANCIAL_ROLES, FINANCIAL_FIELDS,
  findUser, scopeProperties, ROLES, DEFAULT_LANDING, PROPERTIES
} from '../config.js';
import { getSession, parseCookies } from './session.js';

export function attachUser(req, res, next) {
  const sid = parseCookies(req).pulse_sid;
  const session = getSession(sid);
  req.sid = sid;
  req.user = session ? findUser(session.email) : null;
  if (session && !req.user) req.noRole = session.email; // signed in, no role
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  next();
}

export function canAccess(role, module) {
  return (MODULE_ACCESS[module] || []).includes(role);
}

export function requireModule(module) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Sign in required' });
    if (!canAccess(req.user.role, module)) {
      return res.status(403).json({ error: `Your role does not include ${module}` });
    }
    next();
  };
}

export function seesFinancials(user) {
  return !!user && FINANCIAL_ROLES.includes(user.role);
}

// Deep-strip financial fields. Applied to API responses before send.
export function redactFinancials(value, user) {
  if (seesFinancials(user)) return value;
  return strip(value);
  function strip(v) {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) {
        if (FINANCIAL_FIELDS.includes(k)) continue;
        out[k] = strip(val);
      }
      return out;
    }
    return v;
  }
}

// Resolve requested property against the user's scope. Returns property id
// or responds 403 and returns null.
export function resolveProperty(req, res) {
  const allowed = scopeProperties(req.user);
  const requested = req.query.property || req.body?.property || req.user.property || allowed[0];
  if (!allowed.includes(requested)) {
    res.status(403).json({ error: 'Property outside your scope' });
    return null;
  }
  return requested;
}

export function contextFor(user) {
  const props = scopeProperties(user);
  return {
    email: user.email,
    name: user.name,
    role: user.role,
    roleTitle: ROLES[user.role].title,
    scope: ROLES[user.role].scope,
    properties: PROPERTIES.filter(p => props.includes(p.id)),
    homeProperty: user.property || 'narjis-gardens',
    modules: Object.keys(MODULE_ACCESS).filter(m => canAccess(user.role, m)),
    financials: seesFinancials(user),
    landing: DEFAULT_LANDING[user.role]
  };
}
