// ═══════════════════════════════════════════════════════════
//  HERMÈS — ANALYSE LIVE V1.0
//  API Express sur le VPS — port 3001
//  Analyse un match en temps réel via IA (Groq + Claude)
//  Retourne : Over/Under 2.5, BTTS, 1ère/2ème mi-temps, résultat
// ═══════════════════════════════════════════════════════════

const https  = require("https");
const http   = require("http");
const crypto = require("crypto");
const { handleLogin, handleRegister, handleStripeCheckout } = require("./api_auth");
const { verifyStripeSignature, handleStripeEvent } = require("./stripe_webhook");
const store  = require("./subscriptions_store");

const GROQ_KEY      = process.env.GROQ_API_KEY || "";
const FOOTBALL_KEY  = process.env.FOOTBALL_DATA_KEY || "";
const STRIPE_KEY    = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE  = process.env.STRIPE_PRICE_ID || "";
const PORT          = 3001;

// ── CORS headers ──────────────────────────────────────────
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.touslesmatchs.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");
}

// ── Fetch matchs live via football-data.org ───────────────
async function getLiveMatches() {
  if (!FOOTBALL_KEY) return [];
  return new Promise((resolve) => {
    https.get("https://api.football-data.org/v4/matches?status=IN_PLAY,PAUSED",
      { headers: { "X-Auth-Token": FOOTBALL_KEY } },
      res => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => {
          try {
            const data = JSON.parse(d);
            const matches = (data.matches || []).map(m => ({
              id: m.id,
              home: m.homeTeam?.name || "?",
              away: m.awayTeam?.name || "?",
              competition: m.competition?.name || "?",
              minute: m.minute || "?",
              score_home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0,
              score_away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0,
              status: m.status
            }));
            resolve(matches);
          } catch { resolve([]); }
        });
      }
    ).on("error", () => resolve([]));
  });
}

// ── Analyse IA via Groq ───────────────────────────────────
async function analyseMatch(home, away, competition, scoreHome, scoreAway, minute) {
  if (!GROQ_KEY) return null;

  const prompt = `Tu es un expert en paris sportifs. Analyse ce match EN COURS et donne des probabilités précises.

Match : ${home} vs ${away}
Compétition : ${competition}
Score actuel : ${scoreHome}-${scoreAway}
Minute : ${minute}'

Analyse le contexte (équipes, forme générale, score actuel) et retourne UNIQUEMENT ce JSON :
{
  "over25": {"prob": 62, "tendance": "Score déjà 1-0, les deux équipes attaquent"},
  "btts": {"prob": 55, "tendance": "${away} doit marquer, pression offensive"},
  "resultat": {
    "domicile": 45,
    "nul": 25,
    "exterieur": 30,
    "explication": "L'équipe à domicile mène et contrôle"
  },
  "premier_but_mi_temps": {
    "premiere": 40,
    "deuxieme": 60,
    "explication": "Match équilibré en 1ère, les buts viennent souvent en 2ème"
  },
  "value_bet": {
    "marche": "Over 2.5",
    "prob": 62,
    "cote_min_conseillée": 1.62,
    "raison": "Score actuel + pressing des deux équipes"
  },
  "resume": "Analyse en 2-3 phrases du match et des probabilités"
}`;

  return new Promise((resolve) => {
    const body = JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }]
    });

    const req = https.request({
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        try {
          const r = JSON.parse(d);
          const text = r.choices?.[0]?.message?.content || "";
          const match = text.match(/\{[\s\S]*\}/);
          resolve(match ? JSON.parse(match[0]) : null);
        } catch { resolve(null); }
      });
    });
    req.on("error", () => resolve(null));
    req.write(body);
    req.end();
  });
}

// ── Serveur HTTP ──────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  cors(res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // GET /live-matches — liste des matchs en cours
  if (req.method === "GET" && url.pathname === "/live-matches") {
    const matches = await getLiveMatches();
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, matches }));
    return;
  }

  // POST /analyse — analyse d'un match spécifique
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
        const analyse = await analyseMatch(
          home, away, competition || "Compétition inconnue",
          score_home || 0, score_away || 0, minute || "?"
        );
        if (!analyse) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: "Analyse indisponible" }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, home, away, ...analyse }));
      } catch(e) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // ── POST /stripe/webhook — Stripe lifecycle events ──────
  if (req.method === "POST" && url.pathname === "/stripe/webhook") {
    const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
    let rawBody = Buffer.alloc(0);
    req.on("data", chunk => { rawBody = Buffer.concat([rawBody, chunk]); });
    req.on("end", async () => {
      try {
        const sigHeader = req.headers["stripe-signature"] || "";
        const event = verifyStripeSignature(rawBody, sigHeader, WEBHOOK_SECRET);
        await handleStripeEvent(event);
        res.writeHead(200);
        res.end(JSON.stringify({ received: true }));
      } catch (err) {
        console.error("[WEBHOOK] Erreur:", err.message);
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // ── POST /subscribe — Capture email ──────────────────────
  if (req.method === "POST" && url.pathname === "/subscribe") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const { email } = JSON.parse(body);
        if (!email || !email.includes("@")) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: "Email invalide" }));
          return;
        }
        const isNew = store.addEmail(email.toLowerCase().trim());
        console.log(`[SUBSCRIBE] ${email} — ${isNew ? "nouveau" : "déjà inscrit"}`);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, new: isNew }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // ── POST /create-checkout — Stripe Checkout Session ──
  if (req.method === "POST" && url.pathname === "/create-checkout") {
    if (!STRIPE_KEY || !STRIPE_PRICE) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: "Stripe non configuré" }));
      return;
    }
    const stripeBody = new URLSearchParams({
      "payment_method_types[0]": "card",
      "mode": "subscription",
      "line_items[0][price]": STRIPE_PRICE,
      "line_items[0][quantity]": "1",
      "success_url": "https://www.touslesmatchs.com?premium=success",
      "cancel_url": "https://www.touslesmatchs.com?premium=cancel",
      "allow_promotion_codes": "true"
    }).toString();
    const stripeReq = https.request({
      hostname: "api.stripe.com",
      path: "/v1/checkout/sessions",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(stripeBody)
      }
    }, stripeRes => {
      let d = ""; stripeRes.on("data", c => d += c);
      stripeRes.on("end", () => {
        try {
          const session = JSON.parse(d);
          if (session.url) {
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true, url: session.url }));
          } else {
            res.writeHead(400);
            res.end(JSON.stringify({ ok: false, error: session.error?.message || "Erreur Stripe" }));
          }
        } catch(e) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: "Erreur parsing Stripe" }));
        }
      });
    });
    stripeReq.on("error", () => {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: "Connexion Stripe échouée" }));
    });
    stripeReq.write(stripeBody);
    stripeReq.end();
    return;
  }

  // ── AUTH ENDPOINTS ──────────────────────────────────────
  // POST /auth/login
  if (req.method === "POST" && url.pathname === "/auth/login") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => handleLogin(req, res, body));
    return;
  }

  // POST /auth/register
  if (req.method === "POST" && url.pathname === "/auth/register") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => handleRegister(req, res, body));
    return;
  }

  // POST /stripe/create-checkout (new version with user auth)
  if (req.method === "POST" && url.pathname === "/stripe/create-checkout") {
    let body = "";
    req.on("data", c => body += c);
    req.on("end", () => handleStripeCheckout(req, res, body));
    return;
  }

  // Health check
  if (url.pathname === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, service: "Hermès Analyse Live", port: PORT }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ ok: false, error: "Route inconnue" }));
});

server.listen(PORT, () => {
  console.log(`🔮 Hermès Analyse Live — port ${PORT}`);
});
