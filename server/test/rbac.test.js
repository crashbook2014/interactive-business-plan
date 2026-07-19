import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccess, redactFinancials, seesFinancials } from '../lib/rbac.js';
import { MODULE_ACCESS, findUser, scopeProperties, PROPERTIES, DEFAULT_LANDING } from '../config.js';

test('access matrix matches the spec', () => {
  // Home / Units / Moves: everyone
  for (const m of ['home', 'units', 'moves']) {
    for (const r of Object.keys(DEFAULT_LANDING)) assert.ok(canAccess(r, m), `${r} should access ${m}`);
  }
  // Shift & resident-facing modules: RX and up only
  for (const m of ['shift', 'residents', 'feedback', 'events']) {
    assert.ok(canAccess('rx', m));
    assert.ok(!canAccess('maintenance_manager', m));
    assert.ok(!canAccess('housekeeping_manager', m));
  }
  // Housekeeping: not plain RX, not maintenance manager; HK manager yes
  assert.ok(!canAccess('rx', 'housekeeping'));
  assert.ok(!canAccess('maintenance_manager', 'housekeeping'));
  assert.ok(canAccess('housekeeping_manager', 'housekeeping'));
  assert.ok(canAccess('senior_rx', 'housekeeping'));
  // Maintenance & cases: everyone except HK manager
  assert.ok(!canAccess('housekeeping_manager', 'maintenance'));
  assert.ok(!canAccess('housekeeping_manager', 'cases'));
  assert.ok(canAccess('rx', 'maintenance'));
  // Operations & oversight: management + senior RX only
  for (const m of ['operations', 'oversight']) {
    assert.ok(canAccess('senior_rx', m));
    assert.ok(!canAccess('rx', m));
    assert.ok(!canAccess('maintenance_manager', m));
    assert.ok(!canAccess('housekeeping_manager', m));
  }
});

test('financials only for GM and above', () => {
  for (const r of ['director', 'ops_manager', 'gm', 'agm']) assert.ok(seesFinancials({ role: r }));
  for (const r of ['senior_rx', 'rx', 'maintenance_manager', 'housekeeping_manager']) assert.ok(!seesFinancials({ role: r }));
});

test('redaction strips financial fields deeply', () => {
  const data = {
    board: [{ name: 'Narjis Gardens', revenue: 100, cost: 50, noi: 50, csat: 4.3, b2bAccounts: [{}], nested: { reserve: 9 } }],
    rollup: { revenue: 100, weightedOccupancy: 0.8 }
  };
  const out = redactFinancials(data, { role: 'senior_rx' });
  assert.equal(out.board[0].revenue, undefined);
  assert.equal(out.board[0].b2bAccounts, undefined);
  assert.equal(out.board[0].nested.reserve, undefined);
  assert.equal(out.board[0].csat, 4.3);
  assert.equal(out.rollup.weightedOccupancy, 0.8);
  const kept = redactFinancials(data, { role: 'gm' });
  assert.equal(kept.rollup.revenue, 100);
});

test('scoping: director sees region, RX sees one property, unknown email has no role', () => {
  const director = findUser('director@pulse.sa');
  assert.equal(scopeProperties(director).length, PROPERTIES.length);
  const rx = findUser('noor.hamdan@pulse.sa');
  assert.deepEqual(scopeProperties(rx), ['narjis-gardens']);
  assert.equal(findUser('stranger@pulse.sa'), null);
  assert.equal(findUser('noor.hamdan@evil.com'), null);
});

test('every module in the matrix has a landing owner and vice versa', () => {
  for (const landing of Object.values(DEFAULT_LANDING)) assert.ok(MODULE_ACCESS[landing], `landing ${landing} exists`);
  for (const [role, landing] of Object.entries(DEFAULT_LANDING)) {
    assert.ok(MODULE_ACCESS[landing].includes(role), `${role} can access its landing ${landing}`);
  }
});
