'use strict';

const OFFICIAL_FROM_MINUTE = 35;
const OFFICIAL_TO_MINUTE = 45;
const REANALYSIS_DELAY_MS = 150000;

function fixtureIdOf(match) {
  return String(match?.fixtureId ?? match?.fixture_id ?? match?.id ?? match?.sourceId ?? match?.sourceMatchId ?? '').trim();
}

function civilDay(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10);
}

function fixtureScope(match, day = civilDay()) {
  const fixture = fixtureIdOf(match);
  if (fixture) return `${fixture}:${day}`;
  return `${String(match?.home || '').trim().toLowerCase()}|${String(match?.away || '').trim().toLowerCase()}:${day}`;
}

function init(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS official_vote_snapshots (
    id TEXT PRIMARY KEY,
    fixture_scope TEXT NOT NULL,
    fixture_id TEXT,
    analysis_match_key TEXT NOT NULL,
    minute INTEGER,
    score_home INTEGER,
    score_away INTEGER,
    red_cards_home INTEGER NOT NULL DEFAULT 0,
    red_cards_away INTEGER NOT NULL DEFAULT 0,
    seat_statuses_json TEXT NOT NULL,
    directions_json TEXT NOT NULL,
    votes_json TEXT NOT NULL,
    consensus TEXT,
    consensus_votes INTEGER NOT NULL DEFAULT 0,
    confidence INTEGER,
    real_odd REAL,
    real_odd_source TEXT,
    rule_version TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_vote_snapshots_scope_created
    ON official_vote_snapshots(fixture_scope, created_at DESC);
  CREATE TABLE IF NOT EXISTS official_signal_registry (
    fixture_scope TEXT PRIMARY KEY,
    official_signal_snapshot_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    FOREIGN KEY(official_signal_snapshot_id) REFERENCES official_vote_snapshots(id)
  );
  CREATE TABLE IF NOT EXISTS vote_snapshot_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fixture_scope TEXT NOT NULL,
    snapshot_id TEXT,
    event_type TEXT NOT NULL,
    state_key TEXT,
    eligible_after INTEGER,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_vote_snapshot_event_unique
    ON vote_snapshot_events(fixture_scope, event_type, state_key);
  CREATE TABLE IF NOT EXISTS official_signal_results (
    official_signal_snapshot_id TEXT PRIMARY KEY,
    outcome TEXT NOT NULL CHECK(outcome IN ('win','loss')),
    final_score_home INTEGER NOT NULL,
    final_score_away INTEGER NOT NULL,
    result_source TEXT NOT NULL,
    resolved_at TEXT NOT NULL,
    FOREIGN KEY(official_signal_snapshot_id) REFERENCES official_vote_snapshots(id)
  );
  CREATE TRIGGER IF NOT EXISTS official_vote_snapshot_no_update BEFORE UPDATE ON official_vote_snapshots
    BEGIN SELECT RAISE(ABORT,'Official vote snapshot is immutable'); END;
  CREATE TRIGGER IF NOT EXISTS official_vote_snapshot_no_delete BEFORE DELETE ON official_vote_snapshots
    BEGIN SELECT RAISE(ABORT,'Official vote snapshot is immutable'); END;
  CREATE TRIGGER IF NOT EXISTS official_signal_registry_no_update BEFORE UPDATE ON official_signal_registry
    BEGIN SELECT RAISE(ABORT,'Official signal choice is immutable'); END;
  CREATE TRIGGER IF NOT EXISTS official_signal_registry_no_delete BEFORE DELETE ON official_signal_registry
    BEGIN SELECT RAISE(ABORT,'Official signal choice is immutable'); END;
  CREATE TRIGGER IF NOT EXISTS official_signal_result_no_update BEFORE UPDATE ON official_signal_results
    BEGIN SELECT RAISE(ABORT,'Official signal result is immutable'); END;
  CREATE TRIGGER IF NOT EXISTS official_signal_result_no_delete BEFORE DELETE ON official_signal_results
    BEGIN SELECT RAISE(ABORT,'Official signal result is immutable'); END;`);
}

function statusFor(vote) {
  if (vote?.direction === 'over' || vote?.direction === 'under') return 'voted';
  if (vote?.failed || vote?.status === 'error') return 'error';
  return vote?.status === 'unavailable' ? 'unavailable' : 'pending';
}

function capture(db, input) {
  const votes = (input.votes || []).slice(0, 5);
  while (votes.length < 5) votes.push({ status: 'pending', direction: null });
  const statuses = votes.map(statusFor);
  const directions = votes.map(v => v?.direction === 'over' || v?.direction === 'under' ? v.direction : null);
  const createdAt = input.createdAt || new Date().toISOString();
  const scope = input.fixtureScope || fixtureScope(input.match, createdAt.slice(0, 10));
  const id = String(input.id || '').trim();
  if (!id) throw new Error('snapshot id missing');
  db.prepare(`INSERT OR IGNORE INTO official_vote_snapshots
    (id,fixture_scope,fixture_id,analysis_match_key,minute,score_home,score_away,
     red_cards_home,red_cards_away,seat_statuses_json,directions_json,votes_json,
     consensus,consensus_votes,confidence,real_odd,real_odd_source,rule_version,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, scope, fixtureIdOf(input.match) || null, input.analysisMatchKey,
      input.minute ?? null, input.scoreHome ?? null, input.scoreAway ?? null,
      Number(input.redCardsHome || 0), Number(input.redCardsAway || 0),
      JSON.stringify(statuses), JSON.stringify(directions), JSON.stringify(votes),
      input.consensus || null, Number(input.consensusVotes || 0), input.confidence ?? null,
      input.realOdd ?? null, input.realOddSource || null, input.ruleVersion, createdAt
    );
  return db.prepare('SELECT * FROM official_vote_snapshots WHERE id=?').get(id);
}

function registerOfficial(db, snapshotId, options = {}) {
  const row = db.prepare('SELECT * FROM official_vote_snapshots WHERE id=?').get(snapshotId);
  if (!row) throw new Error('official snapshot missing');
  const minute = Number(row.minute);
  if (!options.legacyProof && (!Number.isFinite(minute) || minute < OFFICIAL_FROM_MINUTE || minute > OFFICIAL_TO_MINUTE)) {
    throw new Error(`official signal outside ${OFFICIAL_FROM_MINUTE}-${OFFICIAL_TO_MINUTE}`);
  }
  db.prepare(`INSERT OR IGNORE INTO official_signal_registry
    (fixture_scope,official_signal_snapshot_id,created_at) VALUES (?,?,?)`)
    .run(row.fixture_scope, row.id, options.createdAt || new Date().toISOString());
  const registered = db.prepare('SELECT official_signal_snapshot_id FROM official_signal_registry WHERE fixture_scope=?').get(row.fixture_scope);
  if (registered?.official_signal_snapshot_id !== row.id) throw new Error('official signal already frozen on another snapshot');
  return row;
}

function parseRow(row) {
  if (!row) return null;
  const votes = JSON.parse(row.votes_json || '[]');
  return {
    id: row.id,
    official_signal_snapshot_id: row.official_signal_snapshot_id || null,
    fixture_scope: row.fixture_scope,
    fixture_id: row.fixture_id,
    analysis_match_key: row.analysis_match_key,
    minute: row.minute,
    score_home: row.score_home,
    score_away: row.score_away,
    red_cards_home: row.red_cards_home,
    red_cards_away: row.red_cards_away,
    seat_statuses: JSON.parse(row.seat_statuses_json || '[]'),
    directions: JSON.parse(row.directions_json || '[]'),
    votes,
    consensus: row.consensus,
    consensus_votes: row.consensus_votes,
    confidence: row.confidence,
    real_odd: row.real_odd,
    real_odd_source: row.real_odd_source,
    rule_version: row.rule_version,
    created_at: row.created_at,
    outcome: row.outcome || null,
    final_score_home: row.final_score_home ?? null,
    final_score_away: row.final_score_away ?? null,
  };
}

function stateForMatch(db, match, day = civilDay()) {
  const scope = fixtureScope(match, day);
  const official = db.prepare(`SELECT s.*,r.official_signal_snapshot_id,res.outcome,res.final_score_home,res.final_score_away
    FROM official_signal_registry r JOIN official_vote_snapshots s ON s.id=r.official_signal_snapshot_id
    LEFT JOIN official_signal_results res ON res.official_signal_snapshot_id=s.id
    WHERE r.fixture_scope=?`).get(scope);
  if (official) return { kind: 'official', snapshot: parseRow(official) };
  const trend = db.prepare(`SELECT * FROM official_vote_snapshots
    WHERE fixture_scope=? ORDER BY datetime(created_at) DESC,rowid DESC LIMIT 1`).get(scope);
  return { kind: trend ? 'trend' : 'none', snapshot: parseRow(trend) };
}

function stateKey(match, redHome = 0, redAway = 0) {
  return `${Number(match?.score_home ?? 0)}-${Number(match?.score_away ?? 0)}:${Number(redHome || 0)}-${Number(redAway || 0)}`;
}

function reanalysisGate(db, match, redHome = 0, redAway = 0, now = Date.now()) {
  const scope = fixtureScope(match);
  if (db.prepare('SELECT 1 FROM official_signal_registry WHERE fixture_scope=?').get(scope)) return { allowed: false, reason: 'official_frozen' };
  const latest = db.prepare('SELECT * FROM official_vote_snapshots WHERE fixture_scope=? ORDER BY datetime(created_at) DESC,rowid DESC LIMIT 1').get(scope);
  if (!latest) return { allowed: true, reason: 'first_snapshot' };
  const same = Number(latest.score_home) === Number(match?.score_home ?? 0)
    && Number(latest.score_away) === Number(match?.score_away ?? 0)
    && Number(latest.red_cards_home) === Number(redHome || 0)
    && Number(latest.red_cards_away) === Number(redAway || 0);
  if (same) return { allowed: true, reason: 'same_state' };
  const key = stateKey(match, redHome, redAway);
  let event = db.prepare(`SELECT * FROM vote_snapshot_events
    WHERE fixture_scope=? AND event_type='invalidated' AND state_key=?`).get(scope, key);
  if (!event) {
    const eligible = now + REANALYSIS_DELAY_MS;
    db.prepare(`INSERT OR IGNORE INTO vote_snapshot_events
      (fixture_scope,snapshot_id,event_type,state_key,eligible_after,details_json,created_at)
      VALUES (?,?,'invalidated',?,?,?,?)`).run(scope, latest.id, key, eligible,
        JSON.stringify({ reason: 'score_or_red_card_changed' }), new Date(now).toISOString());
    event = { eligible_after: eligible };
  }
  return now >= Number(event.eligible_after)
    ? { allowed: true, reason: 'state_stable_after_delay' }
    : { allowed: false, reason: 'state_change_delay', retryAfterMs: Number(event.eligible_after) - now };
}

function resultFor(snapshot, finalHome, finalAway) {
  if (!snapshot?.consensus) return null;
  const total = Number(finalHome) + Number(finalAway);
  if (snapshot.consensus === 'over') return total > 2.5 ? 'win' : 'loss';
  if (snapshot.consensus === 'under') return total < 2.5 ? 'win' : 'loss';
  return null;
}

function recordResult(db, snapshotId, finalHome, finalAway, source = 'api_finished_match', resolvedAt = new Date().toISOString()) {
  const snapshot = parseRow(db.prepare('SELECT * FROM official_vote_snapshots WHERE id=?').get(snapshotId));
  if (!snapshot) throw new Error('official snapshot missing');
  const registered = db.prepare('SELECT 1 FROM official_signal_registry WHERE official_signal_snapshot_id=?').get(snapshotId);
  if (!registered) throw new Error('snapshot is not official');
  const outcome = resultFor(snapshot, finalHome, finalAway);
  if (!outcome) throw new Error('official result cannot be resolved');
  db.prepare(`INSERT OR IGNORE INTO official_signal_results
    (official_signal_snapshot_id,outcome,final_score_home,final_score_away,result_source,resolved_at)
    VALUES (?,?,?,?,?,?)`).run(snapshotId,outcome,Number(finalHome),Number(finalAway),source,resolvedAt);
  return db.prepare('SELECT * FROM official_signal_results WHERE official_signal_snapshot_id=?').get(snapshotId);
}

module.exports = {
  OFFICIAL_FROM_MINUTE, OFFICIAL_TO_MINUTE, REANALYSIS_DELAY_MS,
  init, fixtureScope, capture, registerOfficial, stateForMatch, reanalysisGate, resultFor, recordResult,
};
