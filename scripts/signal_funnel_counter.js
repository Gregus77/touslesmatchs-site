'use strict';
const STAGES = Object.freeze([
  'fixtures_seen','live_stats_available','minute_window_valid','first_half_confirmed',
  'votes_received','consensus_4_of_5','confidence_ge_80','real_odd_present',
  'real_odd_in_range','official_registry','site_exposed','telegram_attempted','telegram_succeeded'
]);
const DAY_MS=86400000, RETENTION_DAYS=7, STAGE_SET=new Set(STAGES);
const utcDay=(value)=>new Date(value).toISOString().slice(0,10);
function cleanKey(value){const key=String(value||'').trim();if(!key)throw new Error('Funnel event key is required');return key.slice(0,240);}
function cleanReason(value){return String(value||'unspecified').toLowerCase().replace(/[^a-z0-9_:-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,96)||'unspecified';}
function createSignalFunnelCounter({db,now=()=>Date.now()}={}){
  if(!db||typeof db.prepare!=='function')throw new Error('A better-sqlite3 database is required');
  db.exec(`
    CREATE TABLE IF NOT EXISTS signal_funnel_events(day TEXT NOT NULL,stage TEXT NOT NULL,event_key TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(day,stage,event_key));
    CREATE INDEX IF NOT EXISTS idx_signal_funnel_events_day_stage ON signal_funnel_events(day,stage);
    CREATE TABLE IF NOT EXISTS signal_funnel_rejections(day TEXT NOT NULL,event_key TEXT NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(day,event_key));
    CREATE INDEX IF NOT EXISTS idx_signal_funnel_rejections_day_reason ON signal_funnel_rejections(day,reason);
  `);
  const insertStage=db.prepare('INSERT OR IGNORE INTO signal_funnel_events(day,stage,event_key,created_at) VALUES(?,?,?,?)');
  const insertRejection=db.prepare('INSERT OR IGNORE INTO signal_funnel_rejections(day,event_key,reason,created_at) VALUES(?,?,?,?)');
  const pruneEvents=db.prepare('DELETE FROM signal_funnel_events WHERE day < ?');
  const pruneRejections=db.prepare('DELETE FROM signal_funnel_rejections WHERE day < ?');
  const stageCounts=db.prepare('SELECT day,stage,COUNT(*) count FROM signal_funnel_events WHERE day>=? GROUP BY day,stage ORDER BY day DESC,stage');
  const rejectionCounts=db.prepare('SELECT day,reason,COUNT(*) count FROM signal_funnel_rejections WHERE day>=? GROUP BY day,reason ORDER BY day DESC,reason');
  const context=()=>{const timestamp=Number(now());return{day:utcDay(timestamp),cutoff:utcDay(timestamp-(RETENTION_DAYS-1)*DAY_MS),createdAt:new Date(timestamp).toISOString()};};
  const prune=(cutoff)=>db.transaction(()=>{pruneEvents.run(cutoff);pruneRejections.run(cutoff);})();
  function recordStage(stage,eventKey){if(!STAGE_SET.has(stage))throw new Error(`Unknown funnel stage: ${stage}`);const{day,cutoff,createdAt}=context();prune(cutoff);return insertStage.run(day,stage,cleanKey(eventKey),createdAt).changes===1;}
  function recordRejection(eventKey,reason){const{day,cutoff,createdAt}=context();prune(cutoff);return insertRejection.run(day,cleanKey(eventKey),cleanReason(reason),createdAt).changes===1;}
  function recordPipeline(eventKey,passedStages=[],rejectionReason=null){const key=cleanKey(eventKey);for(const stage of [...new Set(passedStages)])recordStage(stage,key);if(rejectionReason)recordRejection(key,rejectionReason);}
  function report(requestedDays=RETENTION_DAYS){
    const keep=Math.max(1,Math.min(30,parseInt(requestedDays,10)||RETENTION_DAYS)),timestamp=Number(now());
    const retention=utcDay(timestamp-(RETENTION_DAYS-1)*DAY_MS);prune(retention);
    const cutoff=utcDay(timestamp-(Math.min(keep,RETENTION_DAYS)-1)*DAY_MS),byDay=new Map();
    const ensure=(day)=>{if(!byDay.has(day))byDay.set(day,{day,stages:Object.fromEntries(STAGES.map((stage)=>[stage,0])),rejections:{}});return byDay.get(day);};
    for(const row of stageCounts.all(cutoff))ensure(row.day).stages[row.stage]=Number(row.count);
    for(const row of rejectionCounts.all(cutoff))ensure(row.day).rejections[row.reason]=Number(row.count);
    return{ok:true,retention_days:RETENTION_DAYS,generated_at:new Date(timestamp).toISOString(),days:[...byDay.values()].sort((a,b)=>b.day.localeCompare(a.day))};
  }
  return{recordStage,recordRejection,recordPipeline,report};
}
module.exports={STAGES,createSignalFunnelCounter};