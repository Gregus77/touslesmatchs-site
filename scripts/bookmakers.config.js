// ============================================================
// CONFIG CENTRALISÉE — LIENS AFFILIÉS BOOKMAKERS
// Pour modifier un lien, changez-le ici uniquement.
// Si un lien est vide (""), le bouton ne s'affiche pas.
// ============================================================

const BOOKMAKERS_CONFIG = [
  {
    name:  "Betclic",
    emoji: "⚡",
    url:   "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ",
    utm:   "?utm_source=telegram&utm_medium=bot&utm_campaign=pick_du_jour&utm_content=betclic",
  },
  {
    name:  "Winamax",
    emoji: "🏆",
    url:   "https://www.winamax.fr/parrain?code=WMX8M5",
    utm:   "",  // Winamax n'accepte pas les UTM sur les liens parrainage
  },
  {
    name:  "Unibet",
    emoji: "🎯",
    url:   "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254",
    utm:   "",
  },
  {
    name:  "PMU",
    emoji: "🇫🇷",
    url:   "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728",
    utm:   "",
  },
  {
    name:  "ParionsSport",
    emoji: "🔵",
    url:   "",  // ← Ajoute ton lien parrainage ParionsSport ici quand tu l'as
    utm:   "",
  },
];

// Retourne uniquement les bookmakers avec un lien configuré
function getActiveBookmakers() {
  return BOOKMAKERS_CONFIG.filter(b => b.url && b.url.trim() !== "");
}

// Construit le inline_keyboard Telegram (2 boutons par ligne, dernier seul si impair)
function buildInlineKeyboard(extraButtons = []) {
  const active = getActiveBookmakers();
  const rows = [];

  for (let i = 0; i < active.length; i += 2) {
    const row = [];
    const b1 = active[i];
    row.push({ text: `${b1.emoji} Parier sur ${b1.name}`, url: b1.url + b1.utm });
    if (active[i + 1]) {
      const b2 = active[i + 1];
      row.push({ text: `${b2.emoji} Parier sur ${b2.name}`, url: b2.url + b2.utm });
    }
    rows.push(row);
  }

  // Boutons supplémentaires (ex: lien site)
  extraButtons.forEach(btn => rows.push([btn]));

  return rows;
}

module.exports = { BOOKMAKERS_CONFIG, getActiveBookmakers, buildInlineKeyboard };
