const fs = require("fs");
const html = fs.readFileSync("public/app.html", "utf8");

function mustHave(text, label) {
  if (!html.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}
function mustNotHave(text, label) {
  if (html.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

mustHave("L’équipe forte doit marquer", "Goal +0,5 hero thesis");
mustHave("Football IA", "top product badge");
mustHave("goal05-palmeiras-card-20260814b", "Palmeiras card visual version");
mustHave("Le moteur +0,5 filtre uniquement", "specialized +0.5 positioning");
mustHave("SIGNAL EN ATTENTE", "compact waiting verdict state");
mustHave("Aucun match validé +0,5", "no fake pick state");
mustHave("Écart historique favorable", "signal card criteria");
mustHave("Bilan +0,5 en cours", "honest empty stats");
mustHave("/api/analysis-history?limit=160", "results JSON API route");
mustHave("body.tlm-page-app .tlm-floating-widgets", "floating widgets blocked in app");
mustHave("reg.unregister()", "service worker disabled for APK freshness");
mustHave("caches.delete(key)", "browser cache cleared for APK freshness");
mustNotHave("Aucun autre pari", "old explanatory block");
mustNotHave("Aucun signal +0,5 validé maintenant", "old no-signal card");
mustNotHave("Télécharger l'APK Android", "APK download CTA inside installed app");
mustNotHave("Application Android bêta", "install card inside installed app");
mustNotHave("/current-pick", "generic council pick in +0.5 app");
mustNotHave("widgets.js", "global floating widgets script");
mustNotHave("serviceWorker.register", "service worker registration in APK");

console.log("mobile_goal05_focus: OK");