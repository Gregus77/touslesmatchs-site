class SnapshotStore {
  constructor(db) {
    this._db = db;
    this._ensureTables();
  }

  _ensureTables() {
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS official_prediction_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL UNIQUE,
        match_id TEXT,
        competition TEXT,
        sport TEXT DEFAULT 'Football',
        home TEXT NOT NULL,
        away TEXT NOT NULL,
        minute_at_publication INTEGER NOT NULL,
        score_home INTEGER,
        score_away INTEGER,
        market TEXT NOT NULL,
        selection TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        consensus_votes INTEGER,
        total_agents INTEGER DEFAULT 5,
        raison TEXT,
        agents_json TEXT,
        odds REAL,
        version INTEGER DEFAULT 1,
        status TEXT DEFAULT 'published',
        published_by TEXT DEFAULT 'publication_engine',
        created_at TEXT DEFAULT (datetime('now')),
        locked INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS post_publication_analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_key TEXT NOT NULL,
        minute_at_analysis INTEGER,
        score_home INTEGER,
        score_away INTEGER,
        market TEXT,
        selection TEXT,
        confidence INTEGER,
        consensus_votes INTEGER,
        agents_json TEXT,
        raison TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (match_key) REFERENCES official_prediction_snapshots(match_key)
      );
    `);
  }

  hasSnapshot(matchKey) {
    const row = this._db.prepare("SELECT 1 FROM official_prediction_snapshots WHERE match_key = ?").get(matchKey);
    return !!row;
  }

  getSnapshot(matchKey) {
    return this._db.prepare("SELECT * FROM official_prediction_snapshots WHERE match_key = ?").get(matchKey) || null;
  }

  getAllSnapshots({ limit = 50, offset = 0, status } = {}) {
    if (status) {
      return this._db.prepare(
        "SELECT * FROM official_prediction_snapshots WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
      ).all(status, limit, offset);
    }
    return this._db.prepare(
      "SELECT * FROM official_prediction_snapshots ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).all(limit, offset);
  }

  createSnapshot(analysis, match, minute) {
    const matchKey = analysis.match_key;

    if (this.hasSnapshot(matchKey)) {
      throw new Error(`Snapshot already exists for ${matchKey} — immutable`);
    }

    const chief = (analysis.agents || []).find((a) => a.isChief) || analysis.agents?.[analysis.agents.length - 1] || {};
    const odds = analysis.confidence > 0 ? Math.min(1.95, (1 / (analysis.confidence / 100)) * 1.45) : null;

    const snapshot = {
      match_key: matchKey,
      match_id: match.id || match.fixtureId || match.sourceMatchId || null,
      competition: match.competition || match.league || "",
      sport: match.sport || "Football",
      home: match.home,
      away: match.away,
      minute_at_publication: minute,
      score_home: match.score_home ?? null,
      score_away: match.score_away ?? null,
      market: categorizeMarket(analysis.best_bet),
      selection: analysis.best_bet,
      confidence: analysis.confidence,
      consensus_votes: analysis.consensus_votes || 0,
      total_agents: analysis.total_agents || 5,
      raison: analysis.raison || chief.raison || "",
      agents_json: JSON.stringify((analysis.agents || []).map((a) => ({
        name: a.name, bet: a.bet, confidence: a.confidence,
      }))),
      odds: odds ? parseFloat(odds.toFixed(2)) : null,
      version: 1,
      status: "published",
      published_by: "publication_engine",
    };

    this._db.prepare(`
      INSERT INTO official_prediction_snapshots
        (match_key, match_id, competition, sport, home, away,
         minute_at_publication, score_home, score_away,
         market, selection, confidence, consensus_votes, total_agents,
         raison, agents_json, odds, version, status, published_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      snapshot.match_key, snapshot.match_id, snapshot.competition, snapshot.sport,
      snapshot.home, snapshot.away, snapshot.minute_at_publication,
      snapshot.score_home, snapshot.score_away,
      snapshot.market, snapshot.selection, snapshot.confidence,
      snapshot.consensus_votes, snapshot.total_agents,
      snapshot.raison, snapshot.agents_json, snapshot.odds,
      snapshot.version, snapshot.status, snapshot.published_by
    );

    return { ...snapshot, created_at: new Date().toISOString(), locked: 1 };
  }

  savePostPublicationAnalysis(analysis, match, minute) {
    const chief = (analysis.agents || []).find((a) => a.isChief) || {};
    this._db.prepare(`
      INSERT INTO post_publication_analyses
        (match_key, minute_at_analysis, score_home, score_away,
         market, selection, confidence, consensus_votes, agents_json, raison)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      analysis.match_key, minute,
      match.score_home ?? null, match.score_away ?? null,
      categorizeMarket(analysis.best_bet), analysis.best_bet,
      analysis.confidence, analysis.consensus_votes || 0,
      JSON.stringify((analysis.agents || []).map((a) => ({ name: a.name, bet: a.bet, confidence: a.confidence }))),
      analysis.raison || chief.raison || ""
    );
  }

  getPostPublicationAnalyses(matchKey) {
    return this._db.prepare(
      "SELECT * FROM post_publication_analyses WHERE match_key = ? ORDER BY created_at ASC"
    ).all(matchKey);
  }

  countSnapshots() {
    return this._db.prepare("SELECT COUNT(*) as count FROM official_prediction_snapshots").get().count;
  }
}

function categorizeMarket(bet) {
  if (!bet) return "unknown";
  const b = bet.toLowerCase();
  if (b.includes("over") || b.includes("under") || b.includes("2.5")) return "goals";
  if (b.includes("btts")) return "btts";
  if (b.includes("victoire") || b.includes("nul")) return "result";
  if (b.includes("mi-temps")) return "half_time";
  return "other";
}

module.exports = { SnapshotStore, categorizeMarket };
