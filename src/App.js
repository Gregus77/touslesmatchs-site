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
  {nom:"Winamax", badge:"PARTENAIRE N°1", bonus:"Bonus jusqu'à 200 EUR", desc:"Le bookmaker français numéro 1. Cotes excellentes, interface top, retrait rapide.", link:WINAMAX_LINK, note:"9.5/10"},
  {nom:"Betclic", badge:"TOP COTES", bonus:"Bonus bienvenue 100 EUR", desc:"Cotes très compétitives surtout sur le foot européen. Appli mobile excellente.", link:BETCLIC_LINK, note:"9.2/10"},
  {nom:"Unibet", badge:"FIABLE", bonus:"Mise remboursée 100 EUR", desc:"Bookmaker international solide. Large choix de sports et de marchés.", link:UNIBET_LINK, note:"8.8/10"},
  {nom:"PMU", badge:"100% FRANÇAIS", bonus:"Bonus 150 EUR", desc:"L'historique des paris en France. Idéal pour le foot et les courses hippiques.", link:PMU_LINK, note:"8.5/10"},
  {nom:"ZEbet", badge:"COTES ÉLEVÉES", bonus:"Remboursement 100 EUR", desc:"Spécialiste des cotes boostées. Souvent les meilleures cotes sur certains matchs.", link:ZEBET_LINK, note:"8.3/10"},
  {nom:"ParionsSport", badge:"FDJ OFFICIEL", bonus:"Bonus 100 EUR", desc:"Le pari sportif officiel de la FDJ. Sécurité maximale, idéal pour les débutants.", link:PARIONSSPORT_LINK, note:"8.0/10"},
  {nom:"NetBet", badge:"BONNE VALEUR", bonus:"Bonus 100 EUR", desc:"Bon rapport qualité/cotes. Interface simple et claire. Programme de fidélité intéressant.", link:NETBET_LINK, note:"7.8/10"},
];

function sportEmoji(sport) {
  if(sport==="Foot") return "⚽ ";
  if(sport==="Hockey") return "🏒 ";
  if(sport==="Tennis") return "🎾 ";
  if(sport==="Basketball") return "🏀 ";
  if(sport==="Basket") return "🏀 ";
  if(sport==="Baseball") return "⚾ ";
  if(sport==="Volleyball") return "🏐 ";
  if(sport==="MLS") return "⚽🇺🇸 ";
  if(sport==="F1") return "🏎️ ";
  if(sport==="NFL") return "🏈 ";
  if(sport==="Rugby") return "🏉 ";
  if(sport==="MMA") return "🥊 ";
  return sport ? "🎯 " : "";
}

// ── Shared design tokens ──
var C = {
  accent:    "#6366F1",
  accentBlue:"#3B82F6",
  accentPurple:"#8B5CF6",
  win:       "#10B981",
  loss:      "#EF4444",
  pending:   "#F59E0B",
  border:    "rgba(255,255,255,0.07)",
  border2:   "rgba(255,255,255,0.12)",
  text:      "#FFFFFF",
  muted:     "rgba(255,255,255,0.5)",
  dim:       "rgba(255,255,255,0.2)",
  card:      "#111111",
  bg:        "#0A0A0A",
};

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

  // ═══ TRI PAR DATE DÉCROISSANTE ═══
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

  // ═══ DÉDUPLICATION ═══
  var seenDates = {};
  picks = picks.filter(function(p){
    var key = p[0] + "|" + p[5];
    if (seenDates[key]) return false;
    seenDates[key] = true;
    return true;
  });

  var wins = picks.filter(function(p){return p[5]==="GAGNE";}).length;
  var losses = picks.filter(function(p){return p[5]==="PERDU";}).length;
  var total = picks.filter(function(p){return p[5]!=="NOPICK" && p[5]!=="EN COURS" && p[5]!=="EN ATTENTE" && p[5]!=="ANNULE";}).length;
  var winrate = total > 0 ? Math.round((wins/total)*100) : 0;

  // ═══ ROI DYNAMIQUE ═══
  var miseFixe = 10;
  var bankrollDepart = 100;
  var gainsCumules = 0;
  picks.forEach(function(p){
    if (p[5] === "ANNULE") return;
    if (p[5] === "GAGNE") {
      var cote = parseFloat(p[3]) || 1.5;
      gainsCumules += (cote - 1) * miseFixe;
    } else if (p[5] === "PERDU") {
      gainsCumules -= miseFixe;
    }
  });
  var roiPct = Math.round((gainsCumules / bankrollDepart) * 100);

  // ═══ SÉRIES ═══
  var serieEnCours = 0;
  for (var i = 0; i < picks.length; i++) {
    if (picks[i][5] === "ANNULE") continue;
    if (picks[i][5] === "GAGNE") serieEnCours++;
    else if (picks[i][5] === "PERDU") break;
  }
  var meilleuresSerie = 0, tempSerie = 0;
  for (var j = picks.length - 1; j >= 0; j--) {
    if (picks[j][5] === "ANNULE") continue;
    if (picks[j][5] === "GAGNE") { tempSerie++; if (tempSerie > meilleuresSerie) meilleuresSerie = tempSerie; }
    else if (picks[j][5] === "PERDU") { tempSerie = 0; }
  }

  // ═══ PICK DU JOUR ═══
  var todayStr = new Date().toLocaleDateString("fr-FR", {day:"2-digit", month:"2-digit"});
  var pickAujourdhui = picks.find(function(p){ return p[5]==="EN ATTENTE" && p[0]===todayStr; });
  var prochainPick = pickAujourdhui || picks.slice().reverse().find(function(p){ return p[5]==="EN ATTENTE"; });
  var pickDuJour = prochainPick || picks[0];
  var isNoPick = !prochainPick && (picks[0][5]==="NOPICK" || picks[0][5]==="GAGNE" || picks[0][5]==="PERDU");
  var isEnAttente = pickDuJour[5]==="EN ATTENTE";
  var isToday = pickDuJour[0] === todayStr;
  var pickLabel = isEnAttente ? (isToday ? t("pick_du_jour") : t("prochain_match")) : isNoPick ? t("pas_de_match") : t("pick_du_jour");
  var pickThreshold = pickDuJour[8] || 8;
  var pickAiScore   = pickDuJour[7] || 0;
  var isPremium     = pickThreshold >= 8;
  var isStandard7   = pickThreshold === 7;
  var pickBadge     = isPremium ? t("pick_premium") : t("pick_standard");

  var filtered = filter === "ALL" ? picks : picks.filter(function(p){
    return p[5]==="NOPICK" || p[5]==="ANNULE" || p[5]==="EN COURS" || p[5]==="EN ATTENTE" || p[6]===filter;
  });

  // ── Teams pour mockup téléphone ──
  var matchTeams = (isNoPick ? "San Antonio Spurs vs New York Knicks" : pickDuJour[1]).split(" vs ");
  var team1 = matchTeams[0] || "San Antonio Spurs";
  var team2 = matchTeams[1] || "New York Knicks";

  // ══════════════════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════════════════
  var header = React.createElement("header", {
    style:{
      borderBottom:"1px solid "+C.border,
      padding:"14px 20px",
      display:"flex",
      justifyContent:"space-between",
      alignItems:"center",
      background:"rgba(10,10,10,0.92)",
      position:"sticky",
      top:0,
      zIndex:50,
      backdropFilter:"blur(20px)",
      WebkitBackdropFilter:"blur(20px)",
      flexWrap:"wrap",
      gap:"8px",
      maxWidth:"100%",
      overflowX:"hidden"
    }
  },
    React.createElement("div", {style:{cursor:"pointer",display:"flex",flexDirection:"column",gap:"1px"},onClick:function(){setPage("home");}},
      React.createElement("div", {
        style:{
          fontSize:"17px",
          fontWeight:"800",
          color:C.text,
          letterSpacing:"-0.03em",
          fontFamily:"Inter,system-ui,sans-serif",
          lineHeight:"1"
        }
      }, "TousLesMatchs"),
      React.createElement("div", {
        style:{
          fontSize:"9px",
          color:C.dim,
          letterSpacing:"0.18em",
          textTransform:"uppercase",
          fontFamily:"Inter,system-ui,sans-serif"
        }
      }, t("analyse_sous_menu"))
    ),
    React.createElement("nav", {className:"main-nav",style:{display:"flex",gap:"5px",alignItems:"center",flexWrap:"wrap",flex:1,justifyContent:"flex-end"}},
      ["home","preuves","bookmakers","calculateur","analyse"].map(function(p){
        var labels = {home:t("nav_choix"), preuves:t("nav_preuves"), bookmakers:t("nav_bookmakers"), calculateur:"Calculateur", analyse:t("nav_analyse")};
        var isActive = page === p;
        return React.createElement("button", {
          key:p,
          onClick:function(){setPage(p);},
          style:{
            background:isActive?"rgba(99,102,241,0.15)":"transparent",
            border:"1px solid "+(isActive?"rgba(99,102,241,0.4)":C.border),
            color:isActive?"#A5B4FC":C.muted,
            padding:"7px 13px",
            borderRadius:"8px",
            cursor:"pointer",
            fontSize:"12px",
            fontWeight:isActive?"600":"400",
            fontFamily:"Inter,system-ui,sans-serif",
            transition:"all 0.15s"
          }
        }, labels[p]);
      }),
      React.createElement("a", {
        href:TIKTOK_LINK,
        target:"_blank",
        style:{
          background:"rgba(255,255,255,0.04)",
          border:"1px solid "+C.border,
          borderRadius:"8px",
          padding:"7px 13px",
          color:C.muted,
          textDecoration:"none",
          fontSize:"12px",
          fontFamily:"Inter,system-ui,sans-serif"
        }
      }, "TikTok"),
      React.createElement("a", {
        href:TELEGRAM_LINK,
        target:"_blank",
        style:{
          background:"rgba(59,130,246,0.12)",
          border:"1px solid rgba(59,130,246,0.3)",
          borderRadius:"8px",
          padding:"7px 13px",
          color:"#93C5FD",
          textDecoration:"none",
          fontSize:"12px",
          fontWeight:"600",
          fontFamily:"Inter,system-ui,sans-serif"
        }
      }, "Telegram"),
      React.createElement("div",{
        className:"lang-flags",
        style:{display:"flex",gap:"3px",marginLeft:"4px",alignItems:"center"}
      },
        ["fr","en","es","it","ru"].map(function(l){
          var flags = {fr:"🇫🇷",en:"🇬🇧",es:"🇪🇸",it:"🇮🇹",ru:"🇷🇺"};
          return React.createElement("button",{
            key:l,
            title:l,
            onClick:function(){changeLang(l);},
            style:{
              background:lang===l?"rgba(99,102,241,0.15)":"transparent",
              border:"1px solid "+(lang===l?"rgba(99,102,241,0.3)":C.border),
              borderRadius:"6px",
              padding:"4px 6px",
              cursor:"pointer",
              fontSize:"14px",
              lineHeight:"1"
            }
          }, flags[l]);
        })
      )
    )
  );

  // ══════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════
  var footer = React.createElement("footer", {
    style:{
      borderTop:"1px solid "+C.border,
      padding:"32px 30px 90px",
      textAlign:"center",
      background:C.bg
    }
  },
    React.createElement("div", {
      style:{
        fontSize:"15px",
        fontWeight:"800",
        color:C.text,
        letterSpacing:"-0.03em",
        marginBottom:"16px",
        fontFamily:"Inter,system-ui,sans-serif"
      }
    }, "TousLesMatchs"),
    React.createElement("div", {style:{display:"flex",justifyContent:"center",gap:"18px",flexWrap:"wrap",marginBottom:"12px"}},
      React.createElement("button", {onClick:function(){setPage("cgu");}, style:{background:"transparent",border:"none",color:C.dim,fontSize:"11px",cursor:"pointer",textDecoration:"none",fontFamily:"Inter,system-ui,sans-serif",letterSpacing:"0.04em"}}, t("cgu")),
      React.createElement("button", {onClick:function(){setPage("mentions");}, style:{background:"transparent",border:"none",color:C.dim,fontSize:"11px",cursor:"pointer",fontFamily:"Inter,system-ui,sans-serif",letterSpacing:"0.04em"}}, t("mentions_legales")),
      React.createElement("button", {onClick:function(){setPage("confidentialite");}, style:{background:"transparent",border:"none",color:C.dim,fontSize:"11px",cursor:"pointer",fontFamily:"Inter,system-ui,sans-serif",letterSpacing:"0.04em"}}, t("confidentialite")),
      React.createElement("a", {href:TIKTOK_LINK,target:"_blank",style:{color:C.dim,fontSize:"11px",textDecoration:"none",fontFamily:"Inter,system-ui,sans-serif"}}, "TikTok"),
      React.createElement("a", {href:TELEGRAM_LINK,target:"_blank",style:{color:"rgba(99,102,241,0.7)",fontSize:"11px",textDecoration:"none",fontFamily:"Inter,system-ui,sans-serif"}}, "Telegram")
    ),
    React.createElement("div", {style:{fontSize:"10px",color:"rgba(255,255,255,0.1)",fontFamily:"Inter,system-ui,sans-serif"}}, t("footer_droits"))
  );

  var bandeauLegal = React.createElement("div", {
    style:{
      position:"fixed",bottom:0,left:0,right:0,
      background:"rgba(10,10,10,0.96)",
      borderTop:"1px solid "+C.border,
      padding:"6px 20px",
      textAlign:"center",
      zIndex:100,
      backdropFilter:"blur(10px)"
    }
  },
    React.createElement("div", {style:{fontSize:"10px",color:"rgba(255,255,255,0.2)",lineHeight:"1.8",fontFamily:"Inter,system-ui,sans-serif"}}, t("jeu_responsable")),
    React.createElement("div", {style:{fontSize:"9px",color:"rgba(255,255,255,0.07)",marginTop:"1px",fontFamily:"Inter,system-ui,sans-serif"}}, t("risques_financiers"))
  );

  // ══════════════════════════════════════════════════════════
  // PAGE ROUTING
  // ══════════════════════════════════════════════════════════
  if(page==="login") return React.createElement(React.Fragment, null, React.createElement(Login, {setPage:setPage}));
  if(page==="subscription") return React.createElement(React.Fragment, null, React.createElement(Subscription, {setPage:setPage}));
  if(page==="cgu") return React.createElement(React.Fragment, null, React.createElement(CGU, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal}));
  if(page==="mentions") return React.createElement(React.Fragment, null, React.createElement(MentionsLegales, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal}));
  if(page==="confidentialite") return React.createElement(React.Fragment, null, React.createElement(Confidentialite, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal}));
  if(page==="analyse") return React.createElement(React.Fragment, null, header, React.createElement(AnalyseLive, null), footer, bandeauLegal);
  if(page==="calculateur") return React.createElement(Calculateur, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal, header:header, picks:picks});

  // ── PAGE PREUVES ──
  if(page==="preuves"){
    return React.createElement("div", {style:{background:C.bg,minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:C.text}},
      header,
      React.createElement("div", {style:{maxWidth:"900px",margin:"0 auto",padding:"48px 24px"}},
        React.createElement("div", {style:{marginBottom:"32px"}},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"0.22em",textTransform:"uppercase",color:C.accent,fontWeight:"600",marginBottom:"10px"}}, "PREUVES DE PERFORMANCE"),
          React.createElement("h2", {style:{fontSize:"clamp(28px,4vw,42px)",fontWeight:"800",color:C.text,letterSpacing:"-0.02em",marginBottom:"10px",fontFamily:"Inter,system-ui,sans-serif"}}, t("preuves_title")),
          React.createElement("p", {style:{color:C.muted,fontSize:"15px",lineHeight:"1.7"}}, t("preuves_desc"))
        ),
        React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"16px"}},
          preuves.map(function(p,i){
            return React.createElement("div", {
              key:i,
              style:{
                background:C.card,
                border:"1px solid "+C.border,
                borderRadius:"16px",
                overflow:"hidden",
                transition:"border-color 0.2s,transform 0.2s"
              }
            },
              React.createElement("img", {
                src:p.img,alt:p.match,loading:"lazy",
                onError:function(e){e.target.style.display="none";e.target.nextSibling.style.display="flex";},
                style:{width:"100%",height:"280px",objectFit:"contain",background:"rgba(0,0,0,0.6)",display:"block"}
              }),
              React.createElement("div", {
                style:{
                  width:"100%",height:"280px",background:"rgba(255,255,255,0.02)",
                  display:"none",alignItems:"center",justifyContent:"center",
                  flexDirection:"column",gap:"8px"
                }
              },
                React.createElement("div", {style:{color:"rgba(255,255,255,0.15)",fontSize:"11px",letterSpacing:"2px"}}, t("capture_a_venir"))
              ),
              React.createElement("div", {style:{padding:"16px"}},
                React.createElement("div", {style:{fontSize:"11px",color:C.dim,marginBottom:"4px",fontWeight:"500"}}, p.date),
                React.createElement("div", {style:{fontSize:"14px",color:C.text,marginBottom:"8px",fontWeight:"600"}}, p.match),
                React.createElement("div", {style:{fontSize:"20px",fontWeight:"800",color:C.win,marginBottom:"10px",fontFamily:"Inter,system-ui,sans-serif"}}, p.gain),
                React.createElement("div", {
                  style:{
                    display:"flex",alignItems:"center",gap:"6px",
                    background:"rgba(16,185,129,0.06)",
                    border:"1px solid rgba(16,185,129,0.15)",
                    borderRadius:"8px",padding:"6px 10px"
                  }
                },
                  React.createElement("span", {style:{color:C.win,fontSize:"11px",fontWeight:"700"}}, "✓ Validé par le Concile"),
                  React.createElement("div", {style:{display:"flex",gap:"3px",marginLeft:"auto"}},
                    ["#22c55e","#3b82f6","#f59e0b","#a855f7","#ef4444","#e5c97e"].map(function(c,j){
                      return React.createElement("span", {key:j, style:{width:"6px",height:"6px",borderRadius:"50%",background:c,display:"inline-block"}});
                    })
                  )
                )
              )
            );
          })
        ),
        React.createElement("div", {
          style:{
            marginTop:"40px",padding:"28px",
            background:C.card,
            border:"1px solid "+C.border,
            borderRadius:"16px",textAlign:"center"
          }
        },
          React.createElement("p", {style:{color:C.muted,fontSize:"14px",margin:"0 0 16px",lineHeight:"1.7"}}, t("pariez_avec_nous")),
          React.createElement("a", {
            href:WINAMAX_LINK,target:"_blank",
            style:{
              display:"inline-block",
              background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",
              borderRadius:"10px",padding:"13px 32px",
              color:"#fff",fontWeight:"700",textDecoration:"none",
              fontSize:"14px",fontFamily:"Inter,system-ui,sans-serif"
            }
          }, t("ouvrir_compte"))
        )
      ),
      footer,
      bandeauLegal
    );
  }

  // ── PAGE BOOKMAKERS ──
  if(page==="bookmakers"){
    return React.createElement("div", {style:{background:C.bg,minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:C.text}},
      header,
      React.createElement("div", {style:{maxWidth:"860px",margin:"0 auto",padding:"48px 24px"}},
        React.createElement("div", {style:{marginBottom:"32px"}},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"0.22em",textTransform:"uppercase",color:C.accent,fontWeight:"600",marginBottom:"10px"}}, "NOS PARTENAIRES"),
          React.createElement("h2", {style:{fontSize:"clamp(28px,4vw,42px)",fontWeight:"800",color:C.text,letterSpacing:"-0.02em",marginBottom:"10px",fontFamily:"Inter,system-ui,sans-serif"}}, t("bookmakers_title")),
          React.createElement("p", {style:{color:C.muted,fontSize:"14px",marginBottom:"4px"}}, t("bookmakers_desc")),
          React.createElement("p", {style:{color:"rgba(255,255,255,0.2)",fontSize:"11px"}}, t("bookmakers_note"))
        ),
        React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"10px"}},
          bookmakers.map(function(b,i){
            return React.createElement("div", {
              key:i,
              style:{
                background:C.card,
                border:"1px solid "+C.border,
                borderRadius:"14px",padding:"20px 24px",
                display:"flex",justifyContent:"space-between",
                alignItems:"center",flexWrap:"wrap",gap:"16px"
              }
            },
              React.createElement("div", {style:{flex:1,minWidth:"200px"}},
                React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px",flexWrap:"wrap"}},
                  React.createElement("span", {style:{fontSize:"18px",fontWeight:"700",color:C.text,fontFamily:"Inter,system-ui,sans-serif"}}, b.nom),
                  React.createElement("span", {
                    style:{
                      background:"rgba(99,102,241,0.1)",
                      border:"1px solid rgba(99,102,241,0.25)",
                      borderRadius:"4px",padding:"2px 8px",
                      color:"#A5B4FC",fontSize:"9px",letterSpacing:"1px",fontWeight:"700"
                    }
                  }, b.badge),
                  React.createElement("span", {
                    style:{
                      background:"rgba(16,185,129,0.08)",
                      border:"1px solid rgba(16,185,129,0.2)",
                      borderRadius:"4px",padding:"2px 8px",
                      color:C.win,fontSize:"9px",fontWeight:"600"
                    }
                  }, b.bonus)
                ),
                React.createElement("p", {style:{color:C.dim,fontSize:"13px",margin:"0 0 5px",maxWidth:"420px",lineHeight:"1.6"}}, b.desc),
                React.createElement("span", {style:{color:C.accent,fontSize:"12px",fontWeight:"700"}}, "Note : "+b.note)
              ),
              React.createElement("div", {style:{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px",flexShrink:0}},
                React.createElement("a", {
                  href:b.link,target:"_blank",
                  style:{
                    background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",
                    borderRadius:"8px",padding:"11px 24px",
                    color:"#fff",fontWeight:"700",textDecoration:"none",
                    fontSize:"13px",whiteSpace:"nowrap",
                    fontFamily:"Inter,system-ui,sans-serif"
                  }
                }, t("sinscrire")),
                React.createElement("span", {style:{color:"rgba(255,255,255,0.12)",fontSize:"9px",letterSpacing:"1px"}}, t("lien_affilie"))
              )
            );
          })
        )
      ),
      footer,
      bandeauLegal
    );
  }

  // ══════════════════════════════════════════════════════════
  // HOME PAGE
  // ══════════════════════════════════════════════════════════
  return React.createElement("div", {
    style:{
      background:C.bg,
      minHeight:"100vh",
      fontFamily:"Inter,system-ui,sans-serif",
      color:C.text,
      overflowX:"hidden",
      width:"100%"
    }
  },
    header,

    // ════════════════════════════════════════
    // HERO — deux colonnes
    // ════════════════════════════════════════
    React.createElement("section", {className:"hero-split"},
      React.createElement("div", {className:"hero-bg-orbs"}),

      React.createElement("div", {className:"hero-inner"},

        // ── Colonne gauche ──
        React.createElement("div", {className:"hero-left"},

          // Pill eyebrow
          React.createElement("div", {className:"eyebrow-pill"},
            React.createElement("span", {
              style:{
                width:"6px",height:"6px",borderRadius:"50%",
                background:C.accent,display:"inline-block",
                marginRight:"8px",verticalAlign:"middle",
                animation:"blink 2s ease-in-out infinite"
              }
            }),
            "Concile IA V5 · 6 modèles indépendants"
          ),

          // H1
          React.createElement("h1", {className:"hero-h1"},
            lang==="fr" ? "Les meilleurs paris " :
            lang==="en" ? "The best bets " :
            lang==="es" ? "Los mejores picks " :
            lang==="it" ? "Le migliori scommesse " :
            "Лучшие ставки ",
            React.createElement("span", {className:"gradient-text"},
              lang==="fr" ? "détectés par l'IA" :
              lang==="en" ? "detected by AI" :
              lang==="es" ? "detectados por IA" :
              lang==="it" ? "rilevati dall'IA" :
              "обнаруженные ИИ"
            )
          ),

          // Description
          React.createElement("p", {className:"hero-desc"},
            lang==="fr"
              ? "Notre intelligence artificielle analyse des milliers de données pour identifier uniquement les opportunités les plus solides."
              : lang==="en"
              ? "Our AI analyzes thousands of data points to identify only the most solid betting opportunities."
              : "Nuestra IA analiza miles de datos para identificar solo las oportunidades más sólidas."
          ),

          // CTAs
          React.createElement("div", {className:"hero-cta-row"},
            React.createElement("a", {
              href:TELEGRAM_LINK,
              target:"_blank",
              style:{
                display:"inline-flex",alignItems:"center",gap:"8px",
                padding:"14px 28px",
                background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",
                color:"#fff",fontWeight:"700",textDecoration:"none",
                borderRadius:"10px",fontSize:"15px",
                boxShadow:"0 0 32px rgba(99,102,241,0.25)",
                fontFamily:"Inter,system-ui,sans-serif",
                whiteSpace:"nowrap"
              }
            }, lang==="fr"?"Essayer gratuitement →":"Try for free →"),
            React.createElement("button", {
              onClick:function(){
                var el=document.getElementById("pricing");
                if(el) el.scrollIntoView({behavior:"smooth"});
              },
              style:{
                display:"inline-flex",alignItems:"center",gap:"8px",
                padding:"14px 22px",
                background:"transparent",
                color:C.muted,fontWeight:"500",
                borderRadius:"10px",fontSize:"14px",
                border:"1px solid "+C.border,cursor:"pointer",
                fontFamily:"Inter,system-ui,sans-serif",
                whiteSpace:"nowrap"
              }
            }, lang==="fr"?"Voir les abonnements":"See plans")
          ),

          // Stats 2×2
          React.createElement("div", {
            style:{
              display:"grid",gridTemplateColumns:"1fr 1fr",
              maxWidth:"460px",marginTop:"36px",
              border:"1px solid "+C.border,
              borderRadius:"14px",overflow:"hidden"
            }
          },
            [
              {label:"Taux de réussite", value:winrate+"%", sub:total+" paris"},
              {label:"ROI", value:(roiPct>=0?"+":"")+roiPct+"%", sub:"depuis le lancement"},
              {label:"Victoires", value:wins, sub:losses+" défaites / "+total},
              {label:"Série en cours", value:serieEnCours+"W", sub:"🏆 record "+meilleuresSerie},
            ].map(function(s,k){
              return React.createElement("div", {
                key:k,
                style:{
                  padding:"16px 14px",
                  borderRight:k%2===0?"1px solid "+C.border:"none",
                  borderBottom:k<2?"1px solid "+C.border:"none",
                  textAlign:"center",
                  background:"rgba(255,255,255,0.015)"
                }
              },
                React.createElement("div", {
                  style:{fontSize:"9px",color:C.dim,letterSpacing:"0.18em",marginBottom:"4px",textTransform:"uppercase",fontWeight:"600"}
                }, s.label),
                React.createElement("div", {
                  style:{
                    fontSize:"24px",fontWeight:"800",
                    color: k===0 ? C.accent : C.text,
                    fontFamily:"Inter,system-ui,sans-serif",lineHeight:"1"
                  }
                }, s.value),
                React.createElement("div", {style:{fontSize:"10px",color:"rgba(255,255,255,0.22)",marginTop:"3px"}}, s.sub)
              );
            })
          )
        ),

        // ── Colonne droite : téléphone ──
        React.createElement("div", {className:"hero-right"},
          React.createElement("div", {className:"phone-3d"+(isEnAttente?" pick-live":"")},
            React.createElement("div", {className:"phone-3d-notch"}),
            React.createElement("div", {className:"phone-3d-screen"},

              // En-tête téléphone
              React.createElement("div", {className:"phone-header-row"},
                React.createElement("div", {className:"phone-logo"}, "TousLesMatchs"),
                React.createElement("div", {className:"phone-hermes-badge"},
                  React.createElement("span", {
                    style:{
                      width:"5px",height:"5px",borderRadius:"50%",
                      background:C.win,display:"inline-block",marginRight:"5px",
                      verticalAlign:"middle"
                    }
                  }),
                  "HERMÈS"
                )
              ),

              // Match
              React.createElement("div", {className:"phone-match-block"},
                React.createElement("div", {className:"phone-team-line"}, team1),
                React.createElement("div", {className:"phone-vs"}, "VS"),
                React.createElement("div", {className:"phone-team-line"}, team2)
              ),

              // Pari recommandé
              !isNoPick && React.createElement("div", {className:"phone-bet-block"},
                React.createElement("div", {className:"phone-bet-type"}, "PARI RECOMMANDÉ"),
                React.createElement("div", {className:"phone-bet-name"}, pickDuJour[2]),
                React.createElement("div", {
                  style:{fontSize:"11px",color:C.accentBlue,marginTop:"3px",fontWeight:"600"}
                }, "Cote : "+pickDuJour[3])
              ),

              // Score de confiance
              !isNoPick && pickAiScore > 0 && React.createElement("div", {className:"phone-confidence-block"},
                React.createElement("div", {
                  style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}
                },
                  React.createElement("span", {className:"phone-conf-label"}, "CONFIANCE HERMÈS"),
                  React.createElement("span", {className:"phone-conf-score-big"}, pickAiScore+"/10")
                ),
                React.createElement("div", {className:"phone-conf-bar-track"},
                  React.createElement("div", {
                    className:"phone-conf-bar-fill",
                    style:{width:(pickAiScore/10*100)+"%"}
                  })
                )
              ),

              // Badge validé
              !isNoPick && React.createElement("div", {className:"phone-validated-badge"},
                "✓ VALIDÉ PAR HERMÈS"
              ),

              // Dots IA
              React.createElement("div", {className:"ai-dots-row"},
                [
                  {c:"#22c55e",n:"Groq"},
                  {c:"#3b82f6",n:"Gemini"},
                  {c:"#f97316",n:"DeepSeek"},
                  {c:"#a855f7",n:"Mistral"},
                  {c:"#ef4444",n:"Qwen"},
                  {c:"#e5c97e",n:"Claude"}
                ].map(function(d,k){
                  return React.createElement("div", {
                    key:k,
                    title:d.n,
                    style:{
                      width:"7px",height:"7px",borderRadius:"50%",
                      background:d.c,flexShrink:0
                    }
                  });
                })
              )
            )
          )
        )

      )
    ),

    // ════════════════════════════════════════
    // SECTION PIPELINE IA HERMÈS
    // ════════════════════════════════════════
    React.createElement("section", {className:"ai-pipeline-section"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("div", {style:{textAlign:"center",marginBottom:"48px"}},
          React.createElement("div", {className:"section-eyebrow"}, "COMMENT ÇA FONCTIONNE"),
          React.createElement("h2", {className:"section-h2"},
            lang==="fr" ? "Comment Hermès analyse chaque match" : "How Hermès analyzes every match"
          ),
          React.createElement("p", {className:"section-sub"},
            lang==="fr"
              ? "Un processus rigoureux en 5 étapes pour ne publier que les meilleurs picks."
              : "A rigorous 5-step process to publish only the best picks."
          )
        ),
        React.createElement("div", {className:"pipeline-steps"},
          [
            {
              num:"01",icon:"🔍",
              title:"Collecte des données",
              desc:"30+ sources en temps réel : statistiques, blessures, forme récente, confrontations historiques, contexte de compétition"
            },
            {
              num:"02",icon:"🧠",
              title:"Analyse multi-IA",
              desc:"6 intelligences artificielles indépendantes analysent chaque variable sans se consulter : Groq, Gemini, DeepSeek, Mistral, Qwen, Claude"
            },
            {
              num:"03",icon:"⚖️",
              title:"Délibération du Concile",
              desc:"Les 6 IA votent et challengent mutuellement leurs analyses. Hermès synthétise le consensus et identifie les divergences"
            },
            {
              num:"04",icon:"📊",
              title:"Score de confiance",
              desc:"Un score final de 0 à 10 est calculé. Le seuil minimum est 7/10 — qualité absolue avant quantité"
            },
            {
              num:"05",icon:"✅",
              title:"Validation finale",
              desc:"Un seul pick par jour. Jamais de match amical, jamais sans enjeu réel. Le test du sommeil est obligatoire avant publication"
            },
          ].map(function(s,k){
            return React.createElement("div", {key:k, className:"pipeline-step"},
              React.createElement("div", {className:"pipeline-step-num"}, s.num),
              React.createElement("div", {className:"pipeline-step-icon"}, s.icon),
              React.createElement("div", {className:"pipeline-step-title"}, s.title),
              React.createElement("div", {className:"pipeline-step-desc"}, s.desc)
            );
          })
        )
      )
    ),

    // ════════════════════════════════════════
    // PICK DU JOUR
    // ════════════════════════════════════════
    React.createElement("section", {
      className:"home-section",
      style:{padding:"10px 20px 24px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}
    },
      React.createElement("div", {
        style:{
          background: isNoPick ? "rgba(255,255,255,0.02)" : isPremium ? "rgba(99,102,241,0.06)" : "rgba(245,158,11,0.05)",
          border: "1px solid " + (isNoPick ? C.border : isPremium ? "rgba(99,102,241,0.3)" : "rgba(245,158,11,0.4)"),
          borderRadius:"16px", padding:"24px", position:"relative", overflow:"hidden"
        }
      },

        // Bandeau top
        !isNoPick && React.createElement("div", {
          style:{
            position:"absolute",top:0,left:0,right:0,height:"2px",
            background: isPremium
              ? "linear-gradient(90deg,transparent,#6366F1,transparent)"
              : "linear-gradient(90deg,transparent,#F59E0B,transparent)"
          }
        }),

        // Badge Premium/Standard
        !isNoPick && React.createElement("div", {
          style:{
            display:"inline-flex",alignItems:"center",gap:"6px",
            background: isPremium ? "rgba(99,102,241,0.12)" : "rgba(245,158,11,0.1)",
            border: "1px solid " + (isPremium ? "rgba(99,102,241,0.35)" : "rgba(245,158,11,0.4)"),
            borderRadius:"6px",padding:"3px 10px",
            fontSize:"9px",fontWeight:"700",letterSpacing:"2px",
            color: isPremium ? "#A5B4FC" : "#FCD34D",
            marginBottom:"12px",
            fontFamily:"Inter,system-ui,sans-serif"
          }
        }, pickBadge),

        // Label
        React.createElement("div", {
          style:{
            fontSize:"10px",letterSpacing:"4px",color:isNoPick?"rgba(255,255,255,0.2)":isEnAttente?"#F59E0B":isPremium?C.accent:"#FCD34D",
            marginBottom:"8px",textTransform:"uppercase",fontWeight:"600",fontFamily:"Inter,system-ui,sans-serif"
          }
        }, pickLabel),

        // Match
        React.createElement("div", {
          style:{
            fontSize:"20px",fontWeight:"700",color:isNoPick?C.dim:C.text,
            marginBottom:"10px",fontStyle:isNoPick?"italic":"normal",
            fontFamily:"Inter,system-ui,sans-serif",letterSpacing:"-0.01em"
          }
        },
          isNoPick
            ? t("no_match_today")
            : (!isNoPick && pickDuJour[6]) ? sportEmoji(pickDuJour[6])+pickDuJour[1] : pickDuJour[1]
        ),

        // Message NOPICK
        isNoPick && React.createElement("div", {
          style:{
            background:"rgba(255,255,255,0.02)",
            border:"1px solid "+C.border,
            borderRadius:"10px",
            padding:"14px 16px",
            marginBottom:"14px",
            fontSize:"13px",
            color:C.muted,
            lineHeight:"1.6",
            fontFamily:"Inter,system-ui,sans-serif"
          }
        },
          React.createElement("strong", {style:{color:C.text}}, "⚖️ Discipline avant volume. "),
          "Hermès attend la reprise des compétitions sérieuses. Tant qu'aucun match ne passe notre checklist 6 points, ",
          React.createElement("em", null, "aucun pick aveugle ne sera publié"),
          ". Mieux vaut zéro pari qu'un pari faible."
        ),

        // Marché + Cote
        isNoPick ? null : React.createElement("div", {
          style:{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap",marginBottom:"16px"}
        },
          React.createElement("span", {
            style:{
              background:"rgba(99,102,241,0.1)",
              border:"1px solid rgba(99,102,241,0.25)",
              borderRadius:"6px",padding:"5px 14px",
              color:"#A5B4FC",fontSize:"12px",fontWeight:"700",letterSpacing:"0.04em",
              fontFamily:"Inter,system-ui,sans-serif"
            }
          }, pickDuJour[2]),
          React.createElement("span", {
            style:{color:C.text,fontWeight:"800",fontSize:"20px",fontFamily:"Inter,system-ui,sans-serif"}
          }, "×"+pickDuJour[3])
        ),

        // Panel Concile V5
        isNoPick ? null : React.createElement("div", {
          style:{
            background:"rgba(255,255,255,0.02)",
            border:"1px solid "+C.border,
            borderRadius:"10px",padding:"12px 16px",marginBottom:"14px"
          }
        },
          React.createElement("div", {
            style:{
              fontSize:"10px",letterSpacing:"0.2em",color:C.dim,
              marginBottom:"12px",fontWeight:"600",textTransform:"uppercase",
              fontFamily:"Inter,system-ui,sans-serif"
            }
          }, t("concile_title")),
          React.createElement("div", {style:{display:"flex",gap:"5px",flexWrap:"wrap",alignItems:"center",marginBottom:"10px"}},
            [
              {nom:"Groq",    color:"#22c55e", role:"Scanner"},
              {nom:"Gemini",  color:"#3b82f6", role:"H2H"},
              {nom:"DeepSeek",color:"#f97316", role:"Forme"},
              {nom:"Mistral", color:"#a855f7", role:"Contexte"},
              {nom:"Qwen",    color:"#ef4444", role:"Value"},
              {nom:"Claude",  color:"#e5c97e", role:"Chef ★"},
            ].map(function(ia,k){
              return React.createElement("div", {
                key:k,
                style:{
                  display:"flex",alignItems:"center",gap:"5px",
                  background:"rgba(255,255,255,0.03)",
                  border:"1px solid "+C.border,
                  borderRadius:"6px",padding:"4px 9px"
                }
              },
                React.createElement("div", {style:{width:"5px",height:"5px",borderRadius:"50%",background:ia.color,flexShrink:0}}),
                React.createElement("span", {style:{fontSize:"12px",color:C.muted,fontWeight:"600",fontFamily:"Inter,system-ui,sans-serif"}}, ia.nom),
                React.createElement("span", {style:{fontSize:"10px",color:C.dim,marginLeft:"2px",fontFamily:"Inter,system-ui,sans-serif"}}, ia.role),
                React.createElement("span", {style:{fontSize:"11px",color:C.win,marginLeft:"4px",fontWeight:"700"}}, "GO")
              );
            })
          ),
          pickAiScore > 0 && React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"10px"}},
            React.createElement("span", {style:{fontSize:"9px",color:C.dim,letterSpacing:"0.06em",whiteSpace:"nowrap",textTransform:"uppercase",fontFamily:"Inter,system-ui,sans-serif"}}, t("confiance_ia")),
            React.createElement("div", {
              style:{flex:1,height:"4px",background:"rgba(255,255,255,0.05)",borderRadius:"2px",overflow:"hidden",maxWidth:"160px"}
            },
              React.createElement("div", {
                style:{
                  height:"100%",borderRadius:"2px",
                  width:(pickAiScore/10*100)+"%",
                  background: isPremium
                    ? "linear-gradient(90deg,#3B82F6,#8B5CF6)"
                    : "linear-gradient(90deg,#92400e,#F59E0B)"
                }
              })
            ),
            React.createElement("span", {
              style:{fontSize:"13px",fontWeight:"800",color:isPremium?C.accent:"#FCD34D",fontFamily:"Inter,system-ui,sans-serif"}
            }, pickAiScore+"/10")
          )
        ),

        // Avertissement 7/10
        isStandard7 && !isNoPick && React.createElement("div", {
          style:{
            background:"rgba(245,158,11,0.06)",
            border:"1px solid rgba(245,158,11,0.2)",
            borderRadius:"8px",padding:"10px 14px",marginBottom:"14px"
          }
        },
          React.createElement("div", {style:{fontSize:"11px",color:"#FCD34D",fontWeight:"700",marginBottom:"3px",fontFamily:"Inter,system-ui,sans-serif"}}, t("seuil_abaisse")),
          React.createElement("div", {style:{fontSize:"11px",color:C.muted,lineHeight:"1.6",fontFamily:"Inter,system-ui,sans-serif"}}, t("seuil_abaisse_desc"))
        ),

        // Urgence
        isEnAttente && !isNoPick && React.createElement("div", {
          style:{
            display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px",
            background:"rgba(239,68,68,0.05)",
            border:"1px solid rgba(239,68,68,0.18)",
            borderRadius:"8px",padding:"8px 14px"
          }
        },
          React.createElement("div", {
            style:{width:"7px",height:"7px",borderRadius:"50%",background:"#EF4444",flexShrink:0,boxShadow:"0 0 6px #EF4444"}
          }),
          React.createElement("span", {
            style:{fontSize:"11px",color:"rgba(239,68,68,0.8)",fontWeight:"600",fontFamily:"Inter,system-ui,sans-serif"}
          }, "⏰ Pick valable aujourd'hui seulement — expire à minuit")
        ),

        // CTA
        isNoPick ? null : React.createElement("a", {
          href:WINAMAX_LINK,target:"_blank",
          style:{
            display:"inline-flex",alignItems:"center",justifyContent:"center",
            background: isPremium
              ? "linear-gradient(135deg,#3B82F6,#8B5CF6)"
              : "linear-gradient(135deg,#F59E0B,#FCD34D)",
            borderRadius:"10px",padding:"11px 24px",
            color: isPremium ? "#fff" : "#000",
            fontWeight:"700",textDecoration:"none",
            fontSize:"14px",fontFamily:"Inter,system-ui,sans-serif",
            width:"100%",maxWidth:"360px"
          }
        }, t("parier_winamax"))
      )
    ),

    // ════════════════════════════════════════
    // COMMENT ÇA MARCHE (3 cards)
    // ════════════════════════════════════════
    React.createElement("section", {
      className:"home-section",
      style:{padding:"10px 20px 30px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}
    },
      React.createElement("h2", {
        style:{
          color:C.accent,fontSize:"10px",letterSpacing:"0.22em",textAlign:"center",
          marginBottom:"24px",fontFamily:"Inter,system-ui,sans-serif",fontWeight:"600",textTransform:"uppercase"
        }
      }, t("comment_marche")),
      React.createElement("div", {style:{display:"flex",gap:"12px",flexWrap:"wrap"}},
        [
          {num:t("section_01"),title:t("section_01_title"),desc:t("section_01_desc")},
          {num:t("section_02"),title:t("section_02_title"),desc:t("section_02_desc")},
          {num:t("section_03"),title:t("section_03_title"),desc:t("section_03_desc")}
        ].map(function(s,k){
          return React.createElement("div",{
            key:k,
            style:{
              flex:1,minWidth:"200px",
              background:C.card,
              border:"1px solid "+C.border,
              borderRadius:"14px",padding:"22px 20px"
            }
          },
            React.createElement("div",{
              style:{
                fontSize:"32px",fontWeight:"800",color:"rgba(99,102,241,0.2)",
                marginBottom:"10px",fontFamily:"Inter,system-ui,sans-serif",lineHeight:"1"
              }
            },s.num),
            React.createElement("div",{
              style:{fontSize:"16px",fontWeight:"700",color:C.text,marginBottom:"8px",fontFamily:"Inter,system-ui,sans-serif"}
            },s.title),
            React.createElement("div",{
              style:{fontSize:"14px",color:C.muted,lineHeight:"1.75",fontFamily:"Inter,system-ui,sans-serif"}
            },s.desc)
          );
        })
      )
    ),

    // ════════════════════════════════════════
    // TARIFS
    // ════════════════════════════════════════
    React.createElement("section", {
      id:"pricing",
      className:"home-section",
      style:{padding:"30px 20px",maxWidth:"860px",margin:"0 auto",width:"100%",boxSizing:"border-box"}
    },
      React.createElement("h2", {
        style:{
          color:C.accent,fontSize:"10px",letterSpacing:"0.22em",textAlign:"center",
          marginBottom:"8px",fontFamily:"Inter,system-ui,sans-serif",fontWeight:"600",textTransform:"uppercase"
        }
      }, "NOS FORMULES"),
      React.createElement("p", {
        style:{
          color:C.muted,fontSize:"14px",textAlign:"center",marginBottom:"28px",
          fontFamily:"Inter,system-ui,sans-serif"
        }
      }, "Commencez gratuitement — passez Premium quand vous êtes prêt."),
      React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"14px"}},
        [
          {
            label:"GRATUIT", price:"0€", sub:"pour toujours",
            features:["1 pick ARJEL / jour","Winamax, Betclic, PMU","Canal @TousLesMatchs Free","Calculateur de projection"],
            cta:"Commencer gratuitement", ctaUrl:null, highlight:false
          },
          {
            label:"STANDARD", price:"9,90€", sub:"/ mois",
            features:["1 pick ARJEL prioritaire","Alertes Telegram instantanées","Statistiques avancées","Historique complet des picks"],
            cta:"Essayer Standard", ctaUrl:"https://buy.stripe.com/4gM3cv4Je9ZG2RK3GS3VC00", highlight:false, badge:"NOUVEAU"
          },
          {
            label:"PREMIUM", price:"19,90€", sub:"/ mois",
            features:["Tout Standard inclus","1 pick HORS-ARJEL (Pinnacle)","Cotes supérieures vs France","Canal Premium privé"],
            cta:"Devenir Premium", ctaUrl:"https://buy.stripe.com/9B64gzgrW2xe2RK4KW3VC01", highlight:true, badge:"MEILLEURE VALEUR"
          }
        ].map(function(plan,k){
          return React.createElement("div", {
            key:k,
            style:{
              background: plan.highlight
                ? "linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.06))"
                : C.card,
              border: "1px solid " + (plan.highlight ? "rgba(99,102,241,0.4)" : C.border),
              borderRadius:"16px",padding:"24px 20px",position:"relative",
              boxShadow: plan.highlight ? "0 0 32px rgba(99,102,241,0.12)" : "none"
            }
          },
            plan.badge && React.createElement("div", {
              style:{
                position:"absolute",top:"-10px",left:"50%",transform:"translateX(-50%)",
                background: plan.highlight
                  ? "linear-gradient(135deg,#3B82F6,#8B5CF6)"
                  : "rgba(255,255,255,0.08)",
                color: plan.highlight ? "#fff" : C.muted,
                padding:"3px 12px",borderRadius:"20px",fontSize:"9px",
                fontWeight:"700",letterSpacing:"1px",whiteSpace:"nowrap",
                fontFamily:"Inter,system-ui,sans-serif"
              }
            }, plan.badge),
            React.createElement("div", {
              style:{
                fontSize:"10px",
                color: plan.highlight ? "#A5B4FC" : C.dim,
                letterSpacing:"0.2em",marginBottom:"8px",fontWeight:"700",
                textTransform:"uppercase",fontFamily:"Inter,system-ui,sans-serif"
              }
            }, plan.label),
            React.createElement("div", {style:{display:"flex",alignItems:"baseline",gap:"4px",marginBottom:"4px"}},
              React.createElement("span", {
                style:{
                  fontSize:"34px",fontWeight:"800",
                  color: plan.highlight ? "#fff" : C.text,
                  fontFamily:"Inter,system-ui,sans-serif",letterSpacing:"-0.03em"
                }
              }, plan.price),
              React.createElement("span", {style:{fontSize:"13px",color:C.dim,fontFamily:"Inter,system-ui,sans-serif"}}, plan.sub)
            ),
            React.createElement("div", {style:{borderTop:"1px solid "+C.border,margin:"16px 0"}}),
            React.createElement("ul", {style:{listStyle:"none",padding:0,margin:"0 0 20px",display:"flex",flexDirection:"column",gap:"8px"}},
              plan.features.map(function(f,m){
                return React.createElement("li", {
                  key:m,
                  style:{display:"flex",alignItems:"center",gap:"8px",fontSize:"13px",color:C.muted,fontFamily:"Inter,system-ui,sans-serif"}
                },
                  React.createElement("span", {style:{color:C.win,flexShrink:0,fontWeight:"700"}}, "✓"),
                  f
                );
              })
            ),
            React.createElement("button", {
              onClick:function(){ if(plan.ctaUrl) window.location.href=plan.ctaUrl; },
              style:{
                width:"100%",padding:"13px",borderRadius:"10px",border:"none",
                cursor: plan.ctaUrl ? "pointer" : "default",
                background: plan.highlight
                  ? "linear-gradient(135deg,#3B82F6,#8B5CF6)"
                  : plan.ctaUrl ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                color: plan.highlight ? "#fff" : plan.ctaUrl ? C.text : C.dim,
                fontWeight:"700",fontSize:"13px",letterSpacing:"0.03em",
                fontFamily:"Inter,system-ui,sans-serif"
              }
            }, plan.cta)
          );
        })
      )
    ),

    // ════════════════════════════════════════
    // CANAL TELEGRAM
    // ════════════════════════════════════════
    React.createElement("section", {
      className:"home-section",
      style:{padding:"10px 20px 24px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}
    },
      React.createElement("div", {
        style:{
          background:"rgba(59,130,246,0.06)",
          border:"1px solid rgba(59,130,246,0.2)",
          borderRadius:"16px",padding:"28px 32px",
          display:"flex",alignItems:"center",justifyContent:"space-between",
          flexWrap:"wrap",gap:"16px"
        }
      },
        React.createElement("div", {style:{flex:1,minWidth:"200px"}},
          React.createElement("div",{
            style:{
              display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"
            }
          },
            React.createElement("div",{style:{width:"8px",height:"8px",borderRadius:"50%",background:"#93C5FD",flexShrink:0}}),
            React.createElement("span",{
              style:{
                fontSize:"10px",letterSpacing:"0.2em",color:"#93C5FD",fontWeight:"700",
                textTransform:"uppercase",fontFamily:"Inter,system-ui,sans-serif"
              }
            },t("canal_telegram"))
          ),
          React.createElement("div",{
            style:{
              fontSize:"20px",fontWeight:"700",color:C.text,marginBottom:"6px",
              fontFamily:"Inter,system-ui,sans-serif",letterSpacing:"-0.02em"
            }
          },t("recois_pick")),
          React.createElement("div",{
            style:{fontSize:"13px",color:C.muted,marginBottom:"10px",fontFamily:"Inter,system-ui,sans-serif"}
          },t("chaque_matin")),
          React.createElement("div",{style:{display:"flex",gap:"6px",flexWrap:"wrap"}},
            ["Winamax","Betclic","Unibet","PMU"].map(function(bk){
              return React.createElement("span",{
                key:bk,
                style:{
                  fontSize:"10px",
                  background:"rgba(255,255,255,0.04)",
                  border:"1px solid "+C.border,
                  borderRadius:"4px",padding:"2px 8px",
                  color:C.dim,fontFamily:"Inter,system-ui,sans-serif"
                }
              },bk);
            })
          )
        ),
        React.createElement("a",{
          href:TELEGRAM_LINK,target:"_blank",
          style:{
            background:"linear-gradient(135deg,#2563EB,#3B82F6)",
            borderRadius:"10px",padding:"14px 26px",color:"#fff",fontWeight:"700",
            textDecoration:"none",fontSize:"14px",whiteSpace:"nowrap",
            display:"inline-flex",alignItems:"center",gap:"8px",flexShrink:0,
            boxShadow:"0 4px 20px rgba(59,130,246,0.3)",
            fontFamily:"Inter,system-ui,sans-serif"
          }
        },t("rejoindre_telegram"))
      )
    ),

    // ════════════════════════════════════════
    // HISTORIQUE PICKS
    // ════════════════════════════════════════
    React.createElement("section", {
      className:"home-section",
      style:{padding:"10px 20px 30px",maxWidth:"980px",margin:"0 auto",width:"100%",boxSizing:"border-box"}
    },
      React.createElement("div", {
        style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}
      },
        React.createElement("h2", {
          style:{
            color:C.text,fontSize:"14px",fontWeight:"700",letterSpacing:"-0.01em",
            margin:0,fontFamily:"Inter,system-ui,sans-serif"
          }
        }, t("historique_picks")),
        React.createElement("div", {style:{display:"flex",gap:"5px",flexWrap:"wrap"}},
          [{key:"ALL",label:t("tous")},{key:"Foot",label:t("foot")},{key:"Hockey",label:t("hockey")},{key:"Basket",label:t("basket")}].map(function(f){
            return React.createElement("button", {
              key:f.key,
              onClick:function(){setFilter(f.key);},
              style:{
                background:filter===f.key?"rgba(99,102,241,0.15)":"transparent",
                border:"1px solid "+(filter===f.key?"rgba(99,102,241,0.4)":C.border),
                color:filter===f.key?"#A5B4FC":C.dim,
                padding:"5px 12px",borderRadius:"6px",cursor:"pointer",
                fontSize:"12px",fontFamily:"Inter,system-ui,sans-serif",fontWeight:filter===f.key?"600":"400"
              }
            }, f.label);
          })
        )
      ),
      React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"4px"}},
        filtered.map(function(p,k){
          var g=p[5]==="GAGNE", np=p[5]==="NOPICK", ec=p[5]==="EN COURS", ea=p[5]==="EN ATTENTE", an=p[5]==="ANNULE";
          var statusColor = np||an ? C.dim : (ec||ea) ? C.pending : g ? C.win : C.loss;
          var label = an ? "⚠️ amical" : (np?"---":ec?t("a_venir"):ea?t("en_attente"):g?t("gagne"):t("perdu"));
          var matchDisplay = (!np&&p[6]) ? sportEmoji(p[6])+p[1] : p[1];
          return React.createElement("div", {
            key:k,
            style:{
              display:"flex",alignItems:"center",padding:"10px 14px",
              background: np||an ? "rgba(255,255,255,0.015)" : (ec||ea) ? "rgba(245,158,11,0.04)" : g ? "rgba(16,185,129,0.04)" : "rgba(239,68,68,0.04)",
              border: "1px solid " + (np||an ? C.border : (ec||ea) ? "rgba(245,158,11,0.2)" : g ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"),
              borderRadius:"8px",gap:"10px",flexWrap:"wrap"
            }
          },
            React.createElement("span", {style:{color:C.dim,fontSize:"11px",minWidth:"40px",flexShrink:0,fontFamily:"Inter,system-ui,sans-serif"}}, p[0]),
            React.createElement("span", {
              style:{
                color:np?C.dim:C.text,fontSize:"13px",flex:"1",minWidth:"120px",
                fontStyle:np?"italic":"normal",fontFamily:"Inter,system-ui,sans-serif",fontWeight:"500"
              }
            }, matchDisplay),
            React.createElement("span", {
              style:{
                background:"rgba(255,255,255,0.04)",
                border:"1px solid "+C.border,
                borderRadius:"4px",padding:"2px 7px",
                color:np?C.dim:C.muted,fontSize:"10px",
                minWidth:"70px",textAlign:"center",flexShrink:0,
                fontFamily:"Inter,system-ui,sans-serif",fontWeight:"600"
              }
            }, p[2]),
            React.createElement("span", {style:{color:np?C.dim:C.text,fontWeight:"700",minWidth:"30px",fontSize:"13px",flexShrink:0,fontFamily:"Inter,system-ui,sans-serif"}}, p[3]),
            React.createElement("span", {style:{color:C.dim,fontSize:"12px",minWidth:"30px",flexShrink:0,fontFamily:"Inter,system-ui,sans-serif"}}, p[4]),
            React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"5px",minWidth:"80px",flexShrink:0}},
              React.createElement("div", {style:{width:"7px",height:"7px",borderRadius:"50%",background:statusColor,flexShrink:0}}),
              React.createElement("span", {style:{color:statusColor,fontWeight:"700",fontSize:"11px",fontFamily:"Inter,system-ui,sans-serif"}}, label)
            )
          );
        })
      )
    ),

    // ════════════════════════════════════════
    // TÉMOIGNAGES
    // ════════════════════════════════════════
    React.createElement("section", {
      style:{padding:"10px 20px 30px",maxWidth:"780px",margin:"0 auto"}
    },
      React.createElement("h2", {
        style:{
          color:C.text,fontSize:"14px",fontWeight:"700",letterSpacing:"-0.01em",
          marginBottom:"16px",fontFamily:"Inter,system-ui,sans-serif"
        }
      }, t("ils_gagnent")),
      React.createElement("div", {style:{display:"flex",gap:"12px",flexWrap:"wrap"}},
        temoignages.map(function(tm,k){
          return React.createElement("div",{
            key:k,
            style:{
              flex:1,minWidth:"200px",
              background:C.card,
              border:"1px solid "+C.border,
              borderRadius:"14px",padding:"18px 16px"
            }
          },
            React.createElement("div",{
              style:{
                fontSize:"13px",color:C.muted,lineHeight:"1.7",
                marginBottom:"14px",fontStyle:"italic",
                fontFamily:"Inter,system-ui,sans-serif"
              }
            },"\""+tm.txt+"\""),
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
              React.createElement("div",null,
                React.createElement("div",{style:{fontSize:"13px",color:C.text,fontWeight:"700",fontFamily:"Inter,system-ui,sans-serif"}},tm.nom),
                React.createElement("div",{style:{fontSize:"10px",color:C.dim,fontFamily:"Inter,system-ui,sans-serif"}},tm.ville)
              ),
              React.createElement("div",{style:{fontSize:"16px",fontWeight:"800",color:C.win,fontFamily:"Inter,system-ui,sans-serif"}},tm.gains)
            )
          );
        })
      )
    ),

    // ════════════════════════════════════════
    // FAQ
    // ════════════════════════════════════════
    React.createElement("section", {
      className:"home-section",
      style:{padding:"10px 20px 30px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}
    },
      React.createElement("h2", {
        style:{
          color:C.text,fontSize:"14px",fontWeight:"700",letterSpacing:"-0.01em",
          marginBottom:"16px",fontFamily:"Inter,system-ui,sans-serif"
        }
      }, t("questions_frequentes")),
      React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"4px"}},
        faqs.map(function(f,k){
          var open=faqOpen===k;
          return React.createElement("div",{
            key:k,
            style:{
              background:C.card,
              border:"1px solid "+(open?"rgba(99,102,241,0.25)":C.border),
              borderRadius:"10px",overflow:"hidden"
            }
          },
            React.createElement("button",{
              onClick:function(){setFaqOpen(open?null:k);},
              style:{
                width:"100%",background:"transparent",border:"none",
                padding:"14px 16px",display:"flex",justifyContent:"space-between",
                alignItems:"center",cursor:"pointer",textAlign:"left",
                fontFamily:"Inter,system-ui,sans-serif"
              }
            },
              React.createElement("span",{style:{color:C.text,fontSize:"14px",fontWeight:"500"}},f.q),
              React.createElement("span",{
                style:{
                  color:open?C.accent:C.dim,
                  fontSize:"20px",fontWeight:"300",marginLeft:"12px",flexShrink:0,
                  transform:open?"rotate(45deg)":"none",transition:"transform 0.2s"
                }
              },"+")
            ),
            open ? React.createElement("div",{
              style:{
                padding:"0 16px 16px",color:C.muted,fontSize:"13px",
                lineHeight:"1.75",fontFamily:"Inter,system-ui,sans-serif",
                borderTop:"1px solid "+C.border
              }
            },f.a) : null
          );
        })
      )
    ),

    // ════════════════════════════════════════
    // CTA FINAL
    // ════════════════════════════════════════
    React.createElement("section", {
      className:"home-section",
      style:{padding:"10px 20px 30px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}
    },
      React.createElement("div", {
        style:{
          background:"linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.06))",
          border:"1px solid rgba(99,102,241,0.25)",
          borderRadius:"20px",padding:"36px",textAlign:"center",position:"relative",overflow:"hidden"
        }
      },
        React.createElement("div",{
          style:{
            position:"absolute",top:0,left:0,right:0,height:"1px",
            background:"linear-gradient(90deg,transparent,rgba(99,102,241,0.6),transparent)"
          }
        }),
        React.createElement("div",{
          style:{
            fontSize:"10px",letterSpacing:"0.22em",color:C.accent,
            marginBottom:"12px",fontFamily:"Inter,system-ui,sans-serif",
            fontWeight:"700",textTransform:"uppercase"
          }
        },t("pret_gagner")),
        React.createElement("div",{
          style:{
            fontSize:"clamp(22px,3.5vw,34px)",fontWeight:"800",color:C.text,
            marginBottom:"12px",fontFamily:"Inter,system-ui,sans-serif",
            letterSpacing:"-0.02em",lineHeight:"1.2"
          }
        },t("rejoignez")),
        React.createElement("p",{
          style:{
            color:C.muted,fontSize:"13px",marginBottom:"20px",
            maxWidth:"400px",marginLeft:"auto",marginRight:"auto",
            fontFamily:"Inter,system-ui,sans-serif",lineHeight:"1.6"
          }
        },t("bonus_winamax")),
        React.createElement("a",{
          href:WINAMAX_LINK,target:"_blank",
          style:{
            display:"inline-block",
            background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",
            borderRadius:"10px",padding:"13px 32px",
            color:"#fff",fontWeight:"700",textDecoration:"none",
            fontSize:"14px",fontFamily:"Inter,system-ui,sans-serif",
            boxShadow:"0 0 24px rgba(99,102,241,0.25)"
          }
        },t("ouvrir_compte_winamax"))
      )
    ),

    // ════════════════════════════════════════
    // PARTENAIRES (top 3)
    // ════════════════════════════════════════
    React.createElement("section", {
      className:"home-section",
      style:{padding:"0 20px 30px",maxWidth:"780px",margin:"0 auto",width:"100%",boxSizing:"border-box"}
    },
      React.createElement("div", {
        style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}
      },
        React.createElement("h2", {
          style:{
            color:C.text,fontSize:"14px",fontWeight:"700",letterSpacing:"-0.01em",
            margin:0,fontFamily:"Inter,system-ui,sans-serif"
          }
        }, t("nos_partenaires")),
        React.createElement("button", {
          onClick:function(){setPage("bookmakers");},
          style:{
            background:"transparent",border:"1px solid "+C.border,
            color:C.dim,padding:"5px 12px",borderRadius:"6px",cursor:"pointer",
            fontSize:"11px",fontFamily:"Inter,system-ui,sans-serif"
          }
        }, t("voir_tous"))
      ),
      React.createElement("div", {style:{display:"flex",gap:"10px",flexWrap:"wrap"}},
        bookmakers.slice(0,3).map(function(b,k){
          return React.createElement("a", {
            key:k,href:b.link,target:"_blank",
            style:{
              flex:"1",minWidth:"160px",
              background:C.card,
              border:"1px solid "+C.border,
              borderRadius:"12px",padding:"14px 16px",
              textDecoration:"none",display:"block",textAlign:"center"
            }
          },
            React.createElement("div", {
              style:{fontSize:"15px",fontWeight:"700",color:C.text,marginBottom:"4px",fontFamily:"Inter,system-ui,sans-serif"}
            }, b.nom),
            React.createElement("div", {
              style:{fontSize:"10px",color:C.accent,marginBottom:"10px",fontFamily:"Inter,system-ui,sans-serif",fontWeight:"600"}
            }, b.bonus),
            React.createElement("div", {
              style:{
                background:"linear-gradient(135deg,#3B82F6,#8B5CF6)",
                borderRadius:"6px",padding:"8px",
                color:"#fff",fontWeight:"700",fontSize:"12px",
                fontFamily:"Inter,system-ui,sans-serif"
              }
            }, "S'inscrire")
          );
        })
      )
    ),

    footer,
    bandeauLegal
  );
}
