const https = require("https");
const { buildInlineKeyboard } = require("./bookmakers.config");
const fs = require("fs");

const PICKS_FILE = "/opt/touslesmatchs/data/picks.json";
const SENT_FILE = "/opt/touslesmatchs/data/last_telegram_pick.txt";

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || "@touslesmatchs_fr";

function stop(message) {
  console.log("STOP - " + message);
  process.exit(0);
}

async function main() {
  if (!fs.existsSync(PICKS_FILE)) throw new Error("data/picks.json introuvable");

  const data = JSON.parse(fs.readFileSync(PICKS_FILE, "utf8"));
  const pick = data.currentPick || {};

  if (pick.status !== "EN ATTENTE") {
    stop(`Pick non publié car status=${pick.status}. Seuls les picks EN ATTENTE sont publiés.`);
  }

  const pickId = [pick.date, pick.home, pick.away, pick.prono, pick.cote].join("|");

  if (fs.existsSync(SENT_FILE) && fs.readFileSync(SENT_FILE, "utf8").trim() === pickId) {
    stop("Pick déjà publié. Doublon évité.");
  }

  const text = `🔥 <b>Pick IA du jour - TousLesMatchs</b>

🏟️ <b>${pick.home} vs ${pick.away}</b>
🏆 ${pick.league || ""}
🕒 ${pick.time || ""}

🎯 <b>Pronostic :</b> ${pick.bet || pick.prono || ""}
📊 <b>Cote indicative :</b> ${pick.cote || ""}
✅ <b>Confiance Hermès :</b> ${pick.confidenceTg || ""}

🔎 Analyse complète :
https://www.touslesmatchs.com

⚠️ 18+ uniquement. Pronostic informatif, résultat non garanti. Jouez de manière responsable.`;

  if (!TG_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN manquant");

  const body = JSON.stringify({
    chat_id: TG_CHAT,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    reply_markup: {
      inline_keyboard: buildInlineKeyboard([
        { text: "💎 Recevoir les picks Premium", url: "https://www.touslesmatchs.com/api/stripe/checkout-premium" },
        { text: "📊 TousLesMatchs", url: "https://www.touslesmatchs.com" }
      ])
    }
  });

  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, res => {
      res.on("data", () => {});
      res.on("end", resolve);
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });

  fs.writeFileSync(SENT_FILE, pickId, "utf8");
  console.log("OK - pick publié sur Telegram");
}

main().catch(err => {
  console.error("ERREUR - " + err.message);
  process.exit(1);
});
