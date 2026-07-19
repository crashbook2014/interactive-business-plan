// Append-only audit log of every mutating action.
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.js';

const FILE = path.join(DATA_DIR, 'audit.log');

export function audit(user, action, detail = {}) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    email: user?.email || 'anonymous',
    role: user?.role || null,
    action,
    detail
  }) + '\n';
  fs.appendFileSync(FILE, line);
}
