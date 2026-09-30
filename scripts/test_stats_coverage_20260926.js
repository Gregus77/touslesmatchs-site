'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const coherence=require('./live_state_coherence'),source=fs.readFileSync(path.join(__dirname,'api_server.js'),'utf8');
let statsReads=0,coverageReads=0;const state={leagueId:386,season:2026,home:10,away:20,score:'1-0',phase:'1H',minute:45};
let coverage=false;
const ctx=vm.createContext({API_SPORTS_KEY:'mock',apiSportsBudgetOk:()=>true,apiSportsErrors:d=>d.errors&&Object.keys(d.errors).length,liveStateCoherence:coherence,matchStatsCache:new Map(),footballStatsCoverageCache:new Map(),console:{error(){}},httpGet:async url=>{
 if(url.includes('/leagues?')){coverageReads++;return {response:[{league:{id:386},seasons:[{year:2026,coverage:{fixtures:{statistics_fixtures:coverage}}}]}]};}
 statsReads++;return {response:[]};
}});
for(const name of ['footballStatisticsCovered','fetchMatchStats','parseMatchStats'])vm.runInContext(source.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n}'))[0],ctx);
(async()=>{
 await assert.rejects(()=>ctx.fetchMatchStats(1640813,state),{diagnostic_category:'coverage_unavailable'});
 await assert.rejects(()=>ctx.fetchMatchStats(1640813,state),{diagnostic_category:'coverage_unavailable'});
 assert.equal(coverageReads,1);assert.equal(statsReads,2); // no fabricated stats; cached capability only
 assert.equal(await ctx.footballStatisticsCovered({...state,season:2027}),null); // season mismatch never authorizes
 ctx.footballStatsCoverageCache.clear();coverage=true;
 await assert.rejects(()=>ctx.fetchMatchStats(1640813,state),{diagnostic_category:'empty_response'});
 ctx.footballStatsCoverageCache.clear();ctx.apiSportsBudgetOk=()=>false;
 await assert.rejects(()=>ctx.fetchMatchStats(1640813,state),{diagnostic_category:'quota'});
 console.log('STATS_COVERAGE: false, true-but-empty, wrong season, cache and budget fail-closed passed; zero IA calls');
})().catch(e=>{console.error(e);process.exitCode=1;});
