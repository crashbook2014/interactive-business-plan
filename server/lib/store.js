// JSON file storage: atomic writes (tmp + rename), per-file async locking,
// corrupt-file quarantine with seed restore, and daily backups.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SEED_DIR = path.join(__dirname, '..', 'seed');
const QUARANTINE_DIR = path.join(DATA_DIR, 'quarantine');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

fs.mkdirSync(DATA_DIR, { recursive: true });

const locks = new Map(); // file -> Promise chain

function withLock(name, fn) {
  const prev = locks.get(name) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(name, next.catch(() => {}));
  return next;
}

function fileFor(name) { return path.join(DATA_DIR, `${name}.json`); }

function quarantine(name) {
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
  const src = fileFor(name);
  if (fs.existsSync(src)) {
    fs.renameSync(src, path.join(QUARANTINE_DIR, `${name}.${Date.now()}.json`));
  }
}

function seedFor(name) {
  const p = path.join(SEED_DIR, `${name}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

export function read(name, fallback = null) {
  const file = fileFor(name);
  if (!fs.existsSync(file)) {
    const seed = seedFor(name);
    if (seed !== null) { writeSync(name, seed); return seed; }
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    quarantine(name); // corrupt — move aside, restore from seed if we have one
    const seed = seedFor(name);
    if (seed !== null) { writeSync(name, seed); return seed; }
    return fallback;
  }
}

function writeSync(name, data) {
  const file = fileFor(name);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file); // atomic on same filesystem
  backupDaily(name, file);
}

function backupDaily(name, file) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const dir = path.join(BACKUP_DIR, day);
    const dest = path.join(dir, `${name}.json`);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(file, dest);
    }
  } catch { /* backups must never break writes */ }
}

export function write(name, data) {
  return withLock(name, () => writeSync(name, data));
}

// Read-modify-write under the file's lock.
export function update(name, fn, fallback = null) {
  return withLock(name, () => {
    const data = read(name, fallback);
    const result = fn(data);
    writeSync(name, data);
    return result;
  });
}
