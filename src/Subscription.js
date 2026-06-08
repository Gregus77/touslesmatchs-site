import React from "react";

export default function Subscription() {
  var [selectedPlan, setSelectedPlan] = React.useState(null);
  var [loading, setLoading] = React.useState(false);
  var [error, setError] = React.useState("");

  var plans = [
    {
      name: "Free",
      price: "0€",
      period: "/mois",
      color: "#888",
      features: ["3 analyses/jour", "Accès site public", "Canal Telegram public"],
      cta: "Gratuit",
      priceId: null,
    },
    {
      name: "Premium",
      price: "9,90€",
      period: "/mois",
      color: "#C9A227",
      features: [
        "10 analyses/jour",
        "Accès premium site",
        "Canal Telegram premium",
        "Support prioritaire",
      ],
      cta: "Choisir",
      priceId: process.env.REACT_APP_STRIPE_PRICE_PREMIUM,
      recommended: true,
    },
    {
      name: "VIP",
      price: "19,90€",
      period: "/mois",
      color: "#60A5FA",
      features: [
        "30 analyses/jour",
        "Accès VIP complet",
        "Canal Telegram VIP privé",
        "Analytics détaillés",
        "Support 24/7",
      ],
      cta: "Choisir",
      priceId: process.env.REACT_APP_STRIPE_PRICE_VIP,
    },
    {
      name: "Elite",
      price: "29,90€",
      period: "/mois",
      color: "#A78BFA",
      features: [
        "Analyses illimitées",
        "Accès Elite complet",
        "Canal Telegram Elite privé",
        "API personnalisée",
        "Support dédié",
      ],
      cta: "Choisir",
      priceId: process.env.REACT_APP_STRIPE_PRICE_ELITE,
    },
  ];

  function handleCheckout(plan) {
    if (plan.priceId === null) {
      // Explicitly free plan
      localStorage.setItem("user_status", "free");
      window.location.href = "/";
      return;
    }
    if (!plan.priceId) {
      // Stripe env vars not configured
      setError("Paiement en cours de configuration. Réessayez bientôt ou contactez-nous.");
      return;
    }

    setLoading(true);
    setError("");

    fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price_id: plan.priceId,
        user_id: localStorage.getItem("user_id"),
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.ok && d.url) {
          window.location.href = d.url; // Redirect to Stripe Checkout
        } else {
          setError(d.error || "Erreur Stripe");
        }
      })
      .catch(() => {
        setLoading(false);
        setError("Erreur serveur");
      });
  }

  return React.createElement(
    "div",
    {
      style: {
        minHeight: "100vh",
        background: "#080706",
        color: "#F5F0E8",
        fontFamily: "'Jost',sans-serif",
        padding: "24px 16px",
      },
    },

    // Header
    React.createElement(
      "div",
      { style: { textAlign: "center", marginBottom: "48px", maxWidth: "700px", margin: "0 auto 48px" } },
      React.createElement(
        "h1",
        {
          style: {
            fontFamily: "'Bodoni Moda',serif",
            fontSize: "clamp(28px,6vw,48px)",
            fontWeight: "700",
            color: "#F5F0E8",
            margin: "0 0 12px",
          },
        },
        "Choisir votre plan"
      ),
      React.createElement(
        "p",
        { style: { color: "#6b6356", fontSize: "15px", lineHeight: "1.7" } },
        "Accédez à plus d'analyses et de fonctionnalités premium"
      )
    ),

    error &&
      React.createElement(
        "div",
        {
          style: {
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "24px",
            color: "#EF4444",
            textAlign: "center",
          },
        },
        error
      ),

    // Plans grid
    React.createElement(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          maxWidth: "1200px",
          margin: "0 auto",
        },
      },
      plans.map((plan, i) =>
        React.createElement(
          "div",
          {
            key: i,
            style: {
              background:
                plan.recommended && plan.name !== "Free"
                  ? "rgba(201,162,39,0.08)"
                  : "rgba(255,255,255,0.04)",
              border:
                plan.recommended && plan.name !== "Free"
                  ? "2px solid rgba(201,162,39,0.4)"
                  : "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              padding: "24px",
              position: "relative",
            },
          },

          // Recommended badge
          plan.recommended &&
            React.createElement(
              "div",
              {
                style: {
                  position: "absolute",
                  top: "-12px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#C9A227",
                  color: "#080706",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: "700",
                  letterSpacing: "1px",
                },
              },
              "⭐ RECOMMANDÉ"
            ),

          // Plan name
          React.createElement(
            "div",
            {
              style: {
                fontSize: "20px",
                fontWeight: "700",
                color: plan.color,
                marginBottom: "8px",
              },
            },
            plan.name
          ),

          // Price
          React.createElement(
            "div",
            {
              style: {
                fontSize: "32px",
                fontWeight: "700",
                color: "#F5F0E8",
                marginBottom: "4px",
              },
            },
            plan.price
          ),
          React.createElement(
            "div",
            {
              style: {
                fontSize: "13px",
                color: "#6b6356",
                marginBottom: "20px",
              },
            },
            plan.period
          ),

          // Features
          React.createElement(
            "ul",
            {
              style: {
                listStyle: "none",
                padding: "0",
                margin: "0 0 20px",
              },
            },
            plan.features.map((feature, fi) =>
              React.createElement(
                "li",
                {
                  key: fi,
                  style: {
                    fontSize: "13px",
                    color: "#ccc",
                    marginBottom: "8px",
                    paddingLeft: "20px",
                    position: "relative",
                  },
                },
                React.createElement(
                  "span",
                  {
                    style: {
                      position: "absolute",
                      left: "0",
                      color: plan.color,
                    },
                  },
                  "✓"
                ),
                feature
              )
            )
          ),

          // CTA Button
          React.createElement("button", {
            onClick: () => handleCheckout(plan),
            disabled: loading,
            style: {
              width: "100%",
              padding: "14px",
              background:
                loading || selectedPlan === plan.name
                  ? "#2a2a2a"
                  : `rgba(${plan.color === "#C9A227" ? "201,162,39" : "100,100,100"},0.2)`,
              border: `1px solid ${plan.color}`,
              borderRadius: "10px",
              color: plan.color,
              fontSize: "14px",
              fontWeight: "700",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Jost',sans-serif",
              letterSpacing: "0.05em",
            },
            children:
              loading && selectedPlan === plan.name
                ? "🔄 Chargement..."
                : plan.cta,
            onClick: () => {
              setSelectedPlan(plan.name);
              handleCheckout(plan);
            },
          })
        )
      )
    )
  );
}
