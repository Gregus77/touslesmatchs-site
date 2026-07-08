/**
 * hermes_brain.js — Hermès V3: Cerveau du Concile
 *
 * Hermès is the SOLE decision-maker. AI agents provide analysis, votes,
 * and confidence — Hermès alone decides whether to publish a signal.
 *
 * Core concepts:
 * - Quality Score (0–100): weighted composite of 12+ criteria
 * - Publication threshold: no signal below configurable score (default 90)
 * - Consensus levels: FAIBLE / MOYEN / FORT / EXCEPTIONNEL
 * - AI specialization: per sport × league × market performance tracking
 * - Dynamic weights: [0, 0.25, 0.50, 1, 1.50, 2, 2.50]
 * - Trial phase: new AIs start in TEST mode
 * - Complete journal: every decision logged permanently
 * - Self-improving: auto-promote / demote / disable after results
 *
 * CommonJS module — no circular dependencies.
 */

const Database = require("better-sqlite3");

// ─── Default Configuration ─────────────────────────────────────────────────

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
  qualityWeights: {
    consensus:          20,
    agentHistoryMarket: 12,
    roiHistorique:      10,
    winrateHistorique:  10,
    qualiteDonnees:     8,
    fiabiliteChampionnat: 8,
    minuteDeJeu:        7,
    disponibiliteStats: 5,
    validiteMarche:     8,
    coherenceVotes:     7,
    confianceMoyenne:   5,
  },
  marketValidityRules: {
    "Over 2.5":      { maxMinute: 75 },
    "Under 2.5":     { maxMinute: 75 },
    "BTTS":          { maxMinute: 90, scoreCheck: true, scoreMaxMinute: 80 },
    "Score exact":   { maxMinute: 60 },
    "Corners":       { maxMinute: 85 },
    "Cards":         { maxMinute: 85 },
    "Double chance": { maxMinute: 85 },
    "Winner":        { maxMinute: 90 },
    "1X2":           { maxMinute: 90 },
    "Handicap":      { maxMinute: 70 },
  },
  championshipReliability: {
    "Ligue 1": 95, "Premier League": 98, "La Liga": 95, "Serie A": 95,
    "Bundesliga": 95, "Champions League": 98, "Europa League": 90,
    "Liga Profesional": 70, "MLS": 75, "Eredivisie": 80,
    "Primeira Liga": 80, "Super Lig": 70, "Pro League": 75,
    "NBA": 95, "NFL": 95, "NHL": 90, "MLB": 85,
    "ATP": 85, "WTA": 80,
  },
  autoDisable: {
    minPredictions: 20,
    winrateThreshold: 35,
  },
  autoPromote: {
    minPredictions: 10,
    winrateThreshold: 55,
  },
};

// ─── Schema ────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS hermes_agents (
    agent_name TEXT PRIMARY KEY,
    display_order INTEGER DEFAULT 99,
    status TEXT DEFAULT 'active',
    weight REAL DEFAULT 1.0,
    trial_remaining INTEGER DEFAULT 0,
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
    winrate REAL DEFAULT 0,
    roi REAL DEFAULT 0,
    weight REAL DEFAULT 1.0,
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
    quality_score REAL DEFAULT 0,
    quality_breakdown TEXT,
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

  CREATE TABLE IF NOT EXISTS hermes_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`;

// ─── HermesBrain Class ────────────────────────────────────────────────────

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

    this.config = { ...DEFAULT_CONFIG, ...(options.config || {}) };
    if (options.config?.qualityWeights) {
      this.config.qualityWeights = { ...DEFAULT_CONFIG.qualityWeights, ...options.config.qualityWeights };
    }
    if (options.config?.consensusLevels) {
      this.config.consensusLevels = { ...DEFAULT_CONFIG.consensusLevels, ...options.config.consensusLevels };
    }

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
  // MARKET VALIDITY (Obj 12)
  // ═══════════════════════════════════════════════════════════════════════════

  isMarketValid(marketType, minute, score) {
    const rule = this.config.marketValidityRules[marketType];
    if (!rule) return { valid: true, reason: "Marché non configuré" };

    if (marketType === "BTTS" && rule.scoreCheck && score) {
      const limit = rule.scoreMaxMinute || 80;
      if (minute > limit && (score.home === 0 || score.away === 0)) {
        return { valid: false, reason: `BTTS invalide après ${limit}' si une équipe n'a pas marqué` };
      }
    }

    if (minute > rule.maxMinute) {
      return { valid: false, reason: `${marketType} invalide après ${rule.maxMinute}'` };
    }

    // Late-game blowout check (Obj 12)
    if (score) {
      const totalGoals = score.home + score.away;
      const diff = Math.abs(score.home - score.away);
      if (minute >= 80 && totalGoals >= 4 && ["Under 2.5", "Score exact", "Handicap"].includes(marketType)) {
        return { valid: false, reason: `${marketType} sans valeur à ${minute}' avec score ${score.home}-${score.away}` };
      }
      if (minute >= 85 && diff >= 3 && ["1X2", "Winner", "Double chance"].includes(marketType)) {
        return { valid: false, reason: `Résultat acquis à ${minute}' (${score.home}-${score.away})` };
      }
    }

    return { valid: true, reason: "Marché valide" };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUALITY SCORE (Obj 2)
  // ═══════════════════════════════════════════════════════════════════════════

  calculateQualityScore(context) {
    const {
      votes = [],
      market = "",
      sport = "football",
      competition = "",
      minute = 0,
      score = null,
      dataQuality = 1.0,
      statsAvailable = true,
    } = context;

    const w = this.config.qualityWeights;
    const totalWeight = Object.values(w).reduce((s, v) => s + v, 0);
    const breakdown = {};

    // 1. Consensus (% agreement among voting agents)
    const consensusPct = this._calculateConsensusPct(votes);
    breakdown.consensus = Math.round(consensusPct);

    // 2. Agent history on this market
    const marketHistory = this._getMarketHistoryScore(votes, sport, competition, market);
    breakdown.agentHistoryMarket = Math.round(marketHistory);

    // 3. Historical ROI
    const roiScore = this._getROIScore(votes, sport);
    breakdown.roiHistorique = Math.round(roiScore);

    // 4. Historical winrate
    const winrateScore = this._getWinrateScore(votes, sport);
    breakdown.winrateHistorique = Math.round(winrateScore);

    // 5. Data quality
    const dataScore = Math.min(100, Math.round(dataQuality * 100));
    breakdown.qualiteDonnees = dataScore;

    // 6. Championship reliability
    const champScore = this._getChampionshipReliability(competition);
    breakdown.fiabiliteChampionnat = champScore;

    // 7. Match minute
    const minuteScore = this._getMinuteScore(minute);
    breakdown.minuteDeJeu = minuteScore;

    // 8. Stats availability
    breakdown.disponibiliteStats = statsAvailable ? 100 : 30;

    // 9. Market validity
    const validity = this.isMarketValid(market, minute, score);
    breakdown.validiteMarche = validity.valid ? 100 : 0;

    // 10. Vote coherence
    const coherence = this._getVoteCoherence(votes);
    breakdown.coherenceVotes = Math.round(coherence);

    // 11. Average confidence
    const avgConf = votes.length > 0
      ? votes.reduce((s, v) => s + (v.confidence || 0), 0) / votes.length
      : 0;
    breakdown.confianceMoyenne = Math.round(avgConf);

    // Weighted total
    let score_total = 0;
    for (const [key, maxPts] of Object.entries(w)) {
      const raw = breakdown[key] || 0;
      score_total += (raw / 100) * maxPts;
    }
    const finalScore = Math.round((score_total / totalWeight) * 100);

    return {
      score: Math.min(100, Math.max(0, finalScore)),
      breakdown,
      totalWeight,
    };
  }

  _calculateConsensusPct(votes) {
    if (votes.length === 0) return 0;
    const activeVotes = votes.filter(v => v.vote && v.weight > 0);
    if (activeVotes.length === 0) return 0;

    const totalWeight = activeVotes.reduce((s, v) => s + (v.weight || 1), 0);
    const betCounts = {};
    for (const v of activeVotes) {
      const bet = v.vote;
      betCounts[bet] = (betCounts[bet] || 0) + (v.weight || 1);
    }
    const maxWeight = Math.max(...Object.values(betCounts));
    return totalWeight > 0 ? (maxWeight / totalWeight) * 100 : 0;
  }

  _getMarketHistoryScore(votes, sport, competition, market) {
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

  _getMinuteScore(minute) {
    if (minute === 0) return 100;
    if (minute <= 15) return 95;
    if (minute <= 30) return 90;
    if (minute <= 45) return 85;
    if (minute <= 60) return 70;
    if (minute <= 75) return 50;
    if (minute <= 85) return 30;
    return 10;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSENSUS LEVEL (Obj 4)
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
  // HERMÈS DECISION (Obj 1 + 3)
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

    // Enrich votes with current agent weights
    const enrichedVotes = this._enrichVotes(votes, sport, competition, market);

    // Calculate Quality Score
    const quality = this.calculateQualityScore({
      votes: enrichedVotes,
      market,
      sport,
      competition,
      minute,
      score,
      dataQuality,
      statsAvailable,
    });

    // Calculate consensus
    const consensusPct = this._calculateConsensusPct(enrichedVotes);
    const consensus = this.getConsensusLevel(consensusPct);

    // Find dominant bet (weighted)
    const dominantBet = this._getDominantBet(enrichedVotes);

    // Market validity
    const marketValidity = this.isMarketValid(market, minute, score);

    // HERMÈS DECISION
    const threshold = this.config.publicationThreshold;
    const shouldPublish = quality.score >= threshold && marketValidity.valid;

    let decision, decisionReason;
    if (!marketValidity.valid) {
      decision = "REFUS";
      decisionReason = `Marché invalide: ${marketValidity.reason}`;
    } else if (quality.score < threshold) {
      decision = "REFUS";
      decisionReason = `Score qualité ${quality.score}/100 < seuil ${threshold}. Aujourd'hui aucun signal suffisamment fiable.`;
    } else {
      decision = "PUBLICATION";
      decisionReason = `Score qualité ${quality.score}/100 ≥ seuil ${threshold}. Consensus ${consensus.label}. Marché valide.`;
    }

    // Record predictions
    this._recordPredictions(matchKey, enrichedVotes, sport, competition, market);

    // Decrement trial counters
    this._decrementTrials(enrichedVotes);

    // Log to journal
    const journalEntry = {
      date: new Date().toISOString(),
      matchKey,
      home,
      away,
      competition,
      sport,
      market,
      minute,
      qualityScore: quality.score,
      qualityBreakdown: quality.breakdown,
      consensusLevel: consensus.level,
      consensusPct: consensus.pct,
      votes: enrichedVotes.map(v => ({
        agent: v.agentName,
        vote: v.vote,
        confidence: v.confidence,
        weight: v.weight,
        arguments: v.arguments,
      })),
      decision,
      decisionReason,
      published: shouldPublish,
    };
    this._writeJournal(journalEntry);

    return {
      decision,
      reason: decisionReason,
      published: shouldPublish,
      qualityScore: quality.score,
      qualityBreakdown: quality.breakdown,
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

      // Get specialization weight for this context
      const spec = this.db.prepare(`
        SELECT weight, winrate, total_predictions FROM hermes_specializations
        WHERE agent_name = ? AND sport = ? AND market_type = ?
        AND (competition = ? OR competition = '')
        ORDER BY total_predictions DESC LIMIT 1
      `).get(v.agentName, sport.toLowerCase(), market || "", competition || "");

      let contextWeight = spec ? spec.weight : baseWeight;

      // Trial agents have reduced weight
      if (status === "trial") contextWeight = Math.min(contextWeight, 0.25);
      // Disabled agents have zero weight
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
        (match_key, agent_name, sport, competition, market_type, prediction, confidence, vote, arguments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((vs) => {
      for (const v of vs) {
        stmt.run(matchKey, v.agentName, sport.toLowerCase(), competition, market,
          v.prediction || v.vote, v.confidence || 0, v.vote || "", v.arguments || "");
      }
    });
    tx(votes);
  }

  _decrementTrials(votes) {
    const stmt = this.db.prepare(`
      UPDATE hermes_agents SET trial_remaining = MAX(0, trial_remaining - 1),
      updated_at = datetime('now') WHERE agent_name = ? AND status = 'trial'
    `);
    for (const v of votes) {
      stmt.run(v.agentName);
    }
    // Check if any trial agent has completed their trial
    const completed = this.db.prepare(
      "SELECT * FROM hermes_agents WHERE status = 'trial' AND trial_remaining <= 0"
    ).all();
    for (const agent of completed) {
      this._evaluateTrialAgent(agent.agent_name);
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
         quality_score, quality_breakdown, consensus_level, consensus_pct,
         votes_json, decision, decision_reason, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.date, entry.matchKey, entry.home, entry.away,
      entry.competition, entry.sport, entry.market, entry.minute,
      entry.qualityScore, JSON.stringify(entry.qualityBreakdown),
      entry.consensusLevel, entry.consensusPct,
      JSON.stringify(entry.votes), entry.decision, entry.decisionReason,
      entry.published ? 1 : 0
    );
    entry.id = result.lastInsertRowid;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEARNING LOOP (Obj 9)
  // ═══════════════════════════════════════════════════════════════════════════

  processResult(matchKey, outcome) {
    // 1. Resolve all pending predictions for this match
    const updated = this.db.prepare(`
      UPDATE hermes_predictions SET outcome = ?, resolved_at = datetime('now')
      WHERE match_key = ? AND outcome = 'pending'
    `).run(outcome, matchKey);

    // 2. Recalculate specializations for affected agents
    const affected = this.db.prepare(`
      SELECT DISTINCT agent_name, sport, competition, market_type
      FROM hermes_predictions WHERE match_key = ?
    `).all(matchKey);

    for (const row of affected) {
      this._recalculateSpecialization(row.agent_name, row.sport, row.competition, row.market_type);
    }

    // 3. Recalculate weights
    const weightChanges = this._recalculateAllWeights();

    // 4. Auto-management
    const actions = this._autoManage();

    // 5. Update journal
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
        SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses
      FROM hermes_predictions
      WHERE agent_name = ? AND sport = ? AND competition = ? AND market_type = ?
        AND outcome != 'pending'
    `).get(agentName, sport, competition, marketType);

    if (!stats || stats.total === 0) return;

    const winrate = Math.round((stats.wins / stats.total) * 10000) / 100;
    const roi = Math.round(((stats.wins - stats.losses) / stats.total) * 10000) / 100;
    const weight = this._calculateSpecWeight(winrate, stats.total, roi);

    this.db.prepare(`
      INSERT INTO hermes_specializations
        (agent_name, sport, competition, market_type, total_predictions, wins, losses, winrate, roi, weight, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(agent_name, sport, competition, market_type) DO UPDATE SET
        total_predictions = excluded.total_predictions,
        wins = excluded.wins,
        losses = excluded.losses,
        winrate = excluded.winrate,
        roi = excluded.roi,
        weight = excluded.weight,
        last_updated = excluded.last_updated
    `).run(agentName, sport, competition, marketType, stats.total, stats.wins, stats.losses, winrate, roi, weight);
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
      const winrate = a.total > 0 ? (a.wins / a.total) * 100 : 50;
      const roi = a.total > 0 ? ((a.wins - a.losses) / a.total) * 100 : 0;
      const newWeight = this._calculateSpecWeight(winrate, a.total, roi);

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
  // AUTO-MANAGEMENT (Obj 10)
  // ═══════════════════════════════════════════════════════════════════════════

  _autoManage() {
    const actions = [];

    // Check for agents to disable
    const agents = this.db.prepare(`
      SELECT a.agent_name, a.status, a.weight,
        COALESCE(SUM(s.total_predictions), 0) as total,
        CASE WHEN COALESCE(SUM(s.total_predictions), 0) > 0
          THEN ROUND(CAST(COALESCE(SUM(s.wins), 0) AS REAL) / SUM(s.total_predictions) * 100, 2)
          ELSE 0 END as winrate
      FROM hermes_agents a
      LEFT JOIN hermes_specializations s ON a.agent_name = s.agent_name
      WHERE a.status = 'active'
      GROUP BY a.agent_name
    `).all();

    for (const a of agents) {
      if (a.total >= this.config.autoDisable.minPredictions && a.winrate < this.config.autoDisable.winrateThreshold) {
        this.disableAgent(a.agent_name, `auto-disable: winrate ${a.winrate}% < ${this.config.autoDisable.winrateThreshold}% over ${a.total} predictions`);
        actions.push({ type: "disable", agent: a.agent_name, reason: `winrate ${a.winrate}%`, winrate: a.winrate });
      }
    }

    // Check for inactive agents (no predictions in 7 days)
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
      actions.push({ type: "alert_inactive", agent: a.agent_name, reason: "Aucune prédiction depuis 7 jours" });
    }

    // Check for high performers that could be promoted in weight
    const highPerf = this.db.prepare(`
      SELECT a.agent_name, a.weight,
        ROUND(CAST(SUM(s.wins) AS REAL) / NULLIF(SUM(s.total_predictions), 0) * 100, 2) as winrate,
        SUM(s.total_predictions) as total
      FROM hermes_agents a
      JOIN hermes_specializations s ON a.agent_name = s.agent_name
      WHERE a.status = 'active' AND a.weight < 2.5
      GROUP BY a.agent_name
      HAVING SUM(s.total_predictions) >= 10 AND winrate >= 65
    `).all();

    for (const a of highPerf) {
      actions.push({ type: "alert_high_performer", agent: a.agent_name, winrate: a.winrate, currentWeight: a.weight });
    }

    return actions;
  }

  getRecommendations() {
    return this._autoManage();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPECIALIZATIONS (Obj 5)
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
      SELECT s.agent_name, s.winrate, s.weight, s.total_predictions
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

  // ═══════════════════════════════════════════════════════════════════════════
  // JOURNAL (Obj 8)
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
      try { entry.quality_breakdown = JSON.parse(entry.quality_breakdown); } catch {}
      try { entry.votes_json = JSON.parse(entry.votes_json); } catch {}
      try { entry.weight_changes = JSON.parse(entry.weight_changes); } catch {}
    }
    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD (Obj 11)
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
        AVG(quality_score) as avg_quality
      FROM hermes_journal
    `).get() || { total_evaluations: 0, published: 0, refused: 0, avg_quality: 0 };

    const recentWeightChanges = this.db.prepare(
      "SELECT * FROM hermes_weight_history ORDER BY id DESC LIMIT 20"
    ).all();

    const recentJournal = this.db.prepare(
      "SELECT id, date, home, away, competition, quality_score, consensus_level, decision, published, result FROM hermes_journal ORDER BY id DESC LIMIT 20"
    ).all();

    const recommendations = this.getRecommendations();

    return {
      generatedAt: new Date().toISOString(),
      config: {
        publicationThreshold: this.config.publicationThreshold,
        trialPredictions: this.config.trialPredictions,
      },
      agents: agents.map(a => {
        const agentSpecs = specs.filter(s => s.agent_name === a.agent_name);
        const totalPreds = agentSpecs.reduce((s, sp) => s + sp.total_predictions, 0);
        const totalWins = agentSpecs.reduce((s, sp) => s + sp.wins, 0);
        return {
          name: a.agent_name,
          status: a.status,
          weight: a.weight,
          trialRemaining: a.trial_remaining,
          totalPredictions: totalPreds,
          winrate: totalPreds > 0 ? Math.round((totalWins / totalPreds) * 100 * 10) / 10 : 0,
          specializations: agentSpecs,
        };
      }),
      globalStats: {
        total: globalStats.total,
        wins: globalStats.wins,
        losses: globalStats.losses,
        winrate: globalStats.total > 0 ? Math.round((globalStats.wins / globalStats.total) * 100 * 10) / 10 : 0,
      },
      journal: journalStats,
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
    if (partial.qualityWeights) this.config.qualityWeights = { ...this.config.qualityWeights, ...partial.qualityWeights };
    if (partial.consensusLevels) this.config.consensusLevels = { ...this.config.consensusLevels, ...partial.consensusLevels };
    return this.config;
  }
}

module.exports = { HermesBrain, DEFAULT_CONFIG };
