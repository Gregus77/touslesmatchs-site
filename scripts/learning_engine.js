const { bus, EVENT_NAMES } = require("./event_bus");

const LEARNING_EVENTS = {
  MATCH_EVALUATED: "LEARNING_MATCH_EVALUATED",
  WEIGHTS_UPDATED: "LEARNING_WEIGHTS_UPDATED",
  RECOMMENDATION_GENERATED: "LEARNING_RECOMMENDATION_GENERATED",
};

const DEFAULT_WEIGHT = 1.0;
const MIN_WEIGHT = 0.10;
const MAX_WEIGHT = 1.50;
const WEIGHT_STEP = 0.02;
const MIN_MATCHES_FOR_RECOMMENDATION = 10;
const LEAGUE_EXCLUDE_THRESHOLD = 0.42;
const LEAGUE_REINTEGRATE_THRESHOLD = 0.55;
const LEAGUE_MIN_MATCHES = 8;

class LearningEngine {
  constructor(db) {
    this._db = db;
    this._ensureTables();
  }

  _ensureTables() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS learning_agent_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        matches INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        pending INTEGER DEFAULT 0,
        winrate REAL DEFAULT 0,
        roi REAL DEFAULT 0,
        precision_score REAL DEFAULT 0,
        weight REAL DEFAULT ${DEFAULT_WEIGHT},
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(agent_name)
      );

      CREATE TABLE IF NOT EXISTS learning_competition_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competition TEXT NOT NULL,
        sport TEXT DEFAULT 'Football',
        matches INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        winrate REAL DEFAULT 0,
        roi REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(competition)
      );

      CREATE TABLE IF NOT EXISTS learning_match_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        home TEXT NOT NULL,
        away TEXT NOT NULL,
        competition TEXT DEFAULT '',
        sport TEXT DEFAULT 'Football',
        predicted_bet TEXT NOT NULL,
        predicted_confidence INTEGER DEFAULT 0,
        predicted_odds REAL,
        final_score_home INTEGER NOT NULL,
        final_score_away INTEGER NOT NULL,
        outcome TEXT NOT NULL,
        agents_json TEXT DEFAULT '[]',
        agent_outcomes_json TEXT DEFAULT '{}',
        snapshot_id INTEGER,
        evaluated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(match_key)
      );

      CREATE TABLE IF NOT EXISTS learning_weight_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        old_weight REAL NOT NULL,
        new_weight REAL NOT NULL,
        reason TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS learning_recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        target TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT DEFAULT '',
        data_json TEXT DEFAULT '{}',
        applied INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  // ── Core: evaluate a finished match against its snapshot ──

  evaluateMatch(snapshot, finalScoreHome, finalScoreAway) {
    if (!snapshot || !snapshot.match_key) return null;
    if (finalScoreHome === null || finalScoreHome === undefined) return null;
    if (finalScoreAway === null || finalScoreAway === undefined) return null;

    const existing = this._db.prepare(
      "SELECT 1 FROM learning_match_results WHERE match_key = ?"
    ).get(snapshot.match_key);
    if (existing) return null;

    const h = Number(finalScoreHome);
    const a = Number(finalScoreAway);
    const concileOutcome = this._resolveBet(snapshot.selection, h, a);
    if (!concileOutcome) return null;

    const agents = this._parseAgents(snapshot.agents_json);
    const agentOutcomes = {};
    for (const agent of agents) {
      const outcome = this._resolveBet(agent.bet, h, a);
      if (outcome) agentOutcomes[agent.name] = outcome;
    }

    this._db.prepare(`
      INSERT INTO learning_match_results
        (match_key, home, away, competition, sport,
         predicted_bet, predicted_confidence, predicted_odds,
         final_score_home, final_score_away, outcome,
         agents_json, agent_outcomes_json, snapshot_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      snapshot.match_key,
      snapshot.home, snapshot.away,
      snapshot.competition || "", snapshot.sport || "Football",
      snapshot.selection, snapshot.confidence, snapshot.odds || null,
      h, a, concileOutcome,
      snapshot.agents_json || "[]",
      JSON.stringify(agentOutcomes),
      snapshot.id || null
    );

    this._updateAgentStats(agents, agentOutcomes);
    this._updateCompetitionStats(snapshot.competition || "", snapshot.sport || "Football", concileOutcome);

    bus.publish(LEARNING_EVENTS.MATCH_EVALUATED, {
      match_key: snapshot.match_key,
      outcome: concileOutcome,
      agent_outcomes: agentOutcomes,
    });

    return { match_key: snapshot.match_key, outcome: concileOutcome, agentOutcomes };
  }

  // ── Agent stats ──

  _updateAgentStats(agents, agentOutcomes) {
    for (const agent of agents) {
      const outcome = agentOutcomes[agent.name];
      if (!outcome) continue;

      const row = this._db.prepare(
        "SELECT * FROM learning_agent_stats WHERE agent_name = ?"
      ).get(agent.name);

      if (!row) {
        const w = outcome === "win" ? 1 : 0;
        const l = outcome === "loss" ? 1 : 0;
        this._db.prepare(`
          INSERT INTO learning_agent_stats (agent_name, matches, wins, losses, winrate, weight)
          VALUES (?, 1, ?, ?, ?, ?)
        `).run(agent.name, w, l, w * 100, DEFAULT_WEIGHT);
      } else {
        const wins = row.wins + (outcome === "win" ? 1 : 0);
        const losses = row.losses + (outcome === "loss" ? 1 : 0);
        const matches = wins + losses;
        const winrate = matches > 0 ? (wins / matches) * 100 : 0;
        this._db.prepare(`
          UPDATE learning_agent_stats
          SET matches = ?, wins = ?, losses = ?, winrate = ?, updated_at = datetime('now')
          WHERE agent_name = ?
        `).run(matches, wins, losses, Math.round(winrate * 100) / 100, agent.name);
      }
    }
  }

  _updateCompetitionStats(competition, sport, outcome) {
    if (!competition) return;

    const row = this._db.prepare(
      "SELECT * FROM learning_competition_stats WHERE competition = ?"
    ).get(competition);

    if (!row) {
      const w = outcome === "win" ? 1 : 0;
      const l = outcome === "loss" ? 1 : 0;
      this._db.prepare(`
        INSERT INTO learning_competition_stats (competition, sport, matches, wins, losses, winrate)
        VALUES (?, ?, 1, ?, ?, ?)
      `).run(competition, sport, w, l, w * 100);
    } else {
      const wins = row.wins + (outcome === "win" ? 1 : 0);
      const losses = row.losses + (outcome === "loss" ? 1 : 0);
      const matches = wins + losses;
      const winrate = matches > 0 ? (wins / matches) * 100 : 0;
      this._db.prepare(`
        UPDATE learning_competition_stats
        SET matches = ?, wins = ?, losses = ?, winrate = ?, updated_at = datetime('now')
        WHERE competition = ?
      `).run(matches, wins, losses, Math.round(winrate * 100) / 100, competition);
    }
  }

  // ── Weight recalculation ──

  recalculateWeights() {
    const agents = this._db.prepare(
      "SELECT * FROM learning_agent_stats WHERE matches >= ?"
    ).all(MIN_MATCHES_FOR_RECOMMENDATION);

    if (!agents.length) return [];

    const avgWinrate = agents.reduce((s, a) => s + a.winrate, 0) / agents.length;
    const changes = [];

    for (const agent of agents) {
      const oldWeight = agent.weight;
      let newWeight = oldWeight;

      if (agent.winrate > avgWinrate + 5) {
        newWeight = Math.min(MAX_WEIGHT, oldWeight + WEIGHT_STEP);
      } else if (agent.winrate < avgWinrate - 5) {
        newWeight = Math.max(MIN_WEIGHT, oldWeight - WEIGHT_STEP);
      }

      newWeight = Math.round(newWeight * 100) / 100;

      if (newWeight !== oldWeight) {
        this._db.prepare(
          "UPDATE learning_agent_stats SET weight = ?, updated_at = datetime('now') WHERE agent_name = ?"
        ).run(newWeight, agent.agent_name);

        this._db.prepare(
          "INSERT INTO learning_weight_history (agent_name, old_weight, new_weight, reason) VALUES (?,?,?,?)"
        ).run(
          agent.agent_name, oldWeight, newWeight,
          `winrate ${agent.winrate.toFixed(1)}% vs avg ${avgWinrate.toFixed(1)}%`
        );

        changes.push({ agent: agent.agent_name, oldWeight, newWeight, winrate: agent.winrate });
      }
    }

    if (changes.length) {
      bus.publish(LEARNING_EVENTS.WEIGHTS_UPDATED, { changes });
    }

    return changes;
  }

  // ── Recommendations ──

  generateRecommendations() {
    const recommendations = [];

    const agents = this._db.prepare(
      "SELECT * FROM learning_agent_stats WHERE matches >= ? ORDER BY winrate DESC"
    ).all(MIN_MATCHES_FOR_RECOMMENDATION);

    for (const agent of agents) {
      if (agent.winrate >= 65 && agent.weight < MAX_WEIGHT) {
        recommendations.push({
          type: "agent",
          target: agent.agent_name,
          action: "increase_weight",
          reason: `Winrate ${agent.winrate.toFixed(1)}% sur ${agent.matches} matchs (poids actuel: ${agent.weight})`,
          data: { winrate: agent.winrate, matches: agent.matches, weight: agent.weight },
        });
      }
      if (agent.winrate < 40 && agent.weight > MIN_WEIGHT) {
        recommendations.push({
          type: "agent",
          target: agent.agent_name,
          action: "decrease_weight",
          reason: `Winrate ${agent.winrate.toFixed(1)}% sur ${agent.matches} matchs (poids actuel: ${agent.weight})`,
          data: { winrate: agent.winrate, matches: agent.matches, weight: agent.weight },
        });
      }
    }

    const competitions = this._db.prepare(
      "SELECT * FROM learning_competition_stats WHERE matches >= ? ORDER BY winrate ASC"
    ).all(LEAGUE_MIN_MATCHES);

    for (const comp of competitions) {
      const wr = comp.winrate / 100;
      if (wr < LEAGUE_EXCLUDE_THRESHOLD && comp.status === "active") {
        recommendations.push({
          type: "competition",
          target: comp.competition,
          action: "exclude",
          reason: `Winrate ${comp.winrate.toFixed(1)}% sur ${comp.matches} matchs — sous le seuil de ${LEAGUE_EXCLUDE_THRESHOLD * 100}%`,
          data: { winrate: comp.winrate, matches: comp.matches },
        });
      }
      if (wr >= LEAGUE_REINTEGRATE_THRESHOLD && comp.status === "excluded") {
        recommendations.push({
          type: "competition",
          target: comp.competition,
          action: "reintegrate",
          reason: `Winrate remonté à ${comp.winrate.toFixed(1)}% sur ${comp.matches} matchs — au-dessus du seuil de ${LEAGUE_REINTEGRATE_THRESHOLD * 100}%`,
          data: { winrate: comp.winrate, matches: comp.matches },
        });
      }
    }

    const insertStmt = this._db.prepare(`
      INSERT INTO learning_recommendations (type, target, action, reason, data_json) VALUES (?,?,?,?,?)
    `);
    for (const rec of recommendations) {
      insertStmt.run(rec.type, rec.target, rec.action, rec.reason, JSON.stringify(rec.data));
    }

    if (recommendations.length) {
      bus.publish(LEARNING_EVENTS.RECOMMENDATION_GENERATED, { count: recommendations.length, recommendations });
    }

    return recommendations;
  }

  // ── Apply a recommendation ──

  applyRecommendation(id) {
    const rec = this._db.prepare("SELECT * FROM learning_recommendations WHERE id = ? AND applied = 0").get(id);
    if (!rec) return null;

    if (rec.type === "agent" && (rec.action === "increase_weight" || rec.action === "decrease_weight")) {
      const agent = this._db.prepare("SELECT * FROM learning_agent_stats WHERE agent_name = ?").get(rec.target);
      if (agent) {
        const direction = rec.action === "increase_weight" ? 1 : -1;
        const step = WEIGHT_STEP * 2;
        const newWeight = Math.round(Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, agent.weight + direction * step)) * 100) / 100;
        this._db.prepare("UPDATE learning_agent_stats SET weight = ?, updated_at = datetime('now') WHERE agent_name = ?")
          .run(newWeight, rec.target);
        this._db.prepare("INSERT INTO learning_weight_history (agent_name, old_weight, new_weight, reason) VALUES (?,?,?,?)")
          .run(rec.target, agent.weight, newWeight, `recommendation #${id}: ${rec.action}`);
      }
    }

    if (rec.type === "competition" && rec.action === "exclude") {
      this._db.prepare("UPDATE learning_competition_stats SET status = 'excluded', updated_at = datetime('now') WHERE competition = ?")
        .run(rec.target);
    }
    if (rec.type === "competition" && rec.action === "reintegrate") {
      this._db.prepare("UPDATE learning_competition_stats SET status = 'active', updated_at = datetime('now') WHERE competition = ?")
        .run(rec.target);
    }

    this._db.prepare("UPDATE learning_recommendations SET applied = 1 WHERE id = ?").run(id);
    return rec;
  }

  // ── ROI calculation ──

  recalculateROI() {
    const agents = this._db.prepare("SELECT * FROM learning_agent_stats").all();

    for (const agent of agents) {
      const results = this._db.prepare(`
        SELECT lr.outcome, lr.predicted_odds, lr.predicted_confidence, ao.value as agent_outcome
        FROM learning_match_results lr, json_each(lr.agent_outcomes_json) ao
        WHERE ao.key = ?
      `).all(agent.agent_name);

      if (!results.length) continue;

      let totalStake = 0;
      let totalReturn = 0;
      let correctHighConf = 0;
      let totalHighConf = 0;

      for (const r of results) {
        totalStake += 1;
        if (r.agent_outcome === "win") {
          totalReturn += (r.predicted_odds || 1.80);
        }
        if (r.predicted_confidence >= 75) {
          totalHighConf++;
          if (r.agent_outcome === "win") correctHighConf++;
        }
      }

      const roi = totalStake > 0 ? ((totalReturn - totalStake) / totalStake) * 100 : 0;
      const precision = totalHighConf > 0 ? (correctHighConf / totalHighConf) * 100 : 0;

      this._db.prepare(
        "UPDATE learning_agent_stats SET roi = ?, precision_score = ?, updated_at = datetime('now') WHERE agent_name = ?"
      ).run(Math.round(roi * 100) / 100, Math.round(precision * 100) / 100, agent.agent_name);
    }

    const competitions = this._db.prepare("SELECT * FROM learning_competition_stats").all();
    for (const comp of competitions) {
      const results = this._db.prepare(
        "SELECT outcome, predicted_odds FROM learning_match_results WHERE competition = ?"
      ).all(comp.competition);

      let stake = 0, ret = 0;
      for (const r of results) {
        stake += 1;
        if (r.outcome === "win") ret += (r.predicted_odds || 1.80);
      }
      const roi = stake > 0 ? ((ret - stake) / stake) * 100 : 0;
      this._db.prepare(
        "UPDATE learning_competition_stats SET roi = ?, updated_at = datetime('now') WHERE competition = ?"
      ).run(Math.round(roi * 100) / 100, comp.competition);
    }
  }

  // ── Batch: process all unresolved snapshots ──

  processUnresolvedSnapshots(snapshotStore) {
    const snapshots = snapshotStore.getAllSnapshots({ status: "published" });
    let evaluated = 0;

    for (const snap of snapshots) {
      const already = this._db.prepare("SELECT 1 FROM learning_match_results WHERE match_key = ?").get(snap.match_key);
      if (already) continue;

      const concile = this._db.prepare(
        "SELECT final_score_home, final_score_away FROM concile_analyses WHERE match_key = ? AND outcome IS NOT NULL LIMIT 1"
      ).get(snap.match_key);

      if (concile && concile.final_score_home !== null && concile.final_score_away !== null) {
        const result = this.evaluateMatch(snap, concile.final_score_home, concile.final_score_away);
        if (result) evaluated++;
      }
    }

    if (evaluated > 0) {
      this.recalculateROI();
      this.recalculateWeights();
    }

    return evaluated;
  }

  // ── Query methods ──

  getAgentStats() {
    return this._db.prepare(
      "SELECT * FROM learning_agent_stats ORDER BY winrate DESC"
    ).all();
  }

  getAgentWeights() {
    return this._db.prepare(
      "SELECT agent_name, weight, winrate, matches FROM learning_agent_stats ORDER BY weight DESC"
    ).all();
  }

  getCompetitionStats(limit = 50) {
    return this._db.prepare(
      "SELECT * FROM learning_competition_stats ORDER BY matches DESC LIMIT ?"
    ).all(limit);
  }

  getCompetitionRanking() {
    return this._db.prepare(
      "SELECT competition, sport, winrate, matches, roi, status FROM learning_competition_stats WHERE matches >= ? ORDER BY winrate DESC"
    ).all(LEAGUE_MIN_MATCHES);
  }

  getMatchResults(limit = 50) {
    return this._db.prepare(
      "SELECT * FROM learning_match_results ORDER BY evaluated_at DESC LIMIT ?"
    ).all(limit);
  }

  getWeightHistory(agentName, limit = 20) {
    if (agentName) {
      return this._db.prepare(
        "SELECT * FROM learning_weight_history WHERE agent_name = ? ORDER BY created_at DESC LIMIT ?"
      ).all(agentName, limit);
    }
    return this._db.prepare(
      "SELECT * FROM learning_weight_history ORDER BY created_at DESC LIMIT ?"
    ).all(limit);
  }

  getRecommendations({ applied, limit = 20 } = {}) {
    if (applied !== undefined) {
      return this._db.prepare(
        "SELECT * FROM learning_recommendations WHERE applied = ? ORDER BY created_at DESC LIMIT ?"
      ).all(applied ? 1 : 0, limit);
    }
    return this._db.prepare(
      "SELECT * FROM learning_recommendations ORDER BY created_at DESC LIMIT ?"
    ).all(limit);
  }

  getSummary() {
    const totalMatches = this._db.prepare("SELECT COUNT(*) as c FROM learning_match_results").get().c;
    const totalWins = this._db.prepare("SELECT COUNT(*) as c FROM learning_match_results WHERE outcome = 'win'").get().c;
    const totalLosses = this._db.prepare("SELECT COUNT(*) as c FROM learning_match_results WHERE outcome = 'loss'").get().c;
    const globalWinrate = totalWins + totalLosses > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 10000) / 100 : 0;

    const agents = this.getAgentStats();
    const topCompetitions = this._db.prepare(
      "SELECT competition, winrate, matches FROM learning_competition_stats WHERE matches >= ? ORDER BY winrate DESC LIMIT 5"
    ).all(LEAGUE_MIN_MATCHES);
    const weakCompetitions = this._db.prepare(
      "SELECT competition, winrate, matches FROM learning_competition_stats WHERE matches >= ? ORDER BY winrate ASC LIMIT 5"
    ).all(LEAGUE_MIN_MATCHES);
    const pendingRecommendations = this._db.prepare(
      "SELECT COUNT(*) as c FROM learning_recommendations WHERE applied = 0"
    ).get().c;

    return {
      totalMatches,
      totalWins,
      totalLosses,
      globalWinrate,
      agents,
      topCompetitions,
      weakCompetitions,
      pendingRecommendations,
    };
  }

  // ── Bet resolution (same logic as existing codebase) ──

  _resolveBet(bet, h, a) {
    if (!bet) return null;
    const total = h + a;
    const n = bet.toLowerCase();

    if (n.includes("over 2.5") || n.includes("plus de 2.5")) return total > 2.5 ? "win" : "loss";
    if (n.includes("under 2.5") || n.includes("moins de 2.5")) return total < 2.5 ? "win" : "loss";
    if (n.includes("btts oui") || n.includes("les deux") || n.includes("both teams")) return (h > 0 && a > 0) ? "win" : "loss";
    if (n.includes("btts non")) return (h > 0 && a > 0) ? "loss" : "win";
    if (n === "match nul" || n === "x" || n.includes("nul")) return h === a ? "win" : "loss";
    if (n === "1x" || n.includes("1x")) return h >= a ? "win" : "loss";
    if (n === "x2" || n.includes("x2")) return a >= h ? "win" : "loss";
    if (n === "12" || n.includes("12")) return h !== a ? "win" : "loss";
    if (n.includes("domicile") || n === "1") return h > a ? "win" : "loss";
    if (n.includes("extérieur") || n.includes("exterieur") || n === "2") return a > h ? "win" : "loss";
    return null;
  }

  _parseAgents(agentsJson) {
    try {
      return JSON.parse(agentsJson || "[]");
    } catch {
      return [];
    }
  }
}

module.exports = { LearningEngine, LEARNING_EVENTS };
