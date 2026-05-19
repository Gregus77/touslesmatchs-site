import React from "react";

var API_URL = process.env.REACT_APP_COUNCIL_API || "http://localhost:3001";

var IA_COLORS = {
  Claude: "#d4802a",
  "GPT-4o": "#10a37f",
  Gemini: "#4285f4",
  Grok: "#1d9bf0",
  Mistral: "#ff6b00",
};

function IaCard(props) {
  var v = props.vote;
  var color = IA_COLORS[v.ia] || "#888";
  if (!v.success) {
    return React.createElement(
      "div",
      {
        style: {
          background: "rgba(255,60,60,0.05)",
          border: "1px solid rgba(255,60,60,0.2)",
          borderRadius: "10px",
          padding: "16px",
          flex: "1",
          minWidth: "160px",
        },
      },
      React.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" } },
        React.createElement("div", {
          style: { width: "8px", height: "8px", borderRadius: "50%", background: color },
        }),
        React.createElement("span", { style: { color: "#fff", fontWeight: "bold", fontSize: "13px" } }, v.ia)
      ),
      React.createElement("div", { style: { color: "#ff4444", fontSize: "11px" } }, "Erreur de connexion")
    );
  }

  var confColor = v.confiance >= 8 ? "#22cc44" : v.confiance >= 6 ? "#ffa500" : "#ff4444";

  return React.createElement(
    "div",
    {
      style: {
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "10px",
        padding: "16px",
        flex: "1",
        minWidth: "160px",
        borderTop: "2px solid " + color,
      },
    },
    React.createElement(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" } },
      React.createElement("div", {
        style: { width: "8px", height: "8px", borderRadius: "50%", background: color },
      }),
      React.createElement("span", { style: { color: "#fff", fontWeight: "bold", fontSize: "13px" } }, v.ia)
    ),
    React.createElement(
      "div",
      { style: { marginBottom: "8px" } },
      React.createElement("div", { style: { fontSize: "10px", color: "#555", letterSpacing: "1px", marginBottom: "3px" } }, "PICK"),
      React.createElement(
        "div",
        { style: { fontSize: "13px", color: v.recommande ? "#d4af37" : "#555", fontWeight: "bold" } },
        v.pick || "—"
      )
    ),
    React.createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" } },
      React.createElement(
        "div",
        null,
        React.createElement("div", { style: { fontSize: "10px", color: "#555", marginBottom: "2px" } }, "Confiance"),
        React.createElement("div", { style: { fontSize: "20px", fontWeight: "bold", color: confColor } }, v.confiance + "/10")
      ),
      v.cote_recommandee
        ? React.createElement(
            "div",
            { style: { textAlign: "right" } },
            React.createElement("div", { style: { fontSize: "10px", color: "#555", marginBottom: "2px" } }, "Côte"),
            React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold", color: "#fff" } }, v.cote_recommandee)
          )
        : null
    ),
    v.raisonnement
      ? React.createElement(
          "div",
          { style: { fontSize: "11px", color: "#555", lineHeight: "1.6", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" } },
          v.raisonnement
        )
      : null,
    React.createElement(
      "div",
      {
        style: {
          marginTop: "10px",
          padding: "4px 8px",
          borderRadius: "4px",
          background: v.recommande ? "rgba(34,180,60,0.1)" : "rgba(100,100,100,0.1)",
          border: "1px solid " + (v.recommande ? "rgba(34,180,60,0.3)" : "rgba(100,100,100,0.2)"),
          textAlign: "center",
          fontSize: "10px",
          color: v.recommande ? "#22cc44" : "#555",
          letterSpacing: "1px",
        },
      },
      v.recommande ? "✓ RECOMMANDE" : "✗ PASS"
    )
  );
}

function VerdictBanner(props) {
  var v = props.verdict;
  if (!v) return null;
  var isPick = v.verdict === "PICK";

  return React.createElement(
    "div",
    {
      style: {
        background: isPick ? "rgba(212,175,55,0.08)" : "rgba(100,100,100,0.06)",
        border: "2px solid " + (isPick ? "rgba(212,175,55,0.5)" : "rgba(100,100,100,0.25)"),
        borderRadius: "12px",
        padding: "24px",
        textAlign: "center",
        marginBottom: "24px",
      },
    },
    React.createElement(
      "div",
      { style: { fontSize: "10px", letterSpacing: "4px", color: isPick ? "#d4af37" : "#555", marginBottom: "8px" } },
      "VERDICT DU CONSEIL"
    ),
    React.createElement(
      "div",
      { style: { fontSize: "28px", fontWeight: "bold", color: isPick ? "#fff" : "#555", marginBottom: "8px" } },
      isPick ? v.pick : "AUCUN PICK"
    ),
    isPick
      ? React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap", marginTop: "12px" } },
          React.createElement(
            "div",
            null,
            React.createElement("div", { style: { fontSize: "10px", color: "#555" } }, "Consensus"),
            React.createElement("div", { style: { fontSize: "16px", fontWeight: "bold", color: "#d4af37" } }, v.consensus)
          ),
          React.createElement(
            "div",
            null,
            React.createElement("div", { style: { fontSize: "10px", color: "#555" } }, "Confiance moy."),
            React.createElement(
              "div",
              { style: { fontSize: "16px", fontWeight: "bold", color: v.confiance_moyenne >= 8 ? "#22cc44" : "#ffa500" } },
              v.confiance_moyenne + "/10"
            )
          ),
          React.createElement(
            "div",
            null,
            React.createElement("div", { style: { fontSize: "10px", color: "#555" } }, "IAs favorables"),
            React.createElement(
              "div",
              { style: { fontSize: "16px", fontWeight: "bold", color: "#fff" } },
              v.ias_favorables + "/" + v.ias_total
            )
          )
        )
      : React.createElement(
          "div",
          { style: { color: "#555", fontSize: "13px", marginTop: "8px" } },
          "La majorité des IAs ne recommande pas de parier sur ce match."
        )
  );
}

export default function ConseilIA(props) {
  var setPage = props.setPage;
  var header = props.header;
  var footer = props.footer;
  var bandeauLegal = props.bandeauLegal;

  var matchState = React.useState("");
  var match = matchState[0];
  var setMatch = matchState[1];

  var sportState = React.useState("Foot");
  var sport = sportState[0];
  var setSport = sportState[1];

  var infosState = React.useState("");
  var infos = infosState[0];
  var setInfos = infosState[1];

  var loadingState = React.useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var resultState = React.useState(null);
  var result = resultState[0];
  var setResult = resultState[1];

  var errorState = React.useState(null);
  var error = errorState[0];
  var setError = errorState[1];

  function analyze() {
    if (!match.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    fetch(API_URL + "/api/conseil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match: match, sport: sport, infos: infos }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        setResult(data);
      })
      .catch(function (err) {
        setError(err.message);
      })
      .finally(function () {
        setLoading(false);
      });
  }

  var sports = ["Foot", "Hockey", "Basketball", "Tennis", "Baseball", "Rugby", "Autre"];

  return React.createElement(
    "div",
    {
      style: {
        background: "linear-gradient(180deg,#131826 0%,#0b1018 500px,#080c14 100%)",
        minHeight: "100vh",
        fontFamily: "Georgia,serif",
        color: "#e8e0d0",
      },
    },
    header,
    React.createElement(
      "div",
      { style: { maxWidth: "960px", margin: "0 auto", padding: "40px 30px 100px" } },
      React.createElement(
        "div",
        { style: { marginBottom: "32px" } },
        React.createElement(
          "div",
          { style: { fontSize: "10px", letterSpacing: "5px", color: "#d4af37", marginBottom: "8px" } },
          "CONSEIL DE 5 IAs"
        ),
        React.createElement(
          "h1",
          { style: { fontSize: "26px", fontWeight: "bold", color: "#fff", margin: "0 0 8px" } },
          "Analyse multi-intelligence"
        ),
        React.createElement(
          "p",
          { style: { color: "#555", fontSize: "13px", margin: 0 } },
          "Claude · GPT-4o · Gemini · Grok · Mistral — 5 IAs votent, le consensus décide."
        )
      ),
      React.createElement(
        "div",
        {
          style: {
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "28px",
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", gap: "14px", flexWrap: "wrap", marginBottom: "14px" } },
          React.createElement(
            "div",
            { style: { flex: "2", minWidth: "220px" } },
            React.createElement(
              "label",
              { style: { display: "block", fontSize: "10px", color: "#555", letterSpacing: "2px", marginBottom: "6px" } },
              "MATCH"
            ),
            React.createElement("input", {
              type: "text",
              value: match,
              onChange: function (e) {
                setMatch(e.target.value);
              },
              placeholder: "ex: Real Madrid vs Barcelona",
              style: {
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "6px",
                padding: "10px 12px",
                color: "#fff",
                fontSize: "14px",
                fontFamily: "Georgia,serif",
                boxSizing: "border-box",
                outline: "none",
              },
            })
          ),
          React.createElement(
            "div",
            { style: { flex: "1", minWidth: "130px" } },
            React.createElement(
              "label",
              { style: { display: "block", fontSize: "10px", color: "#555", letterSpacing: "2px", marginBottom: "6px" } },
              "SPORT"
            ),
            React.createElement(
              "select",
              {
                value: sport,
                onChange: function (e) {
                  setSport(e.target.value);
                },
                style: {
                  width: "100%",
                  background: "#0f1520",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  color: "#fff",
                  fontSize: "13px",
                  fontFamily: "Georgia,serif",
                  boxSizing: "border-box",
                  outline: "none",
                },
              },
              sports.map(function (s) {
                return React.createElement("option", { key: s, value: s }, s);
              })
            )
          )
        ),
        React.createElement(
          "div",
          { style: { marginBottom: "14px" } },
          React.createElement(
            "label",
            { style: { display: "block", fontSize: "10px", color: "#555", letterSpacing: "2px", marginBottom: "6px" } },
            "INFOS SUPPLEMENTAIRES (optionnel)"
          ),
          React.createElement("textarea", {
            value: infos,
            onChange: function (e) {
              setInfos(e.target.value);
            },
            placeholder: "Blessures, forme récente, stats clés, enjeu du match...",
            rows: 3,
            style: {
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "6px",
              padding: "10px 12px",
              color: "#fff",
              fontSize: "12px",
              fontFamily: "Georgia,serif",
              boxSizing: "border-box",
              resize: "vertical",
              outline: "none",
            },
          })
        ),
        React.createElement(
          "button",
          {
            onClick: analyze,
            disabled: loading || !match.trim(),
            style: {
              background: loading || !match.trim() ? "rgba(212,175,55,0.2)" : "linear-gradient(135deg,#d4af37,#f5d76e)",
              border: "none",
              borderRadius: "6px",
              padding: "12px 32px",
              color: loading || !match.trim() ? "#555" : "#080c14",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: loading || !match.trim() ? "not-allowed" : "pointer",
              fontFamily: "Georgia,serif",
              letterSpacing: "1px",
            },
          },
          loading ? "Consultation en cours..." : "Consulter le conseil"
        )
      ),
      loading
        ? React.createElement(
            "div",
            { style: { textAlign: "center", padding: "40px" } },
            React.createElement(
              "div",
              { style: { fontSize: "13px", color: "#d4af37", letterSpacing: "3px", marginBottom: "12px" } },
              "5 IAs en délibération..."
            ),
            React.createElement(
              "div",
              { style: { display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" } },
              ["Claude", "GPT-4o", "Gemini", "Grok", "Mistral"].map(function (ia) {
                return React.createElement(
                  "div",
                  { key: ia, style: { textAlign: "center" } },
                  React.createElement("div", {
                    style: { width: "8px", height: "8px", borderRadius: "50%", background: IA_COLORS[ia], margin: "0 auto 4px", animation: "pulse 1.5s infinite" },
                  }),
                  React.createElement("div", { style: { fontSize: "10px", color: "#555" } }, ia)
                );
              })
            )
          )
        : null,
      error
        ? React.createElement(
            "div",
            {
              style: {
                background: "rgba(255,60,60,0.08)",
                border: "1px solid rgba(255,60,60,0.3)",
                borderRadius: "10px",
                padding: "16px 20px",
                color: "#ff4444",
                fontSize: "13px",
              },
            },
            "Erreur : " + error
          )
        : null,
      result
        ? React.createElement(
            "div",
            null,
            React.createElement(VerdictBanner, { verdict: result.verdict }),
            React.createElement(
              "div",
              { style: { marginBottom: "14px" } },
              React.createElement(
                "div",
                { style: { fontSize: "10px", letterSpacing: "3px", color: "#555", marginBottom: "12px" } },
                "VOTES INDIVIDUELS"
              ),
              React.createElement(
                "div",
                { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
                result.votes.map(function (v, i) {
                  return React.createElement(IaCard, { key: i, vote: v });
                })
              )
            )
          )
        : null
    ),
    footer,
    bandeauLegal
  );
}
