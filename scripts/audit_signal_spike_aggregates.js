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
  const callsToday = one(`SELECT COUNT(*) calls,
    COUNT(DISTINCT match_key) matches,
    ROUND(COALESCE(SUM(cost_estimate_eur),0),6) estimated_cost_eur,
    SUM(CASE WHEN status='ok' THEN 1 ELSE 0 END) recorded_ok,
    SUM(CASE WHEN status!='ok' THEN 1 ELSE 0 END) recorded_error
    FROM ai_call_budget_log WHERE date(created_at)=date('now')`);
  const callsByModel = all(`SELECT model_key,COUNT(*) calls,
    COUNT(DISTINCT match_key) matches,
    ROUND(COALESCE(SUM(cost_estimate_eur),0),6) estimated_cost_eur
    FROM ai_call_budget_log WHERE date(created_at)=date('now')
    GROUP BY model_key ORDER BY calls DESC`);
  const breakers = all(`SELECT breach_type,tripped_at,
    ROUND((julianday('now')-julianday(tripped_at))*1440,1) age_minutes
    FROM ai_circuit_breaker ORDER BY tripped_at DESC`);
  const analyses = one(`SELECT COUNT(*) analyses_24h,
    SUM(CASE WHEN diffusion_block IS NULL OR diffusion_block='' THEN 1 ELSE 0 END) without_block
    FROM concile_analyses WHERE analysed_at >= datetime('now','-24 hours')`);
  const blocks = all(`SELECT COALESCE(NULLIF(diffusion_block,''),'aucun motif') reason,COUNT(*) n
    FROM concile_analyses WHERE analysed_at >= datetime('now','-24 hours')
    GROUP BY reason ORDER BY n DESC LIMIT 12`);
  const providers = all(`SELECT host,last_status,
    CASE WHEN disabled_until > datetime('now') THEN 1 ELSE 0 END disabled_now,
    disabled_until,updated_at
    FROM provider_health ORDER BY updated_at DESC`);
  const agentCalls2h = all(`SELECT agent_name,host,COALESCE(issue,'inconnu') issue,
    COALESCE(http_status,0) http_status,COUNT(*) calls,
    SUM(CASE WHEN vote_produit=1 THEN 1 ELSE 0 END) votes,
    MAX(created_at) latest
    FROM agent_calls WHERE created_at >= datetime('now','-2 hours')
    GROUP BY agent_name,host,issue,http_status ORDER BY latest DESC`);
  const lastAgentCall = one(`SELECT MAX(created_at) latest,
    ROUND((julianday('now')-julianday(MAX(created_at)))*1440,1) age_minutes
    FROM agent_calls`);
  console.log(JSON.stringify({
    verdict: 'READ_ONLY_AGGREGATES',
    generated_at: new Date().toISOString(),
    calls_5m: calls5,
    calls_30m: calls30,
    calls_today: callsToday,
    calls_by_model_today: callsByModel,
    duplicates_30m: duplicateStats,
    breakers,
    providers,
    agent_calls_2h: agentCalls2h,
    last_agent_call: lastAgentCall,
    analyses_24h: analyses,
    blocks_24h: blocks
  }, null, 2));
} finally {
  db.close();
}
