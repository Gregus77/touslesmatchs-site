const fs = require("fs");
const path = require("path");
const https = require("https");
const { buildInlineKeyboard } = require("./bookmakers.config");

const TG_TOKEN = process.env.HERMES_ADMIN_TLM_BOT || process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;
const SENT_FILE = path.join(__dirname, "free_premium_reminder_sent.txt");

function todayKey() {
  return new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function allowedDay() {
  const day = new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long"
  }).toLowerCase();

  return day.includes("mardi") || day.includes("vendredi");
}

function send(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chat_id: TG_CHAT,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: buildInlineKeyboard([
          { text: "💎 Premium 4,90€", url: "https://www.touslesmatchs.com/api/stripe/checkout-premium" },
          { text: "📊 TousLesMatchs", url: "https://www.touslesmatchs.com" }
        ])
      }
    });

    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve(d));
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!TG_TOKEN || !TG_CHAT) throw new Error("Telegram Free non configuré");

  if (!allowedDay()) {
    console.log("STOP - relance Premium uniquement mardi/vendredi");
    return;
  }

  const key = todayKey();
  if (fs.existsSync(SENT_FILE) && fs.readFileSync(SENT_FILE, "utf8").trim() === key) {
    console.log("STOP - relance déjà envoyée aujourd'hui");
    return;
  }

  const text = `💎 <b>Pourquoi passer Premium ?</b>

Le canal Free reste volontairement très sélectif.

En Premium, Hermès surveille davantage de matchs de football et plus de marchés foot pour détecter jusqu’à 3 sélections prioritaires quand les critères sont réunis.

🥇 Priorité 1 : opportunité la plus solide
🥈 Priorité 2 : alternative premium
🥉 Priorité 3 : opportunité complémentaire

🔥 Indice Hermès visuel
🔗 Boutons bookmakers
📊 Analyses plus complètes

Offre de lancement : <b>4,90€/mois</b>

⚠️ 18+ — Jeu responsable. Aucun gain garanti.`;

  await send(text);
  fs.writeFileSync(SENT_FILE, key, "utf8");
  console.log("OK - relance Premium publiée dans Free");
}

main().catch(err => {
  console.error("ERREUR - " + err.message);
  process.exit(1);
});
