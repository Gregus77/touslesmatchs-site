# /tokens — Économiser les tokens

## Quand utiliser /compact
- Dès que tu vois "context > 50%" ou que la conversation dure depuis plus de 30 messages
- Avant de commencer une nouvelle grosse tâche (lecture de fichiers, boucles d'édition)
- Quand Claude commence à répéter des infos ou à oublier des décisions récentes

## Quand démarrer une nouvelle session
- Context > 80% → nouvelle session obligatoire
- En début de nouvelle session, colle TOUJOURS le résumé projet (disponible dans le JSONL ou demande à Claude de le générer avec `/chef`)

## Règles anti-gaspillage
1. **Lis uniquement ce dont tu as besoin** : utilise `offset` + `limit` dans Read, Grep ciblé plutôt que lecture complète
2. **Un seul Read par fichier par session** : ne relis pas un fichier que tu viens d'éditer
3. **Outils parallèles** : groupe les Read/Grep indépendants dans le même message
4. **Pas de narration** : demande à Claude de ne pas expliquer ce qu'il va faire, juste le faire
5. **Commits fréquents** : commit après chaque tâche fonctionnelle pour ne jamais perdre de travail

## Restaurer le contexte projet rapidement
1. Lance `/chef` → redonne les règles absolues et l'état du projet
2. Colle le résumé de session précédente si disponible
3. Dis explicitement à Claude : "Tu sais déjà X, ne le réexplique pas"

## Fichiers critiques (ne lire que si nécessaire)
- `public/index.html` — page principale (1500+ lignes, coûteux à lire entier)
- `public/live-ia.html` — page Live IA
- `.claude/skills/verify.md` — règles projet
- `docker-compose.yml` — config services

## Branche VPS — rappel rapide
- VPS = `claude/busy-bardeen-793p0k` UNIQUEMENT
- `claude/happy-bell-h9zj83` = INTERDIT sur VPS (vieille version)
