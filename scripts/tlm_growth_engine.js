'use strict';

const fs=require('fs');
const path=require('path');
const https=require('https');

const ROOT=process.env.TLM_ROOT||'/opt/touslesmatchs';
const OUT=process.env.TLM_GROWTH_DIR||path.join(ROOT,'data/growth');
const BASE=process.env.TLM_PUBLIC_BASE||'https://www.touslesmatchs.com';
const NOTIFY=process.argv.includes('--notify');

function loadEnv(file=path.join(ROOT,'.env')){
  if(!fs.existsSync(file))return {};
  const out={};
  for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('#')||!line.includes('='))continue;
    const i=line.indexOf('=');
    out[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^['"]|['"]$/g,'');
  }
  return out;
}
const env={...loadEnv(),...process.env};

function getJson(url){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{'User-Agent':'TousLesMatchs-Growth/1.0','Cache-Control':'no-cache'},timeout:20000},res=>{
      let raw='';
      res.on('data',d=>raw+=d);
      res.on('end',()=>{
        if(res.statusCode<200||res.statusCode>=300)return reject(new Error('HTTP '+res.statusCode+' '+url));
        try{resolve(JSON.parse(raw));}catch(e){reject(new Error('JSON '+url));}
      });
    });
    req.on('timeout',()=>req.destroy(new Error('timeout')));
    req.on('error',reject);
  });
}

function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function parisStamp(){
  return new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'full',timeStyle:'short'}).format(new Date());
}
function arr(x){return Array.isArray(x)?x:[];}
function first(...v){return v.find(x=>x!==undefined&&x!==null&&x!=='');}

function extractCandidates(live){
  const rows=arr(first(live.matches,live.fixtures,live.data,live.results));
  return rows.map(m=>{
    const g=m.goal05||m.goal_05||{};
    const rating=Number(first(g.rating,m.rating,m.scanner_rating));
    const target=first(g.targetTeam,g.target_team,m.targetTeam,m.target_team);
    const home=first(m.home?.name,m.home,m.home_team,m.teams?.home?.name);
    const away=first(m.away?.name,m.away,m.away_team,m.teams?.away?.name);
    const competition=first(m.competition?.name,m.competition,m.league?.name,m.league_name);
    const kickoff=first(m.kickoff,m.start,m.date,m.fixture?.date);
    const color=first(g.color,m.color,rating>=8?'green':null);
    return {home,away,target,competition,kickoff,rating:Number.isFinite(rating)?rating:null,color};
  }).filter(x=>x.home&&x.away&&x.target&&(x.color==='green'||Number(x.rating)>=8)).slice(0,3);
}

function extractProofs(stats){
  return arr(stats.scannerRecent).slice(0,5).map(x=>({
    home:x.home,away:x.away,target:first(x.target_team,x.targetTeam),outcome:x.outcome,
    rating:x.rating,color:x.color
  })).filter(x=>x.home&&x.away);
}

function socialFr(candidates,proofs){
  const lines=['🤖 ANALYSES SPORTIVES IA — TOUSLESMATCHS',''];
  if(candidates.length){
    lines.push('Matchs à surveiller aujourd’hui :');
    candidates.forEach((x,i)=>lines.push((i+1)+'. '+x.home+' — '+x.away+(x.target?' · équipe suivie : '+x.target:'')+(x.rating?' · '+x.rating+'/10':'')));
  }else{
    lines.push('Aucun candidat suffisamment documenté à publier pour le moment. On préfère ne rien forcer.');
  }
  if(proofs.length){
    const w=proofs.filter(x=>x.outcome==='win').length,l=proofs.filter(x=>x.outcome==='loss').length;
    lines.push('', 'Historique récent vérifié : '+w+' gagné(s) · '+l+' perdu(s) · '+(proofs.length-w-l)+' à vérifier.');
  }
  lines.push('','📊 Historique public : '+BASE+'/performances.html','✈️ Telegram : '+BASE+'/go/tiktok?v=growth-daily','18+ · Analyse sportive · Aucun gain garanti.');
  return lines.join('\n');
}
function socialRu(candidates,proofs){
  const lines=['🤖 СПОРТИВНЫЙ ИИ-АНАЛИЗ — TOUSLESMATCHS',''];
  if(candidates.length){
    lines.push('Матчи для наблюдения сегодня:');
    candidates.forEach((x,i)=>lines.push((i+1)+'. '+x.home+' — '+x.away+(x.target?' · команда: '+x.target:'')+(x.rating?' · '+x.rating+'/10':'')));
  }else{
    lines.push('Сейчас нет достаточно подтверждённых кандидатов для публикации. Ничего не форсируем.');
  }
  if(proofs.length){
    const w=proofs.filter(x=>x.outcome==='win').length,l=proofs.filter(x=>x.outcome==='loss').length;
    lines.push('', 'Проверенная история: '+w+' выиграно · '+l+' проиграно · '+(proofs.length-w-l)+' ожидают проверки.');
  }
  lines.push('','📊 Публичная история: '+BASE+'/performances.html','✈️ Telegram: '+BASE+'/go/tiktok?v=growth-daily-ru','18+ · Спортивный анализ · Выигрыш не гарантирован.');
  return lines.join('\n');
}

function brevoDraft(fr){
  return '<!doctype html><html><body style="font-family:Arial,sans-serif;max-width:640px;margin:auto">'+
    '<h2>Analyses sportives du jour</h2><p>'+esc(fr).replace(/\n/g,'<br>')+'</p>'+
    '<p><a href="'+BASE+'/performances.html">Voir les résultats vérifiés</a></p>'+
    '<p style="font-size:12px;color:#666">18+ · Analyse sportive · Aucun gain garanti.</p></body></html>';
}

function telegramSend(text){
  const token=(env.HERMES_ADMIN_TLM_BOT||env.TELEGRAM_BOT_TOKEN||'').trim();
  const chat=(env.TELEGRAM_ADMIN_CHAT_ID||'').trim();
  if(!token||!chat)return Promise.resolve({ok:false,skipped:true});
  const body=JSON.stringify({chat_id:chat,text,disable_web_page_preview:true});
  return new Promise(resolve=>{
    const req=https.request({hostname:'api.telegram.org',path:'/bot'+token+'/sendMessage',method:'POST',
      headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)},timeout:15000},res=>{
      let raw='';res.on('data',d=>raw+=d);res.on('end',()=>{try{const j=JSON.parse(raw);resolve({ok:res.statusCode===200&&j.ok===true});}catch{resolve({ok:false});}});
    });
    req.on('error',()=>resolve({ok:false}));req.on('timeout',()=>req.destroy());req.write(body);req.end();
  });
}

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const [statsRes,liveRes]=await Promise.allSettled([
    getJson(BASE+'/api/goal05/stats?t='+Date.now()),
    getJson(BASE+'/api/live-matches?cache_only=1&t='+Date.now())
  ]);
  const stats=statsRes.status==='fulfilled'?statsRes.value:{};
  const live=liveRes.status==='fulfilled'?liveRes.value:{};
  const candidates=extractCandidates(live);
  const proofs=extractProofs(stats);
  const fr=socialFr(candidates,proofs),ru=socialRu(candidates,proofs);
  const report={
    generated_at:new Date().toISOString(),generated_paris:parisStamp(),candidates,proofs,
    seo:{sitemap:BASE+'/sitemap-pronostics.xml',results:BASE+'/performances.html'},
    tracking:{telegram:BASE+'/go/tiktok?v=growth-daily',share:BASE+'/?utm_source=share&utm_medium=organic'},
    drafts:{fr,ru}
  };
  fs.writeFileSync(path.join(OUT,'latest.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(OUT,'social-fr.txt'),fr+'\n');
  fs.writeFileSync(path.join(OUT,'social-ru.txt'),ru+'\n');
  fs.writeFileSync(path.join(OUT,'brevo-draft.html'),brevoDraft(fr));
  fs.writeFileSync(path.join(OUT,'latest.md'),
    '# Growth TousLesMatchs\n\nGénéré : '+report.generated_paris+'\n\n## Candidats\n'+
    (candidates.length?candidates.map((x,i)=>(i+1)+'. '+x.home+' — '+x.away+' · '+x.target+(x.rating?' · '+x.rating+'/10':'')).join('\n'):'Aucun candidat vérifiable.')+
    '\n\n## Contenu FR\n\n'+fr+'\n\n## Contenu RU\n\n'+ru+'\n');
  if(NOTIFY){
    await telegramSend('📈 GROWTH TLM — '+report.generated_paris+'\n'+
      'Candidats exploitables : '+candidates.length+'\n'+
      'Preuves récentes : '+proofs.length+'\n'+
      'SEO : sitemap + pages résultats actifs\n'+
      'Contenus FR/RU générés dans data/growth/.');
  }
  console.log(JSON.stringify({ok:true,candidates:candidates.length,proofs:proofs.length,out:OUT}));
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
