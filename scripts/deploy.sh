#!/bin/bash
# ── Déploiement TousLesMatchs — durci contre le bug "vieille version site/" ────
#
# 3 garde-fous ajoutés (juillet 2026, après incident web-root site/) :
#   G1  Pré-vol  : refuse de déployer s'il y a des modifs locales non commitées
#                  (c'est ce qui bloquait silencieusement les pull pendant des jours)
#   G2  Intégrité: refuse si docker-compose.yml sert site/ au lieu de public/
#                  (le bug qui servait la vieille page 42 Ko sans widgets)
#   G3  Post-vol : la page servie DOIT faire > 100 Ko ET contenir widgets.js,
#                  sinon FAIL bruyant + alerte Telegram admin
#
# Usage sur le VPS :  bash /opt/touslesmatchs/scripts/deploy.sh
set -euo pipefail

REPO="/opt/touslesmatchs"
BRANCH="agent/android-fcm-v107"
DOMAIN="https://www.touslesmatchs.com"
MIN_BYTES=40000              # nouvelle page d'accueil ~49 Ko (design "dash wrap", sans widgets.js)
cd "$REPO"

# Alerte Telegram admin (best-effort, ne bloque jamais le script)
alert() {
  docker exec touslesmatchs-api sh -c '
    test -n "${TELEGRAM_BOT_TOKEN:-}" && test -n "${TELEGRAM_ADMIN_CHAT_ID:-}" && \
    wget -qO- --post-data="chat_id=$TELEGRAM_ADMIN_CHAT_ID&text=$0" \
      "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" >/dev/null 2>&1
  ' "🚨 DEPLOY $1" 2>/dev/null || true
}

fail() { echo "❌ $1"; alert "$1"; exit 1; }

# ── G1 — Pré-vol : aucune modif locale non commitée (hors site/ généré) ──────
# On ignore site/ : contenu régénéré en continu par le Concile Hermès, il ne
# doit jamais bloquer un déploiement. On ne surveille que le code et la config.
echo "▶ 1/6 — Garde-fou : modifs locales non commitées ?"
DIRTY="$( { git diff --name-only; git diff --cached --name-only; } | sort -u | grep -v '^site/' || true )"
if [ -n "$DIRTY" ]; then
  echo "   ⚠️  Fichiers code/config modifiés localement sur le VPS :"
  echo "$DIRTY" | sed 's/^/     /'
  fail "Modifs locales non commitées (hors site/) — elles bloquent le pull. Fais 'git stash' d'abord."
fi
echo "   OK — code/config propre (site/ généré ignoré)"

echo "▶ 2/6 — Récupération du code (branche $BRANCH)…"
git fetch origin "$BRANCH"
git checkout -B "$BRANCH" "origin/$BRANCH"

# ── G2 — Intégrité : web root = public/, jamais site/ ────────────────────────
echo "▶ 3/6 — Garde-fou : web root doit être public/ …"
if grep -qE '^\s*-\s*/opt/touslesmatchs/site:/srv' docker-compose.yml; then
  fail "docker-compose.yml sert site/ au lieu de public/ (bug vieille version). Corrige le montage."
fi
if ! grep -qE '^\s*-\s*/opt/touslesmatchs/public:/srv' docker-compose.yml; then
  fail "docker-compose.yml ne monte pas public/ sur /srv. Montage web root introuvable."
fi
echo "   OK — public/ → /srv"

echo "▶ 4/6 — Reconstruction des images…"
docker compose up -d --build

echo "▶ 5/6 — Redémarrage du serveur web…"
docker compose up -d --force-recreate site >/dev/null
sleep 4

# ── G3 — Post-vol : la page servie est-elle la bonne ? ───────────────────────
echo "▶ 6/6 — Garde-fou : la page en ligne est-elle la bonne version ?"
docker logs touslesmatchs-api --tail 40 2>&1 | grep -q "running on" \
  && echo "   API   : OK" || echo "   API   : ⚠️ vérifier les logs"

PAGE="$(curl -sk "$DOMAIN/")"
BYTES=$(printf '%s' "$PAGE" | wc -c)
HASMARKER=$(printf '%s' "$PAGE" | grep -c 'dash wrap' || true)
echo "   Taille page : ${BYTES} octets (min ${MIN_BYTES})"
echo "   dash wrap   : ${HASMARKER} (attendu ≥ 1)"

if [ "$BYTES" -lt "$MIN_BYTES" ] || [ "$HASMARKER" -lt 1 ]; then
  fail "Page servie invalide (${BYTES} o, marker=${HASMARKER}). Probable retour du bug site/. Vérifie le montage."
fi

# ── G4 — Test de fumée : les endpoints critiques répondent-ils "ok":true ? ──
# Ajouté le 02/08/2026 après un déploiement qui n'avait rien cassé côté code
# mais qu'on a mis du temps à disculper faute de vérification automatique.
# But : savoir en 10 secondes, à chaque déploiement, si quelque chose de
# fonctionnel est cassé — avant que ce soit l'utilisateur qui le découvre.
echo "▶ 7/7 — Garde-fou : test de fumée des endpoints critiques…"
smoke_check() {
  local label="$1" url="$2"
  local body attempt
  # Jusqu'à 5 tentatives (5s d'écart) : une migration ponctuelle lourde au
  # démarrage (ex: backfill sur des dizaines de milliers de lignes) peut
  # retarder l'API de plus que le délai fixe d'avant — on ne veut pas
  # confondre "encore en train de démarrer" avec "vraiment cassé".
  for attempt in 1 2 3 4 5; do
    body="$(curl -sk --max-time 8 "$url" || echo '')"
    if printf '%s' "$body" | grep -q '"ok":true'; then
      echo "   ✅ $label"
      return 0
    fi
    [ "$attempt" -lt 5 ] && sleep 5
  done
  echo "   ❌ $label — réponse: $(printf '%s' "$body" | head -c 200)"
  SMOKE_FAILED=1
}
SMOKE_FAILED=0
smoke_check "current-pick"      "$DOMAIN/current-pick"
smoke_check "live-matches"      "$DOMAIN/live-matches"
smoke_check "signal-fort-stats" "$DOMAIN/signal-fort-stats"
smoke_check "analysis-history"  "$DOMAIN/api/analysis-history?limit=1"
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_CODE:-}" ]; then
  smoke_check "agent-performance (admin)" "$DOMAIN/api/agent-performance?email=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$ADMIN_EMAIL")&code=$ADMIN_CODE"
else
  echo "   ⏭️  agent-performance ignoré (lance avec ADMIN_EMAIL=... ADMIN_CODE=... bash scripts/deploy.sh pour l'inclure)"
fi
if [ "$SMOKE_FAILED" -ne 0 ]; then
  fail "Au moins un endpoint critique ne répond pas correctement après déploiement — vérifie les logs (docker logs touslesmatchs-api --tail 80) avant d'annoncer que c'est en ligne."
fi

echo "✅ Déploiement OK — bonne version en ligne, endpoints critiques vérifiés — $(date '+%H:%M')"
