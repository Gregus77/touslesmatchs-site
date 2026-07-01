/**
 * analyse_live.js — Backend HERMÈS « Analyse en direct »
 * ------------------------------------------------------
 * Sert deux routes consommées par src/AnalyseLive.js :
 *   GET  /api/live-matches  -> { ok, matches:[{home,away,minute,score_home,score_away}] }
 *   POST /api/analyse       -> { ok, resume, value_bet, over25, btts, resultat, premier_but_mi_temps }
 *
 * Principe clé : les probabilités sont DÉRIVÉES DES COTES RÉELLES d'API-Football
 * (api-sports.io) puis dé-marginées. Elles ne sont donc JAMAIS un 70% forfaitaire.
 * L'IA (Groq/Llama) ne sert qu'à rédiger le texte d'analyse — pas à inventer les chiffres.
 *
 * En cas d'échec (pas de cotes, quota, réseau) on renvoie { ok:false, error }
 * plutôt qu'une valeur bidon : le front affiche une erreur honnête.
 *
 * Aucune dépendance npm (modules Node natifs uniquement) — cf. Dockerfile.api.
 */
"use strict";

const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3001;

// --- API-Football (api-sports.io) — la clé achetée par l'utilisateur ---
const SPORTS_API_KEY = process.env.SPORTS_API_KEY || "";
const SPORTS_API_HOST = process.env.SPORTS_API_HOST || "v3.football.api-sports.io";

// --- Groq (LLM gratuit rate-limité) — uniquement pour la rédaction ---
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// IDs des marchés API-Football
const BET_MATCH_WINNER = 1; // Home / Draw / Away
const BET_OVER_UNDER = 5;   // "Over 2.5" / "Under 2.5"
const BET_BTTS = 8;         // Yes / No

/* ------------------------------------------------------------------ */
/* Helpers HTTP                                                        */
/* ------------------------------------------------------------------ */

function httpsGetJson(host, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: host, path, method: "GET", headers, timeout: 15000 },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve(JSON.parse(d)); }
          catch { reject(new Error("JSON invalide de " + host)); }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout " + host)));
    req.on("error", reject);
    req.end();
  });
}

function httpsPostJson(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: host, path, method: "POST", timeout: 20000,
        headers: { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try { resolve(JSON.parse(d)); }
          catch { reject(new Error("JSON invalide de " + host)); }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout " + host)));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function apiFootball(path) {
  if (!SPORTS_API_KEY) return Promise.reject(new Error("SPORTS_API_KEY manquante"));
  return httpsGetJson(SPORTS_API_HOST, "/" + path.replace(/^\//, ""), {
    "x-rapidapi-key": SPORTS_API_KEY,
    "x-rapidapi-host": SPORTS_API_HOST,
  });
}

/* ------------------------------------------------------------------ */
/* Probabilités à partir des cotes (dé-margination)                    */
/* ------------------------------------------------------------------ */

// Transforme une liste de cotes décimales en probabilités % (entiers, somme=100).
function deMargin(odds) {
  const inv = odds.map((o) => (o > 1 ? 1 / o : 0));
  const sum = inv.reduce((a, b) => a + b, 0);
  if (sum <= 0) return odds.map(() => 0);
  const raw = inv.map((v) => (v / sum) * 100);
  // Arrondi en gardant la somme à 100
  const rounded = raw.map((v) => Math.round(v));
  let diff = 100 - rounded.reduce((a, b) => a + b, 0);
  // Corrige l'écart d'arrondi sur l'élément le plus grand
  const idx = raw.indexOf(Math.max(...raw));
  rounded[idx] += diff;
  return rounded;
}

// Cote « fair » (sans marge) conseillée comme seuil de value.
function fairOdd(probPct) {
  if (!probPct || probPct <= 0) return null;
  return Math.round((100 / probPct) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Récupération des matchs & cotes                                     */
/* ------------------------------------------------------------------ */

function mapFixture(f) {
  const fx = f.fixture || {};
  const teams = f.teams || {};
  const goals = f.goals || {};
  const status = fx.status || {};
  return {
    id: fx.id,
    home: (teams.home || {}).name || "",
    away: (teams.away || {}).name || "",
    minute: status.elapsed || 0,
    score_home: goals.home == null ? 0 : goals.home,
    score_away: goals.away == null ? 0 : goals.away,
    status_short: status.short || "NS",
    league: (f.league || {}).name || "",
  };
}

async function getLiveMatches() {
  const data = await apiFootball("fixtures?live=all");
  return (data.response || []).map(mapFixture);
}

// Cherche un match (live d'abord, sinon programmé aujourd'hui) par noms d'équipes.
async function findFixture(home, away) {
  const norm = (s) => String(s || "").toLowerCase().trim();
  const wanted = (m) =>
    (norm(m.home).includes(norm(home)) || norm(home).includes(norm(m.home))) &&
    (norm(m.away).includes(norm(away)) || norm(away).includes(norm(m.away)));

  // 1) Matchs en direct
  try {
    const live = await getLiveMatches();
    const hit = live.find(wanted);
    if (hit) return hit;
  } catch (_) { /* on tente le jour */ }

  // 2) Matchs du jour
  const today = new Date().toISOString().slice(0, 10);
  const data = await apiFootball(`fixtures?date=${today}`);
  const all = (data.response || []).map(mapFixture);
  return all.find(wanted) || null;
}

// Extrait les cotes utiles d'un fixture -> probabilités.
async function getOddsProbs(fixtureId) {
  const data = await apiFootball(`odds?fixture=${fixtureId}`);
  const resp = data.response || [];
  if (!resp.length || !(resp[0].bookmakers || []).length) return null;

  // Moyenne des bookmakers pour lisser
  const bets = {};
  for (const bk of resp[0].bookmakers) {
    for (const bet of bk.bets || []) {
      const values = {};
      for (const v of bet.values || []) values[v.value] = parseFloat(v.odd);
      if (!bets[bet.id]) bets[bet.id] = [];
      bets[bet.id].push(values);
    }
  }
  const avg = (id, key) => {
    const arr = (bets[id] || []).map((v) => v[key]).filter((x) => x > 0);
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  };

  const out = {};

  // 1X2
  const oH = avg(BET_MATCH_WINNER, "Home");
  const oD = avg(BET_MATCH_WINNER, "Draw");
  const oA = avg(BET_MATCH_WINNER, "Away");
  if (oH && oD && oA) {
    const [ph, pd, pa] = deMargin([oH, oD, oA]);
    out.resultat = { domicile: ph, nul: pd, exterieur: pa };
  }

  // Over/Under 2.5
  const oOver = avg(BET_OVER_UNDER, "Over 2.5");
  const oUnder = avg(BET_OVER_UNDER, "Under 2.5");
  if (oOver && oUnder) {
    const [pOver] = deMargin([oOver, oUnder]);
    out.over25 = pOver;
  }

  // BTTS
  const oYes = avg(BET_BTTS, "Yes");
  const oNo = avg(BET_BTTS, "No");
  if (oYes && oNo) {
    const [pYes] = deMargin([oYes, oNo]);
    out.btts = pYes;
  }

  return Object.keys(out).length ? out : null;
}

/* ------------------------------------------------------------------ */
/* Sélection du value bet + prochain but                               */
/* ------------------------------------------------------------------ */

function pickValueBet(probs) {
  const candidates = [];
  if (probs.resultat) {
    candidates.push({ marche: "Victoire domicile (1)", prob: probs.resultat.domicile });
    candidates.push({ marche: "Victoire extérieur (2)", prob: probs.resultat.exterieur });
    candidates.push({ marche: "Double chance 1X", prob: probs.resultat.domicile + probs.resultat.nul });
    candidates.push({ marche: "Double chance X2", prob: probs.resultat.nul + probs.resultat.exterieur });
  }
  if (probs.over25 != null) {
    candidates.push({ marche: "Plus de 2,5 buts", prob: probs.over25 });
    candidates.push({ marche: "Moins de 2,5 buts", prob: 100 - probs.over25 });
  }
  if (probs.btts != null) {
    candidates.push({ marche: "Les deux équipes marquent (Oui)", prob: probs.btts });
    candidates.push({ marche: "Une équipe ne marque pas (Non)", prob: 100 - probs.btts });
  }
  // Meilleur compromis probabilité/valeur : on privilégie une proba solide (55–80%)
  candidates.sort((a, b) => scoreValue(b.prob) - scoreValue(a.prob));
  const best = candidates[0];
  if (!best) return null;
  return {
    marche: best.marche,
    prob: Math.round(best.prob),
    cote_min_conseillée: fairOdd(best.prob),
    raison: "",
  };
}

// Favorise les probabilités "sweet spot" plutôt que les quasi-certitudes (cote nulle).
function scoreValue(p) {
  if (p >= 80) return p - 30;      // trop favori = peu de valeur
  if (p >= 55) return p + 10;      // zone idéale
  return p;
}

function nextGoalSplit(match) {
  const minute = match.minute || 0;
  // Avant match : réparti selon la tendance habituelle (un peu plus de buts en 2e MT).
  if (!minute) return { premiere: 47, deuxieme: 53 };
  if (minute >= 45) return { premiere: 0, deuxieme: 100 };
  // En 1re MT : proportion du temps restant dans chaque période.
  const restH1 = 45 - minute;
  const total = restH1 + 45 + 5;
  return {
    premiere: Math.round((restH1 / total) * 100),
    deuxieme: 100 - Math.round((restH1 / total) * 100),
  };
}

/* ------------------------------------------------------------------ */
/* Rédaction du texte via Groq (facultatif, non bloquant)              */
/* ------------------------------------------------------------------ */

async function writeNarrative(match, probs, valueBet) {
  const fallback = buildTemplateNarrative(match, probs, valueBet);
  if (!GROQ_API_KEY) return fallback;
  try {
    const context = {
      match: `${match.home} vs ${match.away}`,
      minute: match.minute,
      score: `${match.score_home}-${match.score_away}`,
      probabilites: probs,
      value_bet: valueBet && valueBet.marche,
    };
    const res = await httpsPostJson(
      "api.groq.com",
      "/openai/v1/chat/completions",
      { Authorization: `Bearer ${GROQ_API_KEY}` },
      {
        model: GROQ_MODEL,
        temperature: 0.4,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Tu es Hermès, analyste sportif. On te donne des probabilités DÉJÀ CALCULÉES à partir des cotes réelles. " +
              "Tu ne dois PAS inventer d'autres chiffres, seulement rédiger des commentaires courts en français. " +
              'Réponds en JSON strict: {"resume": "3-4 phrases", "value_raison": "1 phrase", ' +
              '"over_tendance":"1 phrase","btts_tendance":"1 phrase","resultat_explication":"1 phrase","but_explication":"1 phrase"}',
          },
          { role: "user", content: JSON.stringify(context) },
        ],
      }
    );
    const raw = res.choices && res.choices[0] && res.choices[0].message.content;
    const j = JSON.parse(raw);
    return {
      resume: j.resume || fallback.resume,
      value_raison: j.value_raison || fallback.value_raison,
      over_tendance: j.over_tendance || fallback.over_tendance,
      btts_tendance: j.btts_tendance || fallback.btts_tendance,
      resultat_explication: j.resultat_explication || fallback.resultat_explication,
      but_explication: j.but_explication || fallback.but_explication,
    };
  } catch (e) {
    console.error("[Groq] narration KO:", e.message);
    return fallback;
  }
}

function buildTemplateNarrative(match, probs, valueBet) {
  const etat = match.minute
    ? `${match.minute}' — score ${match.score_home}-${match.score_away}`
    : "coup d'envoi à venir";
  return {
    resume:
      `${match.home} vs ${match.away} (${etat}). ` +
      `Probabilités calculées sur les cotes réelles du marché. ` +
      (valueBet ? `Meilleure valeur détectée : ${valueBet.marche} (${valueBet.prob}%).` : ""),
    value_raison: valueBet
      ? `Probabilité implicite de ${valueBet.prob}% : value si la cote proposée dépasse ${valueBet.cote_min_conseillée}.`
      : "",
    over_tendance: probs.over25 != null ? `Marché à ${probs.over25}% pour un match à +2,5 buts.` : "Cotes buts indisponibles.",
    btts_tendance: probs.btts != null ? `${probs.btts}% que les deux équipes marquent.` : "Cotes BTTS indisponibles.",
    resultat_explication: probs.resultat
      ? `Le marché voit ${probs.resultat.domicile}% / ${probs.resultat.nul}% / ${probs.resultat.exterieur}%.`
      : "Cotes 1X2 indisponibles.",
    but_explication: "Répartition estimée selon le temps de jeu restant.",
  };
}

/* ------------------------------------------------------------------ */
/* Orchestration de l'analyse                                          */
/* ------------------------------------------------------------------ */

async function analyse(home, away) {
  const match = await findFixture(home, away);
  if (!match) {
    return { ok: false, error: "Match introuvable dans API-Football (vérifie les noms d'équipes)." };
  }
  const probs = await getOddsProbs(match.id);
  if (!probs) {
    return { ok: false, error: "Cotes indisponibles pour ce match — analyse impossible sans données de marché." };
  }
  const valueBet = pickValueBet(probs);
  const split = nextGoalSplit(match);
  const txt = await writeNarrative(match, probs, valueBet);

  const out = { ok: true, resume: txt.resume };

  if (valueBet) {
    valueBet.raison = txt.value_raison;
    out.value_bet = valueBet;
  }
  if (probs.over25 != null) out.over25 = { prob: probs.over25, tendance: txt.over_tendance };
  if (probs.btts != null) out.btts = { prob: probs.btts, tendance: txt.btts_tendance };
  if (probs.resultat) out.resultat = { ...probs.resultat, explication: txt.resultat_explication };
  out.premier_but_mi_temps = { ...split, explication: txt.but_explication };

  return out;
}

/* ------------------------------------------------------------------ */
/* Serveur HTTP                                                        */
/* ------------------------------------------------------------------ */

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = (req.url || "").split("?")[0];

  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  if (req.method === "GET" && (url === "/api/health" || url === "/health")) {
    return sendJson(res, 200, { ok: true, sports_api: !!SPORTS_API_KEY, groq: !!GROQ_API_KEY });
  }

  if (req.method === "GET" && url === "/api/live-matches") {
    getLiveMatches()
      .then((matches) => sendJson(res, 200, { ok: true, matches }))
      .catch((e) => sendJson(res, 200, { ok: false, error: e.message, matches: [] }));
    return;
  }

  if (req.method === "POST" && url === "/api/analyse") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let payload = {};
      try { payload = JSON.parse(body || "{}"); } catch { /* ignore */ }
      const home = (payload.home || "").trim();
      const away = (payload.away || "").trim();
      if (!home || !away) return sendJson(res, 200, { ok: false, error: "Équipes manquantes." });
      analyse(home, away)
        .then((r) => sendJson(res, 200, r))
        .catch((e) => {
          console.error("[analyse] erreur:", e.message);
          sendJson(res, 200, { ok: false, error: "Analyse indisponible : " + e.message });
        });
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route inconnue" });
});

server.listen(PORT, () => {
  console.log(`[analyse_live] écoute sur :${PORT} — SPORTS_API=${SPORTS_API_KEY ? "OK" : "MANQUANTE"} GROQ=${GROQ_API_KEY ? "OK" : "absent"}`);
});
