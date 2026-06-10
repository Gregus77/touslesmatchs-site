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
  {nom:"NetBet", badge:"BONNE VALEUR", bonus:"Bonus 100 EUR", desc:"Bon rapport qualité/cotes. Interface simple et claire. Programme de fidélité intéressant.", link:NETBET_LINK, note:"7.8/10"},
];

function sportEmoji(s) {
  var map = {Foot:"⚽",Hockey:"🏒",Tennis:"🎾",Basketball:"🏀",Basket:"🏀",Baseball:"⚾",Volleyball:"🏐",MLS:"⚽",F1:"🏎️",NFL:"🏈",Rugby:"🏉",MMA:"🥊"};
  return (map[s] || (s ? "🎯" : "")) + " ";
}

function teamInitials(name) {
  var words = name.trim().split(" ");
  if (words.length === 1) return name.substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function App() {
  var pageState     = React.useState("home");
  var page          = pageState[0];
  var setPage       = pageState[1];
  var filterState   = React.useState("ALL");
  var filter        = filterState[0];
  var setFilter     = filterState[1];
  var faqOpenState  = React.useState(null);
  var faqOpen       = faqOpenState[0];
  var setFaqOpen    = faqOpenState[1];
  var langState     = React.useState(localStorage.getItem("lang") || "fr");
  var lang          = langState[0];
  var setLang       = langState[1];

  function changeLang(l) { setLang(l); localStorage.setItem("lang", l); }

  function t(key) { return translations[lang]?.[key] || translations.fr[key] || key; }

  React.useEffect(function() {
    if (window.gaLoaded) return;
    window.gaLoaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=G-ME2T7G7PSK";
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", "G-ME2T7G7PSK");
  }, []);

  function parseDateFR(d) {
    var parts = d.split(" au ");
    var s = parts[parts.length - 1].trim().split("/");
    if (s.length < 2) return new Date(0);
    return new Date(2026, parseInt(s[1]) - 1, parseInt(s[0]));
  }

  picks = picks.slice().sort(function(a, b) { return parseDateFR(b[0]) - parseDateFR(a[0]); });
  var seen = {};
  picks = picks.filter(function(p) {
    var k = p[0] + "|" + p[5];
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });

  var wins    = picks.filter(function(p) { return p[5] === "GAGNE"; }).length;
  var losses  = picks.filter(function(p) { return p[5] === "PERDU"; }).length;
  var total   = picks.filter(function(p) { return p[5] !== "NOPICK" && p[5] !== "EN COURS" && p[5] !== "EN ATTENTE" && p[5] !== "ANNULE"; }).length;
  var winrate = total > 0 ? Math.round((wins / total) * 100) : 0;

  var miseFixe = 10;
  var gains = 0;
  picks.forEach(function(p) {
    if (p[5] === "ANNULE") return;
    if (p[5] === "GAGNE") gains += (parseFloat(p[3]) - 1) * miseFixe;
    else if (p[5] === "PERDU") gains -= miseFixe;
  });
  var roiPct = Math.round((gains / 100) * 100);

  var serieEnCours = 0;
  for (var i = 0; i < picks.length; i++) {
    if (picks[i][5] === "ANNULE") continue;
    if (picks[i][5] === "GAGNE") serieEnCours++;
    else if (picks[i][5] === "PERDU") break;
    else break;
  }

  var todayStr = new Date().toLocaleDateString("fr-FR", {day:"2-digit", month:"2-digit"});
  var pickAujourdhui = picks.find(function(p) { return p[5] === "EN ATTENTE" && p[0] === todayStr; });
  var prochainPick   = pickAujourdhui || picks.slice().reverse().find(function(p) { return p[5] === "EN ATTENTE"; });
  var pickDuJour     = prochainPick || picks[0];
  var isNoPick       = !prochainPick && (picks[0][5] === "NOPICK" || picks[0][5] === "GAGNE" || picks[0][5] === "PERDU");
  var isEnAttente    = pickDuJour[5] === "EN ATTENTE";
  var isToday        = pickDuJour[0] === todayStr;
  var pickLabel      = isEnAttente ? (isToday ? "Pick du jour" : "Prochain match") : isNoPick ? "Pas de match" : "Pick du jour";
  var pickScore      = pickDuJour[7] || 0;
  var pickThreshold  = pickDuJour[8] || 8;
  var matchTeams     = (isNoPick ? "San Antonio Spurs vs New York Knicks" : pickDuJour[1]).split(" vs ");
  var team1          = matchTeams[0] || "Spurs";
  var team2          = matchTeams[1] || "Knicks";

  var filtered = filter === "ALL" ? picks : picks.filter(function(p) {
    return p[5] === "NOPICK" || p[5] === "ANNULE" || p[5] === "EN COURS" || p[5] === "EN ATTENTE" || p[6] === filter;
  });

  var recentPicks = picks.filter(function(p) {
    return p[5] !== "NOPICK" && p[5] !== "ANNULE";
  }).slice(0, 5);

  // ─── HEADER ────────────────────────────────────────────
  var header = React.createElement("header", {className:"site-header"},
    React.createElement("div", {className:"header-logo", onClick:function(){setPage("home");}},
      React.createElement("div", {className:"header-logo-icon"}, "⚡"),
      React.createElement("div", {className:"header-logo-text"},
        React.createElement("span", {className:"header-logo-name"}, "TousLesMatchs"),
        React.createElement("span", {className:"header-logo-sub"}, "Pick IA du jour")
      )
    ),
    React.createElement("nav", {className:"header-nav"},
      React.createElement("button", {className:"nav-btn"+(page==="home"?" active":""), onClick:function(){setPage("home");}}, "Accueil"),
      React.createElement("button", {className:"nav-btn", onClick:function(){
        setPage("home");
        setTimeout(function(){ var el=document.getElementById("pick-day"); if(el) el.scrollIntoView({behavior:"smooth"}); },100);
      }}, "Pick du jour"),
      React.createElement("button", {className:"nav-btn", onClick:function(){
        setPage("home");
        setTimeout(function(){ var el=document.getElementById("pricing"); if(el) el.scrollIntoView({behavior:"smooth"}); },100);
      }}, "Offres"),
      React.createElement("button", {className:"nav-btn", onClick:function(){
        setPage("home");
        setTimeout(function(){ var el=document.getElementById("results"); if(el) el.scrollIntoView({behavior:"smooth"}); },100);
      }}, "Résultats"),
      React.createElement("button", {className:"nav-btn", onClick:function(){
        setPage("home");
        setTimeout(function(){ var el=document.getElementById("faq"); if(el) el.scrollIntoView({behavior:"smooth"}); },100);
      }}, "FAQ"),
      React.createElement("button", {className:"nav-btn"+(page==="preuves"?" active":""), onClick:function(){setPage("preuves");}}, "Preuves"),
      React.createElement("button", {className:"nav-btn"+(page==="bookmakers"?" active":""), onClick:function(){setPage("bookmakers");}}, "Bookmakers")
    ),
    React.createElement("div", {className:"header-cta"},
      ["fr","en","es","it","ru"].map(function(l) {
        var flags = {fr:"🇫🇷",en:"🇬🇧",es:"🇪🇸",it:"🇮🇹",ru:"🇷🇺"};
        return React.createElement("button", {
          key:l,
          title:l,
          onClick:function(){changeLang(l);},
          style:{
            background:lang===l?"rgba(74,222,128,0.1)":"transparent",
            border:"1px solid "+(lang===l?"rgba(74,222,128,0.25)":"rgba(255,255,255,0.07)"),
            borderRadius:"6px",
            padding:"4px 6px",
            cursor:"pointer",
            fontSize:"14px",
            lineHeight:"1"
          }
        }, flags[l]);
      }),
      React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"btn-telegram"},
        "✈ Rejoindre Telegram"
      )
    )
  );

  // ─── FOOTER ────────────────────────────────────────────
  var footer = React.createElement("footer", {className:"site-footer"},
    React.createElement("div", {className:"footer-inner"},
      React.createElement("div", {className:"footer-top"},
        // Brand col
        React.createElement("div", null,
          React.createElement("div", {className:"footer-brand-name"},
            React.createElement("div", {className:"footer-brand-icon"}, "⚡"),
            "TousLesMatchs"
          ),
          React.createElement("p", {className:"footer-brand-desc"},
            "Le bon pick. Tous les jours. Grâce à l'intelligence artificielle."
          ),
          React.createElement("div", {className:"footer-socials"},
            React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"footer-social-btn", title:"Telegram"}, "✈"),
            React.createElement("a", {href:TIKTOK_LINK, target:"_blank", className:"footer-social-btn", title:"TikTok"}, "♪")
          )
        ),
        // Liens rapides
        React.createElement("div", null,
          React.createElement("div", {className:"footer-col-title"}, "Liens rapides"),
          React.createElement("ul", {className:"footer-links"},
            React.createElement("li", null, React.createElement("button", {onClick:function(){setPage("home");}}, "Accueil")),
            React.createElement("li", null, React.createElement("button", {onClick:function(){setPage("preuves");}}, "Preuves")),
            React.createElement("li", null, React.createElement("button", {onClick:function(){setPage("bookmakers");}}, "Bookmakers")),
            React.createElement("li", null, React.createElement("button", {onClick:function(){setPage("calculateur");}}, "Calculateur")),
            React.createElement("li", null, React.createElement("a", {href:TELEGRAM_LINK, target:"_blank"}, "Telegram"))
          )
        ),
        // Informations
        React.createElement("div", null,
          React.createElement("div", {className:"footer-col-title"}, "Informations"),
          React.createElement("ul", {className:"footer-links"},
            React.createElement("li", null, React.createElement("button", {onClick:function(){setPage("cgu");}}, "Conditions d'utilisation")),
            React.createElement("li", null, React.createElement("button", {onClick:function(){setPage("confidentialite");}}, "Politique de confidentialité")),
            React.createElement("li", null, React.createElement("button", {onClick:function(){setPage("mentions");}}, "Mentions légales")),
            React.createElement("li", null, React.createElement("a", {href:"mailto:contact@touslesmatchs.com"}, "Nous contacter"))
          )
        ),
        // Jeu responsable
        React.createElement("div", null,
          React.createElement("div", {className:"footer-col-title"}, "Jeu responsable"),
          React.createElement("div", {className:"footer-resp-box"},
            React.createElement("div", {className:"footer-resp-title"}, "⚠ 18+"),
            React.createElement("p", {className:"footer-resp-text"},
              "Les jeux d'argent sont interdits aux mineurs. Jouez de manière responsable."
            )
          )
        )
      ),
      React.createElement("div", {className:"footer-bottom"},
        React.createElement("span", {className:"footer-copy"}, "© 2024 3W – TousLesMatchs. Tous droits réservés."),
        React.createElement("span", {className:"footer-copy"}, "JOUER COMPORTE DES RISQUES")
      )
    )
  );

  var bandeauLegal = React.createElement("div", {className:"legal-banner"},
    React.createElement("div", {className:"legal-text"}, t("jeu_responsable")),
    React.createElement("div", {style:{fontSize:"9px",color:"rgba(255,255,255,0.07)",marginTop:"1px"}}, t("risques_financiers"))
  );

  // ─── ROUTING ────────────────────────────────────────────
  if (page === "login") return React.createElement(Login, {setPage:setPage});
  if (page === "subscription") return React.createElement(Subscription, {setPage:setPage});
  if (page === "cgu") return React.createElement(CGU, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal});
  if (page === "mentions") return React.createElement(MentionsLegales, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal});
  if (page === "confidentialite") return React.createElement(Confidentialite, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal});
  if (page === "analyse") return React.createElement(React.Fragment, null, header, React.createElement(AnalyseLive, null), footer, bandeauLegal);
  if (page === "calculateur") return React.createElement(Calculateur, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal, header:header, picks:picks});

  // ─── PAGE PREUVES ────────────────────────────────────────
  if (page === "preuves") {
    return React.createElement("div", {style:{background:"#0A0A0A",minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:"#fff"}},
      header,
      React.createElement("div", {style:{maxWidth:"1000px",margin:"0 auto",padding:"48px 24px"}},
        React.createElement("div", {style:{marginBottom:"32px"}},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#4ADE80",fontWeight:"600",marginBottom:"10px"}},"PREUVES DE PERFORMANCE"),
          React.createElement("h2", {style:{fontSize:"clamp(28px,4vw,42px)",fontWeight:"800",letterSpacing:"-0.02em",marginBottom:"8px"}}, t("preuves_title")),
          React.createElement("p", {style:{color:"rgba(255,255,255,0.55)",fontSize:"15px",lineHeight:"1.7"}}, t("preuves_desc"))
        ),
        React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"16px"}},
          preuves.map(function(p, i) {
            return React.createElement("div", {key:i, style:{background:"#111",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"16px",overflow:"hidden"}},
              React.createElement("img", {
                src:p.img, alt:p.match, loading:"lazy",
                onError:function(e){e.target.style.display="none";e.target.nextSibling.style.display="flex";},
                style:{width:"100%",height:"260px",objectFit:"contain",background:"rgba(0,0,0,0.6)",display:"block"}
              }),
              React.createElement("div", {style:{width:"100%",height:"260px",background:"rgba(255,255,255,0.02)",display:"none",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"8px"}},
                React.createElement("div", {style:{color:"rgba(255,255,255,0.15)",fontSize:"11px"}}, t("capture_a_venir"))
              ),
              React.createElement("div", {style:{padding:"16px"}},
                React.createElement("div", {style:{fontSize:"11px",color:"rgba(255,255,255,0.3)",marginBottom:"4px"}}, p.date),
                React.createElement("div", {style:{fontSize:"14px",fontWeight:"600",marginBottom:"8px"}}, p.match),
                React.createElement("div", {style:{fontSize:"22px",fontWeight:"800",color:"#4ADE80"}}, p.gain)
              )
            );
          })
        )
      ),
      footer, bandeauLegal
    );
  }

  // ─── PAGE BOOKMAKERS ────────────────────────────────────
  if (page === "bookmakers") {
    return React.createElement("div", {style:{background:"#0A0A0A",minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:"#fff"}},
      header,
      React.createElement("div", {style:{maxWidth:"900px",margin:"0 auto",padding:"48px 24px"}},
        React.createElement("div", {style:{marginBottom:"32px"}},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#4ADE80",fontWeight:"600",marginBottom:"10px"}},"NOS PARTENAIRES"),
          React.createElement("h2", {style:{fontSize:"clamp(28px,4vw,42px)",fontWeight:"800",letterSpacing:"-0.02em",marginBottom:"8px"}}, t("bookmakers_title")),
          React.createElement("p", {style:{color:"rgba(255,255,255,0.55)",fontSize:"14px",marginBottom:"4px"}}, t("bookmakers_desc")),
          React.createElement("p", {style:{color:"rgba(255,255,255,0.2)",fontSize:"11px"}}, t("bookmakers_note"))
        ),
        React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"12px"}},
          bookmakers.map(function(b, i) {
            return React.createElement("div", {key:i, style:{background:"#111",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"14px",padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"16px"}},
              React.createElement("div", {style:{flex:1,minWidth:"200px"}},
                React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px",flexWrap:"wrap"}},
                  React.createElement("span", {style:{fontSize:"18px",fontWeight:"700"}},"  "+b.nom),
                  React.createElement("span", {style:{background:"rgba(74,222,128,0.08)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:"4px",padding:"2px 8px",color:"#4ADE80",fontSize:"9px",letterSpacing:"1px",fontWeight:"700"}}, b.badge),
                  React.createElement("span", {style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"4px",padding:"2px 8px",color:"rgba(255,255,255,0.5)",fontSize:"9px",fontWeight:"600"}}, b.bonus)
                ),
                React.createElement("p", {style:{color:"rgba(255,255,255,0.4)",fontSize:"13px",margin:"0 0 5px",lineHeight:"1.6"}},"   "+b.desc),
                React.createElement("span", {style:{color:"#4ADE80",fontSize:"12px",fontWeight:"700"}},"   Note : "+b.note)
              ),
              React.createElement("a", {href:b.link, target:"_blank", style:{background:"#4ADE80",color:"#000",borderRadius:"10px",padding:"12px 24px",fontWeight:"700",textDecoration:"none",fontSize:"13px",whiteSpace:"nowrap",fontFamily:"inherit"}},
                t("sinscrire")
              )
            );
          })
        )
      ),
      footer, bandeauLegal
    );
  }

  // ════════════════════════════════════════════════════════
  //  HOME PAGE
  // ════════════════════════════════════════════════════════
  return React.createElement("div", {style:{background:"#0A0A0A",minHeight:"100vh",fontFamily:"Inter,system-ui,sans-serif",color:"#fff",overflowX:"hidden"}},
    header,

    // ── HERO ──────────────────────────────────────────────
    React.createElement("section", {className:"hero"},
      React.createElement("div", {className:"hero-glow"}),
      React.createElement("div", {className:"hero-field-lines"}),
      React.createElement("div", {className:"hero-inner"},

        // Gauche
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
              React.createElement("div", {className:"hero-feature-icon"}, "✓"),
              React.createElement("div", {className:"hero-feature-text"},
                React.createElement("strong", null, "1 seul pick par jour"),
                React.createElement("span", null, "Qualité > Quantité")
              )
            ),
            React.createElement("div", {className:"hero-feature"},
              React.createElement("div", {className:"hero-feature-icon"}, "🤖"),
              React.createElement("div", {className:"hero-feature-text"},
                React.createElement("strong", null, "Analyse IA avancée"),
                React.createElement("span", null, "Données en temps réel")
              )
            ),
            React.createElement("div", {className:"hero-feature"},
              React.createElement("div", {className:"hero-feature-icon"}, "✈"),
              React.createElement("div", {className:"hero-feature-text"},
                React.createElement("strong", null, "Disponible sur Telegram"),
                React.createElement("span", null, "Rapide & pratique")
              )
            )
          )
        ),

        // Droite — phone mockup
        React.createElement("div", {className:"hero-right"},
          React.createElement("div", {className:"phone-mockup"},
            React.createElement("div", {className:"phone-notch"}),
            React.createElement("div", {className:"phone-screen"},
              React.createElement("div", {className:"phone-header"},
                React.createElement("div", {className:"phone-avatar"}, "⚡"),
                React.createElement("div", null,
                  React.createElement("div", {className:"phone-channel-name"}, "3W – TousLesMatchs"),
                  React.createElement("div", {className:"phone-channel-sub"}, "Canal officiel")
                )
              ),
              React.createElement("div", {className:"phone-body"},
                React.createElement("div", {className:"phone-pick-title"}, "Pick IA du jour 🔥"),
                React.createElement("div", {className:"phone-conf-row"},
                  React.createElement("span", {className:"phone-conf-label"}, "Confiance"),
                  React.createElement("span", {className:"phone-conf-value"}, pickScore.toFixed(1)+"/10")
                ),
                React.createElement("div", {className:"phone-teams"},
                  React.createElement("div", {className:"phone-team"},
                    React.createElement("div", {className:"phone-team-badge"}, teamInitials(team1)),
                    React.createElement("div", {className:"phone-team-name"}, team1)
                  ),
                  React.createElement("span", {className:"phone-vs"}, "VS"),
                  React.createElement("div", {className:"phone-team"},
                    React.createElement("div", {className:"phone-team-badge"}, teamInitials(team2)),
                    React.createElement("div", {className:"phone-team-name"}, team2)
                  )
                ),
                React.createElement("div", {className:"phone-bet-block"},
                  React.createElement("div", {className:"phone-bet-type"}, pickDuJour[2]),
                  React.createElement("div", {className:"phone-bet-info"}, sportEmoji(pickDuJour[6]).trim()+" · Cote "+pickDuJour[3])
                ),
                React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"phone-cta-btn"}, "VOIR L'ANALYSE COMPLÈTE")
              ),
              React.createElement("div", {className:"phone-footer"},
                React.createElement("div", {className:"phone-footer-icon"}, "⚡"),
                React.createElement("div", {className:"phone-footer-text"},
                  React.createElement("div", {style:{fontWeight:"700",color:"#fff",fontSize:"11px"}}, "3W – TousLesMatchs"),
                  React.createElement("div", null, "Le bon pick. Tous les jours.")
                )
              )
            )
          )
        )
      )
    ),

    // ── PICK DU JOUR CARD ─────────────────────────────────
    React.createElement("div", {className:"pick-day-section", id:"pick-day"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("div", {className:"section-header"},
          React.createElement("span", {className:"section-title"}, pickLabel.toUpperCase()),
          isEnAttente
            ? React.createElement("span", {className:"badge-gratuit"}, "GRATUIT")
            : null
        ),
        isNoPick
          ? React.createElement("div", {style:{background:"#111",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"20px",padding:"32px",textAlign:"center"}},
              React.createElement("div", {style:{fontSize:"32px",marginBottom:"8px"}},"🎯"),
              React.createElement("div", {style:{fontWeight:"700",color:"#fff",marginBottom:"4px"}},"Pas de pick aujourd'hui"),
              React.createElement("p", {style:{color:"rgba(255,255,255,0.4)",fontSize:"13px"}}, "Aucun match ne satisfait nos critères. On ne force jamais un pari.")
            )
          : React.createElement("div", {className:"pick-day-card"},
              // Teams col
              React.createElement("div", {className:"pick-teams-col"},
                React.createElement("div", {className:"pick-league-tag"}, sportEmoji(pickDuJour[6])+pickDuJour[0]),
                React.createElement("div", {className:"pick-teams-row"},
                  React.createElement("div", {className:"pick-team-block"},
                    React.createElement("div", {className:"pick-team-logo"}, teamInitials(team1)),
                    React.createElement("div", {className:"pick-team-name"}, team1)
                  ),
                  React.createElement("span", {className:"pick-vs"}, "vs"),
                  React.createElement("div", {className:"pick-team-block"},
                    React.createElement("div", {className:"pick-team-logo"}, teamInitials(team2)),
                    React.createElement("div", {className:"pick-team-name"}, team2)
                  )
                )
              ),
              // Stats
              React.createElement("div", {className:"pick-stats-col"},
                React.createElement("div", {className:"pick-stat-block"},
                  React.createElement("div", {className:"pick-stat-label"}, "PRONOSTIC"),
                  React.createElement("div", {className:"pick-stat-value", style:{fontSize:"16px",marginTop:"2px"}}, pickDuJour[2])
                ),
                React.createElement("div", {className:"pick-stat-block"},
                  React.createElement("div", {className:"pick-stat-label"}, "COTE"),
                  React.createElement("div", {className:"pick-stat-value"}, pickDuJour[3])
                ),
                React.createElement("div", {className:"pick-stat-block"},
                  React.createElement("div", {className:"pick-stat-label"}, "CONFIANCE"),
                  React.createElement("div", {className:"pick-stat-value green"}, pickScore.toFixed(1)+"/10"),
                  React.createElement("div", {className:"pick-conf-dots"},
                    [1,2,3,4,5,6,7].map(function(n) {
                      return React.createElement("span", {key:n, className:"conf-dot"+(n <= Math.round(pickScore) ? " filled" : "")});
                    })
                  )
                )
              ),
              // Right col
              React.createElement("div", {className:"pick-right-col"},
                React.createElement("ul", {className:"pick-bullet-list"},
                  React.createElement("li", null, "Analyse de 35+ critères"),
                  React.createElement("li", null, "Stats en temps réel"),
                  React.createElement("li", null, "Forme, H2H, absences, météo...")
                ),
                React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"pick-tg-btn"},
                  "RECEVOIR SUR TELEGRAM ✈"
                )
              )
            )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── COMMENT ÇA MARCHE ─────────────────────────────────
    React.createElement("section", {className:"how-section"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("h2", {className:"how-title"}, "COMMENT ÇA MARCHE ?"),
        React.createElement("div", {className:"how-grid"},
          [
            {icon:"🤖", title:"L'IA ANALYSE", desc:"Notre intelligence artificielle analyse des milliers de matchs et de données en temps réel.", n:"1"},
            {icon:"🎯", title:"LE MEILLEUR PICK", desc:"L'IA sélectionne le pari à plus forte valeur pour maximiser tes gains.", n:"2"},
            {icon:"✈", title:"TU REÇOIS LE PICK", desc:"Le pick est envoyé chaque jour sur Telegram, prêt à être joué.", n:"3"},
          ].map(function(step, i) {
            return React.createElement("div", {key:i, className:"how-card"},
              React.createElement("span", {className:"how-step-num"}, step.n),
              React.createElement("div", {className:"how-icon"}, step.icon),
              React.createElement("div", {className:"how-card-title"}, step.title),
              React.createElement("p", {className:"how-card-desc"}, step.desc),
              i < 2 ? React.createElement("span", {className:"how-arrow"}, "›") : null
            );
          })
        )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── OFFRES / PRICING ──────────────────────────────────
    React.createElement("section", {className:"pricing-section", id:"pricing"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("h2", {className:"pricing-title"}, "NOS OFFRES"),
        React.createElement("div", {className:"pricing-grid"},
          // FREE
          React.createElement("div", {className:"pricing-card"},
            React.createElement("div", {className:"pricing-tier"}, "FREE"),
            React.createElement("div", {className:"pricing-price"}, "0€"),
            React.createElement("div", {className:"pricing-period"}, "/mois"),
            React.createElement("ul", {className:"pricing-features"},
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "1 pick gratuit par jour"),
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "Analyse IA basique"),
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "Envoi sur Telegram"),
              React.createElement("li", null, React.createElement("span",{className:"check off"},"✗"), React.createElement("span",{style:{opacity:0.35}},"Picks premium"))
            ),
            React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"pricing-btn outline"}, "COMMENCER GRATUITEMENT")
          ),
          // PREMIUM
          React.createElement("div", {className:"pricing-card featured"},
            React.createElement("div", {className:"pricing-popular-badge"}, "LE PLUS POPULAIRE"),
            React.createElement("div", {className:"pricing-tier"}, "PREMIUM"),
            React.createElement("div", {className:"pricing-price"}, "19,90€"),
            React.createElement("div", {className:"pricing-period"}, "/mois"),
            React.createElement("ul", {className:"pricing-features"},
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "1 pick fort par jour"),
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "Analyse IA complète"),
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "Historique & statistiques"),
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "Support prioritaire")
            ),
            React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"pricing-btn green"}, "PASSER PREMIUM ⚡")
          ),
          // FULL ACCESS
          React.createElement("div", {className:"pricing-card"},
            React.createElement("div", {className:"pricing-tier"}, "FULL ACCESS"),
            React.createElement("div", {className:"pricing-price"}, "49,90€"),
            React.createElement("div", {className:"pricing-period"}, "/mois"),
            React.createElement("ul", {className:"pricing-features"},
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "Tous les picks (foot + autres sports)"),
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "Alertes live & changements de cotes"),
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "Stats avancées & filtres"),
              React.createElement("li", null, React.createElement("span",{className:"check"},"✓"), "Accès prioritaire")
            ),
            React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"pricing-btn outline"}, "PASSER FULL ACCESS")
          )
        )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── RÉSULTATS + HISTORIQUE ────────────────────────────
    React.createElement("section", {className:"results-section", id:"results"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("div", {className:"results-grid"},
          // Stats card
          React.createElement("div", {className:"results-stats-card"},
            React.createElement("div", {className:"results-card-title"}, "NOS RÉSULTATS PARLENT"),
            React.createElement("div", {className:"results-big-stats"},
              React.createElement("div", {className:"results-stat"},
                React.createElement("div", {className:"results-stat-num"}, winrate+"%"),
                React.createElement("div", {className:"results-stat-label"}, "Taux de réussite", React.createElement("br",null), "sur les 30 derniers jours")
              ),
              React.createElement("div", {className:"results-stat"},
                React.createElement("div", {className:"results-stat-num"}, "+"+(gains/10).toFixed(1)+"u"),
                React.createElement("div", {className:"results-stat-label"}, "Bénéfice net", React.createElement("br",null), "sur les 30 derniers jours")
              ),
              React.createElement("div", {className:"results-stat"},
                React.createElement("div", {className:"results-stat-num"}, wins),
                React.createElement("div", {className:"results-stat-label"}, "Picks gagnants", React.createElement("br",null), "ce mois-ci")
              )
            )
          ),
          // History card
          React.createElement("div", {className:"history-card"},
            React.createElement("div", {className:"history-title"}, "HISTORIQUE DES 5 DERNIERS PICKS"),
            React.createElement("table", {className:"history-table"},
              React.createElement("tbody", null,
                recentPicks.map(function(p, i) {
                  var statusClass = p[5]==="GAGNE"?"gagne":p[5]==="PERDU"?"perdu":p[5]==="EN ATTENTE"?"attente":"annule";
                  var statusLabel = p[5]==="GAGNE"?"GAGNÉ ↑":p[5]==="PERDU"?"PERDU ↓":p[5]==="EN ATTENTE"?"EN COURS":p[5];
                  return React.createElement("tr", {key:i},
                    React.createElement("td", null, p[1]),
                    React.createElement("td", null,
                      React.createElement("span", {className:"status-badge "+statusClass}, statusLabel)
                    ),
                    React.createElement("td", null, p[3])
                  );
                })
              )
            ),
            // Simple sparkline
            React.createElement("div", {className:"chart-area"},
              React.createElement("svg", {className:"chart-svg", viewBox:"0 0 300 60", preserveAspectRatio:"none"},
                (function() {
                  var pts = [];
                  var cum = 50;
                  var plist = picks.filter(function(p){return p[5]==="GAGNE"||p[5]==="PERDU";}).slice(-10).reverse();
                  plist.forEach(function(p, i) {
                    if (p[5]==="GAGNE") cum += 8;
                    else cum -= 10;
                    pts.push((i * (300/(plist.length-1||1)))+","+Math.max(5,Math.min(55,60-cum/2)));
                  });
                  var d = "M "+pts.join(" L ");
                  return [
                    React.createElement("defs", {key:"defs"},
                      React.createElement("linearGradient", {id:"gfill", x1:"0", y1:"0", x2:"0", y2:"1"},
                        React.createElement("stop", {offset:"0%", stopColor:"#4ADE80", stopOpacity:"0.2"}),
                        React.createElement("stop", {offset:"100%", stopColor:"#4ADE80", stopOpacity:"0"})
                      )
                    ),
                    React.createElement("polyline", {key:"line", points:pts.join(" "), fill:"none", stroke:"#4ADE80", strokeWidth:"2", strokeLinejoin:"round"}),
                  ];
                })()
              ),
              React.createElement("div", {className:"chart-label"}, "+"+(gains/10).toFixed(1)+"u")
            )
          )
        )
      )
    ),

    React.createElement("hr", {className:"section-divider"}),

    // ── FAQ ───────────────────────────────────────────────
    React.createElement("section", {className:"faq-section", id:"faq"},
      React.createElement("div", {className:"section-wrapper"},
        React.createElement("h2", {className:"faq-title"}, "QUESTIONS FRÉQUENTES"),
        React.createElement("div", {className:"faq-grid"},
          faqs.map(function(f, i) {
            var open = faqOpen === i;
            return React.createElement("div", {key:i, className:"faq-item"},
              React.createElement("button", {className:"faq-q", onClick:function(){setFaqOpen(open?null:i);}},
                f.q,
                React.createElement("span", {className:"faq-icon"+(open?" open":"")}, "+")
              ),
              open ? React.createElement("div", {className:"faq-a"}, f.a) : null
            );
          })
        )
      )
    ),

    footer,
    bandeauLegal
  );
}
