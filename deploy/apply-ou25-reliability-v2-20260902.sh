#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/opt/touslesmatchs
BRANCH=agent/android-fcm-v107
SOURCE_BASE=be51c9606759f3d16e1562bad7b49de0a111060b
SOURCE_TARGET=bc48a98891509140312c73b76a9b7c52ff238098
BACKUP=/opt/backups/tlm-ou25-reliability-$(date -u +%Y%m%dT%H%M%SZ)
TMP=$(mktemp -d /tmp/tlm-ou25-reliability.XXXXXX)
CHANGED=0

rollback() {
  local code=$?
  rm -rf "$TMP"
  if [[ $code -eq 0 || $CHANGED -eq 0 ]]; then
    return
  fi
  echo "[rollback] restauration des fichiers sauvegardes"
  for file in scripts/api_server.js scripts/ai_models.config.js scripts/verify_ou25_reliability_guard.js; do
    local saved="$BACKUP/$(basename "$file").before"
    if [[ -f "$saved" ]]; then
      cp -a "$saved" "$ROOT/$file"
    else
      rm -f "$ROOT/$file"
    fi
  done
  (cd "$ROOT" && docker compose up -d --build api) >/dev/null 2>&1 || true
  echo "FAILED — correction annulee; sauvegarde=$BACKUP"
}
trap rollback EXIT

cd "$ROOT"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"

git fetch origin "$BRANCH"
git cat-file -e "$SOURCE_BASE^{commit}"
git cat-file -e "$SOURCE_TARGET^{commit}"

for file in scripts/api_server.js scripts/ai_models.config.js; do
  mkdir -p "$TMP/$(dirname "$file")"
  git show "$SOURCE_BASE:$file" > "$TMP/$file.base"
  git show "$SOURCE_TARGET:$file" > "$TMP/$file.target"
  set +e
  git merge-file -p "$ROOT/$file" "$TMP/$file.base" "$TMP/$file.target" > "$TMP/$file.merged"
  status=$?
  set -e
  if [[ $status -gt 1 ]]; then
    echo "FAILED — fusion impossible pour $file; aucune ecriture effectuee"
    exit 1
  fi
  if [[ $status -eq 1 ]]; then
    node - "$TMP/$file.merged" "$file" <<'NODE'
const fs = require("node:fs");
const [mergedPath, file] = process.argv.slice(2);
let source = fs.readFileSync(mergedPath, "utf8");
let conflicts = 0;
source = source.replace(
  /^<<<<<<< [^\n]*\n([\s\S]*?)^=======\n([\s\S]*?)^>>>>>>> [^\n]*$/gm,
  (_block, localVersion, validatedVersion) => {
    conflicts += 1;
    // La protection NFL a été ajoutée directement sur le VPS. Elle reste utile
    // et doit être conservée avec la nouvelle signature minute maximale.
    if (file.endsWith("api_server.js") && localVersion.includes("isAmericanFootballMatch(match)")) {
      return `${validatedVersion.replace(/\n$/, "")}\n  if (isAmericanFootballMatch(match)) return false;`;
    }
    // Pour les autres conflits ciblés, la version validée porte la décision
    // explicite du propriétaire : 78 %, Qwen, cinq sièges et minute 32.
    return validatedVersion.replace(/\n$/, "");
  }
);
if (!conflicts) throw new Error(`statut conflit sans bloc détecté dans ${file}`);
if (/^<<<<<<< |^=======|^>>>>>>> /m.test(source)) {
  throw new Error(`marqueur de conflit restant dans ${file}`);
}
fs.writeFileSync(mergedPath, source);
console.log(`[merge] ${file}: ${conflicts} conflit(s) résolu(s), modifications locales hors conflits conservées`);
NODE
  fi
done

for file in scripts/api_server.js scripts/ai_models.config.js scripts/verify_ou25_reliability_guard.js; do
  if [[ -f "$ROOT/$file" ]]; then
    cp -a "$ROOT/$file" "$BACKUP/$(basename "$file").before"
  fi
done

install -m 640 "$TMP/scripts/api_server.js.merged" scripts/api_server.js
install -m 640 "$TMP/scripts/ai_models.config.js.merged" scripts/ai_models.config.js
git show "$SOURCE_TARGET:scripts/verify_ou25_reliability_guard.js" > scripts/verify_ou25_reliability_guard.js
chmod 640 scripts/verify_ou25_reliability_guard.js
CHANGED=1

node --check scripts/api_server.js
node --check scripts/ai_models.config.js
node scripts/verify_ou25_reliability_guard.js | tee "$BACKUP/source-verification.txt"
grep -q 'if (isAmericanFootballMatch(match)) return false;' scripts/api_server.js
git diff --check -- scripts/api_server.js scripts/ai_models.config.js scripts/verify_ou25_reliability_guard.js

docker compose config --quiet
docker compose up -d --build api

healthy=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3001/health > "$BACKUP/internal-health.json" 2>/dev/null \
    || curl -fsS --max-time 5 http://127.0.0.1:3001/api/health > "$BACKUP/internal-health.json" 2>/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done
[[ $healthy -eq 1 ]]

curl -fsS --max-time 20 https://www.touslesmatchs.com/api/health > "$BACKUP/public-health.json"
docker exec touslesmatchs-api node --check /app/server.js

source_api_sha=$(sha256sum scripts/api_server.js | awk '{print $1}')
running_api_sha=$(docker exec touslesmatchs-api sha256sum /app/server.js | awk '{print $1}')
source_models_sha=$(sha256sum scripts/ai_models.config.js | awk '{print $1}')
running_models_sha=$(docker exec touslesmatchs-api sha256sum /app/ai_models.config.js | awk '{print $1}')
[[ "$source_api_sha" == "$running_api_sha" ]]
[[ "$source_models_sha" == "$running_models_sha" ]]

docker logs --since 3m touslesmatchs-api > "$BACKUP/api-recent.log" 2>&1 || true
if grep -Eiq 'SyntaxError|ReferenceError|TypeError:|uncaught|fatal|crash' "$BACKUP/api-recent.log"; then
  echo "FAILED — erreur recente detectee dans les logs API"
  exit 1
fi

docker exec touslesmatchs-api sh -lc '
  test -n "${TELEGRAM_BOT_TOKEN:-}"
  test -n "${TELEGRAM_STANDARD_CHANNEL_ID:-}"
  test -n "${TELEGRAM_PREMIUM_CHANNEL_ID:-}"
'

CHANGED=0
rm -rf "$TMP"
trap - EXIT
echo "OK — regles actives: 78 %, 15-32 minutes, 5/5 cible, Qwen titulaire, Kimi shadow"
echo "OK — API interne et publique saines; Telegram configure; aucun message test envoye"
echo "Sauvegarde: $BACKUP"
