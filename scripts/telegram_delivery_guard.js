"use strict";

/**
 * TousLesMatchs — filet de sécurité de livraison Telegram.
 *
 * Objectifs :
 *  - ne JAMAIS transformer un 3/5 admin en signal client ;
 *  - réparer les anciennes lignes diffusion_block=NULL qui n'ont pourtant été
 *    envoyées à aucun client ;
 *  - retenter un vrai signal Standard/Premium classé par le moteur si le chemin
 *    principal n'a pas posé son sig_sent_* ;
 *  - envoyer le résultat gagné/perdu aux groupes qui ont réellement reçu le pick ;
 *  - envoyer un bilan quotidien Standard/Premium avec mise fixe simulée de 10 €.
 *
 * Ce worker ne fabrique aucune analyse. Il ne lit que concile_analyses.
 */

const fs = require("fs");
const https = require("https");
const Database = require("better-sqlite3");

const DB_PATH = process.env.TLM_DB_PATH || process.env.SOCIAL_DB_PATH || "/data/tlm.db";
const BOT = process.env.TELEGRAM_BOT_TOKEN || "";
const FREE = process.env.TELEGRAM_FREE_CHANNEL_ID || process.env.TELEGRAM_CHANNEL_ID || "";
const STANDARD = process.env.TELEGRAM_STANDARD_CHANNEL_ID || "";
const PREMIUM = process.env.TELEGRAM_PREMIUM_CHANNEL_ID || "";
const POLL_MS = Math.max(15000, Number(process.env.TELEGRAM_DELIVERY_GUARD_POLL_MS || 30000));
const MIN_ODD = Number(process.env.TIER_MIN_REAL_ODD || 1.30);
const MAX_ODD = Number(process.env.TIER_MAX_REAL_ODD || 2.50);
const STANDARD_CAP = 3;
const PREMIUM_CAP = 10;

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function esc(v){ return String(v == null ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function bool(v){ return Number(v || 0) === 1 || v === true; }

function openDb(){
  if(!fs.existsSync(DB_PATH)) throw new Error(`DB absente: ${DB_PATH}`);
  return new Database(DB_PATH);
}

function ensureSchema(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_delivery_guard_log (
      event_key TEXT PRIMARY KEY,
      analysis_id INTEGER,
      channel TEXT NOT NULL,
      stage TEXT NOT NULL,
      telegram_message_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tdg_created_at ON telegram_delivery_guard_log(created_at);
  `);
}

function sendMessage(chatId, text){
  if(!BOT || !chatId) return Promise.resolve({ok:false, reason:"config"});
  const body=JSON.stringify({chat_id:chatId,text,parse_mode:"HTML",disable_web_page_preview:true});
  return new Promise(resolve => {
    const req=https.request({hostname:"api.telegram.org",path:`/bot${BOT}/sendMessage`,method:"POST",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)},timeout:12000},res=>{
      let raw="";res.on("data",d=>raw+=d);res.on("end",()=>{
        try{const j=JSON.parse(raw||"{}");resolve({ok:!!j.ok,messageId:j.result&&j.result.message_id,description:j.description||""});}
        catch(_){resolve({ok:false,reason:"invalid_json"});}
      });
    });
    req.on("error",e=>resolve({ok:false,reason:e.message}));
    req.on("timeout",()=>{req.destroy();resolve({ok:false,reason:"timeout"});});
    req.write(body);req.end();
  });
}

function normalizedText(row){
  return [row.competition,row.country,row.home,row.away,row.sport].join(" ")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

function clientSafe(row){
  const text=normalizedText(row);
  const sport=String(row.sport||"Football").toLowerCase();
  const minute=Number(row.minute_at_analysis||0);
  const odd=Number(row.real_odd||0);
  const votes=Number(row.consensus_votes||0);
  const tier=String(row.signal_tier||"").toLowerCase();

  if(!sport.includes("football")) return false;
  if(votes < 4) return false;
  if(tier !== "standard" && tier !== "premium") return false;
  if(!Number.isFinite(minute) || minute < 15 || minute > 40) return false;
  if(!Number.isFinite(odd) || odd < MIN_ODD || odd > MAX_ODD) return false;
  if(!row.real_odd_source || /estimation/i.test(String(row.real_odd_source))) return false;
  if(/\b(women|woman|female|femme|femmes|feminin|feminine|ladies|\(w\))\b/.test(text)) return false;
  if(/\b(usa|united states|canada|mls|usl)\b/.test(text)) return false;
  if(/\b(u17|u18|u19|u20|u21|u23|youth|reserve|reserves|friendly|amical|amicaux)\b/.test(text)) return false;
  if(/\b(cup|coupe|copa|coppa|playoff|play-off|barrage|champions league|europa league|conference league)\b/.test(text)) return false;
  return true;
}

function tierMessage(row, label){
  const score=(row.score_home_at_analysis!=null&&row.score_away_at_analysis!=null)?`${row.score_home_at_analysis}-${row.score_away_at_analysis}`:"?";
  return `🚨 <b>SIGNAL CONCILE IA — ${esc(label)}</b>\n\n`+
    `⚽ <b>${esc(row.home)} vs ${esc(row.away)}</b>\n`+
    `🏆 ${esc(row.competition||"Football")}\n`+
    `⏱ ${esc(row.minute_at_analysis)}' · Score : ${esc(score)}\n`+
    `🧠 Vote IA : <b>${esc(row.consensus_votes)}/5</b>\n\n`+
    `💡 Signal : <b>${esc(row.best_bet)}</b>\n`+
    `📊 Confiance : <b>${esc(row.confidence)}/100</b>\n`+
    `💰 Cote : <b>${Number(row.real_odd).toFixed(2)}</b> <i>(${esc(row.real_odd_source)})</i>\n\n`+
    `━━━━━━━━━━━━━━━━━━\n⚠️ 18+ — Jeu responsable`;
}

function resultMessage(row){
  const win=String(row.outcome)==="win";
  const score=(row.final_score_home!=null&&row.final_score_away!=null)?`${row.final_score_home}-${row.final_score_away}`:"score final vérifié";
  return `${win?"✅ <b>GAGNÉ</b>":"❌ <b>PERDU</b>"}\n\n`+
    `⚽ <b>${esc(row.home)} vs ${esc(row.away)}</b>\n`+
    `🏆 ${esc(row.competition||"Football")}\n`+
    `🏁 Score final : <b>${esc(score)}</b>\n`+
    `💡 Signal joué : <b>${esc(row.best_bet)}</b>\n`+
    (Number(row.real_odd)>1?`💰 Cote : <b>${Number(row.real_odd).toFixed(2)}</b>\n`:"")+
    `\nLes gagnés comme les perdus restent visibles.\n⚠️ 18+ — Jeu responsable`;
}

function eventDone(db,key){ return !!db.prepare("SELECT 1 FROM telegram_delivery_guard_log WHERE event_key=?").get(key); }
function markDone(db,key,row,channel,stage,messageId){
  db.prepare("INSERT OR IGNORE INTO telegram_delivery_guard_log(event_key,analysis_id,channel,stage,telegram_message_id) VALUES(?,?,?,?,?)")
    .run(key,row.id,channel,stage,messageId||null);
}

function countSentToday(db,col){
  return Number(db.prepare(`SELECT COUNT(*) n FROM concile_analyses WHERE date(analysed_at)=date('now') AND ${col}=1`).get().n||0);
}

function repairFalseNullBlocks(db){
  const r=db.prepare(`
    UPDATE concile_analyses
       SET diffusion_block = CASE
         WHEN COALESCE(consensus_votes,0) < 4 THEN 'votes insuffisants pour les offres actives (<4/5)'
         WHEN COALESCE(signal_tier,'') NOT IN ('standard','premium') THEN 'hors offres actives Standard/Premium'
         ELSE diffusion_block
       END
     WHERE analysed_at >= datetime('now','-48 hours')
       AND (diffusion_block IS NULL OR trim(diffusion_block)='')
       AND COALESCE(sig_sent_free,0)=0
       AND COALESCE(sig_sent_standard,0)=0
       AND COALESCE(sig_sent_premium,0)=0
       AND (COALESCE(consensus_votes,0)<4 OR COALESCE(signal_tier,'') NOT IN ('standard','premium'))
  `).run();
  if(r.changes) console.log(`[delivery-guard] ${r.changes} faux diffusion_block=NULL réparé(s)`);
}

async function retryMissedSignals(db){
  let std=countSentToday(db,"sig_sent_standard");
  let prem=countSentToday(db,"sig_sent_premium");
  const rows=db.prepare(`
    SELECT id,match_key,home,away,competition,country,sport,best_bet,confidence,consensus_votes,
           minute_at_analysis,score_home_at_analysis,score_away_at_analysis,real_odd,real_odd_source,
           signal_tier,diffusion_block,sig_sent_standard,sig_sent_premium
      FROM concile_analyses
     WHERE analysed_at >= datetime('now','-6 hours')
       AND outcome IS NULL
       AND COALESCE(consensus_votes,0)>=4
       AND COALESCE(signal_tier,'') IN ('standard','premium')
     ORDER BY datetime(analysed_at) ASC,id ASC
  `).all();

  for(const row of rows){
    if(!clientSafe(row)) continue;
    const tier=String(row.signal_tier||"").toLowerCase();
    if(PREMIUM && !bool(row.sig_sent_premium) && prem<PREMIUM_CAP){
      const key=`signal:premium:${row.id}`;
      if(!eventDone(db,key)){
        const s=await sendMessage(PREMIUM,tierMessage(row,"PREMIUM"));
        if(s.ok){
          db.prepare("UPDATE concile_analyses SET sig_sent_premium=1,diffusion_block=NULL WHERE id=?").run(row.id);
          markDone(db,key,row,"premium","signal",s.messageId); prem++;
          console.log(`[delivery-guard] ✅ Premium rattrapé: ${row.home} vs ${row.away}`);
        } else console.error(`[delivery-guard] Premium KO: ${row.home} vs ${row.away} · ${s.description||s.reason||"erreur"}`);
      }
    }
    if(STANDARD && tier==="standard" && !bool(row.sig_sent_standard) && std<STANDARD_CAP){
      const key=`signal:standard:${row.id}`;
      if(!eventDone(db,key)){
        const s=await sendMessage(STANDARD,tierMessage(row,"STANDARD"));
        if(s.ok){
          db.prepare("UPDATE concile_analyses SET sig_sent_standard=1,diffusion_block=NULL WHERE id=?").run(row.id);
          markDone(db,key,row,"standard","signal",s.messageId); std++;
          console.log(`[delivery-guard] ✅ Standard rattrapé: ${row.home} vs ${row.away}`);
        } else console.error(`[delivery-guard] Standard KO: ${row.home} vs ${row.away} · ${s.description||s.reason||"erreur"}`);
      }
    }
  }
}

async function sendMissingResults(db){
  const rows=db.prepare(`
    SELECT id,home,away,competition,sport,best_bet,confidence,real_odd,outcome,
           final_score_home,final_score_away,sig_sent_standard,sig_sent_premium,sig_sent_free
      FROM concile_analyses
     WHERE resolved_at >= datetime('now','-72 hours') AND outcome IN ('win','loss')
     ORDER BY datetime(resolved_at) ASC,id ASC
  `).all();
  for(const row of rows){
    const targets=[
      ["standard",STANDARD,bool(row.sig_sent_standard)],
      ["premium",PREMIUM,bool(row.sig_sent_premium)],
      ["free",FREE,bool(row.sig_sent_free)],
    ];
    for(const [label,chatId,wasSent] of targets){
      if(!chatId||!wasSent) continue;
      const key=`result:${label}:${row.id}`;
      if(eventDone(db,key)) continue;
      const s=await sendMessage(chatId,resultMessage(row));
      if(s.ok){markDone(db,key,row,label,"result",s.messageId);console.log(`[delivery-guard] résultat ${label}: ${row.home} vs ${row.away} ${row.outcome}`);}
    }
  }
}

function recapStats(db,col){
  const rows=db.prepare(`SELECT outcome,real_odd FROM concile_analyses WHERE date(analysed_at)=date('now') AND ${col}=1 AND outcome IN ('win','loss')`).all();
  let wins=0,losses=0,profit=0;
  for(const r of rows){
    const odd=Number(r.real_odd||0);
    if(r.outcome==="win"){wins++;profit+=(odd>1?(odd-1)*10:0);}else{losses++;profit-=10;}
  }
  return {total:rows.length,wins,losses,profit};
}

async function maybeDailyRecap(db){
  const parts=new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hour12:false,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const obj={};parts.forEach(p=>obj[p.type]=p.value);
  const hour=Number(obj.hour),minute=Number(obj.minute),day=`${obj.year}-${obj.month}-${obj.day}`;
  if(hour<22 || (hour===22&&minute<10)) return;

  for(const [label,chatId,col] of [["standard",STANDARD,"sig_sent_standard"],["premium",PREMIUM,"sig_sent_premium"]]){
    if(!chatId) continue;
    const key=`recap:${label}:${day}`;
    if(eventDone(db,key)) continue;
    const s=recapStats(db,col);
    if(!s.total) continue;
    const sign=s.profit>=0?"+":"";
    const text=`📊 <b>BILAN DU JOUR — ${label.toUpperCase()}</b>\n\n`+
      `🎯 ${s.total} match${s.total>1?"s":""} terminé${s.total>1?"s":""}\n`+
      `✅ Gagnés : <b>${s.wins}</b>\n❌ Perdus : <b>${s.losses}</b>\n`+
      `💶 Avec une mise fixe de 10 € par signal : <b>${sign}${s.profit.toFixed(2)} €</b>\n\n`+
      `Calcul réalisé uniquement avec les cotes réellement enregistrées.\n⚠️ 18+ — Jeu responsable`;
    const sent=await sendMessage(chatId,text);
    if(sent.ok) markDone(db,key,{id:null},label,"recap",sent.messageId);
  }
}

async function cycle(){
  const db=openDb();
  try{
    ensureSchema(db);
    repairFalseNullBlocks(db);
    await retryMissedSignals(db);
    await sendMissingResults(db);
    await maybeDailyRecap(db);
  } finally { db.close(); }
}

async function main(){
  console.log(`[delivery-guard] start · DB=${DB_PATH} · standard=${!!STANDARD} · premium=${!!PREMIUM} · free=${!!FREE}`);
  for(;;){
    try{await cycle();}catch(e){console.error("[delivery-guard] cycle:",e.message);}
    await sleep(POLL_MS);
  }
}

if(require.main===module) main().catch(e=>{console.error("[delivery-guard] fatal:",e);process.exit(1);});
module.exports={cycle,clientSafe,repairFalseNullBlocks};
