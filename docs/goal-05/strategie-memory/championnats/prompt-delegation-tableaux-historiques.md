# Mission a donner a une autre IA - Tableaux historiques Goal 0.5 TousLesMatchs

Tu dois produire des tableaux historiques fiables pour le moteur de selection football `equipe marque +0,5 but` de TousLesMatchs.

## Objectif

Pour chaque championnat fourni, recuperer les 4 dernieres saisons terminees, puis creer un tableau par championnat permettant de comparer rapidement deux equipes qui s'affrontent.

Le but n'est pas de predire directement un match. Le but est de construire une memoire historique propre et reutilisable.

## Championnats a analyser exactement

Analyser uniquement les championnats listes ci-dessous. Ne pas ajouter d'autre pays ou ligue sans validation.

### Priorite A - production Goal 0.5

| Pays | Ligue a analyser | Nom anglais possible | Statut |
|---|---|---|---|
| France | Ligue 1 | Ligue 1 | Priorite A |
| Angleterre | Premier League | Premier League / English Premier League | Priorite A |
| Espagne | La Liga | LaLiga / Primera Division | Priorite A |
| Allemagne | Bundesliga | Bundesliga | Priorite A |
| Italie | Serie A | Serie A | Priorite A |
| Portugal | Primeira Liga | Liga Portugal / Primeira Liga | Priorite A |
| Pays-Bas | Eredivisie | Eredivisie | Priorite A |
| Belgique | Pro League | Belgian Pro League / Jupiler Pro League | Priorite A |
| Ecosse | Premiership | Scottish Premiership | Priorite A |
| Autriche | Bundesliga | Austrian Bundesliga | Priorite A |
| Suisse | Super League | Swiss Super League | Priorite A |
| Danemark | Superliga | Danish Superliga | Priorite A |
| Norvege | Eliteserien | Eliteserien | Priorite A |
| Suede | Allsvenskan | Allsvenskan | Priorite A |
| Bresil | Serie A | Brasileiro Serie A / Brasileirao Serie A | Priorite A |
| Argentine | Primera Division | Liga Profesional / Argentine Primera Division | Priorite A prudente |

### Priorite B - shadow uniquement, ne pas vendre sans validation

Ces ligues peuvent etre preparees dans un dossier separe `shadow/`, mais elles ne doivent pas etre considerees comme pretes pour diffusion Telegram payante sans audit qualite.

| Pays | Ligue | Raison du statut shadow |
|---|---|---|
| France | Ligue 2 | demandee au depart, mais a valider avant vente |
| Colombie | Categoria Primera A | doute utilisateur, a verifier avant inclusion |
| Japon | J1 League | couverture interessante, mais pas prioritaire produit |
| Coree du Sud | K League 1 | couverture interessante, mais pas prioritaire produit |
| Australie | A-League | couverture interessante, mais pas prioritaire produit |

### Exclusions strictes

Ne pas traiter et ne pas inclure dans les tableaux Goal 0.5:

- MLS / USA
- Canada
- Irak
- Afghanistan
- Chili
- Paraguay
- Perou
- Equateur
- Roumanie
- Chypre sauf validation specifique
- championnats exotiques ou reputes instables
- competitions de coupe
- matchs amicaux
- barrages et playoffs si le format n'est pas une saison reguliere
- selections nationales
- equipes jeunes, feminines ou reserves

## Donnees a recuperer pour chaque saison

Pour chaque equipe et chaque saison terminee:

- championnat
- pays
- saison
- equipe
- classement final / rang final
- points
- matchs joues
- victoires
- nuls
- defaites
- buts marques
- buts encaisses
- difference de buts
- source URL

Important: utiliser les classements finaux de championnat uniquement.

## Calcul demande

Pour chaque equipe, calculer un score de saison sur 100:

- 65% selon le rang final normalise
- 35% selon les points par match

Formules:

- points_par_match = points / matchs_joues
- score_points = min(100, max(0, points_par_match / 3 * 100))
- score_rang = ((nombre_equipes - rang_final) / (nombre_equipes - 1)) * 100
- score_saison = score_rang * 0.65 + score_points * 0.35

Ensuite calculer la moyenne ponderee 4 saisons:

- saison la plus recente terminee: 40%
- saison N-2: 30%
- saison N-3: 20%
- saison N-4: 10%

moyenne_historique = saison1*0.40 + saison2*0.30 + saison3*0.20 + saison4*0.10

Si une equipe n'a pas au moins 3 saisons exploitables dans le championnat, mettre `historique_incomplet = true`.
Ne jamais inventer une force historique pour une equipe promue ou absente.

## Tableau final attendu par championnat

Produire un fichier CSV et si possible JSON par championnat avec ces colonnes:

- country
- league
- team
- season_1_label
- season_1_rank
- season_1_points
- season_1_played
- season_1_ppg
- season_1_power
- season_2_label
- season_2_rank
- season_2_points
- season_2_played
- season_2_ppg
- season_2_power
- season_3_label
- season_3_rank
- season_3_points
- season_3_played
- season_3_ppg
- season_3_power
- season_4_label
- season_4_rank
- season_4_points
- season_4_played
- season_4_ppg
- season_4_power
- historical_average_power
- historical_rank
- historical_percentile
- seasons_available
- historique_incomplet
- sources

## Regle de lecture pour le moteur +0,5

Le moteur utilisera ensuite ce tableau comme premier filtre:

- equipe candidate doit etre au-dessus de son adversaire en moyenne historique
- ideal: equipe candidate top 25% historique
- ideal: adversaire bottom 25% historique
- ecart de percentile souhaite: au moins 40 points
- si ecart faible: refus
- si historique incomplet: shadow ou refus

## Format de livraison

Rendre un dossier par championnat:

`goal05-historical-tables/[country]-[league]/`

Dedans:

- `table.csv`
- `table.json`
- `sources.md`
- `notes-qualite.md`

Dans `notes-qualite.md`, indiquer:

- saisons utilisees
- sources utilisees
- equipes avec historique incomplet
- equipes promues/releguees posant probleme
- toute incertitude de nom d'equipe

## Verification obligatoire

Avant de livrer:

- verifier que chaque championnat a bien 4 saisons terminees;
- verifier que les rangs vont de 1 au nombre total d'equipes;
- verifier que les points par match sont plausibles entre 0 et 3;
- verifier que la meilleure equipe a un score plus eleve que les equipes faibles;
- verifier que les sources sont indiquees;
- verifier que le nom de la ligue correspond exactement a la liste autorisee ci-dessus;
- verifier qu'aucune coupe, playoff, barrage ou match international n'est melange dans les donnees.

## Relecture croisee obligatoire

Apres avoir construit chaque tableau, faire une relecture croisee pour limiter les erreurs.

Regle de controle:

1. Utiliser au minimum 2 sources fiables quand c'est possible.
2. Comparer pour chaque saison: champion, top 5, bottom 5, points, nombre de matchs joues.
3. Si les deux sources divergent, ne pas choisir au hasard: signaler l'ecart dans `notes-qualite.md`.
4. Si une donnee reste incertaine, mettre la ligne en `a_verifier = true`.
5. Ne jamais corriger une donnee par intuition.
6. Garder les URL exactes dans `sources.md`.

Sources possibles a croiser selon disponibilite:

- API-Football / API-Sports si disponible;
- site officiel de la ligue;
- FBref / Stathead si accessible;
- WorldFootball.net;
- Soccerway;
- Transfermarkt;
- Wikipedia uniquement comme source secondaire de controle, pas comme unique source si une source officielle existe.

Controle final attendu dans `notes-qualite.md`:

- `controle_croise_effectue: oui/non`;
- sources utilisees;
- divergences trouvees;
- corrections effectuees;
- lignes encore a verifier.

## Ce qu'il ne faut pas faire

- Ne pas analyser les matchs du jour.
- Ne pas donner de conseil de pari.
- Ne pas inclure les coupes.
- Ne pas inventer les donnees manquantes.
- Ne pas melanger deux divisions.
- Ne pas utiliser de donnees non sourcees.

## Exemple de sortie attendue simplifiee

| team | 2025 rank | 2025 power | 2024 rank | 2024 power | 2023 rank | 2023 power | 2022 rank | 2022 power | historical_average_power | historical_rank | historical_percentile |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| PSG | 1 | 93.8 | 1 | 91.1 | 1 | 91.1 | 1 | 91.4 | 92.2 | 1 | 100 |
| Lyon | 6 | 64.7 | 5 | 67.6 | 7 | 62.4 | 8 | 57.0 | 64.3 | 6 | 72 |

Livrer les fichiers et un resume court de ce qui est pret.
