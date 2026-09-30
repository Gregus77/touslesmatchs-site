"use strict";

const fs = require("fs");
const path = require("path");

const OUT = process.env.MARKETING_OUT || "/data/marketing";

function parisDay(){
  return new Intl.DateTimeFormat("fr-CA",{
    timeZone:"Europe/Paris",
    year:"numeric",
    month:"2-digit",
    day:"2-digit"
  }).format(new Date());
}

function esc(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function wrap(text,max=34){
  const words=String(text||"").split(/\s+/);
  const lines=[];
  let line="";
  for(const word of words){
    if((line+" "+word).trim().length>max){
      if(line) lines.push(line);
      line=word;
    } else {
      line=(line+" "+word).trim();
    }
  }
  if(line) lines.push(line);
  return lines.slice(0,7);
}

const day=parisDay();
const dir=path.join(OUT,day);
const jsonPath=path.join(dir,"publication.json");

if(!fs.existsSync(jsonPath)){
  throw new Error("publication.json absent — lancer hermes_marketing_content.js d'abord");
}

const data=JSON.parse(fs.readFileSync(jsonPath,"utf8"));

const cards=[
  {
    file:"01-resultat-du-jour",
    kicker:"RÉSULTATS RÉELS",
    title:`${data.wins} gagné${data.wins>1?"s":""} · ${data.losses} perdu${data.losses>1?"s":""}`,
    body:[
      `${data.resolved} analyse${data.resolved>1?"s":""} résolue${data.resolved>1?"s":""} aujourd'hui`,
      data.theoretical_profit_10eur!=null
        ? `Simulation mise fixe 10 € : ${data.theoretical_profit_10eur>=0?"+":""}${data.theoretical_profit_10eur.toFixed(2)} €`
        : "Résultats vérifiés dans l'historique",
      "Gagnés et perdus restent visibles."
    ]
  },
  {
    file:"02-bilan-du-jour",
    kicker:"BILAN DU JOUR",
    title:"5 IA confrontent leurs analyses",
    body:[
      `Résolus : ${data.resolved}`,
      `Gagnés : ${data.wins} · Perdus : ${data.losses}`,
      data.theoretical_roi_pct!=null
        ? `ROI théorique à mise fixe : ${data.theoretical_roi_pct.toFixed(1)} %`
        : "ROI non calculable sans cote enregistrée",
      "Aucun résultat n'est garanti."
    ]
  },
  {
    file:"03-comment-ca-marche",
    kicker:"COMMENT ÇA MARCHE ?",
    title:"Les IA votent. Vous gardez la décision.",
    body:[
      "Match admissible détecté",
      "5 IA donnent leur avis",
      "Convergence mesurée",
      "Résultat final enregistré",
      "Historique gagnés + perdus"
    ]
  }
];

for(const card of cards){
  const bodyLines=card.body.flatMap(x=>wrap(x,38));

  const bodySvg=bodyLines.map((line,i)=>
    `<text x="90" y="${850+i*82}" class="body">${esc(line)}</text>`
  ).join("\n");

  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#071126"/>
    <stop offset="55%" stop-color="#101d3b"/>
    <stop offset="100%" stop-color="#07101f"/>
  </linearGradient>
</defs>

<rect width="1080" height="1920" fill="url(#bg)"/>
<circle cx="900" cy="230" r="330" fill="#183f75" opacity=".28"/>
<circle cx="100" cy="1650" r="400" fill="#123e58" opacity=".25"/>

<style>
.brand{font:900 58px Arial,sans-serif;fill:#fff}
.kicker{font:800 34px Arial,sans-serif;fill:#7dd3fc;letter-spacing:4px}
.title{font:900 72px Arial,sans-serif;fill:#fff}
.body{font:600 42px Arial,sans-serif;fill:#d9e7ff}
.cta{font:900 48px Arial,sans-serif;fill:#fff}
.small{font:500 27px Arial,sans-serif;fill:#9fb1cc}
</style>

<text x="90" y="150" class="brand">TOUSLESMATCHS</text>
<text x="90" y="245" class="kicker">${esc(card.kicker)}</text>

<line x1="90" y1="310" x2="990" y2="310" stroke="#38bdf8" stroke-width="4" opacity=".7"/>

${wrap(card.title,25).map((line,i)=>
  `<text x="90" y="${470+i*90}" class="title">${esc(line)}</text>`
).join("\n")}

${bodySvg}

<rect x="90" y="1530" width="900" height="155" rx="35" fill="#14638a" opacity=".92"/>
<text x="540" y="1625" text-anchor="middle" class="cta">TousLesMatchs.com</text>

<text x="90" y="1770" class="small">5 IA · Analyses sportives · Historique transparent</text>
<text x="90" y="1825" class="small">18+ · Aucun gain garanti · Résultats passés ≠ résultats futurs</text>
</svg>`;

  fs.writeFileSync(path.join(dir,card.file+".svg"),svg);
}

console.log("🎨 3 VISUELS 1080x1920 CRÉÉS :",dir);
console.log("🟢 TikTok / Reels / Shorts prêts");
console.log("🟢 Aucune publication automatique");
console.log("🟢 Aucun appel IA");
