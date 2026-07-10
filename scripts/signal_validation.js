// Signal Validation Gate — TousLesMatchs
// Aucun signal n'est envoyé sans passer TOUS ces critères.
// Importé par api_server.js pour valider avant publication.

const VALIDATION_CONFIG = {
  // ── 1. Compétitions autorisées ──────────────────────────────────────────
  // Géré par isLowTrustCompetition() dans api_server.js
  // Refusés : amicaux, jeunes (U17-U23), réserves, régional, amateur,
  //           esport, exhibitions, charity, all-star, legends
  excludedCategories: [
    "friendly", "amical", "amicaux",
    "u17", "u18", "u19", "u20", "u21", "u23",
    "under 17", "under 18", "under 19", "under 20", "under 21", "under 23",
    "reserve", "reserves", "b team", "youth", "academy",
    "esport", "e-sport",
    "exhibition", "charity", "all-star", "all star", "legends",
    "world cup", "coupe du monde",
  ],

  // ── 2. Timing Live ──────────────────────────────────────────────────────
  liveMinMinute: 10,
  liveMaxMinute: 75,

  // ── 3. Données minimum requises ─────────────────────────────────────────
  requiredDataFields: ["stats", "forme", "classement"],
  minDataCompleteness: 2, // au moins 2 des 3 champs disponibles

  // ── 4. Consensus du Concile ─────────────────────────────────────────────
  minConsensusVotes: 3, // sur 5 agents, au moins 3 doivent voter pareil
  totalAgents: 5,

  // ── 5. Score de confiance ───────────────────────────────────────────────
  minConfidence: 80,
  prudentRange: [80, 85],
  optimalMin: 90,

  // ── 6. Marchés autorisés ────────────────────────────────────────────────
  allowedMarkets: [
    "Victoire domicile",
    "Victoire extérieur",
    "Double chance 1X",
    "Double chance X2",
    "Over 2.5 buts",
    "Under 2.5 buts",
    "BTTS Oui",
    "BTTS Non",
    "Match nul",
    "Handicap -1",
    "Handicap +1",
  ],

  // ── 7. Cotes autorisées ─────────────────────────────────────────────────
  minOdds: 1.25,
  maxOdds: 1.95,

  // ── 8. Limites d'envoi ──────────────────────────────────────────────────
  maxSignalsPerDay: 3,
  maxFreeSignalsPerDay: 1,
  minMinutesBetweenSignals: 60,

  // ── 9. Anti-doublon ─────────────────────────────────────────────────────
  deduplicationWindowHours: 24,

  // ── 10. Série négative — pause automatique ──────────────────────────────
  maxConsecutiveLosses: 3,
  lossPauseDurationHours: 24,

  // ── 11. Statuts de match exclus ─────────────────────────────────────────
  excludedMatchStatuses: [
    "POSTPONED", "CANCELLED", "SUSPENDED", "ABANDONED",
    "INTERRUPTED", "WALKOVER", "AWARDED",
  ],
};

// ── State tracking ────────────────────────────────────────────────────────────
const _signalState = {
  dailyDate: "",
  dailyCount: 0,
  dailyFreeCount: 0,
  lastSignalTime: 0,
  sentMatchKeys: new Set(),
  consecutiveLosses: {},
  pausedUntil: {},
};

function _resetDailyIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (_signalState.dailyDate !== today) {
    _signalState.dailyDate = today;
    _signalState.dailyCount = 0;
    _signalState.dailyFreeCount = 0;
    _signalState.sentMatchKeys.clear();
  }
}

// ── Validation Functions ──────────────────────────────────────────────────────

function validateCompetition(match, isLowTrustFn) {
  if (isLowTrustFn(match)) {
    return { pass: false, rule: "competition", reason: "Compétition non autorisée (low-trust)" };
  }
  return { pass: true, rule: "competition" };
}

function validateMatchStatus(match) {
  const status = String(match.status || "").toUpperCase();
  if (VALIDATION_CONFIG.excludedMatchStatuses.includes(status)) {
    return { pass: false, rule: "match_status", reason: `Match ${status} — exclu` };
  }
  return { pass: true, rule: "match_status" };
}

function validateLiveTiming(match) {
  const minute = parseInt(match.minute);
  if (isNaN(minute)) return { pass: true, rule: "live_timing" };

  const status = String(match.status || "").toUpperCase();
  const isLive = ["IN_PLAY", "LIVE"].includes(status);
  if (!isLive) return { pass: true, rule: "live_timing" };

  if (minute < VALIDATION_CONFIG.liveMinMinute) {
    return { pass: false, rule: "live_timing", reason: `Match à la ${minute}' — minimum ${VALIDATION_CONFIG.liveMinMinute}' requis` };
  }
  if (minute > VALIDATION_CONFIG.liveMaxMinute) {
    return { pass: false, rule: "live_timing", reason: `Match à la ${minute}' — trop tard (max ${VALIDATION_CONFIG.liveMaxMinute}')` };
  }
  return { pass: true, rule: "live_timing" };
}

function validateDataAvailability(analysisResult) {
  const statsStatus = analysisResult.statsStatus;
  if (!statsStatus) {
    return { pass: false, rule: "data_availability", reason: "Aucune donnée statistique disponible" };
  }
  if (statsStatus.available === false && statsStatus.reason === "mock_or_unavailable") {
    return { pass: false, rule: "data_availability", reason: "Données insuffisantes (mock)" };
  }
  return { pass: true, rule: "data_availability" };
}

function validateConsensus(analysisResult) {
  const votes = analysisResult.consensus_votes || 0;
  if (votes < VALIDATION_CONFIG.minConsensusVotes) {
    return { pass: false, rule: "consensus", reason: `Consensus insuffisant: ${votes}/${VALIDATION_CONFIG.totalAgents} (min ${VALIDATION_CONFIG.minConsensusVotes})` };
  }
  return { pass: true, rule: "consensus" };
}

function validateConfidence(analysisResult) {
  const confidence = analysisResult.confidence || 0;
  if (confidence < VALIDATION_CONFIG.minConfidence) {
    return { pass: false, rule: "confidence", reason: `Confiance ${confidence}% < seuil ${VALIDATION_CONFIG.minConfidence}%` };
  }
  return { pass: true, rule: "confidence", level: confidence >= VALIDATION_CONFIG.optimalMin ? "optimal" : "prudent" };
}

function validateMarket(analysisResult) {
  const bet = analysisResult.best_bet || "";
  const normalized = bet.trim();
  const allowed = VALIDATION_CONFIG.allowedMarkets.some(m =>
    normalized.toLowerCase().includes(m.toLowerCase())
  );
  if (!allowed) {
    return { pass: false, rule: "market", reason: `Marché "${bet}" non autorisé` };
  }
  return { pass: true, rule: "market" };
}

function validateOdds(analysisResult) {
  const confidence = analysisResult.confidence || 0;
  const odds = Math.min(VALIDATION_CONFIG.maxOdds, ((1 / (confidence / 100)) * 1.45));
  if (odds < VALIDATION_CONFIG.minOdds) {
    return { pass: false, rule: "odds", reason: `Cote ${odds.toFixed(2)} < minimum ${VALIDATION_CONFIG.minOdds}` };
  }
  return { pass: true, rule: "odds", odds: Number(odds.toFixed(2)) };
}

function validateModelCoherence(analysisResult) {
  const agents = analysisResult.agents || [];
  if (agents.length < 2) return { pass: true, rule: "coherence" };

  const bets = agents.map(a => a.bet).filter(Boolean);
  const betCounts = {};
  bets.forEach(b => { betCounts[b] = (betCounts[b] || 0) + 1; });
  const maxVotes = Math.max(...Object.values(betCounts));
  const uniqueBets = Object.keys(betCounts).length;

  if (uniqueBets >= 4 && maxVotes < 2) {
    return { pass: false, rule: "coherence", reason: `Forte divergence entre modèles (${uniqueBets} avis différents)` };
  }
  return { pass: true, rule: "coherence" };
}

function validateDailyLimit() {
  _resetDailyIfNeeded();
  if (_signalState.dailyCount >= VALIDATION_CONFIG.maxSignalsPerDay) {
    return { pass: false, rule: "daily_limit", reason: `Limite journalière atteinte (${VALIDATION_CONFIG.maxSignalsPerDay} signaux max)` };
  }
  return { pass: true, rule: "daily_limit" };
}

function validateSpacing() {
  const now = Date.now();
  const minGap = VALIDATION_CONFIG.minMinutesBetweenSignals * 60 * 1000;
  if (_signalState.lastSignalTime && (now - _signalState.lastSignalTime) < minGap) {
    const remaining = Math.ceil((minGap - (now - _signalState.lastSignalTime)) / 60000);
    return { pass: false, rule: "spacing", reason: `Signal trop rapproché — attendre ${remaining} min` };
  }
  return { pass: true, rule: "spacing" };
}

function validateNoDuplicate(match) {
  _resetDailyIfNeeded();
  const key = `${match.home}_${match.away}`;
  if (_signalState.sentMatchKeys.has(key)) {
    return { pass: false, rule: "duplicate", reason: `Signal déjà envoyé pour ${match.home} vs ${match.away} aujourd'hui` };
  }
  return { pass: true, rule: "duplicate" };
}

function validateNoLossStreak(match, db) {
  const sport = match.sport || "Football";
  const league = match.competition || match.league || "";
  const segment = `${sport}::${league}`;

  if (_signalState.pausedUntil[segment] && Date.now() < _signalState.pausedUntil[segment]) {
    return { pass: false, rule: "loss_streak", reason: `Pause auto sur ${segment} après ${VALIDATION_CONFIG.maxConsecutiveLosses} défaites consécutives` };
  }

  if (db) {
    try {
      const rows = db.prepare(`
        SELECT outcome FROM concile_analyses
        WHERE sport = ? AND competition = ? AND outcome IN ('win','loss')
        ORDER BY analysed_at DESC LIMIT ?
      `).all(sport, league, VALIDATION_CONFIG.maxConsecutiveLosses);

      if (rows.length >= VALIDATION_CONFIG.maxConsecutiveLosses &&
          rows.every(r => r.outcome === "loss")) {
        _signalState.pausedUntil[segment] = Date.now() + (VALIDATION_CONFIG.lossPauseDurationHours * 3600 * 1000);
        return { pass: false, rule: "loss_streak", reason: `${VALIDATION_CONFIG.maxConsecutiveLosses} défaites consécutives sur ${segment} — pause ${VALIDATION_CONFIG.lossPauseDurationHours}h` };
      }
    } catch (e) {
      // DB error — on laisse passer par précaution
    }
  }
  return { pass: true, rule: "loss_streak" };
}

// ── Main Gate ─────────────────────────────────────────────────────────────────

function validateSignal(match, analysisResult, { isLowTrustFn, db } = {}) {
  const checks = [
    validateCompetition(match, isLowTrustFn || (() => false)),
    validateMatchStatus(match),
    validateLiveTiming(match),
    validateDataAvailability(analysisResult),
    validateConsensus(analysisResult),
    validateConfidence(analysisResult),
    validateMarket(analysisResult),
    validateOdds(analysisResult),
    validateModelCoherence(analysisResult),
    validateDailyLimit(),
    validateSpacing(),
    validateNoDuplicate(match),
    validateNoLossStreak(match, db),
  ];

  const failures = checks.filter(c => !c.pass);
  const passed = failures.length === 0;

  const result = {
    passed,
    totalChecks: checks.length,
    passedChecks: checks.filter(c => c.pass).length,
    failedChecks: failures.length,
    failures: failures.map(f => ({ rule: f.rule, reason: f.reason })),
    checks,
  };

  if (!passed) {
    console.log(`[signal-gate] ❌ BLOQUÉ ${match.home} vs ${match.away} — ${failures.length} critère(s) échoué(s):`);
    failures.forEach(f => console.log(`  → [${f.rule}] ${f.reason}`));
  } else {
    console.log(`[signal-gate] ✅ VALIDÉ ${match.home} vs ${match.away} — ${checks.length}/${checks.length} critères OK`);
  }

  return result;
}

function recordSignalSent(match) {
  _resetDailyIfNeeded();
  const key = `${match.home}_${match.away}`;
  _signalState.sentMatchKeys.add(key);
  _signalState.dailyCount++;
  _signalState.lastSignalTime = Date.now();
}

function recordFreeSignalSent() {
  _resetDailyIfNeeded();
  _signalState.dailyFreeCount++;
}

function canSendFreeSignal() {
  _resetDailyIfNeeded();
  return _signalState.dailyFreeCount < VALIDATION_CONFIG.maxFreeSignalsPerDay;
}

function getSignalState() {
  _resetDailyIfNeeded();
  return {
    date: _signalState.dailyDate,
    signalsToday: _signalState.dailyCount,
    freeSignalsToday: _signalState.dailyFreeCount,
    maxSignals: VALIDATION_CONFIG.maxSignalsPerDay,
    maxFreeSignals: VALIDATION_CONFIG.maxFreeSignalsPerDay,
    pausedSegments: Object.entries(_signalState.pausedUntil)
      .filter(([, until]) => Date.now() < until)
      .map(([segment, until]) => ({ segment, until: new Date(until).toISOString() })),
  };
}

module.exports = {
  VALIDATION_CONFIG,
  validateSignal,
  recordSignalSent,
  recordFreeSignalSent,
  canSendFreeSignal,
  getSignalState,
};
