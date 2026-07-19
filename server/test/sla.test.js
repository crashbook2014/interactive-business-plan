import test from 'node:test';
import assert from 'node:assert/strict';
import { slaState } from '../lib/sla.js';

const H = 3600_000;
const at = hoursAgo => new Date(Date.now() - hoursAgo * H).toISOString();

test('high priority: 8h window, at-risk at 75%', () => {
  assert.equal(slaState({ priority: 'high', status: 'open', createdAt: at(1) }).state, 'on-track');
  assert.equal(slaState({ priority: 'high', status: 'open', createdAt: at(7) }).state, 'at-risk');
  assert.equal(slaState({ priority: 'high', status: 'open', createdAt: at(9) }).state, 'breached');
});

test('normal 48h and low 120h windows', () => {
  assert.equal(slaState({ priority: 'normal', status: 'open', createdAt: at(20) }).state, 'on-track');
  assert.equal(slaState({ priority: 'normal', status: 'open', createdAt: at(49) }).state, 'breached');
  assert.equal(slaState({ priority: 'low', status: 'open', createdAt: at(100) }).state, 'at-risk');
});

test('done items are met regardless of age', () => {
  assert.equal(slaState({ priority: 'high', status: 'done', createdAt: at(100) }).state, 'met');
  assert.equal(slaState({ priority: 'high', status: 'resolved', createdAt: at(100) }).state, 'met');
});
