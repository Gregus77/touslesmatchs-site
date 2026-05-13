 import React from "react";

var picks = [
  ["13/05","Lazio vs Inter","Inter ML","1.66","0-2","GAGNE"],
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
  return React.createElement("div", {style:{background:"#080c14",minHeight:"100vh",fontFamily:"Georgia,serif",color:"#e8e0d0",padding:"20px"}},
    React.createElement("div", {style:{textAlign:"center",padding:"40px 20px"}},
      React.createElement("h1", {style:{color:"#d4af37",fontSize:"36px",margin:"0 0 10px"}}, "TOUSLESMATCHS"),
      React.createElement("p", {style:{color:"#666",fontSize:"12px",letterSpacing:"3px"}}, "ANALYSE - INTELLIGENCE - RESULTATS"),
      React.createElement("div", {style:{display:"flex",justifyContent:"center",gap:"40px",margin:"30px 0",flexWrap:"wrap"}},
        React.createElement("div", {style:{textAlign:"center"}},
          React.createElement("div", {style:{fontSize:"28px",fontWeight:"bold",color:"#d4af37"}}, "87%"),
          React.createElement("div", {style:{fontSize:"11px",color:"#555",marginTop:"4px"}}, "WIN RATE")
        ),
        React.createElement("div", {style:{textAlign:"center"}},
          React.createElement("div", {style:{fontSize:"28px",fontWeight:"bold",color:"#d4af37"}}, "+55%"),
          React.createElement("div", {style:{fontSize:"11px",color:"#555",marginTop:"4px"}}, "BANKROLL")
        ),
        React.createElement("div", {style:{textAlign:"center"}},
          React.createElement("div", {style:{fontSize:"28px",fontWeight:"bold",color:"#d4af37"}}, "+23 EUR"),
          React.createElement("div", {style:{fontSize:"11px",color:"#555",marginTop:"4px"}}, "PROFIT NET")
        ),
        React.createElement("div", {style:{textAlign:"center"}},
          React.createElement("div", {style:{fontSize:"28px",fontWeight:"bold",color:"#d4af37"}}, "9W"),
          React.createElement("div", {style:{fontSize:"11px",color:"#555",marginTop:"4px"}}, "SERIE")
        )
      )
    ),
    React.createElement("h2", {style:{color:"#d4af37",fontSize:"14px",letterSpacing:"3px",textAlign:"center",marginBottom:"20px"}}, "HISTORIQUE DES PICKS"),
    React.createElement("div", {style:{maxWidth:"900px",margin:"0 auto",display:"flex",flexDirection:"column",gap:"8px"}},
      picks.map(function(p, i) {
        var gagne = p[5] === "GAGNE";
        return React.createElement("div", {key:i, style:{display:"flex",alignItems:"center",padding:"12px 16px",background:gagne?"rgba(34,180,60,0.06)":"rgba(255,60,60,0.06)",border:"1px solid "+(gagne?"rgba(34,180,60,0.25)":"rgba(255,60,60,0.25)"),borderRadius:"6px",gap:"12px",flexWrap:"wrap"}},
          React.createElement("span", {style:{color:"#555",fontSize:"12px",minWidth:"45px"}}, p[0]),
          React.createElement("span", {style:{color:"#ddd",fontSize:"14px",flex:"1",minWidth:"150px"}}, p[1]),
          React.createElement("span", {style:{background:"rgba(212,175,55,0.1)",border:"1px solid rgba(212,175,55,0.3)",borderRadius:"3px",padding:"2px 8px",color:"#d4af37",fontSize:"11px",minWidth:"90px",textAlign:"center"}}, p[2]),
          React.createElement("span", {style:{color:"#fff",fontWeight:"bold",minWidth:"35px",fontSize:"14px"}}, p[3]),
          React.createElement("span", {style:{color:"#666",fontSize:"13px",minWidth:"35px"}}, p[4]),
          React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"6px",minWidth:"80px"}},
            React.createElement("div", {style:{width:"10px",height:"10px",borderRadius:"50%",background:gagne?"#22cc44":"#ff4444"}}),
            React.createElement("span", {style:{color:gagne?"#22cc44":"#ff4444",fontWeight:"bold",fontSize:"13px"}}, p[5])
          )
        );
      })
    ),
    React.createElement("div", {style:{textAlign:"center",margin:"50px 0",padding:"40px",border:"1px solid rgba(212,175,55,0.2)",borderRadius:"12px",maxWidth:"600px",marginLeft:"auto",marginRight:"auto"}},
      React.createElement("div", {style:{color:"#d4af37",letterSpacing:"4px",fontSize:"11px",marginBottom:"12px"}}, "ACCES PREMIUM"),
      React.createElement("h3", {style:{color:"#fff",fontSize:"24px",margin:"0 0 20px"}}, "1 pick par jour. Analyse par IA."),
      React.createElement("div", {style:{display:"flex",gap:"16px",justifyContent:"center",flexWrap:"wrap"}},
        React.createElement("div", {style:{border:"1px solid rgba(212,175,55,0.3)",borderRadius:"8px",padding:"20px 30px"}},
          React.createElement("div", {style:{color:"#d4af37",fontSize:"26px",fontWeight:"bold"}}, "9 EUR"),
          React.createElement("div", {style:{color:"#555",fontSize:"12px",marginTop:"4px"}}, "/mois - Starter")
        ),
        React.createElement("div", {style:{background:"linear-gradient(135deg,#d4af37,#f5d76e)",borderRadius:"8px",padding:"20px 30px"}},
          React.createElement("div", {style:{color:"#080c14",fontSize:"26px",fontWeight:"bold"}}, "19 EUR"),
          React.createElement("div", {style:{color:"rgba(8,12,20,0.6)",fontSize:"12px",marginTop:"4px"}}, "/mois - Premium")
        )
      )
    )
  );
}