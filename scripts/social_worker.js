"use strict";

const fs = require("fs");
const Database = require("better-sqlite3");
const { dispatchSocialEvent } = require("./social_dispatcher");

const DB_PATH = process.env.SOCIAL_DB_PATH || "/data/tlm.db";
const POLL_MS = Math.max(30000, Number(process.env.SOCIAL_POLL_MS || 60000));
const LOOKBACK_HOURS = Math.max(6, Number(process.env.SOCIAL_LOOKBACK_HOURS || 72));
const SIGNAL_SOURCE = String(process.env.SOCIAL_SIGNAL_SOURCE || "free").toLowerCase();
const TELEGRAM_IMAGES = String(process.env.SOCIAL_TELEGRAM_IMAGE_ENABLED || "true").toLowerCase() === "true";

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function bool(v) { return Number(v || 0) === 1 || v === true; }

function openDb() {
  if (!fs.existsSync(DB_PATH)) throw new Error(`DB absente: ${DB_PATH}`);
  return new Database(DB_PATH, { readonly: true, fileMustExist: true });
}

function tableColumns(db, table) {
  try { return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(r => r.name)); }
  catch (_) { return new Set(); }
}

function pickExpr(cols, name, fallback = "NULL") {
  return cols.has(name) ? name : `${fallback} AS ${name}`;
}

function signalPredicate(cols) {
  if (SIGNAL_SOURCE === "standard" && cols.has("sig_sent_standard")) return "COALESCE(sig_sent_standard,0)=1";
  if (SIGNAL_SOURCE === "premium" && cols.has("sig_sent_premium")) return "COALESCE(sig_sent_premium,0)=1";
  if (SIGNAL_SOURCE === "any") {
    const fields = ["sig_sent_free", "sig_sent_standard", "sig_sent_premium"].filter(c => cols.has(c));
    return fields.length ? `(${fields.map(f => `COALESCE(${f},0)=1`).join(" OR ")})` : "0=1";
  }
  if (cols.has("sig_sent_free")) return "COALESCE(sig_sent_free,0)=1";
  if (cols.has("sig_sent_standard")) return "COALESCE(sig_sent_standard,0)=1";
  return "0=1";
}

function getRows(db) {
  const cols = tableColumns(db, "concile_analyses");
  if (!cols.size) throw new Error("Table concile_analyses introuvable");

  const analysedAt = cols.has("analysed_at") ? "analysed_at" : "datetime('now')";
  const fields = [
    pickExpr(cols, "id", "rowid"),
    pickExpr(cols, "match_key", "''"),
    pickExpr(cols, "home", "''"),
    pickExpr(cols, "away", "''"),
    pickExpr(cols, "competition", "''"),
    pickExpr(cols, "sport", "'Football'"),
    pickExpr(cols, "best_bet", "''"),
    pickExpr(cols, "confidence", "0"),
    pickExpr(cols, "consensus_votes", "0"),
    pickExpr(cols, "analysed_at", "datetime('now')"),
    pickExpr(cols, "outcome", "NULL"),
    pickExpr(cols, "final_score_home", "NULL"),
    pickExpr(cols, "final_score_away", "NULL"),
    pickExpr(cols, "resolved_at", "NULL"),
    pickExpr(cols, "sig_sent_free", "0"),
    pickExpr(cols, "sig_sent_standard", "0"),
    pickExpr(cols, "sig_sent_premium", "0"),
  ];

  const pred = signalPredicate(cols);
  return db.prepare(`
    SELECT ${fields.join(", ")}
    FROM concile_analyses
    WHERE ${analysedAt} >= datetime('now', '-${LOOKBACK_HOURS} hours')
      AND ${pred}
    ORDER BY datetime(${analysedAt}) ASC, id ASC
    LIMIT 250
  `).all();
}

function eventFromRow(row) {
  return {
    eventKey: String(row.match_key || row.id),
    matchKey: row.match_key || null,
    home: row.home,
    away: row.away,
    competition: row.competition || row.sport || "Football",
    country: "",
    sport: row.sport || "Football",
    bet: row.best_bet || "",
    confidence: Number(row.confidence || 0),
    consensusVotes: Number(row.consensus_votes || 0),
    analysedAt: row.analysed_at || null,
    kickoff: null,
    outcome: row.outcome || null,
    finalScoreHome: row.final_score_home,
    finalScoreAway: row.final_score_away,
    finalScore: (row.final_score_home != null && row.final_score_away != null)
      ? `${row.final_score_home} - ${row.final_score_away}` : "",
    resolvedAt: row.resolved_at || null,
    source: "concile_analyses",
    sent: {
      free: bool(row.sig_sent_free),
      standard: bool(row.sig_sent_standard),
      premium: bool(row.sig_sent_premium),
    },
  };
}

async function scanOnce() {
  const db = openDb();
  let rows;
  try { rows = getRows(db); }
  finally { db.close(); }

  let signals = 0;
  let results = 0;
  for (const row of rows) {
    const event = eventFromRow(row);
    try {
      const signal = await dispatchSocialEvent(event, { stage: "signal", telegram: TELEGRAM_IMAGES });
      if (!signal.duplicate && signal.ok) {
        signals++;
        console.log(`[social-worker] signal ${event.home} — ${event.away}: Telegram=${signal.telegram?.ok ? "OK" : signal.telegram?.skipped ? "SKIP" : "KO"} Instagram=${signal.instagram?.ok ? "OK" : signal.instagram?.skipped ? "SKIP" : "KO"} TikTok=${signal.tiktok?.queued ? "QUEUE" : "KO"}`);
      }

      const resolved = event.outcome === "win" || event.outcome === "loss";
      if (resolved && event.finalScore) {
        const result = await dispatchSocialEvent(event, { stage: "result", telegram: TELEGRAM_IMAGES });
        if (!result.duplicate && result.ok) {
          results++;
          console.log(`[social-worker] result ${event.home} — ${event.away}: ${event.outcome} ${event.finalScore}`);
        }
      }
    } catch (e) {
      console.error(`[social-worker] ${event.home} — ${event.away}: ${e.message}`);
    }
  }
  return { rows: rows.length, signals, results };
}

async function main() {
  console.log(`[social-worker] start · DB=${DB_PATH} · source=${SIGNAL_SOURCE} · telegramImages=${TELEGRAM_IMAGES} · poll=${POLL_MS}ms`);
  for (;;) {
    try {
      const r = await scanOnce();
      if (r.signals || r.results) console.log(`[social-worker] cycle: ${r.rows} rows · ${r.signals} signaux · ${r.results} résultats`);
    } catch (e) {
      console.error(`[social-worker] cycle KO: ${e.message}`);
    }
    await sleep(POLL_MS);
  }
}

if (require.main === module) {
  main().catch(e => { console.error("[social-worker] fatal:", e); process.exit(1); });
}

module.exports = { scanOnce, getRows, eventFromRow };
