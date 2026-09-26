'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(__dirname,'api_server.js'),'utf8');
const rule='Le marché officiel OVER/UNDER 2,5, ses votes et son affichage ne peuvent être supprimés, désactivés ou remplacés par une future IA/mise à jour sans accord explicite écrit du propriétaire.';
assert(fs.readFileSync(path.join(root,'AGENTS.md'),'utf8').includes(rule));
assert.match(source,/const BET_TYPES = \["Over 2\.5 buts", "Under 2\.5 buts"\]/);
assert.match(source,/const CLIENT_OU25_MIN_VOTES = 3;/);
assert.match(fs.readFileSync(path.join(__dirname,'official_signal_snapshots.js'),'utf8'),/const MIN_CONSENSUS_VOTES = 3;/);
assert.match(source,/await fetchMatchStatsForMatch\(match\)/);
const harness=fs.readFileSync(path.join(__dirname,'test_live_surfaces_20260926.js'),'utf8').split('// Real SQLite snapshots')[0];
new Function('require','__dirname',harness+`
for(const direction of ['over','under'])for(const period of ['1H','HT','2H'])for(const n of [3,4,5]){
 const state=raw(n,true);state.consensus_direction=direction;state.votes.forEach(v=>{if(v.status==='voted')v.direction=direction;});
 const m=api.homepageLiveMatch({...base,period,minute:period==='1H'?38:60,ou25:state},true);
 for(const [surface,html] of [['Accueil',ctx.tlmVoteCirclesHtml(m)],['Application',ctx.appMiniVotes(m)],['Live IA',ctx.renderLiveOu25Details(m)]]){
  assert(html.includes(direction.toUpperCase()+' 2,5'),surface+' lost official O/U');
  assert(html.includes(n+'/5'),surface+' lost real consensus');
 }
 assert.equal(m.ou25.consensus_direction,direction);assert.equal(m.ou25.vote_count,n);
}
console.log('PROTECTED_OU25: 54 rendered official snapshots (both directions, 3/4/5 votes, 1H/HT/2H), API and written owner rule passed');
`)(require,__dirname);
// Existing quorum function, genuine votes only. The threshold does not invent a third vote.
const context=vm.createContext({CONCILE_AGENT_NAMES:['A','B','C','D','E'],CLIENT_OU25_MIN_VOTES:3,isOu25Bet:b=>/^(Over|Under) 2\.5 buts$/.test(b)});
const a=source.indexOf('function buildOu25VoteSummary'),b=source.indexOf('\n// Un timeout ou une erreur HTTP',a);vm.runInContext(source.slice(a,b),context);
for(const n of [2,3,4,5]){const votes=Array.from({length:n},(_,i)=>({name:'ABCDE'[i],marches:{buts:{p:'u2.5',c:85}}}));const s=context.buildOu25VoteSummary(votes);assert.equal(s.vote_count,n);assert.equal(s.recommended,n>=3);}
console.log('OWNER_QUORUM: 2 blocked; 3/4/5 accepted by quorum only, other criteria unchanged');
