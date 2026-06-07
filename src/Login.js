import React from "react";

export default function Login() {
  var [email, setEmail] = React.useState("");
  var [password, setPassword] = React.useState("");
  var [loading, setLoading] = React.useState(false);
  var [error, setError] = React.useState("");
  var [mode, setMode] = React.useState("login"); // login ou register
  var [success, setSuccess] = React.useState("");

  function handleSubmit() {
    if (!email || !password) {
      setError("Email et mot de passe requis");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.ok) {
          setSuccess(
            mode === "login"
              ? "Connexion réussie! Redirection..."
              : "Inscription réussie! Redirection..."
          );
          localStorage.setItem("user_id", d.user.id);
          localStorage.setItem("user_status", d.user.status);
          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
        } else {
          setError(d.error || "Erreur");
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
        maxWidth: "400px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      },
    },

    // Header
    React.createElement(
      "div",
      { style: { textAlign: "center", marginBottom: "36px" } },
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
        mode === "login" ? "Connexion" : "Inscription"
      ),
      React.createElement(
        "p",
        { style: { color: "#6b6356", fontSize: "15px", lineHeight: "1.7" } },
        mode === "login"
          ? "Accédez à votre compte TousLesMatchs"
          : "Créez votre compte gratuitement"
      )
    ),

    // Form
    React.createElement(
      "div",
      {
        style: {
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(201,162,39,0.2)",
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "24px",
        },
      },

      // Email
      React.createElement(
        "div",
        { style: { marginBottom: "14px" } },
        React.createElement(
          "label",
          {
            style: {
              fontSize: "11px",
              letterSpacing: "2px",
              color: "#C9A227",
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
            },
          },
          "EMAIL"
        ),
        React.createElement("input", {
          type: "email",
          value: email,
          onChange: (e) => setEmail(e.target.value),
          placeholder: "toi@exemple.com",
          style: {
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
            padding: "12px",
            color: "#F5F0E8",
            fontSize: "15px",
            fontFamily: "'Jost',sans-serif",
            boxSizing: "border-box",
          },
        })
      ),

      // Password
      React.createElement(
        "div",
        { style: { marginBottom: "14px" } },
        React.createElement(
          "label",
          {
            style: {
              fontSize: "11px",
              letterSpacing: "2px",
              color: "#C9A227",
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
            },
          },
          "MOT DE PASSE"
        ),
        React.createElement("input", {
          type: "password",
          value: password,
          onChange: (e) => setPassword(e.target.value),
          placeholder: "••••••••",
          style: {
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
            padding: "12px",
            color: "#F5F0E8",
            fontSize: "15px",
            fontFamily: "'Jost',sans-serif",
            boxSizing: "border-box",
          },
        })
      ),

      // Error message
      error &&
        React.createElement(
          "div",
          { style: { color: "#EF4444", fontSize: "13px", marginBottom: "12px" } },
          "⚠️ " + error
        ),

      // Success message
      success &&
        React.createElement(
          "div",
          { style: { color: "#22C55E", fontSize: "13px", marginBottom: "12px" } },
          "✓ " + success
        ),

      // Button
      React.createElement("button", {
        onClick: handleSubmit,
        disabled: loading,
        style: {
          width: "100%",
          padding: "16px",
          background: loading
            ? "#2a2a2a"
            : "linear-gradient(135deg,#C9A227,#E8C14A)",
          border: "none",
          borderRadius: "10px",
          color: loading ? "#555" : "#080706",
          fontSize: "16px",
          fontWeight: "700",
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "'Jost',sans-serif",
          letterSpacing: "0.05em",
          marginBottom: "14px",
        },
        children: loading
          ? "🔮 Vérification..."
          : mode === "login"
          ? "Se connecter"
          : "S'inscrire",
      }),

      // Toggle mode
      React.createElement(
        "div",
        { style: { textAlign: "center", fontSize: "13px", color: "#6b6356" } },
        mode === "login" ? "Pas de compte? " : "Déjà inscrit? ",
        React.createElement(
          "button",
          {
            onClick: () => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
              setSuccess("");
            },
            style: {
              background: "none",
              border: "none",
              color: "#C9A227",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "13px",
            },
            children: mode === "login" ? "Inscris-toi" : "Connecte-toi",
          }
        )
      )
    )
  );
}
