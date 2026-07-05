const { LearningEngine } = require("./learning_engine");

class LearningBridge {
  constructor(db) {
    this._engine = new LearningEngine(db);
    this._db = db;
  }

  getWeightedAgentContext(agentName) {
    const row = this._db.prepare(
      "SELECT * FROM learning_agent_stats WHERE agent_name = ?"
    ).get(agentName);

    if (!row || row.matches < 5) {
      return { weight: 50, source: "neutral", matches: row?.matches || 0 };
    }

    const weightPercent = Math.max(10, Math.min(95, Math.round(row.weight * row.winrate)));
    return {
      weight: weightPercent,
      rawWeight: row.weight,
      winrate: row.winrate,
      roi: row.roi,
      matches: row.matches,
      wins: row.wins,
      losses: row.losses,
      precision: row.precision_score,
      source: "learning_engine",
    };
  }

  formatAgentVoteLine(agent, agentPerf) {
    const ctx = this.getWeightedAgentContext(agent.name);
    if (ctx.source === "learning_engine") {
      return `${agent.name}: ${agent.bet} (${agent.confidence}%) — Learning Engine: poids ${ctx.rawWeight.toFixed(2)}, ${ctx.winrate.toFixed(1)}% winrate (${ctx.wins}W/${ctx.losses}L sur ${ctx.matches}) ROI ${ctx.roi >= 0 ? "+" : ""}${ctx.roi.toFixed(1)}% → POIDS FINAL: ${ctx.weight}%`;
    }
    const p = agentPerf?.[agent.name];
    const resolved = p ? p.resolved : 0;
    const fallbackWeight = resolved >= 5 ? Math.max(10, Math.min(95, p.winrate)) : 50;
    const perfNote = resolved >= 5
      ? `historique: ${p.winrate}% winrate (${p.wins}/${resolved} résolus) → POIDS: ${fallbackWeight}% (fallback)`
      : resolved > 0 ? `(${resolved} prédiction(s), pas assez pour peser) → POIDS: 50% (neutre)` : `(sans historique) → POIDS: 50% (neutre)`;
    return `${agent.name}: ${agent.bet} (${agent.confidence}%) — ${perfNote}`;
  }

  getCompetitionContext(competition) {
    if (!competition) return null;
    try {
      const row = this._db.prepare(
        "SELECT * FROM learning_competition_stats WHERE competition = ?"
      ).get(competition);
      if (!row || row.matches < 3) return null;
      return {
        competition: row.competition,
        winrate: row.winrate,
        roi: row.roi,
        matches: row.matches,
        wins: row.wins,
        losses: row.losses,
        status: row.status,
      };
    } catch {
      return null;
    }
  }

  formatCompetitionNote(competition) {
    const ctx = this.getCompetitionContext(competition);
    if (!ctx) return "";
    const emoji = ctx.winrate >= 60 ? "🟢" : ctx.winrate >= 45 ? "🟡" : "🔴";
    const statusNote = ctx.status === "excluded" ? " [EXCLUE par Learning Engine]" : "";
    return `\n${emoji} Learning Engine — ${ctx.competition}: ${ctx.winrate.toFixed(1)}% winrate sur ${ctx.matches} matchs (ROI ${ctx.roi >= 0 ? "+" : ""}${ctx.roi.toFixed(1)}%)${statusNote}`;
  }

  getBetTypePerformance(betType) {
    if (!betType) return null;
    try {
      const row = this._db.prepare(`
        SELECT predicted_bet,
          COUNT(*) as matches,
          SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) as losses
        FROM learning_match_results
        WHERE predicted_bet = ?
      `).get(betType);
      if (!row || row.matches < 3) return null;
      const winrate = row.wins + row.losses > 0 ? (row.wins / (row.wins + row.losses)) * 100 : 0;
      return { bet: row.predicted_bet, matches: row.matches, wins: row.wins, losses: row.losses, winrate: Math.round(winrate * 10) / 10 };
    } catch {
      return null;
    }
  }

  formatBetTypeNote(bets) {
    if (!bets || !bets.length) return "";
    const notes = [];
    for (const bet of bets) {
      const perf = this.getBetTypePerformance(bet);
      if (perf && perf.matches >= 5) {
        const emoji = perf.winrate >= 60 ? "✅" : perf.winrate >= 45 ? "⚠️" : "❌";
        notes.push(`${emoji} ${perf.bet}: ${perf.winrate}% (${perf.matches} matchs)`);
      }
    }
    if (!notes.length) return "";
    return `\nLearning Engine — Performance par marché:\n${notes.join("\n")}`;
  }

  isCompetitionExcluded(competition) {
    if (!competition) return false;
    try {
      const row = this._db.prepare(
        "SELECT status FROM learning_competition_stats WHERE competition = ? AND status = 'excluded'"
      ).get(competition);
      return !!row;
    } catch {
      return false;
    }
  }

  getEngine() {
    return this._engine;
  }

  isAvailable() {
    try {
      this._db.prepare("SELECT 1 FROM learning_agent_stats LIMIT 1").get();
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { LearningBridge };
