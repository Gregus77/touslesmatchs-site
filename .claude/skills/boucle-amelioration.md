# /boucle-amelioration — Boucle d'amélioration continue

Tu es le moteur d'amélioration de TousLesMatchs. Ton rôle : analyser les données réelles, détecter ce qui ne fonctionne pas, et implémenter des corrections concrètes dans le code.

## Ce que tu fais à chaque invocation

### Phase 0 — Audit initial
```bash
git log --oneline -10  # quels changements récents ?
git diff --stat HEAD   # modifications en cours ?
node --check scripts/api_server.js
node --check scripts/hermes_admin_bot.js
```

### Phase 1 — Performance Concile
Requête sur les données réelles :
```
GET /api/admin/concile-perf?email=...&code=...
```
Ou lire directement la DB SQLite si accessible.

Analyser :
- **Agents** : quel agent a le meilleur winrate sur 30+ prédictions ?
  - Si un agent a < 45% winrate sur 20+ prédictions → renforcer son prompt
  - Si DeepSeek-V3 diverge souvent des autres ET a raison → augmenter son poids
- **Marchés** : Over/Under vs 1X2 vs BTTS — lequel gagne le plus ?
  - Blacklister les marchés avec < 40% winrate sur 15+ picks
- **Minutes** : à quelle minute les analyses sont-elles les plus fiables ?
  - Si 45-60' est mieux que 30-45' → ajuster le filtre AUTO_CONCILE

### Phase 2 — Seuil de confiance
- Calculer la corrélation entre `confidence` et `outcome` dans `concile_analyses`
- Si les picks >85% gagnent moins de 55% → le seuil est surestimé → abaisser à 80% pour les signaux forts
- Si les picks >80% gagnent plus de 70% → le seuil est bon, ne pas toucher

### Phase 3 — Détection de dérives
Chercher des patterns problématiques :
- Plus de 3 pertes consécutives sur le même sport → ajouter une note dans le prompt du Chief
- Score toujours 0-0 à la 60' → vérifier que Over 2.5 n'est pas recommandé
- Trop de "NO BET" → vérifier que les filtres ne sont pas trop restrictifs

### Phase 4 — Amélioration du code
Sur la base des phases 1-3, implémenter UNE correction à la fois :
1. Lire le fichier concerné
2. Faire la modification minimale
3. `node --check` si JS
4. Tester manuellement si possible
5. Committer avec un message clair
6. Pousser sur `claude/happy-bell-h9zj83`

### Phase 5 — Amélioration UX
Lire les 3 derniers items de `leads.json` pour comprendre d'où viennent les visiteurs.
Vérifier que :
- La page Live IA charge en < 3 secondes (CSS inline, pas de gros JS bloquants)
- Les cartes de match affichent toutes les infos (sport, heure, championnat, confiance)
- Le pick du jour est visible immédiatement sur mobile (above the fold)

### Phase 6 — Amélioration des prompts IA
Si les agents donnent des raisons vagues ("l'équipe est forte"), renforcer leurs prompts :
- Forcer l'utilisation de données concrètes ("xG", "forme 5 matchs", "H2H")
- Pénaliser les raisonnements circulaires
- Ajouter des exemples de bonne réponse dans le prompt du Chief

## Règles d'implémentation
- Une correction par phase, pas tout à la fois
- Toujours backup (git) avant de toucher un algo core
- JAMAIS modifier `computeLiveConstraints`, `fetchMatchStats`, `fetchMatchStatsForMatch`
- Si tu modifies `runConcileAnalysis`, tester avec un match fictif

## Format rapport
```
BOUCLE AMÉLIORATION — [date]

DONNÉES ANALYSÉES : [N] analyses, [N] résolues
WINRATE GLOBAL : [X]%

PROBLÈMES DÉTECTÉS :
→ [problème 1] — priorité [haute/moyenne/faible]
→ [problème 2] — priorité [haute/moyenne/faible]

CORRECTIONS APPLIQUÉES :
→ [fichier:ligne] — [description]

IMPACT ESTIMÉ : +[X]% winrate / -[Y]% faux signaux

PROCHAINE ITÉRATION : dans [7 jours / après N picks]
```
