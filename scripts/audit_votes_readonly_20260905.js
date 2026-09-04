'use strict';
const Database=require('better-sqlite3');
const db=new Database(process.env.DB_PATH || '/data/tlm.db',{readonly:true});
async function main(){
  const budget=db.prepare(`SELECT model_key,status,COUNT(*) n,MAX(created_at) latest,
    SUM(cost_estimate_eur) cost_eur FROM ai_call_budget_log
    WHERE date(created_at)=date('now') GROUP BY model_key,status`).all();
  const breakers=db.prepare('SELECT breach_type,tripped_at FROM ai_circuit_breaker').all();
  const settings={};
  for(const k of ['AUTO_CONCILE_OBSERVER','AUTO_CONCILE_MAX_MATCHES','OPENROUTER_DAILY_BUDGET_EUR',
    'OPENROUTER_MAX_REQUESTS_PER_DAY','OPENROUTER_MAX_MATCHES_PER_DAY',
    'OPENROUTER_MAX_REQUESTS_PER_MODEL_PER_DAY','OPENROUTER_HARD_STOP'])
    settings[k]=process.env[k] ?? '(default)';
  const agents=db.prepare(`SELECT agent_name,market_line,COUNT(*) n,MAX(created_at) latest
    FROM agent_market_predictions WHERE created_at>=datetime('now','-24 hours')
    GROUP BY agent_name,market_line`).all();
  const blocks=db.prepare(`SELECT COALESCE(diffusion_block,'aucun motif') reason,COUNT(*) n
    FROM concile_analyses WHERE analysed_at>=datetime('now','-24 hours')
    GROUP BY diffusion_block ORDER BY n DESC LIMIT 12`).all();
  const recent=db.prepare(`SELECT home,away,analysed_at,source_type,
    json_array_length(CASE WHEN json_valid(agents_json) THEN agents_json ELSE '[]' END) agents
    FROM concile_analyses ORDER BY id DESC LIMIT 6`).all();
  const r=await fetch('http://127.0.0.1:3001/live-matches',{signal:AbortSignal.timeout(25000)});
  const d=await r.json();
  console.log(JSON.stringify({verdict:'AUDIT',budget,breakers,settings,agents_24h:agents,blocks_24h:blocks,recent,
    live:(d.matches||[]).map(m=>({home:m.home,away:m.away,minute:m.minute,
      block:m.block_reason,exclusion:m.analysis_exclusion_reason,votes:m.ou25}))},null,2));
}
main().catch(e=>{console.error('AUDIT PARTIAL: '+e.message);process.exitCode=2;}).finally(()=>db.close());
