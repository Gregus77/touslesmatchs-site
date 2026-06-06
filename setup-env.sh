#!/bin/bash
# ============================================================
# SETUP .env sur le VPS — TousLesMatchs
# Usage : bash setup-env.sh
# ============================================================

set -e
ENV_FILE="/opt/touslesmatchs/.env"

echo "=== Configuration .env TousLesMatchs ==="

read -p "TELEGRAM_BOT_TOKEN (depuis @BotFather) : " TG_TOKEN
read -p "TELEGRAM_CHAT_ID (ton canal, ex: -100123456) : " TG_CHAT
read -p "GROQ_API_KEY : " GROQ_KEY
read -p "DEEPSEEK_API_KEY : " DS_KEY
read -p "RAPIDAPI_KEY : " RAPID_KEY
read -p "TELEGRAM_ADMIN_BOT_TOKEN (ou appuie Entrée pour ignorer) : " TG_ADMIN
read -p "TELEGRAM_ADMIN_ID (ton Telegram user ID, ou Entrée) : " TG_ADMIN_ID

cat > "$ENV_FILE" << EOF
# Telegram
TELEGRAM_BOT_TOKEN=${TG_TOKEN}
TELEGRAM_CHAT_ID=${TG_CHAT}
TELEGRAM_ADMIN_BOT_TOKEN=${TG_ADMIN}
TELEGRAM_ADMIN_ID=${TG_ADMIN_ID}

# IAs
GROQ_API_KEY=${GROQ_KEY}
DEEPSEEK_API_KEY=${DS_KEY}

# Sport data
RAPIDAPI_KEY=${RAPID_KEY}

# Stripe (à remplir quand disponible)
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID_PREMIUM=
STRIPE_PRICE_ID_VIP=
STRIPE_PRICE_ID_ELITE=
EOF

chmod 600 "$ENV_FILE"
echo ""
echo "✅ .env créé dans $ENV_FILE"
echo ""
echo "Redémarrage des services..."
cd /opt/touslesmatchs
docker compose up -d
echo "✅ Tous les services redémarrés avec les nouvelles variables."
