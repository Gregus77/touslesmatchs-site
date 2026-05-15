import { useState } from "react";

const picks = [
  { date: "13/05", match: "Lazio vs Inter Milan", marche: "Inter ML", cote: 1.66, resultat: "✅", score: "0-2", sport: "⚽", ligue: "Finale Coupe d'Italie" },
  { date: "13/05", match: "Villarreal vs Séville", marche: "Over 2.5", cote: 1.75, resultat: "✅", score: "2-2", sport: "⚽", ligue: "La Liga" },
  { date: "11/05", match: "Carolina vs Philadelphia", marche: "Carolina ML", cote: 1.58, resultat: "✅", score: "4-2", sport: "🏒", ligue: "NHL Playoffs G4" },
  { date: "10/05", match: "Colorado vs Minnesota", marche: "Colorado ML", cote: 1.62, resultat: "✅", score: "5-1", sport: "🏒", ligue: "NHL Playoffs G3" },
  { date: "09/05", match: "VGK vs Anaheim", marche: "VGK ML", cote: 1.55, resultat: "✅", score: "6-2", sport: "🏒", ligue: "NHL Playoffs G3" },
  { date: "08/05", match: "Carolina vs Philadelphia", marche: "Carolina ML", cote: 1.52, resultat: "✅", score: "4-1", sport: "🏒", ligue: "NHL Playoffs G3" },
  { date: "07/05", match: "Anaheim vs VGK", marche: "Anaheim ML", cote: 1.78, resultat: "✅", score: "3-1", sport: "🏒", ligue: "NHL Playoffs G2" },
  { date: "06/05", match: "Buffalo vs Montréal", marche: "Buffalo ML", cote: 1.60, resultat: "❌", score: "1-5", sport: "🏒", ligue: "NHL Playoffs G2" },
  { date: "05/05", match: "VGK vs Anaheim", marche: "VGK ML", cote: 1.54, resultat: "✅", score: "3-1", sport: "🏒", ligue: "NHL Playoffs G1" },
  { date: "04/05", match: "Colorado vs Minnesota", marche: "Colorado ML", cote: 1.58, resultat: "✅", score: "9-6", sport: "🏒", ligue: "NHL Playoffs G1" },
  { date: "03/05", match: "Carolina vs Philadelphia", marche: "Carolina ML", cote: 1.50, resultat: "✅", score: "3-0", sport: "🏒", ligue: "NHL Playoffs G1" },
  { date: "02/05", match: "Utah vs VGK", marche: "VGK ML", cote: 1.62, resultat: "✅", score: "5-1", sport: "🏒", ligue: "NHL Playoffs G6" },
  { date: "01/05", match: "Buffalo vs Boston", marche: "Buffalo ML", cote: 1.70, resultat: "✅", score: "4-1", sport: "🏒", ligue: "NHL Playoffs G6" },
  { date: "29/04", match: "Leverkusen vs Dortmund", marche: "Over 2.5", cote: 1.62, resultat: "✅", score: "3-1", sport: "⚽", ligue: "Bundesliga" },
  { date: "28/04", match: "Bayern vs Stuttgart", marche: "Over 2.5", cote: 1.55, resultat: "❌", score: "1-0", sport: "⚽", ligue: "Bundesliga" },
];

export default function App() {
  const [filter, setFilter] = useState("ALL");
  const filtered = filter === "ALL" ? picks : picks.filter(p => p.sport === filter);
  const wins = picks.filter(p => p.resultat === "✅").length;
  const total = picks.filter(p => p.resultat !== "⏳").length;
  const winrate = Math.round((wins / total) * 100);

  return (
    <div style={{ background: "#080c14", minHeight: "100vh", fontFamily: "Georgia, serif", color: "#e8e0d0" }}>
      
      {/* HEADER */}
      <header style={{ borderBottom: "1px solid rgba(212,175,55,0.2)", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(8,12,20,0.95)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #d4af37, #f5d76e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>⚡</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 2, color: "#d4af37" }}>TOUSLESMATCHS</div>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "#666" }}>Analyse · Intelligence · Résultats</div>
          </div>
        </div>
        <button style={{ background: "linear-gradient(135deg, #d4af37, #f5d76e)", border: "none", borderRadius: 4, padding: "8px 20px", color: "#080c14", fontWeight: "bold", cursor: "pointer", fontSize: 12, letterSpacing: 1 }}>ABONNEMENT</button>
      </header>

      {/* HERO */}
      <section style={{ padding: "60px 40px 30px", textAlign: "center" }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#d4af37", marginBottom: 16 }}>PROPULSÉ PAR INTELLIGENCE ARTIFICIELLE</div>
        <h1 style={{ fontSize: 48, fontWeight: "bold", margin: "0 0 20px", background: "linear-gradient(135deg, #fff 30%, #d4af37 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Le meilleur pick<br />chaque jour.
        </h1>
        <p style={{ color: "#555", fontSize: 15, maxWidth: 460, margin: "0 auto 40px" }}>
          Notre IA analyse des centaines de matchs pour livrer uniquement les paris à haute valeur. Pas de bullshit. Juste des résultats.
        </p>

        {/* STATS */}
        <div style={{ display: "flex", justifyContent: "center", maxWidth: 720, margin: "0 auto", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, overflow: "hidden" }}>
          {[
            { label: "WIN RATE", value: `${winrate}%`, sub: `sur ${total} paris` },
            { label: "BANKROLL", value: "+55%", sub: "en 2 semaines" },
            { label: "PROFIT NET", value: "+23€", sub: "depuis le début" },
            { label: "SÉRIE EN COURS", value: "9W", sub: "consécutives 🔥" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: "24px 16px", borderRight: i < 3 ? "1px solid rgba(212,175,55,0.15)" : "none", background: i % 2 === 0 ? "rgba(212,175,55,0.03)" : "transparent" }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: "bold", color: "#d4af37" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PICKS TABLE */}
      <section style={{ padding: "30px 40px 60px", maxWidth: 920, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, color: "#d4af37", letterSpacing: 3, margin: 0 }}>HISTORIQUE DES PICKS</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {["ALL", "⚽", "🏒"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? "rgba(212,175,55,0.15)" : "transparent", border: `1px solid ${filter === f ? "#d4af37" : "rgba(255,255,255,0.1)"}`, color: filter === f ? "#d4af37" : "#555", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
                {f === "ALL" ? "Tous" : f}
              </button>
            ))}
          </div>
        </div>

        {/* TABLE HEADER */}
        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 150px 60px 80px 50px", padding: "8px 16px", fontSize: 10, letterSpacing: 2, color: "#333", textTransform: "uppercase" }}>
          <span>Date</span><span>Match</span><span>Marché</span><span>Cote</span><span>Score</span><span style={{ textAlign: "center" }}>Résultat</span>
        </div>

        {/* ROWS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr 150px 60px 80px 50px", padding: "14px 16px", background: p.resultat === "✅" ? "rgba(212,175,55,0.04)" : p.resultat === "❌" ? "rgba(255,60,60,0.04)" : "rgba(100,100,255,0.04)", border: `1px solid ${p.resultat === "✅" ? "rgba(212,175,55,0.12)" : p.resultat === "❌" ? "rgba(255,60,60,0.12)" : "rgba(100,100,255,0.12)"}`, borderRadius: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#555" }}>{p.date}</span>
              <div>
                <div style={{ fontSize: 14, color: "#ddd" }}>{p.sport} {p.match}</div>
                <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>{p.ligue}</div>
              </div>
              <div style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 3, padding: "3px 8px", fontSize: 11, color: "#d4af37", width: "fit-content" }}>{p.marche}</div>
              <span style={{ fontSize: 15, fontWeight: "bold", color: "#fff" }}>{p.cote}</span>
              <span style={{ fontSize: 13, color: "#666" }}>{p.score}</span>
              <div style={{ textAlign: "center", fontSize: 18 }}>{p.resultat}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 50, background: "linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.02))", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 12, padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#d4af37", marginBottom: 12 }}>ACCÈS PREMIUM</div>
          <h3 style={{ fontSize: 26, margin: "0 0 12px", color: "#fff" }}>1 pick par jour.<br />Analysé par IA.</h3>
          <p style={{ color: "#555", fontSize: 14, marginBottom: 30 }}>Note /10, mise recommandée, analyse complète.</p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
            <div style={{ border: "1px solid rgba(212,175,55,0.3)", borderRadius: 8, padding: "24px 32px", minWidth: 140 }}>
              <div style={{ fontSize: 28, fontWeight: "bold", color: "#d4af37" }}>9€</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>/mois — Starter</div>
            </div>
            <div style={{ background: "linear-gradient(135deg, #d4af37, #f5d76e)", borderRadius: 8, padding: "24px 32px", minWidth: 140 }}>
              <div style={{ fontSize: 28, fontWeight: "bold", color: "#080c14" }}>19€</div>
              <div style={{ fontSize: 12, color: "rgba(8,12,20,0.6)", marginTop: 4 }}>/mois — Premium ⭐</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}