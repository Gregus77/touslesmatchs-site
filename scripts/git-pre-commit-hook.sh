#!/bin/bash
# Git pre-commit hook — LOCKDOWN V1.1
# Installe avec: cp scripts/git-pre-commit-hook.sh .git/hooks/pre-commit
set -euo pipefail

ERRORS=0

# 1. Bloquer les commits qui restaurent les anciens dossiers
for DIR in site/index.html src/App.js dist/index.html nginx/nginx.conf; do
  if git diff --cached --name-only | grep -q "^$DIR"; then
    echo "BLOQUE: Commit contient $DIR — dossier deprecated"
    ERRORS=$((ERRORS + 1))
  fi
done

# 2. Bloquer les credentials
for PATTERN in "sk_live_" "sk_test_" "whsec_" "xkeysib-" "BREVO_API_KEY=" "STRIPE_SECRET_KEY="; do
  if git diff --cached | grep -q "$PATTERN"; then
    echo "BLOQUE: Credential detectee dans le diff ($PATTERN)"
    ERRORS=$((ERRORS + 1))
  fi
done

# 3. Bloquer .env
if git diff --cached --name-only | grep -q "^\.env"; then
  echo "BLOQUE: .env ne doit jamais etre committe"
  ERRORS=$((ERRORS + 1))
fi

# 4. Verifier que docker-compose.yml ne monte PAS site:/srv
if git diff --cached --name-only | grep -q "docker-compose.yml"; then
  if git show :docker-compose.yml 2>/dev/null | grep -q '/opt/touslesmatchs/site:/srv'; then
    echo "BLOQUE: docker-compose.yml monte site:/srv — interdit"
    ERRORS=$((ERRORS + 1))
  fi
fi

# 5. ANJ — mot "pari" dans les pages publiques
for HTML in $(git diff --cached --name-only | grep "^public/.*\.html$"); do
  if git show ":$HTML" 2>/dev/null | grep -owi '\bpari\b' > /dev/null; then
    echo "ATTENTION: Le mot 'pari' detecte dans $HTML (ANJ)"
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo "=== PRE-COMMIT BLOQUE — $ERRORS erreur(s) ==="
  exit 1
fi

exit 0
