'use strict';

/*
 * Standalone self-test for the two safety-critical tracker behaviours, run with
 * plain node (no Electron, no test framework). Mocks the tracker's collaborators
 * via require.cache so the REAL Tracker singleton is exercised:
 *   1. start() is race-proof — two concurrent calls create ONE session/timer set.
 *   2. the wall-clock time model can't inflate — duplicate ticks and sleep gaps
 *      never over-count; paused time is excluded.
 * Usage:  npm test   (from desktop/)
 */

const assert = require('node:assert');
const path = require('node:path');

const MAIN = path.join(__dirname, '..', 'main');

function mockModule(name, exports) {
  const file = path.join(MAIN, name + '.js');
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

// A mock whose unknown methods are no-op async functions; known ones are given.
function mk(overrides) {
  return new Proxy(overrides, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return async () => undefined;
    },
  });
}

// Controllable clock.
let NOW = 1_000_000_000;
const realNow = Date.now;
Date.now = () => NOW;

let startSessionCalls = 0;
mockModule('config', {
  isDev: true,
  DEFAULTS: { defaultSettings: { activity_sample_interval_seconds: 60, auto_pause_minutes: 0 } },
  paths: { userData: path.join(__dirname, '_st') },
  userPaths: (id) => ({ base: path.join(__dirname, '_st', String(id)), queueDb: 'x', screenshotsDir: 'y' }),
});
mockModule('api', mk({
  getSettings: async () => ({ activity_sample_interval_seconds: 60, auto_pause_minutes: 0 }),
  startSession: async () => { startSessionCalls++; return { id: 500 + startSessionCalls }; },
  heartbeat: async () => ({}),
  stopSession: async () => ({}),
}));
mockModule('queue', mk({ counts: () => ({ heartbeats: 0, samples: 0, screenshots: 0 }) }));
mockModule('store', mk({ get: () => null }));
mockModule('screenshotService', mk({}));
mockModule('activityService', mk({ getSystemIdleSeconds: () => 0 }));
mockModule('diag', mk({ log: () => {} }));

const tracker = require(path.join(MAIN, 'trackerService.js'));

(async () => {
  // ---- 1. start() race ----
  const p1 = tracker.start({ client_id: 1 });
  const p2 = tracker.start({ client_id: 1 }); // fired before p1's awaits resolve
  const settled = await Promise.allSettled([p1, p2]);

  assert.strictEqual(startSessionCalls, 1, 'two concurrent start() calls must create exactly ONE server session');
  assert.strictEqual(tracker.status().running, true, 'a session should be running after start');
  assert.strictEqual(settled.filter((r) => r.status === 'rejected').length, 1, 'the second concurrent start() must be rejected');
  console.log('PASS 1  concurrent start() -> one session, one timer set');

  // Stop the real intervals so they don't perturb the manual tick tests below.
  tracker._stopTimers();

  // ---- 2. wall-clock time model ----
  tracker.session.frozen_seconds = 0;
  tracker._lastTickMs = NOW;

  // 2a: five normal 1s ticks = 5s
  for (let i = 0; i < 5; i++) { NOW += 1000; tracker._tickActive(); }
  assert.strictEqual(Math.floor(tracker.session.frozen_seconds), 5, 'five 1s ticks should total 5s');

  // 2b: a DUPLICATE timer (two ticks per second) must NOT double the total
  for (let i = 0; i < 5; i++) { NOW += 1000; tracker._tickActive(); tracker._tickActive(); }
  assert.strictEqual(Math.floor(tracker.session.frozen_seconds), 10, 'duplicate ticks must not inflate (still +5s)');
  console.log('PASS 2a duplicate timers cannot inflate time');

  // 2c: a huge gap (sleep/hang) is capped, not counted as work
  NOW += 30 * 60 * 1000; // 30 minutes
  tracker._tickActive();
  assert.ok(Math.floor(tracker.session.frozen_seconds) <= 16, 'a 30-min gap must add at most the per-tick cap');
  console.log('PASS 2b sleep/hang gap is capped');

  // 2d: paused time is excluded; resume counts from now
  const before = Math.floor(tracker.session.frozen_seconds);
  tracker.session.paused_at_ms = NOW;
  for (let i = 0; i < 10; i++) { NOW += 1000; tracker._tickActive(); }
  assert.strictEqual(Math.floor(tracker.session.frozen_seconds), before, 'paused seconds must not be counted');
  tracker.session.paused_at_ms = null;
  NOW += 1000; tracker._tickActive();
  assert.strictEqual(Math.floor(tracker.session.frozen_seconds), before + 1, 'after resume, only real elapsed is counted');
  console.log('PASS 2c paused time excluded');

  Date.now = realNow;
  console.log('\nALL DESKTOP SELF-TESTS PASSED');
  process.exit(0);
})().catch((err) => {
  Date.now = realNow;
  console.error('DESKTOP SELF-TEST FAILED:', err && err.message ? err.message : err);
  process.exit(1);
});
