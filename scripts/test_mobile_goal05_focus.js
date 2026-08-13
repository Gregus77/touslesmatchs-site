const fs = require("fs");
const html = fs.readFileSync("public/app.html", "utf8");

function mustHave(text, label) {
  if (!html.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}
function mustNotHave(text, label) {
  if (html.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

mustHave("L’équipe forte doit marquer", "Goal +0,5 hero thesis");
mustHave("moteur +0,5", "specialized +0.5 positioning");
mustHave("Aucun autre pari", "football +0.5 only promise");
mustHave("Aucun signal +0,5 validé maintenant", "honest no-signal state");
mustHave("Force historique", "historical strength criterion");
mustNotHave("Télécharger l'APK Android", "APK download CTA inside installed app");
mustNotHave("Application Android bêta", "install card inside installed app");
mustNotHave("/current-pick", "generic council pick in +0.5 app");

console.log("mobile_goal05_focus: OK");
