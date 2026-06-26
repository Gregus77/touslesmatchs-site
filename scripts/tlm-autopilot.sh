#!/usr/bin/env bash
# TousLesMatchs - VPS autopilot guard.
# Default mode is read-only:
#   bash scripts/tlm-autopilot.sh --check
#
# Apply validated GitHub corrections and refresh the full stack:
#   bash scripts/tlm-autopilot.sh --apply
#
# The script never prints secrets. It backs up data before any code reset.
set -Eeuo pipefail

ROOT="${TLM_ROOT:-/opt/touslesmatchs}"
BRANCH="${TLM_BRANCH:-claude/happy-bell-h9zj83}"
SERVICES="${TLM_SERVICES:-site api hermes-admin}"
MODE="check"
REPORT_DIR="${TLM_REPORT_DIR:-/var/log/touslesmatchs}"
REPORT_FILE="$REPORT_DIR/autopilot-last-report.log"
AUDIT_FILE="${TLM_AUDIT_FILE:-$ROOT/AUDIT_HERMES_TOUSLESMATCHS.md}"

for arg in "$@"; do
  case "$arg" in
    --check) MODE="check" ;;
    --apply) MODE="apply" ;;
    --help|-h)
      sed -n '1,44p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

ok() { printf 'OK   %s\n' "$*"; }
warn() { printf 'WARN %s\n' "$*"; }
fail() { printf 'FAIL %s\n' "$*" >&2; exit 1; }
step() { printf '\n== %s ==\n' "$*"; }

append_audit() {
  printf '%s\n' "$*" >> "$AUDIT_FILE"
}

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

compose() {
  docker compose "$@"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is not installed or not in PATH"
}

load_env() {
  [ -f "$ROOT/.env" ] || fail "$ROOT/.env not found"
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
}

check_env() {
  step "Environment"
  local important=(
    HERMES_ADMIN_TLM_BOT
    TELEGRAM_ADMIN_CHAT_ID
    TELEGRAM_FREE_CHANNEL_ID
    TELEGRAM_PREMIUM_CHANNEL_ID
    DEEPSEEK_API_KEY
    GROQ_API_KEY
    API_SPORTS_KEY
    FOOTBALL_DATA_KEY
    BREVO_API_KEY
    STRIPE_SECRET_KEY
    STRIPE_PRICE_ID_CARTE
    STRIPE_PRICE_ID_PREMIUM
    STRIPE_PRICE_ID_ELITE
    STRIPE_WEBHOOK_SECRET
  )
  local missing=0
  for name in "${important[@]}"; do
    local value="${!name:-}"
    if [ -z "$value" ]; then
      echo "MISSING $name"
      missing=1
    else
      echo "OK      $name=$(mask "$value")"
    fi
  done
  [ "$missing" -eq 0 ] || warn "Some env vars are missing. Fix money/email/Telegram flows before selling hard."
}

backup_data() {
  step "Data backup"
  local backup_dir="$ROOT/backups/autopilot-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$backup_dir"
  cp -a "$ROOT/data" "$backup_dir/data" 2>/dev/null || true
  cp -a "$ROOT/public/data" "$backup_dir/public-data" 2>/dev/null || true
  cp -a "/var/touslesmatchs" "$backup_dir/var-touslesmatchs" 2>/dev/null || true
  ok "Backup created: $backup_dir"
}

init_audit_file() {
  mkdir -p "$(dirname "$AUDIT_FILE")"
  cat > "$AUDIT_FILE" <<EOF
# AUDIT HERMES TOUSLESMATCHS

Date: $(date -Is)
Mode: $MODE
Branche: $BRANCH
Serveur: VPS Hostinger

## Resume executif

- Orange: audit automatique en cours depuis le VPS.
- Vert/Rouge: voir les sections detaillees ci-dessous.

EOF
  ok "Audit file initialized: $AUDIT_FILE"
}

audit_system() {
  step "Hostinger VPS audit"
  append_audit "## Systeme"
  append_audit ""
  append_audit '```text'
  {
    echo "hostname=$(hostname 2>/dev/null || true)"
    echo "kernel=$(uname -a 2>/dev/null || true)"
    if [ -f /etc/os-release ]; then
      grep -E '^(PRETTY_NAME|VERSION)=' /etc/os-release || true
    fi
    echo "uptime=$(uptime 2>/dev/null || true)"
    echo "disk="
    df -h / "$ROOT" 2>/dev/null || true
    echo "memory="
    free -h 2>/dev/null || true
  } | tee -a "$AUDIT_FILE"
  append_audit '```'
  append_audit ""
}

audit_git() {
  step "Git audit"
  append_audit "## Git"
  append_audit ""
  append_audit '```text'
  {
    git status --short || true
    git branch --show-current || true
    git rev-parse --short HEAD || true
    git --no-pager log --oneline -5 || true
  } | tee -a "$AUDIT_FILE"
  append_audit '```'
  append_audit ""
}

audit_docker() {
  step "Docker audit"
  append_audit "## Docker"
  append_audit ""
  append_audit '```text'
  {
    docker --version || true
    compose ps || true
  } | tee -a "$AUDIT_FILE"
  append_audit '```'
  append_audit ""
}

sync_code() {
  step "Git sync"
  if [ "$MODE" != "apply" ]; then
    warn "Read-only check. Use --apply to fetch/reset/rebuild."
    git fetch origin "$BRANCH" >/dev/null 2>&1 || warn "Fetch failed in check mode"
    git --no-pager log --oneline -5 "HEAD..origin/$BRANCH" 2>/dev/null || true
    return
  fi
  backup_data
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
  ok "Code synced to origin/$BRANCH"
}

rebuild_stack() {
  step "Docker stack"
  if [ "$MODE" != "apply" ]; then
    compose ps
    return
  fi
  compose up -d --build $SERVICES
  compose ps
}

ensure_hermes_learning() {
  step "Hermes learning guard"
  if [ "$MODE" != "apply" ]; then
    if [ -f /etc/cron.d/touslesmatchs-hermes-learning ]; then
      ok "Learning cron is installed"
    else
      warn "Learning cron is missing. Use --apply to install it."
    fi
    return
  fi
  if [ -x "$ROOT/scripts/hostinger-hermes-install.sh" ]; then
    bash "$ROOT/scripts/hostinger-hermes-install.sh"
  else
    warn "hostinger-hermes-install.sh missing or not executable"
  fi
}

refresh_memory() {
  step "Hermes memory"
  if [ "$MODE" != "apply" ]; then
    warn "Memory refresh skipped in check mode. Use --apply to regenerate it."
    return
  fi
  if compose exec -T hermes-admin node scripts/hermes_learn.js; then
    ok "Hermes memory regenerated"
  else
    warn "Hermes memory regeneration failed"
  fi
}

check_memory() {
  step "Learning snapshot"
  append_audit "## Etat reel Hermes"
  append_audit ""
  append_audit '```text'
  compose exec -T hermes-admin sh -lc '
    node - <<'"'"'NODE'"'"'
const fs = require("fs");
const p = "/repo/data/hermes_memory.json";
if (!fs.existsSync(p)) {
  console.log("memory=missing");
  process.exit(0);
}
const m = JSON.parse(fs.readFileSync(p, "utf8"));
console.log("generated_at=" + (m.generated_at || "missing"));
console.log("picks_analysed=" + (m.picks_analysed || 0));
console.log("winrate=" + (m.general?.winrate ?? "n/a"));
console.log("roi=" + (m.general?.roi ?? "n/a"));
console.log("rules=" + ((m.rules_derived || []).length));
console.log("with_league=" + (m.data_quality?.with_league ?? "n/a"));
console.log("with_cote=" + (m.data_quality?.with_cote ?? "n/a"));
NODE
  ' | tee -a "$AUDIT_FILE" || warn "Memory snapshot unavailable"
  append_audit '```'
  append_audit ""
}

check_current_pick() {
  step "Current pick"
  append_audit "## Pick courant et stockage"
  append_audit ""
  append_audit '```text'
  compose exec -T api node - <<'NODE' | tee -a "$AUDIT_FILE" || true
const fs = require("fs");
const paths = ["/picks/picks.json", "/var/touslesmatchs/current_pick.json"];
for (const p of paths) {
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  const pick = data.currentPick || data.pick || data;
  console.log("source=" + p);
  console.log("match=" + [pick.home, pick.away].filter(Boolean).join(" vs "));
  console.log("league=" + (pick.league || pick.competition || ""));
  console.log("bet=" + (pick.prono || pick.bet || ""));
  console.log("confidence=" + (pick.confidence || pick.confidenceTg || ""));
  break;
}
NODE
  append_audit '```'
  append_audit ""
}

check_public_api() {
  step "Public API"
  append_audit "## API publique"
  append_audit ""
  append_audit '```text'
  if command -v curl >/dev/null 2>&1; then
    curl -fsS "https://www.touslesmatchs.com/api/current-pick" | head -c 700 | tee -a "$AUDIT_FILE" || warn "public current-pick unreachable"
    printf '\n' | tee -a "$AUDIT_FILE"
  else
    warn "curl not installed"
    append_audit "curl missing"
  fi
  append_audit '```'
  append_audit ""
}

check_logs() {
  step "Recent warnings"
  append_audit "## Logs recents utiles"
  append_audit ""
  append_audit '```text'
  compose logs --tail 120 api hermes-admin 2>/dev/null | grep -Ei "error|erreur|warn|brevo|stripe|telegram|pick-notify|auto-concile" | tee -a "$AUDIT_FILE" || true
  append_audit '```'
  append_audit ""
}

write_report() {
  mkdir -p "$REPORT_DIR"
  {
    echo "TousLesMatchs autopilot"
    echo "date=$(date -Is)"
    echo "mode=$MODE"
    echo "branch=$BRANCH"
    echo "services=$SERVICES"
    echo
    compose ps || true
  } > "$REPORT_FILE"
  append_audit "## Verdict provisoire"
  append_audit ""
  append_audit "- Hermes: verifier les sorties /diagtelegram, /learn, /status."
  append_audit "- Site: verifier /api/current-pick et la page d'accueil apres rebuild."
  append_audit "- Argent: Stripe et Brevo doivent etre verts avant publicite."
  append_audit "- Donnees: aucun pick ne doit etre invente; NO BET si donnees insuffisantes."
  append_audit ""
  append_audit "## Commandes Telegram finales"
  append_audit ""
  append_audit '```text'
  append_audit "/diagtelegram"
  append_audit "/learn"
  append_audit "/status"
  append_audit '```'
  ok "Report saved: $REPORT_FILE"
  ok "Audit saved: $AUDIT_FILE"
}

main() {
  echo "Je lance un audit complet du projet TousLesMatchs sur VPS Hostinger. Je vais d'abord identifier ce qui est reellement en place, puis mettre en place directement ce qui manque, avec sauvegarde et verification."
  [ -d "$ROOT" ] || fail "$ROOT does not exist"
  cd "$ROOT"
  require_cmd docker
  require_cmd git
  init_audit_file
  audit_system
  audit_git
  audit_docker
  load_env
  check_env
  sync_code
  rebuild_stack
  ensure_hermes_learning
  refresh_memory
  check_memory
  check_current_pick
  check_public_api
  check_logs
  write_report
  step "Next Telegram checks"
  echo "Run in Hermes admin: /diagtelegram then /learn then /status"
  ok "Autopilot finished in $MODE mode"
}

main "$@"
