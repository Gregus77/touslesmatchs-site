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
// La cote seule ne suffit pas : affiche aussi l'horodatage réel, sinon alerte.
function goal05PriceLines(data,ru) {
  const odd=Number(data.odd);
  const validOdd=Number.isFinite(odd)&&odd>1;
  const observedAt=Date.parse(String(data.oddFetchedAt||''));
  const hasTime=Number.isFinite(observedAt);
  const maxAge=Math.max(30000,Number(process.env.GOAL05_ODD_MAX_AGE_MS||120000));
  const age=hasTime?Date.now()-observedAt:Infinity;
  const fresh=hasTime&&age>=0&&age<=maxAge;
  const time=hasTime?new Intl.DateTimeFormat(ru?'ru-RU':'fr-FR',{
    timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hour12:false
  }).format(new Date(observedAt)):null;
  const quote=validOdd?odd.toFixed(2).replace('.',','):(ru?'недоступен':'indisponible');
  const lines=[`💰 ${ru?'Реальный коэффициент':'Cote réelle'} : <b>${quote}</b>${time?' · '+time+' (Paris)':''}`];
  if(!validOdd) lines.push(ru?'⛔ Нет подтверждённого коэффициента. Ставка не рекомендована.':'⛔ Cote réelle indisponible : aucune sélection jouable.');
  else if(odd<1.60) lines.push(ru?'🔴 Коэффициент ниже 1,60. Не ставьте на +0,5 гола команды до достижения 1,60.':'🔴 Cote insuffisante : ne misez sur +0,5 but équipe que si la cote réelle atteint au moins 1,60.');
  else if(!fresh) lines.push(ru?'⚠️ Коэффициент устарел или время неизвестно : не играть без обновления.':'⚠️ Cote non datée ou périmée : ne misez pas sans une nouvelle vérification.');
  else lines.push(ru?'✅ Порог 1,60 соблюдён. Проверьте коэффициент у букмекера перед решением.':'✅ Seuil 1,60 atteint. Revérifiez la cote chez le bookmaker avant toute décision.');
  return lines;
}
// Campagne de lancement : la date et la confirmation viennent de la configuration de production.
// Aucune date artificielle et aucun compte à rebours réinitialisé à chaque ouverture.
function freeOfferClock(ru,at=Date.now()) {
  if(process.env.TLM_FREE_OFFER_CONFIRMED!=='1')return null;
  const raw=String(process.env.TLM_FREE_OFFER_ENDS_AT||'');
  if(!/Z$|[+-]\d\d:\d\d$/.test(raw))return null;
  const end=Date.parse(raw);
  if(!Number.isFinite(end)||end<=at)return null;
  const days=Math.floor((end-at)/86400000);
  const hours=Math.floor((end-at)%86400000/3600000);
  return ru
    ? `⏳ Подтверждённый конец ознакомительной акции через ${days} д. ${hours} ч. Условия бесплатного доступа доступны на сайте.`
    : `⏳ Offre gratuite de lancement : fin annoncée dans ${days} j ${hours} h. Conditions de l'accès Gratuit disponibles sur le site.`;
}
function render(kind,data,dest) {
  const ru=dest.lang==='ru',free=dest.tier==='free',paymentVerified=dest.paymentVerified===true;
  const launchAllAccess=process.env.TLM_LAUNCH_ALL_ACCESS==='1';
  const effectiveFree=free&&!launchAllAccess;
  const market=()=>esc(ru?marketRu(data.market):data.market);
  const match=()=>`⚽ <b>${esc(data.home)} — ${esc(data.away)}</b>`;
  let lines=[];
  if (kind==='signal') {
    lines=[`🚨 <b>${ru?'СИГНАЛ ИИ':'SIGNAL CONSEIL IA'}${free?(ru?' ОБНАРУЖЕН':' DÉTECTÉ'):''}</b>`,match(),`🏆 ${esc(data.competition)}`,
      `⏱ ${ru?'Минута':'Minute'} : ${esc(data.minute)} · ${ru?'Счёт':'Score'} : ${esc(data.scoreHome)}-${esc(data.scoreAway)}`,
      `🧠 ${ru?'Голосование ИИ':'Vote IA'} : ${esc(data.votes)}/5`,
      `📊 ${ru?'Уровень доверия':'Score de confiance'} : ${esc(data.confidence)}/100`];
    if (effectiveFree) lines.push(ru?'🔒 Точный прогноз и обоснование доступны только подписчикам Premium.':'🔒 La sélection exacte et la raison sont réservées aux membres Premium.');
    else {
      lines.push(`💡 ${ru?'Прогноз':'Sélection'} : <b>${market()}</b>`, `💰 ${ru?'Коэффициент':'Cote'} : ${data.odd?esc(data.odd):ru?'недоступен':'indisponible'}`);
      // Résumé RU déterministe fondé uniquement sur les votes observés ; aucune justification FR copiée.
      lines.push(ru?`Обоснование: ${esc(data.votes)} из 5 ИИ поддержали этот прогноз; уровень доверия — ${esc(data.confidence)}/100.`:esc(data.reason || `${data.votes} IA sur 5 soutiennent cette sélection.`));
    }
  } else if(kind==='goal05') {
    const target=esc(data.targetTeam || '');
    lines=[
      `🚨 <b>${ru?'СИГНАЛ +0,5 ГОЛА КОМАНДЫ':'SIGNAL +0,5 BUT ÉQUIPE'}${free?(ru?' ОБНАРУЖЕН':' DÉTECTÉ'):''}</b>`,
      match(),
      `🏆 ${esc(data.competition)}`,
      `⏱ ${ru?'Минута':'Minute'} : ${esc(data.minute)} · ${ru?'Счёт':'Score'} : ${esc(data.scoreHome)}-${esc(data.scoreAway)}`,
      `🧠 ${ru?'Голосование ИИ':'Vote IA'} : ${esc(data.votes)}/5`,
      data.rating ? `📊 ${ru?'Оценка V2':'Note V2'} : ${esc(data.rating)}/10 ${data.color==='green'?'🟢':data.color==='orange'?'🟠':data.color==='red'?'🔴':'⚪'}` : null
    ].filter(Boolean);
    lines.push(...goal05PriceLines(data,ru));
    if (effectiveFree) {
      lines.push(ru
        ? '🔒 Название команды и обоснование доступны участникам Premium. Коэффициент сам по себе не является сигналом.'
        : '🔒 Le nom de l’équipe et la justification restent réservés à Premium. La cote seule n’est pas un signal.');
    } else {
      lines.push(
        `🎯 ${ru?'Команда должна забить минимум 1 гол':'Équipe ciblée — marque au moins 1 but'} : <b>${target}</b>`,
        data.historicalSeasons ? `📚 ${ru?'История':'Historique'} : Top ${esc(data.historicalTop||0)}/${esc(data.historicalSeasons)} ${ru?'сезонов':'saisons'}` : null,
        data.historyScore ? `📈 ${ru?'Историческая сила':'Force historique'} : ${esc(data.historyScore)}/100` : null
      );
      lines=lines.filter(Boolean);
      if (data.reason) lines.push(ru
        ? `Условия проверены: Top 5 против Bottom 5, live и ${esc(data.votes)}/5 голосов ИИ.`
        : esc(data.reason));
    }
    lines.push(ru
      ? '🔀 Комбинация двух разных матчей — отдельная стратегия повышенного риска. Общий коэффициент вычисляется только по двум свежим реальным котировкам; выигрывают оба исхода, гарантии нет.'
      : '🔀 Profil plus risqué : combiner 2 matchs distincts peut viser une cote totale ≥ 1,60, mais les 2 sélections doivent réussir. Aucun combiné sans 2 cotes réelles fraîches et 2 dossiers validés.');
    lines.push(ru
      ? '🔗 Партнёрские ссылки на букмекеров — кнопки ниже. 18+.'
      : '🔗 Comparer chez nos partenaires : boutons affiliés ci-dessous. 18+.');
  } else if(kind==='result') {
    lines=[`${data.outcome==='win'?'✅':'❌'} <b>${ru?(data.outcome==='win'?'ВЫИГРЫШ':'ПРОИГРЫШ'):(data.outcome==='win'?'SIGNAL GAGNÉ':'SIGNAL PERDU')}</b>`,match(),`⚽ ${ru?'Итоговый счёт':'Score final'} : ${esc(data.scoreHome)}-${esc(data.scoreAway)}`];
    lines.push(
      `🎯 ${ru?'Исходный прогноз':'Prédiction originale'} : <b>${market()}</b>`,
      `💰 ${ru?'Исходный коэффициент':'Cote originale'} : ${data.odd?esc(data.odd):ru?'недоступен':'indisponible'}`,
      `⏱ ${ru?'Сигнал на минуте':'Signal donné à la minute'} : ${esc(data.signalMinute ?? '?')} · ${ru?'Счёт тогда':'Score au signal'} : ${esc(data.signalScoreHome ?? '?')}-${esc(data.signalScoreAway ?? '?')}`,
      `🧠 ${ru?'Исходное голосование ИИ':'Vote IA original'} : ${esc(data.votes ?? '?')}/5`,
      `📊 ${ru?'Исходный уровень доверия':'Confiance originale'} : ${esc(data.confidence ?? '?')}/100`
    );
  } else if(kind==='scanner') {
    function flag(country){
      const x=String(country||'').toLowerCase();
      if(x.includes('ireland'))return '🇮🇪';
      if(x.includes('france'))return '🇫🇷';
      if(x.includes('england'))return '🏴';
      if(x.includes('scotland'))return '🏴';
      if(x.includes('spain'))return '🇪🇸';
      if(x.includes('italy'))return '🇮🇹';
      if(x.includes('netherlands'))return '🇳🇱';
      if(x.includes('belgium'))return '🇧🇪';
      if(x.includes('denmark'))return '🇩🇰';
      if(x.includes('norway'))return '🇳🇴';
      if(x.includes('brazil'))return '🇧🇷';
      if(x.includes('argentina'))return '🇦🇷';
      if(x.includes('japan'))return '🇯🇵';
      if(x.includes('south korea')||x.includes('korea'))return '🇰🇷';
      if(x.includes('usa')||x.includes('united states'))return '🇺🇸';
      if(x.includes('chile'))return '🇨🇱';
      if(x.includes('uruguay'))return '🇺🇾';
      if(x.includes('paraguay'))return '🇵🇾';
      if(x.includes('colombia'))return '🇨🇴';
      return '🌍';
    }
    function sportIcon(sport){
      const x=String(sport||'').toLowerCase();
      if(x.includes('football'))return '⚽';
      if(x.includes('basket'))return '🏀';
      if(x.includes('baseball'))return '⚾';
      if(x.includes('hockey'))return '🏒';
      return '🎯';
    }
    const rows=(Array.isArray(data.rows)?data.rows:[]).filter(function(row){
      return !!row.targetTeam && (row.color==='green' || Number(row.rating)>=8);
    }).slice(0,8);
    lines=['🔎 <b>CANDIDATS À SURVEILLER — SANS SIGNAL OFFICIEL</b>'];
    if(!rows.length) {
      lines.push('❌ <b>Aucun match à jouer pour le moment.</b>');
    } else {
      rows.forEach(function(row){
        lines.push(
          `${flag(row.country)} ${sportIcon(row.sport)} <b>${esc(row.country||'International')} · ${esc(row.sport||'Sport')}</b>`,
          `🕒 <b>${esc(row.kickoffLabel||'Heure à confirmer')}</b> — heure de Paris`,
          `🏟 <b>${esc(row.home)} — ${esc(row.away)}</b>`,
          `📊 Classement : ${esc(row.targetTeam)} ${esc(row.targetRank||'?')} · adversaire ${esc(row.opponentRank||'?')}`,
          `👀 <b>À surveiller : ${esc(row.targetTeam)} +0,5 but</b>`,
          row.rating!=null?`⭐ Confiance scanner : ${esc(row.rating)}/10`:'',
          ...(String(row.sport||'football').toLowerCase().includes('football')?goal05PriceLines(row,ru):[]),
          '⚠️ Aucun feu vert du scanner seul. Il faut les critères live et 4 IA sur 5.'
        );
      });
    }
  } else if(kind==='scanner_result') {
    const verdict=data.outcome==='win'?'✅ GAGNANT':data.outcome==='loss'?'❌ PERDU':'✅ TERMINÉ';
    lines=[`${verdict} — <b>RÉSULTAT SCANNER</b>`,
      `${esc(data.sport||'Sport')} · ${esc(data.country||'')} · ${esc(data.competition||'')}`,
      `<b>${esc(data.home)} — ${esc(data.away)}</b>`,
      `🏁 Score final : ${esc(data.scoreHome)}-${esc(data.scoreAway)}`];
    if(data.targetTeam)lines.push(`🎯 Sélection suivie : ${esc(data.targetTeam)} — ${esc(data.selection||'marque au moins un but')}`);
    if(data.rating!=null)lines.push(`⭐ Note scanner avant match : ${esc(data.rating)}/10`);
  } else if(kind==='recap') {
    const rows=data.rows,wins=rows.filter(x=>x.outcome==='win').length,losses=rows.filter(x=>x.outcome==='loss').length,pending=rows.length-wins-losses;
    const eurRub=Math.max(1,Number(process.env.EUR_RUB_DISPLAY_RATE||100));
    const stakeEur=10,stakeRub=Math.round(stakeEur*eurRub);
    const netEur=rows.reduce((sum,row)=>sum+(row.outcome==='win'&&Number(row.real_odd)>0?stakeEur*(Number(row.real_odd)-1):row.outcome==='loss'?-stakeEur:0),0);
    const netRub=Math.round(netEur*eurRub);
    lines=[`📊 <b>${ru?'ИТОГИ ДНЯ':'BILAN DU JOUR'} — ${esc(data.day)}${data.parts>1?` (${data.part}/${data.parts})`:''}</b>`];
    if(!rows.length) {
      lines.push(ru?'ℹ️ Сегодня официальные сигналы не публиковались. Матчи были проанализированы, но все критерии качества не были выполнены. Мы не публикуем прогноз ради количества.':'ℹ️ Aucun signal officiel diffusé aujourd’hui. Les matchs ont été analysés, mais tous les critères qualité n’étaient pas réunis. Aucun signal forcé.');
    } else {
      lines.push(`${ru?'Результаты дня':'Résultats du jour'} : ${ru?'выиграно':'gagnés'} ${wins} · ${ru?'проиграно':'perdus'} ${losses} · ${ru?'ожидают результата':'en attente'} ${pending}`,
        ru?`💰 Условная ставка: ${stakeRub} ₽ на сигнал · Чистый результат: ${netRub>=0?'+':''}${netRub} ₽`:`💰 Mise théorique : 10 € par signal · Résultat net : ${netEur>=0?'+':''}${netEur.toFixed(2)} €`,
        ru?'Расчёт является прозрачной симуляцией на основе исходных коэффициентов.':'Simulation transparente calculée avec les cotes originales.',
        ru?'Только сигналы с подтверждённой доставкой в этот канал.':'Uniquement les signaux dont la livraison dans ce canal est prouvée.');
      for(const row of rows) lines.push(`• ${esc(row.home)} — ${esc(row.away)} : ${row.outcome==='pending'?(ru?'ожидает результата':'en attente'):`${esc(row.final_score_home)}-${esc(row.final_score_away)}`}${free?'':` · ${esc(ru?marketRu(row.best_bet):row.best_bet)}`}`);
    }
  } else if(kind==='guide') {
    lines=ru?['📘 <b>Как читать сигналы TousLesMatchs</b>','Футбол: тотал больше 2,5 означает минимум 3 гола; тотал меньше 2,5 — максимум 2 гола за основное время.','Прогноз публикуется только при соблюдении действующих критериев качества. Голосование ИИ не гарантирует результат.','Бесплатный канал: знакомство с сервисом, руководства и анонсы. Premium: все допустимые сигналы на сайте, в приложении и Telegram, без дневного лимита.','Минимальное число сигналов в день не обещается.']:['📘 <b>Lire les signaux TousLesMatchs</b>','Football : Over 2,5 signifie au moins 3 buts ; Under 2,5 signifie au maximum 2 buts dans le temps réglementaire.','Un signal doit respecter les critères qualité actifs. Le vote IA ne garantit aucun résultat.','Gratuit : présentation, guides et aperçus. Premium : tous les signaux admissibles sur le site, l’application et Telegram, sans plafond quotidien.','Aucun minimum de signaux par jour n’est promis.'];
  } else if(kind==='reminder'||kind==='nopick') {
    lines=ru?['💎 <b>TousLesMatchs Premium</b>','Бесплатный канал: знакомство с сервисом и руководства.','Premium: все допустимые футбольные сигналы на сайте, в приложении и Telegram, без дневного лимита.','Минимальное число сигналов в день не обещается. Мы не публикуем сигнал ради количества.']:['💎 <b>TousLesMatchs Premium</b>','Gratuit : présentation du service et guides.','Premium : tous les signaux de football admissibles sur le site, l’application et Telegram, sans plafond quotidien.','Aucun minimum quotidien promis. Aucun signal forcé.'];
  } else throw new Error('Unknown client template');
  if(((effectiveFree) && !['scanner','scanner_result'].includes(kind)) || ['reminder','nopick','guide'].includes(kind)) {
    lines.push(paymentVerified ? `<a href="${payment(dest.lang)}">${CTA[dest.lang]}</a>` :
      ru ? 'Подписка Premium — 14,90 €/месяц, без обязательств. Новые подписки временно недоступны.' :
      'Premium — 14,90 €/mois, sans engagement. Paiement indisponible temporairement ; voir les détails de l’offre sur le site.');
  }
  if(effectiveFree && (kind==='goal05'||kind==='signal'||kind==='reminder'||kind==='nopick')) {
    const promo=freeOfferClock(ru);
    if(promo)lines.push(promo);
  }
  if(launchAllAccess && free && ['signal','goal05','scanner','scanner_result','recap'].includes(kind)) {
    lines.push(ru
      ? '🎁 Запуск: полный доступ временно открыт всем участникам. Позже Бесплатный и Premium снова будут разделены.'
      : '🎁 Lancement : accès intégral temporairement offert à tous. Gratuit et Premium seront séparés plus tard.');
  }
  lines.push(legal(dest.lang));
  const text=lines.filter(Boolean).join('\n\n');
  if(text.length>4096) throw new Error('Telegram template too long');
  const scannerPlain=['scanner','scanner_result'].includes(kind);
  const partnerRows=buildInlineKeyboard();
  // Le lien Stripe n'est jamais actif tant que le tarif et la session LIVE ne sont pas confirmés.
  const infoRow=[{text:ru?'💎 Premium — детали':'💎 Premium — 14,90 €/mois',url:'https://www.touslesmatchs.com/#plans'}];
  const linkRows=paymentVerified?[ [{text:CTA[dest.lang],url:payment(dest.lang)}], ...partnerRows ]:[infoRow,...partnerRows];
  return {chat_id:dest.id,text,parse_mode:'HTML',disable_web_page_preview:true,
    ...(scannerPlain?{}:{reply_markup:{inline_keyboard:linkRows}})};
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
// SQLite datetimes without an offset are UTC, never the host's local time.
function sqliteUtcMs(value) {
  if (typeof value === 'number') return value;
  const text=String(value || '').trim().replace(' ','T');
  return Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(text)?text:text+'Z');
}
function parisParts(at=Date.now()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at));
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,hour:Number(p.hour),minute:Number(p.minute)};
}
function parisDayBounds(day) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Invalid civil day');
  const midnight=Date.parse(day+'T00:00:00Z');
  function localMidnight(utc) {
    let guess=utc;
    for(let i=0;i<3;i++) {
      const p=parisParts(guess);
      const wall=Date.parse(p.day+'T00:00:00Z')+(p.hour*60+p.minute)*60000;
      guess+=utc-wall;
    }
    return new Date(guess).toISOString();
  }
  return {start:localMidnight(midnight),end:localMidnight(midnight+86400000)};
}
function recapDue(at=Date.now()) {const p=parisParts(at);return p.hour===23&&p.minute>=0;}
const FROZEN_FIELDS=['minute_at_analysis','score_home_at_analysis','score_away_at_analysis','best_bet','real_odd','real_odd_source','analysed_at'];
function initSignalSnapshots(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS client_signal_snapshots (
    match_key TEXT PRIMARY KEY, minute_at_analysis INTEGER, score_home_at_analysis INTEGER,
    score_away_at_analysis INTEGER, best_bet TEXT, real_odd REAL, real_odd_source TEXT,
    analysed_at TEXT NOT NULL, data_json TEXT NOT NULL, source TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS client_recap_runs (day TEXT PRIMARY KEY, queued_at INTEGER NOT NULL);
    CREATE TRIGGER IF NOT EXISTS client_snapshot_immutable BEFORE UPDATE ON client_signal_snapshots
      BEGIN SELECT RAISE(ABORT,'Client signal snapshot is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS client_analysis_snapshot_guard AFTER UPDATE OF ${FROZEN_FIELDS.join(',')} ON concile_analyses
    WHEN EXISTS (SELECT 1 FROM client_signal_snapshots s WHERE s.match_key=NEW.match_key AND (${FROZEN_FIELDS.map(f=>`NEW.${f} IS NOT s.${f}`).join(' OR ')}))
    BEGIN UPDATE concile_analyses SET ${FROZEN_FIELDS.map(f=>`${f}=(SELECT ${f} FROM client_signal_snapshots WHERE match_key=NEW.match_key)`).join(',')} WHERE match_key=NEW.match_key; END;`);
}
function freezeSignal(db,data,at,source='queued') {
  const old=db.prepare('SELECT data_json FROM client_signal_snapshots WHERE match_key=?').get(data.matchKey);
  if(old)return JSON.parse(old.data_json);
  const row=db.prepare('SELECT * FROM concile_analyses WHERE match_key=?').get(data.matchKey);
  if(!row)throw new Error('Signal analysis missing');
  const date=new Date(at).toISOString();
  const odd=data.odd==null?null:Number(data.odd);
  db.prepare(`INSERT INTO client_signal_snapshots VALUES (?,?,?,?,?,?,?,?,?,?)`).run(data.matchKey,data.minute??null,data.scoreHome??null,data.scoreAway??null,data.market,odd,row.real_odd_source??null,date,JSON.stringify(data),source);
  db.prepare(`UPDATE concile_analyses SET ${FROZEN_FIELDS.map(f=>`${f}=(SELECT ${f} FROM client_signal_snapshots WHERE match_key=?)`).join(',')} WHERE match_key=?`).run(...FROZEN_FIELDS.map(()=>data.matchKey),data.matchKey);
  return data;
}
function recapRows(db,day,channel) {
  const bounds=parisDayBounds(day);
  const rows=db.prepare(`SELECT ca.*,td.market AS delivered_market,td.created_at AS delivered_utc,
    td.telegram_message_id FROM telegram_signal_deliveries td JOIN concile_analyses ca ON ca.match_key=td.match_key
    WHERE td.channel=? AND td.ok=1 AND typeof(td.telegram_message_id)='integer' AND td.telegram_message_id>0
      AND datetime(td.created_at)>=datetime(?) AND datetime(td.created_at)<datetime(?)
    ORDER BY datetime(td.created_at),td.telegram_message_id`).all(channel,bounds.start,bounds.end);
  const seen=new Set();
  return rows.filter(row=>{const key=row.match_key;if(seen.has(key))return false;seen.add(key);return true;}).map(row=>{
    const selection=row.delivered_market;
    const market=String(selection||'').match(/^(Over|Under) 2[.,]5 (?:buts|goals)$/i);
    const resolved=['win','loss'].includes(row.outcome)&&row.final_score_home!=null&&row.final_score_away!=null&&market;
    const won=resolved&&((Number(row.final_score_home)+Number(row.final_score_away)>2.5)===(market[1].toLowerCase()==='over'));
    return {...row,best_bet:selection,outcome:resolved?(won?'win':'loss'):'pending'};
  });
}

function createPublisher({db,env,transport=request,now=Date.now,onDelivered=()=>{},paymentAvailable=()=>false,validateSignal=async()=>({ok:false,terminal:true})}) {
  const targets=destinations(env);
  initSignalSnapshots(db);
  db.exec(`CREATE TABLE IF NOT EXISTS client_telegram_outbox (
    delivery_key TEXT PRIMARY KEY, kind TEXT NOT NULL, channel TEXT NOT NULL, chat_id TEXT NOT NULL,
    match_key TEXT, market TEXT, votes INTEGER, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
    message_id INTEGER, next_at INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL, delivered_at INTEGER);
    CREATE INDEX IF NOT EXISTS client_tg_pending ON client_telegram_outbox(state,next_at);`);
  const addColumn = (table, definition) => {
    const name=definition.trim().split(/\s+/)[0];
    if(!db.prepare(`PRAGMA table_info(${table})`).all().some(row=>row.name===name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  };
  addColumn('client_telegram_outbox','official_signal_snapshot_id TEXT');
  addColumn('telegram_signal_deliveries','official_signal_snapshot_id TEXT');
  // Interruption pendant une requête : livraison inconnue, pas de renvoi automatique aveugle.
  db.prepare("UPDATE client_telegram_outbox SET state='uncertain' WHERE state='sending' AND next_at<?").run(now());
  let busy=false;
  function enqueue(kind,data,dest,key,expiresAt=now()+7*86400000) {
    return db.transaction(()=>{
      const deliveryKey=`${kind}:${key}:${dest.id}`;
      if(db.prepare('SELECT 1 FROM client_telegram_outbox WHERE delivery_key=?').get(deliveryKey))return false;
      if(kind==='signal')data=freezeSignal(db,data,now());
      const payload=render(kind,data,{...dest,paymentVerified:paymentAvailable()});
      return db.prepare(`INSERT OR IGNORE INTO client_telegram_outbox(delivery_key,kind,channel,chat_id,match_key,market,votes,payload,expires_at,created_at,official_signal_snapshot_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(deliveryKey,kind,dest.channel,dest.id,data.matchKey||null,data.market||'',Number(data.votes)||0,JSON.stringify(payload),expiresAt,now(),data.officialSignalSnapshotId||null).changes>0;
    }).immediate();
  }
  function queueDailyRecap(day=parisParts(now()).day) {
    return db.transaction(()=>{
      const unresolved=targets.some(dest=>recapRows(db,day,dest.channel).some(row=>row.outcome==='pending'));
      if(unresolved)return false;
      const claim=db.prepare('INSERT OR IGNORE INTO client_recap_runs(day,queued_at) VALUES (?,?)').run(day,now());
      if(!claim.changes)return false;
      for(const dest of targets) {
        const rows=recapRows(db,day,dest.channel);
        for(let i=0;i<Math.max(1,rows.length);i+=10)
          enqueue('recap',{day,rows:rows.slice(i,i+10),part:Math.floor(i/10)+1,parts:Math.max(1,Math.ceil(rows.length/10))},dest,`${day}:${i/10}`);
      }
      return true;
    }).immediate();
  }

  async function flush() {
    if(busy || !env.TELEGRAM_BOT_TOKEN)return false;busy=true;
    try {
      const rows=db.prepare("SELECT * FROM client_telegram_outbox WHERE state='pending' AND next_at<=? ORDER BY created_at LIMIT 40").all(now());
      for(const row of rows) {
        if(!targets.some(t=>t.channel===row.channel&&t.id===row.chat_id))continue;
        if(row.expires_at<=now()){db.prepare("UPDATE client_telegram_outbox SET state='expired' WHERE delivery_key=?").run(row.delivery_key);continue;}
        if(row.kind==='signal'||row.kind==='goal05') {
          let gate;try {gate=await validateSignal(row);} catch {gate={ok:false};}
          if(!gate?.ok) {
            db.prepare("UPDATE client_telegram_outbox SET state=?,next_at=? WHERE delivery_key=? AND state='pending'")
              .run(gate?.terminal?'expired':'pending',now()+30000,row.delivery_key);
            continue;
          }
          if(row.expires_at<=now()){db.prepare("UPDATE client_telegram_outbox SET state='expired' WHERE delivery_key=?").run(row.delivery_key);continue;}
        }
        const claim=db.prepare("UPDATE client_telegram_outbox SET state='sending',next_at=? WHERE delivery_key=? AND state='pending'").run(now()+60000,row.delivery_key);
        if(!claim.changes)continue;
        let result;
        try { result=await transport(env.TELEGRAM_BOT_TOKEN,JSON.parse(row.payload)); }
        catch { result={ok:false,uncertain:true}; }
        if(result.ok && Number.isInteger(result.messageId) && result.messageId>0) {
          db.transaction(()=>{
            db.prepare("UPDATE client_telegram_outbox SET state='delivered',message_id=?,delivered_at=? WHERE delivery_key=?").run(result.messageId,now(),row.delivery_key);
            if(row.kind==='signal'||row.kind==='goal05') {
              db.prepare(`INSERT INTO telegram_signal_deliveries(match_key,channel,telegram_message_id,market,vote_count,ok,official_signal_snapshot_id) VALUES(?,?,?,?,?,1,?)`).run(row.match_key,row.channel,result.messageId,row.market,row.votes,row.official_signal_snapshot_id);
              if(row.kind==='signal' && (row.channel==='premium'||row.channel==='free'))
                db.prepare(`UPDATE concile_analyses SET sig_sent_${row.channel}=1 WHERE match_key=?`).run(row.match_key);
            }
          })();
          try { onDelivered(row); } catch { /* proof already committed */ }
        } else db.prepare("UPDATE client_telegram_outbox SET state=?,next_at=? WHERE delivery_key=?").run((result.uncertain||result.ok)?'uncertain':'pending',now()+Math.max(30,result.retryAfter||60)*1000,row.delivery_key);
      }
      return true;
    } finally {busy=false;}
  }
  return {targets,enqueue,flush,queueDailyRecap};
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
module.exports={sqliteUtcMs,parisParts,parisDayBounds,recapDue,initSignalSnapshots,freezeSignal,recapRows,verifiedPrice,verifiedCheckout,CTA,PAYMENT,payment,legal,esc,destinations,marketRu,render,request,createPublisher};
