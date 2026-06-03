const https = require("https");

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

function sendLanguageMenu(chatId) {
  return api("sendMessage", {
    chat_id: chatId,
    text: "🌍 <b>Choisissez votre langue</b>\nChoose your language:",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🇫🇷 Français", callback_data: "lang_fr" },
          { text: "🇬🇧 English",  callback_data: "lang_en" }
        ],
        [
          { text: "🇪🇸 Español",  callback_data: "lang_es" },
          { text: "🇮🇹 Italiano", callback_data: "lang_it" }
        ],
        [
          { text: "🇷🇺 Русский",  callback_data: "lang_ru" }
        ]
      ]
    }
  });
}

async function handleUpdate(update) {
  if (update.message) {
    const text = (update.message.text || "").trim();
    const chatId = update.message.chat.id;
    if (text === "/start" || text === "/langue" || text === "/language") {
      await sendLanguageMenu(chatId);
    }
  }

  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id;
    await api("answerCallbackQuery", { callback_query_id: query.id });

    const confirmations = {
      lang_fr: "🇫🇷 Langue française sélectionnée.\n\nVous recevrez vos picks en français. ✅",
      lang_en: "🇬🇧 English selected.\n\nYou will receive your picks in English. ✅",
      lang_es: "🇪🇸 Idioma español seleccionado.\n\nRecibirás tus pronósticos en español. ✅",
      lang_it: "🇮🇹 Lingua italiana selezionata.\n\nRiceverai i tuoi pronostici in italiano. ✅",
      lang_ru: "🇷🇺 Выбран русский язык.\n\nВы будете получать прогнозы на русском. ✅"
    };
    if (confirmations[query.data]) {
      await api("sendMessage", { chat_id: chatId, text: confirmations[query.data] });
    }
  }
}

async function poll() {
  console.log("🤖 Bot démarré — en attente de messages...");
  while (true) {
    try {
      const res = await api("getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message", "callback_query"]
      });
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
