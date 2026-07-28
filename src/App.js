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
var UNIBET_LINK = "https://www.unibet.fr/inscription/?campaign=210726&parrain=5EBF919DF1008254";
var PMU_LINK = "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728";
var ZEBET_LINK = "https://www.zebet.fr/fr/inscription";
var PARIONSSPORT_LINK = "https://parionssport.lfdj.fr/fr-fr/inscription";
var NETBET_LINK = "https://www.netbet.fr/inscription";
var TIKTOK_LINK = "https://www.tiktok.com/@touslesmatchs.com";
var TELEGRAM_LINK = "https://t.me/touslesmatchs_bot";

var picks = [
  ["08/06","Greece vs Italy","Greece Vainqueur","1.6","—","EN ATTENTE","Foot",7,7],
  ["06/06","Switzerland vs Australia","Switzerland Vainqueur","1.6","1-1","PERDU","Foot",7,7],
  ["06/06","Belgium vs Tunisia","Belgium Vainqueur","1.6","—","EN ATTENTE","Foot",7,7],
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
  {nom:"Thomas R.", ville:"Lyon", txt:"9 wins consecutifs, je suis bluffe. Le seul tipster que je suis vraiment.", gains:"+47 EUR"},
  {nom:"Karim B.", ville:"Paris", txt:"Le pick du jour est devenu mon rituel du matin. Simple, clair, efficace.", gains:"+31 EUR"},
  {nom:"Julien M.", ville:"Bordeaux", txt:"Le seuil 8/10 ca change tout. Moins de picks mais beaucoup plus de qualite.", gains:"+28 EUR"},
];

var faqs = [
  {q:"C'est vraiment gratuit ?", a:"Oui, 100% gratuit. Nous sommes remuneres via les liens d'affiliation bookmakers. En vous inscrivant via nos liens, vous nous aidez a maintenir le service."},
  {q:"Comment votre IA analyse les matchs ?", a:"Notre Concile de 6 IAs croise la forme recente, les blessures, les confrontations directes, les stats domicile/exterieur et d'autres variables. Seuls les picks avec un score de confiance >= 7/10 sont publies."},
  {q:"Combien de picks par jour ?", a:"Un seul pick par jour, maximum. Qualite plutot que quantite. Les jours sans pick valable sont indiques clairement."},
  {q:"Quel bankroll est recommande ?", a:"Ne misez jamais plus de 2 a 5% de votre bankroll total sur un seul pick. Les paris sportifs comportent des risques."},
  {q:"Qu'est-ce que le plan Elite ?", a:"Le plan Elite a 19,90 EUR/mois donne acces a un pick HORS-ARJEL supplementaire chaque jour, sur Pinnacle et PS3838 ou les cotes sont souvent superieures."},
];

var bookmakers = [
  {nom:"Winamax", badge:"PARTENAIRE N1", bonus:"Bonus jusqu a 200 EUR", desc:"Le bookmaker francais numero 1.", color:"#e8b400", link:WINAMAX_LINK, note:"9.5/10"},
  {nom:"Betclic", badge:"TOP COTES", bonus:"Bonus bienvenue 100 EUR", desc:"Cotes tres competitives.", color:"#00a651", link:BETCLIC_LINK, note:"9.2/10"},
  {nom:"Unibet", badge:"FIABLE", bonus:"Mise remboursee 100 EUR", desc:"Bookmaker international solide.", color:"#007832", link:UNIBET_LINK, note:"8.8/10"},
  {nom:"PMU", badge:"100% FRANCAIS", bonus:"Bonus 150 EUR", desc:"L historique des paris en France.", color:"#d4001a", link:PMU_LINK, note:"8.5/10"},
  {nom:"ZEbet", badge:"COTES ELEVEES", bonus:"Remboursement 100 EUR", desc:"Specialiste des cotes boostees.", color:"#ff6600", link:ZEBET_LINK, note:"8.3/10"},
  {nom:"ParionsSport", badge:"FDJ OFFICIEL", bonus:"Bonus 100 EUR", desc:"Le pari sportif officiel de la FDJ.", color:"#005baa", link:PARIONSSPORT_LINK, note:"8.0/10"},
  {nom:"NetBet", badge:"BONNE VALEUR", bonus:"Bonus 100 EUR", desc:"Bon rapport qualite/cotes.", color:"#c8102e", link:NETBET_LINK, note:"7.8/10"},
];

var iaList = [
  {nom:"Groq",    color:"#22c55e", role:"Scanner"},
  {nom:"Gemini",  color:"#3b82f6", role:"H2H"},
  {nom:"DeepSeek",color:"#f97316", role:"Forme"},
  {nom:"Mistral", color:"#a855f7", role:"Contexte"},
  {nom:"Qwen",    color:"#ef4444", role:"Value"},
  {nom:"Claude",  color:"#D4AF37", role:"Chef"},
];

function sportEmoji(sport) {
  var map = {Foot:"⚽ ",Hockey:"🏒 ",Tennis:"🎾 ",Basketball:"🏀 ",Baseball:"⚾ ",Volleyball:"🏐 ",MLS:"⚽🇺🇸 ",F1:"🏎️ ",NFL:"🏈 ",Rugby:"🏉 ",MMA:"🥊 "};
  return map[sport] || (sport ? "🎯 " : "");
}

function Globe() {
  var dots = [];
  for (var i = 0; i < 8; i++) {
    dots.push(React.createElement("div", {key: "d"+i, className: "globe-dot" + (i > 5 ? " gold" : "")}));
  }
  var streams = [];
  for (var j = 0; j < 5; j++) {
    streams.push(React.createElement("div", {key: "s"+j, className: "data-stream"}));
  }
  var particles = [];
  for (var k = 0; k < 8; k++) {
    particles.push(React.createElement("div", {key: "p"+k, className: "particle" + (k % 3 === 0 ? " gold" : "")}));
  }
  return React.createElement("div", {className: "globe-container"},
    React.createElement("div", {className: "globe"}, dots, streams),
    particles
  );
}

export default function App() {
  var pageState = React.useState("home");
  var page = pageState[0], setPage = pageState[1];
  var filterState = React.useState("ALL");
  var filter = filterState[0], setFilter = filterState[1];
  var faqOpenState = React.useState(null);
  var faqOpen = faqOpenState[0], setFaqOpen = faqOpenState[1];
  var langState = React.useState(localStorage.getItem("lang") || "fr");
  var lang = langState[0], setLang = langState[1];
  var menuState = React.useState(false);
  var menuOpen = menuState[0], setMenuOpen = menuState[1];

  function changeLang(l) { setLang(l); localStorage.setItem("lang", l); }
  function t(key) { return (translations[lang] && translations[lang][key]) || translations.fr[key] || key; }

  React.useEffect(function() {
    if (window.gaLoaded) return;
    window.gaLoaded = true;
    var s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=G-ME2T7G7PSK";
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = gtag; gtag("js", new Date()); gtag("config", "G-ME2T7G7PSK");
  }, []);

  // Scroll reveal
  React.useEffect(function() {
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { if (e.isIntersecting) e.target.classList.add("visible"); });
    }, {threshold: 0.1});
    document.querySelectorAll(".reveal").forEach(function(el) { obs.observe(el); });
    return function() { obs.disconnect(); };
  });

  // Dedup picks
  var seenDates = {};
  picks = picks.filter(function(p) {
    var key = p[0] + "|" + p[5];
    if (seenDates[key]) return false;
    seenDates[key] = true; return true;
  });

  var wins = picks.filter(function(p){return p[5]==="GAGNE";}).length;
  var losses = picks.filter(function(p){return p[5]==="PERDU";}).length;
  var total = picks.filter(function(p){return p[5]!=="NOPICK" && p[5]!=="EN COURS" && p[5]!=="EN ATTENTE";}).length;
  var winrate = total > 0 ? Math.round((wins/total)*100) : 0;

  var miseFixe = 10, bankrollDepart = 100, gainsCumules = 0;
  picks.forEach(function(p) {
    if (p[5] === "GAGNE") gainsCumules += (parseFloat(p[3]) - 1) * miseFixe;
    else if (p[5] === "PERDU") gainsCumules -= miseFixe;
  });
  var roiPct = Math.round((gainsCumules / bankrollDepart) * 100);
  var gainsEur = Math.round(gainsCumules);

  var serieEnCours = 0;
  for (var i = 0; i < picks.length; i++) {
    if (picks[i][5] === "GAGNE") serieEnCours++;
    else if (picks[i][5] === "PERDU") break;
  }

  var todayStr = new Date().toLocaleDateString("fr-FR", {day:"2-digit", month:"2-digit"});
  var pickAujourdhui = picks.find(function(p){ return p[5]==="EN ATTENTE" && p[0]===todayStr; });
  var prochainPick = pickAujourdhui || picks.slice().reverse().find(function(p){ return p[5]==="EN ATTENTE"; });
  var pickDuJour = prochainPick || picks[0];
  var isNoPick = !prochainPick && (picks[0][5]==="NOPICK" || picks[0][5]==="GAGNE" || picks[0][5]==="PERDU");
  var isEnAttente = pickDuJour[5]==="EN ATTENTE";
  var isToday = pickDuJour[0] === todayStr;
  var pickLabel = isEnAttente ? (isToday ? t("pick_du_jour") : t("prochain_match")) : isNoPick ? t("pas_de_match") : t("pick_du_jour");
  var pickThreshold = pickDuJour[8] || 8;
  var pickAiScore = pickDuJour[7] || 0;
  var isPremium = pickThreshold >= 8;
  var isStandard7 = pickThreshold === 7;
  var pickBadge = isPremium ? t("pick_premium") : t("pick_standard");

  var filtered = filter === "ALL" ? picks : picks.filter(function(p) {
    return p[5]==="NOPICK" || p[5]==="EN COURS" || p[5]==="EN ATTENTE" || p[6]===filter;
  });

  // ═══ SHARED COMPONENTS ═══
  var bandeauLegal = React.createElement("div", {className:"legal-band"},
    React.createElement("p", null, t("jeu_responsable")),
    React.createElement("p", {style:{fontSize:"9px",color:"#2d2d2d",marginTop:"1px"}}, t("risques_financiers"))
  );

  var footer = React.createElement("footer", {className:"footer"},
    React.createElement("div", {className:"footer-logo"}, "TOUSLESMATCHS"),
    React.createElement("div", {className:"footer-links"},
      React.createElement("button", {onClick:function(){setPage("cgu");}}, t("cgu")),
      React.createElement("button", {onClick:function(){setPage("mentions");}}, t("mentions_legales")),
      React.createElement("button", {onClick:function(){setPage("confidentialite");}}, t("confidentialite")),
      React.createElement("a", {href:TIKTOK_LINK, target:"_blank"}, "TikTok"),
      React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", style:{color:"#29b6f6"}}, "Telegram")
    ),
    React.createElement("div", {className:"footer-copy"}, t("footer_droits"))
  );

  var header = React.createElement("header", {className:"site-header"},
    React.createElement("div", {className:"header-logo", onClick:function(){setPage("home"); setMenuOpen(false);}},
      "TousLesMatchs",
      React.createElement("span", null, t("analyse_sous_menu"))
    ),
    React.createElement("nav", {className:"header-nav" + (menuOpen ? " open" : "")},
      ["home","preuves","bookmakers","calculateur","analyse"].map(function(p) {
        var labels = {home:t("nav_choix"), preuves:t("nav_preuves"), bookmakers:t("nav_bookmakers"), calculateur:"Calculateur", analyse:t("nav_analyse")};
        return React.createElement("button", {key:p, className:page===p?"nav-active":"", onClick:function(){setPage(p); setMenuOpen(false);}}, labels[p]);
      }),
      React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", style:{color:"#29b6f6",borderColor:"rgba(0,136,204,0.3)"}}, "Telegram"),
      React.createElement("div", {className:"lang-flags"},
        ["fr","en","es","it","ru"].map(function(l) {
          var flags = {fr:"🇫🇷",en:"🇬🇧",es:"🇪🇸",it:"🇮🇹",ru:"🇷🇺"};
          return React.createElement("button", {key:l, className:lang===l?"active":"", onClick:function(){changeLang(l);}}, flags[l]);
        })
      )
    ),
    React.createElement("button", {className:"burger", onClick:function(){setMenuOpen(!menuOpen);}, style:{display:"none",flexDirection:"column",gap:"5px",cursor:"pointer",background:"none",border:"none",padding:"4px"}},
      React.createElement("span", {style:{display:"block",width:"22px",height:"2px",background:"var(--green)",borderRadius:"2px"}}),
      React.createElement("span", {style:{display:"block",width:"22px",height:"2px",background:"var(--green)",borderRadius:"2px"}}),
      React.createElement("span", {style:{display:"block",width:"22px",height:"2px",background:"var(--green)",borderRadius:"2px"}})
    )
  );

  // ═══ ROUTING ═══
  if (page==="login") return React.createElement(Login, {setPage:setPage});
  if (page==="subscription") return React.createElement(Subscription, {setPage:setPage});
  if (page==="cgu") return React.createElement(CGU, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal});
  if (page==="mentions") return React.createElement(MentionsLegales, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal});
  if (page==="confidentialite") return React.createElement(Confidentialite, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal});
  if (page==="analyse") return React.createElement(React.Fragment, null, header, React.createElement(AnalyseLive, null), footer, bandeauLegal);
  if (page==="calculateur") return React.createElement(Calculateur, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal, header:header, picks:picks});

  if (page==="preuves") {
    return React.createElement("div", {style:{background:"var(--bg)",minHeight:"100vh",color:"var(--text)"}},
      header,
      React.createElement("div", {style:{maxWidth:"900px",margin:"0 auto",padding:"80px 20px 40px"}},
        React.createElement("h2", {className:"section-tag"}, t("preuves_title")),
        React.createElement("p", {style:{color:"var(--muted)",fontSize:"14px",marginBottom:"30px"}}, t("preuves_desc")),
        React.createElement("div", {className:"preuves-grid"},
          preuves.map(function(p,i) {
            return React.createElement("div", {key:i, className:"preuve-card"},
              React.createElement("img", {src:p.img, alt:p.match, loading:"lazy", className:"preuve-img", onError:function(e){e.target.style.display="none";}}),
              React.createElement("div", {className:"preuve-info"},
                React.createElement("div", {className:"preuve-date"}, p.date),
                React.createElement("div", {className:"preuve-match"}, p.match),
                React.createElement("div", {className:"preuve-gain"}, p.gain)
              )
            );
          })
        ),
        React.createElement("div", {style:{marginTop:"40px",textAlign:"center"}},
          React.createElement("a", {href:WINAMAX_LINK, target:"_blank", className:"btn-primary"}, t("ouvrir_compte"))
        )
      ),
      footer, bandeauLegal
    );
  }

  if (page==="bookmakers") {
    return React.createElement("div", {style:{background:"var(--bg)",minHeight:"100vh",color:"var(--text)"}},
      header,
      React.createElement("div", {style:{maxWidth:"860px",margin:"0 auto",padding:"80px 20px 40px"}},
        React.createElement("h2", {className:"section-tag"}, t("bookmakers_title")),
        React.createElement("p", {style:{color:"var(--muted)",fontSize:"13px",marginBottom:"6px"}}, t("bookmakers_desc")),
        React.createElement("p", {style:{color:"var(--dim)",fontSize:"11px",marginBottom:"30px"}}, t("bookmakers_note")),
        React.createElement("div", {className:"bm-list"},
          bookmakers.map(function(b,i) {
            return React.createElement("div", {key:i, className:"bm-card"},
              React.createElement("div", {style:{flex:1,minWidth:"200px"}},
                React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px",flexWrap:"wrap"}},
                  React.createElement("span", {className:"bm-name"}, b.nom),
                  React.createElement("span", {className:"bm-badge"}, b.badge),
                  React.createElement("span", {className:"bm-bonus"}, b.bonus)
                ),
                React.createElement("p", {className:"bm-desc"}, b.desc),
                React.createElement("span", {className:"bm-note"}, "Notre note: "+b.note)
              ),
              React.createElement("a", {href:b.link, target:"_blank", className:"bm-btn"}, t("sinscrire"))
            );
          })
        )
      ),
      footer, bandeauLegal
    );
  }

  // ═══ HOME PAGE ═══
  return React.createElement("div", {style:{background:"var(--bg)",minHeight:"100vh",overflowX:"hidden"}},
    header,

    // ════ 1. HERO ════
    React.createElement("section", {className:"hero"},
      React.createElement("div", {className:"hero-bg"}),
      React.createElement("div", {className:"hero-grid"}),
      React.createElement(Globe, null),
      React.createElement("div", {className:"hero-content"},
        React.createElement("div", {className:"hero-badge"},
          React.createElement("div", {className:"hero-badge-dot"}),
          "6 IA " + (lang==="fr"?"analysent en temps reel":lang==="en"?"analyzing in real-time":"analyzing")
        ),
        React.createElement("h1", {className:"hero-title"},
          lang==="fr" ? "L'intelligence artificielle cherche les meilleures " : lang==="en" ? "AI finds the best " : "AI finds the best ",
          React.createElement("em", null, lang==="fr" ? "opportunites" : "opportunities"),
          lang==="fr" ? " a votre place." : " for you."
        ),
        React.createElement("p", {className:"hero-sub"},
          lang==="fr"
            ? "Plusieurs IA analysent chaque jour des milliers de donnees afin de selectionner les rencontres qui presentent les meilleures opportunites selon leurs modeles."
            : "Multiple AIs analyze thousands of data points daily to select matches with the best opportunities according to their models."
        ),
        React.createElement("div", {className:"hero-buttons"},
          React.createElement("a", {href:"#pick", className:"btn-primary", onClick:function(e){
            e.preventDefault();
            var el = document.getElementById("pick");
            if (el) el.scrollIntoView({behavior:"smooth"});
          }}, "Voir le pick gratuit"),
          React.createElement("button", {className:"btn-secondary", onClick:function(){
            var el = document.getElementById("pricing");
            if (el) el.scrollIntoView({behavior:"smooth"});
          }}, "Decouvrir Elite")
        )
      )
    ),

    // ════ 2. STATS ════
    React.createElement("section", {className:"stats-section reveal"},
      React.createElement("div", {className:"stats-grid"},
        [
          {icon:"✅", value:winrate+"%", label:t("taux_reussite")},
          {icon:"📈", value:(gainsEur>=0?"+":"")+gainsEur+" EUR", label:"Simulation 10 EUR/pick", gold:true},
          {icon:"🤖", value:"6", label:"IA specialisees"},
          {icon:"🌍", value:total+"", label:"Picks verifies"}
        ].map(function(s,i) {
          return React.createElement("div", {key:i, className:"stat-card"},
            React.createElement("div", {className:"stat-icon"}, s.icon),
            React.createElement("div", {className:"stat-value" + (s.gold ? " gold" : "")}, s.value),
            React.createElement("div", {className:"stat-label"}, s.label)
          );
        })
      )
    ),

    // ════ 3. COMMENT CA MARCHE ════
    React.createElement("section", {className:"section reveal"},
      React.createElement("div", {className:"container"},
        React.createElement("div", {className:"section-tag"}, t("comment_marche")),
        React.createElement("div", {className:"how-grid"},
          [
            {num:"01", title:lang==="fr"?"Les IA analysent":"AIs analyze", desc:lang==="fr"?"6 intelligences artificielles scannent des centaines de matchs chaque matin sur 50+ championnats dans le monde.":"6 AIs scan hundreds of matches every morning across 50+ leagues worldwide."},
            {num:"02", title:lang==="fr"?"Le Concile compare":"The Council compares", desc:lang==="fr"?"Le Concile croise toutes les analyses et ne retient que les matchs avec un score de confiance >= 7/10.":"The Council cross-references all analyses and only keeps matches with a confidence score >= 7/10."},
            {num:"03", title:lang==="fr"?"Vous recevez le meilleur":"You get the best", desc:lang==="fr"?"Un seul pick par jour. Qualite maximale. Vous recevez la selection directement sur Telegram.":"One pick per day. Maximum quality. You receive the selection directly on Telegram."}
          ].map(function(s,i) {
            return React.createElement("div", {key:i, className:"how-card"},
              React.createElement("div", {className:"how-num"}, s.num),
              React.createElement("div", {className:"how-title"}, s.title),
              React.createElement("div", {className:"how-desc"}, s.desc)
            );
          })
        )
      )
    ),

    // ════ 4. PICK DU JOUR ════
    React.createElement("section", {id:"pick", className:"pick-section reveal"},
      React.createElement("div", {className:"container"},
        React.createElement("div", {className:"section-tag"}, pickLabel),
        React.createElement("div", {className:"pick-card" + (isNoPick ? " nopick" : isPremium ? " premium" : "")},
          isNoPick ? React.createElement("div", {className:"nopick-text"}, t("no_match_today")) :
          React.createElement(React.Fragment, null,
            React.createElement("div", {className:"pick-badge-row"},
              React.createElement("div", {className:"pick-level-badge " + (isPremium ? "premium" : "standard")}, pickBadge),
              React.createElement("div", {className:"pick-label"}, pickDuJour[0])
            ),
            React.createElement("div", {className:"pick-match-name"},
              pickDuJour[6] ? sportEmoji(pickDuJour[6]) : "", pickDuJour[1]
            ),
            React.createElement("div", {className:"pick-meta-row"},
              React.createElement("span", {className:"pick-market"}, pickDuJour[2]),
              React.createElement("span", {className:"pick-odds"}, "Cote: " + pickDuJour[3])
            ),

            // AI Panel
            React.createElement("div", {className:"pick-ai-panel"},
              React.createElement("div", {className:"pick-ai-label"}, t("concile_title")),
              React.createElement("div", {className:"pick-ai-grid"},
                iaList.map(function(ia, j) {
                  return React.createElement("div", {key:j, className:"pick-ai-chip"},
                    React.createElement("div", {className:"pick-ai-dot", style:{background:ia.color}}),
                    React.createElement("span", {className:"pick-ai-name"}, ia.nom),
                    React.createElement("span", {className:"pick-ai-role"}, ia.role),
                    React.createElement("span", {className:"pick-ai-vote"}, "GO")
                  );
                })
              ),
              pickAiScore > 0 && React.createElement("div", {className:"pick-conf-bar"},
                React.createElement("span", {className:"pick-conf-text"}, t("confiance_ia")),
                React.createElement("div", {className:"pick-conf-track"},
                  React.createElement("div", {className:"pick-conf-fill" + (isPremium ? " gold" : ""), style:{width:(pickAiScore/10*100)+"%"}})
                ),
                React.createElement("span", {className:"pick-conf-score" + (isPremium ? " gold" : "")}, pickAiScore+"/10")
              )
            ),

            // Warning 7/10
            isStandard7 && React.createElement("div", {className:"pick-warning"},
              React.createElement("div", {style:{fontSize:"12px",color:"var(--pending)",fontWeight:"bold",marginBottom:"4px"}}, t("seuil_abaisse")),
              React.createElement("div", {style:{fontSize:"12px",color:"var(--muted)",lineHeight:"1.6"}}, t("seuil_abaisse_desc"))
            ),

            // Urgency
            isEnAttente && React.createElement("div", {className:"pick-urgency"},
              React.createElement("div", {className:"pick-urgency-dot"}),
              React.createElement("span", {style:{fontSize:"12px",color:"#ff8888",fontWeight:"bold"}}, "Pick valable aujourd'hui seulement")
            ),

            // CTA
            React.createElement("a", {href:WINAMAX_LINK, target:"_blank", className:"pick-cta" + (isPremium ? " gold" : "")}, t("parier_winamax"))
          )
        )
      )
    ),

    // ════ 5. HISTORIQUE ════
    React.createElement("section", {className:"history-section reveal"},
      React.createElement("div", {className:"history-container"},
        React.createElement("div", {className:"history-header"},
          React.createElement("div", {className:"section-tag"}, t("historique_picks")),
          React.createElement("div", {className:"history-filters"},
            [{key:"ALL",label:t("tous")},{key:"Foot",label:t("foot")},{key:"Hockey",label:t("hockey")},{key:"Basketball",label:t("basket")}].map(function(f) {
              return React.createElement("button", {key:f.key, className:"filter-btn" + (filter===f.key?" active":""), onClick:function(){setFilter(f.key);}}, f.label);
            })
          )
        ),

        // Mini stats row
        React.createElement("div", {style:{display:"flex",gap:"16px",marginBottom:"20px",flexWrap:"wrap"}},
          React.createElement("div", {style:{background:"var(--bg-glass)",border:"1px solid var(--border)",borderRadius:"10px",padding:"12px 20px",flex:1,minWidth:"120px",textAlign:"center"}},
            React.createElement("div", {style:{fontSize:"24px",fontWeight:"700",color:"var(--green)",fontFamily:"'Space Grotesk',sans-serif"}}, winrate+"%"),
            React.createElement("div", {style:{fontSize:"10px",color:"var(--dim)",letterSpacing:"0.1em"}}, "WIN RATE")
          ),
          React.createElement("div", {style:{background:"var(--bg-glass)",border:"1px solid var(--border)",borderRadius:"10px",padding:"12px 20px",flex:1,minWidth:"120px",textAlign:"center"}},
            React.createElement("div", {style:{fontSize:"24px",fontWeight:"700",color:"var(--win)",fontFamily:"'Space Grotesk',sans-serif"}}, wins+"W"),
            React.createElement("div", {style:{fontSize:"10px",color:"var(--dim)",letterSpacing:"0.1em"}}, losses+"L / "+total+" total")
          ),
          React.createElement("div", {style:{background:"var(--bg-glass)",border:"1px solid var(--border)",borderRadius:"10px",padding:"12px 20px",flex:1,minWidth:"120px",textAlign:"center"}},
            React.createElement("div", {style:{fontSize:"24px",fontWeight:"700",color:"var(--gold)",fontFamily:"'Space Grotesk',sans-serif"}}, serieEnCours),
            React.createElement("div", {style:{fontSize:"10px",color:"var(--dim)",letterSpacing:"0.1em"}}, "STREAK")
          )
        ),

        React.createElement("div", {className:"history-list"},
          filtered.map(function(p,i) {
            var g = p[5]==="GAGNE", np = p[5]==="NOPICK", ec = p[5]==="EN COURS", ea = p[5]==="EN ATTENTE";
            var cls = np ? "nopick" : (ec||ea) ? "pending-row" : g ? "win" : "loss";
            var label = np ? "---" : ec ? t("a_venir") : ea ? t("en_attente") : g ? t("gagne") : t("perdu");
            var dc = np ? "var(--dim)" : (ec||ea) ? "var(--pending)" : g ? "var(--win)" : "var(--loss)";
            return React.createElement("div", {key:i, className:"history-row "+cls},
              React.createElement("span", {className:"row-date"}, p[0]),
              React.createElement("span", {className:"row-match" + (np?" italic":"")}, (!np && p[6]) ? sportEmoji(p[6])+p[1] : p[1]),
              React.createElement("span", {className:"row-pred"}, p[2]),
              React.createElement("span", {className:"row-odds"}, p[3]),
              React.createElement("span", {className:"row-score"}, p[4]),
              React.createElement("div", {className:"row-result"},
                React.createElement("div", {className:"rdot", style:{background:dc}}),
                React.createElement("span", {style:{color:dc}}, label)
              )
            );
          })
        )
      )
    ),

    // ════ 6. PRICING ════
    React.createElement("section", {id:"pricing", className:"pricing-section reveal"},
      React.createElement("div", {className:"container", style:{textAlign:"center"}},
        React.createElement("div", {className:"section-tag", style:{justifyContent:"center"}}, "NOS FORMULES"),
        React.createElement("p", {style:{color:"var(--muted)",fontSize:"15px",marginBottom:"8px"}},
          lang==="fr" ? "Commencez gratuitement. Passez Elite quand vous etes pret." : "Start free. Go Elite when you're ready."
        ),
        React.createElement("div", {className:"pricing-grid"},
          [
            {
              label:"GRATUIT", price:"0€", sub:"pour toujours", cls:"",
              features:["1 pick ARJEL / jour","Winamax, Betclic, PMU","Canal Telegram public","Calculateur de projection"],
              cta:"Commencer", btnCls:"free", action:null
            },
            {
              label:"STANDARD", price:"9,90€", sub:"/ mois", cls:"",
              features:["1 pick ARJEL prioritaire","Alertes Telegram instantanees","Statistiques avancees","Historique complet"],
              cta:"Essayer Standard", btnCls:"standard", action:"standard"
            },
            {
              label:"ELITE", price:"19,90€", sub:"/ mois", cls:" elite", badge:"LE PLUS POPULAIRE",
              features:["Tout Standard inclus","1 pick HORS-ARJEL (Pinnacle)","Cotes superieures vs France","Canal Telegram prive"],
              cta:"Devenir Elite", btnCls:"elite", action:"premium"
            }
          ].map(function(plan,i) {
            return React.createElement("div", {key:i, className:"pricing-card"+plan.cls},
              plan.badge && React.createElement("div", {className:"pricing-popular"}, plan.badge),
              React.createElement("div", {className:"pricing-label"}, plan.label),
              React.createElement("div", {className:"pricing-price"}, plan.price),
              React.createElement("div", {className:"pricing-sub"}, plan.sub),
              React.createElement("div", {className:"pricing-divider"}),
              React.createElement("ul", {className:"pricing-features"},
                plan.features.map(function(f,j) {
                  return React.createElement("li", {key:j},
                    React.createElement("span", {className:"check"}, "✓"), f
                  );
                })
              ),
              React.createElement("button", {className:"pricing-btn "+plan.btnCls, onClick:function() {
                if (!plan.action) return;
                if (window.trackEvent) window.trackEvent("click_pricing_cta",{plan:plan.action});
                fetch("https://www.touslesmatchs.com/api/create-checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({plan:plan.action})})
                  .then(function(r){return r.json();})
                  .then(function(d){if(d.url) window.location.href=d.url; else window.open(TELEGRAM_LINK,"_blank");})
                  .catch(function(){window.open(TELEGRAM_LINK,"_blank");});
              }}, plan.cta)
            );
          })
        )
      )
    ),

    // ════ 7. PHILOSOPHIE ════
    React.createElement("section", {className:"philosophy-section reveal"},
      React.createElement("div", {className:"container"},
        React.createElement("div", {className:"section-tag"}, "NOTRE PHILOSOPHIE"),
        React.createElement("div", {className:"philosophy-box"},
          React.createElement("div", {className:"philosophy-quote"},
            lang==="fr"
              ? "Nous ne cherchons pas le match qui fait le buzz. Nous cherchons celui qui offre la meilleure opportunite selon nos intelligences artificielles."
              : "We don't look for the match that makes the buzz. We look for the one that offers the best opportunity according to our AIs."
          ),
          React.createElement("p", {className:"philosophy-text"},
            lang==="fr"
              ? "Notre objectif n'est pas de proposer les matchs les plus mediatiques. Les meilleures selections ne se trouvent pas forcement dans les competitions les plus populaires."
              : "Our goal is not to offer the most popular matches. The best selections are not necessarily found in the most popular competitions."
          ),
          React.createElement("p", {className:"philosophy-text"},
            lang==="fr"
              ? "Le Concile IA analyse de nombreux championnats dans le monde et retient uniquement les rencontres qui repondent a ses criteres. Nous privilegions la qualite de l'analyse plutot que la popularite d'un match."
              : "The AI Council analyzes many championships worldwide and only selects matches that meet its criteria. We prioritize the quality of analysis over the popularity of a match."
          )
        )
      )
    ),

    // ════ 8. TELEGRAM ════
    React.createElement("section", {className:"telegram-section reveal"},
      React.createElement("div", {className:"telegram-card"},
        React.createElement("div", {className:"telegram-info"},
          React.createElement("div", {className:"telegram-label"}, t("canal_telegram")),
          React.createElement("div", {className:"telegram-title"}, t("recois_pick")),
          React.createElement("div", {className:"telegram-desc"}, t("chaque_matin")),
          React.createElement("div", {className:"telegram-bm"},
            ["Winamax","Betclic","Unibet","PMU"].map(function(b) {
              return React.createElement("span", {key:b}, b);
            })
          )
        ),
        React.createElement("a", {href:TELEGRAM_LINK, target:"_blank", className:"telegram-btn"}, t("rejoindre_telegram"))
      )
    ),

    // ════ 9. TEMOIGNAGES ════
    React.createElement("section", {className:"section reveal"},
      React.createElement("div", {className:"container"},
        React.createElement("div", {className:"section-tag"}, t("ils_gagnent")),
        React.createElement("div", {className:"testi-grid"},
          temoignages.map(function(te,i) {
            return React.createElement("div", {key:i, className:"testi-card"},
              React.createElement("div", {className:"testi-text"}, "\""+te.txt+"\""),
              React.createElement("div", {className:"testi-footer"},
                React.createElement("div", null,
                  React.createElement("div", {className:"testi-name"}, te.nom),
                  React.createElement("div", {className:"testi-city"}, te.ville)
                ),
                React.createElement("div", {className:"testi-gain"}, te.gains)
              )
            );
          })
        )
      )
    ),

    // ════ 10. FAQ ════
    React.createElement("section", {className:"faq-section reveal"},
      React.createElement("div", {className:"container", style:{textAlign:"center"}},
        React.createElement("div", {className:"section-tag", style:{justifyContent:"center"}}, t("questions_frequentes")),
        React.createElement("div", {className:"faq-list"},
          faqs.map(function(f,i) {
            var open = faqOpen === i;
            return React.createElement("div", {key:i, className:"faq-item" + (open ? " open" : "")},
              React.createElement("button", {className:"faq-q", onClick:function(){setFaqOpen(open?null:i);}},
                React.createElement("span", null, f.q),
                React.createElement("span", {className:"faq-icon"}, "+")
              ),
              React.createElement("div", {className:"faq-body", style:{maxHeight:open?"200px":"0"}},
                React.createElement("div", {className:"faq-body-inner"}, f.a)
              )
            );
          })
        )
      )
    ),

    // ════ 11. CTA FINAL ════
    React.createElement("section", {className:"cta-section reveal"},
      React.createElement("div", {className:"cta-box"},
        React.createElement("div", {className:"cta-eyebrow"}, t("pret_gagner")),
        React.createElement("div", {className:"cta-title"}, t("rejoignez")),
        React.createElement("p", {className:"cta-desc"}, t("bonus_winamax")),
        React.createElement("a", {href:WINAMAX_LINK, target:"_blank", className:"btn-primary", style:{margin:"0 auto"}}, t("ouvrir_compte_winamax"))
      )
    ),

    // ════ 12. PARTENAIRES ════
    React.createElement("section", {className:"section reveal"},
      React.createElement("div", {className:"container"},
        React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"4px"}},
          React.createElement("div", {className:"section-tag"}, t("nos_partenaires")),
          React.createElement("button", {onClick:function(){setPage("bookmakers");}, style:{background:"transparent",border:"1px solid var(--border-green)",color:"var(--green)",padding:"6px 14px",borderRadius:"8px",cursor:"pointer",fontSize:"11px",fontFamily:"'Inter',sans-serif",fontWeight:"600"}}, t("voir_tous"))
        ),
        React.createElement("div", {className:"partners-grid"},
          bookmakers.slice(0,3).map(function(b,i) {
            return React.createElement("a", {key:i, href:b.link, target:"_blank", className:"partner-card"},
              React.createElement("div", {className:"partner-name"}, b.nom),
              React.createElement("div", {className:"partner-bonus"}, b.bonus),
              React.createElement("button", {className:"partner-btn"}, t("sinscrire"))
            );
          })
        )
      )
    ),

    footer,
    bandeauLegal
  );
}
