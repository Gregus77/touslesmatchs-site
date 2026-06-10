import React from "react";
import "./App.css";
import CGU from "./CGU";
import MentionsLegales from "./MentionsLegales";
import Confidentialite from "./Confidentialite";
import AnalyseLive from "./AnalyseLive";
import Calculateur from "./Calculateur";
import Login from "./Login";
import Subscription from "./Subscription";
import translations from "./translations";

var WINAMAX_LINK      = "https://www.winamax.fr/parrain?code=77953728";
var BETCLIC_LINK      = "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ";
var UNIBET_LINK       = "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254";
var PMU_LINK          = "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728";
var ZEBET_LINK        = "https://www.zebet.fr/fr/inscription";
var PARIONSSPORT_LINK = "https://parionssport.lfdj.fr/fr-fr/inscription";
var NETBET_LINK       = "https://www.netbet.fr/inscription";
var TIKTOK_LINK       = "https://www.tiktok.com/@touslesmatchs.com";
var TELEGRAM_LINK     = "https://t.me/touslesmatchs_bot";

// ─── TERRAIN DE FOOT EN FOND DU HERO ─────────────────────────
function FootballPitch() {
  return React.createElement("svg", {
    viewBox:"0 0 1400 680", xmlns:"http://www.w3.org/2000/svg",
    style:{position:"absolute",inset:0,width:"100%",height:"100%",preserveAspectRatio:"xMidYMid slice"}
  },
    React.createElement("rect",{width:"1400",height:"680",fill:"#020c02"}),
    ...[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19].map(function(i){
      return React.createElement("rect",{key:"s"+i,x:i*70,y:0,width:70,height:680,fill:i%2===0?"#020c02":"#031504",opacity:1});
    }),
    React.createElement("defs",null,
      React.createElement("radialGradient",{id:"glow",cx:"50%",cy:"50%",r:"50%"},
        React.createElement("stop",{offset:"0%",stopColor:"#4ADE80",stopOpacity:"0.18"}),
        React.createElement("stop",{offset:"100%",stopColor:"transparent",stopOpacity:"0"})
      ),
      React.createElement("radialGradient",{id:"dark",cx:"50%",cy:"50%",r:"50%"},
        React.createElement("stop",{offset:"60%",stopColor:"transparent",stopOpacity:"0"}),
        React.createElement("stop",{offset:"100%",stopColor:"#000",stopOpacity:"0.7"})
      )
    ),
    React.createElement("rect",{x:80,y:50,width:1240,height:580,fill:"none",stroke:"rgba(255,255,255,0.28)",strokeWidth:"3"}),
    React.createElement("line",{x1:700,y1:50,x2:700,y2:630,stroke:"rgba(255,255,255,0.28)",strokeWidth:"3"}),
    React.createElement("circle",{cx:700,cy:340,r:120,fill:"none",stroke:"rgba(255,255,255,0.28)",strokeWidth:"3"}),
    React.createElement("circle",{cx:700,cy:340,r:6,fill:"rgba(255,255,255,0.35)"}),
    React.createElement("rect",{x:80,y:195,width:210,height:290,fill:"none",stroke:"rgba(255,255,255,0.22)",strokeWidth:"2.5"}),
    React.createElement("rect",{x:80,y:255,width:100,height:170,fill:"none",stroke:"rgba(255,255,255,0.18)",strokeWidth:"2"}),
    React.createElement("rect",{x:60,y:290,width:20,height:100,fill:"none",stroke:"rgba(255,255,255,0.15)",strokeWidth:"2"}),
    React.createElement("rect",{x:1110,y:195,width:210,height:290,fill:"none",stroke:"rgba(255,255,255,0.22)",strokeWidth:"2.5"}),
    React.createElement("rect",{x:1220,y:255,width:100,height:170,fill:"none",stroke:"rgba(255,255,255,0.18)",strokeWidth:"2"}),
    React.createElement("rect",{x:1320,y:290,width:20,height:100,fill:"none",stroke:"rgba(255,255,255,0.15)",strokeWidth:"2"}),
    React.createElement("circle",{cx:260,cy:340,r:6,fill:"rgba(255,255,255,0.3)"}),
    React.createElement("circle",{cx:1140,cy:340,r:6,fill:"rgba(255,255,255,0.3)"}),
    React.createElement("path",{d:"M 290 195 A 110 110 0 0 1 290 485",fill:"none",stroke:"rgba(255,255,255,0.18)",strokeWidth:"2"}),
    React.createElement("path",{d:"M 1110 195 A 110 110 0 0 0 1110 485",fill:"none",stroke:"rgba(255,255,255,0.18)",strokeWidth:"2"}),
    React.createElement("path",{d:"M 80 50 A 25 25 0 0 1 105 75",fill:"none",stroke:"rgba(255,255,255,0.18)",strokeWidth:"2"}),
    React.createElement("path",{d:"M 1320 50 A 25 25 0 0 0 1295 75",fill:"none",stroke:"rgba(255,255,255,0.18)",strokeWidth:"2"}),
    React.createElement("path",{d:"M 80 630 A 25 25 0 0 0 105 605",fill:"none",stroke:"rgba(255,255,255,0.18)",strokeWidth:"2"}),
    React.createElement("path",{d:"M 1320 630 A 25 25 0 0 1 1295 605",fill:"none",stroke:"rgba(255,255,255,0.18)",strokeWidth:"2"}),
    React.createElement("rect",{width:"1400",height:"680",fill:"url(#glow)"}),
    React.createElement("rect",{width:"1400",height:"680",fill:"url(#dark)"})
  );
}

// ─── LOGOS CIRCULAIRES CLUBS ──────────────────────────────────
var ESP_SOC = "https://a.espncdn.com/i/teamlogos/soccer/500/";
var ESP_NBA = "https://a.espncdn.com/i/teamlogos/nba/500/";
var ESP_NHL = "https://a.espncdn.com/i/teamlogos/nhl/500/";
var FLAG    = "https://flagcdn.com/h80/";

var CLUBS = {
  "PSG":               {bg:"#001A5E",stripe:"#DA291C",abbr:"PSG", txt:"#fff", logo:ESP_SOC+"160.png"},
  "Paris Saint-Germain":{bg:"#001A5E",stripe:"#DA291C",abbr:"PSG",txt:"#fff", logo:ESP_SOC+"160.png"},
  "Marseille":         {bg:"#2563EB",stripe:"#ffffff", abbr:"OM",  txt:"#fff", logo:ESP_SOC+"516.png"},
  "Olympique de Marseille":{bg:"#2563EB",stripe:"#ffffff",abbr:"OM",txt:"#fff",logo:ESP_SOC+"516.png"},
  "Lyon":              {bg:"#0032A0",stripe:"#CC0000", abbr:"OL",  txt:"#fff", logo:ESP_SOC+"9847.png"},
  "Monaco":            {bg:"#BD2B34",stripe:"#ffffff", abbr:"ASM", txt:"#fff", logo:ESP_SOC+"162.png"},
  "Nice":              {bg:"#CC0000",stripe:"#000000", abbr:"OGC", txt:"#fff", logo:ESP_SOC+"521.png"},
  "Lens":              {bg:"#CC0000",stripe:"#E4B01B", abbr:"RCL", txt:"#fff", logo:ESP_SOC+"520.png"},
  "Real Madrid":       {bg:"#f5f5f5",stripe:"#003DA5", abbr:"RMA", txt:"#003DA5",logo:ESP_SOC+"86.png"},
  "Barcelona":         {bg:"#004D98",stripe:"#A50044", abbr:"FCB", txt:"#fff", logo:ESP_SOC+"83.png"},
  "Atletico Madrid":   {bg:"#CC0000",stripe:"#ffffff", abbr:"ATM", txt:"#fff", logo:ESP_SOC+"1068.png"},
  "Sevilla":           {bg:"#CC0000",stripe:"#ffffff", abbr:"SEV", txt:"#fff", logo:ESP_SOC+"243.png"},
  "Seville":           {bg:"#CC0000",stripe:"#ffffff", abbr:"SEV", txt:"#fff", logo:ESP_SOC+"243.png"},
  "Villarreal":        {bg:"#FFD700",stripe:"#005C8A", abbr:"VIL", txt:"#000", logo:ESP_SOC+"102.png"},
  "Arsenal":           {bg:"#EF0107",stripe:"#ffffff", abbr:"ARS", txt:"#fff", logo:ESP_SOC+"359.png"},
  "Chelsea":           {bg:"#034694",stripe:"#ffffff", abbr:"CHE", txt:"#fff", logo:ESP_SOC+"363.png"},
  "Liverpool":         {bg:"#C8102E",stripe:"#ffffff", abbr:"LIV", txt:"#fff", logo:ESP_SOC+"364.png"},
  "Manchester City":   {bg:"#6CABDD",stripe:"#1C2C5B", abbr:"MCI", txt:"#fff", logo:ESP_SOC+"382.png"},
  "Man City":          {bg:"#6CABDD",stripe:"#1C2C5B", abbr:"MCI", txt:"#fff", logo:ESP_SOC+"382.png"},
  "Aston Villa":       {bg:"#670E36",stripe:"#95BFE5", abbr:"AVL", txt:"#fff", logo:ESP_SOC+"362.png"},
  "Fribourg":          {bg:"#000000",stripe:"#CC0000", abbr:"SCF", txt:"#fff", logo:ESP_SOC+"3961.png"},
  "Bayern":            {bg:"#DC052D",stripe:"#0066B2", abbr:"FCB", txt:"#fff", logo:ESP_SOC+"132.png"},
  "Bayern Munich":     {bg:"#DC052D",stripe:"#0066B2", abbr:"FCB", txt:"#fff", logo:ESP_SOC+"132.png"},
  "Dortmund":          {bg:"#FDE100",stripe:"#000000", abbr:"BVB", txt:"#000", logo:ESP_SOC+"124.png"},
  "Leverkusen":        {bg:"#CC0000",stripe:"#000000", abbr:"B04", txt:"#fff", logo:ESP_SOC+"131.png"},
  "Stuttgart":         {bg:"#CC0000",stripe:"#ffffff", abbr:"VFB", txt:"#fff", logo:ESP_SOC+"2728.png"},
  "Inter Milan":       {bg:"#003DA5",stripe:"#000000", abbr:"INT", txt:"#fff", logo:ESP_SOC+"110.png"},
  "Lazio":             {bg:"#87D0DB",stripe:"#ffffff", abbr:"LAZ", txt:"#003E8A",logo:ESP_SOC+"111.png"},
  "Belgium":           {bg:"#000000",stripe:"#EF3340", abbr:"BEL", txt:"#fff", logo:FLAG+"be.png"},
  "Tunisia":           {bg:"#CC0000",stripe:"#ffffff", abbr:"TUN", txt:"#fff", logo:FLAG+"tn.png"},
  "Russia":            {bg:"#003DA5",stripe:"#CC0000", abbr:"RUS", txt:"#fff", logo:FLAG+"ru.png"},
  "Burkina Faso":      {bg:"#009A44",stripe:"#EF2B2D", abbr:"BFA", txt:"#fff", logo:FLAG+"bf.png"},
  "Canada":            {bg:"#CC0000",stripe:"#ffffff", abbr:"CAN", txt:"#fff", logo:FLAG+"ca.png"},
  "Uzbekistan":        {bg:"#1EB53A",stripe:"#ffffff", abbr:"UZB", txt:"#fff", logo:FLAG+"uz.png"},
  "Spurs":             {bg:"#C4CED4",stripe:"#000000", abbr:"SAS", txt:"#000", logo:ESP_NBA+"sa.png"},
  "San Antonio Spurs": {bg:"#C4CED4",stripe:"#000000", abbr:"SAS", txt:"#000", logo:ESP_NBA+"sa.png"},
  "Knicks":            {bg:"#006BB6",stripe:"#F58426", abbr:"NYK", txt:"#fff", logo:ESP_NBA+"ny.png"},
  "New York Knicks":   {bg:"#006BB6",stripe:"#F58426", abbr:"NYK", txt:"#fff", logo:ESP_NBA+"ny.png"},
  "Carolina":          {bg:"#CC0000",stripe:"#ffffff", abbr:"CAR", txt:"#fff", logo:ESP_NHL+"car.png"},
  "Philadelphia":      {bg:"#F74902",stripe:"#ffffff", abbr:"PHI", txt:"#fff", logo:ESP_NHL+"phi.png"},
  "Colorado":          {bg:"#6F263D",stripe:"#236192", abbr:"COL", txt:"#fff", logo:ESP_NHL+"col.png"},
  "Minnesota":         {bg:"#154734",stripe:"#DDCBA4", abbr:"MIN", txt:"#fff", logo:ESP_NHL+"min.png"},
  "VGK":               {bg:"#B4975A",stripe:"#000000", abbr:"VGK", txt:"#000", logo:ESP_NHL+"vgs.png"},
  "Anaheim":           {bg:"#FC4C02",stripe:"#000000", abbr:"ANA", txt:"#fff", logo:ESP_NHL+"ana.png"},
  "Buffalo":           {bg:"#003087",stripe:"#FCB514", abbr:"BUF", txt:"#fff", logo:ESP_NHL+"buf.png"},
  "Montreal":          {bg:"#AF1E2D",stripe:"#003E7E", abbr:"MTL", txt:"#fff", logo:ESP_NHL+"mon.png"},
  "Utah":              {bg:"#010101",stripe:"#4ADE80", abbr:"UTA", txt:"#fff", logo:ESP_NHL+"utah.png"},
  "Boston":            {bg:"#FFB81C",stripe:"#000000", abbr:"BOS", txt:"#000", logo:ESP_NHL+"bos.png"},
  "Boca Juniors":      {bg:"#003087",stripe:"#FFB81C", abbr:"BOCA",txt:"#fff", logo:ESP_SOC+"1670.png"},
  "Cruzeiro":          {bg:"#0A1172",stripe:"#ffffff", abbr:"CRU", txt:"#fff", logo:ESP_SOC+"127.png"},
};

function getClub(name) {
  if (!name) return null;
  if (CLUBS[name]) return CLUBS[name];
  var n = name.toLowerCase();
  for (var k in CLUBS) {
    if (k.toLowerCase().includes(n) || n.includes(k.toLowerCase())) return CLUBS[k];
  }
  return null;
}

function TeamCircle(props) {
  var name = props.name || "";
  var sz   = props.sz || 52;
  var club = getClub(name);
  var bg     = club ? club.bg     : "#1a1a1a";
  var stripe = club ? club.stripe : "#333";
  var abbr   = club ? club.abbr   : (name.split(" ").map(function(w){return w[0]||"";}).join("").toUpperCase().slice(0,3)||"?");
  var txtCol = club ? club.txt    : "#fff";
  var uid    = "c"+name.replace(/[^a-zA-Z0-9]/g,"");
  var [imgErr, setImgErr] = React.useState(false);

  if (club && club.logo && !imgErr) {
    return React.createElement("div", {
      style:{
        width:sz, height:sz, borderRadius:"50%",
        background:bg, overflow:"hidden", flexShrink:0,
        border:"2px solid rgba(255,255,255,0.18)",
        display:"flex", alignItems:"center", justifyContent:"center",
        filter:"drop-shadow(0 3px 10px rgba(0,0,0,0.6))"
      }
    },
      React.createElement("img",{
        src:club.logo, alt:name,
        style:{width:"82%",height:"82%",objectFit:"contain"},
        onError:function(){setImgErr(true);}
      })
    );
  }

  return React.createElement("svg", {
    width:sz, height:sz, viewBox:"0 0 60 60",
    style:{flexShrink:0,filter:"drop-shadow(0 3px 8px rgba(0,0,0,0.5))"}
  },
    React.createElement("defs",null,
      React.createElement("clipPath",{id:"cl-"+uid},
        React.createElement("circle",{cx:30,cy:30,r:28})
      )
    ),
    React.createElement("circle",{cx:30,cy:30,r:28,fill:bg}),
    React.createElement("rect",{x:18,y:-5,width:24,height:70,fill:stripe,opacity:0.4,clipPath:"url(#cl-"+uid+")",transform:"rotate(-20,30,30)"}),
    React.createElement("circle",{cx:30,cy:30,r:27,fill:"none",stroke:"rgba(255,255,255,0.25)",strokeWidth:"1.5"}),
    React.createElement("text",{
      x:30, y:abbr.length>3?33:35,
      textAnchor:"middle", fill:txtCol,
      fontSize:abbr.length>3?9:12,
      fontWeight:"800", fontFamily:"Inter,sans-serif", letterSpacing:"-0.3"
    }, abbr)
  );
}

// ─── NEURONE ANIMÉ ───────────────────────────────────────────
var AI_NODES = [
  {name:"Groq",     role:"Collecte données",  color:"#4ADE80"},
  {name:"Gemini",   role:"Stats avancées",    color:"#60A5FA"},
  {name:"DeepSeek", role:"Analyse H2H",       color:"#A78BFA"},
  {name:"Mistral",  role:"Forme récente",     color:"#34D399"},
  {name:"Qwen",     role:"Tendances cotes",   color:"#F97316"},
  {name:"Claude",   role:"Validation finale", color:"#F472B6"},
];

function NeuronOrbit() {
  return React.createElement("div", {className:"neuron-orbit"},
    React.createElement("div",{className:"orbit-ring",style:{width:"340px",height:"340px",borderColor:"rgba(74,222,128,0.07)"}}),
    React.createElement("div",{className:"orbit-ring",style:{width:"200px",height:"200px",borderColor:"rgba(74,222,128,0.05)",borderStyle:"dashed"}}),
    React.createElement("div",{className:"orbit-center"},
      React.createElement("span",{className:"orbit-center-nm"},"HERMÈS"),
      React.createElement("span",{className:"orbit-center-sub"},"Chief")
    ),
    AI_NODES.map(function(ai, i) {
      return React.createElement("div", {key:i, className:"orbit-arm"},
        React.createElement("div",{
          className:"orbit-line",
          style:{background:"linear-gradient(to right, transparent, "+ai.color+"55, "+ai.color+"44)"}
        }),
        React.createElement("div",{
          className:"orbit-packet",
          style:{background:ai.color,animationDelay:(i*0.5)+"s",boxShadow:"0 0 6px "+ai.color}
        }),
        React.createElement("div",{className:"orbit-node-wrap"},
          React.createElement("div",{
            className:"orbit-node",
            style:{borderColor:ai.color,boxShadow:"0 0 12px "+ai.color+"30"}
          },
            React.createElement("span",{className:"orbit-node-nm",style:{color:ai.color}},ai.name),
            React.createElement("span",{className:"orbit-node-role"},ai.role)
          )
        )
      );
    })
  );
}

// ─── DATA ─────────────────────────────────────────────────────
// Les matchs amicaux sont exclus — ne jamais les réintégrer dans cet array
var picks = [
  ["10/06","Spurs vs Knicks","Spurs ML","2.05","—","EN ATTENTE","Basket",7.5,8],
  ["06/06","Belgium vs Tunisia","Belgium Vainqueur","1.6","5-0","GAGNE","Foot",7,7],
  ["05/06","Russia vs Burkina Faso","Russia Vainqueur","1.60","3-0","GAGNE","Foot",7,7],
  ["04/06 au 06/06","PAS DE PARI","---","---","---","NOPICK","",0,8],
  ["02/06","Canada vs Uzbekistan","Canada Vainqueur","1.58","2-0","GAGNE","Foot",7.1,7],
  ["26/05 au 01/06","PAS DE PARI","---","---","---","NOPICK","",0,8],
  ["20/05","Fribourg vs Aston Villa","Victoire Aston Villa","1.58","0-1","GAGNE","Foot",9.1,8],
  ["19/05","Boca Juniors vs Cruzeiro","Moins de 2.5 buts","1.40","1-1","GAGNE","Foot",8.3,8],
  ["14/05 au 18/05","PAS DE PARI","---","---","---","NOPICK","",0,8],
  ["13/05","Lazio vs Inter Milan","Inter ML","1.66","0-2","GAGNE","Foot",8.7,8],
  ["13/05","Villarreal vs Seville","Over 2.5","1.75","2-2","GAGNE","Foot",8.4,8],
  ["11/05","Carolina vs Philadelphia","Carolina ML","1.58","4-2","GAGNE","Hockey",8.9,8],
  ["10/05","Colorado vs Minnesota","Colorado ML","1.62","5-1","GAGNE","Hockey",9.0,8],
  ["09/05","VGK vs Anaheim","VGK ML","1.55","6-2","GAGNE","Hockey",8.5,8],
  ["08/05","Carolina vs Philadelphia","Carolina ML","1.52","4-1","GAGNE","Hockey",8.8,8],
  ["07/05","Anaheim vs VGK","Anaheim ML","1.78","3-1","GAGNE","Hockey",7.8,7],
  ["06/05","Buffalo vs Montreal","Buffalo ML","1.60","1-5","PERDU","Hockey",7.6,7],
  ["05/05","VGK vs Anaheim","VGK ML","1.54","3-1","GAGNE","Hockey",8.2,8],
  ["04/05","Colorado vs Minnesota","Colorado ML","1.58","9-6","GAGNE","Hockey",8.6,8],
  ["03/05","Carolina vs Philadelphia","Carolina ML","1.50","3-0","GAGNE","Hockey",9.2,8],
  ["02/05","Utah vs VGK","VGK ML","1.62","5-1","GAGNE","Hockey",8.4,8],
  ["01/05","Buffalo vs Boston","Buffalo ML","1.70","4-1","GAGNE","Hockey",7.9,7],
  ["29/04","Leverkusen vs Dortmund","Over 2.5","1.62","3-1","GAGNE","Foot",8.3,8],
  ["28/04","Bayern vs Stuttgart","Over 2.5","1.55","1-0","PERDU","Foot",7.5,7]
];

var preuves = [
  {date:"20/05/2026", match:"Fribourg vs Aston Villa", gain:"+11.60 EUR", img:"/preuves/fribourg-20mai.png"},
  {date:"10/05/2026", match:"Colorado vs Minnesota", gain:"+17.80 EUR", img:"/preuves/colorado-10mai.png"},
  {date:"06/05/2026", match:"Buffalo vs Montreal", gain:"+17.60 EUR", img:"/preuves/buffalo-6mai.png"},
  {date:"03/05/2026", match:"Colorado vs Minnesota", gain:"+15.40 EUR", img:"/preuves/colorado-3mai.png"},
];

var faqs = [
  {q:"Les pronostics sont-ils garantis ?", a:"Non. Aucun pronostic n'est garanti. Notre système IA maximise les probabilités sur la base de données réelles, mais le sport comporte toujours une part d'incertitude. Nous ne publions que les picks avec un score ≥ 7/10. Les performances passées ne garantissent pas les résultats futurs."},
  {q:"Quels bookmakers recommandez-vous ?", a:"Winamax, Betclic, Unibet, PMU, ZEbet, ParionsSport et NetBet. Nos liens sont affiliés — vous bénéficiez des mêmes bonus officiels en passant par nos liens."},
  {q:"Comment recevoir les picks chaque jour ?", a:"Rejoignez notre canal Telegram @touslesmatchs_bot. Le pick du jour est publié chaque matin entre 9h et 11h (heure de Paris). Un pick à 7/10 est accompagné d'une recommandation de demi-mise."},
  {q:"Êtes-vous autorisés en France ?", a:"Oui. Nous opérons dans le cadre légal de l'affiliation avec des bookmakers agréés ANJ (ex-ARJEL). Nos contenus sont à titre informatif uniquement. Jeu interdit aux mineurs."},
  {q:"Que se passe-t-il si aucun pick fiable n'est disponible ?", a:"Nous n'inventons jamais de pick pour remplir le calendrier. Si aucun match sérieux n'atteint 7/10, nous n'en publions pas et nous en informons les abonnés sur Telegram. La qualité prime toujours sur la quantité."},
];

var bookmakers = [
  {nom:"Winamax",badge:"PARTENAIRE N°1",bonus:"Bonus 200 EUR",desc:"Bookmaker français N°1. Cotes excellentes, retrait rapide.",link:WINAMAX_LINK,note:"9.5/10"},
  {nom:"Betclic",badge:"TOP COTES",bonus:"Bonus 100 EUR",desc:"Cotes très compétitives sur le football européen.",link:BETCLIC_LINK,note:"9.2/10"},
  {nom:"Unibet",badge:"FIABLE",bonus:"100 EUR remboursé",desc:"Bookmaker international solide. Large choix de sports.",link:UNIBET_LINK,note:"8.8/10"},
  {nom:"PMU",badge:"100% FRANÇAIS",bonus:"Bonus 150 EUR",desc:"L'historique des paris en France.",link:PMU_LINK,note:"8.5/10"},
  {nom:"ZEbet",badge:"COTES ÉLEVÉES",bonus:"100 EUR remboursé",desc:"Spécialiste des cotes boostées.",link:ZEBET_LINK,note:"8.3/10"},
  {nom:"ParionsSport",badge:"FDJ OFFICIEL",bonus:"Bonus 100 EUR",desc:"Le pari sportif officiel de la FDJ.",link:PARIONSSPORT_LINK,note:"8.0/10"},
  {nom:"NetBet",badge:"BONNE VALEUR",bonus:"Bonus 100 EUR",desc:"Bon rapport qualité/cotes.",link:NETBET_LINK,note:"7.8/10"},
];

function sportE(s){var m={Foot:"⚽",Hockey:"🏒",Tennis:"🎾",Basketball:"🏀",Basket:"🏀",Baseball:"⚾",NFL:"🏈",Rugby:"🏉",MMA:"🥊"};return (m[s]||(s?"🎯":""))+" ";}

export default function App() {
  var [page, setPage]         = React.useState("home");
  var [faqOpen, setFaqOpen]   = React.useState(null);
  var [lang, setLang]         = React.useState(localStorage.getItem("lang") || "fr");
  var [histFilter, setHistFilter] = React.useState("Tous");

  function t(key) { return translations[lang]?.[key] || translations.fr[key] || key; }
  function setLangSave(l) { setLang(l); localStorage.setItem("lang",l); }

  React.useEffect(function(){
    if(window.gaLoaded) return; window.gaLoaded=true;
    var s=document.createElement("script"); s.async=true;
    s.src="https://www.googletagmanager.com/gtag/js?id=G-ME2T7G7PSK";
    document.head.appendChild(s);
    window.dataLayer=window.dataLayer||[];
    function gtag(){window.dataLayer.push(arguments);} window.gtag=gtag;
    gtag("js",new Date()); gtag("config","G-ME2T7G7PSK");
  },[]);

  function parseFR(d){var p=d.split(" au ");var s=p[p.length-1].trim().split("/");return s.length<2?new Date(0):new Date(2026,parseInt(s[1])-1,parseInt(s[0]));}

  picks=picks.slice().sort(function(a,b){return parseFR(b[0])-parseFR(a[0]);});
  var seen={};
  picks=picks.filter(function(p){var k=p[0]+"|"+p[5];if(seen[k])return false;seen[k]=true;return true;});

  var wins   = picks.filter(function(p){return p[5]==="GAGNE";}).length;
  var losses = picks.filter(function(p){return p[5]==="PERDU";}).length;
  var total  = picks.filter(function(p){return p[5]!=="NOPICK"&&p[5]!=="EN COURS"&&p[5]!=="EN ATTENTE"&&p[5]!=="ANNULE";}).length;
  var wr     = total>0?Math.round((wins/total)*100):0;
  var gains  = 0;
  picks.forEach(function(p){if(p[5]==="ANNULE"||p[5]==="NOPICK")return;if(p[5]==="GAGNE")gains+=(parseFloat(p[3])-1)*10;else if(p[5]==="PERDU")gains-=10;});

  var today  = new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"});
  var pAuj   = picks.find(function(p){return p[5]==="EN ATTENTE"&&p[0]===today;});
  var pNext  = pAuj||picks.slice().reverse().find(function(p){return p[5]==="EN ATTENTE";});
  var pdj    = pNext||picks[0];
  var noPick = !pNext&&(picks[0][5]==="NOPICK"||picks[0][5]==="GAGNE"||picks[0][5]==="PERDU");
  var score  = pdj[7]||0;
  var teams  = (noPick?"Spurs vs Knicks":pdj[1]).split(" vs ");
  var t1=teams[0]||"Spurs", t2=teams[1]||"Knicks";

  // Historique filtrable : exclut NOPICK et ANNULE
  var histSports = ["Tous","Foot","Hockey","Basket"];
  var histPicks  = picks.filter(function(p){
    if(p[5]==="NOPICK"||p[5]==="ANNULE") return false;
    if(histFilter==="Tous") return true;
    return p[6]===histFilter;
  });

  var flags = {fr:"🇫🇷",en:"🇬🇧",es:"🇪🇸",it:"🇮🇹",ru:"🇷🇺"};

  function scrollTo(id) {
    var el = document.getElementById(id);
    if(el) el.scrollIntoView({behavior:"smooth"});
  }

  // ─── HEADER ────────────────────────────────────────────────
  var hdr = React.createElement("header",{className:"hdr"},
    React.createElement("div",{className:"hdr-logo",onClick:function(){setPage("home");}},
      React.createElement("div",{className:"hdr-logo-icon"},"⚡"),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",lineHeight:1.15}},
        React.createElement("span",{className:"hdr-logo-name"},"TousLesMatchs"),
        React.createElement("span",{className:"hdr-logo-sub"},"Pick IA · Concile Hermès")
      )
    ),
    React.createElement("nav",{className:"hdr-nav"},
      [["home","Accueil"],["pick","Pick du jour"],["offres","Offres"],["resultats","Historique"],["faq","FAQ"],["preuves","Preuves"],["bookmakers","Bookmakers"]].map(function(item){
        var isPage = item[0]==="preuves"||item[0]==="bookmakers";
        return React.createElement("button",{
          key:item[0],
          className:"hdr-btn"+(page===item[0]?" on":""),
          onClick:function(){
            if(isPage){setPage(item[0]);}
            else{
              setPage("home");
              setTimeout(function(){
                var ids={home:null,pick:"pick-day",offres:"pricing",resultats:"historique",faq:"faq"};
                var id=ids[item[0]];
                if(id) scrollTo(id);
              },100);
            }
          }
        },item[1]);
      })
    ),
    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}},
      ["fr","en","es","it","ru"].map(function(l){
        return React.createElement("button",{key:l,title:l,onClick:function(){setLangSave(l);},style:{background:lang===l?"rgba(74,222,128,0.1)":"transparent",border:"1px solid "+(lang===l?"rgba(74,222,128,0.25)":"rgba(255,255,255,0.07)"),borderRadius:"6px",padding:"4px 6px",cursor:"pointer",fontSize:"14px",lineHeight:"1"}},flags[l]);
      }),
      React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"hdr-tg"},"✈ Rejoindre Telegram")
    )
  );

  // ─── FOOTER ────────────────────────────────────────────────
  var footer = React.createElement("footer",{className:"ft"},
    React.createElement("div",{className:"ft-inner"},
      React.createElement("div",{className:"ft-top"},
        React.createElement("div",null,
          React.createElement("div",{className:"ft-brand"},React.createElement("div",{className:"ft-brand-ico"},"⚡"),"TousLesMatchs"),
          React.createElement("p",{className:"ft-desc"},"Un pick clair chaque jour, analysé par 6 intelligences artificielles. Consultez, décidez, jouez de façon responsable."),
          React.createElement("div",{className:"ft-socials"},
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"ft-social"},"✈"),
            React.createElement("a",{href:TIKTOK_LINK,target:"_blank",className:"ft-social"},"♪")
          )
        ),
        React.createElement("div",null,
          React.createElement("div",{className:"ft-col-ttl"},"Navigation"),
          React.createElement("ul",{className:"ft-links"},
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("home");}},"Accueil")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("home");setTimeout(function(){scrollTo("pick-day");},100);}},"Pick du jour")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("preuves");}},"Preuves")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("bookmakers");}},"Bookmakers")),
            React.createElement("li",null,React.createElement("a",{href:TELEGRAM_LINK,target:"_blank"},"Canal Telegram"))
          )
        ),
        React.createElement("div",null,
          React.createElement("div",{className:"ft-col-ttl"},"Informations légales"),
          React.createElement("ul",{className:"ft-links"},
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("cgu");}},"Conditions d'utilisation")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("confidentialite");}},"Politique de confidentialité")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("mentions");}},"Mentions légales"))
          )
        ),
        React.createElement("div",null,
          React.createElement("div",{className:"ft-col-ttl"},"Jeu responsable"),
          React.createElement("div",{className:"ft-resp"},
            React.createElement("div",{className:"ft-resp-ttl"},"⚠ 18+ uniquement"),
            React.createElement("p",{className:"ft-resp-txt"},"Les paris sportifs comportent des risques de perte financière. Jeu interdit aux mineurs. Jouez de manière responsable. Les performances passées ne garantissent pas les résultats futurs.")
          )
        )
      ),
      React.createElement("div",{className:"ft-bottom"},
        React.createElement("span",{className:"ft-copy"},"© 2024 TousLesMatchs. Tous droits réservés."),
        React.createElement("span",{className:"ft-copy"},"LES PARIS SPORTIFS COMPORTENT DES RISQUES")
      )
    )
  );

  var legal = React.createElement("div",{className:"legal-bar"},
    React.createElement("div",{className:"legal-txt"},"Les paris sportifs comportent des risques de perte financière. Jeu interdit aux mineurs. Jouez de manière responsable. Les performances passées ne garantissent pas les résultats futurs."),
    React.createElement("div",{style:{fontSize:"9px",color:"rgba(255,255,255,0.06)",marginTop:"1px"}},t("risques_financiers"))
  );

  // ─── ROUTING ───────────────────────────────────────────────
  if(page==="login") return React.createElement(Login,{setPage});
  if(page==="subscription") return React.createElement(Subscription,{setPage});
  if(page==="cgu") return React.createElement(CGU,{setPage,footer,bandeauLegal:legal});
  if(page==="mentions") return React.createElement(MentionsLegales,{setPage,footer,bandeauLegal:legal});
  if(page==="confidentialite") return React.createElement(Confidentialite,{setPage,footer,bandeauLegal:legal});
  if(page==="analyse") return React.createElement(React.Fragment,null,hdr,React.createElement(AnalyseLive,null),footer,legal);
  if(page==="calculateur") return React.createElement(Calculateur,{setPage,footer,bandeauLegal:legal,header:hdr,picks});

  if(page==="preuves") return React.createElement("div",{style:{background:"#050d05",minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:"#fff"}},
    hdr,
    React.createElement("div",{style:{maxWidth:"1000px",margin:"0 auto",padding:"48px 24px"}},
      React.createElement("div",{style:{fontSize:"11px",letterSpacing:".18em",textTransform:"uppercase",color:"#4ADE80",fontWeight:"600",marginBottom:"10px"}},"PREUVES DE PERFORMANCE"),
      React.createElement("h2",{style:{fontSize:"clamp(28px,4vw,42px)",fontWeight:"800",letterSpacing:"-.02em",marginBottom:"8px"}},t("preuves_title")),
      React.createElement("p",{style:{fontSize:"13px",color:"rgba(255,255,255,0.4)",marginBottom:"28px"}},"Les performances passées ne garantissent pas les résultats futurs."),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"16px"}},
        preuves.map(function(p,i){
          return React.createElement("div",{key:i,style:{background:"#0e0e0e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"16px",overflow:"hidden"}},
            React.createElement("img",{src:p.img,alt:p.match,loading:"lazy",onError:function(e){e.target.style.display="none";},style:{width:"100%",height:"260px",objectFit:"contain",background:"rgba(0,0,0,0.5)",display:"block"}}),
            React.createElement("div",{style:{padding:"16px"}},
              React.createElement("div",{style:{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginBottom:"4px"}},p.date),
              React.createElement("div",{style:{fontSize:"14px",fontWeight:"600",marginBottom:"8px"}},p.match),
              React.createElement("div",{style:{fontSize:"22px",fontWeight:"800",color:"#4ADE80"}},p.gain)
            )
          );
        })
      )
    ),
    footer,legal
  );

  if(page==="bookmakers") return React.createElement("div",{style:{background:"#050d05",minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:"#fff"}},
    hdr,
    React.createElement("div",{style:{maxWidth:"900px",margin:"0 auto",padding:"48px 24px"}},
      React.createElement("div",{style:{fontSize:"11px",letterSpacing:".18em",textTransform:"uppercase",color:"#4ADE80",fontWeight:"600",marginBottom:"10px"}},"NOS PARTENAIRES"),
      React.createElement("h2",{style:{fontSize:"clamp(28px,4vw,42px)",fontWeight:"800",letterSpacing:"-.02em",marginBottom:"24px"}},t("bookmakers_title")),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"12px"}},
        bookmakers.map(function(b,i){
          return React.createElement("div",{key:i,style:{background:"#0e0e0e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"14px",padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"16px"}},
            React.createElement("div",{style:{flex:1,minWidth:"200px"}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px",flexWrap:"wrap"}},
                React.createElement("span",{style:{fontSize:"18px",fontWeight:"700"}},b.nom),
                React.createElement("span",{style:{background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:"4px",padding:"2px 8px",color:"#4ADE80",fontSize:"9px",letterSpacing:"1px",fontWeight:"700"}},b.badge),
                React.createElement("span",{style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"4px",padding:"2px 8px",color:"rgba(255,255,255,0.5)",fontSize:"9px"}},b.bonus)
              ),
              React.createElement("p",{style:{color:"rgba(255,255,255,0.4)",fontSize:"13px",margin:"0 0 5px",lineHeight:"1.6"}},b.desc),
              React.createElement("span",{style:{color:"#4ADE80",fontSize:"12px",fontWeight:"700"}},"Note : "+b.note)
            ),
            React.createElement("a",{href:b.link,target:"_blank",style:{background:"#4ADE80",color:"#000",borderRadius:"10px",padding:"12px 24px",fontWeight:"700",textDecoration:"none",fontSize:"13px",whiteSpace:"nowrap",fontFamily:"inherit"}},t("sinscrire"))
          );
        })
      )
    ),
    footer,legal
  );

  // ════════════════════════════════════════════════════════════
  //  HOME — ordre : Hero → Pick → Stats → IA → How → Pricing → Historique → Telegram → FAQ
  // ════════════════════════════════════════════════════════════
  return React.createElement("div",{style:{background:"#050d05",minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:"#fff",overflowX:"hidden"}},
    hdr,

    // ── 1. HERO ────────────────────────────────────────────
    React.createElement("section",{className:"hero"},
      React.createElement("div",{className:"hero-pitch"}, React.createElement(FootballPitch,null)),
      React.createElement("div",{className:"hero-pitch-overlay"}),

      React.createElement("div",{className:"hero-inner"},
        React.createElement("div",{className:"hero-left"},
          React.createElement("div",{className:"hero-badge"},
            React.createElement("span",{className:"badge-pulse"}),
            wr+"% de réussite · "+total+" paris analysés"
          ),
          React.createElement("h1",{className:"hero-h1"},
            "LE PICK ",React.createElement("span",{className:"grn"},"IA")," DU JOUR,",React.createElement("br",null),
            "CLAIR, ANALYSÉ,",React.createElement("br",null),
            React.createElement("span",{className:"grn"},"TRANSPARENT.")
          ),
          React.createElement("p",{className:"hero-desc"},
            "Chaque matin, 6 intelligences artificielles analysent des centaines de matchs. Vous recevez un seul pick sélectionné avec un score minimum de 7/10. Vous consultez l'analyse, puis vous décidez."
          ),
          React.createElement("div",{className:"hero-btns"},
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"btn-g"},
              "✈ REJOINDRE TELEGRAM GRATUITEMENT"
            ),
            React.createElement("a",{href:"#pick-day",className:"btn-o",onClick:function(e){e.preventDefault();scrollTo("pick-day");}},
              "VOIR LE PICK DU JOUR →"
            )
          ),
          React.createElement("div",{className:"hero-feats"},
            React.createElement("div",{className:"hero-feat"},React.createElement("div",{className:"feat-icon"},"✓"),React.createElement("div",{className:"feat-txt"},React.createElement("strong",null,"1 pick par jour minimum"),React.createElement("span",null,"Score ≥ 7/10 garanti"))),
            React.createElement("div",{className:"hero-feat"},React.createElement("div",{className:"feat-icon"},"🤖"),React.createElement("div",{className:"feat-txt"},React.createElement("strong",null,"6 IA en concile"),React.createElement("span",null,"Groq, Gemini, DeepSeek, Mistral, Qwen, Claude"))),
            React.createElement("div",{className:"hero-feat"},React.createElement("div",{className:"feat-icon"},"✈"),React.createElement("div",{className:"feat-txt"},React.createElement("strong",null,"Canal Telegram gratuit"),React.createElement("span",null,"Pick reçu chaque matin")))
          )
        ),

        React.createElement("div",{className:"hero-right"},
          React.createElement("div",{className:"phone-scene"},
          React.createElement("div",{className:"phone-wrap"},
            React.createElement("div",{className:"phone-frame"},
              React.createElement("div",{className:"phone-screen"},
                React.createElement("div",{className:"phone-sb"},
                  React.createElement("span",{className:"phone-sb-time"},"9:41"),
                  React.createElement("div",{className:"phone-dynamic-island"}),
                  React.createElement("div",{className:"phone-sb-right"},
                    React.createElement("span",null,"▮▮▮"),React.createElement("span",null,"⚡")
                  )
                ),
                React.createElement("div",{className:"phone-app-row"},
                  React.createElement("div",{className:"phone-app-ico"},"⚡"),
                  React.createElement("div",null,
                    React.createElement("div",{className:"phone-app-nm"},"TousLesMatchs"),
                    React.createElement("div",{className:"phone-app-sub"},"Pick IA · Aujourd'hui")
                  ),
                  React.createElement("div",{className:"phone-live-badge"},"LIVE")
                ),
                React.createElement("div",{className:"phone-match-hero"},
                  React.createElement("div",{className:"phone-team-hero"},
                    React.createElement(TeamCircle,{name:t1,sz:64}),
                    React.createElement("div",{className:"phone-team-nm2"},t1)
                  ),
                  React.createElement("div",{className:"phone-vs-col"},
                    React.createElement("div",{className:"phone-vs-badge"},"VS"),
                    React.createElement("div",{className:"phone-conf-mini"},score.toFixed(1)+"/10")
                  ),
                  React.createElement("div",{className:"phone-team-hero"},
                    React.createElement(TeamCircle,{name:t2,sz:64}),
                    React.createElement("div",{className:"phone-team-nm2"},t2)
                  )
                ),
                React.createElement("div",{className:"phone-pick-card"},
                  React.createElement("div",{className:"phone-pick-tag"},sportE(pdj[6]).trim()+" PRONOSTIC"),
                  React.createElement("div",{className:"phone-pick-val"},pdj[2]),
                  React.createElement("div",{className:"phone-pick-odd"},"Cote : "+React.createElement("strong",null,pdj[3]))
                ),
                React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"phone-cta"},"✈  RECEVOIR LE PICK DU JOUR"),
                React.createElement("div",{className:"phone-home-bar"})
              )
            )
          ))
        )
      )
    ),

    React.createElement("hr",{className:"divider"}),

    // ── 2. PICK DU JOUR ────────────────────────────────────
    React.createElement("div",{className:"pick-section",id:"pick-day"},
      React.createElement("div",{className:"section-wrap"},
        React.createElement("div",{className:"pick-hdr"},
          React.createElement("span",{className:"pick-hdr-ttl"}, noPick?"PAS DE PICK AUJOURD'HUI":"PICK DU JOUR"),
          !noPick&&React.createElement("span",{className:"badge-free"},"GRATUIT")
        ),
        noPick
          ? React.createElement("div",{style:{background:"#0e0e0e",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"20px",padding:"32px",textAlign:"center"}},
              React.createElement("div",{style:{fontSize:"32px",marginBottom:"8px"}},"🎯"),
              React.createElement("p",{style:{color:"rgba(255,255,255,0.55)",fontSize:"14px",fontWeight:"600",marginBottom:"8px"}},"Aucun pick fiable disponible aujourd'hui."),
              React.createElement("p",{style:{color:"rgba(255,255,255,0.35)",fontSize:"13px"}},"Notre système n'a trouvé aucun match atteignant 7/10 ce jour. Nous ne forçons jamais un pick. Rejoignez Telegram pour être informé dès qu'un pick est publié."),
              React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",style:{display:"inline-flex",alignItems:"center",gap:"8px",marginTop:"20px",background:"#3DFF8F",color:"#000",borderRadius:"12px",padding:"12px 24px",fontWeight:"700",textDecoration:"none",fontSize:"14px"}},"✈ Accéder au canal Telegram")
            )
          : React.createElement("div",{className:"pick-card"},
              React.createElement("div",{className:"pick-teams-col"},
                React.createElement("div",{className:"pick-league"},sportE(pdj[6])+pdj[0]),
                React.createElement("div",{className:"pick-teams-row"},
                  React.createElement("div",{className:"team-circle"},
                    React.createElement(TeamCircle,{name:t1,sz:52}),
                    React.createElement("div",{className:"team-circle-nm"},t1)
                  ),
                  React.createElement("span",{className:"pick-vs"},"vs"),
                  React.createElement("div",{className:"team-circle"},
                    React.createElement(TeamCircle,{name:t2,sz:52}),
                    React.createElement("div",{className:"team-circle-nm"},t2)
                  )
                )
              ),
              React.createElement("div",{className:"pick-stats"},
                React.createElement("div",{className:"pick-stat"},
                  React.createElement("div",{className:"pick-stat-lbl"},"PRONOSTIC"),
                  React.createElement("div",{className:"pick-stat-val",style:{fontSize:"16px",lineHeight:"1.3"}},pdj[2])
                ),
                React.createElement("div",{className:"pick-stat"},
                  React.createElement("div",{className:"pick-stat-lbl"},"COTE"),
                  React.createElement("div",{className:"pick-stat-val"},pdj[3])
                ),
                React.createElement("div",{className:"pick-stat"},
                  React.createElement("div",{className:"pick-stat-lbl"},"CONFIANCE"),
                  React.createElement("div",{className:"pick-stat-val grn"},score.toFixed(1)+"/10"),
                  React.createElement("div",{className:"pick-dots"},
                    [1,2,3,4,5,6,7].map(function(n){return React.createElement("span",{key:n,className:"dot"+(n<=Math.round(score)?" on":"")});})
                  ),
                  score<8?React.createElement("div",{style:{fontSize:"10px",color:"rgba(255,204,0,0.7)",marginTop:"4px"},title:"Pick 7/10 : demi-mise recommandée"},"⚡ demi-mise conseillée"):null
                )
              ),
              React.createElement("div",{className:"pick-right"},
                React.createElement("ul",{className:"pick-bullets"},
                  React.createElement("li",null,"Analyse de 35+ critères IA"),
                  React.createElement("li",null,"Données en temps réel"),
                  React.createElement("li",null,"Forme récente, H2H, absences, météo"),
                  React.createElement("li",null,"Score minimum publié : 7/10")
                ),
                React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"pick-tg-btn"},"✈ RECEVOIR LE PICK SUR TELEGRAM")
              )
            )
      )
    ),

    React.createElement("hr",{className:"divider"}),

    // ── 3. STATISTIQUES ────────────────────────────────────
    React.createElement("section",{className:"results-section"},
      React.createElement("div",{className:"section-wrap"},
        React.createElement("div",{className:"res-card",style:{maxWidth:"100%"}},
          React.createElement("div",{className:"res-ttl"},"NOS RÉSULTATS · MATCHS OFFICIELS UNIQUEMENT"),
          React.createElement("div",{style:{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginBottom:"20px",fontWeight:"400"}},"Les matchs amicaux sont exclus de toutes les statistiques."),
          React.createElement("div",{className:"res-stats"},
            React.createElement("div",{className:"res-stat"},React.createElement("div",{className:"res-num"},wr+"%"),React.createElement("div",{className:"res-lbl"},"Taux de réussite",React.createElement("br",null),total+" paris analysés")),
            React.createElement("div",{className:"res-stat"},React.createElement("div",{className:"res-num"},"+"+(gains/10).toFixed(1)+"u"),React.createElement("div",{className:"res-lbl"},"Bénéfice net",React.createElement("br",null),"base 10€ / pick")),
            React.createElement("div",{className:"res-stat"},React.createElement("div",{className:"res-num"},wins),React.createElement("div",{className:"res-lbl"},"Picks gagnants",React.createElement("br",null),losses+" perdu(s) / "+total)),
            React.createElement("div",{className:"res-stat"},React.createElement("div",{className:"res-num"},"6"),React.createElement("div",{className:"res-lbl"},"IA en concile",React.createElement("br",null),"Hermès Chief valide"))
          )
        )
      )
    ),

    React.createElement("hr",{className:"divider"}),

    // ── 4. NEURONE IA ──────────────────────────────────────
    React.createElement("section",{className:"neuron-section"},
      React.createElement("div",{className:"neuron-inner"},
        React.createElement("div",{className:"neuron-text"},
          React.createElement("div",{className:"neuron-eyebrow"},"6 INTELLIGENCES ARTIFICIELLES · CONCILE HERMÈS V5"),
          React.createElement("h2",{className:"neuron-h2"},
            "Comment le ",React.createElement("span",{className:"grn"},"pick"),
            React.createElement("br",null),"est sélectionné."
          ),
          React.createElement("p",{className:"neuron-desc"},
            "Chaque matin, Groq, Gemini, DeepSeek, Mistral, Qwen et Claude analysent des centaines de matchs sur plusieurs sports. Hermès Chief agrège les votes et ne valide que les picks atteignant le consensus minimum."
          ),
          React.createElement("div",{className:"neuron-chips"},
            AI_NODES.map(function(ai){
              return React.createElement("span",{key:ai.name,className:"neuron-chip",style:{borderColor:ai.color+"40",color:ai.color}},
                React.createElement("span",{className:"chip-dot",style:{background:ai.color}}),
                ai.name
              );
            })
          )
        ),
        React.createElement(NeuronOrbit,null)
      )
    ),

    React.createElement("hr",{className:"divider"}),

    // ── 5. COMMENT ÇA MARCHE ───────────────────────────────
    React.createElement("section",{className:"how-section"},
      React.createElement("div",{className:"section-wrap"},
        React.createElement("h2",{className:"section-title-c"},"COMMENT ÇA MARCHE ?"),
        React.createElement("div",{className:"how-grid"},
          [{icon:"🤖",t:"LES 6 IA ANALYSENT",d:"Chaque matin, 6 IA passent en revue des centaines de matchs : foot, hockey, basket, baseball. Chaque IA évalue les données indépendamment.",n:"1"},
           {icon:"🎯",t:"HERMÈS VALIDE",d:"Hermès Chief consolide les résultats. Seul le pick avec le score de consensus le plus élevé est retenu — minimum 7/10 pour être publié.",n:"2"},
           {icon:"✈",t:"VOUS RECEVEZ LE PICK",d:"Le pick est envoyé sur Telegram entre 9h et 11h (Paris). Vous consultez l'analyse complète et décidez en toute autonomie si vous souhaitez le suivre.",n:"3"}
          ].map(function(s,i){
            return React.createElement("div",{key:i,className:"how-card"},
              React.createElement("span",{className:"how-n"},s.n),
              React.createElement("div",{className:"how-ico"},s.icon),
              React.createElement("div",{className:"how-ttl"},s.t),
              React.createElement("p",{className:"how-dsc"},s.d),
              i<2?React.createElement("span",{className:"how-arrow"},"›"):null
            );
          })
        )
      )
    ),

    React.createElement("hr",{className:"divider"}),

    // ── 6. PRICING ─────────────────────────────────────────
    React.createElement("section",{className:"pricing-section",id:"pricing"},
      React.createElement("div",{className:"section-wrap"},
        React.createElement("h2",{className:"section-title-c"},"NOS FORMULES"),
        React.createElement("div",{className:"pricing-grid"},
          React.createElement("div",{className:"pricing-card"},
            React.createElement("div",{className:"pricing-tier"},"STANDARD"),
            React.createElement("div",{className:"pricing-price"},"Gratuit"),
            React.createElement("div",{className:"pricing-period"},"accès libre"),
            React.createElement("ul",{className:"pricing-feats"},
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"1 pick par jour (score ≥ 7/10)"),
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Analyse IA complète"),
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Envoi via Telegram"),
              React.createElement("li",null,React.createElement("span",{className:"ck off"},"✗"),React.createElement("span",{style:{opacity:.35}},"Picks premium (8/10+)"))
            ),
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"pricing-btn po"},"✈ REJOINDRE GRATUITEMENT")
          ),
          React.createElement("div",{className:"pricing-card feat"},
            React.createElement("div",{className:"pop-badge"},"LE PLUS POPULAIRE"),
            React.createElement("div",{className:"pricing-tier"},"PREMIUM"),
            React.createElement("div",{className:"pricing-price"},"19,90€"),
            React.createElement("div",{className:"pricing-period"},"/mois"),
            React.createElement("ul",{className:"pricing-feats"},
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Pick premium chaque jour (score ≥ 8/10)"),
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Analyse détaillée + historique complet"),
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Alertes en temps réel"),
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Support prioritaire sur Telegram")
            ),
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"pricing-btn pg"},"✈ DEMANDER L'ACCÈS PREMIUM")
          ),
          React.createElement("div",{className:"pricing-card"},
            React.createElement("div",{className:"pricing-tier"},"FULL ACCESS"),
            React.createElement("div",{className:"pricing-price"},"49,90€"),
            React.createElement("div",{className:"pricing-period"},"/mois"),
            React.createElement("ul",{className:"pricing-feats"},
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Tous les picks (tous sports)"),
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Alertes cotes & changements live"),
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Stats avancées & filtres"),
              React.createElement("li",null,React.createElement("span",{className:"ck"},"✓"),"Accès prioritaire & groupe privé")
            ),
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"pricing-btn po"},"✈ ACCÉDER AU FULL ACCESS")
          )
        )
      )
    ),

    React.createElement("hr",{className:"divider"}),

    // ── 7. HISTORIQUE FILTRABLE ────────────────────────────
    React.createElement("section",{className:"results-section",id:"historique"},
      React.createElement("div",{className:"section-wrap"},
        React.createElement("div",{className:"hist-card",style:{maxWidth:"100%"}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px",marginBottom:"20px"}},
            React.createElement("div",{className:"hist-ttl",style:{margin:0}},"HISTORIQUE DES PICKS · MATCHS OFFICIELS"),
            React.createElement("div",{className:"hist-filters"},
              histSports.map(function(sport){
                return React.createElement("button",{
                  key:sport,
                  className:"hist-filter-btn"+(histFilter===sport?" active":""),
                  onClick:function(){setHistFilter(sport);}
                },sport);
              })
            )
          ),
          histPicks.length===0
            ? React.createElement("p",{style:{color:"rgba(255,255,255,0.35)",fontSize:"13px",padding:"16px 0"}},"Aucun pick dans cette catégorie.")
            : React.createElement("table",{className:"hist-tbl"},
                React.createElement("thead",null,
                  React.createElement("tr",null,
                    React.createElement("th",null,"Date"),
                    React.createElement("th",null,"Match"),
                    React.createElement("th",null,"Pronostic"),
                    React.createElement("th",null,"Cote"),
                    React.createElement("th",null,"Score"),
                    React.createElement("th",null,"Résultat"),
                    React.createElement("th",null,"Statut")
                  )
                ),
                React.createElement("tbody",null,
                  histPicks.map(function(p,i){
                    var sc=p[5]==="GAGNE"?"g":p[5]==="PERDU"?"l":p[5]==="EN ATTENTE"?"w":"a";
                    var sl=p[5]==="GAGNE"?"GAGNÉ ↑":p[5]==="PERDU"?"PERDU ↓":p[5]==="EN ATTENTE"?"EN COURS":p[5];
                    return React.createElement("tr",{key:i},
                      React.createElement("td",null,p[0]),
                      React.createElement("td",{style:{fontWeight:"600"}},p[1]),
                      React.createElement("td",null,p[2]),
                      React.createElement("td",null,p[3]),
                      React.createElement("td",null,p[4]),
                      React.createElement("td",null,
                        React.createElement("span",{className:"sbadge "+sc},sl)
                      ),
                      React.createElement("td",{style:{fontSize:"12px",color:"rgba(255,255,255,0.4)"}},sportE(p[6]).trim()+" "+p[7].toFixed(1)+"/10")
                    );
                  })
                )
              ),
          React.createElement("div",{className:"chart-wrap",style:{marginTop:"16px"}},
            React.createElement("svg",{style:{width:"100%",height:"100%"},viewBox:"0 0 300 60",preserveAspectRatio:"none"},
              (function(){
                var pts=[];var cum=30;
                var pl=picks.filter(function(p){return p[5]==="GAGNE"||p[5]==="PERDU";}).slice(-12).reverse();
                pl.forEach(function(p,i){if(p[5]==="GAGNE")cum+=8;else cum-=10;pts.push((i*(300/Math.max(pl.length-1,1)))+","+Math.max(4,Math.min(56,60-cum)));});
                return React.createElement("polyline",{points:pts.join(" "),fill:"none",stroke:"#3DFF8F",strokeWidth:"2",strokeLinejoin:"round"});
              })()
            ),
            React.createElement("div",{className:"chart-lbl"},"+"+(gains/10).toFixed(1)+"u")
          )
        )
      )
    ),

    React.createElement("hr",{className:"divider"}),

    // ── 8. BLOC TELEGRAM CTA ───────────────────────────────
    React.createElement("section",{className:"tg-cta-section"},
      React.createElement("div",{className:"section-wrap"},
        React.createElement("div",{className:"tg-cta-inner"},
          React.createElement("div",{className:"tg-cta-left"},
            React.createElement("div",{className:"tg-cta-icon"},"✈"),
            React.createElement("div",null,
              React.createElement("h2",{className:"tg-cta-h2"},"Recevez le pick chaque matin sur Telegram"),
              React.createElement("p",{className:"tg-cta-desc"},"Gratuit, sans inscription préalable. Le pick du jour est publié entre 9h et 11h (Paris) avec l'analyse complète.")
            )
          ),
          React.createElement("div",{className:"tg-cta-btns"},
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"tg-cta-btn-main"},"✈ REJOINDRE LE CANAL GRATUIT"),
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"tg-cta-btn-sec"},"Demander l'accès Premium →")
          )
        )
      )
    ),

    React.createElement("hr",{className:"divider"}),

    // ── 9. FAQ ─────────────────────────────────────────────
    React.createElement("section",{className:"faq-section",id:"faq"},
      React.createElement("div",{className:"section-wrap"},
        React.createElement("h2",{className:"section-title-c"},"QUESTIONS FRÉQUENTES"),
        React.createElement("div",{className:"faq-grid"},
          faqs.map(function(f,i){
            var open=faqOpen===i;
            return React.createElement("div",{key:i,className:"faq-item"},
              React.createElement("button",{className:"faq-q",onClick:function(){setFaqOpen(open?null:i);}},
                f.q,React.createElement("span",{className:"faq-plus"+(open?" open":"")},"+")
              ),
              open?React.createElement("div",{className:"faq-a"},f.a):null
            );
          })
        )
      )
    ),

    footer,legal
  );
}
