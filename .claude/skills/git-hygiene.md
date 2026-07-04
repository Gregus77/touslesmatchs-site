---
name: git-hygiene
description: >
  Nettoyage et gestion des branches Git. Sauvegarde avant toute operation destructive.
  S'assure que le travail est toujours sur la bonne branche.
trigger: auto
---

# Skill : Git Hygiene

## OBLIGATION
Ce skill s'execute automatiquement :
- Au debut de chaque session (verifier qu'on est sur la bonne branche)
- Avant toute operation Git destructive (merge, rebase, reset, delete)
- Quand l'utilisateur demande du nettoyage

## Procedure

### 1. Verification de branche
Au debut de chaque session :
```
git branch -a
git status
git log --oneline -5
```
- Verifier qu'on est sur la branche assignee dans les instructions systeme
- Si on n'est pas sur la bonne branche : `git checkout <bonne-branche>`
- Ne JAMAIS pusher sur main sans autorisation explicite

### 2. Sauvegarde avant operation destructive
Avant tout merge, rebase, reset, suppression de branche :
```
git stash -u  # si fichiers non commites
git branch backup-$(date +%Y%m%d-%H%M%S)  # sauvegarde locale
```
Ne JAMAIS supprimer une branche sans sauvegarde.

### 3. Nettoyage des branches
Quand demande :
- Lister toutes les branches locales et remote
- Identifier les branches orphelines (pas de remote, ou deja mergees)
- Proposer la suppression a l'utilisateur AVANT de supprimer
- Garder toujours : main, la branche de dev assignee, les backups recents

### 4. Merge vers main
Quand l'utilisateur demande de merger vers main :
1. Sauvegarder : `git branch backup-pre-merge-$(date +%Y%m%d)`
2. `git checkout main && git pull origin main`
3. `git merge <branche-feature> --no-edit`
4. Verifier qu'il n'y a pas de conflits
5. `git push origin main` SEULEMENT si l'utilisateur confirme
6. Ne PAS supprimer la branche feature apres merge sans demander

### 5. Regles strictes
- Ne JAMAIS faire `git push --force` sans autorisation
- Ne JAMAIS faire `git reset --hard` sans sauvegarde
- Ne JAMAIS supprimer des fichiers tracked sans verifier avec `git status` d'abord
- Toujours verifier `git diff` avant un commit
- Si un conflit de merge apparait : le montrer a l'utilisateur, ne pas deviner la resolution

### 6. Commande de deploiement
Toujours donner la commande de deploiement VPS adaptee :
```
cd /opt/touslesmatchs && git pull origin <branche> && docker compose up -d --build
```
Puis pour les operations admin (dans le container, pas sur le host) :
```
docker exec touslesmatchs-api node -e "<code>"
```
Ne JAMAIS donner `curl localhost` car le port n'est pas expose sur le host.
