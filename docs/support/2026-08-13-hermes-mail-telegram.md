# Support Hermès : emails vers Telegram

Objectif : recevoir dans Telegram les messages envoyés à `hermes@touslesmatchs.com`, sans devoir ouvrir la boîte mail.

## V1 prudente

- Le VPS lit les emails non lus via IMAP Hostinger.
- Chaque email est envoyé dans le groupe Telegram support.
- Hermès propose une réponse simple.
- Le bot ne répond pas automatiquement au client.
- L'email est marqué comme lu seulement après l'envoi Telegram réussi.

## Variables VPS

- `HERMES_SUPPORT_IMAP_HOST=imap.hostinger.com`
- `HERMES_SUPPORT_IMAP_PORT=993`
- `HERMES_SUPPORT_IMAP_USER=hermes@touslesmatchs.com`
- `HERMES_SUPPORT_IMAP_PASSWORD` à saisir directement sur le VPS, jamais dans Codex.
- `TELEGRAM_SUPPORT_CHAT_ID=-5547143143`

## Cron conseillé

Toutes les 5 minutes :

```cron
*/5 * * * * cd /opt/touslesmatchs && set -a && . ./.env && set +a && python3 scripts/hermes_mail_to_telegram.py >> logs/hermes-support-mail.log 2>&1
```
