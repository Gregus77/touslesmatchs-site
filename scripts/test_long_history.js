'use strict';
const assert=require('assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {SCOPE,create,summarizeFixtures,summarizeStandings}=require('./long_history');
function fixture(id,h,a,status='FT'){return {fixture:{id,status:{short:status}},teams:{home:{id:1,name:'A'},away:{id:2,name:'B'}},goals:{home:h,away:a}};}
const summary=summarizeFixtures({response:[fixture(1,2,1),fixture(1,2,1),fixture(2,0,0),fixture(3,null,null),fixture(4,3,1,'AET')]});
assert.equal(summary.finals,2);assert.equal(summary.unresolved,2);
const a=summary.teams.find(x=>x.teamId===1);assert.equal(a.played,2);assert.equal(a.over25,1);assert.equal(a.btts,1);assert.equal(a.over05,1);assert.equal(a.scored05,1);
assert.equal(summarizeFixtures({response:[fixture(1,null,null)]}),null);
assert.equal(Object.keys(SCOPE).length,21);
const table={response:[{league:{standings:[[{team:{id:1,name:'A'},rank:1,points:10,all:{played:5}},{team:{id:2,name:'B'},rank:2,points:3,all:{played:5}}]]}}]};
assert.equal(summarizeStandings(table)[0].percentile,1);assert.equal(summarizeStandings(table)[1].percentile,0);
async function main(){
 const db=new DatabaseSync(':memory:');let requests=0,permit=false;
 const h=create(db,{now:()=>new Date('2026-09-05T00:00:00Z'),reserve:()=>permit,request:async()=>{requests++;return {response:[]}}});
 await h.step();assert.equal(requests,0);assert.equal(h.coverage().length,42);
 permit=true;await h.step();assert.equal(requests,1);
 assert.equal(h.coverage().filter(x=>x.status==='not_found').length,2);
 const seasons=Array.from({length:6},(_,i)=>({year:2026-i,start:(2026-i)+'-01-01',end:(2026-i)+'-12-31'}));
 db.prepare("UPDATE long_history_catalog SET status='identified',league_id=71,name='Serie A',seasons_json=? WHERE country='Brazil' AND division=1").run(JSON.stringify(seasons));
 for(const year of [2025,2024]){
  db.prepare('INSERT INTO long_history_data VALUES(?,?,?,?,?,?,?,?)').run(71,year,'standings','ok',JSON.stringify(summarizeStandings(table)),'test','2026','9999');
  db.prepare('INSERT INTO long_history_data VALUES(?,?,?,?,?,?,?,?)').run(71,year,'fixtures','ok',JSON.stringify(summary),'test','2026','9999');
 }
 const team=h.teamHistory(1,'Brazil');assert.equal(team.averages[0].seasons,2);assert.equal(team.averages[0].averageRank,1);
 assert.equal(team.averages[1].averageRank,null);
 assert.equal(h.coverage().find(x=>x.league_id===71).five_seasons_complete,false);
 assert(h.context({leagueId:71,homeId:1,awayId:2}).includes('Année absente'));
 assert(h.context({leagueId:999}).includes('non encore vérifié'));
 db.close();console.log('OK: missing years, division separation, exact FT scores, deduplication, coverage and quota refusal');
}
main().catch(e=>{console.error(e);process.exitCode=1});
