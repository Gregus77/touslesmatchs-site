'use strict';
const test=require('node:test'),assert=require('node:assert');
let Database; try{Database=require('better-sqlite3')}catch{Database=require('node:sqlite').DatabaseSync}
const {createPlus05ShadowLearning}=require('./plus05_shadow_learning');

test('enregistre Concile, sieges, Kimi et abstention Jev sur la meme fixture',()=>{
  const db=new Database(':memory:'), l=createPlus05ShadowLearning({db,now:()=>1000000,log:{error(){}}});
  const w={fixture_id:'42',home:'A',away:'B',competition:'L',fav_name:'A',side:'home',risk_color:'vert'};
  l.recordCouncil({w,live:{minute:58,score_home:0,score_away:1},quote:{odd:1.72},
    votes:{yes:4,answered:5,total:5,results:[
      {seat:'DeepSeek-V3',yes:true,confidence:82,raison:'ok'},
      {seat:'OpenRouter-Luna',yes:false,confidence:64,raison:'non'}]},
    shadows:[
      {seat:'Kimi',decision:'yes',yes:true,confidence:80,raison:'ok'},
      {seat:'Jev',decision:'abstain',yes:false,confidence:61,raison:'Jev WAIT'}]});
  const rows=db.prepare('select policy,decision from plus05_shadow_evals order by policy').all();
  assert.deepEqual(rows.map(r=>[r.policy,r.decision]),[
    ['council_4of5','yes'],['seat:DeepSeek-V3','yes'],['seat:OpenRouter-Luna','no'],
    ['shadow:Jev','abstain'],['shadow:Kimi','yes']]);
});

test('resolution et rapport utilisent le vrai but du favori',()=>{
  const db=new Database(':memory:'), l=createPlus05ShadowLearning({db,now:()=>2000000,log:{error(){}}});
  l.upsert({fixtureId:'9',policy:'council_4of5',decision:'yes',favSide:'home',odd:1.7,observedAt:1});
  l.upsert({fixtureId:'9',policy:'shadow:Kimi',decision:'yes',favSide:'home',odd:1.7,observedAt:1});
  l.upsert({fixtureId:'9',policy:'shadow:Jev',decision:'no',favSide:'home',odd:1.7,observedAt:1});
  assert.equal(l.settleFixture('9',1,2,'FT').settled,3);
  const r=l.report();
  const base=r.metrics.find(x=>x.policy==='council_4of5');
  assert.equal(base.yes_wins,1); assert.equal(base.yes_losses,0);
  assert.equal(r.automatic_switch,false);
});
