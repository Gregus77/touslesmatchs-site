"use strict";

const fs = require("fs");

const files = {
  widgets: fs.readFileSync("public/js/widgets.js", "utf8"),
  appSource: fs.readFileSync("src/App.js", "utf8"),
  template: fs.readFileSync("site/template.html", "utf8"),
  generator: fs.readFileSync("council/tools/html_generator.py", "utf8"),
};
const legacyChatbot = fs.readFileSync("site/chatbot.js", "utf8");

const forbidden = /tlm-tiktok|aria-label=["']TikTok["']|TIKTOK_LINK|>TikTok<|tiktok\.com/i;

for (const [name, source] of Object.entries(files)) {
  if (forbidden.test(source)) {
    throw new Error(`TikTok encore présent dans l'interface source: ${name}`);
  }
}

if (!/aria-label="Assistant"/.test(files.widgets)) {
  throw new Error("Le bouton Assistant a disparu");
}
if (!/aria-label="Telegram"/.test(files.widgets)) {
  throw new Error("Le bouton Telegram a disparu");
}
if (!/TELEGRAM_LINK/.test(files.appSource)) {
  throw new Error("Le lien Telegram de l'application a disparu");
}
if (!/oldTikTok\.remove\(\)/.test(legacyChatbot)) {
  throw new Error("L'ancien widget ne supprime pas son bouton TikTok");
}

console.log("OK: TikTok retiré des interfaces site/application; Assistant et Telegram conservés");
