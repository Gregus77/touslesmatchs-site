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
var TIKTOK_LINK = "https://www.tiktok.com/@touslesmatchs.com";
var TELEGRAM_LINK = "https://t.me/touslesmatchs_bot";

var picks = [
  ["08/06","Greece vs Italy","Greece Vainqueur","1.6","—","EN ATTENTE","Foot",7,7],
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

var temoignages = [
  {nom:"Thomas R.", ville:"Lyon", txt:"9 wins consécutifs, je suis bluffé. Le seul tipster que je suis vraiment.", gains:"+47 EUR"},
  {nom:"Karim B.", ville:"Paris", txt:"Le pick du jour est devenu mon rituel du matin. Simple, clair, efficace.", gains:"+31 EUR"},
  {nom:"Julien M.", ville:"Bordeaux", txt:"Le seuil 8/10 ça change tout. Moins de picks mais beaucoup plus de qualité.", gains:"+28 EUR"},
];

var faqs = [
  {q:"C'est vraiment gratuit ?", a:"Oui, 100% gratuit. Nous sommes rémunérés via les liens d'affiliation bookmakers. En vous inscrivant via nos liens, vous nous aidez à maintenir le service — merci."},
  {q:"Comment votre IA analyse les matchs ?", a:"Notre modèle Hermès croise la forme récente, les blessures, les confrontations directes, les stats domicile/extérieur et d'autres variables. Seuls les picks avec un score de confiance ≥ 7/10 sont publiés — jamais de match amical ou sans enjeu réel."},
  {q:"Combien de picks par jour ?", a:"Un seul pick par jour, maximum. Qualité plutôt que quantité. Les jours sans pick valable sont indiqués clairement : on ne force jamais un pari."},
  {q:"Quel bankroll est recommandé ?", a:"Ne misez jamais plus de 2 à 5% de votre bankroll total sur un seul pick. Les paris sportifs comportent des risques — jouez de façon responsable."},
  {q:"Qu'est-ce que le plan Premium ?", a:"Le plan Premium à 19,90€/mois donne accès à un pick HORS-ARJEL supplémentaire chaque jour, sur Pinnacle et PS3838 où les cotes sont souvent supérieures. Idéal pour les parieurs qui cherchent de la valeur sur les compétitions internationales."},
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
  if(sport==="Volleyball") return "🏐 ";
  if(sport==="MLS") return "⚽🇺🇸 ";
  if(sport==="F1") return "🏎️ ";
  if(sport==="NFL") return "🏈 ";
  if(sport==="Rugby") return "🏉 ";
  if(sport==="MMA") return "🥊 ";
  return sport ? "🎯 " : "";
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

  function changeLang(newLang) {
    setLang(newLang);
    localStorage.setItem("lang", newLang);
  }

  function t(key) {
    return translations[lang]?.[key] || translations.fr[key] || key;
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

  // ═══ TRI PAR DATE DÉCROISSANTE (plus récent en premier) ═══
  function parseDateFR(d) {
    var parts = d.split(" au ");
    var dateStr = parts[parts.length - 1].trim();
    var dd_mm = dateStr.split("/");
    if (dd_mm.length < 2) return new Date(0);
    return new Date(2026, parseInt(dd_mm[1]) - 1, parseInt(dd_mm[0]));
  }
  picks = picks.slice().sort(function(a, b) {
    return parseDateFR(b[0]) - parseDateFR(a[0]);
  });

  // ═══ DÉDUPLICATION : 1 seul pick par date ═══
  var seenDates = {};
  picks = picks.filter(function(p){
    var key = p[0] + "|" + p[5]; // date + status
    if (seenDates[key]) return false;
    seenDates[key] = true;
    return true;
  });

  var wins = picks.filter(function(p){return p[5]==="GAGNE";}).length;
  var losses = picks.filter(function(p){return p[5]==="PERDU";}).length;
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

  // ═══ SÉRIE DE VICTOIRES EN COURS + MEILLEURE SÉRIE HISTORIQUE ═══
  var serieEnCours = 0;
  for (var i = 0; i < picks.length; i++) {
    if (picks[i][5] === "GAGNE") serieEnCours++;
    else if (picks[i][5] === "PERDU") break;
  }
  // Meilleure série : parcourir dans l'ordre chronologique (du plus ancien au plus récent)
  var meilleuresSerie = 0, tempSerie = 0;
  for (var j = picks.length - 1; j >= 0; j--) {
    if (picks[j][5] === "GAGNE") { tempSerie++; if (tempSerie > meilleuresSerie) meilleuresSerie = tempSerie; }
    else if (picks[j][5] === "PERDU") { tempSerie = 0; }
  }

  // Trouver le pick du JOUR en priorité (date d'aujourd'hui), puis le prochain à venir
  var todayStr = new Date().toLocaleDateString("fr-FR", {day:"2-digit", month:"2-digit"});
  var pickAujourdhui = picks.find(function(p){ return p[5]==="EN ATTENTE" && p[0]===todayStr; });
  // Si pas de pick aujourd'hui, prendre le plus proche dans le futur (ordre inversé = plus ancien en premier)
  var prochainPick = pickAujourdhui || picks.slice().reverse().find(function(p){ return p[5]==="EN ATTENTE"; });
  var pickDuJour = prochainPick || picks[0];
  var isNoPick = !prochainPick && (picks[0][5]==="NOPICK" || picks[0][5]==="GAGNE" || picks[0][5]==="PERDU");
  var isEnAttente = pickDuJour[5]==="EN ATTENTE";
  var isToday = pickDuJour[0] === todayStr;
  var pickLabel = isEnAttente ? (isToday ? t("pick_du_jour") : t("prochain_match")) : isNoPick ? t("pas_de_match") : t("pick_du_jour");

  // Threshold : index [8] = 8 (PREMIUM) ou 7 (STANDARD)
  var pickThreshold = pickDuJour[8] || 8;
  var pickAiScore   = pickDuJour[7] || 0;
  var isPremium     = pickThreshold >= 8;
  var isStandard7   = pickThreshold === 7;
  var pickBadge     = isPremium ? t("pick_premium") : t("pick_standard");
  var pickBadgeColor = isPremium ? "#d4af37" : "#f59e0b";
  var pickBorderColor = isPremium ? "rgba(212,175,55,0.35)" : "rgba(245,158,11,0.5)";

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
        React.createElement("button",{title:"Français",onClick:function(){changeLang("fr");},style:{background:lang==="fr"?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(lang==="fr"?"#d4af37":"rgba(255,255,255,0.1)"),borderRadius:"4px",padding:"4px 7px",cursor:"pointer",fontSize:"16px",lineHeight:"1"}},"🇫🇷"),
        React.createElement("button",{title:"English",onClick:function(){changeLang("en");},style:{background:lang==="en"?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(lang==="en"?"#d4af37":"rgba(255,255,255,0.1)"),borderRadius:"4px",padding:"4px 7px",cursor:"pointer",fontSize:"16px",lineHeight:"1"}},"🇬🇧"),
        React.createElement("button",{title:"Español",onClick:function(){changeLang("es");},style:{background:lang==="es"?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(lang==="es"?"#d4af37":"rgba(255,255,255,0.1)"),borderRadius:"4px",padding:"4px 7px",cursor:"pointer",fontSize:"16px",lineHeight:"1"}},"🇪🇸"),
        React.createElement("button",{title:"Italiano",onClick:function(){changeLang("it");},style:{background:lang==="it"?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(lang==="it"?"#d4af37":"rgba(255,255,255,0.1)"),borderRadius:"4px",padding:"4px 7px",cursor:"pointer",fontSize:"16px",lineHeight:"1"}},"🇮🇹"),
        React.createElement("button",{title:"Русский",onClick:function(){changeLang("ru");},style:{background:lang==="ru"?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(lang==="ru"?"#d4af37":"rgba(255,255,255,0.1)"),borderRadius:"4px",padding:"4px 7px",cursor:"pointer",fontSize:"16px",lineHeight:"1"}},"🇷🇺")
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
    React.createElement("section", {className:"hero-section",style:{padding:"60px 20px 30px",textAlign:"center"}},
      /* Badges 6 IAs */
      React.createElement("div", {style:{display:"flex",justifyContent:"center",gap:"6px",flexWrap:"wrap",marginBottom:"18px"}},
        [
          {nom:"Groq",    dot:"#22c55e"},
          {nom:"Gemini",  dot:"#3b82f6"},
          {nom:"DeepSeek",dot:"#f97316"},
          {nom:"Mistral", dot:"#a855f7"},
          {nom:"Qwen",    dot:"#ef4444"},
          {nom:"Claude",  dot:"#d4af37"},
        ].map(function(ia,i){
          return React.createElement("div",{key:i,style:{display:"inline-flex",alignItems:"center",gap:"5px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"20px",padding:"4px 12px"}},
            React.createElement("div",{style:{width:"6px",height:"6px",borderRadius:"50%",background:ia.dot,flexShrink:0}}),
            React.createElement("span",{style:{fontSize:"10px",color:"#888",fontWeight:"600",letterSpacing:"0.06em"}}, ia.nom)
          );
        })
      ),
      React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",marginBottom:"16px"}},
        React.createElement("span", {style:{fontSize:"13px",letterSpacing:"4px",color:"#d4af37",fontFamily:"'Jost',sans-serif",fontWeight:"600",textTransform:"uppercase"}}, t("section_5ia")),
        React.createElement("span", {style:{fontSize:"11px",color:"#555",letterSpacing:"1px"}}, "·"),
        React.createElement("span", {style:{fontSize:"13px",letterSpacing:"3px",color:"#b89a2a",fontFamily:"'Bodoni Moda',serif",fontStyle:"italic"}}, "Hermès Chief")
      ),
      React.createElement("h1", {style:{fontSize:"clamp(36px,5.5vw,64px)",fontWeight:"700",color:"#fff",margin:"0 0 16px",fontFamily:"'Bodoni Moda',serif",lineHeight:"1.08",letterSpacing:"-0.02em"}},
        lang==="fr" ? "Le meilleur " : lang==="en" ? "The best " : lang==="es" ? "La mejor " : lang==="it" ? "La migliore " : "Лучший ",
        React.createElement("em", {style:{color:"#d4af37",fontStyle:"italic"}}, lang==="fr" ? "pick" : lang==="en" ? "pick" : lang==="es" ? "selección" : lang==="it" ? "scelta" : "прогноз"),
        lang==="fr" ? " chaque jour." : lang==="en" ? " every day." : lang==="es" ? " cada día." : lang==="it" ? " ogni giorno." : " каждый день."
      ),
      React.createElement("p", {style:{color:"#6b6356",fontSize:"17px",maxWidth:"540px",margin:"0 auto 12px",lineHeight:"1.8",fontWeight:"300"}},
        t("hero_subtitle")
      ),
      React.createElement("p", {style:{color:"#4a4438",fontSize:"14px",maxWidth:"480px",margin:"0 auto 36px",lineHeight:"1.7",fontWeight:"400"}},
        t("seuil_minimum"), React.createElement("strong",{style:{color:"#d4af37"}},"8/10"), ". ", t("fallback"), React.createElement("strong",{style:{color:"#f59e0b"}},"7/10"), t("pour_garantir")
      ),
      React.createElement("div", {className:"stats-grid",style:{display:"grid",gridTemplateColumns:"1fr 1fr",maxWidth:"700px",width:"100%",margin:"0 auto",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"8px",overflow:"hidden"}},
        [{label:t("taux_reussite"),value:winrate+"%",sub:total+" paris analysés"},{label:t("bankroll"),value:(roiPct>=0?"+":"")+roiPct+"%",sub:"depuis le début"},{label:t("resultats"),value:wins+" "+t("gagne"),sub:losses+" "+t("perdu")+" sur "+total},{label:t("serie"),value:serieEnCours+" "+t("victoires"),sub:"🏆 Meilleure : "+meilleuresSerie+" victoires"}].map(function(s,i){
          return React.createElement("div", {key:i, style:{padding:"18px 8px",borderRight:(i%2===0)?"1px solid rgba(212,175,55,0.15)":"none",borderBottom:i<2?"1px solid rgba(212,175,55,0.15)":"none",textAlign:"center"}},
            React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:"4px"}}, s.label),
            React.createElement("div", {style:{fontSize:"22px",fontWeight:"bold",color:"#d4af37"}}, s.value),
            React.createElement("div", {style:{fontSize:"10px",color:"#444",marginTop:"3px"}}, s.sub)
          );
        })
      )
    ),
    // ════ PICK DU JOUR — au-dessus de la ligne de flottaison ════
    React.createElement("section", {className:"home-section",style:{padding:"10px 20px 20px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{
        background: isNoPick ? "rgba(100,100,100,0.06)" : isStandard7 ? "rgba(245,158,11,0.05)" : "rgba(212,175,55,0.06)",
        border: "1px solid " + (isNoPick ? "rgba(100,100,100,0.25)" : pickBorderColor),
        borderRadius:"12px", padding:"24px", position:"relative", overflow:"hidden"
      }},
        /* Bandeau coloré en haut de la carte selon le niveau */
        !isNoPick && React.createElement("div", {style:{
          position:"absolute", top:0, left:0, right:0, height:"3px",
          background: isPremium
            ? "linear-gradient(90deg,transparent,#d4af37,transparent)"
            : "linear-gradient(90deg,transparent,#f59e0b,transparent)"
        }}),

        /* Badge PREMIUM / STANDARD */
        !isNoPick && React.createElement("div", {style:{
          display:"inline-flex", alignItems:"center", gap:"6px",
          background: isPremium ? "rgba(212,175,55,0.12)" : "rgba(245,158,11,0.15)",
          border: "1px solid " + (isPremium ? "rgba(212,175,55,0.4)" : "rgba(245,158,11,0.5)"),
          borderRadius:"4px", padding:"3px 10px",
          fontSize:"10px", fontWeight:"bold", letterSpacing:"2px",
          color: pickBadgeColor, marginBottom:"12px"
        }}, pickBadge),

        /* Label */
        React.createElement("div", {style:{fontSize:"10px",letterSpacing:"4px",color:isNoPick?"#555":isEnAttente?"#ffa500":pickBadgeColor,marginBottom:"8px"}}, pickLabel),

        /* Match */
        React.createElement("div", {style:{fontSize:"18px",fontWeight:"bold",color:isNoPick?"#555":"#fff",marginBottom:"8px",fontStyle:isNoPick?"italic":"normal"}},
          isNoPick
            ? t("no_match_today")
            : (!isNoPick && pickDuJour[6]) ? sportEmoji(pickDuJour[6])+pickDuJour[1] : pickDuJour[1]
        ),

        /* Message d'honnêteté quand NOPICK : la discipline > le contenu */
        isNoPick && React.createElement("div", {style:{
          background:"rgba(212,175,55,0.04)",
          border:"1px solid rgba(212,175,55,0.15)",
          borderRadius:"8px",
          padding:"14px 16px",
          marginBottom:"14px",
          fontSize:"13px",
          color:"#aaa",
          lineHeight:"1.6"
        }},
          React.createElement("strong", {style:{color:"#d4af37"}}, "⚖️ Discipline avant volume. "),
          "Hermès attend la reprise des compétitions sérieuses. Tant qu'aucun match ne passe notre checklist 6 points, ",
          React.createElement("em", null, "aucun pick aveugle ne sera publié"),
          ". Mieux vaut zéro pari qu'un pari faible."
        ),

        /* Marché + Cote */
        isNoPick ? null : React.createElement("div", {style:{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap",marginBottom:"16px"}},
          React.createElement("span", {style:{background:"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:"4px",padding:"5px 14px",color:"#d4af37",fontSize:"12px",fontWeight:"600",letterSpacing:"0.04em"}}, pickDuJour[2]),
          React.createElement("span", {style:{color:"#fff",fontWeight:"700",fontSize:"18px",fontFamily:"'Bodoni Moda',serif"}}, "Cote: "+pickDuJour[3])
        ),

        /* Panel Concile V5 — votes des 6 IAs */
        isNoPick ? null : React.createElement("div", {style:{
          background:"rgba(255,255,255,0.03)",
          border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:"8px", padding:"12px 16px", marginBottom:"14px"
        }},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"3px",color:"#555",marginBottom:"12px",fontWeight:"600"}}, t("concile_title")),
          React.createElement("div", {style:{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center",marginBottom:"10px"}},
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
                borderRadius:"5px", padding:"4px 9px"
              }},
                React.createElement("div", {style:{width:"6px",height:"6px",borderRadius:"50%",background:ia.color,flexShrink:0}}),
                React.createElement("span", {style:{fontSize:"13px",color:"#ccc",fontWeight:"600"}}, ia.nom),
                React.createElement("span", {style:{fontSize:"11px",color:"#555",marginLeft:"3px"}}, ia.role),
                React.createElement("span", {style:{fontSize:"13px",color:"#22c55e",marginLeft:"5px",fontWeight:"700"}}, "GO")
              );
            })
          ),
          /* Barre de confiance */
          pickAiScore > 0 && React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"10px"}},
            React.createElement("span", {style:{fontSize:"9px",color:"#555",letterSpacing:"1px",whiteSpace:"nowrap"}}, t("confiance_ia")),
            React.createElement("div", {style:{flex:1,height:"4px",background:"rgba(255,255,255,0.05)",borderRadius:"2px",overflow:"hidden",maxWidth:"160px"}},
              React.createElement("div", {style:{
                height:"100%", borderRadius:"2px",
                width: (pickAiScore / 10 * 100)+"%",
                background: isPremium
                  ? "linear-gradient(90deg,#9b7a10,#d4af37)"
                  : "linear-gradient(90deg,#92400e,#f59e0b)"
              }})
            ),
            React.createElement("span", {style:{fontSize:"12px",fontWeight:"700",color:isPremium?"#d4af37":"#f59e0b"}}, pickAiScore+"/10")
          )
        ),

        /* Avertissement 7/10 */
        isStandard7 && !isNoPick && React.createElement("div", {style:{
          background:"rgba(245,158,11,0.08)",
          border:"1px solid rgba(245,158,11,0.25)",
          borderRadius:"6px", padding:"10px 14px", marginBottom:"14px"
        }},
          React.createElement("div", {style:{fontSize:"11px",color:"#f59e0b",fontWeight:"bold",marginBottom:"3px"}}, t("seuil_abaisse")),
          React.createElement("div", {style:{fontSize:"11px",color:"#888",lineHeight:"1.6"}},
            t("seuil_abaisse_desc")
          )
        ),

        /* Urgence : pick valable aujourd'hui seulement */
        isEnAttente && !isNoPick && React.createElement("div", {style:{
          display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px",
          background:"rgba(255,80,80,0.07)",border:"1px solid rgba(255,80,80,0.2)",
          borderRadius:"6px",padding:"8px 14px"
        }},
          React.createElement("div", {style:{width:"8px",height:"8px",borderRadius:"50%",background:"#ff5555",flexShrink:0,boxShadow:"0 0 6px #ff5555"}}),
          React.createElement("span", {style:{fontSize:"11px",color:"#ff8888",fontWeight:"bold",letterSpacing:"0.05em"}}, "⏰ Pick valable aujourd'hui seulement — expire à minuit")
        ),

        /* CTA */
        isNoPick ? null : React.createElement("a", {href:WINAMAX_LINK,target:"_blank",style:{display:"inline-block",background:isPremium?"linear-gradient(135deg,#d4af37,#f5d76e)":"linear-gradient(135deg,#f59e0b,#fbbf24)",borderRadius:"6px",padding:"10px 24px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"13px"}}, t("parier_winamax"))
      )
    ),
    React.createElement("section", {className:"home-section",style:{padding:"10px 20px 30px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"13px",letterSpacing:"4px",textAlign:"center",marginBottom:"24px",fontFamily:"'Jost',sans-serif",fontWeight:"600"}}, t("comment_marche")),
      React.createElement("div", {style:{display:"flex",gap:"14px",flexWrap:"wrap"}},
        [{num:t("section_01"),title:t("section_01_title"),desc:t("section_01_desc")},{num:t("section_02"),title:t("section_02_title"),desc:t("section_02_desc")},{num:t("section_03"),title:t("section_03_title"),desc:t("section_03_desc")}].map(function(s,i){
          return React.createElement("div",{key:i,style:{flex:1,minWidth:"200px",background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.12)",borderRadius:"12px",padding:"22px 20px"}},
            React.createElement("div",{style:{fontSize:"28px",fontWeight:"bold",color:"rgba(212,175,55,0.25)",marginBottom:"10px",fontFamily:"'Bodoni Moda',serif"}},s.num),
            React.createElement("div",{style:{fontSize:"16px",fontWeight:"600",color:"#fff",marginBottom:"8px",fontFamily:"'Bodoni Moda',serif"}},s.title),
            React.createElement("div",{style:{fontSize:"14px",color:"#6b6356",lineHeight:"1.75"}},s.desc)
          );
        })
      )
    ),
    // ════ TARIFS — 3 niveaux ════
    React.createElement("section", {className:"home-section",style:{padding:"30px 20px",maxWidth:"860px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"13px",letterSpacing:"4px",textAlign:"center",marginBottom:"8px",fontFamily:"'Jost',sans-serif",fontWeight:"600"}}, "NOS FORMULES"),
      React.createElement("p", {style:{color:"#555",fontSize:"13px",textAlign:"center",marginBottom:"24px"}}, "Commencez gratuitement — passez Premium quand vous êtes prêt."),
      React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"14px"}},
        [
          {
            label:"GRATUIT", price:"0€", sub:"pour toujours",
            features:["1 pick ARJEL / jour","Winamax, Betclic, PMU","Canal Telegram public","Calculateur de projection"],
            cta:"Commencer gratuitement", ctaAction:null, highlight:false
          },
          {
            label:"STANDARD", price:"9,90€", sub:"/ mois",
            features:["1 pick ARJEL prioritaire","Alertes Telegram instantanées","Statistiques avancées","Historique complet des picks"],
            cta:"Essayer Standard", ctaAction:"standard", highlight:false, badge:"NOUVEAU"
          },
          {
            label:"PREMIUM", price:"19,90€", sub:"/ mois",
            features:["Tout Standard inclus","1 pick HORS-ARJEL (Pinnacle)","Cotes supérieures vs France","Canal Telegram privé"],
            cta:"💎 Devenir Premium", ctaAction:"premium", highlight:true, badge:"MEILLEURE VALEUR"
          }
        ].map(function(plan,i){
          return React.createElement("div", {key:i, style:{
            background: plan.highlight ? "linear-gradient(135deg,rgba(212,175,55,0.12),rgba(212,175,55,0.04))" : "rgba(255,255,255,0.02)",
            border: "1px solid " + (plan.highlight ? "#d4af37" : "rgba(255,255,255,0.08)"),
            borderRadius:"14px", padding:"24px 20px", position:"relative",
            boxShadow: plan.highlight ? "0 0 24px rgba(212,175,55,0.1)" : "none"
          }},
            plan.badge && React.createElement("div", {style:{
              position:"absolute", top:"-10px", left:"50%", transform:"translateX(-50%)",
              background: plan.highlight ? "#d4af37" : "rgba(255,255,255,0.12)",
              color: plan.highlight ? "#000" : "#aaa",
              padding:"3px 12px", borderRadius:"20px", fontSize:"9px", fontWeight:"bold", letterSpacing:"1px", whiteSpace:"nowrap"
            }}, plan.badge),
            React.createElement("div", {style:{fontSize:"10px",color:plan.highlight?"#d4af37":"#666",letterSpacing:"3px",marginBottom:"8px",fontWeight:"600"}}, plan.label),
            React.createElement("div", {style:{display:"flex",alignItems:"baseline",gap:"4px",marginBottom:"4px"}},
              React.createElement("span", {style:{fontSize:"32px",fontWeight:"700",color:plan.highlight?"#d4af37":"#fff",fontFamily:"'Bodoni Moda',serif"}}, plan.price),
              React.createElement("span", {style:{fontSize:"12px",color:"#555"}}, plan.sub)
            ),
            React.createElement("div", {style:{borderTop:"1px solid rgba(255,255,255,0.06)",margin:"16px 0"}}),
            React.createElement("ul", {style:{listStyle:"none",padding:0,margin:"0 0 20px",display:"flex",flexDirection:"column",gap:"8px"}},
              plan.features.map(function(f,j){
                return React.createElement("li", {key:j, style:{display:"flex",alignItems:"center",gap:"8px",fontSize:"12px",color:"#888"}},
                  React.createElement("span", {style:{color:"#22cc44",flexShrink:0}}, "✓"),
                  f
                );
              })
            ),
            React.createElement("button", {
              onClick: function(){
                if(!plan.ctaAction){return;}
                if(window.trackEvent) window.trackEvent("click_pricing_cta",{plan:plan.ctaAction});
                fetch("https://www.touslesmatchs.com/api/create-checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan:plan.ctaAction})})
                  .then(function(r){return r.json();})
                  .then(function(d){if(d.url) window.location.href=d.url; else window.open("https://t.me/touslesmatchs_bot","_blank");})
                  .catch(function(){window.open("https://t.me/touslesmatchs_bot","_blank");});
              },
              style:{
                width:"100%", padding:"12px", borderRadius:"8px", border:"none", cursor: plan.ctaAction?"pointer":"default",
                background: plan.highlight ? "linear-gradient(135deg,#d4af37,#f5d76e)" : plan.ctaAction ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                color: plan.highlight ? "#000" : "#aaa",
                fontWeight:"bold", fontSize:"13px", letterSpacing:"0.5px"
              }
            }, plan.cta)
          );
        })
      )
    ),
    React.createElement("section", {className:"home-section",style:{padding:"10px 20px 24px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{
        background:"linear-gradient(135deg,rgba(0,136,204,0.12) 0%,rgba(0,136,204,0.05) 100%)",
        border:"2px solid rgba(0,136,204,0.5)",
        borderRadius:"16px",padding:"28px 32px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"16px",
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
    React.createElement("section", {className:"home-section",style:{padding:"10px 20px 30px",maxWidth:"980px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}},
        React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",margin:0}}, t("historique_picks")),
        React.createElement("div", {style:{display:"flex",gap:"6px",flexWrap:"wrap"}},
          [{key:"ALL",label:t("tous")},{key:"Foot",label:t("foot")},{key:"Hockey",label:t("hockey")},{key:"Basketball",label:t("basket")}].map(function(f){
            return React.createElement("button", {key:f.key,onClick:function(){setFilter(f.key);},style:{background:filter===f.key?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(filter===f.key?"#d4af37":"rgba(255,255,255,0.1)"),color:filter===f.key?"#d4af37":"#555",padding:"5px 12px",borderRadius:"4px",cursor:"pointer",fontSize:"12px"}}, f.label);
          })
        )
      ),
      React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"5px"}},
        filtered.map(function(p,i){
          var g=p[5]==="GAGNE", np=p[5]==="NOPICK", ec=p[5]==="EN COURS", ea=p[5]==="EN ATTENTE";
          var bg=np?"rgba(100,100,100,0.04)":(ec||ea)?"rgba(255,165,0,0.05)":g?"rgba(34,180,60,0.05)":"rgba(255,60,60,0.05)";
          var bd=np?"rgba(100,100,100,0.15)":(ec||ea)?"rgba(255,165,0,0.3)":g?"rgba(34,180,60,0.2)":"rgba(255,60,60,0.2)";
          var dc=np?"#555":(ec||ea)?"#ffa500":g?"#22cc44":"#ff4444";
          var label=np?"---":ec?t("a_venir"):ea?t("en_attente"):g?t("gagne"):t("perdu");
          var matchDisplay=(!np&&p[6])?sportEmoji(p[6])+p[1]:p[1];
          return React.createElement("div", {key:i,style:{display:"flex",alignItems:"center",padding:"11px 14px",background:bg,border:"1px solid "+bd,borderRadius:"6px",gap:"10px",flexWrap:"wrap"}},
            React.createElement("span", {style:{color:"#555",fontSize:"11px",minWidth:"40px",flexShrink:0}}, p[0]),
            React.createElement("span", {style:{color:np?"#444":"#ddd",fontSize:"13px",flex:"1",minWidth:"140px",fontStyle:np?"italic":"normal"}}, matchDisplay),
            React.createElement("span", {style:{background:"rgba(212,175,55,0.07)",border:"1px solid rgba(212,175,55,0.15)",borderRadius:"3px",padding:"2px 7px",color:np?"#333":"#d4af37",fontSize:"10px",minWidth:"75px",textAlign:"center",flexShrink:0}}, p[2]),
            React.createElement("span", {style:{color:np?"#222":"#fff",fontWeight:"bold",minWidth:"32px",fontSize:"13px",flexShrink:0}}, p[3]),
            React.createElement("span", {style:{color:"#555",fontSize:"12px",minWidth:"32px",flexShrink:0}}, p[4]),
            React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"5px",minWidth:"80px",flexShrink:0}},
              React.createElement("div", {style:{width:"8px",height:"8px",borderRadius:"50%",background:dc,flexShrink:0}}),
              React.createElement("span", {style:{color:dc,fontWeight:"bold",fontSize:"12px"}}, label)
            )
          );
        })
      )
    ),
    React.createElement("section", {style:{padding:"20px 30px 30px",maxWidth:"780px",margin:"0 auto"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",marginBottom:"16px"}}, t("ils_gagnent")),
      React.createElement("div", {style:{display:"flex",gap:"12px",flexWrap:"wrap"}},
        temoignages.map(function(t,i){
          return React.createElement("div",{key:i,style:{flex:1,minWidth:"200px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"10px",padding:"18px 16px"}},
            React.createElement("div",{style:{fontSize:"12px",color:"#888",lineHeight:"1.7",marginBottom:"14px",fontStyle:"italic"}},"\""+t.txt+"\""),
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
              React.createElement("div",null,
                React.createElement("div",{style:{fontSize:"12px",color:"#ddd",fontWeight:"bold"}},t.nom),
                React.createElement("div",{style:{fontSize:"10px",color:"#444"}},t.ville)
              ),
              React.createElement("div",{style:{fontSize:"15px",fontWeight:"bold",color:"#22cc44"}},t.gains)
            )
          );
        })
      )
    ),
    React.createElement("section", {className:"home-section",style:{padding:"10px 20px 30px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",marginBottom:"16px"}}, t("questions_frequentes")),
      React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"6px"}},
        faqs.map(function(f,i){
          var open=faqOpen===i;
          return React.createElement("div",{key:i,style:{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"8px",overflow:"hidden"}},
            React.createElement("button",{onClick:function(){setFaqOpen(open?null:i);},style:{width:"100%",background:"transparent",border:"none",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",textAlign:"left",fontFamily:"Georgia,serif"}},
              React.createElement("span",{style:{color:"#ddd",fontSize:"13px"}},f.q),
              React.createElement("span",{style:{color:"#d4af37",fontSize:"18px",fontWeight:"bold",marginLeft:"12px",flexShrink:0}},open?"-":"+")
            ),
            open ? React.createElement("div",{style:{padding:"0 16px 16px",color:"#666",fontSize:"12px",lineHeight:"1.7"}},f.a) : null
          );
        })
      )
    ),
    React.createElement("section", {className:"home-section",style:{padding:"10px 20px 30px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{background:"rgba(212,175,55,0.06)",border:"1px solid rgba(212,175,55,0.25)",borderRadius:"12px",padding:"28px",textAlign:"center"}},
        React.createElement("div",{style:{fontSize:"12px",letterSpacing:"4px",color:"#d4af37",marginBottom:"12px",fontFamily:"'Jost',sans-serif",fontWeight:"600"}},t("pret_gagner")),
        React.createElement("div",{style:{fontSize:"28px",fontWeight:"700",color:"#fff",marginBottom:"14px",fontFamily:"'Bodoni Moda',serif",lineHeight:"1.2"}},t("rejoignez")),
        React.createElement("p",{style:{color:"#555",fontSize:"12px",marginBottom:"20px",maxWidth:"400px",marginLeft:"auto",marginRight:"auto"}},t("bonus_winamax")),
        React.createElement("a",{href:WINAMAX_LINK,target:"_blank",style:{display:"inline-block",background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"8px",padding:"13px 32px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"13px",letterSpacing:"1px"}},t("ouvrir_compte_winamax"))
      )
    ),
    React.createElement("section", {className:"home-section",style:{padding:"0 20px 30px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}},
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}},
        React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",margin:0}}, t("nos_partenaires")),
        React.createElement("button", {onClick:function(){setPage("bookmakers");},style:{background:"transparent",border:"1px solid rgba(212,175,55,0.3)",color:"#d4af37",padding:"5px 12px",borderRadius:"4px",cursor:"pointer",fontSize:"11px"}}, t("voir_tous"))
      ),
      React.createElement("div", {style:{display:"flex",gap:"10px",flexWrap:"wrap"}},
        bookmakers.slice(0,3).map(function(b,i){
          return React.createElement("a", {key:i,href:b.link,target:"_blank",style:{flex:"1",minWidth:"180px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"8px",padding:"14px 16px",textDecoration:"none",display:"block",textAlign:"center"}},
            React.createElement("div", {style:{fontSize:"15px",fontWeight:"bold",color:"#fff",marginBottom:"4px"}}, b.nom),
            React.createElement("div", {style:{fontSize:"10px",color:"#d4af37",marginBottom:"8px"}}, b.bonus),
            React.createElement("div", {style:{background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"4px",padding:"7px",color:"#080c14",fontWeight:"bold",fontSize:"11px"}}, "S inscrire")
          );
        })
      )
    ),
    footer,
    bandeauLegal
  );
}

