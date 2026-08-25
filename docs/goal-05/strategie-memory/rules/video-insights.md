# Insights video Goal 0.5

Ce fichier recoit les subtilites apprises depuis les videos de cours. Chaque insight doit devenir une regle exploitable par le moteur +0,5.

## 2026-08-13 - Selection de match David

Source: `65ffe038b2036_SELECTIONDEMATCHDAVID.mp4`
Transcription: `videos/transcripts/65ffe038b2036_SELECTIONDEMATCHDAVID.txt`
Qualite transcription: faible avec Whisper tiny, mais idee centrale identifiable.

Regle extraite:

- Ne pas considerer un match comme opportunite forte si le resultat ne change pas vraiment la situation de classement de l'equipe candidate.
- Exemple de logique: si l'equipe reste de toute facon sur sa place europeenne meme en perdant, l'enjeu est insuffisant.
- L'enjeu doit etre concret: place a prendre, place a defendre, risque de sortir d'une zone importante, pression immediate.

Traduction moteur:

- Ajouter un filtre `meaningful_table_swing`.
- Si aucune place importante ne peut etre prise/perdue: downgrade fort ou refus.
- Ne pas confondre "bonne equipe" et "bonne opportunite".

## 2026-08-13 - Module 2 Selection de match, lot 1

Sources transcrites:

- `65ffddb324445_Module2-Selectiondematch.mp4`
- `65ffe133c533c_SELECTIONDEMATCHALAN.mp4`
- `65ffdfed89579_SELECTIONDEMATCHBERTRAND.mp4`
- `65ffe0bc4c4a2_SELECTIONDEMATCHCHRISTOPHE.mp4`
- `65ffe17e919a7_SELECTIONDEMATCHBYA.mp4`
- `65ffde1b95abc_Module2-Selectiondematchdemonstration.mp4`

Qualite transcription: moyenne/faible avec Whisper tiny, mais les regles recurrentes sont identifiables par repetition.

### Regle video: enjeu pressant + superiorite

Un match ne se selectionne pas uniquement parce qu'une equipe est forte.
Il faut que l'equipe forte ait aussi un enjeu pressant.

Ordre de selection appris:

1. choisir le championnat a scanner;
2. regarder le classement;
3. chercher les enjeux pressants;
4. verifier la disparite de niveau;
5. selectionner seulement si l'equipe avec enjeu pressant est superieure a l'adversaire.

Traduction moteur:

- Ajouter `pressing_stake_detected`.
- Ajouter `stake_team_is_stronger_side`.
- Refuser si l'equipe qui a l'enjeu est inferieure a l'adversaire.
- Si les deux equipes ont un enjeu, choisir d'abord l'enjeu de l'equipe historiquement/current la plus forte.

### Regle video: place a perdre plus forte que place vague a gagner

Le cours insiste sur les places a perdre et le risque concret de sortir d'un projet sportif.
Exemples de projets: Europe, barrage Champions League, maintien, montee, podium.

Traduction moteur:

- Ajouter `can_lose_project_place`.
- Ajouter `can_enter_project_place`.
- Une place a perdre qui fait sortir d'un objectif important vaut plus qu'une place theorique a gagner sans consequence directe.

### Regle video: faux enjeu

Un changement de quelques places ne suffit pas si l'equipe reste dans la meme zone sportive.
Exemple: une equipe du ventre mou qui gagne/perd et reste dans le ventre mou n'a pas un enjeu assez pressant.

Traduction moteur:

- Ajouter `same_zone_after_result = true/false`.
- Si victoire/defaite ne change pas la zone sportive: downgrade fort.
- Zones sportives: titre, Champions League, Europe, barrage, ventre mou, maintien, relegation.

### Regle video: ne pas considerer l'enjeu de l'equipe inferieure si elle joue plus fort

Dans un match ou une equipe faible a un enjeu, mais affronte une equipe superieure qui a aussi un enjeu, le cours privilegie l'analyse de l'equipe superieure.

Traduction moteur:

- `candidate_team = stronger_team_with_pressing_stake`.
- Ne pas selectionner automatiquement une equipe faible seulement parce qu'elle a besoin de points.

### Impact Goal 0.5

Pour le produit +0,5 but, cela renforce la logique suivante:

- l'equipe selectionnee doit etre la plus forte historiquement/current;
- elle doit avoir un enjeu pressant;
- son adversaire doit lui permettre de s'exprimer;
- le match devient ensuite seulement une opportunite a analyser, pas encore un signal.

## 2026-08-13 - Dernieres videos, lot 2: cas special + equipe qui encaisse

Sources transcrites:

- `65ffe0fb28b55_CASSPECIAL-SELECTIONDEMATCH.mp4`
- `660917ade20eb_EQUIPEQUIENCAISSEEXERCICECOMPREHENSIONRAPHAEL (1).mp4`
- `66091a9ec20b4_EQUIPEQUIENCAISSEEXERCICECOMPREHENSIONALAN.mp4`

Qualite transcription: moyenne, mais les raisonnements recurrents sont exploitables.

### Regle video: place inhabituelle mais defendable

Une equipe qui occupe une place plus haute que son niveau habituel peut quand meme etre selectionnable si elle a une vraie place a defendre ou un vrai projet a proteger: titre, Europe, montee, barrage, maintien.

Ce n'est pas parce que la place est inhabituelle qu'elle est fausse. Elle devient exploitable si:

- l'equipe est reellement dans la course;
- elle peut perdre une place importante;
- l'adversaire est inferieur;
- la disparite de niveau reste claire;
- le contexte lui permet de s'exprimer.

Traduction moteur:

- Ajouter `unusual_position_but_real_project = true/false`.
- Ne pas refuser automatiquement une equipe surperformance si le projet est concret.
- Exiger une verification supplementaire de niveau historique/current dans ce cas.

### Regle video: ne pas compter seulement les buts encaisses

Pour l'equipe qui encaisse, le cours ne regarde pas seulement "a encaisse / n'a pas encaisse".
Il faut comprendre si les buts encaisses sont logiques, anormaux ou douloureux.

Questions a poser:

- L'adversaire qui a marque etait-il normalement capable de marquer contre elle?
- Le but est-il construit dans le jeu ou accidentel?
- L'equipe a-t-elle encaisse contre des equipes inferieures ou malades?
- Le but arrive-t-il a un moment mentalement douloureux: debut rapide, fin de match, apres avoir mene, apres etre revenu?
- L'equipe a-t-elle subi le match meme si le score semble acceptable?

Traduction moteur:

- Ajouter `conceded_goal_quality = built / penalty / set_piece / accident / unknown`.
- Ajouter `conceded_against_weaker_or_sick_team = true/false`.
- Ajouter `painful_concession_timing = early / late / after_leading / after_equalizing / none`.
- Ajouter `scoreline_hides_pressure = true/false`.

### Regle video: equipe malade qui encaisse contre des equipes non dangereuses

Une equipe devient suspecte defensivement si elle encaisse contre des adversaires qui ne montraient pas une vraie capacite offensive avant le match.

C'est plus grave que d'encaisser contre une equipe forte.

Traduction moteur:

- Si l'adversaire precedent etait faible/offensivement malade et marque quand meme: downgrade defense fort.
- Si cela se repete sur plusieurs matchs: marquer `defensive_sickness_confirmed`.
- Utiliser ce signal pour renforcer le +0,5 de l'equipe forte en face.

### Regle video: verifier si l'equipe candidate peut reproduire ce que les autres ont fait

Le fait qu'un adversaire ait encaisse recemment ne suffit pas. Il faut verifier si l'equipe candidate possede les caracteristiques pour reproduire ces buts: niveau superieur, pression, jeu offensif, capacite a construire.

Traduction moteur:

- Ajouter `candidate_can_reproduce_concession_pattern = true/false`.
- Refuser ou shadow si l'adversaire encaisse seulement dans des contextes que la candidate ne peut pas reproduire.

### Regle video: carton rouge et contexte de match

Un resultat peut etre trompeur si un carton rouge a modifie le match. Le cours demande de ne pas lire le score brut sans contexte.

Traduction moteur:

- Ajouter `red_card_distorted_match = true/false`.
- Si oui, diminuer le poids du match dans l'analyse recente.

### Impact Goal 0.5

Ces videos renforcent la partie "adversaire qui encaisse". Le moteur doit passer de:

- "l'adversaire a encaisse dans les 5 derniers matchs"

vers:

- "l'adversaire encaisse des buts construits, douloureux ou anormaux, dans des contextes que l'equipe candidate peut reproduire".

C'est beaucoup plus selectif et plus proche de la logique du cours.

## 2026-08-13 - Dernieres videos, lot 3: equipe caractere

Sources transcrites:

- `6612585d43699_EQUIPECARACTEREEXEMPLEALAN.mp4`
- `661258a8a9b2e_EQUIPECARACTEREEXEMPLEAGNES.mp4`

### Regle video: dissocier resultat final et objectif du pari

Le cours insiste sur une erreur classique: analyser victoire/defaite alors que le pari recherche seulement un but de l'equipe selectionnee.

Pour Goal 0.5, on ne demande pas a l'equipe de gagner le match. On demande:

- a-t-elle montre une capacite concrete a marquer?
- contre quel type d'equipe l'a-t-elle fait?
- dans quel etat psychologique et sportif etaient ces adversaires?
- les buts etaient-ils construits, domines, cherches, ou seulement accidentels?

Traduction moteur:

- Ajouter `result_final_relevance = low/medium/high`.
- Ajouter `goal05_specific_evidence = strong/medium/weak`.
- Ne pas penaliser automatiquement une defaite si l'equipe a quand meme cree et marque dans un contexte transposable.
- Ne pas valoriser automatiquement une victoire si le but recherche n'est pas solide ou reproductible.

### Regle video: tables de niveau obligatoires pour rester serein

La video confirme que les tableaux de disparite de niveau sont indispensables. Sans tableau, l'analyse part dans tous les sens: on regarde une equipe au hasard au lieu de comprendre la hierarchie.

Traduction moteur:

- Toujours charger la table historique du championnat avant l'analyse recente.
- Ajouter `level_table_loaded = true/false`.
- Refuser ou shadow si la disparite de niveau n'est pas etablie.

### Regle video: etat psychologique des equipes marqueuses et encaisseuses

Il faut croiser les deux cotes:

- l'equipe candidate marque contre quelles equipes et dans quel etat?
- l'adversaire encaisse contre quelles equipes et dans quel etat?

Un but marque contre une equipe malade n'a pas la meme valeur qu'un but marque contre une equipe saine. Un but encaisse contre une equipe faible ou malade est plus inquietant defensivement.

Traduction moteur:

- Ajouter `scored_against_opponent_state = strong / normal / sick / weak_unknown`.
- Ajouter `conceded_to_opponent_state = strong / normal / sick / weak_unknown`.
- Ajuster le poids des 5 derniers matchs selon l'etat de l'adversaire rencontre.

### Regle video: caractere = reaction et tenue du match

Une equipe avec du caractere ne se mesure pas seulement au score final. On regarde si elle:

- revient apres avoir encaisse;
- continue d'attaquer apres un avantage;
- tient son score;
- ne s'effondre pas apres un but douloureux;
- marque tot ou force le match par domination.

Traduction moteur:

- Ajouter `team_character_response = strong/neutral/weak`.
- Ajouter `kept_attacking_after_lead = true/false`.
- Ajouter `collapsed_after_concession = true/false`.
- Ajouter `held_score_under_pressure = true/false`.

### Impact Goal 0.5

Le moteur doit devenir plus fin:

- ne plus resumer une forme recente a `W/D/L`;
- ne plus resumer une attaque a `a marque / n'a pas marque`;
- regarder la qualite et la reproductibilite du but recherche.

## 2026-08-13 - Dernieres videos, lot 4: caractere faible et watchlist

Sources transcrites:

- `661257b9dfbef_TOTTENHAMPASDECARACTERE (1).mp4`
- `661258f5b3aa2_EQUIPECARACTEREANALYSERAPHAEL (1).mp4`

### Regle video: etat ou l'equipe marque vs etat ou elle marque avec caractere

Le cours distingue deux niveaux:

1. l'equipe rentre dans le match dans un etat ou elle peut marquer;
2. l'equipe rentre dans le match dans un etat ou elle peut marquer avec caractere.

Une equipe peut marquer souvent mais montrer peu de caractere si elle:

- se fait surprendre contre des equipes inferieures;
- met longtemps a reagir;
- ne tient pas ses scores;
- attend la fin du match pour arracher quelque chose;
- depend trop de penalties ou d'actions tardives.

Traduction moteur:

- Ajouter `scoring_state = yes/no/uncertain`.
- Ajouter `scoring_state_with_character = yes/no/uncertain`.
- Downgrade si `scoring_state=yes` mais `scoring_state_with_character=no`.

### Regle video: reaction tardive = caractere fragile

Une equipe qui reagit seulement tardivement montre une fragilite. Pour Goal 0.5, cela ne l'elimine pas toujours, mais cela reduit la confiance.

Traduction moteur:

- Ajouter `reaction_delay_minutes`.
- Si l'equipe est superieure mais attend longtemps pour reagir contre plus faible: downgrade.
- Si la reaction tardive se repete sur plusieurs matchs: `late_reaction_pattern=true`.

### Regle video: intensite sans but = watchlist, pas signal

Une equipe peut ne pas avoir marque mais montrer de l'intensite, pousser, tirer, dominer, chercher le but. Cela peut justifier une surveillance future, mais pas forcement un signal immediat.

Traduction moteur:

- Ajouter `positive_intensity_without_goal = true/false`.
- Si oui: classer `WATCHLIST_A_SUIVRE`, pas `SIGNAL_VALIDABLE`.
- Reevaluer au match suivant si l'adversaire encaisse et que l'ecart de niveau est favorable.

### Regle video: but tres tardif ou penalty = preuve plus faible

Un but a la 81e/90e ou sur penalty ne prouve pas la meme chose qu'un but construit sous domination.

Traduction moteur:

- Ajouter `late_goal_weight = reduced` si but apres 75e sans domination forte.
- Ajouter `penalty_goal_weight = reduced` sauf si pression offensive claire avant penalty.
- Ne pas compter ces buts comme preuves fortes de capacite a marquer.

### Regle video: suivre l'evolution d'une equipe

Le cours pousse a garder certains cas en observation pour savoir comment l'equipe evolue ensuite. Cela evite de repartir de zero lors du prochain match.

Traduction moteur:

- Ajouter `team_watchlist_reason`.
- Ajouter `next_match_follow_up_required=true` pour les equipes interessantes mais non signalables.
- Conserver les notes de psychologie et d'intensite dans le cache equipe.

### Impact Goal 0.5

Le moteur doit distinguer trois sorties:

- `SIGNAL_VALIDABLE`: equipe forte, enjeu, adversaire fragile, preuve recente propre.
- `WATCHLIST_A_SUIVRE`: signaux d'intensite ou psychologie interessante, mais preuves incompletes.
- `REFUS`: pas de capacite claire a marquer ou caractere trop faible.

## 2026-08-13 - Dernieres videos, lot 5: ordre chronologique et piege equipe qui encaisse

Sources transcrites:

- `660919096bc45_EQUIPEQUIENCAISSEEXERCICEDECOMPREHENSIONRICHARD (1).mp4`
- `6612561959af6_Module4etudedesresultats (1).mp4`

### Regle video: analyser les 5 matchs du plus ancien au plus recent

Le cours impose de lire les cinq derniers matchs dans l'ordre chronologique, du plus ancien au plus recent. Le but est de suivre l'evolution psychologique et sportive de l'equipe, pas seulement de compter des resultats.

Traduction moteur:

- Ajouter `recent_matches_order = oldest_to_newest`.
- Calculer `trend_direction = improving / stable / degrading`.
- Refuser les analyses qui melangent les matchs sans chronologie.

### Regle video: scenario du match avant resultat brut

Pour l'equipe candidate, il faut comprendre le scenario:

- a-t-elle ouvert le score?
- a-t-elle impose le tempo?
- a-t-elle marque dans le jeu avec construction?
- a-t-elle marque vite ou tres tard?
- a-t-elle ete en reaction?
- a-t-elle domine sans convertir?
- a-t-elle produit contre un adversaire qu'elle devait dominer?

Traduction moteur:

- Ajouter `opened_scoring = true/false`.
- Ajouter `imposed_tempo = true/false`.
- Ajouter `was_reactive_not_proactive = true/false`.
- Ajouter `dominated_expected_opponent = true/false`.
- Ajouter `built_goal_or_assisted_goal_present = true/false`.

### Regle video: contre inferieur ou egal, l'equipe candidate doit etre leader du match

Si l'equipe candidate est superieure a l'adversaire recent affronte, elle doit montrer du caractere: pression, domination, initiative, but construit, tempo.

Si elle attend, subit, marque tard, ou marque seulement sur penalty contre une equipe inferieure, c'est une alerte.

Traduction moteur:

- Ajouter `expected_to_lead_match = true/false` selon niveau adversaire.
- Si `expected_to_lead_match=true` et `imposed_tempo=false`: downgrade.
- Si `expected_to_lead_match=true` et but uniquement tardif/penalty: downgrade fort.

### Regle video: caractere offensif et anomalie defensive peuvent coexister

Une equipe peut montrer du caractere offensif tout en ayant une anomalie defensive. Elle peut marquer mais aussi encaisser. Pour Goal 0.5, ce n'est pas forcement negatif si le pari porte seulement sur son but.

Traduction moteur:

- Separarer `offensive_character_score` et `defensive_anomaly_score`.
- Ne pas refuser une candidate uniquement parce qu'elle encaisse, si elle montre une vraie capacite offensive construite.
- Mais augmenter la prudence si l'anomalie defensive menace son plan de match ou son mental.

### Regle video: piege equipe qui encaisse seulement contre beaucoup plus fort

Une equipe qui encaisse contre des equipes clairement superieures ne prouve pas automatiquement qu'elle va encaisser contre une equipe seulement egale ou legerement superieure.

Il faut comparer le niveau de l'equipe candidate avec les equipes qui ont deja fait encaisser l'adversaire.

Traduction moteur:

- Ajouter `candidate_level_matches_prior_scorers = true/false`.
- Si l'adversaire encaisse seulement contre des equipes plus fortes que la candidate: refuser ou shadow.
- Si l'adversaire n'encaisse pas contre equipes inferieures/egales et que la candidate n'est pas nettement superieure: refuser.

### Impact Goal 0.5

Le filtre "adversaire encaisse" devient conditionnel:

- valide seulement si la candidate est au moins du niveau des equipes qui ont deja fait mal;
- non valide si les buts encaisses etaient normaux contre beaucoup plus fort;
- renforce si l'adversaire encaisse aussi contre des equipes faibles, malades ou inferieures.

## 2026-08-13 - Derniere video, lot 6: equipe qui encaisse Agnes

Source transcrite:

- `6609147d14465_EXERCICEEQUIPEQUIENCAISSEAGNES.mp4`

### Regle video: garder l'objectif exact en tete

Quand on analyse une equipe qui doit encaisser, il ne faut pas se perdre dans sa capacite a marquer, ses possessions ou son resultat positif si cela ne repond pas a la question.

Question unique cote adversaire:

- Est-ce que cette equipe rentre dans le match dans un etat ou elle encaisse?

Traduction moteur:

- Ajouter `analysis_objective = candidate_scores / opponent_concedes`.
- Bloquer les criteres hors sujet selon l'objectif en cours.
- Si `analysis_objective=opponent_concedes`, ne pas valoriser les buts marques par l'adversaire sauf s'ils expliquent une anomalie mentale ou un scenario de match.

### Regle video: definir l'environnement global avant les matchs individuels

Avant d'etudier chaque match individuellement, il faut definir l'environnement des cinq derniers matchs: adversaires superieurs, egaux, inferieurs, malades ou en forme.

Traduction moteur:

- Ajouter `recent_environment_summary`.
- Ajouter `opponent_level_mix = superior/equal/inferior counts`.
- Interdire une conclusion sans avoir situe les adversaires rencontres.

### Regle video: douleur psychologique des buts encaisses

Tous les buts encaisses ne font pas le meme effet mental.

Buts tres douloureux:

- but encaisse juste apres une egalisation;
- but encaisse juste avant la mi-temps;
- but encaisse dans les dernieres minutes;
- but encaisse apres avoir repris l'avantage;
- but contre son camp dans un moment cle;
- deux buts encaisses en quelques minutes.

Ces buts peuvent signaler une equipe fragile mentalement, meme si le score final n'est pas catastrophique.

Traduction moteur:

- Ajouter `psychological_goal_pain_score` de 0 a 3.
- Ajouter `conceded_after_equalizer = true/false`.
- Ajouter `conceded_before_halftime = true/false`.
- Ajouter `conceded_after_retaking_lead = true/false`.
- Ajouter `rapid_double_concession = true/false`.
- Renforcer `defensive_sickness_confirmed` si plusieurs douleurs se repetent.

### Regle video: encaisser contre une equipe forte peut etre normal, mais la douleur compte

Encaisser contre une equipe superieure n'est pas automatiquement une faiblesse exploitable. Mais si le scenario montre des buts douloureux, des craquages repetes ou une incapacite a tenir apres effort, cela redevient utile.

Traduction moteur:

- Si `conceded_against_stronger_team=true`, regarder `psychological_goal_pain_score` avant de neutraliser le signal.
- Si l'equipe resiste longtemps mais craque toujours tard: `late_collapse_pattern=true`.
- Si elle egalise puis reprend un but rapidement: downgrade mental fort.

### Impact Goal 0.5

Le moteur Goal 0.5 doit analyser l'adversaire qui encaisse avec trois couches:

1. niveau des equipes qui l'ont fait encaisser;
2. qualite/scenario des buts encaisses;
3. douleur psychologique et repetition du pattern.

Ce lot termine l'integration des videos utiles du cours dans la strategie.
