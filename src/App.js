import React from "react"; 
import CGU from "./CGU";
import MentionsLegales from "./MentionsLegales";
import Confidentialite from "./Confidentialite";

var WINAMAX_LINK = "https://www.winamax.fr/parrain?code=WMX8M5";
var BETCLIC_LINK = "https://www.betclic.fr/fr-fr/sports/?promocode=GREGA3GZ";
var UNIBET_LINK = "https://www.unibet.fr/inscription/?campaign=120526&parrain=5EBF919DF1008254";
var PMU_LINK = "https://www.pmu.fr/turf/static/offre-parrainage/?codeParrainage=779753728";
var ZEBET_LINK = "https://www.zebet.fr/affiliation-TONLIEN";
var PARIONSSPORT_LINK = "https://www.parionssport.fdj.fr/affiliation-TONLIEN";
var NETBET_LINK = "https://www.netbet.fr/affiliation-TONLIEN";
var TIKTOK_LINK = "https://www.tiktok.com/@touslesmatchs.com";

var picks = [
  ["22/05","New York Knicks vs Cleveland Cavaliers","Plus de 215.5 pts","1.87","109-93 (202 pts)","PERDU","Basketball"],
  ["20/05","Fribourg vs Aston Villa","Victoire Aston Villa","1.58","0-1","GAGNE","Foot"],
  ["19/05","New York Knicks vs Cleveland Cavaliers","Plus de 216.5 pts","1.85","115-104 (219 pts)","GAGNE","Basketball"],
  ["19/05","Boca Juniors vs Cruzeiro","Moins de 2.5 buts","1.40","1-1","GAGNE","Foot"],
  ["17/05","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],
  ["15/05","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],
  ["14/05","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK",""],
  ["13/05","Lazio vs Inter Milan","Inter ML","1.66","0-2","GAGNE","Foot"],
  ["13/05","Villarreal vs Seville","Over 2.5","1.75","2-2","GAGNE","Foot"],
  ["11/05","Carolina vs Philadelphia","Carolina ML","1.58","4-2","GAGNE","Hockey"],
  ["10/05","Colorado vs Minnesota","Colorado ML","1.62","5-1","GAGNE","Hockey"],
  ["09/05","VGK vs Anaheim","VGK ML","1.55","6-2","GAGNE","Hockey"],
  ["08/05","Carolina vs Philadelphia","Carolina ML","1.52","4-1","GAGNE","Hockey"],
  ["07/05","Anaheim vs VGK","Anaheim ML","1.78","3-1","GAGNE","Hockey"],
  ["06/05","Buffalo vs Montreal","Buffalo ML","1.60","1-5","PERDU","Hockey"],
  ["05/05","VGK vs Anaheim","VGK ML","1.54","3-1","GAGNE","Hockey"],
  ["04/05","Colorado vs Minnesota","Colorado ML","1.58","9-6","GAGNE","Hockey"],
  ["03/05","Carolina vs Philadelphia","Carolina ML","1.50","3-0","GAGNE","Hockey"],
  ["02/05","Utah vs VGK","VGK ML","1.62","5-1","GAGNE","Hockey"],
  ["01/05","Buffalo vs Boston","Buffalo ML","1.70","4-1","GAGNE","Hockey"],
  ["29/04","Leverkusen vs Dortmund","Over 2.5","1.62","3-1","GAGNE","Foot"],
  ["28/04","Bayern vs Stuttgart","Over 2.5","1.55","1-0","PERDU","Foot"]
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

var PICKS_PAR_PAGE = 100;

function sportEmoji(sport) {
  if(sport==="Foot") return "⚽ ";
  if(sport==="Hockey") return "🏒 ";
  if(sport==="Tennis") return "🎾 ";
  if(sport==="Basketball") return "🏀 ";
  if(sport==="Baseball") return "⚾ ";
  if(sport==="Volleyball") return "🏐 ";
  if(sport==="MLS") return "⚽🇺🇸 ";
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
  var pickPageState = React.useState(1);
  var pickPage = pickPageState[0];
  var setPickPage = pickPageState[1];

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
  var pickDuJour = picks[0];
  var isNoPick = pickDuJour[5]==="NOPICK";
  var isEnCours = pickDuJour[5]==="EN COURS";
  var isEnAttente = pickDuJour[5]==="EN ATTENTE";

  var filtered = filter === "ALL" ? picks : picks.filter(function(p){
    return p[5]==="NOPICK" || p[5]==="EN COURS" || p[5]==="EN ATTENTE" || p[6]===filter;
  });

  var totalPages = Math.ceil(filtered.length / PICKS_PAR_PAGE);
  var pickPageSafe = Math.min(pickPage, totalPages);
  var filteredPage = filtered.slice((pickPageSafe-1)*PICKS_PAR_PAGE, pickPageSafe*PICKS_PAR_PAGE);

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
      React.createElement("a", {href:TIKTOK_LINK,target:"_blank",style:{color:"#555",fontSize:"11px",textDecoration:"underline"}}, "TikTok")
    ),
    React.createElement("div", {style:{fontSize:"10px",color:"#2a2a2a"}}, "© 2026 TousLesMatchs.com — Tous droits reserves")
  );

  var header = React.createElement("header", {style:{borderBottom:"1px solid rgba(212,175,55,0.2)",padding:"16px 30px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(8,12,20,0.98)",position:"sticky",top:0,zIndex:50,flexWrap:"wrap",gap:"10px"}},
    React.createElement("div", {style:{cursor:"pointer"},onClick:function(){setPage("home");}},
      React.createElement("div", {style:{fontSize:"18px",fontWeight:"bold",color:"#d4af37",letterSpacing:"3px"}}, "TOUSLESMATCHS"),
      React.createElement("div", {style:{fontSize:"9px",color:"#555",letterSpacing:"3px"}}, "ANALYSE - INTELLIGENCE - RESULTATS")
    ),
    React.createElement("nav", {style:{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}},
      ["home","preuves","bookmakers"].map(function(p){
        var labels = {home:"Choix", preuves:"Preuves", bookmakers:"Les bookmakers"};
        return React.createElement("button", {key:p, onClick:function(){setPage(p);}, style:{background:page===p?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(page===p?"#d4af37":"rgba(255,255,255,0.1)"),color:page===p?"#d4af37":"#666",padding:"6px 14px",borderRadius:"4px",cursor:"pointer",fontSize:"12px"}}, labels[p]);
      }),
      React.createElement("a", {href:TIKTOK_LINK,target:"_blank",style:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"4px",padding:"6px 14px",color:"#fff",textDecoration:"none",fontSize:"12px"}}, "TikTok")
    )
  );

  if(page==="cgu") return React.createElement(CGU, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal});
  if(page==="mentions") return React.createElement(MentionsLegales, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal});
  if(page==="confidentialite") return React.createElement(Confidentialite, {setPage:setPage, footer:footer, bandeauLegal:bandeauLegal});

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

  return React.createElement("div", {style:{background:"linear-gradient(180deg,#131826 0%,#0b1018 500px,#080c14 100%)",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0"}},
    header,
    React.createElement("section", {style:{padding:"50px 30px 30px",textAlign:"center"}},
      React.createElement("div", {style:{fontSize:"10px",letterSpacing:"6px",color:"#d4af37",marginBottom:"14px"}}, "PROPULSE PAR INTELLIGENCE ARTIFICIELLE"),
      React.createElement("h1", {style:{fontSize:"38px",fontWeight:"bold",color:"#fff",margin:"0 0 10px"}}, "Le meilleur pick chaque jour."),
      React.createElement("p", {style:{color:"#555",fontSize:"13px",maxWidth:"440px",margin:"0 auto 30px"}}, "Notre IA analyse des centaines de matchs. Seulement les paris qui atteignent 8/10 minimum sont publies."),
      React.createElement("div", {style:{display:"flex",justifyContent:"center",maxWidth:"700px",margin:"0 auto",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"8px",overflow:"hidden"}},
        [{label:"WIN RATE",value:winrate+"%",sub:"sur "+total+" paris"},{label:"BANKROLL",value:"+399%",sub:"depuis le debut"},{label:"PICKS",value:wins+"W / 2L",sub:"serie en cours"},{label:"SERIE",value:"19W",sub:"sur 21 picks"}].map(function(s,i){
          return React.createElement("div", {key:i, style:{flex:1,padding:"18px 8px",borderRight:i<3?"1px solid rgba(212,175,55,0.15)":"none"}},
            React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:"4px"}}, s.label),
            React.createElement("div", {style:{fontSize:"22px",fontWeight:"bold",color:"#d4af37"}}, s.value),
            React.createElement("div", {style:{fontSize:"10px",color:"#444",marginTop:"3px"}}, s.sub)
          );
        })
      )
    ),
    React.createElement("section", {style:{padding:"10px 30px 30px",maxWidth:"780px",margin:"0 auto"}},
      React.createElement("h2", {style:{color:"#d4af37",fontSize:"11px",letterSpacing:"4px",textAlign:"center",marginBottom:"20px"}}, "COMMENT CA MARCHE"),
      React.createElement("div", {style:{display:"flex",gap:"12px",flexWrap:"wrap"}},
        [{num:"01",title:"L IA scanne tout",desc:"Notre algorithme analyse des centaines de matchs par jour sur plus de 50 ligues mondiales."},{num:"02",title:"Seuil 8/10 minimum",desc:"Seuls les picks avec un score de confiance superieur a 8/10 passent le filtre et sont publies."},{num:"03",title:"Tu mises, tu gagnes",desc:"Recois le pick, mise chez ton bookmaker partenaire, encaisse tes gains. Aussi simple que ca."}].map(function(s,i){
          return React.createElement("div",{key:i,style:{flex:1,minWidth:"180px",background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.12)",borderRadius:"10px",padding:"18px 16px"}},
            React.createElement("div",{style:{fontSize:"26px",fontWeight:"bold",color:"rgba(212,175,55,0.25)",marginBottom:"8px",fontFamily:"monospace"}},s.num),
            React.createElement("div",{style:{fontSize:"13px",fontWeight:"bold",color:"#fff",marginBottom:"6px"}},s.title),
            React.createElement("div",{style:{fontSize:"11px",color:"#555",lineHeight:"1.6"}},s.desc)
          );
        })
      )
    ),
    React.createElement("section", {style:{padding:"10px 30px 20px",maxWidth:"780px",margin:"0 auto"}},
      React.createElement("div", {style:{background:isNoPick?"rgba(100,100,100,0.06)":(isEnCours||isEnAttente)?"rgba(255,165,0,0.06)":"rgba(212,175,55,0.06)",border:"1px solid "+(isNoPick?"rgba(100,100,100,0.25)":(isEnCours||isEnAttente)?"rgba(255,165,0,0.35)":"rgba(212,175,55,0.35)"),borderRadius:"12px",padding:"24px"}},
        React.createElement("div", {style:{fontSize:"10px",letterSpacing:"4px",color:isNoPick?"#555":(isEnCours||isEnAttente)?"#ffa500":"#d4af37",marginBottom:"8px"}}, (isEnCours||isEnAttente)?"PICK DU JOUR — EN ATTENTE DE RESULTAT ⏳":"PICK DU JOUR"),
        React.createElement("div", {style:{fontSize:"18px",fontWeight:"bold",color:isNoPick?"#555":"#fff",marginBottom:"8px",fontStyle:isNoPick?"italic":"normal"}},
          (!isNoPick && pickDuJour[6]) ? sportEmoji(pickDuJour[6])+pickDuJour[1] : pickDuJour[1]
        ),
        isNoPick ? null : React.createElement("div", {style:{display:"flex",gap:"16px",alignItems:"center",flexWrap:"wrap",marginBottom:"16px"}},
          React.createElement("span", {style:{background:"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:"4px",padding:"4px 12px",color:"#d4af37",fontSize:"12px"}}, pickDuJour[2]),
          React.createElement("span", {style:{color:"#fff",fontWeight:"bold",fontSize:"16px"}}, "Cote: "+pickDuJour[3])
        ),
        isNoPick ? null : React.createElement("a", {href:WINAMAX_LINK,target:"_blank",style:{display:"inline-block",background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"6px",padding:"10px 24px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"13px"}}, "Parier sur Winamax")
      )
    ),
    React.createElement("section", {style:{padding:"10px 30px 30px",maxWidth:"980px",margin:"0 auto"}},
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px",flexWrap:"wrap",gap:"8px"}},
        React.createElement("h2", {style:{color:"#d4af37",fontSize:"12px",letterSpacing:"3px",margin:0}}, "HISTORIQUE DES PICKS"),
        React.createElement("div", {style:{display:"flex",gap:"6px",flexWrap:"wrap"}},
          [{key:"ALL",label:"Tous"},{key:"Foot",label:"⚽ Foot"},{key:"Hockey",label:"🏒 Hockey"},{key:"Basketball",label:"🏀 Basket"},{key:"Tennis",label:"🎾 Tennis"},{key:"Baseball",label:"⚾ Baseball"}].map(function(f){
            return React.createElement("button", {key:f.key,onClick:function(){setFilter(f.key);setPickPage(1);},style:{background:filter===f.key?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(filter===f.key?"#d4af37":"rgba(255,255,255,0.1)"),color:filter===f.key?"#d4af37":"#555",padding:"5px 12px",borderRadius:"4px",cursor:"pointer",fontSize:"12px"}}, f.label);
          })
        )
      ),
      React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"5px"}},
        filteredPage.map(function(p,i){
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
      ),
      totalPages > 1 ? React.createElement("div", {style:{display:"flex",justifyContent:"center",alignItems:"center",gap:"12px",marginTop:"16px"}},
        React.createElement("button", {onClick:function(){setPickPage(function(p){return Math.max(1,p-1);});},disabled:pickPageSafe<=1,style:{background:"transparent",border:"1px solid rgba(212,175,55,0.3)",color:pickPageSafe<=1?"#333":"#d4af37",padding:"6px 16px",borderRadius:"4px",cursor:pickPageSafe<=1?"default":"pointer",fontSize:"12px"}}, "← Precedent"),
        React.createElement("span", {style:{color:"#555",fontSize:"12px"}}, "Page "+pickPageSafe+" / "+totalPages),
        React.createElement("button", {onClick:function(){setPickPage(function(p){return Math.min(totalPages,p+1);});},disabled:pickPageSafe>=totalPages,style:{background:pickPageSafe>=totalPages?"transparent":"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.3)",color:pickPageSafe>=totalPages?"#333":"#d4af37",padding:"6px 16px",borderRadius:"4px",cursor:pickPageSafe>=totalPages?"default":"pointer",fontSize:"12px"}}, "Suivant →")
      ) : null
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
        React.createElement("div",{style:{fontSize:"10px",letterSpacing:"4px",color:"#d4af37",marginBottom:"10px"}},"PRET A GAGNER ?"),
        React.createElement("div",{style:{fontSize:"20px",fontWeight:"bold",color:"#fff",marginBottom:"10px"}},"Rejoignez les parieurs qui nous font confiance"),
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

