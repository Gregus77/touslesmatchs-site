#!/usr/bin/env bash
set -Eeuo pipefail

TARGET="${1:?target commit required}"
ROOT=/opt/touslesmatchs
cd "$ROOT"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/opt/backups/goal05-current-product-$STAMP"
install -d -m 700 "$BACKUP/public" "$BACKUP/docs"

test "$(git branch --show-current)" = "main"
test "$(git rev-parse --abbrev-ref '@{upstream}')" = "origin/main"
git fetch origin main
OLD_HEAD="$(git rev-parse HEAD)"
git merge-base --is-ancestor "$OLD_HEAD" "$TARGET"

TRACKED="$(git status --porcelain --untracked-files=no | sed -E 's/^...//')"
if [[ -n "$TRACKED" ]]; then
  if [[ "$TRACKED" == "shared/vps-status.json" ]]; then
    install -D -m 600 shared/vps-status.json "$BACKUP/shared/vps-status.json"
    git restore --worktree --staged -- shared/vps-status.json
  else
    printf '%s\n' "$TRACKED" > "$BACKUP/blocked-tracked-files.txt"
    echo "STOP: unexpected tracked VPS changes"
    exit 41
  fi
fi

for f in public/index.html public/app.html public/live-ia.html public/performances.html public/faq.html public/cgv.html public/js/i18n.js; do
  [[ -f "$f" ]] && cp -a "$f" "$BACKUP/public/"
done
cp -a AGENTS.md CLAUDE.md "$BACKUP/docs/"
cp -a data/tlm.db "$BACKUP/tlm.db"
chmod 600 "$BACKUP/tlm.db"
git rev-parse HEAD > "$BACKUP/git-head-before.txt"

db_count() {
  python3 -c 'import sqlite3,sys; d=sqlite3.connect("/opt/touslesmatchs/data/tlm.db"); t=sys.argv[1]; e=d.execute("SELECT 1 FROM sqlite_master WHERE type=? AND name=?",("table",t)).fetchone(); print(d.execute("SELECT count(*) FROM "+t).fetchone()[0] if e else 0)' "$1"
}

BEFORE_CONC="$(db_count concile_analyses)"
BEFORE_SNAP="$(db_count official_signal_snapshots)"
BEFORE_TG="$(db_count telegram_signal_deliveries)"
BEFORE_G05="$(db_count goal05_signal_registry)"

git diff --name-only "$OLD_HEAD" "$TARGET" > "$BACKUP/deploy-files.txt"
while IFS= read -r file; do
  case "$file" in
    .github/workflows/codex-deploy-telegram-audit.yml|.github/workflows/deploy-match-lifecycle.yml|.github/workflows/test-current-product-goal05-20261005.yml|.github/workflows/deploy-goal05-current-product-20261005.yml|AGENTS.md|CLAUDE.md|public/app.html|public/cgv.html|public/faq.html|public/index.html|public/js/i18n.js|public/live-ia.html|public/performances.html|scripts/deploy_goal05_current_product_20261005.sh|scripts/test_current_product_goal05_20261005.js|scripts/test_match_lifecycle_20260906.js|scripts/test_ou25_product_guard_20260926.js)
      ;;
    *)
      echo "STOP: unrelated deployment file: $file"
      exit 42
      ;;
  esac
done < "$BACKUP/deploy-files.txt"

rollback() {
  trap - ERR
  git reset --hard "$OLD_HEAD" >/dev/null 2>&1 || true
  echo "ROLLBACK_PUBLIC_CODE_OK"
  echo "DATABASE_NOT_RESTORED_TO_AVOID_OVERWRITING_LIVE_WRITES"
  echo "BACKUP=$BACKUP"
  exit 1
}
trap rollback ERR

git merge --ff-only "$TARGET"
test "$(git rev-parse HEAD)" = "$TARGET"
test "$(git rev-parse origin/main)" = "$TARGET"

node scripts/test_current_product_goal05_20261005.js
node scripts/test_goal05_policy_20261005.js
node scripts/test_i18n_integral_20260906.js

grep -qF '+0,5 but équipe favorite' public/index.html
grep -qF '4 IA / 5 minimum' public/index.html
grep -qF 'Votre signal +0,5 but équipe favorite' public/app.html
grep -qF 'Historique total' public/app.html
grep -qF 'Ancien O/U 2,5' public/app.html
grep -qF 'Stratégie actuelle' public/live-ia.html
grep -qF 'Historique · O/U 2,5 (ancien système)' public/live-ia.html
grep -qF 'La stratégie actuelle est +0,5 but de l’équipe favorite' public/performances.html
grep -qF 'Historique · O/U 2,5' public/performances.html
grep -qF '4 IA sur 5' public/faq.html
grep -qF 'ancien historique O/U 2,5 reste consultable' public/cgv.html

python3 -c 'import sqlite3; d=sqlite3.connect("/opt/touslesmatchs/data/tlm.db"); assert d.execute("PRAGMA quick_check").fetchone()[0]=="ok"'
AFTER_CONC="$(db_count concile_analyses)"
AFTER_SNAP="$(db_count official_signal_snapshots)"
AFTER_TG="$(db_count telegram_signal_deliveries)"
AFTER_G05="$(db_count goal05_signal_registry)"

test "$AFTER_CONC" -ge "$BEFORE_CONC"
test "$AFTER_SNAP" -ge "$BEFORE_SNAP"
test "$AFTER_TG" -ge "$BEFORE_TG"
test "$AFTER_G05" -ge "$BEFORE_G05"

echo "HISTORY_COUNTS_BEFORE=$BEFORE_CONC/$BEFORE_SNAP/$BEFORE_TG/$BEFORE_G05"
echo "HISTORY_COUNTS_AFTER=$AFTER_CONC/$AFTER_SNAP/$AFTER_TG/$AFTER_G05"

curl -fsS --max-time 30 "https://www.touslesmatchs.com/?goal05_deploy=$TARGET" -o "$BACKUP/home-public.html"
curl -fsS --max-time 30 "https://www.touslesmatchs.com/app.html?goal05_deploy=$TARGET" -o "$BACKUP/app-public.html"
curl -fsS --max-time 30 "https://www.touslesmatchs.com/live-ia.html?goal05_deploy=$TARGET" -o "$BACKUP/live-public.html"
curl -fsS --max-time 30 "https://www.touslesmatchs.com/performances.html?goal05_deploy=$TARGET" -o "$BACKUP/perf-public.html"
curl -fsS --max-time 30 "https://www.touslesmatchs.com/faq.html?goal05_deploy=$TARGET" -o "$BACKUP/faq-public.html"
curl -fsS --max-time 30 "https://www.touslesmatchs.com/cgv.html?goal05_deploy=$TARGET" -o "$BACKUP/cgv-public.html"
curl -fsS --max-time 30 "https://www.touslesmatchs.com/api/health?t=$TARGET" -o "$BACKUP/health.json"
curl -fsS --max-time 30 "https://www.touslesmatchs.com/api/analysis-history?limit=1&t=$TARGET" -o "$BACKUP/history.json"

grep -qF '+0,5 but équipe favorite' "$BACKUP/home-public.html"
grep -qF 'Votre signal +0,5 but équipe favorite' "$BACKUP/app-public.html"
grep -qF 'Stratégie actuelle' "$BACKUP/live-public.html"
grep -qF 'La stratégie actuelle est +0,5 but de l’équipe favorite' "$BACKUP/perf-public.html"
grep -qF '4 IA sur 5' "$BACKUP/faq-public.html"
grep -qF 'ancien historique O/U 2,5 reste consultable' "$BACKUP/cgv-public.html"

node -e 'const x=require(process.argv[1]);if(!x.ok)process.exit(1)' "$BACKUP/health.json"
node -e 'const x=require(process.argv[1]);if(!x.ok||Number(x.total||0)<1)process.exit(1)' "$BACKUP/history.json"
docker compose ps --services --status running | grep -qx site
docker compose ps --services --status running | grep -qx api

trap - ERR
echo "GOAL05_CURRENT_PRODUCT_DEPLOYED=$TARGET"
echo "OU25_HISTORY_PRESERVED=true"
echo "BACKUP=$BACKUP"
