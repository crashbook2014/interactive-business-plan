import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccess, redactFinancials, seesFinancials } from '../lib/rbac.js';
import { MODULE_ACCESS, findUser, scopeProperties, PROPERTIES, DEFAULT_LANDING } from '../config.js';

test('access matrix matches the spec', () => {
  // Home + Events: everyone works events
  for (const m of ['home', 'events']) {
    for (const r of Object.keys(DEFAULT_LANDING)) assert.ok(canAccess(r, m), `${r} should access ${m}`);
  }
  // Shift, journeys, residents, feedback: RX and up only
  for (const m of ['shift', 'journeys', 'residents', 'feedback']) {
    assert.ok(canAccess('rx', m));
    assert.ok(!canAccess('production_manager', m));
    assert.ok(!canAccess('venue_manager', m));
  }
  // Cases: everyone except venue manager
  assert.ok(!canAccess('venue_manager', 'cases'));
  assert.ok(canAccess('production_manager', 'cases'));
  assert.ok(canAccess('rx', 'cases'));
  // Clients pipeline + experience + oversight: management and senior RX only
  for (const m of ['clients', 'experience', 'oversight']) {
    assert.ok(canAccess('senior_rx', m));
    assert.ok(!canAccess('rx', m));
    assert.ok(!canAccess('production_manager', m));
    assert.ok(!canAccess('venue_manager', m));
  }
});

test('financials only for GM and above', () => {
  for (const r of ['director', 'ops_manager', 'gm', 'agm']) assert.ok(seesFinancials({ role: r }));
  for (const r of ['senior_rx', 'rx', 'production_manager', 'venue_manager']) assert.ok(!seesFinancials({ role: r }));
});

test('redaction strips financial fields deeply', () => {
  const data = {
    board: [{ name: 'Narjis Gardens', revenue: 100, budget: 50, spend: 40, csat: 4.6, b2bAccounts: [{}], nested: { contractValue: 9 } }],
    rollup: { pipelineValue: 100, avgEventScore: 92 }
  };
  const out = redactFinancials(data, { role: 'senior_rx' });
  assert.equal(out.board[0].revenue, undefined);
  assert.equal(out.board[0].budget, undefined);
  assert.equal(out.board[0].b2bAccounts, undefined);
  assert.equal(out.board[0].nested.contractValue, undefined);
  assert.equal(out.board[0].csat, 4.6);
  assert.equal(out.rollup.pipelineValue, undefined);
  assert.equal(out.rollup.avgEventScore, 92);
  const kept = redactFinancials(data, { role: 'gm' });
  assert.equal(kept.rollup.pipelineValue, 100);
});

test('scoping: director sees region, RX sees one compound, unknown email has no role', () => {
  const director = findUser('director@pulse.sa');
  assert.equal(scopeProperties(director).length, PROPERTIES.length);
  const rx = findUser('noor.hamdan@pulse.sa');
  assert.deepEqual(scopeProperties(rx), ['narjis-gardens']);
  assert.equal(findUser('stranger@pulse.sa'), null);
  assert.equal(findUser('noor.hamdan@evil.com'), null);
});

test('every role lands on a module it can access', () => {
  for (const [role, landing] of Object.entries(DEFAULT_LANDING)) {
    assert.ok(MODULE_ACCESS[landing], `landing ${landing} exists`);
    assert.ok(MODULE_ACCESS[landing].includes(role), `${role} can access its landing ${landing}`);
  }
});
