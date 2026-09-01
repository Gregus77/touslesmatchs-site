#!/usr/bin/env bash
set -Eeuo pipefail

TLM_DIR="/opt/touslesmatchs"
TLM_API_FILE="$TLM_DIR/scripts/api_server.js"
TLM_COMPOSE_FILE="$TLM_DIR/docker-compose.yml"
TLM_ENV_FILE="$TLM_DIR/.env"
TLM_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TLM_BACKUP_DIR="/opt/backups/tlm-ou25-confidence-78-$TLM_STAMP"

fail() {
  echo "FAILED: $*" >&2
  exit 1
}

cd "$TLM_DIR"
test -f "$TLM_API_FILE" || fail "fichier API introuvable: $TLM_API_FILE"
test -f "$TLM_COMPOSE_FILE" || fail "docker-compose.yml introuvable"
test -f "$TLM_ENV_FILE" || fail ".env introuvable"

echo "[baseline] branch=$(git branch --show-current) head=$(git rev-parse HEAD)"
git status --short --branch
docker compose ps

TLM_TARGET_DIRTY="$(git status --porcelain -- scripts/api_server.js docker-compose.yml)"
if test -n "$TLM_TARGET_DIRTY"; then
  echo "[preserve] fichiers cibles deja modifies; sauvegarde integrale avant modification ciblee"
  printf '%s\n' "$TLM_TARGET_DIRTY"
fi

TLM_DECL_COUNT="$(grep -Ec '^const CLIENT_OU25_MIN_CONFIDENCE[[:space:]]*=' "$TLM_API_FILE" || true)"
test "$TLM_DECL_COUNT" = "1" || fail "declaration CLIENT_OU25_MIN_CONFIDENCE attendue exactement une fois, trouvee: $TLM_DECL_COUNT"

mkdir -p "$TLM_BACKUP_DIR"
chmod 700 "$TLM_BACKUP_DIR"
cp -a "$TLM_API_FILE" "$TLM_BACKUP_DIR/api_server.js.before"
cp -a "$TLM_COMPOSE_FILE" "$TLM_BACKUP_DIR/docker-compose.yml.before"
cp -a "$TLM_ENV_FILE" "$TLM_BACKUP_DIR/env.before"
chmod 600 "$TLM_BACKUP_DIR/env.before"
printf '%s\n' "branch=$(git branch --show-current)" "head=$(git rev-parse HEAD)" > "$TLM_BACKUP_DIR/baseline.txt"
git diff -- scripts/api_server.js docker-compose.yml > "$TLM_BACKUP_DIR/preexisting-worktree.patch" || true

export TLM_API_FILE TLM_COMPOSE_FILE TLM_ENV_FILE
node <<'NODE'
const fs = require('fs');

const apiPath = process.env.TLM_API_FILE;
const composePath = process.env.TLM_COMPOSE_FILE;
const envPath = process.env.TLM_ENV_FILE;

let api = fs.readFileSync(apiPath, 'utf8');
const declaration = /^const CLIENT_OU25_MIN_CONFIDENCE\s*=\s*[^;]+;/m;
if (!declaration.test(api)) throw new Error('declaration CLIENT_OU25_MIN_CONFIDENCE non reconnue');
api = api.replace(
  declaration,
  'const CLIENT_OU25_MIN_CONFIDENCE = Math.max(78, Number(process.env.CLIENT_OU25_MIN_CONFIDENCE || 78));'
);
fs.writeFileSync(apiPath, api);

let compose = fs.readFileSync(composePath, 'utf8');
const apiStart = compose.indexOf('  api:\n');
const councilStart = compose.indexOf('\n  council:', apiStart);
if (apiStart < 0 || councilStart < 0) throw new Error('bloc service api introuvable dans docker-compose.yml');
let apiBlock = compose.slice(apiStart, councilStart);
const envLine = '      - CLIENT_OU25_MIN_CONFIDENCE=${CLIENT_OU25_MIN_CONFIDENCE:-78}';
if (/^\s*- CLIENT_OU25_MIN_CONFIDENCE=.*$/m.test(apiBlock)) {
  apiBlock = apiBlock.replace(/^\s*- CLIENT_OU25_MIN_CONFIDENCE=.*$/m, envLine);
} else {
  const marker = '    environment:\n';
  if (!apiBlock.includes(marker)) throw new Error('section environment du service api introuvable');
  apiBlock = apiBlock.replace(marker, marker + envLine + '\n');
}
compose = compose.slice(0, apiStart) + apiBlock + compose.slice(councilStart);
fs.writeFileSync(composePath, compose);

let env = fs.readFileSync(envPath, 'utf8');
if (/^CLIENT_OU25_MIN_CONFIDENCE=.*$/m.test(env)) {
  env = env.replace(/^CLIENT_OU25_MIN_CONFIDENCE=.*$/m, 'CLIENT_OU25_MIN_CONFIDENCE=78');
} else {
  env += (env.endsWith('\n') ? '' : '\n') + 'CLIENT_OU25_MIN_CONFIDENCE=78\n';
}
fs.writeFileSync(envPath, env);
NODE

node --check "$TLM_API_FILE"
docker compose config -q

rollback() {
  echo "[rollback] restauration des fichiers et reconstruction API" >&2
  cp -a "$TLM_BACKUP_DIR/api_server.js.before" "$TLM_API_FILE"
  cp -a "$TLM_BACKUP_DIR/docker-compose.yml.before" "$TLM_COMPOSE_FILE"
  cp -a "$TLM_BACKUP_DIR/env.before" "$TLM_ENV_FILE"
  docker compose up -d --build api || true
}
trap 'rollback' ERR

docker compose up -d --build api

TLM_HEALTH_OK=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3001/health >/tmp/tlm-health-local.json 2>/dev/null; then
    TLM_HEALTH_OK=1
    break
  fi
  sleep 2
done
test "$TLM_HEALTH_OK" = "1" || fail "API locale non saine apres reconstruction"

docker inspect -f '{{.State.Status}} {{.State.Restarting}} {{.RestartCount}}' touslesmatchs-api
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' touslesmatchs-api \
  | grep -qx 'CLIENT_OU25_MIN_CONFIDENCE=78'
docker exec touslesmatchs-api sh -lc \
  "grep -Eq '^const CLIENT_OU25_MIN_CONFIDENCE = Math.max\\(78, Number\\(process.env.CLIENT_OU25_MIN_CONFIDENCE \\|\\| 78\\)\\);' /app/server.js"
curl -fsS --max-time 20 https://www.touslesmatchs.com/api/health | grep -q '"ok":true'

TLM_BAD_LOGS="$(docker logs --since 3m touslesmatchs-api 2>&1 | grep -E 'SyntaxError|ReferenceError|uncaughtException|CRASH-GUARD' || true)"
test -z "$TLM_BAD_LOGS" || fail "erreur detectee dans les logs API: $TLM_BAD_LOGS"

trap - ERR

echo "OK: seuil O/U 2,5 minimal=78, API reconstruite et saine"
echo "BACKUP=$TLM_BACKUP_DIR"
echo "PROOF_ENV=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' touslesmatchs-api | grep '^CLIENT_OU25_MIN_CONFIDENCE=')"
echo "PROOF_SOURCE=$(docker exec touslesmatchs-api sh -lc \"grep '^const CLIENT_OU25_MIN_CONFIDENCE' /app/server.js\")"
echo "GIT=non modifie automatiquement; les changements locaux preexistants ont ete preserves"
