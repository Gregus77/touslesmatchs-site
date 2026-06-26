#!/usr/bin/env bash
# TousLesMatchs - Hostinger/VPS Hermes installer and health guard.
# Run on the VPS as root from any directory:
#   bash /opt/touslesmatchs/scripts/hostinger-hermes-install.sh
#
# Optional:
#   bash scripts/hostinger-hermes-install.sh --update-code
#
# This script is idempotent: it can be run again safely.
set -Eeuo pipefail

ROOT="${TLM_ROOT:-/opt/touslesmatchs}"
BRANCH="${TLM_BRANCH:-claude/happy-bell-h9zj83}"
CRON_FILE="/etc/cron.d/touslesmatchs-hermes-learning"
LOG_FILE="/var/log/touslesmatchs-hermes-learning.log"
UPDATE_CODE=0

for arg in "$@"; do
  case "$arg" in
    --update-code) UPDATE_CODE=1 ;;
    --help|-h)
      sed -n '1,40p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

ok() { printf 'OK  %s\n' "$*"; }
warn() { printf 'WARN %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }

mask() {
  local value="${1:-}"
  if [ -z "$value" ]; then
    printf '(missing)'
  elif [ "${#value}" -le 10 ]; then
    printf '%s****' "${value:0:3}"
  else
    printf '%s****%s' "${value:0:6}" "${value: -4}"
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is not installed or not in PATH"
}

compose() {
  docker compose "$@"
}

load_env() {
  if [ ! -f "$ROOT/.env" ]; then
    fail "$ROOT/.env not found. Add VPS secrets before installing Hermes."
  fi
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
}

check_env() {
  echo
  echo "== Environment =="
  local required=(
    HERMES_ADMIN_TLM_BOT
    TELEGRAM_ADMIN_CHAT_ID
    TELEGRAM_FREE_CHANNEL_ID
    TELEGRAM_PREMIUM_CHANNEL_ID
    DEEPSEEK_API_KEY
    GROQ_API_KEY
    BREVO_API_KEY
  )
  local optional=(
    FOOTBALL_DATA_KEY
    FOOTBALL_DATA_API_KEY
    API_SPORTS_KEY
    OPENAI_API_KEY
  )
  local missing=0
  for name in "${required[@]}"; do
    local value="${!name:-}"
    if [ -z "$value" ]; then
      echo "MISSING $name"
      missing=1
    else
      echo "OK      $name=$(mask "$value")"
    fi
  done
  for name in "${optional[@]}"; do
    local value="${!name:-}"
    if [ -z "$value" ]; then
      echo "OPTION  $name=(missing)"
    else
      echo "OK      $name=$(mask "$value")"
    fi
  done
  [ "$missing" -eq 0 ] || fail "Required environment variables are missing."
}

update_code_if_requested() {
  if [ "$UPDATE_CODE" -ne 1 ]; then
    warn "Code update skipped. Use --update-code after Codex validation if needed."
    return
  fi

  echo
  echo "== Git update =="
  cd "$ROOT"
  local backup_dir="$ROOT/backups/pre-hermes-install-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$backup_dir"
  cp -a "$ROOT/data" "$backup_dir/data" 2>/dev/null || true
  cp -a "$ROOT/public/data" "$backup_dir/public-data" 2>/dev/null || true
  ok "Data backup: $backup_dir"

  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  ok "Code synced to origin/$BRANCH"
}

ensure_dirs() {
  echo
  echo "== Directories =="
  mkdir -p "$ROOT/data" "$ROOT/public/data" "$ROOT/public/generated" /var/touslesmatchs
  touch "$LOG_FILE"
  ok "Data directories ready"
}

start_hermes() {
  echo
  echo "== Docker Hermes =="
  cd "$ROOT"
  compose up -d --build hermes-admin
  compose ps hermes-admin
  local running
  running="$(docker inspect --format '{{.State.Running}}' touslesmatchs-hermes-admin 2>/dev/null || true)"
  [ "$running" = "true" ] || fail "Hermes container is not running."
  local restarts started
  restarts="$(docker inspect --format '{{.RestartCount}}' touslesmatchs-hermes-admin 2>/dev/null || echo 0)"
  started="$(docker inspect --format '{{.State.StartedAt}}' touslesmatchs-hermes-admin 2>/dev/null || echo unknown)"
  echo "Hermes restart_count=$restarts"
  echo "Hermes started_at=$started"
  ok "Hermes container is running"
}

install_learning_cron() {
  echo
  echo "== Learning cron =="
  cat > "$CRON_FILE" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Regenerate Hermes memory from all structured stats every hour on the VPS.
17 * * * * root cd $ROOT && docker compose exec -T hermes-admin node scripts/hermes_learn.js >> $LOG_FILE 2>&1
EOF
  chmod 0644 "$CRON_FILE"
  ok "Installed $CRON_FILE"
}

run_learning_once() {
  echo
  echo "== Learning now =="
  cd "$ROOT"
  if compose exec -T hermes-admin node scripts/hermes_learn.js; then
    ok "Hermes memory regenerated"
  else
    fail "Hermes learning failed"
  fi
}

check_memory() {
  echo
  echo "== Memory =="
  cd "$ROOT"
  compose exec -T hermes-admin sh -lc '
    if [ ! -f /repo/data/hermes_memory.json ]; then
      echo "MEMORY_MISSING"
      exit 1
    fi
    node - <<'"'"'NODE'"'"'
const fs = require("fs");
const m = JSON.parse(fs.readFileSync("/repo/data/hermes_memory.json", "utf8"));
console.log("generated_at=" + (m.generated_at || "missing"));
console.log("picks_analysed=" + (m.picks_analysed || 0));
console.log("winrate=" + (m.general?.winrate ?? "n/a"));
console.log("rules=" + ((m.rules_derived || []).length));
console.log("with_league=" + (m.data_quality?.with_league ?? "n/a"));
console.log("with_cote=" + (m.data_quality?.with_cote ?? "n/a"));
NODE
  '
}

telegram_diag_hint() {
  echo
  echo "== Telegram checks =="
  echo "In the Hermes admin Telegram group, run:"
  echo "  /diagtelegram"
  echo "  /learn"
  echo "  /status"
}

main() {
  [ "$(id -u)" -eq 0 ] || fail "Run as root on the VPS."
  [ -d "$ROOT" ] || fail "$ROOT does not exist."
  require_cmd docker
  require_cmd git
  load_env
  check_env
  update_code_if_requested
  ensure_dirs
  start_hermes
  install_learning_cron
  run_learning_once
  check_memory
  telegram_diag_hint
  echo
  ok "Hermes is installed on the VPS and learning is scheduled remotely."
}

main "$@"
