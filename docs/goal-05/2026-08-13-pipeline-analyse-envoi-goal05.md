# Pipeline Goal 0.5 IA — analyse puis envoi Telegram

Objectif : démarrer les analyses +0,5 sans jamais envoyer un faux signal.

## Fonctionnement

1. Le scanner lit les matchs candidats.
2. Il vérifie que toutes les données nécessaires sont présentes.
3. Il applique le moteur `plus05_engine`.
4. Il bloque tout match incomplet ou refusé.
5. Il envoie dans le canal Telegram +0,5 uniquement si le statut final est `ELIGIBLE_SHADOW`.

## Sécurités actives

- Pas de coupe : seulement championnats.
- Pays autorisés uniquement.
- Cache historique accepté sur 3, 4 ou 5 saisons.
- Force historique minimale : l'équipe visée doit être nettement au-dessus.
- Équipe visée : équipe historiquement forte, pas forcément à domicile.
- Forme récente : elle doit avoir marqué sur les 5 derniers matchs.
- Buts construits : préférence aux buts issus d'actions/passes, pas aux penalties isolés.
- Adversaire : il doit avoir encaissé sur les 5 derniers matchs.
- Enjeu : place à prendre ou place à défendre.
- Cote bêta : marché équipe +0,5 but chez bookmaker ANJ à 1.30 minimum.
- Anti-doublon : un signal déjà envoyé n'est pas renvoyé.

## Mode test local

Commande :

```bash
node scripts/goal05_scan_and_notify.js
```

Ce mode génère un rapport mais n'envoie rien.

## Mode envoi réel

L'envoi réel doit être activé volontairement :

```bash
GOAL05_SEND_TELEGRAM=1 node scripts/goal05_scan_and_notify.js
```

Le serveur doit aussi avoir :

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_GOAL05_CHANNEL_ID` ou `TELEGRAM_GOAL05_CHAT_ID`

Important : le lien d'invitation Telegram sert aux inscrits bêta. Pour envoyer des signaux, il faut l'identifiant du canal/groupe Telegram +0,5.
