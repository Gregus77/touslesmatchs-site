#!/usr/bin/env node
'use strict';

const fs=require('fs');
const https=require('https');
const path=require('path');

const ROOT=process.env.TLM_ROOT||'/opt/touslesmatchs';
const REPORT=process.env.TLM_AUTO_IMPROVER_REPORT||path.join(ROOT,'data/auto-improver/latest.json');
const STATE=process.env.TLM_AUTO_IMPROVER_NOTIFY_STATE||path.join(ROOT,'data/auto-improver/notify-state.json');
const CHECK=process.argv.includes('--check');
const SEND=process.argv.includes('--send');

function loadEnv(file){
  const env={...process.env};
  if(!fs.existsSync(file)) return env;
  for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    if(!line || /^\s*#/.test(line) || !line.includes('=')) continue;
    const i=line.indexOf('='),k=line.slice(0,i).trim();
    let v=line.slice(i+1).trim();
    if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);
    if(!(k in env)) env[k]=v;
  }
  return env;
}
const env=loadEnv(path.join(ROOT,'.env'));

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function writeJson(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(obj,null,2)+'\n',{mode:0o600});}
function pct(v){return v==null?'—':String(v).replace('.',',')+' %';}
function euro(v){return v==null?'—':String(v).replace('.',',')+' %';}
function topSegment(list){
  const eligible=(list||[]).filter(x=>x.n>=3 && x.winrate!=null);
  if(!eligible.length)return null;
  return eligible.sort((a,b)=>b.winrate-a.winrate||b.n-a.n)[0];
}
function worstSegment(list){
  const eligible=(list||[]).filter(x=>x.n>=3 && x.winrate!=null);
  if(!eligible.length)return null;
  return eligible.sort((a,b)=>a.winrate-b.winrate||b.n-a.n)[0];
}
function telegramText(r){
  const g=r.global||{};
  const best=topSegment(r.segments&&r.segments.competition);
  const worst=worstSegment(r.segments&&r.segments.competition);
  const lines=[
    '🧠 AUTO-IMPROVER · +0,5 équipe ciblée',
    '',
    'Résolus : '+(g.n||0)+' · ✅ '+(g.wins||0)+' WIN · ❌ '+(g.losses||0)+' LOSS',
    'Réussite : '+pct(g.winrate),
    g.roi==null?'ROI : non calculé (cotes réelles insuffisantes)':'ROI : '+euro(g.roi),
  ];
  if(best)lines.push('📈 Meilleur segment : '+best.name+' · '+best.wins+'/'+best.n+' ('+pct(best.winrate)+')');
  if(worst&&(!best||worst.name!==best.name))lines.push('📉 À surveiller : '+worst.name+' · '+worst.wins+'/'+worst.n+' ('+pct(worst.winrate)+')');
  lines.push('');
  if(r.decision==='OBSERVATION_ONLY_SAMPLE_TOO_SMALL') lines.push('🟠 Statut : observation uniquement — échantillon encore trop faible pour modifier automatiquement les règles.');
  else lines.push('🟡 Statut : éligible aux tests shadow uniquement — aucune règle dure modifiée.');
  lines.push('🔒 Règles +0,5 V2 inchangées : Top5/Bottom5 · 30–85 · cote réelle ≥ 1,60 · consensus ≥ 4/5.');
  return lines.join('\n').slice(0,3900);
}
function htmlReport(r){
  const g=r.global||{};
  const rows=(r.segments&&r.segments.competition||[]).slice(0,8).map(s =>
    '<tr><td style="padding:7px;border-bottom:1px solid #ddd">'+esc(s.name)+'</td>'+
    '<td style="padding:7px;border-bottom:1px solid #ddd;text-align:center">'+s.n+'</td>'+
    '<td style="padding:7px;border-bottom:1px solid #ddd;text-align:center">'+(s.winrate==null?'—':esc(String(s.winrate).replace('.',','))+' %')+'</td></tr>'
  ).join('');
  return '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#111;line-height:1.55">'+
    '<h1>Bilan IA +0,5 équipe ciblée</h1>'+
    '<p><strong>'+Number(g.n||0)+' résultats résolus : '+Number(g.wins||0)+' WIN / '+Number(g.losses||0)+' LOSS</strong><br>'+
    'Taux observé : '+esc(pct(g.winrate))+'</p>'+
    '<p>'+(g.roi==null?'Le ROI n’est pas affiché tant que les cotes réelles disponibles sont insuffisantes.':'ROI sur lignes avec cote réelle : '+esc(euro(g.roi)))+'</p>'+
    '<h2>Par compétition</h2><table style="border-collapse:collapse;width:100%"><thead><tr><th style="text-align:left">Compétition</th><th>N</th><th>Réussite</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<p style="margin-top:22px"><strong>Auto-amélioration :</strong> '+(r.decision==='OBSERVATION_ONLY_SAMPLE_TOO_SMALL'?'observation uniquement, échantillon encore trop faible.':'tests shadow autorisés, aucune règle dure modifiée automatiquement.')+'</p>'+
    '<p>La stratégie suivie reste +0,5 but sur une équipe ciblée avec les garde-fous Goal05 V2.</p>'+
    '<p style="font-size:12px;color:#666;margin-top:28px">18+ uniquement. Analyses informatives, aucun gain n’est garanti. Jouez de façon responsable.</p>'+
    '</div>';
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function requestJson({hostname,path:apiPath,method='POST',headers={}},payload){
  return new Promise((resolve,reject)=>{
    const body=payload==null?null:Buffer.from(JSON.stringify(payload));
    const req=https.request({hostname,path:apiPath,method,headers:{accept:'application/json',...(body?{'content-type':'application/json','content-length':body.length}:{}),...headers}},res=>{
      let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{
        let data={};try{data=raw?JSON.parse(raw):{};}catch{data={raw};}
        if(res.statusCode>=200&&res.statusCode<300)resolve({status:res.statusCode,data});
        else reject(new Error(hostname+' '+res.statusCode+' '+String(raw).slice(0,300)));
      });
    });
    req.on('error',reject);req.setTimeout(15000,()=>req.destroy(new Error('timeout')));
    if(body)req.write(body);req.end();
  });
}
async function sendTelegram(message){
  const token=(env.HERMES_ADMIN_TLM_BOT||env.TELEGRAM_BOT_TOKEN||'').trim();
  const chat=(env.TELEGRAM_ADMIN_CHAT_ID||'').trim();
  if(!token||!chat)return {ok:false,skipped:true,reason:'telegram admin non configuré'};
  const out=await requestJson({hostname:'api.telegram.org',path:'/bot'+token+'/sendMessage'}, {chat_id:chat,text:message});
  const id=out.data&&out.data.result&&out.data.result.message_id;
  if(!out.data.ok||!Number.isInteger(id))throw new Error('Telegram sans message_id');
  return {ok:true,messageId:id};
}
async function sendBrevoCampaign(r){
  const key=(env.BREVO_API_KEY||'').trim();
  const listId=Number(env.BREVO_LIST_ID||0);
  const senderEmail=(env.BREVO_SENDER_EMAIL||'noreply@touslesmatchs.com').trim();
  const senderName=(env.BREVO_SENDER_NAME||'TousLesMatchs').trim();
  if(!key||!Number.isInteger(listId)||listId<=0)return {ok:false,skipped:true,reason:'Brevo liste/API non configurée'};
  const date=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'short'}).format(new Date());
  const create=await requestJson(
    {hostname:'api.brevo.com',path:'/v3/emailCampaigns',headers:{'api-key':key}},
    {name:'TLM Auto-Improver '+date,subject:'TousLesMatchs — bilan +0,5 du '+date,
     sender:{name:senderName,email:senderEmail},type:'classic',
     htmlContent:htmlReport(r),recipients:{listIds:[listId]}}
  );
  const id=Number(create.data&&create.data.id);
  if(!Number.isInteger(id)||id<=0)throw new Error('Brevo campagne sans id');
  await requestJson({hostname:'api.brevo.com',path:'/v3/emailCampaigns/'+id+'/sendNow',headers:{'api-key':key}},null);
  return {ok:true,campaignId:id};
}

async function main(){
  if(!fs.existsSync(REPORT))throw new Error('rapport auto-improver absent');
  const report=readJson(REPORT,null);
  if(!report||!report.generatedAt||!report.global)throw new Error('rapport auto-improver invalide');

  const checks={
    report:true,
    telegram:Boolean((env.HERMES_ADMIN_TLM_BOT||env.TELEGRAM_BOT_TOKEN)&&env.TELEGRAM_ADMIN_CHAT_ID),
    brevo:Boolean(env.BREVO_API_KEY&&Number(env.BREVO_LIST_ID||0)>0),
    brevoListId:Number(env.BREVO_LIST_ID||0)||null
  };
  if(CHECK&&!SEND){console.log('AUTO_IMPROVER_NOTIFY_CHECK '+JSON.stringify(checks));return;}
  if(!SEND)throw new Error('utiliser --check ou --send');

  const parisDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const state=readJson(STATE,{});
  const result={at:new Date().toISOString(),day:parisDay,telegram:null,brevo:null};

  if(state.telegramDay===parisDay)result.telegram={ok:true,skipped:true,reason:'déjà envoyé aujourd’hui'};
  else {
    result.telegram=await sendTelegram(telegramText(report));
    if(result.telegram.ok)state.telegramDay=parisDay;
  }

  if(state.brevoDay===parisDay)result.brevo={ok:true,skipped:true,reason:'déjà envoyé aujourd’hui'};
  else {
    result.brevo=await sendBrevoCampaign(report);
    if(result.brevo.ok)state.brevoDay=parisDay;
  }

  state.last=result;
  writeJson(STATE,state);
  console.log('AUTO_IMPROVER_NOTIFY_OK '+JSON.stringify(result));
}
main().catch(e=>{console.error('AUTO_IMPROVER_NOTIFY_ERROR '+e.message);process.exit(1);});
