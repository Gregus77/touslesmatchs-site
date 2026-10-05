# HERMÈS OWNER CONTROL — Console propriétaire

## Objectif

Telegram devient la télécommande propriétaire de TousLesMatchs.

### Niveau vert — lecture automatique
- état production ;
- live ;
- analyses/votes ;
- signaux ;
- Telegram ;
- budget ;
- disque ;
- incidents.

### Niveau orange — mission traçable
Une demande en langage naturel qui n'est pas une simple lecture est enregistrée dans `data/owner_missions/` avec :
- texte reçu ;
- source (texte ou voix) ;
- transcript si vocal ;
- niveau de risque ;
- statut `pending_review` ;
- `automatic_execution=false`.

### Niveau rouge — confirmation obligatoire
Aucune exécution automatique pour :
- banque, virement, paiement ;
- suppression destructive ;
- clés, mots de passe et secrets ;
- changement de règles sportives ;
- déploiement destructif ;
- action qui expose des données personnelles sensibles.

## Sécurité Telegram

Une commande n'est acceptée que si :
- l'identifiant utilisateur correspond à `TELEGRAM_ADMIN_USER_ID` ;
- le chat correspond à `TELEGRAM_ADMIN_CHAT_ID` ;
- le message n'est pas transféré ;
- l'émetteur n'est pas un bot/canal.

## Voix

Les messages vocaux Telegram peuvent être téléchargés par le bot puis transcrits via l'API Audio OpenAI avec le modèle configuré par `HERMES_TRANSCRIPTION_MODEL`.

La transcription ne contourne jamais les règles d'autorisation ou de confirmation.

## Rapport quotidien

Le Guardian en lecture seule produit un rapport propriétaire à 20 h (Europe/Paris) s'il est actif et si le bot/chat admin sont configurés.

## Séparation des responsabilités

- `scripts/api_server.js` / moteur sportif : décide selon la stratégie active.
- `scripts/tlm_guardian.py` : observe et signale.
- `scripts/tlm_owner_remote.py` : reçoit les commandes propriétaire.
- `scripts/tlm_hourly_director.py` : autoréparation technique limitée et allowlistée.

Hermès ne doit jamais devenir une seconde couche de filtrage sportif.
