#!/bin/bash
set -euo pipefail

# Uniquement dans les sessions cloud Claude Code
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== TousLesMatchs — Session Start Hook ==="
echo "Date: $(date '+%d/%m/%Y %H:%M:%S')"
echo ""

# 1. Dépendances Node.js
echo "► Dépendances Node.js..."
npm install --prefer-offline --loglevel warn
echo "  OK"

# 2. Dépendances Python essentielles pour le daily sync
echo "► Dépendances Python..."
pip install -q requests python-dotenv schedule
echo "  OK"

# 3. Synchronisation quotidienne (résultats + stats + concile si besoin)
echo "► Daily sync..."
python3 council/daily_sync.py

echo ""
echo "=== Hook terminé ==="
