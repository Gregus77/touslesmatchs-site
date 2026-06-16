#!/bin/bash
cd /opt/touslesmatchs
set -a
. ./.env
set +a

echo "=== HERMES MORNING $(date) ===" >> /opt/touslesmatchs/logs/hermes_morning.log
npm run hermes:run >> /opt/touslesmatchs/logs/hermes_morning.log 2>&1
echo "=== END $(date) ===" >> /opt/touslesmatchs/logs/hermes_morning.log
