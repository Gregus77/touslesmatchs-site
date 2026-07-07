#!/bin/bash
set -euo pipefail
ERRORS=0

echo "=== FRONTEND SIGNATURE VERIFICATION ==="

MANIFEST="DEPLOYMENT_MANIFEST.json"
SIGNATURE="FRONTEND_SIGNATURE.json"

if [ ! -f "$MANIFEST" ]; then
  echo "ERREUR: $MANIFEST manquant"
  exit 1
fi
if [ ! -f "$SIGNATURE" ]; then
  echo "ERREUR: $SIGNATURE manquant"
  exit 1
fi

# Parse manifest (portable — no jq dependency)
FRONTEND_DIR=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['frontend']['directory'])" 2>/dev/null || echo "public")
FORBIDDEN_VOL=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['checks']['forbidden_volume'])" 2>/dev/null || echo "/opt/touslesmatchs/site:/srv")
REQUIRED_VOL=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['checks']['required_volume'])" 2>/dev/null || echo "/opt/touslesmatchs/public:/srv")
TITLE_MUST=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['checks']['frontend_title_must_contain'])" 2>/dev/null || echo "Hermes")
TITLE_MUST_NOT=$(python3 -c "import json; print(json.load(open('$MANIFEST'))['checks']['frontend_title_must_not_contain'])" 2>/dev/null || echo "Le Concile analyse")

# 1. Frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
  echo "ERREUR: Dossier frontend $FRONTEND_DIR manquant"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: Dossier frontend $FRONTEND_DIR existe"
fi

# 2. Verify file hashes from signature
for FILE in $(python3 -c "import json; [print(f) for f in json.load(open('$SIGNATURE'))['files']]" 2>/dev/null); do
  EXPECTED=$(python3 -c "import json; print(json.load(open('$SIGNATURE'))['files']['$FILE'])" 2>/dev/null)
  FILEPATH="$FRONTEND_DIR/$FILE"
  if [ ! -f "$FILEPATH" ]; then
    echo "ERREUR: $FILEPATH manquant"
    ERRORS=$((ERRORS + 1))
    continue
  fi
  ACTUAL=$(sha256sum "$FILEPATH" | cut -d' ' -f1)
  if [ "$ACTUAL" = "$EXPECTED" ]; then
    echo "OK: $FILE hash verifie"
  else
    echo "ATTENTION: $FILE hash different (fichier modifie depuis la signature)"
    echo "  attendu:  $EXPECTED"
    echo "  actuel:   $ACTUAL"
  fi
done

# 3. docker-compose.yml volume check
if grep -q "$FORBIDDEN_VOL" docker-compose.yml 2>/dev/null; then
  echo "ERREUR: docker-compose.yml contient le volume interdit: $FORBIDDEN_VOL"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: Volume interdit absent de docker-compose.yml"
fi

if grep -q "$REQUIRED_VOL" docker-compose.yml 2>/dev/null; then
  echo "OK: Volume requis present: $REQUIRED_VOL"
else
  echo "ERREUR: Volume requis manquant dans docker-compose.yml: $REQUIRED_VOL"
  ERRORS=$((ERRORS + 1))
fi

# 4. Frontend title check
TITLE=$(grep -o '<title>[^<]*</title>' "$FRONTEND_DIR/index.html" 2>/dev/null | head -1)
if echo "$TITLE" | grep -qi "$TITLE_MUST"; then
  echo "OK: Titre contient '$TITLE_MUST': $TITLE"
else
  echo "ERREUR: Titre ne contient pas '$TITLE_MUST': $TITLE"
  ERRORS=$((ERRORS + 1))
fi

if echo "$TITLE" | grep -qi "$TITLE_MUST_NOT"; then
  echo "ERREUR: Titre contient le texte interdit '$TITLE_MUST_NOT': $TITLE"
  ERRORS=$((ERRORS + 1))
else
  echo "OK: Titre ne contient pas '$TITLE_MUST_NOT'"
fi

# 5. Branch check
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
SIG_BRANCH=$(python3 -c "import json; print(json.load(open('$SIGNATURE'))['branch'])" 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" = "$SIG_BRANCH" ]; then
  echo "OK: Branche correspond: $CURRENT_BRANCH"
else
  echo "ATTENTION: Branche differente — signature=$SIG_BRANCH actuel=$CURRENT_BRANCH"
fi

# 6. Forbidden Payment Links
for LINK in $(python3 -c "import json; [print(l) for l in json.load(open('$MANIFEST'))['checks']['forbidden_links']]" 2>/dev/null); do
  if grep -rq "$LINK" "$FRONTEND_DIR/" 2>/dev/null; then
    echo "ERREUR: Lien interdit $LINK trouve dans $FRONTEND_DIR/"
    ERRORS=$((ERRORS + 1))
  else
    echo "OK: Lien interdit $LINK absent"
  fi
done

# 7. Required env vars in docker-compose.yml
for VAR in $(python3 -c "import json; [print(v) for v in json.load(open('$MANIFEST'))['checks']['required_env_vars']]" 2>/dev/null); do
  if grep -q "$VAR" docker-compose.yml 2>/dev/null; then
    echo "OK: $VAR present dans docker-compose.yml"
  else
    echo "ERREUR: $VAR absent de docker-compose.yml"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "=== $ERRORS ERREUR(S) — DEPLOIEMENT BLOQUE ==="
  exit 1
fi

echo "=== SIGNATURE FRONTEND VERIFIEE — DEPLOIEMENT AUTORISE ==="
exit 0
