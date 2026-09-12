"use strict";

const EARLY_MIN = 15;
const EARLY_MAX = 35;
const LATE_MIN = 40;
const LATE_MAX = 45;
const MIN_CONFIDENCE = 77;
const MIN_CONSENSUS = 3;
const MIN_ODD = 1.45;
const MAX_ODD = 1.65;
const MIN_SAMPLE = 20;

function normalizeSelection(value) {
  const text = String(value || "").toLowerCase().replace(",", ".");
  if (/\b(over|plus de)\s*2\.5\b/.test(text)) return "Over 2.5 buts";
  if (/\b(under|moins de)\s*2\.5\b/.test(text)) return "Under 2.5 buts";
  return null;
}

function realOdd(value, source) {
  const odd = Number(value);
  if (!Number.isFinite(odd) || odd <= 1) return null;
  if (!source || /estimation|indisponible|estimate/i.test(String(source))) return null;
  return Math.round(odd * 100) / 100;
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS halftime_entry_shadow (
      match_key TEXT PRIMARY KEY,
      home TEXT NOT NULL,
      away TEXT NOT NULL,
      competition TEXT DEFAULT '',
      early_minute INTEGER NOT NULL,
      early_selection TEXT NOT NULL,
      early_confidence INTEGER NOT NULL,
      early_consensus INTEGER NOT NULL,
      early_score_home INTEGER,
      early_score_away INTEGER,
      early_context_json TEXT DEFAULT '{}',
      late_minute INTEGER,
      late_selection TEXT,
      late_confidence INTEGER,
      late_consensus INTEGER,
      late_score_home INTEGER,
      late_score_away INTEGER,
      late_odd REAL,
      late_odd_source TEXT,
      late_context_json TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'candidate',
      rejection_reason TEXT,
      outcome TEXT,
      final_score_home INTEGER,
      final_score_away INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_halftime_shadow_status
      ON halftime_entry_shadow(status, created_at);
  `);
}

function observe(db, input) {
  ensureSchema(db);
  const minute = Number(input.minute);
  const selection = normalizeSelection(input.selection);
  const confidence = Number(input.confidence || 0);
  const consensus = Number(input.consensus || 0);
  if (!input.matchKey || !selection || !Number.isInteger(minute)) return { action: "ignored" };

  if (minute >= EARLY_MIN && minute <= EARLY_MAX) {
    if (confidence < MIN_CONFIDENCE || consensus < MIN_CONSENSUS) return { action: "ignored" };
    db.prepare(`INSERT OR IGNORE INTO halftime_entry_shadow
      (match_key,home,away,competition,early_minute,early_selection,early_confidence,
       early_consensus,early_score_home,early_score_away,early_context_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      input.matchKey, input.home || "", input.away || "", input.competition || "",
      minute, selection, confidence, consensus, input.scoreHome ?? null, input.scoreAway ?? null,
      JSON.stringify(input.context || {})
    );
    return { action: "candidate" };
  }

  if (minute < LATE_MIN || minute > LATE_MAX) return { action: "ignored" };
  const candidate = db.prepare("SELECT * FROM halftime_entry_shadow WHERE match_key=?").get(input.matchKey);
  if (!candidate || candidate.outcome) return { action: "ignored" };

  const odd = realOdd(input.odd, input.oddSource);
  let status = "qualified";
  let reason = null;
  if (selection !== candidate.early_selection) {
    status = "rejected"; reason = "direction_changed";
  } else if (confidence < MIN_CONFIDENCE) {
    status = "rejected"; reason = "confidence_below_77";
  } else if (consensus < MIN_CONSENSUS) {
    status = "rejected"; reason = "consensus_below_3";
  } else if (odd === null) {
    status = "waiting_odds"; reason = "real_odd_missing";
  } else if (odd < MIN_ODD || odd > MAX_ODD) {
    status = "waiting_odds"; reason = "odd_outside_1.45_1.65";
  }

  db.prepare(`UPDATE halftime_entry_shadow SET
    late_minute=?,late_selection=?,late_confidence=?,late_consensus=?,
    late_score_home=?,late_score_away=?,late_odd=?,late_odd_source=?,late_context_json=?,
    status=?,rejection_reason=?,updated_at=datetime('now') WHERE match_key=?`).run(
    minute, selection, confidence, consensus, input.scoreHome ?? null, input.scoreAway ?? null,
    odd, odd === null ? null : String(input.oddSource), JSON.stringify(input.context || {}),
    status, reason, input.matchKey
  );
  return { action: status, reason };
}

function token(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function resolve(db, input) {
  ensureSchema(db);
  const rows = db.prepare(`SELECT * FROM halftime_entry_shadow
    WHERE status='qualified' AND outcome IS NULL AND created_at>=datetime('now','-30 days')`).all();
  const total = Number(input.scoreHome) + Number(input.scoreAway);
  let changed = 0;
  const update = db.prepare(`UPDATE halftime_entry_shadow SET outcome=?,final_score_home=?,
    final_score_away=?,resolved_at=datetime('now'),updated_at=datetime('now')
    WHERE match_key=? AND outcome IS NULL`);
  for (const row of rows) {
    if (token(row.home) !== token(input.home) || token(row.away) !== token(input.away)) continue;
    if (input.resolutionDay && String(row.created_at).slice(0, 10) !== input.resolutionDay) continue;
    const won = row.late_selection === "Over 2.5 buts" ? total > 2.5 : total < 2.5;
    changed += update.run(won ? "win" : "loss", Number(input.scoreHome), Number(input.scoreAway), row.match_key).changes;
  }
  return changed;
}

function report(db) {
  ensureSchema(db);
  const totals = db.prepare(`SELECT COUNT(*) candidates,
    SUM(status='qualified') qualified,SUM(status='waiting_odds') waiting_odds,
    SUM(status='rejected') rejected,SUM(outcome='win') wins,SUM(outcome='loss') losses,
    ROUND(SUM(CASE WHEN outcome='win' THEN late_odd-1 WHEN outcome='loss' THEN -1 ELSE 0 END),3) profit_units
    FROM halftime_entry_shadow`).get();
  const resolved = Number(totals.wins || 0) + Number(totals.losses || 0);
  return {
    mode: "shadow_only",
    telegram_delivery: false,
    rules: { early_window: "15-35", revalidation_window: "40-45", min_confidence: MIN_CONFIDENCE,
      min_consensus: MIN_CONSENSUS, odds_window: [MIN_ODD, MAX_ODD], minimum_resolved_sample: MIN_SAMPLE },
    totals: { ...totals, resolved, roi_percent: resolved ? Math.round((Number(totals.profit_units || 0) / resolved) * 10000) / 100 : null },
    conclusion: resolved < MIN_SAMPLE ? `collecte_en_cours_${resolved}_sur_${MIN_SAMPLE}` : "echantillon_minimum_atteint_revision_humaine_requise"
  };
}

module.exports = { ensureSchema, observe, resolve, report, normalizeSelection, realOdd };
