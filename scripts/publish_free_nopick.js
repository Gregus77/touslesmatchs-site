const fs = require("fs");
const path = require("path");
const https = require("https");

const TG_TOKEN = process.env.HERMES_ADMIN_TLM_BOT || process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

const TODAY_FILE = path.join(__dirname, "today_pick.json");
const SENT_FILE = path.join(__dirname, "free_nopick_sent.txt");

function todayParis() {
  return new Date().toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function sendTelegram(text) {
  return new Promise((resolve, reject) => {
    if (!TG_TOKEN || !TG_CHAT) {
      reject(new Error("Token Telegram ou chat Free manquant"));
      return;
    }

    const body = JSON.stringify({
      chat_id: TG_CHAT,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "💎 Premium 4,90€", url: "https://www.touslesmatchs.com/api/stripe/checkout-premium" }
          ],
          [
            { text: "📊 TousLesMatchs", url: "https://www.touslesmatchs.com" }
          ]
        ]
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
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(d);
        else reject(new Error(d));
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!fs.existsSync(TODAY_FILE)) {
    console.log("STOP - today_pick.json introuvable");
    return;
  }

  const todayPick = JSON.parse(fs.readFileSync(TODAY_FILE, "utf8"));
  if (!todayPick.nopick) {
    console.log("STOP - Un pick existe, pas de message no-pick Free");
    return;
  }

  const today = todayParis();
  if (fs.existsSync(SENT_FILE) && fs.readFileSync(SENT_FILE, "utf8").trim() === today) {
    console.log("STOP - Message no-pick Free déjà envoyé aujourd'hui");
    return;
  }

  const text = `🎯 <b>TousLesMatchs Free - Analyse du jour</b>

Aujourd’hui, aucun pick gratuit ne passe les critères Hermès.

Hermès préfère ne rien publier plutôt que forcer un pari moyen.

💎 <b>En Premium</b>, Hermès surveille plus de marchés football et peut proposer jusqu’à 3 sélections prioritaires quand les critères sont réunis.

Offre de lancement : <b>4,90€/mois</b>

⚠️ 18+ — Jeu responsable. Aucun gain garanti.`;

  await sendTelegram(text);
  fs.writeFileSync(SENT_FILE, today, "utf8");
  console.log("OK - message no-pick Free publié");
}

main().catch(err => {
  console.error("ERREUR - " + err.message);
  process.exit(1);
});
