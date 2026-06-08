"use strict";
/**
 * bot.js — TousLesMatchs Free Bot
 * Canal Free : bot interactif @touslesmatchs_bot
 * Canal Premium : broadcast @touslesmatchs_fr (abonnés payants)
 */

const https   = require("https");
const fs      = require("fs");
const path    = require("path");

const TOKEN           = process.env.TELEGRAM_BOT_TOKEN;
const PREMIUM_CHANNEL = process.env.TELEGRAM_PREMIUM_CHAT_ID;
const APP_FILE        = path.join(__dirname, "App.js");
const PICK_FILE       = path.join(__dirname, "today_pick.json");
const SESSIONS_FILE   = path.join(__dirname, "verify_sessions.json");
const USERS_DB_FILE   = path.join(__dirname, "users_db.json");

function loadJson(file, def) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return def; } }
function saveJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// ─── Liens ────────────────────────────────────────────────────
const STRIPE_STANDARD = "https://buy.stripe.com/4gM3cv4Je9ZG2RK3GS3VC00";
const STRIPE_PREMIUM  = "https://buy.stripe.com/9B64gzgrW2xe2RK4KW3VC01";
const SITE_URL        = "https://touslesmatchs.com";
const WINAMAX         = "https://www.winamax.fr/parrain?code=77953728";
const BETCLIC         = "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ";
const UNIBET          = "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254";
const PMU             = "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728";
const ZEBET           = "https://www.zebet.fr/fr/inscription";
const PARIONS         = "https://parionssport.lfdj.fr/fr-fr/inscription";

// ─── Clavier MENU PRINCIPAL ───────────────────────────────────
function keyboardMenu() {
  return { inline_keyboard: [
    [{ text: "📊 Pick du jour",        callback_data: "pick"        },
     { text: "📈 Statistiques",        callback_data: "stats"       }],
    [{ text: "💎 Passer Premium",      callback_data: "premium"     },
     { text: "🏦 Bookmakers",          callback_data: "bookmakers"  }],
    [{ text: "🌐 Voir le site",        url: SITE_URL                }]
  ]};
}

// ─── Clavier RETOUR ───────────────────────────────────────────
function keyboardBack() {
  return { inline_keyboard: [[{ text: "⬅️ Retour au menu", callback_data: "menu" }]] };
}

function keyboardBackAndSite() {
  return { inline_keyboard: [
    [{ text: "🌐 Voir le site",    url: SITE_URL  }],
    [{ text: "⬅️ Retour au menu", callback_data: "menu" }]
  ]};
}

// ─── API Telegram ─────────────────────────────────────────────
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

function send(chatId, text, keyboard) {
  return tgApi("sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard || keyboardMenu()
  });
}

function edit(chatId, msgId, text, keyboard) {
  return tgApi("editMessageText", {
    chat_id: chatId, message_id: msgId, text, parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard || keyboardMenu()
  });
}

// ─── Données ──────────────────────────────────────────────────
function getTodayPick() {
  try {
    if (fs.existsSync(PICK_FILE)) return JSON.parse(fs.readFileSync(PICK_FILE, "utf8"));
  } catch { /* */ }
  return null;
}

function getStats() {
  try {
    const content = fs.existsSync(APP_FILE) ? fs.readFileSync(APP_FILE, "utf8") : "";
    const regex = /\["[^"]+","[^"]+","[^"]+","([^"]+)","[^"]+","(GAGNE|PERDU)"/g;
    let wins = 0, losses = 0, profit = 0, m;
    while ((m = regex.exec(content)) !== null) {
      const cote = parseFloat(m[1]) || 1.5;
      if (m[2] === "GAGNE") { wins++; profit += (cote - 1); }
      else { losses++; profit -= 1; }
    }
    const total = wins + losses;
    const winRate = total > 0 ? Math.round(wins / total * 100) : 0;
    const roi = total > 0 ? (profit / total * 100).toFixed(1) : "0";
    // Meilleure série
    const pickList = [];
    const r2 = /\["[^"]+","[^"]+","[^"]+","[^"]+","[^"]+","(GAGNE|PERDU)"/g;
    let m2;
    while ((m2 = r2.exec(content)) !== null) pickList.push(m2[1]);
    let best = 0, cur = 0;
    for (let i = pickList.length - 1; i >= 0; i--) {
      if (pickList[i] === "GAGNE") { cur++; if (cur > best) best = cur; }
      else cur = 0;
    }
    return { wins, losses, total, winRate, roi, bestStreak: best };
  } catch { return null; }
}

// ─── Pages ────────────────────────────────────────────────────
function textMenu(firstName) {
  return `🏛️ <b>TousLesMatchs Free</b> — Bonjour ${firstName || ""} !

Hermès analyse chaque jour des centaines de matchs pour publier le meilleur pick.

<b>Que veux-tu faire ?</b>`;
}

function textPick() {
  const pick = getTodayPick();
  if (!pick || pick.nopick) {
    return {
      text: `⚖️ <b>PAS DE PICK AUJOURD'HUI</b>

Hermès n'a trouvé aucun match répondant à nos critères stricts (note ≥ 7/10).

<i>Mieux vaut zéro pick qu'un mauvais pick.</i>
📈 Winrate maintenu grâce à cette discipline.`,
      keyboard: { inline_keyboard: [
        [{ text: "🌐 Voir le site", url: SITE_URL }],
        [{ text: "⬅️ Retour au menu", callback_data: "menu" }]
      ]}
    };
  }
  const emoji = { Foot:"⚽", Hockey:"🏒", Baseball:"⚾", Basket:"🏀" }[pick.sport] || "🎯";
  const stars = pick.confidence >= 8 ? "⭐⭐⭐" : pick.confidence >= 7 ? "⭐⭐" : "⭐";
  const level = pick.confidence >= 8 ? "🔔 PICK PREMIUM" : "📊 PICK STANDARD";
  return {
    text: `${emoji} <b>${level}</b>

<b>${pick.match}</b>
🎯 Pari : <b>${pick.bet || pick.match.split(" vs ")[0] + " Vainqueur"}</b>
📈 Cote : <b>${pick.odds}</b>
🤖 Confiance IA : <b>${pick.confidence}/10</b> ${stars}

💎 <i>Canal Premium : pick HORS-ARJEL supplémentaire chaque jour sur Pinnacle.</i>
⚠️ <i>Mise max : 2-5% de ton bankroll.</i>`,
    keyboard: { inline_keyboard: [
      [{ text: "⚡ Winamax",  url: WINAMAX  },
       { text: "🎯 Betclic",  url: BETCLIC  }],
      [{ text: "🟢 Unibet",   url: UNIBET   },
       { text: "🇫🇷 PMU",     url: PMU      }],
      [{ text: "⭐ Standard 9,90€/mois",  url: STRIPE_STANDARD }],
      [{ text: "💎 Premium 19,90€/mois",  url: STRIPE_PREMIUM  }],
      [{ text: "⬅️ Retour au menu", callback_data: "menu" }]
    ]}
  };
}

function textStats() {
  const s = getStats();
  if (!s) return { text: "Stats non disponibles.", keyboard: keyboardBack() };
  return {
    text: `📊 <b>STATISTIQUES HERMÈS</b>

✅ Victoires      : <b>${s.wins}</b>
❌ Défaites       : <b>${s.losses}</b>
📈 Win rate       : <b>${s.winRate}%</b>
💰 ROI            : <b>+${s.roi}%</b>
🏆 Meilleure série : <b>${s.bestStreak} victoires consécutives</b>

<i>Picks publiés uniquement si note ≥ 7/10.
Jamais de match amical ou sans enjeu réel.</i>`,
    keyboard: { inline_keyboard: [
      [{ text: "💎 Passer Premium", url: STRIPE_PREMIUM }],
      [{ text: "🌐 Voir l'historique complet", url: SITE_URL }],
      [{ text: "⬅️ Retour au menu", callback_data: "menu" }]
    ]}
  };
}

function textPremium() {
  return {
    text: `💎 <b>PASSER PREMIUM</b>

<b>⭐ Plan Standard — 9,90€/mois</b>
✓ Pick ARJEL prioritaire chaque matin
✓ Alertes Telegram instantanées
✓ Statistiques avancées

<b>💎 Plan Premium — 19,90€/mois</b>
✓ Tout Standard inclus
✓ Pick HORS-ARJEL (Pinnacle, PS3838)
✓ Cotes supérieures vs bookmakers FR
✓ Canal <b>TousLesMatchs Premium</b> privé exclusif

<i>Paiement sécurisé Stripe. Résiliable à tout moment.</i>`,
    keyboard: { inline_keyboard: [
      [{ text: "⭐ S'abonner Standard — 9,90€/mois", url: STRIPE_STANDARD }],
      [{ text: "💎 S'abonner Premium — 19,90€/mois",  url: STRIPE_PREMIUM  }],
      [{ text: "🌐 En savoir plus sur le site",        url: SITE_URL        }],
      [{ text: "⬅️ Retour au menu", callback_data: "menu" }]
    ]}
  };
}

function textBookmakers() {
  return {
    text: `🏦 <b>NOS BOOKMAKERS PARTENAIRES</b>

Inscris-toi via nos liens pour obtenir ton bonus de bienvenue et soutenir TousLesMatchs.

⚡ <b>Winamax</b> — Bonus jusqu'à 200€
🎯 <b>Betclic</b> — Bonus 100€
🟢 <b>Unibet</b>  — Mise remboursée 100€
🇫🇷 <b>PMU</b>    — Bonus 150€
🔥 <b>ZEbet</b>   — Remboursement 100€
🔵 <b>ParionsSport</b> — Bonus 100€`,
    keyboard: { inline_keyboard: [
      [{ text: "⚡ Winamax (+200€)",      url: WINAMAX  },
       { text: "🎯 Betclic (+100€)",      url: BETCLIC  }],
      [{ text: "🟢 Unibet (+100€)",       url: UNIBET   },
       { text: "🇫🇷 PMU (+150€)",         url: PMU      }],
      [{ text: "🔥 ZEbet (+100€)",        url: ZEBET    },
       { text: "🔵 ParionsSport (+100€)", url: PARIONS  }],
      [{ text: "⬅️ Retour au menu", callback_data: "menu" }]
    ]}
  };
}

// ─── Vérification paiement Stripe + lien invite Premium ───────
async function handleVerifyPayment(chatId, sessionId, firstName) {
  const sessions = loadJson(SESSIONS_FILE, {});
  const session  = sessions[sessionId];

  if (!session) {
    await send(chatId,
      `⚠️ <b>Code introuvable</b>\n\nCe lien est invalide ou a déjà été utilisé.\nSi tu viens de payer, attends 30 secondes et réessaie.\nProblème persistant → contacte @HermesAdmin.`,
      { inline_keyboard: [[{ text: "⬅️ Retour au menu", callback_data: "menu" }]] }
    );
    return;
  }

  if (session.used) {
    await send(chatId,
      `✅ <b>Accès déjà activé</b>\n\nCet abonnement a déjà été lié à un compte Telegram.\nSi tu as changé de compte, contacte @HermesAdmin.`,
      { inline_keyboard: [[{ text: "⬅️ Retour au menu", callback_data: "menu" }]] }
    );
    return;
  }

  // Lien d'invitation à usage unique (expire dans 7 jours)
  const inviteRes = await tgApi("createChatInviteLink", {
    chat_id:      PREMIUM_CHANNEL,
    member_limit: 1,
    expire_date:  Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    name:         `Premium-${chatId}`,
  });

  if (!inviteRes.ok || !inviteRes.result?.invite_link) {
    await send(chatId,
      `❌ Erreur lors de la génération du lien. Contacte @HermesAdmin avec ton email de paiement.`,
      keyboardBack()
    );
    console.error("createChatInviteLink error:", JSON.stringify(inviteRes));
    return;
  }

  const inviteLink = inviteRes.result.invite_link;

  // Marquer la session utilisée + sauvegarder l'utilisateur
  sessions[sessionId].used        = true;
  sessions[sessionId].telegram_id = String(chatId);
  saveJson(SESSIONS_FILE, sessions);

  const db = loadJson(USERS_DB_FILE, {});
  db[String(chatId)] = {
    customer_id:  session.customer_id,
    email:        session.customer_email,
    session_id:   sessionId,
    activated_at: new Date().toISOString(),
  };
  saveJson(USERS_DB_FILE, db);

  await send(chatId,
    `🎉 <b>Paiement confirmé — Bienvenue !</b>\n\nBonjour <b>${firstName || ""}</b>, ton abonnement Premium est activé.\n\n👇 <b>Clique ici pour rejoindre le canal privé :</b>\n\n⚠️ <i>Ce lien est personnel et à usage unique. Si tu le partages, il sera brûlé et tu ne pourras pas rejoindre.</i>\n\n📲 Une fois dans le canal, tu recevras les picks premium chaque matin.`,
    { inline_keyboard: [
      [{ text: "🔐 Rejoindre TousLesMatchs Premium", url: inviteLink }],
      [{ text: "🌐 Voir le site", url: SITE_URL }],
    ]}
  );

  console.log(`✅ Premium activé — Telegram: ${chatId}, Session: ${sessionId}`);
}

// ─── Handlers ─────────────────────────────────────────────────
async function handleStart(chatId, firstName, param) {
  if (param && param.startsWith("verify_")) {
    await handleVerifyPayment(chatId, param.slice(7), firstName);
    return;
  }
  await send(chatId, textMenu(firstName), keyboardMenu());
}

async function handleMenu(chatId, msgId, firstName) {
  await edit(chatId, msgId, textMenu(firstName), keyboardMenu());
}

async function handleCallback(chatId, msgId, data, firstName) {
  if (data === "menu") {
    await edit(chatId, msgId, textMenu(firstName), keyboardMenu());
  } else if (data === "pick") {
    const p = textPick();
    await edit(chatId, msgId, p.text, p.keyboard);
  } else if (data === "stats") {
    const p = textStats();
    await edit(chatId, msgId, p.text, p.keyboard);
  } else if (data === "premium") {
    const p = textPremium();
    await edit(chatId, msgId, p.text, p.keyboard);
  } else if (data === "bookmakers") {
    const p = textBookmakers();
    await edit(chatId, msgId, p.text, p.keyboard);
  }
}

// ─── Polling ──────────────────────────────────────────────────
let offset = 0;

async function poll() {
  const res = await tgApi("getUpdates", { offset, timeout: 30, allowed_updates: ["message","callback_query"] });
  if (!res.ok || !res.result) return;

  for (const upd of res.result) {
    offset = upd.update_id + 1;
    const cb  = upd.callback_query;
    const msg = upd.message;

    if (cb) {
      await tgApi("answerCallbackQuery", { callback_query_id: cb.id });
      const chatId    = cb.message.chat.id;
      const msgId     = cb.message.message_id;
      const firstName = cb.from?.first_name || "";
      await handleCallback(chatId, msgId, cb.data, firstName);
      continue;
    }

    if (!msg || !msg.text) continue;
    const chatId    = msg.chat.id;
    const firstName = msg.from?.first_name || "";
    const rawText   = msg.text.trim();
    const text      = rawText.split("@")[0].toLowerCase().trim();

    // /start peut contenir un paramètre : /start verify_cs_xxx
    if (text.startsWith("/start")) {
      const parts = rawText.split(" ");
      const param = parts[1] || "";
      await handleStart(chatId, firstName, param);
    } else if (text === "/pick")        { const p = textPick();       await send(chatId, p.text, p.keyboard); }
    else if (text === "/stats")         { const p = textStats();      await send(chatId, p.text, p.keyboard); }
    else if (text === "/premium")       { const p = textPremium();    await send(chatId, p.text, p.keyboard); }
    else if (text === "/bookmakers")    { const p = textBookmakers(); await send(chatId, p.text, p.keyboard); }
    else if (text === "/menu")          await handleStart(chatId, firstName, "");
    else                                await handleStart(chatId, firstName, "");
  }
}

async function run() {
  console.log("🤖 TousLesMatchs Free Bot démarré");
  while (true) {
    try { await poll(); } catch (e) { console.error("Poll error:", e.message); }
    await new Promise(r => setTimeout(r, 1000));
  }
}

run();
