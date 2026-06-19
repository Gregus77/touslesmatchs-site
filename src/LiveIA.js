import React from "react";

var AGENT_COLORS = {
  "GROQ-Llama": "#F59E0B",
  "GPT Analysis": "#10B981",
  "GeminiFlash": "#60A5FA",
  "Mistral-7B": "#A78BFA",
  "Claude Chief": "#C9A227",
};

function getStatusLabel(status) {
  if (status === "premium") return { label: "Premium", color: "#C9A227", tokens: 10 };
  if (status === "vip") return { label: "VIP", color: "#60A5FA", tokens: 30 };
  if (status === "elite") return { label: "Elite", color: "#A78BFA", tokens: 999 };
  return { label: "Gratuit", color: "#888", tokens: 0 };
}

function MatchCard({ match, onReveal, revealed, loading, tokens }) {
  var isLoading = loading === match.id;
  var isRevealed = !!revealed[match.id];
  var analysis = revealed[match.id];
  var canReveal = tokens > 0;

  var minuteDisplay = match.minute && match.minute !== "?" ? match.minute + "'" : "Live";

  return React.createElement("div", {
    style: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(201,162,39,0.15)",
      borderRadius: "16px",
      overflow: "hidden",
      marginBottom: "16px",
      transition: "border-color 0.3s",
    }
  },
    // Match header
    React.createElement("div", {
      style: {
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
      }
    },
      // Left: teams + score
      React.createElement("div", { style: { flex: 1, minWidth: "200px" } },
        React.createElement("div", {
          style: { fontSize: "11px", letterSpacing: "3px", color: "#C9A227", marginBottom: "6px", fontWeight: "600" }
        }, "⚽ " + (match.competition || "INTERNATIONAL").toUpperCase()),
        React.createElement("div", {
          style: { fontSize: "20px", fontWeight: "700", color: "#F5F0E8", fontFamily: "'Bodoni Moda',serif" }
        }, match.home + " vs " + match.away),
        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" } },
          React.createElement("span", {
            style: {
              background: "rgba(34,197,94,0.15)",
              border: "1px solid rgba(34,197,94,0.3)",
              color: "#22C55E",
              fontSize: "11px",
              fontWeight: "700",
              padding: "3px 10px",
              borderRadius: "20px",
              letterSpacing: "1px",
            }
          }, "🔴 LIVE · " + minuteDisplay),
          React.createElement("span", {
            style: { fontSize: "24px", fontWeight: "700", color: "#F5F0E8", fontFamily: "monospace" }
          }, match.score_home + " – " + match.score_away)
        )
      ),

      // Right: reveal button
      !isRevealed && React.createElement("button", {
        onClick: function() { onReveal(match); },
        disabled: isLoading || !canReveal,
        style: {
          padding: "12px 20px",
          background: isLoading
            ? "#1a1a1a"
            : canReveal
            ? "linear-gradient(135deg,#C9A227,#E8C14A)"
            : "rgba(255,255,255,0.05)",
          border: canReveal ? "none" : "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          color: isLoading ? "#555" : canReveal ? "#080706" : "#555",
          fontSize: "14px",
          fontWeight: "700",
          cursor: isLoading ? "wait" : canReveal ? "pointer" : "not-allowed",
          fontFamily: "'Jost',sans-serif",
          whiteSpace: "nowrap",
          letterSpacing: "0.03em",
        }
      },
        isLoading
          ? "🔮 Analyse..."
          : canReveal
          ? "🔮 Révéler le Concile (1 jeton)"
          : "🔒 Jetons épuisés"
      ),

      isRevealed && React.createElement("div", {
        style: { color: "#22C55E", fontSize: "12px", fontWeight: "600", letterSpacing: "1px" }
      }, "✓ ANALYSÉ")
    ),

    // Analysis panel (revealed)
    isRevealed && analysis && React.createElement("div", {
      style: {
        borderTop: "1px solid rgba(201,162,39,0.15)",
        padding: "20px",
        background: "rgba(201,162,39,0.03)",
      }
    },
      // Best bet banner
      React.createElement("div", {
        style: {
          background: "linear-gradient(135deg,rgba(201,162,39,0.15),rgba(201,162,39,0.05))",
          border: "1px solid rgba(201,162,39,0.4)",
          borderRadius: "12px",
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }
      },
        React.createElement("div", null,
          React.createElement("div", {
            style: { fontSize: "11px", letterSpacing: "3px", color: "#C9A227", marginBottom: "4px", fontWeight: "600" }
          }, "🏆 VERDICT DU CONCILE"),
          React.createElement("div", {
            style: { fontSize: "22px", fontWeight: "700", color: "#F5F0E8", fontFamily: "'Bodoni Moda',serif" }
          }, analysis.best_bet),
          React.createElement("div", {
            style: { fontSize: "13px", color: "#aaa", marginTop: "6px", lineHeight: "1.6", maxWidth: "500px" }
          }, analysis.raison)
        ),
        React.createElement("div", {
          style: {
            textAlign: "center",
            background: "rgba(201,162,39,0.1)",
            border: "2px solid #C9A227",
            borderRadius: "12px",
            padding: "12px 20px",
            minWidth: "80px",
          }
        },
          React.createElement("div", { style: { fontSize: "32px", fontWeight: "700", color: "#C9A227" } },
            analysis.confidence + "%"
          ),
          React.createElement("div", { style: { fontSize: "10px", color: "#888", letterSpacing: "2px" } }, "CONFIANCE")
        )
      ),

      // Consensus bar
      React.createElement("div", {
        style: { marginBottom: "20px" }
      },
        React.createElement("div", {
          style: { fontSize: "11px", letterSpacing: "2px", color: "#6b6356", marginBottom: "8px", fontWeight: "600" }
        }, "CONSENSUS DU CONCILE — " + analysis.consensus_votes + "/" + analysis.total_agents + " agents d'accord"),
        React.createElement("div", {
          style: { background: "rgba(255,255,255,0.06)", borderRadius: "6px", height: "8px", overflow: "hidden" }
        },
          React.createElement("div", {
            style: {
              width: ((analysis.consensus_votes / analysis.total_agents) * 100) + "%",
              height: "100%",
              background: "linear-gradient(90deg,#C9A227,#E8C14A)",
              borderRadius: "6px",
              transition: "width 1s ease",
            }
          })
        )
      ),

      // Agent votes grid
      React.createElement("div", {
        style: { fontSize: "11px", letterSpacing: "2px", color: "#6b6356", marginBottom: "12px", fontWeight: "600" }
      }, "VOTES DES AGENTS"),
      React.createElement("div", {
        style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "10px" }
      },
        (analysis.agents || []).map(function(agent, i) {
          var isChief = agent.isChief;
          var agentColor = AGENT_COLORS[agent.name] || "#888";
          return React.createElement("div", {
            key: i,
            style: {
              background: isChief ? "rgba(201,162,39,0.08)" : "rgba(255,255,255,0.03)",
              border: isChief ? "1px solid rgba(201,162,39,0.35)" : "1px solid rgba(255,255,255,0.07)",
              borderRadius: "10px",
              padding: "14px",
            }
          },
            React.createElement("div", {
              style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }
            },
              React.createElement("div", {
                style: { display: "flex", alignItems: "center", gap: "8px" }
              },
                React.createElement("span", { style: { fontSize: "18px" } }, agent.icon || "🤖"),
                React.createElement("span", {
                  style: { fontSize: "12px", fontWeight: "700", color: agentColor, letterSpacing: "0.5px" }
                }, agent.name)
              ),
              isChief && React.createElement("span", {
                style: {
                  background: "#C9A227",
                  color: "#080706",
                  fontSize: "9px",
                  fontWeight: "700",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  letterSpacing: "1px",
                }
              }, "CHEF")
            ),
            React.createElement("div", {
              style: { fontSize: "14px", fontWeight: "600", color: "#F5F0E8", marginBottom: "6px" }
            }, agent.bet),
            React.createElement("div", {
              style: { background: "rgba(255,255,255,0.05)", borderRadius: "4px", height: "4px", overflow: "hidden", marginBottom: "8px" }
            },
              React.createElement("div", {
                style: { width: agent.confidence + "%", height: "100%", background: agentColor, borderRadius: "4px" }
              })
            ),
            React.createElement("div", {
              style: { fontSize: "12px", color: "#6b6356", lineHeight: "1.55" }
            }, agent.raison)
          );
        })
      )
    )
  );
}

export default function LiveIA() {
  var [matches, setMatches] = React.useState([]);
  var [loading, setLoading] = React.useState(null); // match.id being analysed
  var [revealed, setRevealed] = React.useState({});
  var [tokens, setTokens] = React.useState(null);
  var [tokenLimit, setTokenLimit] = React.useState(0);
  var [userStatus, setUserStatus] = React.useState(null);
  var [error, setError] = React.useState("");
  var [matchesLoading, setMatchesLoading] = React.useState(true);
  var [showSuccess, setShowSuccess] = React.useState(false);

  var userId = localStorage.getItem("user_id");
  var authToken = localStorage.getItem("auth_token");
  var isLoggedIn = !!authToken && !!userId;

  // Detect Stripe success redirect
  React.useEffect(function() {
    if (window.location.search.includes("success=1")) {
      setShowSuccess(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Load tokens and user info
  React.useEffect(function() {
    if (!isLoggedIn) return;
    fetch("/api/user/tokens", {
      headers: { Authorization: "Bearer " + authToken }
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) {
          setTokens(d.tokens);
          setTokenLimit(d.limit);
          setUserStatus(d.status);
        }
      })
      .catch(function() {});
  }, [isLoggedIn, authToken]);

  // Load live matches (refresh every 45s)
  React.useEffect(function() {
    function load() {
      setMatchesLoading(true);
      fetch("/api/live-matches")
        .then(function(r) { return r.json(); })
        .then(function(d) {
          setMatchesLoading(false);
          if (d.ok) setMatches(d.matches || []);
        })
        .catch(function() { setMatchesLoading(false); });
    }
    load();
    var interval = setInterval(load, 45000);
    return function() { clearInterval(interval); };
  }, []);

  function revealAnalysis(match) {
    if (!isLoggedIn) return;
    if (tokens <= 0) return;

    setLoading(match.id);
    setError("");

    fetch("/api/live-ia/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
      body: JSON.stringify({
        match_id: match.id,
        home: match.home,
        away: match.away,
        score_home: match.score_home,
        score_away: match.score_away,
        minute: match.minute,
        competition: match.competition,
      }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setLoading(null);
        if (d.ok) {
          setRevealed(function(prev) {
            var next = Object.assign({}, prev);
            next[match.id] = d;
            return next;
          });
          if (!d.cached) {
            setTokens(function(t) { return Math.max(0, t - 1); });
          }
          if (d.tokens_remaining !== undefined) setTokens(d.tokens_remaining);
        } else {
          setError(d.error || "Erreur d'analyse");
        }
      })
      .catch(function() {
        setLoading(null);
        setError("Serveur indisponible, réessaie dans un instant.");
      });
  }

  var statusInfo = getStatusLabel(userStatus);

  // Not logged in
  if (!isLoggedIn) {
    return React.createElement("div", {
      style: { minHeight: "100vh", background: "#080706", color: "#F5F0E8", fontFamily: "'Jost',sans-serif", padding: "24px 16px", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }
    },
      React.createElement("div", { style: { fontSize: "64px", marginBottom: "20px" } }, "🔒"),
      React.createElement("h1", {
        style: { fontFamily: "'Bodoni Moda',serif", fontSize: "clamp(28px,6vw,42px)", color: "#F5F0E8", margin: "0 0 12px" }
      }, "Live ", React.createElement("em", { style: { color: "#C9A227", fontStyle: "italic" } }, "IA")),
      React.createElement("p", { style: { color: "#6b6356", fontSize: "16px", lineHeight: "1.7", marginBottom: "28px" } },
        "Connecte-toi pour accéder aux analyses en temps réel du Concile."
      ),
      React.createElement("button", {
        onClick: function() { window.location.href = "/login"; },
        style: { padding: "16px 32px", background: "linear-gradient(135deg,#C9A227,#E8C14A)", border: "none", borderRadius: "10px", color: "#080706", fontSize: "16px", fontWeight: "700", cursor: "pointer", fontFamily: "'Jost',sans-serif" }
      }, "Se connecter / S'inscrire")
    );
  }

  // No subscription
  if (userStatus === "free" || userStatus === null) {
    return React.createElement("div", {
      style: { minHeight: "100vh", background: "#080706", color: "#F5F0E8", fontFamily: "'Jost',sans-serif", padding: "24px 16px", maxWidth: "700px", margin: "0 auto" }
    },
      // Header
      React.createElement("div", { style: { textAlign: "center", marginBottom: "40px", paddingTop: "40px" } },
        React.createElement("div", { style: { fontSize: "11px", letterSpacing: "4px", color: "#C9A227", marginBottom: "8px", fontWeight: "600" } }, "LE CONCILE · ANALYSES EN DIRECT"),
        React.createElement("h1", { style: { fontFamily: "'Bodoni Moda',serif", fontSize: "clamp(32px,7vw,52px)", color: "#F5F0E8", margin: "0 0 14px" } },
          "Live ", React.createElement("em", { style: { color: "#C9A227", fontStyle: "italic" } }, "IA")
        ),
        React.createElement("p", { style: { color: "#6b6356", fontSize: "15px", lineHeight: "1.75", maxWidth: "500px", margin: "0 auto" } },
          "5 intelligences artificielles analysent chaque match en direct. Révéle le verdict du Concile sur le pari le plus rentable."
        )
      ),

      // Plans
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" } },
        React.createElement("div", {
          style: { background: "rgba(201,162,39,0.07)", border: "2px solid rgba(201,162,39,0.4)", borderRadius: "16px", padding: "24px", position: "relative" }
        },
          React.createElement("div", {
            style: { position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "#C9A227", color: "#080706", padding: "3px 12px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", letterSpacing: "1px", whiteSpace: "nowrap" }
          }, "⭐ RECOMMANDÉ"),
          React.createElement("div", { style: { fontSize: "18px", fontWeight: "700", color: "#C9A227", marginBottom: "6px" } }, "Premium"),
          React.createElement("div", { style: { fontSize: "36px", fontWeight: "700", color: "#F5F0E8", marginBottom: "4px" } }, "9,90€"),
          React.createElement("div", { style: { fontSize: "13px", color: "#6b6356", marginBottom: "16px" } }, "/mois"),
          React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: "0 0 20px", fontSize: "13px", color: "#ccc" } },
            ["✓ 10 jetons/jour", "✓ Analyses du Concile", "✓ Remise à zéro à minuit", "✓ Tous les matchs live"].map(function(f, i) {
              return React.createElement("li", { key: i, style: { marginBottom: "7px" } }, f);
            })
          ),
          React.createElement("button", {
            onClick: function() { window.location.href = "/subscription"; },
            style: { width: "100%", padding: "13px", background: "linear-gradient(135deg,#C9A227,#E8C14A)", border: "none", borderRadius: "8px", color: "#080706", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Jost',sans-serif" }
          }, "Commencer")
        ),
        React.createElement("div", {
          style: { background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: "16px", padding: "24px" }
        },
          React.createElement("div", { style: { fontSize: "18px", fontWeight: "700", color: "#60A5FA", marginBottom: "6px" } }, "VIP"),
          React.createElement("div", { style: { fontSize: "36px", fontWeight: "700", color: "#F5F0E8", marginBottom: "4px" } }, "19,90€"),
          React.createElement("div", { style: { fontSize: "13px", color: "#6b6356", marginBottom: "16px" } }, "/mois"),
          React.createElement("ul", { style: { listStyle: "none", padding: 0, margin: "0 0 20px", fontSize: "13px", color: "#ccc" } },
            ["✓ 30 jetons/jour", "✓ Analyses prioritaires", "✓ Remise à zéro à minuit", "✓ Support 24/7"].map(function(f, i) {
              return React.createElement("li", { key: i, style: { marginBottom: "7px" } }, f);
            })
          ),
          React.createElement("button", {
            onClick: function() { window.location.href = "/subscription"; },
            style: { width: "100%", padding: "13px", background: "rgba(96,165,250,0.1)", border: "1px solid #60A5FA", borderRadius: "8px", color: "#60A5FA", fontSize: "14px", fontWeight: "700", cursor: "pointer", fontFamily: "'Jost',sans-serif" }
          }, "Choisir VIP")
        )
      ),

      // Preview of what you get
      React.createElement("div", { style: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px" } },
        React.createElement("div", { style: { fontSize: "11px", letterSpacing: "3px", color: "#C9A227", marginBottom: "14px", fontWeight: "600" } }, "🔮 APERÇU — LE CONCILE EN ACTION"),
        ["🦙 GROQ-Llama", "🤖 GPT Analysis", "💎 GeminiFlash", "🌊 Mistral-7B", "👑 Claude Chief"].map(function(agent, i) {
          return React.createElement("div", {
            key: i,
            style: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.04)" : "none" }
          },
            React.createElement("span", { style: { fontSize: "16px" } }, agent.split(" ")[0]),
            React.createElement("span", { style: { fontSize: "13px", color: "#888", flex: 1 } }, agent.split(" ").slice(1).join(" ")),
            React.createElement("div", { style: { background: "rgba(255,255,255,0.08)", height: "8px", borderRadius: "4px", width: "80px" } },
              React.createElement("div", { style: { background: "#C9A227", height: "100%", width: (60 + i * 7) + "%", borderRadius: "4px", opacity: 0.4 } })
            ),
            React.createElement("div", { style: { width: "40px", height: "28px", background: "rgba(255,255,255,0.06)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center" } },
              React.createElement("div", { style: { width: "20px", height: "8px", background: "rgba(255,255,255,0.15)", borderRadius: "3px" } })
            )
          );
        })
      )
    );
  }

  // Subscribed user view
  return React.createElement("div", {
    style: { minHeight: "100vh", background: "#080706", color: "#F5F0E8", fontFamily: "'Jost',sans-serif", padding: "24px 16px", maxWidth: "900px", margin: "0 auto" }
  },

    // Success banner
    showSuccess && React.createElement("div", {
      style: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: "12px", padding: "14px 20px", marginBottom: "20px", color: "#22C55E", textAlign: "center", fontWeight: "600" }
    }, "🎉 Abonnement activé ! Bienvenue dans le Concile."),

    // Header
    React.createElement("div", { style: { marginBottom: "28px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" } },
        React.createElement("div", null,
          React.createElement("div", { style: { fontSize: "11px", letterSpacing: "4px", color: "#C9A227", marginBottom: "6px", fontWeight: "600" } }, "LE CONCILE · TEMPS RÉEL"),
          React.createElement("h1", { style: { fontFamily: "'Bodoni Moda',serif", fontSize: "clamp(28px,5vw,42px)", color: "#F5F0E8", margin: 0 } },
            "Live ", React.createElement("em", { style: { color: "#C9A227", fontStyle: "italic" } }, "IA")
          )
        ),

        // Token counter
        React.createElement("div", {
          style: { background: "rgba(201,162,39,0.08)", border: "1px solid rgba(201,162,39,0.3)", borderRadius: "14px", padding: "14px 20px", textAlign: "center", minWidth: "130px" }
        },
          React.createElement("div", { style: { fontSize: "11px", letterSpacing: "2px", color: "#C9A227", marginBottom: "4px", fontWeight: "600" } }, "JETONS"),
          React.createElement("div", { style: { fontSize: "28px", fontWeight: "700", color: tokens <= 3 && tokens !== null ? "#EF4444" : "#F5F0E8" } },
            tokens !== null ? tokens : "—"
          ),
          React.createElement("div", { style: { fontSize: "10px", color: "#6b6356" } }, "/ " + tokenLimit + " par jour"),
          React.createElement("div", {
            style: { background: "rgba(255,255,255,0.06)", borderRadius: "4px", height: "4px", overflow: "hidden", marginTop: "8px" }
          },
            React.createElement("div", {
              style: { width: tokenLimit > 0 && tokens !== null ? ((tokens / tokenLimit) * 100) + "%" : "0%", height: "100%", background: tokens <= 3 && tokens !== null ? "#EF4444" : "#C9A227", borderRadius: "4px", transition: "width 0.5s ease" }
            })
          ),
          React.createElement("div", {
            style: { fontSize: "10px", color: "#6b6356", marginTop: "6px" }
          }, "Remise à zéro à minuit"),
          React.createElement("div", {
            style: { display: "inline-block", background: "rgba(" + (statusInfo.color === "#C9A227" ? "201,162,39" : statusInfo.color === "#60A5FA" ? "96,165,250" : "167,139,250") + ",0.15)", color: statusInfo.color, fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "8px", marginTop: "6px", letterSpacing: "1px" }
          }, statusInfo.label.toUpperCase())
        )
      )
    ),

    error && React.createElement("div", {
      style: { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "16px", color: "#EF4444", fontSize: "14px" }
    }, "⚠️ " + error),

    // Matches
    matchesLoading && matches.length === 0
      ? React.createElement("div", { style: { textAlign: "center", padding: "60px 20px", color: "#6b6356" } },
          React.createElement("div", { style: { fontSize: "48px", marginBottom: "16px" } }, "⚡"),
          React.createElement("div", { style: { fontSize: "16px" } }, "Chargement des matchs en direct...")
        )
      : matches.length === 0
      ? React.createElement("div", {
          style: { textAlign: "center", padding: "60px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px" }
        },
          React.createElement("div", { style: { fontSize: "48px", marginBottom: "16px" } }, "🌙"),
          React.createElement("div", { style: { fontSize: "20px", fontFamily: "'Bodoni Moda',serif", color: "#F5F0E8", marginBottom: "8px" } }, "Aucun match en direct"),
          React.createElement("div", { style: { fontSize: "14px", color: "#6b6356" } }, "Les matchs apparaissent automatiquement dès qu'ils commencent.")
        )
      : React.createElement("div", null,
          React.createElement("div", { style: { fontSize: "11px", letterSpacing: "3px", color: "#6b6356", marginBottom: "14px", fontWeight: "600" } },
            "⚡ " + matches.length + " MATCH" + (matches.length > 1 ? "S" : "") + " EN DIRECT · Mise à jour toutes les 45s"
          ),
          matches.map(function(match) {
            return React.createElement(MatchCard, {
              key: match.id,
              match: match,
              onReveal: revealAnalysis,
              revealed: revealed,
              loading: loading,
              tokens: tokens !== null ? tokens : 0,
            });
          })
        ),

    // Footer note
    React.createElement("div", {
      style: { textAlign: "center", fontSize: "12px", color: "#2a2a2a", padding: "32px 12px 20px", borderTop: "1px solid rgba(255,255,255,0.04)", marginTop: "32px" }
    }, "⚠️ Analyses IA — probabilités indicatives basées sur les données en temps réel. Jouez de manière responsable.")
  );
}
