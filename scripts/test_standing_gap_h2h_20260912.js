'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/api_server.js','utf8');
function part(a,b){const s=source.indexOf(a),e=source.indexOf(b,s+a.length);assert(s>=0&&e>s,`${a} absent`);return source.slice(s,e);}

const standings={rows:[{teamId:1,rank:2},{teamId:2,rank:17},{teamId:3,rank:6},{teamId:4,rank:9}],total:18};
const ctx=vm.createContext({fetchStandings:async()=>standings});
vm.runInContext(part('async function evaluateOu25StandingGap(', '\nasync function fetchInjuries('),ctx);

(async()=>{
  const topBottom=await ctx.evaluateOu25StandingGap({leagueId:10,season:2026,homeId:1,awayId:2});
  assert.equal(topBottom.ok,true);assert.equal(topBottom.rank_gap,15);assert.equal(topBottom.top5_bottom5,true);
  const tooClose=await ctx.evaluateOu25StandingGap({leagueId:10,season:2026,homeId:3,awayId:4});
  assert.equal(tooClose.ok,false);assert.match(tooClose.reason,/< 5/);
  const missing=await ctx.evaluateOu25StandingGap({homeId:1,awayId:2});
  assert.equal(missing.ok,false);assert.match(missing.reason,/non vérifiable/);

  const gate=vm.createContext({});
  vm.runInContext(part('function evaluateClientSignalCriteria(', '\nconst recoveryRecentFormCache'),gate);
  const valid={blockTier:null,telegramConfigured:true,recoveryEnabled:false,recoveryOk:true,matchEligible:true,maxMinute:45,
    standingsOk:true,ou25Only:true,enoughSeats:true,activeVotes:5,confidence:82,signalThreshold:77,minConfidence:77,
    voteCount:4,requiredVotes:3,hasRealData:true,qualityOk:true,playableOk:true,isWomen:false,lowTrust:false};
  assert.equal(gate.evaluateClientSignalCriteria(valid),null);
  assert.match(gate.evaluateClientSignalCriteria({...valid,standingsOk:false,standingsReason:'écart de classement 3 < 5'}),/classement/);
  console.log('OK: classement vérifié, écart minimum 5, priorité top 5/bottom 5 et blocage fail-safe');
})().catch(e=>{console.error(e);process.exit(1)});
