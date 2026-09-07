#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "public", "app.html");
const outputPath = path.join(root, "public", "app-store.html");
let html = fs.readFileSync(sourcePath, "utf8");

function replaceOnce(search, replacement, label) {
  const before = html;
  html = html.replace(search, replacement);
  if (html === before) throw new Error(`Transformation introuvable: ${label}`);
}

replaceOnce(
  "<title>TousLesMatchs — Conseil IA</title>",
  "<title>TousLesMatchs — Analyses football IA</title>",
  "titre Google Play"
);
replaceOnce(
  '<meta name="description" content="Le verdict du Conseil IA : analyse du jour, signaux en direct et résultats vérifiables.">',
  '<meta name="description" content="Analyses statistiques du football, tendances en direct et résultats vérifiables.">',
  "description Google Play"
);
replaceOnce(
  '<script src="/js/match-lifecycle.js?v=20260907-integral6"></script>',
  '<script src="/js/match-lifecycle.js?v=20260907-integral7"></script>\n<script>window.__TLM_PLAY_STORE_FREE=true;</script>',
  "mode gratuit et cache traduction"
);

replaceOnce(
  /  var BOOKMAKERS = \[[\s\S]*?\n  function bookmakerButtons\(\) \{[\s\S]*?\n  \}\n/,
  "  function supplementaryButtons() { return ''; }\n",
  "retrait bookmakers"
);
html = html
  .replace(/\n  \.bookmakers\{[^\n]*\}[\s\S]*?\n  \.bookmaker-note\{[^\n]*\}/, "")
  .replace(/<!-- TLM_UNIBET_VISIBLE_START -->[\s\S]*?<!-- TLM_UNIBET_VISIBLE_END -->/, "")
  .replace(/signal-popup-bookmakers/g, "signal-popup-extra")
  .replace(/bookmakerButtons\(\)/g, "supplementaryButtons()");
replaceOnce(
  /  function goal05MemberAccess\(\) \{[\s\S]*?\n  \}/,
  "  function goal05MemberAccess() { return true; }",
  "accès gratuit au signal"
);
replaceOnce(
  /  function goal05MemberRow\(\) \{[\s\S]*?\n  \}/,
  "  function goal05MemberRow() { return ''; }",
  "retrait offre payante"
);
replaceOnce(
  "    <p class=\"sub\">Connecte-toi avec l'email et le code reçus après paiement.</p>",
  "    <p class=\"sub\">Connecte-toi avec ton email et le code d’accès gratuit reçu.</p>",
  "retrait paiement compte"
);
replaceOnce(
  /      \+ \(locked\n          \? '<a class="btn btn-g" href="\/#plans"[^\n]*\n          : '<button class="btn btn-o"[^\n]*\n/,
  "      + '<button class=\"btn btn-o\" type=\"button\" onclick=\"enableSignalAlerts()\" style=\"margin-top:12px\">Activer popup + son</button><button class=\"btn btn-o\" type=\"button\" onclick=\"enablePushNotifications()\" style=\"margin-top:8px\">Activer notifications meme app fermee</button>'\n",
  "retrait bouton abonnement"
);
replaceOnce(
  "    var odd = num(a.real_odd || a.odd || a.cote) > 1 ? \" · @\" + num(a.real_odd || a.odd || a.cote).toFixed(2) : \"\";",
  "    var odd = \"\";",
  "retrait cotes historique"
);
replaceOnce(
  "    $('signal-popup-text').textContent = (p.bet || p.best_bet || 'Sélection validée') + (p.cote ? ' · cote @' + p.cote : '') + (p.competition ? ' · ' + p.competition : '');",
  "    $('signal-popup-text').textContent = (p.bet || p.best_bet || 'Sélection validée') + (p.competition ? ' · ' + p.competition : '');",
  "retrait cote popup"
);
replaceOnce(
  "    var odd = hasSignal && signal.odd ? '@' + esc(signal.odd) : '@—';",
  "    var odd = '';",
  "retrait cote carte principale"
);
replaceOnce(
  "    var odd = Number(p.real_odd || p.cote || p.odd || 0);",
  "    var odd = 0;",
  "retrait cote signal courant"
);
replaceOnce(
  /    var calcProfit = done\.reduce\([\s\S]*?    \},0\);\n/,
  "",
  "retrait calcul financier"
);
replaceOnce(
  "    var profit=Number(verified.profit10!=null?verified.profit10:calcProfit)||0;\n    var roi=total?Math.round((profit/(total*10))*100):0;\n",
  "",
  "retrait variables financières"
);
replaceOnce(
  '$("perf-kpis").innerHTML =\n        kpi(String(total), "Signaux terminés", "")\n      + kpi(total ? wr + "%" : "—", "Réussite O/U 2,5", wr >= 60 ? "c-green" : wr > 0 ? "c-amber" : "")\n      + kpi(total ? eur(profit) : "0€", "Profit simulé 10€", profit >= 0 ? "c-green" : "c-red")\n      + kpi(total ? (roi >= 0 ? "+" : "") + roi + "%" : "—", "ROI", roi >= 0 ? "c-cyan" : "c-red");',
  '$("perf-kpis").innerHTML =\n        kpi(String(total), "Analyses terminées", "")\n      + kpi(total ? wr + "%" : "—", "Taux de réussite O/U 2,5", wr >= 60 ? "c-green" : wr > 0 ? "c-amber" : "")\n      + kpi(String(wins), "Analyses correctes", "c-green")\n      + kpi(String(Math.max(0, total - wins)), "Analyses incorrectes", total - wins > 0 ? "c-red" : "");',
  "retrait simulation financière"
);
replaceOnce(
  /<script id="tlm-paid-analysis-gate-js">[\s\S]*?<\/script>\n<script id="tlm-goal05-home-live-js"/,
  '<script id="tlm-paid-analysis-gate-js">window.__tlmPaidAnalysisGate=1;</script>\n<script id="tlm-goal05-home-live-js"',
  "retrait paywall analyses"
);

replaceOnce(
  "        + '<div class=\"comp\" style=\"margin-top:9px\">Tes préférences et ton accès sont enregistrés sur cette application. Les signaux payants restent liés à ta formule.</div>'\n        + '<a class=\"btn btn-o\" href=\"/live-ia.html\">Ouvrir le Live IA</a>'",
  "        + '<div class=\"comp\" style=\"margin-top:9px\">Tes préférences sont enregistrées sur cette application. Les analyses sont gratuites pendant la phase de lancement.</div>'",
  "compte connecté gratuit"
);
replaceOnce(
  "      + '<div class=\"card app-auth-card\"><div class=\"lbl\">Déjà abonné ?</div><div class=\"app-auth-title\">Retrouve ton accès</div>'\n      + '<div class=\"app-auth-note\">Entre l’email de ton abonnement et le code reçu après paiement. L’app gardera ensuite ta session et tes préférences.</div>'\n      + '<input id=\"in-mail\" type=\"email\" inputmode=\"email\" autocomplete=\"email\" placeholder=\"Email de ton abonnement\">'",
  "      + '<div class=\"card app-auth-card\"><div class=\"lbl\">Déjà inscrit ?</div><div class=\"app-auth-title\">Retrouve ton accès gratuit</div>'\n      + '<div class=\"app-auth-note\">Entre ton email et le code reçu. L’app gardera ensuite ta session et tes préférences.</div>'\n      + '<input id=\"in-mail\" type=\"email\" inputmode=\"email\" autocomplete=\"email\" placeholder=\"Ton email\">'",
  "connexion gratuite"
);
replaceOnce(
  "      + '<div class=\"app-auth-note\">Les sélections Over / Under 2,5 et les alertes membres sont disponibles à partir de 4,90€/mois.</div></div></div>';",
  "      + '<div class=\"app-auth-note\">Toutes les analyses validées sont gratuites pendant la phase de lancement.</div></div></div>';",
  "retrait prix compte"
);
replaceOnce(
  "      if (!email) { msg.textContent = \"Entre ton email d’abonnement.\"; return; }",
  "      if (!email) { msg.textContent = \"Entre ton email.\"; return; }",
  "message email gratuit"
);

html = html
  .replace(/d\.play\?'JOUER':'NE PAS JOUER'/g, "d.play?'TENDANCE FORTE':'AUCUNE TENDANCE'")
  .replace(/LIVE \+0,5 · JOUER/g, "LIVE +0,5 · TENDANCE FORTE")
  .replace(/'LIVE \+0,5 · JOUER'/g, "'LIVE +0,5 · TENDANCE FORTE'")
  .replace(/'Aide à la décision \+0,5 en direct'/g, "'Analyse statistique +0,5 en direct'");

replaceOnce(
  'marketingConsent: true, source: "android_app"',
  'marketingConsent: false, source: "google_play_free"',
  "consentement marketing explicite"
);

html = html.replace("familiaux, addiction. Conseils sur", "familiaux, addiction. Aide sur");
html = html.replace(/#plans/g, "#store-disabled");

const forbidden = [
  /buy\.stripe\.com/i,
  /winamax\.fr/i,
  /unibet\.fr/i,
  /pmu\.fr/i,
  /<a[^>]+href=["']\/#plans/i,
  /4,90\s*€/i,
  /après paiement/i,
  /\bcote\s*@/i,
  /Parier sur/i,
  /Ouvrir un bookmaker/i
  ,/Profit simulé/i
  ,/\bROI\b/
  ,/NE PAS JOUER/i
  ,/· JOUER/i
];
for (const pattern of forbidden) {
  if (pattern.test(html)) throw new Error(`Contenu interdit dans la version Store: ${pattern}`);
}

fs.writeFileSync(outputPath, html);
console.log(`OK: ${path.relative(root, outputPath)} généré sans paiement ni bookmaker`);
