# CURRENT_RULES.md — Règles actives TousLesMatchs

**Dernière mise à jour : 5 octobre 2026**
**Priorité absolue : ce fichier prévaut sur toute règle historique contradictoire présente ailleurs dans le dépôt.**
**Principe : la décision la plus récente du fondateur remplace l'ancienne.**

## Stratégie sportive principale

TousLesMatchs se concentre sur le **football** et la stratégie principale est :

### +0,5 but équipe favorite

Un candidat n'est valable que si toutes les conditions suivantes sont réunies :

1. compétition autorisée par la whitelist de production ;
2. une équipe classée **Top 5** affronte une équipe des **5 dernières** de son championnat/groupe ;
3. l'équipe Top 5 est bien l'équipe favorite/ciblée ;
4. avant match, le candidat peut être signalé au propriétaire pour surveillance ;
5. en live, minute comprise entre **30 et 85** ;
6. l'équipe favorite/ciblée **n'a pas encore marqué** ;
7. marché réel **équipe +0,5 but / équipe marque au moins un but** disponible ;
8. cote réelle, exploitable et fraîche **>= 1,60** ;
9. contrôles historiques, forme offensive et attaquants jugés valides ;
10. consensus d'au moins **4 IA sur 5** ;
11. aucune diffusion client si une condition obligatoire manque.

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
