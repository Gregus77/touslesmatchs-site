# Etat des tableaux historiques Goal 0.5

Date: 2026-08-13
Objectif: creer une memoire historique par championnat pour economiser les tokens et pre-filtrer les matchs +0,5.

## Tables Europe creees depuis fichiers locaux

Statut: `LOCAL_RANK_ONLY_A_CROISER`

Ces tables sont exploitables comme premier cache de rang historique, mais elles doivent etre croisees avec des sources officielles ou fiables pour ajouter/valider: points, matchs joues, buts marques, buts encaisses, difference de buts.

| Pays | Ligue | Statut | Fichier |
|---|---|---|---|
| France | Ligue 1 | cree depuis Excel local | `cache/europe-known-local-rank-tables/france-ligue-1.csv` |
| Angleterre | Premier League | cree depuis Excel local | `cache/europe-known-local-rank-tables/angleterre-premier-league.csv` |
| Espagne | La Liga | cree depuis Excel local | `cache/europe-known-local-rank-tables/espagne-la-liga.csv` |
| Italie | Serie A | cree depuis Excel local | `cache/europe-known-local-rank-tables/italie-serie-a.csv` |
| Suede | Allsvenskan | cree depuis Excel local | `cache/europe-known-local-rank-tables/suede-allsvenskan.csv` |
| Norvege | Eliteserien | cree depuis Excel local | `cache/europe-known-local-rank-tables/norvege-eliteserien.csv` |

Workbook recapitulatif:

`goal05-tableaux-historiques-europe-local-rank.xlsx`

## Ligues Europe prioritaires encore a sourcer

| Pays | Ligue | Priorite | Donnees a obtenir |
|---|---|---|---|
| Allemagne | Bundesliga | A | 4 saisons terminees + points + matchs + buts |
| Portugal | Primeira Liga | A | 4 saisons terminees + points + matchs + buts |
| Pays-Bas | Eredivisie | A | 4 saisons terminees + points + matchs + buts |
| Belgique | Pro League | A | 4 saisons terminees + points + matchs + buts |
| Ecosse | Premiership | A | 4 saisons terminees + points + matchs + buts |
| Autriche | Bundesliga | A | 4 saisons terminees + points + matchs + buts |
| Suisse | Super League | A | 4 saisons terminees + points + matchs + buts |
| Danemark | Superliga | A | 4 saisons terminees + points + matchs + buts |

## Phase suivante apres Europe

1. Bresil Serie A.
2. Argentine Primera / Liga Profesional, statut prudent.
3. Coree du Sud K League 1, shadow.
4. Japon J1 League, shadow.

## Regles qualite

- Ne jamais utiliser ces tables seules pour envoyer un signal Telegram.
- Utiliser ces tables pour pre-filtrer vite: top historique vs bottom historique.
- Pour un signal vendable, croiser ensuite avec forme recente, enjeu, buts construits, adversaire qui encaisse et cote reelle ANJ >= 1.60.
- Toute equipe avec historique incomplet doit passer en prudence ou shadow.

## Mise a jour 2026-08-13 - Tables calculees depuis Football-Data

Source principale utilisee: Football-Data.co.uk CSV historiques par saison.
Calcul effectue depuis les matchs: points, matchs joues, victoires/nuls/defaites, buts marques, buts encaisses, difference de buts, points par match, score de puissance saison, moyenne ponderee 40/30/20/10.

Tables creees:

| Pays | Ligue | Statut | Fichier |
|---|---|---|---|
| Allemagne | Bundesliga | calcule depuis CSV historiques Football-Data, a croiser seconde source | `cache/football-data-computed-standings/allemagne-bundesliga.csv` |
| Portugal | Primeira Liga | calcule depuis CSV historiques Football-Data, a croiser seconde source | `cache/football-data-computed-standings/portugal-primeira-liga.csv` |
| Pays-Bas | Eredivisie | calcule depuis CSV historiques Football-Data, a croiser seconde source | `cache/football-data-computed-standings/pays-bas-eredivisie.csv` |
| Belgique | Pro League | calcule depuis CSV historiques Football-Data, a croiser seconde source | `cache/football-data-computed-standings/belgique-pro-league.csv` |
| Ecosse | Premiership | calcule depuis CSV historiques Football-Data, a croiser seconde source | `cache/football-data-computed-standings/ecosse-premiership.csv` |

Workbook recapitulatif:

`goal05-tableaux-historiques-football-data-europe.xlsx`

Top 5 historiques rapides:

- Allemagne: Bayern Munich, Leverkusen, Dortmund, RB Leipzig, Ein Frankfurt.
- Portugal: Sp Lisbon, Benfica, Porto, Sp Braga, Guimaraes.
- Pays-Bas: PSV Eindhoven, Feyenoord, Ajax, AZ Alkmaar, Twente.
- Belgique: St. Gilloise, Club Brugge, Genk, Anderlecht, Antwerp.
- Ecosse: Celtic, Rangers, Hearts, Hibernian, Aberdeen.

## Ligues restant a sourcer hors format historique Football-Data simple

Football-Data fournit des fichiers courants pour Autriche, Suisse et Danemark (`new/AUT.csv`, `new/SWZ.csv`, `new/DNK.csv`), mais les URLs historiques 4 saisons n'ont pas ete confirmees dans le meme format. Ne pas creer de table historique vendable tant que les 4 saisons terminees ne sont pas sourcees et recalculees.

Restant a faire:

- Autriche Bundesliga: source historique 4 saisons a trouver/croiser.
- Suisse Super League: source historique 4 saisons a trouver/croiser.
- Danemark Superliga: source historique 4 saisons a trouver/croiser.

## Mise a jour 2026-08-13 - Japon / Coree / Argentine / Bresil

Objectif: appliquer la meme logique qu'en Europe aux championnats hors Europe retenus par Greg, sans consommer des tokens a chaque analyse.

Tables creees depuis les fichiers Excel locaux:

| Pays | Ligue | Statut produit | Fichier cache |
|---|---|---|---|
| Bresil | Brasileiro Serie A | `LOCAL_RANK_ONLY_A_CROISER` - prioritaire apres Europe | `cache/rest-world-local-rank-tables/bresil-brasileiro-serie-a.csv` |
| Argentine | Liga Profesional / Primera Division | `PRUDENCE_TRICHE_UTILISATEUR` + anomalie de nom a corriger | `cache/rest-world-local-rank-tables/argentine-liga-profesional-primera-division.csv` |
| Japon | J1 League | `SHADOW_ASIE` - bon candidat de test, pas prioritaire commercial | `cache/rest-world-local-rank-tables/japon-j1-league.csv` |
| Coree du Sud | K League 1 | `SHADOW_ASIE` - bon candidat de test, pas prioritaire commercial | `cache/rest-world-local-rank-tables/coree-du-sud-k-league-1.csv` |

Workbook recapitulatif:

`goal05-tableaux-historiques-rest-world-local-rank.xlsx`

Top 5 historiques rapides issus du cache local:

- Bresil: Palmeiras, Flamengo, Atletico-MG, Fluminense, Internacional.
- Argentine: Rivers Plate, Boca Junior, Talleres CordobaSan Lorenzo, Defensa YJusticia, Racing Club.
- Japon: Yokohama FM, Kawasaki, Hiroshima, Nagoya, Vissel Kobe.
- Coree du Sud: Ulsan HD, Jeonbuk, Pohang, Daegu, Gwangju.

Points de vigilance:

- Argentine: le nom `Talleres CordobaSan Lorenzo` indique une cellule ou une extraction fusionnee. Ne pas utiliser l'Argentine pour signal Telegram avant correction/croisement.
- Japon/Coree: statut shadow au depart, utile pour apprendre et tester, mais diffusion commerciale seulement si les cotes ANJ et les donnees live sont propres.
- Ces caches ne valident que la force historique relative. Ils ne remplacent jamais les filtres live: enjeu de place, top actuel vs bas actuel, buts recents, passes decisives, adversaire qui encaisse, absence de signal coupe, cote ANJ >= 1.60.

Sources de croisement identifiees:

- Bresil: Football-Data Brazil pour resultats/cotes exploitables en CSV.
- Argentine: FootyStats Primera Division datasets pour saisons et donnees equipes/matchs.
- Japon: site officiel J.LEAGUE + J.League Data Site pour standings annuels; FootyStats J1 datasets en source secondaire.
- Coree du Sud: FootyStats K League 1 datasets pour saisons et donnees equipes/matchs; source officielle coreenne a utiliser en controle secondaire si disponible.

Decision actuelle:

- Le moteur peut utiliser ces tables comme prefiltre rapide de puissance historique.
- Aucun signal +0,5 Telegram ne doit partir depuis ces ligues tant que le match candidat n'a pas aussi passe les criteres live et le controle cote.

## Verification sources 2026-08-13 - hors Europe

Sources controlees pour croiser les caches locaux:

| Championnat | Source controlee | Utilisation dans Goal 0.5 |
|---|---|---|
| Bresil Serie A | Football-Data Brazil | Resultats/cotes CSV pour recalculer points, buts, dynamique et verifier le cache local. |
| Japon J1 League | J.LEAGUE official standings 2025 | Source officielle pour classement, points, matchs, buts pour au moins la saison recente. |
| Coree K League 1 | FootyStats K League 1 datasets | Datasets multi-saisons avec league/matches/teams/team pt.2/players; bon croisement technique. |
| Argentine Primera Division | FootyStats Primera Division datasets | Datasets multi-saisons avec league/matches/teams/team pt.2/players; indispensable pour corriger l'anomalie de nom. |

Conclusion:

- Bresil: priorite hors Europe la plus propre.
- Japon: source officielle solide, mais statut commercial shadow au depart.
- Coree: donnees disponibles, statut shadow au depart.
- Argentine: donnees disponibles, mais prudence renforcée tant que l'anomalie `Talleres CordobaSan Lorenzo` n'est pas corrigee.
