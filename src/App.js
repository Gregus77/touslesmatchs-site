 import React from "react";

var picks = [
  ["14/05","PAS DE PARI - Aucun match n'atteint notre seuil 8/10","---","---","---","NOPICK"],
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
  var filtered = filter === "ALL" ? picks : picks.filter(function(p) { return p[6] === filter || filter === p[5]; });
  var wins = picks.filter(function(p) { return p[5] === "GAGNE"; }).length;
  var winrate = Math.round((wins / picks.filter(function(p){ return p[5] !== "NOPICK"; }).length) * 100);

  return React.createElement("div", {style:{background:"#080c14",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0",padding:"20px"}},

    React.createElement("div", {style:{textAlign:"center",padding:"40px 20px 20px"}},
      React.createElement("h1", {style:{color:"#d4af37",fontSize:"36px",margin:"0 0 6px",letterSpacing:"3px"}}, "TOUSLESMATCHS"),
      React.createElement("p", {style:{color:"#666",fontSize:"11px",letterSpacing:"4px",margin:"0 0 30px"}}, "ANALYSE - INTELLIGENCE - RESULTATS"),
      React.createElement("div", {style:{display:"flex",justifyContent:"center",gap:"0",maxWidth:"700px",margin:"0 auto",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"8px",overflow:"hidden"}},
        [
          {label:"WIN RATE", value:winrate+"%", sub:"sur "+picks.filter(function(p){return p[5]!=="NOPICK";}).length+" paris"},
          {label:"BANKROLL", value:"+55%", sub:"en 2 semaines"},
          {label:"PROFIT NET", value:"+23 EUR", sub:"depuis le debut"},
          {label:"SERIE", value:"9W", sub:"consecutives"},
        ].map(function(s,i){
          return React.createElement("div", {key:i, style:{flex:1,padding:"20px 10px",borderRight:i<3?"1px solid rgba(212,175,55,0.15)":"none",background:i%2===0?"rgba(212,175,55,0.03)":"transparent"}},
            React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:"6px"}}, s.label),
            React.createElement("div", {style:{fontSize:"24px",fontWeight:"bold",color:"#d4af37"}}, s.value),
            React.createElement("div", {style:{fontSize:"10px",color:"#444",marginTop:"4px"}}, s.sub)
          );
        })
      )
    ),

    React.createElement("div", {style:{maxWidth:"980px",margin:"0 auto",padding:"20px 0"}},
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
          var gagne = p[5]==="GAGNE";
          var nopick = p[5]==="NOPICK";
          var bgColor = nopick ? "rgba(150,150,150,0.05)" : gagne ? "rgba(34,180,60,0.06)" : "rgba(255,60,60,0.06)";
          var borderColor = nopick ? "rgba(150,150,150,0.2)" : gagne ? "rgba(34,180,60,0.25)" : "rgba(255,60,60,0.25)";
          var dotColor = nopick ? "#888888" : gagne ? "#22cc44" : "#ff4444";
          var textColor = nopick ? "#888888" : gagne ? "#22cc44" : "#ff4444";
          var label = nopick ? "---" : gagne ? "GAGNE" : "PERDU";

          return React.createElement("div", {key:i, style:{display:"flex",alignItems:"center",padding:"12px 16px",background:bgColor,border:"1px solid "+borderColor,borderRadius:"6px",gap:"12px",flexWrap:"wrap"}},
            React.createElement("span", {style:{color:"#555",fontSize:"12px",minWidth:"45px",flexShrink:0}}, p[0]),
            React.createElement("span", {style:{color: nopick?"#666":"#ddd",fontSize:"14px",flex:"1",minWidth:"150px",fontStyle:nopick?"italic":"normal"}}, p[1]),
            React.createElement("span", {style:{background:"rgba(212,175,55,0.08)",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"3px",padding:"2px 8px",color:nopick?"#555":"#d4af37",fontSize:"11px",minWidth:"80px",textAlign:"center",flexShrink:0}}, p[2]),
            React.createElement("span", {style:{color:nopick?"#444":"#fff",fontWeight:"bold",minWidth:"35px",fontSize:"14px",flexShrink:0}}, p[3]),
            React.createElement("span", {style:{color:"#666",fontSize:"13px",minWidth:"35px",flexShrink:0}}, p[4]),
            React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"6px",minWidth:"80px",flexShrink:0}},
              React.createElement("div", {style:{width:"10px",height:"10px",borderRadius:"50%",background:dotColor,flexShrink:0}}),
              React.createElement("span", {style:{color:textColor,fontWeight:"bold",fontSize:"13px"}}, label)
            )
          );
        })
      ),

      React.createElement("div", {style:{textAlign:"center",margin:"50px 0 0",padding:"40px",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"12px"}},
        React.createElement("div", {style:{color:"#d4af37",letterSpacing:"4px",fontSize:"11px",marginBottom:"12px"}}, "ACCES PREMIUM"),
        React.createElement("h3", {style:{color:"#fff",fontSize:"22px",margin:"0 0 20px"}}, "1 pick par jour. Analyse par IA."),
        React.createElement("div", {style:{display:"flex",gap:"16px",justifyContent:"center",flexWrap:"wrap"}},
          React.createElement("div", {style:{border:"1px solid rgba(212,175,55,0.3)",borderRadius:"8px",padding:"20px 30px"}},
            React.createElement("div", {style:{color:"#d4af37",fontSize:"24px",fontWeight:"bold"}}, "9 EUR"),
            React.createElement("div", {style:{color:"#555",fontSize:"12px",marginTop:"4px"}}, "/mois - Starter")
          ),
          React.createElement("div", {style:{background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"8px",padding:"20px 30px"}},
            React.createElement("div", {style:{color:"#080c14",fontSize:"24px",fontWeight:"bold"}}, "19 EUR"),
            React.createElement("div", {style:{color:"rgba(8,12,20,0.6)",fontSize:"12px",marginTop:"4px"}}, "/mois - Premium")
          )
        )
      )
    )
  );
}