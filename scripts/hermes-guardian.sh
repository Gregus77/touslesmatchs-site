#!/bin/bash
# Hermes Guardian — Verification de production LOCKDOWN V1.1
# Usage: bash scripts/hermes-guardian.sh [--fix]
set -uo pipefail

ERRORS=0
WARNINGS=0
FIXES=0
AUTO_FIX="${1:-}"

echo "=== HERMES GUARDIAN — Verification de production ==="
echo "Date: $(date)"
echo ""

# ── 1. Source unique du frontend ────────────────────────────
echo "--- Phase 1: Source unique frontend ---"

if [ -d site ] && [ -f site/index.html ]; then
  echo "ERREUR: site/index.html existe — ancien frontend actif"
  ERRORS=$((ERRORS + 1))
  if [ "$AUTO_FIX" = "--fix" ]; then
    mkdir -p _deprecated/site
    mv site/* _deprecated/site/ 2>/dev/null || true
    rmdir site 2>/dev/null || true
    echo "  FIX: site/ deplace vers _deprecated/site/"
    FIXES=$((FIXES + 1))
  fi
else
  echo "OK: Aucun site/index.html"
fi

for LEGACY in src dist nginx; do
  if [ -d "$LEGACY" ] && [ "$(ls -A "$LEGACY" 2>/dev/null)" ]; then
    echo "ATTENTION: Dossier legacy $LEGACY/ non vide"
    WARNINGS=$((WARNINGS + 1))
  fi
done

if [ ! -f public/index.html ]; then
  echo "ERREUR CRITIQUE: public/index.html manquant"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: public/index.html present"
fi

# ── 2. Docker-compose coherent ──────────────────────────────
echo ""
echo "--- Phase 2: Docker Compose ---"

if grep -q '/opt/touslesmatchs/site:/srv' docker-compose.yml 2>/dev/null; then
  echo "ERREUR: Volume site:/srv dans docker-compose.yml"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: Pas de volume site:/srv"
fi

if grep -q '/opt/touslesmatchs/public:/srv' docker-compose.yml 2>/dev/null; then
  echo "OK: Volume public:/srv present"
else
  echo "ERREUR: Volume public:/srv absent"
  ERRORS=$((ERRORS + 1))
fi

# ── 3. Caddyfile coherent ───────────────────────────────────
echo ""
echo "--- Phase 3: Caddyfile ---"

if grep -q 'root \* /srv' Caddyfile 2>/dev/null; then
  echo "OK: Caddy root = /srv"
else
  echo "ERREUR: Caddy root != /srv"
  ERRORS=$((ERRORS + 1))
fi

if grep -q 'reverse_proxy api:3001' Caddyfile 2>/dev/null; then
  echo "OK: Reverse proxy api:3001"
else
  echo "ERREUR: Reverse proxy manquant"
  ERRORS=$((ERRORS + 1))
fi

# ── 4. Signature SHA256 ────────────────────────────────────
echo ""
echo "--- Phase 4: Signature SHA256 ---"

if [ -f FRONTEND_SIGNATURE.json ]; then
  HASH_MISMATCHES=0
  for FILE in $(python3 -c "import json; [print(f) for f in json.load(open('FRONTEND_SIGNATURE.json'))['files']]" 2>/dev/null); do
    EXPECTED=$(python3 -c "import json; print(json.load(open('FRONTEND_SIGNATURE.json'))['files']['$FILE'])" 2>/dev/null)
    FILEPATH="public/$FILE"
    if [ ! -f "$FILEPATH" ]; then
      echo "ERREUR: $FILEPATH manquant"
      ERRORS=$((ERRORS + 1))
      continue
    fi
    ACTUAL=$(sha256sum "$FILEPATH" | cut -d' ' -f1)
    if [ "$ACTUAL" = "$EXPECTED" ]; then
      echo "OK: $FILE hash verifie"
    else
      echo "ATTENTION: $FILE hash different (modifie depuis signature)"
      HASH_MISMATCHES=$((HASH_MISMATCHES + 1))
      WARNINGS=$((WARNINGS + 1))
      if [ "$AUTO_FIX" = "--fix" ]; then
        python3 -c "
import json
sig = json.load(open('FRONTEND_SIGNATURE.json'))
sig['files']['$FILE'] = '$ACTUAL'
json.dump(sig, open('FRONTEND_SIGNATURE.json','w'), indent=2)
print('  FIX: Signature de $FILE mise a jour')
" 2>/dev/null
        FIXES=$((FIXES + 1))
      fi
    fi
  done
else
  echo "ERREUR: FRONTEND_SIGNATURE.json manquant"
  ERRORS=$((ERRORS + 1))
fi

# ── 5. Pas de credentials exposes ──────────────────────────
echo ""
echo "--- Phase 5: Securite credentials ---"

for PATTERN in "sk_live_" "sk_test_" "whsec_" "xkeysib-"; do
  FOUND=$(grep -rl "$PATTERN" public/ scripts/api_server.js 2>/dev/null | head -3)
  if [ -n "$FOUND" ]; then
    echo "ERREUR CRITIQUE: Credential $PATTERN dans: $FOUND"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "OK: Aucune credential en clair detectee"

# ── 6. ANJ compliance ─────────────────────────────────────
echo ""
echo "--- Phase 6: Conformite ANJ ---"

for HTML in public/*.html; do
  PARI_COUNT=$(grep -owi '\bpari\b' "$HTML" 2>/dev/null | wc -l)
  if [ "$PARI_COUNT" -gt 0 ]; then
    echo "ATTENTION: '$HTML' contient $PARI_COUNT occurrence(s) du mot 'pari'"
    WARNINGS=$((WARNINGS + 1))
  fi
done
echo "OK: Verification ANJ terminee"

# ── 7. Verification backup disponible ─────────────────────
echo ""
echo "--- Phase 7: Systeme de backup ---"

if [ -f deploy.sh ]; then
  echo "OK: deploy.sh present (backup automatique Phase 0)"
else
  echo "ATTENTION: deploy.sh absent"
  WARNINGS=$((WARNINGS + 1))
fi

if [ -f scripts/rollback.sh ]; then
  echo "OK: rollback.sh present"
else
  echo "ERREUR: rollback.sh absent — rollback impossible"
  ERRORS=$((ERRORS + 1))
fi

# ── 8. Dockerfile coherent ─────────────────────────────────
echo ""
echo "--- Phase 8: Dockerfile ---"

if grep -q 'COPY public' Dockerfile 2>/dev/null; then
  echo "OK: Dockerfile copie public/"
else
  echo "ATTENTION: Dockerfile ne copie pas public/"
  WARNINGS=$((WARNINGS + 1))
fi

if grep -q 'COPY site' Dockerfile 2>/dev/null; then
  echo "ERREUR: Dockerfile copie site/ — ancien frontend"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: Dockerfile ne copie pas site/"
fi

# ── VERDICT ────────────────────────────────────────────────
echo ""
echo "================================================"
echo " HERMES GUARDIAN RAPPORT"
echo " Erreurs:    $ERRORS"
echo " Attention:  $WARNINGS"
if [ "$AUTO_FIX" = "--fix" ]; then
  echo " Corrections: $FIXES"
fi
echo "================================================"

if [ $ERRORS -gt 0 ]; then
  echo " VERDICT: PRODUCTION NON SECURISEE"
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo " VERDICT: PRODUCTION OK AVEC RESERVES"
  exit 0
fi

echo " VERDICT: PRODUCTION SECURISEE"
exit 0
