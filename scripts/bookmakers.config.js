const links = {
  winamax: process.env.WINAMAX_LINK || "https://www.winamax.fr/parrain?code=77953728",
  unibet: process.env.UNIBET_LINK || "https://www.unibet.fr/inscription/?campaign=210726&parrain=5EBF919DF1008254",
  pmu: process.env.PMU_LINK || "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728",
  betclic: process.env.BETCLIC_LINK || "https://go.onelink.me/2887093520/6c3132b8?af_sub5=GREGA3GZ",
};

const bookmakerButtons = [
  { text: "Winamax", url: links.winamax },
  { text: "Unibet", url: links.unibet },
  { text: "PMU", url: links.pmu },
  { text: "Betclic", url: links.betclic },
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

