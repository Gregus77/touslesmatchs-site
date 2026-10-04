'use strict';
const test=require('node:test'),assert=require('node:assert');
const {createPlus05JevShadow}=require('./plus05_jev_shadow');
const input={w:{home:'A',away:'B',competition:'L',fav_name:'A',opp_name:'B',side:'home',fav_rank:2,opp_rank:19,total_teams:20,fav_scored_in:5,fav_goals5:9,opp_conceded_in:5,risk_color:'vert'},
  live:{minute:58,score_home:0,score_away:1},quote:{odd:1.7},
  deep:{history:{verified:true,seasons:4,favAvg:2,oppAvg:17},attackers:{verified:true,forwards:2,missingAttackers:[]}},
  votes:{yes:4,answered:5,total:5}};

function response(choice,confidence=.8){return {ok:true,json:async()=>({model:'jev-test',answers:{plus05_decision:{type:'choice',choice,confidence,probabilities:{SEND:.7,WAIT:.1,REANALYZE:.1,REJECT:.1}}}})}}

test('Jev SEND devient oui Shadow et ne publie rien',async()=>{
  let calls=0;
  const j=createPlus05JevShadow({env:{PLUS05_JEV_SHADOW:'1',TYPESAFE_API_KEY:'x',JEV_MODEL:'jev-test',JEV_ALLOWED_RESPONSE_MODELS:'jev-test'},
    transport:async()=>{calls++;return response('SEND',.84)},log:{error(){}}});
  const r=await j.evaluate(input);
  assert.equal(calls,1);assert.equal(r.failed,false);assert.equal(r.decision,'yes');assert.equal(r.confidence,84);
});

test('Jev WAIT devient abstention, REJECT devient non',async()=>{
  for(const [choice,expected] of [['WAIT','abstain'],['REANALYZE','abstain'],['REJECT','no']]){
    const j=createPlus05JevShadow({env:{PLUS05_JEV_SHADOW:'1',TYPESAFE_API_KEY:'x',JEV_MODEL:'jev-test',JEV_ALLOWED_RESPONSE_MODELS:'jev-test'},
      transport:async()=>response(choice,.75),log:{error(){}}});
    const r=await j.evaluate(input);assert.equal(r.decision,expected);
  }
});

test('Jev Shadow desactive ne fait aucun appel',async()=>{
  let calls=0;const j=createPlus05JevShadow({env:{PLUS05_JEV_SHADOW:'0'},transport:async()=>{calls++;return response('SEND')},log:{error(){}}});
  const r=await j.evaluate(input);assert.equal(r.failed,true);assert.equal(r.error,'disabled');assert.equal(calls,0);
});
