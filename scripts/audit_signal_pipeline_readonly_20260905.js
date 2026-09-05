"use strict";
const http=require("http"),https=require("https"),DB=require("better-sqlite3");
function getLocal(path){return new Promise(resolve=>{const q=http.get({host:"127.0.0.1",port:3001,path,timeout:30000},r=>{let b="";r.on("data",d=>b+=d);r.on("end",()=>{try{resolve({status:r.statusCode,json:JSON.parse(b)})}catch{resolve({status:r.statusCode,json:{}})}})});q.on("error",e=>resolve({status:0,json:{error:e.message}}));q.on("timeout",()=>q.destroy())})}
function getApi(path){return new Promise(resolve=>{const q=https.get({host:"v3.football.api-sports.io",path,headers:{"x-apisports-key":process.env.API_FOOTBALL_KEY||process.env.API_SPORTS_KEY||""},timeout:30000},r=>{let b="";r.on("data",d=>b+=d);r.on("end",()=>{try{resolve({status:r.statusCode,json:JSON.parse(b)})}catch{resolve({status:r.statusCode,json:{}})}})});q.on("error",e=>resolve({status:0,json:{error:e.message}}));q.on("timeout",()=>q.destroy())})}
function parisDate(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return v.year+"-"+v.month+"-"+v.day}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\b(fc|cf|ac|sc|sv|fk|afc|club)\b/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function minute(m){const raw=m.minute??m.elapsed??m.ou25?.minute;const x=String(raw??"").match(/^(\d{1,3})(?:['’′])?$/);return x?Number(x[1]):null}
function votes(m){return Number(m.ou25?.vote_count??m.vote_count??m.consensus_votes??0)||0}
function reason(m){return m.analysis_exclusion_reason??m.block_reason??m.ou25?.block_reason??m.ou25?.reason??null}
function apiFixture(f){return {id:String(f?.fixture?.id||""),home:f?.teams?.home?.name||"",away:f?.teams?.away?.name||""}}
function liveStatus(f){return !["NS","TBD","PST","CANC","ABD","AWD","WO","SUSP","INTR","FT","AOT","AP"].includes(String(f?.fixture?.status?.short||"").toUpperCase())}
function ou25(odds){let bookmakers=0,playable=false,values=0;for(const block of odds?.response||[]){for(const bm of block.bookmakers||[]){bookmakers++;for(const bet of bm.bets||[]){if(!/goals over\/under|over\/under/i.test(String(bet.name||"")))continue;for(const val of bet.values||[]){if(!/^(over|under) 2\.5$/i.test(String(val.value||"")))continue;values++;const o=Number(val.odd);if(o>=1.3&&o<=2.1)playable=true}}}}return {bookmakers,ou25_values:values,playable}}
(async()=>{
 const [health,rules,live,history,status,direct,day]=await Promise.all([
  getLocal("/health?deep=1"),getLocal("/public-signal-rules"),getLocal("/live-matches?audit=1"),getLocal("/analysis-history?audit=1"),
  getApi("/status"),getApi("/fixtures?live=all"),getApi("/fixtures?date="+parisDate()+"&timezone=Europe%2FParis")
 ]);
 const matches=Array.isArray(live.json)?live.json:(live.json.matches||live.json.data||[]);
 const inWindow=matches.filter(m=>{const n=minute(m);return n!==null&&n>=15&&n<=45});
 const pool=[...(direct.json.response||[]),...(day.json.response||[]).filter(liveStatus)].map(apiFixture);
 const unique=new Map(pool.map(f=>[f.id,f]));
 let mapped=0,oddsQueried=0,withOu25=0,playableOdds=0;
 for(const m of inWindow.slice(0,12)){
  const found=[...unique.values()].find(f=>norm(f.home)===norm(m.home)&&norm(f.away)===norm(m.away));
  if(!found)continue;
  mapped++;
  const o=await getApi("/odds?fixture="+encodeURIComponent(found.id));
  oddsQueried++;
  const summary=ou25(o.json);
  if(summary.ou25_values>0)withOu25++;
  if(summary.playable)playableOdds++;
 }
 const reasons={};
 for(const m of inWindow){const key=String(reason(m)||"none").replace(/[0-9]+(?:[.,][0-9]+)?/g,"#").slice(0,120);reasons[key]=(reasons[key]||0)+1}
 const db=new DB("/data/tlm.db",{readonly:true});
 const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
 function count(table,timeCols){if(!tables.has(table))return null;const cols=new Set(db.prepare("PRAGMA table_info("+table+")").all().map(x=>x.name));const tc=timeCols.find(x=>cols.has(x));if(!tc)return db.prepare("SELECT count(*) n FROM "+table).get().n;return db.prepare("SELECT count(*) n FROM "+table+" WHERE datetime("+tc+")>=datetime('now','-24 hours')").get().n}
 const hist=Array.isArray(history.json)?history.json:(history.json.analyses||history.json.history||history.json.data||[]);
 const sub=status.json.response||{};
 console.log("AUDIT_JSON",JSON.stringify({
  endpoint_http:{health:health.status,rules:rules.status,live:live.status,history:history.status},
  health_ok:health.json.ok===true,
  telegram_ok:health.json.integrations?.telegram?.ok??health.json.telegram?.ok??health.json.telegram??null,
  api_football:{status_http:status.status,active:sub.subscription?.active??null,requests_current:sub.requests?.current??null,requests_limit:sub.requests?.limit_day??null,error_count:Object.keys(status.json.errors||{}).length},
  provider_counts:{direct_http:direct.status,direct_live:(direct.json.response||[]).length,direct_error_count:Object.keys(direct.json.errors||{}).length,day_http:day.status,day_total:(day.json.response||[]).length,day_live:(day.json.response||[]).filter(liveStatus).length,day_error_count:Object.keys(day.json.errors||{}).length},
  pipeline:{public_live:matches.length,in_window:inWindow.length,with_votes:inWindow.filter(m=>votes(m)>0).length,four_plus:inWindow.filter(m=>votes(m)>=4).length,api_identity:inWindow.filter(m=>m.source==="api-sports"&&(m.fixtureId||m.fixture_id||m.sourceId)).length,reason_counts:reasons,mapped_to_api:mapped,odds_queried:oddsQueried,with_ou25_odds:withOu25,playable_ou25_odds:playableOdds},
  public_history_rows:hist.length,
  db24h:{analyses:count("concile_analyses",["analysed_at","created_at"]),deliveries:count("telegram_signal_deliveries",["created_at","sent_at"]),agent_predictions:count("agent_predictions",["created_at","analysed_at"])}
 }));
})().catch(e=>{console.error("AUDIT_FAILED",e.message);process.exit(1)});
