const Database=require("better-sqlite3");
const db=new Database("/data/tlm.db");

const before=db.prepare("SELECT COUNT(*) n FROM learning_match_results").get().n;

const rows=db.prepare(`
SELECT *
FROM concile_analyses
WHERE outcome IN ('win','loss')
  AND best_bet IS NOT NULL
  AND match_key IS NOT NULL
ORDER BY resolved_at
`).all();

const exists=db.prepare("SELECT 1 FROM learning_match_results WHERE match_key=?");

const insert=db.prepare(`
INSERT INTO learning_match_results
(match_key,home,away,competition,sport,predicted_bet,predicted_confidence,
 predicted_odds,final_score_home,final_score_away,outcome,agents_json,
 agent_outcomes_json,snapshot_id,evaluated_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`);

let added=0, skipped=0;

const tx=db.transaction(()=>{
 for(const r of rows){
   if(exists.get(r.match_key)){ skipped++; continue; }

   let agents=[];
   try { agents=JSON.parse(r.agents_json||"[]"); }
   catch { agents=[]; }

   const agentOutcomes=agents.map(a=>({
     name:a.name||a.agent||a.model||"",
     bet:a.bet||a.vote||"",
     confidence:Number(a.confidence||0)
   }));

   insert.run(
     r.match_key,
     r.home||"",
     r.away||"",
     r.competition||"",
     r.sport||"Football",
     r.best_bet,
     Number(r.confidence||0),
     r.real_odd==null ? null : Number(r.real_odd),
     r.final_score_home,
     r.final_score_away,
     r.outcome,
     r.agents_json||"[]",
     JSON.stringify(agentOutcomes),
     r.id,
     r.resolved_at||new Date().toISOString()
   );

   added++;
 }
});

tx();

const after=db.prepare("SELECT COUNT(*) n FROM learning_match_results").get().n;

console.log("🟢 LEARNING SAFE");
console.log("AVANT =",before);
console.log("AJOUTES =",added);
console.log("IGNORES =",skipped);
console.log("APRES =",after);
console.log("🟢 Aucun poids IA modifié");
console.log("🟢 Aucun championnat exclu");
console.log("🟢 Aucune règle sportive modifiée");
console.log("🟢 Aucun appel OpenRouter");

db.close();
