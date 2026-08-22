# Coordination IA — TousLesMatchs

## Règle centrale
Le responsable communique avec GPT uniquement. GPT pilote, découpe les missions et valide les livraisons.

## Espaces
- Production : /opt/touslesmatchs — lecture seule sauf déploiement validé.
- Claude : /opt/touslesmatchs-claude — branche Claude uniquement.
- GPT : /opt/touslesmatchs-gpt — branche GPT uniquement.

## Zones Claude
Event Bus, Subscription Engine, Stripe, Brevo, Telegram et architecture backend.
Fichiers interdits à GPT : scripts/event-bus.js, scripts/subscription-engine.js, scripts/stripe-handler.js, scripts/brevo-subscriber.js, scripts/telegram-subscriber.js.

## Règles de livraison
- Une mission = une branche dédiée, un périmètre, des tests et un compte rendu.
- Aucun merge ni déploiement sans validation GPT.
- Lire CLAUDE.md avant toute mission Claude.
- Ne jamais supprimer de fichier ou écraser une branche existante.
