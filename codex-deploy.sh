#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-design-wow-complet}"
LABEL="${2:-codex-deploy}"

echo "=========================================="
echo " CODEX DEPLOY — TOUSLESMATCHS"
echo "=========================================="
echo "Branche source : $BRANCH"
echo "Label          : $LABEL"
echo ""

echo "=== 1. SAUVEGARDE DB ==="
if [ -x ./backup-db.sh ]; then
    ./backup-db.sh "avant-${LABEL}-$(date +%F-%H%M)"
else
    echo "⚠️ backup-db.sh absent ou non exécutable"
fi

echo ""
echo "=== 2. ETAT GIT AVANT ==="
git status --short || true

echo ""
echo "=== 3. FETCH BRANCHE ==="
git fetch origin "$BRANCH"

echo ""
echo "=== 4. APPLICATION DU CODE ==="

FILES=(
    "scripts/api_server.js"
    "scripts/analysis_engine.js"
    "scripts/ai_budget_guard.js"
    "docker-compose.yml"
)

for file in "${FILES[@]}"; do
    if git cat-file -e "origin/$BRANCH:$file" 2>/dev/null; then
        git checkout "origin/$BRANCH" -- "$file"
        echo "✅ $file"
    else
        echo "⚠️ absent de $BRANCH : $file"
    fi
done

echo ""
echo "=== 5. CONTROLES AVANT COMMIT ==="

echo -n "Fichiers public/ touchés : "
git diff --name-only | grep -c '^public/' || true

echo -n "Modifications seuils sensibles : "
git diff | grep -cE '^[+-].*(signalThreshold|getSignalFloor|getEliteMinConf|STANDARD_MIN_CONF|PREMIUM_MIN_CONF)' || true

echo -n "COUNCIL_PUBLIC_TELEGRAM modifié : "
git diff | grep -c 'COUNCIL_PUBLIC_TELEGRAM' || true

echo ""
echo "Fichiers modifiés :"
git diff --name-only || true

echo ""
echo "=== 6. VERIFICATION SYNTAXE ==="

node --check scripts/api_server.js

if [ -f scripts/analysis_engine.js ]; then
    node --check scripts/analysis_engine.js
fi

if [ -f scripts/ai_budget_guard.js ]; then
    node --check scripts/ai_budget_guard.js
fi

echo "✅ Syntaxe Node OK"

echo ""
echo "=== 7. COMMIT LOCAL ==="

if git diff --quiet; then
    echo "Aucun changement à committer."
else
    git add scripts/api_server.js

    [ -f scripts/analysis_engine.js ] && git add scripts/analysis_engine.js
    [ -f scripts/ai_budget_guard.js ] && git add scripts/ai_budget_guard.js
    [ -f docker-compose.yml ] && git add docker-compose.yml

    git commit -m "[Codex] deploy ${LABEL}"

    echo ""
    echo "=== PUSH ==="
    git push origin HEAD:"$BRANCH"
fi

echo ""
echo "=== 8. REBUILD API ==="
docker compose up -d --build api

echo ""
echo "=== 9. ATTENTE HEALTHCHECK ==="

MAX_TRIES=30
TRY=0

until curl -fsS https://www.touslesmatchs.com/api/health >/dev/null 2>&1; do
    TRY=$((TRY + 1))

    if [ "$TRY" -ge "$MAX_TRIES" ]; then
        echo "❌ API non disponible après $MAX_TRIES contrôles"
        docker logs touslesmatchs-api --tail 100
        exit 1
    fi

    sleep 2
done

echo "✅ API répond"

echo ""
echo "=== 10. CONTROLES PROD ==="

docker ps \
    --filter name=touslesmatchs-api \
    --format "API : {{.Status}}"

curl -sS -o /dev/null \
    -w "Site : HTTP %{http_code}\n" \
    https://www.touslesmatchs.com/

docker exec touslesmatchs-api \
    node --check /app/server.js \
    && echo "✅ server.js syntaxe OK"

echo -n "Health : "
curl -fsS https://www.touslesmatchs.com/api/health
echo

echo ""
echo "=== 11. RESUME CONCILE — 24H ==="

docker exec touslesmatchs-api node - <<'NODE'
const Database = require("better-sqlite3");

try {
    const db = new Database("/data/tlm.db", { readonly: true });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

    const rows = db.prepare(`
        SELECT *
        FROM concile_analyses
        WHERE analysed_at >= ?
    `).all(since);

    const count = fn => rows.filter(fn).length;

    console.log("analyses_24h=" + rows.length);

    console.log(
        "consensus_3_plus=" +
        count(x => (x.consensus_votes || 0) >= 3)
    );

    console.log(
        "confidence_75_plus=" +
        count(x => (x.confidence || 0) >= 75)
    );

    console.log(
        "cote_reelle=" +
        count(x =>
            x.real_odd_source &&
            !String(x.real_odd_source)
                .toLowerCase()
                .includes("estimation")
        )
    );

    console.log(
        "envoyes_client=" +
        count(x =>
            (x.sig_sent_free || 0) +
            (x.sig_sent_standard || 0) +
            (x.sig_sent_premium || 0) +
            (x.sig_sent_elite || 0) > 0
        )
    );

    db.close();

} catch (err) {
    console.error("❌ Erreur statistiques :", err.message);
    process.exitCode = 1;
}
NODE

echo ""
echo "=== 12. TELEGRAM RECENT ==="

docker logs touslesmatchs-api --tail 500 2>&1 | grep -iE 'telegram-check|Telegram (standard|premium|elite|gratuit|admin).*(OK|FAIL)|signal-fort' | tail -30 || true

echo ""
echo "=== 13. ETAT FINAL GIT ==="

git status --short
git log -1 --oneline

echo ""
echo "=========================================="
echo " ✅ DEPLOIEMENT TERMINE"
echo "=========================================="
