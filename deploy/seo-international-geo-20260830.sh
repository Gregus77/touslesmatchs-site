#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
REF="origin/codex/upcoming-all-now-tomorrow-20260830"
OUT="/tmp/tlm-seo-international-full.sh"
EXPECTED="b5964edd2daa05293c19bb6d4678c499aeb799f56974d5b7e683238b107da870"
: > "$OUT"
for p in 00 01 02 03 04; do
  git show "$REF:deploy/seo-i18n.part$p" >> "$OUT"
done
ACTUAL="$(sha256sum "$OUT" | awk '{print $1}')"
echo "PAYLOAD_SHA256=$ACTUAL"
[ "$ACTUAL" = "$EXPECTED" ] || { echo "ERREUR: payload SEO incomplet ou altéré — aucune modification du site"; exit 1; }
bash -n "$OUT"
echo "Payload vérifié. Lancement du déploiement SEO/GEO sécurisé."
bash "$OUT"
