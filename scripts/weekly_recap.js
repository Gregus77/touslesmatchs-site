"use strict";
/**
 * weekly_recap.js — Récapitulatif hebdomadaire Telegram
 *
 * Envoie chaque dimanche matin un résumé complet de la semaine :
 * picks, résultats, ROI, série, prochains matchs.
 *
 * Cron recommandé (VPS) :
 *   0 8 * * 0 cd /opt/touslesmatchs && export $(grep -v '^#' /opt/touslesmatchs/.env | xargs) && node scripts/weekly_recap.js >> /var/log/weekly_recap.log 2>&1
 */

const https = require("https");
const fs    = require("fs");
const path  = require("path");
const { computeStats } = require("./roi_stats");

const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT    = process.env.TELEGRAM_CHAT_ID;
const TG_PREMIUM = process.env.TELEGRAM_PREMIUM_CHAT_ID;

function sendTelegram(chatId, text) {
  return new Promise((resolve) => {
    if (!TG_TOKEN || !chatId) return resolve();
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, res => { res.resume(); res.on("end", resolve); });
    req.on("error", resolve);
    req.end(body);
  });
}

function getWeekPicks() {
  const APP_JS  = path.join(__dirname, "../src/App.js");
  const content = fs.readFileSync(APP_JS, "utf8");
  const regex   = /\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","(GAGNE|PERDU|NOPICK|EN ATTENTE)","([^"]*)",(\d+\.?\d*),\d+\.?\d*\]/g;
  const picks   = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    picks.push({
      date: m[1], match: m[2], bet: m[3], odds: m[4],
      score: m[5], status: m[6], sport: m[7], note: parseFloat(m[8])
    });
  }
  // 7 derniers jours : garder les 15 premières entrées max (ordre antéchrono dans App.js)
  return picks.slice(0, 15);
}

function formatPick(p) {
  const icon = p.status === "GAGNE" ? "✅" : p.status === "PERDU" ? "❌" : p.status === "NOPICK" ? "⏸" : "⏳";
  if (p.status === "NOPICK") return `${icon} <b>${p.date}</b> — PAS DE PARI`;
  const score = (p.score && p.score !== "—" && p.score !== "---") ? ` (${p.score})` : "";
  return `${icon} <b>${p.date}</b> — ${p.match} @ ${p.odds}${score}`;
}

function sportSummary(bySport) {
  return Object.entries(bySport).map(([sport, b]) => {
    const total = b.wins + b.losses;
    return `  ${sport}: ${b.wins}/${total} — ROI <b>${b.roi}%</b>`;
  }).join("\n");
}

async function main() {
  const now  = new Date();
  const day  = now.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const week = getWeekPicks();
  const stats = computeStats();

  // Picks de la semaine (7 derniers jours, hors NOPICK)
  const weekReal  = week.filter(p => p.status !== "NOPICK").slice(0, 7);
  const weekLines = week.slice(0, 10).map(formatPick).join("\n");

  // Picks EN ATTENTE
  const upcoming  = week.filter(p => p.status === "EN ATTENTE");
  const upcomingLines = upcoming.length
    ? upcoming.map(p => `  ⏳ <b>${p.date}</b> — ${p.match} @ ${p.odds}`).join("\n")
    : "  Aucun pick en attente actuellement";

  const msg = `🏛️ <b>RÉCAP HEBDO HERMÈS</b>
📅 ${day}

━━━━━━━━━━━━━━━━━━━━
📋 <b>PICKS RÉCENTS</b>
${weekLines}

━━━━━━━━━━━━━━━━━━━━
📈 <b>STATISTIQUES GLOBALES</b>
  Picks résolus : <b>${stats.total}</b> (${stats.wins} ✅ / ${stats.losses} ❌)
  Win rate      : <b>${stats.winRate}</b>
  ROI           : <b>${stats.roi}</b>
  Profit        : <b>${stats.profit}</b>
  Série         : <b>${stats.currentStreak}</b>

${Object.keys(stats.bySport).length ? `🏆 <b>PAR SPORT</b>\n${sportSummary(stats.bySport)}\n\n` : ""}━━━━━━━━━━━━━━━━━━━━
📅 <b>PICKS EN ATTENTE</b>
${upcomingLines}

━━━━━━━━━━━━━━━━━━━━
🌐 touslesmatchs.fr`;

  if (TG_CHAT) {
    await sendTelegram(TG_CHAT, msg);
    console.log("📤 Récap envoyé sur canal gratuit");
  }
  if (TG_PREMIUM && TG_PREMIUM !== TG_CHAT) {
    await sendTelegram(TG_PREMIUM, msg);
    console.log("💎 Récap envoyé sur canal premium");
  }
  if (!TG_CHAT) {
    console.log("⚠️  TELEGRAM_CHAT_ID non défini — affichage seulement :");
    console.log(msg);
  }
}

main().catch(e => console.error("FATAL:", e.message));
