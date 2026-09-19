'use strict';
const fs=require('node:fs');
function parseVote(text){const value=typeof text==='string'?text.trim().toUpperCase():'';return {direction:['OVER','UNDER'].includes(value)?value:null};}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render(result){return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test exceptionnel River Plate</title><style>body{background:#0b1024;color:#eaf4ff;font:16px system-ui;padding:18px;margin:0}h2{color:#49def1;font-size:20px}li{display:inline-block;padding:12px;border:1px solid #5864a0;border-radius:12px;margin:4px}ul{padding:0}.note{color:#ffcb75}</style><h2>Test exceptionnel — River Plate / Huracán</h2><p class="note">Hors signal officiel · aucun envoi Telegram · exclu des résultats</p><p>Photographie à ${esc(result.match.minute)}′, score ${esc(result.match.score_home)}–${esc(result.match.score_away)} · ${esc(new Date(result.at).toLocaleString('fr-FR',{timeZone:'Europe/Paris'}))} (Paris)</p><ul>${result.votes.map((v,i)=>`<li>IA ${i+1} : ${esc(v.direction||'avis indisponible')}</li>`).join('')}</ul><p>Over/Under 2,5 buts sur le match entier. Test ponctuel sur le score disponible, sans statistiques détaillées ni cotes. Ce n'est pas une recommandation de pari et cela ne valide pas encore le déclenchement automatique.</p></html>`;}
function inject(source){if(source.includes('TLM-RIVER-DIAGNOSTIC-20260920'))return source;if(!source.includes('</body>'))throw Error('BODY_ANCHOR_MISSING');return source.replace('</body>',`<!-- TLM-RIVER-DIAGNOSTIC-20260920 --><script>if(new URLSearchParams(location.search).get('test')==='river'){var frame=document.createElement('iframe');frame.src='/river-diagnostic-20260920.html';frame.title='Test exceptionnel River Plate';frame.style.cssText='display:block;width:calc(100% - 24px);height:410px;max-width:1200px;margin:85px auto 16px;border:2px solid #49def1;border-radius:16px';document.body.prepend(frame);}</script></body>`);}
async function run(){
 const res=await fetch('http://127.0.0.1:3001/live-matches',{signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw Error('LIVE_FEED_UNAVAILABLE');
 const match=(await res.json()).matches.find(m=>String(m.id)==='1493147'&&m.home==='River Plate'&&m.away==='Huracan');
 const age=Date.now()-Date.parse(match?.data_fetched_at);
 if(!match||!['HT','IN_PLAY','LIVE'].includes(match.status)||match.scoreConflict||!Number.isFinite(age)||age<0||age>180000||![match.minute,match.score_home,match.score_away].every(x=>Number.isFinite(x)&&x>=0))throw Error('MATCH_NOT_FRESH_AND_LIVE');
 const headers={Authorization:'Bearer '+process.env.OPENROUTER_API_KEY,'Content-Type':'application/json'};
 const db=require('/app/node_modules/better-sqlite3')('/data/tlm.db');
 const guard=require('/app/ai_budget_guard');
 const catalogRes=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(10000)});
 if(!catalogRes.ok)throw Error('NO_PRICING');
 const catalog=new Map((await catalogRes.json()).data.map(x=>[x.id,x.pricing]));
 const result={at:new Date().toISOString(),match:{id:match.id,minute:match.minute,status:match.status,score_home:match.score_home,score_away:match.score_away},votes:[],official:false};
 let reserved=0;
 for(const model of ['perplexity/sonar-pro','deepseek/deepseek-chat','moonshotai/kimi-k2','openai/gpt-5.6-luna','qwen/qwen3.7-max']){
  const body={model,reasoning:{effort:'none'},max_tokens:256,messages:[{role:'user',content:`Diagnostic only, not betting advice. Football River Plate vs Huracan. Verified live snapshot: minute ${match.minute}, status ${match.status}, score ${match.score_home}-${match.score_away}, at ${result.at}. No other stats, odds, or team news are available; do not invent any and do not search the web. Based only on this limited snapshot, give your independent tentative inclination for total goals at full time over or under 2.5. Reply exactly OVER or UNDER, or ABSTAIN if insufficient information. This is an exceptional post-window test, not a first-half official signal.`}]};
  const p=catalog.get(model);if(!p)throw Error('MODEL_PRICING_MISSING');
  const bound=(Buffer.byteLength(JSON.stringify(body.messages))+512)*Number(p.prompt||0)+256*Number(p.completion||0)+Number(p.request||0)+Number(p.web_search||0)+0.01;
  if(!Number.isFinite(bound)||bound<0||(reserved+=bound)>0.10)throw Error('TEST_COST_BOUND');
  try{const r=await guard.withGlobalBudget(db,body,async()=>{const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});return {...await r.json(),http:r.status};});result.votes.push({model,...parseVote(r.http===200?r.choices?.[0]?.message?.content:null)});}catch{result.votes.push({model,direction:null});}
 }
 db.close();
 fs.writeFileSync('/data/river-diagnostic-20260920.html',render(result));
 console.log('RIVER_DIAGNOSTIC',JSON.stringify(result));
}
module.exports={parseVote,render,inject};
if(require.main===module)run().catch(e=>{console.error('DIAGNOSTIC_ABORTED',e.message);process.exitCode=1;});
