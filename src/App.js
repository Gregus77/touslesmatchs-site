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

// Club badge database — couleurs officielles
var CLUB_DB = {
  // Ligue 1
  "PSG":              {bg:"#001A5E",  stripe:"#DA291C", text:"PSG", light:false},
  "Paris Saint-Germain":{bg:"#001A5E",stripe:"#DA291C", text:"PSG", light:false},
  "Marseille":        {bg:"#009BDE",  stripe:"#FFFFFF", text:"OM",  light:true},
  "Olympique de Marseille":{bg:"#009BDE",stripe:"#FFFFFF",text:"OM",light:true},
  "Lyon":             {bg:"#0032A0",  stripe:"#FFFFFF", text:"OL",  light:false},
  "Monaco":           {bg:"#BD2B34",  stripe:"#FFFFFF", text:"ASM", light:false},
  "Nice":             {bg:"#CC0000",  stripe:"#000000", text:"OGC", light:false},
  "Lens":             {bg:"#E4B01B",  stripe:"#CC0000", text:"RCL", light:false},
  // Liga
  "Real Madrid":      {bg:"#FEFEFE",  stripe:"#001489", text:"RMA", light:true},
  "Barcelona":        {bg:"#004D98",  stripe:"#A50044", text:"FCB", light:false},
  "Atletico Madrid":  {bg:"#CC0000",  stripe:"#FFFFFF", text:"ATM", light:false},
  "Sevilla":          {bg:"#CC0000",  stripe:"#FFFFFF", text:"SEV", light:false},
  "Villarreal":       {bg:"#FFD700",  stripe:"#005C8A", text:"VIL", light:true},
  // Premier League
  "Arsenal":          {bg:"#EF0107",  stripe:"#FFFFFF", text:"ARS", light:false},
  "Chelsea":          {bg:"#034694",  stripe:"#FFFFFF", text:"CHE", light:false},
  "Liverpool":        {bg:"#C8102E",  stripe:"#FFFFFF", text:"LIV", light:false},
  "Manchester City":  {bg:"#6CABDD",  stripe:"#1C2C5B", text:"MCI", light:true},
  "Man City":         {bg:"#6CABDD",  stripe:"#1C2C5B", text:"MCI", light:true},
  "Manchester United":{bg:"#DA291C",  stripe:"#FBE122", text:"MUN", light:false},
  "Aston Villa":      {bg:"#95BFE5",  stripe:"#670E36", text:"AVL", light:true},
  "Tottenham":        {bg:"#132257",  stripe:"#FFFFFF", text:"TOT", light:false},
  "Fribourg":         {bg:"#000000",  stripe:"#CC0000", text:"SCF", light:false},
  // Bundesliga
  "Bayern":           {bg:"#DC052D",  stripe:"#0066B2", text:"FCB", light:false},
  "Bayern Munich":    {bg:"#DC052D",  stripe:"#0066B2", text:"FCB", light:false},
  "Dortmund":         {bg:"#FDE100",  stripe:"#000000", text:"BVB", light:true},
  "Leverkusen":       {bg:"#CC0000",  stripe:"#000000", text:"B04", light:false},
  "Stuttgart":        {bg:"#CC0000",  stripe:"#FFFFFF", text:"VFB", light:false},
  // Serie A
  "Inter Milan":      {bg:"#003DA5",  stripe:"#000000", text:"INT", light:false},
  "Lazio":            {bg:"#87D0DB",  stripe:"#FFFFFF", text:"LAZ", light:true},
  "Juventus":         {bg:"#000000",  stripe:"#FFFFFF", text:"JUV", light:false},
  // International
  "Greece":           {bg:"#0D5EAF",  stripe:"#FFFFFF", text:"GRE", light:false},
  "Italy":            {bg:"#003E8A",  stripe:"#009246", text:"ITA", light:false},
  "Belgium":          {bg:"#000000",  stripe:"#EF3340", text:"BEL", light:false},
  "Tunisia":          {bg:"#CC0000",  stripe:"#FFFFFF", text:"TUN", light:false},
  "Switzerland":      {bg:"#CC0000",  stripe:"#FFFFFF", text:"SUI", light:false},
  "Australia":        {bg:"#00008B",  stripe:"#FFD700", text:"AUS", light:false},
  "Russia":           {bg:"#FFFFFF",  stripe:"#CC0000", text:"RUS", light:true},
  "Burkina Faso":     {bg:"#009A44",  stripe:"#EF2B2D", text:"BFA", light:false},
  "Canada":           {bg:"#CC0000",  stripe:"#FFFFFF", text:"CAN", light:false},
  "Uzbekistan":       {bg:"#1EB53A",  stripe:"#FFFFFF", text:"UZB", light:false},
  // NBA
  "Spurs":            {bg:"#C4CED4",  stripe:"#000000", text:"SAS", light:true},
  "San Antonio Spurs":{bg:"#C4CED4",  stripe:"#000000", text:"SAS", light:true},
  "Knicks":           {bg:"#006BB6",  stripe:"#F58426", text:"NYK", light:false},
  "New York Knicks":  {bg:"#006BB6",  stripe:"#F58426", text:"NYK", light:false},
  // NHL
  "Carolina":         {bg:"#CC0000",  stripe:"#FFFFFF", text:"CAR", light:false},
  "Philadelphia":     {bg:"#F74902",  stripe:"#FFFFFF", text:"PHI", light:false},
  "Colorado":         {bg:"#6F263D",  stripe:"#236192", text:"COL", light:false},
  "Minnesota":        {bg:"#154734",  stripe:"#DDCBA4", text:"MIN", light:false},
  "VGK":              {bg:"#B4975A",  stripe:"#000000", text:"VGK", light:true},
  "Anaheim":          {bg:"#FC4C02",  stripe:"#000000", text:"ANA", light:false},
  "Buffalo":          {bg:"#003087",  stripe:"#FCB514", text:"BUF", light:false},
  "Montreal":         {bg:"#AF1E2D",  stripe:"#003E7E", text:"MTL", light:false},
  "Utah":             {bg:"#010101",  stripe:"#53D98A", text:"UTA", light:false},
  "Boston":           {bg:"#FFB81C",  stripe:"#000000", text:"BOS", light:true},
  // Other
  "Boca Juniors":     {bg:"#002D62",  stripe:"#F5C400", text:"BOCA",light:false},
  "Cruzeiro":         {bg:"#0A1172",  stripe:"#FFFFFF", text:"CRU", light:false},
};

function getClub(name) {
  if (!name) return null;
  if (CLUB_DB[name]) return CLUB_DB[name];
  var lower = name.toLowerCase();
  for (var k in CLUB_DB) {
    if (k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())) {
      return CLUB_DB[k];
    }
  }
  return null;
}

// Badge club — écusson coloré aux couleurs officielles
function ClubBadge(props) {
  var name = props.name || "";
  var size = props.size || "normal"; // "normal" | "small"
  var club = getClub(name);
  var bg     = club ? club.bg     : "#1a1a1a";
  var stripe = club ? club.stripe : "#333";
  var abbr   = club ? club.text   : name.substring(0,3).toUpperCase();
  var light  = club ? club.light  : false;
  var textColor = light ? "#000" : "#fff";

  var w = size === "small" ? 36 : 48;
  var h = size === "small" ? 40 : 54;
  var fs = size === "small" ? 9 : 11;

  return React.createElement("div", {
    className: size === "small" ? "club-badge" : "club-badge",
    style:{display:"flex",flexDirection:"column",alignItems:"center",gap:"5px"}
  },
    React.createElement("svg", {
      width: w, height: h,
      viewBox: "0 0 48 54",
      style:{flexShrink:0,filter:"drop-shadow(0 2px 8px rgba(0,0,0,0.4))"}
    },
      // Shield shape
      React.createElement("defs", null,
        React.createElement("clipPath", {id:"shield-"+name.replace(/\s/g,"")},
          React.createElement("path", {d:"M4,0 L44,0 L44,34 Q44,48 24,54 Q4,48 4,34 Z"})
        )
      ),
      // Base color
      React.createElement("path", {d:"M4,0 L44,0 L44,34 Q44,48 24,54 Q4,48 4,34 Z", fill:bg}),
      // Diagonal stripe
      React.createElement("path", {
        d:"M4,0 L44,0 L44,34 Q44,48 24,54 Q4,48 4,34 Z",
        fill: stripe,
        clipPath:"url(#shield-"+name.replace(/\s/g,"")+")",
        style:{opacity: 0.45},
        transform:"skewX(-12) translate(16,0)",
        width:"20"
      }),
      React.createElement("line", {x1:"28",y1:"0",x2:"28",y2:"54",stroke:stripe,strokeWidth:"10",opacity:"0.35",strokeLinecap:"round"}),
      // Border
      React.createElement("path", {d:"M4,0 L44,0 L44,34 Q44,48 24,54 Q4,48 4,34 Z", fill:"none", stroke:"rgba(255,255,255,0.2)", strokeWidth:"1.5"}),
      // Text
      React.createElement("text", {
        x:"24", y: abbr.length > 3 ? "30" : "32",
        textAnchor:"middle",
        fill:textColor,
        fontSize: abbr.length > 3 ? "8" : "11",
        fontWeight:"800",
        fontFamily:"Inter,sans-serif",
        letterSpacing:"-0.5"
      }, abbr)
    ),
    props.showName !== false
      ? React.createElement("div", {
          style:{
            fontSize:"12px",fontWeight:"600",
            color:"rgba(255,255,255,0.55)",
            textAlign:"center",
            maxWidth:"80px",lineHeight:"1.2"
          }
        }, name)
      : null
  );
}

// ─── NEURONE ANIMÉ — 6 IA orbitent autour d'Hermès ───────────
function NeuronOrbit() {
  var svgRef  = React.useRef(null);
  var angleRef = React.useRef(0);
  var frameRef = React.useRef(null);

  var AIS = [
    {name:"Groq",     role:"Collecte données",  color:"#4ADE80"},
    {name:"Gemini",   role:"Stats avancées",     color:"#60A5FA"},
    {name:"DeepSeek", role:"Analyse H2H",        color:"#A78BFA"},
    {name:"Mistral",  role:"Forme récente",      color:"#34D399"},
    {name:"Qwen",     role:"Tendances cotes",    color:"#F97316"},
    {name:"Claude",   role:"Validation finale",  color:"#F472B6"},
  ];

  React.useEffect(function() {
    var svg = svgRef.current;
    if (!svg) return;

    var CX = 220, CY = 180, R = 140;

    function tick() {
      angleRef.current += 0.006;
      var a0 = angleRef.current;

      AIS.forEach(function(ai, i) {
        var a = a0 + i * (Math.PI * 2 / AIS.length);
        var x = CX + R * Math.cos(a);
        var y = CY + R * Math.sin(a);

        var g = svg.querySelector('[data-node="'+i+'"]');
        if (g) g.setAttribute("transform","translate("+x+","+y+")");

        var line = svg.querySelector('[data-line="'+i+'"]');
        if (line) { line.setAttribute("x2",x); line.setAttribute("y2",y); }

        // Packet
        var t = ((a0 * 2.5 + i * 1.05) % (Math.PI * 2)) / (Math.PI * 2);
        var px = CX + (x - CX) * t;
        var py = CY + (y - CY) * t;
        var pkt = svg.querySelector('[data-pkt="'+i+'"]');
        if (pkt) { pkt.setAttribute("cx",px); pkt.setAttribute("cy",py); }
      });

      // Pulse central
      var scale = 1 + 0.03 * Math.sin(a0 * 3);
      var center = svg.querySelector('[data-center]');
      if (center) center.setAttribute("transform","translate("+CX+","+CY+") scale("+scale+")");

      frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return function() { cancelAnimationFrame(frameRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  var CX = 220, CY = 180, R = 140;

  return React.createElement("svg", {
    ref: svgRef,
    viewBox: "0 0 440 360",
    style:{width:"100%",height:"100%",overflow:"visible"}
  },
    // Orbit circles
    React.createElement("circle", {cx:CX,cy:CY,r:R,fill:"none",stroke:"rgba(74,222,128,0.07)",strokeWidth:"1"}),
    React.createElement("circle", {cx:CX,cy:CY,r:R*0.6,fill:"none",stroke:"rgba(74,222,128,0.04)",strokeWidth:"1",strokeDasharray:"4 8"}),

    // Lines from center
    AIS.map(function(ai, i) {
      var a = i * (Math.PI * 2 / AIS.length);
      return React.createElement("line", {
        key:"l"+i,
        "data-line": String(i),
        x1:CX, y1:CY,
        x2: CX + R * Math.cos(a),
        y2: CY + R * Math.sin(a),
        stroke: ai.color,
        strokeOpacity: 0.25,
        strokeWidth: 1.5,
        strokeDasharray: "none"
      });
    }),

    // Data packets
    AIS.map(function(ai, i) {
      return React.createElement("circle", {
        key:"pkt"+i,
        "data-pkt": String(i),
        cx:CX, cy:CY,
        r: 3.5,
        fill: ai.color,
        style:{filter:"blur(0.5px)"}
      });
    }),

    // Outer glow ring
    React.createElement("circle", {cx:CX,cy:CY,r:42,fill:"rgba(74,222,128,0.05)",stroke:"rgba(74,222,128,0.15)",strokeWidth:"1"}),

    // Central node
    React.createElement("g", {"data-center":"1", transform:"translate("+CX+","+CY+") scale(1)"},
      React.createElement("circle", {cx:0,cy:0,r:38,fill:"#080808",stroke:"#4ADE80",strokeWidth:"1.5"}),
      React.createElement("text", {x:0,y:-5,textAnchor:"middle",fill:"#4ADE80",fontSize:"12",fontWeight:"800",fontFamily:"Inter,sans-serif"},"HERMÈS"),
      React.createElement("text", {x:0,y:10,textAnchor:"middle",fill:"rgba(255,255,255,0.4)",fontSize:"9",fontFamily:"Inter,sans-serif"},"Chief")
    ),

    // AI nodes (initial pos, updated by animation)
    AIS.map(function(ai, i) {
      var a = i * (Math.PI * 2 / AIS.length);
      var x = CX + R * Math.cos(a);
      var y = CY + R * Math.sin(a);
      return React.createElement("g", {
        key:"n"+i,
        "data-node": String(i),
        transform:"translate("+x+","+y+")"
      },
        // Glow
        React.createElement("circle", {cx:0,cy:0,r:28,fill:ai.color,fillOpacity:"0.08"}),
        // Border circle
        React.createElement("circle", {cx:0,cy:0,r:23,fill:"#0A0A0A",stroke:ai.color,strokeWidth:"1.5"}),
        // Name
        React.createElement("text", {x:0,y:-3,textAnchor:"middle",fill:ai.color,fontSize:"9",fontWeight:"800",fontFamily:"Inter,sans-serif"},ai.name),
        // Role
        React.createElement("text", {x:0,y:8,textAnchor:"middle",fill:"rgba(255,255,255,0.35)",fontSize:"7",fontFamily:"Inter,sans-serif"},ai.role)
      );
    })
  );
}

var picks = [
  ["10/06","Spurs vs Knicks","Spurs ML","2.05","—","EN ATTENTE","Basket",7.5,8],
  ["08/06","Greece vs Italy","Greece Vainqueur","1.6","0-1","ANNULE","Foot",7,7],
  ["06/06","Switzerland vs Australia","Switzerland Vainqueur","1.6","1-1","ANNULE","Foot",7,7],
  ["06/06","Belgium vs Tunisia","Belgium Vainqueur","1.6","5-0","GAGNE","Foot",7,7],
  ["05/06","Russia vs Burkina Faso","Russia Vainqueur","1.60","3-0","GAGNE","Foot",7,7],
  ["04/06 au 06/06","PAS DE PARI - Aucun match championnat disponible","---","---","---","NOPICK","",0,8],
  ["02/06","Canada vs Uzbekistan","Canada Vainqueur","1.58","2-0","GAGNE","Foot",7.1,7],
  ["26/05 au 01/06","PAS DE PARI - Aucun match n atteint notre seuil 7/10","---","---","---","NOPICK","",0,8],
  ["20/05","Fribourg vs Aston Villa","Victoire Aston Villa","1.58","0-1","GAGNE","Foot",9.1,8],
  ["19/05","Boca Juniors vs Cruzeiro","Moins de 2.5 buts","1.40","1-1","GAGNE","Foot",8.3,8],
  ["14/05 au 18/05","PAS DE PARI - Aucun match n atteint notre seuil 7/10","---","---","---","NOPICK","",0,8],
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
  {date:"10/05/2026", match:"Minnesota vs Colorado Avalanche", gain:"+17.80 EUR", img:"/preuves/colorado-10mai.png"},
  {date:"06/05/2026", match:"Buffalo Sabres vs Montreal", gain:"+17.60 EUR", img:"/preuves/buffalo-6mai.png"},
  {date:"03/05/2026", match:"Colorado Avalanche vs Minnesota", gain:"+15.40 EUR", img:"/preuves/colorado-3mai.png"},
];

var faqs = [
  {q:"Les pronostics sont-ils garantis ?", a:"Aucun pronostic n'est garanti à 100%. Notre IA maximise les probabilités de gain, mais le sport comporte toujours une part d'incertitude. Nous ne publions que les picks avec un score ≥ 7/10."},
  {q:"Quels bookmakers utilisez-vous ?", a:"Nous analysons les cotes de Winamax, Betclic, Unibet, PMU, ZEbet, ParionsSport et NetBet. Nos liens sont affiliés — vous bénéficiez des mêmes bonus officiels."},
  {q:"Comment recevoir les picks ?", a:"Rejoignez notre canal Telegram gratuit @touslesmatchs_bot. Le pick du jour est publié chaque matin entre 9h et 11h (heure Paris)."},
  {q:"Êtes-vous autorisé en France ?", a:"Oui. Nous opérons sous le cadre légal de l'affiliation bookmakers agrées ARJEL (ANJ). Nos contenus sont à titre informatif uniquement. Les jeux d'argent sont interdits aux mineurs."},
];

var bookmakers = [
  {nom:"Winamax", badge:"PARTENAIRE N°1", bonus:"Bonus jusqu'à 200 EUR", desc:"Le bookmaker français numéro 1. Cotes excellentes, interface top, retrait rapide.", link:WINAMAX_LINK, note:"9.5/10"},
  {nom:"Betclic", badge:"TOP COTES", bonus:"Bonus bienvenue 100 EUR", desc:"Cotes très compétitives surtout sur le foot européen. Appli mobile excellente.", link:BETCLIC_LINK, note:"9.2/10"},
  {nom:"Unibet", badge:"FIABLE", bonus:"Mise remboursée 100 EUR", desc:"Bookmaker international solide. Large choix de sports et de marchés.", link:UNIBET_LINK, note:"8.8/10"},
  {nom:"PMU", badge:"100% FRANÇAIS", bonus:"Bonus 150 EUR", desc:"L'historique des paris en France. Idéal pour le foot et les courses hippiques.", link:PMU_LINK, note:"8.5/10"},
  {nom:"ZEbet", badge:"COTES ÉLEVÉES", bonus:"Remboursement 100 EUR", desc:"Spécialiste des cotes boostées. Souvent les meilleures cotes sur certains matchs.", link:ZEBET_LINK, note:"8.3/10"},
  {nom:"ParionsSport", badge:"FDJ OFFICIEL", bonus:"Bonus 100 EUR", desc:"Le pari sportif officiel de la FDJ. Sécurité maximale, idéal pour les débutants.", link:PARIONSSPORT_LINK, note:"8.0/10"},
  {nom:"NetBet", badge:"BONNE VALEUR", bonus:"Bonus 100 EUR", desc:"Bon rapport qualité/cotes. Interface simple et claire.", link:NETBET_LINK, note:"7.8/10"},
];

function sportEmoji(s) {
  var m = {Foot:"⚽",Hockey:"🏒",Tennis:"🎾",Basketball:"🏀",Basket:"🏀",Baseball:"⚾",MLS:"⚽",NFL:"🏈",Rugby:"🏉",MMA:"🥊"};
  return (m[s] || (s?"🎯":"")) + " ";
}

export default function App() {
  var [page, setPage]       = React.useState("home");
  var [faqOpen, setFaqOpen] = React.useState(null);
  var [lang, setLang]       = React.useState(localStorage.getItem("lang") || "fr");

  function changeLang(l) { setLang(l); localStorage.setItem("lang", l); }
  function t(key) { return translations[lang]?.[key] || translations.fr[key] || key; }

  React.useEffect(function() {
    if (window.gaLoaded) return;
    window.gaLoaded = true;
    var s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=G-ME2T7G7PSK";
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag; gtag("js", new Date()); gtag("config","G-ME2T7G7PSK");
  }, []);

  function parseDateFR(d) {
    var p = d.split(" au "); var s = p[p.length-1].trim().split("/");
    return s.length < 2 ? new Date(0) : new Date(2026, parseInt(s[1])-1, parseInt(s[0]));
  }

  picks = picks.slice().sort(function(a,b){ return parseDateFR(b[0])-parseDateFR(a[0]); });
  var seen = {};
  picks = picks.filter(function(p){
    var k=p[0]+"|"+p[5]; if(seen[k]) return false; seen[k]=true; return true;
  });

  var wins    = picks.filter(function(p){return p[5]==="GAGNE";}).length;
  var losses  = picks.filter(function(p){return p[5]==="PERDU";}).length;
  var total   = picks.filter(function(p){return p[5]!=="NOPICK"&&p[5]!=="EN COURS"&&p[5]!=="EN ATTENTE"&&p[5]!=="ANNULE";}).length;
  var winrate = total>0 ? Math.round((wins/total)*100) : 0;

  var gains = 0;
  picks.forEach(function(p){
    if(p[5]==="ANNULE") return;
    if(p[5]==="GAGNE") gains += (parseFloat(p[3])-1)*10;
    else if(p[5]==="PERDU") gains -= 10;
  });

  var todayStr = new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit"});
  var pickAuj  = picks.find(function(p){return p[5]==="EN ATTENTE"&&p[0]===todayStr;});
  var prochainPick = pickAuj || picks.slice().reverse().find(function(p){return p[5]==="EN ATTENTE";});
  var pickDuJour   = prochainPick || picks[0];
  var isNoPick     = !prochainPick && (picks[0][5]==="NOPICK"||picks[0][5]==="GAGNE"||picks[0][5]==="PERDU");
  var isEnAttente  = pickDuJour[5]==="EN ATTENTE";
  var isToday      = pickDuJour[0]===todayStr;
  var pickLabel    = isEnAttente?(isToday?"Pick du jour":"Prochain match"):isNoPick?"Pas de match":"Pick du jour";
  var pickScore    = pickDuJour[7]||0;

  var matchTeams   = (isNoPick ? "Spurs vs Knicks" : pickDuJour[1]).split(" vs ");
  var team1 = matchTeams[0]||"Spurs";
  var team2 = matchTeams[1]||"Knicks";

  var recentPicks = picks.filter(function(p){return p[5]!=="NOPICK"&&p[5]!=="ANNULE";}).slice(0,5);

  // ─── HEADER ───────────────────────────────────────────────────
  var header = React.createElement("header", {className:"site-header"},
    React.createElement("div", {className:"header-logo", onClick:function(){setPage("home");}},
      React.createElement("div", {className:"header-logo-icon"}, "⚡"),
      React.createElement("div", {style:{display:"flex",flexDirection:"column",lineHeight:1.15}},
        React.createElement("span", {className:"header-logo-name"}, "TousLesMatchs"),
        React.createElement("span", {className:"header-logo-sub"}, "Pick IA du jour")
      )
    ),
    React.createElement("nav", {className:"header-nav"},
      React.createElement("button", {className:"nav-btn"+(page==="home"?" active":""),onClick:function(){setPage("home");}},"Accueil"),
      React.createElement("button", {className:"nav-btn",onClick:function(){setPage("home");setTimeout(function(){var e=document.getElementById("pick-day");if(e)e.scrollIntoView({behavior:"smooth"});},100);}},"Pick du jour"),
      React.createElement("button", {className:"nav-btn",onClick:function(){setPage("home");setTimeout(function(){var e=document.getElementById("pricing");if(e)e.scrollIntoView({behavior:"smooth"});},100);}},"Offres"),
      React.createElement("button", {className:"nav-btn",onClick:function(){setPage("home");setTimeout(function(){var e=document.getElementById("results");if(e)e.scrollIntoView({behavior:"smooth"});},100);}},"Résultats"),
      React.createElement("button", {className:"nav-btn",onClick:function(){setPage("home");setTimeout(function(){var e=document.getElementById("faq");if(e)e.scrollIntoView({behavior:"smooth"});},100);}},"FAQ"),
      React.createElement("button", {className:"nav-btn"+(page==="preuves"?" active":""),onClick:function(){setPage("preuves");}},"Preuves"),
      React.createElement("button", {className:"nav-btn"+(page==="bookmakers"?" active":""),onClick:function(){setPage("bookmakers");}},"Bookmakers")
    ),
    React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}},
      ["fr","en","es","it","ru"].map(function(l){
        var flags={fr:"🇫🇷",en:"🇬🇧",es:"🇪🇸",it:"🇮🇹",ru:"🇷🇺"};
        return React.createElement("button",{
          key:l,title:l,onClick:function(){changeLang(l);},
          style:{background:lang===l?"rgba(74,222,128,0.1)":"transparent",border:"1px solid "+(lang===l?"rgba(74,222,128,0.25)":"rgba(255,255,255,0.07)"),borderRadius:"6px",padding:"4px 6px",cursor:"pointer",fontSize:"14px",lineHeight:"1"}
        },flags[l]);
      }),
      React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"btn-telegram"},"✈ Rejoindre Telegram")
    )
  );

  // ─── FOOTER ───────────────────────────────────────────────────
  var footer = React.createElement("footer",{className:"site-footer"},
    React.createElement("div",{className:"footer-inner"},
      React.createElement("div",{className:"footer-top"},
        React.createElement("div",null,
          React.createElement("div",{className:"footer-brand-name"},
            React.createElement("div",{className:"footer-brand-icon"},"⚡"), "TousLesMatchs"
          ),
          React.createElement("p",{className:"footer-brand-desc"},"Le bon pick. Tous les jours. Grâce à l'intelligence artificielle."),
          React.createElement("div",{className:"footer-socials"},
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"footer-social-btn"},"✈"),
            React.createElement("a",{href:TIKTOK_LINK,target:"_blank",className:"footer-social-btn"},"♪")
          )
        ),
        React.createElement("div",null,
          React.createElement("div",{className:"footer-col-title"},"Liens rapides"),
          React.createElement("ul",{className:"footer-links"},
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("home");}},"Accueil")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("preuves");}},"Preuves")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("bookmakers");}},"Bookmakers")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("calculateur");}},"Calculateur")),
            React.createElement("li",null,React.createElement("a",{href:TELEGRAM_LINK,target:"_blank"},"Telegram"))
          )
        ),
        React.createElement("div",null,
          React.createElement("div",{className:"footer-col-title"},"Informations"),
          React.createElement("ul",{className:"footer-links"},
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("cgu");}},"Conditions d'utilisation")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("confidentialite");}},"Politique de confidentialité")),
            React.createElement("li",null,React.createElement("button",{onClick:function(){setPage("mentions");}},"Mentions légales")),
            React.createElement("li",null,React.createElement("a",{href:"mailto:contact@touslesmatchs.com"},"Nous contacter"))
          )
        ),
        React.createElement("div",null,
          React.createElement("div",{className:"footer-col-title"},"Jeu responsable"),
          React.createElement("div",{className:"footer-resp-box"},
            React.createElement("div",{className:"footer-resp-title"},"⚠ 18+"),
            React.createElement("p",{className:"footer-resp-text"},"Les jeux d'argent sont interdits aux mineurs. Jouez de manière responsable.")
          )
        )
      ),
      React.createElement("div",{className:"footer-bottom"},
        React.createElement("span",{className:"footer-copy"},"© 2024 TousLesMatchs. Tous droits réservés."),
        React.createElement("span",{className:"footer-copy"},"JOUER COMPORTE DES RISQUES")
      )
    )
  );

  var bandeauLegal = React.createElement("div",{className:"legal-banner"},
    React.createElement("div",{className:"legal-text"},t("jeu_responsable")),
    React.createElement("div",{style:{fontSize:"9px",color:"rgba(255,255,255,0.06)",marginTop:"1px"}},t("risques_financiers"))
  );

  // ─── ROUTING ──────────────────────────────────────────────────
  if(page==="login") return React.createElement(Login,{setPage});
  if(page==="subscription") return React.createElement(Subscription,{setPage});
  if(page==="cgu") return React.createElement(CGU,{setPage,footer,bandeauLegal});
  if(page==="mentions") return React.createElement(MentionsLegales,{setPage,footer,bandeauLegal});
  if(page==="confidentialite") return React.createElement(Confidentialite,{setPage,footer,bandeauLegal});
  if(page==="analyse") return React.createElement(React.Fragment,null,header,React.createElement(AnalyseLive,null),footer,bandeauLegal);
  if(page==="calculateur") return React.createElement(Calculateur,{setPage,footer,bandeauLegal,header,picks});

  if(page==="preuves") return React.createElement("div",{style:{background:"#0A0A0A",minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:"#fff"}},
    header,
    React.createElement("div",{style:{maxWidth:"1000px",margin:"0 auto",padding:"48px 24px"}},
      React.createElement("div",{style:{marginBottom:"32px"}},
        React.createElement("div",{style:{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#4ADE80",fontWeight:"600",marginBottom:"10px"}},"PREUVES DE PERFORMANCE"),
        React.createElement("h2",{style:{fontSize:"clamp(28px,4vw,42px)",fontWeight:"800",letterSpacing:"-0.02em",marginBottom:"8px"}},t("preuves_title")),
        React.createElement("p",{style:{color:"rgba(255,255,255,0.55)",fontSize:"15px",lineHeight:"1.7"}},t("preuves_desc"))
      ),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"16px"}},
        preuves.map(function(p,i){
          return React.createElement("div",{key:i,style:{background:"#111",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"16px",overflow:"hidden"}},
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
    footer,bandeauLegal
  );

  if(page==="bookmakers") return React.createElement("div",{style:{background:"#0A0A0A",minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:"#fff"}},
    header,
    React.createElement("div",{style:{maxWidth:"900px",margin:"0 auto",padding:"48px 24px"}},
      React.createElement("div",{style:{marginBottom:"32px"}},
        React.createElement("div",{style:{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#4ADE80",fontWeight:"600",marginBottom:"10px"}},"NOS PARTENAIRES"),
        React.createElement("h2",{style:{fontSize:"clamp(28px,4vw,42px)",fontWeight:"800",letterSpacing:"-0.02em",marginBottom:"8px"}},t("bookmakers_title")),
        React.createElement("p",{style:{color:"rgba(255,255,255,0.55)",fontSize:"14px"}},t("bookmakers_desc"))
      ),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"12px"}},
        bookmakers.map(function(b,i){
          return React.createElement("div",{key:i,style:{background:"#111",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"14px",padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"16px"}},
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
    footer,bandeauLegal
  );

  // ════════════════════════════════════════════════════════════
  //  HOME
  // ════════════════════════════════════════════════════════════
  return React.createElement("div", {style:{background:"#0A0A0A",minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:"#fff",overflowX:"hidden"}},
    header,

    // ── HERO ────────────────────────────────────────────────
    React.createElement("section", {className:"hero"},
      React.createElement("div", {className:"hero-glow"}),
      React.createElement("div", {className:"hero-grid-lines"}),
      React.createElement("div", {className:"hero-inner"},

        React.createElement("div", {className:"hero-left"},
          React.createElement("div", {className:"hero-badge"},
            React.createElement("span", {className:"hero-badge-dot"}),
            winrate+"% de réussite moyenne"
          ),
          React.createElement("h1", {className:"hero-h1"},
            "LE PICK IA DU JOUR,", React.createElement("br",null),
            "SIMPLE, CLAIR,", React.createElement("br",null),
            React.createElement("span", {className:"green"}, "RENTABLE.")
          ),
          React.createElement("p", {className:"hero-desc"},
            "Chaque jour, notre intelligence artificielle analyse des milliers de données pour ne retenir qu'un seul pari à forte valeur ajoutée."
          ),
          React.createElement("div", {className:"hero-btns"},
            React.createElement("a", {href:"#pick-day", className:"btn-primary", onClick:function(e){e.preventDefault();var el=document.getElementById("pick-day");if(el)el.scrollIntoView({behavior:"smooth"});}},
              "VOIR LE PICK GRATUIT →"
            ),
            React.createElement("a", {href:"#pricing", className:"btn-secondary", onClick:function(e){e.preventDefault();var el=document.getElementById("pricing");if(el)el.scrollIntoView({behavior:"smooth"});}},
              "DÉCOUVRIR LES OFFRES ⚡"
            )
          ),
          React.createElement("div", {className:"hero-features"},
            React.createElement("div", {className:"hero-feature"},
              React.createElement("div", {className:"hero-feature-icon"},"✓"),
              React.createElement("div", {className:"hero-feature-text"},
                React.createElement("strong",null,"1 seul pick par jour"),
                React.createElement("span",null,"Qualité > Quantité")
              )
            ),
            React.createElement("div", {className:"hero-feature"},
              React.createElement("div", {className:"hero-feature-icon"},"🤖"),
              React.createElement("div", {className:"hero-feature-text"},
                React.createElement("strong",null,"Analyse IA avancée"),
                React.createElement("span",null,"Données en temps réel")
              )
            ),
            React.createElement("div", {className:"hero-feature"},
              React.createElement("div", {className:"hero-feature-icon"},"✈"),
              React.createElement("div", {className:"hero-feature-text"},
                React.createElement("strong",null,"Disponible sur Telegram"),
                React.createElement("span",null,"Rapide & pratique")
              )
            )
          )
        ),

        // Phone mockup réaliste
        React.createElement("div", {className:"hero-right"},
          React.createElement("div", {className:"phone-wrap"},
            React.createElement("div", {className:"phone-outer"},
              React.createElement("div", {className:"phone-btn-r"}),
              React.createElement("div", {className:"phone-btn-l1"}),
              React.createElement("div", {className:"phone-btn-l2"}),
              React.createElement("div", {className:"phone-inner"},
                // Status bar
                React.createElement("div", {className:"phone-status-bar"},
                  React.createElement("span", {className:"phone-time"}, "9:41"),
                  React.createElement("div", {className:"phone-pill"}),
                  React.createElement("span", {className:"phone-status-icons"}, "▮▮▮ WiFi 🔋")
                ),
                // App content
                React.createElement("div", {className:"phone-content"},
                  React.createElement("div", {className:"phone-app-header"},
                    React.createElement("div", {className:"phone-app-icon"}, "⚡"),
                    React.createElement("div", null,
                      React.createElement("div", {className:"phone-app-name"}, "3W – TousLesMatchs"),
                      React.createElement("div", {className:"phone-app-sub"}, "Canal officiel · Aujourd'hui")
                    )
                  ),
                  React.createElement("div", {className:"phone-pick-tag"}, "Pick IA du jour 🔥"),
                  React.createElement("div", {className:"phone-conf-row"},
                    React.createElement("span", {className:"phone-conf-label"}, "Confiance"),
                    React.createElement("span", {className:"phone-conf-val"}, pickScore.toFixed(1)+"/10")
                  ),
                  React.createElement("div", {className:"phone-teams-row"},
                    React.createElement("div", {className:"phone-team-block"},
                      React.createElement(ClubBadge, {name:team1, size:"small", showName:false}),
                      React.createElement("div", {className:"phone-team-name"}, team1)
                    ),
                    React.createElement("span", {className:"phone-vs-label"}, "VS"),
                    React.createElement("div", {className:"phone-team-block"},
                      React.createElement(ClubBadge, {name:team2, size:"small", showName:false}),
                      React.createElement("div", {className:"phone-team-name"}, team2)
                    )
                  ),
                  React.createElement("div", {className:"phone-bet-pill"},
                    React.createElement("div", {className:"phone-bet-name"}, pickDuJour[2]),
                    React.createElement("div", {className:"phone-bet-sub"}, sportEmoji(pickDuJour[6]).trim()+" · Cote : "+pickDuJour[3])
                  ),
                  React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"phone-cta-btn"}, "VOIR L'ANALYSE COMPLÈTE")
                ),
                React.createElement("div", {className:"phone-bottom-bar"},
                  React.createElement("div", {className:"phone-bottom-icon"}, "⚡"),
                  React.createElement("div", {className:"phone-bottom-text"},
                    React.createElement("div", {style:{fontWeight:"700",color:"#fff",fontSize:"11px"}}, "3W – TousLesMatchs"),
                    React.createElement("div", null, "Le bon pick. Tous les jours.")
                  )
                )
              )
            )
          )
        )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── NEURONE — 6 IA orbitent autour d'Hermès ─────────────
    React.createElement("section", {className:"neuron-section"},
      React.createElement("div", {className:"neuron-inner"},
        React.createElement("div", {className:"neuron-text"},
          React.createElement("div", {className:"neuron-eyebrow"}, "6 INTELLIGENCES ARTIFICIELLES · CONCILE V5"),
          React.createElement("h2", {className:"neuron-h2"},
            "Le meilleur ", React.createElement("span", {className:"green"}, "pick"),
            React.createElement("br",null), "chaque jour."
          ),
          React.createElement("p", {className:"neuron-desc"},
            "Groq, Gemini, DeepSeek, Mistral, Qwen et Claude analysent chaque matin des centaines de matchs en concert. Hermès Chief valide le consensus final."
          ),
          React.createElement("div", {className:"neuron-ai-chips"},
            [
              {name:"Groq",     color:"#4ADE80"},
              {name:"Gemini",   color:"#60A5FA"},
              {name:"DeepSeek", color:"#A78BFA"},
              {name:"Mistral",  color:"#34D399"},
              {name:"Qwen",     color:"#F97316"},
              {name:"Claude",   color:"#F472B6"},
            ].map(function(ai) {
              return React.createElement("span", {
                key:ai.name,
                className:"neuron-chip",
                style:{borderColor:ai.color+"40",color:ai.color}
              },
                React.createElement("span", {className:"neuron-chip-dot", style:{background:ai.color}}),
                ai.name
              );
            })
          )
        ),
        React.createElement("div", {className:"neuron-canvas-wrap"},
          React.createElement(NeuronOrbit, null)
        )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── PICK DU JOUR ─────────────────────────────────────────
    React.createElement("div", {className:"pick-day-section", id:"pick-day"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("div", {className:"section-header"},
          React.createElement("span", {className:"section-title"}, pickLabel.toUpperCase()),
          isEnAttente ? React.createElement("span", {className:"badge-gratuit"}, "GRATUIT") : null
        ),
        isNoPick
          ? React.createElement("div", {style:{background:"#111",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"20px",padding:"32px",textAlign:"center"}},
              React.createElement("div",{style:{fontSize:"32px",marginBottom:"8px"}},"🎯"),
              React.createElement("div",{style:{fontWeight:"700",color:"#fff",marginBottom:"4px"}},"Pas de pick aujourd'hui"),
              React.createElement("p",{style:{color:"rgba(255,255,255,0.4)",fontSize:"13px"}},"Aucun match ne satisfait nos critères. On ne force jamais un pari.")
            )
          : React.createElement("div", {className:"pick-day-card"},
              React.createElement("div", {className:"pick-teams-col"},
                React.createElement("div", {className:"pick-league-tag"}, sportEmoji(pickDuJour[6])+pickDuJour[0]),
                React.createElement("div", {className:"pick-teams-row"},
                  React.createElement(ClubBadge, {name:team1}),
                  React.createElement("span", {className:"pick-vs"}, "vs"),
                  React.createElement(ClubBadge, {name:team2})
                )
              ),
              React.createElement("div", {className:"pick-stats-col"},
                React.createElement("div", {className:"pick-stat-block"},
                  React.createElement("div", {className:"pick-stat-label"}, "PRONOSTIC"),
                  React.createElement("div", {className:"pick-stat-value", style:{fontSize:"16px",lineHeight:"1.3"}}, pickDuJour[2])
                ),
                React.createElement("div", {className:"pick-stat-block"},
                  React.createElement("div", {className:"pick-stat-label"}, "COTE"),
                  React.createElement("div", {className:"pick-stat-value"}, pickDuJour[3])
                ),
                React.createElement("div", {className:"pick-stat-block"},
                  React.createElement("div", {className:"pick-stat-label"}, "CONFIANCE"),
                  React.createElement("div", {className:"pick-stat-value green"}, pickScore.toFixed(1)+"/10"),
                  React.createElement("div", {className:"pick-conf-dots"},
                    [1,2,3,4,5,6,7].map(function(n){
                      return React.createElement("span",{key:n,className:"conf-dot"+(n<=Math.round(pickScore)?" filled":"")});
                    })
                  )
                )
              ),
              React.createElement("div", {className:"pick-right-col"},
                React.createElement("ul", {className:"pick-bullet-list"},
                  React.createElement("li",null,"Analyse de 35+ critères"),
                  React.createElement("li",null,"Stats en temps réel"),
                  React.createElement("li",null,"Forme, H2H, absences, météo...")
                ),
                React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"pick-tg-btn"}, "RECEVOIR SUR TELEGRAM ✈")
              )
            )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── COMMENT ÇA MARCHE ────────────────────────────────────
    React.createElement("section", {className:"how-section"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("h2", {className:"how-title"}, "COMMENT ÇA MARCHE ?"),
        React.createElement("div", {className:"how-grid"},
          [
            {icon:"🤖",title:"L'IA ANALYSE",desc:"Notre intelligence artificielle analyse des milliers de matchs et de données en temps réel.",n:"1"},
            {icon:"🎯",title:"LE MEILLEUR PICK",desc:"L'IA sélectionne le pari à plus forte valeur pour maximiser tes gains.",n:"2"},
            {icon:"✈",title:"TU REÇOIS LE PICK",desc:"Le pick est envoyé chaque jour sur Telegram, prêt à être joué.",n:"3"},
          ].map(function(s,i){
            return React.createElement("div",{key:i,className:"how-card"},
              React.createElement("span",{className:"how-step-num"},s.n),
              React.createElement("div",{className:"how-icon"},s.icon),
              React.createElement("div",{className:"how-card-title"},s.title),
              React.createElement("p",{className:"how-card-desc"},s.desc),
              i<2?React.createElement("span",{className:"how-arrow"},"›"):null
            );
          })
        )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── PRICING ──────────────────────────────────────────────
    React.createElement("section", {className:"pricing-section", id:"pricing"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("h2", {className:"pricing-title"}, "NOS OFFRES"),
        React.createElement("div", {className:"pricing-grid"},
          React.createElement("div", {className:"pricing-card"},
            React.createElement("div",{className:"pricing-tier"},"FREE"),
            React.createElement("div",{className:"pricing-price"},"0€"),
            React.createElement("div",{className:"pricing-period"},"/mois"),
            React.createElement("ul",{className:"pricing-features"},
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"1 pick gratuit par jour"),
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"Analyse IA basique"),
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"Envoi sur Telegram"),
              React.createElement("li",null,React.createElement("span",{className:"chk off"},"✗"),React.createElement("span",{style:{opacity:0.35}},"Picks premium"))
            ),
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"pricing-btn outline"},"COMMENCER GRATUITEMENT")
          ),
          React.createElement("div", {className:"pricing-card featured"},
            React.createElement("div",{className:"pricing-popular-badge"},"LE PLUS POPULAIRE"),
            React.createElement("div",{className:"pricing-tier"},"PREMIUM"),
            React.createElement("div",{className:"pricing-price"},"19,90€"),
            React.createElement("div",{className:"pricing-period"},"/mois"),
            React.createElement("ul",{className:"pricing-features"},
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"1 pick fort par jour"),
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"Analyse IA complète"),
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"Historique & statistiques"),
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"Support prioritaire")
            ),
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"pricing-btn green"},"PASSER PREMIUM ⚡")
          ),
          React.createElement("div", {className:"pricing-card"},
            React.createElement("div",{className:"pricing-tier"},"FULL ACCESS"),
            React.createElement("div",{className:"pricing-price"},"49,90€"),
            React.createElement("div",{className:"pricing-period"},"/mois"),
            React.createElement("ul",{className:"pricing-features"},
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"Tous les picks (foot + autres sports)"),
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"Alertes live & changements de cotes"),
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"Stats avancées & filtres"),
              React.createElement("li",null,React.createElement("span",{className:"chk"},"✓"),"Accès prioritaire")
            ),
            React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",className:"pricing-btn outline"},"PASSER FULL ACCESS")
          )
        )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── RÉSULTATS ────────────────────────────────────────────
    React.createElement("section", {className:"results-section", id:"results"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("div", {className:"results-grid"},
          React.createElement("div", {className:"results-stats-card"},
            React.createElement("div",{className:"results-card-title"},"NOS RÉSULTATS PARLENT"),
            React.createElement("div",{className:"results-big-stats"},
              React.createElement("div",{className:"results-stat"},
                React.createElement("div",{className:"results-stat-num"},winrate+"%"),
                React.createElement("div",{className:"results-stat-label"},"Taux de réussite",React.createElement("br",null),total+" paris analysés")
              ),
              React.createElement("div",{className:"results-stat"},
                React.createElement("div",{className:"results-stat-num"},"+"+(gains/10).toFixed(1)+"u"),
                React.createElement("div",{className:"results-stat-label"},"Bénéfice net",React.createElement("br",null),"depuis le début")
              ),
              React.createElement("div",{className:"results-stat"},
                React.createElement("div",{className:"results-stat-num"},wins),
                React.createElement("div",{className:"results-stat-label"},"GAGNÉS",React.createElement("br",null),losses+" perdus sur "+total)
              )
            )
          ),
          React.createElement("div", {className:"history-card"},
            React.createElement("div",{className:"history-title"},"HISTORIQUE DES 5 DERNIERS PICKS"),
            React.createElement("table",{className:"history-table"},
              React.createElement("tbody",null,
                recentPicks.map(function(p,i){
                  var sc=p[5]==="GAGNE"?"gagne":p[5]==="PERDU"?"perdu":p[5]==="EN ATTENTE"?"attente":"annule";
                  var sl=p[5]==="GAGNE"?"GAGNÉ ↑":p[5]==="PERDU"?"PERDU ↓":p[5]==="EN ATTENTE"?"EN COURS":p[5];
                  return React.createElement("tr",{key:i},
                    React.createElement("td",null,p[1]),
                    React.createElement("td",null,React.createElement("span",{className:"status-badge "+sc},sl)),
                    React.createElement("td",null,p[3])
                  );
                })
              )
            ),
            React.createElement("div",{className:"chart-area"},
              React.createElement("svg",{className:"chart-svg",viewBox:"0 0 300 60",preserveAspectRatio:"none"},
                (function(){
                  var pts=[]; var cum=30;
                  var plist=picks.filter(function(p){return p[5]==="GAGNE"||p[5]==="PERDU";}).slice(-10).reverse();
                  plist.forEach(function(p,i){
                    if(p[5]==="GAGNE") cum+=8; else cum-=10;
                    pts.push((i*(300/Math.max(plist.length-1,1)))+","+Math.max(4,Math.min(56,60-cum)));
                  });
                  return [
                    React.createElement("defs",{key:"d"},
                      React.createElement("linearGradient",{id:"gfill",x1:"0",y1:"0",x2:"0",y2:"1"},
                        React.createElement("stop",{offset:"0%",stopColor:"#4ADE80",stopOpacity:"0.2"}),
                        React.createElement("stop",{offset:"100%",stopColor:"#4ADE80",stopOpacity:"0"})
                      )
                    ),
                    React.createElement("polyline",{key:"line",points:pts.join(" "),fill:"none",stroke:"#4ADE80",strokeWidth:"2",strokeLinejoin:"round"}),
                  ];
                })()
              ),
              React.createElement("div",{className:"chart-label"},"+"+(gains/10).toFixed(1)+"u")
            )
          )
        )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── FAQ ──────────────────────────────────────────────────
    React.createElement("section",{className:"faq-section",id:"faq"},
      React.createElement("div",{className:"section-wrapper"},
        React.createElement("h2",{className:"faq-title"},"QUESTIONS FRÉQUENTES"),
        React.createElement("div",{className:"faq-grid"},
          faqs.map(function(f,i){
            var open=faqOpen===i;
            return React.createElement("div",{key:i,className:"faq-item"},
              React.createElement("button",{className:"faq-q",onClick:function(){setFaqOpen(open?null:i);}},
                f.q,
                React.createElement("span",{className:"faq-icon"+(open?" open":"")},"+")
              ),
              open?React.createElement("div",{className:"faq-a"},f.a):null
            );
          })
        )
      )
    ),

    footer,
    bandeauLegal
  );
}
