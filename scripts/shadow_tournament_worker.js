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
    "Tu participes à un test à blanc. Le résultat final est inconnu.",
    "Utilise uniquement les faits ci-dessous, sans invention.",
    `Match: ${row.home} vs ${row.away}`,
    `Compétition: ${row.competition || "inconnue"}`,
    `Minute: ${row.minute_at_analysis ?? "inconnue"}`,
    `Score: ${row.score_home_at_analysis ?? "?"}-${row.score_away_at_analysis ?? "?"}`,
    `Forme domicile: ${row.home_form || "indisponible"}`,
    `Forme extérieur: ${row.away_form || "indisponible"}`,
    `Moyenne buts: ${row.home_goals_avg ?? "?"} - ${row.away_goals_avg ?? "?"}`,
    `Tirs: ${row.home_shots ?? "?"} - ${row.away_shots ?? "?"}`,
    `Possession: ${row.home_possession ?? "?"} - ${row.away_possession ?? "?"}`,
    "Choisis uniquement Over 2.5 buts, Under 2.5 buts ou NO BET.",
    "Si les données sont insuffisantes ou contradictoires, choisis NO BET.",
    'Réponds en JSON strict: {"prediction":"Over 2.5 buts|Under 2.5 buts|NO BET","confidence":0,"reason":"une phrase"}',
  ].join("\n");
}

function callModel(name, modelId, prompt) {
  const body = JSON.stringify({
    model: modelId,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 160,
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

function parsePrediction(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON absent");
  const parsed = JSON.parse(match[0]);
  const raw = String(parsed.prediction || "").toLowerCase();
  let prediction = "NO BET";
  if (/over|plus de/.test(raw)) prediction = "Over 2.5 buts";
  else if (/under|moins de/.test(raw)) prediction = "Under 2.5 buts";
  const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
  if (confidence < 72) prediction = "NO BET";
  return { prediction, confidence, reason: String(parsed.reason || "").slice(0, 300) };
}

function resolveFinished() {
  const rows = db.prepare(`
    SELECT p.id, p.prediction, c.final_score_home, c.final_score_away
    FROM shadow_tournament_predictions p
    JOIN concile_analyses c ON c.match_key=p.match_key
    WHERE p.outcome IS NULL AND p.prediction!='NO BET'
      AND c.final_score_home IS NOT NULL AND c.final_score_away IS NOT NULL
  `).all();
  const update = db.prepare(`
    UPDATE shadow_tournament_predictions SET outcome=?, final_score_home=?,
      final_score_away=?, resolved_at=datetime('now') WHERE id=?
  `);
  for (const row of rows) {
    const goals = Number(row.final_score_home) + Number(row.final_score_away);
    const win = row.prediction.startsWith("Over") ? goals >= 3 : goals <= 2;
    update.run(win ? "win" : "loss", row.final_score_home, row.final_score_away, row.id);
  }
  return rows.length;
}

function report() {
  const results = db.prepare(`
    SELECT model_name, model_id, COUNT(*) attempts,
      SUM(CASE WHEN error IS NULL THEN 1 ELSE 0 END) responses,
      SUM(CASE WHEN prediction='NO BET' AND error IS NULL THEN 1 ELSE 0 END) abstains,
      SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END) wins,
      SUM(CASE WHEN outcome='loss' THEN 1 ELSE 0 END) losses,
      ROUND(AVG(CASE WHEN error IS NULL THEN latency_ms END)) avg_latency_ms
    FROM shadow_tournament_predictions GROUP BY model_name, model_id
  `).all().map(row => {
    const resolved = row.wins + row.losses;
    const winrate = resolved ? Math.round(row.wins / resolved * 1000) / 10 : null;
    const availability = row.attempts ? Math.round(row.responses / row.attempts * 1000) / 10 : 0;
    return { ...row, resolved, winrate, availability,
      promotion_ready: resolved >= minResolved && winrate >= 70 && availability >= 85 };
  }).sort((a, b) => (b.winrate ?? -1) - (a.winrate ?? -1));
  return { ok: true, models_tested: models.length, minimum_resolved: minResolved,
    influences_telegram: false, automatic_promotion: false, results };
}

async function run() {
  if (process.argv.includes("--report")) return console.log(JSON.stringify(report(), null, 2));
  if (!apiKey) throw new Error("OPENROUTER_API_KEY absente");
  const resolved = resolveFinished();
  if (matchesToday() >= maxMatches || callsToday() >= maxCalls) {
    return console.log(JSON.stringify({ ok: true, resolved, skipped: "plafond journalier" }));
  }

  const match = db.prepare(`
    SELECT c.* FROM concile_analyses c
    WHERE c.outcome IS NULL AND c.minute_at_analysis BETWEEN 15 AND 32
      AND c.confidence >= 78 AND c.analysed_at >= datetime('now','-30 minutes')
      AND (COALESCE(c.sig_sent_standard,0)=1 OR COALESCE(c.sig_sent_premium,0)=1
        OR EXISTS (SELECT 1 FROM telegram_signal_deliveries t WHERE t.match_key=c.match_key AND t.ok=1))
      AND NOT EXISTS (SELECT 1 FROM shadow_tournament_calls s WHERE s.match_key=c.match_key)
    ORDER BY c.analysed_at ASC LIMIT 1
  `).get();
  if (!match) return console.log(JSON.stringify({ ok: true, resolved, tested: 0, reason: "aucun nouveau signal éligible" }));

  const addPrediction = db.prepare(`
    INSERT OR IGNORE INTO shadow_tournament_predictions
      (match_key,model_name,model_id,home,away,competition,minute,score_home,score_away,
       prediction,confidence,reason,latency_ms,error)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
    let prediction = "NO BET", confidence = 0, reason = "", error = null;
    if (result.ok) {
      try { ({ prediction, confidence, reason } = parsePrediction(result.text)); }
      catch (parseError) { error = parseError.message; }
    } else error = result.error;
    addPrediction.run(match.match_key, name, modelId, match.home, match.away,
      match.competition || "", match.minute_at_analysis, match.score_home_at_analysis,
      match.score_away_at_analysis, prediction, confidence, reason, result.latency, error);
    addCall.run(name, modelId, match.match_key, error ? "error" : "ok", result.latency, error);
    tested++;
  }
  console.log(JSON.stringify({ ok: true, resolved, tested, match: `${match.home} - ${match.away}` }));
}

run().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
}).finally(() => db.close());
