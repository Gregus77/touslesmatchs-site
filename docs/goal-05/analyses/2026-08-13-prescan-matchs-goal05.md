# GOAL 0.5 IA - prescan matchs

Date analyse: 2026-08-13
Mode: beta technique, cote minimale test `1.30`.
Important: ce document est un prescan historique/contextuel. Ce n'est pas une diffusion Telegram tant que les donnees live, la forme 5 matchs, les scenarios et la cote ANJ exacte ne sont pas valides.

## Aujourd'hui 2026-08-13

Sources publiques observees: Copa Libertadores.

Matchs reperes:

- Mirassol - LDU Quito, Copa Libertadores.
- Rosario Central - Corinthians, Copa Libertadores.

Decision Goal 0.5:

- `NO_BET` pour le produit +0,5 championnat.
- Raison: coupe / match aller-retour, hors perimetre du moteur championnat.

## Prescan Bresil Serie A - 15 au 17 aout 2026

Source calendrier: Brazilian Serie A fixtures publiques.
Source force historique: cache local Goal 0.5 Bresil Serie A.

| Match | Lecture historique rapide | Statut Goal 0.5 |
|---|---|---|
| Atletico Mineiro - Gremio | Atletico-MG top historique, Gremio milieu historique | `WATCHLIST_SHADOW` seulement, adversaire pas bottom historique |
| Fluminense - Palmeiras | deux equipes top historiques | `NO_BET` ecart non conforme |
| Athletico Paranaense - RB Bragantino | deux equipes milieu historiques | `NO_BET` ecart non conforme |
| Sao Paulo - Coritiba | Sao Paulo milieu historique, Coritiba non fiable/incomplet dans cache | `NO_BET` sans croisement |
| Chapecoense - Bahia | Bahia bottom historique, mais pas candidate top | `NO_BET` |
| Vasco da Gama - Santos | donnees historiques a 3 saisons minimum ou a croiser | `NO_BET` sans table propre |
| Mirassol - Flamengo | Flamengo top historique, Mirassol incomplet/promu | `WATCHLIST_SHADOW` a croiser, possible candidat seulement si Mirassol encaisse vraiment et cote ANJ existe |
| Vitoria - Botafogo | Vitoria bas/incomplet, Botafogo milieu historique | `NO_BET` car Botafogo pas top 25 historique |
| Corinthians - Cruzeiro | Corinthians milieu historique, Cruzeiro incomplet/shadow | `NO_BET` |
| Internacional - Remo | Internacional top historique, Remo incomplet/promu | `WATCHLIST_SHADOW` a croiser, possible candidat seulement si Remo encaisse vraiment et cote ANJ existe |

## Candidats a surveiller en priorite

### Flamengo +0,5 vs Mirassol

Statut: `WATCHLIST_SHADOW`, pas encore signal.

Pourquoi surveiller:

- Flamengo est top historique du cache Bresil.
- Mirassol est non stabilisee dans le cache 4 saisons. Avec la nouvelle regle, 3 saisons suffisent si elles sont propres; sinon croisement obligatoire.

Ce qui manque avant signal:

- classement actuel exact;
- enjeu concret Flamengo;
- 5 derniers matchs Flamengo du plus ancien au plus recent;
- preuves de buts construits/assistes;
- 5 derniers matchs Mirassol: encaisse-t-il contre des equipes du niveau Flamengo?
- cote ANJ exacte equipe Flamengo +0,5 >= 1.30 en beta;
- confirmer que ce n'est pas une coupe.

### Internacional +0,5 vs Remo

Statut: `WATCHLIST_SHADOW`, pas encore signal.

Pourquoi surveiller:

- Internacional est top historique du cache Bresil.
- Remo est incomplet/promu dans le cache historique. Avec la nouvelle regle, 3 saisons propres suffisent; moins de 3 saisons reste non vendable.

Ce qui manque avant signal:

- classement actuel exact;
- enjeu concret Internacional;
- forme offensive Internacional;
- etat defensif Remo;
- cote ANJ exacte equipe Internacional +0,5 >= 1.30 en beta.

## Decision actuelle

Aucun signal Telegram immediat aujourd'hui depuis ce prescan.

Prochaine action moteur:

- brancher la collecte API live sur ces champs;
- laisser passer en Telegram seulement si le moteur retourne `ELIGIBLE_SHADOW` puis controle humain/API positif pendant la beta.