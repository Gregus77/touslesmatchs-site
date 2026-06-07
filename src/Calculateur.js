import React from "react";

export default function Calculateur({ setPage, footer, bandeauLegal, header, picks }) {
  var bankrollState = React.useState(1000);
  var bankroll = bankrollState[0];
  var setBankroll = bankrollState[1];

  var miseState = React.useState(2);
  var misePct = miseState[0];
  var setMisePct = miseState[1];

  var dureeState = React.useState(90); // 3 mois par défaut
  var duree = dureeState[0];
  var setDuree = dureeState[1];

  // Stats réelles tirées de picks
  var wins = picks.filter(function(p){return p[5]==="GAGNE";}).length;
  var losses = picks.filter(function(p){return p[5]==="PERDU";}).length;
  var total = wins + losses;
  var winrateReel = total > 0 ? (wins/total) : 0.78;

  // Cote moyenne réelle
  var coteSum = 0, coteCount = 0;
  picks.forEach(function(p){
    if (p[5]==="GAGNE" || p[5]==="PERDU") {
      var c = parseFloat(p[3]);
      if (!isNaN(c)) { coteSum += c; coteCount++; }
    }
  });
  var coteMoyenne = coteCount > 0 ? (coteSum/coteCount) : 1.55;

  // 3 scénarios : pessimiste / moyen / optimiste
  // ROI quotidien moyen = (winrate × (cote-1) - (1-winrate))
  function calc(scenarioWinrate) {
    var mise = bankroll * (misePct/100);
    var roi = (scenarioWinrate * (coteMoyenne - 1)) - (1 - scenarioWinrate);
    // ROI par pari (1 pari/jour)
    var bankFinale = bankroll;
    for (var j = 0; j < duree; j++) {
      var miseDuJour = bankFinale * (misePct/100);
      var gainOuPerte = Math.random() < scenarioWinrate
        ? miseDuJour * (coteMoyenne - 1)
        : -miseDuJour;
      // Approximation : on utilise l'espérance plutôt que le random pour stabilité
      bankFinale += miseDuJour * roi;
    }
    return Math.round(bankFinale);
  }

  // Calcul déterministe (espérance mathématique)
  function calcDet(scenarioWinrate) {
    var roiPariMoyen = (scenarioWinrate * (coteMoyenne - 1)) - (1 - scenarioWinrate);
    // Croissance composée : bankroll × (1 + misePct/100 × roi) ^ duree
    var croissance = Math.pow(1 + (misePct/100) * roiPariMoyen, duree);
    return Math.round(bankroll * croissance);
  }

  var pessimiste = calcDet(0.65);
  var moyen = calcDet(0.75);
  var optimiste = calcDet(0.85);

  var gainPessimiste = pessimiste - bankroll;
  var gainMoyen = moyen - bankroll;
  var gainOptimiste = optimiste - bankroll;

  function ScenarioBox(props) {
    var color = props.color;
    var label = props.label;
    var value = props.value;
    var gain = props.gain;
    var emoji = props.emoji;
    return React.createElement("div", {
      style: {
        background: "rgba(212,175,55,0.04)",
        border: "2px solid " + color,
        borderRadius: "16px",
        padding: "30px 20px",
        textAlign: "center",
        flex: 1,
        minWidth: "260px"
      }
    },
      React.createElement("div", { style: { fontSize: "28px", marginBottom: "12px" }}, emoji),
      React.createElement("div", { style: { fontSize: "11px", letterSpacing: "3px", color: "#888", marginBottom: "8px", textTransform: "uppercase" }}, label),
      React.createElement("div", { style: { fontSize: "36px", fontWeight: "bold", color: color, marginBottom: "8px", fontFamily: "'Bodoni Moda',serif" }}, value.toLocaleString("fr-FR") + " €"),
      React.createElement("div", { style: { fontSize: "14px", color: gain >= 0 ? "#22cc44" : "#cc4422", fontWeight: "bold" }}, (gain >= 0 ? "+" : "") + gain.toLocaleString("fr-FR") + " €"),
      React.createElement("div", { style: { fontSize: "11px", color: "#666", marginTop: "6px" }}, "sur " + duree + " jours")
    );
  }

  function Slider(props) {
    return React.createElement("div", { style: { marginBottom: "24px" }},
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "8px" }},
        React.createElement("label", { style: { fontSize: "13px", color: "#aaa", letterSpacing: "1px" }}, props.label),
        React.createElement("span", { style: { fontSize: "18px", color: "#d4af37", fontWeight: "bold", fontFamily: "'Bodoni Moda',serif" }}, props.display)
      ),
      React.createElement("input", {
        type: "range",
        min: props.min, max: props.max, step: props.step,
        value: props.value,
        onChange: function(e) { props.onChange(parseFloat(e.target.value)); },
        style: { width: "100%", accentColor: "#d4af37" }
      })
    );
  }

  return React.createElement("div", { style: { background: "linear-gradient(180deg,#131826 0%,#0b1018 500px,#080c14 100%)", minHeight: "100vh", fontFamily: "Georgia,serif", color: "#e8e0d0" }},
    header,
    React.createElement("div", { className: "home-section", style: { maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }},
      React.createElement("h1", { style: { color: "#d4af37", letterSpacing: "4px", fontSize: "16px", marginBottom: "8px", textAlign: "center", textTransform: "uppercase" }}, "Calculateur de Projection"),
      React.createElement("p", { style: { color: "#666", fontSize: "13px", textAlign: "center", marginBottom: "32px", lineHeight: "1.7" }},
        "Estimez vos gains potentiels basés sur ", React.createElement("strong", { style: { color: "#d4af37" }}, "nos stats réelles"),
        " : ", winrateReel*100|0, "% de réussite, cote moyenne ", coteMoyenne.toFixed(2)
      ),

      // === SLIDERS ===
      React.createElement("div", { style: { background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: "16px", padding: "32px 24px", marginBottom: "32px" }},
        Slider({ label: "BANKROLL INITIAL", display: bankroll.toLocaleString("fr-FR") + " €", min: 100, max: 10000, step: 100, value: bankroll, onChange: setBankroll }),
        Slider({ label: "MISE PAR PARI (% bankroll)", display: misePct + " %", min: 1, max: 10, step: 0.5, value: misePct, onChange: setMisePct }),
        Slider({ label: "DURÉE", display: duree + " jours (" + (duree/30|0) + " mois)", min: 30, max: 365, step: 30, value: duree, onChange: setDuree })
      ),

      // === RÉSULTATS ===
      React.createElement("div", { style: { display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "32px" }},
        ScenarioBox({ emoji: "📊", color: "#888", label: "Pessimiste (65%)", value: pessimiste, gain: gainPessimiste }),
        ScenarioBox({ emoji: "🎯", color: "#d4af37", label: "Réaliste (75%)", value: moyen, gain: gainMoyen }),
        ScenarioBox({ emoji: "🔥", color: "#22cc44", label: "Optimiste (85%)", value: optimiste, gain: gainOptimiste })
      ),

      // === AVERTISSEMENT ===
      React.createElement("div", { style: { background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "12px", padding: "18px", marginBottom: "24px" }},
        React.createElement("div", { style: { fontSize: "12px", color: "#f59e0b", fontWeight: "bold", marginBottom: "6px" }}, "⚠️ AVERTISSEMENT"),
        React.createElement("div", { style: { fontSize: "12px", color: "#aaa", lineHeight: "1.6" }},
          "Ces projections sont basées sur nos statistiques passées (21G/6P = 78%). Les performances passées ne garantissent pas les performances futures. Jouez de manière responsable. ", React.createElement("strong", { style: { color: "#fff" }}, "Ne misez jamais plus que ce que vous pouvez vous permettre de perdre.")
        )
      ),

      // === CTA ===
      React.createElement("div", { style: { textAlign: "center", padding: "30px 20px", background: "linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.02))", border: "1px solid rgba(212,175,55,0.3)", borderRadius: "16px" }},
        React.createElement("div", { style: { fontSize: "13px", color: "#d4af37", letterSpacing: "3px", marginBottom: "12px", textTransform: "uppercase" }}, "Prêt à commencer ?"),
        React.createElement("h3", { style: { color: "#fff", fontSize: "24px", marginBottom: "16px", fontFamily: "'Bodoni Moda',serif", fontWeight: "400" }}, "Reçois le pick du jour gratuitement"),
        React.createElement("div", { style: { display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }},
          React.createElement("a", { href: "https://t.me/touslesmatchs_bot", target: "_blank", rel: "noopener noreferrer", style: { background: "linear-gradient(135deg, #d4af37, #b8941f)", color: "#000", padding: "14px 32px", borderRadius: "8px", textDecoration: "none", fontWeight: "bold", fontSize: "14px", letterSpacing: "1px" }}, "📲 BOT TELEGRAM"),
          React.createElement("button", { onClick: function(){ setPage("home"); }, style: { background: "transparent", color: "#d4af37", padding: "14px 32px", borderRadius: "8px", border: "1px solid #d4af37", cursor: "pointer", fontWeight: "bold", fontSize: "14px", letterSpacing: "1px" }}, "🎯 VOIR LES PICKS")
        )
      )
    ),
    footer,
    bandeauLegal
  );
}
