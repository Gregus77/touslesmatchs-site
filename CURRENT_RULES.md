# CURRENT_RULES.md — Règles actives TousLesMatchs

**Dernière mise à jour : 8 octobre 2026**
**Priorité absolue : ce fichier prévaut sur toute règle historique contradictoire présente ailleurs dans le dépôt.**
**Principe : la décision la plus récente du fondateur remplace l'ancienne.**

## Stratégie sportive principale

TousLesMatchs se concentre sur le **football** et la stratégie principale est :

### +0,5 but équipe favorite — V2

Un candidat n'est valable que si toutes les conditions obligatoires suivantes sont réunies :

1. compétition autorisée par la whitelist de production ;
2. une équipe classée **Top 5** affronte une équipe des **5 dernières** de son championnat/groupe ;
3. l'équipe Top 5 est bien l'équipe favorite/ciblée ;
4. avant match, le candidat peut être signalé au propriétaire pour surveillance ;
5. en live, minute comprise entre **30 et 85** ;
6. l'équipe favorite/ciblée **n'a pas encore marqué** ;
7. marché réel **équipe +0,5 but / équipe marque au moins un but** disponible ;
8. cote réelle, exploitable et fraîche **>= 1,60** ;
9. consensus d'au moins **4 IA sur 5** ;
10. aucune diffusion client si une condition obligatoire manque ;
11. le score qualité V2 doit être **vert (>= 8,0/10)** avec au moins 75 % de couverture factuelle.

### Force historique structurelle — 4 saisons

Le classement courant ne suffit plus. Le moteur analyse **la saison actuelle + les 3 saisons précédentes** avec la pondération suivante :

- saison actuelle : **40 %** ;
- saison N-1 : **25 %** ;
- saison N-2 : **20 %** ;
- saison N-3 : **15 %**.

Le moteur conserve le nombre de saisons disponibles, la position de l'équipe ciblée et de l'adversaire, la force relative au nombre d'équipes et le nombre de saisons où la cible termine Top 5/Top 6. Une équipe promue ou avec historique incomplet est marquée `historique insuffisant` ; aucune valeur manquante n'est remplacée par zéro.

### Forme offensive récente

Sur les **5 derniers matchs de championnat** de l'équipe ciblée :

- au moins **4/5** avec un but marqué ;
- moyenne de buts marqués **>= 1,5** ;
- tirs cadrés, xG et grosses occasions utilisés lorsqu'ils sont réellement disponibles ;
- une statistique avancée absente reste `unknown` et n'est jamais inventée.

### Faiblesse défensive adverse

Sur les **5 derniers matchs de championnat** de l'adversaire :

- au moins **4/5** avec un but encaissé ;
- moyenne encaissée **>= 1,5** ;
- maximum **2 clean sheets** ;
- xGA et données avancées utilisés lorsqu'ils sont réellement disponibles.

### Confirmation live

De la 30e à la 85e minute, la décision réévalue la pression réelle : tirs, tirs cadrés, possession utile, xG live, corners/pression si disponibles, cartons rouges et score. Une excellente équipe historiquement mais inexistante dans le match peut être rejetée.

### Score V2

La note /100 utilise :

- historique structurel : **30 %** ;
- forme offensive récente : **25 %** ;
- faiblesse défensive adverse : **20 %** ;
- données live : **15 %** ;
- contexte/effectif : **10 %**.

Affichage :

- 🟢 **8,0/10 ou plus** : excellent dossier, seul niveau pouvant devenir signal client ;
- 🟠 **6,5 à 7,9/10** : surveillance propriétaire uniquement ;
- 🔴 **moins de 6,5/10** : rejet.

La couleur ne remplace jamais la cote réelle, la fenêtre live ni le consensus 4/5.

### Statistiques et apprentissage

#### Règle de comptabilisation des pronostics propriétaire

- Un match n'entre dans l'historique public des pronostics que s'il a été **explicitement conseillé comme jouable** au propriétaire ou s'il est devenu un **signal officiel conforme**.
- Tout pronostic conseillé est conservé jusqu'à résolution puis obligatoirement marqué **WIN** ou **LOSS** avec le score final vérifié dès qu'il est disponible.
- Les simples candidats de surveillance, matchs exploratoires, matchs écartés et toute rencontre présentée comme **« je ne le jouerais pas » / « à éviter » / « surveillance uniquement »** ne doivent jamais être ajoutés aux statistiques de pronostics joués.
- Un résultat gagnant ne doit jamais être ajouté rétroactivement uniquement parce que le match a gagné : la décision de jouer doit avoir été enregistrée **avant** le résultat.
- Les entrées manuelles/ChatGPT restent séparées des signaux Telegram officiels par leur provenance ; elles peuvent apparaître dans l'historique propriétaire mais ne doivent jamais gonfler les KPI des signaux officiels.
- Cette règle vaut de la même manière pour les **WIN et les LOSS** afin d'éviter tout biais de sélection.

Les signaux officiels et les observations du scanner propriétaire sont séparés. Un ancien conseil manuel/scanner ne doit jamais être transformé en faux signal Telegram officiel. Les statistiques conservent la provenance, la cote réellement observée lorsqu'elle existe, la note/couleur, les données disponibles au moment de la décision et le résultat vérifié.

La règle historique proposant **30 % de bankroll** est interdite dans le produit actuel.

## Scanner multisport propriétaire — règle de présentation et combinés

- Sports suivis : **football, basketball et baseball** en priorité.
- Fréquence de revue : **toutes les 4 heures**.
- Les messages destinés au propriétaire doivent être lisibles par un novice : **drapeau/pays, sport, heure de Paris, match, classement si pertinent, pari exact, cote réelle si disponible, niveau de confiance**.
- Ne jamais afficher au propriétaire les libellés techniques comme « exploratoire », « critère spécifique non vérifié », « couverture fournisseur » ou autres détails internes dans le message principal.
- Si aucune sélection n'est suffisamment solide : afficher seulement **« Aucun match à jouer pour le moment »**.
- Une cote faible **1,10–1,20** peut être retenue si les éléments sportifs la rendent réellement robuste. Elle peut être associée à une seconde sélection indépendante et solide afin de viser une **cote combinée totale d'environ 1,40 à 1,60**.
- Ne jamais ajouter une deuxième sélection uniquement pour atteindre une cote cible. **La qualité prime sur la cote.**
- Aucune sélection n'est présentée comme certaine ou garantie.
- Tout pari explicitement conseillé comme jouable est enregistré avant le résultat, puis clôturé **WIN ou LOSS** avec le score/résultat vérifié. Les matchs écartés ou seulement surveillés ne sont pas comptabilisés.

## Publication

- Un candidat pré-match peut être remonté au propriétaire avec match, équipe ciblée, rangs, heure et niveau de risque.
- Un signal n'est "jouable" que lorsque les conditions live ci-dessus sont réellement constatées.
- Toute diffusion site/Telegram doit être traçable par une preuve de production.
- Une absence de cote réelle fraîche bloque la diffusion.
- On préfère **ne pas envoyer** plutôt que d'envoyer un signal non conforme.

## Anciennes stratégies

- **O/U 2,5 n'est plus la stratégie principale.**
- Les règles O/U historiques peuvent rester dans les archives/tests historiques mais ne doivent pas être réinterprétées comme la politique courante.
- Toute ancienne fenêtre 15–45, 35–45 ou 35–75 relative à O/U ne remplace pas la fenêtre Goal +0,5 actuelle **30–85**.
- Tout ancien quorum 3/5 relatif à O/U ne remplace pas le quorum Goal +0,5 actuel **4/5**.

## Rôle d'Hermès

Hermès est un **Guardian / rapporteur / console propriétaire**, pas un arbitre sportif.

Hermès peut :
- lire l'état de production ;
- contrôler services, API, quotas, budgets, votes, livraisons et incidents ;
- détecter un signal décidé mais non livré ;
- produire le rapport propriétaire quotidien ;
- recevoir les commandes du propriétaire ;
- créer des missions traçables pour exécution/revue.

Hermès ne doit jamais :
- changer une règle sportive ;
- abaisser un seuil ;
- décider qu'un signal doit être envoyé ;
- bloquer un signal conforme décidé par le moteur sportif ;
- modifier directement les fichiers métier ;
- exécuter une commande shell arbitraire reçue depuis Telegram.

## Commande à distance

La console propriétaire Telegram doit accepter :
- commandes de lecture ;
- texte naturel ;
- messages vocaux transcrits ;
- création de missions.

Les actions sensibles (paiement, banque, suppression, secrets, mots de passe, changement de règles sportives, opérations destructives) exigent une confirmation explicite hors exécution automatique.

## Source de vérité

Avant toute intervention :
1. lire ce fichier ;
2. lire l'état courant de production ;
3. considérer les documents historiques uniquement comme contexte ;
4. ne jamais faire revenir une ancienne règle par simple lecture d'un fichier daté.
