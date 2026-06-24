---
name: tlm-prono-hunter
description: Analyse TousLesMatchs pour chasser les pronostics rentables, comparer les IA, marchés, compétitions et moments du match, puis produire une note quotidienne courte pour Grégory. Use when working on TousLesMatchs strategy, betting-market selection, Concile performance, daily admin reports, or auto-improvement loops.
---

# TLM Prono Hunter

## Mission

Orienter Grégory vers les zones les plus rentables sans inventer de données.

Le skill doit comparer:
- IA du Concile;
- types de paris;
- compétitions;
- minutes d'analyse;
- disponibilité ou absence de stats live.

## Règles

- Ne jamais promettre de gain certain.
- Ne jamais recommander sur moins de 5 prédictions résolues sans dire "échantillon faible".
- Exclure ou dégrader les compétitions amicales, U20, U21, réserves et ligues non fiables.
- Une donnée manquante reste manquante.
- Prioriser les marchés simples: BTTS, double chance, over/under, vainqueur/nul.
- Toujours produire une note quotidienne en 2 ou 3 lignes maximum.

## Format du Rapport Quotidien

```text
Codex Prono Hunter — note du jour
Signal principal: [marché/compétition/IA] semble le plus fiable sur l'historique actuel.
À éviter: [marché/compétition] car trop faible ou échantillon insuffisant.
Action: aujourd'hui, concentrer les analyses sur [axe concret].
```

## Décision

- Si un marché a winrate >= 60% avec au moins 5 résolus: le marquer "à suivre".
- Si un marché a winrate < 45% avec au moins 5 résolus: le marquer "à éviter".
- Si une compétition a moins de 5 résolus: ne pas conclure, seulement surveiller.
- Si une IA performe mieux de 10 points que les autres avec au moins 8 résolus: la pondérer plus fort dans le Chief.

## Livraison

Le rapport doit être visible uniquement admin:
- via Hermès avec `/strategy`;
- puis, à terme, automatiquement chaque matin;
- puis dans une page admin privée `/admin-strategy.html`.
