'use strict';
const {createHash}=require('node:crypto');
const {summarizeSignals}=require('./premium_month_pass');
const civil = value => {
  if(!Number.isFinite(Date.parse(value)))throw new Error('Invalid date');
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
};
function reminderDay(expiry,now){
  const days=(Date.parse(civil(expiry))-Date.parse(civil(now)))/86400000;
  return days>=1&&days<=5 ? days:null;
}
function memberStats(rows,account,now){
  const start=Date.parse(account.startsAt),end=Math.min(Date.parse(account.expiresAt),Date.parse(now));
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw new Error('Invalid membership period');
  return summarizeSignals(rows.filter(r=>r.deliveryOk===true&&Number.isInteger(r.messageId)&&r.messageId>0
    &&Date.parse(r.deliveredAt)>=start&&Date.parse(r.deliveredAt)<end));
}
const SUBJECTS={fr:{5:'Votre bilan Premium à cinq jours de la fin',4:'Votre accès Premium : encore quatre jours',3:'Vos résultats, en toute transparence',2:'Un mois offert grâce au parrainage',1:'Votre mois Premium se termine demain'},
  ru:{5:'Ваши итоги Premium: осталось пять дней',4:'Доступ Premium: осталось четыре дня',3:'Ваши результаты без скрытых потерь',2:'Месяц в подарок за приглашённого клиента',1:'Ваш месяц Premium заканчивается завтра'}};
const BODIES={fr:{5:'Voici le bilan des signaux Premium publiés pendant votre période d’accès.',4:'Votre accès comprend tous les signaux validés disponibles sur le site et Telegram, sans quota. Aucun nombre minimum n’est promis.',3:'Le bilan conserve les pertes et les signaux en attente. Un accord des IA ne garantit pas un pari gagnant.',2:'Invitez un nouveau client avec votre lien personnel : après son paiement confirmé de 14,90 €, vous recevez un mois offert. Une inscription gratuite seule ne suffit pas ; le filleul ne reçoit pas de mois offert.',1:'Sans nouvel achat, votre accès Premium se termine à la date indiquée. Votre compte gratuit reste disponible.'},
  ru:{5:'Итоги сигналов Premium, опубликованных за период вашего доступа.',4:'Доступ включает все доступные подтверждённые сигналы на сайте и в Telegram, без лимита. Минимальное количество сигналов не обещается.',3:'В итогах учтены проигрыши и сигналы, ожидающие результата. Согласие ИИ не гарантирует выигрыш.',2:'Пригласите нового клиента по личной ссылке. После подтверждённой оплаты 14,90 € вы получите месяц в подарок. Бесплатной регистрации недостаточно; приглашённый клиент не получает бесплатный месяц.',1:'Без новой покупки доступ Premium закончится в указанное время. Бесплатный аккаунт останется доступен.'}};
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function safeUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Invalid HTTPS destination');return u.href;}
function renderReminder({day,account,stats,links}){
  if(!Number.isInteger(day)||day<1||day>5)throw new Error('Invalid reminder day');
  const lang=account.language==='ru'?'ru':'fr',ru=lang==='ru';
  const checkout=safeUrl(links.checkout),unsubscribe=safeUrl(links.unsubscribe);
  const money=cents=>(cents/100).toFixed(2).replace('.',',')+' €';
  const deadline=new Intl.DateTimeFormat(ru?'ru-RU':'fr-FR',{timeZone:'Europe/Paris',dateStyle:'long',timeStyle:'short'}).format(new Date(account.expiresAt));
  const summary=ru
    ? `Теоретический расчёт при ставке 10 €: выиграно ${stats.wins}, проиграно ${stats.losses}, ожидают результата ${stats.pending}. Всего поставлено ${money(stats.stakedCents)}, возврат ${money(stats.returnCents)}, чистый результат ${money(stats.netCents)}. Без коэффициента: ${stats.excluded}, исключены из финансового расчёта. Это не ваши личные выигрыши.`
    : `Bilan théorique à mise fixe de 10 € : ${stats.wins} gagnés, ${stats.losses} perdus, ${stats.pending} en attente. Total misé ${money(stats.stakedCents)}, retour ${money(stats.returnCents)}, résultat net ${money(stats.netCents)}. Cote indisponible : ${stats.excluded}, exclus du calcul financier. Il ne s’agit pas de vos gains personnels.`;
  const parts=[BODIES[lang][day],summary];
  parts.push(ru?`Конец доступа: ${deadline} (Париж).`:`Fin de l’accès : ${deadline} (heure de Paris).`,
    ru?'14,90 € за один календарный месяц, без автоматического продления.':'14,90 € pour un mois calendaire, sans renouvellement automatique.',
    ru?'18+ — Играйте ответственно. Выигрыш не гарантирован.':'18+ — Jeu responsable. Aucun gain garanti.');
  const cta=ru?'Купить ещё один месяц':'Acheter un nouveau mois';
  const text=parts.join('\n\n');
  return {subject:SUBJECTS[lang][day],text:text+'\n\n'+cta+': '+checkout+'\n'+(ru?'Отписаться':'Désinscription')+': '+unsubscribe,
    html:parts.map(p=>'<p>'+esc(p)+'</p>').join('')+`<p><a href="${esc(checkout)}">${cta}</a></p><p><a href="${esc(unsubscribe)}">${ru?'Отписаться':'Désinscription'}</a></p>`};
}
function createReminderQueue(db){
  db.exec(`CREATE TABLE IF NOT EXISTS premium_reminders (id TEXT PRIMARY KEY,email TEXT NOT NULL,
    expires_at TEXT NOT NULL,day INTEGER NOT NULL,civil_day TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',
    provider_id TEXT,error TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS premium_reminder_daily ON premium_reminders(email,civil_day);`);
  function enqueue(account,now){
    if(!account.active||account.marketingConsent!==true||Date.parse(account.expiresAt)<=Date.parse(now))return false;
    const day=reminderDay(account.expiresAt,now);if(!day)return false;
    const address=String(account.email||'').trim().toLowerCase();if(!address.includes('@'))throw new Error('Invalid account');
    const expiry=new Date(account.expiresAt).toISOString(),date=civil(now);
    const key=createHash('sha256').update(JSON.stringify([address,expiry,day])).digest('hex');
    return db.prepare('INSERT OR IGNORE INTO premium_reminders(id,email,expires_at,day,civil_day) VALUES (?,?,?,?,?)').run(key,address,expiry,day,date).changes===1;
  }
  async function dispatch({now,lookup,build,deliver}){
    const today=civil(now);
    // Sending records are never retried automatically: provider acceptance may
    // have happened before a process crash. Operator reconciliation is needed.
    for(const row of db.prepare("SELECT * FROM premium_reminders WHERE state='pending'").all()){
      const account=await lookup(row.email);
      const valid=account?.active&&account.marketingConsent===true&&Date.parse(account.expiresAt)>Date.parse(now)
        &&new Date(account.expiresAt).toISOString()===row.expires_at&&row.civil_day===today&&reminderDay(account.expiresAt,now)===row.day;
      if(!valid){db.prepare("UPDATE premium_reminders SET state='cancelled' WHERE id=? AND state='pending'").run(row.id);continue;}
      const message=await build(account,row.day);
      const claim=db.prepare("UPDATE premium_reminders SET state='sending' WHERE id=? AND state='pending'").run(row.id);
      if(!claim.changes)continue;
      try{
        const result=await deliver(account.email,message,row.id);
        if(result?.accepted===true&&result.id){db.prepare("UPDATE premium_reminders SET state='sent',provider_id=? WHERE id=?").run(String(result.id),row.id);}
        else db.prepare("UPDATE premium_reminders SET state='uncertain',error='provider acceptance not proven' WHERE id=?").run(row.id);
      }catch{db.prepare("UPDATE premium_reminders SET state='uncertain',error='transport outcome unknown' WHERE id=?").run(row.id);}
    }
  }
  return {enqueue,dispatch};
}
module.exports={reminderDay,memberStats,renderReminder,createReminderQueue};
