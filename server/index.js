require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { runCouncil } = require("./council");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", ias: ["Claude", "GPT-4o", "Gemini", "Grok", "Mistral"] });
});

// POST /api/conseil
// Body: { match: "Team A vs Team B", sport: "Foot", infos: "..." }
app.post("/api/conseil", async (req, res) => {
  const { match, sport, infos } = req.body;
  if (!match) return res.status(400).json({ error: "Champ 'match' requis" });

  const matchInfo = `
Match : ${match}
Sport : ${sport || "Non spécifié"}
Informations supplémentaires : ${infos || "Aucune"}

Analyse ce match et donne ton pick avec ton niveau de confiance.
  `.trim();

  try {
    const result = await runCouncil(matchInfo);
    res.json(result);
  } catch (err) {
    console.error("Council error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Council server running on http://localhost:${PORT}`);
  console.log(`POST http://localhost:${PORT}/api/conseil`);
});
