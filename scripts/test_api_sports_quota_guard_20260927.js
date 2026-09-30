const assert = require('assert');
const { createApiSportsQuotaGuard, quotaBlockDurationMs } = require('./api_sports_quota_guard');
const usage = { daily: 421, hourly: 2 };
const fixedNow = new Date('2026-09-27T17:30:00.000Z');
const guard = createApiSportsQuotaGuard({
  dailyBudget: 7000,
  now: () => fixedNow,
  readUsage: () => ({ ...usage }),
  addUsage: (amount) => { usage.daily += amount; usage.hourly += amount; },
  addReconciledUsage: (amount) => { usage.daily += amount; },
});
assert.strictEqual(guard.canRequest(), true);
guard.recordRequest();
assert.deepStrictEqual(usage, { daily: 422, hourly: 3 });
guard.reconcileProviderUsage(3183);
assert.deepStrictEqual(usage, { daily: 3183, hourly: 3 });
guard.reconcileProviderUsage(3000);
assert.deepStrictEqual(usage, { daily: 3183, hourly: 3 });
usage.daily = 7000;
assert.strictEqual(guard.canRequest(), false);
assert.strictEqual(quotaBlockDurationMs({ sport: 'football', snapshot: {
  used: 3183, limit: 7500, checkedAt: fixedNow.getTime() - 60000,
}, now: fixedNow }), 2 * 60 * 1000);
console.log('PASS football quota guard');
