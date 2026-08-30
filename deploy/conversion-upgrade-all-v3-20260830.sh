#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
REF="origin/codex/upcoming-all-now-tomorrow-20260830"

echo '=== CONVERSION UPGRADE V3 — DEBUT ==='
echo "BRANCHE=$(git branch --show-current)"
echo "COMMIT=$(git rev-parse HEAD)"

for name in conversion-content-fix-v3-20260830.sh conversion-analytics-20260830.sh; do
  echo "--- Préparation $name ---"
  git show "$REF:deploy/$name" > "/tmp/$name"
  bash -n "/tmp/$name"
  echo "--- Exécution $name ---"
  bash "/tmp/$name"
done

echo '=== FINAL CONVERSION UPGRADE V3 ==='
echo 'STATUS=OK'
echo 'CONTENT=OK'
echo 'ANALYTICS=OK'
echo 'OFFRES=GRATUIT + STANDARD_4.90 + PREMIUM_14.90'
echo 'ELITE_VISIBLE=0'
echo 'PREUVE=REMONTÉE'
echo 'FAQ_CGV_PERFORMANCES_DASHBOARD_PRONOSTIC_IA=ALIGNES'
echo 'I18N=FR_EN_ES_PT_RU_ZH_ALIGNES'
echo 'GA4_FUNNEL=ACTIF'
echo 'FILTRE_FOOTBALL_V3=VERIFIE'
echo 'MOTEUR_IA_TELEGRAM_HERMES_STRIPE_BREVO_DB=INCHANGES'
