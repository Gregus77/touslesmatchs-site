import React from "react";


export default function AnalyseLive() {
  var [home, setHome] = React.useState("");
  var [away, setAway] = React.useState("");
  var [loading, setLoading] = React.useState(false);
  var [result, setResult] = React.useState(null);
  var [error, setError] = React.useState("");
  var [liveMatches, setLive] = React.useState([]);

  // Charger matchs live au démarrage
  React.useEffect(function() {
    fetch("/api/live-matches")
      .then(function(r){ return r.json(); })
      .then(function(d){ if(d.ok) setLive(d.matches || []); })
      .catch(function(){});
  }, []);

  // PHASE 3 V2: Sélectionner un match live auto-remplit home/away
  function selectMatch(m) {
    setHome(m.home);
    setAway(m.away);
    // Les autres données (compétition, score, minute) sont auto-récupérées par le backend
  }

  // PHASE 3 V2: Formulaire minimaliste — seulement 2 champs
  function analyser() {
    if (!home || !away) { setError("Entre les deux équipes."); return; }
    setLoading(true); setResult(null); setError("");
    // Backend récupère auto: compétition, score, minute via API football-data
    fetch("/api/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ home, away })
    })
      .then(function(r){ return r.json(); })
      .then(function(d){
        setLoading(false);
        if(d.ok) setResult(d);
        else setError(d.error || "Erreur d'analyse");
      })
      .catch(function(){ setLoading(false); setError("Serveur indisponible. Réessaie dans un instant."); });
  }

  var probBar = function(pct, color) {
    return React.createElement("div", {style:{background:"rgba(255,255,255,0.06)",borderRadius:"6px",height:"10px",overflow:"hidden",margin:"6px 0"}},
      React.createElement("div", {style:{width:pct+"%",height:"100%",background:color,borderRadius:"6px",transition:"width 1s ease"}})
    );
  };

  return React.createElement("div", {style:{minHeight:"100vh",background:"#080706",color:"#F5F0E8",fontFamily:"'Jost',sans-serif",padding:"24px 16px",maxWidth:"700px",margin:"0 auto"}},

    // Header
    React.createElement("div", {style:{textAlign:"center",marginBottom:"36px"}},
      React.createElement("div", {style:{fontSize:"11px",letterSpacing:"4px",color:"#C9A227",marginBottom:"8px",fontWeight:"600"}}, "HERMÈS · ANALYSE EN DIRECT"),
      React.createElement("h1", {style:{fontFamily:"'Bodoni Moda',serif",fontSize:"clamp(28px,6vw,48px)",fontWeight:"700",color:"#F5F0E8",margin:"0 0 12px"}},
        "Analyse ", React.createElement("em", {style:{color:"#C9A227",fontStyle:"italic"}}, "live")
      ),
      React.createElement("p", {style:{color:"#6b6356",fontSize:"15px",lineHeight:"1.7"}}, "Entre un match en cours. L'IA analyse les probabilités en temps réel.")
    ),

    // Matchs live disponibles
    liveMatches.length > 0 && React.createElement("div", {style:{marginBottom:"28px"}},
      React.createElement("div", {style:{fontSize:"11px",letterSpacing:"3px",color:"#C9A227",marginBottom:"12px",fontWeight:"600"}}, "⚡ MATCHS EN COURS"),
      React.createElement("div", {style:{display:"flex",flexWrap:"wrap",gap:"8px"}},
        liveMatches.map(function(m, i) {
          return React.createElement("button", {
            key:i, onClick:function(){ selectMatch(m); },
            style:{background:"rgba(201,162,39,0.1)",border:"1px solid rgba(201,162,39,0.3)",borderRadius:"8px",padding:"8px 14px",color:"#C9A227",cursor:"pointer",fontSize:"13px",fontFamily:"'Jost',sans-serif"}
          }, m.home + " vs " + m.away + " (" + m.minute + "'  " + m.score_home + "-" + m.score_away + ")");
        })
      )
    ),

    // PHASE 3 V2: Formulaire ultra-simplifié — seulement 2 champs
    React.createElement("div", {style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(201,162,39,0.2)",borderRadius:"16px",padding:"24px",marginBottom:"24px"}},
      React.createElement("div", {style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"16px"}},
        React.createElement("div", null,
          React.createElement("label", {style:{fontSize:"11px",letterSpacing:"2px",color:"#C9A227",display:"block",marginBottom:"8px",fontWeight:"600"}}, "⚽ ÉQUIPE DOMICILE"),
          React.createElement("input", {value:home, onChange:function(e){setHome(e.target.value);}, placeholder:"ex: PSG",
            style:{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",padding:"12px",color:"#F5F0E8",fontSize:"15px",fontFamily:"'Jost',sans-serif",boxSizing:"border-box"}})
        ),
        React.createElement("div", null,
          React.createElement("label", {style:{fontSize:"11px",letterSpacing:"2px",color:"#C9A227",display:"block",marginBottom:"8px",fontWeight:"600"}}, "⚽ ÉQUIPE EXTÉRIEURE"),
          React.createElement("input", {value:away, onChange:function(e){setAway(e.target.value);}, placeholder:"ex: OM",
            style:{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",padding:"12px",color:"#F5F0E8",fontSize:"15px",fontFamily:"'Jost',sans-serif",boxSizing:"border-box"}})
        )
      ),
      React.createElement("div", {style:{fontSize:"12px",color:"#6b6356",marginBottom:"14px"}}, "💡 Données auto-récupérées : compétition, score, minute"),
      error && React.createElement("div", {style:{color:"#EF4444",fontSize:"13px",marginBottom:"12px"}}, "⚠️ "+error),
      React.createElement("button", {
        onClick:analyser, disabled:loading,
        style:{width:"100%",padding:"16px",background:loading?"#2a2a2a":"linear-gradient(135deg,#C9A227,#E8C14A)",border:"none",borderRadius:"10px",color:loading?"#555":"#080706",fontSize:"16px",fontWeight:"700",cursor:loading?"not-allowed":"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:"0.05em"}
      }, loading ? "🔮 Analyse en cours..." : "🔮 Analyser ce match")
    ),

    // Résultats
    result && React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"14px"}},

      // Résumé
      React.createElement("div", {style:{background:"rgba(201,162,39,0.08)",border:"1px solid rgba(201,162,39,0.25)",borderRadius:"14px",padding:"20px"}},
        React.createElement("div", {style:{fontSize:"11px",letterSpacing:"3px",color:"#C9A227",marginBottom:"10px",fontWeight:"600"}}, "🧠 ANALYSE HERMÈS"),
        React.createElement("div", {style:{fontSize:"15px",color:"#ccc",lineHeight:"1.75"}}, result.resume)
      ),

      // Value bet
      result.value_bet && React.createElement("div", {style:{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"14px",padding:"20px"}},
        React.createElement("div", {style:{fontSize:"11px",letterSpacing:"3px",color:"#22C55E",marginBottom:"10px",fontWeight:"600"}}, "⭐ VALUE BET DÉTECTÉ"),
        React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}},
          React.createElement("span", {style:{fontSize:"18px",fontWeight:"700",color:"#F5F0E8"}}, result.value_bet.marche),
          React.createElement("span", {style:{fontSize:"22px",fontWeight:"700",color:"#22C55E"}}, result.value_bet.prob+"%")
        ),
        probBar(result.value_bet.prob, "#22C55E"),
        React.createElement("div", {style:{fontSize:"13px",color:"#6b6356",marginTop:"8px"}}, "Cote minimum conseillée : ", React.createElement("strong", {style:{color:"#C9A227"}}, result.value_bet.cote_min_conseillée)),
        React.createElement("div", {style:{fontSize:"13px",color:"#888",marginTop:"4px"}}, result.value_bet.raison)
      ),

      // Grille probabilités
      React.createElement("div", {style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}},

        // Over/Under
        React.createElement("div", {style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"14px",padding:"18px"}},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"2px",color:"#C9A227",marginBottom:"10px",fontWeight:"600"}}, "⚽ OVER / UNDER 2.5"),
          React.createElement("div", {style:{display:"flex",justifyContent:"space-between",marginBottom:"4px"}},
            React.createElement("span", {style:{color:"#888",fontSize:"13px"}}, "Over 2.5"),
            React.createElement("span", {style:{color:"#22C55E",fontWeight:"700"}}, (result.over25?.prob||0)+"%")
          ),
          probBar(result.over25?.prob||0, "#22C55E"),
          React.createElement("div", {style:{display:"flex",justifyContent:"space-between",marginTop:"8px",marginBottom:"4px"}},
            React.createElement("span", {style:{color:"#888",fontSize:"13px"}}, "Under 2.5"),
            React.createElement("span", {style:{color:"#F59E0B",fontWeight:"700"}}, (100-(result.over25?.prob||0))+"%")
          ),
          probBar(100-(result.over25?.prob||0), "#F59E0B"),
          React.createElement("div", {style:{fontSize:"12px",color:"#555",marginTop:"10px",lineHeight:"1.5"}}, result.over25?.tendance)
        ),

        // BTTS
        React.createElement("div", {style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"14px",padding:"18px"}},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"2px",color:"#C9A227",marginBottom:"10px",fontWeight:"600"}}, "🥅 BTTS (2 ÉQUIPES MARQUENT)"),
          React.createElement("div", {style:{display:"flex",justifyContent:"space-between",marginBottom:"4px"}},
            React.createElement("span", {style:{color:"#888",fontSize:"13px"}}, "Oui"),
            React.createElement("span", {style:{color:"#22C55E",fontWeight:"700"}}, (result.btts?.prob||0)+"%")
          ),
          probBar(result.btts?.prob||0, "#22C55E"),
          React.createElement("div", {style:{display:"flex",justifyContent:"space-between",marginTop:"8px",marginBottom:"4px"}},
            React.createElement("span", {style:{color:"#888",fontSize:"13px"}}, "Non"),
            React.createElement("span", {style:{color:"#EF4444",fontWeight:"700"}}, (100-(result.btts?.prob||0))+"%")
          ),
          probBar(100-(result.btts?.prob||0), "#EF4444"),
          React.createElement("div", {style:{fontSize:"12px",color:"#555",marginTop:"10px",lineHeight:"1.5"}}, result.btts?.tendance)
        ),

        // Résultat final
        React.createElement("div", {style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"14px",padding:"18px"}},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"2px",color:"#C9A227",marginBottom:"10px",fontWeight:"600"}}, "🏆 RÉSULTAT FINAL"),
          ["domicile","nul","exterieur"].map(function(k,i){
            var labels=["Dom.","Nul","Ext."]; var colors=["#C9A227","#888","#60A5FA"];
            var v = result.resultat?.[k] || 0;
            return React.createElement("div", {key:k, style:{marginBottom:i<2?"10px":"0"}},
              React.createElement("div", {style:{display:"flex",justifyContent:"space-between",marginBottom:"4px"}},
                React.createElement("span", {style:{color:"#888",fontSize:"13px"}}, labels[i]),
                React.createElement("span", {style:{color:colors[i],fontWeight:"700"}}, v+"%")
              ),
              probBar(v, colors[i])
            );
          }),
          React.createElement("div", {style:{fontSize:"12px",color:"#555",marginTop:"10px",lineHeight:"1.5"}}, result.resultat?.explication)
        ),

        // Mi-temps
        React.createElement("div", {style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"14px",padding:"18px"}},
          React.createElement("div", {style:{fontSize:"11px",letterSpacing:"2px",color:"#C9A227",marginBottom:"10px",fontWeight:"600"}}, "⏱️ PROCHAIN BUT"),
          React.createElement("div", {style:{display:"flex",justifyContent:"space-between",marginBottom:"4px"}},
            React.createElement("span", {style:{color:"#888",fontSize:"13px"}}, "1ère mi-temps"),
            React.createElement("span", {style:{color:"#60A5FA",fontWeight:"700"}}, (result.premier_but_mi_temps?.premiere||0)+"%")
          ),
          probBar(result.premier_but_mi_temps?.premiere||0, "#60A5FA"),
          React.createElement("div", {style:{display:"flex",justifyContent:"space-between",marginTop:"8px",marginBottom:"4px"}},
            React.createElement("span", {style:{color:"#888",fontSize:"13px"}}, "2ème mi-temps"),
            React.createElement("span", {style:{color:"#A78BFA",fontWeight:"700"}}, (result.premier_but_mi_temps?.deuxieme||0)+"%")
          ),
          probBar(result.premier_but_mi_temps?.deuxieme||0, "#A78BFA"),
          React.createElement("div", {style:{fontSize:"12px",color:"#555",marginTop:"10px",lineHeight:"1.5"}}, result.premier_but_mi_temps?.explication)
        )
      ),

      // Disclaimer
      React.createElement("div", {style:{textAlign:"center",fontSize:"12px",color:"#333",padding:"12px",borderTop:"1px solid rgba(255,255,255,0.06)"}},
        "⚠️ Analyse IA — probabilités indicatives, pas des garanties. Jouez de manière responsable."
      )
    )
  );
}
