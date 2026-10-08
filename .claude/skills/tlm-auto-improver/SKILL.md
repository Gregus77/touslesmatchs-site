---
name: tlm-auto-improver
description: >
  Boucle d'auto-amélioration obligatoire de TousLesMatchs. Utilise ce skill
  lorsqu'il faut analyser les gains/pertes, résultats WIN/LOSS, types de
  sélections, équipes, championnats, cotes, minutes de signal, votes IA,
  performances du scanner, signaux officiels, résultats Telegram ou rapports
  Brevo. Il sert à détecter ce qui fonctionne ou se dégrade, proposer ou
  appliquer des améliorations sûres après backtest, puis mesurer leur effet.
  La stratégie football officielle reste +0,5 but équipe favorite V2 tant que
  le fondateur ne décide pas explicitement d'en changer.
---

# TLM Auto Improver

## Mission

Améliorer progressivement la qualité des sélections TousLesMatchs sans
sur-apprendre quelques résultats récents et sans masquer les pertes.

La boucle est :

Collecte → résolution WIN/LOSS → segmentation → diagnostic → hypothèse →
backtest → garde-fous → activation contrôlée → suivi après changement →
rapport Hermès/Brevo.

Le moteur ne doit jamais inventer une cote, un résultat, une statistique, un
vote IA ou une preuve de livraison.

## Sources de vérité

Toujours séparer les populations suivantes :

1. Signaux officiels Goal05 : tables goal05_signal_registry,
   goal05_signal_evidence, goal05_signal_results.
2. Conseils propriétaire réellement proposés comme jouables :
   historique propriétaire/scanner avec provenance explicite.
3. Scanner / surveillance : ne jamais transformer un simple candidat en
   pick joué a posteriori.
4. Ancien système buts totaux : archive historique seulement ; ne jamais
   l'additionner aux KPI de la stratégie +0,5.
5. Livraison : telegram_signal_deliveries et preuves de diffusion.
6. Preuves réelles : tickets/captures réellement vérifiés, sans exposer
   identifiants de ticket, données personnelles ou informations de compte.

## Variables à analyser

Pour chaque sélection résolue, conserver si disponibles :

- sport, pays, compétition, saison ;
- équipes, équipe ciblée, domicile/extérieur ;
- rang cible et rang adverse ;
- cote réelle au moment de la décision ;
- minute et score au moment du signal ;
- score final et WIN/LOSS ;
- note/couleur scanner ;
- votes des 5 IA, consensus, abstentions/erreurs ;
- forme récente, buts marqués/encaissés, historique structurel ;
- cartons rouges, blessures/absences et données live si réellement observées ;
- provenance : officiel / propriétaire joué / scanner non joué ;
- livraison Telegram prouvée ou non ;
- date, heure, jour de semaine.

## Segmentation obligatoire

Calculer au minimum les performances par :

- compétition et pays ;
- équipe ciblée ;
- domicile / extérieur ;
- tranche de cote : 1.10–1.29, 1.30–1.49, 1.50–1.59, 1.60–1.79,
  1.80–1.99, 2.00+ ;
- tranche de minute : 30–44, 45–59, 60–74, 75–85 ;
- rangs Top5/Bottom5 ;
- note scanner ;
- consensus 4/5 vs 5/5 ;
- IA individuelles et combinaisons d'IA ;
- taille de l'échantillon.

Toujours afficher N à côté d'un taux. Un 100 % sur 2 matchs ne doit jamais
être présenté comme une règle supérieure à 78 % sur 100 matchs.

## Mesures

Pour chaque segment calculer :

- N résolu ;
- wins, losses, winrate ;
- cote moyenne réelle uniquement ;
- ROI uniquement si cote et mise/règle de mise sont connues ;
- intervalle d'incertitude ou au minimum avertissement "échantillon faible" ;
- variation vs période précédente ;
- drawdown / série de pertes ;
- calibration : confiance annoncée vs réussite observée.

Les simples candidats non joués servent à mesurer les faux négatifs mais
n'entrent jamais dans le winrate des picks joués.

## Détection d'améliorations

Une hypothèse peut concerner par exemple :

- exclure ou dégrader une ligue ;
- relever/abaisser une note minimale ;
- resserrer une tranche de minute ;
- préférer domicile/extérieur ;
- modifier le poids d'une donnée ;
- identifier une IA peu fiable dans certains contextes ;
- renforcer une condition attaque/défense.

Ne jamais proposer de revenir automatiquement à l'ancien système buts totaux.

## Conditions avant application automatique

Une modification sportive peut être appliquée automatiquement seulement si :

1. elle ne change pas le marché principal : +0,5 but équipe favorite ;
2. elle respecte CURRENT_RULES.md et ne baisse aucun garde-fou dur
   (Top5/Bottom5, fenêtre 30–85, cible à 0 but, cote fraîche >=1,60,
   consensus >=4/5) sans décision explicite du fondateur ;
3. le segment concerné a au moins 30 résultats résolus ; pour une
   modification importante, préférer 50+ ;
4. un backtest chronologique hors-échantillon montre une amélioration, pas
   seulement un meilleur ajustement sur le passé ;
5. le nouveau réglage n'augmente pas fortement le drawdown ou la variance ;
6. aucune donnée future n'est utilisée dans le calcul ;
7. un rollback automatique est possible ;
8. la modification et ses métriques avant/après sont journalisées.

Si une condition manque : recommandation uniquement, pas d'activation.

## Déploiement expérimental

Toute amélioration automatique doit passer par :

1. mode shadow ;
2. comparaison ancien/nouveau réglage ;
3. période minimale ou nombre minimal de nouveaux résultats ;
4. promotion seulement si l'amélioration tient ;
5. rollback si le nouveau réglage sous-performe nettement.

Ne jamais réécrire l'historique pour faire paraître le nouveau modèle meilleur.

## Telegram

- Les signaux conformes restent immédiats.
- Format propriétaire/client : simple, sans jargon :
  pays/drapeau, sport, heure de Paris, match, équipe ciblée, sélection exacte,
  cote réelle, vote IA, risque/confiance.
- Aucun message "signal validé" sans équipe ciblée nommée.
- Résultat : toujours WIN ou LOSS une fois vérifié.
- Ne jamais envoyer un candidat non conforme comme signal.

## Brevo

Choix par défaut :

- Résumé quotidien, pas un email à chaque signal.
- Contenu : résultats du jour, gagnés/perdus, taux avec N, points forts,
  points faibles, éventuelle amélioration activée, lien vers performances.
- Email immédiat seulement pour un signal exceptionnel si toutes les
  conditions officielles sont réunies et si la politique commerciale l'autorise.
- Respecter consentement, désinscription et règles légales ; ne jamais garantir
  un gain ni mettre uniquement les gagnants en avant.

## Rapport Hermès propriétaire

Produire un bloc court avec :

- résultats depuis le dernier rapport ;
- meilleur segment / pire segment avec N ;
- anomalie éventuelle ;
- hypothèse testée ;
- statut : observation / shadow / promue / rollback ;
- action suivante.

## Combinés multisports

Les combinés ne font pas partie de la stratégie officielle Goal05. Ils sont
une couche propriétaire séparée.

Règles :

- ne jamais ajouter une sélection uniquement pour atteindre une cote ;
- une cote 1,10–1,20 peut être combinée seulement si la sélection est
  indépendamment solide ;
- viser environ 1,40–1,60 si cela ne dégrade pas la qualité ;
- tracer chaque jambe séparément et le combiné global ;
- analyser les corrélations et éviter les sélections dépendantes ;
- une jambe perdue = combiné LOSS, sans masquer les autres résultats.

## Interdictions

- pas de cherry-picking ;
- pas de suppression des pertes ;
- pas de faux ROI ;
- pas de cote estimée présentée comme réelle ;
- pas de modification automatique du produit principal ;
- pas de changement après 2 ou 3 mauvais résultats ;
- pas de publication de données personnelles ou identifiants de tickets ;
- pas de gain garanti.

## Quand dire qu'une amélioration est "faite"

Appliquer le skill commissaire.

Une amélioration n'est "en production" que si le code/règle est déployé,
les contrôles sont verts et le comportement réel est vérifié sur l'endpoint,
la base ou le canal concerné.
