'use strict';
// Approved research scope: top two domestic divisions, kept separate.
const SCOPE = {
 France:[['Ligue 1'],['Ligue 2']], England:[['Premier League'],['Championship']],
 Spain:[['La Liga'],['Segunda División','Segunda Division','La Liga 2']],
 Germany:[['Bundesliga'],['2. Bundesliga']], Italy:[['Serie A'],['Serie B']],
 Netherlands:[['Eredivisie'],['Eerste Divisie']], Belgium:[['Jupiler Pro League','First Division A'],['Challenger Pro League','First Division B']],
 Portugal:[['Primeira Liga'],['Segunda Liga','Liga Portugal 2']],
 Brazil:[['Serie A'],['Serie B']], Argentina:[['Liga Profesional Argentina','Primera Division'],['Primera Nacional']],
 Denmark:[['Superliga'],['1. Division']], Australia:[['A-League','A-League Men'],['Australian Championship']],
 Ireland:[['Premier Division'],['First Division']], Turkey:[['Süper Lig','Super Lig'],['1. Lig']],
 Mexico:[['Liga MX'],['Liga de Expansión MX','Liga de Expansion MX']], Japan:[['J1 League'],['J2 League']],
 'South-Korea':[['K League 1'],['K League 2']], China:[['Super League'],['League One']],
 'Saudi-Arabia':[['Pro League'],['Division 1']], 'United-Arab-Emirates':[['Pro League'],['Division 1']],
 Qatar:[['Stars League'],['Second Division']]
};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
function summarizeStandings(data){
 const groups=data?.response?.[0]?.league?.standings;
 if(!Array.isArray(groups)||!groups.length)return null;
 const rows=[];
 for(const group of groups){
  if(!Array.isArray(group))continue;
  for(const r of group){
   if(!r.team?.id||!Number.isInteger(r.rank)||r.rank<1||r.rank>group.length)continue;
   rows.push({teamId:r.team.id,name:r.team.name,group:r.group||'table',rank:r.rank,teams:group.length,
    percentile:group.length>1?(group.length-r.rank)/(group.length-1):null,
    points:r.points,played:r.all?.played,goalsFor:r.all?.goals?.for,goalsAgainst:r.all?.goals?.against});
  }
 }
 return rows.length?rows:null;
}
function summarizeFixtures(data){
 if(!Array.isArray(data?.response)||!data.response.length)return null;
 const teams={},seen=new Set(),results=[];let finals=0,unresolved=0;
 for(const f of data.response){
  if(!f.fixture?.id||seen.has(f.fixture.id))continue;seen.add(f.fixture.id);
  // Only regulation-time finished league games: no assumed 0-0 or ET totals.
  if(f.fixture.status?.short!=='FT'||!Number.isInteger(f.goals?.home)||!Number.isInteger(f.goals?.away)){unresolved++;continue;}
  const h=f.goals.home,a=f.goals.away;if(h<0||a<0||!f.teams?.home?.id||!f.teams?.away?.id){unresolved++;continue;}
  finals++;results.push({id:f.fixture.id,date:f.fixture.date||null,homeId:f.teams.home.id,awayId:f.teams.away.id,home:h,away:a});
  for(const side of ['home','away']){
   const t=f.teams[side],gf=side==='home'?h:a,ga=side==='home'?a:h;
   const r=teams[t.id]||(teams[t.id]={teamId:t.id,name:t.name,played:0,gf:0,ga:0,wins:0,draws:0,losses:0,over25:0,btts:0,over05:0,scored05:0,home:{played:0,gf:0,ga:0},away:{played:0,gf:0,ga:0}});
   r.played++;r.gf+=gf;r.ga+=ga;r[gf>ga?'wins':gf===ga?'draws':'losses']++;
   r.over25+=h+a>2.5?1:0;r.btts+=h>0&&a>0?1:0;r.over05+=h+a>0.5?1:0;r.scored05+=gf>0?1:0;
   r[side].played++;r[side].gf+=gf;r[side].ga+=ga;
  }
 }
 return finals?{finals,unresolved,results,teams:Object.values(teams).map(r=>({...r,gfPerMatch:r.gf/r.played,gaPerMatch:r.ga/r.played,over25Rate:r.over25/r.played,under25Rate:1-r.over25/r.played,bttsRate:r.btts/r.played,over05Rate:r.over05/r.played,teamOver05Rate:r.scored05/r.played}))}:null;
}
function create(db,{request,reserve,now=()=>new Date()}){
 db.exec(`CREATE TABLE IF NOT EXISTS long_history_catalog(country TEXT,division INTEGER,league_id INTEGER,name TEXT,seasons_json TEXT,status TEXT,checked_at TEXT,PRIMARY KEY(country,division));
 CREATE TABLE IF NOT EXISTS long_history_data(league_id INTEGER,season INTEGER,kind TEXT,status TEXT,payload TEXT,source TEXT,fetched_at TEXT,retry_at TEXT,PRIMARY KEY(league_id,season,kind));
 CREATE TABLE IF NOT EXISTS long_history_worker(id INTEGER PRIMARY KEY CHECK(id=1),last_attempt TEXT,last_status TEXT);`);
 for(const [country,divisions] of Object.entries(SCOPE))for(let i=0;i<divisions.length;i++)db.prepare('INSERT OR IGNORE INTO long_history_catalog(country,division,status) VALUES(?,?,?)').run(country,i+1,'pending_catalog');
 let running=false;
 const stamp=()=>now().toISOString();
 function windows(seasons){
  const started=seasons.filter(s=>s.start&&Date.parse(s.start)<=now().getTime()).sort((a,b)=>b.year-a.year);
  if(!started.length)return [];
  const current=started[0].year;
  return Array.from({length:6},(_,i)=>({year:current-i,metadata:seasons.find(s=>s.year===current-i),current:i===0}));
 }
 function coverage(){return db.prepare('SELECT * FROM long_history_catalog ORDER BY country,division').all().map(c=>{
  const seasons=c.seasons_json?JSON.parse(c.seasons_json):[];
  const years=windows(seasons).map(w=>{
   const parts=db.prepare('SELECT kind,status,fetched_at,payload FROM long_history_data WHERE league_id=? AND season=?').all(c.league_id,w.year);
   const tables=parts.find(p=>p.kind==='standings'),fixtures=parts.find(p=>p.kind==='fixtures');
   const ranks=tables?.payload?JSON.parse(tables.payload):[],games=fixtures?.payload?JSON.parse(fixtures.payload):null;
   const unique=new Set(ranks.map(r=>r.teamId));
   const reconciled=!!games&&ranks.length>0&&unique.size===ranks.length&&ranks.every(r=>games.teams.some(t=>Number(t.teamId)===Number(r.teamId)&&t.played===r.played));
   return {season:w.year,current:w.current,available:!!w.metadata,parts:parts.map(({payload,...p})=>p),
    complete:parts.length===2&&parts.every(p=>p.status==='ok')&&games?.unresolved===0&&reconciled};
  });
  return {country:c.country,division:c.division,league_id:c.league_id,name:c.name,status:c.status,years,
   five_seasons_complete:years.filter(y=>!y.current&&y.complete).length===5};
 });}
 async function fetchData(path){
  if(!reserve())throw new Error('budget_reserved_for_live');
  const d=await request(path);
  if(d?.errors&&Object.keys(d.errors).length)throw new Error('provider_error');
  if(d?.paging&&Number(d.paging.total)>1)throw new Error('pagination_incomplete');
  return d;
 }
 async function step(){
  if(running)return;running=true;
  try{
   db.prepare('INSERT INTO long_history_worker VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET last_attempt=excluded.last_attempt,last_status=excluded.last_status').run(stamp(),'checking');
   const catalog=db.prepare("SELECT * FROM long_history_catalog WHERE status='pending_catalog' OR checked_at < datetime('now','-7 days') ORDER BY checked_at,country,division LIMIT 1").get();
   if(catalog){
    const d=await fetchData('/leagues?country='+encodeURIComponent(catalog.country));
    for(let i=0;i<SCOPE[catalog.country].length;i++){
     const names=SCOPE[catalog.country][i].map(norm);
     const matches=(d.response||[]).filter(x=>x.league?.type==='League'&&norm(x.country?.name)===norm(catalog.country)&&names.includes(norm(x.league.name)));
     const m=matches.length===1?matches[0]:null;
     db.prepare('UPDATE long_history_catalog SET league_id=?,name=?,seasons_json=?,status=?,checked_at=? WHERE country=? AND division=?').run(m?.league.id||null,m?.league.name||null,JSON.stringify(m?.seasons||[]),m?'identified':matches.length?'ambiguous':'not_found',stamp(),catalog.country,i+1);
    }
    return;
   }
   const jobs=[];
   for(const c of db.prepare("SELECT * FROM long_history_catalog WHERE status='identified'").all())for(const w of windows(JSON.parse(c.seasons_json))){
    for(const kind of ['standings','fixtures']){
     const old=db.prepare('SELECT * FROM long_history_data WHERE league_id=? AND season=? AND kind=?').get(c.league_id,w.year,kind);
     if(old&&old.status!=='season_unavailable'&&old.retry_at>stamp())continue;
     if(old?.status==='ok'&&!w.current)continue;
     if(!w.metadata){
      db.prepare('INSERT OR IGNORE INTO long_history_data VALUES(?,?,?,?,?,?,?,?)').run(c.league_id,w.year,kind,'season_unavailable',null,'api-sports',stamp(),'9999');continue;
     }
     jobs.push({c,w,kind});
    }
   }
   // Interleave leagues by season/kind, so one league never monopolizes collection.
   jobs.sort((a,b)=>b.w.year-a.w.year||a.kind.localeCompare(b.kind)||a.c.league_id-b.c.league_id);
   const job=jobs[0];if(!job)return;
   const {c,w,kind}=job,path='/'+kind+'?league='+c.league_id+'&season='+w.year;
   const d=await fetchData(path);
   if((d.response||[]).some(r=>Number(r.league?.id)!==Number(c.league_id)||Number(r.league?.season)!==Number(w.year)))throw new Error('provider_identity_mismatch');
   const payload=kind==='standings'?summarizeStandings(d):summarizeFixtures(d);
   const retry=new Date(now().getTime()+(payload?(w.current?86400000:365*86400000):7*86400000)).toISOString();
   db.prepare('INSERT INTO long_history_data VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(league_id,season,kind) DO UPDATE SET status=excluded.status,payload=excluded.payload,source=excluded.source,fetched_at=excluded.fetched_at,retry_at=excluded.retry_at').run(c.league_id,w.year,kind,payload?'ok':'no_data',payload?JSON.stringify(payload):null,'https://v3.football.api-sports.io'+path,stamp(),retry);
   db.prepare('UPDATE long_history_worker SET last_status=? WHERE id=1').run(payload?'stored':'no_data');
  }catch(e){db.prepare('UPDATE long_history_worker SET last_status=? WHERE id=1').run(['budget_reserved_for_live','pagination_incomplete','provider_error'].includes(e.message)?e.message:'collection_error');}
  finally{running=false;}
 }
 function teamHistory(teamId,country){
  if(!teamId||!country)return null;
  const entries=[];
  for(const c of db.prepare("SELECT * FROM long_history_catalog WHERE country=? AND status='identified'").all(country))for(const w of windows(JSON.parse(c.seasons_json))){
   const rows=db.prepare("SELECT kind,payload FROM long_history_data WHERE league_id=? AND season=? AND status='ok'").all(c.league_id,w.year);
   const st=rows.find(r=>r.kind==='standings'),fx=rows.find(r=>r.kind==='fixtures');
   const ranks=st?JSON.parse(st.payload).filter(r=>Number(r.teamId)===Number(teamId)):[];
   const stats=fx?JSON.parse(fx.payload).teams.find(r=>Number(r.teamId)===Number(teamId)):null;
   if(ranks.length||stats)entries.push({season:w.year,current:w.current,division:c.division,league:c.name,
    // Multi-stage tables cannot be silently averaged as a single final position.
    rank:ranks.length===1?ranks[0].rank:null,percentile:ranks.length===1?ranks[0].percentile:null,
    standings:ranks,stats:stats||null});
  }
  const averages=[1,2].map(division=>{const rows=entries.filter(e=>!e.current&&e.division===division&&e.rank!==null);return {division,seasons:rows.length,averageRank:mean(rows.map(e=>e.rank)),averagePercentile:mean(rows.map(e=>e.percentile).filter(Number.isFinite))};});
  const currentComparison=averages.map(a=>{
   const current=entries.find(e=>e.current&&e.division===a.division);
   return {division:a.division,historicalSeasons:a.seasons,
    currentRank:current?.rank??null,
    rankDifference:current?.rank!=null&&a.averageRank!=null?current.rank-a.averageRank:null,
    percentileDifference:current?.percentile!=null&&a.averagePercentile!=null?current.percentile-a.averagePercentile:null};
  });
  return {teamId,entries,averages,currentComparison};
 }
 function context(match){
  const c=db.prepare('SELECT country FROM long_history_catalog WHERE league_id=? LIMIT 1').get(match.leagueId||0);
  if(!c)return '\nHISTORIQUE CINQ SAISONS : non encore vérifié pour ce championnat. Ne rien inventer.';
  const home=teamHistory(match.homeId,c.country),away=teamHistory(match.awayId,c.country);
  return '\nHISTORIQUE CINQ SAISONS + SAISON COURANTE (API-Sports, données enregistrées) : '+JSON.stringify({home,away})+
   '\nComparer séparément les divisions et les phases. Rang faible = meilleure position; percentile élevé = meilleure position relative. Année absente = inconnue, jamais zéro. Ne pas déduire O/U ou BTTS du seul classement; croiser buts et fréquences, forme et données live. Historique partiel ne signifie pas cinq saisons vérifiées. BTTS et +0,5 restent en observation uniquement.';
 }
 return {step,coverage,context,teamHistory};
}
module.exports={SCOPE,create,summarizeStandings,summarizeFixtures};
