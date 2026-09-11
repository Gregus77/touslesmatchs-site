'use strict';
const https = require('https');
const {buildInlineKeyboard}=require('./bookmakers.config');
const PAYMENT = 'https://www.touslesmatchs.com/api/premium-checkout';
const CTA = {fr:'Passer à Premium — 14,90 €/mois, sans engagement',ru:'Оформить Premium — 14,90 €/месяц, без обязательств'};
const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const legal = lang => lang === 'ru' ? '⚠️ 18+ — Ответственная игра. Выигрыш не гарантирован. joueurs-info-service.fr' : '⚠️ 18+ — Jeu responsable. Aucun gain garanti. joueurs-info-service.fr';
const payment = lang => `${PAYMENT}?lang=${lang}`;
function destinations(env) {
  const all = [
    {channel:'free',lang:'fr',tier:'free',id:env.TELEGRAM_CHANNEL_ID || env.TELEGRAM_FREE_CHANNEL_ID || env.TELEGRAM_CHAT_ID},
    {channel:'premium',lang:'fr',tier:'premium',id:env.TELEGRAM_PREMIUM_CHANNEL_ID},
    {channel:'ru_free',lang:'ru',tier:'free',id:env.TELEGRAM_RU_FREE_CHANNEL_ID},
    {channel:'ru_premium',lang:'ru',tier:'premium',id:env.TELEGRAM_RU_PREMIUM_CHANNEL_ID},
  ].filter(x=>x.id).map(x=>({...x,id:String(x.id)}));
  const admin = [env.TELEGRAM_ADMIN_CHAT_ID,env.TELEGRAM_SUPPORT_CHAT_ID].filter(Boolean).map(String);
  if (new Set(all.map(x=>x.id)).size !== all.length || all.some(x=>admin.includes(x.id))) throw new Error('Ambiguous Telegram client destinations');
  return all;
}
function marketRu(value) {
  const m=String(value || '').match(/^(Over|Under) (2[.,]5) (buts|goals)$/i);
  if (!m) throw new Error('Unsupported client market');
  return `Тотал ${m[1].toLowerCase()==='over'?'больше':'меньше'} ${m[2]} голов`;
}
function render(kind,data,dest) {
  const ru=dest.lang==='ru',free=dest.tier==='free',paymentVerified=dest.paymentVerified===true;
  const market=()=>esc(ru?marketRu(data.market):data.market);
  const match=()=>`⚽ <b>${esc(data.home)} — ${esc(data.away)}</b>`;
  let lines=[];
  if (kind==='signal') {
    lines=[`🚨 <b>${ru?'СИГНАЛ ИИ':'SIGNAL CONSEIL IA'}${free?(ru?' ОБНАРУЖЕН':' DÉTECTÉ'):''}</b>`,match(),`🏆 ${esc(data.competition)}`,
      `⏱ ${ru?'Минута':'Minute'} : ${esc(data.minute)} · ${ru?'Счёт':'Score'} : ${esc(data.scoreHome)}-${esc(data.scoreAway)}`,
      `🧠 ${ru?'Голосование ИИ':'Vote IA'} : ${esc(data.votes)}/5`,
      `📊 ${ru?'Уровень доверия':'Score de confiance'} : ${esc(data.confidence)}/100`];
    if (free) lines.push(ru?'🔒 Точный прогноз и обоснование доступны только подписчикам Premium.':'🔒 La sélection exacte et la raison sont réservées aux membres Premium.');
    else {
      lines.push(`💡 ${ru?'Прогноз':'Sélection'} : <b>${market()}</b>`, `💰 ${ru?'Коэффициент':'Cote'} : ${data.odd?esc(data.odd):ru?'недоступен':'indisponible'}`);
      // Résumé RU déterministe fondé uniquement sur les votes observés ; aucune justification FR copiée.
      lines.push(ru?`Обоснование: ${esc(data.votes)} из 5 ИИ поддержали этот прогноз; уровень доверия — ${esc(data.confidence)}/100.`:esc(data.reason || `${data.votes} IA sur 5 soutiennent cette sélection.`));
    }
  } else if(kind==='result') {
    lines=[`${data.outcome==='win'?'✅':'❌'} <b>${ru?(data.outcome==='win'?'ВЫИГРЫШ':'ПРОИГРЫШ'):(data.outcome==='win'?'SIGNAL GAGNÉ':'SIGNAL PERDU')}</b>`,match(),`⚽ ${ru?'Итоговый счёт':'Score final'} : ${esc(data.scoreHome)}-${esc(data.scoreAway)}`];
    if(!free) lines.push(`💡 ${ru?'Прогноз':'Sélection'} : ${market()}`);
    else lines.push(ru?'Результат сигнала Premium, анонсированного в этом канале.':'Résultat du signal Premium annoncé dans ce canal.');
  } else if(kind==='recap') {
    const rows=data.rows,wins=rows.filter(x=>x.outcome==='win').length,losses=rows.filter(x=>x.outcome==='loss').length;
    lines=[`📊 <b>${ru?'ИТОГИ ДНЯ':'BILAN DU JOUR'} — ${esc(data.day)}</b>`,`✅ ${ru?'Выиграно':'Gagnés'} : ${wins} · ❌ ${ru?'Проиграно':'Perdus'} : ${losses}`,
      ru?'Только сигналы с подтверждённой доставкой в этот канал.':'Uniquement les signaux dont la livraison dans ce canal est prouvée.'];
    for(const row of rows) lines.push(`${row.outcome==='win'?'✅':'❌'} ${esc(row.home)} — ${esc(row.away)} : ${esc(row.final_score_home)}-${esc(row.final_score_away)}${free?'':` · ${esc(ru?marketRu(row.best_bet):row.best_bet)}`}`);
  } else if(kind==='guide') {
    lines=ru?['📘 <b>Как читать сигналы TousLesMatchs</b>','Футбол: тотал больше 2,5 означает минимум 3 гола; тотал меньше 2,5 — максимум 2 гола за основное время.','Прогноз публикуется только при соблюдении действующих критериев качества. Голосование ИИ не гарантирует результат.','Бесплатный канал: знакомство с сервисом, руководства и анонсы. Premium: все допустимые сигналы на сайте, в приложении и Telegram, без дневного лимита.','Минимальное число сигналов в день не обещается.']:['📘 <b>Lire les signaux TousLesMatchs</b>','Football : Over 2,5 signifie au moins 3 buts ; Under 2,5 signifie au maximum 2 buts dans le temps réglementaire.','Un signal doit respecter les critères qualité actifs. Le vote IA ne garantit aucun résultat.','Gratuit : présentation, guides et aperçus. Premium : tous les signaux admissibles sur le site, l’application et Telegram, sans plafond quotidien.','Aucun minimum de signaux par jour n’est promis.'];
  } else if(kind==='reminder'||kind==='nopick') {
    lines=ru?['💎 <b>TousLesMatchs Premium</b>','Бесплатный канал: знакомство с сервисом и руководства.','Premium: все допустимые футбольные сигналы на сайте, в приложении и Telegram, без дневного лимита.','Минимальное число сигналов в день не обещается. Мы не публикуем сигнал ради количества.']:['💎 <b>TousLesMatchs Premium</b>','Gratuit : présentation du service et guides.','Premium : tous les signaux de football admissibles sur le site, l’application et Telegram, sans plafond quotidien.','Aucun minimum quotidien promis. Aucun signal forcé.'];
  } else throw new Error('Unknown client template');
  if(free || ['reminder','nopick','guide'].includes(kind)) {
    lines.push(paymentVerified ? `<a href="${payment(dest.lang)}">${CTA[dest.lang]}</a>` :
      ru ? 'Подписка Premium — 14,90 €/месяц, без обязательств. Новые подписки временно недоступны.' :
      'Premium — 14,90 €/mois, sans engagement. Les nouvelles souscriptions sont temporairement indisponibles.');
  }
  lines.push(legal(dest.lang));
  const text=lines.filter(Boolean).join('\n\n');
  if(text.length>4096) throw new Error('Telegram template too long');
  return {chat_id:dest.id,text,parse_mode:'HTML',disable_web_page_preview:true,...(free&&paymentVerified?{reply_markup:{inline_keyboard:[[{text:CTA[dest.lang],url:payment(dest.lang)}]]}}:(free?{}:{reply_markup:{inline_keyboard:buildInlineKeyboard()}}))};
}
function request(token,payload) {
  return new Promise(resolve=>{
    const body=JSON.stringify(payload);
    const req=https.request({hostname:'api.telegram.org',path:`/bot${token}/sendMessage`,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:15000},res=>{
      let raw='';res.on('data',x=>raw+=x);res.on('end',()=>{try{
        const p=JSON.parse(raw),ok=res.statusCode===200 && p.ok===true && Number.isInteger(p.result?.message_id) && p.result.message_id>0;
        resolve({ok,messageId:ok?p.result.message_id:null,uncertain:p.ok===true&&!ok,retryAfter:Number(p.parameters?.retry_after)||60});
      }catch{resolve({ok:false,uncertain:true});}});
    });
    req.on('error',()=>resolve({ok:false,uncertain:true}));req.on('timeout',()=>req.destroy());req.end(body);
  });
}
function createPublisher({db,env,transport=request,now=Date.now,onDelivered=()=>{},paymentAvailable=()=>false}) {
  const targets=destinations(env);
  db.exec(`CREATE TABLE IF NOT EXISTS client_telegram_outbox (
    delivery_key TEXT PRIMARY KEY, kind TEXT NOT NULL, channel TEXT NOT NULL, chat_id TEXT NOT NULL,
    match_key TEXT, market TEXT, votes INTEGER, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
    message_id INTEGER, next_at INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL, delivered_at INTEGER);
    CREATE INDEX IF NOT EXISTS client_tg_pending ON client_telegram_outbox(state,next_at);`);
  // Interruption pendant une requête : livraison inconnue, pas de renvoi automatique aveugle.
  db.prepare("UPDATE client_telegram_outbox SET state='uncertain' WHERE state='sending' AND next_at<?").run(now());
  let busy=false;
  function enqueue(kind,data,dest,key,expiresAt=now()+7*86400000) {
    const payload=render(kind,data,{...dest,paymentVerified:paymentAvailable()});
    return db.prepare(`INSERT OR IGNORE INTO client_telegram_outbox(delivery_key,kind,channel,chat_id,match_key,market,votes,payload,expires_at,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`).run(`${kind}:${key}:${dest.id}`,kind,dest.channel,dest.id,data.matchKey||null,data.market||'',Number(data.votes)||0,JSON.stringify(payload),expiresAt,now()).changes > 0;
  }
  async function flush() {
    if(busy || !env.TELEGRAM_BOT_TOKEN)return false;busy=true;
    try {
      const rows=db.prepare("SELECT * FROM client_telegram_outbox WHERE state='pending' AND next_at<=? ORDER BY created_at LIMIT 40").all(now());
      for(const row of rows) {
        if(!targets.some(t=>t.channel===row.channel&&t.id===row.chat_id))continue;
        if(row.expires_at<=now()){db.prepare("UPDATE client_telegram_outbox SET state='expired' WHERE delivery_key=?").run(row.delivery_key);continue;}
        const claim=db.prepare("UPDATE client_telegram_outbox SET state='sending',next_at=? WHERE delivery_key=? AND state='pending'").run(now()+60000,row.delivery_key);
        if(!claim.changes)continue;
        let result;
        try { result=await transport(env.TELEGRAM_BOT_TOKEN,JSON.parse(row.payload)); }
        catch { result={ok:false,uncertain:true}; }
        if(result.ok && Number.isInteger(result.messageId) && result.messageId>0) {
          db.transaction(()=>{
            db.prepare("UPDATE client_telegram_outbox SET state='delivered',message_id=?,delivered_at=? WHERE delivery_key=?").run(result.messageId,now(),row.delivery_key);
            if(row.kind==='signal') {
              db.prepare(`INSERT INTO telegram_signal_deliveries(match_key,channel,telegram_message_id,market,vote_count,ok) VALUES(?,?,?,?,?,1)`).run(row.match_key,row.channel,result.messageId,row.market,row.votes);
              if(row.channel==='premium'||row.channel==='free') db.prepare(`UPDATE concile_analyses SET sig_sent_${row.channel}=1 WHERE match_key=?`).run(row.match_key);
            }
          })();
          try { onDelivered(row); } catch { /* proof already committed */ }
        } else db.prepare("UPDATE client_telegram_outbox SET state=?,next_at=? WHERE delivery_key=?").run((result.uncertain||result.ok)?'uncertain':'pending',now()+Math.max(30,result.retryAfter||60)*1000,row.delivery_key);
      }
      return true;
    } finally {busy=false;}
  }
  return {targets,enqueue,flush};
}
async function verifiedPrice(stripe,priceId) {
  const price=await stripe.prices.retrieve(priceId,{expand:['product']});
  if(!price.active || price.livemode!==true || price.product?.livemode!==true || price.currency!=='eur' || price.unit_amount!==1490 ||
      price.recurring?.interval!=='month' || price.recurring?.interval_count!==1 ||
      !price.product?.active) throw new Error('Premium monthly price unavailable');
  return price;
}
async function verifiedCheckout(stripe,priceId,lang) {
  const price=await verifiedPrice(stripe,priceId);
  const language=lang==='ru'?'ru':'fr';
  return stripe.checkout.sessions.create({mode:'subscription',locale:language,
    line_items:[{price:price.id,quantity:1}],
    metadata:{plan:'premium',tlm_language:language,preferred_language:language,language},
    subscription_data:{metadata:{plan:'premium',tlm_language:language,preferred_language:language,language}},
    success_url:'https://www.touslesmatchs.com/merci?session_id={CHECKOUT_SESSION_ID}',
    cancel_url:'https://www.touslesmatchs.com/#plans'});
}
module.exports={verifiedPrice,verifiedCheckout,CTA,PAYMENT,payment,legal,esc,destinations,marketRu,render,request,createPublisher};
