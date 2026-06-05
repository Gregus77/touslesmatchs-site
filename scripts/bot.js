const https = require("https");
const fs = require("fs");
const { buildInlineKeyboard } = require("./bookmakers.config");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let offset = 0;

function api(method, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TOKEN}/${method}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
    });
    req.on("error", () => resolve({}));
    req.write(data);
    req.end();
  });
}

// ── Lire les picks depuis App.js (fichier partagé avec le site) ──
function readPicks() {
  try {
    const appJs = fs.readFileSync("/app/App.js", "utf8").length > 0
      ? fs.readFileSync("/app/App.js", "utf8")
      : fs.readFileSync("./src/App.js", "utf8");
    const match = appJs.match(/var picks = \[([\s\S]*?)\];/);
    if (!match) return [];
    const lines = match[1].split("\n").filter(l => l.trim().startsWith("["));
    return lines.map(line => {
      const parts = line.match(/\["([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)","([^"]+)"/);
      if (!parts) return null;
      return { date: parts[1], match: parts[2], bet: parts[3], odds: parts[4], score: parts[5], result: parts[6] };
    }).filter(Boolean);
  } catch { return []; }
}

function getStats(picks) {
  const resolved = picks.filter(p => p.result === "GAGNE" || p.result === "PERDU");
  const wins = resolved.filter(p => p.result === "GAGNE").length;
  const losses = resolved.filter(p => p.result === "PERDU").length;
  const total = wins + losses;
  const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
  return { wins, losses, total, winrate };
}

function getTodayPick(picks) {
  return picks.find(p => p.result === "EN ATTENTE") || null;
}

// ── Commandes du bot ──
async function handleUpdate(update) {
  if (!update.message && !update.callback_query) return;

  const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
  const text = (update.message?.text || "").trim().toLowerCase();

  // Callback query (langues)
  if (update.callback_query) {
    const query = update.callback_query;
    await api("answerCallbackQuery", { callback_query_id: query.id });
    const confirmations = {
      lang_fr: "🇫🇷 Langue française sélectionnée. ✅",
      lang_en: "🇬🇧 English selected. ✅",
      lang_es: "🇪🇸 Español seleccionado. ✅",
      lang_it: "🇮🇹 Italiano selezionata. ✅",
      lang_ru: "🇷🇺 Русский выбран. ✅"
    };
    if (confirmations[query.data]) {
      await api("sendMessage", { chat_id: chatId, text: confirmations[query.data] });
    }
    return;
  }

  // /start — Accueil
  if (text === "/start") {
    await api("sendMessage", {
      chat_id: chatId,
      text: `🏛️ <b>TOUSLESMATCHS — Bot IA</b>\n\n🎯 Picks quotidiens analysés par IA\n📊 Stats vérifiables en temps réel\n\n<b>Commandes :</b>\n/pick — 🎯 Pick du jour (ARJEL)\n/stats — 📊 Statistiques\n/premium — 💎 Offre Premium\n/langue — 🌍 Changer la langue\n/aide — ❓ Aide\n\n⚠️ 18+ — Jeu responsable`,
      parse_mode: "HTML"
    });
    return;
  }

  // /pick — Pick du jour
  if (text === "/pick") {
    const picks = readPicks();
    const todayPick = getTodayPick(picks);
    const stats = getStats(picks);

    if (todayPick) {
      await api("sendMessage", {
        chat_id: chatId,
        text: `🎯 <b>PICK DU JOUR</b>\n\n⚽ <b>${todayPick.match}</b>\n💡 Pari : ${todayPick.bet}\n💰 Cote : <b>${todayPick.odds}</b>\n📅 Date : ${todayPick.date}\n\n📊 Stats : ${stats.wins}G/${stats.losses}P (${stats.winrate}%)\n\n⬇️ <b>Parie maintenant :</b>\n⚠️ 18+ — Max 2-5% bankroll`,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: buildInlineKeyboard([
            { text: "📊 Historique — touslesmatchs.com", url: "https://touslesmatchs.com" }
          ])
        }
      });
    } else {
      await api("sendMessage", {
        chat_id: chatId,
        text: `🔍 <b>PAS DE PICK AUJOURD'HUI</b>\n\nAucun match ARJEL ne respecte nos critères.\nNous préférons ne pas publier plutôt que de forcer.\n\n📊 Stats maintenues : ${stats.wins}G/${stats.losses}P (${stats.winrate}%)`,
        parse_mode: "HTML"
      });
    }
    return;
  }

  // /stats — Statistiques
  if (text === "/stats") {
    const picks = readPicks();
    const stats = getStats(picks);
    const lastWins = picks.filter(p => p.result === "GAGNE").slice(0, 5);

    let msg = `📊 <b>STATISTIQUES TOUSLESMATCHS</b>\n\n`;
    msg += `🏆 Taux de réussite : <b>${stats.winrate}%</b>\n`;
    msg += `✅ Gagnés : <b>${stats.wins}</b>\n`;
    msg += `❌ Perdus : <b>${stats.losses}</b>\n`;
    msg += `📋 Total : <b>${stats.total}</b> paris\n\n`;
    msg += `🔥 <b>Derniers gains :</b>\n`;
    lastWins.forEach(p => { msg += `  ✅ ${p.date} — ${p.match} @ ${p.odds}\n`; });
    msg += `\n🌐 Historique complet : touslesmatchs.com`;

    await api("sendMessage", { chat_id: chatId, text: msg, parse_mode: "HTML" });
    return;
  }

  // /premium — Offre Premium
  if (text === "/premium") {
    await api("sendMessage", {
      chat_id: chatId,
      text: `💎 <b>OFFRE PREMIUM — 19,90€/mois</b>\n\n🎁 <b>Ce que vous recevez :</b>\n\n🆓 Pick ARJEL quotidien (Winamax, Betclic, Unibet)\n➕ Pick HORS-ARJEL (Pinnacle, PS3838)\n➕ Canal Telegram privé\n➕ Analyses détaillées\n➕ Alertes en temps réel\n\n💰 <b>19,90€/mois</b> — Sans engagement\n\n📈 Nos stats : ${getStats(readPicks()).winrate}% de réussite\n\n⚠️ 18+ — Jeu responsable`,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "💳 S'abonner (19,90€/mois)", url: "https://www.touslesmatchs.com" }],
          [{ text: "📊 Voir les stats", url: "https://touslesmatchs.com" }]
        ]
      }
    });
    return;
  }

  // /langue — Sélection langue
  if (text === "/langue" || text === "/language") {
    await api("sendMessage", {
      chat_id: chatId,
      text: "🌍 <b>Choisissez votre langue</b>",
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🇫🇷 Français", callback_data: "lang_fr" }, { text: "🇬🇧 English", callback_data: "lang_en" }],
          [{ text: "🇪🇸 Español", callback_data: "lang_es" }, { text: "🇮🇹 Italiano", callback_data: "lang_it" }],
          [{ text: "🇷🇺 Русский", callback_data: "lang_ru" }]
        ]
      }
    });
    return;
  }

  // /aide ou /help
  if (text === "/aide" || text === "/help") {
    await api("sendMessage", {
      chat_id: chatId,
      text: `❓ <b>AIDE</b>\n\n/pick — Voir le pick du jour\n/stats — Voir les statistiques\n/premium — Offre Premium 19,90€\n/langue — Changer la langue\n\n🌐 Site : touslesmatchs.com\n📩 Contact : support@touslesmatchs.com`,
      parse_mode: "HTML"
    });
    return;
  }

  // Message inconnu
  await api("sendMessage", {
    chat_id: chatId,
    text: "🤖 Commande non reconnue.\n\nTapez /pick pour le pick du jour ou /aide pour les commandes disponibles."
  });
}

async function poll() {
  console.log("🤖 Bot TousLesMatchs démarré — commandes: /pick /stats /premium /langue /aide");
  while (true) {
    try {
      const res = await api("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      if (res.ok && res.result && res.result.length > 0) {
        for (const update of res.result) {
          await handleUpdate(update);
          offset = update.update_id + 1;
        }
      }
    } catch (e) {
      console.error("Erreur poll:", e.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

poll();
