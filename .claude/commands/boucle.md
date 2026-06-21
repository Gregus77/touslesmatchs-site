# /boucle — Boucle d'amélioration continue TousLesMatchs

Tu es l'IA d'amélioration continue du projet TousLesMatchs. Ton seul but : améliorer le site et Hermès en continu, commit après commit, jusqu'à épuisement des tokens.

## RÈGLES ABSOLUES (toujours respecter)
- Branche : `claude/busy-bardeen-793p0k` UNIQUEMENT — jamais une autre
- Commit après CHAQUE amélioration fonctionnelle
- Push à la fin de chaque cycle
- Ne jamais modifier ce qui n'est pas cassé
- Ne jamais `git add -A` (risque de committer .env)
- Toujours `node --check` avant de committer du JS

## BOUCLE PRINCIPALE

Répète ces étapes en continu tant que des tokens sont disponibles :

### Étape 1 — État du projet (rapide, 30 sec max)
```bash
git log --oneline -10
git diff --stat HEAD
```
Lire seulement les fichiers directement concernés par la tâche choisie.

### Étape 2 — Choisir UNE tâche dans cette liste de priorité

**Priorité 1 — Bugs bloquants** (vérifier d'abord) :
- Routes API appelées côté front mais absentes dans api_server.js
- Fonctions JS appelées par onclick mais non définies
- Erreurs dans les logs console (patterns `[ERROR]`, `❌`)

**Priorité 2 — Qualité prédictions** :
- Améliorer les prompts du Concile IA (personas, instructions, contexte)
- Enrichir `computeLiveConstraints()` avec de nouveaux contextes tactiques
- Améliorer `getPerformanceContext()` pour mieux injecter l'historique
- Affiner `teamsMatch()` pour couvrir plus de variantes de noms

**Priorité 3 — Automatisation Hermès** :
- Nouvelles commandes Telegram utiles pour l'admin
- Meilleure gestion des erreurs dans les endpoints `/admin/*`
- Auto-résolution plus robuste des matchs terminés

**Priorité 4 — UX site** :
- Améliorer les messages d'erreur visibles par l'utilisateur
- Performance : réduire les appels API redondants
- Accessibilité et lisibilité des analyses IA

**Priorité 5 — Stats et mémoire** :
- Enrichir `/memoire` avec des statistiques plus utiles
- Ajouter des métriques de confiance par compétition
- Améliorer le classement des agents IA (leaderboard)

### Étape 3 — Implémenter la tâche choisie
- Lire UNIQUEMENT les fichiers nécessaires
- Modifier chirurgicalement (1 tâche = 1 zone de code)
- Vérifier la syntaxe : `node --check scripts/api_server.js`
- Tester mentalement : "est-ce que ça casse autre chose ?"

### Étape 4 — Valider et committer
```bash
node --check scripts/api_server.js  # si JS modifié
git add [fichiers spécifiques seulement]
git commit -m "feat/fix: description courte de ce qui a changé et pourquoi"
```

### Étape 5 — Continuer
Retourner à l'Étape 2 et choisir la prochaine tâche.

**Si les tokens sont faibles** : finir le commit en cours, push, et noter dans le dernier message ce qui restait à faire.

## FICHIERS CLÉS (ne lire que ce dont tu as besoin)

| Fichier | Rôle |
|---|---|
| `scripts/api_server.js` | Backend Node.js — matchs live, Concile IA, SQLite |
| `scripts/hermes_admin_bot.js` | Bot Telegram admin — commandes, publications |
| `public/live-ia.html` | Page Live IA — analyse temps réel |
| `public/index.html` | Page principale — picks, abonnements |
| `public/historique.html` | Historique des picks |
| `public/preuves.html` | Preuves de gains |

## ZONES D'AMÉLIORATION CONNUES (backog)

### Concile IA — Qualité
- [ ] Personas agents trop génériques → spécialiser chaque agent (stats, tactique, value, goals, synthèse)
- [ ] `computeLiveConstraints()` : ajouter contexte cartons rouges, fatigue fin de match
- [ ] Meilleure détection des matchs "ennuyeux" (équipes défensives, faible enjeu)
- [ ] Pondération dynamique des agents selon leur winrate récent (14 derniers jours)

### Hermès — Automatisation
- [ ] `/stats` : résumé hebdomadaire winrate auto envoyé chaque lundi
- [ ] Alerte automatique quand un agent IA atteint 70%+ de winrate
- [ ] `/preview` : prévisualiser le message avant publication
- [ ] Détection automatique du score final via football-data.org (sans /resolve manuel)

### Site — UX
- [ ] Indicateur de confiance global "Ce soir le Concile est à X% de précision"
- [ ] Historique des analyses live par match (timeline)
- [ ] Partage d'analyse sur réseaux sociaux (bouton share)

### Performance
- [ ] Cache Redis pour les résultats Concile fréquents
- [ ] Lazy loading des analyses dans l'historique

## FORMAT DE RAPPORT EN FIN DE SESSION

Quand les tokens approchent de la limite, écrire :

```
🔄 BOUCLE — Cycle N terminé
✅ Fait : [liste des commits]
⏭️ Prochain : [tâche prioritaire restante]
📊 État : [nb fichiers modifiés, nb commits]
```

Puis push et attendre la prochaine session.
