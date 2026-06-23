const links = {
  winamax: process.env.WINAMAX_LINK || "https://www.winamax.fr/parrain?code=77953728",
  betclic: process.env.BETCLIC_LINK || "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ",
  unibet: process.env.UNIBET_LINK || "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254",
  pmu: process.env.PMU_LINK || "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728",
};

const bookmakerButtons = [
  { text: "Winamax", url: links.winamax },
  { text: "Betclic", url: links.betclic },
  { text: "Unibet", url: links.unibet },
  { text: "PMU", url: links.pmu },
];

function buildInlineKeyboard(extraRows = []) {
  const rows = [
    [bookmakerButtons[0], bookmakerButtons[1]],
    [bookmakerButtons[2], bookmakerButtons[3]],
  ];
  for (const item of extraRows) {
    if (Array.isArray(item)) rows.push(item);
    else if (item?.text && item?.url) rows.push([item]);
  }
  return rows;
}

module.exports = {
  ...links,
  links,
  bookmakerButtons,
  buildInlineKeyboard,
};
