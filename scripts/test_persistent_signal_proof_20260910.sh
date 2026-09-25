#!/usr/bin/env bash
set -euo pipefail

# Test integralement hors reseau : persistance du point de reference apres
# redemarrage logique et revendication atomique d'une notification unique.
proof_db="$(mktemp /tmp/tlm-signal-proof.XXXXXX.db)"
trap 'rm -f "$proof_db"' EXIT

sqlite3 "$proof_db" <<'SQL'
CREATE TABLE agent_calls(id INTEGER PRIMARY KEY);
CREATE TABLE concile_analyses(id INTEGER PRIMARY KEY);
CREATE TABLE telegram_signal_deliveries(id INTEGER PRIMARY KEY);
CREATE TABLE signal_proof_objective (
  id INTEGER PRIMARY KEY CHECK(id=1), objective TEXT NOT NULL, started_at TEXT NOT NULL,
  baseline_call_id INTEGER NOT NULL, baseline_analysis_id INTEGER NOT NULL,
  baseline_delivery_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  match_key TEXT DEFAULT NULL, proof_json TEXT DEFAULT '{}', notified_at TEXT DEFAULT NULL,
  notification_ok INTEGER DEFAULT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE signal_delivery_expectations (
  match_key TEXT NOT NULL, channel TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY(match_key, channel)
);
INSERT INTO agent_calls VALUES (10);
INSERT INTO concile_analyses VALUES (20);
INSERT INTO telegram_signal_deliveries VALUES (30);
INSERT OR IGNORE INTO signal_proof_objective
  (id,objective,started_at,baseline_call_id,baseline_analysis_id,baseline_delivery_id,status,updated_at)
  SELECT 1,'preuve naturelle',datetime('now'),MAX(agent_calls.id),MAX(concile_analyses.id),MAX(telegram_signal_deliveries.id),'pending',datetime('now')
  FROM agent_calls,concile_analyses,telegram_signal_deliveries;
INSERT INTO agent_calls VALUES (11);
INSERT INTO concile_analyses VALUES (21);
INSERT INTO telegram_signal_deliveries VALUES (31);
-- Simulation du redemarrage : INSERT OR IGNORE doit conserver 10/20/30.
INSERT OR IGNORE INTO signal_proof_objective
  (id,objective,started_at,baseline_call_id,baseline_analysis_id,baseline_delivery_id,status,updated_at)
  VALUES (1,'preuve naturelle',datetime('now'),11,21,31,'pending',datetime('now'));
INSERT INTO signal_delivery_expectations(match_key,channel) VALUES
  ('natural-1','standard'),('natural-1','ru_standard'),('natural-1','premium'),('natural-1','ru_premium');
SQL

test "$(sqlite3 "$proof_db" 'SELECT baseline_call_id||"/"||baseline_analysis_id||"/"||baseline_delivery_id FROM signal_proof_objective')" = "10/20/30"
test "$(sqlite3 "$proof_db" 'SELECT count(*) FROM signal_delivery_expectations')" = "4"

first="$(sqlite3 "$proof_db" "UPDATE signal_proof_objective SET status='complete',match_key='natural-1',notified_at=datetime('now') WHERE id=1 AND status='pending' AND notified_at IS NULL; SELECT changes();")"
second="$(sqlite3 "$proof_db" "UPDATE signal_proof_objective SET status='complete',match_key='natural-1',notified_at=datetime('now') WHERE id=1 AND status='pending' AND notified_at IS NULL; SELECT changes();")"
test "$first" = "1"
test "$second" = "0"

echo "OK persistent-signal-proof: baseline durable, attentes FR/RU persistantes, notification exactement une fois"
