# Strategie Goal 0.5 - memoire cours, tableaux et cache

Date de demarrage: 2026-08-13
Objectif: transformer les cours video, documents et tableaux championnats en moteur +0,5 reutilisable sans reconsommer des tokens a chaque analyse.

## Principe d'architecture

Le moteur doit fonctionner en couches:

1. Table historique du championnat sur 4 saisons terminees.
2. Comparaison rapide des deux equipes du match.
3. Analyse du classement actuel et des enjeux.
4. Analyse des 5 derniers matchs de l'equipe candidate.
5. Analyse des 5 derniers matchs de l'adversaire.
6. Validation des buts construits / passes decisives / penalties.
7. Validation live et cote exacte equipe +0,5 >= 1.30 pendant la beta technique, avec objectif commercial plus selectif ensuite.
8. Decision: refus, shadow, surveillance live, signal validable.

## Regle economie tokens

Ne jamais demander a l'IA de recalculer tous les championnats a chaque match.

Pour chaque championnat suivi:

- creer une table historique cachee;
- la mettre a jour seulement quand les donnees changent;
- utiliser la derniere colonne `moyenne ponderee 4 saisons` pour comparer les deux equipes;
- ne lancer l'analyse profonde que si l'ecart historique est bon.

## Regles extraites des documents Word au 2026-08-13

### Selection competition

- Championnat uniquement.
- Exclure coupes nationales et internationales.
- Exclure amicaux, barrages et competitions au format trop special.
- Whitelist pays/ligues seulement.
- Eviter les championnats juges instables ou douteux.

### Niveau et classement

- L'equipe candidate doit etre clairement au-dessus de l'adversaire.
- Regle document: au moins 5 places au-dessus de l'adversaire.
- Regle produit renforcee: viser top 5 contre bottom 5 quand le championnat le permet.
- L'adversaire doit etre en seconde moitie de classement ou zone basse.
- Si l'ecart historique/current est faible: refus.

### Forme offensive equipe candidate

- A marque dans au moins 4 des 5 derniers matchs de championnat.
- Ideal strict: a marque dans les 5 derniers matchs.
- Moyenne de buts marques sur les 5 derniers matchs >= 1,5 but/match.
- Bonne dynamique si l'equipe a marque dans son dernier match.
- Refus si moins de 2 buts marques sur les 3 derniers matchs.
- Les buts doivent etre qualifies: action construite, passe decisive, domination.
- Penalty isole, CSC ou erreur rare ne suffisent pas.

### Fragilite defensive adversaire

- L'adversaire doit avoir encaisse dans au moins 4 des 5 derniers matchs de championnat.
- Ideal strict: a encaisse dans les 5 derniers matchs.
- Qualifier les buts encaisses: construits ou accidentels.
- Verifier contre qui l'adversaire a encaisse: equipes fortes, moyennes, faibles.
- Une equipe qui encaisse seulement contre les monstres ne suffit pas toujours.

### Enjeux

- Prioriser les matchs ou l'equipe doit absolument marquer.
- Enjeux valides: titre, podium, Europe, montee, maintien, place a prendre, place a ne pas perdre, derby motive.
- Refus ou downgrade si match sans motivation claire.

### Cotes et live

- Marche exact recherche: equipe selectionnee marque +0,5 but.
- Cote seuil beta technique: >= 1.30 pour verifier que les signaux sortent bien.
- Cote cible commerciale: >= 1.60 apres validation du tuyau Telegram/API.
- Cote trop basse: pas assez rentable ou attente live.
- Cote anormalement haute: danger/piege, verifier contexte.
- Les cotes ne creent jamais le signal; elles declenchent seulement si le dossier sportif est deja bon.

### Discipline produit

- 1 a 3 matchs maximum par jour si vraiment valides.
- Ne jamais forcer un signal.
- Si aucun match ne respecte les criteres, ne rien envoyer.
- Mieux vaut un jour sans signal qu'un mauvais signal Telegram.

## Fichiers crees

- `manifest-fichiers-locaux.json`: inventaire local videos/Excel/Word.
- `documents/*.txt`: extraction texte des Word.
- `championnats/xlsx-structure-summary.json`: structure lisible des fichiers Excel.
- `cache/`: futur stockage des tables historiques par championnat.
- `videos/`: futur stockage des transcriptions/resumes video.

## Prochaines actions

1. Dedupliquer les videos identiques.
2. Extraire duree et audio de chaque video.
3. Transcrire les videos par module.
4. Ajouter chaque apprentissage dans ce fichier et/ou `rules/`.
5. Generer les tables historiques cachees depuis Excel ou sources web/API.
6. Brancher ces tables au moteur +0,5.
