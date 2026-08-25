# GOAL 0.5 IA - conditions actives moteur

Date: 2026-08-13
Statut: beta technique, seuil cote `1.30` pour verifier la sortie des signaux.
Objectif commercial futur: revenir vers un seuil plus selectif apres preuve du tuyau Telegram/API.

## Sorties possibles

- `NO_BET`: refus, le match ne doit pas etre envoye.
- `WATCHLIST_SHADOW`: interessant a suivre, mais pas signal Telegram payant.
- `ELIGIBLE_SHADOW`: dossier complet, peut etre journalise et controle avant diffusion.

## Conditions dures de refus

- Pays hors perimetre.
- Match non championnat: coupe/barrage exclu.
- Equipe candidate non identifiee domicile/exterieur.
- Table historique non chargee ou ecart historique insuffisant.
- Moins de 3 saisons historiques exploitables.
- Ecart historique cible: au moins 40 points de percentile.
- Enjeu de classement non demontre.
- Faux enjeu: pas de changement de zone sportive.
- L'equipe avec enjeu n'est pas le cote fort.
- Les 5 derniers matchs ne sont pas lus du plus ancien au plus recent.
- Equipe candidate non buteuse sur les 5 derniers matchs.
- Moins de 3 preuves de buts construits/assistes.
- L'equipe ne rentre pas dans un etat ou elle marque.
- Preuve specifique +0,5 trop faible.
- Adversaire non encaissant sur les 5 derniers matchs.
- Adversaire ne rentre pas dans un etat ou il encaisse.
- La candidate ne peut pas reproduire les patterns qui ont fait encaisser l'adversaire.
- L'adversaire encaisse surtout contre plus fort que la candidate.
- Marche exact equipe +0,5 absent chez bookmaker ANJ.
- Cote ANJ inferieure a `1.30` pendant la beta technique.

## Conditions watchlist / prudence

Ces points ne refusent pas toujours, mais empechent de vendre trop vite le signal:

- Place inhabituelle mais projet reel: verification renforcee.
- Equipe buteuse mais caractere offensif faible.
- Reaction offensive tardive repetee.
- Intensite positive sans but.
- Equipe attendue leader mais tempo non impose.
- Buts recents tardifs ou penalties: preuve reduite.
- Adversaire a encaisse contre equipe faible/malade: vulnerabilite renforcee.
- Douleur psychologique recente des buts encaisses.
- Pattern de craquage defensif tardif ou rapide.
- Historique 3 saisons: accepte, mais prudence renforcee.
- Cote entre 1.30 et 1.60: signal beta/test, pas seuil commercial final.

## Champs moteur importants

- `fiveYearStrength.levelTableLoaded`
- `fiveYearStrength.seasonsAvailable`
- `fiveYearStrength.teamPercentile`
- `fiveYearStrength.opponentPercentile`
- `recent.recentMatchesOrder = oldest_to_newest`
- `recent.scoringState`
- `recent.scoringStateWithCharacter`
- `recent.goal05SpecificEvidence`
- `recent.opponentConcedesState`
- `recent.candidateCanReproduceConcessionPattern`
- `recent.candidateLevelMatchesPriorScorers`
- `recent.psychologicalGoalPainScore`
- `stake.teamHasMeaningfulObjective`
- `stake.stakeTeamIsStrongerSide`
- `stake.sameZoneAfterResult`

## Principe cle appris du cours

On ne cherche pas une equipe qui gagne. On cherche une equipe forte, motivee, capable de marquer dans ce contexte precis, face a un adversaire qui encaisse dans un etat exploitable.