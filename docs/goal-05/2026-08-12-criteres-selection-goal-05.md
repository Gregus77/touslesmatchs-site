# GOAL 0.5 IA - criteres de selection

Date: 2026-08-12
Statut projet: `██████░░░░░░░░░░░░░ 29/100`

## Principe produit

GOAL 0.5 IA selectionne uniquement une equipe susceptible de marquer au moins un but dans son match. Cette equipe peut etre a domicile ou a l'exterieur. Le choix ne depend pas du terrain en premier, mais de la force historique et actuelle de l'equipe.

Le marche vise est strictement:

`equipe selectionnee marque plus de 0,5 but`

Il n'y a pas de 1X2, pas de BTTS, pas d'over global, pas de combine et pas de pari automatique.

## Championnats retenus en phase 1

La phase 1 privilegie les championnats de premiere division avec couverture et stabilite suffisantes:

- France Ligue 1;
- Angleterre Premier League;
- Espagne La Liga;
- Allemagne Bundesliga;
- Italie Serie A;
- Portugal Primeira Liga;
- Pays-Bas Eredivisie;
- Belgique Pro League;
- Ecosse Premiership;
- Autriche Bundesliga;
- Suisse Super League;
- Danemark Superliga;
- Norvege Eliteserien;
- Suede Allsvenskan;
- Argentine Primera;
- Bresil Serie A.

Les divisions 2 restent en observation shadow, sauf exception validee apres audit de couverture et de fiabilite. France Ligue 2 peut etre analysee en priorite shadow car elle etait dans le besoin initial, mais pas vendue avant preuve.

## Exclusions

Sont exclus en production:

- coupes, amicaux, competitions internationales, barrages et formats a elimination directe;
- equipes nationales, feminines, jeunes, reserves;
- championnats non whitelist;
- pays ou ligues juges instables ou insuffisamment fiables;
- matchs sans cote ANJ/ARJEL exploitable sur le marche exact;
- matchs avec donnees historiques insuffisantes.

## Force historique sur 4 saisons

Chaque championnat retenu doit etre analyse avant exploitation commerciale. Pour chaque equipe, on calcule un indice historique sur les 4 dernieres saisons terminees.

Ponderation:

- saison N-1: 40%;
- saison N-2: 30%;
- saison N-3: 20%;
- saison N-4: 10%.

Formule resumee: `40 / 30 / 20 / 10`.

Donnees a stocker:

- points par match;
- rang final;
- rang percentile;
- buts marques par match;
- buts encaisses par match;
- difference de buts;
- forme domicile/exterieur;
- stabilite de division;
- promotions, relegations, changement de nom ou fusion.

Une equipe avec historique incomplet ne recoit jamais une force artificielle. Elle passe en prudence ou shadow.

## Ecart de niveau obligatoire

Le profil ideal est:

`top 25% historique contre bottom 25% historique`

La selection porte sur l'equipe historiquement la plus forte, meme si elle joue a l'exterieur, si elle reste aussi dans le haut du classement actuel et rencontre une equipe situee dans le bas du classement actuel.

Pour une ligue de 20 equipes:

- equipe cible: top 5 historique;
- adversaire: bottom 5 historique.

Pour une ligue de 18 equipes:

- equipe cible: top 4 ou top 5 historique;
- adversaire: bottom 4 ou bottom 5 historique.

Si l'ecart historique est faible, le match est refuse meme si la cote est belle.

## Classement actuel et enjeu

L'equipe cible doit avoir une raison sportive claire de marquer:

- place europeenne, titre, podium, promotion, maintien ou place importante a prendre;
- ecart de points qui rend le match utile;
- dynamique de classement coherente avec l'objectif.

L'adversaire doit presenter une fragilite actuelle:

- bas de tableau;
- defense fragile;
- serie negative;
- pression sportive;
- absents defensifs ou gardien affaibli.

Un match sans enjeu clair baisse fortement le score.

## Forme offensive recente

L'equipe cible doit montrer qu'elle marque:

- idealement but dans les 5 derniers matchs;
- volume de tirs et tirs cadres;
- occasions franches;
- presence d'attaquants ou createurs importants;
- buts construits avec passes decisives ou actions collectives.

Les buts suivants ne prouvent pas suffisamment la force offensive:

- penalty isole;
- but contre son camp;
- erreur rare du gardien;
- match bizarre ou rouge precoce;
- but tardif sans domination.

## Fragilite defensive adverse

L'adversaire doit montrer qu'il encaisse, mais chaque but encaisse doit etre qualifie:

- l'equipe qui lui a marque etait-elle forte ou malade?
- le but etait-il construit ou accidentel?
- y avait-il rouge, penalty, fatigue, rotation ou contexte special?
- les 5 derniers matchs montrent-ils une vraie tendance?

Un adversaire qui encaisse seulement contre de tres grosses equipes ne suffit pas toujours. Un adversaire qui encaisse contre des equipes moyennes ou faibles est plus interessant.

## Validation live

Aucun signal reel sans validation live.

Conditions obligatoires:

- score actuel: l'equipe cible n'a pas encore marque;
- cote live du marche exact au moins `1.30` pendant la beta technique;
- cote fraiche, horodatee et non suspendue;
- equipe cible encore a 11 ou sans rouge bloquant;
- attaquants/creatifs importants encore sur le terrain;
- pression offensive visible;
- minute compatible.

Fenetre:

- avant 65e: regime normal;
- 65e-75e: activite offensive obligatoire;
- 76e-80e: domination claire;
- 81e-85e: situation exceptionnelle seulement;
- apres 85e: aucun nouveau signal.

## Score minimum

Le score interne doit atteindre `80/100` minimum.

Repartition cible:

- force historique 4 saisons: 15;
- classement actuel et enjeu: 15;
- forme offensive recente: 15;
- fragilite defensive adverse: 15;
- titulaires offensifs et absences: 15;
- tirs, tirs cadres, xG ou occasions: 10;
- domicile/exterieur: 5;
- H2H pertinent: 5;
- fatigue, moral, coach, calendrier: 5.

La cote ne cree jamais le signal. Elle ne fait que declencher une alerte si le dossier sportif est deja valide.

## Decision

Statuts possibles:

- `REFUS`: criteres insuffisants;
- `PRESLECTION`: dossier pre-match fort, attente du live;
- `SURVEILLANCE_LIVE`: cote ou conditions live en attente;
- `SIGNAL_VALIDABLE`: score >= 80, cote >= 1.30 pendant la beta technique, conditions live OK;
- `NON_DECLENCHE`: equipe a marque avant 1.30 ou cote jamais atteinte;
- `ERREUR_DONNEE`: source absente, incoherente ou perimee.

Un jour sans signal est normal. Le moteur doit proteger la qualite avant le volume.
