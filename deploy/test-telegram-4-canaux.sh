#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs

echo "TEST TELEGRAM — aucun fichier du site n'est modifié"

docker compose exec -T api node <<'NODE'
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const targets = [
  ['Hermès', process.env.TELEGRAM_ADMIN_CHAT_ID || ''],
  ['Gratuit', process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_FREE_CHANNEL_ID || ''],
  ['Standard', process.env.TELEGRAM_STANDARD_CHANNEL_ID || ''],
  ['Premium', process.env.TELEGRAM_PREMIUM_CHANNEL_ID || ''],
];

function mask(id) {
  const s=String(id||'');
  return s.length > 8 ? s.slice(0,4)+'…'+s.slice(-4) : (s || '(vide)');
}
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  const d = await r.json().catch(()=>({ok:false,description:'réponse JSON invalide'}));
  return d;
}

(async()=>{
  if(!token){ console.error('❌ TELEGRAM_BOT_TOKEN absent du conteneur API'); process.exit(2); }
  const me=await tg('getMe',{});
  if(!me.ok){ console.error('❌ Bot Telegram invalide:',me.description||'erreur inconnue'); process.exit(2); }
  console.log(`Bot: @${me.result.username} (${me.result.id})`);

  let failed=0;
  const ids = new Map();
  for(const [name,id] of targets){
    if(!id){ console.error(`❌ ${name}: ID NON CONFIGURÉ`); failed++; continue; }
    if(ids.has(id)) console.warn(`⚠️ ${name}: même chat_id que ${ids.get(id)} (${mask(id)})`);
    else ids.set(id,name);

    const chat=await tg('getChat',{chat_id:id});
    if(!chat.ok){ console.error(`❌ ${name} ${mask(id)}: getChat = ${chat.description||'FAIL'}`); failed++; continue; }

    const text=`✅ TEST TOUSLESMATCHS — canal ${name}\nBot Telegram opérationnel.\n${new Date().toLocaleString('fr-FR',{timeZone:'Europe/Paris'})}`;
    const sent=await tg('sendMessage',{chat_id:id,text,disable_notification:false});
    if(sent.ok) console.log(`✅ ${name}: MESSAGE ENVOYÉ — ${chat.result.title||chat.result.username||mask(id)} — message_id=${sent.result.message_id}`);
    else { console.error(`❌ ${name}: ENVOI ÉCHOUÉ — ${sent.description||'FAIL'}`); failed++; }
  }
  console.log(failed ? `\nRÉSULTAT: ${failed} canal(aux) en échec` : '\nRÉSULTAT: ✅ 4/4 CANAUX OK');
  process.exit(failed ? 1 : 0);
})().catch(e=>{ console.error('❌ Erreur test:',e.message); process.exit(2); });
NODE
