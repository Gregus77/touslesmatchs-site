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

var WINAMAX_LINK = "https://www.winamax.fr/parrain?code=77953728";
var BETCLIC_LINK = "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ";
var UNIBET_LINK = "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254";
var PMU_LINK = "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728";
var ZEBET_LINK = "https://www.zebet.fr/fr/inscription";
var PARIONSSPORT_LINK = "https://parionssport.lfdj.fr/fr-fr/inscription";
var NETBET_LINK = "https://www.netbet.fr/inscription";
var PINNACLE_LINK = "https://www.pinnacle.com/fr/sports/";
var TIKTOK_LINK = "https://www.tiktok.com/@touslesmatchs.com";
var TELEGRAM_LINK = "https://t.me/touslesmatchs_bot";

var picks = [
  ["11/06","PAS DE PARI - Aucun match disponible","---","---","---","NOPICK","",0,8],
  ["10/06","PAS DE PARI - Aucun match disponible","---","---","---","NOPICK","",0,8],
  ["09/06","PAS DE PARI - Aucun match disponible","---","---","---","NOPICK","",0,8],
  ["08/06","Philadelphia Phillies vs Chicago White Sox","Philadelphia Phillies ML","1.59","WIN","GAGNE","Baseball",8.5,8],
  ["07/06","PAS DE PARI - Aucun match disponible","---","---","---","NOPICK","",0,8],
  ["06/06","Switzerland vs Australia","Switzerland Vainqueur","1.6","1-1","PERDU","Foot",7,7],
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
  {q:"C'est vraiment gratuit ?", a:"Oui, 100% gratuit. Nous sommes rémunérés via les liens d'affiliation bookmakers. En vous inscrivant via nos liens, vous nous aidez à maintenir le service — merci."},
  {q:"Comment votre IA analyse les matchs ?", a:"Notre modèle Hermès croise la forme récente, les blessures, les confrontations directes, les stats domicile/extérieur et d'autres variables. Seuls les picks avec un score de confiance ≥ 7/10 sont publiés — jamais de match amical ou sans enjeu réel."},
  {q:"Combien de picks par jour ?", a:"Un seul pick par jour, maximum. Qualité plutôt que quantité. Les jours sans pick valable sont indiqués clairement : on ne force jamais un pari."},
  {q:"Quel bankroll est recommandé ?", a:"Ne misez jamais plus de 2 à 5% de votre bankroll total sur un seul pick. Les paris sportifs comportent des risques — jouez de façon responsable."},
  {q:"Qu'est-ce que le plan Premium ?", a:"Le plan Premium à 9,90€/mois donne accès au pick Premium du jour (seuil 7/10), aux picks des 3 prochains jours et au canal Telegram Premium privé. Le plan Premium Plus à 19,90€/mois ajoute un pick HORS-ARJEL sur Pinnacle avec des cotes supérieures."},
];

var bookmakers = [
  {nom:"Winamax", badge:"PARTENAIRE N1", bonus:"Bonus jusqu a 200 EUR", desc:"Le bookmaker francais numero 1. Cotes excellentes, interface top, retrait rapide.", color:"#e8b400", link:WINAMAX_LINK, note:"9.5/10"},
  {nom:"Betclic", badge:"TOP COTES", bonus:"Bonus bienvenue 100 EUR", desc:"Cotes tres competitives surtout sur le foot europeen. Appli mobile excellente.", color:"#00a651", link:BETCLIC_LINK, note:"9.2/10"},
  {nom:"Unibet", badge:"FIABLE", bonus:"Mise remboursee 100 EUR", desc:"Bookmaker international solide. Large choix de sports et de marches.", color:"#007832", link:UNIBET_LINK, note:"8.8/10"},
  {nom:"PMU", badge:"100% FRANCAIS", bonus:"Bonus 150 EUR", desc:"L historique des paris en France. Ideal pour le foot et les courses hippiques.", color:"#d4001a", link:PMU_LINK, note:"8.5/10"},
  {nom:"ZEbet", badge:"COTES ELEVEES", bonus:"Remboursement 100 EUR", desc:"Specialiste des cotes boostees. Souvent les meilleures cotes sur certains matchs.", color:"#ff6600", link:ZEBET_LINK, note:"8.3/10"},
  {nom:"ParionsSport", badge:"FDJ OFFICIEL", bonus:"Bonus 100 EUR", desc:"Le pari sportif officiel de la FDJ. Securite maximale, ideal pour les debutants.", color:"#005baa", link:PARIONSSPORT_LINK, note:"8.0/10"},
  {nom:"NetBet", badge:"BONNE VALEUR", bonus:"Bonus 100 EUR", desc:"Bon rapport qualite/cotes. Interface simple et claire. Programme de fidelite interessant.", color:"#c8102e", link:NETBET_LINK, note:"7.8/10"},
];

function sportEmoji(sport) {
  if(sport==="Foot") return "⚽ ";
  if(sport==="Hockey") return "🏒 ";
  if(sport==="Tennis") return "🎾 ";
  if(sport==="Basketball") return "🏀 ";
  if(sport==="Baseball") return "⚾ ";
  if(sport==="MLB") return "⚾ ";
  if(sport==="Volleyball") return "🏐 ";
  if(sport==="MLS") return "⚽🇺🇸 ";
  if(sport==="F1") return "🏎️ ";
  if(sport==="NFL") return "🏈 ";
  if(sport==="NBA") return "🏀 ";
  if(sport==="NHL") return "🏒 ";
  if(sport==="Rugby") return "🏉 ";
  if(sport==="MMA") return "🥊 ";
  return sport ? "🎯 " : "";
}

function getTrophies(note) {
  if (note >= 9.0) return { trophies: "★★★★★", label: "ELITE",   color: "#ffd700", bg: "rgba(255,215,0,0.1)",    border: "rgba(255,215,0,0.35)" };
  if (note >= 8.0) return { trophies: "★★★★",  label: "SOLIDE",  color: "#d4af37", bg: "rgba(212,175,55,0.1)",  border: "rgba(212,175,55,0.35)" };
  if (note >= 7.0) return { trophies: "★★★",   label: "JOUABLE", color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.35)" };
  return             { trophies: "★★",    label: "NO BET",  color: "#555",    bg: "rgba(100,100,100,0.06)", border: "rgba(100,100,100,0.2)" };
}

function getConfidence(note) {
  if (note >= 9.0) return { dot: "🟢", label: "Très élevée", color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)" };
  if (note >= 8.0) return { dot: "🟢", label: "Élevée", color: "#86efac", bg: "rgba(134,239,172,0.08)", border: "rgba(134,239,172,0.25)" };
  if (note >= 7.0) return { dot: "🟡", label: "Moyenne", color: "#fbbf24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)" };
  if (note >= 6.0) return { dot: "🟠", label: "Prudence", color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.3)" };
  return { dot: "🔴", label: "Risquée", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)" };
}

function getValueBet(note, coteStr) {
  var cote = parseFloat(coteStr);
  if (!cote || cote <= 1) return null;
  var impliedProb = 1 / cote;
  var aiProb = Math.min(0.95, (note / 10) * 0.78 + 0.1);
  var edge = aiProb - impliedProb;
  if (edge >= 0.10) return { label: "🟢 Forte Value", color: "#22c55e", edge: Math.round(edge * 100), desc: "Les bookmakers semblent sous-évaluer cette probabilité de façon significative." };
  if (edge >= 0.05) return { label: "🟡 Value Modérée", color: "#fbbf24", edge: Math.round(edge * 100), desc: "Notre IA détecte une légère sous-évaluation du bookmaker." };
  if (edge >= 0.0) return { label: "🔴 Faible Value", color: "#f97316", edge: Math.round(edge * 100), desc: "Pas de value significative détectée." };
  return { label: "⚫ Pas de Value", color: "#555", edge: 0, desc: "La cote reflète fidèlement la probabilité estimée." };
}

export default function App() {
  var pageState = React.useState("home");
  var page = pageState[0];
  var setPage = pageState[1];
  var filterState = React.useState("ALL");
  var filter = filterState[0];
  var setFilter = filterState[1];
  var faqOpenState = React.useState(null);
  var faqOpen = faqOpenState[0];
  var setFaqOpen = faqOpenState[1];
  var langState = React.useState(localStorage.getItem("lang") || "fr");
  var lang = langState[0];
  var setLang = langState[1];
  var emailInputState = React.useState("");
  var emailInput = emailInputState[0]; var setEmailInput = emailInputState[1];
  var emailDoneState = React.useState(false);
  var emailDone = emailDoneState[0]; var setEmailDone = emailDoneState[1];
  var emailLoadingState = React.useState(false);
  var emailLoading = emailLoadingState[0]; var setEmailLoading = emailLoadingState[1];

  function changeLang(newLang) {
    setLang(newLang);
    localStorage.setItem("lang", newLang);
  }

  function t(key) {
    return translations[lang]?.[key] || translations.fr[key] || key;
  }

  function handleEmailSubmit(e) {
    e.preventDefault();
    if (!emailInput || !emailInput.includes("@")) return;
    setEmailLoading(true);
    fetch("/api/subscribe", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({email:emailInput})
    })
    .then(function(r){ return r.json(); })
    .catch(function(){ return {success:true}; })
    .finally(function(){
      setEmailDone(true);
      setEmailLoading(false);
      if(window.gtag) window.gtag("event","email_capture",{email_domain:emailInput.split("@")[1]});
    });
  }

  React.useEffect(function() {
    if(window.gaLoaded) return;
    window.gaLoaded = true;
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=G-ME2T7G7PSK";
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", "G-ME2T7G7PSK");
  }, []);

  // ═══ COUNTDOWN TO NEXT PICK (11h59) ═══
  var cdState = React.useState(["--","--","--"]);
  var cdArr = cdState[0]; var setCdArr = cdState[1];
  React.useEffect(function(){
    function tick(){
      var now = new Date();
      var t = new Date(); t.setHours(11,59,0,0);
      if(now >= t) t.setDate(t.getDate()+1);
      var d = t - now;
      var h = Math.floor(d/3600000);
      var m = Math.floor((d%3600000)/60000);
      var s = Math.floor((d%60000)/1000);
      setCdArr([String(h).padStart(2,'0'), String(m).padStart(2,'0'), String(s).padStart(2,'0')]);
    }
    tick();
    var id = setInterval(tick, 1000);
    return function(){ clearInterval(id); };
  }, []);

  // ═══ ANIMATED STATS COUNTERS ═══
  var animState = React.useState({wr:0, roi:0, serie:0, rec:0, done:false});
  var anim = animState[0]; var setAnim = animState[1];
  React.useEffect(function(){
    var t0 = Date.now(), dur = 1600;
    var targets = {wr: winrate, roi: Math.abs(roiPct), serie: serieEnCours, rec: meilleureSerieHist};
    function step(){
      var t = Math.min(1, (Date.now()-t0)/dur);
      var e = 1 - Math.pow(1-t, 3);
      setAnim({
        wr:    Math.round(targets.wr*e),
        roi:   Math.round(targets.roi*e),
        serie: Math.round(targets.serie*e),
        rec:   Math.round(targets.rec*e),
        done:  t >= 1
      });
      if(t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, []);

  // ═══ DÉDUPLICATION : 1 seul pick par date ═══
  var seenMatches = {};
  picks = picks.filter(function(p){
    var key = p[0] + "|" + p[1]; // date + nom du match — évite doublons sans effacer matchs différents le même jour
    if (seenMatches[key]) return false;
    seenMatches[key] = true;
    return true;
  });

  var wins = picks.filter(function(p){return p[5]==="GAGNE";}).length;
  var _losses = picks.filter(function(p){return p[5]==="PERDU";}).length; void _losses;
  var total = picks.filter(function(p){return p[5]!=="NOPICK" && p[5]!=="EN COURS" && p[5]!=="EN ATTENTE";}).length;
  var winrate = total > 0 ? Math.round((wins/total)*100) : 0;

  // ═══ CALCUL ROI DYNAMIQUE (basé sur cotes réelles, mise fixe 10€) ═══
  var miseFixe = 10;
  var bankrollDepart = 100;
  var gainsCumules = 0;
  picks.forEach(function(p){
    if (p[5] === "GAGNE") {
      var cote = parseFloat(p[3]) || 1.5;
      gainsCumules += (cote - 1) * miseFixe;
    } else if (p[5] === "PERDU") {
      gainsCumules -= miseFixe;
    }
  });
  var roiPct = Math.round((gainsCumules / bankrollDepart) * 100);

  // ═══ SÉRIE DE VICTOIRES EN COURS ═══
  var serieEnCours = 0;
  for (var i = 0; i < picks.length; i++) {
    if (picks[i][5] === "GAGNE") serieEnCours++;
    else if (picks[i][5] === "PERDU") break;
  }

  // ═══ MEILLEURE SÉRIE HISTORIQUE ═══
  var meilleureSerieHist = 0;
  var serieTemp = 0;
  var picksRev = picks.slice().reverse();
  for (var j = 0; j < picksRev.length; j++) {
    if (picksRev[j][5] === "GAGNE") { serieTemp++; if (serieTemp > meilleureSerieHist) meilleureSerieHist = serieTemp; }
    else if (picksRev[j][5] === "PERDU") serieTemp = 0;
  }

  // Trouver le pick du JOUR en priorité (date d'aujourd'hui), puis le prochain à venir
  var todayStr = new Date().toLocaleDateString("fr-FR", {day:"2-digit", month:"2-digit"});
  var pickAujourdhui = picks.find(function(p){ return p[5]==="EN ATTENTE" && p[0]===todayStr; });
  // Si pas de pick aujourd'hui, prendre le plus proche dans le futur (ordre inversé = plus ancien en premier)
  var prochainPick = pickAujourdhui || picks.slice().reverse().find(function(p){ return p[5]==="EN ATTENTE"; });
  var pickDuJour = prochainPick || picks[0];
  var isNoPick = !prochainPick && (picks[0][5]==="NOPICK" || picks[0][5]==="GAGNE" || picks[0][5]==="PERDU");
  var _isEnCours = pickDuJour[5]==="EN COURS"; void _isEnCours;
  var isEnAttente = pickDuJour[5]==="EN ATTENTE";
  var isToday = pickDuJour[0] === todayStr;
  var pickLabel = isEnAttente ? (isToday ? t("pick_du_jour") : t("prochain_match")) : isNoPick ? t("pas_de_match") : t("pick_du_jour");

  // Threshold : index [8] = 8 (PREMIUM) ou 7 (STANDARD)
  var pickThreshold = pickDuJour[8] || 8;
  var pickAiScore   = pickDuJour[7] || 0;
  var isPremium     = pickThreshold >= 8;
  var isStandard7   = pickThreshold === 7;
  var isPickHorsARJEL = !isNoPick && (pickDuJour[9] === true);
  // Classification par note
  var pickTrophyData  = getTrophies(pickAiScore);
  var pickConfidence  = getConfidence(pickAiScore);
  var pickValueBet    = (!isNoPick && pickDuJour[3] !== "---") ? getValueBet(pickAiScore, pickDuJour[3]) : null;
  // Badge Elite/Solide/Jouable selon note
  var pickBadge = isNoPick ? "PAS DE MATCH" :
    pickAiScore >= 9.0 ? "PICK PREMIUM — ELITE" :
    pickAiScore >= 8.0 ? "PICK PREMIUM — SOLIDE" :
    pickAiScore >= 7.0 ? "PICK JOUABLE" : t("pick_standard");
  var pickBadgeColor = pickAiScore >= 9.0 ? "#ffd700" : pickAiScore >= 8.0 ? "#d4af37" : "#f59e0b";
  var pickBorderColor = pickAiScore >= 9.0 ? "rgba(255,215,0,0.35)" : isPremium ? "rgba(212,175,55,0.35)" : "rgba(245,158,11,0.5)";

  // ═══ DERNIER RÉSULTAT (affiché quand pas de pick en cours) ═══
  var dernierResultat = picks.find(function(p){ return p[5]==="GAGNE" || p[5]==="PERDU"; });
  var dernierROI = dernierResultat && dernierResultat[5]==="GAGNE" && parseFloat(dernierResultat[3]) > 1
    ? "+" + Math.round((parseFloat(dernierResultat[3]) - 1) * 100) + "% de rendement"
    : null;

  // ═══ DONNÉES TIERS PREMIUM ═══
  var lastPremiumJouable = picks.find(function(pk){ return pk[8]===7 && (pk[5]==="GAGNE"||pk[5]==="PERDU"); });
  var premiumJouableNow  = picks.find(function(pk){ return pk[8]===7 && !pk[9] && (pk[5]==="EN ATTENTE"||pk[5]==="EN COURS"); });
  var _t3 = new Date();
  var nextThreeDays = [0,1,2].map(function(di){
    var _dd = new Date(_t3); _dd.setDate(_t3.getDate()+di);
    var _ds = String(_dd.getDate()).padStart(2,'0')+"/"+String(_dd.getMonth()+1).padStart(2,'0');
    return picks.find(function(pk2){ return pk2[0]===_ds; }) || [_ds,"---","---","---","---","NOPICK","",0,8];
  });

  var filtered = filter === "ALL" ? picks : picks.filter(function(p){
    return p[5]==="NOPICK" || p[5]==="EN COURS" || p[5]==="EN ATTENTE" || p[6]===filter;
  });


  var bandeauLegal = React.createElement("div", {style:{position:"fixed",bottom:0,left:0,right:0,background:"#000",borderTop:"1px solid rgba(255,255,255,0.07)",padding:"7px 20px",textAlign:"center",zIndex:100}},
    React.createElement("div", {style:{fontSize:"10px",color:"#555",lineHeight:"1.8"}}, t("jeu_responsable")),
    React.createElement("div", {style:{fontSize:"9px",color:"#2d2d2d",marginTop:"1px"}}, t("risques_financiers"))
  );

  var footer = React.createElement("footer", {style:{borderTop:"1px solid rgba(212,175,55,0.1)",padding:"28px 30px 90px",textAlign:"center"}},
    React.createElement("div", {style:{fontSize:"12px",fontWeight:"bold",color:"#d4af37",letterSpacing:"3px",marginBottom:"14px"}}, t("touslesmatchs_com")),
    React.createElement("div", {style:{display:"flex",justifyContent:"center",gap:"20px",flexWrap:"wrap",marginBottom:"12px"}},
      React.createElement("button", {onClick:function(){setPage("cgu");}, style:{background:"transparent",border:"none",color:"#555",fontSize:"11px",cursor:"pointer",textDecoration:"underline",fontFamily:"Georgia,serif"}}, t("cgu")),
      React.createElement("button", {onClick:function(){setPage("mentions");}, style:{background:"transparent",border:"none",color:"#555",fontSize:"11px",cursor:"pointer",textDecoration:"underline",fontFamily:"Georgia,serif"}}, t("mentions_legales")),
      React.createElement("button", {onClick:function(){setPage("confidentialite");}, style:{background:"transparent",border:"none",color:"#555",fontSize:"11px",cursor:"pointer",textDecoration:"underline",fontFamily:"Georgia,serif"}}, t("confidentialite")),
      React.createElement("a", {href:TIKTOK_LINK,target:"_blank",style:{color:"#555",fontSize:"11px",textDecoration:"underline"}}, "TikTok"),
      React.createElement("a", {href:TELEGRAM_LINK,target:"_blank",style:{color:"#29b6f6",fontSize:"11px",textDecoration:"underline"}}, "Telegram")
    ),
    React.createElement("div", {style:{fontSize:"10px",color:"#2a2a2a"}}, t("footer_droits"))
  );

  var header = React.createElement("header", {style:{borderBottom:"1px solid rgba(212,175,55,0.2)",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(8,12,20,0.98)",position:"sticky",top:0,zIndex:50,flexWrap:"wrap",gap:"8px",maxWidth:"100%",overflowX:"hidden"}},
    React.createElement("div", {style:{cursor:"pointer"},onClick:function(){setPage("home");}},
      React.createElement("div", {style:{fontSize:"16px",fontWeight:"700",color:"#d4af37",letterSpacing:"0.12em",fontFamily:"'Bodoni Moda',serif",textTransform:"uppercase"}}, "TousLesMatchs"),
      React.createElement("div", {style:{fontSize:"8px",color:"#4a4438",letterSpacing:"0.22em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif"}}, t("analyse_sous_menu"))
    ),
    React.createElement("nav", {className:"main-nav",style:{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap",flex:1,justifyContent:"flex-end"}},
      ["home","preuves","bookmakers","calculateur","analyse"].map(function(p){
        var labels = {home:t("nav_choix"), preuves:t("nav_preuves"), bookmakers:t("nav_bookmakers"), calculateur:"💰 Calculateur", analyse:t("nav_analyse")};
        var isAnalyse = p==="analyse";
        var isCalc = p==="calculateur";
        return React.createElement("button", {key:p, onClick:function(){setPage(p);}, style:{background:page===p?(isAnalyse?"rgba(201,162,39,0.2)":"rgba(212,175,55,0.15)"):"transparent",border:"1px solid "+(page===p?"#d4af37":(isAnalyse||isCalc?"rgba(201,162,39,0.3)":"rgba(255,255,255,0.1)")),color:page===p?"#d4af37":(isAnalyse||isCalc?"#C9A227":"#666"),padding:"6px 14px",borderRadius:"4px",cursor:"pointer",fontSize:"12px",fontWeight:(isAnalyse||isCalc)?"600":"400"}}, labels[p]);
      }),
      React.createElement("a", {href:TIKTOK_LINK,target:"_blank",style:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"4px",padding:"6px 14px",color:"#fff",textDecoration:"none",fontSize:"12px"}}, "TikTok"),
      React.createElement("a", {href:TELEGRAM_LINK,target:"_blank",style:{background:"rgba(0,136,204,0.15)",border:"1px solid rgba(0,136,204,0.4)",borderRadius:"4px",padding:"6px 14px",color:"#29b6f6",textDecoration:"none",fontSize:"12px",fontWeight:"bold"}}, "Telegram"),
      React.createElement("div",{className:"lang-flags",style:{display:"flex",gap:"4px",marginLeft:"4px",alignItems:"center"}},
        [["fr","🇫🇷","FR"],["en","🇬🇧","EN"],["es","🇪🇸","ES"],["pt","🇵🇹","PT"],["ru","🇷🇺","RU"]].map(function(x){
          var active = lang===x[0];
          return React.createElement("button",{key:x[0],title:x[0],onClick:function(){changeLang(x[0]);},style:{
            background: active ? "rgba(212,175,55,0.18)" : "rgba(255,255,255,0.07)",
            border:"1px solid "+(active?"#d4af37":"rgba(255,255,255,0.22)"),
            borderRadius:"5px",padding:"4px 8px",cursor:"pointer",
            display:"flex",alignItems:"center",gap:"4px"
          }},
            React.createElement("span",{style:{fontSize:"15px",lineHeight:"1"}},x[1]),
            React.createElement("span",{style:{fontSize:"10px",fontWeight:"600",color:active?"#d4af37":"#999",fontFamily:"'Jost',sans-serif",letterSpacing:"0.05em"}},x[2])
          );
        })
      )
    )
  );


  if(page==="login") return React.createElement(React.Fragment, null, React.createElement(Login, {setPage:setPage}));
  if(page==="subscription") return React.createElement(React.Fragment, null, React.createElement(Subscription, {setPage:setPage}));
  if(page==="cgu") return React.createElement(React.Fragment, null, React.createElement(CGU, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal}));
  if(page==="mentions") return React.createElement(React.Fragment, null, React.createElement(MentionsLegales, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal}));
  if(page==="confidentialite") return React.createElement(React.Fragment, null, React.createElement(Confidentialite, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal}));
  if(page==="analyse") return React.createElement(React.Fragment, null, header, React.createElement(AnalyseLive, null), footer, bandeauLegal);
  if(page==="calculateur") return React.createElement(Calculateur, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal, header:header, picks:picks});

  if(page==="preuves"){
    return React.createElement("div", {style:{background:"linear-gradient(180deg,#131826 0%,#0b1018 500px,#080c14 100%)",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0"}},
      header,
      React.createElement("div", {style:{maxWidth:"900px",margin:"0 auto",padding:"40px 30px"}},
        React.createElement("h2", {style:{color:"#d4af37",letterSpacing:"3px",fontSize:"14px",marginBottom:"8px"}}, t("preuves_title")),
        React.createElement("p", {style:{color:"#555",fontSize:"13px",marginBottom:"30px"}}, t("preuves_desc")),
        React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"16px"}},
          preuves.map(function(p,i){
            return React.createElement("div", {key:i, style:{background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.15)",borderRadius:"10px",overflow:"hidden"}},
              React.createElement("img", {src:p.img,alt:p.match,loading:"lazy",onError:function(e){e.target.style.display="none";e.target.nextSibling.style.display="flex";},style:{width:"100%",height:"320px",objectFit:"contain",background:"rgba(0,0,0,0.4)",display:"block"}}),
              React.createElement("div", {style:{width:"100%",height:"320px",background:"rgba(212,175,55,0.03)",display:"none",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"8px"}},
                React.createElement("div", {style:{color:"#444",fontSize:"11px",letterSpacing:"2px"}}, t("capture_a_venir"))
              ),
              React.createElement("div", {style:{padding:"16px"}},
                React.createElement("div", {style:{fontSize:"11px",color:"#555",marginBottom:"4px"}}, p.date),
                React.createElement("div", {style:{fontSize:"14px",color:"#ddd",marginBottom:"8px"}}, p.match),
                React.createElement("div", {style:{fontSize:"18px",fontWeight:"bold",color:"#22cc44",marginBottom:"10px"}}, p.gain),
                React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"6px",background:"rgba(34,180,60,0.08)",border:"1px solid rgba(34,180,60,0.22)",borderRadius:"5px",padding:"5px 9px"}},
                  React.createElement("span", {style:{color:"#22cc44",fontSize:"11px",fontWeight:"bold"}}, "✅ Validé par le Concile"),
                  React.createElement("div", {style:{display:"flex",gap:"3px",marginLeft:"auto"}},
                    ["#22c55e","#3b82f6","#f59e0b","#a855f7","#ef4444","#d4af37"].map(function(c,j){
                      return React.createElement("span", {key:j, title:["Groq","Gemini","DeepSeek","Mistral","Qwen","Claude"][j], style:{width:"7px",height:"7px",borderRadius:"50%",background:c,display:"inline-block"}});
                    })
                  )
                )
              )
            );
          })
        ),
        React.createElement("div", {style:{marginTop:"40px",padding:"24px",background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.15)",borderRadius:"10px",textAlign:"center"}},
          React.createElement("p", {style:{color:"#555",fontSize:"13px",margin:"0 0 16px"}}, t("pariez_avec_nous")),
          React.createElement("a", {href:WINAMAX_LINK,target:"_blank",style:{display:"inline-block",background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"6px",padding:"12px 30px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"13px"}}, t("ouvrir_compte"))
        )
      ),
      footer,
      bandeauLegal
    );
  }

  if(page==="bookmakers"){
    return React.createElement("div", {style:{background:"linear-gradient(180deg,#131826 0%,#0b1018 500px,#080c14 100%)",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0"}},
      header,
      React.createElement("div", {style:{maxWidth:"860px",margin:"0 auto",padding:"40px 30px"}},
        React.createElement("h2", {style:{color:"#d4af37",letterSpacing:"3px",fontSize:"14px",marginBottom:"8px"}}, t("bookmakers_title")),
        React.createElement("p", {style:{color:"#555",fontSize:"13px",marginBottom:"6px"}}, t("bookmakers_desc")),
        React.createElement("p", {style:{color:"#444",fontSize:"11px",marginBottom:"30px"}}, t("bookmakers_note")),
        React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"12px"}},
          bookmakers.map(function(b,i){
            return React.createElement("div", {key:i, style:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"12px",padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"16px"}},
              React.createElement("div", {style:{flex:1,minWidth:"200px"}},
                React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px",flexWrap:"wrap"}},
                  React.createElement("span", {style:{fontSize:"18px",fontWeight:"bold",color:"#fff"}}, b.nom),
                  React.createElement("span", {style:{background:"rgba(212,175,55,0.12)",border:"1px solid rgba(212,175,55,0.25)",borderRadius:"3px",padding:"2px 7px",color:"#d4af37",fontSize:"9px",letterSpacing:"1px"}}, b.badge),
                  React.createElement("span", {style:{background:"rgba(34,180,60,0.1)",border:"1px solid rgba(34,180,60,0.2)",borderRadius:"3px",padding:"2px 7px",color:"#22cc44",fontSize:"9px"}}, b.bonus)
                ),
                React.createElement("p", {style:{color:"#555",fontSize:"12px",margin:"0 0 4px",maxWidth:"420px"}}, b.desc),
                React.createElement("span", {style:{color:"#d4af37",fontSize:"12px",fontWeight:"bold"}}, "Notre note: "+b.note)
              ),
              React.createElement("div", {style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px",flexShrink:0}},
                React.createElement("a", {href:b.link,target:"_blank",style:{background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"6px",padding:"11px 24px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"12px",whiteSpace:"nowrap"}}, t("sinscrire")),
                React.createElement("span", {style:{color:"#333",fontSize:"9px",letterSpacing:"1px"}}, t("lien_affilie"))
              )
            );
          })
        )
      ),
      footer,
      bandeauLegal
    );
  }

  return React.createElement("div", {style:{background:"linear-gradient(180deg,#0a0906 0%,#0b0d12 500px,#080c14 100%)",minHeight:"100vh",fontFamily:"'Jost',sans-serif",color:"#e8e0d0",overflowX:"hidden",width:"100%"}},
    header,
    React.createElement("section", {className:"hero-section",style:{padding:"60px 20px 40px",textAlign:"center"}},
      /* Badges 6 IAs */
      React.createElement("div",{style:{display:"flex",justifyContent:"center",marginBottom:"18px"}},
        React.createElement("div",{style:{
          display:"inline-flex",alignItems:"center",gap:"10px",
          background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",
          borderRadius:"20px",padding:"7px 18px"
        }},
          React.createElement("div",{style:{display:"flex",gap:"4px",alignItems:"center"}},
            ["#22c55e","#3b82f6","#f97316","#a855f7","#ef4444","#d4af37"].map(function(c,i){
              return React.createElement("div",{key:i,className:"dot-live",style:{
                width:"7px",height:"7px",borderRadius:"50%",background:c,flexShrink:0,
                animationDelay:(i*0.28)+"s"
              }});
            })
          ),
          React.createElement("span",{style:{fontSize:"12px",color:"#aaa",fontWeight:"600",letterSpacing:"0.08em"}},"6 modèles IA cross-vérifiés")
        )
      ),
      React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",marginBottom:"16px"}},
        React.createElement("span", {style:{fontSize:"13px",letterSpacing:"4px",color:"#d4af37",fontFamily:"'Jost',sans-serif",fontWeight:"600",textTransform:"uppercase"}}, t("section_5ia")),
        React.createElement("span", {style:{fontSize:"11px",color:"#555",letterSpacing:"1px"}}, "·"),
        React.createElement("span", {style:{fontSize:"13px",letterSpacing:"3px",color:"#b89a2a",fontFamily:"'Bodoni Moda',serif",fontStyle:"italic"}}, "Hermès Chief")
      ),
      React.createElement("h1", {style:{fontSize:"clamp(36px,5.5vw,64px)",fontWeight:"700",color:"#fff",margin:"0 0 16px",fontFamily:"'Bodoni Moda',serif",lineHeight:"1.08",letterSpacing:"-0.02em"}},
        lang==="fr" ? "Le meilleur " : lang==="en" ? "The best " : lang==="es" ? "La mejor " : lang==="pt" ? "A melhor " : "Лучший ",
        React.createElement("em", {style:{color:"#d4af37",fontStyle:"italic"}}, lang==="fr" ? "pick" : lang==="en" ? "pick" : lang==="es" ? "selección" : lang==="pt" ? "escolha" : "прогноз"),
        lang==="fr" ? " chaque jour." : lang==="en" ? " every day." : lang==="es" ? " cada día." : lang==="pt" ? " todos os dias." : " каждый день."
      ),
      React.createElement("p", {style:{color:"#6b6356",fontSize:"17px",maxWidth:"540px",margin:"0 auto 12px",lineHeight:"1.8",fontWeight:"300"}},
        t("hero_subtitle")
      ),
      React.createElement("p", {style:{color:"#4a4438",fontSize:"14px",maxWidth:"480px",margin:"0 auto 36px",lineHeight:"1.7",fontWeight:"400"}},
        t("seuil_minimum"), React.createElement("strong",{style:{color:"#d4af37"}},"8/10"), ". ", t("fallback"), React.createElement("strong",{style:{color:"#f59e0b"}},"7/10"), t("pour_garantir")
      ),
      React.createElement("div", {className:"stats-grid",style:{display:"grid",gridTemplateColumns:"1fr 1fr",maxWidth:"700px",width:"100%",margin:"0 auto",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"10px",overflow:"hidden"}},
        [
          {label:t("taux_reussite"), value: anim.wr+"%", sub:total+" paris analysés"},
          {label:t("bankroll"),      value: (roiPct>=0?"+":"")+anim.roi+"%", sub:"depuis le début"},
          {label:t("serie"),         value: null, rawSerie:true, sub:"victoires consécutives"},
          {label:"RECORD",           value: anim.rec, sub:"meilleure série", icon:"🏆"}
        ].map(function(s,i){
          var isFlash = anim.done;
          return React.createElement("div", {key:i, style:{padding:"22px 12px",borderRight:(i%2===0)?"1px solid rgba(212,175,55,0.15)":"none",borderBottom:i<2?"1px solid rgba(212,175,55,0.15)":"none",textAlign:"center"}},
            React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:"6px"}}, s.label),
            s.rawSerie
              ? React.createElement("div", {style:{fontSize:"24px",fontWeight:"bold",color:"#d4af37",display:"flex",alignItems:"center",justifyContent:"center",gap:"4px"}},
                  React.createElement("span", {className:isFlash?"shimmer-text":""}, anim.serie),
                  serieEnCours >= 3
                    ? React.createElement("span", {className:"streak-fire-anim",style:{fontSize:"20px"}}, "🔥")
                    : React.createElement("span", null, " 🔥")
                )
              : React.createElement("div", {style:{fontSize:"24px",fontWeight:"bold",color:"#d4af37",display:"flex",alignItems:"center",justifyContent:"center",gap:"4px"}},
                  React.createElement("span", {className:isFlash?"shimmer-text":""}, s.value),
                  s.icon ? React.createElement("span", {style:{fontSize:"18px"}}, " "+s.icon) : null
                ),
            React.createElement("div", {style:{fontSize:"11px",color:"#444",marginTop:"5px"}}, s.sub)
          );
        })
      ),
      /* ── Countdown to next pick ── */
      !isEnAttente && React.createElement("div", {style:{textAlign:"center",marginTop:"20px"}},
        React.createElement("div", {className:"countdown-box",style:{display:"inline-flex",alignItems:"center",gap:"6px"}},
          React.createElement("span", {style:{fontSize:"11px",letterSpacing:"3px",color:"#555",fontWeight:"600",marginRight:"6px",whiteSpace:"nowrap"}}, "PROCHAIN PICK"),
          React.createElement("div", {className:"countdown-unit"},
            React.createElement("div", {className:"countdown-num"}, cdArr[0]),
            React.createElement("div", {className:"countdown-lbl"}, "H")
          ),
          React.createElement("span", {className:"countdown-colon"}, ":"),
          React.createElement("div", {className:"countdown-unit"},
            React.createElement("div", {className:"countdown-num"}, cdArr[1]),
            React.createElement("div", {className:"countdown-lbl"}, "MIN")
          ),
          React.createElement("span", {className:"countdown-colon"}, ":"),
          React.createElement("div", {className:"countdown-unit"},
            React.createElement("div", {className:"countdown-num"}, cdArr[2]),
            React.createElement("div", {className:"countdown-lbl"}, "SEC")
          )
        )
      )
    ),
    /* ── Résultats récents — ticker horizontal ── */
    React.createElement("div", {style:{
      borderTop:"1px solid rgba(255,255,255,0.04)",
      borderBottom:"1px solid rgba(255,255,255,0.04)",
      padding:"10px 0", marginBottom:"0",
      background:"rgba(255,255,255,0.012)"
    }},
      React.createElement("div", {className:"ticker-wrap"},
        React.createElement("div", {className:"ticker-track"},
          picks.filter(function(p){return p[5]==="GAGNE";}).slice(0,8).concat(
            picks.filter(function(p){return p[5]==="GAGNE";}).slice(0,8)
          ).map(function(p,i){
            return React.createElement("div", {key:i, className:"ticker-item"},
              React.createElement("span", {style:{fontSize:"13px"}},(p[6]?sportEmoji(p[6]):"⚽")),
              React.createElement("span", {style:{color:"rgba(255,255,255,0.55)"}}, p[1]),
              React.createElement("span", {style:{fontWeight:"700",color:"#d4af37"}}, p[3]),
              React.createElement("span", {className: p[5]==="GAGNE"?"ticker-win":"ticker-loss", style:{fontWeight:"700",fontSize:"11px",letterSpacing:"1px"}},
                p[5]==="GAGNE" ? "✓ GAGNÉ" : "✗ PERDU"
              )
            );
          })
        )
      )
    ),
    // ════ PICK DU JOUR — au-dessus de la ligne de flottaison ════
    React.createElement("section", {className:"home-section",style:{padding:"16px 20px 32px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},

      /* ── CAS 1 : Pas de pick en attente → afficher le dernier résultat ── */
      isNoPick && dernierResultat ? React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"12px"}},

        /* Carte résultat */
        React.createElement("div", {style:{
          background: dernierResultat[5]==="GAGNE" ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
          border: "1px solid " + (dernierResultat[5]==="GAGNE" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"),
          borderRadius:"14px", overflow:"hidden"
        }},
          /* Bandeau coloré haut */
          React.createElement("div", {style:{
            height:"3px",
            background: dernierResultat[5]==="GAGNE"
              ? "linear-gradient(90deg,transparent,#22c55e,transparent)"
              : "linear-gradient(90deg,transparent,#ef4444,transparent)"
          }}),
          React.createElement("div", {style:{padding:"22px 24px"}},
            /* Header DERNIER RÉSULTAT */
            React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px",flexWrap:"wrap",gap:"8px"}},
              React.createElement("div", {style:{fontSize:"10px",letterSpacing:"3px",color:"#555",fontWeight:"600"}}, "DERNIER RÉSULTAT"),
              React.createElement("div", {style:{
                display:"inline-flex",alignItems:"center",gap:"6px",
                background: dernierResultat[5]==="GAGNE" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                border: "1px solid " + (dernierResultat[5]==="GAGNE" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"),
                borderRadius:"6px", padding:"5px 14px"
              }},
                React.createElement("span", {style:{fontSize:"14px"}}), dernierResultat[5]==="GAGNE" ? "✅" : "❌",
                React.createElement("span", {style:{
                  fontSize:"13px", fontWeight:"700", letterSpacing:"2px",
                  color: dernierResultat[5]==="GAGNE" ? "#22c55e" : "#ef4444"
                }}, dernierResultat[5])
              )
            ),
            /* Match */
            React.createElement("div", {style:{fontSize:"18px",fontWeight:"700",color:"#fff",marginBottom:"8px",fontFamily:"'Bodoni Moda',serif",lineHeight:"1.3"}},
              dernierResultat[6] ? sportEmoji(dernierResultat[6]) : "", dernierResultat[1]
            ),
            /* Pari + Cote + Score */
            React.createElement("div", {style:{display:"flex",gap:"12px",flexWrap:"wrap",marginBottom:"12px"}},
              React.createElement("span", {style:{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"5px",padding:"4px 10px",color:"#ccc",fontSize:"12px"}}, dernierResultat[2]),
              React.createElement("span", {style:{color:"#d4af37",fontWeight:"700",fontSize:"14px",alignSelf:"center"}}, "Cote: "+dernierResultat[3]),
              dernierResultat[4] && dernierResultat[4]!=="---" && dernierResultat[4]!=="—" && React.createElement("span", {style:{color:"#888",fontSize:"13px",alignSelf:"center"}}, "Score: "+dernierResultat[4])
            ),
            /* Gain + note */
            React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}},
              dernierROI && React.createElement("div", {style:{
                fontSize:"17px",fontWeight:"700",color:"#22c55e",fontFamily:"'Bodoni Moda',serif"
              }}, dernierROI),
              dernierResultat[7] > 0 && React.createElement("div", {style:{
                display:"inline-flex",alignItems:"center",gap:"5px",
                background: getTrophies(dernierResultat[7]).bg,
                border: "1px solid " + getTrophies(dernierResultat[7]).border,
                borderRadius:"4px",padding:"3px 9px"
              }},
                React.createElement("span",{style:{fontSize:"12px",color:getTrophies(dernierResultat[7]).color,fontWeight:"700"}}, getTrophies(dernierResultat[7]).trophies),
                React.createElement("span",{style:{fontSize:"9px",color:getTrophies(dernierResultat[7]).color,letterSpacing:"2px",fontWeight:"700"}}, getTrophies(dernierResultat[7]).label)
              ),
              React.createElement("span",{style:{fontSize:"11px",color:"#555"}}, dernierResultat[0])
            )
          )
        ),

        /* Section prochain pick */
        React.createElement("div", {style:{
          background:"rgba(255,255,255,0.02)",
          border:"1px dashed rgba(255,255,255,0.1)",
          borderRadius:"12px", padding:"18px 20px",
          display:"flex", alignItems:"center", gap:"14px"
        }},
          React.createElement("div", {style:{
            width:"36px",height:"36px",borderRadius:"50%",
            background:"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.2)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",flexShrink:0
          }}, "⏰"),
          React.createElement("div", null,
            React.createElement("div",{style:{fontSize:"11px",letterSpacing:"3px",color:"#555",marginBottom:"4px",fontWeight:"600"}}, "PROCHAIN PICK"),
            React.createElement("div",{style:{fontSize:"13px",color:"#888",lineHeight:"1.6"}},
              "Hermès analyse les matchs chaque matin à 12h00. Le prochain pick sera publié ici dès qu'il atteint le seuil de confiance."
            )
          )
        )

      /* ── CAS 2 : Pick en attente → afficher normalement ── */
      ) : React.createElement("div", {
        className: isEnAttente ? "pick-active" : "",
        style:{
          background: isNoPick ? "rgba(100,100,100,0.06)" : isStandard7 ? "rgba(245,158,11,0.05)" : "rgba(212,175,55,0.06)",
          border: "1px solid " + (isNoPick ? "rgba(100,100,100,0.25)" : pickBorderColor),
          borderRadius:"14px", padding:"28px 26px", position:"relative", overflow:"hidden"
        }
      },
        /* Bandeau coloré en haut de la carte selon le niveau */
        !isNoPick && React.createElement("div", {style:{
          position:"absolute", top:0, left:0, right:0, height:"3px",
          background: isPremium
            ? "linear-gradient(90deg,transparent,#d4af37,transparent)"
            : "linear-gradient(90deg,transparent,#f59e0b,transparent)"
        }}),

        /* Badge Elite/Solide/Jouable + Trophées */
        !isNoPick && React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}},
          React.createElement("div", {style:{
            display:"inline-flex", alignItems:"center", gap:"6px",
            background: pickAiScore >= 9.0 ? "rgba(255,215,0,0.12)" : isPremium ? "rgba(212,175,55,0.12)" : "rgba(245,158,11,0.15)",
            border: "1px solid " + (pickAiScore >= 9.0 ? "rgba(255,215,0,0.5)" : isPremium ? "rgba(212,175,55,0.4)" : "rgba(245,158,11,0.5)"),
            borderRadius:"4px", padding:"4px 12px",
            fontSize:"10px", fontWeight:"bold", letterSpacing:"2px",
            color: pickBadgeColor
          }}, pickBadge),
          React.createElement("div", {style:{
            display:"inline-flex", alignItems:"center", gap:"5px",
            background: pickTrophyData.bg, border: "1px solid " + pickTrophyData.border,
            borderRadius:"4px", padding:"3px 9px"
          }},
            React.createElement("span",{style:{fontSize:"13px",color:pickTrophyData.color,fontWeight:"700",letterSpacing:"0.5px",lineHeight:"1"}}, pickTrophyData.trophies),
            React.createElement("span",{style:{fontSize:"9px",color:pickTrophyData.color,letterSpacing:"2px",fontWeight:"700"}}, pickTrophyData.label)
          ),
          pickValueBet && pickValueBet.edge >= 5 && React.createElement("div", {style:{
            display:"inline-flex",alignItems:"center",gap:"4px",
            background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.35)",
            borderRadius:"4px",padding:"4px 10px",fontSize:"9px",fontWeight:"bold",letterSpacing:"1px",color:"#22c55e"
          }}, "VALUE BET"),
          isPickHorsARJEL && React.createElement("div", {style:{
            display:"inline-flex",alignItems:"center",gap:"4px",
            background:"rgba(249,115,22,0.12)",border:"1px solid rgba(249,115,22,0.5)",
            borderRadius:"4px",padding:"4px 10px",fontSize:"9px",fontWeight:"bold",letterSpacing:"1px",color:"#f97316"
          }}, "⚠️ HORS ANJ")
        ),

        /* Label */
        React.createElement("div", {style:{fontSize:"10px",letterSpacing:"4px",color:isNoPick?"#555":isEnAttente?"#ffa500":pickBadgeColor,marginBottom:"10px"}}, pickLabel),

        /* Match */
        React.createElement("div", {style:{fontSize:"20px",fontWeight:"bold",color:isNoPick?"#555":"#fff",marginBottom:"12px",fontStyle:isNoPick?"italic":"normal",lineHeight:"1.3"}},
          isNoPick
            ? t("no_match_today")
            : (!isNoPick && pickDuJour[6]) ? sportEmoji(pickDuJour[6])+pickDuJour[1] : pickDuJour[1]
        ),

        /* Marché + Cote */
        isNoPick ? null : React.createElement("div", {style:{display:"flex",gap:"12px",alignItems:"center",flexWrap:"wrap",marginBottom:"20px"}},
          React.createElement("span", {style:{background:"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:"6px",padding:"7px 16px",color:"#d4af37",fontSize:"13px",fontWeight:"600",letterSpacing:"0.04em"}}, pickDuJour[2]),
          React.createElement("span", {style:{color:"#fff",fontWeight:"700",fontSize:"20px",fontFamily:"'Bodoni Moda',serif"}}, "Cote: "+pickDuJour[3])
        ),

        /* Panel Concile V5 — votes des 6 IAs */
        isNoPick ? null : React.createElement("div", {style:{
          background:"rgba(255,255,255,0.03)",
          border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:"10px", padding:"16px 18px", marginBottom:"18px"
        }},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"3px",color:"#555",marginBottom:"14px",fontWeight:"600"}}, t("concile_title")),
          /* Badges 6 IAs — cachés sur mobile via CSS */
          React.createElement("div", {className:"concile-badges-full",style:{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center",marginBottom:"12px"}},
            [
              {nom:"Groq",   color:"#22c55e", role:"Scanner"},
              {nom:"Gemini", color:"#3b82f6", role:"H2H"},
              {nom:"DeepSeek",color:"#f97316",role:"Forme"},
              {nom:"Mistral",color:"#a855f7", role:"Contexte"},
              {nom:"Qwen",   color:"#ef4444", role:"Value"},
              {nom:"Claude", color:"#d4af37", role:"Chef ★"},
            ].map(function(ia, i){
              return React.createElement("div", {key:i, style:{
                display:"flex", alignItems:"center", gap:"5px",
                background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:"5px", padding:"5px 10px"
              }},
                React.createElement("div", {
                  className:"dot-live",
                  style:{width:"6px",height:"6px",borderRadius:"50%",background:ia.color,flexShrink:0,
                    animationDelay:(i*0.33)+"s"}
                }),
                React.createElement("span", {style:{fontSize:"13px",color:"#ccc",fontWeight:"600"}}, ia.nom),
                React.createElement("span", {style:{fontSize:"11px",color:"#555",marginLeft:"3px"}}, ia.role),
                React.createElement("span", {style:{fontSize:"13px",color:"#22c55e",marginLeft:"5px",fontWeight:"700"}}, "GO")
              );
            })
          ),
          /* Version compacte mobile : dots colorés uniquement */
          React.createElement("div", {className:"concile-compact",style:{display:"none",alignItems:"center",gap:"6px",marginBottom:"12px",flexWrap:"wrap"}},
            React.createElement("span",{style:{fontSize:"10px",color:"#555",letterSpacing:"1px"}},"6 IA :"),
            [
              {nom:"Groq",color:"#22c55e"},{nom:"Gemini",color:"#3b82f6"},
              {nom:"DeepSeek",color:"#f97316"},{nom:"Mistral",color:"#a855f7"},
              {nom:"Qwen",color:"#ef4444"},{nom:"Claude",color:"#d4af37"}
            ].map(function(ia,i){
              return React.createElement("div",{key:i,style:{display:"inline-flex",alignItems:"center",gap:"4px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"20px",padding:"3px 9px"}},
                React.createElement("div",{style:{width:"5px",height:"5px",borderRadius:"50%",background:ia.color}}),
                React.createElement("span",{style:{fontSize:"10px",color:"#888",fontWeight:"600"}},"GO")
              );
            })
          ),
          /* Barre de confiance */
          pickAiScore > 0 && React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px"}},
            React.createElement("span", {style:{fontSize:"10px",color:"#555",letterSpacing:"1px",whiteSpace:"nowrap"}}, t("confiance_ia")),
            React.createElement("div", {style:{flex:1,height:"5px",background:"rgba(255,255,255,0.06)",borderRadius:"3px",overflow:"hidden",maxWidth:"200px"}},
              React.createElement("div", {style:{
                height:"100%", borderRadius:"3px",
                width: (pickAiScore / 10 * 100)+"%",
                background: pickAiScore >= 9.0 ? "linear-gradient(90deg,#b8860b,#ffd700)" : isPremium
                  ? "linear-gradient(90deg,#9b7a10,#d4af37)"
                  : "linear-gradient(90deg,#92400e,#f59e0b)"
              }})
            ),
            React.createElement("span", {style:{fontSize:"13px",fontWeight:"700",color:pickBadgeColor}}, pickAiScore+"/10")
          ),
          /* Indice de Confiance Hermès */
          pickAiScore > 0 && React.createElement("div", {style:{
            display:"flex",alignItems:"center",gap:"8px",
            background:pickConfidence.bg, border:"1px solid "+pickConfidence.border,
            borderRadius:"6px",padding:"8px 12px"
          }},
            React.createElement("span", {style:{fontSize:"14px"}}), pickConfidence.dot,
            React.createElement("span", {style:{fontSize:"10px",color:"#555",letterSpacing:"1px"}}, "INDICE HERMÈS :"),
            React.createElement("span", {style:{fontSize:"12px",fontWeight:"bold",color:pickConfidence.color}}, pickConfidence.label),
            React.createElement("span", {style:{fontSize:"10px",color:pickBadgeColor,marginLeft:"auto",fontWeight:"700"}}, pickTrophyData.label)
          )
        ),

        /* Value Bet Section — affichée seulement si forte ou modérée value */
        pickValueBet && !isNoPick && pickValueBet.edge >= 5 && React.createElement("div", {style:{
          background:"rgba(34,197,94,0.04)",
          border:"1px solid rgba(34,197,94,0.2)",
          borderRadius:"10px",padding:"14px 16px",marginBottom:"18px"
        }},
          React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}},
            React.createElement("span", {style:{fontSize:"12px",fontWeight:"bold",color:pickValueBet.color,letterSpacing:"1px"}}, pickValueBet.label),
            pickValueBet.edge > 0 && React.createElement("span", {style:{fontSize:"11px",color:"#555"}}, "(edge: +"+pickValueBet.edge+"%)")
          ),
          React.createElement("div", {style:{fontSize:"12px",color:"#666",lineHeight:"1.6"}}, pickValueBet.desc)
        ),

        /* Avertissement 7/10 */
        isStandard7 && !isNoPick && React.createElement("div", {style:{
          background:"rgba(245,158,11,0.08)",
          border:"1px solid rgba(245,158,11,0.25)",
          borderRadius:"8px", padding:"12px 16px", marginBottom:"18px"
        }},
          React.createElement("div", {style:{fontSize:"12px",color:"#f59e0b",fontWeight:"bold",marginBottom:"4px"}}, t("seuil_abaisse")),
          React.createElement("div", {style:{fontSize:"12px",color:"#888",lineHeight:"1.65"}},
            t("seuil_abaisse_desc")
          )
        ),

        /* Urgence : pick valable aujourd'hui seulement */
        isEnAttente && !isNoPick && React.createElement("div", {style:{
          display:"flex",alignItems:"center",gap:"10px",marginBottom:"18px",
          background:"rgba(255,80,80,0.07)",border:"1px solid rgba(255,80,80,0.2)",
          borderRadius:"8px",padding:"10px 16px"
        }},
          React.createElement("div", {style:{width:"8px",height:"8px",borderRadius:"50%",background:"#ff5555",flexShrink:0,boxShadow:"0 0 6px #ff5555"}}),
          React.createElement("span", {style:{fontSize:"12px",color:"#ff8888",fontWeight:"bold",letterSpacing:"0.05em"}}, "⏰ Pick valable aujourd'hui seulement — expire à minuit")
        ),

        /* Warning HORS ANJ */
        isPickHorsARJEL && React.createElement("div", {style:{
          background:"rgba(249,115,22,0.07)",
          border:"1px solid rgba(249,115,22,0.3)",
          borderRadius:"10px", padding:"14px 16px", marginBottom:"16px"
        }},
          React.createElement("div", {style:{fontSize:"12px",color:"#f97316",fontWeight:"bold",marginBottom:"5px"}}, "⚠️ Match non disponible sur les bookmakers ANJ"),
          React.createElement("div", {style:{fontSize:"12px",color:"#888",lineHeight:"1.65"}},
            "Ce pick n'est pas disponible sur Winamax, Betclic ou PMU. Il est jouable sur Pinnacle ou PS3838 (bookmakers offshore, hors réglementation ANJ française)."
          )
        ),

        /* CTA */
        isNoPick ? null : React.createElement("a", {
          href: isPickHorsARJEL ? PINNACLE_LINK : WINAMAX_LINK,
          target:"_blank",
          className:"pick-cta",
          style:{
            display:"flex", alignItems:"center", justifyContent:"center", gap:"10px",
            background: isPickHorsARJEL
              ? "linear-gradient(135deg,#f97316,#fb923c)"
              : isPremium ? "linear-gradient(135deg,#d4af37,#f5d76e)" : "linear-gradient(135deg,#f59e0b,#fbbf24)",
            borderRadius:"12px", padding:"18px 28px",
            color:"#080c14", fontWeight:"bold", textDecoration:"none", fontSize:"15px",
            letterSpacing:"0.06em", textTransform:"uppercase",
            width:"100%", boxSizing:"border-box",
            transition:"opacity 0.2s, transform 0.2s",
            minHeight:"56px"
          }
        }, isPickHorsARJEL ? "🎯 Parier sur Pinnacle →" : t("parier_winamax"))
      )
    ),
    /* ══════════════════════════════════════════════
       PICKS PREMIUM — TEASERS VERROUILLÉS (FOMO)
       ══════════════════════════════════════════════ */
    React.createElement("section", {className:"home-section",style:{padding:"4px 20px 24px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},

      /* Header section */
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"12px",marginBottom:"14px"}},
        React.createElement("div",{style:{fontSize:"10px",letterSpacing:"3px",color:"#555",fontWeight:"600"}},"ACCÈS PREMIUM"),
        React.createElement("div",{style:{flex:1,height:"1px",background:"linear-gradient(90deg,rgba(212,175,55,0.18),transparent)"}})
      ),

      /* ── PREMIUM 9,90€ — pick 7/10 JOUABLE ── */
      React.createElement("div",{style:{position:"relative",marginBottom:"10px",borderRadius:"14px",overflow:"hidden"}},
        /* Blurred preview */
        React.createElement("div",{style:{
          filter:"blur(5px)",userSelect:"none",pointerEvents:"none",
          background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.25)",
          borderRadius:"14px",padding:"20px 22px"
        }},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px",flexWrap:"wrap"}},
            React.createElement("div",{style:{display:"inline-flex",background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.4)",borderRadius:"4px",padding:"4px 12px",fontSize:"10px",fontWeight:"bold",letterSpacing:"2px",color:"#f59e0b"}},"PICK PREMIUM — 7/10 JOUABLE"),
            React.createElement("div",{style:{display:"inline-flex",alignItems:"center",gap:"5px",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:"4px",padding:"3px 9px"}},
              React.createElement("span",{style:{fontSize:"11px",color:"#f59e0b",fontWeight:"700"}},"★★★"),
              React.createElement("span",{style:{fontSize:"9px",color:"#f59e0b",letterSpacing:"2px",fontWeight:"700"}},"JOUABLE")
            )
          ),
          React.createElement("div",{style:{fontSize:"17px",fontWeight:"700",color:"#fff",marginBottom:"8px",fontFamily:"'Bodoni Moda',serif"}},
            premiumJouableNow ? sportEmoji(premiumJouableNow[6])+premiumJouableNow[1]
            : lastPremiumJouable ? sportEmoji(lastPremiumJouable[6])+lastPremiumJouable[1]
            : "⚽ Match sélectionné par Hermès"
          ),
          React.createElement("div",{style:{display:"flex",gap:"12px",alignItems:"center"}},
            React.createElement("span",{style:{background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:"6px",padding:"6px 14px",color:"#f59e0b",fontSize:"13px",fontWeight:"600"}},
              premiumJouableNow ? premiumJouableNow[2] : lastPremiumJouable ? lastPremiumJouable[2] : "Pari analysé"
            ),
            React.createElement("span",{style:{color:"#fff",fontWeight:"700",fontSize:"18px",fontFamily:"'Bodoni Moda',serif"}},
              "Cote: "+(premiumJouableNow ? premiumJouableNow[3] : lastPremiumJouable ? lastPremiumJouable[3] : "x.xx")
            )
          )
        ),
        /* Lock overlay */
        React.createElement("div",{style:{
          position:"absolute",inset:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:"8px",
          background:"rgba(8,7,6,0.75)",backdropFilter:"blur(3px)",
          borderRadius:"14px",border:"1px solid rgba(245,158,11,0.22)"
        }},
          React.createElement("span",{style:{fontSize:"20px"}},"🔒"),
          React.createElement("div",{style:{fontSize:"12px",color:"#f59e0b",letterSpacing:"2px",fontWeight:"700",textAlign:"center"}},"PICK 9,90€/mois"),
          React.createElement("div",{style:{fontSize:"11px",color:"#666",textAlign:"center",maxWidth:"200px",lineHeight:"1.7"}},"Seuil 7/10 JOUABLE — disponible aujourd'hui sur ARJEL"),
          React.createElement("button",{
            onClick:function(){setPage("subscription");if(window.gtag)window.gtag("event","click_premium_teaser",{tier:"premium"});},
            style:{marginTop:"2px",background:"rgba(245,158,11,0.12)",border:"1px solid rgba(245,158,11,0.55)",borderRadius:"8px",padding:"9px 22px",color:"#f59e0b",fontWeight:"700",cursor:"pointer",fontSize:"12px",letterSpacing:"1px"}
          },"⭐ DÉBLOQUER PREMIUM")
        )
      ),

      /* ── PREMIUM+ 19,90€ — 3 jours ── */
      React.createElement("div",{style:{position:"relative",borderRadius:"14px",overflow:"hidden"}},
        /* Blurred preview */
        React.createElement("div",{style:{
          filter:"blur(5px)",userSelect:"none",pointerEvents:"none",
          background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.2)",
          borderRadius:"14px",padding:"18px 20px"
        }},
          React.createElement("div",{style:{fontSize:"10px",letterSpacing:"3px",color:"#d4af37",marginBottom:"12px",fontWeight:"600"}},"PICKS 3 JOURS — PREMIUM+"),
          React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}},
            nextThreeDays.map(function(pk3,i3){
              var hasData = pk3[5]==="EN ATTENTE"||pk3[5]==="EN COURS";
              var isOk    = pk3[5]==="GAGNE";
              return React.createElement("div",{key:i3,style:{
                background: hasData?"rgba(212,175,55,0.08)":isOk?"rgba(34,197,94,0.06)":"rgba(255,255,255,0.025)",
                border:"1px solid "+(hasData?"rgba(212,175,55,0.28)":isOk?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.06)"),
                borderRadius:"10px",padding:"13px 10px",textAlign:"center",minWidth:0
              }},
                React.createElement("div",{style:{fontSize:"10px",color:"#555",letterSpacing:"1px",marginBottom:"5px"}}, pk3[0]),
                React.createElement("div",{style:{fontSize:"10px",color:hasData?"#d4af37":isOk?"#22c55e":"#444",fontWeight:"600",lineHeight:"1.4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}},
                  hasData ? (pk3[6]?sportEmoji(pk3[6]):"")+pk3[2]
                  : isOk  ? "✅ "+pk3[2]
                  : "En analyse..."
                ),
                (hasData||isOk) && React.createElement("div",{style:{fontSize:"13px",fontWeight:"700",color:"#fff",marginTop:"4px"}},"×"+pk3[3])
              );
            })
          )
        ),
        /* Lock overlay */
        React.createElement("div",{style:{
          position:"absolute",inset:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:"8px",
          background:"rgba(8,7,6,0.75)",backdropFilter:"blur(3px)",
          borderRadius:"14px",border:"1px solid rgba(212,175,55,0.2)"
        }},
          React.createElement("span",{style:{fontSize:"20px"}},"💎"),
          React.createElement("div",{style:{fontSize:"12px",color:"#d4af37",letterSpacing:"2px",fontWeight:"700",textAlign:"center"}},"PICKS 3 JOURS — 19,90€/mois"),
          React.createElement("div",{style:{fontSize:"11px",color:"#666",textAlign:"center",maxWidth:"240px",lineHeight:"1.7"}},"Aujourd'hui + demain + J+2 — picks dès 12h00, avant tout le monde"),
          React.createElement("button",{
            onClick:function(){setPage("subscription");if(window.gtag)window.gtag("event","click_premium_teaser",{tier:"premium_plus"});},
            style:{marginTop:"2px",background:"linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.07))",border:"1px solid rgba(212,175,55,0.55)",borderRadius:"8px",padding:"9px 22px",color:"#d4af37",fontWeight:"700",cursor:"pointer",fontSize:"12px",letterSpacing:"1px"}
          },"💎 DÉBLOQUER PREMIUM+")
        )
      )
    ),
    React.createElement("div", {className:"section-divider"}),
    React.createElement("section", {className:"home-section",style:{padding:"40px 20px 48px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"13px",letterSpacing:"4px",textAlign:"center",marginBottom:"32px",fontFamily:"'Jost',sans-serif",fontWeight:"600"}}, t("comment_marche")),
      React.createElement("div", {style:{display:"flex",gap:"20px",flexWrap:"wrap"}},
        [{num:t("section_01"),title:t("section_01_title"),desc:t("section_01_desc")},{num:t("section_02"),title:t("section_02_title"),desc:t("section_02_desc")},{num:t("section_03"),title:t("section_03_title"),desc:t("section_03_desc")}].map(function(s,i){
          return React.createElement("div",{key:i,style:{flex:1,minWidth:"200px",background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.12)",borderRadius:"16px",padding:"32px 24px",transition:"border-color 0.3s, box-shadow 0.3s"}},
            React.createElement("div",{style:{fontSize:"36px",fontWeight:"bold",color:"rgba(212,175,55,0.25)",marginBottom:"16px",fontFamily:"'Bodoni Moda',serif"}},s.num),
            React.createElement("div",{style:{fontSize:"18px",fontWeight:"600",color:"#fff",marginBottom:"12px",fontFamily:"'Bodoni Moda',serif"}},s.title),
            React.createElement("div",{style:{fontSize:"14px",color:"#6b6356",lineHeight:"1.9"}},s.desc)
          );
        })
      )
    ),
    React.createElement("div", {className:"section-divider"}),
    React.createElement("section", {className:"home-section",style:{padding:"40px 20px 44px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{
        background:"linear-gradient(135deg,rgba(0,136,204,0.12) 0%,rgba(0,136,204,0.05) 100%)",
        border:"2px solid rgba(0,136,204,0.5)",
        borderRadius:"16px",padding:"32px 34px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"22px",
        boxShadow:"0 0 30px rgba(0,136,204,0.12)"
      }},
        React.createElement("div", {style:{flex:1,minWidth:"200px"}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}},
            React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 24 24",fill:"none",stroke:"#29b6f6",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},
              React.createElement("line",{x1:"22",y1:"2",x2:"11",y2:"13"}),
              React.createElement("polygon",{points:"22 2 15 22 11 13 2 9 22 2"})
            ),
            React.createElement("span",{style:{fontSize:"11px",letterSpacing:"3px",color:"#29b6f6",fontWeight:"700"}},t("canal_telegram"))
          ),
          React.createElement("div",{style:{fontSize:"18px",fontWeight:"700",color:"#fff",marginBottom:"6px",fontFamily:"'Bodoni Moda',serif"}},t("recois_pick")),
          React.createElement("div",{style:{fontSize:"13px",color:"#888",marginBottom:"8px"}},t("chaque_matin")),
          React.createElement("div",{style:{display:"flex",gap:"8px",flexWrap:"wrap"}},
            ["Winamax","Betclic","Unibet","PMU"].map(function(b){
              return React.createElement("span",{key:b,style:{fontSize:"10px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"4px",padding:"2px 8px",color:"#555"}},b);
            })
          )
        ),
        React.createElement("a",{href:TELEGRAM_LINK,target:"_blank",style:{
          background:"linear-gradient(135deg,#0088cc,#29b6f6)",
          borderRadius:"10px",padding:"16px 28px",color:"#fff",fontWeight:"bold",
          textDecoration:"none",fontSize:"15px",whiteSpace:"nowrap",
          display:"inline-flex",alignItems:"center",gap:"10px",flexShrink:0,
          boxShadow:"0 4px 20px rgba(0,136,204,0.4)"
        }},
          t("rejoindre_telegram"))
      )
    ),
    /* ════ VALUE BETS SECTION ════ */
    React.createElement("section", {className:"home-section",style:{padding:"16px 20px 28px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{background:"linear-gradient(135deg,rgba(34,197,94,0.08),rgba(34,197,94,0.03))",border:"1px solid rgba(34,197,94,0.25)",borderRadius:"14px",padding:"24px 26px"}},
        React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}},
          React.createElement("div", {style:{fontSize:"12px",letterSpacing:"3px",color:"#22c55e",fontWeight:"700"}}, "⭐ VALUE BETS DÉTECTÉS"),
          React.createElement("div", {style:{fontSize:"11px",color:"#555",marginLeft:"auto"}}, "Notre IA détecte les sous-évaluations bookmakers")
        ),
        React.createElement("div", {style:{fontSize:"13px",color:"#666",marginBottom:"18px",lineHeight:"1.75"}},
          "La Value Bet est notre avantage principal. Quand notre modèle estime qu'une probabilité réelle dépasse celle impliquée par la cote, nous avons un edge. Sur 100 picks, cet edge génère un ROI positif même avec 55% de réussite."
        ),
        React.createElement("div", {style:{display:"flex",gap:"12px",flexWrap:"wrap"}},
          [
            {label:"🟢 Forte Value", desc:"Edge > 10% — Mise pleine recommandée", color:"#22c55e"},
            {label:"🟡 Value Modérée", desc:"Edge 5-10% — Mise standard", color:"#fbbf24"},
            {label:"🔴 Faible Value", desc:"Edge 0-5% — Mise réduite", color:"#f97316"},
          ].map(function(v,i){
            return React.createElement("div", {key:i,style:{flex:1,minWidth:"160px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"10px",padding:"14px 14px"}},
              React.createElement("div", {style:{fontSize:"12px",fontWeight:"bold",color:v.color,marginBottom:"6px"}}, v.label),
              React.createElement("div", {style:{fontSize:"12px",color:"#555",lineHeight:"1.55"}}, v.desc)
            );
          })
        )
      )
    ),
    /* ════ PICKS SOLIDES DU JOUR ════ */
    React.createElement("section", {className:"home-section",style:{padding:"16px 20px 28px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"4px",marginBottom:"16px"}}, "PICKS SOLIDES DU JOUR"),
      React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"10px"}},
        picks.filter(function(p){ return p[5]==="EN ATTENTE" && parseFloat(p[7]) >= 7.0; }).length === 0
          ? React.createElement("div", {style:{padding:"20px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:"10px",color:"#444",fontSize:"13px",textAlign:"center",lineHeight:"1.6"}},
              "Aucun pick solide en attente pour le moment."
            )
          : picks.filter(function(p){ return p[5]==="EN ATTENTE" && parseFloat(p[7]) >= 7.0; }).map(function(p,i){
              var td = getTrophies(parseFloat(p[7]));
              var conf = getConfidence(parseFloat(p[7]));
              var vb = getValueBet(parseFloat(p[7]), p[3]);
              return React.createElement("div", {key:i,style:{
                background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.2)",
                borderRadius:"10px",padding:"16px 18px",display:"flex",gap:"14px",alignItems:"center",flexWrap:"wrap"
              }},
                React.createElement("div", {style:{fontSize:"20px",lineHeight:"1"}}, td.trophies),
                React.createElement("div", {style:{flex:1,minWidth:"120px"}},
                  React.createElement("div", {style:{fontSize:"14px",color:"#fff",fontWeight:"bold",marginBottom:"4px"}}, sportEmoji(p[6])+p[1]),
                  React.createElement("div", {style:{fontSize:"12px",color:"#d4af37"}}, p[2])
                ),
                React.createElement("div", {style:{textAlign:"right"}},
                  React.createElement("div", {style:{fontSize:"17px",fontWeight:"700",color:"#fff",marginBottom:"3px"}}, "Cote: "+p[3]),
                  React.createElement("div", {style:{fontSize:"11px",fontWeight:"bold",color:conf.color}}, p[7]+"/10 — "+conf.label)
                ),
                vb && React.createElement("div", {style:{fontSize:"11px",fontWeight:"bold",color:vb.color,padding:"4px 10px",background:vb.edge>=5?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"6px"}}, vb.label)
              );
            })
      )
    ),
    /* ════ HISTORIQUE ════ */
    React.createElement("section", {className:"home-section",style:{padding:"16px 20px 36px",maxWidth:"980px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",flexWrap:"wrap",gap:"10px"}},
        React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",margin:0}}, t("historique_picks")),
        React.createElement("div", {style:{display:"flex",gap:"6px",flexWrap:"wrap"}},
          [{key:"ALL",label:t("tous")},{key:"Foot",label:t("foot")},{key:"Hockey",label:t("hockey")},{key:"Baseball",label:"⚾ Baseball"},{key:"Basketball",label:t("basket")}].map(function(f){
            return React.createElement("button", {key:f.key,onClick:function(){setFilter(f.key);},style:{background:filter===f.key?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(filter===f.key?"#d4af37":"rgba(255,255,255,0.1)"),color:filter===f.key?"#d4af37":"#555",padding:"6px 14px",borderRadius:"6px",cursor:"pointer",fontSize:"12px",minHeight:"34px"}}, f.label);
          })
        )
      ),
      React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"6px"}},
        filtered.map(function(p,i){
          var g=p[5]==="GAGNE", np=p[5]==="NOPICK", ec=p[5]==="EN COURS", ea=p[5]==="EN ATTENTE";
          var bg=np?"rgba(100,100,100,0.04)":(ec||ea)?"rgba(255,165,0,0.05)":g?"rgba(34,180,60,0.05)":"rgba(255,60,60,0.05)";
          var bd=np?"rgba(100,100,100,0.15)":(ec||ea)?"rgba(255,165,0,0.3)":g?"rgba(34,180,60,0.2)":"rgba(255,60,60,0.2)";
          var dc=np?"#555":(ec||ea)?"#ffa500":g?"#22cc44":"#ff4444";
          var label=np?"---":ec?t("a_venir"):ea?t("en_attente"):g?t("gagne"):t("perdu");
          var matchDisplay=(!np&&p[6])?sportEmoji(p[6])+p[1]:p[1];
          var aiScore = parseFloat(p[7]) || 0;
          var histTrophy = !np && aiScore >= 7.0 ? getTrophies(aiScore) : null;
          var histConf = !np && aiScore >= 7.0 ? getConfidence(aiScore) : null;
          var ARJEL_SPORTS = ["Foot","Hockey"];
          var isHorsARJEL = !np && !ARJEL_SPORTS.includes(p[6]);
          return React.createElement("div", {key:i,style:{display:"flex",alignItems:"center",padding:"13px 16px",background:bg,border:"1px solid "+bd,borderRadius:"8px",gap:"10px",flexWrap:"wrap"}},
            React.createElement("span", {style:{color:"#555",fontSize:"11px",minWidth:"40px",flexShrink:0}}, p[0]),
            React.createElement("div", {style:{flex:"1",minWidth:"140px"}},
              React.createElement("span", {style:{color:np?"#444":"#ddd",fontSize:"13px",fontStyle:np?"italic":"normal"}}, matchDisplay),
              isHorsARJEL && React.createElement("span", {style:{marginLeft:"6px",fontSize:"9px",color:"#f97316",background:"rgba(249,115,22,0.1)",border:"1px solid rgba(249,115,22,0.3)",borderRadius:"3px",padding:"1px 5px",verticalAlign:"middle"}}, "Hors ANJ")
            ),
            React.createElement("span", {style:{background:"rgba(212,175,55,0.07)",border:"1px solid rgba(212,175,55,0.15)",borderRadius:"3px",padding:"2px 7px",color:np?"#333":"#d4af37",fontSize:"10px",minWidth:"75px",textAlign:"center",flexShrink:0}}, p[2]),
            React.createElement("span", {style:{color:np?"#222":"#fff",fontWeight:"bold",minWidth:"32px",fontSize:"13px",flexShrink:0}}, p[3]),
            React.createElement("span", {style:{color:"#555",fontSize:"12px",minWidth:"32px",flexShrink:0}}, p[4]),
            histTrophy && React.createElement("span", {style:{fontSize:"13px",flexShrink:0,letterSpacing:"-2px"}}, histTrophy.trophies),
            histConf && React.createElement("span", {style:{fontSize:"9px",color:histConf.color,fontWeight:"600",flexShrink:0}}, aiScore+"/10"),
            React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"5px",minWidth:"80px",flexShrink:0}},
              React.createElement("div", {style:{width:"8px",height:"8px",borderRadius:"50%",background:dc,flexShrink:0}}),
              React.createElement("span", {style:{color:dc,fontWeight:"bold",fontSize:"12px"}}, label)
            )
          );
        })
      )
    ),
    /* ── TRANSPARENCE & STATS RÉELLES (à la place des faux témoignages) ── */
    React.createElement("section", {className:"home-section",style:{padding:"20px 20px 0px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"12px",marginBottom:"18px"}},
        React.createElement("div",{style:{fontSize:"10px",letterSpacing:"3px",color:"#555",fontWeight:"600"}},"TRANSPARENCE TOTALE"),
        React.createElement("div",{style:{flex:1,height:"1px",background:"linear-gradient(90deg,rgba(212,175,55,0.18),transparent)"}})
      ),
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"10px"}},
        [
          {icon:"📊", val: winrate+"%", lbl:"Taux de réussite réel"},
          {icon:"📅", val:"Depuis mai 2026", lbl:"Historique publié"},
          {icon:"✅", val: wins+" / "+total, lbl:"Victoires / Paris"},
          {icon:"🔍", val:"Pertes incluses", lbl:"Aucun filtre, aucun tri"}
        ].map(function(s,i){
          return React.createElement("div",{key:i,style:{
            background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",
            borderRadius:"12px",padding:"16px",textAlign:"center"
          }},
            React.createElement("div",{style:{fontSize:"20px",marginBottom:"6px"}},s.icon),
            React.createElement("div",{style:{fontSize:"16px",fontWeight:"700",color:"#d4af37",marginBottom:"4px",fontFamily:"'Bodoni Moda',serif"}},s.val),
            React.createElement("div",{style:{fontSize:"11px",color:"#555",lineHeight:"1.5"}},s.lbl)
          );
        })
      )
    ),
    /* ── CAPTURE EMAIL ── */
    React.createElement("section", {className:"home-section",style:{padding:"24px 20px 32px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div",{style:{
        background:"linear-gradient(135deg,rgba(212,175,55,0.07),rgba(212,175,55,0.03))",
        border:"1px solid rgba(212,175,55,0.22)",
        borderRadius:"16px",padding:"32px 28px",textAlign:"center",position:"relative",overflow:"hidden"
      }},
        React.createElement("div",{style:{position:"absolute",top:0,left:0,right:0,height:"2px",background:"linear-gradient(90deg,transparent,rgba(212,175,55,0.5),transparent)"}}),
        React.createElement("div",{style:{fontSize:"10px",letterSpacing:"4px",color:"#d4af37",fontWeight:"600",marginBottom:"10px"}},"ACCÈS DÉCOUVERTE"),
        React.createElement("h3",{style:{fontFamily:"'Bodoni Moda',serif",fontSize:"clamp(20px,4vw,28px)",color:"#fff",fontWeight:"700",marginBottom:"10px",lineHeight:"1.2"}},
          "Recevez le pick du jour gratuitement"
        ),
        React.createElement("p",{style:{color:"#666",fontSize:"14px",marginBottom:"24px",maxWidth:"380px",margin:"0 auto 24px",lineHeight:"1.75"}},
          "Phase de lancement ouverte. Pick gratuit chaque matin, directement dans votre boîte mail."
        ),
        emailDone
          ? React.createElement("div",{style:{
              display:"inline-flex",alignItems:"center",gap:"10px",
              background:"rgba(34,197,94,0.12)",border:"1px solid rgba(34,197,94,0.3)",
              borderRadius:"10px",padding:"14px 24px",color:"#22c55e",fontWeight:"700",fontSize:"15px"
            }},
              "✅ Parfait ! Votre premier pick arrive demain matin."
            )
          : React.createElement("form",{onSubmit:handleEmailSubmit,style:{display:"flex",gap:"10px",maxWidth:"440px",margin:"0 auto",flexWrap:"wrap",justifyContent:"center"}},
              React.createElement("input",{
                type:"email",required:true,placeholder:"votre@email.com",
                value:emailInput,
                onChange:function(e){setEmailInput(e.target.value);},
                style:{
                  flex:1,minWidth:"200px",padding:"14px 18px",
                  background:"rgba(255,255,255,0.06)",
                  border:"1px solid rgba(255,255,255,0.18)",
                  borderRadius:"10px",color:"#fff",fontSize:"15px",
                  outline:"none",fontFamily:"'Jost',sans-serif"
                }
              }),
              React.createElement("button",{
                type:"submit",disabled:emailLoading,
                style:{
                  padding:"14px 24px",background:"#d4af37",
                  color:"#080706",fontWeight:"700",borderRadius:"10px",
                  border:"none",cursor:"pointer",fontSize:"14px",
                  letterSpacing:"0.06em",whiteSpace:"nowrap",
                  opacity:emailLoading?0.7:1,fontFamily:"'Jost',sans-serif"
                }
              }, emailLoading ? "..." : "Recevoir →")
            ),
        React.createElement("p",{style:{fontSize:"11px",color:"#333",marginTop:"12px"}},
          "Sans engagement. Désinscription en 1 clic."
        )
      )
    ),
    React.createElement("section", {className:"home-section",style:{padding:"16px 20px 36px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",marginBottom:"20px"}}, t("questions_frequentes")),
      React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"8px"}},
        faqs.map(function(f,i){
          var open=faqOpen===i;
          return React.createElement("div",{key:i,style:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"10px",overflow:"hidden"}},
            React.createElement("button",{onClick:function(){setFaqOpen(open?null:i);},style:{width:"100%",background:"transparent",border:"none",padding:"18px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",textAlign:"left",fontFamily:"Georgia,serif",minHeight:"56px"}},
              React.createElement("span",{style:{color:"#ddd",fontSize:"14px",lineHeight:"1.5"}},f.q),
              React.createElement("span",{style:{color:"#d4af37",fontSize:"20px",fontWeight:"bold",marginLeft:"14px",flexShrink:0}},open?"-":"+")
            ),
            open ? React.createElement("div",{style:{padding:"0 20px 20px",color:"#666",fontSize:"13px",lineHeight:"1.85"}},f.a) : null
          );
        })
      )
    ),
    React.createElement("section", {className:"home-section",style:{padding:"16px 20px 36px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{background:"rgba(212,175,55,0.06)",border:"1px solid rgba(212,175,55,0.25)",borderRadius:"14px",padding:"36px 28px",textAlign:"center"}},
        React.createElement("div",{style:{fontSize:"12px",letterSpacing:"4px",color:"#d4af37",marginBottom:"14px",fontFamily:"'Jost',sans-serif",fontWeight:"600"}},t("pret_gagner")),
        React.createElement("div",{style:{fontSize:"30px",fontWeight:"700",color:"#fff",marginBottom:"16px",fontFamily:"'Bodoni Moda',serif",lineHeight:"1.2"}},t("rejoignez")),
        React.createElement("p",{style:{color:"#555",fontSize:"14px",marginBottom:"24px",maxWidth:"400px",marginLeft:"auto",marginRight:"auto",lineHeight:"1.7"}},t("bonus_winamax")),
        React.createElement("a",{href:WINAMAX_LINK,target:"_blank",style:{display:"inline-flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"10px",padding:"16px 36px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"14px",letterSpacing:"1px",minHeight:"52px"}},t("ouvrir_compte_winamax"))
      )
    ),
    React.createElement("section", {className:"home-section",style:{padding:"0 20px 36px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}},
        React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",margin:0}}, t("nos_partenaires")),
        React.createElement("button", {onClick:function(){setPage("bookmakers");},style:{background:"transparent",border:"1px solid rgba(212,175,55,0.3)",color:"#d4af37",padding:"6px 14px",borderRadius:"6px",cursor:"pointer",fontSize:"11px"}}, t("voir_tous"))
      ),
      React.createElement("div", {style:{display:"flex",gap:"12px",flexWrap:"wrap"}},
        bookmakers.slice(0,3).map(function(b,i){
          return React.createElement("a", {key:i,href:b.link,target:"_blank",style:{flex:"1",minWidth:"180px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"10px",padding:"18px 18px",textDecoration:"none",display:"block",textAlign:"center"}},
            React.createElement("div", {style:{fontSize:"16px",fontWeight:"bold",color:"#fff",marginBottom:"5px"}}, b.nom),
            React.createElement("div", {style:{fontSize:"11px",color:"#d4af37",marginBottom:"12px"}}, b.bonus),
            React.createElement("div", {style:{background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"6px",padding:"9px",color:"#080c14",fontWeight:"bold",fontSize:"12px"}}, "S inscrire")
          );
        })
      )
    ),
    footer,
    bandeauLegal
  );
}


