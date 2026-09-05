# Pilier historique — décision propriétaire du 5 septembre 2026

Pour chaque pays du périmètre de recherche, collecter les première et deuxième
divisions nationales lorsqu'elles existent et sont disponibles auprès du fournisseur.
La collecte statistique n'autorise pas à elle seule la diffusion de signaux sur une division.

## Données obligatoires

- Cinq saisons antérieures, distinctes de la saison courante.
- Classement annuel de chaque équipe, points, nombre d'équipes et matchs joués.
- Résultats des matchs, buts marqués/encaissés et bilans domicile/extérieur.
- Fréquences Over/Under 2,5, BTTS, total +0,5 et équipe +0,5, avec effectifs.
- Comparaison des deux équipes rencontrées, moyenne des rangs et positions
  relatives sur les saisons disponibles, séparément pour chaque division.
- Comparaison avec la saison courante; promotions et relégations explicites.

Une place en D2 ne vaut pas une place en D1. Une année absente n'est jamais zéro.
Plusieurs groupes ou phases d'une saison doivent rester identifiés: ne pas
moyenner arbitrairement des classements de phases différentes. Le classement seul
ne suffit pas pour prédire le nombre de buts.

## Source de vérité et conservation

`scripts/long_history.js` contient le périmètre de recherche et le collecteur.
Les tables `long_history_catalog` et `long_history_data` de la base persistante
conservent les identifiants fournisseur, saisons, groupes, statistiques,
dates de récupération, URLs sources et lacunes.
`/api/historical-coverage` donne la couverture constatée, pas une promesse.
Le contexte historique enregistré est joint aux analyses du Concile.

La collecte respecte le budget API existant et réserve la priorité au live.
BTTS et +0,5 restent en observation; aucun changement de seuil, de modèle,
de quota financier ou de règle Telegram n'est autorisé par ce document.

## État initial constaté

Avant ce travail: classement courant et module +0,5 interrogeant quatre saisons
antérieures, avec trois saisons communes suffisantes. Aucun bilan exhaustif de
cinq saisons, par championnat et par équipe, n'était prouvé dans le code audité.
Ne pas annoncer la tâche complète tant que les données ne sont pas effectivement collectées.
