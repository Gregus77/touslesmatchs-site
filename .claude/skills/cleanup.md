---
name: cleanup
description: >
  Nettoyage complet : merge vers main, verification VPS, suppression branches mortes,
  verification containers Docker, et diagnostic si le site ne se met pas a jour.
trigger: auto
---

# Skill : Cleanup & Diagnostic

## QUAND UTILISER
- Quand le site ne se met pas a jour malgre un push
- Quand l'utilisateur dit "ca marche pas", "pas mis a jour", "toujours pareil"
- Avant de declarer un travail termine
- Quand on accumule trop de commits sur la branche de dev

## Procedure de diagnostic

### 1. Verifier que le code est bien pushe
```bash
git log --oneline -3
git status
```

### 2. Verifier quelle branche le VPS utilise
Le VPS peut pointer sur `main` alors que le travail est sur la branche de dev.
Deux solutions :
- **Merger vers main** puis deployer depuis main (preferable en production)
- **Deployer depuis la branche de dev** (rapide mais temporaire)

### 3. Commande de deploiement VPS
Depuis le VPS (SSH) :
```bash
cd /opt/touslesmatchs && git fetch origin && git pull origin <branche> && docker compose up -d --build
```
IMPORTANT : si le VPS est sur `main`, il faut soit :
- Merger la branche de dev dans main d'abord
- Ou faire `git checkout <branche-dev> && git pull origin <branche-dev>`

### 4. Verifier les containers Docker
```bash
docker ps                          # les 4 services tournent ?
docker logs touslesmatchs-api --tail 20   # erreurs au demarrage ?
docker logs touslesmatchs-site --tail 20  # Caddy OK ?
```

### 5. Verifier que l'API repond
Ne PAS utiliser `curl localhost:3001` — le port n'est pas expose.
```bash
docker exec touslesmatchs-api node -e "const http=require('http');http.get('http://localhost:3001/api/premium-teaser',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(d))})"
```

### 6. Nettoyage des branches
- Lister : `git branch -a`
- Supprimer les branches mortes locales : `git branch -d <nom>`
- Supprimer les branches mortes remote : `git push origin --delete <nom>`
- NE JAMAIS supprimer : main, la branche de dev assignee, stable-backup-*

### 7. Merge vers main (quand demande)
```bash
git checkout main
git pull origin main
git merge <branche-dev> --no-edit
git push origin main
```
Puis deployer : `cd /opt/touslesmatchs && git pull origin main && docker compose up -d --build`

## Roles des services Docker

| Container | Role | Fichier principal |
|-----------|------|-------------------|
| touslesmatchs-site | Caddy — sert les fichiers HTML/CSS/JS de /public | Caddyfile |
| touslesmatchs-api | Node.js — API, Stripe, Telegram, analytics, auto-concile | scripts/api_server.js |
| touslesmatchs-council | Python — Concile Hermes quotidien (11h59 Paris) | council/hermes.py |
| touslesmatchs-hermes-admin | Python — Bot Telegram admin | council/hermes_admin_bot.py |

## Verifications
- Si "Chargement..." reste affiche : l'API ne repond pas ou crash
- Si le contenu ne change pas : le VPS n'a pas pull la bonne branche
- Si un container restart en boucle : verifier les logs avec docker logs
- Si "connection refused" : le container API n'est pas demarre
