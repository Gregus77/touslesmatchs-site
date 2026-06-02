import React from "react";
import "./App.css";
import CGU from "./CGU";
import MentionsLegales from "./MentionsLegales";
import Confidentialite from "./Confidentialite";

var WINAMAX_LINK = "https://www.winamax.fr/parrain?code=77953728";
var BETCLIC_LINK = "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ";
var UNIBET_LINK = "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254";
var PMU_LINK = "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728";
var ZEBET_LINK = "#";
var PARIONSSPORT_LINK = "#";
var NETBET_LINK = "#";
var TIKTOK_LINK = "https://www.tiktok.com/@touslesmatchs.com";
var TELEGRAM_LINK = "https://t.me/touslesmatchs_bot";

var picks = [
  ["03/06","Carolina Hurricanes vs Vegas Golden Knights","CAR Vainqueur","1.70","---","EN ATTENTE","Hockey",8.4,8],
  ["02/06","Canada vs Uzbekistan","Canada Vainqueur","1.58","2-0","GAGNE","Foot",7.1,7],
  ["31/05","OKC Thunder vs San Antonio Spurs","OKC Vainqueur","1.65","103-111","PERDU","Basketball",8.1,8],
  ["29/05","San Antonio Spurs vs OKC Thunder","SAS Vainqueur","1.70","118-91","GAGNE","Basketball",8.6,8],
  ["26/05 au 30/05","PAS DE PARI - Aucun match n atteint notre seuil 7/10","---","---","---","NOPICK","",0,8],
  ["22/05","New York Knicks vs Cleveland Cavaliers","Plus de 215.5 pts","1.87","109-93 (202 pts)","PERDU","Basketball",8.2,8],
  ["20/05","Fribourg vs Aston Villa","Victoire Aston Villa","1.58","0-1","GAGNE","Foot",9.1,8],
  ["19/05","New York Knicks vs Cleveland Cavaliers","Plus de 216.5 pts","1.85","115-104 (219 pts)","GAGNE","Basketball",8.8,8],
  ["19/05","Boca Juniors vs Cruzeiro","Moins de 2.5 buts","1.40","1-1","GAGNE","Foot",8.3,8],
  ["14/05 au 17/05","PAS DE PARI - Aucun match n atteint notre seuil 7/10","---","---","---","NOPICK","",0,8],
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
  {q:"C est vraiment gratuit ?", a:"Oui, 100% gratuit. Nous sommes remuneres via les liens d affiliation bookmakers. En vous inscrivant via nos liens, vous nous aidez a maintenir le service - merci."},
  {q:"Comment votre IA analyse les matchs ?", a:"Notre modele croise la forme recente, les blessures, les confrontations directes, les stats domicile/exterieur et bien d autres variables. Seuls les picks avec un score de confiance superieur ou egal a 8/10 sont publies."},
  {q:"Combien de picks par jour ?", a:"Un seul pick par jour, maximum. Qualite plutot que quantite. Les jours sans pick 8/10 sont indiques clairement : on ne force jamais un pari."},
  {q:"Quel bankroll est recommande ?", a:"Ne misez jamais plus de 2 a 5% de votre bankroll total sur un seul pick. Les paris sportifs comportent des risques, jouez de facon responsable."},
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
  var loveToastState = React.useState(false);
  var loveToast = loveToastState[0];
  var setLoveToast = loveToastState[1];

  function handleTagalog() {
    setLoveToast(true);
    setTimeout(function(){ setLoveToast(false); }, 4000);
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

  var wins = picks.filter(function(p){return p[5]==="GAGNE";}).length;
  var total = picks.filter(function(p){return p[5]!=="NOPICK" && p[5]!=="EN COURS" && p[5]!=="EN ATTENTE";}).length;
  var winrate = Math.round((wins/total)*100);

  // Trouver le pick du JOUR en priorité (date d'aujourd'hui), puis le prochain à venir
  var todayStr = new Date().toLocaleDateString("fr-FR", {day:"2-digit", month:"2-digit"});
  var pickAujourdhui = picks.find(function(p){ return p[5]==="EN ATTENTE" && p[0]===todayStr; });
  // Si pas de pick aujourd'hui, prendre le plus proche dans le futur (ordre inversé = plus ancien en premier)
  var prochainPick = pickAujourdhui || picks.slice().reverse().find(function(p){ return p[5]==="EN ATTENTE"; });
  var pickDuJour = prochainPick || picks[0];
  var isNoPick = !prochainPick && (picks[0][5]==="NOPICK" || picks[0][5]==="GAGNE" || picks[0][5]==="PERDU");
  var isEnCours = pickDuJour[5]==="EN COURS";
  var isEnAttente = pickDuJour[5]==="EN ATTENTE";
  var isToday = pickDuJour[0] === todayStr;
  var pickLabel = isEnAttente ? (isToday ? "PICK DU JOUR" : "PROCHAIN MATCH A JOUER") : isNoPick ? "PAS DE MATCH AUJOURD HUI" : "PICK DU JOUR";

  // Threshold : index [8] = 8 (PREMIUM) ou 7 (STANDARD)
  var pickThreshold = pickDuJour[8] || 8;
  var pickAiScore   = pickDuJour[7] || 0;
  var isPremium     = pickThreshold >= 8;
  var isStandard7   = pickThreshold === 7;
  var pickBadge     = isPremium ? "⭐ PICK PREMIUM" : "🔔 PICK STANDARD";
  var pickBadgeColor = isPremium ? "#d4af37" : "#f59e0b";
  var pickBorderColor = isPremium ? "rgba(212,175,55,0.35)" : "rgba(245,158,11,0.5)";

  var filtered = filter === "ALL" ? picks : picks.filter(function(p){
    return p[5]==="NOPICK" || p[5]==="EN COURS" || p[5]==="EN ATTENTE" || p[6]===filter;
  });

  var loveToastEl = loveToast ? React.createElement("div", {style:{
    position:"fixed", top:"80px", left:"50%", transform:"translateX(-50%)",
    background:"linear-gradient(135deg,#ff4d8d,#c0185a)",
    borderRadius:"16px", padding:"18px 32px", zIndex:999,
    boxShadow:"0 8px 40px rgba(255,77,141,0.45)",
    textAlign:"center", minWidth:"280px",
    animation:"fadeInDown 0.4s ease"
  }},
    React.createElement("div",{style:{fontSize:"28px",marginBottom:"6px"}},"🇵🇭 ❤️"),
    React.createElement("div",{style:{fontSize:"22px",fontWeight:"bold",color:"#fff",fontFamily:"'Bodoni Moda',serif",marginBottom:"4px"}},"Mahal kita, mahal ko"),
    React.createElement("div",{style:{fontSize:"12px",color:"rgba(255,255,255,0.75)"}}, "Je t'aime mon amour ❤️")
  ) : null;

  var bandeauLegal = React.createElement("div", {style:{position:"fixed",bottom:0,left:0,right:0,background:"#000",borderTop:"1px solid rgba(255,255,255,0.07)",padding:"7px 20px",textAlign:"center",zIndex:100}},
    React.createElement("div", {style:{fontSize:"10px",color:"#555",lineHeight:"1.8"}}, "🔞 Jeu responsable — Interdit aux moins de 18 ans  |  joueurs-info-service.fr  |  09 74 75 13 13"),
    React.createElement("div", {style:{fontSize:"9px",color:"#2d2d2d",marginTop:"1px"}}, "Les paris comportent des risques de perte financiere. Pariez de maniere responsable.")
  );

  var footer = React.createElement("footer", {style:{borderTop:"1px solid rgba(212,175,55,0.1)",padding:"28px 30px 90px",textAlign:"center"}},
    React.createElement("div", {style:{fontSize:"12px",fontWeight:"bold",color:"#d4af37",letterSpacing:"3px",marginBottom:"14px"}}, "TOUSLESMATCHS.COM"),
    React.createElement("div", {style:{display:"flex",justifyContent:"center",gap:"20px",flexWrap:"wrap",marginBottom:"12px"}},
      React.createElement("button", {onClick:function(){setPage("cgu");}, style:{background:"transparent",border:"none",color:"#555",fontSize:"11px",cursor:"pointer",textDecoration:"underline",fontFamily:"Georgia,serif"}}, "CGU"),
      React.createElement("button", {onClick:function(){setPage("mentions");}, style:{background:"transparent",border:"none",color:"#555",fontSize:"11px",cursor:"pointer",textDecoration:"underline",fontFamily:"Georgia,serif"}}, "Mentions Legales"),
      React.createElement("button", {onClick:function(){setPage("confidentialite");}, style:{background:"transparent",border:"none",color:"#555",fontSize:"11px",cursor:"pointer",textDecoration:"underline",fontFamily:"Georgia,serif"}}, "Confidentialite"),
      React.createElement("a", {href:TIKTOK_LINK,target:"_blank",style:{color:"#555",fontSize:"11px",textDecoration:"underline"}}, "TikTok"),
      React.createElement("a", {href:TELEGRAM_LINK,target:"_blank",style:{color:"#29b6f6",fontSize:"11px",textDecoration:"underline"}}, "Telegram")
    ),
    React.createElement("div", {style:{fontSize:"10px",color:"#2a2a2a"}}, "© 2026 TousLesMatchs.com — Tous droits reserves")
  );

  var header = React.createElement("header", {style:{borderBottom:"1px solid rgba(212,175,55,0.2)",padding:"16px 30px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(8,12,20,0.98)",position:"sticky",top:0,zIndex:50,flexWrap:"wrap",gap:"10px"}},
    React.createElement("div", {style:{cursor:"pointer"},onClick:function(){setPage("home");}},
      React.createElement("div", {style:{fontSize:"16px",fontWeight:"700",color:"#d4af37",letterSpacing:"0.12em",fontFamily:"'Bodoni Moda',serif",textTransform:"uppercase"}}, "TousLesMatchs"),
      React.createElement("div", {style:{fontSize:"8px",color:"#4a4438",letterSpacing:"0.22em",textTransform:"uppercase",fontFamily:"'Jost',sans-serif"}}, "Analyse · Intelligence · Résultats")
    ),
    React.createElement("nav", {style:{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}},
      ["home","preuves","bookmakers"].map(function(p){
        var labels = {home:"Choix", preuves:"Preuves", bookmakers:"Les bookmakers"};
        return React.createElement("button", {key:p, onClick:function(){setPage(p);}, style:{background:page===p?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(page===p?"#d4af37":"rgba(255,255,255,0.1)"),color:page===p?"#d4af37":"#666",padding:"6px 14px",borderRadius:"4px",cursor:"pointer",fontSize:"12px"}}, labels[p]);
      }),
      React.createElement("a", {href:TIKTOK_LINK,target:"_blank",style:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"4px",padding:"6px 14px",color:"#fff",textDecoration:"none",fontSize:"12px"}}, "TikTok"),
      React.createElement("a", {href:TELEGRAM_LINK,target:"_blank",style:{background:"rgba(0,136,204,0.15)",border:"1px solid rgba(0,136,204,0.4)",borderRadius:"4px",padding:"6px 14px",color:"#29b6f6",textDecoration:"none",fontSize:"12px",fontWeight:"bold"}}, "Telegram"),
      React.createElement("div",{style:{display:"flex",gap:"4px",marginLeft:"4px",alignItems:"center"}},
        React.createElement("button",{title:"Français",style:{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"4px",padding:"4px 7px",cursor:"pointer",fontSize:"16px",lineHeight:"1"}},"🇫🇷"),
        React.createElement("button",{title:"English",style:{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"4px",padding:"4px 7px",cursor:"pointer",fontSize:"16px",lineHeight:"1"}},"🇬🇧"),
        React.createElement("button",{title:"Tagalog",onClick:handleTagalog,style:{background:"rgba(255,77,141,0.1)",border:"1px solid rgba(255,77,141,0.35)",borderRadius:"4px",padding:"4px 7px",cursor:"pointer",fontSize:"16px",lineHeight:"1",transition:"transform 0.15s"},onMouseEnter:function(e){e.target.style.transform="scale(1.2)"},onMouseLeave:function(e){e.target.style.transform="scale(1)"}},"🇵🇭")
      )
    )
  );


  if(page==="cgu") return React.createElement(React.Fragment, null, loveToastEl, React.createElement(CGU, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal}));
  if(page==="mentions") return React.createElement(React.Fragment, null, loveToastEl, React.createElement(MentionsLegales, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal}));
  if(page==="confidentialite") return React.createElement(React.Fragment, null, loveToastEl, React.createElement(Confidentialite, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal}));

  if(page==="preuves"){
    return React.createElement("div", {style:{background:"linear-gradient(180deg,#131826 0%,#0b1018 500px,#080c14 100%)",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0"}},
      header,
      React.createElement("div", {style:{maxWidth:"900px",margin:"0 auto",padding:"40px 30px"}},
        React.createElement("h2", {style:{color:"#d4af37",letterSpacing:"3px",fontSize:"14px",marginBottom:"8px"}}, "PREUVES DE GAINS"),
        React.createElement("p", {style:{color:"#555",fontSize:"13px",marginBottom:"30px"}}, "Toutes nos captures d ecran Winamax. 100% transparent, 0% cache."),
        React.createElement("div", {style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"16px"}},
          preuves.map(function(p,i){
            return React.createElement("div", {key:i, style:{background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.15)",borderRadius:"10px",overflow:"hidden"}},
              React.createElement("img", {src:p.img,alt:p.match,loading:"lazy",onError:function(e){e.target.style.display="none";e.target.nextSibling.style.display="flex";},style:{width:"100%",height:"320px",objectFit:"contain",background:"rgba(0,0,0,0.4)",display:"block"}}),
              React.createElement("div", {style:{width:"100%",height:"320px",background:"rgba(212,175,55,0.03)",display:"none",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"8px"}},
                React.createElement("div", {style:{color:"#444",fontSize:"11px",letterSpacing:"2px"}}, "CAPTURE A VENIR")
              ),
              React.createElement("div", {style:{padding:"16px"}},
                React.createElement("div", {style:{fontSize:"11px",color:"#555",marginBottom:"4px"}}, p.date),
                React.createElement("div", {style:{fontSize:"14px",color:"#ddd",marginBottom:"8px"}}, p.match),
                React.createElement("div", {style:{fontSize:"18px",fontWeight:"bold",color:"#22cc44"}}, p.gain)
              )
            );
          })
        ),
        React.createElement("div", {style:{marginTop:"40px",padding:"24px",background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.15)",borderRadius:"10px",textAlign:"center"}},
          React.createElement("p", {style:{color:"#555",fontSize:"13px",margin:"0 0 16px"}}, "Vous aussi, pariez avec les memes picks que nous"),
          React.createElement("a", {href:WINAMAX_LINK,target:"_blank",style:{display:"inline-block",background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"6px",padding:"12px 30px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"13px"}}, "Ouvrir un compte Winamax")
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
        React.createElement("h2", {style:{color:"#d4af37",letterSpacing:"3px",fontSize:"14px",marginBottom:"8px"}}, "NOS BOOKMAKERS PARTENAIRES"),
        React.createElement("p", {style:{color:"#555",fontSize:"13px",marginBottom:"6px"}}, "Tous nos partenaires sont agrees ANJ - Paris legaux et securises en France."),
        React.createElement("p", {style:{color:"#444",fontSize:"11px",marginBottom:"30px"}}, "En vous inscrivant via nos liens vous nous aidez a maintenir ce service gratuit. Merci."),
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
                React.createElement("a", {href:b.link,target:"_blank",style:{background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"6px",padding:"11px 24px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"12px",whiteSpace:"nowrap"}}, "S inscrire"),
                React.createElement("span", {style:{color:"#333",fontSize:"9px",letterSpacing:"1px"}}, "Lien affilie")
              )
            );
          })
        )
      ),
      footer,
      bandeauLegal
    );
  }

  return React.createElement("div", {style:{background:"linear-gradient(180deg,#0a0906 0%,#0b0d12 500px,#080c14 100%)",minHeight:"100vh",fontFamily:"'Jost',sans-serif",color:"#e8e0d0"}},
    loveToastEl,
    header,
    React.createElement("section", {style:{padding:"60px 30px 30px",textAlign:"center"}},
      /* Badges 5 IAs */
      React.createElement("div", {style:{display:"flex",justifyContent:"center",gap:"6px",flexWrap:"wrap",marginBottom:"18px"}},
        [
          {nom:"Groq",    dot:"#22c55e"},
          {nom:"Gemini",  dot:"#3b82f6"},
          {nom:"DeepSeek",dot:"#f97316"},
          {nom:"Mistral", dot:"#a855f7"},
          {nom:"Claude",  dot:"#d4af37"},
        ].map(function(ia,i){
          return React.createElement("div",{key:i,style:{display:"inline-flex",alignItems:"center",gap:"5px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"20px",padding:"4px 12px"}},
            React.createElement("div",{style:{width:"6px",height:"6px",borderRadius:"50%",background:ia.dot,flexShrink:0}}),
            React.createElement("span",{style:{fontSize:"10px",color:"#888",fontWeight:"600",letterSpacing:"0.06em"}}, ia.nom)
          );
        })
      ),
      React.createElement("div", {style:{fontSize:"13px",letterSpacing:"4px",color:"#d4af37",marginBottom:"16px",fontFamily:"'Jost',sans-serif",fontWeight:"600",textTransform:"uppercase"}}, "5 Intelligences Artificielles · Concile V4.3"),
      React.createElement("h1", {style:{fontSize:"clamp(36px,5.5vw,64px)",fontWeight:"700",color:"#fff",margin:"0 0 16px",fontFamily:"'Bodoni Moda',serif",lineHeight:"1.08",letterSpacing:"-0.02em"}},
        "Le meilleur ", React.createElement("em", {style:{color:"#d4af37",fontStyle:"italic"}}, "pick"), " chaque jour."
      ),
      React.createElement("p", {style:{color:"#6b6356",fontSize:"17px",maxWidth:"540px",margin:"0 auto 12px",lineHeight:"1.8",fontWeight:"300"}},
        "Groq, Gemini, DeepSeek, Mistral et Claude analysent chaque matin des centaines de matchs en concert."
      ),
      React.createElement("p", {style:{color:"#4a4438",fontSize:"14px",maxWidth:"480px",margin:"0 auto 36px",lineHeight:"1.7",fontWeight:"400"}},
        "Seuil minimum publié : ", React.createElement("strong",{style:{color:"#d4af37"}},"8/10"), ". En dessous, fallback à ", React.createElement("strong",{style:{color:"#f59e0b"}},"7/10"), " pour garantir un pick quotidien."
      ),
      React.createElement("div", {style:{display:"flex",justifyContent:"center",maxWidth:"700px",margin:"0 auto",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"8px",overflow:"hidden"}},
        [{label:"WIN RATE",value:winrate+"%",sub:"sur "+total+" paris"},{label:"BANKROLL",value:"+394%",sub:"depuis le debut"},{label:"PICKS",value:wins+"W / "+(total-wins)+"L",sub:"serie en cours"},{label:"SERIE",value:wins+"W",sub:"sur "+total+" picks"}].map(function(s,i){
          return React.createElement("div", {key:i, style:{flex:1,padding:"18px 8px",borderRight:i<3?"1px solid rgba(212,175,55,0.15)":"none"}},
            React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:"4px"}}, s.label),
            React.createElement("div", {style:{fontSize:"22px",fontWeight:"bold",color:"#d4af37"}}, s.value),
            React.createElement("div", {style:{fontSize:"10px",color:"#444",marginTop:"3px"}}, s.sub)
          );
        })
      )
    ),
    React.createElement("section", {style:{padding:"10px 30px 30px",maxWidth:"780px",margin:"0 auto"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"13px",letterSpacing:"4px",textAlign:"center",marginBottom:"24px",fontFamily:"'Jost',sans-serif",fontWeight:"600"}}, "COMMENT CA MARCHE"),
      React.createElement("div", {style:{display:"flex",gap:"14px",flexWrap:"wrap"}},
        [{num:"01",title:"5 IAs scannent tout",desc:"Groq, Gemini, DeepSeek, Mistral et Claude analysent ensemble des centaines de matchs sur 50+ ligues chaque matin."},{num:"02",title:"Seuil 8/10 — fallback 7/10",desc:"Les picks >= 8/10 sont PREMIUM. Si aucun match ne l atteint, le Concile descend a 7/10 pour garantir un pick quotidien, indique clairement."},{num:"03",title:"Tu mises, tu gagnes",desc:"Recois le pick, mise chez ton bookmaker partenaire, encaisse tes gains. PREMIUM = mise pleine. STANDARD 7/10 = demi-mise recommandee."}].map(function(s,i){
          return React.createElement("div",{key:i,style:{flex:1,minWidth:"200px",background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.12)",borderRadius:"12px",padding:"22px 20px"}},
            React.createElement("div",{style:{fontSize:"28px",fontWeight:"bold",color:"rgba(212,175,55,0.25)",marginBottom:"10px",fontFamily:"'Bodoni Moda',serif"}},s.num),
            React.createElement("div",{style:{fontSize:"16px",fontWeight:"600",color:"#fff",marginBottom:"8px",fontFamily:"'Bodoni Moda',serif"}},s.title),
            React.createElement("div",{style:{fontSize:"14px",color:"#6b6356",lineHeight:"1.75"}},s.desc)
          );
        })
      )
    ),
    React.createElement("section", {style:{padding:"10px 30px 20px",maxWidth:"780px",margin:"0 auto"}},
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
            ? "Aucun match ne passe nos criteres aujourd hui. Prochain pick des que le Concile valide un match."
            : (!isNoPick && pickDuJour[6]) ? sportEmoji(pickDuJour[6])+pickDuJour[1] : pickDuJour[1]
        ),

        /* Marché + Cote */
        isNoPick ? null : React.createElement("div", {style:{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap",marginBottom:"16px"}},
          React.createElement("span", {style:{background:"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:"4px",padding:"5px 14px",color:"#d4af37",fontSize:"12px",fontWeight:"600",letterSpacing:"0.04em"}}, pickDuJour[2]),
          React.createElement("span", {style:{color:"#fff",fontWeight:"700",fontSize:"18px",fontFamily:"'Bodoni Moda',serif"}}, "Cote: "+pickDuJour[3])
        ),

        /* Panel Concile V4.3 — votes des 5 IAs */
        isNoPick ? null : React.createElement("div", {style:{
          background:"rgba(255,255,255,0.03)",
          border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:"8px", padding:"12px 16px", marginBottom:"14px"
        }},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"3px",color:"#555",marginBottom:"12px",fontWeight:"600"}}, "CONCILE V4.3 — ANALYSE PAR 5 IAs"),
          React.createElement("div", {style:{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center",marginBottom:"10px"}},
            [
              {nom:"Groq",   color:"#22c55e", role:"Scanner"},
              {nom:"Gemini", color:"#3b82f6", role:"H2H"},
              {nom:"DeepSeek",color:"#f97316",role:"Forme"},
              {nom:"Mistral",color:"#a855f7", role:"Contexte"},
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
            React.createElement("span", {style:{fontSize:"9px",color:"#555",letterSpacing:"1px",whiteSpace:"nowrap"}}, "CONFIANCE IA"),
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
          React.createElement("div", {style:{fontSize:"11px",color:"#f59e0b",fontWeight:"bold",marginBottom:"3px"}}, "⚠️  SEUIL ABAISSE A 7/10"),
          React.createElement("div", {style:{fontSize:"11px",color:"#888",lineHeight:"1.6"}},
            "Aucun match n a atteint notre seuil habituel de 8/10 aujourd hui. Ce pick est publie a seuil reduit pour les abonnes. Mise recommandee : 5 EUR maximum."
          )
        ),

        /* CTA */
        isNoPick ? null : React.createElement("a", {href:WINAMAX_LINK,target:"_blank",style:{display:"inline-block",background:isPremium?"linear-gradient(135deg,#d4af37,#f5d76e)":"linear-gradient(135deg,#f59e0b,#fbbf24)",borderRadius:"6px",padding:"10px 24px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"13px"}}, "Parier sur Winamax")
      )
    ),
    React.createElement("section", {style:{padding:"10px 30px 24px",maxWidth:"780px",margin:"0 auto"}},
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
            React.createElement("span",{style:{fontSize:"11px",letterSpacing:"3px",color:"#29b6f6",fontWeight:"700"}},"📲 CANAL TELEGRAM GRATUIT")
          ),
          React.createElement("div",{style:{fontSize:"18px",fontWeight:"700",color:"#fff",marginBottom:"6px",fontFamily:"'Bodoni Moda',serif"}},"Reçois le pick + les liens pour parier"),
          React.createElement("div",{style:{fontSize:"13px",color:"#888",marginBottom:"8px"}},"Chaque matin, le pick du jour avec les boutons directs vers les bookmakers."),
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
          "✈️ Rejoindre — C'est gratuit")
      )
    ),
    React.createElement("section", {style:{padding:"10px 30px 30px",maxWidth:"980px",margin:"0 auto"}},
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}},
        React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",margin:0}}, "HISTORIQUE DES PICKS"),
        React.createElement("div", {style:{display:"flex",gap:"6px",flexWrap:"wrap"}},
          [{key:"ALL",label:"Tous"},{key:"Foot",label:"⚽ Foot"},{key:"Hockey",label:"🏒 Hockey"},{key:"Basketball",label:"🏀 Basket"}].map(function(f){
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
          var label=np?"---":ec?"A VENIR ⏳":ea?"EN ATTENTE ⏳":g?"GAGNE":"PERDU";
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
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",marginBottom:"16px"}}, "ILS GAGNENT AVEC NOUS"),
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
    React.createElement("section", {style:{padding:"10px 30px 30px",maxWidth:"780px",margin:"0 auto"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",marginBottom:"16px"}}, "QUESTIONS FREQUENTES"),
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
    React.createElement("section", {style:{padding:"10px 30px 30px",maxWidth:"780px",margin:"0 auto"}},
      React.createElement("div", {style:{background:"rgba(212,175,55,0.06)",border:"1px solid rgba(212,175,55,0.25)",borderRadius:"12px",padding:"28px",textAlign:"center"}},
        React.createElement("div",{style:{fontSize:"12px",letterSpacing:"4px",color:"#d4af37",marginBottom:"12px",fontFamily:"'Jost',sans-serif",fontWeight:"600"}},"PRET A GAGNER ?"),
        React.createElement("div",{style:{fontSize:"28px",fontWeight:"700",color:"#fff",marginBottom:"14px",fontFamily:"'Bodoni Moda',serif",lineHeight:"1.2"}},"Rejoignez les parieurs qui nous font confiance"),
        React.createElement("p",{style:{color:"#555",fontSize:"12px",marginBottom:"20px",maxWidth:"400px",marginLeft:"auto",marginRight:"auto"}},"Ouvre ton compte Winamax maintenant et recois jusqu a 200 EUR de bonus de bienvenue."),
        React.createElement("a",{href:WINAMAX_LINK,target:"_blank",style:{display:"inline-block",background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"8px",padding:"13px 32px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"13px",letterSpacing:"1px"}},"Ouvrir un compte Winamax - GRATUIT")
      )
    ),
    React.createElement("section", {style:{padding:"0 30px 30px",maxWidth:"780px",margin:"0 auto"}},
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}},
        React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",margin:0}}, "NOS PARTENAIRES"),
        React.createElement("button", {onClick:function(){setPage("bookmakers");},style:{background:"transparent",border:"1px solid rgba(212,175,55,0.3)",color:"#d4af37",padding:"5px 12px",borderRadius:"4px",cursor:"pointer",fontSize:"11px"}}, "Voir tous")
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

