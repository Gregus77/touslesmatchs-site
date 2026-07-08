/**
 * hermes_brain.js — Hermès V3: Cerveau du Concile
 *
 * Hermès is the SOLE decision-maker. AI agents provide analysis, votes,
 * and confidence — Hermès alone decides whether to publish a signal.
 *
 * Indice Hermès™ — 16 sub-scores composing a 0–100 index:
 *   statistique, ia, historique, championnat, forme, domicile_exterieur,
 *   motivation, calendrier, blessures, fatigue, meteo, bookmakers,
 *   marche, donnees, stabilite, risque
 *
 * Independent rankings per sport × league × market.
 * Metrics per agent per context: ROI, Winrate, Yield, Precision, Stability.
 * Auto-learning after every result. Self-improving weights.
 *
 * CommonJS module — no circular dependencies.
 */

const Database = require("better-sqlite3");

const DEFAULT_CONFIG = {
  publicationThreshold: 90,
  trialPredictions: 15,
  weightSteps: [0, 0.25, 0.50, 1.0, 1.50, 2.0, 2.50],
  consensusLevels: {
    FAIBLE:       { min: 0,  max: 49, label: "Consensus faible" },
    MOYEN:        { min: 50, max: 69, label: "Consensus moyen" },
    FORT:         { min: 70, max: 89, label: "Consensus fort" },
    EXCEPTIONNEL: { min: 90, max: 100, label: "Consensus exceptionnel" },
  },
  indiceWeights: {
    statistique:        7,
    ia:                 10,
    historique:         10,
    championnat:        8,
    forme:              7,
    domicile_exterieur: 5,
    motivation:         5,
    calendrier:         4,
    blessures:          5,
    fatigue:            6,
    meteo:              3,
    bookmakers:         5,
    marche:             8,
    donnees:            5,
    stabilite:          7,
    risque:             5,
  },
  marketValidityRules: {
    "Over 2.5":      { maxMinute: 75 },
    "Under 2.5":     { maxMinute: 75 },
    "BTTS":          { maxMinute: 90, scoreCheck: true, scoreMaxMinute: 80 },
    "BTTS Oui":      { maxMinute: 90, scoreCheck: true, scoreMaxMinute: 80 },
    "BTTS Non":      { maxMinute: 90, scoreCheck: true, scoreMaxMinute: 80 },
    "Score exact":   { maxMinute: 60 },
    "Corners":       { maxMinute: 85 },
    "Cards":         { maxMinute: 85 },
    "Double chance": { maxMinute: 85 },
    "Winner":        { maxMinute: 90 },
    "1X2":           { maxMinute: 90 },
    "Handicap":      { maxMinute: 70 },
    "Moneyline":     { maxMinute: 90 },
    "Spread":        { maxMinute: 85 },
  },
  championshipReliability: {
    "Ligue 1": 95, "Premier League": 98, "La Liga": 95, "Serie A": 95,
    "Bundesliga": 95, "Champions League": 98, "Europa League": 90,
    "Liga Profesional": 70, "MLS": 75, "Eredivisie": 80,
    "Primeira Liga": 80, "Super Lig": 70, "Pro League": 75,
    "NBA": 95, "NFL": 95, "NHL": 90, "MLB": 85,
    "ATP": 85, "WTA": 80, "Ligue 2": 80, "Championship": 80,
    "Serie B": 75, "2. Bundesliga": 80, "Liga MX": 75,
    "J-League": 70, "K-League": 65, "A-League": 65,
  },
  autoDisable: { minPredictions: 20, winrateThreshold: 35 },
  autoPromote: { minPredictions: 10, winrateThreshold: 55 },
};

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS hermes_agents (
    agent_name TEXT PRIMARY KEY,
    display_order INTEGER DEFAULT 99,
    status TEXT DEFAULT 'active',
    weight REAL DEFAULT 1.0,
    trial_remaining INTEGER DEFAULT 0,
    total_analyses INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hermes_specializations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    sport TEXT NOT NULL DEFAULT 'football',
    competition TEXT NOT NULL DEFAULT '',
    market_type TEXT NOT NULL DEFAULT '',
    total_predictions INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 0,
    winrate REAL DEFAULT 0,
    roi REAL DEFAULT 0,
    yield REAL DEFAULT 0,
    precision_score REAL DEFAULT 0,
    stability REAL DEFAULT 0,
    weight REAL DEFAULT 1.0,
    rank INTEGER DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(agent_name, sport, competition, market_type)
  );

  CREATE TABLE IF NOT EXISTS hermes_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    sport TEXT NOT NULL DEFAULT 'football',
    competition TEXT NOT NULL DEFAULT '',
    market_type TEXT NOT NULL DEFAULT '',
    prediction TEXT,
    confidence REAL DEFAULT 0,
    vote TEXT,
    arguments TEXT,
    odds_range TEXT DEFAULT '',
    confidence_range TEXT DEFAULT '',
    outcome TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS hermes_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    match_key TEXT NOT NULL,
    home TEXT,
    away TEXT,
    competition TEXT DEFAULT '',
    sport TEXT DEFAULT 'football',
    market_type TEXT DEFAULT '',
    minute INTEGER DEFAULT 0,
    indice_hermes REAL DEFAULT 0,
    indice_breakdown TEXT,
    consensus_level TEXT DEFAULT '',
    consensus_pct REAL DEFAULT 0,
    votes_json TEXT,
    decision TEXT NOT NULL,
    decision_reason TEXT DEFAULT '',
    published INTEGER DEFAULT 0,
    result TEXT,
    roi REAL,
    winrate REAL,
    weight_changes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hermes_weight_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    old_weight REAL,
    new_weight REAL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS hermes_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sport TEXT NOT NULL,
    competition TEXT NOT NULL DEFAULT '',
    market_type TEXT NOT NULL DEFAULT '',
    agent_name TEXT NOT NULL,
    rank INTEGER DEFAULT 0,
    winrate REAL DEFAULT 0,
    roi REAL DEFAULT 0,
    yield REAL DEFAULT 0,
    precision_score REAL DEFAULT 0,
    stability REAL DEFAULT 0,
    total_predictions INTEGER DEFAULT 0,
    weight REAL DEFAULT 1.0,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(sport, competition, market_type, agent_name)
  );

  CREATE TABLE IF NOT EXISTS hermes_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`;

class HermesBrain {
  constructor(options = {}) {
    if (options.db) {
      this.db = options.db;
    } else {
      const dbPath = options.dbPath || process.env.HERMES_BRAIN_DB_PATH || "/app/data/hermes_brain.db";
      this.db = new Database(dbPath);
    }
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.config = { ...DEFAULT_CONFIG };
    const cfg = options.config || {};
    if (cfg.publicationThreshold != null) this.config.publicationThreshold = cfg.publicationThreshold;
    if (cfg.trialPredictions != null) this.config.trialPredictions = cfg.trialPredictions;
    if (cfg.weightSteps) this.config.weightSteps = cfg.weightSteps;
    if (cfg.indiceWeights) this.config.indiceWeights = { ...DEFAULT_CONFIG.indiceWeights, ...cfg.indiceWeights };
    if (cfg.consensusLevels) this.config.consensusLevels = { ...DEFAULT_CONFIG.consensusLevels, ...cfg.consensusLevels };
    if (cfg.marketValidityRules) this.config.marketValidityRules = { ...DEFAULT_CONFIG.marketValidityRules, ...cfg.marketValidityRules };
    if (cfg.championshipReliability) this.config.championshipReliability = { ...DEFAULT_CONFIG.championshipReliability, ...cfg.championshipReliability };
    if (cfg.autoDisable) this.config.autoDisable = { ...DEFAULT_CONFIG.autoDisable, ...cfg.autoDisable };
    if (cfg.autoPromote) this.config.autoPromote = { ...DEFAULT_CONFIG.autoPromote, ...cfg.autoPromote };

    this._initSchema();
  }

  _initSchema() {
    this.db.exec(SCHEMA_SQL);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  addAgent(name, options = {}) {
    const status = options.trial ? "trial" : "active";
    const trialRemaining = options.trial ? (options.trialPredictions || this.config.trialPredictions) : 0;
    const weight = status === "trial" ? 0.25 : (options.weight || 1.0);
    const order = options.displayOrder || 99;

    this.db.prepare(`
      INSERT OR IGNORE INTO hermes_agents (agent_name, display_order, status, weight, trial_remaining)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, order, status, weight, trialRemaining);

    return { name, status, weight, trialRemaining };
  }

  getAgent(name) {
    return this.db.prepare("SELECT * FROM hermes_agents WHERE agent_name = ?").get(name) || null;
  }

  listAgents(filter = {}) {
    let sql = "SELECT * FROM hermes_agents WHERE 1=1";
    const params = [];
    if (filter.status) { sql += " AND status = ?"; params.push(filter.status); }
    if (filter.enabledOnly) { sql += " AND status != 'disabled'"; }
    sql += " ORDER BY display_order ASC, agent_name ASC";
    return this.db.prepare(sql).all(...params);
  }

  disableAgent(name, reason = "") {
    const agent = this.getAgent(name);
    if (!agent) return null;
    this._logWeightChange(name, agent.weight, 0, reason || "disabled");
    this.db.prepare("UPDATE hermes_agents SET status = 'disabled', weight = 0, updated_at = datetime('now') WHERE agent_name = ?").run(name);
    return { name, status: "disabled", previousWeight: agent.weight };
  }

  enableAgent(name) {
    this.db.prepare("UPDATE hermes_agents SET status = 'active', weight = 1.0, updated_at = datetime('now') WHERE agent_name = ?").run(name);
    return { name, status: "active" };
  }

  setAgentWeight(name, weight, reason = "") {
    const snapped = this._snapToWeightStep(weight);
    const agent = this.getAgent(name);
    if (agent) this._logWeightChange(name, agent.weight, snapped, reason);
    this.db.prepare("UPDATE hermes_agents SET weight = ?, updated_at = datetime('now') WHERE agent_name = ?").run(snapped, name);
    return snapped;
  }

  _snapToWeightStep(raw) {
    const steps = this.config.weightSteps;
    let closest = steps[0];
    let minDist = Math.abs(raw - closest);
    for (const s of steps) {
      const d = Math.abs(raw - s);
      if (d < minDist) { closest = s; minDist = d; }
    }
    return closest;
  }

  _logWeightChange(name, oldW, newW, reason) {
    if (oldW === newW) return;
    this.db.prepare(`
      INSERT INTO hermes_weight_history (agent_name, old_weight, new_weight, reason)
      VALUES (?, ?, ?, ?)
    `).run(name, oldW, newW, reason);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET VALIDITY
  // ═══════════════════════════════════════════════════════════════════════════

  isMarketValid(marketType, minute, score) {
    const rule = this.config.marketValidityRules[marketType];
    if (!rule) return { valid: true, reason: "Marché non configuré" };

    if ((marketType === "BTTS" || marketType === "BTTS Oui" || marketType === "BTTS Non") && rule.scoreCheck && score) {
      const limit = rule.scoreMaxMinute || 80;
      if (minute > limit && (score.home === 0 || score.away === 0)) {
        return { valid: false, reason: `BTTS invalide après ${limit}' si une équipe n'a pas marqué` };
      }
    }

    if (minute > rule.maxMinute) {
      return { valid: false, reason: `${marketType} invalide après ${rule.maxMinute}'` };
    }

    if (score) {
      const totalGoals = score.home + score.away;
      const diff = Math.abs(score.home - score.away);
      if (minute >= 80 && totalGoals >= 4 && ["Under 2.5", "Score exact", "Handicap"].includes(marketType)) {
        return { valid: false, reason: `${marketType} sans valeur à ${minute}' avec score ${score.home}-${score.away}` };
      }
      if (minute >= 85 && diff >= 3 && ["1X2", "Winner", "Double chance", "Moneyline"].includes(marketType)) {
        return { valid: false, reason: `Résultat acquis à ${minute}' (${score.home}-${score.away})` };
      }
    }

    return { valid: true, reason: "Marché valide" };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INDICE HERMÈS™ — 16 sub-scores
  // ═══════════════════════════════════════════════════════════════════════════

  calculateIndiceHermes(context) {
    const {
      votes = [],
      market = "",
      sport = "football",
      competition = "",
      minute = 0,
      score = null,
      dataQuality = 1.0,
      statsAvailable = true,
      homeAway = null,
      matchImportance = null,
      scheduleDensity = null,
      injuryData = null,
      weatherData = null,
      oddsData = null,
    } = context;

    const w = this.config.indiceWeights;
    const totalWeight = Object.values(w).reduce((s, v) => s + v, 0);
    const breakdown = {};

    // 1. Score statistique — data quality + stats availability
    const statsScore = statsAvailable ? 80 : 30;
    const rawDataScore = Math.min(100, Math.round(dataQuality * 100));
    breakdown.statistique = Math.round((rawDataScore * 0.6) + (statsScore * 0.4));

    // 2. Score IA — agent historical performance on this market
    breakdown.ia = Math.round(this._getAgentHistoryScore(votes, sport, competition, market));

    // 3. Score historique — ROI + winrate historical
    const roiScore = this._getROIScore(votes, sport);
    const winrateScore = this._getWinrateScore(votes, sport);
    breakdown.historique = Math.round((roiScore * 0.5) + (winrateScore * 0.5));

    // 4. Score championnat — championship reliability
    breakdown.championnat = this._getChampionshipReliability(competition);

    // 5. Score forme — consensus-derived form indicator
    const consensusPct = this._calculateConsensusPct(votes);
    const coherence = this._getVoteCoherence(votes);
    breakdown.forme = Math.round((consensusPct * 0.6) + (coherence * 0.4));

    // 6. Score domicile/extérieur
    breakdown.domicile_exterieur = this._getHomeAwayScore(homeAway);

    // 7. Score motivation — match importance (knockout, relegation, title race)
    breakdown.motivation = this._getMotivationScore(matchImportance);

    // 8. Score calendrier — schedule density / fatigue potential
    breakdown.calendrier = this._getScheduleScore(scheduleDensity);

    // 9. Score blessures — injury data availability and impact
    breakdown.blessures = this._getInjuryScore(injuryData);

    // 10. Score fatigue — minute-based analysis quality decay
    breakdown.fatigue = this._getFatigueScore(minute);

    // 11. Score météo — weather conditions impact
    breakdown.meteo = this._getWeatherScore(weatherData);

    // 12. Score bookmakers — odds alignment with AI consensus
    breakdown.bookmakers = this._getBookmakerScore(oddsData, votes);

    // 13. Score marché — market validity
    const validity = this.isMarketValid(market, minute, score);
    breakdown.marche = validity.valid ? 100 : 0;

    // 14. Score données — overall data completeness
    breakdown.donnees = this._getDataCompletenessScore(context);

    // 15. Score stabilité — agent vote stability/consistency
    breakdown.stabilite = Math.round(this._getStabilityScore(votes));

    // 16. Score risque — risk assessment (inverse: higher = lower risk = better)
    breakdown.risque = this._getRiskScore(votes, minute, score, market);

    // Weighted total
    let scoreTotal = 0;
    for (const [key, maxPts] of Object.entries(w)) {
      const raw = breakdown[key] || 0;
      scoreTotal += (raw / 100) * maxPts;
    }
    const finalScore = Math.round((scoreTotal / totalWeight) * 100);

    return {
      score: Math.min(100, Math.max(0, finalScore)),
      breakdown,
      totalWeight,
    };
  }

  _getAgentHistoryScore(votes, sport, competition, market) {
    if (votes.length === 0 || !market) return 50;
    let totalScore = 0;
    let count = 0;
    for (const v of votes) {
      const spec = this.db.prepare(`
        SELECT winrate, total_predictions FROM hermes_specializations
        WHERE agent_name = ? AND sport = ? AND market_type = ?
        AND (competition = ? OR competition = '')
        ORDER BY total_predictions DESC LIMIT 1
      `).get(v.agentName, sport.toLowerCase(), market, competition);
      if (spec && spec.total_predictions >= 3) {
        totalScore += spec.winrate;
        count++;
      }
    }
    return count > 0 ? totalScore / count : 50;
  }

  _getROIScore(votes, sport) {
    if (votes.length === 0) return 50;
    let total = 0, count = 0;
    for (const v of votes) {
      const stats = this.db.prepare(`
        SELECT SUM(roi * total_predictions) / NULLIF(SUM(total_predictions), 0) as avg_roi
        FROM hermes_specializations WHERE agent_name = ? AND sport = ?
      `).get(v.agentName, sport.toLowerCase());
      if (stats?.avg_roi != null) {
        total += Math.min(100, Math.max(0, 50 + stats.avg_roi * 2));
        count++;
      }
    }
    return count > 0 ? total / count : 50;
  }

  _getWinrateScore(votes, sport) {
    if (votes.length === 0) return 50;
    let total = 0, count = 0;
    for (const v of votes) {
      const stats = this.db.prepare(`
        SELECT SUM(wins) as w, SUM(total_predictions) as t
        FROM hermes_specializations WHERE agent_name = ? AND sport = ?
      `).get(v.agentName, sport.toLowerCase());
      if (stats?.t > 0) {
        total += (stats.w / stats.t) * 100;
        count++;
      }
    }
    return count > 0 ? total / count : 50;
  }

  _getChampionshipReliability(competition) {
    if (!competition) return 50;
    for (const [name, score] of Object.entries(this.config.championshipReliability)) {
      if (competition.toLowerCase().includes(name.toLowerCase())) return score;
    }
    return 50;
  }

  _calculateConsensusPct(votes) {
    if (votes.length === 0) return 0;
    const activeVotes = votes.filter(v => v.vote && (v.weight == null || v.weight > 0));
    if (activeVotes.length === 0) return 0;

    const totalWeight = activeVotes.reduce((s, v) => s + (v.weight || 1), 0);
    const betCounts = {};
    for (const v of activeVotes) {
      betCounts[v.vote] = (betCounts[v.vote] || 0) + (v.weight || 1);
    }
    const maxWeight = Math.max(...Object.values(betCounts));
    return totalWeight > 0 ? (maxWeight / totalWeight) * 100 : 0;
  }

  _getVoteCoherence(votes) {
    if (votes.length < 2) return 50;
    const activeVotes = votes.filter(v => v.vote);
    if (activeVotes.length < 2) return 50;

    const confidences = activeVotes.map(v => v.confidence || 0);
    const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    const variance = confidences.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / confidences.length;
    const stddev = Math.sqrt(variance);

    const bets = activeVotes.map(v => v.vote);
    const uniqueBets = [...new Set(bets)];
    const agreementRatio = (bets.length - uniqueBets.length + 1) / bets.length;

    const confCoherence = Math.max(0, 100 - stddev * 3);
    const voteCoherence = agreementRatio * 100;

    return (confCoherence * 0.4 + voteCoherence * 0.6);
  }

  _getHomeAwayScore(homeAway) {
    if (!homeAway) return 50;
    if (homeAway === "home") return 65;
    if (homeAway === "away") return 40;
    if (homeAway === "neutral") return 50;
    return 50;
  }

  _getMotivationScore(matchImportance) {
    if (matchImportance == null) return 50;
    return Math.min(100, Math.max(0, Math.round(matchImportance)));
  }

  _getScheduleScore(scheduleDensity) {
    if (scheduleDensity == null) return 50;
    return Math.min(100, Math.max(0, Math.round(scheduleDensity)));
  }

  _getInjuryScore(injuryData) {
    if (!injuryData) return 50;
    if (typeof injuryData === "number") return Math.min(100, Math.max(0, Math.round(injuryData)));
    if (injuryData.available === false) return 30;
    return injuryData.score || 50;
  }

  _getFatigueScore(minute) {
    if (minute === 0) return 100;
    if (minute <= 15) return 95;
    if (minute <= 30) return 90;
    if (minute <= 45) return 85;
    if (minute <= 60) return 70;
    if (minute <= 75) return 50;
    if (minute <= 85) return 30;
    return 10;
  }

  _getWeatherScore(weatherData) {
    if (!weatherData) return 50;
    if (typeof weatherData === "number") return Math.min(100, Math.max(0, Math.round(weatherData)));
    return weatherData.score || 50;
  }

  _getBookmakerScore(oddsData, votes) {
    if (!oddsData) return 50;
    if (typeof oddsData === "number") return Math.min(100, Math.max(0, Math.round(oddsData)));
    return oddsData.alignment || 50;
  }

  _getDataCompletenessScore(context) {
    let score = 30;
    if (context.statsAvailable) score += 20;
    if (context.dataQuality >= 0.8) score += 15;
    if (context.competition) score += 10;
    if (context.homeAway) score += 5;
    if (context.injuryData) score += 5;
    if (context.oddsData) score += 5;
    if (context.weatherData) score += 5;
    if (context.matchImportance != null) score += 5;
    return Math.min(100, score);
  }

  _getStabilityScore(votes) {
    if (votes.length < 2) return 50;
    const activeVotes = votes.filter(v => v.vote);
    if (activeVotes.length < 2) return 50;

    const agentStabilities = [];
    for (const v of activeVotes) {
      const spec = this.db.prepare(`
        SELECT stability FROM hermes_specializations
        WHERE agent_name = ? AND total_predictions >= 5
        ORDER BY total_predictions DESC LIMIT 1
      `).get(v.agentName);
      if (spec) agentStabilities.push(spec.stability);
    }

    if (agentStabilities.length === 0) return 50;
    return agentStabilities.reduce((a, b) => a + b, 0) / agentStabilities.length;
  }

  _getRiskScore(votes, minute, score, market) {
    let risk = 70;

    if (votes.length === 0) return 30;

    const avgConf = votes.reduce((s, v) => s + (v.confidence || 0), 0) / votes.length;
    if (avgConf < 55) risk -= 20;
    else if (avgConf > 80) risk += 15;

    if (minute > 75) risk -= 15;
    if (minute > 85) risk -= 10;

    if (score) {
      const diff = Math.abs(score.home - score.away);
      if (diff >= 3 && minute > 70) risk += 10;
      if (diff === 0 && minute > 80) risk -= 10;
    }

    const uniqueBets = [...new Set(votes.filter(v => v.vote).map(v => v.vote))];
    if (uniqueBets.length === 1) risk += 10;
    if (uniqueBets.length >= 4) risk -= 15;

    return Math.min(100, Math.max(0, risk));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSENSUS
  // ═══════════════════════════════════════════════════════════════════════════

  getConsensusLevel(pct) {
    for (const [key, def] of Object.entries(this.config.consensusLevels)) {
      if (pct >= def.min && pct <= def.max) {
        return { level: key, label: def.label, pct };
      }
    }
    return { level: "FAIBLE", label: "Consensus faible", pct };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HERMÈS DECISION — evaluate()
  // ═══════════════════════════════════════════════════════════════════════════

  evaluate(context) {
    const {
      matchKey,
      home = "",
      away = "",
      competition = "",
      sport = "football",
      market = "",
      minute = 0,
      score = null,
      votes = [],
      dataQuality = 1.0,
      statsAvailable = true,
    } = context;

    const enrichedVotes = this._enrichVotes(votes, sport, competition, market);

    const indice = this.calculateIndiceHermes({
      ...context,
      votes: enrichedVotes,
    });

    const consensusPct = this._calculateConsensusPct(enrichedVotes);
    const consensus = this.getConsensusLevel(consensusPct);
    const dominantBet = this._getDominantBet(enrichedVotes);
    const marketValidity = this.isMarketValid(market, minute, score);

    const threshold = this.config.publicationThreshold;
    const shouldPublish = indice.score >= threshold && marketValidity.valid;

    let decision, decisionReason;
    if (!marketValidity.valid) {
      decision = "REFUS";
      decisionReason = `Marché invalide: ${marketValidity.reason}`;
    } else if (indice.score < threshold) {
      decision = "REFUS";
      decisionReason = `Indice Hermès ${indice.score}/100 < seuil ${threshold}. Aujourd'hui aucun signal suffisamment fiable.`;
    } else {
      decision = "PUBLICATION";
      decisionReason = `Indice Hermès ${indice.score}/100 ≥ seuil ${threshold}. Consensus ${consensus.label}. Marché valide.`;
    }

    this._recordPredictions(matchKey, enrichedVotes, sport, competition, market);
    this._decrementTrials(enrichedVotes);
    this._incrementAnalyseCount(enrichedVotes);

    const journalEntry = {
      date: new Date().toISOString(),
      matchKey, home, away, competition, sport, market, minute,
      indiceHermes: indice.score,
      indiceBreakdown: indice.breakdown,
      consensusLevel: consensus.level,
      consensusPct: consensus.pct,
      votes: enrichedVotes.map(v => ({
        agent: v.agentName,
        vote: v.vote,
        confidence: v.confidence,
        weight: v.weight,
        arguments: v.arguments,
      })),
      decision, decisionReason,
      published: shouldPublish,
    };
    this._writeJournal(journalEntry);

    return {
      decision,
      reason: decisionReason,
      published: shouldPublish,
      indiceHermes: indice.score,
      indiceBreakdown: indice.breakdown,
      consensus,
      dominantBet,
      marketValid: marketValidity.valid,
      votes: enrichedVotes,
      journalId: journalEntry.id,
    };
  }

  _enrichVotes(votes, sport, competition, market) {
    return votes.map(v => {
      const agent = this.getAgent(v.agentName);
      const baseWeight = agent ? agent.weight : 1.0;
      const status = agent ? agent.status : "active";

      const spec = this.db.prepare(`
        SELECT weight, winrate, total_predictions, stability FROM hermes_specializations
        WHERE agent_name = ? AND sport = ? AND market_type = ?
        AND (competition = ? OR competition = '')
        ORDER BY total_predictions DESC LIMIT 1
      `).get(v.agentName, sport.toLowerCase(), market || "", competition || "");

      let contextWeight = spec ? spec.weight : baseWeight;
      if (status === "trial") contextWeight = Math.min(contextWeight, 0.25);
      if (status === "disabled") contextWeight = 0;

      return {
        ...v,
        weight: this._snapToWeightStep(contextWeight),
        status,
        specialization: spec || null,
      };
    });
  }

  _getDominantBet(votes) {
    const activeVotes = votes.filter(v => v.vote && v.weight > 0);
    if (activeVotes.length === 0) return null;

    const weighted = {};
    for (const v of activeVotes) {
      weighted[v.vote] = (weighted[v.vote] || 0) + (v.weight || 1) * (v.confidence || 50);
    }
    const sorted = Object.entries(weighted).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : null;
  }

  _recordPredictions(matchKey, votes, sport, competition, market) {
    const stmt = this.db.prepare(`
      INSERT INTO hermes_predictions
        (match_key, agent_name, sport, competition, market_type, prediction, confidence, vote, arguments, confidence_range)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((vs) => {
      for (const v of vs) {
        const confRange = this._confidenceRange(v.confidence || 0);
        stmt.run(matchKey, v.agentName, sport.toLowerCase(), competition, market,
          v.prediction || v.vote, v.confidence || 0, v.vote || "", v.arguments || "", confRange);
      }
    });
    tx(votes);
  }

  _confidenceRange(confidence) {
    if (confidence < 50) return "very_low";
    if (confidence < 60) return "low";
    if (confidence < 70) return "medium";
    if (confidence < 80) return "high";
    return "very_high";
  }

  _decrementTrials(votes) {
    const stmt = this.db.prepare(`
      UPDATE hermes_agents SET trial_remaining = MAX(0, trial_remaining - 1),
      updated_at = datetime('now') WHERE agent_name = ? AND status = 'trial'
    `);
    for (const v of votes) {
      stmt.run(v.agentName);
    }
    const completed = this.db.prepare(
      "SELECT * FROM hermes_agents WHERE status = 'trial' AND trial_remaining <= 0"
    ).all();
    for (const agent of completed) {
      this._evaluateTrialAgent(agent.agent_name);
    }
  }

  _incrementAnalyseCount(votes) {
    const stmt = this.db.prepare(`
      UPDATE hermes_agents SET total_analyses = total_analyses + 1, updated_at = datetime('now')
      WHERE agent_name = ?
    `);
    for (const v of votes) {
      stmt.run(v.agentName);
    }
  }

  _evaluateTrialAgent(name) {
    const stats = this.db.prepare(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins
      FROM hermes_predictions WHERE agent_name = ? AND outcome != 'pending'
    `).get(name);

    if (!stats || stats.total < 3) {
      this.db.prepare("UPDATE hermes_agents SET status = 'active', weight = 0.5, updated_at = datetime('now') WHERE agent_name = ?").run(name);
      this._logWeightChange(name, 0.25, 0.5, "trial completed — insufficient data, promoted with low weight");
      return "promoted_low";
    }

    const winrate = (stats.wins / stats.total) * 100;
    if (winrate >= this.config.autoPromote.winrateThreshold) {
      this.db.prepare("UPDATE hermes_agents SET status = 'active', weight = 1.0, updated_at = datetime('now') WHERE agent_name = ?").run(name);
      this._logWeightChange(name, 0.25, 1.0, `trial completed — promoted (winrate ${winrate.toFixed(1)}%)`);
      return "promoted";
    } else if (winrate < this.config.autoDisable.winrateThreshold) {
      this.db.prepare("UPDATE hermes_agents SET status = 'disabled', weight = 0, updated_at = datetime('now') WHERE agent_name = ?").run(name);
      this._logWeightChange(name, 0.25, 0, `trial failed — disabled (winrate ${winrate.toFixed(1)}%)`);
      return "disabled";
    } else {
      this.db.prepare("UPDATE hermes_agents SET status = 'active', weight = 0.5, updated_at = datetime('now') WHERE agent_name = ?").run(name);
      this._logWeightChange(name, 0.25, 0.5, `trial completed — average (winrate ${winrate.toFixed(1)}%)`);
      return "promoted_low";
    }
  }

  _writeJournal(entry) {
    const result = this.db.prepare(`
      INSERT INTO hermes_journal
        (date, match_key, home, away, competition, sport, market_type, minute,
         indice_hermes, indice_breakdown, consensus_level, consensus_pct,
         votes_json, decision, decision_reason, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.date, entry.matchKey, entry.home, entry.away,
      entry.competition, entry.sport, entry.market, entry.minute,
      entry.indiceHermes, JSON.stringify(entry.indiceBreakdown),
      entry.consensusLevel, entry.consensusPct,
      JSON.stringify(entry.votes), entry.decision, entry.decisionReason,
      entry.published ? 1 : 0
    );
    entry.id = result.lastInsertRowid;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEARNING LOOP — processResult()
  // ═══════════════════════════════════════════════════════════════════════════

  processResult(matchKey, outcome) {
    const updated = this.db.prepare(`
      UPDATE hermes_predictions SET outcome = ?, resolved_at = datetime('now')
      WHERE match_key = ? AND outcome = 'pending'
    `).run(outcome, matchKey);

    const affected = this.db.prepare(`
      SELECT DISTINCT agent_name, sport, competition, market_type
      FROM hermes_predictions WHERE match_key = ?
    `).all(matchKey);

    for (const row of affected) {
      this._recalculateSpecialization(row.agent_name, row.sport, row.competition, row.market_type);
    }

    this._rebuildRankings(affected);

    const weightChanges = this._recalculateAllWeights();
    const actions = this._autoManage();

    this.db.prepare(`
      UPDATE hermes_journal SET result = ?,
        weight_changes = ?,
        roi = (SELECT CASE WHEN COUNT(*) > 0
          THEN ROUND(CAST(SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) - SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2)
          ELSE 0 END FROM hermes_predictions WHERE outcome != 'pending'),
        winrate = (SELECT CASE WHEN COUNT(*) > 0
          THEN ROUND(CAST(SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2)
          ELSE 0 END FROM hermes_predictions WHERE outcome != 'pending')
      WHERE match_key = ?
    `).run(outcome, JSON.stringify(weightChanges), matchKey);

    return {
      predictionsResolved: updated.changes,
      weightChanges,
      actions,
    };
  }

  _recalculateSpecialization(agentName, sport, competition, marketType) {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN outcome = 'pending' THEN 1 ELSE 0 END) as pending,
        AVG(confidence) as avg_confidence
      FROM hermes_predictions
      WHERE agent_name = ? AND sport = ? AND competition = ? AND market_type = ?
    `).get(agentName, sport, competition, marketType);

    if (!stats || stats.total === 0) return;

    const resolved = stats.wins + stats.losses;
    const winrate = resolved > 0 ? Math.round((stats.wins / resolved) * 10000) / 100 : 0;
    const roi = resolved > 0 ? Math.round(((stats.wins - stats.losses) / resolved) * 10000) / 100 : 0;
    const yieldVal = stats.total > 0 ? Math.round(((stats.wins - stats.losses) / stats.total) * 10000) / 100 : 0;

    const precision = this._calculatePrecision(agentName, sport, competition, marketType);
    const stability = this._calculateStability(agentName, sport, competition, marketType);
    const weight = this._calculateSpecWeight(winrate, resolved, roi);

    this.db.prepare(`
      INSERT INTO hermes_specializations
        (agent_name, sport, competition, market_type, total_predictions, wins, losses, pending,
         winrate, roi, yield, precision_score, stability, weight, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(agent_name, sport, competition, market_type) DO UPDATE SET
        total_predictions = excluded.total_predictions,
        wins = excluded.wins,
        losses = excluded.losses,
        pending = excluded.pending,
        winrate = excluded.winrate,
        roi = excluded.roi,
        yield = excluded.yield,
        precision_score = excluded.precision_score,
        stability = excluded.stability,
        weight = excluded.weight,
        last_updated = excluded.last_updated
    `).run(agentName, sport, competition, marketType, stats.total, stats.wins, stats.losses,
      stats.pending, winrate, roi, yieldVal, precision, stability, weight);
  }

  _calculatePrecision(agentName, sport, competition, marketType) {
    const rows = this.db.prepare(`
      SELECT confidence, outcome FROM hermes_predictions
      WHERE agent_name = ? AND sport = ? AND competition = ? AND market_type = ?
      AND outcome != 'pending'
      ORDER BY created_at DESC LIMIT 30
    `).all(agentName, sport, competition, marketType);

    if (rows.length < 3) return 50;

    let calibrationError = 0;
    for (const r of rows) {
      const expected = (r.confidence || 50) / 100;
      const actual = r.outcome === "win" ? 1 : 0;
      calibrationError += Math.abs(expected - actual);
    }
    const avgError = calibrationError / rows.length;
    return Math.round(Math.max(0, (1 - avgError) * 100));
  }

  _calculateStability(agentName, sport, competition, marketType) {
    const rows = this.db.prepare(`
      SELECT outcome FROM hermes_predictions
      WHERE agent_name = ? AND sport = ? AND competition = ? AND market_type = ?
      AND outcome != 'pending'
      ORDER BY created_at DESC LIMIT 20
    `).all(agentName, sport, competition, marketType);

    if (rows.length < 5) return 50;

    let streakChanges = 0;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].outcome !== rows[i - 1].outcome) streakChanges++;
    }
    const changeRate = streakChanges / (rows.length - 1);
    const idealRate = 0.4;
    const deviation = Math.abs(changeRate - idealRate);
    return Math.round(Math.max(0, (1 - deviation * 2) * 100));
  }

  _calculateSpecWeight(winrate, total, roi) {
    let raw = 1.0;
    if (winrate >= 65) raw += 0.8;
    else if (winrate >= 60) raw += 0.5;
    else if (winrate >= 55) raw += 0.3;
    else if (winrate >= 50) raw += 0.1;
    else if (winrate >= 40) raw -= 0.3;
    else raw -= 0.5;

    if (roi > 15) raw += 0.4;
    else if (roi > 5) raw += 0.2;
    else if (roi < -10) raw -= 0.3;

    if (total < 5) raw *= 0.6;
    else if (total < 10) raw *= 0.8;
    else if (total >= 30) raw *= 1.15;

    return this._snapToWeightStep(raw);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RANKINGS — independent per sport × league × market
  // ═══════════════════════════════════════════════════════════════════════════

  _rebuildRankings(affectedContexts) {
    const seen = new Set();
    for (const ctx of affectedContexts) {
      const key = `${ctx.sport}|${ctx.competition}|${ctx.market_type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      this._rebuildRankingForContext(ctx.sport, ctx.competition, ctx.market_type);
    }
  }

  _rebuildRankingForContext(sport, competition, marketType) {
    const agents = this.db.prepare(`
      SELECT s.agent_name, s.winrate, s.roi, s.yield, s.precision_score,
             s.stability, s.total_predictions, s.weight
      FROM hermes_specializations s
      JOIN hermes_agents a ON s.agent_name = a.agent_name
      WHERE s.sport = ? AND s.competition = ? AND s.market_type = ?
      AND a.status != 'disabled'
      ORDER BY s.weight DESC, s.winrate DESC, s.roi DESC
    `).all(sport, competition, marketType);

    const upsert = this.db.prepare(`
      INSERT INTO hermes_rankings
        (sport, competition, market_type, agent_name, rank, winrate, roi, yield,
         precision_score, stability, total_predictions, weight, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(sport, competition, market_type, agent_name) DO UPDATE SET
        rank = excluded.rank,
        winrate = excluded.winrate,
        roi = excluded.roi,
        yield = excluded.yield,
        precision_score = excluded.precision_score,
        stability = excluded.stability,
        total_predictions = excluded.total_predictions,
        weight = excluded.weight,
        last_updated = excluded.last_updated
    `);

    const tx = this.db.transaction(() => {
      agents.forEach((a, i) => {
        upsert.run(sport, competition, marketType, a.agent_name, i + 1,
          a.winrate, a.roi, a.yield, a.precision_score, a.stability,
          a.total_predictions, a.weight);
      });
    });
    tx();

    // Update rank in specializations too
    agents.forEach((a, i) => {
      this.db.prepare(`
        UPDATE hermes_specializations SET rank = ?
        WHERE agent_name = ? AND sport = ? AND competition = ? AND market_type = ?
      `).run(i + 1, a.agent_name, sport, competition, marketType);
    });
  }

  getRankings(sport, competition = "", marketType = "") {
    let sql = "SELECT * FROM hermes_rankings WHERE sport = ?";
    const params = [sport.toLowerCase()];
    if (competition) { sql += " AND competition = ?"; params.push(competition); }
    if (marketType) { sql += " AND market_type = ?"; params.push(marketType); }
    sql += " ORDER BY rank ASC";
    return this.db.prepare(sql).all(...params);
  }

  getAllRankings() {
    return this.db.prepare(`
      SELECT sport, competition, market_type,
        GROUP_CONCAT(agent_name || ':' || rank || ':' || winrate || ':' || roi, '|') as agents,
        COUNT(*) as agent_count
      FROM hermes_rankings
      GROUP BY sport, competition, market_type
      ORDER BY sport, competition, market_type
    `).all();
  }

  _recalculateAllWeights() {
    const agents = this.db.prepare(`
      SELECT agent_name,
        SUM(total_predictions) as total,
        SUM(wins) as wins,
        SUM(losses) as losses
      FROM hermes_specializations
      GROUP BY agent_name
    `).all();

    const changes = [];
    for (const a of agents) {
      const resolved = a.wins + a.losses;
      const winrate = resolved > 0 ? (a.wins / resolved) * 100 : 50;
      const roi = resolved > 0 ? ((a.wins - a.losses) / resolved) * 100 : 0;
      const newWeight = this._calculateSpecWeight(winrate, resolved, roi);

      const agent = this.getAgent(a.agent_name);
      if (agent && agent.status !== "disabled" && agent.status !== "trial") {
        const oldWeight = agent.weight;
        if (oldWeight !== newWeight) {
          this.setAgentWeight(a.agent_name, newWeight, `auto-recalc: winrate=${winrate.toFixed(1)}%, roi=${roi.toFixed(1)}%`);
          changes.push({ agent: a.agent_name, oldWeight, newWeight, winrate: Math.round(winrate * 10) / 10 });
        }
      }
    }
    return changes;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  _autoManage() {
    const actions = [];

    const agents = this.db.prepare(`
      SELECT a.agent_name, a.status, a.weight,
        COALESCE(SUM(s.total_predictions), 0) as total,
        CASE WHEN COALESCE(SUM(s.wins) + SUM(s.losses), 0) > 0
          THEN ROUND(CAST(COALESCE(SUM(s.wins), 0) AS REAL) / (SUM(s.wins) + SUM(s.losses)) * 100, 2)
          ELSE 0 END as winrate
      FROM hermes_agents a
      LEFT JOIN hermes_specializations s ON a.agent_name = s.agent_name
      WHERE a.status = 'active'
      GROUP BY a.agent_name
    `).all();

    for (const a of agents) {
      if (a.total >= this.config.autoDisable.minPredictions && a.winrate < this.config.autoDisable.winrateThreshold) {
        this.disableAgent(a.agent_name, `auto-disable: winrate ${a.winrate}% < ${this.config.autoDisable.winrateThreshold}% over ${a.total} predictions`);
        actions.push({ type: "disable", agent: a.agent_name, action: "disable", reason: `winrate ${a.winrate}%`, winrate: a.winrate });
      }
    }

    const inactive = this.db.prepare(`
      SELECT a.agent_name FROM hermes_agents a
      WHERE a.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM hermes_predictions p
        WHERE p.agent_name = a.agent_name
        AND p.created_at > datetime('now', '-7 days')
      )
      AND a.created_at < datetime('now', '-7 days')
    `).all();

    for (const a of inactive) {
      actions.push({ type: "alert_inactive", agent: a.agent_name, action: "alert_inactive", reason: "Aucune prédiction depuis 7 jours" });
    }

    const highPerf = this.db.prepare(`
      SELECT a.agent_name, a.weight,
        ROUND(CAST(SUM(s.wins) AS REAL) / NULLIF(SUM(s.wins) + SUM(s.losses), 0) * 100, 2) as winrate,
        SUM(s.total_predictions) as total
      FROM hermes_agents a
      JOIN hermes_specializations s ON a.agent_name = s.agent_name
      WHERE a.status = 'active' AND a.weight < 2.5
      GROUP BY a.agent_name
      HAVING (SUM(s.wins) + SUM(s.losses)) >= 10 AND winrate >= 65
    `).all();

    for (const a of highPerf) {
      actions.push({ type: "alert_high_performer", agent: a.agent_name, action: "promote", winrate: a.winrate, currentWeight: a.weight });
    }

    return actions;
  }

  getRecommendations() {
    return this._autoManage();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIALIZATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  getSpecializations(agentName, filters = {}) {
    let sql = "SELECT * FROM hermes_specializations WHERE agent_name = ?";
    const params = [agentName];
    if (filters.sport) { sql += " AND sport = ?"; params.push(filters.sport.toLowerCase()); }
    if (filters.competition) { sql += " AND competition = ?"; params.push(filters.competition); }
    if (filters.marketType) { sql += " AND market_type = ?"; params.push(filters.marketType); }
    sql += " ORDER BY total_predictions DESC";
    return this.db.prepare(sql).all(...params);
  }

  getTopAgentForContext(sport, competition, market) {
    const row = this.db.prepare(`
      SELECT s.agent_name, s.winrate, s.weight, s.total_predictions, s.roi, s.yield, s.rank
      FROM hermes_specializations s
      JOIN hermes_agents a ON s.agent_name = a.agent_name
      WHERE s.sport = ? AND s.market_type = ?
        AND (s.competition = ? OR s.competition = '')
        AND a.status != 'disabled'
        AND s.total_predictions >= 5
      ORDER BY s.weight DESC, s.winrate DESC
      LIMIT 1
    `).get(sport.toLowerCase(), market || "", competition || "");
    return row || null;
  }

  getAgentFullStats(agentName) {
    const agent = this.getAgent(agentName);
    if (!agent) return null;

    const specs = this.getSpecializations(agentName);
    const totalPreds = specs.reduce((s, sp) => s + (sp.wins + sp.losses), 0);
    const totalWins = specs.reduce((s, sp) => s + sp.wins, 0);
    const totalLosses = specs.reduce((s, sp) => s + sp.losses, 0);

    const rankings = this.db.prepare(
      "SELECT * FROM hermes_rankings WHERE agent_name = ? ORDER BY rank ASC"
    ).all(agentName);

    const recentPreds = this.db.prepare(`
      SELECT * FROM hermes_predictions WHERE agent_name = ?
      ORDER BY created_at DESC LIMIT 20
    `).all(agentName);

    const weightHistory = this.db.prepare(
      "SELECT * FROM hermes_weight_history WHERE agent_name = ? ORDER BY id DESC LIMIT 20"
    ).all(agentName);

    return {
      ...agent,
      globalStats: {
        total: totalPreds,
        wins: totalWins,
        losses: totalLosses,
        winrate: totalPreds > 0 ? Math.round((totalWins / totalPreds) * 1000) / 10 : 0,
        roi: totalPreds > 0 ? Math.round(((totalWins - totalLosses) / totalPreds) * 1000) / 10 : 0,
        yield: specs.length > 0 ? Math.round(specs.reduce((s, sp) => s + sp.yield, 0) / specs.length * 10) / 10 : 0,
      },
      specializations: specs,
      rankings,
      recentPredictions: recentPreds,
      weightHistory,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNAL
  // ═══════════════════════════════════════════════════════════════════════════

  getJournal(filters = {}) {
    let sql = "SELECT * FROM hermes_journal WHERE 1=1";
    const params = [];
    if (filters.matchKey) { sql += " AND match_key = ?"; params.push(filters.matchKey); }
    if (filters.decision) { sql += " AND decision = ?"; params.push(filters.decision); }
    if (filters.published !== undefined) { sql += " AND published = ?"; params.push(filters.published ? 1 : 0); }
    if (filters.since) { sql += " AND date >= ?"; params.push(filters.since); }
    sql += " ORDER BY id DESC";
    if (filters.limit) { sql += " LIMIT ?"; params.push(filters.limit); }
    return this.db.prepare(sql).all(...params);
  }

  getJournalEntry(id) {
    const entry = this.db.prepare("SELECT * FROM hermes_journal WHERE id = ?").get(id);
    if (entry) {
      try { entry.indice_breakdown = JSON.parse(entry.indice_breakdown); } catch {}
      try { entry.votes_json = JSON.parse(entry.votes_json); } catch {}
      try { entry.weight_changes = JSON.parse(entry.weight_changes); } catch {}
    }
    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  getDashboard() {
    const agents = this.listAgents();
    const specs = this.db.prepare("SELECT * FROM hermes_specializations ORDER BY agent_name, sport, market_type").all();

    const globalStats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses
      FROM hermes_predictions WHERE outcome != 'pending'
    `).get() || { total: 0, wins: 0, losses: 0 };

    const journalStats = this.db.prepare(`
      SELECT
        COUNT(*) as total_evaluations,
        SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END) as refused,
        AVG(indice_hermes) as avg_indice
      FROM hermes_journal
    `).get() || { total_evaluations: 0, published: 0, refused: 0, avg_indice: 0 };

    const recentWeightChanges = this.db.prepare(
      "SELECT * FROM hermes_weight_history ORDER BY id DESC LIMIT 20"
    ).all();

    const recentJournal = this.db.prepare(
      "SELECT id, date, home, away, competition, indice_hermes, consensus_level, decision, published, result FROM hermes_journal ORDER BY id DESC LIMIT 20"
    ).all();

    const allRankings = this.getAllRankings();
    const recommendations = this.getRecommendations();

    return {
      generatedAt: new Date().toISOString(),
      config: {
        publicationThreshold: this.config.publicationThreshold,
        trialPredictions: this.config.trialPredictions,
      },
      agents: agents.map(a => {
        const agentSpecs = specs.filter(s => s.agent_name === a.agent_name);
        const resolved = agentSpecs.reduce((s, sp) => s + sp.wins + sp.losses, 0);
        const totalWins = agentSpecs.reduce((s, sp) => s + sp.wins, 0);
        const totalLosses = agentSpecs.reduce((s, sp) => s + sp.losses, 0);
        return {
          name: a.agent_name,
          status: a.status,
          weight: a.weight,
          trialRemaining: a.trial_remaining,
          totalAnalyses: a.total_analyses,
          totalPredictions: resolved,
          wins: totalWins,
          losses: totalLosses,
          winrate: resolved > 0 ? Math.round((totalWins / resolved) * 100 * 10) / 10 : 0,
          roi: resolved > 0 ? Math.round(((totalWins - totalLosses) / resolved) * 100 * 10) / 10 : 0,
          yield: agentSpecs.length > 0 ? Math.round(agentSpecs.reduce((s, sp) => s + sp.yield, 0) / agentSpecs.length * 10) / 10 : 0,
          specializations: agentSpecs,
        };
      }),
      globalStats: {
        total: globalStats.total,
        wins: globalStats.wins,
        losses: globalStats.losses,
        winrate: globalStats.total > 0 ? Math.round((globalStats.wins / globalStats.total) * 100 * 10) / 10 : 0,
        roi: globalStats.total > 0 ? Math.round(((globalStats.wins - globalStats.losses) / globalStats.total) * 100 * 10) / 10 : 0,
      },
      journal: journalStats,
      rankings: allRankings,
      recentDecisions: recentJournal,
      recentWeightChanges,
      recommendations,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════════════

  getThreshold() {
    return this.config.publicationThreshold;
  }

  setThreshold(value) {
    this.config.publicationThreshold = Math.max(0, Math.min(100, value));
    return this.config.publicationThreshold;
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(partial) {
    if (partial.publicationThreshold != null) this.config.publicationThreshold = partial.publicationThreshold;
    if (partial.trialPredictions != null) this.config.trialPredictions = partial.trialPredictions;
    if (partial.indiceWeights) this.config.indiceWeights = { ...this.config.indiceWeights, ...partial.indiceWeights };
    if (partial.consensusLevels) this.config.consensusLevels = { ...this.config.consensusLevels, ...partial.consensusLevels };
    return this.config;
  }
}

module.exports = { HermesBrain, DEFAULT_CONFIG };
