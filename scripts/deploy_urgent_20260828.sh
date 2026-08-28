#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/touslesmatchs

TLM_SOURCE_BRANCH="codex/urgent-actions-20260828"
TLM_BASE="43501aded0f1149a2132fc4c7edaf96a24d86153"
TLM_TS="$(date +%Y%m%d-%H%M%S)"
TLM_BACKUP="/opt/backups/tlm-urgent-${TLM_TS}"
TLM_TMP="$(mktemp -d /tmp/tlm-urgent-XXXXXX)"
TLM_FILES=(CHANGELOG.md public/index.html public/sw.js)
TLM_COPIED=0
TLM_VERIFIED=0

finish() {
  TLM_RC=$?
  trap - EXIT
  if (( TLM_RC != 0 )) && (( TLM_COPIED == 1 )) && (( TLM_VERIFIED == 0 )); then
    echo "ECHEC : restauration automatique"
    for TLM_FILE in "${TLM_FILES[@]}"; do
      cp -a -- "$TLM_BACKUP/$TLM_FILE" "$TLM_FILE"
    done
    docker compose up -d --build site >/dev/null 2>&1 || true
  fi
  rm -rf -- "$TLM_TMP"
  if (( TLM_RC == 0 )); then
    echo "VERDICT=OK"
    echo "AVANCEMENT=95% - controle visuel mobile restant"
  else
    echo "VERDICT=FAILED code=$TLM_RC"
  fi
  exit "$TLM_RC"
}
trap finish EXIT

echo "[1/7] Controle du depot"
test "$(git branch --show-current)" = "agent/android-fcm-v107" || {
  echo "STOP : branche inattendue $(git branch --show-current)"
  exit 20
}
git status --short --branch
git ls-files --error-unmatch "${TLM_FILES[@]}" >/dev/null
if ! git diff --quiet -- "${TLM_FILES[@]}" || ! git diff --cached --quiet -- "${TLM_FILES[@]}"; then
  echo "STOP : changements locaux detectes dans les fichiers cibles"
  git status --short -- "${TLM_FILES[@]}"
  exit 21
fi

echo "[2/7] Recuperation du correctif GitHub"
git fetch origin "$TLM_SOURCE_BRANCH"
git cat-file -e "$TLM_BASE^{commit}"
if ! git diff --quiet "$TLM_BASE" -- "${TLM_FILES[@]}"; then
  echo "STOP : fichiers cibles modifies depuis la base auditee"
  git diff --stat "$TLM_BASE" -- "${TLM_FILES[@]}"
  exit 22
fi
git archive "origin/$TLM_SOURCE_BRANCH" "${TLM_FILES[@]}" | tar -x -C "$TLM_TMP"

echo "[3/7] Tests avant deploiement"
node --check "$TLM_TMP/public/sw.js"
node - "$TLM_TMP/public/index.html" <<'NODE'
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const scripts = blocks
  .filter(([, attrs]) => !/\btype\s*=\s*["']application\/ld\+json["']/i.test(attrs))
  .map(([, , source]) => source);
scripts.forEach((script, i) => {
  try { new Function(script); }
  catch (error) { throw new Error(`script inline ${i + 1}: ${error.message}`); }
});
console.log(`JS_INLINE_OK=${scripts.length}`);
NODE
if grep -Eqi 'Cycle 01|ACCES FONDATEUR|Accès fondateur|APK bêta|beta-cycle01|Goal05-v107' "$TLM_TMP/public/index.html"; then
  echo "STOP : ancien contenu beta encore present"
  exit 23
fi
grep -Fq 'var verified=s.abonnes||s;' "$TLM_TMP/public/index.html"
grep -Fq 'tlm-app-v5-history-beta-20260828' "$TLM_TMP/public/sw.js"

echo "[4/7] Sauvegarde et installation"
mkdir -p "$TLM_BACKUP/public"
chmod 700 "$TLM_BACKUP"
for TLM_FILE in "${TLM_FILES[@]}"; do
  cp -a -- "$TLM_FILE" "$TLM_BACKUP/$TLM_FILE"
done
cp -a -- "$TLM_TMP/CHANGELOG.md" CHANGELOG.md
cp -a -- "$TLM_TMP/public/index.html" public/index.html
cp -a -- "$TLM_TMP/public/sw.js" public/sw.js
TLM_COPIED=1
git diff --check

echo "[5/7] Reconstruction du site"
docker compose up -d --build site
for TLM_TRY in $(seq 1 15); do
  if test "$(docker inspect -f '{{.State.Running}}' touslesmatchs-site 2>/dev/null || true)" = "true" && \
     curl -kfsS --resolve 'www.touslesmatchs.com:443:127.0.0.1' \
       https://www.touslesmatchs.com/ >/dev/null; then
    break
  fi
  sleep 2
done
test "$(docker inspect -f '{{.State.Running}}' touslesmatchs-site)" = "true"

echo "[6/7] Verification du site, API et Telegram"
curl -kfsS --resolve 'www.touslesmatchs.com:443:127.0.0.1' -H 'Cache-Control: no-cache' \
  "https://www.touslesmatchs.com/?v=$TLM_TS" -o "$TLM_TMP/origin.html"
curl -fsS -H 'Cache-Control: no-cache' \
  "https://www.touslesmatchs.com/?v=$TLM_TS" -o "$TLM_TMP/public.html"
curl -fsS -H 'Cache-Control: no-cache' \
  "https://www.touslesmatchs.com/sw.js?v=$TLM_TS" -o "$TLM_TMP/public-sw.js"
for TLM_PAGE in "$TLM_TMP/origin.html" "$TLM_TMP/public.html"; do
  if grep -Eqi 'Cycle 01|ACCES FONDATEUR|Accès fondateur|APK bêta|beta-cycle01|Goal05-v107' "$TLM_PAGE"; then
    echo "STOP : ancien contenu beta encore servi"
    exit 24
  fi
  grep -Fq 'var verified=s.abonnes||s;' "$TLM_PAGE"
done
grep -Fq 'tlm-app-v5-history-beta-20260828' "$TLM_TMP/public-sw.js"
curl -fsS "https://www.touslesmatchs.com/api/analysis-history?limit=1&offset=0" \
  -o "$TLM_TMP/history.json"
node - "$TLM_TMP/history.json" <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!data.stats || !data.stats.abonnes) throw new Error('stats.abonnes absent');
const s = data.stats.abonnes;
console.log('COMPTEURS_API=' + JSON.stringify({
  total:s.total, wins:s.wins, losses:s.losses, pending:s.pending, winrate:s.winrate
}));
NODE
docker exec -i touslesmatchs-api node <<'NODE'
const Database = require('better-sqlite3');
const db = new Database('/data/tlm.db', {readonly:true});
const cols = new Set(db.prepare('PRAGMA table_info(concile_analyses)').all().map(x => x.name));
const channels = ['free','standard','premium','elite'].filter(c => cols.has('sig_sent_' + c));
const paid = ['standard','premium','elite'].filter(c => channels.includes(c));
const expr = list => list.length ? list.map(c => `COALESCE(sig_sent_${c},0)=1`).join(' OR ') : '0';
const count = where => db.prepare(`SELECT COUNT(DISTINCT match_key) n FROM concile_analyses WHERE ${where}`).get().n;
const hasProof = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='telegram_signal_deliveries'").get();
let proof = {rows:0,matches:0,since_2026_08_27:0,last_proof:null};
if (hasProof) proof = db.prepare(`SELECT COUNT(*) rows, COUNT(DISTINCT match_key) matches,
  SUM(CASE WHEN created_at >= '2026-08-27' THEN 1 ELSE 0 END) since_2026_08_27,
  MAX(created_at) last_proof FROM telegram_signal_deliveries
  WHERE ok=1 AND telegram_message_id IS NOT NULL`).get();
console.log('TELEGRAM_AUDIT=' + JSON.stringify({
  legacy_all:count(expr(channels)), legacy_paid:count(expr(paid)), durable_proof:proof
}));
db.close();
NODE
docker logs --since 3m touslesmatchs-site 2>&1 | tail -80
TLM_VERIFIED=1

echo "[7/7] Sauvegarde sur la branche active"
git add -- "${TLM_FILES[@]}"
git commit -m "[Codex] Deploie les trois urgences du 28 aout"
git push origin HEAD:agent/android-fcm-v107
echo "COMMIT_DEPLOYE=$(git rev-parse HEAD)"
echo "SAUVEGARDE=$TLM_BACKUP"
docker compose ps site
