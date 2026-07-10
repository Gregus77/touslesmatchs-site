/**
 * signal_validation.js — Module de validation centralise pour les signaux forts
 * POINT DE SAUVEGARDE 2026-07-10
 *
 * Chaque signal doit passer TOUS les criteres avant envoi Telegram.
 * Un seul echec = signal bloque + motif logge.
 *
 * Usage dans api_server.js :
 *   const { validateSignal } = require("./signal_validation");
 *   const gate = validateSignal(match, analysisResult, context);
 *   if (!gate.allowed) console.log(`[signal-gate] BLOQUE: ${gate.reasons.join(", ")}`);
 */

// ── Configuration des criteres ────────────────────────────────────────────────

const RULES = {
  // Fenetre de minutes autorisee (Football uniquement, autres sports = pas de limite minute)
  MIN_MINUTE: 35,
  MAX_MINUTE: 75,

  // Seuil de confiance minimum pour envoyer un signal
  MIN_CONFIDENCE: 80,

  // Consensus minimum : combien d'agents (sur 4, hors Chief) doivent etre d'accord
  MIN_CONSENSUS: 3,

  // Cotes autorisees
  MIN_ODDS: 1.25,
  MAX_ODDS: 1.95,

  // Limite de signaux par jour (tous sports confondus)
  MAX_SIGNALS_PER_DAY: 3,

  // Espacement minimum entre 2 signaux (en minutes)
  MIN_SPACING_MINUTES: 60,

  // Nombre de defaites consecutives avant pause automatique sur un segment sport/ligue
  CONSECUTIVE_LOSSES_PAUSE: 3,
  // Duree de pause apres defaites consecutives (en heures)
  PAUSE_DURATION_HOURS: 24,

  // Statuts de match interdits
  BLOCKED_STATUSES: ["FINISHED", "FT", "AET", "PEN", "ENDED", "CANCELLED",
    "POSTPONED", "SUSPENDED", "ABANDONED", "WALKOVER", "NOT_STARTED", "NS", "SCHEDULED"],

  // Marches autorises
  ALLOWED_MARKETS: [
    "Victoire domicile", "Victoire extérieur", "Match nul",
    "Over 2.5 buts", "Under 2.5 buts",
    "BTTS Oui", "BTTS Non",
    "Double chance 1X", "Double chance X2",
    "Handicap",
  ],

  // Sports autorises
  ALLOWED_SPORTS: ["Football", "Basketball", "Hockey", "Baseball", "Tennis"],
};

// ── Etat en memoire (reset au redemarrage) ─────────────────────────────────────

const _dailySignals = { date: "", count: 0, timestamps: [] };
const _sentMatches = new Set();
const _recentLosses = {};

// ── Fonctions utilitaires ─────────────────────────────────────────────────────

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function parseMinute(minute) {
  if (minute === null || minute === undefined) return null;
  const parsed = parseInt(String(minute).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resetDailyIfNeeded() {
  const today = getTodayStr();
  if (_dailySignals.date !== today) {
    _dailySignals.date = today;
    _dailySignals.count = 0;
    _dailySignals.timestamps = [];
    _sentMatches.clear();
  }
}

// ── Enregistrer une defaite pour la pause automatique ─────────────────────────

function recordLoss(sport, competition) {
  const key = `${sport}::${competition || "all"}`;
  if (!_recentLosses[key]) _recentLosses[key] = { count: 0, lastAt: 0 };
  _recentLosses[key].count++;
  _recentLosses[key].lastAt = Date.now();
}

function recordWin(sport, competition) {
  const key = `${sport}::${competition || "all"}`;
  if (_recentLosses[key]) _recentLosses[key].count = 0;
}

function isSegmentPaused(sport, competition) {
  const key = `${sport}::${competition || "all"}`;
  const data = _recentLosses[key];
  if (!data || data.count < RULES.CONSECUTIVE_LOSSES_PAUSE) return false;
  const elapsed = (Date.now() - data.lastAt) / (1000 * 60 * 60);
  if (elapsed >= RULES.PAUSE_DURATION_HOURS) {
    data.count = 0;
    return false;
  }
  return true;
}

// ── Validation principale ─────────────────────────────────────────────────────

/**
 * Valide un signal avant envoi.
 * @param {object} match - Donnees du match (home, away, competition, sport, minute, status, score_*)
 * @param {object} analysis - Resultat du concile (best_bet, confidence, consensus_votes, total_agents, agents, statsStatus)
 * @param {object} context - Contexte supplementaire { isLowTrust: fn, adaptiveThreshold: number, db: object }
 * @returns {{ allowed: boolean, reasons: string[], checks: object }}
 */
function validateSignal(match, analysis, context = {}) {
  resetDailyIfNeeded();
  const reasons = [];
  const checks = {};

  // 1. Competition autorisee
  const isLowTrust = typeof context.isLowTrust === "function"
    ? context.isLowTrust(match) : false;
  checks.competition = !isLowTrust;
  if (isLowTrust) reasons.push(`competition bloquee: ${match.competition || "?"}`);

  // 2. Statut match
  const status = String(match?.status || "").toUpperCase();
  const statusOk = !RULES.BLOCKED_STATUSES.includes(status);
  checks.status = statusOk;
  if (!statusOk) reasons.push(`statut interdit: ${status}`);

  // 3. Fenetre de minutes (Football seulement)
  const minute = parseMinute(match?.minute);
  const sport = String(match?.sport || "Football");
  let minuteOk = true;
  if (sport === "Football" && minute !== null) {
    minuteOk = minute >= RULES.MIN_MINUTE && minute < RULES.MAX_MINUTE;
  }
  checks.minute_window = minuteOk;
  if (!minuteOk) reasons.push(`hors fenetre: ${minute}' (autorise ${RULES.MIN_MINUTE}'-${RULES.MAX_MINUTE}')`);

  // 4. Donnees reelles (pas mock)
  const statsReal = analysis?.statsStatus?.status !== "mock_or_unavailable";
  checks.real_data = statsReal;
  if (!statsReal) reasons.push("donnees mock, pas de stats reelles");

  // 5. Consensus concile (min 3/5 agents d'accord sur le meme marche)
  const agents = analysis?.agents || [];
  const nonChiefAgents = agents.filter(a => !a.isChief && !a.failed);
  const betCounts = {};
  nonChiefAgents.forEach(a => { betCounts[a.bet] = (betCounts[a.bet] || 0) + 1; });
  const maxVotes = Math.max(0, ...Object.values(betCounts));
  const consensusOk = maxVotes >= RULES.MIN_CONSENSUS;
  checks.consensus = consensusOk;
  if (!consensusOk) reasons.push(`consensus faible: max ${maxVotes}/${nonChiefAgents.length} agents d'accord (min ${RULES.MIN_CONSENSUS})`);

  // 6. Confiance >= seuil
  const threshold = context.adaptiveThreshold || RULES.MIN_CONFIDENCE;
  const confidence = analysis?.confidence || 0;
  const confOk = confidence >= threshold;
  checks.confidence = confOk;
  if (!confOk) reasons.push(`confiance ${confidence}% < seuil ${threshold}%`);

  // 7. Marche autorise
  const bet = analysis?.best_bet || "";
  const marketOk = RULES.ALLOWED_MARKETS.some(m => bet.toLowerCase().includes(m.toLowerCase()));
  checks.market = marketOk;
  if (!marketOk) reasons.push(`marche non autorise: "${bet}"`);

  // 8. Cotes dans la fourchette
  const odds = analysis?.odds || (confidence > 0 ? Math.min(1.95, ((1 / (confidence / 100)) * 1.45)) : 0);
  const oddsOk = odds >= RULES.MIN_ODDS && odds <= RULES.MAX_ODDS;
  checks.odds = oddsOk;
  if (!oddsOk) reasons.push(`cote ${odds.toFixed(2)} hors fourchette [${RULES.MIN_ODDS}-${RULES.MAX_ODDS}]`);

  // 9. Coherence des modeles (pas de divergence extreme)
  const confidences = nonChiefAgents.map(a => a.confidence).filter(c => c != null);
  let coherenceOk = true;
  if (confidences.length >= 2) {
    const maxConf = Math.max(...confidences);
    const minConf = Math.min(...confidences);
    coherenceOk = (maxConf - minConf) <= 30;
  }
  checks.model_coherence = coherenceOk;
  if (!coherenceOk) reasons.push(`divergence forte entre agents: ecart ${Math.max(...confidences) - Math.min(...confidences)}%`);

  // 10. Limite journaliere
  const dailyOk = _dailySignals.count < RULES.MAX_SIGNALS_PER_DAY;
  checks.daily_limit = dailyOk;
  if (!dailyOk) reasons.push(`limite journaliere atteinte: ${_dailySignals.count}/${RULES.MAX_SIGNALS_PER_DAY}`);

  // 11. Espacement minimum
  const now = Date.now();
  const lastTs = _dailySignals.timestamps.length > 0
    ? _dailySignals.timestamps[_dailySignals.timestamps.length - 1] : 0;
  const spacingOk = !lastTs || (now - lastTs) >= RULES.MIN_SPACING_MINUTES * 60 * 1000;
  checks.spacing = spacingOk;
  if (!spacingOk) {
    const elapsed = Math.round((now - lastTs) / 60000);
    reasons.push(`espacement insuffisant: ${elapsed}min depuis le dernier (min ${RULES.MIN_SPACING_MINUTES}min)`);
  }

  // 12. Anti-doublon (1 signal max par match par jour)
  const matchKey = `${match?.home}_${match?.away}_${getTodayStr()}`;
  const dupeOk = !_sentMatches.has(matchKey);
  checks.no_duplicate = dupeOk;
  if (!dupeOk) reasons.push(`signal deja envoye pour ce match aujourd'hui`);

  // 13. Pause defaites consecutives
  const pauseActive = isSegmentPaused(sport, match?.competition);
  checks.no_loss_pause = !pauseActive;
  if (pauseActive) reasons.push(`pause active: ${RULES.CONSECUTIVE_LOSSES_PAUSE} defaites consecutives sur ${sport}/${match?.competition || "all"}`);

  // 14. Sport autorise
  const sportOk = RULES.ALLOWED_SPORTS.includes(sport);
  checks.sport = sportOk;
  if (!sportOk) reasons.push(`sport non autorise: ${sport}`);

  const allowed = reasons.length === 0;
  return { allowed, reasons, checks };
}

/**
 * Enregistre un signal comme envoye (a appeler APRES envoi reussi).
 */
function markSignalSent(match) {
  resetDailyIfNeeded();
  _dailySignals.count++;
  _dailySignals.timestamps.push(Date.now());
  const matchKey = `${match?.home}_${match?.away}_${getTodayStr()}`;
  _sentMatches.add(matchKey);
}

/**
 * Retourne l'etat actuel du gate pour le preflight.
 */
function getGateStatus() {
  resetDailyIfNeeded();
  return {
    signals_today: _dailySignals.count,
    max_per_day: RULES.MAX_SIGNALS_PER_DAY,
    remaining: RULES.MAX_SIGNALS_PER_DAY - _dailySignals.count,
    paused_segments: Object.entries(_recentLosses)
      .filter(([, d]) => d.count >= RULES.CONSECUTIVE_LOSSES_PAUSE)
      .map(([k, d]) => ({ segment: k, losses: d.count, last: new Date(d.lastAt).toISOString() })),
    rules: { ...RULES },
  };
}

module.exports = {
  validateSignal,
  markSignalSent,
  recordLoss,
  recordWin,
  getGateStatus,
  RULES,
};
