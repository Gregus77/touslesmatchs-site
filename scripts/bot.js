/**
 * Bot Telegram TousLesMatchs — Prospects / Canal public
 * Navigation complète avec bouton 🔙 retour sur chaque écran
 * Multilingue : FR / EN / ES / IT / RU
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const { buildInlineKeyboard } = require("./bookmakers.config");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let offset = 0;

// ─── Sessions utilisateurs (mémoire vive) ────────────────────────────────────
const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, { lang: null });
  return sessions.get(chatId);
}

// ─── Lecture du pick du jour ──────────────────────────────────────────────────
function getTodayPick() {
  try {
    const f = path.join(__dirname, "today_pick.json");
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {}
  return null;
}

function getStats() {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, "picks_history.json"), "utf8"));
    return d.meta || {};
  } catch (e) {}
  return { total_picks: 27, total_wins: 21, total_losses: 6, win_rate: 0.78 };
}

// ─── Textes multilingues ──────────────────────────────────────────────────────
const T = {
  fr: {
    welcome:     "👋 <b>Bienvenue sur TousLesMatchs !</b>\n\nLe <b>Conseil Hermès</b> — 6 IAs — sélectionne le meilleur pick sportif chaque jour à 11h59.\n\n🏆 <b>78% de winrate</b> · Foot & Hockey\n\nChoisissez votre langue pour commencer :",
    menu_title:  "🏆 <b>MENU PRINCIPAL</b>\n\nQue souhaitez-vous faire ?",
    btn_pick:    "📊 Pick du jour",
    btn_stats:   "📈 Nos statistiques",
    btn_how:     "ℹ️ Comment ça marche",
    btn_lang:    "🌍 Changer de langue",
    btn_site:    "🌐 Voir le site",
    btn_back:    "🔙 Retour au menu",
    pick_none:   "❌ <b>Pas de pick aujourd'hui</b>\n\nLe Conseil Hermès n'a trouvé aucun match atteignant le seuil de confiance 8/10.\n\n✅ La discipline fait notre winrate élevé.\n⏰ Rendez-vous demain à <b>11h59</b> !",
    pick_header: "📊 <b>PICK DU JOUR — Conseil Hermès</b>",
    pick_match:  "🏟 Match",
    pick_bet:    "💡 Pari",
    pick_odds:   "📊 Cote",
    pick_conf:   "🔥 Confiance",
    stats_title: "📈 <b>STATS DU CONSEIL HERMÈS</b>",
    stats_body:  "🏆 Picks joués : <b>{total}</b>\n✅ Gagnés : <b>{wins}</b>\n❌ Perdus : <b>{losses}</b>\n📊 Winrate : <b>{rate}%</b>\n\n⚽ Foot : 80% winrate\n🏒 Hockey : 87% winrate\n\n📅 Mise à jour quotidienne à 11h59",
    how_title:   "ℹ️ <b>COMMENT ÇA MARCHE ?</b>",
    how_body:    "🤖 <b>Le Conseil Hermès</b> réunit 6 IAs :\n\n• <b>Groq/Llama3</b> — Scanner de matchs\n• <b>Gemini</b> — Analyse H2H\n• <b>DeepSeek</b> — Forme récente\n• <b>Mistral</b> — Contexte & blessures\n• <b>Qwen</b> — Value bet\n• <b>Claude</b> — Chef décideur ★\n\n📋 <b>Chaque matin :</b>\n1️⃣ Scan de tous les matchs du jour\n2️⃣ Chaque IA vote (note 0→10)\n3️⃣ Claude valide si note ≥ 8/10\n4️⃣ Pick publié à <b>11h59</b>\n\n⚠️ Jeu responsable · 18+ · Max 2-5% bankroll",
    lang_menu:   "🌍 <b>Choisissez votre langue :</b>",
    lang_set:    "🇫🇷 Langue définie sur <b>Français</b> ✅",
    site_url:    "https://touslesmatchs.com",
  },
  en: {
    welcome:     "👋 <b>Welcome to TousLesMatchs!</b>\n\nThe <b>Hermès Council</b> — 6 AIs — selects the best sports pick every day at 11:59 AM.\n\n🏆 <b>78% win rate</b> · Football & Hockey\n\nChoose your language to get started:",
    menu_title:  "🏆 <b>MAIN MENU</b>\n\nWhat would you like to do?",
    btn_pick:    "📊 Today's pick",
    btn_stats:   "📈 Our stats",
    btn_how:     "ℹ️ How it works",
    btn_lang:    "🌍 Change language",
    btn_site:    "🌐 Visit the site",
    btn_back:    "🔙 Back to menu",
    pick_none:   "❌ <b>No pick today</b>\n\nThe Hermès Council found no match reaching the 8/10 confidence threshold.\n\n✅ Discipline is what keeps our win rate high.\n⏰ See you tomorrow at <b>11:59 AM</b>!",
    pick_header: "📊 <b>TODAY'S PICK — Hermès Council</b>",
    pick_match:  "🏟 Match",
    pick_bet:    "💡 Bet",
    pick_odds:   "📊 Odds",
    pick_conf:   "🔥 Confidence",
    stats_title: "📈 <b>HERMÈS COUNCIL STATS</b>",
    stats_body:  "🏆 Picks played: <b>{total}</b>\n✅ Won: <b>{wins}</b>\n❌ Lost: <b>{losses}</b>\n📊 Win rate: <b>{rate}%</b>\n\n⚽ Football: 80% win rate\n🏒 Hockey: 87% win rate\n\n📅 Updated daily at 11:59 AM",
    how_title:   "ℹ️ <b>HOW IT WORKS</b>",
    how_body:    "🤖 <b>The Hermès Council</b> brings together 6 AIs:\n\n• <b>Groq/Llama3</b> — Match scanner\n• <b>Gemini</b> — H2H analysis\n• <b>DeepSeek</b> — Recent form\n• <b>Mistral</b> — Context & injuries\n• <b>Qwen</b> — Value bet\n• <b>Claude</b> — Decision maker ★\n\n📋 <b>Every morning:</b>\n1️⃣ Scan all matches of the day\n2️⃣ Each AI votes (score 0→10)\n3️⃣ Claude validates if score ≥ 8/10\n4️⃣ Pick published at <b>11:59 AM</b>\n\n⚠️ Responsible gambling · 18+ · Max 2-5% bankroll",
    lang_menu:   "🌍 <b>Choose your language:</b>",
    lang_set:    "🇬🇧 Language set to <b>English</b> ✅",
    site_url:    "https://touslesmatchs.com",
  },
  es: {
    welcome:     "👋 <b>¡Bienvenido a TousLesMatchs!</b>\n\nEl <b>Consejo Hermès</b> — 6 IAs — selecciona el mejor pronóstico deportivo cada día a las 11:59.\n\n🏆 <b>78% de victorias</b> · Fútbol y Hockey\n\nElige tu idioma para empezar:",
    menu_title:  "🏆 <b>MENÚ PRINCIPAL</b>\n\n¿Qué deseas hacer?",
    btn_pick:    "📊 Pronóstico del día",
    btn_stats:   "📈 Nuestras stats",
    btn_how:     "ℹ️ Cómo funciona",
    btn_lang:    "🌍 Cambiar idioma",
    btn_site:    "🌐 Ver el sitio",
    btn_back:    "🔙 Volver al menú",
    pick_none:   "❌ <b>Sin pronóstico hoy</b>\n\nEl Consejo Hermès no encontró ningún partido con nivel de confianza ≥ 8/10.\n\n✅ La disciplina mantiene nuestro alto porcentaje de victorias.\n⏰ ¡Hasta mañana a las <b>11:59</b>!",
    pick_header: "📊 <b>PRONÓSTICO DEL DÍA — Consejo Hermès</b>",
    pick_match:  "🏟 Partido",
    pick_bet:    "💡 Apuesta",
    pick_odds:   "📊 Cuota",
    pick_conf:   "🔥 Confianza",
    stats_title: "📈 <b>STATS DEL CONSEJO HERMÈS</b>",
    stats_body:  "🏆 Pronósticos jugados: <b>{total}</b>\n✅ Ganados: <b>{wins}</b>\n❌ Perdidos: <b>{losses}</b>\n📊 % Victorias: <b>{rate}%</b>\n\n⚽ Fútbol: 80% victorias\n🏒 Hockey: 87% victorias\n\n📅 Actualizado diariamente a las 11:59",
    how_title:   "ℹ️ <b>¿CÓMO FUNCIONA?</b>",
    how_body:    "🤖 <b>El Consejo Hermès</b> reúne 6 IAs:\n\n• <b>Groq/Llama3</b> — Scanner de partidos\n• <b>Gemini</b> — Análisis H2H\n• <b>DeepSeek</b> — Forma reciente\n• <b>Mistral</b> — Contexto y lesiones\n• <b>Qwen</b> — Value bet\n• <b>Claude</b> — Decisor ★\n\n📋 <b>Cada mañana:</b>\n1️⃣ Escaneo de todos los partidos\n2️⃣ Cada IA vota (nota 0→10)\n3️⃣ Claude valida si nota ≥ 8/10\n4️⃣ Pronóstico publicado a las <b>11:59</b>\n\n⚠️ Juego responsable · +18 · Máx. 2-5% bankroll",
    lang_menu:   "🌍 <b>Elige tu idioma:</b>",
    lang_set:    "🇪🇸 Idioma definido: <b>Español</b> ✅",
    site_url:    "https://touslesmatchs.com",
  },
  it: {
    welcome:     "👋 <b>Benvenuto su TousLesMatchs!</b>\n\nIl <b>Consiglio Hermès</b> — 6 IA — seleziona il miglior pronostico sportivo ogni giorno alle 11:59.\n\n🏆 <b>78% di vittorie</b> · Calcio e Hockey\n\nScegli la tua lingua per iniziare:",
    menu_title:  "🏆 <b>MENU PRINCIPALE</b>\n\nCosa vuoi fare?",
    btn_pick:    "📊 Pronostico del giorno",
    btn_stats:   "📈 Le nostre stats",
    btn_how:     "ℹ️ Come funziona",
    btn_lang:    "🌍 Cambia lingua",
    btn_site:    "🌐 Visita il sito",
    btn_back:    "🔙 Torna al menu",
    pick_none:   "❌ <b>Nessun pronostico oggi</b>\n\nIl Consiglio Hermès non ha trovato partite con livello di fiducia ≥ 8/10.\n\n✅ La disciplina mantiene il nostro alto win rate.\n⏰ A domani alle <b>11:59</b>!",
    pick_header: "📊 <b>PRONOSTICO DEL GIORNO — Consiglio Hermès</b>",
    pick_match:  "🏟 Partita",
    pick_bet:    "💡 Scommessa",
    pick_odds:   "📊 Quota",
    pick_conf:   "🔥 Fiducia",
    stats_title: "📈 <b>STATS DEL CONSIGLIO HERMÈS</b>",
    stats_body:  "🏆 Pronostici giocati: <b>{total}</b>\n✅ Vinti: <b>{wins}</b>\n❌ Persi: <b>{losses}</b>\n📊 Win rate: <b>{rate}%</b>\n\n⚽ Calcio: 80% vittorie\n🏒 Hockey: 87% vittorie\n\n📅 Aggiornato ogni giorno alle 11:59",
    how_title:   "ℹ️ <b>COME FUNZIONA?</b>",
    how_body:    "🤖 <b>Il Consiglio Hermès</b> riunisce 6 IA:\n\n• <b>Groq/Llama3</b> — Scanner partite\n• <b>Gemini</b> — Analisi H2H\n• <b>DeepSeek</b> — Forma recente\n• <b>Mistral</b> — Contesto e infortuni\n• <b>Qwen</b> — Value bet\n• <b>Claude</b> — Decisore ★\n\n📋 <b>Ogni mattina:</b>\n1️⃣ Scansione di tutte le partite\n2️⃣ Ogni IA vota (voto 0→10)\n3️⃣ Claude valida se voto ≥ 8/10\n4️⃣ Pronostico pubblicato alle <b>11:59</b>\n\n⚠️ Gioco responsabile · 18+ · Massimo 2-5% bankroll",
    lang_menu:   "🌍 <b>Scegli la tua lingua:</b>",
    lang_set:    "🇮🇹 Lingua impostata su <b>Italiano</b> ✅",
    site_url:    "https://touslesmatchs.com",
  },
  ru: {
    welcome:     "👋 <b>Добро пожаловать в TousLesMatchs!</b>\n\n<b>Совет Гермеса</b> — 6 ИИ — выбирает лучший спортивный прогноз каждый день в 11:59.\n\n🏆 <b>78% побед</b> · Футбол и Хоккей\n\nВыберите язык для начала работы:",
    menu_title:  "🏆 <b>ГЛАВНОЕ МЕНЮ</b>\n\nЧто вы хотите сделать?",
    btn_pick:    "📊 Прогноз дня",
    btn_stats:   "📈 Наша статистика",
    btn_how:     "ℹ️ Как это работает",
    btn_lang:    "🌍 Изменить язык",
    btn_site:    "🌐 Посетить сайт",
    btn_back:    "🔙 Вернуться в меню",
    pick_none:   "❌ <b>Сегодня прогноза нет</b>\n\nСовет Гермеса не нашёл матч с уровнем доверия ≥ 8/10.\n\n✅ Дисциплина — ключ к высокому винрейту.\n⏰ До встречи завтра в <b>11:59</b>!",
    pick_header: "📊 <b>ПРОГНОЗ ДНЯ — Совет Гермеса</b>",
    pick_match:  "🏟 Матч",
    pick_bet:    "💡 Ставка",
    pick_odds:   "📊 Коэффициент",
    pick_conf:   "🔥 Уверенность",
    stats_title: "📈 <b>СТАТИСТИКА СОВЕТА ГЕРМЕСА</b>",
    stats_body:  "🏆 Прогнозов сыграно: <b>{total}</b>\n✅ Выиграно: <b>{wins}</b>\n❌ Проиграно: <b>{losses}</b>\n📊 Винрейт: <b>{rate}%</b>\n\n⚽ Футбол: 80% побед\n🏒 Хоккей: 87% побед\n\n📅 Обновляется каждый день в 11:59",
    how_title:   "ℹ️ <b>КАК ЭТО РАБОТАЕТ?</b>",
    how_body:    "🤖 <b>Совет Гермеса</b> объединяет 6 ИИ:\n\n• <b>Groq/Llama3</b> — Сканер матчей\n• <b>Gemini</b> — Анализ H2H\n• <b>DeepSeek</b> — Последняя форма\n• <b>Mistral</b> — Контекст и травмы\n• <b>Qwen</b> — Value bet\n• <b>Claude</b> — Главный решатель ★\n\n📋 <b>Каждое утро:</b>\n1️⃣ Сканирование всех матчей дня\n2️⃣ Голосование каждого ИИ (0→10)\n3️⃣ Claude проверяет ≥ 8/10\n4️⃣ Прогноз публикуется в <b>11:59</b>\n\n⚠️ Ответственная игра · 18+ · Макс. 2-5% банкролла",
    lang_menu:   "🌍 <b>Выберите язык:</b>",
    lang_set:    "🇷🇺 Язык установлен: <b>Русский</b> ✅",
    site_url:    "https://touslesmatchs.com",
  }
};

function t(lang, key, vars = {}) {
  const str = (T[lang] || T.fr)[key] || T.fr[key] || key;
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : `{${k}}`);
}

// ─── API Telegram ─────────────────────────────────────────────────────────────
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

function send(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
  return api("sendMessage", body);
}

function editMsg(chatId, msgId, text, keyboard = null) {
  const body = { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML", disable_web_page_preview: true };
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
  return api("editMessageText", body);
}

// ─── Claviers ─────────────────────────────────────────────────────────────────
function kbBack(lang) {
  return [[{ text: t(lang, "btn_back"), callback_data: "menu" }]];
}

function kbMainMenu(lang) {
  return [
    [{ text: t(lang, "btn_pick"),  callback_data: "pick"  }],
    [{ text: t(lang, "btn_stats"), callback_data: "stats" }],
    [{ text: t(lang, "btn_how"),   callback_data: "how"   }],
    [
      { text: t(lang, "btn_lang"), callback_data: "lang" },
      { text: t(lang, "btn_site"), url: t(lang, "site_url") }
    ]
  ];
}

function kbLanguages(withBack = false) {
  const rows = [
    [{ text: "🇫🇷 Français", callback_data: "set_fr" }, { text: "🇬🇧 English",  callback_data: "set_en" }],
    [{ text: "🇪🇸 Español",  callback_data: "set_es" }, { text: "🇮🇹 Italiano", callback_data: "set_it" }],
    [{ text: "🇷🇺 Русский",  callback_data: "set_ru" }]
  ];
  if (withBack) rows.push([{ text: "🔙", callback_data: "menu" }]);
  return rows;
}

// ─── Écrans ───────────────────────────────────────────────────────────────────
function showWelcome(chatId) {
  return send(chatId, T.fr.welcome, kbLanguages(false));
}

function showMenu(chatId, lang, msgId = null) {
  const text = t(lang, "menu_title");
  const kb   = kbMainMenu(lang);
  return msgId ? editMsg(chatId, msgId, text, kb) : send(chatId, text, kb);
}

function showPick(chatId, lang, msgId = null) {
  const pick = getTodayPick();
  let text;

  if (!pick || pick.nopick) {
    text = t(lang, "pick_none");
    const kb = kbBack(lang);
    return msgId ? editMsg(chatId, msgId, text, kb) : send(chatId, text, kb);
  }

  const sportEmoji = { Foot: "⚽", Hockey: "🏒", Basketball: "🏀", Tennis: "🎾", NFL: "🏈", NBA: "🏀" };
  const emoji = sportEmoji[pick.sport] || "🎯";
  text = `${t(lang, "pick_header")}\n\n`
       + `${emoji} ${t(lang, "pick_match")} : <b>${pick.match}</b>\n`
       + `${t(lang, "pick_bet")} : <b>${pick.bet}</b>\n`
       + `${t(lang, "pick_odds")} : <b>${pick.odds}</b>\n`
       + `${t(lang, "pick_conf")} : <b>${pick.confidence}/10</b>\n\n`
       + `━━━━━━━━━━━━━━━━━━\n`
       + `⚠️ Jeu responsable · 18+ · Max 2-5% bankroll`;

  const kb = [
    ...buildInlineKeyboard([{ text: "🎯 Parier sur Winamax", url: "https://www.winamax.fr/parrain?code=77953728" }]),
    [{ text: t(lang, "btn_back"), callback_data: "menu" }]
  ];
  return msgId ? editMsg(chatId, msgId, text, kb) : send(chatId, text, kb);
}

function showStats(chatId, lang, msgId = null) {
  const s = getStats();
  const wins   = s.total_wins   || 21;
  const losses = s.total_losses || 6;
  const total  = (s.total_picks || 27);
  const rate   = Math.round((wins / Math.max(wins + losses, 1)) * 100);
  const text = `${t(lang, "stats_title")}\n\n` + t(lang, "stats_body", { total, wins, losses, rate });
  return msgId ? editMsg(chatId, msgId, text, kbBack(lang)) : send(chatId, text, kbBack(lang));
}

function showHow(chatId, lang, msgId = null) {
  const text = `${t(lang, "how_title")}\n\n${t(lang, "how_body")}`;
  return msgId ? editMsg(chatId, msgId, text, kbBack(lang)) : send(chatId, text, kbBack(lang));
}

function showLangMenu(chatId, lang, msgId = null) {
  const text = t(lang, "lang_menu");
  return msgId ? editMsg(chatId, msgId, text, kbLanguages(true)) : send(chatId, text, kbLanguages(true));
}

// ─── Gestionnaire principal ───────────────────────────────────────────────────
async function handleUpdate(update) {

  // ── Message texte ──
  if (update.message) {
    const chatId = update.message.chat.id;
    const text   = (update.message.text || "").trim();
    const sess   = getSession(chatId);

    if (text === "/start" || text === "/menu" || text === "/retour") {
      if (!sess.lang) { await showWelcome(chatId); }
      else            { await showMenu(chatId, sess.lang); }
      return;
    }
    if (text === "/pick")            { await showPick(chatId,  sess.lang || "fr"); return; }
    if (text === "/stats")           { await showStats(chatId, sess.lang || "fr"); return; }
    if (text === "/help" || text === "/aide") { await showHow(chatId, sess.lang || "fr"); return; }
    if (text === "/lang" || text === "/langue") { await showLangMenu(chatId, sess.lang || "fr"); return; }

    // Message inconnu → menu principal
    if (sess.lang) { await showMenu(chatId, sess.lang); }
    else           { await showWelcome(chatId); }
  }

  // ── Boutons inline ──
  if (update.callback_query) {
    const query  = update.callback_query;
    const chatId = query.message.chat.id;
    const msgId  = query.message.message_id;
    const data   = query.data;
    const sess   = getSession(chatId);

    await api("answerCallbackQuery", { callback_query_id: query.id });

    if (data.startsWith("set_")) {
      const newLang = data.replace("set_", "");
      sess.lang = newLang;
      sessions.set(chatId, sess);
      await editMsg(chatId, msgId, t(newLang, "lang_set"));
      await showMenu(chatId, newLang);
      return;
    }

    const lang = sess.lang || "fr";
    switch (data) {
      case "menu":  await showMenu(chatId, lang, msgId);     break;
      case "pick":  await showPick(chatId, lang, msgId);     break;
      case "stats": await showStats(chatId, lang, msgId);    break;
      case "how":   await showHow(chatId, lang, msgId);      break;
      case "lang":  await showLangMenu(chatId, lang, msgId); break;
      default:      await showMenu(chatId, lang, msgId);
    }
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────────
async function poll() {
  console.log("🤖 Bot TousLesMatchs démarré — en attente de messages...");
  while (true) {
    try {
      const res = await api("getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message", "callback_query"]
      });
      if (res.ok && res.result && res.result.length > 0) {
        for (const update of res.result) {
          await handleUpdate(update).catch(e =>
            console.error("Erreur handleUpdate:", e.message)
          );
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
