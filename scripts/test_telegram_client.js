'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const client=require('./telegram_client');
const https=require('https'),{EventEmitter}=require('events');
const env={TELEGRAM_BOT_TOKEN:'mock',TELEGRAM_CHANNEL_ID:'-1',TELEGRAM_PREMIUM_CHANNEL_ID:'-2',TELEGRAM_RU_FREE_CHANNEL_ID:'-3',TELEGRAM_RU_PREMIUM_CHANNEL_ID:'-4',TELEGRAM_STANDARD_CHANNEL_ID:'-5',TELEGRAM_ELITE_CHANNEL_ID:'-6',TELEGRAM_ADMIN_CHAT_ID:'-7'};
const targets=client.destinations(env);
assert.deepEqual(targets.map(x=>x.channel),['free','premium','ru_free','ru_premium']);
assert.throws(()=>client.destinations({...env,TELEGRAM_PREMIUM_CHANNEL_ID:'-1'}));
assert.throws(()=>client.destinations({...env,TELEGRAM_CHANNEL_ID:'-7'}));
const data={matchKey:'match:1',home:'Under United & FC',away:'Over City',competition:'Example',minute:45,scoreHome:1,scoreAway:0,votes:3,confidence:81,market:'Under 2.5 buts',odd:'1.65',reason:'Justification française secrète',outcome:'loss'};
for(const dest of targets){
 const signal=client.render('signal',data,{...dest,paymentVerified:true});
 assert(signal.text.includes('Under United &amp; FC'));assert(signal.text.includes('Over City'));
 assert(signal.text.includes('45'));assert(signal.text.includes('81'));assert(signal.text.includes('18+'));assert(signal.text.includes('joueurs-info-service.fr'));
 if(dest.tier==='free'){
  assert(!signal.text.includes(data.market));assert(!signal.text.includes(data.reason));assert(!signal.text.includes('1.65'));
  assert.equal(signal.reply_markup.inline_keyboard[0][0].text,client.CTA[dest.lang]);
 } else {assert(signal.text.includes('1.65'));if(dest.lang==='ru'){assert(!signal.text.includes(data.reason));assert(signal.text.includes('Тотал меньше 2.5 голов'));}}
 for(const kind of ['result','recap','guide','reminder','nopick']){
  const msg=client.render(kind,{...data,day:'2026-09-11',rows:[{...data,best_bet:data.market,final_score_home:1,final_score_away:0}]},dest);
  assert(!/(?<!1)4[,.]90|Standard|Elite|🇬🇧|STRONG SIGNAL/.test(msg.text));
  if(dest.lang==='ru')assert(!/Gagnés|Perdus|sélection|confiance|Jeu responsable/.test(msg.text));
 }
}
// Inactive/unverified Stripe must never produce a payment URL or subscription button.
for(const lang of ['fr','ru']) {
  const disabled=client.render('reminder',{}, {id:'-1',tier:'free',lang});
  assert(!disabled.text.includes('href='));assert(!disabled.reply_markup);
  assert(/temporairement indisponibles|временно недоступны/.test(disabled.text));
}
async function main(){
 const originalRequest=https.request;
 for(const [body,status,expected] of [[{ok:true,result:{message_id:12}},200,true],[{ok:true},200,false],[{ok:false,error_code:429,parameters:{retry_after:90}},429,false],[{ok:true,result:{message_id:12}},500,false]]) {
  https.request=(opts,callback)=>{
   const req=new EventEmitter();req.end=()=>{const res=new EventEmitter();res.statusCode=status;callback(res);res.emit('data',JSON.stringify(body));res.emit('end');};req.destroy=()=>req.emit('error',new Error('timeout'));return req;
  };
  const response=await client.request('fake',{chat_id:'-1',text:'test'});assert.equal(response.ok,expected);
 }
 https.request=originalRequest;
 let created=0;
 const stripe={prices:{retrieve:async()=>({id:'price_mock',active:true,livemode:true,currency:'eur',unit_amount:1490,recurring:{interval:'month',interval_count:1},product:{active:true,livemode:true}})},checkout:{sessions:{create:async p=>{created++;return p;}}}};
 const checkout=await client.verifiedCheckout(stripe,'price_mock','ru');assert.equal(checkout.locale,'ru');assert.equal(checkout.mode,'subscription');assert.equal(checkout.metadata.preferred_language,'ru');
 for(const patch of [{active:false},{livemode:false},{unit_amount:490},{currency:'usd'},{recurring:null},{product:{active:false}}]){
  const good=await stripe.prices.retrieve();const bad={...stripe,prices:{retrieve:async()=>({...good,...patch})}};
  await assert.rejects(()=>client.verifiedCheckout(bad,'price_mock','ru'));
 }
 assert.equal(created,1);
 if(process.env.TEST_SQLITE_MODULE){
  const Database=require(process.env.TEST_SQLITE_MODULE),db=new Database(':memory:');
  db.exec(`CREATE TABLE telegram_signal_deliveries(match_key TEXT,channel TEXT,telegram_message_id INTEGER,market TEXT,vote_count INTEGER,ok INTEGER);
    CREATE TABLE concile_analyses(match_key TEXT PRIMARY KEY,sig_sent_free INTEGER DEFAULT 0,sig_sent_premium INTEGER DEFAULT 0,sig_sent_standard INTEGER DEFAULT 1,sig_sent_elite INTEGER DEFAULT 1);
    INSERT INTO concile_analyses(match_key) VALUES ('match:1');`);
  let now=100000,calls=[],failRu=true;
  const transport=async(token,payload)=>{calls.push(payload.chat_id);return payload.chat_id==='-4'&&failRu?{ok:false,retryAfter:30}:{ok:true,messageId:calls.length};};
  let pub=client.createPublisher({db,env,transport,now:()=>now});
  for(const dest of targets)pub.enqueue('signal',data,dest,'identity',now+120000);
  await Promise.all([pub.flush(),pub.flush()]);assert.equal(calls.length,4);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM telegram_signal_deliveries WHERE channel='ru_premium'").get().n,0);
  for(const dest of targets)pub.enqueue('signal',data,dest,'identity',now+120000);
  await pub.flush();assert.equal(calls.length,4);
  pub=client.createPublisher({db,env,transport,now:()=>now});now+=31000;failRu=false;await pub.flush();assert.deepEqual(calls,['-1','-2','-3','-4','-4']);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM telegram_signal_deliveries').get().n,4);
  assert.equal(db.prepare('SELECT sig_sent_standard FROM concile_analyses').get().sig_sent_standard,1);
  assert.equal(db.prepare('SELECT sig_sent_elite FROM concile_analyses').get().sig_sent_elite,1);
  // Result and recap successes must never manufacture a signal proof.
  pub.enqueue('result',data,targets[1],'result');await pub.flush();assert.equal(db.prepare('SELECT COUNT(*) n FROM telegram_signal_deliveries').get().n,4);
  // Unknown acceptance must not be retried automatically (Telegram has no idempotency key).
  const uncertain=client.createPublisher({db,env,transport:async()=>({ok:true}),now:()=>now});
  uncertain.enqueue('reminder',{},targets[0],'unknown');await uncertain.flush();assert.equal(db.prepare("SELECT state FROM client_telegram_outbox WHERE delivery_key LIKE 'reminder:unknown:%'").get().state,'uncertain');
  // A signal that expires before a retry cannot be sent outside the live window.
  pub.enqueue('signal',data,targets[1],'expired',now-1);const before=calls.length;await pub.flush();assert.equal(calls.length,before);
  // Eleven distinct admissible signals all pass (no inherited commercial cap).
  for(let i=0;i<11;i++) pub.enqueue('signal',data,targets[1],'unlimited-'+i,now+120000);
  const unlimitedBefore=calls.length;await pub.flush();assert.equal(calls.length-unlimitedBefore,11);
  db.close();
 }
 console.log('PASS Telegram FR/RU, teaser, destinations, monthly checkout, '+(process.env.TEST_SQLITE_MODULE?'SQLite retries/restart/dedup/proofs/expiry':'templates (SQLite suite requires TEST_SQLITE_MODULE)'));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

// Exercise the actual API result router: FR proof must not authorize a RU result.
const vm=require('vm');
const api=fs.readFileSync(path.join(__dirname,'api_server.js'),'utf8');
const resultFunction=api.match(/async function notifySignalFortResult\([^]*?\n\}/)[0];
const queued=[];
const proof={channels:new Set(['premium']),market:'Under 2.5 buts'};
const context={storedTelegramDelivery:()=>proof,clientTelegramPublisher:{targets,enqueue:(kind,d,dest)=>queued.push(dest.channel),flush:async()=>true}};
vm.createContext(context);vm.runInContext(resultFunction,context);
context.notifySignalFortResult({...data,match_key:data.matchKey},'loss',1,0).then(()=>{
 assert.deepEqual(queued,['premium']);queued.length=0;proof.channels=new Set(['ru_premium']);
 return context.notifySignalFortResult({...data,match_key:data.matchKey},'win',1,0);
}).then(()=>assert.deepEqual(queued,['ru_premium'])).catch(e=>{console.error(e);process.exitCode=1;});
