import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-store-'));
const { read, write, update, DATA_DIR } = await import('../lib/store.js');

test('write then read round-trips', async () => {
  await write('t1', { a: 1 });
  assert.deepEqual(read('t1'), { a: 1 });
});

test('update is read-modify-write', async () => {
  await write('t2', [1, 2]);
  await update('t2', d => d.push(3));
  assert.deepEqual(read('t2'), [1, 2, 3]);
});

test('corrupt file is quarantined and fallback returned', async () => {
  fs.writeFileSync(path.join(DATA_DIR, 't3.json'), '{not json');
  assert.deepEqual(read('t3', { safe: true }), { safe: true });
  const q = fs.readdirSync(path.join(DATA_DIR, 'quarantine'));
  assert.ok(q.some(f => f.startsWith('t3.')));
});

test('concurrent updates serialize under the lock', async () => {
  await write('t4', { n: 0 });
  await Promise.all(Array.from({ length: 25 }, () => update('t4', d => { d.n++; })));
  assert.equal(read('t4').n, 25);
});

test('daily backup is created on write', async () => {
  await write('t5', { b: 1 });
  const day = new Date().toISOString().slice(0, 10);
  assert.ok(fs.existsSync(path.join(DATA_DIR, 'backups', day, 't5.json')));
});
