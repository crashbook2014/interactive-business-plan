// Opaque server-side sessions, AES-256-GCM encrypted at rest.
import { read, update } from './store.js';
import { encrypt, decrypt, randomToken } from './crypto.js';

const TTL_MS = 12 * 60 * 60 * 1000; // 12h shift-length sessions

export async function createSession(email) {
  const sid = randomToken();
  await update('sessions', sessions => {
    const now = Date.now();
    for (const k of Object.keys(sessions)) { // prune expired
      const s = decrypt(sessions[k]);
      if (!s || s.expires < now) delete sessions[k];
    }
    sessions[sid] = encrypt({ email, created: now, expires: now + TTL_MS });
  }, {});
  return sid;
}

export function getSession(sid) {
  if (!sid) return null;
  const sessions = read('sessions', {});
  const enc = sessions[sid];
  if (!enc) return null;
  const s = decrypt(enc);
  if (!s || s.expires < Date.now()) return null;
  return s;
}

export function destroySession(sid) {
  return update('sessions', sessions => { delete sessions[sid]; }, {});
}

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(sid, { secure }) {
  const attrs = ['HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${TTL_MS / 1000}`];
  if (secure) attrs.push('Secure');
  return `pulse_sid=${sid}; ${attrs.join('; ')}`;
}

export function clearCookie() {
  return 'pulse_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}
