const { LearningEngine } = require("./learning_engine");
const { LearningBridge } = require("./learning_bridge");
const { SnapshotStore } = require("./snapshot_store");
const { bus } = require("./event_bus");

class HermesDashboard {
  constructor(db, env = process.env) {
    this._db = db;
    this._env = env;
    this._learningEngine = new LearningEngine(db);
    this._learningBridge = new LearningBridge(db);
    this._snapshotStore = new SnapshotStore(db);
  }

  getFullDashboard() {
    return {
      generatedAt: new Date().toISOString(),
      health: this.getSystemHealth(),
      infrastructure: this.getInfrastructure(),
      payments: this.getPayments(),
      agents: this.getAgents(),
      competitions: this.getCompetitions(),
      learningEngine: this.getLearningEngineStatus(),
      publications: this.getPublications(),
      journal: this.getJournal(),
    };
  }

  // ── System Health ──

  getSystemHealth() {
    const checks = {};

    checks.docker = {
      status: this._checkDocker(),
      label: "Docker",
      checkedAt: new Date().toISOString(),
    };

    checks.vps = {
      status: this._checkVPS(),
      label: "VPS",
      checkedAt: new Date().toISOString(),
    };

    checks.openrouter = {
      status: this._checkKey("OPENROUTER_API_KEY"),
      label: "OpenRouter",
      checkedAt: new Date().toISOString(),
    };

    checks.telegram = {
      status: this._checkKey("TELEGRAM_BOT_TOKEN"),
      label: "Telegram",
      checkedAt: new Date().toISOString(),
    };

    checks.stripe = {
      status: this._checkKey("STRIPE_SECRET_KEY"),
      label: "Stripe",
      checkedAt: new Date().toISOString(),
    };

    checks.brevo = {
      status: this._checkKey("BREVO_API_KEY"),
      label: "Brevo",
      checkedAt: new Date().toISOString(),
    };

    checks.learningEngine = {
      status: this._learningBridge.isAvailable() ? "green" : "red",
      label: "Learning Engine",
      checkedAt: new Date().toISOString(),
    };

    checks.eventBus = {
      status: this._checkEventBus(),
      label: "Event Bus",
      checkedAt: new Date().toISOString(),
    };

    const allGreen = Object.values(checks).every(c => c.status === "green");
    const hasRed = Object.values(checks).some(c => c.status === "red");

    return {
      overall: allGreen ? "green" : hasRed ? "red" : "yellow",
      checks,
    };
  }

  // ── Infrastructure ──

  getInfrastructure() {
    return {
      vps: { configured: true, label: "Hostinger KVM 2" },
      docker: { configured: true, services: ["site", "api", "council", "hermes-admin"] },
      apiSports: { configured: !!this._env.API_SPORTS_KEY },
      footballData: { configured: !!this._env.FOOTBALL_DATA_KEY },
      openrouter: { configured: !!this._env.OPENROUTER_API_KEY },
      groq: { configured: !!this._env.GROQ_API_KEY },
      deepseek: { configured: !!this._env.DEEPSEEK_API_KEY },
      mistral: { configured: !!this._env.MISTRAL_API_KEY },
      cerebras: { configured: !!this._env.CEREBRAS_API_KEY },
      perplexity: { configured: !!this._env.PERPLEXITY_API_KEY },
      cohere: { configured: !!this._env.COHERE_API_KEY },
      eventBus: {
        listenerCount: bus.listenerCount("*"),
        recentEvents: bus.getHistory(null, 10).length,
      },
      learningEngine: { available: this._learningBridge.isAvailable() },
    };
  }

  // ── Payments ──

  getPayments() {
    return {
      stripe: { configured: !!this._env.STRIPE_SECRET_KEY, webhookConfigured: !!this._env.STRIPE_WEBHOOK_SECRET },
      brevo: { configured: !!this._env.BREVO_API_KEY },
      telegram: { configured: !!this._env.TELEGRAM_BOT_TOKEN },
    };
  }

  // ── Agents ──

  getAgents() {
    const stats = this._learningEngine.getAgentStats();
    const weights = this._learningEngine.getAgentWeights();

    return stats.map(agent => {
      const w = weights.find(x => x.agent_name === agent.agent_name);
      const lastChange = this._db.prepare(
        "SELECT * FROM learning_weight_history WHERE agent_name = ? ORDER BY created_at DESC LIMIT 1"
      ).get(agent.agent_name);

      return {
        name: agent.agent_name,
        weight: agent.weight,
        winrate: agent.winrate,
        roi: agent.roi,
        precision: agent.precision_score,
        matches: agent.matches,
        wins: agent.wins,
        losses: agent.losses,
        lastUpdate: agent.updated_at,
        lastWeightChange: lastChange ? {
          from: lastChange.old_weight,
          to: lastChange.new_weight,
          reason: lastChange.reason,
          date: lastChange.created_at,
        } : null,
      };
    });
  }

  // ── Competitions ──

  getCompetitions() {
    const all = this._learningEngine.getCompetitionStats(100);

    return all.map(comp => {
      let statusEmoji, statusLabel;
      if (comp.status === "excluded") {
        statusEmoji = "red";
        statusLabel = "Exclu";
      } else if (comp.winrate >= 55 && comp.matches >= 8) {
        statusEmoji = "green";
        statusLabel = "Prioritaire";
      } else if (comp.winrate >= 42 || comp.matches < 8) {
        statusEmoji = "yellow";
        statusLabel = "Surveillance";
      } else {
        statusEmoji = "red";
        statusLabel = "Exclu";
      }

      return {
        competition: comp.competition,
        sport: comp.sport,
        roi: comp.roi,
        winrate: comp.winrate,
        matches: comp.matches,
        wins: comp.wins,
        losses: comp.losses,
        status: comp.status,
        statusEmoji,
        statusLabel,
        lastUpdate: comp.updated_at,
      };
    });
  }

  // ── Learning Engine Status ──

  getLearningEngineStatus() {
    const summary = this._learningEngine.getSummary();
    const recentResults = this._learningEngine.getMatchResults(5);
    const weightHistory = this._learningEngine.getWeightHistory(null, 10);
    const pendingRecs = this._learningEngine.getRecommendations({ applied: false, limit: 10 });

    const lastMatch = recentResults[0] || null;
    const lastWeightChange = weightHistory[0] || null;

    return {
      totalMatches: summary.totalMatches,
      totalWins: summary.totalWins,
      totalLosses: summary.totalLosses,
      globalWinrate: summary.globalWinrate,
      agentCount: summary.agents.length,
      lastMatchLearned: lastMatch ? {
        matchKey: lastMatch.match_key,
        home: lastMatch.home,
        away: lastMatch.away,
        outcome: lastMatch.outcome,
        score: `${lastMatch.final_score_home}-${lastMatch.final_score_away}`,
        evaluatedAt: lastMatch.evaluated_at,
      } : null,
      lastWeightUpdate: lastWeightChange ? {
        agent: lastWeightChange.agent_name,
        from: lastWeightChange.old_weight,
        to: lastWeightChange.new_weight,
        reason: lastWeightChange.reason,
        date: lastWeightChange.created_at,
      } : null,
      weightHistory: weightHistory.map(h => ({
        agent: h.agent_name,
        from: h.old_weight,
        to: h.new_weight,
        reason: h.reason,
        date: h.created_at,
      })),
      pendingRecommendations: pendingRecs.map(r => ({
        id: r.id,
        type: r.type,
        target: r.target,
        action: r.action,
        reason: r.reason,
        date: r.created_at,
      })),
    };
  }

  // ── Publications ──

  getPublications() {
    const lastSnapshot = this._snapshotStore.getAllSnapshots({ limit: 1 })[0] || null;
    const totalSnapshots = this._snapshotStore.countSnapshots();

    let lastConcile = null;
    try {
      lastConcile = this._db.prepare(
        "SELECT * FROM concile_analyses ORDER BY analysed_at DESC LIMIT 1"
      ).get() || null;
    } catch {}

    let lastResolved = null;
    try {
      lastResolved = this._db.prepare(
        "SELECT * FROM concile_analyses WHERE outcome IS NOT NULL ORDER BY resolved_at DESC LIMIT 1"
      ).get() || null;
    } catch {}

    let lastLearned = null;
    try {
      lastLearned = this._db.prepare(
        "SELECT * FROM learning_match_results ORDER BY evaluated_at DESC LIMIT 1"
      ).get() || null;
    } catch {}

    return {
      lastSnapshot: lastSnapshot ? {
        matchKey: lastSnapshot.match_key,
        home: lastSnapshot.home,
        away: lastSnapshot.away,
        selection: lastSnapshot.selection,
        confidence: lastSnapshot.confidence,
        odds: lastSnapshot.odds,
        publishedAt: lastSnapshot.created_at,
      } : null,
      totalSnapshots,
      lastConcileAnalysis: lastConcile ? {
        home: lastConcile.home,
        away: lastConcile.away,
        bet: lastConcile.best_bet,
        confidence: lastConcile.confidence,
        outcome: lastConcile.outcome,
        analysedAt: lastConcile.analysed_at,
      } : null,
      lastResolved: lastResolved ? {
        home: lastResolved.home,
        away: lastResolved.away,
        bet: lastResolved.best_bet,
        outcome: lastResolved.outcome,
        score: lastResolved.final_score_home != null
          ? `${lastResolved.final_score_home}-${lastResolved.final_score_away}` : null,
        resolvedAt: lastResolved.resolved_at,
      } : null,
      lastAutoLearned: lastLearned ? {
        home: lastLearned.home,
        away: lastLearned.away,
        outcome: lastLearned.outcome,
        score: `${lastLearned.final_score_home}-${lastLearned.final_score_away}`,
        evaluatedAt: lastLearned.evaluated_at,
      } : null,
    };
  }

  // ── Journal ──

  getJournal() {
    const busHistory = bus.getHistory(null, 20);

    return {
      eventBus: busHistory.map(e => ({
        event: e.name,
        timestamp: e.timestamp,
        summary: this._summarizeEvent(e),
      })),
      recentEvents: busHistory.length,
    };
  }

  // ── Internal helpers ──

  _checkKey(name) {
    return this._env[name] ? "green" : "red";
  }

  _checkDocker() {
    try {
      return require("fs").existsSync("/.dockerenv") ? "green" : "yellow";
    } catch {
      return "yellow";
    }
  }

  _checkVPS() {
    return "green";
  }

  _checkEventBus() {
    return bus && typeof bus.publish === "function" ? "green" : "red";
  }

  _summarizeEvent(event) {
    if (!event || !event.payload) return "";
    const p = event.payload;
    if (p.home && p.away) return `${p.home} vs ${p.away}`;
    if (p.match_key) return p.match_key;
    if (p.email) return `contact: ${p.email}`;
    if (p.agent) return `agent: ${p.agent}`;
    return "";
  }
}

module.exports = { HermesDashboard };
