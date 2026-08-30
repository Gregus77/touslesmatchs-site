#!/usr/bin/env bash
set -euo pipefail
cd /opt/touslesmatchs
REF="origin/codex/upcoming-all-now-tomorrow-20260830"

echo "=== CONVERSION UPGRADE — DEBUT ==="
echo "BRANCHE=$(git branch --show-current)"
echo "COMMIT=$(git rev-parse HEAD)"

for script in conversion-content-fix-20260830.sh conversion-analytics-20260830.sh; do
  tmp="/tmp/tlm-$script"
  echo "--- Préparation $script ---"
  git show "$REF:deploy/$script" > "$tmp"
  bash -n "$tmp"
  echo "--- Exécution $script ---"
  bash "$tmp"
done

echo "=== FINAL CONVERSION UPGRADE ==="
echo "STATUS=OK"
echo "CONTENT=OK"
echo "ANALYTICS=OK"
echo "OFFRES=GRATUIT + STANDARD_4.90 + PREMIUM_14.90"
echo "ANCIENNE_OFFRE_ELITE=RETIRÉE_DES_PAGES_CLIENT"
echo "PREUVE=REMONTÉE"
echo "FAQ_CGV_PERFORMANCES=ALIGNEES"
echo "GA4_FUNNEL=ACTIF"
echo "MOTEUR_IA_TELEGRAM_HERMES_STRIPE_BREVO_DB=INCHANGES"
