import React from "react";

export default function AnalyseLive() {
  var [step, setStep]           = React.useState("browse"); // browse | analysing | result | manual
  var [liveMatches, setLive]    = React.useState(null);     // null=loading, []=empty, [...]=ok
  var [selected, setSelected]   = React.useState(null);
  var [result, setResult]       = React.useState(null);
  var [error, setError]         = React.useState("");
  var [manualHome, setMH]       = React.useState("");
  var [manualAway, setMA]       = React.useState("");
  var [filter, setFilter]       = React.useState("LIVE");   // LIVE | TODAY | ALL

  // Charger matchs au démarrage
  React.useEffect(function() {
    fetch("/api/live-matches")
      .then(function(r){ return r.json(); })
      .then(function(d){ setLive(d.matches || []); })
      .catch(function(){ setLive([]); });
  }, []);

  function retry() {
    setLive(null);
    fetch("/api/live-matches")
      .then(function(r){ return r.json(); })
      .then(function(d){ setLive(d.matches || []); })
      .catch(function(){ setLive([]); });
  }

  function analyserMatch(home, away, extra) {
    setSelected({ home, away, ...(extra || {}) });
    setStep("analysing");
    setResult(null);
    setError("");
    fetch("/api/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ home, away, competition: extra?.competition, score_home: extra?.score_home, score_away: extra?.score_away, minute: extra?.minute })
    })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d.ok) { setResult(d); setStep("result"); }
        else { setError(d.error || "Analyse impossible"); setStep("browse"); }
      })
      .catch(function(){
        setError("Serveur temporairement indisponible. Réessaie dans quelques secondes.");
        setStep("browse");
      });
  }

  function analyserManuel() {
    if (!manualHome.trim() || !manualAway.trim()) {
      setError("Entre les deux équipes.");
      return;
    }
    analyserMatch(manualHome.trim(), manualAway.trim(), {});
  }

  // ── Filtrage matchs ──────────────────────────────────────
  var matchesFiltered = (liveMatches || []).filter(function(m) {
    if (filter === "LIVE") return m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "HALFTIME" || m.live === true;
    if (filter === "TODAY") return m.status !== "FINISHED";
    return true;
  });

  var liveCount = (liveMatches || []).filter(function(m){ return m.status === "IN_PLAY" || m.status === "PAUSED" || m.live === true; }).length;

  // ── Barre progression ────────────────────────────────────
  function probBar(pct, color) {
    return React.createElement("div", {style:{background:"rgba(255,255,255,0.06)",borderRadius:"6px",height:"8px",overflow:"hidden",margin:"5px 0"}},
      React.createElement("div", {style:{width:pct+"%",height:"100%",background:color,borderRadius:"6px",transition:"width 1.2s ease"}})
    );
  }

  // ── Composant carte match ────────────────────────────────
  function MatchCard(props) {
    var m = props.match;
    var isLive = m.status === "IN_PLAY" || m.status === "PAUSED" || m.status === "HALFTIME" || m.live === true;
    var isSelected = selected && selected.home === m.home && selected.away === m.away;
    return React.createElement("div", {
      onClick: function(){ analyserMatch(m.home, m.away, m); },
      style:{
        background: isSelected ? "rgba(201,162,39,0.15)" : "rgba(255,255,255,0.03)",
        border: "1px solid " + (isSelected ? "#C9A227" : isLive ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.08)"),
        borderRadius:"14px", padding:"18px 20px", cursor:"pointer",
        transition:"border-color 0.2s, background 0.2s, transform 0.15s",
        position:"relative", overflow:"hidden"
      }
    },
      /* Badge LIVE pulsant */
      isLive && React.createElement("div", {style:{
        position:"absolute", top:"12px", right:"12px",
        display:"flex", alignItems:"center", gap:"5px",
        background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.4)",
        borderRadius:"20px", padding:"2px 9px"
      }},
        React.createElement("div", {style:{
          width:"6px", height:"6px", borderRadius:"50%", background:"#22c55e",
          boxShadow:"0 0 6px #22c55e", animation:"pulse 1.5s infinite"
        }}),
        React.createElement("span", {style:{fontSize:"9px",color:"#22c55e",fontWeight:"700",letterSpacing:"1px"}}, "LIVE"),
        m.minute && React.createElement("span", {style:{fontSize:"9px",color:"#22c55e"}}, m.minute+"'")
      ),

      /* Compétition */
      m.competition && React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:"10px",fontWeight:"600",textTransform:"uppercase",paddingRight:"60px"}}, m.competition),

      /* Équipes + Score */
      React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"10px"}},
        React.createElement("div", {style:{flex:1}},
          React.createElement("div", {style:{fontSize:"15px",fontWeight:"700",color:"#fff",marginBottom:"3px",lineHeight:"1.3"}}, m.home),
          React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"1px"}}, "DOMICILE")
        ),
        isLive
          ? React.createElement("div", {style:{
              background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:"10px", padding:"8px 16px", textAlign:"center", flexShrink:0
            }},
              React.createElement("div", {style:{fontSize:"22px",fontWeight:"700",color:"#fff",fontFamily:"'Bodoni Moda',serif",lineHeight:"1"}},
                (m.score_home ?? 0) + " — " + (m.score_away ?? 0)
              )
            )
          : React.createElement("div", {style:{
              fontSize:"11px", color:"#555", letterSpacing:"2px",
              background:"rgba(255,255,255,0.04)", borderRadius:"8px", padding:"6px 12px",
              flexShrink:0
            }}, m.time_str || "À venir"),
        React.createElement("div", {style:{flex:1,textAlign:"right"}},
          React.createElement("div", {style:{fontSize:"15px",fontWeight:"700",color:"#fff",marginBottom:"3px",lineHeight:"1.3"}}, m.away),
          React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"1px"}}, "EXTÉRIEUR")
        )
      ),

      /* CTA Analyser */
      React.createElement("div", {style:{
        marginTop:"14px", paddingTop:"12px", borderTop:"1px solid rgba(255,255,255,0.06)",
        display:"flex", alignItems:"center", justifyContent:"center", gap:"8px"
      }},
        React.createElement("span", {style:{fontSize:"12px",color:"#C9A227",fontWeight:"600",letterSpacing:"1px"}},
          step === "analysing" && isSelected ? "🔮 Analyse en cours..." : "🔮 Analyser ce match →"
        )
      )
    );
  }

  // ── Vue principale : Browse ──────────────────────────────
  var browseView = React.createElement("div", null,

    /* Filtres */
    React.createElement("div", {style:{display:"flex",gap:"8px",marginBottom:"20px",flexWrap:"wrap"}},
      [
        {key:"LIVE", label:"⚡ En direct", count: liveCount},
        {key:"TODAY", label:"📅 Aujourd'hui", count: (liveMatches||[]).length},
        {key:"ALL", label:"📋 Tous", count: (liveMatches||[]).length},
      ].map(function(f) {
        return React.createElement("button", {
          key: f.key, onClick:function(){ setFilter(f.key); },
          style:{
            background: filter===f.key ? "rgba(201,162,39,0.15)" : "rgba(255,255,255,0.04)",
            border: "1px solid " + (filter===f.key ? "#C9A227" : "rgba(255,255,255,0.1)"),
            borderRadius:"8px", padding:"8px 16px", color: filter===f.key ? "#C9A227" : "#666",
            cursor:"pointer", fontSize:"12px", fontWeight: filter===f.key ? "700" : "400",
            fontFamily:"'Jost',sans-serif", display:"flex", alignItems:"center", gap:"6px"
          }
        },
          f.label,
          f.count > 0 && React.createElement("span", {style:{
            background: filter===f.key ? "#C9A227" : "rgba(255,255,255,0.1)",
            color: filter===f.key ? "#000" : "#555",
            borderRadius:"20px", padding:"1px 7px", fontSize:"10px", fontWeight:"700"
          }}, f.count)
        );
      })
    ),

    /* Erreur */
    error && React.createElement("div", {style:{
      background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)",
      borderRadius:"10px", padding:"14px 16px", marginBottom:"16px",
      display:"flex", alignItems:"center", gap:"10px"
    }},
      React.createElement("span", {style:{fontSize:"16px"}}, "⚠️"),
      React.createElement("span", {style:{color:"#fca5a5",fontSize:"13px",flex:1,lineHeight:"1.6"}}, error),
      React.createElement("button", {
        onClick:function(){ setError(""); },
        style:{background:"transparent",border:"none",color:"#555",cursor:"pointer",fontSize:"18px",padding:"0"}
      }, "×")
    ),

    /* État loading */
    liveMatches === null && React.createElement("div", {style:{
      display:"flex", flexDirection:"column", alignItems:"center", gap:"20px",
      padding:"60px 20px", color:"#444"
    }},
      React.createElement("div", {style:{
        width:"40px", height:"40px", border:"3px solid rgba(201,162,39,0.2)",
        borderTop:"3px solid #C9A227", borderRadius:"50%",
        animation:"spin 1s linear infinite"
      }}),
      React.createElement("div", {style:{fontSize:"13px",letterSpacing:"2px",color:"#555"}}, "CHARGEMENT DES MATCHS...")
    ),

    /* Aucun match live */
    liveMatches !== null && matchesFiltered.length === 0 && filter === "LIVE" && React.createElement("div", {style:{
      textAlign:"center", padding:"48px 24px",
      background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)",
      borderRadius:"16px"
    }},
      React.createElement("div", {style:{fontSize:"36px",marginBottom:"14px"}}, "⚽"),
      React.createElement("div", {style:{fontSize:"16px",color:"#ddd",fontWeight:"600",marginBottom:"8px",fontFamily:"'Bodoni Moda',serif"}},
        "Aucun match en direct"
      ),
      React.createElement("div", {style:{fontSize:"13px",color:"#555",marginBottom:"22px",lineHeight:"1.75"}},
        "Aucune rencontre n'est en cours pour l'instant.\nConsulte les matchs du jour ou entre un match manuellement."
      ),
      React.createElement("div", {style:{display:"flex",gap:"10px",justifyContent:"center",flexWrap:"wrap"}},
        React.createElement("button", {
          onClick:function(){ setFilter("TODAY"); },
          style:{background:"rgba(201,162,39,0.1)",border:"1px solid rgba(201,162,39,0.3)",borderRadius:"8px",padding:"10px 20px",color:"#C9A227",cursor:"pointer",fontSize:"13px",fontFamily:"'Jost',sans-serif"}
        }, "📅 Voir les matchs du jour"),
        React.createElement("button", {
          onClick:function(){ setStep("manual"); },
          style:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",padding:"10px 20px",color:"#999",cursor:"pointer",fontSize:"13px",fontFamily:"'Jost',sans-serif"}
        }, "✏️ Saisie manuelle"),
        React.createElement("button", {
          onClick:retry,
          style:{background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",padding:"10px 20px",color:"#555",cursor:"pointer",fontSize:"13px",fontFamily:"'Jost',sans-serif"}
        }, "🔄 Actualiser")
      )
    ),

    /* Liste des matchs */
    liveMatches !== null && matchesFiltered.length > 0 && React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"10px"}},
      matchesFiltered.map(function(m, i) {
        return React.createElement(MatchCard, {key:i, match:m});
      })
    ),

    /* Bouton saisie manuelle */
    liveMatches !== null && React.createElement("div", {style:{marginTop:"24px",textAlign:"center"}},
      React.createElement("button", {
        onClick:function(){ setStep("manual"); setError(""); },
        style:{
          background:"transparent", border:"1px dashed rgba(255,255,255,0.15)",
          borderRadius:"10px", padding:"12px 28px", color:"#555",
          cursor:"pointer", fontSize:"13px", fontFamily:"'Jost',sans-serif"
        }
      }, "✏️ Analyser un match non listé")
    )
  );

  // ── Vue analyse en cours ─────────────────────────────────
  var analysingView = selected && React.createElement("div", {style:{textAlign:"center",padding:"60px 24px"}},
    React.createElement("div", {style:{
      width:"60px", height:"60px", border:"4px solid rgba(201,162,39,0.15)",
      borderTop:"4px solid #C9A227", borderRadius:"50%",
      animation:"spin 1s linear infinite", margin:"0 auto 28px"
    }}),
    React.createElement("div", {style:{fontSize:"13px",letterSpacing:"3px",color:"#C9A227",marginBottom:"12px",fontWeight:"700"}}, "HERMÈS ANALYSE"),
    React.createElement("div", {style:{fontSize:"20px",fontWeight:"700",color:"#fff",marginBottom:"6px",fontFamily:"'Bodoni Moda',serif"}},
      selected.home + " vs " + selected.away
    ),
    selected.competition && React.createElement("div", {style:{fontSize:"12px",color:"#555",marginBottom:"20px"}}, selected.competition),
    React.createElement("div", {style:{fontSize:"13px",color:"#6b6356",lineHeight:"1.75"}},
      "Analyse en cours : forme, confrontations, score, contexte tactique..."
    )
  );

  // ── Vue résultats ────────────────────────────────────────
  var resultView = result && React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:"14px"}},

    /* Match analysé */
    React.createElement("div", {style:{
      background:"rgba(201,162,39,0.06)", border:"1px solid rgba(201,162,39,0.2)",
      borderRadius:"14px", padding:"18px 20px",
      display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px"
    }},
      React.createElement("div", null,
        React.createElement("div", {style:{fontSize:"10px",color:"#555",letterSpacing:"2px",marginBottom:"6px"}}, "MATCH ANALYSÉ"),
        React.createElement("div", {style:{fontSize:"18px",fontWeight:"700",color:"#fff",fontFamily:"'Bodoni Moda',serif"}},
          result.home + " vs " + result.away
        )
      ),
      React.createElement("button", {
        onClick:function(){ setStep("browse"); setResult(null); setSelected(null); setError(""); },
        style:{
          background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)",
          borderRadius:"8px", padding:"8px 16px", color:"#999", cursor:"pointer",
          fontSize:"12px", fontFamily:"'Jost',sans-serif"
        }
      }, "← Retour aux matchs")
    ),

    /* Résumé */
    React.createElement("div", {style:{background:"rgba(201,162,39,0.08)",border:"1px solid rgba(201,162,39,0.25)",borderRadius:"14px",padding:"20px"}},
      React.createElement("div", {style:{fontSize:"11px",letterSpacing:"3px",color:"#C9A227",marginBottom:"10px",fontWeight:"600"}}, "🧠 ANALYSE HERMÈS"),
      React.createElement("div", {style:{fontSize:"14px",color:"#ccc",lineHeight:"1.8"}}, result.resume)
    ),

    /* Value bet */
    result.value_bet && React.createElement("div", {style:{background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"14px",padding:"20px"}},
      React.createElement("div", {style:{fontSize:"11px",letterSpacing:"3px",color:"#22C55E",marginBottom:"10px",fontWeight:"600"}}, "⭐ VALUE BET DÉTECTÉ"),
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}},
        React.createElement("span", {style:{fontSize:"18px",fontWeight:"700",color:"#F5F0E8"}}, result.value_bet.marche),
        React.createElement("span", {style:{fontSize:"22px",fontWeight:"700",color:"#22C55E"}}, result.value_bet.prob+"%")
      ),
      probBar(result.value_bet.prob, "#22C55E"),
      React.createElement("div", {style:{fontSize:"13px",color:"#6b6356",marginTop:"8px"}},
        "Cote minimum conseillée : ", React.createElement("strong", {style:{color:"#C9A227"}}, result.value_bet.cote_min_conseillée)
      ),
      React.createElement("div", {style:{fontSize:"13px",color:"#888",marginTop:"4px"}}, result.value_bet.raison)
    ),

    /* Grille probabilités */
    React.createElement("div", {style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}},

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

      React.createElement("div", {style:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"14px",padding:"18px"}},
        React.createElement("div", {style:{fontSize:"11px",letterSpacing:"2px",color:"#C9A227",marginBottom:"10px",fontWeight:"600"}}, "🥅 BTTS"),
        React.createElement("div", {style:{display:"flex",justifyContent:"space-between",marginBottom:"4px"}},
          React.createElement("span", {style:{color:"#888",fontSize:"13px"}}, "Les deux marquent"),
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

    React.createElement("div", {style:{textAlign:"center",fontSize:"12px",color:"#333",padding:"12px",borderTop:"1px solid rgba(255,255,255,0.06)"}},
      "⚠️ Analyse IA — probabilités indicatives, pas des garanties. Jouez de manière responsable."
    )
  );

  // ── Vue saisie manuelle ──────────────────────────────────
  var manualView = React.createElement("div", null,
    React.createElement("button", {
      onClick:function(){ setStep("browse"); setError(""); },
      style:{background:"transparent",border:"none",color:"#C9A227",cursor:"pointer",fontSize:"13px",fontFamily:"'Jost',sans-serif",marginBottom:"20px",padding:"0",display:"flex",alignItems:"center",gap:"6px"}
    }, "← Retour aux matchs"),

    React.createElement("div", {style:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(201,162,39,0.2)",borderRadius:"16px",padding:"24px"}},
      React.createElement("div", {style:{fontSize:"11px",letterSpacing:"3px",color:"#C9A227",marginBottom:"18px",fontWeight:"600"}}, "✏️ SAISIE MANUELLE"),
      React.createElement("div", {style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"16px"}},
        React.createElement("div", null,
          React.createElement("label", {style:{fontSize:"11px",letterSpacing:"2px",color:"#C9A227",display:"block",marginBottom:"8px",fontWeight:"600"}}, "⚽ ÉQUIPE DOMICILE"),
          React.createElement("input", {
            value:manualHome, onChange:function(e){setMH(e.target.value);},
            placeholder:"ex: PSG",
            onKeyDown:function(e){if(e.key==="Enter") analyserManuel();},
            style:{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",padding:"12px",color:"#F5F0E8",fontSize:"15px",fontFamily:"'Jost',sans-serif",boxSizing:"border-box"}
          })
        ),
        React.createElement("div", null,
          React.createElement("label", {style:{fontSize:"11px",letterSpacing:"2px",color:"#C9A227",display:"block",marginBottom:"8px",fontWeight:"600"}}, "⚽ ÉQUIPE EXTÉRIEURE"),
          React.createElement("input", {
            value:manualAway, onChange:function(e){setMA(e.target.value);},
            placeholder:"ex: OM",
            onKeyDown:function(e){if(e.key==="Enter") analyserManuel();},
            style:{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",padding:"12px",color:"#F5F0E8",fontSize:"15px",fontFamily:"'Jost',sans-serif",boxSizing:"border-box"}
          })
        )
      ),
      error && React.createElement("div", {style:{color:"#fca5a5",fontSize:"13px",marginBottom:"12px"}}, "⚠️ "+error),
      React.createElement("button", {
        onClick:analyserManuel,
        style:{width:"100%",padding:"16px",background:"linear-gradient(135deg,#C9A227,#E8C14A)",border:"none",borderRadius:"10px",color:"#080706",fontSize:"16px",fontWeight:"700",cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:"0.05em",minHeight:"52px"}
      }, "🔮 Analyser ce match")
    )
  );

  // ── Layout principal ─────────────────────────────────────
  return React.createElement("div", {style:{minHeight:"100vh",background:"#080706",color:"#F5F0E8",fontFamily:"'Jost',sans-serif",padding:"24px 16px",maxWidth:"700px",margin:"0 auto",paddingBottom:"80px"}},

    /* CSS animations */
    React.createElement("style", null, `
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
    `),

    /* Header */
    React.createElement("div", {style:{textAlign:"center",marginBottom:"32px"}},
      React.createElement("div", {style:{fontSize:"11px",letterSpacing:"4px",color:"#C9A227",marginBottom:"8px",fontWeight:"600"}}, "HERMÈS · ANALYSE EN DIRECT"),
      React.createElement("h1", {style:{fontFamily:"'Bodoni Moda',serif",fontSize:"clamp(28px,6vw,44px)",fontWeight:"700",color:"#F5F0E8",margin:"0 0 10px"}},
        "Analyse ", React.createElement("em", {style:{color:"#C9A227",fontStyle:"italic"}}, "live")
      ),
      React.createElement("p", {style:{color:"#6b6356",fontSize:"14px",lineHeight:"1.7",margin:0}},
        step === "browse" ? "Clique sur un match pour l'analyser instantanément." :
        step === "analysing" ? "Hermès analyse les probabilités en temps réel..." :
        step === "result" ? "Analyse complète — probabilités calculées par l'IA." :
        "Entre les deux équipes manuellement."
      )
    ),

    step === "browse" && browseView,
    step === "analysing" && analysingView,
    step === "result" && resultView,
    step === "manual" && manualView
  );
}
