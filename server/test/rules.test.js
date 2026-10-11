import {test} from 'node:test';
import assert from 'node:assert/strict';
import {computeChecks, normaliseProfile} from '../src/rules.js';

const NOW = Date.parse('2026-10-11T12:00:00Z');
const base = {type: 'k', setAside: 'SBA', deadline: '2026-10-15T15:00:00-06:00', naics: ['812320'], place: {state: 'AZ'}};

test('eligible small business with exact NAICS and in-state work has no hard stop', () => {
  const p = normaliseProfile({naics: '812320, 561720', certs: ['sb'], states: 'AZ NM'});
  const c = computeChecks(base, p, NOW);
  assert.equal(c.hardStop, null);
  assert.equal(c.setAside.eligible, true);
  assert.equal(c.naics.match, 'exact');
  assert.equal(c.place.match, true);
  assert.equal(c.deadline.daysLeft, 4.4); // 15 Oct 21:00Z minus 11 Oct 12:00Z
});

test('set-aside the profile does not hold is a hard no-bid', () => {
  const p = normaliseProfile({certs: ['sb']});
  const c = computeChecks({...base, setAside: 'SDVOSBC'}, p, NOW);
  assert.equal(c.setAside.eligible, false);
  assert.equal(c.hardStop.verdict, 'No-bid');
  assert.match(c.hardStop.reason, /SDVOSB/);
});

test('SDVOSB qualifies for VA veteran-owned set-asides', () => {
  const c = computeChecks({...base, setAside: 'VSA'}, normaliseProfile({certs: ['sdvosb']}), NOW);
  assert.equal(c.setAside.eligible, true);
  assert.equal(c.hardStop, null);
});

test('sole source, passed deadline and award notices are hard stops', () => {
  const p = normaliseProfile({certs: ['8a']});
  assert.match(computeChecks({...base, setAside: '8AN'}, p, NOW).hardStop.reason, /already named/);
  assert.match(computeChecks({...base, deadline: '2026-10-01T15:00:00Z'}, p, NOW).hardStop.reason, /passed/);
  assert.match(computeChecks({...base, type: 'a'}, p, NOW).hardStop.reason, /Award Notice/);
});

test('related NAICS, unknown set-aside code and empty profile states', () => {
  const c = computeChecks({...base, setAside: 'XYZ', naics: ['812331']}, normaliseProfile({naics: ['812320']}), NOW);
  assert.equal(c.naics.match, 'related');
  assert.equal(c.setAside.eligible, null);
  assert.equal(c.place.match, null);
  assert.equal(c.hardStop, null);
});

test('profile normalisation drops junk', () => {
  const p = normaliseProfile({naics: '81232, 812320, abc', certs: ['SB', 'nope'], states: 'az, all, Texas', clearance: 'ultra'});
  assert.deepEqual(p.naics, ['812320']);
  assert.deepEqual(p.certs, ['sb']);
  assert.deepEqual(p.states, ['AZ', 'ALL']);
  assert.equal(p.clearance, 'none');
});
