#!/usr/bin/env node
"use strict";

const https = require("https");
const Database = require("better-sqlite3");

const db = new Database(process.env.DB_PATH || "/data/tlm.db");
const apiKey = process.env.OPENROUTER_API_KEY || "";
const maxMatches = Math.max(1, Number(process.env.SHADOW_TOURNAMENT_MATCHES_PER_DAY || 5));
const maxCalls = Math.max(10, Number(process.env.SHADOW_TOURNAMENT_CALLS_PER_DAY || 50));
const perModel = Math.max(1, Number(process.env.SHADOW_TOURNAMENT_PER_MODEL_DAILY || 5));
const delayMs = Math.max(15000, Number(process.env.SHADOW_TOURNAMENT_DELAY_MS || 45000));
const minResolved = Math.max(20, Number(process.env.SHADOW_TOURNAMENT_MIN_RESOLVED || 20));
const shadowMinConfidence = Math.max(77, Number(process.env.SHADOW_MARKET_MIN_CONFIDENCE || 77));

const models = [
  ["Kimi K3", process.env.OR_KIMI_MODEL || "moonshotai/kimi-k3"],
  ["GPT-5.2", process.env.OR_GPT_MODEL || "openai/gpt-5.2"],
  ["Claude Sonnet 5", process.env.OR_CLAUDE_MODEL || "anthropic/claude-sonnet-5"],
  ["Gemini 3.7 Flash", process.env.OR_GEMINI37_MODEL || "google/gemini-3.7-flash"],
  ["DeepSeek V4 Pro", process.env.OR_DEEPSEEKV4_MODEL || "deepseek/deepseek-v4-pro-0813"],
  ["Grok 4.6", process.env.OR_GROK46_MODEL || "x-ai/grok-4.6"],
  ["GLM 5.3 Flash", process.env.OR_GLM53_MODEL || "z-ai/glm-5.3-flash"],
  ["Qwen 3.8 Max", process.env.OR_QWEN38_MODEL || "qwen/qwen3.8-max"],
  ["Muse Spark 1.2", process.env.OR_MUSE12_MODEL || "meta/muse-spark-1.2"],
  ["Mercury 2.5", process.env.OR_MERCURY25_MODEL || "inception/mercury-2.5-preview"],
];

const marketSpecs = [
  { key: "ou15", market: "over_under_1_5", over: "Over 1.5 buts", under: "Under 1.5 buts" },
  { key: "ou35", market: "over_under_3_5", over: "Over 3.5 buts", under: "Under 3.5 buts" },
  { key: "btts", market: "btts", over: "BTTS Oui", under: "BTTS Non" },
];

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS shadow_tournament_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL, model_name TEXT NOT NULL, model_id TEXT NOT NULL,
    home TEXT NOT NULL, away TEXT NOT NULL, competition TEXT DEFAULT '',
    minute INTEGER, score_home INTEGER, score_away INTEGER,
    prediction TEXT NOT NULL, confidence INTEGER DEFAULT 0, reason TEXT DEFAULT '',
    outcome TEXT DEFAULT NULL, final_score_home INTEGER, final_score_away INTEGER,
    latency_ms INTEGER, error TEXT, created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT DEFAULT NULL, UNIQUE(match_key, model_name)
  );
  CREATE INDEX IF NOT EXISTS idx_shadow_tournament_model
    ON shadow_tournament_predictions(model_name, outcome);
  CREATE TABLE IF NOT EXISTS shadow_tournament_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT, model_name TEXT NOT NULL,
    model_id TEXT NOT NULL, match_key TEXT NOT NULL, status TEXT NOT NULL,
    latency_ms INTEGER, error TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS shadow_market_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_key TEXT NOT NULL, model_name TEXT NOT NULL, model_id TEXT NOT NULL,
    market TEXT NOT NULL, selection TEXT NOT NULL, confidence INTEGER DEFAULT 0,
    reason TEXT DEFAULT '', outcome TEXT DEFAULT NULL,
    final_score_home INTEGER, final_score_away INTEGER,
    latency_ms INTEGER, error TEXT, created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT DEFAULT NULL,
    UNIQUE(match_key, model_name, market)
  );
  CREATE INDEX IF NOT EXISTS idx_shadow_market_result
    ON shadow_market_predictions(market, model_name, outcome);
`);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function callsToday(modelName) {
  if (modelName) return db.prepare(
    "SELECT COUNT(*) n FROM shadow_tournament_calls WHERE model_name=? AND date(created_at)=date('now')"
  ).get(modelName).n;
  return db.prepare(
    "SELECT COUNT(*) n FROM shadow_tournament_calls WHERE date(created_at)=date('now')"
  ).get().n;
}

function matchesToday() {
  return db.prepare(
    "SELECT COUNT(DISTINCT match_key) n FROM shadow_tournament_calls WHERE date(created_at)=date('now')"
  ).get().n;
}

function promptFor(row) {
  return [
    "Tu participes à un test à blanc sans aucune diffusion client ou Telegram.",
    "Le résultat final est inconnu. Utilise uniquement les faits ci-dessous, sans invention.",
    `Match: ${row.home} vs ${row.away}`,
    `Compétition: ${row.competition || "inconnue"}`,
    `Minute: ${row.minute_at_analysis ?? "inconnue"}`,
    `Score: ${row.score_home_at_analysis ?? "?"}-${row.score_away_at_analysis ?? "?"}`,
    `Forme domicile: ${row.home_form || "indisponible"}`,
    `Forme extérieur: ${row.away_form || "indisponible"}`,
    `Moyenne buts: ${row.home_goals_avg ?? "?"} - ${row.away_goals_avg ?? "?"}`,
    `Tirs: ${row.home_shots ?? "?"} - ${row.away_shots ?? "?"}`,
    `Possession: ${row.home_possession ?? "?"} - ${row.away_possession ?? "?"}`,
    "Évalue séparément O/U 2,5, O/U 1,5, O/U 3,5 et les deux équipes marquent.",
    "Pour chaque marché, choisis une sélection autorisée ou NO BET si les données sont insuffisantes.",
    'Réponds en JSON strict: {"ou25":{"prediction":"Over 2.5 buts|Under 2.5 buts|NO BET","confidence":0,"reason":"court"},"ou15":{"prediction":"Over 1.5 buts|Under 1.5 buts|NO BET","confidence":0,"reason":"court"},"ou35":{"prediction":"Over 3.5 buts|Under 3.5 buts|NO BET","confidence":0,"reason":"court"},"btts":{"prediction":"BTTS Oui|BTTS Non|NO BET","confidence":0,"reason":"court"}}',
  ].join("\n");
}

function callModel(name, modelId, prompt) {
  const body = JSON.stringify({
    model: modelId,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 320,
    temperature: 0,
  });
  const started = Date.now();
  return new Promise(resolve => {
    const req = https.request({
      hostname: "openrouter.ai", path: "/api/v1/chat/completions", method: "POST",
      timeout: 60000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "HTTP-Referer": "https://www.touslesmatchs.com",
        "X-Title": "TousLesMatchs Shadow Tournament",
      },
    }, res => {
      let raw = "";
      res.on("data", chunk => { raw += chunk; });
      res.on("end", () => {
        const latency = Date.now() - started;
        try {
          const payload = JSON.parse(raw);
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return resolve({ ok: false, latency, error: payload?.error?.message || `HTTP ${res.statusCode}` });
          }
          resolve({ ok: true, latency, text: payload?.choices?.[0]?.message?.content || "" });
        } catch (error) {
          resolve({ ok: false, latency, error: `réponse invalide: ${error.message}` });
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", error => resolve({ ok: false, latency: Date.now() - started, error: error.message }));
    req.write(body);
    req.end();
  });
}

function jsonPayload(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON absent");
  return JSON.parse(match[0]);
}

function normalizeChoice(rawValue, allowed) {
  const item = rawValue && typeof rawValue === "object" ? rawValue : {};
  const raw = String(item.prediction || "").trim().toLowerCase();
  let selection = "NO BET";
  for (const candidate of allowed) {
    if (raw === candidate.toLowerCase()) selection = candidate;
  }
  const confidence = Math.max(0, Math.min(100, Number(item.confidence) || 0));
  if (confidence < shadowMinConfidence) selection = "NO BET";
  return { selection, confidence, reason: String(item.reason || "").slice(0, 300) };
}

function parsePredictions(text) {
  const parsed = jsonPayload(text);
  const legacy = parsed.prediction ? parsed : null;
  const ou25 = normalizeChoice(parsed.ou25 || legacy, ["Over 2.5 buts", "Under 2.5 buts"]);
  const markets = marketSpecs.map(spec => ({
    ...spec,
    ...normalizeChoice(parsed[spec.key], [spec.over, spec.under]),
  }));
  return { ou25, markets };
}

function settle(selection, home, away) {
  const h = Number(home), a = Number(away), total = h + a;
  if (selection === "Over 1.5 buts") return total >= 2;
  if (selection === "Under 1.5 buts") return total <= 1;
  if (selection === "Over 2.5 buts") return total >= 3;
  if (selection === "Under 2.5 buts") return total <= 2;
  if (selection === "Over 3.5 buts") return total >= 4;
  if (selection === "Under 3.5 buts") return total <= 3;
  if (selection === "BTTS Oui") return h > 0 && a > 0;
  if (selection === "BTTS Non") return h === 0 || a === 0;
  return null;
}

function resolveFinished() {
  const primary = db.prepare(`
    SELECT p.id, p.prediction, c.final_score_home, c.final_score_away
    FROM shadow_tournament_predictions p
    JOIN concile_analyses c ON c.match_key=p.match_key
    WHERE p.outcome IS NULL AND p.prediction!='NO BET'
      AND c.final_score_home IS NOT NULL AND c.final_score_away IS NOT NULL
    GROUP BY p.id
  `).all();
  const updatePrimary = db.prepare(`
    UPDATE shadow_tournament_predictions SET outcome=?, final_score_home=?,
      final_score_away=?, resolved_at=datetime('now') WHERE id=?
  `);
  for (const row of primary) {
    const win = settle(row.prediction, row.final_score_home, row.final_score_away);
    if (win !== null) updatePrimary.run(win ? "win" : "loss", row.final_score_home, row.final_score_away, row.id);
  }

  const markets = db.prepare(`
    SELECT p.id, p.selection, c.final_score_home, c.final_score_away
    FROM shadow_market_predictions p
    JOIN concile_analyses c ON c.match_key=p.match_key
    WHERE p.outcome IS NULL AND p.selection!='NO BET'
      AND c.final_score_home IS NOT NULL AND c.final_score_away IS NOT NULL
    GROUP BY p.id
  `).all();
  const updateMarket = db.prepare(`
    UPDATE shadow_market_predictions SET outcome=?, final_score_home=?,
      final_score_away=?, resolved_at=datetime('now') WHERE id=?
  `);
  for (const row of markets) {
    const win = settle(row.selection, row.final_score_home, row.final_score_away);
    if (win !== null) updateMarket.run(win ? "win" : "loss", row.final_score_home, row.final_score_away, row.id);
  }
  return { primary: primary.length, markets: markets.length };
}

function summarize(rows, predictionField) {
  return rows.map(row => {
    const resolved = Number(row.wins || 0) + Number(row.losses || 0);
    const winrate = resolved ? Math.round(Number(row.wins) / resolved * 1000) / 10 : null;
    const availability = row.attempts ? Math.round(Number(row.responses) / Number(row.attempts) * 1000) / 10 : 0;
    return {
      ...row,
      resolved,
      winrate,
      availability,
      review_candidate: resolved >= minResolved && winrate >= 70 && availability >= 85,
      prediction_field: predictionField,
    };
  }).sort((a, b) => (b.winrate ?? -1) - (a.winrate ?? -1));
}

function report() {
  const modelRows = db.prepare(`
    SELECT model_name, model_id, COUNT(*) attempts,
      SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END) responses,
      SUM(CASE WHEN prediction='NO BET' AND error IS NULL THEN 1 ELSE 0 END) abstains,
      SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
      SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses,
      ROUND(AVG(CASE WHEN error IS NULL THEN latency_ms END)) avg_latency_ms
    FROM shadow_tournament_predictions GROUP BY model_name, model_id
  `).all();
  const marketRows = db.prepare(`
    SELECT market, model_name, model_id, COUNT(*) attempts,
      SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END) responses,
      SUM(CASE WHEN selection='NO BET' AND error IS NULL THEN 1 ELSE 0 END) abstains,
      SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
      SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses,
      ROUND(AVG(CASE WHEN error IS NULL THEN latency_ms END)) avg_latency_ms
    FROM shadow_market_predictions GROUP BY market, model_name, model_id
  `).all();
  return {
    ok: true,
    models_tested: models.length,
    markets_tested: marketSpecs.map(spec => spec.market),
    minimum_resolved: minResolved,
    minimum_confidence: shadowMinConfidence,
    influences_telegram: false,
    automatic_promotion: false,
    results: summarize(modelRows, "prediction"),
    market_results: summarize(marketRows, "selection"),
  };
}

async function run() {
  if (process.argv.includes("--report")) return console.log(JSON.stringify(report(), null, 2));
  if (!apiKey) throw new Error("OPENROUTER_API_KEY absente");
  const resolved = resolveFinished();
  if (matchesToday() >= maxMatches || callsToday() >= maxCalls) {
    return console.log(JSON.stringify({ ok: true, resolved, skipped: "plafond journalier" }));
  }

  // Le shadow apprend sur les analyses live admissibles même si aucun message Telegram
  // n'a été envoyé. L'ancienne dépendance à sig_sent_* créait un tournoi vide précisément
  // pendant les périodes où l'on avait besoin de comprendre le manque de signaux.
  const match = db.prepare(`
    SELECT c.* FROM concile_analyses c
    WHERE c.outcome IS NULL AND c.minute_at_analysis BETWEEN 15 AND 40
      AND c.confidence >= 77 AND c.analysed_at >= datetime('now','-2 hours')
      AND c.best_bet IN ('Over 2.5 buts','Under 2.5 buts')
      AND NOT EXISTS (SELECT 1 FROM shadow_tournament_calls s WHERE s.match_key=c.match_key)
    ORDER BY c.analysed_at ASC LIMIT 1
  `).get();
  if (!match) return console.log(JSON.stringify({ ok: true, resolved, tested: 0, reason: "aucune nouvelle analyse live admissible" }));

  const addPrediction = db.prepare(`
    INSERT OR IGNORE INTO shadow_tournament_predictions
      (match_key,model_name,model_id,home,away,competition,minute,score_home,score_away,
       prediction,confidence,reason,latency_ms,error)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const addMarketPrediction = db.prepare(`
    INSERT OR IGNORE INTO shadow_market_predictions
      (match_key,model_name,model_id,market,selection,confidence,reason,latency_ms,error)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  const addCall = db.prepare(`
    INSERT INTO shadow_tournament_calls (model_name,model_id,match_key,status,latency_ms,error)
    VALUES (?,?,?,?,?,?)
  `);

  let tested = 0;
  for (const [name, modelId] of models) {
    if (callsToday() >= maxCalls || callsToday(name) >= perModel) continue;
    if (tested) await sleep(delayMs);
    const result = await callModel(name, modelId, promptFor(match));
    let ou25 = { selection: "NO BET", confidence: 0, reason: "" };
    let markets = marketSpecs.map(spec => ({ ...spec, selection: "NO BET", confidence: 0, reason: "" }));
    let error = null;
    if (result.ok) {
      try { ({ ou25, markets } = parsePredictions(result.text)); }
      catch (parseError) { error = parseError.message; }
    } else error = result.error;

    addPrediction.run(match.match_key, name, modelId, match.home, match.away,
      match.competition || "", match.minute_at_analysis, match.score_home_at_analysis,
      match.score_away_at_analysis, ou25.selection, ou25.confidence, ou25.reason,
      result.latency, error);
    for (const item of markets) {
      addMarketPrediction.run(match.match_key, name, modelId, item.market,
        item.selection, item.confidence, item.reason, result.latency, error);
    }
    addCall.run(name, modelId, match.match_key, error ? "error" : "ok", result.latency, error);
    tested++;
  }
  console.log(JSON.stringify({
    ok: true,
    resolved,
    tested,
    markets_tested: marketSpecs.map(spec => spec.market),
    influences_telegram: false,
    match: `${match.home} - ${match.away}`,
  }));
}

run().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
}).finally(() => db.close());
