 import React from "react";

var WINAMAX_LINK = "https://www.winamax.fr/affiliation-TONLIEN";
var TIKTOK_LINK = "https://www.tiktok.com/@TONFRERE";

var picks = [
  ["14/05","PAS DE PARI - Aucun match n atteint notre seuil 8/10","---","---","---","NOPICK"],
  ["13/05","Lazio vs Inter Milan","Inter ML","1.66","0-2","GAGNE"],
  ["13/05","Villarreal vs Seville","Over 2.5","1.75","2-2","GAGNE"],
  ["11/05","Carolina vs Philadelphia","Carolina ML","1.58","4-2","GAGNE"],
  ["10/05","Colorado vs Minnesota","Colorado ML","1.62","5-1","GAGNE"],
  ["09/05","VGK vs Anaheim","VGK ML","1.55","6-2","GAGNE"],
  ["08/05","Carolina vs Philadelphia","Carolina ML","1.52","4-1","GAGNE"],
  ["07/05","Anaheim vs VGK","Anaheim ML","1.78","3-1","GAGNE"],
  ["06/05","Buffalo vs Montreal","Buffalo ML","1.60","1-5","PERDU"],
  ["05/05","VGK vs Anaheim","VGK ML","1.54","3-1","GAGNE"],
  ["04/05","Colorado vs Minnesota","Colorado ML","1.58","9-6","GAGNE"],
  ["03/05","Carolina vs Philadelphia","Carolina ML","1.50","3-0","GAGNE"],
  ["02/05","Utah vs VGK","VGK ML","1.62","5-1","GAGNE"],
  ["01/05","Buffalo vs Boston","Buffalo ML","1.70","4-1","GAGNE"],
  ["29/04","Leverkusen vs Dortmund","Over 2.5","1.62","3-1","GAGNE"],
  ["28/04","Bayern vs Stuttgart","Over 2.5","1.55","1-0","PERDU"]
];

export default function App() {
  var filterState = React.useState("ALL");
  var filter = filterState[0];
  var setFilter = filterState[1];
  var filtered = filter === "ALL" ? picks : picks.filter(function(p) { return p[5] !== "NOPICK"; });
  var wins = picks.filter(function(p) { return p[5] === "GAGNE"; }).length;
  var total = picks.filter(function(p) { return p[5] !== "NOPICK"; }).length;
  var winrate = Math.round((wins / total) * 100);
  var pickDuJour = picks[0];
  var estGagnePick = pickDuJour[5] === "GAGNE";
  var estNoPick = pickDuJour[5] === "NOPICK";

  return React.createElement("div", {style:{background:"#080c14",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0"}},

    React.createElement("header", {style:{borderBottom:"1px solid rgba(212,175,55,0.2)",padding:"16px 40px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(8,12,20,0.98)",position:"sticky",top:0,zIndex:50}},
      React.createElement("div", null,
        React.createElement("div", {style:{fontSize:"20px",fontWeight:"bold",color:"#d4af37",letterSpacing:"3px"}}, "TOUSLESMATCHS"),
        React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"3px"}}, "ANALYSE - INTELLIGENCE - RESULTATS")
      ),
      React.createElement("div", {style:{display:"flex",gap:"12px",alignItems:"center"}},
        React.createElement("a", {href:TIKTOK_LINK,target:"_blank",style:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"6px",padding:"8px 16px",color:"#fff",textDecoration:"none",fontSize:"13px",display:"flex",alignItems:"center",gap:"6px"}},
          React.createElement("span", {style:{fontSize:"16px"}}, "TikTok"),
          React.createElement("span", null, "@TONFRERE")
        ),
        React.createElement("a", {href:WINAMAX_LINK,target:"_blank",style:{background:"linear-gradient(135deg,#d4af37,#f5d76e)",border:"none",borderRadius:"6px",padding:"8px 20px",color:"#080c14",fontWeight:"bold",cursor:"pointer",fontSize:"13px",textDecoration:"none"}}, "Ouvrir un compte Winamax")
      )
    ),

    React.createElement("section", {style:{padding:"50px 40px 30px",textAlign:"center"}},
      React.createElement("div", {style:{fontSize:"11px",letterSpacing:"6px",color:"#d4af37",marginBottom:"16px"}}, "PROPULSE PAR INTELLIGENCE ARTIFICIELLE"),
      React.createElement("h1", {style:{fontSize:"42px",fontWeight:"bold",color:"#fff",margin:"0 0 10px"}}, "Le meilleur pick chaque jour."),
      React.createElement("p", {style:{color:"#555",fontSize:"14px",maxWidth:"460px",margin:"0 auto 30px"}}, "Notre IA analyse des centaines de matchs pour livrer uniquement les paris a haute valeur. Pas de forcing. Juste des resultats."),
      React.createElement("div", {style:{display:"flex",justifyContent:"center",maxWidth:"720px",margin:"0 auto",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"8px",overflow:"hidden"}},
        [
          {label:"WIN RATE", value:winrate+"%", sub:"sur "+total+" paris"},
          {label:"BANKROLL", value:"+55%", sub:"en 2 semaines"},
          {label:"PROFIT NET", value:"+23 EUR", sub:"depuis le debut"},
          {label:"SERIE", value:"9W", sub:"consecutives"},
        ].map(function(s,i){
          return React.createElement("div", {key:i, style:{flex:1,padding:"20px 10px",borderRight:i<3?"1px solid rgba(212,175,55,0.15)":"none"}},
            React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:"6px"}}, s.label),
            React.createElement("div", {style:{fontSize:"24px",fontWeight:"bold",color:"#d4af37"}}, s.value),
            React.createElement("div", {style:{fontSize:"10px",color:"#444",marginTop:"4px"}}, s.sub)
          );
        })
      )
    ),

    React.createElement("section", {style:{padding:"10px 40px 30px",maxWidth:"800px",margin:"0 auto"}},
      React.createElement("div", {style:{background: estNoPick ? "rgba(100,100,100,0.08)" : estGagnePick ? "rgba(34,180,60,0.08)" : "rgba(212,175,55,0.08)", border:"1px solid "+(estNoPick?"rgba(100,100,100,0.3)":estGagnePick?"rgba(34,180,60,0.3)":"rgba(212,175,55,0.4)"),borderRadius:"12px",padding:"24px 30px"}},
        React.createElement("div", {style:{fontSize:"10px",letterSpacing:"4px",color: estNoPick?"#666":"#d4af37",marginBottom:"10px"}}, "PICK DU JOUR"),
        React.createElement("div", {style:{fontSize:"20px",fontWeight:"bold",color: estNoPick?"#666":"#fff",marginBottom:"6px"}}, pickDuJour[1]),
        estNoPick ? null : React.createElement("div", {style:{display:"flex",gap:"20px",alignItems:"center",flexWrap:"wrap",marginTop:"10px"}},
          React.createElement("span", {style:{background:"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:"4px",padding:"4px 12px",color:"#d4af37",fontSize:"13px"}}, pickDuJour[2]),
          React.createElement("span", {style:{color:"#fff",fontWeight:"bold",fontSize:"18px"}}, "Cote: "+pickDuJour[3]),
          pickDuJour[4] !== "---" ? React.createElement("span", {style:{color:"#666",fontSize:"14px"}}, "Score: "+pickDuJour[4]) : null
        ),
        React.createElement("div", {style:{marginTop:"16px",paddingTop:"16px",borderTop:"1px solid rgba(212,175,55,0.15)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px"}},
          React.createElement("p", {style:{color:"#555",fontSize:"12px",margin:0}}, "Analyse IA - Note minimum 8/10 requise"),
          React.createElement("a", {href:WINAMAX_LINK,target:"_blank",style:{background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"6px",padding:"10px 24px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"13px"}}, "Parier sur Winamax")
        )
      )
    ),

    React.createElement("section", {style:{padding:"10px 40px 40px",maxWidth:"980px",margin:"0 auto"}},
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}},
        React.createElement("h2", {style:{color:"#d4af37",fontSize:"13px",letterSpacing:"3px",margin:0}}, "HISTORIQUE DES PICKS"),
        React.createElement("div", {style:{display:"flex",gap:"8px"}},
          ["ALL","Foot","Hockey"].map(function(f){
            return React.createElement("button", {key:f, onClick:function(){setFilter(f);}, style:{background:filter===f?"rgba(212,175,55,0.15)":"transparent",border:"1px solid "+(filter===f?"#d4af37":"rgba(255,255,255,0.1)"),color:filter===f?"#d4af37":"#555",padding:"5px 14px",borderRadius:"4px",cursor:"pointer",fontSize:"12px"}}, f==="ALL"?"Tous":f);
          })
        )
      ),

      React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"6px"}},
        picks.map(function(p,i){
          var g = p[5]==="GAGNE";
          var np = p[5]==="NOPICK";
          var bg = np?"rgba(100,100,100,0.05)":g?"rgba(34,180,60,0.06)":"rgba(255,60,60,0.06)";
          var bd = np?"rgba(100,100,100,0.2)":g?"rgba(34,180,60,0.25)":"rgba(255,60,60,0.25)";
          var dc = np?"#666":g?"#22cc44":"#ff4444";
          var lb = np?"---":g?"GAGNE":"PERDU";
          return React.createElement("div", {key:i, style:{display:"flex",alignItems:"center",padding:"12px 16px",background:bg,border:"1px solid "+bd,borderRadius:"6px",gap:"12px",flexWrap:"wrap"}},
            React.createElement("span", {style:{color:"#555",fontSize:"12px",minWidth:"45px",flexShrink:0}}, p[0]),
            React.createElement("span", {style:{color:np?"#555":"#ddd",fontSize:"14px",flex:"1",minWidth:"150px",fontStyle:np?"italic":"normal"}}, p[1]),
            React.createElement("span", {style:{background:"rgba(212,175,55,0.08)",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"3px",padding:"2px 8px",color:np?"#444":"#d4af37",fontSize:"11px",minWidth:"80px",textAlign:"center",flexShrink:0}}, p[2]),
            React.createElement("span", {style:{color:np?"#333":"#fff",fontWeight:"bold",minWidth:"35px",fontSize:"14px",flexShrink:0}}, p[3]),
            React.createElement("span", {style:{color:"#666",fontSize:"13px",minWidth:"35px",flexShrink:0}}, p[4]),
            React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"6px",minWidth:"80px",flexShrink:0}},
              React.createElement("div", {style:{width:"10px",height:"10px",borderRadius:"50%",background:dc,flexShrink:0}}),
              React.createElement("span", {style:{color:dc,fontWeight:"bold",fontSize:"13px"}}, lb)
            )
          );
        })
      )
    ),

    React.createElement("section", {style:{padding:"10px 40px 60px",maxWidth:"800px",margin:"0 auto"}},
      React.createElement("div", {style:{background:"rgba(212,175,55,0.04)",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"12px",padding:"40px",textAlign:"center"}},
        React.createElement("div", {style:{color:"#d4af37",letterSpacing:"4px",fontSize:"11px",marginBottom:"12px"}}, "REJOINDRE LA COMMUNAUTE"),
        React.createElement("h3", {style:{color:"#fff",fontSize:"22px",margin:"0 0 10px"}}, "Suivez nos picks en avance"),
        React.createElement("p", {style:{color:"#555",fontSize:"13px",marginBottom:"24px"}}, "Abonnez-vous pour recevoir chaque matin le pick du jour avec la note, la cote et la mise recommandee"),
        React.createElement("div", {style:{display:"flex",gap:"16px",justifyContent:"center",flexWrap:"wrap",marginBottom:"30px"}},
          React.createElement("div", {style:{border:"1px solid rgba(212,175,55,0.3)",borderRadius:"8px",padding:"20px 30px",minWidth:"140px"}},
            React.createElement("div", {style:{color:"#d4af37",fontSize:"24px",fontWeight:"bold"}}, "9 EUR"),
            React.createElement("div", {style:{color:"#555",fontSize:"12px",marginTop:"4px"}}, "/mois - Starter"),
            React.createElement("div", {style:{color:"#444",fontSize:"11px",marginTop:"8px"}}, "1 pick/jour")
          ),
          React.createElement("div", {style:{background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"8px",padding:"20px 30px",minWidth:"140px"}},
            React.createElement("div", {style:{color:"#080c14",fontSize:"24px",fontWeight:"bold"}}, "19 EUR"),
            React.createElement("div", {style:{color:"rgba(8,12,20,0.6)",fontSize:"12px",marginTop:"4px"}}, "/mois - Premium"),
            React.createElement("div", {style:{color:"rgba(8,12,20,0.5)",fontSize:"11px",marginTop:"8px"}}, "Pick + analyse complete")
          )
        ),
        React.createElement("div", {style:{borderTop:"1px solid rgba(212,175,55,0.1)",paddingTop:"24px"}},
          React.createElement("p", {style:{color:"#444",fontSize:"12px",marginBottom:"16px"}}, "Ou creez un compte sur nos bookmakers partenaires"),
          React.createElement("a", {href:WINAMAX_LINK,target:"_blank",style:{display:"inline-block",background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"6px",padding:"12px 32px",color:"#080c14",fontWeight:"bold",textDecoration:"none",fontSize:"14px",marginRight:"12px"}}, "Winamax - Partenaire officiel"),
          React.createElement("a", {href:TIKTOK_LINK,target:"_blank",style:{display:"inline-block",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"6px",padding:"12px 32px",color:"#fff",textDecoration:"none",fontSize:"14px"}}, "Nous suivre sur TikTok")
        )
      )
    )
  );
}