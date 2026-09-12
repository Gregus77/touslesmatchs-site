'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const DB=require(process.env.TEST_SQLITE_MODULE||'better-sqlite3');
const source=fs.readFileSync(__dirname+'/api_server.js','utf8');
const helper=source.slice(source.indexOf('const sportsGetPending ='),source.indexOf('function httpGetUncached('));
const db=new DB(':memory:');let calls=0,answer={response:[{fixture:{id:1}}]},fail=false;
function context(){const c=vm.createContext({db,crypto,URL,Date,console,httpGetUncached:async()=>{calls++;await new Promise(r=>setTimeout(r,5));if(fail)throw Error('network');return answer;}});vm.runInContext(helper,c);return c;}
(async()=>{let c=context();const h='https://v3.football.api-sports.io/fixtures/headtohead?h2h=1-2&last=10';
const results=await Promise.all(Array.from({length:20},()=>c.httpGet(h,{})));assert.equal(calls,1);results[0].response[0].fixture.id=9;assert.equal(results[1].response[0].fixture.id,1);
c=context();assert.equal((await c.httpGet(h,{})).response[0].fixture.id,1);assert.equal(calls,1,'historical cache survives process context restart');
answer={errors:{requests:'You have reached the request limit for the day'}};await c.httpGet('https://v3.football.api-sports.io/fixtures?live=all',{});const n=calls;await c.httpGet('https://v3.football.api-sports.io/fixtures/statistics?fixture=1',{});assert.equal(calls,n,'quota block stops other endpoints');assert.equal(c.sportsLiveAvailability().available,false);
db.prepare('UPDATE sports_http_blocks SET until_ms=0').run();answer={response:[]};c=context();await c.httpGet('https://v3.football.api-sports.io/fixtures?live=all',{});assert.equal(calls,n+1,'renewal permits a new call');
fail=true;await assert.rejects(c.httpGet('https://api.football-data.org/v4/matches?status=LIVE'));fail=false;await c.httpGet('https://api.football-data.org/v4/matches?status=LIVE');
assert(source.includes('match.sport !== "Football" || !isClientOu25MatchEligible(match, false)'));
assert(source.includes('if (apiSportsErrors(data)) return fetchH2HFromFootballData(match);'));
console.log('PASS: 20 concurrent requests = 1 call, isolated response copies, persistent H2H, quota block/renewal, network retry, league guards');db.close();})().catch(e=>{console.error(e);process.exit(1)});
