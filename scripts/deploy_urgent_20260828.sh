#!/usr/bin/env bash
set -Eeuo pipefail

# Les urgences de la PR #24 sont deja presentes sur la branche VPS depuis
# 47a984f. Ce script ne recopie plus de fichiers : il verifie l'etat courant
# sans toucher aux modifications locales ni aux fichiers non suivis.

cd /opt/touslesmatchs

TLM_BRANCH="agent/android-fcm-v107"
TLM_REQUIRED_ANCESTOR="47a984f"

echo "[1/5] Depot et branche"
test "$(git branch --show-current)" = "$TLM_BRANCH" || {
  echo "STOP : branche inattendue $(git branch --show-current)"
  exit 20
}
git cat-file -e "$TLM_REQUIRED_ANCESTOR^{commit}"
git merge-base --is-ancestor "$TLM_REQUIRED_ANCESTOR" HEAD || {
  echo "STOP : le correctif 47a984f n'est pas present dans HEAD"
  exit 21
}

echo "[2/5] Protection des changements VPS"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "STOP : changements suivis detectes ; aucun fichier ne sera remplace"
  git status --short
  exit 22
fi
echo "Fichiers non suivis conserves :"
git status --short | awk '$1 == "??" {print}' || true

echo "[3/5] Etat GitHub"
git fetch origin "$TLM_BRANCH"
git merge-base --is-ancestor HEAD "origin/$TLM_BRANCH" || {
  echo "STOP : le VPS et GitHub ont diverge ; aucune mise a jour automatique"
  exit 23
}
echo "VPS=$(git rev-parse --short HEAD)"
echo "GITHUB=$(git rev-parse --short "origin/$TLM_BRANCH")"

echo "[4/5] Verification des urgences"
grep -Fq 'var verified=s.abonnes||s;' public/index.html
if grep -Eqi 'Cycle 01|ACCES FONDATEUR|Accès fondateur|APK bêta|beta-cycle01|Goal05-v107' public/index.html; then
  echo "STOP : ancien contenu beta encore present"
  exit 24
fi
grep -Fq 'tlm-app-v8-proof-and-upcoming-20260828' public/index.html
grep -Fq 'tlm-app-v8-proof-and-upcoming-20260828' public/sw.js
node --check public/sw.js
node - public/index.html <<'NODE'
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const blocks = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const scripts = blocks
  .filter(([, attrs]) => !/\btype\s*=\s*["']application\/ld\+json["']/i.test(attrs))
  .map(([, , source]) => source);
scripts.forEach((source, index) => {
  try { new Function(source); }
  catch (error) { throw new Error(`script inline ${index + 1}: ${error.message}`); }
});
console.log(`JS_INLINE_OK=${scripts.length}`);
NODE

echo "[5/5] Services et API"
test "$(docker inspect -f '{{.State.Running}}' touslesmatchs-site)" = "true"
test "$(docker inspect -f '{{.State.Running}}' touslesmatchs-api)" = "true"
curl -fsS http://127.0.0.1:3001/health >/dev/null

echo "VERDICT=OK"
echo "ACTION=AUCUNE_COPIE_NECESSAIRE"
echo "NOTE=Les changements suivis et non suivis du VPS ont ete preserves"
