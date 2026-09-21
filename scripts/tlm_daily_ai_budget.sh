#!/usr/bin/env bash
set -euo pipefail

cd /opt/touslesmatchs
DAY=$(TZ=Europe/Paris date +%u)

case "$DAY" in
  1|2|3|4)
    TOTAL="1.50"; CONCILE="1.25"; HERMES="0.25"; PROFIL="LUN-JEU"
    ;;
  5)
    TOTAL="2.00"; CONCILE="1.70"; HERMES="0.30"; PROFIL="VENDREDI"
    ;;
  6|7)
    TOTAL="3.00"; CONCILE="2.70"; HERMES="0.30"; PROFIL="WEEK-END"
    ;;
esac

sed -i \
  -e "s/^OPENROUTER_DAILY_BUDGET_EUR=.*/OPENROUTER_DAILY_BUDGET_EUR=${TOTAL}/" \
  -e "s/^OPENROUTER_CONCILE_DAILY_BUDGET_EUR=.*/OPENROUTER_CONCILE_DAILY_BUDGET_EUR=${CONCILE}/" \
  -e "s/^OPENROUTER_HERMES_DAILY_BUDGET_EUR=.*/OPENROUTER_HERMES_DAILY_BUDGET_EUR=${HERMES}/" \
  .env

echo "profil=${PROFIL} total=${TOTAL} concile=${CONCILE} hermes=${HERMES}"
