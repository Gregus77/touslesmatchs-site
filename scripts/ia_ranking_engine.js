/**
 * ia_ranking_engine.js — Dynamic AI Ranking Engine
 *
 * Tracks and ranks each AI agent by sport, competition, market type.
 * Self-improving weights: after each match result, recalculates performance
 * metrics and adjusts voting weights automatically.
 *
 * CommonJS module — no circular dependencies.
 */

const Database = require("better-sqlite3");

// ─── Default configuration ──────────────────────────────────────────────────

const DEFAULT_DB_PATH = process.env.IA_RANKING_DB_PATH || "/app/data/ia_ranking.db";

const DEFAULT_AGENTS = [
  { name: "GROQ-Llama", displayOrder: 1 },
  { name: "GPT Analysis", displayOrder: 2 },
  { name: "GeminiFlash", displayOrder: 3 },
  { name: "Mistral-7B", displayOrder: 4 },
  { name: "Claude Chief", displayOrder: 5 },
  { name: "Groq-Llama70B", displayOrder: 6 },
  { name: "Groq-Llama8B", displayOrder: 7 },
  { name: "Mistral-Small", displayOrder: 8 },
  { name: "OR-Mistral7B", displayOrder: 9 },
];

const VALID_SPORTS = ["football", "basketball", "hockey", "baseball", "tennis"];

const VALID_MARKETS = [
  "Under 2.5", "Over 2.5", "BTTS", "1X2", "Score exact",
  "Corners", "Cards", "Double chance", "Handicap", "Winner",
];

/**
 * Temporal market validity rules.
 * Each rule defines when a market becomes invalid based on match minute and score.
 * All thresholds are configurable by replacing this object.
 */
const MARKET_VALIDITY_RULES = {
  "Over 2.5":     { maxMinute: 75, label: "Over/Under" },
  "Under 2.5":    { maxMinute: 75, label: "Over/Under" },
  "BTTS":         { maxMinute: 90, label: "BTTS", scoreCheck: true, scoreMaxMinute: 80 },
  "Score exact":  { maxMinute: 60, label: "Score exact" },
  "Corners":      { maxMinute: 85, label: "Corners/Cards" },
  "Cards":        { maxMinute: 85, label: "Corners/Cards" },
  "Double chance": { maxMinute: 85, label: "Double chance" },
  "Winner":       { maxMinute: 90, label: "Winner (1X2)" },
  "1X2":          { maxMinute: 90, label: "Winner (1X2)" },
  "Handicap":     { maxMinute: 70, label: "Handicap" },
};

// Minimum predictions before auto-disable kicks in
const MIN_PREDICTIONS_FOR_DISABLE = 20;
// Winrate threshold (%) below which an AI gets disabled
const DISABLE_WINRATE_THRESHOLD = 35;

// ─── Schema ─────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS ia_rankings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    sport TEXT NOT NULL DEFAULT 'football',
    competition TEXT NOT NULL DEFAULT '',
    market_type TEXT NOT NULL DEFAULT 'Under 2.5',
    total_predictions INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    pushes INTEGER DEFAULT 0,
    winrate REAL DEFAULT 0,
    roi REAL DEFAULT 0,
    accuracy REAL DEFAULT 0,
    weight REAL DEFAULT 1.0,
    enabled INTEGER DEFAULT 1,
    last_updated TEXT DEFAULT (datetime('now')),
    UNIQUE(agent_name, sport, competition, market_type)
  );

  CREATE TABLE IF NOT EXISTS ia_prediction_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_name TEXT NOT NULL,
    match_key TEXT NOT NULL,
    sport TEXT NOT NULL DEFAULT 'football',
    competition TEXT NOT NULL DEFAULT '',
    market_type TEXT NOT NULL DEFAULT 'Under 2.5',
    prediction TEXT,
    confidence REAL DEFAULT 0,
    outcome TEXT DEFAULT 'pending',
    odds REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS ia_agent_config (
    agent_name TEXT PRIMARY KEY,
    display_order INTEGER DEFAULT 99,
    enabled INTEGER DEFAULT 1,
    base_weight REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`;

// ─── Class ──────────────────────────────────────────────────────────────────

class IARankingEngine {
  /**
   * @param {object} [options]
   * @param {string} [options.dbPath] - Path to SQLite database file, or ":memory:"
   * @param {object} [options.db] - Existing better-sqlite3 instance (overrides dbPath)
   * @param {Array}  [options.agents] - Initial agent list [{name, displayOrder}]
   * @param {object} [options.marketRules] - Override MARKET_VALIDITY_RULES
   */
  constructor(options = {}) {
    if (options.db) {
      this.db = options.db;
    } else {
      const dbPath = options.dbPath || DEFAULT_DB_PATH;
      this.db = new Database(dbPath);
    }
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.marketRules = options.marketRules || { ...MARKET_VALIDITY_RULES };
    this._initSchema();
    this._seedAgents(options.agents || DEFAULT_AGENTS);

    // Stable anonymization map: built from agent config order
    this._anonMap = null;
  }

  /** Initialize database tables. */
  _initSchema() {
    this.db.exec(SCHEMA_SQL);
  }

  /** Seed default agents if not already present. */
  _seedAgents(agents) {
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO ia_agent_config (agent_name, display_order, enabled, base_weight) VALUES (?, ?, 1, 1.0)"
    );
    const tx = this.db.transaction((list) => {
      for (const a of list) {
        insert.run(a.name, a.displayOrder || 99);
      }
    });
    tx(agents);
  }

  // ─── Market validity ────────────────────────────────────────────────────

  /**
   * Check if a market type is still valid given the current match state.
   *
   * @param {string} marketType - e.g. "Under 2.5", "BTTS", "1X2"
   * @param {number} minute - Current match minute (0-90+)
   * @param {{ home: number, away: number }} [score] - Current score
   * @returns {{ valid: boolean, reason: string }}
   */
  isMarketStillValid(marketType, minute, score) {
    const rule = this.marketRules[marketType];
    if (!rule) {
      return { valid: true, reason: "Marche non configure, considere valide par defaut" };
    }

    // BTTS special rule: check score condition before generic maxMinute
    if (marketType === "BTTS" && rule.scoreCheck && score) {
      const scoreMinute = rule.scoreMaxMinute || 80;
      if (minute > scoreMinute && (score.home === 0 || score.away === 0)) {
        return {
          valid: false,
          reason: `BTTS invalide apres la ${scoreMinute}e minute si une equipe n'a pas marque (score: ${score.home}-${score.away})`,
        };
      }
    }

    if (minute > rule.maxMinute) {
      return {
        valid: false,
        reason: `${rule.label} invalide apres la ${rule.maxMinute}e minute (minute actuelle: ${minute})`,
      };
    }

    return { valid: true, reason: "Marche valide" };
  }

  // ─── Record predictions ────────────────────────────────────────────────

  /**
   * Record a prediction from an AI agent.
   *
   * @param {object} prediction
   * @param {string} prediction.agentName
   * @param {string} prediction.matchKey
   * @param {string} [prediction.sport='football']
   * @param {string} [prediction.competition='']
   * @param {string} [prediction.marketType='Under 2.5']
   * @param {string} [prediction.prediction]
   * @param {number} [prediction.confidence=0]
   * @param {number} [prediction.odds=0]
   */
  recordPrediction(prediction) {
    const {
      agentName,
      matchKey,
      sport = "football",
      competition = "",
      marketType = "Under 2.5",
      prediction: pred = "",
      confidence = 0,
      odds = 0,
    } = prediction;

    this.db.prepare(`
      INSERT INTO ia_prediction_log
        (agent_name, match_key, sport, competition, market_type, prediction, confidence, odds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agentName, matchKey, sport.toLowerCase(), competition, marketType, pred, confidence, odds);
  }

  // ─── Learning loop ────────────────────────────────────────────────────

  /**
   * Process a match result: update outcomes, recalculate rankings, adjust weights.
   *
   * @param {object} result
   * @param {string} result.matchKey - Unique match identifier
   * @param {string} result.outcome - "win", "loss", or "push"
   * @param {string} [result.marketType] - If set, only resolve predictions for this market
   * @returns {{ updated: number, rankings: Array, disabled: Array }}
   */
  processMatchResult(result) {
    const { matchKey, outcome, marketType } = result;

    // 1. Update prediction outcomes
    let updateSql = `
      UPDATE ia_prediction_log
      SET outcome = ?, resolved_at = datetime('now')
      WHERE match_key = ? AND outcome = 'pending'
    `;
    const params = [outcome, matchKey];

    if (marketType) {
      updateSql += " AND market_type = ?";
      params.push(marketType);
    }

    const updateResult = this.db.prepare(updateSql).run(...params);

    // 2. Recalculate rankings for all affected agents
    const affectedAgents = this.db.prepare(`
      SELECT DISTINCT agent_name, sport, competition, market_type
      FROM ia_prediction_log
      WHERE match_key = ?
    `).all(matchKey);

    const recalculated = [];
    for (const row of affectedAgents) {
      this._recalculateRanking(row.agent_name, row.sport, row.competition, row.market_type);
      recalculated.push(row.agent_name);
    }

    // 3. Recalculate global weights for all agents
    this._recalculateAllWeights();

    // 4. Auto-disable poorly performing agents
    const disabled = this._autoDisableCheck();

    // 5. Return updated stats
    const rankings = this.getRankings();

    return {
      updated: updateResult.changes,
      rankings,
      disabled,
    };
  }

  /**
   * Recalculate ranking stats for a specific agent/sport/competition/market combo.
   * @private
   */
  _recalculateRanking(agentName, sport, competition, marketType) {
    const stats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN outcome = 'push' THEN 1 ELSE 0 END) as pushes,
        AVG(confidence) as avg_confidence,
        AVG(CASE WHEN outcome = 'win' THEN odds ELSE 0 END) as avg_winning_odds
      FROM ia_prediction_log
      WHERE agent_name = ? AND sport = ? AND competition = ? AND market_type = ?
        AND outcome IS NOT NULL AND outcome != 'pending'
    `).get(agentName, sport, competition, marketType);

    if (!stats || stats.total === 0) return;

    const total = stats.total;
    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const pushes = stats.pushes || 0;
    const winrate = total > 0 ? Math.round((wins / total) * 10000) / 100 : 0;
    // ROI = (profit / total_staked) * 100
    // Simplified: each bet is 1 unit, win pays (odds - 1), loss costs 1
    const profit = (wins * ((stats.avg_winning_odds || 1.5) - 1)) - losses;
    const roi = total > 0 ? Math.round((profit / total) * 10000) / 100 : 0;
    const accuracy = winrate;

    // Weight formula: base weight adjusted by performance
    const weight = this._calculateWeight(winrate, total, roi);

    this.db.prepare(`
      INSERT INTO ia_rankings (agent_name, sport, competition, market_type, total_predictions, wins, losses, pushes, winrate, roi, accuracy, weight, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(agent_name, sport, competition, market_type) DO UPDATE SET
        total_predictions = excluded.total_predictions,
        wins = excluded.wins,
        losses = excluded.losses,
        pushes = excluded.pushes,
        winrate = excluded.winrate,
        roi = excluded.roi,
        accuracy = excluded.accuracy,
        weight = excluded.weight,
        last_updated = excluded.last_updated
    `).run(agentName, sport, competition, marketType, total, wins, losses, pushes, winrate, roi, accuracy, weight);
  }

  /**
   * Calculate voting weight based on performance.
   * Better AI = higher weight. Range: 0.3 to 2.5
   * @private
   */
  _calculateWeight(winrate, totalPredictions, roi) {
    // Base weight starts at 1.0
    let weight = 1.0;

    // Winrate bonus/penalty (centered around 50%)
    if (winrate >= 60) weight += 0.5;
    else if (winrate >= 55) weight += 0.3;
    else if (winrate >= 50) weight += 0.1;
    else if (winrate >= 40) weight -= 0.2;
    else weight -= 0.4;

    // ROI bonus
    if (roi > 10) weight += 0.4;
    else if (roi > 5) weight += 0.2;
    else if (roi > 0) weight += 0.1;
    else if (roi < -10) weight -= 0.3;

    // Volume confidence: more predictions = more reliable weight
    if (totalPredictions < 5) weight *= 0.7;
    else if (totalPredictions < 10) weight *= 0.85;
    else if (totalPredictions >= 30) weight *= 1.1;

    // Clamp to valid range
    return Math.round(Math.max(0.3, Math.min(2.5, weight)) * 100) / 100;
  }

  /**
   * Recalculate global weights across all agents (aggregate across sports/markets).
   * @private
   */
  _recalculateAllWeights() {
    const agents = this.db.prepare(`
      SELECT agent_name,
        SUM(total_predictions) as total,
        SUM(wins) as wins,
        SUM(losses) as losses,
        CASE WHEN SUM(total_predictions) > 0
          THEN ROUND(CAST(SUM(wins) AS REAL) / SUM(total_predictions) * 100, 2)
          ELSE 0 END as winrate,
        CASE WHEN SUM(total_predictions) > 0
          THEN ROUND(CAST(SUM(wins) - SUM(losses) AS REAL) / SUM(total_predictions) * 100, 2)
          ELSE 0 END as roi
      FROM ia_rankings
      GROUP BY agent_name
    `).all();

    const updateConfig = this.db.prepare(`
      UPDATE ia_agent_config SET base_weight = ? WHERE agent_name = ?
    `);

    for (const a of agents) {
      const w = this._calculateWeight(a.winrate, a.total, a.roi);
      updateConfig.run(w, a.agent_name);
    }
  }

  /**
   * Check all agents and disable those with winrate below threshold
   * over a minimum number of predictions.
   * @private
   * @returns {Array<{agent: string, winrate: number}>} List of newly disabled agents
   */
  _autoDisableCheck() {
    const candidates = this.db.prepare(`
      SELECT agent_name,
        SUM(total_predictions) as total,
        CASE WHEN SUM(total_predictions) > 0
          THEN ROUND(CAST(SUM(wins) AS REAL) / SUM(total_predictions) * 100, 2)
          ELSE 0 END as winrate
      FROM ia_rankings
      GROUP BY agent_name
      HAVING SUM(total_predictions) >= ?
    `).all(MIN_PREDICTIONS_FOR_DISABLE);

    const disabled = [];
    const disableStmt = this.db.prepare("UPDATE ia_agent_config SET enabled = 0 WHERE agent_name = ? AND enabled = 1");
    const disableRankingStmt = this.db.prepare("UPDATE ia_rankings SET enabled = 0 WHERE agent_name = ?");

    for (const c of candidates) {
      if (c.winrate < DISABLE_WINRATE_THRESHOLD) {
        const result = disableStmt.run(c.agent_name);
        if (result.changes > 0) {
          disableRankingStmt.run(c.agent_name);
          disabled.push({ agent: c.agent_name, winrate: c.winrate });
        }
      }
    }
    return disabled;
  }

  // ─── Rankings & queries ────────────────────────────────────────────────

  /**
   * Get current rankings, optionally filtered.
   *
   * @param {object} [filters]
   * @param {string} [filters.sport]
   * @param {string} [filters.competition]
   * @param {string} [filters.marketType]
   * @param {boolean} [filters.enabledOnly=false]
   * @returns {Array} Ranked list sorted by weight desc, then winrate desc
   */
  getRankings(filters = {}) {
    let sql = "SELECT * FROM ia_rankings WHERE 1=1";
    const params = [];

    if (filters.sport) {
      sql += " AND sport = ?";
      params.push(filters.sport.toLowerCase());
    }
    if (filters.competition) {
      sql += " AND competition = ?";
      params.push(filters.competition);
    }
    if (filters.marketType) {
      sql += " AND market_type = ?";
      params.push(filters.marketType);
    }
    if (filters.enabledOnly) {
      sql += " AND enabled = 1";
    }

    sql += " ORDER BY weight DESC, winrate DESC, total_predictions DESC";
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Get the top-performing agent for a given context.
   *
   * @param {string} sport
   * @param {string} competition
   * @param {string} marketType
   * @returns {object|null} Top agent ranking row or null
   */
  getTopAgent(sport, competition, marketType) {
    return this.db.prepare(`
      SELECT * FROM ia_rankings
      WHERE sport = ? AND competition = ? AND market_type = ? AND enabled = 1
      ORDER BY weight DESC, winrate DESC
      LIMIT 1
    `).get(sport.toLowerCase(), competition, marketType) || null;
  }

  /**
   * Get all agent weights (for use in voting/consensus).
   *
   * @returns {Object<string, number>} Map of agent_name -> weight
   */
  getAgentWeights() {
    const rows = this.db.prepare(
      "SELECT agent_name, base_weight FROM ia_agent_config WHERE enabled = 1"
    ).all();
    const map = {};
    for (const r of rows) {
      map[r.agent_name] = r.base_weight;
    }
    return map;
  }

  /**
   * Add a new AI agent to the system.
   *
   * @param {string} name - Agent name
   * @param {object} [config]
   * @param {number} [config.displayOrder=99]
   * @param {number} [config.baseWeight=1.0]
   */
  addAgent(name, config = {}) {
    this.db.prepare(`
      INSERT OR IGNORE INTO ia_agent_config (agent_name, display_order, base_weight)
      VALUES (?, ?, ?)
    `).run(name, config.displayOrder || 99, config.baseWeight || 1.0);
    this._anonMap = null; // Reset cached anonymization map
  }

  /**
   * Re-enable a previously disabled agent (e.g. after retraining).
   *
   * @param {string} agentName
   */
  enableAgent(agentName) {
    this.db.prepare("UPDATE ia_agent_config SET enabled = 1 WHERE agent_name = ?").run(agentName);
    this.db.prepare("UPDATE ia_rankings SET enabled = 1 WHERE agent_name = ?").run(agentName);
  }

  // ─── Anonymization ────────────────────────────────────────────────────

  /**
   * Build a stable anonymization map: internal name -> "IA n_X".
   * The mapping is based on display_order so it stays stable across restarts.
   * @private
   */
  _buildAnonMap() {
    if (this._anonMap) return this._anonMap;

    const agents = this.db.prepare(
      "SELECT agent_name, display_order FROM ia_agent_config ORDER BY display_order ASC, agent_name ASC"
    ).all();

    this._anonMap = {};
    let idx = 1;
    for (const a of agents) {
      this._anonMap[a.agent_name] = `IA n°${idx}`;
      idx++;
    }
    return this._anonMap;
  }

  /**
   * Map an internal agent name to its anonymous public name ("IA n_1", "IA n_2", etc.).
   * The mapping is stable: the same internal name always maps to the same number.
   *
   * @param {string} internalName - The internal agent name (e.g. "GeminiFlash")
   * @returns {string} Anonymous name (e.g. "IA n_3")
   */
  anonymizeAgentName(internalName) {
    const map = this._buildAnonMap();
    return map[internalName] || `IA n°?`;
  }

  /**
   * Get agent display name based on context.
   *
   * @param {string} internalName - The internal agent name
   * @param {boolean} isPublic - If true, returns anonymous name; if false, returns real name
   * @returns {string}
   */
  getAgentDisplayName(internalName, isPublic) {
    if (isPublic) {
      return this.anonymizeAgentName(internalName);
    }
    return internalName;
  }

  /**
   * Close the database connection.
   */
  close() {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }
}

// ─── Standalone helper functions (exported for convenience) ──────────────

/**
 * Check if a market type is still valid (standalone, no DB needed).
 *
 * @param {string} marketType
 * @param {number} minute
 * @param {{ home: number, away: number }} [score]
 * @param {object} [rules] - Custom rules, defaults to MARKET_VALIDITY_RULES
 * @returns {{ valid: boolean, reason: string }}
 */
function isMarketStillValid(marketType, minute, score, rules) {
  const effectiveRules = rules || MARKET_VALIDITY_RULES;
  const rule = effectiveRules[marketType];

  if (!rule) {
    return { valid: true, reason: "Marche non configure, considere valide par defaut" };
  }

  // BTTS special rule: check score condition before generic maxMinute
  if (marketType === "BTTS" && rule.scoreCheck && score) {
    const scoreMinute = rule.scoreMaxMinute || 80;
    if (minute > scoreMinute && (score.home === 0 || score.away === 0)) {
      return {
        valid: false,
        reason: `BTTS invalide apres la ${scoreMinute}e minute si une equipe n'a pas marque (score: ${score.home}-${score.away})`,
      };
    }
  }

  if (minute > rule.maxMinute) {
    return {
      valid: false,
      reason: `${rule.label} invalide apres la ${rule.maxMinute}e minute (minute actuelle: ${minute})`,
    };
  }

  return { valid: true, reason: "Marche valide" };
}

/**
 * Create a standalone anonymization function from a list of agent names.
 *
 * @param {string[]} agentNames - Ordered list of agent names
 * @returns {function(string): string} Anonymizer function
 */
function createAnonymizer(agentNames) {
  const map = {};
  agentNames.forEach((name, i) => {
    map[name] = `IA n°${i + 1}`;
  });
  return (internalName) => map[internalName] || `IA n°?`;
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  IARankingEngine,
  isMarketStillValid,
  createAnonymizer,
  MARKET_VALIDITY_RULES,
  DEFAULT_AGENTS,
  VALID_SPORTS,
  VALID_MARKETS,
  MIN_PREDICTIONS_FOR_DISABLE,
  DISABLE_WINRATE_THRESHOLD,
};
