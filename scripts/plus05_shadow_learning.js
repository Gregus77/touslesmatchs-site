'use strict';

/**
 * Apprentissage Shadow du +0,5 but équipe favorite.
 * Aucune décision de cette table ne peut déclencher un envoi client.
 * On compare sur les mêmes fixtures : Concile 4/5, sièges individuels et Kimi Shadow.
 */
function createPlus05ShadowLearning({ db, now = () => Date.now(), log = console, minResolved = 50, minYes = 20 }) {
  function ensureSchema() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS plus05_shadow_evals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fixture_id TEXT NOT NULL,
        observed_at INTEGER NOT NULL,
        minute INTEGER,
        score_home INTEGER,
        score_away INTEGER,
        home TEXT,
        away TEXT,
        competition TEXT,
        fav_name TEXT,
        fav_side TEXT,
        odd REAL,
        risk_color TEXT,
        policy TEXT NOT NULL,
        decision TEXT NOT NULL,
        confidence REAL,
        reason TEXT,
        truth_fav_scored INTEGER,
        final_home INTEGER,
        final_away INTEGER,
        final_fav_goals INTEGER,
        resolved_at INTEGER,
        UNIQUE(fixture_id, policy)
      );
      CREATE INDEX IF NOT EXISTS idx_plus05_shadow_pending
        ON plus05_shadow_evals(resolved_at, fixture_id);
      CREATE INDEX IF NOT EXISTS idx_plus05_shadow_policy
        ON plus05_shadow_evals(policy, resolved_at);
    `);
  }

  function normalizeDecision(value) {
    if (value === true || String(value).toLowerCase() === 'yes' || String(value).toLowerCase() === 'oui') return 'yes';
    if (value === false || String(value).toLowerCase() === 'no' || String(value).toLowerCase() === 'non') return 'no';
    return 'error';
  }

  function upsert(row) {
    ensureSchema();
    const decision = normalizeDecision(row.decision);
    const existing = db.prepare('SELECT id,decision FROM plus05_shadow_evals WHERE fixture_id=? AND policy=?')
      .get(String(row.fixtureId), String(row.policy));
    if (existing && existing.decision !== 'error') return false;
    if (existing) {
      db.prepare(`UPDATE plus05_shadow_evals SET observed_at=?,minute=?,score_home=?,score_away=?,
        home=?,away=?,competition=?,fav_name=?,fav_side=?,odd=?,risk_color=?,decision=?,confidence=?,reason=?
        WHERE id=?`).run(
          Number(row.observedAt || now()), row.minute ?? null, row.scoreHome ?? null, row.scoreAway ?? null,
          row.home || '', row.away || '', row.competition || '', row.favName || '', row.favSide || '',
          Number.isFinite(Number(row.odd)) ? Number(row.odd) : null, row.riskColor || null,
          decision, Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : null,
          String(row.reason || '').slice(0, 300), existing.id
        );
      return true;
    }
    db.prepare(`INSERT INTO plus05_shadow_evals
      (fixture_id,observed_at,minute,score_home,score_away,home,away,competition,fav_name,fav_side,
       odd,risk_color,policy,decision,confidence,reason)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        String(row.fixtureId), Number(row.observedAt || now()), row.minute ?? null,
        row.scoreHome ?? null, row.scoreAway ?? null, row.home || '', row.away || '',
        row.competition || '', row.favName || '', row.favSide || '',
        Number.isFinite(Number(row.odd)) ? Number(row.odd) : null, row.riskColor || null,
        String(row.policy), decision,
        Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : null,
        String(row.reason || '').slice(0, 300)
      );
    return true;
  }

  function recordCouncil({ w, live, quote, votes, shadows = [] }) {
    ensureSchema();
    const common = {
      fixtureId: w.fixture_id,
      observedAt: now(),
      minute: live.minute,
      scoreHome: live.score_home,
      scoreAway: live.score_away,
      home: w.home,
      away: w.away,
      competition: w.competition,
      favName: w.fav_name,
      favSide: w.side,
      odd: quote?.odd,
      riskColor: w.risk_color,
    };
    const answered = (votes?.results || []).filter(r => !r.failed);
    const avg = answered.length
      ? answered.reduce((n, r) => n + (Number(r.confidence) || 0), 0) / answered.length
      : null;
    upsert({ ...common, policy: 'council_4of5', decision: Number(votes?.yes || 0) >= 4,
      confidence: avg, reason: `${votes?.yes || 0}/5 oui` });
    for (const result of votes?.results || []) {
      upsert({ ...common, policy: `seat:${result.seat}`,
        decision: result.failed ? 'error' : !!result.yes,
        confidence: result.confidence,
        reason: result.failed ? result.error : result.raison });
    }
    for (const result of shadows || []) {
      upsert({ ...common, policy: `shadow:${result.seat}`,
        decision: result.failed ? 'error' : !!result.yes,
        confidence: result.confidence,
        reason: result.failed ? result.error : result.raison });
    }
  }

  function pendingFixtureIds(limit = 30) {
    ensureSchema();
    return db.prepare(`SELECT fixture_id, MIN(observed_at) observed_at
      FROM plus05_shadow_evals
      WHERE resolved_at IS NULL AND observed_at < ?
      GROUP BY fixture_id ORDER BY observed_at ASC LIMIT ?`)
      .all(now() - 20 * 60 * 1000, Number(limit))
      .map(r => String(r.fixture_id));
  }

  function settleFixture(fixtureId, finalHome, finalAway, status = 'FT') {
    ensureSchema();
    if (['PST','CANC','ABD','AWD','WO'].includes(String(status))) {
      db.prepare(`UPDATE plus05_shadow_evals SET resolved_at=?,truth_fav_scored=NULL,
        final_home=NULL,final_away=NULL,final_fav_goals=NULL
        WHERE fixture_id=? AND resolved_at IS NULL`).run(now(), String(fixtureId));
      return { void: true };
    }
    const h = Number(finalHome), a = Number(finalAway);
    if (!Number.isFinite(h) || !Number.isFinite(a)) return { settled: 0 };
    const rows = db.prepare('SELECT id,fav_side FROM plus05_shadow_evals WHERE fixture_id=? AND resolved_at IS NULL')
      .all(String(fixtureId));
    const upd = db.prepare(`UPDATE plus05_shadow_evals SET truth_fav_scored=?,final_home=?,final_away=?,
      final_fav_goals=?,resolved_at=? WHERE id=?`);
    for (const row of rows) {
      const favGoals = row.fav_side === 'home' ? h : a;
      upd.run(favGoals > 0 ? 1 : 0, h, a, favGoals, now(), row.id);
    }
    return { settled: rows.length };
  }

  function report() {
    ensureSchema();
    const rows = db.prepare(`
      SELECT policy,
        COUNT(*) evaluated,
        SUM(decision IN ('yes','no')) responses,
        SUM(decision='yes') yes_count,
        SUM(decision='no') no_count,
        SUM(decision='error') errors,
        SUM(resolved_at IS NOT NULL AND truth_fav_scored IS NOT NULL) resolved,
        SUM(resolved_at IS NOT NULL AND truth_fav_scored IS NOT NULL
          AND ((decision='yes' AND truth_fav_scored=1) OR (decision='no' AND truth_fav_scored=0))) correct,
        SUM(resolved_at IS NOT NULL AND decision='yes' AND truth_fav_scored=1) yes_wins,
        SUM(resolved_at IS NOT NULL AND decision='yes' AND truth_fav_scored=0) yes_losses,
        ROUND(AVG(CASE WHEN decision IN ('yes','no') THEN confidence END),1) avg_confidence,
        ROUND(SUM(CASE
          WHEN resolved_at IS NOT NULL AND decision='yes' AND truth_fav_scored=1 AND odd>1 THEN odd-1
          WHEN resolved_at IS NOT NULL AND decision='yes' AND truth_fav_scored=0 THEN -1
          ELSE 0 END),3) flat_profit_units
      FROM plus05_shadow_evals
      GROUP BY policy ORDER BY policy
    `).all();

    const metrics = rows.map(r => {
      const responseRate = r.evaluated ? (100 * r.responses / r.evaluated) : 0;
      const accuracy = r.resolved ? (100 * r.correct / r.resolved) : null;
      const yesResolved = Number(r.yes_wins || 0) + Number(r.yes_losses || 0);
      const yesWinRate = yesResolved ? (100 * Number(r.yes_wins || 0) / yesResolved) : null;
      const roi = yesResolved ? (100 * Number(r.flat_profit_units || 0) / yesResolved) : null;
      return { ...r,
        response_rate_pct: Math.round(responseRate * 10) / 10,
        accuracy_pct: accuracy == null ? null : Math.round(accuracy * 10) / 10,
        yes_resolved: yesResolved,
        yes_winrate_pct: yesWinRate == null ? null : Math.round(yesWinRate * 10) / 10,
        flat_roi_pct: roi == null ? null : Math.round(roi * 10) / 10 };
    });

    const baseline = metrics.find(r => r.policy === 'council_4of5');
    const candidates = metrics.filter(r => r.policy !== 'council_4of5').map(r => {
      const enough = r.resolved >= minResolved && r.yes_resolved >= minYes && r.response_rate_pct >= 90;
      const nonInferior = enough && baseline && baseline.yes_resolved >= minYes
        && r.yes_winrate_pct != null && baseline.yes_winrate_pct != null
        && r.yes_winrate_pct >= baseline.yes_winrate_pct - 3
        && r.flat_roi_pct != null && r.flat_roi_pct > 0;
      return { policy: r.policy, enough_sample: enough, promotion_candidate: !!nonInferior };
    });
    return { minimum_resolved: minResolved, minimum_yes: minYes, automatic_switch: false,
      baseline: baseline || null, metrics, candidates };
  }

  return { ensureSchema, recordCouncil, pendingFixtureIds, settleFixture, report, upsert };
}

module.exports = { createPlus05ShadowLearning };
