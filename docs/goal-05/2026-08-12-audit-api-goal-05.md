# GOAL 0.5 IA - audit API lecture seule

Date: 2026-08-12
Statut projet: `█████░░░░░░░░░░░░░░ 25/100`

## Conclusion courte

API-Sports / API-Football est une bonne base technique pour demarrer le produit Goal 0.5 IA, mais elle ne suffit pas encore a elle seule pour vendre un signal live sans preuve supplementaire.

Le code TousLesMatchs sait deja recuperer:

- les matchs live football via `fixtures?live=all`;
- les scores, minutes, equipes, fixture id, league id et saison;
- les statistiques de match via `fixtures/statistics`;
- les statistiques equipe/saison via `teams/statistics`;
- les classements via `standings`;
- les blessures via `injuries`;
- les cotes pre-match via `/odds`;
- une selection de bookmakers consideres ANJ/ARJEL.

Le bloc manquant pour Goal 0.5 IA est precis:

- recuperer `/odds/live`;
- isoler le marche live exact `equipe selectionnee marque +0,5`;
- verifier que ce marche existe chez au moins un operateur ANJ;
- verifier la fraicheur et la stabilite de la cote;
- conserver cette cote en base avant toute notification.

## Evidence locale

Fichier principal: `scripts/api_server.js`

- `API_SPORTS_KEY` ou `API_FOOTBALL_KEY` sont les cles attendues par le backend.
- `fetchFromApiSports()` lit le live football depuis `https://v3.football.api-sports.io/fixtures?live=all`.
- `fetchTeamStatistics()` lit `teams/statistics`.
- `fetchStandings()` lit `standings`.
- `fetchInjuries()` lit `injuries`.
- `fetchRealOdds()` lit actuellement `/odds`, donc des cotes classiques/pre-match selon le fournisseur.
- `pickRealOdd()` mappe aujourd'hui les marches generiques: over/under 2.5, BTTS, but en premiere mi-temps, double chance, vainqueur.
- `pickRealOdd()` ne mappe pas encore le marche exact Goal 0.5 IA: team total over 0.5 pour une equipe donnee.
- `ARJEL_PREFILTER_MARKETS` ne contient pas le marche Goal 0.5 IA.
- Les seuils generiques existants sont `TIER_MIN_REAL_ODD=1.30` et `TIER_MAX_REAL_ODD=2.50`; Goal 0.5 IA doit garder son seuil propre a `1.60`.

Fichier Goal 0.5 existant: `scripts/plus05_engine.js`

- Le moteur isole sait deja chercher un marche de type team score / team total over 0.5 dans une structure de cotes fournie.
- Il exige une cote minimum de `1.60`.
- Il travaille en evaluation locale et ne contacte aucune API.
- Il n'est pas encore branche au backend live.

Fichier ligues: `scripts/active_leagues.json`

- La liste active locale est insuffisante pour Goal 0.5 IA: elle contient surtout Coree du Sud K League 1 et Chine Super League comme ajouts actifs.
- Elle ne represente pas la whitelist complete demandee pour Europe, Amerique du Sud, Japon, Coree, MLS et Australie.

## Evidence fournisseur

Sources officielles consultees:

- API-Sports football coverage: https://api-sports.io/sports/football
- API-Football documentation v3: https://www.api-football.com/documentation-v3
- API-Football guide officiel: https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide

Points utiles confirmes par la documentation:

- API-Football couvre livescore, fixtures, teams, standings, bookmakers, odds, events, lineups, players, statistics et predictions.
- La couverture depend de la competition et de la saison; les champs de couverture doivent etre verifies ligue par ligue.
- `fixtures` live est mis a jour environ toutes les 15 secondes, avec possibles delais selon competition.
- `fixtures/events` couvre notamment but normal, but contre son camp, penalty, penalty manque, cartons, substitutions et VAR.
- `fixtures/statistics` couvre tirs, tirs cadres, possession, corners, cartons, passes, etc., et se met a jour environ chaque minute.
- `fixtures/lineups` peut etre disponible avant match quand la competition le couvre, souvent avant le coup d'envoi, mais pas garanti.
- `odds/live` existe pour les matchs en cours, avec update typique de 5 a 60 secondes, statut bloque/suspendu/termine, et aucune conservation historique.
- Les ids de marches pre-match `/odds/bets` et live `/odds/live/bets` sont distincts: il faut les stocker separement.

## Verdict par besoin Goal 0.5 IA

| Besoin | Statut | Commentaire |
| --- | --- | --- |
| Matchs live football | OK partiel | Deja collecte via API-Sports. |
| Liste blanche competitions | A refaire | Le code actuel n'est pas cale sur la whitelist Goal 0.5. |
| Scores et minutes | OK partiel | Disponibles sur live fixtures, mais latence a mesurer. |
| Evenements buts / penalty / CSC | A brancher proprement | L'API le fournit, le moteur Goal 0.5 doit le stocker pour ponderer les buts construits. |
| Stats live tirs / possession / corners | OK partiel | Fonction locale existe pour stats fixture, mais pas encore integree au moteur Goal 0.5. |
| Classements et enjeux | OK partiel | `standings` existe, mais il faut calculer les enjeux avec regles Goal 0.5. |
| Cinq saisons historiques | A construire | API-Sports peut aider, mais il faut stocker localement pour eviter cout et fuite temporelle. |
| Compositions officielles | A brancher | Endpoint disponible selon couverture; doit bloquer si donnees absentes sur ligue sensible. |
| Blessures | OK partiel | Fonction locale existe, mais doit etre enrichie par poste/importance offensive. |
| Cote pre-match | OK partiel | `/odds` deja utilise, mais insuffisant pour la strategie live. |
| Cote live | Non branche | `/odds/live` n'est pas utilise dans le backend actuel. |
| Marche exact equipe +0,5 | Non prouve | Le moteur local sait parser une structure, mais aucune preuve live fournisseur/ANJ n'est encore enregistree. |
| Bookmakers ANJ | OK partiel | Liste locale existe, a synchroniser et verifier par bookmaker id. |
| Historique des cotes live | A capturer nous-memes | Le fournisseur ne conserve pas l'historique live apres match. |
| Source secondaire | A decider apres preuve | Ne pas acheter tant qu'on n'a pas le tableau de couverture API-Sports. |

## Risques principaux

1. Le marche exact `team total over 0.5` peut ne pas etre disponible en live sur toutes les ligues ou tous les bookmakers ANJ.
2. La cote live peut etre suspendue ou bloquee au moment ou elle atteint 1.60.
3. Sans capture continue, l'historique de mouvement des cotes live est perdu apres match.
4. La couverture lineups/stats/events varie selon les competitions; une whitelist par nom de pays ne suffit pas.
5. Le seuil generique TousLesMatchs `1.30` ne doit pas contaminer le produit Goal 0.5, qui reste a `1.60`.

## Decision fournisseur

Decision provisoire: garder API-Sports/API-Football comme source principale de test.

Ne pas souscrire tout de suite a Sportmonks, The Odds API, Betfair ou autre source.

La prochaine preuve doit etre un test reel, sans notification client:

1. recuperer `/odds/live/bets`;
2. identifier l'id live du marche equipe +0,5 s'il existe;
3. tester quelques fixtures live de ligues whitelist;
4. noter bookmaker, marche, selection, cote, update timestamp, status blocked/stopped/finished;
5. journaliser les absences autant que les presences.

## Prochaine action technique sure

Creer un script shadow-only `scripts/audit_goal05_api_coverage.js` qui:

- n'envoie aucun signal;
- n'utilise aucune IA payante;
- ne modifie pas Stripe, Telegram, site public ou VPS;
- lit seulement API-Sports si la cle est disponible dans l'environnement;
- ecrit un rapport JSON local horodate avec les marches live trouves;
- se limite aux ligues whitelist et au football;
- masque toute cle dans les logs.

Sans cle API disponible dans cette session, l'audit live reel n'a pas ete execute aujourd'hui. Les variables `API_SPORTS_KEY`, `API_FOOTBALL_KEY`, `FOOTBALL_DATA_KEY` et `THESPORTSDB_API_KEY` sont absentes de l'environnement de cette session.
