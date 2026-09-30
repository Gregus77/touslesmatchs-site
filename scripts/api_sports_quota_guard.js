'use strict';

function createApiSportsQuotaGuard({ dailyBudget, now = () => new Date(), readUsage, addUsage, addReconciledUsage }) {
  const budget = Math.max(1, Number(dailyBudget) || 1);
  function dynamicHourlyBudget() {
    const current = now();
    const usage = readUsage();
    const remaining = Math.max(0, budget - Number(usage.daily || 0));
    const hoursRemaining = Math.max(1, 24 - current.getUTCHours());
    return Math.max(1, Math.ceil(remaining / hoursRemaining));
  }
  function canRequest() {
    const usage = readUsage();
    if (Number(usage.daily || 0) >= budget) return false;
    return Number(usage.hourly || 0) < dynamicHourlyBudget();
  }
  function recordRequest() {
    addUsage(1);
  }
  function reconcileProviderUsage(providerUsed) {
    const used = Math.max(0, Number(providerUsed) || 0);
    const local = Math.max(0, Number(readUsage().daily || 0));
    if (used > local) addReconciledUsage(used - local);
  }
  return { canRequest, recordRequest, reconcileProviderUsage, dynamicHourlyBudget };
}

function quotaBlockDurationMs({ sport, snapshot, now = new Date() }) {
  const checkedAt = Number(snapshot?.checkedAt || 0);
  const recent = checkedAt > 0 && now.getTime() - checkedAt <= 60 * 60 * 1000;
  const providerHasRoom = Number(snapshot?.limit || 0) > Number(snapshot?.used || 0);
  if (sport === 'football' && recent && providerHasRoom) return 2 * 60 * 1000;
  return 12 * 60 * 60 * 1000;
}

module.exports = { createApiSportsQuotaGuard, quotaBlockDurationMs };









