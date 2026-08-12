Voici le texte complet à copier-coller dans Codex. J’ai repris toutes les décisions validées sans en retirer. ✅

# MISSION CODEX — CRÉATION ET INTÉGRATION DE « GOAL 0.5 IA »

Tu travailles sur le projet existant TousLesMatchs.com avec Grégory.

Une première formation complète consacrée au marché du +0,5 but d’une équipe t’a déjà été transmise, avec des tableaux, des règles et des explications. Tu dois conserver et exploiter tout ce travail existant.

Après une nouvelle réflexion avec Grégory, nous voulons renforcer considérablement le projet et créer un produit spécialisé appelé provisoirement :

**GOAL 0.5 IA — par TousLesMatchs**

L’objectif n’est pas de recommencer le projet ni de supprimer ce qui existe. Tu dois d’abord auditer l’existant, retrouver les cours, tableaux, analyses et développements déjà réalisés, puis intégrer les exigences suivantes proprement.

Affiche pendant toute la mission une barre de progression claire de 0 à 100 %, mise à jour après chaque étape importante.

---

# 1. OBJECTIF DU PRODUIT

Le produit doit se concentrer sur un seul marché :

**Une équipe sélectionnée marque plus de 0,5 but pendant le match.**

Il ne s’agit pas :

* du +0,5 but global dans le match ;
* du BTTS ;
* du Over 2,5 ;
* du Under 2,5 ;
* de la victoire de l’équipe ;
* du résultat 1X2.

L’application doit sélectionner avant le match l’équipe ayant la meilleure probabilité de marquer au moins un but, puis surveiller en direct la cote correspondant exactement au marché :

**« Équipe sélectionnée : plus de 0,5 but »**

Exemple :

* Manchester City est sélectionné comme équipe historiquement et actuellement supérieure ;
* son adversaire est nettement plus faible ;
* Manchester City n’a pas encore marqué et peut éventuellement perdre 1–0 ;
* la cote « Manchester City marque plus de 0,5 but » monte ;
* lorsque cette cote atteint au minimum 1,60, l’application peut envoyer une alerte d’aide à la décision si toutes les autres conditions restent réunies.

Si l’équipe marque avant que la cote atteigne 1,60 :

* aucun signal n’est envoyé ;
* aucun argent n’est perdu ;
* le match est classé dans les occasions non déclenchées.

L’application ne doit jamais placer automatiquement un pari sur le compte d’un utilisateur. Elle fournit uniquement une analyse et une alerte. L’utilisateur reste seul responsable de sa décision.

---

# 2. COTE MINIMALE

La cote minimale obligatoire est :

**1,60**

Les cotes supérieures sont acceptées si les conditions sportives restent bonnes :

* 1,60 accepté ;
* 1,65 accepté ;
* 1,70 accepté ;
* cote supérieure acceptée uniquement si elle n’est pas montée à cause d’un effondrement réel de l’équipe sélectionnée.

La cote ne doit jamais être l’unique déclencheur.

Une cote élevée peut signifier que l’équipe sélectionnée joue très mal. Le moteur doit donc vérifier les données du match avant tout signal.

La cote doit être :

* récente ;
* horodatée ;
* confirmée pendant plusieurs secondes ;
* idéalement vérifiée auprès d’au moins deux sources ou bookmakers ;
* disponible chez au moins un opérateur agréé en France ;
* rattachée au marché exact « équipe +0,5 but ».

---

# 3. LISTE BLANCHE DES CHAMPIONNATS

Seuls les championnats masculins adultes réguliers présents dans cette liste blanche peuvent être analysés.

## Europe

1. France :

   * Ligue 1
   * Ligue 2

2. Angleterre :

   * Premier League
   * Championship

3. Espagne :

   * LaLiga
   * Segunda División

4. Allemagne :

   * Bundesliga
   * 2. Bundesliga

5. Italie :

   * Serie A
   * Serie B

6. Pays-Bas :

   * Eredivisie
   * Eerste Divisie

7. Belgique :

   * Pro League
   * Challenger Pro League

8. Portugal :

   * Primeira Liga
   * Liga Portugal 2

9. Écosse :

   * Premiership
   * Championship

10. Autriche :

    * Bundesliga
    * 2. Liga

11. Suisse :

    * Super League
    * Challenge League

12. Danemark :

    * Superliga
    * 1st Division

13. Norvège :

    * Eliteserien
    * OBOS-ligaen

14. Suède :

    * Allsvenskan
    * Superettan

15. Pologne :

    * Ekstraklasa
    * I Liga

16. Tchéquie :

    * Première Ligue
    * Deuxième Ligue

17. Irlande :

    * Premier Division
    * First Division

## Amérique du Sud

18. Argentine :

    * Primera División
    * Primera Nacional

19. Brésil :

    * Série A
    * Série B

La Série B brésilienne reste autorisée, mais doit être placée sous surveillance renforcée.

La Primera Nacional argentine doit également être analysée avec davantage de sévérité si son niveau moyen de buts reste faible.

## Asie, Amérique du Nord et Océanie

20. Japon :

    * J1 League
    * J2 League

21. Corée du Sud :

    * K League 1
    * K League 2

22. États-Unis et Canada :

    * MLS uniquement

23. Australie :

    * A-League uniquement

Tout championnat absent de cette liste doit être automatiquement rejeté.

---

# 4. COMPÉTITIONS INTERDITES

Rejeter automatiquement :

* les matchs amicaux ;
* les coupes nationales ;
* la Ligue des champions ;
* les qualifications de Ligue des champions ;
* l’Europa League ;
* la Conference League ;
* la Coupe du monde ;
* les qualifications internationales ;
* les barrages internationaux ;
* les matchs de sélections nationales ;
* les compétitions à élimination directe ;
* les championnats féminins ;
* les compétitions U19, U20, U21, U22 et U23 ;
* les équipes réserves ou équipes B ;
* les championnats non présents dans la liste blanche ;
* la Grèce ;
* la Turquie ;
* le Chili ;
* le Paraguay ;
* l’Équateur ;
* les championnats instables, exotiques ou insuffisamment documentés.

Le principe est de travailler uniquement sur des championnats réguliers dont le fonctionnement, le classement et les données historiques sont comparables.

---

# 5. CONTRÔLE ANJ OBLIGATOIRE

L’ancienne ARJEL est aujourd’hui l’ANJ.

Avant d’envoyer une alerte commerciale à un utilisateur français, vérifier obligatoirement :

1. que la compétition figure parmi les compétitions autorisées en France ;
2. que le type de résultat concerné est autorisé ;
3. que le marché exact « équipe marque plus de 0,5 but » est réellement proposé ;
4. qu’il est disponible chez au moins un bookmaker agréé par l’ANJ ;
5. que la cote affichée provient d’une source utilisable par un client français.

Si une cote est uniquement disponible chez un opérateur non agréé en France :

**aucun signal commercial ne doit être envoyé.**

Prévoir une synchronisation régulière avec la liste officielle de l’ANJ, car cette liste peut évoluer.

Ne jamais créer de bouton permettant à l’application de placer automatiquement une mise.

---

# 6. ANALYSE HISTORIQUE SUR CINQ SAISONS

Pour chaque championnat autorisé, récupérer les cinq dernières saisons entièrement terminées.

Pour chaque saison et chaque club, enregistrer notamment :

* position finale ;
* nombre de points ;
* matchs joués ;
* victoires ;
* matchs nuls ;
* défaites ;
* buts marqués ;
* buts encaissés ;
* différence de buts ;
* performances à domicile ;
* performances à l’extérieur ;
* fréquence des matchs avec au moins un but marqué ;
* fréquence des matchs terminés sans but marqué ;
* niveau des adversaires affrontés ;
* promotions et relégations.

Construire une note historique sur cinq saisons permettant de comparer deux équipes.

Ne pas utiliser uniquement une moyenne brute des positions, car les championnats peuvent avoir des nombres de clubs différents.

Normaliser les positions sous forme de percentile ou de score comparable.

Donner davantage de poids aux saisons récentes :

* dernière saison : poids maximal ;
* avant-dernière saison : poids légèrement inférieur ;
* puis diminution progressive jusqu’à la cinquième saison.

Gérer correctement :

* les clubs promus ;
* les clubs relégués ;
* les saisons manquantes ;
* les changements de division ;
* les changements de nom ;
* les fusions éventuelles ;
* les équipes nouvellement créées.

Une équipe sans cinq saisons complètes ne doit pas recevoir artificiellement une bonne note.

L’historique sur cinq ans est important, mais ne doit pas dominer la forme actuelle. Un club peut changer après un mercato, un changement d’entraîneur ou une modification profonde de son effectif.

---

# 7. DÉBUT DE SAISON ET MERCATOS

Le classement d’un début de saison n’est pas encore fiable.

Appliquer les règles suivantes :

* journées 1 à 5 : aucun signal réel ;
* journées 6 et 7 : observation ou simulation uniquement, avec critères renforcés ;
* à partir de la 8e journée : fonctionnement normal ;
* après le mercato hivernal : prudence renforcée pendant les trois matchs suivants ;
* après un changement massif d’effectif ou d’entraîneur : diminuer temporairement le poids de l’historique.

Pendant les premières journées, enregistrer les analyses en simulation afin d’alimenter le modèle, sans les présenter comme des signaux clients.

---

# 8. ÉCART DE NIVEAU MINIMUM

La stratégie doit rechercher principalement une équipe du haut de tableau contre une équipe du bas de tableau.

Règle idéale :

**Équipe située dans le premier quart du classement contre une équipe située dans le dernier quart.**

Exemples :

* championnat de 20 équipes : top 5 contre cinq derniers ;
* championnat de 18 équipes : premier quart contre dernier quart ;
* championnat de 14 à 16 équipes : environ six places d’écart minimum ;
* championnat de 12 équipes : environ cinq places d’écart minimum.

Pour les championnats de 18 à 20 clubs, viser environ huit places d’écart minimum.

Si l’écart sportif réel est insuffisant, ne pas retenir le match, même si la cote atteint 1,60.

Comparer également les notes historiques des deux équipes, pas seulement leurs positions actuelles.

---

# 9. NOTE PRINCIPALE SUR 100

Créer une note de présélection transparente sur 100 points.

Répartition initiale validée :

| Critère                                     | Maximum |
| ------------------------------------------- | ------: |
| Force historique sur cinq saisons           |      15 |
| Classement de la saison actuelle            |      15 |
| Capacité de l’équipe à marquer récemment    |      15 |
| Faiblesse défensive récente de l’adversaire |      15 |
| Attaquants titulaires et disponibles        |      15 |
| xG, tirs cadrés et occasions récentes       |      10 |
| Forme domicile/extérieur                    |       5 |
| Confrontations directes pertinentes         |       5 |
| Fatigue, moral, entraîneur et calendrier    |       5 |
| Total                                       |     100 |

Seuil initial de présélection :

**80/100 minimum**

Chaque attribution de points doit reposer sur une règle déterministe et explicable. L’IA ne doit pas inventer une note au hasard.

Prévoir la possibilité de recalibrer les poids après les tests historiques, sans les modifier silencieusement en production.

Chaque version des poids doit être enregistrée et datée.

---

# 10. FORME OFFENSIVE DE L’ÉQUIPE SÉLECTIONNÉE

Vérifier notamment :

* si elle a marqué lors de chacun de ses cinq derniers matchs ;
* nombre de buts marqués sur les cinq derniers matchs ;
* xG récents ;
* tirs ;
* tirs cadrés ;
* grosses occasions ;
* présence dans la surface ;
* qualité des attaquants ;
* forme du meilleur buteur ;
* buts à domicile ou à l’extérieur selon le lieu du match ;
* niveau des adversaires récemment affrontés ;
* capacité à marquer après avoir été menée ;
* capacité à marquer en seconde période ;
* fréquence des buts tardifs ;
* enjeu sportif réel.

Ne pas considérer cinq matchs contre des équipes très faibles comme équivalents à cinq matchs contre des équipes fortes.

---

# 11. FAIBLESSE DE L’ADVERSAIRE

Vérifier notamment :

* buts encaissés sur les cinq derniers matchs ;
* fréquence des matchs sans clean sheet ;
* xG encaissés ;
* tirs cadrés concédés ;
* grosses occasions concédées ;
* fragilité en seconde période ;
* buts encaissés après la 70e minute ;
* forme à domicile ou à l’extérieur ;
* absences défensives ;
* gardien absent ou en mauvaise forme ;
* défense remaniée ;
* séries de défaites ;
* changement d’entraîneur ;
* moral et pression ;
* fatigue ;
* calendrier chargé.

Une mauvaise équipe ne doit pas être sélectionnée uniquement parce qu’elle est dernière. Il faut démontrer qu’elle est actuellement vulnérable au but.

---

# 12. COMPOSITIONS, BLESSURES ET SUSPENSIONS

Avant le match et avant le signal en direct, vérifier :

* composition officielle ;
* meilleur buteur ;
* principaux attaquants ;
* meneur de jeu ;
* tireurs de coups de pied arrêtés ;
* joueurs suspendus ;
* cartons rouges précédents ;
* blessures ;
* retour récent de blessure ;
* joueurs sur le banc ;
* changements réalisés pendant le match.

Règles :

* absence du meilleur buteur : pénalité forte ;
* plusieurs attaquants importants absents : rejet possible ;
* équipe très remaniée : prudence ou rejet ;
* défense adverse diminuée : amélioration de la note défensive ;
* meilleur attaquant sorti pendant le match : réévaluation obligatoire ;
* carton rouge contre l’équipe sélectionnée : blocage automatique du signal ;
* carton rouge contre l’adversaire : facteur favorable, mais nouvelle analyse obligatoire.

---

# 13. ENJEU DU MATCH

Ajouter un module spécifique consacré à l’enjeu sportif.

Analyser :

* titre à gagner ;
* qualification européenne ;
* promotion ;
* maintien ;
* relégation ;
* nombre de points à gagner ou à perdre ;
* nombre de journées restantes ;
* adversaires directs au classement ;
* nécessité réelle de marquer ;
* possibilité qu’un match nul suffise ;
* calendrier à venir ;
* prochain match plus important ;
* rotation possible ;
* déclarations de l’entraîneur ;
* motivation réelle.

Une équipe historiquement forte peut jouer sans intensité si elle n’a aucun enjeu ou si un nul lui suffit.

À l’inverse, une équipe ayant absolument besoin de marquer peut recevoir un bonus si les autres données confirment sa supériorité.

---

# 14. RENSEIGNEMENTS EXTERNES

Ajouter une couche de renseignements externes comprise entre :

**–10 et +10 points maximum**

Sources possibles :

* sites officiels des clubs ;
* comptes officiels des clubs ;
* comptes officiels des joueurs ;
* conférences de presse ;
* presse sportive fiable ;
* médias locaux reconnus ;
* L’Équipe ;
* sites de statistiques ;
* sites de résultats ;
* sites de bookmakers ;
* mouvements de cotes ;
* analyses externes sérieuses ;
* réseaux sociaux officiels.

Règles :

* source officielle confirmée : poids fort ;
* information confirmée par plusieurs médias fiables : prise en compte ;
* simple rumeur : zéro point ;
* publication d’un supporter : zéro point ;
* pronostiqueur isolé : influence très faible ;
* plusieurs sources indépendantes concordantes : influence possible ;
* forte variation inexpliquée d’une cote : alerte et vérification ;
* une information externe ne peut jamais sauver un mauvais match statistique.

Conserver pour chaque information :

* source ;
* URL ;
* date et heure ;
* résumé ;
* niveau de fiabilité ;
* effet appliqué à la note.

Après ajustement externe, le match doit toujours respecter le seuil minimal requis.

---

# 15. VALIDATION EN DIRECT

Une équipe sélectionnée avant le match ne doit pas recevoir automatiquement un signal lorsque la cote atteint 1,60.

Le moteur doit vérifier en direct :

* minute du match ;
* score ;
* cote actuelle ;
* fraîcheur de la cote ;
* équipe sélectionnée toujours sans but ;
* onze joueurs ou éventuels cartons rouges ;
* attaquants importants encore présents ;
* tirs ;
* tirs cadrés ;
* xG ;
* occasions franches ;
* corners ;
* attaques dangereuses si disponibles ;
* possession utile ;
* occupation du dernier tiers ;
* rythme récent ;
* pression offensive ;
* changements tactiques ;
* fatigue adverse ;
* comportement de l’adversaire ;
* temps réellement restant.

Le moteur doit détecter si la cote monte parce que :

* le temps passe normalement alors que l’équipe reste dangereuse : situation potentiellement intéressante ;
* l’équipe ne produit absolument rien : aucun signal ;
* un joueur important est sorti : réévaluation ;
* l’équipe a reçu un carton rouge : rejet ;
* le marché est suspendu ou la cote est périmée : aucun signal.

---

# 16. MINUTE MAXIMALE

Pour une opposition très nette, notamment top 5 contre cinq derniers, une alerte peut encore être envoyée tardivement.

Fenêtre maximale :

**jusqu’à la 85e minute**

Cependant, plus la minute est tardive, plus les critères live doivent être sévères.

Créer des seuils progressifs :

* avant la 65e minute : validation normale ;
* de la 65e à la 75e : activité offensive réelle obligatoire ;
* de la 76e à la 80e : domination claire et attaquants présents ;
* de la 81e à la 85e : pression très forte, temps additionnel probable et situation exceptionnelle ;
* après la 85e minute : aucun nouveau signal.

Le temps additionnel estimé doit être pris en compte, mais ne doit pas permettre de dépasser artificiellement la règle.

---

# 17. CONSENSUS DES IA

Le produit doit montrer qu’il repose sur plusieurs analyses statistiques et IA, mais sans créer une architecture lente ou fragile.

Plusieurs moteurs ou IA peuvent analyser indépendamment :

* historique ;
* forme actuelle ;
* attaque ;
* défense adverse ;
* contexte ;
* composition ;
* données en direct ;
* cohérence de la cote.

La décision doit être obtenue par un consensus pondéré.

Cependant, aucune IA conversationnelle ne doit être indispensable dans le chemin critique d’envoi.

Une panne ou une limite de Claude, d’une IA ou d’Hermès ne doit pas empêcher un signal déjà validé d’être enregistré et distribué.

Les règles déterministes doivent rester prioritaires.

---

# 18. NOUVELLE ARCHITECTURE ANTI-FRICTION

L’ancienne architecture comportait trop d’intermédiaires :

* plusieurs IA remontaient à Claude ;
* Claude remontait à Hermès ;
* Hermès gérait Telegram, Stripe et les automatisations.

Cette architecture a créé trop de friction. Des analyses gagnantes apparaissaient sur le site, mais n’avaient jamais été envoyées sur Telegram.

Cela ne doit plus jamais arriver.

Créer une architecture événementielle simple :

1. match détecté ;
2. analyse effectuée ;
3. validation effectuée ;
4. signal enregistré immédiatement en base ;
5. création d’un événement de distribution ;
6. envoi simultané vers les canaux autorisés ;
7. accusé de traitement ;
8. nouvelles tentatives automatiques en cas d’échec ;
9. alerte administrateur si le signal reste bloqué.

Claude et les IA peuvent analyser, mais ne doivent plus constituer une chaîne obligatoire et séquentielle pour envoyer un signal.

Hermès peut continuer à gérer :

* Telegram ;
* Stripe ;
* Brevo ;
* abonnements ;
* automatisations ;
* monitoring.

Mais Hermès ne doit plus être un point unique de panne.

Prévoir :

* file d’attente persistante ;
* identifiant unique du signal ;
* idempotence pour éviter les doublons ;
* retry automatique ;
* dead-letter queue ou file des erreurs ;
* journal technique ;
* horodatage ;
* statut de chaque canal ;
* alerte si aucun canal n’a délivré le signal ;
* possibilité de renvoyer manuellement un signal sans le recréer.

Statuts visibles :

* détecté ;
* analysé ;
* rejeté ;
* validé ;
* enregistré ;
* en attente d’envoi ;
* envoyé ;
* délivré si cette information est disponible ;
* partiellement envoyé ;
* échoué ;
* renvoyé ;
* expiré.

Si aucun canal n’a accepté le message sous environ 30 secondes, envoyer une alerte administrateur.

---

# 19. NOTIFICATIONS UTILISATEURS

Prévoir plusieurs canaux :

1. notification Push sur téléphone ;
2. Telegram ;
3. notification interne dans l’application ;
4. éventuellement e-mail pour les résumés, pas pour le live urgent.

Pour les abonnés :

* demander explicitement leur autorisation de recevoir les notifications ;
* expliquer clairement leur utilité ;
* ne pas demander l’autorisation dès la première seconde sans contexte ;
* associer l’appareil au compte et à l’abonnement ;
* désactiver les notifications si l’abonnement expire ;
* permettre à l’utilisateur de choisir ses canaux.

La notification Push doit pouvoir apparaître :

* lorsque l’utilisateur est ailleurs dans l’application ;
* lorsque le navigateur est fermé, si la technologie et l’autorisation le permettent ;
* sur l’écran verrouillé selon les réglages du téléphone.

Telegram doit rester un canal de secours ou un canal complémentaire.

Exemple de notification :

**🔔 Alerte d’analyse Goal 0.5 IA**

Manchester City +0,5 but
Score : 0–1
Minute : 67e
Cote observée : 1,62
Score statistique : 84/100
Décision finale laissée à l’utilisateur.

Un clic doit ouvrir directement la fiche du match.

---

# 20. HISTORIQUE TRANSPARENT

Séparer strictement :

1. signaux réellement envoyés aux clients ;
2. simulations internes ;
3. matchs présélectionnés sans cote atteinte ;
4. matchs dont l’équipe a marqué avant 1,60 ;
5. signaux validés mais techniquement non délivrés ;
6. matchs rejetés ;
7. erreurs de données.

Seuls les signaux réellement délivrés doivent apparaître dans le bilan commercial officiel.

Ne jamais compter comme victoire commerciale un match analysé mais jamais envoyé.

Pour chaque signal, conserver :

* identifiant ;
* date ;
* championnat ;
* équipes ;
* équipe sélectionnée ;
* score au moment du signal ;
* minute ;
* cote exacte ;
* bookmaker ou source ;
* note avant match ;
* note live ;
* raisons de validation ;
* raisons de rejet éventuelles ;
* heure d’envoi ;
* canaux utilisés ;
* statut de livraison ;
* résultat final ;
* gagné, perdu ou annulé ;
* bénéfice ou perte théorique selon une mise standard ;
* version du modèle ;
* version des poids.

Afficher :

* taux de réussite ;
* rendement ;
* bénéfice théorique ;
* nombre total de signaux ;
* séries gagnantes et perdantes ;
* résultats par championnat ;
* résultats par équipe ;
* résultats selon la minute ;
* résultats selon la cote ;
* résultats domicile/extérieur ;
* résultats selon le score au déclenchement ;
* résultats selon la tranche de score statistique.

Toujours afficher la taille de l’échantillon.

---

# 21. MODE SIMULATION ET BACKTEST

Avant toute commercialisation :

* exécuter la stratégie en simulation ;
* ne jamais engager d’argent automatiquement ;
* tester sur les données historiques disponibles ;
* effectuer un replay minute par minute lorsque les données existent ;
* éviter toute fuite d’information provenant du futur ;
* mesurer les résultats avec les informations réellement disponibles au moment du signal.

Comparer notamment :

* différents seuils de score ;
* différentes minutes d’entrée ;
* cote minimale 1,60 ;
* limites supérieures éventuelles ;
* top 5 contre cinq derniers ;
* écarts de classement ;
* disponibilité des attaquants ;
* carton rouge ;
* domicile/extérieur ;
* championnats ;
* équipes ;
* périodes de saison.

Créer une séparation entre :

* données d’entraînement ;
* données de validation ;
* données de test ;
* fonctionnement réel futur.

Ne pas optimiser le modèle uniquement pour embellir les anciens résultats.

---

# 22. ÉVALUATION DE LA VALEUR

À une cote de 1,60, la probabilité implicite brute est d’environ 62,5 % avant correction de la marge du bookmaker.

Le modèle ne doit pas envoyer une alerte uniquement parce qu’il pense que l’équipe va probablement marquer.

Il doit rechercher une différence favorable entre :

* probabilité estimée par le modèle ;
* probabilité implicite du marché ;
* marge et incertitude.

Exemple :

* cote : 1,60 ;
* probabilité implicite brute : 62,5 % ;
* probabilité calibrée estimée par le modèle : 70 % ;
* marge de sécurité suffisante : alerte possible.

Calibrer les probabilités et vérifier leur fiabilité sur la durée.

Ne jamais afficher une certitude.

---

# 23. API DE COTES

Auditer en priorité les API et abonnements déjà disponibles dans le projet.

API-Football/API-Sports est déjà utilisée et dispose d’un quota connu. Vérifier concrètement si elle fournit :

* les cotes en direct ;
* le marché exact « team total over 0.5 » ;
* les ligues de la liste blanche ;
* les bookmakers utilisables en France ;
* la fréquence réelle de mise à jour ;
* les historiques nécessaires.

Comparer si nécessaire avec :

* Sportmonks ;
* The Odds API ;
* Betfair Exchange ou une autre source compatible ;
* autres fournisseurs fiables.

Ne souscrire à aucune nouvelle API avant d’avoir produit un tableau de couverture réel indiquant :

* championnat ;
* marché disponible ;
* bookmaker ;
* fréquence de mise à jour ;
* latence ;
* historique ;
* coût ;
* limites ;
* conformité pour la France.

Prévoir une source principale et une source de secours si le coût le permet.

---

# 24. GESTIONNAIRE PERSONNEL DE BANKROLL

Créer une page séparée de gestion personnelle.

L’utilisateur peut enregistrer :

* bankroll de départ ;
* limite de perte ;
* limite hebdomadaire ;
* montant maximal par décision ;
* nom du match ;
* équipe ;
* cote ;
* montant engagé ;
* gagné ;
* perdu ;
* annulé ;
* résultat financier ;
* commentaire personnel.

L’historique doit rester sauvegardé dans son compte lorsqu’il se reconnecte.

Afficher :

* bankroll actuelle ;
* évolution ;
* gains ;
* pertes ;
* rendement ;
* montant total engagé ;
* pire baisse ;
* série en cours ;
* limites atteintes.

Le gestionnaire doit être privé et séparé des statistiques officielles du service.

Ne jamais connecter automatiquement le compte d’un bookmaker.

---

# 25. PROGRESSIONS OU « MONTANTES »

Une page peut permettre de simuler une progression de trois ou quatre étapes.

Cependant :

* aucune martingale ;
* aucune récupération automatique des pertes ;
* aucun encouragement à rejouer après une perte ;
* aucune mise automatique ;
* aucune promesse de gains.

L’assistant peut recommander :

* d’arrêter la progression ;
* de sécuriser une partie du résultat ;
* de revenir à la mise de départ ;
* de ne pas dépasser la limite définie ;
* de faire une pause.

Exemples d’alertes :

* « Votre objectif de progression est atteint. Sécurisez le résultat. »
* « Votre exposition dépasse la limite définie. Ne poursuivez pas. »
* « Une perte vient d’être enregistrée. Ne cherchez pas à la récupérer immédiatement. »
* « Votre limite hebdomadaire est atteinte. »

Une bankroll de 20 € avec une mise de 5 € représente 25 % de la bankroll et doit être signalée comme exposition très élevée.

---

# 26. POSITIONNEMENT COMMERCIAL ET JURIDIQUE

Le produit peut être présenté comme :

**un outil statistique d’aide à la décision**

Cependant, ne pas croire que le simple remplacement du mot « pari » par « aide à la décision » supprime les obligations juridiques.

La fonction réelle du service compte.

Avant commercialisation :

* demander une validation juridique adaptée ;
* respecter les règles ANJ, DGCCRF, ARPP, protection des mineurs, RGPD et droit de la consommation ;
* afficher clairement 18+ ;
* intégrer le jeu responsable ;
* fournir un accès aux ressources d’aide ;
* permettre de couper les notifications ;
* éviter les mécanismes de pression excessive.

Interdictions marketing :

* aucune promesse de gains ;
* aucun enrichissement garanti ;
* aucune méthode présentée comme sûre ;
* aucun « revenu facile » ;
* aucune fausse urgence ;
* aucun taux de réussite trompeur ;
* aucune sélection des seules victoires ;
* aucune publicité montrant un train de vie luxueux comme conséquence du service ;
* aucune présentation laissant croire que l’IA ne peut pas perdre.

Formulations recommandées :

* « Analyse statistique »
* « Aide à la décision »
* « Probabilité estimée »
* « Score statistique »
* « Cote observée »
* « Aucun résultat n’est garanti »
* « Décision finale laissée à l’utilisateur »

La commercialisation via des influenceurs doit faire l’objet d’une vérification juridique spécifique avant toute action.

---

# 27. INTÉGRATION À TOUSLESMATCHS.COM

Ne pas créer immédiatement une marque, un site et une infrastructure complètement séparés.

Intégrer d’abord le produit à TousLesMatchs.com :

**Goal 0.5 IA — par TousLesMatchs**

Route proposée :

`https://touslesmatchs.com/goal-05`

Ordre recommandé :

1. intégration au site existant ;
2. simulation ;
3. preuve de fiabilité ;
4. première commercialisation ;
5. PWA installable ;
6. application Android seulement lorsque le produit est validé.

Réutiliser autant que possible :

* comptes utilisateurs ;
* abonnements ;
* Stripe ;
* Telegram ;
* base de données ;
* système de langues ;
* infrastructure ;
* statistiques ;
* design existant.

Mais isoler techniquement le moteur Goal 0.5 afin qu’une panne de l’ancien concile ne bloque pas ce produit.

---

# 28. DESIGN ET EXPÉRIENCE UTILISATEUR

Style attendu :

* fond noir ou bleu nuit ;
* violet électrique ;
* bleu ;
* cyan ;
* touches rose/violet possibles ;
* aucun vert, jaune ou doré dominant ;
* rendu futuriste ;
* texte parfaitement net ;
* interface mobile prioritaire ;
* aspect premium et crédible ;
* aucune surcharge visuelle.

Éléments visuels souhaités :

* minute et score très visibles ;
* jauge de cote progressant vers 1,60 ;
* cercle de consensus des IA ;
* score statistique sur 100 ;
* radar attaque contre défense ;
* évolution de la cote ;
* chronologie des tirs, occasions, cartons et xG ;
* statut très clair ;
* fiche expliquant pourquoi l’alerte est validée ;
* historique gagné/perdu ;
* graphiques de rendement ;
* badges des championnats et clubs si les licences le permettent.

États possibles :

* EN ANALYSE ;
* PRÉSÉLECTIONNÉ ;
* COTE EN ATTENTE ;
* CONDITIONS DÉGRADÉES ;
* ALERTE VALIDÉE ;
* AUCUNE ALERTE ;
* MARCHÉ INDISPONIBLE ;
* NON AUTORISÉ EN FRANCE.

L’utilisateur doit comprendre en quelques secondes :

* quelle équipe est surveillée ;
* pourquoi elle a été choisie ;
* quelle cote est attendue ;
* pourquoi l’alerte est envoyée ou refusée ;
* combien de temps il reste.

---

# 29. TUNNEL D’ABONNEMENT

Le tunnel doit expliquer simplement :

1. l’application analyse les championnats autorisés ;
2. elle présélectionne une équipe forte ;
3. elle surveille le match en direct ;
4. elle attend une cote d’au moins 1,60 ;
5. elle vérifie que les conditions restent favorables ;
6. elle envoie une alerte si tout est validé ;
7. l’utilisateur décide seul.

Ne pas promettre un nombre fixe de signaux.

Expliquer qu’il peut n’y avoir aucun signal si :

* aucun match n’est assez solide ;
* la cote n’atteint jamais 1,60 ;
* l’équipe marque trop tôt ;
* le marché n’est pas disponible en France ;
* les conditions live se dégradent.

La rareté des signaux doit être présentée comme une conséquence de la sélection stricte, pas comme une garantie de réussite.

---

# 30. SEO ET MARKETING

Préparer une stratégie SEO autour de sujets informatifs et conformes :

* analyse statistique football ;
* comprendre le +0,5 but d’une équipe ;
* fonctionnement des probabilités ;
* comprendre une cote ;
* gestion de bankroll ;
* différence entre probabilité et certitude ;
* analyse offensive et défensive ;
* jeu responsable.

Ne pas publier automatiquement de contenu marketing tant qu’il n’a pas été validé.

Ne pas créer de fausses preuves sociales.

Ne pas inventer :

* utilisateurs ;
* témoignages ;
* résultats ;
* gains ;
* partenaires ;
* taux de réussite.

Prévoir des pages :

* fonctionnement ;
* méthodologie ;
* résultats vérifiés ;
* limites du modèle ;
* jeu responsable ;
* FAQ ;
* tarifs ;
* mentions légales ;
* politique de confidentialité ;
* conditions d’utilisation.

---

# 31. SKILLS SPÉCIALISÉS

Ne crée pas une multitude de skills qui se chevauchent.

Respecte la hiérarchie existante :

* TLM Premium Guardian reste le garde-fou supérieur ;
* TLM Skill Architect organise les skills ;
* aucun nouveau skill spécialiste ne doit être créé ou intégré sans validation explicite de Grégory.

Tu peux proposer les skills suivants, en vérifiant d’abord s’ils existent déjà ou s’ils peuvent être fusionnés avec l’existant :

1. TLM Goal 0.5 Guardian
2. TLM Historical Analyst
3. TLM Live Signal Analyst
4. TLM Compliance Guardian
5. TLM Conversion Designer
6. TLM SEO Marketing

Rôles envisagés :

* Guardian : protège les règles validées ;
* Historical Analyst : historique des cinq saisons ;
* Live Signal Analyst : validation du direct et de la cote ;
* Compliance Guardian : ANJ, transparence et jeu responsable ;
* Conversion Designer : expérience utilisateur et tunnel ;
* SEO Marketing : référencement conforme.

Avant toute création, produire :

* le besoin ;
* le périmètre ;
* les déclencheurs ;
* les chevauchements ;
* la proposition de fusion éventuelle ;
* les bénéfices ;
* les risques.

Attendre ensuite le « OUI » explicite de Grégory.

---

# 32. SÉCURITÉ ET QUALITÉ DES DONNÉES

Mettre en place :

* contrôle des données manquantes ;
* contrôle des doublons ;
* correspondance fiable des équipes ;
* correspondance fiable des compétitions ;
* détection des cotes périmées ;
* horodatage en UTC ;
* affichage dans le fuseau de l’utilisateur ;
* journal des changements ;
* versionnage du modèle ;
* sauvegardes ;
* monitoring ;
* alertes API ;
* suivi des quotas ;
* contrôle des coûts IA ;
* limitation des appels inutiles ;
* tests automatisés.

Ne jamais remplacer une donnée manquante par une valeur inventée.

Si une donnée essentielle manque :

* diminuer la fiabilité ;
* passer en simulation ;
* ou rejeter le match.

---

# 33. TABLEAU ADMINISTRATEUR

Créer un tableau administrateur affichant :

* matchs disponibles ;
* matchs rejetés ;
* raisons de rejet ;
* présélections ;
* scores ;
* cotes ;
* alertes en attente ;
* alertes envoyées ;
* livraison Push ;
* livraison Telegram ;
* erreurs ;
* quotas API ;
* coûts IA ;
* disponibilité des services ;
* historique des retries ;
* championnat sous surveillance ;
* version du modèle.

Ajouter un bouton sécurisé permettant :

* de désactiver temporairement une ligue ;
* de suspendre tous les signaux ;
* de renvoyer un signal échoué ;
* de passer en mode simulation ;
* de consulter la preuve de décision.

Aucun bouton administrateur ne doit modifier rétroactivement les statistiques officielles sans laisser une trace d’audit.

---

# 34. INDICATEURS À MESURER

Mesurer au minimum :

* nombre de matchs détectés ;
* nombre de matchs analysés ;
* nombre de présélections ;
* nombre de cotes ayant atteint 1,60 ;
* nombre de signaux validés ;
* nombre de signaux délivrés ;
* nombre de signaux perdus techniquement ;
* taux de réussite ;
* rendement ;
* latence entre validation et envoi ;
* disponibilité des API ;
* coût moyen par analyse ;
* performance par ligue ;
* performance par tranche de minute ;
* performance par tranche de cote ;
* performance domicile/extérieur ;
* calibration des probabilités ;
* taux de faux signaux ;
* matchs gagnants jamais envoyés, affichés séparément et non inclus dans le bilan commercial.

---

# 35. PRINCIPES NON NÉGOCIABLES

1. Aucun pari automatique.
2. Aucun championnat hors liste blanche.
3. Aucun signal français hors périmètre ANJ.
4. Cote minimale de 1,60.
5. Cote seule insuffisante.
6. Score de présélection minimum de 80/100.
7. Aucune alerte après la 85e minute.
8. Carton rouge contre l’équipe sélectionnée = blocage.
9. Plusieurs attaquants majeurs absents = rejet probable.
10. Début de saison protégé.
11. Historique sur cinq saisons, pondéré et normalisé.
12. Forme actuelle prioritaire sur la réputation.
13. Aucun résultat garanti.
14. Aucun signal validé ne doit disparaître silencieusement.
15. Seuls les signaux réellement délivrés comptent dans les résultats commerciaux.
16. Simulations internes clairement séparées.
17. Chaque décision doit être explicable.
18. Chaque source doit être horodatée.
19. Chaque version du modèle doit être conservée.
20. Toute modification importante des règles nécessite validation de Grégory.

---

# 36. MÉTHODE DE TRAVAIL DEMANDÉE

Commence obligatoirement par un audit en lecture seule.

Tu dois :

1. retrouver tout le travail existant concernant le +0,5 but ;
2. retrouver les cours et tableaux déjà intégrés ;
3. cartographier l’architecture actuelle ;
4. identifier pourquoi certains signaux gagnants n’ont jamais été envoyés ;
5. identifier les API et abonnements déjà disponibles ;
6. vérifier la couverture réelle du marché « équipe +0,5 but » ;
7. comparer l’existant avec ce cahier des charges ;
8. dresser la liste de ce qui existe, manque, se contredit ou doit être corrigé ;
9. proposer un plan d’exécution précis ;
10. attendre la validation de Grégory avant toute modification importante.

Ne supprime rien.

Ne casse pas l’existant.

Ne remplace pas les règles actuelles sans expliquer l’impact.

Ne déploie rien en production sans validation.

Ne crée aucun nouveau skill sans accord explicite.

Travaille ensuite strictement étape par étape.

À chaque étape :

* indique ce que tu vas faire ;
* affiche la progression globale ;
* effectue uniquement l’étape validée ;
* vérifie le résultat ;
* montre les preuves ;
* signale les erreurs franchement ;
* attends la validation avant de poursuivre si l’étape présente un risque.

---

# 37. PREMIÈRE RÉPONSE ATTENDUE DE CODEX

Ta première réponse ne doit contenir aucun code et ne doit rien modifier.

Elle doit contenir uniquement :

1. confirmation de ta compréhension ;
2. résumé de l’objectif ;
3. éléments existants retrouvés ;
4. contradictions détectées ;
5. risques techniques ;
6. risques juridiques ;
7. couverture probable des API existantes ;
8. causes possibles des signaux non envoyés ;
9. architecture cible proposée ;
10. plan détaillé par phases ;
11. estimation de progression ;
12. questions indispensables restantes.

Tu peux proposer des améliorations supplémentaires si elles renforcent :

* la qualité statistique ;
* la fiabilité ;
* la conformité ;
* la transparence ;
* la rapidité des notifications ;
* la conversion commerciale ;
* la maîtrise des coûts.

Tu ne dois cependant modifier aucune règle non négociable sans demander l’autorisation de Grégory.

Petit rappel prioritaire ⚠️ : dès que tu rentres chez toi, envoie-moi la capture de la réponse officielle concernant ta contestation de l’AFD n° 9595229727, pour qu’on termine le recommandé rapidement.
