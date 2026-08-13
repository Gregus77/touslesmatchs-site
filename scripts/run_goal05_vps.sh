#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${TLM_ROOT:-/opt/touslesmatchs}"
cd "$ROOT"

LOG_DIR="${GOAL05_LOG_DIR:-$ROOT/logs}"
mkdir -p "$LOG_DIR"

LOCK_DIR="${GOAL05_LOCK_DIR:-/tmp/tlm-goal05-scan.lock}"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date -Is)] Goal +0,5 deja en cours, sortie propre."
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi

export GOAL05_SEND_TELEGRAM="${GOAL05_SEND_TELEGRAM:-1}"
export GOAL05_SEND_ADMIN_WATCHLIST="${GOAL05_SEND_ADMIN_WATCHLIST:-1}"
export GOAL05_SCAN_DAYS_AHEAD="${GOAL05_SCAN_DAYS_AHEAD:-3}"
export GOAL05_ODDS_PAGES="${GOAL05_ODDS_PAGES:-3}"
export GOAL05_MAX_DEEP_CANDIDATES="${GOAL05_MAX_DEEP_CANDIDATES:-6}"
export GOAL05_MAX_EVENT_CALLS="${GOAL05_MAX_EVENT_CALLS:-2}"
export GOAL05_API_DELAY_MS="${GOAL05_API_DELAY_MS:-2500}"
export GOAL05_RATE_LIMIT_WAIT_MS="${GOAL05_RATE_LIMIT_WAIT_MS:-70000}"

echo "[$(date -Is)] Demarrage Goal +0,5 autonome - jours=$GOAL05_SCAN_DAYS_AHEAD pages=$GOAL05_ODDS_PAGES deep=$GOAL05_MAX_DEEP_CANDIDATES"

for offset in $(seq 0 "$GOAL05_SCAN_DAYS_AHEAD"); do
  day="$(date -d "+$offset day" +%F)"
  echo "[$(date -Is)] Scan Goal +0,5 - $day"
  GOAL05_SCAN_DATE="$day" node scripts/goal05_api_scan.js
done

echo "[$(date -Is)] Fin Goal +0,5 autonome"
