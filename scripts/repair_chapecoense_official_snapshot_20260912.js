'use strict';

const Database = require(process.env.TEST_SQLITE_MODULE || 'better-sqlite3');
const snapshots = require('./official_signal_snapshots');
const dbPath = process.env.TLM_DB_PATH || '/data/tlm.db';
const db = new Database(dbPath);
snapshots.init(db);

const snapshotId = '1492373_2026-09-12_30_0-1';
const analysisMatchKey = '1492373_2026-09-12';
const roster = ['Perplexity-Web','DeepSeek-V3','Mistral-Large','Cohere-Command','OpenRouter-Qwen'];
const rows = db.prepare(`SELECT agent_name,bet,confidence,created_at FROM agent_predictions
  WHERE match_key=? AND bet IN ('Over 2.5 buts','Under 2.5 buts') ORDER BY datetime(created_at),id`).all(snapshotId);
const byAgent = new Map(rows.map(row => [row.agent_name, row]));
const votes = roster.map(agent => {
  const row = byAgent.get(agent);
  return row ? {
    agent,
    direction: /^Over\b/.test(row.bet) ? 'over' : 'under',
    confidence: row.confidence,
    status: 'voted',
    updated_at: String(row.created_at).replace(' ', 'T') + 'Z',
  } : { agent, direction: null, confidence: null, status: 'pending', updated_at: null };
});
const over = votes.filter(vote => vote.direction === 'over').length;
const under = votes.filter(vote => vote.direction === 'under').length;
if (over !== 4 || under !== 0 || votes[3].status !== 'pending') {
  throw new Error(`Chapecoense repair evidence mismatch: over=${over} under=${under} seat4=${votes[3].status}`);
}
const analysis = db.prepare(`SELECT home,away FROM concile_analyses WHERE match_key=?`).get(analysisMatchKey);
if (!analysis || !/chapecoense/i.test(analysis.home) || !/internacional/i.test(analysis.away)) {
  throw new Error('Chapecoense analysis identity mismatch');
}
const row = snapshots.capture(db, {
  id: snapshotId,
  match: { fixtureId: 1492373, home: analysis.home, away: analysis.away },
  analysisMatchKey,
  minute: 33,
  scoreHome: 0,
  scoreAway: 1,
  redCardsHome: 0,
  redCardsAway: 0,
  votes,
  consensus: 'over',
  consensusVotes: 4,
  confidence: 75,
  realOdd: null,
  realOddSource: null,
  ruleVersion: 'legacy-ou25-pre-5-valid-votes-owner-attested-20260912',
  createdAt: '2026-09-12T20:35:00.173Z',
});
snapshots.registerOfficial(db, row.id, { legacyProof: true, createdAt: new Date().toISOString() });
snapshots.recordResult(db, row.id, 1, 2, 'owner_attested_and_score_verified', new Date().toISOString());
db.prepare(`INSERT OR IGNORE INTO vote_snapshot_events
  (fixture_scope,snapshot_id,event_type,state_key,details_json,created_at)
  VALUES (?,?,'official_registered','0-1:0-0',?,?)`).run(
    row.fixture_scope,row.id,JSON.stringify({proof:'owner_attested_existing_four_vote_snapshot',retroactive_threshold_recalculation:false}),new Date().toISOString());
console.log(JSON.stringify({ok:true,official_signal_snapshot_id:row.id,direction:'over',votes:4,seat4:'pending',minute:33,score:'0-1',outcome:'win',final_score:'1-2'}));
db.close();
