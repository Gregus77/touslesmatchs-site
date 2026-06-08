"use strict";
/**
 * bot.js — Bot Telegram TousLesMatchs
 * Commandes : /start /pick /premium /stats /help
 * Répond avec le pick du jour + boutons Stripe pour s'abonner
 */

const https = require("https");
const fs    = require("fs");
const path  = require("path");

const TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const PICK_FILE  = path.join(__dirname, "today_pick.json");
const APP_FILE   = path.join(__dirname, "App.js"); // copié dans le container

const STRIPE_STANDARD = "https://buy.stripe.com/4gM3cv4Je9ZG2RK3GS3VC00";
const STRIPE_PREMIUM  = "https://buy.stripe.com/9B64gzgrW2xe2RK4KW3VC01";
const SITE_URL        = "https://touslesmatchs.com";
const TELEGRAM_FREE   = "https://t.me/touslesmatchs_bot"; // Canal TousLesMatchs Free

// ─── HTTP helper ─────────────────────────────────────────────
function tgApi(method, body) {
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
    req.end(data);
  });
}

// ─── Clavier inline standard (abonnement) ────────────────────
function keyboardAbonnement() {
  return {
    inline_keyboard: [
      [
        { text: "⭐ Standard 9,90€/mois", url: STRIPE_STANDARD },
        { text: "💎 Premium 19,90€/mois", url: STRIPE_PREMIUM  }
      ],
      [
        { text: "🌐 Voir le site",         url: SITE_URL },
        { text: "📢 Canal Free (gratuit)",    url: TELEGRAM_FREE }
      ]
    ]
  };
}

// ─── Lecture du pick du jour ──────────────────────────────────
function getTodayPick() {
  try {
    if (fs.existsSync(PICK_FILE)) {
      return JSON.parse(fs.readFileSync(PICK_FILE, "utf8"));
    }
  } catch { /* */ }
  return null;
}

// ─── ROI stats depuis App.js ──────────────────────────────────
function getStats() {
  try {
    const content = fs.existsSync(APP_FILE) ? fs.readFileSync(APP_FILE, "utf8") : "";
    const regex = /\["[^"]+","[^"]+","[^"]+","[^"]+","[^"]+","(GAGNE|PERDU)"/g;
    let wins = 0, losses = 0, m;
    while ((m = regex.exec(content)) !== null) {
      if (m[1] === "GAGNE") wins++;
      else losses++;
    }
    const total = wins + losses;
    const winRate = total > 0 ? Math.round(wins / total * 100) : 0;
    return { wins, losses, total, winRate };
  } catch { return null; }
}

// ─── Handlers commandes ───────────────────────────────────────
async function handleStart(chatId, firstName) {
  const msg = `🏛️ <b>Bienvenue sur TousLesMatchs, ${firstName || "ami"} !</b>

Hermès, notre IA de pronostics sportifs, analyse chaque jour des centaines de matchs pour ne publier que le meilleur pick.

<b>Commandes disponibles :</b>
/pick — Pick du jour
/stats — Nos statistiques
/premium — Devenir abonné Premium
/help — Aide

📊 <b>85%+ de réussite</b> sur les picks publiés.
🏆 Meilleure série : 11 victoires consécutives.`;

  await tgApi("sendMessage", {
    chat_id: chatId,
    text: msg,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Pick du jour", callback_data: "pick" }],
        [
          { text: "⭐ S'abonner Standard", url: STRIPE_STANDARD },
          { text: "💎 S'abonner Premium",  url: STRIPE_PREMIUM  }
        ],
        [{ text: "🌐 Voir le site", url: SITE_URL }]
      ]
    }
  });
}

async function handlePick(chatId) {
  const pick = getTodayPick();

  if (!pick || pick.nopick) {
    await tgApi("sendMessage", {
      chat_id: chatId,
      text: `⚖️ <b>Pas de pick aujourd'hui</b>\n\nHermès n'a trouvé aucun match répondant à nos critères stricts.\n\n<i>Mieux vaut zéro pick qu'un mauvais pick.</i>\n\n🌐 ${SITE_URL}`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: "🌐 Voir le site", url: SITE_URL }]] }
    });
    return;
  }

  const sportEmoji = { "Foot":"⚽","Hockey":"🏒","Baseball":"⚾","Basket":"🏀" };
  const emoji = sportEmoji[pick.sport] || "🎯";
  const stars  = pick.confidence >= 8 ? "⭐⭐⭐" : pick.confidence >= 7 ? "⭐⭐" : "⭐";
  const level  = pick.confidence >= 8 ? "🔔 PICK PREMIUM" : "📊 PICK STANDARD";

  const msg = `${emoji} <b>${level}</b>

<b>${pick.match}</b>
🎯 Pari : <b>${pick.bet || pick.match.split(" vs ")[0] + " Vainqueur"}</b>
📈 Cote : <b>${pick.odds}</b>
🤖 Confiance IA : <b>${pick.confidence}/10</b> ${stars}

💎 <i>Canal TousLesMatchs Premium : pick HORS-ARJEL supplémentaire sur Pinnacle chaque jour.</i>
⚠️ <i>Mise recommandée : 2-5% de ton bankroll max.</i>
🌐 ${SITE_URL}`;

  await tgApi("sendMessage", {
    chat_id: chatId,
    text: msg,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⚡ Parier sur Winamax", url: "https://www.winamax.fr/parrain?code=77953728" },
          { text: "🎯 Parier sur Betclic",  url: "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ" }
        ],
        [
          { text: "⭐ S'abonner Standard", url: STRIPE_STANDARD },
          { text: "💎 Passer Premium",     url: STRIPE_PREMIUM  }
        ],
        [{ text: "🌐 Historique complet", url: SITE_URL }]
      ]
    }
  });
}

async function handleStats(chatId) {
  const stats = getStats();
  if (!stats) {
    await tgApi("sendMessage", { chat_id: chatId, text: "Stats non disponibles.", parse_mode: "HTML" });
    return;
  }
  const msg = `📊 <b>STATISTIQUES HERMÈS</b>

✅ Victoires  : <b>${stats.wins}</b>
❌ Défaites   : <b>${stats.losses}</b>
📈 Win rate   : <b>${stats.winRate}%</b>
🏆 Meilleure série : <b>11 victoires consécutives</b>

<i>Picks publiés uniquement si note ≥ 7/10.
Jamais de match amical ou sans enjeu.</i>

🌐 ${SITE_URL}`;

  await tgApi("sendMessage", {
    chat_id: chatId,
    text: msg,
    parse_mode: "HTML",
    reply_markup: keyboardAbonnement()
  });
}

async function handlePremium(chatId) {
  const msg = `💎 <b>PASSER PREMIUM</b>

<b>Plan Standard — 9,90€/mois</b>
✓ Pick ARJEL prioritaire chaque matin
✓ Alertes Telegram instantanées
✓ Statistiques avancées

<b>Plan Premium — 19,90€/mois</b>
✓ Tout Standard inclus
✓ Pick HORS-ARJEL (Pinnacle, PS3838)
✓ Cotes supérieures vs bookmakers FR
✓ Canal @TousLesMatchs Premium (privé)

<i>Paiement sécurisé par Stripe. Résiliable à tout moment.</i>`;

  await tgApi("sendMessage", {
    chat_id: chatId,
    text: msg,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "⭐ S'abonner Standard — 9,90€/mois", url: STRIPE_STANDARD }],
        [{ text: "💎 S'abonner Premium — 19,90€/mois",  url: STRIPE_PREMIUM  }],
        [{ text: "🌐 En savoir plus sur le site",        url: SITE_URL        }]
      ]
    }
  });
}

async function handleHelp(chatId) {
  await tgApi("sendMessage", {
    chat_id: chatId,
    text: `🆘 <b>AIDE</b>

/start   — Accueil
/pick    — Pick du jour
/stats   — Nos statistiques
/premium — Plans d'abonnement
/help    — Cette aide

🌐 ${SITE_URL}`,
    parse_mode: "HTML"
  });
}

// ─── Polling ──────────────────────────────────────────────────
let offset = 0;

async function poll() {
  const res = await tgApi("getUpdates", { offset, timeout: 30, allowed_updates: ["message","callback_query"] });
  if (!res.ok || !res.result) return;

  for (const upd of res.result) {
    offset = upd.update_id + 1;
    const msg = upd.message;
    const cb  = upd.callback_query;

    if (cb) {
      await tgApi("answerCallbackQuery", { callback_query_id: cb.id });
      if (cb.data === "pick") await handlePick(cb.message.chat.id);
      continue;
    }

    if (!msg || !msg.text) continue;
    const chatId    = msg.chat.id;
    const firstName = msg.from?.first_name || "";
    const text      = msg.text.split("@")[0].toLowerCase().trim();

    if (text === "/start")   await handleStart(chatId, firstName);
    else if (text === "/pick")    await handlePick(chatId);
    else if (text === "/stats")   await handleStats(chatId);
    else if (text === "/premium") await handlePremium(chatId);
    else if (text === "/help")    await handleHelp(chatId);
    else {
      await tgApi("sendMessage", {
        chat_id: chatId,
        text: "Commandes : /pick /stats /premium /help",
        parse_mode: "HTML"
      });
    }
  }
}

async function run() {
  console.log("🤖 Bot TousLesMatchs démarré");
  while (true) {
    try { await poll(); } catch (e) { console.error("Poll error:", e.message); }
    await new Promise(r => setTimeout(r, 1000));
  }
}

run();
