 import { useState } from "react";

const picks = [
  { date: "13/05", match: "Lazio vs Inter Milan", marche: "Inter ML", cote: 1.66, resultat: "GAGNE", score: "0-2", sport: "Foot", ligue: "Finale Coupe Italie" },
  { date: "13/05", match: "Villarreal vs Seville", marche: "Over 2.5", cote: 1.75, resultat: "GAGNE", score: "2-2", sport: "Foot", ligue: "La Liga" },
  { date: "11/05", match: "Carolina vs Philadelphia", marche: "Carolina ML", cote: 1.58, resultat: "GAGNE", score: "4-2", sport: "Hockey", ligue: "NHL Playoffs G4" },
  { date: "10/05", match: "Colorado vs Minnesota", marche: "Colorado ML", cote: 1.62, resultat: "GAGNE", score: "5-1", sport: "Hockey", ligue: "NHL Playoffs G3" },
  { date: "09/05", match: "VGK vs Anaheim", marche: "VGK ML", cote: 1.55, resultat: "GAGNE", score: "6-2", sport: "Hockey", ligue: "NHL Playoffs G3" },
  { date: "08/05", match: "Carolina vs Philadelphia", marche: "Carolina ML", cote: 1.52, resultat: "GAGNE", score: "4-1", sport: "Hockey", ligue: "NHL Playoffs G3" },
  { date: "07/05", match: "Anaheim vs VGK", marche: "Anaheim ML", cote: 1.78, resultat: "GAGNE", score: "3-1", sport: "Hockey", ligue: "NHL Playoffs G2" },
  { date: "06/05", match: "Buffalo vs Montreal", marche: "Buffalo ML", cote: 1.60, resultat: "PERDU", score: "1-5", sport: "Hockey", ligue: "NHL Playoffs G2" },
  { date: "05/05", match: "VGK vs Anaheim", marche: "VGK ML", cote: 1.54, resultat: "GAGNE", score: "3-1", sport: "Hockey", ligue: "NHL Playoffs G1" },
  { date: "04/05", match: "Colorado vs Minnesota", marche: "Colorado ML", cote: 1.58, resultat: "GAGNE", score: "9-6", sport: "Hockey", ligue: "NHL Playoffs G1" },
  { date: "03/05", match: "Carolina vs Philadelphia", marche: "Carolina ML", cote: 1.50, resultat: "GAGNE", score: "3-0", sport: "Hockey", ligue: "NHL Playoffs G1" },
  { date: "02/05", match: "Utah vs VGK", marche: "VGK ML", cote: 1.62, resultat: "GAGNE", score: "5-1", sport: "Hockey", ligue: "NHL Playoffs G6" },
  { date: "01/05", match: "Buffalo vs Boston", marche: "Buffalo ML", cote: 1.70, resultat: "GAGNE", score: "4-1", sport: "Hockey", ligue: "NHL Playoffs G6" },
  { date: "29/04", match: "Leverkusen vs Dortmund", marche: "Over 2.5", cote: 1.62, resultat: "GAGNE", score: "3-1", sport: "Foot", ligue: "Bundesliga" },
  { date: "28/04", match: "Bayern vs Stuttgart", marche: "Over 2.5", cote: 1.55, resultat: "PERDU", score: "1-0", sport: "Foot", ligue: "Bundesliga" },
];

export default function App() {
  var filterState = useState("ALL");
  var filter = filterState[0];
  var setFilter = filterState[1];
  var filtered = filter === "ALL" ? picks : picks.filter(function(p) { return p.sport === filter; });
  var wins = picks.filter(function(p) { return p.resultat === "GAGNE"; }).length;
  var winrate = Math.round((wins / picks.length) * 100);

  return React.createElement("div", { style: { background: "#080c14", minHeight: "100vh", fontFamily: "Georgia, serif", color: "#e8e0d0" } },

    React.createElement("header", { style: { borderBottom: "1px solid rgba(212,175,55,0.2)", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#080c14", position: "sticky", top: 0, zIndex: 50 } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: 20, fontWeight: "bold", color: "#d4af37", letterSpacing: 2 } }, "TOUSLESMATCHS"),
        React.createElement("div", { style: { fontSize: 10, color: "#666", letterSpacing: 3 } }, "Analyse - Intelligence - Resultats")
      ),
      React.createElement("button", { style: { background: "linear-gradient(135deg, #d4af37, #f5d76e)", border: "none", borderRadius: 4, padding: "8px 20px", color: "#080c14", fontWeight: "bold", cursor: "pointer" } }, "ABONNEMENT")
    ),

    React.createElement("section", { style: { padding: "60px 40px 30px", textAlign: "center" } },
      React.createElement("div", { style: { fontSize: 11, letterSpacing: 6, color: "#d4af37", marginBottom: 16 } }, "PROPULSE PAR INTELLIGENCE ARTIFICIELLE"),
      React.createElement("h1", { style: { fontSize: 46, fontWeight: "bold", color: "#d4af37", margin: "0 0 20px" } }, "Le meilleur pick chaque jour."),
      React.createElement("p", { style: { color: "#555", fontSize: 15, maxWidth: 460, margin: "0 auto 40px" } }, "Notre IA analyse des centaines de matchs pour livrer uniquement les paris a haute valeur."),
      React.createElement("div", { style: { display: "flex", justifyContent: "center", maxWidth: 720, margin: "0 auto", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, overflow: "hidden" } },
        [
          { label: "WIN RATE", value: winrate + "%", sub: "sur " + picks.length + " paris" },
          { label: "BANKROLL", value: "+55%", sub: "en 2 semaines" },
          { label: "PROFIT NET", value: "+23 EUR", sub: "depuis le debut" },
          { label: "SERIE", value: "9W", sub: "consecutives" },
        ].map(function(s, i) {
          return React.createElement("div", { key: i, style: { flex: 1, padding: "24px 16px", borderRight: i < 3 ? "1px solid rgba(212,175,55,0.15)" : "none" } },
            React.createElement("div", { style: { fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8 } }, s.label),
            React.createElement("div", { style: { fontSize: 26, fontWeight: "bold", color: "#d4af37" } }, s.value),
            React.createElement("div", { style: { fontSize: 11, color: "#444", marginTop: 4 } }, s.sub)
          );
        })
      )
    ),

    React.createElement("section", { style: { padding: "30px 40px 60px", maxWidth: 980, margin: "0 auto" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } },
        React.createElement("h2", { style: { fontSize: 16, color: "#d4af37", letterSpacing: 3, margin: 0 } }, "HISTORIQUE DES PICKS"),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
          ["ALL", "Foot", "Hockey"].map(function(f) {
            return React.createElement("button", { key: f, onClick: function() { setFilter(f); }, style: { background: filter === f ? "rgba(212,175,55,0.15)" : "transparent", border: "1px solid " + (filter === f ? "#d4af37" : "rgba(255,255,255,0.1)"), color: filter === f ? "#d4af37" : "#555", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13 } }, f === "ALL" ? "Tous" : f);
          })
        )
      ),

      React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
        filtered.map(function(p, i) {
          var estGagne = p.resultat === "GAGNE";
          return React.createElement("div", { key: i, style: { display: "flex", flexDirection: "row", alignItems: "center", padding: "14px 16px", background: estGagne ? "rgba(34,180,60,0.05)" : "rgba(255,60,60,0.05)", border: "1px solid " + (estGagne ? "rgba(34,180,60,0.2)" : "rgba(255,60,60,0.2)"), borderRadius: 6, gap: 12 } },

            React.createElement("div", { style: { width: 60, fontSize: 12, color: "#555", flexShrink: 0 } }, p.date),

            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", { style: { fontSize: 14, color: "#ddd" } }, p.match),
              React.createElement("div", { style: { fontSize: 10, color: "#444" } }, p.ligue)
            ),

            React.createElement("div", { style: { width: 180, flexShrink: 0 } },
              React.createElement("div", { style: { background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 3, padding: "3px 10px", fontSize: 11, color: "#d4af37", display: "inline-block", marginBottom: 4 } }, p.marche),
              React.createElement("div", { style: { fontSize: 14, fontWeight: "bold", color: "#fff" } }, "Cote : " + p.cote)
            ),

            React.createElement("div", { style: { width: 70, flexShrink: 0, fontSize: 13, color: "#666" } }, p.score),

            React.createElement("div", { style: { width: 120, flexShrink: 0, display: "flex", alignItems: "center", gap: 8 } },
              React.createElement("div", { style: { width: 12, height: 12, borderRadius: "50%", background: estGagne ? "#22cc44" : "#ff4444", flexShrink: 0, boxShadow: estGagne ? "0 0 6px #22cc44" : "0 0 6px #ff4444" } }),
              React.createElement("span", { style: { fontSize: 13, fontWeight: "bold", color: estGagne ? "#22cc44" : "#ff4444" } }, estGagne ? "GAGNE" : "PERDU")
            )
          );
        })
      ),

      React.createElement("div", { style: { marginTop: 50, background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 12, padding: "40px", textAlign: "center" } },
        React.createElement("div", { style: { fontSize: 11, letterSpacing: 4, color: "#d4af37", marginBottom: 12 } }, "ACCES PREMIUM"),
        React.createElement("h3", { style: { fontSize: 26, margin: "0 0 12px", color: "#fff" } }, "1 pick par jour. Analyse par IA."),
        React.createElement("p", { style: { color: "#555", fontSize: 14, marginBottom: 30 } }, "Note /10, mise recommandee, analyse complete."),
        React.createElement("div", { style: { display: "flex", gap: 16, justifyContent: "center" } },
          React.createElement("div", { style: { border: "1px solid rgba(212,175,55,0.3)", borderRadius: 8, padding: "24px 32px" } },
            React.createElement("div", { style: { fontSize: 28, fontWeight: "bold", color: "#d4af37" } }, "9 EUR"),
            React.createElement("div", { style: { fontSize: 12, color: "#555", marginTop: 4 } }, "/mois - Starter")
          ),
          React.createElement("div", { style: { background: "linear-gradient(135deg, #d4af37, #f5d76e)", borderRadius: 8, padding: "24px 32px" } },
            React.createElement("div", { style: { fontSize: 28, fontWeight: "bold", color: "#080c14" } }, "19 EUR"),
            React.createElement("div", { style: { fontSize: 12, color: "rgba(8,12,20,0.6)", marginTop: 4 } }, "/mois - Premium")
          )
        )
      )
    )
  );
}