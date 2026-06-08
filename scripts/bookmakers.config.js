"use strict";
// Liens affiliés bookmakers + construction du keyboard Telegram pour les picks

const LINKS = {
  WINAMAX:  "https://www.winamax.fr/parrain?code=77953728",
  BETCLIC:  "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ",
  UNIBET:   "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254",
  PMU:      "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728",
  ZEBET:    "https://www.zebet.fr/fr/inscription",
  PARIONS:  "https://parionssport.lfdj.fr/fr-fr/inscription",
  STRIPE_STANDARD: "https://buy.stripe.com/4gM3cv4Je9ZG2RK3GS3VC00",
  STRIPE_PREMIUM:  "https://buy.stripe.com/9B64gzgrW2xe2RK4KW3VC01",
  SITE: "https://touslesmatchs.com",
};

function buildInlineKeyboard(pick) {
  return {
    inline_keyboard: [
      [{ text: "⚡ Winamax", url: LINKS.WINAMAX },
       { text: "🎯 Betclic",  url: LINKS.BETCLIC  }],
      [{ text: "⭐ Standard 9,90€/mois", url: LINKS.STRIPE_STANDARD }],
      [{ text: "💎 Premium 19,90€/mois", url: LINKS.STRIPE_PREMIUM  }],
      [{ text: "🌐 Historique complet",  url: LINKS.SITE            }],
    ],
  };
}

module.exports = { buildInlineKeyboard, LINKS };
