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

### Niveau orange — mission Codex traçable
Une demande technique en langage naturel qui n'est pas une simple lecture est enregistrée dans `data/owner_missions/` avec :
- texte reçu ;
- source (texte ou voix) ;
- transcript si vocal ;
- niveau de risque ;
- statut `pending_review` ;
- `automatic_execution=true` uniquement pour les missions `review_required`.

`tlm-owner-mission-runner` prend ensuite la mission, crée un worktree Git isolé depuis `origin/main`, lance Codex avec le sandbox `workspace-write`, exécute les contrôles syntaxiques, committe et pousse une branche dédiée.

Si la phrase contient explicitement « déploie », « mets en production » ou « mets en place », le runner peut pousser cette branche vers `main` uniquement en fast-forward, uniquement si `main` n'a pas bougé et si aucun chemin protégé (workflows, Docker, déploiement, paiement/secrets) n'a été modifié. Sinon la branche reste isolée et Hermès le signale.

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

Les messages vocaux Telegram sont téléchargés par le bot puis transcrits avec Gemini en priorité, avec les fournisseurs de secours configurés si nécessaire.

La transcription ne contourne jamais les règles d'autorisation ou de confirmation. Une demande vocale suit exactement le même routage qu'une demande texte : lecture immédiate ou mission Codex.

Validation terrain du 5 octobre 2026 : la commande vocale naturelle via Telegram est validée. Le bot a correctement transcrit et interprété une demande propriétaire en français puis l'a transmise au flux Hermès/Codex.

## Rapport quotidien

Le Guardian en lecture seule produit un rapport propriétaire à 20 h (Europe/Paris) s'il est actif et si le bot/chat admin sont configurés.

## Séparation des responsabilités

- `scripts/api_server.js` / moteur sportif : décide selon la stratégie active.
- `scripts/tlm_guardian.py` : observe et signale.
- `scripts/tlm_owner_remote.py` : reçoit les commandes propriétaire.
- `scripts/tlm_owner_mission_runner.py` : exécute les missions techniques autorisées via Codex dans un worktree isolé.
- `scripts/tlm_hourly_director.py` : autoréparation technique limitée et allowlistée.

Hermès ne doit jamais devenir une seconde couche de filtrage sportif.

## Activation production — 5 octobre 2026

Déploiement via `.github/workflows/deploy-hermes-control-center.yml` : backup, tests, installation systemd de `tlm-hermes-guardian` et `tlm-owner-remote`, puis preuve runtime des règles Goal +0,5 (30–85, cote réelle 1,60, quorum 4/5). La console propriétaire reste sans shell arbitraire et sans pouvoir de décision sportive.

<!-- owner-runner-deploy-trigger 2026-10-05T18:13+02:00 -->
