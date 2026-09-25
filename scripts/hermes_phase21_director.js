"use strict";

const Database=require("better-sqlite3");
const db=new Database("/data/tlm.db");

const MIN_SAMPLE=20;

db.exec(`
CREATE TABLE IF NOT EXISTS hermes_improvement_proposals(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 category TEXT NOT NULL,
 hypothesis TEXT NOT NULL,
 sample_size INTEGER NOT NULL DEFAULT 0,
 current_measure TEXT,
 proposed_measure TEXT,
 estimated_impact TEXT,
 confidence_level TEXT NOT NULL DEFAULT 'LOW',
 status TEXT NOT NULL DEFAULT 'PROPOSE',
 UNIQUE(category,hypothesis,status)
);

CREATE TABLE IF NOT EXISTS hermes_daily_operations(
 day TEXT PRIMARY KEY,
 generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 analyses INTEGER DEFAULT 0,
 wins INTEGER DEFAULT 0,
 losses INTEGER DEFAULT 0,
 blocked_missing_odd INTEGER DEFAULT 0,
 shadow_resolved INTEGER DEFAULT 0,
 visitors INTEGER DEFAULT 0,
 notes TEXT
);
`);

function safe(sql,args=[]){
 try{return db.prepare(sql).all(...args)}
 catch(e){return []}
}
function one(sql,args=[]){
 try{return db.prepare(sql).get(...args)||{}}
 catch(e){return {}}
}

const today=new Intl.DateTimeFormat("en-CA",{
 timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date());

const analyses=one(`
 SELECT COUNT(*) n,
 SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
 SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses
 FROM concile_analyses
 WHERE date(analysed_at)=?
`,[today]);

const missingOdd=one(`
 SELECT COUNT(*) n
 FROM concile_analyses
 WHERE date(analysed_at)=?
 AND (
   lower(COALESCE(diffusion_block,'')) LIKE '%cote%'
   OR lower(COALESCE(diffusion_block,'')) LIKE '%odd%'
   OR lower(COALESCE(diffusion_block,'')) LIKE '%bookmaker%'
 )
 AND real_odd IS NULL
`,[today]);

const shadow=one(`
 SELECT COUNT(*) n
 FROM shadow_evals
 WHERE outcome IN ('win','loss')
 AND date(COALESCE(resolved_at,created_at))=?
`,[today]);

const visitors=one(`
 SELECT COUNT(DISTINCT ip_hash) n
 FROM page_views
 WHERE date(created_at)=?
`,[today]);

db.prepare(`
 INSERT INTO hermes_daily_operations
 (day,analyses,wins,losses,blocked_missing_odd,shadow_resolved,visitors,notes)
 VALUES(?,?,?,?,?,?,?,?)
 ON CONFLICT(day) DO UPDATE SET
 generated_at=CURRENT_TIMESTAMP,
 analyses=excluded.analyses,
 wins=excluded.wins,
 losses=excluded.losses,
 blocked_missing_odd=excluded.blocked_missing_odd,
 shadow_resolved=excluded.shadow_resolved,
 visitors=excluded.visitors,
 notes=excluded.notes
`).run(
 today,
 analyses.n||0,
 analyses.wins||0,
 analyses.losses||0,
 missingOdd.n||0,
 shadow.n||0,
 visitors.n||0,
 "Phase21 director — données réelles uniquement"
);

const markets=safe(`
 SELECT market_line,
 COUNT(*) n,
 SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins
 FROM agent_market_predictions
 WHERE outcome IN ('win','loss')
 GROUP BY market_line
 HAVING COUNT(*)>=?
`,[MIN_SAMPLE]);

for(const r of markets){
 const wr=Math.round((Number(r.wins||0)/Number(r.n))*1000)/10;

 let level="MEDIUM";
 if(r.n>=100) level="HIGH";
 else if(r.n<40) level="LOW";

 let hypothesis=null;

 if(wr>=70)
   hypothesis=`Marché ${r.market_line}: performance historique élevée à surveiller (${wr}% sur N=${r.n})`;

 if(wr<=45)
   hypothesis=`Marché ${r.market_line}: performance historique faible à surveiller (${wr}% sur N=${r.n})`;

 if(!hypothesis) continue;

 db.prepare(`
  INSERT OR IGNORE INTO hermes_improvement_proposals
  (category,hypothesis,sample_size,current_measure,
   proposed_measure,estimated_impact,confidence_level,status)
  VALUES(?,?,?,?,?,?,?,'PROPOSE')
 `).run(
   "MARKET",
   hypothesis,
   r.n,
   `winrate=${wr}%`,
   "Aucune modification automatique — revue humaine",
   "A evaluer en shadow avant toute décision",
   level
 );
}

const competitions=safe(`
 SELECT competition,
 COUNT(*) n,
 SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins
 FROM concile_analyses
 WHERE outcome IN ('win','loss')
 AND competition IS NOT NULL AND trim(competition)<>''
 GROUP BY competition
 HAVING COUNT(*)>=?
`,[MIN_SAMPLE]);

for(const r of competitions){
 const wr=Math.round((Number(r.wins||0)/Number(r.n))*1000)/10;
 if(wr>45 && wr<70) continue;

 const hypothesis=
   wr>=70
   ? `Championnat ${r.competition}: performance élevée (${wr}% sur N=${r.n})`
   : `Championnat ${r.competition}: performance faible (${wr}% sur N=${r.n})`;

 db.prepare(`
  INSERT OR IGNORE INTO hermes_improvement_proposals
  (category,hypothesis,sample_size,current_measure,
   proposed_measure,estimated_impact,confidence_level,status)
  VALUES(?,?,?,?,?,?,?,'PROPOSE')
 `).run(
   "LEAGUE",
   hypothesis,
   r.n,
   `winrate=${wr}%`,
   "Observation uniquement",
   "Tester en shadow avant changement",
   r.n>=100 ? "HIGH" : r.n>=40 ? "MEDIUM" : "LOW"
 );
}

const proposals=safe(`
 SELECT category,hypothesis,sample_size,confidence_level
 FROM hermes_improvement_proposals
 WHERE status='PROPOSE'
 ORDER BY
 CASE confidence_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
 sample_size DESC
 LIMIT 3
`);

console.log("");
console.log("🤖 HERMES — PHASE 21");
console.log(`📅 ${today}`);
console.log(`⚽ Analyses : ${analyses.n||0}`);
console.log(`✅ Gagnés : ${analyses.wins||0}`);
console.log(`❌ Perdus : ${analyses.losses||0}`);
console.log(`💰 Bloqués faute de cote exploitable : ${missingOdd.n||0}`);
console.log(`🧪 Shadow résolus : ${shadow.n||0}`);
console.log(`👥 Visiteurs : ${visitors.n||0}`);

if((missingOdd.n||0)>0){
 console.log("");
 console.log(`🟠 ALERTE COTES : ${missingOdd.n} opportunité(s) bloquée(s) aujourd'hui.`);
 console.log("Aucune cote inventée. Aucun nouvel appel IA nécessaire.");
}

console.log("");
console.log("🧠 PROPOSITIONS");
if(!proposals.length){
 console.log(`Aucune proposition suffisamment documentée (minimum N=${MIN_SAMPLE}).`);
}else{
 for(const p of proposals)
   console.log(`• [${p.confidence_level}] ${p.hypothesis}`);
}

console.log("");
console.log("🔒 Hermès n'a modifié aucune règle de production.");
console.log("🟢 Analyse terminée.");
