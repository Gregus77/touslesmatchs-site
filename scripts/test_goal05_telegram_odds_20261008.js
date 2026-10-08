'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const client=require('./telegram_client');
const {bookmakerButtons}=require('./bookmakers.config');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const now=new Date().toISOString();
const base={
  matchKey:'fixture:123',home:'Equipe A',away:'Equipe B',competition:'Championnat test',
  minute:52,scoreHome:0,scoreAway:1,targetTeam:'Equipe A',market:'Equipe A +0,5 but',
  votes:4,confidence:83,rating:8.2,color:'green',odd:1.64,oddFetchedAt:now,
  reason:'Critères V2 vérifiés.'
};
const frFree={id:'-1',lang:'fr',tier:'free',paymentVerified:true};
const frPremium={id:'-2',lang:'fr',tier:'premium',paymentVerified:true};
const ruFree={id:'-3',lang:'ru',tier:'free',paymentVerified:true};
const ruPremium={id:'-4',lang:'ru',tier:'premium',paymentVerified:true};

assert.deepEqual(bookmakerButtons.map(b=>b.text),['Winamax','Unibet','PMU','Betclic']);
for(const dest of [frFree,frPremium,ruFree,ruPremium]){
  const msg=client.render('goal05',base,dest);
  assert.match(msg.text,/1,64/,'the same real quote is visible in both tiers and languages');
  assert.match(msg.text,/Paris/,'quote source time must be visible');
  assert.match(msg.text,/1,60/,'threshold must be explicit');
  assert.match(msg.text,/2|двух/,'combo education must mention two matches');
  const links=msg.reply_markup.inline_keyboard.flat();
  for(const bookmaker of bookmakerButtons)
    assert(links.some(item=>item.text===bookmaker.text&&item.url===bookmaker.url),bookmaker.text+' missing');
  assert(links.some(x=>/Premium/.test(x.text)&&x.url.includes('premium-checkout')),'verified checkout missing');
  if(dest.tier==='free'){
    assert(!msg.text.includes('<b>Equipe A</b>'),'free selection team must remain locked');
  }else{
    assert(msg.text.includes('<b>Equipe A</b>'),'premium must display target team');
  }
}
const poor=client.render('goal05',{...base,odd:1.20},frPremium).text;
assert.match(poor,/Cote insuffisante/);
assert.match(poor,/1,60/);
const unknown=client.render('goal05',{...base,odd:null},frFree).text;
assert.match(unknown,/indisponible/);
const stale=client.render('goal05',{...base,oddFetchedAt:new Date(Date.now()-600000).toISOString()},frFree).text;
assert.match(stale,/périmée/);
const untracked=client.render('goal05',{...base,oddFetchedAt:null},frPremium).text;
assert.match(untracked,/non datée/);
const notVerified=client.render('goal05',base,{...frFree,paymentVerified:false});
assert(!notVerified.reply_markup.inline_keyboard.flat().some(x=>x.url.includes('premium-checkout')));
assert(notVerified.reply_markup.inline_keyboard.flat().some(x=>x.url==='https://www.touslesmatchs.com/#plans'));
assert.match(notVerified.text,/Paiement indisponible temporairement/);
const scanner=client.render('scanner',{rows:[{...base,country:'Irlande',sport:'Football',kickoffLabel:'21:00',targetRank:3,opponentRank:9}]},frFree).text;
assert.match(scanner,/À surveiller/);
assert.doesNotMatch(scanner,/À jouer :/);

const api=read('scripts/api_server.js');
assert(api.includes('oddFetchedAt:criteria.oddFetchedAt'),'Telegram must receive source timestamp');
assert(api.includes('Date.now()-Date.parse(String(criteria.oddFetchedAt))<=GOAL05_ODD_MAX_AGE_MS'),'delivery gate must revalidate timestamp');
const home=read('public/index.html');
assert(home.includes('tlm-free-offer-bar'));
assert(home.includes("p.confirmed!==true"),'countdown must not be fabricated');
const promo=JSON.parse(read('public/data/free-offer-status.json'));
assert.equal(promo.confirmed,false,'no fake end of free access');
assert.equal(promo.ends_at,null);
const skill=read('.claude/skills/tlm-reprise-connexion/SKILL.md');
assert(skill.includes('reprise-session-active.md'),'skill must persist a recoverable checkpoint');
console.log('GOAL05_TELEGRAM_QUOTES_PARTNERS_RESTART_OK');
