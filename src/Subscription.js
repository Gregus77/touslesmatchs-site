import React from "react";

export default function Subscription({ setPage }) {
  var loadingState = React.useState(false);
  var loading = loadingState[0]; var setLoading = loadingState[1];
  var errorState = React.useState("");
  var error = errorState[0]; var setError = errorState[1];
  var selectedState = React.useState(null);
  var selected = selectedState[0]; var setSelected = selectedState[1];

  var plans = [
    {
      id: "free",
      name: "GRATUIT",
      price: "0€",
      sub: "pour toujours",
      color: "#94A3B8",
      highlight: false,
      features: [
        "1 pick ANJ / jour",
        "Winamax, Betclic, PMU",
        "Canal Telegram public",
        "Calculateur de projection",
      ],
      cta: "Commencer gratuitement",
      priceId: null,
    },
    {
      id: "premium",
      name: "PREMIUM",
      price: "9,90€",
      sub: "/ mois",
      color: "#00D4FF",
      highlight: false,
      badge: "POPULAIRE",
      features: [
        "Pick Premium du jour (ANJ)",
        "Picks 3 prochains jours",
        "Analyses détaillées",
        "Canal Telegram Premium privé",
        "10 analyses personnalisées/mois",
      ],
      cta: "⭐ Devenir Premium",
      priceId: process.env.REACT_APP_STRIPE_PRICE_PREMIUM,
    },
    {
      id: "premium_plus",
      name: "PREMIUM PLUS",
      price: "19,90€",
      sub: "/ mois",
      color: "#00FF88",
      highlight: true,
      badge: "MEILLEURE VALEUR",
      features: [
        "Tout Premium inclus",
        "Pick HORS-ARJEL (Pinnacle)",
        "Cotes supérieures",
        "50 analyses personnalisées/mois",
        "Sports supplémentaires + Value Bets",
        "Analyses prioritaires Hermès",
      ],
      cta: "💎 Devenir Premium Plus",
      priceId: process.env.REACT_APP_STRIPE_PRICE_VIP,
    },
  ];

  function handleCheckout(plan) {
    setSelected(plan.id);
    if (plan.priceId === null) {
      if (setPage) setPage("home");
      else window.location.href = "/";
      return;
    }
    if (!plan.priceId) {
      setError("Paiement en cours de configuration. Réessayez bientôt.");
      return;
    }
    setLoading(true);
    setError("");
    fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price_id: plan.priceId }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setLoading(false);
        if (d.ok && d.url) {
          window.location.href = d.url;
        } else {
          setError(d.error || "Erreur lors de la création du paiement.");
        }
      })
      .catch(function() {
        setLoading(false);
        setError("Erreur serveur. Veuillez réessayer dans quelques instants.");
      });
  }

  return React.createElement("div", {
    style: { minHeight:"100vh", background:"#05070A", color:"#F8FAFC", fontFamily:"'Jost',sans-serif", padding:"32px 16px 60px" }
  },

    // Bouton retour
    React.createElement("div", { style:{ maxWidth:"900px", margin:"0 auto 32px" } },
      React.createElement("button", {
        onClick: function(){ if(setPage) setPage("home"); else window.location.href="/"; },
        style:{ background:"transparent", border:"none", color:"#94A3B8", fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", padding:0, fontFamily:"'Jost',sans-serif" }
      }, "← Retour")
    ),

    // Header
    React.createElement("div", { style:{ textAlign:"center", maxWidth:"600px", margin:"0 auto 48px" } },
      React.createElement("div", { style:{ fontSize:"11px", letterSpacing:"4px", color:"#00FF88", marginBottom:"12px", fontWeight:"600" } }, "NOS FORMULES"),
      React.createElement("h1", {
        style:{ fontFamily:"'Bodoni Moda',serif", fontSize:"clamp(26px,5vw,42px)", fontWeight:"700", color:"#F8FAFC", margin:"0 0 12px", lineHeight:"1.2" }
      }, "Choisissez votre niveau"),
      React.createElement("p", {
        style:{ color:"#94A3B8", fontSize:"14px", lineHeight:"1.8", margin:0 }
      }, "Commencez gratuitement. Passez Premium quand vous êtes convaincu.")
    ),

    // Erreur
    error && React.createElement("div", {
      style:{ maxWidth:"900px", margin:"0 auto 24px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:"10px", padding:"12px 16px", color:"#EF4444", fontSize:"13px", textAlign:"center" }
    }, "⚠️ " + error),

    // Plans
    React.createElement("div", {
      style:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"20px", maxWidth:"900px", margin:"0 auto 40px" }
    },
      plans.map(function(plan, i) {
        var isLoading = loading && selected === plan.id;
        return React.createElement("div", {
          key: i,
          style:{
            position:"relative",
            background: plan.highlight
              ? "linear-gradient(135deg,rgba(0,255,136,0.10),rgba(0,255,136,0.04))"
              : "rgba(255,255,255,0.03)",
            border: plan.highlight
              ? "2px solid rgba(0,255,136,0.5)"
              : plan.id === "premium"
                ? "1px solid rgba(0,255,136,0.3)"
                : "1px solid rgba(255,255,255,0.07)",
            borderRadius:"16px",
            padding:"28px 22px",
            boxShadow: plan.highlight ? "0 0 30px rgba(0,255,136,0.08)" : "none",
          }
        },

          // Badge
          plan.badge && React.createElement("div", {
            style:{
              position:"absolute", top:"-11px", left:"50%", transform:"translateX(-50%)",
              background: plan.highlight ? "#00FF88" : "rgba(0,255,136,0.15)",
              border: plan.highlight ? "none" : "1px solid rgba(0,255,136,0.4)",
              color: plan.highlight ? "#05070A" : "#00FF88",
              padding:"3px 14px", borderRadius:"20px", fontSize:"9px", fontWeight:"700",
              letterSpacing:"1.5px", whiteSpace:"nowrap"
            }
          }, plan.badge),

          // Nom
          React.createElement("div", {
            style:{ fontSize:"10px", letterSpacing:"3px", color:plan.color, marginBottom:"10px", fontWeight:"700" }
          }, plan.name),

          // Prix
          React.createElement("div", { style:{ display:"flex", alignItems:"baseline", gap:"5px", marginBottom:"18px" } },
            React.createElement("span", {
              style:{ fontSize:"36px", fontWeight:"700", color: plan.id==="free" ? "#555" : "#F8FAFC", fontFamily:"'Bodoni Moda',serif" }
            }, plan.price),
            React.createElement("span", { style:{ fontSize:"12px", color:"#64748B" } }, plan.sub)
          ),

          // Séparateur
          React.createElement("div", { style:{ borderTop:"1px solid rgba(255,255,255,0.06)", marginBottom:"18px" } }),

          // Features
          React.createElement("ul", { style:{ listStyle:"none", padding:0, margin:"0 0 24px", display:"flex", flexDirection:"column", gap:"10px" } },
            plan.features.map(function(f, fi) {
              return React.createElement("li", {
                key: fi,
                style:{ display:"flex", alignItems:"flex-start", gap:"10px", fontSize:"13px", color: plan.id==="free" ? "#555" : "#aaa", lineHeight:"1.5" }
              },
                React.createElement("span", { style:{ color: plan.id==="free" ? "#333" : "#22cc44", flexShrink:0, marginTop:"1px" } }, "✓"),
                f
              );
            })
          ),

          // Bouton CTA
          React.createElement("button", {
            onClick: function() { handleCheckout(plan); },
            disabled: loading,
            style:{
              width:"100%", padding:"14px", borderRadius:"10px",
              background: plan.highlight
                ? "linear-gradient(135deg,#00FF88,#34FFB0)"
                : plan.id === "premium"
                  ? "transparent"
                  : "rgba(255,255,255,0.02)",
              border: plan.highlight
                ? "none"
                : plan.id === "premium"
                  ? "1px solid #00D4FF"
                  : "1px solid rgba(255,255,255,0.08)",
              color: plan.highlight ? "#05070A" : plan.id === "premium" ? "#00D4FF" : "#444",
              fontSize:"14px", fontWeight:"700", cursor: loading ? "wait" : "pointer",
              fontFamily:"'Jost',sans-serif", letterSpacing:"0.5px",
              opacity: loading && selected !== plan.id ? 0.5 : 1,
              transition:"opacity 0.2s"
            }
          }, isLoading ? "⏳ Redirection..." : plan.cta)
        );
      })
    ),

    // Garanties
    React.createElement("div", {
      style:{ maxWidth:"900px", margin:"0 auto 32px", display:"flex", gap:"24px", flexWrap:"wrap", justifyContent:"center" }
    },
      [
        { icon:"🔒", text:"Paiement sécurisé Stripe" },
        { icon:"↩️", text:"Résiliable à tout moment" },
        { icon:"📊", text:"78% de winrate réel" },
      ].map(function(g, i) {
        return React.createElement("div", {
          key:i,
          style:{ display:"flex", alignItems:"center", gap:"8px", fontSize:"12px", color:"#64748B" }
        }, g.icon, " ", g.text);
      })
    ),

    // Disclaimer légal
    React.createElement("div", {
      style:{ maxWidth:"700px", margin:"0 auto", textAlign:"center", fontSize:"11px", color:"#333", lineHeight:"1.8" }
    },
      "🔞 Interdit aux moins de 18 ans | joueurs-info-service.fr | 09 74 75 13 13",
      React.createElement("br"),
      "Les paris comportent des risques de perte financière. Pariez de manière responsable."
    )
  );
}
