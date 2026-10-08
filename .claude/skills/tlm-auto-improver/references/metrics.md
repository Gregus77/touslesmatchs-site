# Métriques et protocole de backtest — TLM Auto Improver

## Backtest chronologique

Ne jamais mélanger aléatoirement passé et futur. Trier les décisions par date.

- apprentissage : les 70 % plus anciens ;
- validation : les 15 % suivants ;
- test final : les 15 % les plus récents.

Si N est faible, utiliser des fenêtres chronologiques roulantes et ne pas
promouvoir automatiquement.

## Score de promotion

Une hypothèse est éligible seulement si elle améliore au moins un critère
principal sans détériorer fortement les autres :

- winrate corrigé de la taille d'échantillon ;
- ROI sur cotes réelles ;
- drawdown maximum ;
- calibration ;
- volume de signaux restant suffisant.

Une amélioration de winrate obtenue en supprimant presque tous les signaux
n'est pas automatiquement meilleure.

## Journal minimal d'expérience

Conserver :

- experiment_id ;
- date de création ;
- hypothèse ;
- configuration témoin ;
- configuration candidate ;
- période de backtest ;
- N train / validation / test ;
- métriques avant/après ;
- décision : reject / shadow / promote / rollback ;
- motif ;
- date d'activation ;
- date de rollback éventuelle.

## Seuils

- N < 10 : pure observation.
- 10 <= N < 30 : tendance, jamais auto-promue.
- 30 <= N < 50 : auto-promotion possible uniquement pour ajustement mineur.
- N >= 50 : échantillon minimal recommandé pour modification de poids/filtre.
- Changement d'une règle dure : toujours validation explicite du fondateur.
