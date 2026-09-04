'use strict';
const DAY = '2026-09-04';
function normalized(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function isTarget(home, away) {
  return ['lyon','olympique lyonnais'].includes(normalized(home))
    && ['auxerre','aj auxerre'].includes(normalized(away));
}
function officialResult(data) {
  if (!data || (data.errors && Object.keys(data.errors).length)) throw new Error('Source officielle indisponible');
  const fixtures=(data.response || []).filter(f =>
    String(f.fixture?.date || '').slice(0,10) === DAY
    && isTarget(f.teams?.home?.name,f.teams?.away?.name)
    && f.league?.country === 'France' && f.league?.name === 'Ligue 1');
  if (fixtures.length !== 1) throw new Error('Fixture officielle unique introuvable');
  const f=fixtures[0],h=f.goals?.home,a=f.goals?.away;
  if (f.fixture.status?.short !== 'FT' || !Number.isInteger(h) || h < 0 || !Number.isInteger(a) || a < 0)
    throw new Error('Score final FT non confirmé');
  return {home:h,away:a,fixture:f.fixture.id};
}
function outcome(bet, result) {
  if (!/^(Over|Under) 2[.,]5 buts$/i.test(String(bet || ''))) return null;
  const over=result.home+result.away>2.5;
  return (/^Over/i.test(bet) ? over : !over) ? 'win' : 'loss';
}
async function main() {
  const Database=require('better-sqlite3'),path=require('path');
  const db=new Database(process.env.DB_PATH || '/data/tlm.db');
  try {
    const rows=db.prepare('SELECT * FROM concile_analyses WHERE date(analysed_at)=? AND final_score_home=5 AND final_score_away=2')
      .all(DAY).filter(r=>isTarget(r.home,r.away));
    if (!rows.length) { console.log('LYON: aucune ligne 5-2 à corriger'); return; }
    const key=process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY;
    if (!key) throw new Error('Clé API-Football absente');
    const response=await fetch('https://v3.football.api-sports.io/fixtures?date='+DAY,
      {headers:{'x-apisports-key':key},signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Source officielle HTTP '+response.status);
    const result=officialResult(await response.json());
    const changes=rows.map(row=>({row,out:outcome(row.best_bet,result)}));
    if (changes.some(c=>!c.out)) throw new Error('Marché inattendu : aucune modification');
    const backup=path.join(path.dirname(db.name),'tlm-before-score-repair-'+Date.now()+'.db');
    await db.backup(backup);
    require('fs').chmodSync(backup,0o600);
    db.exec(`CREATE TABLE IF NOT EXISTS result_repair_audit (
      id INTEGER PRIMARY KEY, repaired_at TEXT DEFAULT (datetime('now')),
      table_name TEXT, row_id TEXT, before_json TEXT, fixture_id TEXT);`);
    const record=db.prepare('INSERT INTO result_repair_audit(table_name,row_id,before_json,fixture_id) VALUES(?,?,?,?)');
    const update=db.prepare(`UPDATE concile_analyses SET outcome=?,final_score_home=?,final_score_away=?,
      resolved_at=datetime('now'),result_source='api_fixture_exact_date'
      WHERE id=? AND final_score_home=5 AND final_score_away=2`);
    db.transaction(()=>{
      for(const {row,out} of changes){
        record.run('concile_analyses',row.id,JSON.stringify(row),String(result.fixture));
        if(update.run(out,result.home,result.away,row.id).changes!==1)throw new Error('Ligne modifiée pendant la réparation');
      }
      const columns=db.prepare('PRAGMA table_info(daily_pick_log)').all().map(c=>c.name);
      if (['date','home','away','bet','outcome','final_score_home','final_score_away'].every(c=>columns.includes(c))) {
        const picks=db.prepare('SELECT * FROM daily_pick_log WHERE date=? AND final_score_home=5 AND final_score_away=2').all(DAY).filter(r=>isTarget(r.home,r.away));
        for(const row of picks){
          const out=outcome(row.bet,result); if(!out)continue;
          record.run('daily_pick_log',row.date,JSON.stringify(row),String(result.fixture));
          db.prepare('UPDATE daily_pick_log SET outcome=?,final_score_home=?,final_score_away=? WHERE date=?')
            .run(out,result.home,result.away,row.date);
        }
      }
    })();
    const verified=db.prepare('SELECT id,outcome,final_score_home,final_score_away,result_source FROM concile_analyses WHERE id=?');
    console.log(JSON.stringify({score_repair:'OK',fixture:result.fixture,score:result.home+'-'+result.away,
      rows:rows.map(r=>verified.get(r.id)),backup,telegram_messages_sent:0}));
  } finally { db.close(); }
}
module.exports={officialResult,outcome,isTarget};
if(require.main===module) main().catch(e=>{console.error('LYON PARTIAL: '+e.message);process.exitCode=2;});
