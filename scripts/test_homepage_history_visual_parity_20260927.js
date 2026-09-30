'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
global.window=globalThis;
global.localStorage={getItem:()=> 'fr'};
const lifecycle=require('../public/js/match-lifecycle.js');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
function extract(source,name){
  const start=source.indexOf('function '+name+'(');
  assert(start>=0,name+' missing');
  const tail=source.slice(start);
  const indent=source.slice(source.lastIndexOf('\n',start)+1,start);
  const closing=new RegExp('\\n'+indent+'\\}').exec(tail);
  assert(closing,name+' end missing');
  return tail.slice(0,closing.index+closing[0].length);
}
const ctx=vm.createContext({
  TLMMatchLifecycle:lifecycle,
  esc:String,
  isFinite,
  liveHomeScore:m=>m.score_home,
  liveAwayScore:m=>m.score_away
});
for(const name of ['heroOu25','heroTerminalCaption','tlmVotesAreOld','tlmAnalyzedMatchStatus','tlmVoteCirclesHtml']){
  vm.runInContext(extract(html,name),ctx);
}
const match={
  home:'Home',away:'Away',minute:60,period:'2H',status:'IN_PLAY',
  score_home:1,score_away:1,
  ou25:{
    locked:false,official:true,window_status:'closed',
    vote_count:5,consensus_count:3,consensus_direction:'over',
    snapshot_minute:39,snapshot_score:'0-0',
    votes:[
      {status:'voted',direction:'over'},
      {status:'voted',direction:'over'},
      {status:'voted',direction:'over'},
      {status:'voted',direction:'under'},
      {status:'voted',direction:'under'}
    ]
  }
};
const rendered=ctx.tlmVoteCirclesHtml(match);
assert.doesNotMatch(rendered,/filter:grayscale|opacity:\s*\.65/,'closed historical votes must retain their real colors');
assert.match(rendered,/class="tlm-row-consensus over"/,'list must expose the same consensus color family as the hero');
assert.match(rendered,/OVER 2,5 — 3\/5/,'list must show an explicit direction and consensus');
assert.match(rendered,/ENTRÉE FERMÉE — NE PLUS JOUER CE SIGNAL/,'closed warning copy must be action-safe');
assert.match(rendered,/tlm-entry-closed-pulse/,'closed warning must expose the soft orange pulse marker');
assert.match(html,/\.tlm-row-consensus\.over\{[^}]*#22d3ee/i,'Over verdict must use cyan');
assert.match(html,/\.tlm-row-consensus\.under\{[^}]*#d946ef/i,'Under verdict must use violet');
assert.match(html,/\.tlm-row-consensus\.unavailable\{[^}]*#fbbf24/i,'unavailable verdict must use amber');
assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{[^}]*\.tlm-entry-closed-pulse[^}]*animation:none/i,'reduced motion must stop the warning pulse');
console.log('PASS homepage history: colored seats, explicit O/U consensus, orange closed warning and reduced motion');
