'use strict';
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH || '/data/tlm.db', { readonly: true });

function one(sql, params = []) {
  try { return db.prepare(sql).get(...params); }
  catch (e) { return { unavailable: true }; }
}
function all(sql, params = []) {
  try { return db.prepare(sql).all(...params); }
  catch (e) { return []; }
}

try {
  const calls5 = one(`SELECT COUNT(*) calls, COUNT(DISTINCT match_key) matches,
    COUNT(DISTINCT request_key) unique_requests
    FROM ai_call_budget_log WHERE created_at >= datetime('now','-5 minutes')`);
  const calls30 = one(`SELECT COUNT(*) calls, COUNT(DISTINCT match_key) matches,
    COUNT(DISTINCT request_key) unique_requests
    FROM ai_call_budget_log WHERE created_at >= datetime('now','-30 minutes')`);
  const duplicateStats = one(`SELECT COUNT(*) duplicate_groups, COALESCE(MAX(n),0) max_repeats
    FROM (SELECT model_key,match_key,COUNT(*) n FROM ai_call_budget_log
      WHERE created_at >= datetime('now','-30 minutes')
      GROUP BY model_key,match_key HAVING COUNT(*) > 1)`);
  const breakers = all(`SELECT breach_type,tripped_at,
    ROUND((julianday('now')-julianday(tripped_at))*1440,1) age_minutes
    FROM ai_circuit_breaker ORDER BY tripped_at DESC`);
  const analyses = one(`SELECT COUNT(*) analyses_24h,
    SUM(CASE WHEN diffusion_block IS NULL OR diffusion_block='' THEN 1 ELSE 0 END) without_block
    FROM concile_analyses WHERE analysed_at >= datetime('now','-24 hours')`);
  const blocks = all(`SELECT COALESCE(NULLIF(diffusion_block,''),'aucun motif') reason,COUNT(*) n
    FROM concile_analyses WHERE analysed_at >= datetime('now','-24 hours')
    GROUP BY reason ORDER BY n DESC LIMIT 12`);
  console.log(JSON.stringify({
    verdict: 'READ_ONLY_AGGREGATES',
    generated_at: new Date().toISOString(),
    calls_5m: calls5,
    calls_30m: calls30,
    duplicates_30m: duplicateStats,
    breakers,
    analyses_24h: analyses,
    blocks_24h: blocks
  }, null, 2));
} finally {
  db.close();
}
