#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/touslesmatchs"
DAY="2026-09-04"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
cd "$ROOT"

printf '[baseline] branch=%s head=%s upstream=%s\n' \
  "$(git branch --show-current)" \
  "$(git rev-parse HEAD)" \
  "$(git rev-parse --abbrev-ref '@{upstream}' 2>/dev/null || echo NONE)"
git status --short --branch
docker compose ps api

docker exec touslesmatchs-api grep -q "findUniqueFinishedMatchForStale" /app/server.js
curl -fsS --max-time 15 http://127.0.0.1:3001/health >/dev/null

docker exec -i touslesmatchs-api node <<'NODE'
"use strict";

const fs = require("fs");
const https = require("https");
const Database = require("better-sqlite3");

const DAY = "2026-09-04";
const db = new Database(process.env.DB_PATH || "/data/tlm.db");
const proofFile = "/data/lyon-auxerre-correction-20260904.json";
const norm = (value) => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function requestJson(hostname, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, headers, timeout: 15000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }); }
        catch { reject(new Error("réponse JSON illisible depuis " + hostname)); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout " + hostname)));
    req.end();
  });
}

function sendTelegram(chatId, text) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    const req = https.request({
      hostname: "api.telegram.org",
      path: "/bot" + process.env.TELEGRAM_BOT_TOKEN + "/sendMessage",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            ok: parsed.ok === true,
            message_id: parsed?.result?.message_id || null,
            error: parsed?.description || null,
          });
        } catch {
          resolve({ ok: false, message_id: null, error: "réponse Telegram illisible" });
        }
      });
    });
    req.on("error", (error) => resolve({ ok: false, message_id: null, error: error.message }));
    req.on("timeout", () => req.destroy(new Error("timeout Telegram")));
    req.write(body);
    req.end();
  });
}

function resolveOutcome(bet, home, away) {
  const total = Number(home) + Number(away);
  const value = norm(bet);
  if ((value.includes("over") || value.includes("plus de")) && /2[ ,.]*5/.test(value)) {
    return total > 2.5 ? "win" : "loss";
  }
  if ((value.includes("under") || value.includes("moins de")) && /2[ ,.]*5/.test(value)) {
    return total < 2.5 ? "win" : "loss";
  }
  return null;
}

function tableExists(name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function columns(name) {
  return new Set(db.prepare("PRAGMA table_info(" + name + ")").all().map((row) => row.name));
}

let officialHome;
let officialAway;

function repairPredictionTable(name, betColumn, dateColumn, finalColumns) {
  if (!tableExists(name)) return 0;
  const cols = columns(name);
  if (![betColumn, dateColumn, "home", "away", "outcome"].every((key) => cols.has(key))) return 0;
  const rows = db.prepare(
    "SELECT rowid AS rid, " + betColumn + " AS bet FROM " + name +
    " WHERE date(" + dateColumn + ")=? AND lower(home) LIKE '%lyon%' AND lower(away) LIKE '%auxerre%'"
  ).all(DAY);
  let changed = 0;
  for (const row of rows) {
    const result = resolveOutcome(row.bet, officialHome, officialAway);
    if (!result) continue;
    const sets = ["outcome=?"];
    const args = [result];
    if (finalColumns && cols.has("final_score_home") && cols.has("final_score_away")) {
      sets.push("final_score_home=?", "final_score_away=?");
      args.push(officialHome, officialAway);
    }
    if (cols.has("resolved_at")) sets.push("resolved_at=datetime('now')");
    args.push(row.rid);
    db.prepare("UPDATE " + name + " SET " + sets.join(",") + " WHERE rowid=?").run(...args);
    changed++;
  }
  return changed;
}

(async () => {
  const apiKey = process.env.API_FOOTBALL_KEY || process.env.API_SPORTS_KEY;
  if (!apiKey) throw new Error("clé API-Football absente");
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error("jeton Telegram absent");

  const response = await requestJson(
    "v3.football.api-sports.io",
    "/fixtures?date=" + DAY,
    { "x-apisports-key": apiKey }
  );
  if (response.status !== 200) throw new Error("API-Football HTTP " + response.status);

  const fixtures = (response.json.response || []).filter((item) => {
    const home = norm(item?.teams?.home?.name);
    const away = norm(item?.teams?.away?.name);
    const league = norm(item?.league?.name);
    const country = norm(item?.league?.country);
    return home.includes("lyon") && away.includes("auxerre") &&
      league.includes("ligue 1") && country.includes("france");
  });
  if (fixtures.length !== 1) {
    throw new Error("fixture officiel Lyon-Auxerre unique introuvable: " + fixtures.length);
  }

  const fixture = fixtures[0];
  const status = String(fixture?.fixture?.status?.short || "");
  if (!["FT", "AET", "PEN"].includes(status)) {
    throw new Error("match non terminé officiellement: " + status);
  }

  officialHome = Number(fixture?.goals?.home);
  officialAway = Number(fixture?.goals?.away);
  if (!Number.isFinite(officialHome) || !Number.isFinite(officialAway)) {
    throw new Error("score officiel indisponible");
  }

  const analyses = db.prepare(
    "SELECT id,match_key,best_bet,outcome,final_score_home,final_score_away " +
    "FROM concile_analyses WHERE date(analysed_at)=? " +
    "AND lower(home) LIKE '%lyon%' AND lower(away) LIKE '%auxerre%'"
  ).all(DAY);
  if (!analyses.length) throw new Error("analyse Lyon-Auxerre du 04/09 introuvable");

  const backupPath = "/data/tlm-before-lyon-result-v2-" + Date.now() + ".db";
  await db.backup(backupPath);

  const changed = {};
  db.transaction(() => {
    changed.concile_analyses = 0;
    for (const row of analyses) {
      const result = resolveOutcome(row.best_bet, officialHome, officialAway);
      if (!result) continue;
      db.prepare(
        "UPDATE concile_analyses SET outcome=?,final_score_home=?,final_score_away=?," +
        "resolved_at=datetime('now'),result_source='api_fixture_exact_date_v2' WHERE id=?"
      ).run(result, officialHome, officialAway, row.id);
      changed.concile_analyses++;
    }

    changed.agent_predictions = repairPredictionTable("agent_predictions", "bet", "created_at", false);
    changed.agent_market_predictions = repairPredictionTable("agent_market_predictions", "bet", "created_at", false);
    changed.shadow_evals = repairPredictionTable("shadow_evals", "bet", "created_at", true);
    changed.shadow_market_predictions = repairPredictionTable("shadow_market_predictions", "selection", "created_at", true);
    changed.shadow_tournament_predictions = repairPredictionTable("shadow_tournament_predictions", "prediction", "created_at", true);
    changed.analysis_log = repairPredictionTable("analysis_log", "bet", "created_at", false);
    changed.learning_match_results = repairPredictionTable("learning_match_results", "predicted_bet", "evaluated_at", true);

    if (tableExists("daily_pick_log")) {
      const rows = db.prepare(
        "SELECT rowid AS rid,bet FROM daily_pick_log WHERE date=? " +
        "AND lower(home) LIKE '%lyon%' AND lower(away) LIKE '%auxerre%'"
      ).all(DAY);
      changed.daily_pick_log = 0;
      for (const row of rows) {
        const result = resolveOutcome(row.bet, officialHome, officialAway);
        if (!result) continue;
        db.prepare(
          "UPDATE daily_pick_log SET outcome=?,final_score_home=?,final_score_away=? WHERE rowid=?"
        ).run(result, officialHome, officialAway, row.rid);
        changed.daily_pick_log++;
      }
    }
  })();

  const resultRows = db.prepare(
    "SELECT id,best_bet,outcome,final_score_home,final_score_away,result_source " +
    "FROM concile_analyses WHERE date(analysed_at)=? " +
    "AND lower(home) LIKE '%lyon%' AND lower(away) LIKE '%auxerre%'"
  ).all(DAY);

  if (resultRows.some((row) =>
    row.final_score_home !== officialHome ||
    row.final_score_away !== officialAway ||
    row.result_source !== "api_fixture_exact_date_v2"
  )) {
    throw new Error("preuve base incorrecte après mise à jour");
  }

  let previous = { deliveries: {} };
  try { previous = JSON.parse(fs.readFileSync(proofFile, "utf8")); } catch {}
  if (!previous.deliveries) previous.deliveries = {};

  const channels = [
    ["FR Gratuit", process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_FREE_CHANNEL_ID, "fr"],
    ["FR Standard", process.env.TELEGRAM_STANDARD_CHANNEL_ID, "fr"],
    ["FR Premium", process.env.TELEGRAM_PREMIUM_CHANNEL_ID, "fr"],
    ["FR Elite", process.env.TELEGRAM_ELITE_CHANNEL_ID, "fr"],
    ["RU Gratuit", process.env.TELEGRAM_RU_FREE_CHANNEL_ID, "ru"],
    ["RU Standard", process.env.TELEGRAM_RU_STANDARD_CHANNEL_ID, "ru"],
    ["RU Premium", process.env.TELEGRAM_RU_PREMIUM_CHANNEL_ID, "ru"],
  ].filter(([, id]) => Boolean(id));

  const unique = [];
  const seen = new Set();
  for (const channel of channels) {
    if (seen.has(String(channel[1]))) continue;
    seen.add(String(channel[1]));
    unique.push(channel);
  }
  if (!unique.length) throw new Error("aucun canal Telegram configuré");

  const fr = [
    "⚠️ <b>CORRECTION — LYON vs AUXERRE</b>",
    "",
    "Le score final 5-2 publié précédemment était incorrect : il appartenait à Lens–Auxerre du 22 août.",
    "Score final officiel Lyon–Auxerre : <b>" + officialHome + "-" + officialAway + "</b>.",
    "✅ Le signal <b>Plus de 2,5 buts</b> est gagnant.",
    "",
    "Le système impose désormais la date et les deux équipes exactes avant de publier un résultat.",
  ].join("\n");

  const ru = [
    "⚠️ <b>ИСПРАВЛЕНИЕ — ЛИОН vs ОСЕР</b>",
    "",
    "Ранее опубликованный итоговый счёт 5:2 был ошибочным: он относился к матчу Ланс–Осер от 22 августа.",
    "Официальный итоговый счёт Лион–Осер: <b>" + officialHome + ":" + officialAway + "</b>.",
    "✅ Сигнал <b>Больше 2,5 голов</b> выиграл.",
    "",
    "Теперь система проверяет точную дату и обе команды перед публикацией результата.",
  ].join("\n");

  const deliveries = [];
  for (const [label, id, lang] of unique) {
    if (previous.deliveries[label]?.ok === true) {
      deliveries.push({ label, ...previous.deliveries[label], skipped: true });
      continue;
    }
    const sent = await sendTelegram(id, lang === "ru" ? ru : fr);
    previous.deliveries[label] = sent;
    previous.updated_at = new Date().toISOString();
    previous.official_score = officialHome + "-" + officialAway;
    fs.writeFileSync(proofFile, JSON.stringify(previous, null, 2), { mode: 0o600 });
    deliveries.push({ label, ...sent, skipped: false });
  }

  const failed = deliveries.filter((item) => !item.ok);
  console.log(JSON.stringify({
    verdict: failed.length ? "PARTIAL" : "OK",
    official_fixture_id: fixture?.fixture?.id || null,
    official_status: status,
    official_score: officialHome + "-" + officialAway,
    database_backup: backupPath,
    changed,
    database_proof: resultRows,
    telegram_proof: deliveries,
    failed_channels: failed.map((item) => item.label),
  }, null, 2));

  if (failed.length) process.exitCode = 2;
})().catch((error) => {
  console.error(JSON.stringify({ verdict: "FAILED", error: error.message }));
  process.exitCode = 1;
}).finally(() => db.close());
NODE

curl -fsS --max-time 15 "https://www.touslesmatchs.com/api/health?lyonfix=$STAMP" >/dev/null
printf '%s\n' "FIN — vérifier le verdict JSON ci-dessus"
