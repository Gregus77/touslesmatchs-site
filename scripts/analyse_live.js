// ═══════════════════════════════════════════════════════════
//  HERMÈS — ANALYSE LIVE V2.0
//  API Express sur le VPS — port 3001
//  Multi-IA: Groq → DeepSeek → réponse gracieuse si tout échoue
// ═══════════════════════════════════════════════════════════

const https  = require("https");
const http   = require("http");
const { handleLogin, handleRegister, handleStripeCheckout } = require("./api_auth");

const GROQ_KEY      = process.env.GROQ_API_KEY || "";
const DEEPSEEK_KEY  = process.env.DEEPSEEK_API_KEY || "";
const FOOTBALL_KEY  = process.env.FOOTBALL_DATA_KEY || "";
const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY || "";
const STRIPE_KEY    = process.env.STRIPE_SECRET_KEY || "";
const PORT          = 3001;

// ── CORS headers ──────────────────────────────────────────
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");
}

// ── Requête HTTPS générique ───────────────────────────────
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); }
        catch(e) { reject(new Error("JSON parse error: " + d.slice(0, 200))); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("Timeout")); });
    if (body) req.write(body);
    req.end();
  });
}

// ── Matchs live via football-data.org ───────────────────
async function getLiveMatchesFootballData() {
  if (!FOOTBALL_KEY) return [];
  try {
    const data = await httpsRequest({
      hostname: "api.football-data.org",
      path: "/v4/matches?status=IN_PLAY,PAUSED",
      headers: { "X-Auth-Token": FOOTBALL_KEY }
    });
    return (data.matches || []).map(m => ({
      id: m.id,
      home: m.homeTeam?.name || "?",
      away: m.awayTeam?.name || "?",
      competition: m.competition?.name || "?",
      minute: m.minute || null,
      score_home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0,
      score_away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0,
      status: m.status || "IN_PLAY",
      live: true
    }));
  } catch(e) {
    console.error("football-data.org error:", e.message);
    return [];
  }
}

// ── Matchs du jour via RapidAPI ──────────────────────────
async function getTodayMatchesRapidAPI() {
  if (!RAPIDAPI_KEY) return [];
  try {
    const today = new Date().toISOString().slice(0, 10);
    const data = await httpsRequest({
      hostname: "free-api-live-football-data.p.rapidapi.com",
      path: `/football-get-matches-by-date?date=${today}`,
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": "free-api-live-football-data.p.rapidapi.com"
      }
    });
    const list = data?.response?.matches || data?.matches || [];
    return list.map(m => {
      const homeScore = m.score?.home ?? m.homeScore ?? null;
      const awayScore = m.score?.away ?? m.awayScore ?? null;
      const statusRaw = (m.status || "").toLowerCase();
      const isLive = statusRaw.includes("play") || statusRaw.includes("live") || statusRaw === "1h" || statusRaw === "2h" || statusRaw === "ht";
      return {
        id: m.id || m.matchId,
        home: m.homeTeam?.name || m.home_team?.name || m.homeTeam || "?",
        away: m.awayTeam?.name || m.away_team?.name || m.awayTeam || "?",
        competition: m.league?.name || m.competition?.name || m.leagueName || "?",
        minute: m.minute || m.elapsed || null,
        score_home: homeScore ?? 0,
        score_away: awayScore ?? 0,
        status: isLive ? "IN_PLAY" : (m.status || "SCHEDULED"),
        time_str: m.time || m.matchTime || null,
        live: isLive
      };
    }).filter(m => m.home !== "?" && m.away !== "?");
  } catch(e) {
    console.error("RapidAPI error:", e.message);
    return [];
  }
}

// ── Fusionner et déduplication matchs ───────────────────
async function getLiveMatches() {
  const [rapid, football] = await Promise.all([
    getTodayMatchesRapidAPI().catch(() => []),
    getLiveMatchesFootballData().catch(() => [])
  ]);

  // Priorité aux matchs football-data.org pour les live (plus précis)
  const seen = new Set();
  const combined = [];
  for (const m of [...football, ...rapid]) {
    const key = (m.home + "|" + m.away).toLowerCase().replace(/\s/g, "");
    if (!seen.has(key)) { seen.add(key); combined.push(m); }
  }

  // Trier: live d'abord, puis à venir
  return combined.sort((a, b) => {
    const aLive = a.live || a.status === "IN_PLAY" ? 1 : 0;
    const bLive = b.live || b.status === "IN_PLAY" ? 1 : 0;
    return bLive - aLive;
  });
}

// ── Analyse IA via Groq ───────────────────────────────────
async function analyseViaGroq(prompt) {
  if (!GROQ_KEY) throw new Error("GROQ_KEY absent");
  const body = JSON.stringify({
    model: "llama-3.3-70b-versatile",
    max_tokens: 700,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }]
  });
  const r = await httpsRequest({
    hostname: "api.groq.com",
    path: "/openai/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    }
  }, body);
  const text = r.choices?.[0]?.message?.content || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Groq response");
  return JSON.parse(match[0]);
}

// ── Analyse IA via DeepSeek ───────────────────────────────
async function analyseViaDeepSeek(prompt) {
  if (!DEEPSEEK_KEY) throw new Error("DEEPSEEK_KEY absent");
  const body = JSON.stringify({
    model: "deepseek-chat",
    max_tokens: 700,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }]
  });
  const r = await httpsRequest({
    hostname: "api.deepseek.com",
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      "Authorization": `Bearer ${DEEPSEEK_KEY}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    }
  }, body);
  const text = r.choices?.[0]?.message?.content || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in DeepSeek response");
  return JSON.parse(match[0]);
}

// ── Analyse principale avec fallback ─────────────────────
async function analyseMatch(home, away, competition, scoreHome, scoreAway, minute) {
  const prompt = `Tu es un expert en paris sportifs. Analyse ce match et donne des probabilités précises.

Match : ${home} vs ${away}
Compétition : ${competition || "Inconnue"}
Score actuel : ${scoreHome}-${scoreAway}
Minute : ${minute || "?"}

Retourne UNIQUEMENT ce JSON (rien d'autre) :
{
  "over25": {"prob": 58, "tendance": "Courte explication"},
  "btts": {"prob": 52, "tendance": "Courte explication"},
  "resultat": {
    "domicile": 45,
    "nul": 28,
    "exterieur": 27,
    "explication": "Courte explication"
  },
  "premier_but_mi_temps": {
    "premiere": 38,
    "deuxieme": 62,
    "explication": "Courte explication"
  },
  "value_bet": {
    "marche": "Over 2.5",
    "prob": 58,
    "cote_min_conseillée": 1.72,
    "raison": "Courte raison"
  },
  "resume": "2-3 phrases d'analyse du match et des probabilités"
}`;

  // Essai 1 : Groq
  try {
    console.log("  → Groq...");
    const r = await analyseViaGroq(prompt);
    console.log("  ✓ Groq OK");
    return r;
  } catch(e) {
    console.error("  ✗ Groq:", e.message);
  }

  // Essai 2 : DeepSeek
  try {
    console.log("  → DeepSeek...");
    const r = await analyseViaDeepSeek(prompt);
    console.log("  ✓ DeepSeek OK");
    return r;
  } catch(e) {
    console.error("  ✗ DeepSeek:", e.message);
  }

  // Fallback : analyse statistique basique (sans IA, toujours disponible)
  console.log("  → Fallback statistique");
  return generateFallbackAnalysis(home, away, scoreHome, scoreAway, minute);
}

// ── Fallback sans IA ─────────────────────────────────────
function generateFallbackAnalysis(home, away, scoreH, scoreA, minute) {
  const min = parseInt(minute) || 0;
  const totalGoals = (scoreH || 0) + (scoreA || 0);
  const goalsPerMin = min > 0 ? totalGoals / min : 0;
  const projectedGoals = totalGoals + goalsPerMin * (90 - min);
  const over25Prob = Math.min(85, Math.max(20, Math.round(projectedGoals >= 2.5 ? 65 : 35)));
  const homeProb = scoreH > scoreA ? 55 : scoreH < scoreA ? 25 : 40;
  const awayProb = scoreA > scoreH ? 55 : scoreA < scoreH ? 25 : 30;
  const drawProb = 100 - homeProb - awayProb;

  return {
    over25: { prob: over25Prob, tendance: totalGoals > 0 ? `${totalGoals} buts marqués, rythme en cours.` : "Match peu prolifique pour l'instant." },
    btts: { prob: Math.min(75, Math.max(20, scoreH > 0 && scoreA > 0 ? 65 : 38)), tendance: "Analyse basée sur le score actuel." },
    resultat: {
      domicile: homeProb,
      nul: drawProb,
      exterieur: awayProb,
      explication: scoreH > scoreA ? `${home} mène et contrôle.` : scoreH < scoreA ? `${away} mène.` : "Match équilibré."
    },
    premier_but_mi_temps: {
      premiere: min < 45 ? 55 : 30,
      deuxieme: min < 45 ? 45 : 70,
      explication: min < 45 ? "Match en 1ère mi-temps." : "La 2ème mi-temps est souvent plus prolifique."
    },
    value_bet: null,
    resume: `Analyse statistique de ${home} vs ${away}. Score actuel : ${scoreH}-${scoreA} à la ${min || "?"}e minute. L'analyse IA complète sera disponible dès que le service est restauré.`
  };
}

// ── Serveur HTTP ──────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /live-matches
  if (req.method === "GET" && url.pathname === "/live-matches") {
    try {
      const matches = await getLiveMatches();
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, matches, count: matches.length }));
    } catch(e) {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, matches: [], error: e.message }));
    }
    return;
  }

  // POST /analyse
  if (req.method === "POST" && url.pathname === "/analyse") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const { home, away, competition, score_home, score_away, minute } = JSON.parse(body);
        if (!home || !away) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: "home et away requis" }));
          return;
        }
        console.log(`🔮 Analyse: ${home} vs ${away}`);
        const analyse = await analyseMatch(home, away, competition, score_home || 0, score_away || 0, minute);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, home, away, ...analyse }));
      } catch(e) {
        console.error("Erreur /analyse:", e.message);
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // POST /create-checkout — Stripe Checkout Session
  if (req.method === "POST" && url.pathname === "/create-checkout") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const { plan } = JSON.parse(body);
        if (!STRIPE_KEY) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: "Stripe non configuré" }));
          return;
        }
        const priceId = plan === "premium"
          ? (process.env.STRIPE_PRICE_ID_PREMIUM || "")
          : (process.env.STRIPE_PRICE_ID_VIP || "");
        if (!priceId) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: "Price ID manquant pour ce plan" }));
          return;
        }
        const stripeBody = new URLSearchParams({
          "payment_method_types[0]": "card",
          "mode": "subscription",
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          "success_url": "https://www.touslesmatchs.com?premium=success",
          "cancel_url": "https://www.touslesmatchs.com?premium=cancel",
          "allow_promotion_codes": "true"
        }).toString();
        const session = await httpsRequest({
          hostname: "api.stripe.com",
          path: "/v1/checkout/sessions",
          method: "POST",
          headers: {
            "Authorization": `Bearer ${STRIPE_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(stripeBody)
          }
        }, stripeBody);
        if (session.url) {
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true, url: session.url }));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: session.error?.message || "Erreur Stripe" }));
        }
      } catch(e) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: "Connexion Stripe échouée: " + e.message }));
      }
    });
    return;
  }

  // AUTH endpoints
  if (req.method === "POST" && url.pathname === "/auth/login") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => handleLogin(req, res, body));
    return;
  }
  if (req.method === "POST" && url.pathname === "/auth/register") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => handleRegister(req, res, body));
    return;
  }
  if (req.method === "POST" && url.pathname === "/stripe/create-checkout") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => handleStripeCheckout(req, res, body));
    return;
  }

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({
      ok: true,
      service: "Hermès Analyse Live V2",
      groq: !!GROQ_KEY,
      deepseek: !!DEEPSEEK_KEY,
      football_data: !!FOOTBALL_KEY,
      rapidapi: !!RAPIDAPI_KEY
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: "Route inconnue" }));
});

server.listen(PORT, () => {
  console.log(`🔮 Hermès Analyse Live V2 — port ${PORT}`);
  console.log(`   Groq: ${GROQ_KEY ? "✓" : "✗"}  DeepSeek: ${DEEPSEEK_KEY ? "✓" : "✗"}  RapidAPI: ${RAPIDAPI_KEY ? "✓" : "✗"}  FootballData: ${FOOTBALL_KEY ? "✓" : "✗"}`);
});
