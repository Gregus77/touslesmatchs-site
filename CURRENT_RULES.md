# CURRENT_RULES.md — Règles actives TousLesMatchs

**Dernière mise à jour : 6 octobre 2026**
**Priorité absolue : ce fichier prévaut sur toute règle historique contradictoire présente ailleurs dans le dépôt.**
**Principe : la décision la plus récente du fondateur remplace l'ancienne.**

## Stratégie sportive principale\n\nTousLesMatchs se concentre sur le **football** et la stratégie principale est :\n\n### +0,5 but équipe favorite — V2\n\nUn candidat n'est valable que si toutes les conditions obligatoires suivantes sont réunies :\n\n1. compétition autorisée par la whitelist de production ;\n2. une équipe classée **Top 5** affronte une équipe des **5 dernières** de son championnat/groupe ;\n3. l'équipe Top 5 est bien l'équipe favorite/ciblée ;\n4. avant match, le candidat peut être signalé au propriétaire pour surveillance ;\n5. en live, minute comprise entre **30 et 85** ;\n6. l'équipe favorite/ciblée **n'a pas encore marqué** ;\n7. marché réel **équipe +0,5 but / équipe marque au moins un but** disponible ;\n8. cote réelle, exploitable et fraîche **>= 1,60** ;\n9. consensus d'au moins **4 IA sur 5** ;\n10. aucune diffusion client si une condition obligatoire manque ;\n11. le score qualité V2 doit être **vert (>= 8,0/10)** avec au moins 75 % de couverture factuelle.\n\n### Force historique structurelle — 4 saisons\n\nLe classement courant ne suffit plus. Le moteur analyse **la saison actuelle + les 3 saisons précédentes** avec la pondération suivante :\n\n- saison actuelle : **40 %** ;\n- saison N-1 : **25 %** ;\n- saison N-2 : **20 %** ;\n- saison N-3 : **15 %**.\n\nLe moteur conserve le nombre de saisons disponibles, la position de l'équipe ciblée et de l'adversaire, la force relative au nombre d'équipes et le nombre de saisons où la cible termine Top 5/Top 6. Une équipe promue ou avec historique incomplet est marquée `historique insuffisant` ; aucune valeur manquante n'est remplacée par zéro.\n\n### Forme offensive récente\n\nSur les **5 derniers matchs de championnat** de l'équipe ciblée :\n\n- au moins **4/5** avec un but marqué ;\n- moyenne de buts marqués **>= 1,5** ;\n- tirs cadrés, xG et grosses occasions utilisés lorsqu'ils sont réellement disponibles ;\n- une statistique avancée absente reste `unknown` et n'est jamais inventée.\n\n### Faiblesse défensive adverse\n\nSur les **5 derniers matchs de championnat** de l'adversaire :\n\n- au moins **4/5** avec un but encaissé ;\n- moyenne encaissée **>= 1,5** ;\n- maximum **2 clean sheets** ;\n- xGA et données avancées utilisés lorsqu'ils sont réellement disponibles.\n\n### Confirmation live\n\nDe la 30e à la 85e minute, la décision réévalue la pression réelle : tirs, tirs cadrés, possession utile, xG live, corners/pression si disponibles, cartons rouges et score. Une excellente équipe historiquement mais inexistante dans le match peut être rejetée.\n\n### Score V2\n\nLa note /100 utilise :\n\n- historique structurel : **30 %** ;\n- forme offensive récente : **25 %** ;\n- faiblesse défensive adverse : **20 %** ;\n- données live : **15 %** ;\n- contexte/effectif : **10 %**.\n\nAffichage :\n\n- 🟢 **8,0/10 ou plus** : excellent dossier, seul niveau pouvant devenir signal client ;\n- 🟠 **6,5 à 7,9/10** : surveillance propriétaire uniquement ;\n- 🔴 **moins de 6,5/10** : rejet.\n\nLa couleur ne remplace jamais la cote réelle, la fenêtre live ni le consensus 4/5.\n\n### Statistiques et apprentissage\n\nLes signaux officiels et les observations du scanner propriétaire sont séparés. Un ancien conseil manuel/scanner ne doit jamais être transformé en faux signal Telegram officiel. Les statistiques conservent la provenance, la cote réellement observée lorsqu'elle existe, la note/couleur, les données disponibles au moment de la décision et le résultat vérifié.\n\nLa règle historique proposant **30 % de bankroll** est interdite dans le produit actuel.\n\n## Publication

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
