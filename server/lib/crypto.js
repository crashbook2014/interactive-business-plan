// AES-256-GCM encryption for at-rest session data. The key lives OUTSIDE the
// app tree: SESSION_KEY env (hex, 64 chars) or a generated keyfile in
// ~/.pulse-ops/session.key (dev convenience).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function loadKey() {
  if (process.env.SESSION_KEY) {
    const k = Buffer.from(process.env.SESSION_KEY, 'hex');
    if (k.length !== 32) throw new Error('SESSION_KEY must be 64 hex chars (32 bytes)');
    return k;
  }
  const dir = process.env.KEY_DIR || path.join(os.homedir(), '.pulse-ops');
  const file = path.join(dir, 'session.key');
  if (fs.existsSync(file)) return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex');
  const key = crypto.randomBytes(32);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, key.toString('hex'), { mode: 0o600 });
  return key;
}

const KEY = loadKey();

export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}

export function decrypt(str) {
  try {
    const [iv, tag, ct] = str.split('.').map(s => Buffer.from(s, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'));
  } catch { return null; }
}

export function randomToken() { return crypto.randomBytes(32).toString('hex'); }
