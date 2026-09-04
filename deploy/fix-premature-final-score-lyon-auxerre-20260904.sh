#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="/opt/touslesmatchs"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/opt/backups/tlm-premature-final-${STAMP}"
API_FILE="$ROOT/scripts/api_server.js"
cd "$ROOT"
mkdir -p "$BACKUP"
cp -a "$API_FILE" "$BACKUP/api_server.js"
chmod 700 "$BACKUP"
printf '[baseline] branch=%s head=%s upstream=%s\n' "$(git branch --show-current)" "$(git rev-parse HEAD)" "$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null || echo NONE)"
git status --short --branch
docker compose ps
rollback_code(){ printf '%s\n' "[rollback] restauration du source API"; cp -a "$BACKUP/api_server.js" "$API_FILE"; docker compose up -d --build api >/dev/null; }
trap rollback_code ERR

node <<'NODE'
"use strict";
const fs=require("fs"), p="/opt/touslesmatchs/scripts/api_server.js";
let s=fs.readFileSync(p,"utf8");
if(s.includes("function findUniqueFinishedMatchForStale(stale, finished)")){ console.log("[patch] garde-fou déjà présent"); process.exit(0); }
const marker="let staleResolveRunning = false;\nasync function resolveStalePredictions() {";
const helper=`// Verrou de résolution : un score terminé ne peut être associé qu'à une analyse
// du même jour calendaire et aux deux mêmes équipes. Sans ce garde-fou, le
// rattrapage pouvait confondre Lyon avec Lens et attribuer le 5-2 de
// Lens-Auxerre (22/08/2026) au Lyon-Auxerre du 04/09/2026.
function finalMatchDay(match) {
  const raw = match?.utcDate || match?.date || match?.kickoff || match?.analysed_at || "";
  return String(raw).slice(0, 10);
}
function findUniqueFinishedMatchForStale(stale, finished) {
  const day = String(stale?.day || "").slice(0, 10);
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(day)) return null;
  const sport = String(stale?.sport || "Football");
  const direct = (finished || []).filter((candidate) => {
    if (finalMatchDay(candidate) !== day) return false;
    if (String(candidate?.sport || sport) !== sport) return false;
    return sameLiveTeamName(stale?.home, candidate?.home) && sameLiveTeamName(stale?.away, candidate?.away);
  });
  if (direct.length === 1) return { match: direct[0], reversed: false };
  if (direct.length > 1) return null;
  const reversed = (finished || []).filter((candidate) => {
    if (finalMatchDay(candidate) !== day) return false;
    if (String(candidate?.sport || sport) !== sport) return false;
    return sameLiveTeamName(stale?.home, candidate?.away) && sameLiveTeamName(stale?.away, candidate?.home);
  });
  return reversed.length === 1 ? { match: reversed[0], reversed: true } : null;
}
let staleResolveRunning = false;
async function resolveStalePredictions() {`;
if(!s.includes(marker)) throw new Error("ancre resolveStalePredictions absente");
s=s.replace(marker,helper);
const oldKey='const k = \`${r.home}|${r.away}\`;';
const newKey='const k = \`${r.home}|${r.away}|${r.day || ""}|${r.sport || "Football"}\`;';
if(!s.includes(oldKey)) throw new Error("ancre dédoublonnage absente");
s=s.replace(oldKey,newKey);
const start=`      const hw = matchToken(s.home);
      const aw = matchToken(s.away);
      if (!hw || !aw) continue;`;
const end=`        resolvedMatches++;
      }
    }
    if (resolvedMatches) {`;
const a=s.indexOf(start), b=s.indexOf(end,a);
if(a<0||b<0) throw new Error("bloc de rapprochement historique absent");
const safe=`      const resolvedMatch = findUniqueFinishedMatchForStale(s, finished);
      if (!resolvedMatch) {
        console.warn(\`[catch-up] aucune correspondance finale unique et datée: \${s.home} vs \${s.away} (\${s.day || "date inconnue"})\`);
        continue;
      }
      const m = resolvedMatch.match;
      const reversed = resolvedMatch.reversed;
      autoResolvePredictions({
        home: s.home, away: s.away,
        score_home: reversed ? m.score_away : m.score_home,
        score_away: reversed ? m.score_home : m.score_away,
        ht_home: reversed ? m.ht_away : m.ht_home,
        ht_away: reversed ? m.ht_home : m.ht_away,
        status: "FINISHED",
      });
      resolvedMatches++;
    }
    if (resolvedMatches) {`;
s=s.slice(0,a)+safe+s.slice(b+end.length);
s=s.replace("score_home: g.scores.home.total, score_away: g.scores.away.total,\n                });","score_home: g.scores.home.total, score_away: g.scores.away.total,\n                  utcDate: date, sport: \"Basketball\",\n                });");
s=s.replace("score_home: g.scores.home, score_away: g.scores.away,\n                });","score_home: g.scores.home, score_away: g.scores.away,\n                  utcDate: date, sport: \"Hockey\",\n                });");
s=s.replace("score_home: sh, score_away: sa,\n                });","score_home: sh, score_away: sa,\n                  utcDate: date, sport: \"Baseball\",\n                });");
fs.writeFileSync(p,s);
console.log("[patch] résolution datée et stricte appliquée");
NODE

node --check "$API_FILE"
node scripts/test_stale_result_resolution_date_guard.js
docker compose up -d --build api
sleep 3
docker compose ps api
docker exec touslesmatchs-api node --check /app/server.js
docker exec touslesmatchs-api grep -q "findUniqueFinishedMatchForStale" /app/server.js
curl -fsS --max-time 15 http://127.0.0.1:3001/health >/dev/null
trap - ERR

docker exec -i touslesmatchs-api node <<'NODE'
"use strict";
const https=require("https"), Database=require("better-sqlite3");
const db=new Database(process.env.DB_PATH||"/data/tlm.db");
const today=new Date().toISOString().slice(0,10);
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function apiGet(path,headers={}){
 return new Promise((resolve,reject)=>{
  const q=https.request({hostname:"v3.football.api-sports.io",path,headers,timeout:15000},r=>{let b="";r.on("data",d=>b+=d);r.on("end",()=>{try{resolve({status:r.statusCode,json:JSON.parse(b)})}catch{reject(new Error("réponse API-Football illisible"))}})});
  q.on("error",reject);q.on("timeout",()=>q.destroy(new Error("timeout API-Football")));q.end();
 });
}
function send(chatId,text){
 return new Promise(resolve=>{
  const body=JSON.stringify({chat_id:chatId,text,parse_mode:"HTML",disable_web_page_preview:true});
  const q=https.request({hostname:"api.telegram.org",path:"/bot"+process.env.TELEGRAM_BOT_TOKEN+"/sendMessage",method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)},timeout:15000},r=>{let b="";r.on("data",d=>b+=d);r.on("end",()=>{try{const j=JSON.parse(b);resolve({ok:j.ok===true,message_id:j?.result?.message_id||null,error:j?.description||null})}catch{resolve({ok:false,message_id:null,error:"réponse illisible"})}})});
  q.on("error",e=>resolve({ok:false,message_id:null,error:e.message}));q.on("timeout",()=>q.destroy());q.write(body);q.end();
 });
}
function outcome(bet,h,a){const t=Number(h)+Number(a),v=norm(bet);if(/over|plus de/.test(v)&&/2[.,]5/.test(v))return t>2.5?"win":"loss";if(/under|moins de/.test(v)&&/2[.,]5/.test(v))return t<2.5?"win":"loss";return null}
(async()=>{
 const key=process.env.API_FOOTBALL_KEY||process.env.API_SPORTS_KEY;
 if(!key)throw new Error("clé API-Football absente du conteneur");
 const rows=db.prepare("SELECT * FROM concile_analyses WHERE date(analysed_at)=? AND lower(home) LIKE '%lyon%' AND lower(away) LIKE '%auxerre%'").all(today);
 if(!rows.length)throw new Error("analyse Lyon-Auxerre du jour introuvable");
 await db.backup("/data/tlm-before-lyon-result-fix-"+Date.now()+".db");
 const response=await apiGet("/fixtures?date="+today,{"x-apisports-key":key});
 if(response.status!==200)throw new Error("API-Football HTTP "+response.status);
 const fixtures=(response.json.response||[]).filter(f=>norm(f?.teams?.home?.name).includes("lyon")&&norm(f?.teams?.away?.name).includes("auxerre")&&norm(f?.league?.name).includes("ligue 1"));
 if(fixtures.length!==1)throw new Error("fixture Lyon-Auxerre unique introuvable: "+fixtures.length);
 const fixture=fixtures[0], status=String(fixture?.fixture?.status?.short||""), h=Number(fixture?.goals?.home), a=Number(fixture?.goals?.away);
 if(!Number.isFinite(h)||!Number.isFinite(a))throw new Error("score officiel indisponible");
 const wrong=rows.filter(r=>Number(r.final_score_home)===5&&Number(r.final_score_away)===2);
 if(!wrong.length){console.log(JSON.stringify({verdict:"PARTIAL",reason:"aucune ligne 5-2 à corriger",official_status:status,official_score:h+"-"+a}));return}
 const keys=wrong.map(r=>r.match_key);
 const channels=db.prepare(`SELECT DISTINCT channel FROM telegram_signal_deliveries WHERE ok=1 AND telegram_message_id IS NOT NULL AND match_key IN (${keys.map(()=>"?").join(",")})`).all(...keys).map(r=>r.channel);
 const finished=["FT","AET","PEN"].includes(status);
 db.transaction(()=>{
  for(const r of rows){
   if(finished)db.prepare("UPDATE concile_analyses SET outcome=?,final_score_home=?,final_score_away=?,resolved_at=datetime('now'),result_source='api_fixture_exact_date' WHERE id=?").run(outcome(r.best_bet,h,a),h,a,r.id);
   else db.prepare("UPDATE concile_analyses SET outcome=NULL,final_score_home=NULL,final_score_away=NULL,resolved_at=NULL,result_source=NULL WHERE id=?").run(r.id);
  }
  for(const table of ["agent_predictions","agent_market_predictions","shadow_evals"]){try{db.prepare(`UPDATE ${table} SET outcome=NULL WHERE date(created_at)=? AND lower(home) LIKE '%lyon%' AND lower(away) LIKE '%auxerre%'`).run(today)}catch{}}
  try{db.prepare("UPDATE daily_pick_log SET outcome=?,final_score_home=?,final_score_away=? WHERE date=? AND lower(home) LIKE '%lyon%' AND lower(away) LIKE '%auxerre%'").run(finished?outcome(rows[0].best_bet,h,a):null,finished?h:null,finished?a:null,today)}catch{}
 })();
 const state=finished?`terminé, score officiel <b>${h}-${a}</b>`:`encore en cours (<b>${status}</b>), score officiel <b>${h}-${a}</b>`;
 const text=["⚠️ <b>CORRECTION — LYON vs AUXERRE</b>","","Le score final 5-2 publié précédemment était erroné : il appartenait à Lens–Auxerre du 22 août.","Lyon–Auxerre est "+state+".",finished?"Le résultat a été recalculé depuis la fixture officielle.":"Le résultat reste en attente jusqu'au statut officiel FT.","","Le signal Plus de 2,5 est déjà atteint, mais aucun score ne sera désormais présenté comme final avant la fin officielle."].join("\n");
 const ids={free:process.env.TELEGRAM_CHANNEL_ID,standard:process.env.TELEGRAM_STANDARD_CHANNEL_ID,premium:process.env.TELEGRAM_PREMIUM_CHANNEL_ID,elite:process.env.TELEGRAM_ELITE_CHANNEL_ID};
 const targets=[...new Set(channels.map(c=>ids[c]).filter(Boolean))], sends=[];
 for(const id of targets)sends.push(await send(id,text));
 const corrected=db.prepare("SELECT id,outcome,final_score_home,final_score_away,resolved_at,result_source FROM concile_analyses WHERE date(analysed_at)=? AND lower(home) LIKE '%lyon%' AND lower(away) LIKE '%auxerre%'").all(today);
 console.log(JSON.stringify({verdict:sends.length&&sends.every(x=>x.ok)?"OK":"PARTIAL",cause:"Lens-Auxerre 5-2 associé à tort par rapprochement flou sans date",official_status:status,official_score:h+"-"+a,corrected_rows:corrected,telegram_channels:channels,telegram_results:sends},null,2));
})().catch(e=>{console.error(JSON.stringify({verdict:"FAILED",error:e.message}));process.exitCode=1}).finally(()=>db.close());
NODE

curl -fsS --max-time 15 "https://www.touslesmatchs.com/api/health?fix=${STAMP}" >/dev/null
printf '%s\n' "OK — résolveur protégé; base corrigée; sauvegarde=$BACKUP"
