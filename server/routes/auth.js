// Google Workspace SSO (domain-restricted) + local-dev test login.
// The test login is OFF unless TEST_LOGIN=1 and never in production.
import express from 'express';
import { ALLOWED_DOMAIN, findUser, ORG } from '../config.js';
import { createSession, destroySession, sessionCookie, clearCookie } from '../lib/session.js';
import { audit } from '../lib/audit.js';
import { contextFor } from '../lib/rbac.js';

const router = express.Router();
const isProd = process.env.NODE_ENV === 'production';
const secureCookies = isProd || process.env.SECURE_COOKIES === '1';
const testLoginEnabled = !isProd && process.env.TEST_LOGIN !== '0';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return process.env.PUBLIC_URL || `${proto}://${req.headers.host}`;
}

router.get('/status', (req, res) => {
  res.json({
    signedIn: !!req.user || !!req.noRole,
    googleConfigured: !!GOOGLE_CLIENT_ID,
    testLogin: testLoginEnabled,
    domain: ALLOWED_DOMAIN,
    roster: testLoginEnabled ? ORG.map(u => ({ email: u.email, name: u.name, role: u.role })) : undefined
  });
});

router.get('/me', (req, res) => {
  if (req.user) return res.json({ user: contextFor(req.user) });
  if (req.noRole) return res.status(403).json({ error: 'no-role', email: req.noRole });
  res.status(401).json({ error: 'unauthenticated' });
});

router.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google sign-in not configured' });
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${baseUrl(req)}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    hd: ALLOWED_DOMAIN,
    prompt: 'select_account'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  try {
    if (!req.query.code) return res.redirect('/#/login?error=denied');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${baseUrl(req)}/api/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenRes.json();
    const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString());
    const email = String(payload.email || '').toLowerCase();
    const domain = email.split('@')[1];
    if (!payload.email_verified || domain !== ALLOWED_DOMAIN) {
      audit(null, 'auth.rejected', { email, reason: 'domain' });
      return res.redirect('/#/login?error=domain');
    }
    const sid = await createSession(email);
    audit({ email }, 'auth.signin', { via: 'google' });
    res.setHeader('Set-Cookie', sessionCookie(sid, { secure: secureCookies }));
    res.redirect('/');
  } catch {
    res.redirect('/#/login?error=oauth');
  }
});

// Local development only. Refuses to exist in production.
router.post('/test-login', express.json(), async (req, res) => {
  if (!testLoginEnabled) return res.status(404).json({ error: 'Not found' });
  const email = String(req.body?.email || '').toLowerCase();
  if (!email.includes('@')) return res.status(400).json({ error: 'Email required' });
  const sid = await createSession(email);
  audit({ email }, 'auth.signin', { via: 'test-login' });
  res.setHeader('Set-Cookie', sessionCookie(sid, { secure: secureCookies }));
  res.json({ ok: true, hasRole: !!findUser(email) });
});

router.post('/logout', async (req, res) => {
  if (req.sid) await destroySession(req.sid);
  audit(req.user, 'auth.signout');
  res.setHeader('Set-Cookie', clearCookie());
  res.json({ ok: true });
});

export default router;
